/* ============================================================================
   ATLAS · NOIDA OFFICE STUDY (Digitide)

   The Chennai study's interface, filled with the Noida property sheet.
   Autopilot has already screened the 20 buildings, so the order here is
   Autopilot's: three highlights in order, one option, and the rest not
   suitable, each with its reason. Every tab reads that shortlist against
   Digitide's current office, the Blue Line, talent and BPO employers nearby.

     at a glance         Overview: the highlights, then all 20 in one table
     current office      every card, pin label, panel and the Distances tab
     connectivity        Connectivity tab: nearest Blue Line station
     distance between    Distances tab: every building to every other
     talent              Talent tab: institutes, homes, BPO employers, PGs
     micro-markets       Micro-markets tab: the sheet's rents and floor plates
     conclusion          Conclusion tab: the highlights side by side

   Every distance is a straight line between two pins: the shortest possible
   distance, never a road route. Where a time is shown it is an estimate
   made from that line, and it says so.

   Map stability, against the old Noida view: no animation loop, hover is a
   feature-state change (no data reload, so labels never re-place on hover),
   pin data is reloaded only when the selection or a filter changes, the
   camera never tilts past 58 degrees, and point-of-interest labels are off.
   The satellite view is Mapbox's own satellite style, with no buildings
   drawn on top of the photo.

   data.js holds every fact and where it came from. This file only reads it.
   ============================================================================ */
"use strict";

/* Access gate, as on /chennai/: the page holds only a SHA-256 of the
   normalised "ID:PASSWORD", never the password. It is a browser-side check:
   it keeps a casual visitor out of the view, it does not make data.js
   private. The site root login routes here via clients/manifest.js. */
const GATE_HASH = "285c99fea6232383aef07d9af4698fcb0f0dc069a6ec69733452247f51abcbf1";
async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const AUTH_KEY = "noi-auth", HANDOFF = "/noida/";
/* CMS (atlas-cms.js): features switched off in /admin/ and visit tracking.
   Without the CMS script everything is on and nothing is tracked. */
const CMS = window.AtlasCMS || null;
const cmsOn = (key) => !CMS || CMS.on(key);
const MEDIA = "../media/digitide-noida/";

const O = window.NOI_OPTIONS, M = window.NOI_META, F = window.NOI_FACTS, EX = window.NOI_EXISTING;
const Z = window.NOI_ZONES, TR = window.NOI_TRANSIT, PL = window.NOI_PLACES;
const ZONE = Object.fromEntries(Z.map(z => [z.key, z]));
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cite = (u, label) => /^https?:\/\//.test(u || "") ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || host(u))} ↗</a>` : "";
const nn = (o) => String(o.n).padStart(2, "0");
const short = (o) => o.name.replace(/\s*\(.*\)\s*$/, "");
const REDUCED = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ------------------------------------------------------------ verdicts ---
   Autopilot's screening is the ranking. o.n runs Highlight 1, 2 and 3, then
   the option, then the rest in the sheet's order, so the list, the pins and
   every table read in the same order. */
const VERDICT = {
  Highlight: { cls: "hi", color: "#a3502c", word: (o) => `Highlight ${o.pick || ""}`.trim() },
  Option: { cls: "op", color: "#1f6f8b", word: () => "Option" },
  "Not suitable": { cls: "ns", color: "#7d7166", word: () => "Not suitable" }
};
const vOf = (o) => VERDICT[o.verdict] || VERDICT["Not suitable"];
const isShort = (o) => o.verdict === "Highlight" || o.verdict === "Option";
const tagHTML = (o) => `<span class="vt ${vOf(o).cls}">${esc(vOf(o).word(o))}</span>`;
const byPick = (a, b) => a.n - b.n;
const HIGH = O.filter(o => o.verdict === "Highlight").sort((a, b) => (a.pick || 9) - (b.pick || 9) || a.n - b.n);
const OPTS = O.filter(o => o.verdict === "Option").sort(byPick);
const SHORT = [...HIGH, ...OPTS];
const REST = O.filter(o => !isShort(o)).sort(byPick);

/* ------------------------------------------------------------ geometry -- */
function km(a, b) {
  const toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}
/* Offsets in km to lng/lat at Noida's latitude; good to well under 1% over
   the 15 km the study covers. */
const KM_LAT = 110.6, KM_LNG = 111.32 * Math.cos(28.61 * Math.PI / 180);
function circle(c, rKm, n = 72) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n * 2 * Math.PI; pts.push([c[0] + rKm * Math.cos(t) / KM_LNG, c[1] + rKm * Math.sin(t) / KM_LAT]); }
  return pts;
}
function ellipse(c, rx, ry, n = 72) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n * 2 * Math.PI; pts.push([c[0] + rx * Math.cos(t) / KM_LNG, c[1] + ry * Math.sin(t) / KM_LAT]); }
  return pts;
}
const zonePolygon = (z) => ellipse(z.shape.c, z.shape.rx, z.shape.ry);
const zoneCentre = (z) => z.shape.c;

/* ------------------------------------------------------- distances -------
   The straight line between two pins is the shortest possible distance, so
   it never takes a roundabout path the way a routed road distance can.
   Times are only an estimate from that line, with the speed and road factor
   stated in data.js. */
const SPEED_KMH = M.speed.kmh, ROAD_FACTOR = M.speed.factor;
const RINGS = [{ km: 2, color: "#a3502c" }, { km: 4, color: "#c8693a" }, { km: 8, color: "#d9a07a" }];
const REACH = 1;   // the 4 km ring: "within reach" everywhere on the page
const REACH_KM = RINGS[REACH].km;
const driveMin = (k) => Math.max(1, Math.round(k * ROAD_FACTOR / SPEED_KMH * 60));
const METHOD = `Distances are straight lines between the pins: the shortest possible distance, never a road route. Times are only an estimate from that line at ${SPEED_KMH} km/h with a ${ROAD_FACTOR}x road factor (${M.speed.note}).`;
const fmtKm = (d) => `${d < 10 ? d.toFixed(1) : Math.round(d)} km`;
const fmtM = (d) => d < 1 ? `${Math.round(d * 1000 / 10) * 10} m` : fmtKm(d);
const walkMin = (d) => Math.round(d * 1000 / 80);

/* --------------------------------------------------------------- metro --- */
const LINES = TR.lines.map(L => ({ ...L, stations: L.stations.map(s => ({ ...s, open: s.open !== false, line: L.key, lineName: L.short || L.name, mode: L.mode, color: L.color })) }));
const STATIONS = LINES.flatMap(L => L.stations);
const nearest = (p, list) => list.map(s => ({ s, d: km(p, s) })).sort((a, b) => a.d - b.d)[0];
const nearestSt = (p) => nearest(p, STATIONS);
const accessWord = (d) => d <= 1.2 ? `${walkMin(d)} min walk` : d <= 3 ? "short auto or e-rickshaw" : "cab or bus";

/* ---------------------------------------------------------- catchment ---- */
const KINDS = ["edu", "res", "bpo", "pg"];
const KIND_WORD = { edu: "Institute", res: "Residential belt", bpo: "BPO / BPM employer", pg: "PG or co-living" };
function catchment(p) {
  const out = RINGS.map(r => ({ km: r.km, edu: [], res: [], bpo: [], pg: [] }));
  for (const x of PL) {
    if (!KINDS.includes(x.kind)) continue;
    const d = km(p, x), i = out.findIndex(r => d <= r.km);
    if (i >= 0) out[i][x.kind].push({ ...x, d });
  }
  return out;
}
const upTo = (c, i, kind) => c.slice(0, i + 1).reduce((s, r) => s + r[kind].length, 0);
const CATCH = new Map();
const catchOf = (o) => { if (!CATCH.has(o.id)) CATCH.set(o.id, catchment(o)); return CATCH.get(o.id); };
const nearestOf = (p, kind) => nearest(p, PL.filter(x => x.kind === kind));
const exKm = (o) => km(o, EX);

/* --------------------------------------------------------------- state -- */
const S = {
  tab: "overview", sel: null, hov: null, pair: null, shot: "close", sort: "picks", sheet: "half", filters: new Set(),
  layers: { existing: true, sat: true, zones: true, rail: true, links: true, bpo: false, edu: false, res: false, pg: false, rings: false }
};
const ZONE_FILTERS = Z.map(z => ({ key: z.key, label: z.label, hint: `Keep only buildings in ${z.name}.`, test: o => o.micro === z.key })).filter(f => cmsOn("filter:" + f.key));
const OTHER_FILTERS = [
  { key: "short", label: "Autopilot's shortlist", hint: "Keep only the three highlights and the option.", test: isShort },
  { key: "near", label: "Metro ≤ 1 km", hint: "Keep only buildings within 1 km of a metro station, in a straight line.", test: o => nearestSt(o).d <= 1 }
].filter(f => cmsOn("filter:" + f.key));
for (const k of Object.keys(S.layers)) if (!cmsOn("layer:" + k)) S.layers[k] = false;
const passes = (o) => {
  const on = [...S.filters], zs = on.filter(k => ZONE[k]), other = on.filter(k => !ZONE[k]);
  return (zs.length === 0 || zs.includes(o.micro)) && other.every(k => { const f = OTHER_FILTERS.find(x => x.key === k); return !f || f.test(o); });
};
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "markets", label: "Micro-markets" },
  { key: "connect", label: "Connectivity" },
  { key: "distance", label: "Distances" },
  { key: "talent", label: "Talent" },
  { key: "conclusion", label: "Conclusion" },
  { key: "compare", label: "Compare all" }
].filter(t => t.key === "overview" || cmsOn("tab:" + t.key));
const SORT_LABEL = { picks: "Autopilot's order", home: "nearest today's office first", rail: "nearest metro first", plate: "largest floors first", rent: "lowest rent first", sheet: "sheet order" };

/* ================================================================ gate == */
function initGate() {
  const norm = (v) => v.trim().toUpperCase().replace(/[\s-]/g, "");
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true; $("#g-go").disabled = true;
    let ok = false;
    try { ok = (await sha256(norm($("#g-id").value) + ":" + norm($("#g-pw").value))) === GATE_HASH; } catch (e) { ok = false; }
    busy = false; $("#g-go").disabled = false;
    if (ok) { try { sessionStorage.setItem(AUTH_KEY, "1"); } catch (e) {} if (CMS) CMS.signin(norm($("#g-id").value)); openApp(); }
    else { $("#g-err").textContent = "Not recognised. Access is issued per person."; $("#g-pw").value = ""; $("#g-pw").focus(); }
  };
  const openApp = () => { const g = $("#gate"); g.classList.add("out"); setTimeout(() => g.remove(), 450); boot(); };
  loadBackdrop();
  startMap();
  const near = O.filter(o => nearestSt(o).d <= 1).length;
  $("#g-stats").innerHTML = `<span><b>${O.length}</b>buildings</span><span><b>${HIGH.length}</b>highlights</span>`
    + `<span><b>${near}</b>within 1 km of the metro</span><span><b>${PL.filter(p => p.kind === "bpo").length}</b>BPO employers mapped</span>`;
  let handoff = null;
  try { handoff = sessionStorage.getItem("atlas-handoff"); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
  let authed = false;
  try { if (handoff === HANDOFF) sessionStorage.setItem(AUTH_KEY, "1"); authed = sessionStorage.getItem(AUTH_KEY) === "1"; } catch (e) {}
  if (handoff === HANDOFF && CMS) { let id = null; try { id = sessionStorage.getItem("atlas-access-id"); } catch (e) {} CMS.signin(id); }
  if (authed) { $("#gate").remove(); boot(); return; }
  try { if (sessionStorage.getItem("noi-out") === "1") { sessionStorage.removeItem("noi-out"); const e = $("#g-err"); e.style.color = "var(--ok)"; e.textContent = "You have signed out on this device."; } } catch (e) {}
  $("#g-form").addEventListener("submit", e => { e.preventDefault(); $("#g-err").removeAttribute("style"); go(); });
  $("#g-id").focus();
}
/* The hex field backdrop is rendered from the study's own map and committed
   with the site. WebP first, then the JPEG copy; if both fail the image is
   removed and the CSS hex field under it shows instead. */
