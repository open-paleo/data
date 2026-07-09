# Versioning and stability

Open Paleo publishes two things with very different stability guarantees. Read
this before building anything on top of the dataset.

## What is stable, and what is not

**The built outputs in `dist/` are the stable contract.** Consume these:

- `dist/open-paleo.json` and `dist/open-paleo.yml` — the full dataset
- `dist/open-paleo.schema.json` — a JSON Schema (2020-12) describing that output
- `dist/tree.newick`, `dist/tree.nexus` — the phylogenetic tree
- `dist/references.bib` — every reference as BibTeX

**The source YAML is not stable.** The files under `genera/`, `clades/`,
`references/`, plus `schema.yml`, `tree.yml`, and `institutions.yaml`, are an
editing and curation format. Their layout can change between releases —
fields may be reshaped, denormalized, or moved. Do not build integrations
directly against the source tree; build against `dist/`.

The build intentionally transforms the source into the output: it inflates
reference pointers into full bibliographic blocks, derives each taxon's
`authors`/`described` from its `erected_in` authority, resolves institution
codes to display names, and attaches the computed `taxonomy` ancestry. The
output is therefore self-contained — a single genus record carries everything
needed to render it, with no separate lookups required.

## Two version numbers

`dist/open-paleo.json` carries both in `_metadata`:

- **`version`** — a calendar version of the *data release* (`YYYY.MM`, e.g.
  `2026.07`). It changes whenever the data is re-published, regardless of
  whether the shape changed. Cite this for reproducibility (see the README).
- **`schema_version`** — a [semantic version](https://semver.org/) of the
  *output shape*. It changes only when the structure changes, per the rules
  below.

The two are independent: most releases bump `version` while leaving
`schema_version` untouched.

## `schema_version` semantics

Given `MAJOR.MINOR.PATCH`:

- **MAJOR** — a backwards-incompatible change to the output shape. Removing or
  renaming a field, changing a field's type, restructuring an object, or
  removing a controlled-vocabulary value. Consumers pinned to the previous
  major may break.
- **MINOR** — a backwards-compatible addition. A new optional field, a new
  object, or a new value added to a controlled vocabulary (`diet`, `status`,
  `specimen_type`, geological stages, …). Existing consumers keep working
  unchanged.
- **PATCH** — no shape change. A documentation fix, a corrected derivation, or
  a data-only correction that does not alter the set of fields or their types.

New geological periods/stages, new `appearance_features` tags, new
`specimen_categories`, and similar vocabulary growth are **MINOR** — the schema
is designed so that pinning to a v1 schema keeps validating as the dataset
grows.

## When you change the output shape

Anyone modifying `scripts/build.ts` output or the schema must, in the same
change:

1. Update `schemas/open-paleo.schema.json` to match the new shape. (Its
   controlled-vocabulary enums mirror `schema.yml`; the `Output schema sync`
   validator check fails the build if they drift.)
2. Bump `_metadata.schema_version` in `scripts/build.ts` per the rules above.
3. Record the change in [`CHANGELOG.md`](../CHANGELOG.md).
4. Run `npm run validate` and `npm run build`.

## Validating against the schema

The schema is standard JSON Schema, which validates both the JSON and YAML
outputs (parse the YAML to an object first). For example, in Python:

```python
import json, jsonschema
schema = json.load(open("dist/open-paleo.schema.json"))
data = json.load(open("dist/open-paleo.json"))
jsonschema.Draft202012Validator(schema).validate(data)
```

Editors that understand the `# yaml-language-server: $schema=<url>` modeline
can validate `dist/open-paleo.yml` live against the same schema.

Because the schema leaves objects open to additional properties, a document
built under a later **minor** schema version still validates against an earlier
v1 schema — new fields are simply ignored by the older validator.

## Typed bindings

Language bindings generated from the schema ship as part of the `dist/` output,
under `dist/bindings/`:

- `dist/bindings/open-paleo.d.ts` — TypeScript declarations (via
  `json-schema-to-typescript`)
- `dist/bindings/open_paleo.py` — Python Pydantic v2 models (via
  `datamodel-code-generator`)

The build workflow regenerates and commits them **only when
`schemas/open-paleo.schema.json` changes** (it compares the schema at the
pre-push commit against the current file), so ordinary data pushes don't churn
them.
Regenerate locally with `npm run generate-bindings` (requires
`pip install datamodel-code-generator`). Generation is deterministic, so an
unchanged schema produces no diff.

The recursive `tree` is typed as a nested dictionary in both bindings; its full
recursive shape lives in the JSON Schema, which validation enforces.
