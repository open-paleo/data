---
name: batch-import
description: Run the batch import pipeline to fetch genera from PBDB/Wikipedia/Wikidata, review staged data for quality issues, promote into the repository, commit, and close intake issues.
user-invocable: true
argument-hint: "[--limit N] [--offset N] [--dry-run]"
allowed-tools: Bash Read Write Edit Glob Grep Agent AskUserQuestion
---

# Batch Import

Run the batch import pipeline: fetch genera from PBDB/Wikipedia/Wikidata,
review the staged data for quality issues, promote files into the
repository, then commit and close the associated intake issues.

Arguments are forwarded to the import script (e.g. `/batch-import --limit 20 --offset 100`).

---

## Step 1 — Run the import script

If the user did not supply a `--limit` argument, default to `--limit 25`.

Run the batch import script, forwarding any arguments the user provided
(with the default limit applied if needed):

```
npm run batch-import -- $ARGUMENTS
```

This writes YAML files into `staging/genera/`, `staging/clades/`, and
`staging/tree.yml`. It also produces `staging/report.json` and
`staging/pr-body.md`.

The script can take several minutes. Wait for it to finish completely
before continuing.

## Step 2 — Read the report

Read `staging/report.json`. Print a short summary to the user:

- Number of genera processed
- Number of new clades added
- Number skipped (already existing or no parent)
- Average field completion

Then list every genus with gaps (the `gaps` array in the report), grouped
by gap type, so the user can see at a glance what data is missing.

## Step 3 — Review staged data for quality issues

Read **every** staged genus YAML file in `staging/genera/`. For each file
check for the following problems:

**Description problems:**
- Starts with `"{Name} may refer to"` (disambiguation page leak)
- Contains stray wiki markup: `[[`, `]]`, `{{`, `}}`, `<ref`, `'''`
- Contains stray characters at the start of fields: leading semicolons,
  leading colons, leading pipes
- Is suspiciously short (under 40 characters) or empty
- Describes something clearly not a dinosaur (check for keywords like
  "person", "village", "river", "mountain", "film" that appear without
  "dinosaur", "genus", or "extinct" nearby)

**Pronunciation problems:**
- IPA field contains non-IPA text (e.g. `"Mongolian pronunciation:"`)
- IPA field is missing the enclosing slashes (`/`)
- Phonetic field starts with semicolons, quotes, or other stray characters
- Phonetic field is empty while IPA is also empty

**General field problems:**
- Any string field that is literally `"undefined"` or `"null"`
- Author names that look like wiki markup or HTML
- Coordinates that are `[0, 0]` or outside valid ranges
  (latitude: -90 to 90, longitude: -180 to 180)
- Period name or stage that is empty while `from_ma`/`to_ma` are present
- `described` year that is in the future or before 1800
- `country` field using a full country name instead of an ISO code
  (e.g. `United States` instead of `US`, `People's Republic of China`
  instead of `CN`) — check against the keys in `schema.countries`

**Holotype institution / country incongruence:**
- When a species has both a `holotype.institution` (or a resolvable
  specimen ID prefix) and a `location.country`, check whether the
  institution's location is consistent with the discovery country.
  Resolve the specimen ID prefix using `institutions.yaml` to get the
  full institution name, then compare the city/country in that name
  against the species' `location.country`. Flag cases where the
  institution is in a clearly different country from where the specimen
  was found (e.g. specimen ID prefix "GCC" resolves to an institution
  in Germany, but the species was found in China). This is a warning,
  not an error — some holotypes are legitimately housed abroad — but it
  often indicates the specimen ID was resolved to the wrong institution.

Collect all issues into a list. For each issue, note:
- The genus name
- The field with the problem
- What the current value is
- What the problem is

## Step 4 — Present issues and prompt for fixes

If any quality issues were found, present them to the user in a clear
table or grouped list. Then ask:

> "I found N data quality issues. Would you like me to fix these, or
> would you prefer to review and fix them manually?"

**Wait for the user to respond before continuing.**

- If the user says to fix them, apply sensible fixes:
  - Strip stray leading characters (semicolons, colons, pipes, quotes)
    from field values
  - Remove non-IPA text from the `ipa` field (set it to empty/remove the
    field if the value is clearly not IPA)
  - Remove description fields that are disambiguation text or describe
    non-dinosaur topics (set to empty string so the field is omitted)
  - Remove `[0, 0]` coordinates
  - **Country names instead of ISO codes** — read `schema.countries`, find
    the key whose value matches the full name (case-insensitively), and
    replace `country:` with that ISO code. If no match is found, flag it
    as needing manual entry.
  - For other issues, note them as unfixable and tell the user
