#!/usr/bin/env python3
"""Deterministic structural audit of the clade files (#1968, clades/ pass).

Complements the dispute-prose audit: where tier0/tier1 check what the CITED
PAPERS say, this checks the clade files' own bibliographic skeleton — the fields
every clade carries whether or not it has a dispute block.

Per clades/*.yml:
  A  erected_in resolves to a references/{letter}/{key}.yml entry
  B  erected_in is listed in the file's own `references:` block
  C  described_in resolves, and is listed in `references:` (when present)
  D  every `references[].id` resolves in the reference store
  E  type_genus resolves to a real genera/{Letter}/{Genus}.yml
  F  type_genus actually sits inside this clade's own subtree in tree.yml
  G  described_in does not predate erected_in
  H  a family-group name does not predate its own type genus
  I  the family-group name is built on the type genus's genitive stem

A–F are hard checks: a failure is a defect in the data. G and H are chronology
checks — a hit is either a wrong citation or a wrong reference-store year, so it
needs a look but names the defect only after the reference is read. I is a
heuristic: it models the third-declension genitive stems (Baryonyx →
Baryonych-, Caudipteryx → Caudipteryg-) so that correctly formed names stay
quiet, but an unusual-but-valid formation can still trip it.

What this script deliberately does NOT check is whether the erected_in paper
really is where the name was coined. That is not decidable from bibliographic
metadata — a title heuristic fires on ~83% of correctly cited clades, because
family-group names are usually erected in papers whose titles never name them.
Answering it requires reading the paper, so it belongs to the condensation-
backed tier, not here.

Usage:
    python3 clade-fields.py [--out clade-fields.json]
"""

import argparse
import glob
import json
import os
import re

import yaml

from _paths import audit_dir, data_dir

DATA = data_dir()

# Family-group endings whose names are formed on a type genus's stem.
familyGroupEndings = ("idae", "inae", "ini", "oidea")


def loadYaml(path):
    """Load a YAML file, returning {} when it is missing or empty.

    @param path - absolute path to the YAML file
    @returns the parsed mapping, or an empty dict
    """
    if not os.path.exists(path):
        return {}
    return yaml.safe_load(open(path)) or {}


def refStorePath(refId):
    """Return the reference-store path for a ref-id.

    @param refId - the citation key, e.g. "brown1908a"
    @returns absolute path to references/{letter}/{refId}.yml
    """
    return os.path.join(DATA, "references", refId[0].lower(), f"{refId}.yml")


def refYear(refId):
    """Look up a reference's publication year in the reference store.

    @param refId - the citation key, or None
    @returns the year as an int, or None when unresolvable
    """
    if not refId:
        return None
    year = loadYaml(refStorePath(refId)).get("year")
    try:
        return int(year)
    except (TypeError, ValueError):
        return None


def earliestGenusNameYear(genusRecord):
    """Earliest year at which a genus name could have existed.

    A genus file usually carries no top-level `erected_in`; the authority sits
    on the type species, with the genus-level field as an override (#1886). But
    the type species is NOT a safe proxy for the genus name's date: an ICZN
    ruling can designate a type species named long after the genus itself
    (Plateosaurus, Meyer 1837, has the ICZN-designated type species
    P. trossingensis Fraas 1913; likewise Stegosaurus, Edmontosaurus,
    Sphaerotholus). Taking the EARLIEST year across the override and every
    species gives a lower bound that holds in those cases, which is exactly what
    a "cannot predate" check needs.

    @param genusRecord - the parsed genus YAML mapping
    @returns the earliest year as an int, or None when nothing resolves
    """
    candidates = [refYear(genusRecord.get("erected_in"))]
    for species in (genusRecord.get("species") or []):
        if isinstance(species, dict):
            candidates.append(refYear(species.get("erected_in")))
    years = [year for year in candidates if year]
    return min(years) if years else None


