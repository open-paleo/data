// Checks that the corpus paper filed under each cited reference key is the
// paper the reference store describes. For every genus or clade record that
// carries a dispute block, each key in its references list is looked up in
// the corpus, and the opening lines of the paper's markdown are searched for
// the store entry's DOI and title. The paper is taken as the right work when
// its opening lines carry the store DOI, or most of the store title's words.
// When neither is found, a different work may sit under the key. A year
// difference alone is never reported: keys use the first-available year, so
// online and print years routinely differ.
//
// Writes scratch/1968/cited-papers.md. Read-only otherwise.

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { getCorpusDir } from "./corpus-path.ts";
import type { Reference } from "./types.ts";
import { findYamlFiles, normalizeDoi, parseYaml, storeReferencePath } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const corpusDir = getCorpusDir();
const reportPath = path.join(root, "scratch", "1968", "cited-papers.md");

/**
 * How many opening lines of the markdown are searched.
 */
const headLines = 80;

/**
 * The share of the store title's words that must appear in the paper's
 * opening lines for the title to count as found.
 */
const titleThreshold = 0.6;

/**
 * The parts of a record this check reads.
 */
type AuditedRecord = {
    /**
     * Present when the record carries a dispute block.
     */
    dispute?: unknown;

    /**
     * The record's reference pointers.
     */
    references?: Array<{ id?: string }>;
};

/**
 * One cited key whose corpus paper may not be the work the store describes.
 */
type Mismatch = {
    /**
     * The reference key.
     */
    id: string;

    /**
     * Records that cite the key.
     */
    citedBy: Array<string>;

    /**
     * The store entry's title.
     */
    storeTitle: string;

    /**
     * The first heading of the paper's markdown, for the reviewer.
     */
    paperHeading: string;

    /**
     * The share of the store title's words found in the paper's opening lines.
     */
    titleShare: number;

    /**
     * Whether the store entry has a DOI to search for.
     */
    storeHasDoi: boolean;
};

/**
 * Lowercases text, strips accents and reduces it to its alphanumeric words.
 *
 * @param text - The text to reduce.
 * @returns The words, in order.
 */
function wordsOf(text: string): Array<string>
{
    return text
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((word) => word.length > 2);
}

/**
 * Measures how many of a title's words occur in a set of words.
 *
 * @param title - The title to look for.
 * @param headWords - The words of the paper's opening lines.
 * @returns The share of the title's distinct words found, 0-1.
 */
function shareOf(title: string, headWords: Set<string>): number
{
    const titleWords = new Set(wordsOf(title));

    if (titleWords.size === 0)
    {
        return 0;
    }

    let found = 0;

    for (const word of titleWords)
    {
        if (headWords.has(word))
        {
            found++;
        }
    }

    return found / titleWords.size;
}

/**
 * Measures how much of the store title occurs in the paper's opening lines.
 * A store title in the original language carries its translation in square
 * brackets, and a corpus copy may hold either version, so the original and
 * the translation are each tried alone as well as together.
 *
 * @param storeTitle - The store entry's title.
 * @param head - The paper's opening lines.
 * @returns The best share of title words found, 0-1.
 */
function titleShareIn(storeTitle: string, head: string): number
{
    const headWords = new Set(wordsOf(head));
    const bracketMatch = /^(.*?)\[(.+)\]\s*$/.exec(storeTitle);
    const candidates = [storeTitle];

    if (bracketMatch)
    {
        candidates.push(bracketMatch[1], bracketMatch[2]);
    }

    return Math.max(...candidates.map((candidate) => shareOf(candidate, headWords)));
}

/**
 * Collects every reference key cited by records that carry a dispute block.
 *
 * @returns A map from reference key to the records citing it.
 */
function collectCitedKeys(): Map<string, Array<string>>
{
    const cited = new Map<string, Array<string>>();

    for (const directory of ["genera", "clades"])
    {
        for (const filePath of findYamlFiles(path.join(root, directory)))
        {
            const record = parseYaml<AuditedRecord>(filePath);

            if (record.dispute === undefined)
            {
                continue;
            }

            const recordName = path.relative(root, filePath);

            for (const pointer of record.references ?? [])
            {
                if (pointer.id === undefined || pointer.id.startsWith("jones2026"))
                {
                    continue;
                }

                const citing = cited.get(pointer.id) ?? [];
                citing.push(recordName);
                cited.set(pointer.id, citing);
            }
        }
    }

    return cited;
}

/**
 * Runs the check and writes the report.
 */
function main(): void
{
    const cited = collectCitedKeys();
    const mismatches = new Array<Mismatch>();
    const notHeld = new Array<string>();

    for (const [id, citedBy] of [...cited.entries()].sort(([left], [right]) => left.localeCompare(right)))
    {
        const markdownPath = path.join(corpusDir, "markdown", `${id}.md`);
        const storePath = storeReferencePath(root, id);

        if (!fs.existsSync(markdownPath))
        {
            notHeld.push(id);
            continue;
        }
        else if (!fs.existsSync(storePath))
        {
            continue;
        }

        const entry = parseYaml<Reference>(storePath);
        const head = fs.readFileSync(markdownPath, "utf8").split("\n").slice(0, headLines).join("\n");
        const storeDoi = normalizeDoi(entry.doi ?? "");
        const doiFound = storeDoi !== "" && head.toLowerCase().includes(storeDoi);
        const titleShare = titleShareIn(entry.title ?? "", head);

        if (doiFound || titleShare >= titleThreshold)
        {
            continue;
        }

        const headingMatch = /^#\s+(.+)$/m.exec(head);

        mismatches.push({
            id,
            citedBy,
            storeTitle: entry.title ?? "",
            paperHeading: headingMatch ? headingMatch[1].replace(/[*_]/g, "").trim() : "",
            titleShare,
            storeHasDoi: storeDoi !== "",
        });
    }

    const lines = new Array<string>();
    lines.push("# Cited-paper identity check (#1968)", "");
    lines.push(`Keys checked: ${cited.size}. Possible wrong paper: ${mismatches.length}. Not in the corpus: ${notHeld.length}.`, "");
    lines.push("A flag means neither the store DOI nor most of the store title appears in the paper's opening lines. Translated titles, scans with poor text, and neighbouring articles sharing one markdown file are common false alarms; check each against the paper.", "");
    lines.push("## Possible wrong paper", "");

    for (const mismatch of mismatches)
    {
        lines.push(`- \`${mismatch.id}\` (title share ${mismatch.titleShare.toFixed(2)}${mismatch.storeHasDoi ? ", store DOI not found" : ", no store DOI"})`);
        lines.push(`  - store: ${mismatch.storeTitle}`);
        lines.push(`  - first heading: ${mismatch.paperHeading}`);
        lines.push(`  - cited by: ${mismatch.citedBy.join(", ")}`);
    }

    lines.push("", "## Not in the corpus", "", notHeld.map((id) => `\`${id}\``).join(", "), "");

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, lines.join("\n"));
    console.log(`Checked ${cited.size} keys: ${mismatches.length} possible wrong paper, ${notHeld.length} not held.`);
    console.log(`Report: ${path.relative(root, reportPath)}`);
}

main();
