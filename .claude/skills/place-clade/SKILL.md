---
name: place-clade
description: Run the systematic taxonomic-placement pass (#1860) for one clade subtree end-to-end, with hard stops so the user keeps review control. Triages the clade and its member genera (Wikipedia as a signal), pauses for the user to fetch primary phylogeny papers, dispatches firewalled review agents, smell-tests against the matching Jones reference-work volume (jones2026a/b/c by major group), decides clade granularity under P1–P6, then tears down and rebuilds the tree.yml subtree + clades/ files (erected_in/described_in/type_genus) and re-places member genera with structured dispute notes. Tracks per-genus coverage in reports/placement-progress.yml so the pass can prove every genus was placed. Use when the user names a clade to place/clean (e.g. "place Tyrannosauroidea", "run the placement pass on Ornithomimosauria"). Requires the clade name; the issue is #1860.
user-invocable: true
argument-hint: "[Clade]"
---

# Place Clade

Place every genus (and sub-clade) of one clade subtree at its defensible
position and rebuild that subtree's `clades/` files from primary literature,
producing a clean, artifact-free tree. This is the repeatable engine for the
**#1860 systematic placement pass**; the **#1860 issue body is the source of
truth** for scope and progress, and this skill is one clade's run of it.

The pass is **firewalled and tree-first**: every placement decision traces to
an inspected primary source, never to recall or to the existing tree/clade
files (which are untrusted — descriptions are unsourced, `erected_in` can be
wrong). Read papers *inside* review agents; work from their returned JSON in
the main thread (`feedback_extraction_agent_context_firewall`).

## Governing principles (P1–P6)

Apply these at every placement decision; they are the spine of the whole pass.

- **P1 — Source cascade.** No competing opinion → erecting paper. Competing →
  weigh by independent analyses (P3). No clear winner → last consensus, placed
  conservatively (P2). A redescription is a high-weight input, not a rule.
- **P2 — Least-inclusive *uncontested* placement (keystone).** `parent:` is the
  most precise placement the field agrees on; finer unresolved resolution goes
  in `dispute:`. A dispute between clade A and B resolves at the lowest clade
  both accept. Never place more precisely than sources support.
- **P3 — "Prevailing" = independent analyses, not papers.** A reused matrix is
  one data point. Weight by recency, character/taxon sampling, and
  dedicated-vs-incidental. Distinguish supersession (adopt) from
  contemporaneous disagreement (→ P2).
- **P4 — Clade granularity, not Linnaean ranks.** Place at the least-inclusive
  *named* clade that is uncontested and a useful node. Family-level by default;
  subfamily only when stable AND ≥2 genera (or a strongly distinct lineage);
  never manufacture a monotypic node — stop one level up. (Pilot precedent:
  kept family + subfamily, dropped tribes and Nanotyrannidae.) **Drop any clade
  whose entire subtree contains zero member genera** — a clade is justified only
  if at least one genus is parented somewhere within it (pure backbone nodes like
  Genasauria are fine because their subtree is full of genera; the target is
  truly empty nodes, e.g. an Anchisauria left empty after its only contents were
  reparented) (`feedback_drop_empty_clades`). Do not mass-delete empty nodes
  outside the batch's scope without asking the user.
- **P5 — Reflect ≠ adopt.** A bold, well-evidenced single study is always
  *reflected* (a `dispute:` note, maybe a conservative `parent:` move) but only
  *adopted* as `parent:` when it rests on genuinely new evidence, has no
  published rebuttal, and has stood unchallenged long enough
  (`project_taxonomy_policy`).
- **P6 — Clade placement obeys the same rules.** A clade's parent in `tree.yml`
  is a placement decision under P1–P5. A clade whose higher position is
  disputed (e.g. Megaraptora) is placed conservatively, with the dispute
  recorded **once** in its `clades/` file — member genera carry no per-genus
  dispute for it. Centralize disputes; never smear them.

---

## Coverage tracking — `reports/placement-progress.yml`

So the pass can prove at the end that **every** genus was placed (not just the
clades we happened to think of), it is anchored to a per-genus roster, not to a
clade checklist. `reports/placement-progress.yml` is a **temporary, checked-in**
file with one entry per genus YAML on disk:

```yaml
Aardonyx: pending
Albertosaurus: {status: placed, parent: Albertosaurinae, batch: Tyrannosauroidea, date: "2026-06-26"}
Aerosteon: {status: deferred, batch: Tyrannosauroidea, note: theropod-backbone reconciliation}
```

- `pending` — no batch has reached it yet.
- `placed` — final parent decided and applied this pass.
- `deferred` — looked at during a batch, final placement intentionally parked
  (e.g. for the theropod-backbone reconciliation), with a `dispute:` recorded.

Because every genus file is a row, a genus sitting in a clade we never thought
to enumerate stays `pending` and surfaces in the count — the gap can't hide.
The pass is **complete when no `pending` or `deferred` rows remain**; delete the
file then. It is committed alongside each batch so progress survives across
sessions/machines. The `#1860` ticket carries only the rollup number, never the
1,398-row list. Re-sync it against `genera/` at the start of each batch
(genera intaken since the last batch must be appended as `pending`):

```
comm -23 <(ls genera/*/*.yml | xargs -n1 basename | sed 's/\.yml//' | sort) \
         <(grep -oE '^[A-Za-z]+:' reports/placement-progress.yml | tr -d ':' | sort)
```

Any names this prints are genera missing from the tracker — append them
`pending` before proceeding.

## Step 1 — Scope the clade

The clade name must be supplied in `[Clade]`. If empty, **re-sync
`reports/placement-progress.yml` against `genera/`** (Coverage tracking,
above), then read it to report what's left — counts of pending/placed/deferred
and the largest pending clades — and propose the next clade to run. Stop until
the user picks one.

Then, **reading only the current tree and `clades/` files for orientation (not
as truth):**

- Locate the clade in `tree.yml` and enumerate its current subtree — every
  descendant clade node and every genus whose `parent:` falls inside it
  (`grep -l "parent: <node>" genera/*/*.yml` for each node).
- List which of those descendant nodes have a `clades/<Name>.yml` file and
  which don't.

Tell the user: the clade, the subtree you intend to **tear down and rebuild**,
the member-genus count, and confirm the GitHub issue is **#1860** (this pass
logs progress there, it does not open/close a per-clade issue). Wait for the
user to confirm scope before continuing.

