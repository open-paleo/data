#!/usr/bin/env python3
"""Tier 1 reconciliation: compare every genus YAML against the reference-work
records extracted by extract.py, and report the disagreements.

Nothing here is ground truth. A reference work may corroborate a value but is
never a primary source for it, so every finding is a QUESTION for a human gate,
and Tier 2 settles it against the describing paper. In particular a mismatch is
just as likely to be the reference work being wrong, or lagging, as us.

Matching is at species level, since the reference tables are one row per species.
An exact binomial join drops any row whose epithet the reference work misspells,
and it drops it silently across every bucket at once -- jones2026a prints
"Anoplosaurus cartonotus" for curtonotus, taking its correct Albian age and its
lectotype number with it. So an exact miss falls back to a same-genus,
near-epithet match, reported separately and marked with `~` so a reader can tell
a fuzzy join from a clean one.

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

from _formations import loadVariants
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
    """Fold a catalogue number: uppercase, strip punctuation, unpad numbers.

    "MCF-PVPH-236", "MCF PVPH 236" and "mcf/pvph/236" all fold together, so that
    only genuinely different numbers are reported. Leading zeros are dropped
    from each numeric run for the same reason: "CMN 0491" and "CMN 491" are one
    specimen written two ways, as are "TMP 2002.068.0001" and "TMP 2002.68.1".

    @param value: Raw specimen string, or None.
    @returns: A normalized key, empty when nothing usable remains.
    """
    if not value:
        return ""

    stripped = re.sub(r"[^A-Z0-9]+", " ", str(value).upper())
    unpadded = re.sub(r"\b0+(\d)", r"\1", stripped)

    return unpadded.replace(" ", "")


def loadStageOrder():
    """Return the project's stage names in order, oldest first.

    Needed to expand a range: "Berriasian-Hauterivian" names its endpoints only,
    and without the stages between them our Valanginian reads as a disagreement
    with a cell that in fact contains it.

    @returns: Dict of lowercased stage name to its index, oldest first.
    """
    schema = yaml.safe_load(open(os.path.join(DATA, "schema.yml"), encoding="utf-8"))

    return {str(name).lower(): index for index, name in enumerate(schema.get("stages") or {})}


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


def splitStages(value, vocabulary, order=None):
    """Extract the recognised stage names from a reference-work age cell.

    The works write ages many ways -- "Hettangian/Sinemurian", "Maastrichtian
    Age", "?late Campanian or Maastrichtian", "(?)" -- so the string is split on
    every plausible separator and only tokens present in the project vocabulary
    are kept. An empty result means "no usable age", never "disagrees".

    A dash between two stages means a RANGE, and the stages between them belong
    to it: "Berriasian-Hauterivian" covers the Valanginian, so reading only the
    endpoints turns a source that agrees with us into one that disagrees. Slashes
    and "or" are left alone -- those offer alternatives rather than a span.

    @param value: Raw stage string, or None.
    @param vocabulary: Set of valid lowercased stage names.
    @param order: Optional stage-name to index map used to expand ranges.
    @returns: Set of recognised lowercased stage names.
    """
    if not value:
        return set()

    text = str(value).lower()
    tokens = re.split(r"[^A-Za-z]+| or | and | to ", text)
    found = {token for token in tokens if token in vocabulary}

    if order:
        qualifiers = r"(?:\?|late |early |middle |lower |upper |\s)*"
        span = re.compile(rf"([a-z]+(?:ian|ium))\s*[-\u2013\u2014]\s*{qualifiers}([a-z]+(?:ian|ium))")

        for match in span.finditer(text):
            first, second = match.group(1), match.group(2)

            if first in order and second in order:
                low, high = sorted((order[first], order[second]))
                found |= {name for name, index in order.items() if low <= index <= high}

    return found


def loadFormationVariants():
    """Load formation spellings already reviewed as variants of one name.

    These stay in the report under their own REVIEWED heading rather than being
    suppressed: reporting them separately means a spelling NOT on the list
    stands out as new. Spellings live in the repo-level formations.yaml, which
    also records each unit's rank.

    @returns: Dict of normalized our-form -> set of normalized variant forms.
    """
    document = loadVariants()

    return {normalizeFormation(ours): {normalizeFormation(v) for v in variants}
            for ours, variants in document.items()}


def loadAdjudicated():
    """Load findings already settled against a primary paper, so they stay closed.

    A reference work disagreeing with us is not evidence that we are wrong: of
    the first 20 series findings triaged, 5 were the reference work folding
    referred material, paratypes or hypodigm into the type. Once a primary has
    been read and quoted, the finding is recorded in adjudicated.yml and
    suppressed here rather than resurfacing every run.

    @returns: Dict of binomial -> set of suppressed category prefixes.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "adjudicated.yml")

    if not os.path.exists(path):
        return {}

    raw = open(path, encoding="utf-8").read()
    document = yaml.safe_load(raw) or {}

    # YAML keeps the last of two entries under one key and says nothing, so a
    # second block for a binomial silently discards the first -- which is how an
    # occurrence adjudication once cancelled that taxon's holotype one. Findings
    # for a binomial belong in ONE entry with several categories.
    written = re.findall(r"^([^\s#][^\n:]*):$", raw, re.M)
    duplicates = {name for name in written if written.count(name) > 1}

    if duplicates:
        raise SystemExit(f"adjudicated.yml has duplicate keys: {sorted(duplicates)}")

    # A binomial may need two adjudications that rest on different papers -- a
    # holotype settled against its erecting paper, a formation settled against
    # the stratigraphic literature -- so an entry may be a list of blocks, each
    # carrying its own source and quotation. Categories union across them.
    settled = {}

    for name, entry in document.items():
        blocks = entry if isinstance(entry, list) else [entry]
        settled[name] = {category
                         for block in blocks if isinstance(block, dict)
                         for category in (block.get("categories") or [])}

    return settled


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

        # Collection codes resolve to their parent institution too, which is
        # what lets "MPC-D 100/130" and "IGM 100/130" compare equal.
        for collection in (entry.get("collections") or []):
            mapping[str(collection).upper().replace("-", "").replace(" ", "")] = code

    return mapping


