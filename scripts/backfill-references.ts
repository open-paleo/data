/**
 * Backfills the `references` array, `species.described`, and
 * `species.described_in` fields on genus YAML files using the original
 * description reference from PaleoBioDB.
 *
 * For each genus with a `pbdb` identifier the script:
 *   1. Fetches the taxon record (show=ref) to discover the
 *      `reference_no` of the publication where the name was first used.
 *   2. Fetches the reference record (refs/single, show=both) for
 *      structured citation fields.
 *   3. Optionally enriches via doi.org content negotiation when the
 *      reference has a DOI (cleaner author lists and titles).
 *   4. Compares against the genus's existing references and emits a
 *      diff report bucketed as fillable / consistent / conflict /
 *      already-rich / unreachable.
 *
 * Modes:
 *   (default)   Emit JSON report to reports/reference-backfill.json.
 *   --apply     Fill empty `references` and missing `species.described`
 *               / `species.described_in` on the type species. Never
 *               overwrites existing reference entries.
 *   --genus N   Process only the named genus.
 *   --limit N   Process at most N genera.
 *   --offset N  Skip the first N genera.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-references.ts [options]
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";
import { parseDocument } from "yaml";
import type { GenusData, Reference, Species } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const reportPath = path.join(root, "reports", "reference-backfill.json");

const cacheDir = path.join(os.homedir(), "Desktop", "open-paleo-wd", "pbdb_refs");

const pbdbApiBase = "https://paleobiodb.org/data1.2";
const batchSize = 5;
const batchDelayMs = 1000;

type CliOptions = {
    apply: boolean;
    genus?: string;
    limit?: number;
    offset: number;
};

type PbdbTaxonRefRecord = {
    nam?: string;
    rnk?: string;
    rid?: string;
    ref?: string;
};

type PbdbReferenceRecord = {
    reference_no?: string;
    publication_type?: string;
    reftitle?: string;
    pubyr?: string;
    author1init?: string;
    author1last?: string;
    author2init?: string;
    author2last?: string;
    author3init?: string;
    author3last?: string;
    otherauthors?: string;
    pubtitle?: string;
    pubvol?: string;
    pubno?: string;
    firstpage?: string;
    lastpage?: string;
    publisher?: string;
    doi?: string;
    formatted?: string;
};

type DiffBucket =
    | "fillable"
    | "consistent"
    | "conflict"
    | "already-rich"
    | "no-pbdb-id"
    | "no-pbdb-reference"
    | "fetch-failed";

type DiffEntry = {
    genus: string;
    file: string;
    bucket: DiffBucket;
    pbdbReference?: Reference;
    existingReferenceCount?: number;
    typeSpeciesName?: string;
    typeSpeciesHasDescribed?: boolean;
    typeSpeciesHasDescribedIn?: boolean;
    conflictReason?: string;
    notes?: string;
};

type Report = {
    generatedAt: string;
    summary: Record<DiffBucket, number> & { total: number };
    entries: Array<DiffEntry>;
};

/**
 * Parses CLI arguments into a typed options object.
 *
 * @returns Parsed CLI options.
 */
