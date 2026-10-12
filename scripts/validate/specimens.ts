// Checks on specimen numbers across records.

import { relPath, checkError } from "./report.ts";
import type { ValidationContext } from "./context.ts";

/**
 * The "Specimen number collisions" check.
 *
 * Specimen number collisions — one specimen cannot be the type of two taxa,
 * so two type_specimen blocks carrying one catalog number mean at least one of
 * them is wrong, and a difference of case or separator must not be allowed to
 * hide that. A " sensu <author> <year>" qualifier marks a number the literature
 * genuinely applies to more than one specimen, so a group is only reported when
 * at least one of its occurrences lacks that qualifier. Only type specimens are
 * compared: notable_specimens legitimately re-list a type from elsewhere, as
 * Euoplocephalus does for the Scolosaurus holotype ROM 1930.
 *
 * @param context - The loaded data the checks read.
 */
export function checkSpecimenNumberCollisions(context: ValidationContext): void
{
    const {
        genusParsed,
        sensuQualifier,
    } = context;

    type SpecimenOccurrence =
        {
            filePath: string;
            label: string;
            raw: string;
            qualified: boolean;
        };

    const specimenOccurrences = new Map<string, Array<SpecimenOccurrence>>();

    /**
     * Reduces a catalog string to a comparable key by dropping any "sensu"
     * qualifier and every separator, so that "MLL Pv-005", "MLL-PV-005" and
     * "MLL-Pv 005" all compare equal.
     *
     * @param specimenId - The raw specimen_id string as written in the YAML.
     * @returns The normalized comparison key.
     */
    function normalizeSpecimenNumber(specimenId: string): string
    {
        const [base] = specimenId.split(sensuQualifier);
        return base.replace(/[\s\-_.]/g, "").toUpperCase();
    }

    /**
     * Records one specimen_id occurrence against its normalized key.
     *
     * @param filePath - Absolute path to the YAML file the id appears in.
     * @param label - Human-readable description of the field it came from.
     * @param specimenId - The raw specimen_id string.
     * @returns Nothing.
     */
    function recordSpecimenOccurrence(filePath: string, label: string, specimenId: string): void
    {
        const key = normalizeSpecimenNumber(specimenId);
        if (key.length === 0)
        {
            return;
        }

        const occurrences = specimenOccurrences.get(key) ?? new Array<SpecimenOccurrence>();
        occurrences.push({
            filePath,
            label,
            raw: specimenId,
            qualified: sensuQualifier.test(specimenId),
        });
        specimenOccurrences.set(key, occurrences);
    }

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc)
        {
            continue;
        }

        for (const species of doc.species ?? [])
        {
            const typeSpecimenIds = species?.type_specimen?.specimen_id;
            if (Array.isArray(typeSpecimenIds))
            {
                for (const specimenId of typeSpecimenIds)
                {
                    if (typeof specimenId === "string")
                    {
                        recordSpecimenOccurrence(filePath, `${species.name ?? "?"} type_specimen`, specimenId);
                    }
                }
            }
        }
    }

    for (const [key, occurrences] of specimenOccurrences)
    {
        if (occurrences.length > 1 && !occurrences.every(occurrence => occurrence.qualified))
        {
            const rendered = occurrences
                .map(occurrence => `${relPath(occurrence.filePath)} (${occurrence.label}, "${occurrence.raw}")`)
                .join("; ");
            checkError(
                "Specimen number collisions",
                null,
                `catalog number ${key} is claimed by ${occurrences.length} records: ${rendered}`);
        }
    }
}

/**
 * The "Catalog number shape" check.
 *
 * Catalog number shape — some institutions number specimens to a fixed
 * pattern, and an id that does not match it is normally a number recorded only
 * in part. The Royal Tyrrell numbers as "TMP year.location.specimen" with the
 * last two fields zero-padded to three and four digits; papers routinely print
 * the padding-stripped form (Ryan 2007 writes TMP 2001.26.1), but the catalog
 * form is what we store.
 *
 * @param context - The loaded data the checks read.
 */
export function checkCatalogNumberShape(context: ValidationContext): void
{
    const {
        genusParsed,
        sensuQualifier,
    } = context;

    const catalogNumberShapes = new Map<string, RegExp>([
        ["TMP", /^TMP \d{4}\.\d{3}\.\d{4}$/],
    ]);

    /**
     * Reports a specimen id whose institution has a known catalog pattern that the
     * id does not match. Ids carrying a "sensu" qualifier are tested on the part
     * before it, which is the catalog number itself.
     *
     * @param filePath - Absolute path to the YAML file the id appears in.
     * @param label - Human-readable description of the field it came from.
     * @param specimenId - The raw specimen_id string.
     * @returns Nothing.
     */
    function checkCatalogNumberShape(filePath: string, label: string, specimenId: string): void
    {
        const [base] = specimenId.split(sensuQualifier);
        const [prefix] = base.trim().split(/[\s-]/);
        const shape = catalogNumberShapes.get(prefix);

        if (shape !== undefined && !shape.test(base.trim()))
        {
            checkError(
                "Catalog number shape",
                filePath,
                `${label}: specimen id "${base.trim()}" does not match the ${prefix} catalog pattern ${shape.source}`);
        }
    }

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc)
        {
            continue;
        }

        for (const species of doc.species ?? [])
        {
            const typeSpecimenIds = species?.type_specimen?.specimen_id;
            if (Array.isArray(typeSpecimenIds))
            {
                for (const specimenId of typeSpecimenIds)
                {
                    if (typeof specimenId === "string")
                    {
                        checkCatalogNumberShape(filePath, `${species.name ?? "?"} type_specimen`, specimenId);
                    }
                }
            }
        }

        for (const specimen of doc.notable_specimens ?? [])
        {
            const notableSpecimenIds = specimen?.specimen_id;
            if (Array.isArray(notableSpecimenIds))
            {
                for (const specimenId of notableSpecimenIds)
                {
                    if (typeof specimenId === "string")
                    {
                        checkCatalogNumberShape(filePath, "notable_specimens", specimenId);
                    }
                }
            }
        }
    }
}
