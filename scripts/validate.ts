#!/usr/bin/env npx tsx

// Open Paleo — Data Validation Script
// Validates YAML data files against the schema and tree structure.

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse as parseYamlContent } from "yaml";

import { buildFlaggedSet, findYamlFiles, loadFlaggedSources } from "./utilities.ts";

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
        return parseYamlContent(fs.readFileSync(filePath, "utf8")) as T;
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
const allowedHolotypeStatus = new Set(schema.holotype_status ?? []);
const allowedSpecimenTypes = new Set(schema.specimen_types ?? []);
const allowedIntegument = new Set(schema.integument ?? []);
const allowedIntegumentEvidence = new Set(schema.integument_evidence ?? []);
const allowedPaleoenvironments = new Set(schema.paleoenvironments ?? []);
const allowedSynonymTypes = new Set(schema.synonym_types ?? []);
const allowedIdentifierSources = new Set(schema.identifier_sources ?? []);
const allowedCountries = new Set(Object.keys(schema.countries ?? {}));
const allowedPeriods = new Set(schema.periods ?? []);
const stages: Record<string, StageInfo> = schema.stages ?? {};

const institutionRegistry = parseYamlContent(
    fs.readFileSync(path.join(root, "institutions.yaml"), "utf8"),
) as Record<string, unknown>;
const allowedInstitutionKeys = new Set(Object.keys(institutionRegistry));

const flaggedSources = loadFlaggedSources(path.join(root, "flagged-sources.yml"));
const flaggedPublishers = buildFlaggedSet(flaggedSources.publishers);
const flaggedJournals = buildFlaggedSet(flaggedSources.journals);

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

// 1. YAML syntax
startCheck("YAML syntax");

