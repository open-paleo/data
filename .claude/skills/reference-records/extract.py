#!/usr/bin/env python3
"""Tier 1 of the data-quality scan: distil the table-structured reference works
into per-genus records that every genus YAML can later be reconciled against.

This is deterministic parsing, NOT an LLM condensation. The three reference works
worth extracting all publish their systematics as markdown tables:

  jones2026a/b/c   4-column rows: taxon | size | specimens | occurrence.
                   The richest source and the only one carrying holotype
                   numbers, formation, country and age together. ~1,176 rows.
  weishampel2004a  63 tables headed "Occurrence | Age | Material". Carries no
                   holotype numbers and no explicit type-species designation --
                   those simply are not in the format -- so it complements Jones
                   rather than duplicating it. Caps at 2004.
  molina-perez*    "Species | Specimen | ..." record tables; specimen numbers.

paul2024a/b are deliberately excluded: they are narrative prose with no
systematics tables, so there is nothing here to parse.

Everything extracted is a CLAIM BY A REFERENCE WORK, never ground truth. A
reference work may corroborate a value but is not a primary source for it, so
reconciliation findings go to a human gate and Tier 2 settles disputes against
the describing paper.

Usage:
    python3 extract.py                 # extract every supported source
    python3 extract.py jones2026b      # just one
"""

import argparse
import hashlib
import json
import os
import re
import sys

from _paths import audit_dir, corpus_dir, data_dir

CORPUS = corpus_dir()
MARKDOWN = os.path.join(CORPUS, "markdown")
CACHE = os.path.join(audit_dir(), "reference-records")

SCHEMA_VERSION = 1

JONES_SOURCES = ("jones2026a", "jones2026b", "jones2026c")
WEISHAMPEL_SOURCES = ("weishampel2004a",)
MOLINA_PEREZ_SOURCES = ("molina-pérez2019a", "molina-pérez2020a")


def sha256(path):
    """Return the hex SHA-256 of a file, used to invalidate a stale cache.

    @param path: Absolute path to the file to digest.
    @returns: Hex digest string.
    """
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def stripMarkup(text):
    """Remove bold/italic markers, footnote anchors and link syntax from a cell.

    @param text: Raw markdown cell text.
    @returns: Plain text with collapsed whitespace.
    """
    cleaned = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = cleaned.replace("**", "").replace("*", "")
    return " ".join(cleaned.split())


def tableRows(path, columnCount):
    """Yield the cells of every pipe-table row with exactly `columnCount` cells.

    Separator rows (all dashes) are skipped. Cells keep their markdown, because
    the bold marker is meaningful in Jones -- it distinguishes the holotype from
    referred material.

    @param path: Absolute path to the markdown file.
    @param columnCount: Required number of cells for a row to be yielded.
    @returns: Generator of (lineNumber, [cell, ...]).
    """
    with open(path, encoding="utf-8", errors="replace") as handle:
        for lineNumber, line in enumerate(handle, start=1):
            stripped = line.strip()

            if not stripped.startswith("|"):
                continue

            cells = [cell.strip() for cell in stripped.strip("|").split("|")]

            if len(cells) != columnCount:
                continue
            elif all(re.fullmatch(r"[-: ]*", cell) for cell in cells):
                continue

            yield lineNumber, cells


def parseTaxonCell(cell):
    """Split a Jones taxon cell into binomial and authority.

    The cell reads "*Genus species* Authority, Year"; the binomial is the
    italicised run. Returns nulls rather than guessing when the shape does not
    match, so that parse failures stay visible instead of becoming bad data.

    @param cell: Raw taxon cell.
    @returns: Dict with genus, species, binomial and authority keys.
    """
    match = re.match(r"\s*\*([^*]+)\*\s*(.*)", cell)

    if not match:
        return {"genus": None, "species": None, "binomial": None, "authority": None}

    binomial = " ".join(match.group(1).split())
    authority = stripMarkup(match.group(2)) or None
    parts = binomial.split()

    genus = parts[0] if parts else None
    species = parts[1] if len(parts) > 1 else None

    # Only a capitalised, alphabetic first word is a usable genus; the tables
    # also carry heading rows ("Nomina dubia") and quoted provisional names.
    if not genus or not re.fullmatch(r"[A-Z][a-zÀ-ɏ-]+", genus):
        genus = None

    return {"genus": genus, "species": species, "binomial": binomial, "authority": authority}


