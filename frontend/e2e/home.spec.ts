import { test, expect } from '@playwright/test';
import { trackPageHealth, expectNoHorizontalOverflow } from './helpers';

test.describe('Home', () => {
  test('loads with personalized hero and no console errors', async ({ page }) => {
    const { consoleErrors, failedRequests } = trackPageHealth(page);

    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText(/made for you/i)).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
    expect(failedRequests, failedRequests.join('\n')).toHaveLength(0);
  });

  test('sidebar navigation reaches every primary section', async ({ page }) => {
    await page.goto('/');

    const destinations: [string, string][] = [
      ['Discover', '/discover'],
      ['Music DNA', '/music-dna'],
      ['Music Twin', '/music-twin'],
      ['Taste Evolution', '/taste-evolution'],
      ['Search', '/search'],
    ];

    // On narrow viewports the nav lives behind a hamburger drawer.
    const viewport = page.viewportSize();
    const isMobileLayout = Boolean(viewport && viewport.width < 768);

    for (const [label, path] of destinations) {
      if (isMobileLayout) {
        await page.getByRole('button', { name: 'Open navigation' }).click();
      }
      await page.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/') + '$'));
    }
  });

  test('home is responsive with no horizontal overflow', async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('h1').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});
