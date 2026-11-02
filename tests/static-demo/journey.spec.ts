import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { CHAMBERS } from '../../src/shared/chambers.js';
import { applyPatch, initialState, solve, type Direction, type Patch } from '../../src/shared/engine.js';

const base = '/world-patch/';
const setup = 'https://github.com/himanshu748/world-patch/blob/main/docs/LOCAL-SETUP.md';
const keys: Record<Direction, string> = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
const screenshots = resolve('test-results/static-demo/screenshots');

function observe(page: Page) {
  const errors: string[] = [], backend: string[] = [], assets: string[] = [], failed: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`); });
  page.on('request', request => {
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}`);
    if (request.method() !== 'GET' || /^\/(api|auth|ws)(\/|$)/.test(url.pathname) || /\/(api|auth|ws)(\/|$)/.test(url.pathname)) backend.push(`${request.method()} ${url.pathname}`);
    if (['script', 'stylesheet', 'font'].includes(request.resourceType())) assets.push(url.pathname);
  });
  page.on('requestfailed', request => failed.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  page.on('websocket', socket => backend.push(socket.url()));
  return { errors, backend, assets, failed, requests };
}

async function attachRequestLedger(result: ReturnType<typeof observe>) {
  await test.info().attach('static-demo-request-ledger', { body: JSON.stringify(result), contentType: 'application/json' });
}

