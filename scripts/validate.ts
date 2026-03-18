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
 * @param msg - Human-readable error description.
 */
function addError(check: string, file: string | null, msg: string): void
{
    errors.push({ check, file: file ? relPath(file) : "(global)", message: msg });
}

/**
 * Records a validation warning.
 *
 * @param check - The name of the validation check.
 * @param file - The file path that triggered the warning, or null for global warnings.
 * @param msg - Human-readable warning description.
 */
function addWarning(check: string, file: string | null, msg: string): void
{
    warnings.push({ check, file: file ? relPath(file) : "(global)", message: msg });
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
 * @param msg - Human-readable error description.
 */
function checkError(name: string, file: string | null, msg: string): void
{
    checkResults[name].errors++;
    addError(name, file, msg);
}

/**
 * Records a warning for a specific validation check.
 *
 * @param name - The check name (must have been initialized with startCheck).
 * @param file - The file path, or null for global warnings.
 * @param msg - Human-readable warning description.
 */
function checkWarning(name: string, file: string | null, msg: string): void
{
    checkResults[name].warnings++;
    addWarning(name, file, msg);
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
    catch (err: unknown)
    {
        const message = err instanceof Error ? err.message : String(err);

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

for (const f of genusFiles)
{
    try
    {
        const doc = yaml.load(fs.readFileSync(f, "utf8")) as GenusData;
        genusParsed.set(f, doc);
    }
    catch (err: unknown)
    {
        const message = err instanceof Error ? err.message : String(err);
        checkError("YAML syntax", f, `YAML parse error: ${message}`);
    }
}

for (const f of cladeFiles)
{
    try
    {
        const doc = yaml.load(fs.readFileSync(f, "utf8")) as CladeData;
        cladeParsed.set(f, doc);
    }
    catch (err: unknown)
    {
        const message = err instanceof Error ? err.message : String(err);
        checkError("YAML syntax", f, `YAML parse error: ${message}`);
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

    for (const sp of doc.species)
    {
        if (sp && sp.name)
        {
            allSpeciesNames.add(sp.name);
        }
    }
}

// 2. Schema compliance (status, diet)
startCheck("Schema compliance");

for (const [f, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    if (doc.diet && !allowedDiet.has(doc.diet))
    {
        checkError(
            "Schema compliance",
            f,
            `invalid diet value '${doc.diet}' (must be one of: ${[...allowedDiet].join(", ")})`);
    }

    if (Array.isArray(doc.species))
    {
        for (const sp of doc.species)
        {
            if (sp && sp.status && !allowedStatus.has(sp.status))
            {
                checkError(
                    "Schema compliance",
                    f,
                    `species '${sp.name ?? "?"}': invalid status '${sp.status}' (must be one of: ${[...allowedStatus].join(", ")})`);
            }
        }
    }
}

// 3. Tree consistency — genus parent exists in tree
startCheck("Tree consistency");

for (const [f, doc] of genusParsed)
{
    if (doc && doc.parent && !treeClades.has(doc.parent))
    {
        checkError(
            "Tree consistency",
            f,
            `parent clade '${doc.parent}' not found in tree.yml`);
    }
}

// 4. Clade coverage — every tree clade has a file (except scaffolding)
startCheck("Clade coverage");

const cladeFileNames = new Set<string>(
    cladeFiles.map(
        (f) => path.basename(f).replace(/\.(yml|yaml)$/, "")),
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

for (const f of cladeFiles)
{
    const name = path.basename(f).replace(/\.(yml|yaml)$/, "");

    if (!treeClades.has(name))
    {
        checkError(
            "No orphan clades",
            f,
            `clade file exists but '${name}' is not in tree.yml`);
    }
}

// 6. Naming conventions
startCheck("Naming conventions");

for (const [f, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    const fileName = path.basename(f).replace(/\.(yml|yaml)$/, "");

    if (doc.genus && doc.genus !== fileName)
    {
        checkError(
            "Naming conventions",
            f,
            `filename '${fileName}' does not match genus field '${doc.genus}'`);
    }

    // Check alphabetical directory
    if (doc.genus)
    {
        const expectedDir = doc.genus.charAt(0).toUpperCase();
        const actualDir = path.basename(path.dirname(f));

        if (actualDir !== expectedDir)
        {
            checkError(
                "Naming conventions",
                f,
                `file is in directory '${actualDir}' but genus '${doc.genus}' should be in '${expectedDir}'`);
        }
    }
}

// 7. Required fields
startCheck("Required fields");

const requiredGenusFields: Array<keyof GenusData> = ["genus", "parent", "description"];
const requiredSpeciesFields: Array<keyof Species> = ["name", "status", "period"];

for (const [f, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    for (const field of requiredGenusFields)
    {
        if (!doc[field])
        {
            checkError("Required fields", f, `missing required field '${field}'`);
        }
    }

    if (!Array.isArray(doc.species) || doc.species.length === 0)
    {
        checkError("Required fields", f, "must have at least one species");
    }
    else
    {
        for (const sp of doc.species)
        {
            if (!sp)
            {
                continue;
            }

            for (const field of requiredSpeciesFields)
            {
                if (!sp[field])
                {
                    checkError(
                        "Required fields",
                        f,
                        `species '${sp.name ?? "?"}': missing required field '${field}'`);
                }
            }
        }
    }
}

// 8. Type species — exactly one per genus
startCheck("Type species");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    const species = doc.species.filter(sp => sp && sp.type_species === true);

    if (species.length === 0)
    {
        checkError("Type species", f, "no species marked as type_species");
    }
    else if (species.length > 1)
    {
        checkError(
            "Type species",
            f,
            `multiple species marked as type_species: ${species.map(s => s.name).join(", ")}`);
    }
}

// 9. Stage-period agreement
startCheck("Stage-period agreement");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const sp of doc.species)
    {
        if (!sp || !sp.period)
        {
            continue;
        }

        const period = sp.period;

        if (period.stage && period.name)
        {
            const stageInfo = stages[period.stage];

            if (!stageInfo)
            {
                checkError(
                    "Stage-period agreement",
                    f,
                    `species '${sp.name ?? "?"}': unknown stage '${period.stage}'`);
            }
            else if (stageInfo.period !== period.name)
            {
                checkError(
                    "Stage-period agreement",
                    f,
                    `species '${sp.name ?? "?"}': stage '${period.stage}' belongs to '${stageInfo.period}', not '${period.name}'`);
            }
        }
    }
}

// 10. Reference integrity — described_in matches a reference id
startCheck("Reference integrity");

for (const [f, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    const ids = new Set<string>();

    if (Array.isArray(doc.references))
    {
        for (const ref of doc.references)
        {
            if (ref && ref.id)
            {
                ids.add(ref.id);
            }
        }
    }

    // Check genus-level described_in
    if (doc.described_in && !ids.has(doc.described_in))
    {
        checkError(
            "Reference integrity",
            f,
            `described_in '${doc.described_in}' does not match any reference id`);
    }

    // Check species-level described_in
    if (Array.isArray(doc.species))
    {
        for (const sp of doc.species)
        {
            if (sp && sp.described_in && !ids.has(sp.described_in))
            {
                checkError(
                    "Reference integrity",
                    f,
                    `species '${sp.name ?? "?"}': described_in '${sp.described_in}' does not match any reference id`);
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

    for (const ref of doc.references)
    {
        if (!ref)
        {
            continue;
        }

        for (const field of requiredRefFields)
        {
            if (!ref[field])
            {
                checkError(
                    "Reference completeness",
                    filePath,
                    `reference '${ref.id ?? "?"}': missing required field '${field}'`);
            }
        }

        if (!ref.journal && !ref.book)
        {
            checkError(
                "Reference completeness",
                filePath,
                `reference '${ref.id ?? "?"}': must have at least one of 'journal' or 'book'`);
        }
    }
}

for (const [f, doc] of genusParsed)
{
    validateReferences(f, doc);
}

for (const [f, doc] of cladeParsed)
{
    validateReferences(f, doc);
}

// 12. Unique reference IDs
startCheck("Unique reference IDs");

const allParsed: Array<[string, GenusData | CladeData]> = [
    ...genusParsed.entries(),
    ...cladeParsed.entries(),
];

for (const [f, doc] of allParsed)
{
    if (!doc || !Array.isArray(doc.references))
    {
        continue;
    }

    const seen = new Set<string>();

    for (const ref of doc.references)
    {
        if (!ref || !ref.id)
        {
            continue;
        }

        if (seen.has(ref.id))
        {
            checkError("Unique reference IDs", f, `duplicate reference id '${ref.id}'`);
        }

        seen.add(ref.id);
    }
}

// 13. Location completeness — country required if location present
startCheck("Location completeness");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const sp of doc.species)
    {
        if (sp && sp.location && !sp.location.country)
        {
            checkError(
                "Location completeness",
                f,
                `species '${sp.name ?? "?"}': location present but missing 'country'`);
        }
    }
}

// 14. Country typo detection (warning)
startCheck("Country validation");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const sp of doc.species)
    {
        if (sp && sp.location && sp.location.country && !allowedCountries.has(sp.location.country))
        {
            checkWarning(
                "Country validation",
                f,
                `species '${sp.name ?? "?"}': country '${sp.location.country}' not in schema countries list`);
        }
    }
}

// 15. Coordinate validity
startCheck("Coordinate validity");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const sp of doc.species)
    {
        if (!sp || !sp.location || !sp.location.coordinates)
        {
            continue;
        }

        const coords = sp.location.coordinates;
        if (!Array.isArray(coords) || coords.length < 2)
        {
            checkError(
                "Coordinate validity",
                f,
                `species '${sp.name ?? "?"}': coordinates must be [lat, lon]`);
            continue;
        }

        const [lat, lon] = coords;
        if (typeof lat !== "number" || lat < -90 || lat > 90)
        {
            checkError(
                "Coordinate validity",
                f,
                `species '${sp.name ?? "?"}': latitude ${lat} out of range (-90 to 90)`);
        }

        if (typeof lon !== "number" || lon < -180 || lon > 180)
        {
            checkError(
                "Coordinate validity",
                f,
                `species '${sp.name ?? "?"}': longitude ${lon} out of range (-180 to 180)`);
        }
    }
}

// 16. Period consistency — stage belongs to period; Ma range within stage
startCheck("Period consistency");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const sp of doc.species)
    {
        if (!sp || !sp.period)
        {
            continue;
        }

        const per = sp.period;

        // Stage belongs to period (already checked in #9, but here check Ma range)
        if (per.stage)
        {
            const stageInfo: StageInfo | undefined = stages[per.stage];
            if (stageInfo)
            {
                // Check from_ma
                if (per.from_ma !== undefined && per.from_ma !== null)
                {
                    if (typeof per.from_ma !== "number" || per.from_ma > stageInfo.from_ma || per.from_ma < stageInfo.to_ma)
                    {
                        checkError(
                            "Period consistency",
                            f,
                            `species '${sp.name ?? "?"}': from_ma ${per.from_ma} outside stage '${per.stage}' range (${stageInfo.from_ma}\u2013${stageInfo.to_ma} Ma)`);
                    }
                }

                // Check to_ma
                if (per.to_ma !== undefined && per.to_ma !== null)
                {
                    if (typeof per.to_ma !== "number" || per.to_ma > stageInfo.from_ma || per.to_ma < stageInfo.to_ma)
                    {
                        checkError(
                            "Period consistency",
                            f,
                            `species '${sp.name ?? "?"}': to_ma ${per.to_ma} outside stage '${per.stage}' range (${stageInfo.from_ma}\u2013${stageInfo.to_ma} Ma)`);
                    }
                }

                // from_ma should be >= to_ma
                if (typeof per.from_ma === "number" && typeof per.to_ma === "number" && per.from_ma < per.to_ma)
                {
                    checkError(
                        "Period consistency",
                        f,
                        `species '${sp.name ?? "?"}': from_ma (${per.from_ma}) must be >= to_ma (${per.to_ma})`);
                }
            }
        }
    }
}

// 17. Synonym integrity
startCheck("Synonym integrity");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const sp of doc.species)
    {
        if (sp && sp.status === "synonym")
        {
            if (!sp.synonym_of)
            {
                checkError(
                    "Synonym integrity",
                    f,
                    `species '${sp.name ?? "?"}': status is 'synonym' but missing 'synonym_of'`);
            }
            else if (!allSpeciesNames.has(sp.synonym_of))
            {
                checkError(
                    "Synonym integrity",
                    f,
                    `species '${sp.name ?? "?"}': synonym_of '${sp.synonym_of}' not found in any genus file`);
            }
        }
        else if (sp && sp.synonym_of)
        {
            checkError(
                "Synonym integrity",
                f,
                `species '${sp.name ?? "?"}': has 'synonym_of' but status is '${sp.status}', not 'synonym'`);
        }
    }
}

