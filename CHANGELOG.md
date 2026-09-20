# Changelog

All notable changes to the Open Paleo dataset are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project uses [calendar versioning](https://calver.org/) (YYYY.MM).

## [Unreleased]

Initial public release, establishing the v1 output schema.

### Added
- The stratigraphic registry ([`stratigraphy.yaml`](./stratigraphy.yaml)),
  replacing the earlier `formations.yaml`. Every unit a record names at any
  rank now has an entry giving its rank, containing unit, alternate names,
  age and the papers each value comes from, and the age is the union of what
  those papers publish rather than a choice between them. Validation resolves
  every `group`, `formation`, `member` and `bed` on a record against it,
  rejects a unit recorded at a rank the registry contradicts, and holds the
  registry's own prose and citations to the same rules as the rest of the
  dataset.
- `period` on every unit in the stratigraphic registry
  ([`stratigraphy.yaml`](./stratigraphy.yaml)), giving the epoch or epochs
  the unit spans. `stages` now refines `period` rather than standing alone:
  every stage must fall within one of the unit's epochs, and an empty
  `stages` means no source gives the unit's age at stage resolution, not
  that the unit is undated. Validation requires `period` on each unit and
  rejects a stage outside it.
- `semiarid` and `estuarine` in the `paleoenvironment` vocabulary. Output
  schema 1.6.0 → 1.7.0.
- `period.resolution`, distinguishing an age determined for a taxon from one
  that is simply its unit's. `resolution: unit` states that `stage` carries
  the containing lithostratigraphic unit's range rather than a
  determination; absent means the age is finer, or has not been checked.
  Validation rejects `unit` on a record whose stages are not the unit's
  range. Output schema 1.5.0 → 1.6.0.
- `location.notes`, holding provenance caveats on the other location fields
  — material not collected in situ, a locality reconstructed after the fact,
  an unrecorded horizon, or a member deliberately omitted. Not a general
  comment field. Output schema 1.4.0 → 1.5.0.
- `location.group`, holding the lithostratigraphic group containing an
  occurrence. Populated when the group is the finest unit published, in
  which case `formation` is absent. Rank words are not part of the value
  (`group: Yezo`). Ranks resolve through the new
  [`stratigraphy.yaml`](./stratigraphy.yaml) registry, which also records
  variant spellings and the source of each claim. Validation rejects a group
  in `formation`. `part` can now qualify a group. Output schema 1.3.0 → 1.4.0.
- `location.part` and `location.bed`, completing the lithostratigraphic
  hierarchy (group, formation, member, bed). `member` holds a member's name
  only; an informal upper or lower division goes in `part`, which qualifies
  the member where one is present and the formation otherwise. `bed` takes
  published bed names only. Output schema 1.2.0 → 1.3.0.
- `location.region_code`, an ISO 3166-2 subdivision code alongside
  `location.region`. The source YAML stores only the code and the build
  resolves `region` to a readable English name. Codes resolve through the
  new [`regions.yaml`](./regions.yaml) registry; validation rejects a code
  that is unknown or whose country prefix disagrees with `location.country`.
  Countries without subdivisions carry neither field. Output schema
  1.1.0 → 1.2.0.
- `former_ids` on `species.type_specimen` and on `notable_specimens[]`,
  recording the catalogue numbers a specimen was held under before its
  current one. Each entry pairs `from_id` with `to_id` and gives a `reason`
  of `renumbered` or `rehoused`; `rehoused` also records `from_institution`
  and `to_institution`. An optional `source` names the work documenting the
  change. Prefix changes caused by an institution being recoded resolve
  through the aliases in `institutions.yaml` instead. Output schema
  1.0.0 → 1.1.0.
- Structured dataset of 1,300+ genera and 180+ clades, each backed by
  published scientific literature, in a single phylogenetic tree
  (`tree.yml`) rooted at Life.
- Controlled vocabularies (`schema.yml`) enforced by validation across all
  enumerated fields.
- Canonical reference store (`references/<letter>/<key>.yml`) with per-taxon
  authority pointers (`erected_in` / `described_in`); `authors` and
  `described` are derived in the build.
- Institution registry (`institutions.yaml`) resolving type-specimen
  repositories to canonical Sabaj-based codes.
- JSON Schema for the built dataset (`schemas/open-paleo.schema.json`,
  shipped as `dist/open-paleo.schema.json`) for consumer validation and
  typed-binding generation.
- Versioning and stability policy (`docs/VERSIONING.md`): the source YAML is
  an editing format; the `dist/` outputs are the stable,
  `schema_version`-versioned contract.
- Validation (`npm run validate`) and build (`npm run build`) tooling in
  TypeScript, producing JSON, YAML, JSON Schema, Newick, NEXUS, and BibTeX.
- GitHub Actions for PR validation and build; issue-form contribution
  templates; spell checking with a generated taxonomy dictionary.
- `synonyms` block on clade files, mirroring the genus-level convention
  (bare `name` plus a controlled `type` and a `reason`), recording replaced
  or emended family-group names; added the `emended spelling` synonym type
  to the controlled vocabulary.
- Genus-level `placement` field (controlled value `incertae sedis`)
  qualifying how a genus attaches to its `parent` clade. The narrative
  rationale remains in `dispute`.

### Changed
- Repo-wide naming convention: prose is American English, while names take
  the form used by the English-language literature. Institution names stay
  in their native form, non-English reference titles keep the native title
  with a bracketed English gloss, and formation names follow their own
  stratigraphic literature. Documented in
  [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- Locked the v1 output schema: the species type-specimen block is
  `type_specimen`, holding holotype/syntype/lectotype/neotype with its
  `specimen_type` naming the category; reference `volume`/`issue` and
  identifier `id` are always strings; reference keys are uniformly
  `<surname><year><letter>`. Removed the unused `media`, `image_types` and
  institution `campus` fields, and migrated all clade authorities to
  `erected_in`.
