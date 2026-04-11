# Holotype Schema Change: Array IDs + Specimen Type

Schema change adopted in #1848. Changes `species.holotype.specimen_id`
from a single string to an array, and adds a required
`species.holotype.specimen_type` enum when a holotype block is present.

## Motivation

Cross-referencing our dataset against Wikipedia during the
sauropodomorph backfill pass (`reports/sauropodomorph-specimen-backfill.md`)
deferred 38 entries because the single-string `specimen_id` field
could not represent real-world type series:

- Syntype series (no designated holotype)
- Lectotype + paralectotype pairs
- Holotype + paratype pairs recorded together
- Neotypes replacing lost holotypes
- Distributed holotypes across multiple catalogue numbers

The `holotype` block name is kept even though it will sometimes hold
a syntype or neotype series. This is a naming compromise in favor of a
smaller schema change — the `specimen_type` field disambiguates.

## Schema change

Before:

```yaml
holotype:
  specimen_id: CM 3018
  institution: Carnegie Museum of Natural History
```

After:

```yaml
holotype:
  specimen_id:
    - CM 3018
  specimen_type: holotype
  institution: Carnegie Museum of Natural History
```

### Field shape

- **`specimen_id`** is always an `Array<string>` with at least one
  element. Consumers never branch on "is it a string or array" — it
  is always an array, even in the common single-ID case.
- **`specimen_type`** is a required enum whenever the `holotype` block
  is present. Allowed values (defined in `schema.yml` under
  `specimen_types`):
  - `holotype` — single primary type specimen (default for the migration)
  - `syntype` — series of specimens, no single holotype designated
  - `lectotype` — single specimen later chosen from a syntype series
  - `neotype` — single replacement specimen after the original was lost
  - `unknown` — primary type status uncertain from the literature

### Validation rules

Enforced in the Holotype consistency check:

| `specimen_type` | Required `specimen_id` length | Rationale |
| --- | --- | --- |
| `holotype`  | exactly 1 | ICZN: a holotype is a single specimen |
| `syntype`   | ≥ 2       | Syntypes are inherently a series |
| `lectotype` | exactly 1 | A lectotype is a single designated specimen |
| `neotype`   | exactly 1 | A neotype is a single replacement specimen |
| `unknown`   | ≥ 1       | No length constraint |

When a `holotype` block is present, `institution` remains required
(modulo the status-only relaxation in #1850, which is orthogonal).

### Paratypes

Paratypes are intentionally **not** represented. They are referred
material that exists alongside a holotype rather than being a type
designation of their own. A species whose listed material is a
holotype + paratype pair is recorded as `specimen_type: holotype`
with the paratype noted in the genus description if noteworthy, or
simply dropped. This keeps the schema flat at the cost of a
historical detail we can revisit if demand emerges.

## Migration

One-off script: `scripts/migrate-holotype-specimen-ids.ts`.

Walks every `genera/**/*.yml` file, for each species with a `holotype`
block:

1. Wrap the `specimen_id` scalar in an inline YAML array:
   `specimen_id: CM 3018` → `specimen_id: [CM 3018]`
2. Insert `specimen_type: holotype` immediately after `specimen_id`
   if not already present.

Text-insertion only (no full parse/restringify round-trip), mirroring
the approach in `scripts/backfill-sauropodomorph-specimens.ts`. This
keeps the diff to pure additions + one quoted scalar change per
species entry.

`--dry-run` (default) prints a per-file summary without touching YAML
files. `--apply` writes changes.

### Known exceptions to fix manually after migration

The 38 sauropodomorph entries deferred by
`scripts/backfill-sauropodomorph-specimens.ts` need their
`specimen_type` corrected from `holotype` to the actual designation
(`syntype`, `lectotype`, or `neotype`), and their `specimen_id` array
filled in with the full series. Tracked as a follow-up to #1848.

Examples (from the deferred list):

- **Diplodocus carnegii** → `specimen_type: holotype`, `specimen_id: [CM 84]`
  (CM 94 paratype dropped)
- **Tornieria africana** → `specimen_type: syntype`,
  `specimen_id: [SMNS 12141a, SMNS 12145a, SMNS 12143, SMNS 12140, SMNS 12142]`
- **Massospondylus carinatus** → `specimen_type: neotype`,
  `specimen_id: [BP/1/4934]` (original syntypes never catalogued; dropped)
- **Iuticosaurus lydekkeri** → `specimen_type: lectotype`,
  `specimen_id: [BMNH R146a]`
- **Anchisaurus polyzelus** → `specimen_type: neotype`,
  `specimen_id: [YPM 1883]` (original holotype AM 41/109 dropped)

## Consumer updates

All readers and writers of `holotype.specimen_id` are updated in the
same PR:

- `scripts/validate.ts` — shape + enum + length validation
- `scripts/build.ts` — exposes `specimen_types` vocabulary to
  `docs/schema.json`
- `scripts/batch-import.ts` — wraps PBDB / Wikipedia-sourced
  specimen IDs in an array on write, defaults new blocks to
  `specimen_type: holotype`
- `scripts/backfill-sauropodomorph-specimens.ts` — same array-aware
  writes; the 38 deferred entries become writable in a follow-up pass
- `scripts/report-missing-fields.ts` — `isPopulated` already handles
  arrays; no change needed beyond verifying
- `docs/import.js` — wraps imported specimen IDs in an array
- `docs/flows.js` — new `Holotype type` select (`specimen_types`),
  `Holotype specimen ID` becomes a comma-separated text input
- `docs/yaml-builder.js` — splits the comma-separated input into an
  array, writes `specimen_type`

## Execution order

1. Plan document (this file)
2. Schema + types + validator + build
3. Migration script with dry-run
4. Consumer updates
5. Dry-run, review sample diffs
6. Apply migration
7. Validate + typecheck + lint + build
8. Commit in two parts: infrastructure + bulk migration
9. Commit message on the infrastructure commit closes #1848; leave a
   comment on the closed issue noting that the 38 deferred
   sauropodomorph entries are now unblocked
