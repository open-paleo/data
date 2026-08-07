#!/usr/bin/env npx tsx

// Open Paleo — Data Validation Script
// Validates YAML data files against the schema and tree structure.

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse as parseYamlContent } from "yaml";

import { buildFlaggedSet, buildVerifiedSet, findYamlFiles, loadFlaggedSignoffs, loadFlaggedSources, referenceBucket } from "./utilities.ts";

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
 * Determines which tree clades have at least one member genus somewhere in
 * their subtree, accumulating the populated clade names into `populated`.
 *
 * A clade counts as populated when it is the direct `parent:` of some genus,
 * or when any of its descendant clades is populated. Every child is visited
 * so the accumulator is filled for the whole tree, not just the first hit.
 *
 * @param node - The tree node (map of child clade name to subtree) to inspect.
 * @param name - The clade name of `node`, or null at the tree root.
 * @param genusParents - The set of every `parent:` value across all genera.
 * @param populated - Accumulator set of populated clade names.
 * @returns True when `node`'s subtree contains at least one member genus.
 */
function collectPopulatedClades(node: TreeNode | null, name: string | null, genusParents: Set<string>, populated: Set<string>): boolean
{
    let hasGenus = name !== null && genusParents.has(name);

    if (node && typeof node === "object")
    {
        for (const key of Object.keys(node))
        {
            const childPopulated = collectPopulatedClades(node[key], key, genusParents, populated);
            if (childPopulated)
            {
                hasGenus = true;
            }
        }
    }

    if (hasGenus && name !== null)
    {
        populated.add(name);
    }

    return hasGenus;
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
const allowedPlacement = new Set(schema.placement ?? []);
const allowedDiet = new Set(schema.diet ?? []);
const allowedLocomotion = new Set(schema.locomotion ?? []);
const allowedCompleteness = new Set(schema.completeness ?? []);
const allowedHolotypeStatus = new Set(schema.holotype_status ?? []);
const allowedSpecimenTypes = new Set(schema.specimen_types ?? []);
const allowedFormerIdReasons = new Set(schema.former_id_reasons ?? []);
const allowedSpecimenCategories = new Set(schema.specimen_categories ?? []);
const allowedIcznRulingTypes = new Set(schema.iczn_ruling_types ?? []);
const allowedIntegument = new Set(schema.integument ?? []);
const allowedIntegumentEvidence = new Set(schema.integument_evidence ?? []);
const allowedFeatures = new Set(Object.values(schema.appearance_features ?? {}).flat());
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

const regionRegistry = parseYamlContent(
    fs.readFileSync(path.join(root, "regions.yaml"), "utf8"),
) as Record<string, string>;
const allowedRegionCodes = new Set(Object.keys(regionRegistry));

const formationRegistry = parseYamlContent(
    fs.readFileSync(path.join(root, "formations.yaml"), "utf8"),
) as Record<string, { rank?: string; stages?: Array<string> }>;

const flaggedSources = loadFlaggedSources(path.join(root, "flagged-sources.yml"));
const flaggedPublishers = buildFlaggedSet(flaggedSources.publishers);
const flaggedJournals = buildFlaggedSet(flaggedSources.journals);
const verifiedReferenceIds = buildVerifiedSet(loadFlaggedSignoffs(path.join(root, "flagged-signoffs.yml")));

// The canonical reference store: references/<letter>/<id>.yml, one file per
// reference. Bibliographic fields live here; per-occurrence notes stay on the
// in-file `{id, notes?}` pointers. Parsed once and shared across the reference
// checks below.
const referenceStoreFiles = findYamlFiles(path.join(root, "references"));
const referenceStoreParsed = new Map<string, Reference | null>();
const referenceStoreById = new Map<string, Reference>();

for (const filePath of referenceStoreFiles)
{
    try
    {
        const entry = parseYamlContent(fs.readFileSync(filePath, "utf8")) as Reference;
        referenceStoreParsed.set(filePath, entry);

        if (entry && entry.id && !referenceStoreById.has(entry.id))
        {
            referenceStoreById.set(entry.id, entry);
        }
    }
    catch
    {
        referenceStoreParsed.set(filePath, null);
    }
}

const referenceStoreIds = new Set(referenceStoreById.keys());

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

    if (doc.placement && !allowedPlacement.has(doc.placement))
    {
        checkError(
            "Schema compliance",
            filePath,
            `invalid placement value '${doc.placement}' (must be one of: ${[...allowedPlacement].join(", ")})`);
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

// 5b. Clade population — every non-scaffolding clade must have a member genus
//     somewhere in its subtree (P4: no empty clades). See issue #1953.
startCheck("Clade population");

const genusParents = new Set<string>();

for (const doc of genusParsed.values())
{
    if (doc && doc.parent)
    {
        genusParents.add(doc.parent);
    }
}

const populatedClades = new Set<string>();
collectPopulatedClades(tree, null, genusParents, populatedClades);

for (const clade of treeClades)
{
    if (!populatedClades.has(clade) && !scaffoldingClades.has(clade))
    {
        checkError(
            "Clade population",
            null,
            `clade '${clade}' in tree.yml has an empty subtree — no genus is parented to it or any descendant (drop the node or reparent genera under it)`);
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

    // Every in-file citation pointer must resolve to a store entry.
    if (Array.isArray(doc.references))
    {
        for (const reference of doc.references)
        {
            if (reference && reference.id && !referenceStoreIds.has(reference.id))
            {
                checkError(
                    "Reference integrity",
                    filePath,
                    `reference '${reference.id}' does not resolve to a store entry (references/${reference.id[0]}/${reference.id}.yml)`);
            }
        }
    }

    // Check the genus-level erected_in (genus-authority override).
    if (doc.erected_in && !referenceStoreIds.has(doc.erected_in))
    {
        checkError(
            "Reference integrity",
            filePath,
            `erected_in '${doc.erected_in}' does not resolve to a store entry`);
    }

    // Check genus-level ICZN ruling references.
    if (Array.isArray(doc.iczn_rulings))
    {
        for (const ruling of doc.iczn_rulings)
        {
            if (ruling && ruling.ruling && !referenceStoreIds.has(ruling.ruling))
            {
                checkError(
                    "Reference integrity",
                    filePath,
                    `iczn_rulings: ruling '${ruling.ruling}' does not resolve to a store entry`);
            }

            if (ruling && ruling.petition && !referenceStoreIds.has(ruling.petition))
            {
                checkError(
                    "Reference integrity",
                    filePath,
                    `iczn_rulings: petition '${ruling.petition}' does not resolve to a store entry`);
            }
        }
    }

    // Check species-level erected_in and described_in.
    if (Array.isArray(doc.species))
    {
        for (const species of doc.species)
        {
            if (species && species.erected_in && !referenceStoreIds.has(species.erected_in))
            {
                checkError(
                    "Reference integrity",
                    filePath,
                    `species '${species.name ?? "?"}': erected_in '${species.erected_in}' does not resolve to a store entry`);
            }

            if (species && species.described_in && !referenceStoreIds.has(species.described_in))
            {
                checkError(
                    "Reference integrity",
                    filePath,
                    `species '${species.name ?? "?"}': described_in '${species.described_in}' does not resolve to a store entry`);
            }
        }
    }
}

// 10a. Clade reference integrity — clade citation pointers and
// erected_in/described_in resolve to a store entry.
startCheck("Clade reference integrity");

for (const [filePath, doc] of cladeParsed)
{
    if (!doc)
    {
        continue;
    }

    if (Array.isArray(doc.references))
    {
        for (const reference of doc.references)
        {
            if (reference && reference.id && !referenceStoreIds.has(reference.id))
            {
                checkError(
                    "Clade reference integrity",
                    filePath,
                    `reference '${reference.id}' does not resolve to a store entry`);
            }
        }
    }

    if (doc.erected_in && !referenceStoreIds.has(doc.erected_in))
    {
        checkError(
            "Clade reference integrity",
            filePath,
            `erected_in '${doc.erected_in}' does not resolve to a store entry`);
    }

    if (doc.described_in && !referenceStoreIds.has(doc.described_in))
    {
        checkError(
            "Clade reference integrity",
            filePath,
            `described_in '${doc.described_in}' does not resolve to a store entry`);
    }
}

// 10b. ICZN ruling compliance — each ruling needs a known type and an Opinion
startCheck("ICZN ruling compliance");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.iczn_rulings))
    {
        continue;
    }

    for (const ruling of doc.iczn_rulings)
    {
        if (!ruling)
        {
            continue;
        }

        if (!ruling.type)
        {
            checkError(
                "ICZN ruling compliance",
                filePath,
                "iczn_rulings: entry missing required 'type'");
        }
        else if (!allowedIcznRulingTypes.has(ruling.type))
        {
            checkError(
                "ICZN ruling compliance",
                filePath,
                `iczn_rulings: invalid type '${ruling.type}' (must be one of: ${[...allowedIcznRulingTypes].join(", ")})`);
        }

        if (!ruling.ruling)
        {
            checkError(
                "ICZN ruling compliance",
                filePath,
                `iczn_rulings: entry of type '${ruling.type ?? "?"}' missing required 'ruling' (the Opinion reference)`);
        }
    }
}

