// Captures the Total Environment satellite drone shot to PNG frames.
//   node te-drone/film/capture.mjs OUT_DIR [--page index|descent] [--still t1,t2] [--step n]
// Needs a local server for the repo on http://localhost:8137 (python3 -m http.server 8137 from the repo root)
// and te-drone/film/config.local.js (the site's public Mapbox token; not committed).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = args[0] || 'te-drone/out/frames', STILL = opt('--still', null), STEP = +opt('--step', 1), FPS = 24, PAGE = opt('--page', 'index');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
await page.goto(`http://localhost:8137/te-drone/film/${PAGE}.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
const DUR = await page.evaluate(() => window.__DUR);
const frames = STILL ? STILL.split(',').map((t) => Math.round(+t * FPS) + 1) : [];
if (!STILL) for (let f = 1; f <= DUR * FPS; f += STEP) frames.push(f);
const t0 = Date.now();
for (const f of frames) {
  const file = path.join(OUT, String(f).padStart(4, '0') + '.png');
  if (fs.existsSync(file) && !STILL) continue;
  await page.evaluate((t) => window.__seek(t), (f - 1) / FPS);
  await page.screenshot({ path: file, type: 'png' });
  if (f % 24 === 1) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}
await browser.close();
console.log('done', frames.length);
