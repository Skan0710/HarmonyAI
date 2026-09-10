import { test, expect } from '@playwright/test';
import { trackPageHealth, expectNoHorizontalOverflow } from './helpers';

const LIBRARY_PAGES: [string, string][] = [
  ['/library', 'Music Library'],
  ['/liked-songs', 'Liked Songs'],
  ['/playlists', 'Playlists'],
  ['/history', 'Listening History'],
];

for (const [path, heading] of LIBRARY_PAGES) {
  test(`${heading} loads cleanly`, async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });
}
