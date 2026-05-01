// Build the work queue + per-genus Sonnet extraction prompts for the
// paper-driven backfill flow (issues #1827 and #1833). For each genus
// in the requested subdirectory, this resolves the type species and its
// describing paper, checks corpus markdown availability and current
// YAML state, and emits two artifacts:
//
//   reports/extraction-queue-<letter>.json    summary + skip categories
//   reports/extraction-prompts-<letter>.jsonl one ready-to-dispatch row per line
//
// The JSONL is consumed by an agent dispatcher (currently a human
// driving the Agent tool); each row already contains the exact prompt
// to send. Constructing prompts this way — rather than hand-typing
// genus/species/key into each invocation — eliminates the transcription
// errors that surfaced during the letter-A run (see
// reports/paper-driven-backfill.md).
//
// Usage:
//   npm run build-extraction-prompts -- --letter A
//   npm run build-extraction-prompts -- --letter A --corpus /custom/path

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";

import type { GenusData, Species } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const reportsDir = path.join(root, "reports");
const defaultCorpusDir = path.join(os.homedir(), "Desktop", "open-paleo-papers");

/**
 * Outcome of evaluating one genus against the queue rules.
 */
type QueueOutcome =
    | { kind: "queue"; entry: PromptEntry }
    | { kind: "skip"; reason: SkipReason; genus: string };

type SkipReason =
    | "no_described_in"
    | "no_corpus_markdown"
    | "both_fields_filled";

/**
 * One row in the extraction-prompts JSONL. Carries everything the
 * dispatcher needs — the file paths, current YAML state, and the
 * literal prompt string.
 */
type PromptEntry = {
    /**
     * Genus name (matches the YAML filename stem).
     */
    genus: string;

    /**
     * Type species binomial, lifted from the YAML.
     */
    species: string;

    /**
     * Citation key of the type species' describing paper.
     */
    described_in: string;

    /**
     * Absolute path to the corpus markdown for `described_in`.
     */
    markdown_path: string;

    /**
     * Absolute path the extraction agent will write JSON to.
     */
    output_path: string;

    /**
     * Whether the YAML already has species.holotype.material populated.
     */
    current_material: boolean;

    /**
     * Whether the YAML already has top-level diagnostic_features
     * populated.
     */
    current_diagnostic_features: boolean;

    /**
     * The literal prompt string to pass to a Sonnet agent.
     */
    prompt: string;
};

/**
 * Aggregate summary written to the queue JSON. Mirrors the shape of
 * the existing letter-A aggregate so downstream tooling can read both.
 */
type QueueSummary = {
    letter: string;
    generated_at: string;
    corpus_dir: string;
    total_genera_in_letter: number;
    queued: number;
    skipped: {
        no_described_in: Array<string>;
        no_corpus_markdown: Array<string>;
        both_fields_filled: Array<string>;
    };
};

/**
 * Determines whether a value counts as populated (non-null, non-empty).
 *
 * @param value - Candidate value from a parsed YAML document.
 * @returns True when the value is populated.
 */
function isPopulated(value: unknown): boolean
{
    if (value === undefined || value === null)
    {
        return false;
    }
    else if (typeof value === "string")
    {
        return value.trim().length > 0;
    }
    else if (Array.isArray(value))
    {
        return value.length > 0;
    }
    else if (typeof value === "object")
    {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }

    return true;
}

/**
 * Picks the representative species: the type species when marked,
 * else the first listed species. Returns null when the genus has no
 * species entries.
 *
 * @param data - Parsed genus YAML.
 * @returns The representative Species, or null.
 */
function pickRepresentativeSpecies(data: GenusData): Species | null
{
    if (!Array.isArray(data.species) || data.species.length === 0)
    {
        return null;
    }

    for (const species of data.species)
    {
        if (species.type_species === true)
        {
            return species;
        }
    }

    return data.species[0];
}

/**
 * Builds the literal Sonnet prompt for one extraction. The prompt
 * carries a hard guardrail against exploring beyond the named markdown
 * file, the sentinel-JSON contract for empty source content, and the
 * field rules learned during the letter-A run.
 *
 * @param entry - Partially-built prompt entry (everything except the
 *                `prompt` string itself).
 * @returns The prompt string.
 */
function buildPromptString(entry: Omit<PromptEntry, "prompt">): string
{
    const sentinelJson = JSON.stringify({
        genus: entry.genus,
        species: entry.species,
        described_in: entry.described_in,
        holotype_material: null,
        diagnostic_features: [],
        binomial_in_paper: null,
        paper_quality: "other",
        notes: "EXTRACTION FAILED: empty/boilerplate markdown",
    });

    return [
        `Read ONLY this markdown file (do NOT explore images/PDFs/other corpus paths under any circumstances): ${entry.markdown_path}`,
        "",
        `If the file is empty, fewer than ~50 lines of substantive prose, or just publisher boilerplate, write a sentinel JSON to ${entry.output_path} with ${sentinelJson} and STOP. No further tool calls.`,
        "",
        "Otherwise, write JSON to that path with this exact schema:",
        `{"genus":"${entry.genus}","species":"${entry.species}","described_in":"${entry.described_in}","holotype_material":"string|null (≤200 chars from the paper's Holotype subsection, drop catalog numbers)","diagnostic_features":["3-6 standalone autapomorphy bullets ≤200 chars each, NO comparative-only bullets, NO clade-shared traits"],"binomial_in_paper":"string|null (only if differs from above)","paper_quality":"primary|review|popular|translation|other","notes":"string|null (flag anything unusual)"}`,
        "",
        "Do NOT invent material/characters. null/[] when absent. Focus only on the target taxon if the paper covers multiple new taxa. Return ONLY the output path as confirmation, nothing else.",
    ].join("\n");
}

