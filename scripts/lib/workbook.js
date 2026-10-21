/* ============================================================================
   ATLAS · the workbook

   Two jobs, from one description of the sheets (workbook-schema.js):

     buildTemplate()   the empty boxes the team fills in
     readWorkbook()    a filled one, turned into an atlas bundle
     readSheets()      a filled one, sheet by sheet, for any set of sheets
                       (the case study workbook reads through this)

   Both take a sheet description; the atlas sheets are the default, and a
   case study passes its own (case-schema.js), so one template builder and
   one reader serve both products.

   The template carries one example row per sheet. Every example is marked in
   its first required column, so the importer can drop them and say that it
   did. A realistic-looking example row that silently became a property on a
   client's map would be worse than no example at all.

   Columns are matched by their HEADING, not their position, so a person can
   reorder or delete columns and the import still works. A heading the schema
   does not know is kept as an extra field on the row rather than dropped,
   which is how a study gets its own columns without a code change.
   ============================================================================ */
"use strict";
const ExcelJS = require("exceljs");
const { SHEETS: ATLAS_SHEETS, LEVEL_WORDS } = require("./workbook-schema");

const BRAND = "FF2A1E16", HEAD_BG = "FFF3EDE6", REQ_BG = "FFFBE8D8", EG_FG = "FF9A8B7E";
const EXAMPLE = "example";

/* The column that marks a row as an example: the first required one. */
const markerOf = (sheet) => (sheet.columns || []).find(c => c.required) || (sheet.columns || [])[0];
function exampleValue(sheet, col) {
  if (col !== markerOf(sheet)) return col.example;
  const v = col.example;
  if (typeof v !== "string") return v;
  return /^[a-z0-9-]+$/.test(v) ? `${EXAMPLE}-${v}` : `Example ${v}`;
}
const isExampleRow = (sheet, row) => {
  const col = markerOf(sheet);
  if (!col) return false;
  return String(row[col.key] == null ? "" : row[col.key]).trim().toLowerCase().startsWith(EXAMPLE);
};

