import { describe, expect, it } from 'vitest';
import { matchesGameTitle } from './game-search';

describe('matchesGameTitle', () => {
    it.each([
        ['matches a case-insensitive substring', 'Star Quest', 'star', true],
        ['trims surrounding whitespace', 'Star Quest', '  QUEST  ', true],
        ['matches every title for an empty query', 'Star Quest', '', true],
        ['returns false when the query is absent', 'Star Quest', 'campaign', false],
    ])('%s', (_description, title, query, expected) => {
        expect(matchesGameTitle(title, query)).toBe(expected);
    });
});
