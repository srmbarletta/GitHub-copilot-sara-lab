import { describe, expect, it } from 'vitest';
import { sortGames, type SortableGame } from './game-sort';

const games: SortableGame[] = [
    { title: 'Zebra Quest', starRating: 3.5 },
    { title: 'Alpha Quest', starRating: 4.8 },
    { title: 'Mystery Quest', starRating: null },
    { title: 'Beta Quest', starRating: 4.8 },
];

describe('sortGames', () => {
    it('sorts titles from A to Z', () => {
        expect(sortGames(games, 'title-asc').map((game) => game.title)).toEqual([
            'Alpha Quest',
            'Beta Quest',
            'Mystery Quest',
            'Zebra Quest',
        ]);
    });

    it('sorts titles from Z to A', () => {
        expect(sortGames(games, 'title-desc').map((game) => game.title)).toEqual([
            'Zebra Quest',
            'Mystery Quest',
            'Beta Quest',
            'Alpha Quest',
        ]);
    });

    it('sorts highest ratings first and puts unrated games last', () => {
        expect(sortGames(games, 'rating-desc').map((game) => game.title)).toEqual([
            'Alpha Quest',
            'Beta Quest',
            'Zebra Quest',
            'Mystery Quest',
        ]);
    });

    it('does not mutate the source collection', () => {
        const original = [...games];
        sortGames(games, 'rating-desc');
        expect(games).toEqual(original);
    });
});
