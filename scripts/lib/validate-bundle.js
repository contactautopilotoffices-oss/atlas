/* ============================================================================
   ATLAS · bundle validation

   One bundle is one Atlas (see engine/SCHEMA.md). This module answers one
   question: can the engine draw this, and will it read well?

     errors    the engine cannot draw it. The upload is refused.
     warnings  it draws, but something is missing or looks wrong. Publishable.

   Every message names the block, the row and the column in plain words,
   because this report is read by whoever filled in the workbook, not by a
   developer. "Options row 7 (kar-towers): lat is empty, so this property
   cannot be placed on the map" is the whole point of this file.

   The same code runs in the importer and on the command line, so what passes
   in /admin/ is exactly what the engine can draw.
   ============================================================================ */
"use strict";

/* How exact a position is, most exact first. "sector", "poi" and "landuse"
   are here because Noida ships them and they mean something: a sector is a
   Noida area unit, a poi is a mapped point, a landuse is a drawn area. */
const PRECISION = ["building", "poi", "complex", "landuse", "street", "locality", "sector", "approx"];
const CONFIDENCE = ["high", "medium", "low"];
/* "mrts" and "suburban" are Chennai's own two rail systems. */
const MODES = ["metro", "mrts", "suburban", "rail", "monorail", "bus"];
const STATUSES = ["open", "planned"];
const BLOCKS = ["meta", "existing", "options", "zones", "transit", "bus", "places", "facts", "mapStyle"];
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const AS_OF = /^\d{4}-\d{2}(-\d{2})?$/;

/* Great-circle distance in km, used to catch a pin that is nowhere near the
   rest of the study (almost always lat and lng the wrong way round). */
function km(aLat, aLng, bLat, bLng) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

class Report {
  constructor() { this.errors = []; this.warnings = []; this.stats = {}; }
  err(where, message) { this.errors.push({ where, message }); }
  warn(where, message) { this.warnings.push({ where, message }); }
  get ok() { return this.errors.length === 0; }
}

const isNum = v => typeof v === "number" && isFinite(v);
const isStr = v => typeof v === "string" && v.trim() !== "";
/* How a row names itself in a message: "row 7 (kar-towers)". */
const at = (block, i, row, key) =>
  `${block} row ${i + 1}${row && row[key || "id"] ? ` (${row[key || "id"]})` : ""}`;

/* --------------------------------------------------------- coordinates ----
   Checked in one place, because a wrong coordinate is the single most common
   and most expensive mistake: the property silently lands in the sea. */
function coords(rep, where, row, center) {
  let ok = true;
  for (const k of ["lat", "lng"]) {
    if (row[k] === undefined || row[k] === null || row[k] === "") {
      rep.err(where, `${k} is empty, so this cannot be placed on the map.`);
      ok = false;
    } else if (!isNum(row[k])) {
      rep.err(where, `${k} is "${row[k]}", which is not a number. Use decimal degrees, for example 12.963158.`);
      ok = false;
    }
  }
  if (!ok) return;
  if (row.lat < -90 || row.lat > 90) {
    rep.err(where, `lat is ${row.lat}. Latitude runs from -90 to 90, so this looks like a longitude in the lat column.`);
    return;
  }
  if (row.lng < -180 || row.lng > 180) {
    rep.err(where, `lng is ${row.lng}. Longitude runs from -180 to 180.`);
    return;
  }
  if (row.lat === 0 && row.lng === 0)
    rep.err(where, "lat and lng are both 0, which is in the Atlantic. The position was never filled in.");

  /* Far from the map centre? Say whether swapping the two fixes it. */
  if (center && isNum(center[0]) && isNum(center[1])) {
    const d = km(center[1], center[0], row.lat, row.lng);
    if (d > 150) {
      const swapped = km(center[1], center[0], row.lng, row.lat);
      if (swapped < 150 && Math.abs(row.lng) <= 90)
        rep.err(where, `this is ${Math.round(d)} km from the map centre, but only ${Math.round(swapped)} km away if lat and lng are swapped. Check the two columns are the right way round.`);
      else
        rep.warn(where, `this is ${Math.round(d)} km from the map centre. Check lat and lng, or move the centre in Meta.`);
    }
  }
}

function enumWarn(rep, where, value, allowed, label) {
  if (value === undefined || value === null || value === "") return;
  if (!allowed.includes(String(value)))
    rep.warn(where, `${label} is "${value}". Expected one of: ${allowed.join(", ")}. It will be shown as given.`);
}

