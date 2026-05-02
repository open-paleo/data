# Paper-driven field backfill — process notes

A repeatable flow for using the local paper corpus
(`~/Desktop/open-paleo-papers/`) to backfill genus-level fields that
require reading the original describing paper. Currently scoped to
`species.holotype.material` (issue #1833) and `diagnostic_features`
(issue #1827); the same pattern extends to other paper-derived fields.

This document is intentionally living — update it as we learn what works
and what doesn't on each batch.

## Scope and conventions

- **One letter at a time.** Initial run is genera starting with `A`;
  later sessions cover B, C, etc. Smaller batches keep the review queue
  manageable and let us iterate on the prompt between rounds.
- **Type species only.** `diagnostic_features` is genus-level and is
  populated from the type species' autapomorphies as given in the
  describing paper. For monotypic genera (the common case) this is the
  full picture. For genera with additional species, intra-genus
  differentia will land in a future species-level field — see issue
  #1862.
- **Skip already-filled fields.** Existing `species.holotype.material`
  or `diagnostic_features` values are never overwritten by this flow.
  The driver short-circuits per-genus once both fields are populated.
- **Skip genera without corpus coverage.** ~14% of A genera lack a
  markdown body for their type species' describing paper. The driver
  records a `no-paper` entry in the report and moves on; later corpus
  additions trigger a re-run.
- **Type species only for `holotype.material`.** A follow-up pass will
  audit non-type species (per issue #1833 notes).

## Pipeline

```
genera/{Letter}/*.yml
        │
        ▼
┌──────────────────────────────┐
│ Prompt builder               │   scripts/build-extraction-prompts.ts
│  · resolve type species      │   npm run build-extraction-prompts -- --letter X
│  · find described_in key     │
│  · skip if both filled       │
│  · skip if no markdown       │
│  · skip if no described_in   │
│  · emit literal prompt per   │
│    queue entry (no hand      │
│    transcription)            │
└──────────┬───────────────────┘
           │
           ▼
reports/extraction-queue-{Letter}.json     ← skip categories + summary
reports/extraction-prompts-{Letter}.jsonl  ← one ready-to-dispatch row per line
           │
           ▼ (read each row, send `prompt` to a Sonnet Agent)
┌──────────────────────────┐
│ Sonnet sub-agent (per    │   one Agent call per row, dispatched in
│ paper). Returns strict   │   parallel batches. Reads ONLY the named
│ JSON: holotype_material, │   markdown — no exploration.
│ diagnostic_features,     │
│ notes.                   │
└──────────┬───────────────┘
           │
           ▼
reports/extractions/{Letter}/<Genus>.json  ← per-genus output
           │
           ▼ (aggregate)
reports/extracted-paper-fields-{Letter}.json   ← human review here
           │
           ▼
┌──────────────────────────┐
│ Apply script             │   scripts/apply-paper-field-extractions.ts
│  · string-level rewrite  │   (string-level, formatting-preserving)
│  · only writes accepted  │
│    entries               │
└──────────┬───────────────┘
           ▼
genera/{Letter}/*.yml      ← validated, linted, then committed
```

The split between extract and apply is deliberate: the extract pass is
expensive (LLM calls) and produces a reviewable artifact; the apply
pass is cheap and deterministic, and only runs after a human approves.

**Why the prompt builder.** The first letter-A run had two
species-name typos because prompts were hand-typed into batch
dispatches. The builder makes prompt construction mechanical: every
prompt's `genus`, `species`, `described_in`, `markdown_path`, and
`output_path` are interpolated from the same parsed YAML the rest of
the project uses. The dispatcher (currently a human driving the Agent
tool, eventually a script) reads the JSONL one row at a time and
sends the literal `prompt` field — there is no longer a step where a
species name can be transcribed wrong.

## Sonnet extraction prompt (template)

The per-paper agent receives the full markdown body and an instruction
block of roughly the following shape:

> You are extracting two structured fields from a paleontology paper
> for the open-paleo dataset. Read the markdown carefully and return
> **only** a JSON object with the schema below — no preamble, no
> trailing prose.
>
> Fields:
> - `holotype_material` — a single concise string (≤ 200 chars)
>   describing what physical material constitutes the holotype of
>   *{Genus species}*. Prefer the paper's "Holotype" subsection and lift
>   its specimen description nearly verbatim, dropping the catalog
>   number itself (it lives in `specimen_id` already). If the paper does
>   not contain an unambiguous holotype description, return `null`.
> - `diagnostic_features` — an array of 3–6 short bullet strings, each
>   describing one autapomorphy or distinguishing character of the
>   genus. Source from the paper's "Diagnosis" or "Differential
>   Diagnosis" section. Prefer characters listed as autapomorphies of
>   the new taxon, not characters shared with broader clades. Each
>   bullet should read as a standalone clause; do not number them.
>   Return an empty array if no diagnosis is present.
> - `notes` — short string flagging anything ambiguous, contested, or
>   surprising about your extraction. `null` if straightforward.
>
> Do **not** invent material or characters that are not in the paper.
> Returning `null` / `[]` is correct when evidence is absent.
>
> Output JSON schema:
> ```
> { "holotype_material": "string|null",
>   "diagnostic_features": ["string", ...],
>   "notes": "string|null" }
> ```

The driver supplies `{Genus species}` per call and concatenates the
markdown body (truncating safely if a paper is unusually long).

## Output format (`reports/extracted-paper-fields-{Letter}.json`)

```jsonc
{
  "letter": "A",
  "generated_at": "2026-05-01T...",
  "skipped": {
    "no_described_in": ["Aardonyx", ...],
    "no_corpus_markdown": ["Aegyptosaurus", ...],
    "already_filled": ["Allosaurus", ...]
  },
  "extractions": [
    {
      "genus": "Abdarainurus",
      "species": "Abdarainurus barsboldi",
      "described_in": "averianov2020",
      "current_material": null,
      "current_diagnostic_features": null,
      "proposed_holotype_material": "Six articulated middle caudal vertebrae",
      "proposed_diagnostic_features": [
        "Strongly procoelous middle caudal centra with ...",
        "..."
      ],
      "agent_notes": null
    },
    ...
  ]
}
```

## Review checklist (per extraction)

When reviewing the JSON before applying:

1. **Material plausibility.** Does the proposed material match the
   `specimen_id` we already have? A holotype of "single tooth" should
   correspond to a single-specimen catalog entry, not a series.
2. **Diagnosis source.** Is the bullet list drawn from autapomorphies,
   not just generic clade characters? "Bipedal" or "herbivorous" are
   red flags — those belong in `locomotion` / `diet`.
3. **Bullet count and length.** 3–6 bullets, each a standalone clause.
   If the agent returned 12, condense the strongest 5 manually.
4. **Notes field.** Pay attention — the agent flags ambiguity here
   (e.g. emended diagnosis in a later paper, lost material, etc.).
5. **No fabrication.** If unsure, spot-read the source paper. The
   markdown is at `~/Desktop/open-paleo-papers/markdown/{key}.md`.

## Apply step

`scripts/apply-paper-field-extractions.ts` reads the (possibly
hand-edited) report JSON and performs string-level edits on each
genus YAML, mirroring the technique used by `fix-reference-titles.ts`:

- Inserts `material:` under `holotype:` of the type species, with
  block-folded scalar formatting if the string is long.
- Inserts a top-level `diagnostic_features:` list immediately before
  `identifiers:` (the conventional position seen in Iguanodon /
  Triceratops / Tyrannosaurus).
- Skips any entry where the corresponding field is already populated
  (defense in depth — the report should already have skipped these).
- Runs `npm run validate` and `npm run lint` after each batch.

## Iteration log

> Entries appended as we run each letter batch. Capture: prompt
> tweaks, classes of extraction error we caught in review, ratio of
> accepted vs. edited vs. rejected entries, paper-level surprises
> (missing diagnosis sections, bibliographies that aren't really
> describing papers, etc.).

### Letter D — 2026-05-01

Fourth letter through the pipeline. 60 genera total; 49 queued (1
no `described_in`: Diplodocus; 10 no corpus markdown).

Apply results:
- **Applied**: 45 genera
- Sentinels: 0 (notable — every paper had usable content)
- Non-primary (2): Dromaeosauroides (review), Dromiceiomimus
  (systematic revision — edge case, see corpus-paper-report.md)
- No-data (2): Dacentrurus, Dryptosaurus (likely brief older papers)
- Insertion failures: 0

Spellcheck unknowns: 87 → 0 after appending 84 new terms;
paleo-vocab.txt now 597 entries; cspell taxonomy 5,907 words.

Cumulative impact (A + B + C + D):
- `diagnostic_features` missing: 1,295 → 1,016 (−279, −21.5%)
- `species.holotype.material` missing: 1,062 → 819 (−243, −22.9%)

Notable corpus findings:
- Daxiatitan (you2008) heavily OCR-corrupted — genus garbled as
  "Maxiaosaurus robustus"; data is suspect, consider re-OCR
- 4 binomial flags, all single-glyph OCR misreads (Dandakosaurus
  inducus, Dongyangopelta yangyananensis, Dongyungosaurus,
  Dromæzosaurus) — none require action
- 1 historical genus rename: Dacentrurus (formerly Omosaurus,
  preoccupied)

### Letter C — 2026-05-01

Third letter through the pipeline. 85 genera total; 67 queued (0
no `described_in`, 18 no corpus markdown).

Apply results:
- **Applied**: 60 genera
- Sentinels (5): Camarillasaurus, Camptosaurus, Campylodoniscus,
  Chaoyangsaurus, Cruxicheiros
- Non-primary (2): Conchoraptor (review), Crichtonpelta (review —
  edge case, see corpus-paper-report.md)
- Insertion failures: 0

Spellcheck unknowns: 108 → 0 after appending 105 new terms to
`paleo-vocab.txt` (3 dedupes with prior letters). Total
paleo-vocab now 513 entries; cspell taxonomy 5,823 words.

Cumulative impact (A + B + C):
- `diagnostic_features` missing: 1,295 → 1,061 (−234, −18.1%)
- `species.holotype.material` missing: 1,062 → 855 (−207, −19.5%)

Notable corpus findings (full details in
`reports/corpus-paper-report.md`):
- 5 new sentinels, 5 new translations
- 5 binomial flags — most are taxonomic history (genus rename,
  emended endings) or OCR (G vs C); none require immediate action
- Crichtonpelta `paper_quality: review` is borderline; the paper
  *is* the formal description of the new combination
- BXGMV (Beipiao Geological Museum) not in `institutions.yaml`,
  so its catalog token wasn't stripped from Crichtonpelta's
  material — one-off, easy fix when convenient

### Letter B — 2026-05-01

Second letter through the pipeline. 65 genera total; 56 queued (1
no `described_in`, 8 no corpus markdown).

Dispatched 56 Sonnet agents in two parallel batches (28 + 28).
Apply results:

- **Applied**: 55 genera
- Sentinel: 1 (Baryonyx — charig1986 markdown is empty/boilerplate)
- Non-primary: 0
- No-data: 0
- Insertion failures: 0

Spellcheck unknowns: 97 → 0 after appending to `paleo-vocab.txt`
(95 new terms; 2 already covered by letter-A additions). Total
paleo-vocab dictionary now 408 entries; cspell taxonomy.txt 5,718
words.

Repository-wide impact (cumulative across A + B):
- `diagnostic_features` missing: 1,295 → 1,121 (−174, −13.4%)
- `species.holotype.material` missing: 1,062 → 904 (−158, −14.9%)

No data-quality issues surfaced this batch — no review/popular
miscitations, no binomial discrepancies, no insertion edge cases
beyond the empty-markdown sentinel. The mechanical-prompt approach
introduced via `build-extraction-prompts` worked exactly as
intended: prompt construction was the same for letter B as letter
A, but with no transcription errors this time.

### Letter A — _in progress_

#### Dry-run, 2026-05-01: 3 papers spanning eras

Picks: Acanthopholis (huxley1867a, 1867 prose), Abelisaurus
(bonaparte1984, 1984 review-style), Australotitan (hocknull2021, 2021
modern systematic). Output: `extracted-paper-fields-A-dryrun.json`.

**What worked:**

- Modern systematic papers (Australotitan) are the easy case — the
  agent lifted the holotype list and 6 autapomorphies almost verbatim
  from clearly delimited subsections. Almost no editing needed.
- Older prose papers (Acanthopholis, 1867) are usable: the agent
  pulled 5 distinguishing characters from descriptive text when no
  formal diagnosis existed. Quality is good but reviewer should expect
  to tighten phrasing.
- The `notes` field caught real issues every time: Latin gender
  mismatch in Acanthopholis (paper writes "horridus", our YAML has
  "horrida"); wrong paper key for Abelisaurus (the corpus's
  bonaparte1984 is a popular review, not the formal description);
  missing asterisk notation in Australotitan's marker-converted
  diagnosis. Treat agent notes as a first-class signal, not a
  footnote.

**What needs prompt or process tweaks:**

1. **Citation-correctness check.** The Abelisaurus failure is a corpus
   data issue, not an extraction issue: `described_in: bonaparte1984`
   is wrong. Add a pre-flight pass that flags suspicious mismatches —
   e.g. when the paper's title doesn't reference the genus name in any
   form, or when the agent flags "review article" / "manuscript in
   preparation" in notes. Defer the extraction for those entries until
   the citation is corrected. (Tracked separately as a citation-key
   audit; we can build this into the driver as a soft warning.)

2. **Comparative bullets.** Acanthopholis bullet #6 ("Teeth distinct
   from Scelidosaurus; dermal armour characters differ from
   Hylaeosaurus and Polacanthus") is a comparison, not a standalone
   character. Tighten the prompt: *"Avoid bullets that are purely
   comparisons to other taxa. A character must be intrinsically
   describable without naming another genus."*

3. **Bullet length on prose-era papers.** Acanthopholis bullets ran up
   to ~200 chars because the 1867 descriptions are themselves dense.
   Consider relaxing the soft cap from 150 to 200 for older papers, or
   accepting that prose-derived bullets are longer and trimming in
   review.

4. **Verbatim Latin endings.** When a paper uses a different
   gender/spelling than our YAML (e.g. "horridus" vs "horrida"), the
   agent should surface it in `notes` (it did). Add an explicit
   instruction asking the agent to flag any binomial spelling
   discrepancy it notices.

5. **Markdown conversion artifacts.** Australotitan's diagnosis used
   asterisks in the original PDF to mark autapomorphies; the marker
   tool lost them. The agent treated the full character list as
   "the taxon's differentiating combination", which is correct
   downstream but means we may be including non-autapomorphic shared
   characters. Worth a spot-check on the source PDF for high-stakes
   entries.

**Action items before fanning out:**

- [x] Refine the prompt: cap bullet length at 200 chars; instruct
      agent to flag binomial spelling discrepancies; ban
      comparative-only bullets.
- [ ] Add a citation-key audit pass to the driver: skip entries where
      the agent's `notes` flag the paper as review/popular/in-prep.
      Open a follow-up issue listing the suspicious citations.
- [ ] Hand-correct Abelisaurus' `described_in` separately (not part of
      this backfill flow).
- [ ] Build the apply script (`scripts/apply-paper-field-extractions.ts`)
      using the same string-level rewrite approach as
      `fix-reference-titles.ts`. Don't apply until human review of the
      JSON is complete.

#### Full-run learnings (in progress, batches 1–2 of ~13)

**Hard rule: agents must not leave the markdown.** First batch turned
up Achelousaurus (sampson1995.md is publisher boilerplate only, no
body text). The agent spent 23 tool uses and 118 seconds searching
PDFs, images, and other corpus paths trying to find the missing
content. That's wasted compute and risks fabrication. The prompt now
includes an explicit guardrail:

> **Read ONLY the named markdown file.** If it is empty, contains
> fewer than ~50 lines of substantive prose, or is just publisher
> boilerplate / metadata, write the sentinel JSON
> (`{ holotype_material: null, diagnostic_features: [], notes:
> "EXTRACTION FAILED: empty/boilerplate markdown" }`) and STOP. Do
> NOT explore images/, pdf_images/, pdfs/, or any other paths. Do
> NOT search the corpus for related papers.

**Two more `described_in` errors caught by the agent:**

- `Adasaurus.species[0].described_in: barsbold1977` — barsbold1977 is
  a translated evolutionary survey; Adasaurus appears only in a
  figure caption. Wrong key.
- `Ahshislesaurus.species[0].name: Ahshislesaurus mcdonaldi` —
  dalman2025 actually describes *A. wimani*. Either our species
  entry is wrong or the citation is wrong. Needs a cross-check
  against the published paper.

These are corpus/data-quality issues, not extraction failures, and
will be batched as side-findings after the A run completes. They
also confirm that the `binomial_in_paper` and `paper_quality` fields
in the schema are pulling their weight as auditing signals.

**Action items before next batch:**

- [x] Update the prompt with the "do not leave the markdown" rule.
- [x] After the run, audit `binomial_in_paper` and `paper_quality`
      fields across all 127 outputs to surface citation/data issues.

#### Full-run results (letter A)

127 papers processed in 5 parallel batches of 10–25 (one batch of 10
to test, four of 25–17). Aggregate report at
`reports/extracted-paper-fields-A.json`.

**Summary:**
- 123 successful extractions
- 4 extraction failures (`EXTRACTION FAILED` sentinel) — all
  legitimately empty/boilerplate markdown, not agent errors
- 7 OK extractions returned `holotype_material: null` (paper lacks
  an explicit Holotype subsection)
- 5 OK extractions returned `diagnostic_features: []` (paper lacks
  a diagnosis-equivalent section)
- 11 papers classified as `review` / `popular` / `translation` —
  these are likely citation problems (the corpus has the wrong
  paper, or only a translation, for the formal description)
- 4 *real* binomial discrepancies (down from 60 once we filtered
  out cosmetic noise: "gen. et sp. nov." appendages, ligatures,
  capitalisation)

**Empty-markdown failures:**
- `Achelousaurus` (sampson1995) — publisher boilerplate only
- `Altispinax` (huene1923) — publisher boilerplate only
- `Anchisaurus` (marsh1885) — BHL OCR missed the actual page; only
  a garbled "Anchisauridae" fragment in scientific intelligence
- `Astrophocaudia` (d'emic2013) — **path-encoding bug**: the
  filename uses `'` (U+2019, curly apostrophe) and the agent's
  `Read` returned permission-denied. File content is fine; needs
  a re-run with the path properly handled

**Non-primary citations to investigate (probable wrong paper):**
- `Abelisaurus / bonaparte1984` — popular review, formal
  description is Bonaparte & Novas 1985
- `Abrosaurus / ouyang1989` — corpus has English translation
- `Adasaurus / barsbold1977` — corpus has English translation;
  Adasaurus appears only in a figure caption (the paper is an
  evolutionary survey, not the species description)
- `Amargasaurus / bonaparte1984` — review only, lists Amargasaurus
  as nomen nudum "groeberi"; formal description is Salgado &
  Bonaparte 1991 (cazaui)
- `Ampelosaurus / leloeuff1995` — corpus has English translation
- `Amurosaurus / bolotsky1991` — corpus has 2011 book chapter, not
  the 1991 original
- `Andesaurus / calvo1991` — corpus has English translation
- `Antarctosaurus / huene1927b` — review; Antarctosaurus mentioned
  only in passing
- `Aralosaurus / rozhdestvensky1968` — corpus has English
  translation
- `Argentinosaurus / bonaparte1993` — corpus has English
  translation
- `Avimimus / kurzanov1981` — corpus has English translation

For pure translations (eight of these), the data should still be
extractable — translations of formal description papers preserve
the holotype/diagnosis content. The `paper_quality: translation`
flag is informational, not disqualifying. The actual problem cases
are `Abelisaurus`, `Adasaurus`, `Amargasaurus`, `Amurosaurus`, and
`Antarctosaurus` — those need citation corrections before retry.

**Real binomial discrepancies:**
- `Acanthopholis horrida` — paper writes `horridus` (Latin gender
  emendation; well-known historical issue, our YAML form is the
  modern accepted spelling)
- `Ahshislesaurus mcdonaldi` — paper writes `wimani` (likely
  wrong species in our YAML; needs cross-check)
- `Amargasaurus cazaui` — paper writes `groeberi` (artifact of the
  wrong-citation issue above)
- `Anoplosaurus curtonotus` — paper writes `Anoplesaurus
  curtonotus` (genus spelling difference; needs ICZN check)

**Cost / time:** ~127 Sonnet calls, run-time ~3 minutes wall clock
across 5 batches. Most agents used 3–7 tool calls; one outlier
(Achelousaurus pre-guardrail) used 23 before the prompt fix. After
the guardrail the maximum was 15 (Astrophocaudia, which was
struggling with the path-encoding bug).

**Next steps for letter A:**

- [x] Build `scripts/apply-paper-field-extractions.ts` and apply
      the accepted entries.
- [x] File side-finding issues: see #1862 (species-level
      diagnostics), #1863 (5 wrong `described_in` citations).
- [x] Retry Astrophocaudia with the path properly quoted.
- [ ] Hand-review the 6 `holotype_material: null` and 4 empty
      `diagnostic_features` cases — some may be salvageable from
      descriptive prose with a tighter prompt.
- [ ] Add a `holotype:` block to Agathaumas — the only insertion
      failure during apply (genus has no holotype subblock at all,
      which is a pre-existing data gap not addressed by this flow).

#### Post-run polish (2026-05-01)

Three quality fixes shipped on top of the raw extractions:

1. **Mechanical normalisation of extraction JSONs**
   (`scripts/normalize-extractions.ts`). Capitalises the leading
   ASCII letter of `holotype_material` and each
   `diagnostic_features` bullet; replaces en-dashes, em-dashes, and
   curly quotes with ASCII equivalents. Preserves semantic non-ASCII
   glyphs (°, ×, ², é, Greek letters). Idempotent. Letter-A pass
   updated 33 of 124 files with 60 changes.

2. **Spell-check pass over extractions**
   (`scripts/spellcheck-extractions.ts`). Runs cspell against
   `holotype_material` and each `diagnostic_features` bullet,
   classifies unknowns as either "suspicious shape" (digits,
   non-letter glyphs, or mixed-case in the middle — likely OCR
   garbage or typos) or "likely real terms" (legitimate paleo /
   anatomical vocabulary missing from the project dictionary).
   Letter-A: 685 snippets scanned, 0 suspicious, 347 likely terms
   surfaced for triage into `scripts/generate-dictionary.ts`
   `commonTerms`. The zero-suspicious result is a meaningful signal
   that the agent isn't introducing OCR artifacts of its own.
   Report: `reports/extracted-paper-fields-A-spellcheck.md`.

3. **Existing-corpus normalisation sweep**
   (`scripts/normalize-genera-text.ts`). Same character rules as (1)
   but applied at the file level over `genera/*/*.yml`. Defaults to
   dry-run mode and writes `reports/genera-text-normalization.md`
   with per-file change samples; pass `--apply` to write changes
   in place. Initial dry-run: 238 files, 362 replacements (207
   en-dashes, 89 em-dashes, 56 curly singles, 10 curly doubles).
   Most occurrences are in `references[].title` and `etymology`
   fields, e.g. "IV.—On Acanthopholis", "dell'Argentina",
   "Temerty — James being chairman". Apply pending review.

**Why the apply step is split into three.** The extraction JSONs,
the dictionary, and the existing YAMLs are three independent surfaces
with different review costs and rollback profiles. Keeping them as
separate scripts makes each one auditable in isolation and lets the
sweep (3) be batched into its own commit, separately from the
extraction-driven commits.

#### Specimen-ID stripping and institution-aware dictionary

The first spellcheck triage surfaced bare institution abbreviations
(`MGUAN`, `TMP`, `MACN`, `YPM`, `PIN`, ...) in the unknowns list. Two
issues were entangled:

1. The agent occasionally lifted catalog numbers verbatim into
   `holotype_material` despite the prompt asking it to drop them.
   These references duplicate the structured
   `species.holotype.specimen_id` and `species.holotype.institution`
   fields, so they were noise, not signal.
2. When abbreviations *legitimately* appear in prose (rare, but
   possible in older description papers), they should not be flagged
   as misspellings.

Two mechanical fixes addressed both:

- **`scripts/strip-specimen-ids-from-material.ts`** —
  institution-aware regex strip of catalog tokens from extraction
  `holotype_material` fields. Recognises three patterns:
  parenthetical (`(TMP 2001.26.1)`), leading prefix (`YPM 2195: …`),
  and mid-segment (`…hind limbs; PIN #3907/1; …`). Letter-A pass
  cleaned 8 entries. Defaults to dry-run; `--apply` to write.

- **`scripts/generate-dictionary.ts`** — extended to include all
  institution abbreviations (and their aliases) from
  `institutions.yaml`. Dictionary grew from 4,784 → 5,312 words.
  Provides defensive coverage so future legitimate prose mentions
  of an abbreviation don't trip the spellcheck.

Combined effect on letter-A spellcheck: 347 → 345 unknown words, 0
of which match any known institution abbreviation. The remaining
unknowns are all anatomical/paleontological vocabulary candidates
for `commonTerms` in the dictionary generator.

#### Hand-curated paleo vocabulary

The 345 unknowns left after the institution pass were a mix of
anatomical jargon (`anteroposteriorly`, `zygapophyseal`,
`vomeropterygoid`), fossil-group plurals (`alvarezsaurids`,
`velociraptorines`), lamina abbreviations (`acdl`, `acpol`), and a
small set of locality / formation names that legitimately appear in
description prose (Wealden, Uitenhage, Las Zabacheras, Udan-Sayr,
Abdrant Nuru). None looked like OCR artifacts after manual review.

These were seeded into a new flat-file dictionary,
`dictionaries/paleo-vocab.txt` (313 unique entries after
case-insensitive dedup). `scripts/generate-dictionary.ts` now reads
this file alongside `tree.yml`, `schema.yml`, `institutions.yaml`,
and the hard-coded `commonTerms` array, merging everything into the
generated `dictionaries/taxonomy.txt` that cspell consumes.

After regeneration: dictionary grew 5,312 → 5,625 words, and the
letter-A spellcheck dropped to **0 unknowns** across 685 snippets.

The split between `paleo-vocab.txt` (hand-curated, append-only) and
`taxonomy.txt` (auto-generated, never edited by hand) keeps the
review workflow simple. For future letter runs the loop is:

1. `npm run spellcheck-extractions -- --letter X`
2. Eyeball the unknowns; flag any OCR artifacts for re-extraction
3. Append the rest to `dictionaries/paleo-vocab.txt`
4. `npm run generate-dictionary`
5. Re-run spellcheck to confirm clean

#### Apply step (2026-05-01)

`scripts/apply-paper-field-extractions.ts` writes accepted
extractions back into the genus YAMLs. Filter rules: skip
EXTRACTION FAILED sentinels; skip `paper_quality: review/popular`
(citation-suspect, tracked under #1863); skip per-field if the YAML
already has it. String-level rewrite using `yaml.stringify` for the
inserted fields only — surrounding content untouched, formatting
preserved.

Letter-A apply results:

- **Applied**: 119 genera (1,467 line insertions across both fields)
- Skipped sentinel: 3 (Achelousaurus, Altispinax, Anchisaurus)
- Skipped non-primary: 4 (Abelisaurus, Amargasaurus, Amurosaurus,
  Antarctosaurus — all `paper_quality: review`)
- Skipped no-data: 1 (Adasaurus — translation but agent returned
  no usable data, figure caption only)
- Insertion failure: 1 (Agathaumas — genus has no `holotype:`
  block at all in its YAML, pre-existing data gap)

Validation post-apply: **0 errors**, 9 pre-existing unrelated
warnings.

Repository-wide impact:
- `diagnostic_features` missing: 1,295 → 1,176 (−119, −9.2%)
- `species.holotype.material` missing: 1,062 → 956 (−106, −10.0%)

Letter-A specifically:
- Material: 135 missing → 29 missing
- Diagnostic features: 146 missing → 27 missing

#### Existing-corpus text normalisation applied

`scripts/normalize-genera-text.ts --apply` swept the existing
`genera/*/*.yml` files: 238 files updated, 362 character
replacements (207 en-dashes, 89 em-dashes, 56 curly singles, 10
curly doubles).

**Gotcha worth carrying forward.** Three files broke YAML parsing
after apply because the replaced curly quotes were acting as
"scare quotes" inside otherwise-unquoted scalars. Once the curly
glyphs became ASCII delimiters, the YAML parser tried to read the
result as a quoted string and choked:

- `Bustingorrytitan.yml`: `locality: "Bustingorry II" Site` —
  re-quoted with single quotes around the whole value
- `Fulengia.yml`: `title: 'Modern' lizard from the Upper Triassic
  of China` — re-quoted with double quotes
- `Lophostropheus.yml`: a multi-line double-quoted reference title
  containing curly doubles `"Liliensternus"` — switched the outer
  scalar to single quotes so the inner doubles became content

These three needed a hand fix; `npm run validate` after `--apply`
caught all of them. For future similar sweeps, plan on running
validate as the final step and budgeting time to re-quote the
handful of scare-quote patterns it surfaces.
