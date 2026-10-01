/* ============================================================================
   ATLAS · WHITEFIELD · prepared for Total Environment

   One site, Rhapsody, and everything around it that bears on an office or
   flex decision there, in layers the brief asks for:

     1 competition    the flex operators already trading nearby
     2 connectivity   the Purple Line from Whitefield (Kadugodi) to KR Puram
     3 social         hospitals
     4 demand         tech parks and employers (talent), where people live,
                      colleges, and recent leasing deals
     5 environment    lakes and parks
   plus drive-time catchments and the three road directions out of the site.

   Built from the same parts as the Indore study (front-end gate, Mapbox map
   behind glass panes, cited facts). data.js holds every fact with its
   source; this file only reads it and derives distances on screen.
   ============================================================================ */
"use strict";

/* Access gate. The page holds only a SHA-256 of the normalised
   "ID:PASSWORD". It keeps a casual visitor out of the view; it does not make
   data.js private. The site root login routes here via clients/manifest.js. */
const GATE_HASH = "89142f042706af1e161334925aa7714e21c5d8f70e35249650518c9c1a819827";
const AUTH_KEY = "wf-auth", HOME = "/whitefield/";
async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const D = window.WF, M = D.meta, SITE = D.site;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inr = (n) => n == null ? "n/a" : Math.round(n).toLocaleString("en-IN");
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cite = (u, label) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || host(u))} ↗</a>` : "";

/* ------------------------------------------------------------ geometry -- */
function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const KM_LAT = 110.57, KM_LNG = 111.32 * Math.cos(12.98 * Math.PI / 180);
function circle(c, rKm, n = 72) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n * 2 * Math.PI; pts.push([c[0] + rKm * Math.cos(t) / KM_LNG, c[1] + rKm * Math.sin(t) / KM_LAT]); }
  return pts;
}
/* Point at a bearing (degrees clockwise from north) and distance from c. */
const offset = (c, deg, d) => { const t = deg * Math.PI / 180; return [c[0] + d * Math.sin(t) / KM_LNG, c[1] + d * Math.cos(t) / KM_LAT]; };
const bearing = (a, b) => (Math.atan2((b.lng - a.lng) * KM_LNG, (b.lat - a.lat) * KM_LAT) * 180 / Math.PI + 360) % 360;
const fmtKm = (d) => `${d < 1 ? d.toFixed(2) : d.toFixed(1)} km`;
/* Indicative travel times. East Bangalore peak traffic is slow, so driving
   assumes 18 km/h on the road network, which runs about 1.35x the straight
   line; walking 4.8 km/h with a 1.25x detour factor. Routed drive-time
   catchments replace the rings when Mapbox can supply them. */
const SPEED_KMH = 18, ROAD_FACTOR = 1.35, WALK_KMH = 4.8, WALK_FACTOR = 1.25;
const driveMin = (d) => Math.max(1, Math.round(d * ROAD_FACTOR / SPEED_KMH * 60));
const walkMin = (d) => Math.max(1, Math.round(d * WALK_FACTOR / WALK_KMH * 60));
const ringKm = (min) => min / 60 * SPEED_KMH / ROAD_FACTOR;
const CATCH = [10, 20, 30];
const CATCH_COL = { 10: "#a3502c", 20: "#c27a4e", 30: "#d9a77f" };
const METHOD_RINGS = `Catchments are straight-line rings for ${CATCH.join(", ")} minutes of driving at ${SPEED_KMH} km/h with a ${ROAD_FACTOR}x road factor. Indicative, not routed.`;
const METHOD_ISO = `Catchments are routed drive-time areas from Mapbox for ${CATCH.join(", ")} minutes, with typical traffic.`;

/* ------------------------------------------------------------- kinds ----
   Every place on the map is one of these kinds. Colours are the validated
   eight-slot categorical palette (colour-blind safe). Colour marks the layer;
   the name and kind are always written beside it, so colour never carries
   meaning alone. */
const KINDS = {
  comp:   { label: "Flex competition", short: "Competition", color: "#e34948", tab: "competition" },
  metro:  { label: "Purple Line station", short: "Metro", color: "#4a3aa7", tab: "connectivity" },
  social: { label: "Hospital", short: "Hospitals", color: "#1baf7a", tab: "social" },
  talent: { label: "Tech park / employer", short: "Tech parks", color: "#2a78d6", tab: "talent" },
  res:    { label: "Residential catchment", short: "Homes", color: "#eb6834", tab: "talent" },
  edu:    { label: "College", short: "Colleges", color: "#e87ba4", tab: "talent" },
  deal:   { label: "Recent deal", short: "Deals", color: "#eda100", tab: "deals" },
  env:    { label: "Lake / park", short: "Green & blue", color: "#008300", tab: "social" },
  mm:     { label: "Office micro-market", short: "Micro-markets", color: "#2a1e16", tab: "markets" }
};

/* ------------------------------------------------------- micro-markets --
   Zoomed out, the map reads like a broker's market map: each office
   micro-market is a soft coloured area with its number on it and a callout
   line to its name. Corridors (ORR, Old Madras Road, Sarjapur Road) are
   drawn as bands along the road; areas are smoothed outlines. The zones fade
   as you zoom in, where the individual places take over. */
function chaikin(pts, rounds = 3) {
  let p = pts.slice();
  for (let r = 0; r < rounds; r++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    p = out;
  }
  return p;
}
function band(path, wKm) {
  const h = wKm / 2, L = [], R = [];
  path.forEach((pt, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const dx = (b[0] - a[0]) * KM_LNG, dy = (b[1] - a[1]) * KM_LAT, n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n, ny = dx / n;
    L.push([pt[0] + nx * h / KM_LNG, pt[1] + ny * h / KM_LAT]); R.push([pt[0] - nx * h / KM_LNG, pt[1] - ny * h / KM_LAT]);
  });
  return chaikin([...L, ...R.reverse()], 2);
}
const zoneRing = (z) => { const r = z.path ? band(z.path, z.widthKm || 1.4) : chaikin(z.poly); return [...r, r[0]]; };
const zoneAnchor = (z) => z.path ? z.path[Math.floor(z.path.length / 2)] : [z.poly.reduce((s, p) => s + p[0], 0) / z.poly.length, z.poly.reduce((s, p) => s + p[1], 0) / z.poly.length];
const MM = (D.micromarkets || []).map(z => ({ ...z, ring: zoneRing(z), anchor: zoneAnchor(z) }));
/* Distance from the site to a zone: 0 inside it, else to its nearest edge point. */
function zoneDist(z, from = SITE) {
  if (inPoly([from.lng, from.lat], z.ring)) return 0;
  return Math.min(...z.ring.map(c => km(from, { lng: c[0], lat: c[1] })));
}

/* All places in one list, each with its distance from the site. */
const STN = D.metro.stations;
const PLACES = [
  ...D.competition.flatMap(b => b.centres.map((c, i) => ({ ...c, kind: "comp", brand: b.brand, id: c.id || `comp-${slug(b.brand)}-${i}`, sub: c.sub || [b.brand, c.locality].filter(Boolean).join(" · ") }))),
  ...STN.map(s => ({ ...s, kind: "metro", id: `stn-${s.id}`, sub: `Purple Line · ${s.open ? "open" : "not yet open"}` })),
  ...D.hospitals.map(x => ({ ...x, kind: "social" })),
  ...D.techparks.map(x => ({ ...x, kind: "talent" })),
  ...D.residential.map(x => ({ ...x, kind: "res" })),
  ...D.colleges.map(x => ({ ...x, kind: "edu" })),
  ...D.deals.map(x => ({ ...x, kind: "deal" })),
  ...D.environment.map(x => ({ ...x, kind: "env" }))
].filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p => ({ ...p, d: km(SITE, p) }));
/* Zones join the list after the helpers above exist; their distance is to the edge. */
function addZones() {
  for (const z of MM) PLACES.push({ ...z, id: `mm-${z.key}`, kind: "mm", lng: z.anchor[0], lat: z.anchor[1], d: zoneDist(z) });
}
addZones();
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
const byId = (id) => PLACES.find(p => p.id === id);
const nearest = (kind, from = SITE) => PLACES.filter(p => p.kind === kind && (kind !== "metro" || p.open)).map(p => ({ p, d: km(from, p) })).sort((a, b) => a.d - b.d)[0];

/* ------------------------------------------------------------- state ---- */
const TABS = [
  { key: "overview", label: "Overview", kinds: Object.keys(KINDS).filter(k => k !== "mm") },
  { key: "markets", label: "Micro-markets", kinds: ["mm"] },
  { key: "competition", label: "Competition", kinds: ["comp"] },
  { key: "connectivity", label: "Connectivity", kinds: ["metro"] },
  { key: "talent", label: "Talent & demand", kinds: ["talent", "res", "edu"] },
  { key: "deals", label: "Recent deals", kinds: ["deal"] },
  { key: "social", label: "Social & green", kinds: ["social", "env"] }
];
const S = {
  tab: "overview", sel: null, hov: null, q: "", sort: "dist", sheet: "half", kindFilter: null,
  layers: { mm: true, comp: true, metro: true, social: true, talent: true, res: false, edu: false, deal: true, env: true, catch: true, arrows: true }
};
const tabOf = (k) => TABS.find(t => t.key === k) || TABS[0];

/* ---------------------------------------------------------- catchment ---
   Drive-time areas from the Mapbox Isochrone API when the key allows it,
   otherwise rings. Counts below always say which method produced them. */
let ISO = null;   // FeatureCollection, one polygon per contour, or null
function inPoly(pt, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function inGeom(pt, g) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polys.some(poly => inPoly(pt, poly[0]) && !poly.slice(1).some(h => inPoly(pt, h)));
}
/* Smallest catchment (in minutes) that holds the place, or null. */
function catchOf(p) {
  for (const m of CATCH) {
    if (ISO) { const f = ISO.features.find(x => x.properties.contour === m); if (f && inGeom([p.lng, p.lat], f.geometry)) return m; }
    else if (p.d <= ringKm(m)) return m;
  }
  return null;
}
const within = (kind, m) => PLACES.filter(p => p.kind === kind && (kind !== "metro" || p.open) && catchOf(p) != null && catchOf(p) <= m);
async function loadIsochrones() {
  if (!window.MAPBOX_TOKEN) return;
  for (const profile of ["driving-traffic", "driving"]) {
    try {
      const u = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${SITE.lng},${SITE.lat}?contours_minutes=${CATCH.join(",")}&polygons=true&denoise=1&generalize=40&access_token=${window.MAPBOX_TOKEN}`;
      const r = await fetch(u); if (!r.ok) continue;
      const fc = await r.json();
      if (!fc.features || !fc.features.length) continue;
      ISO = fc; ISO.profile = profile;
      if (map && map.getSource("catch")) { map.getSource("catch").setData(catchFC()); map.getSource("catch-lbl").setData(catchLabelFC()); }
      if (booted) { renderList(); renderPanel(); }
      return;
    } catch (e) { /* fall back to rings */ }
  }
}
function catchFC() {
  if (ISO) return { type: "FeatureCollection", features: ISO.features.slice().sort((a, b) => b.properties.contour - a.properties.contour)
    .map(f => ({ type: "Feature", geometry: f.geometry, properties: { min: f.properties.contour, color: CATCH_COL[f.properties.contour] || "#a3502c" } })) };
  return { type: "FeatureCollection", features: CATCH.slice().reverse().map(m => ({ type: "Feature",
    geometry: { type: "Polygon", coordinates: [circle([SITE.lng, SITE.lat], ringKm(m))] }, properties: { min: m, color: CATCH_COL[m] } })) };
}
function catchLabelFC() {
  return { type: "FeatureCollection", features: CATCH.map(m => {
    let pt = [SITE.lng, SITE.lat + ringKm(m) / KM_LAT];
    if (ISO) {
      const f = ISO.features.find(x => x.properties.contour === m);
      const ring = f && (f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]);
      if (ring) pt = ring.reduce((best, c) => c[1] > best[1] ? c : best, ring[0]);
    }
    return { type: "Feature", geometry: { type: "Point", coordinates: pt }, properties: { label: `${m} min` } };
  }) };
}

