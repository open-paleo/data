#!/usr/bin/env npx tsx

// Open Paleo — Data Validation Script
// Validates YAML data files against the schema and tree structure.

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import yaml from "js-yaml";

import { findYamlFiles } from "./utilities.ts";

import type {
    GenusData,
    CladeData,
    Schema,
    Species,
    Reference,
    Size,
    StageInfo,
    TreeNode,
    ValidationMessage,
    CheckResult,
} from "./types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const root = path.join(scriptDir, "..");

/**
 * Recursively extracts all clade names from a tree node.
 *
 * @param node - The tree node to traverse.
 * @param clades - Accumulator set (used internally during recursion).
 * @returns A set of all clade names found in the tree.
 */
function extractClades(node: TreeNode | null, clades = new Set<string>()): Set<string>
{
    if (node && typeof node === "object")
    {
        for (const key of Object.keys(node))
        {
            clades.add(key);
            extractClades(node[key], clades);
        }
    }

    return clades;
}

/**
 * Converts an absolute path to a path relative to the repository root.
 *
 * @param absPath - The absolute file path.
 * @returns The relative path, or the original if it doesn't start with root.
 */
function relPath(absPath: string): string
{
    return absPath.startsWith(root) ? absPath.slice(root.length + 1) : absPath;
}

const errors = new Array<ValidationMessage>();
const warnings = new Array<ValidationMessage>();

/**
 * Records a validation error.
 *
 * @param check - The name of the validation check.
 * @param file - The file path that triggered the error, or null for global errors.
 * @param message - Human-readable error description.
 */
function addError(check: string, file: string | null, message: string): void
{
    errors.push({ check, file: file ? relPath(file) : "(global)", message });
}

/**
 * Records a validation warning.
 *
 * @param check - The name of the validation check.
 * @param file - The file path that triggered the warning, or null for global warnings.
 * @param message - Human-readable warning description.
 */
function addWarning(check: string, file: string | null, message: string): void
{
    warnings.push({ check, file: file ? relPath(file) : "(global)", message });
}

// Track per-check results
const checkResults: Record<string, CheckResult> = {};

/**
 * Initializes counters for a new validation check.
 *
 * @param name - The display name of the check.
 */
function startCheck(name: string): void
{
    checkResults[name] = {
        errors: 0,
        warnings: 0,
    };
}

/**
 * Records an error for a specific validation check.
 *
 * @param name - The check name (must have been initialized with startCheck).
 * @param file - The file path, or null for global errors.
 * @param message - Human-readable error description.
 */
function checkError(name: string, file: string | null, message: string): void
{
    checkResults[name].errors++;
    addError(name, file, message);
}

/**
 * Records a warning for a specific validation check.
 *
 * @param name - The check name (must have been initialized with startCheck).
 * @param file - The file path, or null for global warnings.
 * @param message - Human-readable warning description.
 */
function checkWarning(name: string, file: string | null, message: string): void
{
    checkResults[name].warnings++;
    addWarning(name, file, message);
}

/**
 * Loads and parses a YAML file, exiting the process on failure.
 *
 * @param filePath - Absolute path to the YAML file.
 * @param label - Human-readable label for error messages.
 * @returns The parsed YAML content cast to type T.
 */
function loadYamlFatal<T>(filePath: string, label: string): T
{
    try
    {
        return yaml.load(fs.readFileSync(filePath, "utf8")) as T;
    }
    catch (error: unknown)
    {
        const message = error instanceof Error ? error.message : String(error);

        console.error(`Fatal: cannot load ${label} — ${message}`);

        process.exit(2);
    }
}

const schema = loadYamlFatal<Schema>(path.join(root, "schema.yml"), "schema.yml");

const tree = loadYamlFatal<TreeNode>(path.join(root, "tree.yml"), "tree.yml");
const treeClades = extractClades(tree);

