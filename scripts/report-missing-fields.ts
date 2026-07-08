import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import type { GenusData, Species } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const outputPath = path.join(root, "reports", "missing-fields.md");

/**
 * Descriptor for a single field presence check.
 */
type FieldCheck = {
    /**
     * Human-readable field path (e.g. "species.type_specimen.specimen_id").
     */
    label: string;

    /**
     * Scope the check operates on: the whole genus record, or the
     * representative species (type species, or the first species when
     * no type is marked).
     */
    scope: "genus" | "species";

    /**
     * Returns true when the field is considered populated on the given target.
     */
    isPresent: (target: GenusData | Species) => boolean;
};

/**
 * Determines whether a value counts as "present" (non-null, non-empty).
 *
 * @param value - Candidate value from a parsed YAML document.
 * @returns True when the value is populated.
 */
function isPopulated(value: unknown): boolean
{
    if (value === undefined || value === null)
    {
        return false;
    }
    else if (typeof value === "string")
    {
        return value.trim().length > 0;
    }
    else if (Array.isArray(value))
    {
        return value.length > 0;
    }
    else if (typeof value === "object")
    {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }

    return true;
}

/**
 * Fields audited on every genus file. The `media` field is intentionally
 * excluded — it is populated over time and is not part of intake.
 */
const genusChecks: Array<FieldCheck> = [
    {
        label: "etymology",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).etymology),
    },
    {
        label: "pronunciation.ipa",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).pronunciation?.ipa),
    },
    {
        label: "pronunciation.phonetic",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).pronunciation?.phonetic),
    },
    {
        label: "description",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).description),
    },
    {
        label: "diet",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).diet),
    },
    {
        label: "locomotion",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).locomotion),
    },
    {
        label: "paleoenvironment",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).paleoenvironment),
    },
    {
        label: "appearance.integument",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).appearance?.integument),
    },
    {
        label: "appearance.evidence",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).appearance?.evidence),
    },
    {
        label: "appearance.features",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).appearance?.features),
    },
    {
        label: "diagnostic_features",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).diagnostic_features),
    },
    {
        label: "identifiers",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).identifiers),
    },
    {
        label: "references",
        scope: "genus",
        isPresent: (target) => isPopulated((target as GenusData).references),
    },
];

/**
 * Fields audited on the representative species (the type species, or the
 * first listed species when no type is marked). Non-type species are out
 * of scope for this report and will be audited separately.
 */
const speciesChecks: Array<FieldCheck> = [
    {
        label: "species.type_specimen.completeness",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).type_specimen?.completeness),
    },
    {
        label: "species.etymology",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).etymology),
    },
    {
        label: "species.type_specimen.specimen_id",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).type_specimen?.specimen_id),
    },
    {
        label: "species.type_specimen.institution",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).type_specimen?.institution),
    },
    {
        label: "species.type_specimen.material",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).type_specimen?.material),
    },
    {
        label: "species.period.name",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).period?.name),
    },
    {
        label: "species.period.stage",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).period?.stage),
    },
    {
        label: "species.location.country",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).location?.country),
    },
    {
        label: "species.location.region",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).location?.region),
    },
    {
        label: "species.location.locality",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).location?.locality),
    },
    {
        label: "species.location.formation",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).location?.formation),
    },
    {
        label: "species.location.coordinates",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).location?.coordinates),
    },
    {
        label: "species.size.length_m",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).size?.length_m),
    },
    {
        label: "species.size.weight_kg",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).size?.weight_kg),
    },
    {
        label: "species.size.hip_height_m",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).size?.hip_height_m),
    },
    {
        label: "species.size.skull_length_m",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).size?.skull_length_m),
    },
    {
        label: "species.erected_in",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).erected_in),
    },
    {
        label: "species.described_in",
        scope: "species",
        isPresent: (target) => isPopulated((target as Species).described_in),
    },
];

/**
 * Pseudo-field used to flag genera that have no species entries at all.
 */
const missingSpeciesLabel = "species (no entries)";

/**
 * Picks the representative species for a genus: the type species when one
 * is marked, otherwise the first listed species.
 *
 * @param genus - Parsed genus YAML document.
 * @returns The representative species, or null when the genus has none.
 */
function pickRepresentativeSpecies(genus: GenusData): Species | null
{
    if (!Array.isArray(genus.species) || genus.species.length === 0)
    {
        return null;
    }

    const typeSpecies = genus.species.find((entry) => entry?.type_species === true);
    return typeSpecies ?? genus.species[0];
}

const generaFiles = findYamlFiles(generaDir).sort();
const missing = new Map<string, Array<string>>();

for (const check of genusChecks)
{
    missing.set(check.label, new Array<string>());
}

for (const check of speciesChecks)
{
    missing.set(check.label, new Array<string>());
}

missing.set(missingSpeciesLabel, new Array<string>());

let parseFailures = 0;

for (const filePath of generaFiles)
{
    let data: GenusData | null = null;

    try
    {
        data = parseYaml<GenusData>(filePath);
    }
    catch
    {
        parseFailures += 1;
        continue;
    }

    if (!data || typeof data !== "object")
    {
        continue;
    }

    const genusName = data.genus ?? path.basename(filePath, path.extname(filePath));

    for (const check of genusChecks)
    {
        if (!check.isPresent(data))
        {
            missing.get(check.label)!.push(genusName);
        }
    }

    const representative = pickRepresentativeSpecies(data);

    if (representative === null)
    {
        missing.get(missingSpeciesLabel)!.push(genusName);

        for (const check of speciesChecks)
        {
            missing.get(check.label)!.push(genusName);
        }
    }
    else
    {
        for (const check of speciesChecks)
        {
            if (!check.isPresent(representative))
            {
                missing.get(check.label)!.push(genusName);
            }
        }
    }
}

const totalGenera = generaFiles.length;
const sortedEntries = [...missing.entries()].sort((left, right) => right[1].length - left[1].length);

const lines = new Array<string>();
lines.push("# Missing Fields Report");
lines.push("");
lines.push(`Total genera scanned: ${totalGenera}`);

if (parseFailures > 0)
{
    lines.push(`YAML parse failures: ${parseFailures}`);
}

lines.push("");
lines.push("Generated by `npm run report-missing-fields`.");
lines.push("");
lines.push("Species-level checks evaluate the type species, falling back to the first listed species when no type is marked. The `media` field is intentionally excluded — it is populated over time and is not part of intake.");
lines.push("");
lines.push("## Summary counts");
lines.push("");

for (const [label, list] of sortedEntries)
{
    const percent = ((list.length / totalGenera) * 100).toFixed(1);
    lines.push(`- **${label}**: ${list.length} missing (${percent}%)`);
}

lines.push("");
lines.push("## Missing lists");

for (const [label, list] of sortedEntries)
{
    lines.push("");
    lines.push(`### ${label} (${list.length})`);
    lines.push("");

    if (list.length === 0)
    {
        lines.push("_none_");
    }
    else
    {
        lines.push(list.join(", "));
    }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join("\n") + "\n");

console.log(`Wrote ${path.relative(root, outputPath)} (${totalGenera} genera, ${parseFailures} parse failures)`);
