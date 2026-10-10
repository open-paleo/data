import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYamlContent, stringify as stringifyYaml } from "yaml";
import type { FlaggedSignoffs, FlaggedSources, InstitutionEntry, Reference, StageInfo, TreeNode } from "./types.ts";

/**
 * Escapes a string for safe inclusion as a literal in a regular expression.
 *
 * @param value - The literal string to escape.
 * @returns The escaped string.
 */
export function escapeRegExp(value: string): string
{
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Latin letters with no canonical NFD decomposition to a base ASCII letter.
 * Folding them keeps every reference key inside the 26 `a`–`z` buckets instead
 * of spawning a stray directory for a Polish `ł`, Nordic `ø`, or similar.
 */
const nonDecomposingLetterFolds: Record<string, string> = {
    "ł": "l", "ø": "o", "đ": "d", "ð": "d", "þ": "t", "ß": "s",
    "ı": "i", "ħ": "h", "ĸ": "k", "ŋ": "n", "œ": "o", "æ": "a",
};

/**
 * Returns the store directory bucket for a reference key: the folded, lowercase
 * first character. Diacritics are stripped via NFD (so `ősi2010a` buckets to
 * `o`) and the non-decomposing Latin letters above fold to their base letter,
 * so every key lands in one of the 26 `a`–`z` buckets — mirroring the
 * `genera/<Letter>/` layout. Anything that still does not fold to `a`–`z`
 * (e.g. a non-Latin script) falls back to `_`, keeping the mapping total and
 * deterministic.
 *
 * @param key - The reference key (e.g. "royo-torres2006a", "ősi2010a").
 * @returns The single-character bucket name.
 */
export function referenceBucket(key: string): string
{
    const first = key.normalize("NFD").replace(/[̀-ͯ]/g, "")[0]?.toLowerCase() ?? "";
    const folded = nonDecomposingLetterFolds[first] ?? first;

    return /^[a-z]$/.test(folded) ? folded : "_";
}

/**
 * Canonical field order for a store reference file, `id` first.
 */
const referenceFieldOrder: Array<keyof Reference> = [
    "id", "authors", "year", "title", "journal", "book", "series",
    "thesis", "school", "publisher", "volume", "issue", "pages", "article_number", "doi",
    "isbn", "url",
];

/**
 * Writes a reference to the store at `references/<bucket>/<id>.yml` with the
 * canonical field order, creating the bucket directory as needed. Existing
 * store files are left untouched — the store is the single source of truth, so
 * a re-run never clobbers a curated entry. `notes` is never written (it is
 * per-citation and lives on the in-file pointer). Returns whether a new file
 * was created.
 *
 * @param dataRoot - Repository root containing the `references/` directory.
 * @param entry - The reference record; must carry an `id`.
 * @returns True when a new store file was written, false when it already existed.
 */
export function writeStoreReference(dataRoot: string, entry: Reference): boolean
{
    if (!entry.id)
    {
        throw new Error("writeStoreReference: entry is missing an id");
    }

    const filePath = path.join(dataRoot, "references", referenceBucket(entry.id), `${entry.id}.yml`);

    if (fs.existsSync(filePath))
    {
        return false;
    }

    const ordered: Record<string, unknown> = {};

    for (const field of referenceFieldOrder)
    {
        if (entry[field] !== undefined && entry[field] !== null && entry[field] !== "")
        {
            ordered[field] = entry[field];
        }
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, stringifyYaml(ordered, { lineWidth: 80 }));

    return true;
}

/**
 * Parses a YAML file and returns the result cast to the specified type.
 *
 * @param filePath - Absolute path to the YAML file.
 * @returns The parsed YAML content cast to type T.
 */
export function parseYaml<T>(filePath: string): T
{
    return parseYamlContent(fs.readFileSync(filePath, "utf8")) as T;
}

/**
 * Recursively finds all YAML files in a directory tree.
 *
 * @param dir - The root directory to search.
 * @returns An array of absolute paths to .yml/.yaml files.
 */
export function findYamlFiles(dir: string): Array<string>
{
    const results = new Array<string>();

    if (!fs.existsSync(dir))
    {
        return results;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true }))
    {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory())
        {
            results.push(...findYamlFiles(full));
        }
        else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))
        {
            results.push(full);
        }
    }

    return results;
}

/**
 * Loads the institution registry from institutions.yaml.
 *
 * @param registryPath - Absolute path to institutions.yaml.
 * @returns A record of canonical abbreviation keys to institution entries.
 */
export function loadInstitutionRegistry(registryPath: string): Record<string, InstitutionEntry>
{
    return parseYamlContent(
        fs.readFileSync(registryPath, "utf8"),
    ) as Record<string, InstitutionEntry>;
}

