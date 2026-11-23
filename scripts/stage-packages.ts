import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

/**
 * The part of an npm package manifest this script reads and changes.
 */
type PackageManifest = {
    /**
     * Package name, e.g. "@open-paleo/types".
     */
    name: string;

    /**
     * Package version; a placeholder in the checked-in template.
     */
    version: string;

    /**
     * Set in the template so it cannot be published by mistake; removed
     * from the staged copy.
     */
    private?: boolean;
};

/**
 * The part of the built dataset this script reads.
 */
type DatasetMetadata = {
    /**
     * Release metadata of the built dataset.
     */
    _metadata: {
        /**
         * Semantic version of the output schema.
         */
        schema_version: string;
    };
};

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const templateRoot = path.join(root, "packages");
const stageRoot = path.join(root, "scratch", "packages");
const pythonVersionPlaceholder = "version = \"0.0.0\"";

/**
 * Reads the output schema version from the built dataset, which is the
 * version both packages are published under.
 *
 * @param datasetPath - Path to the built `open-paleo.json`.
 * @returns The `_metadata.schema_version` of the dataset.
 */
function readSchemaVersion(datasetPath: string): string
{
    const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as DatasetMetadata;
    const version = dataset._metadata?.schema_version;

    if (!version)
    {
        throw new Error(`${datasetPath} has no _metadata.schema_version`);
    }

    return version;
}

/**
 * Fails when the schema in `dist/` differs from the one in `schemas/`: the
 * build has not run since the schema changed, so the bindings and the version
 * in `dist/` describe an older output.
 */
function assertDistIsCurrent(): void
{
    const sourceSchema = fs.readFileSync(path.join(root, "schemas", "open-paleo.schema.json"), "utf8");
    const builtSchema = fs.readFileSync(path.join(root, "dist", "open-paleo.schema.json"), "utf8");

    if (sourceSchema !== builtSchema)
    {
        throw new Error("dist/open-paleo.schema.json differs from schemas/open-paleo.schema.json; run npm run build and npm run generate-bindings first");
    }
}

/**
 * Empties a package's staging directory, creating it if needed.
 *
 * @param stageDir - The staging directory.
 */
function resetStageDir(stageDir: string): void
{
    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.mkdirSync(stageDir, { recursive: true });
}

/**
 * Copies a file into a staged package, creating its directory and failing
 * with the source path when the file is missing.
 *
 * @param source - Path of the file to copy.
 * @param target - Path of the copy.
 */
function stageFile(source: string, target: string): void
{
    if (!fs.existsSync(source))
    {
        throw new Error(`${source} is missing; run npm run build and npm run generate-bindings first`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
}

/**
 * Stages the npm package `@open-paleo/types`: the TypeScript declarations
 * and the JSON Schema, with the template's manifest set to the version and
 * no longer private.
 *
 * @param version - The version to stage.
 * @returns The staged package's name.
 */
function stageNpmPackage(version: string): string
{
    const templateDir = path.join(templateRoot, "types");
    const stageDir = path.join(stageRoot, "types");
    const manifest = JSON.parse(fs.readFileSync(path.join(templateDir, "package.json"), "utf8")) as PackageManifest;

    manifest.version = version;
    delete manifest.private;

    resetStageDir(stageDir);
    fs.writeFileSync(path.join(stageDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    stageFile(path.join(templateDir, "README.md"), path.join(stageDir, "README.md"));
    stageFile(path.join(root, "LICENSE"), path.join(stageDir, "LICENSE"));
    stageFile(path.join(root, "dist", "bindings", "open-paleo.d.ts"), path.join(stageDir, "index.d.ts"));
    stageFile(path.join(root, "dist", "open-paleo.schema.json"), path.join(stageDir, "schema.json"));

    return manifest.name;
}

/**
 * Stages the Python package `open-paleo`: the Pydantic models as the
 * `open_paleo` module, the JSON Schema as package data and a `py.typed`
 * marker, with the template's `pyproject.toml` set to the version.
 *
 * @param version - The version to stage.
 * @returns The staged package's name.
 */
function stagePythonPackage(version: string): string
{
    const templateDir = path.join(templateRoot, "python");
    const stageDir = path.join(stageRoot, "python");
    const moduleDir = path.join(stageDir, "src", "open_paleo");
    const project = fs.readFileSync(path.join(templateDir, "pyproject.toml"), "utf8");

    if (project.split(pythonVersionPlaceholder).length !== 2)
    {
        throw new Error(`packages/python/pyproject.toml must contain exactly one line ${pythonVersionPlaceholder}`);
    }

    resetStageDir(stageDir);
    fs.writeFileSync(path.join(stageDir, "pyproject.toml"), project.replace(pythonVersionPlaceholder, `version = "${version}"`));
    stageFile(path.join(templateDir, "README.md"), path.join(stageDir, "README.md"));
    stageFile(path.join(root, "LICENSE"), path.join(stageDir, "LICENSE"));
    stageFile(path.join(root, "dist", "bindings", "open_paleo.py"), path.join(moduleDir, "__init__.py"));
    stageFile(path.join(root, "dist", "open-paleo.schema.json"), path.join(moduleDir, "schema.json"));
    fs.writeFileSync(path.join(moduleDir, "py.typed"), "");

    return "open-paleo";
}

assertDistIsCurrent();

const version = readSchemaVersion(path.join(root, "dist", "open-paleo.json"));

console.log(`Staged ${stageNpmPackage(version)}@${version} in scratch/packages/types`);
console.log(`Staged ${stagePythonPackage(version)} ${version} in scratch/packages/python`);
