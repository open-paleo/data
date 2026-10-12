// Walks every string in a parsed YAML value, for the checks that read prose.

/**
 * Called with each string a walk reaches.
 *
 * @param text - The string.
 * @param key - The key holding it; a list item inherits its list's key, and a
 *     string at the root has none.
 * @param trail - The path of keys and list labels that leads to it.
 */
export type StringVisitor = (text: string, key: string | null, trail: string) => void;

/**
 * How a walk names list items and which keys it leaves out.
 */
export type WalkOptions = {
    /**
     * Keys whose values are not walked.
     */
    skipKeys?: ReadonlySet<string>;

    /**
     * Labels a list item in the trail; the item's index when omitted.
     */
    listLabel?: (item: unknown, index: number) => string;
};

/**
 * Visits every string in a parsed YAML value, depth first, in document order.
 *
 * @param node - The parsed value.
 * @param visit - Called with each string, its key and its trail.
 * @param options - List labels and skipped keys.
 * @param trail - The trail of `node` itself.
 * @param key - The key holding `node`, or null at the root.
 */
export function walkStrings(
    node: unknown,
    visit: StringVisitor,
    options: WalkOptions = {},
    trail = "",
    key: string | null = null): void
{
    if (typeof node === "string")
    {
        visit(node, key, trail);
    }
    else if (Array.isArray(node))
    {
        for (const [index, item] of node.entries())
        {
            walkStrings(item, visit, options, `${trail}[${options.listLabel?.(item, index) ?? index}]`, key);
        }
    }
    else if (node && typeof node === "object")
    {
        for (const [childKey, value] of Object.entries(node))
        {
            if (!options.skipKeys?.has(childKey))
            {
                walkStrings(value, visit, options, trail ? `${trail}.${childKey}` : childKey, childKey);
            }
        }
    }
}
