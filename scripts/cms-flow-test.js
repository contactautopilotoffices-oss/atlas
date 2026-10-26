#!/usr/bin/env node
/* ============================================================================
   ATLAS · the whole loop, through the CMS

     node scripts/cms-flow-test.js

   Starts the local site (scripts/atlas-dev.js, with a throwaway JSON store),
   then does in headless Chromium exactly what a team member does:

     1. opens /admin/, creates the first owner
     2. goes to Create an atlas, uploads examples/andheri-flex.xlsx
     3. reads the report, names the atlas, sets an access ID and password
     4. saves the draft, previews it, publishes it
     5. signs out of /admin/, goes to the site root as a VISITOR, types the
        access ID and password, and lands on the published atlas with its
        tabs rendered

   No code is written and nothing is deployed in that sequence. If this
   passes, the claim "the team can make an atlas without a developer" has
   been exercised rather than asserted. The map itself is a stand-in, as in
   engine-test.js, so a person still has to look at a real one once.
   ============================================================================ */
"use strict";
process.env.ATLAS_METRO = "off";   // no public services in tests; scripts/metro.test.js covers the metro
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { chromium } = require("playwright");
const mapboxStub = require("./lib/mapbox-stub");

const ROOT = path.join(__dirname, "..");
const SCRATCH = process.env.ATLAS_SCRATCH || fs.mkdtempSync(path.join(require("os").tmpdir(), "atlas-cms-"));
const STORE = path.join(SCRATCH, "cms-store.json");
const WORKBOOK = path.join(ROOT, "examples", "andheri-flex.xlsx");

const freePort = () => new Promise(ok => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
const wait = (ms) => new Promise(ok => setTimeout(ok, ms));
async function startSite() {
  const port = await freePort();
  if (fs.existsSync(STORE)) fs.unlinkSync(STORE);
  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "atlas-dev.js")], { env: { ...process.env, PORT: String(port), CMS_DEV_STORE: STORE, ENGY_API_KEY: "", ANTHROPIC_API_KEY: "", CMS_PDF_PROVIDER: "" }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", d => { log += d; });
  child.stderr.on("data", d => { log += d; });
  for (let i = 0; i < 50; i++) { if (/ATLAS at/.test(log)) break; await wait(100); }
  if (!/ATLAS at/.test(log)) { child.kill(); throw new Error("the local site did not start:\n" + log); }
  return { base: `http://127.0.0.1:${port}`, child, logs: () => log };
}

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
/* What every page gets instead of the network: a stand-in map, no fonts,
   blank tiles, and a config.js with a token (the real one is gitignored). */
async function stubRoutes(page) {
  await page.route("**/*", async route => {
    const url = route.request().url();
    if (/\/config\.js/.test(url)) return route.fulfill({ contentType: "text/javascript", body: 'window.MAPBOX_TOKEN = "pk.test";' });
    if (/mapbox-gl\.js/.test(url)) return route.fulfill({ contentType: "text/javascript", body: mapboxStub() });
    if (/mapbox-gl\.css|fonts\.googleapis|fonts\.gstatic/.test(url)) return route.fulfill({ contentType: "text/css", body: "" });
    if (/buildings_geo|bkc_buildings|mapbox_app/.test(url)) return route.fulfill({ contentType: "text/javascript", body: "" });
    if (/arcgisonline|api\.mapbox\.com|\/media\//.test(url)) return route.fulfill({ status: 200, contentType: "image/gif", body: GIF });
    return route.continue();
  });
}
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log("  ok    " + m); };
const bad = (m, d) => { fail++; console.log("  FAIL  " + m + (d ? "\n        " + String(d).replace(/\n/g, "\n        ") : "")); };
async function expect(name, fn) { try { const v = await fn(); if (v === false) bad(name); else ok(name); } catch (e) { bad(name, e.message.split("\n")[0]); } }

