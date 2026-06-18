// Files (or updates) a GitHub issue summarizing the latest paper-watch run.
// Invoked from the Paper Watch workflow after `npm run paper-watch` writes
// its JSON output. Reads reports/paper-watch.json, groups the hits by genus
// with triage checkboxes, and opens one issue per run. Does nothing when the
// run found no new papers.

const fs = require("node:fs");

const commentMarker = "<!-- open-paleo:paper-watch -->";
const watchLabel = "paper-watch";

/**
 * Formats a single hit as a markdown checklist line.
 *
 * @param {object} hit - One entry from the paper-watch JSON output.
 * @returns {string} The markdown line.
 */
function formatHit(hit)
{
    const link = hit.doi ? `https://doi.org/${hit.doi}` : `https://openalex.org/${hit.openAlexId}`;
    const venue = hit.venue ? ` _(${hit.venue})_` : "";
    const date = hit.publicationDate ? `${hit.publicationDate} — ` : "";

    return `- [ ] ${date}${hit.title}${venue}\n  ${link}`;
}

/**
 * Builds the full issue body, grouped by genus with a clade-only section
 * for matches that hit a clade name but no tracked genus.
 *
 * @param {Array<object>} hits - The paper-watch JSON output.
 * @param {string} date - The run date (ISO yyyy-mm-dd).
 * @param {string} mention - Optional @-handle(s) to notify (e.g. a team DL).
 * @returns {string} The markdown body.
 */
function buildIssueBody(hits, date, mention)
{
    const byGenus = new Map();
    const cladeOnly = [];

    for (const hit of hits)
    {
        if (!hit.genera || hit.genera.length === 0)
        {
            cladeOnly.push(hit);
            continue;
        }

        for (const genus of hit.genera)
        {
            if (!byGenus.has(genus))
            {
                byGenus.set(genus, []);
            }

            byGenus.get(genus).push(hit);
        }
    }

    const lines = [commentMarker];

    if (mention)
    {
        lines.push(mention, "");
    }

    lines.push(
        `Automated digest from OpenAlex for **${date}** — ${hits.length} new paper(s) `
            + `across ${byGenus.size} genus/genera.`,
        "",
        "Tick a box once the paper has been triaged (`/update-genus`, "
            + "`/intake-genus`, or a `notable_specimens` entry). Short-name "
            + "homonyms and duplicate DOIs are already filtered.",
        "",
    );

    for (const genus of [...byGenus.keys()].sort())
    {
        lines.push(`### ${genus}`, "");

        for (const hit of byGenus.get(genus))
        {
            lines.push(formatHit(hit));
        }

        lines.push("");
    }

    if (cladeOnly.length > 0)
    {
        lines.push("### Clade-only matches", "");

        for (const hit of cladeOnly)
        {
            lines.push(`${formatHit(hit)}\n  clades: ${hit.clades.join(", ")}`);
        }

        lines.push("");
    }

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
 * Finds an open paper-watch issue with a matching title (so a same-day
 * re-run updates the existing issue instead of opening a duplicate).
 *
 * @param {object} github - Octokit instance.
 * @param {{ owner: string, repo: string }} repo - Repository coordinates.
 * @param {string} title - The candidate issue title.
 * @returns {Promise<number | null>} The issue number, or null if none.
 */
async function findExistingIssue(github, repo, title)
{
    const issues = await github.paginate(github.rest.issues.listForRepo, {
        owner: repo.owner,
        repo: repo.repo,
        state: "open",
        labels: watchLabel,
        per_page: 100,
    });

    const existing = issues.find((issue) => issue.title === title);

    return existing ? existing.number : null;
}

/**
 * Entry point invoked by actions/github-script.
 *
 * @param {object} options
 * @param {object} options.github - Octokit instance.
 * @param {object} options.context - actions/github-script context object.
 * @param {string} options.jsonPath - Path to the paper-watch JSON output.
 */
async function run({ github, context, jsonPath })
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
    const date = new Date().toISOString().slice(0, 10);
    const title = `Paper watch — ${date} (${hits.length} new paper${hits.length === 1 ? "" : "s"})`;

    // Two notification paths, both optional and configured via repo variables
    // so nothing is hardcoded. Assignees must be individual users (GitHub does
    // not allow assigning a team); a team/DL is reached by @-mentioning it in
    // the body via PAPER_WATCH_MENTION (e.g. "@open-paleo/paper-watch").
    const assignees = (process.env.PAPER_WATCH_ASSIGNEE ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    const mention = (process.env.PAPER_WATCH_MENTION ?? "").trim();

    const body = buildIssueBody(hits, date, mention);

    await ensureLabel(github, repo);

    const existingNumber = await findExistingIssue(github, repo, title);

    if (existingNumber)
    {
        await github.rest.issues.update({
            owner: repo.owner,
            repo: repo.repo,
            issue_number: existingNumber,
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
