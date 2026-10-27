/* ============================================================================
   ATLAS CMS · metro lines and stations, added automatically

   Every atlas shows the metro: it is one of the fundamentals. Nobody should
   have to type station coordinates, so Build asks OpenStreetMap (through the
   public Overpass API) for every metro, light-rail and monorail line that
   runs through the area around the pins, with its stations in order, and
   adds them as rows on the Transit sheet with a link to the line in OSM.

   Lines the person supplied are kept as they are; a line already there by
   name or number is not added twice. Pins spread across cities (a network
   atlas) are grouped into areas of about 25 km and each area is asked for
   separately. Any failure leaves the atlas as it was and says so: the metro
   is fetched again on the next Build.

   ATLAS_METRO=off skips it (the tests run offline and must not depend on a
   public service).
   ============================================================================ */
"use strict";

const ENDPOINTS = () => [process.env.OVERPASS_URL, "https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"].filter(Boolean);
const MODE = { subway: "metro", light_rail: "metro", monorail: "monorail" };
const PALETTE = ["#1f6fb2", "#d0417b", "#2e7d5b", "#b7791f", "#6b4fbb", "#0f8b8d", "#c0392b", "#7a5c3e"];
const MAX_LINES = 14, MAX_AREAS = 6, MARGIN_KM = 6;

function km(aLat, aLng, bLat, bLng) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* Pins into areas of about 25 km, each a bounding box with a margin. */
function areas(points) {
  const groups = [];
  for (const p of points) {
    const g = groups.find(g => km(g.lat, g.lng, p.lat, p.lng) < 25);
    if (g) { g.pts.push(p); g.lat = g.pts.reduce((a, x) => a + x.lat, 0) / g.pts.length; g.lng = g.pts.reduce((a, x) => a + x.lng, 0) / g.pts.length; }
    else groups.push({ lat: p.lat, lng: p.lng, pts: [p] });
  }
  return groups.sort((a, b) => b.pts.length - a.pts.length).slice(0, MAX_AREAS).map(g => {
    const dLat = MARGIN_KM / 111, dLng = MARGIN_KM / (111 * Math.cos(g.lat * Math.PI / 180));
    const lats = g.pts.map(p => p.lat), lngs = g.pts.map(p => p.lng);
    return [Math.min(...lats) - dLat, Math.min(...lngs) - dLng, Math.max(...lats) + dLat, Math.max(...lngs) + dLng].map(v => +v.toFixed(5));
  });
}

const query = ([s, w, n, e]) => `[out:json][timeout:25];
relation["type"="route"]["route"~"^(subway|light_rail|monorail)$"](${s},${w},${n},${e})->.r;
.r out body;
node(r.r);
out body;`;

async function overpass(bbox, fetchFn) {
  let last;
  for (const url of ENDPOINTS()) {
    try {
      const r = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "atlas.autopilotoffices.com (metro layer)" },
        body: "data=" + encodeURIComponent(query(bbox)),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) { last = new Error(`Overpass answered ${r.status}`); continue; }
      return await r.json();
    } catch (e) { last = e; }
  }
  throw last || new Error("Overpass did not answer");
}

const baseName = (t) => String(t["name:en"] || t.name || "").split(/\s*[:：]\s*|\s+(?:→|->|=>|–|—)\s+/)[0].trim();
const cleanStation = (n) => String(n || "").replace(/\s*\((?:platform|stop)[^)]*\)\s*$/i, "").replace(/\s+metro station$/i, "").trim();
const colourOk = (c) => /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c || "") || /^[a-z]{3,20}$/i.test(c || "");

/* Overpass JSON into lines: one per line (both directions merged), with its
   stations in order. */
function linesFrom(json) {
  const nodes = new Map();
  const rels = [];
  for (const el of (json && json.elements) || []) {
    if (el.type === "node") nodes.set(el.id, el);
    else if (el.type === "relation") rels.push(el);
  }
  const byLine = new Map();
  for (const r of rels) {
    const t = r.tags || {};
    const name = baseName(t) || (t.ref ? `Line ${t.ref}` : "");
    if (!name) continue;
    const members = (r.members || []).filter(m => m.type === "node");
    let stops = members.filter(m => /^stop/.test(m.role || ""));
    if (!stops.length) stops = members.filter(m => /^platform/.test(m.role || ""));
    const stations = [];
    for (const m of stops) {
      const n = nodes.get(m.ref);
      if (!n || !isFinite(n.lat) || !isFinite(n.lon)) continue;
      const sname = cleanStation(n.tags && (n.tags["name:en"] || n.tags.name));
      if (!sname || (stations.length && stations[stations.length - 1].name === sname)) continue;
      stations.push({ name: sname, lat: +n.lat.toFixed(6), lng: +n.lon.toFixed(6) });
    }
    if (stations.length < 2) continue;
    const key = `${t.network || ""}|${t.ref || name}`.toLowerCase();
    const had = byLine.get(key);
    if (!had || stations.length > had.stations.length) {
      byLine.set(key, { id: r.id, name, short: t.ref || "", mode: MODE[t.route] || "metro", colour: colourOk(t.colour) ? (/^[0-9a-f]{3,6}$/i.test(t.colour) ? "#" + t.colour : t.colour) : "", stations });
    }
  }
  return [...byLine.values()];
}

/* The metro for these pins, as Transit sheet rows, leaving out lines whose
   name or number is already in `have`. */
async function metroRows(points, { have = [], fetchFn = fetch } = {}) {
  if (process.env.ATLAS_METRO === "off") return { rows: [], lines: [], skipped: true };
  const pts = (points || []).filter(p => p && isFinite(p.lat) && isFinite(p.lng));
  if (!pts.length) return { rows: [], lines: [] };
  const seen = new Set(have.map(h => String(h || "").toLowerCase().trim()).filter(Boolean));
  const lines = [];
  for (const bbox of areas(pts)) {
    const json = await overpass(bbox, fetchFn);
    for (const l of linesFrom(json)) {
      const k1 = l.name.toLowerCase(), k2 = l.short ? `line ${l.short}`.toLowerCase() : "";
      if (seen.has(k1) || (k2 && seen.has(k2)) || lines.some(x => x.id === l.id || x.name === l.name)) continue;
      lines.push(l);
      if (lines.length >= MAX_LINES) break;
    }
    if (lines.length >= MAX_LINES) break;
  }
  const rows = [];
  lines.forEach((l, i) => {
    for (const s of l.stations) rows.push({
      "Line name": l.name, "Line short name": l.short || undefined, "Mode": l.mode, "Line colour": l.colour || PALETTE[i % PALETTE.length],
      "Station name": s.name, "Latitude": s.lat, "Longitude": s.lng, "Open?": "yes",
      "Source": `https://www.openstreetmap.org/relation/${l.id}`,
    });
  });
  return { rows, lines: lines.map(l => ({ name: l.name, stations: l.stations.length })) };
}

module.exports = { metroRows, linesFrom, areas, query };
