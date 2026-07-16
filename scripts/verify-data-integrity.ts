/**
 * Tier 0 data-integrity audit: deterministic self-consistency checks over
 * all genera to surface likely-spurious values — coordinates, specimen
 * IDs, formations, and ages that belong to a different species or
 * specimen (often PBDB-seeded). Emits a grouped report to
 * reports/audit/data-integrity.md and a per-check summary to stdout.
 * No external source, no LLM.
 *
 * See .claude/plans/data-quality-scan.md for the full plan.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse as parseYamlContent } from "yaml";

import { findYamlFiles, loadInstitutionRegistry } from "./utilities.ts";

import type { GenusData, InstitutionEntry, Schema, StageInfo } from "./types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

/**
 * A generous rectangular bounding box for a country, in decimal degrees.
 * Boxes are deliberately coarse: the aim is to catch gross misplacement
 * (wrong continent/hemisphere), not border-level precision.
 */
type BoundingBox =
    {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    };

/**
 * Coarse bounding boxes keyed by ISO 3166-1 alpha-2 code, covering every
 * country that currently appears in genera/. Mainland-focused; offshore
 * territories are folded in where fossil-bearing (e.g. Spain's Canaries).
 */
const countryBoundingBoxes: Record<string, BoundingBox> =
    {
        AO: { minLat: -18.5, maxLat: -3.5, minLon: 11, maxLon: 24.5 },
        AQ: { minLat: -90, maxLat: -59, minLon: -180, maxLon: 180 },
        AR: { minLat: -56.5, maxLat: -21, minLon: -74, maxLon: -52.5 },
        AT: { minLat: 46, maxLat: 49.2, minLon: 9, maxLon: 17.5 },
        AU: { minLat: -44.5, maxLat: -9.5, minLon: 112, maxLon: 154.5 },
        BE: { minLat: 49.4, maxLat: 51.7, minLon: 2.4, maxLon: 6.5 },
        BR: { minLat: -34.5, maxLat: 6, minLon: -74.5, maxLon: -33.5 },
        CA: { minLat: 41, maxLat: 84, minLon: -141.5, maxLon: -52 },
        CH: { minLat: 45.7, maxLat: 48, minLon: 5.8, maxLon: 10.7 },
        CL: { minLat: -56.5, maxLat: -17, minLon: -76.5, maxLon: -65.5 },
        CN: { minLat: 17.5, maxLat: 54.5, minLon: 73, maxLon: 135.5 },
        CO: { minLat: -4.5, maxLat: 13.5, minLon: -79.5, maxLon: -66.5 },
        CZ: { minLat: 48.4, maxLat: 51.2, minLon: 12, maxLon: 19 },
        DE: { minLat: 47, maxLat: 55.2, minLon: 5.8, maxLon: 15.1 },
        DK: { minLat: 54.4, maxLat: 57.9, minLon: 8, maxLon: 15.3 },
        DZ: { minLat: 18, maxLat: 37.2, minLon: -8.8, maxLon: 12.1 },
        EC: { minLat: -5.2, maxLat: 1.6, minLon: -81.2, maxLon: -75 },
        EG: { minLat: 21.5, maxLat: 31.8, minLon: 24, maxLon: 37.1 },
        ES: { minLat: 27, maxLat: 44, minLon: -18.3, maxLon: 4.5 },
        FR: { minLat: 41, maxLat: 51.2, minLon: -5.3, maxLon: 9.7 },
        GB: { minLat: 49.7, maxLat: 61.1, minLon: -8.8, maxLon: 1.9 },
        GL: { minLat: 59, maxLat: 84, minLon: -74, maxLon: -10.5 },
        HR: { minLat: 42.2, maxLat: 46.6, minLon: 13.3, maxLon: 19.5 },
        HU: { minLat: 45.6, maxLat: 48.7, minLon: 16, maxLon: 23 },
        IN: { minLat: 6, maxLat: 35.7, minLon: 68, maxLon: 97.5 },
        IT: { minLat: 35.4, maxLat: 47.2, minLon: 6.5, maxLon: 18.6 },
        JP: { minLat: 24, maxLat: 46, minLon: 122, maxLon: 146.5 },
        KG: { minLat: 39, maxLat: 43.3, minLon: 69, maxLon: 80.4 },
        KR: { minLat: 33, maxLat: 38.7, minLon: 125, maxLon: 130.1 },
        KZ: { minLat: 40.5, maxLat: 55.5, minLon: 46, maxLon: 87.4 },
        LA: { minLat: 13.9, maxLat: 22.6, minLon: 100, maxLon: 108 },
        LS: { minLat: -30.7, maxLat: -28.5, minLon: 27, maxLon: 29.5 },
        MA: { minLat: 20.5, maxLat: 36, minLon: -17.2, maxLon: -0.9 },
        MG: { minLat: -25.8, maxLat: -11.8, minLon: 43, maxLon: 50.7 },
        MN: { minLat: 41.5, maxLat: 52.2, minLon: 87.7, maxLon: 120 },
        MW: { minLat: -17.2, maxLat: -9.3, minLon: 32.6, maxLon: 36 },
        MX: { minLat: 14.4, maxLat: 32.8, minLon: -118.6, maxLon: -86.6 },
        NE: { minLat: 11.6, maxLat: 23.6, minLon: 0, maxLon: 16 },
        NL: { minLat: 50.7, maxLat: 53.7, minLon: 3.3, maxLon: 7.3 },
        PK: { minLat: 23.5, maxLat: 37.2, minLon: 60.8, maxLon: 77.9 },
        PL: { minLat: 49, maxLat: 55, minLon: 14, maxLon: 24.2 },
        PT: { minLat: 32, maxLat: 42.2, minLon: -31.4, maxLon: -6.1 },
        RO: { minLat: 43.5, maxLat: 48.3, minLon: 20.2, maxLon: 29.8 },
        RU: { minLat: 41, maxLat: 82, minLon: 19, maxLon: 180 },
        TH: { minLat: 5.5, maxLat: 20.5, minLon: 97.3, maxLon: 105.7 },
        TJ: { minLat: 36.6, maxLat: 41.1, minLon: 67.3, maxLon: 75.2 },
        TN: { minLat: 30, maxLat: 37.6, minLon: 7.5, maxLon: 11.7 },
        TZ: { minLat: -11.8, maxLat: -0.9, minLon: 29.3, maxLon: 40.5 },
        UA: { minLat: 44, maxLat: 52.4, minLon: 22, maxLon: 40.3 },
        US: { minLat: 18, maxLat: 72, minLon: -168, maxLon: -66 },
        UY: { minLat: -35, maxLat: -30, minLon: -58.5, maxLon: -53 },
        UZ: { minLat: 37, maxLat: 45.7, minLon: 55.9, maxLon: 73.2 },
        VE: { minLat: 0.6, maxLat: 12.3, minLon: -73.4, maxLon: -59.8 },
        ZA: { minLat: -35, maxLat: -22, minLon: 16.4, maxLon: 33.1 },
        ZW: { minLat: -22.5, maxLat: -15.6, minLon: 25.2, maxLon: 33.1 },
    };

