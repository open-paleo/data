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

The consensus policy governs **taxonomic revisions** — changes to
taxa that already exist in the literature. It is **not** a barrier to
adding newly described taxa. The two cases are handled differently.

### Adding a newly described taxon

A validly published new genus or species is added on its own merits,
**even if it was named very recently**, provided both of the following
hold:

- **The material is adequate — not fragmentary.** A reasonably complete
  or otherwise diagnosable specimen qualifies. An isolated tooth, a
  single indeterminate element, or a scrappy holotype does not; such
  taxa are held until better material or corroboration appears.
- **It is not already contested.** If the describing paper has drawn a
  published rebuttal — a nomen-dubium call, or an argument that the taxon
  is a synonym, a juvenile, or a misidentified specimen of a known
  form — we hold it until that dispute resolves.

Recency by itself is never a reason to wait. A well-founded new species
on a good specimen is included even if it was described this year.

### Adopting a taxonomic revision

Changes to already-named taxa — reclassifications, species splits,
synonymizations, **recombinations** (moving a species into another
genus), genus merges, and resurrections from synonymy — are adopted
only once there is **broad consensus in the paleontological community**
that the change is well-supported. Until then the existing arrangement
stands.

In practice this means:

- **A single paper is not enough.** One study proposing a revision does
  not trigger a change. We look for the proposal to be accepted, cited
  approvingly, or adopted by subsequent analyses before updating.
- **Active debates are documented, not resolved.** When a revision is
  genuinely controversial — with credible researchers on both sides —
  we retain the existing arrangement, use `status: disputed` where
  appropriate, and document the competing views in the description and
  references. The data should describe the state of the field, not
  pick a winner.
- **Corrections to clear errors are fast-tracked.** If a taxon is
  demonstrably misplaced due to a data-entry mistake or an outdated
  classification the field has long since moved past, that can be
  corrected without waiting for new publications.

This policy exists because Open Paleo is a reference dataset, not a
journal. Consumers depend on it being stable and reliable. A tree whose
*revisions* change with every new preprint is less useful than one that
tracks the settled understanding of the field, even if that
understanding lags the cutting edge by a few years — while still
recording genuinely new animals as they are described.

