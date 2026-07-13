#!/usr/bin/env python3
"""Phase A of the dispute/description citation audit (#1968): deterministically
assemble the working paper set for one clade slice.

For every genus/clade under the slice root that carries a `dispute:` block,
collect the union of its `references[].id`, resolve each to a corpus markdown
file, and classify it (primary | monograph | reference-work | not-in-corpus).

No agents, no network. Output is a JSON manifest the condensation phase consumes.

Usage:
    python3 assemble.py <SliceRoot>          # writes reports/audit/<slice>/manifest.json
    python3 assemble.py <SliceRoot> --out X   # or an explicit path
"""

import argparse
import glob
import hashlib
import json
import os
import sys

import yaml

from _paths import data_dir, corpus_dir, audit_dir

DATA = data_dir()
CORPUS = corpus_dir()
MARKDOWN = os.path.join(CORPUS, "markdown")

# Reference works: aggregate compendia, NOT primary literature. Condensation
# skips these (they are smell-tests, not phylogenetic ground truth). Matched as
# a prefix against the ref-id.
REFERENCE_WORK_PREFIXES = (
    "jones2026",
    "molina-pérez",
    "molina-perez",
    "paul20",       # Princeton Field Guide editions
    "holtz20",      # Dinosaurs (Holtz) encyclopedia
    "glut",         # Dinosaurs: The Encyclopedia
    "olshevsky",    # Mesozoic Meanderings — self-published aggregate checklist
    "allain2003",   # Dinosaurs of France — broad synthesis review
)

# Long monographs / revisions worth a targeted rather than skim read. Extend as
# runs surface them; unlisted in-corpus papers default to "primary".
MONOGRAPH_IDS = set()


def _find(node, target):
    """Return the subtree dict rooted at `target`, or None if absent."""
    if isinstance(node, dict):
        for key, value in node.items():
            if key == target:
                return value
            found = _find(value, target)
            if found is not None:
                return found
    return None


def _names(node):
    """Return the set of all clade node names within `node`."""
    out = set()
    if isinstance(node, dict):
        for key, value in node.items():
            out.add(key)
            out |= _names(value)
    return out


def subtree_names(tree, root):
    """Return {root} plus every clade name below it, or None if root is absent."""
    sub = _find(tree, root)
    if sub is None:
        return None
    return _names(sub) | {root}


def load_tree_slice(slice_root, excludes=()):
    """Return the clade names at/below slice_root, minus any excluded subtrees.

    Each entry in `excludes` is a clade node whose entire subtree (the node and
    all descendants) is removed — this lets a large slice be partitioned into
    disjoint sub-slices without overlap (e.g. Ornithopoda --exclude Hadrosauroidea)."""
    tree = yaml.safe_load(open(os.path.join(DATA, "tree.yml")))
    names = subtree_names(tree, slice_root)
    if names is None:
        sys.exit(f"slice root {slice_root!r} not found in tree.yml")
    for excluded in excludes:
        excluded_names = subtree_names(tree, excluded)
        if excluded_names is None:
            sys.exit(f"--exclude clade {excluded!r} not found in tree.yml")
        names -= excluded_names
    return names


def classify(ref_id):
    """Classify a ref-id by prefix; corpus presence is checked separately."""
    lowered = ref_id.lower()
    for prefix in REFERENCE_WORK_PREFIXES:
        if lowered.startswith(prefix):
            return "reference-work"
    if ref_id in MONOGRAPH_IDS:
        return "monograph"
    return "primary"


def markdown_path(ref_id):
    """Return the corpus markdown path for a ref-id, or None if absent."""
    path = os.path.join(MARKDOWN, f"{ref_id}.md")
    return path if os.path.exists(path) else None


def sha256(path):
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def collect_loci(clade_names):
    """Yield (kind, name, file, references) for every genus/clade in the slice
    that carries a dispute block."""
    for path in sorted(glob.glob(os.path.join(DATA, "genera", "*", "*.yml"))):
        record = yaml.safe_load(open(path))
        if not isinstance(record, dict) or "genus" not in record:
            continue
        if record.get("parent") in clade_names and "dispute" in record:
            refs = [r.get("id") for r in (record.get("references") or []) if isinstance(r, dict) and r.get("id")]
            yield ("genus", record["genus"], os.path.relpath(path, DATA), refs)
    for name in sorted(clade_names):
        path = os.path.join(DATA, "clades", f"{name}.yml")
        if not os.path.exists(path):
            continue
        record = yaml.safe_load(open(path))
        if isinstance(record, dict) and "dispute" in record:
            refs = [r.get("id") for r in (record.get("references") or []) if isinstance(r, dict) and r.get("id")]
            yield ("clade", name, os.path.relpath(path, DATA), refs)


def main():
    parser = argparse.ArgumentParser(description="Assemble the audit working paper set for a slice")
    parser.add_argument("slice_root")
    parser.add_argument("--exclude", action="append", default=[], metavar="CLADE",
                        help="exclude this clade's entire subtree (repeatable); "
                             "use to carve disjoint sub-slices of a large slice")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    clade_names = load_tree_slice(args.slice_root, args.exclude)
    loci = list(collect_loci(clade_names))

    papers = {}
    for kind, name, file, refs in loci:
        for ref_id in refs:
            entry = papers.setdefault(ref_id, {
                "ref_id": ref_id,
                "classification": classify(ref_id),
                "in_corpus": False,
                "source_file": None,
                "source_sha256": None,
                "cited_by": [],
            })
            entry["cited_by"].append(name)
            path = markdown_path(ref_id)
            if path:
                entry["in_corpus"] = True
                entry["source_file"] = os.path.relpath(path, CORPUS)
                entry["source_sha256"] = sha256(path)

    manifest = {
        "slice_root": args.slice_root,
        "excluded": list(args.exclude),
        "loci": [{"kind": k, "name": n, "file": f, "refs": r} for k, n, f, r in loci],
        "papers": sorted(papers.values(), key=lambda p: p["ref_id"]),
    }

    to_condense = [p for p in manifest["papers"] if p["in_corpus"] and p["classification"] != "reference-work"]
    ref_works = [p for p in manifest["papers"] if p["classification"] == "reference-work"]
    not_in_corpus = [p for p in manifest["papers"] if not p["in_corpus"] and p["classification"] != "reference-work"]

    print(f"slice: {args.slice_root}" + (f" (excluding {', '.join(args.exclude)})" if args.exclude else ""))
    print(f"loci with dispute blocks: {len(loci)} ({sum(1 for l in loci if l[0]=='genus')} genera, {sum(1 for l in loci if l[0]=='clade')} clades)")
    print(f"distinct papers cited: {len(manifest['papers'])}")
    print(f"  to condense (in-corpus primary/monograph): {len(to_condense)}")
    print(f"  reference-works (skip extraction): {len(ref_works)}  -> {', '.join(p['ref_id'] for p in ref_works)}")
    print(f"  NOT in corpus (coverage gap): {len(not_in_corpus)}  -> {', '.join(p['ref_id'] for p in not_in_corpus)}")

    out = args.out or os.path.join(audit_dir(), args.slice_root, "manifest.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(manifest, open(out, "w"), indent=2, ensure_ascii=False)
    print(f"\nmanifest -> {out}")
    print(f"papers to condense -> {out.replace('manifest.json', '')} (run the condensation agents next)")


if __name__ == "__main__":
    main()
