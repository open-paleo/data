import { countryProse, describeTimeSpan, formatAuthors, formCladeAdjective, formatLength, formatPlace, joinWords, majorGroups } from "./description-text.ts";
import { formatUnitName } from "./unit-description.ts";

/**
 * The facts a genus's generated summary is written from, all drawn from the
 * genus record.
 */
export type GenusFacts = {
    /**
     * The genus name.
     */
    name: string;

    /**
     * The genus's parent clade.
     */
    parent: string;

    /**
     * "incertae sedis" when the genus's position within its parent is
     * unresolved.
     */
    placement?: string;

    /**
     * Ancestor clades from the root to the parent.
     */
    taxonomy: Array<string>;

    /**
     * The etymology field's text.
     */
    etymology?: string;

    /**
     * Authors of the genus name, as the reference store gives them.
     */
    authors?: string;

    /**
     * Year the genus was named.
     */
    described?: number;

    /**
     * The genus's diet.
     */
    diet?: string;

    /**
     * The genus's locomotion.
     */
    locomotion?: string;

    /**
     * The genus's species.
     */
    species: Array<{
        name: string;
        status?: string;
        typeSpecies?: boolean;
        stages: Array<string>;
        periods: Array<string>;
        country?: string;
        unit?: { name: string; rank?: string };
        length?: { min?: number; max?: number };
    }>;

    /**
     * Nicknames of the genus's notable specimens.
     */
    nicknames: Array<string>;

    /**
     * The type species' type specimen: its material and its earlier catalog
     * numbers.
     */
    typeSpecimen?: {
        material?: string;
        formerIds: Array<{ fromId: string; fromInstitution?: string; reason: string }>;
    };

    /**
     * The type species' binomial as first published, when it was named in
     * another genus.
     */
    erectedAs?: string;

    /**
     * The work that redescribed the type species, when it is not the one
     * that named it: its authors as the reference store gives them, and its
     * year.
     */
    redescribed?: { authors: string; year: number };

    /**
     * Species first named in this genus that now belong to other genera:
     * each one's original binomial and its current name.
     */
    movedSpecies: Array<{ original: string; current: string }>;

    /**
     * Objective junior synonyms: other names given to the same type.
     */
    objectiveSynonyms: Array<string>;

    /**
     * The genus's ICZN cases, with the Opinion's year and number where one
     * was published.
     */
    icznCases: Array<{ type: string; status: string; year?: number; opinion?: string }>;

    /**
     * True when the genus carries a live dispute.
     */
    disputed: boolean;

    /**
     * The stage table's order, oldest first, used to order a span of
     * stages across species.
     */
    stageOrder: Array<string>;

    /**
     * The epochs in order, oldest first.
     */
    periodOrder: Array<string>;
};

/**
 * Takes the whole name's meaning out of an etymology: the last quoted phrase
 * introduced by "meaning", "hence" or "translates as". Etymologies gloss each
 * root the same way ("'odous' meaning 'tooth'"), so a single-word phrase is
 * taken for a root's gloss and not used.
 *
 * @param etymology - The etymology field's text.
 * @returns The meaning, or undefined when the etymology states none.
 */
function extractMeaning(etymology?: string): string | undefined
{
    const phrases = [ ...(etymology ?? "").matchAll(/(?:meaning|hence|translat(?:es|ing|ed) as|literally)\s+["'“‘]([^"'”’]+)["'”’]/g) ];
    const last = phrases[phrases.length - 1]?.[1];

    return last && /\s/.test(last.trim()) ? last.trim() : undefined;
}

/**
 * Names the units a genus is known from, sharing a rank word where they
 * share one: "the Morrison and Lourinhã formations".
 *
 * @param units - The units, each with its rank.
 * @returns The phrase.
 */
function describeUnits(units: Array<{ name: string; rank?: string }>): string
{
    const shown = units.slice(0, 3).map((unit) => formatUnitName(unit.name, unit.rank));
    const rest = units.length > 3 ? ` and ${units.length - 3} other units` : "";
    const rankWord = units[0].rank ? `${units[0].rank.charAt(0).toUpperCase()}${units[0].rank.slice(1)}` : undefined;

    if (shown.length > 1 && !rest && rankWord && shown.every((name) => name.endsWith(` ${rankWord}`)))
    {
        return `the ${joinWords(shown.map((name) => name.slice(0, -rankWord.length - 1)))} ${rankWord.toLowerCase()}s`;
    }

    return `the ${joinWords(shown)}${rest}`;
}

