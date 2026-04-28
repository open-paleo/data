/**
 * Applies a citation-key rename plan to genus YAMLs. Rewrites every
 * `species.described_in` and `references[].id` field that uses an
 * old (colliding) key to its assigned new (suffixed) key, picking
 * which new key to use per reference by title-similarity match
 * against the plan.
 *
 * Inputs:
 *   - reports/citation-key-rename-plan.yml (produced by build-rename-plan.ts)
 *
 * Outputs:
 *   - YAML files in genera/ are rewritten in-place when --apply is set.
 *   - reports/citation-key-rename-applied.json — dry-run or apply
 *     summary listing every change (or proposed change), one entry per
 *     YAML file touched.
 *
 * Modes:
 *   (default)   Dry run. Reports proposed changes without writing.
 *   --apply     Actually rewrite the YAML files.
 *
 * Matching:
 *   - For each reference in a YAML whose `id` matches a plan's old key,
 *     compute Jaccard title similarity against every assignment's
 *     canonical title; pick the highest-scoring assignment.
 *   - When the YAML reference has no title, fall back to matching by
 *     citing-genera membership (each plan assignment lists the genera
 *     whose YAMLs cite that paper).
 *   - Unmatched references are reported but not rewritten.
 *
 * Usage:
 *   node --experimental-strip-types scripts/apply-rename-plan.ts          # dry run
 *   node --experimental-strip-types scripts/apply-rename-plan.ts --apply  # write
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { parse as parseYamlContent } from "yaml";

import type { GenusData } from "./types.ts";
import { findYamlFiles } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const planPath = path.join(root, "reports", "citation-key-rename-plan.yml");
const reportPath = path.join(root, "reports", "citation-key-rename-applied.json");

const titleSimilarityMatchThreshold = 0.5;

/**
 * One assignment within a plan block.
 */
type PlanAssignment = {
    new_key: string;
    suffix: string;
    year?: number;
    journal?: string;
    doi?: string;
    title?: string;
    citing_genera: Array<string>;
    paper_in_corpus: boolean;
    corpus_markdown_basename?: string;
};

/**
 * One rename block in the plan.
 */
type PlanBlock = {
    old_key: string;
    audit_bucket: string;
    paper_present: boolean;
    assignments: Array<PlanAssignment>;
};

/**
 * Top-level shape of the plan file.
 */
type PlanFile = {
    blocks: Array<PlanBlock>;
};

/**
 * One change recorded against a single YAML file.
 */
type Change = {
    /**
     * Repository-relative file path.
     */
    file: string;

    /**
     * The genus name from the YAML.
     */
    genus: string;

    /**
     * Where the rewrite happened.
     */
    location: "described_in" | "reference";

    /**
     * The reference index when location is "reference".
     */
    referenceIndex?: number;

    /**
     * Old citation key.
     */
    oldKey: string;

    /**
     * Assigned new citation key.
     */
    newKey: string;

    /**
     * How the assignment was matched.
     */
    matchedVia: "title-similarity" | "citing-genus" | "single-assignment";

    /**
     * Title-similarity score for "title-similarity" matches (in [0, 1]).
     */
    matchScore?: number;
};

/**
 * One unmatched reference — the plan did not yield a confident new key.
 */
type Unmatched = {
    file: string;
    genus: string;
    location: "described_in" | "reference";
    referenceIndex?: number;
    oldKey: string;
    referenceTitle?: string;
    reason: "no-title-and-genus-not-in-plan" | "below-similarity-threshold";
};

/**
 * Parsed CLI options.
 */
type CliOptions = {
    apply: boolean;
};

/**
 * Stop words for title-similarity comparison.
 */
const titleStopWords = new Set([
    "the", "and", "from", "with", "for", "of", "in", "on", "a", "an",
    "to", "new", "their", "its", "is", "are", "was", "this", "that",
    "by", "at", "as", "or", "but",
]);

/**
 * Tokenizes a title into significant lowercase words.
 *
 * @param title - The title string.
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
 * @returns Jaccard similarity in [0, 1].
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
 * Parses CLI arguments.
 *
 * @returns Parsed options.
 */
