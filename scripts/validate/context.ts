// Loads everything the checks read: the schema, tree and registries, every
// genus, clade, store and stratigraphy file, and the values several checks
// share.

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse as parseYamlContent } from "yaml";

import type {
    CladeData,
    GenusData,
    Reference,
    Schema,
    Species,
    StageInfo,
    TreeNode,
} from "../types.ts";
import {
    buildFlaggedSet,
    buildVerifiedSet,
    collectAllKeys,
    findYamlFiles,
    loadFlaggedSignoffs,
    loadFlaggedSources,
    loadStratigraphyRegistry,
    stageOrdering,
} from "../utilities.ts";
import { walkStrings } from "./walk.ts";

/**
 * Loads the data and registries the checks read.
 *
 * @returns The loaded context.
 */
export function loadValidationContext()
{
    const scriptPath = url.fileURLToPath(import.meta.url);

    const scriptDir = path.dirname(scriptPath);

    const root = path.join(scriptDir, "..", "..");

    /**
     * Determines which tree clades have at least one member genus somewhere in
     * their subtree, accumulating the populated clade names into `populated`.
     *
     * A clade counts as populated when it is the direct `parent:` of some genus,
     * or when any of its descendant clades is populated. Every child is visited
     * so the accumulator is filled for the whole tree, not just the first hit.
     *
     * @param node - The tree node (map of child clade name to subtree) to inspect.
     * @param name - The clade name of `node`, or null at the tree root.
     * @param genusParents - The set of every `parent:` value across all genera.
     * @param populated - Accumulator set of populated clade names.
     * @returns True when `node`'s subtree contains at least one member genus.
     */
    function collectPopulatedClades(node: TreeNode | null, name: string | null, genusParents: Set<string>, populated: Set<string>): boolean
    {
        let hasGenus = name !== null && genusParents.has(name);

        if (node && typeof node === "object")
        {
            for (const key of Object.keys(node))
            {
                const childPopulated = collectPopulatedClades(node[key], key, genusParents, populated);
                if (childPopulated)
                {
                    hasGenus = true;
                }
            }
        }

        if (hasGenus && name !== null)
        {
            populated.add(name);
        }

        return hasGenus;
    }

    /**
     * Loads and parses a YAML file, exiting the process on failure.
     *
     * @param filePath - Absolute path to the YAML file.
     * @param label - Human-readable label for error messages.
     * @returns The parsed YAML content cast to type T.
     */
    function loadYamlFatal<T>(filePath: string, label: string): T
    {
        try
        {
            return parseYamlContent(fs.readFileSync(filePath, "utf8")) as T;
        }
        catch (error: unknown)
        {
            const message = error instanceof Error ? error.message : String(error);

            console.error(`Fatal: cannot load ${label} — ${message}`);

            process.exit(2);
        }
    }

    const schema = loadYamlFatal<Schema>(path.join(root, "schema.yml"), "schema.yml");

    const tree = loadYamlFatal<TreeNode>(path.join(root, "tree.yml"), "tree.yml");

    const treeClades = new Set(collectAllKeys(tree));

    const allowedStatus = new Set(schema.status ?? []);

    const allowedPlacement = new Set(schema.placement ?? []);

    const allowedDiet = new Set(schema.diet ?? []);

    const allowedLocomotion = new Set(schema.locomotion ?? []);

    const allowedCompleteness = new Set(schema.completeness ?? []);

    const allowedHolotypeStatus = new Set(schema.holotype_status ?? []);

    const allowedSpecimenTypes = new Set(schema.specimen_types ?? []);

    const allowedFormerIdReasons = new Set(schema.former_id_reasons ?? []);

    const allowedThesisTypes = new Set(schema.thesis_types ?? []);

    const allowedSpecimenCategories = new Set(schema.specimen_categories ?? []);

    const allowedIcznCaseTypes = new Set(schema.iczn_case_types ?? []);

    const allowedIcznCaseStatuses = new Set(schema.iczn_case_statuses ?? []);

    const allowedIntegument = new Set(schema.integument ?? []);

    const allowedIntegumentEvidence = new Set(schema.integument_evidence ?? []);

    const allowedFeatures = new Set(Object.values(schema.appearance_features ?? {}).flat());

    const allowedPaleoenvironments = new Set(schema.paleoenvironments ?? []);

    const allowedSynonymTypes = new Set(schema.synonym_types ?? []);

    const allowedIdentifierSources = new Set(schema.identifier_sources ?? []);

    const allowedCountries = new Set(Object.keys(schema.countries ?? {}));

    const allowedPeriods = new Set(schema.periods ?? []);

    const stages: Record<string, StageInfo> = schema.stages ?? {};

    // Every stage oldest first, by its base age, and each stage's place in that
    // order, so a list of stages can be checked for order and gaps.
    const { order: stageOrder, position: stagePosition } = stageOrdering(stages);

    const institutionRegistry = parseYamlContent(
        fs.readFileSync(path.join(root, "institutions.yaml"), "utf8"),
    ) as Record<string, unknown>;

    const allowedInstitutionKeys = new Set(Object.keys(institutionRegistry));

    const regionRegistry = parseYamlContent(
        fs.readFileSync(path.join(root, "regions.yaml"), "utf8"),
    ) as Record<string, string>;

    const allowedRegionCodes = new Set(Object.keys(regionRegistry));

    // The stratigraphic registry: one file per unit under stratigraphy/<letter>/,
    // the same layout the reference store uses. A record names a unit by its
    // headword or by any spelling in `variants`, so both are needed to resolve one.
    // Each data file is read and parsed once here, and the checks that need its
    // raw text or its whole document later take them from these maps instead of
    // reading the file again.
    const dataFileTexts = new Map<string, string>();

    // Every successfully parsed genus, clade, store and stratigraphy document, by
    // path. A file that failed to parse is absent.
    const parsedDocuments = new Map<string, unknown>();

    /**
     * Reads a data file's text, from disk the first time and from
     * `dataFileTexts` after that.
     *
     * @param filePath - The file to read.
     * @returns The file's UTF-8 text.
     */
    function readDataFile(filePath: string): string
    {
        let text = dataFileTexts.get(filePath);

        if (text === undefined)
        {
            text = fs.readFileSync(filePath, "utf8");
            dataFileTexts.set(filePath, text);
        }

        return text;
    }

    /**
     * Parses a data file through `readDataFile` and records the document in
     * `parsedDocuments`. A parse error propagates to the caller.
     *
     * @param filePath - The file to parse.
     * @returns The parsed document.
     */
    function parseDataFile(filePath: string): unknown
    {
        const document = parseYamlContent(readDataFile(filePath)) as unknown;

        parsedDocuments.set(filePath, document);

        return document;
    }

    const stratigraphyDirectory = path.join(root, "stratigraphy");

    // Layout problems found while loading are reported by their own check below,
    // because checkError needs a check to be open before it can record one.
    const {
        units: stratigraphy,
        files: stratigraphyFiles,
        unitByName,
        bedsByParent,
        entries: registryEntries,
        layoutProblems: stratigraphyLayout,
    } = loadStratigraphyRegistry(root, parseDataFile);

    /**
     * The file a unit was read from, for reporting.
     *
     * @param unitName - The unit's name.
     * @returns Its file path, falling back to the registry directory.
     */
    function stratigraphyFile(unitName: string): string
    {
        return stratigraphyFiles.get(unitName) ?? stratigraphyDirectory;
    }

    const flaggedSources = loadFlaggedSources(path.join(root, "flagged-sources.yml"));

    const flaggedPublishers = buildFlaggedSet(flaggedSources.publishers);

    const flaggedJournals = buildFlaggedSet(flaggedSources.journals);

    const verifiedReferenceIds = buildVerifiedSet(loadFlaggedSignoffs(path.join(root, "flagged-signoffs.yml")));

    // The canonical reference store: references/<letter>/<id>.yml, one file per
    // reference. Bibliographic fields live here; per-occurrence notes stay on the
    // in-file `{id, notes?}` pointers. Parsed once and shared across the reference
    // checks below.
    const referenceStoreFiles = findYamlFiles(path.join(root, "references"));

    const referenceStoreParsed = new Map<string, Reference | null>();

    const referenceStoreById = new Map<string, Reference>();

    for (const filePath of referenceStoreFiles)
    {
        try
        {
            const entry = parseDataFile(filePath) as Reference;
            referenceStoreParsed.set(filePath, entry);

            if (entry && entry.id && !referenceStoreById.has(entry.id))
            {
                referenceStoreById.set(entry.id, entry);
            }
        }
        catch
        {
            referenceStoreParsed.set(filePath, null);
        }
    }

    const referenceStoreIds = new Set(referenceStoreById.keys());

    const genusFiles = findYamlFiles(path.join(root, "genera"));
    const genusParsed = new Map<string, GenusData>();
    const cladeFiles = findYamlFiles(path.join(root, "clades"));
    const cladeParsed = new Map<string, CladeData>();

    // Genus and clade files that do not parse. The YAML syntax check reports
    // them; every other check reads only the files that parsed.
    const yamlSyntaxProblems: Array<[string, string]> = [];

    /**
     * Parses one genus or clade file, recording a parse error instead of
     * throwing it.
     *
     * @param filePath - The file to parse.
     * @returns The parsed document, or undefined when it does not parse.
     */
    function parseRecord(filePath: string): unknown
    {
        try
        {
            return parseDataFile(filePath);
        }
        catch (error: unknown)
        {
            yamlSyntaxProblems.push([filePath, `YAML parse error: ${error instanceof Error ? error.message : String(error)}`]);

            return undefined;
        }
    }

    for (const filePath of genusFiles)
    {
        const document = parseRecord(filePath);

        if (document !== undefined)
        {
            genusParsed.set(filePath, document as GenusData);
        }
    }

    for (const filePath of cladeFiles)
    {
        const document = parseRecord(filePath);

        if (document !== undefined)
        {
            cladeParsed.set(filePath, document as CladeData);
        }
    }

    // Scaffolding clades that don't need clade files
    const scaffoldingClades = new Set([
        "Life", "Animalia", "Arthropoda", "Trilobita", "Mollusca", "Cephalopoda",
        "Ammonoidea", "Chordata", "Vertebrata", "Actinopterygii", "Sarcopterygii",
        "Tetrapoda", "Synapsida", "Reptilia", "Lepidosauria", "Ichthyosauria",
        "Sauropterygia", "Plesiosauria", "Archosauria", "Pterosauria",
        "Crocodylomorpha", "Plantae",
    ]);

    const outsideUnitResolutions = new Set([ "reworked", "horizon" ]);

    const referencesDirectory = path.join(root, "references");

    const allParsed: Array<[string, GenusData | CladeData]> = [
        ...genusParsed.entries(),
        ...cladeParsed.entries(),
    ];

    /**
     * Finds the finest registry unit a record names, with the epochs and stages it
     * carries. A bed is looked for among the beds of the record's member,
     * formation and group, nearest first, then as a standing entry; otherwise the
     * member, formation and group are tried in turn.
     *
     * @param location - The record's location block.
     * @returns The unit's label, epochs and stages, or undefined when the record
     *     names no registry unit.
     */
    function recordUnit(location: Species["location"]): { label: string; periods: Array<string>; stages: Array<string> } | undefined
    {
        const containers = (["member", "formation", "group"] as const)
            .map((field) => location?.[field])
            .filter((value): value is string => typeof value === "string")
            .map((value) => unitByName.get(value))
            .filter((unitName): unitName is string => unitName !== undefined);
        const bedName = location?.bed;

        if (typeof bedName === "string")
        {
            for (const unitName of containers)
            {
                const bed = bedsByParent.get(unitName)?.get(bedName);

                if (bed)
                {
                    return { label: `${unitName} › ${bed.name}`, periods: bed.period ?? [], stages: bed.stages ?? [] };
                }
            }

            const standing = unitByName.get(bedName);

            if (standing !== undefined && stratigraphy[standing]?.rank === "bed")
            {
                return { label: standing, periods: stratigraphy[standing]?.period ?? [], stages: stratigraphy[standing]?.stages ?? [] };
            }
        }

        const unitName = containers[0];

        return unitName === undefined
            ? undefined
            : { label: unitName, periods: stratigraphy[unitName]?.period ?? [], stages: stratigraphy[unitName]?.stages ?? [] };
    }

    // Prose-field traversal, shared by checks 24, 25 and 26.
    //
    // One walk reaches every editorial prose field in the dataset, so a prose
    // field added to a record — or a registry that gains a `notes:` — is picked
    // up by all three prose checks at once. The alternative, a hand-written list
    // of field paths per check, is what left `type_specimen.notes`,
    // `former_ids[].notes`, `iczn_cases[].notes` and whole registries
    // unchecked, and let the two lists drift apart from each other.
    //
    // Prose is identified by the name of the key holding the string, not by its
    // path: `notes` is prose wherever it appears, `specimen_id` never is. Array
    // elements inherit the key of the array they sit in
    // (`diagnostic_features[3]`). Keys absent from this set hold identifiers,
    // catalogue numbers, enum values, taxon names and place names — none of them
    // ours to restyle.
    const proseKeys = new Set([
        "description",
        "diagnostic_features",
        "etymology",
        "material",
        "note",
        "notes",
        "reason",
        "significance",
        "summary",
    ]);

    type ProseField = {
        filePath: string;
        fieldPath: string;
        text: string;
    };

    /**
     * Recursively collects every prose field under one parsed YAML value.
     *
     * @param node - The value to inspect (object, array, or scalar).
     * @param filePath - Absolute path of the file `node` was parsed from.
     * @param fieldPath - Dotted path describing `node`'s location in that file.
     * @param key - Name of the key holding `node`, or null at the document root.
     * @param collected - Accumulator the matching fields are appended to.
     */
    function collectProseFields(node: unknown, filePath: string, fieldPath: string, key: string | null, collected: Array<ProseField>): void
    {
        walkStrings(node, (text, textKey, trail) =>
        {
            if (textKey !== null && proseKeys.has(textKey))
            {
                collected.push({ filePath, fieldPath: trail, text });
            }
        }, {}, fieldPath, key);
    }

    const proseFields: Array<ProseField> = [];

    for (const [filePath, doc] of allParsed)
    {
        collectProseFields(doc, filePath, "", null, proseFields);
    }

    for (const [filePath, entry] of referenceStoreParsed)
    {
        collectProseFields(entry, filePath, "", null, proseFields);
    }

    // The registries are keyed by institution code and region code, so each
    // top-level entry is walked under its own key rather than from the document
    // root. `regions.yaml` maps a code straight to a string and has no prose
    // today; walking it anyway means a `notes:` added there needs no change here.
    const registrySources: Array<[string, Record<string, unknown>]> = [
        [path.join(root, "institutions.yaml"), institutionRegistry],
        [path.join(root, "regions.yaml"), regionRegistry as unknown as Record<string, unknown>],
    ];

    // The registry is walked separately: each unit is its own file, so the prose
    // findings point at that file rather than at one path shared by 532 entries.
    for (const [unitName, unit] of Object.entries(stratigraphy))
    {
        collectProseFields(unit, stratigraphyFile(unitName), unitName, null, proseFields);
    }

    for (const [filePath, registry] of registrySources)
    {
        for (const [entryKey, entry] of Object.entries(registry ?? {}))
        {
            collectProseFields(entry, filePath, entryKey, null, proseFields);
        }
    }

    /**
     * Removes double-quoted spans from a prose field. Text quoted verbatim from
     * a source is not ours to restyle — its spelling and its citation form are
     * the source's — so the American English and Citation format checks run on
     * what is left. Each span becomes a space so the words on either side cannot
     * join into a match that is in neither of them. An unpaired quote is left
     * alone, since there is no span to bound.
     *
     * @param text - The field's string value.
     * @returns The text with every quoted span replaced by a space.
     */
    function stripQuotedSpans(text: string): string
    {
        return text.replace(/"[^"]*"/g, " ");
    }

    const sensuQualifier = /\s+sensu\s+/i;

    return {
        scriptPath,
        scriptDir,
        root,
        collectPopulatedClades,
        loadYamlFatal,
        schema,
        tree,
        treeClades,
        allowedStatus,
        allowedPlacement,
        allowedDiet,
        allowedLocomotion,
        allowedCompleteness,
        allowedHolotypeStatus,
        allowedSpecimenTypes,
        allowedFormerIdReasons,
        allowedThesisTypes,
        allowedSpecimenCategories,
        allowedIcznCaseTypes,
        allowedIcznCaseStatuses,
        allowedIntegument,
        allowedIntegumentEvidence,
        allowedFeatures,
        allowedPaleoenvironments,
        allowedSynonymTypes,
        allowedIdentifierSources,
        allowedCountries,
        allowedPeriods,
        stages,
        stageOrder,
        stagePosition,
        institutionRegistry,
        allowedInstitutionKeys,
        regionRegistry,
        allowedRegionCodes,
        dataFileTexts,
        parsedDocuments,
        readDataFile,
        parseDataFile,
        stratigraphyDirectory,
        stratigraphy,
        stratigraphyFiles,
        unitByName,
        bedsByParent,
        registryEntries,
        stratigraphyLayout,
        stratigraphyFile,
        flaggedSources,
        flaggedPublishers,
        flaggedJournals,
        verifiedReferenceIds,
        referenceStoreFiles,
        referenceStoreParsed,
        referenceStoreById,
        referenceStoreIds,
        genusFiles,
        genusParsed,
        cladeFiles,
        cladeParsed,
        yamlSyntaxProblems,
        scaffoldingClades,
        outsideUnitResolutions,
        referencesDirectory,
        allParsed,
        recordUnit,
        proseKeys,
        collectProseFields,
        proseFields,
        registrySources,
        stripQuotedSpans,
        sensuQualifier,
    };
}

/**
 * Everything `loadValidationContext` loads.
 */
export type ValidationContext = ReturnType<typeof loadValidationContext>;
