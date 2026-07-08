// Strip specimen catalog tokens from extraction `holotype_material`
// fields. The catalog number is already stored as a structured field
// (`species.type_specimen.specimen_id`) and the institution abbreviation
// is stored separately (`species.type_specimen.institution` →
// `institutions.yaml`), so its presence in the free-text `material`
// description is redundant.
//
// Three patterns are recognised:
//
//   - Parenthetical:    "Almost complete skull (TMP 2001.26.1), lower..."
//                       — strip "(TMP 2001.26.1)"
//   - Leading prefix:   "YPM 2195: associated partial skeleton..."
//                       — strip "YPM 2195: " and re-capitalise
//   - Mid-segment:      "...hind limbs; PIN #3907/1; Udan-Sayr..."
//                       — strip the segment and collapse delimiters
//
// In all cases an institution abbreviation must be drawn from
// `institutions.yaml` (canonical key or alias) and at least one
// digit must appear in the catalog token, to avoid stripping
// unrelated parentheticals like "(Upper Cretaceous)" or "(II–IV)".
//
// Defaults to dry-run: prints before/after for each affected entry.
// Pass --apply to write changes back.
//
// Usage:
//   npm run strip-specimen-ids -- --letter A
//   npm run strip-specimen-ids -- --letter A --apply

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import type { InstitutionEntry } from "./types.ts";
import { parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const reportsDir = path.join(root, "reports");

/**
 * Escapes a string for embedding in a RegExp literal.
 *
 * @param input - Source string.
 * @returns Regex-safe escaped string.
 */
function escapeForRegExp(input: string): string
{
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Loads `institutions.yaml` and returns the union of canonical
 * abbreviations and their aliases. Filters out abbreviations shorter
 * than 3 characters to avoid matching incidental capitalised tokens
 * in prose.
 *
 * @returns Set of institution abbreviation strings.
 */
function loadInstitutionAbbreviations(): Set<string>
{
    const institutions = parseYaml<Record<string, InstitutionEntry>>(path.join(root, "institutions.yaml"));
    const abbreviations = new Set<string>();

    for (const [key, entry] of Object.entries(institutions))
    {
        if (key.length >= 3)
        {
            abbreviations.add(key);
        }

        if (Array.isArray(entry.aliases))
        {
            for (const alias of entry.aliases)
            {
                if (typeof alias === "string" && alias.length >= 3)
                {
                    abbreviations.add(alias);
                }
            }
        }
    }

    return abbreviations;
}

/**
 * Cleans up whitespace and dangling punctuation introduced by
 * stripping a token mid-string. Capitalises the leading ASCII letter
 * when the strip removed the original sentence start.
 *
 * @param input - Material text after a strip pass.
 * @returns Cleaned-up text.
 */
function tidyAfterStrip(input: string): string
{
    let result = input;

    // Collapse runs of whitespace introduced by stripping parentheticals.
    result = result.replace(/\s+/g, " ");

    // Remove a space sitting before terminal punctuation: "skull , lower" → "skull, lower".
    result = result.replace(/ +([,.;:])/g, "$1");

    // Collapse adjacent delimiters left behind by mid-segment strips:
    // "...limbs; ; Udan..." → "...limbs; Udan...".
    result = result.replace(/([;,])\s*(?=[;,])/g, "");

    // Remove a stray leading/trailing delimiter or space.
    result = result.replace(/^[\s,;]+/, "").replace(/[\s,;]+$/, (match) =>
    {
        // Preserve a final period if present at the end of the trailing match.
        return match.includes(".") ? "." : "";
    });

    result = result.trim();

    if (result.length > 0 && /[a-z]/.test(result[0]))
    {
        result = result[0].toUpperCase() + result.slice(1);
    }

    return result;
}

/**
 * Strips specimen catalog tokens from a material string using the
 * supplied institution abbreviation set.
 *
 * @param material - Original material string.
 * @param abbreviations - Recognised institution abbreviations.
 * @returns Updated string and a boolean indicating whether any change was made.
 */
function stripCatalogTokens(material: string, abbreviations: Set<string>): { material: string; changed: boolean }
{
    if (abbreviations.size === 0)
    {
        return { material, changed: false };
    }

    const abbrevPattern = [...abbreviations].map(escapeForRegExp).join("|");
    let working = material;

    // Pattern 1: parenthetical containing INST and at least one digit.
    // "(TMP 2001.26.1)", "(MGUAN-PA-003)", "(MACN PV N51, 53, 34)".
    const parenRegex = new RegExp(
        `\\s*\\((?=[^)]*\\b(?:${abbrevPattern})\\b)(?=[^)]*\\d)[^)]*\\)`,
        "g",
    );
    working = working.replace(parenRegex, "");

    // Pattern 2: leading prefix "<INST> <token>:" optionally with a hash.
    // "YPM 2195: associated partial skeleton" → "associated partial skeleton".
    const leadingRegex = new RegExp(
        `^(?:${abbrevPattern})\\s+#?\\S+\\s*:\\s*`,
        "",
    );
    working = working.replace(leadingRegex, "");

    // Pattern 3: mid-string catalog segment between delimiters.
    // "...; PIN #3907/1; Udan..." → "...;; Udan..." (cleanup collapses delimiters).
    const midSegmentRegex = new RegExp(
        `([;,])\\s*(?:${abbrevPattern})\\s+#?[\\w./-]+\\s*(?=[;,]|$)`,
        "g",
    );
    working = working.replace(midSegmentRegex, "$1");

    const cleaned = tidyAfterStrip(working);

    return { material: cleaned, changed: cleaned !== material };
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

if (!fs.existsSync(extractionsDir))
{
    throw new Error(`No extractions directory at ${extractionsDir}`);
}

const abbreviations = loadInstitutionAbbreviations();
console.log(`Loaded ${abbreviations.size} institution abbreviations from institutions.yaml`);
console.log("");

let touched = 0;

for (const name of fs.readdirSync(extractionsDir).filter((entry) => entry.endsWith(".json")).sort())
{
    const fullPath = path.join(extractionsDir, name);
    const original = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(original) as Record<string, unknown>;
    const notes = typeof parsed.notes === "string" ? parsed.notes : null;

    if (notes !== null && notes.includes("EXTRACTION FAILED"))
    {
        continue;
    }

    if (typeof parsed.holotype_material !== "string")
    {
        continue;
    }

    const { material, changed } = stripCatalogTokens(parsed.holotype_material, abbreviations);

    if (!changed)
    {
        continue;
    }

    touched += 1;

    console.log(`${apply ? "" : "[dry-run] "}${name}:`);
    console.log(`  before: ${parsed.holotype_material}`);
    console.log(`  after:  ${material}`);
    console.log("");

    if (apply)
    {
        parsed.holotype_material = material;
        fs.writeFileSync(fullPath, JSON.stringify(parsed, null, 2) + "\n");
    }
}

console.log(`${apply ? "Updated" : "Would update"} ${touched} file(s).`);
