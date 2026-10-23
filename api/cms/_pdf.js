/* ============================================================================
   ATLAS CMS · an atlas from a PDF

   A broker sends a PDF: an inventory table, a list of flex centres, a
   market note. Nobody should have to retype it into the workbook. This
   reads the PDF, asks a model to put what it says into the workbook's own
   sheets and columns, geocodes the addresses it found, and hands back both
   the bundle and the filled-in workbook so a person can check the pins and
   correct anything before it is published.

   Reading   pdfjs reads the text layer. A page with no text layer (a scan,
             a photographed sheet) is sent to Claude as a document, which
             reads the image itself: that is the OCR, and it needs
             ANTHROPIC_API_KEY. With only ENGY_API_KEY set, text PDFs work and
             a scanned one is refused with a plain message.
   Model     ENGY_API_KEY (engy.ai, OpenAI-compatible) or ANTHROPIC_API_KEY,
             the same keys God's Eye uses; CMS_PDF_PROVIDER picks when both
             are set. The model is told never to invent a coordinate: it
             returns addresses and localities, and leaves latitude and
             longitude empty unless the PDF states them.
   Pins      MAPBOX_TOKEN geocodes each address (Mapbox Geocoding v6,
             India only). Every pin it places is marked "locality" or
             "street" precision with the query as its source, so the page
             says so and the person knows which pins to check.
   Output    the rows as the model returned them (sheet by sheet, in the
             workbook's column headings), the .xlsx built from them, and the
             bundle read back from that very file by the same reader a
             hand-filled workbook goes through. There is one path.
   ============================================================================ */
"use strict";
const { SHEETS } = require("../../scripts/lib/workbook-schema");
const { buildTemplate, readWorkbook } = require("../../scripts/lib/workbook");
const { validate } = require("../../scripts/lib/validate-bundle");
const llm = require("./_llm");

const MAX_PAGES = 60;
const MAX_CHARS = 180000;

/* ------------------------------------------------------------- reading -- */
async function pdfText(buf) {
  /* pdfjs loads its worker by a path it builds at run time, which Vercel's
     bundler cannot see, so the worker was left out of the deployed function
     ("Setting up fake worker failed"). Importing it here by name puts it in
     the bundle, and pdfjs uses a worker already on globalThis instead of
     importing its own. */
  if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages = [], scanned = [], blank = [];
  const n = Math.min(doc.numPages, MAX_PAGES);
  /* A page with (almost) no text is a scan only if something is drawn on
     it: a picture, or a lot of vector paths (text saved as outlines). A
     page with neither is blank, and needs no model that can see. */
  const IMG = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageMaskXObject, pdfjs.OPS.paintJpegXObject].filter(x => x != null));
  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let out = "", lastY = null;
    for (const it of tc.items) {
      if (!("str" in it)) continue;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) out += "\n";
      else if (out && !out.endsWith("\n") && !out.endsWith(" ") && it.str && !it.str.startsWith(" ")) out += " ";
      out += it.str;
      lastY = y;
    }
    pages.push(out.replace(/[ \t]+\n/g, "\n").trim());
    if (pages[p - 1].replace(/\s+/g, "").length < 40) {
      const ops = await page.getOperatorList();
      (ops.fnArray.some(f => IMG.has(f)) || ops.fnArray.length > 200 ? scanned : blank).push(p);
    }
  }
  return { pages, numPages: doc.numPages, truncated: doc.numPages > MAX_PAGES, scanned, blank, chars: pages.join("").length };
}

/* ------------------------------------------------------------- the ask -- */
/* The workbook, described to the model sheet by sheet, from the same
   schema that generates the template. Headings are the keys it must use,
   so what comes back drops straight into the sheets. */