def parseSizeCell(cell):
    """Extract length in metres and mass in kilograms from a Jones size cell.

    Handles the "**Length:** 2.3 m **Mass:** 42 kg" form, including tonne masses
    and comma-grouped digits.

    @param cell: Raw size cell.
    @returns: Dict with lengthM and massKg keys, either possibly None.
    """
    plain = stripMarkup(cell)
    lengthMatch = re.search(r"Length:\s*([\d.,]+)\s*(m|cm)\b", plain, re.I)
    massMatch = re.search(r"Mass:\s*([\d.,]+)\s*(kg|g|t|tonnes?)\b", plain, re.I)

    lengthM = None

    if lengthMatch:
        value = float(lengthMatch.group(1).replace(",", ""))
        lengthM = value / 100 if lengthMatch.group(2).lower() == "cm" else value

    massKg = None

    if massMatch:
        value = float(massMatch.group(1).replace(",", ""))
        unit = massMatch.group(2).lower()

        if unit.startswith("t"):
            massKg = value * 1000
        elif unit == "g":
            massKg = value / 1000
        else:
            massKg = value

    return {"lengthM": lengthM, "massKg": massKg}


def parseSpecimenCell(cell):
    """Pull the holotype and the referred specimens out of a Jones specimen cell.

    Jones sometimes bolds the holotype, e.g. "**BP/1/6235**-partial skull;
    BP/1/6XXX Series-fragments", but the convention is not applied consistently:
    249 of 394 rows in jones2026c carry no bold at all while still listing the
    type first. Across all three volumes the bolded number is the first-listed
    one in 400 of 431 bolded rows, and every exception is a number that merely
    contains a dash ("BMNH R1989-1992"). So bold is preferred where present and
    the first listed catalogue number is the fallback.

    @param cell: Raw specimen cell.
    @returns: Dict with holotype, holotypeMaterial, holotypeSource and referred.
    """
    boldMatch = re.search(r"\*\*([^*]+)\*\*", cell)
    holotype = " ".join(boldMatch.group(1).split()) if boldMatch else None
    holotypeSource = "bold" if holotype else None

    # An em/en dash separates a catalogue number from its material description.
    material = None

    if boldMatch:
        trailing = cell[boldMatch.end():]
        materialMatch = re.match(r"\s*[—–-]\s*([^;(]+)", trailing)

        if materialMatch:
            material = stripMarkup(materialMatch.group(1)) or None
    else:
        firstMatch = re.match(r"\s*([A-Z][^—–]{1,40}?)\s*[—–]\s*([^;(]+)", stripMarkup(cell))

        if firstMatch:
            holotype = " ".join(firstMatch.group(1).split())
            holotypeSource = "first-listed"
            material = stripMarkup(firstMatch.group(2)) or None

    referred = []

    for chunk in re.split(r";", stripMarkup(cell)):
        numberMatch = re.match(r"\s*([A-Z][A-Za-z0-9./\- ]{2,28}?)\s*[—–-]\s*", chunk)

        if numberMatch:
            number = " ".join(numberMatch.group(1).split())

            if number != holotype:
                referred.append(number)

    return {"holotype": holotype, "holotypeMaterial": material,
            "holotypeSource": holotypeSource, "referred": referred}


def parseOccurrenceCell(cell):
    """Split a Jones occurrence cell into occurrences plus period and stage.

    The cell reads "Upper Elliot Fm., South Africa *Early Jurassic, Sinemurian*".
    The italicised tail carries the age; what precedes it is one or more
    "formation, country" pairs separated by semicolons -- a taxon known from two
    countries gets "Udurchurkan Fm., Russia; Yuliangze Fm., China". Taking only
    the last pair silently mislabels such taxa, so every pair is kept and the
    first is exposed as the primary for convenience.

    @param cell: Raw occurrence cell.
    @returns: Dict with occurrences (list), formation, country, period and stage.
    """
    ageMatch = re.search(r"\*([^*]+)\*\s*$", cell.strip())
    age = stripMarkup(ageMatch.group(1)) if ageMatch else None
    head = stripMarkup(cell[:ageMatch.start()] if ageMatch else cell)

    period = None
    stage = None

    if age:
        ageParts = [part.strip() for part in age.split(",")]
        period = ageParts[0] or None
        stage = ageParts[1] if len(ageParts) > 1 else None

    occurrences = []

    for chunk in (part.strip() for part in head.split(";") if part.strip()):
        chunkParts = [part.strip() for part in chunk.split(",")]

        if len(chunkParts) >= 2:
            occurrences.append({"formation": ", ".join(chunkParts[:-1]) or None,
                                "country": chunkParts[-1] or None})
        else:
            occurrences.append({"formation": chunkParts[0] or None, "country": None})

    primary = occurrences[0] if occurrences else {"formation": None, "country": None}

    return {"occurrences": occurrences, "formation": primary["formation"],
            "country": primary["country"], "period": period, "stage": stage}


