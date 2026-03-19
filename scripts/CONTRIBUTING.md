# Contributing to Open Paleo Scripts

This guide is for developers contributing to the scripts that power
Open Paleo's validation, build, and automation tooling — including
TypeScript scripts (`scripts/`), browser JavaScript (`docs/`), and
GitHub Actions workflow scripts (`.github/scripts/`). If you are
contributing **data** (genera, clades, corrections, images), see the
main [CONTRIBUTING.md](../CONTRIBUTING.md) instead.

## Technology

- **TypeScript** — build and validation scripts in `scripts/` are written
  in TypeScript
- **Node.js 24** — scripts run directly via `node --experimental-strip-types`
  with no build step required
- **Plain JavaScript** — browser code in `docs/` (ES modules) and GitHub
  Actions workflow scripts in `.github/scripts/` (CommonJS)
- **js-yaml** — the only runtime dependency, used to parse and serialize YAML

## Setup

```bash
git clone https://github.com/open-paleo/data.git
cd data
npm install
```

## Scripts

| Script                   | Command                       | Purpose                                        |
| ------------------------ | ----------------------------- | ---------------------------------------------- |
| `validate.ts`            | `npm run validate`            | Validate all YAML data against schema and tree |
| `build.ts`               | `npm run build`               | Produce output files in `dist/`                |
| `sync-forms.ts`          | `npm run sync-forms`          | Sync issue form dropdowns with schema/tree     |
| `generate-dictionary.ts` | `npm run generate-dictionary` | Generate spell check dictionary                |
| `utilities.ts`           | —                             | Shared helper functions imported by scripts    |
| —                        | `npm run preview`             | Build and serve the contribution wizard locally |

## Previewing the Contribution Wizard

The `docs/` directory contains a static contribution wizard served via
GitHub Pages. To preview it locally:

```bash
npm run preview
```

This runs the build (to generate `docs/schema.json` and
`docs/open-paleo.json`) then starts a local server at
`http://localhost:8080`. Requires **Python 3** (for `python3 -m
http.server`), which is pre-installed on macOS and most Linux
distributions.

## Code Style

