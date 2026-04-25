/**
 * Backfills `pronunciation.phonetic` from the Natural History Museum
 * Dino Directory. NHM publishes hand-curated phonetic respellings for
 * many dinosaur genera but does not publish IPA, so this script only
 * fills the phonetic field.
 *
 * Modes:
 *   (default)  Audit only — emit a JSON report.
 *   --apply    Write fetched phonetic into YAML files.
 *   --genus N  Process only the named genus.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-pronunciation-nhm.ts [options]
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";
import { parseDocument } from "yaml";
import type { GenusData } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const reportPath = path.join(root, "reports", "pronunciation-nhm-backfill.json");

const cacheDir = path.join(os.homedir(), "Desktop", "open-paleo-wd", "nhm");

const nhmBaseUrl = "https://www.nhm.ac.uk/discover/dino-directory";
const userAgent = "open-paleo-data backfill (https://github.com/open-paleo/data)";
const batchSize = 5;
const batchDelayMs = 1000;

type CliOptions = {
    apply: boolean;
    genus?: string;
};

type Candidate = {
    genus: string;
    file: string;
};

type FetchResult = {
    genus: string;
    file: string;
    foundPhonetic?: string;
    notes?: string;
};

/**
 * Parses CLI arguments.
 *
 * @returns Parsed options.
 */
function parseArgs(): CliOptions
{
    const args = process.argv.slice(2);
    const options: CliOptions = { apply: false };

    for (let index = 0; index < args.length; index += 1)
    {
        const arg = args[index];

        if (arg === "--apply")
        {
            options.apply = true;
        }
        else if (arg === "--genus" && args[index + 1])
        {
            options.genus = args[index + 1];
            index += 1;
        }
        else
        {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

/**
 * Sleeps for the given number of milliseconds.
 *
 * @param ms - Milliseconds to sleep.
 * @returns A promise that resolves after the timeout.
 */
function sleep(ms: number): Promise<void>
{
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Loads genera that lack a phonetic respelling.
 *
 * @param genusFilter - Optional genus name filter.
 * @returns Array of fill candidates.
 */
function loadCandidates(genusFilter?: string): Array<Candidate>
{
    const result: Array<Candidate> = [];

    for (const filePath of findYamlFiles(generaDir))
    {
        const data = parseYaml<GenusData>(filePath);
        const name = data?.genus ?? path.basename(filePath, ".yml");

        if (genusFilter && name !== genusFilter)
        {
            continue;
        }

        if (data?.pronunciation?.phonetic)
        {
            continue;
        }

        result.push({ genus: name, file: filePath });
    }

    return result;
}

/**
 * Fetches the NHM Dino Directory page for a genus, with disk caching.
 * Cache hits return the stored HTML; misses fetch and persist. The
 * sentinel "__MISSING__" stores a confirmed network failure so it is
 * not retried.
 *
 * @param genus - The genus name.
 * @returns The HTML body, or null when the request failed.
 */
async function fetchHtml(genus: string): Promise<string | null>
{
    fs.mkdirSync(cacheDir, { recursive: true });

    const cacheFile = path.join(cacheDir, `${genus.toLowerCase()}.html`);

    if (fs.existsSync(cacheFile))
    {
        const cached = fs.readFileSync(cacheFile, "utf8");

        return cached === "__MISSING__" ? null : cached;
    }

    const requestUrl = `${nhmBaseUrl}/${genus.toLowerCase()}.html`;

    try
    {
        const response = await fetch(requestUrl, { headers: { "User-Agent": userAgent } });

        if (!response.ok)
        {
            fs.writeFileSync(cacheFile, "__MISSING__", "utf8");
            return null;
        }

        const body = await response.text();

        fs.writeFileSync(cacheFile, body, "utf8");

        return body;
    }
    catch
    {
        return null;
    }
}

/**
 * Extracts the phonetic respelling from an NHM page. NHM marks the
 * entry with `Pronunciation:</dt><dd>...</dd>`. Returns an empty
 * string when the page is the generic "not found" landing page or the
 * pronunciation cell is empty.
 *
 * @param html - The HTML body.
 * @returns The phonetic respelling, or an empty string.
 */
function extractPhonetic(html: string): string
{
    if (!html.includes("Pronunciation:"))
    {
        return "";
    }

    const match = html.match(/Pronunciation:<\/dt>\s*<dd[^>]*>([^<]*)</);

    if (!match)
    {
        return "";
    }

    return match[1].trim();
}

/**
 * Audits or applies NHM phonetic data for every candidate.
 *
 * @param candidates - Genera to process.
 * @param apply - When true, write the phonetic into the YAML files.
 * @returns Per-genus fetch results.
 */
async function processCandidates(candidates: Array<Candidate>, apply: boolean): Promise<Array<FetchResult>>
{
    const results: Array<FetchResult> = [];
    let written = 0;

    for (let index = 0; index < candidates.length; index += batchSize)
    {
        const batch = candidates.slice(index, index + batchSize);
        const batchResults = await Promise.all(batch.map(async (candidate) =>
        {
            const html = await fetchHtml(candidate.genus);

            if (!html)
            {
                return {
                    genus: candidate.genus,
                    file: path.relative(root, candidate.file),
                    notes: "fetch failed",
                };
            }

            const phonetic = extractPhonetic(html);
            const result: FetchResult = {
                genus: candidate.genus,
                file: path.relative(root, candidate.file),
            };

            if (phonetic)
            {
                result.foundPhonetic = phonetic;
            }
            else
            {
                result.notes = html.includes("Pronunciation:")
                    ? "pronunciation field empty"
                    : "not in NHM directory";
            }

            return result;
        }));

        for (let resultIndex = 0; resultIndex < batchResults.length; resultIndex += 1)
        {
            const result = batchResults[resultIndex];

            results.push(result);

            if (!apply || !result.foundPhonetic)
            {
                continue;
            }

            const candidate = batch[resultIndex];
            const original = fs.readFileSync(candidate.file, "utf8");
            const document = parseDocument(original);

            if (document.hasIn(["pronunciation", "phonetic"]))
            {
                continue;
            }

            document.setIn(["pronunciation", "phonetic"], result.foundPhonetic);
            fs.writeFileSync(candidate.file, document.toString(), "utf8");
            written += 1;
        }

        const completed = Math.min(index + batchSize, candidates.length);
        process.stdout.write(`  ${completed}/${candidates.length}\r`);

        if (index + batchSize < candidates.length)
        {
            await sleep(batchDelayMs);
        }
    }

    process.stdout.write("\n");

    if (apply)
    {
        console.log(`Wrote ${written} files.`);
    }

    return results;
}

/**
 * Entry point.
 */
async function main(): Promise<void>
{
    const options = parseArgs();
    const candidates = loadCandidates(options.genus);

    console.log(`Processing ${candidates.length} candidates...`);

    const results = await processCandidates(candidates, options.apply);
    const summary = {
        total: results.length,
        foundPhonetic: results.filter((entry) => entry.foundPhonetic).length,
        notInDirectory: results.filter((entry) => entry.notes === "not in NHM directory").length,
        emptyField: results.filter((entry) => entry.notes === "pronunciation field empty").length,
        fetchFailed: results.filter((entry) => entry.notes === "fetch failed").length,
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(
        { mode: options.apply ? "apply" : "audit", summary, results },
        null,
        2,
    ), "utf8");

    console.log("");
    console.log(`Report: ${path.relative(root, reportPath)}`);
    console.log("Summary:");

    for (const [key, value] of Object.entries(summary))
    {
        console.log(`  ${key.padEnd(18)} ${value}`);
    }
}

await main();
