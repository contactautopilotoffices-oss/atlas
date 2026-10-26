/* ============================================================================
   ATLAS CMS · system check

   Everything creating an atlas or a case study depends on, tested live on
   the server, so /admin/ can show it green or say exactly what to fix:
   the database and each migration's tables, the storage bucket, the
   session secret, the PDF reader (it actually reads a small PDF), the AI
   key (a free call that lists models), Mapbox (one geocode) and the
   optional keys. Nothing here writes to the database.

   Each check: { key, label, status: ok | warn | fail | off, detail, fix,
   needed: "atlas" | "case" | "optional" }. "fail" stops what it is needed
   for; "warn" works with less; "off" is an optional feature not set up.
   ============================================================================ */
"use strict";
const store = require("./_store");

const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/* A one-page PDF with a line of text, built here with correct offsets, so
   the check reads a real PDF without shipping a file. */
function tinyPdf(text) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 12 Tf 20 50 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const timed = (p, ms, what) => Promise.race([p, new Promise((_, bad) => setTimeout(() => bad(new Error(`${what} did not answer within ${ms / 1000} s`)), ms))]);

async function tableExists(t) {
  try { await store.select(t, { limit: 1 }); return { ok: true }; }
  catch (e) { return { ok: false, why: String(e.message || e).slice(0, 160) }; }
}