/* ---------------------------------------------------------- directions --
   Thin arrows out of the site toward the three road directions in the
   brief. Each points at its anchor; the label carries the distance. */
function arrowsFC() {
  const lines = [], c = [SITE.lng, SITE.lat];
  for (const a of D.arrows) {
    const b = bearing(SITE, a), d = km(SITE, a), len = Math.min(Math.max(d * .72, 1.4), 3.4);
    const s0 = offset(c, b, .32), tip = offset(c, b, len);
    lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: [s0, tip] }, properties: { id: a.id } });
    for (const w of [-28, 28]) lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: [offset(tip, b + 180 + w, .22), tip] }, properties: { id: a.id } });
  }
  return { type: "FeatureCollection", features: lines };
}
function arrowLabelFC() {
  const c = [SITE.lng, SITE.lat];
  return { type: "FeatureCollection", features: D.arrows.map(a => {
    const b = bearing(SITE, a), d = km(SITE, a), len = Math.min(Math.max(d * .72, 1.4), 3.4);
    const west = b > 180, arrow = west ? "← " : "", tail = west ? "" : " →";
    return { type: "Feature", geometry: { type: "Point", coordinates: offset(c, b, len + .35) },
      properties: { label: `${arrow}${a.label}${tail}\n${fmtKm(d)} · about ${driveMin(d)} min`, anchor: west ? "right" : "left" } };
  }) };
}

/* ================================================================ gate == */
function initGate() {
  const norm = (v) => v.trim().toUpperCase().replace(/[\s-]/g, "");
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true;
    let ok = false;
    try { ok = (await sha256(norm($("#g-id").value) + ":" + norm($("#g-pw").value))) === GATE_HASH; } catch (e) { ok = false; }
    busy = false;
    if (ok) { sessionStorage.setItem(AUTH_KEY, "1"); openApp(); }
    else { $("#g-err").textContent = "Not recognised. Access is issued per person."; $("#g-pw").value = ""; $("#g-pw").focus(); }
  };
  startMap();
  const openApp = () => { const g = $("#gate"); g.classList.add("out"); setTimeout(() => g.remove(), 450); boot(); };
  loadBackdrop();
  const comp = PLACES.filter(p => p.kind === "comp"), brands = new Set(comp.map(p => p.brand));
  const nm = nearest("metro");
  $("#g-stats").innerHTML = `<span><b>${comp.length}</b>flex centres mapped</span><span><b>${brands.size}</b>of ${D.competition.length} brands nearby</span>`
    + `<span><b>${nm ? fmtKm(nm.d) : "n/a"}</b>to ${nm ? esc(nm.p.name) : "metro"}</span><span><b>${PLACES.filter(p => p.kind === "deal").length}</b>recent deals</span>`;
  let handoff = null;
  try { handoff = sessionStorage.getItem("atlas-handoff"); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
  if (handoff === HOME) sessionStorage.setItem(AUTH_KEY, "1");
  if (sessionStorage.getItem(AUTH_KEY) === "1") { $("#gate").remove(); boot(); return; }
  $("#g-form").addEventListener("submit", e => { e.preventDefault(); go(); });
  $("#g-id").focus();
}
/* Sign-in backdrop: Total Environment's own Whitefield campus. */
function loadBackdrop() {
  const img = $("#g-bg"); if (!img) return;
  const tall = matchMedia("(max-aspect-ratio: 3/4)").matches;
  const tries = tall ? ["../media/totalenv/backdrop-tall.webp", ...D.backdrop] : [...D.backdrop];
  const next = () => { const u = tries.shift(); if (!u) { img.remove(); return; } img.src = u; };
  img.addEventListener("load", () => img.classList.add("on"));
  img.addEventListener("error", next);
  next();
}

