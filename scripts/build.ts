import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import yaml from "js-yaml";

import { collectAllKeys, findYamlFiles, parseYaml } from "./utilities.ts";

import type { GenusData, CladeData, TreeNode, Reference } from "./types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const root = path.join(scriptDir, "..");

const dist = path.join(root, "dist");

/**
 * A genus record enriched with its computed taxonomy path.
 */
type ProcessedGenus = GenusData & {
    /**
     * Ordered list of ancestor clades from root to the genus's parent.
     */
    taxonomy: Array<string>;
};

/**
 * A clade record with computed taxonomy and selected fields for output.
 */
type ProcessedClade = {
    /**
     * Prose description of the clade.
     */
    description?: string;

    /**
     * Ordered list of ancestor clades from root to this clade.
     */
    taxonomy: Array<string>;

    /**
     * Year the clade was formally described.
     */
    described?: number;

    /**
     * Author(s) who described the clade.
     */
    authors?: string;

    /**
     * Technical diagnostic features of the clade.
     */
    diagnostic_features?: Array<string>;

    /**
     * Published references for the clade.
     */
    references?: Array<Reference>;
};

/**
 * Metadata block included at the top of the JSON/YAML output.
 */
type DatasetMetadata = {
    /**
     * Calendar version string (YYYY.MM).
     */
    version: string;

    /**
     * Semantic version of the output schema.
     */
    schema_version: string;

    /**
     * ISO 8601 timestamp of when the build was run.
     */
    built_at: string;

    /**
     * SPDX license identifier.
     */
    license: string;

    /**
     * Attribution string for the dataset.
     */
    attribution: string;

    /**
     * Total number of genera in the build.
     */
    genus_count: number;

    /**
     * Total number of clades in the build.
     */
    clade_count: number;
};

/**
 * Complete dataset structure written to the JSON and YAML output files.
 */
type Dataset = {
    /**
     * Build metadata (version, timestamp, counts).
     */
    _metadata: DatasetMetadata;

    /**
     * Full phylogenetic tree from tree.yml.
     */
    tree: TreeNode;

    /**
     * Processed clade records keyed by clade name.
     */
    clades: Record<string, ProcessedClade>;

    /**
     * Processed genus records keyed by genus name.
     */
    genera: Record<string, ProcessedGenus>;
};

/**
 * Searches the tree for a target clade and returns the path from root.
 *
 * @param tree - The tree node to search within.
 * @param target - The clade name to find.
 * @param path - Accumulated path (used internally during recursion).
 * @returns The path as an array of clade names, or null if not found.
 */
function findPath(tree: TreeNode, target: string, accumulated = new Array<string>()): Array<string> | null
{
    for (const [key, children] of Object.entries(tree))
    {
        const path = [...accumulated, key];

        if (key === target)
        {
            return path;
        }
        else if (children && typeof children === "object" && Object.keys(children).length > 0)
        {
            const found = findPath(children as TreeNode, target, path);
            if (found)
            {
                return found;
            }
        }
    }

    return null;
}

/**
 * Converts a phylogenetic tree to Newick notation.
 *
 * @param tree - The tree node to convert.
 * @returns A Newick-formatted string (without trailing semicolon).
 */
function toNewick(tree: TreeNode): string
{
    const parts = new Array<string>();

    for (const [name, children] of Object.entries(tree))
    {
        if (children && typeof children === "object" && Object.keys(children).length > 0)
        {
            parts.push(`(${toNewick(children as TreeNode)})${name}`);
        }
        else
        {
            parts.push(name);
        }
    }

    return parts.join(",");
}

/**
 * Collects all leaf node names from the tree (clades with no children).
 *
 * @param tree - The tree node to traverse.
 * @returns An array of leaf clade names.
 */
function collectLeaves(tree: TreeNode): Array<string>
{
    const leaves = new Array<string>();

    for (const [name, children] of Object.entries(tree))
    {
        if (children && typeof children === "object" && Object.keys(children).length > 0)
        {
            leaves.push(...collectLeaves(children as TreeNode));
        }
        else
        {
            leaves.push(name);
        }
    }

    return leaves;
}

const tree = parseYaml<TreeNode>(path.join(root, "tree.yml"));

const genera: Record<string, ProcessedGenus> = { };

for (const file of findYamlFiles(path.join(root, "genera")))
{
    const data = parseYaml<GenusData>(file);

    if (data && data.genus)
    {
        genera[data.genus] = {
            ...data,
            taxonomy: findPath(tree, data.parent ?? "") ?? [ ],
        };
    }
}

const clades: Record<string, ProcessedClade> = {};

for (const file of findYamlFiles(path.join(root, "clades")))
{
    const data = parseYaml<CladeData>(file);

    if (data && data.clade)
    {
        clades[data.clade] = {
            description: data.description,
            taxonomy: findPath(tree, data.clade) ?? [ ],
            described: data.described,
            authors: data.authors,
            diagnostic_features: data.diagnostic_features,
            references: data.references,
        };
    }
}

if (!fs.existsSync(dist))
{
    fs.mkdirSync(dist, { recursive: true });
}

