import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import type { CladeData, GenusData, TreeNode } from "./types.ts";
import { collectAllKeys, escapeRegExp, findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const cladesDir = path.join(root, "clades");
const treePath = path.join(root, "tree.yml");
const statePath = path.join(root, ".github", "paper-watch", "state.json");
const digestPath = path.join(root, "reports", "paper-watch.md");

/**
 * OpenAlex concept id for Paleontology. Used to bound the fetch volume to
 * paleontology literature, which also suppresses cross-kingdom homonyms
 * before local taxon-name matching runs.
 */
const paleontologyConceptId = "C151730666";

const openAlexBase = "https://api.openalex.org/works";

/**
 * Genus names at or below this length are treated as homonym-prone: they
 * collide with common words and place names (e.g. Mei, Tawa, Kuru). A match
 * on such a name only counts when the work also carries dinosaur context.
 */
const shortNameThreshold = 5;

/**
 * OpenAlex work types kept by the watcher (applied as a fetch-time filter).
 * Excludes datasets, 3D scans, peer-review records, paratext (covers, tables
 * of contents), errata, and the like, which are not the papers we track.
 */
const articleTypes = ["article", "review", "preprint", "book-chapter", "book", "dissertation"];

/**
 * Source (host) name substrings for nomenclatural / biodiversity registries
 * whose DOIs are registration stubs, not the describing paper. Matched
 * case-insensitively against the work's host venue and dropped, since the
 * real paper — when indexed — appears as its own journal article.
 */
const registrySources = ["catalogue of life", "checklistbank", "global biodiversity information facility", "gbif"];

/**
 * Generic self-deposit / data repositories. Works hosted here are kept but
 * flagged with a note, since they are often self-published essays or
 * deposited copies rather than journal articles. Deliberately excludes
 * dedicated preprint servers (bioRxiv, EarthArXiv), whose preprints are not
 * "self-published" in this sense.
 */
const depositSources = ["zenodo", "figshare"];

/**
 * One discovered work that mentioned at least one tracked taxon name.
 */
type WatchHit = {
    /**
     * Digital Object Identifier (bare, no URL prefix), or null when OpenAlex
     * has no DOI for the work.
     */
    doi: string | null;

    /**
     * OpenAlex work id (always present; used as the dedup key when no DOI).
     */
    openAlexId: string;

    /**
     * Work title (HTML tags stripped).
     */
    title: string;

    /**
     * Publication date as reported by OpenAlex (ISO yyyy-mm-dd).
     */
    publicationDate: string;

    /**
     * Host venue (journal or repository) display name, when known.
     */
    venue: string | null;

    /**
     * True when OpenAlex reports a freely readable version exists anywhere
     * (work-level open access), regardless of which copy is the journal of
     * record.
     */
    isOpenAccess: boolean;

    /**
     * True when the host is a generic self-deposit repository (see
     * depositSources): the entry is kept but flagged as possibly a
     * self-published essay or deposited copy rather than a journal article.
     */
    isDeposit: boolean;

    /**
     * Canonical genus names matched in the title or abstract.
     */
    genera: Array<string>;

    /**
     * Clade names matched in the title or abstract (empty unless --clades).
     */
    clades: Array<string>;
};

/**
 * Persisted watcher state so successive runs only surface works published
 * since the previous run and never re-report the same work twice.
 */
type WatchState = {
    /**
     * ISO date of the previous successful run (used as the default `since`).
     */
    lastRun: string | null;

    /**
     * Dedup keys (DOI when present, else OpenAlex id) already reported.
     */
    seen: Array<string>;
};

/**
 * Parsed command-line options.
 */
type Options = {
    since: string;
    days: number;
    includeClades: boolean;
    maxPages: number;
    conceptId: string;
    mailto: string;
    writeState: boolean;
    jsonPath: string | null;
    allShort: boolean;
};

/**
 * Parses process arguments into a typed options object, applying defaults
 * and deriving the `since` date from saved state when not given explicitly.
 *
 * @param argv - Raw arguments (typically `process.argv.slice(2)`).
 * @param state - Previously persisted watcher state.
 * @returns The resolved options for this run.
 */
function parseOptions(argv: Array<string>, state: WatchState): Options
{
    const flag = (name: string): string | null =>
    {
        const index = argv.indexOf(name);

        return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null;
    };

    const days = Number(flag("--days") ?? "30");
    let since = flag("--since") ?? state.lastRun;

    if (!since)
    {
        const start = new Date();
        start.setUTCDate(start.getUTCDate() - days);
        since = start.toISOString().slice(0, 10);
    }

    return {
        since,
        days,
        includeClades: argv.includes("--clades"),
        maxPages: Number(flag("--max-pages") ?? "25"),
        conceptId: flag("--concept") ?? paleontologyConceptId,
        mailto: flag("--mailto") ?? process.env.OPENALEX_MAILTO ?? "open-paleo@users.noreply.github.com",
        writeState: argv.includes("--write-state"),
        jsonPath: flag("--json"),
        allShort: argv.includes("--all-short"),
    };
}

/**
 * Loads the persisted watcher state, returning an empty state when the
 * file does not yet exist.
 *
 * @returns The parsed state, or a fresh empty state.
 */
function loadState(): WatchState
{
    if (!fs.existsSync(statePath))
    {
        return { lastRun: null, seen: [] };
    }

    return JSON.parse(fs.readFileSync(statePath, "utf8")) as WatchState;
}

/**
 * Builds the taxon-name lookup tables from the genus and clade YAML data.
 * Genus synonyms are mapped back to their current genus so a paper using an
 * obsolete name still surfaces under the right entry.
 *
 * @param includeClades - Whether to also surface clade-name matches in output.
 * @returns A name-to-canonical-genus map, the reportable clade-name set, the
 *     full tree-clade set (used as homonym corroboration), and the genus count.
 */
function buildNameIndex(includeClades: boolean): {
    generaByName: Map<string, string>;
    cladeNames: Set<string>;
    allCladeNames: Set<string>;
    genusCount: number;
}
{
    const generaByName = new Map<string, string>();
    let genusCount = 0;

    for (const file of findYamlFiles(generaDir))
    {
        const data = parseYaml<GenusData>(file);
        const genusName = data.genus ?? path.basename(file, path.extname(file));

        generaByName.set(genusName, genusName);
        genusCount++;

        for (const synonym of data.synonyms ?? [])
        {
            if (synonym.name && !generaByName.has(synonym.name))
            {
                generaByName.set(synonym.name, genusName);
            }
        }
    }

    const tree = parseYaml<TreeNode>(treePath);
    const allCladeNames = new Set(collectAllKeys(tree));
    const cladeNames = new Set<string>();

    if (includeClades)
    {
        for (const file of findYamlFiles(cladesDir))
        {
            const data = parseYaml<CladeData>(file);
            const cladeName = data.clade ?? path.basename(file, path.extname(file));

            if (allCladeNames.has(cladeName))
            {
                cladeNames.add(cladeName);
            }
        }
    }

    return { generaByName, cladeNames, allCladeNames, genusCount };
}

/**
 * Compiles a single case-sensitive, word-boundaried alternation regex over
 * all supplied names. Matching the capitalized form only keeps common
 * lowercase words from registering as taxon hits.
 *
 * @param names - The taxon names to match.
 * @returns A global RegExp, or null when there are no names.
 */
function compileNameMatcher(names: Array<string>): RegExp | null
{
    if (names.length === 0)
    {
        return null;
    }

    const alternation = names.map(escapeRegExp).join("|");

    return new RegExp(`\\b(${alternation})\\b`, "g");
}

/**
 * Reconstructs plain abstract text from OpenAlex's inverted-index form.
 *
 * @param invertedIndex - The `abstract_inverted_index` object, or null.
 * @returns The reconstructed abstract, or an empty string.
 */
function reconstructAbstract(invertedIndex: Record<string, Array<number>> | null | undefined): string
{
    if (!invertedIndex)
    {
        return "";
    }

    const positions: Array<string> = [];

    for (const [word, indices] of Object.entries(invertedIndex))
    {
        for (const index of indices)
        {
            positions[index] = word;
        }
    }

    return positions.join(" ");
}

/**
 * Strips simple HTML tags. OpenAlex titles embed markup such as <i>...</i>.
 *
 * @param value - The raw string.
 * @returns The string with tags removed.
 */
function stripTags(value: string): string
{
    return value.replace(/<[^>]+>/g, "");
}

/**
 * Normalizes a DOI for dedup: lowercased, with any trailing version suffix
 * (figshare/Zenodo ".v1", ".v2", ...) removed so reposts collapse to one.
 *
 * @param doi - The bare DOI.
 * @returns The normalized DOI.
 */
function normalizeDoi(doi: string): string
{
    return doi.toLowerCase().replace(/\.v\d+$/, "");
}

/**
 * Normalizes a title for dedup: tag-stripped, lowercased, alphanumerics
 * only. Lets a preprint or press copy collapse onto the journal version
 * when both carry the same title.
 *
 * @param title - The raw title.
 * @returns The normalized title.
 */
function normalizeTitle(title: string): string
{
    return stripTags(title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Computes a hit's dedup key: its version-normalized DOI when present,
 * otherwise the OpenAlex id.
 *
 * @param hit - The hit.
 * @returns The dedup key.
 */
function dedupKeyFor(hit: WatchHit): string
{
    return hit.doi ? normalizeDoi(hit.doi) : hit.openAlexId;
}

/**
 * Returns true for DOIs minted by data repositories or preprint servers,
 * which are de-prioritized in favor of the journal-of-record copy when two
 * works share a title.
 *
 * @param doi - The bare DOI.
 * @returns True when the DOI is from a repository/preprint host.
 */
function isRepositoryDoi(doi: string): boolean
{
    return /figshare|zenodo|pangaea|egusphere|10\.22541/i.test(doi);
}

/**
 * Ranks a hit by how authoritative its copy is: journal DOI (2) beats a
 * repository/preprint DOI (1) beats no DOI (0).
 *
 * @param hit - The hit to score.
 * @returns The preference score.
 */
function hitScore(hit: WatchHit): number
{
    if (!hit.doi)
    {
        return 0;
    }

    return isRepositoryDoi(hit.doi) ? 1 : 2;
}

/**
 * Merges the taxon matches of one hit into another (set union).
 *
 * @param target - The hit kept; mutated in place.
 * @param other - The hit folded in.
 */
function mergeHit(target: WatchHit, other: WatchHit): void
{
    target.genera = [...new Set([...target.genera, ...other.genera])].sort();
    target.clades = [...new Set([...target.clades, ...other.clades])].sort();
}

/**
 * Collapses duplicate hits: first by normalized DOI (versioned reposts),
 * then by normalized title (preprint/press vs. journal), keeping the most
 * authoritative copy and unioning the taxon matches.
 *
 * @param candidates - The raw per-work hits.
 * @returns The deduplicated hits.
 */
function dedupHits(candidates: Array<WatchHit>): Array<WatchHit>
{
    const byKey = new Map<string, WatchHit>();

    for (const candidate of candidates)
    {
        const key = dedupKeyFor(candidate);
        const existing = byKey.get(key);

        if (existing)
        {
            mergeHit(existing, candidate);
        }
        else
        {
            byKey.set(key, candidate);
        }
    }

    const byTitle = new Map<string, WatchHit>();

    for (const candidate of byKey.values())
    {
        const normalizedTitle = normalizeTitle(candidate.title);
        const titleKey = normalizedTitle.length > 0 ? normalizedTitle : dedupKeyFor(candidate);
        const existing = byTitle.get(titleKey);

        if (!existing)
        {
            byTitle.set(titleKey, candidate);
        }
        else if (hitScore(candidate) > hitScore(existing))
        {
            mergeHit(candidate, existing);
            byTitle.set(titleKey, candidate);
        }
        else
        {
            mergeHit(existing, candidate);
        }
    }

    return [...byTitle.values()];
}

/**
 * Fetches recent paleontology works from OpenAlex, page by page, and yields
 * the raw work objects. Uses cursor pagination and the polite pool (mailto).
 *
 * @param options - Resolved run options.
 * @returns The collected work objects.
 */
async function fetchRecentWorks(options: Options): Promise<Array<Record<string, unknown>>>
{
    const filter = `concepts.id:${options.conceptId},from_publication_date:${options.since}`
        + `,type:${articleTypes.join("|")}`;
    const works: Array<Record<string, unknown>> = [];
    let cursor = "*";
    let page = 0;

    while (cursor && page < options.maxPages)
    {
        const query = new URLSearchParams({
            filter,
            "per-page": "200",
            cursor,
            mailto: options.mailto,
            select: "id,doi,title,publication_date,primary_location,open_access,abstract_inverted_index",
        });

        const response = await fetch(`${openAlexBase}?${query.toString()}`);

        if (!response.ok)
        {
            throw new Error(`OpenAlex request failed: ${response.status} ${response.statusText}`);
        }

        const payload = await response.json() as {
            results: Array<Record<string, unknown>>;
            meta: { next_cursor: string | null };
        };

        works.push(...payload.results);
        cursor = payload.meta.next_cursor ?? "";
        page++;

        if (payload.results.length === 0)
        {
            break;
        }
    }

    return works;
}

/**
 * Matches a batch of works against the taxon-name index, applies the
 * short-name homonym guard, dedups against already-seen and duplicate
 * works, and returns the fresh hits newest-first.
 *
 * A match on a short (homonym-prone) genus name is kept only when the work
 * carries dinosaur context: a longer genus name, a clade name, the literal
 * word "dinosaur", or any tree-clade name. The `--all-short` option turns
 * the guard off for auditing.
 *
 * @param works - Raw OpenAlex work objects.
 * @param generaByName - Name-to-canonical-genus lookup.
 * @param cladeNames - Reportable clade names to additionally match.
 * @param allCladeNames - Full tree-clade set, used only as corroboration.
 * @param seen - Dedup keys already reported in prior runs.
 * @param options - Resolved run options (for the guard toggle).
 * @returns The deduplicated hits and the counts filtered by the homonym
 *     guard and the registry-source guard.
 */
function matchWorks(
    works: Array<Record<string, unknown>>,
    generaByName: Map<string, string>,
    cladeNames: Set<string>,
    allCladeNames: Set<string>,
    seen: Set<string>,
    options: Options,
): { hits: Array<WatchHit>; droppedByGuard: number; droppedAsRegistry: number }
{
    const genusMatcher = compileNameMatcher([...generaByName.keys()]);
    const cladeMatcher = compileNameMatcher([...allCladeNames]);

    const candidates: Array<WatchHit> = [];
    let droppedByGuard = 0;
    let droppedAsRegistry = 0;

    for (const work of works)
    {
        const doi = typeof work.doi === "string" ? work.doi.replace(/^https?:\/\/doi\.org\//, "") : null;
        const openAlexId = String(work.id ?? "").replace("https://openalex.org/", "");
        const dedupKey = doi ? normalizeDoi(doi) : openAlexId;

        if (!dedupKey || seen.has(dedupKey))
        {
            continue;
        }

        const rawTitle = typeof work.title === "string" ? work.title : "";
        const abstract = reconstructAbstract(
            work.abstract_inverted_index as Record<string, Array<number>> | null | undefined,
        );
        const text = `${rawTitle} ${abstract}`;

        const surfaceMatches = new Map<string, string>();

        if (genusMatcher)
        {
            for (const match of text.matchAll(genusMatcher))
            {
                surfaceMatches.set(match[1], generaByName.get(match[1]) ?? match[1]);
            }
        }

        // Tree-clade matches, computed at most once per work and only when
        // needed: to report maintained clades (with --clades) and as homonym
        // corroboration. The lazy getter keeps the clade scan off the common
        // path where a longer genus name already provides context.
        let cladeMatches: Set<string> | null = null;

        const getCladeMatches = (): Set<string> =>
        {
            if (cladeMatches === null)
            {
                cladeMatches = new Set<string>();

                if (cladeMatcher)
                {
                    for (const match of text.matchAll(cladeMatcher))
                    {
                        cladeMatches.add(match[1]);
                    }
                }
            }

            return cladeMatches;
        };

        const reportedClades = options.includeClades
            ? [...getCladeMatches()].filter((name) => cladeNames.has(name))
            : [];

        if (surfaceMatches.size === 0 && reportedClades.length === 0)
        {
            continue;
        }

        const hasLongGenus = [...surfaceMatches.keys()].some((name) => name.length > shortNameThreshold);
        const hasContext = options.allShort
            || hasLongGenus
            || /dinosaur/i.test(text)
            || getCladeMatches().size > 0;

        const matchedGenera = hasContext ? new Set(surfaceMatches.values()) : new Set<string>();

        if (matchedGenera.size === 0 && reportedClades.length === 0)
        {
            droppedByGuard++;
            continue;
        }

        const location = work.primary_location as { source?: { display_name?: string } } | null;
        const sourceName = (location?.source?.display_name ?? "").toLowerCase();

        if (registrySources.some((name) => sourceName.includes(name)))
        {
            droppedAsRegistry++;
            continue;
        }

        const openAccess = work.open_access as { is_oa?: boolean } | null;

        candidates.push({
            doi,
            openAlexId,
            title: stripTags(rawTitle),
            publicationDate: typeof work.publication_date === "string" ? work.publication_date : "",
            venue: location?.source?.display_name ?? null,
            isOpenAccess: openAccess?.is_oa === true,
            isDeposit: depositSources.some((name) => sourceName.includes(name)),
            genera: [...matchedGenera].sort(),
            clades: reportedClades.sort(),
        });
    }

    const hits = dedupHits(candidates);
    hits.sort((first, second) => second.publicationDate.localeCompare(first.publicationDate));

    return { hits, droppedByGuard, droppedAsRegistry };
}

/**
 * Renders one hit as a markdown checklist item: title, the venue in bold on
 * its own line (for at-a-glance access triage), then the link with an
 * open-access lock when a free version exists.
 *
 * @param hit - The hit to render.
 * @returns The markdown for the item.
 */
function formatHit(hit: WatchHit): string
{
    const link = hit.doi ? `https://doi.org/${hit.doi}` : `https://openalex.org/${hit.openAlexId}`;
    const venueLine = hit.venue ? `\n  **${hit.venue}**` : "";
    const access = hit.isOpenAccess ? " 🔓" : "";
    const note = hit.isDeposit ? "\n  _Note: self-published / deposited_" : "";

    return `- [ ] ${hit.publicationDate} — ${hit.title}${venueLine}\n  ${link}${access}${note}`;
}

/**
 * Renders the hits as a markdown digest grouped by the exact set of genera a
 * paper mentions, so a multi-genus paper appears once under a combined
 * "Genus A, Genus B" heading rather than repeated under each genus.
 *
 * @param hits - The fresh hits to render.
 * @param options - Resolved run options (for the header window).
 * @returns The markdown digest.
 */
function renderDigest(hits: Array<WatchHit>, options: Options): string
{
    const byGenusSet = new Map<string, Array<WatchHit>>();
    const cladeOnly: Array<WatchHit> = [];

    for (const hit of hits)
    {
        if (hit.genera.length === 0)
        {
            cladeOnly.push(hit);
        }
        else
        {
            const key = hit.genera.join(", ");

            if (!byGenusSet.has(key))
            {
                byGenusSet.set(key, []);
            }

            byGenusSet.get(key)!.push(hit);
        }
    }

    const distinctGenera = new Set(hits.flatMap((hit) => hit.genera)).size;
    const lines: Array<string> = [
        "# Paper watch",
        "",
        `Window: works published since **${options.since}** · `
            + `${hits.length} new work(s) across ${distinctGenera} genus/genera.`,
        "",
    ];

    for (const key of [...byGenusSet.keys()].sort())
    {
        lines.push(`## ${key}`, "");

        for (const hit of byGenusSet.get(key)!)
        {
            lines.push(formatHit(hit));
        }

        lines.push("");
    }

    if (options.includeClades && cladeOnly.length > 0)
    {
        lines.push("## Clade-only matches", "");

        for (const hit of cladeOnly)
        {
            lines.push(`${formatHit(hit)}\n  clades: ${hit.clades.join(", ")}`);
        }

        lines.push("");
    }

    return lines.join("\n");
}

/**
 * Entry point: builds the name index, fetches recent works, matches them,
 * writes the digest, and (optionally) persists state.
 *
 * @returns A promise that resolves when the run completes.
 */
async function main(): Promise<void>
{
    const state = loadState();
    const options = parseOptions(process.argv.slice(2), state);
    const { generaByName, cladeNames, allCladeNames, genusCount } = buildNameIndex(options.includeClades);

    console.log(
        `Paper watch: ${genusCount} genera`
        + `${options.includeClades ? ` + ${cladeNames.size} clades` : ""}, `
        + `since ${options.since} (concept ${options.conceptId}).`,
    );

    const works = await fetchRecentWorks(options);
    const seen = new Set(state.seen);
    const { hits, droppedByGuard, droppedAsRegistry } = matchWorks(
        works, generaByName, cladeNames, allCladeNames, seen, options,
    );

    const filterNotes = [
        droppedByGuard > 0 ? `${droppedByGuard} short-name homonym` : null,
        droppedAsRegistry > 0 ? `${droppedAsRegistry} registry-stub` : null,
    ].filter(Boolean);

    console.log(
        `Scanned ${works.length} paleontology works; ${hits.length} new taxon match(es)`
        + `${filterNotes.length > 0 ? ` (${filterNotes.join(", ")} match(es) filtered)` : ""}.\n`,
    );

    const byGenus = new Map<string, number>();

    for (const hit of hits)
    {
        const label = hit.genera.length > 0 ? hit.genera.join(", ") : `(clades) ${hit.clades.join(", ")}`;
        const link = hit.doi ? `doi:${hit.doi}` : hit.openAlexId;

        console.log(`  ${hit.publicationDate}  ${label}`);
        console.log(`            ${hit.title}`);
        console.log(`            ${link}`);

        for (const genus of hit.genera)
        {
            byGenus.set(genus, (byGenus.get(genus) ?? 0) + 1);
        }
    }

    fs.mkdirSync(path.dirname(digestPath), { recursive: true });
    fs.writeFileSync(digestPath, renderDigest(hits, options));
    console.log(`\nDigest written to ${path.relative(root, digestPath)}.`);

    if (options.jsonPath)
    {
        fs.writeFileSync(options.jsonPath, JSON.stringify(hits, null, 2));
        console.log(`JSON written to ${options.jsonPath}.`);
    }

    if (options.writeState)
    {
        for (const hit of hits)
        {
            seen.add(dedupKeyFor(hit));
        }

        const updated: WatchState = {
            lastRun: new Date().toISOString().slice(0, 10),
            seen: [...seen],
        };

        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, JSON.stringify(updated, null, 2));
        console.log(`State updated (${updated.seen.length} works seen).`);
    }
    else
    {
        console.log("Dry run — state not updated (pass --write-state to persist).");
    }
}

main().catch((error) =>
{
    console.error(error);
    process.exit(1);
});
