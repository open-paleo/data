---
name: intake-species
description: Run the per-species intake pipeline. Adds a non-type species to an existing genus YAML. Bootstraps a species-level seed from PBDB and a cached genus Wikipedia article, pauses for the user to fetch the describing paper(s) into the local corpus, dispatches a dual-source Sonnet extraction agent (paper + Wikipedia), applies the result into a proposed merged genus YAML, then promotes/commits/closes.
user-invocable: true
argument-hint: "<Genus> <species> [issue]"
allowed-tools: Bash Read Write Edit Glob Grep Agent AskUserQuestion
---

# Intake Species

Run the per-species intake pipeline end-to-end with hard stops
between each stage so the user retains review control. This skill
adds a **non-type species** to an **existing genus YAML**. Use
intake-genus instead when the target taxon is a brand-new genus.

`$ARGUMENTS` must contain at least the genus and species epithet
(e.g. `Pinacosaurus hilwitnorum`). If a third token is present and
numeric, treat it as the GitHub issue number.

If `$ARGUMENTS` is empty, ask the user which species to intake;
there is no automatic "pick next" equivalent for species at this
time because the project does not maintain a triage queue for them.

---

## Outcomes

An intake does not always end in a valid species block, and non-type
species are exactly where it often does not: a name kept alive in the
literature as a dubious or sunk combination is one whose validity was
never settled. Name the expected outcome early and confirm it at the
apply gate. The set is:

- **valid** — diagnosable against its congeners, and current work
  treats it as a distinct species.
- **disputed** — a genuine no-consensus about this species' **own**
  validity. Not placement, age, or referred-material disagreements, and
  not a single unadopted reassessment —
  `feedback_disputed_status_criterion`.
- **nomen dubium** — validly published, but the type material cannot
  currently diagnose it. It still gets a species block; the status
  carries the verdict.
- **nomen nudum** — the name never met the ICZN's publication
  requirements.
- **junior synonym of a species already in this genus** — no new block.
  The name goes in the senior species' `synonyms:` array at the
  matching rank (`feedback_synonyms`), and the intake becomes that
  smaller edit. Say so and stop rather than adding a block.
- **belongs to a different genus** — the recombination lands elsewhere.
  Stop and redirect to the correct genus, or to intake-genus if that
  genus has no file yet.

The bootstrap seeds `status: valid` unconditionally. **That is a
placeholder, not a finding** — treat it as unset until you settle it at
Step 4.

### Where the call gets made

Twice:

1. **Provisionally, at Step 1**, before the user fetches anything. If
   you expect either of the last two outcomes, say so then — neither
   produces a new species block, so fetching for one is wasted work.
2. **For real, at the Step 4 apply gate**, from
   `staging/intake-species/<Genus>-<species>/status-evidence.md`.

---

## Step 1 — Confirm scope

Verify:

- The genus YAML exists at `genera/<Letter>/<Genus>.yml`. If not,
  surface the gap and propose using the intake-genus skill instead.
- The species is not already listed in that genus's `species[]`
  array. If it is, surface and stop.
- The species is a real published taxon, not a nomen nudum or
  preprint. Briefly state what the new species is (one or two
  sentences from PBDB/Wikipedia recall) and confirm scope.

Tell the user which species we are about to add and the existing
genus's parent / type species, so they can sanity-check the placement.

State the **provisional outcome** from the list above in a sentence or
two, with what would change it. If you expect the name to end as a
junior synonym of a species already in this genus, or to belong to a
different genus entirely, raise it now — neither adds a species block.

## Step 2 — Bootstrap

Run the bootstrap script:

```
npm run intake-species-bootstrap -- <Genus> <species>
```

(Pass `--issue <N>` when the issue number is known — it lands in the
`papers-needed.md` header for traceability.)

This writes:

- `staging/intake-species/<Genus>-<species>/bootstrap.species.yml` —
  best-effort species block seeded from PBDB (often sparse for
  freshly-named taxa)
- `staging/intake-species/<Genus>-<species>/genus-current.yml` —
  snapshot of the current genus YAML, for diff review later
- `staging/intake-species/<Genus>-<species>/papers-needed.md` —
  describing-paper citation key checklist

If a Wikipedia article exists for the genus, the bootstrap also
caches it at `$OPEN_PALEO_WD_DIR/wikipedia/<Genus>.json` so the
resume step's Sonnet prompts can read it alongside the corpus paper.