/* ================================================================ meta ==== */
function checkMeta(rep, meta) {
  const W = "Meta";
  if (!meta || typeof meta !== "object") { rep.err(W, "the Meta block is missing. An Atlas needs at least a title, a date, a centre and a zoom."); return null; }
  if (!isStr(meta.title)) rep.err(W, "title is empty. This is the name on the page and the browser tab.");
  if (!isStr(meta.asOf)) rep.err(W, "asOf is empty. Give the date the data is current to, as 2026-10 or 2026-10-08.");
  else if (!AS_OF.test(meta.asOf)) rep.err(W, `asOf is "${meta.asOf}". Write it as 2026-10 or 2026-10-08.`);

  const c = meta.center;
  if (!Array.isArray(c) || c.length !== 2 || !isNum(c[0]) || !isNum(c[1]))
    rep.err(W, "center must be two numbers, longitude first then latitude, for example [80.172, 12.948].");
  else {
    if (c[1] < -90 || c[1] > 90)
      rep.err(W, `center is [${c[0]}, ${c[1]}] but the second number must be a latitude between -90 and 90. The order is [longitude, latitude].`);
    else if (Math.abs(c[1]) > 50 && Math.abs(c[0]) <= 50)
      rep.warn(W, `center is [${c[0]}, ${c[1]}]. That reads like [latitude, longitude]; the order is [longitude, latitude].`);
  }
  if (!isNum(meta.zoom)) rep.err(W, "zoom is empty. Use about 11 for a city and 14 for a single district.");
  else if (meta.zoom < 0 || meta.zoom > 22) rep.err(W, `zoom is ${meta.zoom}. It runs from 0 to 22.`);

  if (!isStr(meta.sheet)) rep.warn(W, "sheet is empty. Naming the workbook the numbers came from is what makes the study answerable when a client questions a figure.");
  if (meta.nextSteps !== undefined && !Array.isArray(meta.nextSteps))
    rep.err(W, "nextSteps must be a list of lines, one per step.");
  return Array.isArray(c) && isNum(c[0]) && isNum(c[1]) ? c : null;
}

/* ============================================================= options ==== */
function checkOptions(rep, options, center, zoneKeys) {
  const W = "Options";
  if (!Array.isArray(options) || options.length === 0) {
    rep.err(W, "there are no options. An Atlas needs at least one property.");
    return;
  }
  const ids = new Map(), names = new Map();
  options.forEach((row, i) => {
    const where = at(W, i, row);
    if (!row || typeof row !== "object") { rep.err(`${W} row ${i + 1}`, "this row is not filled in."); return; }

    if (!isStr(row.id)) rep.err(where, "id is empty. Give a short lower-case name such as kar-towers; it is used in the page address.");
    else if (!SLUG.test(row.id)) rep.err(where, `id is "${row.id}". Use lower-case letters, numbers and hyphens only, such as kar-towers.`);
    else if (ids.has(row.id)) rep.err(where, `id "${row.id}" is already used by row ${ids.get(row.id) + 1}. Each option needs its own id.`);
    else ids.set(row.id, i);

    if (!isStr(row.name)) rep.err(where, "name is empty. This is the property name on the card and the map.");
    else {
      const k = row.name.trim().toLowerCase();
      if (names.has(k)) rep.warn(where, `name "${row.name}" is also used by row ${names.get(k) + 1}. Two cards will look identical.`);
      else names.set(k, i);
    }

    coords(rep, where, row, center);
    enumWarn(rep, where, row.precision, PRECISION, "precision");
    if (!isStr(row.precision)) rep.warn(where, "precision is empty, so the pin cannot say how exact it is. Use building, complex, street, locality or approx.");
    if (!isStr(row.geoSrc)) rep.warn(where, "geoSrc is empty. Without a source link the position cannot be defended.");

    if (zoneKeys.size) {
      if (!isStr(row.micro)) rep.warn(where, "micro is empty, so this option sits in no micro-market and will be missing from those filters.");
      else if (!zoneKeys.has(row.micro))
        rep.err(where, `micro is "${row.micro}", which is not one of the micro-market keys (${[...zoneKeys].join(", ")}). The filter would come up empty.`);
    }
    if (row.facts !== undefined) {
      if (!Array.isArray(row.facts)) rep.err(where, "facts must be a list of label and value pairs.");
      else row.facts.forEach((f, j) => {
        if (!f || !isStr(f.k) || f.v === undefined || f.v === null || f.v === "")
          rep.err(where, `fact ${j + 1} needs both a label (k) and a value (v).`);
      });
    }
  });
  rep.stats.options = options.length;
}