function loadBackdrop() {
  const img = $("#g-bg"); if (!img) return;
  const b = MEDIA + (matchMedia("(max-aspect-ratio: 3/4)").matches ? "hexfield-tall" : "hexfield-wide");
  const tries = [b + ".webp", b + ".jpg"];
  const next = () => { const u = tries.shift(); if (!u) { img.remove(); return; } img.src = u; };
  img.addEventListener("load", () => img.classList.add("on"));
  img.addEventListener("error", next);
  next();
}
function signOut() {
  if (CMS) CMS.signout();
  try { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem("atlas-handoff"); sessionStorage.setItem("noi-out", "1"); } catch (e) {}
  location.replace(location.pathname);
}

/* ================================================================ map === */
let map, booted = false;
const MAPBOX_CDN = "https://api.mapbox.com/mapbox-gl-js/v3.10.0/";
function loadMapbox() {
  if (window.mapboxgl) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const js = document.createElement("script"); js.src = MAPBOX_CDN + "mapbox-gl.js"; js.onload = resolve; js.onerror = reject; document.head.appendChild(js);
  });
}
const mapUnavailable = () => { $("#map").innerHTML = `<div class="nomap">Map unavailable right now. Everything else on the page still works.</div>`; };
function startMap() {
  if (!window.MAPBOX_TOKEN) return mapUnavailable();
  loadMapbox().then(initMap).catch(mapUnavailable);
}
function boot() {
  booted = true;
  applyRoute(false);
  renderTabs(); renderFilters(); renderList(); renderPanel(); renderLayers();
  wireBoard(); wireSheet(); wirePanes(); wireHints();
  $("#signout").addEventListener("click", signOut);
  $("#sort").dataset.hint = "Order the list: Autopilot's order, distance from today's office, nearest metro, floor plate or quoted rent.";
  addEventListener("popstate", () => applyRoute(true));
  if (map && map.getSource("options")) { refreshMap(true); if (S.sel) select(S.sel, true, true); else fitAll(false); }
}
/* Two basemaps. Satellite (the default) is Mapbox Standard Satellite: the
   photo with roads and names on it and no buildings drawn over the roofs.
   The plain map is Mapbox Standard, as on the Chennai study, faded so the
   pins lead, with flat building outlines and no 3D. On both, shop and
   restaurant labels are off: they are what flickers in and out while the
   map moves, and they add nothing to an office search. Switching between
   them reloads the basemap, and addLayers puts this study's layers back.
   NOI_MAP_STYLES ({ std, sat }) lets a test swap in local styles. */
const STYLES = window.NOI_MAP_STYLES || { std: "mapbox://styles/mapbox/standard", sat: "mapbox://styles/mapbox/standard-satellite" };
const IS_MAPBOX = !window.NOI_MAP_STYLES;
const styleUrl = () => S.layers.sat ? STYLES.sat : STYLES.std;
const basemap = () => S.layers.sat
  ? { lightPreset: "day", showPointOfInterestLabels: false, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true }
  : { lightPreset: "day", theme: "faded", showPointOfInterestLabels: false, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true, show3dObjects: false };
function applyBasemap() {
  if (!IS_MAPBOX) return;
  for (const [k, v] of Object.entries(basemap())) { try { map.setConfigProperty("basemap", k, v); } catch (e) {} }
}
let layered = false;
function setSatellite() {
  if (!map || !layered) return;
  S.hov = null;
  map.setStyle(styleUrl(), { diff: false });
}
function initMap() {
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  map = new mapboxgl.Map({
    container: "map", style: styleUrl(), center: M.center, zoom: M.zoom, pitch: 0, bearing: 0, maxPitch: 60,
    attributionControl: false, projection: "mercator", cooperativeGestures: false, antialias: innerWidth > 860,
    renderWorldCopies: false, config: IS_MAPBOX ? { basemap: basemap() } : undefined
  });
  /* After a basemap switch the study's own layers are gone; put them back.
     Click and hover handlers are tied to layer names, so they carry over. */
  map.on("style.load", () => { applyBasemap(); if (layered && !map.getSource("options")) addLayers(); });
  let told = false;
  map.on("error", (e) => {
    const st = e && e.error && e.error.status;
    if (told || (st !== 401 && st !== 403)) return;
    told = true;
    $("#map").insertAdjacentHTML("beforeend", `<div class="nomap warn">Mapbox did not accept the map key on this address, so the map cannot load here. Everything else on the page still works.</div>`);
  });
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("load", () => { addLayers(); wireMap(); layered = true; if (booted && S.sel) select(S.sel, true, true); else fitAll(false); });
}

/* ------------------------------------------------------------ deep links --
   Every view has an address (#/option/techm, #/distance), so the team can
   send a client exactly the view they discussed. */
function routeHash() {
  if (S.sel) return `#/option/${S.sel}`;
  return S.tab === "overview" ? "#/" : `#/${S.tab}`;
}
function pushRoute() { const h = routeHash(); if (location.hash !== h && !(h === "#/" && !location.hash)) history.pushState(null, "", h); }
function applyRoute(render) {
  const [kind, val] = location.hash.replace(/^#\/?/, "").split("/");
  S.sel = null;
  if (kind === "option" && O.some(o => o.id === val)) S.sel = val;
  else if (TABS.some(t => t.key === kind && t.key !== "compare")) S.tab = kind;
  else S.tab = "overview";
  if (render) { renderTabs(); renderList(); renderPanel(); refreshMap(); if (S.sel) select(S.sel, true, true); else fitAll(); }
}
async function copyLink(btn) {
  const url = location.href.split("#")[0] + routeHash();
  try { await navigator.clipboard.writeText(url); btn.textContent = "Link copied"; }
  catch (e) { window.prompt("Copy this link", url); }
  setTimeout(() => { btn.textContent = "Copy link"; }, 1800);
}

function padding() {
  const Wd = innerWidth, Hd = innerHeight;
  let pad;
  if (Wd <= 860) {
    const sh = document.getElementById("panel").getBoundingClientRect();
    pad = sh.left > Wd * .3
      ? { top: 70, bottom: 90, left: 20, right: Wd - sh.left + 20 }
      : { top: 160, bottom: Math.max(60, Hd - sh.top + 110), left: 24, right: 24 };
  } else {
    const b = document.getElementById("board").getBoundingClientRect(), p = document.getElementById("panel").getBoundingClientRect();
    const l = document.getElementById("layers").getBoundingClientRect();
    const bOut = document.body.classList.contains("fold-board"), pOut = document.body.classList.contains("fold-panel");
    pad = { top: 100, bottom: Hd - l.top + 24, left: bOut ? 60 : Math.max(30, b.right + 30), right: pOut ? 60 : Math.max(30, Wd - p.left + 30) };
  }
  const squeeze = (a, c, room) => { const k = Math.min(1, room / (pad[a] + pad[c])); pad[a] *= k; pad[c] *= k; };
  squeeze("top", "bottom", Hd - 80); squeeze("left", "right", Wd - 80);
  return pad;
}
function fitPoints(pts, opts = {}) {
  if (!map || !pts.length) return;
  const b = pts.reduce((bb, p) => bb.extend(p), new mapboxgl.LngLatBounds());
  map.fitBounds(b, { padding: padding(), maxZoom: opts.maxZoom || 15, pitch: 0, bearing: 0, duration: opts.animate === false || REDUCED() ? 0 : 900 });
}
function fitAll(animate = true) {
  const pts = O.filter(passes).map(o => [o.lng, o.lat]);
  if (S.layers.existing) pts.push([EX.lng, EX.lat]);
  fitPoints(pts, { animate });
}

/* ------------------------------------------------------------ sources ---- */
const FC = (features) => ({ type: "FeatureCollection", features });
const pt = (lng, lat, properties) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties });
const ln = (coords, properties) => ({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties });
/* Hover is not part of this: it is a feature-state, so hovering never
   reloads the pins. */
const focusOf = (o) => (S.sel === o.id || (S.pair && S.pair.includes(o.id))) ? 2 : !passes(o) ? 0 : S.sel ? .5 : 1;
const optionFC = () => FC(O.map(o => ({ ...pt(o.lng, o.lat, {
  id: o.id, n: nn(o), name: short(o), tag: isShort(o) ? vOf(o).word(o) : "", km: `${fmtKm(exKm(o))} from office`,
  color: vOf(o).color, pick: isShort(o) ? 1 : 0, foc: focusOf(o), rank: o.n }), id: o.n })));
function ringFC() {
  const o = O.find(x => x.id === S.sel);
  if (!o || !S.layers.rings) return FC([]);
  return FC(RINGS.slice().reverse().map(r => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [circle([o.lng, o.lat], r.km)] }, properties: { color: r.color } })));
}
function ringLabelFC() {
  const o = O.find(x => x.id === S.sel);
  if (!o || !S.layers.rings) return FC([]);
  return FC(RINGS.map(r => pt(o.lng, o.lat + r.km / KM_LAT, { label: `${r.km} km` })));
}
/* Links: the open building to its three nearest buildings, or the pair
   picked on the distance matrix, each with its straight-line distance. */
function linkFC() {
  const out = [];
  const add = (a, b, kind) => {
    const d = km(a, b);
    out.push(ln([[a.lng, a.lat], [b.lng, b.lat]], { part: "line", kind }));
    out.push(pt((a.lng + b.lng) / 2, (a.lat + b.lat) / 2, { part: "label", kind, label: fmtKm(d) }));
  };
  if (S.pair) {
    const [a, b] = S.pair.map(id => id === EX.id ? EX : O.find(o => o.id === id));
    if (a && b) add(a, b, "pair");
  } else if (S.sel) {
    const o = O.find(x => x.id === S.sel);
    O.filter(x => x.id !== o.id).map(x => ({ x, d: km(o, x) })).sort((a, b) => a.d - b.d).slice(0, 3).forEach(({ x }) => add(o, x, "nb"));
  }
  return FC(out);
}
function exLinkFC() {
  const o = S.sel && O.find(x => x.id === S.sel);
  if (!o) return FC([]);
  const d = exKm(o);
  return FC([ln([[o.lng, o.lat], [EX.lng, EX.lat]], { part: "line" }),
    pt((o.lng + EX.lng) / 2, (o.lat + EX.lat) / 2, { part: "label", label: `${fmtKm(d)} to today's office` })]);
}
function railFC() {
  const feats = [];
  for (const L of LINES) {
    const st = L.stations;
    for (let i = 0; i < st.length - 1; i++) feats.push(ln([[st[i].lng, st[i].lat], [st[i + 1].lng, st[i + 1].lat]], { line: L.key, color: L.color }));
  }
  return FC(feats);
}
const stationFC = () => FC(STATIONS.map((s, i) => ({ ...pt(s.lng, s.lat, { name: s.name, line: s.lineName, color: s.color, key: `${s.line}:${s.name}` }), id: i + 1 })));
const COL = { edu: "#5b3aa7", res: "#0a8a3a", bpo: "#d0417b", pg: "#b7791f" };
const placesFC = () => FC(PL.map(p => pt(p.lng, p.lat, { id: p.id, kind: p.kind, name: p.name, color: COL[p.kind] || "#4a4a4a" })));

/* Slots place a layer inside the Standard basemap. A style without slots
   gets the layer without one, on top. */
