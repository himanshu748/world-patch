import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: 'tests/static-demo',
  testMatch: 'journey.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['json', { outputFile: resolve('evidence/static-demo-browser.json') }]],
  outputDir: resolve('test-results/static-demo'),
  use: { baseURL: 'http://127.0.0.1:3196', browserName: 'chromium', channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, screenshot: 'only-on-failure', trace: 'off' },
  webServer: { command: 'npx vite preview --host 127.0.0.1 --port 3196 --strictPort --base=/world-patch/ --outDir=dist/judge-demo', cwd: process.cwd(), url: 'http://127.0.0.1:3196/world-patch/', reuseExistingServer: false, timeout: 30000 },
});
