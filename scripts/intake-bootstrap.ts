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
import {
    citationKeyFor,
    findStoreKeyByDoi,
    readStoreCitationKeys,
    readStoreSiblings,
    resolveCitationKey,
} from "./utilities.ts";

const scriptPath = url.fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const root = path.join(scriptDir, "..");

const stagingIntakeDir = path.join(root, "staging", "intake");

/**
 * The describing paper as the bootstrap resolved it.
 */
type DescribingPaper = {
    /**
     * Resolved citation key, or null when PBDB gave nothing to key from.
     * This is the ONE key the run uses — it is written into `erected_in`
     * and printed on the checklist, so the two can never disagree.
     */
    key: string | null;

    /**
     * DOI of the paper, or null when unresolved.
     */
    doi: string | null;

    /**
     * Title of the paper, or null when unresolved.
     */
    title: string | null;

    /**
     * Journal of the paper, or null when unresolved.
     */
    journal: string | null;

    /**
     * Whether the key already names an entry in the reference store.
     */
    alreadyInStore: boolean;

    /**
     * Whether DOI/title/journal are still missing because PBDB had no
     * linked reference_no.
     */
    needsMetadata: boolean;

    /**
     * Non-null when the bare proposed key was bumped to a suffix letter.
     */
    disambiguationReason: string | null;

    /**
     * Set when the paper's DOI already sits in the store under this key, so
     * the run reused it rather than minting a fresh suffix for the same paper.
     */
    doiReusedKey: string | null;

    /**
     * Whether the year in the key came from PBDB's authority string alone,
     * with no DOI to check it against.
     */
    yearUnverified: boolean;

    /**
     * Sibling `<author><year><letter>` entries already in the store, listed
     * whenever a fresh suffix was minted so the operator can see whether one
     * of them is in fact the paper being sought.
     */
    siblings: Array<{ id: string; title: string; doi: string | null }>;
};

/**
 * Builds the `papers-needed.md` checklist body.
 *
 * @param genus - The genus name.
 * @param notes - Verbatim --notes context, or null.
 * @param describing - The resolved describing paper.
 * @param warnings - Seed fields the enrichment declined to write, for the
 *     operator to fill in from the paper.
 * @returns The Markdown body, ready to write.
 */