/**
 * A single audit finding.
 */
type Finding =
    {
        check: string;
        genus: string;
        species: string;
        detail: string;
    };

const findings = new Array<Finding>();

/**
 * Records a finding for later grouping and reporting.
 *
 * @param check - The check name (used as the report grouping key).
 * @param genus - The genus the finding concerns.
 * @param species - The species the finding concerns (or "-" for genus-level).
 * @param detail - A human-readable description of the problem.
 * @returns Nothing.
 */
function report(check: string, genus: string, species: string, detail: string): void
{
    findings.push({ check, genus, species, detail });
}

/**
 * Extracts the leading institution-code prefix from a specimen catalogue
 * number — the maximal run of letters at the start (e.g. "IVPP V 4024-1"
 * yields "IVPP", "V235" yields "V").
 *
 * @param specimenId - A catalogue number string.
 * @returns The leading alphabetic prefix, or null if none is present.
 */
function specimenPrefix(specimenId: string): string | null
{
    const match = specimenId.trim().match(/^[A-Za-z]+/);

    return match ? match[0] : null;
}

/**
 * Normalizes a formation name for grouping (trims, collapses whitespace,
 * strips a trailing "Formation"/"Fm" word, lowercases).
 *
 * @param formation - The raw formation string.
 * @returns A normalized key.
 */
