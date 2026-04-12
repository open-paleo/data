/**
 * One-off: fetch Wikipedia wikitext for a list of genera and cache to disk.
 * Used as input for the holotype-extraction agent pass (see
 * docs/temporary/genus-wikipedia-cache/ after running).
 *
 * Reads newline-separated genus names from argv[2] or stdin and writes one
 * cache file per genus. Skips genera whose cache file already exists.
 *
 * Usage:
 *   node --experimental-strip-types scripts/fetch-genus-wikipedia.ts /tmp/missing-holotype-genera.txt
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const cacheDir = path.join(root, "node_modules", ".cache", "genus-wikipedia");

const inputPath = process.argv[2];

if (typeof inputPath !== "string" || inputPath.length === 0)
{
    console.error("Usage: fetch-genus-wikipedia.ts <path-to-genus-list.txt>");
    process.exit(1);
}

if (!fs.existsSync(inputPath))
{
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
}

fs.mkdirSync(cacheDir, { recursive: true });

const genera = fs.readFileSync(inputPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

console.log(`Fetching ${genera.length} genera to ${cacheDir}`);

type FetchResult = {
    genus: string;
    status: "cached" | "fetched" | "no-page" | "error";
    detail?: string;
};

/**
 * Fetches the wikitext for a single genus Wikipedia article.
 *
 * @param genusName - The genus name (used as the Wikipedia page title).
 * @returns The raw wikitext, or null when Wikipedia returns no page.
 */
async function fetchWikitext(genusName: string): Promise<string | null>
{
    const apiUrl = "https://en.wikipedia.org/w/api.php"
        + "?action=parse"
        + `&page=${encodeURIComponent(genusName)}`
        + "&format=json"
        + "&prop=wikitext"
        + "&redirects=1";

    const response = await fetch(apiUrl);

    if (!response.ok)
    {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as {
        parse?: { wikitext?: { "*"?: string } };
        error?: { info?: string };
    };

    if (payload.error)
    {
        return null;
    }

    return payload.parse?.wikitext?.["*"] ?? null;
}

const results: Array<FetchResult> = [];
let processed = 0;

for (const genus of genera)
{
    processed += 1;
    const cachePath = path.join(cacheDir, `${genus}.wikitext`);

    if (fs.existsSync(cachePath))
    {
        results.push({ genus, status: "cached" });
        continue;
    }

    try
    {
        const wikitext = await fetchWikitext(genus);

        if (wikitext === null || wikitext.length === 0)
        {
            results.push({ genus, status: "no-page" });
            fs.writeFileSync(`${cachePath}.missing`, "", "utf8");
            continue;
        }

        fs.writeFileSync(cachePath, wikitext, "utf8");
        results.push({ genus, status: "fetched" });

        if (processed % 10 === 0)
        {
            console.log(`  [${processed}/${genera.length}] fetched ${genus}`);
        }
    }
    catch (error)
    {
        results.push({ genus, status: "error", detail: (error as Error).message });
    }

    // Gentle rate limit — Wikipedia started returning 429s at 100ms intervals.
    await new Promise((resolve) => setTimeout(resolve, 500));
}

const counts = {
    cached: results.filter((result) => result.status === "cached").length,
    fetched: results.filter((result) => result.status === "fetched").length,
    noPage: results.filter((result) => result.status === "no-page").length,
    error: results.filter((result) => result.status === "error").length,
};

console.log("");
console.log("=== Summary ===");
console.log(`  Cached (skipped):  ${counts.cached}`);
console.log(`  Newly fetched:     ${counts.fetched}`);
console.log(`  No Wikipedia page: ${counts.noPage}`);
console.log(`  Errors:            ${counts.error}`);

if (counts.error > 0)
{
    console.log("");
    console.log("Errors:");

    for (const result of results.filter((result) => result.status === "error"))
    {
        console.log(`  ${result.genus}: ${result.detail}`);
    }
}

if (counts.noPage > 0)
{
    console.log("");
    console.log("No Wikipedia page (wrote .missing marker):");

    for (const result of results.filter((result) => result.status === "no-page"))
    {
        console.log(`  ${result.genus}`);
    }
}
