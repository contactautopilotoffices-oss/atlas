#!/usr/bin/env node
/* ============================================================================
   ATLAS · the "create an atlas" walkthrough, as a PDF

     node scripts/docs/walkthrough.js [out-dir]

   Starts a local copy of the site with an empty, throwaway CMS store and
   drives it in headless Chromium exactly as a team member would: first
   owner, the workbook, the report, the credential, preview, publish, and a
   client signing in at the site root. Every step is screenshotted, and the
   screenshots are laid out with what happened behind each one into
   atlas-walkthrough.pdf.

   The map. This environment cannot reach Mapbox or any tile server, so the
   map area is drawn as a schematic from the atlas's own data (the pins in
   their true relative positions, nothing more) and every image that shows
   it says so. The live atlas draws the same pins on Mapbox satellite.
   ============================================================================ */
"use strict";
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { chromium } = require("playwright");
const mapboxStub = require("../lib/mapbox-stub");
const { readWorkbook } = require("../lib/workbook");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "docs-out"));
const SHOTS = path.join(OUT, "shots");
const WORKBOOK = path.join(ROOT, "examples", "andheri-flex.xlsx");
const PDFS = {
  flex: "/root/.claude/uploads/a782f7d2-741e-50cc-bf66-a269b63e86ec/d9163ca8-Flex_Operators_Overview__in_Andheri.pdf",
  inventory: "/root/.claude/uploads/a782f7d2-741e-50cc-bf66-a269b63e86ec/23e50009-Proposed_Inventory.pdf"
};
const ACCESS = "ANDHERI-FLEX", PASS = "Flex-Andheri-2026";
fs.mkdirSync(SHOTS, { recursive: true });

