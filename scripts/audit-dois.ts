import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import type { Reference } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const referencesDir = path.join(root, "references");
const reportPath = path.join(root, "scratch", "doi-audit.md");
const cachePath = path.join(root, "scratch", "doi-audit-cache.json");

const contactEmail = "sarah@bot2k3.net";
const userAgent = `open-paleo-data DOI audit (mailto:${contactEmail})`;
const requestDelayMs = 1100;

/**
 * Similarity at or above this counts the stored title and the DOI's title as
 * the same paper; below it the DOI is treated as pointing at a different work.
 */
const matchThreshold = 0.6;

/**
 * Outcome bucket for a single audited DOI.
 *
 * - `ok`: DOI resolves and its title matches the stored title.
 * - `mismatch`: DOI resolves to a title for a different paper.
 * - `dead`: DOI does not resolve at all (doi.org returns 404).
 * - `opaque`: DOI resolves but the registrar serves no citeproc metadata, so
 *   the title cannot be compared. The DOI is valid; this is informational.
 */
type AuditStatus = "ok" | "mismatch" | "dead" | "opaque";

/**
 * A candidate replacement DOI surfaced from a Crossref bibliographic search.
 */
type Suggestion = {
    /**
     * The candidate DOI string.
     */
    doi: string;

    /**
     * The candidate's title as returned by Crossref.
     */
    title: string;

    /**
     * Similarity of the candidate's title to the stored title, 0-1.
     */
    score: number;
};

/**
 * The full audit record for one reference file that carries a DOI.
 */
type AuditRecord = {
    /**
     * Reference key (store filename basename).
     */
    id: string;

    /**
     * The DOI as stored in the reference file.
     */
    doi: string;

    /**
     * Title as stored in the reference file.
     */
    storedTitle: string;

    /**
     * Title the DOI actually resolves to, or null when it does not resolve.
     */
    resolvedTitle: string | null;

    /**
     * Title similarity between stored and resolved, 0-1 (0 when unresolved).
     */
    score: number;

    /**
     * Outcome bucket.
     */
    status: AuditStatus;

    /**
     * Candidate correct DOIs, populated only for mismatch/dead records.
     */
    suggestions: Array<Suggestion>;
};

/**
 * On-disk cache shape: maps a DOI to the metadata a resolve produced, so
 * reruns skip the network for DOIs already seen.
 */
type CacheEntry = {
    /**
     * Title the DOI resolved to, or null when no citeproc title was returned.
     */
    resolvedTitle: string | null;

    /**
     * Whether doi.org resolves the DOI at all (registered). Present only when
     * no title was obtained and a fallback resolution check was run.
     */
    resolves?: boolean;
};

/**
 * Pauses execution for the given number of milliseconds.
 *
 * @param milliseconds - How long to sleep.
 * @returns A promise that resolves after the delay.
 */