const allowedStatus = new Set(schema.status ?? []);
const allowedDiet = new Set(schema.diet ?? []);
const allowedLocomotion = new Set(schema.locomotion ?? []);
const allowedCompleteness = new Set(schema.completeness ?? []);
const allowedIntegument = new Set(schema.integument ?? []);
const allowedIntegumentEvidence = new Set(schema.integument_evidence ?? []);
const allowedPaleoenvironments = new Set(schema.paleoenvironments ?? []);
const allowedIdentifierSources = new Set(schema.identifier_sources ?? []);
const allowedCountries = new Set(schema.countries ?? []);
const stages: Record<string, StageInfo> = schema.stages ?? {};

const genusFiles = findYamlFiles(path.join(root, "genera"));
const genusParsed = new Map<string, GenusData>();

const cladeFiles = findYamlFiles(path.join(root, "clades"));
const cladeParsed = new Map<string, CladeData>();

// Scaffolding clades that don't need clade files
const scaffoldingClades = new Set([
    "Life", "Animalia", "Arthropoda", "Trilobita", "Mollusca", "Cephalopoda",
    "Ammonoidea", "Chordata", "Vertebrata", "Actinopterygii", "Sarcopterygii",
    "Tetrapoda", "Synapsida", "Reptilia", "Lepidosauria", "Ichthyosauria",
    "Sauropterygia", "Plesiosauria", "Archosauria", "Pterosauria",
    "Crocodylomorpha", "Plantae",
]);

// Collect all species names across all genus files (for synonym_of validation)
const allSpeciesNames = new Set<string>();

// 1. YAML syntax
startCheck("YAML syntax");

for (const filePath of genusFiles)
{
    try
    {
        const doc = yaml.load(fs.readFileSync(filePath, "utf8")) as GenusData;
        genusParsed.set(filePath, doc);
    }
    catch (error: unknown)
    {
        const message = error instanceof Error ? error.message : String(error);
        checkError("YAML syntax", filePath, `YAML parse error: ${message}`);
    }
}

for (const filePath of cladeFiles)
{
    try
    {
        const doc = yaml.load(fs.readFileSync(filePath, "utf8")) as CladeData;
        cladeParsed.set(filePath, doc);
    }
    catch (error: unknown)
    {
        const message = error instanceof Error ? error.message : String(error);
        checkError("YAML syntax", filePath, `YAML parse error: ${message}`);
    }
}

// Also verify schema.yml and tree.yml parse (already loaded, but record success)
// They were loaded above with fatal exit, so if we're here they parsed fine.

for (const [, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (species && species.name)
        {
            allSpeciesNames.add(species.name);
        }
    }
}

// 2. Schema compliance (status, diet)
startCheck("Schema compliance");

