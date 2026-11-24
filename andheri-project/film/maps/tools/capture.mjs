// Renders the map clips to H.264. The page (src/index.html) is driven frame by frame through window.__seek(t),
// which resolves only when Mapbox has drawn every tile of that frame, so the output never shows a half-loaded map.
//
//   node tools/capture.mjs <clip> [--dpr 2] [--frames a:b] [--still t1,t2,...]
//   clips: descent  interchange  route_privilon  route_corporate  route_723   (or "all")
//
// Needs the repo's local server on http://localhost:8137 (python3 serve.py from the repo root) and ffmpeg.
// Frames are rendered at 1920x1080 CSS px with devicePixelRatio 2 (3840x2160) and Lanczos-downscaled to 1080p:
// crisper type and imagery than a 1x render. Output: out/<clip>.mp4 (24 fps, H.264 High, CRF 14, yuv420p, BT.709).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/Users/lohit/Downloads/Atlas/package.json');
const { chromium } = require('playwright');

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.dirname(HERE);
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CLIPS = args[0] === 'all' ? ['descent', 'interchange', 'route_privilon', 'route_corporate', 'route_723'] : [args[0] || 'descent'];
const DPR = +opt('--dpr', 2), FPS = 24, STILL = opt('--still', null), FR = opt('--frames', null);
const URL0 = 'http://localhost:8137/andheri-project/film/maps/src/index.html';
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--force-color-profile=srgb',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--hide-scrollbars'] });
for (const clip of CLIPS) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: DPR });
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || t.startsWith('[cap]')) console.log('[console]', t.slice(0, 300)); });
  await page.goto(`${URL0}?clip=${clip}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  const DUR = await page.evaluate(() => window.__DUR);
  const shot = () => page.screenshot({ type: 'png', animations: 'allow', caret: 'hide' });
  if (STILL) {
    for (const t of STILL.split(',').map(Number)) {
      await page.evaluate((t) => window.__seek(t), t);
      const f = path.join(ROOT, 'out', 'stills', `${clip}_${t.toFixed(2)}.png`); fs.mkdirSync(path.dirname(f), { recursive: true });
      const png = await shot();
      await new Promise((res, rej) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-i', '-', '-vf', 'scale=1920:1080:flags=lanczos', f]); p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))); p.stdin.end(png); });
      console.log('still', f);
    }
    await page.close(); continue;
  }
  const N = Math.round(DUR * FPS), [fa, fb] = FR ? FR.split(':').map(Number) : [0, N];
  const out = path.join(ROOT, 'out', FR ? `${clip}_part.mp4` : `${clip}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p', '-an',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '14', '-tune', 'film', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  for (let f = fa; f < fb; f++) {
    await page.evaluate((t) => window.__seek(t), f / FPS);
    const png = await shot();
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 24 === 0) console.log(`${clip} ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end(); await done;
  console.log('wrote', out, fb - fa, 'frames', errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
  await page.close();
}
await browser.close();
