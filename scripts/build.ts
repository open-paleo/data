import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { stringify as stringifyYaml } from "yaml";

import {
    findTreePath,
    findYamlFiles,
    loadInstitutionRegistry,
    loadRegionRegistry,
    loadSchema,
    loadStratigraphyRegistry,
    parseYaml,
    computeMidpointAge,
} from "./utilities.ts";

import { composeCladeSummary } from "./clade-summary.ts";
import { composeGenusSummary } from "./genus-summary.ts";
import { composeUnitDescription, type UnitFacts } from "./unit-description.ts";

import type { GenusData, CladeData, Dispute, TreeNode, Reference, ReferencePointer, InstitutionEntry, Paleocoordinates, Period, StageInfo, StratigraphicBed, StratigraphicUnit, Synonym, FormerId } from "./types.ts";

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
     * The published description: the summary the build writes from the
     * record, then the source `narrative`, if any, after a blank line.
     */
    description?: string;

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
     * The clade's rank.
     */
    rank?: string;

    /**
     * The published description: the summary the build writes from the
     * record, then the source `narrative`, if any, after a blank line.
     */
    description?: string;

    /**
     * The source narrative, removed once the description is composed.
     */
    narrative?: string;

    /**
     * A live dispute about the clade, such as whether it is a natural group.
     */
    dispute?: Dispute;

    /**
     * Ordered list of ancestor clades from root to this clade.
     */
    taxonomy: Array<string>;

    /**
     * Type genus of a rank-based name (omitted for unranked clades).
     */
    type_genus?: string;

    /**
     * The clade's identifiers in other databases.
     */
    identifiers?: Array<{ source?: string; id?: string }>;

    /**
     * Year the clade was formally described (derived from `erected_in` when set).
     */
    described?: number;

    /**
     * Author(s) who described the clade.
     */
    authors?: string;

    /**
     * Reference id of the paper that erected the clade name; `authors` and
     * `described` derive from it.
     */
    erected_in?: string;

    /**
     * Reference id of the authoritative descriptive source, such as a later
     * definition or diagnosis. Absent when it is the same as `erected_in`.
     */
    described_in?: string;

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

    /**
     * The plate model behind `location.paleocoordinates`, with the citation
     * and license to credit it by. Absent when the build attached none.
     */
    paleogeography?: {
        /**
         * The model's name, as recorded on each point.
         */
        model: string;

        /**
         * The citation the model's authors ask for.
         */
        citation: string;

        /**
         * License of the model's data.
         */
        license: string;
    };
};

/**
 * The chronostratigraphic timescale the dataset's ages are read against.
 */
type Timescale = {
    /**
     * The published chart the stage boundaries follow.
     */
    chart: string;

    /**
     * Every stage in schema.yml, youngest first, keyed by stage name.
     */
    stages: Record<string, StageInfo>;
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
     * Stage boundary ages and the epoch each stage belongs to.
     */
    timescale: Timescale;

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

    /**
     * Stratigraphic units keyed by name, beds included.
     */
    stratigraphy: Record<string, PublishedUnit>;
};

/**
 * Converts a phylogenetic tree to Newick notation.
 *
 * @param tree - The tree node to convert.
 * @returns A Newick-formatted string (without trailing semicolon).
 */
function convertToNewick(tree: TreeNode): string
{
    const parts = new Array<string>();

    for (const [name, children] of Object.entries(tree))
    {
        if (children && typeof children === "object" && Object.keys(children).length > 0)
        {
            parts.push(`(${convertToNewick(children as TreeNode)})${name}`);
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

        // The other forms a work is cited in serve the citation check only, and
        // a store entry's own notes are bibliographic notes for maintainers: a
        // published reference carries only the citing record's notes.
        delete inflated.also_cited_as;
        delete inflated.notes;

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
            taxonomy: findTreePath(tree, data.parent ?? "") ?? [ ],
        };
    }
}

// Resolve institution abbreviation keys to display names.
const institutionRegistry = loadInstitutionRegistry(path.join(root, "institutions.yaml"));

