#!/usr/bin/env python3
"""Source-quality preflight for the formations.yaml citation audit (#2069).

Tier-0's checks are exact-string tests against corpus markdown, and four
extraction artifacts silently change their answer rather than failing loudly.

Two of them are REPAIRED here rather than reported, because they are pure noise
that no reader of the PDF ever saw and that carries no information a human
would want back: spacing diacritics (`recompose_spacing_diacritics`) and
markdown anchor targets (`strip_anchor_targets`). Between them they accounted
for the majority of quotations in the condensation store that could not be
matched against their own source.

The other two are REPORTED, because only the corpus can fix them and because
each bends the audit in a direction a reader has to know about:

  1. NO DETECTABLE REFERENCE-LIST HEADING. Checks C (quote lifted from the
     cited paper's own bibliography) and D (unit never named outside the
     reference list) both need to know where the body ends. When the heading
     cannot be found the body is taken to be the whole document, so a unit that
     appears ONLY in a reference list reads as a body mention and both checks
     pass. They do not fail -- they go quiet. Since the bibliography-only quote
     is the systematic defect #2069 was opened on, a silent pass there is the
     worst outcome the audit has.

  2. INTERLEAVED LINE NUMBERS. Line-numbered preprints put a number between
     every line of prose. Folding collapses the line breaks and leaves the
     numbers embedded mid-sentence, so an honest quotation fails to match and
     Tier-0 reports a quote that is plainly present. That is a false POSITIVE,
     the mirror of the first.

Both are properties of the SOURCE FILE, not of the registry, and neither is
fixable by editing `formations.yaml`. So this module reports them as source
defects to route to the corpus repository, and Tier-0 consumes it to say which
checks it could not run rather than reporting a pass it did not earn.

A paper that genuinely has no reference list -- a 19th-century notice, a
one-page description -- is a THIRD state and not a defect: nothing can be
bibliography-only in a paper with no bibliography, so checks C and D are sound.
Distinguishing that from a reference list whose heading was lost is the whole
job here, which is why an unheaded list is detected on citation shape rather
than assumed either way.
"""

import re

# A reference-list heading, tolerating what PDF-to-markdown puts in front of it:
# hash marks, bold asterisks, anchor spans (`<span id="page-39-1"></span>`) and
# the line-number column of a preprint table (`| 332 | References`). The old
# pattern allowed only hashes and asterisks, which is why the anchor-span form
# went undetected in 6 of 97 corpus papers.
BIBLIOGRAPHY_HEADING = re.compile(
    r"^(?P<prefix>\s*(?:\|\s*\d{1,4}\s*\|)?\s*#{0,6}\s*"
    r"(?:<span[^>]*>\s*</span>\s*)*\**\s*)"
    r"(?:bibliographic\s+|selected\s+)?"
    r"(references|reference list|literature cited|literature|bibliography|works cited)"
    r"\b",
    re.IGNORECASE | re.MULTILINE,
)

# How much of a heading line may follow the heading word before we stop reading
# it as a heading. "Bibliography cited in the text" is a heading; a sentence
# that happens to begin "References to the Morrison Formation are..." is not.
HEADING_TAIL_LIMIT = 40

# Spacing characters that extraction leaves where a combining diacritic
# belonged. Kept as a character class rather than a mapping because the letter
# they belong to is recoverable but never needed -- see
# `recompose_spacing_diacritics`.
SPACING_DIACRITICS = "´`˜~ˆ¸¨"

# Extraction also strips the tittle from i and j when lifting their diacritic,
# leaving the dotless forms behind: `Mart´ınez`, `d´ıez`. These are real Turkish
# and IPA letters, not damage, but no unit or author name in this corpus uses
# them deliberately, and NFKD does not map them to i/j.
DOTLESS_LETTERS = str.maketrans({"\u0131": "i", "\u0237": "j"})

# The target half of a markdown page-anchor link, which extraction plants in
# the middle of running prose -- see `strip_anchor_targets`.
ANCHOR_TARGET = re.compile(r"\]\(#[^)]*\)")

# A line shaped like a bibliography entry: carries a plausible publication year
# and opens the way reference lists open -- a bullet, a number, or a surname
# followed by initials.
CITATION_YEAR = re.compile(r"\b(1[6-9]\d{2}|20[0-3]\d)\b")
CITATION_OPENER = re.compile(
    r"^\s*(?:[-*•]\s+|\d{1,3}[.)]\s+|<span[^>]*>\s*</span>\s*)?"
    r"(?:[A-ZÀ-Þ][\w'À-ž-]+,\s*[A-Z]|[A-Z]{2,}[,.]|\[?\d{1,3}\]?\.\s)"
)

# Only the tail of a document can hold its reference list. Kept generous
# because supplementary matter, figure legends and author-contribution blocks
# routinely sit after it.
TAIL_FRACTION = 0.45

