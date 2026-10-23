#!/usr/bin/env node
/* ============================================================================
   ATLAS · the PDF path, end to end, with no key and no network

     node scripts/pdf-import.test.js

   Builds a one-page inventory PDF the way a broker's would look (a table of
   buildings with no coordinates), reads it with the same code the CMS uses,
   hands the text to a stand-in model that answers the way the real one is
   told to, geocodes through a stand-in Mapbox, and checks that what comes
   out is a workbook a person could open and a bundle the engine can draw.
   ============================================================================ */
"use strict";
const path = require("path");
const os = require("os");
const fs = require("fs");
const { chromium } = require("playwright");
const { pdfText, importPdf, fillWorkbook, parseJSON, sheetGuide, askModel, scanNote } = require("../api/cms/_pdf");
const { readWorkbook } = require("./lib/workbook");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`); } };

const HTML = `<!doctype html><meta charset="utf-8"><style>body{font:12px Arial;margin:30px}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 10px}</style>
<h1>Proposed Inventory</h1>
<table><tr><th>Building Name</th><th>Corporate Avenue</th><th>723 Avenue</th></tr>
<tr><td>Location</td><td>Andheri East</td><td>Andheri East</td></tr>
<tr><td>Micro - Market</td><td>Chakala</td><td>Marol</td></tr>
<tr><td>Grade</td><td>A</td><td>A</td></tr>
<tr><td>Carpet Area sq.ft</td><td>12414</td><td>12952</td></tr>
<tr><td>Rent</td><td>Rs. 300 on CA</td><td>Rs. 316 on CA</td></tr>
<tr><td>Nearest Metro</td><td>Chakala, 800 m</td><td>Marol Naka, 350 m</td></tr></table>
<h2>Flex operators nearby</h2>
<table><tr><th>Operator</th><th>Building</th><th>Location</th><th>Pricing</th></tr>
<tr><td>AWFIS</td><td>Skyline Icon</td><td>Marol</td><td>Rs. 13000 per seat + taxes</td></tr>
<tr><td>WeWork</td><td>Light Bridge</td><td>Chandivali</td><td>Rs. 25000 per seat + taxes</td></tr></table>`;

/* What the real model is told to return: the workbook's own headings, no
   coordinates, figures as numbers in extra columns. */
const FAKE_ROWS = {
  "Atlas": { "Title": "Proposed Inventory, Andheri East", "Data current to": "2026-10", "City": "Mumbai" },
  "Micro-markets": [{ "Key": "chakala", "Short name": "Chakala" }, { "Key": "marol", "Short name": "Marol" }],
  "Options": [
    { "ID": "corporate-avenue", "Property name": "Corporate Avenue", "Address": "Andheri East, Mumbai", "Locality": "Andheri East", "Micro-market": "chakala", "Grade": "A", "Carpet area (sq ft)": 12414, "Rent on carpet (Rs per sq ft)": 300, "Nearest metro": "Chakala", "Metro distance (m)": 800 },
    { "ID": "723-avenue", "Property name": "723 Avenue", "Address": "Marol, Andheri East, Mumbai", "Locality": "Marol", "Micro-market": "marol", "Grade": "A", "Carpet area (sq ft)": 12952, "Rent on carpet (Rs per sq ft)": 316, "Nearest metro": "Marol Naka", "Metro distance (m)": 350 },
  ],
  "Places": [
    { "ID": "awfis-skyline-icon", "Kind": "flex", "Name": "AWFIS, Skyline Icon", "Second line": "Rs 13,000 per seat + taxes", "Address": "Marol, Andheri East, Mumbai" },
    { "ID": "wework-light-bridge", "Kind": "flex", "Name": "WeWork, Light Bridge", "Second line": "Rs 25,000 per seat + taxes", "Address": "Chandivali, Mumbai" },
    { "ID": "nowhere", "Kind": "flex", "Name": "A centre with no address" },
  ],
  "Facts": [{ "Group": "market", "Label": "Flex price range", "Value": "Rs 13,000 to 25,000 per seat", "Source": "Proposed Inventory PDF" }],
};
const GEO = { "corporate avenue": [72.8625, 19.1065, "street"], "723 avenue": [72.8798, 19.1127, "locality"], "awfis": [72.8803, 19.1092, "locality"], "wework": [72.8771, 19.1038, "locality"] };
const fakeGeocoder = async (q) => { const k = Object.keys(GEO).find(k => q.toLowerCase().includes(k)); return k ? { lng: GEO[k][0], lat: GEO[k][1], precision: GEO[k][2], label: q } : null; };

(async () => {
  console.log("\nPDF import");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-pdf-"));
  const pdfPath = path.join(dir, "inventory.pdf");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(HTML);
  await page.pdf({ path: pdfPath, format: "A4" });
  /* Three pages the way they turn up: text, a blank last page (Google Docs
     leaves these), and a page that is only a picture (a scan). */
  await page.setContent(`<body style="margin:0"><div style="font:14px Arial;padding:40px">Flex operators in Andheri, with prices and grades for every centre on the list.</div>
    <div style="page-break-before:always;height:10px"></div><div style="page-break-before:always"><img id="scan" width="500" height="300"></div></body>`);
  await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 500; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#ddd"; g.fillRect(0, 0, 500, 300); g.fillStyle = "#333"; g.font = "28px Arial"; g.fillText("A scanned page", 40, 150); document.getElementById("scan").src = c.toDataURL(); });
  await page.waitForFunction(() => document.getElementById("scan").complete);
  const mixedBuf = await page.pdf({ format: "A4" });
  await browser.close();
  const buf = fs.readFileSync(pdfPath);

  const read = await pdfText(buf);
  ok("the PDF's text layer is read", read.numPages === 1 && /Corporate Avenue/.test(read.pages[0]) && /12414/.test(read.pages[0]), read.pages[0].slice(0, 200));
  ok("table cells on one line stay on one line", /Carpet Area sq\.ft\s+12414\s+12952/.test(read.pages[0]), read.pages[0]);
  ok("no page is taken for a scan", read.scanned.length === 0);
  const mixed = await pdfText(mixedBuf);
  ok("a blank page is blank, not a scan, so it needs no model that can see", mixed.numPages === 3 && mixed.blank.includes(2) && !mixed.scanned.includes(2), JSON.stringify({ blank: mixed.blank, scanned: mixed.scanned }));
  ok("a page that is only a picture is a scan", mixed.scanned.join() === "3", JSON.stringify(mixed.scanned));

  /* Engy reads text only: with text to go on it reads that and names the
     scans it left; with only scans it stops and says what is needed. */
  const realFetch = global.fetch;
  let sent = null;
  global.fetch = async (url, o) => { sent = JSON.parse(o.body); return { ok: true, json: async () => ({ model: "m", choices: [{ message: { content: '{"Options":[]}' } }] }) }; };
  try {
    const long = "Corporate Avenue, Chakala. Carpet 12414 sq ft. Rent Rs 300 on carpet. ".repeat(6);
    const r = await askModel({ text: long, scanned: [3], fileName: "x.pdf" }, "engy");
    ok("Engy reads the text and names the scanned page it could not", r.unread.join() === "3" && !/no text layer/.test(sent.messages[1].content), JSON.stringify(r.unread));
    ok("the note says which pages and which key reads them", /page 3\. Set ANTHROPIC_API_KEY/.test(scanNote([3], r.unread)) && /Read as images/.test(scanNote([3], [])));
    let e = null; try { await askModel({ text: "", scanned: [1, 2], fileName: "scan.pdf" }, "engy"); } catch (x) { e = x; }
    ok("only scans, and only Engy: a plain message naming the key", e && e.status === 422 && /Only scanned pages here \(page 1; page 2\)/.test(e.message) && /ANTHROPIC_API_KEY/.test(e.message), e && e.message);
  } finally { global.fetch = realFetch; }

  ok("the sheet guide names every required heading", /"Property name" \(required\)/.test(sheetGuide()) && /"Latitude" \(required\)/.test(sheetGuide()) && !/Presets/.test(sheetGuide()));
  ok("JSON is found inside fences and chatter", parseJSON('Sure.\n```json\n{"a":1}\n```').a === 1 && parseJSON('<think>hmm</think>{"b":2}').b === 2);
  let threw = false; try { parseJSON("no json here"); } catch (e) { threw = true; } ok("no JSON is an error, not a crash", threw);

  let seen = null;
  const fakeLLM = async (args) => { seen = args; return { rows: JSON.parse(JSON.stringify(FAKE_ROWS)), model: "fake", provider: "test" }; };
  const out = await importPdf(buf, { fileName: "inventory.pdf", llm: fakeLLM, geocoder: fakeGeocoder });
  ok("the model gets the page text and the file name", seen && /--- page 1 ---/.test(seen.text) && /723 Avenue/.test(seen.text) && seen.fileName === "inventory.pdf" && seen.pdfBase64 === null);
  ok("two options come through with their extra columns", out.bundle.options.length === 2 && out.bundle.options[1].name === "723 Avenue" && out.bundle.options[1].rentOnCarpetRsPerSqFt === 316, JSON.stringify(out.bundle.options[1]));
  ok("extra columns keep their numbers", typeof out.bundle.options[0].carpetAreaSqFt === "number" && out.bundle.options[0].metroDistanceM === 800);
  ok("the options were geocoded and say so", out.bundle.options.every(o => typeof o.lat === "number" && typeof o.lng === "number") && out.bundle.options[0].precision === "street" && /Geocoded by Mapbox/.test(out.bundle.options[0].geoSrc), JSON.stringify(out.bundle.options[0]));
  ok("the map centre is the middle of the options", Math.abs(out.bundle.meta.center[1] - 19.1096) < 0.001 && Math.abs(out.bundle.meta.center[0] - 72.87115) < 0.001 && out.bundle.meta.zoom === 13, JSON.stringify(out.bundle.meta));
  ok("places that could be placed are placed; the one without an address is named", out.placed.length === 4 && out.unplaced.length === 1 && /no address/.test(out.unplaced[0]), JSON.stringify([out.placed, out.unplaced]));
  ok("the notes say what was geocoded and what needs a pin", out.notes.some(n => /4 pins were placed by geocoding/.test(n)) && out.notes.some(n => /1 could not be placed/.test(n)), out.notes.join(" | "));
  ok("the unplaced place is dropped by the validator as an error, not silently", !out.report.ok && out.report.errors.some(e => /nowhere|no address/i.test(e.where + e.message)), JSON.stringify(out.report.errors));
  ok("micro-markets and facts came through", out.bundle.zones.length === 2 && out.bundle.facts.market.length === 1 && out.bundle.facts.market[0].src === "Proposed Inventory PDF", JSON.stringify([out.bundle.zones, out.bundle.facts]));
  ok("the title and the source name the PDF", out.bundle.meta.title === "Proposed Inventory, Andheri East" && out.bundle.meta.sheet === "inventory.pdf");

  /* The workbook handed back is the real thing: open it, read it, same bundle. */
  const again = await readWorkbook(Buffer.from(out.workbook, "base64"));
  ok("the returned workbook reads back to the same options", JSON.stringify(again.bundle.options) === JSON.stringify(out.bundle.options));
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(out.workbook, "base64"));
  const O = wb.getWorksheet("Options");
  const headings = []; O.getRow(3).eachCell({ includeEmpty: false }, c => headings.push(String(c.value).replace(/\*/g, "").trim()));
  ok("the Options sheet carries the PDF's own columns as headings", headings.includes("Rent on carpet (Rs per sq ft)") && headings.includes("Nearest metro"), headings.join(", "));
  ok("the template's example rows are gone", O.rowCount === 5 && String(O.getRow(4).getCell(1).value) === "corporate-avenue", `rows ${O.rowCount}`);

  /* Once the person fixes the one missing pin in the workbook, it passes. */
  const fixed = JSON.parse(JSON.stringify(FAKE_ROWS));
  fixed["Places"][2]["Latitude"] = 19.11; fixed["Places"][2]["Longitude"] = 72.88;
  const fixedOut = await importPdf(buf, { fileName: "inventory.pdf", llm: async () => ({ rows: fixed, model: "fake", provider: "test" }), geocoder: fakeGeocoder });
  ok("with every pin placed the bundle passes its checks", fixedOut.report.ok, JSON.stringify(fixedOut.report.errors));

  /* A model that answers with a single row object where a list is expected. */
  const odd = { "Atlas": { "Title": "One" }, "Options": { "ID": "x", "Property name": "X Tower", "Address": "Marol, Mumbai", "Latitude": 19.1, "Longitude": 72.88 } };
  const oddOut = await importPdf(buf, { fileName: "one.pdf", llm: async () => ({ rows: odd }), geocoder: fakeGeocoder });
  ok("a lone row object is taken as a one-row list", oddOut.bundle.options.length === 1 && oddOut.bundle.options[0].name === "X Tower");

  /* fillWorkbook on its own: nothing but an Atlas sheet. */
  const thin = await readWorkbook(await fillWorkbook({ "Atlas": { "Title": "Thin", "Data current to": "2026-10", "Centre longitude": 72.8, "Centre latitude": 19.1, "Opening zoom": 12 } }));
  ok("a workbook with only the Atlas sheet filled still reads", thin.bundle.meta.title === "Thin" && thin.bundle.meta.zoom === 12);

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