/**
 * Resolves the institution keys inside an identifier history to display names,
 * so a consumer reading `former_ids` sees the same form as the block's own
 * `institution` field rather than a bare code.
 *
 * @param formerIds - The former_ids array, or undefined when absent.
 * @param registry - The institution registry keyed by abbreviation.
 */
function resolveFormerIdInstitutions(
    formerIds: Array<FormerId> | undefined,
    registry: Record<string, InstitutionEntry>,
): void
{
    for (const entry of formerIds ?? [])
    {
        for (const field of ["from_institution", "to_institution"] as const)
        {
            const key = entry[field];

            if (key && registry[key])
            {
                entry[field] = registry[key].name;
            }
        }
    }
}

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

            resolveFormerIdInstitutions(species.type_specimen?.former_ids, registry);
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

            resolveFormerIdInstitutions(specimen.former_ids, registry);
        }
    }
}

resolveInstitutionKeys(genera, institutionRegistry);

// Resolve ISO 3166-2 subdivision codes to English names.
const regionRegistry = loadRegionRegistry(path.join(root, "regions.yaml"));

/**
 * Resolves each location's ISO 3166-2 code to its English subdivision name,
 * keeping the code alongside it as `region_code`.
 *
 * The source YAML stores only the code, so that an external registry settles
 * spelling, rank words and exonyms rather than us. Output consumers get the
 * readable name they already had in `region` plus a joinable key.
 *
 * @param generaMap - The processed genera map.
 * @param registry - The region registry keyed by ISO 3166-2 code.
 */
function resolveRegionCodes(
    generaMap: Record<string, ProcessedGenus>,
    registry: Record<string, string>,
): void
{
    for (const genus of Object.values(generaMap))
    {
        for (const species of genus.species ?? [ ])
        {
            const location = species.location;

            if (!location?.region)
            {
                continue;
            }

            const name = registry[location.region];

            if (name)
            {
                location.region_code = location.region;
                location.region = name;
            }
        }
    }
}

resolveRegionCodes(genera, regionRegistry);

/**
 * Names the unit that `location.part` qualifies, as `part_of`.
 *
 * An informal position is only ever meaningful against the finest unit that
 * contains the occurrence: where that unit in turn sits inside its parent is a
 * property of the unit, identical for everything in it, and belongs recorded
 * once rather than on every record. So the target is always the finest of bed,
 * member and formation that the record populates -- but that rule is invisible
 * to anyone reading the source, so the build states it.
 *
 * @param generaMap - The processed genera map.
 */
function resolvePartTargets(generaMap: Record<string, ProcessedGenus>): void
{
    for (const genus of Object.values(generaMap))
    {
        for (const species of genus.species ?? [ ])
        {
            const location = species.location;

            if (!location?.part)
            {
                continue;
            }

            location.part_of = location.bed
                ? "bed"
                : location.member
                    ? "member"
                    : location.formation
                        ? "formation"
                        : "group";
        }
    }
}

resolvePartTargets(genera);

// Fill in the boundary ages a record leaves to its stages.
const stageTable = loadSchema(root).stages ?? {};

/**
 * Derives `from_ma`/`to_ma` from the union of a species' listed stages
 * wherever the record does not state them itself.
 *
 * The source YAML carries an explicit age only when a paper narrows the
 * interval beyond the stage it names. Everything else is the stage boundary
 * restated, which is how the records came to hold three different timescales
 * at once -- some on GTS2012, some on current ICS, a few mixing the two
 * within one range. Deriving here means one table decides, and an age
 * surviving in the source is by that fact a published determination.
 *
 * @param generaMap - The processed genera map.
 * @param stages - The stage table keyed by stage name.
 */
function deriveStageAges(
    generaMap: Record<string, ProcessedGenus>,
    stages: Record<string, StageInfo>,
): void
{
    for (const genus of Object.values(generaMap))
    {
        for (const species of genus.species ?? [ ])
        {
            const period = species.period;

            if (!period)
            {
                continue;
            }

            const resolved = (Array.isArray(period.stage) ? period.stage : [ ])
                .map((stageName) => stages[stageName])
                .filter((info): info is StageInfo => info !== undefined);

            if (resolved.length === 0)
            {
                continue;
            }

            period.from_ma ??= Math.max(...resolved.map((info) => info.from_ma));
            period.to_ma ??= Math.min(...resolved.map((info) => info.to_ma));
        }
    }
}

