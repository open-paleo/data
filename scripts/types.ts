// Open Paleo — Shared Type Definitions
// Property names use snake_case to match the YAML file keys.

/**
 * An institution entry in the registry, keyed by canonical abbreviation.
 */
export type InstitutionEntry = {
    /**
     * Full English name of the institution.
     */
    name: string;

    /**
     * Geographic location of the institution.
     */
    location?: {
        /**
         * ISO 3166-1 alpha-2 country code.
         */
        country?: string;

        /**
         * City where the institution is located.
         */
        city?: string;

        /**
         * Campus or building, when disambiguation is needed.
         */
        campus?: string;
    };

    /**
     * Alternative abbreviation codes that resolve to this canonical key.
     */
    aliases?: Array<string>;
};

/**
 * Type-specimen information for a species. The block is named `holotype`
 * for historical reasons but also holds syntype, lectotype, and neotype
 * series — see `specimen_type`.
 */
export type Holotype = {
    /**
     * Catalogue numbers comprising the type material (e.g. ["FMNH PR 2081"]).
     * Always an array with at least one element; consumers never branch on
     * string-vs-array. For holotype/lectotype/neotype this is usually a
     * single entry but may hold multiple when one individual was catalogued
     * across a numbered range (each element accessioned separately). For
     * syntype series it holds all members.
     */
    specimen_id?: Array<string>;

    /**
     * Primary nomenclatural type category. Required whenever this block is
     * present. Allowed values come from `schema.yml` under `specimen_types`
     * ("holotype", "syntype", "lectotype", "neotype", "unknown").
     */
    specimen_type?: string;

    /**
     * Institution or collection housing the specimen (e.g. "Field Museum").
     */
    institution?: string;

    /**
     * Anatomical material preserved in the type specimen(s) (e.g. "Nearly complete skeleton").
     */
    material?: string;

    /**
     * Physical state of the specimen when it is no longer intact at the recorded
     * institution. Absence implies the specimen is presumed intact. Allowed values
     * come from `schema.yml` under `holotype_status` (e.g. "destroyed", "lost",
     * "unknown"). When set, `institution` should record the last-known repository.
     */
    status?: string;

    /**
     * Completeness level of the type specimen as preserved. Allowed values
     * come from `schema.yml` under `completeness` ("complete", "partial",
     * "fragmentary"). Distinct from `Species.completeness`, which aggregates
     * holotype plus referred material.
     */
    completeness?: string;

    /**
     * Free-text curatorial notes about the type specimen that do not fit the
     * structured fields above. Use for nuance the `status` enum cannot capture
     * (e.g. partial destruction, surviving casts, neotype designation history,
     * field-designation history).
     */
    notes?: string;
};

/**
 * A curated highlight of NON-type material for a genus — a famous,
 * most-complete, or otherwise scientifically or culturally significant
 * specimen. This is a hand-picked highlights list, not an exhaustive record
 * of referred material. The type specimen itself lives in `Species.holotype`,
 * never here.
 */
export type NotableSpecimen = {
    /**
     * Informal name the specimen is known by (e.g. "Sue", "Stan", "Big Al").
     */
    nickname?: string;

    /**
     * Catalogue number(s) of the specimen, one per array element (never a
     * compressed "X to Y" range). Optional — a specimen may be known only by
     * nickname.
     */
    specimen_id?: Array<string>;

    /**
     * Institution or collection housing the specimen, as a key in
     * institutions.yaml. Required when `specimen_id` is present unless `status`
     * records the specimen as lost/destroyed/uncatalogued; when set on a
     * no-longer-intact specimen it records the last-known repository.
     */
    institution?: string;

    /**
     * Physical state when the specimen is no longer intact at the recorded
     * institution. Allowed values come from `schema.yml` under `holotype_status`
     * ("destroyed", "lost", "uncatalogued", "unknown").
     */
    status?: string;

    /**
     * Species the specimen is referred to (a binomial matching a `Species.name`
     * in this genus). Optional — omit when the referral is uncertain.
     */
    species?: string;

    /**
     * Why the specimen is notable, from `schema.yml` under
     * `specimen_categories` (e.g. "most-complete", "exceptional-preservation").
     */
    category?: string;

    /**
     * Required free-text explanation of why this specimen matters. Plain text,
     * American English, no markup. The per-specimen reason lives here, not on
     * the cited reference's notes.
     */
    significance: string;

    /**
     * Discovery details, when known. Both sub-fields are optional — a specimen
     * may be notable without a recorded discovery date or discoverer.
     */
    discovered?: {
        /**
         * Year the specimen was discovered.
         */
        year?: number;

        /**
         * Person or team credited with the discovery.
         */
        by?: string;
    };

    /**
     * Reference IDs (in this file's `references`) of the paper(s) describing or
     * referring the specimen. Pointers only. A specimen may be documented by
     * more than one paper (e.g. one describing the skeleton, another a notable
     * feature).
     */
    references?: Array<string>;
};

