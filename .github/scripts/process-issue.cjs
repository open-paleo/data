// Process issue workflow script.
// Called by .github/workflows/process-issue.yml via actions/github-script.
// Receives { github, context } from the workflow.

const yaml = require("js-yaml");
const {
    parseIssueForm,
    parseCheckboxes,
    parseLines,
    readGenusFile,
    createUpdatePR,
    commentError,
} = require("./helpers.cjs");

/**
 * Entry point — dispatches to the appropriate handler based on issue labels.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance from actions/github-script.
 * @param {object} options.context - GitHub Actions event context.
 */
module.exports = async function ({ github, context })
{
    const body = context.payload.issue.body;
    const labels = context.payload.issue.labels.map((label) => label.name);
    const issueNumber = context.payload.issue.number;
    const issueAuthor = context.payload.issue.user.login;
    const repo = context.repo;
    const fields = parseIssueForm(body);

    if (labels.includes("add-genus"))
    {
        await handleAddGenus({ github, repo, issueNumber, issueAuthor, fields });
    }

    if (labels.includes("correct-taxonomy"))
    {
        await handleCorrectTaxonomy({ github, repo, issueNumber, issueAuthor, fields });
    }

    if (labels.includes("update-genus"))
    {
        await handleUpdateGenus({ github, repo, issueNumber, issueAuthor, fields });
    }

    if (labels.includes("add-species"))
    {
        await handleAddSpecies({ github, repo, issueNumber, issueAuthor, fields });
    }

    if (labels.includes("update-species"))
    {
        await handleUpdateSpecies({ github, repo, issueNumber, issueAuthor, fields });
    }
};

// Handler: add-genus

/**
 * Create a new genus file and open a PR for it.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {{ owner: string, repo: string }} options.repo - Repository coordinates.
 * @param {number} options.issueNumber - Originating issue number.
 * @param {string} options.issueAuthor - GitHub login of the issue author.
 * @param {Record<string, string>} options.fields - Parsed issue form fields.
 */
async function handleAddGenus({ github, repo, issueNumber, issueAuthor, fields })
{
    const genusName = fields["Genus name"];

    if (!genusName)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            "Could not parse genus name from the issue. Please check the form and resubmit.",
            "needs-info",
        );
        return;
    }

    const letter = genusName.charAt(0).toUpperCase();
    const filePath = `genera/${letter}/${genusName}.yml`;

    const genusData = {
        genus: genusName,
        parent: fields["Parent clade"] ?? "",
        description: fields["Genus description"] ?? "",
        diet: (fields["Diet"] ?? "").toLowerCase(),
    };

    if (fields["Genus etymology"])
    {
        genusData.etymology = fields["Genus etymology"];
    }

    if (fields["Locomotion"])
    {
        genusData.locomotion = fields["Locomotion"].toLowerCase();
    }

    // Integument
    if (fields["Integument"] || fields["Integument evidence"])
    {
        genusData.appearance = {};

        if (fields["Integument"])
        {
            genusData.appearance.integument = fields["Integument"].toLowerCase();
        }

        if (fields["Integument evidence"])
        {
            genusData.appearance.evidence = fields["Integument evidence"].toLowerCase();
        }
    }

    // Appearance features
    const appearanceFeatures = parseLines(fields["Appearance features"]);

    if (appearanceFeatures.length > 0)
    {
        if (!genusData.appearance)
        {
            genusData.appearance = {};
        }

        genusData.appearance.features = appearanceFeatures;
    }

    // Diagnostic features
    const diagnosticFeatures = parseLines(fields["Diagnostic features"]);

    if (diagnosticFeatures.length > 0)
    {
        genusData.diagnostic_features = diagnosticFeatures;
    }

    // Paleoenvironment
    const paleoenvironments = parseCheckboxes(fields["Paleoenvironment"]);

    if (paleoenvironments.length > 0)
    {
        genusData.paleoenvironment = paleoenvironments;
    }

    // External identifiers
    const identifiers = parseLines(fields["External identifiers"]);

    if (identifiers.length > 0)
    {
        genusData.identifiers = identifiers;
    }

    const species = buildSpeciesFromFields(fields, {
        nameField: "Type species name",
        fallbackName: `${genusName} sp.`,
        forceStatus: "valid",
        forceTypeSpecies: true,
    });

    genusData.species = [species];

    // Create branch and PR directly (new file — no existing SHA)
    const branchName = `genus/${genusName.toLowerCase()}`;

    const mainRef = await github.rest.git.getRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: "heads/main",
    });

    await github.rest.git.createRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: `refs/heads/${branchName}`,
        sha: mainRef.data.object.sha,
    });

    const yamlContent = yaml.dump(genusData, { lineWidth: -1, quotingType: '"' });

    await github.rest.repos.createOrUpdateFileContents({
        owner: repo.owner,
        repo: repo.repo,
        path: filePath,
        message: `Add ${genusName}\n\nCloses #${issueNumber}`,
        content: Buffer.from(yamlContent).toString("base64"),
        branch: branchName,
        committer: {
            name: issueAuthor,
            email: `${issueAuthor}@users.noreply.github.com`,
        },
    });

    const pr = await github.rest.pulls.create({
        owner: repo.owner,
        repo: repo.repo,
        title: `Add genus: ${genusName}`,
        body: `Adds ${genusName} to the dataset.\n\nCloses #${issueNumber}\n\nSubmitted by @${issueAuthor}`,
        head: branchName,
        base: "main",
    });

    await github.rest.issues.addLabels({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        labels: ["in-progress"],
    });

    await github.rest.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        body: `✅ PR created: ${pr.data.html_url}`,
    });
}

