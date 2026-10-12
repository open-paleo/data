// The extraction JSON the intake and update-genus agents write, stated once.
// Each type has a field table that the prompt builders render into the
// prompt's schema block. A table's type requires exactly the extraction's
// fields, so adding a field to one without the other fails the type check.

/**
 * Shape of one per-paper extraction JSON written by the genus intake agent.
 */
export type IntakeExtraction = {
    genus: string;
    citation_key: string;
    is_describing: boolean;
    type_species?: string | null;
    etymology_genus?: string | null;
    etymology_species?: string | null;
    pronunciation_ipa?: string | null;
    pronunciation_phonetic?: string | null;
    holotype_specimen_id?: string | null;
    holotype_institution?: string | null;
    holotype_specimen_type?: string | null;
    holotype_material?: string | null;
    diagnostic_features?: Array<string>;
    paleoenvironment?: Array<string>;
    synonyms?: Array<{ name: string; type: string; reason: string }>;
    locomotion?: string | null;
    integument?: string | null;
    size_length_m_min?: number | null;
    size_length_m_max?: number | null;
    size_weight_kg_min?: number | null;
    size_weight_kg_max?: number | null;
    binomial_in_paper?: string | null;
    paper_quality?: string;
    status_assessment?: string | null;
    status_quote?: string | null;
    notes?: string | null;
    empty?: boolean;
};
/**
 * Shape of one per-paper extraction JSON written by the species intake agent.
 */
export type SpeciesExtraction = {
    genus: string;
    species: string;
    citation_key: string;
    is_describing: boolean;
    binomial_in_paper?: string | null;
    etymology_species?: string | null;
    holotype_specimen_id?: string | null;
    holotype_institution?: string | null;
    holotype_specimen_type?: string | null;
    holotype_material?: string | null;
    diagnostic_features?: Array<string>;
    paleoenvironment?: Array<string>;
    period_name?: Array<string>;
    period_stage?: Array<string>;
    period_from_ma?: number | null;
    period_to_ma?: number | null;
    location_country?: string | null;
    location_region?: string | null;
    location_formation?: string | null;
    location_locality?: string | null;
    location_coordinates?: Array<number> | null;
    size_length_m_min?: number | null;
    size_length_m_max?: number | null;
    size_weight_kg_min?: number | null;
    size_weight_kg_max?: number | null;
    described_year?: number | null;
    described_authors?: string | null;
    synonyms?: Array<{ name: string; type: string; reason: string }>;
    paper_quality?: string;
    status_assessment?: string | null;
    status_quote?: string | null;
    notes?: string | null;
    empty?: boolean;
};
/**
 * Shape of one extraction JSON written by the update-genus agent.
 */
export type PaperFieldExtraction = {
    genus: string;
    species: string;
    described_in: string;
    holotype_material: string | null;
    diagnostic_features: Array<string>;
    binomial_in_paper: string | null;
    paper_quality: string;
    notes: string | null;
};
/**
 * For each field of an extraction other than the ones the prompt fills in
 * itself, the value the prompt shows the agent: its type and what to put
 * there, as JSON text. `{taxon}` stands for the genus or binomial.
 */
type FieldTable<Extraction, Fixed extends keyof Extraction> = {
    [Field in Exclude<keyof Extraction, Fixed | "empty">]-?: string;
};

/**
 * The genus intake extraction's fields, in prompt order.
 */