/* =============================================================== zones ==== */
function checkZones(rep, zones, options) {
  const keys = new Set();
  if (zones === undefined) return keys;
  const W = "Micro-markets";
  if (!Array.isArray(zones)) { rep.err(W, "this block must be a list of micro-markets."); return keys; }
  zones.forEach((z, i) => {
    const where = at(W, i, z, "key");
    if (!isStr(z.key)) rep.err(where, "key is empty. This is the short code the options point at, such as gst.");
    else if (keys.has(z.key)) rep.err(where, `key "${z.key}" is used twice.`);
    else keys.add(z.key);
    if (!isStr(z.label)) rep.err(where, "label is empty. This is the short name on the filter button.");
    if (!isStr(z.name)) rep.warn(where, "name is empty, so the micro-market has no full name to show on its card.");
    for (const k of ["pros", "cons"])
      if (z[k] !== undefined && !Array.isArray(z[k])) rep.err(where, `${k} must be a list of lines.`);
  });
  if (Array.isArray(options)) {
    const used = new Set(options.map(o => o && o.micro).filter(Boolean));
    for (const k of keys)
      if (!used.has(k)) {
        const z = zones.find(x => x.key === k);
        rep.warn(`Micro-markets (${k})`, `no option is in "${(z && z.label) || k}", so this filter will always be empty.`);
      }
  }
  rep.stats.zones = zones.length;
  return keys;
}

/* ============================================================= transit ==== */
function checkTransit(rep, transit, center) {
  if (transit === undefined) return;
  const W = "Transit";
  if (!transit || typeof transit !== "object") { rep.err(W, "this block must have a list of lines."); return; }
  if (transit.lines === undefined) { rep.warn(W, "there are no lines, so no rail or metro is drawn."); return; }
  if (!Array.isArray(transit.lines)) { rep.err(W, "lines must be a list."); return; }

  const keys = new Set();
  let stations = 0;
  transit.lines.forEach((l, i) => {
    const where = at(`${W} line`, i, l, "key");
    if (!isStr(l.key)) rep.err(where, "key is empty. Give the line a short code such as blue.");
    else if (keys.has(l.key)) rep.err(where, `key "${l.key}" is used twice.`);
    else keys.add(l.key);
    if (!isStr(l.name)) rep.err(where, "name is empty. This is the line name shown to the reader.");
    enumWarn(rep, where, l.mode, MODES, "mode");
    enumWarn(rep, where, l.status, STATUSES, "status");
    if (!Array.isArray(l.stations) || l.stations.length === 0) {
      rep.warn(where, "this line has no stations, so nothing is drawn for it.");
      return;
    }
    l.stations.forEach((s, j) => {
      const sw = `${W} line ${i + 1}${isStr(l.name) ? ` (${l.name})` : ""}, station ${j + 1}${isStr(s && s.name) ? ` (${s.name})` : ""}`;
      if (!s || typeof s !== "object") { rep.err(sw, "this station is not filled in."); return; }
      if (!isStr(s.name)) rep.err(sw, "name is empty.");
      coords(rep, sw, s, center);
      stations++;
    });
  });
  if (transit.anchors !== undefined) {
    if (!Array.isArray(transit.anchors)) rep.err(W, "anchors must be a list of named points.");
    else transit.anchors.forEach((a, i) => {
      const where = at(`${W} anchor`, i, a);
      if (!isStr(a.name)) rep.err(where, "name is empty.");
      coords(rep, where, a, center);
    });
  }
  rep.stats.transitLines = transit.lines.length;
  rep.stats.transitStations = stations;
}

/* ================================================================= bus ==== */
/* Two shapes ship today and both are right, so both are accepted.

     stops  individual stops, either { name, lat, lng, routes } or the compact
            tuple [name, lat, lng, routes] that Chennai uses for 108 stops.
            Note the tuple is lat then lng, which is the order a person reads
            off a map page.
     path   a drawn corridor, as [lng, lat] pairs in GeoJSON order, which is
            what Indore uses for the iBus route.

   The two orders are a trap, so each is checked against its own rule rather
   than guessed at. */