/* ------------------------------------------------------------ template -- */
function buildTemplate(opts = {}) {
  const SHEETS = opts.sheets || ATLAS_SHEETS;
  const intro = Object.assign({ title: "Building an Atlas", lead: "Fill in the sheets, upload this file, and the atlas is built from it. You never need to write code.",
    needed: "Only two sheets are needed: Atlas and Options. Everything else adds a section, and anything you leave empty is simply left out. A thinner atlas is a smaller atlas, never a broken one.",
    tips: [
      "Latitude is the north-south number and longitude is the east-west one. In Google Maps, right-click a building and the two numbers appear in that order: latitude first, longitude second. Getting them the wrong way round is the most common mistake, and it puts the property in the sea. The importer checks for it and tells you.",
      "Every row that starts with the word \"example\" is skipped when you upload. They are there to show you the shape. Delete them or leave them; either way they never reach the atlas.",
      "Columns are matched by their heading, not their position. You can reorder them, delete the ones you do not need, and add your own. A column the atlas does not recognise is still kept and shown on the property card.",
    ] }, opts.intro || {});
  const wb = new ExcelJS.Workbook();
  wb.creator = "Autopilot ATLAS";
  wb.created = new Date();

  /* ---- Read me first ---- */
  const rm = wb.addWorksheet("Read me first", { properties: { tabColor: { argb: BRAND } } });
  rm.columns = [{ width: 110 }];
  const say = (text, opts = {}) => {
    const r = rm.addRow([text]);
    r.getCell(1).alignment = { wrapText: true, vertical: "top" };
    r.getCell(1).font = { size: opts.size || 11, bold: !!opts.bold, color: opts.color ? { argb: opts.color } : undefined };
    if (opts.height) r.height = opts.height;
    return r;
  };
  say(intro.title, { size: 18, bold: true, height: 26 });
  say("");
  say(intro.lead);
  say("");
  say(intro.needed, { height: 32 });
  say("");
  say("The sheets, in the order to fill them in", { bold: true, size: 13, height: 22 });
  for (const s of SHEETS) {
    const tag = s.required ? "needed" : s.optional ? "optional" : "adds a section";
    say(`${s.name}  (${tag})`, { bold: true });
    say(`    ${s.blurb}`, { height: 30 });
  }
  say("");
  say(`${["One", "Two", "Three", "Four", "Five"][intro.tips.length - 1] || intro.tips.length} thing${intro.tips.length === 1 ? "" : "s"} worth knowing`, { bold: true, size: 13, height: 22 });
  intro.tips.forEach((t, i) => say(`${i + 1}.  ${t}`, { height: 46 }));
  say("");
  say("When you upload it you get a plain-English report of anything missing or wrong, naming the sheet, the row and the column. Nothing is published until you say so.", { height: 32 });

  /* ---- one sheet per block ---- */
  for (const s of SHEETS) {
    const ws = wb.addWorksheet(s.name);
    const blurb = ws.addRow([s.blurb]);
    blurb.getCell(1).font = { italic: true, color: { argb: EG_FG }, size: 10 };
    blurb.height = 28;
    ws.addRow([]);

    if (s.shape === "form") {
      const head = ws.addRow(["Field", "Your value", "What it is"]);
      head.font = { bold: true };
      head.eachCell(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_BG } }; });
      ws.columns = [{ width: 26 }, { width: 42 }, { width: 78 }];
      for (const f of s.fields) {
        const r = ws.addRow([f.label + (f.required ? " *" : ""), "", f.hint || ""]);
        r.getCell(1).font = { bold: !!f.required };
        if (f.required) r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: REQ_BG } };
        r.getCell(3).font = { color: { argb: EG_FG }, size: 10 };
        r.getCell(3).alignment = { wrapText: true, vertical: "top" };
        if (f.list) r.getCell(2).dataValidation = { type: "list", allowBlank: true, formulae: [`"${f.list.join(",")}"`] };
        /* The example goes in the hint column, not the value column, so an
           unedited form sheet imports as empty rather than as the example. */
        if (f.example !== undefined) r.getCell(3).value = `${f.hint ? f.hint + "  " : ""}Example: ${String(f.example).replace(/\n/g, " / ")}`;
      }
      ws.views = [{ state: "frozen", ySplit: 3 }];
    } else {
      const head = ws.addRow(s.columns.map(c => c.label + (c.required ? " *" : "")));
      head.font = { bold: true };
      head.eachCell((c, i) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.columns[i - 1].required ? REQ_BG : HEAD_BG } };
        c.alignment = { wrapText: true, vertical: "bottom" };
        const col = s.columns[i - 1];
        if (col.hint) c.note = col.hint;
      });
      head.height = 30;
      ws.columns = s.columns.map(c => ({ width: Math.min(34, Math.max(12, c.label.length + 6)) }));
      const eg = ws.addRow(s.columns.map(c => exampleValue(s, c)));
      eg.eachCell(c => { c.font = { italic: true, color: { argb: EG_FG } }; c.alignment = { wrapText: true, vertical: "top" }; });
      /* Dropdowns down the sheet, so they are there as rows are added. */
      s.columns.forEach((c, i) => {
        if (!c.list) return;
        for (let r = 4; r <= 400; r++) {
          ws.getCell(r, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [`"${c.list.join(",")}"`] };
        }
      });
      ws.views = [{ state: "frozen", xSplit: 1, ySplit: 3 }];
      ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: s.columns.length } };
    }
  }
  return wb;
}

