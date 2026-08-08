---
name: intake-genus
description: Run the per-genus intake pipeline for an explicit genus name. Bootstraps a stub from PBDB/Wikipedia/Wikidata, pauses for the user to fetch describing/supplementary papers into the local corpus, dispatches Sonnet extraction agents, applies the results, then promotes/commits/closes. Use when adding a new genus that is ready (its paper / ICZN ruling exists). Requires the genus name (and its GitHub intake issue number for closing).
user-invocable: true
argument-hint: "[Genus]"
allowed-tools: Bash Read Write Edit Glob Grep Agent AskUserQuestion
---

# Intake Genus

Run the per-genus intake pipeline end-to-end with hard stops between
each stage so the user retains review control.

Bulk intake from a triage table has been retired — the dataset is
essentially complete, with only a handful of genera left that await
external prerequisites (a describing paper, an ICZN ruling, etc.). This
skill now runs **one explicit genus at a time**, when that genus is
ready. Bucket C (iconic legacy) remains more complex and out of scope.

---

## Outcomes

An intake does not always end in a valid genus record. The genera left
in the queue are disproportionately live taxonomic arguments rather than
clerical gaps, so name the expected outcome early and confirm it at the
apply gate. The set is:

- **valid** — diagnosable, and current work treats it as its own genus.
- **disputed** — a genuine no-consensus about the taxon's **own**
  validity. Not placement, age, monophyly, or referred-material
  disagreements, and not a single unadopted reassessment —
  `feedback_disputed_status_criterion`.
- **nomen dubium** — validly published, but the type material cannot
  currently diagnose it.
- **nomen nudum** — the name never met the ICZN's publication
  requirements.
- **junior synonym carried on another genus** — no file here. The name
  goes in the senior genus's `synonyms:` block at the matching rank
  (`feedback_synonyms`), and the intake becomes an edit to that genus
  instead. Say so and stop rather than promoting a stub.
- **excluded** — an `excluded.yml` entry, and **only** for the two
  categories that file carries: `non-dinosaurian` (published work
  concludes the type material cannot be diagnosed to Dinosauria) and
  `nomen-nudum`.

**A validly published dinosaur name that is merely undiagnosable stays
in `genera/` with `status: nomen dubium`.** 105 genera already do. Do
not route one to `excluded.yml`: that file's category vocabulary has no
term for it, and dropping the record loses the name from the dataset
entirely. Ostafrikasaurus is the worked example — a nomen dubium at
Theropoda incertae sedis, kept.

### Where the call gets made

Twice, because for a contested taxon you often cannot judge validity
until you have read the papers:

1. **Provisionally, at Step 2**, before the user goes and fetches
   anything. State which outcome you expect and what would change it.
   If you expect "junior synonym carried on another genus" or
   "excluded", say so **then** — that redirects the whole job and there
   is no point fetching papers for a file that will not exist.
2. **For real, at the Step 4 apply gate**, from
   `staging/intake/<Genus>/status-evidence.md` — see "Settle `status`".

---

## Step 1 — Identify the genus

The genus name must be supplied in `$ARGUMENTS`. If it is empty, ask
the user which genus to intake and stop until they answer.

Also ask the user for the genus's **GitHub intake issue number** (used
at close-out in Step 7) and any notes they want carried into the stub,
unless they have already provided them.

Tell the user which genus we are about to process before continuing.

## Step 2 — Bootstrap

Run the bootstrap script:

```
npm run intake-bootstrap -- <Genus>
```

This writes:

- `staging/intake/<Genus>/bootstrap.yml` — best-effort stub from
  external sources
- `staging/intake/<Genus>/papers-needed.md` — describing-paper
  citation key, plus a checklist for any supplementary papers
- `staging/intake/<Genus>/notes.md` — verbatim `--notes` context (when
  you passed `--notes`)

After the script returns, **read both files yourself** and summarise
to the user:

- How many fields the bootstrap populated
- The proposed describing-paper citation key
- Whether that key already names a reference-store entry
- Any supplementary papers your notes mention (e.g. the 2024
  Słowiak reassessment paper for Bagaraatan)

If your notes explicitly call out a supplementary paper, edit
`papers-needed.md` to add a stub entry under
"Additional papers (optional)" with the citation key and DOI, marked
`- [ ]`. The user will mark `[x]` once they have it.

### Verify the bootstrap-proposed key