deriveStageAges(genera, stageTable);

/**
 * The plate model description shared with scripts/plate-reconstruction/reconstruct-points.py.
 */
type PlateModel = {
    /**
     * The model's name, as recorded on each point.
     */
    model: string;

    /**
     * The citation the model's authors ask for.
     */
    citation: string;

    /**
     * SPDX-style license identifier of the model's data.
     */
    license: string;
};

/**
 * One reconstructed locality in scratch/plate-reconstruction/paleocoordinates.json, with the
 * inputs it was computed from.
 */
type ReconstructedPoint = Paleocoordinates & {
    /**
     * The ISO 3166-2 code whose center was reconstructed, if any.
     */
    region?: string;

    /**
     * The country code whose center was reconstructed, if any.
     */
    country?: string;
};

/**
 * Attaches the reconstructed positions in scratch/plate-reconstruction/paleocoordinates.json
 * (written by `npm run collect-reconstruction-points` and scripts/plate-reconstruction/reconstruct-points.py) as
 * `location.paleocoordinates`.
 *
 * A result is used only while the inputs it was computed from still match the
 * record -- the age, and the coordinates or the region or country whose center
 * stood in for them -- so an edit made since the reconstruction ran leaves the
 * field off rather than publishing a position for the old values. With
 * OPEN_PALEO_REQUIRE_PALEOCOORDINATES set, as in CI, a missing file or a stale
 * result fails the build instead.
 *
 * @param generaMap - The processed genera map.
 * @param stages - The stage table keyed by stage name.
 * @returns The model description when results were attached, else undefined.
 */
function attachPaleocoordinates(
    generaMap: Record<string, ProcessedGenus>,
    stages: Record<string, StageInfo>,
): PlateModel | undefined
{
    const required = process.env.OPEN_PALEO_REQUIRE_PALEOCOORDINATES !== undefined;
    const resultsPath = path.join(root, "scratch", "plate-reconstruction", "paleocoordinates.json");

    if (!fs.existsSync(resultsPath))
    {
        const notice = "No scratch/plate-reconstruction/paleocoordinates.json: paleocoordinates left out. Run npm run collect-reconstruction-points and npm run reconstruct-points to add them.";

        if (required)
        {
            throw new Error(notice);
        }

        console.log(notice);
        return undefined;
    }

    const model = JSON.parse(fs.readFileSync(path.join(root, "scripts", "plate-reconstruction", "model.json"), "utf8")) as PlateModel;
    const results = (JSON.parse(fs.readFileSync(resultsPath, "utf8")) as { results: Record<string, ReconstructedPoint> }).results;
    const stale = new Array<string>();
    let attached = 0;

    for (const genus of Object.values(generaMap))
    {
        for (const species of genus.species ?? [ ])
        {
            const id = `${genus.genus}|${species.name}`;
            const result = results[id];
            const location = species.location;

            if (!result || !location)
            {
                continue;
            }

            const coordinates = location.coordinates;
            const inputsMatch = result.model === model.model
                && result.age_ma === computeMidpointAge(species.period, stages)
                && (coordinates
                    ? !result.approximate && result.latitude_present === coordinates[0] && result.longitude_present === coordinates[1]
                    : result.approximate && (result.region ?? undefined) === (location.region_code ?? location.region)
                        && (result.region || result.country === location.country));

            if (!inputsMatch)
            {
                stale.push(id);
                continue;
            }

            location.paleocoordinates = {
                latitude: result.latitude,
                longitude: result.longitude,
                latitude_present: result.latitude_present,
                longitude_present: result.longitude_present,
                age_ma: result.age_ma,
                model: result.model,
                model_plate_id: result.model_plate_id,
                approximate: result.approximate,
            };
            attached++;
        }
    }

    console.log(`Paleocoordinates: ${attached} attached (${model.model}).`);

    if (stale.length > 0)
    {
        const notice = `Paleocoordinates out of date for ${stale.length}, left out: ${stale.join(", ")}`;

        if (required)
        {
            throw new Error(notice);
        }

        console.log(notice);
    }

    return model;
}

