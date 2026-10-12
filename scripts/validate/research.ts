// Checks on the research notes.

import * as fs from "node:fs";
import * as path from "node:path";

import type { Reference } from "../types.ts";
import {
    buildResearchTail,
    findMarkdownFiles,
    markdownLinkTargets,
    recordFileFor,
    researchMethodsFile,
    researchTopicDirectory,
    splitResearchNote,
} from "../utilities.ts";
import { relPath, checkError } from "./report.ts";
import type { ValidationContext } from "./context.ts";

/**
 * Runs the "Research notes" check.
 *
 * @param context - The loaded data the checks read.
 */
export function checkResearchNotes(context: ValidationContext): void
{
    const {
        referenceStoreParsed,
        root,
    } = context;

    // Research notes resolve their citations against the store as loaded above,
    // keyed by file name as the store files are, rather than re-reading a file per
    // citation.
    const storeEntriesByFileName = new Map(
        [...referenceStoreParsed].map(([filePath, entry]) => [path.basename(filePath, ".yml"), entry]));

    /**
     * Looks up a parsed store entry by its key.
     *
     * @param id - The reference key.
     * @returns The entry, or undefined when the store has no file for the key.
     */
    function storeEntryByFileName(id: string): Reference | undefined
    {
        return storeEntriesByFileName.get(id) ?? undefined;
    }

    // research/README.md documents the format and quotes example citations, so it
    // is the one file under research/ that is not itself a note.
    const researchDirectory = path.join(root, "research");

    for (const notePath of findMarkdownFiles(researchDirectory))
    {
        if (notePath === path.join(researchDirectory, "README.md"))
        {
            continue;
        }

        const recordPath = recordFileFor(root, notePath);
        const topLevel = path.relative(researchDirectory, notePath).split(path.sep)[0];

        if (recordPath === null && topLevel !== researchTopicDirectory && topLevel !== researchMethodsFile)
        {
            checkError("Research notes", notePath, "is neither a record's research file, research/methods.md, nor under research/topics/");
        }
        else if (recordPath !== null && !fs.existsSync(recordPath))
        {
            checkError(
                "Research notes",
                notePath,
                `mirrors ${relPath(recordPath)}, which does not exist; move the note with its record`);
        }

        const note = fs.readFileSync(notePath, "utf8");
        const titles = note.match(/^# .*$/gm) ?? [];

        if (!note.startsWith("# ") || titles.length !== 1)
        {
            checkError("Research notes", notePath, "must open with a single '# ' title; entries and References are '##'");
        }

        for (const target of markdownLinkTargets(note))
        {
            if (!fs.existsSync(path.resolve(path.dirname(notePath), target)))
            {
                checkError("Research notes", notePath, `link '${target}' does not resolve`);
            }
        }

        const { body, tail, otherIds } = splitResearchNote(note);
        const expected = buildResearchTail(storeEntryByFileName, body, otherIds);

        for (const id of expected.missing)
        {
            checkError("Research notes", notePath, `cites '${id}', which has no entry in references/`);
        }

        for (const id of expected.duplicates)
        {
            checkError(
                "Research notes",
                notePath,
                `lists '${id}' under Other references, but the text cites it by id; it belongs under References only`);
        }

        if (expected.missing.length === 0
            && expected.duplicates.length === 0
            && (tail ?? "").trimEnd() !== (expected.tail ?? "").trimEnd())
        {
            checkError(
                "Research notes",
                notePath,
                "References sections do not match the ids cited, the ids listed under Other references, and the store; "
                + `run npm run research -- --references ${relPath(notePath)}`);
        }
    }
}
