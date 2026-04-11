/**
 * One-off: fill the 32 sauropodomorph holotype blocks that the original
 * cross-reference pass deferred because of compound specimen IDs. Only
 * runnable after the #1848 schema change (which added array specimen_id
 * and the specimen_type enum).
 *
 * Categories applied (see the cross-reference plan for definitions):
 *
 *   A — holotype + paratypes, paratypes dropped per the #1848 policy (12)
 *   B — lectotype designated later, single ID (3)
 *   C — neotype replacing lost original material, single ID (2)
 *   D — pure syntype series, all specimens listed (3)
 *   F — multi-element single-individual holotype, canonical first ID
 *       with the full range recorded in `material` (9)
 *   G — distributed holotype across institutions, canonical first ID
 *       with the distribution recorded in `material` (3)
 *
 * Blocked (Category E — "Not catalogued") and left alone:
 *
 *   - Atlasaurus imelakei
 *   - Hypselosaurus priscus
 *   - Nopcsaspondylus alarconensis
 *
 * Deferred for manual literature review (Category H):
 *
 *   - Amazonsaurus maranhensis
 *   - Rebbachisaurus garasbae
 *   - Tiamat valdecii
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-sauropodomorph-deferred.ts [--apply]
 *
 * Without `--apply` the script runs in dry-run mode.
 *
 * See `reports/sauropodomorph-specimen-backfill.md` for the original
 * cross-reference. See `reports/holotype-schema-change.md` for the schema.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

type BackfillEntry = {
    /** Full binomial, must match the `name:` field in the species entry. */
    binomial: string;
    specimenType: "holotype" | "syntype" | "lectotype" | "neotype";
    specimenIds: Array<string>;
    institution: string;
    material?: string;
    category: "A" | "B" | "C" | "D" | "F" | "G";
    note?: string;
};

/**
 * Expands a compact range specification like "245-246" or "264-271" into
 * an array of individual numeric strings. Non-range input is returned as
 * a single-element array.
 *
 * @param text - A range expression or single number.
 * @returns Array of individual number strings.
 */
function expandNumericRange(text: string): Array<string>
{
    const match = text.match(/^(\d+)\s*[-–]\s*(\d+)$/);

    if (!match)
    {
        return [text];
    }

    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    const results: Array<string> = [];

    for (let value = start; value <= end; value += 1)
    {
        results.push(String(value));
    }

    return results;
}

/**
 * Expands the NMB M.H. syntype series of Amanzia greppini from Wikipedia's
 * compact range format ("239, 245–246, 252–254, ...") into individual
 * "NMB M.H. X" specimen IDs.
 *
 * @returns Expanded array of specimen IDs for Amanzia.
 */
function amanziaSyntypes(): Array<string>
{
    const compact = [
        "239", "245-246", "252-254", "258-260", "262", "264-271",
        "275-280", "282", "284-286", "291", "297", "300", "306",
        "324", "332", "339-342", "344-347", "349", "353-355",
        "358-359", "368-370", "372-374", "386-387",
    ];

    const numbers: Array<string> = [];

    for (const part of compact)
    {
        numbers.push(...expandNumericRange(part));
    }

    return numbers.map((number) => `NMB M.H. ${number}`);
}

