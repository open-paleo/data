# Contributing to Open Paleo Scripts

This guide is for developers contributing to the scripts that power Open Paleo's validation, build, and automation tooling — including TypeScript scripts (`scripts/`) and GitHub Actions workflow scripts (`.github/scripts/`). If you are contributing **data** (genera, clades, corrections, images), see the main [CONTRIBUTING.md](../CONTRIBUTING.md) instead.

## Technology

- **TypeScript** — build and validation scripts in `scripts/` are written in TypeScript
- **Node.js 24** — scripts run directly via `node --experimental-strip-types` with no build step required
- **TypeScript 7** — `npm run typecheck` runs the native compiler; see [Dependencies](#dependencies) for why `typescript` itself is on 6.0
- **Plain JavaScript** — GitHub Actions workflow scripts in `.github/scripts/` (CommonJS)
- **yaml** — the runtime YAML dependency, used to parse and serialize YAML

## Setup

```bash
git clone https://github.com/open-paleo/data.git
cd data
npm install
```

## Dependencies

- **Pin every dependency to an exact version** — `"yaml": "2.8.3"`, never `"^2.8.3"` or `"~2.8.3"`. Upgrades are deliberate edits to `package.json`, not something `npm install` does on its own. The repository's `.npmrc` sets `save-exact=true`, so `npm install <package>` writes an exact version
- **TypeScript 7 sits beside TypeScript 6.** TypeScript 7 is the native compiler and ships no JavaScript API, which typescript-eslint needs. The `typescript` entry is therefore an alias for `@typescript/typescript6`, which is what ESLint loads, and TypeScript 7 is installed as `typescript7`. `npm run typecheck` calls `node_modules/typescript7/bin/tsc` by path, because the TypeScript 6 package also installs a `tsc` binary. Drop the alias once typescript-eslint supports TypeScript 7

## Scripts

Run each script with `npm run <command>`; pass arguments after `--`. Scripts that read the local paper corpus are described under [Paper corpus and working directory](../CONTRIBUTING.md#paper-corpus-and-working-directory) in the main CONTRIBUTING.md.

### Validation and build

| Script                   | Command               | Purpose |
| ------------------------ | --------------------- | ------- |
| `validate.ts`            | `validate`            | Validate all YAML data against schema and tree; the checks live in one module per family under `validate/` |
| `build.ts`               | `build`               | Produce output files in `dist/` |
| —                        | `generate-bindings`   | Regenerate the TypeScript and Python bindings in `dist/bindings/` from the JSON Schema |
| `generate-dictionary.ts` | `generate-dictionary` | Generate the spell-check dictionary `dictionaries/taxonomy.txt` |
| `spellcheck.ts`          | `spellcheck`          | Spell-check prose fields into `scratch/spellcheck.md`; exits 1 on any unknown word, and runs on pull requests |
| `research.ts`            | `research`            | Print the research notes for a record; `--references <file>` regenerates a note's reference list |

### Reports and audits

| Script                           | Command                        | Purpose |
| -------------------------------- | ------------------------------ | ------- |
| `report-missing-fields.ts`       | `report-missing-fields`        | Report which genera are missing which fields |
| `verify-data-integrity.ts`       | `verify-data-integrity`        | Self-consistency checks for values that likely belong to another species or specimen |
| `audit-dois.ts`                  | `audit-dois`                   | Check reference DOIs against Crossref |
| `audit-cited-papers.ts`          | `audit-cited-papers`           | Check that the corpus paper filed under each cited key is the paper the store describes |
| `diagnostic-corpus-candidates.ts`| `diagnostic-corpus-candidates` | List the corpus papers that could carry a genus's erecting or describing paper |
| `paper-watch.ts`                 | `paper-watch`                  | Find newly published papers on OpenAlex for the daily Paper Watch issue |

### Intake and backfill

| Script                                | Command                                        | Purpose |
| ------------------------------------- | ---------------------------------------------- | ------- |
| `intake-bootstrap.ts`, `intake-resume.ts`, `intake-apply.ts` | `intake-bootstrap`, `intake-resume`, `intake-apply` | Per-genus intake: seed a stub, build extraction prompts, merge the extractions |
| `intake-species-bootstrap.ts`, `intake-species-resume.ts`, `intake-species-apply.ts` | `intake-species-bootstrap`, `intake-species-resume`, `intake-species-apply` | The same steps for a non-type species added to an existing genus |
| `build-extraction-prompts.ts`         | `build-extraction-prompts`                     | Build the work queue and extraction prompts for the paper-field backfill |
| `normalize-extractions.ts`            | `normalize-extractions`                        | Normalize characters in backfill extraction JSON |
| `strip-specimen-ids-from-material.ts` | `strip-specimen-ids`                           | Strip catalog numbers from extracted material text; dry run unless `--apply` |
| `spellcheck-extractions.ts`           | `spellcheck-extractions`                       | Spell-check extracted text before it is applied |
| `apply-paper-field-extractions.ts`    | `apply-paper-fields`                           | Write extracted material and diagnoses into genus files; dry run unless `--apply` |
| `normalize-genera-text.ts`            | `normalize-genera-text`                        | Replace cosmetic non-ASCII characters in genus files |

### Shared modules

| Module                                   | Purpose |
| ---------------------------------------- | ------- |
| `utilities.ts`                           | Shared helper functions imported by scripts |
| `types.ts`                               | Shared type definitions for the YAML data |
| `corpus-path.ts`                         | Resolve the paper corpus and working directory |
| `intake-shared.ts`, `intake-types.ts`, `genus-enrichment.ts` | Steps, extraction types and PBDB/Wikipedia/Wikidata fetching shared by the intake scripts |

## Code Style

All code — TypeScript (`scripts/`) and CommonJS workflow scripts (`.github/scripts/`) — must follow these rules. Formatting is enforced by ESLint with [@stylistic/eslint-plugin](https://eslint.style/); TypeScript-specific rules use [@typescript-eslint](https://typescript-eslint.io/):

### Formatting

- **4-space indentation**, no tabs
- **Allman brace style** — opening braces on their own line
- Double quotes for strings
- Semicolons required
- Trailing commas in multiline expressions
- Blank line after every block-like statement (`if`, `for`, `while`, etc.)
- Blank lines between type members
- **All arguments on new lines when any are split** — if a function call doesn't fit on one line, put every argument on its own line
- **Collapse sequential guards into if/else** — when multiple adjacent `if` blocks each `return`, `continue`, or `break`, chain them as `if`/`else if` instead of separate blocks
- **No section separators** — do not use `// ------` dividers between sections; use plain comments instead

### Functions & callbacks

- **Arrow functions for callbacks** — use `() => { }` for event handlers, `.map()`, `.filter()`, `.find()`, `.then()`, and any other callback. Only use `function` when you need the callback's own `this` binding (rare), for named function declarations, or for IIFEs/module patterns.
- **Omit braces for single-expression arrows** — write `(option) => option.name` not `(option) => { return option.name; }`

### Naming

- **camelCase** for all identifiers (variables, functions, parameters) — no `SCREAMING_SNAKE_CASE` constants
- **PascalCase** for types
- **No leading or trailing underscores** — use descriptive names instead (e.g., `scriptDir` not `__dirname`)
- Single `_` is allowed only for unused callback parameters
- **No abbreviated variable names** — write out full words. Use `button` not `btn`, `element` not `el`, `option` not `opt`, `value` not `val`, `error` not `err`, `reference` not `ref`, `index` not `idx`, `message` not `msg`, `event` not `evt`, `response` not `res`, `checkbox` not `cb`, `condition` not `cond`, `initialize` not `init`. This applies to all variables, parameters, and loop iterators — including short callbacks (e.g., `.map((option) => ...)` not `.map((o) => ...)`)

### Imports (TypeScript only)

- **Namespace imports** for Node.js built-ins — `import * as fs from "node:fs"`, never `import { readFileSync } from "fs"`
- **`node:` protocol required** — always use `node:fs`, `node:path`, `node:url`, etc.
- **`import type`** for type-only imports

### General style

These rules apply to all code — TypeScript and CommonJS workflow scripts alike:

- **`??` over `||` for fallback values** — use nullish coalescing for default values (e.g., `schema.status ?? []`); reserve `||` for boolean logic
- **`const` by default** — only use `let` when reassignment is necessary
- **No unnecessary wrappers** — do not call `String()` on values already known to be strings, or wrap in other identity conversions
- **Inline single-use variables** — do not create intermediate variables that are only used once on the next line (e.g., prefer `for (const file of findYamlFiles(dir))` over `const files = findYamlFiles(dir); for (const file of files)`)
- **Collapse guard clauses** — prefer `if (x && x.y)` over `if (!x) { continue; } if (x.y)` when only a single check follows

### TypeScript (scripts/ only)

These rules apply only to TypeScript features (types, imports, generics):

- **`type` over `interface`** — always use `type` aliases, never `interface`
- **`Array<T>` over `T[]`** — always use the generic syntax
- **`new Array<T>()`** to initialize empty arrays — not `[] as Array<T>` or `const x: Array<T> = []`
- **No `any`** — use proper types or `unknown` with type guards
- **Omit inferable type annotations on variables** — if the type is obvious from the right-hand side (a constructor, `as` cast, literal, or function return), do not annotate the variable. Keep explicit annotations on function parameters and return types.
- **Shared types** live in `scripts/types.ts` and are imported by each script
- **Shared utilities** live in `scripts/utilities.ts` — reusable functions like `findYamlFiles`, `collectAllKeys`, and `parseYaml` belong here; do not duplicate them in individual scripts

### Documentation

- **Multi-line JSDoc** for all exported types, type fields, and functions
- Blank line between description and `@param`/`@returns` tags
- Type fields each get their own `/** ... */` block, separated by blank lines

### Example

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import type { GenusData } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

for (const file of findYamlFiles(path.join(root, "genera")))
{
    const data = parseYaml<GenusData>(file);

    if (data && data.genus)
    {
        console.log(data.genus);
    }
}
```

## Linting

```bash
# Check for lint and style errors (scripts/, .github/scripts/)
npm run lint

# Auto-fix lint and style errors
npm run lint:fix

# Type check (no output files produced)
npm run typecheck
```

Both checks (`lint`, `typecheck`) run in CI on every pull request, alongside `validate` and `spellcheck`. Fix any failures before requesting review.

## Adding a New Validation Check

1. Add a check function to the family module under `validate/` it belongs to (`records.ts`, `references.ts`, `stratigraphy.ts`, `prose.ts`, `specimens.ts` or `research.ts`). It takes the loaded context and pulls out what it reads:

    ```typescript
    /**
     * The "My new check" check.
     *
     * What it catches and why.
     *
     * @param context - The loaded data the checks read.
     */
    export function checkMyNewCheck(context: ValidationContext): void
    {
        const { genusParsed } = context;

        for (const [filePath, doc] of genusParsed)
        {
            // ... validation logic ...
            checkError("My new check", filePath, "description of the problem");
        }
    }
    ```

   Data more than one check reads is loaded once in `validate/context.ts`.

2. Add `["My new check", checkMyNewCheck]` to the `checks` list in `validate.ts`, where the summary should list it. A check that throws is reported as an error against itself and the others still run.
3. Run `npm run validate` locally to verify, and test the check by reintroducing each defect it targets: passing on clean data proves nothing

## Modifying Build Outputs

If you change the structure of any output format in `build.ts`:

1. Update `schemas/open-paleo.schema.json` to match the new output
2. Update `_metadata.schema_version` according to the semver rules in [docs/VERSIONING.md](../docs/VERSIONING.md)
3. Update `CHANGELOG.md` with the schema change
4. Run `npm run build` and verify all output files

## Types

Shared type definitions live in `scripts/types.ts`. If you add a new field to the YAML schema, add the corresponding property to the appropriate type. Keep types in sync with `schema.yml`.

Each field in a type must have a multi-line JSDoc comment, and fields must be separated by blank lines:

```typescript
/**
 * Top-level data structure for a genus YAML file.
 */
export type GenusData = {
    /**
     * Genus name (must match the filename).
     */
    genus?: string;

    /**
     * Parent clade in tree.yml where this genus is placed.
     */
    parent?: string;
};
```

## Utilities

Shared helper functions live in `scripts/utilities.ts`. Before adding a helper function to an individual script, check whether it already exists here or belongs here:

- `parseYaml<T>(filePath)` — parse a YAML file with a typed result
- `findYamlFiles(dir)` — recursively find all `.yml`/`.yaml` files
- `collectAllKeys(node)` — collect all clade names from a tree node
