#!/usr/bin/env python3
"""schema.yml, read once for the skill scripts: its stage table and the stage
order, as loadSchema and stageOrdering in scripts/utilities.ts read them.
"""

import os

import yaml

from skill_paths import data_dir


def load_schema():
    """Parse schema.yml, the controlled vocabularies and the stage table.

    @returns the parsed schema
    """
    with open(os.path.join(data_dir(), "schema.yml"), encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def stage_table():
    """The schema's stages, each name with its entry (period, from_ma, to_ma).

    @returns dict of stage name to its schema entry
    """
    return load_schema().get("stages") or {}


def stage_order():
    """Every stage's place in time, oldest first by base age. Sorting by age
    rather than taking the file's order keeps a range like
    "Berriasian-Hauterivian" expanding to the stages between its ends however
    schema.yml happens to list them.

    @returns dict of lowercased stage name to its index, oldest first
    """
    stages = stage_table()
    ordered = sorted(stages, key=lambda name: -stages[name]["from_ma"])
    return {str(name).lower(): index for index, name in enumerate(ordered)}
