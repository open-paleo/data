# @open-paleo/types

TypeScript types and the JSON Schema for the built [Open Paleo](https://github.com/open-paleo/data) dataset (`open-paleo.json` / `open-paleo.yml`).

## Install

```bash
npm install --save-dev @open-paleo/types@next
```

Only pre-1.0 versions are published so far, under the `next` tag. Until 1.0.0 the output format can change in incompatible ways between minor versions (see [Versioning](#versioning)).

## Types

```typescript
import type { OpenPaleoDataset, Genus } from "@open-paleo/types";

const dataset: OpenPaleoDataset = JSON.parse(text);
const genera: Array<Genus> = Object.values(dataset.genera);
const tyrannosaurus: Genus | undefined = dataset.genera["Tyrannosaurus"];
```

`OpenPaleoDataset` is the whole file. `genera`, `clades` and `stratigraphy` are objects keyed by name. Every object in the file has an exported type of its own (`Genus`, `Species`, `Clade`, `Reference`, `StratigraphicUnit`, …). The declarations are generated from the JSON Schema with [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript). The recursive `tree` is typed as a nested dictionary; its full recursive structure is in the schema.

## JSON Schema

The package also carries the JSON Schema (draft 2020-12) the types are generated from, for validating a dataset at runtime:

```typescript
import Ajv2020 from "ajv/dist/2020.js";
import schema from "@open-paleo/types/schema.json" with { type: "json" };

const validate = new Ajv2020({ strict: false }).compile(schema);
```

## Versioning

The package version is the dataset's output schema version, `_metadata.schema_version` in `open-paleo.json`. Install the version that matches the dataset you read. A data release that leaves the output format unchanged publishes no new package version.

The rules for when the schema version changes are in [docs/VERSIONING.md](https://github.com/open-paleo/data/blob/main/docs/VERSIONING.md), and each change is listed in the [CHANGELOG](https://github.com/open-paleo/data/blob/main/CHANGELOG.md).

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), like the dataset. Credit "Open Paleo contributors".
