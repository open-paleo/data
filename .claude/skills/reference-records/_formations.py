"""Read the repo-level formation registry.

`formations.yaml` at the repo root replaced this skill's own
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
    """Read the whole formation registry.

    @returns: Dict of canonical unit name to its entry.
    """
    path = os.path.join(data_dir(), "formations.yaml")

    return yaml.safe_load(open(path, encoding="utf-8")) or {}


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
