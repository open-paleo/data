/**
 * Builds a citation-key rename plan from the audit output, assigning
 * chronological lowercase letter suffixes to colliding keys per the
 * BibTeX/biblatex convention.
 *
 * Inputs:
 *   - reports/citation-key-audit.json (produced by audit-citation-keys.ts)
 *
 * Outputs:
 *   - reports/citation-key-rename-plan.yml — human-reviewable plan with
 *     one block per old key, listing the proposed new keys, citing
 *     genera, distinguishing reference metadata (title/journal/year/doi),
 *     and a flag for whether the local paper corpus has each paper.
 *   - reports/rename-corpus.sh — companion shell script that renames
 *     markdown/pdf files in the local corpus to match the plan. Review
 *     before running; intentionally never executed by this script.
 *
 * Scope:
 *   - Includes `collision-divergent-refs` and `inconsistent-refs-no-paper`
 *     buckets (truly distinct papers sharing a key).
 *   - Excludes `misfile-suspected` and `collision-paper-mismatch` —
 *     those need human triage to decide whether the corpus markdown is
 *     wrong or whether there is in fact a hidden collision.
 *
 * Suffix assignment:
 *   - Sorted by year ascending, then by reference title alphabetic, then
 *     by first citing genus alphabetic. Yields a deterministic ordering
 *     even without month/day publication metadata. The reviewer can
 *     hand-edit the plan to put assignments in true publication order
 *     when known.
 *
 * Usage:
 *   node --experimental-strip-types scripts/build-rename-plan.ts
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";
import { stringify as stringifyYaml } from "yaml";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const auditPath = path.join(root, "reports", "citation-key-audit.json");
const planPath = path.join(root, "reports", "citation-key-rename-plan.yml");
const corpusScriptPath = path.join(root, "reports", "rename-corpus.sh");

const defaultPapersDir = path.join(os.homedir(), "Desktop", "open-paleo-papers");

const titleSimilarityClusterThreshold = 0.5;
const inScopeBuckets = new Set(["collision-divergent-refs", "inconsistent-refs-no-paper"]);

/**
 * Subset of the audit-record shape this script consumes. Keeps the
 * dependency on \`audit-citation-keys.ts\` loose; only the fields used
 * here are typed.
 */
type AuditCitation = {
    /**
     * The citing genus (top-level \`genus:\` from the YAML).
     */
    genus: string;

    /**
     * Repository-relative path to the YAML.
     */
    file: string;

    /**
     * The reference entry from the YAML for this key, when present.
     */
    reference?: {
        title?: string;
        journal?: string;
        book?: string;
        year?: number;
        doi?: string;
        url?: string;
    };
};

/**
 * Subset of the audit entry shape consumed here.
 */
type AuditEntry = {
    key: string;
    bucket: string;
    paperPresent: boolean;
    citations: Array<AuditCitation>;
    genusFit?: Array<{ genus: string; describes: boolean }>;
};

/**
 * Shape of the on-disk audit JSON.
 */
type AuditFile = {
    summary: Record<string, number>;
    entries: Array<AuditEntry>;
};

/**
 * One assignment within a rename block — represents a single distinct
 * paper getting its own suffix.
 */
type PlanAssignment = {
    /**
     * Canonical proposed key (old key + suffix letter).
     */
    new_key: string;

    /**
     * Suffix letter assigned (a, b, c, ...).
     */
    suffix: string;

    /**
     * Year from the citing YAMLs' reference entries (should agree
     * across the cluster).
     */
    year?: number;

    /**
     * Journal or book from the references in this cluster, if one is
     * consistently present.
     */
    journal?: string;

    /**
     * Representative DOI for this paper, if any reference carries it.
     */
    doi?: string;

    /**
     * Representative title — taken from the first citing reference in
     * the cluster.
     */
    title?: string;

    /**
     * Genera (from genus YAMLs) whose \`described_in\` and
     * \`references[]\` entries should be rewritten to this new key.
     */
    citing_genera: Array<string>;

    /**
     * True when the local corpus has the paper that ends up under this
     * suffix (heuristic from the audit's \`genusFit.describes\`).
     */
    paper_in_corpus: boolean;

    /**
     * When the corpus has this paper, the existing markdown filename
     * (without extension) that needs to be renamed to \`new_key\`.
     */
    corpus_markdown_basename?: string;
};

