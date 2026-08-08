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
    "publisher", "volume", "issue", "pages", "article_number", "doi",
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
 * Flattens an institution registry into an abbreviation-to-display-name
 * map. Every canonical key and alias maps to the institution's display
 * name (name + city when available). This provides backward
 * compatibility with code that expects a flat lookup table.
 *
 * @param registry - The structured institution registry.
 * @returns A flat record mapping every abbreviation to a display name.
 */
export function flattenInstitutionMap(registry: Record<string, InstitutionEntry>): Record<string, string>
{
    const result: Record<string, string> = {};

    for (const [key, entry] of Object.entries(registry))
    {
        const displayName = entry.location?.city
            ? `${entry.name}, ${entry.location.city}`
            : entry.name;

        result[key] = displayName;

        if (entry.aliases)
        {
            for (const alias of entry.aliases)
            {
                result[alias] = displayName;
            }
        }
    }

    return result;
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
