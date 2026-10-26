/* ============================================================================
   ATLAS · an atlas back into its plan

   readWorkbook() turns sheet rows into a bundle; rowsFromBundle() turns a
   bundle back into the same rows, keyed by the workbook's headings, so any
   atlas (including one built before plans were saved with it) opens in the
   editor for a revision. Built again, the rows give back the same bundle.

   Settings that are not on any sheet (the atlas type, the cover image,
   colours) come back separately as `look`.
   ============================================================================ */
"use strict";
const { SHEETS, LEVEL_WORDS } = require("./workbook-schema");

const labels = (name) => { const s = SHEETS.find(x => x.name === name); return new Map((s.columns || s.fields).map(c => [c.key, c.label])); };
/* The heading a column the schema does not know was read from: the reverse
   of the reader's camel(), so camel(human(k)) === k. */
const human = (key) => { const w = String(key).replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/\s+/).filter(Boolean).map(x => x.toLowerCase()); return w.length ? w[0][0].toUpperCase() + w[0].slice(1) + (w.length > 1 ? " " + w.slice(1).join(" ") : "") : String(key); };
const set = (o, k, v) => { if (v !== undefined && v !== null && v !== "") o[k] = v; };
const yesNo = (v) => v === true ? "yes" : v === false ? "no" : undefined;

/* A row by headings: known keys by their label, anything else by human(). */
function byHeadings(obj, map, skip = []) {
  const r = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (skip.includes(k) || v === undefined || v === null || v === "" || typeof v === "object") continue;
    r[map.get(k) || human(k)] = v;
  }
  return r;
}

function rowsFromBundle(bundle) {
  const b = bundle && typeof bundle === "object" ? bundle : {};
  const rows = {};
  const m = b.meta || {};

  const A = labels("Atlas"), atlas = {};
  set(atlas, A.get("title"), m.title); set(atlas, A.get("sub"), m.sub); set(atlas, A.get("asOf"), m.asOf); set(atlas, A.get("city"), m.city);
  if (Array.isArray(m.center)) { set(atlas, A.get("centerLng"), m.center[0]); set(atlas, A.get("centerLat"), m.center[1]); }
  set(atlas, A.get("zoom"), m.zoom); set(atlas, A.get("sheet"), m.sheet);
  if (m.speed) { set(atlas, A.get("speedKmh"), m.speed.kmh); set(atlas, A.get("speedFactor"), m.speed.factor); set(atlas, A.get("speedNote"), m.speed.note); }
  if (Array.isArray(m.nextSteps) && m.nextSteps.length) atlas[A.get("nextSteps")] = m.nextSteps.join("\n");
  rows["Atlas"] = atlas;

  const O = labels("Options");
  rows["Options"] = (b.options || []).map(o => byHeadings(o, O, ["facts"]));

  if (Array.isArray(b.zones) && b.zones.length) {
    const Z = labels("Micro-markets");
    rows["Micro-markets"] = b.zones.map(z => {
      const r = {};
      for (const k of ["key", "label", "name", "color", "character"]) set(r, Z.get(k), z[k]);
      for (const f of ["rent", "vacancy", "stock"]) if (z[f]) { set(r, Z.get(f + "V"), z[f].v); set(r, Z.get(f + "Src"), z[f].src); }
      if (Array.isArray(z.pros)) set(r, Z.get("pros"), z.pros.join("\n"));
      if (Array.isArray(z.cons)) set(r, Z.get("cons"), z.cons.join("\n"));
      return r;
    });
  }

  if (Array.isArray(b.places) && b.places.length) rows["Places"] = b.places.map(p => byHeadings(p, labels("Places")));

  if (b.transit && Array.isArray(b.transit.lines) && b.transit.lines.length) {
    const T = labels("Transit"), out = [];
    for (const l of b.transit.lines) for (const s of l.stations || []) {
      const r = {};
      set(r, T.get("line"), l.name); set(r, T.get("lineShort"), l.short); set(r, T.get("mode"), l.mode); set(r, T.get("color"), l.color);
      set(r, T.get("name"), s.name); set(r, T.get("lat"), s.lat); set(r, T.get("lng"), s.lng); set(r, T.get("open"), yesNo(s.open));
      set(r, T.get("eta"), s.eta); set(r, T.get("target"), s.target); set(r, T.get("src"), l.src);
      out.push(r);
    }
    rows["Transit"] = out;
  }

  if (b.facts && typeof b.facts === "object") {
    const F = labels("Facts"), out = [];
    for (const [g, list] of Object.entries(b.facts)) for (const f of list || []) {
      const r = {};
      set(r, F.get("group"), g); set(r, F.get("k"), f.k); set(r, F.get("v"), f.v); set(r, F.get("asOf"), f.asOf);
      set(r, F.get("conf"), f.conf); set(r, F.get("src"), f.src); set(r, F.get("note"), f.note);
      out.push(r);
    }
    if (out.length) rows["Facts"] = out;
  }

  if (b.existing) rows["Current office"] = byHeadings(b.existing, labels("Current office"));

  if (Array.isArray(b.measures) && b.measures.length) {
    const P = labels("Priorities");
    rows["Priorities"] = b.measures.map(x => {
      const r = {};
      set(r, P.get("key"), x.key); set(r, P.get("label"), x.label); set(r, P.get("kind"), x.kind);
      if (x.column) set(r, P.get("column"), O.get(x.column) || human(x.column));
      set(r, P.get("higherIsBetter"), yesNo(x.higherIsBetter)); set(r, P.get("max"), x.max);
      set(r, P.get("placeKind"), Array.isArray(x.placeKind) ? x.placeKind.join(", ") : x.placeKind);
      set(r, P.get("status"), x.status); set(r, P.get("mode"), x.mode); set(r, P.get("question"), x.question); set(r, P.get("of"), x.of);
      return r;
    });
  }

  if (Array.isArray(b.presets) && b.presets.length) {
    const S = labels("Presets"), out = [];
    for (const p of b.presets) for (const [k, n] of Object.entries(p.levels || {})) {
      const r = {};
      set(r, S.get("key"), p.key); set(r, S.get("label"), p.label); set(r, S.get("note"), p.note); set(r, S.get("default"), p.default ? "yes" : undefined);
      set(r, S.get("measure"), k); set(r, S.get("level"), LEVEL_WORDS[n] || String(n));
      out.push(r);
    }
    rows["Presets"] = out;
  }

  const look = {};
  for (const k of ["layout", "backdrop", "brand", "fits", "placeColors", "rings"]) if (m[k] !== undefined) look[k] = m[k];
  return { rows, look };
}

module.exports = { rowsFromBundle, human };
