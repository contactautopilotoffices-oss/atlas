/* ============================================================================
   ATLAS · does this case bundle hold together?

   The same shape of report as validate-bundle.js: errors stop the pages
   being drawn, warnings name what is thin, stats say what is there. Every
   message names the sheet and the row the way the person filled it in.
   ============================================================================ */
"use strict";
const { SECTIONS, CHARTS, SLOTS, COPY_KEYS, LISTS, POINT_SECTIONS } = require("./case-schema");
const Costing = require("../../casestudy/costing");

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const isNum = (v) => typeof v === "number" && isFinite(v);

function validate(b) {
  const errors = [], warnings = [];
  const err = (where, message) => errors.push({ where, message });
  const warn = (where, message) => warnings.push({ where, message });
  if (!b || typeof b !== "object") { err("Case", "The bundle is not an object."); return done(); }

  const meta = b.meta || {};
  if (!meta.title) err("Case, Title", "The case study needs a title.");
  if (!meta.asOf) warn("Case, Dated", "Say which month the figures are current to.");

  const opts = Array.isArray(b.options) ? b.options : [];
  if (!opts.length) err("Options", "At least one option is needed; the costing has nothing to cost.");
  const ids = new Set();
  opts.forEach((o, i) => {
    const where = `Options, row ${i + 1}${o.name ? ` (${o.name})` : ""}`;
    if (!o.id) err(where, "Needs an ID.");
    else if (!ID.test(String(o.id))) err(where, `"${o.id}" is not a valid ID: lower-case letters, numbers and hyphens.`);
    else if (ids.has(o.id)) err(where, `The ID "${o.id}" is used twice.`); else ids.add(o.id);
    if (!o.name) err(where, "Needs a name.");
    for (const [k, label] of [["carpet", "Carpet area"], ["rentRate", "Rent"], ["fitoutRate", "Fit-out"]]) {
      if (!isNum(o[k])) err(where, `${label} must be a number; the costing cannot run without it.`);
      else if (o[k] < 0) err(where, `${label} cannot be negative.`);
    }
    if (isNum(o.carpet) && o.carpet > 0 && o.carpet < 500) warn(where, `Carpet area ${o.carpet} sq ft is very small; is it in the right unit?`);
    if (o.rentBasis && !["carpet", "builtup"].includes(o.rentBasis)) err(where, `Rent quoted on must be carpet or builtup, not "${o.rentBasis}".`);
    if (isNum(o.efficiency) && (o.efficiency <= 0 || o.efficiency > 100)) err(where, "Efficiency must be between 0 and 100 (per cent) or 0 and 1.");
    if (!o.address && !o.locality) warn(where, "No address or locality.");
  });
  const a = b.assumptions || {};
  for (const [k, label] of [["margin", "Margin"], ["efficiency", "Efficiency"], ["brokeragePct", "Brokerage"]]) if (isNum(a[k]) && (a[k] < 0 || a[k] > 100)) err(`Assumptions, ${label}`, "Must be between 0 and 100.");
  if (isNum(a.lockinMonths) && a.lockinMonths <= 0) err("Assumptions, Lock-in", "Must be more than zero months.");
  if (isNum(a.sqftPerSeat) && a.sqftPerSeat <= 0) err("Assumptions, Sq ft a seat", "Must be more than zero.");

  const refOpt = (where, id, what) => { if (id && !ids.has(id)) err(where, `${what} "${id}" is not an ID on the Options sheet.`); };
  (b.access || []).forEach((r, i) => { refOpt(`Access, row ${i + 1}`, r.option, "Option"); if (!isNum(r.distanceM)) err(`Access, row ${i + 1}`, "Distance must be a number of metres."); });
  (b.rivals || []).forEach((r, i) => {
    const where = `Rivals, row ${i + 1} (${r.operator || "?"})`;
    if (!isNum(r.price)) err(where, "Price a seat must be a number.");
    else if (r.price < 1000 || r.price > 200000) warn(where, `A price of ${r.price} a seat a month looks wrong.`);
    if (isNum(r.occLow) && isNum(r.occHigh) && r.occLow > r.occHigh) err(where, "Occupancy from is above occupancy to.");
    refOpt(where, r.sameBuilding, "In one of our buildings");
  });
  (b.kpis || []).forEach((r, i) => { if (r.section && !["cover", "back", ...SECTIONS].includes(r.section)) err(`KPIs, row ${i + 1}`, `Section "${r.section}" is not one of cover, back, ${SECTIONS.join(", ")}.`); refOpt(`KPIs, row ${i + 1}`, r.option, "Option"); });
  (b.series || []).forEach((r, i) => { if (!isNum(r.value)) err(`Series, row ${i + 1}`, "Value must be a number."); if (r.chart && !CHARTS.includes(r.chart)) warn(`Series, row ${i + 1}`, `Chart "${r.chart}" is not a known chart; it will be drawn as plain bars.`); });
  (b.points || []).forEach((r, i) => { if (!POINT_SECTIONS.includes(r.section)) err(`Points, row ${i + 1}`, `Section "${r.section}" must be one of ${POINT_SECTIONS.join(", ")}.`); if (r.section === "risks" && !r.mitigate) warn(`Points, row ${i + 1}`, "A risk without 'How we reduce it'."); });
  Object.keys(b.lists || {}).forEach(k => { if (!LISTS.includes(k)) warn("Lists", `"${k}" is not a known list and will not be shown.`); });
  (b.decision || []).forEach((q, i) => {
    const where = `Decision, "${q.question}"`;
    Object.keys(q.answers || {}).forEach(id => refOpt(where, id, "Option"));
    if (q.edge && q.edge !== "level") refOpt(where, q.edge, "Edge");
    if (!q.code && opts.some(o => (q.answers || {})[o.id] === undefined)) warn(where, "Not every option has an answer.");
  });
  Object.keys(b.copy || {}).forEach(k => { if (!COPY_KEYS.includes(k)) warn("Copy", `"${k}" is not a place on the pages and will not be shown.`); });
  Object.keys(b.images || {}).forEach(k => { if (!SLOTS.includes(k)) warn("Images", `"${k}" is not a picture slot.`); });
  for (const s of SLOTS) if (!(b.images || {})[s] || !b.images[s].url) warn(`Images, ${s}`, "No picture yet; the slot is drawn as a plain band until one is generated.");
  if (!b.sources || !Object.keys(b.sources).length) warn("Sources", "No source lines; a case study without them cannot be defended.");
  if (!b.copy || !b.copy.decision) warn("Copy", "No 'our read' for the decision page (Copy, decision, role read).");

  /* The costing runs here too, so a bundle that passes is one the page
     can draw without a NaN. */
  if (!errors.length) {
    const cc = Costing.caseCosting(opts, a);
    cc.options.forEach(c => { if (!isFinite(c.price) || c.price <= 0) err(`Options (${c.name})`, "The costing gives no price; check carpet, rent and fit-out."); });
  }
  return done();

  function done() {
    const present = sectionsPresent(b);
    return { ok: errors.length === 0, errors, warnings, stats: { options: opts.length, rivals: (b.rivals || []).length, series: (b.series || []).length, points: (b.points || []).length, deals: (b.deals || []).length, images: Object.values(b.images || {}).filter(x => x && x.url).length, sections: present } };
  }
}

