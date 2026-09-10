import { test, expect } from '@playwright/test';
import { trackPageHealth, expectNoHorizontalOverflow } from './helpers';

test.describe('Music Twin', () => {
  test('renders the organism or its graceful fallback without errors', async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto('/music-twin');
    await expect(page.locator('main').getByText(/music twin/i).first()).toBeVisible();

    const canvas = page.locator('canvas');
    const emptyState = page.getByText(/hasn't formed yet/i);
    await expect(canvas.or(emptyState)).toBeVisible({ timeout: 10_000 });

    await expectNoHorizontalOverflow(page);
    const meaningfulErrors = consoleErrors.filter((e) => !/THREE\.Clock/i.test(e));
    expect(meaningfulErrors, meaningfulErrors.join('\n')).toHaveLength(0);
  });
});

test.describe('Taste Evolution', () => {
  test('loads without errors', async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto('/taste-evolution');
    await expect(page.locator('main').getByText(/taste evolution|still being written/i).first()).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });
});
