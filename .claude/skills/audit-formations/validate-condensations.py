#!/usr/bin/env python3
"""Validate the stratigraphic condensations a Phase-1 batch produced.

Run this BEFORE spending anything on Tier-1. An extraction that silently drifted
from the schema does not fail loudly later -- it produces confident, wrong
findings, because Tier-1 treats these records as ground truth.

Checks, per condensation named in the manifest:
  * required keys present, `schema_version` known, sha 64 hex chars
  * `source_sha256` matches the manifest, so the record describes the file that
    is actually on disk now
  * enumerated fields hold only their allowed values
  * `units_named` and `units_in_bibliography_only` are disjoint
  * extractor_model is sonnet, since the parent model is Opus

Separately, and reported as WARNINGS rather than errors, each claim's `verbatim`
is looked for in the source markdown. A miss is a candidate, never a verdict:
the corpus converter injects citation links, page anchors and footnote markers
INTO running prose, which severs a faithfully copied span. The first pass of
this check flagged 30-odd spans across six records as "likely reconstructed" and
every one spot-checked was present and correct in the paper.

Usage:
    python3 validate-condensations.py [--manifest PATH]
"""

import argparse
import json
import os
import re
import sys
import unicodedata

from _paths import audit_dir, corpus_dir, strat_condensed_dir

REQUIRED_KEYS = (
    "ref_id",
    "source_file",
    "source_sha256",
    "extracted_at",
    "extractor_model",
    "schema_version",
    "bibliography",
    "classification",
    "extraction_scope",
    "units_named",
    "units_in_bibliography_only",
    "claims",
)
CLAIM_TYPES = {
    "rank",
    "parent",
    "contains",
    "superposition",
    "age",
    "variant",
    "supersession",
    "no-unit-named",
}
ATTRIBUTIONS = {"asserted", "attributed", "reported-and-rejected"}
ORDERS = {"ascending", "descending", "unstated"}
LOCATIONS = {"abstract", "body", "table", "caption"}
SCOPES = {"full", "partial", "truncated"}
CLASSIFICATIONS = {"primary", "reference-work"}


# Markup the converter injects INTO the middle of running prose: inline citation
# links, page anchors, footnote markers, column-break spans. A verbatim span
# copied faithfully out of the rendered text will not survive a literal search
# once one of these lands inside it, so they are stripped before comparison.
SOURCE_MARKUP = (
    re.compile(r"\]\(#[^)]*\)"),
    re.compile(r"<sup>.*?</sup>", re.DOTALL),
    re.compile(r"<sub>.*?</sub>", re.DOTALL),
    re.compile(r"<span[^>]*>|</span>|<br\s*/?>"),
    re.compile(r"!\[[^\]]*\]\([^)]*\)"),
)

# How many leading words of a verbatim span must be locatable before the span is
# accepted. A footnote or figure callout dropped mid-sentence severs the tail,
# which is a markup artifact rather than a reconstructed quote.
VERBATIM_PREFIX_WORDS = 8


def fold(text):
    """Fold a string for tolerant comparison against garbled source text.

    @param {str} text - the raw string
    @returns {str} unicode-normalized, lowercased, punctuation-collapsed text
    """
    folded = unicodedata.normalize("NFKD", text or "")
    folded = "".join(char for char in folded if not unicodedata.combining(char))
    # Rejoin words the typesetter broke across a line ("mem- ber C"). Applied to
    # BOTH sides of every comparison, so a span the extractor sensibly rejoined
    # still matches the source that split it.
    folded = re.sub(r"(\w)[-‐‑]\s+(\w)", r"\1\2", folded)
    return re.sub(r"[^a-z0-9]+", " ", folded.lower()).strip()


def fold_source(raw):
    """Fold a source markdown, stripping the markup that fragments prose.

    @param {str} raw - the markdown as read from disk
    @returns {str} the folded, de-marked text
    """
    for pattern in SOURCE_MARKUP:
        raw = pattern.sub(" ", raw)
    return fold(raw)


def locates(verbatim, folded_source):
    """Decide whether a verbatim span can be found in the folded source.

    Full containment first; failing that, the span's leading words, which
    survives a footnote or figure callout injected into the middle of the
    sentence the span was copied from.

    @param {str} verbatim - the claim's verbatim span
    @param {str} folded_source - the folded, de-marked source
    @returns {bool} True when the span is locatable
    """
    folded = fold(verbatim)
    if not folded or not folded_source:
        return False
    if folded in folded_source:
        return True
    prefix = " ".join(folded.split()[:VERBATIM_PREFIX_WORDS])
    return len(prefix.split()) >= 4 and prefix in folded_source


