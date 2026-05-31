---
name: intake-genus
description: Run the per-genus intake pipeline. Picks the next eligible Bucket B entry from reports/intake-triage.md (or accepts an explicit genus), bootstraps a stub from PBDB/Wikipedia/Wikidata, pauses for the user to fetch describing/supplementary papers into the local corpus, dispatches Sonnet extraction agents, applies the results, then promotes/commits/closes.
user-invocable: true
argument-hint: "[Genus]"
allowed-tools: Bash Read Write Edit Glob Grep Agent AskUserQuestion
---

# Intake Genus

Run the per-genus intake pipeline end-to-end with hard stops between
each stage so the user retains review control. The pipeline was
originally written for **Bucket B** (modern + obscure) entries from
`reports/intake-triage.md`, and `npm run intake-pick-next` only
returns Bucket B candidates. The same pipeline also works for
Bucket D Cat III/IV stubs (`status: nomen dubium`, minimal
diagnostic features) when the user supplies an explicit genus name
— see `reports/bucket-d-classification.md` for the categories.
Bucket C (iconic legacy) is more complex and is still out of scope.

If `$ARGUMENTS` is empty, the skill picks the next eligible Bucket B
genus by alphabetical order. If the user supplied a genus name, use
that genus instead.

---

## Step 1 — Pick the genus

If `$ARGUMENTS` is empty:

```
npm run intake-pick-next
```

Parse the JSON line from stdout — `{issue, genus, label, notes}` — and
report it to the user as the candidate. If the script exits non-zero,
report that no eligible Bucket B entry remains and stop.

If `$ARGUMENTS` is non-empty, treat the first positional token as the
genus name and look up its triage row by reading
`reports/intake-triage.md` directly.

Tell the user which genus we are about to process and the triage
notes.

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
- `staging/intake/<Genus>/triage.md` — verbatim triage notes (when
  the triage report has a row for this genus)

After the script returns, **read both files yourself** and summarise
to the user:

- How many fields the bootstrap populated
- The proposed describing-paper citation key
- Whether that key is already in `dist/references.bib`
- Any supplementary papers the triage notes mention (e.g. the 2024
  Słowiak reassessment paper for Bagaraatan)

If the triage notes explicitly call out a supplementary paper, edit
`papers-needed.md` to add a stub entry under
"Additional papers (optional)" with the citation key and DOI, marked
`- [ ]`. The user will mark `[x]` once they have it.

### Verify the bootstrap-proposed key

The bootstrap script auto-derives a citation key from PBDB's reported
genus authority (e.g. `marsh1888`). PBDB is wrong **often enough that
this is a routine check, not an exception**. Common failure modes:

- **PBDB tracks a homonym, not the type.** Ex: Titanosaurus Lydekker
  1877 (Indian, valid) vs. Titanosaurus Marsh 1877 (preoccupied
  American name → renamed Atlantosaurus). PBDB returned Marsh as
  authority; the triage and Wikipedia both said Lydekker.
- **The proposed key already exists in the bib but for a different
  paper.** Ex: bootstrap proposed `marsh1888` for Ceratops — that
  key is already in the bib, but it's the Pleurocoelus / Potomac
  Formation paper, not the Ceratopsidae paper.
- **The proposed key adds a fresh letter suffix even though the
  right key exists.** Ex: bootstrap proposed `leidy1856c` /
  `osborn1924c` / `marsh1877e` when the real describing paper was
  already filed as `leidy1856b` / `osborn1924a` / `marsh1877a`.

Before reporting the proposed key to the user, **always**:

1. Compare the proposed key against the triage notes' author + year.
   If they disagree, the bootstrap is wrong; flag it and propose the
   triage-aligned key.
