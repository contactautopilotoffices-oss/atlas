/* ============================================================================
   ATLAS CMS · an atlas from several files at once

   Up to six files, of any mix: Excel workbooks (.xlsx, .csv), PDFs and Word
   documents (.docx). Each is read into text; scanned PDF pages go to the
   model as documents; a filled Atlas workbook among them is passed whole,
   and its pins are kept exactly. One model call combines everything into
   the workbook's sheets.

   Two steps, so a person sees and edits everything in between: plan()
   turns the files into rows keyed by the workbook's headings (the JSON the
   admin shows as editable tables), and _pdf.build() turns rows into the
   atlas. A filled Atlas workbook on its own needs no model: plan() reads
   its rows directly.
   ============================================================================ */
"use strict";
const ExcelJS = require("exceljs");
const JSZip = require("jszip");
const { readWorkbook, readSheets, SHEETS } = require("../../scripts/lib/workbook");
const pdf = require("./_pdf");

const MAX_FILES = 6;
const KINDS = { pdf: "PDF", docx: "Word document", xlsx: "Excel workbook", atlas: "Atlas workbook", csv: "CSV", txt: "text" };

const ext = (name) => (String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");

/* The kind of a file, from its first bytes where they are certain. */
function kindOf(name, buf) {
  const e = ext(name);
  if (buf.slice(0, 5).toString() === "%PDF-") return "pdf";
  const zip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (zip && e === "docx") return "docx";
  if (zip && (e === "xlsx" || e === "xlsm")) return "xlsx";
  if (e === "csv") return "csv";
  if (e === "txt" || e === "md") return "txt";
  if (e === "doc" || e === "xls") return { unsupported: `"${name}" is an old ${e === "doc" ? "Word" : "Excel"} file. Save it as .${e}x and import that.` };
  return { unsupported: `"${name}" is not a file the atlas can read. Use Excel (.xlsx, .csv), PDF or Word (.docx).` };
}

/* Word: the text of word/document.xml, paragraphs as lines, table cells
   separated by " | " so a table reads as rows (a cell's own paragraphs
   stay on its row). */
async function docxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("not a Word document (no word/document.xml)");
  const xml = await f.async("string");
  return decode(xml
    .replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => cell.replace(/<\/w:p>/g, " "))
    .replace(/<w:tab\/>/g, "\t").replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, " | ").replace(/<\/w:tr>/g, "\n").replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, ""))
    .split("\n").map(l => l.replace(/\s*\|\s*$/, "").replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}

const cellText = (v) => {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map(t => t.text).join("");
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.hyperlink) return String(v.hyperlink);
    return "";
  }
  return String(v);
};

/* A spreadsheet as text: each sheet, each row as tab-separated cells. */
async function sheetText(wb, { maxRows = 400 } = {}) {
  const out = [];
  wb.eachSheet((ws) => {
    const lines = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (lines.length >= maxRows) return;
      const cells = [];
      row.eachCell({ includeEmpty: true }, (c) => cells.push(cellText(c.value).replace(/\s+/g, " ").trim()));
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      if (cells.some(Boolean)) lines.push(cells.join("\t"));
    });
    if (lines.length) out.push(`[sheet "${ws.name}"]\n${lines.join("\n")}`);
  });
  return out.join("\n\n");
}

/* Is this workbook the Atlas template, filled in? */
const isAtlasWorkbook = (wb) => {
  const ws = wb.getWorksheet("Options");
  if (!ws) return false;
  const heads = [];
  ws.getRow(3).eachCell({ includeEmpty: false }, (c) => heads.push(cellText(c.value).replace(/\*/g, "").trim()));
  return heads.includes("Property name") && heads.includes("Latitude");
};

/* One file, read. */
async function readSource({ name, buf }) {
  const k = kindOf(name, buf);
  if (typeof k === "object") throw Object.assign(new Error(k.unsupported), { status: 400 });
  if (k === "pdf") {
    const r = await pdf.pdfText(buf);
    return { name, kind: "pdf", pages: r.numPages, scanned: r.scanned, base64: r.scanned.length ? buf.toString("base64") : null,
      text: r.pages.map((t, i) => `--- page ${i + 1} ---\n${t}`).join("\n\n"), truncated: r.truncated };
  }
  if (k === "docx") {
    let text;
    try { text = await docxText(buf); } catch (e) { throw Object.assign(new Error(`"${name}" could not be read as a Word document: ${e.message}.`), { status: 400 }); }
    return { name, kind: "docx", text };
  }
  if (k === "csv" || k === "txt") return { name, kind: k, text: buf.toString("utf8") };
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch (e) { throw Object.assign(new Error(`"${name}" could not be read as an Excel workbook.`), { status: 400 }); }
  if (isAtlasWorkbook(wb)) {
    const read = await readWorkbook(buf);
    return { name, kind: "atlas", text: await sheetText(wb), atlas: read };
  }
  return { name, kind: "xlsx", text: await sheetText(wb) };
}

/* A filled Atlas workbook as rows keyed by its own headings, the same
   shape the model returns, so it opens in the same editor. Example rows
   the template ships with are left out, as when it is uploaded. */
async function workbookRows(buf) {
  const { bySheet, wb } = await readSheets(buf, SHEETS);
  const rows = {};
  for (const s of SHEETS) {
    const got = bySheet[s.name];
    if (s.shape === "form") {
      const o = {};
      for (const f of s.fields) if (got && got[f.key] != null && got[f.key] !== "") o[f.label] = got[f.key];
      if (Object.keys(o).length) rows[s.name] = o;
      continue;
    }
    const ws = wb.getWorksheet(s.name);
    if (!ws || !got || !got.length) continue;
    const heads = [];
    ws.getRow(3).eachCell({ includeEmpty: false }, (c, i) => { const l = cellText(c.value).replace(/\*/g, "").trim(); if (l) heads.push([i, l]); });
    rows[s.name] = got.map(r => {
      const row = ws.getRow(r.__row), o = {};
      for (const [i, l] of heads) {
        const v = row.getCell(i).value, t = cellText(v).trim();
        if (t === "") continue;
        o[l] = typeof v === "number" ? v : (v && typeof v === "object" && typeof v.result === "number") ? v.result : t;
      }
      return o;
    });
  }
  return rows;
}

