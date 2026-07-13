---
name: audit-disputes
description: Audit the dispute-block and description-prose citations of one clade subtree against the primary papers, to catch citations that misrepresent what the cited paper says (#1968). Assembles the slice's cited papers, condenses each primary paper ONCE into a committed, reusable ground-truth record ($corpus/condensed/<ref_id>.json), runs deterministic Tier-0 bibliographic checks (wrong-paper-under-a-ref-id) and a semantic Tier-1 per-locus claim check (direction-inverted, overstated, taxon-absent, misattributed), and emits a findings report plus a durable re-audit queue for cited-but-missing papers. Firewalled (papers read inside agents, all on Sonnet) and read-only — findings go to a human gate, never auto-applied. Use when the user names a clade to audit (e.g. "audit Ankylosauria disputes", "run the citation audit on Hadrosauridae"). Requires the clade name; the issue is #1968.
user-invocable: true
argument-hint: "[Clade]"
---

# Audit Disputes

Verify every load-bearing citation in the `dispute:` and `description:` prose of
one clade subtree against the **primary paper it cites**, and report the ones
that misrepresent what the paper actually says. This is the repeatable engine for
the **#1968 dispute/description citation audit**; sibling to the #1962 re-eval,
which found these errors occur at a nontrivial rate (see the audit memories).

The audit is **firewalled and read-only**. Papers are read *inside* agents; the
main thread works from their returned JSON. **The skill never edits dataset
prose** — findings go to a report for a human gate, exactly like #1962. All
condensation and audit agents run on **`model: "sonnet"`** (the parent model is
Opus; agents inherit it unless overridden — always override).

## The three error classes (why the design is shaped this way)

1. **Wrong paper, same author+year** (a different paper filed under the ref-id).
   → caught DETERMINISTICALLY (Tier-0): condensation bibliography vs reference-store title/DOI.
2. **Taxon absent** — the cited paper doesn't contain the taxon the claim is about.
   → caught by Tier-1 (taxon not in the paper's condensed `taxa_treated`).
3. **Claim direction inverted / overstated** — the citation is real and names the
   taxon, but the prose says the opposite of, or more than, what the paper found
   (e.g. "disagreed" when it agreed; a firm result when the paper only mentions it).
   → caught ONLY by the Tier-1 semantic read. This is the insidious class and it
   is NEVER gated behind Tier-0.

## The durable asset: paper condensations

Each cited primary paper is read ONCE by a firewall agent and condensed into
`$corpus/condensed/<ref_id>.json` — committed in the CORPUS repo, reused by every
future slice, re-read only when `source_sha256` changes. **Extract paper-complete,
NOT slice-filtered**: capture every taxon the paper makes a placement claim about,
so a record built here answers a future slice's question without a re-read. Schema
and rationale: `condense-instructions.md` (agent-facing) and the audit memories.

## Scripts (in this skill directory)

- `assemble.py <Clade>` — Phase A. Slice → loci with dispute blocks → union of
  cited ref-ids → classify (primary / reference-work / not-in-corpus). Writes
  `reports/audit/<Clade>/manifest.json`. For a slice too large for one review
  gate (≳40 loci), carve it into disjoint **sub-slices** with `--exclude CLADE`
  (repeatable), which drops that clade's whole subtree — e.g. audit
  `Hadrosauridae` on its own, then `Hadrosauroidea --exclude Hadrosauridae`, then
  `Ornithopoda --exclude Hadrosauroidea`. Each sub-slice runs the full
  assemble→condense→tier0→tier1→report→fix cycle independently.
- `tier0.py <manifest>` — deterministic bibliographic checks. Writes `tier0.json`.
- `report.py <work-dir> --date YYYY-MM-DD` — assembles the findings report AND
  updates the durable re-audit queue.
- `condense-instructions.md`, `tier1-instructions.md` — the agent instruction
  files; each agent is dispatched with the shared file + its per-item paths.
- `_paths.py` — path resolution (honors `OPEN_PALEO_PAPERS_DIR`; else siblings).

Run scripts with `python3` from the skill directory (so `import _paths` resolves).

---

## Phase 0 — Assemble the working set (deterministic)

```
python3 assemble.py <Clade>
```

Read the printed summary: loci count, papers to condense, reference-works
skipped, and the **not-in-corpus coverage gaps**. No agents yet.

## Phase 1 — Condense each primary paper ONCE (firewall, Sonnet)

For every manifest paper with `in_corpus: true` and `classification != reference-work`,
check `$corpus/condensed/<ref_id>.json`:
- missing, or its stored `source_sha256` ≠ the manifest's → (re)condense.
- present and hash matches → reuse; do not re-read.

Dispatch one firewall agent per paper needing condensation, **on Sonnet**, each
told to follow `condense-instructions.md` with its `ref_id`, source markdown path,
`source_sha256`, and output path `$corpus/condensed/<ref_id>.json`. Fan out in
batches; the concurrency cap queues the rest.

**Validate before proceeding**: every produced JSON conforms to the schema
(required keys, 64-char sha, valid `claim_type`/`confidence`), and — because
Opus is the parent — confirm the extraction ran on Sonnet by checking that the
condensation-writing turns in the agent transcripts are `claude-sonnet-5`. (Note:
the shared task-output directory also holds OLD transcripts; filter to the
transcripts that actually wrote a `condensed/*.json` before counting models.)

## Phase 2 — Tier-0 deterministic checks

```
python3 tier0.py reports/audit/<Clade>/manifest.json
```

Flags wrong-paper-under-a-ref-id (title/DOI) and not-in-corpus coverage gaps.
**Year is corroborating-only**: a ref-id key name or citation year differing from
the printed year is the expected online/print convention and is NEVER a finding on
its own. **Verify any HIGH Tier-0 flag by hand** before trusting it — reference-
store titles use `[...]` for translated titles and may carry a longer subtitle;
containment (not Jaccard) handles this, but confirm the flag is a real different
publication (e.g. a 2000 chapter under a 1987 key), not a title-phrasing artifact.

## Phase 3 — Tier-1 semantic audit (firewall, Sonnet)

Dispatch one agent per locus, **on Sonnet**, each told to follow
`tier1-instructions.md` with the locus name/kind, its YAML path, the absolute
`<CONDENSED_DIR>` (`$corpus/condensed`), and its output path
`reports/audit/<Clade>/tier1/<locus>.json`.

Each agent compares each load-bearing claim to the cited paper's condensation and
returns findings (usually none). Enforce the guardrails from the instructions:
- **Scope to placement/affinity/validity/nomenclatural claims.** A reference cited
  only for a non-placement datum (mass, hip height, integument, histology) is NOT
  a taxon-absent finding — skip it as out-of-scope.
- **Verify BOTH directions.** If prose and condensation agree, that is `consistent`
  — do not manufacture a discrepancy. A paper may be cited for a hypothesis it
  entertains without endorsing.

## Phase 4 — Report + re-audit queue

```
python3 report.py reports/audit/<Clade> --date <today>
```

Writes `reports/audit/<Clade>.md` (regenerable, gitignored) and updates
`reports/audit/reaudit-queue.yml` (durable, committed): for every not-in-corpus
paper and every truncated/incomplete source, it records which loci to re-audit
when that paper lands or is repaired. This is how a coverage gap becomes a
tracked, actionable backlog instead of being silently dropped.

Before presenting, triage the Tier-1 findings by confidence:
- **Solid** — condensation clearly contradicts the prose (wrong paper for the
  claim; taxon genuinely absent; direction inverted).
- **Judgment** — e.g. an anachronistic-but-substantively-correct name (a taxon
  cited under a name that postdates the paper via a later synonymy).
- **Weak** — rests on a condensation the extractor flagged as truncated/partial;
  route to the re-audit queue rather than asserting.

### HARD STOP — present findings, wait for the user

Present the report: coverage numbers, Tier-0 findings, Tier-1 findings grouped by
confidence, and the re-audit-queue additions. **Do not edit any dataset file.**
Wait for the user to decide which findings to fix.

## Phase 5 — Work the findings (one at a time, at the human gate)

Fixes are a separate, gated pass — like the #1962 apply step. **Pace/flow: take one
finding at a time.** For each: investigate (read the locus YAML, the ref-store
entries, the condensation, and — the moment a claim turns on a subtle point —
**re-check the PRIMARY paper markdown directly**, through OCR garbling if needed),
determine the disposition, present the evidence + a recommended disposition, and
act only on the user's call. Then `npm run validate` (expect 0/0) after the
data-repo edits; don't commit/push unless told.

**A finding is not always a YAML edit.** Most resolve into one of these
dispositions (each seen in the Ankylosauria pilot):

- **Re-point a wrong-suffix citation** — right author+year, wrong paper (a sibling
  key is correct). VERIFY the correct paper actually makes the claim against its
  primary markdown before re-pointing — the string may be OCR-garbled (Nodosauridae:
  `marsh1890b` → `marsh1890a`, whose "Nodosauridae" was OCR'd as "Nodo8Ctlt1'idm";
  fix both `erected_in` and the reference `notes`).
- **Correct paper not in corpus → fetch first, don't assert from Wikipedia.** When
  the real source is identified (often via the Wikipedia reference list — the
  citation-snowball) but not in the corpus, do NOT cite its claim wording from
  Wikipedia alone. Park the fix, add a `fetch-pending` re-audit-queue entry (with
  the correct bib + DOI and the exact re-point to do), and complete it after the
  user fetches + it is condensed + verified (Sinankylosaurus: `zheng2021a` = the
  *Caudipteryx* paper; correct source is a different Zheng 2021).
- **Deeper data-modeling error → file an issue + fresh intake.** If the finding
  exposes a mis-modeled locus (e.g. a nomen nudum promoted to type species while
  carrying the real type species' holotype/erecting paper), do NOT patch inline.
  File a GitHub issue (labels `Audit`, `Taxonomy`); the fix is to re-source the
  correct erecting/describing paper and rebuild via `/intake-species` (or
  `/intake-genus`), **including a dispute-block cleanup** (Palaeoscincus → issue).
- **Corpus-side problem (data is correct) → log in the corpus report.** If the
  ref-store entry and the dataset citation are correct but the corpus MARKDOWN is
  the wrong paper filed under the key, the fix is corpus-side: never rename corpus
  files yourself — add a row to `corpus-paper-report.md` (§1). The mislabeled
  condensation self-heals on re-file (its `source_sha256` changes → re-condense)
  (tumanova1987a: markdown is the 2000 chapter, ref is the 1987 monograph).
- **Anachronistic-but-substantive attribution → bounded reword.** The paper made
  the claim about a name/taxon that a later synonymy folded into this genus. Reword
  to attribute it to the name the paper actually used, crediting the later synonymy
  — don't erase the claim (Glyptodontopelta: Vickaryous 2004 called *Edmontonia
  australis* dubious; Burns 2008 synonymized it in + revalidated).
- **Weak finding from a truncated/incomplete source → verify independently; likely
  a FALSE POSITIVE.** A `taxon-absent` flag can be a source-truncation artifact.
  Confirm the underlying fact independently (e.g. the Wikipedia authority); if the
  data is actually correct, make NO data edit — log the corpus truncation
  (`corpus-paper-report.md` §1) and annotate the re-audit-queue entry
  (Polacanthoides: `erected_in: nopcsa1928a` is correct; nopcsa markdown truncates
  before reaching the taxon).

Always **verify both directions** before acting: an agent-flagged finding can be a
false positive, and a claim that looks wrong can be right once the primary paper
(or its correct edition) is read.

## Guardrails (standing)

- All condensation + Tier-1 agents on **`model: "sonnet"`**; verify from transcripts.
- **Read-only skill.** No prose edits without the Phase-5 human gate.
- **Paper-complete, not slice-filtered** condensation (else future slices re-read).
- **Both tiers run**; Tier-0 never gates the Tier-1 semantic check.
- **Year is corroborating-only**; never a standalone finding.
- **Scope taxon-presence to placement citations.**
- **Verify both directions**; agreement is a valid, expected result.
- **Coverage gaps go to the re-audit queue**, never silently dropped.