function add(layer, before) {
  try { map.addLayer(layer, before); } catch (e) { console.warn("layer", layer.id, e.message); }
  if (!map.getLayer(layer.id) && layer.slot) { const { slot, ...rest } = layer; try { map.addLayer(rest, before); } catch (e) {} }
}
function addLayers() {
  /* zones, on the ground */
  map.addSource("zones", { type: "geojson", data: FC(Z.map(z => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [zonePolygon(z)] }, properties: { key: z.key, color: z.color } }))) });
  map.addSource("zone-labels", { type: "geojson", data: FC(Z.map(z => pt(...zoneCentre(z), { label: z.label.toUpperCase() }))) });
  add({ id: "zones-fill", type: "fill", source: "zones", slot: "middle", paint: { "fill-color": ["get", "color"], "fill-opacity": .1 } });
  add({ id: "zones-line", type: "line", source: "zones", slot: "middle", paint: { "line-color": ["get", "color"], "line-width": 1.4, "line-dasharray": [2, 2], "line-opacity": .9 } });
  add({ id: "zones-label", type: "symbol", source: "zone-labels", layout: { "text-field": ["get", "label"], "text-size": 11.5, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-letter-spacing": .16, "text-max-width": 12, "symbol-sort-key": 100 },
    paint: { "text-color": "#4a3a2e", "text-opacity": .8, "text-halo-color": "#fff", "text-halo-width": 1.4 } });

  /* distance rings */
  map.addSource("rings", { type: "geojson", data: ringFC() });
  map.addSource("ring-labels", { type: "geojson", data: ringLabelFC() });
  add({ id: "rings-fill", type: "fill", source: "rings", slot: "middle", paint: { "fill-color": ["get", "color"], "fill-opacity": .05 } });
  add({ id: "rings-line", type: "line", source: "rings", slot: "middle", paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": .85 } });
  add({ id: "rings-label", type: "symbol", source: "ring-labels", layout: { "text-field": ["get", "label"], "text-size": 11, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, -.6] },
    paint: { "text-color": "#a3502c", "text-halo-color": "#fff", "text-halo-width": 1.6 } });

  /* metro */
  map.addSource("rail", { type: "geojson", data: railFC() });
  add({ id: "rail-casing", type: "line", source: "rail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 7, "line-opacity": .85 } });
  add({ id: "rail-open", type: "line", source: "rail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 4 } });
  const stData = stationFC();
  map.addSource("stations", { type: "geojson", data: stData });
  add({ id: "st-open", type: "circle", source: "stations", paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6.5], "circle-color": "#fff",
    "circle-stroke-color": ["get", "color"], "circle-stroke-width": 2.2 } });
  add({ id: "st-label", type: "symbol", source: "stations", minzoom: 12, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "symbol-sort-key": 50 },
    paint: { "text-color": "#1d3f66", "text-halo-color": "#fff", "text-halo-width": 1.5 } });

  /* talent, employers, homes */
  const pData = placesFC();
  map.addSource("places", { type: "geojson", data: pData });
  add({ id: "places", type: "circle", source: "places", paint: {
    "circle-radius": ["case", ["==", ["get", "kind"], "res"], 8, 5.5],
    "circle-color": ["get", "color"], "circle-opacity": ["case", ["==", ["get", "kind"], "res"], .25, .92],
    "circle-stroke-color": ["case", ["==", ["get", "kind"], "res"], ["get", "color"], "#fff"], "circle-stroke-width": 1.4 } });
  add({ id: "places-label", type: "symbol", source: "places", minzoom: 12.5, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"], "text-offset": [0, .95], "text-anchor": "top", "text-max-width": 9, "symbol-sort-key": 60 },
    paint: { "text-color": ["get", "color"], "text-halo-color": "#fff", "text-halo-width": 1.4 } });

  /* links between buildings, and to the current office */
  map.addSource("links", { type: "geojson", data: linkFC() });
  add({ id: "links", type: "line", source: "links", filter: ["==", ["get", "part"], "line"], layout: { "line-cap": "round" },
    paint: { "line-color": ["case", ["==", ["get", "kind"], "pair"], "#a3502c", "#4a3a2e"], "line-width": ["case", ["==", ["get", "kind"], "pair"], 3, 1.8], "line-dasharray": [1, 1.2], "line-opacity": .9 } });
  map.addSource("ex-link", { type: "geojson", data: exLinkFC() });
  add({ id: "ex-link", type: "line", source: "ex-link", filter: ["==", ["get", "part"], "line"], layout: { "line-cap": "round" },
    paint: { "line-color": "#2a1e16", "line-width": 2.4, "line-dasharray": [1.4, 1.4], "line-opacity": .9 } });
  const exData = pt(EX.lng, EX.lat, { name: EX.name });
  map.addSource("existing", { type: "geojson", data: exData });
  add({ id: "ex-pin", type: "circle", source: "existing", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 9, 15, 13],
    "circle-color": "#2a1e16", "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } });
  add({ id: "ex-dot", type: "circle", source: "existing", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.2, 15, 4.8], "circle-color": "#fff" } });

  /* buildings */
  map.addSource("options", { type: "geojson", data: optionFC() });
  const foc = ["get", "foc"], col = ["get", "color"], pick = ["==", ["get", "pick"], 1], hov = ["boolean", ["feature-state", "hov"], false];
  add({ id: "opt-halo", type: "circle", source: "options", paint: {
    "circle-radius": 24, "circle-color": col, "circle-pitch-alignment": "map",
    "circle-opacity": ["case", ["==", foc, 2], .2, hov, .16, 0], "circle-stroke-color": col, "circle-stroke-width": 2,
    "circle-stroke-opacity": ["case", ["==", foc, 2], .85, hov, .7, 0] } });
  add({ id: "opt", type: "circle", source: "options", paint: {
    "circle-radius": ["case", ["==", foc, 2], 15, hov, 14, pick, 12.5, 9.5], "circle-color": col,
    "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["==", foc, 2], 3, pick, 2.5, 1.8],
    "circle-opacity": ["case", ["==", foc, 0], .25, ["==", foc, .5], .6, 1],
    "circle-stroke-opacity": ["case", ["==", foc, 0], .3, ["==", foc, .5], .65, 1] } });
  add({ id: "opt-num", type: "symbol", source: "options", layout: { "text-field": ["get", "n"], "text-size": ["case", ["==", foc, 2], 12.5, pick, 11, 9.5],
    "text-allow-overlap": true, "text-ignore-placement": true, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] },
    paint: { "text-color": "#fff", "text-opacity": ["case", ["==", foc, 0], .35, ["==", foc, .5], .7, 1] } });
  /* Names with the distance to today's office under them. The shortlist's
     labels always show; the others give way where they would collide, the
     earlier numbers first, and more appear as you zoom in. */
  const nameText = (withTag) => ["format", ["get", "name"], {}, ...(withTag ? [" · ", {}, ["get", "tag"], {}] : []), "\n", {}, ["get", "km"], { "font-scale": .82 }];
  const nameLayout = { "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": 1.25, "text-justify": "auto", "symbol-sort-key": ["get", "rank"], "text-padding": 1 };
  add({ id: "opt-name", type: "symbol", source: "options", minzoom: 11, filter: ["all", ["!=", foc, 2], ["!", pick]], layout: { ...nameLayout, "text-field": nameText(false), "text-size": 11,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"] },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 1.6, "text-opacity": ["case", ["==", foc, 1], 1, .45] } });
  add({ id: "opt-name-pick", type: "symbol", source: "options", filter: ["all", ["!=", foc, 2], pick], layout: { ...nameLayout, "text-field": nameText(true), "text-size": 12.5,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2, "text-opacity": ["case", ["==", foc, 1], 1, .55] } });
  add({ id: "opt-name-focus", type: "symbol", source: "options", filter: ["==", foc, 2], layout: { "text-field": nameText(true), "text-size": 14,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-offset": [1.6, 0], "text-anchor": "left", "text-allow-overlap": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.4 } });
  add({ id: "ex-label", type: "symbol", source: "existing", layout: { "text-field": `${EX.name} · today's office`, "text-size": 12,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-offset": [0, 1.4], "text-anchor": "top", "text-allow-overlap": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  add({ id: "links-label", type: "symbol", source: "links", filter: ["==", ["get", "part"], "label"], layout: { "text-field": ["get", "label"],
    "text-size": 11, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": ["case", ["==", ["get", "kind"], "pair"], "#a3502c", "#4a3a2e"], "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  add({ id: "ex-link-label", type: "symbol", source: "ex-link", filter: ["==", ["get", "part"], "label"], layout: { "text-field": ["get", "label"],
    "text-size": 11.5, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  lastPins = pinKey(); lastDyn = "";
  applyLayerVisibility();
}

/* The layer chips double as the legend. */
const LAYERS = [
  { key: "existing", label: "Today's office", sw: `<span class="dot" style="background:#2a1e16;box-shadow:inset 0 0 0 2.5px #2a1e16,inset 0 0 0 5px #fff"></span>`, ids: ["ex-pin", "ex-dot", "ex-label", "ex-link", "ex-link-label"] },
  { key: "sat", label: "Satellite", sw: `<span class="sw" style="height:9px;background:linear-gradient(135deg,#55603f,#9a9474 45%,#4b5660)"></span>` },
  { key: "zones", label: "Micro-markets", sw: `<span class="sw" style="height:9px;background:rgba(122,95,168,.18);border:1px dashed #7a5fa8"></span>`, ids: ["zones-fill", "zones-line", "zones-label"] },
  { key: "rail", label: "Metro", sw: `<span class="sw" style="background:linear-gradient(90deg,#2b6cb0 60%,#1aa3b8 60%)"></span>`, ids: ["rail-open", "rail-casing", "st-open", "st-label"] },
  { key: "links", label: "Distances", sw: `<span class="sw" style="background:repeating-linear-gradient(90deg,#4a3a2e 0 3px,transparent 3px 6px)"></span>`, ids: ["links", "links-label"] },
  { key: "bpo", label: "BPO employers", sw: `<span class="dot" style="background:${COL.bpo}"></span>` },
  { key: "edu", label: "Institutes", sw: `<span class="dot" style="background:${COL.edu}"></span>` },
  { key: "res", label: "Homes", sw: `<span class="dot" style="background:rgba(10,138,58,.22);border:1.5px solid #0a8a3a"></span>` },
  { key: "pg", label: "PG and co-living", sw: `<span class="dot" style="background:${COL.pg}"></span>` },
  { key: "rings", label: "2, 4, 8 km rings", sw: `<span class="dot" style="background:transparent;border:1.5px solid #a3502c"></span>`, ids: ["rings-fill", "rings-line", "rings-label"] }
];
const LAYER_HINT = {
  existing: "Digitide's current office in Sector 58, with a dashed line and the straight-line distance to the open building.",
  sat: "Mapbox satellite imagery with the streets and names on it, and no buildings drawn over the roofs. Off shows the plain map. The capture date varies by area.",
  zones: "The five micro-markets the 20 buildings sit in. Outlines are indicative.",
  rail: "The Blue Line's Noida stations and the Aqua Line at Sector 51, in each line's colour. Drawn station to station.",
  links: "Lines to the three nearest buildings from the open one, or the pair you picked on the distance matrix.",
  bpo: "BPO and BPM employers nearby: the experienced people Digitide can hire, and who it competes with for staff.",
  edu: "Institutes: the graduate pipeline.",
  res: "Residential belts where staff are likely to live.",
  pg: "PG and co-living operators: where new joiners from out of town stay.",
  rings: "2, 4 and 8 km straight-line rings around the open building."
};
let lastDyn = "";
function applyLayerVisibility() {
  if (!map || !map.getLayer("opt")) return;
  for (const l of LAYERS) for (const id of l.ids || []) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", S.layers[l.key] ? "visible" : "none");
  const kinds = KINDS.filter(k => S.layers[k]);
  for (const id of ["places", "places-label"]) if (map.getLayer(id)) map.setFilter(id, ["in", ["get", "kind"], ["literal", kinds]]);
  /* Lines and rings reload only when what they show has changed. */
  const key = [S.sel, (S.pair || []).join(","), S.layers.rings].join("|");
  if (key !== lastDyn) {
    lastDyn = key;
    const set = (src, data) => { const s = map.getSource(src); if (s) s.setData(data); };
    set("rings", ringFC()); set("ring-labels", ringLabelFC()); set("links", linkFC()); set("ex-link", exLinkFC());
  }
  recede();
}
/* With a building open, only its own context keeps full weight: stations
   within 2 km and places within 4 km. */
function recede() {
  if (!map || !map.getLayer("opt")) return;
  const o = S.sel && O.find(x => x.id === S.sel);
  const set = (id, prop, v) => { if (map.getLayer(id)) try { map.setPaintProperty(id, prop, v); } catch (e) {} };
  if (!o) {
    set("st-open", "circle-opacity", 1); set("st-open", "circle-stroke-opacity", 1); set("st-label", "text-opacity", 1);
    set("places", "circle-opacity", ["case", ["==", ["get", "kind"], "res"], .25, .92]); set("places", "circle-stroke-opacity", 1); set("places-label", "text-opacity", 1);
    set("zones-fill", "fill-opacity", .1); set("zones-label", "text-opacity", .8);
    return;
  }
  const nearSt = STATIONS.filter(s => km(o, s) <= 2).map(s => `${s.line}:${s.name}`);
  const nearPl = PL.filter(p => km(o, p) <= REACH_KM).map(p => p.id);
  const inSt = ["in", ["get", "key"], ["literal", nearSt]], inPl = ["in", ["get", "id"], ["literal", nearPl]];
  set("st-open", "circle-opacity", ["case", inSt, 1, .45]); set("st-open", "circle-stroke-opacity", ["case", inSt, 1, .45]);
  set("st-label", "text-opacity", ["case", inSt, 1, .35]);
  set("places", "circle-opacity", ["case", inPl, ["case", ["==", ["get", "kind"], "res"], .25, .92], .15]);
  set("places", "circle-stroke-opacity", ["case", inPl, 1, .25]); set("places-label", "text-opacity", ["case", inPl, 1, .25]);
  set("zones-fill", "fill-opacity", .04); set("zones-label", "text-opacity", .4);
}
/* Pins reload only when the selection, the picked pair or a filter
   changes, never on hover, so labels do not jump while the pointer moves. */
let lastPins = "";
const pinKey = () => [S.sel, (S.pair || []).join(","), [...S.filters].sort().join(",")].join("|");
function refreshPins(force) {
  if (!map || !map.getSource("options")) return;
  const key = pinKey();
  if (!force && key === lastPins) return;
  lastPins = key;
  map.getSource("options").setData(optionFC());
}
function refreshMap(force) {
  if (!map || !map.getSource("options")) return;
  refreshPins(force); applyLayerVisibility();
}
function setHover(id) {
  if (S.hov === id) return;
  const prev = S.hov; S.hov = id;
  if (!map || !map.getSource("options")) return;
  const fid = (x) => (O.find(o => o.id === x) || {}).n;
  try {
    if (prev && fid(prev) != null) map.setFeatureState({ source: "options", id: fid(prev) }, { hov: false });
    if (id && fid(id) != null) map.setFeatureState({ source: "options", id: fid(id) }, { hov: true });
  } catch (e) {}
}
function wireMap() {
  const pop = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
  const hover = (layer, html) => {
    map.on("mouseenter", layer, e => { map.getCanvas().style.cursor = "pointer"; const f = e.features[0]; pop.setLngLat(f.geometry.coordinates).setHTML(html(f.properties)).addTo(map); });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; pop.remove(); });
  };
  hover("opt", p => { const o = O.find(x => x.id === p.id), r = nearestSt(o);
    return `<div class="pop">${tile(o)}<div><b>${nn(o)} · ${esc(o.name)}</b><br>${tagHTML(o)} ${esc(o.sheetMicro)}<br>${fmtKm(exKm(o))} from today's office<br>${fmtM(r.d)} to ${esc(r.s.name)}</div></div>`; });
  hover("places", p => { const x = PL.find(y => y.id === p.id);
    return `<b>${esc(x.name)}</b>${x.sub ? `<br>${esc(x.sub)}` : ""}<br><span style="color:#6c5b4d">${KIND_WORD[x.kind] || ""}</span>`; });
  hover("st-open", p => `<b>${esc(p.name)}</b><br>${esc(p.line)} · open`);
  hover("ex-pin", () => { const r = nearestSt(EX), o = S.sel && O.find(x => x.id === S.sel);
    return `<b>${esc(EX.name)}</b><br>Today's office · ${esc(EX.locality)}<br>Nearest metro: ${esc(r.s.name)}, ${fmtM(r.d)}${o ? `<br>${fmtKm(exKm(o))} from ${esc(o.name)}` : ""}`; });
  map.on("click", "opt", e => select(e.features[0].properties.id, true));
  map.on("mousemove", "opt", e => { const id = e.features[0].properties.id; setHover(id === S.sel ? null : id); });
  map.on("mouseleave", "opt", () => setHover(null));
}

/* ============================================================ board ===== */
/* A satellite crop only where the building itself is pinned; a crop
   centred on a sector would show somebody else's roof. */
function satUrl(o, w, h, z, pin) {
  if (!window.MAPBOX_TOKEN || o.precision !== "building") return "";
  const p = pin ? `pin-s+a3502c(${o.lng},${o.lat})/` : "";
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${p}${o.lng},${o.lat},${z},0/${w}x${h}@2x?access_token=${encodeURIComponent(window.MAPBOX_TOKEN)}&attribution=false&logo=false`;
}
/* The tile is the sheet's photo of the building, in its verdict colour
   underneath in case the photo cannot load. */
function tile(o) {
  const src = o.thumb || o.photo;
  return `<span class="tile" style="--z:${vOf(o).color}" aria-hidden="true">${src ? `<img src="${MEDIA}${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}<span>${nn(o)}</span></span>`;
}
function renderFilters() {
  const all = [...OTHER_FILTERS.filter(f => f.key === "short"), ...ZONE_FILTERS, ...OTHER_FILTERS.filter(f => f.key !== "short")];
  $("#filters").innerHTML = all.map(f => `<button class="chip ${S.filters.has(f.key) ? "on" : ""}" data-f="${f.key}" type="button" aria-pressed="${S.filters.has(f.key)}" data-hint="${esc(f.hint)}">${ZONE[f.key] ? `<span class="dot" style="background:${ZONE[f.key].color};margin:0"></span>` : ""}${esc(f.label)}</button>`).join("");
}
function sorted() {
  const by = {
    picks: byPick,
    home: (a, b) => exKm(a) - exKm(b) || a.n - b.n,
    rail: (a, b) => nearestSt(a).d - nearestSt(b).d || a.n - b.n,
    plate: (a, b) => (b.plate || 0) - (a.plate || 0) || a.n - b.n,
    rent: (a, b) => (a.rentLo || 999) - (b.rentLo || 999) || a.n - b.n,
    sheet: (a, b) => (a.sheetNo || a.n) - (b.sheetNo || b.n)
  }[S.sort] || byPick;
  return O.slice().sort(by);
}
function renderList() {
  const shown = O.filter(passes);
  $("#b-count").textContent = `${shown.length} of ${O.length} buildings`;
  $("#b-sub").textContent = SORT_LABEL[S.sort] || "";
  $("#list").innerHTML = sorted().map(o => {
    const r = nearestSt(o);
    return `<button class="card ${S.sel === o.id ? "sel" : ""} ${passes(o) ? "" : "dim"} ${isShort(o) ? "sl" : ""}" data-id="${o.id}" role="listitem" type="button" data-hint="${esc(`Open ${o.name}: the map flies in and draws the line to today's office.`)}">
      ${tile(o)}
      <div>
        <div class="nm"><span class="no">${nn(o)}</span>${esc(o.name)}</div>
        <div class="loc">${tagHTML(o)} ${esc(o.sheetMicro)}${o.floorPlate ? ` · ${esc(o.floorPlate)} floors` : ""}</div>
        <div class="facts"><span title="Straight-line distance from today's office"><b>${fmtKm(exKm(o))}</b> from office</span><span title="Straight-line distance to the nearest metro station">${fmtM(r.d)} to metro</span>${o.rentLo ? `<span title="Quoted rent, INR per sq ft a month (sheet)">INR ${o.rentLo}</span>` : ""}${flagChip(o)}</div>
      </div>
    </button>`;
  }).join("");
}
function wireBoard() {
  $("#filters").addEventListener("click", e => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    const k = b.dataset.f; S.filters.has(k) ? S.filters.delete(k) : S.filters.add(k);
    renderFilters(); renderList(); refreshMap(); fitAll();
  });
  $("#sort").addEventListener("change", e => { S.sort = e.target.value; renderList(); });
  $("#list").addEventListener("click", e => { const c = e.target.closest("[data-id]"); if (c) select(c.dataset.id, true); });
  const hov = (id) => setHover(id && id !== S.sel ? id : null);
  $("#list").addEventListener("mouseover", e => { const c = e.target.closest("[data-id]"); if (c) hov(c.dataset.id); });
  $("#list").addEventListener("mouseleave", () => hov(null));
  $("#list").addEventListener("focusin", e => { const c = e.target.closest("[data-id]"); if (c) hov(c.dataset.id); });
  $("#list").addEventListener("focusout", () => hov(null));
  $("#tabs").addEventListener("click", e => {
    const t = e.target.closest("[data-t]"); if (!t) return;
    if (t.dataset.t === "compare") { openCompare(); return; }
    goTab(t.dataset.t);
  });
  $("#layers").addEventListener("click", e => {
    const b = e.target.closest("[data-l]"); if (!b) return;
    S.layers[b.dataset.l] = !S.layers[b.dataset.l]; renderLayers();
    if (b.dataset.l === "sat") setSatellite(); else applyLayerVisibility();
  });
  $("#p-body").addEventListener("click", e => {
    const ix = e.target.closest("[data-intro-x]"); if (ix) { seenIntro.add(ix.dataset.introX); saveIntro(); ix.closest(".intro").outerHTML = introCard(ix.dataset.introX); return; }
    const io = e.target.closest("[data-intro-open]"); if (io) { seenIntro.delete(io.dataset.introOpen); saveIntro(); io.outerHTML = introCard(io.dataset.introOpen); return; }
    const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); select(a.dataset.go, true); return; }
    const t = e.target.closest("[data-tab]"); if (t) { e.preventDefault(); goTab(t.dataset.tab); return; }
    const mx = e.target.closest("[data-mx]"); if (mx) { pickPair(mx.dataset.mx.split("|")); mx.classList.add("on"); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { copyLink(cp); return; }
    if (e.target.closest("[data-print]")) { window.print(); return; }
    if (e.target.closest("[data-compare]")) { openCompare(); return; }
    const img = e.target.closest(".gal img"); if (img) { const lb = $("#lightbox"); lb.querySelector("img").src = img.currentSrc || img.src; lb.classList.add("on"); }
  });
  $("#p-head").addEventListener("click", e => {
    if (e.target.closest(".back")) { S.sel = null; renderList(); renderPanel(); refreshMap(); fitAll(); pushRoute(); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { copyLink(cp); return; }
    const sh = e.target.closest("[data-shot]"); if (sh) { flyToOption(O.find(x => x.id === S.sel), sh.dataset.shot); return; }
    const t = e.target.closest("[data-tab]"); if (t) { e.preventDefault(); goTab(t.dataset.tab); return; }
    if (e.target.closest("[data-print]")) window.print();
  });
  $("#lightbox").addEventListener("click", () => $("#lightbox").classList.remove("on"));
  $("#cmp-x").addEventListener("click", () => $("#cmp").classList.remove("on"));
  addEventListener("keydown", e => { if (e.key === "Escape") { $("#cmp").classList.remove("on"); $("#lightbox").classList.remove("on"); } });
}

/* ---------------------------------------------------------- camera ------
   Gentle moves only: a short flight, at most 58 degrees of tilt, and no
   spin, so the map never lurches. */
const SHOT_ZOOM = { building: 16.8, street: 16.2, locality: 15 };
const SHOTS = {
  close: { label: "Close-up", hint: "Looking down onto the building and its streets." },
  street: { label: "Street", hint: "A lower angle, as you would approach it by road." },
  area: { label: "Surroundings", hint: "Top-down view of everything within 4 km." }
};
function flyToOption(o, shot) {
  if (!map || !o) return;
  S.shot = shot || "close";
  const phone = innerWidth <= 860, z = SHOT_ZOOM[o.precision] || 15, pad = padding();
  if (S.shot === "area") {
    const b = circle([o.lng, o.lat], REACH_KM, 16).reduce((bb, p) => bb.extend(p), new mapboxgl.LngLatBounds());
    map.fitBounds(b, { padding: pad, pitch: 0, bearing: 0, duration: REDUCED() ? 0 : 1000 });
  } else {
    const s = S.shot === "street" ? { zoom: z + .3, pitch: phone ? 50 : 58, bearing: -20 } : { zoom: z, pitch: phone ? 30 : 42, bearing: 0 };
    map.flyTo({ center: [o.lng, o.lat], ...s, padding: pad, duration: REDUCED() ? 0 : 1300, curve: 1.3, essential: true });
  }
  document.querySelectorAll("[data-shot]").forEach(b => { b.classList.toggle("on", b.dataset.shot === S.shot); b.setAttribute("aria-pressed", b.dataset.shot === S.shot); });
}
const PRECISION_TEXT = { building: "Pinned to the building", street: "Pinned to the street, building approximate", locality: "Sector only, exact plot not pinned" };
const shotBar = (o) => `<div class="shots" role="group" aria-label="Camera">${Object.entries(SHOTS).map(([k, v]) =>
  `<button type="button" class="shot ${S.shot === k ? "on" : ""}" data-shot="${k}" aria-pressed="${S.shot === k}" data-hint="${esc(v.hint)}">${v.label}</button>`).join("")}
  <span class="prec ${o.precision}" data-hint="How exactly this building is placed on the map">${PRECISION_TEXT[o.precision] || "Position approximate"}</span></div>`;

function select(id, fly, fromRoute) {
  if (document.body.classList.contains("fold-panel")) setFold("panel", false);
  setHover(null);
  S.sel = id; S.pair = null; if (fly) S.shot = "close"; renderList(); renderPanel(); refreshMap();
  if (!fromRoute) pushRoute();
  if (innerWidth <= 860 && !fromRoute) setSheet("half");
  const card = document.querySelector(`.card[data-id="${id}"]`); if (card) card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: REDUCED() ? "auto" : "smooth" });
  if (fly) flyToOption(O.find(x => x.id === id), "close");
  if (CMS && !fromRoute) CMS.open(id, (O.find(x => x.id === id) || {}).name);
  $("#p-body").scrollTop = 0;
}
function goTab(key) {
  if (document.body.classList.contains("fold-panel")) setFold("panel", false);
  const had = S.sel || S.pair; S.tab = key; S.sel = null; S.pair = null;
  if (CMS) CMS.tab(key);
  renderTabs(); renderList(); renderPanel(); refreshMap(); if (had) fitAll(); pushRoute();
  if (innerWidth <= 860) setSheet("half");
  $("#p-body").scrollTop = 0;
}
function renderTabs() {
  $("#tabs").innerHTML = TABS.map(t => `<button class="tab ${S.tab === t.key && !S.sel ? "on" : ""}" data-t="${t.key}" type="button" data-hint="${esc(GUIDE[t.key] ? GUIDE[t.key].hint : "")}">${esc(t.label)}</button>`).join("");
}
function renderLayers() {
  $("#layers").innerHTML = LAYERS.filter(l => cmsOn("layer:" + l.key)).map(l => `<button class="chip lay ${S.layers[l.key] ? "on" : ""}" data-l="${l.key}" type="button" aria-pressed="${S.layers[l.key]}" data-hint="${esc((S.layers[l.key] ? "Hide: " : "Show: ") + LAYER_HINT[l.key])}">${l.sw}${esc(l.label)}</button>`).join("") +
    `<span class="key note" title="Every distance on this page is a straight line between two pins">ⓘ km = straight line</span>`;
}

/* ============================================================ guide =====
   "What to expect" cards at the top of each view, and hover hints on
   anything clickable. Dismissed cards fold to a one-line link and the
   choice is remembered on this device. */
const GUIDE = {
  overview: { hint: "Autopilot's highlights, then all 20 buildings at a glance.",
    items: ["The three highlights come first, in Autopilot's order, then the option. Click one to open it.",
      "All 20 at a glance: every building with Autopilot's verdict, its distance from today's office, the nearest metro, floor plate and rent.",
      "Every distance is a straight line between pins, the shortest possible, never a road route."] },
  markets: { hint: "The five micro-markets: the sheet's rents and floor plates, pros and cons.",
    items: ["One card per micro-market, with the buildings that sit in it.",
      "Rents and floor plates are the sheet's quotes, not a market survey."] },
  connect: { hint: "The nearest metro station to every building.",
    items: ["The nearest Blue or Aqua Line station for every building, in a straight line, and how you get from it.",
      "What the sheet says about the metro is shown beside it."] },
  distance: { hint: "How far each building is from today's office and from each other.",
    items: ["First, every building's straight-line distance from today's office.",
      "Then the matrix of every building to every other. Click any cell and the map draws that pair.",
      "Straight lines are the shortest possible distance; a road trip is longer."] },
  talent: { hint: "Who is within reach: institutes, homes, BPO employers and PGs.",
    items: ["For each building: institutes, residential belts, BPO employers and PG operators within 4 km.",
      "Turn on BPO employers, Institutes, Homes and PG in the map bar to see them."] },
  conclusion: { hint: "Autopilot's recommendation and the shortlist side by side.",
    items: ["The first highlight and why, then the three highlights and the option side by side.",
      "Why each of the other buildings is not suitable, and what to check on site."] },
  compare: { hint: "All 20 buildings side by side." },
  option: { items: ["The map flies to the building and draws the line to today's office and to the three nearest buildings.",
      "Close-up, Street and Surroundings change the camera. The label beside them says how exactly the building is placed.",
      "Below: Autopilot's read, the sheet's figures, distances and who is within reach.",
      "Back returns to the section you came from."] }
};
let seenIntro = new Set();
try { seenIntro = new Set(JSON.parse(localStorage.getItem("noi-intro") || "[]")); } catch (e) {}
const saveIntro = () => { try { localStorage.setItem("noi-intro", JSON.stringify([...seenIntro])); } catch (e) {} };
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
    if (!el.isConnected) return;
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
    hide(); if (!el || !el.dataset.hint) return;
    cur = el; timer = setTimeout(() => show(el), 380);
  });
  document.addEventListener("focusin", e => { const el = e.target.closest("[data-hint]"); if (el && el.dataset.hint && el.matches(":focus-visible")) { cur = el; show(el); } });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", hide);
  addEventListener("scroll", hide, true);
}

/* ============================================================ panel ===== */
function renderPanel() {
  renderTabs();
  if (S.sel) renderOption(O.find(x => x.id === S.sel));
  else ({ overview: renderOverview, markets: renderMarkets, connect: renderConnect, distance: renderDistance, talent: renderTalent, conclusion: renderConclusion }[S.tab] || renderOverview)();
  $("#p-body").insertAdjacentHTML("afterbegin", introCard(S.sel ? "option" : S.tab));
}
const head = (eyebrow, title, lede) => { $("#p-head").innerHTML = `<div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${lede ? `<div class="lede">${lede}</div>` : ""}`; };
const factList = (arr) => (arr || []).length ? `<ul class="facts">${arr.map(f => `<li class="fact"><span class="k">${esc(f.k)}.</span> ${esc(f.v)}<span class="conf ${esc(f.conf)}">${esc(f.conf)}</span>
  <div class="meta">${esc(f.asOf)}${f.note ? " · " + esc(f.note) : ""}${f.src ? " · " + cite(f.src) : ""}</div></li>`).join("")}</ul>` : `<p class="note">No sourced figure yet.</p>`;
const optLink = (o) => `<a href="#" data-go="${o.id}">${nn(o)} ${esc(o.name)}</a>`;
const optLinkLight = (o) => `<a href="#" data-go="${o.id}">${esc(o.name)}</a>`;
/* "Check first" notes: things to confirm before relying on a building. */
const flagBox = (o) => o.flag ? `<div class="flag"><b>Check first</b>${esc(o.flag.v)} ${cite(o.flag.src)}</div>` : "";
/* Updates from broker links, approved and published in /admin/. */
const marketHTML = (o) => o.cmsExtra && o.cmsExtra.length ? `<h3>Latest from the market</h3><table class="spec">${o.cmsExtra.map(x => `<tr><th>${esc(x.label)}</th><td>${esc(x.value)}${x.by || x.asOf ? ` <span class="src">· broker-stated${x.asOf ? ", " + esc(x.asOf) : ""}</span>` : ""}</td></tr>`).join("")}</table>` : "";
const flagChip = (o) => o.flag ? `<span class="chk" title="${esc(o.flag.v)}">check first</span>` : "";
const actions = (extra = "") => `<div class="actions">${extra}<button type="button" class="act" data-copy data-hint="Copies a link that opens exactly this view, ready to send to a client.">Copy link</button><button type="button" class="act" data-print data-hint="Prints this view, or saves it as a PDF from the print dialog.">Print / PDF</button></div>`;
const zoneTag = (z) => z ? `<span class="zt" style="--z:${z.color}"><i></i>${esc(z.label)}</span>` : "";
const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const kSqft = (o) => o.plate ? `${(o.plate / 1000).toFixed(o.plate % 1000 ? 1 : 0)}k` : "-";
const readBox = (o) => o.verdictNote ? `<div class="read ${vOf(o).cls}"><div class="rh">${tagHTML(o)}<b>Autopilot's read</b></div><p>${esc(o.verdictNote)}</p></div>` : "";

/* ---------- Overview ---------- */
function pickCard(o) {
  const r = nearestSt(o), src = o.thumb || o.photo;
  return `<button type="button" class="pk ${vOf(o).cls}" data-go="${o.id}" data-hint="${esc(`Open ${o.name}: the map flies in and draws the line to today's office.`)}">
    ${src ? `<span class="pk-img"><img src="${MEDIA}${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.remove()"></span>` : ""}
    <span class="pk-b"><span class="pk-t">${tagHTML(o)}<span class="note">${esc(o.sheetMicro)}</span></span>
      <span class="pk-n">${esc(o.name)}</span>
      <span class="pk-r">${esc(o.verdictNote || "")}</span>
      <span class="pk-f"><span><b>${fmtKm(exKm(o))}</b> from today's office</span><span><b>${fmtM(r.d)}</b> to ${esc(r.s.name.replace(/^Noida /, ""))} metro</span>${o.floorPlate ? `<span><b>${esc(o.floorPlate.replace(/ sq ft$/, ""))}</b> sq ft floors</span>` : ""}${o.rentLo ? `<span><b>INR ${o.rentLo}</b> a sq ft</span>` : ""}</span>
    </span></button>`;
}
function glanceTable() {
  const rows = O.slice().sort(byPick).map(o => {
    const r = nearestSt(o);
    return `<tr class="${isShort(o) ? "sl" : ""} ${passes(o) ? "" : "dim"}" data-go="${o.id}"><td class="mono">${nn(o)}</td>
      <td><a href="#" data-go="${o.id}">${esc(short(o))}</a><br><span class="note">${esc(o.sheetMicro)}</span></td>
      <td>${tagHTML(o)}</td>
      <td class="num"><b>${fmtKm(exKm(o))}</b></td>
      <td class="num">${fmtM(r.d)}<br><span class="note">${esc(r.s.name.replace(/^Noida /, ""))}</span></td>
      <td class="num">${kSqft(o)}</td>
      <td class="num">${o.rentLo || "-"}</td></tr>`;
  }).join("");
  return `<div class="gl-wrap"><table class="gl"><thead><tr><th>#</th><th>Building</th><th>Autopilot</th><th class="num">From office</th><th class="num">Metro</th><th class="num">Floor</th><th class="num">Rent</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">From office and Metro are straight-line distances. Floor is the floor plate in thousand sq ft and Rent is INR per sq ft a month, both from the sheet; where the sheet quotes two rents the lower is shown. Click a row to open it.</p>`;
}
function renderOverview() {
  const homes = O.map(exKm), near = O.filter(o => nearestSt(o).d <= 1);
  head("Autopilot · Noida · Oct 2026", "Where Digitide's next Noida office should go",
    `${O.length} buildings in Sectors 57 to 67, screened by Autopilot and read against today's office at ${esc(EX.locality)}, the Blue Line and the talent nearby.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act pri" data-tab="conclusion">See the recommendation</button>`));
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">Autopilot's highlights</h3>
    <div class="picks">${HIGH.map(pickCard).join("") || `<p class="note">No highlights published.</p>`}</div>
    ${OPTS.length ? `<h3>Also an option</h3><div class="picks">${OPTS.map(pickCard).join("")}</div>` : ""}
    <h3>All ${O.length} at a glance</h3>
    ${glanceTable()}
    <h3>Within the shortlist</h3>
    ${insightsHTML()}
    <div class="kpis">
      <div class="kpi"><div class="l">Buildings</div><div class="v">${O.length}</div><div class="s">in ${Z.length} micro-markets</div></div>
      <div class="kpi"><div class="l">Shortlisted</div><div class="v">${SHORT.length}</div><div class="s">${HIGH.length} highlights${OPTS.length ? ` and ${OPTS.length} option` : ""}</div></div>
      <div class="kpi"><div class="l">Metro ≤ 1 km</div><div class="v">${near.length}</div><div class="s">straight line to a station</div></div>
      <div class="kpi"><div class="l">From today's office</div><div class="v" style="font-size:16px">${fmtKm(Math.min(...homes))} to ${fmtKm(Math.max(...homes))}</div><div class="s">median ${fmtKm(median(homes))}</div></div>
      <div class="kpi"><div class="l">BPO employers</div><div class="v">${PL.filter(p => p.kind === "bpo").length}</div><div class="s">mapped nearby</div></div>
      <div class="kpi"><div class="l">Talent points</div><div class="v">${PL.filter(p => p.kind === "edu" || p.kind === "res").length}</div><div class="s">institutes and belts</div></div>
    </div>
    <h3>The micro-markets in one line each</h3>
    ${Z.map(z => { const os = O.filter(o => o.micro === z.key).sort(byPick);
      return `<div class="fact">${zoneTag(z)} <span class="k">${esc(z.name)}</span> <span class="note">· ${os.length} building${os.length === 1 ? "" : "s"}</span><br><span class="note">${esc(z.character)}</span><br>${os.map(o => `${optLinkLight(o)}${isShort(o) ? " " + tagHTML(o) : ""}`).join(" · ")}</div>`; }).join("")}
    <h3>How to read this study</h3>
    <p class="note">The 20 buildings, their figures and Autopilot's reason for each come from the property sheet (Oct 2026); figures are broker-stated. The order and the verdicts are Autopilot's. Positions, metro, talent and employers come from the public sources linked beside each one. ${esc(METHOD)}</p>`;
}
function insightsHTML() {
  if (!SHORT.length) return "";
  const top = (f) => SHORT.slice().sort((a, b) => f(b) - f(a) || a.n - b.n)[0];
  const home = top(o => -exKm(o)), rail = top(o => -nearestSt(o).d), plate = top(o => o.plate || 0);
  const rent = top(o => -(o.rentLo || 999)), bpo = top(o => upTo(catchOf(o), REACH, "bpo") - exKm(o) / 100);
  const rr = nearestSt(rail), lead = HIGH[0];
  const cards = [];
  if (lead) cards.push({ l: "Autopilot's first choice", v: short(lead), s: lead.sheetMicro, go: lead.id, tone: "lead" });
  cards.push(
    { l: "Closest to today's office", v: fmtKm(exKm(home)), s: `${short(home)}, straight line`, go: home.id },
    { l: "Closest to the metro", v: fmtM(rr.d), s: `${short(rail)}, to ${rr.s.name}`, go: rail.id },
    { l: "Largest floor plate", v: plate.floorPlate || "-", s: short(plate), go: plate.id },
    { l: "Lowest quoted rent", v: rent.rentLo ? `INR ${rent.rentLo}` : "-", s: `${short(rent)}, a sq ft a month`, go: rent.id },
    { l: "Most BPO employers nearby", v: short(bpo), s: `${upTo(catchOf(bpo), REACH, "bpo")} within ${REACH_KM} km`, go: bpo.id });
  return `<div class="ins" role="list">${cards.map(c => `<button type="button" role="listitem" class="in ${c.tone || ""}" data-go="${c.go}" data-hint="Open this building: the map flies in and its details open.">
    <span class="l">${esc(c.l)}</span><span class="v">${esc(c.v)}</span><span class="s">${esc(c.s)}</span></button>`).join("")}</div>`;
}
/* Measured strengths and gaps, shown under the name. */
function verdictHTML(o) {
  const r = nearestSt(o), up = [], dn = [];
  if (exKm(o) <= 2) up.push(`${fmtKm(exKm(o))} from today's office`); else if (exKm(o) > 4) dn.push(`${fmtKm(exKm(o))} from today's office`);
  if (r.d <= 1) up.push("Metro on foot"); else if (r.d > 2) dn.push(`Metro ${fmtKm(r.d)} away`);
  if (o.plate >= 20000) up.push("Large floors"); else if (o.plate && o.plate < 10000) dn.push("Small floors");
  if (o.precision !== "building") dn.push("Plot not pinned");
  return `<div class="verdict">${tagHTML(o)}${up.map(g => `<span class="vd up">✓ ${esc(g)}</span>`).join("")}${dn.map(w => `<span class="vd dn">! ${esc(w)}</span>`).join("")}</div>`;
}

/* ---------- Micro-markets ---------- */
const figure = (f) => f && f.v ? `<span>${esc(f.v)}${f.conf === "low" ? `<span class="conf low">low</span>` : ""}<span class="src" style="display:block;margin-top:2px">${esc(f.asOf || "")}${f.src ? " · " + cite(f.src) : ""}</span></span>` : `<span class="note">Not on the sheet</span>`;
function renderMarkets() {
  head("Micro-market overview", `${Z.length} micro-markets, ${O.length} buildings`, "What each part of Sectors 57 to 67 is like for Digitide, what the sheet quotes there and who is already nearby.");
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">The micro-markets</h3>
    ${Z.map(z => { const os = O.filter(o => o.micro === z.key).sort(byPick);
      return `<div class="zc" style="--z:${z.color}">
        <div class="zh"><b>${esc(z.name)}</b>${zoneTag(z)}<span class="note">${os.length} building${os.length === 1 ? "" : "s"}</span></div>
        <div class="note">${esc(z.character)}</div>
        <div class="zk"><div><span class="l">Rent</span>${figure(z.rent)}</div><div><span class="l">Floors</span>${figure(z.plates)}</div></div>
        ${z.occupiers && z.occupiers.v ? `<div class="note"><b style="color:var(--ink)">Employers nearby:</b> ${esc(z.occupiers.v)} ${cite(z.occupiers.src)}</div>` : ""}
        <div class="pc"><div class="pro"><h4>For Digitide</h4><ul>${(z.pros || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div class="con"><h4>Watch</h4><ul>${(z.cons || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
        <div class="note" style="margin-top:8px">Buildings here: ${os.map(o => `${optLinkLight(o)} ${tagHTML(o)}`).join(" · ")}</div>
      </div>`; }).join("")}
    <p class="note">Rents and floor plates are the quotes on the property sheet for the buildings in each micro-market, not a market survey. Outlines on the map are indicative.</p>
    <h3>From the property sheet</h3>
    ${factList(F.market)}`;
}

/* ---------- Connectivity ---------- */
function renderConnect() {
  head("Connectivity", "How people get to each building", `The nearest metro station to every building, as a straight line from the pin. Network as of ${esc(TR.asOfText || TR.asOf)}.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const rows = O.slice().sort((a, b) => nearestSt(a).d - nearestSt(b).d || a.n - b.n).map(o => {
    const r = nearestSt(o);
    return `<tr class="${isShort(o) ? "sl" : ""}"><td>${optLink(o)}<br>${tagHTML(o)}</td>
      <td><b class="num">${fmtM(r.d)}</b> to ${esc(r.s.name)}<br><span class="note">${esc(r.s.lineName)} · ${esc(accessWord(r.d))}</span></td>
      <td class="note">${o.sheetMetro ? esc(o.sheetMetro) : "-"}</td></tr>`;
  }).join("");
  const ex = nearestSt(EX);
  const lines = LINES.map(L => `<div class="fact"><span class="sw" style="background:${L.color}"></span><span class="k">${esc(L.name)}</span> <span class="note">· ${L.stations.length} station${L.stations.length === 1 ? "" : "s"} shown, open</span>${L.note ? `<br><span class="note">${esc(L.note)}</span>` : ""}${L.src ? ` <span class="src">${cite(L.src)}</span>` : ""}</div>`).join("");
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">Nearest station for each building</h3>
    <table class="ring-tbl"><thead><tr><th style="width:34%">Building</th><th>Nearest metro (straight line)</th><th>On the sheet</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Straight-line distance from the pin to the station: the shortest possible, so a walk or ride is a little longer. Walk time at 80 m a minute where it is under 1.2 km. The sheet's own figure, where it gives one, is beside it. Buildings pinned only to their sector are approximate.</p>
    <h3>From today's office</h3>
    <p class="vsx">${esc(EX.name)} is ${fmtM(ex.d)} from ${esc(ex.s.name)} (${esc(ex.s.lineName)}), ${esc(accessWord(ex.d))}.</p>
    <h3>The network</h3>
    ${lines}
    <h3>What to know</h3>
    ${factList(F.transit)}`;
}

/* ---------- Distances ---------- */
const MX_ORDER = () => Z.flatMap(z => O.filter(o => o.micro === z.key).sort(byPick));
function mxColor(d, max) {
  const t = Math.min(1, d / max), a = [163, 80, 44], b = [233, 180, 143], c = [246, 241, 234];
  const mix = (x, y, k) => x.map((v, i) => Math.round(v + (y[i] - v) * k));
  const rgb = t < .5 ? mix(a, b, t / .5) : mix(b, c, (t - .5) / .5);
  return { bg: `rgb(${rgb.join(",")})`, fg: t < .32 ? "#fff" : "#2a1e16" };
}
function pickPair(ids) {
  S.pair = ids; S.sel = null;
  refreshMap();
  const [a, b] = ids.map(id => id === EX.id ? EX : O.find(o => o.id === id));
  const box = $("#mx-pick");
  if (box) { const d = km(a, b); box.innerHTML = `<b>${esc(a.name)}</b> to <b>${esc(b.name)}</b>: ${fmtKm(d)} in a straight line. <span class="note">Drawn on the map.</span>`; }
  document.querySelectorAll("table.mx td.on").forEach(td => td.classList.remove("on"));
  if (map) fitPoints([[a.lng, a.lat], [b.lng, b.lat]], { maxZoom: 15 });
  if (innerWidth <= 860) setSheet("peek");
}
function homeBars(list) {
  const max = Math.max(...O.map(exKm));
  return `<div class="nb">${list.map(o => `<div class="r"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${optLink(o)}</span><div class="tr"><div class="fl ${vOf(o).cls}" style="width:${Math.max(3, Math.round(exKm(o) / max * 100))}%"></div></div><span class="v">${fmtKm(exKm(o))}</span></div>`).join("")}</div>`;
}
function renderDistance() {
  head("Distances", "How far each building is", `From today's office at ${esc(EX.locality)}, and from each other. Every figure is a straight line between the pins: the shortest possible distance, never a road route.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const list = MX_ORDER(), all = [EX, ...list];
  let max = 0;
  const pairs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const d = km(list[i], list[j]); max = Math.max(max, d); pairs.push({ a: list[i], b: list[j], d }); }
  for (const o of list) max = Math.max(max, exKm(o));
  pairs.sort((x, y) => x.d - y.d);
  const far = pairs[pairs.length - 1];
  const lab = (o) => o === EX ? "Now" : nn(o);
  const cell = (r, c) => {
    if (r === c) return `<td class="self">·</td>`;
    const d = km(r, c), col = mxColor(d, max);
    return `<td data-mx="${r.id}|${c.id}" style="background:${col.bg};color:${col.fg}" title="${esc(r.name)} to ${esc(c.name)}: ${fmtKm(d)} straight line">${d.toFixed(1)}</td>`;
  };
  const table = `<div class="mx-wrap"><table class="mx"><thead><tr><th></th>${all.map(c => `<th title="${esc(c.name)}" class="${c !== EX && isShort(c) ? "hl" : ""}" style="${c === EX ? "" : `box-shadow:inset 0 -3px 0 ${ZONE[c.micro].color}`}">${lab(c)}</th>`).join("")}</tr></thead>
    <tbody>${all.map(r => `<tr class="${r === EX ? "ex" : isShort(r) ? "hl" : ""}"><th title="${esc(r.name)}">${r === EX ? `Today · ${esc(EX.name)}` : `${nn(r)} ${esc(short(r))}`}</th>${all.map(c => cell(r, c)).join("")}</tr>`).join("")}</tbody></table></div>`;
  /* Clusters: buildings within 1 km of another, chained. */
  const groups = [], seen = new Set();
  for (const o of list) {
    if (seen.has(o.id)) continue;
    const g = [o]; seen.add(o.id);
    for (let k = 0; k < g.length; k++) for (const x of list) if (!seen.has(x.id) && km(g[k], x) <= 1) { g.push(x); seen.add(x.id); }
    groups.push(g);
  }
  const clusters = groups.filter(g => g.length > 1).sort((a, b) => b.length - a.length);
  const lone = groups.filter(g => g.length === 1).map(g => g[0]);
  const spread = (g) => { let m = 0; for (const a of g) for (const b of g) m = Math.max(m, km(a, b)); return m; };
  const closestShort = SHORT.slice().sort((a, b) => exKm(a) - exKm(b))[0];
  $("#p-body").innerHTML = `
    <div class="kpis" style="margin-top:14px">
      <div class="kpi"><div class="l">Shortlist nearest today</div><div class="v">${closestShort ? fmtKm(exKm(closestShort)) : "-"}</div><div class="s">${closestShort ? esc(closestShort.name) : ""}</div></div>
      <div class="kpi"><div class="l">Farthest pair</div><div class="v">${fmtKm(far.d)}</div><div class="s">${esc(short(far.a))} and ${esc(short(far.b))}</div></div>
      <div class="kpi"><div class="l">Clusters</div><div class="v">${clusters.length}</div><div class="s">groups within 1 km of each other</div></div>
    </div>
    <h3>From today's office: the shortlist</h3>
    ${homeBars(SHORT)}
    <h3>From today's office: all ${O.length}, nearest first</h3>
    ${homeBars(O.slice().sort((a, b) => exKm(a) - exKm(b)))}
    <h3>Every building to every other</h3>
    <div class="mx-leg"><span>Near</span><span class="ramp"></span><span>Far (${fmtKm(max)})</span><span style="margin-left:auto">km, ordered by micro-market</span></div>
    <div id="mx-pick" class="mx-pick">Click any cell to draw that pair on the map.</div>
    ${table}
    <h3>Clusters</h3>
    ${clusters.map(g => `<div class="fact">${zoneTag(ZONE[g[0].micro])} <span class="k">${g.length} buildings within ${fmtKm(spread(g))} of each other</span><br>${g.map(optLink).join(" · ")}</div>`).join("")}
    ${lone.length ? `<div class="fact"><span class="k">Stand-alone</span> <span class="note">(no other building within 1 km)</span><br>${lone.map(optLink).join(" · ")}</div>` : ""}
    <p class="note" style="margin-top:8px">${esc(METHOD)} Buildings pinned only to their sector (marked on each card) are approximate.</p>`;
}

/* ---------- Talent ---------- */
function renderTalent() {
  head("Talent", "Who is within reach", `Institutes, residential belts, BPO and BPM employers and PG operators within ${REACH_KM} km of each building, in a straight line. The employers are the experienced pool Digitide can hire from, and compete with.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const rows = O.slice().sort(byPick).map(o => {
    const c = catchOf(o), nb = nearestOf(o, "bpo");
    return `<tr class="${isShort(o) ? "sl" : ""}"><td>${optLink(o)}</td><td class="num">${upTo(c, REACH, "edu")}</td><td class="num">${upTo(c, REACH, "res")}</td><td class="num"><b>${upTo(c, REACH, "bpo")}</b></td><td class="num">${upTo(c, REACH, "pg")}</td><td>${nb ? `${esc(nb.s.name)}<br><span class="note">${fmtKm(nb.d)}</span>` : "-"}</td></tr>`;
  }).join("");
  const ex = catchOf(EX);
  const listOf = (kind, dotVar) => PL.filter(p => p.kind === kind).map(p => `<div class="fact"><span class="dot" style="background:var(${dotVar})"></span><span class="k">${esc(p.name)}</span> <span class="note">${esc(p.sub || "")}</span><br><span class="note">${esc(p.note)} ${p.src ? cite(p.src) : ""}</span></div>`).join("") || `<p class="note">None mapped.</p>`;
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">Within ${REACH_KM} km of each building</h3>
    <table class="ring-tbl"><thead><tr><th>Building</th><th class="num">Institutes</th><th class="num">Homes</th><th class="num">BPO employers</th><th class="num">PGs</th><th>Nearest BPO employer</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">For comparison, today's office has ${upTo(ex, REACH, "edu")} institutes, ${upTo(ex, REACH, "res")} residential belts, ${upTo(ex, REACH, "bpo")} BPO employers and ${upTo(ex, REACH, "pg")} PG operators within ${REACH_KM} km. Positions of belts and some places are sector-level and approximate.</p>
    <h3>The talent market</h3>
    ${factList(F.talent)}
    <h3>BPO and BPM employers nearby</h3>
    ${listOf("bpo", "--bpo")}
    <h3>Institutes</h3>
    ${listOf("edu", "--edu")}
    <h3>Residential belts</h3>
    ${listOf("res", "--res")}
    <h3>PG and co-living</h3>
    ${listOf("pg", "--pg")}`;
}

/* ---------- Conclusion ---------- */
const SPEC_ROWS = [
  ["Autopilot", o => tagHTML(o)],
  ["Sector", o => esc(o.sheetMicro)],
  ["From today's office", o => `<b>${fmtKm(exKm(o))}</b> straight line`, o => -exKm(o)],
  ["Nearest metro", o => { const r = nearestSt(o); return `${fmtM(r.d)} to ${esc(r.s.name)}`; }, o => -nearestSt(o).d],
  ["Floor plate", o => esc(o.floorPlate || "-"), o => o.plate || 0],
  ["Floors", o => esc(o.floorsTotal || "-")],
  ["Building area", o => esc(o.buildingArea || "-")],
  ["Area offered", o => esc([o.offeredArea, o.floorOffered].filter(Boolean).join(", ") || "-")],
  ["Condition", o => esc(o.condition || "-")],
  ["Quoted rent", o => esc(o.rent || "-"), o => -(o.rentLo || 999)],
  ["Maintenance (CAM)", o => esc(o.cam || "-")],
  ["Handover", o => esc(o.handover || "-")],
  ["Parking", o => esc(o.parking || "-")],
  [`BPO employers ≤ ${REACH_KM} km`, o => String(upTo(catchOf(o), REACH, "bpo")), o => upTo(catchOf(o), REACH, "bpo")],
  ["Map position", o => esc(PRECISION_TEXT[o.precision] || o.precision)]
];
function specTable(list, cls) {
  const best = (fn) => { if (!fn) return () => false; const v = list.map(fn); const t = Math.max(...v); return (o) => list.length > 1 && fn(o) === t; };
  return `<div style="overflow:auto"><table class="${cls}"><thead><tr><th></th>${list.map(o => `<th data-open="${o.id}"><a href="#" data-go="${o.id}">${nn(o)} ${esc(short(o))}</a></th>`).join("")}</tr></thead>
    <tbody>${SPEC_ROWS.map(([l, fn, b]) => { const isBest = best(b); return `<tr><th>${esc(l)}</th>${list.map(o => `<td class="${isBest(o) ? "best" : ""}">${fn(o)}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div>`;
}
function renderConclusion() {
  const lead = HIGH[0];
  if (!lead) { head("Conclusion", "No highlights published", ""); $("#p-body").innerHTML = `<p class="note">Autopilot's highlights are not published for this study yet.</p>`; return; }
  const r = nearestSt(lead), c = catchOf(lead), others = HIGH.slice(1);
  head("Conclusion", `Autopilot recommends ${esc(short(lead))}${others.length ? `, then ${esc(listJoin(others.map(short)))}` : ""}`,
    `Three highlights in order${OPTS.length ? ` and ${OPTS.length === 1 ? "one option" : OPTS.length + " options"}` : ""}, out of ${O.length} buildings. Below: why, the shortlist side by side, why the rest fall away and what to check before signing.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act" data-compare>Compare all ${O.length}</button>`));
  const stay = SHORT.slice().sort((a, b) => exKm(a) - exKm(b))[0];
  $("#p-body").innerHTML = `
    <div class="verd" style="margin-top:14px">
      <div class="l">Highlight 1 · Autopilot's first choice</div>
      <div class="h">${esc(lead.name)}, ${esc(lead.sheetMicro)}</div>
      <p>${esc(lead.verdictNote || "")}</p>
      <p>${fmtKm(exKm(lead))} from today's office in a straight line, ${fmtM(r.d)} to ${esc(r.s.name)} (${esc(accessWord(r.d))}). ${lead.floorPlate ? `${esc(lead.floorPlate)} floor plates` : ""}${lead.buildingArea ? `, ${esc(lead.buildingArea)} in all` : ""}${lead.rent ? `; ${esc(lead.rent)}` : ""}. Within ${REACH_KM} km: ${upTo(c, REACH, "bpo")} BPO employers, ${upTo(c, REACH, "edu")} institutes and ${upTo(c, REACH, "res")} residential belts.</p>
      ${lead.flag ? `<p class="vchk"><b>Check first.</b> ${esc(lead.flag.v)}${others[0] ? ` If it slips, the next highlight is ${optLinkLight(others[0])}.` : ""}</p>` : ""}
    </div>
    ${others.map(o => { const rr = nearestSt(o); return `<div class="nxt ${vOf(o).cls}"><div class="rh">${tagHTML(o)}<b>${optLinkLight(o)}</b><span class="note">${esc(o.sheetMicro)}</span></div>
      <p>${esc(o.verdictNote || "")}</p><p class="note">${fmtKm(exKm(o))} from today's office · ${fmtM(rr.d)} to ${esc(rr.s.name)}${o.floorPlate ? ` · ${esc(o.floorPlate)} floors` : ""}${o.rentLo ? ` · INR ${o.rentLo} a sq ft` : ""}</p>${o.flag ? `<p class="note"><b>Check first:</b> ${esc(o.flag.v)}</p>` : ""}</div>`; }).join("")}
    ${OPTS.map(o => `<div class="nxt op"><div class="rh">${tagHTML(o)}<b>${optLinkLight(o)}</b><span class="note">${esc(o.sheetMicro)}</span></div><p>${esc(o.verdictNote || "")}</p>${o.flag ? `<p class="note"><b>Check first:</b> ${esc(o.flag.v)}</p>` : ""}</div>`).join("")}
    <h3>The shortlist side by side</h3>
    ${specTable(SHORT, "cmp sm")}
    <p class="note">Shaded cells are the best value in the row. Figures are from the sheet; distances are straight lines.</p>
    <h3>The trade-off in one line</h3>
    <p class="vsx">${stay && stay.id !== lead.id
      ? `${esc(stay.name)} is the shortlisted building closest to today's office (${fmtKm(exKm(stay))}). ${esc(lead.name)} is ${fmtKm(exKm(lead))} away, in exchange for ${esc(gainsOver(lead, stay))}.`
      : `${esc(lead.name)} is also the shortlisted building closest to today's office, so there is no trade-off between keeping the team's commute and the building.`}</p>
    <h3>Why the other ${REST.length} are not suitable</h3>
    <div class="why">${REST.map(o => `<div class="fact"><span class="k">${optLinkLight(o)}</span> <span class="note">${esc(o.sheetMicro)} · ${fmtKm(exKm(o))} from today's office</span><br>${esc(o.verdictNote || "")}</div>`).join("")}</div>
    <h3>Before signing: what to check</h3>
    <ol class="steps">${(M.nextSteps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ol>`;
}
function gainsOver(a, b) {
  const out = [];
  if ((a.plate || 0) > (b.plate || 0) * 1.15) out.push(`larger floors (${a.floorPlate} against ${b.floorPlate})`);
  if (a.rentLo && b.rentLo && a.rentLo < b.rentLo) out.push(`a lower quoted rent (INR ${a.rentLo} against ${b.rentLo} a sq ft)`);
  const ra = nearestSt(a), rb = nearestSt(b);
  if (ra.d + .2 < rb.d) out.push(`a closer metro (${fmtM(ra.d)} against ${fmtM(rb.d)})`);
  const ba = upTo(catchOf(a), REACH, "bpo"), bb = upTo(catchOf(b), REACH, "bpo");
  if (ba > bb) out.push(`more BPO employers nearby (${ba} against ${bb})`);
  return out.length ? listJoin(out) : "what Autopilot's read above sets out";
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

/* ------------------------------------------------ resizable panes ------- */
const PANE = { board: { v: "--board-w", min: 260, max: 520, def: 340 }, panel: { v: "--panel-w", min: 400, max: 860, def: 540 } };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
function setPaneW(k, px, save = true) {
  const c = PANE[k], w = Math.round(Math.min(c.max, Math.max(c.min, px), innerWidth * .45));
  document.documentElement.style.setProperty(c.v, w + "px");
  if (save) store.set("noi-w-" + k, String(w));
}
function setFold(k, on) {
  document.body.classList.toggle("fold-" + k, on);
  store.set("noi-fold-" + k, on ? "1" : "");
  const pane = document.getElementById(k);
  if (on && pane.contains(document.activeElement)) document.querySelector(`.reopen-${k}`).focus();
  clearTimeout(setFold.t);
  setFold.t = setTimeout(() => { if (!map) return; if (S.sel) flyToOption(O.find(x => x.id === S.sel), S.shot); else fitAll(); }, 320);
}
function wirePanes() {
  for (const k of ["board", "panel"]) {
    const v = Number(store.get("noi-w-" + k)); if (v) setPaneW(k, v, false);
    if (store.get("noi-fold-" + k) === "1" && innerWidth > 860) setFold(k, true);
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

/* ---------- Building ---------- */
const SHEET_FIELDS = [
  ["Floors", "floorsTotal"], ["Floor plate", "floorPlate"], ["Building area", "buildingArea"], ["Area offered", "offeredArea"],
  ["Floors offered", "floorOffered"], ["Layout", "layout"], ["Condition", "condition"], ["Handover", "handover"],
  ["Quoted rent", "rent"], ["Maintenance (CAM)", "cam"], ["Parking", "parking"], ["Power backup", "powerBackup"],
  ["Last occupier", "lastOccupier"], ["Vacated", "vacatedSince"], ["Metro, per the sheet", "sheetMetro"]
];
function renderOption(o) {
  const z = ZONE[o.micro], c = catchOf(o), r = nearestSt(o);
  const backTo = TABS.find(t => t.key === S.tab) || TABS[0];
  $("#p-head").innerHTML = `<button class="back" type="button">← Back to ${esc(backTo.label)}</button>
    <div class="eyebrow">${nn(o)} · ${esc(vOf(o).word(o))} · ${esc(o.sheetMicro)}</div>
    <h2>${esc(o.name)}</h2>${verdictHTML(o)}${shotBar(o)}${actions()}`;
  const sat = satUrl(o, 600, 330, 17, true);
  const gal = [
    o.photo ? `<figure class="g"><img src="${MEDIA}${esc(o.photo)}" alt="${esc(o.name)}, from the property sheet" onerror="this.closest('figure').remove()"><figcaption>${o.photoRender ? "Render from the sheet" : "Photo from the sheet"}</figcaption></figure>` : "",
    sat ? `<figure class="g"><img src="${sat}" alt="Satellite view of ${esc(o.name)}" loading="lazy" onerror="this.closest('figure').remove()"><figcaption>Satellite · © Mapbox © Maxar</figcaption></figure>` : ""
  ].filter(Boolean);
  const others = O.filter(x => x.id !== o.id).map(x => ({ x, d: km(o, x) })).sort((a, b) => a.d - b.d);
  const nbMax = others.length ? others[others.length - 1].d : 1;
  const ringRows = c.map((rr, i) => `<tr><td>≤ ${rr.km} km</td><td class="num">${upTo(c, i, "edu")}</td><td class="num">${upTo(c, i, "res")}</td><td class="num">${upTo(c, i, "bpo")}</td><td class="num">${upTo(c, i, "pg")}</td></tr>`).join("");
  const within = (kind) => c.slice(0, REACH + 1).flatMap(x => x[kind]).sort((a, b) => a.d - b.d);
  const ex = catchOf(EX), mx = nearestSt(EX);
  const delta = (a, b, moreIsGood) => { const v = a - b; if (!v) return `<span class="dl">same</span>`; return `<span class="dl ${(v > 0) === moreIsGood ? "up" : "dn"}">${v > 0 ? "+" : "−"}${Math.abs(v)}</span>`; };
  const mDelta = Math.round((r.d - mx.d) * 1000);
  const mTxt = Math.abs(mDelta) < 150 ? `<span class="dl">about the same</span>` : `<span class="dl ${mDelta < 0 ? "up" : "dn"}">${mDelta < 0 ? "closer" : "farther"} by ${fmtM(Math.abs(mDelta) / 1000)}</span>`;
  const sheetRows = SHEET_FIELDS.filter(([, k]) => o[k]).map(([l, k]) => `<tr><th>${esc(l)}</th><td>${esc(o[k])}</td></tr>`).join("");
  $("#p-body").innerHTML = `
    ${gal.length ? `<div class="gal n${gal.length}">${gal.join("")}</div>` : ""}
    ${readBox(o)}
    ${flagBox(o)}
    <div class="kpis">
      <div class="kpi"><div class="l">From today's office</div><div class="v">${fmtKm(exKm(o))}</div><div class="s">straight line · about ${driveMin(exKm(o))} min by road, estimate</div></div>
      <div class="kpi"><div class="l">Nearest metro</div><div class="v">${fmtM(r.d)}</div><div class="s">${esc(r.s.name)} · ${esc(accessWord(r.d))}</div></div>
      <div class="kpi"><div class="l">Floor plate</div><div class="v" style="font-size:16px">${esc(o.floorPlate || "-")}</div><div class="s">${esc(o.floorsTotal || "")}</div></div>
      <div class="kpi"><div class="l">Quoted rent</div><div class="v">${o.rentLo ? `INR ${o.rentLo}` : "-"}</div><div class="s">a sq ft a month${o.condition ? ` · ${esc(o.condition)}` : ""}</div></div>
      <div class="kpi"><div class="l">BPO employers</div><div class="v">${upTo(c, REACH, "bpo")}</div><div class="s">within ${REACH_KM} km</div></div>
      <div class="kpi"><div class="l">Talent points</div><div class="v">${upTo(c, REACH, "edu") + upTo(c, REACH, "res")}</div><div class="s">${upTo(c, REACH, "edu")} institutes · ${upTo(c, REACH, "res")} belts within ${REACH_KM} km</div></div>
    </div>
    ${marketHTML(o)}
    <h3>From the property sheet</h3>
    <table class="spec">${sheetRows}</table>
    <p class="note">Broker-stated, Oct 2026. Not yet checked on site.</p>

    <h3>Against today's office</h3>
    <p class="vsx"><b>${fmtKm(exKm(o))} from ${esc(EX.name)}</b> in a straight line. ${esc(moveRead(exKm(o)))}</p>
    <table class="ring-tbl"><thead><tr><th></th><th>${esc(EX.name)} (today)</th><th>${esc(short(o))}</th></tr></thead><tbody>
      <tr><td>Micro-market</td><td>${esc(ZONE[EX.micro] ? ZONE[EX.micro].label : EX.locality)}</td><td>${esc(z ? z.label : o.sheetMicro)} ${EX.micro === o.micro ? `<span class="dl">same</span>` : `<span class="dl dn">different</span>`}</td></tr>
      <tr><td>Nearest metro</td><td>${esc(mx.s.name)} · ${fmtM(mx.d)}</td><td>${esc(r.s.name)} · ${fmtM(r.d)} ${mTxt}</td></tr>
      <tr><td>BPO employers ≤ ${REACH_KM} km</td><td class="num">${upTo(ex, REACH, "bpo")}</td><td class="num">${upTo(c, REACH, "bpo")} ${delta(upTo(c, REACH, "bpo"), upTo(ex, REACH, "bpo"), true)}</td></tr>
      <tr><td>Institutes ≤ ${REACH_KM} km</td><td class="num">${upTo(ex, REACH, "edu")}</td><td class="num">${upTo(c, REACH, "edu")} ${delta(upTo(c, REACH, "edu"), upTo(ex, REACH, "edu"), true)}</td></tr>
      <tr><td>Residential belts ≤ ${REACH_KM} km</td><td class="num">${upTo(ex, REACH, "res")}</td><td class="num">${upTo(c, REACH, "res")} ${delta(upTo(c, REACH, "res"), upTo(ex, REACH, "res"), true)}</td></tr>
    </tbody></table>

    <h3>Nearest other buildings</h3>
    <div class="nb">${others.slice(0, 5).map(({ x, d }) => `<div class="r"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${optLink(x)}</span><div class="tr"><div class="fl ${vOf(x).cls}" style="width:${Math.max(3, Math.round(d / nbMax * 100))}%"></div></div><span class="v">${fmtKm(d)}</span></div>`).join("")}</div>
    <p class="note">The three nearest are drawn on the map. Every pair is on <a href="#" data-tab="distance">Distances</a>.</p>

    <h3>Within reach</h3>
    <table class="ring-tbl"><thead><tr><th>Straight line</th><th class="num">Institutes</th><th class="num">Homes</th><th class="num">BPO employers</th><th class="num">PGs</th></tr></thead><tbody>${ringRows}</tbody></table>
    <div class="two" style="margin-top:8px">
      <div class="box"><h4>BPO employers within ${REACH_KM} km</h4><div class="plc">${within("bpo").map(x => `<span title="${esc(x.note)}"><span class="dot" style="background:var(--bpo)"></span>${esc(x.name)} · ${x.d.toFixed(1)} km</span>`).join("") || "<span>None mapped</span>"}</div></div>
      <div class="box"><h4>Institutes and homes within ${REACH_KM} km</h4><div class="plc">${[...within("edu"), ...within("res")].map(x => `<span title="${esc(x.note)}"><span class="dot" style="background:${x.kind === "edu" ? "var(--edu)" : "var(--res)"}"></span>${esc(x.name)} · ${x.d.toFixed(1)} km</span>`).join("") || "<span>None mapped</span>"}</div></div>
    </div>

    ${z ? `<h3>The micro-market</h3>
    <div class="zc" style="--z:${z.color}"><div class="zh"><b>${esc(z.name)}</b></div><div class="note">${esc(z.character)}</div>
      <div class="zk"><div><span class="l">Rent</span>${figure(z.rent)}</div><div><span class="l">Floors</span>${figure(z.plates)}</div></div></div>` : ""}

    <h3>Where it sits on the map</h3>
    <table class="spec">
      <tr><th>Name on the sheet</th><td>${esc(o.sheetName)}</td></tr>
      <tr><th>Address</th><td>${esc(o.address)}</td></tr>
      <tr><th>Column on the sheet</th><td>${esc(o.sheetNo || "")}</td></tr>
    </table>
    <p class="note">Precision: <b>${esc(PRECISION_TEXT[o.precision] || o.precision)}</b>. ${esc(o.geoNote)} ${o.geoSrc ? cite(o.geoSrc, "source") : ""}</p>
    <p class="note">${esc(METHOD)}</p>`;
}
function moveRead(d) {
  if (d < 1.5) return "Next door. Today's team keeps its commute; the choice is about the building.";
  if (d < 4) return "Same part of Noida. Most of today's team keeps a similar commute; a few gain or lose a little.";
  if (d < 8) return "Across Noida. Some staff gain and some lose; map where today's team lives before deciding.";
  return "A real move. Expect some of today's team to weigh it; plan transport before committing.";
}

/* ============================================================ compare == */
function openCompare() { $("#cmp").classList.add("on"); renderCompare(); }
window.openCompare = openCompare;
let CMP_SORT = "picks";
function renderCompare() {
  const list = O.slice().sort((a, b) => CMP_SORT === "sheet" ? (a.sheetNo || a.n) - (b.sheetNo || b.n) : CMP_SORT === "home" ? exKm(a) - exKm(b) : byPick(a, b));
  $("#cmp-body").innerHTML = `
    <div class="sortrow" style="margin:12px 0 4px;flex-wrap:wrap;gap:10px">
      <label style="display:flex;flex-direction:column;gap:2px;min-width:180px">Order<select id="cmp-sort"><option value="picks" ${CMP_SORT === "picks" ? "selected" : ""}>Autopilot's order</option><option value="home" ${CMP_SORT === "home" ? "selected" : ""}>Nearest today's office</option><option value="sheet" ${CMP_SORT === "sheet" ? "selected" : ""}>Sheet order</option></select></label>
    </div>
    <p class="note" style="margin:0 0 8px">Shaded cells are the best value in the row. Distances are straight lines; everything else is from the sheet. Click a column head to open that building.</p>
    ${specTable(list, "cmp")}`;
  $("#cmp-sort").addEventListener("change", e => { CMP_SORT = e.target.value; renderCompare(); });
  $("#cmp-body").querySelectorAll("[data-go]").forEach(h => h.addEventListener("click", e => { e.preventDefault(); $("#cmp").classList.remove("on"); select(h.dataset.go, true); }));
}

initGate();
