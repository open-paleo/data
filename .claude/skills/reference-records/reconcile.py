#!/usr/bin/env python3
"""Tier 1 reconciliation: compare every genus YAML against the reference-work
records extracted by extract.py, and report the disagreements.

Nothing here is ground truth. A reference work may corroborate a value but is
never a primary source for it, so every finding is a QUESTION for a human gate,
and Tier 2 settles it against the describing paper. In particular a mismatch is
just as likely to be the reference work being wrong, or lagging, as us.

Matching is at species level, since the reference tables are one row per species.

Country names are mapped to ISO codes by MAJORITY VOTE over the matched pairs
rather than from a hand-written table: whatever ISO code our data most often
pairs with "Morocco" defines the mapping, and only the minority disagreements are
reported. This keeps the check from inheriting a mapping mistake of mine, and it
self-corrects as the dataset grows.

Usage:
    python3 reconcile.py                # full report
    python3 reconcile.py --limit 15     # cap examples per category
"""

import argparse
import collections
import glob
import json
import os
import re
import unicodedata

import yaml

from _paths import audit_dir, data_dir

DATA = data_dir()
CACHE = os.path.join(audit_dir(), "reference-records")


def normalizeFormation(name):
    """Fold a formation name for comparison: drop rank words and punctuation.

    "Galula Fm." and "Galula Formation" must compare equal, as must
    "Kem Kem Beds" and "Kem Kem".

    @param name: Raw formation string, or None.
    @returns: A normalized key, empty when nothing usable remains.
    """
    if not name:
        return ""

    # Fold accents first: the reference works print "Tiouraren" where we print
    # "Tiourarén", and that is a spelling variant, not a different formation.
    decomposed = unicodedata.normalize("NFKD", str(name))
    cleaned = "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()

    # Expand the abbreviations the reference works use, before rank words are
    # dropped, so "Cedar Mt. Fm." and "Cedar Mountain Formation" converge.
    for abbreviation, expansion in (("mt.", "mountain"), ("mts.", "mountains"),
                                    ("st.", "saint"), ("ft.", "fort"),
                                    ("is.", "island"), ("riv.", "river")):
        cleaned = cleaned.replace(abbreviation, expansion)

    cleaned = re.sub(r"\b(formation|fm\.?|beds?|member|mbr\.?|group|grp\.?|svita|series)\b", " ", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)

    return " ".join(cleaned.split())


def formationsAgree(ourName, referenceName):
    """Decide whether two formation names are compatible rather than identical.

    Stratigraphic names nest: "Elliot" vs "Upper Elliot", or "West Melbury Marly
    Chalk" vs "Chalk Grp.", describe the same rock at different precision. One
    token set containing the other is treated as agreement, since neither side
    contradicts the other and reporting it would bury the real disagreements.

    @param ourName: Formation string from the genus YAML.
    @param referenceName: Formation string from the reference work.
    @returns: True when the names agree or are hierarchically compatible.
    """
    ourKey = normalizeFormation(ourName)
    referenceKey = normalizeFormation(referenceName)

    if not ourKey or not referenceKey:
        return True
    elif ourKey == referenceKey:
        return True

    ourTokens = set(ourKey.split())
    referenceTokens = set(referenceKey.split())

    return ourTokens <= referenceTokens or referenceTokens <= ourTokens


def normalizeSpecimen(value):
    """Fold a catalogue number: uppercase, strip punctuation and spacing.

    "MCF-PVPH-236", "MCF PVPH 236" and "mcf/pvph/236" all fold together, so that
    only genuinely different numbers are reported.

    @param value: Raw specimen string, or None.
    @returns: A normalized key, empty when nothing usable remains.
    """
    if not value:
        return ""

    return re.sub(r"[^A-Z0-9]+", "", str(value).upper())


