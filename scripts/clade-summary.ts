import { countryProse, describeTimeSpan, formatAuthors, formCladeAdjective, formatLength, formatPlace, joinWords, majorGroups } from "./description-text.ts";

/**
 * The facts a clade's generated summary is written from, all drawn from the
 * dataset itself.
 */
export type CladeFacts = {
    /**
     * The clade name.
     */
    name: string;

    /**
     * The clade's rank: superfamily, family, subfamily, tribe or unranked.
     */
    rank: string;

    /**
     * The clade's ancestry, root first, ending with its parent.
     */
    taxonomy: Array<string>;

    /**
     * The authors of the work that named the clade, as the reference store
     * gives them.
     */
    authors?: string;

    /**
     * The year the clade was named.
     */
    described?: number;

    /**
     * The clade's type genus, if it has one.
     */
    typeGenus?: string;

    /**
     * The work that gave the clade's current definition or diagnosis, when
     * it is not the one that named it.
     */
    revised?: { authors: string; year: number };

    /**
     * The clades directly inside this one, with their ranks.
     */
    subgroups: Array<{ name: string; rank: string }>;

    /**
     * The genera in the clade, at any depth.
     */
    genera: Array<{
        name: string;
        notable: number;
        species: number;
        stages: Array<string>;
        periods: Array<string>;
        countries: Array<string>;
        diet?: string;
        locomotion?: string;
        length?: { min?: number; max?: number };
    }>;

    /**
     * True when the clade includes birds, or is itself within Avialae. The
     * dataset records only the earliest birds, so their ages, sizes and
     * genus counts would misstate the clade.
     */
    includesBirds: boolean;

    /**
     * The epoch each stage belongs to.
     */
    stageEpochs: Record<string, string>;

    /**
     * True when the clade's record carries a dispute.
     */
    disputed: boolean;

    /**
     * Every stage name, oldest first.
     */
    stageOrder: Array<string>;

    /**
     * Every epoch name, oldest first.
     */
    periodOrder: Array<string>;
};

/**
 * Each rank's plural, for naming several subgroups of one rank.
 */
const rankPlurals: Record<string, string> = {
    superfamily: "superfamilies", family: "families", subfamily: "subfamilies", tribe: "tribes", clade: "clades",
};

/**
 * Ranks narrow enough that the spread of their members' lengths describes
 * them; a larger clade's range is set by single outlying records.
 */
const sizedRanks = new Set([ "family", "subfamily", "tribe" ]);

/**
 * The most genera, subgroups or countries the summary names before counting
 * the rest.
 */
const maximumListed = 4;

/**
 * Lists names up to the limit, then counts the rest: "A, B, C and 12
 * others".
 *
 * @param names - The names, most notable first.
 * @param others - The word for the rest ("others", "other countries").
 * @returns The phrase.
 */
function listWithRest(names: Array<string>, others: string): string
{
    return names.length > maximumListed
        ? `${names.slice(0, maximumListed - 1).join(", ")} and ${names.length - maximumListed + 1} ${others}`
        : joinWords(names);
}

/**
 * Describes the span from the clade's oldest to its youngest stage: " during
 * the Campanian to Maastrichtian stages of the Late Cretaceous", or " from
 * the Carnian stage of the Late Triassic to the Maastrichtian stage of the
 * Late Cretaceous" when the two fall in different epochs.
 *
 * @param stages - The clade's stages, oldest first.
 * @param periods - The clade's epochs, oldest first.
 * @param stageEpochs - The epoch each stage belongs to.
 * @returns The phrase, or an empty string when no record dates the clade.
 */
function describeSpan(stages: Array<string>, periods: Array<string>, stageEpochs: Record<string, string>): string
{
    const first = stages[0];
    const last = stages[stages.length - 1];

    if (first && last && stageEpochs[first] && stageEpochs[last] && stageEpochs[first] !== stageEpochs[last])
    {
        return ` from the ${first} stage of the ${stageEpochs[first]} to the ${last} stage of the ${stageEpochs[last]}`;
    }
    else if (first && last)
    {
        return ` during ${describeTimeSpan([ first, last ].filter((stage, index, all) => all.indexOf(stage) === index), [ stageEpochs[first] ?? periods[0] ])}`;
    }
    else if (periods.length > 0)
    {
        return periods.length > 1 ? ` from the ${periods[0]} to the ${periods[periods.length - 1]}` : ` during the ${periods[0]}`;
    }

    return "";
}

/**
 * Says what the clade's members ate and how they moved, when they all share
 * it: "bipedal carnivores".
 *
 * @param genera - The clade's genera.
 * @returns The phrase, or undefined when the members differ or no record
 * says.
 */
function describeWayOfLife(genera: CladeFacts["genera"]): string | undefined
{
    const diets = new Set(genera.map((genus) => genus.diet).filter(Boolean));
    const gaits = new Set(genera.map((genus) => genus.locomotion).filter(Boolean));
    const diet = diets.size === 1 ? [ ...diets ][0] : undefined;
    const gait = gaits.size === 1 ? [ ...gaits ][0] : undefined;

    if (!diet)
    {
        return undefined;
    }

    const gaitWord = gait === "facultative" ? "facultatively bipedal" : gait;

    return `${gaitWord ? `${gaitWord} ` : ""}${diet}s`;
}

