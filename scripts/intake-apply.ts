// Apply step of the per-genus intake pipeline. Merges the per-paper
// extraction JSON files at `staging/intake/{Genus}/extractions/` into
// `bootstrap.yml` and writes `final.yml`.
//
// Reference metadata is sourced in this priority order:
//
//   1. `dist/references.bib`, when the citation key is already
//      present (common for keys reused across genera).
//   2. A `TODO: fill in from papers-needed.md citation.` placeholder.
//      The skill's apply step is then responsible for replacing the
//      placeholder by reading the user-pasted citation string in
//      `papers-needed.md`. Doing the citation parsing in the skill
//      (rather than in this script) keeps the parsing flexible
//      across the many idiosyncratic citation formats people paste.
//
// Merge rules (describing paper → genus YAML):
//
//   etymology_genus      → genus.etymology
//   etymology_species    → genus.species[0].etymology
//   holotype_*           → genus.species[0].holotype.{specimen_id,
//                          specimen_type, institution, material}
//   diagnostic_features  → genus.diagnostic_features
//   paleoenvironment     → genus.paleoenvironment
//   synonyms             → genus.synonyms
//   locomotion           → genus.locomotion (overwrites bootstrap)
//   integument           → genus.appearance.integument
//   size_*               → genus.species[0].size.{length_m, weight_kg}
//   citation_key         → genus.references[] (with metadata),
//                          genus.species[0].described_in
//
// Supplementary papers append to `diagnostic_features`, `synonyms`,
// and `references`. They do not overwrite scalar fields.
//
// Sentinel JSON (the agent's "extraction failed" output) is skipped
// with a warning.
//
// Usage:
//   npm run intake-apply -- Bagaraatan

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse as parseYamlContent, stringify as stringifyYaml } from "yaml";

import type { GenusData } from "./types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingIntakeDir = path.join(root, "staging", "intake");
const referencesBibPath = path.join(root, "dist", "references.bib");

/**
 * Shape of one per-paper extraction JSON written by the intake agent.
 */
type IntakeExtraction = {
    genus: string;
    citation_key: string;
    is_describing: boolean;
    type_species?: string | null;
    etymology_genus?: string | null;
    etymology_species?: string | null;
    holotype_specimen_id?: string | null;
    holotype_institution?: string | null;
    holotype_specimen_type?: string | null;
    holotype_material?: string | null;
    diagnostic_features?: Array<string>;
    paleoenvironment?: Array<string>;
    synonyms?: Array<{ name: string; type: string; reason: string }>;
    locomotion?: string | null;
    integument?: string | null;
    size_length_m_min?: number | null;
    size_length_m_max?: number | null;
    size_weight_kg_min?: number | null;
    size_weight_kg_max?: number | null;
    binomial_in_paper?: string | null;
    paper_quality?: string;
    notes?: string | null;
    empty?: boolean;
};

/**
 * One reference entry as it appears in genus YAML files.
 */
type ReferenceEntry = {
    id: string;
    authors?: string;
    year?: number;
    title?: string;
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    publisher?: string;
    doi?: string;
    url?: string;
    notes?: string;
};

/**
 * Parses `dist/references.bib` and returns a citation-key → metadata
 * map. Only the fields the genus YAML schema cares about are returned.
 *
 * @returns Citation-key indexed reference metadata.
 */