function normalizeFormation(formation: string): string
{
    return formation
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\s+(formation|fm\.?|beds|member|group)$/i, "")
        .toLowerCase();
}

const registry = loadInstitutionRegistry(path.join(root, "institutions.yaml"));

const schema = parseYamlContent(fs.readFileSync(path.join(root, "schema.yml"), "utf8")) as Schema;
const stages: Record<string, StageInfo> = schema.stages ?? {};

/**
 * Formations that legitimately straddle a national border, keyed by their
 * normalized name to the set of ISO country codes they span. Members in any
 * of these countries are not country outliers.
 */
const crossBorderFormations: Record<string, Array<string>> =
    {
        "elliot": ["ZA", "LS"],
        "st. mary river": ["CA", "US"],
        "la quinta": ["VE", "CO"],
        "klettgau": ["CH", "DE"],
        "aguja": ["US", "MX"],
    };

/**
 * The maximum age gap (in millions of years) tolerated between a formation
 * member and its nearest sibling before the member is flagged as a stage
 * outlier. Adjacent/overlapping stages within one formation are normal;
 * only a large gap (e.g. a Cenomanian record in an all-Maastrichtian
 * formation) signals a likely error.
 */
const stageOutlierGapMa = 20;

/**
 * Resolves a species record's age interval as [younger_ma, older_ma],
 * preferring explicit from_ma/to_ma and falling back to the union of its
 * listed stages' ranges.
 *
 * @param record - The species record.
 * @returns The [younger, older] Ma interval, or null if unresolvable.
 */
function maInterval(record: SpeciesRecord): [number, number] | null
{
    if (typeof record.fromMa === "number" && typeof record.toMa === "number")
    {
        return [record.toMa, record.fromMa];
    }

    const resolved = record.stageList
        .map((stageName) => stages[stageName])
        .filter((info): info is StageInfo => info !== undefined);

    if (resolved.length === 0)
    {
        return null;
    }

    return [Math.min(...resolved.map((info) => info.to_ma)), Math.max(...resolved.map((info) => info.from_ma))];
}

/**
 * Gap in millions of years between two age intervals; zero when they overlap.
 *
 * @param first - The first [younger, older] interval.
 * @param second - The second [younger, older] interval.
 * @returns The non-negative gap between the intervals.
 */
function intervalGap(first: [number, number], second: [number, number]): number
{
    return Math.max(first[0] - second[1], second[0] - first[1], 0);
}

/**
 * Builds a lookup from every institution code and alias to the set of
 * canonical codes it can resolve to.
 *
 * @param institutions - The parsed institution registry.
 * @returns A map from code/alias to the set of canonical codes.
 */
function buildCodeResolver(institutions: Record<string, InstitutionEntry>): Map<string, Set<string>>
{
    const resolver = new Map<string, Set<string>>();

    /**
     * Adds a code → canonical mapping to the resolver.
     *
     * @param code - The code or alias.
     * @param canonical - The canonical key it resolves to.
     * @returns Nothing.
     */
    function add(code: string, canonical: string): void
    {
        const key = code.trim();
        const existing = resolver.get(key) ?? new Set<string>();

        existing.add(canonical);
        resolver.set(key, existing);
    }

    for (const [canonical, entry] of Object.entries(institutions))
    {
        add(canonical, canonical);

        // A canonical key may itself carry an ISO/city suffix (e.g. MOR-US);
        // let the bare stem resolve too so a bare literature prefix matches.
        const bareStem = canonical.split("-")[0];

        if (bareStem !== canonical)
        {
            add(bareStem, canonical);
        }

        for (const alias of entry.aliases ?? [])
        {
            add(alias, canonical);
        }
    }

    return resolver;
}

