// @ts-nocheck
/**
 * render.mjs - rasterize the merchant visual assets from the HTML/SVG
 * templates in this folder.
 *
 *   node store-assets/generator/render.mjs
 *
 * Serves this directory over a throwaway localhost port (so @font-face and
 * relative paths load cleanly) and drives the repo-root Playwright Chromium
 * at exact viewports / deviceScaleFactor=1.
 *
 * Outputs (all at 1x, exact store dimensions):
 *   mobile/merchant-app/assets/{icon,adaptive-icon,splash-icon,favicon}.png
 *   store-assets/merchant/{icon-1024,icon-512,feature-graphic}.png
 *   store-assets/merchant/screenshots/{ios-1290x2796,android-1080x1920,ipad-2048x2732}/en/*.png
 */
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const ROOT = path.join(__dirname, '..', '..');
const GEN = __dirname;
const APP = path.join(ROOT, 'mobile', 'merchant-app', 'assets');
const STORE = path.join(ROOT, 'store-assets', 'merchant');
const SHOTS = path.join(STORE, 'screenshots');

const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(GEN, rel);
      if (!file.startsWith(GEN)) {
        res.writeHead(403);
        return res.end();
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404);
          return res.end('not found');
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const DEVICES = [
  { key: 'ios', w: 1290, h: 2796, dir: 'ios-1290x2796' },
  { key: 'android', w: 1080, h: 1920, dir: 'android-1080x1920' },
  { key: 'ipad', w: 2048, h: 2732, dir: 'ipad-2048x2732' },
];

const SCREENS = [
  ['01-orders.html', '01-orders'],
  ['02-order-detail.html', '02-order-detail'],
  ['03-push-actions.html', '03-push-actions'],
  ['04-products.html', '04-products'],
  ['05-earnings.html', '05-earnings'],
  ['06-store-status.html', '06-store-status'],
];

async function shoot(page, url, out, w, h, { transparent = false } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.screenshot({ path: out, omitBackground: transparent });
  console.log(`  ✓ ${path.relative(ROOT, out)}  ${w}x${h}${transparent ? ' (transparent)' : ''}`);
}

async function launch() {
  let browser = null;
  for (const channel of ['msedge', 'chrome', null]) {
    try {
      browser = await chromium.launch(channel ? { channel, args: ['--allow-file-access-from-files'] } : { args: ['--allow-file-access-from-files'] });
      break;
    } catch (e) {
      if (!channel) throw e;
    }
  }
  return browser;
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const icon = (q) => `${base}/templates/icon.html?${q}`;

  console.log('Icons + splash:');
  await shoot(page, icon('bg=orange&ratio=0.72&color=white'), path.join(APP, 'icon.png'), 1024, 1024);
  await shoot(page, icon('bg=orange&ratio=0.72&color=white'), path.join(STORE, 'icon-1024.png'), 1024, 1024);
  await shoot(page, icon('bg=orange&ratio=0.72&color=white'), path.join(STORE, 'icon-512.png'), 512, 512);
  await shoot(page, icon('bg=transparent&ratio=0.36&color=white'), path.join(APP, 'adaptive-icon.png'), 1024, 1024, { transparent: true });
  await shoot(page, icon('bg=transparent&ratio=0.70&color=white'), path.join(APP, 'splash-icon.png'), 1024, 1024, { transparent: true });
  await shoot(page, icon('bg=orange&ratio=0.72&color=white'), path.join(APP, 'favicon.png'), 256, 256);

  console.log('Feature graphic:');
  await shoot(page, `${base}/templates/feature-graphic.html`, path.join(STORE, 'feature-graphic.png'), 1024, 500);

  console.log('Screenshots:');
  for (const d of DEVICES) {
    const dir = path.join(SHOTS, d.dir, 'en');
    for (const [file, name] of SCREENS) {
      await shoot(page, `${base}/templates/screens/${file}?device=${d.key}`, path.join(dir, `${name}.png`), d.w, d.h);
    }
  }

  await browser.close();
  server.close();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
