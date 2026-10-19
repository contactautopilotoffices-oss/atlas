/* The brief the Atlas guide answers from: one study page's own data file,
   read on the server so the browser cannot change what the guide "knows".

   Each data.js is a browser script that assigns window.* globals. It runs in
   an empty vm context, then the parts a reader would ask about are kept and
   map geometry (polygons, coordinates of minor places) is dropped. Distances
   that the page computes in the browser (nearest station, distance from the
   current office) are computed here the same way, so the guide can quote
   them instead of guessing. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* Literal paths, so Vercel's file tracing bundles the data with the function. */
const FILES = {
  chennai: path.join(__dirname, "..", "..", "chennai", "data.js"),
  noida: path.join(__dirname, "..", "..", "noida", "data.js"),
  whitefield: path.join(__dirname, "..", "..", "whitefield", "data.js"),
};

const cache = new Map();

/* What Autopilot itself offers on a page. Only facts the Autopilot team has
   confirmed go here; the guide is told to send everything else (seats, area,
   price, dates) to the team rather than fill it in. Add fields as they are
   confirmed. */
const OFFERS = {
  whitefield: {
    by: "Autopilot Offices",
    offer: "Autopilot managed offices, available on the 11th floor at Rhapsody.",
    confirmed: ["Autopilot runs managed offices at Rhapsody", "Space is available on the 11th floor"],
    not_confirmed_yet: ["seat count", "area", "price per seat", "move-in date", "fit-out and amenities"],
    next_step: "Ask the Autopilot team for a visit, a seat plan and pricing for the 11th floor.",
  },
};

function load(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file, timeout: 2000 });
  return sandbox.window;
}

const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));
const hasPos = (p) => p && typeof p.lat === "number" && typeof p.lng === "number";

/* Same rule as the pages: open if the data says so or its opening date has passed. */
function stations(transit) {
  const now = new Date();
  const passed = (iso) => !!iso && now >= new Date(iso + "T00:00:00+05:30");
  return (transit.lines || []).flatMap((L) => (L.stations || []).filter(hasPos).map((s) => ({
    name: s.name, line: L.short || L.name, mode: L.mode, lat: s.lat, lng: s.lng,
    open: !!s.open || passed(s.opens), opens: s.opens || s.target || null,
  })));
}
function nearest(p, list) {
  let best = null;
  for (const s of list) { const d = km(p, s); if (!best || d < best.d) best = { s, d }; }
  return best;
}
const stationNote = (n) => n && { station: n.s.name, line: n.s.line, straight_line_km: round(n.d, 2), walk_min_at_80m_per_min: Math.round(n.d * 1000 / 80) };

function cityStudy(w, prefix, page) {
  const meta = w[prefix + "_META"], options = w[prefix + "_OPTIONS"], existing = w[prefix + "_EXISTING"];
  const all = stations(w[prefix + "_TRANSIT"] || {});
  const open = all.filter((s) => s.open), planned = all.filter((s) => !s.open && s.mode === "metro");
  const drop = ["lat", "lng", "photo", "thumb", "photoRender", "geoSrc", "geoNote", "precision", "coordNote", "coordSrc"];
  const opts = options.map((o) => ({
    ...omit(o, drop),
    computed: {
      straight_line_km_from_current_office: hasPos(existing) && hasPos(o) ? round(km(existing, o)) : null,
      nearest_open_station: hasPos(o) ? stationNote(nearest(o, open)) : null,
      nearest_planned_metro: hasPos(o) && planned.length ? { ...stationNote(nearest(o, planned)), expected: nearest(o, planned).s.opens } : null,
    },
  }));
  const zones = (w[prefix + "_ZONES"] || []).map((z) => omit(z, ["shape", "color", "poly"]));
  return {
    page,
    meta: omit(meta, ["center", "zoom"]),
    current_office: omit(existing, ["lat", "lng", "geoSrc", "precision"]),
    options: opts,
    zones,
    facts: w[prefix + "_FACTS"] || {},
    transit_as_of: (w[prefix + "_TRANSIT"] || {}).asOfText || null,
    method_note: "Distances under `computed` are straight-line, worked out from the map positions. Drive times quoted in options come from the client's sheet.",
    showable: opts.map((o) => ({ id: o.id, name: o.name })),
  };
}

function whitefield(w) {
  const W = w.WF, site = W.site;
  const metroStations = ((W.metro && W.metro.stations) || []).filter(hasPos);
  const near = (list) => (list || []).filter(hasPos).map((p) => ({ ...omit(p, ["lat", "lng", "coordNote", "polygon", "centres"]), straight_line_km_from_site: round(km(site, p), 2) }));
  const showable = [];
  for (const key of ["techparks", "hospitals", "deals", "residential", "colleges", "environment"]) {
    for (const p of W[key] || []) if (p && p.id) showable.push({ id: p.id, name: p.name || p.building || p.tenant || p.id });
  }
  if (site.id) showable.unshift({ id: site.id, name: site.name });
  return {
    page: "whitefield",
    meta: W.meta,
    site: omit(site, ["lat", "lng"]),
    metro: { ...omit(W.metro, ["stations"]), stations_by_distance: near(metroStations).sort((a, b) => a.straight_line_km_from_site - b.straight_line_km_from_site) },
    connectivity: W.connectivityFacts,
    micromarkets: (W.micromarkets || []).map((m) => omit(m, ["poly", "color", "label", "side"])),
    micromarket_note: W.micromarketNote,
    new_supply: W.newSupply,
    competition: (W.competition || []).map((c) => ({ ...omit(c, ["centres"]), centres: (c.centres || []).length })),
    competition_note: W.competitionNote,
    hospitals: near(W.hospitals),
    environment: near(W.environment),
    techparks: near(W.techparks),
    residential: near(W.residential),
    colleges: near(W.colleges),
    deals: near(W.deals),
    market: W.market,
    method_note: "straight_line_km_from_site is worked out from the map positions, not a road distance.",
    showable,
  };
}

function getBrief(page) {
  if (!FILES[page]) return null;
  if (cache.has(page)) return cache.get(page);
  const w = load(FILES[page]);
  const brief = page === "chennai" ? cityStudy(w, "CHN", page) : page === "noida" ? cityStudy(w, "NOI", page) : whitefield(w);
  const urls = new Set();
  JSON.stringify(brief, (k, v) => { if (typeof v === "string" && /^https?:\/\//.test(v)) urls.add(v); return v; });
  if (OFFERS[page]) brief.autopilot_offer = OFFERS[page];
  const entry = { brief, text: JSON.stringify(brief), ids: brief.showable.map((s) => s.id), urls };
  cache.set(page, entry);
  return entry;
}

module.exports = { getBrief, PAGES: Object.keys(FILES) };
