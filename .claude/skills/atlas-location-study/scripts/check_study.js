#!/usr/bin/env node
/* Opens a study folder in headless Chromium and drives every view: the
   sign-in, every tab, every option, every preset, the filters, the sorts,
   the compare sheet, the layer chips and a phone-width pass. Fails on any
   page error. Needs no Mapbox token: the map is replaced by a stub that
   checks every layer has a source, and Esri requests get a blank image.

     NODE_PATH=$(npm root -g) node check_study.js path/to/study-folder [--shots out-dir] [--id DEMO --password DEMO-2026]

   With --id and --password it signs in through the real gate (proving the
   hash in data.js matches); without them it skips the gate. Screenshots go
   to --shots if given. Exit code 0 means every check passed. */
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("playwright");

const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DIR = path.resolve(args[0] || "."), SHOTS = opt("--shots"), ID = opt("--id"), PW = opt("--password");
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".json": "application/json", ".svg": "image/svg+xml" };
/* 1x1 grey JPEG for every Esri crop */
const JPG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/config.js" && !fs.existsSync(path.join(DIR, "config.js"))) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end('window.MAPBOX_TOKEN = "stub";'); }
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(DIR, p);
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

/* A stand-in for mapboxgl: records layers, refuses duplicates and layers
   without a source, fires load and moveend like the real one. */
function mapStub() {
  window.MAPBOX_TOKEN = window.MAPBOX_TOKEN || "stub";
  const log = window.__maplog = [];
  class Bounds { extend() { return this; } }
  class Ctl {}
  class Popup { setLngLat() { return this; } setHTML() { return this; } addTo() { return this; } remove() {} }
  class Map {
    constructor(o) { window.__map = this; this.h = {}; this.layers = {}; this.sources = {}; this.c = o.center; setTimeout(() => { this.fire("style.load"); this.fire("load"); }, 30); }
    on(ev, a, b) { const k = b ? ev + ":" + a : ev; (this.h[k] = this.h[k] || []).push(b || a); return this; }
    off() { return this; } once(ev, f) { return this.on(ev, f); }
    fire(ev) { (this.h[ev] || []).forEach(f => f({})); }
    addSource(id, s) { if (this.sources[id]) throw new Error("duplicate source " + id); this.sources[id] = { ...s, setData: (d) => { this.sources[id].data = d; } }; }
    getSource(id) { return this.sources[id]; }
    addLayer(l) { if (this.layers[l.id]) throw new Error("duplicate layer " + l.id); if (l.source && !this.sources[l.source]) throw new Error("layer " + l.id + " has no source " + l.source); this.layers[l.id] = l; log.push(l.id); }
    getLayer(id) { return this.layers[id]; }
    setLayoutProperty() {} setPaintProperty() {} setFilter() {} setConfigProperty() {}
    fitBounds() { setTimeout(() => this.fire("moveend"), 5); } flyTo() { setTimeout(() => this.fire("moveend"), 5); } easeTo() { setTimeout(() => this.fire("moveend"), 5); }
    addControl() {} getCanvas() { return { style: {} }; } getStyle() { return {}; } resize() {} getZoom() { return 11; } getCenter() { return { lng: this.c[0], lat: this.c[1] }; }
    project([lng, lat]) { const k = 2430; return { x: (lng - this.c[0]) * k + 700, y: (this.c[1] - lat) * k + 400 }; }
    unproject([x, y]) { const k = 2430, v = [this.c[0] + (x - 700) / k, this.c[1] - (y - 400) / k]; return { toArray: () => v, lng: v[0], lat: v[1] }; }
  }
  window.mapboxgl = { Map, LngLatBounds: Bounds, Popup, AttributionControl: Ctl, NavigationControl: Ctl };
}

