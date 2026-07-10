#!/usr/bin/env python3
"""Tier-0 of the citation audit (#1968): deterministic bibliographic checks.

For every in-corpus paper cited by the slice, compare the condensation's
bibliography (read off the actual markdown) against the dataset reference-store
entry (references/{letter}/{key}.yml). A title or DOI mismatch means the file
sitting under that ref-id is a DIFFERENT paper than the reference claims
(error class 1). A year-only mismatch with matching title is NEVER a finding:
ref-id key names and citation years routinely differ from the printed year
(online-first vs print), which is expected. Year only corroborates a title
divergence to separate a genuinely different publication from a subtitle variant.

Tier-0 is ADDITIVE — it does not gate the Tier-1 semantic audit. No agents.

Usage:
    python3 tier0.py <manifest.json> [--out tier0.json]
"""

import argparse
import json
import os
import re

import yaml

from _paths import data_dir, condensed_dir

DATA = data_dir()
CONDENSED = condensed_dir()


def normalize_title(title):
    """Lowercase, strip punctuation, collapse whitespace. Brackets around a
    translated title (the reference-store convention, e.g. '[A new ...]') are
    dropped as characters by the punctuation pass — their words are KEPT, so a
    translated-title reference still matches its English-titled markdown."""
    title = (title or "").lower()
    title = re.sub(r"[^a-z0-9 ]+", " ", title)
    return re.sub(r"\s+", " ", title).strip()


def title_containment(left, right):
    """Token containment: |intersection| / |smaller token set| (0..1). Robust to
    one side carrying a longer subtitle (same paper, fuller title) — unlike
    Jaccard, which penalizes the length gap and false-flags it as a different
    paper."""
    left_tokens = set(normalize_title(left).split())
    right_tokens = set(normalize_title(right).split())
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / min(len(left_tokens), len(right_tokens))


def load_ref_store(ref_id):
    """Load references/{letter}/{ref_id}.yml, or None if absent."""
    letter = ref_id[0].lower()
    path = os.path.join(DATA, "references", letter, f"{ref_id}.yml")
    if os.path.exists(path):
        return yaml.safe_load(open(path))
    return None


def main():
    parser = argparse.ArgumentParser(description="Tier-0 deterministic bibliographic checks")
    parser.add_argument("manifest")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    manifest = json.load(open(args.manifest))
    findings = []

    for paper in manifest["papers"]:
        ref_id = paper["ref_id"]
        if paper["classification"] == "reference-work":
            continue
        if not paper["in_corpus"]:
            findings.append({
                "ref_id": ref_id, "problem_class": 4, "severity": "medium",
                "cited_by": paper["cited_by"],
                "detail": "cited reference has no corpus markdown — claims attributed to it are unverifiable against a primary source.",
            })
            continue

        condensed_path = os.path.join(CONDENSED, f"{ref_id}.json")
        if not os.path.exists(condensed_path):
            findings.append({
                "ref_id": ref_id, "problem_class": 0, "severity": "low",
                "cited_by": paper["cited_by"], "detail": "no condensation produced (skipped or failed).",
            })
            continue

        condensation = json.load(open(condensed_path))
        bibliography = condensation.get("bibliography", {})
        store = load_ref_store(ref_id)
        if store is None:
            findings.append({
                "ref_id": ref_id, "problem_class": 4, "severity": "low",
                "cited_by": paper["cited_by"], "detail": "no reference-store entry to compare against.",
            })
            continue

        containment = title_containment(bibliography.get("title"), store.get("title"))
        paper_doi = (bibliography.get("doi") or "").strip().lower()
        store_doi = (str(store.get("doi") or "")).strip().lower()
        doi_conflict = bool(paper_doi and store_doi and paper_doi != store_doi)
        paper_year = bibliography.get("year")
        store_year = store.get("year")
        year_gap = abs(int(paper_year) - int(store_year)) if (paper_year and store_year) else 0

        # Wrong-paper is decided by TITLE and DOI. A year mismatch is NEVER a
        # finding on its own: ref-id key names and citation years routinely differ
        # from the printed year (online-first vs print), which is expected, not an
        # error. Year only CORROBORATES a title divergence to separate a genuinely
        # different publication (e.g. a 1987 monograph vs a 2000 book chapter filed
        # under the same key) from a mere subtitle/translation variance.
        if doi_conflict or containment < 0.5:
            findings.append({
                "ref_id": ref_id, "problem_class": 1, "severity": "high",
                "cited_by": paper["cited_by"],
                "detail": f"corpus markdown appears to be a DIFFERENT paper than the reference claims. "
                          f"markdown title: {bibliography.get('title')!r} ({paper_year}); "
                          f"reference-store title: {store.get('title')!r} ({store_year}); "
                          f"title-containment={containment:.2f}; doi_conflict={doi_conflict}.",
            })
        elif containment < 0.75 and year_gap >= 5:
            findings.append({
                "ref_id": ref_id, "problem_class": 1, "severity": "high",
                "cited_by": paper["cited_by"],
                "detail": f"likely a DIFFERENT publication filed under this ref-id: title only partially "
                          f"overlaps (containment={containment:.2f}) AND year is off by {year_gap} "
                          f"(markdown {paper_year} vs reference-store {store_year}). Not an online/print split.",
            })
        # else: title matches well enough — any year difference is treated as the
        # expected online/print / key-naming artifact and is NOT reported.

    findings.sort(key=lambda f: ({"high": 0, "medium": 1, "low": 2}[f["severity"]], f["ref_id"]))
    print(f"Tier-0 checked {sum(1 for p in manifest['papers'] if p['classification']!='reference-work')} non-reference-work papers")
    print(f"findings: {len(findings)}")
    for finding in findings:
        print(f"  [{finding['severity'].upper():6s}] class{finding['problem_class']} {finding['ref_id']}: {finding['detail'][:140]}")

    out = args.out or os.path.join(os.path.dirname(args.manifest), "tier0.json")
    json.dump(findings, open(out, "w"), indent=2, ensure_ascii=False)
    print(f"\ntier0 -> {out}")


if __name__ == "__main__":
    main()