/**
 * Geological time period and stage for a species occurrence.
 */
export type Period = {
    /**
     * Broad geological period name(s) (e.g. ["Late Cretaceous"]).
     * Multiple values indicate the taxon spans more than one period.
     */
    name?: Array<string>;

    /**
     * Geological stage(s) within the period (e.g. ["Maastrichtian"]).
     * Multiple values indicate the taxon spans more than one stage.
     */
    stage?: Array<string>;

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
 * A numeric range with minimum and maximum bounds.
 * When the value is a single known estimate, min and max are equal.
 */
export type SizeRange = {
    min: number;
    max: number;
};

/**
 * Physical size measurements for a species.
 * Each measurement is a range with min/max bounds.
 */
export type Size = {
    /**
     * Total body length in meters.
     */
    length_m?: SizeRange;

    /**
     * Body mass in kilograms.
     */
    weight_kg?: SizeRange;

    /**
     * Height at the hip in meters.
     */
    hip_height_m?: SizeRange;

    /**
     * Skull length in meters.
     */
    skull_length_m?: SizeRange;
};

/**
 * A taxonomic synonym — a name that refers to the same taxon under a different designation.
 */
export type Synonym = {
    /**
     * The synonymized name (genus or binomial).
     */
    name: string;

    /**
     * The type of synonymy from the controlled vocabulary in schema.yml.
     */
    type: string;

    /**
     * A concise explanation of why this name is a synonym.
     */
    reason?: string;
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
     * Fossil completeness level for the species as a whole, aggregating the
     * holotype and any referred material. Use `Holotype.completeness` for the
     * type specimen alone. Allowed values come from `schema.yml` under
     * `completeness` ("complete", "partial", "fragmentary").
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
     * Year the species was described. DERIVED during build from the
     * `erected_in` reference — it must NOT appear in source YAML (enforced by
     * the Species authority validation check).
     */
    described?: number;

    /**
     * Author(s) of the species. DERIVED during build from the `erected_in`
     * reference — it must NOT appear in source YAML (enforced by the Species
     * authority validation check).
     */
    authors?: string;

    /**
     * Prose description of the species.
     */
    description?: string;

    /**
     * Names that are synonyms of this species.
     */
    synonyms?: Array<Synonym>;

    /**
     * Technical anatomical features that distinguish this species from
     * other species within the same genus. Reserved for *intra-genus*
     * differentia — typically presented in the describing paper for a
     * non-type species as "differs from G. typeSpecies in...". The
     * type species's autapomorphies (i.e. the diagnosis of the genus
     * as originally erected) belong on the genus-level
     * `diagnostic_features` field instead.
     */
    diagnostic_features?: Array<string>;

    /**
     * Reference ID (in this file's references) of the nomenclatural act that
     * established the current genus+species combination — the taxonomic
     * authority for the species. The species author and year are derived from
     * this reference.
     */
    erected_in?: string;

    /**
     * Reference ID (in this file's references) of the authoritative paper the
     * holotype material and diagnosis are drawn from — the original
     * description or a later redescription. Falls back to `erected_in` when
     * omitted.
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
 * A formal ICZN ruling affecting a genus's nomenclature (e.g. a
 * plenary-power designation of the type species). Genus-scoped.
 */
export type IcznRuling = {
    /**
     * The kind of ruling, from schema.yml `iczn_ruling_types`
     * (e.g. "type-species", "name-conservation").
     */
    type?: string;

    /**
     * Reference ID (in this file's references) of the published Opinion that
     * issued the ruling.
     */
    ruling?: string;

    /**
     * Reference ID (in this file's references) of the Case / application that
     * petitioned for the ruling, when cited.
     */
    petition?: string;

    /**
     * Plain-text explanation of what the ruling did and why.
     */
    notes?: string;
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
     * Brief account of any active scientific disagreement over the genus
     * (validity, synonymy, placement). Distinct from `description`: the
     * description reads like a Wikipedia intro, while this field captures
     * the disputed status as a UI-renderable callout, plus a dated decision
     * history. Only set when the taxon's status is contested in the literature.
     */
    dispute?: Dispute;

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
    paleoenvironment?: Array<string>;

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
     * Names that are synonyms of this genus.
     */
    synonyms?: Array<Synonym>;

    /**
     * Species belonging to this genus.
     */
    species?: Array<Species>;

    /**
     * Curated highlights of notable non-type specimens (famous skeletons,
     * most-complete material, soft-tissue finds). Hand-picked and optional —
     * not an exhaustive referred-material list. The type specimen lives under
     * the relevant species's `holotype`, not here.
     */
    notable_specimens?: Array<NotableSpecimen>;

    /**
     * Published references cited in this genus file.
     */
    references?: Array<Reference>;

    /**
     * Reference ID (in this file's references) of the paper that erected this
     * genus — the genus authority. Set ONLY when it differs from the type
     * species's `erected_in` (e.g. when an ICZN ruling later replaced the
     * original type species). When omitted, the genus authority is the type
     * species's `erected_in`.
     */
    erected_in?: string;

    /**
     * Formal ICZN rulings affecting this genus's nomenclature (e.g. a
     * plenary-power type-species designation).
     */
    iczn_rulings?: Array<IcznRuling>;

    /**
     * Year the genus was erected. DERIVED during build from the genus
     * authority (the genus-level `erected_in` override, else the type
     * species's `erected_in`). Not present in source YAML.
     */
    described?: number;

    /**
     * Author(s) who erected the genus. DERIVED during build from the genus
     * authority (see `described`). Not present in source YAML.
     */
    authors?: string;

    /**
     * Media items associated with this genus (photos, reconstructions).
     */
    media?: Array<unknown>;
};

/**
 * A placement/identity dispute and its dated decision history. The structured
 * form (vs. a bare string) lets a later pass find when a placement was last
 * reviewed and on what basis. Used on both genus YAMLs and clade files.
 */
export type Dispute = {
    /**
     * Current state of the disagreement, as a UI-renderable callout.
     */
    summary: string;

    /**
     * Dated record of placement/identity decisions, oldest first.
     */
    history?: Array<{
        /**
         * ISO date (YYYY-MM-DD) of the decision.
         */
        date: string;

        /**
         * What was decided and why (source + governing rule).
         */
        note: string;
    }>;
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

    /**
     * Active disagreement over this clade's placement (or content), with dated
     * decision history. Set only when the clade's position is contested.
     */
    dispute?: Dispute;
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
     * Allowed taxonomic status values (e.g. "valid", "nomen dubium", "disputed").
     */
    status?: Array<string>;

    /**
     * Allowed synonym type values (e.g. "junior", "preoccupied", "reassigned").
     */
    synonym_types?: Array<string>;

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
     * Allowed holotype physical-status values (e.g. "destroyed", "lost",
     * "unknown"). Applied to `species.holotype.status`.
     */
    holotype_status?: Array<string>;

    /**
     * Allowed type-specimen categories (e.g. "holotype", "syntype",
     * "lectotype", "neotype", "unknown"). Applied to
     * `species.holotype.specimen_type`.
     */
    specimen_types?: Array<string>;

    /**
     * Allowed reasons a non-type specimen is notable. Applied to
     * `notable_specimens[].category`.
     */
    specimen_categories?: Array<string>;

    /**
     * Allowed kinds of ICZN ruling (applied to `iczn_rulings[].type`).
     */
    iczn_ruling_types?: Array<string>;

    /**
     * Allowed integument types.
     */
    integument?: Array<string>;

    /**
     * Allowed integument evidence categories.
     */
    integument_evidence?: Array<string>;

    /**
     * Allowed appearance.features tags, grouped by body region. The set of
     * valid tags is the union of all groups; a tag's body region is the
     * group key it appears under (used for optional UI grouping).
     */
    appearance_features?: Record<string, Array<string>>;

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
     * Allowed country codes (ISO 3166-1 alpha-2) mapped to display names.
     */
    countries?: Record<string, string>;
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

/**
 * A community-added flagged publication source that is not currently on
 * Beall's list but has raised concerns in the paleontology community.
 */
export type FlaggedAddition = {
    /**
     * The publisher or journal name as it appears in reference fields.
     */
    name: string;

    /**
     * Human-readable justification for including this source.
     */
    reason?: string;

    /**
     * For journals: the publisher that owns this title, if applicable.
     */
    publisher?: string;
};

/**
 * Top-level structure for flagged-sources.yml. Names in `beall` are
 * mirrored from https://beallslist.net/ (filtered to paleontology-
 * adjacent domains); names in `open_paleo_additions` are curated locally.
 */
export type FlaggedSources = {
    /**
     * Publishers flagged for reviewer verification.
     */
    publishers?: {
        beall?: Array<string>;
        open_paleo_additions?: Array<FlaggedAddition>;
    };

    /**
     * Journals flagged for reviewer verification.
     */
    journals?: {
        beall?: Array<string>;
        open_paleo_additions?: Array<FlaggedAddition>;
    };
};

/**
 * A maintainer's verification of a single flagged-source reference, recorded
 * in flagged-signoffs.yml and keyed there by reference id. A `verified: true`
 * entry suppresses that reference's flagged-source validator warning.
 */
export type FlaggedSignoff = {
    /**
     * Whether the reference has been verified; only `true` suppresses the
     * flagged-source warning.
     */
    verified?: boolean;

    /**
     * Citation count recorded at the `checked` date (from OpenAlex/Crossref),
     * or null when the paper has no indexed citation-database record.
     */
    cited_by?: number | null;

    /**
     * ISO date (YYYY-MM-DD) on which the verification was performed.
     */
    checked?: string;

    /**
     * One-line justification for the sign-off.
     */
    rationale?: string;
};

/**
 * The flagged-source sign-off registry (flagged-signoffs.yml): a map of
 * reference id to its verification record.
 */
export type FlaggedSignoffs = Record<string, FlaggedSignoff>;
