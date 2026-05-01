// Run cspell against the holotype_material and diagnostic_features
// fields produced by the paper-driven backfill flow. Surfaces unknown
// words so the reviewer can sort them into:
//
//   - real paleontological/anatomical terms missing from the project
//     dictionary (add to scripts/generate-dictionary.ts commonTerms),
//   - OCR artifacts or typos (fix the affected extraction by hand),
//   - normal English words missing from the project dict (add to dict).
//
// Output: reports/extracted-paper-fields-<Letter>-spellcheck.md
//   Listing each unknown word, total occurrences, and which genera
//   surfaced it. Sorted by frequency ascending so rare-and-suspicious
//   words rise to the top.
//
// Sentinel "EXTRACTION FAILED" records are skipped.
//
// Usage:
//   npm run spellcheck-extractions -- --letter A

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const reportsDir = path.join(root, "reports");

/**
 * Parses CLI flags. Supports `--letter <X>`.
 *
 * @param argv - process.argv slice.
 * @returns Parsed arguments.
 */
function parseArguments(argv: Array<string>): { letter: string }
{
    let letter: string | null = null;

    for (let index = 0; index < argv.length; index += 1)
    {
        const flag = argv[index];

        if (flag === "--letter")
        {
            letter = argv[index + 1] ?? null;
            index += 1;
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

    return { letter: letter.toUpperCase() };
}

const { letter } = parseArguments(process.argv.slice(2));

const extractionsDir = path.join(reportsDir, "extractions", letter);

if (!fs.existsSync(extractionsDir))
{
    throw new Error(`No extractions directory at ${extractionsDir}`);
}

type Snippet = {
    genus: string;
    field: "holotype_material" | "diagnostic_features";
    text: string;
};

const snippets: Array<Snippet> = [];

for (const name of fs.readdirSync(extractionsDir).filter((n) => n.endsWith(".json")).sort())
{
    const parsed = JSON.parse(fs.readFileSync(path.join(extractionsDir, name), "utf8")) as Record<string, unknown>;
    const notes = typeof parsed.notes === "string" ? parsed.notes : null;

    if (notes !== null && notes.includes("EXTRACTION FAILED"))
    {
        continue;
    }

    const genus = path.basename(name, ".json");

    if (typeof parsed.holotype_material === "string" && parsed.holotype_material.length > 0)
    {
        snippets.push({ genus, field: "holotype_material", text: parsed.holotype_material });
    }

    if (Array.isArray(parsed.diagnostic_features))
    {
        for (const bullet of parsed.diagnostic_features)
        {
            if (typeof bullet === "string" && bullet.length > 0)
            {
                snippets.push({ genus, field: "diagnostic_features", text: bullet });
            }
        }
    }
}

// Marker prefix on each line so we can map cspell's row number back to
// the originating snippet without having to re-tokenize on this side.
const inputLines = snippets.map((snippet, index) => `[${index}] ${snippet.text}`);
const cspellInput = inputLines.join("\n") + "\n";

const result = spawnSync(
    "npx",
    ["cspell", "stdin", "--no-progress", "--no-summary", "--unique", "--no-color"],
    { input: cspellInput, encoding: "utf8", cwd: root },
);

if (result.status !== 0 && result.status !== 1)
{
    // cspell exits 1 when issues are found, 0 when clean. Anything else
    // is a real error.
    console.error(result.stderr);
    throw new Error(`cspell failed with status ${result.status}`);
}

const stdout = result.stdout;

type Unknown = {
    word: string;
    occurrences: number;
    genera: Set<string>;
};

const unknowns = new Map<string, Unknown>();

for (const line of stdout.split("\n"))
{
    if (line.length === 0)
    {
        continue;
    }

    // cspell stdin output format (with or without "stdin:" prefix
    // depending on the cspell version):
    //   :LINE:COL - Unknown word (WORD)
    //   stdin:LINE:COL - Unknown word (WORD)
    const match = line.match(/^(?:stdin)?:(\d+):\d+\s*-\s*Unknown word \(([^)]+)\)/);

    if (match === null)
    {
        continue;
    }

    const lineNumber = Number.parseInt(match[1], 10);
    const word = match[2];
    const sourceLine = inputLines[lineNumber - 1];
    const indexMatch = sourceLine?.match(/^\[(\d+)\]/);

    if (indexMatch === undefined || indexMatch === null)
    {
        continue;
    }

    const snippet = snippets[Number.parseInt(indexMatch[1], 10)];

    if (snippet === undefined)
    {
        continue;
    }

    const existing = unknowns.get(word);

    if (existing === undefined)
    {
        unknowns.set(word, { word, occurrences: 1, genera: new Set([snippet.genus]) });
    }
    else
    {
        existing.occurrences += 1;
        existing.genera.add(snippet.genus);
    }
}

/**
 * Heuristic check for words that look more like OCR garbage or typos
 * than legitimate paleontological terms. Flags:
 *
 *   - any digit inside the word ("AnoI>losaurus", "Sl3daon")
 *   - any character that is neither a Unicode letter nor a hyphen
 *     ("Slc>aon", "ano_X") — hyphens are kept since legitimate
 *     compound terms (post-orbital, antero-medial) include them
 *   - mixed-case patterns in the middle (lowercase followed by
 *     uppercase, e.g. "AnoIlosaurus"), excluding plain CamelCase
 *     starts and TLA-style runs of capitals
 *
 * Note: words containing diacritics (Université, Neuquén) are NOT
 * flagged — non-ASCII letters are treated the same as ASCII letters.
 *
 * @param word - Candidate unknown word.
 * @returns True when the word looks suspicious by shape.
 */
function looksSuspicious(word: string): boolean
{
    if (/\d/.test(word))
    {
        return true;
    }

    if (/[^\p{L}-]/u.test(word))
    {
        return true;
    }

    if (/\p{Ll}\p{Lu}/u.test(word))
    {
        return true;
    }

    return false;
}

type Bucket = "suspicious" | "term";

function classify(unknown: Unknown): Bucket
{
    return looksSuspicious(unknown.word) ? "suspicious" : "term";
}

const buckets = new Map<Bucket, Array<Unknown>>([
    ["suspicious", []],
    ["term", []],
]);

for (const unknown of unknowns.values())
{
    buckets.get(classify(unknown))!.push(unknown);
}

for (const list of buckets.values())
{
    list.sort((left, right) =>
    {
        if (left.occurrences !== right.occurrences)
        {
            return right.occurrences - left.occurrences;
        }

        return left.word.localeCompare(right.word);
    });
}

const lines = new Array<string>();

lines.push(`# Letter ${letter} extraction spell-check`);
lines.push("");
lines.push(`Snippets scanned: ${snippets.length}`);
lines.push(`Distinct unknown words: ${unknowns.size}`);
lines.push(`  - Suspicious shape (flagged for review): ${buckets.get("suspicious")!.length}`);
lines.push(`  - Likely real terms (review for dictionary): ${buckets.get("term")!.length}`);
lines.push("");
lines.push("**Suspicious shape** — words containing digits, non-alphabetic");
lines.push("characters, or mixed-case patterns in the middle. These are the");
lines.push("most likely OCR artifacts or typos. Spot-check the source paper");
lines.push("for each one before accepting the extraction.");
lines.push("");
lines.push("**Likely real terms** — anything not flagged as suspicious. These");
lines.push("are typically legitimate paleo / anatomical terms missing from the");
lines.push("project dictionary. Triage and add to `commonTerms` in");
lines.push("`scripts/generate-dictionary.ts`.");
lines.push("");
lines.push("Each section is sorted by occurrence count descending, then alphabetically.");
lines.push("");
lines.push("## Suspicious shape");
lines.push("");

if (buckets.get("suspicious")!.length === 0)
{
    lines.push("_none_");
}
else
{
    lines.push("| Word | Occurrences | Genera |");
    lines.push("|---|---:|---|");

    for (const entry of buckets.get("suspicious")!)
    {
        const genera = [...entry.genera].sort().join(", ");
        lines.push(`| \`${entry.word}\` | ${entry.occurrences} | ${genera} |`);
    }
}

lines.push("");
lines.push("## Likely real terms");
lines.push("");

if (buckets.get("term")!.length === 0)
{
    lines.push("_none_");
}
else
{
    lines.push("| Word | Occurrences | Genera |");
    lines.push("|---|---:|---|");

    for (const entry of buckets.get("term")!)
    {
        const genera = [...entry.genera].sort().join(", ");
        lines.push(`| \`${entry.word}\` | ${entry.occurrences} | ${genera} |`);
    }
}

const outputPath = path.join(reportsDir, `extracted-paper-fields-${letter}-spellcheck.md`);
fs.writeFileSync(outputPath, lines.join("\n") + "\n");

console.log(`Scanned ${snippets.length} snippets`);
console.log(`Found ${unknowns.size} distinct unknown word(s) (${buckets.get("suspicious")!.length} suspicious, ${buckets.get("term")!.length} likely terms)`);
console.log(`Wrote ${path.relative(root, outputPath)}`);
