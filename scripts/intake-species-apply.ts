// Apply step of the per-species intake pipeline. Merges the
// per-paper extraction JSON files at
// `staging/intake-species/{Genus}-{species}/extractions/` into the
// PBDB-seeded species block and writes a proposed merged
// `genus-proposed.yml` that promote.sh will swap over the live
// genus YAML.
//
// Reference handling mirrors intake-apply: a citation is added as an
// `{id, notes?}` pointer when its store file
// `references/<letter>/<key>.yml` exists; otherwise the citation is
// skipped with a warning (a pointer must resolve to a complete store
// entry) and any supplementary agent notes are stashed under
// `pending-notes/` for the skill to restore after the store entry is
// created and apply is re-run.
//
// Merge rules (describing paper → new species block + genus extras):
//
//   etymology_species    → species.etymology
//   holotype_*           → species.type_specimen.{specimen_id, type, institution, material}
//   diagnostic_features  → species.diagnostic_features (species-level array;
//                          falls back to genus-level if the genus has one and
//                          the species has none)
//   paleoenvironment     → species.paleoenvironment (only if differs)
//   period_*             → species.period.{name, stage, from_ma, to_ma}
//   location_*           → species.location.{country, region, formation,
//                          locality, coordinates}
//   size_*               → species.size.{length_m, weight_kg}
//   citation_key         → species.erected_in (describing paper) +
//                          genus.references[] (carries the described_year /
//                          described_authors, from which author/year derive)
//   synonyms             → species.synonyms
//
// Usage:
//   npm run intake-species-apply -- Pinacosaurus hilwitnorum

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse as parseYamlContent, stringify as stringifyYaml } from "yaml";

import type { GenusData, Species } from "./types.ts";
import { referenceBucket, referenceNotesLimit, writeStatusEvidence } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingDir = path.join(root, "staging", "intake-species");

/**
 * Shape of one per-paper extraction JSON written by the species
 * intake agent.
 */
type SpeciesExtraction = {
    genus: string;
    species: string;
    citation_key: string;
    is_describing: boolean;
    binomial_in_paper?: string | null;
    etymology_species?: string | null;
    holotype_specimen_id?: string | null;
    holotype_institution?: string | null;
    holotype_specimen_type?: string | null;
    holotype_material?: string | null;
    diagnostic_features?: Array<string>;
    paleoenvironment?: Array<string>;
    period_name?: Array<string>;
    period_stage?: Array<string>;
    period_from_ma?: number | null;
    period_to_ma?: number | null;
    location_country?: string | null;
    location_region?: string | null;
    location_formation?: string | null;
    location_locality?: string | null;
    location_coordinates?: Array<number> | null;
    size_length_m_min?: number | null;
    size_length_m_max?: number | null;
    size_weight_kg_min?: number | null;
    size_weight_kg_max?: number | null;
    described_year?: number | null;
    described_authors?: string | null;
    synonyms?: Array<{ name: string; type: string; reason: string }>;
    paper_quality?: string;
    status_assessment?: string | null;
    status_quote?: string | null;
    notes?: string | null;
    empty?: boolean;
};

/**
 * Returns the species block in the project's canonical key order. Any
 * non-canonical keys are appended afterward.
 *
 * @param species - The species block to reorder.
 * @returns A new object with stable key order.
 */
function reorderSpecies(species: Record<string, unknown>): Record<string, unknown>
{
    const order = [
        "name",
        "etymology",
        "status",
        "type_species",
        "period",
        "location",
        "holotype",
        "size",
        "diagnostic_features",
        "paleoenvironment",
        "synonyms",
        "described",
        "authors",
        "described_in",
    ];

    const ordered: Record<string, unknown> = {};

    for (const key of order)
    {
        if (key in species && species[key] !== undefined)
        {
            ordered[key] = species[key];
        }
    }

    for (const key of Object.keys(species))
    {
        if (!(key in ordered))
        {
            ordered[key] = species[key];
        }
    }

    return ordered;
}

/**
 * Applies a single extraction onto the in-progress species block.
 * Mutates `species` in place. The describing paper sets scalar
 * fields; supplementary papers only append to arrays.
 *
 * @param species - Species block under construction.
 * @param extraction - Parsed extraction JSON.
 * @returns Warning strings (empty on success).
 */
