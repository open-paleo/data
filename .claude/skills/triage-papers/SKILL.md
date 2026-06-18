---
name: triage-papers
description: Triage the papers from a Paper Watch issue for a given date. Finds the issue, locates which of its papers are already in the local corpus (by DOI), classifies each into an action bucket (new taxon, redescription, appearance/soft-tissue, gated taxonomic change, or not useful), posts a worklist comment with ready-to-run skill invocations, and auto-dismisses (ticks) the not-useful items. Use after a daily Paper Watch issue is filed and the papers have been pulled into the corpus, when the user asks to triage / bucket / make a worklist from the watch issue. This skill never edits genera/ data — it only reads the corpus and writes to the GitHub issue.
user-invocable: true
argument-hint: "[today|yesterday|YYYY-MM-DD]"
---

# Triage Papers

Turn a Paper Watch issue into an actionable worklist. The skill is a
**classifier/router**: it judges each retrieved paper and recommends a
command, but it NEVER edits `genera/` data — the actual changes happen when
the user runs the suggested `/update-genus` or `/intake-genus`.

The watcher already did the discovery and noise-filtering; this skill judges
only papers that have actually landed in the corpus (`$OPEN_PALEO_PAPERS_DIR/markdown/`).

## Step 1 — Find the issue

The argument names the date: `today` / empty (the most recent Paper Watch
issue), `yesterday` (the one before it), or an explicit `YYYY-MM-DD` (match
the issue whose title contains that date).

```
gh issue list --search "Paper watch in:title" --state all --limit 15 \
  --json number,title,createdAt
```

Issue titles are `Paper watch — <UTC-date> (<n> new papers)`; the date is the
UTC date at file time, which can be one day ahead of Pacific, so match by
selecting from the list rather than computing a date string yourself. Tell
the user which issue number/title you selected. If none matches, say so and
stop.

## Step 2 — Extract the paper list

```
gh issue view <number> --json body
```

Each checklist item looks like:

```
- [ ] 2026-04-07 — <title> <!-- doi:10.xxxx/yyyy -->
  **<journal>**
  https://doi.org/10.xxxx/yyyy 🔓
```

For every item parse: the **DOI from the `<!-- doi:… -->` anchor** (the
reliable key — fall back to the doi.org link only if the anchor is absent on
an older issue), the title, the genus/genera from the `### Heading` it sits
under, and whether the box is already `- [x]` (skip those — already triaged).

## Step 3 — Locate in-corpus papers

For each DOI, find its corpus markdown by grepping for the DOI string:

```
grep -rl "<doi>" "$OPEN_PALEO_PAPERS_DIR/markdown/" 2>/dev/null
```

(`$OPEN_PALEO_PAPERS_DIR` defaults to `../open-paleo-papers`.) A hit gives
the file; its basename (minus `.md`) is the citation key. Papers with no
corpus hit go to an **Awaiting retrieval** list — do NOT classify them from
the title/abstract; we only judge papers we can read in full.

## Step 4 — Classify each in-corpus paper

Dispatch one Sonnet sub-agent per in-corpus paper (Agent tool,
`subagent_type: "general-purpose"`, `model: "sonnet"`), in parallel — one
Agent call per paper in a single message. Give each agent ONLY its markdown
path plus the tracked genera the watcher matched, and have it return JSON:

```
{"key","doi","bucket","affected_genera":[...],
 "new_genus":"<if it erects a new genus; else empty>",
 "new_species":"<if it erects a new species of an existing genus; else empty>",
 "material_basis":"holotype|referred|none",
 "secondary":["short notes on OTHER actions the paper supports, e.g.
   'new species Pinacosaurus hilwitnorum', 'revises Minotaurasaurus diagnosis'"],
 "rationale":"<=1 sentence","claim":"<the specific taxonomic claim, gated only>",
 "gated":true|false,"confidence":"high|medium|low"}
```

Bucket definitions (the agent picks the ONE primary bucket; list the rest
under `secondary`):

- **new-taxon** — erects a new genus. Put the name in `new_genus`. BUT if the
  "new" taxon is created by splitting or sinking EXISTING material
  (renaming/reassigning specimens we already track), classify it as
  **taxonomic** instead (gated).
- **new-species** — erects a new species of a genus (existing or new). Put it
  in `new_species`.
- **redescription** — new descriptive work and/or an amended diagnosis for an
  existing genus. Set **`material_basis`**: `holotype` if it restudies the
  TYPE specimen (e.g. CT of the holotype), `referred` if the new anatomy is
  from NON-type referred specimens, `none` if it only emends the diagnosis.
  NOT taxonomic.
- **appearance** — integument / soft tissue / external features backed by the
  paper (melanosomes, feathers, osteoderms, crests).
- **taxonomic** — ANY change to classification: phylogenetic placement (moves
  `parent`), reassignment, synonymy, or status change (nomen dubium,
  type-species designation). `gated: true`. NO command.
