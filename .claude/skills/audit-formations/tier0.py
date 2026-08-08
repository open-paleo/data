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

from _paths import audit_dir, corpus_dir, resolve_markdown

CORPUS = corpus_dir()

BIBLIOGRAPHY_HEADING = re.compile(
    r"^#{0,6}\s*\**\s*(references|literature cited|bibliography|references cited)\b",
    re.IGNORECASE | re.MULTILINE,
)

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

    @param {str} text - the raw string
    @returns {str} unicode-normalized, lowercased, punctuation-collapsed text
    """
    folded = unicodedata.normalize("NFKD", text or "")
    folded = "".join(char for char in folded if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", folded.lower())


def load_paper(path):
    """Read a paper and mark where its reference list starts.

    @param {str} path - absolute path to the corpus markdown
    @returns {dict} raw text, folded text, folded body, and the bibliography cut
    """
    with open(path, encoding="utf-8", errors="replace") as handle:
        raw = handle.read()
    headings = list(BIBLIOGRAPHY_HEADING.finditer(raw))
    cut = headings[-1].start() if headings else len(raw)
    return {
        "raw": raw,
        "full": fold(raw),
        "body": fold(raw[:cut]),
        "cut": cut,
        "has_bibliography": bool(headings),
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

        for span in quoted_spans(pointer["notes"]):
            if fold(span) not in paper["full"]:
                findings["quote_absent"].append(
                    {"unit": unit, "ref_id": ref_id, "file": file_name, "quote": span}
                )
            elif only_in_bibliography(paper, span):
                findings["quote_bibliography_only"].append(
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
    }
    cache = {}
    for locus in manifest["loci"]:
        check_locus(locus, papers, cache, findings)

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
    print(f"\ntier0 -> {out}")


if __name__ == "__main__":
    main()
