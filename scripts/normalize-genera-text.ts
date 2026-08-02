// Sweep genera/*/*.yml files for cosmetic non-ASCII characters that
// have ASCII equivalents and either preview or apply the fix. Same
// rules as scripts/normalize-extractions.ts:
//
//   – U+2013 en-dash    → "-"
//   — U+2014 em-dash    → "-"
//   ‘ U+2018, ’ U+2019  → "'"
//   “ U+201C, ” U+201D  → '"'
//
// Other non-ASCII glyphs are left alone — these all carry semantic
// value (°, ×, ², é, è, Greek letters, etc.) or appear in proper
// nouns where they are part of the canonical spelling.
//
// String-level rewrite. The targeted characters never appear in YAML
// structural syntax, so a whole-file replace is safe and preserves
// formatting (indentation, key order, scalar style) verbatim.
//
// Defaults to dry-run mode: emits scratch/genera-text-normalization.md
// summarising every file that would change, with sample contexts.
// Pass --apply to write changes back to disk.
//
// Usage:
//   npm run normalize-genera-text                 (dry run, writes report)
//   npm run normalize-genera-text -- --apply      (writes changes in place)

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { findYamlFiles } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const reportsDir = path.join(root, "scratch");

type Replacement = {
    from: string;
    to: string;
    label: string;
};

const replacements: Array<Replacement> = [
    { from: "–", to: "-", label: "en-dash" },
    { from: "—", to: "-", label: "em-dash" },
    { from: "‘", to: "'", label: "left-single-quote" },
    { from: "’", to: "'", label: "right-single-quote" },
    { from: "“", to: "\"", label: "left-double-quote" },
    { from: "”", to: "\"", label: "right-double-quote" },
];

/**
 * Applies every replacement rule to the given content. Each rule's
 * count is recorded so the report can break down what changed per
 * file.
 *
 * @param content - Raw file contents.
 * @returns Updated content and a per-rule occurrence count.
 */
function normalizeContent(content: string): { content: string; counts: Map<string, number> }
{
    let working = content;
    const counts = new Map<string, number>();

    for (const rule of replacements)
    {
        const before = working;
        working = working.replaceAll(rule.from, rule.to);

        if (working !== before)
        {
            const count = before.length - working.length === 0
                // length-preserving replacement (single-byte source like a non-ASCII single char becomes single ASCII char)
                ? (before.match(new RegExp(escapeForRegExp(rule.from), "gu")) ?? []).length
                : (before.length - working.length) / Math.max(rule.from.length - rule.to.length, 1);

            counts.set(rule.label, count);
        }
    }

    return { content: working, counts };
}

/**
 * Escapes a string for use inside a RegExp literal. The replacement
 * source strings are all single typographic characters so this is
 * defensive only.
 *
 * @param input - Source string.
 * @returns Regex-safe escaped string.
 */
function escapeForRegExp(input: string): string
{
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pulls a small window of context around the first occurrence of the
 * target character so the dry-run report can show what is being
 * changed without dumping whole files.
 *
 * @param content - File content.
 * @param needle - Character to locate.
 * @param windowSize - Characters of context on each side.
 * @returns Trimmed snippet, or null when needle is not present.
 */
function sampleContext(content: string, needle: string, windowSize = 35): string | null
{
    const index = content.indexOf(needle);

    if (index < 0)
    {
        return null;
    }

    const start = Math.max(0, index - windowSize);
    const end = Math.min(content.length, index + needle.length + windowSize);
    const snippet = content.slice(start, end).replace(/\n/g, "⏎");

    return snippet;
}

/**
 * Parses CLI flags. Supports `--apply`.
 *
 * @param argv - process.argv slice.
 * @returns Parsed arguments.
 */
function parseArguments(argv: Array<string>): { apply: boolean }
{
    let apply = false;

    for (const flag of argv)
    {
        if (flag === "--apply")
        {
            apply = true;
        }
        else
        {
            throw new Error(`Unknown argument: ${flag}`);
        }
    }

    return { apply };
}

const { apply } = parseArguments(process.argv.slice(2));

type FileChange = {
    relativePath: string;
    counts: Map<string, number>;
    samples: Array<{ label: string; context: string }>;
};

const yamlFiles = findYamlFiles(generaDir).sort();
const changes = new Array<FileChange>();
let totalReplacements = 0;

for (const filePath of yamlFiles)
{
    const original = fs.readFileSync(filePath, "utf8");
    const { content: updated, counts } = normalizeContent(original);

    if (updated === original)
    {
        continue;
    }

    const samples = new Array<{ label: string; context: string }>();

    for (const rule of replacements)
    {
        const context = sampleContext(original, rule.from);

        if (context !== null)
        {
            samples.push({ label: rule.label, context });
        }
    }

    let perFileTotal = 0;

    for (const count of counts.values())
    {
        perFileTotal += count;
    }

    totalReplacements += perFileTotal;

    changes.push({
        relativePath: path.relative(root, filePath),
        counts,
        samples,
    });

    if (apply)
    {
        fs.writeFileSync(filePath, updated);
    }
}

if (apply)
{
    console.log(`Updated ${changes.length} file(s) with ${totalReplacements} replacement(s).`);
}
else
{
    const lines = new Array<string>();
    const generatedAt = new Date().toISOString();

    lines.push("# Genera text normalization — dry run");
    lines.push("");
    lines.push(`Generated: ${generatedAt}`);
    lines.push("");
    lines.push("Replaces typographic dashes and curly quotes with their ASCII");
    lines.push("equivalents. Other non-ASCII glyphs (°, ×, ², é, Greek letters)");
    lines.push("are preserved.");
    lines.push("");
    lines.push("Run `npm run normalize-genera-text -- --apply` to write changes.");
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- Files affected: ${changes.length}`);
    lines.push(`- Total replacements: ${totalReplacements}`);
    lines.push("");

    const totalsByLabel = new Map<string, number>();

    for (const change of changes)
    {
        for (const [label, count] of change.counts)
        {
            totalsByLabel.set(label, (totalsByLabel.get(label) ?? 0) + count);
        }
    }

    lines.push("Replacements by character:");
    lines.push("");

    for (const rule of replacements)
    {
        const total = totalsByLabel.get(rule.label) ?? 0;
        lines.push(`- \`${rule.from}\` → \`${rule.to}\` (${rule.label}): ${total}`);
    }

    lines.push("");
    lines.push("## Per-file changes");
    lines.push("");

    for (const change of changes)
    {
        const breakdown = [...change.counts.entries()].map(([label, count]) => `${label}: ${count}`).join(", ");
        lines.push(`### \`${change.relativePath}\``);
        lines.push("");
        lines.push(`- ${breakdown}`);

        for (const sample of change.samples)
        {
            lines.push(`- \`${sample.label}\` sample: \`${sample.context}\``);
        }

        lines.push("");
    }

    const outputPath = path.join(reportsDir, "genera-text-normalization.md");
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(outputPath, lines.join("\n") + "\n");

    console.log(`Dry run: ${changes.length} file(s) would be updated, ${totalReplacements} replacement(s) total.`);
    console.log(`Wrote ${path.relative(root, outputPath)}`);
}
