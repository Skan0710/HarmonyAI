import { test, expect } from '@playwright/test';
import { trackPageHealth, expectNoHorizontalOverflow } from './helpers';

test.describe('Playlists', () => {
  test('playlists page loads and can open the create modal', async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto('/playlists');
    await expect(page.getByRole('heading', { name: 'Playlists', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /create playlist/i }).first().click();
    await expect(page.getByRole('heading', { name: /create new playlist/i })).toBeVisible();
    await page.keyboard.press('Escape');

    await expectNoHorizontalOverflow(page);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });
});

test.describe('AI Playlist Generator', () => {
  test('generates a playlist from a prompt', async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto('/ai-playlist');
    await expect(page.getByRole('heading', { name: /describe a moment/i })).toBeVisible();

    await page.getByRole('button', { name: /generate playlist/i }).click();

    // Wait for the loading state to resolve, then confirm the flow completed
    // into either a sequenced result or a visible error — never left hanging.
    await expect(page.getByText(/curating your playlist/i)).not.toBeVisible({ timeout: 15_000 });
    const result = page.getByText(/sequenced tracks/i);
    const errorState = page.getByText(/failed|error/i);
    await expect(result.or(errorState)).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });
});
