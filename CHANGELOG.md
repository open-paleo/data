# Changelog

All notable changes to the Open Paleo dataset are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project uses [calendar versioning](https://calver.org/) (YYYY.MM).

## [Unreleased]

### Added
- Initial project structure and tooling
- Schema definition (schema.yml) with controlled vocabularies
- Phylogenetic tree structure (tree.yml) rooted at Life
- 10 seed genera: Tyrannosaurus, Triceratops, Stegosaurus, Brachiosaurus,
  Velociraptor, Diplodocus, Iguanodon, Spinosaurus, Ankylosaurus,
  Parasaurolophus
- 41 clade files covering the Dinosauria subtree
- Validation script (scripts/validate.mjs)
- Build script producing JSON, YAML, Newick, NEXUS, and BibTeX outputs
- GitHub Actions for PR validation, build, and issue processing
- Issue form templates for adding genera, correcting taxonomy, updating
  genera, adding images, and reporting errors
- Spell checking with custom taxonomy dictionary
