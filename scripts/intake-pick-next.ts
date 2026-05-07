// Pick the next genus to intake from the Bucket B table in
// `reports/intake-triage.md`. Skips rows already marked `[done]`,
// genera that already have a YAML on disk under `genera/`, and genera
// with an in-flight staging directory at `staging/intake/{Genus}/`.
//
// Output: a single line of JSON with `issue`, `genus`, `label`, and
// `notes` fields. Errors to stderr if no eligible row remains.
//
// Usage:
//   npm run intake-pick-next

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const triageReportPath = path.join(root, "reports", "intake-triage.md");
const generaDir = path.join(root, "genera");
const stagingIntakeDir = path.join(root, "staging", "intake");

/**
 * One row of the Bucket B table in the triage report.
 */
type BucketBRow = {
    /**
     * GitHub Intake issue number.
     */
    issue: number;

    /**
     * Genus name.
     */
    genus: string;

    /**
     * Triage label (e.g. "Manual", "Disputed").
     */
    label: string;

    /**
     * Triage notes column — describing paper hint, status, etc.
     */
    notes: string;

    /**
     * Whether the row has been marked `[done]` after a successful intake.
     */
    done: boolean;

    /**
     * Whether the row has been marked `[deferred]`. Deferred genera
     * have a known external blocker (e.g. the primary describing
     * paper is unavailable as a PDF) and should be skipped until
     * the blocker is resolved.
     */
    deferred: boolean;
};

/**
 * Reads the triage report and returns the parsed Bucket B rows in
 * the order they appear.
 *
 * @returns Array of Bucket B rows, oldest first.
 */
function readBucketBRows(): Array<BucketBRow>
{
    const content = fs.readFileSync(triageReportPath, "utf8");
    const lines = content.split("\n");

    const sectionStart = lines.findIndex(
        (line) => line.startsWith("## Bucket B "),
    );

    if (sectionStart < 0)
    {
        throw new Error("Bucket B section not found in intake-triage.md");
    }

    const sectionEnd = lines.findIndex(
        (line, index) => index > sectionStart && line.startsWith("## "),
    );

    const sectionLines = lines.slice(
        sectionStart,
        sectionEnd > 0 ? sectionEnd : lines.length,
    );

    const rows = new Array<BucketBRow>();

    for (const line of sectionLines)
    {
        if (!line.startsWith("| "))
        {
            continue;
        }

        const cells = line.split("|").map((cell) => cell.trim());

        // Skip header row (`| # | Genus |...`) and separator (`|---|---|`)
        if (cells.length < 5 || cells[1] === "#" || cells[1].startsWith("---"))
        {
            continue;
        }

        const issueRaw = cells[1];
        const issue = Number.parseInt(issueRaw, 10);

        if (!Number.isInteger(issue))
        {
            continue;
        }

        const genus = cells[2];
        const label = cells[3];
        const notesRaw = cells[4];

        const done = /\[done[^\]]*\]/.test(notesRaw);
        const deferred = /\[deferred[^\]]*\]/.test(notesRaw);

        const notes = notesRaw
            .replace(/\s*\[done[^\]]*\]\s*/g, "")
            .replace(/\s*\[deferred[^\]]*\]\s*/g, "")
            .trim();

        rows.push({ issue, genus, label, notes, done, deferred });
    }

    return rows;
}

/**
 * Returns the on-disk path the promoted YAML would occupy for a
 * genus, even if it does not yet exist.
 *
 * @param genus - Genus name (capitalised first letter).
 * @returns Absolute path to genera/{LETTER}/{Genus}.yml.
 */
function generaYamlPath(genus: string): string
{
    const letter = genus.charAt(0).toUpperCase();
    return path.join(generaDir, letter, `${genus}.yml`);
}

/**
 * Returns the staging directory path for a genus, even if it does
 * not yet exist.
 *
 * @param genus - Genus name.
 * @returns Absolute path to staging/intake/{Genus}/.
 */
function stagingDirFor(genus: string): string
{
    return path.join(stagingIntakeDir, genus);
}

/**
 * Checks whether a genus is eligible for the next intake run. A row
 * is ineligible when it is already marked done, when a YAML for the
 * genus exists on disk, or when a staging directory for the genus
 * exists.
 *
 * @param row - The triage row to check.
 * @returns True when no blockers were detected.
 */
function isEligible(row: BucketBRow): boolean
{
    if (row.done)
    {
        return false;
    }
    else if (row.deferred)
    {
        return false;
    }
    else if (fs.existsSync(generaYamlPath(row.genus)))
    {
        return false;
    }
    else if (fs.existsSync(stagingDirFor(row.genus)))
    {
        return false;
    }

    return true;
}

/**
 * Entry point. Prints either the next eligible row as a JSON line on
 * stdout, or an explanatory message on stderr (and exits non-zero)
 * when no row is eligible.
 */
function main(): void
{
    const rows = readBucketBRows();
    const next = rows.find(isEligible);

    if (!next)
    {
        const total = rows.length;
        const done = rows.filter((row) => row.done).length;
        const deferred = rows.filter((row) => row.deferred).length;

        process.stderr.write(
            `No eligible Bucket B row. ${done}/${total} marked done, `
            + `${deferred} deferred; the rest are blocked by existing files.\n`,
        );

        process.exit(1);
    }

    process.stdout.write(`${JSON.stringify({
        issue: next.issue,
        genus: next.genus,
        label: next.label,
        notes: next.notes,
    })}\n`);
}

main();