const plateModel = attachPaleocoordinates(genera, stageTable);

/**
 * Writes each genus's published `description`: the summary composed from
 * its record, then its `narrative`, if it has one, after a blank line. The
 * narrative itself is not published separately.
 *
 * @param generaMap - The processed genera map (mutated in place).
 * @param stages - The stage table keyed by stage name.
 */
function composeGenusDescriptions(
    generaMap: Record<string, ProcessedGenus>,
    stages: Record<string, StageInfo>,
): void
{
    const countryNames = loadSchema(root).countries ?? { };
    const registry = loadStratigraphyRegistry(root).units;
    const stageOrder = Object.entries(stages)
        .sort(([, first], [, second]) => second.from_ma - first.from_ma)
        .map(([stageName]) => stageName);
    const periodOrder = [ ...new Set(stageOrder.map((stageName) => stages[stageName].period)) ];

    const movedSpecies = new Map<string, Array<{ original: string; current: string }>>();

    for (const [genusName, genus] of Object.entries(generaMap))
    {
        for (const species of genus.species ?? [ ])
        {
            const originalGenus = species.erected_as?.split(/\s+/)[0];

            if (species.erected_as && species.name && originalGenus && originalGenus !== genusName)
            {
                const moved = movedSpecies.get(originalGenus) ?? [ ];

                moved.push({ original: species.erected_as, current: species.name });
                movedSpecies.set(originalGenus, moved);
            }
        }
    }

    for (const [genusName, genus] of Object.entries(generaMap))
    {
        const typeSpeciesRecord = (genus.species ?? [ ]).find((species) => species.type_species) ?? genus.species?.[0];
        const typeSpecimen = typeSpeciesRecord?.type_specimen;
        const redescription = typeSpeciesRecord?.described_in && typeSpeciesRecord.described_in !== typeSpeciesRecord.erected_in
            ? referenceStore.get(typeSpeciesRecord.described_in)
            : undefined;
        const summary = composeGenusSummary({
            name: genusName,
            parent: genus.parent ?? genus.taxonomy[genus.taxonomy.length - 1] ?? "",
            placement: genus.placement,
            taxonomy: genus.taxonomy,
            etymology: genus.etymology,
            authors: genus.authors,
            described: genus.described,
            diet: genus.diet,
            locomotion: genus.locomotion,
            species: (genus.species ?? [ ]).map((species) =>
            {
                const unitName = species.location?.formation ?? species.location?.group;
                const country = species.location?.country;

                return {
                    name: species.name ?? "",
                    status: species.status,
                    typeSpecies: species.type_species,
                    stages: species.period?.stage ?? [ ],
                    periods: species.period?.name ?? [ ],
                    country: country ? countryNames[country] ?? country : undefined,
                    unit: unitName ? { name: unitName, rank: registry[unitName]?.rank } : undefined,
                    length: species.size?.length_m,
                };
            }),
            typeSpecimen: typeSpecimen
                ? {
                    material: typeSpecimen.material,
                    formerIds: (typeSpecimen.former_ids ?? [ ]).map((former) => ({
                        fromId: former.from_id,
                        fromInstitution: former.from_institution,
                        reason: former.reason,
                    })),
                }
                : undefined,
            erectedAs: typeSpeciesRecord?.erected_as,
            redescribed: redescription?.authors && redescription.year
                ? { authors: redescription.authors, year: Number(redescription.year) }
                : undefined,
            movedSpecies: (movedSpecies.get(genusName) ?? [ ]).sort((first, second) => first.current.localeCompare(second.current)),
            objectiveSynonyms: (genus.synonyms ?? [ ])
                .filter((synonym) => synonym.type === "junior objective")
                .map((synonym) => synonym.name),
            icznCases: (genus.iczn_cases ?? [ ]).map((icznCase) =>
            {
                const ruling = icznCase.ruling ? referenceStore.get(icznCase.ruling) : undefined;

                return {
                    type: icznCase.type ?? "",
                    status: icznCase.status ?? "",
                    year: ruling ? Number(ruling.year) : undefined,
                    opinion: ruling?.title?.match(/^Opinion (\d+)/)?.[1],
                };
            }),
            nicknames: (genus.notable_specimens ?? [ ])
                .map((specimen) => specimen.nickname)
                .filter((nickname): nickname is string => Boolean(nickname)),
            disputed: Boolean(genus.dispute),
            stageOrder,
            periodOrder,
        });

        genus.description = [ summary, genus.narrative ].filter(Boolean).join("\n\n");
        delete genus.narrative;
    }
}

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