const wait = (ms) => new Promise(ok => setTimeout(ok, ms));
const freePort = () => new Promise(ok => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

async function startSite() {
  const port = await freePort();
  const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "atlas-doc-")), "store.json");
  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "atlas-dev.js")], { env: { ...process.env, PORT: String(port), CMS_DEV_STORE: store }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; child.stdout.on("data", d => log += d); child.stderr.on("data", d => log += d);
  for (let i = 0; i < 60 && !/ATLAS at/.test(log); i++) await wait(100);
  if (!/ATLAS at/.test(log)) { child.kill(); throw new Error("site did not start\n" + log); }
  return { base: `http://127.0.0.1:${port}`, child };
}
async function stub(page) {
  await page.route("**/*", async route => {
    const url = route.request().url();
    if (/\/config\.js/.test(url)) return route.fulfill({ contentType: "text/javascript", body: 'window.MAPBOX_TOKEN = "pk.doc";' });
    if (/mapbox-gl\.js/.test(url)) return route.fulfill({ contentType: "text/javascript", body: mapboxStub() });
    if (/mapbox-gl\.css|fonts\.googleapis|fonts\.gstatic/.test(url)) return route.fulfill({ contentType: "text/css", body: "" });
    if (/buildings_geo|bkc_buildings|mapbox_app/.test(url)) return route.fulfill({ contentType: "text/javascript", body: "" });
    if (/arcgisonline|api\.mapbox\.com|\/media\//.test(url)) return route.fulfill({ status: 200, contentType: "image/gif", body: GIF });
    return route.continue();
  });
}

/* The schematic: the atlas's own pins, drawn into the map area at their true
   relative positions, labelled for what it is. */
async function schematic(page) {
  await page.evaluate(() => {
    const A = window.ATLAS; const host = document.getElementById("map");
    if (!A || !host || host.querySelector("canvas.doc-schematic")) return;
    const W = host.clientWidth, H = host.clientHeight, dpr = 2;
    const c = document.createElement("canvas"); c.className = "doc-schematic";
    c.width = W * dpr; c.height = H * dpr; Object.assign(c.style, { position: "absolute", inset: "0", width: W + "px", height: H + "px", zIndex: 0 });
    const g = c.getContext("2d"); g.scale(dpr, dpr);
    g.fillStyle = "#e9e4dc"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(120,100,80,.10)"; g.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const pts = [...(A.options || []), ...(A.places || []), ...((A.transit && A.transit.lines) || []).flatMap(l => l.stations)];
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    /* Keep the map inside the strip the panes leave open. */
    const L = 380, R = W - 560, T = 120, B = H - 70;
    const k = Math.min((R - L) / ((maxLng - minLng) * Math.cos(minLat * Math.PI / 180) || 1), (B - T) / (maxLat - minLat || 1));
    const cx = (L + R) / 2, cy = (T + B) / 2, mLng = (minLng + maxLng) / 2, mLat = (minLat + maxLat) / 2;
    const P = (p) => [cx + (p.lng - mLng) * Math.cos(minLat * Math.PI / 180) * k, cy - (p.lat - mLat) * k];
    for (const l of ((A.transit && A.transit.lines) || [])) {
      g.strokeStyle = l.color || "#1d6fa5"; g.lineWidth = 3; g.globalAlpha = .55; g.beginPath();
      l.stations.forEach((s, i) => { const [x, y] = P(s); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.globalAlpha = 1;
      for (const s of l.stations) { const [x, y] = P(s); g.fillStyle = "#fff"; g.strokeStyle = l.color || "#1d6fa5"; g.lineWidth = 2; g.beginPath(); g.rect(x - 4, y - 4, 8, 8); g.fill(); g.stroke(); }
    }
    for (const p of (A.places || [])) { const [x, y] = P(p); g.fillStyle = "#8a3d6b"; g.globalAlpha = .75; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.globalAlpha = 1; }
    const fitCol = { ready: "#2e7d5b", "late-2026": "#b7791f", "early-2027": "#7b6a5c" };
    for (const o of (A.options || [])) {
      const [x, y] = P(o); g.fillStyle = fitCol[o.fit] || "#a3502c"; g.strokeStyle = "#fff"; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.stroke();
      g.font = "600 12px system-ui, sans-serif"; g.lineWidth = 4; g.strokeStyle = "rgba(255,255,255,.9)"; g.fillStyle = "#2a1e16";
      g.strokeText(o.name, x + 14, y + 4); g.fillText(o.name, x + 14, y + 4);
    }
    g.font = "500 11px ui-monospace, monospace"; g.fillStyle = "rgba(42,30,22,.7)";
    g.fillText("SCHEMATIC FOR THIS DOCUMENT · pins at true relative positions · the live atlas draws these on Mapbox satellite", L, H - 30);
    host.style.background = "#e9e4dc";
    host.prepend(c);
  });
}

const steps = [];
async function shot(page, id, title, body, opts = {}) {
  const file = path.join(SHOTS, `${String(steps.length + 1).padStart(2, "0")}-${id}.jpg`);
  if (opts.selector) await (await page.$(opts.selector)).screenshot({ path: file, type: "jpeg", quality: 82 });
  else await page.screenshot({ path: file, type: "jpeg", quality: 82, fullPage: !!opts.full });
  steps.push({ id, title, body, file, section: opts.section, map: !!opts.map });
  console.log(`  ${String(steps.length).padStart(2)}  ${title}`);
}
const section = (name) => steps.push({ sectionHeading: name });

/* The workbook as it looks when opened, for the document. */
async function workbookPreview(browser) {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(WORKBOOK);
  const sheetHTML = (name, maxRows, maxCols) => {
    const ws = wb.getWorksheet(name); const rows = [];
    for (let r = 3; r <= Math.min(ws.rowCount, 3 + maxRows); r++) {
      const cells = []; for (let c = 1; c <= Math.min(ws.columnCount, maxCols); c++) { const v = ws.getRow(r).getCell(c).value; cells.push(v == null ? "" : typeof v === "object" ? (v.text || v.result || "") : String(v)); }
      if (cells.some(x => x !== "")) rows.push(cells);
    }
    const esc = (s) => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    return `<div class="tab">${name}</div><table>${rows.map((r, i) => `<tr class="${i === 0 ? "h" : /^example/i.test(r[0]) || /^Example/.test(r[0]) ? "eg" : ""}">${r.map(c => `<td>${esc(c).slice(0, 60)}</td>`).join("")}</tr>`).join("")}</table>`;
  };
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const css = `body{font:12px system-ui,sans-serif;margin:0;padding:18px;background:#fff}.tab{display:inline-block;background:#1d6f42;color:#fff;padding:4px 12px;border-radius:4px 4px 0 0;font-weight:600;margin-top:14px}
    table{border-collapse:collapse;width:100%}td{border:1px solid #d0d7de;padding:4px 6px;white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis}tr.h td{background:#fbe8d8;font-weight:700}tr.eg td{color:#9a8b7e;font-style:italic}`;
  for (const [name, rows, cols, id, title, body] of [
    ["Options", 5, 14, "wb-options", "The Options sheet, filled from Proposed_Inventory.pdf",
      "One row per proposed building. The first row under the heading is the template's example; it starts with the word \"example\" and is skipped on upload. The four real rows carry the PDF's figures. Columns the template did not have (rent on carpet, CAM, approvals, months until available) were added as new columns and are kept on the property card."],
    ["Places", 9, 9, "wb-places", "The Places sheet, filled from Flex_Operators_Overview__in_Andheri.pdf",
      "Each flex centre is a row of kind \"flex\", which becomes one switchable map layer. The PDF gives operator, building, micro-market, price per seat and grade, all typed in. It gives no coordinates: those were taken from the committed Andheri study, which had already placed the same operators with a source per pin."],
    ["Priorities", 6, 11, "wb-priorities", "The Priorities sheet: the sliders a client moves",
      "Five sliders. Three read a column on the Options sheet by its heading (rent, carpet area, months until available), one measures the walk to an open metro station, one counts flex centres nearby. Presets on the next sheet set them to named starting points such as Keep cost down and Move in now."]
  ]) {
    await page.setContent(`<style>${css}</style>${sheetHTML(name, rows, cols)}`);
    await shot(page, id, title, body, { full: true });
  }
  await page.close();
}

(async () => {
  console.log(`Capturing into ${OUT}`);
  const site = await startSite();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage(); await stub(page);
  const errors = []; page.on("pageerror", e => errors.push(e.message));

  try {
    /* ---------------- the input ---------------- */
    section("The input");
    const srcDir = path.join(OUT, "src"); fs.mkdirSync(srcDir, { recursive: true });
    for (const [k, f] of Object.entries(PDFS)) {
      if (!fs.existsSync(f)) continue;
      execFileSync("pdftoppm", ["-jpeg", "-r", "90", "-f", "1", "-l", "1", f, path.join(srcDir, k)]);
      const png = fs.readdirSync(srcDir).find(x => x.startsWith(k));
      steps.push({ id: "src-" + k, file: path.join(srcDir, png), narrow: true,
        title: k === "flex" ? "What arrived: Flex_Operators_Overview__in_Andheri.pdf" : "What arrived: Proposed_Inventory.pdf",
        body: k === "flex" ? "Twenty-four coworking and managed-office centres across Andheri East: operator, building, micro-market, price per seat and grade. No coordinates." : "Four buildings being proposed, side by side: floors, grade, furnishing, carpet and built-up area, rent, CAM, parking, approvals, when each is available and the nearest metro. No coordinates." });
      console.log(`  ${String(steps.length).padStart(2)}  ${steps[steps.length - 1].title}`);
    }
    await workbookPreview(browser);

    /* ---------------- first sign-in ---------------- */
    section("Signing in to the CMS");
    await page.goto(site.base + "/admin/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#s-key", { timeout: 15000 });
    await page.fill("#s-key", "dev-setup"); await page.fill("#s-name", "Shubham"); await page.fill("#s-email", "shubham@autopilotoffices.com"); await page.fill("#s-pw", "owner-password-1");
    await shot(page, "setup", "First visit: the CMS asks for its owner",
      "With no accounts yet, /admin/ shows this once. The setup key is CMS_SETUP_KEY from Vercel. On the live site this has already been done; every later visit shows a plain email and password sign-in instead.");
    await page.click("#f-setup button[type=submit]");
    await page.waitForSelector("#nav a.it", { timeout: 15000 }); await wait(600);
    await shot(page, "dashboard", "Signed in: the dashboard",
      "Visitors, sessions, sign-ins and time spent across every Atlas link. Note \"Create an atlas\" in the left nav: that is the new page this work adds.");
    await page.click('#nav a[href="#/links"]'); await page.waitForSelector("table.t", { timeout: 10000 }); await wait(300);
    await shot(page, "links-before", "Atlas links, before",
      "Every link shipped so far. Each of these was made by a developer: a folder of code, a credential typed into a script, and a deploy. The one we are about to make will appear here without any of that.");

    /* ---------------- create ---------------- */
    section("Creating the atlas");
    await page.click('#nav a[href="#/create"]'); await page.waitForSelector("#cr-file", { state: "attached" }); await wait(300);
    await shot(page, "create-empty", "Create an atlas: three steps on one page",
      "Step 1 offers the empty workbook as a download and takes a filled one back. Steps 2 and 3 open up once a workbook has passed its checks.");
    await page.setInputFiles("#cr-file", WORKBOOK);
    await page.waitForSelector("#cr-report .card", { timeout: 20000 }); await wait(300);
    await page.evaluate(() => document.querySelector("#cr-report").scrollIntoView({ block: "start" })); await page.evaluate(() => window.scrollBy(0, -140)); await wait(200);
    await shot(page, "report", "The upload is read and checked, in plain words",
      "Nothing stops this atlas being drawn. Seven things are worth fixing and are named by sheet and row: three micro-markets hold no proposed building, and four facts carry no source link. The contents line confirms 4 options, 6 micro-markets, 2 metro lines, 22 flex centres and 5 sliders. The seven template example rows were skipped and reported, so none of them can reach a client.");
    await page.fill("#cr-slug", "andheri-flex"); await page.fill("#cr-access", ACCESS); await page.fill("#cr-pass", PASS); await page.fill("#cr-who", "Shubham, for the Andheri pitch");
    await page.evaluate(() => document.querySelector("#cr-name").scrollIntoView({ block: "center" })); await wait(200);
    await shot(page, "details", "Name, link id and a credential",
      "The name was prefilled from the workbook's title. The link id is permanent. The access ID and password are what the client will type at atlas.autopilotoffices.com. The password is hashed with scrypt on the server and is never stored or shipped as text. Generate makes a strong one.");
    await page.click("#cr-save");
    await page.waitForFunction(() => location.hash === "#/create/andheri-flex", { timeout: 15000 });
    await page.waitForSelector("#cr-publish:not([disabled])", { timeout: 15000 }); await wait(400);
    await shot(page, "draft", "Saved as a draft",
      "The atlas now exists as a link, not yet published. The access ID is listed as active, with who it was issued to. Several can be issued for one atlas, one per person, so the dashboard's per-ID figures each mean one person. Any of them can be revoked here.", { full: true });

    /* ---------------- preview ---------------- */
    section("Preview and publish");
    const prev = await ctx.newPage(); await stub(prev);
    await prev.goto(site.base + "/andheri-flex?draft=1", { waitUntil: "domcontentloaded" });
    await prev.waitForFunction(() => document.querySelector("#tabs") && document.querySelector("#tabs").children.length > 0, { timeout: 20000 });
    await wait(800); await schematic(prev);
    await shot(prev, "preview", "Preview draft: exactly what the client will see",
      "Opened from the Preview button, in a new tab, as the signed-in admin. The list on the left is the four buildings, the panel on the right is the Overview, the chips at the bottom switch map layers on and off, including the 22 flex centres.", { map: true });
    await prev.close();

    await page.click("#cr-publish"); await page.waitForSelector("#pb-go"); await wait(200);
    await page.fill("#pb-note", "First publish from the CMS");
    await shot(page, "confirm", "Publish asks once, and keeps a note",
      "Only an admin can publish. It goes live within about half a minute, as version 1. Every publish is kept, with who did it, when, and this note; any earlier version can be made live again from the same page. The client never sees a version number.");
    await page.click("#pb-go");
    await page.waitForFunction(() => /Live/.test((document.querySelector(".hd .sub") || {}).textContent || ""), { timeout: 15000 }); await wait(400);
    await page.evaluate(() => { const c = [...document.querySelectorAll(".card")].find(e => /^Live\./.test(e.textContent.trim())); if (c) c.scrollIntoView({ block: "center" }); }); await wait(200);
    await shot(page, "live", "Live, version 1",
      "The page says what to send the client: the site address, the access ID and the password, with a button that copies all three. Uploading a revised workbook later makes a new draft; the live version stays as it is until the next publish.");
    await page.click('#nav a[href="#/links"]'); await page.waitForSelector("table.t"); await wait(400);
    await shot(page, "links-after", "Atlas links, after",
      "Andheri Flex Atlas is listed alongside the committed links, as \"From a workbook\", with its access ID. Its Open button returns to the page above; the visitor and time figures fill in as the client uses it.");

    /* ---------------- the client ---------------- */
    section("The client signs in");
    await page.click("#nav-out"); await page.waitForSelector("#l-email");
    /* The client is someone else, on their own machine. Their own browser
       matters here: the CMS does not count visits from a browser that has
       signed in to /admin/, so a shared one would show nothing. */
    /* An ordinary desktop browser identity too: the tracker drops anything
       that calls itself headless, as a bot. */
    const clientCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" });
    const v = await clientCtx.newPage(); await stub(v);
    await v.goto(site.base + "/", { waitUntil: "domcontentloaded" }); await v.waitForSelector("#gateId"); await wait(600);
    await v.fill("#gateId", ACCESS); await v.fill("#gatePass", PASS);
    await shot(v, "root", "atlas.autopilotoffices.com, as every client sees it",
      "The same sign-in page as today. The ID is not in the site's script of client credentials, so the page asks the server, which checks the password against the hash the CMS stored and replies with where to go.");
    await v.press("#gatePass", "Enter");
    await v.waitForURL(/\/andheri-flex$/, { timeout: 15000 });
    await v.waitForFunction(() => document.querySelector("#tabs") && document.querySelector("#tabs").children.length > 0, { timeout: 20000 });
    await wait(900); await schematic(v);
    await shot(v, "atlas-overview", "Signed in: the published atlas",
      "The client lands here. The title, the four buildings, the micro-markets, the metro lines, the flex centres and the five sliders all come from the workbook. No part of this page was written for Andheri.", { map: true });
    for (const [tab, title, body] of [
      ["priorities", "Your priorities: the client re-ranks the buildings",
        "The five sliders from the Priorities sheet, with the four presets. Move a slider and the ranking, the pins and the conclusion all follow. This is the scoring model that used to be code written for one study, now declared in a spreadsheet."],
      ["places", "Places nearby: the flex market around each building",
        "One column per kind of place in the workbook. Here there is one kind, flex, so each building is scored on how many flex centres sit within reach."],
      ["compare", "Compare all: every building, every measure",
        "Every declared column becomes a row, with the best value in each row shaded. Rent on carpet, carpet area and months until available come straight from Proposed_Inventory.pdf."]
    ]) {
      await v.click(`#tabs [data-t="${tab}"]`); await wait(700);
      await shot(v, tab, title, body, { map: tab !== "compare" });
      await v.evaluate(() => { const c = document.querySelector("#cmp"); if (c) c.classList.remove("on"); });
    }
    await v.click("#list .card"); await wait(800);
    await shot(v, "option", "One building, opened",
      "Corporate Avenue's card: the reason it ranks first, its figures from the PDF, its fit part by part against the client's priorities, and the flex centres within each drive-time ring.", { map: true });
    /* Leave long enough for a heartbeat, then close the tab so the
       session's events are sent. */
    await wait(31000);
    await v.close(); await clientCtx.close();

    const stranger = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
    const s = await stranger.newPage(); await stub(s);
    await s.goto(site.base + "/andheri-flex", { waitUntil: "domcontentloaded" });
    await s.waitForFunction(() => (document.querySelector("#g-title") || {}).textContent === "Sign in", { timeout: 10000 }); await wait(400);
    await shot(s, "stranger", "Anyone else who has the link is asked to sign in",
      "The atlas URL on its own opens nothing. The server refuses the data without a valid credential, so the page shows its own sign-in form and the same ID and password work here too.");
    await stranger.close();

    /* ---------------- the dashboard ---------------- */
    section("Tracking");
    const back = await ctx.newPage(); await stub(back);
    await back.goto(site.base + "/admin/", { waitUntil: "domcontentloaded" }); await back.waitForSelector("#l-email");
    await back.fill("#l-email", "shubham@autopilotoffices.com"); await back.fill("#l-pw", "owner-password-1"); await back.click("#f-login button[type=submit]");
    await back.waitForSelector("#nav a.it");
    await back.waitForFunction(() => /ANDHERI-?FLEX/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
    await wait(800);
    await shot(back, "tracked", "Back in the CMS: the client's visit is counted",
      "The client's visit, their sign-in under ANDHERI-FLEX, the time they spent and the tabs they opened are recorded against the new link, exactly as for the committed studies, because the atlas boots through the same tracking script. Your own visits from a browser signed in to /admin/ are left out on purpose.", { full: true });
    await back.close();
  } finally {
    await browser.close(); site.child.kill();
  }
  if (errors.length) console.log("page errors during capture:\n  " + errors.join("\n  "));

  /* ---------------- the document ---------------- */
  const b = (await readWorkbook(WORKBOOK)).bundle;
  const img = (f) => "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64");
  const esc = (t) => String(t).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  let n = 0;
  const body = steps.map(st => st.sectionHeading
    ? `<h2 class="sec">${esc(st.sectionHeading)}</h2>`
    : `<figure class="${st.narrow ? "narrow" : ""}"><div class="num">${++n}</div><h3>${esc(st.title)}</h3><img src="${img(st.file)}"><figcaption>${esc(st.body)}${st.map ? ` <span class="mapnote">The grey map area is a schematic drawn for this document: no map service is reachable from where it was captured.</span>` : ""}</figcaption></figure>`).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Creating an Atlas from the CMS</title><style>
    @page{size:A4;margin:16mm 14mm}
    body{font:10.5pt/1.5 "Helvetica Neue",Helvetica,Arial,sans-serif;color:#2a1e16;margin:0}
    .cover{height:255mm;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
    .cover .eye{font:600 9pt monospace;letter-spacing:.18em;color:#a3502c;text-transform:uppercase}
    .cover h1{font:600 32pt Georgia,serif;margin:10px 0 14px;line-height:1.1}
    .cover p{font-size:12pt;max-width:150mm;color:#4a3a2e}
    .cover .meta{margin-top:24px;font-size:9.5pt;color:#7b6a5c}
    h2{font:600 18pt Georgia,serif;margin:0 0 8px}
    h2.sec{page-break-before:always;border-bottom:2px solid #a3502c;padding-bottom:6px;margin-bottom:14px}
    h3{font-size:12pt;margin:0 0 6px}
    figure{margin:0 0 16px;page-break-inside:avoid;position:relative;padding-left:30px}
    figure .num{position:absolute;left:0;top:0;width:22px;height:22px;border-radius:50%;background:#a3502c;color:#fff;font:700 10pt sans-serif;text-align:center;line-height:22px}
    figure img{width:100%;border:1px solid #d9cfc3;border-radius:4px;display:block}
    figure.narrow img{width:70%}
    figcaption{margin-top:6px;font-size:10pt;color:#3d2f24}
    .mapnote{display:block;margin-top:3px;font-size:8.5pt;color:#8a7a6c;font-style:italic}
    .summary{page-break-after:always}
    .summary ol{padding-left:20px}.summary li{margin-bottom:6px}
    table.k{border-collapse:collapse;width:100%;font-size:9.5pt;margin:8px 0 14px}table.k td,table.k th{border:1px solid #d9cfc3;padding:5px 7px;text-align:left;vertical-align:top}table.k th{background:#f3ede6}
    .box{border-left:3px solid #a3502c;background:#faf6f1;padding:8px 12px;margin:10px 0}
  </style></head><body>
  <section class="cover"><div class="eye">Autopilot ATLAS · CMS walkthrough</div>
    <h1>Creating an Atlas<br>from the CMS, with no code</h1>
    <p>Two PDFs arrive. A team member turns them into a published, password-protected atlas a client opens at atlas.autopilotoffices.com, entirely from /admin/. This is that process, step by step, captured from the running site.</p>
    <div class="meta">Example: the Andheri Flex Atlas · ${b.options.length} proposed buildings · ${b.places.length} flex centres · ${b.transit.lines.length} metro lines · ${b.measures.length} sliders<br>Captured ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} from a local copy of the site with an empty CMS</div></section>
  <section class="summary"><h2>The process in one page</h2>
    <ol>
      <li><b>Sign in</b> to atlas.autopilotoffices.com/admin/.</li>
      <li><b>Create an atlas</b> in the left nav, then <b>Download the empty workbook</b>.</li>
      <li><b>Fill it in</b> from what you were given. Only the Atlas and Options sheets are required; each other sheet adds a section.</li>
      <li><b>Upload it.</b> Read the report: problems must be fixed in the workbook and re-uploaded; warnings may be left.</li>
      <li><b>Name it</b>, choose a link id, and give it an <b>access ID and password</b>. Save as draft.</li>
      <li><b>Preview draft</b>, then <b>Publish</b> (admin only).</li>
      <li><b>Send the client</b> atlas.autopilotoffices.com with the access ID and password.</li>
    </ol>
    <h3>Where a person still does work</h3>
    <table class="k"><tr><th>Step</th><th>Why it is still manual</th></tr>
      <tr><td>Typing the PDFs into the workbook</td><td>Nothing reads a PDF yet. About 15 minutes for these two.</td></tr>
      <tr><td>Placing every building on the map</td><td>Neither PDF carries a coordinate. The validator names every row without one, but each must be looked up. For this atlas the 26 positions came from the committed Andheri study, which had already placed the same buildings with a source per pin.</td></tr>
      <tr><td>Photographs</td><td>Files, not rows; the workbook does not carry them.</td></tr></table>
    <h3>Before it works on the live site</h3>
    <div class="box">Run <b>supabase/migrations/015_register_andheri_whitefield.sql</b>, <b>016_bundles.sql</b> and <b>017_bundle_history.sql</b> in the Supabase SQL editor. Until then the Create an atlas page is not on the live site. Everything shown here was captured from that code running locally.</div>
  </section>
  ${body}
  <h2 class="sec">What is behind each screen</h2>
  <table class="k">
    <tr><th>What you did</th><th>What happened</th></tr>
    <tr><td>Uploaded the workbook</td><td>The browser sends the file to <b>/api/cms?r=bundle/import</b>. The server reads every sheet by its column headings into one bundle and runs the same checks the engine relies on. Nothing is saved at this point.</td></tr>
    <tr><td>Saved as draft</td><td><b>bundle/draft</b> stores the bundle in the <b>atlas_bundles</b> table and adds a row of kind "bundle" to <b>atlas_links</b>. <b>access/issue</b> stores the access ID in <b>atlas_access</b> with an scrypt hash of the password.</td></tr>
    <tr><td>Previewed</td><td>/andheri-flex?draft=1 asks <b>bundle</b> for the draft, which only a signed-in admin may read, and the engine draws it.</td></tr>
    <tr><td>Published</td><td><b>bundle/publish</b> copies the draft to the live slot, raises the version and keeps a copy in <b>atlas_bundle_history</b>. <b>bundle/rollback</b> makes any earlier copy live again.</td></tr>
    <tr><td>The client signed in at the root</td><td>The ID is not in clients/manifest.js, so the page posts it to <b>/api/cms?r=access</b>. The server checks the hash, locks the ID for 15 minutes after five wrong passwords, sets a cookie that names this one atlas, and replies with its address.</td></tr>
    <tr><td>The atlas opened</td><td>engine/load.js asks for the live bundle; the server returns it only with that cookie. The engine renders it and the CMS tracking script records the visit under the access ID.</td></tr>
  </table>
  <p style="font-size:9pt;color:#7b6a5c">Rebuild this document with <b>node scripts/docs/walkthrough.js</b>. The same sequence runs as a test with <b>npm run test:flow</b>.</p>
  </body></html>`;
  const htmlFile = path.join(OUT, "atlas-walkthrough.html");
  fs.writeFileSync(htmlFile, html);
  const pb = await chromium.launch(); const pp = await pb.newPage();
  await pp.goto("file://" + htmlFile, { waitUntil: "load" });
  const pdf = path.join(OUT, "atlas-walkthrough.pdf");
  await pp.pdf({ path: pdf, format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: '<div style="font:8px Helvetica,Arial;color:#9a8b7e;width:100%;padding:0 14mm;display:flex;justify-content:space-between"><span>Autopilot ATLAS · Creating an Atlas from the CMS</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" } });
  await pb.close();
  console.log(`\nWrote ${pdf} (${Math.round(fs.statSync(pdf).size / 1024)} KB)`);
})().catch(e => { console.error(e.stack); process.exit(1); });