// Handler: correct-taxonomy

/**
 * Update a genus' parent clade and open a PR for the reclassification.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {{ owner: string, repo: string }} options.repo - Repository coordinates.
 * @param {number} options.issueNumber - Originating issue number.
 * @param {string} options.issueAuthor - GitHub login of the issue author.
 * @param {Record<string, string>} options.fields - Parsed issue form fields.
 */
/**
 * Builds the PR body for a correct-taxonomy PR, including reference and notes
 * if provided.
 *
 * @param {string} genusName - The genus being reclassified.
 * @param {string} newParent - The proposed new parent clade.
 * @param {number} issueNumber - Originating issue number.
 * @param {string} issueAuthor - GitHub login of the issue author.
 * @param {Record<string, string>} fields - Parsed issue form fields.
 * @returns {string} The formatted PR body.
 */
function buildTaxonomyPrBody(genusName, newParent, issueNumber, issueAuthor, fields)
{
    const lines = [`Reclassifies ${genusName} to ${newParent}.`];

    if (fields["Reference / source"])
    {
        lines.push("", `**Reference:** ${fields["Reference / source"]}`);
    }

    if (fields["Notes"])
    {
        lines.push("", `**Notes:** ${fields["Notes"]}`);
    }

    lines.push("", `Closes #${issueNumber}`, "", `Submitted by @${issueAuthor}`);

    return lines.join("\n");
}