composeGenusDescriptions(genera, stageTable);

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
            rank: data.rank,
            narrative: data.narrative,
            dispute: data.dispute,
            taxonomy: findTreePath(tree, data.clade) ?? [ ],
            type_genus: data.type_genus,
            identifiers: data.identifiers,
            described,
            authors,
            erected_in: data.erected_in,
            described_in: data.described_in,
            diagnostic_features: data.diagnostic_features,
            synonyms: data.synonyms,
            references: inflateReferences(data.references),
        };
    }
}

/**
 * Writes each clade's published `description`: the summary composed from
 * the clade's record and the genera within it, then its `narrative`, if it
 * has one, after a blank line.
 *
 * @param cladeMap - The processed clades (mutated in place).
 * @param generaMap - The processed genera.
 * @param stages - The stage table keyed by stage name.
 */
function composeCladeDescriptions(
    cladeMap: Record<string, ProcessedClade>,
    generaMap: Record<string, ProcessedGenus>,
    stages: Record<string, StageInfo>,
): void
{
    const countryNames = loadSchema(root).countries ?? { };
    const stageOrder = Object.entries(stages)
        .sort(([, first], [, second]) => second.from_ma - first.from_ma)
        .map(([stageName]) => stageName);
    const periodOrder = [ ...new Set(stageOrder.map((stageName) => stages[stageName].period)) ];
    const stageEpochs = Object.fromEntries(Object.entries(stages).map(([stageName, info]) => [stageName, info.period]));
    const birdAncestry = cladeMap.Avialae?.taxonomy ?? [ ];
    const genusFacts = Object.entries(generaMap).map(([genusName, genus]) =>
    {
        const typeSpecies = (genus.species ?? [ ]).find((species) => species.type_species) ?? genus.species?.[0];

        return {
            taxonomy: genus.taxonomy,
            facts: {
                name: genusName,
                notable: genus.notable_specimens?.length ?? 0,
                species: genus.species?.length ?? 0,
                stages: (genus.species ?? [ ]).flatMap((species) => species.period?.stage ?? [ ]),
                periods: (genus.species ?? [ ]).flatMap((species) => species.period?.name ?? [ ]),
                countries: [ ...new Set((genus.species ?? [ ])
                    .map((species) => species.location?.country)
                    .filter((country): country is string => Boolean(country))
                    .map((country) => countryNames[country] ?? country)) ],
                diet: genus.diet,
                locomotion: genus.locomotion,
                length: typeSpecies?.size?.length_m,
            },
        };
    });

    for (const [cladeName, clade] of Object.entries(cladeMap))
    {
        let node: TreeNode | undefined = tree;

        for (const step of clade.taxonomy)
        {
            node = node?.[step] as TreeNode | undefined;
        }

        const revision = clade.described_in && clade.described_in !== clade.erected_in
            ? referenceStore.get(clade.described_in)
            : undefined;
        const summary = composeCladeSummary({
            name: cladeName,
            rank: clade.rank ?? "unranked",
            taxonomy: clade.taxonomy.slice(0, -1),
            authors: clade.authors,
            described: clade.described,
            typeGenus: clade.type_genus,
            revised: revision?.authors && revision.year ? { authors: revision.authors, year: Number(revision.year) } : undefined,
            subgroups: Object.keys(node ?? { }).map((subgroup) => ({ name: subgroup, rank: cladeMap[subgroup]?.rank ?? "unranked" })),
            genera: genusFacts.filter((genus) => genus.taxonomy.includes(cladeName)).map((genus) => genus.facts),
            includesBirds: cladeName === "Avialae" || clade.taxonomy.includes("Avialae") || birdAncestry.includes(cladeName),
            stageEpochs,
            disputed: Boolean(clade.dispute),
            stageOrder,
            periodOrder,
        });

        clade.description = [ summary, clade.narrative ].filter(Boolean).join("\n\n");
        delete clade.narrative;
    }
}