// 10c. Species authority — every species needs erected_in; the denormalized
// authors/described fields were removed in the #1886 migration
startCheck("Species authority");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (!species)
        {
            continue;
        }

        if (!species.erected_in)
        {
            checkError(
                "Species authority",
                filePath,
                `species '${species.name ?? "?"}': missing required 'erected_in'`);
        }

        if ("authors" in species)
        {
            checkError(
                "Species authority",
                filePath,
                `species '${species.name ?? "?"}': legacy 'authors' field present (author is derived from erected_in)`);
        }

        if ("described" in species)
        {
            checkError(
                "Species authority",
                filePath,
                `species '${species.name ?? "?"}': legacy 'described' field present (year is derived from erected_in)`);
        }
    }
}

// 10d. Self-contained references — every reference pointer within a genus or
// clade (erected_in, described_in, iczn_rulings.ruling/petition) must also
// appear in that file's own `references` block, so a consumer can resolve any
// citation from the single inflated record without a separate lookup. The
// build inflates only the `references` list, so a pointer absent from it would
// dangle in the output. (notable_specimens references are already held to this
// rule by the Notable specimens check.)
startCheck("Self-contained references");

/**
 * Reports any pointer id that is missing from a record's own references block.
 *
 * @param filePath - Absolute path to the YAML file under inspection.
 * @param localIds - The set of reference ids listed in the record's references.
 * @param pointers - Labeled pointer ids to verify (label describes the field).
 */
function checkSelfContainedReferences(
    filePath: string,
    localIds: Set<string>,
    pointers: Array<[string, string | undefined]>): void
{
    for (const [label, id] of pointers)
    {
        if (id && !localIds.has(id))
        {
            checkError(
                "Self-contained references",
                filePath,
                `${label} '${id}' is not listed in this file's own references block (add it so the record resolves standalone)`);
        }
    }
}

for (const [filePath, doc] of genusParsed)
{
    if (!doc)
    {
        continue;
    }

    const localIds = new Set(
        (doc.references ?? [])
            .map((reference) => reference?.id)
            .filter((id): id is string => typeof id === "string"));

    const pointers: Array<[string, string | undefined]> = [["erected_in", doc.erected_in]];

    for (const species of doc.species ?? [])
    {
        if (!species)
        {
            continue;
        }

        const speciesLabel = species.name ?? "?";
        pointers.push([`species '${speciesLabel}': erected_in`, species.erected_in]);
        pointers.push([`species '${speciesLabel}': described_in`, species.described_in]);
    }

    for (const ruling of doc.iczn_rulings ?? [])
    {
        if (!ruling)
        {
            continue;
        }

        pointers.push(["iczn_rulings: ruling", ruling.ruling]);
        pointers.push(["iczn_rulings: petition", ruling.petition]);
    }

    checkSelfContainedReferences(filePath, localIds, pointers);
}

for (const [filePath, doc] of cladeParsed)
{
    if (!doc)
    {
        continue;
    }

    const localIds = new Set(
        (doc.references ?? [])
            .map((reference) => reference?.id)
            .filter((id): id is string => typeof id === "string"));

    checkSelfContainedReferences(
        filePath,
        localIds,
        [["erected_in", doc.erected_in], ["described_in", doc.described_in]]);
}

// 11. Reference store integrity — each references/<letter>/<id>.yml file must
// parse, carry an `id` equal to its filename (NFC + lowercase), and hold the
// required bibliographic fields. This is the single source of truth for
// bibliographic data, so completeness is enforced here rather than per citing
// file.
startCheck("Reference store integrity");

const requiredRefFields: Array<keyof Reference> = ["id", "authors", "year", "title"];

