// Checks on genus and clade records: structure, vocabularies, species, locations, specimens and the output schema.

import * as fs from "node:fs";
import * as path from "node:path";

import type {
    GenusData,
    Size,
    Species,
    StageInfo,
} from "../types.ts";
import { checkError, checkWarning } from "./report.ts";
import type { ValidationContext } from "./context.ts";

/**
 * The "YAML syntax" check.
 *
 * YAML syntax
 *
 * @param context - The loaded data the checks read.
 */
export function checkYamlSyntax(context: ValidationContext): void
{
    for (const [filePath, message] of context.yamlSyntaxProblems)
    {
        checkError("YAML syntax", filePath, message);
    }
}

// Also verify schema.yml and tree.yml parse (already loaded, but record success)
// They were loaded above with fatal exit, so if we're here they parsed fine.

/**
 * The "Schema compliance" check.
 *
 * Schema compliance (status, diet)
 *
 * @param context - The loaded data the checks read.
 */
export function checkSchemaCompliance(context: ValidationContext): void
{
    const {
        allowedDiet,
        allowedPlacement,
        allowedStatus,
        genusParsed,
    } = context;

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
}

/**
 * The "Tree consistency" check.
 *
 * Tree consistency — genus parent exists in tree
 *
 * @param context - The loaded data the checks read.
 */
export function checkTreeConsistency(context: ValidationContext): void
{
    const {
        genusParsed,
        treeClades,
    } = context;

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
}

/**
 * The "Clade coverage" check.
 *
 * Clade coverage — every tree clade has a file (except scaffolding)
 *
 * @param context - The loaded data the checks read.
 */
export function checkCladeCoverage(context: ValidationContext): void
{
    const {
        cladeFiles,
        scaffoldingClades,
        treeClades,
    } = context;

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
}

/**
 * The "No orphan clades" check.
 *
 * No orphans — no clade files for clades not in tree
 *
 * @param context - The loaded data the checks read.
 */
export function checkNoOrphanClades(context: ValidationContext): void
{
    const {
        cladeFiles,
        treeClades,
    } = context;

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
}

/**
 * The "Clade population" check.
 *
 * Clade population — every non-scaffolding clade must have a member genus
 *     somewhere in its subtree (P4: no empty clades). See issue #1953.
 *
 * @param context - The loaded data the checks read.
 */
export function checkCladePopulation(context: ValidationContext): void
{
    const {
        collectPopulatedClades,
        genusParsed,
        scaffoldingClades,
        tree,
        treeClades,
    } = context;

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
}

/**
 * The "Naming conventions" check.
 *
 * Naming conventions
 *
 * @param context - The loaded data the checks read.
 */
export function checkNamingConventions(context: ValidationContext): void
{
    const {
        genusParsed,
    } = context;

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
}

/**
 * The "Required fields" check.
 *
 * Required fields
 *
 * @param context - The loaded data the checks read.
 */
export function checkRequiredFields(context: ValidationContext): void
{
    const {
        genusParsed,
    } = context;

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
            for (const [index, species] of doc.species.entries())
            {
                if (!species)
                {
                    checkError("Required fields", filePath, `species[${index}] is an empty list item`);
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
}

/**
 * The "Type species" check.
 *
 * Type species — exactly one per genus
 *
 * @param context - The loaded data the checks read.
 */
export function checkTypeSpecies(context: ValidationContext): void
{
    const {
        genusParsed,
    } = context;

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
}

/**
 * The "Stage-period agreement" check.
 *
 * Stage-period agreement
 *
 * @param context - The loaded data the checks read.
 */
export function checkStagePeriodAgreement(context: ValidationContext): void
{
    const {
        allowedPeriods,
        genusParsed,
        outsideUnitResolutions,
        stages,
    } = context;

    // The values `period.resolution` takes. `reworked` and `horizon` let a record's
    // stages leave its unit's, so each must be explained in the location notes.
    const periodResolutions = new Set([ "unit", "reworked", "horizon" ]);

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

            if (period.name !== undefined && !Array.isArray(period.name))
            {
                checkError(
                    "Stage-period agreement",
                    filePath,
                    `species '${speciesLabel}': period.name must be a list, as in 'name: [Late Cretaceous]'`);
            }

            if (period.stage !== undefined && !Array.isArray(period.stage))
            {
                checkError(
                    "Stage-period agreement",
                    filePath,
                    `species '${speciesLabel}': period.stage must be a list, as in 'stage: [Campanian]'`);
            }

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

            if (period.resolution === undefined)
            {
                continue;
            }
            else if (!periodResolutions.has(period.resolution))
            {
                checkError(
                    "Stage-period agreement",
                    filePath,
                    `species '${speciesLabel}': unknown resolution '${period.resolution}' — use ${[ ...periodResolutions ].map((value) => `'${value}'`).join(", ")}`);
            }
            else if (outsideUnitResolutions.has(period.resolution) && !species.location?.notes?.trim())
            {
                checkError(
                    "Stage-period agreement",
                    filePath,
                    `species '${speciesLabel}': resolution '${period.resolution}' needs location notes saying why the stages leave the unit`);
            }
        }
    }
}

