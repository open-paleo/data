/**
 * Lowercases every citation key in `clades/*.yml` so the keyspace is
 * uniformly lowercase across the corpus. The 40 uppercase keys
 * currently live only in clade reference lists (added before the
 * lowercase convention was settled) and propagate into the generated
 * `dist/references.bib`, where they create case-sensitivity hazards
 * for downstream consumers.
 *
 * For each uppercase clade reference key, the script:
 *
 *   1. Computes the target lowercase form.
 *   2. Compares the clade's reference metadata against any existing
 *      lowercase entry of the same form (cited by genus YAMLs).
 *   3. Decides:
 *      - **simple-lowercase** — the lowercase form does not exist, OR
 *        exists with effectively the same metadata (Jaccard title
 *        similarity ≥ 0.7). Just lowercases the clade key.
 *      - **collision** — the lowercase form exists in genera/ with
 *        clearly different metadata (different title and journal).
 *        Both the clade entry and the genera-side entries get
 *        suffixed (`coria2002` style: `cope1869a` and `cope1869b`),
 *        with letter assignment alphabetic by title for stability.
 *
 * Outputs:
 *   - reports/lowercase-keys-plan.json (dry-run) — every proposed
 *     change with reason, before/after, and matching files.
 *   - When --apply is passed, also rewrites the affected YAMLs.
 *
 * Usage:
 *   node --experimental-strip-types scripts/lowercase-citation-keys.ts          # dry-run
 *   node --experimental-strip-types scripts/lowercase-citation-keys.ts --apply  # write
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { parse as parseYamlContent, parseDocument } from "yaml";

import type { CladeData, GenusData, Reference } from "./types.ts";
import { findYamlFiles } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const cladesDir = path.join(root, "clades");
const reportPath = path.join(root, "reports", "lowercase-keys-plan.json");

const sameMetadataTitleThreshold = 0.7;
const strippedSimilarityThreshold = 0.4;
const translationBracketSimilarityThreshold = 0.30;

/**
 * Stop words for title-similarity comparison.
 */
const titleStopWords = new Set([
    "the", "and", "from", "with", "for", "of", "in", "on", "a", "an",
    "to", "new", "their", "its", "is", "are", "was", "this", "that",
    "by", "at", "as", "or", "but",
]);

/**
 * Tokenizes a title string into significant lowercase words.
 *
 * @param title - The title.
 * @returns Set of significant tokens.
 */
function titleTokens(title: string): Set<string>
{
    const cleaned = title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/<[^>]+>/g, "")
        .replace(/[^a-z\s]/g, " ");
    const tokens = cleaned
        .split(/\s+/)
        .filter((token) => token.length > 3 && !titleStopWords.has(token));

    return new Set(tokens);
}

/**
 * Computes Jaccard similarity between two title strings.
 *
 * @param a - First title.
 * @param b - Second title.
 * @returns Similarity in [0, 1].
 */
function titleSimilarity(a: string, b: string): number
{
    const setA = titleTokens(a);
    const setB = titleTokens(b);

    if (setA.size === 0 || setB.size === 0)
    {
        return 0;
    }

    let intersection = 0;

    for (const token of setA)
    {
        if (setB.has(token))
        {
            intersection += 1;
        }
    }

    return intersection / (setA.size + setB.size - intersection);
}

/**
 * Escapes regex metacharacters in a string.
 *
 * @param value - The input string.
 * @returns Escaped string.
 */