def foldSpecimen(value, aliases):
    """Normalize a catalogue number, resolving its institution prefix to canonical.

    @param value: Raw catalogue number, or None.
    @param aliases: Mapping from loadInstitutionAliases().
    @returns: Normalized comparison key, empty when nothing usable remains.
    """
    if not value:
        return ""

    # Descriptive words ride along in values like "ISI R273 series" and would
    # otherwise defeat containment against our expanded element list.
    cleaned = re.sub(r"\b(series|specimens?|various)\b", " ", str(value), flags=re.I)

    match = re.match(r"\s*([A-Za-z][A-Za-z.\-]*)\s*(.*)", cleaned)

    if not match:
        return normalizeSpecimen(cleaned)

    code = match.group(1).upper().replace(".", "").replace("-", "")
    remainder = match.group(2)

    # A sub-collection code may be glued to the institution ("ISIR 335/1") or
    # written as a separate token ("ISI R335/1-65"), and folding only the leading
    # token loses the collection letters on one side but not the other. Peel
    # leading runs of letters off the remainder while each one extends the code
    # into another known alias, so both spellings reduce to the same key. The
    # loop matters for multi-token prefixes: "NHMUK PV R 9951" needs two peels
    # before it resolves the way "NHMUK R9951" does in one.
    while True:
        peeled = re.match(r"\s*([A-Za-z]+)(.*)", remainder, re.S)

        if not peeled or code + peeled.group(1).upper() not in aliases:
            break

        code = code + peeled.group(1).upper()
        remainder = peeled.group(2)

    # NOTE: an unknown code is often a registered institution carrying an
    # UNREGISTERED collection suffix -- "MPC-D" for MPC, "NHMUK PV OR" for
    # NHMUK -- and folding those would clear several findings. Trimming to the
    # longest known prefix was tried and reverted: it cannot tell a collection
    # code from part of the number, so it dropped the P of "NMMNH-P3690" and
    # invented a CORROBORATED finding against "NMMNH P-3690". Distinguishing
    # the two needs a registry of collection codes, which is #2014.
    return normalizeSpecimen(aliases.get(code, code) + " " + remainder)


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


def epithetDistance(first, second, ceiling):
    """Levenshtein distance between two species epithets, bounded for speed.

    @param first: One epithet, lowercased.
    @param second: The other epithet, lowercased.
    @param ceiling: Distance above which the exact value stops mattering.
    @returns: The edit distance, or ceiling + 1 once it is certain to exceed it.
    """
    if abs(len(first) - len(second)) > ceiling:
        return ceiling + 1

    previous = list(range(len(second) + 1))

    for firstIndex, firstCharacter in enumerate(first, 1):
        current = [firstIndex]

        for secondIndex, secondCharacter in enumerate(second, 1):
            current.append(min(previous[secondIndex] + 1,
                               current[secondIndex - 1] + 1,
                               previous[secondIndex - 1] + (firstCharacter != secondCharacter)))

        if min(current) > ceiling:
            return ceiling + 1

        previous = current

    return previous[-1]


def allowedDistance(epithet):
    """How far an epithet may differ before the match stops being a typo.

    Two edits on a short epithet rewrites half of it, so the allowance scales
    with length rather than being flat.

    @param epithet: Our epithet, lowercased.
    @returns: Maximum edit distance treated as a misspelling of this epithet.
    """
    return 1 if len(epithet) < 6 else 2


