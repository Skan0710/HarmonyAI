import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// Seed/demo data references third-party placeholder image hosts (e.g.
// Unsplash) that this environment may not have egress to, and every such
// image already degrades gracefully via an onError fallback in the UI. Those
// failures are expected and not indicative of an app bug, so first-party
// origins are what actually matter for catching real regressions.
const FIRST_PARTY_HOSTS = ['localhost:5183', 'localhost:5000'];

/** Collects console errors and failed first-party network requests for a page. */
export function trackPageHealth(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  const isFirstParty = (url: string) => FIRST_PARTY_HOSTS.some((host) => url.includes(host));

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    if (isFirstParty(req.url())) failedRequests.push(`${req.method()} ${req.url()}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 500 && isFirstParty(res.url())) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  return { consoleErrors, failedRequests };
}

/** Asserts neither the document nor the app's scroll region exceeds the viewport width. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { docOverflow, mainOverflow } = await page.evaluate(() => {
    const main = document.querySelector('main');
    return {
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(docOverflow, 'document should not scroll horizontally').toBeLessThanOrEqual(1);
  expect(mainOverflow, 'main content region should not scroll horizontally').toBeLessThanOrEqual(1);
}