for (const [filePath, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    if (doc.diet && !allowedDiet.has(doc.diet))
    {
        checkError(
            "Schema compliance",
            filePath,
            `invalid diet value '${doc.diet}' (must be one of: ${[...allowedDiet].join(", ")})`);
    }

    if (Array.isArray(doc.species))
    {
        for (const species of doc.species)
        {
            if (species && species.status && !allowedStatus.has(species.status))
            {
                checkError(
                    "Schema compliance",
                    filePath,
                    `species '${species.name ?? "?"}': invalid status '${species.status}' (must be one of: ${[...allowedStatus].join(", ")})`);
            }
        }
    }
}

// 3. Tree consistency — genus parent exists in tree
startCheck("Tree consistency");

for (const [filePath, doc] of genusParsed)
{
    if (doc && doc.parent && !treeClades.has(doc.parent))
    {
        checkError(
            "Tree consistency",
            filePath,
            `parent clade '${doc.parent}' not found in tree.yml`);
    }
}

// 4. Clade coverage — every tree clade has a file (except scaffolding)
startCheck("Clade coverage");

const cladeFileNames = new Set<string>(
    cladeFiles.map(
        (filePath) => path.basename(filePath).replace(/\.(yml|yaml)$/, "")),
);

for (const clade of treeClades)
{
    if (!scaffoldingClades.has(clade) && !cladeFileNames.has(clade))
    {
        checkWarning(
            "Clade coverage",
            null,
            `clade '${clade}' in tree.yml has no corresponding file in clades/`);
    }
}

// 5. No orphans — no clade files for clades not in tree
startCheck("No orphan clades");

for (const filePath of cladeFiles)
{
    const name = path.basename(filePath).replace(/\.(yml|yaml)$/, "");

    if (!treeClades.has(name))
    {
        checkError(
            "No orphan clades",
            filePath,
            `clade file exists but '${name}' is not in tree.yml`);
    }
}

// 6. Naming conventions
startCheck("Naming conventions");

for (const [filePath, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    const fileName = path.basename(filePath).replace(/\.(yml|yaml)$/, "");

    if (doc.genus && doc.genus !== fileName)
    {
        checkError(
            "Naming conventions",
            filePath,
            `filename '${fileName}' does not match genus field '${doc.genus}'`);
    }

    // Check alphabetical directory
    if (doc.genus)
    {
        const expectedDir = doc.genus.charAt(0).toUpperCase();
        const actualDir = path.basename(path.dirname(filePath));

        if (actualDir !== expectedDir)
        {
            checkError(
                "Naming conventions",
                filePath,
                `file is in directory '${actualDir}' but genus '${doc.genus}' should be in '${expectedDir}'`);
        }
    }
}

// 7. Required fields
startCheck("Required fields");

const requiredGenusFields: Array<keyof GenusData> = ["genus", "parent", "description"];
const requiredSpeciesFields: Array<keyof Species> = ["name", "status", "period"];

for (const [filePath, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    for (const field of requiredGenusFields)
    {
        if (!doc[field])
        {
            checkError("Required fields", filePath, `missing required field '${field}'`);
        }
    }

    if (!Array.isArray(doc.species) || doc.species.length === 0)
    {
        checkError("Required fields", filePath, "must have at least one species");
    }
    else
    {
        for (const species of doc.species)
        {
            if (!species)
            {
                continue;
            }

            for (const field of requiredSpeciesFields)
            {
                if (!species[field])
                {
                    checkError(
                        "Required fields",
                        filePath,
                        `species '${species.name ?? "?"}': missing required field '${field}'`);
                }
            }
        }
    }
}

// 8. Type species — exactly one per genus
startCheck("Type species");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    const typeSpecies = doc.species.filter(species => species && species.type_species === true);

    if (typeSpecies.length === 0)
    {
        checkError("Type species", filePath, "no species marked as type_species");
    }
    else if (typeSpecies.length > 1)
    {
        checkError(
            "Type species",
            filePath,
            `multiple species marked as type_species: ${typeSpecies.map(species => species.name).join(", ")}`);
    }
}

// 9. Stage-period agreement
startCheck("Stage-period agreement");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (!species || !species.period)
        {
            continue;
        }

        const period = species.period;

        if (period.stage && period.name)
        {
            const stageInfo = stages[period.stage];

            if (!stageInfo)
            {
                checkError(
                    "Stage-period agreement",
                    filePath,
                    `species '${species.name ?? "?"}': unknown stage '${period.stage}'`);
            }
            else if (stageInfo.period !== period.name)
            {
                checkError(
                    "Stage-period agreement",
                    filePath,
                    `species '${species.name ?? "?"}': stage '${period.stage}' belongs to '${stageInfo.period}', not '${period.name}'`);
            }
        }
    }
}

// 10. Reference integrity — described_in matches a reference id
startCheck("Reference integrity");

