# Tier-1 semantic audit — per-entry instructions (#2069 formations audit)

You audit ONE entry of `formations.yaml` — one stratigraphic unit — for
citations that misrepresent what the cited paper actually says. You compare each
claim against the pre-built STRATIGRAPHIC CONDENSATION of the cited paper, never
against the paper markdown and never from your own knowledge. The condensations
are the ground truth. Your final message is short; the real output is the
findings JSON you write.

You will be told: the unit name, the entry's fields and pointers, the absolute
`<CONDENSED_DIR>` (the corpus repo's `condensed-strat/`), the Tier-0 result path,
and your output path.

## Why this registry is different

Every other audit in this repo checks a RECORD against its paper. This checks the
REGISTRY, which is upstream of the records. A wrong member list produces no
validation error — it silently defines what "correct" means for every record
that resolves through it. Be correspondingly careful in both directions.

## Inputs to read

1. The entry, as given to you (fields + pointers with their `notes`).
2. For each pointer's ref-id, `<CONDENSED_DIR>/<ref_id>.json`.
   - Missing file → the paper is a reference-work or was not condensed. Record
     the pointer as `unverifiable`. Do NOT invent a verdict.
3. The Tier-0 result, for this unit only. Tier-0 has already checked, purely
   mechanically, whether each quoted span appears in the paper at all and whether
   it appears only inside that paper's reference list. Treat its flags as
   established fact about the STRING; your job is what the string means.

## The two directions to check

**Direction 1 — does each pointer's `notes` say what the paper says?**
Every assertion in a note is load-bearing: quoted spans, member lists,
containment, orderings, rank statements, age wordings.

**Direction 2 — is each structural field on the entry supported by some cited
paper?** Walk `rank`, `kind`, `parent`, `contains`, `variants`,
`rank_contested`, `stages` and find the pointer that establishes each. A field no
cited paper supports is a finding even when every note is individually accurate.

## Matching a registry key to a condensation's units

The registry keys units bare ("Hell Creek"); condensations are asked for bare
names but frequently return them with the rank word attached ("Hell Creek
Formation"), and homonymous units are country-disambiguated in the registry
("Hekou (CN-GS)"). **Match tolerantly**, or you will manufacture the highest-
severity verdict in this file out of a formatting difference:

- ignore a trailing rank word (Formation, Group, Subgroup, Member, Bed(s),
  Svita, Series) on either side;
- ignore the registry key's parenthetical country/basin qualifier;
- ignore case, accents and hyphenation, and read through OCR damage;
- check the entry's `variants` list too — the paper may use only a variant
  spelling.

Only after all of those fail is the unit genuinely absent. When a match is
uncertain, say so in the finding rather than asserting absence.

## Verdicts

- `consistent` — the condensation supports the claim, in content and direction.
  **No finding.** This is the expected outcome for most pointers.
- `paper-does-not-name-unit` (high) — the unit is absent from the condensation's
  `units_named`. Check `units_in_bibliography_only` too: if the unit appears
  there, the note has quoted the title of a work in the cited paper's reference
  list, and the cited paper asserts nothing about this unit at all. Say which of
  the two it is.
- `quote-not-in-paper` (high) — a span the note sets in quotation marks does not
  occur in the paper. Defers to Tier-0 for the string check; your contribution is
  whether the underlying claim survives without the quote.

  **Check the condensation's `value` fields before you clear one of these.** If
  the note's quoted span reproduces a `value` rather than a `verbatim`, the note
  was written from the extraction record instead of the paper, and the quotation
  is fabricated even where its sense is right — that is this verdict, not a
  formatting artifact. It is the one failure mode you cannot catch by reading
  the note, because a good paraphrase reads exactly like a real quote. Say so
  explicitly in `evidence` when you find it: the fix is to requote from
  `verbatim`, not to reword.

  **CLAIM BOUNDARIES ARE THE EXTRACTOR'S, NOT THE PAPER'S.** Never infer from
  two claims that the source text is in two places. One sentence routinely
  becomes several claims — a locality-and-horizon line yields a variant claim
  and a parent claim — and a note quoting straight across it is quoting one
  contiguous span, not splicing. Djadokhta was reported as "two claims stitched
  together with a semicolon" when the semicolon is the paper's own and the two
  `verbatim` fields sit sixty characters apart in one sentence; the only real
  defect there was a normalized `=` for the paper's OCR-rendered `D`. If your
  finding depends on where the source text breaks, you cannot settle it from the
  condensation — say so in `evidence` and let the human check the paper.
- `misattributed` (high) — the condensation shows `attribution: attributed` or
  `reported-and-rejected`, but the note presents the claim as the cited paper's
  own finding. **Not a finding when the note itself names the third party** —
  "Kirkland (1998) gives the member as …" inside a pointer to a different paper
  is honest sourcing, at most a modeling smell. It IS a finding when the note
  reads as though the cited paper said it.

  **Before filing this, read the `verbatim` and ask whose sentence it is.** A
  paper that states something in its own voice and names its support at the end
  — "In Goiás it oversteps the basalts and overlies the Botucatu (Fúlfaro et
  al. 1994)" — is ASSERTING with a citation, which condense-instructions rule 3
  says is `asserted`. Extractors mislabel that as `attributed` often enough to
  matter: it produced a `misattributed` finding against a correct Echaporã note,
  and would have produced it again on every future run. If the verbatim reads as
  the paper's own sentence, the defect is in the condensation's `attribution`
  field, not in the registry — say so in `evidence` and file nothing against the
  entry.
- `direction-inverted` (high) — the note's ordering runs opposite to the paper's,
  or its containment is upside down (a member made the parent, a basal member
  described as the highest).
- `incomplete-list` (high) — the note's member or containment list omits units
  the paper lists. This is the Horseshoe Canyon error exactly: two members
  missing and one inverted, in a claim that quoted nothing.
- `overstated` (medium) — the note asserts a settled scheme or firm result where
  the paper hedges, proposes, or notes disagreement.
- `field-unsupported` (medium) — a structural field on the entry that no cited
  paper supports, including a field resting only on a reference work.
- `unverifiable` — no condensation, or the condensation's `extraction_scope` is
  `truncated`/`partial` and the claim turns on the missing part. Not a finding;
  it routes to the re-audit queue.

## Guardrails — each of these has produced a false finding before

1. **THE UNION RULE for `stages`.** The envelope is the UNION of what the sources
   publish, not a choice between them and not a consensus. A paper giving a
   NARROWER range than the envelope is exactly what the field is for and is
   **never** a finding. Flag `stages` only when an ENDPOINT of the envelope is
   supported by no cited paper at all. Narrowing an envelope to match one paper
   manufactures findings; it has changed the answer wrongly five times.

2. **A note that says the paper names no unit is honest, not defective.**
   Several entries exist to record that no formation name is available, and their
   notes say so. The condensation's `no-unit-named` claim type is the evidence
   FOR such a note. Do not report it as `paper-does-not-name-unit`.

3. **A coarse value stated as coarse is correct.** Where a group is the finest
   unit anyone has published, or a unit is informally named, the entry says so
   deliberately. Do not push for a finer value the literature does not have.

4. **Deliberate exclusions are policy.** The registry header records choices the
   audit must not relitigate — notably that Xiashaximiao / Shangshaximiao are
   subunits of Shaximiao rather than spellings of it, and the Sânpetru over
   Sînpetru orthography. Leave them alone.

5. **Degraded sources under-report.** OCR damage, pre-1990 typesetting and
   scanned tables all lose text. A thin condensation is NOT evidence the paper
   failed to say something. Return `unverifiable` and name the degradation.

6. **Verify BOTH directions before flagging.** If the note and the condensation
   agree, say `consistent`. Do not manufacture a discrepancy to have something to
   report; a clean entry is a good result.

## Output — write JSON to the given output path

```json
{
  "unit": "<registry key>",
  "pointers_checked": <int>,
  "fields_checked": ["rank", "stages", "..."],
  "findings": [
    {
      "field": "references.notes | rank | kind | parent | contains | variants | rank_contested | stages",
      "ref_id": "<id>",
      "cited_as": "<the claim as the entry states it, quoted or tightly paraphrased>",
      "verdict": "paper-does-not-name-unit | quote-not-in-paper | misattributed | direction-inverted | incomplete-list | overstated | field-unsupported",
      "severity": "high | medium | low",
      "evidence": "<what the condensation actually says — quote its value/verbatim/attribution/order — and why the entry conflicts>",
      "suggested_source": "<a ref-id or citation from the condensation's references_worth_pulling that WOULD support the claim, or empty string>",
      "cache_ref": "condensed-strat/<ref_id>#<unit>"
    }
  ],
  "unverifiable_pointers": [
    {"ref_id": "<id>", "reason": "no-condensation | reference-work | truncated-source", "cited_as": "<claim>"}
  ]
}
```

Write `"findings": []` when the entry is clean — that is the expected result for
most entries. Do not pad.

## Return message (short)

Return only: the unit name, `pointers_checked`, count of findings by verdict (or
"clean"), and count of unverifiable pointers. Nothing else.
