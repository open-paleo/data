#!/usr/bin/env python3
"""Path resolution for the reference-records skill scripts.

Mirrors scripts/corpus-path.ts: the data repo is this file's repo root, and the
paper corpus / working dir are resolved from environment overrides or the
sibling-directory default. Keeping this in one place means the skill scripts
never hardcode a per-machine path.
"""

import os


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
    """Where this skill's cache and report are written. Under scratch/, which is
    wholly gitignored -- everything here is regenerable from the reference
    works plus the genus data."""
    return os.path.join(data_dir(), "scratch", "audit")
