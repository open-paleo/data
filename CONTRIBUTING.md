# Contributing to Open Paleo

Thank you for your interest in contributing to Open Paleo. This is a community-maintained scientific dataset, and every contribution — whether a new genus, a corrected classification, or a better description — makes the dataset more complete and more useful.

## How to Contribute

To contribute, open a pull request that edits the YAML data files directly. Automated validation checks every change before it can be merged. See the schema and existing entries under `genera/` and `clades/` for the expected shape, and `references/` for the citation store.

## Scientific Rigor

This is a scientific dataset. All taxonomic data must meet the following standards:

- **All data must be backed by published scientific literature.** Every addition or change to taxonomy, species status, or clade definitions must include at least one reference to a peer-reviewed paper, monograph, or established scientific database. Personal opinions, blog posts, and social media are not acceptable sources.
- **Use the most recent consensus where one exists.** When multiple competing phylogenies have been published, prefer the most recent comprehensive analysis. Note the alternatives in the genus or clade file if the placement is actively debated.
- **Mark disputed taxa honestly.** If a species or placement is controversial, use `status: disputed` and document the competing views in the description and references. Do not present one side of an active debate as settled fact.

## Flagged Publication Sources

Open Paleo maintains a list of publishers and journals that warrant additional scrutiny before being cited, stored in [`flagged-sources.yml`](./flagged-sources.yml). The list mirrors the Standalone Publishers and Standalone Journals from [Beall's List](https://beallslist.net/) — filtered to paleontology's scientific neighborhood — plus a small number of community-added sources (e.g. MDPI) that are no longer on Beall's active list but remain contested.

Flagged sources are **not banned**. When a reference cites a flagged publisher or journal, the validator emits a warning and the PR automation posts a comment asking the reviewer to confirm that the specific citation is acceptable (widely cited, peer-reviewed in practice, no red flags in the paper itself). Many individual papers from flagged publishers are perfectly sound — the flag signals "look more carefully," not "reject."

**Proposing additions or removals.** Open a PR that edits `flagged-sources.yml` with a brief justification — link to the relevant Beall's update, community discussion, or retraction notice. Additions to the `open_paleo_additions:` blocks should carry a `reason:` field. Periodic re-syncs with the upstream Beall's List are done manually by maintainers.

## Taxonomic Disputes and Consensus

Open Paleo maintains a single phylogenetic tree. We do not maintain
competing trees or alternative placements within the data itself.

This means we are deliberately conservative about adopting taxonomic
changes. A newly published reclassification, species split, or synonym
proposal is not automatically reflected in the dataset. We wait until
there is **broad consensus in the paleontological community** that the
change is well-supported before updating the tree or changing a
species' status.

In practice this means:

- **A single paper is not enough.** One study proposing a new placement
  does not trigger a change. We look for the proposal to be accepted,
  cited approvingly, or adopted by subsequent phylogenetic analyses
  before updating.
- **Active debates are documented, not resolved.** When a placement is
  genuinely controversial — with credible researchers on both sides —
  we retain the existing placement, use `status: disputed` where
  appropriate, and document the competing views in the description and
  references. The data should describe the state of the field, not
  pick a winner.
- **Corrections to clear errors are fast-tracked.** If a taxon is
  demonstrably misplaced due to a data entry mistake or an outdated
  classification that the field has long since moved past, that can be
  corrected without waiting for new publications.

This policy exists because Open Paleo is a reference dataset, not a
journal. Consumers depend on it being stable and reliable. A tree that
changes with every new preprint is less useful than one that tracks
the settled understanding of the field, even if that understanding
lags the cutting edge by a few years.

If you believe a change has reached consensus and should be reflected
in Open Paleo, submit a [Correct Taxonomy](../../issues/new?template=correct-taxonomy.yml)
issue with references showing community adoption — not just the
original proposal.

## How genera are placed in the tree

Every genus in `genera/` sits at a `parent:` clade that reflects the
**least-inclusive placement the published literature agrees on** — no more
precise than the sources support. The tree was assembled by a systematic,
source-first pass over every genus; the principles below govern both that pass
and any future placement change.

- **Trace every placement to a primary source.** A genus's parent and any
  `dispute:` note must derive from an inspected phylogenetic analysis,
  redescription, or naming paper — never from recall or from an unsourced prior
  tree.
- **Place at the least-inclusive *uncontested* clade.** When analyses disagree
  between clades A and B, the genus is parented at the lowest clade both accept
  (often an *incertae sedis* position within a backbone node such as `Tetanurae`
  or `Neosauropoda`), and the finer disagreement is recorded in a `dispute:`
  block rather than resolved by picking a side.
- **Weigh independent analyses, not papers.** A reused matrix is one data point;
  recency, taxon and character sampling, and dedicated-versus-incidental scope
  all matter. A single new study is *reflected* in a dispute, but only *adopted*
  as the parent once it has stood unchallenged and been taken up by later work
  (see the consensus policy above).
- **Clades earn their place.** A named clade is kept only where it is a useful,
  currently-used node containing at least one genus; monotypic nodes, tribes,
  and empty clades are collapsed into the level above. A clade whose own higher
  position is contested carries that dispute once, in its `clades/` file, not
  smeared across its members.
- **Nomina dubia and untested taxa are placed conservatively and flagged.** They
  are parented at the broadest node their material supports, marked in a
  `dispute:` block, and logged as a `Literature Review` issue for future
  revisiting.

Clade authorities are recorded as `erected_in` (the nomenclatural-act paper)
and, where different, `described_in` (the authoritative diagnostic source), both
taken from the literature rather than from a taxobox.

## Neutrality and Good Faith

- **No nomenclatural advocacy.** This project records the state of published taxonomy — it does not take sides in naming disputes. Do not use contributions to promote or suppress a particular name, author, or taxonomic opinion. If you have a personal stake in a naming dispute, disclose it.
- **No personal attacks or grudges.** Disagreements about taxonomy are welcome — they are a normal part of science. Disagreements about people are not. Do not use issues, PRs, or commit messages to disparage researchers, authors, or other contributors.
- **Assume good faith.** If a contribution contains an error, assume it was an honest mistake. Correct it with a reference, not a lecture.

## Contribution Quality Standards

- **One change per issue/PR.** Add one genus, correct one taxonomy, upload one image. This keeps review manageable and git history clean. Batch contributions (e.g., "add 50 genera") should be discussed in an issue first.
- **Fill in as much as you can.** The more complete a contribution (description, location, formation, references), the more useful it is. Partial contributions are accepted — someone else can fill in the gaps later — but do not submit empty shells.
- **Write for a general audience.** Descriptions should be accessible to an interested non-specialist. Avoid unexplained jargon. Technical diagnostic features belong in the `diagnostic_features` field, not the description.
- **American English.** All editorial prose — `description`, `etymology`,
  `dispute`, `diagnostic_features`, `holotype.material`, `synonyms[].reason`,
  `references[].notes` — uses American spellings (color, center, behavior,
  meter, fiber, defense, catalog, analyze, paleontology, recognize, etc.).
  Proper-noun metadata — paper and book titles, journal names, publisher
  names, author names, institution names, place names — is preserved
  verbatim from the source, even when that means embedded British
  spellings (e.g. *Acta Palaeontologica Polonica*, Royal Tyrrell Museum
  of Palaeontology, Australian Opal Centre). The `American English`
  validation check enforces this on editorial fields and ignores
  metadata fields.
- **English only.** All text content (descriptions, notes, commit messages, issues) should be in English for consistency.

## Inline Reference Format

When citing papers inside editorial prose (`description`, `etymology`,
`dispute`, `diagnostic_features`, `holotype.material`,
`synonyms[].reason`, `references[].notes`), use the paleo-journal
hybrid form:

- **Narrative**, when the author is the grammatical subject:
  - `Smith (1999)` — single author
  - `Smith and Jones (1999)` — two authors
  - `Smith et al. (1999)` — three or more
- **Parenthetical**, when the citation is an aside:
  - `(Smith, 1999)` — comma before the year
  - `(Smith and Jones, 1999)`
  - `(Smith et al., 1999)`
- Use `and` (not `&`) between author names in both forms.
- For lists inside a single set of parentheses, separate with `;` and
  drop the inner commas: `(Smith 1999; Jones 2000)`.
- Give authority+year only on first mention of each binomial in a
  description; subsequent mentions use the name alone.
- Binomial authority follows ICZN convention: `Genus species Author,
  Year` for the original combination, `Genus species (Author, Year)`
  when the species has been moved from its original genus.

The `Citation format` validation check flags `&` between capitalized
names and `(Author Year)` no-comma single-citation parentheticals.

## Institution Registry

Every `holotype.institution` value must be a key in
[`institutions.yaml`](./institutions.yaml).

The [Sabaj MASTER LIST](https://doi.org/10.1643/ASIHCODONS2020) (the
current version — see the `institutions.yaml` header for the one used in
the last full audit) is the **canonical authority** for which code
denotes which institution. Prefer Sabaj's current code for an
institution, and keep any superseded codes as `aliases` so existing
specimen-number prefixes still resolve. Two cases fall outside Sabaj and
are handled locally: (1) institutions **absent** from Sabaj (many
smaller or regional museums) — choose a sensible code from the describing
literature; and (2) **collisions**, where one code denotes two genuinely
different institutions — disambiguate with the ISO-suffix rule below
rather than adopting Sabaj's single owner.

When two institutions share an abbreviation, both entries are
disambiguated with an
ISO-3166-1 alpha-2 country suffix: `<CODE>-<ISO>` (e.g. `MCNA-AR` for
the Mendoza museum, `MCNA-ES` for the Vitoria-Gasteiz museum). No bare
key may remain when a collision exists — adding a new colliding entry
must also rename the existing one, in the same commit. This mirrors
the citation-key disambiguation policy used in `dist/references.bib`
(`<author><year>` becomes `<author><year>a` and `<author><year>b` when
a second paper arrives).

For within-country collisions, extend the suffix with a city or
institution-type fragment (e.g. hypothetical `MNCN-ES-MAD` vs
`MNCN-ES-BCN`). Colocate disambiguated entries in `institutions.yaml`
so the collision is visible at the source.

## Image Requirements

> **AI-generated art is not accepted.** Open Paleo values the skill and
> scientific knowledge that paleo-artists bring to life reconstructions.
> AI-generated, AI-assisted, or AI-upscaled images do not meet our
> standards. Submissions suspected of using AI-generated imagery may be
> declined at the maintainers' discretion, even if not conclusively
> proven. If you are unsure whether your workflow qualifies, ask before
> submitting.

- **You must hold the copyright, or the image must be public domain / CC0.** All images submitted to Open Paleo are licensed under CC BY 4.0. The submission form requires you to attest to this.
- **No watermarked or heavily manipulated images.** Specimen photos should be unmodified. Life reconstructions should be clearly labeled as such.
- **Credit the creator.** Always fill in the `credit` field accurately with the photographer, artist, or institution.

## Process

- **Open a pull request** that edits the YAML data files directly, and make sure `npm run validate` passes.
- **Do not modify `tree.yml` without discussion.** Changes to the clade hierarchy affect every genus in the affected subtree. Open an issue first to discuss the change and its justification.
- **Respect the review process.** Every PR runs automated validation, and PRs are reviewed by maintainers before merge — changes that affect the tree structure especially so. Do not pressure maintainers to merge faster.

## Local Development Setup

To run the validation and build scripts locally:

```bash
# Clone the repository
git clone https://github.com/open-paleo/data.git
cd data

# Install dependencies
npm install

# Validate all data files
npm run validate

# Build output files
npm run build
```

Requires **Node.js 24** or later.

Running validation locally before submitting helps catch formatting errors, missing references, and schema violations early.

### Paper corpus and working directory

A few maintainer-facing scripts (`intake-bootstrap`, `intake-resume`,
`build-extraction-prompts`) and the `intake-genus` skill read from a
local paper corpus that is **not** stored in this repo. By default
they assume two sibling directories next to your `data/` checkout:

```
your-workspace/
├── data/                 (this repo)
├── open-paleo-papers/    (paper markdown corpus)
│   └── markdown/{citation_key}.md
└── open-paleo-wd/        (Claude working directory, e.g. Wikipedia cache)
    └── wikipedia/{Genus}.json
```

If you keep those directories elsewhere, export the corresponding
environment variables to override the defaults:

```bash
export OPEN_PALEO_PAPERS_DIR=/path/to/your/paper-corpus
export OPEN_PALEO_WD_DIR=/path/to/your/working-dir
```

Most contributors will never need the corpus — it is only required
for the maintainer-driven intake and backfill flows.

## Recognition

Contributors are recognized in the following ways:

- **Git history** — Commit authorship on auto-generated PRs uses the issue author's GitHub identity.
- **CONTRIBUTORS.md** — All contributors are listed in the [CONTRIBUTORS.md](CONTRIBUTORS.md) file as the project grows.
- **Release notes** — When your additions are included in a tagged release, they are noted in the release changelog.

## Contributing to Scripts

If you are modifying the validation, build, or automation scripts
(everything in `scripts/`), see [scripts/CONTRIBUTING.md](scripts/CONTRIBUTING.md)
for TypeScript style guidelines, linting setup, and development workflow.

## Questions?

If something is unclear or you are unsure whether a contribution fits, open a [Report Error](../../issues/new?template=report-error.yml) issue or start a discussion in the [Discussions](../../discussions) tab. We are happy to help.
