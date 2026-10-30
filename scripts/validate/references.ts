// Checks on reference pointers and the reference store.

import * as fs from "node:fs";
import * as path from "node:path";

import type { Reference } from "../types.ts";
import {
    citationMatchesId,
    findMarkdownFiles,
    findYamlFiles,
    narrativeCitations,
    normalizeDoi,
    referenceBucket,
    referenceIdentity,
    referenceNotesLimit,
} from "../utilities.ts";
import { checkError, checkWarning } from "./report.ts";
import type { ValidationContext } from "./context.ts";
import { walkStrings } from "./walk.ts";

/**
 * The "Reference integrity" check.
 *
 * Reference integrity — described_in matches a reference id
 *
 * @param context - The loaded data the checks read.
 */
export function checkReferenceIntegrity(context: ValidationContext): void
{
    const {
        genusParsed,
        referenceStoreIds,
    } = context;

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc)
        {
            continue;
        }

        // Every in-file citation pointer must resolve to a store entry.
        if (Array.isArray(doc.references))
        {
            for (const reference of doc.references)
            {
                if (reference && reference.id && !referenceStoreIds.has(reference.id))
                {
                    checkError(
                        "Reference integrity",
                        filePath,
                        `reference '${reference.id}' does not resolve to a store entry (references/${reference.id[0]}/${reference.id}.yml)`);
                }
            }
        }

        // Check the genus-level erected_in (genus-authority override).
        if (doc.erected_in && !referenceStoreIds.has(doc.erected_in))
        {
            checkError(
                "Reference integrity",
                filePath,
                `erected_in '${doc.erected_in}' does not resolve to a store entry`);
        }

        // Check genus-level ICZN case references.
        if (Array.isArray(doc.iczn_cases))
        {
            for (const icznCase of doc.iczn_cases)
            {
                if (icznCase && icznCase.ruling && !referenceStoreIds.has(icznCase.ruling))
                {
                    checkError(
                        "Reference integrity",
                        filePath,
                        `iczn_cases: ruling '${icznCase.ruling}' does not resolve to a store entry`);
                }

                if (icznCase && icznCase.petition && !referenceStoreIds.has(icznCase.petition))
                {
                    checkError(
                        "Reference integrity",
                        filePath,
                        `iczn_cases: petition '${icznCase.petition}' does not resolve to a store entry`);
                }

                for (const notice of Array.isArray(icznCase?.notices) ? icznCase.notices : [])
                {
                    if (!referenceStoreIds.has(notice))
                    {
                        checkError(
                            "Reference integrity",
                            filePath,
                            `iczn_cases: notice '${notice}' does not resolve to a store entry`);
                    }
                }
            }
        }

        // Check species-level erected_in and described_in.
        if (Array.isArray(doc.species))
        {
            for (const species of doc.species)
            {
                if (species && species.erected_in && !referenceStoreIds.has(species.erected_in))
                {
                    checkError(
                        "Reference integrity",
                        filePath,
                        `species '${species.name ?? "?"}': erected_in '${species.erected_in}' does not resolve to a store entry`);
                }

                if (species && species.described_in && !referenceStoreIds.has(species.described_in))
                {
                    checkError(
                        "Reference integrity",
                        filePath,
                        `species '${species.name ?? "?"}': described_in '${species.described_in}' does not resolve to a store entry`);
                }
            }
        }
    }
}

/**
 * The "Clade reference integrity" check.
 *
 * Clade reference integrity — clade citation pointers and
 * erected_in/described_in resolve to a store entry.
 *
 * @param context - The loaded data the checks read.
 */
