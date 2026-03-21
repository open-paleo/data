/**
 * Wizard engine — renders steps, handles navigation, validation,
 * searchable dropdowns, conditional fields, and review step.
 *
 * All DOM is built via <template> cloning, createElement, and
 * textContent — no innerHTML or HTML string concatenation.
 */
(function ()
{
    "use strict";

    const landing = document.getElementById("landing");
    const wizardSection = document.getElementById("wizard");
    const stepContainer = document.getElementById("wizard-step");
    const stepIndicator = document.getElementById("step-indicator");
    const back = document.getElementById("btn-back");
    const next = document.getElementById("btn-next");

    let flow = null;
    let stepIndex = 0;
    let values = {};
    let currentValues = {};
    let selectedSpecies = null;

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

    /**
     * Creates an option element with the given value and display text.
     *
     * @param value - The option's value attribute.
     * @param text - The visible text content.
     * @returns The created option element.
     */
    function createOption(value, text)
    {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = text;

        return option;
    }

    /**
     * Returns the total number of steps including the review step.
     *
     * @returns The step count (flow steps + 1 for review).
     */
    function getTotalSteps()
    {
        return flow.steps.length + 1;
    }

    /**
     * Returns whether the current step is the review step.
     *
     * @returns True if on the review step.
     */
    function isReview()
    {
        return stepIndex === flow.steps.length;
    }

    // Boot: load data then attach click handlers to flow cards
    window.OpenPaleo
        .initialize()
        .then(
            () =>
            {
                for (const card of document.querySelectorAll(".card[data-flow]"))
                {
                    card.addEventListener("click", () => startFlow(card.dataset.flow));
                }
            },
        )
        .catch((error) => console.error("Failed to load data:", error));

    /**
     * Starts a new wizard flow, resetting all state and rendering
     * the first step.
     *
     * @param flowId - The flow identifier (e.g., "add-genus").
     */
    function startFlow(flowId)
    {
        flow = window.Flows.get(flowId);

        if (flow)
        {
            stepIndex = 0;
            values = {};
            currentValues = {};
            selectedSpecies = null;
            landing.hidden = true;
            wizardSection.hidden = false;
            renderStep();
            pushState();
        }
    }

    /**
     * Returns to the landing page, clearing all wizard state.
     */
    function returnToLanding()
    {
        wizardSection.hidden = true;
        landing.hidden = false;
        flow = null;
    }

    // Navigation

    back.addEventListener("click", () => history.back());

    next.addEventListener(
        "click",
        () =>
        {
            if (!isReview())
            {
                saveCurrentInputs();

                if (validateStep())
                {
                    stepIndex++;
                    renderStep();
                    pushState();
                }
            }
        },
    );

    // History management

    /**
     * Pushes the current wizard state (flow and step) onto the browser
     * history stack so the back/forward buttons navigate between steps.
     */
    function pushState()
    {
        history.pushState({ flowId: flow.label, stepIndex: stepIndex }, "");
    }

    /**
     * Handles browser back/forward navigation by restoring the wizard
     * to the state stored in the history entry.
     *
     * @param event - The popstate event with the saved state.
     */
    window.addEventListener(
        "popstate",
        (event) =>
        {
            if (!event.state)
            {
                returnToLanding();
                return;
            }

            const restoredFlow = window.Flows.get(event.state.flowId);

            if (!restoredFlow)
            {
                returnToLanding();
                return;
            }

            if (flow)
            {
                saveCurrentInputs();
            }

            if (flow !== restoredFlow)
            {
                flow = restoredFlow;
                landing.hidden = true;
                wizardSection.hidden = false;
            }

            stepIndex = event.state.stepIndex;
            renderStep();
        },
    );

    /**
     * Reads all input values from the current step's DOM and saves them
     * into the values object keyed by field header.
     */
    function saveCurrentInputs()
    {
        if (flow && !isReview())
        {
            const step = flow.steps[stepIndex];

            for (const field of step.fields)
            {
                if (field.type === "checkboxes")
                {
                    const checked = Array
                        .from(stepContainer.querySelectorAll(`input[data-header="${field.header}"]`))
                        .filter((checkbox) => checkbox.checked)
                        .map((checkbox) => checkbox.value);

                    values[field.header] = checked.length > 0 ? checked : "";
                }
                else if (field.type !== "readonly")
                {
                    const input = stepContainer.querySelector(`[data-header="${field.header}"]`);

                    if (input)
                    {
                        values[field.header] = input.value.trim();
                    }
                }
            }
        }
    }

    /**
     * Validates all visible fields on the current step. Checks required
     * fields for presence and runs format validation on non-empty fields
     * that have a validate rule. Marks invalid fields with "has-error".
     *
     * @returns True if all fields pass validation.
     */
    function validateStep()
    {
        const step = flow.steps[stepIndex];
        let valid = true;

        for (const field of step.fields)
        {
            if (!isFieldVisible(field))
            {
                continue;
            }

            const fieldValue = values[field.header];
            const fieldInput = stepContainer.querySelector(`[data-header="${field.header}"]`);

            const wrapper = fieldInput ? fieldInput.closest(".field") : null;

            const error = wrapper ? wrapper.querySelector(".field-error") : null;

            const isEmpty = !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0);

            if (field.required && isEmpty)
            {
                setFieldError(wrapper, error, "This field is required");
                valid = false;
                continue;
            }

            if (!isEmpty && field.validate)
            {
                const validationError = validateFieldValue(field.validate, fieldValue);

                if (validationError)
                {
                    setFieldError(wrapper, error, validationError);
                    valid = false;
                    continue;
                }
            }

            if (wrapper)
            {
                wrapper.classList.remove("has-error");
            }
        }

        return valid;
    }

    /**
     * Marks a field wrapper as having an error and sets the error message.
     *
     * @param wrapper - The .field wrapper element.
     * @param error - The .field-error span element.
     * @param message - The error message to display.
     */
    function setFieldError(wrapper, error, message)
    {
        if (wrapper)
        {
            wrapper.classList.add("has-error");
        }

        if (error)
        {
            error.textContent = message;
        }
    }

    /**
     * Runs format validation on a field value based on its validation rule.
     *
     * @param rule - The validation rule name (e.g., "coordinates", "positiveNumber", "year").
     * @param value - The field value to validate.
     * @returns An error message string if invalid, or null if valid.
     */
    function validateFieldValue(rule, value)
    {
        switch (rule)
        {
            case "coordinates":
            {
                const parts = String(value).split(",").map((part) => part.trim());

                if (parts.length !== 2)
                {
                    return "Enter as latitude, longitude (e.g., 47.5, -106.9)";
                }

                const latitude = Number(parts[0]);
                const longitude = Number(parts[1]);

                if (isNaN(latitude) || isNaN(longitude))
                {
                    return "Coordinates must be numbers";
                }
                else if (latitude < -90 || latitude > 90)
                {
                    return "Latitude must be between -90 and 90";
                }
                else if (longitude < -180 || longitude > 180)
                {
                    return "Longitude must be between -180 and 180";
                }

                return null;
            }

            case "positiveNumber":
            {
                const number = Number(value);

                if (isNaN(number) || number <= 0)
                {
                    return "Must be a positive number";
                }

                return null;
            }

            case "year":
            {
                const year = Number(value);

                if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear())
                {
                    return `Enter a valid year (1800\u2013${new Date().getFullYear()})`;
                }

                return null;
            }

            case "newGenus":
            {
                if (window.OpenPaleo.getGenus(String(value).trim()))
                {
                    return `"${value}" already exists in the dataset — use the Update Genus flow instead`;
                }

                return null;
            }

            case "identifiers":
            {
                const knownSources = window.OpenPaleo.getIdentifierSources();
                const lines = String(value).split("\n").filter((line) => line.trim() !== "");
                const problems = [];

                for (const line of lines)
                {
                    const colonIndex = line.indexOf(":");

                    if (colonIndex < 0)
                    {
                        problems.push(`"${line.trim()}" is missing a colon — expected format: source: id`);
                    }
                    else
                    {
                        const source = line.slice(0, colonIndex).trim();
                        const identifier = line.slice(colonIndex + 1).trim();

                        if (!source || !identifier)
                        {
                            problems.push(`"${line.trim()}" is missing a source or id`);
                        }
                        else if (knownSources.length > 0 && !knownSources.includes(source))
                        {
                            problems.push(`Unknown source "${source}" — known sources: ${knownSources.join(", ")}`);
                        }
                    }
                }

                return problems.length > 0 ? problems.join("\n") : null;
            }
        }

        return null;
    }

    /**
     * Determines whether a field should be visible based on its
     * showWhen condition and the current values.
     *
     * @param field - The field definition to check.
     * @returns True if the field should be displayed.
     */
    function isFieldVisible(field)
    {
        if (!field.showWhen)
        {
            return true;
        }

        const condition = field.showWhen;
        const fieldValue = values[condition.field] ?? "";

        if (condition.value)
        {
            return fieldValue === condition.value;
        }
        else if (condition.notEmpty)
        {
            return fieldValue !== "" && fieldValue !== condition.notValue;
        }

        return true;
    }

    /**
     * Renders the current step into the wizard container, including all
     * fields, and initializes interactive behaviors (search dropdowns,
     * conditionals, period filtering, genus loading).
     */
    function renderStep()
    {
        stepIndicator.textContent = `Step ${stepIndex + 1} of ${getTotalSteps()}`;
        back.textContent = stepIndex === 0 ? "\u2190 Flows" : "\u2190 Back";

        if (isReview())
        {
            renderReview();

            next.style.display = "none";
        }
        else
        {
            next.className = "nav-btn nav-btn-primary";
            next.style.display = "";
            next.textContent = stepIndex === flow.steps.length - 1 ? "Review \u2192" : "Next \u2192";

            const step = flow.steps[stepIndex];

            const heading = document.createElement("h3");
            heading.textContent = step.name;

            const fragment = document.createDocumentFragment();
            fragment.appendChild(heading);

            for (const field of step.fields)
            {
                fragment.appendChild(renderField(field));

                if (flow.importable && stepIndex === 0 && field.header === flow.titleField)
                {
                    fragment.appendChild(createImportButton());
                }
            }

            stepContainer.replaceChildren(fragment);

            restoreValues(step);

            initializeSearchDropdowns();
            initializeConditionals(step);
            initializePeriodFilter(step);
            initializeGenusLoadOnSelect(step);
            initializeSpeciesDropdown(step);
        }
    }

    /**
     * Builds a DOM element for a single form field, including its label,
     * current-value hint (for update flows), input element, and error message.
     *
     * @param field - The field definition to render.
     * @returns The field wrapper element.
     */
    function renderField(field)
    {
        const wrapper = cloneTemplate("tmpl-field");
        wrapper.dataset.fieldHeader = field.header;

        if (field.required)
        {
            wrapper.classList.add("field-required");
        }

        if (!isFieldVisible(field))
        {
            wrapper.style.display = "none";
        }

        wrapper.querySelector("label").textContent = field.header;

        if (field.currentKey && currentValues._loaded)
        {
            const currentValue = getCurrentValue(field.currentKey);

            if (currentValue)
            {
                const hint = document.createElement("span");

                hint.className = "current-value";
                const displayHint = field.optionsKey === "countries"
                    ? countryDisplayName(currentValue)
                    : currentValue;
                hint.textContent = `Current: ${displayHint}`;

                wrapper.querySelector("label").after(hint);
            }
        }

        if (field.validate === "identifiers")
        {
            const sources = window.OpenPaleo.getIdentifierSources();

            if (sources.length > 0)
            {
                const hint = document.createElement("span");

                hint.className = "field-hint";
                hint.textContent = `Known sources: ${sources.join(", ")}`;

                wrapper.querySelector("label").after(hint);
            }
        }

        const inputElement = createFieldInput(field);

        if (field.required)
        {
            const target = inputElement.querySelector("input") ?? inputElement;

            if (target.setAttribute)
            {
                target.setAttribute("aria-required", "true");
            }
        }

        wrapper.querySelector(".field-error").before(inputElement);

        return wrapper;
    }

    /**
     * Creates the input element for a form field based on its type
     * (text, number, textarea, select, search, checkboxes, or readonly).
     *
     * @param field - The field definition from the flow.
     * @returns The created DOM element.
     */
    function createFieldInput(field)
    {
        switch (field.type)
        {
            case "text":
            case "number":
            {
                const input = document.createElement("input");

                input.type = field.type;
                input.dataset.header = field.header;

                if (field.placeholder)
                {
                    input.placeholder = field.placeholder;
                }

                return input;
            }

            case "textarea":
            {
                const textarea = document.createElement("textarea");
                textarea.dataset.header = field.header;

                if (field.placeholder)
                {
                    textarea.placeholder = field.placeholder;
                }

                return textarea;
            }

            case "select":
            {
                const select = document.createElement("select");

                select.dataset.header = field.header;
                select.appendChild(createOption("", "-- Select --"));

                for (const option of getFieldOptions(field))
                {
                    select.appendChild(createOption(option, option));
                }

                return select;
            }

            case "search":
            {
                const dropdown = cloneTemplate("tmpl-search-dropdown");
                const input = dropdown.querySelector("input");
                const list = dropdown.querySelector(".search-dropdown-list");

                input.dataset.header = field.header;
                input.placeholder = field.placeholder ?? "Type to search...";
                input.setAttribute("role", "combobox");
                input.setAttribute("aria-autocomplete", "list");
                input.setAttribute("aria-expanded", "false");
                list.setAttribute("role", "listbox");

                return dropdown;
            }

            case "checkboxes":
            {
                const group = document.createElement("div");
                group.className = "checkbox-group";

                for (const option of getFieldOptions(field))
                {
                    const label = document.createElement("label");

                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.dataset.header = field.header;
                    checkbox.value = option;

                    label.appendChild(checkbox);
                    label.append(` ${option}`);

                    group.appendChild(label);
                }

                return group;
            }

            case "readonly":
            {
                const div = document.createElement("div");

                div.className = "readonly-value";
                div.dataset.header = field.header;
                div.textContent = currentValues._loaded
                    ? (getCurrentValue(field.currentKey) ?? "(not set)")
                    : "(select a genus first)";

                return div;
            }
        }

        return document.createElement("div");
    }

    /**
     * Resolves the options array for a field based on its optionsKey,
     * pulling from the schema or dataset as appropriate.
     *
     * @param field - The field definition with an optionsKey.
     * @returns A sorted array of option strings.
     */
    function getFieldOptions(field)
    {
        switch (field.optionsKey)
        {
            case "genera":
                return Object.keys(window.OpenPaleo.getGenera()).sort();
            case "clades":
                return window.OpenPaleo.getClades();
            case "_species":
                return [];

            case "countries":
            {
                const map = window.OpenPaleo.getSchemaValues("countries") ?? {};
                return Object.values(map).sort();
            }

            case "stages":
            {
                if (field.filteredByPeriod)
                {
                    const period = values["Period"] ?? "";

                    if (period)
                    {
                        return window.OpenPaleo.getStagesForPeriod(period);
                    }

                    return Object.keys(window.OpenPaleo.getSchemaValues("stages") ?? {}).sort();
                }

                return window.OpenPaleo.getSchemaValues(field.optionsKey);
            }
        }

        return window.OpenPaleo.getSchemaValues(field.optionsKey);
    }

    /**
     * Returns a display-name-to-stored-value mapping for fields where
     * the displayed option differs from the persisted value (e.g. countries
     * show full names but store ISO codes). Returns null for fields where
     * display and stored values are identical.
     *
     * @param field - The field definition.
     * @returns A map of display name to stored value, or null.
     */
    function getFieldValueMap(field)
    {
        if (field.optionsKey === "countries")
        {
            const map = window.OpenPaleo.getSchemaValues("countries") ?? {};
            const result = {};

            for (const [code, name] of Object.entries(map))
            {
                result[name] = code;
            }

            return result;
        }

        return null;
    }

    /**
     * Resolves an ISO country code to its display name using the schema.
     *
     * @param code - The ISO 3166-1 alpha-2 country code.
     * @returns The country display name, or the code itself if not found.
     */
    function countryDisplayName(code)
    {
        const map = window.OpenPaleo.getSchemaValues("countries") ?? {};
        return map[code] ?? code;
    }

    /**
     * Restores previously saved values into the current step's DOM inputs.
     *
     * @param step - The step definition whose fields should be restored.
     */
    function restoreValues(step)
    {
        for (const field of step.fields)
        {
            if (field.type === "readonly")
            {
                continue;
            }

            const saved = values[field.header];

            if (saved === undefined || saved === "")
            {
                continue;
            }

            if (field.type === "checkboxes" && Array.isArray(saved))
            {
                for (const checkedValue of saved)
                {
                    const checkbox = Array.from(
                        stepContainer.querySelectorAll(`input[data-header="${field.header}"]`),
                    ).find((input) => input.value === checkedValue);

                    if (checkbox)
                    {
                        checkbox.checked = true;
                    }
                }
            }
            else
            {
                const fieldInput = stepContainer.querySelector(`[data-header="${field.header}"]`);

                if (fieldInput)
                {
                    fieldInput.value = field.optionsKey === "countries"
                        ? countryDisplayName(saved)
                        : saved;
                }
            }
        }
    }

    /**
     * Sets up searchable dropdown behavior on all search-type fields
     * in the current step. Provides keyboard navigation, substring
     * filtering, and click/enter selection.
     */
    function initializeSearchDropdowns()
    {
        for (const wrapper of stepContainer.querySelectorAll(".search-dropdown"))
        {
            const input = wrapper.querySelector("input");
            const list = wrapper.querySelector(".search-dropdown-list");
            const header = input.dataset.header;
            const field = findFieldDefinition(header);

            if (!field)
            {
                continue;
            }

            const allOptions = getFieldOptions(field);
            const valueMap = getFieldValueMap(field);
            let activeIndex = -1;

            /**
             * Renders the filtered option list into the dropdown.
             *
             * @param filter - The current input text to filter by.
             */
            function render(filter)
            {
                const filtered = filter
                    ? allOptions.filter((option) => option.toLowerCase().includes(filter.toLowerCase()))
                    : allOptions;

                list.replaceChildren();
                activeIndex = -1;

                for (const option of filtered.slice(0, 50))
                {
                    const listItem = document.createElement("li");

                    listItem.textContent = option;
                    listItem.setAttribute("role", "option");
                    listItem.addEventListener(
                        "mousedown",
                        (event) =>
                        {
                            event.preventDefault();
                            selectOption(option);
                        });

                    list.appendChild(listItem);
                }

                const isOpen = filtered.length > 0;
                list.classList.toggle("open", isOpen);
                input.setAttribute("aria-expanded", String(isOpen));
            }

            /**
             * Selects a value from the dropdown, updating the input and
             * closing the list. When a valueMap exists (e.g. countries),
             * the input shows the display name but the stored value is
             * the mapped code.
             *
             * @param displayValue - The displayed option string.
             */
            function selectOption(displayValue)
            {
                input.value = displayValue;
                values[header] = valueMap ? (valueMap[displayValue] ?? displayValue) : displayValue;
                list.classList.remove("open");
                input.setAttribute("aria-expanded", "false");
                input.dispatchEvent(new Event("change", { bubbles: true }));
            }

            input.addEventListener("focus", () => render(input.value));
            input.addEventListener("input", () => render(input.value));
            input.addEventListener(
                "blur",
                () => setTimeout(
                    () =>
                    {
                        list.classList.remove("open");
                        input.setAttribute("aria-expanded", "false");
                    },
                    150));

            input.addEventListener(
                "keydown",
                (event) =>
                {
                    const items = list.querySelectorAll("li");

                    switch (event.key)
                    {
                        case "ArrowDown":
                            event.preventDefault();
                            activeIndex = Math.min(activeIndex + 1, items.length - 1);
                            updateActive(items);
                            break;

                        case "ArrowUp":
                            event.preventDefault();
                            activeIndex = Math.max(activeIndex - 1, 0);
                            updateActive(items);
                            break;

                        case "Enter":
                            event.preventDefault();

                            if (activeIndex >= 0 && items[activeIndex])
                            {
                                selectOption(items[activeIndex].textContent);
                            }

                            break;

                        case "Escape":
                            list.classList.remove("open");
                            break;
                    }
                },
            );

            /**
             * Updates the visual "active" highlight on dropdown items.
             *
             * @param items - The NodeList of list item elements.
             */
            function updateActive(items)
            {
                for (let index = 0; index < items.length; index++)
                {
                    items[index].classList.toggle("active", index === activeIndex);
                }

                if (items[activeIndex])
                {
                    items[activeIndex].scrollIntoView({ block: "nearest" });
                }
            }
        }
    }

    /**
     * Attaches change/input listeners to trigger fields so that
     * conditional fields (showWhen) are shown or hidden dynamically.
     *
     * @param step - The step definition containing conditional fields.
     */
    function initializeConditionals(step)
    {
        for (const field of step.fields)
        {
            if (!field.showWhen)
            {
                continue;
            }

            const trigger = field.showWhen.field;
            const triggerInput = stepContainer.querySelector(`[data-header="${trigger}"]`);

            if (!triggerInput)
            {
                continue;
            }

            function update()
            {
                values[trigger] = triggerInput.value.trim();

                const wrapper = stepContainer.querySelector(`[data-field-header="${field.header}"]`);

                if (wrapper)
                {
                    wrapper.style.display = isFieldVisible(field) ? "" : "none";
                }
            }

            triggerInput.addEventListener("change", update);
            triggerInput.addEventListener("input", update);
        }
    }

    /**
     * Sets up period-to-stage filtering: when the Period dropdown changes,
     * the Stage dropdown is repopulated with only matching stages.
     *
     * @param step - The step definition to search for a filteredByPeriod field.
     */
    function initializePeriodFilter(step)
    {
        const stageField = step.fields.find((field) => field.filteredByPeriod);

        if (stageField)
        {
            const selectPeriod = stepContainer.querySelector("[data-header=\"Period\"]");
            const selectStage = stepContainer.querySelector(`[data-header="${stageField.header}"]`);

            if (selectPeriod && selectStage)
            {
                /**
                 * Rebuilds the stage dropdown options for the currently selected period.
                 */
                function updateStages()
                {
                    const period = selectPeriod.value;
                    const stages = period ? window.OpenPaleo.getStagesForPeriod(period) : [];
                    const current = selectStage.value;

                    selectStage.replaceChildren(createOption("", "-- Select --"));

                    for (const stage of stages)
                    {
                        const option = createOption(stage, stage);

                        if (stage === current)
                        {
                            option.selected = true;
                        }

                        selectStage.appendChild(option);
                    }
                }

                selectPeriod.addEventListener("change", updateStages);

                if (values["Period"])
                {
                    updateStages();
                }
            }
        }
    }

    /**
     * For update flows, attaches a change listener to the genus search
     * field so that selecting a genus loads its current data into
     * currentValues for pre-population and comparison.
     *
     * @param step - The step definition to search for a loadOnSelect field.
     */
    function initializeGenusLoadOnSelect(step)
    {
        const field = step.fields.find((field) => field.loadOnSelect);

        if (field)
        {
            const input = stepContainer.querySelector(`[data-header="${field.header}"]`);

            if (!input)
            {
                return;
            }

            input.addEventListener(
                "change",
                () =>
                {
                    const genus = window.OpenPaleo.getGenus(input.value.trim());

                    if (genus)
                    {
                        currentValues = genus;
                        currentValues._loaded = true;
                        selectedSpecies = null;

                        // Update readonly fields on this step
                        for (const field of step.fields)
                        {
                            if (field.type === "readonly" && field.currentKey)
                            {
                                const wrapper = stepContainer.querySelector(`[data-field-header="${field.header}"]`);

                                if (wrapper)
                                {
                                    wrapper.querySelector(".readonly-value").textContent = getCurrentValue(field.currentKey) ?? "(not set)";
                                }
                            }
                        }

                        prePopulateFromCurrent();
                        updateSpeciesOptions();
                    }
                });
        }
    }

    /**
     * For the update-species flow, attaches a change listener to the
     * species dropdown so that selecting a species sets the selectedSpecies
     * object for current-value resolution.
     *
     * @param step - The step definition to search for a _species field.
     */
    function initializeSpeciesDropdown(step)
    {
        const field = step.fields.find((field) => field.optionsKey === "_species");

        if (field)
        {
            const select = stepContainer.querySelector(`[data-header="${field.header}"]`);

            if (select)
            {
                select.addEventListener(
                    "change",
                    () =>
                    {
                        if (currentValues._loaded && currentValues.species)
                        {
                            selectedSpecies = currentValues.species.find(
                                (species) => species.name === select.value) ?? null;

                            prePopulateFromCurrent();
                        }
                    });

                if (currentValues._loaded)
                {
                    updateSpeciesOptions();
                }
            }
        }
    }

    /**
     * Pre-populates the values object with current data for all fields
     * that have a currentKey. For update flows, this seeds each field
     * with its existing value so the user edits in place and only
     * changed fields are included in the issue.
     */
    function prePopulateFromCurrent()
    {
        if (!currentValues._loaded)
        {
            return;
        }

        for (const step of flow.steps)
        {
            for (const field of step.fields)
            {
                if (!field.currentKey || field.type === "readonly")
                {
                    continue;
                }
                else if (field.currentKey.startsWith("species.") && !selectedSpecies)
                {
                    continue;
                }

                const current = getCurrentValue(field.currentKey);

                if (current == null || current === "")
                {
                    continue;
                }
                else if (field.type === "checkboxes")
                {
                    values[field.header] = current.split(", ");
                }
                else
                {
                    values[field.header] = current;
                }
            }
        }
    }

    /**
     * Populates the species dropdown with species from the currently
     * selected genus, and restores any previous selection.
     */
    function updateSpeciesOptions()
    {
        const select = stepContainer.querySelector("[data-header=\"Species name\"]");

        if (select && select.tagName === "SELECT")
        {
            select.replaceChildren(createOption("", "-- Select --"));

            const species = currentValues.species ?? [];

            for (const entry of species)
            {
                select.appendChild(createOption(entry.name, entry.name));
            }

            if (values["Species name"])
            {
                select.value = values["Species name"];
                selectedSpecies = species.find((entry) => entry.name === values["Species name"]) ?? null;
            }
        }
    }

    /**
     * Resolves the current value for a field from the loaded genus/species
     * data using a dotted key path (e.g., "species.period.name", "parent",
     * "appearance.features").
     *
     * @param key - The dotted key path into the genus or species data.
     * @returns The resolved value as a display string, or null if not found.
     */
    function getCurrentValue(key)
    {
        if (!currentValues._loaded)
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

            case "pronunciation.ipa":
                return currentValues.pronunciation && currentValues.pronunciation.ipa
                    ? currentValues.pronunciation.ipa
                    : null;

            case "pronunciation.phonetic":
                return currentValues.pronunciation && currentValues.pronunciation.phonetic
                    ? currentValues.pronunciation.phonetic
                    : null;

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
     * Renders the review step showing all filled fields in a table,
     * a URL length warning if needed, and the submit button.
     */
    function renderReview()
    {
        const isUpdate = flow.isUpdate;
        const fragment = document.createDocumentFragment();

        const heading = document.createElement("h3");
        heading.textContent = "Review & Submit";
        fragment.appendChild(heading);

        const table = document.createElement("table");
        table.className = "review-table";
        const tbody = document.createElement("tbody");

        const filledFields = getFilledFields();

        if (filledFields.length === 0)
        {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.textContent = "No fields filled";
            row.appendChild(cell);
            tbody.appendChild(row);
        }

        for (const item of filledFields)
        {
            const row = cloneTemplate("tmpl-review-row");

            if (isUpdate && item.changed)
            {
                row.classList.add("changed");
            }

            row.querySelector("th").textContent = item.header;
            row.querySelector("td").textContent = item.display;
            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        fragment.appendChild(table);

        const url = window.IssueBuilder.buildUrl(
            flow,
            values,
            isUpdate ? currentValues : null,
            selectedSpecies,
        );

        if (url.length > 7500)
        {
            const warning = document.createElement("div");

            warning.className = "url-warning";
            warning.textContent = `Warning: The issue URL is approaching GitHub\u2019s ~8KB limit (${url.length} characters). Consider shortening some text fields.`;

            fragment.appendChild(warning);
        }

        const submitRow = document.createElement("div");
        submitRow.className = "submit-row";

        const submitButton = document.createElement("button");
        submitButton.className = "submit-btn";
        submitButton.type = "button";
        submitButton.textContent = "Open GitHub Issue";
        submitButton.addEventListener("click", () => window.IssueBuilder.submit());

        submitRow.appendChild(submitButton);

        fragment.appendChild(submitRow);

        stepContainer.replaceChildren(fragment);
    }

    /**
     * Collects all fields that have values, for display in the review step.
     * For update flows, only fields whose values differ from the current
     * dataset values are included.
     *
     * @returns An array of { header, value, display, changed } objects.
     */
    function getFilledFields()
    {
        const result = [];
        const isUpdate = flow.isUpdate;

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

                let display = Array.isArray(fieldValue) ? fieldValue.join(", ") : fieldValue;

                if (field.optionsKey === "countries")
                {
                    display = countryDisplayName(fieldValue);
                }

                let changed = false;

                if (isUpdate && field.currentKey)
                {
                    const currentValueText = getCurrentValue(field.currentKey) ?? "";
                    const compareValue = Array.isArray(fieldValue) ? fieldValue.join(", ") : String(fieldValue);
                    changed = compareValue !== currentValueText;

                    if (!changed)
                    {
                        continue;
                    }
                }

                result.push({
                    header: field.header,
                    value: fieldValue,
                    display: display,
                    changed: changed,
                });
            }
        }

        return result;
    }

    // Expose wizard state for issue.js
    window._wizard = {
        getFlow: () => flow,
        getValues: () => values,
        getCurrentValues: () => currentValues,
        getSelectedSpecies: () => selectedSpecies,
        getFilledFields: getFilledFields,
    };

    /**
     * Creates the "Import from Wikipedia" button element with its click handler.
     * Shows a loading spinner during fetch, then opens the import modal.
     *
     * @returns The button DOM element.
     */
    function createImportButton()
    {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "import-btn";

        const icon = document.createElement("span");

        icon.className = "material-symbols-outlined";
        icon.textContent = "download";

        button.appendChild(icon);
        button.append(" Import");

        button.addEventListener(
            "click",
            async () =>
            {
                const nameInput = stepContainer.querySelector("[data-header=\"Genus name\"]");
                const genusName = nameInput ? nameInput.value.trim() : "";

                if (!genusName)
                {
                    const wrapper = nameInput ? nameInput.closest(".field") : null;
                    const error = wrapper ? wrapper.querySelector(".field-error") : null;

                    setFieldError(wrapper, error, "Enter a genus name before importing");
                    return;
                }

                icon.textContent = "progress_activity";
                button.classList.add("loading");
                button.disabled = true;

                try
                {
                    const results = await window.Wikipedia.fetchGenus(genusName);

                    window.ImportModal.show(
                        results,
                        (header, value) =>
                        {
                            setFieldValue(header, value);
                        },
                        genusName,
                    );
                }
                catch (fetchError)
                {
                    console.error("Wikipedia import failed:", fetchError);

                    window.ImportModal.show({}, null, genusName);
                }
                finally
                {
                    icon.textContent = "download";
                    button.classList.remove("loading");
                    button.disabled = false;
                }
            },
        );

        return button;
    }

    /**
     * Sets a field value in the wizard state and updates the DOM input
     * if the field is on the currently displayed step.
     *
     * @param header - The field header identifying which field to set.
     * @param value - The value to assign.
     */
    function setFieldValue(header, value)
    {
        values[header] = value;

        const input = stepContainer.querySelector(`[data-header="${header}"]`);

        if (input)
        {
            const field = findFieldDefinition(header);
            input.value = field && field.optionsKey === "countries"
                ? countryDisplayName(value)
                : value;
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    /**
     * Searches all flow steps for a field definition matching the given header.
     *
     * @param header - The field header string to find.
     * @returns The field definition object, or null if not found.
     */
    function findFieldDefinition(header)
    {
        if (flow)
        {
            for (const step of flow.steps)
            {
                for (const field of step.fields)
                {
                    if (field.header === header)
                    {
                        return field;
                    }
                }
            }
        }

        return null;
    }
})();
