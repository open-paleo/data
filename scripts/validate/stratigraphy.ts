// Checks on the stratigraphy registry and the units and ages records cite.

import * as fs from "node:fs";
import * as path from "node:path";

import type { Species } from "../types.ts";
import { checkError, checkWarning } from "./report.ts";
import type { ValidationContext } from "./context.ts";

/**
 * The "Registry containment" check.
 *
 * 10a-ter. Registry containment — a `parent` names another entry
 *
 * Containment is stored only on the child, so a parent nobody has an entry for
 * is a break in the chain: the child's rank and age cannot be read against
 * anything. Standing rule — every unit named as a parent gets its own entry.
 *
 * @param context - The loaded data the checks read.
 */
export function checkRegistryContainment(context: ValidationContext): void
{
    const {
        stratigraphy,
        stratigraphyFile,
        unitByName,
    } = context;

    for (const [unitName, unit] of Object.entries(stratigraphy ?? {}))
    {
        const parent = unit?.parent;

        if (typeof parent === "string" && !unitByName.has(parent))
        {
            checkError(
                "Registry containment",
                stratigraphyFile(unitName),
                `${unitName}: parent '${parent}' has no entry of its own`);
        }
    }
}

/**
 * The "Registry file layout" check.
 *
 * 10a-quater. Registry file layout — one unit per file, named after the unit
 *
 * The registry is a directory rather than one document, so the filename is how
 * a unit is found and the `name` field is what it is called. They have to
 * agree, or a unit is unreachable by the name everything else uses for it.
 *
 * @param context - The loaded data the checks read.
 */
export function checkRegistryFileLayout(context: ValidationContext): void
{
    const {
        stratigraphyDirectory,
        stratigraphyLayout,
    } = context;

    for (const [filePath, problem] of stratigraphyLayout)
    {
        checkError("Registry file layout", filePath, problem);
    }

    for (const bucket of fs.readdirSync(stratigraphyDirectory, { withFileTypes: true }))
    {
        if (bucket.name.startsWith("."))
        {
            continue;
        }
        else if (!bucket.isDirectory())
        {
            checkError(
                "Registry file layout",
                path.join(stratigraphyDirectory, bucket.name),
                `'${bucket.name}' sits beside the letter directories; the registry holds one file per unit under stratigraphy/<letter>/`);
            continue;
        }

        for (const entry of fs.readdirSync(path.join(stratigraphyDirectory, bucket.name), { withFileTypes: true }))
        {
            if (entry.name.startsWith("."))
            {
                continue;
            }
            else if (!entry.isFile() || !entry.name.endsWith(".yml"))
            {
                checkError(
                    "Registry file layout",
                    path.join(stratigraphyDirectory, bucket.name, entry.name),
                    `'${entry.name}' is not a .yml file, so no registry check reads it`);
            }
        }
    }
}

/**
 * The "Location completeness" check.
 *
 * Location completeness — country required if location present
 *
 * @param context - The loaded data the checks read.
 */
