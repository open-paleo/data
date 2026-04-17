/**
 * One-off: backfill and validate location data (country, region,
 * formation, coordinates) using PBDB occurrence data for each genus's
 * type species.
 *
 * For each genus, queries the PBDB taxa API for the describing
 * reference, then fetches the type locality occurrence from that
 * reference. Fills missing fields and flags inconsistencies with
 * existing data.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-location-from-pbdb.ts [--apply]
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

/**
 * Maps PBDB country codes to ISO 3166-1 alpha-2. PBDB mostly uses ISO
 * codes but has a few non-standard ones.
 */
const pbdbCountryMap: Record<string, string> = {
    "UK": "GB",
};

type TaxaRecord = {
    nam: string;
    rnk: number;
    rid: string;
    fea?: number;
    lla?: number;
    tei?: string;
    tli?: string;
    noc?: number;
};

type OccurrenceRecord = {
    oid: string;
    tna: string;
    idn?: string;
    rid: string;
    cc2?: string;
    stp?: string;
    cny?: string;
    sfm?: string;
    sgr?: string;
    lat?: string;
    lng?: string;
    ggc?: string;
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
 * Queries PBDB occurrences for a species filtered to its describing
 * reference. Returns the best type-locality occurrence.
 *
 * @param speciesName - Binomial species name.
 * @param referenceId - PBDB reference ID (e.g., "ref:9259").
 * @returns The best occurrence record, or null.
 */
async function fetchTypeOccurrence(
    speciesName: string,
    referenceId: string,
): Promise<OccurrenceRecord | null>
{
    const encoded = encodeURIComponent(speciesName);
    const refNumber = referenceId.replace("ref:", "");
    const apiUrl = `https://paleobiodb.org/data1.2/occs/list.json?base_name=${encoded}&ref_id=${refNumber}&show=coords,strat,loc&limit=10`;

    const response = await fetchWithRetry(apiUrl);

    if (!response?.ok)
    {
        return null;
    }

    const data = await response.json() as { records: Array<OccurrenceRecord> };

    if (data.records.length === 0)
    {
        return null;
    }

    // Prefer the record with "n. gen." or "n. sp." in the identification
    const typeRecord = data.records.find(
        (record) => record.idn && /n\.\s*(gen|sp)\./i.test(record.idn),
    );

    return typeRecord ?? data.records[0];
}

/**
 * Queries PBDB occurrences for a species without reference filter.
 * Falls back to the first occurrence ordered by creation date.
 *
 * @param speciesName - Binomial species name.
 * @returns The first occurrence record, or null.
 */
async function fetchFirstOccurrence(speciesName: string): Promise<OccurrenceRecord | null>
{
    const encoded = encodeURIComponent(speciesName);
    const apiUrl = `https://paleobiodb.org/data1.2/occs/list.json?base_name=${encoded}&show=coords,strat,loc&limit=5&order=created`;

    const response = await fetchWithRetry(apiUrl);

    if (!response?.ok)
    {
        return null;
    }

    const data = await response.json() as { records: Array<OccurrenceRecord> };

    if (data.records.length === 0)
    {
        return null;
    }

    const typeRecord = data.records.find(
        (record) => record.idn && /n\.\s*(gen|sp)\./i.test(record.idn),
    );

    return typeRecord ?? data.records[0];
}

// Load all genera.
type GenusInfo = {
    genus: string;
    typeSpecies: string;
    filePath: string;
    currentCountry: string | undefined;
    currentRegion: string | undefined;
    currentFormation: string | undefined;
    currentCoordinates: [number, number] | undefined;
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

    generaInfo.push({
        genus: data.genus,
        typeSpecies: typeSpecies.name,
        filePath,
        currentCountry: location?.country,
        currentRegion: location?.region,
        currentFormation: location?.formation,
        currentCoordinates: location?.coordinates,
    });
}

if (limit < Infinity)
{
    generaInfo.splice(limit);
}

console.log(`Loaded ${generaInfo.length} genera`);

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

// Also try genus-level for species not found
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

// Phase 2: fetch type locality occurrences in batches.
console.log("Fetching type locality occurrences...");

type LocationData = {
    country?: string;
    region?: string;
    formation?: string;
    latitude?: number;
    longitude?: number;
};

const pbdbLocations = new Map<string, LocationData>();

/**
 * Extracts location data from an occurrence record.
 *
 * @param occurrence - A PBDB occurrence record.
 * @returns Parsed location data.
 */
function extractLocation(occurrence: OccurrenceRecord): LocationData
{
    const locationData: LocationData = {};

    if (occurrence.cc2)
    {
        locationData.country = pbdbCountryMap[occurrence.cc2] ?? occurrence.cc2;
    }

    if (occurrence.stp)
    {
        locationData.region = occurrence.stp;
    }

    if (occurrence.sfm)
    {
        locationData.formation = occurrence.sfm;
    }

    if (occurrence.lat && occurrence.lng)
    {
        locationData.latitude = parseFloat(occurrence.lat);
        locationData.longitude = parseFloat(occurrence.lng);
    }

    return locationData;
}

// Group genera by describing reference for batched queries.
const byRef = new Map<string, Array<GenusInfo>>();
const noRef: Array<GenusInfo> = [];

for (const info of generaInfo)
{
    const taxaRecord = taxaData.get(info.typeSpecies.toLowerCase())
        ?? taxaData.get(info.genus.toLowerCase());

    if (taxaRecord?.rid)
    {
        const list = byRef.get(taxaRecord.rid) ?? [];
        list.push(info);
        byRef.set(taxaRecord.rid, list);
    }
    else
    {
        noRef.push(info);
    }
}

// Batch fetch: query occurrences for groups of species at once.
const occurrenceBatchSize = 15;
const allInfos = [...generaInfo];
let processed = 0;

for (let offset = 0; offset < allInfos.length; offset += occurrenceBatchSize)
{
    const batch = allInfos.slice(offset, offset + occurrenceBatchSize);
    const speciesInBatch = batch.map((info) => info.typeSpecies);
    const encoded = speciesInBatch.map((name) => encodeURIComponent(name)).join(",");

    const apiUrl = `https://paleobiodb.org/data1.2/occs/list.json?base_name=${encoded}&show=coords,strat,loc&limit=100`;
    const response = await fetchWithRetry(apiUrl);

    if (response?.ok)
    {
        const data = await response.json() as { records: Array<OccurrenceRecord> };

        // Group occurrences by species name
        const bySpecies = new Map<string, Array<OccurrenceRecord>>();

        for (const record of data.records)
        {
            const key = record.tna.toLowerCase();
            const list = bySpecies.get(key) ?? [];
            list.push(record);
            bySpecies.set(key, list);
        }

        // For each genus in the batch, pick the best occurrence
        for (const info of batch)
        {
            const records = bySpecies.get(info.typeSpecies.toLowerCase());

            if (!records || records.length === 0)
            {
                continue;
            }

            const taxaRecord = taxaData.get(info.typeSpecies.toLowerCase())
                ?? taxaData.get(info.genus.toLowerCase());

            // Prefer: n. gen./n. sp. > same ref as describing paper > first record
            let best = records.find(
                (record) => record.idn && /n\.\s*(gen|sp)\./i.test(record.idn),
            );

            if (!best && taxaRecord?.rid)
            {
                best = records.find((record) => record.rid === taxaRecord.rid);
            }

            if (!best)
            {
                best = records[0];
            }

            pbdbLocations.set(info.genus, extractLocation(best));
        }
    }

    processed += batch.length;

    if (processed % 50 < occurrenceBatchSize)
    {
        console.log(`  ${processed}/${allInfos.length}`);
    }

    await sleep(500);
}

console.log(`Fetched locations: ${pbdbLocations.size}/${generaInfo.length}`);

// Phase 3: compare and build changes.
type Change = {
    genus: string;
    field: string;
    oldValue: string;
    newValue: string;
};

const fills: Array<Change> = [];
const corrections: Array<Change> = [];
const noData: Array<string> = [];

for (const info of generaInfo)
{
    const pbdb = pbdbLocations.get(info.genus);

    if (!pbdb)
    {
        noData.push(info.genus);
        continue;
    }

    // Country
    if (pbdb.country)
    {
        if (!info.currentCountry)
        {
            fills.push({ genus: info.genus, field: "country", oldValue: "(empty)", newValue: pbdb.country });
        }
        else if (info.currentCountry !== pbdb.country)
        {
            corrections.push({ genus: info.genus, field: "country", oldValue: info.currentCountry, newValue: pbdb.country });
        }
    }

    // Region
    if (pbdb.region)
    {
        if (!info.currentRegion)
        {
            fills.push({ genus: info.genus, field: "region", oldValue: "(empty)", newValue: pbdb.region });
        }
        else if (info.currentRegion !== pbdb.region)
        {
            corrections.push({ genus: info.genus, field: "region", oldValue: info.currentRegion, newValue: pbdb.region });
        }
    }

    // Formation
    if (pbdb.formation)
    {
        if (!info.currentFormation)
        {
            fills.push({ genus: info.genus, field: "formation", oldValue: "(empty)", newValue: pbdb.formation });
        }
        else if (info.currentFormation !== pbdb.formation)
        {
            corrections.push({ genus: info.genus, field: "formation", oldValue: info.currentFormation, newValue: pbdb.formation });
        }
    }

    // Coordinates
    if (pbdb.latitude !== undefined && pbdb.longitude !== undefined)
    {
        if (!info.currentCoordinates)
        {
            fills.push({
                genus: info.genus,
                field: "coordinates",
                oldValue: "(empty)",
                newValue: `${pbdb.latitude}, ${pbdb.longitude}`,
            });
        }
        else
        {
            const latDiff = Math.abs(info.currentCoordinates[0] - pbdb.latitude);
            const lngDiff = Math.abs(info.currentCoordinates[1] - pbdb.longitude);

            // Flag if more than 1 degree off
            if (latDiff > 1 || lngDiff > 1)
            {
                corrections.push({
                    genus: info.genus,
                    field: "coordinates",
                    oldValue: `${info.currentCoordinates[0]}, ${info.currentCoordinates[1]}`,
                    newValue: `${pbdb.latitude}, ${pbdb.longitude}`,
                });
            }
        }
    }
}

console.log("");
console.log(`Fills (new data):     ${fills.length}`);
console.log(`Corrections (diffs):  ${corrections.length}`);
console.log(`No PBDB location:     ${noData.length}`);

const fillsByField: Record<string, number> = {};
const correctionsByField: Record<string, number> = {};

for (const change of fills)
{
    fillsByField[change.field] = (fillsByField[change.field] ?? 0) + 1;
}

for (const change of corrections)
{
    correctionsByField[change.field] = (correctionsByField[change.field] ?? 0) + 1;
}

console.log("");
console.log("=== Fills by field ===");

for (const [field, count] of Object.entries(fillsByField))
{
    console.log(`  ${field}: ${count}`);
}

console.log("");
console.log("=== Corrections by field ===");

for (const [field, count] of Object.entries(correctionsByField))
{
    console.log(`  ${field}: ${count}`);
}

if (corrections.length > 0)
{
    console.log("");
    console.log("=== Sample corrections ===");

    for (const change of corrections.slice(0, 30))
    {
        console.log(`  ${change.genus}.${change.field}: ${change.oldValue} → ${change.newValue}`);
    }
}

if (!apply)
{
    // Write report
    const reportPath = path.join(root, "reports", "location-pbdb-comparison.json");
    const reportDir = path.dirname(reportPath);

    if (!fs.existsSync(reportDir))
    {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify({ fills, corrections, noData }, null, 2) + "\n", "utf8");
    console.log(`\nWrote reports/location-pbdb-comparison.json`);
    console.log("Dry run. Re-run with --apply to write YAML files.");
    console.log("(Only fills + coordinate corrections are auto-applied; other corrections are for review.)");
    process.exit(0);
}

// Apply: fills (all) + coordinate corrections only.
// Other corrections (country/region/formation mismatches) go to the report
// for human review.
const coordinateCorrections = corrections.filter((change) => change.field === "coordinates");
const reviewOnly = corrections.filter((change) => change.field !== "coordinates");

console.log("");
console.log("Applying fills + coordinate corrections...");
console.log(`  Review-only corrections (not applied): ${reviewOnly.length}`);

if (reviewOnly.length > 0)
{
    const reportPath = path.join(root, "reports", "location-pbdb-corrections.json");
    const reportDir = path.dirname(reportPath);

    if (!fs.existsSync(reportDir))
    {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(reviewOnly, null, 2) + "\n", "utf8");
    console.log("  Wrote reports/location-pbdb-corrections.json for review");
}

const allChanges = [...fills, ...coordinateCorrections];
const changesByGenus = new Map<string, Array<Change>>();

for (const change of allChanges)
{
    const list = changesByGenus.get(change.genus) ?? [];
    list.push(change);
    changesByGenus.set(change.genus, list);
}

let filesWritten = 0;

for (const info of generaInfo)
{
    const genusChanges = changesByGenus.get(info.genus);

    if (!genusChanges || genusChanges.length === 0)
    {
        continue;
    }

    const pbdb = pbdbLocations.get(info.genus);

    if (!pbdb)
    {
        continue;
    }

    const source = fs.readFileSync(info.filePath, "utf8");
    const lines = source.split("\n");

    // Find the type species location block.
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
        for (let index = 0; index < lines.length; index += 1)
        {
            if (lines[index].match(/^\s+-\s+name:\s+/))
            {
                speciesLineIndex = index;
                break;
            }
        }
    }

    if (speciesLineIndex === -1)
    {
        continue;
    }

    const speciesIndent = lines[speciesLineIndex].match(/^(\s*)/)?.[1] ?? "";
    const fieldIndent = speciesIndent + "  ";
    const childIndent = fieldIndent + "  ";

    // Find location block
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

    // Find extent of location block and individual field lines
    let locationEndIndex = locationLineIndex + 1;
    let countryLineIndex = -1;
    let regionLineIndex = -1;
    let formationLineIndex = -1;
    let coordinatesLineIndex = -1;
    let coordinatesEndIndex = -1;

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

        if (line.startsWith(childIndent + "country:"))
        {
            countryLineIndex = locationEndIndex;
        }
        else if (line.startsWith(childIndent + "region:"))
        {
            regionLineIndex = locationEndIndex;
        }
        else if (line.startsWith(childIndent + "formation:"))
        {
            formationLineIndex = locationEndIndex;
        }
        else if (line.startsWith(childIndent + "coordinates:"))
        {
            coordinatesLineIndex = locationEndIndex;
            // Coordinates span 3 lines (header + lat + lng)
            coordinatesEndIndex = locationEndIndex + 3;
        }

        locationEndIndex += 1;
    }

    let modified = false;

    for (const change of genusChanges)
    {
        if (change.field === "country")
        {
            if (countryLineIndex >= 0)
            {
                lines[countryLineIndex] = childIndent + "country: " + change.newValue;
            }
            else
            {
                // Insert after location:
                lines.splice(locationLineIndex + 1, 0, childIndent + "country: " + change.newValue);
                // Adjust indices
                locationEndIndex += 1;

                if (regionLineIndex >= 0)
                {
                    regionLineIndex += 1;
                }

                if (formationLineIndex >= 0)
                {
                    formationLineIndex += 1;
                }

                if (coordinatesLineIndex >= 0)
                {
                    coordinatesLineIndex += 1;
                    coordinatesEndIndex += 1;
                }

                countryLineIndex = locationLineIndex + 1;
            }

            modified = true;
        }
        else if (change.field === "region")
        {
            if (regionLineIndex >= 0)
            {
                lines[regionLineIndex] = childIndent + "region: " + change.newValue;
            }
            else
            {
                // Insert after country (or after location: if no country)
                const insertAfter = countryLineIndex >= 0 ? countryLineIndex : locationLineIndex;

                lines.splice(insertAfter + 1, 0, childIndent + "region: " + change.newValue);
                locationEndIndex += 1;

                if (formationLineIndex >= 0)
                {
                    formationLineIndex += 1;
                }

                if (coordinatesLineIndex >= 0)
                {
                    coordinatesLineIndex += 1;
                    coordinatesEndIndex += 1;
                }

                regionLineIndex = insertAfter + 1;
            }

            modified = true;
        }
        else if (change.field === "formation")
        {
            if (formationLineIndex >= 0)
            {
                lines[formationLineIndex] = childIndent + "formation: " + change.newValue;
            }
            else
            {
                // Insert after region (or country, or location:)
                const insertAfter = regionLineIndex >= 0
                    ? regionLineIndex
                    : countryLineIndex >= 0
                        ? countryLineIndex
                        : locationLineIndex;

                lines.splice(insertAfter + 1, 0, childIndent + "formation: " + change.newValue);
                locationEndIndex += 1;

                if (coordinatesLineIndex >= 0)
                {
                    coordinatesLineIndex += 1;
                    coordinatesEndIndex += 1;
                }

                formationLineIndex = insertAfter + 1;
            }

            modified = true;
        }
        else if (change.field === "coordinates" && pbdb.latitude !== undefined && pbdb.longitude !== undefined)
        {
            const coordLines = [
                childIndent + "coordinates:",
                childIndent + "  - " + pbdb.latitude,
                childIndent + "  - " + pbdb.longitude,
            ];

            if (coordinatesLineIndex >= 0)
            {
                lines.splice(coordinatesLineIndex, coordinatesEndIndex - coordinatesLineIndex, ...coordLines);
            }
            else
            {
                // Insert after formation (or region, or country, or location:)
                const insertAfter = formationLineIndex >= 0
                    ? formationLineIndex
                    : regionLineIndex >= 0
                        ? regionLineIndex
                        : countryLineIndex >= 0
                            ? countryLineIndex
                            : locationLineIndex;

                lines.splice(insertAfter + 1, 0, ...coordLines);
            }

            modified = true;
        }
    }

    if (modified)
    {
        fs.writeFileSync(info.filePath, lines.join("\n"), "utf8");
        filesWritten += 1;
    }
}

console.log(`Done. Updated ${filesWritten} files.`);
