import { test, expect } from '@playwright/test';
import { trackPageHealth, expectNoHorizontalOverflow } from './helpers';

test.describe('Player', () => {
  test('mini-player appears on play and expands to the full player', async ({ page }) => {
    const { consoleErrors } = trackPageHealth(page);

    await page.goto('/');
    const playButton = page.getByRole('button', { name: /^Play /i }).first();
    await expect(playButton).toBeVisible({ timeout: 10_000 });
    await playButton.click();

    const expandButton = page.getByRole('button', { name: 'Expand player' });
    await expect(expandButton).toBeVisible();

    await expandButton.click();
    await expect(page.getByText('NOW PLAYING')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pause$|^Play$/ })).toBeVisible();

    await page.getByRole('button', { name: 'Minimize player' }).click();
    await expect(expandButton).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });

  test('keyboard space toggles playback', async ({ page }) => {
    await page.goto('/');
    const playButton = page.getByRole('button', { name: /^Play /i }).first();
    await expect(playButton).toBeVisible({ timeout: 10_000 });
    await playButton.click();

    const expandButton = page.getByRole('button', { name: 'Expand player' });
    await expect(expandButton).toBeVisible();

    // Keyboard shortcuts are ignored while a text input is focused, so blur first.
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');

    await expect(expandButton).toBeVisible();
  });
});