# How many citation-shaped lines in the tail before we call it a reference list.
# Set well above the handful of stray year-bearing lines a figure legend or a
# taxonomic-authority list produces.
UNHEADED_LIST_THRESHOLD = 8

# A line-number column, either as a preprint table cell or a bare leading
# integer on its own line.
LINE_NUMBER_CELL = re.compile(r"^\s*\|\s*(\d{1,4})\s*\|")
LINE_NUMBER_BARE = re.compile(r"^\s*(\d{1,4})\s*$")

# How many numbered lines, and how strongly increasing, before a document counts
# as line-numbered. A reference list numbered 1..40 also increases, so the run
# has to be long and dense to qualify.
LINE_NUMBER_MIN_RUN = 25
LINE_NUMBER_MIN_INCREASING = 0.8

# What has to FOLLOW the number for it to be a line number rather than a row
# index. A line-numbered preprint puts one run of prose beside each number; an
# ordinary data table puts several short cells there, and a book index puts
# nothing at all. Without this test every numbered table in the corpus reads as
# a line-numbered preprint -- it was three false positives out of four.
PROSE_MIN_WORDS = 6
PROSE_MAX_COLUMNS = 1


def strip_anchor_targets(text):
    """Remove the target of a markdown page-anchor link, keeping its text.

    PDF-to-markdown turns every inline citation into a link, and the target
    lands INSIDE the sentence: `(Martill and Wilby, 1993)` is stored as
    `[\\(Martill and Wilby, 1993\\)](#page-11-5)`, which folds to
    `martill and wilby 1993 page 11 5`. A quotation spanning that citation can
    never match, however faithfully it was transcribed, because the reader of
    the PDF never saw "page 11 5" at all.

    This one artifact accounted for more than half of the spans in the
    condensation store that failed to resolve against their source -- 313 of
    2582 fell to 134 once the targets were dropped. Only anchor targets are
    removed, not the link text, so nothing a reader would see is lost.

    @param {str} text - the raw string
    @returns {str} the string with anchor targets removed
    """
    return ANCHOR_TARGET.sub("]", text or "")


def recompose_spacing_diacritics(text):
    """Repair diacritics that extraction emitted as spacing characters.

    PDF text extraction routinely renders a precomposed glyph as its base
    letter plus a SPACING diacritic -- `Ferna´ndez` for Fernández, `Echapor~a`
    for Echaporã, `Alcobac¸a` for Alcobaça, `Lourinha˜` for Lourinhã. Unicode
    normalization does not touch these: `´` (U+00B4) is a character in its own
    right, not a combining mark, so folding turns it into a space and splits
    one word into two. The audit then reports a unit as absent, or a quotation
    as not in the paper, when both are plainly there.

    This is not a rare edge: 487 of 2354 corpus files carry the signature, some
    10,000 occurrences, and repairing every one of them at source is a long job
    that this audit should not have to wait on.

    The diacritic is dropped rather than recombined, because folding strips
    combining marks immediately afterwards and the two routes end in the same
    string. Only a diacritic sitting between two letters, or trailing a word,
    is touched -- a standalone `~60 m` keeps its tilde's separating effect, so
    no two genuine words are ever run together.

    @param {str} text - the raw string
    @returns {str} the string with spacing diacritics removed
    """
    text = (text or "").translate(DOTLESS_LETTERS)
    text = re.sub(r"(?<=[A-Za-z])[" + SPACING_DIACRITICS + r"](?=[A-Za-z])", "", text)
    return re.sub(r"(?<=[A-Za-z])[" + SPACING_DIACRITICS + r"](?![A-Za-z0-9])", "", text)


def heading_matches(raw):
    """Find every reference-list heading, rejecting prose that merely starts
    with the word.

    @param {str} raw - the paper's markdown
    @returns {list} match objects for the heading lines
    """
    matches = []
    for match in BIBLIOGRAPHY_HEADING.finditer(raw):
        line_end = raw.find("\n", match.end())
        if line_end == -1:
            line_end = len(raw)
        tail = raw[match.end():line_end].strip()
        decorated = "#" in match.group("prefix") or "*" in match.group("prefix")
        decorated = decorated or "|" in match.group("prefix")
        if decorated or len(tail) <= HEADING_TAIL_LIMIT:
            matches.append(match)
    return matches


def find_unheaded_reference_list(raw):
    """Detect a reference list whose heading did not survive extraction.

    Counts citation-shaped lines in the document's tail. This is a DIAGNOSTIC
    reported to a human, never a verdict: it decides whether to warn that
    checks C and D are degraded, not whether any pointer is wrong.

    @param {str} raw - the paper's markdown
    @returns {tuple} (count of citation-shaped lines, offset of the first one)
    """
    lines = raw.split("\n")
    offsets = []
    position = 0
    for line in lines:
        offsets.append(position)
        position += len(line) + 1
    threshold = len(raw) * TAIL_FRACTION

    count = 0
    first = None
    for index, line in enumerate(lines):
        if offsets[index] < threshold:
            continue
        if CITATION_YEAR.search(line) and CITATION_OPENER.match(line):
            count += 1
            if first is None:
                first = offsets[index]
    return count, first