/**
 * One rename block — all proposed new keys derived from a single
 * colliding old key.
 */
type PlanBlock = {
    /**
     * The pre-rename citation key (e.g. "xu2018").
     */
    old_key: string;

    /**
     * Audit bucket that produced this block.
     */
    audit_bucket: string;

    /**
     * Whether the local corpus has any paper under the old key.
     */
    paper_present: boolean;

    /**
     * Per-paper assignments.
     */
    assignments: Array<PlanAssignment>;
};

/**
 * Top-level shape of the plan file.
 */
type PlanFile = {
    /**
     * Audit summary echoed for context.
     */
    audit_summary: Record<string, number>;

    /**
     * The rename blocks.
     */
    blocks: Array<PlanBlock>;

    /**
     * Audit-bucket entries deliberately not auto-planned. The reviewer
     * is responsible for resolving these manually.
     */
    skipped: {
        misfile_suspected: Array<{ key: string; genus: string }>;
        collision_paper_mismatch: Array<{ key: string; genera: Array<string> }>;
    };
};

/**
 * Stop words that contribute no signal to title-similarity comparison.
 */
const titleStopWords = new Set([
    "the", "and", "from", "with", "for", "of", "in", "on", "a", "an",
    "to", "new", "their", "its", "is", "are", "was", "this", "that",
    "by", "at", "as", "or", "but",
]);

/**
 * Tokenizes a title into significant lowercase words.
 *
 * @param title - The title string.
 * @returns Set of significant tokens.
 */
