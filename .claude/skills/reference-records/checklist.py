#!/usr/bin/env python3
"""Turn one bucket of the reconciliation report into a decidable checklist.

The report says only that two sources disagree. Deciding a finding means asking
the primary, so this pulls the describing paper (preferred, being the later
reappraisal) or the erecting paper, locates each competing value in it, and
quotes the surrounding text. Most items can then be settled without opening
anything.

Output lands in scratch/audit/ alongside the report and is gitignored. Write the
outcome on each `decision:` line, then record the settled ones in
adjudicated.yml with the quotation that closed them.

Usage:
    python3 checklist.py holotype-differs-single-source
    python3 checklist.py stage --width 200
"""

import argparse
import io
import os
import re

import yaml

from _paths import audit_dir, corpus_dir, data_dir

findingPattern = re.compile(
    r"^- (?:\[CONFIRMED BY (?P<confirmed>[^\]]+)\] )?(?P<binomial>[A-Z][^\[]+) "
    r"\[(?P<sources>[^\]]+)\]: ours (?P<ours>.+?) vs (?P<rest>.+)$")


def loadReport():
    """Read the reconciliation report, grouped by section heading.

    @returns: Dict of section name -> list of raw finding lines.
    @raises SystemExit: When the report has not been generated yet.
    """
    path = os.path.join(audit_dir(), "reference-reconciliation.md")

    if not os.path.exists(path):
        raise SystemExit(f"no report at {path}; run extract.py && reconcile.py first")

    sections, current = {}, None

    for line in io.open(path, encoding="utf-8"):
        if line.startswith("## "):
            current = line[3:].split(" (")[0].strip()
            sections.setdefault(current, [])
        elif line.startswith("- ") and current:
            sections[current].append(line.rstrip("\n"))

    return sections


def parseFinding(line):
    """Split one report line into its binomial, our value and the alternatives.

    Both report shapes are handled: the plain one and the `[CONFIRMED BY ...]`
    form used where a reference work already agrees with us.

    @param line: A raw report line.
    @returns: A finding dict, or None when the line is not a finding.
    """
    match = findingPattern.match(line)

    if not match:
        return None

    ours = match.group("ours").strip()

    if ours.startswith("[") and ours.endswith("]"):
        ourValues = [value.strip().strip("'") for value in ours[1:-1].split(",")
                     if value.strip()]
    else:
        ourValues = [ours.strip("'")]

    alternatives, seen = [], set()

    for chunk in match.group("rest").split(" | "):
        piece = re.match(r"^(.*)\s+\(([^()]+)\)$", chunk.strip())

        if piece and piece.group(1) not in seen:
            seen.add(piece.group(1))
            alternatives.append((piece.group(1).strip(), piece.group(2).strip()))

    return {
        "binomial": match.group("binomial").strip(),
        "ours": ourValues,
        "alternatives": alternatives,
        "confirmedBy": match.group("confirmed"),
    }


def loadGenus(genusName):
    """Read the genus YAML for a genus name.

    @param genusName: Capitalized genus, e.g. "Abelisaurus".
    @returns: Parsed YAML, or None when no file exists.
    """
    path = os.path.join(data_dir(), "genera", genusName[0].upper(), f"{genusName}.yml")

    if not os.path.exists(path):
        return None

    return yaml.safe_load(io.open(path, encoding="utf-8"))


def resolvePaper(genus, binomial):
    """Find the primary to consult, describing paper first.

    A later reappraisal fixes types more often than the erecting paper does, so
    described_in outranks erected_in, and the species-level pointer outranks the
    genus-level one.

    @param genus: Parsed genus YAML, or None.
    @param binomial: Full species name.
    @returns: (citationKey, paperText) where either may be None.
    """
    if not genus:
        return None, None

    species = next((entry for entry in genus.get("species") or []
                    if entry.get("name") == binomial), None)

    if species is None:
        return None, None

    keys = []

    for role in ("described_in", "erected_in"):
        for holder in (species, genus):
            key = holder.get(role)

            if key and key not in keys:
                keys.append(key)

    for key in keys:
        path = os.path.join(corpus_dir(), "markdown", f"{key}.md")

        if os.path.exists(path):
            return key, io.open(path, encoding="utf-8", errors="replace").read()

    return (keys[0] if keys else None), None


