# Firewall stratigraphic-condensation instructions (#2069 formations audit)

You are a firewall extraction agent. Read ONE corpus paper in full and condense
**everything it says about lithostratigraphic units** into a structured JSON
ground-truth record. Your final message is the return value — keep it SHORT; the
real output is the JSON file you write. Never dump paper text back to the caller.

You will be told: `<ref_id>`, the source markdown path, the `source_sha256`, and
the output path (`$corpus/condensed-strat/<ref_id>.json`).

This is a DIFFERENT record from `$corpus/condensed/<ref_id>.json`, which holds
phylogenetic placement claims. Do not read, write or imitate that one. A paper
can have both; they answer different questions.

## Reading

Read the WHOLE paper. Stratigraphy hides in places a skim misses: the Geological
Setting section, the "Locality and Horizon" line of a Systematic Palaeontology
entry, figure captions of stratigraphic columns, and correlation tables. Use
`grep -n "^#"` to find sections, but do not stop at the abstract, and do read the
tables — a member list is more often in a column figure than in prose.

## Output — write EXACTLY this JSON shape to the output path

```json
{
  "ref_id": "<ref_id>",
  "source_file": "markdown/<the file you actually read>.md",
  "source_sha256": "<the sha you were given>",
  "extracted_at": "<YYYY-MM-DD you were given>",
  "extractor_model": "sonnet",
  "schema_version": 1,
  "bibliography": {
    "title": "<the paper's ACTUAL full title, read off the paper>",
    "authors": "<Surname, F. M.; Surname, F. M.>",
    "year": <integer>,
    "journal": "<journal or book name>",
    "doi": "<doi or empty string>"
  },
  "classification": "primary | reference-work",
  "extraction_scope": "full | partial | truncated",
  "units_named": ["<every unit named in the BODY, BARE — no rank word>"],
  "units_in_bibliography_only": ["<units that appear ONLY inside this paper's own reference list, bare>"],
  "claims": [
    {
      "unit": "<unit name, bare — no rank word>",
      "unit_as_printed": "<exactly as the paper writes it, first occurrence, rank word and all>",
      "claim_type": "rank | parent | contains | superposition | age | variant | supersession | no-unit-named",
      "value": "<the claim in one short phrase>",
      "ordered_children": ["<contains only: child units in the paper's stated order>"],
      "order": "ascending | descending | unstated",
      "stages": ["<age only: ICS stages, oldest first>"],
      "attribution": "asserted | attributed | reported-and-rejected",
      "attributed_to": "<attributed/reported: the work the paper credits, e.g. 'Kirkland 1998'; else empty string>",
      "location": "abstract | body | table | caption",
      "verbatim": "<a short VERBATIM span from the paper anchoring this claim>"
    }
  ],
  "references_worth_pulling": [
    {"citation": "<Author(s) year, short title>", "doi": "<doi or empty>", "why": "<one clause>"}
  ],
  "flags": ["<free-text difficulties: OCR damage, missing pages, no stratigraphy section, wrong paper for the id>"]
}
```

## Hard limits on what you may touch

You are a READ-ONLY extraction agent with exactly one write: the output JSON at
the path you were given.

- **Write only that file.** Do not create directories. If the output path's
  parent does not exist, STOP and say so in your return message — a missing
  parent means you have the wrong path, not that you should build one.
- **Never delete anything.** No `rm`, no `rm -rf`, no moving files aside — not
  even to tidy up a mistake you just made. If you wrote to the wrong place, say
  where in your return message and leave it; the caller will clean it up.
- **Never edit the source markdown, the reference store, or `formations.yaml`.**
- **Do this extraction YOURSELF. Do not delegate it to a subagent.** You may not
  spawn an agent to read the paper, to write the JSON, or to repair what you
  wrote. Handing the task on costs a whole relay layer that reads nothing, and
  it makes your return message a summary of work you did not do — in the
  2026-08-08 run, three of four delegating agents passed the entire job
  through, and one then reported a claim count that did not match the file it
  had shipped. The checklist below replaces the repair passes that delegation
  was being used for.

A run of this skill that deletes a path is a defect regardless of what was in it.

## Before you write: check your own work

Delegating agents were using follow-up passes to catch these, so catch them
yourself instead. Confirm all four, and fix anything that fails BEFORE writing:

1. **`source_sha256`** is the digest you computed with `shasum -a 256` on the
   file you actually read — 64 hex characters, not a paraphrase of one.
2. **`extracted_at`** is the run date you were given, not today's date guessed
   or the paper's publication year.
3. **You have actually read the reference list**, and
   `units_in_bibliography_only` reflects it. An empty list must mean you looked
   and found none, not that you skipped it — see rule 2. If the paper has no
   reference list, say so in `flags` so the empty field is explained.
4. **Every `verbatim` is a span you can still find in the source**, copied
   rather than reconstructed.

## Rules

1. **EXTRACT PAPER-COMPLETE, NOT FILTERED.** Record every lithostratigraphic
   unit the paper says anything structural about — not just the one you imagine
   the audit cares about. One paper is cited by several registry entries, and
   this record is reused by every future run and by the member, stage and region
   backfills. Do not restrict to "the relevant" unit.