def extractJones(refId):
    """Extract every 4-column systematics row from one Jones 2026 volume.

    @param refId: Corpus reference id, e.g. "jones2026b".
    @returns: Dict cache record, or None when the source is not in the corpus.
    """
    path = os.path.join(MARKDOWN, f"{refId}.md")

    if not os.path.exists(path):
        return None

    records = []
    skipped = 0

    for lineNumber, cells in tableRows(path, 4):
        taxon = parseTaxonCell(cells[0])

        if not taxon["genus"]:
            skipped += 1
            continue

        record = {
            "line": lineNumber,
            **taxon,
            **parseSizeCell(cells[1]),
            **parseSpecimenCell(cells[2]),
            **parseOccurrenceCell(cells[3]),
        }
        records.append(record)

    return {
        "ref_id": refId,
        "source_file": os.path.relpath(path, CORPUS),
        "source_sha256": sha256(path),
        "schema_version": SCHEMA_VERSION,
        "extractor": "extract.py (deterministic table parse)",
        "layout": "jones-4col",
        "rows_extracted": len(records),
        "rows_skipped_no_genus": skipped,
        "records": records,
    }


def extractWeishampel(refId="weishampel2004a"):
    """Extract the systematic genus tables from The Dinosauria (2nd edition).

    The tables are "Taxon | Occurrence | Age | Material", with a genus row (no
    occurrence) followed by its species rows. Two quirks drive the parsing:

    * Cells WRAP across several markdown rows -- "H. ischigualastensis Reig,
      1963" carries "Ischigualasto Formation" while the next physical row holds
      "(including Ischisaurus cattoi Reig," and "(San Juan), Argentina". A record
      therefore accumulates until the next taxon row begins.
    * Species are abbreviated ("H. ischigualastensis"), so the genus is carried
      down from the most recent genus row.

    The format contains no holotype numbers and no explicit type-species
    designation, so those fields are absent by construction rather than missing.

    @param refId: Corpus reference id.
    @returns: Dict cache record, or None when the source is not in the corpus.
    """
    path = os.path.join(MARKDOWN, f"{refId}.md")

    if not os.path.exists(path):
        return None

    genusPattern = re.compile(r"^([A-Z][a-z]{2,})\s+[A-Z]")
    speciesPattern = re.compile(r"^([A-Z])\.\s*([a-z][a-z-]{2,})\b")

    records = []
    currentGenus = None
    pending = None

    def flush():
        """Close the accumulating record and keep it when it carries data."""
        if pending and (pending["formation"] or pending["stage"]):
            pending["formation"] = " ".join(pending["formation"].split()) or None
            pending["stage"] = " ".join(pending["stage"].split()) or None
            pending["material"] = " ".join(pending["material"].split()) or None
            records.append(pending)

    for lineNumber, cells in tableRows(path, 4):
        taxonCell = stripMarkup(cells[0].replace("<br>", " "))
        occurrence = stripMarkup(cells[1].replace("<br>", " "))
        age = stripMarkup(cells[2].replace("<br>", " "))
        material = stripMarkup(cells[3].replace("<br>", " "))

        genusMatch = genusPattern.match(taxonCell)
        speciesMatch = speciesPattern.match(taxonCell)

        if genusMatch and not speciesMatch:
            flush()
            pending = None
            currentGenus = genusMatch.group(1)
            continue
        elif speciesMatch and currentGenus and speciesMatch.group(1) == currentGenus[0]:
            flush()
            pending = {
                "line": lineNumber,
                "genus": currentGenus,
                "species": speciesMatch.group(2),
                "binomial": f"{currentGenus} {speciesMatch.group(2)}",
                "authority": None,
                "formation": occurrence,
                "stage": age,
                "material": material,
            }
            continue

        # Anything else continues the record above it, carrying wrapped text.
        if pending:
            pending["formation"] += " " + occurrence
            pending["stage"] += " " + age
            pending["material"] += " " + material

    flush()

    for record in records:
        record.update(splitOccurrenceText(record["formation"]))

    return {
        "ref_id": refId,
        "source_file": os.path.relpath(path, CORPUS),
        "source_sha256": sha256(path),
        "schema_version": SCHEMA_VERSION,
        "extractor": "extract.py (deterministic table parse)",
        "layout": "weishampel-4col",
        "rows_extracted": len(records),
        "rows_skipped_no_genus": 0,
        "records": records,
    }


