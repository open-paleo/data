/**
 * Audits citation keys across the genera/ corpus and the local paper
 * archive at $PAPERS_DIR (default ~/Desktop/open-paleo-papers/markdown)
 * to surface three classes of bibliographic issue:
 *
 *   1. True key collisions — two or more genus YAMLs cite the same
 *      citation key but their inline `references[]` metadata clearly
 *      describe different papers (different titles or journals). The
 *      conventional fix is to suffix the keys (`xu2018a`, `xu2018b`).
 *
 *   2. Misfiled corpus content — a single YAML cites a key, the paper
 *      is present, but the paper body does not describe the cited
 *      genus (often: same key was reused across two distinct same-
 *      author/year papers, and the corpus stored the wrong one).
 *
 *   3. Paper / YAML mismatch in multi-citer cases — multiple YAMLs
 *      cite a key and the paper is present, but the paper only
 *      describes some of them. Distinguishes legitimate multi-taxon
 *      papers (paper covers all citers) from collisions disguised as
 *      multi-citers.
 *
 * The audit also reports legitimate multi-taxon papers (a paper that
 * describes >1 new genus is normal in paleontology) so they can be
 * filtered out from "needs work" review lists.
 *
 * Output:
 *   - reports/citation-key-audit.json with one entry per citation key
 *     plus per-bucket summary counts.
 *
 * Modes:
 *   (default)   Audit only.
 *   --key K     Process only the named citation key.
 *
 * Environment:
 *   PAPERS_DIR  Override the markdown corpus directory.
 *
 * Usage:
 *   node --experimental-strip-types scripts/audit-citation-keys.ts [options]
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";

import type { GenusData, Reference } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const reportPath = path.join(root, "reports", "citation-key-audit.json");

const defaultPapersDir = path.join(os.homedir(), "Desktop", "open-paleo-papers", "markdown");
const papersDir = process.env.PAPERS_DIR ?? defaultPapersDir;

const introCharLimit = 800;
const describesMentionThreshold = 3;
const titleSimilarityCollisionThreshold = 0.5;

/**
 * One citation of a key from a single genus YAML.
 */
type Citation = {
    /**
     * The citing genus (its top-level `genus:` value).
     */
    genus: string;

    /**
     * Repository-relative path to the YAML.
     */
    file: string;

    /**
     * Where this citation lives — the type species' `described_in`, or
     * a plain entry in `references[]`.
     */
    source: "described_in" | "reference";

    /**
     * The corresponding `references[]` entry from this YAML, if any.
     * Used for cross-YAML metadata comparison.
     */
    reference?: Reference;
};

/**
 * Per-genus result of "is this genus described in this paper?".
 */
type GenusPaperFit = {
    /**
     * The citing genus.
     */
    genus: string;

    /**
     * Whole-word case-insensitive count of the genus in the paper.
     */
    mentionCount: number;

    /**
     * True when the genus appears in any markdown header line.
     */
    inHeading: boolean;

    /**
     * True when the genus appears in the first `introCharLimit` chars.
     */
    inIntro: boolean;

    /**
     * True when the YAML's reference entry for this paper has the genus
     * in its `title` field (very strong "describes" signal).
     */
    inReferenceTitle: boolean;

    /**
     * Aggregate flag — true when this paper appears to describe (not
     * merely mention) the genus.
     */
    describes: boolean;
};

/**
 * Audit-bucket assigned to each citation key.
 */
type Bucket =
    | "clean"
    | "clean-no-paper"
    | "clean-multi-taxon"
    | "collision-divergent-refs"
    | "collision-paper-mismatch"
    | "misfile-suspected"
    | "inconsistent-refs-no-paper"
    | "no-paper-multi";

/**
 * One row in the audit report.
 */
type AuditEntry = {
    /**
     * The citation key.
     */
    key: string;

    /**
     * Outcome bucket.
     */
    bucket: Bucket;

    /**
     * True when the corresponding markdown was found in the corpus.
     */
    paperPresent: boolean;

    /**
     * Genera citing this key, with `described_in` precedence.
     */
    citations: Array<Citation>;

    /**
     * Per-genus paper-fit assessment (only present when paper found).
     */
    genusFit?: Array<GenusPaperFit>;

    /**
     * Distinct title forms found in `references[]` entries citing this
     * key. When length > 1 the references are inconsistent.
     */
    distinctTitles?: Array<string>;

    /**
     * Distinct journal/book values found across citing YAMLs.
     */
    distinctJournals?: Array<string>;

    /**
     * Distinct year values found across citing YAMLs.
     */
    distinctYears?: Array<number>;
};

