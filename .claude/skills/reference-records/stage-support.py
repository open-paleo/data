#!/usr/bin/env python3
"""Weigh each stage finding by how many papers support each competing age.

A stage disagreement looks symmetric in the report -- ours says one thing, the
reference work another -- but often is not. The Baruungoyot block was ten
findings where the reference work's Maastrichtian was supported by ZERO papers
against 22 for our Campanian, so widening the range to cover both would have
adopted a 17.6 Myr span nothing in the literature asserts.

This measures that asymmetry before anything is decided. An age is a property
of the horizon, so support is counted per FORMATION rather than per taxon, and
by paper rather than by occurrence -- independent adoption, so one paper
repeating a name fifty times cannot outvote twenty papers. That is the same
criterion #2012 established for formation spellings.

The suggestion on each row is a starting point, not a verdict: a count says how
many workers assert something, never whether they are right. Read the primary
before recording anything in adjudicated.yml.

Usage:
    python3 stage-support.py
    python3 stage-support.py --bucket stage-differs-single-source
    python3 stage-support.py --window 160
"""

import argparse
import collections
import glob
import os
import re

import yaml

from _formations import loadVariants
from _paths import audit_dir, corpus_dir, data_dir

findingPattern = re.compile(
    r"^- (?:\[CONFIRMED BY [^\]]+\] )?(?P<binomial>[A-Z][^\[]+) "
    r"\[(?P<sources>[^\]]+)\]: ours \[(?P<ours>[^\]]*)\] vs (?P<theirs>.+)$")

stagePattern = re.compile(r"\b([A-Z][a-z]+(?:ian|ium))\b")


def loadStages():
    """Read the controlled stage vocabulary, oldest first.

    @returns: Dict of lowercased stage name to its schema entry.
    """
    schema = yaml.safe_load(open(os.path.join(data_dir(), "schema.yml"), encoding="utf-8"))

    return {name.lower(): entry for name, entry in (schema.get("stages") or {}).items()}


def loadFormations():
    """Map each binomial to the formation its record holds.

    @returns: Dict of binomial to formation name, skipping records without one.
    """
    formations = {}

    for path in glob.glob(os.path.join(data_dir(), "genera", "*", "*.yml")):
        document = yaml.safe_load(open(path, encoding="utf-8"))

        if not isinstance(document, dict):
            continue

        for species in (document.get("species") or []):
            formation = (species.get("location") or {}).get("formation")

            if formation:
                formations[species["name"]] = formation

    return formations


def buildSupportIndex(formations, stages, window):
    """Count, for each formation, how many papers put it in each stage.

    Scans every paper once and records which stage names appear close to a
    mention of the formation. Proximity is crude but the alternative -- reading
    every paper -- is what this pass exists to avoid.

    @param formations: The set of formation names to look for.
    @param stages: The controlled stage vocabulary.
    @param window: How many characters after a formation mention to scan.
    @returns: Tuple of (mentions, sole, scanned) -- two dicts of formation name
        to a Counter of stage name to paper count, and the papers scanned.
    """
    # A unit is written several ways across the literature, and counting only
    # our spelling undercounts badly: scanning for "Baruungoyot" alone finds 12
    # papers where "Barun Goyot" as well finds 22, which was the difference
    # between "leans ours" and an unopposed majority.
    variants = loadVariants()
    patterns = {}

    for formation in formations:
        spellings = [formation] + [re.sub(r"\s+(Fm\.?|Formation|Grp\.?|Group|Svita)$", "", other)
                                   for other in (variants.get(formation) or [])]
        alternatives = []

        for spelling in spellings:
            # Let spacing and hyphenation fall where they may, so "Barun Goyot"
            # and "Barun-Goyot" both match one pattern.
            alternatives.append(r"[\s\-]*".join(re.escape(part) for part in spelling.split()))

        patterns[formation] = re.compile("|".join(alternatives), re.I)

    index = collections.defaultdict(collections.Counter)
    sole = collections.defaultdict(collections.Counter)
    papers = [path for path in glob.glob(os.path.join(corpus_dir(), "markdown", "*.md"))
              if not path.endswith(".original.md")]

    for path in papers:
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue

        for formation, pattern in patterns.items():
            found = set()

            for match in pattern.finditer(text):
                for name in stagePattern.findall(text[match.end():match.end() + window]):
                    if name.lower() in stages:
                        found.add(name)

            for name in found:
                index[formation][name] += 1

            # A paper naming one stage and no other is asserting that age; a
            # paper naming two is giving a range, and counts for neither
            # exclusively. That distinction is what separates "leans ours" from
            # "theirs has no independent support" -- Baruungoyot reads 37 vs 15
            # on mentions but 22 vs 0 on sole support.
            if len(found) == 1:
                sole[formation][next(iter(found))] += 1

    return index, sole, len(papers)


