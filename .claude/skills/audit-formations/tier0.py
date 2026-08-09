#!/usr/bin/env python3
"""Tier-0 deterministic checks for the formations.yaml citation audit (#2069).

Four checks, all cheap and all falsifiable without reading a paper end to end:

  A. WRONG PAPER UNDER A REF-ID -- the reference-store title against the title
     block printed at the head of the corpus markdown filed under that key.
  B. QUOTE ABSENT -- every double-quoted span in a pointer's `notes` is searched
     for in the markdown it is attributed to.
  C. QUOTE ONLY IN THE BIBLIOGRAPHY -- the span is present, but every occurrence
     sits in the cited paper's own reference list, so the paper is not asserting
     it; the note has quoted the title of some OTHER work. This is the check the
     pilot run found the systematic defect with: eight `stages` pointers quoted
     a "<Unit> Formation (<Stage>)" string straight out of a reference list.
  D. UNIT NAME ABSENT FROM THE BODY -- the unit the pointer justifies is never
     named outside the paper's reference list.

Every flag is a CANDIDATE to verify by hand, never a verdict. Scanned and
pre-1990 sources garble text (`2Æ3 km` for `2.3 km`, `(D` for `(=`,
`S^ınpetru` for `Sânpetru` all appeared in the pilot), and a paper can support a
claim perfectly well without naming the unit. Check D in particular fires
correctly on notes that SAY the paper names no such unit -- read the note before
calling anything a finding.

Usage:
    python3 tier0.py                  # reads scratch/audit-formations/manifest.json
    python3 tier0.py --manifest PATH
"""

import argparse
import json
import os
import re
import unicodedata

import source_quality

from _paths import audit_dir, corpus_dir, loci_dir, locus_slug, resolve_markdown

CORPUS = corpus_dir()

# Rank words stripped only from the END of a unit name, so "Red Beds of Hermiin
# Tsav" keeps its internal "Beds".
TRAILING_RANK = re.compile(
    r"\s+(fm|formation|group|subgroup|member|bed|beds|svita|series)\.?$", re.IGNORECASE
)

# How much of the markdown head counts as its title block.
TITLE_WINDOW = 6000

# Fraction of a title's distinctive words that must be present for the title to
# count as matched through OCR garbling, reflow and translated-title brackets.
TITLE_OVERLAP_THRESHOLD = 0.7


