---
name: report
description: Regenerate the missing-fields report on demand and show the summary. The report is derived purely from the genus YAMLs and is not checked in (gitignored) — generate it temporarily whenever you need to see which genera are missing which fields. Use when the user asks what fields are missing, how complete the dataset is, or which genera still need a given field.
user-invocable: true
argument-hint: "[field]"
allowed-tools: Bash Read
---

# Report

Generate `scratch/missing-fields.md` on demand (it is gitignored — a
pure function of the data, like `dist/`). Never commit it.

## Steps

1. Regenerate:
   ```
   npm run report-missing-fields
   ```
   This writes `scratch/missing-fields.md` (1391 genera) and prints a
   one-line confirmation.

2. Show the per-field summary (the `**field**: N missing (P%)` block at
   the top):
   ```
   grep -E '^\- \*\*.*missing \([0-9.]+%\)' scratch/missing-fields.md
   ```

3. If the user named a field (the optional argument), show that field's
   genus list:
   ```
   sed -n '/^### <field> (/,/^$/p' scratch/missing-fields.md
   ```
   e.g. `### species.type_specimen.material (124)`.

## Notes

- The file is regenerable and gitignored; do not stage or commit it.
- Long-term progress tracking lives in the per-field GitHub issues
  (e.g. diagnostic_features #1827, species.type_specimen.material #1833);
  refresh their summary counts periodically rather than committing the
  report.
- The `media` field is intentionally excluded from the report.
