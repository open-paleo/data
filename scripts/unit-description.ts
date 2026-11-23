import { countryProse, describeTimeSpan, formatPlace, joinWords } from "./description-text.ts";

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

    /**
     * What the unit is made of, if the record says.
     */
    lithology?: string;
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
    const sentences = [ `${lead} ${verb} ${article} ${kind}${parent}${describePlace(facts.places)}${(facts.stages.length + facts.periods.length > 0 ? `, dated to ${describeTimeSpan(facts.stages, facts.periods)}` : "")}.` ];

    if (facts.lithology)
    {
        sentences.push(`${verb === "are" ? "They consist" : "It consists"} mainly of ${facts.lithology.replace(/\.$/, "")}.`);
    }

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
