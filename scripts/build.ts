import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { stringify as stringifyYaml } from "yaml";

import { findYamlFiles, parseYaml, loadInstitutionRegistry } from "./utilities.ts";

import type { GenusData, CladeData, TreeNode, Reference, ReferencePointer, InstitutionEntry, Synonym } from "./types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const root = path.join(scriptDir, "..");

const dist = path.join(root, "dist");

/**
 * A genus record enriched with its computed taxonomy path. Its `references`
 * hold fully-inflated blocks (store fields merged with each pointer's notes),
 * unlike the source `GenusData` which carries bare pointers.
 */
type ProcessedGenus = Omit<GenusData, "references"> & {
    /**
     * Ordered list of ancestor clades from root to the genus's parent.
     */
    taxonomy: Array<string>;

    /**
     * Fully-inflated references for output.
     */
    references?: Array<Reference>;
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
     * Type genus of a rank-based name (omitted for unranked clades).
     */
    type_genus?: string;

    /**
     * Year the clade was formally described (derived from `erected_in` when set).
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
     * Names that are synonyms of this clade (e.g. a replaced or emended
     * family-group name).
     */
    synonyms?: Array<Synonym>;

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

/**
 * Loads the canonical reference store (`references/<letter>/<key>.yml`) into a
 * map keyed by reference id. Each file holds one reference's bibliographic
 * fields; per-occurrence notes live on the in-file pointers, not here.
 *
 * @param storeDir - The references/ directory.
 * @returns A map from reference id to its bibliographic record.
 */
function loadReferenceStore(storeDir: string): Map<string, Reference>
{
    const store = new Map<string, Reference>();

    if (!fs.existsSync(storeDir))
    {
        return store;
    }

    for (const file of findYamlFiles(storeDir))
    {
        const entry = parseYaml<Reference>(file);

        if (entry && entry.id)
        {
            store.set(entry.id, entry);
        }
    }

    return store;
}

const referenceStore = loadReferenceStore(path.join(root, "references"));

/**
 * Re-inflates in-file reference pointers (`{id, notes?}`) into full
 * bibliographic blocks by merging each pointer with its store entry, so the
 * built dataset carries self-contained references. An unknown id falls back to
 * the bare pointer.
 *
 * @param pointers - The in-file reference pointers.
 * @returns Full reference blocks for output.
 */
function inflateReferences(pointers?: Array<ReferencePointer>): Array<Reference>
{
    return (pointers ?? []).map((pointer) =>
    {
        const entry = pointer.id ? referenceStore.get(pointer.id) : undefined;
        const inflated: Reference = { ...(entry ?? { id: pointer.id }) };

        if (pointer.notes !== undefined)
        {
            inflated.notes = pointer.notes;
        }

        return inflated;
    });
}

const genera: Record<string, ProcessedGenus> = { };

for (const file of findYamlFiles(path.join(root, "genera")))
{
    const data = parseYaml<GenusData>(file);

    if (data && data.genus)
    {
        genera[data.genus] = {
            ...data,
            references: inflateReferences(data.references),
            taxonomy: findPath(tree, data.parent ?? "") ?? [ ],
        };
    }
}

// Resolve institution abbreviation keys to display names.
const institutionRegistry = loadInstitutionRegistry(path.join(root, "institutions.yaml"));

/**
 * Resolves institution abbreviation keys to display names across all
 * species type_specimen blocks. Mutates the genera records in place.
 *
 * @param generaMap - The processed genera map.
 * @param registry - The institution registry keyed by abbreviation.
 */
function resolveInstitutionKeys(
    generaMap: Record<string, ProcessedGenus>,
    registry: Record<string, InstitutionEntry>,
): void
{
    for (const genus of Object.values(generaMap))
    {
        for (const species of genus.species ?? [])
        {
            if (species.type_specimen?.institution)
            {
                const entry = registry[species.type_specimen.institution];

                if (entry)
                {
                    species.type_specimen.institution = entry.name;
                }
            }
        }

        for (const specimen of genus.notable_specimens ?? [])
        {
            if (specimen.institution)
            {
                const entry = registry[specimen.institution];

                if (entry)
                {
                    specimen.institution = entry.name;
                }
            }
        }
    }
}

resolveInstitutionKeys(genera, institutionRegistry);

/**
 * Derives the denormalized author/year onto each species (and the genus) from
 * the `erected_in` reference, for consumers of the built dataset. Source YAML
 * carries only the reference pointer (issue #1886); the human-readable
 * authority is reconstituted here. Genus authority uses the genus-level
 * `erected_in` override when present, else the type species's `erected_in`.
 *
 * @param generaMap - The processed genera map (mutated in place).
 */
function deriveAuthorities(generaMap: Record<string, ProcessedGenus>): void
{
    for (const genus of Object.values(generaMap))
    {
        for (const species of genus.species ?? [])
        {
            const reference = species.erected_in ? referenceStore.get(species.erected_in) : undefined;

            if (reference)
            {
                species.authors = reference.authors;
                species.described = reference.year;
            }
        }

        const typeSpecies = (genus.species ?? []).find((species) => species.type_species)
            ?? genus.species?.[0];
        const genusAuthorityKey = genus.erected_in ?? typeSpecies?.erected_in;
        const genusReference = genusAuthorityKey ? referenceStore.get(genusAuthorityKey) : undefined;

        if (genusReference)
        {
            genus.authors = genusReference.authors;
            genus.described = genusReference.year;
        }
    }
}

deriveAuthorities(genera);

const clades: Record<string, ProcessedClade> = {};

for (const file of findYamlFiles(path.join(root, "clades")))
{
    const data = parseYaml<CladeData>(file);

    if (data && data.clade)
    {
        // Derive authors/year from the erected_in reference (the
        // nomenclatural-act paper), resolved against the store.
        let described: number | undefined;
        let authors: string | undefined;

        if (data.erected_in)
        {
            const authorityReference = referenceStore.get(data.erected_in);

            if (authorityReference)
            {
                authors = authorityReference.authors;
                described = authorityReference.year;
            }
        }

        clades[data.clade] = {
            description: data.description,
            taxonomy: findPath(tree, data.clade) ?? [ ],
            type_genus: data.type_genus,
            described,
            authors,
            diagnostic_features: data.diagnostic_features,
            synonyms: data.synonyms,
            references: inflateReferences(data.references),
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
    stringifyYaml(dataset, { lineWidth: 0 }));

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

let bib = `% Open Paleo — CC BY 4.0
% github.com/open-paleo/data
% Attribution: Open Paleo contributors

`;

for (const reference of [...referenceStore.values()].sort((first, second) => (first.id ?? "").localeCompare(second.id ?? "")))
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

// Ship the JSON Schema that describes this output alongside the data, so
// consumers can validate dist/open-paleo.json (and .yml) against it. The
// schema is hand-authored under schemas/ (the source of truth); a validator
// check keeps its controlled-vocabulary enums in sync with schema.yml.
fs.copyFileSync(
    path.join(root, "schemas", "open-paleo.schema.json"),
    path.join(dist, "open-paleo.schema.json"));

console.log("Built: open-paleo.json, open-paleo.yml, open-paleo.schema.json, tree.newick, tree.nexus, references.bib");
