// Shared helpers for GitHub Actions workflow scripts.
// Used by process-issue.cjs and process-image.cjs.

const yaml = require("js-yaml");

/**
 * Parse a GitHub issue form body into a { header: value } map.
 * Issue forms render as "### Header\n\nValue" sections.  Fields that are
 * empty or contain the default "_No response_" placeholder are omitted.
 *
 * @param {string} body - The raw markdown body of the issue.
 *
 * @returns {Record<string, string>} Parsed field map keyed by header text.
 */
function parseIssueForm(body)
{
    const fields = {};
    const sections = body.split(/^### /m).filter(Boolean);

    for (const section of sections)
    {
        const [header, ...rest] = section.split("\n");
        const value = rest.join("\n").trim();

        if (value && value !== "_No response_")
        {
            fields[header.trim()] = value;
        }
    }

    return fields;
}

/**
 * Parse checked checkbox values from an issue form checkboxes field.
 *
 * @param {string | undefined} value - Raw checkbox markdown from the form.
 *
 * @returns {Array<string>} Label text for each checked box.
 */
function parseCheckboxes(value)
{
    if (!value)
    {
        return [];
    }

    return value
        .split("\n")
        .filter((line) => line.startsWith("- [X]") || line.startsWith("- [x]"))
        .map((line) => line.replace(/^- \[[xX]\]\s*/, "").trim())
        .filter(Boolean);
}

/**
 * Parse non-empty trimmed lines from a textarea field.
 *
 * @param {string | undefined} value - Raw textarea content.
 *
 * @returns {Array<string>} Non-empty lines.
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
 * Read an existing genus YAML file from the repo via the GitHub API.
 *
 * @param {object} github - Octokit instance provided by actions/github-script.
 * @param {{ owner: string, repo: string }} repo - Repository owner and name.
 * @param {string} genusName - Genus name (determines file path).
 *
 * @returns {Promise<{ filePath: string, sha: string, data: object } | null>}
 *   The parsed genus data with its file path and blob SHA, or null if the
 *   file does not exist.
 */
async function readGenusFile(github, repo, genusName)
{
    const letter = genusName.charAt(0).toUpperCase();
    const filePath = `genera/${letter}/${genusName}.yml`;

    let fileData;

    try
    {
        fileData = await github.rest.repos.getContent({
            owner: repo.owner,
            repo: repo.repo,
            path: filePath,
            ref: "main",
        });
    }
    catch
    {
        return null;
    }

    const content = Buffer.from(fileData.data.content, "base64").toString();
    const data = yaml.load(content);

    return { filePath, sha: fileData.data.sha, data };
}

/**
 * Create a branch, commit updated genus YAML, open a PR, label the issue,
 * and post a comment linking to the new PR.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {{ owner: string, repo: string }} options.repo - Repository coordinates.
 * @param {number} options.issueNumber - Originating issue number.
 * @param {string} options.issueAuthor - GitHub login of the issue author.
 * @param {string} options.genusName - Genus name (used in the branch name).
 * @param {string} options.filePath - Path to the genus YAML file.
 * @param {string} options.fileSha - Blob SHA of the existing file.
 * @param {object} options.genusData - Updated genus data to serialize.
 * @param {string} options.branchPrefix - Prefix for the new branch name.
 * @param {string} options.prTitle - Pull request title (also used in the commit).
 * @param {string} options.prBody - Pull request body text.
 */
async function createUpdatePR({
    github,
    repo,
    issueNumber,
    issueAuthor,
    genusName,
    filePath,
    fileSha,
    genusData,
    branchPrefix,
    prTitle,
    prBody,
})
{
    const branchName = `${branchPrefix}/${genusName.toLowerCase()}-${issueNumber}`;

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

    const updatedYaml = yaml.dump(genusData, { lineWidth: -1, quotingType: '"' });

    await github.rest.repos.createOrUpdateFileContents({
        owner: repo.owner,
        repo: repo.repo,
        path: filePath,
        message: `${prTitle}\n\nCloses #${issueNumber}`,
        content: Buffer.from(updatedYaml).toString("base64"),
        sha: fileSha,
        branch: branchName,
    });

    const pr = await github.rest.pulls.create({
        owner: repo.owner,
        repo: repo.repo,
        title: prTitle,
        body: `${prBody}\n\nCloses #${issueNumber}\n\nSubmitted by @${issueAuthor}`,
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

/**
 * Post an error comment on an issue and optionally add a label.
 *
 * @param {object} github - Octokit instance.
 * @param {{ owner: string, repo: string }} repo - Repository coordinates.
 * @param {number} issueNumber - Issue to comment on.
 * @param {string} message - Error message (a ❌ prefix is added automatically).
 * @param {string} [label] - Optional label to add to the issue.
 */
async function commentError(github, repo, issueNumber, message, label)
{
    await github.rest.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        body: `❌ ${message}`,
    });

    if (label)
    {
        await github.rest.issues.addLabels({
            owner: repo.owner,
            repo: repo.repo,
            issue_number: issueNumber,
            labels: [label],
        });
    }
}

module.exports = {
    parseIssueForm,
    parseCheckboxes,
    parseLines,
    readGenusFile,
    createUpdatePR,
    commentError,
};
