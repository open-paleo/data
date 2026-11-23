"""Check a built open-paleo package against the dataset it describes.

The Publish bindings workflow installs the built wheel into a clean
environment and runs this before uploading, so a package that does not
import, warns on import, rejects the real dataset or lacks its schema is
never published.

Usage: python -W error smoke_test.py <path to open-paleo.json>
"""

import json
import sys
from importlib.resources import files
from pathlib import Path

from open_paleo import OpenPaleoDataset


def check_dataset(dataset_path: Path) -> int:
    """Validate the dataset and check the README's examples.

    Args:
        dataset_path: Path to the built open-paleo.json.

    Returns:
        The number of genera validated.
    """
    dataset = OpenPaleoDataset.model_validate_json(dataset_path.read_bytes())

    if not dataset.genera:
        raise SystemExit("the dataset validated but has no genera")

    for name, genus in dataset.genera.items():
        if name != genus.genus:
            raise SystemExit(f"genera key {name!r} holds genus {genus.genus!r}")

    return len(dataset.genera)


def check_schema() -> str:
    """Load the JSON Schema shipped as package data.

    Returns:
        The schema's $schema draft URI.
    """
    schema = json.loads(files("open_paleo").joinpath("schema.json").read_text(encoding="utf-8"))
    return schema["$schema"]


if __name__ == "__main__":
    genus_count = check_dataset(Path(sys.argv[1]))
    draft = check_schema()
    print(f"open-paleo: validated {genus_count} genera; schema {draft}")