function titleTokens(title: string): Set<string>
{
    const cleaned = title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
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
 * Groups citations into clusters by reference-title similarity. Each
 * cluster represents a single underlying paper.
 *
 * @param citations - All citations of one old key.
 * @returns Clusters, each a list of citations citing the same paper.
 */
function clusterByPaper(citations: Array<AuditCitation>): Array<Array<AuditCitation>>
{
    const clusters = new Array<Array<AuditCitation>>();

    for (const citation of citations)
    {
        const title = citation.reference?.title?.trim() ?? "";
        const matching = clusters.find((cluster) =>
        {
            const referenceTitle = cluster[0].reference?.title?.trim() ?? "";

            return titleSimilarity(title, referenceTitle) >= titleSimilarityClusterThreshold;
        });

        if (matching)
        {
            matching.push(citation);
        }
        else
        {
            clusters.push([citation]);
        }
    }

    return clusters;
}

/**
 * Returns a representative reference for a cluster — the one whose
 * fields are most fully populated.
 *
 * @param cluster - A list of citations agreed to cite one paper.
 * @returns The chosen reference, or undefined when none have metadata.
 */
function representativeReference(
    cluster: Array<AuditCitation>,
): AuditCitation["reference"] | undefined
{
    const referencesPresent = cluster
        .map((citation) => citation.reference)
        .filter((reference): reference is NonNullable<AuditCitation["reference"]> => Boolean(reference));

    if (referencesPresent.length === 0)
    {
        return undefined;
    }

    const sortedByCompleteness = [...referencesPresent].sort((a, b) =>
    {
        const scoreA = (a.title ? 1 : 0) + (a.journal ?? a.book ? 1 : 0) + (a.doi ? 2 : 0) + (a.year ? 1 : 0);
        const scoreB = (b.title ? 1 : 0) + (b.journal ?? b.book ? 1 : 0) + (b.doi ? 2 : 0) + (b.year ? 1 : 0);

        return scoreB - scoreA;
    });

    return sortedByCompleteness[0];
}

/**
 * Builds a plan block for one audit entry.
 *
 * @param entry - The audit entry for a colliding key.
 * @param corpusMarkdownBasename - Existing markdown basename (without
 *                                 extension), or undefined when the
 *                                 paper is absent from the corpus.
 * @returns A plan block, or null when the entry has fewer than two
 *          distinct paper clusters (no actual rename needed).
 */
function buildBlock(entry: AuditEntry, corpusMarkdownBasename: string | undefined): PlanBlock | null
{
    const clusters = clusterByPaper(entry.citations);

    if (clusters.length < 2)
    {
        return null;
    }

    const describingGenera = new Set(
        (entry.genusFit ?? []).filter((fit) => fit.describes).map((fit) => fit.genus),
    );
    const sortedClusters = [...clusters].sort((a, b) =>
    {
        const referenceA = representativeReference(a);
        const referenceB = representativeReference(b);
        const yearA = referenceA?.year ?? Number.MAX_SAFE_INTEGER;
        const yearB = referenceB?.year ?? Number.MAX_SAFE_INTEGER;

        if (yearA !== yearB)
        {
            return yearA - yearB;
        }

        const titleA = (referenceA?.title ?? "").toLowerCase();
        const titleB = (referenceB?.title ?? "").toLowerCase();

        if (titleA !== titleB)
        {
            return titleA.localeCompare(titleB);
        }

        const generaA = a.map((citation) => citation.genus).sort()[0] ?? "";
        const generaB = b.map((citation) => citation.genus).sort()[0] ?? "";

        return generaA.localeCompare(generaB);
    });
    const assignments = sortedClusters.map((cluster, index): PlanAssignment =>
    {
        const suffix = String.fromCharCode("a".charCodeAt(0) + index);
        const reference = representativeReference(cluster);
        const containsCorpusMatch = cluster.some((citation) => describingGenera.has(citation.genus));
        const assignment: PlanAssignment = {
            new_key: `${entry.key}${suffix}`,
            suffix,
            citing_genera: cluster.map((citation) => citation.genus).sort(),
            paper_in_corpus: containsCorpusMatch && entry.paperPresent,
        };

        if (reference?.year !== undefined)
        {
            assignment.year = reference.year;
        }

        const journalLike = reference?.journal ?? reference?.book;

        if (journalLike)
        {
            assignment.journal = journalLike;
        }

        if (reference?.doi)
        {
            assignment.doi = reference.doi;
        }

        if (reference?.title)
        {
            assignment.title = reference.title;
        }

        if (assignment.paper_in_corpus && corpusMarkdownBasename)
        {
            assignment.corpus_markdown_basename = corpusMarkdownBasename;
        }

        return assignment;
    });

    return {
        old_key: entry.key,
        audit_bucket: entry.bucket,
        paper_present: entry.paperPresent,
        assignments,
    };
}

/**
 * Generates a shell script that renames corpus markdown / pdf files to
 * their new suffixed forms, based on the plan blocks.
 *
 * @param blocks - All plan blocks.
 * @param papersDir - Local paper-corpus directory.
 * @returns The script body.
 */
function buildCorpusScript(blocks: Array<PlanBlock>, papersDir: string): string
{
    const lines = new Array<string>();

    lines.push("#!/usr/bin/env bash");
    lines.push("# Rename corpus files to match reports/citation-key-rename-plan.yml.");
    lines.push("# Generated by scripts/build-rename-plan.ts. Review before running.");
    lines.push("# Re-run scripts/indexer.py in the corpus afterwards to refresh papers.db.");
    lines.push("set -euo pipefail");
    lines.push("");
    lines.push(`PAPERS_DIR="${papersDir}"`);
    lines.push("");
    lines.push("rename_one()");
    lines.push("{");
    lines.push("    local subdir=\"$1\"");
    lines.push("    local extension=\"$2\"");
    lines.push("    local old_key=\"$3\"");
    lines.push("    local new_key=\"$4\"");
    lines.push("    local source=\"${PAPERS_DIR}/${subdir}/${old_key}.${extension}\"");
    lines.push("    local target=\"${PAPERS_DIR}/${subdir}/${new_key}.${extension}\"");
    lines.push("    if [ -e \"${source}\" ]; then");
    lines.push("        if [ -e \"${target}\" ]; then");
    lines.push("            echo \"  skip — target exists: ${target}\"");
    lines.push("        else");
    lines.push("            echo \"  mv ${subdir}/${old_key}.${extension} -> ${new_key}.${extension}\"");
    lines.push("            mv \"${source}\" \"${target}\"");
    lines.push("        fi");
    lines.push("    fi");
    lines.push("}");
    lines.push("");

    for (const block of blocks)
    {
        const assignment = block.assignments.find((entry) => entry.paper_in_corpus);

        if (!assignment)
        {
            continue;
        }

        lines.push(`echo "${block.old_key} -> ${assignment.new_key}"`);
        lines.push(`rename_one markdown   md   "${block.old_key}" "${assignment.new_key}"`);
        lines.push(`rename_one pdfs       pdf  "${block.old_key}" "${assignment.new_key}"`);
        lines.push("# pdf_images is a directory; mv handles either file or directory");
        lines.push("if [ -d \"${PAPERS_DIR}/pdf_images/" + block.old_key + "\" ]; then");
        lines.push(`    mv "\${PAPERS_DIR}/pdf_images/${block.old_key}" "\${PAPERS_DIR}/pdf_images/${assignment.new_key}"`);
        lines.push("fi");
        lines.push("");
    }

    lines.push("echo \"Done. Now update manifest.json and rebuild the index.\"");

    return lines.join("\n");
}

/**
 * Entry point.
 */
function main(): void
{
    if (!fs.existsSync(auditPath))
    {
        throw new Error(`Audit not found at ${auditPath}. Run \`npm run audit-citation-keys\` first.`);
    }

    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8")) as AuditFile;
    const blocks = new Array<PlanBlock>();
    const skipped: PlanFile["skipped"] = {
        misfile_suspected: new Array<{ key: string; genus: string }>(),
        collision_paper_mismatch: new Array<{ key: string; genera: Array<string> }>(),
    };

    for (const entry of audit.entries)
    {
        if (entry.bucket === "misfile-suspected")
        {
            skipped.misfile_suspected.push({ key: entry.key, genus: entry.citations[0]?.genus ?? "?" });
            continue;
        }

        if (entry.bucket === "collision-paper-mismatch")
        {
            skipped.collision_paper_mismatch.push({
                key: entry.key,
                genera: entry.citations.map((citation) => citation.genus),
            });
            continue;
        }

        if (!inScopeBuckets.has(entry.bucket))
        {
            continue;
        }

        const block = buildBlock(entry, entry.paperPresent ? entry.key : undefined);

        if (block)
        {
            blocks.push(block);
        }
    }

    blocks.sort((a, b) => a.old_key.localeCompare(b.old_key));

    const planFile: PlanFile = {
        audit_summary: audit.summary,
        blocks,
        skipped,
    };

    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(planPath, stringifyYaml(planFile, { lineWidth: 0 }), "utf8");

    const corpusScript = buildCorpusScript(blocks, defaultPapersDir);

    fs.writeFileSync(corpusScriptPath, corpusScript, { mode: 0o755, encoding: "utf8" });

    const totalAssignments = blocks.reduce((sum, block) => sum + block.assignments.length, 0);

    console.log(`Wrote ${path.relative(root, planPath)}`);
    console.log(`Wrote ${path.relative(root, corpusScriptPath)} (review before running)`);
    console.log("");
    console.log(`Plan blocks: ${blocks.length} (covering ${totalAssignments} new keys)`);
    console.log("Skipped (manual review needed):");
    console.log(`  misfile-suspected:         ${skipped.misfile_suspected.length}`);
    console.log(`  collision-paper-mismatch:  ${skipped.collision_paper_mismatch.length}`);
}

main();