/**
 * Parsed CLI options.
 */
type CliOptions = {
    /**
     * When set, restrict the audit to a single citation key.
     */
    key?: string;
};

/**
 * Parses CLI arguments.
 *
 * @returns Parsed options.
 */
function parseArgs(): CliOptions
{
    const args = process.argv.slice(2);
    const options: CliOptions = {};

    for (let index = 0; index < args.length; index += 1)
    {
        const argument = args[index];

        if (argument === "--key" && args[index + 1])
        {
            options.key = args[index + 1];
            index += 1;
        }
        else
        {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }

    return options;
}

/**
 * Strips diacritics and lowercases a string for tolerant text matching.
 *
 * @param value - The input string.
 * @returns Normalized lowercase form.
 */
function normalizeText(value: string): string
{
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
}

/**
 * Stop words that contribute no signal to title-similarity comparison.
 */
const titleStopWords = new Set([
    "the", "and", "from", "with", "for", "of", "in", "on", "a", "an",
    "to", "new", "their", "its", "is", "are", "was", "this", "that",
    "by", "at", "as", "or", "but",
]);

/**
 * Tokenizes a paper title into a Set of significant lowercase words.
 *
 * @param title - The title string.
 * @returns Set of significant tokens.
 */
function titleTokens(title: string): Set<string>
{
    const cleaned = normalizeText(title)
        .replace(/<[^>]+>/g, "")
        .replace(/[^a-z\s]/g, " ");
    const tokens = cleaned
        .split(/\s+/)
        .filter((token) => token.length > 3 && !titleStopWords.has(token));

    return new Set(tokens);
}

/**
 * Computes Jaccard similarity between two title strings.
 *
 * @param a - First title.
 * @param b - Second title.
 * @returns Jaccard similarity in [0, 1].
 */
function titleSimilarity(a: string, b: string): number
{
    const setA = titleTokens(a);
    const setB = titleTokens(b);

    if (setA.size === 0 || setB.size === 0)
    {
        return 0;
    }

    let intersection = 0;

    for (const token of setA)
    {
        if (setB.has(token))
        {
            intersection += 1;
        }
    }

    return intersection / (setA.size + setB.size - intersection);
}

/**
 * Walks every genus YAML and builds an index from citation key to the
 * list of YAMLs that reference it (via `species.described_in` or any
 * `references[]` entry).
 *
 * @returns A map from citation key to its citations.
 */
function buildCitationIndex(): Map<string, Array<Citation>>
{
    const index = new Map<string, Array<Citation>>();

    for (const filePath of findYamlFiles(generaDir))
    {
        let data: GenusData;

        try
        {
            data = parseYaml<GenusData>(filePath);
        }
        catch
        {
            continue;
        }

        const genusName = data?.genus ?? path.basename(filePath, path.extname(filePath));
        const relativeFile = path.relative(root, filePath);
        const referencesByKey = new Map<string, Reference>();

        for (const reference of data?.references ?? [])
        {
            if (reference?.id)
            {
                referencesByKey.set(reference.id, reference);
            }
        }

        const describedInKeys = new Set<string>();

        for (const species of data?.species ?? [])
        {
            if (species?.described_in)
            {
                describedInKeys.add(species.described_in);
            }
        }

        for (const key of describedInKeys)
        {
            if (!index.has(key))
            {
                index.set(key, new Array<Citation>());
            }

            index.get(key)!.push({
                genus: genusName,
                file: relativeFile,
                source: "described_in",
                reference: referencesByKey.get(key),
            });
        }

        for (const [key, reference] of referencesByKey)
        {
            if (describedInKeys.has(key))
            {
                continue;
            }

            if (!index.has(key))
            {
                index.set(key, new Array<Citation>());
            }

            index.get(key)!.push({
                genus: genusName,
                file: relativeFile,
                source: "reference",
                reference,
            });
        }
    }

    return index;
}

/**
 * Counts whole-word case-insensitive occurrences of a needle within a
 * haystack, after diacritic normalization.
 *
 * @param haystack - The body text.
 * @param needle - The word to count.
 * @returns Number of matches.
 */
function countWholeWordMatches(haystack: string, needle: string): number
{
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "g");

    return (haystack.match(pattern) ?? []).length;
}

