// Normalize extraction JSONs produced by the paper-driven backfill flow.
// Applies two mechanical fixes, in this order:
//
//   1. Text-character normalization on holotype_material, each
//      diagnostic_features bullet, notes, and binomial_in_paper:
//        – U+2013 en-dash    → "-"
//        — U+2014 em-dash    → "-"
//        ‘ U+2018, ’ U+2019  → "'"
//        “ U+201C, ” U+201D  → '"'
//      Other non-ASCII characters with semantic value (°, ×, ², é,
//      Greek letters, etc.) are preserved.
//
//   2. Sentence-case fix-up on holotype_material and each
//      diagnostic_features bullet: if the first ASCII alphabetic
//      character is lowercase, capitalise it. Skips entries that
//      already start with an uppercase letter, a digit, a Unicode
//      letter, or a non-letter glyph that should not be touched.
//
// Extraction sentinels (`notes` containing "EXTRACTION FAILED") are
// skipped untouched so re-running the failed entries later doesn't
// require reverting cosmetic edits.
//
// Idempotent — running twice on the same input is a no-op.
//
// Usage:
//   npm run normalize-extractions -- --letter A
//   npm run normalize-extractions -- --letter A --dry-run

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const reportsDir = path.join(root, "reports");

/**
 * Replaces typographic dashes and curly quotes with their ASCII
 * equivalents. Other non-ASCII characters are preserved.
 *
 * @param input - Source string.
 * @returns Normalized string.
 */
function normalizeText(input: string): string
{
    return input
        .replaceAll("–", "-")
        .replaceAll("—", "-")
        .replaceAll("‘", "'")
        .replaceAll("’", "'")
        .replaceAll("“", "\"")
        .replaceAll("”", "\"");
}

/**
 * Capitalises the first ASCII alphabetic character in the string when
 * it is lowercase. Leading non-letter glyphs (digits, punctuation,
 * whitespace) are skipped and the first letter after them is the
 * target. Non-ASCII letters are left alone.
 *
 * @param input - Source string.
 * @returns String with the leading letter capitalised when applicable.
 */
function capitaliseFirstAlpha(input: string): string
{
    return input.replace(
        /^([^A-Za-z]*)([a-z])/,
        (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
    );
}

/**
 * Normalizes one parsed extraction object in-place semantics: returns
 * a new object with the cleaned-up fields. Sentinel records (where
 * `notes` includes "EXTRACTION FAILED") are returned unchanged.
 *
 * @param record - Parsed JSON object from reports/extractions/<L>/.
 * @returns Object with normalized fields and a change count.
 */
function normalizeRecord(record: Record<string, unknown>): { record: Record<string, unknown>; changes: number }
{
    const notes = typeof record.notes === "string" ? record.notes : null;

    if (notes !== null && notes.includes("EXTRACTION FAILED"))
    {
        return { record, changes: 0 };
    }

    let changes = 0;
    const updated: Record<string, unknown> = { ...record };

    if (typeof record.holotype_material === "string")
    {
        const normalized = capitaliseFirstAlpha(normalizeText(record.holotype_material));

        if (normalized !== record.holotype_material)
        {
            updated.holotype_material = normalized;
            changes += 1;
        }
    }

    if (Array.isArray(record.diagnostic_features))
    {
        const before = record.diagnostic_features as Array<unknown>;
        const after = before.map((bullet) =>
        {
            if (typeof bullet !== "string")
            {
                return bullet;
            }

            return capitaliseFirstAlpha(normalizeText(bullet));
        });

        if (after.some((bullet, index) => bullet !== before[index]))
        {
            updated.diagnostic_features = after;
            changes += after.filter((bullet, index) => bullet !== before[index]).length;
        }
    }

    if (typeof record.notes === "string")
    {
        const normalized = normalizeText(record.notes);

        if (normalized !== record.notes)
        {
            updated.notes = normalized;
            changes += 1;
        }
    }

    if (typeof record.binomial_in_paper === "string")
    {
        const normalized = normalizeText(record.binomial_in_paper);

        if (normalized !== record.binomial_in_paper)
        {
            updated.binomial_in_paper = normalized;
            changes += 1;
        }
    }

    return { record: updated, changes };
}

/**
 * Parses CLI flags. Supports `--letter <X>` and `--dry-run`.
 *
 * @param argv - process.argv slice.
 * @returns Parsed arguments.
 */
function parseArguments(argv: Array<string>): { letter: string; dryRun: boolean }
{
    let letter: string | null = null;
    let dryRun = false;

    for (let index = 0; index < argv.length; index += 1)
    {
        const flag = argv[index];

        if (flag === "--letter")
        {
            letter = argv[index + 1] ?? null;
            index += 1;
        }
        else if (flag === "--dry-run")
        {
            dryRun = true;
        }
        else
        {
            throw new Error(`Unknown argument: ${flag}`);
        }
    }

    if (letter === null || letter.length !== 1 || !/^[A-Za-z]$/.test(letter))
    {
        throw new Error("--letter <X> is required and must be a single ASCII letter.");
    }

    return { letter: letter.toUpperCase(), dryRun };
}

const { letter, dryRun } = parseArguments(process.argv.slice(2));

const extractionsDir = path.join(reportsDir, "extractions", letter);

if (!fs.existsSync(extractionsDir))
{
    throw new Error(`No extractions directory at ${extractionsDir}`);
}

const files = fs
    .readdirSync(extractionsDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

let touchedFiles = 0;
let totalChanges = 0;

for (const name of files)
{
    const fullPath = path.join(extractionsDir, name);
    const original = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(original) as Record<string, unknown>;
    const { record, changes } = normalizeRecord(parsed);

    if (changes === 0)
    {
        continue;
    }

    touchedFiles += 1;
    totalChanges += changes;

    const serialized = JSON.stringify(record, null, 2) + "\n";

    if (!dryRun)
    {
        fs.writeFileSync(fullPath, serialized);
    }

    console.log(`${dryRun ? "[dry-run] " : ""}${name}: ${changes} change(s)`);
}

console.log("");
console.log(`${dryRun ? "Would update" : "Updated"} ${touchedFiles} file(s) with ${totalChanges} change(s) total.`);
