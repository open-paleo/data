// Open Paleo — Shared Type Definitions
// Property names use snake_case to match the YAML file keys as parsed by js-yaml.

/**
 * Holotype specimen information for a species.
 */
export type Holotype = {
    /**
     * Catalogue number of the holotype specimen (e.g. "FMNH PR 2081").
     */
    specimen_id?: string;

    /**
     * Institution or collection housing the specimen (e.g. "Field Museum").
     */
    institution?: string;

    /**
     * Anatomical material preserved in the holotype (e.g. "Nearly complete skeleton").
     */
    material?: string;
};

/**
 * Geological time period and stage for a species occurrence.
 */
export type Period = {
    /**
     * Broad geological period name (e.g. "Cretaceous", "Jurassic").
     */
    name?: string;

    /**
     * Geological stage within the period (e.g. "Maastrichtian").
     */
    stage?: string;

    /**
     * Start of the date range in millions of years ago. Must be >= to_ma.
     */
    from_ma?: number;

    /**
     * End of the date range in millions of years ago. Must be <= from_ma.
     */
    to_ma?: number;
};

/**
 * Geographic discovery location for a species.
 */
export type Location = {
    /**
     * Country where the specimen was found.
     */
    country?: string;

    /**
     * State, province, or administrative region.
     */
    region?: string;

    /**
     * Specific locality or site name.
     */
    locality?: string;

    /**
     * Geological formation from which the specimen was recovered.
     */
    formation?: string;

    /**
     * Geographic coordinates as [latitude, longitude] in decimal degrees.
     */
    coordinates?: [number, number];
};

/**
 * Physical size measurements for a species.
 */
export type Size = {
    /**
     * Total body length in meters.
     */
    length_m?: number;

    /**
     * Estimated body mass in kilograms.
     */
    weight_kg?: number;

    /**
     * Height at the hip in meters.
     */
    hip_height_m?: number;

    /**
     * Skull length in meters.
     */
    skull_length_m?: number;

    /**
     * Whether the measurements are estimates rather than direct measurements.
     */
    estimate?: boolean;
};

/**
 * A species within a genus, including taxonomy, discovery, and physical data.
 */
export type Species = {
    /**
     * Binomial species epithet (e.g. "S. rex").
     */
    name?: string;

    /**
     * Taxonomic status from the controlled vocabulary in schema.yml.
     */
    status?: string;

    /**
     * Whether this is the type species for the genus. Exactly one per genus.
     */
    type_species?: boolean;

    /**
     * Fossil completeness level from the controlled vocabulary in schema.yml.
     */
    completeness?: string;

    /**
     * Origin and meaning of the species name.
     */
    etymology?: string;

    /**
     * Holotype specimen information.
     */
    holotype?: Holotype;

    /**
     * Geological time period and stage.
     */
    period?: Period;

    /**
     * Geographic discovery location.
     */
    location?: Location;

    /**
     * Physical size measurements.
     */
    size?: Size;

    /**
     * Year the species was formally described.
     */
    described?: number;

    /**
     * Author(s) who described the species. May be a single string or an array.
     */
    authors?: string | Array<string>;

    /**
     * Prose description of the species.
     */
    description?: string;

    /**
     * If status is "synonym", the valid species name this is a synonym of.
     */
    synonym_of?: string;

    /**
     * Reference ID (from the genus references list) of the describing paper.
     */
    described_in?: string;
};

/**
 * External appearance and integument information for a genus.
 */
export type Appearance = {
    /**
     * Body covering type from the controlled vocabulary in schema.yml.
     */
    integument?: string;

    /**
     * Nature of the evidence for the integument (e.g. "direct", "phylogenetic inference").
     */
    evidence?: string;

    /**
     * Notable appearance features (e.g. "cranial crest", "tail club").
     */
    features?: Array<string>;
};

/**
 * Cross-reference identifier linking to an external database.
 */
export type Identifier = {
    /**
     * Database or source name from the controlled vocabulary in schema.yml.
     */
    source?: string;

    /**
     * Identifier value within the source database.
     */
    id?: string | number;
};

/**
 * A published scientific reference backing taxonomic data.
 */
export type Reference = {
    /**
     * Short citation key used to link from described_in fields (e.g. "osborn1905").
     */
    id?: string;

    /**
     * Author list, typically "Surname, Initial; Surname, Initial" format.
     */
    authors?: string;

    /**
     * Year of publication.
     */
    year?: number;

    /**
     * Title of the paper or chapter.
     */
    title?: string;

    /**
     * Journal name, if published in a journal.
     */
    journal?: string;

    /**
     * Book title, if published as a book chapter.
     */
    book?: string;

    /**
     * Publisher name, if applicable.
     */
    publisher?: string;

    /**
     * Volume number of the journal or series.
     */
    volume?: string | number;

    /**
     * Issue number within the volume.
     */
    issue?: string | number;

    /**
     * Page range (e.g. "1-65").
     */
    pages?: string;

    /**
     * Digital Object Identifier.
     */
    doi?: string;

    /**
     * International Standard Book Number.
     */
    isbn?: string;

    /**
     * URL for online access.
     */
    url?: string;

    /**
     * Additional notes about the reference.
     */
    notes?: string;
};