const codeResolver = buildCodeResolver(registry);

const genusFiles = findYamlFiles(path.join(root, "genera"));

/**
 * A flattened per-species record used across checks.
 */
type SpeciesRecord =
    {
        genus: string;
        species: string;
        country?: string;
        formation?: string;
        coordinates?: [number, number];
        stageList: Array<string>;
        fromMa?: number;
        toMa?: number;
        specimenIds: Array<string>;
        institution?: string;
    };

const speciesRecords = new Array<SpeciesRecord>();

for (const filePath of genusFiles)
{
    let doc: GenusData;

    try
    {
        doc = parseYamlContent(fs.readFileSync(filePath, "utf8")) as GenusData;
    }
    catch
    {
        continue;
    }

    if (!doc || !Array.isArray(doc.species))
    {
        continue;
    }

    const genusName = doc.genus ?? path.basename(filePath, path.extname(filePath));

    for (const species of doc.species)
    {
        if (!species)
        {
            continue;
        }

        const location = species.location ?? {};
        const period = species.period ?? {};
        const typeSpecimen = species.type_specimen ?? {};

        speciesRecords.push({
            genus: genusName,
            species: species.name ?? "?",
            country: location.country,
            formation: location.formation,
            coordinates: location.coordinates,
            stageList: Array.isArray(period.stage) ? period.stage : new Array<string>(),
            fromMa: period.from_ma,
            toMa: period.to_ma,
            specimenIds: Array.isArray(typeSpecimen.specimen_id) ? typeSpecimen.specimen_id : new Array<string>(),
            institution: typeSpecimen.institution,
        });
    }
}

// Check 1 — coordinate falls outside the stated country's bounding box.
for (const record of speciesRecords)
{
    if (!record.coordinates || !record.country)
    {
        continue;
    }

    const box = countryBoundingBoxes[record.country];

    if (!box)
    {
        report("unknown-country-code", record.genus, record.species,
            `country '${record.country}' has no bounding box in the audit table`);
    }
    else
    {
        const [lat, lon] = record.coordinates;

        if (typeof lat !== "number" || typeof lon !== "number")
        {
            continue;
        }
        else if (lat < box.minLat || lat > box.maxLat || lon < box.minLon || lon > box.maxLon)
        {
            report("coordinate-outside-country", record.genus, record.species,
                `[${lat}, ${lon}] is outside ${record.country} (${box.minLat}..${box.maxLat}, ${box.minLon}..${box.maxLon})`);
        }
    }
}

// Check 2 — the same type specimen_id appears under more than one genus.
const specimenOwners = new Map<string, Set<string>>();

for (const record of speciesRecords)
{
    for (const specimenId of record.specimenIds)
    {
        const key = specimenId.trim();

        if (key.length === 0)
        {
            continue;
        }

        const owners = specimenOwners.get(key) ?? new Set<string>();

        owners.add(record.genus);
        specimenOwners.set(key, owners);
    }
}

for (const [specimenId, owners] of specimenOwners)
{
    if (owners.size > 1)
    {
        report("specimen-id-collision", [...owners].sort().join(", "), "-",
            `specimen_id '${specimenId}' is shared across ${owners.size} genera`);
    }
}

