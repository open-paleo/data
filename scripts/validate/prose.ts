// Checks on prose fields: identifiers, spelling, citation form, quotations and comments.

import * as path from "node:path";

import { CST, Lexer } from "yaml";

import { findYamlFiles } from "../utilities.ts";
import { checkError, checkWarning } from "./report.ts";
import type { ValidationContext } from "./context.ts";
import { walkStrings } from "./walk.ts";

/**
 * The "Identifier compliance" check.
 *
 * Identifier compliance
 *
 * @param context - The loaded data the checks read.
 */
export function checkIdentifierCompliance(context: ValidationContext): void
{
    const {
        allowedIdentifierSources,
        genusParsed,
    } = context;

    for (const [filePath, doc] of genusParsed)
    {
        if (!doc || !Array.isArray(doc.identifiers))
        {
            continue;
        }

        const seenPairs = new Set<string>();
        for (const identifier of doc.identifiers)
        {
            if (!identifier)
            {
                continue;
            }

            if (identifier.source && !allowedIdentifierSources.has(identifier.source))
            {
                checkError(
                    "Identifier compliance",
                    filePath,
                    `invalid identifier source '${identifier.source}' (must be one of: ${[...allowedIdentifierSources].join(", ")})`);
            }

            if (!identifier.id || (typeof identifier.id === "string" && identifier.id.trim() === ""))
            {
                checkError(
                    "Identifier compliance",
                    filePath,
                    `identifier with source '${identifier.source ?? "?"}' has empty or missing 'id'`);
            }

            const pair = `${identifier.source}:${identifier.id}`;
            if (seenPairs.has(pair))
            {
                checkError(
                    "Identifier compliance",
                    filePath,
                    `duplicate identifier source/id pair: ${pair}`);
            }

            seenPairs.add(pair);
        }
    }
}

/**
 * The "American English" check.
 *
 * American English
 *
 * Surfaces British-English spellings in editorial prose fields so they
 * can be converted to American English (project policy). Skipped:
 * reference titles/journals/publishers/authors (proper-noun metadata
 * preserved verbatim), species/synonym names (taxon authority), and
 * quoted spans (a quotation is reproduced as its source spelled it).
 *
 * @param context - The loaded data the checks read.
 */
