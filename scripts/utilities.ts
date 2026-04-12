import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYamlContent } from "yaml";
import type { InstitutionEntry, TreeNode } from "./types.ts";

/**
 * Parses a YAML file and returns the result cast to the specified type.
 *
 * @param filePath - Absolute path to the YAML file.
 * @returns The parsed YAML content cast to type T.
 */
export function parseYaml<T>(filePath: string): T
{
    return parseYamlContent(fs.readFileSync(filePath, "utf8")) as T;
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
 * Loads the institution registry from institutions.yaml.
 *
 * @param registryPath - Absolute path to institutions.yaml.
 * @returns A record of canonical abbreviation keys to institution entries.
 */
export function loadInstitutionRegistry(registryPath: string): Record<string, InstitutionEntry>
{
    return parseYamlContent(
        fs.readFileSync(registryPath, "utf8"),
    ) as Record<string, InstitutionEntry>;
}

/**
 * Flattens an institution registry into an abbreviation-to-display-name
 * map. Every canonical key and alias maps to the institution's display
 * name (name + city when available). This provides backward
 * compatibility with code that expects a flat lookup table.
 *
 * @param registry - The structured institution registry.
 * @returns A flat record mapping every abbreviation to a display name.
 */
export function flattenInstitutionMap(registry: Record<string, InstitutionEntry>): Record<string, string>
{
    const result: Record<string, string> = {};

    for (const [key, entry] of Object.entries(registry))
    {
        const displayName = entry.location?.city
            ? `${entry.name}, ${entry.location.city}`
            : entry.name;

        result[key] = displayName;

        if (entry.aliases)
        {
            for (const alias of entry.aliases)
            {
                result[alias] = displayName;
            }
        }
    }

    return result;
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