/**
 * The "ICZN case compliance" check.
 *
 * ICZN case compliance — each case needs a known type and status; a case
 * the Commission ruled on cites its Opinion, and any other case carries a case
 * number, a petition or a notice so the entry points somewhere
 *
 * @param context - The loaded data the checks read.
 */
export function checkIcznCaseCompliance(context: ValidationContext): void
{
    const {
        allowedIcznCaseStatuses,
        allowedIcznCaseTypes,
        genusParsed,
    } = context;

    for (const [filePath, doc] of genusParsed)
    {
        if (doc && "iczn_rulings" in doc)
        {
            checkError(
                "ICZN case compliance",
                filePath,
                "legacy 'iczn_rulings' field present (renamed 'iczn_cases')");
        }

        if (!doc || !Array.isArray(doc.iczn_cases))
        {
            continue;
        }

        for (const icznCase of doc.iczn_cases)
        {
            if (!icznCase)
            {
                continue;
            }

            if (!icznCase.type)
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    "iczn_cases: entry missing required 'type'");
            }
            else if (!allowedIcznCaseTypes.has(icznCase.type))
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    `iczn_cases: invalid type '${icznCase.type}' (must be one of: ${[...allowedIcznCaseTypes].join(", ")})`);
            }

            if (icznCase.notices !== undefined && !Array.isArray(icznCase.notices))
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    "iczn_cases: 'notices' must be a list of reference ids");
            }

            if (icznCase.case !== undefined && (typeof icznCase.case !== "string" || !/^\d+$/.test(icznCase.case)))
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    `iczn_cases: case '${icznCase.case}' is not a case number (digits only, quoted as a string)`);
            }

            if (!icznCase.status)
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    "iczn_cases: entry missing required 'status'");
            }
            else if (!allowedIcznCaseStatuses.has(icznCase.status))
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    `iczn_cases: invalid status '${icznCase.status}' (must be one of: ${[...allowedIcznCaseStatuses].join(", ")})`);
            }
            else if (icznCase.status === "opinion" && !icznCase.ruling)
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    `iczn_cases: entry of type '${icznCase.type ?? "?"}' with status 'opinion' missing required 'ruling' (the Opinion reference)`);
            }
            else if (icznCase.status !== "opinion" && icznCase.ruling)
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    `iczn_cases: entry with status '${icznCase.status}' has a 'ruling'; only a case closed by an Opinion cites one`);
            }
            else if (icznCase.status !== "opinion" && !icznCase.case && !icznCase.petition && !icznCase.notices?.length)
            {
                checkError(
                    "ICZN case compliance",
                    filePath,
                    `iczn_cases: entry with status '${icznCase.status}' needs a 'case' number, a 'petition' or a 'notices' reference`);
            }
        }
    }
}

/**
 * The "Species authority" check.
 *
 * Species authority — every species needs erected_in; the denormalized
 * authors/described fields were removed in the #1886 migration
 *
 * @param context - The loaded data the checks read.
 */
export function checkSpeciesAuthority(context: ValidationContext): void
{
    const {
        genusParsed,
    } = context;

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
}

/**
 * The "Country validation" check.
 *
 * Country typo detection (warning)
 *
 * @param context - The loaded data the checks read.
 */
export function checkCountryValidation(context: ValidationContext): void
{
    const {
        allowedCountries,
        genusParsed,
    } = context;

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
}

