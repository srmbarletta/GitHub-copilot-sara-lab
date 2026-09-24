/**
 * Checks whether a game title contains a search query, ignoring case and surrounding whitespace.
 *
 * @param title - The game title to inspect.
 * @param query - The user-entered title search query.
 * @returns `true` when the normalized query occurs in the normalized title.
 */
export function matchesGameTitle(title: string, query: string): boolean {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery.length === 0 || title.toLocaleLowerCase().includes(normalizedQuery);
}