export function checkCladeReferenceIntegrity(context: ValidationContext): void
{
    const {
        cladeParsed,
        referenceStoreIds,
    } = context;

    for (const [filePath, doc] of cladeParsed)
    {
        if (!doc)
        {
            continue;
        }

        if (Array.isArray(doc.references))
        {
            for (const reference of doc.references)
            {
                if (reference && reference.id && !referenceStoreIds.has(reference.id))
                {
                    checkError(
                        "Clade reference integrity",
                        filePath,
                        `reference '${reference.id}' does not resolve to a store entry`);
                }
            }
        }

        if (doc.erected_in && !referenceStoreIds.has(doc.erected_in))
        {
            checkError(
                "Clade reference integrity",
                filePath,
                `erected_in '${doc.erected_in}' does not resolve to a store entry`);
        }

        if (doc.described_in && !referenceStoreIds.has(doc.described_in))
        {
            checkError(
                "Clade reference integrity",
                filePath,
                `described_in '${doc.described_in}' does not resolve to a store entry`);
        }
    }
}

/**
 * The "Registry reference integrity" check.
 *
 * 10a-bis. Registry reference integrity — every citation in the stratigraphic
 * registry resolves to a store entry. The registry is where a unit's age and
 * containment are sourced, so a dangling id there leaves every record that
 * names the unit resting on a citation the build cannot print.
 *
 * @param context - The loaded data the checks read.
 */
export function checkRegistryReferenceIntegrity(context: ValidationContext): void
{
    const {
        referenceStoreIds,
        registryEntries,
    } = context;

    for (const { label, entry, filePath } of registryEntries)
    {
        for (const reference of entry?.references ?? [])
        {
            if (reference && reference.id && !referenceStoreIds.has(reference.id))
            {
                checkError(
                    "Registry reference integrity",
                    filePath,
                    `${label}: reference '${reference.id}' does not resolve to a store entry (references/${reference.id[0]}/${reference.id}.yml)`);
            }
        }
    }
}

/**
 * The "Self-contained references" check.
 *
 * Self-contained references — every reference pointer within a genus or
 * clade (erected_in, described_in, iczn_cases.ruling/petition/notices) must also
 * appear in that file's own `references` block, so a consumer can resolve any
 * citation from the single inflated record without a separate lookup. The
 * build inflates only the `references` list, so a pointer absent from it would
 * dangle in the output. (notable_specimens references are already held to this
 * rule by the Notable specimens check.)
 *
 * @param context - The loaded data the checks read.
 */
export function checkSelfContainedReferences(context: ValidationContext): void
{
    const {
        cladeParsed,
        genusParsed,
    } = context;

    /**
     * Reports any pointer id that is missing from a record's own references block.
     *
     * @param filePath - Absolute path to the YAML file under inspection.
     * @param localIds - The set of reference ids listed in the record's references.
     * @param pointers - Labeled pointer ids to verify (label describes the field).
     */
    function checkSelfContainedReferences(
        filePath: string,
        localIds: Set<string>,
        pointers: Array<[string, string | undefined]>): void
    {
        for (const [label, id] of pointers)
        {
            if (id && !localIds.has(id))
            {
                checkError(
                    "Self-contained references",
                    filePath,
                    `${label} '${id}' is not listed in this file's own references block (add it so the record resolves standalone)`);
            }
        }
    }

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc)
        {
            continue;
        }

        const localIds = new Set(
            (doc.references ?? [])
                .map((reference) => reference?.id)
                .filter((id): id is string => typeof id === "string"));

        const pointers: Array<[string, string | undefined]> = [["erected_in", doc.erected_in]];

        for (const species of doc.species ?? [])
        {
            if (!species)
            {
                continue;
            }

            const speciesLabel = species.name ?? "?";
            pointers.push([`species '${speciesLabel}': erected_in`, species.erected_in]);
            pointers.push([`species '${speciesLabel}': described_in`, species.described_in]);
        }

        for (const icznCase of doc.iczn_cases ?? [])
        {
            if (!icznCase)
            {
                continue;
            }

            pointers.push(["iczn_cases: ruling", icznCase.ruling]);
            pointers.push(["iczn_cases: petition", icznCase.petition]);

            for (const notice of Array.isArray(icznCase.notices) ? icznCase.notices : [])
            {
                pointers.push(["iczn_cases: notice", notice]);
            }
        }

        checkSelfContainedReferences(filePath, localIds, pointers);
    }

    for (const [filePath, doc] of cladeParsed)
    {
        if (!doc)
        {
            continue;
        }

        const localIds = new Set(
            (doc.references ?? [])
                .map((reference) => reference?.id)
                .filter((id): id is string => typeof id === "string"));

        checkSelfContainedReferences(
            filePath,
            localIds,
            [["erected_in", doc.erected_in], ["described_in", doc.described_in]]);
    }
}

