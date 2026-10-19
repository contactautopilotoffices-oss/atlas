/* ============================================================================
   ATLAS · ANDHERI COMPETITORS

   Autopilot's seven office options in Andheri East, read against the
   coworking and managed-office centres around them. Built on the Noida
   study's look (front-end gate, Mapbox map behind glass panes), with one list
   that switches between Autopilot's options and the competitors.

   Truth rules, as on every Atlas page:
   - Prices, occupancy, grade, desk size and seats are the survey sheet's own
     words (Oct 2026). Nothing is estimated; a seat count the sheet marks as an
     assumption says so.
   - Distances are straight lines between pins, labelled as such. Walking
     minutes are that line at 80 m a minute, an estimate, not a route.
   - Every pin says how exact it is (building, street or area) and links the
     source it came from.
   ============================================================================ */
"use strict";

const GATE_HASH = "8e838c955a084d950b088f46033923627e1c40793347287607c5bed50b17965c";
async function sha256(txt) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const AUTH_KEY = "and-auth", HANDOFF = "/andheri/";

const M = window.AND_META, O = window.AND_OPTIONS, C = window.AND_CENTRES, Z = window.AND_ZONES, ST = window.AND_STATIONS;
const ZONE = Object.fromEntries(Z.map(z => [z.key, z]));
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
const cite = (u, label) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || host(u))} ↗</a>` : "";
const REDUCED = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const rs = (n) => "Rs " + Math.round(n).toLocaleString("en-IN");

/* ------------------------------------------------------------ geometry --- */
function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtKm = (d) => d < 1 ? `${Math.round(d * 1000 / 10) * 10} m` : `${d.toFixed(1)} km`;
const walkMin = (d) => Math.max(1, Math.round(d * 1000 / M.speed.walkMPerMin));
/* A pin that is not on the building itself makes any distance from it rough:
   say "about" and never quote less than 100 m. */
const exact = (...xs) => xs.every(x => !x || x.precision === "building");
const dist = (d, ...xs) => exact(...xs) ? fmtKm(d) : `about ${fmtKm(Math.max(.1, d))}`;
const nearestSt = (p) => ST.map(s => ({ s, d: km(p, s) })).sort((a, b) => a.d - b.d)[0];
const KM_LAT = 110.6, KM_LNG = 111.32 * Math.cos(19.11 * Math.PI / 180);
function circle(c, rKm, n = 72) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n * 2 * Math.PI; out.push([c.lng + Math.cos(t) * rKm / KM_LNG, c.lat + Math.sin(t) * rKm / KM_LAT]); }
  return out;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const occMid = (c) => (c.occLo + c.occHi) / 2;

/* Several centres share one pin (two towers in Sahar Plaza, area-only rows).
   On the map only, each extra one is nudged about 25 m so every dot can be
   clicked; the panel still states the precision of the real position. */
const DRAWN = new Map();
(function spread() {
  const seen = new Map();
  for (const c of C) {
    const k = c.lat.toFixed(5) + "," + c.lng.toFixed(5), i = seen.get(k) || 0; seen.set(k, i + 1);
    const a = i * 2.2;
    DRAWN.set(c.id, i ? [c.lng + Math.cos(a) * .025 / KM_LNG, c.lat + Math.sin(a) * .025 / KM_LAT] : [c.lng, c.lat]);
  }
})();

const NEAR_KM = 1;
const nearby = (o, r = NEAR_KM) => C.map(c => ({ c, d: km(o, c) })).filter(x => x.d <= r).sort((a, b) => a.d - b.d);
const COMP_MED = median(C.map(c => c.price));
const BANDS = [
  { max: 13000, label: "Up to Rs 13,000", color: "#7d93a8" },
  { max: 18000, label: "Rs 13,001 to 18,000", color: "#d9a07a" },
  { max: 25000, label: "Rs 18,001 to 25,000", color: "#c8693a" },
  { max: Infinity, label: "Above Rs 25,000", color: "#7a2e17" },
];
const band = (p) => BANDS.find(b => p <= b.max);
const PRECISION_TEXT = { building: "Pinned to the building", street: "Pinned to the complex or street, building approximate", locality: "Area only, no building given in the sheet" };
const ALL = new Map([...O.map(o => [o.id, { ...o, kind: "option" }]), ...C.map(c => [c.id, { ...c, kind: "centre" }])]);
/* The sheet says "Expected this month end"; say which month that was. */
const ocText = (o) => /this month/i.test(o.oc) ? `${o.oc} (sheet dated ${M.asOfText})` : o.oc;
const optNo = (o) => String(o.n).padStart(2, "0");
const centreName = (c) => `${c.operator}${c.building ? ", " + c.building : ""}`;

/* ---------------------------------------------------------------- state -- */
const S = { mode: "options", sel: null, tab: "overview", micro: null, grade: null, sort: { options: "autopilot", centres: "price" },
  layers: { options: true, centres: true, metro: true, sat: false }, sheet: "half" };
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "areas", label: "By area" },
  { key: "compare", label: "Compare options" },
];
const SORTS = {
  options: { autopilot: "Autopilot's order", seat: "Lowest per-seat cost", rail: "Nearest metro", rivals: "Most competitors within 1 km" },
  centres: { price: "Lowest price first", priceHi: "Highest price first", occ: "Fullest first", name: "Operator A to Z", area: "By area" },
};
const gradeKey = (g) => g.replace(/[+-]/g, "");

/* ================================================================ gate == */
function initGate() {
  const norm = (v) => v.trim().toUpperCase().replace(/[\s-]/g, "");
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true; $("#g-go").disabled = true;
    let ok = false;
    try { ok = (await sha256(norm($("#g-id").value) + ":" + norm($("#g-pw").value))) === GATE_HASH; } catch (e) { ok = false; }
    busy = false; $("#g-go").disabled = false;
    if (ok) { try { sessionStorage.setItem(AUTH_KEY, "1"); } catch (e) {} openApp(); }
    else { $("#g-err").textContent = "Not recognised. Access is issued per person."; $("#g-pw").value = ""; $("#g-pw").focus(); }
  };
  const openApp = () => { const g = $("#gate"); g.classList.add("out"); setTimeout(() => g.remove(), 450); boot(); };
  startMap();
  const ops = new Set(C.map(c => c.operator)).size;
  $("#g-stats").innerHTML = `<span><b>${O.length}</b>Autopilot options</span><span><b>${C.length}</b>competitor centres</span>`
    + `<span><b>${ops}</b>operators</span><span><b>${rs(COMP_MED)}</b>median seat price</span>`;
  let handoff = null;
  try { handoff = sessionStorage.getItem("atlas-handoff"); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
  let authed = false;
  try { if (handoff === HANDOFF) sessionStorage.setItem(AUTH_KEY, "1"); authed = sessionStorage.getItem(AUTH_KEY) === "1"; } catch (e) {}
  if (authed) { $("#gate").remove(); boot(); return; }
  try { if (sessionStorage.getItem("and-out") === "1") { sessionStorage.removeItem("and-out"); const e = $("#g-err"); e.style.color = "var(--ok)"; e.textContent = "You have signed out on this device."; } } catch (e) {}
  $("#g-form").addEventListener("submit", e => { e.preventDefault(); $("#g-err").removeAttribute("style"); go(); });
  $("#g-id").focus();
}
function signOut() {
  try { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem("atlas-handoff"); sessionStorage.setItem("and-out", "1"); } catch (e) {}
  location.replace(location.pathname);
}

/* ================================================================ map === */
let map, booted = false, layered = false;
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
const STYLES = { std: "mapbox://styles/mapbox/standard", sat: "mapbox://styles/mapbox/standard-satellite" };
const styleUrl = () => S.layers.sat ? STYLES.sat : STYLES.std;
const basemap = () => S.layers.sat
  ? { lightPreset: "day", showPointOfInterestLabels: false, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true }
  : { lightPreset: "day", theme: "faded", showPointOfInterestLabels: false, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true, show3dObjects: false };
function applyBasemap() { for (const [k, v] of Object.entries(basemap())) { try { map.setConfigProperty("basemap", k, v); } catch (e) {} } }
function initMap() {
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  map = new mapboxgl.Map({ container: "map", style: styleUrl(), center: M.center, zoom: M.zoom, pitch: 0, bearing: 0,
    attributionControl: false, projection: "mercator", antialias: innerWidth > 860, renderWorldCopies: false, config: { basemap: basemap() } });
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
function padding() {
  const Wd = innerWidth, Hd = innerHeight;
  if (Wd <= 860) return { top: 80, bottom: Math.min(Hd * .6, Hd - $("#panel").getBoundingClientRect().top + 40), left: 30, right: 30 };
  const b = $("#board").getBoundingClientRect(), p = $("#panel").getBoundingClientRect(), l = $("#layers").getBoundingClientRect();
  return { top: 100, bottom: Math.max(40, Hd - l.top + 24), left: Math.max(30, b.right + 30), right: Math.max(30, Wd - p.left + 30) };
}
function fitPoints(pts, opts = {}) {
  if (!map || !pts.length) return;
  const b = pts.reduce((bb, p) => bb.extend(p), new mapboxgl.LngLatBounds());
  map.fitBounds(b, { padding: padding(), maxZoom: opts.maxZoom || 15.5, duration: opts.animate === false || REDUCED() ? 0 : 900 });
}
function fitAll(animate = true) {
  const pts = [...O.map(o => [o.lng, o.lat]), ...C.filter(passes).map(c => DRAWN.get(c.id))];
  fitPoints(pts, { animate });
}

const FC = (features) => ({ type: "FeatureCollection", features });
const pt = (lng, lat, props) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: props });
const optionsFC = () => FC(O.map(o => pt(o.lng, o.lat, { id: o.id, n: String(o.n), name: o.name, prime: o.prime ? 1 : 0, sel: S.sel === o.id ? 1 : 0 })));
const centresFC = () => FC(C.filter(passes).map(c => { const [lng, lat] = DRAWN.get(c.id);
  return pt(lng, lat, { id: c.id, op: c.operator, color: band(c.price).color, sel: S.sel === c.id ? 1 : 0 }); }));
const stationsFC = () => FC(ST.map(s => pt(s.lng, s.lat, { name: s.name })));
function ringFC() {
  const o = S.sel && ALL.get(S.sel);
  if (!o || o.kind !== "option") return FC([]);
  return FC([{ type: "Feature", geometry: { type: "Polygon", coordinates: [circle(o, NEAR_KM)] }, properties: {} }]);
}
function linkFC() {
  const o = S.sel && ALL.get(S.sel);
  if (!o || o.kind !== "option") return FC([]);
  return FC(nearby(o).map(({ c }) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[o.lng, o.lat], DRAWN.get(c.id)] }, properties: {} })));
}
function add(layer) { if (!map.getLayer(layer.id)) map.addLayer(layer); }
function addLayers() {
  map.addSource("ring", { type: "geojson", data: ringFC() });
  add({ id: "ring-fill", type: "fill", source: "ring", slot: "middle", paint: { "fill-color": "#a3502c", "fill-opacity": .06 } });
  add({ id: "ring-line", type: "line", source: "ring", slot: "middle", paint: { "line-color": "#a3502c", "line-width": 1.5, "line-dasharray": [2, 2] } });
  map.addSource("links", { type: "geojson", data: linkFC() });
  add({ id: "links", type: "line", source: "links", paint: { "line-color": "#a3502c", "line-width": 1.2, "line-opacity": .55 } });
  map.addSource("stations", { type: "geojson", data: stationsFC() });
  add({ id: "st", type: "circle", source: "stations", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 6.5], "circle-color": "#fff", "circle-stroke-color": "#1d3f66", "circle-stroke-width": 2.2 } });
  add({ id: "st-label", type: "symbol", source: "stations", minzoom: 12.5, layout: { "text-field": ["get", "name"], "text-size": 10.5, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, 1.1], "text-anchor": "top" },
    paint: { "text-color": "#1d3f66", "text-halo-color": "#fff", "text-halo-width": 1.5 } });
  map.addSource("centres", { type: "geojson", data: centresFC() });
  add({ id: "centres", type: "circle", source: "centres", paint: {
    "circle-radius": ["case", ["==", ["get", "sel"], 1], 10, ["interpolate", ["linear"], ["zoom"], 11, 4.5, 15, 8]],
    "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 3, 1.6] } });
  add({ id: "centres-label", type: "symbol", source: "centres", minzoom: 14.6, layout: { "text-field": ["get", "op"], "text-size": 10.5, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, 1], "text-anchor": "top", "text-max-width": 9 },
    paint: { "text-color": "#4a3a2e", "text-halo-color": "#fff", "text-halo-width": 1.5 } });
  map.addSource("options", { type: "geojson", data: optionsFC() });
  add({ id: "opt", type: "circle", source: "options", paint: {
    "circle-radius": ["case", ["==", ["get", "sel"], 1], 15, ["==", ["get", "prime"], 1], 13, 11.5],
    "circle-color": "#2a1e16", "circle-stroke-color": ["case", ["==", ["get", "prime"], 1], "#c8693a", "#a3502c"], "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 4, 2.5] } });
  add({ id: "opt-n", type: "symbol", source: "options", layout: { "text-field": ["get", "n"], "text-size": 12, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": "#fff" } });
  add({ id: "opt-label", type: "symbol", source: "options", minzoom: 13.2, layout: { "text-field": ["get", "name"], "text-size": 11.5, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-offset": [0, 1.5], "text-anchor": "top", "text-max-width": 10 },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 1.8 } });
  applyLayerVisibility();
}
function refreshMap() {
  if (!map || !map.getSource("options")) return;
  map.getSource("options").setData(optionsFC());
  map.getSource("centres").setData(centresFC());
  map.getSource("ring").setData(ringFC());
  map.getSource("links").setData(linkFC());
}
function applyLayerVisibility() {
  if (!map || !map.getLayer("opt")) return;
  const vis = (ids, on) => ids.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
  vis(["opt", "opt-n", "opt-label", "ring-fill", "ring-line", "links"], S.layers.options);
  vis(["centres", "centres-label"], S.layers.centres);
  vis(["st", "st-label"], S.layers.metro);
}
function wireMap() {
  const pop = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
  const hover = (layer, html) => {
    map.on("mouseenter", layer, e => { map.getCanvas().style.cursor = "pointer"; const f = e.features[0]; pop.setLngLat(f.geometry.coordinates).setHTML(html(f.properties)).addTo(map); });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; pop.remove(); });
  };
  hover("opt", p => { const o = ALL.get(p.id), r = nearestSt(o);
    return `<b>${optNo(o)} · ${esc(o.name)}</b>${o.prime ? " · prime option" : ""}<br>${rs(o.perSeat)} per seat · Grade ${esc(o.grade)}<br>${nearby(o).length} competitors within 1 km<br>${dist(r.d, o)} to ${esc(r.s.name)}`; });
  hover("centres", p => { const c = ALL.get(p.id);
    return `<b>${esc(c.operator)}</b>${c.building ? `<br>${esc(c.building)}` : ""}<br>${rs(c.price)} per seat · ${c.occLo} to ${c.occHi}% full · Grade ${esc(c.grade)}`; });
  hover("st", p => `<b>${esc(p.name)}</b><br>Metro station`);
  map.on("click", "opt", e => select(e.features[0].properties.id, true));
  map.on("click", "centres", e => select(e.features[0].properties.id, true));
}

/* ============================================================== board ==== */
function passes(c) {
  if (S.micro && c.micro !== S.micro) return false;
  if (S.grade && gradeKey(c.grade) !== S.grade) return false;
  return true;
}
function sortedOptions() {
  const k = S.sort.options, a = [...O];
  if (k === "seat") a.sort((x, y) => x.perSeat - y.perSeat);
  else if (k === "rail") a.sort((x, y) => nearestSt(x).d - nearestSt(y).d);
  else if (k === "rivals") a.sort((x, y) => nearby(y).length - nearby(x).length);
  else a.sort((x, y) => (y.prime - x.prime) || x.n - y.n);
  return a;
}
function sortedCentres() {
  const k = S.sort.centres, a = C.filter(passes);
  if (k === "priceHi") a.sort((x, y) => y.price - x.price);
  else if (k === "occ") a.sort((x, y) => occMid(y) - occMid(x));
  else if (k === "name") a.sort((x, y) => x.operator.localeCompare(y.operator));
  else if (k === "area") a.sort((x, y) => Z.findIndex(z => z.key === x.micro) - Z.findIndex(z => z.key === y.micro) || x.price - y.price);
  else a.sort((x, y) => x.price - y.price);
  return a;
}
function renderFilters() {
  const el = $("#filters");
  if (S.mode === "options") { el.innerHTML = ""; return; }
  const areas = Z.filter(z => C.some(c => c.micro === z.key));
  const grades = [...new Set(C.map(c => gradeKey(c.grade)))].sort();
  el.innerHTML = `<button class="chip${S.micro ? "" : " on"}" data-micro="">All areas</button>`
    + areas.map(z => `<button class="chip${S.micro === z.key ? " on" : ""}" data-micro="${z.key}">${esc(z.label)}</button>`).join("")
    + grades.map(g => `<button class="chip${S.grade === g ? " on" : ""}" data-grade="${g}">Grade ${g}</button>`).join("");
}
function renderSort() {
  const opts = SORTS[S.mode];
  $("#sort").innerHTML = Object.entries(opts).map(([k, v]) => `<option value="${k}"${S.sort[S.mode] === k ? " selected" : ""}>${esc(v)}</option>`).join("");
}
function renderList() {
  document.querySelectorAll(".seg button").forEach(b => { const on = b.dataset.mode === S.mode; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  if (S.mode === "options") {
    $("#b-count").textContent = `${O.length} Autopilot options`;
    $("#b-sub").textContent = "";
    $("#list").innerHTML = sortedOptions().map(o => {
      const r = nearestSt(o), n = nearby(o);
      return `<button class="card${S.sel === o.id ? " sel" : ""}" role="listitem" data-id="${o.id}">
        <span class="mk" style="background:#2a1e16;box-shadow:inset 0 0 0 2px ${o.prime ? "#c8693a" : "#a3502c"}">${optNo(o)}</span>
        <div><div class="nm">${esc(o.name)}${o.prime ? `<span class="prime">Prime</span>` : ""}</div>
        <div class="loc">${esc(ZONE[o.micro].label)} · Grade ${esc(o.grade)} · ${esc(o.condition)}</div>
        <div class="facts"><span class="px">${rs(o.perSeat)}/seat</span><span>${n.length} rivals within 1 km</span><span>${dist(r.d, o)} to metro</span></div></div></button>`;
    }).join("");
  } else {
    const list = sortedCentres();
    $("#b-count").textContent = `${list.length} of ${C.length} centres`;
    $("#b-sub").textContent = M.asOfText;
    $("#list").innerHTML = list.map(c => `<button class="card${S.sel === c.id ? " sel" : ""}" role="listitem" data-id="${c.id}">
        <span class="mk" style="background:${band(c.price).color}">${Math.round(c.price / 1000)}k</span>
        <div><div class="nm">${esc(c.operator)}</div>
        <div class="loc">${esc(c.building || "Building not given")} · ${esc(ZONE[c.micro].label)}</div>
        <div class="facts"><span class="px">${rs(c.price)}/seat</span><span>${c.occLo} to ${c.occHi}% full</span><span>Grade ${esc(c.grade)}</span></div></div></button>`).join("")
      || `<p class="note" style="padding:12px">No centre matches these filters.</p>`;
  }
}
function wireBoard() {
  document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
    S.mode = b.dataset.mode; renderFilters(); renderSort(); renderList();
  }));
  $("#filters").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    if ("micro" in b.dataset) S.micro = b.dataset.micro || null;
    if ("grade" in b.dataset) S.grade = S.grade === b.dataset.grade ? null : b.dataset.grade;
    renderFilters(); renderList(); refreshMap(); if (!S.sel) fitAll();
  });
  $("#sort").addEventListener("change", e => { S.sort[S.mode] = e.target.value; renderList(); });
  $("#list").addEventListener("click", e => { const c = e.target.closest(".card"); if (c) select(c.dataset.id, true); });
}

/* ============================================================== panel ==== */
function select(id, fly, fromRoute) {
  const x = ALL.get(id); if (!x) return;
  S.sel = id;
  S.mode = x.kind === "option" ? "options" : "centres";
  if (x.kind === "centre" && !passes(x)) { S.micro = null; S.grade = null; }
  renderFilters(); renderSort(); renderList(); renderPanel(); refreshMap();
  const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`); if (card) card.scrollIntoView({ block: "nearest" });
  if (!fromRoute) pushRoute();
  if (fly && map) {
    if (x.kind === "option") fitPoints([[x.lng, x.lat], ...nearby(x).map(({ c }) => DRAWN.get(c.id))], { maxZoom: 15.6 });
    else map.flyTo({ center: DRAWN.get(x.id), zoom: Math.max(map.getZoom(), 15.4), padding: padding(), duration: REDUCED() ? 0 : 1200, essential: true });
  }
  if (innerWidth <= 860) setSheet("half");
}
window.select = select;
function back() { S.sel = null; pushRoute(); renderList(); renderPanel(); refreshMap(); fitAll(); }

