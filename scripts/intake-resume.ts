// Resume step (build phase) of the per-genus intake pipeline.
// Verifies that every paper the user has marked as fetched in
// `papers-needed.md` is actually present in the local corpus, then
// emits a `prompts.jsonl` file: one extraction-agent prompt per
// paper. The agent dispatcher (typically a skill) reads this JSONL
// and dispatches Haiku 4.5 sub-agents whose outputs land in
// `staging/intake/{Genus}/extractions/{citation_key}.json`. The
// follow-up `intake-apply` step merges those outputs into
// `bootstrap.yml` and writes `final.yml`.
//
// Paper readiness is signalled by the user converting a `- [ ]`
// checkbox in `papers-needed.md` to `- [x]`. Lines with
// `**citation_key**` markers are matched; lines without an x are
// ignored.
//
// Usage:
//   npm run intake-resume -- Bagaraatan
//   npm run intake-resume -- Bagaraatan --corpus /custom/path
//
// The corpus root resolves through `getCorpusDir()` — honoring the
// `OPEN_PALEO_PAPERS_DIR` env var, falling back to a sibling
// `../open-paleo-papers/` directory. See scripts/corpus-path.ts.

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { intakeExtractionFields, renderSchemaLines } from "./intake-types.ts";
import { parseResumeArguments, prepareResume, writePrompts } from "./intake-shared.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingIntakeDir = path.join(root, "staging", "intake");

/**
 * One extraction prompt: a describing or supplementary paper that
 * the agent must read in full and return structured JSON for.
 */
type IntakePromptEntry = {
    /**
     * Genus name (matches the staging directory).
     */
    genus: string;

    /**
     * Citation key of the paper to read (matches the corpus filename).
     */
    citation_key: string;

    /**
     * Absolute path to the paper's markdown in the local corpus.
     */
    markdown_path: string;

    /**
     * Absolute path the extraction agent will write JSON to.
     */
    output_path: string;

    /**
     * Whether this is the describing paper (the first checkbox in
     * papers-needed.md) or a supplementary paper.
     */
    is_describing: boolean;

    /**
     * The literal prompt string to pass to a Haiku 4.5 agent.
     */
    prompt: string;
};

/**
 * Builds the literal extraction prompt sent to the per-paper agent.
 * The schema is wider than the existing paper-driven backfill flow
 * because intake starts from a near-empty stub: we want etymology,
 * paleoenvironment, synonyms, holotype block, and diagnostic features
 * in a single pass per paper.
 *
 * @param entry - Partially-built prompt entry (everything except the
 *                `prompt` string itself).
 * @returns The prompt string.
 */
function buildIntakePromptString(entry: Omit<IntakePromptEntry, "prompt">): string
{
    const sentinelJson = JSON.stringify({
        genus: entry.genus,
        citation_key: entry.citation_key,
        is_describing: entry.is_describing,
        empty: true,
        notes: "EXTRACTION FAILED: empty/boilerplate markdown",
    });

    const role = entry.is_describing ? "DESCRIBING paper" : "SUPPLEMENTARY paper";

    return [
        `Read ONLY this markdown file (do NOT explore images/PDFs/other corpus paths under any circumstances): ${entry.markdown_path}`,
        "",
        `This is the ${role} for genus ${entry.genus} (citation key: ${entry.citation_key}).`,
        "",
        `If the file is empty, fewer than ~50 lines of substantive prose, or just publisher boilerplate, write a sentinel JSON to ${entry.output_path} with ${sentinelJson} and STOP. No further tool calls.`,
        "",
        `Otherwise, write JSON to ${entry.output_path} with this schema:`,
        "",
        ...renderSchemaLines(
            { genus: entry.genus, citation_key: entry.citation_key, is_describing: entry.is_describing },
            intakeExtractionFields,
            entry.genus),
        "",
        "Rules:",
        "- Do NOT invent material/characters. null/[] when absent.",
        "- Focus only on the target taxon if the paper covers multiple new taxa.",
        `- For diagnostic_features, prefer the paper's explicit "Diagnosis" / "Differential diagnosis" subsection. Each bullet must describe an attribute of ${entry.genus} that stands alone — i.e. it could be read as a property of the genus without referring to any other taxon. REJECT every comparative bullet, including phrasings like "differs from X in...", "shared with X but not Y", "unlike Z", "more X than W", or "as in P, Q". A reader who has never heard of the comparison taxon must still be able to picture the feature.`,
        "- For holotype_material, describe ONLY the holotype specimen's anatomical inventory. Do NOT include referred specimens or paratypes — those go in description text or are omitted.",
        "- For holotype_institution, prefer a known abbreviation (e.g. \"ZPAL\", \"AMNH\", \"IVPP\") rather than the spelled-out institution name.",
        "- For synonyms, only include entries the paper explicitly establishes (preoccupation, junior synonymy, etc.).",
        `- DIRECTION MATTERS in synonyms. The array records names that are JUNIOR SYNONYMS OF ${entry.genus} — i.e. other names that sink INTO it. If the paper instead sinks ${entry.genus} into some other genus, that does NOT go here: leave synonyms empty and report it in status_assessment / status_quote / notes.`,
        "- For status_quote, copy the paper's own words. A paper can adopt a synonymy \"for working purposes\" while calling the question open, or report material that \"lends some support\" to validity; a paraphrase loses exactly that hedging, so quote instead of summarizing.",
        "- Etymology should be terse and start with the source word(s). Do NOT start with \"The generic name…\".",
        "- Return ONLY the output path as confirmation, nothing else.",
    ].join("\n");
}

/**
 * Resume entry point.
 */
function main(): void
{
    let genus: string;
    let corpusDir: string;

    try
    {
        const parsed = parseResumeArguments(process.argv.slice(2), 1, "Usage: intake-resume <Genus> [--corpus <path>]");
        [genus] = parsed.positional;
        corpusDir = parsed.corpusDir;
    }
    catch (error)
    {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exit(2);
    }

    const targetDir = path.join(stagingIntakeDir, genus);

    if (!fs.existsSync(targetDir))
    {
        process.stderr.write(
            `staging/intake/${genus}/ does not exist. Run intake-bootstrap first.\n`,
        );
        process.exit(1);
    }

    const { papers, markdownPaths, extractionsDir } = prepareResume(targetDir, corpusDir);
    const promptEntries = papers.fetched.map((paper) =>
    {
        const partial: Omit<IntakePromptEntry, "prompt"> = {
            genus,
            citation_key: paper.key,
            markdown_path: markdownPaths.get(paper.key)!,
            output_path: path.join(extractionsDir, `${paper.key}.json`),
            is_describing: paper.isDescribing,
        };

        return { ...partial, prompt: buildIntakePromptString(partial) };
    });
    const promptsPath = writePrompts(targetDir, promptEntries);

    process.stdout.write(`Resumed ${genus}.\n`);
    process.stdout.write(`  Prompts written: ${promptsPath}\n`);
    process.stdout.write(`  Papers queued (${promptEntries.length}):\n`);

    for (const entry of promptEntries)
    {
        const role = entry.is_describing ? "describing" : "supplementary";
        process.stdout.write(`    [${role}] ${entry.citation_key}\n`);
    }

    if (papers.pending.length > 0)
    {
        process.stdout.write(`  Still pending (${papers.pending.length}): `
            + `${papers.pending.join(", ")}\n`);
    }

    process.stdout.write(
        "\nNext: dispatch one Sonnet agent per prompt entry, "
        + "then run `npm run intake-apply -- " + genus + "`.\n",
    );
}

main();
