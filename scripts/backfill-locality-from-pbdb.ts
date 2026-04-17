/**
 * One-off: backfill species.location.locality using PBDB collection
 * names for each genus's type species.
 *
 * For each genus missing a locality, queries PBDB occurrences with the
 * `coll` vocab to retrieve the collection name (`cnm`). Picks the best
 * type-locality occurrence using the same priority chain as
 * backfill-location-from-pbdb.ts, then cleans the collection name
 * (strips parenthetical specimen IDs, trims whitespace) and writes it
 * as the locality.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-locality-from-pbdb.ts [--apply] [--limit=N]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parseYaml, findYamlFiles } from "./utilities.ts";
import type { GenusData } from "./types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const apply = process.argv.includes("--apply");
const limitArg = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

/**
 * Pauses execution for a given number of milliseconds.
 *
 * @param milliseconds - Duration to sleep.
 * @returns A promise that resolves after the delay.
 */
function sleep(milliseconds: number): Promise<void>
{
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Fetches a URL with retry logic for transient network errors.
 *
 * @param fetchUrl - The URL to fetch.
 * @param retries - Maximum number of retry attempts.
 * @returns The fetch Response, or null if all retries failed.
 */
async function fetchWithRetry(fetchUrl: string, retries = 3): Promise<Response | null>
{
    for (let attempt = 0; attempt <= retries; attempt += 1)
    {
        try
        {
            const response = await fetch(fetchUrl);
            return response;
        }
        catch
        {
            if (attempt < retries)
            {
                await sleep(2000 * (attempt + 1));
            }
        }
    }

    return null;
}

type TaxaRecord = {
    nam: string;
    rnk: number;
    rid: string;
};

type OccurrenceRecord = {
    oid: string;
    tna: string;
    idn?: string;
    rid: string;
    cc2?: string;
    stp?: string;
    sfm?: string;
    lat?: string;
    lng?: string;
    cnm?: string;
    aka?: string;
};

/**
 * Queries PBDB taxa API for a batch of taxon names and returns a map
 * of lowercase name to record.
 *
 * @param names - Array of taxon names.
 * @returns Map of lowercase name to taxa record.
 */
async function fetchTaxaBatch(names: Array<string>): Promise<Map<string, TaxaRecord>>
{
    const encoded = names.map((name) => encodeURIComponent(name)).join(",");
    const apiUrl = `https://paleobiodb.org/data1.2/taxa/list.json?name=${encoded}&show=app`;
    const response = await fetchWithRetry(apiUrl);

    if (!response?.ok)
    {
        if (response)
        {
            console.error(`PBDB taxa API error: ${response.status}`);
        }

        return new Map();
    }

    const data = await response.json() as { records: Array<TaxaRecord> };
    const result = new Map<string, TaxaRecord>();

    for (const record of data.records)
    {
        result.set(record.nam.toLowerCase(), record);
    }

    return result;
}

/**
 * Checks whether a string looks like a museum/collection code rather
 * than a geographic locality name (e.g., "MOR TM-281", "USGS D815").
 *
 * @param text - The string to check.
 * @returns True if the string appears to be a code, not a place name.
 */
function looksLikeCode(text: string): boolean
{
    const trimmed = text.trim();

    if (trimmed.length === 0)
    {
        return true;
    }

    // All-uppercase tokens with numbers/hyphens: "MOR TM-281", "USGS D815"
    if (/^[A-Z]{2,}[\s\dA-Z/.-]+$/.test(trimmed))
    {
        return true;
    }

    // Starts with an uppercase code followed by specimen-like identifiers
    if (/^[A-Z]{2,}\s+[A-Z]?\d/.test(trimmed))
    {
        return true;
    }

    // Museum code patterns: "MOR TM-060", "OMNH V68", "NMC 9954"
    if (/^[A-Z]{2,}\s+[A-Z]{1,3}[\s-]?\d+/.test(trimmed))
    {
        return true;
    }

    // Very short and mostly uppercase (like "GS-ENM")
    if (trimmed.length < 8 && /^[A-Z0-9\s-]+$/.test(trimmed))
    {
        return true;
    }

    return false;
}

/**
 * Cleans a PBDB collection name for use as a locality value.
 *
 * Strips parenthetical institution/specimen codes, square bracket
 * expedition codes, trailing museum identifiers, and PBDB-internal
 * labels. Returns an empty string if the result is not a usable
 * geographic name.
 *
 * @param raw - The raw collection name from PBDB.
 * @returns The cleaned locality string (may be empty).
 */
function cleanCollectionName(raw: string): string
{
    // Strip any parenthetical starting with an institution code (2+ uppercase)
    // e.g., "(NMC 9954)", "(MPCA)", "(UCMP V98173)", "(PIN Loc. 3907)",
    // "(MCCM collection)", "(MIWG/BMNH)" — but NOT "(Isona)" or "(148 m)"
    let cleaned = raw.replace(/\s*\([A-Z]{2,}[^)]*\)/g, "");

    // Strip square bracket codes: [SMPE], [SMPE/SMGE]
    // but keep ones that look geographic: [Bajo de la Carpa], [lower]
    cleaned = cleaned.replace(/\s*\[[A-Z]{2,}[\s/A-Z]*\]/g, "");

    // Strip generic parenthetical labels like "(locality 123)"
    cleaned = cleaned.replace(/\s*\(locality\s+\d+\)/gi, "");

    // Take first segment if semicolons present (rest are alternatives/codes)
    if (cleaned.includes(";"))
    {
        cleaned = cleaned.split(";")[0];
    }

    // Strip trailing museum/collection codes: ", OMNH V68", ", MOR TM-060",
    // ", GSC", ", SCDP"
    cleaned = cleaned.replace(/,\s+[A-Z]{2,}(?:\s+[A-Z]?\d[\w-]*)?$/g, "");

    // Strip PBDB-style "type" labels: "Genus type," or "Genus species type"
    cleaned = cleaned.replace(/\b\w+\s+(type|holotype)\b,?\s*/gi, "");

    // Strip "LLC", "Corp", "Inc" commercial entity names
    cleaned = cleaned.replace(/\b(LLC|Corp|Inc)\b\.?\s*/g, "");

    // Strip embedded double quotes (e.g., "North Canyon" locality)
    cleaned = cleaned.replace(/"/g, "");

    // Trim trailing punctuation and whitespace
    cleaned = cleaned.replace(/[,;:\s]+$/, "").trim();

    // Reject generic/useless names
    const lower = cleaned.toLowerCase();

    if (lower === "site" || lower === "locality" || lower === "quarry" || lower === "type locality")
    {
        return "";
    }

    // If the result looks like a code rather than a place name, discard it
    if (looksLikeCode(cleaned))
    {
        return "";
    }

    return cleaned;
}

/**
 * Picks the best locality string from a PBDB occurrence, preferring the
 * cleaned collection name but falling back to the alias (`aka`) field.
 *
 * @param occurrence - A PBDB occurrence record.
 * @returns The best locality string, or empty if none is usable.
 */
function bestLocality(occurrence: OccurrenceRecord): string
{
    // Try cleaned collection name first.
    if (occurrence.cnm)
    {
        const cleaned = cleanCollectionName(occurrence.cnm);

        if (cleaned.length > 0)
        {
            return cleaned;
        }
    }

    // Fall back to alias if it exists and isn't a code/type label.
    if (occurrence.aka)
    {
        const alias = occurrence.aka.replace(/\b\w+\s+(type|holotype)\b,?\s*/gi, "").trim();

        if (alias.length > 0 && !looksLikeCode(alias))
        {
            return alias;
        }
    }

    return "";
}

/**
 * Scores how well a PBDB occurrence matches our existing location data
 * for a genus. Higher is better.
 *
 * @param occurrence - A PBDB occurrence record.
 * @param info - The genus info with current location data.
 * @returns A numeric match score.
 */
function scoreOccurrenceMatch(occurrence: OccurrenceRecord, info: GenusInfo): number
{
    let score = 0;

    if (occurrence.cc2 && info.currentCountry && occurrence.cc2 === info.currentCountry)
    {
        score += 1;
    }

    if (occurrence.stp && info.currentRegion && occurrence.stp === info.currentRegion)
    {
        score += 1;
    }

    if (occurrence.sfm && info.currentFormation && occurrence.sfm === info.currentFormation)
    {
        score += 2;
    }

    if (occurrence.lat && occurrence.lng && info.currentCoordinates)
    {
        const latDiff = Math.abs(parseFloat(occurrence.lat) - info.currentCoordinates[0]);
        const lngDiff = Math.abs(parseFloat(occurrence.lng) - info.currentCoordinates[1]);

        if (latDiff < 1 && lngDiff < 1)
        {
            score += 3;
        }
    }

    return score;
}

// Load genera missing locality.
type GenusInfo = {
    genus: string;
    typeSpecies: string;
    filePath: string;
    currentCountry: string | undefined;
    currentRegion: string | undefined;
    currentFormation: string | undefined;
    currentCoordinates: [number, number] | undefined;
    currentLocality: string | undefined;
};

const generaInfo: Array<GenusInfo> = [];

for (const filePath of findYamlFiles(generaDir))
{
    const data = parseYaml<GenusData>(filePath);

    if (!data?.genus || !data.species)
    {
        continue;
    }

    const typeSpecies = data.species.find((species) => species.type_species) ?? data.species[0];

    if (!typeSpecies?.name)
    {
        continue;
    }

    const location = typeSpecies.location;

    // Only process genera that are missing locality
    if (location?.locality)
    {
        continue;
    }

    generaInfo.push({
        genus: data.genus,
        typeSpecies: typeSpecies.name,
        filePath,
        currentCountry: location?.country,
        currentRegion: location?.region,
        currentFormation: location?.formation,
        currentCoordinates: location?.coordinates,
        currentLocality: location?.locality,
    });
}

if (limit < Infinity)
{
    generaInfo.splice(limit);
}

console.log(`Loaded ${generaInfo.length} genera missing locality`);

// Phase 1: batch fetch taxa records for describing reference IDs.
console.log("Fetching taxa records from PBDB...");

const taxaData = new Map<string, TaxaRecord>();
const batchSize = 50;

const speciesNames = generaInfo.map((info) => info.typeSpecies);

for (let offset = 0; offset < speciesNames.length; offset += batchSize)
{
    const batch = speciesNames.slice(offset, offset + batchSize);
    const results = await fetchTaxaBatch(batch);

    for (const [key, record] of results)
    {
        taxaData.set(key, record);
    }

    process.stdout.write(`  ${Math.min(offset + batchSize, speciesNames.length)}/${speciesNames.length}\r`);

    if (offset + batchSize < speciesNames.length)
    {
        await sleep(500);
    }
}

console.log("");

// Also try genus-level for species not found.
const missingSpecies = generaInfo.filter(
    (info) => !taxaData.has(info.typeSpecies.toLowerCase()),
);

if (missingSpecies.length > 0)
{
    console.log(`Species not found: ${missingSpecies.length}, trying genus names...`);

    const genusNames = missingSpecies.map((info) => info.genus);

    for (let offset = 0; offset < genusNames.length; offset += batchSize)
    {
        const batch = genusNames.slice(offset, offset + batchSize);
        const results = await fetchTaxaBatch(batch);

        for (const [key, record] of results)
        {
            taxaData.set(key, record);
        }

        if (offset + batchSize < genusNames.length)
        {
            await sleep(500);
        }
    }
}

console.log(`Taxa records: ${taxaData.size}`);

// Phase 2: fetch occurrences with collection data.
console.log("Fetching occurrences with collection names...");

type LocalityResult = {
    locality: string;
    rawCollectionName: string;
    alias: string | undefined;
    matchScore: number;
    matchMethod: string;
};

const pbdbLocalities = new Map<string, LocalityResult>();

const occurrenceBatchSize = 15;
let processed = 0;

for (let offset = 0; offset < generaInfo.length; offset += occurrenceBatchSize)
{
    const batch = generaInfo.slice(offset, offset + occurrenceBatchSize);
    const speciesInBatch = batch.map((info) => info.typeSpecies);
    const encoded = speciesInBatch.map((name) => encodeURIComponent(name)).join(",");

    const apiUrl = `https://paleobiodb.org/data1.2/occs/list.json?base_name=${encoded}&show=coords,strat,loc,coll&limit=100`;
    const response = await fetchWithRetry(apiUrl);

    if (response?.ok)
    {
        const data = await response.json() as { records: Array<OccurrenceRecord> };

        // Group occurrences by species name.
        const bySpecies = new Map<string, Array<OccurrenceRecord>>();

        for (const record of data.records)
        {
            const key = record.tna.toLowerCase();
            const list = bySpecies.get(key) ?? [];
            list.push(record);
            bySpecies.set(key, list);
        }

        // For each genus in the batch, pick the best occurrence.
        for (const info of batch)
        {
            const records = bySpecies.get(info.typeSpecies.toLowerCase());

            if (!records || records.length === 0)
            {
                continue;
            }

            // Filter to records that have a collection name or alias.
            const withCollection = records.filter((record) => record.cnm ?? record.aka);

            if (withCollection.length === 0)
            {
                continue;
            }

            const taxaRecord = taxaData.get(info.typeSpecies.toLowerCase())
                ?? taxaData.get(info.genus.toLowerCase());

            // Priority chain: n. gen./n. sp. > same describing ref > best location match > first.
            let best: OccurrenceRecord | undefined;
            let matchMethod = "first";

            const typeRecords = withCollection.filter(
                (record) => record.idn && /n\.\s*(gen|sp)\./i.test(record.idn),
            );

            if (typeRecords.length > 0)
            {
                best = typeRecords[0];
                matchMethod = "type-id";
            }

            if (!best && taxaRecord?.rid)
            {
                const refRecords = withCollection.filter((record) => record.rid === taxaRecord.rid);

                if (refRecords.length > 0)
                {
                    best = refRecords[0];
                    matchMethod = "ref-match";
                }
            }

            if (!best)
            {
                // Score all candidates against existing location data.
                let bestScore = -1;

                for (const candidate of withCollection)
                {
                    const candidateScore = scoreOccurrenceMatch(candidate, info);

                    if (candidateScore > bestScore)
                    {
                        bestScore = candidateScore;
                        best = candidate;
                        matchMethod = candidateScore > 0 ? `location-score-${candidateScore}` : "first";
                    }
                }
            }

            if (!best)
            {
                continue;
            }

            const locality = bestLocality(best);

            if (locality.length === 0)
            {
                continue;
            }

            pbdbLocalities.set(info.genus, {
                locality,
                rawCollectionName: best.cnm ?? "",
                alias: best.aka,
                matchScore: scoreOccurrenceMatch(best, info),
                matchMethod,
            });
        }
    }

    processed += batch.length;

    if (processed % 50 < occurrenceBatchSize)
    {
        console.log(`  ${processed}/${generaInfo.length}`);
    }

    await sleep(500);
}

console.log(`Fetched localities: ${pbdbLocalities.size}/${generaInfo.length}`);

// Phase 3: categorize results by confidence.
type LocalityFill = {
    genus: string;
    typeSpecies: string;
    locality: string;
    rawCollectionName: string;
    alias: string | undefined;
    matchMethod: string;
    matchScore: number;
};

const highConfidence: Array<LocalityFill> = [];
const lowConfidence: Array<LocalityFill> = [];
const noData: Array<string> = [];

for (const info of generaInfo)
{
    const result = pbdbLocalities.get(info.genus);

    if (!result)
    {
        noData.push(info.genus);
        continue;
    }

    const fill: LocalityFill = {
        genus: info.genus,
        typeSpecies: info.typeSpecies,
        locality: result.locality,
        rawCollectionName: result.rawCollectionName,
        alias: result.alias,
        matchMethod: result.matchMethod,
        matchScore: result.matchScore,
    };

    // High confidence: matched via type identification or describing reference,
    // or scored 3+ on location matching.
    if (result.matchMethod === "type-id" || result.matchMethod === "ref-match" || result.matchScore >= 3)
    {
        highConfidence.push(fill);
    }
    else
    {
        lowConfidence.push(fill);
    }
}

console.log("");
console.log(`High confidence:  ${highConfidence.length}`);
console.log(`Low confidence:   ${lowConfidence.length}`);
console.log(`No PBDB data:     ${noData.length}`);

// Write report.
const reportPath = path.join(root, "reports", "locality-backfill.json");
const reportDir = path.dirname(reportPath);

if (!fs.existsSync(reportDir))
{
    fs.mkdirSync(reportDir, { recursive: true });
}

fs.writeFileSync(
    reportPath,
    JSON.stringify({ highConfidence, lowConfidence, noData }, null, 2) + "\n",
    "utf8",
);

console.log("\nWrote reports/locality-backfill.json");

if (!apply)
{
    console.log("Dry run. Re-run with --apply to write YAML files.");
    console.log("(Only high-confidence fills are auto-applied.)");
    process.exit(0);
}

// Apply high-confidence fills.
console.log("");
console.log("Applying high-confidence locality fills...");

let filesWritten = 0;

for (const fill of highConfidence)
{
    const info = generaInfo.find((genus) => genus.genus === fill.genus);

    if (!info)
    {
        continue;
    }

    const source = fs.readFileSync(info.filePath, "utf8");
    const lines = source.split("\n");

    // Find the type species line.
    let speciesLineIndex = -1;

    for (let index = 0; index < lines.length; index += 1)
    {
        if (lines[index].match(/^\s+-\s+name:\s+/) && lines[index].includes(info.typeSpecies))
        {
            speciesLineIndex = index;
            break;
        }
    }

    if (speciesLineIndex === -1)
    {
        continue;
    }

    const speciesIndent = lines[speciesLineIndex].match(/^(\s*)/)?.[1] ?? "";
    const fieldIndent = speciesIndent + "  ";
    const childIndent = fieldIndent + "  ";

    // Find location block.
    let locationLineIndex = -1;

    for (let index = speciesLineIndex + 1; index < lines.length; index += 1)
    {
        if (index > speciesLineIndex + 1 && lines[index].match(/^\s+-\s+name:/))
        {
            break;
        }

        if (lines[index] === fieldIndent + "location:")
        {
            locationLineIndex = index;
            break;
        }
    }

    if (locationLineIndex === -1)
    {
        continue;
    }

    // Find the end of the location block and look for existing locality line.
    let localityLineIndex = -1;
    let countryLineIndex = -1;
    let locationEndIndex = locationLineIndex + 1;

    while (locationEndIndex < lines.length)
    {
        const line = lines[locationEndIndex];

        if (line.length === 0)
        {
            locationEndIndex += 1;
            continue;
        }

        if (!line.startsWith(childIndent))
        {
            break;
        }

        if (line.startsWith(childIndent + "locality:"))
        {
            localityLineIndex = locationEndIndex;
        }
        else if (line.startsWith(childIndent + "country:"))
        {
            countryLineIndex = locationEndIndex;
        }

        locationEndIndex += 1;
    }

    // Skip if locality already exists (shouldn't happen, but guard).
    if (localityLineIndex >= 0)
    {
        continue;
    }

    // Insert locality after country line, or after location: header.
    const insertAfter = countryLineIndex >= 0 ? countryLineIndex : locationLineIndex;
    const localityValue = fill.locality.includes(":") || fill.locality.includes("#")
        ? `"${fill.locality}"`
        : fill.locality;

    lines.splice(insertAfter + 1, 0, childIndent + "locality: " + localityValue);

    fs.writeFileSync(info.filePath, lines.join("\n"), "utf8");
    filesWritten += 1;
}

console.log(`Done. Updated ${filesWritten} files.`);
console.log(`Low-confidence fills (${lowConfidence.length}) saved to report for manual review.`);