const kpi = (l, v, s) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
const srcLine = (x) => `<p class="note">${esc(PRECISION_TEXT[x.precision])}. ${cite(x.geoSrc, "Position source")}${x.geoNote ? ` ${esc(x.geoNote)}` : ""}</p>`;

function renderPanel() {
  const x = S.sel && ALL.get(S.sel);
  if (x && x.kind === "option") return optionPanel(x);
  if (x) return centrePanel(x);
  if (S.tab === "areas") return areasPanel();
  return overviewPanel();
}
function head(eyebrow, title, extra = "") {
  $("#p-head").innerHTML = `${S.sel ? `<button class="back" type="button" id="p-back">&larr; Back to ${S.tab === "areas" ? "By area" : "Overview"}</button>` : ""}
    <div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${extra}`;
  const b = $("#p-back"); if (b) b.addEventListener("click", back);
}
function overviewPanel() {
  const prices = C.map(c => c.price), lo = C.reduce((a, b) => b.price < a.price ? b : a), hi = C.reduce((a, b) => b.price > a.price ? b : a);
  const oLo = Math.min(...O.map(o => o.perSeat)), oHi = Math.max(...O.map(o => o.perSeat));
  const occ = median(C.map(occMid));
  head(`AUTOPILOT · ANDHERI EAST · ${M.asOfText.toUpperCase()}`, "Autopilot's options against the market",
    `<p class="lede">${O.length} Autopilot options and ${C.length} coworking and managed-office centres run by ${new Set(C.map(c => c.operator)).size} operators, across Chandivali, Marol, J B Nagar, Chakala and the Western Express Highway.</p>`);
  const rows = sortedOptions().map(o => {
    const n = nearby(o), med = median(n.map(({ c }) => c.price));
    const diff = med == null ? "" : o.perSeat <= med ? `<span class="dn">${rs(med - o.perSeat)} below</span>` : `<span class="up">${rs(o.perSeat - med)} above</span>`;
    return `<tr data-id="${o.id}"><td><b>${optNo(o)} ${esc(o.name)}</b>${o.prime ? `<span class="prime">Prime</span>` : ""}</td><td class="num">${rs(o.perSeat)}</td><td class="num">${n.length}</td><td class="num">${med == null ? "none" : rs(med)}</td><td>${diff}</td></tr>`;
  }).join("");
  $("#p-body").innerHTML = `
    <div class="kpis">
      ${kpi("Market median", rs(COMP_MED), `per seat a month plus taxes, ${C.length} centres`)}
      ${kpi("Market range", `${rs(Math.min(...prices))} to ${rs(Math.max(...prices))}`, `${esc(lo.operator)} to ${esc(hi.operator)}`)}
      ${kpi("Autopilot options", `${rs(oLo)} to ${rs(oHi)}`, "per seat, from the inventory sheet")}
      ${kpi("Typical occupancy", `${Math.round(occ)}%`, "median of the sheet's ranges")}
      ${kpi("Within 1 km of a metro", `${O.filter(o => nearestSt(o).d <= 1).length} of ${O.length}`, "Autopilot options, straight line")}
      ${kpi("Prime option", esc(O.find(o => o.prime)?.name || "none"), "marked in the inventory sheet")}
    </div>
    <h3 style="margin-top:18px">Each option against the centres within 1 km</h3>
    <table class="near"><thead><tr><th>Option</th><th class="num">Per seat</th><th class="num">Rivals</th><th class="num">Their median</th><th>Option is</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Rivals are the competitor centres within 1 km in a straight line of the option's pin. Prices are per seat a month plus taxes, as surveyed in ${esc(M.asOfText)}.</p>
    <h3 style="margin-top:18px">Map key</h3>
    <div class="legend"><span><i style="background:#2a1e16;box-shadow:0 0 0 2px #a3502c"></i>Autopilot option</span>${BANDS.map(b => `<span><i style="background:${b.color}"></i>${esc(b.label)}</span>`).join("")}<span><i style="background:#fff;box-shadow:0 0 0 2px #1d3f66"></i>Metro station</span></div>
    <h3 style="margin-top:18px">Where this comes from</h3>
    <p class="note">${esc(M.sheet)}. ${esc(M.geo)} Left out because the sheet says the operator has no property there: ${esc(M.excluded.join("; "))}.</p>`;
  wireNearRows();
}
function areasPanel() {
  head(`ANDHERI EAST · ${M.asOfText.toUpperCase()}`, "Prices by area");
  const rows = Z.map(z => {
    const cs = C.filter(c => c.micro === z.key), os = O.filter(o => o.micro === z.key);
    if (!cs.length && !os.length) return "";
    const p = cs.map(c => c.price);
    return `<tr data-micro="${z.key}"><td><b>${esc(z.label)}</b><br><span class="note">${esc(z.name)}</span></td><td class="num">${cs.length}</td><td class="num">${p.length ? rs(median(p)) : "none"}</td><td class="num">${p.length ? `${rs(Math.min(...p))} to ${rs(Math.max(...p))}` : ""}</td><td>${os.map(o => `<span class="badge" title="${esc(o.name)}">${o.n}</span>`).join(" ") || "none"}</td></tr>`;
  }).join("");
  $("#p-body").innerHTML = `<table class="near"><thead><tr><th>Area</th><th class="num">Centres</th><th class="num">Median</th><th class="num">Range</th><th>Autopilot</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Click an area to list its centres. Prices per seat a month plus taxes, ${esc(M.asOfText)}.</p>`;
  document.querySelectorAll("#p-body tr[data-micro]").forEach(tr => tr.addEventListener("click", () => {
    S.mode = "centres"; S.micro = tr.dataset.micro; renderFilters(); renderSort(); renderList(); refreshMap(); fitAll();
  }));
}
function optionPanel(o) {
  const r = nearestSt(o), n = nearby(o), med = median(n.map(({ c }) => c.price));
  head(`AUTOPILOT OPTION ${optNo(o)} · ${esc(ZONE[o.micro].label.toUpperCase())}`, esc(o.name) + (o.prime ? ` <span class="prime">Prime option</span>` : ""));
  const spec = [["Grade", o.grade], ["Total floors", o.floors], ["Floors offered", o.floorsOffered], ["Typical floor plate", o.plate], ["Carpet area", o.carpet],
    ["Built-up area", o.builtup], ["OC status", ocText(o)], ["Condition", o.condition], ["Car parking", o.parking], ["Nearest commute (sheet)", o.commute]]
    .filter(([, v]) => v).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");
  const rows = n.map(({ c, d }) => `<tr data-id="${c.id}"><td><b>${esc(c.operator)}</b><br><span class="note">${esc(c.building || "Building not given")}</span></td><td class="num">${dist(d, o, c)}</td><td class="num">${rs(c.price)}</td><td class="num">${c.occLo}-${c.occHi}%</td><td>${esc(c.grade)}</td></tr>`).join("");
  $("#p-body").innerHTML = `
    <div class="kpis">
      ${kpi("Per seat", rs(o.perSeat), "a month, inventory sheet")}
      ${kpi("Rivals within 1 km", String(n.length), "straight line")}
      ${kpi("Their median", med == null ? "none" : rs(med), med == null ? "" : o.perSeat <= med ? `<span class="dn">This option is ${rs(med - o.perSeat)} below</span>` : `<span class="up">This option is ${rs(o.perSeat - med)} above</span>`)}
      ${kpi("Nearest metro", dist(r.d, o), exact(o) ? `${esc(r.s.name)}, about ${walkMin(r.d)} min walk on a straight line` : `${esc(r.s.name)}; this pin is approximate`)}
    </div>
    <h3 style="margin-top:16px">From the inventory sheet</h3>
    <table class="spec">${spec}</table>
    <h3 style="margin-top:16px">Competitor centres within 1 km</h3>
    ${n.length ? `<table class="near"><thead><tr><th>Centre</th><th class="num">Away</th><th class="num">Per seat</th><th class="num">Full</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="note">No surveyed centre within 1 km.</p>`}
    ${srcLine(o)}`;
  wireNearRows();
}
function centrePanel(c) {
  const r = nearestSt(c), opts = O.map(o => ({ o, d: km(c, o) })).sort((a, b) => a.d - b.d);
  const same = C.filter(x => x.micro === c.micro).map(x => x.price);
  head(`${esc(ZONE[c.micro].label.toUpperCase())} · COMPETITOR · ${M.asOfText.toUpperCase()}`, esc(c.operator), `<p class="lede">${esc(c.building || "Building not given in the sheet")}</p>`);
  const spec = [["Price", c.priceText], ["Occupancy", `${c.occLo}% to ${c.occHi}%`], ["Grade", c.grade], ["Workstation size", c.desk], ["Total seats", c.seats ? c.seats + (c.seatsNote ? ` (${c.seatsNote})` : "") : null],
    ["Sheet name", c.sheetBuilding && c.sheetBuilding !== c.building ? `${c.sheetOperator}, ${c.sheetBuilding}` : null], ["Area note", c.microNote]]
    .filter(([, v]) => v).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");
  $("#p-body").innerHTML = `
    <div class="kpis">
      ${kpi("Per seat", rs(c.price), "a month plus taxes")}
      ${kpi("Area median", rs(median(same)), `${same.length} centres in ${esc(ZONE[c.micro].label)}`)}
      ${kpi("Nearest metro", dist(r.d, c), `${esc(r.s.name)}, straight line`)}
    </div>
    <h3 style="margin-top:16px">From the survey</h3>
    <table class="spec">${spec}</table>
    <h3 style="margin-top:16px">Nearest Autopilot options</h3>
    <table class="near"><thead><tr><th>Option</th><th class="num">Away</th><th class="num">Per seat</th></tr></thead><tbody>
      ${opts.slice(0, 3).map(({ o, d }) => `<tr data-id="${o.id}"><td><b>${optNo(o)} ${esc(o.name)}</b></td><td class="num">${dist(d, o, c)}</td><td class="num">${rs(o.perSeat)}</td></tr>`).join("")}</tbody></table>
    ${srcLine(c)}`;
  wireNearRows();
}
function wireNearRows() { document.querySelectorAll("#p-body tr[data-id]").forEach(tr => tr.addEventListener("click", () => select(tr.dataset.id, true))); }