def loadStageVocabulary():
    """Return the project's own set of valid stage names, lowercased.

    Validating against this vocabulary rather than free text is what keeps
    conversion debris out of the comparison: a wrapped Dinosauria row can leave
    "Quadrate, fibula, caudal vertebrae" sitting in the Age column, which must
    read as "no age stated", not as an age that disagrees with ours.

    @returns: Set of lowercased stage names.
    """
    schema = yaml.safe_load(open(os.path.join(DATA, "schema.yml"), encoding="utf-8"))

    return {str(name).lower() for name in (schema.get("stages") or {})}


def splitStages(value, vocabulary):
    """Extract the recognised stage names from a reference-work age cell.

    The works write ages many ways -- "Hettangian/Sinemurian", "Maastrichtian
    Age", "?late Campanian or Maastrichtian", "(?)" -- so the string is split on
    every plausible separator and only tokens present in the project vocabulary
    are kept. An empty result means "no usable age", never "disagrees".

    @param value: Raw stage string, or None.
    @param vocabulary: Set of valid lowercased stage names.
    @returns: Set of recognised lowercased stage names.
    """
    if not value:
        return set()

    tokens = re.split(r"[^A-Za-z]+| or | and | to ", str(value).lower())

    return {token for token in tokens if token in vocabulary}


def loadInstitutionAliases():
    """Map every institution code and alias to its canonical code.

    Reused so that "NHMUK R3078" and "BMNH R.3078" compare equal: the registry
    already records those as one institution, and without it the reconciler
    reports a renamed museum as a specimen disagreement.

    @returns: Dict of uppercased code/alias -> canonical code.
    """
    registry = yaml.safe_load(open(os.path.join(DATA, "institutions.yaml"), encoding="utf-8"))
    mapping = {}

    for code, entry in registry.items():
        if not isinstance(entry, dict):
            continue

        mapping[code.upper().replace("-", "").replace(" ", "")] = code

        for alias in (entry.get("aliases") or []):
            mapping[str(alias).upper().replace("-", "").replace(" ", "")] = code

    return mapping


def foldSpecimen(value, aliases):
    """Normalize a catalogue number, resolving its institution prefix to canonical.

    @param value: Raw catalogue number, or None.
    @param aliases: Mapping from loadInstitutionAliases().
    @returns: Normalized comparison key, empty when nothing usable remains.
    """
    if not value:
        return ""

    match = re.match(r"\s*([A-Za-z][A-Za-z.\-]*)\s*(.*)", str(value))

    if not match:
        return normalizeSpecimen(value)

    code = match.group(1).upper().replace(".", "").replace("-", "")

    return normalizeSpecimen(aliases.get(code, match.group(1)) + " " + match.group(2))


def denotesSeries(value):
    """Detect a reference value that names a RANGE or SERIES of specimens.

    "IPFUB Gui Th 1 through 3", "ISI R335/1-65" and "Various MNCN and MCD
    specimens" all say the type comprises several catalogue numbers. Recording a
    single element against one of those is a substantive gap -- the same defect
    class as Chebsaurus, where 1 element of 78 was recorded -- not a formatting
    variant to be suppressed.

    Hyphens inside a catalogue code must NOT count: "FPDM-V8468" and
    "MCF-PVPH-108" are single specimens. A dash therefore only marks a range when
    it joins two numeric endpoints in ascending order, or a number to a single
    trailing letter ("058267A-C").

    @param value: Raw reference specimen string, or None.
    @returns: True when the value denotes more than one specimen.
    """
    if not value:
        return False
    elif re.search(r"\b(series|various|specimens|through)\b", value, re.I):
        return True
    elif re.search(r",\s*[.A-Za-z0-9]", value):
        return True

    for before, after in re.findall(r"(\d+)\s*[–—-]\s*([A-Za-z]?\d*)", value):
        if after and after.isdigit() and int(after) > int(before):
            return True
        elif after and not after.isdigit():
            return True

    # "058267A-C": a numbered element extended by a single trailing letter.
    if re.search(r"\d[A-Za-z]?\s*[–—-]\s*[A-Za-z](?![A-Za-z])", value):
        return True

    return bool(re.search(r"[A-Za-z]\d+\s*[–—-]\s*[A-Za-z]\d+", value))