def genusPath(genus):
    """Return the genus-file path for a genus name.

    @param genus - the genus name, e.g. "Ankylosaurus"
    @returns absolute path to genera/{Letter}/{genus}.yml
    """
    return os.path.join(DATA, "genera", genus[0].upper(), f"{genus}.yml")


def findNode(node, target):
    """Depth-first search for a named node in the clade tree.

    @param node - the current tree mapping
    @param target - the clade name to find
    @returns the target's subtree mapping, or None when absent
    """
    if isinstance(node, dict):
        for key, value in node.items():
            if key == target:
                return value
            found = findNode(value, target)
            if found is not None:
                return found
    return None


def nodeNames(node):
    """Collect every clade name at or below a tree node.

    @param node - the tree mapping to walk
    @returns a set of clade names
    """
    names = set()
    if isinstance(node, dict):
        for key, value in node.items():
            names.add(key)
            names |= nodeNames(value)
    return names


def subtreeNames(tree, root):
    """Return the root plus every clade below it.

    @param tree - the whole parsed tree.yml mapping
    @param root - the clade name to root the subtree at
    @returns a set of clade names, or None when the root is absent
    """
    subtree = findNode(tree, root)
    if subtree is None:
        return None
    return nodeNames(subtree) | {root}


def stemOf(name):
    """Strip the family-group ending from a clade name.

    @param name - a clade name, e.g. "Ankylosauridae"
    @returns the lowercased stem, e.g. "ankylosaur"
    """
    lowered = name.lower()
    for ending in familyGroupEndings:
        if lowered.endswith(ending):
            return lowered[: -len(ending)]
    return lowered


def genusStems(typeGenus):
    """Enumerate the plausible genitive stems of a genus name.

    Family-group names are formed on the GENITIVE stem, which for third-
    declension Greek names diverges from the nominative: Baryonyx →
    Baryonych-, Caudipteryx → Caudipteryg-, Ceratops → Ceratop-. Modelling
    those explicitly is what keeps this check from firing on correctly formed
    names.

    @param typeGenus - the declared type genus
    @returns a set of candidate lowercased stems
    """
    lowered = typeGenus.lower()
    stems = {lowered, re.sub(r"(us|os|um|on|es|is|a)$", "", lowered)}
    if lowered.endswith("yx"):
        stems |= {lowered[:-2] + "yg", lowered[:-2] + "ych"}
    elif lowered.endswith("x"):
        stems |= {lowered[:-1] + "c", lowered[:-1] + "g", lowered[:-1] + "ch"}
    if lowered.endswith("ops"):
        stems.add(lowered[:-1])
    if lowered.endswith("s"):
        stems.add(lowered[:-1])
    return {stem for stem in stems if stem}


def stemsAgree(cladeName, typeGenus):
    """Test whether a family-group name is built on its type genus's stem.

    @param cladeName - the clade name
    @param typeGenus - the declared type genus
    @returns True when the clade stem matches any candidate genitive stem
    """
    cladeStem = stemOf(cladeName)
    if not cladeStem:
        return False
    return any(
        cladeStem.startswith(stem) or stem.startswith(cladeStem)
        for stem in genusStems(typeGenus)
    )


