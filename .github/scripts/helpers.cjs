// Shared helpers for GitHub Actions workflow scripts.

const YAML = require("yaml");

/**
 * Extract patch metadata from HTML comment markers in the issue body.
 * Returns null if the issue is not in patch format.
 *
 * @param {string} body - The raw markdown body of the issue.
 * @returns {{ path: string, action: string } | null} The extracted metadata, or null.
 */
function extractPatchMeta(body)
{
    const pathMatch = body.match(/<!--\s*yaml-path:\s*(.+?)\s*-->/);
    const actionMatch = body.match(/<!--\s*yaml-action:\s*(.+?)\s*-->/);

    if (!pathMatch || !actionMatch)
    {
        return null;
    }

    return {
        path: pathMatch[1].trim(),
        action: actionMatch[1].trim(),
    };
}

/**
 * Extract the full YAML content from a fenced ```yaml code block
 * in the issue body.
 *
 * @param {string} body - The raw markdown body of the issue.
 * @returns {string | null} The extracted YAML string, or null if not found.
 */
function extractYamlBlock(body)
{
    const match = body.match(/```yaml\n([\s\S]*?)```/);

    if (!match)
    {
        return null;
    }

    return match[1].trim();
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
    const data = YAML.parse(content);

    return { filePath, sha: fileData.data.sha, content, data };
}

/**
 * Create a branch, commit YAML content, open a PR, label the issue,
 * and post a comment linking to the new PR.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {{ owner: string, repo: string }} options.repo - Repository coordinates.
 * @param {number} options.issueNumber - Originating issue number.
 * @param {string} options.issueAuthor - GitHub login of the issue author.
 * @param {string} options.filePath - Path to the genus YAML file.
 * @param {string | undefined} options.fileSha - Blob SHA of the existing file (for updates).
 * @param {string} options.yamlContent - The YAML string to commit.
 * @param {string} options.branchName - Branch name for the PR.
 * @param {string} options.prTitle - Pull request title (also used in the commit).
 * @param {string} options.prBody - Pull request body text.
 */
async function createPR({
    github,
    repo,
    issueNumber,
    issueAuthor,
    filePath,
    fileSha,
    yamlContent,
    branchName,
    prTitle,
    prBody,
})
{
    const mainRef = await github.rest.git.getRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: "heads/main",
    });

    try
    {
        await github.rest.git.deleteRef({
            owner: repo.owner,
            repo: repo.repo,
            ref: `heads/${branchName}`,
        });
    }
    catch
    {
        // Branch does not exist yet — nothing to delete
    }

    await github.rest.git.createRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: `refs/heads/${branchName}`,
        sha: mainRef.data.object.sha,
    });

    const commitOptions = {
        owner: repo.owner,
        repo: repo.repo,
        path: filePath,
        message: `${prTitle}\n\nCloses #${issueNumber}`,
        content: Buffer.from(yamlContent).toString("base64"),
        branch: branchName,
        committer: {
            name: issueAuthor,
            email: `${issueAuthor}@users.noreply.github.com`,
        },
    };

    if (fileSha)
    {
        commitOptions.sha = fileSha;
    }

    await github.rest.repos.createOrUpdateFileContents(commitOptions);

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
        labels: ["In Progress"],
    });

    await github.rest.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        body: `\u2705 PR created: ${pr.data.html_url}`,
    });
}

/**
 * Post an error comment on an issue and optionally add a label.
 *
 * @param {object} github - Octokit instance.
 * @param {{ owner: string, repo: string }} repo - Repository coordinates.
 * @param {number} issueNumber - Issue to comment on.
 * @param {string} message - Error message (a cross mark prefix is added automatically).
 * @param {string} [label] - Optional label to add to the issue.
 */
