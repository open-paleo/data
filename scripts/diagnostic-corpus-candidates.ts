import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import type { GenusData, Species } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";
import { getCorpusDir } from "./corpus-path.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const corpusMarkdownDir = path.join(getCorpusDir(), "markdown");

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

    return true;
}

/**
 * Picks the representative species for a genus: the type species when one is
 * marked, otherwise the first listed species.
 *
 * @param genus - Parsed genus YAML document.
 * @returns The representative species, or null when the genus has none.
 */
function pickRepresentativeSpecies(genus: GenusData): Species | null
{
    if (!Array.isArray(genus.species) || genus.species.length === 0)
    {
        return null;
    }

    const typeSpecies = genus.species.find((entry) => entry?.type_species === true);
    return typeSpecies ?? genus.species[0];
}

/**
 * Collects the reference keys that could carry the genus's erecting or
 * describing paper: the genus-level overrides plus the representative
 * species's own erecting/describing keys.
 *
 * @param genus - Parsed genus YAML document.
 * @param species - The representative species.
 * @returns Deduplicated candidate reference keys.
 */
function erectingDescribingKeys(genus: GenusData, species: Species): Array<string>
{
    const keys = [
        genus.described_in,
        genus.erected_in,
        species.described_in,
        species.erected_in,
    ].filter((key): key is string => typeof key === "string" && key.length > 0);

    return [...new Set(keys)];
}

/**
 * Returns true when the genus already carries diagnostic features at the genus
 * level or on any of its species.
 *
 * @param genus - Parsed genus YAML document.
 * @returns True when diagnostic features are present anywhere on the genus.
 */
function hasDiagnosticFeatures(genus: GenusData): boolean
{
    if (isPopulated(genus.diagnostic_features))
    {
        return true;
    }

    if (Array.isArray(genus.species))
    {
        return genus.species.some((entry) => isPopulated(entry?.diagnostic_features));
    }

    return false;
}

const generaFiles = findYamlFiles(generaDir).sort();
const candidates = new Array<{ genus: string; presentKeys: Array<string> }>();
let skippedNonValid = 0;
let skippedHaveDiagnostics = 0;
let skippedNoPaper = 0;
let parseFailures = 0;

for (const filePath of generaFiles)
{
    let genus: GenusData;

    try
    {
        genus = parseYaml<GenusData>(filePath);
    }
    catch
    {
        parseFailures += 1;
        continue;
    }

    const species = pickRepresentativeSpecies(genus);

    if (species === null)
    {
        continue;
    }

    if (typeof species.status === "string" && species.status.trim().toLowerCase() !== "valid")
    {
        skippedNonValid += 1;
        continue;
    }

    if (hasDiagnosticFeatures(genus))
    {
        skippedHaveDiagnostics += 1;
        continue;
    }

    const presentKeys = erectingDescribingKeys(genus, species)
        .filter((key) => fs.existsSync(path.join(corpusMarkdownDir, `${key}.md`)));

    if (presentKeys.length === 0)
    {
        skippedNoPaper += 1;
        continue;
    }

    candidates.push({ genus: genus.genus ?? path.basename(filePath, ".yml"), presentKeys });
}

candidates.sort((first, second) => first.genus.localeCompare(second.genus));

console.log(`Corpus markdown dir: ${corpusMarkdownDir}`);
console.log(`Genera scanned: ${generaFiles.length} (parse failures: ${parseFailures})`);
console.log(`Skipped — type species not valid: ${skippedNonValid}`);
console.log(`Skipped — already have diagnostic_features: ${skippedHaveDiagnostics}`);
console.log(`Skipped — no erecting/describing paper in corpus: ${skippedNoPaper}`);
console.log(`\nCandidates (missing diagnostic_features, valid type species, paper in corpus): ${candidates.length}\n`);

for (const candidate of candidates)
{
    console.log(`${candidate.genus}\t${candidate.presentKeys.join(", ")}`);
}
