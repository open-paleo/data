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
`references/`, `stratigraphy/`, plus `schema.yml`, `tree.yml`,
`institutions.yaml` and `regions.yaml`, are an
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

- **`version`** — a calendar version of the *data release*: the UTC date of
  the publish (`YYYY.MM.DD`, e.g. `2026.11.26`), with `.2`, `.3` and so on
  for later publishes the same day. It changes whenever the data is
  re-published, regardless of whether the shape changed. Cite this for
  reproducibility (see the README).
- **`schema_version`** — a [semantic version](https://semver.org/) of the
  *output shape*. It changes only when the structure changes, per the rules
  below.

The two are independent: most releases bump `version` while leaving
`schema_version` untouched. `_metadata.commit` is the full SHA of the source
commit a build was run from.

## When the data is published

The *Build* workflow (`.github/workflows/build.yml`) publishes `dist/`. It runs
once a day at 05:00 UTC, not on every push, so `main`'s source files can be
ahead of its `dist/` until the next run. Start it by hand from the Actions tab,
or with `gh workflow run build.yml`, to publish sooner: to fix a broken build,
or for a timely addition such as a new genus or species.

A run publishes only when the data changed. Every build stamps `built_at`,
`version` and `commit`, so a run whose output differs from the last publish
only in those fields commits nothing, and one version never names two
datasets. A run that publishes:

1. takes the day's next version — the bare date if no version has that date
   yet, whether the run was scheduled or started by hand, otherwise the next
   counter;
2. commits `dist/` to `main`;
3. tags that commit with an annotated tag named exactly the version, so
   `https://github.com/open-paleo/data/tree/<version>` and
   `https://raw.githubusercontent.com/open-paleo/data/<version>/dist/open-paleo.json`
   always serve that release;
4. notifies open-paleo/web, which redeploys from it, and open-paleo/corpus
   when `references.bib` changed.

The tags are not GitHub Releases, and no DOI is minted for them.

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
is designed so that a consumer pinned to one major version keeps validating as
the dataset grows.

## Before 1.0.0

Until the first public release the schema is versioned `0.MINOR.PATCH`, and
the rules above shift down one place, as [semver](https://semver.org/#spec-item-4)
and npm's `^` ranges both treat 0.x versions:

- **MINOR** — a backwards-incompatible change (what MAJOR means from 1.0.0 on).
- **PATCH** — any other change: a backwards-compatible addition or a fix.

A consumer pinned to one `0.MINOR` line keeps validating as the dataset grows,
as one pinned to a major version will after 1.0.0. Anything below 1.0.0 is
unstable: the output can still change in incompatible ways between minor
versions. The schema becomes 1.0.0 with the first public release.

## When you change the output shape

Anyone modifying `scripts/build.ts` output or the schema must, in the same
change:

1. Update `schemas/open-paleo.schema.json` to match the new shape. (Its
   controlled-vocabulary enums mirror `schema.yml`; the `Output schema sync`
   validator check fails the build if they drift.)
2. Bump `_metadata.schema_version` in `scripts/build.ts` per the rules above
   (shifted down one place while the version is below 1.0.0).
   Note that a change confined to the *source* YAML is not by itself a schema
   change: `location.region` moved to storing an ISO 3166-2 code, but the build
   resolves it, so `dist/` still publishes the English name and the release was
   MINOR (a new `region_code` field) rather than MAJOR. Judge the version by
   what `dist/` looks like, never by what the source files look like.
3. Record the change in [`CHANGELOG.md`](../CHANGELOG.md).
4. Run `npm run validate` and `npm run build`.
5. If the bump is a breaking one (MAJOR, or MINOR before 1.0.0), tell the
   maintainers of [open-paleo/web](https://github.com/open-paleo/web) before
   pushing: its build checks the dataset's `schema_version` against its own
   bindings and stops on a breaking difference.
6. After pushing, run the Build workflow by hand (see
   [When the data is published](#when-the-data-is-published)) and wait for
   it to commit the regenerated `dist/`, then run the *Publish bindings*
   workflow from the Actions tab to publish the new version to npm and PyPI
   (see [Packages](#packages)).

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
schema of the same major version — new fields are simply ignored by the older
validator.

## Typed bindings

Language bindings generated from the schema ship as part of the `dist/` output,
under `dist/bindings/`:

- `dist/bindings/open-paleo.d.ts` — TypeScript declarations (via
  `json-schema-to-typescript`)
- `dist/bindings/open_paleo.py` — Python Pydantic v2 models (via
  `datamodel-code-generator`)

The build workflow regenerates and commits them **only when
`schemas/open-paleo.schema.json` changes** (it compares the schema with the
copy in the last published `dist/`), so ordinary data publishes don't churn
them.
Regenerate locally with `npm run generate-bindings` (requires
`pip install datamodel-code-generator`). Generation is deterministic, so an
unchanged schema produces no diff.

The recursive `tree` is typed as a nested dictionary in both bindings; its full
recursive shape lives in the JSON Schema, which validation enforces.

### Packages

Both bindings are published as packages whose version is the `schema_version`
of the output they describe. A data release that leaves the schema unchanged
publishes no new package version.

- **npm:** [`@open-paleo/types`](https://www.npmjs.com/package/@open-paleo/types),
  the TypeScript declarations and the JSON Schema. Versions below 1.0.0 are
  published under the `next` dist-tag, so they install only with
  `npm install @open-paleo/types@next` or an explicit version.
- **PyPI:** [`open-paleo`](https://pypi.org/project/open-paleo/), the Pydantic
  models as the `open_paleo` module, with the JSON Schema as package data. PyPI
  has no dist-tags, so `pip install open-paleo` takes the newest version; the
  package is marked alpha until 1.0.0, and `open-paleo~=0.4.7` pins one 0.x
  minor line as `^0.4.7` does on npm.

Each package's template lives in `packages/` (`types/` and `python/`), and
`npm run stage-packages` assembles both from their templates and `dist/` in
`scratch/packages/`. The *Publish bindings* workflow
(`.github/workflows/publish-types.yml`), run by hand from the Actions tab,
stages and publishes the version on `main` to both registries through trusted
publishing, with provenance. Its dry run checks the npm setup without
publishing and uploads a `.devN` version to TestPyPI.