def fold(text):
    """Fold a string for tolerant comparison.

    Two extraction artifacts are removed BEFORE normalization. Markdown anchor
    targets sit inside sentences and would fold into stray `page 11 5` tokens;
    spacing diacritics are not combining marks and would collapse into spaces,
    splitting `Echapor~a` into two words that match nothing. Both make an
    honest quotation unmatchable.

    @param {str} text - the raw string
    @returns {str} unicode-normalized, lowercased, punctuation-collapsed text
    """
    repaired = source_quality.strip_anchor_targets(text or "")
    repaired = source_quality.recompose_spacing_diacritics(repaired)
    folded = unicodedata.normalize("NFKD", repaired)
    folded = "".join(char for char in folded if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", folded.lower())


def load_paper(path):
    """Read a paper, mark where its reference list starts, and record how well
    that boundary could be established.

    The boundary is not a detail. Checks C and D both ask "is this only in the
    reference list?", so a paper whose boundary is unknown cannot answer them --
    and, before the source-quality preflight existed, silently answered "no".

    @param {str} path - absolute path to the corpus markdown
    @returns {dict} raw text, folded text, folded body, the cut, and the quality
    """
    with open(path, encoding="utf-8", errors="replace") as handle:
        raw = handle.read()
    quality = source_quality.assess(raw)
    cut = quality["cut"]
    return {
        "raw": raw,
        "full": fold(raw),
        "body": fold(raw[:cut]),
        "cut": cut,
        "has_bibliography": quality["bibliography"] != "none",
        "quality": quality,
    }


def title_overlaps(store_title, head):
    """Decide whether a store title is present in a reflowed or garbled head.

    Containment alone fails on translated titles in brackets, running heads and
    OCR damage, so fall back to distinctive-word overlap.

    @param {str} store_title - the folded reference-store title
    @param {str} head - the folded opening of the corpus markdown
    @returns {bool} True when most of the title's distinctive words are present
    """
    words = [word for word in store_title.split() if len(word) > 3]
    if not words:
        return True
    hits = sum(1 for word in words if word in head)
    return hits / len(words) >= TITLE_OVERLAP_THRESHOLD


def quoted_spans(notes):
    """Extract the double-quoted spans a note attributes to its paper.

    An internal ellipsis marks an elision the note made, so each side of it is
    searched for separately rather than as one string that never appears.

    @param {str} notes - the pointer's notes prose
    @returns {list[str]} the quoted fragments
    """
    spans = []
    for match in re.findall(r'"([^"]{8,})"', notes or ""):
        for fragment in re.split(r"\s*(?:\.\.\.|…)\s*", match):
            fragment = re.sub(r"\s+", " ", fragment).strip()
            if len(fragment) >= 8:
                spans.append(fragment)
    return spans


def unit_names(unit, fields):
    """Every string a paper might use for this unit.

    @param {str} unit - the registry key, possibly country-disambiguated
    @param {dict} fields - the locus's structural fields
    @returns {list[str]} candidate names, longest first
    """
    names = [re.sub(r"\s*\([^)]*\)\s*", " ", unit).strip()]
    names.extend(fields.get("variants") or [])
    cleaned = set()
    for name in names:
        stripped = TRAILING_RANK.sub("", name).strip()
        if stripped:
            cleaned.add(stripped)
    return sorted(cleaned, key=len, reverse=True)


def occurrence_offsets(paper, span):
    """Locate every line containing a span, by raw-text offset.

    @param {dict} paper - a load_paper result
    @param {str} span - the span to locate
    @returns {list[int]} raw-text offsets of each containing line
    """
    needle = fold(span)
    offsets = []
    position = 0
    for line in paper["raw"].split("\n"):
        if needle in fold(line):
            offsets.append(position)
        position += len(line) + 1
    return offsets


def only_in_bibliography(paper, span):
    """Test whether a span occurs only inside the paper's own reference list,
    which means the paper is quoting another work's title rather than asserting.

    @param {dict} paper - a load_paper result
    @param {str} span - the span to locate
    @returns {bool} True when every occurrence sits past the reference heading
    """
    if not paper["has_bibliography"]:
        return False
    offsets = occurrence_offsets(paper, span)
    if not offsets:
        return False
    return all(offset >= paper["cut"] for offset in offsets)


def check_locus(locus, papers, cache, findings):
    """Run all four checks over one registry entry's pointers.

    @param {dict} locus - a manifest locus
    @param {dict} papers - manifest papers keyed by ref-id
    @param {dict} cache - load_paper results keyed by path
    @param {dict} findings - accumulator, mutated in place
    @returns {None}
    """
    unit = locus["unit"]
    names = unit_names(unit, locus["fields"])
    for pointer in locus["pointers"]:
        ref_id = pointer["id"]
        record = papers.get(ref_id, {})
        if record.get("classification") == "reference-work":
            findings["reference_work"].append({"unit": unit, "ref_id": ref_id})
            continue
        path = resolve_markdown(ref_id)
        if not path:
            findings["no_markdown"].append({"unit": unit, "ref_id": ref_id})
            continue
        if path not in cache:
            cache[path] = load_paper(path)
        paper = cache[path]
        file_name = os.path.basename(path)

        store_title = fold(record.get("store_title"))
        head = paper["full"][:TITLE_WINDOW]
        if store_title and store_title not in head and not title_overlaps(store_title, head):
            findings["title"].append(
                {
                    "unit": unit,
                    "ref_id": ref_id,
                    "file": file_name,
                    "store_title": record.get("store_title"),
                }
            )

        quality = paper["quality"]
        if quality["bibliography"] == "unheaded-list":
            findings["checks_degraded"].append(
                {
                    "unit": unit,
                    "ref_id": ref_id,
                    "file": file_name,
                    "kind": "reference-list-heading-missing",
                    "affects": ["quote_bibliography_only", "unit_absent"],
                }
            )

        for span in quoted_spans(pointer["notes"]):
            if fold(span) in paper["full"]:
                if only_in_bibliography(paper, span):
                    findings["quote_bibliography_only"].append(
                        {"unit": unit, "ref_id": ref_id, "file": file_name, "quote": span}
                    )
            elif source_quality.matches_through_line_numbers(paper["full"], fold(span)):
                findings["quote_matched_through_line_numbers"].append(
                    {"unit": unit, "ref_id": ref_id, "file": file_name, "quote": span}
                )
            else:
                findings["quote_absent"].append(
                    {"unit": unit, "ref_id": ref_id, "file": file_name, "quote": span}
                )

        if names and not any(fold(name) in paper["body"] for name in names):
            findings["unit_absent"].append(
                {
                    "unit": unit,
                    "ref_id": ref_id,
                    "file": file_name,
                    "names": names,
                    "in_bibliography_only": any(
                        fold(name) in paper["full"] for name in names
                    ),
                }
            )


def survey_sources(papers, cache, rescued_quotes):
    """Report every cited paper whose extraction degrades a Tier-0 check.

    These are defects in the CORPUS, not in the registry, and no edit to
    `formations.yaml` can answer them. Reporting them up front is the point:
    they are found proactively and routed to the papers repository, instead of
    surfacing later as a finding against an entry that is actually correct.

    Two sources feed this. A structural scan of each paper finds what can be
    seen without reference to any claim, and the quotes that matched only once
    line numbers were allowed between their words supply the rest -- a gutter
    collapsed into prose is invisible structurally but unmistakable the moment
    it breaks a quotation.

    @param {dict} papers - manifest papers keyed by ref-id
    @param {dict} cache - load_paper results keyed by path
    @param {list} rescued_quotes - quotes that matched only through line numbers
    @returns {list} one record per degraded paper
    """
    by_symptom = {}
    for flag in rescued_quotes:
        by_symptom.setdefault(flag["ref_id"], []).append(flag["unit"])

    degraded = []
    for ref_id in sorted(papers):
        record = papers[ref_id]
        if record.get("classification") == "reference-work":
            continue
        path = resolve_markdown(ref_id)
        if not path:
            continue
        if path not in cache:
            cache[path] = load_paper(path)
        degradations = list(cache[path]["quality"]["degradations"])
        if ref_id in by_symptom:
            units = sorted(set(by_symptom[ref_id]))
            degradations.append(
                {
                    "kind": "interleaved-line-numbers",
                    "affects": ["quote_absent"],
                    "direction": "false-positive",
                    "detail": (
                        f"{len(by_symptom[ref_id])} quoted span(s) match only "
                        "once line numbers are allowed between their words "
                        f"({', '.join(units)}); the gutter is still in the text"
                    ),
                }
            )
        if degradations:
            degraded.append(
                {
                    "ref_id": ref_id,
                    "file": os.path.relpath(path, CORPUS),
                    "bibliography": cache[path]["quality"]["bibliography"],
                    "degradations": degradations,
                }
            )
    return degraded


def annotate_loci(findings):
    """Fold each unit's Tier-0 flags into its locus file.

    The Tier-1 agent gets the whole `tier0.json` path anyway, but handing it the
    slice for the entry in front of it is what makes the flags get read rather
    than skimmed. Written here rather than in `assemble.py` only because Tier-0
    has to have run first.

    @param {dict} findings - the Tier-0 accumulator
    @returns {int} the number of locus files annotated
    """
    buckets = (
        "title",
        "quote_absent",
        "quote_bibliography_only",
        "unit_absent",
        "no_markdown",
        "reference_work",
        "quote_matched_through_line_numbers",
        "checks_degraded",
    )
    by_unit = {}
    for bucket in buckets:
        for flag in findings.get(bucket) or []:
            by_unit.setdefault(flag["unit"], {}).setdefault(bucket, []).append(flag)

    annotated = 0
    out_dir = loci_dir()
    if not os.path.isdir(out_dir):
        return 0
    for name in sorted(os.listdir(out_dir)):
        if not name.endswith(".json"):
            continue
        path = os.path.join(out_dir, name)
        with open(path) as handle:
            locus = json.load(handle)
        locus["tier0"] = by_unit.get(locus["unit"], {})
        with open(path, "w") as handle:
            json.dump(locus, handle, indent=2, ensure_ascii=False)
        annotated += 1
    return annotated


def main():
    """Run Tier-0 over the manifest and write tier0.json."""
    parser = argparse.ArgumentParser(description="Tier-0 checks for the formations audit")
    parser.add_argument("--manifest", default=os.path.join(audit_dir(), "manifest.json"))
    args = parser.parse_args()

    with open(args.manifest) as handle:
        manifest = json.load(handle)
    papers = {paper["ref_id"]: paper for paper in manifest["papers"]}

    findings = {
        "title": [],
        "quote_absent": [],
        "quote_bibliography_only": [],
        "unit_absent": [],
        "no_markdown": [],
        "reference_work": [],
        "quote_matched_through_line_numbers": [],
        "checks_degraded": [],
    }
    cache = {}
    for locus in manifest["loci"]:
        check_locus(locus, papers, cache, findings)

    findings["source_quality"] = survey_sources(
        papers, cache, findings["quote_matched_through_line_numbers"]
    )

    findings["counts"] = {
        key: len(value) for key, value in findings.items() if isinstance(value, list)
    }
    out = os.path.join(os.path.dirname(os.path.abspath(args.manifest)), "tier0.json")
    with open(out, "w") as handle:
        json.dump(findings, handle, indent=2, ensure_ascii=False)

    print(json.dumps(findings["counts"], indent=2))
    labels = [
        ("title", "TITLE"),
        ("no_markdown", "NOMD"),
        ("quote_bibliography_only", "BIBQ"),
        ("quote_absent", "QMISS"),
        ("unit_absent", "UNIT"),
    ]
    for key, label in labels:
        for flag in findings[key]:
            detail = flag.get("quote") or ", ".join(flag.get("names", []))
            if flag.get("in_bibliography_only"):
                detail += "  [bibliography only]"
            print(f"{label:6} {flag['unit'][:28]:30} {flag['ref_id']:22} {detail[:74]}")

    if findings["source_quality"]:
        print("\nSOURCE DEFECTS -- corpus repository, not the registry:")
        for record in findings["source_quality"]:
            for degradation in record["degradations"]:
                print(
                    f"  {record['ref_id']:22} {degradation['kind']:32} "
                    f"{degradation['direction']}"
                )
                print(f"      {degradation['detail']}")
        rescued = len(findings["quote_matched_through_line_numbers"])
        degraded = len(findings["checks_degraded"])
        print(
            f"  -> {rescued} quote(s) matched only through line numbers; "
            f"{degraded} pointer(s) checked against an inferred body boundary"
        )
    print(f"\ntier0 -> {out}")
    print(f"loci annotated with their Tier-0 slice: {annotate_loci(findings)}")


if __name__ == "__main__":
    main()
