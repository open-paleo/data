/**
 * Batch import script for populating genus data from PBDB, Wikipedia,
 * and Wikidata. Uses GitHub Intake issues as the genus list, enriches
 * each with data from all three sources, then generates YAML files in
 * a staging directory for review.
 *
 * Usage:
 *   node --experimental-strip-types scripts/batch-import.ts [options]
 *
 * Options:
 *   --limit N     Process only the first N genera (default: all)
 *   --dry-run     Fetch and filter but do not write files
 *   --offset N    Skip the first N genera before processing
 */

import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { stringify as stringifyYaml } from "yaml";
import type { GenusData, CladeData, Schema, TreeNode, StageInfo } from "./types.ts";
import { parseYaml, findYamlFiles, collectAllKeys, loadInstitutionRegistry, flattenInstitutionMap } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const stagingDir = path.join(root, "staging");

const pbdbApiBase = "https://paleobiodb.org/data1.2";
const wikidataApiBase = "https://www.wikidata.org";
const wikipediaApiBase = "https://en.wikipedia.org/w/api.php";

const batchSize = 5;
const batchDelayMs = 1000;

const institutionRegistry = loadInstitutionRegistry(path.join(root, "institutions.yaml"));
const museumNames: Record<string, string> = flattenInstitutionMap(institutionRegistry);

type IntakeIssue = {
    number: number;
    title: string;
};

type PbdbTaxon = {
    taxon_no?: number;
    taxon_name?: string;
    taxon_attr?: string;
    parent_no?: number;
    diet?: string;
    early_interval?: string;
    late_interval?: string;
    firstapp_max_ma?: number;
    firstapp_min_ma?: number;
    lastapp_max_ma?: number;
    lastapp_min_ma?: number;
    reference_no?: number;
};

type PbdbOccurrence = {
    formation?: string;
    cc?: string;
    state?: string;
    lat?: number;
    lng?: number;
};

type PbdbHolotype = {
    specimenId?: string;
    institution?: string;
};

type WikitextData = {
    typeSpecies?: string;
    temporalRange?: string;
    authority?: string;
    formation?: string;
    country?: string;
    summary?: string;
    etymology?: string;
    ipa?: string;
    holotypeSpecimenId?: string;
    holotypeInstitution?: string;
};

type WikidataData = {
    qid?: string;
    parentTaxon?: string | null;
    typeSpecies?: string | null;
    diet?: string | null;
    mass?: string | null;
    length?: string | null;
    hipHeight?: string | null;
    gbifId?: string | null;
    eolId?: string | null;
    zoobankId?: string | null;
};

type WikidataClaim = {
    mainsnak?: {
        snaktype?: string;
        datavalue?: {
            type?: string;
            value?: Record<string, unknown>;
        };
    };
};

type WikidataClaims = Record<string, Array<WikidataClaim>>;

type EnrichedGenus = {
    name: string;
    issueNumber: number;
    pbdbId: number;
    parentChain: Array<string>;
    parentClade?: string;
    authors?: string;
    year?: number;
    diet?: string;
    locomotion?: string;
    integument?: string;
    period?: string;
    stage?: string;
    fromMa?: number;
    toMa?: number;
    country?: string;
    countryCode?: string;
    region?: string;
    formation?: string;
    latitude?: number;
    longitude?: number;
    typeSpecies?: string;
    etymology?: string;
    description?: string;
    ipa?: string;
    holotype?: PbdbHolotype;
    mass?: string;
    bodyLength?: string;
    hipHeight?: string;
    wikidataQid?: string;
    gbifId?: string;
    eolId?: string;
    zoobankId?: string;
    referenceDoi?: string;
    reference?: Record<string, string> | null;
    fieldsPopulated: number;
    fieldsTotal: number;
};

type Report = {
    timestamp: string;
    totalIntakeIssues: number;
    skippedAlreadyExists: number;
    skippedAlreadyExistsNames: Array<string>;
    skippedNoParent: number;
    skippedNoParentNames: Array<string>;
    generaProcessed: number;
    newCladesAdded: Array<string>;
    genera: Array<{
        name: string;
        issueNumber: number;
        fieldsPopulated: number;
        fieldsTotal: number;
        gaps: Array<string>;
    }>;
};

const parentChainCache = new Map<number, Array<string>>();
const schema = parseYaml<Schema>(path.join(root, "schema.yml"));
const tree = parseYaml<TreeNode>(path.join(root, "tree.yml"));
const allClades = collectAllKeys(tree);

/**
 * Pauses execution for a given number of milliseconds.
 *
 * @param milliseconds - The duration to sleep.
 * @returns A promise that resolves after the delay.
 */
function sleep(milliseconds: number): Promise<void>
{
    return new Promise((resolve) =>
    {
        setTimeout(resolve, milliseconds);
    });
}

/**
 * Fetches JSON from a URL with basic error handling and retries.
 *
 * @param fetchUrl - The URL to fetch.
 * @param options - Optional fetch options.
 * @returns The parsed JSON response, or null on failure.
 */
async function fetchJson(fetchUrl: string, options?: RequestInit): Promise<unknown>
{
    for (let attempt = 0; attempt < 3; attempt++)
    {
        try
        {
            const response = await fetch(fetchUrl, options);

            if (!response.ok)
            {
                if (response.status === 429 || response.status >= 500)
                {
                    await sleep(2000 * (attempt + 1));
                    continue;
                }

                return null;
            }

            return await response.json();
        }
        catch
        {
            if (attempt < 2)
            {
                await sleep(2000 * (attempt + 1));
            }
        }
    }

    return null;
}

/**
 * Prefix for labels on Intake issues that indicate the genus needs
 * manual review and should be skipped during batch import. Any label
 * starting with this prefix (e.g. "Intake: Nomen Nudum",
 * "Intake: Disputed") will cause the issue to be skipped.
 */
const skipLabelPrefix = "Intake: ";

/**
 * Fetches all open Intake issues from GitHub, excluding those with
 * labels that indicate they need manual review (e.g., junior synonym,
 * nomen nudum). Uses the `gh` CLI for authentication.
 *
 * @returns An array of intake issues with number and genus name (title).
 */
