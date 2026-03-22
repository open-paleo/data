/**
 * Builds the GitHub issue URL from wizard state and opens it.
 * Generates a patch-based issue body with full YAML content and a
 * human-readable diff, replacing the old "### Header" form format.
 *
 * The "Propose Update" flow has no YAML output and uses a plain
 * text body instead.
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
        const body = flow.label === "Proposal"
            ? buildProposalBody(flow, values)
            : buildPatchBody(flow, values, currentValues, selectedSpecies);

        return `${repoUrl}/issues/new?labels=${encodeURIComponent(flow.label)}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    }

    /**
     * Builds a patch-based issue body with YAML content and diff.
     *
     * @param flow - The active flow definition.
     * @param values - The current field values keyed by header.
     * @param currentValues - The loaded genus/species data for update flows, or null.
     * @param selectedSpecies - The selected species object for update-species, or null.
     * @returns The formatted issue body string.
     */
    function buildPatchBody(flow, values, currentValues, selectedSpecies)
    {
        const genusName = values["Genus name"] ?? "";
        const yamlPath = window.YamlBuilder.filePath(genusName);
        const targetData = buildTargetData(flow, values, currentValues, selectedSpecies);
        const afterYaml = window.YamlBuilder.serializeYaml(targetData);

        if (flow.label === "Add Genus")
        {
            return buildCreateBody(yamlPath, afterYaml, values);
        }

        let beforeYaml = "";

        if (currentValues && currentValues._loaded)
        {
            beforeYaml = window.YamlBuilder.serializeYaml(stripInternalKeys(currentValues));
        }

        const unifiedDiff = window.YamlBuilder.computeUnifiedDiff(yamlPath, beforeYaml, afterYaml);

        if (!unifiedDiff)
        {
            return [
                `<!-- yaml-path: ${yamlPath} -->`,
                "<!-- yaml-action: update -->",
                "",
                "## No Changes Detected",
                "",
                "No fields were modified.",
            ].join("\n");
        }

        const sections = [
            `<!-- yaml-path: ${yamlPath} -->`,
            "<!-- yaml-action: update -->",
            "",
            "## Proposed Changes",
            "",
            "```diff",
            unifiedDiff,
            "```",
        ];

        if (values["Notes"])
        {
            sections.push("", "### Notes", "", values["Notes"]);
        }

        return sections.join("\n");
    }

    /**
     * Builds the issue body for a create action with full YAML content.
     *
     * @param yamlPath - The target file path.
     * @param afterYaml - The serialized YAML content.
     * @param values - The wizard values for optional notes.
     * @returns The formatted issue body string.
     */
    function buildCreateBody(yamlPath, afterYaml, values)
    {
        const diffText = window.YamlBuilder.computeDiff("", afterYaml);

        const sections = [
            `<!-- yaml-path: ${yamlPath} -->`,
            "<!-- yaml-action: create -->",
            "",
            "## Proposed Changes",
            "",
            "<details><summary>View diff</summary>",
            "",
            "```diff",
            diffText,
            "```",
            "",
            "</details>",
            "",
            "### Full YAML",
            "",
            "```yaml",
            afterYaml.trimEnd(),
            "```",
        ];

        if (values["Notes"])
        {
            sections.push("", "### Notes", "", values["Notes"]);
        }

        const body = sections.join("\n");
        const maxBodyLength = 7500;

        if (body.length > maxBodyLength)
        {
            const trimmedSections = [
                `<!-- yaml-path: ${yamlPath} -->`,
                "<!-- yaml-action: create -->",
                "",
                "## Proposed Changes",
                "",
                "*Diff preview omitted due to size constraints.*",
                "",
                "### Full YAML",
                "",
                "```yaml",
                afterYaml.trimEnd(),
                "```",
            ];

            if (values["Notes"])
            {
                trimmedSections.push("", "### Notes", "", values["Notes"]);
            }

            return trimmedSections.join("\n");
        }

        return body;
    }

    /**
     * Builds the target YAML data object based on the flow type.
     *
     * @param flow - The active flow definition.
     * @param values - The current field values keyed by header.
     * @param currentValues - The loaded genus/species data for update flows, or null.
     * @param selectedSpecies - The selected species object for update-species, or null.
     * @returns The target data object.
     */
    function buildTargetData(flow, values, currentValues, selectedSpecies)
    {
        const currentData = currentValues && currentValues._loaded
            ? stripInternalKeys(currentValues)
            : null;

        switch (flow.label)
        {
            case "Add Genus":
                return window.YamlBuilder.buildNewGenus(values);

            case "Add Species":
                return window.YamlBuilder.addSpeciesToGenus(currentData ?? {}, values);

            case "Update Genus":
                return window.YamlBuilder.applyGenusUpdate(currentData ?? {}, values);

            case "Update Species":
            {
                const speciesName = selectedSpecies ? selectedSpecies.name : (values["Species name"] ?? "");

                return window.YamlBuilder.applySpeciesUpdate(currentData ?? {}, speciesName, values);
            }

            case "Taxonomy":
                return window.YamlBuilder.applyTaxonomyUpdate(currentData ?? {}, values["Proposed parent clade"] ?? "", values);

            default:
                return {};
        }
    }

    /**
     * Removes internal keys (prefixed with underscore) and build-computed
     * keys from a data object so it can be serialized cleanly.
     *
     * @param data - The data object to clean.
     * @returns A new object without internal or computed keys.
     */
    function stripInternalKeys(data)
    {
        const computedKeys = new Set(["taxonomy"]);
        const result = {};

        for (const key of Object.keys(data))
        {
            if (!key.startsWith("_") && !computedKeys.has(key))
            {
                result[key] = data[key];
            }
        }

        return result;
    }

    /**
     * Builds a plain text body for the Propose Update flow.
     *
     * @param flow - The active flow definition.
     * @param values - The current field values keyed by header.
     * @returns The formatted issue body string.
     */
    function buildProposalBody(flow, values)
    {
        const sections = [];

        for (const step of flow.steps)
        {
            for (const field of step.fields)
            {
                if (field.type === "readonly")
                {
                    continue;
                }

                const fieldValue = values[field.header];

                if (!fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0))
                {
                    continue;
                }

                const formatted = Array.isArray(fieldValue) ? fieldValue.join(", ") : fieldValue;

                sections.push(`### ${field.header}\n\n${formatted}`);
            }
        }

        return sections.join("\n\n");
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
