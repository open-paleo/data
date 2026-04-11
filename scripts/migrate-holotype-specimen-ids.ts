/**
 * One-off: migrate every `holotype.specimen_id` scalar to an inline YAML
 * array and insert `specimen_type: holotype` on every existing holotype
 * block. Adopted in #1848.
 *
 * Strategy: pure text-insertion (no parse/stringify round-trip) so the
 * resulting diff is limited to the two touched lines per species entry.
 *
 * Usage:
 *   node --experimental-strip-types scripts/migrate-holotype-specimen-ids.ts [--apply]
 *
 * Without `--apply` the script runs in dry-run mode and prints a
 * per-file summary of proposed changes.
 *
 * See `reports/holotype-schema-change.md` for the full plan.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

type FileChange = {
    filePath: string;
    migrations: Array<{
        lineNumber: number;
        before: string;
        afterSpecimenLine: string;
        insertedTypeLine: string;
    }>;
    alreadyMigrated: number;
    skipped: Array<{ lineNumber: number; reason: string; line: string }>;
};

/**
 * Recursively collect all `.yml` files under the given directory.
 *
 * @param directory - Absolute directory path to walk.
 * @returns Absolute file paths of every YAML file found beneath it.
 */
function walkYaml(directory: string): Array<string>
{
    const results: Array<string> = [];

    for (const entry of fs.readdirSync(directory))
    {
        const entryPath = path.join(directory, entry);

        if (fs.statSync(entryPath).isDirectory())
        {
            results.push(...walkYaml(entryPath));
        }
        else if (entry.endsWith(".yml"))
        {
            results.push(entryPath);
        }
    }

    return results;
}

/**
 * Escapes a string for use as a YAML double-quoted scalar literal.
 *
 * @param text - The raw string.
 * @returns A YAML double-quoted scalar literal (with surrounding quotes).
 */
function toDoubleQuotedScalar(text: string): string
{
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    return `"${escaped}"`;
}

/**
 * Decides whether a scalar value can be rendered as a YAML plain scalar
 * when it sits inside a flow-array context (`[...]`). The flow context
 * adds `,` and `]` to the list of characters that force quoting.
 *
 * @param text - The raw string.
 * @returns A YAML scalar literal safe to embed inside `[...]`.
 */