def loadReferenceRecords():
    """Load every extracted reference record, keyed by normalized binomial.

    @returns: Dict of "genus species" (lowercased) -> list of records.
    """
    byBinomial = collections.defaultdict(list)

    for path in sorted(glob.glob(os.path.join(CACHE, "*.json"))):
        cache = json.load(open(path, encoding="utf-8"))

        for record in cache["records"]:
            if not record.get("genus") or not record.get("species"):
                continue

            key = f"{record['genus']} {record['species']}".lower()
            record["ref_id"] = cache["ref_id"]
            byBinomial[key].append(record)

    return byBinomial


def loadSpeciesRecords():
    """Flatten every genus YAML into per-species records for comparison.

    @returns: List of dicts describing each species with a type specimen block.
    """
    records = []

    for path in sorted(glob.glob(os.path.join(DATA, "genera", "*", "*.yml"))):
        document = yaml.safe_load(open(path, encoding="utf-8"))

        if not isinstance(document, dict) or "genus" not in document:
            continue

        for species in (document.get("species") or []):
            name = species.get("name")

            if not name:
                continue

            location = species.get("location") or {}
            period = species.get("period") or {}
            typeSpecimen = species.get("type_specimen") or {}
            specimenIds = typeSpecimen.get("specimen_id") or []

            if isinstance(specimenIds, str):
                specimenIds = [specimenIds]

            records.append({
                "file": os.path.relpath(path, DATA),
                "genus": document["genus"],
                "binomial": name,
                "specimenIds": [str(value) for value in specimenIds],
                "formation": location.get("formation"),
                "country": location.get("country"),
                "stages": [str(stage) for stage in (period.get("stage") or [])],
            })

    return records


def buildCountryMap(pairs):
    """Derive reference-name -> ISO code by majority vote over matched pairs.

    @param pairs: Iterable of (referenceCountryName, isoCode).
    @returns: Dict mapping lowercased reference name to the dominant ISO code.
    """
    tally = collections.defaultdict(collections.Counter)

    for name, iso in pairs:
        if name and iso:
            tally[name.strip().lower()][iso] += 1

    return {name: counts.most_common(1)[0][0] for name, counts in tally.items()}