The bootstrap derives a citation key from the DOI-resolved reference
when PBDB links one, and otherwise from PBDB's reported genus authority.
It now settles two of the three failure modes on its own: a DOI already
in the reference store reuses that key rather than minting a duplicate,
and the whole surname is kept (`vanderreest2017a`, not `van2017`). What
it cannot settle is still yours:

- **PBDB tracks a homonym, not the type.** Ex: Titanosaurus Lydekker
  1877 (Indian, valid) vs. Titanosaurus Marsh 1877 (preoccupied
  American name → renamed Atlantosaurus). PBDB returned Marsh as
  authority; the notes and Wikipedia both said Lydekker.
- **No DOI, so no way to match.** For pre-DOI papers the bootstrap
  cannot tell a genuinely new paper from one already filed. It prints
  the existing sibling entries with their titles instead — Wuerhosaurus
  proposes `dong1973b` while listing `dong1973a — [Dinosaurs from
  Wuerho]`, which is the paper actually wanted.
- **A PBDB-only year may be wrong.** With no DOI to check against, the
  checklist flags the year as unverified. The literature itself can be
  split — Ostafrikasaurus is cited as both 2012 and 2013 — so confirm
  against the paper.

Before reporting the proposed key to the user, **always**:

1. Compare the proposed key against your notes' author + year.
   If they disagree, the bootstrap is wrong; flag it and propose the
   notes-aligned key.
2. Read any sibling list the checklist printed and say explicitly
   whether one of them is the paper being sought. This is the check
   that catches the pre-DOI collisions.
3. If the key already names a store entry, confirm that entry's title
   matches the paper your notes describe. If it is a different paper,
   treat it as a citation-key disambiguation case (see below).

If the bootstrap is wrong, edit `papers-needed.md` to point at the
correct key and explain the glitch in the line above the checkbox so
the user understands why the bootstrap-proposed key was overridden.

The bootstrap now prints a **"Fields left unseeded"** list (also written
into `papers-needed.md`) for anything it declined to guess at: a region
it could not resolve to an ISO 3166-2 code, a PBDB parent absent from
`tree.yml`, a type species whose binomial belongs to another genus, a
mass implausible against the seeded length. Relay that list — those are
the fields you must fill from the paper at Step 4.

### State the provisional outcome

Before the hard stop, tell the user which outcome from the list above
you expect and why (one or two sentences), plus what evidence would
change it. If you expect the taxon to end as a synonym carried on
another genus, or in `excluded.yml`, raise it **now**: those outcomes do
not produce a file here, so fetching papers for them is wasted work.

**Hard stop.** Tell the user:

> Bootstrap complete. Fetch the listed papers into
> `$OPEN_PALEO_PAPERS_DIR/markdown/` (defaults to a sibling
> `../open-paleo-papers/markdown/` next to this repo), then for each fetched
> paper, tick `[x]` in `staging/intake/<Genus>/papers-needed.md` and
> paste a citation string on the same line after a `— ` separator.
> Updating `dist/references.bib` is not required — the apply step
> parses the citation directly from `papers-needed.md`. When done,
> say "resume" so I can build the extraction prompts.

Wait for the user to respond.

### When the describing paper is not obtainable

If the describing paper is in a hard-to-access venue (Soviet-era
Russian journals, French Comptes Rendus before digitization, Korean
geological-society papers from the 1970s-80s, predatory venues, lost
conference abstracts, etc.), surface the problem to the user **before**
moving on. Do NOT silently apply the Wikipedia-fallback. The user
decides per paper, every time:

> The describing paper `<key>` is not in the corpus and looks
> hard to obtain (`<reason>`). Options:
> 1. Try to fetch it
> 2. Build a Wikipedia-fallback stub (description = Wikipedia
>    paragraph 1 verbatim; type_specimen block omitted; reference cited
>    with metadata from secondary literature; gap logged in
>    the corpus repo's `corpus-paper-report.md` §1)
> 3. Defer this genus

If the user picks the Wikipedia-fallback path, follow the recipe in
`feedback_wikipedia_fallback_pattern` memory. Never invent specimen
IDs, autapomorphies, or paper-specific claims to paper over the gap.

Do NOT assume an earlier "go with the fallback" answer applies to a
different paper — every paper is a fresh decision.

## Step 3 — Resume (build extraction prompts)

### First, verify each fetched paper is the paper

Before running resume, for every key the user ticked, grep its markdown
in `$OPEN_PALEO_PAPERS_DIR/markdown/<key>.md` for the taxon name and, when
you have one, the holotype number:

```
grep -ic "<Genus>" "$OPEN_PALEO_PAPERS_DIR/markdown/<key>.md"
```

**A paper whose markdown never names the target taxon is the signature
of a key collision** — the fetch landed the wrong paper under the right
key, or the right paper under a key that already meant something else.
Stop and ask; do not extract from it.

Two cautions on reading a zero:

- Check the abbreviated binomial and the genus separately. A paper may
  use "*S. brevicollis*" throughout after one full mention.
- A zero on a 19th-century or OCR'd source proves nothing — ligatures
  and scanning noise defeat a literal grep
  (`feedback_search_traps_archaic_sources`). Read a few lines instead.

### Then build the prompts

Once the papers check out, run:

```
npm run intake-resume -- <Genus>
```

If the script exits non-zero, surface the error verbatim — most
commonly it means the markdown for one of the ticked papers is not
actually in the corpus, or the user has not ticked any boxes yet.
Stop and ask the user to fix.

On success the script writes
`staging/intake/<Genus>/prompts.jsonl` — one JSON object per line,
each with a fully-formed `prompt` field.

For each line in the JSONL, dispatch a Sonnet sub-agent via the
Agent tool with `subagent_type: "general-purpose"` and explicit
`model: "sonnet"`, passing the prompt verbatim and an explicit
instruction to write its JSON output to the `output_path` named in
the entry. Run the dispatches in parallel (one Agent invocation per
paper, all in a single message) when there are multiple papers.

(Sonnet is the right default here even though the task is well-scoped:
diagnostic-feature filtering and holotype-vs-referred-material
discipline both reward stronger prompt-following than Haiku tends
to give.)

After the agents return, verify each
`staging/intake/<Genus>/extractions/<key>.json` exists. Read each
back and check for sentinel-failure markers (`empty: true`). If any
agent failed, surface that to the user and ask how to proceed.

### Step 3b — Chase the citations the extractions surfaced

**Older genera routinely need literature that cannot be enumerated in
advance.** PBDB does not know it, the bootstrap cannot propose it, and
it may not appear in any corpus bibliography — the load-bearing validity
source for *Delapparentia* was a dedicated redescription that surfaced
only from reading in-text citations in the supplementary papers.

So make it a step rather than an accident. Read the extractions' `notes`
and `status_quote` fields for papers cited **about this taxon** that are
not in the corpus. For each candidate:

1. Resolve it through Crossref or the reference store to a real
   citation — never from recall (`feedback_verify_against_corpus`).
   PaleoDB is the backup for pre-DOI work
   (`reference_paleodb_citation_lookup`).
2. Confirm it is not already filed under a different key.
3. Add it to `papers-needed.md` under "Additional papers" as `- [ ]`
   with the resolved DOI and one line on why it matters.

If any candidate is load-bearing — it decides validity, or carries the
current emended diagnosis — surface the list and offer a **second fetch
round** before applying. Otherwise note them and continue.

**Hard stop when you offer a second round.** Wait for the user.

## Step 4 — Apply

Run the apply script:

```
npm run intake-apply -- <Genus>
```

This merges the extraction JSON files into `bootstrap.yml` and writes
`staging/intake/<Genus>/final.yml`. Bibliographic data lives in the
**reference store** (`references/<letter>/<key>.yml`, one file per
reference); the genus file cites each paper with an `{id, notes?}`
pointer. The script resolves each citation against the store directly:
when the store file `references/<letter>/<key>.yml` exists, it adds the
pointer; when it does **not** exist, the script **skips** that citation
and emits a warning rather than writing an unresolved pointer — a pointer
must resolve to a complete store entry. (The describing paper's store
file is normally written at bootstrap when PBDB/Crossref supplied its
metadata; a paper the bootstrap could not resolve is handled in 4b.)

### Step 4b — Add missing reference-store entries

For every apply warning of the form `Reference <key>: no reference-store
entry yet; citation skipped`, read the citation string from
`staging/intake/<Genus>/papers-needed.md` (the line beginning
`- [x] **<key>** — ...`) and create `references/<letter>/<key>.yml`
(`<letter>` = the ASCII-folded lowercase first character of the key)
using the canonical field order:

```yaml
id: <key>
authors: ...
year: ...
title: ...
journal: ...
volume: "..."
issue: "..."
pages: ...
publisher: ...
doi: ...
```

Do **not** add a `url:` that just points at the DOI, and do **not** put
`notes:` in the store file — notes are per-citation and live on the
pointer in the genus file. Then **re-run** `npm run intake-apply --
<Genus>`; the re-run finds the new store entry and adds the pointer
(carrying the agent's notes for supplementary papers).

For supplementary papers (when the agent's extraction set `is_describing:
false`), the paper's role is recorded as `notes:` on the genus file's
pointer — the apply step copies it from the agent's `notes`. The prompt
caps that at 200 characters, the validator's warning threshold, and
apply warns when an agent overshoots anyway; trim any it flags down to
the paper's role in one sentence rather than letting it reach the
validator. If the citation was skipped, the agent's notes are stashed at
`staging/intake/<Genus>/pending-notes/<key>.txt`; once the store entry
exists and you re-run apply, the pointer notes are restored from the
extraction automatically.

Editorial polish at this stage:

- **Settle `status`.** Read
  `staging/intake/<Genus>/status-evidence.md`, which apply writes when
  any paper ruled on validity. It carries each paper's verdict **quoted
  verbatim**, because paraphrase flattens exactly the nuance that
  decides this: `varricchio2025a` reads as endorsing the
  *Latenivenatrix* synonymy in summary, but actually adopts it "for
  working purposes" while stating the status "remains in question".
  Weigh the quotes against each other, pick the outcome from the
  **Outcomes** list at the top of this skill, and set `status` by hand —
  apply never writes it. State which quote decided it when you show the
  user `final.yml`. A lone recent reassessment that nobody has adopted
  is not `disputed` — `feedback_disputed_status_criterion`.

- **Description = Wikipedia paragraph 1, minus a fixed strip-list.**
  The bootstrap already pulls this; just confirm. Strip **only**:
  numeric reference markers like `[1]`, hyperlink markup, pronunciation
  IPA blocks, the etymological gloss in parentheses immediately after
  the genus name (those go into the structured `etymology:` and
  `pronunciation:` fields), and **British spellings**, which become
  American — "palaeontologist" → "paleontologist". The American English
  policy wins over verbatim reproduction here; the exemption for
  verbatim quotation applies to quoted spans, and a description is not
  a quotation (`feedback_american_english`). Beyond that strip-list, do
  NOT paraphrase, summarize, or stitch in claims from the agent's notes
  — `feedback_verify_against_corpus`. Read the cached article first at
  `$OPEN_PALEO_WD_DIR/wikipedia/<Genus>.json` (defaults to a sibling
  `../open-paleo-wd/wikipedia/`; parse `text`, paragraph 1 = up to the
  first `\n\n`); WebFetch is the fallback
  when the genus isn't cached.

- **Which diagnosis the record carries.** When more than one published
  diagnosis exists, use the most recent **emended** one, then:
  - **Drop** characters the retain-side source itself rejects. Uteodon
    lost its occipital-condyle character because the braincase carrying
    it was reassigned to *Dryosaurus*.
  - **Keep** characters that only the *sinking* source rejects.
    Adopting a sinker's character verdicts wholesale while marking the
    taxon `disputed` is incoherent — rejecting the characters *is* its
    case for sinking. Oxalaia keeps the two characters Smyth rejects
    but Sales retains, and drops the one Sales rejects.
  - **Keep** a character the sinking source merely could not evaluate.
    Latenivenatrix keeps all three pubic characters because Cullen's own
    verdict records that he could not assess them.

- **Drop supplementary papers that turned out to say nothing.** If an
  extraction came back empty of anything about this taxon — or the paper
  never names it — remove it from the `references` block rather than
  citing it. Citing a paper that does not mention the taxon is padding,
  and it reads downstream as corroboration that does not exist. Six
  papers were dropped this way across the eight bucket-A genera. Tell
  the user which ones you dropped and why.
- **PBDB seed corrections are routine.** The bootstrap copies
  `species[0].name`, `period`, `location.region/formation/coordinates`
  straight from PBDB; these are wrong often enough that you must
  inspect each one against the corpus paper / your notes / Wikipedia.
  Don't promote until you've corrected them. Common patterns:
  PBDB-seeded species name is often the wrong species of a multi-
  species genus, or a synonym of the type, or even another genus's
  type species; PBDB-seeded period/age can span the entire range
  the family ever existed; PBDB-seeded coordinates can be from a
  referred-specimen locality, not the holotype's.
- **Verify every paper-attributed claim.** If the description prose,
  reference notes, or synonym `reason:` attributes a specific claim
  to a specific author-year (e.g. "synonymised by Smith 1999"),
  that claim must trace back to (a) corpus content actually read,
  (b) Wikipedia paragraph 1 (verbatim), or (c) your notes.
  Never invent citations from general/Wikipedia recall when the
  paper exists in the corpus — `feedback_verify_against_corpus`.
- Etymology values from the agent are sometimes terse. Polish them to
  match the project's house style: source language, source word(s) in
  quotes, gloss in parens, full sentence ending with a period (e.g.
  "From Greek 'mikros' (small) and 'keras' (horn); meaning
  'small-horned'.").
- Species etymology should match the same pattern when applicable.
- Authority abbreviations such as "Dr." can be dropped.

Show the user the final content of `final.yml` (or a diff if the
bootstrap is large), and ask whether to proceed with promotion.

**Hard stop.** Wait for the user to respond.

## Step 5 — Promote and validate

Once the user approves:

```
bash .claude/skills/intake-genus/promote.sh <Genus>
```

This moves `final.yml` to `genera/<Letter>/<Genus>.yml`. It refuses
to overwrite an existing file — if the user expected a re-intake
(stub replacement) they must remove the existing YAML first.

Then run validation and build:

```
npm run validate
npm run build
```

If validation produces errors, surface them and ask whether to fix
them in-place or revert. If validation produces only warnings, list
them and ask whether to proceed.

If `npm run build` modifies `dist/`, restore it:

```
git restore dist/
```

(per the project's `feedback_no_commit_dist` rule — the GitHub
Action regenerates these).

## Step 6 — Commit

Stage the new genus file **and every reference-store file created for
it** (any `references/<letter>/<key>.yml` you authored in step 4b) — the
pointers must land in the same commit as the store entries they resolve
to, or validation fails on push:

```
git add genera/<Letter>/<Genus>.yml
git add references/<letter>/<key>.yml   # one per new store entry
```

Run `git status` and confirm the staged set is exactly the genus file
plus its new store entries (no `dist/`).

Draft a commit message of the form:

```
<Genus>: full-fat intake from PBDB/Wikipedia + <citation_keys>

<one or two sentences from your notes — what the genus is,
its describing paper, and any resolution paper applied>.
```

Show the user the staged diff and the proposed commit message.

**Hard stop.** Wait for the user to approve before committing.

After approval:

```
git commit -m "<message>"
```

Append the canonical co-author line per the project's commit-message
template.

## Step 7 — Push, then close issue

Sequence:

1. Pull rebase autostash FIRST so the genus commit's final SHA is
   stable before we record it anywhere:

   ```
   git pull --rebase --autostash
   ```

   This may reassign the genus commit's SHA if origin advanced
   while we were working (e.g. the previous genus's `build:`
   commit landed between our commit and our pull).

2. Capture the (now-stable) genus commit SHA:

   ```
   commit_sha=$(git rev-parse --short HEAD)
   ```

3. Push the genus commit:

   ```
   git push origin main
   ```

4. Run the GitHub-side close helper with the issue number the user
   gave in Step 1 and the SHA from step 2:

   ```
   bash .claude/skills/intake-genus/close-issue.sh <Genus> <issue_number> <commit_sha>
   ```

   This adds the completion comment, removes the `Intake: ...`
   sub-label, and closes the issue. It does NOT touch any in-repo
   files.

## Step 8 — Clean up staging

```
rm -rf staging/intake/<Genus>
```

Tell the user the genus is fully intaken, and give them the final commit
SHA and issue URL.

---

## Citation key disambiguation

Keys are uniformly `<author><year><letter>` — a fresh describing paper is
keyed `<author><year>a`. The bootstrap compares the resolved DOI against
every existing `<author><year>*` store entry and reuses the matching key,
so a same-author same-year collision is caught **whenever both papers
carry a DOI**. When one does not — most pre-DOI literature — the scripts
still disambiguate by key name alone, and the collision is invisible to
them; the checklist's sibling list is what surfaces it for you.

Because keys are **append-only** (every key already carries a
disambiguation letter), a collision means only the **new** paper needs the
next free letter — nothing existing is renamed or retagged. When the user
flags one (e.g. "the existing `averianov2024a` is the rspb noasaurid, not
the JVP ornithomimid"):

1. Give the new paper the next free letter (`<author><year>b`, or `c`…).
   Edit `staging/intake/<Genus>/bootstrap.yml` and
   `staging/intake/<Genus>/papers-needed.md` to use it, then re-run the
   apply step.
2. Confirm the new store file `references/<letter>/<author><year>b.yml`
   was written and the new genus's `references[].id` / `erected_in` point
   at it. Commit the new store file and genus YAML together.

**Do NOT rename markdown files in the paper corpus**
(`$OPEN_PALEO_PAPERS_DIR/markdown/`, defaults to
`../open-paleo-papers/markdown/`). The papers repo has its
own workflow that the user runs after this repo's `dist/references.bib`
regenerates; that workflow detects the split and renames the
markdown files. If you rename them yourself, you'll desync that
workflow's view of what changed.

It is fine to *create* a new markdown file in the corpus when the
user fetches a brand-new paper — the no-rename rule only applies to
files that already exist.

## Failure handling

- **Bootstrap fails** (network down, PBDB unavailable): retry once,
  then surface the error. Do not proceed to step 3.
- **No papers fetched** (resume reports "No papers marked as fetched"):
  reread `papers-needed.md` aloud, remind the user to tick `[x]`
  boxes, and stop.
- **Agent dispatch returns sentinel JSON** for the describing paper:
  the apply step will refuse to set scalar fields. Surface this and
  ask the user whether to retry the dispatch or abandon and fall
  back to a stub-only entry.
- **Validation fails after promote**: leave the file in place,
  surface the validation error, and ask whether to fix-in-place or
  revert via `git restore genera/<Letter>/<Genus>.yml` followed by
  `rm` of the file (since it was new).
- **Push rejected** (someone else pushed in the meantime): pull
  rebase autostash and re-push. If the rebase has conflicts, stop
  and ask the user.

## Memory-rule compliance

Follow the project's persistent rules at every gate:

- Never commit `dist/` — `feedback_no_commit_dist`.
- Pull rebase autostash before push — recurring pattern.
- Treat each "Wait for the user" as a hard stop —
  `feedback_skill_approval_gates`.
- No markdown formatting in `notes:` reference fields —
  `project_reference_conventions`.
- A `synonyms:` array records names that sink INTO this taxon, never
  the reverse. If a paper sinks this genus into another, that belongs
  in the status verdict and the dispute prose, not in `synonyms:` —
  `feedback_synonyms`.
- Run spellcheck before apply where applicable —
  `feedback_intake_pre_apply_steps`. (For intake-apply we have
  built this in: the agent's JSON is plain text and the apply step
  is a structured merge, so no separate spellcheck pass is needed
  — but if you see misspelled tokens in the agent output, fix the
  JSON before running apply.)
- Verify every paper-attributed claim against the corpus when the
  paper exists in `$OPEN_PALEO_PAPERS_DIR/markdown/` — never cite
  from general/Wikipedia recall — `feedback_verify_against_corpus`.
- The PBDB-seeded species block, period, and location in
  `bootstrap.yml` are routinely wrong; replace them during step 4
  polish — `feedback_pbdb_species_seed`.
- A validly published, undiagnosable dinosaur name is a `genera/`
  record with `status: nomen dubium`, never an `excluded.yml` entry —
  see **Outcomes**.
- `status` is set by hand at the apply gate from the verbatim quotes in
  `status-evidence.md`; apply never writes it.
- Description follows the American English policy even though it is
  otherwise Wikipedia paragraph 1 as written —
  `feedback_american_english`.
- The bootstrap reuses a key whose store DOI matches, and lists the
  existing sibling entries with their titles when it mints a fresh
  suffix. Read that list: for a pre-DOI paper there is no DOI to match
  on, so a sibling is often the paper being sought.
- Wikipedia article cache lives at
  `$OPEN_PALEO_WD_DIR/wikipedia/<Genus>.json` — read it before
  falling back to WebFetch — `reference_wikipedia_cache`.
- Hard stop before applying the Wikipedia-fallback for an
  unobtainable describing paper; every paper is a fresh decision
  for the user — `feedback_wikipedia_fallback_pattern`.
- American English in prose fields (center, not centre); proper-
  noun institution names stay as-is — `feedback_american_english`.