## Step 2 — Triage (Wikipedia as a *signal*, not a verdict)

Dispatch **one firewalled triage agent** (Sonnet, `general-purpose`) that reads
the cached Wikipedia articles for the clade and each member genus
(`$OPEN_PALEO_WD_DIR/wikipedia/<Name>.json`; fetch missing ones with
`wikipedia_cache.py` per `reference_wikipedia_cache`). The agent reads the
classification sections, cladograms, and dates and returns **JSON only** — it
makes no decisions:

```json
{
  "clade": "<Clade>",
  "members": [
    {"taxon": "<Genus|Subclade>",
     "signal": "consistent | needs-review | disputed",
     "candidate_clades": ["..."],
     "papers_to_chase": [{"key_guess": "author2024", "doi": "...", "why": "..."}]}
  ],
  "subclade_structure_seen": "free-text summary of the cladogram(s)",
  "clade_acceptance": [{"clade": "...", "accepted": "broadly | emerging | deprecated | disputed",
    "why": "is this node USED in recent literature + reference works, not just recovered in one matrix?"}],
  "naming_authorities": [{"clade": "...", "erected_by": "Author year", "type_genus": "..."}]
}
```

Have the triage agent judge **clade acceptance** (is a candidate node broadly
*used* in current literature?), not only membership — a clade can be real and
widely adopted even if one older matrix predates its naming and so doesn't
recover it.

The triage output is a **signal** that tells you where to point primary
review and which papers to fetch. The *decision* always uses primary
literature (Step 4). Summarize the triage to the user: which members look
consistent vs need-review vs disputed, the candidate clades, and the
**papers-needed list**.

**Every `papers_to_chase` entry is an UNVERIFIED guess, never a citation.**
The triage agent reads prose and produces two distinct kinds of bad entry, which
you must tell apart before acting on either (`feedback_triage_paper_keys_unverified`):

- **Confabulated** — the agent invented an author/year that the Wikipedia article
  does not actually cite (it pattern-matched a claim to a plausible-sounding paper
  from its own prior). Test: grep the cached article text for the surname — if the
  article never names that author, and Crossref/OpenAlex have no such paper on the
  topic, it is confabulation. **Discard it; do not chase it and do not treat it as
  covered.** (Diplodocoidea lesson: a "Mannion et al. 2019" rebbachisaurid-subfamily
  revision — the Rebbachisauridae article contains no "Mannion" at all; the real
  citations were Bonaparte 1997, Whitlock 2011, Fanti 2015.)
