---
name: reference-records
description: Reconcile every genus record against the systematics tables of the reference works (Jones 2026, Weishampel 2004, Molina-Pérez 2019/2020), reporting where our holotype numbers, formations and stages disagree with theirs. Deterministic table parsing, not an LLM condensation — no agents and no chunking. Read-only — every row is a QUESTION for a human gate, never an auto-applied fix, because a reference work corroborates a value but is never a primary source for it. Use when the user wants to re-run the Tier 1 reconciliation, work one of its finding buckets, or check whether a specimen/formation/stage disagreement is already settled. The umbrella issue is #2022.
user-invocable: true
argument-hint: "[bucket]"
allowed-tools: Bash Read Edit
---

# Reference Records

Compare every species record against what the reference works print, and report
the disagreements. This is **Tier 1** of the data-quality scan: Tier 0 is the
deterministic scanner (`npm run verify-data-integrity`), Tier 2 is reading a
primary paper for the items Tier 0 and Tier 1 cannot settle (#2027).

## Run it

```
cd .claude/skills/reference-records
python3 extract.py && python3 reconcile.py
```

`extract.py` parses the reference works' markdown into
`scratch/audit/reference-records/*.json`; `reconcile.py` compares that cache
against `genera/` and writes `scratch/audit/reference-reconciliation.md`. Both
outputs are regenerable and gitignored — never commit them.

`reconcile.py --limit N` caps how many examples print per category (default 12).

## What it reads

| Source | Records | Carries |
|---|---|---|
| `jones2026a/b/c` | 1,017 | holotype + formation + country + period/stage + size |
| `weishampel2004a` | 326 | formation, country, age, material — no holotype numbers |
| `molina-pérez2019a/2020a` | 954 | specimen numbers |

`paul2024a/b` are deliberately excluded: narrative prose, no systematics tables.

The works publish their systematics as markdown tables, which is why this is
**deterministic parsing rather than a condensation**. No agents are spawned and
the 5.7 MB Dinosauria needs no chunking.

## The rule that governs every finding

**A reference work disagreeing with us is not evidence that we are wrong.**
Measured across the holotype pass: of 58 number-differing findings triaged
against primaries, 22 were corrections to our data and 36 confirmed us. The
works fold referred material, paratypes and hypodigm into the type roughly a
third of the time.

So nothing here is auto-applied. Read the erecting or describing paper, then
record the outcome (see below). Two traps that cost real time:

- **The erecting paper often does not say "Holotype"** — look for `Type`,
  `COTYPES`, `TYPE:`, or no heading at all. For 19th/20th-century taxa the
  fixing statement is usually in a later reappraisal, not the original.
- **In a multi-taxon paper, scope the search to the binomial.** Taking the first
  `Holotype:` match returned a Permian pareiasaur's type for *Paranthodon*.

## The two suppression files — they are not interchangeable

**`adjudicated.yml`** — findings settled against a PRIMARY, storing the
quotation that closed each one. Fully suppressed from future runs. Verdicts:
`ours-correct`, `corrected`, `ticketed`.

> **One entry per binomial, with several categories** —
> `categories: [holotype, occurrence]`. A second block under the same key
> silently discards the first: YAML keeps the last duplicate and says nothing.
> That happened once, cancelling a holotype adjudication with an occurrence one.
> `loadAdjudicated` now aborts on duplicate keys.

**`formation-variants.yml`** — spellings compared and found to be variants of
one unit. Reported under a `-REVIEWED` heading rather than suppressed, because
the canonical form is still undecided (#2012). A spelling *not* in this file is
new and does need review.

## Reading the report

Findings are tiered by how much independent support they carry, because the
tiers warrant different effort:

- **`-CORROBORATED`** — two or more works give the same value and it is not
  ours. The strongest signal available, and where our data is most likely wrong.
- **`-ours-outlier`** — every source disagrees with us *and* with each other.
  Weak: sources that cannot agree among themselves corroborate nothing. In
  practice these are usually recatalogued specimens or historical numbers.
- **`-sources-disagree`** — the works contradict each other, and a
  `[CONFIRMED BY …]` prefix names the ones that already agree with us.
- **`-single-source`** — only one work speaks. Weakest, and **it has no
  cross-check**, so a parser artifact there cannot be caught by disagreement.
  Sample a batch before trusting it.

A source id marked **`~`** was joined on a near-epithet match rather than an
exact one, because that work misspells the binomial. The pairing is listed in
full under **Fuzzy binomial joins** — check it before trusting a finding that
rests on one, since a wrong pairing attributes another species' values here.

## Why the join is fuzzy

An exact binomial join drops a misspelled row silently, and drops it from
*every* bucket at once. `jones2026a` prints *Anoplosaurus **cartonotus*** for
`curtonotus`; that one letter hid a row carrying the correct Albian age, the
formation, and the lectotype number, while the record sat on a Cenomanian age
inherited from the deposit rather than the animal (#2008).

So an exact miss falls back to a same-genus row whose epithet is within one edit
(under six characters) or two. Three guards keep it from inventing facts:

- **Resolved per reference work, not per species.** Anoplosaurus matched
  `weishampel2004a` exactly, so a species-level fallback would never have fired
  and the Jones row would still be invisible. Each work is joined independently.
- **A row naming one of our species exactly is never a misspelling of a
  sibling**, so it is excluded as a candidate outright.
- **Ambiguity is dropped, never guessed.** A candidate within range of two of
  our species, or one work offering two near spellings, yields no join at all.

This recovers ~40 rows. Every one inspected on introduction was a genuine typo
(`markwitchelli`, `deegrootorum`, `shijiangoensis`), and it reopened the
holotype bucket that had been fully cleared — a reference work cannot be
compared against a row the join never delivered.

## Known artifact classes

- **Molina-Pérez is the least clean source** — positional parsing, locality
  codes read as specimens, Spanish labels, appended ontogeny qualifiers. All
  fixed, but it is the dissenting voice in most `sources-disagree` findings.
  Its volumes use a dozen table layouts: parse them header-driven, never
  positionally.
- **Short digit cores match prose.** `MG 3` matched a citation "(3)";
  `IVPP V20` matched "20 individuals". Require the letter prefix when the core
  is under three digits.
- **Jones's occurrence column is locally corrupted** in places, measured at
  2–4% of rows. A row whose country cannot be reconciled with ours is
  quarantined rather than compared.

## Working a bucket

```
python3 checklist.py <bucket>          # e.g. holotype, stage, formation
python3 checklist.py holotype --width 200
```

Writes `scratch/audit/checklist-<bucket>.md`: one item per finding, quoting what
the primary says around each competing value, so most can be settled without
opening a paper. A bucket name that is a prefix matches every section starting
with it, so `holotype` picks up all three tiers at once.

Decide each item on its `decision:` line, then write the outcomes into
`adjudicated.yml` with the quotation that closed each, and re-run
`reconcile.py`. Checklists are working files — they live in `scratch/`, and
anything worth keeping belongs in an issue.

The quoting is deliberately conservative: it matches on the digit core so it
finds the specimen whichever institution code the paper used, and refuses cores
under three digits, because `MG 3` once matched a citation "(3)" and
`IVPP V20` matched "20 individuals".

## Related

#2022 (umbrella) · #2023 formation buckets · #2024 stage buckets · #2025
holotype prefix buckets · #2029 (the specimen-block schema design that several
findings feed into)