If you believe a **revision** has reached consensus and should be
reflected in Open Paleo, submit a [Correct Taxonomy](../../issues/new?template=correct-taxonomy.yml)
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
- **Write about the literature, not the files.** Editorial prose states what
  sources say about a taxon or unit. It does not describe the dataset itself:
  not "recorded here", "the arrangement adopted here" or "this entry", but
  the placement and its source ("placed within Lithostrotia following
  Carballido and colleagues (2022)"). A claim that no source says something
  is scoped to the works cited ("none of the works cited for this taxon").
- **No gendered pronouns for people.** Name the person, use "they", or
  restructure the sentence, so prose never assigns a gender its source does
  not state. A quotation keeps its source's wording.
- **One dash style.** A dash in prose is a spaced em dash ( — ); a range
  takes an unspaced en dash (Aptian–Albian, 163–145 Ma).

## Inline Reference Format

When citing papers inside editorial prose (`description`, `etymology`,
`dispute`, `diagnostic_features`, `holotype.material`,
`synonyms[].reason`, `references[].notes`), use the paleo-journal
hybrid form:

- **Narrative**, when the author is the grammatical subject:
  - `Smith (1999)` — single author
  - `Smith and Jones (1999)` — two authors
  - `Smith and colleagues (1999)` — three or more
- **Parenthetical**, when the citation is an aside:
  - `(Smith, 1999)` — comma before the year
  - `(Smith and Jones, 1999)`
  - `(Smith and colleagues, 1999)`
- Use `and` (not `&`) between author names in both forms, and `and
  colleagues` (not `et al.` or `and others`) for three or more. A quotation
  keeps its source's own wording.
- For lists inside a single set of parentheses, separate with `;` and
  drop the inner commas: `(Smith 1999; Jones 2000)`.
- Give authority+year only on first mention of each binomial in a
  description; subsequent mentions use the name alone.
- Binomial authority follows ICZN convention: `Genus species Author,
  Year` for the original combination, `Genus species (Author, Year)`
  when the species has been moved from its original genus.

The `Citation format` validation check flags `&` between capitalized
names, `(Author Year)` no-comma single-citation parentheticals, and `et al.`
or `and others (Year)` outside quotations.

## Reference Keys and Years

Full details for each paper live in `references/{letter}/{key}.yml`, one file
per paper, and records cite them by key. A key is the first author's surname
in lowercase, then the year, then a letter: `osborn1905a`, `royo-torres2020a`.

**Lowercasing the surname and removing its spaces are the only changes it
gets.** Every other character the author writes belongs in the key: diacritics
(`maryańska1975a`, `prieto-márquez2023a`), special letters such as `ł`, `ø`
and `æ` (`słowiak2020a`), hyphens (`pereda-suberbiola2009a`) and apostrophes
(`d'emic2012b`, `o'connor2005a`). A multi-word surname has its spaces removed
but keeps any hyphen it already carries (`geoffroysaint-hilaire1825a`,
`aranciagarolando2024a`). However many authors a paper has, only the first
one's surname goes in the key.

When the author is an organization rather than a person, the key is the
abbreviation it publishes under, not its name spelled out: `iczn2023a` for the
International Commission on Zoological Nomenclature, `rom2007a` for the Royal
Ontario Museum.

The `{letter}` directory is the key's first character folded to plain ASCII,
so `ősi2010a` files under `o/` and `słowiak2020a` under `s/`.

Letters are handed out in the order entries were added, so `a` is not
necessarily that author's first paper of the year. The `year` field inside the
file has to match the year in the key.

For the year itself:

> **Use the year the work was published — when it first became available to
> read. Online release counts.**

Old papers often print the date they were read to a society, modern ones the
date they were accepted, and issue labels are unreliable in both directions.
Publication date is the only one available for every entry, and it is what
`erected_in` needs, since a name is not available until its paper is out.

A few examples. A paper released online in 2013 and printed in 2014 is keyed
2013. An article that appeared in May 2025, in an issue labeled 2024, is keyed
2025. Rauhut and Hungerbühler's review of European Triassic theropods carries
the 1998 cover date of *Gaia* 15, but the volume was not published until 2000,
so its key is `rauhut2000a`. Broom read a paper to the society in 1909 and it
asks to be cited as 1910, but it appeared in a collected volume that cannot
have been issued before 1912, so its key is `broom1912a`.

Publishers and the wider literature often disagree about a year. **When they
do, follow what other papers print** — a key is only useful if a reader can
match a citation in our prose to an entry in our references. To check, count
how secondary literature cites the work in its reference lists, where author,
year and title sit together; passing mentions in running text pick up
neighboring citations and will mislead you. Norman's *Hypselospinus* monograph
carries a 2014 volume date, for instance, but later papers overwhelmingly cite
it as 2015, so its key is `norman2015a`. Where no year clearly dominates,
leave the key alone and correct the prose that disagrees with it instead.

If you do rename a key, **rewrite every sentence that cites it in the same
commit.** The old key is gone, not aliased. Grep `genera/` and `clades/` for
it, and check the prose of each record you find as well as its `references`
list — a citation left on the old year is the mismatch you were trying to fix.

## Names and Language

Open Paleo is the core dataset, meant to be consumable by everyone, so its
**prose is American English**. Names are a different matter, and the rule is
not "translate everything":

> **Prose is English. Names are whatever the English-language literature calls
> them.**

Translating a name manufactures a form that appears in no paper and no
registry, which makes the data *harder* to reconcile, not easier. So the test
for any name is empirical rather than linguistic: **what do English-language
papers actually print?** When that is unclear, count how many papers in the
reference literature use each form — independent adoption, not raw
occurrences, so one paper repeating a name fifty times cannot outvote twenty
papers.

How that resolves per field:

| Field | Form | Why |
|---|---|---|
| `location.formation` | Whatever English-language papers print, which is usually a local proper noun with an English rank word (`Posidonia Shale`, `Solnhofen Limestone`) but is sometimes the native name outright (`Marnes de Dives`, `Obernkirchen Sandstein`) | The unit's name is set by its stratigraphic literature, not by us |
| `location.region` | An ISO 3166-2 code (`DE-BY`); the build resolves it to the English subdivision name | An external registry settles spelling, rank words and exonyms in one move |
| `institution` names | **Native form, never translated** (`Bayerische Staatssammlung für Paläontologie und Geologie`) | A registered entity name is not a description; the code is the key and the name is display text |
| Reference `title` | **Native form, with a bracketed English gloss** — `Gadrozavry Kazakhstana [Hadrosaurs of Kazakhstan]` | A title is a retrieval key: translate it away and the reader cannot find the paper. Brackets marking a supplied translation are the ISO 690 and Crossref convention |
| Descriptions, notes, dispute prose | American English | These are prose, not identifiers |

**Do not "fix" a native name to an English one without checking.** All eight
formation names in the dataset that carry a non-English rock-type word were
tested against the reference literature, and English-language papers use the
French or German form for **every one of them** — including cases where an
English rendering exists but is rarer (`Calcaires de Caen` 3 papers vs
`Caen Limestone` 2; `Marnes d'Auzas` 5 vs `Auzas Marls` 1). Beware false
positives when counting: "Blue Marls" turns up in two papers, but as a
description of Isle of Wight beds and as a different unit in the Aude —
neither is the Sisteron `Marnes bleues`.

Full translations of prose belong in downstream forks (`data-fr`, `data-es`,
`data-de`), which is precisely why the core carries identifiers rather than
glosses.

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

## Stratigraphic Registry

Every lithostratigraphic unit named in a record's `location` (`group`,
`formation`, `member`, `bed`) has an entry in
[`stratigraphy/`](./stratigraphy), one file per unit under a letter
directory, named after the unit. The `name` field is the unit's name with
the rank word dropped and any lithology word kept: `Morrison`,
`Navajo Sandstone`. Where two different units share a name, the key takes a
country suffix in parentheses.

