// Screenshots of the running dev app, for comparison with docs/design/screens/.
// Usage: node scripts/shoot-app.mjs <screen|all>
//
// Contract the app must satisfy:
// - Routes as in ROUTES below (detail screens open the design's reference records).
// - `?state=ready|loading|empty|error` forces the screen state.
// - Role switcher in the top bar: one button per role with `data-role-option="manager|head"`;
//   the active one has `aria-pressed="true"`.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const OUT = path.resolve('docs/design/_actual');
const VIEWPORT = { width: 1440, height: 900 };

const ROUTES = {
  dashboard: '/',
  clients: '/clients',
  client: '/clients/c1',
  pipeline: '/pipeline',
  deal: '/deals/d1',
  tasks: '/tasks',
  team: '/team',
};
const STATES = ['ready', 'loading', 'empty', 'error'];
const ROLES = ['manager', 'head'];
const HEAD_ONLY = new Set(['team']);

const arg = process.argv[2];
if (!arg || (arg !== 'all' && !(arg in ROUTES))) {
  console.error(`Usage: node scripts/shoot-app.mjs <${Object.keys(ROUTES).join('|')}|all>`);
  process.exit(1);
}
const screens = arg === 'all' ? Object.keys(ROUTES) : [arg];

try {
  await fetch(BASE_URL);
} catch {
  console.error(`Dev app is not reachable at ${BASE_URL}. Start it with: npm run dev`);
  process.exit(1);
}

async function switchRole(page, role) {
  const option = page.locator(`[data-role-option="${role}"]`);
  if ((await option.count()) === 0) {
    throw new Error(`role switcher not found: [data-role-option="${role}"]`);
  }
  if ((await option.getAttribute('aria-pressed')) !== 'true') await option.click();
  await page
    .locator(`[data-role-option="${role}"][aria-pressed="true"]`)
    .waitFor({ timeout: 5000 });
}

// The app scrolls inside its own container, so fullPage alone stops at the viewport.
// Grow the viewport by the largest inner overflow so the whole screen is captured.
async function expandToContent(page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll('*')]
        .filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY))
        .map((el) => el.scrollHeight - el.clientHeight),
    ),
  );
  if (overflow > 0) {
    await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height + overflow });
    await page.waitForTimeout(300);
  }
}

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const written = [];
const failed = [];

try {
  for (const screen of screens) {
    for (const role of ROLES) {
      if (HEAD_ONLY.has(screen) && role !== 'head') continue;
      for (const state of STATES) {
        const name = `${screen}-${state}-${role}.png`;
        // Fresh context per shot so persisted state (localStorage) never leaks between shots.
        const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
        const page = await context.newPage();
        page.on('pageerror', (err) => console.warn(`[${name}] pageerror: ${err.message}`));
        try {
          const url = `${BASE_URL}${ROUTES[screen]}?state=${state}`;
          await page.goto(url, { waitUntil: 'networkidle' });
          await switchRole(page, role);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(400);
          await expandToContent(page);
          await page.screenshot({ path: path.join(OUT, name), fullPage: true });
          written.push(name);
          console.log(`saved ${name}`);
        } catch (err) {
          failed.push(name);
          console.error(`failed ${name}: ${err.message}`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}

console.log(
  `\n${written.length} saved to ${path.relative(process.cwd(), OUT)}/, ${failed.length} failed`,
);
if (failed.length) process.exit(1);