function parseArgs(): CliOptions
{
    const args = process.argv.slice(2);
    const options: CliOptions = { apply: false };

    for (const argument of args)
    {
        if (argument === "--apply")
        {
            options.apply = true;
        }
        else
        {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }

    return options;
}

/**
 * Loads the plan file and indexes blocks by old key.
 *
 * @returns Map from old citation key to plan block.
 */
function loadPlan(): Map<string, PlanBlock>
{
    if (!fs.existsSync(planPath))
    {
        throw new Error(`Plan not found at ${planPath}. Run \`npm run build-rename-plan\` first.`);
    }

    const planFile = parseYamlContent(fs.readFileSync(planPath, "utf8")) as PlanFile;
    const blocksByKey = new Map<string, PlanBlock>();

    for (const block of planFile.blocks ?? [])
    {
        blocksByKey.set(block.old_key, block);
    }

    return blocksByKey;
}

/**
 * Picks the best new-key assignment for a reference being rewritten.
 *
 * @param block - The plan block for the old key.
 * @param genus - The citing genus, used for genus-membership fallback.
 * @param referenceTitle - The reference's title from the YAML, when present.
 * @returns The chosen assignment and how it was matched, or null when
 *          no confident assignment can be made.
 */
function chooseAssignment(
    block: PlanBlock,
    genus: string,
    referenceTitle: string | undefined,
): { assignment: PlanAssignment; matchedVia: Change["matchedVia"]; matchScore?: number } | null
{
    if (block.assignments.length === 1)
    {
        return { assignment: block.assignments[0], matchedVia: "single-assignment" };
    }

    if (referenceTitle)
    {
        let best: { assignment: PlanAssignment; score: number } | null = null;

        for (const assignment of block.assignments)
        {
            if (!assignment.title)
            {
                continue;
            }

            const score = titleSimilarity(referenceTitle, assignment.title);

            if (!best || score > best.score)
            {
                best = { assignment, score };
            }
        }

        if (best && best.score >= titleSimilarityMatchThreshold)
        {
            return { assignment: best.assignment, matchedVia: "title-similarity", matchScore: best.score };
        }
    }

    for (const assignment of block.assignments)
    {
        if (assignment.citing_genera.includes(genus))
        {
            return { assignment, matchedVia: "citing-genus" };
        }
    }

    return null;
}

/**
 * Escapes regex metacharacters in a string.
 *
 * @param value - The input string.
 * @returns The escaped string.
 */
function escapeForRegex(value: string): string
{
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrites one YAML file according to the plan. Uses the parsed
 * structure to identify which old keys need replacing and how, then
 * performs string-level substitutions on the original file content so
 * that no incidental formatting drift is introduced by the YAML
 * library's serializer.
 *
 * @param filePath - Absolute path to the YAML.
 * @param blocksByKey - Plan indexed by old key.
 * @param apply - When true, writes changes; otherwise dry-runs.
 * @param changes - Accumulator for recorded changes.
 * @param unmatched - Accumulator for references that could not be matched.
 */
function processFile(
    filePath: string,
    blocksByKey: Map<string, PlanBlock>,
    apply: boolean,
    changes: Array<Change>,
    unmatched: Array<Unmatched>,
): void
{
    const original = fs.readFileSync(filePath, "utf8");
    const parsed = parseYamlContent(original) as GenusData;
    const genusName = parsed?.genus ?? path.basename(filePath, path.extname(filePath));
    const relativeFile = path.relative(root, filePath);
    const referencesByOldKey = new Map<string, { index: number; title?: string }>();
    const replacements = new Map<string, string>();

    for (let index = 0; index < (parsed.references ?? []).length; index += 1)
    {
        const reference = parsed.references![index];

        if (reference?.id && blocksByKey.has(reference.id))
        {
            referencesByOldKey.set(reference.id, { index, title: reference.title });
        }
    }

    for (const species of parsed.species ?? [])
    {
        const oldKey = species?.described_in;

        if (!oldKey)
        {
            continue;
        }

        const block = blocksByKey.get(oldKey);

        if (!block)
        {
            continue;
        }

        const referenceInfo = referencesByOldKey.get(oldKey);
        const choice = chooseAssignment(block, genusName, referenceInfo?.title);

        if (!choice)
        {
            unmatched.push({
                file: relativeFile,
                genus: genusName,
                location: "described_in",
                oldKey,
                referenceTitle: referenceInfo?.title,
                reason: referenceInfo?.title ? "below-similarity-threshold" : "no-title-and-genus-not-in-plan",
            });
            continue;
        }

        replacements.set(oldKey, choice.assignment.new_key);
        changes.push({
            file: relativeFile,
            genus: genusName,
            location: "described_in",
            oldKey,
            newKey: choice.assignment.new_key,
            matchedVia: choice.matchedVia,
            ...(choice.matchScore !== undefined ? { matchScore: choice.matchScore } : {}),
        });
    }

    for (const [oldKey, referenceInfo] of referencesByOldKey)
    {
        const block = blocksByKey.get(oldKey)!;
        const choice = chooseAssignment(block, genusName, referenceInfo.title);

        if (!choice)
        {
            unmatched.push({
                file: relativeFile,
                genus: genusName,
                location: "reference",
                referenceIndex: referenceInfo.index,
                oldKey,
                referenceTitle: referenceInfo.title,
                reason: referenceInfo.title ? "below-similarity-threshold" : "no-title-and-genus-not-in-plan",
            });
            continue;
        }

        replacements.set(oldKey, choice.assignment.new_key);
        changes.push({
            file: relativeFile,
            genus: genusName,
            location: "reference",
            referenceIndex: referenceInfo.index,
            oldKey,
            newKey: choice.assignment.new_key,
            matchedVia: choice.matchedVia,
            ...(choice.matchScore !== undefined ? { matchScore: choice.matchScore } : {}),
        });
    }

    if (replacements.size === 0 || !apply)
    {
        return;
    }

    let updated = original;

    for (const [oldKey, newKey] of replacements)
    {
        const pattern = new RegExp(
            `^(\\s*(?:-\\s+)?(?:described_in|id):\\s+)${escapeForRegex(oldKey)}(\\s*(?:#.*)?)$`,
            "gm",
        );

        updated = updated.replace(pattern, `$1${newKey}$2`);
    }

    if (updated !== original)
    {
        fs.writeFileSync(filePath, updated, "utf8");
    }
}

/**
 * Entry point.
 */
function main(): void
{
    const options = parseArgs();
    const blocksByKey = loadPlan();
    const changes = new Array<Change>();
    const unmatched = new Array<Unmatched>();

    for (const filePath of findYamlFiles(generaDir).sort())
    {
        try
        {
            processFile(filePath, blocksByKey, options.apply, changes, unmatched);
        }
        catch (error)
        {
            console.error(`Failed processing ${filePath}: ${(error as Error).message}`);
        }
    }

    const filesTouched = new Set(changes.map((change) => change.file)).size;
    const summary = {
        mode: options.apply ? "apply" : "dry-run",
        filesTouched,
        changeCount: changes.length,
        unmatchedCount: unmatched.length,
        byMatchType: {
            "title-similarity": changes.filter((change) => change.matchedVia === "title-similarity").length,
            "citing-genus": changes.filter((change) => change.matchedVia === "citing-genus").length,
            "single-assignment": changes.filter((change) => change.matchedVia === "single-assignment").length,
        },
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(
        { summary, changes, unmatched },
        null,
        2,
    ), "utf8");

    console.log(`Mode: ${summary.mode}`);
    console.log(`Files ${options.apply ? "modified" : "to modify"}: ${filesTouched}`);
    console.log(`Changes ${options.apply ? "written" : "proposed"}: ${changes.length}`);
    console.log(`  via title similarity:  ${summary.byMatchType["title-similarity"]}`);
    console.log(`  via citing genus:      ${summary.byMatchType["citing-genus"]}`);
    console.log(`  single assignment:     ${summary.byMatchType["single-assignment"]}`);
    console.log(`Unmatched references:  ${summary.unmatchedCount}`);
    console.log(`Report: ${path.relative(root, reportPath)}`);
}

main();