function checkBus(rep, bus, center) {
  if (bus === undefined) return;
  const W = "Buses";
  if (!bus || typeof bus !== "object") { rep.err(W, "this block must have stops, a path, or both."); return; }
  let stops = 0, pathPts = 0;

  if (bus.stops !== undefined) {
    if (!Array.isArray(bus.stops)) rep.err(W, "stops must be a list of stops.");
    else bus.stops.forEach((s, i) => {
      const where = `${W} stop ${i + 1}`;
      let row = null;
      if (Array.isArray(s)) {
        if (s.length < 3 || !isStr(s[0]) || !isNum(s[1]) || !isNum(s[2])) {
          rep.err(where, "a stop written as a list must be [name, latitude, longitude] and may add a route count.");
          return;
        }
        row = { name: s[0], lat: s[1], lng: s[2], routes: s[3] };
      } else if (s && typeof s === "object") {
        row = s;
        if (!isStr(row.name)) rep.warn(where, "name is empty, so this stop has no label.");
      } else { rep.err(where, "this stop is not filled in."); return; }
      coords(rep, `${W} stop ${i + 1}${isStr(row.name) ? ` (${row.name})` : ""}`, row, center);
      stops++;
    });
  }

  if (bus.path !== undefined) {
    if (!Array.isArray(bus.path)) rep.err(W, "path must be a list of longitude and latitude pairs.");
    else bus.path.forEach((p, i) => {
      const where = `${W} path point ${i + 1}`;
      if (!Array.isArray(p) || p.length < 2 || !isNum(p[0]) || !isNum(p[1]))
        rep.err(where, "this must be two numbers, longitude first then latitude.");
      else if (p[1] < -90 || p[1] > 90)
        rep.err(where, `the second number is ${p[1]}, which is not a latitude. A path is [longitude, latitude].`);
      else pathPts++;
    });
  }

  if (bus.stops === undefined && bus.path === undefined)
    rep.warn(W, "there are no stops and no path, so nothing is drawn.");
  if (stops) rep.stats.busStops = stops;
  if (pathPts) rep.stats.busPathPoints = pathPts;
}

/* ============================================================== places ==== */
function checkPlaces(rep, places, center) {
  if (places === undefined) return;
  const W = "Places";
  if (!Array.isArray(places)) { rep.err(W, "this block must be a list of places."); return; }
  const ids = new Map(), kinds = new Set();
  places.forEach((p, i) => {
    const where = at(W, i, p);
    if (!p || typeof p !== "object") { rep.err(`${W} row ${i + 1}`, "this row is not filled in."); return; }
    if (!isStr(p.id)) rep.err(where, "id is empty. Give a short lower-case name.");
    else if (ids.has(p.id)) rep.err(where, `id "${p.id}" is already used by row ${ids.get(p.id) + 1}.`);
    else ids.set(p.id, i);
    if (!isStr(p.name)) rep.err(where, "name is empty.");
    if (!isStr(p.kind)) rep.err(where, "kind is empty. It groups places into a map layer that can be switched on and off, such as it, edu or res.");
    else kinds.add(p.kind);
    coords(rep, where, p, center);
    enumWarn(rep, where, p.precision, PRECISION, "precision");
  });
  rep.stats.places = places.length;
  rep.stats.placeKinds = [...kinds].sort();
}

/* =============================================================== facts ==== */
function checkFacts(rep, facts) {
  if (facts === undefined) return;
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) {
    rep.err("Facts", "this block must be groups of facts, such as market, talent and transit.");
    return;
  }
  let n = 0;
  for (const [group, list] of Object.entries(facts)) {
    const W = `Facts, ${group}`;
    if (!Array.isArray(list)) { rep.err(W, "this group must be a list of facts."); continue; }
    list.forEach((f, i) => {
      const where = `${W} row ${i + 1}${f && isStr(f.k) ? ` (${f.k})` : ""}`;
      if (!f || typeof f !== "object") { rep.err(where, "this fact is not filled in."); return; }
      if (!isStr(f.k)) rep.err(where, "the label (k) is empty.");
      if (f.v === undefined || f.v === null || f.v === "") rep.err(where, "the value (v) is empty.");
      if (!isStr(f.src)) rep.warn(where, "src is empty. A fact without a source link cannot be defended when a client questions it.");
      enumWarn(rep, where, f.conf !== undefined ? f.conf : f.confidence, CONFIDENCE, "conf");
      n++;
    });
  }
  rep.stats.facts = n;
  rep.stats.factGroups = Object.keys(facts);
}