/**
 * Loads the region registry from regions.yaml.
 *
 * @param registryPath - Absolute path to regions.yaml.
 * @returns A record of ISO 3166-2 subdivision codes to English names.
 */
export function loadRegionRegistry(registryPath: string): Record<string, string>
{
    return parseYamlContent(
        fs.readFileSync(registryPath, "utf8"),
    ) as Record<string, string>;
}

/**
 * Loads the chronostratigraphic stage table from schema.yml.
 *
 * @param schemaPath - Absolute path to schema.yml.
 * @returns A record of stage name to its period and boundary ages.
 */
export function loadStageTable(schemaPath: string): Record<string, StageInfo>
{
    const vocabulary = parseYamlContent(
        fs.readFileSync(schemaPath, "utf8"),
    ) as { stages?: Record<string, StageInfo> };

    return vocabulary.stages ?? { };
}

/**
 * Loads the flagged-sources registry from flagged-sources.yml.
 *
 * @param sourcesPath - Absolute path to flagged-sources.yml.
 * @returns The parsed structure, or an empty object if the file is absent.
 */
export function loadFlaggedSources(sourcesPath: string): FlaggedSources
{
    if (!fs.existsSync(sourcesPath))
    {
        return {};
    }

    return parseYamlContent(fs.readFileSync(sourcesPath, "utf8")) as FlaggedSources;
}

/**
 * Builds a case-insensitive lookup set of flagged publisher (or journal)
 * names from a FlaggedSources document. Every `beall` entry and every
 * `open_paleo_additions` name is included; matching should be done against
 * the trimmed, lowercased input.
 *
 * @param group - Either `flagged.publishers` or `flagged.journals`.
 * @returns A Set of normalized names for O(1) membership checks.
 */
export function buildFlaggedSet(group: FlaggedSources["publishers"] | FlaggedSources["journals"]): Set<string>
{
    const result = new Set<string>();

    for (const entry of group?.beall ?? [])
    {
        result.add(entry.trim().toLowerCase());
    }

    for (const addition of group?.open_paleo_additions ?? [])
    {
        result.add(addition.name.trim().toLowerCase());
    }

    return result;
}

/**
 * Loads the flagged-source sign-off registry (flagged-signoffs.yml), a map of
 * reference id to its verification record. Returns an empty map when the file
 * is absent.
 *
 * @param signoffsPath - Absolute path to flagged-signoffs.yml.
 * @returns The parsed sign-off map.
 */
export function loadFlaggedSignoffs(signoffsPath: string): FlaggedSignoffs
{
    if (!fs.existsSync(signoffsPath))
    {
        return {};
    }

    return (parseYamlContent(fs.readFileSync(signoffsPath, "utf8")) as FlaggedSignoffs) ?? {};
}

/**
 * Builds the set of reference ids that carry a verified flagged-source
 * sign-off; membership suppresses that reference's flagged-source warning.
 *
 * @param signoffs - The sign-off map from loadFlaggedSignoffs.
 * @returns A Set of verified reference ids for O(1) membership checks.
 */
export function buildVerifiedSet(signoffs: FlaggedSignoffs): Set<string>
{
    const result = new Set<string>();

    for (const [referenceId, signoff] of Object.entries(signoffs))
    {
        if (signoff?.verified)
        {
            result.add(referenceId);
        }
    }

    return result;
}

/**
 * Recursively collects all clade names from a tree node.
 *
 * @param node - The tree node to traverse.
 * @returns A flat array of all clade names in the tree.
 */
export function collectAllKeys(node: TreeNode): Array<string>
{
    const keys = new Array<string>();

    for (const [key, children] of Object.entries(node))
    {
        keys.push(key);

        if (children && typeof children === "object" && Object.keys(children).length > 0)
        {
            keys.push(...collectAllKeys(children as TreeNode));
        }
    }

    return keys;
}

/**
 * Reads `dist/references.bib` and returns the set of citation keys
 * present (e.g. `osmolska1996`, `funston2020a`, `funston2020b`).
 * Returns an empty set when the file is missing.
 *
 * @param bibPath - Absolute path to references.bib.
 * @returns Set of citation keys.
 */