async function commentError(github, repo, issueNumber, message, label)
{
    await github.rest.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issueNumber,
        body: `\u274C ${message}`,
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

/**
 * Extract the unified diff content from a fenced ```diff code block
 * in the issue body.
 *
 * @param {string} body - The raw markdown body of the issue.
 * @returns {string | null} The extracted diff string, or null if not found.
 */
function extractDiffBlock(body)
{
    const match = body.match(/```diff\n([\s\S]*?)```/);

    if (!match)
    {
        return null;
    }

    return match[1].trim();
}

/**
 * Apply a unified diff patch to the original file content. Parses hunk
 * headers and applies changes in reverse order to preserve line numbers.
 * Throws if context lines do not match the original (conflict detection).
 *
 * @param {string} originalContent - The original file content.
 * @param {string} diffContent - The unified diff string.
 * @returns {string} The patched file content.
 */
function applyPatch(originalContent, diffContent)
{
    const lines = originalContent.split("\n");
    const diffLines = diffContent.split("\n");

    // Parse hunks from the diff
    const hunks = [];
    let currentHunk = null;

    for (const diffLine of diffLines)
    {
        const hunkMatch = diffLine.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);

        if (hunkMatch)
        {
            currentHunk = {
                originalStart: parseInt(hunkMatch[1], 10),
                originalCount: parseInt(hunkMatch[2], 10),
                newStart: parseInt(hunkMatch[3], 10),
                newCount: parseInt(hunkMatch[4], 10),
                lines: [],
            };

            hunks.push(currentHunk);
            continue;
        }

        // Skip file headers
        if (diffLine.startsWith("--- ") || diffLine.startsWith("+++ "))
        {
            continue;
        }

        if (currentHunk && (diffLine.startsWith(" ") || diffLine.startsWith("-") || diffLine.startsWith("+")))
        {
            currentHunk.lines.push(diffLine);
        }
    }

    // Apply hunks in reverse order to preserve line numbers
    for (let index = hunks.length - 1; index >= 0; index--)
    {
        const hunk = hunks[index];
        const startIndex = hunk.originalStart - 1;

        // Verify context lines and build replacement
        const replacement = [];
        let originalOffset = 0;

        for (const hunkLine of hunk.lines)
        {
            const prefix = hunkLine.charAt(0);
            const content = hunkLine.slice(1);

            if (prefix === " ")
            {
                const originalLine = lines[startIndex + originalOffset];

                if (originalLine !== content)
                {
                    throw new Error(
                        `Context mismatch at line ${startIndex + originalOffset + 1}: ` +
                        `expected "${content}" but found "${originalLine}". ` +
                        "The file may have been modified since this issue was created.",
                    );
                }

                replacement.push(content);
                originalOffset++;
            }
            else if (prefix === "-")
            {
                const originalLine = lines[startIndex + originalOffset];

                if (originalLine !== content)
                {
                    throw new Error(
                        `Remove mismatch at line ${startIndex + originalOffset + 1}: ` +
                        `expected "${content}" but found "${originalLine}". ` +
                        "The file may have been modified since this issue was created.",
                    );
                }

                originalOffset++;
            }
            else if (prefix === "+")
            {
                replacement.push(content);
            }
        }

        lines.splice(startIndex, hunk.originalCount, ...replacement);
    }

    return lines.join("\n");
}

/** Fields whose integer values should retain a trailing .0 suffix. */
const floatFields = new Set(["from_ma", "to_ma", "length_m", "hip_height_m", "skull_length_m"]);

/** Fields whose string values should always be double-quoted. */
const quotedFields = new Set(["pages", "doi", "isbn"]);

/**
 * Serializes a data object to YAML with formatting conventions matching
 * the contribution wizard: lineWidth 72, flow-style coordinates,
 * quoted pages/doi/isbn, and .0 on float fields.
 *
 * @param {object} data - The object to serialize.
 * @returns {string} The YAML string.
 */
function serializeYaml(data)
{
    const document = new YAML.Document(data);

    YAML.visit(document, {
        Pair(key, pair)
        {
            const name = pair.key?.value;

            if (name === "coordinates" && YAML.isSeq(pair.value))
            {
                pair.value.flow = true;
            }

            if (quotedFields.has(name) && YAML.isScalar(pair.value) && typeof pair.value.value === "string")
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

module.exports = {
    extractPatchMeta,
    extractYamlBlock,
    extractDiffBlock,
    readGenusFile,
    createPR,
    applyPatch,
    commentError,
    serializeYaml,
};