- **Real but key-colliding** — the article really does cite that author+year, and a
  real paper exists, but the corpus key for that author+year is already taken by a
  *different* real paper. Test: the article text names the author and a DOI lookup
  returns a real on-topic paper whose DOI ≠ the corpus file's. This is a genuine
  **sourcing gap**, not a covered paper — fetch it under a disambiguated key (Step 3).
  (Diplodocoidea lesson: the Agustinia article cites a real "Bellardini et al. 2022"
  redescription of *Agustinia ligabuei* — `10.1080/08912963.2022.2142911` — distinct
  from the corpus `bellardini2022`, which is the *Ligabuesaurus* paper.)

So for every decision-relevant `papers_to_chase` entry, resolve it against (a) the
cached article's actual reference text and (b) a Crossref/OpenAlex DOI lookup — then
classify it confabulated (discard) or real (fetch under the right key). Never carry a
bare author+year forward on trust.

## Step 3 — Literature-sourcing pause (first-class)

Sourcing pauses are part of the process, not a failure. Build the
papers-needed list from triage. For each paper, **check the bib AND the corpus
markdown dir before asking for it** — and pick the *right* same-author/year key.
A bare `author<year>` key you reconstruct from memory frequently does NOT exist
as such: the paper usually lives under a **letter-suffixed split**
(`butler2008b`, `pol2011a`, `riguetti2022a`) or a **diacritic-preserving**
spelling (`dieudonné2020`, not `dieudonne2020`). So **always check for a key
split, and whether any paper in the split is the one you want**: (a) list every
sibling under that author+year — `ls $OPEN_PALEO_PAPERS_DIR/markdown/<author><year>*.md`
and grep the bib for `<author><year>`, including diacritic-folded and -preserved
spellings — and (b) inspect each candidate's title / first markdown header to
find the one you actually need (suffixes like `loewen2013a`/`b` are usually
distinct real papers, not miskeys). Only treat a paper as a genuine sourcing gap
once you have confirmed none of the existing splits is it
(`feedback_bootstrap_key_check`, `feedback_hyphenated_surname_keys`,
`feedback_author_spelling`).

**A corpus `HAVE` is NOT confirmation — it is the START of a check, never the end.**
`[ -f .../<key>.md ]` proves only that a file exists under that name; it says
nothing about which paper or which taxon it actually is. The single rule that
prevents the "I assumed `<key>` was the right paper" failure:

> **Before you write the word "covered", "in corpus", or "HAVE" about any paper
> — to the user, in a list, or in your own plan — you must have READ that file's
> title in this run and confirmed it names the expected taxon/topic.** No title
> read = the paper's status is *unknown*, not *covered*. This title-check is
> mandatory HERE, at list-building time, and is not deferred to Step 4. (Step 4
> repeats it as a backstop; it is not the first place it happens.)

Two reasons a `HAVE` lies, both of which bit the Diplodocoidea batch:

- **One author+year, many papers.** A surname+year routinely maps to several
  distinct real papers; the corpus stores them under suffixed keys, but the *bare*
  key is claimed by whichever was filed first. So a `HAVE` under a triage-guessed
  `author<year>` may be a *different real paper* than the one you need — e.g.
  `bellardini2022` is the *Ligabuesaurus* osteology, while the *Agustinia ligabuei*
  redescription you actually want is a separate Bellardini 2022 that needs a
  disambiguated key (`bellardini2022a`). When the wanted paper is real but its bare
  key is taken, that is a **sourcing gap**, not a covered paper — add it to the
  fetch list under the suffixed key, with its DOI.
- **The guessed paper does not exist.** A confabulated triage key (`mannion2019`
  for a rebbachisaurid revision that was never written) may *collide* with a real,
  unrelated corpus paper of the same key (the Tendaguru-titanosaur `mannion2019`).
  The title-check reveals the mismatch; the right move is to **drop it** (it answers
  no question for this clade), not to substitute the unrelated paper.