function sheetGuide() {
  const lines = [];
  for (const s of SHEETS) {
    if (s.optional) continue;
    const cols = s.shape === "form" ? s.fields : s.columns;
    lines.push(`Sheet "${s.name}" (${s.shape === "form" ? "one object" : "a list of rows"})${s.required ? ", REQUIRED" : ""}: ${s.blurb}`);
    for (const c of cols) lines.push(`  - "${c.label}"${c.required ? " (required)" : ""}${c.type === "number" ? " [number]" : ""}${c.list ? ` [one of: ${c.list.join(", ")}]` : ""}: ${c.hint || ""}`.replace(/\s+$/, ""));
    if (s.extras) lines.push(`  - ${s.extras}`);
  }
  return lines.join("\n");
}

const RULES = `You turn one or more property documents (PDFs, Word documents, spreadsheets) into the sheets of one Atlas workbook. Reply with ONE JSON object and nothing else: keys are sheet names, values are an object (for a one-object sheet) or an array of row objects (for a list sheet), each keyed by the exact column headings below.

Rules:
- Use only what the documents say. Never invent a figure, a name, a date or a source.
- When several documents describe the same building or place, make ONE row for it and combine what they say. If they disagree on a figure, keep the one from the most recent or most specific document and say which in a "Note" column.
- When a filled Atlas workbook is among the documents, keep every row it has exactly as it is (same ID, same figures, same coordinates) and add what the other documents contain, as new rows or new columns.
- NEVER invent a coordinate. Leave "Latitude" and "Longitude" out unless the document prints them. Always fill "Address" and "Locality" (and the city) as fully as the document allows; they are what the pins are placed from.
- The properties being offered, proposed or compared go on "Options", one row each, with "ID" a short lower-case slug of the name. Put every figure the document gives for them (grade, floor, carpet area, built-up area, rent, CAM, parking, approvals, availability, nearest metro and so on) in extra columns with short plain headings, numbers as numbers (no currency signs or units in the cell; put the unit in the heading, such as "Rent on carpet (Rs per sq ft)").
- Other buildings and businesses the document lists around them (competitors, coworking centres, employers, hospitals, colleges) go on "Places", with "Kind" naming the group (flex, employer, edu, hospital, retail, hotel). Put their figures (price per seat, grade, operator) in "Second line" and "Note".
- Stations the document mentions go on "Transit" only if it names the line.
- Figures about the market as a whole (rents, vacancy, absorption, deals) go on "Facts" with a "Group". Put the document's name in "Source" when there is no link.
- "Atlas": "Title" from the document's own title or subject, "Data current to" as YYYY-MM from the document (or the newest date in it), "City". Leave the centre and zoom out; they are worked out from the pins.
- If a micro-market or locality groups the options (Chakala, Marol, BKC), add a "Micro-markets" row per group with "Key" a lower-case slug and "Short name" the name, and point each option's "Micro-market" at the key.
- When the person gives a requirement or a brief: write the Atlas "Subtitle" as who it is for and what they need; put the brief's main lines (seats, budget, where, move-in, must haves) on "Facts" with Group "Requirement" and Source "Client brief"; put its open questions in the Atlas "Next steps", one per line; and set each option's "Fit group" (best, good, conditional, or a short phrase) and "Why it scores as it does" (one or two sentences citing the documents' figures) against it. Never change a document's figure to suit the brief.
- A spreadsheet may hold one record per column instead of per row (field names down the first column, one building or centre per column). Read it either way.
- A link a document gives for a row (photos, a listing, a drive folder) goes in that row's source column.
- Keep text in the document's words, trimmed. No commentary, no markdown fences.`;

/* The requirement and the brief, when the person gave them. */
const askFor = (requirement, brief) => {
  const r = String(requirement || "").trim().slice(0, 4000);
  const b = brief && typeof brief === "object" && Object.keys(brief).length ? JSON.stringify(brief, null, 1).slice(0, 8000) : "";
  return `${r ? `THE REQUIREMENT, IN THE PERSON'S WORDS\n${r}\n\n` : ""}${b ? `THE BRIEF (structured, and possibly edited by the person; it wins over the requirement)\n${b}\n\n` : ""}`;
};

const parseJSON = llm.parseJSON;