(async () => {
  await new Promise(ok => server.listen(0, "127.0.0.1", ok));
  const BASE = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [], fails = [];
  const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };
  const page = async (vp, name, skipGate) => {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(mapStub);
    if (skipGate) await ctx.addInitScript(() => {
      const slug = (window.ATLAS_META || {}).slug;
      /* data.js has not run yet; read the slug when it does */
      Object.defineProperty(window, "ATLAS_META", { configurable: true, set(v) { Object.defineProperty(window, "ATLAS_META", { value: v, writable: true, configurable: true });
        try { sessionStorage.setItem(`atlas-${v.slug || "study"}-auth`, "1"); localStorage.setItem(`atlas-${v.slug || "study"}-intro`, JSON.stringify(["overview", "markets", "connect", "distance", "talent", "priorities", "conclusion", "option", "compare"])); } catch (e) {} } });
    });
    const p = await ctx.newPage();
    await p.route(/arcgisonline\.com/, r => /identify/.test(r.request().url())
      ? r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"results":[]}' })
      : r.fulfill({ status: 200, contentType: "image/jpeg", body: JPG }));
    await p.route(/api\.mapbox\.com|fonts\.(googleapis|gstatic)\.com|\/api\/cms/, r => r.fulfill({ status: 200, body: "" }));
    p.on("pageerror", e => errors.push(`${name}: ${e.message}`));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    return { p, ctx };
  };
  const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };

  /* 1. the sign-in */
  {
    const { p, ctx } = await page({ width: 1440, height: 900 }, "gate", false);
    await p.goto(BASE, { waitUntil: "load" }); await p.waitForTimeout(500);
    const gate = await p.$("#gate");
    if (gate && await gate.isVisible()) {
      await shot(p, "0-gate");
      check(true, "sign-in page shows");
      if (ID && PW) {
        await p.fill("#g-id", ID); await p.fill("#g-pw", PW); await p.click("#g-go");
        await p.waitForSelector(".card", { timeout: 8000 }).catch(() => {});
        check(!!(await p.$(".card")), "the ID and password open the study (hash in data.js matches)");
      }
    } else check(true, "no sign-in (meta.gate.hash is empty)");
    await ctx.close();
  }

  /* 2. every view on a desktop */
  {
    const { p, ctx } = await page({ width: 1440, height: 900 }, "desktop", true);
    await p.goto(BASE, { waitUntil: "load" });
    await p.waitForSelector(".card", { timeout: 10000 });
    const n = await p.$$eval(".card", c => c.length), want = await p.evaluate(() => window.ATLAS_OPTIONS.length);
    check(n === want, `list shows all ${want} options (${n})`);
    await shot(p, "1-overview");
    const tabs = await p.$$eval("#tabs [data-t]", t => t.map(x => x.dataset.t));
    console.log("     tabs:", tabs.join(", "));
    for (const t of tabs) {
      await p.click(`#tabs [data-t="${t}"]`); await p.waitForTimeout(80);
      if (t === "compare") { check(!!(await p.$("table.cmp")), "compare sheet opens"); await shot(p, "2-compare"); await p.click("#cmp-x"); continue; }
      const h = (await p.textContent("#p-head h2").catch(() => "")).trim();
      check(h.length > 0, `tab ${t}: "${h.slice(0, 60)}"`);
      await shot(p, `2-${t}`);
    }
    await p.click('#tabs [data-t="priorities"]');
    for (const k of await p.$$eval("[data-preset]", b => b.map(x => x.dataset.preset))) {
      await p.click(`[data-preset="${k}"]`); await p.waitForTimeout(30);
    }
    check(/#\/priorities\//.test(await p.evaluate(() => location.hash)), "presets write a shareable link");
    for (const id of await p.$$eval(".card", c => c.map(x => x.dataset.id))) {
      await p.click(`.card[data-id="${id}"]`); await p.waitForTimeout(60);
      const eb = (await p.textContent("#p-head .eyebrow").catch(() => "")).trim();
      if (!eb) check(false, `option ${id} opens`);
    }
    check(true, "every option opens");
    await shot(p, "3-option");
    await p.click(".back").catch(() => {});
    for (const f of await p.$$eval("[data-f]", b => b.map(x => x.dataset.f))) { await p.click(`[data-f="${f}"]`); await p.click(`[data-f="${f}"]`); }
    for (const s of await p.$$eval("#sort option", o => o.map(x => x.value))) await p.selectOption("#sort", s);
    const chips = await p.$$eval("#layers [data-l]", c => c.map(x => x.dataset.l));
    for (const l of chips) { await p.click(`#layers [data-l="${l}"]`); await p.click(`#layers [data-l="${l}"]`); }
    console.log("     layer chips:", chips.join(", "));
    const pops = await p.$$eval("#layers [data-pop]", c => c.map(x => x.dataset.pop));
    for (const k of pops) { await p.click(`#layers [data-pop="${k}"]`); await p.waitForTimeout(30); await p.keyboard.press("Escape"); }
    const layers = await p.evaluate(() => window.__maplog.length);
    check(layers > 10, `map layers added (${layers})`);
    await ctx.close();
  }

  /* 3. deep links */
  for (const h of ["#/priorities/balanced", "#/distance", "#/conclusion"]) {
    const { p, ctx } = await page({ width: 1280, height: 800 }, "link " + h, true);
    await p.goto(BASE + h, { waitUntil: "load" }); await p.waitForSelector(".card", { timeout: 10000 });
    check(((await p.textContent("#p-head h2").catch(() => "")) || "").trim().length > 0, `deep link ${h}`);
    await ctx.close();
  }

  /* 4. phone */
  {
    const { p, ctx } = await page({ width: 390, height: 844 }, "phone", true);
    await p.goto(BASE, { waitUntil: "load" }); await p.waitForSelector(".card", { timeout: 10000 });
    await shot(p, "4-phone");
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 0, `no sideways scroll on a phone (${over}px)`);
    await ctx.close();
  }

  await browser.close(); server.close();
  if (errors.length) { console.log("\npage errors:\n  " + errors.join("\n  ")); }
  const bad = fails.length + errors.length;
  console.log(bad ? `\n${fails.length} failed check(s), ${errors.length} page error(s)` : "\nall checks passed, no page errors");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
