// Steps the genus and species intake scripts share: reading papers-needed.md,
// checking the fetched papers before prompts are built, loading the agents'
// extractions, and merging them into the record being assembled.

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { getCorpusDir } from "./corpus-path.ts";
import type { GenusData } from "./types.ts";
import {
    readStoreCitationKeys,
    referenceNotesLimit,
    resolveCitationKey,
    storeReferencePath,
} from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

/**
 * Parsed papers-needed.md: the citation keys the user has marked fetched, in
 * the order they appear, plus which one is the describing paper.
 */
export type ParsedPapers = {
    /**
     * Citation keys the user has explicitly marked complete via `[x]`. The
     * first entry under "## Describing paper" is treated as the describing
     * paper.
     */
    fetched: Array<{ key: string; isDescribing: boolean }>;

    /**
     * Citation keys still marked as `[ ]` (unfetched). Surfaced in the resume
     * report so the user knows what is blocking progress.
     */
    pending: Array<string>;
};

/**
 * Parses papers-needed.md into fetched and pending citation keys.
 *
 * @param markdown - The file's text.
 * @returns The fetched and pending keys.
 */
export function parsePapersNeeded(markdown: string): ParsedPapers
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

        // Skip the placeholder template entry from the optional section and
        // the "Describing paper unknown" sentinel.
        if (key === "citation_key" || /unknown/i.test(key))
        {
            continue;
        }
        else if (match[1] === "x" || match[1] === "X")
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
 * Parses a resume script's arguments: its positional names and an optional
 * `--corpus <path>`.
 *
 * @param argv - Raw arguments (typically `process.argv.slice(2)`).
 * @param positionalCount - How many positional arguments the script takes.
 * @param usage - The usage line shown when the count is wrong.
 * @returns The positional arguments and the corpus directory.
 * @throws Error naming an unknown flag, or the usage line.
 */
export function parseResumeArguments(
    argv: Array<string>,
    positionalCount: number,
    usage: string): { positional: Array<string>; corpusDir: string }
{
    const positional = new Array<string>();
    let corpusDir = getCorpusDir();

    for (let index = 0; index < argv.length; index += 1)
    {
        const argument = argv[index];

        if (argument === "--corpus")
        {
            corpusDir = argv[index + 1] ?? corpusDir;
            index += 1;
        }
        else if (argument.startsWith("--"))
        {
            throw new Error(`Unknown argument: ${argument}`);
        }
        else
        {
            positional.push(argument);
        }
    }

    if (positional.length !== positionalCount)
    {
        throw new Error(usage);
    }

    return { positional, corpusDir };
}

/**
 * Checks a staged intake before its prompts are built, exiting with a message
 * on the first problem: papers-needed.md and the corpus markdown directory
 * must exist, at least one paper must be ticked, no ticked key may collide
 * with a store key's disambiguation, and every ticked paper must have its
 * markdown in the corpus. Creates the extractions directory the agents write
 * to.
 *
 * @param targetDir - The intake's staging directory.
 * @param corpusDir - The corpus root.
 * @returns The parsed papers, each fetched paper's markdown path, and the
 *     extractions directory.
 */
