/**
 * Modal dialog component for displaying Wikipedia import results.
 * Shows extracted fields with individual "Add" buttons and an "Add All"
 * option. Built entirely via DOM APIs — no innerHTML.
 */
window.ImportModal = (function ()
{
    "use strict";

    const maxPreviewLength = 200;

    /**
     * Shows the import results modal with extracted field data.
     * Each field row has an "Add" button that calls the onAccept callback.
     *
     * @param results - Object keyed by wizard field header with value/source/fieldType.
     * @param onAccept - Callback invoked with (header, value) when a field is accepted.
     * @param articleTitle - The Wikipedia article title for the subtitle link.
     */
    function show(results, onAccept, articleTitle)
    {
        hide();

        const headers = Object.keys(results);

        if (headers.length === 0)
        {
            showError(articleTitle);
            return;
        }

        const overlay = cloneTemplate("tmpl-import-modal");
        overlay.querySelector(".import-title").textContent = "Import Results";

        const subtitle = overlay.querySelector(".import-subtitle");

        if (articleTitle)
        {
            subtitle.textContent = `Data for "${articleTitle}" from PBDB, Wikipedia, and Wikidata`;
        }

        const actionsTop = overlay.querySelector(".import-actions-top");
        const addAllButton = document.createElement("button");

        addAllButton.type = "button";
        addAllButton.className = "import-add-all";
        addAllButton.textContent = "Add All";

        addAllButton.addEventListener(
            "click",
            () =>
            {
                for (const header of headers)
                {
                    const row = overlay.querySelector(`[data-import-header="${header}"]`);

                    if (row && !row.classList.contains("accepted"))
                    {
                        onAccept(header, results[header].value);
                        markAccepted(row);
                    }
                }

                hide();
            },
        );

        actionsTop.appendChild(addAllButton);

        const resultsContainer = overlay.querySelector(".import-results");

        for (const header of headers)
        {
            const entry = results[header];
            const row = cloneTemplate("tmpl-import-row");

            row.dataset.importHeader = header;
            row.querySelector(".import-row-field").textContent = header;

            const valueSpan = row.querySelector(".import-row-value");
            const fullDisplay = entry.displayValue ?? entry.value;
            const displayValue = fullDisplay.length > maxPreviewLength
                ? fullDisplay.slice(0, maxPreviewLength) + "\u2026"
                : fullDisplay;

            valueSpan.textContent = displayValue;

            if (fullDisplay.length > maxPreviewLength)
            {
                valueSpan.title = fullDisplay;
                valueSpan.classList.add("truncated");

                valueSpan.addEventListener(
                    "click",
                    () =>
                    {
                        if (valueSpan.classList.contains("expanded"))
                        {
                            valueSpan.textContent = displayValue;
                            valueSpan.classList.remove("expanded");
                        }
                        else
                        {
                            valueSpan.textContent = fullDisplay;
                            valueSpan.classList.add("expanded");
                        }
                    },
                );
            }

            const sourceSpan = row.querySelector(".import-row-source");

            sourceSpan.textContent = entry.source;
            sourceSpan.classList.add(sourceClassForName(entry.source));

            const addButton = row.querySelector(".import-row-add");

            addButton.addEventListener(
                "click",
                () =>
                {
                    onAccept(header, entry.value);
                    markAccepted(row);
                },
            );

            resultsContainer.appendChild(row);
        }

        overlay.querySelector(".import-close").addEventListener("click", hide);

        overlay.addEventListener(
            "click",
            (event) =>
            {
                if (event.target === overlay)
                {
                    hide();
                }
            },
        );

        document.addEventListener("keydown", handleEscape);
        document.body.appendChild(overlay);
    }

    /**
     * Shows an error modal when no results are found for a genus.
     *
     * @param articleTitle - The searched article title.
     */
    function showError(articleTitle)
    {
        hide();

        const overlay = cloneTemplate("tmpl-import-modal");

        overlay.querySelector(".import-title").textContent = "No Results Found";
        overlay.querySelector(".import-subtitle").textContent =
            `Could not find Wikipedia data for "${articleTitle ?? "unknown"}". ` +
            "The genus may not have a Wikipedia article, or the page may use a different name.";

        overlay.querySelector(".import-close").addEventListener("click", hide);

        overlay.addEventListener(
            "click",
            (event) =>
            {
                if (event.target === overlay)
                {
                    hide();
                }
            },
        );

        document.addEventListener("keydown", handleEscape);
        document.body.appendChild(overlay);
    }

    /**
     * Removes the import modal from the DOM.
     */
    function hide()
    {
        const existing = document.querySelector(".import-overlay");

        if (existing)
        {
            existing.remove();
        }

        document.removeEventListener("keydown", handleEscape);
    }

    /**
     * Handles the Escape key to close the modal.
     *
     * @param event - The keyboard event.
     */
    function handleEscape(event)
    {
        if (event.key === "Escape")
        {
            hide();
        }
    }

    /**
     * Marks a result row as accepted by adding a visual checkmark
     * and disabling the Add button.
     *
     * @param row - The import row DOM element.
     */
    function markAccepted(row)
    {
        row.classList.add("accepted");

        const button = row.querySelector(".import-row-add");

        button.textContent = "\u2713";
        button.disabled = true;
        button.classList.add("accepted");
    }

    /**
     * Returns the CSS class name for a data source badge.
     *
     * @param source - The source name (e.g., "PBDB", "Wikipedia", "Wikidata").
     * @returns The CSS class string for styling the badge.
     */
    function sourceClassForName(source)
    {
        switch (source)
        {
            case "PBDB":
                return "source-pbdb";
            case "Wikipedia":
                return "source-wikipedia";
            default:
                return "source-wikidata";
        }
    }

    /**
     * Clones the first element from a template by its ID.
     *
     * @param id - The template element's ID attribute.
     * @returns A cloned Element from the template.
     */
    function cloneTemplate(id)
    {
        return document.getElementById(id).content.firstElementChild.cloneNode(true);
    }

    return {
        show: show,
        hide: hide,
    };
})();