/* ------------------------------------------------------------ compare ---- */
function openCompare() {
  const os = sortedOptions();
  const rowsDef = [["Per seat", o => rs(o.perSeat)], ["Grade", o => o.grade], ["Area", o => ZONE[o.micro].label], ["Total floors", o => o.floors], ["Floors offered", o => o.floorsOffered],
    ["Floor plate", o => o.plate], ["Carpet area", o => o.carpet], ["Built-up area", o => o.builtup], ["OC status", ocText], ["Condition", o => o.condition], ["Car parking", o => o.parking],
    ["Nearest metro (straight line)", o => { const r = nearestSt(o); return `${r.s.name}, ${dist(r.d, o)}`; }], ["Rivals within 1 km", o => String(nearby(o).length)],
    ["Their median per seat", o => { const m = median(nearby(o).map(({ c }) => c.price)); return m == null ? "none" : rs(m); }]];
  const best = Math.min(...os.map(o => o.perSeat));
  $("#cmp-body").innerHTML = `<div style="overflow:auto"><table class="cmp"><thead><tr><th></th>${os.map(o => `<th>${optNo(o)} ${esc(o.name)}${o.prime ? `<span class="prime">Prime</span>` : ""}</th>`).join("")}</tr></thead><tbody>
    ${rowsDef.map(([k, f], i) => `<tr><th>${k}</th>${os.map(o => `<td${i === 0 && o.perSeat === best ? ` class="best"` : ""}>${esc(f(o) || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="note" style="margin-top:10px">From Autopilot's inventory sheet; distances and rivals worked out from the map pins.</p>`;
  $("#cmp").classList.add("on");
}

/* -------------------------------------------------------- tabs, layers --- */
function renderTabs() {
  $("#tabs").innerHTML = TABS.map(t => `<button class="tab${S.tab === t.key && !S.sel && t.key !== "compare" ? " on" : ""}" type="button" data-tab="${t.key}">${t.label}</button>`).join("");
}
function goTab(key) {
  if (key === "compare") return openCompare();
  S.tab = key; S.sel = null; pushRoute(); renderTabs(); renderList(); renderPanel(); refreshMap(); fitAll();
}
const LAYERS = [{ key: "options", label: "Autopilot options" }, { key: "centres", label: "Competitors" }, { key: "metro", label: "Metro" }, { key: "sat", label: "Satellite" }];
function renderLayers() {
  $("#layers").innerHTML = LAYERS.map(l => `<button class="chip lay${S.layers[l.key] ? " on" : ""}" type="button" data-layer="${l.key}">${l.label}</button>`).join("")
    + `<span class="note lnote" style="margin-left:6px">Distances are straight lines between pins.</span>`;
}
function wireLayers() {
  $("#layers").addEventListener("click", e => {
    const b = e.target.closest("[data-layer]"); if (!b) return;
    const k = b.dataset.layer; S.layers[k] = !S.layers[k]; renderLayers();
    if (k === "sat") { if (map && layered) map.setStyle(styleUrl(), { diff: false }); }
    else applyLayerVisibility();
  });
}

/* ------------------------------------------------------------ routes ----- */
function routeHash() { return S.sel ? `#/${ALL.get(S.sel).kind}/${S.sel}` : S.tab === "overview" ? "#/" : `#/${S.tab}`; }
function pushRoute() { const h = routeHash(); if (location.hash !== h && !(h === "#/" && !location.hash)) history.pushState(null, "", h); }
function applyRoute(render) {
  const [kind, val] = location.hash.replace(/^#\/?/, "").split("/");
  S.sel = null;
  if ((kind === "option" || kind === "centre") && ALL.has(val)) S.sel = val;
  else if (kind === "areas") S.tab = "areas";
  else S.tab = "overview";
  if (render) { renderTabs(); if (S.sel) select(S.sel, true, true); else { renderList(); renderPanel(); refreshMap(); fitAll(); } }
}

/* ------------------------------------------------------ mobile sheet ----- */
function setSheet(state) { S.sheet = state; document.body.dataset.sheet = state; }
const SHEET_STOPS = () => ({ peek: 118, half: innerHeight * .52, full: innerHeight - 64 });
function wireSheet() {
  setSheet("half");
  const g = $("#sheet-grip"); if (!g) return;
  let y0 = null, h0 = 0, moved = false;
  g.addEventListener("pointerdown", e => { y0 = e.clientY; moved = false; h0 = $("#panel").getBoundingClientRect().height; try { g.setPointerCapture(e.pointerId); } catch (x) {} });
  g.addEventListener("pointermove", e => {
    if (y0 == null) return;
    if (!moved && Math.abs(e.clientY - y0) > 6) { moved = true; document.body.classList.add("sheet-drag"); }
    if (moved) { const st = SHEET_STOPS(); document.body.style.setProperty("--sheet-h", Math.max(st.peek - 30, Math.min(st.full, h0 - (e.clientY - y0))) + "px"); }
  });
  const end = (e) => {
    if (y0 == null) return;
    const h = h0 - (e.clientY - y0); y0 = null;
    document.body.classList.remove("sheet-drag"); document.body.style.removeProperty("--sheet-h");
    if (!moved) return;
    const st = SHEET_STOPS();
    setSheet(["peek", "half", "full"].reduce((best, k) => Math.abs(st[k] - h) < Math.abs(st[best] - h) ? k : best, "half"));
  };
  g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
  g.addEventListener("click", () => { if (moved) { moved = false; return; } setSheet(S.sheet === "half" ? "full" : "half"); });
}

/* ================================================================ boot === */
function boot() {
  booted = true;
  applyRoute(false);
  if (S.sel) S.mode = ALL.get(S.sel).kind === "option" ? "options" : "centres";
  renderTabs(); renderFilters(); renderSort(); renderList(); renderPanel(); renderLayers();
  wireBoard(); wireLayers(); wireSheet();
  $("#tabs").addEventListener("click", e => { const t = e.target.closest(".tab"); if (t) goTab(t.dataset.tab); });
  $("#signout").addEventListener("click", signOut);
  $("#cmp-x").addEventListener("click", () => $("#cmp").classList.remove("on"));
  $("#cmp").addEventListener("click", e => { if (e.target.id === "cmp") $("#cmp").classList.remove("on"); });
  addEventListener("keydown", e => { if (e.key === "Escape") $("#cmp").classList.remove("on"); });
  addEventListener("popstate", () => applyRoute(true));
  if (map && map.getSource("options")) { refreshMap(); if (S.sel) select(S.sel, true, true); else fitAll(false); }
}
initGate();