function providerName() {
  const want = (process.env.CMS_PDF_PROVIDER || "").toLowerCase();
  if (want === "claude" && process.env.ANTHROPIC_API_KEY) return "claude";
  if (want === "engy" && process.env.ENGY_API_KEY) return "engy";
  return process.env.ANTHROPIC_API_KEY ? "claude" : process.env.ENGY_API_KEY ? "engy" : null;
}

/* Ask the model. `text` is what was read from the files; scanned PDFs are
   sent as documents too (`pdfBase64` for one, `documents` for several), so
   a provider that can look at a page reads what has no text layer. */
async function askModel({ text, pdfBase64, documents, scanned, fileName, fileNames, requirement, brief }, provider = providerName(), opts = {}) {
  if (!provider) throw Object.assign(new Error("Reading PDFs, Word documents and other spreadsheets needs ENGY_API_KEY or ANTHROPIC_API_KEY set in Vercel. Until then, fill in the workbook instead."), { status: 503 });
  const guide = sheetGuide();
  const docs = documents || (pdfBase64 ? [{ name: fileName, base64: pdfBase64 }] : []);
  const names = fileNames && fileNames.length > 1 ? `There are ${fileNames.length} documents: ${fileNames.map(n => `"${n}"`).join(", ")}.` : `The document is "${fileName || (fileNames && fileNames[0]) || "document.pdf"}".`;
  const intro = `${names}${scanned.length && provider === "claude" ? ` These pages have no text layer: ${scanned.join(", ")}. Read them from the attached document${docs.length === 1 ? "" : "s"}.` : ""}\n\nTHE SHEETS AND THEIR COLUMNS\n${guide}\n\n${askFor(requirement, brief)}THE DOCUMENTS' TEXT\n${text}`;
  if (provider === "claude") {
    const content = [];
    if (scanned.length) for (const d of docs) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.base64 }, ...(d.name ? { title: String(d.name).slice(0, 200) } : {}) });
    content.push({ type: "text", text: intro });
    /* Reading is copying, not reasoning: low effort keeps it well inside
       the function's time limit, and the room left is for the answer. */
    const r = await llm.claude({ model: process.env.CMS_PDF_MODEL || "claude-sonnet-5-5", system: RULES, content, maxTokens: 32000, effort: "low", client: opts.client });
    return { rows: parseJSON(r.text, r.stop), model: r.model, provider };
  }
  /* Engy reads text only. With text to go on, read that and say which
     pages were left; with nothing but scans, stop and say what is needed. */
  let unread = [];
  if (scanned.length) {
    const where = scanned.map(x => typeof x === "number" ? `page ${x}` : x).join("; ");
    if (String(text || "").replace(/\s+/g, "").length < 200) throw Object.assign(new Error(`Only scanned pages here (${where}). Reading scans needs ANTHROPIC_API_KEY; the Engy model reads text only.`), { status: 422 });
    unread = scanned;
  }
  const base = (process.env.ENGY_BASE_URL || "https://api.engy.ai/v1").replace(/\/+$/, "");
  const model = process.env.CMS_PDF_MODEL || "engy/deepseek-v4-flash-0731";
  const res = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.ENGY_API_KEY },
    body: JSON.stringify({ model, max_tokens: 16000, temperature: 0, messages: [{ role: "system", content: RULES }, { role: "user", content: intro }] }),
  });
  if (!res.ok) throw Object.assign(new Error(`The model endpoint answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`), { status: 502 });
  const j = await res.json();
  const ch = (j.choices && j.choices[0]) || {};
  return { rows: parseJSON(ch.message && ch.message.content, ch.finish_reason), model: j.model || model, provider, unread };
}

/* What became of the scanned pages, for the notes under the report. */
const scanNote = (scanned, unread) => {
  const where = (list) => list.map(x => typeof x === "number" ? `page ${x}` : x).join("; ");
  if (unread && unread.length) return `Not read, because they are scans and the Engy model reads text only: ${where(unread)}. Set ANTHROPIC_API_KEY to read scans.`;
  if (scanned && scanned.length) return `Read as images (no text layer): ${where(scanned)}.`;
  return null;
};