export function readBibCitationKeys(bibPath: string): Set<string>
{
    const keys = new Set<string>();

    if (!fs.existsSync(bibPath))
    {
        return keys;
    }

    const content = fs.readFileSync(bibPath, "utf8");

    for (const match of content.matchAll(/^@\w+\{([^,]+),/gm))
    {
        keys.add(match[1].trim());
    }

    return keys;
}

/**
 * Reads every citation key held in the reference store
 * (`references/<bucket>/<key>.yml`). The store is the committed source of
 * truth for bibliographic data, so it is authoritative where `dist/references.bib`
 * — a build output that can lag the working tree — is not.
 *
 * @param dataRoot - Repository root containing the `references/` directory.
 * @returns The set of store citation keys.
 */
export function readStoreCitationKeys(dataRoot: string): Set<string>
{
    const keys = new Set<string>();
    const storeDir = path.join(dataRoot, "references");

    if (!fs.existsSync(storeDir))
    {
        return keys;
    }

    for (const bucket of fs.readdirSync(storeDir))
    {
        const bucketDir = path.join(storeDir, bucket);

        if (!fs.statSync(bucketDir).isDirectory())
        {
            continue;
        }

        for (const file of fs.readdirSync(bucketDir))
        {
            if (file.endsWith(".yml"))
            {
                keys.add(file.slice(0, -4));
            }
        }
    }

    return keys;
}

/**
 * Normalizes a DOI for comparison: lower-cased, with any resolver prefix
 * (`https://doi.org/`, `doi:`) stripped. DOIs are case-insensitive, and the
 * same DOI reaches us in all three forms depending on the source.
 *
 * @param doi - The raw DOI string.
 * @returns The comparable form.
 */
function normalizeDoi(doi: string): string
{
    return doi
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
        .replace(/^doi:\s*/, "");
}

/**
 * Finds the store key of an existing `<base><letter>` reference whose DOI
 * matches the one given. Minting a fresh suffix for a DOI the store already
 * holds files the same paper twice under two keys, which reads downstream as
 * two independent sources (#2070 §1.2).
 *
 * @param dataRoot - Repository root containing the `references/` directory.
 * @param baseKey - The bare `<author><year>` key, without a suffix letter.
 * @param doi - The DOI of the paper being filed.
 * @returns The matching store key, or null when the DOI is new to the store.
 */
export function findStoreKeyByDoi(
    dataRoot: string,
    baseKey: string,
    doi: string,
): string | null
{
    const bucketDir = path.join(dataRoot, "references", referenceBucket(baseKey));

    if (!fs.existsSync(bucketDir))
    {
        return null;
    }

    const variantPattern = new RegExp(`^${escapeRegExp(baseKey)}[a-z]\\.yml$`);
    const wanted = normalizeDoi(doi);

    for (const file of fs.readdirSync(bucketDir).sort())
    {
        if (!variantPattern.test(file))
        {
            continue;
        }

        const entry = parseYaml<Reference>(path.join(bucketDir, file));

        if (entry?.doi && normalizeDoi(entry.doi) === wanted)
        {
            return file.slice(0, -4);
        }
    }

    return null;
}

/**
 * Collects what each paper said about the taxon's validity and writes it to
 * `status-evidence.md`, echoing it to stdout.
 *
 * `status` is never written into the YAML from an extraction. Which of valid /
 * disputed / nomen dubium a taxon carries is an editorial judgment the operator
 * makes at the apply gate across all the papers at once, so the agents supply
 * the evidence — verbatim, because a paper can adopt a synonymy "for working
 * purposes" while calling the question open, and a paraphrase loses exactly
 * that (#2070 §2.1, §2.9).
 *
 * @param targetDir - The staging directory for this intake.
 * @param extractions - Every extraction applied in this run.
 */
export function writeStatusEvidence(
    targetDir: string,
    extractions: Array<{
        citation_key: string;
        is_describing: boolean;
        status_assessment?: string | null;
        status_quote?: string | null;
    }>,
): void
{
    const stated = extractions.filter(
        (extraction) => extraction.status_assessment
            && extraction.status_assessment !== "not stated",
    );

    if (stated.length === 0)
    {
        return;
    }

    const lines = ["# Status evidence", ""];
    lines.push("No paper's verdict is written into the YAML. Settle `status` here,");
    lines.push("across all of them, before promoting.");
    lines.push("");

    for (const extraction of stated)
    {
        const role = extraction.is_describing ? "describing" : "supplementary";
        lines.push(`## ${extraction.citation_key} (${role})`);
        lines.push("");
        lines.push(`Reads as: ${extraction.status_assessment}`);
        lines.push("");
        lines.push(extraction.status_quote
            ? `> ${extraction.status_quote}`
            : "(no verbatim quote supplied — re-read the paper before relying on this)");
        lines.push("");
    }

    const evidencePath = path.join(targetDir, "status-evidence.md");
    fs.writeFileSync(evidencePath, lines.join("\n"), "utf8");

    process.stdout.write(`\nStatus evidence from ${stated.length} paper`
        + `${stated.length === 1 ? "" : "s"} (${evidencePath}):\n`);

    for (const extraction of stated)
    {
        process.stdout.write(`  ${extraction.citation_key}: ${extraction.status_assessment}\n`);
    }
}

/**
 * Character budget for a per-citation `notes` string on a reference pointer.
 * The field records a paper's role in one line; prose belongs in `description`.
 * Shared so the intake apply steps warn on the same threshold validate.ts
 * enforces, instead of letting every genus reach the validator over budget.
 */
export const referenceNotesLimit = 200;

/**
 * Lists the `<base><letter>` entries the store already holds, with enough
 * bibliographic detail to recognise one. A DOI match settles a key outright,
 * but pre-DOI papers have no DOI to match on — for those the operator has to
 * eyeball the siblings, so the checklist prints them (#2070 §1.2).
 *
 * @param dataRoot - Repository root containing the `references/` directory.
 * @param baseKey - The bare `<author><year>` key, without a suffix letter.
 * @returns One entry per existing sibling, in key order.
 */
export function readStoreSiblings(
    dataRoot: string,
    baseKey: string,
): Array<{ id: string; title: string; doi: string | null }>
{
    const bucketDir = path.join(dataRoot, "references", referenceBucket(baseKey));

    if (!fs.existsSync(bucketDir))
    {
        return new Array<{ id: string; title: string; doi: string | null }>();
    }

    const variantPattern = new RegExp(`^${escapeRegExp(baseKey)}[a-z]\\.yml$`);

    return fs.readdirSync(bucketDir)
        .filter((file) => variantPattern.test(file))
        .sort()
        .map((file) =>
        {
            const entry = parseYaml<Reference>(path.join(bucketDir, file));

            return {
                id: file.slice(0, -4),
                title: entry?.title ?? "(no title in store)",
                doi: entry?.doi ?? null,
            };
        });
}

/**
 * Author-field tokens that PBDB and Crossref append to a surname but that never
 * form part of a store citation key. Multi-word surnames themselves are kept
 * whole and concatenated (`vanderreest`, `torcidafernández-baldor`), so only
 * these et-al markers and generational suffixes are dropped.
 */
const surnameNoiseTokens = new Set([
    "et", "al", "al.", "and", "others", "jr", "jr.", "sr", "sr.",
]);

/**
 * Synthesises a citation key from an author field and a year, following the
 * store convention: the complete surname concatenated without spaces and
 * lower-cased, keeping diacritics and hyphens (#1894). "van der Reest, A. J."
 * 2017 yields `vanderreest2017`; "Torcida Fernández-Baldor, F." 2017 yields
 * `torcidafernández-baldor2017`. The key is returned bare — pass it through
 * `resolveCitationKey` to get the disambiguation letter every store key carries.
 *
 * @param authors - The authors string (semicolon-separated entries; the surname
 *     is everything before the first comma of the first entry).
 * @param year - The publication year as a number or string.
 * @returns The lower-case bare citation key.
 */
export function citationKeyFor(authors: string, year: string | number): string
{
    const surnamePart = (authors ?? "").split(";")[0].split(",")[0].trim();

    const surname = surnamePart
        .split(/\s+/)
        .filter((token) => token !== "" && !surnameNoiseTokens.has(token.toLowerCase()))
        .join("");

    // Keep diacritics and hyphens per the reference-key convention (#1894):
    // "Ősi" -> "ősi", "Prieto-Márquez" -> "prieto-márquez". Only digits and
    // other punctuation are removed.
    return `${surname.toLowerCase().replace(/[^\p{L}-]/gu, "")}${year}`;
}

/**
 * Resolves a proposed citation key against the existing keys so that every key
 * carries a disambiguation letter. Mirrors the rule enforced by validate.ts
 * check #12c.
 *
 * Cases:
 *
 * - Proposed key is already known: no collision (the caller is
 *   reusing an existing reference). Returns the key unchanged.
 * - Proposed key ends with a single lowercase letter (e.g.
 *   `funston2020c`): treated as already disambiguated. Returns the
 *   key unchanged.
 * - Proposed key is bare (e.g. `funston2020`): resolves to
 *   `{base}{nextAvailableLetter}`. Suffixing is universal since #1946 —
 *   every one of the store's keys carries a letter — so a bare key is
 *   always a collision, whether or not sibling variants exist yet.
 *
 * @param proposedKey - The citation key the caller wants to use.
 * @param existingKeys - Set of citation keys already in use.
 * @returns Resolution result. When `collided` is true, the caller
 *     should use `resolvedKey` instead of `proposedKey`.
 */
export function resolveCitationKey(
    proposedKey: string,
    existingKeys: Set<string>,
): { resolvedKey: string; collided: boolean; reason: string | null }
{
    if (existingKeys.has(proposedKey))
    {
        return { resolvedKey: proposedKey, collided: false, reason: null };
    }

    const lastChar = proposedKey.slice(-1);

    if (/[a-z]/.test(lastChar))
    {
        return { resolvedKey: proposedKey, collided: false, reason: null };
    }

    const escaped = escapeRegExp(proposedKey);
    const variantPattern = new RegExp(`^${escaped}[a-z]$`);

    const existingVariants = [...existingKeys]
        .filter((key) => variantPattern.test(key))
        .sort();

    if (existingVariants.length === 0)
    {
        return {
            resolvedKey: `${proposedKey}a`,
            collided: true,
            reason: `bare "${proposedKey}" carries no disambiguation letter; `
                + "every store key is suffixed",
        };
    }

    const usedLetters = new Set(existingVariants.map((key) => key.slice(-1)));

    for (const letter of "abcdefghijklmnopqrstuvwxyz")
    {
        if (!usedLetters.has(letter))
        {
            return {
                resolvedKey: `${proposedKey}${letter}`,
                collided: true,
                reason: `the store has ${existingVariants.join(", ")}; bare "${proposedKey}" `
                    + "would conflict with the disambiguation rule",
            };
        }
    }

    throw new Error(
        `No available letter suffix for ${proposedKey}; all 26 are taken in the bib.`,
    );
}

/**
 * Data directories whose records may carry a research file at the mirrored
 * path under `research/`. Reference-store entries count: a note there explains
 * why the entry reads as it does.
 */
export const researchRecordDirectories = ["genera", "clades", "stratigraphy", "references"];

/**
 * Research directory for notes that span several records.
 */
export const researchTopicDirectory = "topics";

/**
 * Research file for the general rules that decide record values, which belong
 * to no single record or topic.
 */
export const researchMethodsFile = "methods.md";

/**
 * Recursively finds all Markdown files in a directory tree.
 *
 * @param dir - The root directory to search.
 * @returns An array of absolute paths to .md files.
 */
export function findMarkdownFiles(dir: string): Array<string>
{
    const results = new Array<string>();

    if (!fs.existsSync(dir))
    {
        return results;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true }))
    {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory())
        {
            results.push(...findMarkdownFiles(full));
        }
        else if (entry.name.endsWith(".md"))
        {
            results.push(full);
        }
    }

    return results;
}

