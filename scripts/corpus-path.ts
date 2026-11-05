// Resolves the local paper corpus root and Claude working-directory
// root. Both live outside the data repo because they are managed by
// separate workflows; scripts that need to read them call
// `getCorpusDir()` / `getWorkingDir()` instead of hardcoding a
// per-machine path.
//
// Overrides:
//   OPEN_PALEO_CORPUS     — root of the paper corpus
//   OPEN_PALEO_PAPERS_DIR — the same, under its older name; still accepted
//   OPEN_PALEO_WD_DIR     — root of the Claude working directory
//
// When unset, the corpus defaults to a sibling `corpus/` directory and the
// working directory to a sibling `open-paleo-wd/` directory next to this repo.

import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.join(scriptDir, "..");

/**
 * Resolves the absolute path to the local paper corpus root.
 *
 * Honors the `OPEN_PALEO_CORPUS` environment variable when set to a
 * non-empty value, then `OPEN_PALEO_PAPERS_DIR`, its older name, and
 * otherwise returns the sibling-directory default (`../corpus`
 * relative to the repo root).
 *
 * @returns Absolute path to the paper corpus root.
 */
export function getCorpusDir(): string
{
    for (const override of [process.env.OPEN_PALEO_CORPUS, process.env.OPEN_PALEO_PAPERS_DIR])
    {
        if (override !== undefined && override !== "")
        {
            return path.resolve(override);
        }
    }

    return path.resolve(repoRoot, "..", "corpus");
}

/**
 * Resolves the absolute path to the Claude working-directory root
 * (Wikipedia cache, scratch files, etc.).
 *
 * Honors the `OPEN_PALEO_WD_DIR` environment variable when set to a
 * non-empty value, otherwise returns the sibling-directory default
 * (`../open-paleo-wd` relative to the repo root).
 *
 * @returns Absolute path to the working-directory root.
 */
export function getWorkingDir(): string
{
    const override = process.env.OPEN_PALEO_WD_DIR;

    if (override !== undefined && override !== "")
    {
        return path.resolve(override);
    }

    return path.resolve(repoRoot, "..", "open-paleo-wd");
}