composeCladeDescriptions(clades, genera, stageTable);

/**
 * A stratigraphic unit as published: the registry entry with its age in the
 * same shape as a species' `period` and its references inflated.
 */
type PublishedUnit = {
    /**
     * The unit's rank; absent for an informal label that has none.
     */
    rank?: string;

    /**
     * True for a unit that was never formally erected.
     */
    informal?: boolean;

    /**
     * The unit this one lies within: a member's formation, a bed's unit.
     */
    parent?: string;

    /**
     * Other names the literature gives the unit.
     */
    variants?: Array<string>;

    /**
     * A few-sentence summary of the unit for a general reader.
     */
    description?: string;

    /**
     * The unit's age: its epochs, its stages, and the boundary ages those
     * stages span.
     */
    period: Period;

    /**
     * A live dispute about the unit.
     */
    dispute?: Dispute;

    /**
     * The works the unit's values come from.
     */
    references: Array<Reference>;
};

/**
 * Builds the published form of one registry entry.
 *
 * @param entry - The registry unit or bed.
 * @param rank - The unit's rank, if it has one.
 * @param parent - The unit containing it, if any.
 * @param stages - The stage table keyed by stage name.
 * @param facts - The facts its generated description is written from.
 * @returns The unit as it appears in the output.
 */
function publishUnit(
    entry: StratigraphicUnit | StratigraphicBed,
    rank: string | undefined,
    parent: string | undefined,
    stages: Record<string, StageInfo>,
    facts: UnitFacts,
): PublishedUnit
{
    const stageNames = entry.stages ?? [ ];
    const spanned = stageNames
        .map((stageName) => stages[stageName])
        .filter((info): info is StageInfo => info !== undefined);
    const period: Period = { name: entry.period };

    if (stageNames.length > 0)
    {
        period.stage = stageNames;
    }

    if (spanned.length > 0)
    {
        period.from_ma = Math.max(...spanned.map((info) => info.from_ma));
        period.to_ma = Math.min(...spanned.map((info) => info.to_ma));
    }

    return {
        ...(rank ? { rank } : { }),
        ...(entry.informal ? { informal: true } : { }),
        ...(parent ? { parent } : { }),
        ...(entry.variants?.length ? { variants: entry.variants } : { }),
        ...(entry.lithology ? { lithology: entry.lithology } : { }),
        description: [ composeUnitDescription(facts), entry.narrative ].filter(Boolean).join("\n\n"),
        period,
        ...(entry.dispute ? { dispute: entry.dispute } : { }),
        references: inflateReferences(entry.references),
    };
}

/**
 * Gathers the facts each unit's generated description is written from: its
 * own record, the units the registry places inside it, and the genera and
 * places species records give for it or for any unit inside it, so that a
 * formation also lists what its members and beds have yielded.
 *
 * @param units - The registry units keyed by name.
 * @returns The facts for every unit and bed, keyed by name.
 */
