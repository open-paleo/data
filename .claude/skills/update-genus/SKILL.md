---
name: update-genus
description: Backfill paper-derived fields (species.holotype.material, diagnostic_features) on an EXISTING genus YAML from its describing paper in the local corpus. Use when the user wants to fill missing material/diagnosis for one or more genera that already exist in genera/, or to re-extract after a corpus paper was added/fixed. Not for creating new genera (use intake-genus for that).
user-invocable: true
argument-hint: "<Genus> [citation_key]"
allowed-tools: Bash Read Write Edit Glob Grep Agent
---

# Update Genus

Fill paper-derived fields on an **existing** genus from a paper already
in the local corpus (`$OPEN_PALEO_PAPERS_DIR/markdown/<key>.md`). Scope:
`species.holotype.material` and top-level `diagnostic_features` (the same
fields the per-letter backfill handles). Existing values are never
overwritten.

The split between **extract** (LLM, produces a reviewable JSON) and
**apply** (deterministic, string-level YAML edit) is deliberate — review
the extraction before applying.

## When to use which entry point

- **One or a few genera** (the common case now that bulk backfill is
  done): build a custom prompt per genus pointing at the correct
  markdown (below).
- **A whole letter** at once: `npm run build-extraction-prompts -- --letter X`
  writes `reports/extraction-prompts-X.jsonl` (one ready prompt per
  queued genus, keyed off each genus's describing paper — `described_in`
  if set, else `erected_in`). Dispatch each row's `prompt` to a Sonnet
  agent.

## Authority model: erected_in vs described_in (#1886)

Each species carries **`erected_in`** (the nomenclatural act — the
authority) and an optional **`described_in`** (the authoritative
descriptive source: original description or later redescription).
`build-extraction-prompts` targets **`described_in` if set, else
`erected_in`**, so it already points at the right descriptive paper for
the reassigned / replacement-name cases that carry an explicit
`described_in` (e.g. Betasuchus → `seeley1883`, Paranthodon →
`galton1981`, Crichtonpelta → `lü2007b`).

If a reassigned genus's descriptive source differs from its `erected_in`
but has **no** `described_in` yet, point the extraction at the correct
reference by hand and add the `described_in` pointer while you are there.
When the paper uses the original binomial, tell the agent so in the prompt
("treated as *Megalosaurus bredai* in this paper").

The `described_in` target must resolve to a **reference-store** entry
(`references/<letter>/<key>.yml`) and be cited in the genus's
`references:` list as an `{id, notes?}` pointer. If that descriptive
paper is not yet in the store, create its `references/<letter>/<key>.yml`
(canonical fields; no DOI-pointer `url`, no `notes`) and add the pointer
to the genus's `references:` before validating — and stage the new store
file together with the genus file when committing.

## Per-genus flow

1. **Pick the source paper.** Read the genus YAML; choose the markdown
   key — the species's `described_in` if set, else its `erected_in`.
   Confirm `$OPEN_PALEO_PAPERS_DIR/markdown/<key>.md`
   exists and is substantive (not an abstract/fragment). If it is
   missing or wrong, log it in the corpus repo's
   `corpus-paper-report.md` and stop.

2. **Dispatch a Sonnet extraction agent** that reads ONLY that markdown
   and writes JSON to `reports/extractions/<Letter>/<Genus>.json` with
   this schema (it is gitignored scratch):
   ```
   {"genus","species","described_in","holotype_material":"≤200 chars, drop
    catalog numbers","diagnostic_features":["3–6 autapomorphy bullets"],
    "binomial_in_paper","paper_quality":"primary|review|popular|translation|other",
    "notes"}
   ```
   Tell it: do NOT invent; `null`/`[]` when absent; focus only on the
   target taxon if the paper covers several; write an `EXTRACTION FAILED`
   sentinel if the markdown is empty/boilerplate.

3. **Review** the extraction:
   - Material matches the `specimen_id` we already have; trim any
     embedded catalog numbers and locality/collector tails; null a value
     that is only a bare specimen number.
   - Diagnosis bullets are autapomorphies, not clade-shared traits;
     condense to 3–6; American English (e.g. armour→armor).
   - Spot-read the markdown if anything looks off.

4. **Spellcheck the JSONs before apply** (catches typos + AE early):
   ```
   npm run spellcheck-extractions -- --letter X
   ```
   Fix `suspicious` shapes in the JSON; add genuine `likely terms` to
   `dictionaries/paleo-vocab.txt`, then `npm run generate-dictionary`.

5. **Strip specimen IDs, then apply** (strip edits JSONs, so it runs
   BEFORE apply):
   ```
   npm run strip-specimen-ids -- --letter X
   npm run apply-paper-fields -- --letter X            # dry-run
   npm run apply-paper-fields -- --letter X --apply
   ```
   Apply skips `review`/`popular` quality, sentinels, and already-filled
   fields.

6. **Validate & lint:** `npm run validate` (0 errors; no new warnings),
   `npm run lint`. Then show the diff and wait for the user before
   committing.

## Notes

- Extraction artifacts under `reports/extractions/` and the
  `extraction-*`/`extracted-*` files are gitignored scratch.
- Corpus-quality problems (missing / wrong / abstract-only markdown,
  wrong-paper-content, erected_in-vs-descriptive-source cases) go in the
  corpus repo's `corpus-paper-report.md`.
- `erected_in` is the species authority — do not repoint it to a
  descriptive paper. Record a differing descriptive source as
  `described_in`, which falls back to `erected_in` when omitted.
