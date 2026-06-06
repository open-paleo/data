// Bootstrap step of the per-species intake pipeline. Adds a
// non-type species to an existing genus YAML.
//
// Unlike intake-bootstrap (which creates a whole new genus stub from
// PBDB/Wikipedia), this script:
//
//   1. Verifies the genus YAML already exists under genera/<Letter>/
//   2. Snapshots the current genus YAML so the eventual apply diff
//      shows just the species + reference additions
//   3. Queries PBDB at the species rank for holotype, locality, age,
//      and authority — the same fields the genus bootstrap seeds for
//      type species
//   4. Caches the genus Wikipedia article so the resume step can pass
//      it to the Sonnet extraction agent alongside the corpus paper
//      (most non-type species share a single Wikipedia article with
//      their genus)
//
// Output layout:
//
//   staging/intake-species/{Genus}-{species}/
//   ├── bootstrap.species.yml    Best-effort species block from PBDB
//   ├── genus-current.yml        Snapshot of the current genus YAML
//   └── papers-needed.md         Checklist of papers to fetch
//
// The genus YAML itself is NOT touched here. The apply step writes a
// merged genus-proposed.yml; promote.sh then replaces the live file.
//
// Usage:
//   npm run intake-species-bootstrap -- Pinacosaurus hilwitnorum
//   npm run intake-species-bootstrap -- Pinacosaurus hilwitnorum --issue 1885

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse as parseYamlContent, stringify as stringifyYaml } from "yaml";

import { getWorkingDir } from "./corpus-path.ts";
import {
    fetchPbdbHolotype,
    fetchPbdbOccurrence,
    fetchPbdbTaxon,
} from "./genus-enrichment.ts";
import type { GenusData } from "./types.ts";
import { readBibCitationKeys, resolveCitationKey } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const generaDir = path.join(root, "genera");
const referencesBibPath = path.join(root, "dist", "references.bib");
const stagingDir = path.join(root, "staging", "intake-species");

/**
 * Parsed CLI arguments.
 */
type Arguments = {
    /**
     * Genus name (case-sensitive — must match the YAML filename).
     */
    genus: string;

    /**
     * Specific epithet (lower-case).
     */
    species: string;

    /**
     * Optional issue number for the papers-needed.md header.
     */
    issue: number | null;
};

/**
 * Parses `process.argv.slice(2)` into a structured arguments object.
 *
 * @param argv - Raw arguments.
 * @returns The parsed arguments.
 */
function parseArguments(argv: Array<string>): Arguments
{
    const positional = new Array<string>();
    let issue: number | null = null;

    for (let index = 0; index < argv.length; index += 1)
    {
        const argument = argv[index];

        if (argument === "--issue")
        {
            const value = argv[index + 1] ?? "";

            if (!/^\d+$/.test(value))
            {
                throw new Error("--issue requires a numeric value");
            }

            issue = Number.parseInt(value, 10);
            index += 1;
        }
        else if (argument.startsWith("--"))
        {
            throw new Error(`Unknown argument: ${argument}`);
        }
        else
        {
            positional.push(argument);
        }
    }

    if (positional.length !== 2)
    {
        throw new Error(
            "Usage: intake-species-bootstrap <Genus> <species> [--issue N]",
        );
    }

    return { genus: positional[0], species: positional[1], issue };
}

/**
 * Locates the YAML file for an existing genus under `genera/`.
 *
 * @param genus - Genus name (case-sensitive).
 * @returns Absolute path to the YAML, or null if not found.
 */
function findGenusYaml(genus: string): string | null
{
    const letter = genus.charAt(0).toUpperCase();
    const directPath = path.join(generaDir, letter, `${genus}.yml`);

    if (fs.existsSync(directPath))
    {
        return directPath;
    }

    // Some letters are stored lower-cased on case-insensitive filesystems.
    const fallback = path.join(generaDir, letter.toLowerCase(), `${genus}.yml`);

    if (fs.existsSync(fallback))
    {
        return fallback;
    }

    return null;
}

