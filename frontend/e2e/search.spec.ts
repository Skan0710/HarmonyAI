import { test, expect } from '@playwright/test';
import { trackPageHealth, expectNoHorizontalOverflow } from './helpers';

test.describe('Search', () => {
  test('loads and returns results for a query', async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto('/search');
    await expect(page.getByRole('heading', { name: /what are you in the mood for/i })).toBeVisible();

    await page.getByPlaceholder(/something like arctic monkeys/i).fill('a');
    await page.waitForTimeout(600); // debounce window

    await expectNoHorizontalOverflow(page);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });

  test('quick vibe pills trigger a search', async ({ page }) => {
    await page.goto('/search');
    await page.getByRole('button', { name: 'Synthwave night drive' }).click();
    await expect(page).toHaveURL(/q=Synthwave/i);
  });
});
