// Spell-checks the prose fields of the dataset and writes a triage report.
//
// The fields are the ones the validator's prose checks read (`proseFields` in
// validate/context.ts): descriptions, notes, etymologies, diagnostic features
// and the like, across genera, clades, the reference store, the stratigraphy
// registry and the institution and region registries. Identifiers, enum
// values, specimen numbers, pronunciations and names are not prose and are not
// checked. Within a field, double-quoted spans are skipped, since a quotation
// keeps its source's spelling, and so are words in a non-Latin script, which
// the English dictionaries cannot judge.
//
// Each unknown word is either missing from the dictionaries (add it to
// dictionaries/paleo-vocab.txt, or teach scripts/generate-dictionary.ts the
// source it comes from) or wrong in the data (fix the record).
//
// Output: scratch/spellcheck.md, one checklist line per unknown word with its
// suggestions and where it occurs, and scratch/spellcheck.json with every
// occurrence.
//
// Usage:
//   npm run spellcheck

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { loadValidationContext } from "./validate/context.ts";

/**
 * One place an unknown word occurs.
 */
type Occurrence = {
    /**
     * File the field is in, relative to the repository root.
     */
    file: string;

    /**
     * Dotted path to the field.
     */
    fieldPath: string;

    /**
     * The text around the word, as cspell saw it.
     */
    snippet: string;
};

/**
 * A word no dictionary knows, with everywhere it occurs.
 */
type UnknownWord = {
    /**
     * The word as written.
     */
    word: string;

    /**
     * Every occurrence, in field order.
     */
    occurrences: Array<Occurrence>;

    /**
     * cspell's closest dictionary words, best first.
     */
    suggestions: Array<string>;
};

/**
 * How many occurrences the Markdown report lists under each word; the JSON
 * report has them all.
 */
const listedOccurrences = 3;

/**
 * Characters of context on each side of a word in a snippet.
 */
const snippetRadius = 50;

/**
 * Runs the cspell CLI with the repository's configuration.
 *
 * @param root - Repository root, where cspell.json lives.
 * @param cspellArguments - Arguments after `cspell`.
 * @param input - Text piped to cspell's standard input.
 * @returns cspell's standard output.
 */
function runCspell(root: string, cspellArguments: Array<string>, input: string): string
{
    const result = spawnSync(
        "npx",
        ["cspell", ...cspellArguments],
        { input, encoding: "utf8", cwd: root, maxBuffer: 256 * 1024 * 1024 },
    );

    // cspell exits 1 when it finds unknown words; anything else is a failure.
    if (result.status !== 0 && result.status !== 1)
    {
        console.error(result.stderr);
        throw new Error(`cspell failed with status ${result.status}`);
    }

    return result.stdout;
}

/**
 * Reduces a prose field to the text cspell should judge: double-quoted spans
 * (the spans the validator's `stripQuotedSpans` removes), non-Latin script and
 * line breaks become spaces, so that each field is one line of cspell's input.
 * Every character is replaced one for one, so a column cspell reports is also
 * a position in the field's own text.
 *
 * @param text - The field's text.
 * @returns The text to check.
 */
function prepareText(text: string): string
{
    return text
        .replace(/"[^"]*"/g, (span) => " ".repeat(span.length))
        .replace(/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/gu, (character) => " ".repeat(character.length))
        .replace(/\s/g, " ");
}

/**
 * Reads the suggestions cspell prints for a list of words: each word on its
 * own line ending in a colon, then one ` - suggestion` line per suggestion.
 *
 * @param root - Repository root.
 * @param words - The words to look up.
 * @returns Suggestions keyed by word.
 */