for (const [filePath, entry] of referenceStoreParsed)
{
    if (!entry)
    {
        checkError("Reference store integrity", filePath, "store entry failed to parse");
        continue;
    }

    const baseName = path.basename(filePath, ".yml");

    if (entry.id !== baseName)
    {
        checkError(
            "Reference store integrity",
            filePath,
            `store 'id' '${entry.id ?? "?"}' does not match filename '${baseName}'`);
    }

    if (baseName.normalize("NFC") !== baseName)
    {
        checkError(
            "Reference store integrity",
            filePath,
            `filename '${baseName}' is not NFC-normalized`);
    }

    if (baseName !== baseName.toLowerCase())
    {
        checkError(
            "Reference store integrity",
            filePath,
            `filename '${baseName}' must be lowercase`);
    }

    const bucket = path.basename(path.dirname(filePath));
    const expectedBucket = referenceBucket(baseName);

    if (bucket !== expectedBucket)
    {
        checkError(
            "Reference store integrity",
            filePath,
            `store file is in bucket '${bucket}' but key '${baseName}' belongs in '${expectedBucket}' (references/${expectedBucket}/)`);
    }

    for (const field of requiredRefFields)
    {
        if (!entry[field])
        {
            checkError(
                "Reference store integrity",
                filePath,
                `reference '${entry.id ?? baseName}': missing required field '${field}'`);
        }
    }

    // journal/book are optional: an article carries `journal`, a chapter
    // carries `book` (its containing volume), and a standalone book,
    // monograph, thesis, or press release carries neither — its venue is
    // recorded via `publisher` (and `url`/`notes` where applicable).
}

// 11b. Redundant DOI-pointer URLs — a reference `url` that merely points at
// the reference's own DOI (e.g. http://dx.doi.org/{doi}) carries no extra
// information, since any consumer can regenerate it from the `doi` field.
// Keep `url` only when it points somewhere a DOI cannot reach (a repository
// deposit, an archived copy, a paper with no DOI, etc.).
startCheck("Redundant DOI-pointer URL");

/**
 * Determines whether a reference `url` is nothing more than a pointer at the
 * reference's own DOI (e.g. `http://dx.doi.org/{doi}` or
 * `https://doi.org/{doi}`). DOIs are case-insensitive and the URL may
 * percent-encode characters that the raw DOI leaves literal, so both forms
 * are compared.
 *
 * @param urlValue - The reference's `url` field, if present.
 * @param doiValue - The reference's `doi` field, if present.
 * @returns True when the URL only re-encodes the DOI and can be dropped.
 */
function isDoiPointerUrl(urlValue?: string, doiValue?: string): boolean
{
    if (!urlValue || !doiValue)
    {
        return false;
    }

    const match = urlValue.match(/^https?:\/\/(?:[a-z0-9.-]+\.)?doi\.org\/(.+)$/i);

    if (!match)
    {
        return false;
    }

    const urlDoi = match[1];
    const doi = String(doiValue);

    if (urlDoi === doi || urlDoi.toLowerCase() === doi.toLowerCase())
    {
        return true;
    }

    try
    {
        if (decodeURIComponent(urlDoi) === doi)
        {
            return true;
        }
    }
    catch
    {
        // Malformed percent-encoding: fall through to a non-match.
    }

    return false;
}

for (const [filePath, entry] of referenceStoreParsed)
{
    if (entry && isDoiPointerUrl(entry.url, entry.doi))
    {
        checkWarning(
            "Redundant DOI-pointer URL",
            filePath,
            `reference '${entry.id ?? "?"}': url '${entry.url}' just points at its own doi; drop it (consumers can regenerate it from 'doi')`);
    }
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

// 12c. Reference key disambiguation — every store key is uniformly
// `<surname><year><letter>`: a non-numeric author fragment, a 4-digit year,
// and a single lowercase a-z disambiguation suffix (universal `a`-suffixing).
// This keeps keys machine-parseable and means adding another same-author-year
// paper never renames an existing key or retags its citations. Both a bare key
// (ending in its year) and a non-letter suffix (e.g. `sereno1986marginocephalia`)
// violate the convention.
startCheck("Reference key disambiguation");

const referenceKeyPattern = /^\D+\d{4}[a-z]$/;

const referenceStoreFileById = new Map<string, string>();

for (const [filePath, entry] of referenceStoreParsed)
{
    if (entry && entry.id)
    {
        referenceStoreFileById.set(entry.id, filePath);
    }
}

for (const referenceId of referenceStoreIds)
{
    if (!referenceKeyPattern.test(referenceId))
    {
        const suggestion = /\d$/.test(referenceId)
            ? ` (append a disambiguation letter, e.g. '${referenceId}a')`
            : "";

        checkError(
            "Reference key disambiguation",
            referenceStoreFileById.get(referenceId) ?? "(store)",
            `reference key '${referenceId}' must be <surname><year><letter>: a non-numeric author, a 4-digit year, and a single a-z suffix${suggestion}`,
        );
    }
}

// 12b. Flagged publication sources — references citing publishers or
// journals on flagged-sources.yml emit a warning for reviewer sign-off.
startCheck("Flagged publication sources");

for (const [filePath, reference] of referenceStoreParsed)
{
    if (!reference)
    {
        continue;
    }

    const publisher = reference.publisher?.trim().toLowerCase();
    const journal = reference.journal?.trim().toLowerCase();
    const referenceLabel = reference.id ?? reference.title ?? "?";

    if (reference.id && verifiedReferenceIds.has(reference.id))
    {
        continue;
    }

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
            const referenceLabel = reference.id ?? "?";

            checkWarning(
                "Reference notes length",
                filePath,
                `reference '${referenceLabel}': notes is ${reference.notes.length} chars (keep under ${referenceNotesLimit}, prose belongs in description)`);
        }
    }
}

// 12d. Dispute structure — object with a non-empty string summary; history
// entries need a YYYY-MM-DD date and a note. Applies to genera and clades.
startCheck("Dispute structure");