// Check 3 — specimen prefix does not resolve to the institution (alias-aware).
for (const record of speciesRecords)
{
    if (!record.institution || record.specimenIds.length === 0)
    {
        continue;
    }

    const firstId = record.specimenIds[0];

    // Institution codes conventionally lead the catalogue number. When the
    // number instead opens with a digit it is a bare field/collection number
    // with no embedded code (e.g. HGM "41HIII-0100", "1912VIII61") — there is
    // nothing to verify against, so skip rather than flag a false positive.
    if (!/^[A-Za-z]/.test(firstId.trim()))
    {
        continue;
    }

    const institutionKey = record.institution.trim();
    const institutionCanonicals = codeResolver.get(institutionKey);

    // The catalogue code may sit anywhere in the number, not just at the
    // front: "PM TGU 16/4-20" (TGU), "Pv-6127-MOZ" (MOZ), "SNSB-BSPG AS I
    // 563" (BSPG). Treat it as a match when any token of the number resolves
    // to the institution's canonical, or when a space-bearing institution
    // key is a literal prefix of the number ("FMNH CUP 2338", "NMV P186303").
    const tokens = firstId.split(/[\s.\-/:()]+/).filter((token) => token.length > 0);

    // Each token is a candidate code; so is its leading-alpha run, since the
    // code and number are often run together ("PVSJ845" → "PVSJ", "V9065" → "V").
    const candidates = new Set<string>();

    for (const token of tokens)
    {
        candidates.add(token);

        const leadingAlpha = specimenPrefix(token);

        if (leadingAlpha)
        {
            candidates.add(leadingAlpha);
        }
    }

    let resolves = false;

    if (institutionCanonicals)
    {
        for (const candidate of candidates)
        {
            const candidateCanonicals = codeResolver.get(candidate);

            if (candidateCanonicals && [...candidateCanonicals].some((canonical) => institutionCanonicals.has(canonical)))
            {
                resolves = true;
                break;
            }
        }
    }

    if (!resolves && institutionKey.includes(" ") && firstId.startsWith(institutionKey))
    {
        resolves = true;
    }

    if (!resolves)
    {
        const prefix = specimenPrefix(firstId) ?? firstId;

        report("specimen-prefix-institution-mismatch", record.genus, record.species,
            `specimen '${firstId}' (prefix '${prefix}') does not resolve to institution '${record.institution}'`);
    }
}

// Check 4 — formation self-consistency (country majority + stage overlap).
const formationGroups = new Map<string, Array<SpeciesRecord>>();

for (const record of speciesRecords)
{
    if (!record.formation)
    {
        continue;
    }

    const key = normalizeFormation(record.formation);

    if (key.length === 0)
    {
        continue;
    }

    const group = formationGroups.get(key) ?? new Array<SpeciesRecord>();

    group.push(record);
    formationGroups.set(key, group);
}

for (const group of formationGroups.values())
{
    // Distinct genera only — multiple species of one genus should not
    // masquerade as agreement.
    const generaInGroup = new Set(group.map((record) => record.genus));

    if (generaInGroup.size < 2)
    {
        continue;
    }

    // Majority country across the formation's members.
    const countryTally = new Map<string, number>();

    for (const record of group)
    {
        if (record.country)
        {
            countryTally.set(record.country, (countryTally.get(record.country) ?? 0) + 1);
        }
    }

    let majorityCountry: string | null = null;
    let majorityCount = 0;

    for (const [country, count] of countryTally)
    {
        if (count > majorityCount)
        {
            majorityCountry = country;
            majorityCount = count;
        }
    }

    // Countries this formation may legitimately span: its majority plus any
    // cross-border allowlist entry.
    const formationKey = normalizeFormation(group[0].formation ?? "");
    const acceptableCountries = new Set(crossBorderFormations[formationKey] ?? []);

    // Fissure-fill deposits legitimately span wide age ranges (separate
    // fissures in one quarry are different ages), so they are exempt from the
    // stage-distance test.
    const isFissureFill = formationKey.includes("fissure");

    if (majorityCountry)
    {
        acceptableCountries.add(majorityCountry);
    }

    // Age intervals, precomputed for the stage-distance test.
    const intervals = group.map((record) => maInterval(record));

    for (let i = 0; i < group.length; i++)
    {
        const record = group[i];

        if (majorityCountry && majorityCount >= 2 && record.country && !acceptableCountries.has(record.country))
        {
            report("formation-country-outlier", record.genus, record.species,
                `formation '${record.formation}' is mostly ${majorityCountry} but this record is ${record.country}`);
        }

        // Stage outlier: flagged only when the member's age is far (> gap
        // threshold) from every other genus in the formation. Adjacent or
        // overlapping stages between siblings produce no gap.
        const interval = intervals[i];

        if (interval && !isFissureFill)
        {
            let minGap = Infinity;

            for (let j = 0; j < group.length; j++)
            {
                const other = intervals[j];

                if (j !== i && group[j].genus !== record.genus && other)
                {
                    minGap = Math.min(minGap, intervalGap(interval, other));
                }
            }

            if (minGap !== Infinity && minGap > stageOutlierGapMa)
            {
                report("formation-stage-outlier", record.genus, record.species,
                    `age ${interval[1]}–${interval[0]} Ma is ${minGap.toFixed(1)} Ma from the nearest sibling in formation '${record.formation}'`);
            }
        }
    }
}

