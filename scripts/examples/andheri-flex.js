#!/usr/bin/env node
/* ============================================================================
   ATLAS · the Andheri flex atlas, as a workbook

     node scripts/examples/andheri-flex.js        writes examples/andheri-flex.xlsx

   This is what a team member produces from two PDFs they were handed:

     Flex_Operators_Overview__in_Andheri.pdf   24 coworking centres: operator,
                                               building, micro-market, price
                                               per seat, grade
     Proposed_Inventory.pdf                    4 buildings being proposed:
                                               floors, grade, furnishing,
                                               carpet and built-up area, rent,
                                               CAM, parking, approvals, when
                                               it is available, nearest metro

   Neither PDF carries a single coordinate, and that is where the process
   stops for anyone without a map: every one of the 28 buildings has to be
   placed by hand. Here the positions are looked up from the Andheri study
   already in this repo (andheri/data.js), which was built from the same
   operator list and geocoded with a source per pin. That is the lookup a
   person would do in Google Maps, done once from a sheet that already had it.

   Everything that is NOT a position comes from the PDFs, typed in here the
   way it would be typed into the sheets. Two centres on the PDF are left out
   on purpose, as the earlier study left them out: the two Innov8 sites whose
   buildings could not be placed.
   ============================================================================ */
"use strict";
const path = require("path");
const { buildTemplate } = require("../lib/workbook");
const { loadGlobals } = require("../lib/study-bundle");

const geo = loadGlobals("andheri/data.js");
const byId = (list, id) => { const x = list.find(o => o.id === id); if (!x) throw new Error(`no position for ${id} in andheri/data.js`); return x; };
const at = (x) => ({ "Latitude": x.lat, "Longitude": x.lng, "How exact is the pin": x.precision });

/* Write a row by heading, as the person filling the sheet would. */
function heads(ws) { const m = new Map(); ws.getRow(3).eachCell({ includeEmpty: false }, (c, i) => { const t = String(c.value == null ? "" : c.value).replace(/\*/g, "").trim(); if (t) m.set(t, i); }); return m; }
function addRow(ws, obj) { const h = heads(ws), r = ws.getRow(ws.rowCount + 1); for (const [k, v] of Object.entries(obj)) { const i = h.get(k); if (!i) throw new Error(`no column "${k}" on ${ws.name}`); r.getCell(i).value = v; } r.commit(); }
function addCol(ws, label) { ws.getRow(3).getCell(ws.columnCount + 1).value = label; }
function setField(ws, label, v) { for (let r = 4; r <= ws.rowCount; r++) { const l = String(ws.getRow(r).getCell(1).value == null ? "" : ws.getRow(r).getCell(1).value).replace(/\*/g, "").trim(); if (l === label) { ws.getRow(r).getCell(2).value = v; return; } } throw new Error(`no field "${label}"`); }