- If the user wants to fix them manually, wait for the user to tell you
  they are done, then re-read the affected files to verify the fixes
  before continuing
- If there are no issues, say so and continue immediately

**Omitting genera:** The user may ask to omit or skip specific genera
during review. When this happens:

1. Delete those genera from `staging/genera/` so they are not promoted
2. Keep track of the omitted genus names — you will need them in Step 5
   (to avoid promoting them) and Step 8 (to avoid closing their issues)

**Disputed genera:** The user may indicate that a genus should be marked
as disputed (e.g. when a genus maps to a different genus due to disputed
classification). When this happens:

1. Delete those genera from `staging/genera/` so they are not promoted
2. Keep track of the disputed genus names separately from regular
   omissions — you will pass them to the close-issues script in Step 8
   so it can add the "Intake: Disputed" label to their issues

## Step 5 — Promote staged files into the repository

Run the promotion helper script:

```
bash .claude/skills/batch-import/promote.sh
```

This copies genus files, new clade files (without overwriting existing
ones), and the updated `tree.yml` into the repository.

## Step 6 — Validate and build

Run validation:

```
npm run validate
```

### Report validation results to the user

Parse the output and report:

1. **Errors** (grouped by check name) — list every error with the file,
   field, and what went wrong
2. **Warnings** (grouped by check name) — list every warning with the
   file and what went wrong

If there are **errors**, present them and ask:

> "Validation found N errors. Would you like me to auto-fix what I can,
> or would you prefer to fix them manually?"

**Wait for the user to respond before continuing.**

Common auto-fixable errors and their fixes:
- **`from_ma`/`to_ma` outside stage range** — remove the `from_ma` and
  `to_ma` fields (keep the stage name, which is more authoritative than
  PBDB's formation-level age ranges)
- **Missing required field `description`** — write a short factual
  description derived from the genus's parent clade, diet, period, and
  formation
- **Holotype missing `institution`** — look up the specimen ID prefix in
  the `museumNames` dictionary in `batch-import.ts`; if not found, flag
  it as needing manual entry
- **Missing parent clade** — check if the clade file was missed during
  promotion
- **Schema error in a genus file** — read the file and fix the field

After fixing (or the user fixing manually), re-run `npm run validate`
until it passes with 0 errors.

If there are **warnings**, present each one and propose a specific fix.
Ask the user:

> "Validation also found N warnings. Here are my proposed fixes — shall
> I apply them?"

**Wait for the user to respond before continuing.** Common warnings and
their fixes:
- **Country not in schema countries list** — the `country` field contains
  a full name instead of an ISO code; look up the matching key in
  `schema.countries` and replace it
- **Any other warning** — read the affected file, diagnose the cause, and
  propose the most conservative fix

After applying warning fixes (or if there are none), re-run
`npm run validate` to confirm 0 errors and 0 warnings before building.

Once validation passes, run:

```
npm run build
```

This regenerates the `dist/` and `docs/` output files. It must succeed
before committing.

## Step 7 — Commit the changes

First, discard any local changes to generated output files — the GitHub
Action will rebuild these automatically:

```
git restore dist/ docs/open-paleo.json
```

Then stage and commit the new data:

```
git add genera/ clades/ tree.yml
```

Use the following commit message format:

```
Add {N} genera via batch import

Batch import of {N} genera from PBDB, Wikipedia, and Wikidata.
New clades added: {M}
```

Where `{N}` is `generaProcessed` and `{M}` is the count of new clades
from the report.

**Important:** Do NOT push or create a PR. Show the user a summary of
what was committed and wait for further instructions.

## Step 8 — Close intake issues and clean up

Run the issue-closing helper script. If any genera were omitted during
review, pass them via `--skip` so their issues stay open. If any genera
were marked as disputed, pass them via `--disputed` so the script adds
the "Intake: Disputed" label to their issues (and keeps them open):

```
bash .claude/skills/batch-import/close-issues.sh --skip Genus1,Genus2 --disputed Genus3,Genus4
```

If no genera were omitted or disputed, run it without flags:

```
bash .claude/skills/batch-import/close-issues.sh
```

This reads `staging/report.json`, closes every non-skipped intake issue
via `gh`, labels disputed issues, spot-checks a sample, and then deletes
the `staging/` directory. Report the total closed issues and disputed
issues to the user.