def checkClade(path, tree, findings):
    """Run every structural check against one clade file.

    @param path - absolute path to the clades/*.yml file
    @param tree - the parsed tree.yml mapping
    @param findings - list accumulating finding dicts
    @returns None
    """
    name = os.path.basename(path)[:-4]
    record = loadYaml(path)
    relative = os.path.relpath(path, DATA)
    referenceIds = [
        entry.get("id")
        for entry in (record.get("references") or [])
        if isinstance(entry, dict) and entry.get("id")
    ]

    def add(check, severity, detail):
        findings.append({
            "clade": name,
            "file": relative,
            "check": check,
            "severity": severity,
            "detail": detail,
        })

    for field in ("erected_in", "described_in"):
        refId = record.get(field)
        if not refId:
            continue
        if not os.path.exists(refStorePath(refId)):
            add(f"{field}-unresolved", "high",
                f"{field}: {refId} has no references/ entry.")
        elif refId not in referenceIds:
            add(f"{field}-not-cited", "medium",
                f"{field}: {refId} is not listed in the clade's own references block.")

    for refId in referenceIds:
        if not os.path.exists(refStorePath(refId)):
            add("reference-unresolved", "high",
                f"references[].id {refId} has no references/ entry.")

    typeGenus = record.get("type_genus")
    if typeGenus:
        if not os.path.exists(genusPath(typeGenus)):
            add("type-genus-unresolved", "high",
                f"type_genus: {typeGenus} has no genera/ file.")
        else:
            genusRecord = loadYaml(genusPath(typeGenus))
            parent = genusRecord.get("parent")
            names = subtreeNames(tree, name)
            if names is None:
                add("clade-not-in-tree", "high",
                    f"{name} has a clade file but no node in tree.yml.")
            elif parent not in names:
                add("type-genus-outside-clade", "high",
                    f"type_genus {typeGenus} has parent {parent!r}, which is outside "
                    f"the {name} subtree — the type genus must sit within its own clade.")

        if name.endswith(familyGroupEndings) and not stemsAgree(name, typeGenus):
            add("stem-mismatch", "signal",
                f"{name} does not look built on the stem of type_genus {typeGenus} "
                f"({stemOf(name)!r} vs {stemOf(typeGenus)!r}) — check the genitive stem.")

    erectedIn = record.get("erected_in")
    describedIn = record.get("described_in")
    erectedYear = refYear(erectedIn)
    describedYear = refYear(describedIn)

    # A revision cannot predate the erection of the name it revises.
    if erectedYear and describedYear and describedYear < erectedYear:
        add("described-before-erected", "medium",
            f"described_in {describedIn} ({describedYear}) predates erected_in "
            f"{erectedIn} ({erectedYear}) — a revision cannot precede the name.")

    # A family-group name is coined ON its type genus, so it cannot predate it.
    if typeGenus and erectedYear and os.path.exists(genusPath(typeGenus)):
        genusErected = earliestGenusNameYear(loadYaml(genusPath(typeGenus)))
        if genusErected and erectedYear < genusErected:
            add("clade-predates-type-genus", "medium",
                f"{name} erected {erectedYear} ({erectedIn}) but its type_genus "
                f"{typeGenus} was erected {genusErected} — a family-group name "
                f"cannot predate the genus it is coined on.")


def main():
    """Entry point: sweep every clade file and write the findings JSON.

    @returns None
    """
    parser = argparse.ArgumentParser(description="Structural audit of the clade files")
    parser.add_argument("--out", default=None)
    arguments = parser.parse_args()

    tree = loadYaml(os.path.join(DATA, "tree.yml"))
    findings = []
    paths = sorted(glob.glob(os.path.join(DATA, "clades", "*.yml")))
    for path in paths:
        checkClade(path, tree, findings)

    order = {"high": 0, "medium": 1, "signal": 2}
    findings.sort(key=lambda finding: (order[finding["severity"]], finding["check"], finding["clade"]))

    hard = [finding for finding in findings if finding["severity"] != "signal"]
    signals = [finding for finding in findings if finding["severity"] == "signal"]
    print(f"clade files checked: {len(paths)}")
    print(f"hard findings: {len(hard)}")
    for finding in hard:
        print(f"  [{finding['severity'].upper():6s}] {finding['check']} {finding['clade']}: {finding['detail']}")
    print(f"\nsignals (heuristic, for triage — not defects): {len(signals)}")
    for finding in signals:
        print(f"  [{finding['check']}] {finding['clade']}: {finding['detail'][:150]}")

    out = arguments.out or os.path.join(audit_dir(), "Dinosauria-clades", "clade-fields.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(findings, open(out, "w"), indent=2, ensure_ascii=False)
    print(f"\nclade-fields -> {out}")


if __name__ == "__main__":
    main()