for (const [filePath, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    const ids = new Set<string>();

    if (Array.isArray(doc.references))
    {
        for (const reference of doc.references)
        {
            if (reference && reference.id)
            {
                ids.add(reference.id);
            }
        }
    }

    // Check genus-level described_in
    if (doc.described_in && !ids.has(doc.described_in))
    {
        checkError(
            "Reference integrity",
            filePath,
            `described_in '${doc.described_in}' does not match any reference id`);
    }

    // Check species-level described_in
    if (Array.isArray(doc.species))
    {
        for (const species of doc.species)
        {
            if (species && species.described_in && !ids.has(species.described_in))
            {
                checkError(
                    "Reference integrity",
                    filePath,
                    `species '${species.name ?? "?"}': described_in '${species.described_in}' does not match any reference id`);
            }
        }
    }
}

// 11. Reference completeness
startCheck("Reference completeness");

const requiredRefFields: Array<keyof Reference> = ["id", "authors", "year", "title"];

/**
 * Validates that all references in a genus or clade document have the required fields.
 *
 * @param filePath - Path to the file being validated (for error reporting).
 * @param doc - The parsed genus or clade document.
 */
function validateReferences(filePath: string, doc: GenusData | CladeData): void
{
    if (!doc || !Array.isArray(doc.references))
    {
        return;
    }

    for (const reference of doc.references)
    {
        if (!reference)
        {
            continue;
        }

        for (const field of requiredRefFields)
        {
            if (!reference[field])
            {
                checkError(
                    "Reference completeness",
                    filePath,
                    `reference '${reference.id ?? "?"}': missing required field '${field}'`);
            }
        }

        if (!reference.journal && !reference.book)
        {
            checkError(
                "Reference completeness",
                filePath,
                `reference '${reference.id ?? "?"}': must have at least one of 'journal' or 'book'`);
        }
    }
}

for (const [filePath, doc] of genusParsed)
{
    validateReferences(filePath, doc);
}

for (const [filePath, doc] of cladeParsed)
{
    validateReferences(filePath, doc);
}

// 12. Unique reference IDs
startCheck("Unique reference IDs");

const allParsed: Array<[string, GenusData | CladeData]> = [
    ...genusParsed.entries(),
    ...cladeParsed.entries(),
];

for (const [filePath, doc] of allParsed)
{
    if (!doc || !Array.isArray(doc.references))
    {
        continue;
    }

    const seen = new Set<string>();

    for (const reference of doc.references)
    {
        if (!reference || !reference.id)
        {
            continue;
        }

        if (seen.has(reference.id))
        {
            checkError("Unique reference IDs", filePath, `duplicate reference id '${reference.id}'`);
        }

        seen.add(reference.id);
    }
}

// 13. Location completeness — country required if location present
startCheck("Location completeness");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (species && species.location && !species.location.country)
        {
            checkError(
                "Location completeness",
                filePath,
                `species '${species.name ?? "?"}': location present but missing 'country'`);
        }
    }
}

// 14. Country typo detection (warning)
startCheck("Country validation");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (species && species.location && species.location.country && !allowedCountries.has(species.location.country))
        {
            checkWarning(
                "Country validation",
                filePath,
                `species '${species.name ?? "?"}': country '${species.location.country}' not in schema countries list`);
        }
    }
}

// 15. Coordinate validity
startCheck("Coordinate validity");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (!species || !species.location || !species.location.coordinates)
        {
            continue;
        }

        const coords = species.location.coordinates;
        if (!Array.isArray(coords) || coords.length < 2)
        {
            checkError(
                "Coordinate validity",
                filePath,
                `species '${species.name ?? "?"}': coordinates must be [lat, lon]`);
            continue;
        }

        const [lat, lon] = coords;
        if (typeof lat !== "number" || lat < -90 || lat > 90)
        {
            checkError(
                "Coordinate validity",
                filePath,
                `species '${species.name ?? "?"}': latitude ${lat} out of range (-90 to 90)`);
        }

        if (typeof lon !== "number" || lon < -180 || lon > 180)
        {
            checkError(
                "Coordinate validity",
                filePath,
                `species '${species.name ?? "?"}': longitude ${lon} out of range (-180 to 180)`);
        }
    }
}

