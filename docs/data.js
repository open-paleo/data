/**
 * Data loading and accessor layer for the contribution wizard.
 * Fetches schema.json and open-paleo.json, exposes typed accessors.
 */
window.OpenPaleo = (function ()
{
    "use strict";

    let schema = null;
    let dataset = null;

    /**
     * Fetches both JSON data files in parallel and caches them.
     *
     * @returns A promise that resolves when both files are loaded.
     */
    async function initialize()
    {
        const [schemaResponse, dataResponse] = await Promise.all([
            fetch("schema.json"),
            fetch("open-paleo.json"),
        ]);

        if (!schemaResponse.ok)
        {
            throw new Error("Failed to load schema.json");
        }

        if (!dataResponse.ok)
        {
            throw new Error("Failed to load open-paleo.json");
        }

        schema = await schemaResponse.json();
        dataset = await dataResponse.json();
    }

    /**
     * Returns the sorted array for a controlled vocabulary key from the schema.
     *
     * @param key - The vocabulary key (e.g., "diet", "periods", "countries").
     * @returns The sorted array of allowed values, or an empty array.
     */
    function getSchemaValues(key)
    {
        if (!schema)
        {
            return [];
        }

        return schema[key] ?? [];
    }

    /**
     * Returns the genera object from the dataset, keyed by genus name.
     *
     * @returns The genera record, or an empty object if not loaded.
     */
    function getGenera()
    {
        if (!dataset)
        {
            return {};
        }

        return dataset.genera ?? {};
    }

    /**
     * Returns a single genus record by name.
     *
     * @param name - The genus name to look up.
     * @returns The genus object, or null if not found.
     */
    function getGenus(name)
    {
        if (!dataset || !dataset.genera)
        {
            return null;
        }

        return dataset.genera[name] ?? null;
    }

    /**
     * Returns the species array for a given genus.
     *
     * @param genusName - The genus name to look up.
     * @returns The species array, or an empty array if not found.
     */
    function getSpecies(genusName)
    {
        const genus = getGenus(genusName);

        if (!genus || !genus.species)
        {
            return [];
        }

        return genus.species;
    }

    /**
     * Returns the sorted list of all clade names from the schema.
     *
     * @returns A sorted array of clade name strings.
     */
    function getClades()
    {
        if (!schema)
        {
            return [];
        }

        return schema.clades ?? [];
    }

    /**
     * Returns stage names filtered to those belonging to a given period.
     *
     * @param periodName - The period to filter by (e.g., "Late Cretaceous").
     * @returns A sorted array of stage names within the given period.
     */
    function getStagesForPeriod(periodName)
    {
        if (!schema || !schema.stages)
        {
            return [];
        }

        const result = [];

        for (const [name, info] of Object.entries(schema.stages))
        {
            if (info.period === periodName)
            {
                result.push(name);
            }
        }

        return result.sort();
    }

    /**
     * Returns the list of known identifier sources from the schema.
     *
     * @returns A sorted array of identifier source strings.
     */
    function getIdentifierSources()
    {
        if (!schema)
        {
            return [];
        }

        return schema.identifier_sources ?? [];
    }

    return {
        initialize: initialize,
        getSchemaValues: getSchemaValues,
        getGenera: getGenera,
        getGenus: getGenus,
        getSpecies: getSpecies,
        getClades: getClades,
        getStagesForPeriod: getStagesForPeriod,
        getIdentifierSources: getIdentifierSources,
    };
})();
