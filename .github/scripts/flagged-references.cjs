// Posts or updates a sticky PR comment listing references that cite
// publishers or journals flagged in flagged-sources.yml. Invoked from
// the Validate workflow after `npm run validate` dumps its output to
// disk. Reviewers must acknowledge each flagged reference before merge.

const fs = require("node:fs");

const COMMENT_MARKER = "<!-- open-paleo:flagged-references -->";

/**
 * Parse validator output and extract flagged-source warnings.
 *
 * @param {string} output - Raw stdout captured from `npm run validate`.
 * @returns {Array<{ file: string, message: string }>} One entry per warning.
 */
function parseFlaggedWarnings(output)
{
    const lines = output.split(/\r?\n/);
    const warnings = [];
    let inFlaggedBlock = false;

    for (const line of lines)
    {
        if (/^[⚠✓✗].*Flagged publication sources/.test(line))
        {
            inFlaggedBlock = true;
            continue;
        }

        if (inFlaggedBlock)
        {
            const match = line.match(/^\s{2}(\S.+?):\s(.+)$/);

            if (match)
            {
                warnings.push({ file: match[1], message: match[2] });
                continue;
            }

            if (line.trim() === "" || /^[⚠✓✗]/.test(line) || /^Summary:/.test(line))
            {
                inFlaggedBlock = false;
            }
        }
    }

    return warnings;
}

/**
 * Build the markdown body for the sticky comment.
 *
 * @param {Array<{ file: string, message: string }>} warnings - Parsed warnings.
 * @returns {string} The full comment body.
 */
function buildCommentBody(warnings)
{
    const byFile = new Map();

    for (const warning of warnings)
    {
        if (!byFile.has(warning.file))
        {
            byFile.set(warning.file, []);
        }

        byFile.get(warning.file).push(warning.message);
    }

    const lines = [
        COMMENT_MARKER,
        "### ⚠️ Flagged publication sources",
        "",
        "This PR cites references from publishers or journals on "
            + "[`flagged-sources.yml`](../blob/main/flagged-sources.yml) — "
            + "Beall's list plus community-flagged additions. These citations "
            + "are **not blocked**, but a reviewer must confirm they are "
            + "acceptable before merge.",
        "",
    ];

    for (const [file, messages] of byFile)
    {
        lines.push(`**\`${file}\`**`);

        for (const message of messages)
        {
            lines.push(`- ${message}`);
        }

        lines.push("");
    }

    lines.push(
        "**Reviewer action:** Reply in this PR confirming that each flagged "
        + "citation is acceptable (widely cited, peer-reviewed in practice, "
        + "no red flags in the paper itself), or request that the contributor "
        + "substitute a non-flagged reference.",
    );

    return lines.join("\n");
}

/**
 * Find a previous flagged-references comment from this bot on the PR.
 *
 * @param {object} github - Octokit instance from actions/github-script.
 * @param {object} repo - { owner, repo } for the current repository.
 * @param {number} prNumber - Pull request number.
 * @returns {Promise<number | null>} The comment id, or null if none found.
 */
async function findExistingComment(github, repo, prNumber)
{
    const comments = await github.paginate(
        github.rest.issues.listComments,
        {
            owner: repo.owner,
            repo: repo.repo,
            issue_number: prNumber,
            per_page: 100,
        },
    );

    const existing = comments.find((comment) => comment.body.includes(COMMENT_MARKER));

    return existing ? existing.id : null;
}

/**
 * Upsert the sticky PR comment. Deletes any prior comment if there are
 * no flagged warnings in the latest run (so the comment reflects the
 * current state, not accumulated history).
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance from actions/github-script.
 * @param {object} options.context - actions/github-script context object.
 * @param {string} options.validatorOutputPath - Path to the captured validator stdout.
 */
async function run({ github, context, validatorOutputPath })
{
    const prNumber = context.payload.pull_request?.number;

    if (!prNumber)
    {
        console.log("Not running inside a pull_request event; skipping.");
        return;
    }

    if (!fs.existsSync(validatorOutputPath))
    {
        console.log(`Validator output not found at ${validatorOutputPath}; skipping.`);
        return;
    }

    const output = fs.readFileSync(validatorOutputPath, "utf8");
    const warnings = parseFlaggedWarnings(output);
    const repo = context.repo;
    const existingId = await findExistingComment(github, repo, prNumber);

    if (warnings.length === 0)
    {
        if (existingId)
        {
            await github.rest.issues.deleteComment({
                owner: repo.owner,
                repo: repo.repo,
                comment_id: existingId,
            });
            console.log("No flagged references — deleted stale comment.");
        }
        else
        {
            console.log("No flagged references — nothing to do.");
        }

        return;
    }

    const body = buildCommentBody(warnings);

    if (existingId)
    {
        await github.rest.issues.updateComment({
            owner: repo.owner,
            repo: repo.repo,
            comment_id: existingId,
            body,
        });
        console.log(`Updated flagged-references comment (${warnings.length} warnings).`);
    }
    else
    {
        await github.rest.issues.createComment({
            owner: repo.owner,
            repo: repo.repo,
            issue_number: prNumber,
            body,
        });
        console.log(`Posted flagged-references comment (${warnings.length} warnings).`);
    }
}

module.exports = run;
module.exports.parseFlaggedWarnings = parseFlaggedWarnings;
module.exports.buildCommentBody = buildCommentBody;
