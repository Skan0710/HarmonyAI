import { test, expect } from '@playwright/test';
import { trackPageHealth, expectNoHorizontalOverflow } from './helpers';

test.describe('Music DNA', () => {
  test('renders the constellation or its graceful fallback without errors', async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto('/music-dna');
    await expect(page.locator('main').getByText('Music DNA').first()).toBeVisible();

    // Either the 3D canvas mounted, or the page is showing the
    // insufficient-data empty state — both are valid, non-broken outcomes.
    const canvas = page.locator('canvas');
    const emptyState = page.getByText(/still forming/i);
    await expect(canvas.or(emptyState)).toBeVisible({ timeout: 10_000 });

    await expectNoHorizontalOverflow(page);
    // Filter out the known benign three.js deprecation warning so it doesn't
    // make an otherwise-healthy page look broken.
    const meaningfulErrors = consoleErrors.filter((e) => !/THREE\.Clock/i.test(e));
    expect(meaningfulErrors, meaningfulErrors.join('\n')).toHaveLength(0);
  });

  test('is usable at tablet and mobile widths', async ({ page }) => {
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/music-dna');
      await expect(page.locator('main').getByText('Music DNA').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});