export function checkAmericanEnglish(context: ValidationContext): void
{
    const {
        proseFields,
        stripQuotedSpans,
    } = context;

    /**
     * Curated map of British spellings to their American equivalents: each
     * entry is a lowercase British word, matched whole and case-insensitively,
     * paired with the suggested American replacement. Entries are deliberately
     * conservative: only words that are unambiguously British (no
     * homographs with valid American words — "analyses" the noun plural
     * of "analysis" is omitted on purpose).
     */
    const britishToAmerican: Array<[string, string]> = [
        ["colour", "color"],
        ["colours", "colors"],
        ["coloured", "colored"],
        ["colouring", "coloring"],
        ["colouration", "coloration"],
        ["colourful", "colorful"],
        ["armour", "armor"],
        ["armours", "armors"],
        ["armoured", "armored"],
        ["behaviour", "behavior"],
        ["behaviours", "behaviors"],
        ["behavioural", "behavioral"],
        ["favour", "favor"],
        ["favours", "favors"],
        ["favoured", "favored"],
        ["favouring", "favoring"],
        ["favourite", "favorite"],
        ["honour", "honor"],
        ["honours", "honors"],
        ["honoured", "honored"],
        ["honouring", "honoring"],
        ["honourable", "honorable"],
        ["harbour", "harbor"],
        ["harbours", "harbors"],
        ["harboured", "harbored"],
        ["labour", "labor"],
        ["labours", "labors"],
        ["laboured", "labored"],
        ["neighbour", "neighbor"],
        ["neighbours", "neighbors"],
        ["neighbouring", "neighboring"],
        ["neighbourhood", "neighborhood"],
        ["rumour", "rumor"],
        ["vigour", "vigor"],
        ["savour", "savor"],
        ["centre", "center"],
        ["centres", "centers"],
        ["centred", "centered"],
        ["centring", "centering"],
        ["theatre", "theater"],
        ["spectre", "specter"],
        ["sceptre", "scepter"],
        ["metre", "meter"],
        ["metres", "meters"],
        ["kilometre", "kilometer"],
        ["kilometres", "kilometers"],
        ["millimetre", "millimeter"],
        ["millimetres", "millimeters"],
        ["centimetre", "centimeter"],
        ["centimetres", "centimeters"],
        ["fibre", "fiber"],
        ["fibres", "fibers"],
        ["manoeuvre", "maneuver"],
        ["manoeuvres", "maneuvers"],
        ["manoeuvred", "maneuvered"],
        ["manoeuvring", "maneuvering"],
        ["defence", "defense"],
        ["defences", "defenses"],
        ["offence", "offense"],
        ["offences", "offenses"],
        ["pretence", "pretense"],
        ["licence", "license"],
        ["licences", "licenses"],
        ["licenced", "licensed"],
        ["catalogue", "catalog"],
        ["catalogues", "catalogs"],
        ["catalogued", "cataloged"],
        ["cataloguing", "cataloging"],
        ["dialogue", "dialog"],
        ["dialogues", "dialogs"],
        ["analyse", "analyze"],
        ["analysed", "analyzed"],
        ["analysing", "analyzing"],
        ["organise", "organize"],
        ["organised", "organized"],
        ["organises", "organizes"],
        ["organising", "organizing"],
        ["organisation", "organization"],
        ["organisations", "organizations"],
        ["organisational", "organizational"],
        ["synthesise", "synthesize"],
        ["synthesised", "synthesized"],
        ["synthesising", "synthesizing"],
        ["synthesises", "synthesizes"],
        ["recognise", "recognize"],
        ["recognised", "recognized"],
        ["recognises", "recognizes"],
        ["recognising", "recognizing"],
        ["recognisable", "recognizable"],
        ["specialise", "specialize"],
        ["specialised", "specialized"],
        ["specialises", "specializes"],
        ["specialising", "specializing"],
        ["specialisation", "specialization"],
        ["characterise", "characterize"],
        ["characterised", "characterized"],
        ["characterises", "characterizes"],
        ["characterising", "characterizing"],
        ["emphasise", "emphasize"],
        ["emphasised", "emphasized"],
        ["emphasises", "emphasizes"],
        ["emphasising", "emphasizing"],
        ["realise", "realize"],
        ["realised", "realized"],
        ["realises", "realizes"],
        ["realising", "realizing"],
        ["realisation", "realization"],
        ["utilise", "utilize"],
        ["utilised", "utilized"],
        ["utilises", "utilizes"],
        ["utilising", "utilizing"],
        ["utilisation", "utilization"],
        ["civilisation", "civilization"],
        ["civilisations", "civilizations"],
        ["colonisation", "colonization"],
        ["hypothesise", "hypothesize"],
        ["hypothesised", "hypothesized"],
        ["prioritise", "prioritize"],
        ["prioritised", "prioritized"],
        ["whilst", "while"],
        ["amongst", "among"],
        ["travelled", "traveled"],
        ["travelling", "traveling"],
        ["traveller", "traveler"],
        ["travellers", "travelers"],
        ["modelled", "modeled"],
        ["modelling", "modeling"],
        ["labelled", "labeled"],
        ["labelling", "labeling"],
        ["signalled", "signaled"],
        ["signalling", "signaling"],
        ["cancelled", "canceled"],
        ["cancelling", "canceling"],
        ["fuelled", "fueled"],
        ["fuelling", "fueling"],
        ["focussed", "focused"],
        ["focussing", "focusing"],
        ["sulphur", "sulfur"],
        ["sulphuric", "sulfuric"],
        ["aluminium", "aluminum"],
        ["moulting", "molting"],
        ["moulted", "molted"],
        ["moult", "molt"],
        ["moults", "molts"],
        ["mould", "mold"],
        ["moulds", "molds"],
        ["moulded", "molded"],
        ["moulding", "molding"],
        ["palaeontology", "paleontology"],
        ["palaeontologist", "paleontologist"],
        ["palaeontologists", "paleontologists"],
        ["palaeontological", "paleontological"],
        ["palaeozoic", "paleozoic"],
        ["palaeocene", "paleocene"],
        ["haematology", "hematology"],
        ["oesophagus", "esophagus"],
        ["foetus", "fetus"],
        ["foetal", "fetal"],
        ["mediaeval", "medieval"],
        ["encyclopaedia", "encyclopedia"],
        ["orthopaedic", "orthopedic"],
    ];

    /**
     * Proper-noun phrases that include a British spelling but are
     * preserved verbatim because they are the official name of an
     * institution, collection, or other entity. Matches are removed
     * from the field text before the British-spelling regexes run,
     * so the embedded British word does not trigger a warning.
     */
    const protectedProperNouns: Array<RegExp> = [
        /Royal Tyrrell Museum of Palaeontology/g,
        /Australian Opal Centre/g,
        /Palaeontological collection, Department of Mineral/g,
        /Nanjing Institute of Geology and Palaeontology/g,
    ];

    /**
     * The British words of `britishToAmerican`, keyed lowercase, with each one's
     * position in the table and its American replacement.
     */
    const americanSpellings = new Map(
        britishToAmerican.map(([british, american], index) => [british, { index, american }]));

    /**
     * Every British word of `britishToAmerican` as one whole-word alternation, so
     * a field is scanned once rather than once per word.
     */
    const britishSpellingPattern = new RegExp(`\\b(?:${britishToAmerican.map(([british]) => british).join("|")})\\b`, "gi");

    /**
     * Scans a single string field for British-English spellings and
     * emits one warning per distinct word found, in table order.
     *
     * @param filePath - Absolute path to the YAML file under inspection.
     * @param fieldPath - Dotted path describing the field's location.
     * @param text - The field's string value.
     */
    function checkAmericanEnglish(filePath: string, fieldPath: string, text: string): void
    {
        let scrubbed = stripQuotedSpans(text);

        for (const phrase of protectedProperNouns)
        {
            scrubbed = scrubbed.replace(phrase, "");
        }

        const found = new Map<string, { index: number; match: string; american: string }>();

        for (const [match] of scrubbed.matchAll(britishSpellingPattern))
        {
            const lowered = match.toLowerCase();
            const spelling = americanSpellings.get(lowered);

            if (spelling !== undefined && !found.has(lowered))
            {
                found.set(lowered, { index: spelling.index, match, american: spelling.american });
            }
        }

        for (const { match, american } of [...found.values()].sort((first, second) => first.index - second.index))
        {
            checkWarning(
                "American English",
                filePath,
                `${fieldPath}: "${match}" → use "${american}" (American English; project policy)`);
        }
    }

    for (const field of proseFields)
    {
        checkAmericanEnglish(field.filePath, field.fieldPath, field.text);
    }
}