def suggest(ourStages, theirStages, support, sole):
    """Propose a treatment from the support counts alone.

    Sole support decides first. A paper naming one stage beside the formation
    asserts that age; a paper naming a range asserts neither exclusively, so a
    value with mentions but no sole support has never been anyone's answer on
    its own.

    @param ourStages: Stage names our record holds.
    @param theirStages: Stage names the reference work gives.
    @param support: Counter of stage name to paper count, any mention.
    @param sole: Counter of stage name to paper count, sole mention only.
    @returns: A short verdict string.
    """
    ourCount = max((support[name] for name in ourStages), default=0)
    theirCount = max((support[name] for name in theirStages), default=0)
    ourSole = max((sole[name] for name in ourStages), default=0)
    theirSole = max((sole[name] for name in theirStages), default=0)

    if not support:
        return "NO DATA -- formation absent from the literature scanned"
    elif len([name for name, count in support.items() if count >= 3]) >= 5:
        # A formation credibly assigned to five or more stages is not one
        # horizon: the Cedar Mountain spans Berriasian to Cenomanian across four
        # members, so every taxon in it draws the same counts and the verdict
        # means nothing. The answer is the MEMBER, which needs location.member.
        return "MULTI-MEMBER -- formation spans too many stages to count at this level"
    elif theirSole == 0 and ourSole > 0:
        return f"ours-correct -- theirs asserted alone by nobody ({ourSole} vs 0 sole)"
    elif ourSole == 0 and theirSole > 0:
        return f"CORRECT TO THEIRS -- ours asserted alone by nobody (0 vs {theirSole} sole)"
    elif ourSole == 0 and theirSole == 0:
        return f"range only -- neither asserted alone ({ourCount} vs {theirCount} mentions)"
    elif min(ourSole, theirSole) / max(ourSole, theirSole) >= 0.5:
        return f"straddle -- both asserted ({ourSole} vs {theirSole} sole)"

    leader = "ours" if ourSole > theirSole else "theirs"

    return f"leans {leader} ({ourSole} vs {theirSole} sole)"


def main():
    """Weigh every stage finding and write the report.

    @returns: None.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", default="stage",
                        help="Bucket name or prefix to weigh (default: every stage bucket).")
    parser.add_argument("--window", type=int, default=140,
                        help="Characters after a formation mention to scan for a stage name.")
    arguments = parser.parse_args()

    stages = loadStages()
    formations = loadFormations()
    report = open(os.path.join(audit_dir(), "reference-reconciliation.md"), encoding="utf-8").read()

    findings = []

    for section in re.split(r"^## ", report, flags=re.M)[1:]:
        heading = section.split("\n", 1)[0].split(" (")[0]

        if not heading.startswith(arguments.bucket):
            continue

        for line in section.splitlines():
            match = findingPattern.match(line)

            if not match:
                continue

            binomial = match.group("binomial").strip()
            ourStages = [name.strip().strip("'").capitalize()
                         for name in match.group("ours").split(",") if name.strip()]
            theirStages = [name for name in stagePattern.findall(match.group("theirs"))
                           if name.lower() in stages]

            if binomial in formations and ourStages and theirStages:
                findings.append((binomial, heading, formations[binomial], ourStages,
                                 theirStages, match.group("sources")))

    needed = {finding[2] for finding in findings}
    index, sole, scanned = buildSupportIndex(needed, stages, arguments.window)

    rows = []

    for binomial, heading, formation, ourStages, theirStages, sources in findings:
        support = index.get(formation, collections.Counter())
        soleSupport = sole.get(formation, collections.Counter())
        rows.append((suggest(ourStages, theirStages, support, soleSupport), binomial, heading,
                     formation, ourStages, theirStages, sources, support, soleSupport))

    rows.sort(key=lambda row: (row[0].split(" ")[0], row[3], row[1]))

    lines = [
        "# Stage findings weighed by literature support", "",
        f"Scanned {scanned} papers for {len(needed)} formations behind {len(findings)} findings.", "",
        "Support is counted per FORMATION and per PAPER: an age belongs to the horizon,",
        "and independent adoption matters more than raw occurrences. A count says how",
        "many workers assert something, never whether they are right -- read the primary",
        "before recording anything.", "",
        "`straddle` is only proposed where both readings have comparable support. Where",
        "one side has none, widening the range would adopt a span nothing asserts.", "",
        "`MULTI-MEMBER` means the formation is credibly placed in five or more stages,",
        "so it is not one horizon and counting at formation level cannot answer the",
        "question. Populate `location.member` for those and re-run.", "",
    ]

    grouped = collections.defaultdict(list)

    for row in rows:
        grouped[row[0].split(" --")[0].split(" (")[0]].append(row)

    for verdict in sorted(grouped, key=lambda key: -len(grouped[key])):
        lines.append(f"## {verdict} ({len(grouped[verdict])})")
        lines.append("")

        for row in grouped[verdict]:
            _, binomial, heading, formation, ourStages, theirStages, sources, support, soleSupport = row
            counts = ", ".join(f"{name} {count}" for name, count in support.most_common(6)) or "none"
            soleCounts = ", ".join(f"{name} {count}" for name, count in soleSupport.most_common(6)) or "none"
            lines.append(f"- [ ] **{binomial}** — {formation} — `{heading}` [{sources}]")
            lines.append(f"      ours {'/'.join(ourStages)} · they say {'/'.join(theirStages)}")
            lines.append(f"      asserted alone: {soleCounts}")
            lines.append(f"      any mention:    {counts}")

        lines.append("")

    path = os.path.join(audit_dir(), "stage-support.md")
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")

    print(f"scanned {scanned} papers, {len(needed)} formations, {len(findings)} findings")

    for verdict in sorted(grouped, key=lambda key: -len(grouped[key])):
        print(f"   {len(grouped[verdict]):3d}  {verdict}")

    print(f"\nwrote {path}")


if __name__ == "__main__":
    main()
