import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

/**
 * The part of a package manifest this script reads and changes.
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

const templateDir = path.join(root, "packages", "types");
const stageDir = path.join(root, "scratch", "packages", "types");

/**
 * Reads the output schema version from the built dataset, which is the
 * version the types package is published under.
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
 * Copies a file into the staged package, failing with the source path when
 * the file is missing.
 *
 * @param source - Path of the file to copy.
 * @param target - File name inside the staged package.
 */
function stageFile(source: string, target: string): void
{
    if (!fs.existsSync(source))
    {
        throw new Error(`${source} is missing; run npm run build and npm run generate-bindings first`);
    }

    fs.copyFileSync(source, path.join(stageDir, target));
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

assertDistIsCurrent();

const version = readSchemaVersion(path.join(root, "dist", "open-paleo.json"));
const manifest = JSON.parse(fs.readFileSync(path.join(templateDir, "package.json"), "utf8")) as PackageManifest;

manifest.version = version;
delete manifest.private;

fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });
fs.writeFileSync(path.join(stageDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

stageFile(path.join(templateDir, "README.md"), "README.md");
stageFile(path.join(root, "LICENSE"), "LICENSE");
stageFile(path.join(root, "dist", "bindings", "open-paleo.d.ts"), "index.d.ts");
stageFile(path.join(root, "dist", "open-paleo.schema.json"), "schema.json");

console.log(`Staged ${manifest.name}@${version} in ${path.relative(root, stageDir)}`);