def splitOccurrenceText(text):
    """Split a Dinosauria occurrence string into occurrences of formation+country.

    The column reads "Dinosaur Park Formation (Alberta), Canada; Judith River
    Formation (Montana), United States" -- semicolon-separated, each entry a
    formation with a parenthesised region and a trailing country.

    @param text: Raw joined occurrence text, or None.
    @returns: Dict with occurrences, formation and country keys.
    """
    occurrences = []

    for chunk in (part.strip() for part in (text or "").split(";") if part.strip()):
        withoutRegion = re.sub(r"\([^)]*\)", " ", chunk)
        parts = [part.strip() for part in withoutRegion.split(",") if part.strip()]

        if len(parts) >= 2:
            occurrences.append({"formation": " ".join(parts[:-1]).strip() or None,
                                "country": parts[-1] or None})
        elif parts:
            occurrences.append({"formation": parts[0], "country": None})

    primary = occurrences[0] if occurrences else {"formation": None, "country": None}

    return {"occurrences": occurrences, "formation": primary["formation"],
            "country": primary["country"]}


def trimSpecimenQualifiers(value):
    """Cut an ontogeny or age qualifier off the end of a specimen cell.

    The Molina-Perez tables append the specimen's growth stage or age to the same
    cell -- "MLP 77-V-29-1 Indeterminate age", "QG 1 Adult" -- which is not part
    of the catalogue number and makes the value spuriously extend our own.

    @param value: Candidate specimen string, or None.
    @returns: The value up to the first qualifier word, stripped.
    """
    if not value:
        return value

    match = re.search(r"\s+(indetermin\w*|undetermin\w*|adult|juvenile|subadult|"
                      r"immature|unknown age|age)\b", value, re.I)

    return value[:match.start()].strip() if match else value


def looksLikeCatalogueNumber(value):
    """Reject anything that is not plausibly a specimen catalogue number.

    The Molina-Perez tables reuse the column beside a binomial for several
    purposes, so the same position may hold "BMNH R1527", a period-and-region
    code like "UJ, England", a Spanish label like "Holotipo", or a note such as
    "IFG uncatalogued". Requiring a digit and forbidding commas discriminates
    these cleanly.

    @param value: Candidate specimen string, or None.
    @returns: True when the value is plausibly a catalogue number.
    """
    if not value or "," in value or len(value) > 40:
        return False
    elif not re.search(r"\d", value):
        return False
    elif re.search(r"uncatalogued|holotip|unnumbered|various|col\.", value, re.I):
        return False

    return bool(re.match(r"[A-Za-z][A-Za-z0-9 ./()\-]*$", value))


