/**
 * One-time normalization script for genus YAML files.
 * Parses each file and re-serializes it using the shared formatting
 * conventions (lineWidth 72, flow coordinates, quoted pages/doi/isbn,
 * .0 on float fields) so that future wizard-generated diffs apply cleanly.
 *
 * Usage: node --experimental-strip-types scripts/normalize-yaml.ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Document, isScalar, isSeq, parse as parseYaml, visit } from "yaml";
import type { Scalar } from "yaml";

const floatFields = new Set(["from_ma", "to_ma", "length_m", "hip_height_m", "skull_length_m"]);
const quotedFields = new Set(["pages", "doi", "isbn"]);

/**
 * Serializes a data object to YAML with the project's formatting conventions.
 *
 * @param data - The object to serialize.
 * @returns The YAML string.
 */
function serializeYaml(data: unknown): string
{
    const document = new Document(data);

    visit(document, {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- yaml library API
        Pair(key, pair)
        {
            const name = (pair.key as Scalar)?.value;

            if (name === "coordinates" && isSeq(pair.value))
            {
                pair.value.flow = true;
            }

            if (quotedFields.has(name as string) && isScalar(pair.value) && typeof pair.value.value === "string")
            {
                pair.value.type = "QUOTE_DOUBLE";
            }
        },
    });

    let result = document.toString({ lineWidth: 72 });

    for (const field of floatFields)
    {
        result = result.replace(
            new RegExp("(" + field + ": )(\\d+)$", "gm"),
            (match, prefix, digits) => prefix + digits + ".0",
        );
    }

    return result;
}

/**
 * Recursively collects all .yml files under a directory.
 *
 * @param directory - The directory to scan.
 * @returns An array of file paths.
 */
function collectYamlFiles(directory: string): Array<string>
{
    const results: Array<string> = [];

    for (const entry of readdirSync(directory))
    {
        const fullPath = join(directory, entry);
        const stats = statSync(fullPath);

        if (stats.isDirectory())
        {
            results.push(...collectYamlFiles(fullPath));
        }
        else if (entry.endsWith(".yml"))
        {
            results.push(fullPath);
        }
    }

    return results;
}

const generaDir = "genera";
const files = collectYamlFiles(generaDir);
let changed = 0;

for (const filePath of files)
{
    const original = readFileSync(filePath, "utf8");
    const data = parseYaml(original);
    const normalized = serializeYaml(data);

    if (original !== normalized)
    {
        writeFileSync(filePath, normalized);
        console.log(`Normalized: ${filePath}`);
        changed++;
    }
}

console.log(`\nDone. ${changed} of ${files.length} files updated.`);