const now = new Date();
const version = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;

const dataset: Dataset = {
    _metadata: {
        attribution: "Open Paleo contributors",
        built_at: now.toISOString(),
        clade_count: Object.keys(clades).length,
        genus_count: Object.keys(genera).length,
        license: "CC-BY-4.0",
        schema_version: "1.0.0",
        version,
    },
    tree,
    clades,
    genera,
};

fs.writeFileSync(
    path.join(dist, "open-paleo.json"),
    JSON.stringify(dataset, null, 2) + "\n");

fs.writeFileSync(
    path.join(dist, "open-paleo.yml"),
    yaml.dump(
        dataset,
        {
            lineWidth: -1,
            noRefs: true,
        }));

const topKey = Object.keys(tree)[0];
const newick = `(${toNewick(tree[topKey] as TreeNode)})${topKey};`;

fs.writeFileSync(
    path.join(dist, "tree.newick"),
    `[Open Paleo | CC BY 4.0 | github.com/open-paleo/data]\n${newick}\n`);

const leaves = collectLeaves(tree);

const nexus = `#NEXUS
[! Open Paleo — CC BY 4.0
   github.com/open-paleo/data
   Attribution: Open Paleo contributors ]

BEGIN TAXA;
  DIMENSIONS NTAX=${leaves.length};
  TAXLABELS ${leaves.join(" ")};
END;

BEGIN TREES;
  TREE open_paleo = ${newick}
END;
`;

fs.writeFileSync(path.join(dist, "tree.nexus"), nexus);

/**
 * Collects references
 */
function collectReferences(records: Record<string, ProcessedClade | ProcessedGenus>): void
{
    for (const record of Object.values(records))
    {
        if (record.references)
        {
            for (const reference of record.references)
            {
                if (reference.id && !referenceMap.has(reference.id))
                {
                    referenceMap.set(reference.id, reference);
                }
            }
        }
    }
}

const referenceMap = new Map<string, Reference>();

collectReferences(genera);
collectReferences(clades);

let bib = `% Open Paleo — CC BY 4.0
% github.com/open-paleo/data
% Attribution: Open Paleo contributors

`;

for (const reference of referenceMap.values())
{
    const entryType = reference.book ? "incollection" : "article";
    const fields = new Array<string>();

    if (reference.authors)
    {
        fields.push(`  author = {${reference.authors}}`);
    }

    if (reference.year)
    {
        fields.push(`  year = {${reference.year}}`);
    }

    if (reference.title)
    {
        fields.push(`  title = {${reference.title}}`);
    }

    if (reference.journal)
    {
        fields.push(`  journal = {${reference.journal}}`);
    }

    if (reference.book)
    {
        fields.push(`  booktitle = {${reference.book}}`);
    }

    if (reference.volume)
    {
        fields.push(`  volume = {${reference.volume}}`);
    }

    if (reference.issue)
    {
        fields.push(`  number = {${reference.issue}}`);
    }

    if (reference.pages)
    {
        fields.push(`  pages = {${reference.pages}}`);
    }

    if (reference.doi)
    {
        fields.push(`  doi = {${reference.doi}}`);
    }

    bib += `@${entryType}{${reference.id},\n${fields.join(",\n")}\n}\n\n`;
}

fs.writeFileSync(path.join(dist, "references.bib"), bib);

// --- Generate docs/ outputs for the contribution wizard ---

const docs = path.join(root, "docs");

if (!fs.existsSync(docs))
{
    fs.mkdirSync(docs, { recursive: true });
}

// Build docs/schema.json from schema.yml
type SchemaData = Record<string, unknown>;
const schema = parseYaml<SchemaData>(path.join(root, "schema.yml"));

const schemaOutput: Record<string, unknown> = {};

// Array-type vocabularies (sorted)
const arrayKeys = [
    "status", "diet", "locomotion", "completeness",
    "integument", "integument_evidence", "paleoenvironments",
    "periods", "identifier_sources",
];

for (const key of arrayKeys)
{
    const value = schema[key];
    if (Array.isArray(value))
    {
        schemaOutput[key] = [...value].sort();
    }
}

// Countries as code→name map (sorted by code)
const countriesMap = (schema.countries ?? {}) as Record<string, string>;
const sortedCountries: Record<string, string> = {};

for (const code of Object.keys(countriesMap).sort())
{
    sortedCountries[code] = countriesMap[code];
}

schemaOutput.countries = sortedCountries;

// Stages as full object (needed for period→stage filtering)
schemaOutput.stages = schema.stages;

// Clades from tree
schemaOutput.clades = collectAllKeys(tree).sort();

fs.writeFileSync(
    path.join(docs, "schema.json"),
    JSON.stringify(schemaOutput, null, 2) + "\n");

// Copy open-paleo.json to docs/
fs.copyFileSync(
    path.join(dist, "open-paleo.json"),
    path.join(docs, "open-paleo.json"));

console.log("Built: open-paleo.json, open-paleo.yml, tree.newick, tree.nexus, references.bib");
console.log("Built: docs/schema.json, docs/open-paleo.json");
