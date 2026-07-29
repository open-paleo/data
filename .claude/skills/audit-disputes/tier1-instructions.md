# Tier-1 semantic citation audit — per-locus instructions (#1968)

You audit ONE locus (a genus or clade YAML) for citation claims that
misrepresent what the cited paper actually says. You compare each load-bearing
claim in the locus prose against the pre-built CONDENSATION of the cited paper —
never against the paper markdown, never from your own knowledge. The
condensations are the ground truth. Your final message is short; the real output
is the findings JSON you write.

You will be told: the locus name/kind, its YAML path, and the output path.

## Inputs to read

1. The locus YAML (genus or clade file).
2. For each reference id in the locus's `references:` list, the condensation at
   `<CONDENSED_DIR>/<ref_id>.json` — you will be given the absolute `<CONDENSED_DIR>`
   (it is the corpus repo's `condensed/` directory).
   - If that file does NOT exist, the paper is either a reference-work
     (aggregate compendium — e.g. jones2026a, paul2024a) or not in the corpus.
     Such claims cannot be verified against a primary source: record them as
     `unverifiable`, do NOT invent a verdict.

## What counts as a load-bearing claim

Any statement in the locus prose that attributes a specific finding to a cited
paper. They live in:
- `dispute.summary` and `dispute.history[].note` — "Author (year) recovered / regarded / placed …"
- each `references[].notes` — e.g. "Recovered Minmi as an unstable wildcard outside Eurypoda."
- `description` prose, if it attributes a claim to a paper.

Focus on PLACEMENT / AFFINITY / VALIDITY / NOMENCLATURAL claims (where a taxon
sits, whether it is valid/nomen dubium, synonymy, who named it). IGNORE citations
used only to source a non-placement datum (body mass, hip height, integument,
histology, age) — those are not this audit's concern; note them as `out-of-scope`
only if you must, otherwise skip.

### Clade loci only — also check the authority fields

When the locus is a CLADE file, two structured fields are load-bearing citations
in their own right, not just prose. Check each against its condensation:

- **`erected_in`** asserts THIS paper is where the clade name was coined. Confirm
  the condensation shows the paper erecting/naming that clade (a `description`
  claim_type on the clade itself, or the clade appearing as a new name). Verdict
  `name-not-erected` (class 2, high) when the paper plainly does not coin it.
- **`described_in`** asserts a genuine revision/redescription of the clade.
  Verdict `not-a-revision` (class 3, medium) when the condensation shows only a
  passing mention or a claim about unrelated taxa.

Two cautions, because both produce false positives easily:

1. **A paper's TITLE is not evidence either way.** Family-group names are
   routinely erected inside papers about a single genus — an erecting act often
   sits in a Systematic Palaeontology header, not the title. Judge only on
   whether the condensation records the naming act.
2. **Pre-1990 and OCR'd sources under-report.** If the condensation is thin,
   truncated, or garbled, that is NOT evidence the paper failed to erect the
   name. Return `unverifiable` and say the source was too degraded to decide.

Report these under `field: "erected_in"` / `field: "described_in"`.

## How to check each claim against the condensation

Find the relevant taxon in the condensation's `taxa_treated` (for a clade locus,
the claim is usually about the clade's monophyly/membership — reason over the
member taxa's entries).

Verdicts:
- `consistent` — the condensation's `recovered_position` / `claim_type` matches
  the prose claim's content AND direction. No finding.
- `direction-inverted` (class 3) — the paper's actual finding is the OPPOSITE of
  the prose (e.g. prose "recovered within X" but condensation says "outside X";
  prose "disagreed" but paper agreed). FINDING, high severity.
- `overstated` (class 3) — prose asserts a firm phylogenetic RESULT but the
  condensation's `claim_type` for that taxon is `mention` or `comparison-only`
  (the paper only names it in passing / compares it, runs no such result). This
  is the Tethyshadros trap. FINDING, high severity.
- `taxon-absent` (class 2) — the prose attributes a placement claim to the paper,
  but the taxon does not appear in the condensation's `taxa_treated` at all.
  FINDING, high severity. (Double-check spelling/synonyms before concluding.)
- `misattributed` (class 1) — the condensation's `bibliography` shows this paper
  is a different work than the claim implies (wrong topic/taxon entirely).
  FINDING, high; note it defers to the Tier-0 bibliographic result.
- `unverifiable` — no condensation (reference-work or not-in-corpus). Not a
  finding; record for coverage accounting.

Be conservative and verify BOTH directions: if the prose and condensation
actually agree, say `consistent` — do NOT manufacture a discrepancy. A paper can
legitimately be cited for a hypothesis it entertains even if it does not endorse
it; only flag when the prose misstates what the paper did.

## Output — write JSON to the given output path

```json
{
  "locus": "<name>",
  "kind": "genus | clade",
  "file": "<repo-relative path>",
  "claims_checked": <int>,
  "findings": [
    {
      "field": "dispute.summary | dispute.history | references.notes | description",
      "ref_id": "<id>",
      "cited_as": "<the prose claim, quoted or tightly paraphrased>",
      "problem_class": 2,
      "verdict": "direction-inverted | overstated | taxon-absent | misattributed",
      "severity": "high | medium | low",
      "evidence": "<what the condensation actually says — quote its recovered_position/claim_type — and why the prose conflicts>",
      "cache_ref": "condensed/<ref_id>#<taxon>"
    }
  ],
  "unverifiable_refs": [
    {"ref_id": "<id>", "reason": "reference-work | not-in-corpus", "cited_as": "<claim>"}
  ]
}
```

If there are no findings, write `"findings": []` — that is a good, expected
result for most loci. Do not pad.

## Return message (short)

Return only: locus name, claims_checked, count of findings by verdict (or "clean"),
and count of unverifiable refs. Nothing else.