/**
 * Returns the research file that mirrors a data record: the record's path with
 * `research/` in front and `.md` in place of `.yml`. The file need not exist.
 *
 * @param dataRoot - Repository root.
 * @param recordPath - Absolute path of a record under genera/, clades/ or stratigraphy/.
 * @returns The absolute path of the record's research file.
 */
export function researchFileFor(dataRoot: string, recordPath: string): string
{
    const relative = path.relative(dataRoot, recordPath).replace(/\.ya?ml$/, ".md");

    return path.join(dataRoot, "research", relative);
}

/**
 * Returns the data record a per-record research file mirrors, or null for a
 * topic note or any other file that mirrors no record directory. The record
 * need not exist.
 *
 * @param dataRoot - Repository root.
 * @param researchPath - Absolute path of a file under research/.
 * @returns The absolute path of the mirrored record, or null.
 */
export function recordFileFor(dataRoot: string, researchPath: string): string | null
{
    const relative = path.relative(path.join(dataRoot, "research"), researchPath);
    const directory = relative.split(path.sep)[0];

    if (!researchRecordDirectories.includes(directory))
    {
        return null;
    }

    return path.join(dataRoot, relative.replace(/\.md$/, ".yml"));
}

/**
 * A research note split at its generated reference sections.
 */
export type ResearchNoteParts = {
    /**
     * Everything before the first of `## References` and `## Other
     * references`, which is what cites.
     */
    body: string;

    /**
     * Everything from the first reference heading to the end: the
     * References section, the Other references section, or both. Null when
     * the note has neither.
     */
    tail: string | null;

    /**
     * The ids listed under `## Other references`: works the note names in
     * prose without citing them by id. Empty when the note has no such
     * section.
     */
    otherIds: Array<string>;
};

