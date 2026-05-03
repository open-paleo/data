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

Per-letter batch entries (sentinel categories, paper-level typos
caught, accept counts, prompt tweaks) live in
`reports/paper-driven-backfill-log.md`. That file is append-only —
add a new entry at the top of its "## Entries" section after each
letter and do not re-read past entries during routine work.
