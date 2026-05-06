/**
 * Batch import script for populating genus data from PBDB, Wikipedia,
 * and Wikidata. Uses GitHub Intake issues as the genus list, enriches
 * each with data from all three sources, then generates YAML files in
 * a staging directory for review.
 *
 * Per-genus enrichment helpers (PBDB/Wikipedia/Wikidata fetchers,
 * schema-shape conversion) live in `./genus-enrichment.ts` so they
 * can be shared with the per-genus intake-bootstrap pipeline.
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
import type { GenusData, CladeData, TreeNode } from "./types.ts";
import { parseYaml, findYamlFiles, collectAllKeys } from "./utilities.ts";
import {
    sleep,
    walkParentChain,
    fetchPbdbTaxon,
    enrichGenus,
    toGenusYaml,
} from "./genus-enrichment.ts";
import type { PbdbTaxon } from "./genus-enrichment.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const stagingDir = path.join(root, "staging");

const batchSize = 5;
const batchDelayMs = 1000;

type IntakeIssue = {
    number: number;
    title: string;
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

const tree = parseYaml<TreeNode>(path.join(root, "tree.yml"));
const allClades = collectAllKeys(tree);

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
                const enriched = await enrichGenus(issue.title, chain, cachedTaxon);
                enriched.issueNumber = issue.number;
                return enriched;
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
                issueNumber: enriched.issueNumber ?? 0,
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