/**
 * The "Citation format" check.
 *
 * Citation format (paleo-journal hybrid: "Smith (1999)" / "(Smith, 1999)" / "and" not "&")
 *
 * Catches the three most common deviations from project policy:
 *   - "Author & Author" between capitalized names (use "and")
 *   - "(Author Year)" no-comma single-citation parenthetical (use "(Author, Year)")
 *   - bare "Author Year" outside parentheses
 * Runs over the shared prose walk, minus quoted spans: the citation form
 * inside a verbatim quotation is the source's, not ours.
 *
 * @param context - The loaded data the checks read.
 */
export function checkCitationFormat(context: ValidationContext): void
{
    const {
        proseFields,
        stripQuotedSpans,
    } = context;

    const ampersandPattern = /\b[A-Z][a-z]+\s*&\s*[A-Z][\p{L}]+/gu;

    const noCommaCitationPattern = /\(([A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s+(?:and\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?|et al\.))?\s+\d{4}[a-z]?)\)/g;

    const bareYearPattern = /\b([A-Z][a-z]+(?:\s+(?:and|et al\.)\s+[A-Z][a-z]+)?) ([12]\d{3}[a-z]?)\b(?![)\d,;])/g;

    /**
     * Capitalized words that frequently precede a four-digit number
     * without being an author surname. Skipping them keeps the year-shaped
     * checks usefully signal-heavy: an ICZN Opinion number reads exactly
     * like an unpunctuated parenthetical citation, "(Opinion 2320)".
     */
    const yearHeadDenylist = new Set([
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
        "The", "In", "On", "By", "From", "Since", "After", "Before", "Until",
        "Opinion", "Case", "Article", "Recommendation",
        "Note", "Figure", "Table", "Plate", "Volume", "Page", "Section", "Chapter",
    ]);

    /**
     * Scans an editorial field for citation-format violations and emits
     * one warning per distinct issue found.
     *
     * @param filePath - Absolute path to the YAML file under inspection.
     * @param fieldPath - Dotted path describing the field's location.
     * @param text - The field's string value.
     */
    function checkCitationFormat(filePath: string, fieldPath: string, text: string): void
    {
        const scrubbed = stripQuotedSpans(text);
        const ampersandMatches = scrubbed.match(ampersandPattern);

        if (ampersandMatches !== null && ampersandMatches.length > 0)
        {
            const unique = [...new Set(ampersandMatches)];

            for (const match of unique)
            {
                checkWarning(
                    "Citation format",
                    filePath,
                    `${fieldPath}: "${match}" — use "and" between author names, not "&" (project policy)`);
            }
        }

        // Three or more authors are "and colleagues" in our prose; "et al." and
        // "and others (Year)" survive only inside a quotation of a source.
        for (const match of new Set(scrubbed.match(/\bet al\.|\band others(?=,? \(?\d{4})/g) ?? []))
        {
            checkWarning(
                "Citation format",
                filePath,
                `${fieldPath}: "${match}" — write "and colleagues" for three or more authors (project policy)`);
        }

        const reportedNoComma = new Set<string>();

        for (const match of scrubbed.matchAll(noCommaCitationPattern))
        {
            const head = match[1].split(/\s+/)[0];

            if (yearHeadDenylist.has(head))
            {
                continue;
            }

            const full = match[0];

            if (reportedNoComma.has(full))
            {
                continue;
            }

            reportedNoComma.add(full);
            checkWarning(
                "Citation format",
                filePath,
                `${fieldPath}: "${full}" — single-citation parenthetical needs a comma before the year (project policy)`);
        }

        const reportedBare = new Set<string>();

        for (const match of scrubbed.matchAll(bareYearPattern))
        {
            const head = match[1].split(/\s+/)[0];

            if (yearHeadDenylist.has(head))
            {
                continue;
            }

            const full = match[0];

            if (reportedBare.has(full))
            {
                continue;
            }

            reportedBare.add(full);
            checkWarning(
                "Citation format",
                filePath,
                `${fieldPath}: "${full}" — bare "Author Year" needs parens around the year (narrative: "Author (Year)") or a comma before it (ICZN authority: "Author, Year") (project policy)`);
        }
    }

    for (const field of proseFields)
    {
        checkCitationFormat(field.filePath, field.fieldPath, field.text);
    }
}

