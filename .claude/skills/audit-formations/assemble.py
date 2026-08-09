#!/usr/bin/env python3
"""Phase A of the formations.yaml citation audit (#2069): deterministically
assemble the working set.

Every entry in `formations.yaml` that carries `references:` becomes a locus.
Each locus records the structural fields its pointers are supposed to justify
(rank, parent, contains, stages, variants, rank_contested, kind) so the Tier-1
agent can check the field, not just the prose. Each pointer's ref-id resolves to
a corpus markdown file and is classified.

No agents, no network. Output is a JSON manifest the condensation phase consumes.

Usage:
    python3 assemble.py                    # all entries -> scratch/audit-formations/manifest.json
    python3 assemble.py --unit Shaximiao   # one entry (repeatable), for a pilot
    python3 assemble.py --out PATH
"""

import argparse
import hashlib
import json
import os
import sys

import yaml

import source_quality

from _paths import (
    audit_dir,
    corpus_dir,
    data_dir,
    loci_dir,
    locus_slug,
    resolve_markdown,
    strat_condensed_dir,
)

DATA = data_dir()
CORPUS = corpus_dir()

# The structural fields a pointer can be sourcing. `references` is excluded --
# it is the pointer list itself, not a claim.
STRUCTURAL_FIELDS = (
    "rank",
    "kind",
    "parent",
    "contains",
    "variants",
    "rank_contested",
    "stages",
)

# Reference works: aggregate compendia, never a primary source for a unit's
# rank, age or membership. They may corroborate a value but never establish it,
# so condensation skips them. Matched as a prefix against the ref-id.
REFERENCE_WORK_PREFIXES = (
    "jones2026",
    "molina-pérez",
    "molina-perez",
    "paul20",
    "holtz20",
    "glut",
    "olshevsky",
    "weishampel2004",
)


def classify(ref_id):
    """Classify a ref-id by prefix; corpus presence is checked separately.

    @param {str} ref_id - the citation key
    @returns {str} "reference-work" or "primary"
    """
    lowered = ref_id.lower()
    for prefix in REFERENCE_WORK_PREFIXES:
        if lowered.startswith(prefix):
            return "reference-work"
    return "primary"


def sha256(path):
    """Hash a file's bytes, so a re-run knows whether to re-condense.

    @param {str} path - absolute path to the file
    @returns {str} the hex digest
    """
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def load_reference_store():
    """Load every references/{letter}/{key}.yml entry.

    @returns {dict} ref id -> the store record
    """
    store = {}
    root = os.path.join(DATA, "references")
    for letter in sorted(os.listdir(root)):
        letter_dir = os.path.join(root, letter)
        if not os.path.isdir(letter_dir):
            continue
        for name in sorted(os.listdir(letter_dir)):
            if name.endswith(".yml"):
                with open(os.path.join(letter_dir, name)) as handle:
                    store[name[:-4]] = yaml.safe_load(handle)
    return store


def collect_loci(formations, wanted_units):
    """Yield one locus per formations.yaml entry that carries references.

    @param {dict} formations - the parsed registry
    @param {list[str]} wanted_units - restrict to these keys, or empty for all
    @returns {generator} locus dicts
    """
    for unit, entry in formations.items():
        if wanted_units and unit not in wanted_units:
            continue
        pointers = entry.get("references") or []
        if not pointers:
            continue
        yield {
            "unit": unit,
            "fields": {
                field: entry[field] for field in STRUCTURAL_FIELDS if field in entry
            },
            "pointers": [
                {"id": pointer["id"], "notes": (pointer.get("notes") or "").strip()}
                for pointer in pointers
                if isinstance(pointer, dict) and pointer.get("id")
            ],
        }


def write_loci(loci):
    """Write one Tier-1 input file per locus, replacing whatever was there.

    The directory is cleared first, deliberately. A locus file left behind from
    an earlier, wider run is worse than a missing one: it looks current, and an
    agent handed it audits registry text that no longer exists. `tier0.py` adds
    its per-unit slice to these afterwards, so running assemble then tier0
    leaves the set consistent with the registry as it stands right now.

    @param {list[dict]} loci - the manifest loci
    @returns {str} the directory written to
    """
    out_dir = loci_dir()
    if os.path.isdir(out_dir):
        for name in os.listdir(out_dir):
            if name.endswith(".json"):
                os.remove(os.path.join(out_dir, name))
    os.makedirs(out_dir, exist_ok=True)
    for locus in loci:
        path = os.path.join(out_dir, f"{locus_slug(locus['unit'])}.json")
        with open(path, "w") as handle:
            json.dump(locus, handle, indent=2, ensure_ascii=False)
    return out_dir