// Check 5 — implausibly wide period span (aggregated-occurrence smell).
const wideStageThreshold = 5;
const wideMaThreshold = 40;

for (const record of speciesRecords)
{
    const reasons = new Array<string>();

    if (record.stageList.length >= wideStageThreshold)
    {
        reasons.push(`${record.stageList.length} stages`);
    }

    if (typeof record.fromMa === "number" && typeof record.toMa === "number")
    {
        const span = record.fromMa - record.toMa;

        if (span >= wideMaThreshold)
        {
            reasons.push(`${span.toFixed(1)} Ma span`);
        }
    }

    if (reasons.length > 0)
    {
        report("period-span-too-wide", record.genus, record.species,
            `${reasons.join(", ")} (${record.stageList.join("/")})`);
    }
}

// Group findings by check for the report and summary.
const byCheck = new Map<string, Array<Finding>>();

for (const finding of findings)
{
    const group = byCheck.get(finding.check) ?? new Array<Finding>();

    group.push(finding);
    byCheck.set(finding.check, group);
}

const orderedChecks = [...byCheck.keys()].sort((a, b) =>
    (byCheck.get(b)?.length ?? 0) - (byCheck.get(a)?.length ?? 0));

const reportLines = new Array<string>();

reportLines.push("# Tier 0 data-quality audit");
reportLines.push("");
reportLines.push(`Scanned ${genusFiles.length} genus files, ${speciesRecords.length} species records.`);
reportLines.push("");
reportLines.push("## Summary");
reportLines.push("");

for (const check of orderedChecks)
{
    reportLines.push(`- **${check}**: ${byCheck.get(check)?.length ?? 0}`);
}

reportLines.push("");

for (const check of orderedChecks)
{
    const group = byCheck.get(check) ?? new Array<Finding>();

    reportLines.push(`## ${check} (${group.length})`);
    reportLines.push("");

    for (const finding of group.sort((a, b) => a.genus.localeCompare(b.genus)))
    {
        const label = finding.species === "-" ? finding.genus : `${finding.genus} — ${finding.species}`;

        reportLines.push(`- ${label}: ${finding.detail}`);
    }

    reportLines.push("");
}

const reportDir = path.join(root, "reports", "audit");

fs.mkdirSync(reportDir, { recursive: true });

const reportPath = path.join(reportDir, "data-integrity.md");

fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8");

console.log(`Scanned ${genusFiles.length} genus files, ${speciesRecords.length} species records.`);
console.log("");
console.log("Findings by check:");

for (const check of orderedChecks)
{
    console.log(`  ${check}: ${byCheck.get(check)?.length ?? 0}`);
}

console.log("");
console.log(`Total findings: ${findings.length}`);
console.log(`Report: ${path.relative(root, reportPath)}`);
