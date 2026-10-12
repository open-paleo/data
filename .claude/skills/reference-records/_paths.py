#!/usr/bin/env python3
"""Path resolution for the reference-records skill scripts: the shared helpers
in .claude/skills/_shared/skill_paths.py.
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
