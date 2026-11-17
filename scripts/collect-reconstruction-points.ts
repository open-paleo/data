import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import type { GenusData } from "./types.ts";
import { findYamlFiles, loadSchema, parseYaml, computeMidpointAge } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const root = path.join(scriptDir, "..");

/**
 * One locality for scripts/plate-reconstruction/reconstruct-points.py to reconstruct: a present-day
 * point, or the region or country whose center stands in for one, at an age.
 */
type ReconstructionPoint = {
    /**
     * Genus and species name joined by "|".
     */
    id: string;

    /**
     * The age to reconstruct at, in millions of years.
     */
    age_ma: number;

    /**
     * Present-day latitude, when the record has coordinates.
     */
    latitude?: number;

    /**
     * Present-day longitude, when the record has coordinates.
     */
    longitude?: number;

    /**
     * ISO 3166-2 region code, when the record has no coordinates.
     */
    region?: string;

    /**
     * ISO 3166-1 country code, when the record has neither.
     */
    country?: string;
};

const stages = loadSchema(root).stages ?? {};
const points = new Array<ReconstructionPoint>();
const undated = new Array<string>();
const unplaced = new Array<string>();

for (const file of findYamlFiles(path.join(root, "genera")))
{
    const genus = parseYaml<GenusData>(file);

    for (const species of genus?.species ?? [ ])
    {
        const id = `${genus.genus}|${species.name}`;
        const ageMa = computeMidpointAge(species.period, stages);
        const location = species.location;

        if (ageMa === undefined)
        {
            undated.push(id);
        }
        else if (location?.coordinates)
        {
            points.push({ id, age_ma: ageMa, latitude: location.coordinates[0], longitude: location.coordinates[1] });
        }
        else if (location?.region)
        {
            points.push({ id, age_ma: ageMa, region: location.region });
        }
        else if (location?.country)
        {
            points.push({ id, age_ma: ageMa, country: location.country });
        }
        else
        {
            unplaced.push(id);
        }
    }
}

const outputDir = path.join(root, "scratch", "plate-reconstruction");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "points.json"), JSON.stringify(points, null, 2) + "\n");

console.log(`Wrote ${points.length} localities to scratch/plate-reconstruction/points.json.`);

if (undated.length > 0)
{
    console.log(`No age for ${undated.length}: ${undated.join(", ")}`);
}

if (unplaced.length > 0)
{
    console.log(`No location for ${unplaced.length}: ${unplaced.join(", ")}`);
}
