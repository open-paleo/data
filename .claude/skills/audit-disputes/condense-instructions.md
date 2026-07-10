# Firewall paper-condensation instructions (#1968 citation audit)

You are a firewall extraction agent. Read ONE corpus paper in full and condense
it into a structured JSON ground-truth record. Your final message is the return
value — keep it SHORT; the real output is the JSON file you write. Never dump
paper text back to the caller.

You will be told: `<ref_id>`, the source markdown path, the `source_sha256`, and
the output path (`$corpus/condensed/<ref_id>.json`).

## Reading

Read the WHOLE paper. If the file is too large for one Read, read it in chunks
and/or `grep -n "^#"` to find the Systematic Palaeontology, Results (phylogeny),
and Discussion/Conclusions sections — those carry the placement claims. Do not
stop at the abstract.

## Output — write EXACTLY this JSON shape to the output path

```json
{
  "ref_id": "<ref_id>",
  "source_file": "markdown/<ref_id>.md",
  "source_sha256": "<the sha you were given>",
  "extracted_at": "2026-07-09",
  "extractor_model": "sonnet",
  "schema_version": 1,
  "bibliography": {
    "title": "<the paper's ACTUAL full title, read off the paper>",
    "authors": "<Surname, F. M.; Surname, F. M.>",
    "year": <integer>,
    "journal": "<journal or book name>",
    "doi": "<doi or empty string>"
  },
  "classification": "primary",
  "extraction_scope": "full",
  "taxa_treated": [
    {
      "taxon": "<genus or binomial>",
      "recovered_position": "<the phylogenetic position/affinity THIS paper assigns or recovers — name the clade, and the sister-taxon or direction where stated>",
      "claim_type": "phylogenetic-analysis | referral | description | comparison-only | mention",
      "confidence": "strong | weak | equivocal",
      "verbatim_support": "<short verbatim phrase or close paraphrase anchoring the position>",
      "notes": "<optional; else empty string>"
    }
  ],
  "references_worth_pulling": [
    {"citation": "<Author(s) year, short title>", "doi": "<doi or empty>", "why": "<one clause>"}
  ]
}
```

## Rules

1. **EXTRACT PAPER-COMPLETE, NOT FILTERED.** Populate `taxa_treated` with EVERY
   taxon this paper makes a placement/affinity claim about — every terminal it
   recovers in a named position, every taxon it refers to a clade, synonymizes,
   or reassigns. Do NOT restrict to any subset or "the relevant" taxa. A future
   audit of a different clade may rely on this same record.
2. **`claim_type` is the point of the record** — get it right:
   - `phylogenetic-analysis` — scored in THIS paper's numerical analysis, recovered in the reported position.
   - `referral` — assigned/referred to a clade without (or beyond) scoring.
   - `description` — erects or redescribes the taxon.
   - `comparison-only` — appears only in comparative discussion, not as a placement result.
   - `mention` — named in passing (e.g. in a list), no placement claim.
   This is what lets the audit catch a citation that treats a passing mention as
   if it were a phylogenetic result.
3. **`recovered_position` must preserve the paper's DIRECTION** (e.g. "recovered
   OUTSIDE Ankylosaurinae" vs "WITHIN Ankylosaurinae"). Used to catch dispute
   prose that inverts a paper's finding.
4. **`confidence` reflects the PAPER'S OWN characterization of support for THAT
   taxon's position** — "weakly supported", low bootstrap/Bremer, "tentative",
   or wildcard → `weak`; firmly recovered / well-supported → `strong`; explicitly
   unresolved/ambiguous → `equivocal`. Do NOT infer confidence from `claim_type`.
   If the paper says nothing about support, use `equivocal`.
5. **Do NOT invent.** No DOI → `""`. Field genuinely absent → `""`. Never fill
   bibliography from memory — read it off the paper. If the paper is a reference
   work / field guide (aggregate, not primary research), set `classification` to
   `reference-work`, keep `taxa_treated` to only positions it explicitly states,
   and note the aggregate nature.
6. **`references_worth_pulling`: 0-8 entries.** Only genuinely placement-relevant
   references (phylogenetic analyses, key redescriptions of taxa in this clade)
   that a citation audit would want but might miss. Skip if none stand out.

## Return message (short)

Return only: `<ref_id>` — count of `taxa_treated`, the real title you read off
the paper, and any difficulty (paper truncated, no phylogeny section, title
ambiguous, wrong paper for the id, etc.). Nothing else.