def main():
    parser = argparse.ArgumentParser(description="Reconcile genus data against reference records")
    parser.add_argument("--limit", type=int, default=12,
                        help="maximum examples listed per category (default 12)")
    args = parser.parse_args()

    institutionAliases = loadInstitutionAliases()
    stageVocabulary = loadStageVocabulary()
    referenceRecords = loadReferenceRecords()
    speciesRecords = loadSpeciesRecords()

    matched = []

    for record in speciesRecords:
        candidates = referenceRecords.get(record["binomial"].lower())

        if candidates:
            matched.append((record, candidates))

    countryMap = buildCountryMap(
        (reference.get("country"), ours.get("country"))
        for ours, references in matched for reference in references)

    findings = collections.defaultdict(list)

    def classify(field, disagreeing, agreeing, disagreeingKeys):
        """Name a finding by how much independent support it carries.

        Three tiers, because they warrant different effort:

        CORROBORATED  two or more reference works give the SAME value and it is
                      not ours -- the strongest signal available here, and where
                      our own data is most likely wrong.
        ours-outlier  every source disagrees with us but also with each other.
                      Our value is still the odd one out and worth a look, but
                      there is no agreed replacement to adopt.
        single-source only one work speaks; weakest, and a reference work alone
                      never justifies a change.

        @param field: Field name being compared.
        @param disagreeing: Reference ids whose value differs from ours.
        @param agreeing: Reference ids whose value matches ours.
        @param disagreeingKeys: Normalized values from the disagreeing sources.
        @returns: The finding category name.
        """
        if len(disagreeing) >= 2 and not agreeing:
            if len(set(disagreeingKeys)) == 1:
                return f"{field}-differs-CORROBORATED"

            return f"{field}-differs-ours-outlier"
        elif disagreeing and agreeing:
            return f"{field}-sources-disagree"

        return f"{field}-differs-single-source"


    def agreementNote(agreeing):
        """Prefix a finding with the sources that back OUR value, if any.

        Without this a reader sees two source ids on the line and assumes both
        dispute us, when one may be confirming us.

        @param agreeing: Reference ids whose value matches ours.
        @returns: A leading marker string, empty when nothing agrees.
        """
        if not agreeing:
            return ""

        return f"[CONFIRMED BY {','.join(sorted(agreeing))}] "

    for ours, references in matched:
        sourceIds = ",".join(sorted({reference["ref_id"] for reference in references}))
        label = f"{ours['binomial']} [{sourceIds}]"

        ourSpecimens = {foldSpecimen(value, institutionAliases) for value in ours["specimenIds"]}
        ourSpecimens.discard("")

        agreeing, disagreeing, referenceValues, disagreeingKeys = [], [], [], []
        seriesValues = []

        for reference in references:
            raw = reference.get("holotype")
            referenceSpecimen = foldSpecimen(raw, institutionAliases)

            if not ourSpecimens or not referenceSpecimen:
                continue

            covered = any(referenceSpecimen == value or referenceSpecimen in value
                          or value in referenceSpecimen for value in ourSpecimens)

            # A series finding needs the reference to STRICTLY extend our number.
            # An identical string cannot be one, however many hyphens it carries:
            # "MN 7821-V" and "MLP 77-V-29-1" are single specimens whose suffix
            # letters merely look like range endpoints.
            extendsOurs = any(referenceSpecimen != value and value in referenceSpecimen
                              for value in ourSpecimens)

            if extendsOurs and denotesSeries(raw) and len(ours["specimenIds"]) == 1:
                # We record one element of what the reference calls a series.
                seriesValues.append(f"{raw} ({reference['ref_id']})")
            elif covered:
                agreeing.append(reference["ref_id"])
            else:
                disagreeing.append(reference["ref_id"])
                disagreeingKeys.append(referenceSpecimen)
                referenceValues.append(f"{raw} ({reference['ref_id']})")

        if seriesValues:
            findings["holotype-series-vs-single-element"].append(
                f"{label}: ours {ours['specimenIds']} — reference calls the type a "
                f"series: {' | '.join(seriesValues)}")

        if disagreeing:
            findings[classify("holotype", disagreeing, agreeing, disagreeingKeys)].append(
                agreementNote(agreeing) + 
                f"{label}: ours {ours['specimenIds'][:4]} vs {' | '.join(referenceValues)}")

        # A country that contradicts ours means the occurrence cell belongs to
        # another taxon -- a local corruption of the PDF-to-markdown conversion,
        # measured at 2-4% of rows -- so its formation and age are equally
        # untrustworthy and the source is quarantined rather than compared.
        trusted = []

        for reference in references:
            occurrences = reference.get("occurrences") or []
            # A cell may list countries without a formation -- "Mongolia, China,
            # Russia" -- in which case only the last fragment was being read as
            # the country and the rest became a bogus formation. Every fragment
            # is therefore treated as a candidate country name.
            fragments = []

            for entry in occurrences:
                fragments.append(entry.get("country") or "")
                fragments.extend((entry.get("formation") or "").split(","))

            mappedIsos = {countryMap.get(fragment.strip().lower()) for fragment in fragments}
            mappedIsos.discard(None)

            if mappedIsos and ours.get("country") and ours["country"] not in mappedIsos:
                summary = "; ".join(f"{entry.get('formation')}, {entry.get('country')}"
                                    for entry in occurrences)
                findings["occurrence-row-suspect"].append(
                    f"{ours['binomial']} [{reference['ref_id']}]: reference reads "
                    f"'{summary}' but the taxon is {ours['country']} — cell misaligned "
                    f"or unparseable in the source markdown; quarantined")
            else:
                trusted.append(reference)

        agreeing, disagreeing, referenceValues, disagreeingKeys = [], [], [], []

        for reference in trusted:
            occurrences = reference.get("occurrences") or []
            names = [entry.get("formation") for entry in occurrences if entry.get("formation")]

            # A cell listing only countries leaves a country name sitting in the
            # formation slot ("Mongolia, China"); that is an absent formation.
            def isAllCountries(name):
                """True when every comma-separated fragment names a country."""
                fragments = [part.strip().lower() for part in name.split(",") if part.strip()]

                return bool(fragments) and all(part in countryMap for part in fragments)

            names = [name for name in names if not isAllCountries(name)]

            # A Dinosauria row whose wrapped cells merged several localities
            # yields one string naming two or more formations, which cannot be
            # compared as a single name.
            merged = [name for name in names
                      if len(re.findall(r"\b(formation|fm\.)\b", name, re.I)) > 1]

            if not ours.get("formation") or not names or merged:
                continue

            if any(formationsAgree(ours["formation"], name) for name in names):
                agreeing.append(reference["ref_id"])
            else:
                disagreeing.append(reference["ref_id"])
                disagreeingKeys.append(normalizeFormation(names[0]))
                referenceValues.append(f"{' / '.join(names)} ({reference['ref_id']})")

        if disagreeing:
            findings[classify("formation", disagreeing, agreeing, disagreeingKeys)].append(
                agreementNote(agreeing) + 
                f"{label}: ours '{ours['formation']}' vs {' | '.join(referenceValues)}")

        ourStages = {stage.strip().lower() for stage in ours["stages"] if stage} & stageVocabulary
        agreeing, disagreeing, referenceValues, disagreeingKeys = [], [], [], []

        for reference in trusted:
            referenceStages = splitStages(reference.get("stage"), stageVocabulary)

            if not ourStages or not referenceStages:
                continue

            if ourStages & referenceStages:
                agreeing.append(reference["ref_id"])
            else:
                disagreeing.append(reference["ref_id"])
                disagreeingKeys.append(",".join(sorted(referenceStages)))
                referenceValues.append(f"{reference['stage']} ({reference['ref_id']})")

        if disagreeing:
            findings[classify("stage", disagreeing, agreeing, disagreeingKeys)].append(
                agreementNote(agreeing) + 
                f"{label}: ours {sorted(ourStages)} vs {' | '.join(referenceValues)}")

    print(f"genus species records:      {len(speciesRecords)}")
    print(f"reference binomials:        {len(referenceRecords)}")
    print(f"matched on binomial:        {len(matched)}")
    print(f"country names mapped:       {len(countryMap)}")
    print()
    print("Findings by category:")

    for category in sorted(findings, key=lambda key: -len(findings[key])):
        print(f"  {category}: {len(findings[category])}")

    print(f"\nTotal findings: {sum(len(rows) for rows in findings.values())}")

    lines = ["# Tier 1 reference-record reconciliation", "",
             f"Matched {len(matched)} species against reference-work records.", "",
             "Every row is a QUESTION, not a defect: a reference work may corroborate a",
             "value but is never a primary source for it. Verify against the describing",
             "paper before changing anything.", "", "## Summary", ""]

    for category in sorted(findings, key=lambda key: -len(findings[key])):
        lines.append(f"- **{category}**: {len(findings[category])}")

    lines.append("")

    for category in sorted(findings, key=lambda key: -len(findings[category])):
        rows = findings[category]
        lines.append(f"## {category} ({len(rows)})")
        lines.append("")
        lines.extend(f"- {row}" for row in sorted(rows))
        lines.append("")

    out = os.path.join(audit_dir(), "reference-reconciliation.md")

    with open(out, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))

    print(f"Report: {os.path.relpath(out, DATA)}")

    for category in sorted(findings, key=lambda key: -len(findings[key])):
        print(f"\n--- {category} (first {args.limit}):")

        for row in sorted(findings[category])[:args.limit]:
            print(f"  {row}")


if __name__ == "__main__":
    main()
