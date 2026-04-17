/**
 * One-off: backfill and correct species temporal data (from_ma, to_ma,
 * stage, period name) using PBDB taxa API as the authority.
 *
 * Queries PBDB for each genus's type species, falls back to genus-level
 * if the species lookup returns no data. Updates from_ma, to_ma, stage
 * list, and period name based on PBDB interval data.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-temporal-from-pbdb.ts [--apply]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parseYaml, findYamlFiles } from "./utilities.ts";
import type { GenusData, Schema } from "./types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const apply = process.argv.includes("--apply");

const schema = parseYaml<Schema>(path.join(root, "schema.yml"));
const stages = schema.stages ?? {};

/**
 * Determines the period name(s) for a set of stages using the schema
 * stage-to-period mapping.
 *
 * @param stageNames - Array of stage names.
 * @returns Deduplicated array of period names in chronological order.
 */
function periodsForStages(stageNames: Array<string>): Array<string>
{
    const periodSet = new Set<string>();

    for (const stage of stageNames)
    {
        const definition = stages[stage];

        if (definition)
        {
            periodSet.add(definition.period);
        }
    }

    // Order: Permian → Triassic → Jurassic → Cretaceous
    const order = [
        "Early Permian", "Middle Permian", "Late Permian",
        "Early Triassic", "Middle Triassic", "Late Triassic",
        "Early Jurassic", "Middle Jurassic", "Late Jurassic",
        "Early Cretaceous", "Late Cretaceous",
    ];

    return order.filter((period) => periodSet.has(period));
}

/**
 * Finds all stages in the schema whose range overlaps the given Ma
 * interval [fromMa, toMa]. Returns them in chronological order
 * (oldest first).
 *
 * @param fromMa - Start of interval (older, larger number).
 * @param toMa - End of interval (younger, smaller number).
 * @returns Array of matching stage names.
 */
function stagesForRange(fromMa: number, toMa: number): Array<string>
{
    const matching: Array<{ name: string; from: number }> = [];

    for (const [name, definition] of Object.entries(stages))
    {
        // Stage overlaps if it starts before the interval ends and ends after the interval starts
        if (definition.from_ma > toMa && definition.to_ma < fromMa)
        {
            matching.push({ name, from: definition.from_ma });
        }
    }

    // Sort oldest first (largest from_ma first)
    matching.sort((left, right) => right.from - left.from);

    return matching.map((entry) => entry.name);
}

type PbdbRecord = {
    nam: string;
    rnk: number;
    fea?: number;
    fla?: number;
    lea?: number;
    lla?: number;
    tei?: string;
    tli?: string;
    noc?: number;
};

/**
 * Queries the PBDB taxa API for a batch of taxon names.
 *
 * @param names - Array of taxon names (genus or binomial).
 * @returns Map of lowercase taxon name to PBDB record.
 */
async function fetchPbdbBatch(names: Array<string>): Promise<Map<string, PbdbRecord>>
{
    const encoded = names.map((name) => encodeURIComponent(name)).join(",");
    const apiUrl = `https://paleobiodb.org/data1.2/taxa/list.json?name=${encoded}&show=app`;

    const response = await fetch(apiUrl);

    if (!response.ok)
    {
        console.error(`PBDB API error: ${response.status}`);
        return new Map();
    }

    const data = await response.json() as { records: Array<PbdbRecord> };
    const result = new Map<string, PbdbRecord>();

    for (const record of data.records)
    {
        result.set(record.nam.toLowerCase(), record);
    }

    return result;
}

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

// Load all genera and extract type species names.
type GenusInfo = {
    genus: string;
    typeSpecies: string;
    filePath: string;
    currentStages: Array<string>;
    currentFromMa: number | undefined;
    currentToMa: number | undefined;
    currentPeriods: Array<string>;
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

    const period = typeSpecies.period;

    generaInfo.push({
        genus: data.genus,
        typeSpecies: typeSpecies.name,
        filePath,
        currentStages: period?.stage ?? [],
        currentFromMa: period?.from_ma,
        currentToMa: period?.to_ma,
        currentPeriods: period?.name ?? [],
    });
}

console.log(`Loaded ${generaInfo.length} genera`);

// Batch query PBDB: first try type species names, then fall back to genus.
const batchSize = 50;
const delayMs = 500;

const pbdbData = new Map<string, PbdbRecord>();

// Phase 1: query by type species name
console.log("Fetching type species from PBDB...");

const speciesNames = generaInfo.map((info) => info.typeSpecies);

for (let offset = 0; offset < speciesNames.length; offset += batchSize)
{
    const batch = speciesNames.slice(offset, offset + batchSize);
    const results = await fetchPbdbBatch(batch);

    for (const [key, record] of results)
    {
        pbdbData.set(key, record);
    }

    process.stdout.write(`  ${Math.min(offset + batchSize, speciesNames.length)}/${speciesNames.length}\r`);

    if (offset + batchSize < speciesNames.length)
    {
        await sleep(delayMs);
    }
}

