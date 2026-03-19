// Process image workflow script.
// Called by .github/workflows/process-image.yml via actions/github-script.
// Receives { github, context } from the workflow.

const path = require("path");
const { parseIssueForm, commentError } = require("./helpers.cjs");

/**
 * Entry point — validates and begins processing an image submission.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance from actions/github-script.
 * @param {object} options.context - GitHub Actions event context.
 */
module.exports = async function ({ github, context })
{
    const body = context.payload.issue.body;
    const issueNumber = context.payload.issue.number;
    const repo = context.repo;
    const fields = parseIssueForm(body);

    // Verify licensing attestation
    const checkedBoxes = body.match(/\[[xX]\]/g) ?? [];

    if (checkedBoxes.length < 3)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            "All three licensing attestation checkboxes must be checked. Please update the issue.",
            "needs-licensing",
        );
        return;
    }

    // Extract image URL from markdown
    const imageField = fields["Image"] ?? "";
    const imageMatch = imageField.match(/!\[.*?\]\((https:\/\/[^\s)]+)\)/);

    if (!imageMatch)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            "Could not find an image in the submission. Please paste or drag an image into the Image field.",
            "needs-info",
        );
        return;
    }

    const imageUrl = imageMatch[1];
    const taxonName = fields["Genus or clade name"];
    const description = fields["Description"] ?? "";
    const credit = fields["Credit"] ?? "";

    if (!taxonName || !description || !credit)
    {
        await commentError(
            github,
            repo,
            issueNumber,
            "Missing required fields (taxon name, description, or credit).",
        );
        return;
    }

    // Determine file extension from URL
    const urlPath = new URL(imageUrl).pathname;
    const ext = path.extname(urlPath) || ".jpg";
    const safeName = taxonName.replace(/\s+/g, "_");
    const safeDesc = description.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
    const fileName = `${safeName}_${safeDesc}${ext}`;

    await github.rest.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        body: `🔄 Processing image submission for ${taxonName}...`,
    });

    await github.rest.issues.addLabels({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        labels: ["in-progress"],
    });
};