/* -------------------------------------------------------------- reading -- */
const norm = (s) => String(s == null ? "" : s).replace(/\*/g, "").trim().toLowerCase();
const cellText = (v) => {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.text != null) return String(v.text);                 // a hyperlink
    if (v.richText) return v.richText.map(t => t.text).join("");
    if (v.result != null) return String(v.result);             // a formula
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
};
const num = (v) => { const n = typeof v === "number" ? v : parseFloat(String(cellText(v)).replace(/[, ]/g, "")); return isFinite(n) ? n : undefined; };
/* Was the CELL a number, rather than text that happens to look like one?
   "411028" typed as a postcode stays text; 88 typed as a rent stays 88. */
const cellNum = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : undefined;
  if (v && typeof v === "object" && typeof v.result === "number") return isFinite(v.result) ? v.result : undefined;
  return undefined;
};
const yes = (v) => { const t = norm(cellText(v)); return t === "" ? undefined : ["yes", "y", "true", "1", "open"].includes(t); };
const lines = (v) => cellText(v).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const camel = (label) => {
  const t = String(label).replace(/\*/g, "").trim().replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!t.length) return null;
  return t[0].toLowerCase() + t.slice(1).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
};

/* A table sheet as rows keyed by the schema, plus whatever else it carries. */
function readTable(ws, sheet, notes) {
  if (!ws) return [];
  const headRow = ws.getRow(3);
  const map = [];                                   // column index -> {key, col, extraLabel}
  headRow.eachCell({ includeEmpty: false }, (cell, i) => {
    const label = norm(cellText(cell.value));
    if (!label) return;
    const col = sheet.columns.find(c => norm(c.label) === label);
    if (col) map.push({ i, key: col.key, col });
    else {
      const k = camel(cellText(cell.value));
      if (k) map.push({ i, key: k, extraLabel: cellText(cell.value).replace(/\*/g, "").trim() });
    }
  });
  const missing = sheet.columns.filter(c => c.required && !map.some(m => m.key === c.key));
  if (missing.length) notes.push(`${sheet.name}: the column${missing.length === 1 ? "" : "s"} ${missing.map(c => `"${c.label}"`).join(", ")} ${missing.length === 1 ? "is" : "are"} missing from the sheet, so nothing on it can be read.`);

  const out = [];
  let skipped = 0;
  for (let r = 4; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = {};
    let any = false;
    for (const m of map) {
      const raw = row.getCell(m.i).value;
      const txt = cellText(raw).trim();
      if (txt === "") continue;
      any = true;
      if (m.col && m.col.type === "number") { const n = num(raw); obj[m.key] = n !== undefined ? n : txt; }
      else if (m.col && m.col.list === LEVEL_WORDS) obj[m.key] = parseInt(txt, 10);
      /* A column the schema has never heard of keeps its type. A rent typed
         into a new column has to arrive as a number, or a measure declared
         on it cannot rank anything. */
      else if (!m.col && cellNum(raw) !== undefined) obj[m.key] = cellNum(raw);
      else obj[m.key] = txt;
    }
    if (!any) continue;
    if (isExampleRow(sheet, obj)) { skipped++; continue; }
    obj.__row = r;
    out.push(obj);
  }
  if (skipped) notes.push(`${sheet.name}: ${skipped} example row${skipped === 1 ? "" : "s"} skipped.`);
  return out;
}

/* A form sheet as one object. */
function readForm(ws, sheet, notes) {
  if (!ws) return {};
  const out = {};
  for (let r = 4; r <= ws.rowCount; r++) {
    const label = norm(cellText(ws.getRow(r).getCell(1).value));
    if (!label) continue;
    const f = sheet.fields.find(x => norm(x.label) === label);
    if (!f) continue;
    const raw = ws.getRow(r).getCell(2).value;
    const txt = cellText(raw).trim();
    if (txt === "") continue;
    out[f.key] = f.type === "number" ? (num(raw) !== undefined ? num(raw) : txt) : txt;
  }
  return out;
}

/* Anything the schema does not name, kept on the row. */
function withExtras(obj, sheet) {
  const known = new Set(sheet.columns.map(c => c.key));
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (k !== "__row") out[k] = v;
  return { out, known };
}

