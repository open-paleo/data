// Resume step of the per-species intake pipeline. Reads
// `papers-needed.md` for the species being added, validates that
// every ticked paper is present in the local corpus, and emits a
// `prompts.jsonl` of dual-source extraction prompts.
//
// Each prompt tells the Sonnet agent to read BOTH the corpus paper
// and the cached genus Wikipedia article, and to focus only on the
// species at hand. The schema is the species-level subset of the
// genus extraction schema (no parent, no genus etymology, no
// description prose — those are genus-level and already set).
//
// Usage:
//   npm run intake-species-resume -- Pinacosaurus hilwitnorum
//   npm run intake-species-resume -- Pinacosaurus hilwitnorum --corpus /custom/path

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { getWorkingDir } from "./corpus-path.ts";
import { renderSchemaLines, speciesExtractionFields } from "./intake-types.ts";
import { parseResumeArguments, prepareResume, writePrompts } from "./intake-shared.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingDir = path.join(root, "staging", "intake-species");

/**
 * One species extraction prompt: a describing or supplementary paper
 * that the agent must read in full and return structured JSON for.
 */
type SpeciesPromptEntry = {
    /**
     * Genus name (matches the staging directory prefix).
     */
    genus: string;

    /**
     * Specific epithet (matches the staging directory suffix).
     */
    species: string;

    /**
     * Citation key of the paper to read.
     */
    citation_key: string;

    /**
     * Absolute path to the paper's markdown in the local corpus.
     */
    markdown_path: string;

    /**
     * Absolute path to the cached Wikipedia article body (or null
     * when the cache is missing).
     */
    wikipedia_cache_path: string | null;

    /**
     * Absolute path the extraction agent will write JSON to.
     */
    output_path: string;

    /**
     * Whether this is the describing paper.
     */
    is_describing: boolean;

    /**
     * The literal prompt string to pass to a Sonnet agent.
     */
    prompt: string;
};

/**
 * Builds the dual-source extraction prompt for a single paper.
 *
 * @param entry - Partially built prompt entry.
 * @returns The literal prompt string.
 */
function buildSpeciesPromptString(
    entry: Omit<SpeciesPromptEntry, "prompt">,
): string
{
    const sentinelJson = JSON.stringify({
        genus: entry.genus,
        species: entry.species,
        citation_key: entry.citation_key,
        is_describing: entry.is_describing,
        empty: true,
        notes: "EXTRACTION FAILED: empty/boilerplate markdown",
    });

    const role = entry.is_describing ? "DESCRIBING paper" : "SUPPLEMENTARY paper";
    const binomial = `${entry.genus} ${entry.species}`;

    const sources = [
        `Primary source (paper, authoritative for any factual conflict): ${entry.markdown_path}`,
    ];

    if (entry.wikipedia_cache_path !== null)
    {
        sources.push(
            `Secondary source (cached Wikipedia article for ${entry.genus}, useful for cross-checking section structure / etymology gloss): ${entry.wikipedia_cache_path}`,
        );
    }

    return [
        "Read these sources (do NOT explore other corpus paths under any circumstances):",
        ...sources.map((source) => `  - ${source}`),
        "",
        `This is the ${role} for adding species ${binomial} to the existing genus ${entry.genus}.`,
        "",
        `Focus ONLY on ${binomial}. The paper may describe multiple taxa (the genus type species, other new species, referred specimens, comparator taxa) — extract data ONLY about ${binomial}. The Wikipedia article is provided for context: if it has a section on ${binomial}, that section is useful; otherwise it tells you about the genus more generally. The paper always wins on factual conflict.`,
        "",
        `If the primary source markdown is empty, fewer than ~50 lines of substantive prose, or just publisher boilerplate, write a sentinel JSON to ${entry.output_path} with ${sentinelJson} and STOP. No further tool calls.`,
        "",
        `Otherwise, write JSON to ${entry.output_path} with this schema:`,
        "",
        ...renderSchemaLines(
            { genus: entry.genus, species: entry.species, citation_key: entry.citation_key, is_describing: entry.is_describing },
            speciesExtractionFields,
            binomial),
        "",
        "Rules:",
        "- Do NOT invent material/characters. null/[] when absent.",
        `- Diagnostic features at the SPECIES level (this field) are intra-genus differentia: features that distinguish ${binomial} from its sister species in the same genus. WRITE TIGHT — drop "Differs from ${entry.genus} <typeSpecies> in..." prefixes; the implicit subject is the species and the implicit comparison is to the type species, so comparative phrases ("more prominent", "fused", "reduced") read fine on their own. Add a parenthetical only when the trait would be ambiguous without spelling out the contrast (e.g. "Fused parietals (paired in ${entry.genus} <typeSpecies>)"). Standalone autapomorphies are also fine. REJECT bullets that compare to species in OTHER genera — those belong in the paper, not in this schema. REJECT clade-shared traits — those are uninformative for species-level diagnosis.`,
        "- For holotype_material, describe ONLY the holotype specimen's anatomical inventory. Do NOT include referred specimens or paratypes.",
        "- For holotype_institution, prefer a known abbreviation (e.g. \"ZPAL\", \"AMNH\", \"IVPP\") rather than the spelled-out institution name.",
        "- For described_year / described_authors: report the AUTHORS AND YEAR THAT ORIGINALLY ERECTED THE SPECIES. For a recombination (new genus receiving a previously-named species), this is the ORIGINAL describer, not the recombining author.",
        "- For synonyms, only include entries the paper explicitly establishes. Use type \"reassigned\" for recombinations.",
        `- DIRECTION MATTERS in synonyms. The array records names that are JUNIOR SYNONYMS OF ${binomial} — i.e. other binomials that sink INTO it, including the prior combination when this species was moved from another genus. If the paper instead sinks ${binomial} into some other species, that does NOT go here: leave synonyms empty and report it in status_assessment / status_quote / notes.`,
        "- For status_quote, copy the paper's own words. A paper can adopt a synonymy \"for working purposes\" while calling the question open, or report material that \"lends some support\" to validity; a paraphrase loses exactly that hedging, so quote instead of summarizing.",
        "- Etymology should be terse and start with the source word(s). Do NOT start with \"The specific name…\".",
        "- Return ONLY the output path as confirmation, nothing else.",
    ].join("\n");
}