/**
 * Pronunciation guide for a genus name, providing both IPA
 * (International Phonetic Alphabet) and informal phonetic notation.
 */
export type Pronunciation = {
    /**
     * IPA transcription (e.g. "/taɪˌrænəˈsɔːrəs/").
     */
    ipa?: string;

    /**
     * Informal phonetic spelling (e.g. "tie-RAN-oh-SOR-us").
     */
    phonetic?: string;
};

/**
 * Top-level data structure for a genus YAML file.
 */
export type GenusData = {
    /**
     * Genus name (must match the filename).
     */
    genus?: string;

    /**
     * Parent clade in tree.yml where this genus is placed.
     */
    parent?: string;

    /**
     * Origin and meaning of the genus name.
     */
    etymology?: string;

    /**
     * Pronunciation guide for the genus name.
     */
    pronunciation?: Pronunciation;

    /**
     * Prose description of the genus for a general audience.
     */
    description?: string;

    /**
     * Dietary category from the controlled vocabulary in schema.yml.
     */
    diet?: string;

    /**
     * Locomotion type from the controlled vocabulary in schema.yml.
     */
    locomotion?: string;

    /**
     * Paleoenvironment(s) from the controlled vocabulary in schema.yml.
     */
    paleoenvironment?: string | Array<string>;

    /**
     * External appearance and integument data.
     */
    appearance?: Appearance;

    /**
     * Technical anatomical features that distinguish this genus.
     */
    diagnostic_features?: Array<string>;

    /**
     * Cross-references to external databases (e.g. PBDB, Wikipedia).
     */
    identifiers?: Array<Identifier>;

    /**
     * Species belonging to this genus.
     */
    species?: Array<Species>;

    /**
     * Published references cited in this genus file.
     */
    references?: Array<Reference>;

    /**
     * Year the genus was formally described.
     */
    described?: number;

    /**
     * Author(s) who described the genus.
     */
    authors?: string;

    /**
     * Reference ID of the paper that first described this genus.
     */
    described_in?: string;

    /**
     * Media items associated with this genus (photos, reconstructions).
     */
    media?: Array<unknown>;
};

/**
 * Top-level data structure for a clade YAML file.
 */
export type CladeData = {
    /**
     * Clade name (must match the filename and a node in tree.yml).
     */
    clade?: string;

    /**
     * Prose description of the clade.
     */
    description?: string;

    /**
     * Year the clade was formally named or defined.
     */
    described?: number;

    /**
     * Author(s) who named or defined the clade.
     */
    authors?: string;

    /**
     * Technical anatomical features that define membership in this clade.
     */
    diagnostic_features?: Array<string>;

    /**
     * Published references cited in this clade file.
     */
    references?: Array<Reference>;
};

/**
 * Geological stage definition from schema.yml.
 */
export type StageInfo = {
    /**
     * Parent geological period (e.g. "Cretaceous").
     */
    period: string;

    /**
     * Start of the stage in millions of years ago.
     */
    from_ma: number;

    /**
     * End of the stage in millions of years ago.
     */
    to_ma: number;
};

/**
 * Controlled vocabularies and allowed values loaded from schema.yml.
 */
export type Schema = {
    /**
     * Allowed taxonomic status values (e.g. "valid", "synonym", "disputed").
     */
    status?: Array<string>;

    /**
     * Allowed diet categories.
     */
    diet?: Array<string>;

    /**
     * Allowed locomotion types.
     */
    locomotion?: Array<string>;

    /**
     * Allowed fossil completeness levels.
     */
    completeness?: Array<string>;

    /**
     * Allowed integument types.
     */
    integument?: Array<string>;

    /**
     * Allowed integument evidence categories.
     */
    integument_evidence?: Array<string>;

    /**
     * Allowed paleoenvironment values.
     */
    paleoenvironments?: Array<string>;

    /**
     * Allowed external identifier sources.
     */
    identifier_sources?: Array<string>;

    /**
     * Allowed image type categories.
     */
    image_types?: Array<string>;

    /**
     * Allowed geological period names.
     */
    periods?: Array<string>;

    /**
     * Geological stage definitions keyed by stage name.
     */
    stages?: Record<string, StageInfo>;

    /**
     * Allowed country names for location validation.
     */
    countries?: Array<string>;
};

/**
 * Recursive tree node representing a clade in the phylogenetic hierarchy.
 * Keys are clade names; values are either child TreeNodes or empty objects
 * (leaf clades with no sub-clades defined).
 */
export type TreeNode = {
    [clade: string]: TreeNode | Record<string, never>;
};

/**
 * A single validation error or warning produced during data validation.
 */
export type ValidationMessage = {
    /**
     * Name of the validation check that produced this message.
     */
    check: string;

    /**
     * Relative file path that triggered the message, or "(global)".
     */
    file: string;

    /**
     * Human-readable description of the problem.
     */
    message: string;
};

/**
 * Aggregate error and warning counts for a single validation check.
 */
export type CheckResult = {
    /**
     * Number of errors found by this check.
     */
    errors: number;

    /**
     * Number of warnings found by this check.
     */
    warnings: number;
};