export const intakeExtractionFields: FieldTable<IntakeExtraction, "genus" | "citation_key" | "is_describing"> = {
    type_species: "\"binomial as it appears in the paper, or null\"",
    etymology_genus: "\"string|null — concise (~150 chars) etymology of the genus name\"",
    etymology_species: "\"string|null — concise etymology of the specific epithet\"",
    pronunciation_ipa: "\"string|null — IPA pronunciation including the leading and trailing slashes (e.g. \\\"/ˌbrɒntoʊˈθoʊləs/\\\"). Only fill in if the paper explicitly gives an IPA transcription.\"",
    pronunciation_phonetic: "\"string|null — informal phonetic respelling guide (e.g. \\\"BRON-toh-THOH-luhs\\\"). Only fill in if the paper explicitly gives one.\"",
    holotype_specimen_id: "\"string|null — single catalog number, e.g. \\\"ZPAL MgD-I/108\\\"\"",
    holotype_institution: "\"string|null — full institution name or known abbreviation\"",
    holotype_specimen_type: "\"holotype|syntype|lectotype|neotype|null\"",
    holotype_material: "\"string|null — concise (≤200 chars) anatomical inventory from the paper, drop catalog numbers from the prose\"",
    diagnostic_features: "[\"3-6 standalone autapomorphy bullets ≤200 chars each, NO comparative-only bullets, NO clade-shared traits\"]",
    paleoenvironment: "[\"zero or more values from this exact enum (others will fail validation): fluvial, lacustrine, coastal, deltaic, arid, forested, wetland, marine, polar. Map paludal/swamp/marsh → wetland; estuarine/lagoonal → coastal; eolian/desert → arid.\"]",
    synonyms: "[{\"name\": \"string\", \"type\": \"junior subjective|junior objective|preoccupied|nomen nudum|nomen rejectum|informal\", \"reason\": \"string\"}]",
    locomotion: "\"bipedal|quadrupedal|facultative|null\"",
    integument: "\"feathered|armored|scaled|null\"",
    size_length_m_min: "\"number|null\"",
    size_length_m_max: "\"number|null\"",
    size_weight_kg_min: "\"number|null\"",
    size_weight_kg_max: "\"number|null\"",
    binomial_in_paper: "\"string|null (only if differs from above)\"",
    paper_quality: "\"primary|review|popular|translation|other\"",
    status_assessment: "\"valid|nomen dubium|nomen nudum|disputed|not stated — the position THIS paper takes on whether {taxon} is a valid genus. Use \\\"not stated\\\" unless the paper actually rules on it.\"",
    status_quote: "\"string|null — the paper's verdict QUOTED VERBATIM, sentence(s) copied exactly, no paraphrase. null when status_assessment is \\\"not stated\\\".\"",
    notes: "\"string|null — ≤200 characters. For a supplementary paper this becomes the citation's role note in the dataset, so state what the paper contributes in one sentence. Flag anything unusual.\"",
};

/**
 * The species intake extraction's fields, in prompt order.
 */
