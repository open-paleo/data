# Research notes

The records in `genera/`, `clades/` and `stratigraphy/` hold results. This
directory holds the reasoning behind them: what the sources say, where they
conflict, which reading was adopted, and which readings were considered and
rejected. A worker who starts on a record should be able to read these notes
instead of researching the same question again, or reaching a conclusion that
has already been ruled out.

## Before working on a record

Read its research file, and every other note that links to the record or to
its research file:

```
npm run research -- genera/W/Wulatelong.yml
```

If neither exists, nothing has been recorded about the record. That does not
mean nothing is known about it; the record's own reference notes and the git
log of its file still apply.

## Layout

A record's research file is its data path with `research/` in front and `.md`
in place of `.yml`:

| Record | Research file |
|---|---|
| `genera/A/Aardonyx.yml` | `research/genera/A/Aardonyx.md` |
| `clades/Abelisauridae.yml` | `research/clades/Abelisauridae.md` |
| `stratigraphy/a/argiles-et-grès-à-reptiles.yml` | `research/stratigraphy/a/argiles-et-grès-à-reptiles.md` |

Stratigraphy filenames follow the registry's rule: lowercase, diacritics kept,
and every run of other characters becomes one hyphen. The directory letter
folds diacritics, so `Öösh` lives under `o/`.

A record gets a file only when there is something to say that the record
itself does not: a conflict among sources, a rejected reading, a source that
was hard to find or easy to misread. A restatement of the record's values is
not a research note.

### Topic notes

A question whose answer concerns the relationship between several records goes
in `research/topics/<slug>.md`, with the slug built by the same rule. Examples
are which unit the Maortu beds belong to, and why the "Grès à Reptiles" of
three basins are separate units. The reasoning is written once, in the topic
note, and not copied onto each record it affects.

A topic note links every record it affects, normally in the **Conclusion**'s
"Governs" clause, and the lookup finds the note from any record it links. The
links are the only list of affected records, so a record that a topic bears on
but never links will not find it. Per-record files need not link back to
topics.

### Methods

`research/methods.md` holds the general rules that decide record values and
belong to no single record: how a maximum depositional age bears on stages, or
when a dated number is re-placed on the current chart. Read it before working
on any record. A rule entry takes this form:

```markdown
## <The rule, stated as a rule>

*<YYYY-MM-DD>*

**Rule.** <What to do, and the fields it decides.>

**Why.** <The reasoning, and the case that showed the rule was needed, with a
link to that record or note.>

**Exceptions.** <When the rule does not apply; or "None.">
```

A rule that is later changed follows the supersede rule below. A rule about
one record or one group of records is not a method; it belongs in that
record's file or a topic note.

## Entries

A file opens with a single `#` title: the record's name (a genus in italics,
as `# *Leyesaurus*`), or for a topic note a short name for its subject. Dated
entries follow, newest first, and then a `## References` section. Each entry is
a `##` heading that states the question, then these parts:

```markdown
# <Record name, or the topic's subject>

## <The question, as a question>

*<YYYY-MM-DD>*

**Conclusion.** <The reading adopted.> Governs <the field or value, e.g.
`location.formation`> on <a link to each record it applies to>.

**Evidence.**
- <id>, p. <page>: "<the words that carry the claim>".

**Ruled out.**
- *<Rejected reading>.* <Who proposes it, and why it fails.>

**Open.** <What is unresolved, and what would settle it; or "Nothing.">
```

- **Conclusion** names the field or value it governs, so a reader can check it
  against the record.
- **Evidence** is short quotations, each with its reference id and a page.
- **Ruled out** lists every reading that was considered and rejected, and why
  each one fails. This part exists to stop a repeat wrong conclusion, so it is
  never left out when a candidate was weighed.
- **Open** says what is unresolved and what would settle it. A paper that
  has not been read may be named here, as the paper that would settle the
  question. It is never cited as evidence until someone has read it.

## Links

Link another file by its path relative to the note, as ordinary Markdown:

- another research file, where the prose refers to it: "see
  [Bajo de la Carpa](../../stratigraphy/b/bajo-de-la-carpa.md)"
- a data record, where the note concerns its current value:
  "[*Leyesaurus marayensis*](../../../genera/L/Leyesaurus.yml)"

Link a data record rather than its research file when the research file may
not exist. A link must resolve; a broken link is an error, as an unresolved
reference id is.

## Superseded entries

When a later entry overturns an earlier one, it says so in its first line
("Supersedes the 2026-08-12 entry: …") and the earlier entry stays. The wrong
turn is part of what a reader needs to see.

## Citing sources

Every reference id must resolve to a file in `references/`. A paper with no
entry in the store yet gets one minted before it is cited, and the note uses
that entry's id. Never write a placeholder in place of an id. Confirm an id
against the entry's title before citing it: an `a` and a `b` by the same
author and year are different papers.

A citation gives the **page**, and a short quotation where the page alone
would leave the passage hard to find:

- The page is the printed folio of the edition the reference store cites. Do
  not use the PDF's page index, and do not use the folio of a translation or
  reprint the store does not cite.
- An article without printed folios (an article number such as `e22916`) is
  cited by the page of the article file and the section heading:
  `xu2011c, p. 4, Systematic Paleontology`.
- Figures, tables and supplements are cited by their own labels: `Fig. 3`,
  `Table 2`, `Supplementary Information, p. 6`.
- Do not cite line numbers in a converted markdown file. Another reader's
  conversion of the same paper will not have the same lines.

The quotation, not the page, is what lets a reader or an agent find the
passage by searching its own copy. Keep it to the words that carry the claim.
A non-English source is quoted in English and marked `(translated)`; give the
page of the original so the passage can be found there.

The `## References` section lists every id cited in the file, one per line,
with authors, year and title as the reference store gives them. It is
generated from the store by `npm run research -- --references <file>` and is
never written by hand, because a bibliography typed from memory is the error
this project has made most often.

## What belongs here

- **In:** what the literature says; how sources conflict; which reading was
  adopted and why; readings that were rejected; sources that turned out to be
  the wrong paper, misdated or misattributed.
- **Out:** pipeline state. Fetch status, OCR and conversion defects, which tool
  or agent misread what, and ticket bookkeeping belong in GitHub issues. A
  defect in what a source *says* (a translation that renders *Bajo* as
  "Lower") is a finding and belongs here.

Quotations stay short. Cite by id; do not paste passages.

These notes are public commentary on other researchers' work. Describe what
the text says ("the abstract names one formation and the section figure
another"), not the author. The conduct rules in [CONTRIBUTING.md](../CONTRIBUTING.md) apply.

## Style

The notes follow the same prose rules as the records.

- Open each part on the claim. Do not open by announcing that something is
  missing or about to be explained.
- In sentences, cite people in narrative form: "Xu and colleagues (2013)", not
  "Xu et al." and not a bare reference id. Ids appear in **Evidence** lines and
  in `## References`.
- American English. Institution and unit names stay as their owners spell them.
- State the specific thing. Avoid stock phrasing that stands in for a claim:
  "load-bearing", "smoking gun", "blast radius", "the shape of the argument",
  "earns its keep", "moving the needle", and architectural metaphors for
  reasoning ("seam", "spine", "scaffolding"). Write "removing this reading
  changes the stage to Campanian" instead.
- No rhetorical turns ("And the answer?", "Honestly,"), and no closing summary
  that repeats the entry.
- Say what was checked and what was inferred. A unit assignment read in the
  paper is checked; extending it to a neighboring locality the paper does not
  discuss is an inference, and the entry says so.