console.log("");

// Phase 2: for genera not found by species, try genus name
const missingGenera = generaInfo.filter(
    (info) => !pbdbData.has(info.typeSpecies.toLowerCase()),
);

console.log(`Species not found: ${missingGenera.length}, trying genus names...`);

const genusNames = missingGenera.map((info) => info.genus);

for (let offset = 0; offset < genusNames.length; offset += batchSize)
{
    const batch = genusNames.slice(offset, offset + batchSize);
    const results = await fetchPbdbBatch(batch);

    for (const [key, record] of results)
    {
        pbdbData.set(key, record);
    }

    if (offset + batchSize < genusNames.length)
    {
        await sleep(delayMs);
    }
}

console.log(`Total PBDB records: ${pbdbData.size}`);

// Process each genus: compare PBDB data with current data.
type Change = {
    genus: string;
    field: string;
    oldValue: string;
    newValue: string;
};

const changes: Array<Change> = [];
const noData: Array<string> = [];

for (const info of generaInfo)
{
    const record = pbdbData.get(info.typeSpecies.toLowerCase())
        ?? pbdbData.get(info.genus.toLowerCase());

    if (!record || record.fea === undefined || record.lla === undefined)
    {
        noData.push(info.genus);
        continue;
    }

    const pbdbFromMa = record.fea;
    const pbdbToMa = record.lla;

    // Determine stages from PBDB data
    let pbdbStages: Array<string>;

    if (record.tei && record.tli)
    {
        // PBDB provides interval names — use them to build stage list
        const allStages = stagesForRange(pbdbFromMa, pbdbToMa);

        // Filter to just the range tei..tli
        const teiIndex = allStages.indexOf(record.tei);
        const tliIndex = allStages.indexOf(record.tli);

        if (teiIndex >= 0 && tliIndex >= 0)
        {
            pbdbStages = allStages.slice(teiIndex, tliIndex + 1);
        }
        else
        {
            pbdbStages = allStages;
        }
    }
    else if (record.tei && !record.tli)
    {
        pbdbStages = [record.tei];
    }
    else
    {
        pbdbStages = stagesForRange(pbdbFromMa, pbdbToMa);
    }

    if (pbdbStages.length === 0)
    {
        pbdbStages = stagesForRange(pbdbFromMa, pbdbToMa);
    }

    const pbdbPeriods = periodsForStages(pbdbStages);

    // Compare and record changes
    const currentStagesStr = info.currentStages.join(", ");
    const pbdbStagesStr = pbdbStages.join(", ");

    if (currentStagesStr !== pbdbStagesStr && pbdbStages.length > 0)
    {
        changes.push({
            genus: info.genus,
            field: "stage",
            oldValue: currentStagesStr || "(empty)",
            newValue: pbdbStagesStr,
        });
    }

    const currentPeriodsStr = info.currentPeriods.join(", ");
    const pbdbPeriodsStr = pbdbPeriods.join(", ");

    if (currentPeriodsStr !== pbdbPeriodsStr && pbdbPeriods.length > 0)
    {
        changes.push({
            genus: info.genus,
            field: "period",
            oldValue: currentPeriodsStr || "(empty)",
            newValue: pbdbPeriodsStr,
        });
    }

    if (info.currentFromMa !== pbdbFromMa)
    {
        changes.push({
            genus: info.genus,
            field: "from_ma",
            oldValue: String(info.currentFromMa ?? "(empty)"),
            newValue: String(pbdbFromMa),
        });
    }

    if (info.currentToMa !== pbdbToMa)
    {
        changes.push({
            genus: info.genus,
            field: "to_ma",
            oldValue: String(info.currentToMa ?? "(empty)"),
            newValue: String(pbdbToMa),
        });
    }
}

// Report
const generaWithChanges = new Set(changes.map((change) => change.genus));

console.log("");
console.log(`Genera with changes: ${generaWithChanges.size}`);
console.log(`Total field changes: ${changes.length}`);
console.log(`No PBDB data: ${noData.length}`);

const byField: Record<string, number> = {};

for (const change of changes)
{
    byField[change.field] = (byField[change.field] ?? 0) + 1;
}

for (const [field, count] of Object.entries(byField))
{
    console.log(`  ${field}: ${count} changes`);
}

if (noData.length > 0 && noData.length <= 30)
{
    console.log("");
    console.log("=== No PBDB data ===");

    for (const genus of noData)
    {
        console.log(`  ${genus}`);
    }
}
else if (noData.length > 30)
{
    console.log(`\n(${noData.length} genera without PBDB temporal data — not listed)`);
}