export const speciesExtractionFields: FieldTable<SpeciesExtraction, "genus" | "species" | "citation_key" | "is_describing"> = {
    binomial_in_paper: "\"string|null — exact binomial as it appears in the paper, only if it differs from {Genus species}\"",
    etymology_species: "\"string|null — concise (~150 chars) etymology of the specific epithet\"",
    holotype_specimen_id: "\"string|null — single catalog number, e.g. \\\"ZPAL MgD-I/108\\\"\"",
    holotype_institution: "\"string|null — full institution name or known abbreviation\"",
    holotype_specimen_type: "\"holotype|syntype|lectotype|neotype|null\"",
    holotype_material: "\"string|null — concise (≤200 chars) anatomical inventory from the paper; drop catalog numbers from the prose\"",
    diagnostic_features: "[\"3-6 species-level differentia ≤200 chars each. WRITE TIGHT: drop the \\\"differs from G. typeSpecies in...\\\" prefix — the field already lives under the species block and the implicit comparison is to the type species. Comparative phrases like \\\"more prominent\\\" hang off that implicit context. Add a parenthetical with the type-species contrast only when the trait would otherwise read ambiguously (e.g. \\\"Fused parietals (paired in G. typeSpecies)\\\"). NO comparisons against species in OTHER genera. NO clade-shared traits.\"]",
    paleoenvironment: "[\"zero or more values from this exact enum (others will fail validation): fluvial, lacustrine, coastal, deltaic, arid, forested, wetland, marine, polar. Map paludal/swamp/marsh → wetland; estuarine/lagoonal → coastal; eolian/desert → arid. Only fill in if the species locality differs from the genus default; otherwise leave empty.\"]",
    period_name: "[\"zero or more of Late Cretaceous, Early Cretaceous, etc. — only when paper specifies\"]",
    period_stage: "[\"zero or more stage names — only when paper specifies\"]",
    period_from_ma: "\"number|null\"",
    period_to_ma: "\"number|null\"",
    location_country: "\"string|null — ISO 3166-1 alpha-2 code preferred\"",
    location_region: "\"string|null — ISO 3166-2 subdivision CODE (e.g. \\\"CN-LN\\\" for Liaoning, \\\"US-MT\\\" for Montana), never the plain name. Leave null rather than guessing a code.\"",
    location_formation: "\"string|null\"",
    location_locality: "\"string|null — quarry, site, hamlet, etc.\"",
    location_coordinates: "\"[lat, lng] | null — decimal degrees, only when the paper gives coordinates\"",
    size_length_m_min: "\"number|null\"",
    size_length_m_max: "\"number|null\"",
    size_weight_kg_min: "\"number|null\"",
    size_weight_kg_max: "\"number|null\"",
    described_year: "\"number|null — year the species was originally erected\"",
    described_authors: "\"string|null — authorship surname(s) for the species erection (e.g. \\\"Penkalski\\\" or \\\"Smith and Jones\\\")\"",
    synonyms: "[{\"name\": \"string\", \"type\": \"junior subjective|junior objective|preoccupied|nomen nudum|nomen rejectum|reassigned|informal\", \"reason\": \"string\"}]",
    paper_quality: "\"primary|review|popular|translation|other\"",
    status_assessment: "\"valid|nomen dubium|nomen nudum|disputed|not stated — the position THIS paper takes on whether {taxon} is a valid species. Use \\\"not stated\\\" unless the paper actually rules on it.\"",
    status_quote: "\"string|null — the paper's verdict QUOTED VERBATIM, sentence(s) copied exactly, no paraphrase. null when status_assessment is \\\"not stated\\\".\"",
    notes: "\"string|null — ≤200 characters. For a supplementary paper this becomes the citation's role note in the dataset, so state what the paper contributes in one sentence. Flag anything unusual, including taxonomy-policy nuance for recombinations.\"",
};

/**
 * The update-genus extraction's fields, in prompt order.
 */
export const paperFieldExtractionFields: FieldTable<PaperFieldExtraction, "genus" | "species" | "described_in"> = {
    holotype_material: "\"string|null (≤200 chars from the paper's Holotype subsection, drop catalog numbers)\"",
    diagnostic_features: "[\"3-6 standalone autapomorphy bullets ≤200 chars each, NO comparative-only bullets, NO clade-shared traits\"]",
    binomial_in_paper: "\"string|null (only if differs from above)\"",
    paper_quality: "\"primary|review|popular|translation|other\"",
    notes: "\"string|null (flag anything unusual)\"",
};

/**
 * Renders an extraction schema as the prompt shows it: one `"key": value`
 * line per field, the fields the prompt fills in first.
 *
 * @param fixed - The fields the prompt fills in, with their values.
 * @param fields - The field table.
 * @param taxon - What `{taxon}` stands for in the table.
 * @returns The schema block's lines, braces included.
 */
export function renderSchemaLines(
    fixed: Record<string, string | boolean>,
    fields: Record<string, string>,
    taxon: string): Array<string>
{
    const entries = [
        ...Object.entries(fixed).map(([key, value]) => `  "${key}": ${JSON.stringify(value)}`),
        ...Object.entries(fields).map(([key, value]) => `  "${key}": ${value.replaceAll("{taxon}", taxon)}`),
    ];

    return ["{", ...entries.map((entry, index) => (index < entries.length - 1 ? `${entry},` : entry)), "}"];
}

/**
 * Renders an extraction schema on one line, as the update-genus prompt
 * shows it.
 *
 * @param fixed - The fields the prompt fills in, with their values.
 * @param fields - The field table.
 * @returns The schema as a single JSON-like line.
 */
export function renderSchemaLine(fixed: Record<string, string | boolean>, fields: Record<string, string>): string
{
    const entries = [
        ...Object.entries(fixed).map(([key, value]) => `"${key}":${JSON.stringify(value)}`),
        ...Object.entries(fields).map(([key, value]) => `"${key}":${value}`),
    ];

    return `{${entries.join(",")}}`;
}