def looks_like_prose(text):
    """Decide whether what sits beside a number is a run of prose.

    @param {str} text - the remainder of the line after the number
    @returns {bool} True when it reads as prose rather than table cells
    """
    stripped = text.strip().strip("|").strip()
    if stripped.count("|") > PROSE_MAX_COLUMNS:
        return False
    return len(stripped.split()) >= PROSE_MIN_WORDS


def detect_line_numbering(raw):
    """Detect a line-number gutter that kept its own column.

    Only the COLUMN shape is detected structurally, and deliberately so. The
    other shape -- numbers collapsed into running prose -- cannot be told apart
    from a numbered character list, a numbered diagnosis or a specimen table by
    any structural rule tried here: all of them are evenly spaced ascending
    integers embedded in text, and every threshold that caught the gutter also
    caught four innocent papers. It is detected by its SYMPTOM instead, in
    `matches_through_line_numbers` -- a quotation that matches only once
    integers are allowed between its words is near-proof of a gutter, has no
    false positives by construction, and flags exactly the papers that damage
    the audit rather than every paper that merely could.

    @param {str} raw - the paper's markdown
    @returns {dict} whether the document is line-numbered and the evidence
    """
    lines = raw.split("\n")
    numbers = []
    for index, line in enumerate(lines):
        cell = LINE_NUMBER_CELL.match(line)
        if cell:
            if looks_like_prose(line[cell.end():]):
                numbers.append(int(cell.group(1)))
            continue
        bare = LINE_NUMBER_BARE.match(line)
        if bare:
            following = lines[index + 1] if index + 1 < len(lines) else ""
            if looks_like_prose(following):
                numbers.append(int(bare.group(1)))

    increasing = 0
    for previous, current in zip(numbers, numbers[1:]):
        if current > previous:
            increasing += 1
    ratio = increasing / (len(numbers) - 1) if len(numbers) > 1 else 0.0
    columned = len(numbers) >= LINE_NUMBER_MIN_RUN and ratio >= LINE_NUMBER_MIN_INCREASING

    return {
        "line_numbered": columned,
        "numbered_lines": len(numbers),
        "increasing_ratio": round(ratio, 3),
    }


def matches_through_line_numbers(folded_text, folded_quote):
    """Test whether a quotation appears in a line-numbered paper, allowing a
    line number to sit between any two of its words.

    Deleting the numbers instead would be destructive and wrong: this corpus's
    line-numbered extractions collapse the numbers INLINE rather than keeping
    them in a column, and a blanket strip takes real content with them --
    "Island 126/127" loses its identity. So the quotation is made tolerant
    instead and the source is left untouched.

    @param {str} folded_text - the paper's folded text
    @param {str} folded_quote - the folded quoted span
    @returns {bool} True when the quote appears apart from interleaved numbers
    """
    words = folded_quote.split()
    if not words:
        return False
    pattern = r"(?:\s+\d{1,4})?\s+".join(re.escape(word) for word in words)
    return re.search(pattern, folded_text) is not None


def assess(raw):
    """Classify one paper's extraction quality.

    @param {str} raw - the paper's markdown
    @returns {dict} the bibliography state, the body cut, and any degradations
    """
    headings = heading_matches(raw)
    citation_lines, first_citation = find_unheaded_reference_list(raw)
    numbering = detect_line_numbering(raw)

    if headings:
        bibliography = "heading"
        cut = headings[-1].start()
    elif citation_lines >= UNHEADED_LIST_THRESHOLD:
        bibliography = "unheaded-list"
        cut = first_citation
    else:
        bibliography = "none"
        cut = len(raw)

    degradations = []
    if bibliography == "unheaded-list":
        degradations.append(
            {
                "kind": "reference-list-heading-missing",
                "affects": ["quote_bibliography_only", "unit_absent"],
                "direction": "false-negative",
                "detail": (
                    f"{citation_lines} citation-shaped lines in the tail but no "
                    "reference-list heading survived extraction; the body/"
                    "bibliography boundary is inferred, not read"
                ),
            }
        )
    if numbering["line_numbered"]:
        degradations.append(
            {
                "kind": "interleaved-line-numbers",
                "affects": ["quote_absent"],
                "direction": "false-positive",
                "detail": (
                    f"{numbering['numbered_lines']} line-number entries; numbers "
                    "land mid-sentence once the text is folded, so honest "
                    "quotations fail to match"
                ),
            }
        )

    return {
        "bibliography": bibliography,
        "cut": cut,
        "citation_lines_in_tail": citation_lines,
        "line_numbering": numbering,
        "degradations": degradations,
    }
