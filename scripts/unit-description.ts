/**
 * The facts a stratigraphic unit's generated description is written from,
 * all drawn from the dataset itself.
 */
export type UnitFacts = {
    /**
     * The unit's registry name.
     */
    name: string;

    /**
     * The unit's rank, if the registry gives one.
     */
    rank?: string;

    /**
     * True for a unit that was never formally erected.
     */
    informal?: boolean;

    /**
     * The containing unit, with its rank.
     */
    parent?: { name: string; rank?: string };

    /**
     * The unit's stages, oldest first.
     */
    stages: Array<string>;

    /**
     * The unit's epochs, oldest first.
     */
    periods: Array<string>;

    /**
     * Where species records place the unit or its subdivisions: each
     * country with its regions, most records first.
     */
    places: Array<{ country: string; regions: Array<string> }>;

    /**
     * The units the registry places directly inside this one.
     */
    members: Array<{ name: string; rank?: string }>;

    /**
     * Genera recorded from the unit or its subdivisions, with how many of
     * their species are and how many notable specimens the genus has.
     */
    genera: Array<{ name: string; species: number; notable: number }>;

    /**
     * Other names the literature gives the unit.
     */
    variants: Array<string>;
};

/**
 * Words that end a unit name when the name already says what the rock is,
 * so the rank word is not added after it ("Navajo Sandstone", not "Navajo
 * Sandstone Formation").
 */
const nameEndings = [
    "Formation", "Member", "Group", "Subgroup", "Supergroup", "Bed", "Beds", "Bonebed",
    "Sandstone", "Sandstones", "Mudstone", "Siltstone", "Claystone", "Shale", "Shales", "Limestone",
    "Clay", "Clays", "Marl", "Marls", "Chalk", "Conglomerate", "Sand", "Sands", "Oolite", "Greensand",
    "Grit", "Grits", "Ironstone", "Coal", "Tuff", "Breccia",
];

/**
 * Puts "the" before a unit name, except a bed named by a code ("Bed 83") or
 * a name ending in a numeral ("Bonebed I"), which prose writes bare.
 *
 * @param unitName - The unit's name as prose writes it.
 * @returns The name with or without "the".
 */
function referToUnit(unitName: string): string
{
    return /^Bed |\s(?:[IVX]+|\d+)$/.test(unitName) ? unitName : `the ${unitName}`;
}

/**
 * Joins items as English prose: "A", "A and B", "A, B and C".
 *
 * @param items - The items to join.
 * @param conjunction - The word before the last item.
 * @returns The joined text.
 */
