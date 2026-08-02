# Claude Code Instructions

## Code Style

All code in this repository — TypeScript (`scripts/`) and CommonJS workflow
scripts (`.github/scripts/`) — must follow the coding style defined in
[`scripts/CONTRIBUTING.md`](scripts/CONTRIBUTING.md).
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

ESLint enforces formatting for `scripts/` and `.github/scripts/`.
Always run `npm run lint` before considering code complete.

## Git Workflow

**Do not commit or push unless explicitly told to.** Always show changes
and wait for the user to say to commit/push.

## Generated Output and Work Tracking

**Everything generated goes in `scratch/`, and nothing in `scratch/` is ever
committed.** Reports, caches, extraction prompts, audit slices, triage
checklists — all of it is regenerable from the data plus the corpus, and the
whole directory is gitignored with no exceptions.

If something under `scratch/` turns out to be worth keeping, that is a signal
it belongs in a **GitHub issue**, not in the repository. Work items that run
long, need stopping points, or span more than a session or two are tracked as
issues; do not create a checked-in file to track them.

The one exception is state a skill itself reads and writes, which lives beside
that skill's scripts — for example
`.claude/skills/audit-disputes/reaudit-queue.yml`.

## Build & Verify

```
npm run build        # generates dist/ outputs
npm run lint         # checks scripts/ and .github/scripts/
npm run typecheck    # TypeScript type checking
npm run validate     # validates the dataset
```