function sleep(milliseconds: number): Promise<void>
{
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Normalizes a title for comparison: strips HTML markup, decodes a handful of
 * common entities, folds diacritics, lowercases, and reduces to single-spaced
 * alphanumeric tokens.
 *
 * @param title - The raw title string.
 * @returns The normalized comparison form.
 */
function normalizeTitle(title: string): string
{
    return title
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&[a-z]+;/gi, " ")
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/**
 * Builds the multiset of adjacent character bigrams for a normalized string.
 *
 * @param text - The normalized string (spaces removed internally).
 * @returns A map from bigram to its occurrence count.
 */
function bigramCounts(text: string): Map<string, number>
{
    const compact = text.replace(/ /g, "");
    const counts = new Map<string, number>();

    for (let index = 0; index < compact.length - 1; index += 1)
    {
        const bigram = compact.slice(index, index + 2);
        counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }

    return counts;
}

/**
 * Computes the Sørensen-Dice coefficient over character bigrams of two
 * already-normalized titles. Returns 1 for identical short strings that have
 * no bigrams (e.g. a single character), and 0 when either side is empty.
 *
 * @param first - First normalized title.
 * @param second - Second normalized title.
 * @returns Similarity in the range 0-1.
 */
function titleSimilarity(first: string, second: string): number
{
    if (first.length === 0 || second.length === 0)
    {
        return 0;
    }

    if (first === second)
    {
        return 1;
    }

    const firstBigrams = bigramCounts(first);
    const secondBigrams = bigramCounts(second);
    let firstTotal = 0;

    for (const count of firstBigrams.values())
    {
        firstTotal += count;
    }

    let secondTotal = 0;

    for (const count of secondBigrams.values())
    {
        secondTotal += count;
    }

    if (firstTotal === 0 || secondTotal === 0)
    {
        return 0;
    }

    let overlap = 0;

    for (const [bigram, count] of firstBigrams)
    {
        const other = secondBigrams.get(bigram);

        if (other !== undefined)
        {
            overlap += Math.min(count, other);
        }
    }

    return (2 * overlap) / (firstTotal + secondTotal);
}

/**
 * Extracts the first author's surname from a stored `authors` string, used to
 * narrow Crossref bibliographic searches.
 *
 * @param authors - The stored authors string, or undefined.
 * @returns The first surname, or an empty string when unavailable.
 */
function firstAuthorSurname(authors: string | undefined): string
{
    if (authors === undefined || authors.trim().length === 0)
    {
        return "";
    }

    const firstEntry = authors.split(";")[0].trim();
    return firstEntry.split(",")[0].trim();
}

/**
 * Resolves a DOI through the doi.org content-negotiation API and returns the
 * work's title, or null when the DOI does not resolve to citeproc metadata.
 *
 * @param doi - The DOI string.
 * @returns The resolved title, or null.
 */
async function resolveDoiTitle(doi: string): Promise<string | null>
{
    try
    {
        const response = await fetch(
            `https://doi.org/${encodeURIComponent(doi)}`,
            {
                headers: { "Accept": "application/citeproc+json", "User-Agent": userAgent },
                redirect: "follow",
            },
        );

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json() as { title?: string | Array<string> };

        if (data.title === undefined)
        {
            return null;
        }

        return Array.isArray(data.title) ? data.title[0] : String(data.title);
    }
    catch
    {
        return null;
    }
}

/**
 * Checks whether doi.org resolves a DOI at all, independent of whether the
 * registrar serves citeproc metadata. A registered DOI redirects (3xx); an
 * unregistered one returns 404. Used to tell a genuinely broken DOI from one
 * that merely lacks machine-readable metadata.
 *
 * @param doi - The DOI string.
 * @returns True when doi.org resolves the DOI, false on 404 or network error.
 */
async function doiResolves(doi: string): Promise<boolean>
{
    try
    {
        const response = await fetch(
            `https://doi.org/${encodeURIComponent(doi)}`,
            { method: "HEAD", redirect: "manual", headers: { "User-Agent": userAgent } },
        );

        return response.status !== 404;
    }
    catch
    {
        return false;
    }
}

/**
 * Queries Crossref for works matching the stored title (and first author) and
 * returns the top candidates ranked by title similarity to the stored title.
 *
 * @param storedTitle - The stored (raw) title to search for.
 * @param authorSurname - First author surname to narrow the search, or empty.
 * @returns Up to three candidate suggestions, best first.
 */
async function findCandidateDois(storedTitle: string, authorSurname: string): Promise<Array<Suggestion>>
{
    const params = new URLSearchParams({
        "query.bibliographic": storedTitle,
        rows: "5",
        mailto: contactEmail,
    });

    if (authorSurname.length > 0)
    {
        params.set("query.author", authorSurname);
    }

    try
    {
        const response = await fetch(
            `https://api.crossref.org/works?${params.toString()}`,
            { headers: { "User-Agent": userAgent } },
        );

        if (!response.ok)
        {
            return [];
        }

        const data = await response.json() as {
            message?: { items?: Array<{ DOI?: string; title?: Array<string> }> };
        };

        const items = data.message?.items ?? [];
        const normalizedStored = normalizeTitle(storedTitle);
        const suggestions = new Array<Suggestion>();

        for (const item of items)
        {
            const candidateTitle = item.title?.[0];

            if (item.DOI === undefined || candidateTitle === undefined)
            {
                continue;
            }

            suggestions.push({
                doi: item.DOI,
                title: candidateTitle,
                score: titleSimilarity(normalizedStored, normalizeTitle(candidateTitle)),
            });
        }

        suggestions.sort((first, second) => second.score - first.score);
        return suggestions.slice(0, 3);
    }
    catch
    {
        return [];
    }
}

/**
 * Loads the resolve cache from disk, returning an empty map when absent or
 * unreadable.
 *
 * @returns A map from DOI to its cached resolve result.
 */
function loadCache(): Record<string, CacheEntry>
{
    if (!fs.existsSync(cachePath))
    {
        return {};
    }

    try
    {
        return JSON.parse(fs.readFileSync(cachePath, "utf8")) as Record<string, CacheEntry>;
    }
    catch
    {
        return {};
    }
}

/**
 * Parses recognized command-line flags.
 *
 * @param argv - Raw process arguments (from index 2 onward).
 * @returns The parsed options.
 */
function parseArguments(argv: Array<string>): { limit: number | null; refresh: boolean; retryDead: boolean }
{
    let limit: number | null = null;
    let refresh = false;
    let retryDead = false;

    for (let index = 0; index < argv.length; index += 1)
    {
        const argument = argv[index];

        if (argument === "--limit")
        {
            const next = argv[index + 1];
            limit = next === undefined ? null : Number.parseInt(next, 10);
            index += 1;
        }
        else if (argument === "--refresh")
        {
            refresh = true;
        }
        else if (argument === "--retry-dead")
        {
            retryDead = true;
        }
    }

    return { limit, refresh, retryDead };
}

/**
 * Escapes pipe and newline characters so a value renders inside a single
 * Markdown table cell.
 *
 * @param value - The raw cell value.
 * @returns The escaped value.
 */
function escapeCell(value: string): string
{
    return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Renders the audit records to a Markdown report string.
 *
 * @param records - All audited records.
 * @param auditedCount - Number of DOIs actually resolved this run.
 * @param duplicates - DOIs shared by more than one reference key.
 * @returns The report body.
 */
function renderReport(records: Array<AuditRecord>, auditedCount: number, duplicates: Array<{ doi: string; ids: Array<string> }>): string
{
    const mismatches = records.filter((record) => record.status === "mismatch");
    const dead = records.filter((record) => record.status === "dead");
    const opaque = records.filter((record) => record.status === "opaque");
    const okCount = records.length - mismatches.length - dead.length - opaque.length;
    const lines = new Array<string>();

    lines.push("# DOI audit");
    lines.push("");
    lines.push("Generated by `npm run audit-dois`. Not checked in.");
    lines.push("");
    lines.push("Each reference DOI is resolved through doi.org content negotiation and its");
    lines.push("returned title compared to the stored title (Sørensen-Dice over character");
    lines.push(`bigrams; match threshold ${matchThreshold}). Suggested DOIs come from a Crossref`);
    lines.push("bibliographic search on the stored title and are unverified — pick by hand.");
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- DOIs checked this run: ${auditedCount}`);
    lines.push(`- Total DOIs in store: ${records.length}`);
    lines.push(`- **OK**: ${okCount}`);
    lines.push(`- **Mismatch** (DOI resolves to a different title): ${mismatches.length}`);
    lines.push(`- **Dead** (DOI does not resolve — 404): ${dead.length}`);
    lines.push(`- **Opaque** (DOI resolves but serves no title metadata — informational, likely fine): ${opaque.length}`);
    lines.push(`- **Duplicate DOIs** (same DOI on multiple keys): ${duplicates.length}`);

    lines.push("");
    lines.push(`## Duplicate DOIs (${duplicates.length})`);

    if (duplicates.length === 0)
    {
        lines.push("");
        lines.push("_none_");
    }
    else
    {
        lines.push("");

        for (const duplicate of duplicates)
        {
            lines.push(`- \`${duplicate.doi}\` — ${duplicate.ids.join(", ")}`);
        }
    }

    for (const [heading, group] of [["Mismatches", mismatches], ["Dead DOIs", dead]] as Array<[string, Array<AuditRecord>]>)
    {
        lines.push("");
        lines.push(`## ${heading} (${group.length})`);

        if (group.length === 0)
        {
            lines.push("");
            lines.push("_none_");
            continue;
        }

        for (const record of group)
        {
            lines.push("");
            lines.push(`### ${record.id}`);
            lines.push("");
            lines.push(`- Stored DOI: \`${record.doi}\``);
            lines.push(`- Stored title: ${escapeCell(record.storedTitle)}`);
            lines.push(`- DOI resolves to: ${record.resolvedTitle === null ? "_(unresolved)_" : escapeCell(record.resolvedTitle)}`);
            lines.push(`- Similarity: ${record.score.toFixed(2)}`);

            if (record.suggestions.length > 0)
            {
                lines.push("- Candidate DOIs (Crossref, by title similarity):");

                for (const suggestion of record.suggestions)
                {
                    lines.push(`  - \`${suggestion.doi}\` (${suggestion.score.toFixed(2)}) — ${escapeCell(suggestion.title)}`);
                }
            }
            else
            {
                lines.push("- Candidate DOIs: _none found_");
            }
        }
    }

    lines.push("");
    lines.push(`## Opaque DOIs (${opaque.length})`);
    lines.push("");
    lines.push("These DOIs resolve but their registrar serves no citeproc title, so the");
    lines.push("stored title could not be verified. The DOIs are valid; listed for awareness.");
    lines.push("");

    if (opaque.length === 0)
    {
        lines.push("_none_");
    }
    else
    {
        lines.push(opaque.map((record) => record.id).join(", "));
    }

    lines.push("");
    return lines.join("\n") + "\n";
}

/**
 * Runs the DOI audit: loads references, resolves each DOI (honoring the cache),
 * classifies matches, gathers replacement candidates for the failures, and
 * writes the Markdown report plus the resolve cache.
 *
 * @returns A promise that resolves when the report is written.
 */
async function main(): Promise<void>
{
    const options = parseArguments(process.argv.slice(2));
    const parsedReferences = findYamlFiles(referencesDir).map((filePath) => parseYaml<Reference>(filePath));
    const withDoi = parsedReferences.filter((reference): reference is Reference & { doi: string; id: string } =>
        typeof reference.doi === "string"
        && reference.doi.length > 0
        && typeof reference.id === "string");

    const doiToIds = new Map<string, Array<string>>();

    for (const reference of withDoi)
    {
        const key = reference.doi.trim().toLowerCase();
        const existing = doiToIds.get(key);

        if (existing === undefined)
        {
            doiToIds.set(key, [reference.id]);
        }
        else
        {
            existing.push(reference.id);
        }
    }

    const duplicates = new Array<{ doi: string; ids: Array<string> }>();

    for (const [doi, ids] of doiToIds)
    {
        if (ids.length > 1)
        {
            duplicates.push({ doi, ids: ids.sort((first, second) => first.localeCompare(second)) });
        }
    }

    duplicates.sort((first, second) => first.ids[0].localeCompare(second.ids[0]));

    const references = withDoi
        .filter((reference): reference is Reference & { doi: string; id: string; title: string } =>
            typeof reference.title === "string")
        .sort((first, second) => first.id.localeCompare(second.id));

    const scope = options.limit === null ? references : references.slice(0, options.limit);
    const cache = loadCache();
    const records = new Array<AuditRecord>();
    let auditedCount = 0;

    for (let index = 0; index < scope.length; index += 1)
    {
        const reference = scope[index];
        const cached = cache[reference.doi];
        const shouldReuse = cached !== undefined
            && !options.refresh
            && !(options.retryDead && cached.resolvedTitle === null);
        let resolvedTitle: string | null;

        if (shouldReuse)
        {
            resolvedTitle = cached.resolvedTitle;
        }
        else
        {
            resolvedTitle = await resolveDoiTitle(reference.doi);
            cache[reference.doi] = { resolvedTitle };
            auditedCount += 1;
            console.log(`[${index + 1}/${scope.length}] ${reference.id} → ${resolvedTitle === null ? "UNRESOLVED" : "resolved"}`);
            await sleep(requestDelayMs);
        }

        const score = resolvedTitle === null
            ? 0
            : titleSimilarity(normalizeTitle(reference.title), normalizeTitle(resolvedTitle));
        let status: AuditStatus;

        if (resolvedTitle !== null)
        {
            status = score >= matchThreshold ? "ok" : "mismatch";
        }
        else
        {
            const cachedResolves = shouldReuse ? cache[reference.doi].resolves : undefined;
            let resolves: boolean;

            if (cachedResolves !== undefined)
            {
                resolves = cachedResolves;
            }
            else
            {
                resolves = await doiResolves(reference.doi);
                cache[reference.doi] = { resolvedTitle: null, resolves };
                await sleep(requestDelayMs);
            }

            status = resolves ? "opaque" : "dead";
        }

        let suggestions = new Array<Suggestion>();

        if (status === "mismatch" || status === "dead")
        {
            suggestions = await findCandidateDois(reference.title, firstAuthorSurname(reference.authors));
            await sleep(requestDelayMs);
        }

        records.push({
            id: reference.id,
            doi: reference.doi,
            storedTitle: reference.title,
            resolvedTitle,
            score,
            status,
            suggestions,
        });
    }

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");
    fs.writeFileSync(reportPath, renderReport(records, auditedCount, duplicates));

    const mismatches = records.filter((record) => record.status === "mismatch").length;
    const dead = records.filter((record) => record.status === "dead").length;
    console.log(`\nWrote ${path.relative(root, reportPath)}: ${records.length} DOIs, ${mismatches} mismatches, ${dead} dead, ${duplicates.length} duplicate DOIs.`);
}

await main();