/**
 * The "Reference key in prose" check.
 *
 * Reference key in prose
 *
 * Reference keys are pointers. They belong in `id`, `erected_in`,
 * `described_in`, `notable_specimens[].references`, `iczn_cases.petition`,
 * `iczn_cases.ruling`, `iczn_cases.notices` and `former_ids[].source` — never in a sentence,
 * where the citation reads "Zhang (2018)" or "(Zhang, 2018)". Scoped to the
 * prose walk, so the ~2,150 keys sitting in pointer fields are never seen.
 *
 * Quoted spans are NOT exempt here, unlike the two style checks above: a
 * verbatim quotation of a source cannot contain one of our keys, so a key
 * inside quotes is a leak like any other.
 *
 * @param context - The loaded data the checks read.
 */
export function checkReferenceKeyInProse(context: ValidationContext): void
{
    const {
        proseFields,
    } = context;

    // Surname, year, disambiguating letter — the same shape check 12c enforces
    // on the store, tightened for use mid-sentence. Lowercase Unicode letters
    // rather than a-z, so surnames carrying Latin Extended-A diacritics are
    // caught (ősi2010a, maryańska1975a, niedźwiedzki2012a), and a two-letter
    // surname is allowed (an2015a, hu2018a). The boundaries are spelled out
    // rather than left to \b, which is ASCII-only even under the u flag and so
    // would report ősi2010a as "si2010a".
    const proseReferenceKeyPattern = /(?<![\p{L}\p{N}])\p{Ll}[\p{Ll}\p{M}.'’-]+\d{4}[a-z](?![\p{L}\p{N}])/gu;

    for (const field of proseFields)
    {
        const reported = new Set<string>();

        for (const match of field.text.match(proseReferenceKeyPattern) ?? [])
        {
            if (reported.has(match))
            {
                continue;
            }

            reported.add(match);
            checkError(
                "Reference key in prose",
                field.filePath,
                `${field.fieldPath}: "${match}" — reference keys are pointers, not prose; write the citation narratively ("Zhang (2018)") or parenthetically ("(Zhang, 2018)") (project policy)`);
        }
    }
}

/**
 * The "Unbalanced quotation" check.
 *
 * Unbalanced quotation — a quotation cut short. A quote mark left open, a
 * closing quote inside a word, or a parenthesis opened inside a quotation and
 * never closed there are each the sign of a passage copied to the end of what
 * a search printed rather than to the end of the source's sentence.
 *
 * @param context - The loaded data the checks read.
 */
export function checkUnbalancedQuotation(context: ValidationContext): void
{
    const {
        cladeFiles,
        genusFiles,
        parsedDocuments,
        referenceStoreFiles,
        root,
    } = context;

    // "either 1) ... or 2)" and "a) ... b)" enumerate; their closing parenthesis
    // has no opening one.
    const enumeratorParenthesis = /(^|[\s(])(?:\d{1,2}|[a-z])\)/g;

    /**
     * Counts the parentheses in a string that do not pair. Surplus closing
     * parentheses are forgiven up to the number of enumerators such as "1)",
     * since "(OBA 1)" closes an ordinary parenthesis while "either 1) ... or 2)"
     * opens none.
     *
     * @param text - The text to check.
     * @returns The number of opening parentheses minus the number of closing ones,
     *     after forgiving enumerators.
     */
    function parenthesisBalance(text: string): number
    {
        const balance = (text.match(/\(/g) ?? []).length - (text.match(/\)/g) ?? []).length;

        if (balance >= 0)
        {
            return balance;
        }

        const enumerators = (text.match(enumeratorParenthesis) ?? []).length;

        return Math.min(0, balance + enumerators);
    }

    /**
     * Collects every string in a parsed YAML value, with the path of keys and
     * list ids that leads to it.
     *
     * @param node - The parsed value.
     * @param trail - The path so far.
     * @param found - Receives each string with its path.
     */
    function collectStrings(node: unknown, trail: string, found: Array<{ trail: string; text: string }>): void
    {
        walkStrings(node, (text, _, stringTrail) =>
        {
            found.push({ trail: stringTrail, text: text.replace(/\s+/g, " ") });
        }, { listLabel: (item, index) => (item && typeof item === "object" && "id" in item ? String((item as { id: unknown }).id) : String(index)) }, trail);
    }

    const quotationFiles = [
        ...genusFiles,
        ...cladeFiles,
        ...findYamlFiles(path.join(root, "stratigraphy")),
        ...referenceStoreFiles,
    ];

    for (const filePath of quotationFiles)
    {
        if (!parsedDocuments.has(filePath))
        {
            continue;
        }

        const parsed = parsedDocuments.get(filePath);
        const strings = new Array<{ trail: string; text: string }>();

        collectStrings(parsed, "", strings);

        for (const { trail, text } of strings)
        {
            const quoteMarks = (text.match(/"/g) ?? []).length;
            const midWord = /[A-Za-z]"[A-Za-z]/.exec(text);

            if (quoteMarks % 2 !== 0)
            {
                checkError("Unbalanced quotation", filePath, `${trail}: a quotation is opened and never closed`);
            }
            else if (midWord !== null)
            {
                checkError(
                    "Unbalanced quotation",
                    filePath,
                    `${trail}: a quote mark sits inside a word ('${text.slice(Math.max(0, midWord.index - 30), midWord.index + 10)}'); a quotation was probably cut short`);
            }
            else
            {
                for (const quotation of text.match(/"[^"]*"/g) ?? [])
                {
                    if (parenthesisBalance(quotation) !== 0)
                    {
                        checkError(
                            "Unbalanced quotation",
                            filePath,
                            `${trail}: parentheses do not pair inside the quotation ${quotation.slice(0, 80)}${quotation.length > 80 ? "…" : ""}`);
                    }
                }
            }

            if (parenthesisBalance(text) !== 0)
            {
                checkError("Unbalanced quotation", filePath, `${trail}: parentheses do not pair`);
            }
        }
    }
}

/**
 * Runs the "Curly quotes" check.
 *
 * @param context - The loaded data the checks read.
 */
export function checkCurlyQuotes(context: ValidationContext): void
{
    const {
        cladeFiles,
        genusFiles,
        readDataFile,
        referenceStoreFiles,
        root,
        stratigraphyFiles,
    } = context;

    // The quotation checks above, and the British-spelling and citation checks
    // that skip quoted spans, read straight double quotes only. A record that
    // quotes with “” would have its quotation checked as prose and could leave
    // a quote unclosed unseen, so record prose uses straight quotes.
    const curlyQuoteCheckedFiles = [
        ...genusFiles,
        ...cladeFiles,
        ...referenceStoreFiles,
        ...stratigraphyFiles.values(),
        path.join(root, "institutions.yaml"),
        path.join(root, "excluded.yml"),
    ];

    for (const filePath of curlyQuoteCheckedFiles)
    {
        let lines: Array<string>;

        try
        {
            lines = readDataFile(filePath).split("\n");
        }
        catch
        {
            continue;
        }

        for (const [index, line] of lines.entries())
        {
            if (/[“”]/.test(line))
            {
                checkError(
                    "Curly quotes",
                    filePath,
                    `line ${index + 1}: curly double quotes; use straight quotes (")`);
            }
        }
    }
}

/**
 * Runs the "Comment-eaten scalars" check.
 *
 * @param context - The loaded data the checks read.
 */
export function checkCommentEatenScalars(context: ValidationContext): void
{
    const {
        cladeFiles,
        genusFiles,
        readDataFile,
        referenceStoreFiles,
        root,
        stratigraphyFiles,
    } = context;

    // No data file carries an intentional inline comment, so every comment token
    // that follows other content on its line is the tail of a value YAML cut off.
    // The lexer sees this for every scalar kind: a `key: value` line, a list item,
    // and the last continuation line of a multi-line plain scalar.
    const commentCheckedFiles = [
        ...genusFiles,
        ...cladeFiles,
        ...referenceStoreFiles,
        ...stratigraphyFiles.values(),
        path.join(root, "institutions.yaml"),
    ];

    for (const filePath of commentCheckedFiles)
    {
        let text: string;

        try
        {
            text = readDataFile(filePath);
        }
        catch
        {
            continue;
        }

        let line = 1;
        let lineHasContent = false;

        for (const token of new Lexer().lex(text))
        {
            const tokenType = CST.tokenType(token);

            if (tokenType === "newline")
            {
                line += 1;
                lineHasContent = false;
                continue;
            }
            else if (tokenType === "comment" && lineHasContent)
            {
                checkError(
                    "Comment-eaten scalars",
                    filePath,
                    `line ${line}: YAML reads "${token}" as a comment, so the value before it loses that text. Quote the value.`);
            }
            else if (tokenType !== "space" && tokenType !== "comment" && tokenType !== "byte-order-mark" && tokenType !== "doc-mode")
            {
                lineHasContent = true;
            }

            line += token.split("\n").length - 1;
        }
    }
}