function buildPapersNeededBody(
    genus: string,
    notes: string | null,
    describing: DescribingPaper,
    warnings: Array<string>,
): string
{
    const {
        key: describingKey,
        doi: describingDoi,
        title: describingTitle,
        journal: describingJournal,
        alreadyInStore,
        needsMetadata: describingNeedsMetadata,
        disambiguationReason,
    } = describing;

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
        else if (alreadyInStore)
        {
            lines.push("  Note: this citation key is already in the reference");
            lines.push("  store — confirm it is the right paper.");
        }

        if (describing.yearUnverified)
        {
            lines.push("  Note: the year comes from PBDB's authority string with no DOI to");
            lines.push("  check it against, and PBDB carries the wrong year often enough to");
            lines.push("  be worth confirming against the paper before the markdown is saved.");
        }
    }
    else if (describingKey)
    {
        const status = alreadyInStore
            ? "Already in the reference store; confirm the markdown is fetched."
            : "Not yet in the store; will be added when this paper lands.";

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

        if (describing.doiReusedKey)
        {
            lines.push("  Note: this DOI is already filed in the reference store under");
            lines.push(`  ${describing.doiReusedKey}, so that key is reused rather than a fresh`);
            lines.push("  suffix minted for a second copy of the same paper.");
        }
        else if (disambiguationReason)
        {
            lines.push(`  Note: key disambiguated — ${disambiguationReason}.`);
            lines.push(`  Save the corpus markdown as ${describingKey}.md.`);
        }

        lines.push(`  ${status}`);
    }
    else if (!describingKey)
    {
        lines.push("- [ ] **Describing paper unknown** — PBDB has no record");
        lines.push("  (common for post-2020 taxa). Identify the original");
        lines.push("  description manually and fill in citation_key, DOI,");
        lines.push("  authors, year, title, journal.");
    }

    // A DOI settles the key on its own, but pre-DOI papers offer nothing to
    // match on, so the siblings go on the page for the operator to scan.
    if (describing.siblings.length > 0 && !describing.doiReusedKey && !alreadyInStore)
    {
        lines.push("");
        lines.push(describing.siblings.length === 1
            ? "  The store already holds this sibling. Check that it is not the paper"
            : "  The store already holds these siblings. Check that none of them is the paper");
        lines.push("  being sought before fetching under a fresh key:");

        for (const sibling of describing.siblings)
        {
            lines.push(`  - ${sibling.id} — ${sibling.title}`
                + (sibling.doi ? ` (doi:${sibling.doi})` : " (no DOI on file)"));
        }
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

    if (warnings.length > 0)
    {
        lines.push("## Fields left unseeded");
        lines.push("");
        lines.push("The bootstrap declined to write these rather than guess. Fill them in");
        lines.push("from the paper during the apply-step polish.");
        lines.push("");

        for (const warning of warnings)
        {
            lines.push(`- ${warning}`);
        }

        lines.push("");
    }

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

    const reference = enriched.reference ?? null;

    // Prefer the resolved DOI reference when present; otherwise fall
    // back to the bare author + year that PBDB attaches at the taxon
    // level. The fallback is common for older genera where PBDB has no
    // linked reference_no.
    const describing: DescribingPaper = {
        key: null,
        doi: null,
        title: null,
        journal: null,
        alreadyInStore: false,
        needsMetadata: false,
        disambiguationReason: null,
        doiReusedKey: null,
        yearUnverified: false,
        siblings: new Array<{ id: string; title: string; doi: string | null }>(),
    };

    if (reference?.authors && reference?.year)
    {
        describing.key = citationKeyFor(reference.authors, reference.year);
        describing.doi = reference.doi ?? null;
        describing.title = reference.title ?? null;
        describing.journal = reference.journal ?? null;
    }
    else if (enriched.authors && enriched.year)
    {
        describing.key = citationKeyFor(enriched.authors, enriched.year);
        describing.needsMetadata = true;
        describing.yearUnverified = true;
    }

    // The store is the source of truth for what keys exist; dist/references.bib
    // is a build output that can lag the working tree.
    const storeKeys = readStoreCitationKeys(root);

    if (describing.key)
    {
        describing.siblings = readStoreSiblings(root, describing.key);

        // A DOI already in the store settles the key outright. Minting a fresh
        // suffix for it would file one paper twice, which reads downstream as
        // two independent sources (#2070 §1.2).
        const reusable = describing.doi
            ? findStoreKeyByDoi(root, describing.key, describing.doi)
            : null;

        if (reusable)
        {
            describing.doiReusedKey = reusable;
            describing.key = reusable;
        }
        else
        {
            const resolution = resolveCitationKey(describing.key, storeKeys);

            if (resolution.collided)
            {
                describing.key = resolution.resolvedKey;
                describing.disambiguationReason = resolution.reason;
            }
        }

        describing.alreadyInStore = storeKeys.has(describing.key);
    }

    // Built only once the key is settled: `erected_in` and the checklist must
    // name the same paper (#2070 §1.1).
    const genusYaml = toGenusYaml(enriched, reference, describing.key);

    fs.mkdirSync(targetDir, { recursive: true });

    const bootstrapPath = path.join(targetDir, "bootstrap.yml");
    fs.writeFileSync(
        bootstrapPath,
        stringifyYaml(genusYaml, { lineWidth: 80 }),
        "utf8",
    );

    const papersNeededBody = buildPapersNeededBody(
        genus,
        notes,
        describing,
        enriched.warnings,
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

    if (describing.key && describing.needsMetadata)
    {
        process.stdout.write(
            `  Describing paper: ${describing.key} (key only — DOI/metadata `
            + "must be supplied manually)\n",
        );
    }
    else if (describing.key)
    {
        const tag = describing.doiReusedKey
            ? "already in store, matched by DOI"
            : (describing.alreadyInStore ? "already in store" : "NEW — to be added");

        process.stdout.write(`  Describing paper: ${describing.key} (${tag})\n`);
    }
    else
    {
        process.stdout.write("  Describing paper: not found via PBDB — manual lookup needed\n");
    }

    if (enriched.warnings.length > 0)
    {
        process.stdout.write(`\nFields left unseeded (${enriched.warnings.length}):\n`);

        for (const warning of enriched.warnings)
        {
            process.stdout.write(`  - ${warning}\n`);
        }
    }
}

main().catch((error) =>
{
    console.error("Fatal error:", error);
    process.exit(1);
});