2. If the proposed key is already in the bib, run a quick check
   (read the bib entry's title) to confirm it matches the paper the
   triage describes. If the title is from a different paper, the
   bootstrap has a key collision: mark this as a citation-key
   disambiguation case (see below).
3. If the bootstrap proposed a fresh letter suffix (`<key>e`,
   `<key>c`, etc.), grep for sibling keys (`<key>a`, `<key>b`, …) and
   confirm none of those is actually the right paper before adding a
   new suffix.

If the bootstrap is wrong, edit `papers-needed.md` to point at the
correct key and explain the glitch in the line above the checkbox so
the user understands why the bootstrap-proposed key was overridden.

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
>    paragraph 1 verbatim; holotype block omitted; reference cited
>    with metadata from secondary literature; gap logged in
>    `corpus-paper-report.md` §1)
> 3. Defer this genus

If the user picks the Wikipedia-fallback path, follow the recipe in
`feedback_wikipedia_fallback_pattern` memory. Never invent specimen
IDs, autapomorphies, or paper-specific claims to paper over the gap.

Do NOT assume an earlier "go with the fallback" answer applies to a
different paper — every paper is a fresh decision.

## Step 3 — Resume (build extraction prompts)

Once the user confirms, run:

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

## Step 4 — Apply

Run the apply script:

```
npm run intake-apply -- <Genus>
```

This merges the extraction JSON files into `bootstrap.yml` and writes
`staging/intake/<Genus>/final.yml`. The script populates references
from `dist/references.bib` when the citation key happens to be present
already; otherwise it leaves a placeholder of the form:

```yaml
- id: <key>
  notes: 'TODO: fill in from papers-needed.md citation.'
```

### Step 4b — Fill in reference placeholders

For every reference entry whose `notes` is the `TODO:` placeholder,
read the corresponding citation string from
`staging/intake/<Genus>/papers-needed.md` (the line beginning
`- [x] **<key>** — ...`) and replace the placeholder with the parsed
fields. Use the project's canonical reference key order:

```yaml
- id: <key>
  authors: ...
  year: ...
  title: ...
  journal: ...
  volume: "..."
  issue: "..."
  pages: ...
  publisher: ...
  doi: ...
  url: http://dx.doi.org/<doi>
  notes: ...   # only when meaningful (e.g. supplementary papers)
```