for (const [filePath, doc] of allParsed)
{
    if (!doc || !doc.dispute)
    {
        continue;
    }

    if (typeof doc.dispute.summary !== "string" || doc.dispute.summary.trim() === "")
    {
        checkError(
            "Dispute structure",
            filePath,
            "dispute must have a non-empty 'summary' string");
    }

    const disputeHistory = Array.isArray(doc.dispute.history) ? doc.dispute.history : [];

    for (const update of disputeHistory)
    {
        if (typeof update?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(update.date))
        {
            checkError(
                "Dispute structure",
                filePath,
                "dispute.history entry needs a 'date' in YYYY-MM-DD form");
        }

        if (typeof update?.note !== "string" || update.note.trim() === "")
        {
            checkError(
                "Dispute structure",
                filePath,
                "dispute.history entry needs a non-empty 'note' string");
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

        const member = species?.location?.member;

        if (member !== undefined && typeof member !== "string")
        {
            checkError(
                "Location completeness",
                filePath,
                `species '${species.name ?? "?"}': 'member' must be a string, got ${typeof member} (${JSON.stringify(member)})`);
        }

        const bed = species?.location?.bed;

        if (bed !== undefined && typeof bed !== "string")
        {
            checkError(
                "Location completeness",
                filePath,
                `species '${species.name ?? "?"}': 'bed' must be a string, got ${typeof bed} (${JSON.stringify(bed)})`);
        }

        const part = species?.location?.part;

        if (part !== undefined && typeof part !== "string")
        {
            checkError(
                "Location completeness",
                filePath,
                `species '${species.name ?? "?"}': 'part' must be a string, got ${typeof part} (${JSON.stringify(part)})`);
        }
        else if (typeof part === "string"
            && !species?.location?.bed
            && !species?.location?.member
            && !species?.location?.formation
            && !species?.location?.group)
        {
            // `part` qualifies the finest unit named above it, so with no unit
            // at any rank there is nothing for it to qualify.
            checkError(
                "Location completeness",
                filePath,
                `species '${species.name ?? "?"}': 'part' is set to '${part}' but no group, formation, member or bed is given`);
        }
    }
}

// 13a. A group belongs in `location.group`, not in `location.formation`
startCheck("Formation rank");

const groupRankWord = /\b(Group|Grp\.?|Subgroup|Supergroup)$/;
const knownGroups = new Set(
    Object.entries(formationRegistry)
        .filter(([, entry]) => entry && (entry.rank === "group" || entry.rank === "subgroup"))
        .map(([name]) => name.split(" (")[0]));

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        const formation = species?.location?.formation;

        if (typeof formation !== "string")
        {
            continue;
        }
        else if (groupRankWord.test(formation))
        {
            checkError(
                "Formation rank",
                filePath,
                `species '${species.name ?? "?"}': formation '${formation}' names a group — put it in 'group' with the rank word dropped`);
        }
        else if (knownGroups.has(formation))
        {
            // Nothing in a bare name records its rank, which is why the
            // registry exists: "Morrison" is a formation and "Kem Kem" is a
            // group, spelled the same way in the same field.
            checkError(
                "Formation rank",
                filePath,
                `species '${species.name ?? "?"}': formation '${formation}' is a group per formations.yaml — put it in 'group'`);
        }
    }
}

// 13a. A record's stages against its unit's published range (formations.yaml).
//
// The registry range is an ENVELOPE, never a source to derive from: a taxon is
// frequently dated more finely than its unit, from a level above a contact or a
// dated ash, and that precision is the point. Two things are worth saying about
// a record that does not sit inside it.
startCheck("Stage envelope");

/**
 * Finds the registry entry governing a record, preferring the finest unit the
 * record populates, so a member's own range wins over its formation's.
 *
 * @param location - The species location block under inspection.
 * @returns The registry stage range and the unit it came from, or null.
 */
function unitStageRange(location: {
    group?: string;
    formation?: string;
    member?: string;
    bed?: string;
}): { unit: string; stages: Array<string> } | null
{
    const candidates = [location.bed, location.member, location.formation, location.group];

    for (const candidate of candidates)
    {
        if (typeof candidate !== "string")
        {
            continue;
        }

        const entry = formationRegistry[candidate];

        if (entry && Array.isArray(entry.stages) && entry.stages.length > 0)
        {
            return { unit: candidate, stages: entry.stages };
        }
    }

    return null;
}

/**
 * Width below which an exact match against the unit's range says nothing --
 * every record in a single-stage unit correctly equals that unit's range.
 */
const inheritedSpanThreshold = 3;

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        const recordStages = species?.period?.stage;

        if (!Array.isArray(recordStages) || recordStages.length === 0 || !species.location)
        {
            continue;
        }

        const range = unitStageRange(species.location);

        if (!range)
        {
            continue;
        }

        const allowed = new Set(range.stages);
        const outside = recordStages.filter((stageName: string) => !allowed.has(stageName));

        if (outside.length > 0)
        {
            checkWarning(
                "Stage envelope",
                filePath,
                `species '${species.name ?? "?"}': ${outside.join(", ")} lies outside the ` +
                `${range.unit} range (${range.stages.join(", ")}) in formations.yaml`);
        }
        else if (
            range.stages.length >= inheritedSpanThreshold
            && recordStages.length === range.stages.length)
        {
            // `resolution: unit` is the record saying this IS the unit's range,
            // because nothing finer has been published. That is an answer, not
            // an omission, so it settles the finding rather than hiding it.
            if (species.period?.resolution !== "unit")
            {
                checkWarning(
                    "Stage envelope",
                    filePath,
                    `species '${species.name ?? "?"}': stages are exactly the ${range.unit} ` +
                    `range (${range.stages.join(", ")}) — either narrow them from the ` +
                    "describing paper, or set period.resolution: unit to record that no " +
                    "finer age is published");
            }
        }
        else if (species.period?.resolution === "unit")
        {
            // Claiming unit resolution while carrying something other than the
            // unit's range is a contradiction: one of the two is wrong.
            checkError(
                "Stage envelope",
                filePath,
                `species '${species.name ?? "?"}': period.resolution is 'unit' but the ` +
                `stages are not the ${range.unit} range (${range.stages.join(", ")})`);
        }
    }
}

// 13b. Positional words must live in `part`, not inside a member or bed name
startCheck("Stratigraphic rank hygiene");

const positionalPrefix = /^(Upper|Lower|Middle|Uppermost|Lowermost|First|Second|Third)\b/;

