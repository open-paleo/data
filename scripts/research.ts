// Open Paleo — Research notes
//
// Prints the research notes for a record before work on it starts:
//
//   npm run research -- genera/W/Wulatelong.yml
//
// That is the record's own research file plus every other note that links to
// the record or to its research file. With --references, regenerates each
// named note's References section from the reference store instead:
//
//   npm run research -- --references research/topics/lago-pellegrini-quarries.md

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import {
    buildResearchReferences,
    findMarkdownFiles,
    markdownLinkTargets,
    researchCitedIds,
    researchFileFor,
    splitResearchNote,
} from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const researchDirectory = path.join(root, "research");

/**
 * Finds every research note that links to any of the given files.
 *
 * @param targets - Absolute paths a link may resolve to.
 * @param exclude - A note to leave out (the record's own research file).
 * @returns The absolute paths of the linking notes, sorted.
 */
function findLinkingNotes(targets: Set<string>, exclude: string): Array<string>
{
    const linking = new Array<string>();

    for (const notePath of findMarkdownFiles(researchDirectory))
    {
        if (notePath === exclude || path.basename(notePath) === "README.md")
        {
            continue;
        }

        const note = fs.readFileSync(notePath, "utf8");
        const links = markdownLinkTargets(note).map((target) => path.resolve(path.dirname(notePath), target));

        if (links.some((link) => targets.has(link)))
        {
            linking.push(notePath);
        }
    }

    return linking.sort();
}

/**
 * Prints a record's research file and every note that links to the record.
 *
 * @param recordArgument - The record's path, relative to the repository root or absolute.
 * @returns The process exit code.
 */
function printNotes(recordArgument: string): number
{
    const recordPath = path.resolve(root, recordArgument);

    if (!fs.existsSync(recordPath))
    {
        console.error(`No record at ${path.relative(root, recordPath)}.`);

        return 1;
    }

    const ownNote = researchFileFor(root, recordPath);
    const notes = [
        ...(fs.existsSync(ownNote) ? [ownNote] : []),
        ...findLinkingNotes(new Set([recordPath, ownNote]), ownNote),
    ];

    if (notes.length === 0)
    {
        console.log(`No research notes for ${path.relative(root, recordPath)}.`);

        return 0;
    }

    for (const notePath of notes)
    {
        console.log(`==> ${path.relative(root, notePath)} <==\n`);
        console.log(splitResearchNote(fs.readFileSync(notePath, "utf8")).body.trimEnd());
        console.log("");
    }

    return 0;
}

/**
 * Rewrites the References section of each note from the store. A note citing
 * an id the store does not hold is left unchanged and reported.
 *
 * @param noteArguments - Note paths, relative to the repository root or absolute.
 * @returns The process exit code.
 */
function writeReferences(noteArguments: Array<string>): number
{
    let failed = false;

    for (const noteArgument of noteArguments)
    {
        const notePath = path.resolve(root, noteArgument);
        const { body } = splitResearchNote(fs.readFileSync(notePath, "utf8"));
        const { section, missing } = buildResearchReferences(root, researchCitedIds(body));

        if (missing.length > 0)
        {
            console.error(`${path.relative(root, notePath)}: no store entry for ${missing.join(", ")}; not written.`);
            failed = true;
        }
        else
        {
            fs.writeFileSync(notePath, section === null ? `${body.trimEnd()}\n` : `${body.trimEnd()}\n\n${section}`);
            console.log(`${path.relative(root, notePath)}: References written.`);
        }
    }

    return failed ? 1 : 0;
}

const commandArguments = process.argv.slice(2);

if (commandArguments[0] === "--references" && commandArguments.length > 1)
{
    process.exit(writeReferences(commandArguments.slice(1)));
}
else if (commandArguments.length === 1 && !commandArguments[0].startsWith("--"))
{
    process.exit(printNotes(commandArguments[0]));
}
else
{
    console.error("Usage: npm run research -- <record path>\n       npm run research -- --references <note path>...");
    process.exit(1);
}
