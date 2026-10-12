#!/usr/bin/env python3
"""Path resolution for the audit-disputes skill scripts.

Mirrors scripts/corpus-path.ts: the data repo is this file's repo root, and the
paper corpus / working dir are resolved from environment overrides or the
sibling-directory default. Keeping this in one place means the skill scripts
never hardcode a per-machine path.
"""

import os
import unicodedata


def data_dir():
    """Absolute path to the data repo root (this skill lives under
    <data>/.claude/skills/audit-disputes/)."""
    override = os.environ.get("OPEN_PALEO_DATA_DIR")
    if override:
        return os.path.abspath(override)
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def corpus_dir():
    """Absolute path to the paper corpus root (honors OPEN_PALEO_PAPERS_DIR,
    else the sibling `open-paleo-papers` directory next to the data repo)."""
    override = os.environ.get("OPEN_PALEO_PAPERS_DIR")
    if override:
        return os.path.abspath(override)
    return os.path.join(os.path.dirname(data_dir()), "open-paleo-papers")


def condensed_dir():
    """Where paper condensations live (in the corpus repo, committed)."""
    return os.path.join(corpus_dir(), "condensed")


def audit_dir():
    """Where per-slice audit outputs (report, intermediates) are written. Under
    scratch/, which is wholly gitignored -- everything here is regenerable."""
    return os.path.join(data_dir(), "scratch", "audit")


def reaudit_queue_path():
    """Durable, committed backlog of loci to re-audit when a missing/incomplete
    source paper lands or is repaired. Owned by this skill, which is the only
    thing that writes it, so it lives beside the scripts rather than under the
    regenerable scratch output."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "reaudit-queue.yml")


# Latin letters with no canonical NFD decomposition to a base ASCII letter,
# mirroring nonDecomposingLetterFolds in scripts/utilities.ts.
_NON_DECOMPOSING_FOLDS = {
    "ł": "l", "ø": "o", "đ": "d", "ð": "d", "þ": "t", "ß": "s",
    "ı": "i", "ħ": "h", "ĸ": "k", "ŋ": "n", "œ": "o", "æ": "a",
}


def reference_bucket(reference_id):
    """Store directory bucket for a reference key, as referenceBucket in
    scripts/utilities.ts computes it: the first character with diacritics
    stripped and non-decomposing letters folded, lowercased, or "_" when it
    does not fold to a-z. So "ősi2010a" is under "o" and "čech1980a" under "c".

    @param reference_id - the reference key, e.g. "ősi2010a"
    @returns the single-character bucket name
    """
    decomposed = unicodedata.normalize("NFD", reference_id)
    stripped = "".join(character for character in decomposed if not unicodedata.combining(character))
    first = stripped[:1].lower()
    folded = _NON_DECOMPOSING_FOLDS.get(first, first)
    return folded if len(folded) == 1 and "a" <= folded <= "z" else "_"


def store_path(reference_id):
    """Absolute path of a reference's store file, references/<bucket>/<id>.yml.

    @param reference_id - the reference key
    @returns the path, whether or not the file exists
    """
    return os.path.join(data_dir(), "references", reference_bucket(reference_id), f"{reference_id}.yml")
