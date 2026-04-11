# Sauropodomorph Specimen Backfill Plan

Plan for backfilling missing `species.holotype.specimen_id` and
`species.holotype.institution` fields for sauropodomorph genera using
the Wikipedia [List of sauropodomorph type specimens][wiki-list] as
the source of truth, and cross-checking existing values for conflicts.

Tracked under: #1837 (specimen_id), #1838 (institution).

[wiki-list]: https://en.wikipedia.org/wiki/List_of_sauropodomorph_type_specimens

## Source

- **URL:** https://en.wikipedia.org/wiki/List_of_sauropodomorph_type_specimens
- **Rows parsed:** 476 binomials (one per type species entry)
- **Columns used:** Binomial Name, Catalogue number(s), Institution
- **Fetch method:** MediaWiki parse API (`action=parse&prop=wikitext`),
  followed by a local parser that strips `<ref>` blocks, HTML comments,
  and `[[wikilinks]]`.

Raw fetch, parse, and cross-reference scripts live under `scripts/` (the
Wikipedia parser is a one-off and lives as a scratch file; only the
cross-reference runner is ported to the scripts directory).

## Matching strategy

For each Wikipedia row we look up the genus in our dataset, then find
the species whose `name` equals the full binomial (e.g. `Aardonyx celestae`).
This intentionally skips non-type species in our files that share a
genus with a type species row on Wikipedia — those are out of scope for
this pass and will be picked up by the non-type species audit.

Institution comparisons use a loose normalization (lowercased, with
whitespace, dashes, slashes, punctuation, and quotes stripped) plus a
substring fallback. Specimen ID comparisons use the same normalization.

## Cross-reference results

Counts are as of 2026-04-11. Re-run `scripts/cross-ref-sauropodomorph.ts`
(see #TBD) after each apply pass.

| Bucket                  | Count | Treatment |
| ----------------------- | ----- | --------- |
| `notInRepo`             | 60    | Separate intake — genera we do not carry |
| `speciesNotInRepo`      | 90    | Non-type species audit — out of scope |
| `backfillBoth`          | 167   | **Apply now** — both fields empty in ours |
| `backfillSpecimenOnly`  | 1     | **Apply now** — institution already set |
| `backfillInstitutionOnly` | 0   | — |
| `match`                 | 48    | Leave alone |
| `mismatchInstitutionOnly` | 82  | Ignore — overwhelmingly formatting, not real conflicts |
| `mismatchSpecimen`      | 7     | **Review manually** — filed as a separate issue |
| `mismatchBoth`          | 21    | **Review manually** — filed with the specimen conflicts |

### Why institution mismatches are (mostly) not real

Our existing entries use formal native-language names with trailing
city (`Museo Argentino de Ciencias Naturales 'Bernardino Rivadavia', Buenos Aires`)
while Wikipedia uses anglicized short forms (`Bernardino Rivadavia Natural
Sciences Argentine Museum`). The 82 entries in `mismatchInstitutionOnly`
are almost entirely in that bucket — they refer to the same physical
institution. Normalizing the existing strings is tracked separately
(see the institution-format issue).

### Specimen conflicts worth review

These are likely real data errors in our dataset or true disagreements
between sources. Each is listed in the dedicated GH issue with the
suspected root cause.

Notable ones:

- **Apatosaurus louisae** — we have `YPM 1860`, which is the type of
  *A. ajax*, not *A. louisae*. Should be `CM 3018`.
- **Haplocanthosaurus delfsi** — we have `CM 572`, which is the type
  of *H. priscus*, not *H. delfsi*.
- **Supersaurus vivianae** — we have `BYU 5500`; Wikipedia says `BYU 9025`.
- **Venenosaurus dicrocei** — we have `DMNH 40932`, but Denver Museum
  of Natural History was renamed to Denver Museum of Nature & Science
  (DMNS) in 2000. Our prefix is stale.
- **Ligabuesaurus leanzai** — `MCF-PVPH-233` vs `MCF-PHV-233`; possible
  typo on one side.

## Backfill methodology

The backfill script (`scripts/backfill-sauropodomorph-specimens.ts`, to
be written) applies each `backfillBoth` / `backfillSpecimenOnly` entry
by:

1. Loading the genus YAML file.
2. Locating the type species (matched by full binomial against the
   Wikipedia row).
3. Setting `species.holotype.specimen_id` to the cleaned Wikipedia value.
4. Setting `species.holotype.institution` by first trying
   `resolveMuseumAbbreviation()` (the existing lookup in
   `scripts/batch-import.ts` that reads `institutions.yaml`). If the
   specimen prefix does not resolve, fall back to the cleaned Wikipedia
   institution string.
5. Writing the YAML back in place, preserving existing ordering.

Running the script with `--dry-run` prints the full diff without
touching files. Apply only after diff review.

## Open questions captured in GH issues

### Institution formatting and the `institutions.yaml` registry

- **Current state:** 1585 entries in `institutions.yaml`, sourced from
  the Wedel et al. crowdsourced vert-palaeo list and the Sabaj 2023
  MASTER LIST v9.8. The file is consumed by `batch-import.ts` via
  `resolveMuseumAbbreviation()` when enriching staged genera.
- **Existing data style is inconsistent:** some entries are in native
  formal form with trailing city (`Museo Argentino…, Buenos Aires`),
  some are Sabaj-style English short forms, some are bare English names
  without city. There is no enforced convention.
- **Unused entries:** the registry contains many entries for taxa we
  will never carry (mammalian museums, non-vertebrate repositories).
  Worth a pruning pass that keeps only abbreviations actively referenced
  by a specimen ID in the dataset.
- **Ambiguous prefixes:** some codes refer to more than one institution
  (e.g. `IGM` is used by both Instituto de Geología at UNAM, Mexico City,
  and the Mongolian Institute of Geology). The current data shape is
  `Array<Record<string, string>>` collapsed into a plain map via
  `Object.assign`, which silently discards duplicates. We need a
  disambiguation strategy — likely keyed off `species.location.country`.

### Holotype specimen ID representation

- **Current state:** `species.holotype.specimen_id` is a single string.
- **Real-world problem:** many type specimens are distributed across
  multiple catalogue numbers (syntypes, lectotype + paralectotypes,
  holotype + paratype pairs, distributed holotypes). Cross-reference
  uncovered several cases: *Tornieria africana* has five SMNS numbers,
  *Melanorosaurus readi* has a SAM 3449 + SAM 3450 syntype pair,
  *Alamosaurus sanjuanensis* has USNM 10486 holotype + 10487 paratype.
- **Preferred direction:** change `specimen_id` to `Array<string>` and
  add a sibling `specimen_type` enum (`holotype`, `syntype`, `lectotype`,
  `neotype`, `unknown`). Smallest schema change; avoids introducing a
  nested type-series object.

## Execution order

1. Write this plan document (done).
2. Write `scripts/backfill-sauropodomorph-specimens.ts` with `--dry-run`
   support and diff output.
3. Run `--dry-run` and review output before touching YAMLs.
4. Apply the backfill.
5. Regenerate `reports/missing-fields.md` and confirm the numbers
   moved in the expected direction.
6. File three GitHub issues: conflicting specimens, institution format,
   holotype schema.
7. Commit: plan, backfill script, updated YAMLs, updated missing-fields
   report. Do not auto-commit — wait for explicit approval.