// Show sample changes
const sampleChanges = changes.filter((change) => change.oldValue !== "(empty)").slice(0, 20);

if (sampleChanges.length > 0)
{
    console.log("");
    console.log("=== Sample corrections (existing → PBDB) ===");

    for (const change of sampleChanges)
    {
        console.log(`  ${change.genus}.${change.field}: ${change.oldValue} → ${change.newValue}`);
    }
}

if (!apply)
{
    console.log("");
    console.log("Dry run. Re-run with --apply to write YAML files.");
    process.exit(0);
}

// Apply changes using text insertion approach.
console.log("");
console.log("Applying changes...");

let filesWritten = 0;

for (const info of generaInfo)
{
    const record = pbdbData.get(info.typeSpecies.toLowerCase())
        ?? pbdbData.get(info.genus.toLowerCase());

    if (!record || record.fea === undefined || record.lla === undefined)
    {
        continue;
    }

    const pbdbFromMa = record.fea;
    const pbdbToMa = record.lla;

    let pbdbStages: Array<string>;

    if (record.tei && record.tli)
    {
        const allStages = stagesForRange(pbdbFromMa, pbdbToMa);
        const teiIndex = allStages.indexOf(record.tei);
        const tliIndex = allStages.indexOf(record.tli);

        if (teiIndex >= 0 && tliIndex >= 0)
        {
            pbdbStages = allStages.slice(teiIndex, tliIndex + 1);
        }
        else
        {
            pbdbStages = allStages;
        }
    }
    else if (record.tei && !record.tli)
    {
        pbdbStages = [record.tei];
    }
    else
    {
        pbdbStages = stagesForRange(pbdbFromMa, pbdbToMa);
    }

    if (pbdbStages.length === 0)
    {
        pbdbStages = stagesForRange(pbdbFromMa, pbdbToMa);
    }

    const pbdbPeriods = periodsForStages(pbdbStages);

    // Check if anything actually changed
    const stagesMatch = info.currentStages.join(",") === pbdbStages.join(",");
    const periodsMatch = info.currentPeriods.join(",") === pbdbPeriods.join(",");
    const fromMatch = info.currentFromMa === pbdbFromMa;
    const toMatch = info.currentToMa === pbdbToMa;

    if (stagesMatch && periodsMatch && fromMatch && toMatch)
    {
        continue;
    }

    // Rewrite the period block using text manipulation
    const source = fs.readFileSync(info.filePath, "utf8");
    const lines = source.split("\n");

    // Find the period block for the type species
    let periodLineIndex = -1;
    let speciesLineIndex = -1;

    // Find the type species entry first
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
        // Try first species
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

    // Find period: within this species block
    const speciesIndent = lines[speciesLineIndex].match(/^(\s*)/)?.[1] ?? "";
    const fieldIndent = speciesIndent + "  ";

    for (let index = speciesLineIndex + 1; index < lines.length; index += 1)
    {
        // Stop if we hit the next species or a non-indented line
        if (index > speciesLineIndex + 1 && lines[index].match(/^\s+-\s+name:/))
        {
            break;
        }

        if (lines[index] === fieldIndent + "period:")
        {
            periodLineIndex = index;
            break;
        }
    }

    if (periodLineIndex === -1)
    {
        continue;
    }

    // Find the extent of the period block
    const periodChildIndent = fieldIndent + "  ";
    let periodEndIndex = periodLineIndex + 1;

    while (periodEndIndex < lines.length)
    {
        const line = lines[periodEndIndex];

        if (line.length === 0)
        {
            periodEndIndex += 1;
            continue;
        }

        if (!line.startsWith(periodChildIndent))
        {
            break;
        }

        periodEndIndex += 1;
    }

    // Build the new period block
    const newPeriodLines: Array<string> = [];

    newPeriodLines.push(fieldIndent + "period:");
    newPeriodLines.push(periodChildIndent + "name:");

    for (const period of pbdbPeriods)
    {
        newPeriodLines.push(periodChildIndent + "  - " + period);
    }

    newPeriodLines.push(periodChildIndent + "stage:");

    for (const stage of pbdbStages)
    {
        newPeriodLines.push(periodChildIndent + "  - " + stage);
    }

    newPeriodLines.push(periodChildIndent + "from_ma: " + pbdbFromMa);
    newPeriodLines.push(periodChildIndent + "to_ma: " + pbdbToMa);

    // Replace the old period block
    lines.splice(periodLineIndex, periodEndIndex - periodLineIndex, ...newPeriodLines);

    fs.writeFileSync(info.filePath, lines.join("\n"), "utf8");
    filesWritten += 1;
}

console.log(`Done. Updated ${filesWritten} files.`);
