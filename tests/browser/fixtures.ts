import { test as base, expect, type BrowserContext } from '@playwright/test';

export type HostCookies = Awaited<ReturnType<BrowserContext['cookies']>>;
const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3107}`;

// One in-memory synthetic session for journeys whose subject is not sign-in.
// Real desktop/mobile login, wrong-secret and bootstrap-auth tests keep their
// own anonymous contexts. Together they stay within the unchanged login limit.
export const test = base.extend<Record<never, never>, { hostCookies: HostCookies }>({
  hostCookies: [async ({ playwright }, use) => {
    const api = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { origin } });
    try {
      const response = await api.post('/api/login', { data: { secret: 'browser-test-secret-not-for-deployment-1234' } });
      expect(response.ok(), 'Synthetic worker host session must use the real login endpoint.').toBe(true);
      await use((await api.storageState()).cookies);
    } finally { await api.dispose(); }
  }, { scope: 'worker' }],
});