/**
 * Splits a research note into its body and its reference sections.
 *
 * @param text - The note's full text.
 * @returns The body, the reference sections, and the ids listed under
 *     Other references.
 */
export function splitResearchNote(text: string): ResearchNoteParts
{
    const referencesMatch = /^## References[ \t]*$/m.exec(text);
    const otherMatch = /^## Other references[ \t]*$/m.exec(text);
    const starts = [referencesMatch, otherMatch]
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => match.index);

    if (starts.length === 0)
    {
        return { body: text, tail: null, otherIds: [] };
    }

    const bodyEnd = Math.min(...starts);
    let otherIds = new Array<string>();

    if (otherMatch !== null)
    {
        const sectionEnd = referencesMatch !== null && referencesMatch.index > otherMatch.index
            ? referencesMatch.index
            : text.length;
        const section = text.slice(otherMatch.index, sectionEnd);

        otherIds = [...section.matchAll(/^- `([^`]+)`/gm)].map((match) => match[1]);
    }

    return { body: text.slice(0, bodyEnd), tail: text.slice(bodyEnd), otherIds };
}

/**
 * Removes fenced code blocks, which hold examples rather than citations or links.
 *
 * @param text - Markdown text.
 * @returns The text without its fenced blocks.
 */
function stripCodeFences(text: string): string
{
    return text.replace(/^```[\s\S]*?^```[ \t]*$/gm, "");
}

/**
 * Returns the local targets of a note's Markdown links, without any `#`
 * fragment. External links (any scheme) and same-file anchors are skipped.
 *
 * @param text - Markdown text.
 * @returns Each local link target as written.
 */
export function markdownLinkTargets(text: string): Array<string>
{
    const targets = new Array<string>();

    for (const match of stripCodeFences(text).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g))
    {
        const target = match[1].split("#")[0];

        if (target !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(target))
        {
            targets.push(decodeURI(target));
        }
    }

    return targets;
}

