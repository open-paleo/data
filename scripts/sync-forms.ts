import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import type { TreeNode, Schema } from "./types.ts";
import { collectAllKeys, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const root = path.join(scriptDir, "..");

const checkMode = process.argv.includes("--check");

const schema = parseYaml<Schema>(path.join(root, "schema.yml"));
const tree = parseYaml<TreeNode>(path.join(root, "tree.yml"));

/**
 * Retrieves the sorted list of allowed values for a given source and key.
 * Used to populate issue form dropdown options.
 *
 * @param source - The source file ("tree.yml" or "schema.yml").
 * @param key - The key within the source to look up (e.g. "clades", "status").
 * @returns A sorted array of string values, or an empty array if not found.
 */
function getSourceValues(source: string, key: string): Array<string>
{
    if (source === "tree.yml")
    {
        if (key === "clades")
        {
            return collectAllKeys(tree).sort();
        }
    }
    else if (source === "schema.yml")
    {
        const value = (schema as Record<string, unknown>)[key];

        if (Array.isArray(value))
        {
            return value.sort();
        }
        else if (value && typeof value === "object")
        {
            return Object.keys(value as Record<string, unknown>).sort();
        }
    }

    return [ ];
}

const templatesDir = path.join(root, ".github", "ISSUE_TEMPLATE");

if (!fs.existsSync(templatesDir))
{
    console.log("No issue templates directory found at .github/ISSUE_TEMPLATE/");
    process.exit(0);
}

const templateFiles = fs
    .readdirSync(templatesDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

if (templateFiles.length === 0)
{
    console.log("No YAML issue template files found.");
    process.exit(0);
}

const syncPattern = /^([ \t]*options:\s+# sync:([^\s:]+):([^\s]+))\s*\n((?:[ \t]*- .+\n?)*)/gm;

const outOfSync = new Array<string>();

for (const file of templateFiles)
{
    const filePath = path.join(templatesDir, file);
    const original = fs.readFileSync(filePath, "utf8");

    let updated = original;

    updated = updated.replace(
        syncPattern,
        (match: string, header: string, source: string, key: string, _: string): string =>
        {
            const values = getSourceValues(source, key);

            if (values.length === 0)
            {
                return match;
            }

            const indentHeader = (header.match(/^([ \t]*)/) as RegExpMatchArray)[1];
            const indentItem = indentHeader + "  ";

            const options = values
                .map((value) => `${indentItem}- ${value}`)
                .join("\n") + "\n";

            return `${header}\n${options}`;
        },
    );

    if (updated !== original)
    {
        if (checkMode)
        {
            outOfSync.push(file);
        }
        else
        {
            fs.writeFileSync(filePath, updated);
            console.log(`Updated: ${file}`);
        }
    }
}

if (checkMode)
{
    if (outOfSync.length > 0)
    {
        console.error("The following issue templates are out of sync:");

        for (const file of outOfSync)
        {
            console.error(`  - ${file}`);
        }

        process.exit(1);
    }
    else
    {
        console.log("All issue templates are in sync.");
    }
}
else if (outOfSync.length === 0 && templateFiles.length > 0)
{
    console.log("All issue templates already up to date.");
}