/* Every sheet in `sheets`, read by heading: a form as one object, a table
   as a list of rows, extras kept. */
async function readSheets(input, sheets = ATLAS_SHEETS) {
  const wb = new ExcelJS.Workbook();
  if (Buffer.isBuffer(input)) await wb.xlsx.load(input);
  else await wb.xlsx.readFile(input);
  const notes = [];
  const bySheet = {};
  for (const s of sheets) {
    const ws = wb.getWorksheet(s.name);
    if (!ws) { if (s.required) notes.push(`The sheet "${s.name}" is missing from the workbook.`); bySheet[s.name] = s.shape === "form" ? {} : []; continue; }
    bySheet[s.name] = s.shape === "form" ? readForm(ws, s, notes) : readTable(ws, s, notes);
  }
  return { bySheet, notes, wb };
}

async function readWorkbook(input) {
  const SHEETS = ATLAS_SHEETS;
  const { bySheet, notes, wb } = await readSheets(input, SHEETS);

  const bundle = {};
  const S = (n) => SHEETS.find(x => x.name === n);

  /* ---- meta ---- */
  const m = bySheet["Atlas"];
  const meta = {};
  if (m.title) meta.title = m.title;
  if (m.sub) meta.sub = m.sub;
  if (m.asOf) meta.asOf = String(m.asOf);
  if (m.city) meta.city = m.city;
  if (m.centerLng !== undefined || m.centerLat !== undefined) meta.center = [m.centerLng, m.centerLat];
  if (m.zoom !== undefined) meta.zoom = m.zoom;
  if (m.sheet) meta.sheet = m.sheet;
  if (m.speedKmh !== undefined || m.speedFactor !== undefined || m.speedNote) {
    meta.speed = {};
    if (m.speedKmh !== undefined) meta.speed.kmh = m.speedKmh;
    if (m.speedFactor !== undefined) meta.speed.factor = m.speedFactor;
    if (m.speedNote) meta.speed.note = m.speedNote;
  }
  if (m.nextSteps) meta.nextSteps = lines(m.nextSteps);
  bundle.meta = meta;

  /* ---- options, with every unrecognised column kept ---- */
  const optSheet = S("Options");
  bundle.options = bySheet["Options"].map(r => {
    const { out } = withExtras(r, optSheet);
    return out;
  });

  /* ---- zones: the three key figures are value + source pairs ---- */
  const zones = bySheet["Micro-markets"].map(r => {
    const z = { key: r.key, label: r.label };
    if (r.name) z.name = r.name;
    if (r.color) z.color = r.color;
    if (r.character) z.character = r.character;
    for (const f of ["rent", "vacancy", "stock"]) {
      if (r[f + "V"]) { z[f] = { v: r[f + "V"] }; if (r[f + "Src"]) z[f].src = r[f + "Src"]; }
    }
    if (r.pros) z.pros = lines(r.pros);
    if (r.cons) z.cons = lines(r.cons);
    return z;
  });
  if (zones.length) bundle.zones = zones;

  /* ---- places ---- */
  const places = bySheet["Places"].map(r => { const { out } = withExtras(r, S("Places")); return out; });
  if (places.length) bundle.places = places;

  /* ---- transit: one row per station, grouped into lines in sheet order ---- */
  const stations = bySheet["Transit"];
  if (stations.length) {
    const lineOrder = [], byLine = new Map();
    for (const r of stations) {
      const key = String(r.line || "").trim();
      if (!byLine.has(key)) {
        lineOrder.push(key);
        byLine.set(key, { key: camel(key) || `line${lineOrder.length}`, name: key, short: r.lineShort, mode: r.mode, color: r.color, src: r.src, stations: [] });
      }
      const L = byLine.get(key);
      if (!L.short && r.lineShort) L.short = r.lineShort;
      if (!L.mode && r.mode) L.mode = r.mode;
      if (!L.color && r.color) L.color = r.color;
      if (!L.src && r.src) L.src = r.src;
      const st = { name: r.name, lat: r.lat, lng: r.lng };
      const o = yes(r.open);
      if (o !== undefined) st.open = o;
      if (r.eta !== undefined) st.eta = r.eta;
      if (r.target) st.target = r.target;
      L.stations.push(st);
    }
    bundle.transit = { asOf: meta.asOf, lines: lineOrder.map(k => { const L = byLine.get(k); if (!L.short) delete L.short; if (!L.mode) delete L.mode; if (!L.color) delete L.color; if (!L.src) delete L.src; return L; }) };
  }

  /* ---- facts, grouped ---- */
  const facts = {};
  for (const r of bySheet["Facts"]) {
    const g = String(r.group || "other").trim();
    (facts[g] = facts[g] || []).push({ k: r.k, v: r.v, ...(r.asOf ? { asOf: String(r.asOf) } : {}), ...(r.conf ? { conf: r.conf } : {}), ...(r.src ? { src: r.src } : {}), ...(r.note ? { note: r.note } : {}) });
  }
  if (Object.keys(facts).length) bundle.facts = facts;

  /* ---- current office ---- */
  const ex = bySheet["Current office"];
  if (ex && (ex.name || ex.lat !== undefined)) bundle.existing = { id: ex.id || "current", ...ex };

  /* ---- measures ---- */
  const optionHeads = new Map();
  const optWs = wb.getWorksheet("Options");
  if (optWs) optWs.getRow(3).eachCell({ includeEmpty: false }, (cell) => {
    const label = cellText(cell.value).replace(/\*/g, "").trim();
    if (!label) return;
    const known = optSheet.columns.find(c => norm(c.label) === norm(label));
    optionHeads.set(norm(label), known ? known.key : camel(label));
  });
  const measures = bySheet["Priorities"].map(r => {
    const mm = { key: r.key, label: r.label, kind: r.kind };
    if (r.question) mm.question = r.question;
    if (r.of) mm.of = r.of;
    if (r.kind === "column") {
      /* The sheet names the column by its HEADING; the bundle needs the key
         it became, which is why the Options headings are read above. */
      mm.column = optionHeads.get(norm(r.column)) || camel(r.column) || r.column;
      const hib = yes(r.higherIsBetter);
      if (hib !== undefined) mm.higherIsBetter = hib;
      if (r.max !== undefined) mm.max = r.max;
    }
    if (r.kind === "nearestPlace") {
      const k = String(r.placeKind || "").split(",").map(x => x.trim()).filter(Boolean);
      mm.placeKind = k.length > 1 ? k : k[0];
      mm.rings = [15, 30, 45];
    }
    if (r.kind === "nearestStation") {
      if (r.status) mm.status = r.status;
      if (r.mode) mm.mode = r.mode;
    }
    return mm;
  });
  if (measures.length) bundle.measures = measures;

  /* ---- presets: one row per preset per slider ---- */
  const presetRows = bySheet["Presets"];
  if (presetRows.length) {
    const order = [], byKey = new Map();
    for (const r of presetRows) {
      const k = String(r.key || "").trim();
      if (!byKey.has(k)) { order.push(k); byKey.set(k, { key: k, label: r.label || k, note: r.note || "", levels: {} }); }
      const P = byKey.get(k);
      if (r.label && !P.label) P.label = r.label;
      if (r.note && !P.note) P.note = r.note;
      if (yes(r.default)) P.default = true;
      if (r.measure) P.levels[String(r.measure).trim()] = isFinite(r.level) ? r.level : 0;
    }
    bundle.presets = order.map(k => { const P = byKey.get(k); if (!P.note) delete P.note; return P; });
  }

  return { bundle, notes };
}

module.exports = { buildTemplate, readWorkbook, readSheets, SHEETS: ATLAS_SHEETS };
