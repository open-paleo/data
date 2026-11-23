# open-paleo

Pydantic v2 models and the JSON Schema for the built [Open Paleo](https://github.com/open-paleo/data) dataset (`open-paleo.json` / `open-paleo.yml`).

## Install

```bash
pip install open-paleo
```

Only pre-1.0 versions are published so far. Until 1.0.0 the output format can change in incompatible ways between minor versions (see [Versioning](#versioning)), so pin to one minor line: `open-paleo~=0.4.7` accepts 0.4.7 and later 0.4 releases, but not 0.5.

## Models

```python
from pathlib import Path

from open_paleo import OpenPaleoDataset

dataset = OpenPaleoDataset.model_validate_json(Path("open-paleo.json").read_bytes())

for name, genus in dataset.genera.items():
    print(name, genus.parent)

tyrannosaurus = dataset.genera["Tyrannosaurus"]
```

`OpenPaleoDataset` is the whole file. `genera`, `clades` and `stratigraphy` are dictionaries keyed by name. Every object in the file has a model of its own (`Genus`, `Species`, `Clade`, `Reference`, `StratigraphicUnit`, …). The models are generated from the JSON Schema with [datamodel-code-generator](https://github.com/koxudaxi/datamodel-code-generator). The recursive `tree` is typed as a nested dictionary; its full recursive structure is in the schema.

## JSON Schema

The package also carries the JSON Schema (draft 2020-12) the models are generated from:

```python
import json
from importlib.resources import files

schema = json.loads(files("open_paleo").joinpath("schema.json").read_text(encoding="utf-8"))
```

## Versioning

The package version is the dataset's output schema version, `_metadata.schema_version` in `open-paleo.json`. Install the version that matches the dataset you read. A data release that leaves the output format unchanged publishes no new package version.

The rules for when the schema version changes are in [docs/VERSIONING.md](https://github.com/open-paleo/data/blob/main/docs/VERSIONING.md), and each change is listed in the [CHANGELOG](https://github.com/open-paleo/data/blob/main/CHANGELOG.md).

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), like the dataset. Credit "Open Paleo contributors".
