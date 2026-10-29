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
  /* A committed, real bundle: the Andheri East coworking competitors
     (scripts/examples/andheri-coworking.js). Keeps the example honest. */
  const andheriCoworking = JSON.parse(fs.readFileSync(path.join(ROOT, "examples", "andheri-coworking.bundle.json"), "utf8"));

  /* The two other layouts. A place: one site, competitors with operators,
     an employer, a deal, the market's facts and a metro line. */
  const src = "https://example.org/";
  const place = {
    meta: { title: "Hoodi site", asOf: "2026-10", center: [77.721, 12.9887], zoom: 13, layout: "place" },
    options: [{ id: "site", n: 1, name: "Lakeside Campus", lat: 12.988675, lng: 77.721021, precision: "building", geoSrc: src + "s", locality: "Hoodi", city: "Bengaluru" }],
    places: [
      { id: "c1", kind: "flex", name: "WeWork Prestige", operator: "WeWork", lat: 12.99, lng: 77.725, precision: "building", src: src + "1", sub: "1,200 seats" },
      { id: "c2", kind: "flex", name: "Awfis ITPL", operator: "Awfis", lat: 12.985, lng: 77.73, precision: "building", src: src + "2" },
      { id: "c3", kind: "flex", name: "WeWork Far Away", operator: "wework", lat: 13.2, lng: 77.95, precision: "approx", src: src + "3" },
      { id: "e1", kind: "employer", name: "ITPL", lat: 12.986, lng: 77.735, precision: "building" },
      { id: "d1", kind: "deal", name: "ClayWorks, 1.2 lakh sq ft", lat: 12.9887, lng: 77.7211, precision: "building", sub: "Sep 2025" }
    ],
    facts: { market: [{ k: "Grade A rent", v: "Rs 90 a sq ft", asOf: "2026-09", src: src + "r" }], supply: [{ k: "New supply", v: "2 msf by 2027", src: src + "n" }] },
    transit: { lines: [{ key: "purple", name: "Purple Line", color: "#800080", mode: "metro", stations: [{ name: "Hoodi", lat: 12.99, lng: 77.716, open: true }, { name: "Whitefield", lat: 12.996, lng: 77.758, open: true }] }] }
  };
  /* A network: locations in four cities, one with no City that joins the
     nearest, one with no City and nothing near that groups by locality. */
  const network = {
    meta: { title: "Our offices", asOf: "2026-10", center: [78.9, 20.6], zoom: 4.4, layout: "network" },
    options: [
      { id: "mum-1", name: "Andheri office", lat: 19.12, lng: 72.86, precision: "building", geoSrc: src + "a", city: "Mumbai", fit: "office" },
      { id: "mum-2", name: "BKC office", lat: 19.065, lng: 72.865, precision: "building", geoSrc: src + "b", city: "mumbai", fit: "office" },
      { id: "blr-1", name: "Whitefield centre", lat: 12.97, lng: 77.75, precision: "building", geoSrc: src + "c", city: "Bengaluru", fit: "centre" },
      { id: "noi-1", name: "Noida plant", lat: 28.58, lng: 77.32, precision: "street", geoSrc: src + "d", city: "Noida", fit: "plant" },
      { id: "gur-1", name: "Gurugram hub", lat: 28.46, lng: 77.03, precision: "locality", geoSrc: src + "e" },
      { id: "pun-1", name: "Hinjewadi office", lat: 18.59, lng: 73.74, precision: "locality", geoSrc: src + "f", locality: "Hinjewadi" }
    ],
    facts: { Mumbai: [{ k: "Rent", v: "Rs 150 a sq ft", src: src + "m" }], network: [{ k: "Seats", v: "4,000", src: src + "t" }] }
  };

  return { chennai, minimal, noChooser, noExisting, noTransit, oneOption, ownKinds, fromWorkbook, andheriCoworking, place, network };
}