// Member names that genuinely begin with a positional word, where it is part of
// the erected name rather than a division of it. The Aguja's members are named
// for lithology rather than geography -- Lower Shale, Upper Shale, McKinney
// Springs, Terlingua Creek Sandstone -- so "Upper" here is a name, not a place
// in the section. Moves to the formations registry when #2012 lands.
const positionalUnitNames = new Set([ "Upper Shale", "Lower Shale" ]);

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        const location = species?.location;

        for (const field of ["member", "bed"] as const)
        {
            const value = location?.[field];

            if (typeof value !== "string")
            {
                continue;
            }
            else if (positionalPrefix.test(value) && !positionalUnitNames.has(value))
            {
                checkWarning(
                    "Stratigraphic rank hygiene",
                    filePath,
                    `species '${species.name ?? "?"}': '${field}' is '${value}' — a positional word belongs in 'part' so that every occurrence in one unit shares a value`);
            }
            else if (/\b(Formation|Fm\.?|Group|Grp\.?|Member|Mbr\.?|Subgroup)\b/.test(value))
            {
                checkWarning(
                    "Stratigraphic rank hygiene",
                    filePath,
                    `species '${species.name ?? "?"}': '${field}' is '${value}' — the rank word is implied by the field and should be dropped`);
            }
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

// 14b. Region codes resolve, and agree with the country
startCheck("Region validation");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        const region = species?.location?.region;

        if (!region)
        {
            continue;
        }

        const label = `species '${species.name ?? "?"}'`;

        if (!allowedRegionCodes.has(region))
        {
            checkError(
                "Region validation",
                filePath,
                `${label}: region '${region}' is not a valid ISO 3166-2 code in regions.yaml`);
        }
        else if (species.location?.country && !region.startsWith(`${species.location.country}-`))
        {
            // A subdivision code whose prefix disagrees with the country is how
            // Perijasaurus came to sit in a Venezuelan state on a Colombian
            // record, so this is an error rather than a warning.
            checkError(
                "Region validation",
                filePath,
                `${label}: region '${region}' does not belong to country '${species.location.country}'`);
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

for (const [filePath, doc] of cladeParsed)
{
    if (doc && Array.isArray(doc.synonyms))
    {
        validateSynonyms(
            doc.synonyms as Array<Record<string, unknown>>,
            filePath,
            "clade");
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

            const typeSpecimenCompleteness = species?.type_specimen?.completeness;
            if (typeSpecimenCompleteness && !allowedCompleteness.has(typeSpecimenCompleteness))
            {
                checkError(
                    "Locomotion/completeness compliance",
                    filePath,
                    `species '${species.name ?? "?"}': invalid type_specimen.completeness '${typeSpecimenCompleteness}' (must be one of: ${[...allowedCompleteness].join(", ")})`);
            }
        }
    }
}

// 20. Holotype consistency
startCheck("Type specimen consistency");

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    for (const species of doc.species)
    {
        if (!species || !species.type_specimen)
        {
            continue;
        }

        const holotype = species.type_specimen;
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
                    "Type specimen consistency",
                    filePath,
                    `species '${speciesLabel}': type specimen present but missing 'specimen_id' (must be a non-empty array of catalogue numbers, or set 'status' to lost/destroyed/unknown)`);
            }
        }
        else
        {
            for (const [index, value] of holotype.specimen_id!.entries())
            {
                if (typeof value !== "string" || value.trim().length === 0)
                {
                    checkError(
                        "Type specimen consistency",
                        filePath,
                        `species '${speciesLabel}': specimen_id[${index}] must be a non-empty string`);
                }
            }
        }

        if (!holotype.institution && !hasValidStatus)
        {
            checkError(
                "Type specimen consistency",
                filePath,
                `species '${speciesLabel}': type specimen present but missing 'institution'`);
        }
        else if (holotype.institution && !allowedInstitutionKeys.has(holotype.institution))
        {
            checkError(
                "Type specimen consistency",
                filePath,
                `species '${speciesLabel}': institution '${holotype.institution}' is not a valid key in institutions.yaml`);
        }

        if (holotype.specimen_type === undefined)
        {
            if (!hasValidStatus)
            {
                checkError(
                    "Type specimen consistency",
                    filePath,
                    `species '${speciesLabel}': type specimen present but missing 'specimen_type' (must be one of: ${[...allowedSpecimenTypes].join(", ")})`);
            }
        }
        else if (!allowedSpecimenTypes.has(holotype.specimen_type))
        {
            checkError(
                "Type specimen consistency",
                filePath,
                `species '${speciesLabel}': invalid specimen_type '${holotype.specimen_type}' (must be one of: ${[...allowedSpecimenTypes].join(", ")})`);
        }
        else if (hasSpecimenIdArray)
        {
            const idCount = holotype.specimen_id!.length;

            // ICZN-strict definitions place a holotype, lectotype, or
            // neotype on a single specimen, but modern museum cataloguing
            // routinely assigns separate accession numbers to each
            // disarticulated element of one individual (e.g. the Nagatitan
            // partial skeleton catalogued as SM2025-1-546 through -556).
            // Trust the contributor: allow multiple specimen_ids for these
            // singular types, since the validator cannot distinguish "one
            // individual across multiple numbers" from "multiple specimens
            // mis-labelled as a single type" and the latter is a review
            // concern, not a schema one. Syntype, by definition, requires
            // ≥ 2 distinct specimens, so that constraint stays.
            // A syntype series normally IS several numbers, but a museum may
            // register a whole series under one -- Rhoetosaurus brownei's
            // syntypes and its referred material are all QM F1659. The single
            // id is allowed when the record says why, so the exemption cannot
            // be taken silently.
            const explained = typeof holotype.notes === "string" && holotype.notes.trim().length > 0;

            if (holotype.specimen_type === "syntype" && idCount < 2 && !explained)
            {
                checkError(
                    "Type specimen consistency",
                    filePath,
                    `species '${speciesLabel}': specimen_type 'syntype' requires at least 2 specimen_ids `
                    + `(got ${idCount}); a series registered under one number is allowed, but the record `
                    + "must explain it in 'notes'");
            }
        }

        if (holotype.status !== undefined && !allowedHolotypeStatus.has(holotype.status))
        {
            checkError(
                "Type specimen consistency",
                filePath,
                `species '${speciesLabel}': invalid type-specimen status '${holotype.status}' (must be one of: ${[...allowedHolotypeStatus].join(", ")})`);
        }

        if (holotype.former_ids !== undefined)
        {
            if (!Array.isArray(holotype.former_ids))
            {
                checkError(
                    "Type specimen consistency",
                    filePath,
                    `species '${speciesLabel}': former_ids must be an array`);
            }
            else
            {
                validateFormerIds(
                    holotype.former_ids,
                    hasSpecimenIdArray ? holotype.specimen_id! : [],
                    holotype.institution,
                    filePath,
                    `species '${speciesLabel}'`);
            }
        }
    }
}

/**
 * Validates one `former_ids` list: every entry well formed, institution keys
 * resolvable, and the end of the chain matching the identifier the record
 * actually holds.
 *
 * A specimen may move more than once, recorded as consecutive entries (A to B,
 * then B to C). The last hop is the one that has to agree with the block's own
 * `specimen_id` and `institution` — otherwise a record can document its history
 * and forget to update its number.
 *
 * @param formerIds - The former_ids array, already known to be an array.
 * @param specimenIds - The block's own catalogue numbers.
 * @param institution - The block's own institution key, if any.
 * @param filePath - Genus file being validated, for the error message.
 * @param label - Human label for the record, for the error message.
 * @returns Nothing; failures are reported through checkError.
 */
