// Resolves the local paper corpus root. The papers live outside the
// data repo because they are heavyweight markdown extractions managed
// by a separate workflow; scripts that need to read them call
// `getCorpusDir()` instead of hardcoding a per-machine path.
//
// Override with the `OPEN_PALEO_PAPERS_DIR` environment variable.
// When unset, defaults to a sibling `open-paleo-papers/` directory
// next to this repo — the convention assumed by the bootstrap docs.

import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.join(scriptDir, "..");

/**
 * Resolves the absolute path to the local paper corpus root.
 *
 * Honors the `OPEN_PALEO_PAPERS_DIR` environment variable when set
 * to a non-empty value, otherwise returns the sibling-directory
 * default (`../open-paleo-papers` relative to the repo root).
 *
 * @returns Absolute path to the paper corpus root.
 */
export function getCorpusDir(): string
{
    const override = process.env.OPEN_PALEO_PAPERS_DIR;

    if (override !== undefined && override !== "")
    {
        return path.resolve(override);
    }

    return path.resolve(repoRoot, "..", "open-paleo-papers");
}
