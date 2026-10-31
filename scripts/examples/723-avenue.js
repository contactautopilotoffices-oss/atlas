#!/usr/bin/env node
/* ============================================================================
   ATLAS · 723 Avenue, Marol: a feature atlas of one building

     node scripts/examples/723-avenue.js
         writes examples/723-avenue.xlsx          (upload in /admin, type "show a place")
         and    examples/723-avenue.bundle.json   (the same atlas, for tests and preview)

   Built only from what this repo already holds, with its sources:
     the site      Proposed_Inventory.pdf figures, as on the Andheri coworking
                   atlas (scripts/examples/andheri-coworking.js, PROPOSED)
     around it     the coworking centres on that atlas, plus IA Spaces inside
                   723 Avenue (the Andheri case study, from its myHQ listing)
     metro         the same stations as the coworking atlas
     facts         the 723 Avenue RERA fact and the Line 1 and Line 3 facts
                   (scripts/examples/andheri-coworking-facts.js)
   ============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { buildTemplate, readWorkbook } = require("../lib/workbook");
const { PROPOSED, GEO } = require("./andheri-coworking");
const FACTS = require("./andheri-coworking-facts");

const ROOT = path.join(__dirname, "..", "..");
const COWORKING = JSON.parse(fs.readFileSync(path.join(ROOT, "examples", "andheri-coworking.bundle.json"), "utf8"));

/* Write a row by heading, as the person filling the sheet would. */
function heads(ws) { const m = new Map(); ws.getRow(3).eachCell({ includeEmpty: false }, (c, i) => { const t = String(c.value == null ? "" : c.value).replace(/\*/g, "").trim(); if (t) m.set(t, i); }); return m; }
function addRow(ws, obj) { const h = heads(ws), r = ws.getRow(ws.rowCount + 1); for (const [k, v] of Object.entries(obj)) { if (v === undefined || v === null || v === "") continue; const i = h.get(k); if (!i) throw new Error(`no column "${k}" on ${ws.name}`); r.getCell(i).value = v; } r.commit(); }
function addCol(ws, label) { ws.getRow(3).getCell(ws.columnCount + 1).value = label; }
function setField(ws, label, v) { for (let r = 4; r <= ws.rowCount; r++) { const l = String(ws.getRow(r).getCell(1).value == null ? "" : ws.getRow(r).getCell(1).value).replace(/\*/g, "").trim(); if (l === label) { ws.getRow(r).getCell(2).value = v; return; } } throw new Error(`no field "${label}"`); }

const SITE = PROPOSED.find(p => p.id === "proposed-723-avenue");
const G = GEO[SITE.geo];

function build() {
  const wb = buildTemplate();

  const A = wb.getWorksheet("Atlas");
  setField(A, "Title", "723 Avenue, Marol");
  setField(A, "Subtitle", "Wadhwa 723 Avenue: the building, its floors and everything around it");
  setField(A, "Data current to", "2026-10");
  setField(A, "City", "Mumbai");
  setField(A, "Centre longitude", G.lng);
  setField(A, "Centre latitude", G.lat);
  setField(A, "Opening zoom", 14.6);
  setField(A, "Source workbook", "Proposed_Inventory.pdf (October 2026) for the floors offered; the Andheri coworking atlas for the centres around it; the Andheri case study for IA Spaces. Positions and public facts carry their own sources.");
  setField(A, "Peak speed (km/h)", 16);
  setField(A, "Road factor", 1.3);
  setField(A, "Speed source", "TomTom Traffic Index 2025, Mumbai rush hour");

  /* The site: the one option a place atlas is about. */
  const O = wb.getWorksheet("Options");
  const COLS = [["Floor / unit", "floor"], ["Total floors", "floors"], ["Furnishing", "furnishing"], ["Carpet area (sq ft)", "carpet"], ["Built-up area (sq ft)", "builtup"],
    ["Ceiling height", "ceiling"], ["Rent on carpet (Rs per sq ft a month)", "rent"], ["CAM (Rs per sq ft a month)", "cam"], ["Parking", "parking"],
    ["Fire NOC", "noc"], ["OC and CC", "oc"], ["Available from", "available"], ["Nearest metro", "metro"], ["Metro distance (m)", "metroM"]];
  for (const [label] of COLS) addCol(O, label);
  const row = { "ID": "723-avenue", "Rank": 1, "Property name": SITE.name, "Latitude": G.lat, "Longitude": G.lng, "How exact is the pin": G.precision,
    "Source for the position": G.src, "Why it scores as it does": SITE.reason, "Address": SITE.address, "Locality": "Marol", "City": "Mumbai" };
  for (const [label, k] of COLS) row[label] = SITE[k];
  addRow(O, row);

  /* Around it: every coworking centre on the coworking atlas, and IA Spaces
     inside 723 Avenue itself. */
  const P = wb.getWorksheet("Places");
  for (const c of COWORKING.options.filter(o => o.fit === "coworking-competitors")) {
    addRow(P, { "ID": c.id, "Kind": "coworking", "Name": c.name, "Latitude": c.lat, "Longitude": c.lng, "Second line": c.perSeatCost || "",
      "Operator": c.operator, "How exact is the pin": c.precision, "Source": c.geoSrc });
  }
  addRow(P, { "ID": "ia-spaces-723-avenue", "Kind": "coworking", "Name": "IA Spaces · 723 Avenue", "Latitude": G.lat, "Longitude": G.lng,
    "Second line": "Rs 18,000 a seat", "Operator": "IA Spaces", "How exact is the pin": G.precision, "Source": G.src,
    "Note": "Inside 723 Avenue. From the Andheri case study, which cites IA Spaces' myHQ listing." });

  /* Metro, as on the coworking atlas. */
  const T = wb.getWorksheet("Transit");
  for (const line of COWORKING.transit.lines) {
    for (const s of line.stations) addRow(T, { "Line name": line.name, "Line short name": line.short, "Mode": line.mode, "Line colour": line.color,
      "Station name": s.name, "Latitude": s.lat, "Longitude": s.lng, "Open?": "yes", "Source": s.src || line.src });
  }

  /* Facts already sourced for this building and its metro. */
  const F = wb.getWorksheet("Facts");
  const pick = ["723 Avenue (Wadhwa)", "Metro Line 3 (Aqua), fully open", "Metro Line 1 (Blue)"];
  for (const k of pick) {
    const f = FACTS.find(x => x.k === k);
    if (!f) throw new Error(`no fact "${k}"`);
    addRow(F, { "Group": f.group === "proposed" ? "building" : f.group, "Label": f.k, "Value": f.v, "As of": f.asOf, "How firm": f.conf, "Source": f.src, "Note": f.note });
  }
  return wb;
}

async function main() {
  const wb = build();
  const xlsx = path.join(ROOT, "examples", "723-avenue.xlsx");
  const json = path.join(ROOT, "examples", "723-avenue.bundle.json");
  await wb.xlsx.writeFile(xlsx);
  const { bundle, notes } = await readWorkbook(fs.readFileSync(xlsx));
  bundle.meta.layout = "place";
  fs.writeFileSync(json, JSON.stringify(bundle, null, 1) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), xlsx)} and ${path.relative(process.cwd(), json)}`);
  notes.forEach(n => console.log("  note: " + n));
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { build };