export function checkLocationCompleteness(context: ValidationContext): void
{
    const {
        genusParsed,
    } = context;

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc || !Array.isArray(doc.species))
        {
            continue;
        }

        for (const species of doc.species)
        {
            // A record whose provenance is genuinely unknown carries a location
            // block holding nothing but the note that explains why -- Raptorex,
            // whose holotype reached science through the fossil trade with no
            // collection record. Any other field means a place is being claimed,
            // and a claim needs a country.
            const locationKeys = Object.keys(species?.location ?? {});
            const notesOnly = locationKeys.length === 1 && locationKeys[0] === "notes";

            // An empty `location:` parses as null, which is falsy, so the country
            // check below skipped it and the block said nothing at all.
            if (species && "location" in species && !species.location)
            {
                checkError(
                    "Location completeness",
                    filePath,
                    `species '${species.name ?? "?"}': empty 'location' block`);
            }

            if (species && species.location && !species.location.country && !notesOnly)
            {
                checkError(
                    "Location completeness",
                    filePath,
                    `species '${species.name ?? "?"}': location present but missing 'country'`);
            }

            const formation = species?.location?.formation;

            if (formation !== undefined && typeof formation !== "string")
            {
                checkError(
                    "Location completeness",
                    filePath,
                    `species '${species.name ?? "?"}': 'formation' must be a string, got ${typeof formation} (${JSON.stringify(formation)})`);
            }

            const member = species?.location?.member;

            if (member !== undefined && typeof member !== "string")
            {
                checkError(
                    "Location completeness",
                    filePath,
                    `species '${species.name ?? "?"}': 'member' must be a string, got ${typeof member} (${JSON.stringify(member)})`);
            }

            const bed = species?.location?.bed;

            if (bed !== undefined && typeof bed !== "string")
            {
                checkError(
                    "Location completeness",
                    filePath,
                    `species '${species.name ?? "?"}': 'bed' must be a string, got ${typeof bed} (${JSON.stringify(bed)})`);
            }

            const part = species?.location?.part;

            if (part !== undefined && typeof part !== "string")
            {
                checkError(
                    "Location completeness",
                    filePath,
                    `species '${species.name ?? "?"}': 'part' must be a string, got ${typeof part} (${JSON.stringify(part)})`);
            }
            else if (typeof part === "string"
                && !species?.location?.bed
                && !species?.location?.member
                && !species?.location?.formation
                && !species?.location?.group)
            {
                // `part` qualifies the finest unit named above it, so with no unit
                // at any rank there is nothing for it to qualify.
                checkError(
                    "Location completeness",
                    filePath,
                    `species '${species.name ?? "?"}': 'part' is set to '${part}' but no group, formation, member or bed is given`);
            }
        }
    }
}

/**
 * The "Formation rank" check.
 *
 * Every unit a record names must have a registry entry, at the rank the
 * field it sits in implies
 *
 * Two defects, one pass over the same values. A name absent from the registry
 * is either a spelling nobody has reconciled or a unit nobody has described;
 * either way the record's age and containment rest on nothing. A name present
 * at the wrong rank is in the wrong field: "Morrison" is a formation and
 * "Kem Kem" is a group, spelled the same way in the same field, so only the
 * registry tells them apart. The spelled-out rank word is caught separately,
 * because a value like "Yezo Group" never reaches the registry to be ranked.
 *
 * @param context - The loaded data the checks read.
 */
