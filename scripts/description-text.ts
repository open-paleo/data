// Prose helpers shared by the generated descriptions of stratigraphic units
// and genera.

/**
 * Joins items as English prose: "A", "A and B", "A, B and C".
 *
 * @param items - The items to join.
 * @param conjunction - The word before the last item.
 * @returns The joined text.
 */
export function joinWords(items: Array<string>, conjunction = "and"): string
{
    if (items.length <= 1)
    {
        return items[0] ?? "";
    }

    return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

/**
 * Country names as prose uses them after "in": the short form where the
 * registry name is formal, and "the" where English requires it.
 */
export const countryProse: Record<string, string> = {
    "People's Republic of China": "China",
    "Republic of Korea": "South Korea",
    "Russian Federation": "Russia",
};

/**
 * Writes a place name as it reads after "in", adding "the" where English
 * requires it ("the United States", "the Isle of Wight").
 *
 * @param place - A country or region name.
 * @returns The name as prose writes it.
 */
export function formatPlace(place: string): string
{
    const name = countryProse[place] ?? place;

    return /^(United |Czech Republic|Netherlands|Philippines|Isle of |Democratic |Central African|Dominican|Gambia)/.test(name) ? `the ${name}` : name;
}

/**
 * Names a span of geological time from its stages, or from its epochs when
 * there are none.
 *
 * @param stages - The stages, oldest first.
 * @param periods - The epochs, oldest first.
 * @returns A phrase such as "the Aptian to Albian stages of the Early
 * Cretaceous", or an empty string when there is neither.
 */
export function describeTimeSpan(stages: Array<string>, periods: Array<string>): string
{
    const epochs = joinWords(periods.map((period) => `the ${period}`));

    if (stages.length === 1)
    {
        return `the ${stages[0]} stage of ${epochs}`;
    }
    else if (stages.length > 1)
    {
        return `the ${stages[0]} to ${stages[stages.length - 1]} stages of ${epochs}`;
    }

    return epochs;
}

/**
 * Well-known dinosaur groups, most specific first; a summary names the first
 * one in the genus's ancestry.
 */
export const majorGroups: Array<[string, string]> = [
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
    [/ves$/, "vian"], [/idae$/, "id"], [/inae$/, "ine"], [/ini$/, "in"], [/oidea$/, "oid"], [/iformes$/, "iform"],
    [/morpha$/, "morph"], [/poda$/, "pod"], [/ia$/, "ian"], [/ae$/, "an"], [/a$/, "an"], [/i$/, "an"],
];

/**
 * Forms the adjective prose uses for a clade: "Plateosauridae" ->
 * "plateosaurid".
 *
 * @param clade - The clade name.
 * @returns The adjective, or the lowercased name when no ending applies.
 */
export function formCladeAdjective(clade: string): string
{
    const ending = adjectiveEndings.find(([pattern]) => pattern.test(clade));

    return (ending ? clade.replace(ending[0], ending[1]) : clade).toLowerCase();
}

/**
 * Names a work's authors as prose cites them: "Osborn", "Galton and
 * Jensen", "Xu and colleagues".
 *
 * @param authors - The authors as the reference store gives them.
 * @returns The surnames as prose writes them.
 */
export function formatAuthors(authors: string): string
{
    const surnames = authors.split(";").map((author) => author.split(",")[0].trim()).filter(Boolean);

    return surnames.length > 2 ? `${surnames[0]} and colleagues` : joinWords(surnames);
}

/**
 * Writes a length range in meters: "about 9 meters", "4.8 to 10 meters".
 *
 * @param length - The minimum and maximum, in meters.
 * @returns The phrase, or undefined when there is no length.
 */
export function formatLength(length?: { min?: number; max?: number }): string | undefined
{
    const low = length?.min ?? length?.max;
    const high = length?.max ?? length?.min;

    if (low === undefined || high === undefined)
    {
        return undefined;
    }

    return low === high ? `about ${low} meter${low === 1 ? "" : "s"}` : `${low} to ${high} meters`;
}
