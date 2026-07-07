// Bootstrap step of the per-genus intake pipeline. Fetches data
// from PBDB, Wikipedia, and Wikidata to produce a best-effort stub
// `bootstrap.yml` plus a `papers-needed.md` checklist that the user
// then satisfies (manually) before invoking `intake-resume`.
//
// Output layout:
//
//   staging/intake/{Genus}/
//   ├── bootstrap.yml        Best-effort YAML from external sources
//   ├── papers-needed.md     Checklist of papers to fetch and add to
//   │                        the corpus
//   └── notes.md             Verbatim --notes context (when provided)
//
// Exits non-zero if `staging/intake/{Genus}/` already exists.
//
// Usage:
//   npm run intake-bootstrap -- Bagaraatan
//   npm run intake-bootstrap -- Bagaraatan --notes "1996 Osmólska. ..."

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { stringify as stringifyYaml } from "yaml";

import {
    enrichGenus,
    fetchPbdbTaxon,
    walkParentChain,
} from "./genus-enrichment.ts";
import { toGenusYaml } from "./genus-enrichment.ts";
import { readBibCitationKeys, resolveCitationKey } from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const referencesBibPath = path.join(root, "dist", "references.bib");
const stagingIntakeDir = path.join(root, "staging", "intake");

/**
 * Synthesises a citation key from author surname + year following the
 * project convention (e.g. "Osmólska, H." 1996 → "osmolska1996"). Strips
 * diacritics and non-alphabetic characters.
 *
 * @param authors - The authors string (semicolon-separated entries).
 * @param year - The publication year as a number or string.
 * @returns The lower-case citation key.
 */
function citationKeyFor(authors: string, year: string | number): string
{
    const firstAuthor = (authors ?? "").split(";")[0].trim();

    // Take only the first whitespace-delimited token before any
    // comma — this collapses cases like "Lovelace et al." down to
    // "Lovelace", and "Smith Jr." down to "Smith". Stops at a comma
    // so "Osmólska, H." still yields "Osmólska".
    const surnamePart = firstAuthor.split(",")[0].trim();
    const surname = surnamePart.split(/\s+/)[0];

    // Keep diacritics and hyphens per the reference-key convention (#1894):
    // "Ősi" -> "ősi", "Prieto-Márquez" -> "prieto-márquez". Only spaces,
    // digits, and other punctuation are removed.
    const normalised = surname
        .toLowerCase()
        .replace(/[^\p{L}-]/gu, "");

    return `${normalised}${year}`;
}

/**
 * Builds the `papers-needed.md` checklist body.
 *
 * @param genus - The genus name.
 * @param notes - Verbatim --notes context, or null.
 * @param describingKey - Citation key of the describing paper, or null
 *     when not yet known.
 * @param describingDoi - DOI of the describing paper, or null.
 * @param describingTitle - Title of the describing paper, or null.
 * @param describingJournal - Journal of the describing paper, or null.
 * @param alreadyInCorpus - Whether the citation key is present in
 *     `dist/references.bib`.
 * @param describingNeedsMetadata - Whether the describing paper has
 *     no DOI/title/journal yet (PBDB had no reference_no).
 * @param disambiguationReason - Non-null when the proposed key
 *     collided with existing biblatex-suffix variants in the bib
 *     and was bumped to the next free letter (e.g. `funston2020c`).
 * @returns The Markdown body, ready to write.
 */