Beds are the exception: a bed is listed in the `beds` of its nearest
containing unit, not in a file of its own. A bed's label usually means
something only within one section, quarry or numbering scheme (`83` is a
bed of one measured section at Langenberg, `L9` one of Stewart's numbered
plant debris beds in the Wessex), so it is identified by its parent plus its
name and is printed exactly as the literature gives it. A nested bed takes
the same fields as any entry except `rank` and `parent`, which its position
implies. A record's `bed` resolves among the beds of its member, or of its
formation or group where it names no member. A bed that no source places in a
larger unit keeps a file of its own, with `rank: bed` and no `parent`.

An entry records what the primary literature says about the unit. Every value
cites the paper it came from, and the reference note quotes that paper's own
words, in English translation where the paper is not written in English:

- `rank`: supergroup, group, subgroup, formation, member or bed. Omitted when
  no source states one.
- `informal`: true when the unit was established informally.
- `parent`: the containing unit. Containment is stored only on the child.
- `variants`: other names papers print for the unit. Not spellings, rank
  words or rank claims.
- `period` and `stages`: the unit's age, described below.
- `dispute`: disagreement that is still live in the literature. A superseded
  name or dating is not a dispute; the older paper belongs in the reference
  notes.

### Age: `period` and `stages`

`period` is required: the epoch or epochs the unit spans, oldest first, from
the `periods` vocabulary in `schema.yml`. `stages` is optional and refines
it: the stages the unit spans, oldest first and contiguous, each one inside
one of the unit's epochs. **An empty or absent `stages` means no source gives
the age at stage resolution. It does not mean the unit is undated.**

Both fields hold the union of what the sources publish: a bound, not a choice
between readings. If one paper dates a unit Cenomanian and another
Cenomanian–Turonian, the unit spans both stages, and a newer, narrower dating
adds to the older readings rather than replacing them. A stated range covers
every stage inside it: "Coniacian–Campanian" includes the Santonian.

- A source that names only an epoch gives `period` alone. The exception is
  a source that places the boundary between two epochs inside the unit, as
  with the end of the Cretaceous within the Scollard Formation: the beds just
  above that boundary belong to the first stage of the later epoch, so the
  unit takes that stage. A span alone ("late Campanian to Paleocene") is not
  enough, because the unit may have a gap at the boundary.
- A source that names stages gives `stages`, and `period` is the epochs those
  stages fall in.
- When the sources name both, both come from the literature. If the epochs the
  sources name do not contain the epochs of the unit's stages, that conflict is
  recorded as a `dispute` rather than resolved by choosing a side.
- A paper's own undecided dating ("late Barremian or earliest Albian")
  contributes every alternative it allows.