function parseArgs(): CliOptions
{
    const args = process.argv.slice(2);
    const options: CliOptions = { apply: false, offset: 0 };

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
        else if (arg === "--limit" && args[index + 1])
        {
            options.limit = parseInt(args[index + 1], 10);
            index += 1;
        }
        else if (arg === "--offset" && args[index + 1])
        {
            options.offset = parseInt(args[index + 1], 10);
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
 * Fetches a JSON document from a URL with disk caching.
 *
 * @param requestUrl - The URL to fetch.
 * @param cacheKey - Stable key used as the cache filename.
 * @returns Parsed JSON, or null if the request failed.
 */
async function fetchJsonCached(requestUrl: string, cacheKey: string): Promise<unknown>
{
    fs.mkdirSync(cacheDir, { recursive: true });

    const cacheFile = path.join(cacheDir, `${cacheKey}.json`);

    if (fs.existsSync(cacheFile))
    {
        return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    }

    try
    {
        const response = await fetch(requestUrl);

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json();

        fs.writeFileSync(cacheFile, JSON.stringify(data), "utf8");

        return data;
    }
    catch
    {
        return null;
    }
}

/**
 * Fetches the original-name reference id for a PBDB taxon.
 *
 * @param pbdbId - The numeric PBDB taxon id.
 * @returns The PBDB reference number (without the "ref:" prefix), or null.
 */
async function fetchTaxonReferenceNo(pbdbId: string): Promise<string | null>
{
    const requestUrl = `${pbdbApiBase}/taxa/single.json?id=txn:${pbdbId}&show=ref`;
    const data = await fetchJsonCached(requestUrl, `taxon-${pbdbId}`) as {
        records?: Array<PbdbTaxonRefRecord>;
    } | null;

    const record = data?.records?.[0];

    if (!record?.rid)
    {
        return null;
    }

    return record.rid.replace(/^ref:/, "");
}

/**
 * Fetches the structured reference record from PBDB.
 *
 * @param referenceNo - The PBDB reference number.
 * @returns The structured reference record, or null.
 */
async function fetchPbdbReferenceRecord(referenceNo: string): Promise<PbdbReferenceRecord | null>
{
    const requestUrl = `${pbdbApiBase}/refs/single.json?id=ref:${referenceNo}&show=both&vocab=pbdb`;
    const data = await fetchJsonCached(requestUrl, `ref-${referenceNo}`) as {
        records?: Array<PbdbReferenceRecord>;
    } | null;

    return data?.records?.[0] ?? null;
}

/**
 * Composes an "Surname, Initial" formatted author entry.
 *
 * @param last - Author's surname.
 * @param init - Author's initials.
 * @returns Formatted author string.
 */
function formatAuthor(last: string, init: string | undefined): string
{
    return init ? `${last}, ${init}` : last;
}

/**
 * Strips HTML tags and normalizes whitespace in a string. Used to
 * clean doi.org content-negotiation responses, which often include
 * inline italic/superscript tags inside titles.
 *
 * @param value - The string to clean.
 * @returns The cleaned string.
 */
function stripHtml(value: string): string
{
    return value
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Builds a "Surname, Initial; Surname, Initial; ..." author list from a
 * PBDB reference record.
 *
 * @param record - The PBDB reference record.
 * @returns Formatted author string, or an empty string when no authors are present.
 */
function buildAuthorList(record: PbdbReferenceRecord): string
{
    const parts: Array<string> = [];

    if (record.author1last)
    {
        parts.push(formatAuthor(record.author1last, record.author1init));
    }

    if (record.author2last)
    {
        parts.push(formatAuthor(record.author2last, record.author2init));
    }

    if (record.author3last)
    {
        parts.push(formatAuthor(record.author3last, record.author3init));
    }

    if (record.otherauthors)
    {
        parts.push(record.otherauthors.trim());
    }

    return parts.join("; ");
}

/**
 * Fetches structured citation data from doi.org content negotiation.
 *
 * @param doi - The DOI string.
 * @returns A partial Reference object, or null on failure.
 */
async function fetchDoiReference(doi: string): Promise<Partial<Reference> | null>
{
    const cacheKey = `doi-${doi.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const cacheFile = path.join(cacheDir, `${cacheKey}.json`);

    fs.mkdirSync(cacheDir, { recursive: true });

    if (fs.existsSync(cacheFile))
    {
        return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    }

    try
    {
        const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
            headers: { "Accept": "application/citeproc+json" },
            redirect: "follow",
        });

        if (!response.ok)
        {
            fs.writeFileSync(cacheFile, "null", "utf8");
            return null;
        }

        const data = await response.json() as Record<string, unknown>;
        const result: Partial<Reference> = {};

        if (Array.isArray(data.author))
        {
            result.authors = data.author
                .map((author: Record<string, string>) =>
                    [author.family, author.given].filter(Boolean).join(", "),
                )
                .join("; ");
        }

        const issued = data.issued as { "date-parts"?: Array<Array<number>> } | undefined;

        if (issued?.["date-parts"]?.[0])
        {
            result.year = issued["date-parts"][0][0];
        }

        if (data.title)
        {
            const rawTitle = Array.isArray(data.title) ? String(data.title[0]) : String(data.title);
            result.title = stripHtml(rawTitle);
        }

        const containerTitle = data["container-title"];

        if (containerTitle)
        {
            const rawJournal = Array.isArray(containerTitle)
                ? String(containerTitle[0])
                : String(containerTitle);
            result.journal = stripHtml(rawJournal);
        }

        if (data.volume)
        {
            result.volume = String(data.volume);
        }

        if (data.issue)
        {
            result.issue = String(data.issue);
        }

        if (data.page)
        {
            const page = String(data.page);
            const doiString = String(data.DOI ?? "");

            if (!doiString.includes(page))
            {
                result.pages = page;
            }
        }

        if (data.DOI)
        {
            result.doi = String(data.DOI);
        }

        if (data.publisher)
        {
            result.publisher = String(data.publisher);
        }

        fs.writeFileSync(cacheFile, JSON.stringify(result), "utf8");

        return result;
    }
    catch
    {
        return null;
    }
}

/**
 * Builds a citation key from an author list and year (e.g. "cope1872").
 *
 * @param authors - "Surname, Initial; ..." formatted author list.
 * @param year - Publication year.
 * @returns Lowercase citation key with surname and year.
 */
function citationKey(authors: string, year: number): string
{
    const firstSurname = authors.split(";")[0].split(",")[0].trim().toLowerCase();
    const slug = firstSurname.replace(/[^a-z]/g, "");

    return `${slug}${year}`;
}

/**
 * Builds a Reference object from a PBDB reference record, optionally
 * merged with cleaner data from doi.org content negotiation.
 *
 * @param record - The PBDB reference record.
 * @param doiReference - Partial reference data from doi.org, or null.
 * @returns A Reference object with a generated citation key, or null
 *          when the record lacks the minimum fields.
 */
function buildReferenceEntry(
    record: PbdbReferenceRecord,
    doiReference: Partial<Reference> | null,
): Reference | null
{
    const pbdbAuthors = buildAuthorList(record);
    const year = parseInt(record.pubyr ?? "", 10);

    if (!pbdbAuthors || !year || !record.reftitle)
    {
        return null;
    }

    const doiAuthors = doiReference?.authors
        ?.split(";")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join("; ");
    const authors = doiAuthors && doiAuthors.split(",")[0].trim()
        ? doiAuthors
        : pbdbAuthors;
    const cleanTitle = stripHtml(doiReference?.title ?? record.reftitle);
    const bookPublicationTypes = new Set([
        "book",
        "book chapter",
        "book/book chapter",
        "compendium",
        "serial monograph",
        "guidebook",
    ]);
    const isBook = bookPublicationTypes.has(record.publication_type ?? "");
    const reference: Reference = {
        id: citationKey(authors, year),
        authors,
        year,
        title: cleanTitle,
    };

    if (isBook)
    {
        reference.book = cleanTitle;
    }

    const journal = doiReference?.journal ?? record.pubtitle;

    if (journal && !isBook)
    {
        reference.journal = journal;
    }

    const volume = doiReference?.volume ?? record.pubvol;

    if (volume)
    {
        reference.volume = volume;
    }

    const issue = doiReference?.issue ?? record.pubno;

    if (issue)
    {
        reference.issue = issue;
    }

    const pages = doiReference?.pages
        ?? (record.firstpage && record.lastpage
            ? `${record.firstpage}-${record.lastpage}`
            : record.firstpage);

    if (pages)
    {
        reference.pages = pages;
    }

    const publisher = doiReference?.publisher ?? record.publisher;

    if (publisher)
    {
        reference.publisher = publisher;
    }

    const doi = doiReference?.doi ?? record.doi;

    if (doi)
    {
        reference.doi = doi;
        reference.url = `http://dx.doi.org/${doi}`;
    }

    return reference;
}

/**
 * Returns the PBDB taxon id for a genus, or null if none is recorded.
 *
 * @param genus - The parsed genus YAML.
 * @returns The PBDB id as a string, or null.
 */
function getPbdbId(genus: GenusData): string | null
{
    if (!Array.isArray(genus.identifiers))
    {
        return null;
    }

    for (const identifier of genus.identifiers)
    {
        if (identifier.source === "pbdb" && identifier.id !== undefined && identifier.id !== null)
        {
            return String(identifier.id);
        }
    }

    return null;
}

/**
 * Returns the type species, falling back to the first listed species.
 *
 * @param genus - The parsed genus YAML.
 * @returns The type species record, or null when no species are present.
 */
function getTypeSpecies(genus: GenusData): Species | null
{
    if (!Array.isArray(genus.species) || genus.species.length === 0)
    {
        return null;
    }

    for (const species of genus.species)
    {
        if (species?.type_species)
        {
            return species;
        }
    }

    return genus.species[0];
}

/**
 * Compares an existing reference list against a candidate PBDB
 * reference and returns either "consistent" (the candidate matches an
 * existing entry on first-author surname and year) or a conflict
 * reason describing the mismatch.
 *
 * @param existing - Existing references on the genus.
 * @param candidate - The PBDB-derived reference.
 * @returns "consistent" or a string describing the conflict.
 */
function classifyAgainstExisting(existing: Array<Reference>, candidate: Reference): "consistent" | string
{
    const candidateDoi = candidate.doi?.trim().toLowerCase();
    const candidateSurname = (candidate.authors ?? "").split(";")[0].split(",")[0].trim().toLowerCase();

    if (candidateDoi)
    {
        for (const reference of existing)
        {
            const existingDoi = reference.doi?.trim().toLowerCase();

            if (existingDoi && existingDoi === candidateDoi)
            {
                return "consistent";
            }
        }
    }

    for (const reference of existing)
    {
        const surname = (reference.authors ?? "").split(";")[0].split(",")[0].trim().toLowerCase();

        if (surname && surname === candidateSurname && reference.year === candidate.year)
        {
            const existingDoi = reference.doi?.trim().toLowerCase();
            const doiConflict = candidateDoi && existingDoi && candidateDoi !== existingDoi;

            if (doiConflict)
            {
                return `DOI mismatch: existing ${reference.doi} vs PBDB ${candidate.doi}`;
            }

            return "consistent";
        }
    }

    return `no existing reference matches PBDB ${candidateSurname || "(no author)"} ${candidate.year}`;
}

/**
 * Inserts the references list and species described/described_in
 * fields into a genus YAML file. Uses the yaml Document API to
 * preserve formatting of unmodified nodes.
 *
 * @param filePath - Absolute path to the genus YAML file.
 * @param entry - The diff entry describing what to apply.
 * @returns True when the file was modified, false otherwise.
 */
function applyToFile(filePath: string, entry: DiffEntry): boolean
{
    if (!entry.pbdbReference)
    {
        return false;
    }

    const reference = entry.pbdbReference;
    const original = fs.readFileSync(filePath, "utf8");
    const document = parseDocument(original);
    let modified = false;

    if (entry.bucket === "fillable")
    {
        document.set("references", [reference]);
        modified = true;
    }

    const speciesNode = document.get("species") as { items?: Array<unknown> } | undefined;
    const speciesItems = speciesNode?.items ?? [];

    for (const item of speciesItems)
    {
        const speciesItem = item as {
            get: (key: string) => unknown;
            set: (key: string, value: unknown) => void;
            has: (key: string) => boolean;
        };
        const isType = speciesItem.get("type_species") === true;
        const isFirstFallback = speciesItems.indexOf(item) === 0
            && !speciesItems.some((other) => (other as { get: (key: string) => unknown }).get("type_species") === true);

        if (!isType && !isFirstFallback)
        {
            continue;
        }

        if (!speciesItem.has("described") && reference.year)
        {
            speciesItem.set("described", reference.year);
            modified = true;
        }

        if (!speciesItem.has("described_in") && reference.id)
        {
            speciesItem.set("described_in", reference.id);
            modified = true;
        }

        break;
    }

    if (modified)
    {
        fs.writeFileSync(filePath, document.toString(), "utf8");
    }

    return modified;
}

/**
 * Audits a single genus file: fetches the PBDB describing reference
 * and classifies the result against the file's existing data.
 *
 * @param filePath - Absolute path to the genus YAML file.
 * @returns A diff entry describing the audit outcome.
 */
async function auditGenus(filePath: string): Promise<DiffEntry>
{
    const genus = parseYaml<GenusData>(filePath);
    const name = genus.genus ?? path.basename(filePath, ".yml");
    const typeSpecies = getTypeSpecies(genus);
    const baseEntry: DiffEntry = {
        genus: name,
        file: path.relative(root, filePath),
        bucket: "no-pbdb-id",
        existingReferenceCount: genus.references?.length ?? 0,
        typeSpeciesName: typeSpecies?.name,
        typeSpeciesHasDescribed: Boolean(typeSpecies?.described),
        typeSpeciesHasDescribedIn: Boolean(typeSpecies?.described_in),
    };

    const pbdbId = getPbdbId(genus);

    if (!pbdbId)
    {
        return baseEntry;
    }

    const referenceNo = await fetchTaxonReferenceNo(pbdbId);

    if (!referenceNo)
    {
        return { ...baseEntry, bucket: "no-pbdb-reference" };
    }

    const record = await fetchPbdbReferenceRecord(referenceNo);

    if (!record)
    {
        return { ...baseEntry, bucket: "fetch-failed" };
    }

    const doiReference = record.doi ? await fetchDoiReference(record.doi) : null;
    const candidate = buildReferenceEntry(record, doiReference);

    if (!candidate)
    {
        return {
            ...baseEntry,
            bucket: "fetch-failed",
            notes: `PBDB ref ${referenceNo} missing required fields (authors/year/title)`,
        };
    }

    const existing = Array.isArray(genus.references) ? genus.references : [];

    if (existing.length === 0)
    {
        return { ...baseEntry, bucket: "fillable", pbdbReference: candidate };
    }

    const classification = classifyAgainstExisting(existing, candidate);

    if (classification === "consistent")
    {
        return {
            ...baseEntry,
            bucket: existing.length > 1 ? "already-rich" : "consistent",
            pbdbReference: candidate,
        };
    }

    return {
        ...baseEntry,
        bucket: "conflict",
        pbdbReference: candidate,
        conflictReason: classification,
    };
}

/**
 * Selects the genus files to process, applying CLI filters.
 *
 * @param options - Parsed CLI options.
 * @returns Sorted absolute paths to genus YAML files.
 */
function selectGeneraFiles(options: CliOptions): Array<string>
{
    const all = findYamlFiles(generaDir).sort();

    if (options.genus)
    {
        const target = options.genus.toLowerCase();
        return all.filter((filePath) => path.basename(filePath, ".yml").toLowerCase() === target);
    }

    const sliced = all.slice(options.offset);

    if (options.limit !== undefined)
    {
        return sliced.slice(0, options.limit);
    }

    return sliced;
}

/**
 * Runs audits for a list of files in rate-limited batches.
 *
 * @param files - Absolute paths to process.
 * @returns Array of diff entries (one per file).
 */
async function auditAll(files: Array<string>): Promise<Array<DiffEntry>>
{
    const entries: Array<DiffEntry> = [];

    for (let index = 0; index < files.length; index += batchSize)
    {
        const batch = files.slice(index, index + batchSize);
        const results = await Promise.all(batch.map((filePath) => auditGenus(filePath)));

        entries.push(...results);

        const completed = Math.min(index + batchSize, files.length);
        process.stdout.write(`  ${completed}/${files.length}\r`);

        if (index + batchSize < files.length)
        {
            await sleep(batchDelayMs);
        }
    }

    process.stdout.write("\n");

    return entries;
}

/**
 * Builds a summary count for each bucket plus a total.
 *
 * @param entries - All diff entries.
 * @returns Bucket counts.
 */
function summarize(entries: Array<DiffEntry>): Report["summary"]
{
    const summary: Report["summary"] = {
        total: entries.length,
        fillable: 0,
        consistent: 0,
        conflict: 0,
        "already-rich": 0,
        "no-pbdb-id": 0,
        "no-pbdb-reference": 0,
        "fetch-failed": 0,
    };

    for (const entry of entries)
    {
        summary[entry.bucket] += 1;
    }

    return summary;
}

/**
 * Entry point: parses CLI options, audits the selected genera, writes
 * a JSON report, and (when --apply) writes filled fields back to the
 * genus files.
 */
async function main(): Promise<void>
{
    const options = parseArgs();
    const files = selectGeneraFiles(options);

    if (files.length === 0)
    {
        console.error("No genus files matched the selection.");
        process.exit(1);
    }

    console.log(`Auditing ${files.length} genera against PBDB...`);

    const entries = await auditAll(files);
    const summary = summarize(entries);
    const report: Report = {
        generatedAt: new Date().toISOString(),
        summary,
        entries,
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log("");
    console.log(`Report: ${path.relative(root, reportPath)}`);
    console.log("Summary:");

    for (const [bucket, count] of Object.entries(summary))
    {
        console.log(`  ${bucket.padEnd(20)} ${count}`);
    }

    if (!options.apply)
    {
        return;
    }

    console.log("");
    console.log("Applying fills to fillable genera...");

    let filesWritten = 0;

    for (const entry of entries)
    {
        if (entry.bucket !== "fillable")
        {
            continue;
        }

        const absolutePath = path.join(root, entry.file);

        if (applyToFile(absolutePath, entry))
        {
            filesWritten += 1;
        }
    }

    console.log(`Wrote ${filesWritten} files.`);
}

await main();
