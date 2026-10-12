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
import { writeStatusEvidence } from "./utilities.ts";
import type { SpeciesExtraction } from "./intake-types.ts";
import {
    appendReferencePointer,
    mergeHolotype,
    mergeSize,
    mergeUnique,
    orderSpeciesKeys,
    readExtractions,
} from "./intake-shared.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingDir = path.join(root, "staging", "intake-species");

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
            mergeHolotype(species, extraction);
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

        mergeSize(species, extraction);

        // The describing paper erects the new species; author/year are derived
        // from this reference at build time (issue #1886).
        species.erected_in = extraction.citation_key;
    }

    if (Array.isArray(extraction.diagnostic_features)
        && extraction.diagnostic_features.length > 0)
    {
        species.diagnostic_features = mergeUnique(species.diagnostic_features, extraction.diagnostic_features, (first, second) => first === second);
    }

    if (Array.isArray(extraction.paleoenvironment)
        && extraction.paleoenvironment.length > 0)
    {
        species.paleoenvironment = extraction.paleoenvironment;
    }

    if (Array.isArray(extraction.synonyms) && extraction.synonyms.length > 0)
    {
        species.synonyms = mergeUnique(species.synonyms, extraction.synonyms, (first, second) => first.name === second.name);
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

    const extractions = readExtractions<SpeciesExtraction>(extractionsDir, extractionFiles);

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

        // An empty extraction is a paper the agent could not read, so it is
        // not cited, as the genus apply does.
        for (const warning of data.empty ? [] : appendReferencePointer(genusData, data, targetDir))
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
        orderSpeciesKeys(speciesBlock) as Species,
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