After the script returns, **read both `bootstrap.species.yml` and
`papers-needed.md` yourself** and summarise to the user:

- Which PBDB-seeded fields the bootstrap captured (type_specimen,
  locality, age, authority) and which it didn't
- The proposed describing-paper citation key (or "PBDB has no
  record" — common for post-2020 taxa)
- Whether that key already names a reference-store entry
- The **"Fields left unseeded"** list, if any. The bootstrap declines to
  guess a region it cannot resolve to an ISO 3166-2 code, or an interval
  that is not a stage name; those are yours to fill from the paper at
  Step 4.
- Any **sibling store entries** it listed under the proposed key. When
  no DOI is available to match on, one of those siblings is often the
  paper being sought — check their titles before the user fetches
  anything under a fresh key.

### Verify the bootstrap-proposed key

PBDB species-level records are sparser than genus-level. When the
bootstrap proposes a key:

1. Cross-check the author + year against the Wikipedia article (the
   cached file at `$OPEN_PALEO_WD_DIR/wikipedia/<Genus>.json` has a
   sub-section per species in most cases).
2. If the proposed key already exists in the bib, confirm the
   bib entry's title matches the describing paper for THIS species —
   not a different paper by the same author in the same year.
3. If the species was previously described in another genus (a
   recombination), the describing paper is usually the recombining
   paper, not the original. The synonyms block will record the
   prior combination.

If the bootstrap is wrong, edit `papers-needed.md` to point at the
correct key and note the override above the checkbox.

**Hard stop.** Tell the user:

> Bootstrap complete. Fetch the describing paper into
> `$OPEN_PALEO_PAPERS_DIR/markdown/<key>.md` (defaults to
> `../open-paleo-papers/markdown/`), tick `[x]` in
> `staging/intake-species/<Genus>-<species>/papers-needed.md` and
> paste a citation string on the same line after a `— ` separator.
> When done, say "resume".

Wait for the user to respond.

## Step 3 — Resume (build extraction prompts)

### First, verify each fetched paper is the paper

For every key the user ticked, grep its markdown for the binomial and,
when you have one, the holotype number:

```
grep -ic "<species>" "$OPEN_PALEO_PAPERS_DIR/markdown/<key>.md"
```

**A paper whose markdown never names the target species is the signature
of a key collision** — the fetch landed the wrong paper under the right
key, or the right paper under a key that already meant something else.
Stop and ask; do not extract from it.

Grep the epithet rather than the full binomial: a paper that erects the
species will often abbreviate the genus after first mention. And a zero
on a 19th-century or OCR'd source proves nothing — ligatures and
scanning noise defeat a literal grep
(`feedback_search_traps_archaic_sources`); read a few lines instead.

### Then build the prompts

Once the papers check out:

```
npm run intake-species-resume -- <Genus> <species>
```

On success the script writes `prompts.jsonl` — one JSON object per
line, each with a fully-formed `prompt` field that instructs the
agent to read both the corpus paper and the cached Wikipedia article
and to focus only on `<Genus> <species>`.

For each line in the JSONL, dispatch a Sonnet sub-agent via the
Agent tool with `subagent_type: "general-purpose"` and explicit
`model: "sonnet"`, passing the prompt verbatim. Run the dispatches
in parallel (one Agent invocation per paper, all in a single
message) when there are multiple papers.

After the agents return, verify each
`staging/intake-species/<Genus>-<species>/extractions/<key>.json`
exists and check for sentinel-failure markers (`empty: true`).

### Step 3b — Chase the citations the extractions surfaced

Read the extractions' `notes` and `status_quote` fields for papers cited
**about this species** that are not in the corpus. This matters most for
a species with a long nomenclatural history, where the paper that
settles its validity is often neither the original description nor the
recombining paper, and appears in no corpus bibliography.

For each candidate: resolve it through Crossref or the reference store
to a real citation — never from recall
(`feedback_verify_against_corpus`); PaleoDB is the backup for pre-DOI
work (`reference_paleodb_citation_lookup`). Confirm it is not already
filed under a different key. Then add it to `papers-needed.md` under
"Additional papers" as `- [ ]` with the DOI and one line on why.

If any candidate decides validity, surface the list and offer a
**second fetch round** before applying. **Hard stop** when you do.

## Step 4 — Apply

Run the apply script:

```
npm run intake-species-apply -- <Genus> <species>
```

This merges the extraction JSON files into the PBDB-seeded species
block and the existing genus YAML, writing
`staging/intake-species/<Genus>-<species>/genus-proposed.yml`.

### Step 4b — Polish

Read the proposed YAML and apply the same polish discipline as the
genus pipeline:

- **Settle `status`.** The seed says `valid` unconditionally; that is a
  placeholder. Read
  `staging/intake-species/<Genus>-<species>/status-evidence.md`, which
  apply writes when any paper ruled on validity. It carries each
  verdict **quoted verbatim**, because paraphrase flattens exactly the
  nuance that decides this — a paper can adopt a synonymy "for working
  purposes" while stating the status "remains in question". Weigh the
  quotes, pick from the **Outcomes** list at the top of this skill, and
  set `status` by hand; apply never writes it. Say which quote decided
  it when you show the diff.
- **Diagnosis supersession.** When more than one published diagnosis
  exists, use the most recent **emended** one. Drop characters the
  retain-side source itself rejects; **keep** characters that only the
  *sinking* source rejects, since rejecting them is that source's whole
  case for sinking, and keeping the taxon while adopting its verdicts is
  incoherent; **keep** characters the sinking source could not evaluate.
- **Drop supplementary papers that turned out to say nothing.** If an
  extraction came back empty of anything about this species, remove it
  from the `references` block rather than citing it. A citation that
  never mentions the taxon reads downstream as corroboration that does
  not exist.

- **Missing reference-store entries.** Bibliographic data lives in the
  reference store (`references/<letter>/<key>.yml`); the genus file cites
  each paper with an `{id, notes?}` pointer. For every apply warning
  `Reference <key>: no reference-store entry yet; citation skipped`, create
  `references/<letter>/<key>.yml` from the papers-needed.md citation
  (`id`, authors, year, title, journal, volume, issue, pages, publisher,
  doi — **no** DOI-pointer `url`, and **no** `notes` in the store file),
  then re-run the apply step. The re-run adds the pointer, carrying the
  supplementary paper's role as `notes:` from the extraction. The prompt
  caps that at 200 characters, the validator's warning threshold, and
  apply warns when an agent overshoots anyway; trim any it flags to the
  paper's role in one sentence rather than letting it reach the validator.
- **PBDB seed corrections.** The bootstrap copies whatever PBDB
  reports for the species: locality coordinates, formation, age
  range. These are routinely wrong or imprecise for newly-erected
  species; correct against the paper before promoting —
  `feedback_pbdb_species_seed`.
- **Holotype institution.** Prefer the canonical abbreviation from
  `institutions.yaml`. Aliases in the registry should be resolved
  to the canonical key.
- **Diagnostic features.** At the species level (this field),
  intra-genus differentia are the point. Write tight: drop the
  "Differs from G. typeSpecies in..." prefix — the field already
  lives under the species block and the convention is that the
  implicit comparison is to the type species. Comparative phrases
  ("more prominent", "fused", "reduced") read fine on their own.
  Add a parenthetical contrast only when the trait would otherwise
  be ambiguous (e.g. "Fused parietals (paired in G. typeSpecies)").
  Standalone autapomorphies are also fine. Reject bullets that
  compare to species in OTHER genera; those belong in the paper,
  not in this schema. Reject clade-shared traits. (See issue #1862
  for the rationale behind the species-level field.)
- **Etymology.** Polish to project house style (e.g. `From Greek
  'word' meaning 'gloss' and Latin 'word' meaning 'gloss';`).
- **Genus description update.** If the existing genus description
  claims monotypy ("the genus is monotypic", "the single species
  is...", "the type species is the only known species"), update it
  to reflect the new species addition.
- **American English** in prose fields; proper-noun institution
  names stay as-is.
- **Verify every paper-attributed claim** against the corpus —
  `feedback_verify_against_corpus`.

When polish is complete, show the user the diff between
`genus-current.yml` and `genus-proposed.yml` (the new species block
plus any reference additions) and ask whether to proceed with
promotion.

**Hard stop.** Wait for the user to respond.

## Step 5 — Promote and validate

Once the user approves:

```
bash .claude/skills/intake-species/promote.sh <Genus> <species>
```

This replaces `genera/<Letter>/<Genus>.yml` with the merged proposed
YAML.

Then run validation and build:

```
npm run validate
npm run build
```

If validation produces errors, surface them and ask whether to fix
them in-place or revert (`git restore genera/<Letter>/<Genus>.yml`).
If validation produces only warnings, list them and ask whether to
proceed.

If `npm run build` modifies `dist/`, restore it:

```
git restore dist/
```

(per `feedback_no_commit_dist`).

## Step 6 — Commit

Stage the modified genus file **and any reference-store file created for
the new species** (any `references/<letter>/<key>.yml` you authored in
step 4b) — the pointer and its store entry must land in the same commit
or validation fails on push:

```
git add genera/<Letter>/<Genus>.yml
git add references/<letter>/<key>.yml   # one per new store entry
```

Run `git status` and confirm the staged set is the genus file plus its
new store entries only (no `dist/`).

Draft a commit message of the form:

```
<Genus> <species>: add species from <citation_keys>

<one or two sentences from the paper — what the species is, where it
was found, and any taxonomic context (recombination, new species in
existing genus, etc.). Closes #N.>
```

Show the user the staged diff and the proposed commit message.

**Hard stop.** Wait for the user to approve before committing.

After approval:

```
git commit -m "<message>"
```

Append the canonical co-author line.

## Step 7 — Push and close issue

Pull rebase autostash before push so the genus commit's SHA is
stable:

```
git pull --rebase --autostash
commit_sha=$(git rev-parse --short HEAD)
git push origin main
```

If the commit body has a `Closes #N` trailer, GitHub auto-closes the
issue on push. Otherwise (or to add the canonical completion
comment), run:

```
bash .claude/skills/intake-species/close-issue.sh <Genus> <species> <issue> <commit_sha>
```

Verify the issue actually closed via `gh issue view <issue> --json
state` — `feedback_verify_bulk_ops`.

## Step 8 — Clean up staging

```
rm -rf staging/intake-species/<Genus>-<species>
```

Tell the user the species is fully intaken, give them the final
commit SHA and issue URL, and ask whether to immediately pick up
another species addition.

---

## Failure handling

- **Bootstrap fails** (network down, PBDB unavailable): retry once,
  then surface the error. Do not proceed to step 3.
- **No papers fetched** (resume reports "No papers marked as
  fetched"): reread `papers-needed.md` aloud, remind the user to
  tick `[x]` boxes, and stop.
- **Agent dispatch returns sentinel JSON** for the describing
  paper: the apply step will refuse to set scalar fields. Surface
  this and ask the user whether to retry the dispatch or abandon.
- **Validation fails after promote**: revert via `git restore
  genera/<Letter>/<Genus>.yml`, surface the validation error, and
  ask the user how to proceed.
- **Push rejected** (someone else pushed in the meantime): pull
  rebase autostash and re-push. If the rebase has conflicts, stop
  and ask the user.

## Memory-rule compliance

Follow the project's persistent rules at every gate:

- Never commit `dist/` — `feedback_no_commit_dist`.
- Pull rebase autostash before push.
- Treat each "Wait for the user" as a hard stop —
  `feedback_skill_approval_gates`.
- No markdown formatting in `notes:` reference fields —
  `project_reference_conventions`.
- Verify every paper-attributed claim against the corpus when the
  paper exists in `$OPEN_PALEO_PAPERS_DIR/markdown/` — never cite
  from general/Wikipedia recall — `feedback_verify_against_corpus`.
- PBDB-seeded fields are routinely wrong; correct against the
  paper during step 4b polish — `feedback_pbdb_species_seed`.
- The seeded `status: valid` is a placeholder. Settle it at the apply
  gate from the verbatim quotes in `status-evidence.md`; apply never
  writes it — see **Outcomes**.
- A `synonyms:` array records names that sink INTO this taxon, never
  the reverse. If a paper sinks this species into another, that belongs
  in the status verdict, not in `synonyms:` —
  `feedback_synonyms`.
- Wikipedia article cache lives at
  `$OPEN_PALEO_WD_DIR/wikipedia/<Genus>.json` — read it before
  falling back to WebFetch — `reference_wikipedia_cache`.
- American English in prose fields — `feedback_american_english`.
- Synonym entries match rank: binomials → species-level
  `synonyms:` nested under the relevant species entry —
  `feedback_synonyms`.