export function checkFormationRank(context: ValidationContext): void
{
    const {
        bedsByParent,
        genusParsed,
        stratigraphy,
        unitByName,
    } = context;

    const groupRankWord = /\b(Group|Grp\.?|Subgroup|Supergroup)$/;

    /**
     * Checks that a record's `bed` is a bed of the unit the record places it in.
     * A bed is looked for among the beds of the record's member, then its
     * formation, then its group, nearest first, since a bed label means something
     * only inside its own section. A record naming none of those can still name a
     * bed no source places in a larger unit, which is the one kind kept as its own
     * entry.
     *
     * @param filePath - Genus file the record is in, for reporting.
     * @param speciesName - The record's species, for reporting.
     * @param location - The record's location block.
     * @param bedName - The bed the record names.
     */
    function checkBedResolution(filePath: string, speciesName: string, location: Species["location"], bedName: string): void
    {
        const containers = (["member", "formation", "group"] as const)
            .map((field) => location?.[field])
            .filter((value): value is string => typeof value === "string")
            .map((value) => unitByName.get(value))
            .filter((unitName): unitName is string => unitName !== undefined);

        if (containers.some((unitName) => bedsByParent.get(unitName)?.has(bedName)))
        {
            return;
        }

        const standing = unitByName.get(bedName);

        if (standing !== undefined && stratigraphy[standing]?.rank === "bed" && stratigraphy[standing]?.parent === undefined)
        {
            return;
        }
        else if (containers.length === 0)
        {
            checkError(
                "Formation rank",
                filePath,
                `species '${speciesName}': bed '${bedName}' names no containing unit — give the record the member or formation the bed belongs to`);
        }
        else
        {
            checkError(
                "Formation rank",
                filePath,
                `species '${speciesName}': bed '${bedName}' is not among the beds of ${containers.map((unitName) => `'${unitName}'`).join(" or ")} — add it to the right entry's 'beds', or correct the record's member or formation`);
        }
    }

    const ranksForField: Record<string, Set<string>> = {
        group: new Set([ "group", "subgroup", "supergroup" ]),
        formation: new Set([ "formation" ]),
        member: new Set([ "member" ]),
        bed: new Set([ "bed" ]),
    };

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc || !Array.isArray(doc.species))
        {
            continue;
        }

        for (const species of doc.species)
        {
            const location = species?.location;

            for (const field of ["group", "formation", "member", "bed"] as const)
            {
                const value = location?.[field];

                if (typeof value !== "string")
                {
                    continue;
                }
                else if (field === "formation" && groupRankWord.test(value))
                {
                    checkError(
                        "Formation rank",
                        filePath,
                        `species '${species.name ?? "?"}': formation '${value}' names a group — put it in 'group' with the rank word dropped`);
                    continue;
                }

                if (field === "bed")
                {
                    checkBedResolution(filePath, species.name ?? "?", location, value);
                    continue;
                }

                const unitName = unitByName.get(value);

                if (unitName === undefined)
                {
                    checkError(
                        "Formation rank",
                        filePath,
                        `species '${species.name ?? "?"}': ${field} '${value}' has no entry in the stratigraphic registry — add one, or spell it as an existing entry's name or variant`);
                    continue;
                }

                const rank = stratigraphy[unitName]?.rank;

                // A unit nobody has assigned a rank to cannot contradict a field.
                // A mismatch is either the wrong field or a different unit that
                // shares the name -- the Hekou Group of Gansu and the Hekou
                // Formation of Jiangxi are unrelated -- so the message offers both
                // rather than steering a record onto the wrong unit.
                if (rank !== undefined && !ranksForField[field].has(rank))
                {
                    checkError(
                        "Formation rank",
                        filePath,
                        `species '${species.name ?? "?"}': ${field} '${value}' is recorded in the stratigraphic registry as a ${rank} — move it to '${rank === "subgroup" || rank === "supergroup" ? "group" : rank}', or, if the record's unit is a different one of the same name, give each its own entry with a country suffix`);
                }
            }
        }
    }
}

/**
 * The "Stratigraphic rank hygiene" check.
 *
 * Positional words must live in `part`, not inside a member or bed name
 *
 * @param context - The loaded data the checks read.
 */
export function checkStratigraphicRankHygiene(context: ValidationContext): void
{
    const {
        genusParsed,
    } = context;

    const positionalPrefix = /^(Upper|Lower|Middle|Uppermost|Lowermost|First|Second|Third)\b/;

    // Member names that genuinely begin with a positional word, where it is part
    // of the erected name rather than a division of it. Bussert and colleagues
    // (2009) raised the Tendaguru Beds to formation rank and named six members in
    // a series -- Lower Dinosaur, Middle Dinosaur, Upper Dinosaur -- so "Upper"
    // there is a name, not a place in the section. The Aguja's "Upper Shale" and
    // "Lower Shale" sat here until Lehman (2024) formalised them as the Alto and
    // Abajo Shale members. Moves to the formations registry when #2012 lands.
    const positionalUnitNames = new Set<string>([ "Middle Dinosaur", "Upper Dinosaur" ]);

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc || !Array.isArray(doc.species))
        {
            continue;
        }

        for (const species of doc.species)
        {
            const location = species?.location;

            for (const field of ["member", "bed"] as const)
            {
                const value = location?.[field];

                if (typeof value !== "string")
                {
                    continue;
                }
                else if (positionalPrefix.test(value) && !positionalUnitNames.has(value))
                {
                    checkWarning(
                        "Stratigraphic rank hygiene",
                        filePath,
                        `species '${species.name ?? "?"}': '${field}' is '${value}' — a positional word belongs in 'part' so that every occurrence in one unit shares a value`);
                }
                else if (/\b(Formation|Fm\.?|Group|Grp\.?|Member|Mbr\.?|Subgroup)\b/.test(value))
                {
                    checkWarning(
                        "Stratigraphic rank hygiene",
                        filePath,
                        `species '${species.name ?? "?"}': '${field}' is '${value}' — the rank word is implied by the field and should be dropped`);
                }
            }
        }
    }
}

