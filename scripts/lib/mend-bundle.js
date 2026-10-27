/* ============================================================================
   ATLAS · repair, don't refuse

   validate() says what is wrong with a bundle; mend() fixes what can be
   fixed and leaves out only what truly cannot be shown, so anyone's data
   becomes an atlas. Every change is written down in plain words for the
   person who made it.

     const { bundle, fixes, left } = mend(bundle)

   What it does, block by block:
     meta       a title, a date, a centre and a zoom are always there; the
                centre and zoom are worked out from the pins
     options    ids made valid and unique, names filled, positions read from
                text, swapped latitude and longitude put right; an option
                with no position at all is left off the map and named
     zones      keys made valid; a micro-market an option names but the
                sheet lacks is added
     transit,   stations and stops with no position are dropped; an empty
     bus        line or block is removed
     places     as options, with a kind always set
     facts      empty lines dropped
     measures,  a slider that cannot rank anything is dropped; presets keep
     presets    only the sliders that exist, with levels 0 to 4
   Whatever still fails the checks after that, in a block the atlas can do
   without, takes the block out and says so. Only an atlas with nothing to
   place is left failing.
   ============================================================================ */
"use strict";
const { validate, PRECISION } = require("./validate-bundle");

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const AS_OF = /^\d{4}-\d{2}(-\d{2})?$/;
const isNum = (v) => typeof v === "number" && isFinite(v);
const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const slugify = (t) => String(t == null ? "" : t).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function km(aLat, aLng, bLat, bLng) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* A number from whatever was typed: 19.11, "19.11", "19.11° N", "19,11". */
function toNum(v) {
  if (isNum(v)) return v;
  if (typeof v !== "string") return undefined;
  const s = v.trim().replace(/[°\s]/g, "").replace(/^([-+]?\d+),(\d+)$/, "$1.$2");
  const m = s.match(/^([-+]?\d+(?:\.\d+)?)([NSEW])?$/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return /[SW]/i.test(m[2] || "") ? -Math.abs(n) : n;
}

/* Unique ids within a block: base, base-2, base-3 ... */
function uniquer() {
  const seen = new Set();
  return (base) => { let id = base, i = 2; while (seen.has(id)) id = `${base}-${i++}`; seen.add(id); return id; };
}

/* A row's position, read and put right. Returns false when there is none. */
function fixCoords(row, center, tally) {
  let lat = toNum(row.lat), lng = toNum(row.lng);
  /* "19.11, 72.87" typed into one cell. */
  if ((lat === undefined || lng === undefined) && typeof row.lat === "string" && /[,\s]/.test(row.lat.trim())) {
    const p = row.lat.split(/[,\s]+/).map(toNum).filter(isNum);
    if (p.length === 2) { [lat, lng] = p; tally.split++; }
  }
  if (!isNum(lat) || !isNum(lng) || (lat === 0 && lng === 0)) return false;
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) { [lat, lng] = [lng, lat]; tally.swapped++; }
  else if (center && isNum(center[0]) && isNum(center[1])) {
    const d = km(center[1], center[0], lat, lng), sw = km(center[1], center[0], lng, lat);
    if (d > 150 && sw < 150 && Math.abs(lng) <= 90) { [lat, lng] = [lng, lat]; tally.swapped++; }
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (row.lat !== lat || row.lng !== lng) { row.lat = lat; row.lng = lng; }
  return true;
}

/* Where most of the pins are, so one swapped pin can be caught against
   the rest: the median of each axis, after obvious swaps. */
function roughCentre(rows) {
  const pts = [];
  for (const r of rows || []) {
    let lat = toNum(r && r.lat), lng = toNum(r && r.lng);
    if (!isNum(lat) || !isNum(lng)) continue;
    if (Math.abs(lat) > 90) [lat, lng] = [lng, lat];
    pts.push([lng, lat]);
  }
  if (!pts.length) return null;
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  return [med(pts.map(p => p[0])), med(pts.map(p => p[1]))];
}

function asOfFrom(v) {
  if (isStr(v) && AS_OF.test(v.trim())) return v.trim();
  const s = String(v == null ? "" : v).toLowerCase();
  const y = (s.match(/(20\d\d)/) || [])[1];
  const m = MONTHS.findIndex(x => s.includes(x));
  if (y) return `${y}-${String(m >= 0 ? m + 1 : 1).padStart(2, "0")}`;
  if (v instanceof Date && isFinite(v)) return v.toISOString().slice(0, 7);
  return new Date().toISOString().slice(0, 7);
}

/* A zoom that shows every pin: a street, a district, a city, a state, India. */
function zoomFor(pts, centre) {
  if (!pts.length) return 12;
  const far = Math.max(...pts.map(p => km(centre[1], centre[0], p[1], p[0])));
  return far < 2 ? 14.5 : far < 5 ? 13.5 : far < 12 ? 12.5 : far < 30 ? 11.5 : far < 80 ? 10 : far < 250 ? 8 : far < 800 ? 6 : 4.4;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
const names = (list) => list.slice(0, 6).join(", ") + (list.length > 6 ? ` and ${list.length - 6} more` : "");

function mend(input) {
  const b = JSON.parse(JSON.stringify(isObj(input) ? input : {}));
  const fixes = [];
  const left = [];
  const tally = { swapped: 0, split: 0, ids: 0, names: 0 };

  /* ---- options: the one block an atlas cannot do without ---- */
  const centreGuess = roughCentre(b.options);
  const optId = uniquer();
  const unplacedOpts = [];
  b.options = (Array.isArray(b.options) ? b.options : []).filter(isObj).filter((o, i) => {
    if (!isStr(o.name)) { o.name = isStr(o.id) ? o.id : `Property ${i + 1}`; tally.names++; }
    const want = SLUG.test(String(o.id || "")) ? o.id : (slugify(o.id) || slugify(o.name) || `option-${i + 1}`);
    const id = optId(want);
    if (id !== o.id) { o.id = id; tally.ids++; }
    if (!fixCoords(o, centreGuess, tally)) { unplacedOpts.push(o.name); return false; }
    if (o.facts !== undefined) {
      if (!Array.isArray(o.facts)) delete o.facts;
      else o.facts = o.facts.filter(f => isObj(f) && isStr(f.k) && f.v !== undefined && f.v !== null && f.v !== "");
    }
    if (o.precision !== undefined && !PRECISION.includes(String(o.precision))) o.precision = "approx";
    return true;
  });
  b.options.forEach((o, i) => { if (!isNum(o.n)) o.n = i + 1; });
  if (unplacedOpts.length) left.push(`Left off the map because no position could be found: ${names(unplacedOpts)}. Add an address or a latitude and longitude on the Options tab to bring ${unplacedOpts.length === 1 ? "it" : "them"} back.`);

  /* ---- meta ---- */
  b.meta = isObj(b.meta) ? b.meta : {};
  const m = b.meta;
  if (!isStr(m.title)) { m.title = (isStr(m.city) ? `${m.city} atlas` : "Atlas"); fixes.push(`The atlas had no title, so it is called "${m.title}".`); }
  const asOf = asOfFrom(m.asOf);
  if (asOf !== m.asOf) { if (m.asOf) fixes.push(`The date "${m.asOf}" is read as ${asOf}.`); m.asOf = asOf; }
  const pts = b.options.map(o => [o.lng, o.lat]);
  const c = m.center;
  const centreOk = Array.isArray(c) && c.length === 2 && isNum(c[0]) && isNum(c[1]) && Math.abs(c[1]) <= 90 && Math.abs(c[0]) <= 180;
  if (!centreOk && pts.length) m.center = [+(pts.reduce((a, p) => a + p[0], 0) / pts.length).toFixed(5), +(pts.reduce((a, p) => a + p[1], 0) / pts.length).toFixed(5)];
  if (!isNum(m.zoom) || m.zoom < 0 || m.zoom > 22) m.zoom = zoomFor(pts, m.center || [0, 0]);
  if (m.nextSteps !== undefined && !Array.isArray(m.nextSteps)) {
    if (isStr(m.nextSteps)) m.nextSteps = m.nextSteps.split(/\n+/).map(s => s.trim()).filter(Boolean); else delete m.nextSteps;
  }
  const centre = m.center;

  /* ---- zones: keys valid, and every key an option names exists ---- */
  if (b.zones !== undefined) {
    const zid = uniquer();
    b.zones = (Array.isArray(b.zones) ? b.zones : []).filter(isObj).map((z, i) => {
      const key = zid(isStr(z.key) ? z.key.trim() : (slugify(z.label) || slugify(z.name) || `area-${i + 1}`));
      if (key !== z.key) { z.from = z.key; z.key = key; }
      if (!isStr(z.label)) z.label = isStr(z.name) ? z.name : key.replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
      for (const k of ["pros", "cons"]) if (z[k] !== undefined && !Array.isArray(z[k])) { if (isStr(z[k])) z[k] = z[k].split(/\n+/).map(s => s.trim()).filter(Boolean); else delete z[k]; }
      return z;
    });
  }
  const zoneKeys = new Set((b.zones || []).map(z => z.key));
  const byFrom = new Map((b.zones || []).filter(z => z.from != null).map(z => [String(z.from), z.key]));
  const added = [];
  for (const o of b.options) {
    if (!isStr(o.micro)) continue;
    if (zoneKeys.has(o.micro)) continue;
    const same = [...zoneKeys].find(k => slugify(k) === slugify(o.micro)) || ((b.zones || []).find(z => slugify(z.label) === slugify(o.micro) || slugify(z.name) === slugify(o.micro)) || {}).key;
    const k = same || byFrom.get(o.micro) || slugify(o.micro);
    if (!k) { delete o.micro; continue; }
    if (!zoneKeys.has(k)) {
      b.zones = b.zones || [];
      b.zones.push({ key: k, label: String(o.micro).trim(), name: String(o.micro).trim() });
      zoneKeys.add(k); added.push(String(o.micro).trim());
    }
    o.micro = k;
  }
  for (const z of b.zones || []) delete z.from;
  if (added.length) fixes.push(`${plural(added.length, "micro-market")} the properties name ${added.length === 1 ? "was" : "were"} added: ${names(added)}.`);

  /* ---- transit and bus ---- */
  if (b.transit !== undefined) {
    if (!isObj(b.transit) || !Array.isArray(b.transit.lines)) { delete b.transit; }
    else {
      const lid = uniquer();
      let dropped = 0;
      b.transit.lines = b.transit.lines.filter(isObj).map((l, i) => {
        l.key = lid(isStr(l.key) ? l.key.trim() : (slugify(l.name) || `line-${i + 1}`));
        if (!isStr(l.name)) l.name = `Line ${i + 1}`;
        const st = (Array.isArray(l.stations) ? l.stations : []).filter(isObj);
        l.stations = st.filter(s => isStr(s.name) && fixCoords(s, centre, tally));
        dropped += st.length - l.stations.length;
        return l;
      }).filter(l => l.stations.length);
      if (Array.isArray(b.transit.anchors)) b.transit.anchors = b.transit.anchors.filter(a => isObj(a) && isStr(a.name) && fixCoords(a, centre, tally));
      else if (b.transit.anchors !== undefined) delete b.transit.anchors;
      if (dropped) left.push(`${plural(dropped, "station")} with no name or position ${dropped === 1 ? "was" : "were"} left off the map.`);
      if (!b.transit.lines.length) delete b.transit;
    }
  }
  if (b.bus !== undefined) {
    if (!isObj(b.bus)) delete b.bus;
    else {
      if (Array.isArray(b.bus.stops)) b.bus.stops = b.bus.stops.filter(s => Array.isArray(s) ? (isStr(s[0]) && isNum(toNum(s[1])) && isNum(toNum(s[2]))) : (isObj(s) && isStr(s.name) && fixCoords(s, centre, tally)));
      else delete b.bus.stops;
      if (Array.isArray(b.bus.path)) b.bus.path = b.bus.path.filter(p => Array.isArray(p) && isNum(p[0]) && isNum(p[1]) && Math.abs(p[1]) <= 90);
      else delete b.bus.path;
      if (!(b.bus.stops && b.bus.stops.length) && !(b.bus.path && b.bus.path.length)) delete b.bus;
    }
  }

  /* ---- places ---- */
  if (b.places !== undefined) {
    const pid = uniquer();
    const unplaced = [];
    b.places = (Array.isArray(b.places) ? b.places : []).filter(isObj).filter((p, i) => {
      if (!isStr(p.name)) { if (isStr(p.id)) p.name = p.id; else return false; }
      const id = pid(isStr(p.id) ? p.id.trim() : (slugify(p.name) || `place-${i + 1}`));
      if (id !== p.id) { p.id = id; tally.ids++; }
      if (!isStr(p.kind)) p.kind = "place";
      if (p.precision !== undefined && !PRECISION.includes(String(p.precision))) p.precision = "approx";
      if (!fixCoords(p, centre, tally)) { unplaced.push(p.name); return false; }
      return true;
    });
    if (unplaced.length) left.push(`${plural(unplaced.length, "place")} with no position ${unplaced.length === 1 ? "was" : "were"} left off the map: ${names(unplaced)}.`);
    if (!b.places.length) delete b.places;
  }

  /* ---- facts ---- */
  if (b.facts !== undefined) {
    if (Array.isArray(b.facts)) b.facts = { facts: b.facts };
    if (!isObj(b.facts)) delete b.facts;
    else {
      for (const [g, list] of Object.entries(b.facts)) {
        const keep = (Array.isArray(list) ? list : []).filter(f => isObj(f) && isStr(f.k) && f.v !== undefined && f.v !== null && f.v !== "");
        if (keep.length) b.facts[g] = keep; else delete b.facts[g];
      }
      if (!Object.keys(b.facts).length) delete b.facts;
    }
  }

  /* ---- current office ---- */
  if (b.existing !== undefined && !(isObj(b.existing) && (isStr(b.existing.name) || isStr(b.existing.id)) && fixCoords(b.existing, centre, tally))) {
    delete b.existing; left.push("The current office had no position, so it is not on the map.");
  } else if (b.existing) {
    if (!isStr(b.existing.name)) b.existing.name = b.existing.id;
    if (!isStr(b.existing.id)) b.existing.id = slugify(b.existing.name) || "current";
  }

  /* ---- sliders and presets: keep what can rank something ---- */
  if (b.measures !== undefined) {
    const kid = uniquer();
    const dropped = [];
    b.measures = (Array.isArray(b.measures) ? b.measures : []).filter(isObj).filter((x, i) => {
      x.key = kid(isStr(x.key) ? x.key.trim() : (slugify(x.label) || `measure-${i + 1}`));
      if (!isStr(x.label)) x.label = x.key;
      const rep = validate({ ...b, measures: [x], presets: undefined });
      const bad = rep.errors.filter(e => e.where.startsWith("Priorities"));
      if (bad.length) { dropped.push(`${x.label} (${bad[0].message.replace(/\.$/, "")})`); return false; }
      return true;
    });
    if (dropped.length) left.push(`${plural(dropped.length, "slider")} could not rank anything and ${dropped.length === 1 ? "was" : "were"} left out: ${names(dropped)}.`);
    if (!b.measures.length) delete b.measures;
  }
  const mkeys = new Set((b.measures || []).map(x => x.key));
  if (b.presets !== undefined) {
    if (!mkeys.size || !Array.isArray(b.presets)) delete b.presets;
    else {
      const pid = uniquer();
      let seenDefault = false;
      b.presets = b.presets.filter(isObj).map((p, i) => {
        p.key = pid(isStr(p.key) ? p.key.trim() : (slugify(p.label) || `preset-${i + 1}`));
        if (!isStr(p.label)) p.label = p.key;
        const lv = {};
        for (const [k, v] of Object.entries(isObj(p.levels) ? p.levels : {})) {
          if (!mkeys.has(k)) continue;
          const n = Math.round(toNum(v) ?? NaN);
          if (isNum(n)) lv[k] = Math.max(0, Math.min(4, n));
        }
        p.levels = lv;
        if (p.default) { if (seenDefault) p.default = false; seenDefault = true; }
        return p;
      }).filter(p => Object.keys(p.levels).length);
      if (!b.presets.length) delete b.presets;
    }
  }

  /* ---- last resort: take out a block the atlas can do without ---- */
  const OPTIONAL = { "Micro-markets": "zones", "Transit": "transit", "Buses": "bus", "Places": "places", "Facts": "facts", "Priorities": "measures", "Priority presets": "presets", "Current office": "existing" };
  const LABEL = { zones: "micro-markets", transit: "metro and rail", bus: "buses", places: "places", facts: "facts", measures: "priority sliders", presets: "priority presets", existing: "current office" };
  for (let round = 0; round < 6; round++) {
    const rep = validate(b);
    const blocks = new Set();
    for (const e of rep.errors) {
      const head = Object.keys(OPTIONAL).find(h => e.where === h || e.where.startsWith(h + " ") || e.where.startsWith(h + ",") || e.where.startsWith(h + "("));
      if (head) blocks.add(OPTIONAL[head]);
    }
    if (!blocks.size) break;
    for (const k of blocks) {
      if (b[k] === undefined) continue;
      delete b[k];
      if (k === "measures") delete b.presets;
      left.push(`The ${LABEL[k]} could not be drawn as given, so ${k === "facts" ? "they are" : "that part is"} left out. Fix it in the plan to bring it back.`);
    }
  }

  if (tally.ids) fixes.push(`${plural(tally.ids, "ID")} ${tally.ids === 1 ? "was" : "were"} made valid and unique.`);
  if (tally.names) fixes.push(`${plural(tally.names, "property", "properties")} with no name ${tally.names === 1 ? "is" : "are"} named after ${tally.names === 1 ? "its" : "their"} ID.`);
  if (tally.swapped) fixes.push(`${plural(tally.swapped, "position")} had latitude and longitude the wrong way round and ${tally.swapped === 1 ? "was" : "were"} swapped.`);
  if (tally.split) fixes.push(`${plural(tally.split, "position")} typed into one cell ${tally.split === 1 ? "was" : "were"} split into latitude and longitude.`);
  return { bundle: b, fixes, left };
}

module.exports = { mend, slugify, toNum };
