# Open Paleo

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

A community-maintained, version-controlled phylogenetic dataset for paleontology.

## Overview

Open Paleo is an open science project that builds a structured, machine-readable dataset of paleontological taxonomy. The tree is rooted at **Life**, broad enough to accommodate any fossil taxon — from dinosaurs to trilobites to ammonites. Initial data focuses on non-avian dinosaurs, with higher-level clades serving as scaffolding that will be populated over time as contributors from other specializations join.

All taxonomic data is backed by published scientific literature. The dataset is curated through structured contribution workflows, validated by automated tooling, and published in multiple output formats for downstream use.

### Why does this exist?

Paleontological taxonomy is scattered across thousands of papers, books, and databases, each with different formats, levels of completeness, and update cadences. Open Paleo brings this information into a single, version-controlled, openly licensed dataset that anyone can use, cite, and contribute to.

## Why Open Paleo instead of PBDB?

The [Paleobiology Database](https://paleobiodb.org/) (PBDB) is an established,
NSF-funded resource with over 1.6 million fossil occurrence records spanning
all of geological time. It is an invaluable tool for quantitative
paleobiology research, and if your work involves occurrence-level data,
stratigraphic analysis, or large-scale biodiversity studies, you should
absolutely use it — we link to PBDB identifiers in our own data via the
`identifiers` field, and cite PBDB-sourced references throughout.

Open Paleo exists because it solves a different problem:

- **Phylogenetic tree as a first-class output.** PBDB stores taxonomic
  hierarchy and opinions but does not export curated phylogenetic trees.
  Open Paleo's `tree.yml` is the central data structure, and every build
  produces Newick and NEXUS files ready for tree visualization software.

- **Lightweight, developer-friendly formats.** Open Paleo is a set of
  YAML files in a Git repository — no server, no database, no API key.
  The build produces clean JSON, YAML, Newick, NEXUS, and BibTeX files
  that anyone can drop into a web app, museum kiosk, or classroom
  project without writing API integration code.

- **Curated quality over volume.** PBDB prioritizes comprehensive
  coverage; Open Paleo prioritizes validated, consistent data. Every
  field is checked by automated validation against controlled
  vocabularies before it can be merged.

- **Low barrier to contribution.** Anyone with a GitHub account can
  contribute by opening a pull request. No institutional affiliation or
  registration required.

- **Taxonomy-focused.** PBDB's core data model is the fossil
  *occurrence* — a specific find at a specific place and time. Open
  Paleo's core data model is the *taxon* — a genus, its species, their
  relationships, and what we know about them. These are complementary
  views of the same organisms.

**A note on currency:** Because Open Paleo maintains a single curated
tree rather than a dynamic opinion-based system, we are deliberately
conservative about adopting taxonomic *revisions* — reclassifications,
synonymizations, splits, and recombinations are not reflected until
there is broad consensus in the paleontological community. Newly
described taxa are different: a validly named new genus or species on
adequate, uncontested material is added on its own merits, even if
recent. This keeps the dataset stable and reliable for downstream
consumers — lagging the cutting edge on contested rearrangements by a
few years, while still recording genuinely new animals promptly. See
[CONTRIBUTING.md](CONTRIBUTING.md#taxonomic-disputes-and-consensus)
for the full policy.

In short: if you need occurrence data for quantitative research, use
PBDB. If you need a curated phylogenetic dataset in developer-friendly
formats, or want to build educational tools, visualizations, or apps on
top of clean taxonomic data, Open Paleo is designed for that.

## Quick Start

### Using the data

Clone the repository:

```bash
git clone https://github.com/open-paleo/data.git
```

The `dist/` directory holds the ready-to-use output files. A workflow rebuilds and commits them on every push to `main`, so `main` always carries outputs that match its data.

Tagged releases will be published on the [Releases](https://github.com/open-paleo/data/releases) page, named by calendar version (`YYYY.MM`, the `_metadata.version` in the built output). Until the first release, pull from `main`.

## Repository Structure

```
open-paleo/
  README.md                 # This file
  CONTRIBUTING.md           # Contribution guidelines
  CODE_OF_CONDUCT.md        # Community standards
  CONTRIBUTORS.md           # List of contributors
  CHANGELOG.md              # Release history
  CITATION.cff              # Machine-readable citation metadata
  CLAUDE.md                 # Instructions for Claude Code sessions working in this repository
  schema.yml                # Controlled vocabularies and allowed values
  tree.yml                  # Clade hierarchy — single source of truth for phylogenetic structure
  institutions.yaml         # Registry of museums and institutions housing type specimens
  regions.yaml              # ISO 3166-2 subdivision codes and their English names
  excluded.yml              # Genera ruled out of the dataset, with the reason for each
  flagged-sources.yml       # Publishers and journals requiring reviewer verification
  flagged-signoffs.yml      # Maintainer sign-offs on individual references from flagged sources
  cspell.json               # Spell-check configuration
  clades/                   # One YAML file per clade (e.g., Dinosauria.yml)
  genera/                   # One YAML file per genus, organized alphabetically (e.g., genera/T/Tyrannosaurus.yml)
  references/               # Canonical reference store (references/<letter>/<key>.yml)
  stratigraphy/             # Registry of lithostratigraphic units (stratigraphy/<letter>/<unit>.yml)
  research/                 # Research notes: the reasoning behind record values
  schemas/                  # JSON Schema source describing the built dataset
  media/                    # Planned: images (specimen photos, reconstructions, skeletal diagrams)
  dist/                     # Built outputs (JSON, YAML, JSON Schema, Newick, NEXUS, BibTeX; typed bindings under dist/bindings/)
  docs/                     # Versioning and stability policy
  scripts/                  # Validation, build, and automation scripts
  dictionaries/             # Spell-check dictionaries: taxonomy.txt is generated, the other lists are curated
  scratch/                  # Generated reports and working files (gitignored, never committed)
  .claude/                  # Claude Code skills for the maintainer intake and audit workflows
  .github/                  # Workflows and CODEOWNERS
```

## Data Format

### Genus files (`genera/`)

Each genus has its own YAML file containing taxonomy, species, physical characteristics, discovery information, description, and references. All data is backed by published literature.

### Clade files (`clades/`)

Each clade has a YAML file with its name, description, defining characteristics, and references. Clades represent the internal nodes of the phylogenetic tree.

### `tree.yml`

The single source of truth for phylogenetic structure. Defines the parent-child relationships between all clades, from Life down to the family or subfamily level. Genera are placed within this tree via their `parent` field.

### `schema.yml`

Defines all controlled vocabularies used across the dataset: taxonomic status values, synonym types, diet categories, locomotion types, specimen types, appearance features, paleoenvironments, geological periods and stages, countries, completeness levels, and more. The validation script enforces these constraints.

### Reference store (`references/`)

One YAML file per cited work, at `references/<letter>/<key>.yml`, holding its full bibliographic details. Records cite works by key with an `{id, notes?}` pointer, and the build inflates each pointer into a full reference block in the output. See [CONTRIBUTING.md](CONTRIBUTING.md#reference-keys-and-years) for how keys and years are assigned.

### Stratigraphic registry (`stratigraphy/`)

One file per lithostratigraphic unit (group, formation, member, or bed) that a record's `location` names, giving the unit's rank, its containing unit, alternate names, and its age as the union of what the cited sources publish. The validator resolves every unit a record names against the registry and checks the record's age against the unit's. See [CONTRIBUTING.md](CONTRIBUTING.md#stratigraphic-registry).

### Research notes (`research/`)

The reasoning behind record values: what the sources say, where they conflict, which reading was adopted, and which readings were considered and rejected. A record's note sits at its data path under `research/`, with `.md` in place of `.yml`, and `npm run research -- <record path>` prints every note that bears on a record. See [research/README.md](research/README.md).

### `institutions.yaml`

A structured registry of museums, universities, and other institutions that hold type specimens. Each entry is keyed by a canonical abbreviation (e.g. `AMNH` for the American Museum of Natural History) and carries the institution's full name, location, and any alternate abbreviations seen in the literature. Genus files reference institutions by key in their `type_specimen.institution` field; the build resolves keys to display names, and the validator rejects references to unknown keys. This eliminates the ambiguity that arises when the same museum appears under half a dozen different spellings across papers.

### `regions.yaml`

Every ISO 3166-2 subdivision code with its English name. A record's `location.region` stores the code, and the build publishes both the code (`region_code`) and the name (`region`).

### `excluded.yml`

Genera deliberately left out of the dataset — for example, names never validly published, or taxa whose material cannot be shown to be dinosaurian — each with the reason and the supporting references, so the same candidate is not re-proposed without new evidence.

### `flagged-sources.yml`

A list of publishers and journals whose citations warrant additional reviewer scrutiny — predatory or borderline-predatory sources where individual papers may still be sound but a second look is warranted. The list mirrors [Beall's List](https://beallslist.net/) (filtered to paleontology-adjacent domains) with a small number of community-added sources. When a contribution cites a flagged publisher or journal, the validator emits a warning and the CI workflow posts a sticky pull-request comment asking the reviewer to sign off on the citation before merge. Citations are **never auto-rejected** — the goal is informed review, not blanket blocking. A maintainer who has verified a citation from independent evidence records it in `flagged-signoffs.yml`, which clears that reference's warning. See [CONTRIBUTING.md](CONTRIBUTING.md#flagged-publication-sources) for the policy and the process for proposing additions or removals.

### Data stability and versioning

The **source YAML** under `genera/`, `clades/`, and `references/` is an
editing format. Its layout may change between releases — treat it as internal.

The **built outputs** in `dist/` are the stable, versioned contract. Build
against `dist/open-paleo.json` or `dist/open-paleo.yml`, and validate against
`dist/open-paleo.schema.json`. The output shape is versioned by
`_metadata.schema_version` using semantic versioning: a **major** bump signals
a breaking change to the output, a **minor** bump adds a field or vocabulary
value (existing consumers keep working), and a **patch** is a documentation or
derivation fix. See [docs/VERSIONING.md](docs/VERSIONING.md) for the full
policy.

Typed bindings generated from the schema ship in
[`dist/bindings/`](dist/bindings/): TypeScript declarations (`open-paleo.d.ts`)
and Python Pydantic v2 models (`open_paleo.py`). They are regenerated whenever
the schema changes, so they always match the current contract.

## Output Formats

The build script (`scripts/build.ts`) produces the following output files in `dist/`:

| Format   | Description |
|----------|-------------|
| **JSON** | Complete dataset as structured JSON, suitable for APIs and web applications |
| **YAML** | Complete dataset as a single YAML file |
| **Newick** | Phylogenetic tree in Newick notation, compatible with tree visualization software |
| **NEXUS** | Phylogenetic tree in NEXUS format, compatible with phylogenetic analysis tools |
| **BibTeX** | All references in BibTeX format, for use in academic papers and citation managers |
| **JSON Schema** | `open-paleo.schema.json` — a JSON Schema (2020-12) describing the JSON/YAML output, for validating consumers and generating typed bindings |

## Contributing

We welcome contributions from paleontologists, enthusiasts, and anyone interested in open science. All contributions must be backed by published scientific literature.

To contribute, open a pull request that edits the YAML data files directly. Every change is checked by automated validation (`npm run validate`) before it can be merged.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines, scientific rigor requirements, and quality standards.

## Citing Open Paleo

If you use Open Paleo data in research, publications, or any other
work, please cite it. This helps the project demonstrate its impact
and encourages continued contributions.

### Recommended citation

> Open Paleo contributors. (2026). *Open Paleo: A community-maintained
> phylogenetic dataset for paleontology* [Dataset].
> https://github.com/open-paleo/data

### Citing a specific version

Each tagged release, named by calendar version (`YYYY.MM`), will be a snapshot of the dataset at a point in time. For reproducibility, cite the specific version you used. It is the `_metadata.version` in `dist/open-paleo.json`:

> Open Paleo contributors. (2026). *Open Paleo* (Version 2026.10)
> [Dataset]. https://github.com/open-paleo/data

If a DOI is available for the release (via Zenodo), use that instead
of the GitHub URL — DOIs are permanent and resolve even if the
repository moves.

### BibTeX

```bibtex
@misc{openpaleo,
  author       = {{Open Paleo contributors}},
  title        = {Open Paleo: A community-maintained phylogenetic
                  dataset for paleontology},
  year         = {2026},
  publisher    = {GitHub},
  url          = {https://github.com/open-paleo/data},
  note         = {Version 2026.10}
}
```

### Citing the underlying references

Open Paleo data is backed by published scientific literature. Each
build includes a `dist/references.bib` file containing every reference
in the dataset, deduplicated and formatted as BibTeX. If your work
draws on Open Paleo data, consider including `references.bib` as
supplementary material so the original researchers receive proper
credit.

### Machine-readable citation

This repository includes a [`CITATION.cff`](CITATION.cff) file. GitHub
renders this as a "Cite this repository" button on the repository page,
and tools like Zotero can import it directly.

## Development

To run the tooling locally:

```bash
# Clone the repository
git clone https://github.com/open-paleo/data.git
cd data

# Install dependencies
npm install

# Validate all data files against the schema and tree
npm run validate

# Spell-check prose fields (report written to scratch/spellcheck.md)
npm run spellcheck

# Build output files (JSON, YAML, Newick, NEXUS, BibTeX)
npm run build

# Print the research notes for a record before working on it
npm run research -- genera/T/Tyrannosaurus.yml
```

Pull requests run `npm run typecheck`, `npm run lint`, `npm run validate` and `npm run spellcheck`; all four must pass. The last two are the ones a data change can fail.

Requires **Node.js 24** or later. Scripts are written in TypeScript
and run directly via Node's native type stripping — no build step
needed. See [scripts/CONTRIBUTING.md](scripts/CONTRIBUTING.md) for
code style guidelines.

## AI and LLM Use

Open Paleo uses AI and LLM tools (currently Claude, by Anthropic) as research and editing tools. They help sift a large corpus of published papers: finding the passages that bear on a record, extracting candidate values such as type specimens and diagnoses, checking records against their sources, and drafting edits to the repository's files. They were also used to write the validation and build scripts and the GitHub workflows.

**The editor is responsible for every change, not the tool.** An LLM may draft an edit, but the person who commits it answers for it. "The model wrote that" is never an excuse for an error.

**Nothing comes from a model's training data.** An LLM's recall of the literature is not a source. Every value and every claim in the dataset must trace to published scientific literature, and the editor must have checked it against the cited source; a citation the editor has not confirmed says what the record claims does not count. A specialist may of course write from their own knowledge of the field, but what they write carries a citation to the literature all the same. This applies equally to maintainers and to outside contributors using their own tools.

Commits made with LLM assistance say so in a `Co-Authored-By` trailer, so the history shows which changes were drafted with a tool.

**AI-generated art is not accepted.** Extracted text can be checked against the paper it came from; a life reconstruction is interpretive work by an artist, and there is no source to check it against. Open Paleo values the skill, scientific knowledge, and judgment that paleo-artists bring to that work, and does not accept AI-generated, AI-assisted, or AI-upscaled images. See [Image Requirements](CONTRIBUTING.md#image-requirements) for details.

## License

This work is licensed under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt this data for any purpose, including commercial use, as long as you provide appropriate attribution.

**Attribution:** Open Paleo contributors

## Code of Conduct

This project follows the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) with project-specific additions. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.
