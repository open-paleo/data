"""Read the repo-level stratigraphic registry.

`stratigraphy/` at the repo root replaced this skill's own
`formation-variants.yml` and `formation-ranks.yml`: what a unit is called and
what rank it holds are answered from the same read, so they were being recorded
together in practice long before they shared a file.

The scripts here want the spelling map on its own, so it is projected out
rather than each caller learning the registry's shape.
"""

import os

import yaml

from _paths import data_dir


def loadRegistry():
    """Read the whole stratigraphic registry.

    @returns: Dict of canonical unit name to its entry.
    """
    root = os.path.join(data_dir(), "stratigraphy")
    registry = {}

    for bucket in sorted(os.listdir(root)):
        directory = os.path.join(root, bucket)
        if not os.path.isdir(directory):
            continue
        for fileName in sorted(os.listdir(directory)):
            if not fileName.endswith(".yml"):
                continue
            entry = yaml.safe_load(open(os.path.join(directory, fileName), encoding="utf-8")) or {}
            name = entry.pop("name", None)
            if name is not None:
                registry[name] = entry

    return registry


def loadVariants(registry=None):
    """Project the registry down to canonical name -> alternative spellings.

    Entries carrying no `variants` are omitted, so the result is the same shape
    the reconciliation scripts consumed before the registry existed.

    @param registry: An already-loaded registry, to avoid re-reading it.
    @returns: Dict of canonical name to a list of variant spellings.
    """
    entries = registry if registry is not None else loadRegistry()

    return {name: entry["variants"]
            for name, entry in entries.items()
            if isinstance(entry, dict) and entry.get("variants")}
