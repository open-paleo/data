/**
 * Builds YAML data objects from wizard form values and serializes them.
 * Mirrors the field-to-YAML mapping from process-issue.cjs but runs
 * client-side using the vendored yaml library.
 */
window.YamlBuilder = (function ()
{
    "use strict";

    /**
     * Returns the file path for a genus YAML file.
     *
     * @param genusName - The genus name.
     * @returns The path string, e.g. "genera/T/Tyrannosaurus.yml".
     */
    function filePath(genusName)
    {
        const letter = genusName.charAt(0).toUpperCase();

        return `genera/${letter}/${genusName}.yml`;
    }

    /** Fields whose integer values should retain a trailing .0 suffix. */
    const floatFields = new Set(["from_ma", "to_ma"]);

    /** Fields whose string values should always be double-quoted. */
    const quotedFields = new Set(["pages", "doi", "isbn"]);

    /**
     * Serializes a data object to YAML with formatting conventions
     * matching the normalization pass: lineWidth 72, flow-style
     * coordinates, quoted pages/doi/isbn, and .0 on float fields.
     *
     * @param data - The object to serialize.
     * @returns The YAML string.
     */
    function serializeYaml(data)
    {
        const yamlLib = window.YAML;
        const document = new yamlLib.Document(data);

        yamlLib.visit(document, {
            Pair(key, pair)
            {
                const name = pair.key?.value;

                if (name === "coordinates" && yamlLib.isSeq(pair.value))
                {
                    pair.value.flow = true;
                }

                if (quotedFields.has(name) && yamlLib.isScalar(pair.value) && typeof pair.value.value === "string")
                {
                    pair.value.type = "QUOTE_DOUBLE";
                }
            },
        });

        let result = document.toString({ lineWidth: 72 });

        for (const field of floatFields)
        {
            result = result.replace(
                new RegExp("(" + field + ": )(\\d+)$", "gm"),
                (match, prefix, digits) => prefix + digits + ".0",
            );
        }

        return result;
    }

    /**
     * Splits a textarea value into non-empty trimmed lines.
     *
     * @param value - The raw textarea string.
     * @returns An array of non-empty lines.
     */
    function parseLines(value)
    {
        if (!value)
        {
            return [];
        }

        return value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
    }

    /**
     * Parses an identifiers textarea into an array of { source, id } objects.
     *
     * @param value - The raw textarea with "source: id" lines.
     * @returns An array of identifier objects.
     */
    function parseIdentifiers(value)
    {
        const lines = parseLines(value);
        const result = [];

        for (const line of lines)
        {
            const [source, ...idParts] = line.split(":");
            const id = idParts.join(":").trim();

            if (source && id)
            {
                result.push({ source: source.trim(), id });
            }
        }

        return result;
    }

    /**
     * Parses a comma-separated specimen ID string into an array. Whitespace
     * is trimmed from each entry; empty entries are dropped.
     *
     * @param value - The raw specimen ID input, e.g. "CM 84, CM 94".
     * @returns An array of trimmed specimen IDs, or an empty array.
     */
    function parseSpecimenIds(value)
    {
        if (!value)
        {
            return [];
        }

        return String(value)
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0);
    }

    /**
     * Parses a coordinates string into a [lat, lng] array.
     *
     * @param value - The raw coordinates string, e.g. "47.5, -106.9".
     * @returns A two-element array, or null if invalid.
     */
    function parseCoordinates(value)
    {
        if (!value)
        {
            return null;
        }

        const parts = value.split(",").map((part) => Number(part.trim()));

        if (parts.length === 2 && parts.every((part) => !isNaN(part)))
        {
            return parts;
        }

        return null;
    }

    /**
     * Builds a species object from wizard form values.
     *
     * @param values - The wizard values keyed by field header.
     * @param options - Build options.
     * @param options.nameField - The header key for the species name.
     * @param options.fallbackName - Fallback name if the field is empty.
     * @param options.forceStatus - Override the status value.
     * @param options.forceTypeSpecies - If true, set type_species to true.
     * @returns A species data object.
     */
    function buildSpeciesEntry(values, { nameField, fallbackName, forceStatus, forceTypeSpecies })
    {
        const species = {
            name: values[nameField] ?? fallbackName,
            status: forceStatus ?? (values["Status"] ?? "valid").toLowerCase(),
        };

        if (forceTypeSpecies)
        {
            species.type_species = true;
        }

        if (values["Species etymology"])
        {
            species.etymology = values["Species etymology"];
        }

        const period = {};

        if (values["Period"])
        {
            period.name = values["Period"];
        }

        if (values["Stage"])
        {
            period.stage = values["Stage"];
        }

        if (Object.keys(period).length > 0)
        {
            species.period = period;
        }

        const location = {};

        if (values["Country"])
        {
            location.country = values["Country"];
        }

        if (values["Region"])
        {
            location.region = values["Region"];
        }

        if (values["Locality"])
        {
            location.locality = values["Locality"];
        }

        if (values["Formation"])
        {
            location.formation = values["Formation"];
        }

        const coordinates = parseCoordinates(values["Coordinates"]);

        if (coordinates)
        {
            location.coordinates = coordinates;
        }

        if (Object.keys(location).length > 0)
        {
            species.location = location;
        }

        const size = {};

        if (values["Length min (m)"] || values["Length max (m)"])
        {
            const min = parseFloat(values["Length min (m)"] ?? values["Length max (m)"]);
            const max = parseFloat(values["Length max (m)"] ?? values["Length min (m)"]);
            size.length_m = { min, max };
        }

        if (values["Weight min (kg)"] || values["Weight max (kg)"])
        {
            const min = parseFloat(values["Weight min (kg)"] ?? values["Weight max (kg)"]);
            const max = parseFloat(values["Weight max (kg)"] ?? values["Weight min (kg)"]);
            size.weight_kg = { min, max };
        }

        if (values["Hip height min (m)"] || values["Hip height max (m)"])
        {
            const min = parseFloat(values["Hip height min (m)"] ?? values["Hip height max (m)"]);
            const max = parseFloat(values["Hip height max (m)"] ?? values["Hip height min (m)"]);
            size.hip_height_m = { min, max };
        }

        if (Object.keys(size).length > 0)
        {
            species.size = size;
        }

        const holotype = {};

        if (values["Holotype specimen ID"])
        {
            holotype.specimen_id = parseSpecimenIds(values["Holotype specimen ID"]);
            holotype.specimen_type = values["Holotype type"] || "holotype";
        }

        if (values["Holotype institution"])
        {
            holotype.institution = values["Holotype institution"];
        }

        if (values["Holotype material"])
        {
            holotype.material = values["Holotype material"];
        }

        if (values["Holotype status"])
        {
            holotype.status = values["Holotype status"];
        }

        if (values["Holotype completeness"])
        {
            holotype.completeness = values["Holotype completeness"].toLowerCase();
        }

        if (values["Holotype notes"])
        {
            holotype.notes = values["Holotype notes"];
        }

        if (Object.keys(holotype).length > 0)
        {
            species.holotype = holotype;
        }

        if (values["Year described"])
        {
            species.described = parseInt(values["Year described"]);
        }

        if (values["Authors"])
        {
            species.authors = values["Authors"];
        }

        if (values["Species description"])
        {
            species.description = values["Species description"];
        }

        return species;
    }

    /**
     * Builds a complete genus data object from wizard form values
     * for the Add Genus flow.
     *
     * @param values - The wizard values keyed by field header.
     * @returns A genus data object ready for YAML serialization.
     */
    function buildNewGenus(values)
    {
        const genusName = values["Genus name"];

        const genusData = {
            genus: genusName,
            parent: values["Parent clade"] ?? "",
        };

        if (values["Genus etymology"])
        {
            genusData.etymology = values["Genus etymology"];
        }

        if (values["Pronunciation (IPA)"] || values["Pronunciation (phonetic)"])
        {
            genusData.pronunciation = {};

            if (values["Pronunciation (IPA)"])
            {
                genusData.pronunciation.ipa = values["Pronunciation (IPA)"];
            }

            if (values["Pronunciation (phonetic)"])
            {
                genusData.pronunciation.phonetic = values["Pronunciation (phonetic)"];
            }
        }

        genusData.description = values["Genus description"] ?? "";
        genusData.diet = (values["Diet"] ?? "").toLowerCase();

        if (values["Locomotion"])
        {
            genusData.locomotion = values["Locomotion"].toLowerCase();
        }

        const paleoenvironments = Array.isArray(values["Paleoenvironment"])
            ? values["Paleoenvironment"]
            : [];

        if (paleoenvironments.length > 0)
        {
            genusData.paleoenvironment = paleoenvironments;
        }

        if (values["Integument"] || values["Integument evidence"])
        {
            genusData.appearance = {};

            if (values["Integument"])
            {
                genusData.appearance.integument = values["Integument"].toLowerCase();
            }

            if (values["Integument evidence"])
            {
                genusData.appearance.evidence = values["Integument evidence"].toLowerCase();
            }
        }

        const appearanceFeatures = parseLines(values["Appearance features"]);

        if (appearanceFeatures.length > 0)
        {
            if (!genusData.appearance)
            {
                genusData.appearance = {};
            }

            genusData.appearance.features = appearanceFeatures;
        }

        const diagnosticFeatures = parseLines(values["Diagnostic features"]);

        if (diagnosticFeatures.length > 0)
        {
            genusData.diagnostic_features = diagnosticFeatures;
        }

        const identifiers = parseIdentifiers(values["External identifiers"]);

        if (identifiers.length > 0)
        {
            genusData.identifiers = identifiers;
        }

        const species = buildSpeciesEntry(values, {
            nameField: "Type species name",
            fallbackName: `${genusName} sp.`,
            forceStatus: "valid",
            forceTypeSpecies: true,
        });

        genusData.species = [species];

        const references = cleanReferences(values["References"]);

        if (references.length > 0)
        {
            genusData.references = references;
        }

        return genusData;
    }

    /**
     * Cleans a references array for YAML output: strips empty optional
     * fields, converts year to a number, and ensures volume/issue are strings.
     *
     * @param references - The raw references array from wizard values.
     * @returns A cleaned array of reference objects.
     */
    function cleanReferences(references)
    {
        if (!Array.isArray(references) || references.length === 0)
        {
            return [];
        }

        return references.map(
            (reference) =>
            {
                const clean = { };

                const keys = [
                    "id",
                    "authors",
                    "year",
                    "title",
                    "journal",
                    "volume",
                    "issue",
                    "book",
                    "publisher",
                    "pages",
                    "doi",
                    "isbn",
                    "url",
                    "notes",
                ];

                for (const key of keys)
                {
                    if (reference[key])
                    {
                        if (key === "year")
                        {
                            clean[key] = parseInt(reference.year, 10) || reference.year;
                        }
                        else
                        {
                            clean[key] = reference[key];
                        }
                    }
                }

                return clean;
            });
    }

    /**
     * Deep-clones a data object using JSON round-trip.
     *
     * @param data - The object to clone.
     * @returns A deep copy of the object.
     */
    function deepClone(data)
    {
        return JSON.parse(JSON.stringify(data));
    }

    /**
     * Applies genus-level field updates to a cloned copy of existing data.
     * Replace-fields overwrite; additive-fields are merged.
     *
     * @param currentData - The existing genus data object.
     * @param values - The wizard values keyed by field header.
     * @returns A new genus data object with updates applied.
     */
    function applyGenusUpdate(currentData, values)
    {
        const genusData = deepClone(currentData);

        if (values["Pronunciation (IPA)"] || values["Pronunciation (phonetic)"])
        {
            if (!genusData.pronunciation)
            {
                genusData.pronunciation = {};
            }

            if (values["Pronunciation (IPA)"])
            {
                genusData.pronunciation.ipa = values["Pronunciation (IPA)"];
            }

            if (values["Pronunciation (phonetic)"])
            {
                genusData.pronunciation.phonetic = values["Pronunciation (phonetic)"];
            }
        }

        if (values["Description"])
        {
            genusData.description = values["Description"];
        }

        if (values["Diet"])
        {
            genusData.diet = values["Diet"].toLowerCase();
        }

        if (values["Locomotion"])
        {
            genusData.locomotion = values["Locomotion"].toLowerCase();
        }

        if (values["Integument"] || values["Integument evidence"])
        {
            if (!genusData.appearance)
            {
                genusData.appearance = {};
            }

            if (values["Integument"])
            {
                genusData.appearance.integument = values["Integument"].toLowerCase();
            }

            if (values["Integument evidence"])
            {
                genusData.appearance.evidence = values["Integument evidence"].toLowerCase();
            }
        }

        const newEnvironments = Array.isArray(values["Paleoenvironment"])
            ? values["Paleoenvironment"]
            : [];

        if (newEnvironments.length > 0)
        {
            if (!genusData.paleoenvironment)
            {
                genusData.paleoenvironment = [];
            }

            for (const environment of newEnvironments)
            {
                if (!genusData.paleoenvironment.includes(environment))
                {
                    genusData.paleoenvironment.push(environment);
                }
            }
        }

        const newAppearanceFeatures = parseLines(values["Appearance features"]);

        if (newAppearanceFeatures.length > 0)
        {
            if (!genusData.appearance)
            {
                genusData.appearance = {};
            }

            if (!genusData.appearance.features)
            {
                genusData.appearance.features = [];
            }

            for (const feature of newAppearanceFeatures)
            {
                if (!genusData.appearance.features.includes(feature))
                {
                    genusData.appearance.features.push(feature);
                }
            }
        }

        const newDiagnosticFeatures = parseLines(values["Diagnostic features"]);

        if (newDiagnosticFeatures.length > 0)
        {
            if (!genusData.diagnostic_features)
            {
                genusData.diagnostic_features = [];
            }

            for (const feature of newDiagnosticFeatures)
            {
                if (!genusData.diagnostic_features.includes(feature))
                {
                    genusData.diagnostic_features.push(feature);
                }
            }
        }

        const newIdentifiers = parseIdentifiers(values["External identifiers"]);

        if (newIdentifiers.length > 0)
        {
            if (!genusData.identifiers)
            {
                genusData.identifiers = [];
            }

            for (const identifier of newIdentifiers)
            {
                const exists = genusData.identifiers.some(
                    (entry) => entry.source === identifier.source && entry.id === identifier.id,
                );

                if (!exists)
                {
                    genusData.identifiers.push(identifier);
                }
            }
        }

        const references = cleanReferences(values["References"]);

        if (references.length > 0)
        {
            genusData.references = references;
        }

        return genusData;
    }

    /**
     * Applies species-level field updates to a cloned copy of genus data.
     *
     * @param currentData - The existing genus data object.
     * @param speciesName - The name of the species to update.
     * @param values - The wizard values keyed by field header.
     * @returns A new genus data object with the species updated.
     */
    function applySpeciesUpdate(currentData, speciesName, values)
    {
        const genusData = deepClone(currentData);

        const speciesEntry = (genusData.species ?? []).find(
            (species) => species.name.toLowerCase() === speciesName.toLowerCase(),
        );

        if (!speciesEntry)
        {
            return genusData;
        }

        if (values["Species etymology"])
        {
            speciesEntry.etymology = values["Species etymology"];
        }

        if (values["Status"])
        {
            speciesEntry.status = values["Status"].toLowerCase();
        }

        if (values["Year described"])
        {
            speciesEntry.described = parseInt(values["Year described"]);
        }

        if (values["Authors"])
        {
            speciesEntry.authors = values["Authors"];
        }

        if (values["Species description"])
        {
            speciesEntry.description = values["Species description"];
        }

        if (values["Period"] || values["Stage"])
        {
            if (!speciesEntry.period)
            {
                speciesEntry.period = {};
            }

            if (values["Period"])
            {
                speciesEntry.period.name = values["Period"];
            }

            if (values["Stage"])
            {
                speciesEntry.period.stage = values["Stage"];
            }
        }

        if (values["Country"] || values["Region"] || values["Locality"] || values["Formation"] || values["Coordinates"])
        {
            if (!speciesEntry.location)
            {
                speciesEntry.location = {};
            }

            if (values["Country"])
            {
                speciesEntry.location.country = values["Country"];
            }

            if (values["Region"])
            {
                speciesEntry.location.region = values["Region"];
            }

            if (values["Locality"])
            {
                speciesEntry.location.locality = values["Locality"];
            }

            if (values["Formation"])
            {
                speciesEntry.location.formation = values["Formation"];
            }

            const coordinates = parseCoordinates(values["Coordinates"]);

            if (coordinates)
            {
                speciesEntry.location.coordinates = coordinates;
            }
        }

        if (values["Length min (m)"] || values["Length max (m)"] || values["Weight min (kg)"] || values["Weight max (kg)"] || values["Hip height min (m)"] || values["Hip height max (m)"])
        {
            if (!speciesEntry.size)
            {
                speciesEntry.size = {};
            }

            if (values["Length min (m)"] || values["Length max (m)"])
            {
                const min = parseFloat(values["Length min (m)"] ?? values["Length max (m)"]);
                const max = parseFloat(values["Length max (m)"] ?? values["Length min (m)"]);
                speciesEntry.size.length_m = { min, max };
            }

            if (values["Weight min (kg)"] || values["Weight max (kg)"])
            {
                const min = parseFloat(values["Weight min (kg)"] ?? values["Weight max (kg)"]);
                const max = parseFloat(values["Weight max (kg)"] ?? values["Weight min (kg)"]);
                speciesEntry.size.weight_kg = { min, max };
            }

            if (values["Hip height min (m)"] || values["Hip height max (m)"])
            {
                const min = parseFloat(values["Hip height min (m)"] ?? values["Hip height max (m)"]);
                const max = parseFloat(values["Hip height max (m)"] ?? values["Hip height min (m)"]);
                speciesEntry.size.hip_height_m = { min, max };
            }
        }

        if (values["Holotype specimen ID"] || values["Holotype institution"] || values["Holotype material"] || values["Holotype status"] || values["Holotype type"] || values["Holotype completeness"] || values["Holotype notes"])
        {
            if (!speciesEntry.holotype)
            {
                speciesEntry.holotype = {};
            }

            if (values["Holotype specimen ID"])
            {
                speciesEntry.holotype.specimen_id = parseSpecimenIds(values["Holotype specimen ID"]);
                speciesEntry.holotype.specimen_type = values["Holotype type"] || "holotype";
            }
            else if (values["Holotype type"])
            {
                speciesEntry.holotype.specimen_type = values["Holotype type"];
            }

            if (values["Holotype institution"])
            {
                speciesEntry.holotype.institution = values["Holotype institution"];
            }

            if (values["Holotype material"])
            {
                speciesEntry.holotype.material = values["Holotype material"];
            }

            if (values["Holotype status"])
            {
                speciesEntry.holotype.status = values["Holotype status"];
            }

            if (values["Holotype completeness"])
            {
                speciesEntry.holotype.completeness = values["Holotype completeness"].toLowerCase();
            }

            if (values["Holotype notes"])
            {
                speciesEntry.holotype.notes = values["Holotype notes"];
            }
        }

        const references = cleanReferences(values["References"]);

        if (references.length > 0)
        {
            genusData.references = references;
        }

        return genusData;
    }

    /**
     * Clones genus data and updates the parent clade field.
     *
     * @param currentData - The existing genus data object.
     * @param newParent - The new parent clade name.
     * @param values - The wizard values keyed by field header (optional).
     * @returns A new genus data object with the parent updated.
     */
    function applyTaxonomyUpdate(currentData, newParent, values)
    {
        const genusData = deepClone(currentData);

        genusData.parent = newParent;

        if (values)
        {
            const references = cleanReferences(values["References"]);

            if (references.length > 0)
            {
                genusData.references = references;
            }
        }

        return genusData;
    }

    /**
     * Clones genus data and appends a new species entry.
     *
     * @param currentData - The existing genus data object.
     * @param values - The wizard values keyed by field header.
     * @returns A new genus data object with the species added.
     */
    function addSpeciesToGenus(currentData, values)
    {
        const genusData = deepClone(currentData);

        if (!genusData.species)
        {
            genusData.species = [];
        }

        const species = buildSpeciesEntry(values, {
            nameField: "Species name",
        });

        genusData.species.push(species);

        const references = cleanReferences(values["References"]);

        if (references.length > 0)
        {
            if (!genusData.references)
            {
                genusData.references = [];
            }

            for (const reference of references)
            {
                const exists = genusData.references.some(
                    (entry) => entry.id === reference.id,
                );

                if (!exists)
                {
                    genusData.references.push(reference);
                }
            }
        }

        return genusData;
    }

    /**
     * Computes a simple line-by-line diff between two YAML strings.
     * Uses a longest-common-subsequence approach for readable output.
     *
     * @param beforeYaml - The original YAML string (empty for new files).
     * @param afterYaml - The target YAML string.
     * @returns A string with +/- prefixed lines.
     */
    function computeDiff(beforeYaml, afterYaml)
    {
        const beforeLines = beforeYaml ? beforeYaml.split("\n") : [];
        const afterLines = afterYaml.split("\n");

        if (beforeLines.length === 0)
        {
            return afterLines
                .filter((line) => line !== "")
                .map((line) => `+ ${line}`)
                .join("\n");
        }

        const lcs = computeLcs(beforeLines, afterLines);
        const result = [];
        let beforeIndex = 0;
        let afterIndex = 0;

        for (const match of lcs)
        {
            while (beforeIndex < match.beforeIndex)
            {
                result.push(`- ${beforeLines[beforeIndex]}`);
                beforeIndex++;
            }

            while (afterIndex < match.afterIndex)
            {
                result.push(`+ ${afterLines[afterIndex]}`);
                afterIndex++;
            }

            result.push(`  ${afterLines[afterIndex]}`);
            beforeIndex++;
            afterIndex++;
        }

        while (beforeIndex < beforeLines.length)
        {
            if (beforeLines[beforeIndex] !== "")
            {
                result.push(`- ${beforeLines[beforeIndex]}`);
            }

            beforeIndex++;
        }

        while (afterIndex < afterLines.length)
        {
            if (afterLines[afterIndex] !== "")
            {
                result.push(`+ ${afterLines[afterIndex]}`);
            }

            afterIndex++;
        }

        return result.join("\n");
    }

    /**
     * Computes the longest common subsequence of two string arrays.
     *
     * @param before - The first array of lines.
     * @param after - The second array of lines.
     * @returns An array of { beforeIndex, afterIndex } match pairs.
     */
    function computeLcs(before, after)
    {
        const rows = before.length;
        const cols = after.length;
        const table = [];

        for (let row = 0; row <= rows; row++)
        {
            table[row] = new Array(cols + 1).fill(0);
        }

        for (let row = 1; row <= rows; row++)
        {
            for (let col = 1; col <= cols; col++)
            {
                if (before[row - 1] === after[col - 1])
                {
                    table[row][col] = table[row - 1][col - 1] + 1;
                }
                else
                {
                    table[row][col] = Math.max(table[row - 1][col], table[row][col - 1]);
                }
            }
        }

        const matches = [];
        let row = rows;
        let col = cols;

        while (row > 0 && col > 0)
        {
            if (before[row - 1] === after[col - 1])
            {
                matches.unshift({ beforeIndex: row - 1, afterIndex: col - 1 });
                row--;
                col--;
            }
            else if (table[row - 1][col] > table[row][col - 1])
            {
                row--;
            }
            else
            {
                col--;
            }
        }

        return matches;
    }

    /**
     * Computes a unified diff with hunk headers between two YAML strings.
     * Used for the issue body payload in update flows. Returns null if
     * there are no changes.
     *
     * @param path - The file path for the diff headers.
     * @param beforeYaml - The original YAML string.
     * @param afterYaml - The target YAML string.
     * @returns A unified diff string, or null if no changes.
     */
    function computeUnifiedDiff(path, beforeYaml, afterYaml)
    {
        const contextSize = 3;
        const beforeLines = beforeYaml ? beforeYaml.split("\n") : [];
        const afterLines = afterYaml ? afterYaml.split("\n") : [];

        // Build a full diff using LCS
        const lcs = computeLcs(beforeLines, afterLines);
        const operations = [];
        let beforeIndex = 0;
        let afterIndex = 0;

        for (const match of lcs)
        {
            while (beforeIndex < match.beforeIndex)
            {
                operations.push({ type: "remove", beforeLine: beforeIndex, text: beforeLines[beforeIndex] });
                beforeIndex++;
            }

            while (afterIndex < match.afterIndex)
            {
                operations.push({ type: "add", afterLine: afterIndex, text: afterLines[afterIndex] });
                afterIndex++;
            }

            operations.push({ type: "context", beforeLine: beforeIndex, afterLine: afterIndex, text: beforeLines[beforeIndex] });
            beforeIndex++;
            afterIndex++;
        }

        while (beforeIndex < beforeLines.length)
        {
            operations.push({ type: "remove", beforeLine: beforeIndex, text: beforeLines[beforeIndex] });
            beforeIndex++;
        }

        while (afterIndex < afterLines.length)
        {
            operations.push({ type: "add", afterLine: afterIndex, text: afterLines[afterIndex] });
            afterIndex++;
        }

        // Find change regions (groups of non-context operations)
        const changeRegions = [];
        let regionStart = null;

        for (let index = 0; index < operations.length; index++)
        {
            if (operations[index].type !== "context")
            {
                if (regionStart === null)
                {
                    regionStart = index;
                }
            }
            else if (regionStart !== null)
            {
                changeRegions.push({ start: regionStart, end: index - 1 });
                regionStart = null;
            }
        }

        if (regionStart !== null)
        {
            changeRegions.push({ start: regionStart, end: operations.length - 1 });
        }

        if (changeRegions.length === 0)
        {
            return null;
        }

        // Expand regions with context lines and merge overlapping ones
        const hunks = [];

        for (const region of changeRegions)
        {
            const expandedStart = Math.max(0, region.start - contextSize);
            const expandedEnd = Math.min(operations.length - 1, region.end + contextSize);

            if (hunks.length > 0 && expandedStart <= hunks[hunks.length - 1].end)
            {
                hunks[hunks.length - 1].end = expandedEnd;
            }
            else
            {
                hunks.push({ start: expandedStart, end: expandedEnd });
            }
        }

        // Generate unified diff output
        const result = [`--- ${path}`, `+++ ${path}`];

        for (const hunk of hunks)
        {
            const hunkOps = operations.slice(hunk.start, hunk.end + 1);

            // Calculate line numbers for the hunk header
            let beforeStart = null;
            let afterStart = null;
            let beforeCount = 0;
            let afterCount = 0;

            for (const operation of hunkOps)
            {
                if (operation.type === "context")
                {
                    if (beforeStart === null)
                    {
                        beforeStart = operation.beforeLine + 1;
                    }

                    if (afterStart === null)
                    {
                        afterStart = operation.afterLine + 1;
                    }

                    beforeCount++;
                    afterCount++;
                }
                else if (operation.type === "remove")
                {
                    if (beforeStart === null)
                    {
                        beforeStart = operation.beforeLine + 1;
                    }

                    if (afterStart === null)
                    {
                        // Use the position relative to what we've seen so far
                        afterStart = (beforeStart ?? 1) + afterCount - beforeCount;
                    }

                    beforeCount++;
                }
                else if (operation.type === "add")
                {
                    if (afterStart === null)
                    {
                        afterStart = operation.afterLine + 1;
                    }

                    if (beforeStart === null)
                    {
                        beforeStart = (afterStart ?? 1) + beforeCount - afterCount;
                    }

                    afterCount++;
                }
            }

            result.push(`@@ -${beforeStart ?? 1},${beforeCount} +${afterStart ?? 1},${afterCount} @@`);

            for (const operation of hunkOps)
            {
                if (operation.type === "context")
                {
                    result.push(` ${operation.text}`);
                }
                else if (operation.type === "remove")
                {
                    result.push(`-${operation.text}`);
                }
                else if (operation.type === "add")
                {
                    result.push(`+${operation.text}`);
                }
            }
        }

        return result.join("\n");
    }

    /**
     * Returns the file path for a clade YAML file.
     *
     * @param cladeName - The clade name.
     * @returns The path string, e.g. "clades/Tyrannosauridae.yml".
     */
    function cladeFilePath(cladeName)
    {
        return `clades/${cladeName}.yml`;
    }

    /**
     * Builds a complete clade data object from wizard form values
     * for the Add Clade flow.
     *
     * @param values - The wizard values keyed by field header.
     * @returns A clade data object ready for YAML serialization.
     */
    function buildNewClade(values)
    {
        const cladeData = {
            clade: values["Clade name"] ?? "",
            description: values["Description"] ?? "",
        };

        if (values["Year described"])
        {
            cladeData.described = parseInt(values["Year described"]);
        }

        if (values["Authors"])
        {
            cladeData.authors = values["Authors"];
        }

        const diagnosticFeatures = parseLines(values["Diagnostic features"]);

        if (diagnosticFeatures.length > 0)
        {
            cladeData.diagnostic_features = diagnosticFeatures;
        }

        const references = cleanReferences(values["References"]);

        if (references.length > 0)
        {
            cladeData.references = references;
        }

        return cladeData;
    }

    return {
        filePath: filePath,
        cladeFilePath: cladeFilePath,
        serializeYaml: serializeYaml,
        buildNewClade: buildNewClade,
        buildNewGenus: buildNewGenus,
        buildSpeciesEntry: buildSpeciesEntry,
        applyGenusUpdate: applyGenusUpdate,
        applySpeciesUpdate: applySpeciesUpdate,
        applyTaxonomyUpdate: applyTaxonomyUpdate,
        addSpeciesToGenus: addSpeciesToGenus,
        computeDiff: computeDiff,
        computeUnifiedDiff: computeUnifiedDiff,
    };
})();
