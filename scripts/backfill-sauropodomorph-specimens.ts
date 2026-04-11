/**
 * One-off: backfill species.holotype.specimen_id and .institution for
 * sauropodomorph genera using the Wikipedia article
 * `List_of_sauropodomorph_type_specimens` as the source.
 *
 * Cross-references Wikipedia's table against our genera YAML files and:
 *   - applies clean backfills (both our fields empty)
 *   - applies specimen-only or institution-only backfills where safe
 *   - leaves agreeing rows alone
 *   - reports specimen-level conflicts for manual review (not applied)
 *   - ignores institution-only string differences (handled separately —
 *     see the institution normalization issue)
 *
 * Institution names on new backfills are resolved from the specimen ID
 * prefix via `institutions.yaml` (matching the behavior of
 * `scripts/batch-import.ts`), falling back to the cleaned Wikipedia
 * string when the prefix is not in the registry.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-sauropodomorph-specimens.ts [--apply]
 *
 * Without `--apply` the script runs in dry-run mode and prints a
 * per-file summary of proposed changes without touching YAML files.
 *
 * Written for issues #1837 and #1838. See
 * `reports/sauropodomorph-specimen-backfill.md` for the plan.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { parse as parseYamlContent } from "yaml";

import type { GenusData, Species } from "./types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const institutionsPath = path.join(root, "institutions.yaml");
const cachePath = path.join(root, "node_modules", ".cache", "sauropodomorph-wikitext.txt");
const wikipediaApi = "https://en.wikipedia.org/w/api.php"
    + "?action=parse"
    + "&page=List_of_sauropodomorph_type_specimens"
    + "&format=json"
    + "&prop=wikitext";

type WikiEntry = {
    genus: string;
    species: string;
    binomial: string;
    specimenId: string;
    institution: string;
};

type BackfillChange = {
    filePath: string;
    genusName: string;
    binomial: string;
    oldSpecimen: string;
    newSpecimen: string;
    oldInstitution: string;
    newInstitution: string;
    institutionSource: "registry" | "wikipedia" | "unchanged";
};

type SpecimenConflict = {
    filePath: string;
    genusName: string;
    binomial: string;
    ourSpecimen: string;
    wikiSpecimen: string;
    ourInstitution: string;
    wikiInstitution: string;
    conflictScope: "specimen" | "specimen_and_institution";
};

type DeferredEntry = {
    binomial: string;
    reason: string;
    wikiSpecimen: string;
    wikiInstitution: string;
};

const applyFlag = process.argv.includes("--apply");

/**
 * Fetches the wikitext for the source article, caching to disk so repeat
 * runs do not hit Wikipedia.
 *
 * @returns Raw wikitext string for the source article.
 */
