# Claude Code Instructions

## Code Style

All code in this repository — TypeScript (`scripts/`), plain JavaScript
(`docs/`), and CommonJS workflow scripts (`.github/scripts/`) — must follow
the coding style defined in [`scripts/CONTRIBUTING.md`](scripts/CONTRIBUTING.md).
Read it before writing or modifying any code.

Key rules that are easy to miss:

- **Allman brace style everywhere** — opening braces on their own line,
  including single-statement `if` bodies (no braceless one-liners)
- **Multi-line JSDoc** on all functions with `@param` and `@returns` tags
- **camelCase only** — no `SCREAMING_SNAKE_CASE` constants
- **`??` over `||`** for fallback values (nullish coalescing)
- **No abbreviated variable names** — `button` not `btn`, `element` not
  `el`, `option` not `opt`, `value` not `val`, `initialize` not `init`,
  etc. Applies everywhere including loop iterators and callback parameters
- **Collapse sequential guards into if/else** — when multiple `if` blocks
  each `return`/`continue`/`break`, chain them as `if`/`else if` instead
  of separate blocks
- **No `// ---` section dividers**

ESLint enforces formatting for `scripts/`, `docs/`, and `.github/scripts/`.
Always run `npm run lint` before considering code complete.

## Build & Verify

```
npm run build        # generates dist/ and docs/ outputs
npm run lint         # checks scripts/, docs/, and .github/scripts/
npm run typecheck    # TypeScript type checking
npm run preview      # build + serve contribution wizard at localhost:8080
```