async function run({ fetchFn = fetch } = {}) {
  const C = [];
  const add = (c) => C.push(c);

  /* ---- database ---- */
  if (store.MODE === "supabase") add({ key: "db", label: "Database (Supabase)", status: "ok", detail: "Connected with the service role key.", needed: "atlas" });
  else if (store.MODE === "dev") add({ key: "db", label: "Database (Supabase)", status: "warn", detail: "Running on the local development store, not Supabase.", fix: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.", needed: "atlas" });
  else add({ key: "db", label: "Database (Supabase)", status: "fail", detail: "No database is configured.", fix: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.", needed: "atlas" });

  const MIG = [
    ["016", ["atlas_bundles", "atlas_access"], "atlas", "Atlases from a workbook and their access IDs"],
    ["017", ["atlas_bundle_history"], "atlas", "Numbered versions of each publish"],
    ["018", ["atlas_cases", "atlas_case_history"], "case", "Case studies"],
  ];
  if (store.MODE !== "off") {
    for (const [n, tables, needed, what] of MIG) {
      const res = await Promise.all(tables.map(tableExists));
      const missing = tables.filter((t, i) => !res[i].ok);
      add(missing.length
        ? { key: `mig${n}`, label: `Migration ${n}`, status: "fail", detail: `${what}: missing table${missing.length > 1 ? "s" : ""} ${missing.join(", ")}.`, fix: `Run supabase/migrations/${n}_*.sql in the Supabase SQL editor.`, needed }
        : { key: `mig${n}`, label: `Migration ${n}`, status: "ok", detail: `${what}: ${tables.join(", ")} present.`, needed });
    }
  }

  /* ---- storage ---- */
  if (store.MODE === "supabase") {
    try {
      const r = await timed(fetchFn(`${SB_URL}/storage/v1/bucket/atlas-cms`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }), 8000, "Supabase storage");
      const j = await r.json().catch(() => ({}));
      add(r.ok && j.id ? { key: "storage", label: "File storage (bucket atlas-cms)", status: j.public ? "ok" : "warn", detail: j.public ? "Present and public, so pictures load on the page." : "Present but not public: pictures will not load on the page.", fix: j.public ? undefined : "Run supabase/migrations/013_cms.sql again, or make the bucket public in Supabase Storage.", needed: "case" }
        : { key: "storage", label: "File storage (bucket atlas-cms)", status: "fail", detail: `Not found (${r.status}).`, fix: "Run supabase/migrations/013_cms.sql in the Supabase SQL editor.", needed: "case" });
    } catch (e) { add({ key: "storage", label: "File storage (bucket atlas-cms)", status: "fail", detail: e.message, needed: "case" }); }
  }

  /* ---- sign-in ---- */
  add(process.env.CMS_SESSION_SECRET
    ? { key: "secret", label: "Session secret", status: "ok", detail: "CMS_SESSION_SECRET is set: client sign-ins can be issued.", needed: "atlas" }
    : { key: "secret", label: "Session secret", status: store.MODE === "dev" ? "warn" : "fail", detail: "CMS_SESSION_SECRET is not set: nobody can sign in to a published atlas.", fix: "Set CMS_SESSION_SECRET in Vercel to a long random string.", needed: "atlas" });

  /* ---- PDF reader: read a real PDF with the deployed code ---- */
  try {
    const { pdfText } = require("./_pdf");
    const r = await timed(pdfText(tinyPdf("Atlas system check")), 15000, "The PDF reader");
    const ok = /Atlas system check/.test(r.pages.join(" "));
    add({ key: "pdf", label: "PDF reader", status: ok ? "ok" : "fail", detail: ok ? "Read a test PDF on the server." : `Read a test PDF but found "${r.pages.join(" ").slice(0, 60)}".`, needed: "atlas" });
  } catch (e) { add({ key: "pdf", label: "PDF reader", status: "fail", detail: String(e.message || e).slice(0, 220), fix: "This is a code or deploy problem; send this line to whoever maintains the site.", needed: "atlas" }); }

  /* ---- AI model ---- */
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await timed(fetchFn("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } }), 10000, "Anthropic");
      add(r.ok ? { key: "ai", label: "AI model (Anthropic)", status: "ok", detail: "Key accepted. PDF import (including scans) and the helper can run.", needed: "atlas" }
        : { key: "ai", label: "AI model (Anthropic)", status: "fail", detail: `Anthropic refused the key (${r.status}).`, fix: "Check ANTHROPIC_API_KEY in Vercel, then redeploy.", needed: "atlas" });
    } catch (e) { add({ key: "ai", label: "AI model (Anthropic)", status: "warn", detail: e.message, needed: "atlas" }); }
  } else if (process.env.ENGY_API_KEY) {
    add({ key: "ai", label: "AI model (Engy)", status: "warn", detail: "ENGY_API_KEY is set: text PDFs and the helper work. Scanned PDFs need ANTHROPIC_API_KEY.", fix: "Add ANTHROPIC_API_KEY to read scanned PDFs.", needed: "atlas" });
  } else {
    add({ key: "ai", label: "AI model", status: "fail", detail: "No AI key: Upload a PDF and the helper are off. Workbook upload still works.", fix: "Set ANTHROPIC_API_KEY in Vercel, then redeploy.", needed: "atlas" });
  }

  /* ---- Mapbox: one geocode ---- */
  if (process.env.MAPBOX_TOKEN) {
    try {
      const { mapboxGeocode } = require("./_pdf");
      const g = await timed(mapboxGeocode("Andheri East, Mumbai", fetchFn), 10000, "Mapbox");
      add(g ? { key: "mapbox", label: "Map pins from addresses (Mapbox)", status: "ok", detail: `Geocoded a test address to ${g.lat.toFixed(3)}, ${g.lng.toFixed(3)}.`, needed: "atlas" }
        : { key: "mapbox", label: "Map pins from addresses (Mapbox)", status: "fail", detail: "MAPBOX_TOKEN is set but the geocoding request failed.", fix: "Check the token in Vercel is valid and allows the Geocoding API (and is not limited to the site's URL only).", needed: "atlas" });
    } catch (e) { add({ key: "mapbox", label: "Map pins from addresses (Mapbox)", status: "warn", detail: e.message, needed: "atlas" }); }
  } else {
    add({ key: "mapbox", label: "Map pins from addresses (Mapbox)", status: "fail", detail: "MAPBOX_TOKEN is not set on the server: PDF imports come back with no pins.", fix: "Set MAPBOX_TOKEN in Vercel, then redeploy.", needed: "atlas" });
  }

  /* ---- metro from OpenStreetMap: a fundamental, but an atlas builds without it ---- */
  try {
    const { metroRows } = require("./_metro");
    const m = await timed(metroRows([{ lat: 19.1136, lng: 72.8697 }], { fetchFn }), 40000, "OpenStreetMap");
    add(m.skipped ? { key: "metro", label: "Metro lines (OpenStreetMap)", status: "off", detail: "Switched off with ATLAS_METRO=off.", needed: "optional" }
      : m.lines.length ? { key: "metro", label: "Metro lines (OpenStreetMap)", status: "ok", detail: `Found ${m.lines.length} line${m.lines.length === 1 ? "" : "s"} near a test point in Andheri: atlases get their metro automatically.`, needed: "optional" }
      : { key: "metro", label: "Metro lines (OpenStreetMap)", status: "warn", detail: "OpenStreetMap answered but found no metro near a test point in Andheri.", needed: "optional" });
  } catch (e) { add({ key: "metro", label: "Metro lines (OpenStreetMap)", status: "warn", detail: `OpenStreetMap did not answer (${String(e.message || e).slice(0, 80)}). Atlases build without the metro until it does.`, needed: "optional" }); }

  /* ---- optional ---- */
  const images = require("./_images");
  add(images.ready()
    ? { key: "higgsfield", label: "Case study pictures (Higgsfield)", status: "ok", detail: "HIGGSFIELD_API_KEY is set. It is checked the first time a picture is made.", needed: "case" }
    : { key: "higgsfield", label: "Case study pictures (Higgsfield)", status: "off", detail: "No Higgsfield key: pictures can only be pasted as links.", fix: "Set HIGGSFIELD_API_KEY in Vercel.", needed: "case" });
  add(process.env.EXA_API_KEY
    ? { key: "exa", label: "Market research (Exa)", status: "ok", detail: "EXA_API_KEY is set: the helper's Research button is on.", needed: "optional" }
    : { key: "exa", label: "Market research (Exa)", status: "off", detail: "No Exa key: the helper's Research button is off.", fix: "Set EXA_API_KEY in Vercel.", needed: "optional" });

  const forAtlas = C.filter(c => c.needed === "atlas");
  const forCase = C.filter(c => c.needed === "atlas" || c.needed === "case");
  return {
    checks: C,
    ready: { atlas: forAtlas.every(c => c.status === "ok" || c.status === "warn"), case: forCase.every(c => c.status !== "fail") },
    at: new Date().toISOString(),
  };
}

module.exports = { run, tinyPdf };