function suggestionsFor(root: string, words: Array<string>): Map<string, Array<string>>
{
    const suggestions = new Map<string, Array<string>>();
    const output = runCspell(
        root,
        ["suggestions", "--stdin", "--num-suggestions", "3", "--no-include-ties"],
        words.join("\n") + "\n",
    );
    let current: Array<string> | null = null;

    for (const line of output.split("\n"))
    {
        const suggestion = line.match(/^\s+-\s+(\S+)/);

        if (suggestion && current)
        {
            current.push(suggestion[1]);
        }
        else if (line.endsWith(":"))
        {
            current = [];
            suggestions.set(line.slice(0, -1).trim(), current);
        }
    }

    return suggestions;
}

const context = loadValidationContext();
const { root, proseFields } = context;
const inputLines = proseFields.map((field) => prepareText(field.text));
const unknownWords = new Map<string, UnknownWord>();

for (const line of runCspell(root, ["stdin", "--no-progress", "--no-summary", "--no-color"], inputLines.join("\n") + "\n").split("\n"))
{
    // cspell's stdin report: ":LINE:COLUMN - Unknown word (WORD)".
    const match = line.match(/^(?:stdin)?:(\d+):(\d+)\s*-\s*Unknown word \(([^)]+)\)/);

    if (match)
    {
        const index = Number.parseInt(match[1], 10) - 1;
        const column = Number.parseInt(match[2], 10) - 1;
        const word = match[3];
        const field = proseFields[index];
        const text = field.text;
        const start = Math.max(0, column - snippetRadius);
        const end = Math.min(text.length, column + word.length + snippetRadius);
        const snippet = `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
        const entry = unknownWords.get(word) ?? { word, occurrences: new Array<Occurrence>(), suggestions: new Array<string>() };

        entry.occurrences.push({ file: path.relative(root, field.filePath), fieldPath: field.fieldPath, snippet });
        unknownWords.set(word, entry);
    }
}

const suggestions = suggestionsFor(root, [...unknownWords.keys()]);

for (const entry of unknownWords.values())
{
    entry.suggestions = suggestions.get(entry.word) ?? [];
}

const sorted = [...unknownWords.values()].sort((left, right) =>
    right.occurrences.length - left.occurrences.length || left.word.localeCompare(right.word));
const occurrenceCount = sorted.reduce((total, entry) => total + entry.occurrences.length, 0);
const fieldCount = new Set(sorted.flatMap((entry) => entry.occurrences.map((occurrence) => `${occurrence.file}#${occurrence.fieldPath}`))).size;
const summary = `${sorted.length} unknown words, ${occurrenceCount} occurrences in ${fieldCount} of ${proseFields.length} prose fields.`;
const reportLines = [
    "# Spelling report",
    "",
    `Generated ${new Date().toISOString()} by \`npm run spellcheck\`. ${summary}`,
    "",
    "Each word is either missing from the dictionaries (add it to `dictionaries/paleo-vocab.txt`, or to the source `scripts/generate-dictionary.ts` reads) or wrong in the data (fix the record). Words are listed most frequent first.",
    "",
];

for (const entry of sorted)
{
    const suggested = entry.suggestions.length > 0 ? ` — suggestions: ${entry.suggestions.join(", ")}` : "";

    reportLines.push(`- [ ] **${entry.word}** (${entry.occurrences.length})${suggested}`);

    for (const occurrence of entry.occurrences.slice(0, listedOccurrences))
    {
        reportLines.push(`  - \`${occurrence.file}\` ${occurrence.fieldPath}: ${occurrence.snippet}`);
    }

    if (entry.occurrences.length > listedOccurrences)
    {
        reportLines.push(`  - and ${entry.occurrences.length - listedOccurrences} more`);
    }
}

const scratchDirectory = path.join(root, "scratch");

fs.mkdirSync(scratchDirectory, { recursive: true });
fs.writeFileSync(path.join(scratchDirectory, "spellcheck.md"), reportLines.join("\n") + "\n");
fs.writeFileSync(path.join(scratchDirectory, "spellcheck.json"), JSON.stringify(sorted, null, 2) + "\n");

console.log(summary);
console.log("Report: scratch/spellcheck.md (all occurrences in scratch/spellcheck.json)");