/**
 * Synthesises a citation key from author surname + year following the
 * project convention. Mirrors the helper in intake-bootstrap.ts.
 *
 * @param authors - The authors string.
 * @param year - The publication year.
 * @returns The lower-case citation key.
 */
function citationKeyFor(authors: string, year: string | number): string
{
    const firstAuthor = (authors ?? "").split(";")[0].trim();
    const surnamePart = firstAuthor.split(",")[0].trim();
    const surname = surnamePart.split(/\s+/)[0];

    const normalised = surname
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");

    return `${normalised}${year}`;
}

/**
 * Best-effort species seed block derived from PBDB. Each field is
 * optional — the apply step is the source of truth for what actually
 * lands in the YAML.
 */
type SpeciesSeed = {
    name: string;
    status: string;
    type_species: false;
    period?: {
        name?: Array<string>;
        stage?: Array<string>;
        from_ma?: number;
        to_ma?: number;
    };
    location?: {
        country?: string;
        region?: string;
        formation?: string;
        coordinates?: Array<number>;
    };
    holotype?: {
        specimen_id?: Array<string>;
        specimen_type?: string;
        institution?: string;
    };
    erected_in?: string;
};

/**
 * Writes a `papers-needed.md` checklist for the species intake.
 *
 * @param genus - Genus name.
 * @param species - Species epithet.
 * @param issue - Optional issue number for the header.
 * @param describingKey - Proposed describing-paper citation key (or null).
 * @param alreadyInCorpus - Whether the key already exists in the bib.
 * @returns The Markdown body.
 */
function buildPapersNeededBody(
    genus: string,
    species: string,
    issue: number | null,
    describingKey: string | null,
    alreadyInCorpus: boolean,
): string
{
    const binomial = `${genus} ${species}`;
    const lines = new Array<string>();

    lines.push(`# ${binomial} — Papers Needed`);

    if (issue !== null)
    {
        lines.push("");
        lines.push(`Issue: #${issue}`);
    }

    lines.push("");
    lines.push("For each paper:");
    lines.push("");
    lines.push(
        "1. Fetch the paper markdown into `$OPEN_PALEO_PAPERS_DIR/markdown/{citation_key}.md`",
    );
    lines.push("   (defaults to a sibling `../open-paleo-papers/markdown/` next to this repo).");
    lines.push("2. Tick the checkbox `- [x]` and paste a citation string");
    lines.push("   on the same line, after a `— ` separator. The parser is");
    lines.push("   permissive but does best with a parenthesised year, a");
    lines.push("   quoted title, and a DOI when available.");
    lines.push("3. Run `npm run intake-species-resume -- " + genus + " " + species + "`.");
    lines.push("");
    lines.push(
        "(Updating `dist/references.bib` is NOT required — apply will parse the citation directly from this file.)",
    );
    lines.push("");
    lines.push("## Describing paper (REQUIRED)");
    lines.push("");

    if (describingKey)
    {
        const status = alreadyInCorpus
            ? "Already in `dist/references.bib` — confirm the markdown is fetched."
            : "Not yet in corpus; will need to be added when this paper lands.";

        lines.push(`- [ ] **${describingKey}**`);
        lines.push(`  ${status}`);
    }
    else
    {
        lines.push("- [ ] **Describing paper unknown** — PBDB has no record");
        lines.push("  for this species. Identify the original description");
        lines.push("  manually and fill in citation_key, DOI, authors, year,");
        lines.push("  title, journal.");
    }

    lines.push("");
    lines.push("## Additional papers (optional)");
    lines.push("");
    lines.push("List any further papers required to populate diagnostic features,");
    lines.push("locality detail, or to resolve disputes. Format as one bullet per");
    lines.push("paper:");
    lines.push("");
    lines.push("- [ ] **citation_key** — reason");
    lines.push("  DOI: ...");
    lines.push("");

    return lines.join("\n");
}

/**
 * Caches a Wikipedia article body to disk so the resume step can hand
 * it to the Sonnet extraction agent alongside the corpus paper. Uses
 * the genus article when no species-specific article exists.
 *
 * @param genus - Genus name.
 * @returns Absolute path to the cached JSON, or null on failure.
 */
