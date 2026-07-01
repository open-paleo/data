// Files (or updates) a GitHub issue summarizing the latest paper-watch run.
// Invoked from the Paper Watch workflow after `npm run paper-watch` writes
// its JSON output. Reads reports/paper-watch.json, groups the hits by genus
// with triage checkboxes, and opens one issue per run. Does nothing when the
// run found no new papers.

const fs = require("node:fs");

const commentMarker = "<!-- open-paleo:paper-watch -->";
const watchLabel = "Paper Watch";

/**
 * Formats a single hit as a markdown checklist item: title, the venue in
 * bold on its own line (for at-a-glance access triage), then the link with
 * an open-access lock when a free version exists.
 *
 * @param {object} hit - One entry from the paper-watch JSON output.
 * @returns {string} The markdown item.
 */
function formatHit(hit)
{
    const link = hit.doi ? `https://doi.org/${hit.doi}` : `https://openalex.org/${hit.openAlexId}`;
    const date = hit.publicationDate ? `${hit.publicationDate} — ` : "";
    const venueLine = hit.venue ? `\n  **${hit.venue}**` : "";
    const access = hit.isOpenAccess ? " 🔓" : "";
    // Hidden per-item anchor (invisible when rendered) so the triage skill can
    // locate an item's checkbox by DOI to tick it.
    const anchor = ` <!-- doi:${hit.doi ?? hit.openAlexId} -->`;

    return `- [ ] ${date}${hit.title}${anchor}${venueLine}\n  ${link}${access}`;
}

/**
 * Builds the full issue body, grouped by the exact set of genera a paper
 * mentions (so a multi-genus paper appears once under a combined heading),
 * with a clade-only section for matches that hit a clade but no genus.
 *
 * @param {Array<object>} hits - The paper-watch JSON output.
 * @param {string} date - The run date (ISO yyyy-mm-dd).
 * @param {string} mention - Optional @-handle(s) to notify (e.g. a team DL).
 * @returns {string} The markdown body.
 */
function buildIssueBody(hits, date, mention)
{
    const byGenusSet = new Map();
    const cladeOnly = [];

    for (const hit of hits)
    {
        if (!hit.genera || hit.genera.length === 0)
        {
            cladeOnly.push(hit);
        }
        else
        {
            const key = hit.genera.join(", ");

            if (!byGenusSet.has(key))
            {
                byGenusSet.set(key, []);
            }

            byGenusSet.get(key).push(hit);
        }
    }

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
    );

    for (const key of [...byGenusSet.keys()].sort())
    {
        lines.push(`### ${key}`, "");

        for (const hit of byGenusSet.get(key))
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