/* Every file read, or the first one that cannot be. */
async function readAll(files) {
  if (!Array.isArray(files) || !files.length) throw Object.assign(new Error("Choose at least one file."), { status: 400 });
  if (files.length > MAX_FILES) throw Object.assign(new Error(`Up to ${MAX_FILES} files at a time; you chose ${files.length}.`), { status: 400 });
  const sources = [];
  for (const f of files) sources.push({ ...(await readSource(f)), buf: f.buf });
  const summary = sources.map(s => ({ name: s.name, kind: KINDS[s.kind], pages: s.pages || null, scanned: s.scanned || [], chars: (s.text || "").length }));
  return { sources, summary };
}

/* All the files' text, each under its own heading, cut at the model's limit. */
function sourceText(sources, notes = []) {
  let text = sources.map((s, i) => `===== FILE ${i + 1} of ${sources.length}: "${s.name}" (${KINDS[s.kind]}${s.pages ? `, ${s.pages} page${s.pages === 1 ? "" : "s"}` : ""}) =====\n${s.kind === "atlas" ? "This is a filled Atlas workbook: keep its rows as they are.\n" : ""}${s.text || "(no text)"}`).join("\n\n");
  if (text.length > pdf.MAX_CHARS) { text = text.slice(0, pdf.MAX_CHARS); notes.push(`The files' text was cut at ${pdf.MAX_CHARS.toLocaleString("en-IN")} characters; split very long documents.`); }
  return text;
}

/* Plan: the files (and the requirement and brief, when given) into rows a
   person can edit before anything is built. A filled Atlas workbook on its
   own, with no requirement to apply, is read exactly, no model. */
async function plan(files, { llm = pdf.askModel, requirement = "", brief = null } = {}) {
  const { sources, summary } = await readAll(files);
  const notes = [];
  const label = (sources.length === 1 ? sources[0].name : `${sources.length} files: ${sources.map(s => s.name).join(", ")}`).slice(0, 200);
  const steer = String(requirement || "").trim() || (brief && Object.keys(brief).length);

  if (sources.length === 1 && sources[0].kind === "atlas" && !steer) {
    return { direct: true, rows: await workbookRows(sources[0].buf), notes: sources[0].atlas.notes || [], files: summary, label, text: sourceText(sources) };
  }

  const keepPins = {};
  for (const s of sources.filter(s => s.kind === "atlas")) {
    for (const o of s.atlas.bundle.options || []) if (o.id && isFinite(o.lat) && isFinite(o.lng)) keepPins[`Options:${String(o.id).toLowerCase()}`] = { lat: o.lat, lng: o.lng, precision: o.precision, src: o.geoSrc };
    for (const p of s.atlas.bundle.places || []) if (p.id && isFinite(p.lat) && isFinite(p.lng)) keepPins[`Places:${String(p.id).toLowerCase()}`] = { lat: p.lat, lng: p.lng, precision: p.precision, src: p.src };
  }
  const text = sourceText(sources, notes);
  const scanned = [];
  for (const s of sources) if (s.scanned && s.scanned.length) scanned.push(`pages ${s.scanned.join(", ")} of "${s.name}"`);
  for (const s of sources) if (s.truncated) notes.push(`"${s.name}" is long; only its first pages were read.`);

  const asked = await llm({
    text, scanned, requirement, brief, fileNames: sources.map(s => s.name), fileName: sources[0].name,
    documents: sources.filter(s => s.base64).map(s => ({ name: s.name, base64: s.base64 })),
  });
  const sn = pdf.scanNote(scanned, asked.unread);
  if (sn) notes.push(sn);
  const rows = pdf.shapeRows(asked.rows);
  /* The model is told to keep a workbook's rows; say so if it dropped any. */
  for (const s of sources.filter(s => s.kind === "atlas")) {
    const back = new Set((rows["Options"] || []).map(r => String(r["ID"] || "").trim().toLowerCase()));
    const lost = (s.atlas.bundle.options || []).map(o => String(o.id || "")).filter(id => id && !back.has(id.toLowerCase()));
    if (lost.length) notes.push(`${lost.length} propert${lost.length === 1 ? "y" : "ies"} from "${s.name}" did not come back from the model: ${lost.slice(0, 8).join(", ")}${lost.length > 8 ? " and more" : ""}. Add ${lost.length === 1 ? "it" : "them"} on the Options tab, or plan "${s.name}" on its own.`);
  }
  const kept = pdf.restorePins(rows, keepPins);
  if (kept) notes.push(`${kept} pin${kept === 1 ? " was" : "s were"} kept exactly as the workbook had ${kept === 1 ? "it" : "them"}.`);
  return { rows, notes, files: summary, label, text, model: asked.model, provider: asked.provider };
}

/* Plan and build in one go (what Build does when there is no plan yet). */
async function importSources(files, { llm, geocoder, requirement, brief } = {}) {
  const p = await plan(files, { llm, requirement, brief });
  const out = await pdf.build(p.rows, { fileName: p.label, notes: p.notes.slice(), geocoder });
  return { ...out, direct: !!p.direct, files: p.files, model: p.model, provider: p.provider };
}

module.exports = { importSources, plan, readAll, sourceText, workbookRows, readSource, docxText, kindOf, MAX_FILES };