const entries: Array<BackfillEntry> = [
    // Category A — holotype + paratypes (paratypes dropped).
    {
        category: "A",
        binomial: "Australodocus bohetii",
        specimenType: "holotype",
        specimenIds: ["MB.R.2455"],
        institution: "Museum für Naturkunde Berlin, Berlin",
    },
    {
        category: "A",
        binomial: "Diamantinasaurus matildae",
        specimenType: "holotype",
        specimenIds: ["AODF 603"],
        institution: "Australian Age of Dinosaurs Fossil, Winton",
    },
    {
        category: "A",
        binomial: "Diplodocus carnegii",
        specimenType: "holotype",
        specimenIds: ["CM 84"],
        institution: "Carnegie Museum of Natural History, Pittsburgh",
    },
    {
        category: "A",
        binomial: "Issi saaneq",
        specimenType: "holotype",
        specimenIds: ["NHMD 164741"],
        institution: "Statens Naturhistoriske Museum, Copenhagen",
    },
    {
        category: "A",
        binomial: "Kholumolumo ellenbergerorum",
        specimenType: "holotype",
        specimenIds: ["MNHN.F.LES381m"],
        institution: "Muséum national d'Histoire naturelle, Paris",
    },
    {
        category: "A",
        binomial: "Leinkupal laticauda",
        specimenType: "holotype",
        specimenIds: ["MMCH-Pv 63-1"],
        institution: "Museo Municipal 'Ernesto Bachmann', Villa El Chocón, Neuquén",
    },
    {
        category: "A",
        binomial: "Lirainosaurus astibiae",
        specimenType: "holotype",
        specimenIds: ["MCNA 7458"],
        institution: "Museo de Ciencias Naturales de Álava, Vitoria-Gasteiz",
        note: "MCNA prefix collides with the Argentine institution in institutions.yaml — see #1847",
    },
    {
        category: "A",
        binomial: "Macrocollum itaquii",
        specimenType: "holotype",
        specimenIds: ["CAPPA/UFSM 0001a"],
        institution: "Centro de Apoio à Pesquisa Paleontológica da Quarta Colônia, Universidade Federal de Santa Maria, São João do Polêsine",
    },
    {
        category: "A",
        binomial: "Muyelensaurus pecheni",
        specimenType: "holotype",
        specimenIds: ["MRS-PV 207"],
        institution: "Museo Argentino Urquiza, Rincón de los Sauces, Neuquén",
    },
    {
        category: "A",
        binomial: "Saturnalia tupiniquim",
        specimenType: "holotype",
        specimenIds: ["MCP 3844-PV"],
        institution: "Museu de Ciências e Tecnologia da Pontifícia Universidade Católica do Rio Grande do Sul, Porto Alegre",
    },
    {
        category: "A",
        binomial: "Sidersaura marae",
        specimenType: "holotype",
        specimenIds: ["MMCh-PV 70"],
        institution: "Museo Municipal 'Ernesto Bachmann', Villa El Chocón, Neuquén",
    },
    {
        category: "A",
        binomial: "Yimenosaurus youngi",
        specimenType: "holotype",
        specimenIds: ["YXV 8701"],
        institution: "Yuxi Prefectural Committee Office, Yunnan",
    },

    // Category B — lectotype, single ID.
    {
        category: "B",
        binomial: "Amygdalodon patagonicus",
        specimenType: "lectotype",
        specimenIds: ["MLP 46-VIII-21-112"],
        institution: "Museo de La Plata",
    },
    {
        category: "B",
        binomial: "Iuticosaurus lydekkeri",
        specimenType: "lectotype",
        specimenIds: ["BMNH R146a"],
        institution: "Natural History Museum, London",
    },
    {
        category: "B",
        binomial: "Laplatasaurus araukanicus",
        specimenType: "lectotype",
        specimenIds: ["MLP 26-306"],
        institution: "Museo de La Plata",
    },

    // Category C — neotype, single ID.
    {
        category: "C",
        binomial: "Anchisaurus polyzelus",
        specimenType: "neotype",
        specimenIds: ["YPM 1883"],
        institution: "Yale Peabody Museum of Natural History, New Haven",
    },
    {
        category: "C",
        binomial: "Massospondylus carinatus",
        specimenType: "neotype",
        specimenIds: ["BP/1/4934"],
        institution: "Evolutionary Studies Institute (formerly Bernard Price Institute for Palaeontological Research), University of the Witwatersrand, Johannesburg",
    },

    // Category D — pure syntype series.
    {
        category: "D",
        binomial: "Amanzia greppini",
        specimenType: "syntype",
        specimenIds: amanziaSyntypes(),
        institution: "Naturhistorisches Museum, Basel",
    },
    {
        category: "D",
        binomial: "Plateosauravus cullingworthi",
        specimenType: "syntype",
        specimenIds: ["SAM 3341", "SAM 3345", "SAM 3347", "SAM 3350", "SAM 3351", "SAM 3603", "SAM 3607"],
        institution: "Iziko South African Museum, Cape Town",
    },
    {
        category: "D",
        binomial: "Tendaguria tanzaniensis",
        specimenType: "syntype",
        specimenIds: ["MB.R.2092.1", "MB.R.2092.2"],
        institution: "Museum für Naturkunde Berlin, Berlin",
    },

    // Category F — multi-element single-individual holotype.
    {
        category: "F",
        binomial: "Chebsaurus algeriensis",
        specimenType: "holotype",
        specimenIds: ["D001-01"],
        institution: "Research and Development Center of Sonatrach, Boumerdès",
        material: "Partial skeleton cataloged as D001-01 through D001-78",
    },
    {
        category: "F",
        binomial: "Garumbatitan morellensis",
        specimenType: "holotype",
        specimenIds: ["SAV05-021"],
        institution: "Museu Temps de Dinosaures, Morella",
        material: "Partial skeleton cataloged as SAV05-021, 023-031, 039-045, 048-050, 055, 060-071, SAV08-040, 100-104",
    },
    {
        category: "F",
        binomial: "Itapeuasaurus cajapioensis",
        specimenType: "holotype",
        specimenIds: ["UFMA 1.10.1960-1"],
        institution: "Universidade Federal do Maranhão, São Luís",
        material: "Partial skeleton cataloged as UFMA 1.10.1960-1, 3-5, 8",
    },
    {
        category: "F",
        binomial: "Jaklapallisaurus asymmetrica",
        specimenType: "holotype",
        specimenIds: ["ISI R273/1"],
        institution: "Geology Museum, Indian Statistical Institute, Calcutta",
        material: "Partial skeleton cataloged as ISI R273/1-3",
    },
    {
        category: "F",
        binomial: "Lessemsaurus sauropoides",
        specimenType: "holotype",
        specimenIds: ["PVL 4822-1/1"],
        institution: "Colección de Paleontología de Vertebrados de la Fundación Instituto Miguel Lillo, Tucumán",
        material: "Partial skeleton cataloged as PVL 4822-1/1 through 4822-1/7 and 4822-1/10",
    },
    {
        category: "F",
        binomial: "Lourinhasaurus alenquerensis",
        specimenType: "lectotype",
        specimenIds: ["MIGM 4956"],
        institution: "Museu Geológico do Instituto Geológico e Mineiro, Lisbon",
        material: "Lectotype series cataloged as MIGM 4956, 4957, 4970, 4975, 4979, 4980, 4983, 4984, 5780, 5781",
    },
    {
        category: "F",
        binomial: "Lusotitan atalaiensis",
        specimenType: "lectotype",
        specimenIds: ["MIGM 4798"],
        institution: "Museu Geológico do Instituto Geológico e Mineiro, Lisbon",
        material: "Lectotype series cataloged as MIGM 4798, 4801-4810, 4938, 4944, 4950, 4952, 4958, 4964-4966, 4981, 4982, 4985, 8807, 8793-8795",
    },
    {
        category: "F",
        binomial: "Tangvayosaurus hoffeti",
        specimenType: "holotype",
        specimenIds: ["TV4-1"],
        institution: "Savannakhet Dinosaur Museum, Savannakhet",
        material: "Partial skeleton cataloged as TV4-1 through TV4-36",
    },
    {
        category: "F",
        binomial: "Turiasaurus riodevensis",
        specimenType: "holotype",
        specimenIds: ["CPT-1195"],
        institution: "Museo de la Fundación Conjunto Paleontológico de Teruel-Dinópolis, Aragón",
        material: "Partial skeleton cataloged as CPT-1195 through CPT-1210",
    },

    // Category G — distributed holotype across institutions.
    {
        category: "G",
        binomial: "Elaltitan lilloi",
        specimenType: "holotype",
        specimenIds: ["PVL 4628"],
        institution: "Colección de Paleontología de Vertebrados de la Fundación Instituto Miguel Lillo, Tucumán",
        material: "Holotype material distributed across PVL 4628 and MACN-CH 217",
    },
    {
        category: "G",
        binomial: "Rinconsaurus caudamirus",
        specimenType: "holotype",
        specimenIds: ["MRS-Pv 26"],
        institution: "Museo Argentino Urquiza, Rincón de los Sauces, Neuquén",
        material: "Holotype material distributed across MRS-Pv 26 and MRS-Pv 13",
    },
    {
        category: "G",
        binomial: "Yamanasaurus lojaensis",
        specimenType: "holotype",
        specimenIds: ["YM-UTPL 002"],
        institution: "Universidad Técnica Particular de Loja, Loja",
        material: "Holotype material distributed across YM-UTPL 002 and YM-INPC-014-017",
    },
];

