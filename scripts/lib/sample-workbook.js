/* ============================================================================
   ATLAS · a filled-in sample workbook

   A small Pune study, written into the template through its HEADINGS, the
   way a person typing into the sheets would. Shared by two tests:

     workbook.test.js   does the workbook survive the round trip
     engine-test.js     does what comes out of it actually render

   The second is the one that matters. A bundle that validates but cannot be
   drawn would still leave the team stuck.
   ============================================================================ */
"use strict";
const { buildTemplate } = require("./workbook");

/* Write a row by heading, exactly as a person typing into the sheet would. */
function heads(ws) {
  const map = new Map();
  ws.getRow(3).eachCell({ includeEmpty: false }, (c, i) => {
    const t = String(c.value == null ? "" : c.value).replace(/\*/g, "").trim();
    if (t) map.set(t, i);
  });
  return map;
}
function addRow(ws, obj) {
  const h = heads(ws);
  const r = ws.getRow(ws.rowCount + 1);
  for (const [label, v] of Object.entries(obj)) {
    const i = h.get(label);
    if (!i) throw new Error(`no column "${label}" on ${ws.name} (has: ${[...h.keys()].join(", ")})`);
    r.getCell(i).value = v;
  }
  r.commit();
}
function setField(ws, label, v) {
  for (let r = 4; r <= ws.rowCount; r++) {
    const l = String(ws.getRow(r).getCell(1).value == null ? "" : ws.getRow(r).getCell(1).value).replace(/\*/g, "").trim();
    if (l === label) { ws.getRow(r).getCell(2).value = v; return; }
  }
  throw new Error(`no field "${label}" on ${ws.name}`);
}