async function handleCorrectTaxonomy({ github, repo, issueNumber, issueAuthor, fields })
{
    const genusName = fields["Genus name"];
    const newParent = fields["Proposed parent clade"];

    if (!genusName || !newParent)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            "Missing required fields. Please check the form and resubmit.",
        );
        return;
    }

    const genusFile = await readGenusFile(github, repo, genusName);

    if (!genusFile)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            `Genus file not found: genera/${genusName.charAt(0).toUpperCase()}/${genusName}.yml`,
        );
        return;
    }

    const { filePath, sha, data: genusData } = genusFile;
    genusData.parent = newParent;

    const updatedYaml = yaml.dump(genusData, { lineWidth: -1, quotingType: '"' });
    const branchName = `fix/${genusName.toLowerCase()}-taxonomy`;

    const mainRef = await github.rest.git.getRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: "heads/main",
    });

    await github.rest.git.createRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: `refs/heads/${branchName}`,
        sha: mainRef.data.object.sha,
    });

    await github.rest.repos.createOrUpdateFileContents({
        owner: repo.owner,
        repo: repo.repo,
        path: filePath,
        message: `Reclassify ${genusName} under ${newParent}\n\nCloses #${issueNumber}`,
        content: Buffer.from(updatedYaml).toString("base64"),
        sha,
        branch: branchName,
    });

    const pr = await github.rest.pulls.create({
        owner: repo.owner,
        repo: repo.repo,
        title: `Reclassify ${genusName} → ${newParent}`,
        body: buildTaxonomyPrBody(genusName, newParent, issueNumber, issueAuthor, fields),
        head: branchName,
        base: "main",
    });

    await github.rest.issues.addLabels({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        labels: ["in-progress"],
    });

    await github.rest.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        body: `✅ PR created: ${pr.data.html_url}`,
    });
}

// Handler: update-genus

/**
 * Update genus-level metadata fields and open a PR.  Replace-fields
 * (description, diet, locomotion, integument) overwrite the existing value.
 * Additive-fields (paleoenvironment, features, identifiers) are merged.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {{ owner: string, repo: string }} options.repo - Repository coordinates.
 * @param {number} options.issueNumber - Originating issue number.
 * @param {string} options.issueAuthor - GitHub login of the issue author.
 * @param {Record<string, string>} options.fields - Parsed issue form fields.
 */
async function handleUpdateGenus({ github, repo, issueNumber, issueAuthor, fields })
{
    const genusName = fields["Genus name"];

    if (!genusName)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            "Could not parse genus name from the issue. Please check the form and resubmit.",
        );
        return;
    }

    const genusFile = await readGenusFile(github, repo, genusName);

    if (!genusFile)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            `Genus file not found: genera/${genusName.charAt(0).toUpperCase()}/${genusName}.yml`,
        );
        return;
    }

    const { filePath, sha, data: genusData } = genusFile;

    // Replace fields
    if (fields["Description"])
    {
        genusData.description = fields["Description"];
    }

    if (fields["Diet"])
    {
        genusData.diet = fields["Diet"].toLowerCase();
    }

    if (fields["Locomotion"])
    {
        genusData.locomotion = fields["Locomotion"].toLowerCase();
    }

    // Integument (replace within appearance object)
    if (fields["Integument"] || fields["Integument evidence"])
    {
        if (!genusData.appearance)
        {
            genusData.appearance = {};
        }

        if (fields["Integument"])
        {
            genusData.appearance.integument = fields["Integument"].toLowerCase();
        }

        if (fields["Integument evidence"])
        {
            genusData.appearance.evidence = fields["Integument evidence"].toLowerCase();
        }
    }

    // Additive merge: paleoenvironment
    const newEnvs = parseCheckboxes(fields["Paleoenvironment"]);

    if (newEnvs.length > 0)
    {
        if (!genusData.paleoenvironment)
        {
            genusData.paleoenvironment = [];
        }

        for (const env of newEnvs)
        {
            if (!genusData.paleoenvironment.includes(env))
            {
                genusData.paleoenvironment.push(env);
            }
        }
    }

    // Additive merge: appearance features
    const newAppFeatures = parseLines(fields["Appearance features"]);

    if (newAppFeatures.length > 0)
    {
        if (!genusData.appearance)
        {
            genusData.appearance = {};
        }

        if (!genusData.appearance.features)
        {
            genusData.appearance.features = [];
        }

        for (const feat of newAppFeatures)
        {
            if (!genusData.appearance.features.includes(feat))
            {
                genusData.appearance.features.push(feat);
            }
        }
    }

    // Additive merge: diagnostic features
    const newDiagFeatures = parseLines(fields["Diagnostic features"]);

    if (newDiagFeatures.length > 0)
    {
        if (!genusData.diagnostic_features)
        {
            genusData.diagnostic_features = [];
        }

        for (const feat of newDiagFeatures)
        {
            if (!genusData.diagnostic_features.includes(feat))
            {
                genusData.diagnostic_features.push(feat);
            }
        }
    }

    // Additive merge: external identifiers
    const newIds = parseLines(fields["External identifiers"]);

    if (newIds.length > 0)
    {
        if (!genusData.identifiers)
        {
            genusData.identifiers = [];
        }

        for (const line of newIds)
        {
            const [source, ...idParts] = line.split(":");
            const id = idParts.join(":").trim();

            if (source && id)
            {
                const exists = genusData.identifiers.some(
                    (entry) => entry.source === source.trim() && entry.id === id,
                );

                if (!exists)
                {
                    genusData.identifiers.push({ source: source.trim(), id });
                }
            }
        }
    }

    await createUpdatePR({
        github,
        repo,
        issueNumber,
        issueAuthor,
        genusName,
        filePath,
        fileSha: sha,
        genusData,
        branchPrefix: "update",
        prTitle: `Update ${genusName}`,
        prBody: `Updates metadata for ${genusName}.`,
    });
}

