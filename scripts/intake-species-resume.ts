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

import { getCorpusDir, getWorkingDir } from "./corpus-path.ts";
import { readBibCitationKeys, resolveCitationKey } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingDir = path.join(root, "staging", "intake-species");
const referencesBibPath = path.join(root, "dist", "references.bib");

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
 * Parsed `papers-needed.md` content.
 */
type ParsedPapers = {
    fetched: Array<{ key: string; isDescribing: boolean }>;
    pending: Array<string>;
};

/**
 * Parses `papers-needed.md` for fetched-vs-pending citation keys.
 *
 * @param markdown - Body of `papers-needed.md`.
 * @returns Parsed paper status.
 */
function parsePapersNeeded(markdown: string): ParsedPapers
{
    const fetched = new Array<{ key: string; isDescribing: boolean }>();
    const pending = new Array<string>();

    let inDescribing = false;

    for (const line of markdown.split("\n"))
    {
        if (/^##\s+Describing paper/i.test(line))
        {
            inDescribing = true;
            continue;
        }
        else if (/^##\s+/.test(line))
        {
            inDescribing = false;
        }

        const match = line.match(/^- \[( |x|X)\]\s+\*\*([^*]+)\*\*/);

        if (!match)
        {
            continue;
        }

        const key = match[2].trim();

        if (key === "citation_key" || /unknown/i.test(key))
        {
            continue;
        }

        if (match[1] === "x" || match[1] === "X")
        {
            fetched.push({ key, isDescribing: inDescribing });
        }
        else
        {
            pending.push(key);
        }
    }

    return { fetched, pending };
}

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
        "{",
        `  "genus": "${entry.genus}",`,
        `  "species": "${entry.species}",`,
        `  "citation_key": "${entry.citation_key}",`,
        `  "is_describing": ${entry.is_describing},`,
        '  "binomial_in_paper": "string|null — exact binomial as it appears in the paper, only if it differs from {Genus species}",',
        '  "etymology_species": "string|null — concise (~150 chars) etymology of the specific epithet",',
        '  "holotype_specimen_id": "string|null — single catalog number, e.g. \\"ZPAL MgD-I/108\\"",',
        '  "holotype_institution": "string|null — full institution name or known abbreviation",',
        '  "holotype_specimen_type": "holotype|syntype|lectotype|neotype|null",',
        '  "holotype_material": "string|null — concise (≤200 chars) anatomical inventory from the paper; drop catalog numbers from the prose",',
        '  "diagnostic_features": ["3-6 species-level differentia ≤200 chars each. WRITE TIGHT: drop the \\"differs from G. typeSpecies in...\\" prefix — the field already lives under the species block and the implicit comparison is to the type species. Comparative phrases like \\"more prominent\\" hang off that implicit context. Add a parenthetical with the type-species contrast only when the trait would otherwise read ambiguously (e.g. \\"Fused parietals (paired in G. typeSpecies)\\"). NO comparisons against species in OTHER genera. NO clade-shared traits."],',
        '  "paleoenvironment": ["zero or more values from this exact enum (others will fail validation): fluvial, lacustrine, coastal, deltaic, arid, forested, wetland, marine, polar. Map paludal/swamp/marsh → wetland; estuarine/lagoonal → coastal; eolian/desert → arid. Only fill in if the species locality differs from the genus default; otherwise leave empty."],',
        '  "period_name": ["zero or more of Late Cretaceous, Early Cretaceous, etc. — only when paper specifies"],',
        '  "period_stage": ["zero or more stage names — only when paper specifies"],',
        '  "period_from_ma": "number|null",',
        '  "period_to_ma": "number|null",',
        '  "location_country": "string|null — ISO 3166-1 alpha-2 code preferred",',
        '  "location_region": "string|null — state/province/oblast",',
        '  "location_formation": "string|null",',
        '  "location_locality": "string|null — quarry, site, hamlet, etc.",',
        '  "location_coordinates": "[lat, lng] | null — decimal degrees, only when the paper gives coordinates",',
        '  "size_length_m_min": "number|null",',
        '  "size_length_m_max": "number|null",',
        '  "size_weight_kg_min": "number|null",',
        '  "size_weight_kg_max": "number|null",',
        '  "described_year": "number|null — year the species was originally erected",',
        '  "described_authors": "string|null — authorship surname(s) for the species erection (e.g. \\"Penkalski\\" or \\"Smith and Jones\\")",',
        '  "synonyms": [{"name": "string", "type": "junior subjective|junior objective|preoccupied|nomen nudum|nomen rejectum|reassigned|informal", "reason": "string"}],',
        '  "paper_quality": "primary|review|popular|translation|other",',
        '  "notes": "string|null — flag anything unusual, including taxonomy-policy nuance for recombinations"',
        "}",
        "",
        "Rules:",
        "- Do NOT invent material/characters. null/[] when absent.",
        `- Diagnostic features at the SPECIES level (this field) are intra-genus differentia: features that distinguish ${binomial} from its sister species in the same genus. WRITE TIGHT — drop "Differs from ${entry.genus} <typeSpecies> in..." prefixes; the implicit subject is the species and the implicit comparison is to the type species, so comparative phrases ("more prominent", "fused", "reduced") read fine on their own. Add a parenthetical only when the trait would be ambiguous without spelling out the contrast (e.g. "Fused parietals (paired in ${entry.genus} <typeSpecies>)"). Standalone autapomorphies are also fine. REJECT bullets that compare to species in OTHER genera — those belong in the paper, not in this schema. REJECT clade-shared traits — those are uninformative for species-level diagnosis.`,
        "- For holotype_material, describe ONLY the holotype specimen's anatomical inventory. Do NOT include referred specimens or paratypes.",
        "- For holotype_institution, prefer a known abbreviation (e.g. \"ZPAL\", \"AMNH\", \"IVPP\") rather than the spelled-out institution name.",
        "- For described_year / described_authors: report the AUTHORS AND YEAR THAT ORIGINALLY ERECTED THE SPECIES. For a recombination (new genus receiving a previously-named species), this is the ORIGINAL describer, not the recombining author.",
        "- For synonyms, only include entries the paper explicitly establishes. Use type \"reassigned\" for recombinations.",
        "- Etymology should be terse and start with the source word(s). Do NOT start with \"The specific name…\".",
        "- Return ONLY the output path as confirmation, nothing else.",
    ].join("\n");
}

