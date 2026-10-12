#!/usr/bin/env node
/* Packs a study.json into the data.js the ATLAS template reads, after
   checking it. Plain Node, no packages.

     node pack_data.js study.json path/to/study-folder/data.js

   Errors stop the build (the page would break or mislead). Warnings are
   printed and the file is still written; read them before you ship.
   The schema is in references/data-schema.md. */
const fs = require("fs");

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("usage: node pack_data.js study.json out/data.js"); process.exit(2); }
const S = JSON.parse(fs.readFileSync(src, "utf8"));
const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
const isNum = (v) => typeof v === "number" && isFinite(v);
const hex = /^#[0-9a-fA-F]{6}$/;
const PRECISION = ["building", "street", "locality"];
const KINDS = ["edu", "res", "studio", "it", "hub"];
const DEFAULT_FITS = ["best", "value", "conditional"];

const meta = S.meta || {}, ex = S.existing, opts = S.options || [], zones = S.zones || [];
const transit = S.transit || { lines: [] }, places = S.places || [], facts = S.facts || {};

/* ---- meta */
if (!/^[a-z0-9][a-z0-9-]*$/.test(meta.slug || "")) err("meta.slug: lower-case letters, digits and hyphens, e.g. \"pune-2027\"");
if (!Array.isArray(meta.center) || !isNum(meta.center[0]) || !isNum(meta.center[1])) err("meta.center: [lng, lat]");
if (!isNum(meta.zoom)) err("meta.zoom: a number, about 10.5 to 11.5 for a city");
if (!meta.speed || !isNum(meta.speed.kmh) || !isNum(meta.speed.factor)) err("meta.speed: { kmh, factor, note, src } for drive times");
if (meta.gate) {
  if ("password" in meta.gate || "id" in meta.gate) err("meta.gate: never store the ID or password, only the hash from make_password.py");
  if (meta.gate.hash && !/^[0-9a-f]{64}$/.test(meta.gate.hash)) err("meta.gate.hash: 64 hex characters from make_password.py");
}
if (!meta.gate || !meta.gate.hash) warn("meta.gate.hash: empty, so the page opens without a sign-in");
if (!meta.asOf) warn("meta.asOf: the date the facts were checked (YYYY-MM-DD)");
const near = (p, what) => {
  if (!isNum(p.lat) || !isNum(p.lng)) { err(`${what}: lat and lng must be numbers`); return; }
  if (!meta.center) return;
  const d = Math.hypot((p.lng - meta.center[0]) * 111.32 * Math.cos(p.lat * Math.PI / 180), (p.lat - meta.center[1]) * 110.6);
  if (d > 60) warn(`${what}: ${d.toFixed(0)} km from meta.center; lat and lng swapped?`);
};

/* ---- fits */
const fitKeys = meta.fits ? Object.keys(meta.fits) : DEFAULT_FITS;
for (const [k, f] of Object.entries(meta.fits || {})) {
  if (!f.label || !hex.test(f.color || "")) err(`meta.fits.${k}: { label, color: "#rrggbb", bg }`);
}

/* ---- zones */
const zoneKeys = new Set();
for (const z of zones) {
  const w = `zone ${z.key || "?"}`;
  if (!z.key) err(`${w}: key missing`); else if (zoneKeys.has(z.key)) err(`${w}: duplicate key`); else zoneKeys.add(z.key);
  if (!z.label || !z.name) err(`${w}: label and name`);
  if (!hex.test(z.color || "")) err(`${w}: color "#rrggbb"`);
  const sh = z.shape || {};
  if (sh.type === "band") { if (!Array.isArray(sh.from) || !Array.isArray(sh.to) || !isNum(sh.w)) err(`${w}: band needs from [lng,lat], to [lng,lat], w (km)`); }
  else if (sh.type === "ellipse") { if (!Array.isArray(sh.c) || !isNum(sh.rx) || !isNum(sh.ry)) err(`${w}: ellipse needs c [lng,lat], rx, ry (km)`); }
  else err(`${w}: shape.type is "band" or "ellipse"`);
  for (const k of ["rent", "vacancy", "stock"]) if (z[k] && !z[k].src) warn(`${w}.${k}: no src; every figure should say where it came from`);
}
if (!zones.length) err("zones: at least one micro-market (every option sits in one)");