/* ------------------------------------------------------------ geocoding -- */
const PRECISION_OF = { address: "building", poi: "poi", street: "street", neighborhood: "locality", locality: "locality", place: "approx", district: "approx", region: "approx", postcode: "approx" };

/* Mapbox Geocoding v6. Returns { lng, lat, precision, label } or null. */
async function mapboxGeocode(query, fetchFn = fetch) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) return null;
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&country=in&limit=1&access_token=${encodeURIComponent(token)}`;
  const r = await fetchFn(url);
  if (!r.ok) return null;
  const j = await r.json();
  const f = j.features && j.features[0];
  if (!f || !f.geometry) return null;
  const [lng, lat] = f.geometry.coordinates;
  const type = f.properties && f.properties.feature_type;
  return { lng, lat, precision: PRECISION_OF[type] || "approx", label: (f.properties && f.properties.full_address) || query };
}

const num = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(/[, ]/g, "")); return isFinite(n) ? n : undefined; };
const has = (row, k) => num(row[k]) !== undefined;

/* Place every row that has no coordinates but has something to search for.
   Rows that cannot be placed are left as they are; the validator will name
   them, and the person fills them in. */
async function geocodeRows(rows, geocoder, city) {
  const placed = [], failed = [];
  const tryRow = async (sheet, row, nameKey) => {
    if (has(row, "Latitude") && has(row, "Longitude")) return;
    const bits = [row[nameKey], row["Address"], row["Locality"], row["Second line"], city].filter(Boolean).map(String);
    const seen = new Set();
    const queries = [bits.filter((b, i) => i === 0 || (!seen.has(b) && seen.add(b))).join(", "), [row["Address"], row["Locality"], city].filter(Boolean).join(", "), [row[nameKey], city].filter(Boolean).join(", ")]
      .map(q => q.replace(/\s+/g, " ").trim()).filter((q, i, a) => q && a.indexOf(q) === i);
    for (const q of queries) {
      let g = null;
      try { g = await geocoder(q); } catch (e) { g = null; }
      if (!g) continue;
      row["Latitude"] = g.lat; row["Longitude"] = g.lng;
      row["How exact is the pin"] = g.precision;
      row["Source for the position"] = `Geocoded by Mapbox from "${q}" (${g.label}); check the pin`;
      placed.push(`${sheet}: ${row[nameKey]}`);
      return;
    }
    failed.push(`${sheet}: ${row[nameKey] || "(unnamed)"}`);
  };
  for (const r of rows["Options"] || []) await tryRow("Options", r, "Property name");
  for (const r of rows["Places"] || []) await tryRow("Places", r, "Name");
  for (const r of rows["Transit"] || []) await tryRow("Transit", r, "Station name");
  if (rows["Current office"] && rows["Current office"]["Name"]) await tryRow("Current office", rows["Current office"], "Name");
  return { placed, failed };
}

/* ------------------------------------------------------------- workbook -- */
const label = (v) => String(v == null ? "" : v).replace(/\*/g, "").trim();
function heads(ws) { const m = new Map(); ws.getRow(3).eachCell({ includeEmpty: false }, (c, i) => { const t = label(c.value); if (t) m.set(t.toLowerCase(), i); }); return m; }

/* The rows become a workbook exactly as a person would have filled it in:
   the template, with the rows under the headings, and any extra column the
   model used added to the Options sheet. */
async function fillWorkbook(rows) {
  const wb = buildTemplate();
  for (const s of SHEETS) {
    const ws = wb.getWorksheet(s.name);
    const data = rows[s.name];
    /* The template's example rows are skipped on reading anyway; take them
       out of sheets the rows leave empty too, so no note reports them. */
    if (ws && s.shape === "table" && !data) { while (ws.rowCount >= 4) ws.spliceRows(4, 1); continue; }
    if (!ws || !data) continue;
    if (s.shape === "form") {
      if (typeof data !== "object" || Array.isArray(data)) continue;
      const want = new Map(Object.entries(data).map(([k, v]) => [label(k).toLowerCase(), v]));
      for (let r = 4; r <= ws.rowCount; r++) {
        const l = label(ws.getRow(r).getCell(1).value).toLowerCase();
        if (want.has(l) && want.get(l) != null && String(want.get(l)).trim() !== "") ws.getRow(r).getCell(2).value = cell(want.get(l));
      }
      continue;
    }
    if (!Array.isArray(data)) continue;
    const h = heads(ws);
    const known = new Set((s.columns || []).map(c => c.label.toLowerCase()));
    /* Drop the template's example rows so the model's rows start at row 4. */
    while (ws.rowCount >= 4) ws.spliceRows(4, 1);
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = ws.getRow(ws.rowCount + 1);
      for (const [k, v] of Object.entries(row)) {
        if (v == null || String(v).trim() === "") continue;
        const l = label(k);
        let i = h.get(l.toLowerCase());
        if (!i) {
          if (!EXTRA_OK.has(s.name) || known.has(l.toLowerCase())) continue;
          i = ws.columnCount + 1; ws.getRow(3).getCell(i).value = l; h.set(l.toLowerCase(), i);
        }
        r.getCell(i).value = cell(v);
      }
      r.commit();
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const EXTRA_OK = new Set(["Options", "Places"]);   // sheets that keep a column the schema does not name
const cell = (v) => Array.isArray(v) ? v.map(String).join("\n") : (typeof v === "object" ? JSON.stringify(v) : v);

/* ---------------------------------------------------------------- whole -- */
/* The whole path. `llm` and `geocoder` are injectable so the pipeline is
   tested without a key or the network. */
async function importPdf(buf, { fileName, llm = askModel, geocoder = mapboxGeocode } = {}) {
  const read = await pdfText(buf);
  const notes = [];
  if (read.truncated) notes.push(`The PDF has ${read.numPages} pages; only the first ${MAX_PAGES} were read.`);
  let text = read.pages.map((t, i) => `--- page ${i + 1} ---\n${t}`).join("\n\n");
  if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); notes.push("The PDF's text was cut at 180,000 characters."); }

  const asked = await llm({ text, pdfBase64: read.scanned.length ? buf.toString("base64") : null, scanned: read.scanned, fileName });
  const sn = scanNote(read.scanned, asked.unread);
  if (sn) notes.push(sn);
  const out = await finish(asked, { fileName, notes, geocoder });
  return { ...out, read: { pages: read.numPages, chars: read.chars, scanned: read.scanned } };
}

/* What the model returned, made into an atlas: defaults filled, pins kept
   from a workbook (`keepPins`, by ID) or placed from addresses, the centre
   worked out, the rows written into a real workbook and read back by the
   same reader a hand-filled one goes through. */
/* The model's rows in the shape the workbook needs: a table sheet as a
   list, the Atlas sheet as one object. */
function shapeRows(input) {
  const rows = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  for (const s of SHEETS) {
    if (rows[s.name] == null) continue;
    if (s.shape === "table" && !Array.isArray(rows[s.name])) rows[s.name] = typeof rows[s.name] === "object" ? [rows[s.name]] : [];
    if (s.shape === "form" && (typeof rows[s.name] !== "object" || Array.isArray(rows[s.name]))) rows[s.name] = {};
    if (s.shape === "table") rows[s.name] = rows[s.name].filter(r => r && typeof r === "object" && !Array.isArray(r));
  }
  return rows;
}

/* A pin that came from a workbook is never replaced by the model or by a
   geocode: put it back by ID before anything is placed. */
function restorePins(rows, keepPins = {}) {
  let kept = 0;
  for (const sheet of ["Options", "Places"]) for (const r of rows[sheet] || []) {
    const id = String(r["ID"] || "").trim().toLowerCase(), p = id && keepPins[`${sheet}:${id}`];
    if (!p) continue;
    r["Latitude"] = p.lat; r["Longitude"] = p.lng;
    if (p.precision) r["How exact is the pin"] = p.precision;
    if (p.src) r[sheet === "Options" ? "Source for the position" : "Source"] = r[sheet === "Options" ? "Source for the position" : "Source"] || p.src;
    kept++;
  }
  return kept;
}

async function finish(asked, { fileName, notes, geocoder = mapboxGeocode, keepPins = {} }) {
  const rows = shapeRows(asked.rows);
  const kept = restorePins(rows, keepPins);
  if (kept) notes.push(`${kept} pin${kept === 1 ? " was" : "s were"} kept exactly as the workbook had ${kept === 1 ? "it" : "them"}.`);
  const out = await build(rows, { fileName, notes, geocoder });
  return { ...out, model: asked.model, provider: asked.provider };
}

/* Rows, as the model gave them or as a person edited them, into an atlas:
   pins from addresses where there are none, the workbook filled in, read
   back exactly as an uploaded workbook would be, and checked. */
async function build(input, { fileName, notes = [], geocoder = mapboxGeocode } = {}) {
  const rows = shapeRows(input);
  const atlas = rows["Atlas"] = (rows["Atlas"] && typeof rows["Atlas"] === "object" && !Array.isArray(rows["Atlas"])) ? rows["Atlas"] : {};
  if (!atlas["Source workbook"]) atlas["Source workbook"] = fileName || "PDF";
  if (!atlas["Title"]) atlas["Title"] = (fileName || "Atlas").replace(/\.(pdf|docx|xlsx|csv)$/i, "").replace(/[_-]+/g, " ");
  if (!atlas["Data current to"]) atlas["Data current to"] = new Date().toISOString().slice(0, 7);

  const geo = await geocodeRows(rows, geocoder, atlas["City"]);
  const opts = (rows["Options"] || []).filter(r => has(r, "Latitude") && has(r, "Longitude"));
  if (opts.length && !(has(atlas, "Centre latitude") && has(atlas, "Centre longitude"))) {
    atlas["Centre latitude"] = +(opts.reduce((a, r) => a + num(r["Latitude"]), 0) / opts.length).toFixed(5);
    atlas["Centre longitude"] = +(opts.reduce((a, r) => a + num(r["Longitude"]), 0) / opts.length).toFixed(5);
  }
  if (!has(atlas, "Opening zoom")) atlas["Opening zoom"] = 13;
  (rows["Options"] || []).forEach((r, i) => { if (!r["Rank"]) r["Rank"] = i + 1; if (!r["ID"] && r["Property name"]) r["ID"] = slug(r["Property name"]); });
  (rows["Places"] || []).forEach((r, i) => { if (!r["ID"]) r["ID"] = slug(r["Name"] || `place-${i + 1}`); });

  if (geo.placed.length) notes.push(`${geo.placed.length} pin${geo.placed.length === 1 ? " was" : "s were"} placed by geocoding the address, marked as such on the page. Check ${geo.placed.length === 1 ? "it" : "them"} on the preview and correct any that are off in the plan.`);
  if (geo.failed.length) notes.push(`${geo.failed.length} could not be placed and need a latitude and longitude in the plan: ${geo.failed.slice(0, 8).join("; ")}${geo.failed.length > 8 ? "; and more" : ""}.`);
  if (!process.env.MAPBOX_TOKEN && geocoder === mapboxGeocode) notes.push("MAPBOX_TOKEN is not set, so no address could be geocoded.");

  const xlsx = await fillWorkbook(rows);
  const out = await readWorkbook(xlsx);
  const rep = validate(out.bundle);
  return {
    bundle: out.bundle, notes: [...notes, ...out.notes], report: { ok: rep.ok, errors: rep.errors, warnings: rep.warnings, stats: rep.stats },
    workbook: xlsx.toString("base64"), rows,
    placed: geo.placed, unplaced: geo.failed,
  };
}
const slug = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

module.exports = { pdfText, askModel, askFor, scanNote, importPdf, finish, build, shapeRows, restorePins, MAX_CHARS, fillWorkbook, geocodeRows, mapboxGeocode, sheetGuide, parseJSON, providerName };