/**
 * Returns the reference ids a note's body cites: tokens of the store's key
 * form (lowercase surname letters, apostrophes or hyphens, a four-digit year,
 * one suffix letter). Link targets and fenced code are ignored.
 *
 * @param body - The note's body, without its References section.
 * @returns The distinct ids in order of first citation.
 */
export function researchCitedIds(body: string): Array<string>
{
    const prose = stripCodeFences(body).replace(/\]\([^)]*\)/g, "]");
    const keyPattern = /(?<![\p{L}\p{N}'’-])\p{Ll}[\p{Ll}'’-]*\d{4}[a-z](?![\p{L}\p{N}])/gu;

    return [...new Set([...prose.matchAll(keyPattern)].map((match) => match[0]))];
}

/**
 * One narrative citation found in prose: an author's surname, a year, and the
 * letter after the year when the prose gives one.
 */
export type NarrativeCitation = {
    /**
     * The surname, or the surname run the citation opens with
     * ("Gradziński, Kielan-Jaworowska").
     */
    surname: string;

    /**
     * The four-digit year.
     */
    year: string;

    /**
     * The letter printed after the year ("2026b" gives "b"), which names one
     * of an author's works of that year; null when the year has none.
     */
    letter: string | null;
};

const citationName = String.raw`\p{Lu}[\p{L}\p{N}'’-]+(?:\s+(?:de|da|dos|das|du|des|di|van|von|der|del|la|le)?\s*\p{Lu}[\p{L}\p{N}'’-]+)?`;
const citationNames = String.raw`(?:${citationName},\s+)*${citationName}`;
const citationParticle = String.raw`(?:(?:van|von|de|da|dos|das|du|des|di|der|del|la|le)\s+)?`;
const citationPartner = String.raw`(?:\s+(?:and|&)\s+(?:colleagues|others|(${citationParticle}${citationName}))|\s+et\s+al\.)?`;
const narrativeCitationPattern = new RegExp(String.raw`(?<![\p{L}])(${citationNames})${citationPartner}\s+\((\d{4}[a-z]?(?:[,:;][^)]*)?)\)`, "gu");
const parentheticalPattern = /\(([^()]*\d{4}[^()]*)\)/g;
const parentheticalItemPattern = new RegExp(String.raw`^\s*(${citationName})${citationPartner},?\s+(\d{4})([a-z])?\b`, "u");

// Capitalized words the name pattern takes for an author but that are not one.
// Add a word only after reading the sentence that produced it.
const notCitationNames = new Set(["Nemegt Formation", "Ankylosauridae", "Tanystrophaeus", "Pachysauriscus", "Syntarsus Fairmaire"]);

// Words that precede a citation and are swallowed into the name: "Campanian
// Miller (1991)", "Follows Behrensmeyer's (2007)", "The Zhou (2007)".
const leadingNonNames = new Set(["The", "Follows", "Campanian", "Maastrichtian", "Cretaceous", "Jurassic", "Triassic", "After", "See", "As", "In", "And"]);

