/**
 * Backfills `pronunciation.ipa` for genera that already have a
 * `pronunciation.phonetic` respelling. Converts the Wikipedia-style
 * respelling notation (e.g. `ah-BEL-i-SAWR-us`) into IPA
 * (e.g. `/əˌbɛlɪˈsɔːrəs/`) using a deterministic syllable-level
 * transliteration table.
 *
 * Modes:
 *   --calibrate   Score the converter against genera that already
 *                 have both phonetic and IPA. No files written.
 *   --apply       Fill missing IPA on phonetic-only genera.
 *   --genus N     Process only the named genus (works with --apply
 *                 and --calibrate).
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-pronunciation-ipa.ts [options]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { parseDocument } from "yaml";
import type { GenusData } from "./types.ts";
import { findYamlFiles, parseYaml } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");
const generaDir = path.join(root, "genera");
const reportPath = path.join(root, "reports", "pronunciation-ipa-backfill.json");

type CliOptions = {
    apply: boolean;
    calibrate: boolean;
    genus?: string;
};

type CalibrationResult = {
    genus: string;
    phonetic: string;
    expectedIpa: string;
    generatedIpa: string;
    match: "exact" | "alternate" | "mismatch";
};

type FillResult = {
    genus: string;
    file: string;
    phonetic: string;
    generatedIpa: string;
};

/**
 * Parses CLI arguments.
 *
 * @returns Parsed options.
 */
