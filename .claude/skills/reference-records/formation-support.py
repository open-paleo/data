#!/usr/bin/env python3
"""Weigh each formation finding by how many papers put the taxon in each unit.

The stage pass showed that a disagreement printed as symmetric rarely is, and
that counting independent adoption before reading anything sorts the work. This
does the same for the formation buckets.

One thing is counted differently here. An age is a property of the horizon, so
`stage-support.py` counts per formation and lets every taxon in a unit share the
evidence. Which unit a specimen came *out of* is a property of that specimen, so
support has to be counted per TAXON: papers that name the genus and a candidate
unit close together. A paper about the Bayan Shireh saying nothing about
Achillobator is not evidence about Achillobator.

Counting is by paper, not occurrence -- twenty workers adopting a unit outweighs
one paper repeating it fifty times, the criterion #2012 set for spellings.

The suggestion on each row is a starting point, not a verdict. A count says how
many workers assert something, never whether they are right, and a reference
work is never a primary source for a value. Read the paper before recording
anything in adjudicated.yml.

Usage:
    python3 formation-support.py
    python3 formation-support.py --bucket formation-differs-single-source
    python3 formation-support.py --window 400
"""

import argparse
import collections
import glob
import os
import re

import yaml

from _paths import audit_dir, corpus_dir, data_dir

findingPattern = re.compile(
    r"^- (?:\[CONFIRMED BY (?P<confirmed>[^\]]+)\] )?(?P<binomial>[A-Z][a-z]+ [a-zë\-]+) "
    r"\[(?P<sources>[^\]]+)\]: ours '(?P<ours>[^']*)' vs (?P<theirs>.+)$")

# Trailing rank and lithology words, stripped from both sides before anything is
# compared. Without Limestone/Ls. the report weighs "Chipping Norton Limestone"
# against "Chipping Norton Ls." as though they were rival units.
rankWords = re.compile(
    r"\s+(Formation|Fm\.?|Group|Grp\.?|Svita|Beds|Bed|Member|Mbr\.?|Series|unit|"
    r"Sandstone|Sst\.?|Ss\.?|Limestone|Ls\.?|Mudstone|Mst\.?|Siltstone|Shale|Sh\.?|"
    r"Marls?|Clay|Conglomerate|Deposits)$",
    re.I)