(async () => {
  if (!fs.existsSync(WORKBOOK)) { console.error(`Missing ${WORKBOOK}. Run: node scripts/examples/andheri-flex.js`); process.exit(2); }
  const site = await startSite();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await stubRoutes(page);
  await page.addInitScript(() => { window.__atlasErrors = []; });
  const ACCESS = "ANDHERI-FLEX", PASS = "Flex-Andheri-2026";

  try {
    console.log("\n1. The first owner is created in /admin/");
    await page.goto(site.base + "/admin/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#s-key, #l-email", { timeout: 15000 });
    await expect("the setup screen appears when there are no users", async () => !!(await page.$("#s-key")));
    await page.fill("#s-key", "dev-setup");
    await page.fill("#s-name", "Shubham");
    await page.fill("#s-email", "shubham@autopilotoffices.com");
    await page.fill("#s-pw", "owner-password-1");
    await page.click("#f-setup button[type=submit]");
    await page.waitForSelector("#nav a.it", { timeout: 15000 });
    await expect("the owner is signed in and sees the nav", async () => (await page.$$("#nav a.it")).length >= 5);
    await expect("Create an atlas is in the nav", async () => !!(await page.$('#nav a[href="#/create"]')));

    console.log("\n2. Create an atlas, one step at a time");
    await page.click('#nav a[href="#/create"]');
    await page.waitForSelector(".tcard", { timeout: 10000 });
    await expect("six steps across the top", async () => (await page.$$(".wiz li")).length === 6);
    await expect("step 1 offers three atlas types, Compare and decide ready", async () => (await page.$$(".tcard")).length === 3 && !(await page.$eval('.tcard[data-type="decide"]', e => e.disabled)));
    await page.click('.tcard[data-type="decide"]');
    await page.waitForSelector("#cr-files", { state: "attached", timeout: 10000 });
    await expect("the import box takes several files at once", async () => await page.$eval("#cr-files", e => e.multiple && /\.pdf/.test(e.accept) && /\.docx/.test(e.accept)));
    await expect("Build waits for a file or a few words", async () => await page.$eval("#w-next", e => e.disabled && /Build my atlas/.test(e.textContent)));
    await page.setInputFiles("#cr-files", WORKBOOK);
    await expect("the picked file is listed, and Build is ready", async () => /andheri-flex\.xlsx/.test(await page.$eval("#cr-picked", e => e.textContent)) && !(await page.$eval("#w-next", e => e.disabled)));
    await page.click("#w-next");
    await page.waitForSelector(".worklist", { timeout: 10000 });
    const builtOnce = () => page.waitForFunction(() => /Next: review it/.test((document.querySelector("#w-next") || {}).textContent || ""), { timeout: 30000 });
    await builtOnce();
    const work = await page.$eval(".worklist", e => e.textContent);
    await expect("the build shows each step and what it found", async () => /Reading your files/.test(work) && /4 propert/.test(work) && /4 on the map/.test(work) && /22 places/.test(work), work);
    await expect("a filled Atlas workbook is used as it is, not researched", async () => /used as it is/.test(work));
    await page.click("#w-next");
    await page.waitForSelector("#cr-report", { timeout: 10000 });
    await expect("the review shows the four properties on the map", async () => /On the map: 4 properties/.test(await page.$eval("#wiz", e => e.textContent)));
    const reportText = await page.$eval("#cr-report", e => e.textContent);
    await expect("nothing stops the atlas being drawn", async () => !/stop(s)? this atlas/.test(reportText));
    await expect("the things worth checking name the sheet and the row", async () => /Facts, market row/.test(reportText));
    await expect("the unsaved atlas is shown in a live preview", async () => {
      const f = page.frames().find(fr => /preview=1/.test(fr.url()));
      if (!f) throw new Error("no preview frame");
      await f.waitForFunction(() => document.querySelectorAll("#list .card").length === 4, null, { timeout: 20000 });
      return true;
    });
    await page.click('[data-edit="Options"]');
    await page.waitForSelector('#cr-planbox [data-tab="Options"].pri', { timeout: 10000 });
    await expect("Edit opens every sheet as a tab, on Options", async () => {
      const tabs = await page.$$eval("#cr-planbox [data-tab]", b => b.map(x => x.dataset.tab));
      return tabs[0] === "Atlas" && tabs.includes("Options") && tabs.includes("Places") && tabs.includes("json");
    });
    await expect("the four properties are editable rows", async () => (await page.$$('#cr-planbox input[data-c="Property name"]')).length === 4);
    /* Edit a cell and build again: what is typed is what the atlas holds. */
    await page.fill('#cr-planbox input[data-r="3"][data-c="Why it scores as it does"]', "Edited in the plan: newest stock, metro at the door.");
    await page.click("#cr-rebuild");
    await builtOnce();
    await page.click("#w-next");
    await page.waitForSelector('#cr-planbox input[data-c="Property name"]', { timeout: 10000 });
    await expect("an edit in the plan reaches the atlas", async () => /Edited in the plan/.test(await page.$eval('#cr-planbox input[data-r="3"][data-c="Why it scores as it does"]', e => e.value)));
    await page.click('#cr-planbox [data-tab="Places"]');
    await expect("each sheet is a tab of its own rows", async () => (await page.$$('#cr-planbox input[data-c="Name"]')).length === 22);
    await page.click('#cr-planbox [data-tab="json"]');
    await expect("the whole plan is there as JSON too", async () => { const j = JSON.parse(await page.inputValue("#cr-json")); return j["Options"].length === 4 && j["Places"].length === 22; });
    const post = (route, body) => page.evaluate(async ([route, body]) => (await fetch(`/api/cms?r=${route}`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-cms": "1" }, body: JSON.stringify(body) })).json(), [route, body]);
    await expect("without a model key, planning from a PDF says what is missing", async () => {
      const r = await post("bundle/plan", { files: [{ name: "x.pdf", file: btoa("%PDF-1.4 x") }] });
      if (!/ENGY_API_KEY or ANTHROPIC_API_KEY/.test(r.error || "")) throw new Error(JSON.stringify(r));
      return true;
    });
    await expect("and so does Enhance", async () => { const r = await post("bundle/enhance", { requirement: "120 seats" }); if (!/Enhance needs ENGY_API_KEY/.test(r.error || "")) throw new Error(JSON.stringify(r)); return true; });
    await expect("seven files are refused before anything is read", async () => /Up to 6 files/.test((await post("bundle/plan", { files: Array.from({ length: 7 }, (_, i) => ({ name: `f${i}.csv`, file: btoa("a,b") })) })).error || ""));
    await expect("a plan with nothing at all is refused with what to add", async () => /Options tab/.test((await post("bundle/build", { rows: { "Atlas": { "Title": "x" } } })).error || ""));
    await expect("a plan with only places builds, the places becoming the options", async () => {
      const r = await post("bundle/build", { rows: { "Atlas": { "Title": "Survey" }, "Places": [{ "ID": "awfis", "Kind": "flex", "Name": "Awfis, Skyline Icon", "Latitude": 19.119, "Longitude": 72.882 }] } });
      if (!(r.bundle && r.bundle.options.length === 1 && (r.notes || []).some(n => /became the options/.test(n)))) throw new Error(JSON.stringify(r).slice(0, 300));
      return true;
    });
    await expect("research without an Exa key leaves the plan as it is, with a note", async () => { const r = await post("bundle/research", { rows: { "Options": [{ "ID": "a", "Property name": "A" }] } }); return r.rows && r.rows["Options"].length === 1 && /EXA_API_KEY/.test((r.notes || [])[0]); });
    await page.click("#w-next");
    await page.waitForSelector("#lk-title", { timeout: 10000 });
    await expect("the look step takes the title from the data", async () => (await page.inputValue("#lk-title")) === "Andheri Flex Atlas");
    await expect("the house pattern is the cover until one is made", async () => !!(await page.$('.cover.on[data-cover=""]')));
    await page.click("#w-next");
    await page.waitForSelector("#cr-name", { timeout: 10000 });
    await expect("the name is prefilled from the workbook", async () => (await page.inputValue("#cr-name")) === "Andheri Flex Atlas");
    await expect("a password is made for you", async () => (await page.inputValue("#cr-pass")).length >= 10);
    await expect("the link id is derived from the title", async () => (await page.inputValue("#cr-slug")) === "andheri-flex-atlas");

    console.log("\n3. Named, credentialled, saved as a draft");
    await page.fill("#cr-slug", "andheri-flex");
    await page.fill("#cr-access", ACCESS);
    await page.fill("#cr-pass", PASS);
    await page.fill("#cr-who", "Shubham, for the Andheri pitch");
    await page.click("#cr-save");
    await page.waitForFunction(() => location.hash === "#/create/andheri-flex", { timeout: 15000 });
    await page.waitForSelector("#cr-publish:not([disabled])", { timeout: 15000 });
    await expect("the page reopens on the saved atlas", async () => /Andheri Flex Atlas/.test(await page.$eval(".hd h1", e => e.textContent)));
    await expect("it says the atlas is not yet published", async () => /Not published yet/.test(await page.$eval(".hd .sub", e => e.textContent)));
    await expect("the access ID is listed as active", async () => /ANDHERI-FLEX/.test(await page.$eval("table.t", e => e.textContent)));
    await expect("the saved draft keeps the plan it was built from, for Edit data", async () => {
      const p = await page.evaluate(async () => (await (await fetch("/api/cms?r=bundle/plan&link=andheri-flex", { credentials: "same-origin" })).json()));
      return p.from === "saved" && p.rows["Options"].length === 4 && p.type === "decide" && /Edited in the plan/.test(JSON.stringify(p.rows));
    });
    await expect("a reader never gets the plan", async () => {
      const r = await page.evaluate(async () => (await (await fetch("/api/cms?r=bundle&link=andheri-flex&draft=1", { credentials: "same-origin" })).json()));
      return r.bundle && r.bundle.options.length === 4 && r.bundle.plan === undefined && r.bundle.meta.layout === "decide";
    });
    await expect("the saved atlas offers Edit data", async () => !!(await page.$("#sh-edit")));
    await expect("the atlas is now in Atlas links as a workbook atlas", async () => {
      const r = await page.evaluate(async () => (await (await fetch("/api/cms?r=links", { credentials: "same-origin" })).json()).links.find(l => l.slug === "andheri-flex"));
      return r && r.kind === "bundle" && r.access_id === "ANDHERI-FLEX";
    });

    console.log("\n4. Preview, then publish");
    const prev = await ctx.newPage();
    await stubRoutes(prev);
    const prevErrors = [];
    prev.on("pageerror", e => prevErrors.push(e.message));
    await prev.goto(site.base + "/andheri-flex?draft=1", { waitUntil: "domcontentloaded" });
    await prev.waitForFunction(() => document.querySelector("#tabs") && document.querySelector("#tabs").children.length > 0, { timeout: 20000 }).catch(() => {});
    await expect("the draft preview renders for the signed-in admin", async () => (await prev.$$("#tabs [data-t]")).length >= 5 && (await prev.$$("#list .card")).length === 4);
    await expect("the preview has no page errors", async () => { if (prevErrors.length) throw new Error(prevErrors[0]); });
    await expect("the preview carries the flex layer", async () => /Flex/.test(await prev.$eval("#layers", e => e.textContent)));
    await prev.close();

    await page.click("#cr-publish");
    await page.waitForSelector("#pb-go", { timeout: 5000 });
    await page.fill("#pb-note", "First publish from the CMS");
    await page.click("#pb-go");
    await page.waitForFunction(() => /Live/.test((document.querySelector(".hd .sub") || {}).textContent || ""), { timeout: 15000 });
    await expect("it is live at version 1", async () => /version 1/.test(await page.$eval(".hd .sub", e => e.textContent)));
    await expect("version 1 is listed in the history with its note", async () => {
      const h = (await page.evaluate(async () => (await (await fetch("/api/cms?r=bundle/history&link=andheri-flex", { credentials: "same-origin" })).json())));
      return h.live === 1 && h.history.length === 1 && h.history[0].version === 1 && h.history[0].note === "First publish from the CMS" && /v1/.test(await page.$eval("#main", e => e.textContent));
    });
    await expect("the link's path is the atlas's own address", async () => {
      const r = await page.evaluate(async () => (await (await fetch("/api/cms?r=links", { credentials: "same-origin" })).json()).links.find(l => l.slug === "andheri-flex"));
      return r && r.path === "/andheri-flex";
    });
    await expect("a link id that names an existing page is refused", async () => {
      const r = await page.evaluate(async () => (await fetch("/api/cms?r=bundle/draft", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-cms": "1" }, body: JSON.stringify({ slug: "chennai", bundle: { meta: { title: "x" }, options: [] } }) })).json());
      return r && /already a page on this site/.test(r.error || "");
    });
    await expect("the sign-in details are shown once", async () => { const t = await page.$eval("#main", e => e.textContent); return t.includes(ACCESS) && t.includes(PASS); });

    console.log("\n5. A visitor signs in at the site root");
    await page.click("#nav-out");
    await page.waitForSelector("#l-email", { timeout: 10000 });
    await page.context().clearCookies();
    /* The client is a different person in a different browser. Two reasons
       it matters: the CMS does not count visits from a browser signed in to
       /admin/, and it drops any user agent that calls itself headless. */
    const clientCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" });
    const visitor = await clientCtx.newPage();
    const vErrors = [];
    visitor.on("pageerror", e => vErrors.push(e.message));
    await stubRoutes(visitor);
    await visitor.goto(site.base + "/", { waitUntil: "domcontentloaded" });
    await visitor.waitForSelector("#gateId", { timeout: 15000 });
    await visitor.fill("#gateId", "NOT-A-REAL-ID");
    await visitor.fill("#gatePass", "wrong");
    await visitor.press("#gatePass", "Enter");
    await visitor.waitForFunction(() => /Invalid/.test((document.querySelector("#gateErr") || {}).textContent || ""), { timeout: 10000 }).catch(() => {});
    await expect("a wrong ID is refused at the root", async () => /Invalid/.test(await visitor.$eval("#gateErr", e => e.textContent)));
    await visitor.fill("#gateId", ACCESS);
    await visitor.fill("#gatePass", PASS);
    await visitor.press("#gatePass", "Enter");
    await visitor.waitForURL(/\/andheri-flex$/, { timeout: 15000 });
    await expect("the root sends the visitor to /andheri-flex, the atlas's own address", async () => /\/andheri-flex$/.test(visitor.url()));
    await visitor.waitForFunction(() => document.querySelector("#tabs") && document.querySelector("#tabs").children.length > 0, { timeout: 20000 }).catch(() => {});
    /* The map loads after the panels render, as it does with real Mapbox, so
       wait for its layers rather than reading them the moment the tabs show. */
    await visitor.waitForFunction(() => Object.keys((window.__atlasMap || { _layers: {} })._layers || {}).length > 20, { timeout: 20000 }).catch(() => {});
    const seen = await visitor.evaluate(() => ({
      tabs: [...document.querySelectorAll("#tabs [data-t]")].map(e => e.dataset.t), cards: document.querySelectorAll("#list .card").length,
      title: document.title, gate: !!document.querySelector("#gate"), signout: !!document.querySelector("#signout"),
      mapLayers: Object.keys((window.__atlasMap || { _layers: {} })._layers || {}).length
    }));
    await expect("the published atlas renders with no sign-in form", async () => !seen.gate && seen.cards === 4 && seen.tabs.length >= 5);
    await expect(`the tabs are ${seen.tabs.join(", ")}`, async () => seen.tabs.includes("priorities") && seen.tabs.includes("places"));
    await expect("the page title is the atlas's own", async () => /Andheri Flex Atlas/.test(seen.title));
    await expect("the visitor has a sign-out button", async () => seen.signout);
    await expect(`the map got its ${seen.mapLayers} layers`, async () => seen.mapLayers > 20);
    await expect("no page errors for the visitor", async () => { if (vErrors.length) throw new Error(vErrors[0]); });
    await visitor.close(); await clientCtx.close(); await wait(600);
    await expect("the visit and the sign-in are recorded under the access ID", async () => {
      const ev = (JSON.parse(fs.readFileSync(STORE, "utf8")).tables.atlas_events || []).filter(e => e.link_slug === "andheri-flex");
      if (!ev.some(e => e.event === "view")) throw new Error(`no view event (have: ${ev.map(e => e.event).join(", ") || "none"})`);
      if (!ev.some(e => e.event === "signin" && e.access_id === "ANDHERIFLEX")) throw new Error(`no sign-in under the access ID (have: ${ev.map(e => e.event + ":" + e.access_id).join(", ")})`);
    });

    console.log("\n6. A visitor who goes straight to the atlas URL is asked to sign in");
    const stranger = await browser.newContext();
    const sp = await stranger.newPage();
    await stubRoutes(sp);
    await sp.goto(site.base + "/andheri-flex", { waitUntil: "domcontentloaded" });
    await sp.waitForFunction(() => (document.querySelector("#g-title") || {}).textContent === "Sign in", { timeout: 10000 }).catch(() => {});
    await expect("the engine page shows its own sign-in form to a stranger", async () => (await sp.$eval("#g-title", e => e.textContent)) === "Sign in" && (await sp.$$("#tabs [data-t]")).length === 0);
    await expect("the bundle is not served without a credential", async () => {
      const r = await sp.evaluate(async () => (await fetch("/api/cms?r=bundle&link=andheri-flex")).status);
      return r === 401;
    });
    await sp.fill("#g-id", ACCESS); await sp.fill("#g-pw", PASS); await sp.click("#g-go");
    await sp.waitForFunction(() => document.querySelector("#tabs") && document.querySelector("#tabs").children.length > 0, { timeout: 20000 }).catch(() => {});
    await expect("signing in on the engine page itself works too", async () => (await sp.$$("#list .card")).length === 4);
    await expect("the visitor's page shows no version number", async () => !/version\s*\d|\bv\d\b/i.test(await sp.$eval("body", e => e.textContent)));
    const old = await stranger.newPage(); await stubRoutes(old);
    await old.goto(site.base + "/engine/?atlas=andheri-flex", { waitUntil: "domcontentloaded" });
    await old.waitForFunction(() => document.querySelector("#tabs") && document.querySelector("#tabs").children.length > 0, { timeout: 20000 }).catch(() => {});
    await expect("the older /engine/?atlas= address still opens the same atlas", async () => (await old.$$("#list .card")).length === 4);
    await stranger.close();

    console.log("\n7. A case study on the same link, with the same credential");
    await page.goto(site.base + "/admin/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#l-email", { timeout: 10000 });
    await page.fill("#l-email", "shubham@autopilotoffices.com"); await page.fill("#l-pw", "owner-password-1"); await page.click("#f-login button[type=submit]");
    await page.waitForSelector("#nav", { timeout: 10000 });
    await page.goto(site.base + "/admin/#/case", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#cs-example", { timeout: 10000 });
    await expect("the nav has Create a case study", async () => /Create a case study/.test(await page.$eval("#nav", e => e.textContent)));
    await page.click("#cs-example");
    await page.waitForSelector("#cs-report .card", { timeout: 30000 });
    const csReport = await page.$eval("#cs-report", e => e.textContent);
    await expect("the Andheri case workbook is read: nothing stops it being drawn", async () => !/stop(s)? this/.test(csReport), csReport.slice(0, 200));
    await expect("the name is prefilled from the Case sheet", async () => (await page.inputValue("#cs-name")) === "Andheri Business Case Study 2026");
    await page.fill("#cs-slug", "andheri-flex");
    await page.click("#cs-save");
    await page.waitForFunction(() => location.hash === "#/case/andheri-flex", { timeout: 15000 });
    await page.waitForSelector("#cs-publish:not([disabled])", { timeout: 15000 });
    await expect("the case study joins the atlas's link, which keeps its kind", async () => {
      const r = await page.evaluate(async () => (await (await fetch("/api/cms?r=links", { credentials: "same-origin" })).json()).links.find(l => l.slug === "andheri-flex"));
      return r && r.kind === "bundle" && r.access_id === "ANDHERI-FLEX";
    });
    await expect("the pictures step lists the nine slots with their prompts", async () => (await page.$$("[data-prompt]")).length === 9 && /dusk/.test(await page.$eval('[data-prompt="cover"]', e => e.value)));
    await expect("without keys the picture and helper buttons are off and say why", async () => (await page.$$("[data-make]:disabled")).length === 9 && (await page.$$("[data-task]:disabled")).length === 6 && /HIGGSFIELD_API_KEY/.test(await page.$eval("#main", e => e.textContent)) && /ENGY_API_KEY or ANTHROPIC_API_KEY/.test(await page.$eval("#main", e => e.textContent)));
    await expect("the image and helper routes say what is missing", async () => {
      const post = (r, body) => page.evaluate(async ([r, body]) => (await (await fetch("/api/cms?r=" + r, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-cms": "1" }, body: JSON.stringify(body) })).json()).error, [r, body]);
      return /HIGGSFIELD/.test(await post("case/image", { slug: "andheri-flex", slot: "cover" })) && /ENGY_API_KEY or ANTHROPIC_API_KEY/.test(await post("case/assist", { slug: "andheri-flex", task: "means" })) && /not a picture slot/.test(await post("case/image", { slug: "andheri-flex", slot: "nope" }));
    });
    await expect("apply() folds a suggestion into the draft through the API", async () => {
      const r = await page.evaluate(async () => (await (await fetch("/api/cms?r=case/apply", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-cms": "1" }, body: JSON.stringify({ slug: "andheri-flex", suggestions: { copy: { deals: ["Deals line from the helper."] } } }) })).json()));
      const st = await page.evaluate(async () => (await (await fetch("/api/cms?r=case/status&link=andheri-flex", { credentials: "same-origin" })).json()));
      return r.ok && st.copyKeys.includes("deals");
    });
    const cprev = await ctx.newPage(); await stubRoutes(cprev);
    const cpErr = []; cprev.on("pageerror", e => cpErr.push(e.message));
    await cprev.goto(site.base + "/andheri-flex/case?draft=1", { waitUntil: "domcontentloaded" });
    await cprev.waitForSelector(".page", { timeout: 20000 });
    await expect("the draft preview draws the 39 pages for the signed-in admin, marked DRAFT", async () => (await cprev.$$(".page")).length === 39 && (await cprev.$eval("#bar-draft", e => getComputedStyle(e).display)) !== "none" && /Deals line from the helper/.test(await cprev.$eval("#deck", e => e.textContent)));
    await expect("the preview has no page errors", async () => { if (cpErr.length) throw new Error(cpErr[0]); });
    await cprev.close();
    await page.click("#cs-publish");
    await page.waitForSelector("#pb-go", { timeout: 5000 });
    await page.fill("#pb-note", "First case study"); await page.click("#pb-go");
    await page.waitForFunction(() => /Live/.test((document.querySelector(".hd .sub") || {}).textContent || ""), { timeout: 15000 });
    await expect("the case study is live at version 1 with its note in the history", async () => /version 1/.test(await page.$eval(".hd .sub", e => e.textContent)) && /First case study/.test(await page.$eval("#main", e => e.textContent)));
    await expect("the link keeps the atlas's name in Atlas links", async () => {
      await page.click('#nav a[href="#/links"]');
      /* The links page draws its header first and the table once the list
         has loaded; wait for the table with the seeded links in it. */
      await page.waitForFunction(() => location.hash === "#/links" && /Flipkart/.test((document.querySelector("#main table.t") || {}).textContent || ""), { timeout: 15000 });
      const t = await page.$eval("#main table.t", e => e.textContent);
      return /Andheri Flex Atlas/.test(t) && !/Andheri Business Case Study 2026/.test(t);
    });
    const reader = await browser.newContext({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" });
    const rp = await reader.newPage(); await stubRoutes(rp);
    const rpErr = []; rp.on("pageerror", e => rpErr.push(e.message));
    await rp.goto(site.base + "/andheri-flex/case", { waitUntil: "domcontentloaded" });
    await rp.waitForFunction(() => (document.querySelector("#g-title") || {}).textContent === "Sign in", { timeout: 10000 }).catch(() => {});
    await expect("a stranger at the case study's address is asked to sign in", async () => (await rp.$eval("#g-title", e => e.textContent)) === "Sign in" && (await rp.$$(".page")).length === 0);
    await rp.fill("#g-id", ACCESS); await rp.fill("#g-pw", PASS); await rp.click("#g-go");
    await rp.waitForSelector(".page", { timeout: 20000 });
    const rtext = await rp.$eval("#deck", e => e.textContent);
    await expect("the atlas's credential opens the case study: 39 pages with the costing's figures", async () => (await rp.$$(".page")).length === 39 && /₹21,560/.test(rtext) && /₹18,410/.test(rtext) && /83%/.test(rtext));
    await expect("the reader sees no version number and a Save as PDF button", async () => !/version\s*\d|\bv\d\b/i.test(rtext) && (await rp.$eval("#bar-draft", e => getComputedStyle(e).display)) === "none" && (await rp.$eval("#bar-pdf", e => e.textContent)) === "Save as PDF");
    await expect("no page errors for the reader", async () => { if (rpErr.length) throw new Error(rpErr[0]); });
    await reader.close();

    console.log("\n8. The system check");
    await page.goto(site.base + "/admin/#/system", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("tr[data-check]", { timeout: 30000 });
    await expect("the System check is in the nav and lists every check", async () => /System check/.test(await page.$eval("#nav", e => e.textContent)) && (await page.$$("tr[data-check]")).length >= 10);
    await expect("the PDF reader passes on the server", async () => (await page.$eval('tr[data-check="pdf"]', e => e.dataset.status)) === "ok");
    await expect("a missing key is named with its fix", async () => /ANTHROPIC_API_KEY/.test(await page.$eval('tr[data-check="ai"]', e => e.textContent)));

    await expect("no page errors in /admin/ throughout", async () => { if (errors.length) throw new Error(errors[0]); });
  } catch (e) {
    bad("the flow threw", e.stack.split("\n").slice(0, 3).join("\n"));
    /* What the page showed and what the server said, so a failure that
       only happens now and then can be read rather than guessed at. */
    try {
      const shot = path.join(SCRATCH, "flow-failure.png");
      await page.screenshot({ path: shot, fullPage: true });
      const seen = await page.evaluate(() => ({ url: location.href, toast: (document.querySelector("#toast") || {}).textContent || "", login: !!document.querySelector("#l-email"), nav: !!document.querySelector("#nav"), main: ((document.querySelector("#main") || document.body).textContent || "").replace(/\s+/g, " ").slice(0, 300) }));
      console.log(`        page: ${JSON.stringify(seen)}\n        screenshot: ${shot}\n        page errors: ${JSON.stringify(errors.slice(0, 3))}`);
      console.log(`        server log (end):\n${site.logs().split("\n").slice(-15).map(l => "          " + l).join("\n")}`);
    } catch (x) { console.log(`        (could not read the page: ${x.message})`); }
  } finally {
    await browser.close();
    site.child.kill();
  }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
