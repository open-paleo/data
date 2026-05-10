# Bucket D — Session Handoff

Snapshot of where Bucket D ("Disputed") intake stands as of the
session that ends 2026-05-09. A future session can pick up cleanly
from this document.

## Status by category

| Category | Done / Total | State |
|---|---|---|
| **I — Stale flag** | 3 / 3 | ✅ complete (Protoceratops, Psittacosaurus, Thecodontosaurus) |
| **II — Active dispute** | 2 / 5 | in progress — see below |
| **III — Nomen dubium minimal stub** | 15 / 17 | ✅ except 2 deferred |
| **IV — Type genus retained** | 2 / 2 | ✅ complete (Ceratops, Titanosaurus) |
| **V — Wastebasket** | 3 / 3 | ✅ complete (Bothriospondylus, Euskelosaurus, Pelorosaurus) |
| **VI — Identity reassignment** | 3 / 3 | ✅ relabelled `Needs More Information`, intake held |
| **VII — ICZN-invalid** | 1 / 1 | ✅ complete (Natronasaurus → synonym in Alcovasaurus) |
| **VIII — Close-without-intake** | 3 / 3 | ✅ already closed pre-session |

## Remaining Cat II work (3 genera)

All three are active validity disputes that warrant multi-paper
neutral intake (Bucket-C-style, both sides captured). Use the
new `dispute:` field added to GenusData for the contested-status
callout (kept separate from `description:`).

### Sauroniops (#1393)

- **Triage:** 2013 Cau et al. Kem Kem carcharodontosaurid; 2020
  Ibrahim et al. argued junior synonym of *Carcharodontosaurus*;
  2022 Paterna & Cau rebutted; 2025 Kellermann et al. called
  nomen dubium.
- **Likely papers needed:** `cau2013` (describing), `ibrahim2020`
  (anti, junior-synonym argument), `paterna2022` (pro,
  rebuttal), `kellermann2025` (anti, nomen dubium).
- **Disambiguation:** none anticipated; check sibling keys
  during bootstrap.

### Tianzhenosaurus (#1597)

- **Triage:** Huiquanpu Fm ankylosaurid; Sullivan 1999 + Arbour &
  Currie 2015 synonymized with *Saichania*; 2024 Pang, Li & Guo
  described second species T. chengi treating *Tianzhenosaurus*
  as valid. No broad consensus.
- **Likely papers needed:** describing paper (Pang et al. 1998
  or similar), `sullivan1999` (anti), `arbour2015` (anti),
  `pang2024` (pro, names second species T. chengi).
- **Disambiguation:** none anticipated.

### Trigonosaurus (#1646?)

- **Triage:** vs. Baurutitan synonym (Silva Junior et al. 2022);
  Fronimos 2023 disputed.
- **Likely papers needed:** describing paper (Campos et al.
  2005), `silvajunior2022` (anti, junior synonym), `fronimos2023`
  (pro, rebuttal).
- **Disambiguation:** none anticipated.

## Remaining Cat III work (2 deferred)

Both blocked on hard-to-obtain papers. Status flagged
`[deferred ...]` in `reports/intake-triage.md`.

- **Bienosaurus** (#232) — Lower Lufeng Fm thyreophoran; possibly
  identical to *Tatisaurus* per Raven et al. 2019; deferred for
  Cretaceous Research paywall.
- **Brachypodosaurus** (#254) — Lameta Fm; Chakravarti 1934
  describing paper not easily accessible.

## Outstanding cross-cutting work

### `dispute:` field retroactive migration

The `dispute:` field was added to `GenusData` in `scripts/types.ts`
during the Paulodon intake (commit `37fb4a0`). The Cat II/V genera
already shipped do NOT yet use it — their description fields still
contain mixed prose. Candidates for migration:

- **Nanotyrannus** (e5c5832) — long Wikipedia para 1 ending with
  the dispute summary; description and dispute could be cleanly
  separated.
- Other Cat II/V genera as touched.

This is optional polish, not blocking.

### Audit task #1866

Open GitHub task issue [#1866](https://github.com/open-paleo/data/issues/1866)
calls for an audit pass over EVERY genus YAML to verify
description-prose claims trace back to corpus papers,
Wikipedia paragraph 1, or triage notes. Triggered by the Wilson
2003 / Dryptosauroides miscitation incident in this session.
Post-Bucket-D this is the highest-priority cross-cutting task.

### `corpus-paper-report.md` follow-ups

Three §1 entries logged this session for papers not in corpus
when the intake shipped — re-extract once the paper is fetched:

- **Embasaurus** (`riabinin1931`) — Russian-language hardcopy
  on order at session end
- **Euronychodon** (`antunes1991`) — French Comptes Rendus
- **Chiayusaurus** (`bohlin1953`) — partial corpus only;
  systematic-description section missing on p. 45

§5 holotype follow-ups:
- **Calamospondylus** — `status: unknown` in holotype block;
  re-extract for specimen_id once available
- **Chiayusaurus** — same pattern

## Memory rules added this session

All persisted in `~/.claude/projects/.../memory/`:

- `feedback_verify_against_corpus` — When a paper exists in the
  corpus, MUST inspect it before attributing claims; never cite
  from general/Wikipedia recall.
- `feedback_wikipedia_fallback_pattern` — Cat III intake recipe
  when describing paper isn't obtainable; hard-stop required
  per paper.
- `reference_wikipedia_cache` — Local Wikipedia cache at
  `~/Desktop/open-paleo-wd/wikipedia/<Genus>.json`; check
  before WebFetch.
- `feedback_publication_priority` — 19th-c. Magazine notice
  often has ICZN priority over fuller Society paper published
  N+1 — check Wikipedia for actual year of priority.

## Skill updates shipped

`.claude/skills/intake-genus/SKILL.md` (commit `5067a934`) was
updated to codify session learnings: bootstrap-key verification
protocol, Wikipedia-fallback hard-stop pattern, description =
Wikipedia para-1 verbatim, PBDB seed corrections being routine,
and verify-every-paper-attributed-claim discipline.

## Resume workflow

1. Read `reports/intake-triage.md` — the `[done <sha>]` markers
   show per-row status; rows without markers are pending.
2. Pick up at the next Cat II row (Sauroniops #1393).
3. Apply the standard `intake-genus` skill flow with the
   updated guidance from `.claude/skills/intake-genus/SKILL.md`.
4. Use the `dispute:` field for active-dispute callouts.