/**
 * Resume entry point.
 */
function main(): void
{
    let genus: string;
    let species: string;
    let corpusDir: string;

    try
    {
        const parsed = parseResumeArguments(process.argv.slice(2), 2, "Usage: intake-species-resume <Genus> <species> [--corpus <path>]");
        [genus, species] = parsed.positional;
        corpusDir = parsed.corpusDir;
    }
    catch (error)
    {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exit(2);
    }

    const targetDir = path.join(stagingDir, `${genus}-${species}`);

    if (!fs.existsSync(targetDir))
    {
        process.stderr.write(
            `staging/intake-species/${genus}-${species}/ does not exist. Run intake-species-bootstrap first.\n`,
        );
        process.exit(1);
    }

    const { papers, markdownPaths, extractionsDir } = prepareResume(targetDir, corpusDir);
    const wikipediaCachePath = path.join(getWorkingDir(), "wikipedia", `${genus}.json`);
    const wikipediaCacheResolved = fs.existsSync(wikipediaCachePath) ? wikipediaCachePath : null;
    const promptEntries = papers.fetched.map((paper) =>
    {
        const partial: Omit<SpeciesPromptEntry, "prompt"> = {
            genus,
            species,
            citation_key: paper.key,
            markdown_path: markdownPaths.get(paper.key)!,
            wikipedia_cache_path: wikipediaCacheResolved,
            output_path: path.join(extractionsDir, `${paper.key}.json`),
            is_describing: paper.isDescribing,
        };

        return { ...partial, prompt: buildSpeciesPromptString(partial) };
    });
    const promptsPath = writePrompts(targetDir, promptEntries);

    process.stdout.write(`Resumed ${genus} ${species}.\n`);
    process.stdout.write(`  Prompts written: ${promptsPath}\n`);
    process.stdout.write(`  Wikipedia cache: ${wikipediaCacheResolved ?? "not available"}\n`);
    process.stdout.write(`  Papers queued (${promptEntries.length}):\n`);

    for (const entry of promptEntries)
    {
        const role = entry.is_describing ? "describing" : "supplementary";
        process.stdout.write(`    [${role}] ${entry.citation_key}\n`);
    }

    if (papers.pending.length > 0)
    {
        process.stdout.write(
            `  Still pending (${papers.pending.length}): ${papers.pending.join(", ")}\n`,
        );
    }

    process.stdout.write(
        "\nNext: dispatch one Sonnet agent per prompt entry, "
        + `then run \`npm run intake-species-apply -- ${genus} ${species}\`.\n`,
    );
}

main();
