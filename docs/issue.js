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
        if (flow.label === "Add Clade")
        {
            const cladeName = values["Clade name"] ?? "";
            const cladePath = window.YamlBuilder.cladeFilePath(cladeName);
            const cladeData = buildTargetData(flow, values, currentValues, selectedSpecies);
            const cladeYaml = window.YamlBuilder.serializeYaml(cladeData);

            return buildCladeCreateBody(cladePath, cladeYaml, values);
        }

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

        return sections.join("\n");
    }

    /**
     * Builds the issue body for a create-clade action with full YAML
     * content and tree-parent metadata.
     *
     * @param yamlPath - The target clade file path.
     * @param afterYaml - The serialized clade YAML content.
     * @param values - The wizard values for optional notes.
     * @returns The formatted issue body string.
     */
    function buildCladeCreateBody(yamlPath, afterYaml, values)
    {
        const diffText = window.YamlBuilder.computeDiff("", afterYaml);
        const treeParent = values["Parent clade"] ?? "";

        const sections = [
            `<!-- yaml-path: ${yamlPath} -->`,
            "<!-- yaml-action: create-clade -->",
            `<!-- tree-parent: ${treeParent} -->`,
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

        return sections.join("\n");
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
            case "Add Clade":
                return window.YamlBuilder.buildNewClade(values);

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
     * Builds a short issue URL with only the title and label, omitting
     * the body so the URL stays well under GitHub's size limit.
     *
     * @param flow - The active flow definition.
     * @param values - The current field values keyed by header.
     * @returns The encoded GitHub issue URL string without a body parameter.
     */
    function buildShortUrl(flow, values)
    {
        const title = `${flow.titlePrefix}${values[flow.titleField] ?? ""}`;

        return `${repoUrl}/issues/new?labels=${encodeURIComponent(flow.label)}&title=${encodeURIComponent(title)}`;
    }

    /**
     * Builds the issue body string from the current wizard state.
     *
     * @param flow - The active flow definition.
     * @param values - The current field values keyed by header.
     * @param currentValues - The loaded genus/species data for update flows, or null.
     * @param selectedSpecies - The selected species object for update-species, or null.
     * @returns The issue body string.
     */
    function buildBody(flow, values, currentValues, selectedSpecies)
    {
        if (flow.label === "Proposal")
        {
            return buildProposalBody(flow, values);
        }

        return buildPatchBody(flow, values, currentValues, selectedSpecies);
    }

    /**
     * Builds the issue URL from the current wizard state and opens it
     * in a new browser tab. When the full URL exceeds GitHub's size
     * limit, copies the body to the clipboard and opens a short URL
     * without the body parameter.
     *
     * @returns A promise that resolves when the issue tab is opened.
     */
    async function submit()
    {
        const wizard = window._wizard;
        const flow = wizard.getFlow();
        const values = wizard.getValues();
        const currentValues = wizard.getCurrentValues();
        const selectedSpecies = wizard.getSelectedSpecies();

        const url = buildUrl(flow, values, currentValues, selectedSpecies);
        const maxUrlLength = 7500;

        if (url.length <= maxUrlLength)
        {
            window.open(url, "_blank");

            return;
        }

        const body = buildBody(flow, values, currentValues, selectedSpecies);

        try
        {
            await navigator.clipboard.writeText(body);
        }
        catch
        {
            window.open(url, "_blank");

            return;
        }

        window.open(buildShortUrl(flow, values), "_blank");
        showClipboardNotice();
    }

    /**
     * Displays a temporary notice telling the user to paste the issue
     * body from the clipboard.
     */
    function showClipboardNotice()
    {
        const existing = document.getElementById("clipboard-notice");

        if (existing)
        {
            existing.remove();
        }

        const notice = document.createElement("div");

        notice.id = "clipboard-notice";
        notice.className = "clipboard-notice";
        notice.textContent = "Issue body copied to clipboard \u2014 paste it into the GitHub issue body field.";

        const dismiss = document.createElement("button");

        dismiss.type = "button";
        dismiss.className = "clipboard-notice-dismiss";
        dismiss.textContent = "\u2715";
        dismiss.addEventListener("click", () => notice.remove());

        notice.appendChild(dismiss);
        document.body.appendChild(notice);

        setTimeout(() => notice.remove(), 15000);
    }

    return {
        buildUrl: buildUrl,
        submit: submit,
    };
})();