def loadVariants():
    """Read the known alternative spellings for each formation.

    @returns: Dict of formation name to a list of alternative spellings.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "formation-variants.yml")

    return yaml.safe_load(open(path, encoding="utf-8")) or {}


def cleanUnit(text):
    """Reduce a printed unit name to something searchable.

    @param text: The unit as the reference work prints it.
    @returns: The bare name, or None when it carries no name at all.
    """
    name = re.sub(r"\s*\([^)]*\)", "", text).strip().strip("?").strip()

    # Applied repeatedly: "Unnamed unit" needs both "unit" and then the bare
    # word gone, and "Barun Goyot Fm." can arrive already carrying a rank.
    for _ in range(3):
        stripped = rankWords.sub("", name).strip()

        if stripped == name:
            break

        name = stripped

    # An extraction can double a cell ("Unnamed unit unnamed unit"), which slips
    # past an equality test and gets weighed as a real rival. Collapse repeats
    # before deciding, and match on the words present rather than the whole
    # string.
    words = [word for word in name.lower().split() if word]
    unique = set(words)

    if not name or unique <= {"uncertain", "unknown", "unnamed", "indeterminate",
                              "none", "provenance", "unit", "units", "bed", "beds"}:
        return None

    return name


def parseFindings(report, prefix):
    """Pull every formation finding out of the reconciliation report.

    @param report: The report text.
    @param prefix: Bucket name or prefix to include.
    @returns: Tuple of (findings, unnamed, sameUnit) -- the weighable findings as
        (binomial, heading, ours, theirs, sources) tuples, the taxa whose
        reference works name no unit at all, and the taxa whose two sides
        reduce to the same unit.
    """
    findings = []
    unnamed = []
    sameUnit = []

    for section in re.split(r"^## ", report, flags=re.M)[1:]:
        heading = section.split("\n", 1)[0].split(" (")[0]

        if not heading.startswith(prefix) or heading.endswith("REVIEWED"):
            continue

        for line in section.splitlines():
            match = findingPattern.match(line)

            if not match:
                continue

            theirs = []

            for claim in match.group("theirs").split(" | "):
                unit = cleanUnit(re.sub(r"\s*\([a-zë0-9\-]+\)\s*$", "", claim))

                if unit:
                    theirs.extend(part for part in
                                  (cleanUnit(piece) for piece in re.split(r" / | or ", unit))
                                  if part)

            ours = cleanUnit(match.group("ours"))

            # Both sides reduced to the same name, so the works are not
            # disagreeing with us -- the reconciler's spelling-variant list just
            # does not know the pair yet. Auto-closable, but only once someone
            # has seen it, so it is reported rather than dropped.
            if ours and theirs and all(unit.lower() == ours.lower() for unit in theirs):
                sameUnit.append((match.group("binomial"), heading, match.group("ours"),
                                 match.group("theirs"), match.group("sources")))
            elif ours and theirs:
                findings.append((match.group("binomial"), heading, ours,
                                 sorted(set(theirs)), match.group("theirs"),
                                 match.group("confirmed")))
            else:
                # The reference work prints "Uncertain" or "Unnamed unit". That
                # is not a rival claim, so there is nothing to weigh -- but it
                # is still a finding somebody has to close, and dropping it
                # silently would read as coverage it never had.
                unnamed.append((match.group("binomial"), heading, match.group("ours"),
                                match.group("theirs"), match.group("sources")))

    return findings, unnamed, sameUnit


def buildPattern(unit, variants, genus=None):
    """Compile a pattern matching a unit under any known spelling.

    @param unit: The unit name.
    @param variants: The variant registry.
    @param genus: The genus whose text this pattern will be run against.
    @returns: A compiled regular expression.
    """
    spellings = [unit]

    for key, alternatives in variants.items():
        pool = [key] + list(alternatives or [])

        if any(rankWords.sub("", name).strip().lower() == unit.lower() for name in pool):
            spellings.extend(rankWords.sub("", name).strip() for name in pool)

    alternatives = {r"[\s\-]*".join(re.escape(part) for part in spelling.split())
                    for spelling in spellings if spelling}

    # Units are routinely named after the animal found in them, so a bare
    # "Vulcanodon" matches every mention of the genus and "Rayoso" matches
    # inside "Rayososaurus" -- both counted as somebody asserting a formation.
    # Where the names collide, only a mention carrying a rank word counts.
    suffix = ""

    if genus and any(spelling.lower() in genus.lower() for spelling in spellings):
        suffix = r"\s+(?:Fm\.?|Formation|Grp\.?|Group|Beds?|Svita|Member|Mbr\.?)"

    return re.compile(rf"\b(?:{'|'.join(sorted(alternatives))})\b{suffix}", re.I)


def buildSupportIndex(findings, variants, window):
    """Count, per taxon, how many papers name it beside each candidate unit.

    @param findings: The parsed findings.
    @param variants: The variant registry.
    @param window: Characters either side of a genus mention to scan.
    @returns: Tuple of (mentions, sole, scanned) keyed by binomial then unit.
    """
    # Only a taxon's own candidates are tested against the text near it. Testing
    # every unit against every genus is the same answer several hundred times
    # more slowly, since a finding can only ever resolve to one of its two or
    # three contenders.
    units = {}
    candidates = {}
    genera = collections.defaultdict(set)

    for binomial, _, ours, theirs, _, _ in findings:
        genus = binomial.split(" ")[0]
        candidates[binomial] = [ours] + theirs
        genera[genus].add(binomial)

        # Keyed by taxon as well as unit: whether a bare mention counts depends
        # on whether the unit shares its name with the genus being scanned for.
        for unit in candidates[binomial]:
            units.setdefault((binomial, unit), buildPattern(unit, variants, genus))

    generaPatterns = {genus: re.compile(rf"\b{re.escape(genus)}\b") for genus in genera}
    index = collections.defaultdict(collections.Counter)
    sole = collections.defaultdict(collections.Counter)
    papers = [path for path in glob.glob(os.path.join(corpus_dir(), "markdown", "*.md"))
              if not path.endswith(".original.md")]

    for path in papers:
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue

        for genus, pattern in generaPatterns.items():
            spans = [match.start() for match in pattern.finditer(text)]

            if not spans:
                continue

            nearby = "".join(text[max(0, start - window):start + window] for start in spans)

            for binomial in genera[genus]:
                relevant = {unit for unit in candidates[binomial]
                            if units[(binomial, unit)].search(nearby)}

                for unit in relevant:
                    index[binomial][unit] += 1

                if len(relevant) == 1:
                    sole[binomial][next(iter(relevant))] += 1

    return index, sole, len(papers)


def suggest(ours, theirs, support, sole):
    """Propose a treatment from the support counts alone.

    @param ours: The unit our record holds.
    @param theirs: Units the reference works give.
    @param support: Counter of unit to paper count, any mention.
    @param sole: Counter of unit to paper count, sole mention only.
    @returns: A short verdict string.
    """
    ourSole, theirSole = sole[ours], max((sole[unit] for unit in theirs), default=0)
    ourCount, theirCount = support[ours], max((support[unit] for unit in theirs), default=0)

    if not support:
        return "NO DATA -- taxon and units never co-occur in the literature scanned"
    elif theirSole == 0 and ourSole > 0:
        return f"ours-correct -- theirs asserted alone by nobody ({ourSole} vs 0 sole)"
    elif ourSole == 0 and theirSole > 0:
        return f"CORRECT TO THEIRS -- ours asserted alone by nobody (0 vs {theirSole} sole)"
    elif ourSole == 0 and theirSole == 0:
        return f"co-occurring only -- neither asserted alone ({ourCount} vs {theirCount} mentions)"
    elif min(ourSole, theirSole) / max(ourSole, theirSole) >= 0.5:
        return f"CONTESTED -- both asserted ({ourSole} vs {theirSole} sole)"

    return f"leans {'ours' if ourSole > theirSole else 'theirs'} ({ourSole} vs {theirSole} sole)"


def main():
    """Weigh every formation finding and write the report.

    @returns: None.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", default="formation",
                        help="Bucket name or prefix to weigh (default: every formation bucket).")
    parser.add_argument("--window", type=int, default=400,
                        help="Characters either side of a genus mention to scan for a unit name.")
    arguments = parser.parse_args()

    report = open(os.path.join(audit_dir(), "reference-reconciliation.md"), encoding="utf-8").read()
    findings, unnamed, sameUnit = parseFindings(report, arguments.bucket)
    index, sole, scanned = buildSupportIndex(findings, loadVariants(), arguments.window)

    rows = []

    for binomial, heading, ours, theirs, claims, confirmed in findings:
        support = index.get(binomial, collections.Counter())
        soleSupport = sole.get(binomial, collections.Counter())
        rows.append((suggest(ours, theirs, support, soleSupport), binomial, heading, ours,
                     theirs, claims, confirmed, support, soleSupport))

    rows.sort(key=lambda row: (row[0].split(" ")[0], row[1]))

    lines = [
        "# Formation findings weighed by literature support", "",
        f"Scanned {scanned} papers for {len(findings)} findings, "
        f"with {len(unnamed) + len(sameUnit)} more listed at the end that cannot be",
        "weighed.", "",
        "Support is counted per TAXON and per PAPER. Which unit a specimen came out",
        "of is a property of that specimen, so a paper about the unit that never",
        "names the genus is not evidence about the genus -- unlike an age, which",
        "belongs to the horizon and is shared by everything in it.", "",
        "A count says how many workers assert something, never whether they are",
        "right, and a reference work corroborates a value but is never a primary",
        "source for it. Read the paper before recording anything.", "",
        "`CONTESTED` means both readings have real support: those are genuine",
        "stratigraphic disagreements, not bookkeeping, and need the describing",
        "paper rather than a count.", "",
    ]

    grouped = collections.defaultdict(list)

    for row in rows:
        grouped[row[0].split(" --")[0].split(" (")[0]].append(row)

    for verdict in sorted(grouped, key=lambda key: -len(grouped[key])):
        lines.append(f"## {verdict} ({len(grouped[verdict])})")
        lines.append("")

        for _, binomial, heading, ours, theirs, claims, confirmed, support, soleSupport in grouped[verdict]:
            counts = ", ".join(f"{unit} {count}" for unit, count in support.most_common(6)) or "none"
            soleCounts = ", ".join(f"{unit} {count}"
                                   for unit, count in soleSupport.most_common(6)) or "none"
            lines.append(f"- [ ] **{binomial}** — `{heading}`")

            # Print the dissenting claims WITH their attributions, and say which
            # works agree with us. Printing a bare list of every source holding a
            # row for the taxon reads as a list of dissenters, and sent a review
            # chasing five findings the reconciler had already marked confirmed.
            if confirmed:
                lines.append(f"      CONFIRMED BY {confirmed} — agrees with ours")

            lines.append(f"      ours {ours} · they say {claims}")
            lines.append(f"      asserted alone: {soleCounts}")
            lines.append(f"      any mention:    {counts}")

        lines.append("")

    if sameUnit:
        lines += [
            f"## same unit under two names ({len(sameUnit)})", "",
            "Both sides reduce to one name once rank and lithology words are",
            "stripped, so nobody is disagreeing with us. Add the pair to",
            "formation-variants.yml and close them.", "",
        ]

        for binomial, heading, ours, theirs, sources in sameUnit:
            lines.append(f"- [ ] **{binomial}** — `{heading}` [{sources}]")
            lines.append(f"      ours {ours} · they say {theirs}")

        lines.append("")

    if unnamed:
        lines += [
            f"## reference work names no unit ({len(unnamed)})", "",
            "Nothing to weigh: the work prints \"Uncertain\" or \"Unnamed\" where we",
            "carry a named unit, so ours is the finer value and there is no rival",
            "claim. Still needs closing in adjudicated.yml -- confirm the name we",
            "hold is right, rather than assuming it because theirs is blank.", "",
        ]

        for binomial, heading, ours, theirs, sources in unnamed:
            lines.append(f"- [ ] **{binomial}** — `{heading}` [{sources}]")
            lines.append(f"      ours {ours} · they say {theirs}")

        lines.append("")

    path = os.path.join(audit_dir(), "formation-support.md")
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")

    print(f"scanned {scanned} papers, {len(findings)} findings")

    for verdict in sorted(grouped, key=lambda key: -len(grouped[key])):
        print(f"   {len(grouped[verdict]):3d}  {verdict}")

    print(f"\nwrote {path}")


if __name__ == "__main__":
    main()