// Handler: add-species

/**
 * Add a new species to an existing genus and open a PR.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {{ owner: string, repo: string }} options.repo - Repository coordinates.
 * @param {number} options.issueNumber - Originating issue number.
 * @param {string} options.issueAuthor - GitHub login of the issue author.
 * @param {Record<string, string>} options.fields - Parsed issue form fields.
 */
async function handleAddSpecies({ github, repo, issueNumber, issueAuthor, fields })
{
    const genusName = fields["Genus name"];
    const speciesName = fields["Species name"];

    if (!genusName || !speciesName)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            "Missing required fields (genus name or species name). Please check the form and resubmit.",
        );
        return;
    }

    const genusFile = await readGenusFile(github, repo, genusName);

    if (!genusFile)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            `Genus file not found: genera/${genusName.charAt(0).toUpperCase()}/${genusName}.yml`,
        );
        return;
    }

    const { filePath, sha, data: genusData } = genusFile;

    const species = buildSpeciesFromFields(fields, {
        nameField: "Species name",
    });

    if (!genusData.species)
    {
        genusData.species = [];
    }

    genusData.species.push(species);

    await createUpdatePR({
        github,
        repo,
        issueNumber,
        issueAuthor,
        genusName,
        filePath,
        fileSha: sha,
        genusData,
        branchPrefix: "species",
        prTitle: `Add species: ${speciesName}`,
        prBody: `Adds ${speciesName} to ${genusName}.`,
    });
}

// Handler: update-species

/**
 * Update metadata for an existing species and open a PR.  Only fields the
 * submitter fills in are overwritten; empty fields are left untouched.
 * Nested objects (period, location, size, holotype) are merged at the
 * property level so that filling in e.g. just "Country" does not erase
 * an existing "Region".
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {{ owner: string, repo: string }} options.repo - Repository coordinates.
 * @param {number} options.issueNumber - Originating issue number.
 * @param {string} options.issueAuthor - GitHub login of the issue author.
 * @param {Record<string, string>} options.fields - Parsed issue form fields.
 */