/* ============================================================ existing ==== */
function checkExisting(rep, ex, center) {
  if (ex === undefined) return;
  const W = "Current office";
  if (!ex || typeof ex !== "object") { rep.err(W, "this block must describe the current office, or be left out entirely."); return; }
  if (!isStr(ex.id)) rep.err(W, "id is empty.");
  if (!isStr(ex.name)) rep.err(W, "name is empty. This is what the current office is called on the map.");
  coords(rep, W, ex, center);
  enumWarn(rep, W, ex.precision, PRECISION, "precision");
}

/* ============================================================ validate ==== */
function validate(bundle) {
  const rep = new Report();
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    rep.err("Bundle", "this is not an Atlas bundle. It must be an object with a meta block and an options block.");
    return rep;
  }
  for (const k of Object.keys(bundle))
    if (!BLOCKS.includes(k))
      rep.warn("Bundle", `"${k}" is not a block the engine knows (${BLOCKS.join(", ")}). It will be ignored.`);

  const center = checkMeta(rep, bundle.meta);
  const zoneKeys = checkZones(rep, bundle.zones, bundle.options);
  checkOptions(rep, bundle.options, center, zoneKeys);
  checkExisting(rep, bundle.existing, center);
  checkTransit(rep, bundle.transit, center);
  checkBus(rep, bundle.bus, center);
  checkPlaces(rep, bundle.places, center);
  checkFacts(rep, bundle.facts);
  return rep;
}

/* A report as the team reads it in /admin/ or on the command line.

   One mistake made in every row is one mistake, not two hundred. Identical
   messages are collapsed to a single line that says how many rows it hit and
   names the first few, because a report nobody can read to the end is a report
   that comes back to a developer. */
function collapse(items) {
  const groups = new Map();
  for (const it of items) {
    const g = groups.get(it.message) || { message: it.message, wheres: [] };
    g.wheres.push(it.where);
    groups.set(it.message, g);
  }
  return [...groups.values()].map(g => {
    if (g.wheres.length === 1) return `  ${g.wheres[0]}: ${g.message}`;
    const shown = g.wheres.slice(0, 3).join("; ");
    const rest = g.wheres.length - 3;
    return `  ${g.wheres.length} rows: ${g.message}\n      ${shown}${rest > 0 ? `; and ${rest} more` : ""}`;
  });
}

function format(rep, title) {
  const L = [];
  if (title) L.push(title, "");
  if (rep.errors.length) {
    const n = rep.errors.length;
    L.push(`${n} ${n === 1 ? "problem stops" : "problems stop"} this Atlas from being drawn:`, "");
    collapse(rep.errors).forEach(x => L.push(x));
    L.push("");
  }
  if (rep.warnings.length) {
    const n = rep.warnings.length;
    L.push(`${n} ${n === 1 ? "thing is" : "things are"} worth fixing, but the Atlas will still work:`, "");
    collapse(rep.warnings).forEach(x => L.push(x));
    L.push("");
  }
  if (!rep.errors.length && !rep.warnings.length) L.push("Nothing to fix.", "");
  const s = rep.stats;
  const bits = [];
  if (s.options) bits.push(`${s.options} options`);
  if (s.zones) bits.push(`${s.zones} micro-markets`);
  if (s.transitLines) bits.push(`${s.transitLines} transit ${s.transitLines === 1 ? "line" : "lines"}, ${s.transitStations} stations`);
  if (s.places) bits.push(`${s.places} places in ${s.placeKinds.length} ${s.placeKinds.length === 1 ? "layer" : "layers"}`);
  if (s.busStops) bits.push(`${s.busStops} bus stops`);
  if (s.busPathPoints) bits.push(`${s.busPathPoints} bus path points`);
  if (s.facts) bits.push(`${s.facts} facts in ${s.factGroups.length} groups`);
  if (bits.length) L.push(`Contents: ${bits.join(" \u00b7 ")}`);
  return L.join("\n");
}

module.exports = { validate, format, collapse, Report, PRECISION, CONFIDENCE, MODES, STATUSES, BLOCKS };