// 16. Period consistency — stage belongs to period; Ma range within stage
startCheck("Period consistency");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (!species || !species.period)
        {
            continue;
        }

        const speciesPeriod = species.period;

        // Stage belongs to period (already checked in #9, but here check Ma range)
        if (speciesPeriod.stage)
        {
            const stageInfo: StageInfo | undefined = stages[speciesPeriod.stage];
            if (stageInfo)
            {
                // Check from_ma
                if (speciesPeriod.from_ma !== undefined && speciesPeriod.from_ma !== null)
                {
                    if (typeof speciesPeriod.from_ma !== "number" || speciesPeriod.from_ma > stageInfo.from_ma || speciesPeriod.from_ma < stageInfo.to_ma)
                    {
                        checkError(
                            "Period consistency",
                            filePath,
                            `species '${species.name ?? "?"}': from_ma ${speciesPeriod.from_ma} outside stage '${speciesPeriod.stage}' range (${stageInfo.from_ma}\u2013${stageInfo.to_ma} Ma)`);
                    }
                }

                // Check to_ma
                if (speciesPeriod.to_ma !== undefined && speciesPeriod.to_ma !== null)
                {
                    if (typeof speciesPeriod.to_ma !== "number" || speciesPeriod.to_ma > stageInfo.from_ma || speciesPeriod.to_ma < stageInfo.to_ma)
                    {
                        checkError(
                            "Period consistency",
                            filePath,
                            `species '${species.name ?? "?"}': to_ma ${speciesPeriod.to_ma} outside stage '${speciesPeriod.stage}' range (${stageInfo.from_ma}\u2013${stageInfo.to_ma} Ma)`);
                    }
                }

                // from_ma should be >= to_ma
                if (typeof speciesPeriod.from_ma === "number" && typeof speciesPeriod.to_ma === "number" && speciesPeriod.from_ma < speciesPeriod.to_ma)
                {
                    checkError(
                        "Period consistency",
                        filePath,
                        `species '${species.name ?? "?"}': from_ma (${speciesPeriod.from_ma}) must be >= to_ma (${speciesPeriod.to_ma})`);
                }
            }
        }
    }
}

// 17. Synonym integrity
startCheck("Synonym integrity");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (species && species.status === "synonym")
        {
            if (!species.synonym_of)
            {
                checkError(
                    "Synonym integrity",
                    filePath,
                    `species '${species.name ?? "?"}': status is 'synonym' but missing 'synonym_of'`);
            }
            else if (!allSpeciesNames.has(species.synonym_of))
            {
                checkError(
                    "Synonym integrity",
                    filePath,
                    `species '${species.name ?? "?"}': synonym_of '${species.synonym_of}' not found in any genus file`);
            }
        }
        else if (species && species.synonym_of)
        {
            checkError(
                "Synonym integrity",
                filePath,
                `species '${species.name ?? "?"}': has 'synonym_of' but status is '${species.status}', not 'synonym'`);
        }
    }
}

// 18. Size validity
startCheck("Size validity");

const sizeNumericFields: Array<keyof Size> = ["length_m", "weight_kg", "hip_height_m", "skull_length_m"];

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (!species || !species.size)
        {
            continue;
        }

        const size = species.size;
        for (const field of sizeNumericFields)
        {
            const value = size[field];
            if (value !== undefined && value !== null)
            {
                if (typeof value !== "number" || value <= 0)
                {
                    checkError(
                        "Size validity",
                        filePath,
                        `species '${species.name ?? "?"}': size.${field} must be a positive number (got ${value})`);
                }
            }
        }

        if (size.estimate !== undefined && size.estimate !== null)
        {
            if (typeof size.estimate !== "boolean")
            {
                checkError(
                    "Size validity",
                    filePath,
                    `species '${species.name ?? "?"}': size.estimate must be a boolean (got ${typeof size.estimate})`);
            }
        }
    }
}

// 19. Locomotion / completeness compliance
startCheck("Locomotion/completeness compliance");

for (const [filePath, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    if (doc.locomotion && !allowedLocomotion.has(doc.locomotion))
    {
        checkError(
            "Locomotion/completeness compliance",
            filePath,
            `invalid locomotion value '${doc.locomotion}' (must be one of: ${[...allowedLocomotion].join(", ")})`);
    }

    if (Array.isArray(doc.species))
    {
        for (const species of doc.species)
        {
            if (species && species.completeness && !allowedCompleteness.has(species.completeness))
            {
                checkError(
                    "Locomotion/completeness compliance",
                    filePath,
                    `species '${species.name ?? "?"}': invalid completeness '${species.completeness}' (must be one of: ${[...allowedCompleteness].join(", ")})`);
            }
        }
    }
}

// 20. Holotype consistency
startCheck("Holotype consistency");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (!species || !species.holotype)
        {
            continue;
        }

        const holotype = species.holotype;
        if (!holotype.specimen_id)
        {
            checkError(
                "Holotype consistency",
                filePath,
                `species '${species.name ?? "?"}': holotype present but missing 'specimen_id'`);
        }

        if (!holotype.institution)
        {
            checkError(
                "Holotype consistency",
                filePath,
                `species '${species.name ?? "?"}': holotype present but missing 'institution'`);
        }
    }
}

