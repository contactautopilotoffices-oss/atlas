#!/usr/bin/env node
/* ============================================================================
   ATLAS · engine smoke test

     node scripts/engine-test.js            every case
     node scripts/engine-test.js chennai    one case

   Opens /engine/ in headless Chromium with a stand-in for mapbox-gl, walks
   every tab, opens an option and the compare sheet, and fails on any console
   error, page error or failed request.

   This exists because the engine cannot be checked by reading it. It is 2,000
   lines ported from a study whose data it no longer reads, and the mistakes
   that matter (a global that no longer exists, a layer whose source was never
   added, a tab that renders for a block the bundle does not carry) only show
   at run time.

   What it does NOT do is tell you the map looks right. Nothing here draws.
   A person still has to open a real Atlas with a real token before it ships.
   ============================================================================ */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const mapboxStub = require("./lib/mapbox-stub");
const studies = require("./lib/study-bundle");
const { validate, format } = require("./lib/validate-bundle");
const { readWorkbook } = require("./lib/workbook");
const { fillSampleWorkbook } = require("./lib/sample-workbook");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    /* The engine's pages insist on a trailing slash, because they load their
       files by relative path. Serve a directory index like a real host. */
    if (rel.endsWith("/")) rel += "index.html";
    const p = path.join(ROOT, rel);
    if (!p.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
    fs.readFile(p, (err, buf) => {
      if (err) { res.statusCode = 404; return res.end("not found"); }
      res.setHeader("Content-Type", TYPES[path.extname(p)] || "application/octet-stream");
      res.end(buf);
    });
  });
  return new Promise(ok => server.listen(0, "127.0.0.1", () => ok(server)));
}

/* The bundles the engine must survive. Chennai is the real one; the others
   are the shapes a workbook will actually produce on day one. */
async function cases() {
  const chennai = studies.bundleFor("chennai");
  const minimal = {
    meta: { title: "Pune Office Study", asOf: "2026-10", center: [73.8567, 18.5204], zoom: 11.5, sheet: "Pune.xlsx" },
    options: [
      { id: "amar-tech", name: "Amar Tech Park", lat: 18.5074, lng: 73.928, precision: "building", geoSrc: "https://example.org/a" },
      { id: "eon-free", name: "EON Free Zone", lat: 18.5679, lng: 73.9143, precision: "building", geoSrc: "https://example.org/b" }
    ]
  };
  const noChooser = JSON.parse(JSON.stringify(chennai));
  delete noChooser.measures; delete noChooser.presets;
  const noExisting = JSON.parse(JSON.stringify(chennai));
  delete noExisting.existing;
  noExisting.measures = (noExisting.measures || []).filter(m => m.kind !== "fromExisting");
  (noExisting.presets || []).forEach(p => { if (p.levels) delete p.levels.home; });
  const noTransit = JSON.parse(JSON.stringify(chennai));
  delete noTransit.transit; delete noTransit.bus;
  noTransit.measures = (noTransit.measures || []).filter(m => m.kind !== "nearestStation");
  (noTransit.presets || []).forEach(p => { if (p.levels) { delete p.levels.rail; delete p.levels.future; } });
  const oneOption = { ...minimal, options: [minimal.options[0]] };
  const ownKinds = {
    ...minimal,
    places: [
      { id: "h1", kind: "hospital", name: "Ruby Hall", lat: 18.531, lng: 73.877, precision: "building" },
      { id: "p1", kind: "port", name: "Inland depot", lat: 18.60, lng: 73.95, precision: "approx" }
    ],
    measures: [{ key: "care", kind: "nearestPlace", placeKind: "hospital", rings: [15, 30, 45], label: "Hospitals", question: "Q?", of: "distance" }],
    presets: [{ key: "b", label: "Balanced", default: true, levels: { care: 2 } }]
  };
  /* The one that proves the loop: a spreadsheet, filled the way a person
     fills one, read into a bundle, and rendered. If this passes, the team
     can make an Atlas without a developer. */
  const { bundle: fromWorkbook } = await readWorkbook(await fillSampleWorkbook());

  return { chennai, minimal, noChooser, noExisting, noTransit, oneOption, ownKinds, fromWorkbook };
}