async function cacheWikipediaArticle(genus: string): Promise<string | null>
{
    const cacheDir = path.join(getWorkingDir(), "wikipedia");
    const cachePath = path.join(cacheDir, `${genus}.json`);

    if (fs.existsSync(cachePath))
    {
        return cachePath;
    }

    const wikipediaApi = "https://en.wikipedia.org/w/api.php";
    const params = new URLSearchParams({
        action: "query",
        titles: genus,
        prop: "extracts",
        explaintext: "true",
        format: "json",
        origin: "*",
    });

    let extract = "";
    let found = false;

    try
    {
        const response = await fetch(`${wikipediaApi}?${params}`);
        const data = await response.json() as {
            query?: {
                pages?: Record<string, { extract?: string; missing?: string }>;
            };
        };

        if (data?.query?.pages)
        {
            const page = Object.values(data.query.pages)[0];

            if (page && !("missing" in page))
            {
                extract = page.extract ?? "";
                found = extract.length > 0;
            }
        }
    }
    catch
    {
        return null;
    }

    if (!found)
    {
        return null;
    }

    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
        cachePath,
        JSON.stringify({ title: genus, found: true, text: extract }, null, 2),
        "utf8",
    );

    return cachePath;
}

/**
 * Bootstrap entry point.
 */