function collectUnitFacts(units: Record<string, StratigraphicUnit>): Map<string, UnitFacts>
{
    const countryNames = loadSchema(root).countries ?? { };
    const facts = new Map<string, UnitFacts>();
    const parentOf = new Map<string, string>();
    const generaOf = new Map<string, Map<string, number>>();
    const placesOf = new Map<string, Map<string, Map<string, number>>>();

    /**
     * Registers one unit or bed.
     *
     * @param entry - The registry entry.
     * @param rank - Its rank, if any.
     * @param parent - The unit containing it, if any.
     */
    const register = (entry: StratigraphicUnit | StratigraphicBed, rank: string | undefined, parent: string | undefined): void =>
    {
        facts.set(entry.name, {
            name: entry.name,
            rank,
            informal: entry.informal,
            stages: entry.stages ?? [ ],
            periods: entry.period ?? [ ],
            places: [ ],
            members: [ ],
            genera: [ ],
            variants: entry.variants ?? [ ],
            lithology: entry.lithology,
        });

        if (parent)
        {
            parentOf.set(entry.name, parent);
        }
    };

    for (const unit of Object.values(units))
    {
        register(unit, unit.rank, unit.parent);

        for (const bed of unit.beds ?? [ ])
        {
            register(bed, "bed", unit.name);
        }
    }

    for (const [name, parent] of parentOf)
    {
        const container = facts.get(parent);

        if (container)
        {
            container.members.push({ name, rank: facts.get(name)?.rank });
            facts.get(name)!.parent = { name: parent, rank: container.rank };
        }
    }

    for (const [genusName, genus] of Object.entries(genera))
    {
        for (const species of genus.species ?? [ ])
        {
            const location = species.location;
            const finest = location?.bed ?? location?.member ?? location?.formation ?? location?.group;
            const country = location?.country ? countryNames[location.country] ?? location.country : undefined;
            const seen = new Set<string>();
            let current = finest && facts.has(finest) ? finest : undefined;

            while (current && !seen.has(current))
            {
                seen.add(current);

                const counts = generaOf.get(current) ?? new Map<string, number>();
                counts.set(genusName, (counts.get(genusName) ?? 0) + 1);
                generaOf.set(current, counts);

                if (country)
                {
                    const byCountry = placesOf.get(current) ?? new Map<string, Map<string, number>>();
                    const regions = byCountry.get(country) ?? new Map<string, number>();

                    if (location?.region)
                    {
                        regions.set(location.region, (regions.get(location.region) ?? 0) + 1);
                    }

                    byCountry.set(country, regions);
                    placesOf.set(current, byCountry);
                }

                current = parentOf.get(current);
            }
        }
    }

    for (const [name, unitFacts] of facts)
    {
        unitFacts.genera = [ ...(generaOf.get(name) ?? new Map<string, number>()) ]
            .map(([genusName, species]) => ({ name: genusName, species, notable: genera[genusName]?.notable_specimens?.length ?? 0 }));

        const total = (regions: Map<string, number>): number => [ ...regions.values() ].reduce((sum, count) => sum + count, 0) || 1;

        unitFacts.places = [ ...(placesOf.get(name) ?? new Map<string, Map<string, number>>()) ]
            .sort(([firstCountry, first], [secondCountry, second]) => total(second) - total(first) || firstCountry.localeCompare(secondCountry))
            .map(([country, regions]) => ({
                country,
                regions: [ ...regions ].sort(([firstRegion, first], [secondRegion, second]) => second - first || firstRegion.localeCompare(secondRegion)).map(([region]) => region),
            }));
    }

    return facts;
}

/**
 * Publishes the stratigraphic registry keyed by unit name, each bed as an
 * entry of its own with its containing unit as `parent`, so that any of a
 * location's `group`, `formation`, `member` and `bed` values looks up the
 * same way.
 *
 * @param stages - The stage table keyed by stage name.
 * @returns The units in name order.
 */
function publishStratigraphy(stages: Record<string, StageInfo>): Record<string, PublishedUnit>
{
    const units = loadStratigraphyRegistry(root).units;
    const facts = collectUnitFacts(units);
    const published: Array<[string, PublishedUnit]> = [ ];

    for (const unit of Object.values(units))
    {
        published.push([unit.name, publishUnit(unit, unit.rank, unit.parent, stages, facts.get(unit.name)!)]);

        for (const bed of unit.beds ?? [ ])
        {
            published.push([bed.name, publishUnit(bed, "bed", unit.name, stages, facts.get(bed.name)!)]);
        }
    }

    return Object.fromEntries(published.sort(([first], [second]) => first.localeCompare(second)));
}

const stratigraphy = publishStratigraphy(stageTable);

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
        ...(plateModel
            ? { paleogeography: { model: plateModel.model, citation: plateModel.citation, license: plateModel.license } }
            : { }),
        schema_version: "4.7.0",
        version,
    },
    // The chart named in the header of schema.yml's stage table; change both
    // together.
    timescale: {
        chart: "ICS International Chronostratigraphic Chart v2024/12",
        stages: stageTable,
    },
    tree,
    clades,
    genera,
    stratigraphy,
};

fs.writeFileSync(
    path.join(dist, "open-paleo.json"),
    JSON.stringify(dataset, null, 2) + "\n");

fs.writeFileSync(
    path.join(dist, "open-paleo.yml"),
    stringifyYaml(dataset, { lineWidth: 0 }));

