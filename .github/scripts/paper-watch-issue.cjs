// Files (or updates) a GitHub issue summarizing the latest paper-watch run.
// Invoked from the Paper Watch workflow after `npm run paper-watch` writes
// its JSON output and the checklist it renders for the issue. Wraps that
// checklist in the issue header and opens one issue per run. Does nothing when
// the run found no new papers.

const fs = require("node:fs");

const commentMarker = "<!-- open-paleo:paper-watch -->";
const watchLabel = "Paper Watch";

/**
 * Builds the full issue body: the marker, an optional mention, the intro, and
 * the checklist paper-watch.ts rendered (grouped by the set of genera a paper
 * mentions, then clade-only matches).
 *
 * @param {Array<object>} hits - The paper-watch JSON output.
 * @param {string} items - The checklist markdown from `--issue-items`.
 * @param {string} date - The run date (ISO yyyy-mm-dd).
 * @param {string} mention - Optional @-handle(s) to notify (e.g. a team DL).
 * @returns {string} The markdown body.
 */
function buildIssueBody(hits, items, date, mention)
{
    const distinctGenera = new Set(hits.flatMap((hit) => hit.genera ?? [])).size;
    const lines = [commentMarker];

    if (mention)
    {
        lines.push(mention, "");
    }

    lines.push(
        `Automated digest from OpenAlex for **${date}** — ${hits.length} new paper(s) `
            + `across ${distinctGenera} genus/genera.`,
        "",
        "Tick a box once the paper has been triaged (`/update-genus`, "
            + "`/intake-genus`, or a `notable_specimens` entry). Short-name "
            + "homonyms and duplicate DOIs are already filtered.",
        "",
        items,
    );

    return lines.join("\n");
}

/**
 * Ensures the paper-watch label exists, creating it on first run.
 *
 * @param {object} github - Octokit instance from actions/github-script.
 * @param {{ owner: string, repo: string }} repo - Repository coordinates.
 */
async function ensureLabel(github, repo)
{
    try
    {
        await github.rest.issues.getLabel({
            owner: repo.owner,
            repo: repo.repo,
            name: watchLabel,
        });
    }
    catch
    {
        await github.rest.issues.createLabel({
            owner: repo.owner,
            repo: repo.repo,
            name: watchLabel,
            color: "1d76db",
            description: "Automated digest of new papers mentioning tracked taxa",
        });
    }
}

/**
 * Finds the open paper-watch issue for a date, so a same-day re-run updates
 * it instead of opening a duplicate. Matches on the title's date prefix: the
 * paper count that follows it changes when the re-run finds more papers.
 *
 * @param {object} github - Octokit instance.
 * @param {{ owner: string, repo: string }} repo - Repository coordinates.
 * @param {string} titlePrefix - The title up to the paper count,
 *     "Paper watch — <date> (".
 * @returns {Promise<number | null>} The issue number, or null if none.
 */
async function findExistingIssue(github, repo, titlePrefix)
{
    const issues = await github.paginate(github.rest.issues.listForRepo, {
        owner: repo.owner,
        repo: repo.repo,
        state: "open",
        labels: watchLabel,
        per_page: 100,
    });

    const existing = issues.find((issue) => issue.title.startsWith(titlePrefix));

    return existing ? existing.number : null;
}

/**
 * Entry point invoked by actions/github-script.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {object} options.context - actions/github-script context object.
 * @param {string} options.jsonPath - Path to the paper-watch JSON output.
 * @param {string} options.itemsPath - Path to the checklist from `--issue-items`.
 */
async function run({ github, context, jsonPath, itemsPath })
{
    if (!fs.existsSync(jsonPath))
    {
        console.log(`No paper-watch output at ${jsonPath}; skipping.`);
        return;
    }

    const hits = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    if (!Array.isArray(hits) || hits.length === 0)
    {
        console.log("No new papers this run; no issue filed.");
        return;
    }

    const repo = context.repo;
    // Anchor the digest date to Pacific time. GitHub dispatches scheduled runs
    // late (often hours), so a UTC date (toISOString) rolls to the next day for
    // evening-Pacific runs past midnight UTC, filing the issue off-by-one.
    // en-CA yields ISO yyyy-mm-dd; timeZone handles DST automatically.
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const titlePrefix = `Paper watch — ${date} (`;
    const title = `${titlePrefix}${hits.length} new paper${hits.length === 1 ? "" : "s"})`;

    // Two notification paths, both optional and configured via repo variables
    // so nothing is hardcoded. Assignees must be individual users (GitHub does
    // not allow assigning a team); a team/DL is reached by @-mentioning it in
    // the body via PAPER_WATCH_MENTION (e.g. "@open-paleo/paper-watch").
    const assignees = (process.env.PAPER_WATCH_ASSIGNEE ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    const mention = (process.env.PAPER_WATCH_MENTION ?? "").trim();

    const body = buildIssueBody(hits, fs.readFileSync(itemsPath, "utf8"), date, mention);

    await ensureLabel(github, repo);

    const existingNumber = await findExistingIssue(github, repo, titlePrefix);

    if (existingNumber)
    {
        await github.rest.issues.update({
            owner: repo.owner,
            repo: repo.repo,
            issue_number: existingNumber,
            title,
            body,
        });
        console.log(`Updated paper-watch issue #${existingNumber} (${hits.length} papers).`);
    }
    else
    {
        const issue = await github.rest.issues.create({
            owner: repo.owner,
            repo: repo.repo,
            title,
            body,
            labels: [watchLabel],
            assignees,
        });
        console.log(`Filed paper-watch issue #${issue.data.number} (${hits.length} papers).`);
    }
}

module.exports = run;
module.exports.buildIssueBody = buildIssueBody;