For supplementary papers (when the agent's extraction set `is_describing:
false`):

- If the citation key was already in the bib, the script will have
  copied the agent's `notes` field into the reference's `notes`.
  Leave that text in place if it captures the paper's role; trim it
  under 200 chars (the validator's warning threshold) if it does not.
- If the citation key was NOT in the bib (the apply will have left a
  TODO placeholder), the script will have stashed the agent's notes
  in `staging/intake/<Genus>/pending-notes/<key>.txt`. After you
  fill in the reference metadata, also append the pending notes from
  that file as the reference's `notes:` field (trim under 200 chars).

Editorial polish at this stage:

- **Description = Wikipedia paragraph 1, verbatim.** The bootstrap
  already pulls this; just confirm. Strip only: numeric reference
  markers like `[1]`, hyperlink markup, pronunciation IPA blocks,
  and the etymological gloss in parentheses immediately after the
  genus name (those go into the structured `etymology:` and
  `pronunciation:` fields). Do NOT paraphrase, summarise, or stitch
  in claims from the agent's notes — `feedback_verify_against_corpus`.
  Read the cached article first at
  `$OPEN_PALEO_WD_DIR/wikipedia/<Genus>.json` (defaults to a sibling
  `../open-paleo-wd/wikipedia/`; parse `text`, paragraph 1 = up to the
  first `\n\n`); WebFetch is the fallback
  when the genus isn't cached.
- **PBDB seed corrections are routine.** The bootstrap copies
  `species[0].name`, `period`, `location.region/formation/coordinates`
  straight from PBDB; these are wrong often enough that you must
  inspect each one against the corpus paper / triage / Wikipedia.
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
  (b) Wikipedia paragraph 1 (verbatim), or (c) the triage notes.
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

If `npm run build` modifies `dist/` or `docs/`, restore those:

```
git restore dist/ docs/open-paleo.json
```

(per the project's `feedback_no_commit_dist` rule — the GitHub
Action regenerates these).

## Step 6 — Commit

Stage only the new genus file:

```
git add genera/<Letter>/<Genus>.yml
```

Draft a commit message of the form:

```
<Genus>: full-fat intake from PBDB/Wikipedia + <citation_keys>

<one or two sentences from the triage notes — what the genus is,
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

## Step 7 — Mark triage row, push, then close issue

The triage row update has to land in the SAME push as the genus
commit. Otherwise the GitHub Actions Build workflow on the genus
push races with a follow-up triage push and gets `[remote rejected]
cannot lock ref` when trying to push its `dist/` build outputs (it
self-corrects on the next push, but produces a noisy red `Build`
run that looks like real breakage).

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

3. Edit `reports/intake-triage.md` to append `[done <commit_sha>]`
   to the row's notes column. The row pattern is
   `| <issue> | <Genus> | <label> | ...notes... |`; add the
   `[done ...]` marker just before the trailing pipe.

4. Commit the triage update with a one-liner:

   ```
   git commit -m "Mark <Genus> triage row done in <commit_sha>"
   ```

   (Plus the canonical co-author line.)

5. Push both commits in one push:

   ```
   git push origin main
   ```

6. Now run the GitHub-side close helper, passing the same SHA you
   recorded in the triage row:

   ```
   bash .claude/skills/intake-genus/close-issue.sh <Genus> <commit_sha>
   ```

   This adds the completion comment, removes the `Intake: ...`
   sub-label, and closes the issue. It does NOT touch any in-repo
   files — that work was done in steps 3-4.

## Step 8 — Clean up staging

```
rm -rf staging/intake/<Genus>
```

Tell the user the genus is fully intaken, give them the final commit
SHA and PR/issue URL, and ask whether to immediately pick the next
Bucket B genus.

---

## Citation key disambiguation

The bootstrap and resume scripts auto-disambiguate proposed keys
against the bib by **key name only** — they do not inspect DOIs.
That means a bare `<author><year>` already in the bib will be reused
even if it actually points to a *different* paper by the same author
in the same year. This collision is invisible to the scripts; the
user typically catches it by recognising the DOI mismatch.

When the user flags such a collision (e.g. "the existing
`averianov2024` is the rspb noasaurid, not the JVP ornithomimid"),
disambiguate inside this repo only:

1. Edit the existing genus YAML(s) under `genera/` that reference the
   bare key — rename both the `references[].id` and every
   `species[].described_in` (and any other crossref) from `<key>` to
   `<key>a`. Use grep to find them all before editing.
2. Edit `staging/intake/<Genus>/bootstrap.yml` and
   `staging/intake/<Genus>/papers-needed.md` to use `<key>b` (or the
   next free letter) for the new paper.
3. Stage both the renamed pre-existing genus YAML(s) AND the new
   genus YAML in the same commit so the bib regenerates with both
   letter-suffixed keys atomically. Mention the rename in the commit
   body.

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

- Never commit `dist/` or `docs/` — `feedback_no_commit_dist`.
- Pull rebase autostash before push — recurring pattern.
- Treat each "Wait for the user" as a hard stop —
  `feedback_skill_approval_gates`.
- No markdown formatting in `notes:` reference fields —
  `feedback_no_markdown_in_reference_notes`.
- Run spellcheck before apply where applicable —
  `feedback_spellcheck_before_apply`. (For intake-apply we have
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
- The bootstrap script may propose a fresh disambiguation suffix
  when the bib already has the right entry, or an entry under the
  proposed bare key may be the wrong paper — check sibling keys
  and bib titles before fetching — `feedback_bootstrap_key_check`.
- Wikipedia article cache lives at
  `$OPEN_PALEO_WD_DIR/wikipedia/<Genus>.json` — read it before
  falling back to WebFetch — `reference_wikipedia_cache`.
- Hard stop before applying the Wikipedia-fallback for an
  unobtainable describing paper; every paper is a fresh decision
  for the user — `feedback_wikipedia_fallback_pattern`.
- American English in prose fields (center, not centre); proper-
  noun institution names stay as-is — `feedback_american_english`.