/**
 * Writes a type specimen's material as the object of "described from": the
 * material text without parentheticals, its first letter lowered, and an
 * article added when it begins with a singular noun phrase ("a partial
 * skull", but "three dorsal vertebrae", "teeth"). Material written as a long
 * technical inventory is left to the record rather than the summary.
 *
 * @param material - The material text.
 * @returns The material as prose writes it after "described from", or
 * undefined when it is too long to read well in a summary.
 */
function describeMaterial(material: string): string | undefined
{
    const text = material.replace(/\s*\([^)]*\)/g, "").trim().replace(/[.;,]$/, "");

    if (text.length > maximumMaterialLength || /;/.test(text))
    {
        return undefined;
    }

    const lowered = /^[A-Z][a-z]/.test(text) ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
    const firstWord = lowered.split(/[\s,]/)[0];
    const takesNoArticle = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|multiple|various|numerous|many|some|both|all|parts|most|much|the|a|an|isolated|associated|fragments|remains|elements|bones|teeth|vertebrae|\d.*)$/.test(firstWord)
        || /(?<![uis])s$|ae$/.test(firstWord);

    const headPhrase = lowered.split(/,|:| with | of | including | from | and /)[0];

    if (/^part of/.test(lowered) || takesNoArticle || /\b(bones|teeth|vertebrae|elements|remains)\b/.test(headPhrase))
    {
        return lowered;
    }
    else if (/^(\w+ )?(half|end|part|portion|section) of /.test(lowered))
    {
        return `the ${lowered}`;
    }

    return `${/^[aeiou]/.test(lowered) ? "an" : "a"} ${lowered}`;
}

/**
 * The most species moved to other genera the summary names before counting
 * the rest.
 */
const maximumMovedSpecies = 4;

/**
 * The longest material text, in characters, the summary quotes.
 */
const maximumMaterialLength = 140;

/**
 * Says what an ICZN Opinion of a given case type did for a genus.
 *
 * @param caseType - The case type (`type-species`, `name-conservation`...).
 * @param genus - The genus name.
 * @param typeSpecies - The type species' binomial.
 * @returns A predicate such as "fixed Stegosaurus stenops as its type
 * species", or undefined for an unknown case type.
 */
function describeIcznAction(caseType: string, genus: string, typeSpecies: string): string | undefined
{
    switch (caseType)
    {
        case "type-species":
            return `ruled that ${typeSpecies} is its type species`;
        case "type-specimen":
            return "designated a new type specimen for it";
        case "name-conservation":
            return `conserved the name ${genus}`;
        case "name-suppression":
            return `suppressed a name competing with ${genus}`;
        case "priority-reversal":
            return `gave ${genus} precedence over an older name`;
        case "spelling-emendation":
            return "ruled on the spelling of its name";
        default:
            return undefined;
    }
}

/**
 * Writes a genus's summary from its facts: what it is and who named it,
 * when and where it lived, its species, its size and way of life, its
 * best-known specimens, and whether its classification is disputed. Every
 * clause restates a fact the record holds.
 *
 * @param facts - The genus's facts.
 * @returns The summary.
 */