const topKey = Object.keys(tree)[0];
const newick = `(${convertToNewick(tree[topKey] as TreeNode)})${topKey};`;

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

/**
 * Escapes a field value for BibTeX. A brace in a value unbalances the entry,
 * a "%" comments out the rest of its line, and "&", "#", "_" and "$" are
 * LaTeX special characters that stop typesetting when the field is printed.
 *
 * @param value - The raw field value.
 * @returns The value with each special character backslash-escaped.
 */
function escapeBibText(value: string | number): string
{
    return String(value).replace(
        /[\\{}%&#_$]/g,
        (character) => (character === "\\" ? "\\textbackslash{}" : `\\${character}`));
}

/**
 * Chooses the BibTeX entry type for a store reference. A thesis takes its
 * type from the degree; otherwise a `journal` makes an article, a `book` a
 * chapter, and a work with neither is a book when it names a publisher and a
 * miscellaneous item when it does not.
 *
 * @param reference - The store reference to classify.
 * @returns The BibTeX entry type, without the leading "@".
 */
function chooseBibEntryType(reference: Reference): string
{
    if (reference.thesis === "doctoral" || reference.thesis === "habilitation")
    {
        return "phdthesis";
    }
    else if (reference.thesis === "masters")
    {
        return "mastersthesis";
    }
    else if (reference.thesis === "dissertation-abstract")
    {
        return "misc";
    }
    else if (reference.journal)
    {
        return "article";
    }
    else if (reference.book)
    {
        return "incollection";
    }
    else if (reference.publisher)
    {
        return "book";
    }

    return "misc";
}

for (const reference of [...referenceStore.values()].sort((first, second) => (first.id ?? "").localeCompare(second.id ?? "")))
{
    const entryType = chooseBibEntryType(reference);
    const fields = new Array<string>();

    if (reference.authors)
    {
        fields.push(`  author = {${escapeBibText(reference.authors)}}`);
    }

    if (reference.year)
    {
        fields.push(`  year = {${escapeBibText(reference.year)}}`);
    }

    if (reference.title)
    {
        fields.push(`  title = {${escapeBibText(reference.title)}}`);
    }

    if (reference.journal)
    {
        fields.push(`  journal = {${escapeBibText(reference.journal)}}`);
    }

    if (reference.book)
    {
        fields.push(`  booktitle = {${escapeBibText(reference.book)}}`);
    }

    if (reference.school && (entryType === "phdthesis" || entryType === "mastersthesis"))
    {
        fields.push(`  school = {${escapeBibText(reference.school)}}`);
    }

    if (reference.thesis === "habilitation")
    {
        fields.push("  type = {Habilitation thesis}");
    }
    else if (reference.thesis === "dissertation-abstract")
    {
        // @misc has no school field, so the awarding institution travels in
        // howpublished alongside the kind of work.
        const institution = reference.school ? `, ${escapeBibText(reference.school)}` : "";

        fields.push(`  howpublished = {Dissertation abstract${institution}}`);
    }

    if (reference.publisher && (entryType === "book" || entryType === "incollection"))
    {
        fields.push(`  publisher = {${escapeBibText(reference.publisher)}}`);
    }

    if (reference.volume)
    {
        fields.push(`  volume = {${escapeBibText(reference.volume)}}`);
    }

    if (reference.issue)
    {
        fields.push(`  number = {${escapeBibText(reference.issue)}}`);
    }

    if (reference.series)
    {
        fields.push(`  series = {${escapeBibText(reference.series)}}`);
    }

    if (reference.article_number)
    {
        fields.push(`  eid = {${escapeBibText(reference.article_number)}}`);
    }

    if (reference.pages)
    {
        fields.push(`  pages = {${escapeBibText(reference.pages)}}`);
    }

    if (reference.isbn)
    {
        fields.push(`  isbn = {${escapeBibText(reference.isbn)}}`);
    }

    // doi and url are read verbatim by BibTeX styles, so they are not escaped.
    if (reference.doi)
    {
        fields.push(`  doi = {${reference.doi}}`);
    }

    if (reference.url)
    {
        fields.push(`  url = {${reference.url}}`);
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