function escapeForRegex(value: string): string
{
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lower-cases and removes bracketed sections (commonly used to
 * append English translations to non-English titles).
 *
 * @param title - The title string.
 * @returns The stripped title.
 */
function stripBrackets(title: string): string
{
    return title.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Extracts text inside square brackets from a title (commonly an
 * English translation of the surrounding non-English title).
 *
 * @param title - The title string.
 * @returns The first bracketed substring, or empty when none.
 */
function extractBracketedTranslation(title: string): string
{
    return title.match(/\[([^\]]+)\]/)?.[1] ?? "";
}

/**
 * Decides whether two references describe the same underlying paper.
 * Combines several signals to handle common edge cases:
 *
 * - DOI match: definitive.
 * - Title is a substring of the other (one inline-translated, one
 *   abbreviated, or one is an OCR-truncated form).
 * - Bracketed translation in one title matches the other.
 * - Standard title-similarity threshold (Jaccard ≥ 0.7), or ≥ 0.4
 *   after bracket-stripping.
 *
 * @param a - First reference.
 * @param b - Second reference.
 * @returns True when the references are believed to describe the same
 *          underlying paper.
 */
function isSamePaper(a: Reference, b: Reference): boolean
{
    if (a.doi && b.doi && a.doi.toLowerCase() === b.doi.toLowerCase())
    {
        return true;
    }

    const titleA = (a.title ?? "").toLowerCase().trim();
    const titleB = (b.title ?? "").toLowerCase().trim();

    if (titleA.length === 0 || titleB.length === 0)
    {
        return false;
    }

    const strippedA = stripBrackets(titleA);
    const strippedB = stripBrackets(titleB);
    const minLen = Math.min(strippedA.length, strippedB.length);

    if (minLen >= 30)
    {
        const prefixA = strippedA.slice(0, Math.min(60, minLen));
        const prefixB = strippedB.slice(0, Math.min(60, minLen));

        if (strippedA.includes(prefixB) || strippedB.includes(prefixA))
        {
            return true;
        }
    }

    if (titleSimilarity(titleA, titleB) >= sameMetadataTitleThreshold)
    {
        return true;
    }

    if (titleSimilarity(strippedA, strippedB) >= strippedSimilarityThreshold)
    {
        return true;
    }

    const bracketA = extractBracketedTranslation(titleA);
    const bracketB = extractBracketedTranslation(titleB);

    if (bracketA && titleSimilarity(bracketA, titleB) >= translationBracketSimilarityThreshold)
    {
        return true;
    }

    if (bracketB && titleSimilarity(titleA, bracketB) >= translationBracketSimilarityThreshold)
    {
        return true;
    }

    return false;
}

/**
 * One change to a single clade YAML's `references[].id` field.
 */
type CladeChange = {
    file: string;
    referenceIndex: number;
    oldKey: string;
    newKey: string;
    classification: "simple-lowercase" | "collision-suffix";
    rationale: string;
};

/**
 * One change to a genus YAML's `species.described_in` or
 * `references[].id` field.
 */
type GenusChange = {
    file: string;
    genus: string;
    location: "described_in" | "reference";
    oldKey: string;
    newKey: string;
};

/**
 * Plan-file shape.
 */
type Plan = {
    summary: {
        cladeChanges: number;
        genusChanges: number;
        cladeFilesTouched: number;
        genusFilesTouched: number;
        simpleLowercase: number;
        collisionSuffix: number;
    };
    cladeChanges: Array<CladeChange>;
    genusChanges: Array<GenusChange>;
};

/**
 * Parses CLI arguments.
 *
 * @returns Whether to apply the plan.
 */
function parseArgs(): { apply: boolean }
{
    const args = process.argv.slice(2);

    for (const argument of args)
    {
        if (argument === "--apply")
        {
            return { apply: true };
        }

        throw new Error(`Unknown argument: ${argument}`);
    }

    return { apply: false };
}

/**
 * Loads all references from genera YAMLs, indexed by reference id.
 * When the same id appears in multiple genera, retains the first
 * occurrence (matches the build script's dedup order).
 *
 * @returns Map from reference id to its metadata.
 */
function loadGeneraReferences(): Map<string, Reference>
{
    const result = new Map<string, Reference>();

    for (const filePath of findYamlFiles(generaDir))
    {
        let data: GenusData;

        try
        {
            data = parseYamlContent(fs.readFileSync(filePath, "utf8")) as GenusData;
        }
        catch
        {
            continue;
        }

        for (const reference of data?.references ?? [])
        {
            if (reference?.id && !result.has(reference.id))
            {
                result.set(reference.id, reference);
            }
        }
    }

    return result;
}

/**
 * Determines an alphabetical-by-title suffix assignment for a
 * collision pair.
 *
 * @param cladeReference - Reference object on the clade side.
 * @param genusReference - Reference object on the genus side.
 * @returns The suffix letter assigned to each side.
 */
function chooseCollisionSuffixes(
    cladeReference: Reference,
    genusReference: Reference,
): { cladeSuffix: string; genusSuffix: string }
{
    const cladeTitle = (cladeReference.title ?? "").toLowerCase();
    const genusTitle = (genusReference.title ?? "").toLowerCase();
    const cladeFirst = cladeTitle.localeCompare(genusTitle) <= 0;

    return cladeFirst
        ? { cladeSuffix: "a", genusSuffix: "b" }
        : { cladeSuffix: "b", genusSuffix: "a" };
}

/**
 * Walks every clade YAML and decides what to do with each uppercase
 * reference key. Populates the `cladeChanges` and `genusChanges`
 * accumulators.
 *
 * @param generaReferences - Lookup of existing lowercase references in genera.
 * @param cladeChanges - Accumulator for clade-side rewrites.
 * @param genusChanges - Accumulator for genus-side rewrites.
 */
function planChanges(
    generaReferences: Map<string, Reference>,
    cladeChanges: Array<CladeChange>,
    genusChanges: Array<GenusChange>,
): void
{
    for (const filePath of findYamlFiles(cladesDir))
    {
        const data = parseYamlContent(fs.readFileSync(filePath, "utf8")) as CladeData;
        const relativeFile = path.relative(root, filePath);
        const references = data?.references ?? [];

        for (let index = 0; index < references.length; index += 1)
        {
            const reference = references[index];

            if (!reference?.id || reference.id === reference.id.toLowerCase())
            {
                continue;
            }

            const oldKey = reference.id;
            const lowerKey = oldKey.toLowerCase();
            const genusReference = generaReferences.get(lowerKey);

            if (!genusReference)
            {
                cladeChanges.push({
                    file: relativeFile,
                    referenceIndex: index,
                    oldKey,
                    newKey: lowerKey,
                    classification: "simple-lowercase",
                    rationale: "No matching lowercase reference in genera/",
                });
                continue;
            }

            if (isSamePaper(reference, genusReference))
            {
                cladeChanges.push({
                    file: relativeFile,
                    referenceIndex: index,
                    oldKey,
                    newKey: lowerKey,
                    classification: "simple-lowercase",
                    rationale: "Genera entry describes the same paper (DOI / substring / translation match)",
                });
                continue;
            }

            const similarity = titleSimilarity(reference.title ?? "", genusReference.title ?? "");

            const { cladeSuffix, genusSuffix } = chooseCollisionSuffixes(reference, genusReference);
            const cladeNewKey = lowerKey + cladeSuffix;
            const genusNewKey = lowerKey + genusSuffix;

            cladeChanges.push({
                file: relativeFile,
                referenceIndex: index,
                oldKey,
                newKey: cladeNewKey,
                classification: "collision-suffix",
                rationale: `Lowercase form exists in genera with different paper (title similarity ${similarity.toFixed(2)}). Both sides receive a suffix.`,
            });

            for (const genusFile of findYamlFiles(generaDir))
            {
                let genusData: GenusData;

                try
                {
                    genusData = parseYamlContent(fs.readFileSync(genusFile, "utf8")) as GenusData;
                }
                catch
                {
                    continue;
                }

                const genusName = genusData?.genus ?? path.basename(genusFile, path.extname(genusFile));
                const genusRelative = path.relative(root, genusFile);
                const speciesList = genusData?.species ?? [];
                const referenceList = genusData?.references ?? [];

                for (const species of speciesList)
                {
                    if (species?.described_in === lowerKey)
                    {
                        genusChanges.push({
                            file: genusRelative,
                            genus: genusName,
                            location: "described_in",
                            oldKey: lowerKey,
                            newKey: genusNewKey,
                        });
                    }
                }

                for (const referenceEntry of referenceList)
                {
                    if (referenceEntry?.id === lowerKey)
                    {
                        genusChanges.push({
                            file: genusRelative,
                            genus: genusName,
                            location: "reference",
                            oldKey: lowerKey,
                            newKey: genusNewKey,
                        });
                    }
                }
            }
        }
    }
}

/**
 * Applies all clade-side rewrites.
 *
 * @param cladeChanges - Changes to apply.
 */
function applyCladeChanges(cladeChanges: Array<CladeChange>): void
{
    const groupedByFile = new Map<string, Array<CladeChange>>();

    for (const change of cladeChanges)
    {
        const list = groupedByFile.get(change.file) ?? new Array<CladeChange>();

        list.push(change);
        groupedByFile.set(change.file, list);
    }

    for (const [relativeFile, changes] of groupedByFile)
    {
        const absolutePath = path.join(root, relativeFile);
        const original = fs.readFileSync(absolutePath, "utf8");
        const document = parseDocument(original);

        for (const change of changes)
        {
            document.setIn(["references", change.referenceIndex, "id"], change.newKey);
        }

        fs.writeFileSync(absolutePath, document.toString(), "utf8");
    }
}

/**
 * Applies all genus-side rewrites at the string level so unrelated
 * formatting is preserved.
 *
 * @param genusChanges - Changes to apply.
 */
function applyGenusChanges(genusChanges: Array<GenusChange>): void
{
    const replacementsByFile = new Map<string, Map<string, string>>();

    for (const change of genusChanges)
    {
        const map = replacementsByFile.get(change.file) ?? new Map<string, string>();

        map.set(change.oldKey, change.newKey);
        replacementsByFile.set(change.file, map);
    }

    for (const [relativeFile, replacements] of replacementsByFile)
    {
        const absolutePath = path.join(root, relativeFile);
        let content = fs.readFileSync(absolutePath, "utf8");

        for (const [oldKey, newKey] of replacements)
        {
            const pattern = new RegExp(
                `^(\\s*(?:-\\s+)?(?:described_in|id):\\s+)${escapeForRegex(oldKey)}(\\s*(?:#.*)?)$`,
                "gm",
            );

            content = content.replace(pattern, `$1${newKey}$2`);
        }

        fs.writeFileSync(absolutePath, content, "utf8");
    }
}

/**
 * Entry point.
 */
function main(): void
{
    const { apply } = parseArgs();
    const cladeChanges = new Array<CladeChange>();
    const genusChanges = new Array<GenusChange>();
    const generaReferences = loadGeneraReferences();

    planChanges(generaReferences, cladeChanges, genusChanges);

    const cladeFilesTouched = new Set(cladeChanges.map((change) => change.file)).size;
    const genusFilesTouched = new Set(genusChanges.map((change) => change.file)).size;
    const simpleLowercase = cladeChanges.filter((change) => change.classification === "simple-lowercase").length;
    const collisionSuffix = cladeChanges.filter((change) => change.classification === "collision-suffix").length;
    const plan: Plan = {
        summary: {
            cladeChanges: cladeChanges.length,
            genusChanges: genusChanges.length,
            cladeFilesTouched,
            genusFilesTouched,
            simpleLowercase,
            collisionSuffix,
        },
        cladeChanges,
        genusChanges,
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(plan, null, 2), "utf8");

    console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
    console.log(`Clade changes:           ${plan.summary.cladeChanges}`);
    console.log(`  simple-lowercase:      ${plan.summary.simpleLowercase}`);
    console.log(`  collision-suffix:      ${plan.summary.collisionSuffix}`);
    console.log(`Clade files affected:    ${plan.summary.cladeFilesTouched}`);
    console.log(`Genus changes:           ${plan.summary.genusChanges}`);
    console.log(`Genus files affected:    ${plan.summary.genusFilesTouched}`);
    console.log(`Plan: ${path.relative(root, reportPath)}`);

    if (apply)
    {
        applyCladeChanges(cladeChanges);
        applyGenusChanges(genusChanges);
        console.log("Applied.");
    }
}

main();
