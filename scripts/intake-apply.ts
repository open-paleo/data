// Apply step of the per-genus intake pipeline. Merges the per-paper
// extraction JSON files at `staging/intake/{Genus}/extractions/` into
// `bootstrap.yml` and writes `final.yml`.
//
// Citations resolve against the reference store directly: a paper is
// cited with an `{id, notes?}` pointer when its store file
// `references/<letter>/<key>.yml` exists; otherwise the citation is
// skipped with a warning (a pointer must resolve to a complete store
// entry). The skill's step 4b authors the store file from the
// user-pasted `papers-needed.md` citation and re-runs apply — keeping
// the citation parsing in the skill accommodates the many idiosyncratic
// formats people paste.
//
// Merge rules (describing paper → genus YAML):
//
//   etymology_genus        → genus.etymology
//   etymology_species      → genus.species[0].etymology
//   pronunciation_ipa      → genus.pronunciation.ipa (overwrites bootstrap)
//   pronunciation_phonetic → genus.pronunciation.phonetic (overwrites)
//   holotype_*           → genus.species[0].type_specimen.{specimen_id,
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
import { writeStatusEvidence } from "./utilities.ts";
import type { IntakeExtraction } from "./intake-types.ts";
import {
    appendReferencePointer,
    mergeHolotype,
    mergeSize,
    mergeUnique,
    orderGenusKeys,
    readExtractions,
} from "./intake-shared.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingIntakeDir = path.join(root, "staging", "intake");

/**
 * Applies one extraction record onto the genus data in place. The
 * describing-paper extraction sets scalar fields and seeds arrays;
 * supplementary extractions only append to arrays.
 *
 * @param genus - Genus data (mutated).
 * @param extraction - Parsed extraction JSON.
 * @returns Empty array on success, otherwise warning strings.
 */
function applyExtraction(
    genus: GenusData,
    extraction: IntakeExtraction,
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

        // Pronunciation: paper is the more authoritative source than
        // Wikipedia, so paper-derived values overwrite the bootstrap
        // pronunciation field-by-field. If the paper supplies only IPA
        // and the bootstrap had only a phonetic respelling (or vice
        // versa), keep both.
        if (extraction.pronunciation_ipa || extraction.pronunciation_phonetic)
        {
            const pronunciation: Record<string, unknown> = (genus.pronunciation as Record<string, unknown>) ?? {};

            if (extraction.pronunciation_ipa)
            {
                pronunciation.ipa = extraction.pronunciation_ipa;
            }

            if (extraction.pronunciation_phonetic)
            {
                pronunciation.phonetic = extraction.pronunciation_phonetic;
            }

            (genus as Record<string, unknown>).pronunciation = pronunciation;
        }

        if (extraction.holotype_specimen_id || extraction.holotype_material)
        {
            mergeHolotype(species, extraction);
        }

        if (extraction.paleoenvironment && extraction.paleoenvironment.length > 0)
        {
            genus.paleoenvironment = extraction.paleoenvironment;
        }

        // Paper-derived value beats bootstrap inference.
        if (extraction.locomotion)
        {
            genus.locomotion = extraction.locomotion;
        }

        if (extraction.integument)
        {
            const appearance = (genus.appearance as Record<string, unknown> | undefined) ?? {};
            appearance.integument = extraction.integument;
            (genus as Record<string, unknown>).appearance = appearance;
        }

        mergeSize(species, extraction);

        species.erected_in = extraction.citation_key;
    }

    // Diagnostic features and synonyms accumulate from every paper.
    if (Array.isArray(extraction.diagnostic_features) && extraction.diagnostic_features.length > 0)
    {
        genus.diagnostic_features = mergeUnique(genus.diagnostic_features, extraction.diagnostic_features, (first, second) => first === second);
    }

    if (Array.isArray(extraction.synonyms) && extraction.synonyms.length > 0)
    {
        genus.synonyms = mergeUnique(genus.synonyms, extraction.synonyms, (first, second) => first.name === second.name);
    }

    warnings.push(...appendReferencePointer(genus, extraction, path.join(stagingIntakeDir, extraction.genus)));

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

    process.stdout.write(`Applying extractions for ${genus}...\n`);

    const allWarnings = new Array<string>();

    // Apply describing paper(s) first so that scalar overrides land
    // before supplementary appends.
    const extractions = readExtractions<IntakeExtraction>(extractionsDir, extractionFiles);

    for (const { filename, data } of extractions)
    {
        const role = data.is_describing ? "describing" : "supplementary";
        process.stdout.write(`  Apply ${filename} (${role}, ${data.citation_key})\n`);

        const warnings = applyExtraction(bootstrap, data);

        for (const warning of warnings)
        {
            allWarnings.push(warning);
            process.stderr.write(`    WARN: ${warning}\n`);
        }
    }

    const finalPath = path.join(targetDir, "final.yml");
    fs.writeFileSync(
        finalPath,
        stringifyYaml(orderGenusKeys(bootstrap), { lineWidth: 80 }),
        "utf8",
    );

    process.stdout.write(`\nWrote ${finalPath}\n`);

    writeStatusEvidence(targetDir, extractions.map((entry) => entry.data));

    if (allWarnings.length > 0)
    {
        process.stdout.write(`(${allWarnings.length} warning${allWarnings.length === 1 ? "" : "s"})\n`);
    }
}

main();