/* Which sections the page will draw, in order, given what the bundle has. */
function sectionsPresent(b) {
  const has = (k) => Array.isArray(b[k]) ? b[k].length > 0 : !!(b[k] && Object.keys(b[k]).length);
  const pts = (s) => (b.points || []).some(p => p.section === s);
  const out = [];
  if ((b.options || []).length) out.push("options");
  if ((b.options || []).some(o => o.stage || o.reraId || o.developer) || has("access")) out.push("assets");
  if (pts("market") || has("series") || has("deals") || has("occupiers") || has("pools")) out.push("market");
  if (pts("infrastructure")) out.push("infrastructure");
  if (pts("why")) out.push("why");
  if (pts("plan")) out.push("plan");
  if (pts("risks")) out.push("risks");
  if (has("rivals") || has("openings")) out.push("rivals");
  if (has("decision") || (b.copy && b.copy.decision)) out.push("decision");
  return out;
}

function format(rep) {
  const lines = [];
  for (const e of rep.errors) lines.push(`  error    ${e.where}: ${e.message}`);
  for (const w of rep.warnings) lines.push(`  warning  ${w.where}: ${w.message}`);
  lines.push(`  ${rep.ok ? "OK" : "NOT OK"}: ${rep.stats.options} options, ${rep.stats.rivals} rivals, ${rep.stats.series} chart points, ${rep.stats.points} points; sections: ${rep.stats.sections.join(", ") || "none"}`);
  return lines.join("\n");
}

module.exports = { validate, format, sectionsPresent };