Resolve each entry by DOI, not by author+year string. Verify a paper's existence
and identity with a Crossref/OpenAlex DOI lookup (and the cached article's actual
reference text) rather than trusting that `<surname><year>.md` is the paper the
triage meant (`feedback_corpus_key_collision`, `feedback_verify_against_corpus`).

**When you resolve a DOI, read the FULL returned title, never a truncated
preview.** Crossref/OpenAlex list views truncate titles, and a truncated title is
a title-check you have not actually done — "Osteological revision of the holotype
of the Middle Jurassic sau…" reads as your Cetiosauriscus paper but resolves to a
*Patagosaurus* revision. Fetch the full title (e.g. query the DOI directly, or
read the untruncated `title` field) and confirm it names the expected taxon before
you record the DOI or treat the paper as covered. The Step 4 EXTRACTION FAILED
backstop will still catch a mismatch, but a truncated-title slip is cheaper to
avoid here.

**Hard stop.** Give the user the list of phylogeny papers to fetch into
`$OPEN_PALEO_PAPERS_DIR/markdown/<key>.md` (clade-naming papers, recent
total-evidence / dedicated phylogenetic analyses, any redescription that
re-scores the disputed taxa). Mention they can lean on Wikipedia taxoboxes or
OpenAlex to find candidates. Wait for the user to say which landed.

If a needed paper is unobtainable, park the affected genus/clade at the
least-inclusive uncontested node + a `dispute:` flag — never fabricate a
placement (`feedback_no_seeding_from_recall`). The `dispute:` field states only
the **published** scientific debate (who argues what, citing real papers); it
must **never** record that a paper was unobtainable or otherwise reference local
sourcing state — that is a local-machine convention with no place in committed
repo data. Note the sourcing gap in the workflow tracker / your message to the
user instead (`feedback_no_sourcing_gap_in_dispute`,
`feedback_no_process_notes_in_references`, `feedback_no_corpus_reference_in_data`).

## Step 4 — Firewalled phylogeny review