/**
 * Evaluates a single genus YAML against the queue rules and returns
 * either a queue entry or a skip reason.
 *
 * @param yamlPath - Absolute path to the genus YAML file.
 * @param letter - The letter subdirectory we are processing (used to
 *                 locate the per-letter extractions output directory).
 * @param corpusDir - Root of the local paper corpus.
 * @returns The queue outcome.
 */
function evaluateGenus(yamlPath: string, letter: string, corpusDir: string): QueueOutcome
{
    const genus = path.basename(yamlPath, ".yml");
    const data = parseYaml<GenusData>(yamlPath);

    const representative = pickRepresentativeSpecies(data);
    const describedIn = representative?.described_in;

    if (!isPopulated(describedIn))
    {
        return { kind: "skip", reason: "no_described_in", genus };
    }

    const markdownPath = path.join(corpusDir, "markdown", `${describedIn}.md`);

    if (!fs.existsSync(markdownPath))
    {
        return { kind: "skip", reason: "no_corpus_markdown", genus };
    }

    const hasMaterial = isPopulated(representative?.holotype?.material);
    const hasDiagnosticFeatures = isPopulated(data.diagnostic_features);

    if (hasMaterial && hasDiagnosticFeatures)
    {
        return { kind: "skip", reason: "both_fields_filled", genus };
    }

    const speciesName = representative?.name;

    if (!isPopulated(speciesName))
    {
        return { kind: "skip", reason: "no_described_in", genus };
    }

    const outputPath = path.join(reportsDir, "extractions", letter, `${genus}.json`);

    const partial: Omit<PromptEntry, "prompt"> = {
        genus,
        species: speciesName as string,
        described_in: describedIn as string,
        markdown_path: markdownPath,
        output_path: outputPath,
        current_material: hasMaterial,
        current_diagnostic_features: hasDiagnosticFeatures,
    };

    return {
        kind: "queue",
        entry: { ...partial, prompt: buildPromptString(partial) },
    };
}

/**
 * Parses CLI flags. Supports `--letter <X>` and `--corpus <path>`.
 *
 * @param argv - process.argv slice (everything after the script path).
 * @returns Parsed arguments.
 */
function parseArguments(argv: Array<string>): { letter: string; corpusDir: string }
{
    let letter: string | null = null;
    let corpusDir = defaultCorpusDir;

    for (let index = 0; index < argv.length; index += 1)
    {
        const flag = argv[index];

        if (flag === "--letter")
        {
            letter = argv[index + 1] ?? null;
            index += 1;
        }
        else if (flag === "--corpus")
        {
            corpusDir = argv[index + 1] ?? corpusDir;
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

    return { letter: letter.toUpperCase(), corpusDir };
}

const { letter, corpusDir } = parseArguments(process.argv.slice(2));

const letterDir = path.join(generaDir, letter);

if (!fs.existsSync(letterDir))
{
    throw new Error(`Letter directory does not exist: ${letterDir}`);
}

if (!fs.existsSync(path.join(corpusDir, "markdown")))
{
    throw new Error(`Corpus markdown directory not found at ${corpusDir}/markdown`);
}

const yamlFiles = findYamlFiles(letterDir).sort();

const queued = new Array<PromptEntry>();
const skippedNoDescribedIn = new Array<string>();
const skippedNoCorpusMarkdown = new Array<string>();
const skippedBothFieldsFilled = new Array<string>();

for (const yamlFile of yamlFiles)
{
    const outcome = evaluateGenus(yamlFile, letter, corpusDir);

    if (outcome.kind === "queue")
    {
        queued.push(outcome.entry);
    }
    else if (outcome.reason === "no_described_in")
    {
        skippedNoDescribedIn.push(outcome.genus);
    }
    else if (outcome.reason === "no_corpus_markdown")
    {
        skippedNoCorpusMarkdown.push(outcome.genus);
    }
    else
    {
        skippedBothFieldsFilled.push(outcome.genus);
    }
}

const summary: QueueSummary = {
    letter,
    generated_at: new Date().toISOString(),
    corpus_dir: corpusDir,
    total_genera_in_letter: yamlFiles.length,
    queued: queued.length,
    skipped: {
        no_described_in: skippedNoDescribedIn,
        no_corpus_markdown: skippedNoCorpusMarkdown,
        both_fields_filled: skippedBothFieldsFilled,
    },
};

fs.mkdirSync(reportsDir, { recursive: true });
fs.mkdirSync(path.join(reportsDir, "extractions", letter), { recursive: true });

const queuePath = path.join(reportsDir, `extraction-queue-${letter}.json`);
const promptsPath = path.join(reportsDir, `extraction-prompts-${letter}.jsonl`);

fs.writeFileSync(queuePath, JSON.stringify(summary, null, 2) + "\n");
fs.writeFileSync(promptsPath, queued.map((entry) => JSON.stringify(entry)).join("\n") + "\n");

console.log(`Letter ${letter}: ${yamlFiles.length} genera scanned`);
console.log(`  queued: ${queued.length}`);
console.log(`  skipped (no_described_in): ${skippedNoDescribedIn.length}`);
console.log(`  skipped (no_corpus_markdown): ${skippedNoCorpusMarkdown.length}`);
console.log(`  skipped (both_fields_filled): ${skippedBothFieldsFilled.length}`);
console.log("");
console.log(`Wrote ${path.relative(root, queuePath)}`);
console.log(`Wrote ${path.relative(root, promptsPath)} (${queued.length} prompts)`);