async function build() {
  const wb = buildTemplate();

  /* ---- Atlas ---- */
  const A = wb.getWorksheet("Atlas");
  setField(A, "Title", "Andheri Flex Atlas");
  setField(A, "Subtitle", "Four proposed buildings, read against the flex market around them");
  setField(A, "Data current to", "2026-10");
  setField(A, "City", "Mumbai");
  setField(A, "Centre longitude", 72.872);
  setField(A, "Centre latitude", 19.111);
  setField(A, "Opening zoom", 13.6);
  setField(A, "Source workbook", "Proposed_Inventory.pdf and Flex_Operators_Overview__in_Andheri.pdf, October 2026");
  setField(A, "Peak speed (km/h)", 16);
  setField(A, "Road factor", 1.3);
  setField(A, "Speed source", "TomTom Traffic Index 2025, Mumbai rush hour");
  setField(A, "Next steps", [
    "Confirm the carpet efficiency: three of the four landlords quoted on carpet with 60% assumed, so compare like for like on built-up.",
    "723 Avenue and Privilon are bare shell: get the fit-out cost and timeline before comparing rent.",
    "Fire NOC and OC for 723 Avenue (Nov 2026) and Privilon (Jan 2027) are not yet in hand; make the lease conditional on them.",
    "Visit at 6 to 7 pm and time the walk from the metro each building names."
  ].join("\n"));

  /* ---- Options: the four proposed buildings, with the PDF's columns ---- */
  const O = wb.getWorksheet("Options");
  for (const c of ["Grade", "Floor / unit", "Total floors", "Furnishing", "Efficiency", "Carpet area (sq ft)", "Built-up area (sq ft)", "Ceiling height",
    "Rent on carpet (Rs per sq ft)", "CAM (Rs per sq ft)", "Parking", "Fire NOC", "OC and CC", "DG backup", "Available from", "Months until available", "Nearest metro", "Metro distance (m)"]) addCol(O, c);
  const opt = (id, n, name, micro, fit, reason, cols) => { const g = byId(geo.AND_OPTIONS, id); addRow(O, { "ID": id, "Rank": n, "Property name": name, "Micro-market": micro, "Fit group": fit, "Why it scores as it does": reason, "Address": "Andheri East, Mumbai", "Locality": "Andheri East", ...at(g), "Source for the position": g.geoSrc || "", ...cols }); };
  opt("corporate-avenue", 1, "Corporate Avenue", "chakala", "ready", "Furnished, approvals in hand, available now, and 800 m from Chakala metro. The only one of the four that can be occupied without waiting.",
    { "Grade": "A", "Floor / unit": "3rd and 4th", "Total floors": "G + 8", "Furnishing": "Furnished", "Efficiency": "60% (assumed; landlord quoted on carpet)", "Carpet area (sq ft)": 12414, "Built-up area (sq ft)": 20690, "Ceiling height": "11 ft",
      "Rent on carpet (Rs per sq ft)": 300, "CAM (Rs per sq ft)": 0, "Parking": "5 car parks per floor", "Fire NOC": "Available", "OC and CC": "Available", "DG backup": "Common area only", "Available from": "Immediately", "Months until available": 0, "Nearest metro": "Chakala", "Metro distance (m)": 800 });
  opt("rustomjee-central-park", 2, "Rustomjee Central Park", "weh", "early-2027", "Furnished and approved, the smallest floor of the four, 550 m from WEH metro. Not available until February 2027.",
    { "Grade": "B+", "Floor / unit": "4th", "Total floors": "G + 9", "Furnishing": "Furnished", "Efficiency": "60% (assumed; landlord quoted on carpet)", "Carpet area (sq ft)": 9000, "Built-up area (sq ft)": 15000, "Ceiling height": "To be confirmed",
      "Rent on carpet (Rs per sq ft)": 325, "CAM (Rs per sq ft)": 0, "Parking": "10 car parks", "Fire NOC": "Available", "OC and CC": "Available", "DG backup": "Common area only", "Available from": "February 2027", "Months until available": 4, "Nearest metro": "Western Express Highway", "Metro distance (m)": 550 });
  opt("723-avenue", 3, "723 Avenue", "marol", "late-2026", "Bare shell on the 13th and 14th floors with the highest ceilings, 700 m from Marol metro. Fire NOC and OC due November 2026.",
    { "Grade": "A", "Floor / unit": "13th and 14th", "Total floors": "G + 15", "Furnishing": "Bare shell", "Efficiency": "60%", "Carpet area (sq ft)": 12952, "Built-up area (sq ft)": 21586, "Ceiling height": "11.7 ft",
      "Rent on carpet (Rs per sq ft)": 316, "CAM (Rs per sq ft)": 16, "Parking": "1 per 1,000 sq ft built-up", "Fire NOC": "November 2026", "OC and CC": "November 2026", "DG backup": "Common area only", "Available from": "November 2026", "Months until available": 1, "Nearest metro": "Marol Naka", "Metro distance (m)": 700 });
  opt("privilon", 4, "Privilon", "marol", "early-2027", "The largest carpet and the dearest rent, bare shell, 93 m from Marol metro. Approvals due January 2027.",
    { "Grade": "A", "Floor / unit": "Multiple", "Total floors": "G + 15", "Furnishing": "Bare shell", "Efficiency": "60% (assumed; landlord quoted on carpet)", "Carpet area (sq ft)": 15343, "Ceiling height": "11.7 ft",
      "Rent on carpet (Rs per sq ft)": 375, "CAM (Rs per sq ft)": 30, "Parking": "To be confirmed", "Fire NOC": "January 2027", "OC and CC": "January 2027", "DG backup": "Common area only", "Available from": "January 2027", "Months until available": 3, "Nearest metro": "Marol Naka", "Metro distance (m)": 93 });

  /* ---- Micro-markets, from the study ---- */
  const Z = wb.getWorksheet("Micro-markets");
  const COLORS = { chakala: "#2e7d5b", marol: "#b7791f", weh: "#1d6fa5", jbnagar: "#8a3d6b", chandivali: "#7b6a5c", sahar: "#4a5a6a" };
  for (const z of geo.AND_ZONES) addRow(Z, { "Key": z.key, "Short name": z.label, "Full name": z.name, "Colour": COLORS[z.key] || "" });

  /* ---- Places: the flex centres, one kind ---- */
  const P = wb.getWorksheet("Places");
  const grade = { "simpliwork-prima-bay": "A", "wework-lightbridge": "A", "incuspaze-lighthall": "A", "awfis-skyline-icon": "A", "smartworks-times-square": "A", "innov8-marol": "A", "zon-collab-indiana-business-centre": "B-",
    "executive-spaces-trade-star": "B", "innov8-j-b-nagar": "B", "devx-dynasty-business-park": "B", "table-space-r-square": "A", "dextrus-mint": "A", "synq-work-windfall": "A-", "executive-spaces-rustomjee-central-park": "A",
    "devx-215-atrium": "A-", "dbs-kanakia-wall-street": "A", "akasa-coworking-satellite-gazebo": "A-", "akt-chakala": "A", "let-s-work-vkg-corporate-centre": "A-", "quest-coworks-technopolis-knowledge-park": "B", "inspire-coworking-chakala": "B", "executive-spaces-chintamani-plaza": "B" };
  for (const c of geo.AND_CENTRES) {
    addRow(P, { "ID": c.id, "Kind": "flex", "Name": c.building ? `${c.operator} · ${c.building}` : c.operator, "Second line": `Rs ${Number(c.price).toLocaleString("en-IN")} per seat + taxes`,
      "Note": `Grade ${grade[c.id] || "-"} · ${(geo.AND_ZONES.find(z => z.key === c.micro) || {}).label || c.micro}`, ...at(c), "Source": c.geoSrc || "" });
  }

  /* ---- Transit: the stations, as two lines ---- */
  const T = wb.getWorksheet("Transit");
  for (const s of geo.AND_STATIONS) {
    const line = /Line 3/.test(s.name) ? "Metro Line 3 (Aqua)" : "Metro Line 1 (Blue)";
    addRow(T, { "Line name": line, "Line short name": /Line 3/.test(s.name) ? "L3" : "L1", "Mode": "metro", "Line colour": /Line 3/.test(s.name) ? "#1d8a8a" : "#1d6fa5", "Station name": s.name.replace(/ \(Line \d\)$/, ""), "Latitude": s.lat, "Longitude": s.lng, "Open?": "yes", "Source": s.src || "" });
  }

  /* ---- Facts, from the two PDFs ---- */
  const F = wb.getWorksheet("Facts");
  addRow(F, { "Group": "market", "Label": "Flex seat pricing", "Value": "Rs 10,000 to 35,000 per seat per month plus taxes across 24 centres; most sit between 13,000 and 18,000", "As of": "2026-10", "How firm": "medium", "Note": "Managed and private cabin pricing, from Flex_Operators_Overview__in_Andheri.pdf" });
  addRow(F, { "Group": "market", "Label": "Where the flex supply is", "Value": "Chakala and J B Nagar hold most of the centres; Marol and Chandivali the rest", "As of": "2026-10", "How firm": "high", "Note": "Counted from the same overview" });
  addRow(F, { "Group": "market", "Label": "Proposed rent range", "Value": "Rs 300 to 375 per sq ft per month on carpet, CAM from included to Rs 30", "As of": "2026-10", "How firm": "high", "Note": "From Proposed_Inventory.pdf; three of four landlords quoted on carpet with 60% efficiency assumed" });
  addRow(F, { "Group": "market", "Label": "Readiness", "Value": "One building is available now with approvals in hand; the other three come between November 2026 and February 2027", "As of": "2026-10", "How firm": "high", "Note": "Fire NOC and OC dates as stated by the landlords" });

  /* ---- Priorities and presets ---- */
  const PR = wb.getWorksheet("Priorities");
  addRow(PR, { "Key": "rent", "Slider name": "Rent", "What it measures": "column", "Which column": "Rent on carpet (Rs per sq ft)", "Higher is better?": "no", "The question to ask": "How much does the rent matter?", "What it is calculated from": "the quoted rent per sq ft on carpet" });
  addRow(PR, { "Key": "size", "Slider name": "Floor size", "What it measures": "column", "Which column": "Carpet area (sq ft)", "Higher is better?": "yes", "The question to ask": "Do you need the bigger floor?", "What it is calculated from": "carpet area in sq ft" });
  addRow(PR, { "Key": "ready", "Slider name": "Ready now", "What it measures": "column", "Which column": "Months until available", "Higher is better?": "no", "Top of the scale": 4, "The question to ask": "How soon do you need to move in?", "What it is calculated from": "months until the floor and its approvals are available" });
  addRow(PR, { "Key": "metro", "Slider name": "Metro on foot", "What it measures": "nearestStation", "Open or planned": "open", "Which mode": "metro", "The question to ask": "Should staff be able to walk from the metro?", "What it is calculated from": "distance to the nearest open metro station" });
  addRow(PR, { "Key": "flex", "Slider name": "Flex market nearby", "What it measures": "nearestPlace", "Which kind of place": "flex", "The question to ask": "Does being among the flex operators matter?", "What it is calculated from": "flex centres within a short drive" });

  const PS = wb.getWorksheet("Presets");
  const preset = (key, label, note, dflt, levels) => Object.entries(levels).forEach(([m, lv], i) => addRow(PS, { "Preset key": key, "Preset name": label, "What it means": note, "Start here?": i === 0 && dflt ? "yes" : "", "Slider": m, "How much it counts": lv }));
  preset("balanced", "Balanced", "Rent and readiness lead; size, metro and the flex market count a little.", true, { rent: "3 High", size: "2 Medium", ready: "3 High", metro: "2 Medium", flex: "1 Low" });
  preset("cost", "Keep cost down", "The lowest rent leads.", false, { rent: "4 Critical", size: "1 Low", ready: "2 Medium", metro: "1 Low", flex: "0 Skip" });
  preset("now", "Move in now", "Whatever can be occupied soonest, with approvals in hand.", false, { rent: "2 Medium", size: "1 Low", ready: "4 Critical", metro: "2 Medium", flex: "0 Skip" });
  preset("metro", "Commute by metro", "The shortest walk from a station.", false, { rent: "2 Medium", size: "1 Low", ready: "2 Medium", metro: "4 Critical", flex: "1 Low" });

  return wb;
}

if (require.main === module) {
  const out = path.join(__dirname, "..", "..", "examples", "andheri-flex.xlsx");
  build().then(wb => wb.xlsx.writeFile(out)).then(() => console.log(`Wrote ${path.relative(process.cwd(), out)}`)).catch(e => { console.error(e.message); process.exit(1); });
}
module.exports = { build };
