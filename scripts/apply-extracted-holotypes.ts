/**
 * One-off: apply high-confidence holotype extractions from the Sonnet
 * agent pass to genera YAML files.
 *
 * Reads a JSON file with the shape produced by the extraction agents
 * (`high_confidence`, `low_confidence`, `none` buckets). Only the
 * `high_confidence` bucket is touched.
 *
 * Each entry must already have:
 *   - genus
 *   - specimen_id (Array<string>, length matching specimen_type rules)
 *   - specimen_type (one of: holotype, syntype, lectotype, neotype, unknown)
 *   - institution
 *   - material (optional)
 *
 * The script appends a holotype block immediately before the species'
 * end-of-entry boundary, mirroring the text-insertion approach used by
 * the sauropodomorph backfill script.
 *
 * Usage:
 *   node --experimental-strip-types scripts/apply-extracted-holotypes.ts <path-to-json> [--apply]
 *
 * Without `--apply` runs in dry-run mode and prints proposed changes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");

const jsonPath = process.argv[2];
const apply = process.argv.includes("--apply");

if (typeof jsonPath !== "string" || jsonPath.length === 0)
{
    console.error("Usage: apply-extracted-holotypes.ts <path-to-json> [--apply]");
    process.exit(1);
}

if (!fs.existsSync(jsonPath))
{
    console.error(`Input file not found: ${jsonPath}`);
    process.exit(1);
}

type HighConfidenceEntry = {
    genus: string;
    specimen_id: Array<string>;
    specimen_type: string;
    institution: string;
    material?: string;
    evidence?: string;
};

type ExtractionFile = {
    high_confidence?: Array<HighConfidenceEntry>;
};

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as ExtractionFile;
const entries = data.high_confidence ?? [];

console.log(`Processing ${entries.length} high-confidence extractions`);

/**
 * Recursively collect all `.yml` files under a directory.
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
 * @returns A YAML double-quoted scalar literal.
 */
function toDoubleQuotedScalar(text: string): string
{
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    return `"${escaped}"`;
}

/**
 * Renders a scalar safe for embedding inside a YAML flow array `[...]`.
 *
 * @param text - The raw string.
 * @returns A YAML scalar literal.
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
 * Renders a scalar suitable for a block-style YAML value (after a key).
 *
 * @param text - The raw string.
 * @returns A YAML scalar literal.
 */