/* ================================================================ map === */
let map;
const MAPBOX_CDN = "https://api.mapbox.com/mapbox-gl-js/v3.10.0/";
function loadMapbox() {
  if (window.mapboxgl) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const js = document.createElement("script"); js.src = MAPBOX_CDN + "mapbox-gl.js"; js.onload = resolve; js.onerror = reject; document.head.appendChild(js);
  });
}
const mapUnavailable = () => { $("#map").innerHTML = `<div class="nomap">Map unavailable right now. Everything else on the page still works.</div>`; };
let booted = false;
function startMap() {
  loadIsochrones();
  if (!window.MAPBOX_TOKEN) return mapUnavailable();
  loadMapbox().then(initMap).catch(mapUnavailable);
}
function boot() {
  booted = true;
  applyRoute(false);
  renderTabs(); renderFilters(); renderList(); renderPanel(); renderLayers();
  wireBoard(); wireSheet(); wirePanes(); wireHints();
  $("#signout").addEventListener("click", () => {
    try { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
    location.replace(location.pathname);
  });
  $("#sort").dataset.hint = "Order the list by distance from Rhapsody or by name.";
  $("#t-q").dataset.hint = "Type part of a name, brand or area to narrow the list.";
  addEventListener("popstate", () => applyRoute(true));
  if (map && map.getSource("places")) { refreshMap(); frame(false); }
}
const MAP_STYLE = "mapbox://styles/mapbox/standard";
const BASEMAP = { lightPreset: "day", theme: "faded", showPointOfInterestLabels: true, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true, show3dObjects: true };
const REDUCED = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function initMap() {
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  const style = window.IND_MAP_STYLE || MAP_STYLE;
  map = new mapboxgl.Map({
    container: "map", style, center: [SITE.lng, SITE.lat], zoom: M.zoom, pitch: innerWidth > 860 ? 35 : 0,
    attributionControl: false, projection: "mercator", antialias: innerWidth > 860
  });
  if (style === MAP_STYLE) map.on("style.load", () => {
    for (const [k, v] of Object.entries(BASEMAP)) { try { map.setConfigProperty("basemap", k, v); } catch (e) {} }
  });
  let told = false;
  map.on("error", (e) => {
    const st = e && e.error && e.error.status;
    if (told || (st !== 401 && st !== 403)) return;
    told = true;
    $("#map").insertAdjacentHTML("beforeend", `<div class="nomap warn">Mapbox did not accept the map key on this address, so the map cannot load here. Everything else on the page still works.</div>`);
  });
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("load", () => { addLayers(); wireMap(); if (booted && S.sel) select(S.sel, true, true); else frame(false); });
}
/* Every layer is added on its own, and every label reads its own copy of
   the data, so a glyph failure costs only the text, never the points. */
function add(layer, before) { try { map.addLayer(layer, before); } catch (e) { console.warn("layer", layer.id, e.message); } }
const focusOf = (p) => (S.sel === p.id || S.hov === p.id) ? 2 : !shownKind(p.kind) ? 0 : (S.sel || S.hov) ? .5 : 1;
const shownKind = (k) => !!S.layers[k];
function placesFC() {
  return { type: "FeatureCollection", features: PLACES.filter(p => p.kind !== "metro" && p.kind !== "mm").map(p => ({ type: "Feature",
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    properties: { id: p.id, kind: p.kind, name: p.kind === "comp" ? p.brand : p.name, full: p.name, color: KINDS[p.kind].color, foc: focusOf(p) } })) };
}
function linkFC() {
  return { type: "FeatureCollection", features: PLACES.filter(p => p.kind !== "mm").map(p => ({ type: "Feature",
    geometry: { type: "LineString", coordinates: [[SITE.lng, SITE.lat], [p.lng, p.lat]] }, properties: { id: p.id } })) };
}
function linkLabelFC() {
  return { type: "FeatureCollection", features: PLACES.filter(p => p.kind !== "mm").map(p => ({ type: "Feature",
    geometry: { type: "Point", coordinates: [(SITE.lng + p.lng) / 2, (SITE.lat + p.lat) / 2] }, properties: { id: p.id, label: `${fmtKm(p.d)} · about ${driveMin(p.d)} min` } })) };
}
function zonesFC() {
  return { type: "FeatureCollection", features: MM.map(z => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [z.ring] }, properties: { id: `mm-${z.key}`, color: z.color } })) };
}
const zoneLeadFC = () => ({ type: "FeatureCollection", features: MM.map(z => ({ type: "Feature", geometry: { type: "LineString", coordinates: [z.anchor, z.label] }, properties: { id: `mm-${z.key}` } })) });
const zoneNumFC = () => ({ type: "FeatureCollection", features: MM.map(z => ({ type: "Feature", geometry: { type: "Point", coordinates: z.anchor }, properties: { n: String(z.n), id: `mm-${z.key}` } })) });
const zoneNameFC = () => ({ type: "FeatureCollection", features: MM.map(z => ({ type: "Feature", geometry: { type: "Point", coordinates: z.label }, properties: { name: z.name, anchor: z.side === "left" ? "right" : "left", id: `mm-${z.key}` } })) });
/* Zones show when zoomed out and hand over to the places as you zoom in. */
const ZONE_FADE = (hi) => ["interpolate", ["linear"], ["zoom"], 10, hi, 11.8, hi, 12.8, hi * .2, 13.4, 0];
function addLayers() {
  map.addSource("mm", { type: "geojson", data: zonesFC() });
  add({ id: "mm-fill", type: "fill", source: "mm", paint: { "fill-color": ["get", "color"], "fill-opacity": ZONE_FADE(.5) } });
  add({ id: "mm-line", type: "line", source: "mm", paint: { "line-color": ["get", "color"], "line-width": 1.2, "line-opacity": ZONE_FADE(.9) } });
  map.addSource("mm-lead", { type: "geojson", data: zoneLeadFC() });
  add({ id: "mm-lead", type: "line", source: "mm-lead", maxzoom: 13.4, paint: { "line-color": "#6c5b4d", "line-width": 1.1, "line-opacity": ZONE_FADE(.85) } });

  /* Catchments next, so everything else sits on top. */
  map.addSource("catch", { type: "geojson", data: catchFC() });
  map.addSource("catch-lbl", { type: "geojson", data: catchLabelFC() });
  const IN = (v) => ["interpolate", ["linear"], ["zoom"], 11.6, 0, 12.6, v];
  add({ id: "catch-fill", type: "fill", source: "catch", paint: { "fill-color": ["get", "color"], "fill-opacity": IN(.07) } });
  add({ id: "catch-line", type: "line", source: "catch", paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": IN(.85) } });
  add({ id: "catch-label", type: "symbol", source: "catch-lbl", layout: { "text-field": ["get", "label"], "text-size": 11,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, -.6] }, paint: { "text-color": "#8a4424", "text-halo-color": "#fff", "text-halo-width": 1.4, "text-opacity": IN(1) } });

  /* Green and blue areas drawn as shapes where we have an outline. */
  const envPolys = D.environment.filter(e => e.polygon && e.polygon.length > 2);
  map.addSource("env-area", { type: "geojson", data: { type: "FeatureCollection", features: envPolys.map(e => ({ type: "Feature",
    geometry: { type: "Polygon", coordinates: [[...e.polygon, e.polygon[0]]] }, properties: { id: e.id, water: e.water ? 1 : 0 } })) } });
  add({ id: "env-fill", type: "fill", source: "env-area", paint: { "fill-color": ["case", ["==", ["get", "water"], 1], "#5aa7d6", "#5cae5c"], "fill-opacity": .35 } });
  add({ id: "env-line", type: "line", source: "env-area", paint: { "line-color": ["case", ["==", ["get", "water"], 1], "#2f7fb3", "#3d8b3d"], "line-width": 1.2 } });

  /* Purple Line. */
  const line = STN.slice().sort((a, b) => a.seq - b.seq);
  map.addSource("metro-line", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: line.map(s => [s.lng, s.lat]) }, properties: {} } });
  add({ id: "metro-casing", type: "line", source: "metro-line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#3c1a52", "line-width": 6.5, "line-opacity": .3 } });
  add({ id: "metro-line", type: "line", source: "metro-line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8e44ad", "line-width": 4.2 } });
  const stnData = { type: "FeatureCollection", features: STN.map(s => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] },
    properties: { id: `stn-${s.id}`, name: s.name, foc: 1 } })) };
  map.addSource("stations", { type: "geojson", data: stnData });
  add({ id: "stations", type: "circle", source: "stations", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6.5],
    "circle-color": "#fff", "circle-stroke-color": "#5b2a7a", "circle-stroke-width": 2 } });
  map.addSource("stations-lbl", { type: "geojson", data: stnData });
  add({ id: "stations-label", type: "symbol", source: "stations-lbl", minzoom: 11.6, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true, "text-max-width": 8 },
    paint: { "text-color": "#5b2a7a", "text-halo-color": "#fff", "text-halo-width": 1.3 } });

  /* Dashed link from the site to whichever place is open. One feature per
     place, loaded once; a filter shows the one that is open. */
  map.addSource("link", { type: "geojson", data: linkFC() });
  add({ id: "link", type: "line", source: "link", filter: ["==", ["get", "id"], ""], layout: { "line-cap": "round" },
    paint: { "line-color": "#2a1e16", "line-width": 2, "line-dasharray": [1.4, 1.4], "line-opacity": .75 } });

  /* Directions out of the site. */
  map.addSource("arrows", { type: "geojson", data: arrowsFC() });
  add({ id: "arrows", type: "line", source: "arrows", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#2a1e16", "line-width": 1.6, "line-opacity": .8 } });

  /* Places. */
  map.addSource("places", { type: "geojson", data: placesFC() });
  const foc = ["get", "foc"];
  add({ id: "places-halo", type: "circle", source: "places", filter: ["==", foc, 2], minzoom: 11.2, paint: { "circle-radius": 18, "circle-color": ["get", "color"], "circle-opacity": .18,
    "circle-stroke-color": ["get", "color"], "circle-stroke-width": 1.6 } });
  add({ id: "places", type: "circle", source: "places", filter: [">", foc, 0], minzoom: 11.2, paint: {
    "circle-radius": ["case", ["==", foc, 2], 9, ["==", ["get", "kind"], "res"], 8, ["==", ["get", "kind"], "env"], 6.5, 6],
    "circle-color": ["get", "color"],
    "circle-opacity": ["case", ["==", ["get", "kind"], "res"], .3, ["==", foc, .5], .45, .95],
    "circle-stroke-color": ["case", ["==", ["get", "kind"], "res"], ["get", "color"], "#fff"], "circle-stroke-width": 1.5,
    "circle-stroke-opacity": ["case", ["==", foc, .5], .5, 1] } });
  map.addSource("places-lbl", { type: "geojson", data: placesFC() });
  add({ id: "places-label", type: "symbol", source: "places-lbl", filter: [">", foc, 0], minzoom: 12.4, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, .95], "text-anchor": "top", "text-optional": true, "text-max-width": 9 },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 1.4, "text-opacity": ["case", ["==", foc, .5], .5, 1] } });

  /* The site: a large ringed pin that never reads as one of the places. */
  const siteData = { type: "Feature", geometry: { type: "Point", coordinates: [SITE.lng, SITE.lat] }, properties: {} };
  map.addSource("site", { type: "geojson", data: siteData });
  add({ id: "site-halo", type: "circle", source: "site", paint: { "circle-radius": 26, "circle-color": "#a3502c", "circle-opacity": .14, "circle-stroke-color": "#a3502c", "circle-stroke-width": 1.5, "circle-stroke-opacity": .6 } });
  add({ id: "site-pin", type: "circle", source: "site", paint: { "circle-radius": 13, "circle-color": "#2a1e16", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
  add({ id: "site-dot", type: "circle", source: "site", paint: { "circle-radius": 5, "circle-color": "#e8a37a" } });

  /* Labels last. */
  map.addSource("arrows-lbl", { type: "geojson", data: arrowLabelFC() });
  add({ id: "arrows-label", type: "symbol", source: "arrows-lbl", layout: { "text-field": ["get", "label"], "text-size": 11.5, "text-line-height": 1.25,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-anchor": ["get", "anchor"], "text-allow-overlap": true, "text-max-width": 16 },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2 } });
  map.addSource("link-lbl", { type: "geojson", data: linkLabelFC() });
  add({ id: "link-label", type: "symbol", source: "link-lbl", filter: ["==", ["get", "id"], ""], layout: { "text-field": ["get", "label"], "text-size": 11.5,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  map.addSource("site-lbl", { type: "geojson", data: siteData });
  add({ id: "site-label", type: "symbol", source: "site-lbl", layout: { "text-field": `${SITE.name}\n${SITE.byline}`, "text-size": 13, "text-line-height": 1.2,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-offset": [0, 1.7], "text-anchor": "top", "text-allow-overlap": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.4 } });
  map.addSource("mm-num", { type: "geojson", data: zoneNumFC() });
  add({ id: "mm-num", type: "symbol", source: "mm-num", maxzoom: 13.4, layout: { "text-field": ["get", "n"], "text-size": 17, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true },
    paint: { "text-color": "#fff", "text-halo-color": "rgba(42,30,22,.35)", "text-halo-width": 1.2, "text-opacity": ZONE_FADE(1) } });
  map.addSource("mm-name", { type: "geojson", data: zoneNameFC() });
  add({ id: "mm-name", type: "symbol", source: "mm-name", maxzoom: 13.4, layout: { "text-field": ["get", "name"], "text-size": 15, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    "text-anchor": ["get", "anchor"], "text-offset": [0, 0], "text-allow-overlap": true, "text-padding": 0 },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2, "text-opacity": ZONE_FADE(1) } });
  applyLayerVisibility();
}
const LAYERS = [
  { key: "mm", label: "Micro-markets", sw: `<span class="dot" style="background:linear-gradient(135deg,#e34948 50%,#eb6834 50%)"></span>`, ids: ["mm-fill", "mm-line", "mm-lead", "mm-num", "mm-name"] },
  { key: "comp", ids: [] }, { key: "metro", ids: ["metro-casing", "metro-line", "stations", "stations-label"] },
  { key: "social", ids: [] }, { key: "talent", ids: [] }, { key: "res", ids: [] }, { key: "edu", ids: [] },
  { key: "deal", ids: [] }, { key: "env", ids: ["env-fill", "env-line"] },
  { key: "catch", label: "Drive-time catchment", sw: `<span class="dot" style="background:rgba(163,80,44,.12);border:1.5px solid #a3502c"></span>`, ids: ["catch-fill", "catch-line", "catch-label"] },
  { key: "arrows", label: "Directions", sw: `<span class="sw" style="height:2px;background:#2a1e16"></span>`, ids: ["arrows", "arrows-label"] }
];
const LAYER_HINT = {
  mm: "Office micro-markets (CBD, ORR, Whitefield and others), shown when you zoom out.",
  comp: "Flex operators already trading around the site: WeWork, Awfis, IndiQube and the rest.",
  metro: "The Purple Line from Whitefield (Kadugodi) to KR Puram.",
  social: "Hospitals: Manipal, Aster, Sri Sathya Sai and Cloudnine.",
  talent: "Tech parks and big employers: where the talent already works.",
  res: "Residential belts where staff are likely to live.",
  edu: "Colleges that feed graduates into the area.",
  deal: "Office and flex leasing deals from 2024 to 2026.",
  env: "Lakes and parks: Hoodi Lake and Kadugodi Tree Park.",
  catch: "10, 20 and 30 minute drive-time areas around the site.",
  arrows: "The three road directions out of the site, with distances."
};
function applyLayerVisibility() {
  if (!map || !map.getLayer("places")) return;
  for (const l of LAYERS) for (const id of l.ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", S.layers[l.key] ? "visible" : "none");
  refreshPins();
}
function refreshPins() {
  if (!map || !map.getSource("places")) return;
  const fc = placesFC();
  map.getSource("places").setData(fc); map.getSource("places-lbl").setData(fc);
  const id = S.sel || S.hov || "";
  if (map.getLayer("mm-line")) map.setPaintProperty("mm-line", "line-width", ["case", ["==", ["get", "id"], id], 3, 1.2]);
  for (const l of ["link", "link-label"]) if (map.getLayer(l)) map.setFilter(l, ["==", ["get", "id"], id]);
  if (map.getLayer("stations")) {
    const st = id.startsWith("stn-") ? id : "";
    const on = ["==", ["get", "id"], st];
    map.setPaintProperty("stations", "circle-radius", ["interpolate", ["linear"], ["zoom"], 10, ["case", on, 7, 3], 14, ["case", on, 10, 6.5]]);
    map.setPaintProperty("stations", "circle-color", ["case", on, "#8e44ad", "#fff"]);
  }
}
const refreshMap = () => applyLayerVisibility();
function wireMap() {
  const pop = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
  const hover = (layer, html) => {
    map.on("mousemove", layer, e => { map.getCanvas().style.cursor = "pointer"; const f = e.features[0]; pop.setLngLat(f.geometry.type === "Point" ? f.geometry.coordinates : e.lngLat).setHTML(html(f.properties)).addTo(map); });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; pop.remove(); });
  };
  const tip = (p) => `<b>${esc(p.name)}</b>${p.sub ? `<br>${esc(p.sub)}` : ""}<br><span style="color:#6c5b4d">${esc(KINDS[p.kind].label)} · ${fmtKm(p.d)} from ${esc(SITE.name)}</span>`;
  hover("places", f => tip(byId(f.id)));
  hover("stations", f => tip(byId(f.id)));
  hover("site-pin", () => `<b>${esc(SITE.name)}</b><br>${esc(SITE.byline)}<br><span style="color:#6c5b4d">${esc(SITE.address || "")}</span>`);
  for (const l of ["places", "stations"]) {
    map.on("click", l, e => select(e.features[0].properties.id, true));
    map.on("mousemove", l, e => { const id = e.features[0].properties.id; if (id !== S.sel && S.hov !== id) { S.hov = id; refreshPins(); } });
    map.on("mouseleave", l, () => { if (S.hov) { S.hov = null; refreshPins(); } });
  }
  map.on("click", "site-pin", () => { S.sel = null; goTab("overview"); });
  hover("mm-fill", f => { const z = byId(f.id); return `<b>${z.n} · ${esc(z.name)}</b><br>${esc(z.full)}<br><span style="color:#6c5b4d">${z.d === 0 ? `${esc(SITE.name)} is inside this market` : `${fmtKm(z.d)} from ${esc(SITE.name)} to its edge`}</span>`; });
  map.on("click", "mm-fill", e => { if (map.getZoom() < 13) select(e.features[0].properties.id, true); });
}
function padding() {
  const Wd = innerWidth, Hd = innerHeight;
  let pad;
  if (Wd <= 860) {
    const sh = document.getElementById("panel").getBoundingClientRect();
    pad = sh.left > Wd * .3
      ? { top: 70, bottom: 90, left: 20, right: Wd - sh.left + 20 }
      : { top: 110, bottom: Math.max(60, Hd - sh.top + 60), left: 24, right: 24 };
  } else {
    const b = document.getElementById("board").getBoundingClientRect(), p = document.getElementById("panel").getBoundingClientRect();
    const l = document.getElementById("layers").getBoundingClientRect();
    const bw = document.body.classList.contains("fold-board") ? 0 : b.right, pw = document.body.classList.contains("fold-panel") ? Wd : p.left;
    pad = { top: 100, bottom: Hd - l.top + 24, left: Math.max(30, bw + 30), right: Math.max(30, Wd - pw + 30) };
  }
  const squeeze = (a, c, room) => { const k = Math.min(1, room / (pad[a] + pad[c])); pad[a] *= k; pad[c] *= k; };
  squeeze("top", "bottom", Hd - 80); squeeze("left", "right", Wd - 80);
  return pad;
}
/* The default frame: the 20 minute catchment around the site. */
function fitAll(animate = true) {
  if (!map) return;
  const b = new mapboxgl.LngLatBounds();
  circle([SITE.lng, SITE.lat], ringKm(20), 24).forEach(pt => b.extend(pt));
  map.fitBounds(b, { padding: padding(), maxZoom: 14, pitch: innerWidth > 860 ? 30 : 0, bearing: 0, duration: animate && !REDUCED() ? 1100 : 0 });
}
/* Frame whatever the current view is about. */
function frame(animate = true) {
  if (S.sel) select(S.sel, true, true);
  else if (S.tab === "markets") fitMarkets(animate);
  else fitAll(animate);
}
/* The city view: every micro-market and the site. */
function fitMarkets(animate = true) {
  if (!map || !MM.length) return;
  const b = new mapboxgl.LngLatBounds([SITE.lng, SITE.lat], [SITE.lng, SITE.lat]);
  /* Leave room beyond each callout for its name, which runs outward. */
  MM.forEach(z => { z.ring.forEach(c => b.extend(c)); b.extend([z.label[0] + (z.side === "left" ? -.05 : .05), z.label[1]]); });
  map.fitBounds(b, { padding: padding(), maxZoom: 12, pitch: 0, bearing: 0, duration: animate && !REDUCED() ? 1200 : 0 });
}
/* Opening a place frames it together with the site, so the distance
   between them is always in view. */
function flyToPlace(p) {
  if (!map || !p) return;
  if (p.kind === "mm") {
    const b = new mapboxgl.LngLatBounds([SITE.lng, SITE.lat], [SITE.lng, SITE.lat]); p.ring.forEach(c => b.extend(c));
    map.fitBounds(b, { padding: padding(), maxZoom: 12.4, pitch: 0, duration: REDUCED() ? 0 : 1300 }); return;
  }
  const b = new mapboxgl.LngLatBounds([SITE.lng, SITE.lat], [SITE.lng, SITE.lat]).extend([p.lng, p.lat]);
  const pad = padding(), close = p.d < .6;
  map.fitBounds(b, { padding: pad, maxZoom: close ? 16.2 : 15.2, pitch: innerWidth > 860 ? 40 : 0, duration: REDUCED() ? 0 : 1500 });
}

/* ------------------------------------------------------------ routes ---- */
function routeHash() { return S.sel ? `#/place/${S.sel}` : S.tab === "overview" ? "#/" : `#/${S.tab}`; }
function pushRoute() { const h = routeHash(); if (location.hash !== h && !(h === "#/" && !location.hash)) history.pushState(null, "", h); }
function applyRoute(render) {
  const [kind, val] = location.hash.replace(/^#\/?/, "").split("/");
  S.sel = null;
  if (kind === "place" && byId(val)) { S.sel = val; S.tab = KINDS[byId(val).kind].tab; }
  else if (TABS.some(t => t.key === kind)) S.tab = kind;
  else S.tab = "overview";
  if (render) { renderTabs(); renderFilters(); renderList(); renderPanel(); refreshMap(); frame(); }
}
async function copyLink(btn) {
  const url = location.href.split("#")[0] + routeHash();
  try { await navigator.clipboard.writeText(url); btn.textContent = "Link copied"; }
  catch (e) { window.prompt("Copy this link", url); }
  setTimeout(() => { btn.textContent = "Copy link"; }, 1800);
}

/* ============================================================ board ===== */
const listKinds = () => S.kindFilter ? [S.kindFilter] : tabOf(S.tab).kinds;
function renderFilters() {
  const kinds = tabOf(S.tab).kinds;
  if (S.kindFilter && !kinds.includes(S.kindFilter)) S.kindFilter = null;
  $("#filters").innerHTML = kinds.length < 2 ? "" : kinds.map(k => `<button class="chip ${S.kindFilter === k ? "on" : ""}" data-k="${k}" type="button" aria-pressed="${S.kindFilter === k}" data-hint="${esc(`List only ${KINDS[k].short.toLowerCase()}. Click again to list everything in this section.`)}"><span class="dot" style="background:${KINDS[k].color}"></span>${esc(KINDS[k].short)}</button>`).join("");
}
function listed() {
  const q = S.q.trim().toLowerCase();
  const rows = PLACES.filter(p => listKinds().includes(p.kind) && (!q || [p.name, p.sub, p.brand, p.locality, p.tenant].some(v => v && String(v).toLowerCase().includes(q))));
  return rows.sort(S.sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.d - b.d);
}
const ICON = (p) => p.kind === "mm" ? String(p.n) : p.kind === "comp" ? (p.brand || "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map(w => w[0]).join("").slice(0, 3).toUpperCase()
  : { metro: "M", social: "+", talent: "TP", res: "H", edu: "C", deal: "₹", env: "G" }[p.kind];
function cardFacts(p) {
  if (p.kind === "mm") return p.d === 0 ? `<span><b>${esc(SITE.name)} is here</b></span>` : `<span class="num">${fmtKm(p.d)} to its edge</span><span>about ${driveMin(p.d)} min drive</span>`;
  const f = [`<span class="num">${fmtKm(p.d)}</span>`, `<span>about ${driveMin(p.d)} min drive</span>`];
  if (p.d <= 2.5) f.push(`<span>${walkMin(p.d)} min walk</span>`);
  if (p.kind === "deal") { if (p.date) f.push(`<span>${esc(p.date)}</span>`); if (p.sqft) f.push(`<span class="num">${inr(p.sqft)} SF</span>`); else if (p.seats) f.push(`<span class="num">${inr(p.seats)} seats</span>`); }
  if (p.kind === "talent" && p.msf) f.push(`<span>${p.msf} msf</span>`);
  if (p.kind === "comp" && p.seats) f.push(`<span class="num">${inr(p.seats)} seats</span>`);
  if (p.status && p.status !== "operating") f.push(`<span class="fit no">${p.status === "pipeline" ? "pipeline" : "check status"}</span>`);
  return f.join("");
}
function renderList() {
  const rows = listed();
  $("#b-count").textContent = `${rows.length} ${rows.length === 1 ? "place" : "places"}`;
  $("#b-area").textContent = S.kindFilter ? KINDS[S.kindFilter].short : tabOf(S.tab).label;
  $("#list").innerHTML = rows.map(p => `<button class="card pl ${S.sel === p.id ? "sel" : ""}" data-id="${p.id}" role="listitem" type="button" data-hint="${esc(`Open ${p.name}: the map frames it with the site and the panel shows the distance and details.`)}">
      <span class="ico" style="background:${p.kind === "mm" ? p.color : KINDS[p.kind].color}">${esc(ICON(p))}</span>
      <div>
        <div class="nm">${esc(p.kind === "deal" ? (p.tenant || p.name) : p.name)}</div>
        <div class="loc">${esc(p.kind === "deal" ? [p.building, p.locality].filter(Boolean).join(" · ") : p.sub || p.locality || KINDS[p.kind].label)}</div>
        <div class="facts">${cardFacts(p)}</div>
      </div>
    </button>`).join("") || `<p class="note" style="padding:12px">Nothing matches.</p>`;
}
function wireBoard() {
  $("#filters").addEventListener("click", e => {
    const b = e.target.closest("[data-k]"); if (!b) return;
    S.kindFilter = S.kindFilter === b.dataset.k ? null : b.dataset.k; renderFilters(); renderList();
  });
  $("#sort").addEventListener("change", e => { S.sort = e.target.value; renderList(); });
  $("#t-q").addEventListener("input", e => { S.q = e.target.value; renderList(); });
  $("#list").addEventListener("click", e => { const c = e.target.closest("[data-id]"); if (c) select(c.dataset.id, true); });
  const hov = (id) => { if (S.hov === id) return; S.hov = id; refreshPins(); };
  $("#list").addEventListener("mouseover", e => { const c = e.target.closest("[data-id]"); if (c && c.dataset.id !== S.sel) hov(c.dataset.id); });
  $("#list").addEventListener("mouseleave", () => hov(null));
  $("#tabs").addEventListener("click", e => { const t = e.target.closest("[data-t]"); if (t) goTab(t.dataset.t); });
  $("#layers").addEventListener("click", e => {
    const b = e.target.closest("[data-l]"); if (!b) return;
    S.layers[b.dataset.l] = !S.layers[b.dataset.l]; renderLayers(); applyLayerVisibility();
  });
  $("#p-body").addEventListener("click", e => {
    const ix = e.target.closest("[data-intro-x]"); if (ix) { seenIntro.add(ix.dataset.introX); saveIntro(); ix.closest(".intro").outerHTML = introCard(ix.dataset.introX); return; }
    const io = e.target.closest("[data-intro-open]"); if (io) { seenIntro.delete(io.dataset.introOpen); saveIntro(); io.outerHTML = introCard(io.dataset.introOpen); return; }
    const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); select(a.dataset.go, true); return; }
    const t = e.target.closest("[data-tab]"); if (t) { e.preventDefault(); goTab(t.dataset.tab); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { copyLink(cp); return; }
    if (e.target.closest("[data-print]")) { window.print(); return; }
    const img = e.target.closest(".hero img"); if (img) { const lb = $("#lightbox"); lb.querySelector("img").src = img.currentSrc || img.src; lb.classList.add("on"); }
  });
  $("#p-head").addEventListener("click", e => {
    if (e.target.closest(".back")) { S.sel = null; renderList(); renderPanel(); refreshMap(); fitAll(); pushRoute(); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { copyLink(cp); return; }
    if (e.target.closest("[data-print]")) window.print();
  });
  $("#lightbox").addEventListener("click", () => $("#lightbox").classList.remove("on"));
  addEventListener("keydown", e => { if (e.key === "Escape") $("#lightbox").classList.remove("on"); });
}
function select(id, fly, fromRoute) {
  const p = byId(id); if (!p) return;
  if (document.body.classList.contains("fold-panel")) setFold("panel", false);
  S.sel = id; S.hov = null;
  if (!tabOf(S.tab).kinds.includes(p.kind)) { S.tab = KINDS[p.kind].tab; renderFilters(); }
  renderList(); renderPanel(); refreshMap();
  if (!fromRoute) pushRoute();
  if (innerWidth <= 860 && !fromRoute) setSheet("half");
  const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`); if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (fly) flyToPlace(p);
  $("#p-body").scrollTop = 0;
}
function goTab(key) {
  if (document.body.classList.contains("fold-panel")) setFold("panel", false);
  const had = S.sel; S.tab = key; S.sel = null; S.kindFilter = null;
  renderTabs(); renderFilters(); renderList(); renderPanel(); refreshMap();
  if (key === "markets") fitMarkets(); else if (had || S.zoomedOut) fitAll();
  S.zoomedOut = key === "markets"; pushRoute();
  if (innerWidth <= 860) setSheet("half");
}
function renderTabs() {
  $("#tabs").innerHTML = TABS.map(t => `<button class="tab ${S.tab === t.key && !S.sel ? "on" : ""}" data-t="${t.key}" type="button" data-hint="${esc(GUIDE[t.key].hint)}">${esc(t.label)}</button>`).join("");
}
function renderLayers() {
  $("#layers").innerHTML = `<span class="key"><span class="pin" style="background:#2a1e16;box-shadow:inset 0 0 0 3px #e8a37a"></span>${esc(SITE.name)}</span>` +
    LAYERS.map(l => {
      const k = KINDS[l.key], label = l.label || k.short, sw = l.sw || `<span class="dot" style="background:${k.color}"></span>`;
      return `<button class="chip lay ${S.layers[l.key] ? "on" : ""}" data-l="${l.key}" type="button" aria-pressed="${S.layers[l.key]}" data-hint="${esc((S.layers[l.key] ? "Hide: " : "Show: ") + LAYER_HINT[l.key])}">${sw}${esc(label)}</button>`;
    }).join("") + `<span class="key note" title="Positions vary in precision; each place says how it was placed">ⓘ approx.</span>`;
}

/* ============================================================ guide ===== */
const GUIDE = {
  overview: { hint: "The short answer: the site, its catchment and the headline numbers for every layer.",
    items: ["Headline numbers for each layer of the brief, measured from the site.",
      "The catchment table counts what sits inside 10, 20 and 30 minutes by car.",
      "The three road directions out of the site, as drawn by the arrows on the map.",
      "Every place is in the list on the left, nearest first. Click one to see it against the site."] },
  markets: { hint: "Bangalore's office micro-markets around Whitefield, as a zoomed-out map.",
    items: ["The map zooms out to show each office micro-market as a numbered area with its name, the way broker market maps do.",
      "The table gives each market's main areas and how far its edge is from the site.",
      "Click a market to frame it with the site and see what this atlas maps inside it."] },
  competition: { hint: "Layer 1: the flex operators already trading around the site.",
    items: ["All fifteen brands in the brief, with how many centres each has nearby and how far the closest one is.",
      "Brands with nothing nearby are listed too, so the gaps are visible.",
      "Click a centre to frame it with the site."] },
  connectivity: { hint: "Layer 2: the Purple Line from Whitefield (Kadugodi) to KR Puram, and the roads out.",
    items: ["Every station from Whitefield (Kadugodi) to KR Puram, with the distance and time from the site.",
      "The three road directions in the brief, with distances.",
      "Turn on Drive-time catchment in the map bar to see how far 10, 20 and 30 minutes reach."] },
  talent: { hint: "Where the talent works and lives: tech parks, employers, homes and colleges.",
    items: ["Tech parks and big employers around the site, with their size and best-known occupiers.",
      "Residential belts and colleges, which you can turn on as Homes and Colleges in the map bar.",
      "How much of it sits inside each drive-time catchment."] },
  deals: { hint: "Recent office and flex leasing deals around Whitefield, 2024 to 2026.",
    items: ["Each deal with the tenant, building, size, date and source.",
      "Flex operator deals are marked separately from corporate leases.",
      "Market facts with sources and dates at the end."] },
  social: { hint: "Layers 3 and 5: hospitals, lakes and parks.",
    items: ["Manipal, Aster, Sri Sathya Sai and Cloudnine, with distance and drive time from the site.",
      "Hoodi Lake and Kadugodi Tree Park, the green and blue spaces nearby."] },
  place: { items: ["The map frames the place together with the site, with a dashed line and the distance between them.",
      "Below: what it is, how far it is by road and on foot, the nearest Purple Line station to it, and the source.",
      "Back returns to the section you came from."] }
};
let seenIntro = new Set();
try { seenIntro = new Set(JSON.parse(localStorage.getItem("wf-intro") || "[]")); } catch (e) {}
const saveIntro = () => { try { localStorage.setItem("wf-intro", JSON.stringify([...seenIntro])); } catch (e) {} };
function introCard(key) {
  const g = GUIDE[key]; if (!g || !g.items) return "";
  if (seenIntro.has(key)) return `<button type="button" class="intro-min" data-intro-open="${key}">ⓘ What's in this view</button>`;
  return `<div class="intro" data-intro="${key}"><div class="ih"><b>What to expect</b><button type="button" class="ix" data-intro-x="${key}">Got it</button></div>
    <ul>${g.items.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
}
function wireHints() {
  const tip = document.createElement("div"); tip.id = "hint"; tip.setAttribute("role", "tooltip"); tip.hidden = true; document.body.appendChild(tip);
  let timer = null, cur = null;
  const hide = () => { clearTimeout(timer); timer = null; cur = null; tip.hidden = true; };
  const show = (el) => {
    const r = el.getBoundingClientRect();
    tip.textContent = el.dataset.hint; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 8), innerWidth - w - 8);
    let top = r.bottom + 8; if (top + h > innerHeight - 8) top = r.top - h - 8;
    tip.style.left = left + "px"; tip.style.top = top + "px";
  };
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  document.addEventListener("pointerover", e => {
    if (!fine.matches || (e.pointerType && e.pointerType !== "mouse")) return;
    const el = e.target.closest("[data-hint]");
    if (el === cur) return;
    hide(); if (!el) return;
    cur = el; timer = setTimeout(() => show(el), 380);
  });
  document.addEventListener("focusin", e => { const el = e.target.closest("[data-hint]"); if (el && el.matches(":focus-visible")) { cur = el; show(el); } });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", hide);
  addEventListener("scroll", hide, true);
}

/* ============================================================ panel ===== */
function renderPanel() {
  renderTabs();
  if (S.sel) renderPlace(byId(S.sel));
  else ({ overview: renderOverview, markets: renderMarkets, competition: renderCompetition, connectivity: renderConnectivity, talent: renderTalent, deals: renderDeals, social: renderSocial }[S.tab] || renderOverview)();
  $("#p-body").insertAdjacentHTML("afterbegin", introCard(S.sel ? "place" : S.tab));
}
const head = (eyebrow, title, lede) => { $("#p-head").innerHTML = `<div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${lede ? `<div class="lede">${lede}</div>` : ""}${actions()}`; };
const actions = () => `<div class="actions"><button type="button" class="act" data-copy data-hint="Copies a link that opens exactly this view.">Copy link</button><button type="button" class="act" data-print data-hint="Prints this view, or saves it as a PDF from the print dialog.">Print / PDF</button></div>`;
const link = (p, label) => `<a href="#" data-go="${esc(p.id)}">${esc(label || p.name)}</a>`;
const conf = (c) => c ? `<span class="conf ${esc(c)}">${esc(c)}</span>` : "";
const factList = (arr) => `<ul class="facts">${arr.map(f => `<li class="fact"><span class="k">${esc(f.k)}.</span> ${esc(f.v)}${conf(f.confidence || f.conf)}
  <div class="meta">${esc(f.asOf || "")}${f.note ? " · " + esc(f.note) : ""}${f.src ? " · " + cite(f.src) : ""}</div></li>`).join("")}</ul>`;
const method = () => ISO ? METHOD_ISO : METHOD_RINGS;
const distCell = (p) => `${fmtKm(p.d)} <span class="note">· about ${driveMin(p.d)} min${p.d <= 2.5 ? ` · ${walkMin(p.d)} min walk` : ""}</span>`;

/* ---------- Overview ---------- */
function renderOverview() {
  head(`Prepared for Total Environment · ${esc(M.asOfLabel)}`, esc(SITE.name), esc(SITE.lede));
  const comp = PLACES.filter(p => p.kind === "comp"), nm = nearest("metro");
  const c3 = comp.filter(p => p.d <= 3).length, c5 = comp.filter(p => p.d <= 5).length;
  const brandsNear = new Set(comp.filter(p => p.d <= 10).map(p => p.brand));
  const tp = PLACES.filter(p => p.kind === "talent" && p.group === "park"), tp5 = tp.filter(p => p.d <= 5);
  const msf5 = tp5.reduce((s, p) => s + (+p.msf || 0), 0);
  const deals = PLACES.filter(p => p.kind === "deal");
  const hosp = PLACES.filter(p => p.kind === "social"), h5 = hosp.filter(p => p.d <= 5);
  const env = PLACES.filter(p => p.kind === "env");
  const cell = (k, m) => `<td class="num">${within(k, m).length}</td>`;
  const kinds = ["comp", "talent", "res", "edu", "deal", "social", "metro"];
  const site = [["Developer", SITE.developer], ["What it is", SITE.type], ["Address", SITE.address], ["Size", SITE.size], ["Status", SITE.status]].filter(r => r[1]);
  $("#p-body").innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="l">Flex centres ≤ 3 km</div><div class="v">${c3}</div><div class="s">${c5} within 5 km</div></div>
      <div class="kpi"><div class="l">Brands ≤ 10 km</div><div class="v">${brandsNear.size}<span style="font-size:13px;color:var(--mut)">/${D.competition.length}</span></div><div class="s">of the brief's list</div></div>
      <div class="kpi"><div class="l">Nearest metro</div><div class="v">${nm ? fmtKm(nm.d) : "n/a"}</div><div class="s">${nm ? `${esc(nm.p.name)} · ${walkMin(nm.d)} min walk` : ""}</div></div>
      <div class="kpi"><div class="l">Tech parks ≤ 5 km</div><div class="v">${tp5.length}</div><div class="s">${msf5 ? `about ${msf5.toFixed(1)} msf where sized` : "size n/a"}</div></div>
      <div class="kpi"><div class="l">Recent deals</div><div class="v">${deals.length}</div><div class="s">${deals.filter(p => p.d <= 5).length} within 5 km</div></div>
      <div class="kpi"><div class="l">Hospitals ≤ 5 km</div><div class="v">${h5.length}</div><div class="s">${env.length} lakes and parks mapped</div></div>
    </div>

    <h3>Insights</h3>
    ${insightsHTML()}

    <h3>The site</h3>
    <table class="spec">${site.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")}
      <tr><th>Position</th><td>${esc(SITE.precisionNote)} ${SITE.src ? cite(SITE.src, "source") : ""}</td></tr></table>
    ${SITE.notes ? `<p class="note">${esc(SITE.notes)}</p>` : ""}
    ${SITE.photo ? `<div class="hero"><img src="${esc(SITE.photo)}" alt="${esc(SITE.photoCaption || SITE.name)}" loading="lazy"><span class="ph">${esc(SITE.photoCaption || "")}</span></div>` : ""}

    <h3>Catchment</h3>
    <table class="ring-tbl"><thead><tr><th>Drive time</th>${kinds.map(k => `<th>${esc(KINDS[k].short)}</th>`).join("")}</tr></thead>
      <tbody>${CATCH.map(m => `<tr><td>≤ ${m} min${ISO ? "" : ` <span class="note">(${ringKm(m).toFixed(1)} km)</span>`}</td>${kinds.map(k => cell(k, m)).join("")}</tr>`).join("")}</tbody></table>
    <p class="note">${esc(method())}</p>

    <h3>Directions out of the site</h3>
    ${directionsTable()}

    <h3>Market at a glance</h3>
    ${factList(D.market.slice(0, 6))}
    <p class="note">Every place on the map carries its source and how precisely it is placed. Open any of them from the list.</p>`;
}
/* The few facts a client asks first, each one tap from its place. */
function insightsHTML() {
  const nearKind = (k, f = () => true) => PLACES.filter(p => p.kind === k && f(p)).sort((a, b) => a.d - b.d)[0];
  const comp = nearKind("comp"), stn = nearest("metro"), hosp = nearKind("social"), env = nearKind("env");
  const park = PLACES.filter(p => p.kind === "talent" && p.group === "park" && p.d <= 5 && p.msf).sort((a, b) => b.msf - a.msf)[0];
  const deal = PLACES.filter(p => p.kind === "deal" && p.d <= 5 && p.sqft && p.id !== "d-clayworks-rhapsody").sort((a, b) => b.sqft - a.sqft)[0];
  const cards = [
    comp && { l: "Nearest flex centre", v: fmtKm(comp.d), s: `${comp.brand}, ${comp.name}`, go: comp.id, tone: "lead" },
    stn && { l: "Nearest metro", v: fmtKm(stn.d), s: `${stn.p.name}, ${walkMin(stn.d)} min walk`, go: stn.p.id },
    park && { l: "Biggest park ≤ 5 km", v: `${park.msf} msf`, s: `${park.name}, ${fmtKm(park.d)}`, go: park.id },
    deal && { l: "Biggest deal ≤ 5 km", v: `${inr(deal.sqft)} SF`, s: `${deal.tenant}, ${deal.date || ""}`, go: deal.id },
    hosp && { l: "Nearest hospital", v: fmtKm(hosp.d), s: hosp.name, go: hosp.id },
    env && { l: "Nearest green / blue", v: fmtKm(env.d), s: env.name, go: env.id }
  ].filter(Boolean);
  return `<div class="ins" role="list">${cards.map(c => `<button type="button" role="listitem" class="in ${c.tone || ""}" data-go="${esc(c.go)}" data-hint="Open this place: the map frames it with the site.">
    <span class="l">${esc(c.l)}</span><span class="v">${esc(c.v)}</span><span class="s">${esc(c.s)}</span></button>`).join("")}</div>`;
}
function directionsTable() {
  return `<table class="spec">${D.arrows.map(a => { const d = km(SITE, a), b = bearing(SITE, a);
    return `<tr><th>${b > 180 ? "← " : ""}${esc(a.label)}${b > 180 ? "" : " →"}</th><td>${fmtKm(d)} straight line · about ${driveMin(d)} min by road${a.note ? `<br><span class="note">${esc(a.note)}</span>` : ""}</td></tr>`; }).join("")}</table>`;
}

/* ---------- Competition ---------- */
function renderCompetition() {
  head("Layer 1 · Competition", "Flex operators around the site", "Every brand in the brief, how many centres it runs nearby and how close the nearest one is.");
  const rows = D.competition.map(b => {
    const cs = PLACES.filter(p => p.kind === "comp" && p.brand === b.brand).sort((x, y) => x.d - y.d);
    return { b, cs, n: cs[0] };
  }).sort((x, y) => (x.n ? x.n.d : 999) - (y.n ? y.n.d : 999));
  const present = rows.filter(r => r.cs.length), absent = rows.filter(r => !r.cs.length);
  const all = PLACES.filter(p => p.kind === "comp");
  const band = (a, b) => all.filter(p => p.d > a && p.d <= b).length;
  $("#p-body").innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="l">Centres mapped</div><div class="v">${all.length}</div><div class="s">${present.length} brands · ${all.filter(p => p.status === "pipeline").length} in the pipeline</div></div>
      <div class="kpi"><div class="l">Within 2 km</div><div class="v">${band(0, 2)}</div><div class="s">walk or a short ride</div></div>
      <div class="kpi"><div class="l">2 to 5 km</div><div class="v">${band(2, 5)}</div><div class="s">${band(5, 99)} further out</div></div>
    </div>
    ${(() => { const cw = byId("d-clayworks-rhapsody"); return cw ? `<p class="vsx"><b>Already on the site:</b> ${link(cw, "ClayWorks Rhapsody")} took ${inr(cw.sqft)}+ sq ft (${inr(cw.seats)}+ seats) in the Workcations tower in Sep 2025. ClayWorks is not on the brief's list of fifteen, so it is shown under Recent deals.</p>` : ""; })()}
    <h3>By brand, nearest first</h3>
    <table class="ring-tbl"><thead><tr><th>Brand</th><th>Centres</th><th>Nearest</th><th>Distance</th><th>≤ 5 km</th></tr></thead>
    <tbody>${present.map(r => `<tr><td><b>${esc(r.b.brand)}</b></td><td class="num">${r.cs.length}</td><td>${link(r.n, r.n.name)}</td><td class="num">${fmtKm(r.n.d)}</td><td class="num">${r.cs.filter(p => p.d <= 5).length}</td></tr>`).join("")}</tbody></table>
    ${absent.length ? `<h3>No centre found nearby</h3><ul class="facts">${absent.map(r => `<li class="fact"><span class="k">${esc(r.b.brand)}.</span> ${esc(r.b.note || "No centre found within about 10 km.")}${r.b.src ? `<div class="meta">${cite(r.b.src)}</div>` : ""}</li>`).join("")}</ul>` : ""}
    <h3>Every centre</h3>
    <table class="ring-tbl"><thead><tr><th>Centre</th><th>Brand</th><th>Distance</th><th>Seats</th></tr></thead>
    <tbody>${all.slice().sort((a, b) => a.d - b.d).map(p => `<tr><td>${link(p)}${p.status && p.status !== "operating" ? ` <span class="fit no">${p.status === "pipeline" ? "pipeline" : "check"}</span>` : ""}<br><span class="note">${esc(p.locality || "")}</span></td><td>${esc(p.brand)}</td><td class="num">${fmtKm(p.d)}</td><td class="num">${p.seats ? inr(p.seats) : "n/a"}</td></tr>`).join("")}</tbody></table>
    <p class="note">${esc(D.competitionNote || "")}</p>`;
}

/* ---------- Connectivity ---------- */
function renderConnectivity() {
  head("Layer 2 · Connectivity", "The Purple Line and the roads out", esc(D.metro.note));
  const line = STN.slice().sort((a, b) => a.seq - b.seq).map(s => byId(`stn-${s.id}`));
  const nm = nearest("metro");
  $("#p-body").innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="l">Nearest station</div><div class="v" style="font-size:17px">${nm ? esc(nm.p.name) : "n/a"}</div><div class="s">${nm ? `${fmtKm(nm.d)} · ${walkMin(nm.d)} min walk` : ""}</div></div>
      <div class="kpi"><div class="l">Stations ≤ 2 km</div><div class="v">${line.filter(p => p.open && p.d <= 2).length}</div><div class="s">walkable</div></div>
      <div class="kpi"><div class="l">To KR Puram</div><div class="v">${(() => { const k = line.find(p => /KR Puram/i.test(p.name)); return k ? fmtKm(k.d) : "n/a"; })()}</div><div class="s">interchange west</div></div>
    </div>
    <h3>Whitefield (Kadugodi) to KR Puram</h3>
    <table class="ring-tbl"><thead><tr><th>#</th><th>Station</th><th>From the site</th><th>Walk / drive</th></tr></thead>
    <tbody>${line.map((p, i) => `<tr${nm && nm.p.id === p.id ? ' style="background:rgba(142,68,173,.08)"' : ""}><td class="num">${i + 1}</td><td>${link(p)}${p.inBrief === false ? ' <span class="note">(not in the brief\'s list)</span>' : ""}</td><td class="num">${fmtKm(p.d)}</td><td class="num">${p.d <= 2.5 ? `${walkMin(p.d)} min walk` : `about ${driveMin(p.d)} min drive`}</td></tr>`).join("")}</tbody></table>
    <p class="note">${esc(D.metro.positionNote || "")} ${D.metro.src ? cite(D.metro.src) : ""}</p>
    <h3>Directions out of the site</h3>
    ${directionsTable()}
    <h3>Drive-time catchment</h3>
    <table class="ring-tbl"><thead><tr><th>Drive time</th><th>Stations reached</th><th>Flex centres</th><th>Tech parks</th></tr></thead>
    <tbody>${CATCH.map(m => `<tr><td>≤ ${m} min</td><td class="num">${within("metro", m).length}</td><td class="num">${within("comp", m).length}</td><td class="num">${within("talent", m).length}</td></tr>`).join("")}</tbody></table>
    <p class="note">${esc(method())}</p>
    ${D.connectivityFacts && D.connectivityFacts.length ? `<h3>Good to know</h3>${factList(D.connectivityFacts)}` : ""}`;
}

/* ---------- Talent & demand ---------- */
function renderTalent() {
  head("Layer 4 · Talent & demand", "Where the talent works and lives", "Tech parks and employers are the demand for flex space; homes and colleges are where the people come from.");
  const tp = PLACES.filter(p => p.kind === "talent" && p.group === "park").sort((a, b) => a.d - b.d);
  const emp = PLACES.filter(p => p.kind === "talent" && p.group !== "park").sort((a, b) => a.d - b.d);
  const res = PLACES.filter(p => p.kind === "res").sort((a, b) => a.d - b.d);
  const edu = PLACES.filter(p => p.kind === "edu").sort((a, b) => a.d - b.d);
  const msf = (arr) => arr.reduce((s, p) => s + (+p.msf || 0), 0);
  $("#p-body").innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="l">Tech parks ≤ 5 km</div><div class="v">${tp.filter(p => p.d <= 5).length}</div><div class="s">${msf(tp.filter(p => p.d <= 5)) ? `about ${msf(tp.filter(p => p.d <= 5)).toFixed(1)} msf` : ""}</div></div>
      <div class="kpi"><div class="l">In 20 min drive</div><div class="v">${within("talent", 20).length}</div><div class="s">tech parks and employers</div></div>
      <div class="kpi"><div class="l">Homes ≤ 20 min</div><div class="v">${within("res", 20).length}</div><div class="s">${within("edu", 20).length} colleges</div></div>
    </div>
    <h3>Tech parks</h3>
    <table class="ring-tbl"><thead><tr><th>Park</th><th>Size</th><th>Distance</th></tr></thead>
    <tbody>${tp.map(p => `<tr><td>${link(p)}<br><span class="note">${esc(p.occupiers || p.locality || "")}</span></td><td class="num">${p.msf ? `${p.msf} msf` : "n/a"}</td><td class="num">${fmtKm(p.d)}</td></tr>`).join("")}</tbody></table>
    <h3>Big employers</h3>
    <table class="ring-tbl"><thead><tr><th>Employer</th><th>Distance</th></tr></thead>
    <tbody>${emp.map(p => `<tr><td>${link(p)}<br><span class="note">${esc(p.sub || "")}</span></td><td class="num">${fmtKm(p.d)}</td></tr>`).join("")}</tbody></table>
    <h3>Where people live</h3>
    <table class="ring-tbl"><thead><tr><th>Area</th><th>Distance</th><th>Drive</th></tr></thead>
    <tbody>${res.map(p => `<tr><td>${link(p)}<br><span class="note">${esc(p.note || "")}</span></td><td class="num">${fmtKm(p.d)}</td><td class="num">about ${driveMin(p.d)} min</td></tr>`).join("")}</tbody></table>
    <h3>Colleges</h3>
    <table class="ring-tbl"><thead><tr><th>College</th><th>Distance</th></tr></thead>
    <tbody>${edu.map(p => `<tr><td>${link(p)}<br><span class="note">${esc(p.note || "")}</span></td><td class="num">${fmtKm(p.d)}</td></tr>`).join("")}</tbody></table>
    <p class="note">Turn on Homes and Colleges in the map bar to see them as points. ${esc(method())}</p>`;
}

/* ---------- Recent deals ---------- */
function renderDeals() {
  head("Recent transactions", "Leasing deals around Whitefield", "Office and flex deals from 2024 to 2026, nearest first, each with its source.");
  const deals = PLACES.filter(p => p.kind === "deal").sort((a, b) => a.d - b.d);
  const flex = deals.filter(p => /flex|cowork|managed/i.test(p.type || ""));
  const sq = deals.reduce((s, p) => s + (+p.sqft || 0), 0);
  $("#p-body").innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="l">Deals mapped</div><div class="v">${deals.length}</div><div class="s">${deals.filter(p => p.d <= 5).length} within 5 km</div></div>
      <div class="kpi"><div class="l">Flex operators</div><div class="v">${flex.length}</div><div class="s">${deals.length - flex.length} corporate</div></div>
      <div class="kpi"><div class="l">Area</div><div class="v">${sq ? (sq / 1e6).toFixed(2) : "n/a"}</div><div class="s">million sq ft, where stated</div></div>
    </div>
    <h3>Every deal</h3>
    <table class="ring-tbl"><thead><tr><th>Tenant</th><th>Building</th><th>Size</th><th>When</th><th>Distance</th></tr></thead>
    <tbody>${deals.map(p => `<tr><td>${link(p, p.tenant || p.name)}<br><span class="note">${esc(p.type || "")}</span></td><td>${esc(p.building || "")}<br><span class="note">${esc(p.locality || "")}</span></td><td class="num">${p.sqft ? `${inr(p.sqft)} SF` : p.seats ? `${inr(p.seats)} seats` : "n/a"}</td><td>${esc(p.date || "")}</td><td class="num">${fmtKm(p.d)}</td></tr>`).join("")}</tbody></table>
    <h3>Market facts</h3>
    ${factList(D.market)}`;
}

/* ---------- Social & green ---------- */
function renderSocial() {
  head("Layers 3 and 5 · Social infrastructure and environment", "Hospitals, lakes and parks", "What is around the site for the people who would work there.");
  const hosp = PLACES.filter(p => p.kind === "social").sort((a, b) => a.d - b.d);
  const env = PLACES.filter(p => p.kind === "env").sort((a, b) => a.d - b.d);
  $("#p-body").innerHTML = `
    <h3>Hospitals</h3>
    <table class="spec">${hosp.map(p => `<tr><th>${link(p)}${p.beds ? `<br><span class="note">${esc(p.beds)} beds</span>` : ""}</th><td>${distCell(p)}${p.note ? `<br><span class="note">${esc(p.note)}</span>` : ""}</td></tr>`).join("")}</table>
    <h3>Lakes and parks</h3>
    <table class="spec">${env.map(p => `<tr><th>${link(p)}${p.acres ? `<br><span class="note">about ${esc(p.acres)} acres</span>` : ""}</th><td>${distCell(p)}${p.note ? `<br><span class="note">${esc(p.note)}</span>` : ""}</td></tr>`).join("")}</table>
    <p class="note">Drive times are indicative: ${SPEED_KMH} km/h on roads about ${ROAD_FACTOR}x the straight line. Walks at ${WALK_KMH} km/h.</p>`;
}

/* ---------- A place ---------- */
/* ---------- Micro-markets ---------- */
function renderMarkets() {
  head("Office micro-markets", "Where Rhapsody sits in Bangalore's office map", "Zoom out on the map to see every micro-market as a numbered area; zoom in and the individual places take over.");
  const zs = PLACES.filter(p => p.kind === "mm").sort((a, b) => a.n - b.n);
  $("#p-body").innerHTML = `
    <p class="vsx"><b>${esc(SITE.name)} sits in ${esc((zs.find(z => z.d === 0) || {}).name || "none of the mapped markets")}.</b> ${esc((zs.find(z => z.d === 0) || {}).note || "")}</p>
    <table class="ring-tbl"><thead><tr><th>#</th><th>Market</th><th>From the site</th></tr></thead>
    <tbody>${zs.map(z => `<tr><td><span class="ico-sm" style="background:${z.color}">${z.n}</span></td><td>${link(z)}<br><span class="note">${esc(z.sub)}</span></td><td class="num">${z.d === 0 ? "inside" : `${fmtKm(z.d)} to edge`}</td></tr>`).join("")}</tbody></table>
    <h3>What the numbers say</h3>
    ${factList(zs.flatMap(z => (z.facts || []).map(f => ({ ...f, k: `${z.name}: ${f.k}` }))))}
    <p class="note">${esc(D.micromarketNote || "")} Distances run from the site to the nearest edge of each market.</p>`;
}
function renderZone(p) {
  $("#p-head").innerHTML = `<button class="back" type="button">← Back to ${esc(tabOf(S.tab).label)}</button>
    <div class="eyebrow"><span class="ico-sm" style="background:${p.color}">${p.n}</span> Office micro-market</div>
    <h2>${esc(p.name)}</h2><div class="lede">${esc(p.full)}</div>${actions()}`;
  const inside = (k) => PLACES.filter(x => x.kind === k && inPoly([x.lng, x.lat], p.ring));
  $("#p-body").innerHTML = `
    <p class="vsx">${p.d === 0 ? `<b>${esc(SITE.name)} is inside this market.</b>` : `<b>${fmtKm(p.d)} from ${esc(SITE.name)}</b> to its nearest edge, about ${driveMin(p.d)} min by road.`}</p>
    <table class="spec"><tr><th>Main areas</th><td>${esc(p.sub)}</td></tr>
      <tr><th>Flex centres mapped inside</th><td>${inside("comp").length}</td></tr>
      <tr><th>Tech parks and employers inside</th><td>${inside("talent").length}</td></tr>
      <tr><th>Recent deals inside</th><td>${inside("deal").length}</td></tr></table>
    <p>${esc(p.note)}</p>
    ${p.facts && p.facts.length ? `<h3>Market numbers</h3>${factList(p.facts)}` : ""}
    <p class="note">${esc(D.micromarketNote || "")} Counts cover only what this atlas maps, which is concentrated around Whitefield.</p>`;
}
function renderPlace(p) {
  if (p.kind === "mm") return renderZone(p);
  const k = KINDS[p.kind], back = tabOf(S.tab).label;
  const title = p.kind === "deal" ? (p.tenant || p.name) : p.name;
  $("#p-head").innerHTML = `<button class="back" type="button">← Back to ${esc(back)}</button>
    <div class="eyebrow"><span class="dot" style="background:${k.color};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px"></span>${esc(k.label)}${p.brand ? " · " + esc(p.brand) : ""}</div>
    <h2>${esc(title)}</h2>${p.sub && p.kind !== "comp" ? `<div class="lede">${esc(p.sub)}</div>` : ""}${actions()}`;
  const st = p.kind === "metro" ? null : nearest("metro", p), cm = catchOf(p);
  const rows = [
    ["Brand", p.brand], ["Status", p.status && p.status !== "operating" ? p.statusText : null], ["Building", p.building], ["Address", p.address], ["Locality", p.locality],
    ["Type", p.type], ["Date", p.dateFull || p.date], ["Size", p.sqft ? `${inr(p.sqft)} sq ft` : p.msf ? `about ${p.msf} million sq ft` : null],
    ["Seats", p.seats ? inr(p.seats) : null], ["Beds", p.beds], ["Area", p.acres ? `about ${p.acres} acres` : null],
    ["Occupiers", p.occupiers], ["Opened", p.opened], ["Landlord", p.landlord]
  ].filter(r => r[1] != null && r[1] !== "");
  $("#p-body").innerHTML = `
    <p class="vsx"><b>${fmtKm(p.d)} from ${esc(SITE.name)}</b>, about ${driveMin(p.d)} min by road${p.d <= 2.5 ? `, ${walkMin(p.d)} min on foot` : ""}. ${cm ? `Inside the ${cm} minute drive-time catchment.` : "Outside the 30 minute drive-time catchment."}</p>
    <table class="spec">${rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")}
      ${st ? `<tr><th>Nearest open metro</th><td>${link(st.p)} · ${fmtKm(st.d)}</td></tr>` : ""}</table>
    ${p.note ? `<p>${esc(p.note)}</p>` : ""}
    <h3>Where it sits on the map</h3>
    <p class="note">${p.confidence ? `Confidence: <b>${esc(p.confidence)}</b>. ` : ""}${esc(p.coordNote || p.coord_src || "")} ${p.src ? cite(p.src, "source") : ""}</p>`;
}

/* ---------- mobile sheet ---------- */
function setSheet(state) { S.sheet = state; document.body.dataset.sheet = state; }
const SHEET_STOPS = () => ({ peek: 118, half: innerHeight * .52, full: innerHeight - 64 });
function wireSheet() {
  setSheet("half");
  const g = $("#sheet-grip"); if (!g) return;
  let y0 = null, h0 = 0, t0 = 0, moved = false;
  const end = (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0, fast = Math.abs(dy) / Math.max(1, performance.now() - t0) > .6; y0 = null;
    document.body.classList.remove("sheet-drag"); document.body.style.removeProperty("--sheet-h");
    if (!moved) return;
    const stops = SHEET_STOPS(), order = ["peek", "half", "full"], h = h0 - dy;
    let next = order.reduce((best, k) => Math.abs(stops[k] - h) < Math.abs(stops[best] - h) ? k : best, "half");
    if (fast && next === S.sheet) next = order[Math.max(0, Math.min(2, order.indexOf(S.sheet) + (dy < 0 ? 1 : -1)))];
    setSheet(next);
  };
  g.addEventListener("pointerdown", e => { y0 = e.clientY; t0 = performance.now(); moved = false; h0 = $("#panel").getBoundingClientRect().height; try { g.setPointerCapture(e.pointerId); } catch (x) {} });
  g.addEventListener("pointermove", e => {
    if (y0 == null) return;
    if (!moved && Math.abs(e.clientY - y0) > 6) { moved = true; document.body.classList.add("sheet-drag"); }
    if (moved) { const st = SHEET_STOPS(), h = Math.max(st.peek - 30, Math.min(st.full, h0 - (e.clientY - y0))); document.body.style.setProperty("--sheet-h", h + "px"); }
  });
  g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
  g.addEventListener("click", () => { if (moved) { moved = false; return; } setSheet(S.sheet === "half" ? "full" : "half"); });
}

/* ---------- resizable, foldable panes (desktop) ---------- */
const PANE = { board: { v: "--board-w", min: 260, max: 520, def: 340 }, panel: { v: "--panel-w", min: 380, max: 820, def: 500 } };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
function setPaneW(k, px, save = true) {
  const c = PANE[k], w = Math.round(Math.min(c.max, Math.max(c.min, px), innerWidth * .42));
  document.documentElement.style.setProperty(c.v, w + "px");
  if (save) store.set("wf-w-" + k, String(w));
}
function setFold(k, on) {
  document.body.classList.toggle("fold-" + k, on);
  store.set("wf-fold-" + k, on ? "1" : "");
  const pane = document.getElementById(k);
  if (on && pane.contains(document.activeElement)) document.querySelector(`.reopen-${k}`).focus();
  clearTimeout(setFold.t);
  setFold.t = setTimeout(() => { if (!map) return; if (S.sel) flyToPlace(byId(S.sel)); else fitAll(); }, 320);
}
function wirePanes() {
  for (const k of ["board", "panel"]) {
    const v = Number(store.get("wf-w-" + k)); if (v) setPaneW(k, v, false);
    if (store.get("wf-fold-" + k) === "1" && innerWidth > 860) setFold(k, true);
  }
  document.querySelectorAll("[data-fold]").forEach(b => b.addEventListener("click", () => { const k = b.dataset.fold; setFold(k, !document.body.classList.contains("fold-" + k)); }));
  addEventListener("keydown", e => {
    if (innerWidth <= 860 || e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === "[") setFold("board", !document.body.classList.contains("fold-board"));
    if (e.key === "]") setFold("panel", !document.body.classList.contains("fold-panel"));
  });
  document.querySelectorAll(".grip").forEach(g => {
    const k = g.dataset.grip;
    g.addEventListener("pointerdown", e => {
      e.preventDefault();
      const x0 = e.clientX, w0 = document.getElementById(k).getBoundingClientRect().width;
      document.body.classList.add("resizing");
      try { g.setPointerCapture(e.pointerId); } catch (x) {}
      const move = (ev) => setPaneW(k, k === "board" ? w0 + ev.clientX - x0 : w0 - (ev.clientX - x0));
      const up = () => { document.body.classList.remove("resizing"); g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up); };
      g.addEventListener("pointermove", move); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
    });
    g.addEventListener("dblclick", () => setPaneW(k, PANE[k].def));
    g.addEventListener("keydown", e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const w = document.getElementById(k).getBoundingClientRect().width, step = e.shiftKey ? 48 : 16;
      setPaneW(k, w + (e.key === "ArrowRight" ? step : -step) * (k === "board" ? 1 : -1));
    });
  });
}

initGate();