function readBibReferences(): Map<string, ReferenceEntry>
{
    const result = new Map<string, ReferenceEntry>();

    if (!fs.existsSync(referencesBibPath))
    {
        return result;
    }

    const content = fs.readFileSync(referencesBibPath, "utf8");
    const entryPattern = /@\w+\{([^,]+),([^@]+)/g;
    let entryMatch: RegExpExecArray | null;

    while ((entryMatch = entryPattern.exec(content)) !== null)
    {
        const key = entryMatch[1].trim();
        const body = entryMatch[2];
        const fields: Record<string, string> = {};

        const fieldPattern = /(\w+)\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
        let fieldMatch: RegExpExecArray | null;

        while ((fieldMatch = fieldPattern.exec(body)) !== null)
        {
            fields[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
        }

        const entry: ReferenceEntry = { id: key };

        if (fields.author)
        {
            entry.authors = fields.author;
        }

        if (fields.year)
        {
            entry.year = parseInt(fields.year, 10);
        }

        if (fields.title)
        {
            entry.title = fields.title;
        }

        if (fields.journal)
        {
            entry.journal = fields.journal;
        }

        if (fields.volume)
        {
            entry.volume = fields.volume;
        }

        if (fields.number)
        {
            entry.issue = fields.number;
        }

        if (fields.pages)
        {
            entry.pages = fields.pages;
        }

        if (fields.publisher)
        {
            entry.publisher = fields.publisher;
        }

        if (fields.doi)
        {
            entry.doi = fields.doi;
            entry.url = `http://dx.doi.org/${fields.doi}`;
        }

        result.set(key, entry);
    }

    return result;
}

/**
 * Builds a reference entry for a citation key. Falls back to a
 * placeholder when the key is not in `dist/references.bib` — the
 * skill's apply step is responsible for filling those placeholders
 * in by reading the citation text the user pasted into
 * `papers-needed.md`.
 *
 * @param key - Citation key.
 * @param bibIndex - Map of citation key → metadata parsed from bib.
 * @returns The reference entry to add to `genus.references`.
 */
function buildReferenceEntry(
    key: string,
    bibIndex: Map<string, ReferenceEntry>,
): ReferenceEntry
{
    const fromBib = bibIndex.get(key);

    if (fromBib)
    {
        return fromBib;
    }

    return {
        id: key,
        notes: "TODO: fill in from papers-needed.md citation.",
    };
}

/**
 * Returns a new GenusData object with top-level keys arranged in the
 * project's canonical order. Keys not in the canonical list are
 * appended afterward. Species blocks are also reordered field-wise.
 *
 * @param genus - Source genus data.
 * @returns Genus data with stable, human-readable key order.
 */
function reorderGenus(genus: GenusData): GenusData
{
    const topLevelOrder = [
        "genus",
        "parent",
        "etymology",
        "pronunciation",
        "description",
        "diet",
        "locomotion",
        "paleoenvironment",
        "diagnostic_features",
        "appearance",
        "identifiers",
        "synonyms",
        "species",
        "references",
    ];

    const speciesOrder = [
        "name",
        "etymology",
        "status",
        "type_species",
        "period",
        "location",
        "holotype",
        "size",
        "described",
        "authors",
        "described_in",
    ];

    const ordered: Record<string, unknown> = {};
    const source = genus as Record<string, unknown>;

    for (const key of topLevelOrder)
    {
        if (key in source && source[key] !== undefined)
        {
            ordered[key] = source[key];
        }
    }

    for (const key of Object.keys(source))
    {
        if (!(key in ordered))
        {
            ordered[key] = source[key];
        }
    }

    if (Array.isArray(ordered.species))
    {
        ordered.species = (ordered.species as Array<Record<string, unknown>>).map(
            (species) =>
            {
                const orderedSpecies: Record<string, unknown> = {};

                for (const key of speciesOrder)
                {
                    if (key in species && species[key] !== undefined)
                    {
                        orderedSpecies[key] = species[key];
                    }
                }

                for (const key of Object.keys(species))
                {
                    if (!(key in orderedSpecies))
                    {
                        orderedSpecies[key] = species[key];
                    }
                }

                return orderedSpecies;
            },
        );
    }

    return ordered as GenusData;
}

/**
 * Applies one extraction record onto the genus data in place. The
 * describing-paper extraction sets scalar fields and seeds arrays;
 * supplementary extractions only append to arrays.
 *
 * @param genus - Genus data (mutated).
 * @param extraction - Parsed extraction JSON.
 * @param bibIndex - Reference metadata lookup.
 * @returns Empty array on success, otherwise warning strings.
 */
function applyExtraction(
    genus: GenusData,
    extraction: IntakeExtraction,
    bibIndex: Map<string, ReferenceEntry>,
): Array<string>
{
    const warnings = new Array<string>();

    if (extraction.empty)
    {
        warnings.push(
            `Skipping ${extraction.citation_key}: agent reported empty/boilerplate markdown.`,
        );

        return warnings;
    }

    if (!Array.isArray(genus.species) || genus.species.length === 0)
    {
        warnings.push(
            "bootstrap.yml has no species[] block — applying paper extractions"
            + " requires at least the type species block from bootstrap.",
        );

        return warnings;
    }

    const species = genus.species[0] as Record<string, unknown>;

    if (extraction.is_describing)
    {
        if (extraction.etymology_genus && !genus.etymology)
        {
            genus.etymology = extraction.etymology_genus;
        }

        if (extraction.etymology_species && !species.etymology)
        {
            species.etymology = extraction.etymology_species;
        }

        if (extraction.holotype_specimen_id || extraction.holotype_material)
        {
            const holotypeBlock: Record<string, unknown> = (species.holotype as Record<string, unknown>) ?? {};

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

            species.holotype = holotypeBlock;
        }

        if (extraction.paleoenvironment && extraction.paleoenvironment.length > 0)
        {
            genus.paleoenvironment = extraction.paleoenvironment;
        }

        if (extraction.locomotion && !genus.locomotion)
        {
            genus.locomotion = extraction.locomotion;
        }
        else if (extraction.locomotion && extraction.locomotion !== genus.locomotion)
        {
            // Paper-derived value beats bootstrap inference.
            genus.locomotion = extraction.locomotion;
        }

        if (extraction.integument)
        {
            const appearance = (genus.appearance as Record<string, unknown> | undefined) ?? {};
            appearance.integument = extraction.integument;
            (genus as Record<string, unknown>).appearance = appearance;
        }

        if (extraction.size_length_m_min !== null && extraction.size_length_m_min !== undefined
            || extraction.size_weight_kg_min !== null && extraction.size_weight_kg_min !== undefined)
        {
            const size: Record<string, unknown> = (species.size as Record<string, unknown>) ?? {};

            if (extraction.size_length_m_min !== null && extraction.size_length_m_min !== undefined)
            {
                size.length_m = {
                    min: extraction.size_length_m_min,
                    max: extraction.size_length_m_max ?? extraction.size_length_m_min,
                };
            }

            if (extraction.size_weight_kg_min !== null && extraction.size_weight_kg_min !== undefined)
            {
                size.weight_kg = {
                    min: extraction.size_weight_kg_min,
                    max: extraction.size_weight_kg_max ?? extraction.size_weight_kg_min,
                };
            }

            species.size = size;
        }

        species.described_in = extraction.citation_key;
    }

    // Diagnostic features and synonyms accumulate from every paper.
    if (Array.isArray(extraction.diagnostic_features) && extraction.diagnostic_features.length > 0)
    {
        const existing = Array.isArray(genus.diagnostic_features)
            ? genus.diagnostic_features
            : [];
        const merged = [...existing];

        for (const feature of extraction.diagnostic_features)
        {
            if (!merged.includes(feature))
            {
                merged.push(feature);
            }
        }

        genus.diagnostic_features = merged;
    }

    if (Array.isArray(extraction.synonyms) && extraction.synonyms.length > 0)
    {
        const existing = Array.isArray(genus.synonyms) ? genus.synonyms : [];
        const merged = [...existing];

        for (const synonym of extraction.synonyms)
        {
            if (!merged.some((entry) => entry.name === synonym.name))
            {
                merged.push(synonym);
            }
        }

        genus.synonyms = merged;
    }

    // Append the reference (idempotent).
    const referenceList = Array.isArray(genus.references) ? genus.references : [];
    const alreadyReferenced = referenceList.some((reference) => reference.id === extraction.citation_key);

    if (!alreadyReferenced)
    {
        const referenceEntry = buildReferenceEntry(extraction.citation_key, bibIndex);

        // For supplementary papers, surface the agent's `notes`
        // field on the reference entry so the genus YAML records
        // the paper's role (e.g. "Reassessment that disentangled
        // the chimeric holotype..."). Describing-paper notes are
        // typically about the taxon itself rather than the paper's
        // role, so we leave them off the reference.
        if (!extraction.is_describing && extraction.notes)
        {
            referenceEntry.notes = extraction.notes;
        }

        genus.references = [...referenceList, referenceEntry];
    }

    return warnings;
}

/**
 * Apply entry point.
 */
function main(): void
{
    const args = process.argv.slice(2);
    const positional = args.filter((arg) => !arg.startsWith("--"));

    if (positional.length !== 1)
    {
        process.stderr.write("Usage: intake-apply <Genus>\n");
        process.exit(2);
    }

    const genus = positional[0];
    const targetDir = path.join(stagingIntakeDir, genus);

    if (!fs.existsSync(targetDir))
    {
        process.stderr.write(`staging/intake/${genus}/ does not exist.\n`);
        process.exit(1);
    }

    const bootstrapPath = path.join(targetDir, "bootstrap.yml");

    if (!fs.existsSync(bootstrapPath))
    {
        process.stderr.write(`Missing ${bootstrapPath}\n`);
        process.exit(1);
    }

    const extractionsDir = path.join(targetDir, "extractions");

    if (!fs.existsSync(extractionsDir))
    {
        process.stderr.write(
            `Missing ${extractionsDir} — run intake-resume and dispatch agents first.\n`,
        );
        process.exit(1);
    }

    const extractionFiles = fs.readdirSync(extractionsDir)
        .filter((name) => name.endsWith(".json"))
        .sort();

    if (extractionFiles.length === 0)
    {
        process.stderr.write(
            `No extraction JSON files found in ${extractionsDir}.\n`
            + "Dispatch agents against staging/intake/" + genus + "/prompts.jsonl first.\n",
        );
        process.exit(1);
    }

    const bootstrap = parseYamlContent(fs.readFileSync(bootstrapPath, "utf8")) as GenusData;
    const bibIndex = readBibReferences();

    process.stdout.write(`Applying extractions for ${genus}...\n`);
    process.stdout.write(`  Bib metadata loaded: ${bibIndex.size} entries\n`);

    const allWarnings = new Array<string>();

    // Apply describing paper(s) first so that scalar overrides land
    // before supplementary appends.
    const extractions = extractionFiles.map((filename) =>
    {
        const filePath = path.join(extractionsDir, filename);
        const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as IntakeExtraction;
        return { filename, data };
    });

    extractions.sort((a, b) =>
    {
        if (a.data.is_describing && !b.data.is_describing) return -1;
        if (!a.data.is_describing && b.data.is_describing) return 1;
        return a.filename.localeCompare(b.filename);
    });

    for (const { filename, data } of extractions)
    {
        const role = data.is_describing ? "describing" : "supplementary";
        process.stdout.write(`  Apply ${filename} (${role}, ${data.citation_key})\n`);

        const warnings = applyExtraction(bootstrap, data, bibIndex);

        for (const warning of warnings)
        {
            allWarnings.push(warning);
            process.stderr.write(`    WARN: ${warning}\n`);
        }
    }

    const finalPath = path.join(targetDir, "final.yml");
    fs.writeFileSync(
        finalPath,
        stringifyYaml(reorderGenus(bootstrap), { lineWidth: 80 }),
        "utf8",
    );

    process.stdout.write(`\nWrote ${finalPath}\n`);

    if (allWarnings.length > 0)
    {
        process.stdout.write(`(${allWarnings.length} warning${allWarnings.length === 1 ? "" : "s"})\n`);
    }
}

main();