for (const filePath of genusFiles)
{
    try
    {
        const doc = parseYamlContent(fs.readFileSync(filePath, "utf8")) as GenusData;
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
        const doc = parseYamlContent(fs.readFileSync(filePath, "utf8")) as CladeData;
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
        const speciesLabel = species.name ?? "?";

        if (Array.isArray(period.name))
        {
            for (const periodName of period.name)
            {
                if (!allowedPeriods.has(periodName))
                {
                    checkError(
                        "Stage-period agreement",
                        filePath,
                        `species '${speciesLabel}': unknown period '${periodName}'`);
                }
            }
        }

        if (Array.isArray(period.stage))
        {
            for (const stageName of period.stage)
            {
                const stageInfo = stages[stageName];

                if (!stageInfo)
                {
                    checkError(
                        "Stage-period agreement",
                        filePath,
                        `species '${speciesLabel}': unknown stage '${stageName}'`);
                }
                else if (Array.isArray(period.name) && !period.name.includes(stageInfo.period))
                {
                    checkError(
                        "Stage-period agreement",
                        filePath,
                        `species '${speciesLabel}': stage '${stageName}' belongs to '${stageInfo.period}', not listed in period names`);
                }
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

// 12c. Reference key disambiguation — when any "{base}{a-z}" suffix
// variant exists across the dataset, the bare "{base}" key must not
// also exist. Mixing them silently breaks lookups and makes it
// ambiguous which paper "{base}" refers to. Co-existing keys must all
// be disambiguated (e.g., `huene1927a`, `huene1927b`, `huene1927c`
// with no bare `huene1927`).
startCheck("Reference key disambiguation");

/**
 * Index of every reference id seen across all genera and clade files,
 * keyed by id, with each entry recording every (file, id) occurrence
 * for diagnostic output.
 */
const referenceIdOccurrences = new Map<string, Array<string>>();

for (const [filePath, doc] of allParsed)
{
    if (!doc || !Array.isArray(doc.references))
    {
        continue;
    }

    for (const reference of doc.references)
    {
        if (!reference || !reference.id)
        {
            continue;
        }

        const occurrences = referenceIdOccurrences.get(reference.id) ?? [];

        occurrences.push(filePath);
        referenceIdOccurrences.set(reference.id, occurrences);
    }
}

const allReferenceIds = new Set(referenceIdOccurrences.keys());

/**
 * Maps each bare reference id to the set of suffixed variants that
 * coexist with it. Built up so we can emit one error per bare key
 * rather than one per (bare, variant) pair.
 */
const conflictsByBaseKey = new Map<string, Set<string>>();

for (const referenceId of allReferenceIds)
{
    const suffixMatch = /^(.*\d)([a-z])$/.exec(referenceId);

    if (!suffixMatch)
    {
        continue;
    }

    const baseKey = suffixMatch[1];

    if (!allReferenceIds.has(baseKey))
    {
        continue;
    }

    const variants = conflictsByBaseKey.get(baseKey) ?? new Set<string>();

    variants.add(referenceId);
    conflictsByBaseKey.set(baseKey, variants);
}

for (const [baseKey, variants] of conflictsByBaseKey)
{
    const variantList = Array.from(variants).sort().join(", ");
    const bareOccurrences = referenceIdOccurrences.get(baseKey) ?? [];

    for (const filePath of bareOccurrences)
    {
        checkError(
            "Reference key disambiguation",
            filePath,
            `bare reference id '${baseKey}' coexists with suffixed variant(s) ${variantList}; rename '${baseKey}' to '${baseKey}a' (or another postfix) to disambiguate`,
        );
    }
}

// 12b. Flagged publication sources — references citing publishers or
// journals on flagged-sources.yml emit a warning for reviewer sign-off.
startCheck("Flagged publication sources");

for (const [filePath, doc] of allParsed)
{
    if (!doc || !Array.isArray(doc.references))
    {
        continue;
    }

    for (const reference of doc.references)
    {
        if (!reference)
        {
            continue;
        }

        const publisher = reference.publisher?.trim().toLowerCase();
        const journal = reference.journal?.trim().toLowerCase();
        const referenceLabel = reference.id ?? reference.title ?? "?";

        if (publisher && flaggedPublishers.has(publisher))
        {
            checkWarning(
                "Flagged publication sources",
                filePath,
                `reference '${referenceLabel}': publisher '${reference.publisher}' is flagged for reviewer verification`);
        }

        if (journal && flaggedJournals.has(journal))
        {
            checkWarning(
                "Flagged publication sources",
                filePath,
                `reference '${referenceLabel}': journal '${reference.journal}' is flagged for reviewer verification`);
        }
    }
}

// 12c. Reference notes length — keep concise and factual
startCheck("Reference notes length");

const referenceNotesLimit = 200;

for (const [filePath, doc] of allParsed)
{
    if (!doc || !Array.isArray(doc.references))
    {
        continue;
    }

    for (const reference of doc.references)
    {
        if (!reference || typeof reference.notes !== "string")
        {
            continue;
        }

        if (reference.notes.length > referenceNotesLimit)
        {
            const referenceLabel = reference.id ?? reference.title ?? "?";

            checkWarning(
                "Reference notes length",
                filePath,
                `reference '${referenceLabel}': notes is ${reference.notes.length} chars (keep under ${referenceNotesLimit}, prose belongs in description)`);
        }
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

        const formation = species?.location?.formation;

        if (formation !== undefined && typeof formation !== "string")
        {
            checkError(
                "Location completeness",
                filePath,
                `species '${species.name ?? "?"}': 'formation' must be a string, got ${typeof formation} (${JSON.stringify(formation)})`);
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
        const speciesLabel = species.name ?? "?";

        // Compute the union Ma range across all listed stages
        if (Array.isArray(speciesPeriod.stage) && speciesPeriod.stage.length > 0)
        {
            const resolvedStages = speciesPeriod.stage
                .map((stageName) => stages[stageName])
                .filter((info): info is StageInfo => info !== undefined);

            if (resolvedStages.length > 0)
            {
                const unionFromMa = Math.max(...resolvedStages.map((info) => info.from_ma));
                const unionToMa = Math.min(...resolvedStages.map((info) => info.to_ma));

                // Check from_ma
                if (speciesPeriod.from_ma !== undefined && speciesPeriod.from_ma !== null)
                {
                    if (typeof speciesPeriod.from_ma !== "number" || speciesPeriod.from_ma > unionFromMa || speciesPeriod.from_ma < unionToMa)
                    {
                        checkError(
                            "Period consistency",
                            filePath,
                            `species '${speciesLabel}': from_ma ${speciesPeriod.from_ma} outside combined stage range (${unionFromMa}\u2013${unionToMa} Ma)`);
                    }
                }

                // Check to_ma
                if (speciesPeriod.to_ma !== undefined && speciesPeriod.to_ma !== null)
                {
                    if (typeof speciesPeriod.to_ma !== "number" || speciesPeriod.to_ma > unionFromMa || speciesPeriod.to_ma < unionToMa)
                    {
                        checkError(
                            "Period consistency",
                            filePath,
                            `species '${speciesLabel}': to_ma ${speciesPeriod.to_ma} outside combined stage range (${unionFromMa}\u2013${unionToMa} Ma)`);
                    }
                }
            }

            // from_ma should be >= to_ma
            if (typeof speciesPeriod.from_ma === "number" && typeof speciesPeriod.to_ma === "number" && speciesPeriod.from_ma < speciesPeriod.to_ma)
            {
                checkError(
                    "Period consistency",
                    filePath,
                    `species '${speciesLabel}': from_ma (${speciesPeriod.from_ma}) must be >= to_ma (${speciesPeriod.to_ma})`);
            }
        }
    }
}

// 17. Synonym integrity
startCheck("Synonym integrity");

/**
 * Validates an array of synonym entries against the controlled vocabulary.
 * @param synonyms - The synonym entries to validate.
 * @param filePath - The file path for error reporting.
 * @param context - A label like "genus" or "species 'T. rex'" for error messages.
 */
function validateSynonyms(synonyms: Array<Record<string, unknown>>, filePath: string, context: string): void
{
    for (const synonym of synonyms)
    {
        if (!synonym.name || typeof synonym.name !== "string")
        {
            checkError(
                "Synonym integrity",
                filePath,
                `${context}: synonym entry missing required 'name' field`);
        }

        if (!synonym.type || typeof synonym.type !== "string")
        {
            checkError(
                "Synonym integrity",
                filePath,
                `${context}: synonym '${synonym.name ?? "?"}' missing required 'type' field`);
        }
        else if (!allowedSynonymTypes.has(synonym.type as string))
        {
            checkError(
                "Synonym integrity",
                filePath,
                `${context}: synonym '${synonym.name ?? "?"}' has invalid type '${synonym.type}' (must be one of: ${[...allowedSynonymTypes].join(", ")})`);
        }
    }
}

for (const [filePath, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    if (Array.isArray(doc.synonyms))
    {
        validateSynonyms(
            doc.synonyms as Array<Record<string, unknown>>,
            filePath,
            "genus");
    }

    if (Array.isArray(doc.species))
    {
        for (const species of doc.species)
        {
            if (species && Array.isArray(species.synonyms))
            {
                validateSynonyms(
                    species.synonyms as Array<Record<string, unknown>>,
                    filePath,
                    `species '${species.name ?? "?"}'`);
            }
        }
    }
}

// 18. Size validity
startCheck("Size validity");

const sizeRangeFields: Array<keyof Size> = ["length_m", "weight_kg", "hip_height_m", "skull_length_m"];

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
        for (const field of sizeRangeFields)
        {
            const value = size[field];
            if (value !== undefined && value !== null)
            {
                if (typeof value !== "object" || value.min === undefined || value.max === undefined)
                {
                    checkError(
                        "Size validity",
                        filePath,
                        `species '${species.name ?? "?"}': size.${field} must be an object with min and max`);
                }
                else if (typeof value.min !== "number" || value.min <= 0)
                {
                    checkError(
                        "Size validity",
                        filePath,
                        `species '${species.name ?? "?"}': size.${field}.min must be a positive number (got ${value.min})`);
                }
                else if (typeof value.max !== "number" || value.max <= 0)
                {
                    checkError(
                        "Size validity",
                        filePath,
                        `species '${species.name ?? "?"}': size.${field}.max must be a positive number (got ${value.max})`);
                }
                else if (value.min > value.max)
                {
                    checkError(
                        "Size validity",
                        filePath,
                        `species '${species.name ?? "?"}': size.${field}.min (${value.min}) must not exceed max (${value.max})`);
                }
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

            const holotypeCompleteness = species?.holotype?.completeness;
            if (holotypeCompleteness && !allowedCompleteness.has(holotypeCompleteness))
            {
                checkError(
                    "Locomotion/completeness compliance",
                    filePath,
                    `species '${species.name ?? "?"}': invalid holotype.completeness '${holotypeCompleteness}' (must be one of: ${[...allowedCompleteness].join(", ")})`);
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
        const speciesLabel = species.name ?? "?";

        // When holotype.status is set to a valid enum value, the block represents
        // a lost/destroyed/unknown-state specimen where specimen_id, institution,
        // and specimen_type may be unavailable. See #1850.
        const hasValidStatus = typeof holotype.status === "string"
            && allowedHolotypeStatus.has(holotype.status);

        const hasSpecimenIdArray = Array.isArray(holotype.specimen_id)
            && holotype.specimen_id.length > 0;

        if (!hasSpecimenIdArray)
        {
            if (!hasValidStatus)
            {
                checkError(
                    "Holotype consistency",
                    filePath,
                    `species '${speciesLabel}': holotype present but missing 'specimen_id' (must be a non-empty array of catalogue numbers, or set 'status' to lost/destroyed/unknown)`);
            }
        }
        else
        {
            for (const [index, value] of holotype.specimen_id!.entries())
            {
                if (typeof value !== "string" || value.trim().length === 0)
                {
                    checkError(
                        "Holotype consistency",
                        filePath,
                        `species '${speciesLabel}': specimen_id[${index}] must be a non-empty string`);
                }
            }
        }

        if (!holotype.institution && !hasValidStatus)
        {
            checkError(
                "Holotype consistency",
                filePath,
                `species '${speciesLabel}': holotype present but missing 'institution'`);
        }
        else if (holotype.institution && !allowedInstitutionKeys.has(holotype.institution))
        {
            checkError(
                "Holotype consistency",
                filePath,
                `species '${speciesLabel}': institution '${holotype.institution}' is not a valid key in institutions.yaml`);
        }

        if (holotype.specimen_type === undefined)
        {
            if (!hasValidStatus)
            {
                checkError(
                    "Holotype consistency",
                    filePath,
                    `species '${speciesLabel}': holotype present but missing 'specimen_type' (must be one of: ${[...allowedSpecimenTypes].join(", ")})`);
            }
        }
        else if (!allowedSpecimenTypes.has(holotype.specimen_type))
        {
            checkError(
                "Holotype consistency",
                filePath,
                `species '${speciesLabel}': invalid specimen_type '${holotype.specimen_type}' (must be one of: ${[...allowedSpecimenTypes].join(", ")})`);
        }
        else if (hasSpecimenIdArray)
        {
            const idCount = holotype.specimen_id!.length;
            const singleTypes = new Set(["holotype", "lectotype", "neotype"]);

            if (singleTypes.has(holotype.specimen_type) && idCount !== 1)
            {
                checkError(
                    "Holotype consistency",
                    filePath,
                    `species '${speciesLabel}': specimen_type '${holotype.specimen_type}' requires exactly 1 specimen_id (got ${idCount})`);
            }
            else if (holotype.specimen_type === "syntype" && idCount < 2)
            {
                checkError(
                    "Holotype consistency",
                    filePath,
                    `species '${speciesLabel}': specimen_type 'syntype' requires at least 2 specimen_ids (got ${idCount})`);
            }
        }

        if (holotype.status !== undefined && !allowedHolotypeStatus.has(holotype.status))
        {
            checkError(
                "Holotype consistency",
                filePath,
                `species '${speciesLabel}': invalid holotype status '${holotype.status}' (must be one of: ${[...allowedHolotypeStatus].join(", ")})`);
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

// 24. American English
//
// Surfaces British-English spellings in editorial prose fields so they
// can be converted to American English (project policy). Skipped:
// reference titles/journals/publishers/authors (proper-noun metadata
// preserved verbatim) and species/synonym names (taxon authority).
startCheck("American English");

/**
 * Curated map of British spellings to their American equivalents.
 * Each entry is a word-boundary, case-insensitive regex paired with
 * the suggested American replacement. Entries are deliberately
 * conservative: only words that are unambiguously British (no
 * homographs with valid American words — "analyses" the noun plural
 * of "analysis" is omitted on purpose).
 */
const britishToAmerican: Array<[RegExp, string]> = [
    [/\bcolour\b/gi, "color"],
    [/\bcolours\b/gi, "colors"],
    [/\bcoloured\b/gi, "colored"],
    [/\bcolouring\b/gi, "coloring"],
    [/\bcolouration\b/gi, "coloration"],
    [/\bcolourful\b/gi, "colorful"],
    [/\barmour\b/gi, "armor"],
    [/\barmours\b/gi, "armors"],
    [/\barmoured\b/gi, "armored"],
    [/\bbehaviour\b/gi, "behavior"],
    [/\bbehaviours\b/gi, "behaviors"],
    [/\bbehavioural\b/gi, "behavioral"],
    [/\bfavour\b/gi, "favor"],
    [/\bfavours\b/gi, "favors"],
    [/\bfavoured\b/gi, "favored"],
    [/\bfavouring\b/gi, "favoring"],
    [/\bfavourite\b/gi, "favorite"],
    [/\bhonour\b/gi, "honor"],
    [/\bhonours\b/gi, "honors"],
    [/\bhonoured\b/gi, "honored"],
    [/\bhonouring\b/gi, "honoring"],
    [/\bhonourable\b/gi, "honorable"],
    [/\bharbour\b/gi, "harbor"],
    [/\bharbours\b/gi, "harbors"],
    [/\bharboured\b/gi, "harbored"],
    [/\blabour\b/gi, "labor"],
    [/\blabours\b/gi, "labors"],
    [/\blaboured\b/gi, "labored"],
    [/\bneighbour\b/gi, "neighbor"],
    [/\bneighbours\b/gi, "neighbors"],
    [/\bneighbouring\b/gi, "neighboring"],
    [/\bneighbourhood\b/gi, "neighborhood"],
    [/\brumour\b/gi, "rumor"],
    [/\bvigour\b/gi, "vigor"],
    [/\bsavour\b/gi, "savor"],
    [/\bcentre\b/gi, "center"],
    [/\bcentres\b/gi, "centers"],
    [/\bcentred\b/gi, "centered"],
    [/\bcentring\b/gi, "centering"],
    [/\btheatre\b/gi, "theater"],
    [/\bspectre\b/gi, "specter"],
    [/\bsceptre\b/gi, "scepter"],
    [/\bmetre\b/gi, "meter"],
    [/\bmetres\b/gi, "meters"],
    [/\bkilometre\b/gi, "kilometer"],
    [/\bkilometres\b/gi, "kilometers"],
    [/\bmillimetre\b/gi, "millimeter"],
    [/\bmillimetres\b/gi, "millimeters"],
    [/\bcentimetre\b/gi, "centimeter"],
    [/\bcentimetres\b/gi, "centimeters"],
    [/\bfibre\b/gi, "fiber"],
    [/\bfibres\b/gi, "fibers"],
    [/\bmanoeuvre\b/gi, "maneuver"],
    [/\bmanoeuvres\b/gi, "maneuvers"],
    [/\bmanoeuvred\b/gi, "maneuvered"],
    [/\bmanoeuvring\b/gi, "maneuvering"],
    [/\bdefence\b/gi, "defense"],
    [/\bdefences\b/gi, "defenses"],
    [/\boffence\b/gi, "offense"],
    [/\boffences\b/gi, "offenses"],
    [/\bpretence\b/gi, "pretense"],
    [/\blicence\b/gi, "license"],
    [/\blicences\b/gi, "licenses"],
    [/\blicenced\b/gi, "licensed"],
    [/\bcatalogue\b/gi, "catalog"],
    [/\bcatalogues\b/gi, "catalogs"],
    [/\bcatalogued\b/gi, "cataloged"],
    [/\bcataloguing\b/gi, "cataloging"],
    [/\bdialogue\b/gi, "dialog"],
    [/\bdialogues\b/gi, "dialogs"],
    [/\banalyse\b/gi, "analyze"],
    [/\banalysed\b/gi, "analyzed"],
    [/\banalysing\b/gi, "analyzing"],
    [/\borganise\b/gi, "organize"],
    [/\borganised\b/gi, "organized"],
    [/\borganises\b/gi, "organizes"],
    [/\borganising\b/gi, "organizing"],
    [/\borganisation\b/gi, "organization"],
    [/\borganisations\b/gi, "organizations"],
    [/\borganisational\b/gi, "organizational"],
    [/\bsynthesise\b/gi, "synthesize"],
    [/\bsynthesised\b/gi, "synthesized"],
    [/\bsynthesising\b/gi, "synthesizing"],
    [/\bsynthesises\b/gi, "synthesizes"],
    [/\brecognise\b/gi, "recognize"],
    [/\brecognised\b/gi, "recognized"],
    [/\brecognises\b/gi, "recognizes"],
    [/\brecognising\b/gi, "recognizing"],
    [/\brecognisable\b/gi, "recognizable"],
    [/\bspecialise\b/gi, "specialize"],
    [/\bspecialised\b/gi, "specialized"],
    [/\bspecialises\b/gi, "specializes"],
    [/\bspecialising\b/gi, "specializing"],
    [/\bspecialisation\b/gi, "specialization"],
    [/\bcharacterise\b/gi, "characterize"],
    [/\bcharacterised\b/gi, "characterized"],
    [/\bcharacterises\b/gi, "characterizes"],
    [/\bcharacterising\b/gi, "characterizing"],
    [/\bemphasise\b/gi, "emphasize"],
    [/\bemphasised\b/gi, "emphasized"],
    [/\bemphasises\b/gi, "emphasizes"],
    [/\bemphasising\b/gi, "emphasizing"],
    [/\brealise\b/gi, "realize"],
    [/\brealised\b/gi, "realized"],
    [/\brealises\b/gi, "realizes"],
    [/\brealising\b/gi, "realizing"],
    [/\brealisation\b/gi, "realization"],
    [/\butilise\b/gi, "utilize"],
    [/\butilised\b/gi, "utilized"],
    [/\butilises\b/gi, "utilizes"],
    [/\butilising\b/gi, "utilizing"],
    [/\butilisation\b/gi, "utilization"],
    [/\bcivilisation\b/gi, "civilization"],
    [/\bcivilisations\b/gi, "civilizations"],
    [/\bcolonisation\b/gi, "colonization"],
    [/\bhypothesise\b/gi, "hypothesize"],
    [/\bhypothesised\b/gi, "hypothesized"],
    [/\bprioritise\b/gi, "prioritize"],
    [/\bprioritised\b/gi, "prioritized"],
    [/\bwhilst\b/gi, "while"],
    [/\bamongst\b/gi, "among"],
    [/\btravelled\b/gi, "traveled"],
    [/\btravelling\b/gi, "traveling"],
    [/\btraveller\b/gi, "traveler"],
    [/\btravellers\b/gi, "travelers"],
    [/\bmodelled\b/gi, "modeled"],
    [/\bmodelling\b/gi, "modeling"],
    [/\blabelled\b/gi, "labeled"],
    [/\blabelling\b/gi, "labeling"],
    [/\bsignalled\b/gi, "signaled"],
    [/\bsignalling\b/gi, "signaling"],
    [/\bcancelled\b/gi, "canceled"],
    [/\bcancelling\b/gi, "canceling"],
    [/\bfuelled\b/gi, "fueled"],
    [/\bfuelling\b/gi, "fueling"],
    [/\bfocussed\b/gi, "focused"],
    [/\bfocussing\b/gi, "focusing"],
    [/\bsulphur\b/gi, "sulfur"],
    [/\bsulphuric\b/gi, "sulfuric"],
    [/\baluminium\b/gi, "aluminum"],
    [/\bmoulting\b/gi, "molting"],
    [/\bmoulted\b/gi, "molted"],
    [/\bmoult\b/gi, "molt"],
    [/\bmoults\b/gi, "molts"],
    [/\bmould\b/gi, "mold"],
    [/\bmoulds\b/gi, "molds"],
    [/\bmoulded\b/gi, "molded"],
    [/\bmoulding\b/gi, "molding"],
    [/\bpalaeontology\b/gi, "paleontology"],
    [/\bpalaeontologist\b/gi, "paleontologist"],
    [/\bpalaeontologists\b/gi, "paleontologists"],
    [/\bpalaeontological\b/gi, "paleontological"],
    [/\bpalaeozoic\b/gi, "paleozoic"],
    [/\bpalaeocene\b/gi, "paleocene"],
    [/\bhaematology\b/gi, "hematology"],
    [/\boesophagus\b/gi, "esophagus"],
    [/\bfoetus\b/gi, "fetus"],
    [/\bfoetal\b/gi, "fetal"],
    [/\bmediaeval\b/gi, "medieval"],
    [/\bencyclopaedia\b/gi, "encyclopedia"],
    [/\borthopaedic\b/gi, "orthopedic"],
];

/**
 * Proper-noun phrases that include a British spelling but are
 * preserved verbatim because they are the official name of an
 * institution, collection, or other entity. Matches are removed
 * from the field text before the British-spelling regexes run,
 * so the embedded British word does not trigger a warning.
 */
const protectedProperNouns: Array<RegExp> = [
    /Royal Tyrrell Museum of Palaeontology/g,
    /Australian Opal Centre/g,
    /Palaeontological collection, Department of Mineral/g,
];

/**
 * Scans a single string field for British-English spellings and
 * emits one warning per distinct word found.
 *
 * @param filePath - Absolute path to the YAML file under inspection.
 * @param fieldPath - Dotted path describing the field's location.
 * @param text - The field's string value.
 */
function checkAmericanEnglish(filePath: string, fieldPath: string, text: string): void
{
    let scrubbed = text;

    for (const phrase of protectedProperNouns)
    {
        scrubbed = scrubbed.replace(phrase, "");
    }

    const seen = new Set<string>();

    for (const [pattern, replacement] of britishToAmerican)
    {
        pattern.lastIndex = 0;
        const matches = scrubbed.match(pattern);

        if (matches === null || matches.length === 0)
        {
            continue;
        }

        for (const match of matches)
        {
            const lowered = match.toLowerCase();
            const key = `${lowered}|${replacement}`;

            if (seen.has(key))
            {
                continue;
            }

            seen.add(key);
            checkWarning(
                "American English",
                filePath,
                `${fieldPath}: "${match}" → use "${replacement}" (American English; project policy)`);
        }
    }
}

for (const [filePath, doc] of allParsed)
{
    if (!doc)
    {
        continue;
    }

    if (typeof doc.description === "string")
    {
        checkAmericanEnglish(filePath, "description", doc.description);
    }

    const genus = doc as GenusData;

    if (typeof genus.etymology === "string")
    {
        checkAmericanEnglish(filePath, "etymology", genus.etymology);
    }

    if (typeof genus.dispute === "string")
    {
        checkAmericanEnglish(filePath, "dispute", genus.dispute);
    }

    if (Array.isArray(genus.diagnostic_features))
    {
        for (let index = 0; index < genus.diagnostic_features.length; index += 1)
        {
            const feature = genus.diagnostic_features[index];

            if (typeof feature === "string")
            {
                checkAmericanEnglish(filePath, `diagnostic_features[${index}]`, feature);
            }
        }
    }

    if (Array.isArray(genus.synonyms))
    {
        for (let index = 0; index < genus.synonyms.length; index += 1)
        {
            const synonym = genus.synonyms[index];

            if (synonym && typeof synonym.reason === "string")
            {
                checkAmericanEnglish(filePath, `synonyms[${index}].reason`, synonym.reason);
            }
        }
    }

    if (Array.isArray(genus.species))
    {
        for (let speciesIndex = 0; speciesIndex < genus.species.length; speciesIndex += 1)
        {
            const species = genus.species[speciesIndex];

            if (!species)
            {
                continue;
            }

            const speciesLabel = `species[${speciesIndex}]`;

            if (typeof species.etymology === "string")
            {
                checkAmericanEnglish(filePath, `${speciesLabel}.etymology`, species.etymology);
            }

            if (species.holotype && typeof species.holotype.material === "string")
            {
                checkAmericanEnglish(filePath, `${speciesLabel}.holotype.material`, species.holotype.material);
            }

            if (Array.isArray(species.synonyms))
            {
                for (let synonymIndex = 0; synonymIndex < species.synonyms.length; synonymIndex += 1)
                {
                    const synonym = species.synonyms[synonymIndex];

                    if (synonym && typeof synonym.reason === "string")
                    {
                        checkAmericanEnglish(filePath, `${speciesLabel}.synonyms[${synonymIndex}].reason`, synonym.reason);
                    }
                }
            }
        }
    }

    if (Array.isArray(doc.references))
    {
        for (let index = 0; index < doc.references.length; index += 1)
        {
            const reference = doc.references[index];

            if (reference && typeof reference.notes === "string")
            {
                checkAmericanEnglish(filePath, `references[${index}].notes`, reference.notes);
            }
        }
    }
}

// 25. Citation format (paleo-journal hybrid: "Smith (1999)" / "(Smith, 1999)" / "and" not "&")
//
// Catches the two most common deviations from project policy:
//   - "Author & Author" between capitalized names (use "and")
//   - "(Author Year)" no-comma single-citation parenthetical (use "(Author, Year)")
// Scoped to the same editorial fields as the American English check.
startCheck("Citation format");

const ampersandPattern = /\b[A-Z][a-z]+\s*&\s*[A-Z][\p{L}]+/gu;
const noCommaCitationPattern = /\(([A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s+(?:and\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?|et al\.))?\s+\d{4}[a-z]?)\)/g;
const bareYearPattern = /\b([A-Z][a-z]+(?:\s+(?:and|et al\.)\s+[A-Z][a-z]+)?) ([12]\d{3}[a-z]?)\b(?![)\d,;])/g;

/**
 * Capitalized words that frequently precede a four-digit number
 * without being an author surname. Skipping them keeps the bare-year
 * citation check usefully signal-heavy.
 */
const bareYearDenylist = new Set([
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
    "In", "On", "By", "From", "Since", "After", "Before", "Until",
    "Opinion", "Case", "Article", "Recommendation",
    "Note", "Figure", "Table", "Plate", "Volume", "Page", "Section", "Chapter",
]);

/**
 * Scans an editorial field for citation-format violations and emits
 * one warning per distinct issue found.
 *
 * @param filePath - Absolute path to the YAML file under inspection.
 * @param fieldPath - Dotted path describing the field's location.
 * @param text - The field's string value.
 */
function checkCitationFormat(filePath: string, fieldPath: string, text: string): void
{
    const ampersandMatches = text.match(ampersandPattern);

    if (ampersandMatches !== null && ampersandMatches.length > 0)
    {
        const unique = [...new Set(ampersandMatches)];

        for (const match of unique)
        {
            checkWarning(
                "Citation format",
                filePath,
                `${fieldPath}: "${match}" — use "and" between author names, not "&" (project policy)`);
        }
    }

    const noCommaMatches = text.match(noCommaCitationPattern);

    if (noCommaMatches !== null && noCommaMatches.length > 0)
    {
        const unique = [...new Set(noCommaMatches)];

        for (const match of unique)
        {
            checkWarning(
                "Citation format",
                filePath,
                `${fieldPath}: "${match}" — single-citation parenthetical needs a comma before the year (project policy)`);
        }
    }

    const bareYearMatches = [...text.matchAll(bareYearPattern)];
    const reportedBare = new Set<string>();

    for (const match of bareYearMatches)
    {
        const head = match[1].split(/\s+/)[0];

        if (bareYearDenylist.has(head))
        {
            continue;
        }

        const full = match[0];

        if (reportedBare.has(full))
        {
            continue;
        }

        reportedBare.add(full);
        checkWarning(
            "Citation format",
            filePath,
            `${fieldPath}: "${full}" — bare "Author Year" needs parens around the year (narrative: "Author (Year)") or a comma before it (ICZN authority: "Author, Year") (project policy)`);
    }
}

for (const [filePath, doc] of allParsed)
{
    if (!doc)
    {
        continue;
    }

    if (typeof doc.description === "string")
    {
        checkCitationFormat(filePath, "description", doc.description);
    }

    const genus = doc as GenusData;

    if (typeof genus.etymology === "string")
    {
        checkCitationFormat(filePath, "etymology", genus.etymology);
    }

    if (typeof genus.dispute === "string")
    {
        checkCitationFormat(filePath, "dispute", genus.dispute);
    }

    if (Array.isArray(genus.diagnostic_features))
    {
        for (let index = 0; index < genus.diagnostic_features.length; index += 1)
        {
            const feature = genus.diagnostic_features[index];

            if (typeof feature === "string")
            {
                checkCitationFormat(filePath, `diagnostic_features[${index}]`, feature);
            }
        }
    }

    if (Array.isArray(genus.synonyms))
    {
        for (let index = 0; index < genus.synonyms.length; index += 1)
        {
            const synonym = genus.synonyms[index];

            if (synonym && typeof synonym.reason === "string")
            {
                checkCitationFormat(filePath, `synonyms[${index}].reason`, synonym.reason);
            }
        }
    }

    if (Array.isArray(genus.species))
    {
        for (let speciesIndex = 0; speciesIndex < genus.species.length; speciesIndex += 1)
        {
            const species = genus.species[speciesIndex];

            if (!species)
            {
                continue;
            }

            const speciesLabel = `species[${speciesIndex}]`;

            if (typeof species.etymology === "string")
            {
                checkCitationFormat(filePath, `${speciesLabel}.etymology`, species.etymology);
            }

            if (species.holotype && typeof species.holotype.material === "string")
            {
                checkCitationFormat(filePath, `${speciesLabel}.holotype.material`, species.holotype.material);
            }

            if (Array.isArray(species.synonyms))
            {
                for (let synonymIndex = 0; synonymIndex < species.synonyms.length; synonymIndex += 1)
                {
                    const synonym = species.synonyms[synonymIndex];

                    if (synonym && typeof synonym.reason === "string")
                    {
                        checkCitationFormat(filePath, `${speciesLabel}.synonyms[${synonymIndex}].reason`, synonym.reason);
                    }
                }
            }
        }
    }

    if (Array.isArray(doc.references))
    {
        for (let index = 0; index < doc.references.length; index += 1)
        {
            const reference = doc.references[index];

            if (reference && typeof reference.notes === "string")
            {
                checkCitationFormat(filePath, `references[${index}].notes`, reference.notes);
            }
        }
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