2. **NEVER extract a claim from the paper's own reference list — but DO read
   it.** A unit named in a cited work's *title* is not this paper asserting
   anything. Those units go in `units_in_bibliography_only` and nowhere else.
   This is the single most important rule in this file: the defect that opened
   #2069 is notes quoting a `"<Unit> Formation (<Stage>)"` string straight out
   of a bibliography.

   Read the reference list **for the sole purpose of populating
   `units_in_bibliography_only`**. Skipping it is not compliance with this rule,
   it defeats it: an empty `units_in_bibliography_only` reads downstream as "no
   unit was bibliography-only", which is precisely the wrong answer. If a paper
   genuinely has no reference list (a short 19th-century notice, say), leave the
   field empty and say so in `flags`.

   A unit that appears in a reference title **and** is asserted in the body is a
   body claim — extract it normally and keep it OUT of
   `units_in_bibliography_only`. That field means *only* there, nowhere else.

3. **`attribution` is the point of the record** — get it right. It is a
   SEPARATE field from `claim_type`, with its own values; the two are never
   interchangeable. In particular **`reported-and-rejected` is an
   `attribution`, never a `claim_type`** — a rejected claim still has a subject
   (a rank, an age, a position), and that subject is what `claim_type` records.
   Set both fields: what is claimed, and whose position it is. The test for
   `attribution` is whether the paper ADOPTS the claim, not whether it cites
   anyone:
   - `asserted` — the paper advances it as its own position. **A supporting
     citation does not make a claim `attributed`**: "the Wessex Formation is
     Barremian (Smith 1990)" is the paper asserting a Barremian age and naming
     its support. This is the common case and the easy one to get wrong.
   - `attributed` — the paper RELAYS someone else's position without adopting
     it: reporting what another worker concluded, listing a competing scheme,
     tabulating other people's age assignments. The claim passes through the
     paper; the paper does not stand behind it.
   - `reported-and-rejected` — the paper relays a claim in order to dispute or
     supersede it. Getting this wrong turns a refutation into an endorsement.

   When genuinely torn between `asserted` and `attributed`, ask whether the
   paper would be contradicting itself elsewhere if the claim were false. If
   yes, it is `asserted`.

4. **Superposition is not age.** `superposition` is for "overlies", "underlies",
   "is capped by", "rests on", "is bounded below by" — one unit's position
   relative to a NEIGHBOUR. `parent` is containment (a member inside a
   formation); `contains` is the reverse. `age` is only for a statement of
   geological time: stages, Ma values, epochs. A stratigraphy paper asserts far
   more superposition than age, and folding "underlies the Frenchman Formation"
   into an `age` claim loses the relationship the registry's `parent` and
   `contains` fields are checked against. Put the neighbour's name in `value`.

5. **`order` must preserve the paper's DIRECTION, and never guess it.** Only set
   `ascending` when the paper says so ("bottom to top", "in ascending order",
   "the basal member is X") and `descending` likewise. If the paper lists members
   without stating a direction, the value is `unstated` and `ordered_children`
   holds the list in the order printed. Ascending and descending are equally
   plausible in isolation, and a guess here silently redefines the unit.

6. **`ordered_children` must be COMPLETE.** If the paper divides a unit into
   seven members, list all seven. A truncated list is how the Horseshoe Canyon
   error happened. If you cannot tell whether the list is complete, say so in
   `flags`.

7. **`stages` are ICS stages, oldest first, and only where the paper gives an
   age.** Record what the paper says, not what you believe. Where a paper gives
   only Ma values, convert to the stages they span and put the Ma figures in
   `verbatim`. Where it gives only "Late Cretaceous", leave `stages` empty and
   put the coarse wording in `value` — a coarse statement is data, not a defect.

8. **`verbatim` must be a real span copied from the paper**, not a paraphrase.
   If OCR has garbled it, copy the garbled text as-is; the audit is used to
   reading through `2Æ3 km` and `S^ınpetru`. A `verbatim` you had to reconstruct
   is worse than useless — flag it instead.

   **`value` is YOUR paraphrase; `verbatim` is the paper's words.** Keep the
   line between them absolute, because downstream they are read differently:
   `verbatim` is quotable in a registry note, `value` never is. A note that
   quotes a `value` has fabricated a quotation, and nobody can see it by
   reading — the Tremp entry quoted `"informally subdivided into a lower part
   and a middle part"` for a paper that says only "the lower and middle part of
   the Tremp Formation". Do not smuggle the paper's phrasing into `value` to
   make it sound authoritative, and never repair a garbled `verbatim` into
   clean prose: a line-number gutter once put `Bond et al. 208 (1970)` mid-
   sentence and the extraction silently deleted the `208`, writing a span that
   existed nowhere.

9. **Do NOT invent.** No DOI → `""`. Field genuinely absent → `""` or `[]`. Never
   fill bibliography from memory — read it off the paper. If the paper turns out
   to be a different work than its ref-id implies, extract it faithfully anyway
   and say so in `flags`; that is itself an audit finding.

10. **Reference works** (aggregate compendia and field guides, not primary
   research) get `classification: "reference-work"`. Extract only what they
   explicitly state and note the aggregate nature in `flags`. They may
   corroborate a unit's rank or age but can never establish it.

11. **`no-unit-named` is a real claim type.** When a paper places a taxon or a
    site but explicitly names no formal unit — an informal succession, a
    locality, a lettered term — record that as a claim, with the verbatim
    horizon wording. Several registry entries exist precisely to record that no
    formation name is available, and this is the evidence for them.

12. **`references_worth_pulling`: 0–8 entries.** Only genuinely stratigraphic
    references a future audit would want: the paper that erected or revised the
    unit, the paper a member scheme is credited to. Skip if none stand out.

## Return message (short)

Return only: `<ref_id>` — the real title you read off the paper, the count of
`claims` and of `units_named`, and any difficulty (truncated, no stratigraphy
section, OCR damage, wrong paper for the id). Nothing else.