async function run(name, bundle, base, browser) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", e => {
    /* The first engine frame in the stack is what a person needs to fix it. */
    const frame = (e.stack || "").split("\n").find(l => /app\.js/.test(l));
    errors.push("pageerror: " + e.message + (frame ? "\n         at " + frame.trim() : ""));
  });
  page.on("requestfailed", r => {
    const u = r.url();
    if (/mapbox|fonts\.|arcgisonline|\/media\/|\/api\//.test(u)) return;   // not the engine's doing
    errors.push("requestfailed: " + u + " " + (r.failure() || {}).errorText);
  });

  await page.route("**/*", async route => {
    const url = route.request().url();
    if (/\/config\.js/.test(url)) return route.fulfill({ contentType: "text/javascript", body: 'window.MAPBOX_TOKEN = "pk.test";' });
    if (/\/engine\/bundle\.js/.test(url)) return route.fulfill({ contentType: "text/javascript", body: "window.ATLAS = " + JSON.stringify({ slug: "test-" + name, ...bundle }) + ";" });
    if (/mapbox-gl\.js/.test(url)) return route.fulfill({ contentType: "text/javascript", body: mapboxStub() });
    if (/mapbox-gl\.css/.test(url)) return route.fulfill({ contentType: "text/css", body: "" });
    if (/atlas-cms\.js/.test(url)) return route.fulfill({ contentType: "text/javascript", body: "/* CMS off in tests */" });
    if (/fonts\.googleapis|fonts\.gstatic/.test(url)) return route.fulfill({ contentType: "text/css", body: "" });
    /* Satellite tiles are fulfilled rather than aborted: an abort surfaces as
       a console error and would drown the errors that matter. */
    if (/arcgisonline|api\.mapbox\.com\/styles|\/media\//.test(url)) return route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64") });
    return route.continue();
  });

  await page.addInitScript(() => { window.__atlasErrors = []; });
  await page.goto(base + "/engine/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#tabs") && document.querySelector("#tabs").children.length > 0, { timeout: 15000 })
    .catch(() => errors.push("the tab bar never rendered"));

  /* Walk every tab this Atlas decided to show. */
  const tabs = await page.$$eval("#tabs [data-t]", els => els.map(e => e.dataset.t));
  /* A tab that renders without throwing can still print NaN or undefined,
     which no error event reports. Read the text of every view for them. */
  const leak = async (where) => {
    const txt = await page.evaluate(() => [document.querySelector("#p-body"), document.querySelector("#p-head"), document.querySelector("#list"), document.querySelector("#cmp-body")].map(e => e ? e.innerText : "").join("\n"));
    const m = txt.match(/.{0,40}\b(NaN|undefined|\[object Object\])\b.{0,30}/);
    if (m) errors.push(`${where} prints "${m[1]}": ...${m[0].replace(/\s+/g, " ").trim()}...`);
  };
  for (const t of tabs) {
    await page.click(`#tabs [data-t="${t}"]`, { timeout: 5000 }).catch(e => errors.push(`clicking tab ${t}: ${e.message.split("\n")[0]}`));
    await page.waitForTimeout(90);
    await leak(`tab ${t}`);
    /* The Compare tab opens a sheet over the page; close it so the next tab
       is clickable. */
    await page.evaluate(() => { const c = document.querySelector("#cmp"); if (c) c.classList.remove("on"); });
  }
  /* Open the first option, then the compare sheet. */
  const firstCard = await page.$("#list .card");
  if (firstCard) { await firstCard.click(); await page.waitForTimeout(150); await leak("the option panel"); }
  else if (bundle.options.length) errors.push("no option cards rendered");
  await page.evaluate(() => window.openCompare && window.openCompare()).catch(e => errors.push("openCompare: " + e.message.split("\n")[0]));
  await page.waitForTimeout(150);
  await leak("the compare sheet");
  await page.evaluate(() => { const c = document.querySelector("#cmp"); if (c) c.classList.remove("on"); });

  const inner = await page.evaluate(() => window.__atlasErrors || []);
  inner.forEach(x => errors.push("map: " + x));

  const seen = await page.evaluate(() => {
    const txt = (sel) => { const e = document.querySelector(sel); return e ? (e.textContent || "") : "(missing)"; };
    const len = (sel) => { const e = document.querySelector(sel); return e ? (e.innerHTML || "").length : -1; };
    return {
      tabs: [...document.querySelectorAll("#tabs [data-t]")].map(e => e.dataset.t),
      cards: document.querySelectorAll("#list .card").length,
      layers: document.querySelectorAll("#layers .lay").length,
      title: document.title,
      brand: txt("#brand-t"),
      panel: len("#p-body"),
      mapLayers: Object.keys((window.__atlasMap || { _layers: {} })._layers || {}).length
    };
  });
  await ctx.close();
  return { errors, seen };
}

(async () => {
  const only = process.argv[2];
  const all = await cases();
  const names = only ? [only] : Object.keys(all);
  const server = await serve();
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  let bad = 0;

  for (const name of names) {
    const bundle = all[name];
    if (!bundle) { console.error(`unknown case "${name}". Known: ${Object.keys(all).join(", ")}`); process.exit(2); }
    /* A case the validator rejects is a broken test, not a broken engine. */
    const rep = validate(bundle);
    if (!rep.ok) {
      bad++;
      console.log(`\n=== ${name} ===\n  FAIL the test bundle itself does not validate:`);
      console.log(format(rep).split("\n").map(l => "    " + l).join("\n"));
      continue;
    }
    const { errors, seen } = await run(name, bundle, base, browser);
    const ok = errors.length === 0;
    if (!ok) bad++;
    console.log(`\n=== ${name} ===`);
    console.log(`  ${ok ? "ok  " : "FAIL"} ${seen.cards} cards · ${seen.tabs.length} tabs (${seen.tabs.join(", ")}) · ${seen.layers} layer chips · ${seen.mapLayers} map layers · panel ${seen.panel} chars`);
    console.log(`       title "${seen.title}" · brand "${seen.brand}"`);
    errors.slice(0, 12).forEach(e => console.log("       " + e));
    if (errors.length > 12) console.log(`       and ${errors.length - 12} more`);
  }

  await browser.close();
  server.close();
  console.log(`\n${names.length - bad} of ${names.length} passed\n`);
  process.exit(bad ? 1 : 0);
})();