/**
 * Recursively collect all `.yml` files under the given directory.
 *
 * @param directory - Absolute directory path to walk.
 * @returns Absolute file paths of every YAML file found beneath it.
 */
function walkYaml(directory: string): Array<string>
{
    const results: Array<string> = [];

    for (const entry of fs.readdirSync(directory))
    {
        const entryPath = path.join(directory, entry);

        if (fs.statSync(entryPath).isDirectory())
        {
            results.push(...walkYaml(entryPath));
        }
        else if (entry.endsWith(".yml"))
        {
            results.push(entryPath);
        }
    }

    return results;
}

/**
 * Escapes a string for use as a YAML double-quoted scalar literal.
 *
 * @param text - The raw string.
 * @returns A YAML double-quoted scalar literal (with surrounding quotes).
 */
function toDoubleQuotedScalar(text: string): string
{
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    return `"${escaped}"`;
}

/**
 * Renders a scalar safe to embed inside a YAML flow array (`[...]`).
 * The flow context adds `,` and `]` to the list of characters that force
 * quoting.
 *
 * @param text - The raw string.
 * @returns A YAML scalar literal.
 */
function renderFlowScalar(text: string): string
{
    if (/^[\s#&*!|>%@`'"\-?]/.test(text))
    {
        return toDoubleQuotedScalar(text);
    }

    if (/[,\]{}[]/.test(text))
    {
        return toDoubleQuotedScalar(text);
    }

    if (text.includes(": ") || text.includes(" #") || text.includes("\n") || text.includes("\"") || text.includes("'"))
    {
        return toDoubleQuotedScalar(text);
    }

    return text;
}

/**
 * Renders a scalar suitable for a block-style YAML value (after a key).
 *
 * @param text - The raw string.
 * @returns A YAML scalar literal.
 */
function renderBlockScalar(text: string): string
{
    if (/^[\s#&*!|>%@`'"]/.test(text))
    {
        return toDoubleQuotedScalar(text);
    }

    if (text.includes(": ") || text.includes(" #") || text.includes("\n") || text.includes("\"") || text.includes("'"))
    {
        return toDoubleQuotedScalar(text);
    }

    return text;
}

/**
 * Builds a YAML list of specimen IDs as an inline flow array.
 *
 * @param ids - Array of specimen IDs.
 * @returns A string like `[ID1, ID2, ID3]`.
 */
function renderSpecimenIdArray(ids: Array<string>): string
{
    return "[" + ids.map((id) => renderFlowScalar(id)).join(", ") + "]";
}

/**
 * Finds the end-of-entry line index for a species entry starting at the
 * given `- name: ...` line. The entry ends at the first subsequent line
 * whose indentation is at or below the entry's list-item indent.
 *
 * @param lines - File lines.
 * @param nameLineIndex - Zero-based index of the `  - name: ...` line.
 * @returns Index one past the last line that belongs to this entry.
 */
function findSpeciesEntryEnd(lines: Array<string>, nameLineIndex: number): number
{
    const nameLine = lines[nameLineIndex];
    const dashMatch = nameLine.match(/^(\s*)-\s/);

    if (!dashMatch)
    {
        throw new Error(`Expected a list item at line ${nameLineIndex + 1}`);
    }

    const itemIndentWidth = dashMatch[1].length;

    for (let index = nameLineIndex + 1; index < lines.length; index += 1)
    {
        const line = lines[index];

        if (line.length === 0)
        {
            continue;
        }

        const leading = line.match(/^(\s*)/);
        const leadingWidth = leading ? leading[1].length : 0;

        if (leadingWidth <= itemIndentWidth)
        {
            return index;
        }
    }

    return lines.length;
}

/**
 * Locates the genus YAML file containing a species whose `name:` matches
 * the full binomial.
 *
 * @param files - Candidate YAML file paths.
 * @param binomial - The full binomial.
 * @returns The matching file path, or null if no match.
 */
function findGenusFileForBinomial(files: Array<string>, binomial: string): string | null
{
    const nameLinePattern = new RegExp(
        String.raw`^\s*-\s+name:\s+` + binomial.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + String.raw`\s*$`,
        "m",
    );

    for (const filePath of files)
    {
        const source = fs.readFileSync(filePath, "utf8");

        if (nameLinePattern.test(source))
        {
            return filePath;
        }
    }

    return null;
}

/**
 * Determines if the species entry at `nameLineIndex` already contains a
 * `holotype:` block.
 *
 * @param lines - File lines.
 * @param nameLineIndex - Zero-based index of the `- name:` line.
 * @returns True if a holotype block is present.
 */
function hasExistingHolotype(lines: Array<string>, nameLineIndex: number): boolean
{
    const dashMatch = lines[nameLineIndex].match(/^(\s*)-\s/);

    if (!dashMatch)
    {
        return false;
    }

    const fieldIndent = " ".repeat(dashMatch[1].length + 2);
    const endIndex = findSpeciesEntryEnd(lines, nameLineIndex);

    for (let index = nameLineIndex + 1; index < endIndex; index += 1)
    {
        if (lines[index] === fieldIndent + "holotype:")
        {
            return true;
        }
    }

    return false;
}

/**
 * Produces the lines of a new holotype block (indented correctly) from
 * a backfill entry.
 *
 * @param entry - The backfill entry.
 * @param fieldIndent - Leading spaces for species-level keys.
 * @param nestedIndent - Leading spaces for keys inside `holotype:`.
 * @returns Array of new file lines.
 */
function renderHolotypeBlock(
    entry: BackfillEntry,
    fieldIndent: string,
    nestedIndent: string,
): Array<string>
{
    const lines: Array<string> = [];
    lines.push(fieldIndent + "holotype:");
    lines.push(nestedIndent + "specimen_id: " + renderSpecimenIdArray(entry.specimenIds));
    lines.push(nestedIndent + "specimen_type: " + entry.specimenType);
    lines.push(nestedIndent + "institution: " + renderBlockScalar(entry.institution));

    if (entry.material !== undefined)
    {
        lines.push(nestedIndent + "material: " + renderBlockScalar(entry.material));
    }

    return lines;
}

const yamlFiles = walkYaml(generaDir);

type PlannedChange = {
    entry: BackfillEntry;
    filePath: string;
    nameLineIndex: number;
    fieldIndent: string;
    nestedIndent: string;
    insertAt: number;
    newLines: Array<string>;
};

const planned: Array<PlannedChange> = [];
const errors: Array<{ binomial: string; reason: string }> = [];

for (const entry of entries)
{
    const filePath = findGenusFileForBinomial(yamlFiles, entry.binomial);

    if (filePath === null)
    {
        errors.push({ binomial: entry.binomial, reason: "binomial not found in any genera file" });
        continue;
    }

    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split("\n");
    const nameLinePattern = new RegExp(
        String.raw`^(\s*)-\s+name:\s+` + entry.binomial.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + String.raw`\s*$`,
    );

    let nameLineIndex = -1;

    for (let index = 0; index < lines.length; index += 1)
    {
        if (nameLinePattern.test(lines[index]))
        {
            nameLineIndex = index;
            break;
        }
    }

    if (nameLineIndex === -1)
    {
        errors.push({ binomial: entry.binomial, reason: "name line not found after file match" });
        continue;
    }

    if (hasExistingHolotype(lines, nameLineIndex))
    {
        errors.push({ binomial: entry.binomial, reason: "species already has a holotype block" });
        continue;
    }

    const dashMatch = lines[nameLineIndex].match(/^(\s*)-\s/);

    if (!dashMatch)
    {
        errors.push({ binomial: entry.binomial, reason: "unexpected list-item shape" });
        continue;
    }

    const fieldIndent = " ".repeat(dashMatch[1].length + 2);
    const nestedIndent = " ".repeat(dashMatch[1].length + 4);
    const insertAt = findSpeciesEntryEnd(lines, nameLineIndex);
    const newLines = renderHolotypeBlock(entry, fieldIndent, nestedIndent);

    planned.push({
        entry,
        filePath,
        nameLineIndex,
        fieldIndent,
        nestedIndent,
        insertAt,
        newLines,
    });
}

console.log(`Entries in table:  ${entries.length}`);
console.log(`Planned changes:   ${planned.length}`);
console.log(`Errors:            ${errors.length}`);

if (errors.length > 0)
{
    console.log("\n=== Errors ===");

    for (const error of errors)
    {
        console.log(`  ${error.binomial}: ${error.reason}`);
    }
}

const totalsByCategory = new Map<string, number>();

for (const change of planned)
{
    const count = totalsByCategory.get(change.entry.category) ?? 0;
    totalsByCategory.set(change.entry.category, count + 1);
}

console.log("\n=== Totals by category ===");

for (const [category, count] of [...totalsByCategory.entries()].sort())
{
    console.log(`  ${category}: ${count}`);
}

if (!apply)
{
    console.log("\nDry run. Re-run with --apply to write YAML files.");
    console.log("\n=== Changes (first 6 shown in full; remaining summarized) ===");

    planned.forEach((change, index) =>
    {
        const relative = path.relative(root, change.filePath);

        if (index < 6)
        {
            console.log(`\n[${change.entry.category}] ${change.entry.binomial} (${relative}):`);

            for (const line of change.newLines)
            {
                console.log(`  +${line}`);
            }

            if (change.entry.note !== undefined)
            {
                console.log(`  (note: ${change.entry.note})`);
            }
        }
        else
        {
            console.log(`[${change.entry.category}] ${change.entry.binomial} (${change.entry.specimenType}, ${change.entry.specimenIds.length} id${change.entry.specimenIds.length === 1 ? "" : "s"})`);
        }
    });

    process.exit(0);
}

console.log("\nApplying changes...");

// Group by file so we can apply all species edits to a file in one pass,
// bottom-up to keep earlier line numbers stable.
const byFile = new Map<string, Array<PlannedChange>>();

for (const change of planned)
{
    const list = byFile.get(change.filePath) ?? [];
    list.push(change);
    byFile.set(change.filePath, list);
}

for (const [filePath, changes] of byFile.entries())
{
    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split("\n");

    changes.sort((left, right) => right.insertAt - left.insertAt);

    for (const change of changes)
    {
        lines.splice(change.insertAt, 0, ...change.newLines);
    }

    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

console.log(`Done. Wrote ${planned.length} holotype blocks across ${byFile.size} files.`);