/**
 * Resume entry point.
 */
function main(): void
{
    const args = process.argv.slice(2);
    const positional = new Array<string>();
    let corpusDir = getCorpusDir();

    for (let index = 0; index < args.length; index += 1)
    {
        const argument = args[index];

        if (argument === "--corpus")
        {
            corpusDir = args[index + 1] ?? corpusDir;
            index += 1;
        }
        else if (argument.startsWith("--"))
        {
            process.stderr.write(`Unknown argument: ${argument}\n`);
            process.exit(2);
        }
        else
        {
            positional.push(argument);
        }
    }

    if (positional.length !== 2)
    {
        process.stderr.write(
            "Usage: intake-species-resume <Genus> <species> [--corpus <path>]\n",
        );
        process.exit(2);
    }

    const [genus, species] = positional;
    const corpusMarkdownDir = path.join(corpusDir, "markdown");
    const targetDir = path.join(stagingDir, `${genus}-${species}`);

    if (!fs.existsSync(targetDir))
    {
        process.stderr.write(
            `staging/intake-species/${genus}-${species}/ does not exist. Run intake-species-bootstrap first.\n`,
        );
        process.exit(1);
    }

    const papersNeededPath = path.join(targetDir, "papers-needed.md");

    if (!fs.existsSync(papersNeededPath))
    {
        process.stderr.write(`Missing ${papersNeededPath}\n`);
        process.exit(1);
    }

    if (!fs.existsSync(corpusMarkdownDir))
    {
        process.stderr.write(
            `Corpus markdown directory not found at ${corpusMarkdownDir}\n`,
        );
        process.exit(1);
    }

    const wikipediaCachePath = path.join(
        getWorkingDir(),
        "wikipedia",
        `${genus}.json`,
    );
    const wikipediaCacheResolved = fs.existsSync(wikipediaCachePath)
        ? wikipediaCachePath
        : null;

    const papers = parsePapersNeeded(fs.readFileSync(papersNeededPath, "utf8"));

    if (papers.fetched.length === 0)
    {
        process.stderr.write(
            `No papers marked as fetched in ${papersNeededPath}.\n`
            + "Tick at least one `- [x]` checkbox before resuming.\n",
        );

        if (papers.pending.length > 0)
        {
            process.stderr.write(`Pending: ${papers.pending.join(", ")}\n`);
        }

        process.exit(1);
    }

    const bibKeys = readBibCitationKeys(referencesBibPath);
    const collisions = new Array<{ key: string; suggested: string; reason: string }>();

    for (const paper of papers.fetched)
    {
        const resolution = resolveCitationKey(paper.key, bibKeys);

        if (resolution.collided)
        {
            collisions.push({
                key: paper.key,
                suggested: resolution.resolvedKey,
                reason: resolution.reason ?? "",
            });
        }
    }

    if (collisions.length > 0)
    {
        process.stderr.write("Citation key collisions detected:\n");

        for (const collision of collisions)
        {
            process.stderr.write(`  - "${collision.key}": ${collision.reason}\n`);
            process.stderr.write(
                `    Use "${collision.suggested}" instead. Update papers-needed.md and rename `
                + `${corpusMarkdownDir}/${collision.key}.md → ${collision.suggested}.md.\n`,
            );
        }

        process.exit(1);
    }

    const missingMarkdown = new Array<string>();
    const extractionsDir = path.join(targetDir, "extractions");
    fs.mkdirSync(extractionsDir, { recursive: true });

    const promptEntries = new Array<SpeciesPromptEntry>();

    for (const paper of papers.fetched)
    {
        const markdownPath = path.join(corpusMarkdownDir, `${paper.key}.md`);

        if (!fs.existsSync(markdownPath))
        {
            missingMarkdown.push(paper.key);
            continue;
        }

        const outputPath = path.join(extractionsDir, `${paper.key}.json`);

        const partial: Omit<SpeciesPromptEntry, "prompt"> = {
            genus,
            species,
            citation_key: paper.key,
            markdown_path: markdownPath,
            wikipedia_cache_path: wikipediaCacheResolved,
            output_path: outputPath,
            is_describing: paper.isDescribing,
        };

        promptEntries.push({
            ...partial,
            prompt: buildSpeciesPromptString(partial),
        });
    }

    if (missingMarkdown.length > 0)
    {
        process.stderr.write(
            "The following papers are marked fetched in papers-needed.md but "
            + "are missing from the corpus markdown directory:\n",
        );

        for (const key of missingMarkdown)
        {
            process.stderr.write(`  - ${corpusMarkdownDir}/${key}.md\n`);
        }

        process.stderr.write("\nFix the corpus and re-run.\n");
        process.exit(1);
    }

    const promptsPath = path.join(targetDir, "prompts.jsonl");
    fs.writeFileSync(
        promptsPath,
        promptEntries.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
        "utf8",
    );

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