function renderBlockScalar(text: string): string
{
    if (/^[\s#&*!|>%@`'"]/.test(text))
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
 * Finds the end-of-entry line index for a species entry starting at the
 * given `- name: ...` line.
 *
 * @param lines - File lines.
 * @param nameLineIndex - Zero-based index of the `- name: ...` line.
 * @returns Index one past the last line that belongs to this entry.
 */
function findSpeciesEntryEnd(lines: Array<string>, nameLineIndex: number): number
{
    const dashMatch = lines[nameLineIndex].match(/^(\s*)-\s/);

    if (!dashMatch)
    {
        throw new Error(`Expected list item at line ${nameLineIndex + 1}`);
    }

    const itemIndentWidth = dashMatch[1].length;

    for (let index = nameLineIndex + 1; index < lines.length; index += 1)
    {
        const line = lines[index];

        if (line.length === 0)
        {
            continue;
        }

        const leading = line.match(/^(\s*)/);
        const leadingWidth = leading ? leading[1].length : 0;

        if (leadingWidth <= itemIndentWidth)
        {
            return index;
        }
    }

    return lines.length;
}

/**
 * Locates the file containing a genus.
 *
 * @param files - Candidate YAML file paths.
 * @param genusName - The genus name.
 * @returns The matching file path, or null.
 */
function findGenusFile(files: Array<string>, genusName: string): string | null
{
    const target = `${genusName}.yml`;

    for (const filePath of files)
    {
        if (path.basename(filePath) === target)
        {
            return filePath;
        }
    }

    return null;
}

/**
 * Validates the schema rules for an entry before applying.
 *
 * @param entry - The high-confidence entry.
 * @returns An error message if invalid, or null when valid.
 */
function validateEntry(entry: HighConfidenceEntry): string | null
{
    if (!Array.isArray(entry.specimen_id) || entry.specimen_id.length === 0)
    {
        return "specimen_id must be a non-empty array";
    }

    const allowedTypes = new Set(["holotype", "syntype", "lectotype", "neotype", "unknown"]);

    if (!allowedTypes.has(entry.specimen_type))
    {
        return `invalid specimen_type '${entry.specimen_type}'`;
    }

    if (entry.specimen_type === "syntype" && entry.specimen_id.length < 2)
    {
        return "syntype requires at least 2 specimen IDs";
    }

    const singleTypes = new Set(["holotype", "lectotype", "neotype"]);

    if (singleTypes.has(entry.specimen_type) && entry.specimen_id.length !== 1)
    {
        return `${entry.specimen_type} requires exactly 1 specimen ID`;
    }

    if (typeof entry.institution !== "string" || entry.institution.length === 0)
    {
        return "institution must be a non-empty string";
    }

    return null;
}

const yamlFiles = walkYaml(generaDir);

type PlannedChange = {
    entry: HighConfidenceEntry;
    filePath: string;
    insertAt: number;
    newLines: Array<string>;
};

const planned: Array<PlannedChange> = [];
const errors: Array<{ genus: string; reason: string }> = [];

for (const entry of entries)
{
    const validationError = validateEntry(entry);

    if (validationError !== null)
    {
        errors.push({ genus: entry.genus, reason: validationError });
        continue;
    }

    const filePath = findGenusFile(yamlFiles, entry.genus);

    if (filePath === null)
    {
        errors.push({ genus: entry.genus, reason: "genus file not found" });
        continue;
    }

    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split("\n");

    // Find the type species (or first species) line.
    let nameLineIndex = -1;
    let dashMatch: RegExpMatchArray | null = null;

    for (let index = 0; index < lines.length; index += 1)
    {
        const match = lines[index].match(/^(\s*)-\s+name:\s+/);

        if (match)
        {
            nameLineIndex = index;
            dashMatch = match;
            break;
        }
    }

    if (nameLineIndex === -1 || dashMatch === null)
    {
        errors.push({ genus: entry.genus, reason: "could not find species `- name:` entry" });
        continue;
    }

    // Check for an existing holotype block in the entry.
    const fieldIndent = " ".repeat(dashMatch[1].length + 2);
    const nestedIndent = " ".repeat(dashMatch[1].length + 4);
    const endIndex = findSpeciesEntryEnd(lines, nameLineIndex);
    let hasHolotype = false;

    for (let index = nameLineIndex + 1; index < endIndex; index += 1)
    {
        if (lines[index] === fieldIndent + "holotype:")
        {
            hasHolotype = true;
            break;
        }
    }

    if (hasHolotype)
    {
        errors.push({ genus: entry.genus, reason: "species already has a holotype block" });
        continue;
    }

    const newLines: Array<string> = [];
    newLines.push(fieldIndent + "holotype:");

    if (entry.specimen_id.length === 1)
    {
        newLines.push(nestedIndent + "specimen_id: [" + renderFlowScalar(entry.specimen_id[0]) + "]");
    }
    else
    {
        newLines.push(nestedIndent + "specimen_id:");

        for (const id of entry.specimen_id)
        {
            newLines.push(nestedIndent + "  - " + renderBlockScalar(id));
        }
    }

    newLines.push(nestedIndent + "specimen_type: " + entry.specimen_type);
    newLines.push(nestedIndent + "institution: " + renderBlockScalar(entry.institution));

    if (entry.material !== undefined && entry.material.length > 0)
    {
        newLines.push(nestedIndent + "material: " + renderBlockScalar(entry.material));
    }

    planned.push({
        entry,
        filePath,
        insertAt: endIndex,
        newLines,
    });
}

console.log("");
console.log(`Planned changes: ${planned.length}`);
console.log(`Errors:          ${errors.length}`);

if (errors.length > 0)
{
    console.log("");
    console.log("=== Errors ===");

    for (const error of errors)
    {
        console.log(`  ${error.genus}: ${error.reason}`);
    }
}

if (!apply)
{
    console.log("");
    console.log("Dry run. Re-run with --apply to write YAML files.");
    process.exit(0);
}

console.log("");
console.log("Applying changes...");

// Apply per-file, bottom-up so earlier line numbers stay stable.
const byFile = new Map<string, Array<PlannedChange>>();

for (const change of planned)
{
    const list = byFile.get(change.filePath) ?? [];
    list.push(change);
    byFile.set(change.filePath, list);
}

for (const [filePath, changes] of byFile.entries())
{
    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split("\n");

    changes.sort((left, right) => right.insertAt - left.insertAt);

    for (const change of changes)
    {
        lines.splice(change.insertAt, 0, ...change.newLines);
    }

    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

console.log(`Done. Wrote ${planned.length} holotype blocks across ${byFile.size} files.`);
