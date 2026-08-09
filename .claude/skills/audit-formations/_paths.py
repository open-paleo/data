#!/usr/bin/env python3
"""Path resolution for the audit-formations skill scripts.

Mirrors the sibling audit-disputes skill: the data repo is this file's repo
root, and the paper corpus is resolved from an environment override or the
sibling-directory default. Keeping this in one place means the skill scripts
never hardcode a per-machine path.
"""

import os


def data_dir():
    """Absolute path to the data repo root (this skill lives under
    <data>/.claude/skills/audit-formations/)."""
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


def strat_condensed_dir():
    """Where STRATIGRAPHIC paper condensations live (in the corpus repo,
    committed).

    Deliberately separate from the corpus's `condensed/` directory, which holds
    the placement/affinity records built by audit-disputes. Those are keyed to a
    different question and record nothing about member lists, containment or
    unit rank; folding this schema into them would leave 600+ existing records
    hash-valid but silently unable to answer a stratigraphic claim.
    """
    return os.path.join(corpus_dir(), "condensed-strat")


def markdown_dir():
    """Where the corpus paper markdown lives."""
    return os.path.join(corpus_dir(), "markdown")


def audit_dir():
    """Where the audit's intermediates and report are written. Under scratch/,
    which is wholly gitignored -- everything here is regenerable from
    formations.yaml plus the corpus."""
    return os.path.join(data_dir(), "scratch", "audit-formations")


def loci_dir():
    """Where the per-entry Tier-1 input files are written.

    One file per registry entry, holding its structural fields, its pointers
    with their notes, and the Tier-0 slice for that unit. Written by
    `assemble.py` and topped up by `tier0.py` so it cannot drift from the
    registry: a hand-built locus set went stale behind a round of note edits
    once, and the agent reading it was handed the wording those edits had
    already replaced.
    """
    return os.path.join(audit_dir(), "loci")


def locus_slug(unit):
    """Filename stem for a registry entry.

    @param {str} unit - the registry key
    @returns {str} the stem, with path-hostile characters replaced
    """
    return unit.replace("/", "-").replace(" ", "_")


def reaudit_queue_path():
    """Durable, committed backlog of pointers to re-audit when a degraded or
    missing source is repaired. Owned by this skill, which is the only thing
    that writes it, so it lives beside the scripts rather than under the
    regenerable scratch output."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "reaudit-queue.yml")


def resolve_markdown(ref_id):
    """Return the corpus markdown path for a ref-id, or None if absent.

    A dataset citation key ends in a/b/c. The same paper may sit in the corpus
    under a reverse-suffixed z/y/x key, which marks a corpus paper not meant for
    dataset citation -- but when the dataset key has been properly minted and
    only the corpus filing lags (as for eberth2012a), the paper IS present and
    treating it as a coverage gap would be wrong. Resolve the twin, and let
    tier0 report the filing mismatch separately.
    """
    stem = ref_id[:-1]
    for candidate in [ref_id] + [stem + suffix for suffix in "zyxabcd"]:
        path = os.path.join(markdown_dir(), f"{candidate}.md")
        if os.path.exists(path):
            return path
    return None
