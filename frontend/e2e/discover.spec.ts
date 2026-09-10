import { test, expect } from '@playwright/test';
import { trackPageHealth, expectNoHorizontalOverflow } from './helpers';

test.describe('Discover', () => {
  test('loads the discovery dial and switches modes', async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto('/discover');
    await expect(page.getByRole('heading', { name: /where should your music take you/i })).toBeVisible();

    const dialButtons = page.locator('button[aria-pressed]');
    await expect(dialButtons.first()).toBeVisible();
    const modeCount = await dialButtons.count();
    expect(modeCount).toBeGreaterThan(1);

    // Switch to the last mode on the spectrum and confirm the description updates.
    await dialButtons.nth(modeCount - 1).click();
    await expect(dialButtons.nth(modeCount - 1)).toHaveAttribute('aria-pressed', 'true');

    await expectNoHorizontalOverflow(page);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });

  test('mood and context finder is present', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.getByRole('heading', { name: /what's the moment calling for/i })).toBeVisible();
    await expect(page.getByText('Listening situation')).toBeVisible();
  });
});
