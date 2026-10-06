#!/usr/bin/env python3
"""Check quoted passages against the papers they cite.

A reference note quotes the paper it belongs to, and a research note's Evidence
line quotes the paper its id names. This matches each quotation's words, in
order, against that paper's markdown in the corpus, and reports the ones it
cannot find. It catches a quotation that ends early, one attributed to the
wrong paper, and one typed from memory, none of which the validator can see
without the corpus.

Corpus markdown interleaves inline citations, figure references and OCR noise
inside the sentences we quote, so an exact substring test produces mostly false
alarms. Words are matched in order with bounded gaps for elided citations, and a
quotation is suspect only when a word cannot be found or the gaps grow too large
to be elision. Expect a few standing misses from OCR damage; read the paper
before changing a quotation.

Usage:
    python3 verify-quotes.py                # registry, genera, clades, research
    python3 verify-quotes.py research/genera/A/Abrictosaurus.md stratigraphy/k/kota.yml

Writes scratch/audit/quote-check.md and prints a summary.
"""

import glob
import os
import re
import sys
import unicodedata

import yaml

from _paths import audit_dir, corpus_dir, data_dir

DATA = data_dir()
MARKDOWN = os.path.join(corpus_dir(), "markdown")

# Quotations shorter than this are usually a single term ("Lower Member"),
# which matches anywhere and proves nothing.
minimumLength = 25

# How many source words may separate two consecutive quoted words before the
# gap stops looking like an elided citation.
maximumGap = 14

# A research note's Evidence line: "- id, p. 12: "quotation"".
evidenceLine = re.compile(r"^- ([a-zÀ-ɏ'’-]+\d{4}[a-z]),[^\n]*$", re.M)


letterMap = str.maketrans({"ı": "i", "ł": "l", "Ł": "L", "ø": "o", "Ø": "O", "đ": "d", "ß": "ss", "æ": "ae", "œ": "oe"})


def words(text):
    """Reduce a string to comparable words.

    @param text: The string to reduce.
    @returns: Lowercase, unaccented alphanumeric words.
    """
    stripped = re.sub(r"<[^>]{0,40}>", " ", text)
    # Rejoin words the conversion broke across lines ("un-\nknown"), and map the
    # letters NFKD does not decompose, such as the dotless ı that renders "Río"
    # as "Ŕıo" in some converted papers.
    stripped = re.sub(r"(\w)[-\u00ad]\s*\n\s*(\w)", r"\1\2", stripped).replace("\u00ad", "")
    stripped = stripped.translate(letterMap)
    folded = unicodedata.normalize("NFKD", stripped)
    folded = "".join(character for character in folded if not unicodedata.combining(character))
    return re.findall(r"[a-z0-9]+", folded.lower())


sourceCache = {}


def sourceWords(key):
    """Load every corpus file for one reference key as a word list.

    Supplements and the original-language text count as the same paper, so a
    quotation translated from the original or taken from a supplement matches.

    @param key: The reference id.
    @returns: The source's words, or None when the corpus holds no file for it.
    """
    if key in sourceCache:
        return sourceCache[key]

    paths = [candidate for candidate in glob.glob(os.path.join(MARKDOWN, f"{key}*.md"))
             + glob.glob(os.path.join(MARKDOWN, "supplementary", f"{key}*.md"))
             if os.path.basename(candidate)[:-3].split(".")[0].split("_")[0] == key]
    text = " ".join(open(candidate, encoding="utf-8", errors="ignore").read() for candidate in paths)
    sourceCache[key] = words(text) if paths else None
    return sourceCache[key]


def locate(quote, source):
    """Match a quotation's words in order somewhere in the source.

    @param quote: The quotation's words.
    @param source: The source's words.
    @returns: (matched count, first unmatched word); matched equals len(quote)
        when the whole quotation is accounted for.
    """
    best = (0, quote[0] if quote else None)

    for start in (index for index, word in enumerate(source) if word == quote[0]):
        cursor = start + 1
        matched = 1

        for word in quote[1:]:
            window = source[cursor:cursor + maximumGap]

            if word not in window:
                break

            cursor += window.index(word) + 1
            matched += 1

        if matched > best[0]:
            best = (matched, quote[matched] if matched < len(quote) else None)

        if best[0] == len(quote):
            break

    return best