def check_claim(claim, index, folded_source, problems, warnings):
    """Validate one claim object.

    @param {dict} claim - the claim
    @param {int} index - its position, for the message
    @param {str} folded_source - the folded source markdown
    @param {list[str]} problems - structural-error accumulator, mutated in place
    @param {list[str]} warnings - soft-flag accumulator, mutated in place
    @returns {None}
    """
    where = f"claims[{index}]"
    claim_type = claim.get("claim_type")
    if claim_type not in CLAIM_TYPES:
        problems.append(f"{where}: claim_type {claim_type!r} not allowed")
    if claim.get("attribution") not in ATTRIBUTIONS:
        problems.append(f"{where}: attribution {claim.get('attribution')!r} not allowed")
    if claim.get("location") not in LOCATIONS:
        problems.append(f"{where}: location {claim.get('location')!r} not allowed")
    if claim_type == "contains" and claim.get("order") not in ORDERS:
        problems.append(f"{where}: contains claim needs a valid order")

    # A `no-unit-named` claim legitimately has NO identity to record -- that is
    # the whole claim, and several registry entries rest on exactly this
    # evidence. Where the paper offers a phrase ("an unnamed unit") it belongs
    # in `unit_as_printed`, but where it names a bare locality and no unit at
    # all there is nothing to put there, and the locality lives in `value`.
    # Every OTHER claim type must have a recoverable subject.
    has_identity = bool(
        (claim.get("unit") or "").strip() or (claim.get("unit_as_printed") or "").strip()
    )
    if claim_type != "no-unit-named" and not has_identity:
        problems.append(f"{where}: neither unit nor unit_as_printed is set")
    elif claim_type == "no-unit-named" and not has_identity and not (claim.get("value") or "").strip():
        problems.append(f"{where}: no-unit-named claim with no identity AND no value")

    verbatim = (claim.get("verbatim") or "").strip()
    if not verbatim:
        problems.append(f"{where}: empty verbatim")
    elif folded_source and not locates(verbatim, folded_source):
        warnings.append(
            f"{where}: verbatim not located -- check by hand before believing it "
            f"was reconstructed: {verbatim[:70]!r}"
        )


def check_record(record, paper, problems, warnings):
    """Validate one condensation against its manifest paper entry.

    @param {dict} record - the parsed condensation
    @param {dict} paper - the manifest paper entry
    @param {list[str]} problems - structural-error accumulator, mutated in place
    @param {list[str]} warnings - soft-flag accumulator, mutated in place
    @returns {None}
    """
    for key in REQUIRED_KEYS:
        if key not in record:
            problems.append(f"missing required key {key!r}")
    if problems:
        return

    if record["schema_version"] != 1:
        problems.append(f"unknown schema_version {record['schema_version']!r}")
    if record["extractor_model"] != "sonnet":
        problems.append(f"extractor_model is {record['extractor_model']!r}, expected sonnet")
    if record["classification"] not in CLASSIFICATIONS:
        problems.append(f"classification {record['classification']!r} not allowed")
    if record["extraction_scope"] not in SCOPES:
        problems.append(f"extraction_scope {record['extraction_scope']!r} not allowed")
    if not re.fullmatch(r"[0-9a-f]{64}", record["source_sha256"] or ""):
        problems.append("source_sha256 is not 64 hex characters")
    elif record["source_sha256"] != paper["source_sha256"]:
        problems.append(
            "source_sha256 does not match the manifest -- the record describes a "
            "different revision of the paper than the one on disk"
        )

    overlap = set(record["units_named"]) & set(record["units_in_bibliography_only"])
    if overlap:
        problems.append(
            f"units appear in BOTH units_named and units_in_bibliography_only: {sorted(overlap)}"
        )

    source_path = os.path.join(corpus_dir(), record["source_file"])
    folded_source = ""
    if os.path.exists(source_path):
        with open(source_path, encoding="utf-8", errors="replace") as handle:
            folded_source = fold_source(handle.read())
    else:
        problems.append(f"source_file does not exist: {record['source_file']}")

    for index, claim in enumerate(record["claims"]):
        check_claim(claim, index, folded_source, problems, warnings)


def main():
    """Validate every condensation the manifest expects and report."""
    parser = argparse.ArgumentParser(description="Validate stratigraphic condensations")
    parser.add_argument("--manifest", default=os.path.join(audit_dir(), "manifest.json"))
    args = parser.parse_args()

    with open(args.manifest) as handle:
        manifest = json.load(handle)
    condensed = strat_condensed_dir()

    missing, bad, soft, clean = [], {}, {}, 0
    for paper in manifest["papers"]:
        if paper["classification"] == "reference-work" or not paper["in_corpus"]:
            continue
        path = os.path.join(condensed, f"{paper['ref_id']}.json")
        if not os.path.exists(path):
            missing.append(paper["ref_id"])
            continue
        problems, warnings = [], []
        try:
            with open(path) as handle:
                record = json.load(handle)
        except json.JSONDecodeError as error:
            bad[paper["ref_id"]] = [f"invalid JSON: {error}"]
            continue
        check_record(record, paper, problems, warnings)
        if warnings:
            soft[paper["ref_id"]] = warnings
        if problems:
            bad[paper["ref_id"]] = problems
        else:
            clean += 1

    print(f"structurally clean: {clean}")
    print(f"missing: {len(missing)}" + (f"  -> {', '.join(missing)}" if missing else ""))
    print(f"with errors: {len(bad)}")
    for ref_id, problems in sorted(bad.items()):
        print(f"\n{ref_id}  ERRORS")
        for problem in problems:
            print(f"  - {problem}")
    if soft:
        total = sum(len(items) for items in soft.values())
        print(
            f"\nunlocated verbatim spans: {total} across {len(soft)} records. "
            "These are CANDIDATES, not verdicts -- the corpus markdown injects "
            "citation links and footnotes into running prose, which severs a "
            "faithfully copied span. Spot-check against the source before "
            "treating any as reconstructed."
        )
        for ref_id, items in sorted(soft.items()):
            print(f"\n{ref_id}  warnings")
            for item in items:
                print(f"  - {item}")
    return 1 if bad or missing else 0


if __name__ == "__main__":
    sys.exit(main())