function validateFormerIds(
    formerIds: Array<Record<string, unknown>>,
    specimenIds: Array<string>,
    institution: string | undefined,
    filePath: string,
    label: string,
): void
{
    const held = new Set(specimenIds);
    const originIds = new Set<string>();

    for (const [index, entry] of formerIds.entries())
    {
        const position = `former_ids[${index}]`;

        if (!entry || typeof entry !== "object")
        {
            checkError("Type specimen consistency", filePath,
                `${label}: ${position} must be a mapping`);
            continue;
        }

        for (const field of ["from_id", "to_id"])
        {
            if (typeof entry[field] !== "string" || !(entry[field] as string).trim())
            {
                checkError("Type specimen consistency", filePath,
                    `${label}: ${position}.${field} must be a non-empty string`);
            }
        }

        const reason = entry.reason;

        if (typeof reason !== "string" || !allowedFormerIdReasons.has(reason))
        {
            checkError("Type specimen consistency", filePath,
                `${label}: ${position}.reason '${String(reason)}' must be one of: `
                + `${[...allowedFormerIdReasons].join(", ")}`);
        }

        const institutionFields = ["from_institution", "to_institution"] as const;

        for (const field of institutionFields)
        {
            const value = entry[field];

            if (value === undefined)
            {
                if (reason === "rehoused")
                {
                    checkError("Type specimen consistency", filePath,
                        `${label}: ${position}.${field} is required when reason is 'rehoused'`);
                }
            }
            else if (typeof value !== "string" || !allowedInstitutionKeys.has(value))
            {
                checkError("Type specimen consistency", filePath,
                    `${label}: ${position}.${field} '${String(value)}' is not a valid key in institutions.yaml`);
            }
            else if (reason !== "rehoused")
            {
                checkError("Type specimen consistency", filePath,
                    `${label}: ${position}.${field} is only meaningful when reason is 'rehoused'`);
            }
        }

        if (typeof entry.from_id === "string")
        {
            originIds.add(entry.from_id);
        }
    }

    // The end of every chain is a to_id that no other entry supersedes; each
    // one has to be a number this record actually holds.
    for (const [index, entry] of formerIds.entries())
    {
        const target = entry?.to_id;

        if (typeof target !== "string" || originIds.has(target))
        {
            continue;
        }

        if (!held.has(target))
        {
            checkError("Type specimen consistency", filePath,
                `${label}: former_ids[${index}].to_id '${target}' ends the chain but is not in specimen_id`);
        }
        else if (entry.reason === "rehoused"
            && institution !== undefined
            && entry.to_institution !== undefined
            && entry.to_institution !== institution)
        {
            checkError("Type specimen consistency", filePath,
                `${label}: former_ids[${index}].to_institution '${String(entry.to_institution)}' `
                + `ends the chain but does not match institution '${institution}'`);
        }
    }
}

// 20b. Notable specimens
startCheck("Notable specimens");

const notableSpecimenLimit = 6;
const significanceLimit = 300;