- **not-useful** — a real article off-topic for our fields (ichnology,
  biostratigraphy, geochemistry, methods/microanatomy, isolated-occurrence
  records, non-dinosaur, popular/essay).

Tell the agent: judge from the full text (read the Systematic Paleontology
section, not just the abstract); do not invent; pick the highest-value
PRIMARY bucket and put every other action the paper supports in `secondary`
(papers are often multi-action); if it includes ANY taxonomic change, set
`gated: true` and capture the claim; for redescriptions, distinguish whether
the new material is the holotype or referred specimens (`material_basis`) —
this is critical because referred material must NOT be written into
`holotype.material`.

## Step 5 — Resolve against the dataset, then assemble the worklist

First reconcile each agent's `new_genus` / `new_species` with what we
actually track — the classifier reads only the paper and does not know our
dataset. **The watcher only matches genera already in `genera/`, so a
"new-taxon" it surfaced is usually already present** (the paper is that
genus's describing source, reached via a comparative mention of a relative).
For each result:

- **new-taxon** → check `genera/<Letter>/<new_genus>.yml`.
  - Exists → it is the describing paper of a genus we ALREADY have. Re-route
    to "Already represented" (suggest `/update-genus` only if our
    `material`/`diagnostic_features` for it are still incomplete — check the
    YAML).
  - Absent → genuine intake → `/intake-genus <new_genus>`.
- **new-species** → if the genus exists in `genera/` → `/intake-species
  <Genus>` (confirm the species isn't already listed). If the genus itself is
  absent → it is really a new-genus intake → `/intake-genus`.

Then group, in this order, each line naming the affected genera, rationale,
and any `secondary` actions:

- **🆕 New taxon** (verified absent from `genera/`) — `/intake-genus <Genus>`
- **🐣 New species** — `/intake-species <Genus>`
- **📝 Redescription — holotype restudy** (`material_basis: holotype`) —
  `/update-genus <Genus>` (material + diagnosis; the classic case).
- **📝 Redescription — referred material** (`material_basis: referred`/`none`)
  — `/update-genus <Genus>` **diagnosis only**. Do NOT add the new specimens
  to `holotype.material` (that field is the type specimen only); the new
  referred specimen is a **`notable_specimens` candidate** (flag it). Note if
  the emended diagnosis depends on a novel/contested referral.
- **🎨 Appearance / soft tissue** — `/update-genus <Genus>` (appearance
  fields). Also fold appearance features that ride along a redescription
  (e.g. a newly described crest) into that genus's `/update-genus` note.
- **ℹ️ Already represented** — describing paper for a genus already in
  `genera/`; no action unless our entry is incomplete.
- **⚠️ Gated taxonomic change** — state the claim and affected taxa; **no
  command**. Per the project's taxonomy policy (adopt taxonomic changes only
  after broad community consensus, not first publication), these are NOT
  applied on a single paper. The user MUST either supply corroborating
  reference(s) or explicitly sign off on the one-paper change before it is
  applied. Covers placement, reassignment, synonymy, and status changes.
- **🗑️ Not useful** — will be auto-dismissed (ticked) with a one-line reason.
- **⏳ Awaiting retrieval** — issue papers whose DOI is not yet in the corpus.

## Step 6 — Show the plan and STOP

Present the full worklist, the exact items that will be ticked (the
not-useful set, each with its reason), and the worklist comment that will be
posted. **Wait for the user to approve before any GitHub write.** This is a
hard stop.

## Step 7 — Write to the issue (after approval)

1. **Post the worklist as a marker comment.** Prepend
   `<!-- open-paleo:triage -->`. If a comment with that marker already exists
   on the issue, update it in place; otherwise create it. (Idempotent.)
2. **Tick the not-useful items.** Read the issue body. For each not-useful
   DOI, locate its checkbox line — prefer the line carrying
   `<!-- doi:<doi> -->`; on older issues without anchors, find the line with
   the `doi.org/<doi>` link and walk up to the nearest `- [ ]`/`- [x]` line
   that owns it. Change `- [ ]` to `- [x]` and append `— _not useful:
   <reason>_`. Write the body back with `gh issue edit <number> --body-file
   <tmpfile>`.
   - Leave actionable and gated items UNticked (the user ticks those after
     acting on them).
   - If an item can't be located by anchor or link, skip it and report it.

## Step 8 — Report

Tell the user the comment URL, how many items were ticked, and the
ready-to-run commands for the actionable buckets.

## Notes / guardrails

- **Never edits `genera/` or any data file** — only reads the corpus and
  writes to the GitHub issue (comment + checkboxes).
- **Gating is mandatory** for taxonomic changes — see the taxonomy policy.
  Do not emit an apply command for the gated bucket, even when the paper is
  persuasive; surface it for the user to decide.
- **No silent dismissal** — every auto-ticked item is listed in the worklist
  with its reason, so nothing disappears without a visible trail.
- **In-corpus only** — never classify a paper from its title/abstract; if it
  is not in the corpus, list it under Awaiting retrieval.
- **Idempotent** — re-running updates the worklist comment and skips
  already-ticked items.