/* What each layout must show as it opens, before anything is clicked. */
const EXPECT = {
  place: async (page) => {
    await page.waitForFunction(() => /Routed/.test((document.querySelector("#b-sub") || {}).textContent || ""), { timeout: 5000 }).catch(() => {});
    const r = await page.evaluate(() => ({
      head: document.querySelector("#p-head").innerText, body: document.querySelector("#p-body").innerText, sub: document.querySelector("#b-sub").textContent,
      places: [...document.querySelectorAll("#list .card.pc")].map(c => c.innerText.replace(/\s+/g, " ")), tabs: [...document.querySelectorAll("#tabs [data-t]")].map(t => t.innerText),
      rings: (window.__atlasMap && window.__atlasMap._layers["rings-line"]) ? 1 : 0,
    }));
    const out = [];
    if (!/Lakeside Campus/.test(r.head)) out.push("the site is not what the panel opens on: " + r.head.slice(0, 80));
    if (r.sub !== "Routed drive time") out.push("the routed drive-time areas were not used: list says " + JSON.stringify(r.sub));
    if (r.places.length !== 5 || !/≤ 10 min/.test(r.places[0]) || !/beyond 30 min/.test(r.places[4])) out.push("the places around the site are not listed nearest first with their area: " + JSON.stringify(r.places));
    if (!/Within 10 min\s*4\b/i.test(r.body)) out.push("the counts inside the first area are wrong: " + r.body.slice(0, 200));
    if (!/Who competes here[\s\S]*WeWork[\s\S]*Awfis/i.test(r.body)) out.push("competition by operator is missing");
    if (!r.tabs.includes("Competition") || !r.tabs.includes("The site") || r.tabs.includes("Distances")) out.push("the tabs are not a place atlas's: " + r.tabs.join(", "));
    if (!/routed by Mapbox/.test(r.body)) out.push("the method line does not say the areas are routed");
    return out;
  },
  network: async (page) => {
    await page.waitForFunction(() => window.__atlasMap && window.__atlasMap._layers["opt"], { timeout: 5000 }).catch(() => {});
    const r = await page.evaluate(() => ({
      head: document.querySelector("#p-head").innerText, body: document.querySelector("#p-body").innerText, heads: [...document.querySelectorAll("#list .cityh")].map(h => h.innerText.replace(/\s+/g, " ")),
      chips: [...document.querySelectorAll("#filters [data-city]")].length, city: !!(window.__atlasMap && window.__atlasMap._layers["city-dot"]), count: document.querySelector("#b-count").textContent,
    }));
    const out = [];
    if (!r.city) out.push("no city bubbles on the map");
    if (r.heads.length !== 4 || !/MUMBAI 2 LOCATIONS/i.test(r.heads[0]) || !r.heads.some(h => /NOIDA 2/i.test(h)) || !r.heads.some(h => /HINJEWADI 1/i.test(h))) out.push("the list is not grouped by city (a missing City joins the nearest within 40 km): " + JSON.stringify(r.heads));
    if (r.count !== "6 locations") out.push("the count does not say locations: " + r.count);
    if (!/6 locations in 4 cities/i.test(r.head + r.body) || !/City by city/i.test(r.body)) out.push("the presence view is missing: " + r.body.slice(0, 160));
    await page.click('#filters [data-city]');
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => ({ cards: document.querySelectorAll("#list .card").length, hash: location.hash }));
    if (after.cards !== 2 || !/#\/city\//.test(after.hash)) out.push("picking a city does not narrow the list and the link: " + JSON.stringify(after));
    await page.click('#filters [data-city]');
    return out;
  },
};

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
    /* Routed drive-time areas: squares round the site, 10, 20 and 30 min. */
    const iso = url.match(/isochrone\/v1\/mapbox\/[^/]+\/([-\d.]+),([-\d.]+)/);
    if (iso) {
      const [x, y] = [+iso[1], +iso[2]], sq = (h) => [[[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h], [x - h, y - h]]];
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ type: "FeatureCollection", features: [[30, .1], [20, .05], [10, .02]].map(([m, h]) => ({ type: "Feature", properties: { contour: m }, geometry: { type: "Polygon", coordinates: sq(h) } })) }) });
    }
    if (/arcgisonline|api\.mapbox\.com\/styles|\/media\//.test(url)) return route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64") });
    return route.continue();
  });

  await page.addInitScript(() => { window.__atlasErrors = []; });
  await page.goto(base + "/engine/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#tabs") && document.querySelector("#tabs").children.length > 0, { timeout: 15000 })
    .catch(() => errors.push("the tab bar never rendered"));
  if (EXPECT[name]) (await EXPECT[name](page).catch(e => ["checking the layout threw: " + e.message.split("\n")[0]])).forEach(e => errors.push(e));

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
