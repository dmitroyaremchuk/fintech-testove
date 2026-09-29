// Renders the design handoff into PNGs: node scripts/shoot.mjs
// Screen and state are injected by rewriting the data-props defaults (startScreen, screenState)
// in the served HTML; the source file is never modified.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('docs/design/handoff');
const PAGE = 'FundPath CRM EN.dc.html';
const OUT = path.resolve('docs/design/screens');
const VIEWPORT = { width: 1440, height: 900 };

const SCREENS = ['dashboard', 'clients', 'client', 'pipeline', 'deal', 'tasks'];
const shots = [
  ...SCREENS.map((screen) => ({ screen, state: 'ready', role: 'manager' })),
  ...['dashboard', 'pipeline', 'tasks'].map((screen) => ({ screen, state: 'ready', role: 'head' })),
  ...['clients', 'pipeline'].flatMap((screen) =>
    ['loading', 'empty', 'error'].map((state) => ({ screen, state, role: 'manager' })),
  ),
];

// data-props is HTML-escaped JSON: ...&quot;screenState&quot;:{...&quot;default&quot;:&quot;ready&quot;...
function setDefault(html, prop, value) {
  const re = new RegExp(`(&quot;${prop}&quot;:\\{[^}]*?&quot;default&quot;:)&quot;[^&]*&quot;`);
  if (!re.test(html)) throw new Error(`data-props default for "${prop}" not found`);
  return html.replace(re, `$1&quot;${value}&quot;`);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = path.join(ROOT, decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT)) throw new Error('outside root');
      let body = await fs.readFile(file);
      if (path.basename(file) === PAGE) {
        let html = body.toString('utf8');
        html = setDefault(html, 'startScreen', url.searchParams.get('screen') ?? 'dashboard');
        html = setDefault(html, 'screenState', url.searchParams.get('state') ?? 'ready');
        body = html;
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

async function switchToHead(page) {
  const topbar = page.locator('button:has-text("Head")').first();
  await page.getByRole('button', { name: 'Manager', exact: true }).click();
  await page.waitForTimeout(300);
  // The control may toggle on click or need the "Head" segment itself; verify either way.
  if (!(await isHeadActive(page))) await topbar.click();
  await page.waitForTimeout(300);
  if (!(await isHeadActive(page))) throw new Error('could not switch role to head');
}

// Active segment is the one with a non-transparent background.
async function isHeadActive(page) {
  return page.evaluate(() => {
    const bg = (label) => {
      const b = [...document.querySelectorAll('button')].find(
        (el) => el.textContent.trim() === label,
      );
      return b ? getComputedStyle(b).backgroundColor : null;
    };
    const head = bg('Head');
    const mgr = bg('Manager');
    const opaque = (c) => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent';
    return opaque(head) && !opaque(mgr);
  });
}

const server = await serve();
const base = `http://localhost:${server.address().port}/${encodeURIComponent(PAGE)}`;
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const written = [];

try {
  for (const { screen, state, role } of shots) {
    const page = await context.newPage();
    page.on('pageerror', (err) =>
      console.warn(`[${screen}/${state}/${role}] pageerror: ${err.message}`),
    );
    await page.goto(`${base}?screen=${screen}&state=${state}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    if (role === 'head') await switchToHead(page);

    // The app scrolls inside its own container, so fullPage alone stops at the viewport.
    // Grow the viewport by the largest inner overflow so the whole screen is captured.
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

    const name = `${screen}--${state}--${role}.png`;
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
    written.push(name);
    console.log(`saved ${name}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${written.length} screenshots in ${path.relative(process.cwd(), OUT)}/`);