def buildFuzzyIndex(referenceRecords, ourBinomials):
    """Group reference binomials by genus for the near-epithet fallback.

    Reference keys that already name one of our species exactly are excluded: a
    row for a species we hold is a real row for that species, never a
    misspelling of a sibling.

    @param referenceRecords: Dict of lowercased binomial -> list of records.
    @param ourBinomials: Set of our lowercased binomials.
    @returns: Dict of lowercased genus -> list of (epithet, referenceKey).
    """
    byGenus = collections.defaultdict(list)

    for key in referenceRecords:
        if key in ourBinomials:
            continue

        parts = key.split(" ", 1)

        if len(parts) == 2 and parts[1]:
            byGenus[parts[0]].append((parts[1], key))

    return byGenus


def findFuzzyMatches(binomial, fuzzyIndex, ourEpithetsByGenus):
    """Find reference keys that plausibly misspell this species.

    A candidate close to two of our species in the same genus is dropped rather
    than guessed at: it tells us nothing about which was meant, and a wrong join
    is worse than a missing one -- it would attribute another species' holotype
    and age to this record.

    @param binomial: Our binomial, lowercased.
    @param fuzzyIndex: Genus -> list of (epithet, referenceKey) candidates.
    @param ourEpithetsByGenus: Genus -> list of our epithets in that genus.
    @returns: List of candidate reference keys, possibly empty.
    """
    parts = binomial.split(" ", 1)

    if len(parts) != 2 or not parts[1]:
        return []

    genus, epithet = parts
    ceiling = allowedDistance(epithet)
    hits = []

    for candidate, key in fuzzyIndex.get(genus, []):
        if epithetDistance(epithet, candidate, ceiling) > ceiling:
            continue

        # The candidate must be nearer to us than to any sibling we also hold,
        # or it is as likely to be that sibling's row as it is to be ours.
        rivals = [other for other in ourEpithetsByGenus.get(genus, [])
                  if other != epithet
                  and epithetDistance(other, candidate, ceiling) <= ceiling]

        if not rivals:
            hits.append(key)

    return hits


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

    adjudicated = loadAdjudicated()
    formationVariants = loadFormationVariants()
    institutionAliases = loadInstitutionAliases()
    stageVocabulary = loadStageVocabulary()
    stageOrder = loadStageOrder()
    referenceRecords = loadReferenceRecords()
    speciesRecords = loadSpeciesRecords()

    ourBinomials = {record["binomial"].lower() for record in speciesRecords}
    ourEpithetsByGenus = collections.defaultdict(list)

    for binomial in ourBinomials:
        parts = binomial.split(" ", 1)

        if len(parts) == 2 and parts[1]:
            ourEpithetsByGenus[parts[0]].append(parts[1])

    fuzzyIndex = buildFuzzyIndex(referenceRecords, ourBinomials)
    matched = []
    fuzzyJoins = []

    for record in speciesRecords:
        binomial = record["binomial"].lower()
        candidates = list(referenceRecords.get(binomial) or [])

        # Resolved per reference work, not once for the species. A work that
        # spells the binomial correctly contributes its exact row; a work that
        # misspells it is otherwise dropped even though the others matched --
        # which is how jones2026a's "cartonotus" row went unseen while
        # weishampel2004a's "curtonotus" row matched cleanly.
        alreadyMatched = {reference["ref_id"] for reference in candidates}
        bySource = collections.defaultdict(list)

        for key in findFuzzyMatches(binomial, fuzzyIndex, ourEpithetsByGenus):
            for reference in referenceRecords[key]:
                if reference["ref_id"] not in alreadyMatched:
                    bySource[reference["ref_id"]].append((key, reference))

        for refId, entries in bySource.items():
            # One work offering two near spellings cannot be resolved: either is
            # as good a candidate as the other, and picking one invents a fact.
            if len({key for key, _ in entries}) != 1:
                continue

            for key, reference in entries:
                # Tagged on the record rather than tracked alongside it, so the
                # marker survives into every bucket the row feeds without
                # threading a second value through each comparison.
                candidates.append(dict(reference, fuzzyBinomial=key))
                fuzzyJoins.append((record["binomial"], key, refId))

        if candidates:
            matched.append((record, candidates))

    # Occurrence-level countries are fed in as well as the row's headline
    # country. A row listing several countries only exposes the first at the top
    # level, so names like "Belgium" would never enter the map and a cell naming
    # one would read as unmappable rather than as ours.
    countryMap = buildCountryMap(
        [(reference.get("country"), ours.get("country"))
         for ours, references in matched for reference in references]
        + [(entry.get("country"), ours.get("country"))
           for ours, references in matched for reference in references
           for entry in (reference.get("occurrences") or [])])

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
        settled = adjudicated.get(ours["binomial"], set())
        sourceIds = ",".join(sorted({
            reference["ref_id"] + ("~" if reference.get("fuzzyBinomial") else "")
            for reference in references}))
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

        if seriesValues and "holotype" not in settled:
            findings["holotype-series-vs-single-element"].append(
                f"{label}: ours {ours['specimenIds']} — reference calls the type a "
                f"series: {' | '.join(seriesValues)}")

        if disagreeing:
            if "holotype" not in settled:
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

            # Splitting on commas alone misses a country sitting mid-string,
            # which is exactly what a wrapped cell produces: "Los Colorados
            # Formation Argentina Lower Elliot Formation ...". The whole cell is
            # therefore also scanned for country names on word boundaries, so a
            # taxon occurring in several countries, or a cell that kept its own
            # occurrence first and swallowed the following rows, still resolves
            # to ours. Without this, 28 sound rows were quarantined and their
            # formation and age discarded with them.
            cellText = " ".join(fragments).lower()
            mappedIsos |= {iso for name, iso in countryMap.items()
                           if re.search(rf"(?<![a-z]){re.escape(name)}(?![a-z])", cellText)}

            if mappedIsos and ours.get("country") and ours["country"] not in mappedIsos:
                if "occurrence" not in settled:
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
            known = formationVariants.get(normalizeFormation(ours.get("formation")), set())
            reviewed = bool(disagreeingKeys) and all(key in known for key in disagreeingKeys)
            category = ("formation-differs-known-spelling-variant-REVIEWED"
                        if reviewed
                        else classify("formation", disagreeing, agreeing, disagreeingKeys))

            if "formation" not in settled:
                findings[category].append(
                agreementNote(agreeing) + 
                f"{label}: ours '{ours['formation']}' vs {' | '.join(referenceValues)}")

        ourStages = {stage.strip().lower() for stage in ours["stages"] if stage} & stageVocabulary
        agreeing, disagreeing, referenceValues, disagreeingKeys = [], [], [], []

        for reference in trusted:
            referenceStages = splitStages(reference.get("stage"), stageVocabulary, stageOrder)

            if not ourStages or not referenceStages:
                continue

            if ourStages & referenceStages:
                agreeing.append(reference["ref_id"])
            else:
                disagreeing.append(reference["ref_id"])
                disagreeingKeys.append(",".join(sorted(referenceStages)))
                referenceValues.append(f"{reference['stage']} ({reference['ref_id']})")

        if disagreeing:
            if "stage" not in settled:
                findings[classify("stage", disagreeing, agreeing, disagreeingKeys)].append(
                agreementNote(agreeing) + 
                f"{label}: ours {sorted(ourStages)} vs {' | '.join(referenceValues)}")

    print(f"genus species records:      {len(speciesRecords)}")
    print(f"reference binomials:        {len(referenceRecords)}")
    print(f"matched on binomial:        {len(matched)}")
    print(f"  of those, fuzzy-joined:   {len({join[0] for join in fuzzyJoins})}")
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
             "paper before changing anything.", "",
             "Categories ending **-REVIEWED** have already been looked at and need no",
             "re-triage; they remain listed only because a decision is pending elsewhere.",
             "Findings settled against a primary paper are suppressed entirely via",
             "`adjudicated.yml`, which records the quotation that closed each one.", "",
             "- `formation-differs-known-spelling-variant-REVIEWED` — compared 2026-07-30 and",
             "  found to be variant spellings of one unit, not different units. Choosing a",
             "  canonical form is deferred to #2012 (formations registry). A spelling NOT in",
             "  `formations.yaml` is new and does need review.", "",
             "A source id marked `~` was joined on a near-epithet match, not an exact one,",
             "because the reference work misspells the binomial. Check the pairing in",
             "\"Fuzzy binomial joins\" below before trusting a finding that rests on one.", "",
             "## Summary", ""]

    for category in sorted(findings, key=lambda key: -len(findings[key])):
        lines.append(f"- **{category}**: {len(findings[category])}")

    lines.append("")

    if fuzzyJoins:
        lines.append(f"## Fuzzy binomial joins ({len({join[0] for join in fuzzyJoins})})")
        lines.append("")
        lines.append("Our binomial matched no reference row exactly, so it was joined to a")
        lines.append("same-genus row whose epithet is within one or two edits. Each pairing is")
        lines.append("a claim that the reference work misspelled the name; a wrong one silently")
        lines.append("attributes another species' values to this record.")
        lines.append("")

        for binomial, key, refId in sorted(set(fuzzyJoins)):
            lines.append(f"- `{binomial}` ← *{key}* ({refId})")

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