function parseArgs(): CliOptions
{
    const args = process.argv.slice(2);
    const options: CliOptions = { apply: false, calibrate: false };

    for (let index = 0; index < args.length; index += 1)
    {
        const arg = args[index];

        if (arg === "--apply")
        {
            options.apply = true;
        }
        else if (arg === "--calibrate")
        {
            options.calibrate = true;
        }
        else if (arg === "--genus" && args[index + 1])
        {
            options.genus = args[index + 1];
            index += 1;
        }
        else
        {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

type VowelMapping = {
    pattern: RegExp;
    stressed: string;
    unstressed: string;
};

const vowelDigraphs: Array<VowelMapping> = [
    { pattern: /^eye/, stressed: "aɪ", unstressed: "aɪ" },
    { pattern: /^air/, stressed: "ɛər", unstressed: "ər" },
    { pattern: /^eer/, stressed: "ɪər", unstressed: "ɪər" },
    { pattern: /^ier/, stressed: "aɪər", unstressed: "aɪər" },
    { pattern: /^uhr/, stressed: "ɜːr", unstressed: "ər" },
    { pattern: /^awr/, stressed: "ɔːr", unstressed: "ɔːr" },
    { pattern: /^ohr/, stressed: "ɔːr", unstressed: "ɔːr" },
    { pattern: /^our/, stressed: "aʊər", unstressed: "aʊər" },
    { pattern: /^yoor/, stressed: "jʊər", unstressed: "jər" },
    { pattern: /^yoo/, stressed: "juː", unstressed: "jə" },
    { pattern: /^igh/, stressed: "aɪ", unstressed: "aɪ" },
    { pattern: /^ay/, stressed: "eɪ", unstressed: "eɪ" },
    { pattern: /^ee/, stressed: "iː", unstressed: "iː" },
    { pattern: /^oh/, stressed: "oʊ", unstressed: "oʊ" },
    { pattern: /^oo/, stressed: "uː", unstressed: "uː" },
    { pattern: /^aw/, stressed: "ɔː", unstressed: "ɔː" },
    { pattern: /^ah/, stressed: "ɑː", unstressed: "ə" },
    { pattern: /^ie/, stressed: "aɪ", unstressed: "iː" },
    { pattern: /^uh/, stressed: "ə", unstressed: "ə" },
    { pattern: /^ow/, stressed: "aʊ", unstressed: "aʊ" },
    { pattern: /^oy/, stressed: "ɔɪ", unstressed: "ɔɪ" },
    { pattern: /^ar/, stressed: "ɑːr", unstressed: "ɑːr" },
    { pattern: /^or/, stressed: "ɔːr", unstressed: "ɔːr" },
    { pattern: /^ur/, stressed: "ɜːr", unstressed: "ər" },
    { pattern: /^ir/, stressed: "ɜːr", unstressed: "ər" },
    { pattern: /^er/, stressed: "ɛr", unstressed: "ər" },
];

const singleVowels: Record<string, VowelMapping> = {
    a: { pattern: /^a/, stressed: "æ", unstressed: "æ" },
    e: { pattern: /^e/, stressed: "ɛ", unstressed: "ɪ" },
    i: { pattern: /^i/, stressed: "ɪ", unstressed: "ɪ" },
    o: { pattern: /^o/, stressed: "ɒ", unstressed: "oʊ" },
    u: { pattern: /^u/, stressed: "ʌ", unstressed: "ə" },
};

const consonantDigraphs: Array<{ pattern: RegExp; ipa: string }> = [
    { pattern: /^ng/, ipa: "ŋ" },
    { pattern: /^ch/, ipa: "tʃ" },
    { pattern: /^sh/, ipa: "ʃ" },
    { pattern: /^th/, ipa: "θ" },
    { pattern: /^dh/, ipa: "ð" },
    { pattern: /^zh/, ipa: "ʒ" },
    { pattern: /^ph/, ipa: "f" },
    { pattern: /^ck/, ipa: "k" },
    { pattern: /^x/, ipa: "ks" },
    { pattern: /^q/, ipa: "k" },
    { pattern: /^j/, ipa: "dʒ" },
];

const consonantSingles: Record<string, string> = {
    b: "b", d: "d", f: "f", g: "ɡ", h: "h",
    k: "k", l: "l", m: "m", n: "n", p: "p",
    r: "r", s: "s", t: "t", v: "v", w: "w",
    z: "z",
};

/**
 * Returns true when the entire syllable is uppercase letters and
 * non-letter characters, indicating stress in the respelling.
 *
 * @param syllable - A single syllable from the respelling.
 * @returns True if the syllable is uppercase.
 */
function isStressedSyllable(syllable: string): boolean
{
    const letters = syllable.replace(/[^A-Za-z]/g, "");

    return letters.length > 0 && letters === letters.toUpperCase();
}

/**
 * Converts a single lowercase respelling syllable into IPA.
 *
 * @param syllable - The syllable in lowercase (case stripped beforehand).
 * @param stressed - Whether the syllable carried stress markers.
 * @returns IPA transcription of the syllable.
 */
function syllableToIpa(syllable: string, stressed: boolean): string
{
    let remaining = syllable;
    let result = "";

    while (remaining.length > 0)
    {
        let matched = false;

        for (const entry of consonantDigraphs)
        {
            if (entry.pattern.test(remaining))
            {
                result += entry.ipa;
                remaining = remaining.replace(entry.pattern, "");
                matched = true;
                break;
            }
        }

        if (matched)
        {
            continue;
        }

        for (const mapping of vowelDigraphs)
        {
            if (mapping.pattern.test(remaining))
            {
                result += stressed ? mapping.stressed : mapping.unstressed;
                remaining = remaining.replace(mapping.pattern, "");
                matched = true;
                break;
            }
        }

        if (matched)
        {
            continue;
        }

        const head = remaining.charAt(0);
        const singleVowel = singleVowels[head];

        if (singleVowel)
        {
            result += stressed ? singleVowel.stressed : singleVowel.unstressed;
            remaining = remaining.slice(1);
            continue;
        }

        const consonant = consonantSingles[head];

        if (consonant)
        {
            result += consonant;
            remaining = remaining.slice(1);
            continue;
        }

        if (head === "y")
        {
            result += stressed ? "aɪ" : "i";
            remaining = remaining.slice(1);
            continue;
        }

        remaining = remaining.slice(1);
    }

    return result;
}

/**
 * Converts a Wikipedia-style respelling into a slash-wrapped IPA
 * transcription. Inserts a primary stress marker before the
 * last-stressed syllable and secondary markers before earlier
 * stressed syllables.
 *
 * @param phonetic - The respelling (e.g. "ah-BEL-i-SAWR-us").
 * @returns The IPA string (e.g. "/əˌbɛlɪˈsɔːrəs/").
 */
export function respellToIpa(phonetic: string): string
{
    const syllables = phonetic.split("-").map((part) => part.trim()).filter(Boolean);

    if (syllables.length === 0)
    {
        return "//";
    }

    const stressIndices = syllables
        .map((syllable, index) => (isStressedSyllable(syllable) ? index : -1))
        .filter((index) => index >= 0);
    const primaryIndex = stressIndices.length > 0
        ? stressIndices[stressIndices.length - 1]
        : syllables.length - 1;
    const secondaryIndices = new Set(stressIndices.filter((index) => index !== primaryIndex));

    const parts: Array<string> = [];

    for (let index = 0; index < syllables.length; index += 1)
    {
        const lower = syllables[index].toLowerCase();
        const stressed = stressIndices.includes(index);
        const ipa = syllableToIpa(lower, stressed);

        if (index === primaryIndex)
        {
            parts.push(`ˈ${ipa}`);
        }
        else if (secondaryIndices.has(index))
        {
            parts.push(`ˌ${ipa}`);
        }
        else
        {
            parts.push(ipa);
        }
    }

    const joined = parts.join("").replace(/([bdfgklmnprstvz])\1+/g, "$1");

    return `/${joined}/`;
}

/**
 * Loads every genus YAML and returns those with phonetic+ipa pairs.
 *
 * @returns Array of calibration entries.
 */
function loadCalibrationSet(): Array<{ genus: string; file: string; phonetic: string; ipa: string }>
{
    const result: Array<{ genus: string; file: string; phonetic: string; ipa: string }> = [];

    for (const filePath of findYamlFiles(generaDir))
    {
        const data = parseYaml<GenusData>(filePath);
        const phonetic = data?.pronunciation?.phonetic;
        const ipa = data?.pronunciation?.ipa;

        if (phonetic && ipa)
        {
            result.push({
                genus: data.genus ?? path.basename(filePath, ".yml"),
                file: filePath,
                phonetic,
                ipa,
            });
        }
    }

    return result;
}

/**
 * Loads every genus YAML and returns those with phonetic but no IPA.
 *
 * @returns Array of fill candidates.
 */
function loadFillCandidates(): Array<{ genus: string; file: string; phonetic: string }>
{
    const result: Array<{ genus: string; file: string; phonetic: string }> = [];

    for (const filePath of findYamlFiles(generaDir))
    {
        const data = parseYaml<GenusData>(filePath);
        const phonetic = data?.pronunciation?.phonetic;
        const ipa = data?.pronunciation?.ipa;

        if (phonetic && !ipa)
        {
            result.push({
                genus: data.genus ?? path.basename(filePath, ".yml"),
                file: filePath,
                phonetic,
            });
        }
    }

    return result;
}

/**
 * Compares a generated IPA string against an expected IPA string,
 * tolerating slash wrapping, alternate transcriptions separated by
 * commas, and surrounding whitespace.
 *
 * @param expected - The expected IPA (raw value from YAML).
 * @param generated - The generated IPA.
 * @returns "exact" when they match, "alternate" when one of multiple
 *          comma-separated alternates matches, or "mismatch".
 */
function compareIpa(expected: string, generated: string): "exact" | "alternate" | "mismatch"
{
    const normalize = (value: string): string => value
        .replace(/^\//, "")
        .replace(/\/$/, "")
        .trim();
    const generatedCore = normalize(generated);
    const expectedCore = normalize(expected);
    const alternates = expectedCore.split(",").map((alternate) => alternate.trim());

    if (alternates[0] === generatedCore)
    {
        return "exact";
    }

    if (alternates.includes(generatedCore))
    {
        return "alternate";
    }

    return "mismatch";
}

/**
 * Runs the calibration pass and writes a JSON report.
 *
 * @param genusFilter - Optional name to restrict the calibration to.
 */
function runCalibration(genusFilter?: string): void
{
    const samples = loadCalibrationSet()
        .filter((entry) => !genusFilter || entry.genus === genusFilter);
    const results: Array<CalibrationResult> = samples.map((entry) =>
    {
        const generated = respellToIpa(entry.phonetic);

        return {
            genus: entry.genus,
            phonetic: entry.phonetic,
            expectedIpa: entry.ipa,
            generatedIpa: generated,
            match: compareIpa(entry.ipa, generated),
        };
    });
    const summary = {
        total: results.length,
        exact: results.filter((entry) => entry.match === "exact").length,
        alternate: results.filter((entry) => entry.match === "alternate").length,
        mismatch: results.filter((entry) => entry.match === "mismatch").length,
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ mode: "calibration", summary, results }, null, 2), "utf8");

    console.log("Calibration:");
    console.log(`  total     ${summary.total}`);
    console.log(`  exact     ${summary.exact} (${(summary.exact / summary.total * 100).toFixed(1)}%)`);
    console.log(`  alternate ${summary.alternate}`);
    console.log(`  mismatch  ${summary.mismatch}`);
    console.log(`Report: ${path.relative(root, reportPath)}`);
}

/**
 * Generates IPA for every fill candidate and either writes a report
 * or applies the changes to the YAML files.
 *
 * @param apply - When true, write the IPA into the YAML files.
 * @param genusFilter - Optional name to restrict processing.
 */
function runFill(apply: boolean, genusFilter?: string): void
{
    const candidates = loadFillCandidates()
        .filter((entry) => !genusFilter || entry.genus === genusFilter);
    const fills: Array<FillResult> = candidates.map((entry) => ({
        genus: entry.genus,
        file: path.relative(root, entry.file),
        phonetic: entry.phonetic,
        generatedIpa: respellToIpa(entry.phonetic),
    }));

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ mode: apply ? "apply" : "audit", fills }, null, 2), "utf8");

    console.log(`Fill candidates: ${fills.length}`);

    if (!apply)
    {
        console.log(`Report (no files written): ${path.relative(root, reportPath)}`);
        return;
    }

    let written = 0;

    for (const candidate of candidates)
    {
        const generated = respellToIpa(candidate.phonetic);
        const original = fs.readFileSync(candidate.file, "utf8");
        const document = parseDocument(original);
        const pronunciation = document.get("pronunciation") as
            { set: (key: string, value: unknown) => void; has: (key: string) => boolean } | undefined;

        if (!pronunciation || pronunciation.has("ipa"))
        {
            continue;
        }

        pronunciation.set("ipa", generated);
        fs.writeFileSync(candidate.file, document.toString(), "utf8");
        written += 1;
    }

    console.log(`Wrote ${written} files.`);
}

/**
 * Entry point.
 */
function main(): void
{
    const options = parseArgs();

    if (options.calibrate)
    {
        runCalibration(options.genus);
        return;
    }

    runFill(options.apply, options.genus);
}

main();
