# Changelog

All notable changes to the Open Paleo dataset are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project uses [calendar versioning](https://calver.org/) (YYYY.MM).

## [Unreleased]

Initial public release, establishing the v1 output schema.

### Added
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

### Changed
- Locked the v1 output schema (#1965): the species type-specimen block is
  `type_specimen` (holds holotype/syntype/lectotype/neotype; its `specimen_type`
  names the category); reference `volume`/`issue` and identifier `id` are always
  strings; reference keys are uniformly `<surname><year><letter>`. Removed unused
  fields (`media`, `image_types`, institution `campus`) and migrated all clade
  authorities to `erected_in`.
