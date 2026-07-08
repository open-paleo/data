// Apply paper-driven extractions to genus YAML files. Reads each
// `reports/extractions/<Letter>/<Genus>.json` produced by the Sonnet
// extraction agent and writes its `holotype_material` and
// `diagnostic_features` into the matching `genera/<Letter>/<Genus>.yml`.
//
// Filters before any write:
//
//   - skip records whose `notes` field contains "EXTRACTION FAILED"
//   - skip records whose `paper_quality` is "review" or "popular"
//     (the corpus-side citation is wrong — issue #1863 — and the
//     extracted data is suspect)
//   - skip records with no usable data (both fields null/empty)
//   - skip per-field if the YAML already has it populated
//
// Translations are applied — the holotype/diagnosis content of a
// formal description survives translation.
//
// The rewrite is string-level. Both fields are inserted at canonical
// positions found by line scanning:
//
//   - `diagnostic_features:` at top level, immediately before
//     `identifiers:` (matches Iguanodon / Triceratops / Tyrannosaurus)
//   - `material:` inside the type species's `type_specimen:` block, after
//     `institution:`
//
// Field bodies are produced by the `yaml` library on a synthetic
// mini-document, then indented to the target column. This keeps long
// values folded correctly without round-tripping the rest of the file
// through the YAML parser.
//
// Defaults to dry-run: prints per-genus diffs. Pass --apply to write.
//
// Usage:
//   npm run apply-paper-fields -- --letter A
//   npm run apply-paper-fields -- --letter A --apply

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { stringify as yamlStringify } from "yaml";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const reportsDir = path.join(root, "reports");

type Extraction = {
    genus: string;
    species: string;
    described_in: string;
    holotype_material: string | null;
    diagnostic_features: Array<string>;
    binomial_in_paper: string | null;
    paper_quality: string;
    notes: string | null;
};

type SpeciesBlock = {
    /**
     * Inclusive index of the `  - name: <species>` line.
     */
    start: number;

    /**
     * Inclusive index of the last line of the species block.
     */
    end: number;
};

/**
 * Locates the bounds of every species block under the `species:` key.
 * A species block starts at a `  - name:` line and ends at the line
 * before the next `  - name:` or the next top-level key.
 *
 * @param lines - File contents split by line.
 * @returns Array of species block bounds, in document order.
 */
function locateSpeciesBlocks(lines: Array<string>): Array<SpeciesBlock>
{
    let speciesStart = -1;

    for (let index = 0; index < lines.length; index += 1)
    {
        if (lines[index] === "species:")
        {
            speciesStart = index;
            break;
        }
    }

    if (speciesStart < 0)
    {
        return [];
    }

    const blocks = new Array<SpeciesBlock>();
    let currentStart = -1;

    for (let index = speciesStart + 1; index < lines.length; index += 1)
    {
        const line = lines[index];

        // Top-level key terminates the species list.
        if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("-"))
        {
            if (currentStart >= 0)
            {
                blocks.push({ start: currentStart, end: index - 1 });
                currentStart = -1;
            }

            break;
        }

        if (line.startsWith("  - name:"))
        {
            if (currentStart >= 0)
            {
                blocks.push({ start: currentStart, end: index - 1 });
            }

            currentStart = index;
        }
    }

    if (currentStart >= 0)
    {
        blocks.push({ start: currentStart, end: lines.length - 1 });
    }

    return blocks;
}

/**
 * Picks the type species block: the one containing
 * `    type_species: true`. Falls back to the first block when no
 * type species is marked.
 *
 * @param lines - File contents split by line.
 * @param blocks - Species blocks from locateSpeciesBlocks.
 * @returns The selected block, or null if no species are present.
 */
function pickRepresentativeSpecies(lines: Array<string>, blocks: Array<SpeciesBlock>): SpeciesBlock | null
{
    if (blocks.length === 0)
    {
        return null;
    }

    for (const block of blocks)
    {
        for (let index = block.start; index <= block.end; index += 1)
        {
            if (lines[index].trim() === "type_species: true")
            {
                return block;
            }
        }
    }

    return blocks[0];
}

/**
 * Locates the type_specimen block within a species block. Returns the
 * inclusive line range from the `    type_specimen:` header through its
 * last child line. Returns null when no type_specimen block is present.
 *
 * @param lines - File contents split by line.
 * @param block - Species block bounds.
 * @returns type_specimen block bounds, or null.
 */
function locateHolotypeBlock(lines: Array<string>, block: SpeciesBlock): SpeciesBlock | null
{
    let holotypeStart = -1;

    for (let index = block.start; index <= block.end; index += 1)
    {
        if (lines[index] === "    type_specimen:")
        {
            holotypeStart = index;
            break;
        }
    }

    if (holotypeStart < 0)
    {
        return null;
    }

    let holotypeEnd = block.end;

    for (let index = holotypeStart + 1; index <= block.end; index += 1)
    {
        const line = lines[index];
        const indent = line.match(/^( *)/)![1].length;

        if (line.length > 0 && indent <= 4)
        {
            holotypeEnd = index - 1;
            break;
        }
    }

    return { start: holotypeStart, end: holotypeEnd };
}