/* ---- existing office */
if (!ex || !ex.id || !ex.name) err("existing: { id, name, lat, lng } for today's office (or the reference point distances are measured from)");
else near(ex, "existing");

/* ---- options */
const ids = new Set(), ranks = new Set();
for (const o of opts) {
  const w = `option ${o.id || o.name || "?"}`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(o.id || "")) err(`${w}: id is lower-case-with-hyphens (it is the deep link)`);
  else if (ids.has(o.id)) err(`${w}: duplicate id`); else ids.add(o.id);
  if (!Number.isInteger(o.n) || o.n < 1) err(`${w}: n is the rank, 1 upwards`); else if (ranks.has(o.n)) err(`${w}: rank ${o.n} used twice`); else ranks.add(o.n);
  if (!o.name) err(`${w}: name`);
  if (!zoneKeys.has(o.micro)) err(`${w}: micro "${o.micro}" is not a zone key`);
  if (!o.sheetMicro) { const z = zones.find(z => z.key === o.micro); o.sheetMicro = z ? z.label : ""; }
  if (o.fit && !fitKeys.includes(o.fit)) err(`${w}: fit "${o.fit}" is not one of ${fitKeys.join(", ")}`);
  if (!PRECISION.includes(o.precision)) err(`${w}: precision is building, street or locality`);
  if (o.precision === "building" && !o.geoSrc) warn(`${w}: pinned to the building but no geoSrc says how it was checked`);
  for (const k of ["pricingScore", "ecoScore"]) if (o[k] != null && !(isNum(o[k]) && o[k] >= 0 && o[k] <= 10)) err(`${w}: ${k} is 0 to 10`);
  if (o.flag && !o.flag.v) err(`${w}: flag is { v, src }`);
  for (const f of o.facts || []) if (!f.k || f.v == null) err(`${w}: facts are { k, v, src }`);
  near(o, w);
}
if (!opts.length) err("options: the shortlist is empty");
const nRanks = [...ranks].sort((a, b) => a - b);
if (nRanks.length && nRanks[nRanks.length - 1] !== nRanks.length) warn(`options: ranks run 1 to ${nRanks[nRanks.length - 1]} with gaps`);

/* ---- transit */
let open = 0;
for (const L of transit.lines || []) {
  const w = `line ${L.key || L.name || "?"}`;
  if (!L.key || !L.name || !L.mode) err(`${w}: key, name, short, mode ("metro", "rail", "suburban", "mrts" or "tram")`);
  if (!hex.test(L.color || "")) err(`${w}: color "#rrggbb"`);
  if (!L.src) warn(`${w}: no src`);
  for (const s of L.stations || []) {
    near(s, `${w} station ${s.name}`);
    if (s.open) open++;
    else if (!s.opens && !s.target) warn(`${w} station ${s.name}: not open, and no target or opens date`);
  }
}
if (!open) err("transit: at least one open station; the connectivity view and the rail measure need one");

/* ---- bus (objects or packed arrays) */
let bus = S.bus || null;
if (bus) {
  bus = { ...bus, stops: (bus.stops || []).map(s => Array.isArray(s) ? s : [s.name, s.lat, s.lng, s.routes || 0]) };
  bus.stops = bus.stops.map(([n, la, ln, r]) => [n, +(+la).toFixed(5), +(+ln).toFixed(5), r | 0]);
  if (!bus.credit) warn("bus: no credit line; GTFS feeds usually ask for one (ODbL, CC-BY)");
}

