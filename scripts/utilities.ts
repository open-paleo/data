import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { TreeNode } from "./types.ts";

/**
 * Parses a YAML file and returns the result cast to the specified type.
 *
 * @param filePath - Absolute path to the YAML file.
 * @returns The parsed YAML content cast to type T.
 */
export function parseYaml<T>(filePath: string): T
{
    return yaml.load(fs.readFileSync(filePath, "utf8")) as T;
}

/**
 * Recursively finds all YAML files in a directory tree.
 *
 * @param dir - The root directory to search.
 * @returns An array of absolute paths to .yml/.yaml files.
 */
export function findYamlFiles(dir: string): Array<string>
{
    const results = new Array<string>();

    if (!fs.existsSync(dir))
    {
        return results;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true }))
    {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory())
        {
            results.push(...findYamlFiles(full));
        }
        else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))
        {
            results.push(full);
        }
    }

    return results;
}

/**
 * Recursively collects all clade names from a tree node.
 *
 * @param node - The tree node to traverse.
 * @returns A flat array of all clade names in the tree.
 */
export function collectAllKeys(node: TreeNode): Array<string>
{
    const keys = new Array<string>();

    for (const [key, children] of Object.entries(node))
    {
        keys.push(key);

        if (children && typeof children === "object" && Object.keys(children).length > 0)
        {
            keys.push(...collectAllKeys(children as TreeNode));
        }
    }

    return keys;
}