def main():
    """Build the manifest and print the coverage summary."""
    parser = argparse.ArgumentParser(
        description="Assemble the formations.yaml citation audit working set"
    )
    parser.add_argument(
        "--unit",
        action="append",
        default=[],
        metavar="UNIT",
        help="restrict to this registry entry (repeatable); for a pilot run",
    )
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    with open(os.path.join(DATA, "formations.yaml")) as handle:
        formations = yaml.safe_load(handle)
    for unit in args.unit:
        if unit not in formations:
            sys.exit(f"unit {unit!r} not found in formations.yaml")

    store = load_reference_store()
    loci = list(collect_loci(formations, args.unit))
    condensed = strat_condensed_dir()

    papers = {}
    for locus in loci:
        for pointer in locus["pointers"]:
            ref_id = pointer["id"]
            paper = papers.setdefault(
                ref_id,
                {
                    "ref_id": ref_id,
                    "classification": classify(ref_id),
                    "in_store": ref_id in store,
                    "store_title": (store.get(ref_id) or {}).get("title"),
                    "store_doi": (store.get(ref_id) or {}).get("doi"),
                    "in_corpus": False,
                    "source_file": None,
                    "source_sha256": None,
                    "filed_under": None,
                    "condensed": False,
                    "cited_by": [],
                },
            )
            paper["cited_by"].append(locus["unit"])
            path = resolve_markdown(ref_id)
            if path:
                filed = os.path.basename(path)[:-3]
                paper["in_corpus"] = True
                paper["source_file"] = os.path.relpath(path, CORPUS)
                paper["source_sha256"] = sha256(path)
                paper["filed_under"] = filed if filed != ref_id else None
                if paper["classification"] != "reference-work":
                    with open(path, encoding="utf-8", errors="replace") as handle:
                        quality = source_quality.assess(handle.read())
                    paper["bibliography"] = quality["bibliography"]
                    paper["degradations"] = quality["degradations"]
            paper["condensed"] = os.path.exists(
                os.path.join(condensed, f"{ref_id}.json")
            )

    manifest = {
        "registry": "formations.yaml",
        "units_restricted_to": args.unit,
        "entries_total": len(formations),
        "loci": loci,
        "papers": sorted(papers.values(), key=lambda paper: paper["ref_id"]),
    }

    to_condense = [
        paper
        for paper in manifest["papers"]
        if paper["in_corpus"]
        and paper["classification"] != "reference-work"
        and not paper["condensed"]
    ]
    reference_works = [
        paper for paper in manifest["papers"] if paper["classification"] == "reference-work"
    ]
    not_in_corpus = [
        paper
        for paper in manifest["papers"]
        if not paper["in_corpus"] and paper["classification"] != "reference-work"
    ]
    misfiled = [paper for paper in manifest["papers"] if paper["filed_under"]]
    pointer_count = sum(len(locus["pointers"]) for locus in loci)
    with_notes = sum(
        1 for locus in loci for pointer in locus["pointers"] if pointer["notes"]
    )

    print(f"registry entries: {len(formations)}")
    print(f"loci (entries carrying references): {len(loci)}")
    print(f"pointers: {pointer_count} ({with_notes} carrying a notes claim)")
    print(f"distinct papers cited: {len(manifest['papers'])}")
    print(f"  to condense: {len(to_condense)}")
    print(
        f"  reference-works (skip extraction): {len(reference_works)}"
        + (f"  -> {', '.join(paper['ref_id'] for paper in reference_works)}" if reference_works else "")
    )
    print(
        f"  NOT in corpus (coverage gap): {len(not_in_corpus)}"
        + (f"  -> {', '.join(paper['ref_id'] for paper in not_in_corpus)}" if not_in_corpus else "")
    )
    print(
        f"  filed in corpus under another key: {len(misfiled)}"
        + (
            f"  -> {', '.join(paper['ref_id'] + '=' + paper['filed_under'] for paper in misfiled)}"
            if misfiled
            else ""
        )
    )

    degraded = [paper for paper in manifest["papers"] if paper.get("degradations")]
    print(f"  extraction degraded (fix in the CORPUS, not here): {len(degraded)}")
    for paper in degraded:
        for degradation in paper["degradations"]:
            print(
                f"      {paper['ref_id']:22} {degradation['kind']:32} "
                f"-> {degradation['direction']}s in {', '.join(degradation['affects'])}"
            )

    out = args.out or os.path.join(audit_dir(), "manifest.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)
    print(f"\nmanifest -> {out}")
    print(f"loci ({len(loci)}) -> {write_loci(loci)}")


if __name__ == "__main__":
    main()