function fetchIntakeIssues(): Array<IntakeIssue>
{
    console.log("Fetching Intake issues from GitHub...");

    const allIssues = new Array<IntakeIssue>();
    let page = 1;

    while (true)
    {
        let result: string;

        try
        {
            result = childProcess.execSync(
                `gh api "repos/open-paleo/data/issues?labels=Intake&state=open&per_page=100&page=${page}" --jq '[.[] | {number, title, labels: [.labels[].name]}]'`,
                { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
            );
        }
        catch (error)
        {
            if (page === 1)
            {
                console.error("Failed to fetch issues. Is the `gh` CLI installed and authenticated?");
                console.error(error instanceof Error ? error.message : error);
                process.exit(1);
            }

            break;
        }

        const batch = JSON.parse(result) as Array<{
            number: number;
            title: string;
            labels: Array<string>;
        }>;

        if (batch.length === 0)
        {
            break;
        }

        for (const issue of batch)
        {
            const hasSkipLabel = issue.labels.some(
                (label) => label.startsWith(skipLabelPrefix),
            );

            if (!hasSkipLabel)
            {
                allIssues.push({ number: issue.number, title: issue.title });
            }
        }

        page++;
    }

    console.log(`  Total Intake issues (after skipping flagged): ${allIssues.length}`);
    return allIssues;
}

/**
 * Walks the PBDB parent_no chain from a taxon up to Dinosauria,
 * returning the full list of intermediate clade names. Uses a cache
 * to avoid redundant API calls for shared ancestors.
 *
 * @param parentNo - The parent_no of the starting taxon.
 * @returns An array of clade names from immediate parent to Dinosauria.
 */
async function walkParentChain(parentNo: number): Promise<Array<string>>
{
    const chain = new Array<string>();
    const taxonNos = new Array<number>();
    let currentParentNo = parentNo;

    while (currentParentNo)
    {
        if (parentChainCache.has(currentParentNo))
        {
            chain.push(...parentChainCache.get(currentParentNo)!);
            break;
        }

        const params = new URLSearchParams({
            id: `txn:${currentParentNo}`,
            show: "parent",
            vocab: "pbdb",
        });

        const data = await fetchJson(`${pbdbApiBase}/taxa/single.json?${params}`) as {
            records?: Array<{ taxon_name?: string; taxon_no?: number; parent_no?: number }>;
        } | null;

        const record = data?.records?.[0];

        if (!record?.taxon_name)
        {
            break;
        }

        chain.push(record.taxon_name);
        taxonNos.push(currentParentNo);

        if (record.taxon_name === "Dinosauria")
        {
            break;
        }

        currentParentNo = record.parent_no ?? 0;
    }

    for (let index = 0; index < taxonNos.length; index++)
    {
        parentChainCache.set(taxonNos[index], chain.slice(index));
    }

    return chain;
}

/**
 * Inserts a clade chain into a tree node, creating intermediate nodes
 * as needed. The chain is ordered from leaf to root (Dinosauria).
 *
 * @param treeNode - The tree node to insert into.
 * @param chain - The clade chain from leaf to Dinosauria.
 * @returns An array of newly created clade names.
 */
function insertChainIntoTree(treeNode: TreeNode, chain: Array<string>): Array<string>
{
    const reversed = [...chain].reverse();
    const newClades = new Array<string>();

    const dinosauriaIndex = reversed.indexOf("Dinosauria");

    if (dinosauriaIndex < 0)
    {
        return newClades;
    }

    let current = findNode(treeNode, "Dinosauria");

    if (!current)
    {
        return newClades;
    }

    for (let index = dinosauriaIndex + 1; index < reversed.length; index++)
    {
        const cladeName = reversed[index];
        const existing = current[cladeName];

        if (existing && typeof existing === "object")
        {
            current = existing as TreeNode;
        }
        else
        {
            current[cladeName] = {};
            current = current[cladeName] as TreeNode;

            if (!allClades.includes(cladeName))
            {
                allClades.push(cladeName);
                newClades.push(cladeName);
            }
        }
    }

    return newClades;
}

/**
 * Recursively finds a named node in the tree, returning a reference
 * to its children object.
 *
 * @param node - The tree node to search.
 * @param name - The clade name to find.
 * @returns The children object of the found node, or null.
 */
function findNode(node: TreeNode, name: string): TreeNode | null
{
    for (const [key, children] of Object.entries(node))
    {
        if (key === name)
        {
            return children as TreeNode;
        }

        if (children && typeof children === "object" && Object.keys(children).length > 0)
        {
            const found = findNode(children as TreeNode, name);

            if (found)
            {
                return found;
            }
        }
    }

    return null;
}

/**
 * Fetches taxon data from PBDB for a single genus by name, returning
 * the primary taxon record with classification and ecological data.
 *
 * @param name - The genus name to search for.
 * @returns The PBDB taxon record, or null.
 */
async function fetchPbdbTaxon(name: string): Promise<PbdbTaxon | null>
{
    const params = new URLSearchParams({
        name: name,
        show: "attr,app,class,ecospace",
        vocab: "pbdb",
    });

    const data = await fetchJson(`${pbdbApiBase}/taxa/single.json?${params}`) as {
        records?: Array<PbdbTaxon>;
    } | null;

    return data?.records?.[0] ?? null;
}

/**
 * Fetches the type species name from PBDB by looking up children taxa
 * of the genus and returning the first species-rank child.
 *
 * @param name - The genus name.
 * @returns The type species name, or null.
 */
async function fetchPbdbTypeSpecies(name: string): Promise<string | null>
{
    const params = new URLSearchParams({
        name: name,
        rel: "children",
        vocab: "pbdb",
    });

    const data = await fetchJson(`${pbdbApiBase}/taxa/list.json?${params}`) as {
        records?: Array<{ accepted_name?: string; accepted_rank?: string }>;
    } | null;

    const species = data?.records?.find(
        (record) => record.accepted_rank === "species",
    );

    return species?.accepted_name ?? null;
}

/**
 * Fetches the first occurrence record for a genus from PBDB.
 *
 * @param name - The genus name.
 * @returns An occurrence record, or null.
 */
async function fetchPbdbOccurrence(name: string): Promise<PbdbOccurrence | null>
{
    const params = new URLSearchParams({
        base_name: name,
        show: "coords,loc,strat",
        vocab: "pbdb",
        limit: "1",
    });

    const data = await fetchJson(`${pbdbApiBase}/occs/list.json?${params}`) as {
        records?: Array<PbdbOccurrence>;
    } | null;

    return data?.records?.[0] ?? null;
}

/**
 * Fetches holotype specimen data from PBDB for a genus.
 *
 * @param name - The genus name.
 * @returns Holotype data with specimen ID and institution, or null.
 */
async function fetchPbdbHolotype(name: string): Promise<PbdbHolotype | null>
{
    const params = new URLSearchParams({
        base_name: name,
        spectype: "holo",
        show: "methods",
        vocab: "pbdb",
        limit: "1",
    });

    const data = await fetchJson(`${pbdbApiBase}/specs/list.json?${params}`) as {
        records?: Array<{ specimen_id?: string; museum?: string }>;
    } | null;

    const record = data?.records?.[0];

    if (!record)
    {
        return null;
    }

    const result: PbdbHolotype = {};

    if (record.specimen_id)
    {
        result.specimenId = record.specimen_id;
    }

    if (record.museum)
    {
        const abbreviation = record.museum.split(",")[0].trim();
        result.institution = museumNames[abbreviation] ?? abbreviation;
    }

    return result.specimenId ?? result.institution ? result : null;
}

/**
 * Fetches the DOI for a PBDB reference by its reference number.
 *
 * @param referenceNo - The PBDB reference number.
 * @returns The DOI string, or null.
 */
async function fetchPbdbReferenceDoi(referenceNo: number): Promise<string | null>
{
    const params = new URLSearchParams({
        id: `ref:${referenceNo}`,
        vocab: "pbdb",
    });

    const data = await fetchJson(`${pbdbApiBase}/refs/single.json?${params}`) as {
        records?: Array<{ doi?: string }>;
    } | null;

    return data?.records?.[0]?.doi ?? null;
}

/**
 * Fetches reference metadata from the doi.org content negotiation API.
 *
 * @param doi - The DOI string.
 * @returns A reference object with parsed citation data, or null.
 */
async function fetchDoiReference(doi: string): Promise<Record<string, string> | null>
{
    try
    {
        const response = await fetch(
            `https://doi.org/${encodeURIComponent(doi)}`,
            {
                headers: { "Accept": "application/citeproc+json" },
                redirect: "follow",
            },
        );

        if (!response.ok)
        {
            return null;
        }

        const data = await response.json() as Record<string, unknown>;
        const reference: Record<string, string> = {};

        if (Array.isArray(data.author))
        {
            reference.authors = data.author
                .map((author: Record<string, string>) =>
                    [author.family, author.given].filter(Boolean).join(", "),
                )
                .join("; ");
        }

        const issued = data.issued as { "date-parts"?: Array<Array<number>> } | undefined;

        if (issued?.["date-parts"]?.[0])
        {
            reference.year = String(issued["date-parts"][0][0]);
        }

        if (data.title)
        {
            reference.title = Array.isArray(data.title) ? data.title[0] : String(data.title);
        }

        const containerTitle = data["container-title"];

        if (containerTitle)
        {
            reference.journal = Array.isArray(containerTitle) ? containerTitle[0] : String(containerTitle);
        }

        if (data.volume)
        {
            reference.volume = String(data.volume);
        }

        if (data.issue)
        {
            reference.issue = String(data.issue);
        }

        if (data.page)
        {
            const page = String(data.page);
            const doiString = String(data.DOI ?? "");

            if (!doiString.includes(page))
            {
                reference.pages = page;
            }
        }

        if (data.DOI)
        {
            reference.doi = String(data.DOI);
        }

        if (data.publisher)
        {
            reference.publisher = String(data.publisher);
        }

        return reference;
    }
    catch
    {
        return null;
    }
}

/**
 * Checks whether a Wikipedia page is a disambiguation page and, if so,
 * attempts to find the dinosaur-related target article by searching
 * the wikitext for links containing dinosaur-related keywords.
 *
 * @param wikitext - The raw wikitext of the page.
 * @param extract - The plain-text extract from the Wikipedia API.
 * @returns The target page title if a dinosaur link is found, or null.
 */
function findDisambiguationTarget(wikitext: string, extract: string): string | null
{
    const isDisambiguation = /\{\{disambig/i.test(wikitext)
        || /\{\{disambiguation/i.test(wikitext)
        || /may refer to:/i.test(extract);

    if (!isDisambiguation)
    {
        return null;
    }

    const linkPattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\].*?(?:dinosaur|genus|theropod|sauropod|ornithopod|ceratops|ankylosaur|hadrosaur|pterosaur)/gi;
    const match = wikitext.match(linkPattern);

    if (match)
    {
        const targetMatch = match[0].match(/\[\[([^\]|]+)/);

        if (targetMatch)
        {
            return targetMatch[1].trim();
        }
    }

    const reverseLinkPattern = /(?:dinosaur|genus|theropod|sauropod|ornithopod|ceratops|ankylosaur|hadrosaur|pterosaur).*?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/gi;
    const reverseMatch = wikitext.match(reverseLinkPattern);

    if (reverseMatch)
    {
        const targetMatch = reverseMatch[0].match(/\[\[([^\]|]+)/);

        if (targetMatch)
        {
            return targetMatch[1].trim();
        }
    }

    return null;
}

/**
 * Fetches and parses the Wikipedia page for a genus, extracting the
 * taxobox, page summary, and etymology section.
 *
 * @param title - The Wikipedia page title to fetch.
 * @returns Parsed wikitext data, or null.
 */
async function parseWikitext(title: string): Promise<WikitextData | null>
{
    const parseParams = new URLSearchParams({
        action: "parse",
        page: title,
        prop: "wikitext|sections|text",
        format: "json",
        origin: "*",
    });

    const extractParams = new URLSearchParams({
        action: "query",
        titles: title,
        prop: "extracts",
        exintro: "true",
        explaintext: "true",
        format: "json",
        origin: "*",
    });

    const [parseData, extractData] = await Promise.all([
        fetchJson(`${wikipediaApiBase}?${parseParams}`) as Promise<{
            error?: unknown;
            parse?: {
                wikitext?: { "*"?: string };
                sections?: Array<{ line?: string; level?: string }>;
                text?: { "*"?: string };
            };
        } | null>,
        fetchJson(`${wikipediaApiBase}?${extractParams}`) as Promise<{
            query?: { pages?: Record<string, { extract?: string }> };
        } | null>,
    ]);

    if (!parseData || parseData.error)
    {
        return null;
    }

    const rawWikitext = parseData.parse?.wikitext?.["*"] ?? "";
    const rawExtract = extractData?.query?.pages
        ? Object.values(extractData.query.pages)[0]?.extract ?? ""
        : "";

    const disambiguationTarget = findDisambiguationTarget(rawWikitext, rawExtract);

    if (disambiguationTarget)
    {
        return parseWikitext(disambiguationTarget);
    }

    const wikitext = rawWikitext;
    const taxobox = extractTaxobox(wikitext);

    if (!taxobox && !title.includes("("))
    {
        const dinosaurPage = await parseWikitext(title + " (dinosaur)");

        if (dinosaurPage)
        {
            return dinosaurPage;
        }
    }

    const result: WikitextData = {};

    if (taxobox)
    {
        result.typeSpecies = cleanWikitext(taxobox["type_species"] ?? taxobox["type"] ?? "");

        if (!result.typeSpecies && taxobox["genus"] && taxobox["species"])
        {
            result.typeSpecies = cleanWikitext(taxobox["genus"]) + " " + cleanWikitext(taxobox["species"]);
        }

        result.temporalRange = cleanWikitext(
            taxobox["temporal_range"] ?? taxobox["fossil_range"] ?? taxobox["range"] ?? "",
        );
        result.authority = cleanWikitext(taxobox["authority"] ?? taxobox["parent_authority"] ?? "");
        result.formation = cleanWikitext(taxobox["formation"] ?? "");
        result.country = cleanWikitext(
            taxobox["country"] ?? taxobox["location"] ?? taxobox["fossil_site"] ?? "",
        );
    }

    if (extractData?.query?.pages)
    {
        const pages = extractData.query.pages;
        const pageId = Object.keys(pages)[0];
        const extract = pages[pageId]?.extract ?? "";
        const firstParagraph = extract.split("\n")[0] ?? "";

        result.summary = firstParagraph.replace(/\s{2,}/g, " ").trim();
    }

    if (!result.summary)
    {
        result.summary = extractSummary(wikitext);
    }

    result.etymology = extractEtymology(wikitext, parseData.parse?.sections ?? [], result.summary ?? "");

    result.ipa = extractIpa(parseData.parse?.text?.["*"] ?? "");

    if (!result.ipa)
    {
        result.ipa = extractWikitextIpa(wikitext);
    }

    const holotype = extractHolotype(wikitext);

    if (holotype.specimenId)
    {
        result.holotypeSpecimenId = holotype.specimenId;
    }

    if (holotype.institution)
    {
        result.holotypeInstitution = holotype.institution;
    }

    return result;
}

/**
 * Parses a taxobox/speciesbox template from raw wikitext.
 *
 * @param wikitext - The raw wikitext string.
 * @returns An object of taxobox parameters, or null.
 */
function extractTaxobox(wikitext: string): Record<string, string> | null
{
    const patterns = [
        /\{\{Speciesbox/i,
        /\{\{Taxobox/i,
        /\{\{Automatic[_ ]taxobox/i,
    ];

    let startIndex = -1;

    for (const pattern of patterns)
    {
        const match = wikitext.match(pattern);

        if (match?.index !== undefined)
        {
            startIndex = match.index;
            break;
        }
    }

    if (startIndex < 0)
    {
        return null;
    }

    let depth = 0;
    let endIndex = startIndex;

    for (let index = startIndex; index < wikitext.length; index++)
    {
        if (wikitext[index] === "{" && wikitext[index + 1] === "{")
        {
            depth++;
            index++;
        }
        else if (wikitext[index] === "}" && wikitext[index + 1] === "}")
        {
            depth--;
            index++;

            if (depth === 0)
            {
                endIndex = index + 1;
                break;
            }
        }
    }

    const boxText = wikitext.slice(startIndex, endIndex);
    const params: Record<string, string> = {};
    const paramRegex = /\|\s*([a-z_]+)\s*=\s*([^|{}]*(?:\{\{[^}]*\}\}[^|{}]*)*)/gi;
    let paramMatch;

    while ((paramMatch = paramRegex.exec(boxText)) !== null)
    {
        const key = paramMatch[1].trim().toLowerCase();
        const value = paramMatch[2].trim();

        if (value)
        {
            params[key] = value;
        }
    }

    return Object.keys(params).length > 0 ? params : null;
}

/**
 * Extracts the first paragraph of article body text as a summary.
 *
 * @param wikitext - The raw wikitext string.
 * @returns The cleaned summary text.
 */
function extractSummary(wikitext: string): string
{
    const lines = wikitext.split("\n");
    let inTemplate = 0;
    let summary = "";

    for (const line of lines)
    {
        const trimmed = line.trim();

        if (trimmed.startsWith("{{"))
        {
            inTemplate++;
        }

        if (inTemplate > 0)
        {
            if (trimmed.includes("}}"))
            {
                inTemplate--;
            }

            continue;
        }

        if (trimmed.startsWith("|") || trimmed.startsWith("{") || trimmed.startsWith("}") ||
            trimmed.startsWith("=") || trimmed.startsWith("[[File:") ||
            trimmed.startsWith("[[Image:") || trimmed === "")
        {
            if (summary)
            {
                break;
            }

            continue;
        }

        if (trimmed.startsWith("'") || /^[A-Z]/.test(trimmed))
        {
            summary += (summary ? " " : "") + cleanWikitext(trimmed);
        }
        else if (summary)
        {
            break;
        }
    }

    return summary;
}

/**
 * Extracts the etymology section content from wikitext. Falls back to
 * parsing the intro parenthetical or a "means" sentence if no dedicated
 * Etymology section exists.
 *
 * @param wikitext - The raw wikitext string.
 * @param sections - The parsed sections array from the API response.
 * @param summary - The cleaned plaintext summary for sentence-level fallback.
 * @returns The cleaned etymology text, or an empty string.
 */
function extractEtymology(
    wikitext: string,
    sections: Array<{ line?: string; level?: string }>,
    summary: string,
): string
{
    const etymologySection = sections.find(
        (section) => section.line && section.line.toLowerCase().includes("etymolog"),
    );

    if (etymologySection)
    {
        const level = etymologySection.level;
        const headerPattern = new RegExp(
            `={${level}}\\s*${escapeRegex(etymologySection.line ?? "")}\\s*={${level}}`,
        );
        const headerMatch = wikitext.match(headerPattern);

        if (headerMatch?.index)
        {
            const startPosition = headerMatch.index + headerMatch[0].length;
            const nextHeader = wikitext.slice(startPosition).match(/\n={1,4}[^=]/);
            const endPosition = nextHeader?.index
                ? startPosition + nextHeader.index
                : wikitext.length;
            const sectionText = wikitext.slice(startPosition, endPosition).trim();
            const cleaned = cleanWikitext(sectionText).slice(0, 500);

            if (cleaned)
            {
                return cleaned;
            }
        }
    }

    const introEtymology = extractIntroEtymology(wikitext, summary);

    if (introEtymology)
    {
        return introEtymology;
    }

    return "";
}

/**
 * Extracts etymology from the intro parenthetical in wikitext or from
 * a "means" sentence in the plaintext summary. Handles patterns like:
 *   (meaning "Lake Nyasa lizard")
 *   ("dawn lizard", {{IPAc-en|...}})
 *   ({{IPAc-en|...}}; meaning "thick-headed lizard", from Greek ...)
 *   The name "X" means "different lizard"
 *
 * @param wikitext - The raw wikitext string.
 * @param summary - The cleaned plaintext summary.
 * @returns The extracted etymology, or an empty string.
 */
function extractIntroEtymology(wikitext: string, summary: string): string
{
    const firstLine = getFirstBodyLine(wikitext);

    if (firstLine)
    {
        const parenMatch = firstLine.match(/'{2,5}[^']+'{2,5}\s*\(([^)]*(?:\{\{[^}]*\}\}[^)]*)*)\)/);

        if (parenMatch)
        {
            const parenContent = parenMatch[1];

            const meaningMatch = parenContent.match(/meaning\s+[""\u201c]([^""\u201d]+)[""\u201d]/i);

            if (meaningMatch)
            {
                return cleanWikitext(meaningMatch[1]);
            }

            const quotedMatch = parenContent.match(/^[""\u201c]([^""\u201d]+)[""\u201d]/);

            if (quotedMatch)
            {
                return cleanWikitext(quotedMatch[1]);
            }

            const afterSemicolon = parenContent.replace(/\{\{[^}]*\}\}/g, "").replace(/<[^>]*>/g, "");
            const semiMeaningMatch = afterSemicolon.match(/;\s*meaning\s+[""\u201c]([^""\u201d]+)[""\u201d]/i);

            if (semiMeaningMatch)
            {
                return cleanWikitext(semiMeaningMatch[1]);
            }
        }
    }

    const meansMatch = summary.match(
        /(?:the (?:generic )?name|the genus name)[^.]*?means?\s+[""\u201c]([^""\u201d]+)[""\u201d]/i,
    );

    if (meansMatch)
    {
        return meansMatch[1];
    }

    return "";
}

/**
 * Finds the first body-text line of wikitext, skipping templates,
 * tables, and other non-paragraph content.
 *
 * @param wikitext - The raw wikitext string.
 * @returns The first body line, or an empty string.
 */
function getFirstBodyLine(wikitext: string): string
{
    const lines = wikitext.split("\n");
    let inTemplate = 0;

    for (const line of lines)
    {
        const trimmed = line.trim();

        if (trimmed.startsWith("{{"))
        {
            inTemplate++;
        }

        if (inTemplate > 0)
        {
            if (trimmed.includes("}}"))
            {
                inTemplate--;
            }

            continue;
        }

        if (trimmed.startsWith("|") || trimmed.startsWith("{") || trimmed.startsWith("}") ||
            trimmed.startsWith("=") || trimmed.startsWith("[[File:") ||
            trimmed.startsWith("[[Image:") || trimmed === "")
        {
            continue;
        }

        if (trimmed.startsWith("'") || /^[A-Z]/.test(trimmed))
        {
            return trimmed;
        }
    }

    return "";
}

/**
 * Extracts an informal phonetic respelling (e.g. "yoo-NAN-oh-SOR-əs")
 * from the first parenthetical after the genus name in a plain-text
 * summary.
 *
 * @param summary - The plain-text summary from the Wikipedia extract API.
 * @param name - The genus name.
 * @returns The respelling string, or an empty string.
 */
function extractRespelling(summary: string, name: string): string
{
    const pattern = new RegExp(
        "^" + escapeRegex(name) + "\\s*\\(\\s*([^)]+)\\)",
    );
    const match = summary.match(pattern);

    if (!match)
    {
        return "";
    }

    let parenthetical = match[1].trim();

    if (parenthetical.includes(";"))
    {
        parenthetical = parenthetical.split(";").pop()?.trim() ?? "";
    }

    parenthetical = parenthetical.replace(/^[""]|[""]$/g, "").trim();

    const looksLikeRespelling = /[a-z]+-[A-Z]+/.test(parenthetical)
        || /[ə]/.test(parenthetical);

    return looksLikeRespelling ? parenthetical : "";
}

/**
 * Strips any parenthetical that immediately follows the genus name at
 * the start of a description string.
 *
 * @param description - The raw description text.
 * @param name - The genus name.
 * @returns The description with the leading parenthetical removed.
 */
function stripLeadingParenthetical(description: string, name: string): string
{
    const pattern = new RegExp(
        "^(" + escapeRegex(name) + ")\\s*\\([^)]*\\)\\s*",
    );

    return description.replace(pattern, "$1 ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Extracts an IPA transcription from a {{IPAc-en|...}} template in
 * wikitext. Used as a fallback when HTML-based extraction fails.
 *
 * @param wikitext - The raw wikitext string.
 * @returns The IPA string with slashes, or an empty string.
 */
function extractWikitextIpa(wikitext: string): string
{
    const firstLine = getFirstBodyLine(wikitext);

    if (!firstLine)
    {
        return "";
    }

    const ipacMatch = firstLine.match(/\{\{IPAc-en\|([^}]+)\}\}/i);

    if (ipacMatch)
    {
        const parts = ipacMatch[1].split("|").filter(
            (part) => !part.includes("=") && part.trim() !== "",
        );

        if (parts.length > 0)
        {
            return "/" + parts.join("") + "/";
        }
    }

    const ipaMatch = firstLine.match(/\{\{IPA-en\|([^|}]+)/i);

    if (ipaMatch)
    {
        return ipaMatch[1].trim();
    }

    const genericIpaMatch = firstLine.match(/\{\{IPA\|([^|}]+)/i);

    if (genericIpaMatch)
    {
        return genericIpaMatch[1].trim();
    }

    return "";
}

/**
 * Extracts holotype specimen ID and institution from the full wikitext
 * body. Searches for the word "holotype" and extracts a nearby specimen
 * code matching common museum catalogue patterns.
 *
 * @param wikitext - The full raw wikitext string.
 * @returns An object with specimenId and institution, both optional.
 */
function extractHolotype(wikitext: string): { specimenId?: string; institution?: string }
{
    const cleaned = wikitext
        .replace(/<ref[^>]*\/>/gi, "")
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1");

    const specimenPattern = /\b([A-Z]{2,}(?:[-\s][A-Za-z]{1,4})*[-\s]?[A-Z]?\d[\w./\u2013-]*)/g;

    const holotypeRegion = cleaned.match(/holotype[^.]{0,200}/i);
    const reverseRegion = cleaned.match(/.{0,200}holotype/i);

    for (const region of [holotypeRegion?.[0], reverseRegion?.[0]])
    {
        if (!region)
        {
            continue;
        }

        let specimenMatch;

        while ((specimenMatch = specimenPattern.exec(region)) !== null)
        {
            const candidate = specimenMatch[1].trim();

            if (candidate.length < 4)
            {
                continue;
            }

            if (/^\d/.test(candidate))
            {
                continue;
            }

            if (/^[A-Z][a-z]/.test(candidate))
            {
                continue;
            }

            return {
                specimenId: candidate,
                institution: resolveMuseumAbbreviation(candidate),
            };
        }

        specimenPattern.lastIndex = 0;
    }

    return {};
}

/**
 * Attempts to resolve a museum institution name from a specimen ID
 * prefix (e.g., "AMNH 5027" resolves to "American Museum of Natural
 * History").
 *
 * @param specimenId - The specimen catalogue number.
 * @returns The full institution name, or undefined if not recognized.
 */
function resolveMuseumAbbreviation(specimenId: string): string | undefined
{
    const prefix = specimenId.match(/^([A-Z]{2,}(?:[-\s][A-Za-z]{1,4})?)/);

    if (!prefix)
    {
        return undefined;
    }

    const abbreviation = prefix[1].replace(/[-\s]+/g, "").toUpperCase();

    if (museumNames[abbreviation])
    {
        return museumNames[abbreviation];
    }

    const withHyphen = prefix[1].split(/[-\s]+/)[0];

    return museumNames[withHyphen] ?? undefined;
}

/**
 * Extracts an IPA pronunciation transcription from rendered Wikipedia HTML.
 *
 * @param html - The rendered HTML string.
 * @returns The IPA string, or an empty string.
 */
function extractIpa(html: string): string
{
    const englishIpaMatch = html.match(
        /class="IPA[^"]*"[^>]*lang="en-fonipa"[^>]*>([^]*?)<\/a>/i,
    );

    if (englishIpaMatch)
    {
        return englishIpaMatch[1]
            .replace(/<[^>]+>/g, "")
            .replace(/&[^;]+;/g, "")
            .trim();
    }

    const genericIpaMatch = html.match(
        /class="IPA[^"]*"[^>]*>([^]*?)<\/(?:a|span)>/i,
    );

    if (genericIpaMatch)
    {
        return genericIpaMatch[1]
            .replace(/<[^>]+>/g, "")
            .replace(/&[^;]+;/g, "")
            .trim();
    }

    return "";
}

/**
 * Escapes special regex characters in a string.
 *
 * @param text - The string to escape.
 * @returns The escaped string safe for use in a RegExp.
 */
function escapeRegex(text: string): string
{
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Removes wiki markup from text, leaving plain readable content.
 *
 * @param text - The wikitext string to clean.
 * @returns The cleaned plain text.
 */
function cleanWikitext(text: string): string
{
    return text
        .replace(/<ref[^>]*\/>/gi, "")
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/'{2,3}/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Searches Wikidata for an entity matching the given name.
 *
 * @param name - The search term.
 * @returns The QID string, or null.
 */
async function searchWikidata(name: string): Promise<string | null>
{
    const params = new URLSearchParams({
        action: "wbsearchentities",
        search: name,
        language: "en",
        type: "item",
        limit: "1",
        format: "json",
        origin: "*",
    });

    const data = await fetchJson(`${wikidataApiBase}/w/api.php?${params}`) as {
        search?: Array<{ id?: string }>;
    } | null;

    return data?.search?.[0]?.id ?? null;
}

/**
 * Fetches a Wikidata entity by QID and extracts relevant properties.
 *
 * @param qid - The Wikidata entity QID.
 * @returns An object with extracted properties, or null.
 */
async function fetchWikidataEntity(qid: string): Promise<WikidataData | null>
{
    const data = await fetchJson(`${wikidataApiBase}/entity/${qid}.json?origin=*`) as {
        entities?: Record<string, {
            claims?: Record<string, Array<{
                mainsnak?: {
                    snaktype?: string;
                    datavalue?: {
                        type?: string;
                        value?: Record<string, unknown>;
                    };
                };
            }>>;
        }>;
    } | null;

    const entity = data?.entities?.[qid];

    if (!entity)
    {
        return null;
    }

    const claims = (entity.claims ?? {}) as WikidataClaims;
    const result: WikidataData = { qid };

    result.parentTaxon = await resolveClaimLabel(claims, "P171");
    result.typeSpecies = await resolveClaimLabel(claims, "P427");
    result.diet = await resolveClaimLabel(claims, "P186");
    result.mass = extractQuantity(claims, "P2067", "kg");
    result.length = extractQuantity(claims, "P2043", "m");
    result.hipHeight = extractQuantity(claims, "P2048", "m");
    result.gbifId = extractStringClaim(claims, "P846");
    result.eolId = extractStringClaim(claims, "P830");
    result.zoobankId = extractStringClaim(claims, "P1746");

    return result;
}

/**
 * Resolves the label for the first entity-valued claim of a property.
 *
 * @param claims - The entity claims object.
 * @param property - The Wikidata property ID.
 * @returns The English label string, or null.
 */
async function resolveClaimLabel(
    claims: WikidataClaims,
    property: string,
): Promise<string | null>
{
    const claimList = claims[property];

    if (!claimList?.length)
    {
        return null;
    }

    const mainsnak = claimList[0].mainsnak;

    if (!mainsnak || mainsnak.snaktype !== "value" || mainsnak.datavalue?.type !== "wikibase-entityid")
    {
        return null;
    }

    const targetQid = (mainsnak.datavalue.value as Record<string, string>).id;

    try
    {
        const data = await fetchJson(`${wikidataApiBase}/entity/${targetQid}.json?origin=*`) as {
            entities?: Record<string, { labels?: { en?: { value?: string } } }>;
        } | null;

        return data?.entities?.[targetQid]?.labels?.en?.value ?? null;
    }
    catch
    {
        return null;
    }
}

/**
 * Extracts a quantity value from a Wikidata claim and converts to
 * the target unit (kg or m).
 *
 * @param claims - The entity claims object.
 * @param property - The Wikidata property ID.
 * @param targetUnit - The target unit ("kg" or "m").
 * @returns The converted value as a string, or null.
 */
function extractQuantity(
    claims: WikidataClaims,
    property: string,
    targetUnit: string,
): string | null
{
    const claimList = claims[property];

    if (!claimList?.length)
    {
        return null;
    }

    const mainsnak = claimList[0].mainsnak;

    if (!mainsnak || mainsnak.snaktype !== "value" || !mainsnak.datavalue?.value)
    {
        return null;
    }

    const quantityValue = mainsnak.datavalue.value;
    const amount = quantityValue.amount as string | undefined;
    const unit = String(quantityValue.unit ?? "");

    if (!amount)
    {
        return null;
    }

    let value = parseFloat(amount.replace("+", ""));

    if (targetUnit === "kg")
    {
        if (unit.includes("Q11570"))
        {
            value = value * 1000;
        }
        else if (unit.includes("Q100995"))
        {
            value = value * 0.453592;
        }

        return String(Math.round(value));
    }

    if (unit.includes("Q174728"))
    {
        value = value / 100;
    }
    else if (unit.includes("Q3710"))
    {
        value = value * 0.3048;
    }

    return String(Math.round(value * 10) / 10);
}

/**
 * Extracts a plain string value from a Wikidata claim property.
 *
 * @param claims - The entity claims object.
 * @param property - The Wikidata property ID.
 * @returns The string value, or null.
 */
function extractStringClaim(
    claims: WikidataClaims,
    property: string,
): string | null
{
    const claimList = claims[property];

    if (!claimList?.length)
    {
        return null;
    }

    const mainsnak = claimList[0].mainsnak;

    if (!mainsnak || mainsnak.snaktype !== "value")
    {
        return null;
    }

    const value = mainsnak.datavalue?.value;

    return typeof value === "string" ? value : null;
}

/**
 * Parses an authority string into separate authors and year.
 *
 * @param authority - The authority string (e.g., "Osborn 1905").
 * @returns An object with authors and year properties.
 */
function parseAuthority(authority: string): { authors: string; year: string }
{
    const result = { authors: "", year: "" };

    if (!authority)
    {
        return result;
    }

    const yearMatch = authority.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);

    if (yearMatch)
    {
        result.year = yearMatch[1];
        const authorPart = authority.slice(0, yearMatch.index).replace(/[,\s]+$/, "").trim();

        if (authorPart)
        {
            result.authors = authorPart;
        }
    }
    else
    {
        result.authors = authority;
    }

    return result;
}

/**
 * Matches a diet label to a controlled vocabulary value.
 *
 * @param diet - The diet label string.
 * @returns The matching schema diet value, or null.
 */
function matchDiet(diet: string): string | null
{
    const lowerDiet = diet.toLowerCase();
    const dietValues = schema.diet ?? [];

    for (const value of dietValues)
    {
        if (lowerDiet.includes(value.toLowerCase()))
        {
            return value;
        }
    }

    const mapping: Record<string, string> = {
        carnivory: "carnivore",
        herbivory: "herbivore",
        omnivory: "omnivore",
        insectivory: "insectivore",
        piscivory: "piscivore",
    };

    return mapping[lowerDiet] ?? null;
}

/**
 * Matches a temporal range string to a known geological period.
 *
 * @param range - The temporal range text.
 * @returns The matching schema period, or null.
 */
function matchPeriod(range: string): string | null
{
    const periods = schema.periods ?? [];
    const lowerRange = range.toLowerCase();

    for (const period of periods)
    {
        if (lowerRange.includes(period.toLowerCase()))
        {
            return period;
        }
    }

    return null;
}

/**
 * Matches a temporal range string to a known geological stage.
 *
 * @param range - The temporal range text.
 * @returns The matching schema stage name, or null.
 */
function matchStage(range: string): string | null
{
    const stages = schema.stages ?? {};
    const lowerRange = range.toLowerCase();

    for (const stage of Object.keys(stages))
    {
        if (lowerRange.includes(stage.toLowerCase()))
        {
            return stage;
        }
    }

    return null;
}

/**
 * Gets the period for a given stage name from the schema.
 *
 * @param stageName - The geological stage name.
 * @returns The parent period name, or null.
 */
function getPeriodForStage(stageName: string): string | null
{
    const stages = schema.stages ?? {};
    const stageInfo = stages[stageName] as StageInfo | undefined;

    return stageInfo?.period ?? null;
}

/**
 * Infers a diet value from article summary text.
 *
 * @param text - The summary text to scan.
 * @returns A matching schema diet value, or null.
 */
function inferDiet(text: string): string | null
{
    const lowerText = text.toLowerCase();

    const patterns = [
        { keywords: ["herbivorous", "herbivore", "plant-eating", "plant eating"], diet: "herbivore" },
        { keywords: ["carnivorous", "carnivore", "predator", "predatory", "meat-eating", "meat eating"], diet: "carnivore" },
        { keywords: ["omnivorous", "omnivore"], diet: "omnivore" },
        { keywords: ["piscivorous", "piscivore", "fish-eating", "fish eating"], diet: "piscivore" },
        { keywords: ["insectivorous", "insectivore", "insect-eating", "insect eating"], diet: "insectivore" },
    ];

    for (const pattern of patterns)
    {
        for (const keyword of pattern.keywords)
        {
            if (lowerText.includes(keyword))
            {
                return pattern.diet;
            }
        }
    }

    return null;
}

/**
 * Infers a locomotion value from article summary text.
 *
 * @param text - The summary text to scan.
 * @returns A matching schema locomotion value, or null.
 */
function inferLocomotion(text: string): string | null
{
    const lowerText = text.toLowerCase();

    if (lowerText.includes("facultative") || lowerText.includes("facultatively"))
    {
        return "facultative";
    }
    else if (lowerText.includes("bipedal") || lowerText.includes("two-legged"))
    {
        return "bipedal";
    }
    else if (lowerText.includes("quadrupedal") || lowerText.includes("four-legged"))
    {
        return "quadrupedal";
    }

    return null;
}

/**
 * Infers an integument type from article summary text.
 *
 * @param text - The summary text to scan.
 * @returns A matching schema integument value, or null.
 */
function inferIntegument(text: string): string | null
{
    const lowerText = text.toLowerCase();

    const patterns = [
        { keywords: ["feathered", "feathers", "plumage", "pennaceous", "downy"], integument: "feathered" },
        { keywords: ["armored", "armoured", "osteoderms", "scutes", "bony plates", "body armor", "body armour"], integument: "armored" },
        { keywords: ["scaled", "scales"], integument: "scaled" },
    ];

    for (const pattern of patterns)
    {
        for (const keyword of pattern.keywords)
        {
            if (lowerText.includes(keyword))
            {
                return pattern.integument;
            }
        }
    }

    return null;
}

/**
 * Enriches a single genus by fetching data from PBDB, Wikipedia,
 * and Wikidata in parallel, then merging results.
 *
 * @param taxon - The PBDB taxon record.
 * @param parentChain - The clade chain from the parent walk.
 * @returns An enriched genus data object.
 */
async function enrichGenus(
    issue: IntakeIssue,
    parentChain: Array<string>,
    taxon: PbdbTaxon | null,
): Promise<EnrichedGenus>
{
    const name = issue.title;
    const parentClade = parentChain.length > 0 ? parentChain[0] : undefined;

    const enriched: EnrichedGenus = {
        name,
        issueNumber: issue.number,
        pbdbId: 0,
        parentChain,
        parentClade,
        fieldsPopulated: 0,
        fieldsTotal: 14,
    };

    if (taxon)
    {
        enriched.pbdbId = taxon.taxon_no ?? 0;

        const authority = parseAuthority(taxon.taxon_attr ?? "");

        if (authority.authors)
        {
            enriched.authors = authority.authors;
        }

        if (authority.year)
        {
            enriched.year = parseInt(authority.year, 10);
        }

        if (taxon.diet)
        {
            enriched.diet = matchDiet(taxon.diet) ?? undefined;
        }

        const intervalText = taxon.late_interval
            ? (taxon.early_interval ?? "") + " " + taxon.late_interval
            : taxon.early_interval ?? "";

        if (intervalText)
        {
            enriched.stage = matchStage(intervalText) ?? undefined;
            enriched.period = matchPeriod(intervalText) ?? undefined;
        }

        if (taxon.firstapp_max_ma)
        {
            enriched.fromMa = taxon.firstapp_max_ma;
        }

        if (taxon.lastapp_min_ma)
        {
            enriched.toMa = taxon.lastapp_min_ma;
        }
    }

    const [typeSpecies, occurrence, holotype, referenceDoi] = await Promise.allSettled([
        fetchPbdbTypeSpecies(name),
        fetchPbdbOccurrence(name),
        fetchPbdbHolotype(name),
        taxon?.reference_no ? fetchPbdbReferenceDoi(taxon.reference_no) : Promise.resolve(null),
    ]);

    if (typeSpecies.status === "fulfilled" && typeSpecies.value)
    {
        enriched.typeSpecies = typeSpecies.value;
    }

    if (occurrence.status === "fulfilled" && occurrence.value)
    {
        const occurrenceRecord = occurrence.value;
        enriched.formation = occurrenceRecord.formation ?? undefined;
        enriched.region = occurrenceRecord.state ?? undefined;
        enriched.latitude = occurrenceRecord.lat ?? undefined;
        enriched.longitude = occurrenceRecord.lng ?? undefined;

        if (occurrenceRecord.cc)
        {
            enriched.countryCode = occurrenceRecord.cc;
            const countries = schema.countries ?? {};
            enriched.country = countries[occurrenceRecord.cc] ?? undefined;
        }
    }

    if (holotype.status === "fulfilled" && holotype.value)
    {
        enriched.holotype = holotype.value;
    }

    if (referenceDoi.status === "fulfilled" && referenceDoi.value)
    {
        enriched.referenceDoi = referenceDoi.value;
    }

    const [wikitextResult, wikidataResult] = await Promise.allSettled([
        parseWikitext(name),
        searchWikidata(name).then((qid) => qid ? fetchWikidataEntity(qid) : null),
    ]);

    const wikitext = wikitextResult.status === "fulfilled" ? wikitextResult.value : null;
    const wikidata = wikidataResult.status === "fulfilled" ? wikidataResult.value : null;

    if (wikitext)
    {
        if (wikitext.etymology && !enriched.etymology)
        {
            enriched.etymology = wikitext.etymology;
        }

        if (wikitext.summary && !enriched.description)
        {
            enriched.description = wikitext.summary;
        }

        if (wikitext.ipa)
        {
            enriched.ipa = wikitext.ipa;
        }

        if (!enriched.typeSpecies && wikitext.typeSpecies)
        {
            enriched.typeSpecies = wikitext.typeSpecies;
        }

        if (!enriched.period && wikitext.temporalRange)
        {
            enriched.period = matchPeriod(wikitext.temporalRange) ?? undefined;
        }

        if (!enriched.stage && wikitext.temporalRange)
        {
            enriched.stage = matchStage(wikitext.temporalRange) ?? undefined;
        }

        if (!enriched.diet && wikitext.summary)
        {
            enriched.diet = inferDiet(wikitext.summary) ?? undefined;
        }

        if (!enriched.locomotion && wikitext.summary)
        {
            enriched.locomotion = inferLocomotion(wikitext.summary) ?? undefined;
        }

        if (!enriched.integument && wikitext.summary)
        {
            enriched.integument = inferIntegument(wikitext.summary) ?? undefined;
        }

        if (!enriched.holotype && (wikitext.holotypeSpecimenId ?? wikitext.holotypeInstitution))
        {
            enriched.holotype = {
                specimenId: wikitext.holotypeSpecimenId,
                institution: wikitext.holotypeInstitution,
            };
        }

        if (!enriched.formation && wikitext.formation)
        {
            enriched.formation = wikitext.formation;
        }

        if (!enriched.country && wikitext.country)
        {
            const countries = schema.countries ?? {};
            const lowerCountry = wikitext.country.toLowerCase();

            for (const [code, countryName] of Object.entries(countries))
            {
                if (lowerCountry.includes(countryName.toLowerCase()))
                {
                    enriched.countryCode = code;
                    enriched.country = countryName;
                    break;
                }
            }
        }
    }

    if (wikidata)
    {
        if (wikidata.qid)
        {
            enriched.wikidataQid = wikidata.qid;
        }

        if (wikidata.gbifId)
        {
            enriched.gbifId = wikidata.gbifId;
        }

        if (wikidata.eolId)
        {
            enriched.eolId = wikidata.eolId;
        }

        if (wikidata.zoobankId)
        {
            enriched.zoobankId = wikidata.zoobankId;
        }

        if (!enriched.typeSpecies && wikidata.typeSpecies)
        {
            enriched.typeSpecies = wikidata.typeSpecies;
        }

        if (!enriched.diet && wikidata.diet)
        {
            enriched.diet = matchDiet(wikidata.diet) ?? undefined;
        }

        if (wikidata.mass && !enriched.mass)
        {
            enriched.mass = wikidata.mass;
        }

        if (wikidata.length && !enriched.bodyLength)
        {
            enriched.bodyLength = wikidata.length;
        }

        if (wikidata.hipHeight && !enriched.hipHeight)
        {
            enriched.hipHeight = wikidata.hipHeight;
        }
    }

    if (enriched.stage && !enriched.period)
    {
        enriched.period = getPeriodForStage(enriched.stage) ?? undefined;
    }

    if (enriched.referenceDoi)
    {
        enriched.reference = await fetchDoiReference(enriched.referenceDoi);
    }

    const fields = [
        enriched.parentClade, enriched.authors, enriched.year, enriched.diet,
        enriched.period, enriched.country, enriched.formation, enriched.typeSpecies,
        enriched.etymology, enriched.description, enriched.holotype,
        enriched.locomotion, enriched.referenceDoi, enriched.ipa,
    ];
    enriched.fieldsPopulated = fields.filter(Boolean).length;

    return enriched;
}

/**
 * Converts an enriched genus record into a GenusData YAML object.
 *
 * @param enriched - The enriched genus data.
 * @param reference - The resolved DOI reference, if available.
 * @returns A GenusData object ready for YAML serialization.
 */
function toGenusYaml(enriched: EnrichedGenus, reference: Record<string, string> | null): GenusData
{
    const genus: GenusData = {
        genus: enriched.name,
        parent: enriched.parentClade,
    };

    if (enriched.etymology)
    {
        genus.etymology = enriched.etymology;
    }

    const respelling = enriched.description
        ? extractRespelling(enriched.description, enriched.name)
        : "";

    if (enriched.ipa || respelling)
    {
        genus.pronunciation = {};

        if (enriched.ipa)
        {
            genus.pronunciation.ipa = enriched.ipa;
        }

        if (respelling)
        {
            genus.pronunciation.phonetic = respelling;
        }
    }

    if (enriched.description)
    {
        genus.description = stripLeadingParenthetical(enriched.description, enriched.name);
    }

    if (enriched.diet)
    {
        genus.diet = enriched.diet;
    }

    if (enriched.locomotion)
    {
        genus.locomotion = enriched.locomotion;
    }

    if (enriched.integument)
    {
        genus.appearance = { integument: enriched.integument };
    }

    const identifiers = new Array<{ source: string; id: string | number }>();

    identifiers.push({ source: "pbdb", id: String(enriched.pbdbId) });

    if (enriched.wikidataQid)
    {
        identifiers.push({ source: "wikidata", id: enriched.wikidataQid });
    }

    if (enriched.gbifId)
    {
        identifiers.push({ source: "gbif", id: enriched.gbifId });
    }

    if (enriched.eolId)
    {
        identifiers.push({ source: "eol", id: enriched.eolId });
    }

    if (enriched.zoobankId)
    {
        identifiers.push({ source: "zoobank", id: enriched.zoobankId });
    }

    genus.identifiers = identifiers;

    const species: Record<string, unknown> = {};

    if (enriched.typeSpecies)
    {
        species.name = enriched.typeSpecies;
    }
    else
    {
        species.name = enriched.name + " sp.";
    }

    species.status = "valid";
    species.type_species = true;

    if (enriched.period ?? enriched.stage ?? enriched.fromMa ?? enriched.toMa)
    {
        const period: Record<string, unknown> = {};

        if (enriched.period)
        {
            period.name = [enriched.period];
        }

        if (enriched.stage)
        {
            period.stage = [enriched.stage];
        }

        if (enriched.fromMa)
        {
            period.from_ma = enriched.fromMa;
        }

        if (enriched.toMa)
        {
            period.to_ma = enriched.toMa;
        }

        species.period = period;
    }

    if (enriched.countryCode ?? enriched.region ?? enriched.formation ?? enriched.latitude)
    {
        const location: Record<string, unknown> = {};

        if (enriched.countryCode)
        {
            location.country = enriched.countryCode === "UK" ? "GB" : enriched.countryCode;
        }

        if (enriched.region)
        {
            location.region = enriched.region;
        }

        if (enriched.formation)
        {
            location.formation = enriched.formation;
        }

        if (enriched.latitude && enriched.longitude)
        {
            location.coordinates = [
                parseFloat(String(enriched.latitude)),
                parseFloat(String(enriched.longitude)),
            ];
        }

        species.location = location;
    }

    if (enriched.holotype)
    {
        const holotypeData: Record<string, string | Array<string>> = {};

        if (enriched.holotype.specimenId)
        {
            holotypeData.specimen_id = [enriched.holotype.specimenId];
            holotypeData.specimen_type = "holotype";
        }

        if (enriched.holotype.institution)
        {
            holotypeData.institution = enriched.holotype.institution;
        }

        species.holotype = holotypeData;
    }

    if (enriched.mass ?? enriched.bodyLength ?? enriched.hipHeight)
    {
        const size: Record<string, unknown> = {};

        if (enriched.bodyLength)
        {
            const value = parseFloat(enriched.bodyLength);
            size.length_m = { min: value, max: value };
        }

        if (enriched.mass)
        {
            const value = parseInt(enriched.mass, 10);
            size.weight_kg = { min: value, max: value };
        }

        if (enriched.hipHeight)
        {
            const value = parseFloat(enriched.hipHeight);
            size.hip_height_m = { min: value, max: value };
        }

        species.size = size;
    }

    if (enriched.year)
    {
        species.described = enriched.year;
    }

    if (enriched.authors)
    {
        species.authors = enriched.authors;
    }

    genus.species = [species] as GenusData["species"];

    if (reference && reference.authors && reference.year && reference.title)
    {
        const surname = (reference.authors ?? "")
            .split(",")[0].trim().toLowerCase().replace(/\s+/g, "");
        const referenceId = `${surname}${reference.year}`;

        const referenceEntry: Record<string, unknown> = { id: referenceId };

        referenceEntry.authors = reference.authors;
        referenceEntry.year = parseInt(reference.year, 10);
        referenceEntry.title = reference.title;

        if (reference.journal)
        {
            referenceEntry.journal = reference.journal;
        }

        if (reference.volume)
        {
            referenceEntry.volume = reference.volume;
        }

        if (reference.issue)
        {
            referenceEntry.issue = reference.issue;
        }

        if (reference.pages)
        {
            referenceEntry.pages = reference.pages;
        }

        if (reference.publisher)
        {
            referenceEntry.publisher = reference.publisher;
        }

        if (reference.doi)
        {
            referenceEntry.doi = reference.doi;
            referenceEntry.url = `http://dx.doi.org/${reference.doi}`;
        }

        genus.references = [referenceEntry] as GenusData["references"];

        if (species.described && genus.references?.[0]?.id)
        {
            (species as Record<string, unknown>).described_in = genus.references[0].id;
        }
    }

    return genus;
}

/**
 * Writes a genus YAML file to the staging directory.
 *
 * @param genus - The genus data to serialize.
 */
function writeGenusFile(genus: GenusData): void
{
    const name = genus.genus ?? "Unknown";
    const letter = name.charAt(0).toUpperCase();
    const dir = path.join(stagingDir, "genera", letter);

    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${name}.yml`);
    fs.writeFileSync(filePath, stringifyYaml(genus, { lineWidth: 80 }), "utf8");
}

/**
 * Writes a minimal clade YAML file to the staging directory.
 *
 * @param cladeName - The clade name.
 */
function writeCladeFile(cladeName: string): void
{
    const dir = path.join(stagingDir, "clades");

    fs.mkdirSync(dir, { recursive: true });

    const clade: CladeData = {
        clade: cladeName,
    };

    const filePath = path.join(dir, `${cladeName}.yml`);
    fs.writeFileSync(filePath, stringifyYaml(clade, { lineWidth: 80 }), "utf8");
}

/**
 * Main entry point for the batch import process.
 */
async function main(): Promise<void>
{
    const args = process.argv.slice(2);
    const limitIndex = args.indexOf("--limit");
    const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : Infinity;
    const offsetIndex = args.indexOf("--offset");
    const offset = offsetIndex >= 0 ? parseInt(args[offsetIndex + 1], 10) : 0;
    const dryRun = args.includes("--dry-run");

    console.log(`Batch import starting (limit: ${limit === Infinity ? "all" : limit}, offset: ${offset}, dry-run: ${dryRun})`);

    const existingGenera = new Set<string>();

    for (const file of findYamlFiles(path.join(root, "genera")))
    {
        const data = parseYaml<GenusData>(file);

        if (data?.genus)
        {
            existingGenera.add(data.genus.toLowerCase());
        }
    }

    console.log(`  Existing genera: ${existingGenera.size}`);

    const intakeIssues = fetchIntakeIssues();

    const skippedAlreadyExistsNames = intakeIssues
        .filter((issue) => existingGenera.has(issue.title.toLowerCase()))
        .map((issue) => issue.title);

    const filtered = intakeIssues.filter(
        (issue) => !existingGenera.has(issue.title.toLowerCase()),
    );

    const skippedAlreadyExists = skippedAlreadyExistsNames.length;

    console.log(`  After excluding existing: ${filtered.length}`);

    const toProcess = filtered.slice(offset, offset + limit);

    console.log(`  Will process: ${toProcess.length} genera`);

    const report: Report = {
        timestamp: new Date().toISOString(),
        totalIntakeIssues: intakeIssues.length,
        skippedAlreadyExists,
        skippedAlreadyExistsNames,
        skippedNoParent: 0,
        skippedNoParentNames: new Array<string>(),
        generaProcessed: 0,
        newCladesAdded: new Array<string>(),
        genera: new Array<Report["genera"][0]>(),
    };

    if (!dryRun)
    {
        fs.mkdirSync(stagingDir, { recursive: true });
    }

    console.log("\nFetching PBDB parent data and walking parent chains...");

    const parentChains = new Map<string, Array<string>>();
    const pbdbTaxonCache = new Map<string, PbdbTaxon | null>();
    const allNewClades = new Array<string>();

    for (let index = 0; index < toProcess.length; index += batchSize)
    {
        const batch = toProcess.slice(index, index + batchSize);

        const results = await Promise.all(
            batch.map(async (issue) =>
            {
                const taxon = await fetchPbdbTaxon(issue.title);
                pbdbTaxonCache.set(issue.title, taxon);
                const parentNo = taxon?.parent_no ?? 0;
                const chain = parentNo ? await walkParentChain(parentNo) : new Array<string>();
                return { name: issue.title, chain };
            }),
        );

        for (const result of results)
        {
            parentChains.set(result.name, result.chain);

            if (!dryRun)
            {
                const newClades = insertChainIntoTree(tree, result.chain);
                allNewClades.push(...newClades);
            }
        }

        if (index + batchSize < toProcess.length)
        {
            await sleep(500);
        }
    }

    const uniqueNewClades = [...new Set(allNewClades)];

    console.log(`  New clades discovered: ${uniqueNewClades.length}`);

    if (!dryRun && uniqueNewClades.length > 0)
    {
        for (const cladeName of uniqueNewClades)
        {
            writeCladeFile(cladeName);
        }

        const treeFilePath = path.join(stagingDir, "tree.yml");
        fs.writeFileSync(treeFilePath, stringifyYaml(tree, { lineWidth: 120 }), "utf8");
    }

    report.newCladesAdded = uniqueNewClades;

    console.log("\nEnriching genera...");

    let skippedNoParent = 0;
    const skippedNoParentNames = new Array<string>();

    for (let index = 0; index < toProcess.length; index += batchSize)
    {
        const batch = toProcess.slice(index, index + batchSize);
        const batchNumber = Math.floor(index / batchSize) + 1;
        const totalBatches = Math.ceil(toProcess.length / batchSize);

        console.log(`  Batch ${batchNumber}/${totalBatches}: ${batch.map((issue) => issue.title).join(", ")}`);

        const results = await Promise.all(
            batch.map(async (issue) =>
            {
                const chain = parentChains.get(issue.title) ?? new Array<string>();
                const cachedTaxon = pbdbTaxonCache.get(issue.title) ?? null;
                return enrichGenus(issue, chain, cachedTaxon);
            }),
        );

        for (const enriched of results)
        {
            if (!enriched.parentClade)
            {
                skippedNoParent++;
                skippedNoParentNames.push(enriched.name);
                continue;
            }

            const gaps = new Array<string>();

            if (!enriched.etymology)
            {
                gaps.push("etymology");
            }

            if (!enriched.description)
            {
                gaps.push("description");
            }

            if (!enriched.ipa)
            {
                gaps.push("pronunciation");
            }

            if (!enriched.diet)
            {
                gaps.push("diet");
            }

            if (!enriched.locomotion)
            {
                gaps.push("locomotion");
            }

            if (!enriched.holotype)
            {
                gaps.push("holotype");
            }

            if (!enriched.mass && !enriched.bodyLength)
            {
                gaps.push("size");
            }

            report.genera.push({
                name: enriched.name,
                issueNumber: enriched.issueNumber,
                fieldsPopulated: enriched.fieldsPopulated,
                fieldsTotal: enriched.fieldsTotal,
                gaps,
            });

            if (!dryRun)
            {
                const genusYaml = toGenusYaml(enriched, enriched.reference ?? null);
                writeGenusFile(genusYaml);
            }

            report.generaProcessed++;
        }

        if (index + batchSize < toProcess.length)
        {
            await sleep(batchDelayMs);
        }
    }

    report.skippedNoParent = skippedNoParent;
    report.skippedNoParentNames = skippedNoParentNames;

    if (!dryRun)
    {
        const reportPath = path.join(stagingDir, "report.json");
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

        const closeDirectives = report.genera
            .map((genus) => `Closes #${genus.issueNumber}`)
            .join("\n");

        const prBody = [
            "## Summary",
            "",
            `Batch import of ${report.generaProcessed} genera from PBDB, Wikipedia, and Wikidata.`,
            `New clades added: ${report.newCladesAdded.length}`,
            "",
            "## Resolved issues",
            "",
            closeDirectives,
        ].join("\n");

        const prBodyPath = path.join(stagingDir, "pr-body.md");
        fs.writeFileSync(prBodyPath, prBody, "utf8");
    }

    console.log("\n=== Import Summary ===");
    console.log(`Total Intake issues: ${report.totalIntakeIssues}`);
    console.log(`Skipped (already exists): ${report.skippedAlreadyExists}`);

    if (report.skippedAlreadyExistsNames.length > 0)
    {
        console.log(`  → ${report.skippedAlreadyExistsNames.join(", ")}`);
    }

    console.log(`Skipped (no parent clade): ${report.skippedNoParent}`);

    if (report.skippedNoParentNames.length > 0)
    {
        console.log(`  → ${report.skippedNoParentNames.join(", ")}`);
    }

    console.log(`Genera processed: ${report.generaProcessed}`);
    console.log(`New clades added: ${report.newCladesAdded.length}`);

    if (report.genera.length > 0)
    {
        const averageFields = report.genera.reduce(
            (sum, genus) => sum + genus.fieldsPopulated, 0,
        ) / report.genera.length;
        console.log(`Average fields populated: ${averageFields.toFixed(1)}/${report.genera[0].fieldsTotal}`);
    }

    if (dryRun)
    {
        console.log("\n(Dry run — no files written)");
    }
    else
    {
        console.log(`\nOutput written to: ${stagingDir}/`);
    }
}

main().catch((error) =>
{
    console.error("Fatal error:", error);
    process.exit(1);
});
