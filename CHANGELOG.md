# Changelog

All notable changes to the Open Paleo dataset are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project uses [calendar versioning](https://calver.org/) (YYYY.MM).

## [Unreleased]

Initial public release, establishing the v1 output schema.

### Added
- `location.part` and `location.bed`, completing the lithostratigraphic
  hierarchy (group, formation, member, bed). `member` now holds a member's
  NAME only; an informal upper/lower division goes in `part`, which qualifies
  the member where one is present and the formation otherwise. Previously the
  two were concatenated, which split a single member across several values —
  `Ruby Ranch` and `Upper Ruby Ranch` were different strings, so a consumer
  filtering on the member silently missed half its occurrences. `bed` takes
  published bed names only. Output schema 1.2.0 → 1.3.0.
- `location.region_code`, an ISO 3166-2 subdivision code, alongside the
  existing `location.region`. The source YAML now stores only the code and the
  build resolves it, so `region` continues to carry a readable English name —
  `Bavaria`, not `Bayern` — while consumers gain a joinable key. Codes resolve
  through the new [`regions.yaml`](./regions.yaml) registry, and validation
  rejects a code that is unknown or whose country prefix disagrees with
  `location.country`. Countries without subdivisions (Antarctica) carry
  neither field. Output schema 1.1.0 → 1.2.0.
- `former_ids` on `species.type_specimen` and on `notable_specimens[]`,
  recording the catalogue numbers a specimen was held under before its current
  one. Each entry pairs `from_id` with `to_id` — a specimen that moved twice is
  two entries, so neither end is called "current" — and gives a `reason` of
  `renumbered` (within one institution) or `rehoused` (between institutions,
  which also records `from_institution` and `to_institution`). An optional
  `source` names the work documenting the change. Prefix changes caused by an
  institution being recoded are NOT recorded here; those resolve through the
  aliases in `institutions.yaml`. Output schema 1.0.0 → 1.1.0.
- Structured dataset of 1,300+ genera and 180+ clades, each backed by published
  scientific literature, in a single phylogenetic tree (`tree.yml`) rooted at
  Life.
- Controlled vocabularies (`schema.yml`) enforced by validation across all
  enumerated fields.
- Canonical reference store (`references/<letter>/<key>.yml`) with per-taxon
  authority pointers (`erected_in` / `described_in`); `authors` and `described`
  are derived in the build.
- Institution registry (`institutions.yaml`) resolving type-specimen
  repositories to canonical Sabaj-based codes.
- JSON Schema for the built dataset (`schemas/open-paleo.schema.json`, shipped
  as `dist/open-paleo.schema.json`) for consumer validation and typed-binding
  generation.
- Versioning and stability policy (`docs/VERSIONING.md`): the source YAML is an
  editing format; the `dist/` outputs are the stable, `schema_version`-versioned
  contract.
- Validation (`npm run validate`) and build (`npm run build`) tooling in
  TypeScript, producing JSON, YAML, JSON Schema, Newick, NEXUS, and BibTeX.
- GitHub Actions for PR validation and build; issue-form contribution
  templates; spell checking with a generated taxonomy dictionary.
- `synonyms` block on clade files (#1981), mirroring the genus-level
  convention (bare `name` plus a controlled `type` and a `reason`), to record
  replaced or emended family-group names; added the `emended spelling`
  synonym type to the controlled vocabulary.
- Genus-level `placement` field (controlled value `incertae sedis`) qualifying
  how a genus attaches to its `parent` clade, surfacing a previously
  prose-only signal as a queryable field; backfilled across the genera placed
  at incertae sedis. The narrative rationale remains in `dispute`.

### Changed
- Adopted a repo-wide naming convention: prose is American English, but names
  take whatever form the English-language literature uses, decided by counting
  papers rather than by translating. Institution names therefore stay in their
  native form, non-English reference titles keep the native title with a
  bracketed English gloss, and formation names follow their own stratigraphic
  literature — which, tested across the dataset, means every formation carrying
  a non-English rock-type word keeps it. Documented in
  [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- Locked the v1 output schema (#1965): the species type-specimen block is
  `type_specimen` (holds holotype/syntype/lectotype/neotype; its `specimen_type`
  names the category); reference `volume`/`issue` and identifier `id` are always
  strings; reference keys are uniformly `<surname><year><letter>`. Removed unused
  fields (`media`, `image_types`, institution `campus`) and migrated all clade
  authorities to `erected_in`.
