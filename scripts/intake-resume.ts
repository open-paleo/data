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

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingIntakeDir = path.join(root, "staging", "intake");
const corpusDir = path.join(os.homedir(), "Desktop", "open-paleo-papers");
const corpusMarkdownDir = path.join(corpusDir, "markdown");

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
 * Parsed papers-needed.md: the citation keys the user has marked
 * fetched, in the order they appear, plus which one is the
 * describing paper.
 */
type ParsedPapers = {
    /**
     * Citation keys the user has explicitly marked complete via `[x]`.
     * The first entry under "## Describing paper" is treated as the
     * describing paper.
     */
    fetched: Array<{ key: string; isDescribing: boolean }>;

    /**
     * Citation keys still marked as `[ ]` (unfetched). Surfaced in the
     * resume report so the user knows what is blocking progress.
     */
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

        // Skip the placeholder template entry from the optional section.
        if (key === "citation_key")
        {
            continue;
        }

        // Skip the "Describing paper unknown" sentinel.
        if (/unknown/i.test(key))
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
        "{",
        `  "genus": "${entry.genus}",`,
        `  "citation_key": "${entry.citation_key}",`,
        `  "is_describing": ${entry.is_describing},`,
        '  "type_species": "binomial as it appears in the paper, or null",',
        '  "etymology_genus": "string|null — concise (~150 chars) etymology of the genus name",',
        '  "etymology_species": "string|null — concise etymology of the specific epithet",',
        '  "holotype_specimen_id": "string|null — single catalog number, e.g. \\"ZPAL MgD-I/108\\"",',
        '  "holotype_institution": "string|null — full institution name or known abbreviation",',
        '  "holotype_specimen_type": "holotype|syntype|lectotype|neotype|null",',
        '  "holotype_material": "string|null — concise (≤200 chars) anatomical inventory from the paper, drop catalog numbers from the prose",',
        '  "diagnostic_features": ["3-6 standalone autapomorphy bullets ≤200 chars each, NO comparative-only bullets, NO clade-shared traits"],',
        '  "paleoenvironment": ["schema enum values: fluvial, lacustrine, lagoonal, marine, deltaic, estuarine, paludal, eolian, arid, etc."],',
        '  "synonyms": [{"name": "string", "type": "junior subjective|junior objective|preoccupied|nomen nudum|nomen rejectum|informal", "reason": "string"}],',
        '  "locomotion": "bipedal|quadrupedal|facultative|null",',
        '  "integument": "feathered|armored|scaled|null",',
        '  "size_length_m_min": "number|null",',
        '  "size_length_m_max": "number|null",',
        '  "size_weight_kg_min": "number|null",',
        '  "size_weight_kg_max": "number|null",',
        '  "binomial_in_paper": "string|null (only if differs from above)",',
        '  "paper_quality": "primary|review|popular|translation|other",',
        '  "notes": "string|null (flag anything unusual)"',
        "}",
        "",
        "Rules:",
        "- Do NOT invent material/characters. null/[] when absent.",
        "- Focus only on the target taxon if the paper covers multiple new taxa.",
        `- For diagnostic_features, prefer the paper's explicit "Diagnosis" / "Differential diagnosis" subsection. Each bullet must describe an attribute of ${entry.genus} that stands alone — i.e. it could be read as a property of the genus without referring to any other taxon. REJECT every comparative bullet, including phrasings like "differs from X in...", "shared with X but not Y", "unlike Z", "more X than W", or "as in P, Q". A reader who has never heard of the comparison taxon must still be able to picture the feature.`,
        "- For holotype_material, describe ONLY the holotype specimen's anatomical inventory. Do NOT include referred specimens or paratypes — those go in description text or are omitted.",
        "- For holotype_institution, prefer a known abbreviation (e.g. \"ZPAL\", \"AMNH\", \"IVPP\") rather than the spelled-out institution name.",
        "- For synonyms, only include entries the paper explicitly establishes (preoccupation, junior synonymy, etc.).",
        "- Etymology should be terse and start with the source word(s). Do NOT start with \"The generic name…\".",
        "- Return ONLY the output path as confirmation, nothing else.",
    ].join("\n");
}

/**
 * Resume entry point.
 */
function main(): void
{
    const args = process.argv.slice(2);
    const positional = args.filter((arg) => !arg.startsWith("--"));

    if (positional.length !== 1)
    {
        process.stderr.write("Usage: intake-resume <Genus>\n");
        process.exit(2);
    }

    const genus = positional[0];
    const targetDir = path.join(stagingIntakeDir, genus);

    if (!fs.existsSync(targetDir))
    {
        process.stderr.write(
            `staging/intake/${genus}/ does not exist. Run intake-bootstrap first.\n`,
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

    const missingMarkdown = new Array<string>();
    const extractionsDir = path.join(targetDir, "extractions");
    fs.mkdirSync(extractionsDir, { recursive: true });

    const promptEntries = new Array<IntakePromptEntry>();

    for (const paper of papers.fetched)
    {
        const markdownPath = path.join(corpusMarkdownDir, `${paper.key}.md`);

        if (!fs.existsSync(markdownPath))
        {
            missingMarkdown.push(paper.key);
            continue;
        }

        const outputPath = path.join(extractionsDir, `${paper.key}.json`);

        const partial: Omit<IntakePromptEntry, "prompt"> = {
            genus,
            citation_key: paper.key,
            markdown_path: markdownPath,
            output_path: outputPath,
            is_describing: paper.isDescribing,
        };

        promptEntries.push({
            ...partial,
            prompt: buildIntakePromptString(partial),
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
        "\nNext: dispatch one Haiku 4.5 agent per prompt entry, "
        + "then run `npm run intake-apply -- " + genus + "`.\n",
    );
}

main();