test('canonical static entry and local-preview fallback open the browser demo with safe links and no backend', async ({ page }) => {
  const result = observe(page);
  for (const path of [base, `${base}play?oauth=connected`, `${base}overlay`]) {
    await page.goto(path);
    await expect(page).toHaveTitle('WORLD//PATCH — Chat rewrites the rules.');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Chat changes');
    await expect(page.getByText('BROWSER SANDBOX', { exact: true })).toBeVisible();
    await expect(page.locator('.lp-sandbox canvas')).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveCount(0);
    await expect(page.locator('.lp-availability')).toHaveText('Public browser demo. Real engine, no sign-in. Live Twitch hosting requires setup.');
    await expect(page.locator('.lp-sandbox-disclosure')).toContainText('no chat, votes, or session connection runs here');
    const hostLinks = page.getByRole('link', { name: 'Host setup', exact: true });
    await expect(hostLinks).toHaveCount(3);
    for (const link of await hostLinks.all()) await expect(link).toHaveAttribute('href', setup);
    await expect(page.getByRole('link', { name: 'View the source', exact: true })).toHaveAttribute('href', 'https://github.com/himanshu748/world-patch');
    for (const link of await page.locator('a[href]').all()) {
      const href = await link.getAttribute('href');
      expect(href?.startsWith('#') || href === base || href?.startsWith('https://github.com/himanshu748/world-patch')).toBeTruthy();
    }
    await expect(page.getByRole('link', { name: 'World Patch home', exact: true })).toHaveAttribute('href', base);
  }
  await page.getByRole('link', { name: 'World Patch home', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await expect(page.locator('.lp-sandbox canvas')).toBeVisible();
  expect(result.assets.length).toBeGreaterThan(0);
  expect(result.assets.every(path => path.startsWith(`${base}assets/`) || path.startsWith(`${base}fonts/`))).toBe(true);
  expect(result.backend).toEqual([]); expect(result.errors).toEqual([]); expect(result.failed).toEqual([]);
  await page.screenshot({ path: resolve(screenshots, 'desktop.png'), fullPage: true });
  await attachRequestLedger(result);
});

test('real law acceptance, lockout rejection, complete witness and all three playable escapes work without a server', async ({ page }) => {
  const result = observe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await page.getByRole('button', { name: 'Close wall A', exact: false }).click();
  await expect(page.locator('.lp-sandbox-verdict')).toContainText('Wall A closed. Escape survives.');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('WALL A Closed');
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 24 moves');
  await page.getByRole('button', { name: 'Pull gravity down', exact: false }).click();
  await expect(page.locator('.lp-sandbox-verdict')).toContainText('Lockout rejected.');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('GRAVITY Off');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('WALL A Closed');
  for (let step = 0; step < 24; step++) await page.getByRole('button', { name: 'Step through escape', exact: false }).click();
  await expect(page.locator('.lp-window-status')).toContainText('EXIT REACHED');
  await expect(page.getByRole('button', { name: 'Step through escape', exact: false })).toBeDisabled();
  await page.screenshot({ path: resolve(screenshots, 'witness.png'), fullPage: false });
  const laws: { label: string; patch: Patch; text: string }[] = [
    { label: 'Close wall A', patch: { kind: 'walls', group: 'A', closed: true }, text: 'WALL A Closed' },
    { label: 'Cross portal pairs', patch: { kind: 'portals', value: 'crossed' }, text: 'PORTALS Crossed' },
    { label: 'Make ice slippery', patch: { kind: 'ice', value: true }, text: 'FLOOR Slippery' },
  ];
  for (const [index, chamber] of CHAMBERS.entries()) {
    await page.getByRole('button', { name: 'Reset sandbox', exact: true }).click();
    const card = page.getByRole('button', { name: `Play ${chamber.name}`, exact: true });
    await card.click(); await expect(card).toHaveAttribute('aria-pressed', 'true');
    const board = page.getByRole('region', { name: 'Playable sandbox board' });
    await expect(board).toBeFocused();
    await expect(page.locator('.lp-window-meta')).toContainText(chamber.name.toUpperCase());
    const law = laws[index]!;
    await page.getByRole('button', { name: law.label, exact: false }).click();
    await expect(page.locator('.lp-sandbox-laws')).toContainText(law.text);
    await expect(page.locator('.lp-sandbox-verdict')).toContainText('Escape survives.');
    const proof = solve(chamber, applyPatch(chamber, initialState(chamber), law.patch));
    expect(proof.status).toBe('solved');
    for (const direction of proof.witness) await board.press(keys[direction]);
    await expect(page.locator('.lp-window-meta')).toContainText('KEY ACQUIRED');
    await expect(page.locator('.lp-window-status')).toContainText('EXIT REACHED');
    await expect(page.locator('.lp-completion')).toContainText(`${chamber.name}, escaped in ${proof.witness.length} moves.`);
    await expect(page.locator('.lp-completion').getByRole('link', { name: 'Host setup', exact: true })).toHaveAttribute('href', setup);
    // Inspect the drawn pawn at the real exit, not only DOM status.
    expect(await page.locator('.lp-sandbox canvas').evaluate((canvas: HTMLCanvasElement, map) => {
      const context = canvas.getContext('2d'); if (!context) return 0;
      const sx = canvas.width / (map.width * 66 + 80), sy = canvas.height / (map.height * 66 + 80);
      const pixels = context.getImageData((40 + map.exit.x * 66 + 15) * sx, (40 + map.exit.y * 66 + 15) * sy, 36 * sx, 36 * sy).data;
      let amber = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! > 180 && pixels[i + 1]! > 110 && pixels[i + 2]! < 170 && pixels[i + 3]! > 150) amber++;
      return amber;
    }, { width: chamber.width, height: chamber.height, exit: chamber.exit })).toBeGreaterThan(50);
    await page.locator('.lp-sandbox').screenshot({ path: resolve(screenshots, `escaped-${chamber.id}.png`) });
    const next = CHAMBERS[(index + 1) % CHAMBERS.length]!;
    await page.getByRole('button', { name: `Next: ${next.name}`, exact: false }).click();
    await expect(page.locator('.lp-window-meta')).toContainText(next.name.toUpperCase());
    await expect(page.locator('.lp-sandbox-counter')).toHaveText('0 moves');
  }
  expect(result.backend).toEqual([]); expect(result.errors).toEqual([]); expect(result.failed).toEqual([]);
  await attachRequestLedger(result);
});

test('keyboard, touch, 320px layout and reduced motion remain usable in the static build', async ({ page }) => {
  const result = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await expect(page.locator('.lp-sandbox canvas')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to the interactive sandbox' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Try to break the world.' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close wall A', exact: false })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.lp-verdict-icon')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.lp-verdict-icon')).toHaveCSS('transform', 'none');
  await page.locator('.lp-hero-actions').getByRole('button', { name: 'Play the demo', exact: true }).press('Enter');
  const board = page.getByRole('region', { name: 'Playable sandbox board' });
  await expect(board).toBeFocused();
  await board.press('ArrowRight');
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('1 move');
  await page.getByRole('button', { name: 'Restart attempt', exact: false }).click();
  await page.getByRole('button', { name: 'Sandbox move right', exact: true }).click();
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('1 move');
  await expect(board).toHaveCSS('animation-name', 'none');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    for (const control of await page.locator('.lp-law-choice,.lp-play-modes button,.lp-play-dpad button,.lp-chamber-play').all()) {
      const box = await control.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(screenshots, 'mobile.png'), fullPage: true });
  expect(result.backend).toEqual([]); expect(result.errors).toEqual([]); expect(result.failed).toEqual([]);
  await attachRequestLedger(result);
});
