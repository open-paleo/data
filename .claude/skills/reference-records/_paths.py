#!/usr/bin/env python3
"""Path resolution for the reference-records skill scripts: the shared helpers
in .claude/skills/_shared/skill_paths.py.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_shared"))

from skill_paths import (  # noqa: E402,F401  re-exported for this skill's scripts
    find_audit_dir,
    find_corpus_dir,
    find_data_dir,
    fold_letters,
    normalize_doi,
    find_reference_bucket,
    find_store_path,
)