/**
 * Scores how strongly a paper appears to describe a given genus.
 *
 * @param genus - The genus to test.
 * @param markdown - Full paper body.
 * @param referenceTitles - Titles of `references[]` entries citing this
 *                         key, used as an additional "describes" signal.
 * @returns The fit assessment.
 */
function assessGenusFit(
    genus: string,
    markdown: string,
    referenceTitles: Array<string>,
): GenusPaperFit
{
    const normalizedBody = normalizeText(markdown);
    const normalizedGenus = normalizeText(genus);
    const mentionCount = countWholeWordMatches(normalizedBody, normalizedGenus);
    const intro = normalizedBody.slice(0, introCharLimit);
    const inIntro = countWholeWordMatches(intro, normalizedGenus) > 0;
    const headingPattern = new RegExp(
        `^#{1,6}[^\\n]*\\b${normalizedGenus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "mi",
    );
    const inHeading = headingPattern.test(normalizedBody);
    const inReferenceTitle = referenceTitles.some(
        (title) => countWholeWordMatches(normalizeText(title), normalizedGenus) > 0,
    );
    const describes = mentionCount >= describesMentionThreshold
        || inHeading
        || inIntro
        || inReferenceTitle;

    return {
        genus,
        mentionCount,
        inHeading,
        inIntro,
        inReferenceTitle,
        describes,
    };
}

/**
 * Returns the distinct, normalized title strings found across an array
 * of references, preserving the original casing of the first occurrence.
 *
 * @param references - References from multiple YAMLs.
 * @returns Distinct titles by similarity.
 */
function distinctTitles(references: Array<Reference | undefined>): Array<string>
{
    const groups = new Array<string>();

    for (const reference of references)
    {
        const title = reference?.title?.trim();

        if (!title)
        {
            continue;
        }

        const isMatch = groups.some(
            (existing) => titleSimilarity(existing, title) >= titleSimilarityCollisionThreshold,
        );

        if (!isMatch)
        {
            groups.push(title);
        }
    }

    return groups;
}

/**
 * Returns the distinct values of a string-valued reference field across
 * an array of references, lowercased and trimmed for comparison but
 * preserving original-cased first-seen forms.
 *
 * @param references - References from multiple YAMLs.
 * @param field - The field name to extract.
 * @returns Distinct values.
 */
function distinctStringField(
    references: Array<Reference | undefined>,
    field: "journal" | "book",
): Array<string>
{
    const seen = new Map<string, string>();

    for (const reference of references)
    {
        const raw = reference?.[field];

        if (typeof raw !== "string")
        {
            continue;
        }

        const trimmed = raw.trim();

        if (!trimmed)
        {
            continue;
        }

        const normalized = trimmed.toLowerCase();

        if (!seen.has(normalized))
        {
            seen.set(normalized, trimmed);
        }
    }

    return [...seen.values()];
}

/**
 * Returns the distinct year values across an array of references.
 *
 * @param references - References from multiple YAMLs.
 * @returns Distinct years.
 */
function distinctYears(references: Array<Reference | undefined>): Array<number>
{
    const years = new Set<number>();

    for (const reference of references)
    {
        if (typeof reference?.year === "number")
        {
            years.add(reference.year);
        }
    }

    return [...years].sort();
}

/**
 * Buckets a citation key based on collected evidence.
 *
 * @param paperPresent - Whether a markdown body was found.
 * @param citationCount - How many YAMLs cite this key.
 * @param genusFit - Per-citing-genus paper-fit assessments.
 * @param titles - Distinct title forms across citing YAMLs.
 * @returns The chosen bucket.
 */
function classify(
    paperPresent: boolean,
    citationCount: number,
    genusFit: Array<GenusPaperFit> | undefined,
    titles: Array<string>,
): Bucket
{
    const single = citationCount === 1;

    if (titles.length > 1 && paperPresent)
    {
        return "collision-divergent-refs";
    }

    if (titles.length > 1 && !paperPresent)
    {
        return "inconsistent-refs-no-paper";
    }

    if (single && !paperPresent)
    {
        return "clean-no-paper";
    }

    if (!single && !paperPresent)
    {
        return "no-paper-multi";
    }

    if (genusFit)
    {
        const describesAny = genusFit.some((fit) => fit.describes);
        const describesAll = genusFit.every((fit) => fit.describes);

        if (single && !describesAny)
        {
            return "misfile-suspected";
        }

        if (!single && describesAll)
        {
            return "clean-multi-taxon";
        }

        if (!single && !describesAll)
        {
            return "collision-paper-mismatch";
        }
    }

    return "clean";
}

/**
 * Audits one citation key: reads its paper if present, scores each
 * citing genus, compares reference metadata, and chooses a bucket.
 *
 * @param key - The citation key.
 * @param citations - All YAMLs citing this key.
 * @returns The audit entry.
 */
function auditKey(key: string, citations: Array<Citation>): AuditEntry
{
    const markdownPath = path.join(papersDir, `${key}.md`);
    const paperPresent = fs.existsSync(markdownPath);
    const references = citations.map((citation) => citation.reference);
    const titles = distinctTitles(references);
    const journals = distinctStringField(references, "journal");
    const books = distinctStringField(references, "book");
    const years = distinctYears(references);
    let genusFit: Array<GenusPaperFit> | undefined;

    if (paperPresent)
    {
        const markdown = fs.readFileSync(markdownPath, "utf8");
        const uniqueGenera = [...new Set(citations.map((citation) => citation.genus))];
        const titlesByGenus = new Map<string, Array<string>>();

        for (const citation of citations)
        {
            const title = citation.reference?.title?.trim();

            if (title)
            {
                const existing = titlesByGenus.get(citation.genus) ?? new Array<string>();

                existing.push(title);
                titlesByGenus.set(citation.genus, existing);
            }
        }

        genusFit = uniqueGenera.map(
            (genus) => assessGenusFit(genus, markdown, titlesByGenus.get(genus) ?? []),
        );
    }

    const bucket = classify(paperPresent, citations.length, genusFit, titles);
    const entry: AuditEntry = {
        key,
        bucket,
        paperPresent,
        citations,
    };

    if (genusFit)
    {
        entry.genusFit = genusFit;
    }

    if (titles.length > 1)
    {
        entry.distinctTitles = titles;
    }

    if (journals.length > 1 || books.length > 1)
    {
        entry.distinctJournals = [...journals, ...books];
    }

    if (years.length > 1)
    {
        entry.distinctYears = years;
    }

    return entry;
}

/**
 * Counts entries per bucket.
 *
 * @param entries - Audit entries.
 * @returns A count keyed by bucket name.
 */
function summarize(entries: Array<AuditEntry>): Record<Bucket, number>
{
    const summary: Record<Bucket, number> = {
        "clean": 0,
        "clean-no-paper": 0,
        "clean-multi-taxon": 0,
        "collision-divergent-refs": 0,
        "collision-paper-mismatch": 0,
        "misfile-suspected": 0,
        "inconsistent-refs-no-paper": 0,
        "no-paper-multi": 0,
    };

    for (const entry of entries)
    {
        summary[entry.bucket] += 1;
    }

    return summary;
}

/**
 * Entry point.
 */
function main(): void
{
    const options = parseArgs();
    const index = buildCitationIndex();
    const entries = new Array<AuditEntry>();

    for (const [key, citations] of [...index.entries()].sort((a, b) => a[0].localeCompare(b[0])))
    {
        if (options.key && key !== options.key)
        {
            continue;
        }

        entries.push(auditKey(key, citations));
    }

    const summary = summarize(entries);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(
        {
            mode: "audit",
            papersDir,
            summary,
            entries,
        },
        null,
        2,
    ), "utf8");

    console.log(`Audited ${entries.length} citation keys.`);
    console.log(`Report: ${path.relative(root, reportPath)}`);
    console.log("Summary:");

    for (const [bucket, count] of Object.entries(summary))
    {
        console.log(`  ${bucket.padEnd(28)} ${count}`);
    }
}

main();