/**
 * The "Stratigraphic unit ages" check.
 *
 * Every stratigraphic unit carries a period, and its stages refine it
 *
 * `period` is required on each registry entry. `stages` is optional
 * and narrows it: every stage listed must belong to one of the entry's periods.
 * An empty or absent `stages` means no source published the age at stage
 * resolution, never that the unit is undated. Records are held to these stages
 * in 13d.
 *
 * @param context - The loaded data the checks read.
 */
export function checkStratigraphicUnitAges(context: ValidationContext): void
{
    const {
        allowedPeriods,
        bedsByParent,
        registryEntries,
        stageOrder,
        stagePosition,
        stages,
        stratigraphy,
        stratigraphyFile,
    } = context;

    for (const { label, entry, filePath } of registryEntries)
    {
        const periods = entry?.period;

        if (!Array.isArray(periods) || periods.length === 0)
        {
            checkError("Stratigraphic unit ages", filePath, `unit '${label}': no period`);
            continue;
        }

        for (const periodName of periods)
        {
            if (!allowedPeriods.has(periodName))
            {
                checkError("Stratigraphic unit ages", filePath, `unit '${label}': unknown period '${periodName}'`);
            }
        }

        for (const stageName of entry?.stages ?? [])
        {
            const stageInfo = stages[stageName];

            if (!stageInfo)
            {
                checkError("Stratigraphic unit ages", filePath, `unit '${label}': unknown stage '${stageName}'`);
            }
            else if (!periods.includes(stageInfo.period))
            {
                checkError(
                    "Stratigraphic unit ages",
                    filePath,
                    `unit '${label}': stage '${stageName}' belongs to '${stageInfo.period}', which is not among its periods`);
            }
        }

        // Stages are a span, so they run oldest first with nothing skipped. A gap
        // would claim two disjoint intervals, which no single unit records; a
        // range that leaves out a stage inside it is written in full instead.
        const positions = (entry?.stages ?? [])
            .map((stageName) => stagePosition.get(stageName))
            .filter((position): position is number => position !== undefined);

        for (let index = 1; index < positions.length; index += 1)
        {
            if (positions[index] <= positions[index - 1])
            {
                checkError(
                    "Stratigraphic unit ages",
                    filePath,
                    `unit '${label}': stages are not oldest first — '${stageOrder[positions[index]]}' follows '${stageOrder[positions[index - 1]]}'`);
                break;
            }
            else if (positions[index] !== positions[index - 1] + 1)
            {
                const missing = stageOrder.slice(positions[index - 1] + 1, positions[index]);

                checkError(
                    "Stratigraphic unit ages",
                    filePath,
                    `unit '${label}': stages skip ${missing.join(", ")} between '${stageOrder[positions[index - 1]]}' and '${stageOrder[positions[index]]}' — list every stage the span covers`);
            }
        }
    }

    // A bed sits inside its parent, so a stage the bed carries and the parent does
    // not is a finding to resolve by reading: either the bed's dating or the
    // parent's sources are wrong or incomplete.
    for (const [unitName, beds] of bedsByParent)
    {
        const parentStages = stratigraphy[unitName]?.stages ?? [];

        if (parentStages.length === 0)
        {
            continue;
        }

        for (const bed of new Set(beds.values()))
        {
            const outside = (bed.stages ?? []).filter((stageName) => !parentStages.includes(stageName));

            if (outside.length > 0)
            {
                checkError(
                    "Stratigraphic unit ages",
                    stratigraphyFile(unitName),
                    `bed '${unitName} › ${bed.name}': stage${outside.length > 1 ? "s" : ""} ${outside.join(", ")} fall${outside.length > 1 ? "" : "s"} outside its parent's stages`);
            }
        }
    }
}

