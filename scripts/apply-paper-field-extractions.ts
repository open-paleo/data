// Apply paper-driven extractions to genus YAML files. Reads each
// `scratch/extractions/<Letter>/<Genus>.json` produced by the Sonnet
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
// Both fields are inserted as text at positions found by parsing the file
// with the `yaml` library and reading each node's source offsets:
//
//   - `diagnostic_features:` at top level, immediately before
//     `identifiers:` (matches Iguanodon / Triceratops / Tyrannosaurus)
//   - `material:` as the last key of the type species's `type_specimen:`
//     map, at that map's own indentation
//
// The parse finds the blocks whatever their indentation or flow style; the
// insertion stays textual because re-printing the parsed document reformats
// most genus files. Field bodies are produced by the `yaml` library on a
// synthetic mini-document, then indented to the target column.
//
// Defaults to dry-run: prints per-genus diffs. Pass --apply to write.
//
// Usage:
//   npm run apply-paper-fields -- --letter A
//   npm run apply-paper-fields -- --letter A --apply

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { isMap, isSeq, parseDocument, stringify as yamlStringify } from "yaml";
import type { Node, YAMLMap } from "yaml";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const reportsDir = path.join(root, "scratch");

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

/**
 * Finds the type species's `type_specimen` map in a parsed genus file: the
 * species marked `type_species: true`, else the first species.
 *
 * @param content - The genus file's text.
 * @returns The block-style `type_specimen` map, or null when the file does not
 *     parse, has no species, the species has no `type_specimen`, or that map is
 *     written in flow style.
 */
function locateTypeSpecimen(content: string): YAMLMap | null
{
    const document = parseDocument(content);

    if (document.errors.length > 0)
    {
        return null;
    }

    const species = document.get("species", true);

    if (!isSeq(species) || species.items.length === 0)
    {
        return null;
    }

    const blocks = species.items.filter((item): item is YAMLMap => isMap(item));
    const typeSpecies = blocks.find((block) => block.get("type_species") === true) ?? blocks[0];
    const typeSpecimen = typeSpecies?.get("type_specimen", true);

    if (!isMap(typeSpecimen) || typeSpecimen.flow || typeSpecimen.items.length === 0)
    {
        return null;
    }

    return typeSpecimen;
}

/**
 * Returns the offset at which a line starts.
 *
 * @param content - The text.
 * @param offset - Any offset on the line.
 * @returns The offset of the line's first character.
 */
function lineStart(content: string, offset: number): number
{
    return content.lastIndexOf("\n", offset - 1) + 1;
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
 * fallbacks. Returns null if the file does not parse or no anchor is found.
 *
 * @param content - Original YAML text.
 * @param bullets - Diagnostic feature bullets.
 * @returns Updated YAML, or null when the field cannot be inserted.
 */
function insertDiagnosticFeatures(content: string, bullets: Array<string>): string | null
{
    const document = parseDocument(content);

    if (document.errors.length > 0 || !isMap(document.contents))
    {
        return null;
    }

    for (const anchor of ["identifiers", "species", "references"])
    {
        const pair = document.contents.items.find((item) => (item.key as Node | null)?.toJSON?.() === anchor);
        const keyStart = (pair?.key as Node | undefined)?.range?.[0];

        if (keyStart !== undefined)
        {
            const position = lineStart(content, keyStart);

            return content.slice(0, position) + renderField("diagnostic_features", bullets, 0) + content.slice(position);
        }
    }

    return null;
}

/**
 * Inserts `material:` as the last key of the type species's `type_specimen`
 * map, at that map's indentation. Returns null when there is no block-style
 * `type_specimen` map to insert into.
 *
 * @param content - Original YAML text.
 * @param value - Material text.
 * @returns Updated YAML, or null when the field cannot be inserted.
 */
function insertHolotypeMaterial(content: string, value: string): { content: string; alreadyPresent: boolean } | null
{
    const typeSpecimen = locateTypeSpecimen(content);

    if (typeSpecimen === null)
    {
        return null;
    }
    else if (typeSpecimen.has("material"))
    {
        return { content, alreadyPresent: true };
    }

    const firstKeyStart = (typeSpecimen.items[0].key as Node).range![0];
    const indent = firstKeyStart - lineStart(content, firstKeyStart);
    const lastPair = typeSpecimen.items[typeSpecimen.items.length - 1];
    const lastNode = (lastPair.value ?? lastPair.key) as Node;
    const valueEnd = lastNode.range![1];

    // A block scalar's value ends after its own newline; a plain or flow value
    // ends mid-line, so the field goes on the line after it.
    const position = content[valueEnd - 1] === "\n"
        ? valueEnd
        : (content.indexOf("\n", valueEnd) + 1 || content.length);
    const prefix = position === content.length && !content.endsWith("\n") ? "\n" : "";

    return {
        content: content.slice(0, position) + prefix + renderField("material", value, indent) + content.slice(position),
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