/* ---- places */
const pids = new Set();
for (const p of places) {
  const w = `place ${p.id || p.name || "?"}`;
  if (!p.id || pids.has(p.id)) err(`${w}: id missing or duplicate`); else pids.add(p.id);
  if (!KINDS.includes(p.kind)) err(`${w}: kind is one of ${KINDS.join(", ")}`);
  if (!PRECISION.includes(p.precision)) err(`${w}: precision is building, street or locality`);
  if (!p.src) warn(`${w}: no src`);
  near(p, w);
}

/* ---- facts */
for (const [k, list] of Object.entries(facts)) for (const f of list || []) {
  if (!f.k || !f.v) err(`facts.${k}: items are { k, v, asOf, conf, src }`);
  if (!f.src) warn(`facts.${k} "${f.k}": no src`);
}

/* ---- wording: no em dashes in anything the client reads */
const EM = String.fromCharCode(0x2014), dashes = [];
(function walk(v, path) {
  if (typeof v === "string") { if (v.includes(EM)) dashes.push(path); }
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
})(S, "");
if (dashes.length) warn(`em dashes in ${dashes.length} place(s), rewrite with commas or colons: ${dashes.slice(0, 8).join(", ")}${dashes.length > 8 ? " ..." : ""}`);

for (const w of warns) console.warn("warning:", w);
if (errors.length) { for (const e of errors) console.error("error:", e); console.error(`\n${errors.length} error(s); data.js not written.`); process.exit(1); }

/* ---- builder's notes (keys starting with "_", e.g. _sheet from
   sheet_to_json.py) stay in study.json and never reach the page */
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
opts.splice(0, opts.length, ...opts.map(strip));

/* ---- write: one item per line keeps diffs readable */
const round = (k, v) => (k === "lat" || k === "lng") && isNum(v) ? +v.toFixed(6) : v;
const one = (v) => JSON.stringify(v, round);
const list = (a, pad = "") => a.length ? `[\n${pad}  ${a.map(one).join(`,\n${pad}  `)}\n${pad}]` : "[]";
/* An object on one line, except its long array key, which gets a line per item. */
const withList = (o, key, body) => `{${Object.entries(o).filter(([k]) => k !== key).map(([k, v]) => `${JSON.stringify(k)}:${one(v)},`).join("")}${JSON.stringify(key)}:${body}}`;
const linesOut = `[\n${(transit.lines || []).map(L => "  " + withList(L, "stations", list(L.stations || [], "  "))).join(",\n")}\n]`;
const js = `/* ${meta.title || meta.slug}: generated by pack_data.js from ${require("path").basename(src)} on ${new Date().toISOString().slice(0, 10)}.
   Edit the study file and re-run pack_data.js rather than editing this. */
window.ATLAS_META = ${JSON.stringify(meta, round, 1)};
window.ATLAS_EXISTING = ${one(ex)};
window.ATLAS_OPTIONS = ${list(opts)};
window.ATLAS_ZONES = ${list(zones)};
window.ATLAS_TRANSIT = ${withList(transit, "lines", linesOut)};
window.ATLAS_BUS = ${bus ? withList(bus, "stops", list(bus.stops)) : "null"};
window.ATLAS_PLACES = ${list(places)};
window.ATLAS_FACTS = ${JSON.stringify(facts, round, 1)};
`;
fs.writeFileSync(out, js);
/* Prove the file parses and round-trips before calling it done. */
const vm = require("vm"), ctx = { window: {} };
vm.runInNewContext(js, ctx);
if (ctx.window.ATLAS_OPTIONS.length !== opts.length || ctx.window.ATLAS_TRANSIT.lines.length !== (transit.lines || []).length) { console.error("round-trip check failed"); process.exit(1); }
console.log(`wrote ${out}: ${opts.length} options, ${zones.length} zones, ${(transit.lines || []).length} lines (${open} open stations), ${bus ? bus.stops.length : 0} bus stops, ${places.length} places, ${(js.length / 1024).toFixed(0)} KB${warns.length ? `, ${warns.length} warning(s)` : ""}`);