for (const [filePath, doc] of genusParsed)
{
    if (!doc || !Array.isArray(doc.notable_specimens))
    {
        continue;
    }

    const speciesNames = new Set(
        (doc.species ?? [])
            .map((species) => species.name)
            .filter((name): name is string => typeof name === "string"));
    const referenceIds = new Set(
        (doc.references ?? [])
            .map((reference) => reference.id)
            .filter((id): id is string => typeof id === "string"));

    if (doc.notable_specimens.length > notableSpecimenLimit)
    {
        checkWarning(
            "Notable specimens",
            filePath,
            `${doc.notable_specimens.length} notable_specimens listed (> ${notableSpecimenLimit}); this is a curated highlights list, not a full referred-material record`);
    }

    for (const [index, specimen] of doc.notable_specimens.entries())
    {
        if (!specimen || typeof specimen !== "object")
        {
            checkError("Notable specimens", filePath, `notable_specimens[${index}] must be an object`);
            continue;
        }

        const hasSpecimenId = Array.isArray(specimen.specimen_id) && specimen.specimen_id.length > 0;
        const label = specimen.nickname ?? (hasSpecimenId ? specimen.specimen_id![0] : `#${index}`);

        // Identity: a nickname or at least one specimen_id.
        if (!specimen.nickname && !hasSpecimenId)
        {
            checkError(
                "Notable specimens",
                filePath,
                `notable_specimens[${index}]: needs a 'nickname' or 'specimen_id'`);
        }

        if (hasSpecimenId)
        {
            for (const [idIndex, value] of specimen.specimen_id!.entries())
            {
                if (typeof value !== "string" || value.trim().length === 0)
                {
                    checkError(
                        "Notable specimens",
                        filePath,
                        `notable_specimens '${label}': specimen_id[${idIndex}] must be a non-empty string`);
                }
            }
        }

        // status reuses the holotype_status vocabulary.
        const hasValidStatus = typeof specimen.status === "string" && allowedHolotypeStatus.has(specimen.status);

        if (specimen.status !== undefined && !allowedHolotypeStatus.has(specimen.status))
        {
            checkError(
                "Notable specimens",
                filePath,
                `notable_specimens '${label}': invalid status '${specimen.status}' (must be one of: ${[...allowedHolotypeStatus].join(", ")})`);
        }

        // A catalogued specimen needs a home unless it is lost/destroyed/uncatalogued.
        if (hasSpecimenId && !specimen.institution && !hasValidStatus)
        {
            checkError(
                "Notable specimens",
                filePath,
                `notable_specimens '${label}': has specimen_id but no 'institution' (set institution, or 'status' for lost/destroyed/uncatalogued)`);
        }

        if (specimen.institution && !allowedInstitutionKeys.has(specimen.institution))
        {
            checkError(
                "Notable specimens",
                filePath,
                `notable_specimens '${label}': institution '${specimen.institution}' is not a valid key in institutions.yaml`);
        }

        if (specimen.category !== undefined && !allowedSpecimenCategories.has(specimen.category))
        {
            checkError(
                "Notable specimens",
                filePath,
                `notable_specimens '${label}': invalid category '${specimen.category}' (must be one of: ${[...allowedSpecimenCategories].join(", ")})`);
        }

        if (specimen.species && !speciesNames.has(specimen.species))
        {
            checkError(
                "Notable specimens",
                filePath,
                `notable_specimens '${label}': species '${specimen.species}' does not match any species name in this genus`);
        }

        if (specimen.references !== undefined)
        {
            if (!Array.isArray(specimen.references))
            {
                checkError(
                    "Notable specimens",
                    filePath,
                    `notable_specimens '${label}': references must be a list of reference ids`);
            }
            else
            {
                for (const referenceId of specimen.references)
                {
                    if (!referenceIds.has(referenceId))
                    {
                        checkError(
                            "Notable specimens",
                            filePath,
                            `notable_specimens '${label}': reference '${referenceId}' does not match any reference id`);
                    }
                }
            }
        }

        if (typeof specimen.significance !== "string" || specimen.significance.trim().length === 0)
        {
            checkError(
                "Notable specimens",
                filePath,
                `notable_specimens '${label}': missing required 'significance'`);
        }
        else
        {
            if (specimen.significance.length > significanceLimit)
            {
                checkWarning(
                    "Notable specimens",
                    filePath,
                    `notable_specimens '${label}': significance is ${specimen.significance.length} chars (> ${significanceLimit}); tighten it`);
            }
        }

        if (specimen.discovered !== undefined)
        {
            const discovered = specimen.discovered;

            if (typeof discovered !== "object" || discovered === null)
            {
                checkError(
                    "Notable specimens",
                    filePath,
                    `notable_specimens '${label}': discovered must be an object with optional 'year' and 'by'`);
            }
            else
            {
                if (discovered.year !== undefined && typeof discovered.year !== "number")
                {
                    checkError(
                        "Notable specimens",
                        filePath,
                        `notable_specimens '${label}': discovered.year must be a number`);
                }

                if (discovered.by !== undefined && (typeof discovered.by !== "string" || discovered.by.trim().length === 0))
                {
                    checkError(
                        "Notable specimens",
                        filePath,
                        `notable_specimens '${label}': discovered.by must be a non-empty string`);
                }
            }
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

    if (Array.isArray(appearance.features))
    {
        for (const feature of appearance.features)
        {
            if (!allowedFeatures.has(feature))
            {
                checkError(
                    "Appearance compliance",
                    filePath,
                    `invalid appearance feature '${feature}' (not in schema appearance_features)`);
            }
        }
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
    else if (doc.paleoenvironment !== undefined)
    {
        checkError(
            "Paleoenvironment compliance",
            filePath,
            "paleoenvironment must be a list of values");
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

// Prose-field traversal, shared by checks 24, 25 and 26.
//
// One walk reaches every editorial prose field in the dataset, so a prose
// field added to a record — or a registry that gains a `notes:` — is picked
// up by all three prose checks at once. The alternative, a hand-written list
// of field paths per check, is what left `type_specimen.notes`,
// `former_ids[].notes`, `iczn_rulings[].notes` and the whole formations
// registry unchecked, and let the two lists drift apart from each other.
//
// Prose is identified by the name of the key holding the string, not by its
// path: `notes` is prose wherever it appears, `specimen_id` never is. Array
// elements inherit the key of the array they sit in
// (`diagnostic_features[3]`). Keys absent from this set hold identifiers,
// catalogue numbers, enum values, taxon names and place names — none of them
// ours to restyle.
const proseKeys = new Set([
    "description",
    "diagnostic_features",
    "etymology",
    "material",
    "note",
    "notes",
    "reason",
    "significance",
    "summary",
]);

type ProseField = {
    filePath: string;
    fieldPath: string;
    text: string;
};

/**
 * Recursively collects every prose field under one parsed YAML value.
 *
 * @param node - The value to inspect (object, array, or scalar).
 * @param filePath - Absolute path of the file `node` was parsed from.
 * @param fieldPath - Dotted path describing `node`'s location in that file.
 * @param key - Name of the key holding `node`, or null at the document root.
 * @param collected - Accumulator the matching fields are appended to.
 */
function collectProseFields(node: unknown, filePath: string, fieldPath: string, key: string | null, collected: Array<ProseField>): void
{
    if (Array.isArray(node))
    {
        for (let index = 0; index < node.length; index += 1)
        {
            collectProseFields(node[index], filePath, `${fieldPath}[${index}]`, key, collected);
        }
    }
    else if (node && typeof node === "object")
    {
        for (const [childKey, value] of Object.entries(node as Record<string, unknown>))
        {
            collectProseFields(value, filePath, fieldPath ? `${fieldPath}.${childKey}` : childKey, childKey, collected);
        }
    }
    else if (typeof node === "string" && key !== null && proseKeys.has(key))
    {
        collected.push({ filePath, fieldPath, text: node });
    }
}

const proseFields: Array<ProseField> = [];

for (const [filePath, doc] of allParsed)
{
    collectProseFields(doc, filePath, "", null, proseFields);
}

for (const [filePath, entry] of referenceStoreParsed)
{
    collectProseFields(entry, filePath, "", null, proseFields);
}

// The registries are keyed by unit name, institution code and region code,
// so each top-level entry is walked under its own key rather than from the
// document root. `regions.yaml` maps a code straight to a string and has no
// prose today; walking it anyway means a `notes:` added there needs no
// change here.
const registrySources: Array<[string, Record<string, unknown>]> = [
    [path.join(root, "formations.yaml"), formationRegistry as Record<string, unknown>],
    [path.join(root, "institutions.yaml"), institutionRegistry],
    [path.join(root, "regions.yaml"), regionRegistry as unknown as Record<string, unknown>],
];

for (const [filePath, registry] of registrySources)
{
    for (const [entryKey, entry] of Object.entries(registry ?? {}))
    {
        collectProseFields(entry, filePath, entryKey, null, proseFields);
    }
}

/**
 * Removes double-quoted spans from a prose field. Text quoted verbatim from
 * a source is not ours to restyle — its spelling and its citation form are
 * the source's — so the American English and Citation format checks run on
 * what is left. Each span becomes a space so the words on either side cannot
 * join into a match that is in neither of them. An unpaired quote is left
 * alone, since there is no span to bound.
 *
 * @param text - The field's string value.
 * @returns The text with every quoted span replaced by a space.
 */
function stripQuotedSpans(text: string): string
{
    return text.replace(/"[^"]*"/g, " ");
}

// 24. American English
//
// Surfaces British-English spellings in editorial prose fields so they
// can be converted to American English (project policy). Skipped:
// reference titles/journals/publishers/authors (proper-noun metadata
// preserved verbatim), species/synonym names (taxon authority), and
// quoted spans (a quotation is reproduced as its source spelled it).
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
    /Nanjing Institute of Geology and Palaeontology/g,
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
    let scrubbed = stripQuotedSpans(text);

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

for (const field of proseFields)
{
    checkAmericanEnglish(field.filePath, field.fieldPath, field.text);
}

// 25. Citation format (paleo-journal hybrid: "Smith (1999)" / "(Smith, 1999)" / "and" not "&")
//
// Catches the three most common deviations from project policy:
//   - "Author & Author" between capitalized names (use "and")
//   - "(Author Year)" no-comma single-citation parenthetical (use "(Author, Year)")
//   - bare "Author Year" outside parentheses
// Runs over the shared prose walk, minus quoted spans: the citation form
// inside a verbatim quotation is the source's, not ours.
startCheck("Citation format");

const ampersandPattern = /\b[A-Z][a-z]+\s*&\s*[A-Z][\p{L}]+/gu;
const noCommaCitationPattern = /\(([A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s+(?:and\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?|et al\.))?\s+\d{4}[a-z]?)\)/g;
const bareYearPattern = /\b([A-Z][a-z]+(?:\s+(?:and|et al\.)\s+[A-Z][a-z]+)?) ([12]\d{3}[a-z]?)\b(?![)\d,;])/g;

/**
 * Capitalized words that frequently precede a four-digit number
 * without being an author surname. Skipping them keeps the year-shaped
 * checks usefully signal-heavy: an ICZN Opinion number reads exactly
 * like an unpunctuated parenthetical citation, "(Opinion 2320)".
 */
const yearHeadDenylist = new Set([
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
    "The", "In", "On", "By", "From", "Since", "After", "Before", "Until",
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
    const scrubbed = stripQuotedSpans(text);
    const ampersandMatches = scrubbed.match(ampersandPattern);

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

    const reportedNoComma = new Set<string>();

    for (const match of scrubbed.matchAll(noCommaCitationPattern))
    {
        const head = match[1].split(/\s+/)[0];

        if (yearHeadDenylist.has(head))
        {
            continue;
        }

        const full = match[0];

        if (reportedNoComma.has(full))
        {
            continue;
        }

        reportedNoComma.add(full);
        checkWarning(
            "Citation format",
            filePath,
            `${fieldPath}: "${full}" — single-citation parenthetical needs a comma before the year (project policy)`);
    }

    const reportedBare = new Set<string>();

    for (const match of scrubbed.matchAll(bareYearPattern))
    {
        const head = match[1].split(/\s+/)[0];

        if (yearHeadDenylist.has(head))
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

for (const field of proseFields)
{
    checkCitationFormat(field.filePath, field.fieldPath, field.text);
}

// 26. Reference key in prose
//
// Reference keys are pointers. They belong in `id`, `erected_in`,
// `described_in`, `notable_specimens[].references`, `iczn_rulings.petition`,
// `iczn_rulings.ruling` and `former_ids[].source` — never in a sentence,
// where the citation reads "Zhang (2018)" or "(Zhang, 2018)". Scoped to the
// prose walk, so the ~2,150 keys sitting in pointer fields are never seen.
//
// Quoted spans are NOT exempt here, unlike the two style checks above: a
// verbatim quotation of a source cannot contain one of our keys, so a key
// inside quotes is a leak like any other.
startCheck("Reference key in prose");

// Surname, year, disambiguating letter — the same shape check 12c enforces
// on the store, tightened for use mid-sentence. Lowercase Unicode letters
// rather than a-z, so surnames carrying Latin Extended-A diacritics are
// caught (ősi2010a, maryańska1975a, niedźwiedzki2012a), and a two-letter
// surname is allowed (an2015a, hu2018a). The boundaries are spelled out
// rather than left to \b, which is ASCII-only even under the u flag and so
// would report ősi2010a as "si2010a".
const proseReferenceKeyPattern = /(?<![\p{L}\p{N}])\p{Ll}[\p{Ll}\p{M}.'’-]+\d{4}[a-z](?![\p{L}\p{N}])/gu;

for (const field of proseFields)
{
    const reported = new Set<string>();

    for (const match of field.text.match(proseReferenceKeyPattern) ?? [])
    {
        if (reported.has(match))
        {
            continue;
        }

        reported.add(match);
        checkError(
            "Reference key in prose",
            field.filePath,
            `${field.fieldPath}: "${match}" — reference keys are pointers, not prose; write the citation narratively ("Zhang (2018)") or parenthetically ("(Zhang, 2018)") (project policy)`);
    }
}

// 27. Output schema sync — the shipped JSON Schema (schemas/open-paleo.schema.json)
// inlines the controlled-vocabulary enums for consumers, so they must stay in
// step with schema.yml (the authoritative source). Drift here means the
// published contract disagrees with what this validator enforces.
startCheck("Output schema sync");

const outputSchemaPath = path.join(root, "schemas", "open-paleo.schema.json");
let outputSchema: { $defs?: Record<string, { enum?: Array<string> }> } | null = null;

try
{
    outputSchema = JSON.parse(fs.readFileSync(outputSchemaPath, "utf8"));
}
catch (error: unknown)
{
    const message = error instanceof Error ? error.message : String(error);
    checkError("Output schema sync", outputSchemaPath, `cannot read JSON Schema: ${message}`);
}

if (outputSchema)
{
    const outputSchemaDefs = outputSchema.$defs ?? {};

    /**
     * Compares one JSON-Schema enum against the authoritative schema.yml list,
     * order-independent, and reports any divergence.
     *
     * @param defName - The $defs key holding the enum in the JSON Schema.
     * @param allowedValues - The authoritative values from schema.yml.
     */
    const checkEnumSync = (defName: string, allowedValues: Array<string>): void =>
    {
        const schemaEnum = outputSchemaDefs[defName]?.enum;

        if (!Array.isArray(schemaEnum))
        {
            checkError("Output schema sync", outputSchemaPath, `$defs.${defName}.enum is missing`);
            return;
        }

        const expected = [...allowedValues].sort();
        const actual = [...schemaEnum].sort();
        const missing = expected.filter((value) => !actual.includes(value));
        const extra = actual.filter((value) => !expected.includes(value));

        if (missing.length > 0 || extra.length > 0)
        {
            checkError(
                "Output schema sync",
                outputSchemaPath,
                `$defs.${defName}.enum out of sync with schema.yml (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
        }
    };

    const schemaVocabularies = schema as unknown as Record<string, Array<string>>;

    const enumDefNames: Array<string> = [
        "status", "placement", "synonym_types", "diet", "locomotion", "completeness",
        "holotype_status", "specimen_types", "former_id_reasons",
        "specimen_categories",
        "iczn_ruling_types", "integument", "integument_evidence",
        "paleoenvironments", "identifier_sources", "periods",
    ];

    for (const defName of enumDefNames)
    {
        checkEnumSync(defName, schemaVocabularies[defName] ?? []);
    }

    checkEnumSync("appearance_features", [...allowedFeatures]);
    checkEnumSync("stages", Object.keys(stages));
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