function applyExtractionToSpecies(
    species: Record<string, unknown>,
    extraction: SpeciesExtraction,
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

    if (extraction.is_describing)
    {
        if (extraction.etymology_species && !species.etymology)
        {
            species.etymology = extraction.etymology_species;
        }

        if (extraction.holotype_specimen_id
            || extraction.holotype_material
            || extraction.holotype_institution
            || extraction.holotype_specimen_type)
        {
            const holotypeBlock: Record<string, unknown> =
                (species.type_specimen as Record<string, unknown>) ?? {};

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

        if (extraction.period_name || extraction.period_stage
            || extraction.period_from_ma !== null && extraction.period_from_ma !== undefined
            || extraction.period_to_ma !== null && extraction.period_to_ma !== undefined)
        {
            const periodBlock: Record<string, unknown> =
                (species.period as Record<string, unknown>) ?? {};

            if (extraction.period_name && extraction.period_name.length > 0)
            {
                periodBlock.name = extraction.period_name;
            }

            if (extraction.period_stage && extraction.period_stage.length > 0)
            {
                periodBlock.stage = extraction.period_stage;
            }

            if (extraction.period_from_ma !== null && extraction.period_from_ma !== undefined)
            {
                periodBlock.from_ma = extraction.period_from_ma;
            }

            if (extraction.period_to_ma !== null && extraction.period_to_ma !== undefined)
            {
                periodBlock.to_ma = extraction.period_to_ma;
            }

            species.period = periodBlock;
        }

        if (extraction.location_country || extraction.location_region
            || extraction.location_formation || extraction.location_locality
            || extraction.location_coordinates)
        {
            const locationBlock: Record<string, unknown> =
                (species.location as Record<string, unknown>) ?? {};

            if (extraction.location_country)
            {
                locationBlock.country = extraction.location_country;
            }

            if (extraction.location_region)
            {
                locationBlock.region = extraction.location_region;
            }

            if (extraction.location_formation)
            {
                locationBlock.formation = extraction.location_formation;
            }

            if (extraction.location_locality)
            {
                locationBlock.locality = extraction.location_locality;
            }

            if (extraction.location_coordinates && extraction.location_coordinates.length === 2)
            {
                locationBlock.coordinates = extraction.location_coordinates;
            }

            species.location = locationBlock;
        }

        if (extraction.size_length_m_min !== null && extraction.size_length_m_min !== undefined
            || extraction.size_weight_kg_min !== null && extraction.size_weight_kg_min !== undefined)
        {
            const sizeBlock: Record<string, unknown> =
                (species.size as Record<string, unknown>) ?? {};

            if (extraction.size_length_m_min !== null && extraction.size_length_m_min !== undefined)
            {
                sizeBlock.length_m = {
                    min: extraction.size_length_m_min,
                    max: extraction.size_length_m_max ?? extraction.size_length_m_min,
                };
            }

            if (extraction.size_weight_kg_min !== null && extraction.size_weight_kg_min !== undefined)
            {
                sizeBlock.weight_kg = {
                    min: extraction.size_weight_kg_min,
                    max: extraction.size_weight_kg_max ?? extraction.size_weight_kg_min,
                };
            }

            species.size = sizeBlock;
        }

        // The describing paper erects the new species; author/year are derived
        // from this reference at build time (issue #1886).
        species.erected_in = extraction.citation_key;
    }

    if (Array.isArray(extraction.diagnostic_features)
        && extraction.diagnostic_features.length > 0)
    {
        const existing = Array.isArray(species.diagnostic_features)
            ? species.diagnostic_features as Array<string>
            : [];
        const merged = [...existing];

        for (const feature of extraction.diagnostic_features)
        {
            if (!merged.includes(feature))
            {
                merged.push(feature);
            }
        }

        species.diagnostic_features = merged;
    }

    if (Array.isArray(extraction.paleoenvironment)
        && extraction.paleoenvironment.length > 0)
    {
        species.paleoenvironment = extraction.paleoenvironment;
    }

    if (Array.isArray(extraction.synonyms) && extraction.synonyms.length > 0)
    {
        const existing = Array.isArray(species.synonyms)
            ? species.synonyms as Array<{ name: string }>
            : [];
        const merged = [...existing];

        for (const synonym of extraction.synonyms)
        {
            if (!merged.some((entry) => entry.name === synonym.name))
            {
                merged.push(synonym);
            }
        }

        species.synonyms = merged;
    }

    return warnings;
}

/**
 * Appends a citation pointer to the genus references list (idempotent).
 * Adds an `{id, notes?}` pointer when the citation's reference-store file
 * exists; otherwise skips it with a warning and stashes any
 * supplementary-paper notes so the skill can restore them once the store
 * entry is created (step 4b) and apply is re-run.
 *
 * @param genus - Genus data (mutated).
 * @param extraction - Parsed extraction JSON.
 * @param targetDir - Staging directory (for pending-notes/).
 * @returns Warning strings.
 */
function appendReference(
    genus: GenusData,
    extraction: SpeciesExtraction,
    targetDir: string,
): Array<string>
{
    const warnings = new Array<string>();
    const referenceList = Array.isArray(genus.references) ? genus.references : [];
    const alreadyReferenced = referenceList.some(
        (reference) => reference.id === extraction.citation_key,
    );

    if (alreadyReferenced)
    {
        return warnings;
    }

    const key = extraction.citation_key;
    const inStore = fs.existsSync(
        path.join(root, "references", referenceBucket(key), `${key}.yml`));

    const localNotes = (!extraction.is_describing && extraction.notes)
        ? extraction.notes
        : undefined;

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
        // No store entry yet, so the paper cannot be cited (a pointer must
        // resolve to a complete store entry). Stash any notes and warn; the
        // SKILL adds the store file from papers-needed.md, then re-runs apply.
        if (localNotes)
        {
            const pendingDir = path.join(targetDir, "pending-notes");
            fs.mkdirSync(pendingDir, { recursive: true });
            fs.writeFileSync(
                path.join(pendingDir, `${key}.txt`),
                localNotes,
                "utf8",
            );
        }

        warnings.push(
            `Reference ${key}: no reference-store entry yet; citation skipped. `
            + `Add references/${referenceBucket(key)}/${key}.yml `
            + "from the papers-needed.md citation"
            + (localNotes ? `; agent notes stashed at ${path.relative(root, path.join(targetDir, "pending-notes"))}/${key}.txt` : "")
            + ", then re-run apply.",
        );
    }
    else
    {
        const pointer: { id: string; notes?: string } = { id: key };

        if (localNotes)
        {
            pointer.notes = localNotes;
        }

        genus.references = [...referenceList, pointer];
    }

    return warnings;
}

