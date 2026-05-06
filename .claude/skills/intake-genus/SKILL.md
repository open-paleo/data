---
name: intake-genus
description: Run the per-genus intake pipeline. Picks the next eligible Bucket B entry from reports/intake-triage.md (or accepts an explicit genus), bootstraps a stub from PBDB/Wikipedia/Wikidata, pauses for the user to fetch describing/supplementary papers into the local corpus, dispatches Haiku 4.5 extraction agents, applies the results, then promotes/commits/closes.
user-invocable: true
argument-hint: "[Genus]"
allowed-tools: Bash Read Write Edit Glob Grep Agent AskUserQuestion
---

# Intake Genus

Run the per-genus intake pipeline end-to-end with hard stops between
each stage so the user retains review control. The pipeline is for
**Bucket B** (modern + obscure) entries from `reports/intake-triage.md`
— Bucket C (iconic legacy) and Bucket D (disputed-but-keep) require
different flows and are out of scope here.

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

**Hard stop.** Tell the user:

> Bootstrap complete. Fetch the listed papers into
> `~/Desktop/open-paleo-papers/markdown/`, then for each fetched
> paper, tick `[x]` in `staging/intake/<Genus>/papers-needed.md` and
> paste a citation string on the same line after a `— ` separator.
> Updating `dist/references.bib` is not required — the apply step
> parses the citation directly from `papers-needed.md`. When done,
> say "resume" so I can build the extraction prompts.

Wait for the user to respond.

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

For each line in the JSONL, dispatch a Haiku 4.5 sub-agent via the
Agent tool with `subagent_type: "general-purpose"`, passing the
prompt verbatim and an explicit instruction to write its JSON output
to the `output_path` named in the entry. Run the dispatches in
parallel (one Agent invocation per paper, all in a single message)
when there are multiple papers.

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
false`), the script will already have copied the agent's `notes` field
into the reference's `notes`. Leave that text in place if it captures
the paper's role; trim it under 200 chars (the validator's warning
threshold) if it does not.

Editorial polish at this stage:
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

## Step 7 — Push and close

Per the project's commit-and-push memory rule: pull rebase autostash
first, then push:

```
git pull --rebase --autostash
git push origin main
```

Capture the commit SHA from `git rev-parse HEAD`.

Then close the GitHub issue and mark the triage row as done:

```
bash .claude/skills/intake-genus/close-issue.sh <Genus> <commit_sha>
```

## Step 8 — Clean up staging

```
rm -rf staging/intake/<Genus>
```

Tell the user the genus is fully intaken, give them the final commit
SHA and PR/issue URL, and ask whether to immediately pick the next
Bucket B genus.

---

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