/**
 * Writes a clade's summary from its facts: what it is and who named it,
 * when and where its members lived, its subgroups and best-known genera,
 * their way of life and size, and who revised it. Every clause restates a
 * fact the record holds.
 *
 * @param facts - The clade's facts.
 * @returns The summary.
 */
export function composeCladeSummary(facts: CladeFacts): string
{
    const parent = facts.taxonomy[facts.taxonomy.length - 1] ?? "";
    const group = majorGroups.find(([clade]) => clade !== facts.name && facts.taxonomy.includes(clade));
    const parentAdjective = formCladeAdjective(parent);
    const kind = parent === "Dinosauria" ? "" : group && group[0] !== parent && parentAdjective !== group[1]
        ? (parentAdjective.endsWith(group[1]) ? parentAdjective : `${parentAdjective} ${group[1]}`)
        : group?.[1] ?? parentAdjective;
    const rank = facts.rank === "unranked" ? "clade" : facts.rank;
    const namedBy = facts.authors && facts.described ? ` named by ${formatAuthors(facts.authors)} in ${facts.described}` : "";
    const typeGenus = facts.typeGenus ? `, with ${facts.typeGenus} as its type genus` : "";
    const sentences = facts.name === "Dinosauria"
        ? [ `Dinosauria is the clade of all dinosaurs${namedBy ? `,${namedBy}` : ""}.` ]
        : [ `${facts.name} is ${/^[aeiou]/.test(rank) ? "an" : "a"} ${rank} of ${kind ? `${kind} ` : ""}dinosaurs${namedBy}${typeGenus}.` ];

    const stages = facts.stageOrder.filter((stage) => facts.genera.some((genus) => genus.stages.includes(stage)));
    const periods = facts.periodOrder.filter((period) => facts.genera.some((genus) => genus.periods.includes(period)));
    const countryCounts = new Map<string, number>();

    for (const country of facts.genera.flatMap((genus) => genus.countries))
    {
        countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    }

    const countries = [ ...countryCounts.entries() ]
        .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
        .map(([country]) => formatPlace(countryProse[country] ?? country));
    const where = countries.length > 0 ? ` in what is now ${listWithRest(countries, "other countries")}` : "";
    const withinBirds = facts.name === "Avialae" || facts.taxonomy.includes("Avialae");
    const members = facts.includesBirds ? "Its non-avian members" : "Its members";

    if (facts.name !== "Dinosauria" && !withinBirds && (stages.length + periods.length > 0 || where))
    {
        sentences.push(`${members} lived${describeSpan(stages, periods, facts.stageEpochs)}${where}.`);
    }

    if (facts.subgroups.length > 0)
    {
        const ranks = new Set(facts.subgroups.map((subgroup) => (subgroup.rank === "unranked" ? "clade" : subgroup.rank)));
        const rankWord = ranks.size === 1 ? [ ...ranks ][0] : "clade";

        sentences.push(`It includes the ${facts.subgroups.length === 1 ? rankWord : rankPlurals[rankWord] ?? `${rankWord}s`} ${listWithRest(facts.subgroups.map((subgroup) => subgroup.name), "others")}.`);
    }

    const genera = [ ...facts.genera ]
        .sort((first, second) => second.notable - first.notable || second.species - first.species || first.name.localeCompare(second.name))
        .map((genus) => genus.name);

    if (genera.length === 1)
    {
        sentences.push(`Its only genus is ${genera[0]}.`);
    }
    else if (genera.length > 1 && genera.length <= maximumListed)
    {
        sentences.push(`Its genera are ${joinWords(genera)}.`);
    }
    else if (genera.length > maximumListed && facts.includesBirds)
    {
        sentences.push(`Its genera include ${joinWords(genera.slice(0, 3))}.`);
    }
    else if (genera.length > maximumListed)
    {
        sentences.push(`It contains ${genera.length} genera, among them ${joinWords(genera.slice(0, 3))}.`);
    }

    const wayOfLife = facts.name === "Dinosauria" || facts.includesBirds ? undefined : describeWayOfLife(facts.genera);
    const lengths = facts.genera.flatMap((genus) => [ genus.length?.min, genus.length?.max ]).filter((length): length is number => length !== undefined);
    const size = sizedRanks.has(facts.rank) && facts.genera.filter((genus) => genus.length).length > 1
        ? formatLength({ min: Math.min(...lengths), max: Math.max(...lengths) })
        : undefined;

    if (wayOfLife && size)
    {
        sentences.push(`Its members were ${wayOfLife}, from ${size} long.`);
    }
    else if (wayOfLife)
    {
        sentences.push(`Its members were ${wayOfLife}.`);
    }
    else if (size && !facts.includesBirds && facts.name !== "Dinosauria")
    {
        sentences.push(`Its members ranged from ${size} long.`);
    }

    if (facts.revised)
    {
        sentences.push(`${formatAuthors(facts.revised.authors)} revised it in ${facts.revised.year}.`);
    }

    if (facts.disputed)
    {
        sentences.push("Aspects of its classification are disputed.");
    }

    return sentences.join(" ");
}
