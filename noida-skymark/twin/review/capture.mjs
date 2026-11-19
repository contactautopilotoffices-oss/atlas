// Capture every room view of a tenant in the web viewer (headless Chrome, real GPU), for the approver.
//   node capture.mjs <url> <tenant>   -> the review server writes each POST /__review?name= into its shots dir
// Each shot is checked: walk mode off, camera at the view's position (within 0.5 m), image differs from the last.
import { createRequire } from 'module';
const require = createRequire('/Users/lohit/Downloads/Atlas/package.json');
const puppeteer = require('puppeteer');
const [url, tenant] = process.argv.slice(2);
const browser = await puppeteer.launch({ headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await page.waitForFunction(() => window.__twin && window.__twin.S.tenant, { timeout: 120000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const click = re => page.evaluate(src => { const b = [...document.querySelectorAll('button')].find(b => new RegExp(src).test(b.textContent.trim())); if (b) b.click(); return !!b; }, re);
await sleep(3000); await click('^Enter$'); await sleep(4000);
await page.evaluate(() => { const tw = window.__twin; if (tw.walk.on) tw.exitWalk(true); });
await click('Walk in from reception'); await sleep(8000);
await page.evaluate(() => { const tw = window.__twin; if (tw.walk.on) tw.exitWalk(true); });
const rooms = await page.evaluate(() => window.__twin.S.tenant.tourRooms.map(r => [r.name, r.views.length]));
let prev = 0, bad = 0;
for (let ri = 0; ri < rooms.length; ri++) for (let vi = 0; vi < rooms[ri][1]; vi++) {
  const res = await page.evaluate(async (ri, vi) => {
    const tw = window.__twin, r = tw.S.tenant.tourRooms[ri]; if (tw.walk.on) tw.exitWalk(true);
    await (vi === 0 ? tw.goRoom(r) : tw.goView(vi)); await new Promise(z => setTimeout(z, 1200));
    const v = r.views[vi], p = tw.toPlan(tw.S.tenant.id); const off = Math.hypot(p[0] - v.position[0], p[1] - v.position[1]);
    const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const nm = `${slug(r.name)}_${vi + 1}_${String(v.kind || 'view').toLowerCase().replace(/[^a-z]+/g, '')}.jpg`;
    const n = await tw.snap(nm); tw.unsnap(); return { nm, n, off: +off.toFixed(2), walk: tw.walk.on };
  }, ri, vi);
  const ok = res.off < 0.5 && !res.walk && res.n !== prev; if (!ok) bad++; prev = res.n;
  console.log(ok ? 'OK ' : 'BAD', res.nm, res.n, 'off', res.off, res.walk ? 'WALK' : '');
}
console.log('done', bad ? bad + ' bad' : 'all good');
await browser.close();