async function handleUpdateSpecies({ github, repo, issueNumber, issueAuthor, fields })
{
    const genusName = fields["Genus name"];
    const speciesName = fields["Species name"];

    if (!genusName || !speciesName)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            "Missing required fields (genus name or species name). Please check the form and resubmit.",
        );
        return;
    }

    const genusFile = await readGenusFile(github, repo, genusName);

    if (!genusFile)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            `Genus file not found: genera/${genusName.charAt(0).toUpperCase()}/${genusName}.yml`,
        );
        return;
    }

    const { filePath, sha, data: genusData } = genusFile;

    const speciesEntry = (genusData.species ?? []).find(
        (species) => species.name.toLowerCase() === speciesName.toLowerCase(),
    );

    if (!speciesEntry)
    {
        const available = (genusData.species ?? []).map((species) => species.name).join(", ") || "none";

        await commentError(
            github,
            repo,
            issueNumber,
            `Species "${speciesName}" not found in ${genusName}. Available species: ${available}`,
        );
        return;
    }

    // Scalar replace fields
    if (fields["Species etymology"])
    {
        speciesEntry.etymology = fields["Species etymology"];
    }

    if (fields["Status"])
    {
        speciesEntry.status = fields["Status"].toLowerCase();
    }

    if (fields["If synonym, synonym of"])
    {
        speciesEntry.synonym_of = fields["If synonym, synonym of"];
    }

    if (fields["Completeness"])
    {
        speciesEntry.completeness = fields["Completeness"].toLowerCase();
    }

    if (fields["Year described"])
    {
        speciesEntry.described = parseInt(fields["Year described"]);
    }

    if (fields["Authors"])
    {
        speciesEntry.authors = fields["Authors"];
    }

    if (fields["Species description"])
    {
        speciesEntry.description = fields["Species description"];
    }

    // Period — merge at the property level
    if (fields["Period"] || fields["Stage"])
    {
        if (!speciesEntry.period)
        {
            speciesEntry.period = {};
        }

        if (fields["Period"])
        {
            speciesEntry.period.name = fields["Period"];
        }

        if (fields["Stage"])
        {
            speciesEntry.period.stage = fields["Stage"];
        }
    }

    // Location — merge at the property level
    if (fields["Country"] || fields["Region"] || fields["Locality"] || fields["Formation"] || fields["Coordinates"])
    {
        if (!speciesEntry.location)
        {
            speciesEntry.location = {};
        }

        if (fields["Country"])
        {
            speciesEntry.location.country = fields["Country"];
        }

        if (fields["Region"])
        {
            speciesEntry.location.region = fields["Region"];
        }

        if (fields["Locality"])
        {
            speciesEntry.location.locality = fields["Locality"];
        }

        if (fields["Formation"])
        {
            speciesEntry.location.formation = fields["Formation"];
        }

        if (fields["Coordinates"])
        {
            const coords = fields["Coordinates"].split(",").map((value) => Number(value.trim()));

            if (coords.length === 2 && coords.every((value) => !isNaN(value)))
            {
                speciesEntry.location.coordinates = coords;
            }
        }
    }

    // Size — merge at the property level
    if (fields["Estimated length (m)"] || fields["Estimated weight (kg)"] || fields["Estimated hip height (m)"])
    {
        if (!speciesEntry.size)
        {
            speciesEntry.size = {};
        }

        if (fields["Estimated length (m)"])
        {
            speciesEntry.size.length_m = parseFloat(fields["Estimated length (m)"]);
        }

        if (fields["Estimated weight (kg)"])
        {
            speciesEntry.size.weight_kg = parseFloat(fields["Estimated weight (kg)"]);
        }

        if (fields["Estimated hip height (m)"])
        {
            speciesEntry.size.hip_height_m = parseFloat(fields["Estimated hip height (m)"]);
        }

        speciesEntry.size.estimate = true;
    }

    // Holotype — merge at the property level
    if (fields["Holotype specimen ID"] || fields["Holotype institution"] || fields["Holotype material"])
    {
        if (!speciesEntry.holotype)
        {
            speciesEntry.holotype = {};
        }

        if (fields["Holotype specimen ID"])
        {
            speciesEntry.holotype.specimen_id = fields["Holotype specimen ID"];
        }

        if (fields["Holotype institution"])
        {
            speciesEntry.holotype.institution = fields["Holotype institution"];
        }

        if (fields["Holotype material"])
        {
            speciesEntry.holotype.material = fields["Holotype material"];
        }
    }

    await createUpdatePR({
        github,
        repo,
        issueNumber,
        issueAuthor,
        genusName,
        filePath,
        fileSha: sha,
        genusData,
        branchPrefix: "species-update",
        prTitle: `Update species: ${speciesName}`,
        prBody: `Updates metadata for ${speciesName} in ${genusName}.`,
    });
}

