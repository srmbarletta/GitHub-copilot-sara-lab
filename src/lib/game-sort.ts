export type GameSort = 'title-asc' | 'title-desc' | 'rating-desc';

export type SortableGame = {
    title: string;
    starRating: number | null;
};

/**
 * Sorts games by title or rating without mutating the supplied collection.
 *
 * Unrated games are placed after rated games for rating order, then all ties
 * are resolved alphabetically so the catalog remains predictable.
 *
 * @param games - Games containing the fields needed for sorting.
 * @param sort - The requested title or rating order.
 * @returns A new array sorted according to the requested order.
 */
export function sortGames<T extends SortableGame>(games: T[], sort: GameSort): T[] {
    return [...games].sort((left, right) => {
        if (sort === 'rating-desc') {
            if (left.starRating === null && right.starRating !== null) return 1;
            if (left.starRating !== null && right.starRating === null) return -1;
            if (left.starRating !== right.starRating) {
                return (right.starRating ?? -Infinity) - (left.starRating ?? -Infinity);
            }
        }

        const titleOrder = left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
        return sort === 'title-desc' ? -titleOrder : titleOrder;
    });
}