function renderFlowScalar(text: string): string
{
    if (/^[\s#&*!|>%@`'"\-?]/.test(text))
    {
        return toDoubleQuotedScalar(text);
    }

    if (/[,\]{}[]/.test(text))
    {
        return toDoubleQuotedScalar(text);
    }

    if (text.includes(": ") || text.includes(" #") || text.includes("\n") || text.includes("\"") || text.includes("'"))
    {
        return toDoubleQuotedScalar(text);
    }

    return text;
}

/**
 * Parses a single YAML scalar value that may be plain, single-quoted, or
 * double-quoted. Handles the subset of escapes that appear in real
 * holotype values (`\"`, `\\`).
 *
 * @param rawValue - The text after `specimen_id:` on the matching line,
 *   already trimmed of leading whitespace and trailing newline.
 * @returns The decoded scalar string.
 */
function parseScalarValue(rawValue: string): string
{
    if (rawValue.startsWith("\""))
    {
        const inner = rawValue.slice(1, rawValue.lastIndexOf("\""));
        return inner.replace(/\\\\/g, "\\").replace(/\\"/g, "\"");
    }

    if (rawValue.startsWith("'"))
    {
        const inner = rawValue.slice(1, rawValue.lastIndexOf("'"));
        return inner.replace(/''/g, "'");
    }

    return rawValue;
}

/**
 * Returns the leading whitespace of a line (its indentation).
 *
 * @param line - A source line.
 * @returns The leading-whitespace prefix.
 */
function leadingWhitespace(line: string): string
{
    return (line.match(/^\s*/)?.[0] ?? "");
}

/**
 * Inspects the `lines` around a matched `specimen_id:` line to see if
 * the sibling `specimen_type:` field already exists in the same holotype
 * block. A "block" is the contiguous run of lines at the same indent
 * starting at `specimenLineIndex`.
 *
 * @param lines - File lines.
 * @param specimenLineIndex - Index of the `specimen_id:` line.
 * @returns True if the surrounding block already contains `specimen_type:`.
 */
function holotypeBlockHasSpecimenType(lines: Array<string>, specimenLineIndex: number): boolean
{
    const targetIndent = leadingWhitespace(lines[specimenLineIndex]).length;
    const typePattern = new RegExp(String.raw`^\s{${targetIndent}}specimen_type:\s`);

    // Walk up to the holotype: key (indent < targetIndent).
    let startIndex = specimenLineIndex;

    while (startIndex > 0)
    {
        const previous = lines[startIndex - 1];
        const previousIndent = leadingWhitespace(previous).length;

        if (previous.length === 0)
        {
            startIndex -= 1;
            continue;
        }

        if (previousIndent < targetIndent)
        {
            break;
        }

        startIndex -= 1;
    }

    // Walk down until indent drops below targetIndent.
    for (let index = startIndex; index < lines.length; index += 1)
    {
        const line = lines[index];

        if (line.length === 0)
        {
            continue;
        }

        const indentWidth = leadingWhitespace(line).length;

        if (indentWidth < targetIndent && index !== startIndex)
        {
            return false;
        }

        if (typePattern.test(line))
        {
            return true;
        }
    }

    return false;
}

/**
 * Migrates a single YAML file in-memory.
 *
 * @param filePath - Absolute path to the file.
 * @returns The change record, or null if the file has no holotype blocks.
 */
function migrateFile(filePath: string): FileChange | null
{
    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split("\n");

    const change: FileChange = {
        filePath,
        migrations: [],
        alreadyMigrated: 0,
        skipped: [],
    };

    for (let index = 0; index < lines.length; index += 1)
    {
        const line = lines[index];
        const match = line.match(/^(\s*)specimen_id:\s*(.*)$/);

        if (!match)
        {
            continue;
        }

        const indent = match[1];
        const rawValue = match[2].trimEnd();

        if (rawValue.startsWith("["))
        {
            change.alreadyMigrated += 1;
            continue;
        }

        if (rawValue.length === 0)
        {
            change.skipped.push({
                lineNumber: index + 1,
                reason: "empty scalar",
                line,
            });
            continue;
        }

        let parsed: string;

        try
        {
            parsed = parseScalarValue(rawValue);
        }
        catch (error)
        {
            change.skipped.push({
                lineNumber: index + 1,
                reason: `parse error: ${(error as Error).message}`,
                line,
            });
            continue;
        }

        const newSpecimenLine = `${indent}specimen_id: [${renderFlowScalar(parsed)}]`;
        const hasType = holotypeBlockHasSpecimenType(lines, index);
        const insertedTypeLine = hasType ? "" : `${indent}specimen_type: holotype`;

        change.migrations.push({
            lineNumber: index + 1,
            before: line,
            afterSpecimenLine: newSpecimenLine,
            insertedTypeLine,
        });
    }

    if (change.migrations.length === 0 && change.alreadyMigrated === 0 && change.skipped.length === 0)
    {
        return null;
    }

    return change;
}

/**
 * Applies a file change: rewrites the `specimen_id` line and inserts
 * `specimen_type: holotype` immediately after it when missing.
 *
 * @param change - The change record produced by `migrateFile`.
 */
function applyFileChange(change: FileChange): void
{
    const source = fs.readFileSync(change.filePath, "utf8");
    const lines = source.split("\n");

    // Apply from bottom to top so earlier line indices remain stable.
    const sortedMigrations = [...change.migrations].sort(
        (left, right) => right.lineNumber - left.lineNumber,
    );

    for (const migration of sortedMigrations)
    {
        const index = migration.lineNumber - 1;
        lines[index] = migration.afterSpecimenLine;

        if (migration.insertedTypeLine.length > 0)
        {
            lines.splice(index + 1, 0, migration.insertedTypeLine);
        }
    }

    fs.writeFileSync(change.filePath, lines.join("\n"), "utf8");
}

const files = walkYaml(generaDir);
const changes: Array<FileChange> = [];

for (const filePath of files)
{
    const change = migrateFile(filePath);

    if (change !== null)
    {
        changes.push(change);
    }
}

let totalMigrations = 0;
let totalAlreadyMigrated = 0;
const allSkipped: Array<{ filePath: string; lineNumber: number; reason: string; line: string }> = [];

for (const change of changes)
{
    totalMigrations += change.migrations.length;
    totalAlreadyMigrated += change.alreadyMigrated;

    for (const skip of change.skipped)
    {
        allSkipped.push({ filePath: change.filePath, ...skip });
    }
}

console.log(`Files scanned:       ${files.length}`);
console.log(`Files with holotype: ${changes.length}`);
console.log(`Migrations planned:  ${totalMigrations}`);
console.log(`Already migrated:    ${totalAlreadyMigrated}`);
console.log(`Skipped:             ${allSkipped.length}`);

if (allSkipped.length > 0)
{
    console.log("\n=== Skipped ===");

    for (const entry of allSkipped)
    {
        const relative = path.relative(root, entry.filePath);
        console.log(`  ${relative}:${entry.lineNumber} [${entry.reason}]`);
        console.log(`    ${entry.line}`);
    }
}

if (!apply)
{
    console.log("\nDry run. Re-run with --apply to write YAML files.");
    console.log("\n=== Sample changes (first 5 files) ===");

    for (const change of changes.slice(0, 5))
    {
        const relative = path.relative(root, change.filePath);
        console.log(`\n${relative}:`);

        for (const migration of change.migrations)
        {
            console.log(`  L${migration.lineNumber}:`);
            console.log(`    -${migration.before}`);
            console.log(`    +${migration.afterSpecimenLine}`);

            if (migration.insertedTypeLine.length > 0)
            {
                console.log(`    +${migration.insertedTypeLine}`);
            }
        }
    }

    process.exit(0);
}

console.log(`\nApplying ${totalMigrations} migrations across ${changes.length} files...`);

for (const change of changes)
{
    if (change.migrations.length > 0)
    {
        applyFileChange(change);
    }
}

console.log("Done.");
