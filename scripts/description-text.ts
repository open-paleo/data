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