/**
 * Returns true if any line in the holotype block declares `material:`
 * at the expected 6-space indent.
 *
 * @param lines - File contents split by line.
 * @param holotype - Holotype block bounds.
 * @returns Whether material is already populated.
 */
function holotypeHasMaterial(lines: Array<string>, holotype: SpeciesBlock): boolean
{
    for (let index = holotype.start + 1; index <= holotype.end; index += 1)
    {
        if (lines[index].startsWith("      material:"))
        {
            return true;
        }
    }

    return false;
}

/**
 * Renders one YAML field at indent 0, then re-indents every output
 * line by `indent` spaces. The yaml library handles scalar style
 * selection (plain, folded, double-quoted) and line wrapping.
 *
 * @param key - Field name.
 * @param value - Field value.
 * @param indent - Number of leading spaces to add to every output line.
 * @returns Multi-line string ending with a trailing newline.
 */
function renderField(key: string, value: unknown, indent: number): string
{
    const rendered = yamlStringify({ [key]: value }, { lineWidth: 80, indent: 2 });
    const prefix = " ".repeat(indent);

    return rendered
        .split("\n")
        .map((line) => (line.length === 0 ? line : prefix + line))
        .join("\n");
}

/**
 * Inserts a `diagnostic_features` block at the top level, immediately
 * before `identifiers:` (preferred) or `species:` / `references:` as
 * fallbacks. Returns null if no anchor is found.
 *
 * @param content - Original YAML text.
 * @param bullets - Diagnostic feature bullets.
 * @returns Updated YAML, or null when the field cannot be inserted.
 */
function insertDiagnosticFeatures(content: string, bullets: Array<string>): string | null
{
    const anchors = ["\nidentifiers:", "\nspecies:", "\nreferences:"];

    for (const anchor of anchors)
    {
        const position = content.indexOf(anchor);

        if (position >= 0)
        {
            const block = renderField("diagnostic_features", bullets, 0);

            return content.slice(0, position + 1) + block + content.slice(position + 1);
        }
    }

    return null;
}

/**
 * Inserts `material:` at indent 6 inside the type species's holotype
 * block, immediately after the last existing child. Returns null when
 * no holotype block is found.
 *
 * @param content - Original YAML text.
 * @param value - Material text.
 * @returns Updated YAML, or null when the field cannot be inserted.
 */
function insertHolotypeMaterial(content: string, value: string): { content: string; alreadyPresent: boolean } | null
{
    const lines = content.split("\n");
    const speciesBlocks = locateSpeciesBlocks(lines);
    const target = pickRepresentativeSpecies(lines, speciesBlocks);

    if (target === null)
    {
        return null;
    }

    const holotype = locateHolotypeBlock(lines, target);

    if (holotype === null)
    {
        return null;
    }

    if (holotypeHasMaterial(lines, holotype))
    {
        return { content, alreadyPresent: true };
    }

    const block = renderField("material", value, 6);
    const blockLines = block.split("\n").filter((line) => line.length > 0);

    const before = lines.slice(0, holotype.end + 1);
    const after = lines.slice(holotype.end + 1);

    return {
        content: [...before, ...blockLines, ...after].join("\n"),
        alreadyPresent: false,
    };
}

/**
 * Produces a unified-diff–style preview of the change between two
 * versions of a file. Just enough context to eyeball each insertion.
 *
 * @param before - Original content.
 * @param after - Updated content.
 * @returns Multi-line string showing only changed lines and their context.
 */
function previewDiff(before: string, after: string): string
{
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");
    const result = new Array<string>();

    let beforeIndex = 0;
    let afterIndex = 0;

    while (beforeIndex < beforeLines.length || afterIndex < afterLines.length)
    {
        if (beforeLines[beforeIndex] === afterLines[afterIndex])
        {
            beforeIndex += 1;
            afterIndex += 1;
            continue;
        }

        // Detect insertions: scan ahead in `after` to find the next match.
        let foundOffset = -1;

        for (let probe = afterIndex + 1; probe < Math.min(afterIndex + 20, afterLines.length); probe += 1)
        {
            if (afterLines[probe] === beforeLines[beforeIndex])
            {
                foundOffset = probe;
                break;
            }
        }

        if (foundOffset > 0)
        {
            for (let probe = afterIndex; probe < foundOffset; probe += 1)
            {
                result.push(`+ ${afterLines[probe]}`);
            }

            afterIndex = foundOffset;
        }
        else
        {
            // No insertion match — fall through line-by-line.
            result.push(`- ${beforeLines[beforeIndex]}`);
            result.push(`+ ${afterLines[afterIndex]}`);
            beforeIndex += 1;
            afterIndex += 1;
        }
    }

    return result.join("\n");
}

