/**
 * Flow definitions for the contribution wizard.
 *
 * Each flow maps to a GitHub issue label and defines:
 *   - label: the issue label
 *   - titlePrefix: prepended to the issue title
 *   - steps: array of { name, fields[] }
 *
 * Field types:
 *   text       — single-line input
 *   number     — numeric input
 *   textarea   — multi-line input
 *   select     — static dropdown (options from schema or inline)
 *   search     — searchable dropdown (options resolved at render time)
 *   checkboxes — checkbox group
 *   readonly   — non-editable display value
 *
 * The `header` property must EXACTLY match the label in the issue template.
 * Fields with `required: true` are validated before advancing.
 */
window.Flows = (function ()
{
    "use strict";

    const addGenus = {
        label: "Add Genus",
        titlePrefix: "Add genus: ",
        titleField: "Genus name",
        importable: true,
        steps: [
            {
                name: "Genus basics",
                fields: [
                    { header: "Genus name", type: "text", required: true, placeholder: "e.g., Tyrannosaurus", validate: "newGenus" },
                    { header: "Genus etymology", type: "text", placeholder: "e.g., \"tyrant lizard\"" },
                    { header: "Pronunciation (IPA)", type: "text", placeholder: "e.g., /taɪˌrænəˈsɔːrəs/" },
                    { header: "Pronunciation (phonetic)", type: "text", placeholder: "e.g., tie-RAN-oh-SOR-us" },
                    { header: "Parent clade", type: "search", required: true, optionsKey: "clades" },
                    { header: "Diet", type: "select", required: true, optionsKey: "diet" },
                    { header: "Locomotion", type: "select", optionsKey: "locomotion" },
                ],
            },
            {
                name: "Type species",
                fields: [
                    { header: "Type species name", type: "text", required: true, placeholder: "e.g., Tyrannosaurus rex" },
                    { header: "Species etymology", type: "text", placeholder: "e.g., \"tyrant lizard king\"" },
                    { header: "Year described", type: "text", placeholder: "e.g., 1905", validate: "year" },
                    { header: "Authors", type: "text", placeholder: "e.g., Osborn" },
                ],
            },
            {
                name: "Time & place",
                fields: [
                    { header: "Period", type: "select", required: true, optionsKey: "periods" },
                    { header: "Stage", type: "select", optionsKey: "stages", filteredByPeriod: true },
                    { header: "Country", type: "search", required: true, optionsKey: "countries" },
                    { header: "Region", type: "text", placeholder: "e.g., Montana" },
                    { header: "Locality", type: "text", placeholder: "e.g., Fort Peck" },
                    { header: "Formation", type: "text", placeholder: "e.g., Hell Creek Formation" },
                    { header: "Coordinates", type: "text", placeholder: "e.g., 47.5, -106.9", validate: "coordinates" },
                ],
            },
            {
                name: "Morphology",
                fields: [
                    { header: "Integument", type: "select", optionsKey: "integument" },
                    { header: "Integument evidence", type: "select", optionsKey: "integument_evidence", showWhen: { field: "Integument", notEmpty: true, notValue: "unknown" } },
                    { header: "Completeness", type: "select", optionsKey: "completeness" },
                    { header: "Paleoenvironment", type: "checkboxes", optionsKey: "paleoenvironments" },
                    { header: "Appearance features", type: "textarea", placeholder: "One per line" },
                    { header: "Diagnostic features", type: "textarea", placeholder: "One per line" },
                ],
            },
            {
                name: "Size & holotype",
                fields: [
                    { header: "Estimated length (m)", type: "text", placeholder: "e.g., 12.3", validate: "positiveNumber" },
                    { header: "Estimated weight (kg)", type: "text", placeholder: "e.g., 8400", validate: "positiveNumber" },
                    { header: "Estimated hip height (m)", type: "text", placeholder: "e.g., 3.7", validate: "positiveNumber" },
                    { header: "Holotype specimen ID", type: "text", placeholder: "e.g., CM 9380" },
                    { header: "Holotype institution", type: "text", placeholder: "e.g., Carnegie Museum of Natural History" },
                    { header: "Holotype material", type: "text", placeholder: "e.g., partial skeleton including skull" },
                ],
            },
            {
                name: "Description & references",
                fields: [
                    { header: "Genus description", type: "textarea", required: true },
                    { header: "Species description", type: "textarea" },
                    { header: "External identifiers", type: "textarea", placeholder: "One per line, format: source: id", validate: "identifiers" },
                    { header: "Reference / source", type: "textarea", required: true },
                ],
            },
        ],
    };

    const addSpecies = {
        label: "Add Species",
        titlePrefix: "Add species: ",
        titleField: "Species name",
        steps: [
            {
                name: "Species basics",
                fields: [
                    { header: "Genus name", type: "search", required: true, optionsKey: "genera" },
                    { header: "Species name", type: "text", required: true, placeholder: "e.g., Tyrannosaurus rex", validate: "newSpecies" },
                    { header: "Species etymology", type: "text", placeholder: "e.g., \"tyrant lizard king\"" },
                    { header: "Status", type: "select", required: true, optionsKey: "status" },
                    { header: "If synonym, synonym of", type: "text", required: true, placeholder: "e.g., Tyrannosaurus rex", showWhen: { field: "Status", value: "synonym" } },
                ],
            },
            {
                name: "Time & place",
                fields: [
                    { header: "Period", type: "select", optionsKey: "periods" },
                    { header: "Stage", type: "select", optionsKey: "stages", filteredByPeriod: true },
                    { header: "Country", type: "search", optionsKey: "countries" },
                    { header: "Region", type: "text", placeholder: "e.g., Montana" },
                    { header: "Locality", type: "text", placeholder: "e.g., Fort Peck" },
                    { header: "Formation", type: "text", placeholder: "e.g., Hell Creek Formation" },
                    { header: "Coordinates", type: "text", placeholder: "e.g., 47.5, -106.9", validate: "coordinates" },
                ],
            },
            {
                name: "Size & holotype",
                fields: [
                    { header: "Completeness", type: "select", optionsKey: "completeness" },
                    { header: "Holotype specimen ID", type: "text", placeholder: "e.g., CM 9380" },
                    { header: "Holotype institution", type: "text" },
                    { header: "Holotype material", type: "text" },
                    { header: "Estimated length (m)", type: "text", placeholder: "e.g., 12.3", validate: "positiveNumber" },
                    { header: "Estimated weight (kg)", type: "text", placeholder: "e.g., 8400", validate: "positiveNumber" },
                    { header: "Estimated hip height (m)", type: "text", placeholder: "e.g., 3.7", validate: "positiveNumber" },
                    { header: "Year described", type: "text", placeholder: "e.g., 1905", validate: "year" },
                    { header: "Authors", type: "text", placeholder: "e.g., Osborn" },
                ],
            },
            {
                name: "Description & references",
                fields: [
                    { header: "Species description", type: "textarea" },
                    { header: "Reference / source", type: "textarea", required: true },
                ],
            },
        ],
    };

    const updateGenus = {
        label: "Update Genus",
        titlePrefix: "Update: ",
        titleField: "Genus name",
        isUpdate: true,
        steps: [
            {
                name: "Select genus",
                fields: [
                    { header: "Genus name", type: "search", required: true, optionsKey: "genera", loadOnSelect: true },
                ],
            },
            {
                name: "Edit fields",
                fields: [
                    { header: "Pronunciation (IPA)", type: "text", currentKey: "pronunciation.ipa", placeholder: "e.g., /taɪˌrænəˈsɔːrəs/" },
                    { header: "Pronunciation (phonetic)", type: "text", currentKey: "pronunciation.phonetic", placeholder: "e.g., tie-RAN-oh-SOR-us" },
                    { header: "Description", type: "textarea", currentKey: "description" },
                    { header: "Diet", type: "select", optionsKey: "diet", currentKey: "diet" },
                    { header: "Locomotion", type: "select", optionsKey: "locomotion", currentKey: "locomotion" },
                    { header: "Integument", type: "select", optionsKey: "integument", currentKey: "appearance.integument" },
                    { header: "Integument evidence", type: "select", optionsKey: "integument_evidence", currentKey: "appearance.evidence" },
                    { header: "Paleoenvironment", type: "checkboxes", optionsKey: "paleoenvironments", currentKey: "paleoenvironment" },
                    { header: "Appearance features", type: "textarea", currentKey: "appearance.features", placeholder: "One per line" },
                    { header: "Diagnostic features", type: "textarea", currentKey: "diagnostic_features", placeholder: "One per line" },
                    { header: "External identifiers", type: "textarea", currentKey: "identifiers", placeholder: "One per line, format: source: id", validate: "identifiers" },
                ],
            },
            {
                name: "Reference",
                fields: [
                    { header: "Reference / source", type: "textarea", required: true },
                ],
            },
        ],
    };

    const updateSpecies = {
        label: "Update Species",
        titlePrefix: "Update species: ",
        titleField: "Species name",
        isUpdate: true,
        steps: [
            {
                name: "Select species",
                fields: [
                    { header: "Genus name", type: "search", required: true, optionsKey: "genera", loadOnSelect: true },
                    { header: "Species name", type: "select", required: true, optionsKey: "_species", currentKey: "_species_select" },
                ],
            },
            {
                name: "Edit fields",
                fields: [
                    { header: "Species etymology", type: "text", currentKey: "species.etymology" },
                    { header: "Status", type: "select", optionsKey: "status", currentKey: "species.status" },
                    { header: "If synonym, synonym of", type: "text", required: true, currentKey: "species.synonym_of", showWhen: { field: "Status", value: "synonym" } },
                    { header: "Period", type: "select", optionsKey: "periods", currentKey: "species.period.name" },
                    { header: "Stage", type: "select", optionsKey: "stages", filteredByPeriod: true, currentKey: "species.period.stage" },
                    { header: "Country", type: "search", optionsKey: "countries", currentKey: "species.location.country" },
                    { header: "Region", type: "text", currentKey: "species.location.region" },
                    { header: "Locality", type: "text", currentKey: "species.location.locality" },
                    { header: "Formation", type: "text", currentKey: "species.location.formation" },
                    { header: "Coordinates", type: "text", currentKey: "species.location.coordinates", validate: "coordinates" },
                    { header: "Completeness", type: "select", optionsKey: "completeness", currentKey: "species.completeness" },
                    { header: "Holotype specimen ID", type: "text", currentKey: "species.holotype.specimen_id" },
                    { header: "Holotype institution", type: "text", currentKey: "species.holotype.institution" },
                    { header: "Holotype material", type: "text", currentKey: "species.holotype.material" },
                    { header: "Estimated length (m)", type: "text", currentKey: "species.size.length_m", validate: "positiveNumber" },
                    { header: "Estimated weight (kg)", type: "text", currentKey: "species.size.weight_kg", validate: "positiveNumber" },
                    { header: "Estimated hip height (m)", type: "text", currentKey: "species.size.hip_height_m", validate: "positiveNumber" },
                    { header: "Year described", type: "text", currentKey: "species.described", validate: "year" },
                    { header: "Authors", type: "text", currentKey: "species.authors" },
                    { header: "Species description", type: "textarea", currentKey: "species.description" },
                ],
            },
            {
                name: "Reference",
                fields: [
                    { header: "Reference / source", type: "textarea", required: true },
                ],
            },
        ],
    };

    const correctTaxonomy = {
        label: "Taxonomy",
        titlePrefix: "Reclassify: ",
        titleField: "Genus name",
        steps: [
            {
                name: "Select genus",
                fields: [
                    { header: "Genus name", type: "search", required: true, optionsKey: "genera", loadOnSelect: true },
                    { header: "Current parent clade", type: "readonly", currentKey: "parent" },
                ],
            },
            {
                name: "New classification",
                fields: [
                    { header: "Proposed parent clade", type: "search", required: true, optionsKey: "clades" },
                ],
            },
            {
                name: "Justification",
                fields: [
                    { header: "Reference / source", type: "textarea", required: true },
                    { header: "Notes", type: "textarea" },
                ],
            },
        ],
    };

    const proposeUpdate = {
        label: "Proposal",
        titlePrefix: "Propose: ",
        titleField: "Genus name",
        steps: [
            {
                name: "Select genus",
                fields: [
                    { header: "Genus name", type: "search", required: true, optionsKey: "genera" },
                ],
            },
            {
                name: "Proposal",
                fields: [
                    { header: "Details", type: "textarea", required: true },
                    { header: "Reference / source", type: "textarea", required: true },
                ],
            },
        ],
    };

    const all = {
        "add-genus": addGenus,
        "add-species": addSpecies,
        "update-genus": updateGenus,
        "update-species": updateSpecies,
        "correct-taxonomy": correctTaxonomy,
        "propose-update": proposeUpdate,
    };

    /**
     * Returns a flow definition by its identifier.
     *
     * @param flowId - The flow key (e.g., "add-genus", "update-species").
     * @returns The flow definition object, or null if not found.
     */
    function get(flowId)
    {
        return all[flowId] ?? null;
    }

    return { get: get };
})();
