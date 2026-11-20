import { countryProse, describeTimeSpan, formatPlace, joinWords } from "./description-text.ts";
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
 * Well-known dinosaur groups, most specific first; a summary names the first
 * one in the genus's ancestry.
 */
const majorGroups: Array<[string, string]> = [
    ["Sauropoda", "sauropod"], ["Ornithopoda", "ornithopod"], ["Ceratopsia", "ceratopsian"],
    ["Ankylosauria", "ankylosaur"], ["Stegosauria", "stegosaur"], ["Pachycephalosauria", "pachycephalosaur"],
    ["Avialae", "avialan"], ["Theropoda", "theropod"], ["Sauropodomorpha", "sauropodomorph"],
    ["Thyreophora", "thyreophoran"], ["Ornithischia", "ornithischian"], ["Saurischia", "saurischian"],
];

/**
 * Endings of clade names and the adjective each forms
 * ("Tyrannosaurinae" -> "tyrannosaurine").
 */
const adjectiveEndings: Array<[RegExp, string]> = [
    [/idae$/, "id"], [/inae$/, "ine"], [/ini$/, "in"], [/oidea$/, "oid"], [/iformes$/, "iform"],
    [/morpha$/, "morph"], [/poda$/, "pod"], [/ia$/, "ian"], [/ae$/, "an"], [/a$/, "an"],
];

/**
 * Forms the adjective prose uses for a clade: "Plateosauridae" ->
 * "plateosaurid".
 *
 * @param clade - The clade name.
 * @returns The adjective, or the lowercased name when no ending applies.
 */
function formCladeAdjective(clade: string): string
{
    const ending = adjectiveEndings.find(([pattern]) => pattern.test(clade));

    return (ending ? clade.replace(ending[0], ending[1]) : clade).toLowerCase();
}

/**
 * Names the genus's authors as prose cites them: "Osborn", "Galton and
 * Jensen", "Xu and colleagues".
 *
 * @param authors - The authors as the reference store gives them.
 * @returns The surnames as prose writes them.
 */
function formatAuthors(authors: string): string
{
    const surnames = authors.split(";").map((author) => author.split(",")[0].trim()).filter(Boolean);

    return surnames.length > 2 ? `${surnames[0]} and colleagues` : joinWords(surnames);
}

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
 * Writes a length range in meters: "about 9 meters", "4.8 to 10 meters".
 *
 * @param length - The minimum and maximum, in meters.
 * @returns The phrase, or undefined when there is no length.
 */
function formatLength(length?: { min?: number; max?: number }): string | undefined
{
    const low = length?.min ?? length?.max;
    const high = length?.max ?? length?.min;

    if (low === undefined || high === undefined)
    {
        return undefined;
    }

    return low === high ? `about ${low} meter${low === 1 ? "" : "s"}` : `${low} to ${high} meters`;
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
        ? `${parentAdjective} ${group[1]}`
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

    if (facts.species.length === 1 && typeSpecies)
    {
        sentences.push(`Its only species is ${typeSpecies.name}.`);
    }
    else if (facts.species.length > 1 && typeSpecies)
    {
        sentences.push(`It contains ${facts.species.length} species, of which ${typeSpecies.name} is the type species.`);
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