**Before dispatching, derive each paper key from the DATA (not recall) and
title-check the ENTIRE review set — fetched papers AND ones already in the
corpus.** This is where wrong papers slip in, and it keeps happening when the
check is applied only to newly-fetched gap papers: a key existing in the corpus
(`[ -f .../<key>.md ]` → "HAVE") only proves a file is present, and a key you
reconstruct from memory ("there should be a Langer 2019 / Yang 2020 about topic
X") is a guess, not a fact. The corpus file is almost always a correct,
correctly-keyed paper that simply is not the one your recall mapped it to — e.g.
`yang2020` is the *Changmiania* ornithopod paper (not *Irisosaurus*),
`langer2019` is the *Vespersaurus* noasaurid paper (not the Saturnaliidae
paper), and `prieto-márquez2011a` is a *Plateosaurus* skull redescription (not a
hadrosauroid paper). In every such case the corpus was right and the
key→topic mapping in my head was wrong.

So, mechanically, for EVERY paper in the review set:

- **Take a per-genus paper's key from that genus's own YAML** —
  `erected_in` / `described_in` — never from memory. The genus file is the
  source of truth for which key = which taxon (e.g. `genera/I/Irisosaurus.yml`
  → `erected_in: peyredefabrègues2020`, so peyredefabrègues2020 IS the
  Irisosaurus paper — do not guess `yang2020`). For a clade authority, take the
  key from the existing `clades/` file or the triage agent's `papers_to_chase`.
- **Then print and read the title of every key you will dispatch** (grep the bib
  title and/or the markdown's first `#` header) and confirm it names the expected
  taxon/topic — **including papers already in the corpus, not just fetched
  gaps.** Never feed an agent a paper whose title you have not just read in this
  run.

Drop any paper whose content does not match; if the paper you actually need is
absent, treat that as a Step 3 sourcing gap (`feedback_fetch_primary_not_summary`).
The firewalled agents return an `EXTRACTION FAILED` sentinel when a misassigned
paper slips through — treat that as a backstop, not a substitute for the
title-check (`feedback_verify_against_corpus`).

For each fetched paper (or logical group), dispatch a **firewalled review
agent** (Sonnet, `general-purpose`) that reads ONLY that markdown and returns
**JSON only**:

```json
{
  "paper": "<key>",
  "analysis_type": "dedicated-phylogeny | incidental | redescription | review",
  "placements": [
    {"taxon": "<Genus|Subclade>", "recovered_parent": "<clade>",
     "support": "free-text (bootstrap/Bremer/posterior if given)",
     "matrix_basis": "new | reused-from <source> | modified <source>",
     "quote": "≤200-char grounding quote"}
  ],
  "clade_definitions": [{"clade": "...", "definition": "node/stem/...", "type_genus": "..."}],
  "notes": "anything that bears on P1–P6 weighting"
}
```

Tell each agent: do NOT invent; `null`/`[]` when the paper is silent; focus
only on the target taxa; write an `EXTRACTION FAILED` sentinel if the markdown
is empty/boilerplate. Run multiple agents in parallel (one message).

**Expect the agents to correct your priors** — in the pilot they reversed three
of my pre-committed dispositions (Bagaraatan stays Tyrannosauridae; Labocania
is *Theropoda incertae sedis*, not carcharodontosaurid; Timimus is an
ornithomimosaur). Work from the JSON, not from your plan
(`feedback_verify_against_corpus`).

## Step 5 — Jones smell-test (cross-check, not a source)

Cross-check your emerging placements against the **Jones reference work volume
for the clade's major group** — the encyclopedia is split three ways:

- `jones2026a` — *The Princeton Encyclopedia of Dinosaurs: Ornithischians*
  (Ornithischia)
- `jones2026b` — *…: Sauropods* (Sauropodomorpha)
- `jones2026c` — *…: Theropods* (Theropoda)

Pick the volume that contains the clade you are placing; a clade straddling a
boundary (rare) checks against both.

**Run Jones AFTER the Step 4 review agents return, not in parallel — it is a
cross-check, so it should react to the primary findings.** Wait for the
dedicated-analysis JSON, then dispatch a firewalled Jones agent that covers the
**ENTIRE member set — every genus and sub-clade in the batch gets a Jones
verdict**, not just the contested ones. For each taxon, ask Jones where it
places it / what status it gives it. ON TOP OF that full pass, single out the
*contested* claims (surprises, clade moves, taxa ejected from the clade,
synonymies, anything where the analyses disagree with each other or with the
current tree) and have Jones explicitly **confirm / dispute / call
nuanced-or-silent** each, with a grounding quote — the contested adjudication is
the sharpest output, but it does not replace the full-set coverage (every
placement deserves the cross-check, and a "silent" verdict on a taxon is itself
useful signal). For a large batch, split the full set across more than one Jones
agent rather than dropping taxa. Use Jones as a **sanity signal** on the
prevailing view (P3), never as the deciding source. Where Jones and the primary
analyses disagree, the primary analyses win and the disagreement is dispute
material.

## Step 6 — Decide the structure (P4) and the rebuild plan

Synthesize the review JSON into a placement decision, in the main thread:

- **Which named clades survive (P4).** Keep family by default; keep a subfamily
  only if it is stable AND has ≥2 genera; drop tribes and any node that would
  be monotypic — park those genera one level up. Record what you dropped.
  **Judge a clade by its *current acceptance*, not by whether every matrix you
  read recovers it.** A framework paper that PREDATES a clade's naming cannot
  recover that name — its silence is not a vote against the clade (P3: recency
  beats seniority when methods supersede). Weight the triage clade-acceptance
  signal + the Jones smell-test for whether a node is broadly used now; don't
  let two older analyses outvote a clade the recent literature has adopted.
  (Stegosauria lesson: Dacentrurinae/Stegosaurinae looked "unstable" only
  because `raven2017`/`maidment2008` predate their formalization; the current
  consensus + Jones use both — so they were kept.)
- **Each genus's keystone parent (P2).** The least-inclusive clade the sources
  agree on. Contested finer resolution → `dispute:` on the genus.
- **Clade-level disputes (P6).** A sub-clade whose own higher placement is
  contested gets ONE `dispute:` in its `clades/` file; its members don't repeat
  it. Genera that conservative placement lands in a messy, not-yet-reconciled
  backbone region are **deferred** with a `dispute:` note and listed for the
  backbone pass (pilot precedent: Megaraptora + Gualicho deferred).
- **Naming authorities for each kept clade.** `erected_in` = the
  nomenclatural-act paper; `described_in` = the authoritative descriptive/
  diagnostic source if different; `type_genus` for rank-based names, **omitted**
  for unranked clades (e.g. Eutyrannosauria). **Take old family-group authorities
  from the literature, not from recall or a Wikipedia taxobox** — they are
  routinely misremembered. The reliable source is the *reference lists* of the
  corpus papers that cite them: dispatch a firewalled agent to extract the
  verbatim citation (authors, year, title, journal, volume, pages) from the
  bibliographies of the phylogeny papers you already reviewed, and cross-check
  the year across more than one of them. (Diplodocoidea lesson: Dicraeosauridae
  AND Apatosaurinae are both **Huene, 1927** — not Janensch 1914/1929 as recall
  and the triage assumed; Diplodocimorpha is Calvo and Salgado, 1995, defined by
  Taylor and Naish, 2005.) A Wikipedia taxobox or your prior is at most a hint to
  verify against the reference lists, never the citation of record. For DOIs of
  the authority papers, look them up by full title in Crossref/OpenAlex; many
  pre-DOI classics are legitimately citation-only.

Present the full plan to the user — surviving structure, per-genus parents,
disputes, deferrals, and the clade authorities — and wait for sign-off before
editing any data.

## Step 7 — Apply: rebuild the subtree

Per-clade **reset-and-rebuild**, not a big-bang flatten. Once the user approves:

1. **`tree.yml`** — replace the clade's subtree with the approved structure
   (nesting under its existing parent). Remove dropped nodes and any duplicate
   flat node for the same clade.
2. **`clades/<Name>.yml`** for every kept node — rebuild from literature, do
   not trust the old file. Shape (see `clades/Tyrannosauroidea.yml` /
   `clades/Eutyrannosauria.yml` for the canonical templates):

   ```yaml
   clade: <Name>
   description: >
     2–4 sentence sourced description (composition + diagnosis-in-prose).
   type_genus: <Genus>        # omit entirely for unranked clades
   erected_in: <key>
   described_in: <key>        # omit if same as erected_in
   diagnostic_features:
     - 3–6 synapomorphy bullets, American English.
   references:
     - id: <key>
       authors: ...           # initials form "Surname, F. M." (project house style)
       year: ...
       title: ...
       journal: ...
       # plain-text notes: only; no markdown (feedback_no_markdown_in_reference_notes)
   ```

   Clade `authors`/`year` are **build-derived** from `erected_in` — never write
   them in source. Both `erected_in` and `described_in` must resolve to a
   reference `id` present in that same clade file (the validator's "Clade
   reference integrity" check enforces this). Old clade files predate the
   migration and may carry legacy `described:`/`authors:` fields — delete those
   when you rebuild.

   **Before authoring any `references:` entry, check whether the paper already
   exists in the repo under a key, and REUSE it.** Grep `clades/` and `genera/`
   for the author+year (including suffixed variants `<author><year>a/b/c` and
   diacritic spellings) — `grep -rl "id: <author><year>" clades genera`. If the
   paper is already keyed, copy its **canonical** `authors`/`title`/`journal`/
   `volume`/`pages` string verbatim (only the `notes:` may differ per context)
   and use that existing id; do NOT mint a fresh bare key. A bare `huene1927`
   authored next to an existing `huene1927c` is both a duplicate of the same
   paper and a disambiguation error the validator rejects — and `huene1927c` was
   already the exact Sichtung-1927 paper this batch needed. New key only when no
   existing entry is the paper, and then with the right suffix
   (`feedback_bootstrap_key_check`, `project_reference_conventions`,
   `feedback_hyphenated_surname_keys`).
3. **Member genus YAMLs** — set each `parent:` to its keystone clade. Add
   `dispute:` only to contested genera:

   ```yaml
   dispute:
     summary: >
       Current state of the placement debate (who argues what, on what evidence).
     history:
       - date: "<YYYY-MM-DD>"
         note: Placed at <clade> following <source> (P-rule); <what's unresolved>.
   ```

   `summary` is required and non-empty; each `history` entry needs a
   `YYYY-MM-DD` date + a `note`. Dispute prose follows American English and
   citation conventions ("Rich and Vickers-Rich", "(Molnar, 1974)" — no `&`,
   comma before year), and is exempt from the reference-notes 200-char limit.
   Only edit a genus's `description` if it **contradicts** the new placement —
   not merely to name the new paper (`feedback_description_only_on_contradiction`).
4. **`reports/placement-progress.yml`** — flip every genus this batch touched
   from `pending` to `placed` (with its new `parent`, the `batch` = this clade,
   and the date) or to `deferred` (with a `note` naming where it's parked). The
   batch's placed + deferred genera must exactly equal the subtree's member
   genera from Step 1 — if any member is still `pending`, it was overlooked.

Show the user the full diff (tree + clade files + genus reparenting + disputes +
tracker) and wait for approval before validating.

## Step 8 — Validate, build, restore artifacts

```
npm run validate     # 0 errors; introduce no NEW warnings without sign-off
npm run typecheck
npm run lint
npm run build
```

Read the **full** validate output and filter on check-category names, not genus
names — clade reference-integrity and dispute-structure errors point at other
files (`feedback_full_validation_output`). A new `tree.yml` clade with no
matching `clades/` file is a warning you must resolve in the same change
(`feedback_no_new_warnings_without_signoff`).

If `npm run build` modifies `dist/` or `docs/`, restore them — the GitHub
Action regenerates them (`feedback_no_commit_dist`):

```
git restore dist/ docs/open-paleo.json
```

## Step 9 — Commit the batch (atomic)

Stage exactly the changed `tree.yml`, `clades/*.yml`, genus YAMLs, and the
updated `reports/placement-progress.yml` — never `dist/`/`docs/`. Draft a commit
message:

```
<Clade>: rebuild subtree + place member genera (#1860)

<what structure was adopted, which nodes were dropped (P4), which genera were
re-placed or deferred, and any clade-level disputes recorded>. Refs #1860.
```

Show the staged diff and the message. **Hard stop** — wait for explicit
approval (`feedback_no_auto_commit`, `feedback_skill_approval_gates`). The user
may want to commit-without-push so the GitHub Action runs an atomic build, or
push directly. If pushing: `git pull --rebase --autostash` first, then
`git push origin main`.

This pass does **not** close #1860 — it is the umbrella ticket for the whole
tree. Use `Refs #1860`, never `Closes` (`feedback_gh_multi_close_trailer`).

## Step 10 — Log progress on #1860

Update the #1860 issue body's "Work items / clade progress" checklist: tick the
clade's boxes, list deferred taxa under the backbone-reconciliation item, and
record any clade files still needing the `erected_in`/`described_in`/
`type_genus` migration. Record the **rollup number** from the tracker
(placed / deferred / pending out of total) — that single line is how #1860
carries coverage, never the per-genus list. Edit the body with an ASCII-only /
literal-UTF-8 patch — never `perl \x{}` byte escapes, which mojibake the whole
body (`feedback_issue_body_edit_utf8`).

When the tracker reaches **0 pending and 0 deferred**, the pass is complete:
delete `reports/placement-progress.yml` (its job is done and it is checked in
only as a temporary ledger), and that deletion is the signal to write the
CONTRIBUTING.md placement section and close #1860.

Then tell the user the clade is placed, give the commit SHA and the rollup, and
ask whether to pick up the next clade.

---

## Memory-rule compliance

- Firewall: read papers inside agents, work from JSON; never grep/Read paper
  markdown in the main thread (`feedback_extraction_agent_context_firewall`).
- Verify every paper-attributed claim against the corpus; never cite from
  recall (`feedback_verify_against_corpus`, `feedback_no_fabricated_citations`).
- Pick the right same-author/year key — check the bib title; suffixes are
  usually distinct papers (`feedback_bootstrap_key_check`).
- Do not auto-commit/push; every "wait for the user" is a hard stop
  (`feedback_no_auto_commit`, `feedback_skill_approval_gates`).
- Never commit `dist/`/`docs/` (`feedback_no_commit_dist`).
- No markdown in reference `notes:`; `notes:` describes the paper's scientific
  role, not process state (`feedback_no_markdown_in_reference_notes`,
  `feedback_no_process_notes_in_references`).
- Reference authors as initials; keys keep diacritics + hyphens, no ASCII-fold
  (`project_reference_conventions`, `feedback_hyphenated_surname_keys`).
- American English in prose; proper-noun institution names stay as-is
  (`feedback_american_english`).
- Don't reference "the corpus" or other local-machine conventions in committed
  repo data (`feedback_no_corpus_reference_in_data`).
- Read the full validate output; introduce no new warnings without sign-off
  (`feedback_full_validation_output`, `feedback_no_new_warnings_without_signoff`).
