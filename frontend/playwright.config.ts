import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      // Full functional coverage lives in the desktop project; mobile spot-checks
      // navigation, responsive layout, and one core interaction rather than
      // duplicating every test at a second viewport (and doubling API load
      // against the dev backend's rate limiter for no extra signal).
      name: 'mobile',
      testMatch: [/home\.spec\.ts/, /discover\.spec\.ts/],
      use: { ...devices['Pixel 7'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5183',
    url: 'http://localhost:5183',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