def quotations(text):
    """Return the quoted spans in a string that are long enough to test.

    A quotation marked "(translated)" just after it is our English rendering of
    a non-English passage, so its words are not the paper's and it is skipped.

    @param text: The prose.
    @returns: The quotations, without their quote marks.
    """
    flat = " ".join(str(text).split())
    found = []

    for match in re.finditer(r'"([^"]+)"', flat):
        if len(match.group(1)) < minimumLength:
            continue

        if re.match(r"[^\w\"]{0,4}\(?translated", flat[match.end():match.end() + 20]):
            continue

        found.append(match.group(1))

    return found


def referencePairs(record, label):
    """Yield (label, id, quotation) for every quotation in a record's reference
    notes, descending into nested beds.

    @param record: A parsed genus, clade or registry unit.
    @param label: How a finding names the record.
    @returns: A generator of (label, id, quotation).
    """
    for pointer in record.get("references") or []:
        if isinstance(pointer, dict) and pointer.get("id") and pointer.get("notes"):
            for quote in quotations(pointer["notes"]):
                yield (label, pointer["id"], quote)

    for bed in record.get("beds") or []:
        yield from referencePairs(bed, f"{label} › {bed.get('name')}")


def researchPairs(path):
    """Yield (label, id, quotation) for every quotation on a research note's
    Evidence lines.

    @param path: The research note.
    @returns: A generator of (label, id, quotation).
    """
    label = os.path.relpath(path, DATA)
    text = open(path, encoding="utf-8").read().split("\n## References")[0]

    for match in evidenceLine.finditer(text):
        for quote in quotations(match.group(0)):
            yield (label, match.group(1), quote)


def pairsFor(path):
    """Yield every (label, id, quotation) in one file.

    @param path: A research note, or a genus, clade or registry YAML file.
    @returns: A generator of (label, id, quotation).
    """
    if path.endswith(".md"):
        yield from researchPairs(path)
        return

    record = yaml.safe_load(open(path, encoding="utf-8")) or {}
    yield from referencePairs(record, os.path.relpath(path, DATA))


def main():
    """Check the files named on the command line, or every file, and report."""
    if len(sys.argv) > 1:
        paths = [os.path.join(DATA, argument) for argument in sys.argv[1:]]
    else:
        paths = sorted(glob.glob(os.path.join(DATA, "stratigraphy", "*", "*.yml"))
                       + glob.glob(os.path.join(DATA, "genera", "*", "*.yml"))
                       + glob.glob(os.path.join(DATA, "clades", "*.yml"))
                       + glob.glob(os.path.join(DATA, "research", "**", "*.md"), recursive=True))
        paths = [path for path in paths if os.path.basename(path) not in ("README.md", "methods.md")]

    checked = 0
    absent = set()
    suspect = []

    for path in paths:
        for label, key, quote in pairsFor(path):
            source = sourceWords(key)

            if source is None:
                absent.add(key)
                continue

            # An ellipsis marks words left out, however many, so each part of
            # an elided quotation is matched on its own.
            parts = [words(part) for part in re.split(r"…|\.\.\.|\[\.\.\.\]", quote)]
            parts = [part for part in parts if part]

            if not parts:
                continue

            checked += 1
            total = sum(len(part) for part in parts)
            matched = 0
            stuck = None

            for part in parts:
                partMatched, partStuck = locate(part, source)
                matched += partMatched

                if partMatched < len(part):
                    stuck = partStuck
                    break

            if matched < total:
                suspect.append((label, key, quote, matched, total, stuck))

    lines = [
        "# Quotation check",
        "",
        f"Checked {checked} quotations against the papers they cite. {len(suspect)} could not be matched.",
        "",
        "A miss means the quotation's words were not found in order in the paper's corpus",
        "markdown. Read the paper before changing anything: OCR damage and conversion",
        "defects cause some misses, and a quotation translated from a non-English paper",
        "matches only if the original is in the corpus.",
        "",
    ]

    for label, key, quote, matched, total, stuck in suspect:
        lines.append(f"- [ ] **{label}** `{key}`: {matched}/{total} words, stuck at `{stuck}`")
        lines.append(f"  > {quote[:200]}")

    if absent:
        lines += ["", f"Not in the corpus, so not checked: {', '.join(sorted(absent))}"]

    os.makedirs(audit_dir(), exist_ok=True)
    report = os.path.join(audit_dir(), "quote-check.md")
    open(report, "w", encoding="utf-8").write("\n".join(lines) + "\n")

    print(f"checked {checked} quotations; {len(suspect)} not matched; {len(absent)} cited works not in the corpus")
    print(f"report: {os.path.relpath(report, DATA)}")


if __name__ == "__main__":
    main()