export function prepareResume(
    targetDir: string,
    corpusDir: string): { papers: ParsedPapers; markdownPaths: Map<string, string>; extractionsDir: string }
{
    const corpusMarkdownDir = path.join(corpusDir, "markdown");
    const papersNeededPath = path.join(targetDir, "papers-needed.md");

    if (!fs.existsSync(papersNeededPath))
    {
        process.stderr.write(`Missing ${papersNeededPath}\n`);
        process.exit(1);
    }
    else if (!fs.existsSync(corpusMarkdownDir))
    {
        process.stderr.write(`Corpus markdown directory not found at ${corpusMarkdownDir}\n`);
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

    // A pasted bare key (`funston2020`) collides with the store's
    // disambiguated ones (`funston2020a`, `funston2020b`). The store, not the
    // built references.bib, is checked: the build lags main.
    const storeKeys = readStoreCitationKeys(root);
    const collisions = papers.fetched
        .map((paper) => ({ key: paper.key, resolution: resolveCitationKey(paper.key, storeKeys) }))
        .filter(({ resolution }) => resolution.collided);

    if (collisions.length > 0)
    {
        process.stderr.write("Citation key collisions detected:\n");

        for (const { key, resolution } of collisions)
        {
            process.stderr.write(`  - "${key}": ${resolution.reason ?? ""}\n`);
            process.stderr.write(
                `    Use "${resolution.resolvedKey}" instead. Update papers-needed.md and rename `
                + `${corpusMarkdownDir}/${key}.md → ${resolution.resolvedKey}.md.\n`,
            );
        }

        process.exit(1);
    }

    const extractionsDir = path.join(targetDir, "extractions");
    fs.mkdirSync(extractionsDir, { recursive: true });

    const markdownPaths = new Map(papers.fetched.map((paper) => [paper.key, path.join(corpusMarkdownDir, `${paper.key}.md`)]));
    const missingMarkdown = [...markdownPaths].filter(([, markdownPath]) => !fs.existsSync(markdownPath));

    if (missingMarkdown.length > 0)
    {
        process.stderr.write(
            "The following papers are marked fetched in papers-needed.md but "
            + "are missing from the corpus markdown directory:\n",
        );

        for (const [, markdownPath] of missingMarkdown)
        {
            process.stderr.write(`  - ${markdownPath}\n`);
        }

        process.stderr.write("\nFix the corpus and re-run.\n");
        process.exit(1);
    }

    return { papers, markdownPaths, extractionsDir };
}

/**
 * Writes the prompt entries to `prompts.jsonl`, one JSON object per line.
 *
 * @param targetDir - The intake's staging directory.
 * @param entries - The prompt entries.
 * @returns The path written.
 */
export function writePrompts(targetDir: string, entries: Array<unknown>): string
{
    const promptsPath = path.join(targetDir, "prompts.jsonl");

    fs.writeFileSync(promptsPath, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");

    return promptsPath;
}

/**
 * Reads the agents' extraction files, describing paper first and the rest by
 * file name, so the describing paper's scalar fields land before the
 * supplementary papers append to lists.
 *
 * @param extractionsDir - The directory the agents wrote to.
 * @param filenames - The extraction file names to read.
 * @returns Each file's name and parsed extraction.
 */
export function readExtractions<Extraction extends { is_describing: boolean }>(
    extractionsDir: string,
    filenames: Array<string>): Array<{ filename: string; data: Extraction }>
{
    const extractions = filenames.map((filename) => ({
        filename,
        data: JSON.parse(fs.readFileSync(path.join(extractionsDir, filename), "utf8")) as Extraction,
    }));

    return extractions.sort((first, second) =>
    {
        if (first.data.is_describing && !second.data.is_describing)
        {
            return -1;
        }
        else if (!first.data.is_describing && second.data.is_describing)
        {
            return 1;
        }

        return first.filename.localeCompare(second.filename);
    });
}

/**
 * The holotype fields an intake extraction carries.
 */
type HolotypeFields = {
    /**
     * Holotype catalog number.
     */
    holotype_specimen_id?: string | null;

    /**
     * holotype, syntype, lectotype or neotype.
     */
    holotype_specimen_type?: string | null;

    /**
     * Holding institution.
     */
    holotype_institution?: string | null;

    /**
     * Anatomical inventory of the type specimen.
     */
    holotype_material?: string | null;
};

/**
 * Writes an extraction's holotype fields into a species block's
 * `type_specimen`, defaulting `specimen_type` to holotype when neither side
 * gives one.
 *
 * @param species - The species block (mutated).
 * @param extraction - The extraction's holotype fields.
 */
export function mergeHolotype(species: Record<string, unknown>, extraction: HolotypeFields): void
{
    const holotypeBlock: Record<string, unknown> = (species.type_specimen as Record<string, unknown>) ?? {};

    if (extraction.holotype_specimen_id)
    {
        holotypeBlock.specimen_id = [extraction.holotype_specimen_id];
    }

    if (extraction.holotype_specimen_type)
    {
        holotypeBlock.specimen_type = extraction.holotype_specimen_type;
    }
    else if (!holotypeBlock.specimen_type)
    {
        holotypeBlock.specimen_type = "holotype";
    }

    if (extraction.holotype_institution)
    {
        holotypeBlock.institution = extraction.holotype_institution;
    }

    if (extraction.holotype_material)
    {
        holotypeBlock.material = extraction.holotype_material;
    }

    species.type_specimen = holotypeBlock;
}

/**
 * The size fields an intake extraction carries.
 */
type SizeFields = {
    /**
     * Shortest length estimate, in m.
     */
    size_length_m_min?: number | null;

    /**
     * Longest length estimate, in m.
     */
    size_length_m_max?: number | null;

    /**
     * Lightest mass estimate, in kg.
     */
    size_weight_kg_min?: number | null;

    /**
     * Heaviest mass estimate, in kg.
     */
    size_weight_kg_max?: number | null;
};

/**
 * Writes an extraction's length and weight ranges into a species block's
 * `size`, when the extraction gives either. A range with no maximum is a
 * single value.
 *
 * @param species - The species block (mutated).
 * @param extraction - The extraction's size fields.
 */
export function mergeSize(species: Record<string, unknown>, extraction: SizeFields): void
{
    const hasLength = extraction.size_length_m_min !== null && extraction.size_length_m_min !== undefined;
    const hasWeight = extraction.size_weight_kg_min !== null && extraction.size_weight_kg_min !== undefined;

    if (!hasLength && !hasWeight)
    {
        return;
    }

    const size: Record<string, unknown> = (species.size as Record<string, unknown>) ?? {};

    if (hasLength)
    {
        size.length_m = {
            min: extraction.size_length_m_min,
            max: extraction.size_length_m_max ?? extraction.size_length_m_min,
        };
    }

    if (hasWeight)
    {
        size.weight_kg = {
            min: extraction.size_weight_kg_min,
            max: extraction.size_weight_kg_max ?? extraction.size_weight_kg_min,
        };
    }

    species.size = size;
}

/**
 * Appends to a list the additions it does not already hold, so every paper's
 * diagnostic features and synonyms accumulate without repeats.
 *
 * @param existing - The current value, used when it is a list.
 * @param additions - The items to add.
 * @param same - Whether two items are the same entry.
 * @returns The merged list.
 */
export function mergeUnique<Item>(existing: unknown, additions: Array<Item>, same: (first: Item, second: Item) => boolean): Array<Item>
{
    const merged = Array.isArray(existing) ? [...existing as Array<Item>] : new Array<Item>();

    for (const addition of additions)
    {
        if (!merged.some((item) => same(item, addition)))
        {
            merged.push(addition);
        }
    }

    return merged;
}

/**
 * Cites an extraction's paper from the genus with an `{id, notes?}` pointer,
 * once. A supplementary paper's notes become the pointer's notes. A paper
 * with no store entry yet, in the store or staged beside the intake, cannot
 * be cited: its notes are stashed under `pending-notes/` and a warning says
 * which store file to add before re-running apply.
 *
 * @param genus - The genus record (mutated).
 * @param extraction - The extraction's citation key, role and notes.
 * @param stagingDir - The intake's staging directory.
 * @returns Warnings for the operator.
 */
export function appendReferencePointer(
    genus: GenusData,
    extraction: { citation_key: string; is_describing: boolean; notes?: string | null },
    stagingDir: string): Array<string>
{
    const warnings = new Array<string>();
    const referenceList = Array.isArray(genus.references) ? genus.references : [];
    const key = extraction.citation_key;

    if (referenceList.some((reference) => reference.id === key))
    {
        return warnings;
    }

    const storePath = storeReferencePath(root, key);

    // The genus bootstrap stages a new describing paper's entry beside the
    // stub; promote.sh moves it into the store, so it counts as present here.
    const inStore = fs.existsSync(storePath) || fs.existsSync(storeReferencePath(stagingDir, key));

    // Supplementary papers record their role as per-citation `notes` on the
    // pointer; describing-paper notes are about the taxon, so they are left
    // off the citation.
    const localNotes = (!extraction.is_describing && extraction.notes) ? extraction.notes : undefined;

    if (localNotes && localNotes.length > referenceNotesLimit)
    {
        warnings.push(
            `Reference ${key}: notes run to ${localNotes.length} characters, over the `
            + `${referenceNotesLimit}-character budget the validator warns at. Trim to the `
            + "paper's role in one sentence before promoting.",
        );
    }

    if (!inStore)
    {
        // A pointer must resolve to a complete store entry. The skill adds the
        // store file from the papers-needed.md citation, then re-runs apply,
        // which restores the notes from the extraction.
        const pendingDir = path.join(stagingDir, "pending-notes");

        if (localNotes)
        {
            fs.mkdirSync(pendingDir, { recursive: true });
            fs.writeFileSync(path.join(pendingDir, `${key}.txt`), localNotes, "utf8");
        }

        warnings.push(
            `Reference ${key}: no reference-store entry yet; citation skipped. `
            + `Add ${path.relative(root, storePath)} `
            + "from the papers-needed.md citation"
            + (localNotes ? `; agent notes stashed at ${path.relative(root, pendingDir)}/${key}.txt` : "")
            + ", then re-run apply.",
        );
    }
    else
    {
        genus.references = [...referenceList, localNotes ? { id: key, notes: localNotes } : { id: key }];
    }

    return warnings;
}

/**
 * Top-level genus keys in the order most genus files write them. Keys not
 * listed follow, in their existing order.
 */
const genusKeyOrder = [
    "genus",
    "parent",
    "placement",
    "dispute",
    "etymology",
    "pronunciation",
    "description",
    "diet",
    "locomotion",
    "paleoenvironment",
    "diagnostic_features",
    "appearance",
    "status",
    "identifiers",
    "erected_in",
    "synonyms",
    "iczn_cases",
    "species",
    "notable_specimens",
    "references",
];

/**
 * Species keys in the order most genus files write them. Keys not listed
 * follow, in their existing order.
 */
const speciesKeyOrder = [
    "name",
    "etymology",
    "status",
    "type_species",
    "period",
    "location",
    "size",
    "type_specimen",
    "diagnostic_features",
    "paleoenvironment",
    "synonyms",
    "erected_in",
    "described_in",
];

/**
 * Copies a record with its keys in a given order; keys the order does not
 * list follow in their existing order.
 *
 * @param record - The record to reorder.
 * @param order - The keys to put first, in order.
 * @returns The reordered copy.
 */
function orderKeys(record: Record<string, unknown>, order: Array<string>): Record<string, unknown>
{
    const ordered: Record<string, unknown> = {};

    for (const key of order)
    {
        if (key in record && record[key] !== undefined)
        {
            ordered[key] = record[key];
        }
    }

    for (const key of Object.keys(record))
    {
        if (!(key in ordered))
        {
            ordered[key] = record[key];
        }
    }

    return ordered;
}

/**
 * Returns a species block in the house key order.
 *
 * @param species - The species block.
 * @returns The reordered copy.
 */
export function orderSpeciesKeys(species: Record<string, unknown>): Record<string, unknown>
{
    return orderKeys(species, speciesKeyOrder);
}

/**
 * Returns a genus record in the house key order, its species blocks
 * included.
 *
 * @param genus - The genus record.
 * @returns The reordered copy.
 */
export function orderGenusKeys(genus: GenusData): GenusData
{
    const ordered = orderKeys(genus as Record<string, unknown>, genusKeyOrder);

    if (Array.isArray(ordered.species))
    {
        ordered.species = (ordered.species as Array<Record<string, unknown>>).map(orderSpeciesKeys);
    }

    return ordered as GenusData;
}
