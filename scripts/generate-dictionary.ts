import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import type { CladeData, GenusData, InstitutionEntry, Reference, TreeNode } from "./types.ts";
import {
    collectAllKeys,
    findYamlFiles,
    loadRegionRegistry,
    loadSchema,
    loadStratigraphyRegistry,
    parseYaml,
} from "./utilities.ts";

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

/**
 * Adds each word of a name to the dictionary: the letter runs of the text,
 * split at hyphens and apostrophes, so "Muséum national d'Histoire naturelle"
 * contributes "Muséum", "national", "Histoire" and "naturelle".
 *
 * @param name - The name to split.
 */
function addNameWords(name: string | undefined): void
{
    for (const token of name?.match(/\p{L}[\p{L}'’-]*/gu) ?? [])
    {
        for (const part of token.split(/[-'’]/))
        {
            if (part.length > 1)
            {
                words.add(part);
            }
        }
    }
}

/**
 * Endings of formal clade names and the informal forms prose builds from them:
 * Abelisauridae gives "abelisaurid", Titanosauria "titanosaurian" and
 * "titanosaur", Sauropodomorpha "sauropodomorph". A rule that yields a word no
 * one writes costs nothing, since the word is still built from a real name.
 */
const cladeEndings: Array<[RegExp, Array<string>]> = [
    [/idae$/, ["id"]],
    [/inae$/, ["ine"]],
    [/ini$/, ["in"]],
    [/oidea$/, ["oid", "oidean"]],
    [/iformes$/, ["iform"]],
    [/morpha$/, ["morph", "morphan"]],
    [/ia$/, ["ian", ""]],
    [/a$/, ["an", ""]],
    [/es$/, ["ian"]],
];

const tree = parseYaml<TreeNode>(path.join(root, "tree.yml"));

for (const key of collectAllKeys(tree))
{
    words.add(key);

    for (const [ending, replacements] of cladeEndings)
    {
        if (ending.test(key))
        {
            for (const replacement of replacements)
            {
                const form = key.replace(ending, replacement).toLowerCase();

                words.add(form);
                words.add(`${form}s`);
            }
        }
    }
}

const schema = loadSchema(root);

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
    addNameWords(entry.name);
    addNameWords(entry.location?.city);

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

// Every unit in the registry, not only those a genus cites: prose about a unit
// names its neighbors, its former names and its beds.
for (const unit of Object.values(loadStratigraphyRegistry(root).units))
{
    addNameWords(unit.name);

    for (const variant of unit.variants ?? [])
    {
        addNameWords(variant);
    }

    for (const bed of unit.beds ?? [])
    {
        addNameWords(bed.name);
    }
}

for (const regionName of Object.values(loadRegionRegistry(path.join(root, "regions.yaml"))))
{
    addNameWords(regionName);
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

    // Synonyms are taxon names too, and prose cites them by name: the junior
    // synonyms a genus absorbed, and the species it was once filed under.
    for (const synonym of data.synonyms ?? [])
    {
        addNameWords(synonym.name);
    }

    for (const specimen of data.notable_specimens ?? [])
    {
        addNameWords(specimen.species);
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

            for (const synonym of species.synonyms ?? [])
            {
                addNameWords(synonym.name);
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
}

for (const file of findYamlFiles(path.join(root, "clades")))
{
    for (const synonym of parseYaml<CladeData>(file)?.synonyms ?? [])
    {
        addNameWords(synonym.name);
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

// The curated lists come last, so an entry the data already supplies can be
// reported: a taxon a record now carries, or a unit the registry now holds,
// no longer needs its curated line.
const generated = new Set(words);

for (const curatedName of ["paleo-vocab.txt", "taxon-names.txt", "unit-names.txt"])
{
    const curatedPath = path.join(dictDir, curatedName);

    if (!fs.existsSync(curatedPath))
    {
        continue;
    }

    const redundant = new Array<string>();

    for (const line of fs.readFileSync(curatedPath, "utf8").split("\n"))
    {
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed.startsWith("#"))
        {
            continue;
        }
        else if (generated.has(trimmed))
        {
            redundant.push(trimmed);
        }

        words.add(trimmed);
    }

    if (redundant.length > 0)
    {
        const entries = redundant.length === 1 ? "entry" : "entries";

        console.log(`dictionaries/${curatedName}: ${redundant.length} ${entries} the data already supplies, which can be removed: ${redundant.join(", ")}`);
    }
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