- A parent is dated from its own sources, never from the children recorded
  here. The registry holds only the units our records name, so the children
  it carries are a sample of the parent's, and their union says nothing about
  the parent's span. A group or formation takes its age from, in order of
  preference: a source that dates it directly; a source that dates it by way
  of its members; or, where neither exists, the union of the ages of every
  member a published scheme lists, each member's age from its own source, with
  the note naming the scheme and each of those sources.
- A child is checked against its parent, not used to widen it. A child whose
  stages fall outside its parent's is a finding to resolve by reading: either
  the child's dating or the parent's sources are wrong or incomplete. For a
  nested bed the validator makes this check.
- A unit that no source dates directly takes its parent's `period`, but never
  its `stages`.

These do not date a unit: the age of a different unit (a correlative, or a
unit of the same name elsewhere), a taxon occurrence table that lists one age
across several units, the title of a cited paper, and any age reached by your
own correlation. A numeric age in millions of years dates a unit only as
described under [Reading ages on the chart](#reading-ages-on-the-chart).

A range printed in impossible order does not date a unit either, because its
author did not check it against a chart. That covers a range written youngest
first ("Albian–Aptian"), and a boundary hedge whose two stages are not
adjacent ("late Barremian or earliest Albian", with the whole Aptian between):
the wording claims a boundary the stages do not share. Quote such a phrase as
printed, but do not let it add a stage. A plain either-or between two
readings ("Kimmeridgian or Neocomian") is different: it is a paper's own
undecided dating, and contributes both readings and every stage between them.

### Reading ages on the chart

We use the stage boundaries of the ICS International Chronostratigraphic
Chart v2024/12, which are the base ages listed in `schema.yml`. Papers date
rocks against whichever chart was current when they were written, and some
boundaries have moved since. The base of the Barremian, for example, is
126.5 million years ago in GTS2020 but 125.77 in the current ICS chart, so
"126 million years old" means Barremian on one chart and Hauterivian on the
other. When you place a numeric age on a stage, use the current chart and say
so in the note.

Most of the time a paper names a stage and the number is only there to help
the reader ("a Cenomanian age ... about 93 million years ago"). Go by the
stage the paper names, even if the number falls in a neighboring stage on
today's chart, and mention the difference in the note. The stage was usually
worked out from fossils, magnetic reversals or the units above and below, and
that evidence does not change when a chart does.

Sometimes it is the other way around: the paper had a radiometric date and
looked up its stage on the chart of its day. A paper that writes "122 Ma
(early Aptian)" was right in 1999, but 122 million years ago is late
Barremian on today's chart. In that case go by the number, and say in the
note that the paper's stage came from an older chart.

A few more cases come up often:

- **Uncertainties.** Place a date by its central value, and say in the note
  if its error range reaches into the next stage.
- **Recalibrated dates.** Radiometric dates are sometimes recalculated
  against newer standards. Use the newer figure and mention the older one.
  Also watch for old boundary ages quoted as if they were dates: a range
  ending at "65.5 Ma" is using an older age for the end of the Cretaceous
  (66.0 today), not dating the rock.
- **Limits are not ages.** A maximum depositional age from detrital zircons,
  or the date of a lava flow above or below the unit, tells you how old or
  young the unit can be, not when it formed. Do not add a stage from it. If
  it rules out a stage that another source gives, record the disagreement as
  a `dispute`.
- **Second-hand dates.** If a paper reports a date from someone else's work,
  read that original work before the date adds a stage. Until then, the note
  can mention it as reported.

Some papers date units only in regional or obsolete stages (Neocomian,
Senonian, Rhaetic, Volgian, land-vertebrate faunachrons, North American land
mammal ages). Convert these using the GTS2020 period chapters, or a published
regional correlation where those chapters give none, and quote the conversion
rather than doing it from memory. Cite the correlation on the unit, and put
the sentence about the conversion in the note on the paper being converted.
If the unit already has international stages and the regional term is just
quoted, a conversion is only worth adding when it changes the result.

Validation requires `period` on every entry and checks each stage against it.
A record's own age is a separate finding: it must fall within its unit's
range, not copy it. A species' `period` and `stages` describe the horizon its
type specimen came from, not every horizon the species is known from. Referred
material from older or younger beds goes in the location notes, and it does not
widen the stages.

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
