import { test, expect, type Response } from '@playwright/test';

test.describe('Game Listing and Navigation', () => {
  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });
  });

  test('should filter the homepage by category and publisher', async ({ page }) => {
    await test.step('Navigate to the homepage and select filter options', async () => {
      await page.goto('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();

      const categoryFilter = page.locator('input[data-filter-type="category"]').first();
      const publisherFilter = page.locator('input[data-filter-type="publisher"]').first();
      const categoryId = await categoryFilter.getAttribute('value');
      const publisherId = await publisherFilter.getAttribute('value');

      await categoryFilter.check();
      await expect(page.locator(`[data-testid="game-card"][data-category-id="${categoryId}"]`).first()).toBeVisible();
      await categoryFilter.uncheck();

      await publisherFilter.check();
      await expect(page.locator(`[data-testid="game-card"][data-publisher-id="${publisherId}"]`).first()).toBeVisible();
      await publisherFilter.uncheck();

      await categoryFilter.check();
      await publisherFilter.check();
      const hasIntersectingCards = await page.evaluate(
        ({ categoryIdValue, publisherIdValue }) => {
          const cards = Array.from(document.querySelectorAll('[data-testid="game-card"]'));
          return cards.some(
            (card) =>
              card.getAttribute('data-category-id') === categoryIdValue &&
              card.getAttribute('data-publisher-id') === publisherIdValue,
          );
        },
        { categoryIdValue: categoryId, publisherIdValue: publisherId },
      );

      if (hasIntersectingCards) {
        await expect(
          page.locator(
            `[data-testid="game-card"][data-category-id="${categoryId}"][data-publisher-id="${publisherId}"]`,
          ).first(),
        ).toBeVisible();
      } else {
        await expect(page.getByTestId('filtered-empty-state')).toBeVisible();
      }
    });

    await test.step('Clear the filters and confirm the full catalog returns', async () => {
      await page.getByTestId('clear-filters').click();
      await expect(page.locator('[data-testid="game-card"]').first()).toBeVisible();
      await expect(page.getByTestId('visible-games-count')).toContainText(/game(s)? shown/i);
    });
  });

  test('should search games by title and show an empty state for no matches', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.getByTestId('game-search');
    const firstCard = page.getByTestId('game-card').first();
    const firstTitle = await firstCard.getAttribute('data-game-title');
    expect(firstTitle).not.toBeNull();

    await test.step('Filter the catalog with a case-insensitive title search', async () => {
      const searchTerm = firstTitle?.slice(0, 4).toLowerCase() ?? '';
      await searchInput.fill(searchTerm);
      await expect(page.getByTestId('visible-games-count')).toContainText(/game(s)? shown/i);
      await expect(page.locator('[data-testid="game-card"]:visible').first()).toHaveAttribute(
        'data-game-title',
        new RegExp(searchTerm, 'i'),
      );
    });

    await test.step('Show an empty state when no title matches', async () => {
      await searchInput.fill('no-game-title-matches-this');
      await expect(page.getByTestId('filtered-empty-state')).toBeVisible();
      await expect(page.getByTestId('filtered-empty-state')).toContainText('No games match');
    });
  });

  test('should sort the catalog by title and star rating', async ({ page }) => {
    await page.goto('/');
    const sortSelect = page.getByTestId('game-sort');

    const cardTitles = async (): Promise<string[]> =>
      page.locator('[data-testid="game-card"]').evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-game-title') ?? ''),
      );

    await test.step('Sort titles from Z to A', async () => {
      await sortSelect.selectOption('title-desc');
      const titles = await cardTitles();
      expect(titles).toEqual([...titles].sort((left, right) => right.localeCompare(left)));
    });

    await test.step('Sort by highest star rating first', async () => {
      await sortSelect.selectOption('rating-desc');
      const ratings = await page.locator('[data-testid="game-card"]').evaluateAll((cards) =>
        cards.map((card) => {
          const value = card.getAttribute('data-star-rating');
          return value ? Number(value) : null;
        }),
      );
      const rated = ratings.filter((rating): rating is number => rating !== null);
      expect(rated).toEqual([...rated].sort((left, right) => right - left));
      expect(ratings.slice(rated.length).every((rating) => rating === null)).toBeTruthy();
    });
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });

    await test.step('Verify category and publisher descriptions are displayed when available', async () => {
      await expect(page.getByTestId('game-details-category-description')).not.toBeEmpty();
      await expect(page.getByTestId('game-details-publisher-description')).not.toBeEmpty();
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });
});
