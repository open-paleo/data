# Contributing to Open Paleo

Thank you for your interest in contributing to Open Paleo. This is a community-maintained scientific dataset, and every contribution — whether a new genus, a corrected classification, or a better description — makes the dataset more complete and more useful.

## How to Contribute

All contributions are submitted through **GitHub issue forms**. These structured forms ensure that data is consistent, automatable, and easy to review. The available forms are:

- **[Add New Genus](../../issues/new?template=add-genus.yml)** — Submit structured data for a genus not yet in the dataset.
- **[Correct Taxonomy](../../issues/new?template=correct-taxonomy.yml)** — Propose a reclassification of an existing genus with supporting references.
- **[Update Genus](../../issues/new?template=update-genus.yml)** — Update descriptions, add species, change species status, or add references.
- **[Add Image](../../issues/new?template=add-image.yml)** — Contribute specimen photos, life reconstructions, or skeletal diagrams.
- **[Report Error](../../issues/new?template=report-error.yml)** — Flag any factual, structural, or formatting issue.

When you submit a form, automation validates your data against the schema and tree structure. If validation passes, a pull request is created automatically. Simple additions (new genera, new images) can be auto-merged after CI passes; changes affecting the tree structure require manual review.

## Scientific Rigor

This is a scientific dataset. All taxonomic data must meet the following standards:

- **All data must be backed by published scientific literature.** Every addition or change to taxonomy, species status, or clade definitions must include at least one reference to a peer-reviewed paper, monograph, or established scientific database. Personal opinions, blog posts, and social media are not acceptable sources.
- **Use the most recent consensus where one exists.** When multiple competing phylogenies have been published, prefer the most recent comprehensive analysis. Note the alternatives in the genus or clade file if the placement is actively debated.
- **Mark disputed taxa honestly.** If a species or placement is controversial, use `status: disputed` and document the competing views in the description and references. Do not present one side of an active debate as settled fact.

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

## Neutrality and Good Faith

- **No nomenclatural advocacy.** This project records the state of published taxonomy — it does not take sides in naming disputes. Do not use contributions to promote or suppress a particular name, author, or taxonomic opinion. If you have a personal stake in a naming dispute, disclose it.
- **No personal attacks or grudges.** Disagreements about taxonomy are welcome — they are a normal part of science. Disagreements about people are not. Do not use issues, PRs, or commit messages to disparage researchers, authors, or other contributors.
- **Assume good faith.** If a contribution contains an error, assume it was an honest mistake. Correct it with a reference, not a lecture.

## Contribution Quality Standards

- **One change per issue/PR.** Add one genus, correct one taxonomy, upload one image. This keeps review manageable and git history clean. Batch contributions (e.g., "add 50 genera") should be discussed in an issue first.
- **Fill in as much as you can.** The more complete a contribution (description, location, formation, references), the more useful it is. Partial contributions are accepted — someone else can fill in the gaps later — but do not submit empty shells.
- **Write for a general audience.** Descriptions should be accessible to an interested non-specialist. Avoid unexplained jargon. Technical diagnostic features belong in the `diagnostic_features` field, not the description.
- **English only.** All text content (descriptions, notes, commit messages, issues) should be in English for consistency.

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

- **Use the issue forms.** They exist to make contributions structured and automatable. Do not open blank issues for things the forms cover.
- **Do not modify `tree.yml` without discussion.** Changes to the clade hierarchy affect every genus in the affected subtree. Open an issue first to discuss the change and its justification.
- **Respect the review process.** Auto-merged PRs (new genera, new images) go through automated validation. PRs that affect the tree structure require manual review from maintainers. Do not pressure maintainers to merge faster.

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
