import { test as setup, expect } from '@playwright/test';

const API_BASE = 'http://localhost:5000/api';
const STORAGE_STATE = 'e2e/.auth/user.json';

// Registers a single throwaway account for the whole suite run (bypassing the
// UI, directly against the API) so tests never depend on pre-seeded user data
// and the run only costs one registration call against the backend's rate
// limiter, no matter how many workers or spec files run.
setup('authenticate', async ({ page, request }) => {
  const email = `e2e-${Date.now()}@harmonyai.test`;
  const password = 'password123';

  const response = await request.post(`${API_BASE}/auth/register`, {
    data: { name: 'E2E Test User', email, password },
  });
  const body = await response.json();
  const token = body?.data?.token;
  expect(token, `registration failed: ${JSON.stringify(body)}`).toBeTruthy();

  await page.goto('/login');
  await page.evaluate((t) => localStorage.setItem('harmonyai_token', t as string), token);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