def digitPattern(value):
    """Build a punctuation-blind pattern for a catalogue number's digit core.

    Institution prefixes vary between sources, so matching on the digits finds
    the specimen whichever code the paper used. Cores under three digits are
    refused: "MG 3" once matched a citation "(3)" and "IVPP V20" matched
    "20 individuals".

    @param value: A specimen id or other value as printed in the report.
    @returns: A compiled pattern, or None when the value has no usable core.
    """
    groups = [run.lstrip("0") or "0" for run in re.findall(r"\d+", str(value))]

    if not groups or sum(len(group) for group in groups) < 3:
        return None

    joined = r"[\s.\-–—/,]{0,3}0*".join(re.escape(group) for group in groups)

    return re.compile(rf"(?<![0-9])0*{joined}(?![0-9])")


def snippet(value, text, width):
    """Quote the paper around the first occurrence of a value.

    @param value: The value to locate.
    @param text: Full paper markdown, or None when the paper is not held.
    @param width: Characters of context to keep on each side.
    @returns: A collapsed one-line excerpt, or None when not found.
    """
    pattern = digitPattern(value)

    if pattern is None or not text:
        return None

    match = pattern.search(text)

    if not match:
        return None

    start = max(0, match.start() - width)
    end = min(len(text), match.end() + width)

    return " ".join(text[start:end].split()).replace("|", "\\|")


def render(finding, key, text, width):
    """Render one checklist item.

    @param finding: A parsed finding.
    @param key: Citation key of the paper consulted, or None.
    @param text: Paper markdown, or None when not held.
    @param width: Context width for quotations.
    @returns: A markdown block.
    """
    ours = ", ".join(f"`{value}`" for value in finding["ours"])
    alternatives = " · ".join(f"`{value}` ({source})"
                              for value, source in finding["alternatives"])

    lines = [f"- [ ] **{finding['binomial']}** — ours {ours}",
             f"  - competing: {alternatives}"]

    if finding["confirmedBy"]:
        lines.append(f"  - **ours is confirmed by {finding['confirmedBy']}**")

    lines.append(f"  - paper: `{key or '-'}`" + ("" if text else " · **not held**"))

    ourQuote = next((snippet(value, text, width) for value in finding["ours"]
                     if snippet(value, text, width)), None)

    lines.append(f"  - ours in paper: > {ourQuote}" if ourQuote
                 else "  - ours in paper: *not found*")

    for value, _ in finding["alternatives"]:
        quote = snippet(value, text, width)

        if quote and quote != ourQuote:
            lines.append(f"  - `{value}` in paper: > {quote}")

    lines.append("  - decision: ")

    return "\n".join(lines)


def main():
    """Write a checklist for the requested bucket.

    @returns: Nothing.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bucket", help="section name, or a prefix of one")
    parser.add_argument("--width", type=int, default=140,
                        help="characters of paper context each side (default 140)")
    args = parser.parse_args()

    sections = loadReport()
    matched = [name for name in sections if name.startswith(args.bucket)]

    if not matched:
        raise SystemExit("no section matches; available:\n  "
                         + "\n  ".join(sorted(sections)))

    output = [f"# Checklist — {', '.join(matched)}", "",
              "Generated from `scratch/audit/reference-reconciliation.md`. Each entry",
              "quotes what the describing paper (preferred) or erecting paper says around",
              "each competing value, so most can be settled without opening anything.",
              "Write the outcome on `decision:` and tick the box; then record the settled",
              "ones in `adjudicated.yml` with the quotation that closed them.", "",
              "**A reference work disagreeing with us is not evidence that we are wrong.**",
              "Of 58 number-differing holotype findings triaged this way, 22 were",
              "corrections to our data and 36 confirmed us.", "",
              "Two traps worth carrying in: the erecting paper often does not use the word",
              "\"Holotype\" (look for `Type`, `COTYPES`, `TYPE:`, or no heading), and in a",
              "multi-taxon paper the search must be scoped to the binomial — taking the",
              "first match once returned a Permian pareiasaur's type for *Paranthodon*.", ""]

    total = 0

    for name in matched:
        findings = [parseFinding(line) for line in sections[name]]
        findings = [finding for finding in findings if finding]
        output.append(f"\n## {name} ({len(findings)})\n")

        for finding in sorted(findings, key=lambda item: item["binomial"]):
            genus = loadGenus(finding["binomial"].split()[0])
            key, text = resolvePaper(genus, finding["binomial"])
            output.append(render(finding, key, text, args.width))
            output.append("")
            total += 1

    path = os.path.join(audit_dir(), f"checklist-{matched[0]}.md")
    io.open(path, "w", encoding="utf-8").write("\n".join(output))

    print(f"wrote {os.path.relpath(path, data_dir())}")
    print(f"{total} items across {len(matched)} section(s)")


if __name__ == "__main__":
    main()