def extractMolinaPerez(refId):
    """Extract specimen records from the Molina-Perez & Larramendi volumes.

    These volumes carry a dozen different table layouts -- "Species | Specimen |
    ...", "Genus and species | Specimen | Leg length ...", "Year | Species and
    specimen | ...", and several with no specimen column at all. Parsing by
    position rather than by header therefore reads locality codes and Spanish
    labels as catalogue numbers, so each table block's own header row decides
    which columns to read, and every candidate is shape-checked before it is
    kept.

    @param refId: Corpus reference id.
    @returns: Dict cache record, or None when the source is not in the corpus.
    """
    path = os.path.join(MARKDOWN, f"{refId}.md")

    if not os.path.exists(path):
        return None

    speciesHeaders = ("species", "genus and species", "name", "species and specimen")

    records = []
    skipped = 0
    speciesIndex = None
    specimenIndex = None
    combined = False

    with open(path, encoding="utf-8", errors="replace") as handle:
        for lineNumber, line in enumerate(handle, start=1):
            stripped = line.strip()

            if not stripped.startswith("|"):
                speciesIndex = None
                specimenIndex = None
                combined = False
                continue

            cells = [cell.strip() for cell in stripped.strip("|").split("|")]
            plain = [stripMarkup(cell).lower() for cell in cells]

            if all(re.fullmatch(r"[-: ]*", cell) for cell in cells):
                continue

            # A header row re-arms the block with fresh column positions.
            if any(name in speciesHeaders for name in plain):
                speciesIndex = next(i for i, name in enumerate(plain) if name in speciesHeaders)
                specimenIndex = next((i for i, name in enumerate(plain)
                                      if name.startswith("specimen")), None)
                combined = plain[speciesIndex] == "species and specimen"
                continue
            elif speciesIndex is None or speciesIndex >= len(cells):
                continue

            taxonMatch = re.match(r"\s*\*([^*]+)\*\s*(.*)", cells[speciesIndex])

            if not taxonMatch:
                skipped += 1
                continue

            parts = taxonMatch.group(1).split()

            if len(parts) < 2 or not re.fullmatch(r"[A-Z][a-zÀ-ɏ-]+", parts[0]):
                skipped += 1
                continue

            if specimenIndex is not None and specimenIndex < len(cells):
                candidate = stripMarkup(cells[specimenIndex])
            elif combined:
                candidate = stripMarkup(taxonMatch.group(2))
            else:
                candidate = None

            candidate = trimSpecimenQualifiers(candidate)
            specimen = candidate if looksLikeCatalogueNumber(candidate) else None

            records.append({
                "line": lineNumber,
                "genus": parts[0],
                "species": parts[1],
                "binomial": f"{parts[0]} {parts[1]}",
                "authority": None,
                "holotype": specimen,
                "holotypeSource": "specimen-column" if specimen else None,
                "occurrences": [],
                "formation": None,
                "country": None,
                "stage": None,
            })

    return {
        "ref_id": refId,
        "source_file": os.path.relpath(path, CORPUS),
        "source_sha256": sha256(path),
        "schema_version": SCHEMA_VERSION,
        "extractor": "extract.py (deterministic table parse)",
        "layout": "molina-perez-header-driven",
        "rows_extracted": len(records),
        "rows_skipped_no_genus": skipped,
        "records": records,
    }


def summarise(cache):
    """Print a per-source field-coverage summary so gaps are visible up front.

    @param cache: A cache record produced by an extractor.
    @returns: Nothing.
    """
    records = cache["records"]
    total = len(records)

    print(f"  {cache['ref_id']}: {total} records "
          f"({cache['rows_skipped_no_genus']} rows skipped, no parseable genus)")

    if total == 0:
        return

    for field in ("species", "authority", "holotype", "formation", "country", "stage",
                  "lengthM", "massKg"):
        filled = sum(1 for record in records if record.get(field) not in (None, "", []))
        print(f"      {field:12} {filled:5}/{total}  {100 * filled / total:5.1f}%")


def main():
    parser = argparse.ArgumentParser(description="Extract reference-work systematics tables")
    parser.add_argument("sources", nargs="*", default=None,
                        help="reference ids to extract (default: all supported)")
    args = parser.parse_args()

    requested = args.sources or list(JONES_SOURCES + WEISHAMPEL_SOURCES + MOLINA_PEREZ_SOURCES)
    os.makedirs(CACHE, exist_ok=True)

    for refId in requested:
        if refId in JONES_SOURCES:
            cache = extractJones(refId)
        elif refId in WEISHAMPEL_SOURCES:
            cache = extractWeishampel(refId)
        elif refId in MOLINA_PEREZ_SOURCES:
            cache = extractMolinaPerez(refId)
        else:
            sys.exit(f"no extractor registered for {refId!r}")

        if cache is None:
            print(f"  {refId}: NOT in corpus, skipped")
            continue

        summarise(cache)

        out = os.path.join(CACHE, f"{refId}.json")

        with open(out, "w", encoding="utf-8") as handle:
            json.dump(cache, handle, indent=2, ensure_ascii=False)

    print(f"\ncache -> {os.path.relpath(CACHE, data_dir())}")


if __name__ == "__main__":
    main()