export function composeGenusSummary(facts: GenusFacts): string
{
    const group = majorGroups.find(([clade]) => facts.taxonomy.includes(clade) || facts.parent === clade);
    const parentAdjective = formCladeAdjective(facts.parent);
    const kind = group && group[0] !== facts.parent && parentAdjective !== group[1]
        ? (parentAdjective.endsWith(group[1]) ? parentAdjective : `${parentAdjective} ${group[1]}`)
        : group?.[1] ?? parentAdjective;
    const typeSpecies = facts.species.find((species) => species.typeSpecies) ?? facts.species[0];
    const meaning = extractMeaning(facts.etymology);
    const uncertain = facts.placement === "incertae sedis" ? ` of uncertain placement${group?.[0] === facts.parent ? "" : ` within ${facts.parent}`}` : "";
    const dubious = typeSpecies?.status === "nomen dubium" ? ", now considered a nomen dubium," : "";
    const namedBy = facts.authors && facts.described ? ` named by ${formatAuthors(facts.authors)} in ${facts.described}` : "";
    const sentences = [ `${facts.name}${meaning ? ` (meaning "${meaning}")` : ""} is a genus of ${kind} dinosaur${uncertain}${dubious}${namedBy}.` ];

    const stages = facts.stageOrder.filter((stage) => facts.species.some((species) => species.stages.includes(stage)));
    const periods = facts.periodOrder.filter((period) => facts.species.some((species) => species.periods.includes(period)));
    const countries = [ ...new Set(facts.species.map((species) => species.country).filter((country): country is string => Boolean(country))) ];
    const units = [ ...new Map(facts.species.filter((species) => species.unit).map((species) => [species.unit!.name, species.unit!])).values() ];
    const when = stages.length + periods.length > 0
        ? ` during ${describeTimeSpan(stages.length > 0 ? [ stages[0], stages[stages.length - 1] ].filter((stage, index, all) => all.indexOf(stage) === index) : [ ], periods)}`
        : "";
    const where = countries.length > 0 ? ` in what is now ${joinWords(countries.map((country) => formatPlace(countryProse[country] ?? country)))}` : "";
    const rocks = units.length > 0 ? `, in ${describeUnits(units)}` : "";

    if (when || where)
    {
        sentences.push(`It lived${when}${where}${rocks}.`);
    }

    const firstNamed = facts.erectedAs ? `, first named ${facts.erectedAs}` : "";

    if (facts.species.length === 1 && typeSpecies)
    {
        sentences.push(`Its only species is ${typeSpecies.name}${firstNamed}.`);
    }
    else if (facts.species.length > 1 && typeSpecies)
    {
        sentences.push(`It contains ${facts.species.length} species, of which ${typeSpecies.name} is the type species${firstNamed}.`);
    }

    const specimen = facts.typeSpecimen;

    const material = specimen?.material ? describeMaterial(specimen.material) : undefined;

    if (material)
    {
        sentences.push(`It was described from ${material}.`);
    }

    if (facts.redescribed)
    {
        sentences.push(`${formatAuthors(facts.redescribed.authors)} redescribed it in ${facts.redescribed.year}.`);
    }

    if (specimen && specimen.formerIds.length > 0)
    {
        const earlier = specimen.formerIds.map((former) => (former.reason === "rehoused" && former.fromInstitution ? `${former.fromId} at the ${former.fromInstitution}` : former.fromId));

        sentences.push(`The type specimen was formerly cataloged as ${joinWords(earlier)}.`);
    }

    if (facts.objectiveSynonyms.length === 1)
    {
        sentences.push(`The name ${facts.objectiveSynonyms[0]} was based on the same type and is a junior synonym of ${facts.name}.`);
    }
    else if (facts.objectiveSynonyms.length > 1)
    {
        sentences.push(`The names ${joinWords(facts.objectiveSynonyms)} were based on the same type and are junior synonyms of ${facts.name}.`);
    }

    if (facts.movedSpecies.length === 1)
    {
        const [ moved ] = facts.movedSpecies;

        sentences.push(`${moved.original}, first named in ${facts.name}, is now ${moved.current}.`);
    }
    else if (facts.movedSpecies.length > 1)
    {
        const names = facts.movedSpecies.map((moved) => moved.current);
        const listed = names.length > maximumMovedSpecies
            ? [ ...names.slice(0, maximumMovedSpecies - 1), `${names.length - maximumMovedSpecies + 1} others` ]
            : names;

        sentences.push(`Species first named in ${facts.name} that now belong to other genera include ${joinWords(listed)}.`);
    }

    for (const icznCase of facts.icznCases)
    {
        const action = describeIcznAction(icznCase.type, facts.name, typeSpecies?.name ?? facts.name);

        if (action && icznCase.status === "opinion" && icznCase.year)
        {
            sentences.push(`In ${icznCase.year} the ICZN ${action}${icznCase.opinion ? ` (Opinion ${icznCase.opinion})` : ""}.`);
        }
        else if (action && icznCase.status === "open")
        {
            sentences.push(`A case on ${icznCase.type === "type-species" ? "its type species" : icznCase.type === "type-specimen" ? "its type specimen" : "its name"} is open before the ICZN.`);
        }
    }

    const length = formatLength(typeSpecies?.length);
    const gait = facts.locomotion === "facultative" ? "facultatively bipedal" : facts.locomotion;
    const life = facts.diet ? `${gait ? `${/^[aeiou]/.test(gait) ? "an" : "a"} ${gait} ` : /^[aeiou]/.test(facts.diet) ? "an " : "a "}${facts.diet}` : undefined;

    if (life && length)
    {
        sentences.push(`${facts.name} was ${life} estimated at ${length} long.`);
    }
    else if (life)
    {
        sentences.push(`${facts.name} was ${life}.`);
    }
    else if (length)
    {
        sentences.push(`${facts.name} is estimated at ${length} long.`);
    }

    if (facts.nicknames.length > 0)
    {
        const names = facts.nicknames.slice(0, 3).map((nickname) => (/(specimen|skull|skeleton)$/i.test(nickname) ? `the ${nickname}` : `"${nickname}"`));

        sentences.push(names.length === 1 ? `A well-known specimen is nicknamed ${names[0]}.` : `Well-known specimens include ${joinWords(names)}.`);
    }

    if (facts.disputed)
    {
        sentences.push("Aspects of its classification are disputed.");
    }

    return sentences.join(" ");
}
