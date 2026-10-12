#!/usr/bin/env python3
"""Path resolution for the audit-disputes skill scripts: the shared helpers in
.claude/skills/_shared/skill_paths.py, plus the path this skill alone owns.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_shared"))

from skill_paths import (  # noqa: E402,F401  re-exported for this skill's scripts
    audit_dir,
    condensed_dir,
    corpus_dir,
    data_dir,
    normalize_doi,
    reference_bucket,
    store_path,
)


def reaudit_queue_path():
    """Durable, committed backlog of loci to re-audit when a missing/incomplete
    source paper lands or is repaired. Owned by this skill, which is the only
    thing that writes it, so it lives beside the scripts rather than under the
    regenerable scratch output."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "reaudit-queue.yml")
