import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import type { GenusData, InstitutionEntry, Reference, Schema, TreeNode } from "./types.ts";
import { collectAllKeys, findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const root = path.join(scriptDir, "..");

const words = new Set<string>();

/**
 * Common paleontological terms that should always be in the dictionary.
 */
const commonTerms = [
    "Aves", "Dinosauria", "Saurischia", "Ornithischia", "Theropoda",
    "Sauropoda", "clade", "genus", "species", "holotype", "syntype",
    "paratype", "neotype", "lectotype", "taxon", "taxa", "phylogeny",
    "phylogenetic", "monophyletic", "paraphyletic", "polyphyletic",
    "apomorphy", "synapomorphy", "plesiomorphy", "autapomorphy",
    "acetabulum", "femur", "tibia", "fibula", "humerus", "ulna", "radius",
    "vertebra", "vertebrae", "sacral", "cervical", "dorsal", "caudal",
    "cranial", "dentary", "maxilla", "premaxilla", "nasal", "jugal",
    "quadrate", "squamosal", "parietal", "frontal", "lacrimal",
    "pneumatic", "pneumatized", "serrated", "laterally", "compressed",
    "bipedal", "quadrupedal", "herbivore", "carnivore", "omnivore",
    "insectivore", "piscivore", "integument", "osteoderms",
    "Cretaceous", "Jurassic", "Triassic", "Paleogene", "Mesozoic",
    "Maastrichtian", "Campanian", "Cenomanian", "Turonian", "Albian",
    "Aptian", "Barremian", "Tithonian", "Kimmeridgian", "Oxfordian",
];

for (const term of commonTerms)
{
    words.add(term);
}

const tree = parseYaml<TreeNode>(path.join(root, "tree.yml"));

for (const key of collectAllKeys(tree))
{
    words.add(key);
}

const schema = parseYaml<Schema>(path.join(root, "schema.yml"));

if (schema.stages)
{
    for (const stage of Object.keys(schema.stages))
    {
        words.add(stage);
    }
}

const institutions = parseYaml<Record<string, InstitutionEntry>>(path.join(root, "institutions.yaml"));

for (const [abbreviation, entry] of Object.entries(institutions))
{
    words.add(abbreviation);

    if (Array.isArray(entry.aliases))
    {
        for (const alias of entry.aliases)
        {
            if (typeof alias === "string")
            {
                words.add(alias);
            }
        }
    }
}

const paleoVocabPath = path.join(root, "dictionaries", "paleo-vocab.txt");

if (fs.existsSync(paleoVocabPath))
{
    const lines = fs.readFileSync(paleoVocabPath, "utf8").split("\n");

    for (const line of lines)
    {
        const trimmed = line.trim();

        if (trimmed.length > 0 && !trimmed.startsWith("#"))
        {
            words.add(trimmed);
        }
    }
}

/**
 * Extracts author surnames from a semicolon-delimited author string and adds
 * them to the global words set.
 *
 * @param authors - Author string in "Surname, Initial; ..." format.
 */
function extractAuthorSurnames(authors: string): void
{
    const authorList = authors.split(";");

    for (const author of authorList)
    {
        const trimmed = author.trim();

        if (trimmed.includes(","))
        {
            words.add(trimmed.split(",")[0].trim());
        }
        else
        {
            const parts = trimmed.split(/\s+/);
            words.add(parts[parts.length - 1]);
        }
    }
}

for (const file of findYamlFiles(path.join(root, "genera")))
{
    const data = parseYaml<GenusData>(file);

    if (!data)
    {
        continue;
    }

    if (data.genus)
    {
        words.add(data.genus);
    }

    if (data.species)
    {
        for (const species of data.species)
        {
            if (species.name)
            {
                for (const part of species.name.split(/\s+/))
                {
                    words.add(part);
                }
            }

            // Every rank, not just the formation: a member or bed name is
            // drawn from the same curated stratigraphic vocabulary, and the
            // location audit populates those fields far more often than it
            // adds a new formation. `locality` is deliberately left out --
            // it is free text naming a quarry, a farm or a road cutting,
            // which is not vocabulary the dictionary should carry.
            for (const field of ["group", "formation", "member", "bed"] as const)
            {
                const unit = species.location?.[field];

                if (typeof unit === "string")
                {
                    for (const word of unit.split(/\s+/))
                    {
                        words.add(word);
                    }
                }
            }
        }
    }

    if (data.authors)
    {
        extractAuthorSurnames(data.authors);
    }
}

// Author surnames come from the canonical reference store, where the
// bibliographic fields live (genus/clade files carry only citation pointers).
for (const file of findYamlFiles(path.join(root, "references")))
{
    const reference = parseYaml<Reference>(file);

    if (reference && reference.authors)
    {
        extractAuthorSurnames(reference.authors);
    }
}

const dictDir = path.join(root, "dictionaries");

if (!fs.existsSync(dictDir))
{
    fs.mkdirSync(dictDir, { recursive: true });
}

const sorted = [...words]
    .filter((word: string) => word && word.length > 0)
    .sort((a: string, b: string) => a.localeCompare(b));

const header = `# Auto-generated taxonomy dictionary — do not edit manually
# Generated from source data by scripts/generate-dictionary.ts
`;

fs.writeFileSync(
    path.join(dictDir, "taxonomy.txt"),
    header + sorted.join("\n") + "\n");

console.log(`Generated dictionaries/taxonomy.txt with ${sorted.length} words.`);
