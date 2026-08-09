---
name: audit-formations
description: Audit the citation pointers of formations.yaml against the primary papers they name, to catch pointers that misrepresent what the cited paper says (#2069). Assembles the registry's cited papers, condenses each into a committed, reusable STRATIGRAPHIC ground-truth record ($corpus/condensed-strat/<ref_id>.json), runs deterministic Tier-0 checks (wrong paper, quote absent, quote lifted from the cited paper's own bibliography, unit never named) and a semantic Tier-1 per-entry check (paper-does-not-name-unit, direction-inverted, incomplete-list, misattributed, overstated, field-unsupported), and emits a findings report plus a durable re-audit queue. Firewalled (papers read inside agents, all on Sonnet) and read-only — findings go to a human gate, never auto-applied. Use when the user wants to run or re-run the formations registry citation audit, work one of its finding buckets, or check a single registry entry against its sources.
user-invocable: true
argument-hint: "[Unit]"
---

# Audit Formations

Verify every citation pointer in `formations.yaml` against the **primary paper it
cites**, and report the ones that misrepresent what the paper actually says. This
is the engine for the **#2069 registry citation audit**; sibling to
`audit-disputes`, which does the same job for genus and clade `dispute` blocks.

The audit is **firewalled and read-only**. Papers are read *inside* agents; the
main thread works from their returned JSON. **The skill never edits
`formations.yaml`** — findings go to a report for a human gate. All condensation
and audit agents run on **`model: "sonnet"`** (the parent model is Opus; agents
inherit it unless overridden — always override).

## Why the registry is different from every audit before it

Every prior audit checked a **record** against its paper. This checks the
**registry**, which is upstream of the records. A wrong member list produces no
validation error — it silently defines what "correct" means for every record
that resolves through it. The Horseshoe Canyon error survived #2045, #2058 and
#2060's own scoping and was found only because a formation-name sweep happened to
touch the entry.

## The error classes (why the design is shaped this way)

1. **Wrong paper under a ref-id** — `brusatte2012b`, *The Osteology of Alioramus*,
   cited for the Horseshoe Canyon member scheme. → Tier-0, title check.
2. **Quote lifted from the cited paper's own bibliography** — the note quotes
   `"<Unit> Formation (<Stage>)"` and the string does occur in the paper, as the
   *title of a work in its reference list*. The paper asserts nothing. This is
   the systematic defect: the shape is always horizon-line phrasing, the
   signature of a corpus-wide string match that landed on a reference list.
   → Tier-0, bibliography-offset check. **This class is invisible to a plain
   grep**, which is why it went unnoticed.
3. **Quote absent** — the span is nowhere in the paper. → Tier-0.
4. **Claim direction inverted, list incomplete, or attribution laundered** — the
   citation is real and names the unit, but the note reverses an ordering, drops
   members, or presents another work's statement as the cited paper's. The
   Horseshoe Canyon note was exactly this: **two members missing and one
   inverted, in a claim that quoted nothing.** → caught ONLY by the Tier-1
   semantic read, and never gated behind Tier-0.

## The durable asset: stratigraphic condensations

Each cited paper is read ONCE by a firewall agent and condensed into
`$corpus/condensed-strat/<ref_id>.json` — committed in the CORPUS repo, reused by
every future run, re-read only when `source_sha256` changes.

**This is a separate namespace from `$corpus/condensed/`**, which holds the
placement/affinity records `audit-disputes` built. Those 600+ records are keyed
to a different question and say nothing about member lists, containment or rank;
folding this schema into them would leave every existing record hash-valid but
silently unable to answer a stratigraphic claim.

**Extract paper-complete, NOT entry-filtered**: capture every unit the paper says
anything structural about, so a record built here answers a future run's question
— and #2045's, #2049's and #2047's — without a re-read. Schema and rationale:
`condense-instructions.md`.

## Scripts (in this skill directory)

- `assemble.py` — Phase A. Registry → loci (entries carrying `references:`) →
  pointers → papers, classified and hashed. `--unit NAME` (repeatable) restricts
  to one entry for a pilot. Writes `scratch/audit-formations/manifest.json` AND
  one Tier-1 input file per entry under `scratch/audit-formations/loci/`,
  clearing that directory first. **Never hand-build those files.** They went
  stale behind a round of note edits once and an agent audited wording that had
  already been replaced; it caught the mismatch and read the live registry, but
  only by luck. Re-run `assemble.py` then `tier0.py` after ANY registry edit.
- `source_quality.py` — the extraction preflight. Not a checker of the registry:
  it decides whether Tier-0 *can* answer its own questions on a given paper, and
  names the papers whose extraction has to be repaired in the CORPUS.
- `tier0.py` — the four deterministic checks. Writes `tier0.json`, and folds
  each unit's flags into its locus file so the Tier-1 agent gets the slice for
  the entry in front of it rather than a whole file to skim.
- `report.py --date YYYY-MM-DD` — assembles the findings report AND updates the
  durable re-audit queue.
- `condense-instructions.md`, `tier1-instructions.md` — agent instruction files;
  each agent is dispatched with the shared file plus its per-item paths.
- `_paths.py` — path resolution (honors `OPEN_PALEO_PAPERS_DIR`; else siblings).

Run scripts with `python3` **from this skill directory**, so `import _paths`
resolves.

---

## Phase 0 — Assemble (deterministic)

```
python3 assemble.py
```

Read the printed summary: loci, pointers, papers to condense, reference-works
skipped, coverage gaps, and papers **filed under a reverse-suffixed twin**. That
last line is not a gap: `eberth2012a` is a properly minted dataset key whose
corpus file is still `eberth2012z.md`. Resolve and audit it; never rename a
corpus markdown file to fix it.

The last line, **extraction degraded**, is a different kind of thing from every
other line in the summary: it names papers whose MARKDOWN is defective, and no
edit to `formations.yaml` answers any of them. Route them to the papers
repository. They are surfaced here, before a single agent runs, precisely so
they are found proactively rather than arriving later disguised as a finding
against an entry that is correct.

Two defects are detected, and they bend the audit in OPPOSITE directions:

- **`reference-list-heading-missing`** → *false negatives.* Checks C and D both
  ask "is this only in the reference list?", so they need the body/bibliography
  boundary. When no heading is found the boundary is inferred from citation
  shape, and both checks get weaker — before this preflight existed the boundary
  silently became "end of document" and both checks quietly passed everything.
  That is how a `paper-does-not-name-unit` on Marília went unseen by Tier-0 in
  the 2026-08-08 run while Tier-1 caught it. A pass on a pointer listed under
  `checks_degraded` is worth less than a pass elsewhere.
- **`interleaved-line-numbers`** → *false positives.* A line-number gutter puts
  integers between the words of every sentence, so an honest quotation fails an
  exact match and Tier-0 reports a quote that is plainly on the page.

A paper with **no reference list at all** — a 19th-century notice, a one-page
description — is neither of these and is not reported: nothing can be
bibliography-only in a paper that cites nothing, so checks C and D are sound.

## Phase 1 — Condense each paper ONCE (firewall, Sonnet)

For every manifest paper with `in_corpus: true` and
`classification != reference-work`, check `$corpus/condensed-strat/<ref_id>.json`:
missing, or stored `source_sha256` ≠ the manifest's → (re)condense; hash matches
→ reuse, do not re-read.

Dispatch one firewall agent per paper, **on Sonnet**, each told to follow
`condense-instructions.md` with its `ref_id`, source markdown path (the one the
manifest resolved, twin included), `source_sha256`, run date, and output path.
Fan out in batches; the concurrency cap queues the rest.

**Validate before proceeding**: every produced JSON conforms to the schema, and —
because Opus is the parent — confirm the extraction ran on Sonnet by checking the
condensation-writing turns in the agent transcripts. Filter to transcripts that
actually wrote a `condensed-strat/*.json`; the shared task-output directory also
holds old transcripts.

## Phase 2 — Tier-0 (deterministic)

```
python3 tier0.py
```

**Every Tier-0 flag is a candidate, not a verdict.** Two failure modes to hold in
mind, both seen in the pilot:

- **A failed exact match on a scanned or pre-1990 source proves nothing.**
  `2Æ3 km` for `2.3 km`, `(D` for `(=`, `S^ınpetru` for `Sânpetru`, `Rheatian`
  for `Rhaetian` — all real, all clean on inspection. Markdown link markup
  (`[\(Assine, 1990,](#page-10-6)`), `<br>` inside a table cell, and a figure
  caption dropped into the middle of a sentence all do the same thing.
- **Quotes that matched only through a line-number gutter are already sorted
  out of `quote_absent`** and reported under source quality instead. Do not
  re-report them as findings; the paper needs repairing, the entry does not.
- **Spacing diacritics are repaired automatically** and are no longer a source
  of flags. Extraction renders a precomposed glyph as base letter plus a
  spacing character — `Ferna´ndez`, `Echapor~a`, `Alcobac¸a`, `Lourinha˜` — in
  487 of 2354 corpus files. Unicode normalization does not touch these, so
  folding used to split one word into two and report a unit as absent from a
  paper that names it repeatedly. `fold` now strips them first. A flag that
  survives is therefore a real mismatch, not a diacritic artifact. The
  exception is `S^ınpetru`, where the base letter itself was substituted.
- **The unit-absent check fires correctly on honest notes.** Several entries
  exist to record that a paper names no formal unit, and their notes say exactly
  that. Read the note before calling it a finding.

## Phase 3 — Tier-1 semantic audit (firewall, Sonnet)

Dispatch one agent per **entry** (not per pointer), **on Sonnet**, each told to
follow `tier1-instructions.md` with the unit name, its fields and pointers, the
absolute `<CONDENSED_DIR>` (`$corpus/condensed-strat`), the Tier-0 result path,
and its output path `scratch/audit-formations/tier1/<unit>.json`.

Per-entry, not per-pointer, because the agent must see the whole entry to check
**Direction 2** — that each structural field (`rank`, `parent`, `contains`,
`stages`, `variants`) is supported by *some* cited paper. A field no paper
supports is a finding even when every note is individually accurate.

Enforce the guardrails from the instructions, above all:

- **THE UNION RULE.** `stages` is the UNION of what the sources publish, an
  envelope for checking records — not a consensus and not a choice. A paper
  giving a narrower range than the envelope is what the field is *for* and is
  never a finding. Narrowing an envelope to match one paper manufactures
  findings; it has changed the answer wrongly five times.
- **Deliberate exclusions are policy, not defects** — the Xiashaximiao /
  Shangshaximiao subunit call and the Sânpetru orthography are recorded in the
  registry header and must not be relitigated.
- **Verify BOTH directions.** A clean entry is a good result; do not manufacture
  a discrepancy to have something to report.

**A Tier-1 `clean` is softer evidence than a Tier-1 finding.** In the
2026-08-08 run one batch was dispatched twice by accident: same entries, same
condensations, same instructions. The second pass reproduced every finding and
found one more — that `Baynshire`'s `variants` are attested by no cited paper.
Nothing was missing from the evidence; the first agent simply enumerated the
entry's fields less completely. Direction 2 is where this bites, because it asks
an open question ("which fields does no paper support?") rather than checking a
given claim. Treat a clean sweep as *this pass found nothing*, and re-run a
batch when a clean result is load-bearing.

## Phase 4 — Report + re-audit queue

```
python3 report.py --date <today>
```

Writes `scratch/audit-formations/report.md` (regenerable, gitignored) and updates
`reaudit-queue.yml` (durable, committed) from the Tier-1 `unverifiable_pointers`.
The queue's two sections work as in `audit-disputes`: `pending` entries are live
and removed by hand once the source is repaired **and** the units re-audit clean;
`dismissed` entries are adjudicated and never re-added by a later run.

Before presenting, triage by confidence:

- **Solid** — the condensation plainly contradicts the note (unit absent; quote
  from a bibliography; ordering inverted; member list short).
- **Judgment** — e.g. a note that credits a third party in its own prose while
  hanging off another paper's pointer. Honest sourcing, but a modeling smell
  worth a separate pointer.
- **Weak** — rests on a condensation flagged truncated or OCR-degraded. Route to
  the re-audit queue rather than asserting.

### HARD STOP — present findings, wait for the user

Present coverage numbers, Tier-0 findings, Tier-1 findings by confidence, and the
queue additions. **Do not edit `formations.yaml`.** Wait for the user to decide
which findings to fix.

## Phase 5 — Work the findings (one at a time, at the human gate)

Fixes are a separate, gated pass. **One finding at a time.** For each:
investigate (the entry, the ref-store entries, the condensation, and — the moment
a claim turns on a subtle point — **the primary paper markdown directly**,
through OCR garbling if needed), present the evidence and a recommended
disposition, and act only on the user's call. Then `npm run validate` after the
edits; don't commit or push unless told.

**A finding is not always a YAML edit.** Dispositions seen so far:

- **Re-point to the paper that actually says it.** Often it is already in the
  corpus: the Lianmuqin `"?Valanginian-Albian"` quote, credited in prose to
  Rauhut and Xu (2005), is stated verbatim by `rauhut2005c` in the corpus. Verify
  against the primary before re-pointing.
- **Re-key a reverse-suffixed corpus paper.** Where an entry needs a `z`/`y`/`x`
  paper, mint an `a`/`b`/`c` key and a reference-store entry, as was done for
  `eberth2012a`. Verify metadata against Crossref rather than the corpus copy —
  the page range for `eberth2012a` was not recoverable from the scanned text and
  came from the DOI.
- **Drop the quotation marks, keep the claim.** Where a note paraphrases inside
  quotation marks (`"mid-late Toarcian"` for a paper's *early-mid* Toarcian), the
  fix may be the wording, not the source — but check the paraphrase did not also
  shift the value.
- **Requote from the paper, never from the condensation.** A note whose quoted
  span reproduces a condensation's `value` was written from the extraction
  record rather than the source; `value` is the extractor's paraphrase and is
  never quotable, only `verbatim` is. Tremp was exactly this. When rewriting a
  note, take the words from the paper (or from `verbatim`, which is copied from
  it) — and reach for the markdown directly whenever the wording carries the
  claim. The registry header states the rule for every writer, not just this
  skill's agents.
- **Correct the structural field, not just the prose.** The Horseshoe Canyon note
  was wrong *and* the members it named were wrong. Fixing the citation alone
  would have left the error in place.
- **Registry prose is reference, not process.** Notes describe UNITS: no ticket
  numbers, no corpus counts, no commentary on our own records.