/**
 * The "Reference store integrity" check.
 *
 * Reference store integrity — each references/<letter>/<id>.yml file must
 * parse, carry an `id` equal to its filename (NFC + lowercase), and hold the
 * required bibliographic fields, with any page range written with a plain
 * hyphen. This is the single source of truth for
 * bibliographic data, so completeness is enforced here rather than per citing
 * file.
 *
 * @param context - The loaded data the checks read.
 */
export function checkReferenceStoreIntegrity(context: ValidationContext): void
{
    const {
        allowedThesisTypes,
        referenceStoreParsed,
    } = context;

    const requiredRefFields: Array<keyof Reference> = ["id", "authors", "year", "title"];

    for (const [filePath, entry] of referenceStoreParsed)
    {
        if (!entry)
        {
            checkError("Reference store integrity", filePath, "store entry failed to parse");
            continue;
        }

        const baseName = path.basename(filePath, ".yml");

        if (entry.id !== baseName)
        {
            checkError(
                "Reference store integrity",
                filePath,
                `store 'id' '${entry.id ?? "?"}' does not match filename '${baseName}'`);
        }

        // A DOI is stored bare, so that one work cannot hide behind two spellings of
        // its DOI ("10.x/y" and "https://doi.org/10.x/y").
        if (entry.doi !== undefined && !/^10\.\d{4,9}\/\S+$/.test(String(entry.doi)))
        {
            checkError(
                "Reference store integrity",
                filePath,
                `doi '${entry.doi}' is not a bare DOI; store it as '${normalizeDoi(String(entry.doi))}'`);
        }

        if (baseName.normalize("NFC") !== baseName)
        {
            checkError(
                "Reference store integrity",
                filePath,
                `filename '${baseName}' is not NFC-normalized`);
        }

        if (baseName !== baseName.toLowerCase())
        {
            checkError(
                "Reference store integrity",
                filePath,
                `filename '${baseName}' must be lowercase`);
        }

        const bucket = path.basename(path.dirname(filePath));
        const expectedBucket = referenceBucket(baseName);

        if (bucket !== expectedBucket)
        {
            checkError(
                "Reference store integrity",
                filePath,
                `store file is in bucket '${bucket}' but key '${baseName}' belongs in '${expectedBucket}' (references/${expectedBucket}/)`);
        }

        for (const field of requiredRefFields)
        {
            if (!entry[field])
            {
                checkError(
                    "Reference store integrity",
                    filePath,
                    `reference '${entry.id ?? baseName}': missing required field '${field}'`);
            }
        }

        // A page range takes a plain hyphen, so that one range cannot be written
        // two ways ("15–51" and "15-51").
        if (entry.pages !== undefined && /[‐-―−]/.test(String(entry.pages)))
        {
            checkError(
                "Reference store integrity",
                filePath,
                `reference '${entry.id ?? baseName}': pages '${entry.pages}' uses a dash other than a hyphen; write it as '${String(entry.pages).replace(/[‐-―−]/g, "-")}'`);
        }

        // Each other form a work is cited in changes the author, the year or both;
        // a form that changes neither, or names a field the check cannot read, is
        // a typo.
        for (const form of (entry.also_cited_as as Array<unknown> | undefined) ?? [])
        {
            const fields = typeof form === "object" && form !== null ? Object.keys(form) : [];
            const { author, year } = (form ?? {}) as { author?: unknown; year?: unknown };

            if (fields.length === 0 || fields.some((field) => field !== "author" && field !== "year") || (author !== undefined && typeof author !== "string") || (year !== undefined && !Number.isInteger(year)))
            {
                checkError(
                    "Reference store integrity",
                    filePath,
                    `reference '${entry.id ?? baseName}': each also_cited_as form takes an author (text), a year (a number) or both, and nothing else`);
            }
        }

        // journal/book are optional: an article carries `journal`, a chapter
        // carries `book` (its containing volume), and a standalone book,
        // monograph, or press release carries neither — its venue is recorded
        // via `publisher` (and `url`/`notes` where applicable). A thesis carries
        // neither either, and names its awarding institution in `school`.
        if (entry.thesis !== undefined)
        {
            if (!allowedThesisTypes.has(entry.thesis))
            {
                checkError(
                    "Reference store integrity",
                    filePath,
                    `reference '${entry.id ?? baseName}': thesis '${entry.thesis}' is not one of ${[...allowedThesisTypes].join(", ")}`);
            }

            if (!entry.school)
            {
                checkError(
                    "Reference store integrity",
                    filePath,
                    `reference '${entry.id ?? baseName}': a thesis must name its awarding institution in 'school'`);
            }

            if (entry.journal || entry.book)
            {
                checkError(
                    "Reference store integrity",
                    filePath,
                    `reference '${entry.id ?? baseName}': a thesis carries neither 'journal' nor 'book'`);
            }
        }
        else if (entry.school)
        {
            checkError(
                "Reference store integrity",
                filePath,
                `reference '${entry.id ?? baseName}': 'school' is only for a thesis; add 'thesis' or use 'publisher'`);
        }
    }
}