All code — TypeScript (`scripts/`), browser JavaScript (`docs/`), and
CommonJS workflow scripts (`.github/scripts/`) — must follow these rules.
Formatting is enforced by ESLint with
[@stylistic/eslint-plugin](https://eslint.style/); TypeScript-specific
rules use [@typescript-eslint](https://typescript-eslint.io/):

### Formatting

- **4-space indentation**, no tabs
- **Allman brace style** — opening braces on their own line
- Double quotes for strings
- Semicolons required
- Trailing commas in multiline expressions
- Blank line after every block-like statement (`if`, `for`, `while`, etc.)
- Blank lines between type members
- **All arguments on new lines when any are split** — if a function call
  doesn't fit on one line, put every argument on its own line
- **Collapse sequential guards into if/else** — when multiple adjacent
  `if` blocks each `return`, `continue`, or `break`, chain them as
  `if`/`else if` instead of separate blocks
- **No section separators** — do not use `// ------` dividers between
  sections; use plain comments instead

### Functions & callbacks

- **Arrow functions for callbacks** — use `() => { }` for event handlers,
  `.map()`, `.filter()`, `.find()`, `.then()`, and any other callback.
  Only use `function` when you need the callback's own `this` binding
  (rare), for named function declarations, or for IIFEs/module patterns.
- **Omit braces for single-expression arrows** — write
  `(option) => option.name` not `(option) => { return option.name; }`

### Naming

- **camelCase** for all identifiers (variables, functions, parameters)
  — no `SCREAMING_SNAKE_CASE` constants
- **PascalCase** for types
- **No leading or trailing underscores** — use descriptive names instead
  (e.g., `scriptDir` not `__dirname`)
- Single `_` is allowed only for unused callback parameters
- **No abbreviated variable names** — write out full words. Use
  `button` not `btn`, `element` not `el`, `option` not `opt`,
  `value` not `val`, `error` not `err`, `reference` not `ref`,
  `index` not `idx`, `message` not `msg`, `event` not `evt`,
  `response` not `res`, `checkbox` not `cb`, `condition` not `cond`,
  `initialize` not `init`.
  This applies to all variables, parameters, and loop iterators —
  including short callbacks (e.g., `.map((option) => ...)` not
  `.map((o) => ...)`)

### Imports (TypeScript only)

- **Namespace imports** for Node.js built-ins — `import * as fs from "node:fs"`,
  never `import { readFileSync } from "fs"`
- **`node:` protocol required** — always use `node:fs`, `node:path`, `node:url`, etc.
- **`import type`** for type-only imports

### General style

These rules apply to all code — TypeScript, browser JavaScript, and
CommonJS workflow scripts alike:

- **`??` over `||` for fallback values** — use nullish coalescing for
  default values (e.g., `schema.status ?? []`); reserve `||` for boolean logic
- **`const` by default** — only use `let` when reassignment is necessary
- **No unnecessary wrappers** — do not call `String()` on values already
  known to be strings, or wrap in other identity conversions
- **Inline single-use variables** — do not create intermediate variables
  that are only used once on the next line (e.g., prefer
  `for (const file of findYamlFiles(dir))` over
  `const files = findYamlFiles(dir); for (const file of files)`)
- **Collapse guard clauses** — prefer `if (x && x.y)` over
  `if (!x) { continue; } if (x.y)` when only a single check follows

### TypeScript (scripts/ only)

These rules apply only to TypeScript features (types, imports, generics):

- **`type` over `interface`** — always use `type` aliases, never `interface`
- **`Array<T>` over `T[]`** — always use the generic syntax
- **`new Array<T>()`** to initialize empty arrays — not `[] as Array<T>` or
  `const x: Array<T> = []`
- **No `any`** — use proper types or `unknown` with type guards
- **Omit inferable type annotations on variables** — if the type is obvious
  from the right-hand side (a constructor, `as` cast, literal, or function
  return), do not annotate the variable. Keep explicit annotations on
  function parameters and return types.
- **Shared types** live in `scripts/types.ts` and are imported by each script
- **Shared utilities** live in `scripts/utilities.ts` — reusable functions
  like `findYamlFiles`, `collectAllKeys`, and `parseYaml` belong here;
  do not duplicate them in individual scripts

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
# Check for lint and style errors (scripts/, docs/, .github/scripts/)
npm run lint

# Auto-fix lint and style errors
npm run lint:fix

# Type check (no output files produced)
npm run typecheck
```

All three checks (`lint`, `typecheck`) run in CI on every pull request.
Fix any failures before requesting review.

## Adding a New Validation Check

1. Add a new section in `validate.ts` following the existing pattern:

    ```typescript
    startCheck("My new check");

    for (const [filePath, doc] of genusParsed)
    {
        // ... validation logic ...
        checkError("My new check", filePath, "description of the problem");
    }
    ```

2. Update the check count in the main `README.md` if referenced
3. Run `npm run validate` locally to verify

## Modifying Build Outputs

If you change the structure of any output format in `build.ts`:

1. Update `_metadata.schema_version` according to semver rules
   (see section 9.3 of the project plan)
2. Update `CHANGELOG.md` with the schema change
3. Run `npm run build` and verify all output files

## Types

Shared type definitions live in `scripts/types.ts`. If you add a new
field to the YAML schema, add the corresponding property to the
appropriate type. Keep types in sync with `schema.yml`.

Each field in a type must have a multi-line JSDoc comment, and fields
must be separated by blank lines:

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

Shared helper functions live in `scripts/utilities.ts`. Before adding
a helper function to an individual script, check whether it already
exists here or belongs here:

- `parseYaml<T>(filePath)` — parse a YAML file with a typed result
- `findYamlFiles(dir)` — recursively find all `.yml`/`.yaml` files
- `collectAllKeys(node)` — collect all clade names from a tree node