// Catalog numbers ("AMNH (5895)") and ICZN Opinions ("Opinion (2486)") have
// the shape of a citation but are not one.
const notCitationPattern = /^(?:[A-Z]{2,}(?:\s+[A-Z]{2,})?|Opinion)$/u;

/**
 * Drops leading words that are not part of a surname, such as "The" in "The
 * Zhou (2007)", and a possessive ending.
 *
 * @param name - The matched name.
 * @returns The surname as a citation would give it.
 */
function cleanCitationName(name: string): string
{
    const words = name.split(/\s+/);

    while (words.length > 1 && leadingNonNames.has(words[0]))
    {
        words.shift();
    }

    return words.join(" ").replace(/['’]s$/u, "");
}

/**
 * Finds every narrative and parenthetical citation in a prose string: "Smith
 * (2000)", "Smith and colleagues (2000, p. 12)", "(Smith, 2000; Jones, 2001)".
 * A letter after a year is kept, so "Smith (2000a, 2000b)" gives two
 * citations.
 * Text inside double quotation marks is skipped, because a name inside a
 * quotation is the quoted source's wording, and a personal communication is
 * not a citation of a work.
 *
 * @param text - The prose.
 * @returns The citations found, without duplicates.
 */
export function narrativeCitations(text: string): Array<NarrativeCitation>
{
    const prose = text.replace(/"[^"]*"/g, " ");
    const found = new Map<string, NarrativeCitation>();
    const add = (name: string, year: string, letter: string | null): void =>
    {
        const surname = cleanCitationName(name);

        if (!notCitationNames.has(surname) && !notCitationPattern.test(surname))
        {
            found.set(`${surname}|${year}${letter ?? ""}`, { surname, year, letter });
        }
    };

    for (const match of prose.matchAll(narrativeCitationPattern))
    {
        const [, name, partner, inside] = match;

        if (/personal\s+comm/i.test(inside))
        {
            continue;
        }

        const lead = notCitationNames.has(name) && partner ? partner : name;

        for (const yearMatch of inside.matchAll(/(?<![\d.])(1[6-9]\d\d|20[0-3]\d)([a-z])?(?![\d\p{L}])/gu))
        {
            add(lead, yearMatch[1], yearMatch[2] ?? null);
        }
    }

    for (const group of prose.matchAll(parentheticalPattern))
    {
        for (const item of group[1].split(";"))
        {
            const match = parentheticalItemPattern.exec(item);

            if (match !== null)
            {
                add(notCitationNames.has(match[1]) && match[2] ? match[2] : match[1], match[3], match[4] ?? null);
            }
        }
    }

    return [...found.values()];
}

/**
 * Folds a surname or key stem so spellings of one name compare equal: accents,
 * hyphens, apostrophes and spaces dropped.
 *
 * @param text - The surname or key stem.
 * @returns The folded letters.
 */
function foldSurname(text: string): string
{
    return text
        .replace(/ı/g, "i")
        .replace(/ł/g, "l")
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}

/**
 * Tells whether a reference id is the work a citation names: the id's
 * surname stem matches the citation's surname, or any one of its words (so
 * "Díez Díaz" matches `díezdíaz` and "Gradziński, Kielan-Jaworowska" matches
 * `gradziński`), and the year matches the entry's year or the key's. A
 * citation that gives a letter after the key's year names that key's letter
 * only; one matched through the entry's year, where the key was dated
 * differently, is not held to the key's letter.
 *
 * @param citation - The citation.
 * @param id - The reference id.
 * @param storeYear - The store entry's `year`, when the store holds the id.
 * @returns True when the id can be the cited work.
 */
export function citationMatchesId(citation: NarrativeCitation, id: string, storeYear: string | null): boolean
{
    const keyMatch = /^(.*?)(\d{4})([a-z])$/u.exec(id);

    if (keyMatch === null || (citation.year !== keyMatch[2] && citation.year !== storeYear))
    {
        return false;
    }
    else if (citation.letter !== null && citation.year === keyMatch[2] && citation.letter !== keyMatch[3])
    {
        return false;
    }

    const stem = foldSurname(keyMatch[1]);
    const words = [citation.surname, ...citation.surname.split(/[\s,]+/)].map(foldSurname);

    return words.some((word) => word.length > 1 && (stem === word || (word.length >= 4 && stem.endsWith(word))));
}

/**
 * Folds text for comparing two spellings of one string: accents dropped,
 * lowercased, and everything but letters and digits removed.
 *
 * @param text - The text to fold.
 * @returns The folded text.
 */
function foldForComparison(text: string): string
{
    return text
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Builds the key that identifies the work a store entry describes, so two
 * entries for one work can be found whatever year or venue spelling each
 * carries. The key is the title, without any bracketed translation, folded and
 * cut to its first 60 characters, with the volume and the pages or article
 * number. An entry with no pages or article number is identified by its title,
 * volume and venue (journal, book or publisher) instead.
 *
 * @param entry - The store entry.
 * @returns The identity key, or null when the title is too short to identify
 *     a work.
 */
export function referenceIdentity(entry: Reference): string | null
{
    const title = foldForComparison((entry.title ?? "").replace(/\[.*?\]/g, "")).slice(0, 60);

    if (title.length <= 15)
    {
        return null;
    }

    const volume = foldForComparison(String(entry.volume ?? ""));
    const locator = foldForComparison(String(entry.pages ?? entry.article_number ?? ""));

    if (locator.length > 0)
    {
        return `${title}|${volume}|${locator}`;
    }

    const venue = foldForComparison(entry.journal ?? entry.book ?? entry.publisher ?? "").slice(0, 40);

    return `${title}|${volume}||${venue}`;
}

/**
 * Formats one store entry as a line of a research note's References section.
 *
 * @param entry - The store reference.
 * @returns The Markdown list item, without a trailing newline.
 */
export function formatResearchReference(entry: Reference): string
{
    const title = (entry.title ?? "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
    const parts = [`- \`${entry.id}\`: ${entry.authors ?? ""} (${entry.year ?? "n.d."}). ${title}.`];

    if (entry.journal)
    {
        const volume = entry.volume ? ` ${entry.volume}${entry.issue ? `(${entry.issue})` : ""}` : "";
        const locator = entry.pages ?? entry.article_number;

        parts.push(`*${entry.journal}*${volume}${locator ? `: ${locator}` : ""}.`);
    }
    else if (entry.book)
    {
        parts.push(`In *${entry.book}*${entry.pages ? `, pp. ${entry.pages}` : ""}.`);
    }
    else if (entry.school)
    {
        parts.push(`${entry.thesis ? `${entry.thesis[0].toUpperCase()}${entry.thesis.slice(1)} thesis` : "Thesis"}, ${entry.school}.`);
    }

    if (entry.publisher && !entry.journal)
    {
        parts.push(`${entry.publisher}.`);
    }

    if (entry.doi)
    {
        parts.push(`doi:${entry.doi}`);
    }

    return parts.join(" ");
}

/**
 * Builds one reference section of a research note from the store: one line
 * per id, in the order given.
 *
 * @param dataRoot - Repository root containing the `references/` directory.
 * @param ids - The ids to list.
 * @param heading - The section heading, without its `## ` prefix.
 * @returns The section text, or null when there are no ids. Ids with no
 *     store entry are returned in `missing` and omitted from the section.
 */
export function buildResearchReferences(
    dataRoot: string,
    ids: Array<string>,
    heading = "References"): { section: string | null; missing: Array<string> }
{
    const lines = new Array<string>();
    const missing = new Array<string>();

    for (const id of ids)
    {
        const filePath = path.join(dataRoot, "references", referenceBucket(id), `${id}.yml`);

        if (fs.existsSync(filePath))
        {
            lines.push(formatResearchReference(parseYaml<Reference>(filePath)));
        }
        else
        {
            missing.push(id);
        }
    }

    return { section: lines.length > 0 ? `## ${heading}\n\n${lines.join("\n")}\n` : null, missing };
}

/**
 * Builds everything after a research note's body: the References section
 * for the ids the body cites, then the Other references section for works
 * the note names in prose without citing them by id. An Other references id
 * that the body also cites is dropped from that section, since it is
 * already listed under References.
 *
 * @param dataRoot - Repository root containing the `references/` directory.
 * @param body - The note's body.
 * @param otherIds - The ids the note lists under Other references.
 * @returns The sections joined, or null when there is neither; ids with no
 *     store entry; and Other references ids the body also cites.
 */
export function buildResearchTail(
    dataRoot: string,
    body: string,
    otherIds: Array<string>): { tail: string | null; missing: Array<string>; duplicates: Array<string> }
{
    const citedIds = researchCitedIds(body);
    const duplicates = otherIds.filter((id) => citedIds.includes(id));
    const uncitedIds = [...new Set(otherIds.filter((id) => !citedIds.includes(id)))];
    const references = buildResearchReferences(dataRoot, citedIds);
    const others = buildResearchReferences(dataRoot, uncitedIds, "Other references");
    const sections = [references.section, others.section].filter((section): section is string => section !== null);

    return {
        tail: sections.length > 0 ? sections.join("\n") : null,
        missing: [...references.missing, ...others.missing],
        duplicates,
    };
}