/**
 * The "Reference store files" check.
 *
 * Stray files in the reference store
 *
 * Every other store check reads what `findYamlFiles` returns, and that skips
 * anything not ending `.yml` or `.yaml` -- so a file the store scan never sees
 * is a file no check can complain about. Six such files sat in `references/`
 * for two days: a shell redirection with an unbalanced quote wrote heredoc
 * delimiter lines to paths ending `.yml"`, which shadowed nothing and were
 * invisible to validation. This check walks the directory itself rather than
 * the scan's results, so a misdirected write is loud on the next run.
 *
 * @param context - The loaded data the checks read.
 */
export function checkReferenceStoreFiles(context: ValidationContext): void
{
    const {
        referencesDirectory,
    } = context;

    // A key is a lowercase author name, a four-digit year, and an optional
    // disambiguating letter. Names keep their diacritics and hyphens, and eleven
    // keys carry an apostrophe (`d'emic2019a`), so the letter classes are Unicode
    // rather than ASCII.
    const referenceFileName = /^\p{L}[\p{L}\p{M}\p{N}'-]*\d{4}[a-z]?\.yml$/u;

    for (const bucket of fs.readdirSync(referencesDirectory, { withFileTypes: true }))
    {
        // Dotfiles are the platform's, not the store's -- `.DS_Store` is ignored
        // by git and is not a misdirected write.
        if (bucket.name.startsWith("."))
        {
            continue;
        }
        else if (!bucket.isDirectory())
        {
            checkError(
                "Reference store files",
                path.join(referencesDirectory, bucket.name),
                `'${bucket.name}' sits beside the letter buckets; the store holds one file per reference under references/<letter>/`);
            continue;
        }

        for (const entry of fs.readdirSync(path.join(referencesDirectory, bucket.name), { withFileTypes: true }))
        {
            if (entry.name.startsWith("."))
            {
                continue;
            }
            else if (!entry.isFile())
            {
                checkError(
                    "Reference store files",
                    path.join(referencesDirectory, bucket.name, entry.name),
                    `'${entry.name}' is not a file; the letter buckets hold reference entries only`);
            }
            else if (!referenceFileName.test(entry.name))
            {
                checkError(
                    "Reference store files",
                    path.join(referencesDirectory, bucket.name, entry.name),
                    `'${entry.name}' is not named <key>.yml, so no store check reads it — a stray write, or an entry that needs renaming`);
            }
        }
    }
}

/**
 * The "Uncited store entries" check.
 *
 * Uncited store entries — every store entry is cited from somewhere: a
 * genus, clade or stratigraphy record, a research note, another store entry,
 * a sign-off file or a skill's queue. An entry nothing cites is usually left
 * behind by an abandoned intake or a re-keyed citation.
 *
 * @param context - The loaded data the checks read.
 */
export function checkUncitedStoreEntries(context: ValidationContext): void
{
    const {
        cladeFiles,
        genusFiles,
        readDataFile,
        referenceStoreFiles,
        referencesDirectory,
        root,
        stratigraphyFiles,
    } = context;

    const citingTextFiles = [
        ...genusFiles,
        ...cladeFiles,
        ...stratigraphyFiles.values(),
        ...referenceStoreFiles,
        ...findMarkdownFiles(path.join(root, "research")),
        ...findYamlFiles(path.join(root, ".claude", "skills")),
        ...["excluded.yml", "flagged-signoffs.yml", "flagged-sources.yml", "institutions.yaml", "tree.yml"]
            .map((fileName) => path.join(root, fileName)),
    ];

    const citedKeyPattern = /\p{L}[\p{L}\p{M}\p{N}'-]*\d{4}[a-z]/gu;

    const citedKeys = new Set<string>();

    for (const filePath of citingTextFiles)
    {
        let text: string;

        try
        {
            text = readDataFile(filePath);
        }
        catch
        {
            continue;
        }

        // A store entry's own id line is not a citation of it.
        if (filePath.startsWith(referencesDirectory))
        {
            text = text.replace(/^id: .*$/m, "");
        }

        for (const match of text.matchAll(citedKeyPattern))
        {
            citedKeys.add(match[0]);
        }
    }

    for (const filePath of referenceStoreFiles)
    {
        const key = path.basename(filePath, ".yml");

        if (!citedKeys.has(key))
        {
            checkWarning(
                "Uncited store entries",
                filePath,
                `'${key}' is cited by no record, research note or store entry; cite it or remove it`);
        }
    }
}

/**
 * The "Redundant DOI-pointer URL" check.
 *
 * Redundant DOI-pointer URLs — a reference `url` that merely points at
 * the reference's own DOI (e.g. http://dx.doi.org/{doi}) carries no extra
 * information, since any consumer can regenerate it from the `doi` field.
 * Keep `url` only when it points somewhere a DOI cannot reach (a repository
 * deposit, an archived copy, a paper with no DOI, etc.).
 *
 * @param context - The loaded data the checks read.
 */
export function checkRedundantDoiPointerUrl(context: ValidationContext): void
{
    const {
        referenceStoreParsed,
    } = context;

    /**
     * Determines whether a reference `url` is nothing more than a pointer at the
     * reference's own DOI (e.g. `http://dx.doi.org/{doi}` or
     * `https://doi.org/{doi}`). DOIs are case-insensitive and the URL may
     * percent-encode characters that the raw DOI leaves literal, so both forms
     * are compared.
     *
     * @param urlValue - The reference's `url` field, if present.
     * @param doiValue - The reference's `doi` field, if present.
     * @returns True when the URL only re-encodes the DOI and can be dropped.
     */
    function isDoiPointerUrl(urlValue?: string, doiValue?: string): boolean
    {
        if (!urlValue || !doiValue)
        {
            return false;
        }

        const match = urlValue.match(/^https?:\/\/(?:[a-z0-9.-]+\.)?doi\.org\/(.+)$/i);

        if (!match)
        {
            return false;
        }

        const urlDoi = match[1];
        const doi = String(doiValue);

        if (urlDoi === doi || urlDoi.toLowerCase() === doi.toLowerCase())
        {
            return true;
        }

        try
        {
            if (decodeURIComponent(urlDoi) === doi)
            {
                return true;
            }
        }
        catch
        {
            // Malformed percent-encoding: fall through to a non-match.
        }

        return false;
    }

    for (const [filePath, entry] of referenceStoreParsed)
    {
        if (entry && isDoiPointerUrl(entry.url, entry.doi))
        {
            checkWarning(
                "Redundant DOI-pointer URL",
                filePath,
                `reference '${entry.id ?? "?"}': url '${entry.url}' just points at its own doi; drop it (consumers can regenerate it from 'doi')`);
        }
    }
}

/**
 * The "Unique reference IDs" check.
 *
 * Unique reference IDs
 *
 * @param context - The loaded data the checks read.
 */
export function checkUniqueReferenceIds(context: ValidationContext): void
{
    const {
        allParsed,
    } = context;

    for (const [filePath, doc] of allParsed)
    {
        if (!doc || !Array.isArray(doc.references))
        {
            continue;
        }

        const seen = new Set<string>();

        for (const reference of doc.references)
        {
            if (!reference || !reference.id)
            {
                continue;
            }

            if (seen.has(reference.id))
            {
                checkError("Unique reference IDs", filePath, `duplicate reference id '${reference.id}'`);
            }

            seen.add(reference.id);
        }
    }
}

/**
 * The "Reference key disambiguation" check.
 *
 * Reference key disambiguation — every store key is uniformly
 * `<surname><year><letter>`: a non-numeric author fragment, a 4-digit year,
 * and a single lowercase a-z disambiguation suffix (universal `a`-suffixing).
 * This keeps keys machine-parseable and means adding another same-author-year
 * paper never renames an existing key or retags its citations. Both a bare key
 * (ending in its year) and a non-letter suffix (e.g. `sereno1986marginocephalia`)
 * violate the convention.
 *
 * @param context - The loaded data the checks read.
 */
export function checkReferenceKeyDisambiguation(context: ValidationContext): void
{
    const {
        referenceStoreIds,
        referenceStoreParsed,
    } = context;

    const referenceKeyPattern = /^\D+\d{4}[a-z]$/;

    const referenceStoreFileById = new Map<string, string>();

    for (const [filePath, entry] of referenceStoreParsed)
    {
        if (entry && entry.id)
        {
            referenceStoreFileById.set(entry.id, filePath);
        }
    }

    for (const referenceId of referenceStoreIds)
    {
        if (!referenceKeyPattern.test(referenceId))
        {
            const suggestion = /\d$/.test(referenceId)
                ? ` (append a disambiguation letter, e.g. '${referenceId}a')`
                : "";

            checkError(
                "Reference key disambiguation",
                referenceStoreFileById.get(referenceId) ?? "(store)",
                `reference key '${referenceId}' must be <surname><year><letter>: a non-numeric author, a 4-digit year, and a single a-z suffix${suggestion}`,
            );
        }
    }
}

/**
 * The "Reference key year" check.
 *
 * Reference key year — an entry carries one year, the year the work
 * first became available, and its key and `year` field both give it
 * (CONTRIBUTING, "Reference Keys and Years").
 *
 * @param context - The loaded data the checks read.
 */
export function checkReferenceKeyYear(context: ValidationContext): void
{
    const {
        referenceStoreParsed,
    } = context;

    for (const [filePath, entry] of referenceStoreParsed)
    {
        const keyYear = entry?.id?.match(/(\d{4})[a-z]$/)?.[1];

        if (keyYear && entry && String(entry.year) !== keyYear)
        {
            checkError(
                "Reference key year",
                filePath,
                `reference '${entry.id}': year ${entry.year ?? "(missing)"} does not match the key's year ${keyYear}; key and year are both the year the work first became available`,
            );
        }
    }
}

/**
 * The "Chapter without a journal" check.
 *
 * Chapter without a journal — a chapter names its volume in `book`; a
 * numbered series the volume belongs to goes in `series`, never `journal`
 * (CONTRIBUTING, "Books, Chapters and Series").
 *
 * @param context - The loaded data the checks read.
 */
export function checkChapterWithoutAJournal(context: ValidationContext): void
{
    const {
        referenceStoreParsed,
    } = context;

    for (const [filePath, entry] of referenceStoreParsed)
    {
        if (entry && entry.book && entry.journal)
        {
            checkError(
                "Chapter without a journal",
                filePath,
                `reference '${entry.id}': has both book and journal ('${entry.journal}'); a chapter's series goes in series, with its number in volume`,
            );
        }
    }
}

/**
 * The "Duplicate references" check.
 *
 * Duplicate references — one work, one entry. Two entries with the same
 * DOI are one work. So are two with the same title and the same volume and
 * pages, whatever year or venue spelling each carries: the duplicates minted
 * so far were the same paper keyed under its volume date and its issue date,
 * with the journal written two ways.
 *
 * @param context - The loaded data the checks read.
 */
export function checkDuplicateReferences(context: ValidationContext): void
{
    const {
        referenceStoreParsed,
    } = context;

    const referencesByDoi = new Map<string, string>();

    const referencesByIdentity = new Map<string, string>();

    for (const [filePath, entry] of referenceStoreParsed)
    {
        if (!entry || !entry.id)
        {
            continue;
        }

        const doi = entry.doi ? normalizeDoi(String(entry.doi)) : null;
        const identity = referenceIdentity(entry);

        if (doi !== null && referencesByDoi.has(doi))
        {
            checkError(
                "Duplicate references",
                filePath,
                `reference '${entry.id}': DOI ${doi} is already the DOI of '${referencesByDoi.get(doi)}'; one work takes one entry`,
            );
        }
        else if (doi !== null)
        {
            referencesByDoi.set(doi, entry.id);
        }

        if (identity !== null && referencesByIdentity.has(identity))
        {
            checkError(
                "Duplicate references",
                filePath,
                `reference '${entry.id}': same title, volume and pages as '${referencesByIdentity.get(identity)}'; one work takes one entry, keyed by the year it first became available`,
            );
        }
        else if (identity !== null)
        {
            referencesByIdentity.set(identity, entry.id);
        }
    }
}

/**
 * The "Flagged publication sources" check.
 *
 * Flagged publication sources — references citing publishers or
 * journals on flagged-sources.yml emit a warning for reviewer sign-off.
 *
 * @param context - The loaded data the checks read.
 */
export function checkFlaggedPublicationSources(context: ValidationContext): void
{
    const {
        flaggedJournals,
        flaggedPublishers,
        referenceStoreParsed,
        verifiedReferenceIds,
    } = context;

    for (const [filePath, reference] of referenceStoreParsed)
    {
        if (!reference)
        {
            continue;
        }

        const publisher = reference.publisher?.trim().toLowerCase();
        const journal = reference.journal?.trim().toLowerCase();
        const referenceLabel = reference.id ?? reference.title ?? "?";

        if (reference.id && verifiedReferenceIds.has(reference.id))
        {
            continue;
        }

        if (publisher && flaggedPublishers.has(publisher))
        {
            checkWarning(
                "Flagged publication sources",
                filePath,
                `reference '${referenceLabel}': publisher '${reference.publisher}' is flagged for reviewer verification`);
        }

        if (journal && flaggedJournals.has(journal))
        {
            checkWarning(
                "Flagged publication sources",
                filePath,
                `reference '${referenceLabel}': journal '${reference.journal}' is flagged for reviewer verification`);
        }
    }
}

/**
 * The "Reference notes length" check.
 *
 * Reference notes length — keep concise and factual
 *
 * @param context - The loaded data the checks read.
 */
export function checkReferenceNotesLength(context: ValidationContext): void
{
    const {
        allParsed,
    } = context;

    for (const [filePath, doc] of allParsed)
    {
        if (!doc || !Array.isArray(doc.references))
        {
            continue;
        }

        for (const reference of doc.references)
        {
            if (!reference || typeof reference.notes !== "string")
            {
                continue;
            }

            if (reference.notes.length > referenceNotesLimit)
            {
                const referenceLabel = reference.id ?? "?";

                checkWarning(
                    "Reference notes length",
                    filePath,
                    `reference '${referenceLabel}': notes is ${reference.notes.length} chars (keep under ${referenceNotesLimit}, prose belongs in description)`);
            }
        }
    }
}

/**
 * The "Dispute structure" check.
 *
 * Dispute structure — object with a non-empty string summary and no other
 * key. Applies to genera and clades.
 *
 * @param context - The loaded data the checks read.
 */
export function checkDisputeStructure(context: ValidationContext): void
{
    const {
        allParsed,
    } = context;

    for (const [filePath, doc] of allParsed)
    {
        if (!doc || !doc.dispute)
        {
            continue;
        }

        if (typeof doc.dispute.summary !== "string" || doc.dispute.summary.trim() === "")
        {
            checkError(
                "Dispute structure",
                filePath,
                "dispute must have a non-empty 'summary' string");
        }

        for (const key of Object.keys(doc.dispute).filter((name) => name !== "summary"))
        {
            checkError(
                "Dispute structure",
                filePath,
                `dispute has an unknown key '${key}'; it holds only 'summary', and reasoning goes in the record's research notes`);
        }
    }
}

/**
 * The "Uncited narrative citations" check.
 *
 * Comment-eaten scalars — YAML starts a comment at a space followed by "#",
 * so an unquoted plain scalar containing " #" silently loses everything from
 * there on. The loss happens at parse time, which is why no other check sees
 * it: they all read the parsed document, where the tail is already gone. Five
 * localities shipped truncated this way before it was noticed -- Emiliasaura
 * reached dist/ as the single word "Quarry" where the file says
 * "Quarry #1, Paraje Pilmatue". The fix is always to quote the value.
 * Uncited narrative citations — every author and year a record's prose names
 * is in that record's own references, read or not (research/methods.md,
 * "Every work cited is in the record's references"), so a reader who meets
 * "Smith (2000)" can find the work. Prose names people rather than keys, so
 * this is the only check on it. Names inside quotations count too: a quoted
 * paper's citation is a work the record cites. A quoted year or spelling that
 * differs from the key is matched through the store entry's `also_cited_as`.
 *
 * @param context - The loaded data the checks read.
 */
export function checkUncitedNarrativeCitations(context: ValidationContext): void
{
    const {
        cladeParsed,
        genusParsed,
        referenceStoreById,
        registryEntries,
    } = context;

    const narrativeSkippedKeys = new Set(["id", "history", "beds"]);

    /**
     * Collects the prose strings of a record, skipping reference ids, the history
     * of edits (which often records a source's removal), and nested beds, which
     * are checked against their own references.
     *
     * @param node - The parsed record or part of it.
     * @param found - Receives each prose string.
     */
    function collectProse(node: unknown, found: Array<string>): void
    {
        walkStrings(node, (text) =>
        {
            found.push(text.replace(/\s+/g, " "));
        }, { skipKeys: narrativeSkippedKeys });
    }

    /**
     * Reports each citation in a record's prose that none of its reference ids
     * can be.
     *
     * @param label - How the finding names the record.
     * @param filePath - The record's file.
     * @param record - The parsed record.
     */
    function checkNarrativeCitations(label: string, filePath: string, record: unknown): void
    {
        const prose = new Array<string>();

        collectProse(record, prose);

        const pointers = (record as { references?: Array<{ id?: string } | string> }).references ?? [];
        const ids = pointers.map((pointer) => (typeof pointer === "string" ? pointer : pointer?.id ?? "")).filter((id) => id.length > 0);
        const uncited = new Array<string>();

        for (const citation of narrativeCitations(prose.join(" ")))
        {
            const cited = ids.some((id) => citationMatchesId(citation, id, referenceStoreById.get(id)));

            if (!cited)
            {
                uncited.push(`${citation.surname} (${citation.year}${citation.letter ?? ""})`);
            }
        }

        if (uncited.length > 0)
        {
            checkError(
                "Uncited narrative citations",
                filePath,
                `${label}: names ${uncited.join(", ")} but its references hold no matching entry; add the work's id to references, minting it first if the store lacks it`);
        }
    }

    for (const [filePath, genus] of genusParsed)
    {
        checkNarrativeCitations(path.basename(filePath, ".yml"), filePath, genus);
    }

    for (const [filePath, clade] of cladeParsed)
    {
        checkNarrativeCitations(path.basename(filePath, ".yml"), filePath, clade);
    }

    for (const { label, entry, filePath } of registryEntries)
    {
        checkNarrativeCitations(label, filePath, entry);
    }
}