/**
 * Apply entry point.
 */
function main(): void
{
    const args = process.argv.slice(2);
    const positional = args.filter((argument) => !argument.startsWith("--"));

    if (positional.length !== 2)
    {
        process.stderr.write("Usage: intake-species-apply <Genus> <species>\n");
        process.exit(2);
    }

    const [genus, species] = positional;
    const targetDir = path.join(stagingDir, `${genus}-${species}`);

    if (!fs.existsSync(targetDir))
    {
        process.stderr.write(`staging/intake-species/${genus}-${species}/ does not exist.\n`);
        process.exit(1);
    }

    const genusCurrentPath = path.join(targetDir, "genus-current.yml");
    const bootstrapSpeciesPath = path.join(targetDir, "bootstrap.species.yml");
    const extractionsDir = path.join(targetDir, "extractions");

    if (!fs.existsSync(genusCurrentPath))
    {
        process.stderr.write(`Missing ${genusCurrentPath}\n`);
        process.exit(1);
    }

    if (!fs.existsSync(bootstrapSpeciesPath))
    {
        process.stderr.write(`Missing ${bootstrapSpeciesPath}\n`);
        process.exit(1);
    }

    if (!fs.existsSync(extractionsDir))
    {
        process.stderr.write(
            `Missing ${extractionsDir} — run intake-species-resume and dispatch agents first.\n`,
        );
        process.exit(1);
    }

    const extractionFiles = fs.readdirSync(extractionsDir)
        .filter((name) => name.endsWith(".json"))
        .sort();

    if (extractionFiles.length === 0)
    {
        process.stderr.write(
            `No extraction JSON files found in ${extractionsDir}.\n`,
        );
        process.exit(1);
    }

    const genusData = parseYamlContent(
        fs.readFileSync(genusCurrentPath, "utf8"),
    ) as GenusData;

    const speciesBlock = parseYamlContent(
        fs.readFileSync(bootstrapSpeciesPath, "utf8"),
    ) as Record<string, unknown>;

    process.stdout.write(`Applying extractions for ${genus} ${species}...\n`);

    const extractions = extractionFiles.map((filename) =>
    {
        const filePath = path.join(extractionsDir, filename);
        const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as SpeciesExtraction;
        return { filename, data };
    });

    extractions.sort((a, b) =>
    {
        if (a.data.is_describing && !b.data.is_describing) return -1;
        if (!a.data.is_describing && b.data.is_describing) return 1;
        return a.filename.localeCompare(b.filename);
    });

    const allWarnings = new Array<string>();

    for (const { filename, data } of extractions)
    {
        const role = data.is_describing ? "describing" : "supplementary";
        process.stdout.write(`  Apply ${filename} (${role}, ${data.citation_key})\n`);

        for (const warning of applyExtractionToSpecies(speciesBlock, data))
        {
            allWarnings.push(warning);
            process.stderr.write(`    WARN: ${warning}\n`);
        }

        for (const warning of appendReference(genusData, data, targetDir))
        {
            allWarnings.push(warning);
            process.stderr.write(`    WARN: ${warning}\n`);
        }
    }

    // Append the new species block to the genus YAML. Keep the
    // existing species[] order so the type species stays first.
    const existingSpecies = Array.isArray(genusData.species) ? genusData.species : [];
    genusData.species = [
        ...existingSpecies,
        reorderSpecies(speciesBlock) as Species,
    ];

    const proposedPath = path.join(targetDir, "genus-proposed.yml");
    fs.writeFileSync(
        proposedPath,
        stringifyYaml(genusData, { lineWidth: 80 }),
        "utf8",
    );

    process.stdout.write(`\nWrote ${path.relative(root, proposedPath)}\n`);

    writeStatusEvidence(targetDir, extractions.map((entry) => entry.data));

    if (allWarnings.length > 0)
    {
        process.stdout.write(
            `(${allWarnings.length} warning${allWarnings.length === 1 ? "" : "s"})\n`,
        );
    }
}

main();