/**
 * Parses CLI flags. Supports `--letter <X>` and `--apply`.
 *
 * @param argv - process.argv slice.
 * @returns Parsed arguments.
 */
function parseArguments(argv: Array<string>): { letter: string; apply: boolean }
{
    let letter: string | null = null;
    let apply = false;

    for (let index = 0; index < argv.length; index += 1)
    {
        const flag = argv[index];

        if (flag === "--letter")
        {
            letter = argv[index + 1] ?? null;
            index += 1;
        }
        else if (flag === "--apply")
        {
            apply = true;
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

    return { letter: letter.toUpperCase(), apply };
}

const { letter, apply } = parseArguments(process.argv.slice(2));

const extractionsDir = path.join(reportsDir, "extractions", letter);
const letterDir = path.join(generaDir, letter);

if (!fs.existsSync(extractionsDir))
{
    throw new Error(`No extractions directory at ${extractionsDir}`);
}

if (!fs.existsSync(letterDir))
{
    throw new Error(`No genera directory at ${letterDir}`);
}

const skippedSentinel = new Array<string>();
const skippedNonPrimary = new Array<{ genus: string; quality: string }>();
const skippedNoData = new Array<string>();
const noYaml = new Array<string>();
const applied = new Array<{ genus: string; fields: Array<string> }>();
const failedInsertion = new Array<{ genus: string; field: string }>();

for (const name of fs.readdirSync(extractionsDir).filter((entry) => entry.endsWith(".json")).sort())
{
    const extractionPath = path.join(extractionsDir, name);
    const extraction = JSON.parse(fs.readFileSync(extractionPath, "utf8")) as Extraction;
    const notes = extraction.notes ?? "";

    if (notes.includes("EXTRACTION FAILED"))
    {
        skippedSentinel.push(extraction.genus);
        continue;
    }

    if (extraction.paper_quality === "review" || extraction.paper_quality === "popular")
    {
        skippedNonPrimary.push({ genus: extraction.genus, quality: extraction.paper_quality });
        continue;
    }

    const hasMaterial = typeof extraction.holotype_material === "string" && extraction.holotype_material.length > 0;
    const hasDiagnostics = Array.isArray(extraction.diagnostic_features) && extraction.diagnostic_features.length > 0;

    if (!hasMaterial && !hasDiagnostics)
    {
        skippedNoData.push(extraction.genus);
        continue;
    }

    const yamlPath = path.join(letterDir, `${extraction.genus}.yml`);

    if (!fs.existsSync(yamlPath))
    {
        noYaml.push(extraction.genus);
        continue;
    }

    const original = fs.readFileSync(yamlPath, "utf8");
    let working = original;
    const appliedFields = new Array<string>();

    if (hasDiagnostics && !/^diagnostic_features:/m.test(working))
    {
        const updated = insertDiagnosticFeatures(working, extraction.diagnostic_features);

        if (updated === null)
        {
            failedInsertion.push({ genus: extraction.genus, field: "diagnostic_features" });
        }
        else
        {
            working = updated;
            appliedFields.push("diagnostic_features");
        }
    }

    if (hasMaterial)
    {
        const result = insertHolotypeMaterial(working, extraction.holotype_material!);

        if (result === null)
        {
            failedInsertion.push({ genus: extraction.genus, field: "type_specimen.material" });
        }
        else if (!result.alreadyPresent)
        {
            working = result.content;
            appliedFields.push("type_specimen.material");
        }
    }

    if (appliedFields.length === 0)
    {
        continue;
    }

    applied.push({ genus: extraction.genus, fields: appliedFields });

    if (apply)
    {
        fs.writeFileSync(yamlPath, working);
    }
    else
    {
        console.log(`[dry-run] ${extraction.genus} (${appliedFields.join(", ")}):`);
        console.log(previewDiff(original, working));
        console.log("");
    }
}

console.log("");
console.log(`${apply ? "Applied" : "Would apply"}: ${applied.length} genera`);
console.log(`Skipped (sentinel):         ${skippedSentinel.length}${skippedSentinel.length > 0 ? " — " + skippedSentinel.join(", ") : ""}`);
console.log(`Skipped (non-primary):      ${skippedNonPrimary.length}${skippedNonPrimary.length > 0 ? " — " + skippedNonPrimary.map((entry) => `${entry.genus} (${entry.quality})`).join(", ") : ""}`);
console.log(`Skipped (no usable data):   ${skippedNoData.length}${skippedNoData.length > 0 ? " — " + skippedNoData.join(", ") : ""}`);
console.log(`No matching YAML:           ${noYaml.length}${noYaml.length > 0 ? " — " + noYaml.join(", ") : ""}`);
console.log(`Insertion failures:         ${failedInsertion.length}${failedInsertion.length > 0 ? " — " + failedInsertion.map((entry) => `${entry.genus}/${entry.field}`).join(", ") : ""}`);
