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
  contribute through structured issue forms. No institutional
  affiliation or registration required.

- **Taxonomy-focused.** PBDB's core data model is the fossil
  *occurrence* — a specific find at a specific place and time. Open
  Paleo's core data model is the *taxon* — a genus, its species, their
  relationships, and what we know about them. These are complementary
  views of the same organisms.

**A note on currency:** Because Open Paleo maintains a single curated
tree rather than a dynamic opinion-based system, we are deliberately
conservative about adopting taxonomic changes. New proposals are not
reflected in the dataset until there is broad consensus in the
paleontological community. This makes the dataset stable and reliable
for downstream consumers, even if it lags the cutting edge by a few
years. See [CONTRIBUTING.md](CONTRIBUTING.md#taxonomic-disputes-and-consensus)
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

Or download the latest release from the [Releases](https://github.com/open-paleo/data/releases) page. Each release includes pre-built output files in multiple formats.

The `dist/` directory contains ready-to-use output files after each build. For the latest data between releases, pull from `main` directly.

## Repository Structure

```
open-paleo/
  README.md                 # This file
  CONTRIBUTING.md           # Contribution guidelines
  CODE_OF_CONDUCT.md        # Community standards
  CONTRIBUTORS.md           # List of contributors
  CHANGELOG.md              # Release history
  schema.yml                # Controlled vocabularies and allowed values
  tree.yml                  # Clade hierarchy — single source of truth for phylogenetic structure
  clades/                   # One YAML file per clade (e.g., Dinosauria.yml)
  genera/                   # One YAML file per genus, organized alphabetically (e.g., genera/T/Tyrannosaurus.yml)
  media/                    # Images (specimen photos, reconstructions, skeletal diagrams)
  dist/                     # Built output files (JSON, YAML, Newick, NEXUS, BibTeX)
  scripts/                  # Validation, build, and automation scripts
  dictionaries/             # Auto-generated custom dictionary for spell checking
  .github/                  # Issue templates, workflows, and CODEOWNERS
```

## Data Format

### Genus files (`genera/`)

Each genus has its own YAML file containing taxonomy, species, physical characteristics, discovery information, description, and references. All data is backed by published literature.

### Clade files (`clades/`)

Each clade has a YAML file with its name, description, defining characteristics, and references. Clades represent the internal nodes of the phylogenetic tree.

### `tree.yml`

The single source of truth for phylogenetic structure. Defines the parent-child relationships between all clades, from Life down to the family or subfamily level. Genera are placed within this tree via their `parent_clade` field.

### `schema.yml`

Defines all controlled vocabularies used across the dataset: taxonomic status values, diet categories, locomotion types, geological periods and stages, image types, completeness levels, and more. The validation script enforces these constraints.

## Output Formats

The build script (`scripts/build.ts`) produces the following output files in `dist/`:

| Format   | Description |
|----------|-------------|
| **JSON** | Complete dataset as structured JSON, suitable for APIs and web applications |
| **YAML** | Complete dataset as a single YAML file |
| **Newick** | Phylogenetic tree in Newick notation, compatible with tree visualization software |
| **NEXUS** | Phylogenetic tree in NEXUS format, compatible with phylogenetic analysis tools |
| **BibTeX** | All references in BibTeX format, for use in academic papers and citation managers |

## Contributing

We welcome contributions from paleontologists, enthusiasts, and anyone interested in open science. All contributions must be backed by published scientific literature.

The easiest way to contribute is through the **[contribution wizard](https://open-paleo.github.io/data/)** — a guided web form with searchable dropdowns, field validation, and pre-populated current values for update flows. The wizard builds a pre-filled GitHub issue for you; no special tools required.

You can also use the **[issue forms](https://github.com/open-paleo/data/issues/new/choose)** directly if you prefer.

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

Each tagged release (e.g., `2026.04`) represents a snapshot of the
dataset at a point in time. For reproducibility, cite the specific
version you used:

> Open Paleo contributors. (2026). *Open Paleo* (Version 2026.04)
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
  note         = {Version 2026.04}
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

# Build output files (JSON, YAML, Newick, NEXUS, BibTeX)
npm run build
```

Requires **Node.js 24** or later. Scripts are written in TypeScript
and run directly via Node's native type stripping — no build step
needed. See [scripts/CONTRIBUTING.md](scripts/CONTRIBUTING.md) for
code style guidelines.

## AI and LLM Use

Open Paleo used AI/LLM tools (specifically Claude by Anthropic) to build
the initial project scaffolding — the validation and build scripts,
GitHub workflows, issue templates, and documentation structure. We
believe in transparency about this.

**AI is not used to populate the dataset.** Every genus, species, clade
definition, and reference in Open Paleo is entered and reviewed by
humans, backed by published scientific literature. Automated tooling
validates data quality, but no AI generates or suggests taxonomic
content. The integrity of the dataset depends on human expertise, and
that is not something we are willing to delegate.

**AI-generated art is not accepted.** Open Paleo values the skill,
scientific knowledge, and interpretive judgment that paleo-artists bring
to life reconstructions. We do not accept AI-generated, AI-assisted, or
AI-upscaled images. See [Image Requirements](CONTRIBUTING.md#image-requirements)
for details.

**Environmental impact.** We recognize that AI and LLM usage carries an
environmental cost. We are actively exploring options to offset the
environmental impact of our AI tooling use, and we will update this
section as we identify and adopt concrete measures.

## License

This work is licensed under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt this data for any purpose, including commercial use, as long as you provide appropriate attribution.

**Attribution:** Open Paleo contributors

## Code of Conduct

This project follows the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) with project-specific additions. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.