function buildPapersNeededBody(
    genus: string,
    notes: string | null,
    describingKey: string | null,
    describingDoi: string | null,
    describingTitle: string | null,
    describingJournal: string | null,
    alreadyInCorpus: boolean,
    describingNeedsMetadata: boolean,
    disambiguationReason: string | null,
): string
{
    const lines = new Array<string>();

    lines.push(`# ${genus} — Papers Needed`);
    lines.push("");
    lines.push("For each paper:");
    lines.push("");
    lines.push("1. Fetch the paper markdown into `$OPEN_PALEO_PAPERS_DIR/markdown/{citation_key}.md`");
    lines.push("   (defaults to a sibling `../open-paleo-papers/markdown/` next to this repo).");
    lines.push("2. Tick the checkbox `- [x]` and paste a citation string");
    lines.push("   on the same line, after a `— ` separator. Common formats");
    lines.push("   work — the parser is permissive but does best with a");
    lines.push("   parenthesised year, a quoted title, and a DOI when available.");
    lines.push("   Example:");
    lines.push("   `- [x] **smith2024** — Smith, J. (2024). \"Title here\". Journal Name 12 (3): 100-110. doi:10.xxxx/yyyy`");
    lines.push("3. Run `npm run intake-resume -- " + genus + "`.");
    lines.push("");
    lines.push("(Updating `dist/references.bib` is NOT required — apply will");
    lines.push("parse the citation directly from this file.)");
    lines.push("");
    lines.push("## Describing paper (REQUIRED)");
    lines.push("");

    if (describingKey && describingNeedsMetadata)
    {
        lines.push(`- [ ] **${describingKey}** — proposed key (PBDB had no linked reference)`);
        lines.push("  PBDB returned the genus authority (authors + year) but not a");
        lines.push("  reference_no, so DOI/title/journal/volume/pages must be");
        lines.push("  supplied manually when adding this paper to the corpus.");

        if (disambiguationReason)
        {
            lines.push(`  Note: key disambiguated — ${disambiguationReason}.`);
            lines.push(`  Save the corpus markdown as ${describingKey}.md.`);
        }
        else if (alreadyInCorpus)
        {
            lines.push("  Note: this citation key is already present in");
            lines.push("  `dist/references.bib` — confirm it is the right paper.");
        }
    }
    else if (describingKey)
    {
        const status = alreadyInCorpus
            ? "Already in corpus (`dist/references.bib`); confirm the markdown is fetched."
            : "Not yet in corpus; will need to be added when this paper lands.";

        lines.push(`- [ ] **${describingKey}**`);

        if (describingTitle)
        {
            lines.push(`  Title: ${describingTitle}`);
        }

        if (describingJournal)
        {
            lines.push(`  Journal: ${describingJournal}`);
        }

        if (describingDoi)
        {
            lines.push(`  DOI: ${describingDoi}`);
        }

        if (disambiguationReason)
        {
            lines.push(`  Note: key disambiguated — ${disambiguationReason}.`);
            lines.push(`  Save the corpus markdown as ${describingKey}.md.`);
        }

        lines.push(`  ${status}`);
    }
    else
    {
        lines.push("- [ ] **Describing paper unknown** — PBDB has no record");
        lines.push("  (common for post-2020 taxa). Identify the original");
        lines.push("  description manually and fill in citation_key, DOI,");
        lines.push("  authors, year, title, journal.");
    }

    lines.push("");
    lines.push("## Additional papers (optional)");
    lines.push("");
    lines.push("List any further papers required to populate diagnostic features,");
    lines.push("paleoenvironment, material descriptions, or to resolve a stale");
    lines.push("dispute. Format as one bullet per paper:");
    lines.push("");
    lines.push("- [ ] **citation_key** — reason");
    lines.push("  DOI: ...");
    lines.push("");

    if (notes)
    {
        lines.push("## Notes (verbatim)");
        lines.push("");
        lines.push(`> ${notes}`);
        lines.push("");
    }

    return lines.join("\n");
}

/**
 * Bootstrap entry point.
 */