// 18. Size validity
startCheck("Size validity");

const sizeNumericFields: Array<keyof Size> = ["length_m", "weight_kg", "hip_height_m", "skull_length_m"];

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const sp of doc.species)
    {
        if (!sp || !sp.size)
        {
            continue;
        }

        const size = sp.size;
        for (const field of sizeNumericFields)
        {
            const value = size[field];
            if (value !== undefined && value !== null)
            {
                if (typeof value !== "number" || value <= 0)
                {
                    checkError(
                        "Size validity",
                        f,
                        `species '${sp.name ?? "?"}': size.${field} must be a positive number (got ${value})`);
                }
            }
        }

        if (size.estimate !== undefined && size.estimate !== null)
        {
            if (typeof size.estimate !== "boolean")
            {
                checkError(
                    "Size validity",
                    f,
                    `species '${sp.name ?? "?"}': size.estimate must be a boolean (got ${typeof size.estimate})`);
            }
        }
    }
}

// 19. Locomotion / completeness compliance
startCheck("Locomotion/completeness compliance");

for (const [f, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    if (doc.locomotion && !allowedLocomotion.has(doc.locomotion))
    {
        checkError(
            "Locomotion/completeness compliance",
            f,
            `invalid locomotion value '${doc.locomotion}' (must be one of: ${[...allowedLocomotion].join(", ")})`);
    }

    if (Array.isArray(doc.species))
    {
        for (const sp of doc.species)
        {
            if (sp && sp.completeness && !allowedCompleteness.has(sp.completeness))
            {
                checkError(
                    "Locomotion/completeness compliance",
                    f,
                    `species '${sp.name ?? "?"}': invalid completeness '${sp.completeness}' (must be one of: ${[...allowedCompleteness].join(", ")})`);
            }
        }
    }
}

// 20. Holotype consistency
startCheck("Holotype consistency");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const sp of doc.species)
    {
        if (!sp || !sp.holotype)
        {
            continue;
        }

        const ht = sp.holotype;
        if (!ht.specimen_id)
        {
            checkError(
                "Holotype consistency",
                f,
                `species '${sp.name ?? "?"}': holotype present but missing 'specimen_id'`);
        }

        if (!ht.institution)
        {
            checkError(
                "Holotype consistency",
                f,
                `species '${sp.name ?? "?"}': holotype present but missing 'institution'`);
        }
    }
}