// Shared species builder

/**
 * Build a species object from parsed issue form fields.  Used by both the
 * add-genus handler (for the type species) and the add-species handler.
 *
 * @param {Record<string, string>} fields - Parsed issue form fields.
 * @param {object} options
 * @param {string} options.nameField - Form field key that holds the species name.
 * @param {string} [options.fallbackName] - Name to use when the field is empty.
 * @param {string} [options.forceStatus] - Override the status instead of reading from the form.
 * @param {boolean} [options.forceTypeSpecies] - If true, set type_species to true.
 *
 * @returns {object} A species data object ready to append to a genus.
 */
function buildSpeciesFromFields(fields, { nameField, fallbackName, forceStatus, forceTypeSpecies })
{
    const species = {
        name: fields[nameField] ?? fallbackName,
        status: forceStatus ?? (fields["Status"] ?? "valid").toLowerCase(),
    };

    if (forceTypeSpecies)
    {
        species.type_species = true;
    }

    if (fields["Species etymology"])
    {
        species.etymology = fields["Species etymology"];
    }

    if (fields["If synonym, synonym of"])
    {
        species.synonym_of = fields["If synonym, synonym of"];
    }

    // Period
    const period = {};

    if (fields["Period"])
    {
        period.name = fields["Period"];
    }

    if (fields["Stage"])
    {
        period.stage = fields["Stage"];
    }

    if (Object.keys(period).length > 0)
    {
        species.period = period;
    }

    // Location
    const location = {};

    if (fields["Country"])
    {
        location.country = fields["Country"];
    }

    if (fields["Region"])
    {
        location.region = fields["Region"];
    }

    if (fields["Locality"])
    {
        location.locality = fields["Locality"];
    }

    if (fields["Formation"])
    {
        location.formation = fields["Formation"];
    }

    if (fields["Coordinates"])
    {
        const coords = fields["Coordinates"].split(",").map((value) => Number(value.trim()));

        if (coords.length === 2 && coords.every((value) => !isNaN(value)))
        {
            location.coordinates = coords;
        }
    }

    if (Object.keys(location).length > 0)
    {
        species.location = location;
    }

    // Size
    const size = {};

    if (fields["Estimated length (m)"])
    {
        size.length_m = parseFloat(fields["Estimated length (m)"]);
    }

    if (fields["Estimated weight (kg)"])
    {
        size.weight_kg = parseFloat(fields["Estimated weight (kg)"]);
    }

    if (fields["Estimated hip height (m)"])
    {
        size.hip_height_m = parseFloat(fields["Estimated hip height (m)"]);
    }

    if (Object.keys(size).length > 0)
    {
        size.estimate = true;
        species.size = size;
    }

    if (fields["Completeness"])
    {
        species.completeness = fields["Completeness"].toLowerCase();
    }

    if (fields["Year described"])
    {
        species.described = parseInt(fields["Year described"]);
    }

    if (fields["Authors"])
    {
        species.authors = fields["Authors"];
    }

    if (fields["Species description"])
    {
        species.description = fields["Species description"];
    }

    // Holotype
    const holotype = {};

    if (fields["Holotype specimen ID"])
    {
        holotype.specimen_id = fields["Holotype specimen ID"];
    }

    if (fields["Holotype institution"])
    {
        holotype.institution = fields["Holotype institution"];
    }

    if (fields["Holotype material"])
    {
        holotype.material = fields["Holotype material"];
    }

    if (Object.keys(holotype).length > 0)
    {
        species.holotype = holotype;
    }

    return species;
}
