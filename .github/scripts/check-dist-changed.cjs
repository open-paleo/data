// Decides whether a build changed the published data. Invoked from the Build
// workflow after `npm run build`, it compares the working dist/ with the copy
// committed at HEAD. The build stamps `built_at`, `version` and `commit` into
// `_metadata` on every run, so those three fields are ignored: a run whose
// output differs only there publishes nothing, and a version always names one
// dataset. Prints `publish=true` or `publish=false` to the step's output.

const childProcess = require("node:child_process");
const fs = require("node:fs");

const volatileFields = ["built_at", "version", "commit"];

const metadataFiles = ["dist/open-paleo.json", "dist/open-paleo.yml"];

/**
 * List the dist/ paths that differ from HEAD. dist/ is gitignored and its
 * files are force-added, so a file the build newly writes is an ignored file,
 * not an untracked one; `--ignored` lists it.
 *
 * @returns {Array<string>} Repository-relative paths.
 */
function listChangedDistPaths()
{
    const output = childProcess.execFileSync(
        "git",
        ["status", "--porcelain", "--untracked-files=all", "--ignored", "--", "dist/"],
        { encoding: "utf8" });

    return output
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => line.slice(3));
}

/**
 * Parse a dataset JSON document and drop the metadata fields that change on
 * every build.
 *
 * @param {string} text - The JSON text of dist/open-paleo.json.
 * @returns {string} The document re-serialized without the volatile fields.
 */
function stripVolatileMetadata(text)
{
    const dataset = JSON.parse(text);

    for (const field of volatileFields)
    {
        delete dataset._metadata[field];
    }

    return JSON.stringify(dataset);
}

/**
 * Decide whether the working dist/ holds data that HEAD does not. Only the
 * JSON is compared field by field: the YAML is serialized from the same
 * object, so it differs exactly when the JSON does.
 *
 * @returns {boolean} True when the build should be published.
 */
function isDataChanged()
{
    const changedPaths = listChangedDistPaths();

    if (changedPaths.length === 0)
    {
        return false;
    }
    else if (changedPaths.some((changedPath) => !metadataFiles.includes(changedPath)))
    {
        return true;
    }

    const published = childProcess.execFileSync(
        "git",
        ["show", "HEAD:dist/open-paleo.json"],
        { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

    const built = fs.readFileSync("dist/open-paleo.json", "utf8");

    return stripVolatileMetadata(published) !== stripVolatileMetadata(built);
}

const publish = isDataChanged();

console.log(`publish=${publish}`);

if (process.env.GITHUB_OUTPUT)
{
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
}