// 21. Appearance compliance
startCheck("Appearance compliance");

for (const [f, doc] of genusParsed)
{
    if (!doc || !doc.appearance)
    {
        continue;
    }

    const app = doc.appearance;
    if (app.integument && !allowedIntegument.has(app.integument))
    {
        checkError(
            "Appearance compliance",
            f,
            `invalid integument '${app.integument}' (must be one of: ${[...allowedIntegument].join(", ")})`);
    }

    if (app.evidence && !allowedIntegumentEvidence.has(app.evidence))
    {
        checkError(
            "Appearance compliance",
            f,
            `invalid integument evidence '${app.evidence}' (must be one of: ${[...allowedIntegumentEvidence].join(", ")})`);
    }
}

// 22. Paleoenvironment compliance
startCheck("Paleoenvironment compliance");

for (const [f, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    if (Array.isArray(doc.paleoenvironment))
    {
        for (const env of doc.paleoenvironment)
        {
            if (!allowedPaleoenvironments.has(env))
            {
                checkError(
                    "Paleoenvironment compliance",
                    f,
                    `invalid paleoenvironment '${env}' (must be one of: ${[...allowedPaleoenvironments].join(", ")})`);
            }
        }
    }
    else if (doc.paleoenvironment && typeof doc.paleoenvironment === "string")
    {
        if (!allowedPaleoenvironments.has(doc.paleoenvironment))
        {
            checkError(
                "Paleoenvironment compliance",
                f,
                `invalid paleoenvironment '${doc.paleoenvironment}' (must be one of: ${[...allowedPaleoenvironments].join(", ")})`);
        }
    }
}

// 23. Identifier compliance
startCheck("Identifier compliance");

for (const [f, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.identifiers))
    {
        continue;
    }

    const seenPairs = new Set<string>();
    for (const ident of doc.identifiers)
    {
        if (!ident)
        {
            continue;
        }

        if (ident.source && !allowedIdentifierSources.has(ident.source))
        {
            checkError(
                "Identifier compliance",
                f,
                `invalid identifier source '${ident.source}' (must be one of: ${[...allowedIdentifierSources].join(", ")})`);
        }

        if (!ident.id || (typeof ident.id === "string" && ident.id.trim() === ""))
        {
            checkError(
                "Identifier compliance",
                f,
                `identifier with source '${ident.source ?? "?"}' has empty or missing 'id'`);
        }

        const pair = `${ident.source}:${ident.id}`;
        if (seenPairs.has(pair))
        {
            checkError(
                "Identifier compliance",
                f,
                `duplicate identifier source/id pair: ${pair}`);
        }

        seenPairs.add(pair);
    }
}

// Output

console.log("Validating Open Paleo data...\n");

for (const name of Object.keys(checkResults))
{
    const r = checkResults[name];
    if (r.errors === 0 && r.warnings === 0)
    {
        console.log(`\u2713 ${name} check passed`);
    }
    else if (r.errors > 0)
    {
        console.log(`\u2717 ${name}: ${r.errors} error${r.errors !== 1 ? "s" : ""}`);
        for (const e of errors.filter(e => e.check === name))
        {
            console.log(`  ${e.file}: ${e.message}`);
        }
    }
    else
    {
        console.log(`\u26A0 ${name}: ${r.warnings} warning${r.warnings !== 1 ? "s" : ""}`);
        for (const w of warnings.filter(w => w.check === name))
        {
            console.log(`  ${w.file}: ${w.message}`);
        }
    }
}

console.log(`\nSummary: ${errors.length} error${errors.length !== 1 ? "s" : ""}, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`);

process.exit(errors.length > 0 ? 1 : 0);