async function main(): Promise<void>
{
    const args = process.argv.slice(2);
    const notesIndex = args.indexOf("--notes");
    const noteOverride = notesIndex >= 0 ? args[notesIndex + 1] : null;
    const positional = args.filter(
        (arg, index) => !arg.startsWith("--")
            && (notesIndex < 0 || index !== notesIndex + 1));

    if (positional.length !== 1)
    {
        process.stderr.write("Usage: intake-bootstrap <Genus> [--notes \"...\"]\n");
        process.exit(2);
    }

    const genus = positional[0];
    const targetDir = path.join(stagingIntakeDir, genus);

    if (fs.existsSync(targetDir))
    {
        process.stderr.write(
            `staging/intake/${genus}/ already exists. Remove it first or run intake-resume.\n`,
        );
        process.exit(1);
    }

    const notes = noteOverride;

    process.stdout.write(`Bootstrapping ${genus}...\n`);
    process.stdout.write("  Fetching PBDB taxon...\n");
    const taxon = await fetchPbdbTaxon(genus);

    if (taxon)
    {
        process.stdout.write(`    PBDB taxon_no=${taxon.taxon_no}, parent_no=${taxon.parent_no}\n`);
    }
    else
    {
        process.stdout.write("    PBDB has no record\n");
    }

    process.stdout.write("  Walking parent chain...\n");
    const chain = taxon?.parent_no
        ? await walkParentChain(taxon.parent_no)
        : new Array<string>();

    if (chain.length > 0)
    {
        process.stdout.write(`    Chain: ${chain.join(" → ")}\n`);
    }
    else
    {
        process.stdout.write("    No parent chain (will need manual parent assignment)\n");
    }

    process.stdout.write("  Enriching from Wikipedia + Wikidata...\n");
    const enriched = await enrichGenus(genus, chain, taxon);

    process.stdout.write(
        `    Fields populated: ${enriched.fieldsPopulated}/${enriched.fieldsTotal}\n`,
    );

    const genusYaml = toGenusYaml(enriched, enriched.reference ?? null);

    fs.mkdirSync(targetDir, { recursive: true });

    const bootstrapPath = path.join(targetDir, "bootstrap.yml");
    fs.writeFileSync(
        bootstrapPath,
        stringifyYaml(genusYaml, { lineWidth: 80 }),
        "utf8",
    );

    const reference = enriched.reference ?? null;

    // Prefer the resolved DOI reference when present; otherwise fall
    // back to the bare author + year that PBDB attaches at the taxon
    // level. The fallback is common for older genera where PBDB has no
    // linked reference_no.
    let describingKey: string | null = null;
    let describingDoi: string | null = null;
    let describingTitle: string | null = null;
    let describingJournal: string | null = null;
    let describingNeedsMetadata = false;
    let disambiguationReason: string | null = null;

    if (reference?.authors && reference?.year)
    {
        describingKey = citationKeyFor(reference.authors, reference.year);
        describingDoi = reference.doi ?? null;
        describingTitle = reference.title ?? null;
        describingJournal = reference.journal ?? null;
    }
    else if (enriched.authors && enriched.year)
    {
        describingKey = citationKeyFor(enriched.authors, enriched.year);
        describingNeedsMetadata = true;
    }

    const bibKeys = readBibCitationKeys(referencesBibPath);

    if (describingKey)
    {
        const resolution = resolveCitationKey(describingKey, bibKeys);

        if (resolution.collided)
        {
            describingKey = resolution.resolvedKey;
            disambiguationReason = resolution.reason;
        }
    }

    const alreadyInCorpus = describingKey ? bibKeys.has(describingKey) : false;

    const papersNeededBody = buildPapersNeededBody(
        genus,
        notes,
        describingKey,
        describingDoi,
        describingTitle,
        describingJournal,
        alreadyInCorpus,
        describingNeedsMetadata,
        disambiguationReason,
    );

    const papersNeededPath = path.join(targetDir, "papers-needed.md");
    fs.writeFileSync(papersNeededPath, papersNeededBody, "utf8");

    if (notes)
    {
        const notesPath = path.join(targetDir, "notes.md");
        fs.writeFileSync(
            notesPath,
            `# ${genus} — Notes\n\n${notes}\n`,
            "utf8",
        );
    }

    process.stdout.write("\nDone.\n");
    process.stdout.write(`  bootstrap.yml:    ${bootstrapPath}\n`);
    process.stdout.write(`  papers-needed.md: ${papersNeededPath}\n`);

    if (describingKey && describingNeedsMetadata)
    {
        process.stdout.write(
            `  Describing paper: ${describingKey} (key only — DOI/metadata `
            + "must be supplied manually)\n",
        );
    }
    else if (describingKey)
    {
        process.stdout.write(
            `  Describing paper: ${describingKey}`
            + (alreadyInCorpus ? " (already in corpus)\n" : " (NEW — to be added)\n"),
        );
    }
    else
    {
        process.stdout.write("  Describing paper: not found via PBDB — manual lookup needed\n");
    }
}

main().catch((error) =>
{
    console.error("Fatal error:", error);
    process.exit(1);
});
