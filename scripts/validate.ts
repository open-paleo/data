#!/usr/bin/env npx tsx

// Open Paleo — Data Validation Script
// Validates YAML data files against the schema and tree structure.
//
// The loaded data lives in validate/context.ts, the result collection and
// summary in validate/report.ts, and the checks in one module per family
// under validate/. This file runs the checks in order.

import { loadValidationContext } from "./validate/context.ts";
import type { ValidationContext } from "./validate/context.ts";
import {
    checkAmericanEnglish,
    checkCitationFormat,
    checkCommentEatenScalars,
    checkCurlyQuotes,
    checkIdentifierCompliance,
    checkReferenceKeyInProse,
    checkUnbalancedQuotation,
} from "./validate/prose.ts";
import {
    checkAppearanceCompliance,
    checkCladeCoverage,
    checkCladePopulation,
    checkCoordinateValidity,
    checkCountryValidation,
    checkIcznCaseCompliance,
    checkLocomotionCompletenessCompliance,
    checkNamingConventions,
    checkNoOrphanClades,
    checkNotableSpecimens,
    checkOutputSchemaSync,
    checkPaleoenvironmentCompliance,
    checkPeriodConsistency,
    checkRegionValidation,
    checkRequiredFields,
    checkSchemaCompliance,
    checkSizeValidity,
    checkSpeciesAuthority,
    checkStagePeriodAgreement,
    checkSynonymIntegrity,
    checkTreeConsistency,
    checkTypeSpecies,
    checkTypeSpecimenConsistency,
    checkYamlSyntax,
} from "./validate/records.ts";
import {
    checkChapterWithoutAJournal,
    checkCladeReferenceIntegrity,
    checkDisputeStructure,
    checkDuplicateReferences,
    checkFlaggedPublicationSources,
    checkRedundantDoiPointerUrl,
    checkReferenceIntegrity,
    checkReferenceKeyDisambiguation,
    checkReferenceKeyYear,
    checkReferenceNotesLength,
    checkReferenceStoreFiles,
    checkReferenceStoreIntegrity,
    checkRegistryReferenceIntegrity,
    checkSelfContainedReferences,
    checkUncitedNarrativeCitations,
    checkUncitedStoreEntries,
    checkUniqueReferenceIds,
} from "./validate/references.ts";
import {
    checkResearchNotes,
} from "./validate/research.ts";
import {
    checkCatalogNumberShape,
    checkSpecimenNumberCollisions,
} from "./validate/specimens.ts";
import {
    checkFormationRank,
    checkLocationCompleteness,
    checkRecordPeriods,
    checkRecordStages,
    checkRegistryContainment,
    checkRegistryFileLayout,
    checkStratigraphicRankHygiene,
    checkStratigraphicUnitAges,
} from "./validate/stratigraphy.ts";
import { checkError, errors, printReport, startCheck } from "./validate/report.ts";

const context = loadValidationContext();

// Every check, in the order the summary lists them. A check that throws is
// reported as an error against itself and the rest still run.
const checks: Array<[string, (context: ValidationContext) => void]> = [
    ["YAML syntax", checkYamlSyntax],
    ["Schema compliance", checkSchemaCompliance],
    ["Tree consistency", checkTreeConsistency],
    ["Clade coverage", checkCladeCoverage],
    ["No orphan clades", checkNoOrphanClades],
    ["Clade population", checkCladePopulation],
    ["Naming conventions", checkNamingConventions],
    ["Required fields", checkRequiredFields],
    ["Type species", checkTypeSpecies],
    ["Stage-period agreement", checkStagePeriodAgreement],
    ["Reference integrity", checkReferenceIntegrity],
    ["Clade reference integrity", checkCladeReferenceIntegrity],
    ["Registry reference integrity", checkRegistryReferenceIntegrity],
    ["Registry containment", checkRegistryContainment],
    ["Registry file layout", checkRegistryFileLayout],
    ["ICZN case compliance", checkIcznCaseCompliance],
    ["Species authority", checkSpeciesAuthority],
    ["Self-contained references", checkSelfContainedReferences],
    ["Reference store integrity", checkReferenceStoreIntegrity],
    ["Reference store files", checkReferenceStoreFiles],
    ["Uncited store entries", checkUncitedStoreEntries],
    ["Redundant DOI-pointer URL", checkRedundantDoiPointerUrl],
    ["Unique reference IDs", checkUniqueReferenceIds],
    ["Reference key disambiguation", checkReferenceKeyDisambiguation],
    ["Reference key year", checkReferenceKeyYear],
    ["Chapter without a journal", checkChapterWithoutAJournal],
    ["Duplicate references", checkDuplicateReferences],
    ["Flagged publication sources", checkFlaggedPublicationSources],
    ["Reference notes length", checkReferenceNotesLength],
    ["Dispute structure", checkDisputeStructure],
    ["Location completeness", checkLocationCompleteness],
    ["Formation rank", checkFormationRank],
    ["Stratigraphic rank hygiene", checkStratigraphicRankHygiene],
    ["Stratigraphic unit ages", checkStratigraphicUnitAges],
    ["Record stages", checkRecordStages],
    ["Record periods", checkRecordPeriods],
    ["Country validation", checkCountryValidation],
    ["Region validation", checkRegionValidation],
    ["Coordinate validity", checkCoordinateValidity],
    ["Period consistency", checkPeriodConsistency],
    ["Synonym integrity", checkSynonymIntegrity],
    ["Size validity", checkSizeValidity],
    ["Locomotion/completeness compliance", checkLocomotionCompletenessCompliance],
    ["Type specimen consistency", checkTypeSpecimenConsistency],
    ["Notable specimens", checkNotableSpecimens],
    ["Appearance compliance", checkAppearanceCompliance],
    ["Paleoenvironment compliance", checkPaleoenvironmentCompliance],
    ["Identifier compliance", checkIdentifierCompliance],
    ["American English", checkAmericanEnglish],
    ["Citation format", checkCitationFormat],
    ["Reference key in prose", checkReferenceKeyInProse],
    ["Output schema sync", checkOutputSchemaSync],
    ["Specimen number collisions", checkSpecimenNumberCollisions],
    ["Catalog number shape", checkCatalogNumberShape],
    ["Uncited narrative citations", checkUncitedNarrativeCitations],
    ["Unbalanced quotation", checkUnbalancedQuotation],
    ["Curly quotes", checkCurlyQuotes],
    ["Comment-eaten scalars", checkCommentEatenScalars],
    ["Research notes", checkResearchNotes],
];

for (const [name, run] of checks)
{
    startCheck(name);

    try
    {
        run(context);
    }
    catch (error: unknown)
    {
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error);

        checkError(name, null, `the check stopped with an exception: ${message}`);
    }
}

printReport();

process.exit(errors.length > 0 ? 1 : 0);