// 21. Appearance compliance
startCheck("Appearance compliance");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !doc.appearance)
    {
        continue;
    }

    const appearance = doc.appearance;
    if (appearance.integument && !allowedIntegument.has(appearance.integument))
    {
        checkError(
            "Appearance compliance",
            filePath,
            `invalid integument '${appearance.integument}' (must be one of: ${[...allowedIntegument].join(", ")})`);
    }

    if (appearance.evidence && !allowedIntegumentEvidence.has(appearance.evidence))
    {
        checkError(
            "Appearance compliance",
            filePath,
            `invalid integument evidence '${appearance.evidence}' (must be one of: ${[...allowedIntegumentEvidence].join(", ")})`);
    }
}

// 22. Paleoenvironment compliance
startCheck("Paleoenvironment compliance");

for (const [filePath, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    if (Array.isArray(doc.paleoenvironment))
    {
        for (const environment of doc.paleoenvironment)
        {
            if (!allowedPaleoenvironments.has(environment))
            {
                checkError(
                    "Paleoenvironment compliance",
                    filePath,
                    `invalid paleoenvironment '${environment}' (must be one of: ${[...allowedPaleoenvironments].join(", ")})`);
            }
        }
    }
    else if (doc.paleoenvironment && typeof doc.paleoenvironment === "string")
    {
        if (!allowedPaleoenvironments.has(doc.paleoenvironment))
        {
            checkError(
                "Paleoenvironment compliance",
                filePath,
                `invalid paleoenvironment '${doc.paleoenvironment}' (must be one of: ${[...allowedPaleoenvironments].join(", ")})`);
        }
    }
}

// 23. Identifier compliance
startCheck("Identifier compliance");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.identifiers))
    {
        continue;
    }

    const seenPairs = new Set<string>();
    for (const identifier of doc.identifiers)
    {
        if (!identifier)
        {
            continue;
        }

        if (identifier.source && !allowedIdentifierSources.has(identifier.source))
        {
            checkError(
                "Identifier compliance",
                filePath,
                `invalid identifier source '${identifier.source}' (must be one of: ${[...allowedIdentifierSources].join(", ")})`);
        }

        if (!identifier.id || (typeof identifier.id === "string" && identifier.id.trim() === ""))
        {
            checkError(
                "Identifier compliance",
                filePath,
                `identifier with source '${identifier.source ?? "?"}' has empty or missing 'id'`);
        }

        const pair = `${identifier.source}:${identifier.id}`;
        if (seenPairs.has(pair))
        {
            checkError(
                "Identifier compliance",
                filePath,
                `duplicate identifier source/id pair: ${pair}`);
        }

        seenPairs.add(pair);
    }
}

// Output

console.log("Validating Open Paleo data...\n");

for (const name of Object.keys(checkResults))
{
    const result = checkResults[name];
    if (result.errors === 0 && result.warnings === 0)
    {
        console.log(`\u2713 ${name} check passed`);
    }
    else if (result.errors > 0)
    {
        console.log(`\u2717 ${name}: ${result.errors} error${result.errors !== 1 ? "s" : ""}`);
        for (const entry of errors.filter(entry => entry.check === name))
        {
            console.log(`  ${entry.file}: ${entry.message}`);
        }
    }
    else
    {
        console.log(`\u26A0 ${name}: ${result.warnings} warning${result.warnings !== 1 ? "s" : ""}`);
        for (const entry of warnings.filter(entry => entry.check === name))
        {
            console.log(`  ${entry.file}: ${entry.message}`);
        }
    }
}

console.log(`\nSummary: ${errors.length} error${errors.length !== 1 ? "s" : ""}, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`);

process.exit(errors.length > 0 ? 1 : 0);