async function loadWikitext(): Promise<string>
{
    if (fs.existsSync(cachePath))
    {
        return fs.readFileSync(cachePath, "utf8");
    }

    const response = await fetch(wikipediaApi);

    if (!response.ok)
    {
        throw new Error(`Wikipedia fetch failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as { parse?: { wikitext?: { ["*"]?: string } } };
    const wikitext = payload.parse?.wikitext?.["*"] ?? "";

    if (wikitext.length === 0)
    {
        throw new Error("Wikipedia response missing wikitext");
    }

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, wikitext, "utf8");
    return wikitext;
}

/**
 * Strips wiki markup, HTML comments, and reference tags from a cell value.
 *
 * @param text - Raw wikitable cell contents.
 * @returns Plain-text rendering with internal links unwrapped.
 */
function cleanCell(text: string): string
{
    let cleaned = text;
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
    cleaned = cleaned.replace(/<ref\b[^>]*\/>/g, "");
    cleaned = cleaned.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, "");
    cleaned = cleaned.replace(/<[^>]+>/g, "");
    cleaned = cleaned.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
    cleaned = cleaned.replace(/\[\[([^\]]+)\]\]/g, "$1");
    cleaned = cleaned.replace(/'''/g, "");
    cleaned = cleaned.replace(/''/g, "");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned;
}

/**
 * Parses the sauropodomorph wikitable into structured rows.
 *
 * @param wikitext - The full article wikitext.
 * @returns Array of parsed row entries.
 */
function parseTable(wikitext: string): Array<WikiEntry>
{
    const tables = wikitext.split(/\n\{\|/).slice(1);
    const mainTable = tables[1];

    if (typeof mainTable !== "string")
    {
        throw new Error("Could not locate main wikitable in article");
    }

    const tableEnd = mainTable.indexOf("\n|}");
    const tableContent = mainTable.slice(0, tableEnd);
    const rawRows = tableContent.split(/\n\|-\s*\n/).slice(1);
    const entries = new Array<WikiEntry>();

    for (const rawRow of rawRows)
    {
        const cells = ("\n" + rawRow).split(/\n\|\s*/).slice(1);

        if (cells.length < 3)
        {
            continue;
        }

        const binomial = cleanCell(cells[0]);
        const specimenId = cleanCell(cells[1]);
        const institution = cleanCell(cells[2]);

        if (binomial.length === 0)
        {
            continue;
        }

        const parts = binomial.split(/\s+/);
        const genus = parts[0];
        const species = parts.slice(1).join(" ");

        entries.push({ genus, species, binomial, specimenId, institution });
    }

    return entries;
}

/**
 * Loads the institutions.yaml registry into a flat abbreviation -> name map.
 *
 * @returns Map of acronym to canonical institution name.
 */
function loadInstitutionRegistry(): Record<string, string>
{
    const raw = parseYamlContent(fs.readFileSync(institutionsPath, "utf8")) as Array<Record<string, string>>;
    return Object.assign({}, ...raw);
}

/**
 * Attempts to resolve an institution name from a specimen ID prefix.
 * Mirrors `resolveMuseumAbbreviation()` in `scripts/batch-import.ts` so
 * backfilled entries match the style used by the intake pipeline.
 *
 * @param specimenId - Specimen catalogue number.
 * @param registry - Loaded institutions registry.
 * @returns Canonical institution name, or undefined when unresolved.
 */
function resolveInstitutionFromSpecimen(specimenId: string, registry: Record<string, string>): string | undefined
{
    const prefix = specimenId.match(/^([A-Z]{2,}(?:[-\s][A-Za-z]{1,4})?)/);

    if (!prefix)
    {
        return undefined;
    }

    const abbreviation = prefix[1].replace(/[-\s]+/g, "").toUpperCase();

    if (registry[abbreviation])
    {
        return registry[abbreviation];
    }

    const withHyphen = prefix[1].split(/[-\s]+/)[0];
    return registry[withHyphen];
}

/**
 * Checks whether a Wikipedia specimen ID value represents a single,
 * unambiguous catalogue number. Compound forms (syntype series,
 * lectotype + paralectotype pairs, comma-separated specimen lists) are
 * deferred pending a schema change that allows multi-specimen type
 * series.
 *
 * @param specimenId - Cleaned specimen ID string from Wikipedia.
 * @returns True when the value is a single catalogue number.
 */
function isSimpleSpecimenId(specimenId: string): boolean
{
    if (specimenId.length === 0)
    {
        return false;
    }

    const lowered = specimenId.toLowerCase();
    const compoundMarkers = [
        "syntype",
        "paratype",
        "lectotype",
        "paralectotype",
        "neotype",
        "holotype",
        " and ",
        " to ",
        "not catalog",
        "no catalog",
        "uncataloged",
        "uncatalogued",
        "no specimen",
        "no number",
        "not given",
        "unknown",
        "lost",
        "destroyed",
    ];

    for (const marker of compoundMarkers)
    {
        if (lowered.includes(marker))
        {
            return false;
        }
    }

    if (specimenId.includes(","))
    {
        return false;
    }

    if (specimenId.includes(";"))
    {
        return false;
    }

    if (specimenId.length > 40)
    {
        return false;
    }

    return true;
}

/**
 * Checks whether a Wikipedia institution string is a clean value that
 * can be written into our dataset without manual review. Rejects
 * descriptive fallbacks such as "Unknown" or "Destroyed, formerly at...".
 *
 * @param institution - Cleaned institution string from Wikipedia.
 * @returns True when the value is usable.
 */
function isSimpleInstitution(institution: string): boolean
{
    if (institution.length === 0)
    {
        return false;
    }

    const lowered = institution.toLowerCase();
    const badStarts = ["destroyed", "lost", "unknown", "not ", "no "];

    for (const start of badStarts)
    {
        if (lowered.startsWith(start))
        {
            return false;
        }
    }

    return true;
}

/**
 * Normalizes a string for loose comparison: lowercased, punctuation and
 * whitespace stripped.
 *
 * @param text - Raw value.
 * @returns Normalized form.
 */
function normalize(text: string | undefined): string
{
    if (typeof text !== "string")
    {
        return "";
    }

    return text.toLowerCase().replace(/[\s\-_/.,;:()'"`‘’"]+/g, "");
}

/**
 * Checks whether two strings refer to (approximately) the same value.
 *
 * @param left - First string.
 * @param right - Second string.
 * @returns True when the strings match loosely.
 */
function looseEqual(left: string | undefined, right: string | undefined): boolean
{
    const leftKey = normalize(left);
    const rightKey = normalize(right);

    if (leftKey.length === 0 || rightKey.length === 0)
    {
        return false;
    }

    if (leftKey === rightKey)
    {
        return true;
    }

    return leftKey.includes(rightKey) || rightKey.includes(leftKey);
}

/**
 * Normalizes a species name key for matching.
 *
 * @param name - Species name.
 * @returns Lowercased trimmed form.
 */
function speciesKey(name: string | undefined): string
{
    return typeof name === "string" ? name.toLowerCase().trim() : "";
}

/**
 * Recursively lists all .yml files in a directory.
 *
 * @param directory - Root directory.
 * @returns Absolute file paths.
 */
function listYamlFiles(directory: string): Array<string>
{
    const results = new Array<string>();

    for (const entry of fs.readdirSync(directory, { withFileTypes: true }))
    {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory())
        {
            results.push(...listYamlFiles(entryPath));
        }
        else if (entry.name.endsWith(".yml"))
        {
            results.push(entryPath);
        }
    }

    return results;
}

/**
 * Escapes a string for use as a YAML double-quoted scalar value. Handles
 * the small set of characters that require escaping in this context.
 *
 * @param text - The raw string.
 * @returns A YAML double-quoted scalar literal.
 */
function toDoubleQuotedScalar(text: string): string
{
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    return `"${escaped}"`;
}

/**
 * Renders a scalar value as a YAML plain or double-quoted scalar. Plain
 * is preferred when the value contains no characters that would force
 * quoting (e.g. leading `-`, embedded `: `, quotes, wrapping).
 *
 * @param text - The raw string.
 * @returns A YAML scalar literal.
 */
function renderScalar(text: string): string
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
 * Renders a scalar for use inside a flow array `[...]`. Adds `,`, `]`,
 * `[`, `{`, `}` to the list of characters that force quoting.
 *
 * @param text - The raw string.
 * @returns A YAML scalar literal safe to embed inside `[...]`.
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

        // A line with indent <= itemIndentWidth terminates the entry.
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
 * Applies a backfill change to a genus YAML file by text insertion.
 * Leaves every other line in the file untouched so diffs are minimal.
 *
 * @param change - The backfill change to apply.
 */
function writeBackfill(change: BackfillChange): void
{
    const source = fs.readFileSync(change.filePath, "utf8");
    const lines = source.split("\n");

    // Find the `- name: <binomial>` line for our target species. Match
    // literal binomial — species names in this repo are stored as plain
    // scalars like `- name: Aardonyx celestae`.
    const targetPattern = new RegExp(
        String.raw`^(\s*)-\s+name:\s+` + change.binomial.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + String.raw`\s*$`,
    );

    let nameLineIndex = -1;

    for (let index = 0; index < lines.length; index += 1)
    {
        if (targetPattern.test(lines[index]))
        {
            nameLineIndex = index;
            break;
        }
    }

    if (nameLineIndex === -1)
    {
        throw new Error(`Species ${change.binomial} not found as a list item in ${change.filePath}`);
    }

    const dashMatch = lines[nameLineIndex].match(/^(\s*)-\s/);

    if (!dashMatch)
    {
        throw new Error(`Unexpected list-item shape at line ${nameLineIndex + 1}`);
    }

    // A list item `  - name: ...` places nested keys like `status` at
    // `indent + 2`, and values nested under those keys (e.g. fields
    // inside `holotype:`) at `indent + 4`.
    const fieldIndent = " ".repeat(dashMatch[1].length + 2);
    const nestedIndent = " ".repeat(dashMatch[1].length + 4);
    const endIndex = findSpeciesEntryEnd(lines, nameLineIndex);

    // Check for an existing holotype block inside this entry (the single
    // "backfillSpecimenOnly" path).
    let existingHolotypeIndex = -1;

    for (let index = nameLineIndex + 1; index < endIndex; index += 1)
    {
        if (lines[index] === fieldIndent + "holotype:")
        {
            existingHolotypeIndex = index;
            break;
        }
    }

    if (existingHolotypeIndex === -1)
    {
        const insertedLines = new Array<string>();
        insertedLines.push(fieldIndent + "holotype:");

        if (change.newSpecimen.length > 0)
        {
            insertedLines.push(nestedIndent + "specimen_id: [" + renderFlowScalar(change.newSpecimen) + "]");
            insertedLines.push(nestedIndent + "specimen_type: holotype");
        }

        if (change.newInstitution.length > 0 && change.institutionSource !== "unchanged")
        {
            insertedLines.push(nestedIndent + "institution: " + renderScalar(change.newInstitution));
        }

        lines.splice(endIndex, 0, ...insertedLines);
    }
    else
    {
        // Insert fields at the end of the existing holotype block. Find
        // the holotype block end the same way (first line with indent
        // <= fieldIndent).
        const holotypeItemIndent = fieldIndent.length;
        let holotypeEnd = lines.length;

        for (let index = existingHolotypeIndex + 1; index < endIndex; index += 1)
        {
            const line = lines[index];

            if (line.length === 0)
            {
                continue;
            }

            const leading = line.match(/^(\s*)/);
            const leadingWidth = leading ? leading[1].length : 0;

            if (leadingWidth <= holotypeItemIndent)
            {
                holotypeEnd = index;
                break;
            }
        }

        const additions = new Array<string>();

        if (change.newSpecimen.length > 0 && change.oldSpecimen.length === 0)
        {
            additions.push(nestedIndent + "specimen_id: [" + renderFlowScalar(change.newSpecimen) + "]");
            additions.push(nestedIndent + "specimen_type: holotype");
        }

        if (
            change.newInstitution.length > 0
            && change.institutionSource !== "unchanged"
            && change.oldInstitution.length === 0
        )
        {
            additions.push(nestedIndent + "institution: " + renderScalar(change.newInstitution));
        }

        if (additions.length > 0)
        {
            lines.splice(holotypeEnd, 0, ...additions);
        }
    }

    fs.writeFileSync(change.filePath, lines.join("\n"), "utf8");
}

const wikitext = await loadWikitext();
const entries = parseTable(wikitext);
console.log(`Parsed ${entries.length} wikitable entries`);

const registry = loadInstitutionRegistry();
console.log(`Loaded ${Object.keys(registry).length} institution abbreviations`);

const generaFiles = listYamlFiles(generaDir);
const genusIndex = new Map<string, { filePath: string; data: GenusData }>();

for (const filePath of generaFiles)
{
    try
    {
        const data = parseYamlContent(fs.readFileSync(filePath, "utf8")) as GenusData;

        if (data && typeof data === "object" && typeof data.genus === "string")
        {
            genusIndex.set(data.genus, { filePath, data });
        }
    }
    catch
    {
        // Skip unparseable files; they get caught by validate.ts.
    }
}

console.log(`Indexed ${genusIndex.size} genera`);

const changes = new Array<BackfillChange>();
const conflicts = new Array<SpecimenConflict>();
const deferred = new Array<DeferredEntry>();
const counters = {
    notInRepo: 0,
    speciesNotInRepo: 0,
    match: 0,
    institutionOnlyMismatch: 0,
    skippedNoSpecimen: 0,
};

for (const entry of entries)
{
    const indexed = genusIndex.get(entry.genus);

    if (!indexed)
    {
        counters.notInRepo += 1;
        continue;
    }

    const speciesList = Array.isArray(indexed.data.species) ? indexed.data.species : [];
    const target: Species | undefined = speciesList.find(
        (species) => speciesKey(species?.name) === speciesKey(entry.binomial),
    );

    if (!target)
    {
        counters.speciesNotInRepo += 1;
        continue;
    }

    // Join existing specimen_id array to a single string for loose comparison.
    // Single-ID cases (the overwhelming majority) join to themselves.
    const ourSpecimenArray = target.holotype?.specimen_id ?? [];
    const ourSpecimen = ourSpecimenArray.join(", ");
    const ourInstitution = target.holotype?.institution ?? "";
    const wikiHasSpecimen = entry.specimenId.length > 0;
    const wikiHasInstitution = entry.institution.length > 0;
    const hasOurSpecimen = ourSpecimen.trim().length > 0;
    const hasOurInstitution = ourInstitution.trim().length > 0;

    if (!wikiHasSpecimen)
    {
        counters.skippedNoSpecimen += 1;
        continue;
    }

    const specimenMatches = hasOurSpecimen && looseEqual(ourSpecimen, entry.specimenId);
    const institutionMatches = hasOurInstitution
        && wikiHasInstitution
        && looseEqual(ourInstitution, entry.institution);
    const specimenConflict = hasOurSpecimen && !specimenMatches;

    if (specimenConflict)
    {
        const conflictScope = hasOurInstitution && wikiHasInstitution && !institutionMatches
            ? "specimen_and_institution"
            : "specimen";

        conflicts.push({
            filePath: indexed.filePath,
            genusName: indexed.data.genus ?? entry.genus,
            binomial: entry.binomial,
            ourSpecimen,
            wikiSpecimen: entry.specimenId,
            ourInstitution,
            wikiInstitution: entry.institution,
            conflictScope,
        });
        continue;
    }

    const specimenNeedsBackfill = !hasOurSpecimen && wikiHasSpecimen;
    const institutionNeedsBackfill = !hasOurInstitution && wikiHasInstitution;

    // Defer compound / ambiguous specimen IDs until the schema supports
    // multi-specimen type series (see the holotype schema issue).
    if (specimenNeedsBackfill && !isSimpleSpecimenId(entry.specimenId))
    {
        deferred.push({
            binomial: entry.binomial,
            reason: "compound specimen id",
            wikiSpecimen: entry.specimenId,
            wikiInstitution: entry.institution,
        });
        continue;
    }

    if (!specimenNeedsBackfill && !institutionNeedsBackfill)
    {
        if (hasOurInstitution && wikiHasInstitution && !institutionMatches)
        {
            counters.institutionOnlyMismatch += 1;
        }
        else
        {
            counters.match += 1;
        }

        continue;
    }

    let newInstitution = ourInstitution;
    let institutionSource: BackfillChange["institutionSource"] = "unchanged";

    // When the species has no holotype at all, always try to produce an
    // institution alongside the specimen so the resulting block is
    // complete (the validator requires both fields when holotype exists).
    const needsFullHolotype = !hasOurInstitution && specimenNeedsBackfill;

    if (institutionNeedsBackfill || needsFullHolotype)
    {
        const resolved = resolveInstitutionFromSpecimen(entry.specimenId, registry);

        if (typeof resolved === "string" && resolved.length > 0)
        {
            newInstitution = resolved;
            institutionSource = "registry";
        }
        else if (isSimpleInstitution(entry.institution))
        {
            newInstitution = entry.institution;
            institutionSource = "wikipedia";
        }
        else
        {
            // Wikipedia's institution is empty or descriptive ("Destroyed,
            // formerly at…") and the prefix is not in the registry. Defer
            // this specimen for manual review so we don't leave a partial
            // holotype block.
            deferred.push({
                binomial: entry.binomial,
                reason: "unresolvable institution",
                wikiSpecimen: entry.specimenId,
                wikiInstitution: entry.institution,
            });
            continue;
        }
    }

    changes.push({
        filePath: indexed.filePath,
        genusName: indexed.data.genus ?? entry.genus,
        binomial: entry.binomial,
        oldSpecimen: ourSpecimen,
        newSpecimen: specimenNeedsBackfill ? entry.specimenId : ourSpecimen,
        oldInstitution: ourInstitution,
        newInstitution,
        institutionSource,
    });
}

console.log("");
console.log("=== Cross-reference summary ===");
console.log(`Wikipedia rows:           ${entries.length}`);
console.log(`Not in our dataset:       ${counters.notInRepo}`);
console.log(`Species not in dataset:   ${counters.speciesNotInRepo}`);
console.log(`Already matching:         ${counters.match}`);
console.log(`Institution diff (ignore): ${counters.institutionOnlyMismatch}`);
console.log(`Skipped (no wiki ID):     ${counters.skippedNoSpecimen}`);
console.log(`Backfill changes planned: ${changes.length}`);
console.log(`Deferred (compound/unresolvable): ${deferred.length}`);
console.log(`Specimen conflicts:       ${conflicts.length}`);

const registryCount = changes.filter((change) => change.institutionSource === "registry").length;
const wikipediaCount = changes.filter((change) => change.institutionSource === "wikipedia").length;
const unchangedInstitutionCount = changes.filter((change) => change.institutionSource === "unchanged").length;
console.log("");
console.log("=== Institution source breakdown ===");
console.log(`From institutions.yaml registry: ${registryCount}`);
console.log(`From Wikipedia fallback:         ${wikipediaCount}`);
console.log(`Unchanged (already set):         ${unchangedInstitutionCount}`);

if (changes.length > 0)
{
    console.log("");
    console.log("=== First 10 planned changes ===");

    for (const change of changes.slice(0, 10))
    {
        console.log(`  ${change.binomial}`);
        console.log(`    specimen:    "${change.oldSpecimen}" -> "${change.newSpecimen}"`);
        console.log(`    institution: "${change.oldInstitution}" -> "${change.newInstitution}" (${change.institutionSource})`);
    }
}

if (deferred.length > 0)
{
    console.log("");
    console.log("=== Deferred (not applied) ===");

    for (const entry of deferred)
    {
        console.log(`  ${entry.binomial} [${entry.reason}]`);
        console.log(`    wiki specimen:    ${entry.wikiSpecimen}`);
        console.log(`    wiki institution: ${entry.wikiInstitution}`);
    }
}

if (conflicts.length > 0)
{
    console.log("");
    console.log("=== Specimen conflicts (not applied) ===");

    for (const conflict of conflicts)
    {
        console.log(`  ${conflict.binomial} [${conflict.conflictScope}]`);
        console.log(`    ours: ${conflict.ourSpecimen}`);
        console.log(`    wiki: ${conflict.wikiSpecimen}`);
    }
}

if (applyFlag)
{
    console.log("");
    console.log(`Applying ${changes.length} changes...`);

    for (const change of changes)
    {
        writeBackfill(change);
    }

    console.log("Done.");
}
else
{
    console.log("");
    console.log("Dry run. Re-run with --apply to write YAML files.");
}