/**
 * The "Record stages" check.
 *
 * A record's stages fall within those of the unit it names
 *
 * A record is dated by the horizon of its type specimen, which lies inside the
 * finest unit the record names, so its stages cannot reach past that unit's.
 * A stage outside is a finding to resolve by reading the papers the record
 * cites, never a reason to widen the unit. The two exceptions are a type
 * reworked from older beds and a type whose bed is uncertain; each is declared
 * in `period.resolution` and explained in the location notes.
 *
 * @param context - The loaded data the checks read.
 */
export function checkRecordStages(context: ValidationContext): void
{
    const {
        genusParsed,
        outsideUnitResolutions,
        recordUnit,
    } = context;

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc || !Array.isArray(doc.species))
        {
            continue;
        }

        for (const species of doc.species)
        {
            const recordStages = Array.isArray(species?.period?.stage) ? species.period.stage : [];
            const unit = recordUnit(species?.location);

            if (recordStages.length === 0 || unit === undefined || unit.stages.length === 0)
            {
                continue;
            }

            const outside = recordStages.filter((stageName) => !unit.stages.includes(stageName));
            const resolution = species.period?.resolution;

            // `unit` says the record's stages ARE its unit's range, so they must
            // match it exactly; a narrower or wider list is a reading of its own.
            if (resolution === "unit" && recordStages.join() !== unit.stages.join())
            {
                checkError(
                    "Record stages",
                    filePath,
                    `species '${species.name ?? "?"}': resolution 'unit' but the stages (${recordStages.join(", ")}) are not those of '${unit.label}' (${unit.stages.join(", ")}) — take the unit's stages, or drop 'unit' if a paper the record cites gives the type horizon its own reading`);
                continue;
            }
            else if (outside.length === 0)
            {
                continue;
            }
            else if (resolution !== undefined && outsideUnitResolutions.has(resolution))
            {
                continue;
            }

            checkError(
                "Record stages",
                filePath,
                `species '${species.name ?? "?"}': stage${outside.length > 1 ? "s" : ""} ${outside.join(", ")} fall${outside.length > 1 ? "" : "s"} outside '${unit.label}' (${unit.stages.join(", ")}) — narrow the record to what its papers give for the type horizon, or, for a reworked type or an uncertain bed, set period.resolution to 'reworked' or 'horizon' and say why in the location notes`);
        }
    }
}

/**
 * The "Record periods" check.
 *
 * A record's epochs fall within those of the unit it names
 *
 * The stage check above passes over a record or unit that has no stages, so a
 * record whose epoch contradicts its unit's (Late Triassic in an Early
 * Jurassic unit) would go unseen. Every unit carries `period`, so this check
 * covers every record that names one. The same two resolutions are exempt.
 *
 * @param context - The loaded data the checks read.
 */
export function checkRecordPeriods(context: ValidationContext): void
{
    const {
        genusParsed,
        outsideUnitResolutions,
        recordUnit,
    } = context;

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc || !Array.isArray(doc.species))
        {
            continue;
        }

        for (const species of doc.species)
        {
            const recordPeriods = Array.isArray(species?.period?.name) ? species.period.name : [];
            const unit = recordUnit(species?.location);
            const resolution = species?.period?.resolution;

            if (recordPeriods.length === 0 || unit === undefined || unit.periods.length === 0)
            {
                continue;
            }
            else if (resolution !== undefined && outsideUnitResolutions.has(resolution))
            {
                continue;
            }

            const outside = recordPeriods.filter((periodName) => !unit.periods.includes(periodName));

            if (outside.length > 0)
            {
                checkError(
                    "Record periods",
                    filePath,
                    `species '${species.name ?? "?"}': period${outside.length > 1 ? "s" : ""} ${outside.join(", ")} fall${outside.length > 1 ? "" : "s"} outside '${unit.label}' (${unit.periods.join(", ")}) — narrow the record to what its papers give for the type horizon, or, for a reworked type or an uncertain bed, set period.resolution to 'reworked' or 'horizon' and say why in the location notes`);
            }
        }
    }
}