async function main(): Promise<void>
{
    let args: Arguments;

    try
    {
        args = parseArguments(process.argv.slice(2));
    }
    catch (error)
    {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exit(2);
    }

    const { genus, species, issue } = args;
    const binomial = `${genus} ${species}`;
    const targetDir = path.join(stagingDir, `${genus}-${species}`);

    process.stdout.write(`Bootstrapping ${binomial}...\n`);

    if (fs.existsSync(targetDir))
    {
        process.stderr.write(
            `staging/intake-species/${genus}-${species}/ already exists. Remove it first.\n`,
        );
        process.exit(1);
    }

    const genusYamlPath = findGenusYaml(genus);

    if (genusYamlPath === null)
    {
        process.stderr.write(
            `No existing genus YAML found at genera/${genus.charAt(0).toUpperCase()}/${genus}.yml. `
            + "Use intake-genus first if this is a new genus.\n",
        );
        process.exit(1);
    }

    const genusYamlContent = fs.readFileSync(genusYamlPath, "utf8");
    const genusData = parseYamlContent(genusYamlContent) as GenusData;

    if (Array.isArray(genusData.species))
    {
        const existing = genusData.species.find((entry) => entry.name === binomial);

        if (existing !== undefined)
        {
            process.stderr.write(
                `${binomial} is already in ${genusYamlPath}. Nothing to do.\n`,
            );
            process.exit(1);
        }
    }

    process.stdout.write(`  Genus YAML: ${path.relative(root, genusYamlPath)}\n`);

    process.stdout.write("  Fetching PBDB taxon...\n");
    const taxon = await fetchPbdbTaxon(binomial);

    if (taxon)
    {
        process.stdout.write(`    PBDB taxon_no=${taxon.taxon_no ?? "n/a"}\n`);
    }
    else
    {
        process.stdout.write("    PBDB has no record\n");
    }

    process.stdout.write("  Fetching PBDB occurrence + holotype...\n");
    const [occurrence, holotype] = await Promise.all([
        fetchPbdbOccurrence(binomial),
        fetchPbdbHolotype(binomial),
    ]);

    process.stdout.write("  Caching Wikipedia article (genus)...\n");
    const wikipediaCachePath = await cacheWikipediaArticle(genus);

    if (wikipediaCachePath)
    {
        process.stdout.write(`    Cached at ${path.relative(root, wikipediaCachePath)}\n`);
    }
    else
    {
        process.stdout.write("    No Wikipedia article found / cache write failed\n");
    }

    // Synthesise the citation key from PBDB's reported authority.
    // Authority text comes from `taxon_attr` ("Surname year") when
    // PBDB has it. Species-level PBDB records are usually sparse, so
    // this can be null for freshly described post-2020 taxa.
    let describingKey: string | null = null;
    let describingYear: number | null = null;
    let describingAuthors: string | null = null;

    if (taxon?.taxon_attr)
    {
        const authorityMatch = taxon.taxon_attr.match(/^(.+?)\s+(\d{4})$/);

        if (authorityMatch !== null)
        {
            describingAuthors = authorityMatch[1].trim();
            describingYear = Number.parseInt(authorityMatch[2], 10);
            describingKey = citationKeyFor(describingAuthors, describingYear);
        }
    }

    const bibKeys = readBibCitationKeys(referencesBibPath);

    if (describingKey !== null)
    {
        const resolution = resolveCitationKey(describingKey, bibKeys);

        if (resolution.collided)
        {
            describingKey = resolution.resolvedKey;
        }
    }

    const alreadyInCorpus = describingKey !== null && bibKeys.has(describingKey);

    // Build the species seed block. Fields are added only when we
    // have a confident value — the polish step will fill in anything
    // PBDB missed.
    const seed: SpeciesSeed = {
        name: binomial,
        status: "valid",
        type_species: false,
    };

    if (taxon?.early_interval)
    {
        const period = { stage: [taxon.early_interval] } as SpeciesSeed["period"];

        if (taxon.firstapp_max_ma)
        {
            period!.from_ma = taxon.firstapp_max_ma;
        }

        if (taxon.lastapp_min_ma)
        {
            period!.to_ma = taxon.lastapp_min_ma;
        }

        seed.period = period;
    }

    if (occurrence?.cc || occurrence?.formation || occurrence?.lat !== undefined)
    {
        const location: SpeciesSeed["location"] = {};

        if (occurrence.cc)
        {
            location.country = occurrence.cc;
        }

        if (occurrence.state)
        {
            location.region = occurrence.state;
        }

        if (occurrence.formation)
        {
            location.formation = occurrence.formation;
        }

        if (occurrence.lat !== undefined && occurrence.lng !== undefined)
        {
            location.coordinates = [occurrence.lat, occurrence.lng];
        }

        seed.location = location;
    }

    if (holotype?.specimenId)
    {
        const holotypeBlock: NonNullable<SpeciesSeed["holotype"]> = {
            specimen_id: [holotype.specimenId],
            specimen_type: "holotype",
        };

        if (holotype.institution)
        {
            holotypeBlock.institution = holotype.institution;
        }

        seed.holotype = holotypeBlock;
    }

    if (describingKey !== null)
    {
        seed.erected_in = describingKey;
    }

    // Write outputs.
    fs.mkdirSync(targetDir, { recursive: true });

    const bootstrapSpeciesPath = path.join(targetDir, "bootstrap.species.yml");
    fs.writeFileSync(
        bootstrapSpeciesPath,
        stringifyYaml(seed, { lineWidth: 80 }),
        "utf8",
    );

    const genusCurrentPath = path.join(targetDir, "genus-current.yml");
    fs.writeFileSync(genusCurrentPath, genusYamlContent, "utf8");

    const papersNeededBody = buildPapersNeededBody(
        genus,
        species,
        issue,
        describingKey,
        alreadyInCorpus,
    );
    const papersNeededPath = path.join(targetDir, "papers-needed.md");
    fs.writeFileSync(papersNeededPath, papersNeededBody, "utf8");

    process.stdout.write("\nDone.\n");
    process.stdout.write(`  bootstrap.species.yml: ${path.relative(root, bootstrapSpeciesPath)}\n`);
    process.stdout.write(`  genus-current.yml:     ${path.relative(root, genusCurrentPath)}\n`);
    process.stdout.write(`  papers-needed.md:      ${path.relative(root, papersNeededPath)}\n`);

    if (describingKey !== null)
    {
        const tag = alreadyInCorpus ? "already in corpus" : "NEW — to be added";
        process.stdout.write(`  Describing paper:      ${describingKey} (${tag})\n`);
    }
    else
    {
        process.stdout.write(
            "  Describing paper:      not found via PBDB — manual lookup needed\n",
        );
    }
}

main().catch((error) =>
{
    console.error("Fatal error:", error);
    process.exit(1);
});
