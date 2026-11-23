// Compiled, never run, by the Publish bindings workflow against the staged
// @open-paleo/types package before it is published: it fails when the package
// does not resolve, a type the README names is missing, or the README's
// examples stop compiling.

import type { Clade, Genus, OpenPaleoDataset, Reference, Species, StratigraphicUnit } from "@open-paleo/types";
import schema from "@open-paleo/types/schema.json" with { type: "json" };

/**
 * Lists every genus in a dataset, as the README shows.
 *
 * @param dataset - A parsed dataset.
 * @returns The genera.
 */
export function listGenera(dataset: OpenPaleoDataset): Array<Genus>
{
    return Object.values(dataset.genera);
}

/**
 * Looks a genus up by name, as the README shows.
 *
 * @param dataset - A parsed dataset.
 * @returns The genus, if the dataset has it.
 */
export function findTyrannosaurus(dataset: OpenPaleoDataset): Genus | undefined
{
    return dataset.genera["Tyrannosaurus"];
}

/**
 * Collects one value of each type the README names, so a type that is
 * renamed or removed fails the compile.
 *
 * @param dataset - A parsed dataset.
 * @returns The first clade, species, reference and unit found.
 */
export function collectNamedTypes(dataset: OpenPaleoDataset): [Clade | undefined, Species | undefined, Reference | undefined, StratigraphicUnit | undefined]
{
    const genus = listGenera(dataset)[0];

    return [
        Object.values(dataset.clades)[0],
        genus?.species[0],
        genus?.references?.[0],
        Object.values(dataset.stratigraphy ?? {})[0],
    ];
}

/**
 * The schema's draft, read from the package's JSON export.
 */
export const schemaDraft: string = schema.$schema;
