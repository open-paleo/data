import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYamlContent } from "yaml";
import type { FlaggedSources, InstitutionEntry, TreeNode } from "./types.ts";

/**
 * Escapes a string for safe inclusion as a literal in a regular expression.
 *
 * @param value - The literal string to escape.
 * @returns The escaped string.
 */
export function escapeRegExp(value: string): string
{
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
 * Loads the flagged-sources registry from flagged-sources.yml.
 *
 * @param sourcesPath - Absolute path to flagged-sources.yml.
 * @returns The parsed structure, or an empty object if the file is absent.
 */
export function loadFlaggedSources(sourcesPath: string): FlaggedSources
{
    if (!fs.existsSync(sourcesPath))
    {
        return {};
    }

    return parseYamlContent(fs.readFileSync(sourcesPath, "utf8")) as FlaggedSources;
}

/**
 * Builds a case-insensitive lookup set of flagged publisher (or journal)
 * names from a FlaggedSources document. Every `beall` entry and every
 * `open_paleo_additions` name is included; matching should be done against
 * the trimmed, lowercased input.
 *
 * @param group - Either `flagged.publishers` or `flagged.journals`.
 * @returns A Set of normalized names for O(1) membership checks.
 */
export function buildFlaggedSet(group: FlaggedSources["publishers"] | FlaggedSources["journals"]): Set<string>
{
    const result = new Set<string>();

    for (const entry of group?.beall ?? [])
    {
        result.add(entry.trim().toLowerCase());
    }

    for (const addition of group?.open_paleo_additions ?? [])
    {
        result.add(addition.name.trim().toLowerCase());
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

/**
 * Reads `dist/references.bib` and returns the set of citation keys
 * present (e.g. `osmolska1996`, `funston2020a`, `funston2020b`).
 * Returns an empty set when the file is missing.
 *
 * @param bibPath - Absolute path to references.bib.
 * @returns Set of citation keys.
 */
export function readBibCitationKeys(bibPath: string): Set<string>
{
    const keys = new Set<string>();

    if (!fs.existsSync(bibPath))
    {
        return keys;
    }

    const content = fs.readFileSync(bibPath, "utf8");

    for (const match of content.matchAll(/^@\w+\{([^,]+),/gm))
    {
        keys.add(match[1].trim());
    }

    return keys;
}

/**
 * Resolves a proposed citation key against the existing bib so that
 * a bare key never coexists with biblatex-suffix variants. Mirrors
 * the disambiguation rule enforced by validate.ts check #12c.
 *
 * Cases:
 *
 * - Proposed key is already in the bib: no collision (the caller is
 *   reusing an existing reference). Returns the key unchanged.
 * - Proposed key ends with a single lowercase letter (e.g.
 *   `funston2020c`): treated as already disambiguated. Returns the
 *   key unchanged.
 * - Proposed key is bare (e.g. `funston2020`) and at least one
 *   suffix variant (`funston2020a`, ...) exists in the bib: the
 *   resolved key is `{base}{nextAvailableLetter}`.
 *
 * @param proposedKey - The citation key the caller wants to use.
 * @param existingKeys - Set of citation keys already in the bib.
 * @returns Resolution result. When `collided` is true, the caller
 *     should use `resolvedKey` instead of `proposedKey`.
 */
export function resolveCitationKey(
    proposedKey: string,
    existingKeys: Set<string>,
): { resolvedKey: string; collided: boolean; reason: string | null }
{
    if (existingKeys.has(proposedKey))
    {
        return { resolvedKey: proposedKey, collided: false, reason: null };
    }

    const lastChar = proposedKey.slice(-1);

    if (/[a-z]/.test(lastChar))
    {
        return { resolvedKey: proposedKey, collided: false, reason: null };
    }

    const escaped = escapeRegExp(proposedKey);
    const variantPattern = new RegExp(`^${escaped}[a-z]$`);

    const existingVariants = [...existingKeys]
        .filter((key) => variantPattern.test(key))
        .sort();

    if (existingVariants.length === 0)
    {
        return { resolvedKey: proposedKey, collided: false, reason: null };
    }

    const usedLetters = new Set(existingVariants.map((key) => key.slice(-1)));

    for (const letter of "abcdefghijklmnopqrstuvwxyz")
    {
        if (!usedLetters.has(letter))
        {
            return {
                resolvedKey: `${proposedKey}${letter}`,
                collided: true,
                reason: `bib has ${existingVariants.join(", ")}; bare "${proposedKey}" `
                    + "would conflict with the disambiguation rule",
            };
        }
    }

    throw new Error(
        `No available letter suffix for ${proposedKey}; all 26 are taken in the bib.`,
    );
}