/**
 * The "Region validation" check.
 *
 * Region codes resolve, and agree with the country
 *
 * @param context - The loaded data the checks read.
 */
export function checkRegionValidation(context: ValidationContext): void
{
    const {
        allowedRegionCodes,
        genusParsed,
    } = context;

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
}

/**
 * The "Coordinate validity" check.
 *
 * Coordinate validity
 *
 * @param context - The loaded data the checks read.
 */
export function checkCoordinateValidity(context: ValidationContext): void
{
    const {
        genusParsed,
    } = context;

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
}

/**
 * The "Period consistency" check.
 *
 * Period consistency — stage belongs to period; Ma range within stage
 *
 * @param context - The loaded data the checks read.
 */
export function checkPeriodConsistency(context: ValidationContext): void
{
    const {
        genusParsed,
        stages,
    } = context;

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
}

/**
 * The "Synonym integrity" check.
 *
 * Synonym integrity
 *
 * @param context - The loaded data the checks read.
 */
export function checkSynonymIntegrity(context: ValidationContext): void
{
    const {
        allowedSynonymTypes,
        cladeParsed,
        genusParsed,
    } = context;

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
}

/**
 * The "Size validity" check.
 *
 * Size validity
 *
 * @param context - The loaded data the checks read.
 */
export function checkSizeValidity(context: ValidationContext): void
{
    const {
        genusParsed,
    } = context;

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
}

/**
 * The "Locomotion/completeness compliance" check.
 *
 * Locomotion / completeness compliance
 *
 * @param context - The loaded data the checks read.
 */
export function checkLocomotionCompletenessCompliance(context: ValidationContext): void
{
    const {
        allowedCompleteness,
        allowedLocomotion,
        genusParsed,
    } = context;

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
}

/**
 * The "Type specimen consistency" check.
 *
 * Holotype consistency
 *
 * @param context - The loaded data the checks read.
 */
export function checkTypeSpecimenConsistency(context: ValidationContext): void
{
    const {
        allowedFormerIdReasons,
        allowedHolotypeStatus,
        allowedInstitutionKeys,
        allowedSpecimenTypes,
        genusParsed,
    } = context;

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
}

/**
 * The "Notable specimens" check.
 *
 * Notable specimens
 *
 * @param context - The loaded data the checks read.
 */
export function checkNotableSpecimens(context: ValidationContext): void
{
    const {
        allowedHolotypeStatus,
        allowedInstitutionKeys,
        allowedSpecimenCategories,
        genusParsed,
    } = context;

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
                .map((species) => species?.name)
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
}

/**
 * The "Appearance compliance" check.
 *
 * Appearance compliance
 *
 * @param context - The loaded data the checks read.
 */
export function checkAppearanceCompliance(context: ValidationContext): void
{
    const {
        allowedFeatures,
        allowedIntegument,
        allowedIntegumentEvidence,
        genusParsed,
    } = context;

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
}

/**
 * The "Paleoenvironment compliance" check.
 *
 * Paleoenvironment compliance
 *
 * @param context - The loaded data the checks read.
 */
export function checkPaleoenvironmentCompliance(context: ValidationContext): void
{
    const {
        allowedPaleoenvironments,
        genusParsed,
    } = context;

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
}

/**
 * The "Output schema sync" check.
 *
 * Output schema sync — the shipped JSON Schema (schemas/open-paleo.schema.json)
 * inlines the controlled-vocabulary enums for consumers, so they must stay in
 * step with schema.yml (the authoritative source). Drift here means the
 * published contract disagrees with what this validator enforces.
 *
 * @param context - The loaded data the checks read.
 */
export function checkOutputSchemaSync(context: ValidationContext): void
{
    const {
        allowedFeatures,
        root,
        schema,
        stages,
    } = context;

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
            "holotype_status", "specimen_types", "former_id_reasons", "thesis_types",
            "specimen_categories",
            "iczn_case_types", "iczn_case_statuses", "integument", "integument_evidence",
            "paleoenvironments", "identifier_sources", "periods",
        ];

        for (const defName of enumDefNames)
        {
            checkEnumSync(defName, schemaVocabularies[defName] ?? []);
        }

        checkEnumSync("appearance_features", [...allowedFeatures]);
        checkEnumSync("stages", Object.keys(stages));
    }
}
