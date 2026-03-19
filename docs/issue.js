/**
 * Builds the GitHub issue URL from wizard state and opens it.
 *
 * Body format: "### Header\n\nValue\n\n### Header2\n\nValue2\n\n..."
 * This matches what parseIssueForm() in helpers.cjs expects.
 *
 * Checkboxes use "- [X] value" / "- [ ] value" format
 * matching parseCheckboxes() in helpers.cjs.
 */
window.IssueBuilder = (function ()
{
    "use strict";

    const repoUrl = "https://github.com/open-paleo/data";

    /**
     * Constructs a full pre-filled GitHub issue URL from the wizard state.
     *
     * @param flow - The active flow definition.
     * @param values - The current field values keyed by header.
     * @param currentValues - The loaded genus/species data for update flows, or null.
     * @param selectedSpecies - The selected species object for update-species, or null.
     * @returns The encoded GitHub issue URL string.
     */
    function buildUrl(flow, values, currentValues, selectedSpecies)
    {
        const title = `${flow.titlePrefix}${values[flow.titleField] ?? ""}`;
        const body = buildBody(flow, values, currentValues, selectedSpecies);

        return `${repoUrl}/issues/new?labels=${encodeURIComponent(flow.label)}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    }

    /**
     * Builds the issue body in the "### Header\n\nValue" format expected
     * by parseIssueForm() in helpers.cjs.
     *
     * Empty fields and unchanged fields (in update flows) are omitted.
     *
     * @param flow - The active flow definition.
     * @param values - The current field values keyed by header.
     * @param currentValues - The loaded genus/species data for update flows, or null.
     * @param selectedSpecies - The selected species object for update-species, or null.
     * @returns The formatted issue body string.
     */
    function buildBody(flow, values, currentValues, selectedSpecies)
    {
        const sections = [];
        const isUpdate = flow.isUpdate;

        for (const step of flow.steps)
        {
            for (const field of step.fields)
            {
                if (field.type === "readonly")
                {
                    continue;
                }

                const updated = values[field.header];

                if (!updated || (Array.isArray(updated) && updated.length === 0))
                {
                    continue;
                }

                // For update flows, omit unchanged fields
                if (isUpdate && field.currentKey)
                {
                    const value = resolveCurrentValue(currentValues, selectedSpecies, field.currentKey);
                    const valueText = value != null ? String(value) : "";

                    const updatedText = Array.isArray(updated) ? updated.join(", ") : updated;

                    if (updatedText === valueText)
                    {
                        continue;
                    }
                }

                let formatted;

                if (field.type === "checkboxes")
                {
                    const options = getCheckboxOptions(field);
                    const checked = Array.isArray(updated) ? updated : [];

                    formatted = options
                        .map((option) => `${checked.indexOf(option) >= 0 ? "- [X]" : "- [ ]"} ${option}`)
                        .join("\n");
                }
                else
                {
                    formatted = Array.isArray(updated) ? updated.join(", ") : updated;
                }

                sections.push(`### ${field.header}\n\n${formatted}`);
            }
        }

        return sections.join("\n\n");
    }

    /**
     * Resolves the current value for a field from the loaded genus/species data,
     * using a dotted key path (e.g., "species.period.name").
     *
     * @param currentValues - The loaded genus data object.
     * @param selectedSpecies - The selected species object, or null.
     * @param key - The dotted key path into the data.
     * @returns The resolved value as a string, or null if not found.
     */
    function resolveCurrentValue(currentValues, selectedSpecies, key)
    {
        if (!currentValues || !currentValues._loaded)
        {
            return null;
        }
        else if (key.startsWith("species."))
        {
            if (!selectedSpecies)
            {
                return null;
            }

            const parts = key.slice(8).split(".");
            let object = selectedSpecies;

            for (const part of parts)
            {
                if (object == null)
                {
                    return null;
                }

                object = object[part];
            }

            return Array.isArray(object) ? object.join(", ") : object;
        }

        switch (key)
        {
            case "parent":
            case "description":
            case "diet":
            case "locomotion":
                return currentValues[key] ?? null;

            case "appearance.integument":
                return currentValues.appearance && currentValues.appearance.integument
                    ? currentValues.appearance.integument
                    : null;

            case "appearance.evidence":
                return currentValues.appearance && currentValues.appearance.evidence
                    ? currentValues.appearance.evidence
                    : null;

            case "paleoenvironment":
            {
                const environment = currentValues.paleoenvironment;
                return Array.isArray(environment) ? environment.join(", ") : environment ?? null;
            }

            case "appearance.features":
            {
                const features = currentValues.appearance && currentValues.appearance.features;
                return Array.isArray(features) ? features.join("\n") : null;
            }

            case "diagnostic_features":
            {
                const diagnostics = currentValues.diagnostic_features;
                return Array.isArray(diagnostics) ? diagnostics.join("\n") : null;
            }

            case "identifiers":
            {
                const identifiers = currentValues.identifiers;

                if (!Array.isArray(identifiers))
                {
                    return null;
                }

                return identifiers.map((identifier) => `${identifier.source}: ${identifier.id}`).join("\n");
            }
        }

        return null;
    }

    /**
     * Returns the full list of checkbox options for a field from the schema.
     *
     * @param field - The field definition containing an optionsKey.
     * @returns The array of option strings.
     */
    function getCheckboxOptions(field)
    {
        if (field.optionsKey)
        {
            return window.OpenPaleo.getSchemaValues(field.optionsKey);
        }

        return [];
    }

    /**
     * Builds the issue URL from the current wizard state and opens it
     * in a new browser tab.
     */
    function submit()
    {
        const wizard = window._wizard;

        const url = buildUrl(
            wizard.getFlow(),
            wizard.getValues(),
            wizard.getCurrentValues(),
            wizard.getSelectedSpecies(),
        );

        window.open(url, "_blank");
    }

    return {
        buildUrl: buildUrl,
        submit: submit,
    };
})();