function joinWords(items: Array<string>, conjunction = "and"): string
{
    if (items.length <= 1)
    {
        return items[0] ?? "";
    }

    return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

/**
 * Writes a unit's name as prose refers to it: the registry name with its
 * rank word, unless the name already ends in one or in a rock name. A bed
 * named only by a code ("83", "L11") is written "Bed 83".
 *
 * @param name - The registry name.
 * @param rank - The unit's rank, if any.
 * @returns The name as prose writes it.
 */
export function formatUnitName(name: string, rank?: string): string
{
    const words = name.split(/\s+/);

    if (rank === "bed" && /^[A-Z]{0,4}\s?\d/.test(name))
    {
        return `Bed ${name}`;
    }
    else if (!rank || words.some((word) => nameEndings.includes(word)))
    {
        return name;
    }

    return `${name} ${rank.charAt(0).toUpperCase()}${rank.slice(1)}`;
}

/**
 * Country names as prose uses them after "in": the short form where the
 * registry name is formal, and "the" where English requires it.
 */
const countryProse: Record<string, string> = {
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
function formatPlace(place: string): string
{
    const name = countryProse[place] ?? place;

    return /^(United |Czech Republic|Netherlands|Philippines|Isle of |Democratic |Central African|Dominican|Gambia)/.test(name) ? `the ${name}` : name;
}

/**
 * Describes where a unit occurs: the regions of a single country, or the
 * countries themselves when there are several.
 *
 * @param places - The unit's places, most records first.
 * @returns A phrase such as "in Montana and Wyoming, United States", or an
 * empty string when no record places the unit.
 */
function describePlace(places: UnitFacts["places"]): string
{
    if (places.length === 0)
    {
        return "";
    }
    else if (places.length === 1)
    {
        const [ only ] = places;
        const regions = only.regions.slice(0, 3);

        return regions.length > 0 && only.regions.length <= 3
            ? ` in ${joinWords(regions.map(formatPlace))}, ${countryProse[only.country] ?? only.country}`
            : ` in ${formatPlace(only.country)}`;
    }
    else if (places.length <= 4)
    {
        return ` in ${joinWords(places.map((place) => formatPlace(place.country)))}`;
    }

    return ` in ${places.slice(0, 3).map((place) => formatPlace(place.country)).join(", ")} and ${places.length - 3} other countries`;
}

/**
 * Describes a unit's age from its stages, or from its epochs when it has
 * none.
 *
 * @param stages - The stages, oldest first.
 * @param periods - The epochs, oldest first.
 * @returns A phrase such as "dated to the Aptian to Albian stages of the
 * Early Cretaceous", or an empty string when the unit has no age.
 */
function describeAge(stages: Array<string>, periods: Array<string>): string
{
    const epochs = joinWords(periods.map((period) => `the ${period}`));

    if (stages.length === 1)
    {
        return `, dated to the ${stages[0]} stage of ${epochs}`;
    }
    else if (stages.length > 1)
    {
        return `, dated to the ${stages[0]} to ${stages[stages.length - 1]} stages of ${epochs}`;
    }
    else if (periods.length > 0)
    {
        return `, dated to ${epochs}`;
    }

    return "";
}

/**
 * Writes a stratigraphic unit's description from its facts: what and where
 * it is and its age, then any other names, the units within it, and the
 * dinosaurs recorded from it. Every clause restates a fact the record
 * holds, so the description changes whenever the record does.
 *
 * @param facts - The unit's facts.
 * @returns The description.
 */
export function composeUnitDescription(facts: UnitFacts): string
{
    const unitName = formatUnitName(facts.name, facts.rank);
    const kind = facts.rank ?? "stratigraphic unit";
    const article = facts.informal ? "an informal" : /^[aeiou]/.test(kind) ? "an" : "a";
    const parent = facts.parent ? ` of the ${formatUnitName(facts.parent.name, facts.parent.rank)}` : "";
    const lead = referToUnit(unitName).replace(/^the /, "The ");
    const verb = /(Beds|Sands|Marls|Clays|Grits|Shales|Sandstones)$/.test(unitName) ? "are" : "is";
    const sentences = [ `${lead} ${verb} ${article} ${kind}${parent}${describePlace(facts.places)}${describeAge(facts.stages, facts.periods)}.` ];

    if (facts.variants.length > 0)
    {
        sentences.push(`It is also known as the ${joinWords(facts.variants, "or")}.`);
    }

    if (facts.members.length > 0)
    {
        const listed = facts.members.slice(0, 5).map((member) => referToUnit(formatUnitName(member.name, member.rank)));
        const rest = facts.members.length - listed.length;

        sentences.push(`It includes ${joinWords(rest > 0 ? [ ...listed, `${rest} other units` ] : listed)}.`);
    }

    const genera = [ ...facts.genera ]
        .sort((first, second) => second.notable - first.notable || second.species - first.species || first.name.localeCompare(second.name))
        .map((genus) => genus.name);

    if (genera.length === 1)
    {
        sentences.push(`The dinosaur ${genera[0]} is known from it.`);
    }
    else if (genera.length > 1 && genera.length <= 4)
    {
        sentences.push(`Dinosaurs known from it include ${joinWords(genera)}.`);
    }
    else if (genera.length > 4)
    {
        sentences.push(`Dinosaurs known from it include ${genera.slice(0, 4).join(", ")} and ${genera.length - 4} other genera.`);
    }

    return sentences.join(" ");
}