/* Returns the .xlsx as a buffer. */
async function fill() {
  const wb = buildTemplate();

  const atlas = wb.getWorksheet("Atlas");
  setField(atlas, "Title", "Pune Office Study");
  setField(atlas, "Subtitle", "Where the next Pune office should go");
  setField(atlas, "Data current to", "2026-10");
  setField(atlas, "City", "Pune");
  setField(atlas, "Centre longitude", 73.8567);
  setField(atlas, "Centre latitude", 18.5204);
  setField(atlas, "Opening zoom", 11.5);
  setField(atlas, "Source workbook", "Pune_Options_Oct2026.xlsx");
  setField(atlas, "Peak speed (km/h)", 18);
  setField(atlas, "Road factor", 1.35);
  setField(atlas, "Speed source", "TomTom Traffic Index 2025");
  setField(atlas, "Next steps", "Visit the two best-fit options first.\nAsk for rent, CAM and lock-in in writing.");

  const opts = wb.getWorksheet("Options");
  /* A column the schema has never heard of, added by the person filling it
     in. It must survive into the bundle and be rankable. */
  opts.getRow(3).getCell(opts.columnCount + 1).value = "Rent per sq ft";
  addRow(opts, { "ID": "amar-tech", "Rank": 1, "Property name": "Amar Tech Park", "Latitude": 18.5074, "Longitude": 73.928,
    "How exact is the pin": "building", "Source for the position": "https://www.openstreetmap.org/node/1",
    "Micro-market": "kharadi", "Fit group": "best", "Why it scores as it does": "Deepest Grade A supply, metro on the doorstep.",
    "Address": "Hadapsar, Pune 411028", "Km from current office": 12, "Drive time from current office": "25-30 min", "Rent per sq ft": 88 });
  addRow(opts, { "ID": "eon-free", "Rank": 2, "Property name": "EON Free Zone", "Latitude": 18.5679, "Longitude": 73.9143,
    "How exact is the pin": "complex", "Source for the position": "https://www.openstreetmap.org/node/2",
    "Micro-market": "kharadi", "Fit group": "best", "Address": "Kharadi, Pune 411014", "Km from current office": 9, "Rent per sq ft": 95 });
  addRow(opts, { "ID": "nucleus", "Rank": 3, "Property name": "Nucleus Mall Offices", "Latitude": 18.5362, "Longitude": 73.8775,
    "How exact is the pin": "building", "Source for the position": "https://www.openstreetmap.org/node/3",
    "Micro-market": "camp", "Fit group": "value", "Address": "Camp, Pune 411001", "Km from current office": 6, "Rent per sq ft": 72 });

  const zones = wb.getWorksheet("Micro-markets");
  addRow(zones, { "Key": "kharadi", "Short name": "Kharadi", "Full name": "Kharadi and the EON corridor", "Colour": "#2e7d5b",
    "What it is like": "Established IT corridor with the deepest Grade A supply in the east.",
    "Rent": "INR 85-95 per sq ft", "Rent source": "https://example.org/r", "Vacancy": "8%", "Vacancy source": "https://example.org/r",
    "In its favour": "Deep Grade A supply\nMetro on the doorstep", "Watch": "Rents rising fastest in the city" });
  addRow(zones, { "Key": "camp", "Short name": "Camp", "Full name": "Camp and the central business district", "Colour": "#b7791f",
    "What it is like": "Central, older stock, hard to park.", "Rent": "INR 68-78 per sq ft", "Rent source": "https://example.org/r" });

  const places = wb.getWorksheet("Places");
  addRow(places, { "ID": "coep", "Kind": "edu", "Name": "College of Engineering Pune", "Latitude": 18.5308, "Longitude": 73.8567, "How exact is the pin": "building", "Source": "https://www.coep.org.in/" });
  addRow(places, { "ID": "viit", "Kind": "edu", "Name": "Vishwakarma Institute", "Latitude": 18.4639, "Longitude": 73.8681, "How exact is the pin": "building" });
  addRow(places, { "ID": "viman", "Kind": "res", "Name": "Viman Nagar", "Latitude": 18.5679, "Longitude": 73.9143, "How exact is the pin": "locality" });
  addRow(places, { "ID": "baner", "Kind": "res", "Name": "Baner", "Latitude": 18.5590, "Longitude": 73.7868, "How exact is the pin": "locality" });

  const transit = wb.getWorksheet("Transit");
  addRow(transit, { "Line name": "Purple Line", "Line short name": "Purple", "Mode": "metro", "Line colour": "#6b3fa0", "Station name": "Ramwadi", "Latitude": 18.5512, "Longitude": 73.9158, "Open?": "yes", "Source": "https://example.org/metro" });
  addRow(transit, { "Line name": "Purple Line", "Station name": "Kalyani Nagar", "Latitude": 18.5489, "Longitude": 73.9025, "Open?": "yes" });
  addRow(transit, { "Line name": "Purple Line", "Station name": "Wagholi", "Latitude": 18.5800, "Longitude": 73.9800, "Open?": "no", "Target year": 2028, "When it opens, in words": "Works by Mar 2028" });
  addRow(transit, { "Line name": "Aqua Line", "Mode": "metro", "Line colour": "#2a9d9d", "Station name": "Vanaz", "Latitude": 18.5074, "Longitude": 73.8077, "Open?": "yes" });

  const facts = wb.getWorksheet("Facts");
  addRow(facts, { "Group": "market", "Label": "Grade A rent", "Value": "INR 85-95 per sq ft per month", "As of": "2026-09", "How firm": "high", "Source": "https://example.org/report" });
  addRow(facts, { "Group": "market", "Label": "Vacancy", "Value": "8.4% city-wide", "As of": "2026-09", "How firm": "medium", "Source": "https://example.org/report" });
  addRow(facts, { "Group": "talent", "Label": "Engineering graduates", "Value": "About 60,000 a year", "As of": "2026", "How firm": "medium", "Source": "https://example.org/aicte" });

  const ex = wb.getWorksheet("Current office");
  setField(ex, "ID", "current");
  setField(ex, "Name", "Tech Park One");
  setField(ex, "Latitude", 18.5600);
  setField(ex, "Longitude", 73.9100);
  setField(ex, "Locality", "Yerwada");
  setField(ex, "Micro-market", "kharadi");
  setField(ex, "How exact is the pin", "building");

  const pri = wb.getWorksheet("Priorities");
  addRow(pri, { "Key": "rent", "Slider name": "Rent", "What it measures": "column", "Which column": "Rent per sq ft",
    "Higher is better?": "no", "The question to ask": "How much does the rent matter?", "What it is calculated from": "the rent per sq ft on the sheet" });
  addRow(pri, { "Key": "rail", "Slider name": "Metro today", "What it measures": "nearestStation", "Open or planned": "open", "Which mode": "metro",
    "The question to ask": "Can people walk to an open metro station?", "What it is calculated from": "distance to the nearest open metro station" });
  addRow(pri, { "Key": "talent", "Slider name": "Talent pool", "What it measures": "nearestPlace", "Which kind of place": "edu, res",
    "The question to ask": "Do you want colleges and homes within half an hour?", "What it is calculated from": "institutes and residential belts by drive time" });
  addRow(pri, { "Key": "home", "Slider name": "Close to today's office", "What it measures": "fromExisting",
    "The question to ask": "Should today's team keep roughly the same commute?", "What it is calculated from": "road distance from the current office" });

  const pre = wb.getWorksheet("Presets");
  for (const [m, lv] of [["rent", "3 High"], ["rail", "2 Medium"], ["talent", "2 Medium"], ["home", "1 Low"]])
    addRow(pre, { "Preset key": "balanced", "Preset name": "Balanced", "What it means": "A bit of everything.", "Start here?": m === "rent" ? "yes" : "", "Slider": m, "How much it counts": lv });
  for (const [m, lv] of [["rent", "4 Critical"], ["rail", "1 Low"], ["talent", "1 Low"], ["home", "1 Low"]])
    addRow(pre, { "Preset key": "cost", "Preset name": "Keep cost down", "What it means": "The best rent leads.", "Slider": m, "How much it counts": lv });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

module.exports = { fillSampleWorkbook: fill };
