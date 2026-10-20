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
/* Map colours: Autopilot dark pin, competitor red, metro blue. */
const COL = { option: "#2a1e16", centre: "#d1495b", metro: "#1f6fd1" };
const priceRange = (list) => list.length ? (Math.min(...list) === Math.max(...list) ? rs(list[0]) : `${rs(Math.min(...list))} to ${rs(Math.max(...list))}`) : "none";
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
    + `<span><b>${ops}</b>operators</span><span><b>${ST.length}</b>metro stations nearby</span>`;
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
  ? { lightPreset: "day", showPointOfInterestLabels: false, showTransitLabels: false, showPlaceLabels: true, showRoadLabels: true }
  : { lightPreset: "day", theme: "faded", showPointOfInterestLabels: false, showTransitLabels: false, showPlaceLabels: true, showRoadLabels: true, show3dObjects: false };
function applyBasemap() { for (const [k, v] of Object.entries(basemap())) { try { map.setConfigProperty("basemap", k, v); } catch (e) {} } }
function initMap() {
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  map = new mapboxgl.Map({ container: "map", style: styleUrl(), center: M.center, zoom: M.zoom, pitch: 0, bearing: 0,
    attributionControl: false, projection: "mercator", antialias: innerWidth > 860, renderWorldCopies: false, config: { basemap: basemap() } });
  map.on("style.load", () => { applyBasemap(); if (layered && !map.getSource("ring")) addLayers(); });
  let told = false;
  map.on("error", (e) => {
    const st = e && e.error && e.error.status;
    if (told || (st !== 401 && st !== 403)) return;
    told = true;
    $("#map").insertAdjacentHTML("beforeend", `<div class="nomap warn">Mapbox did not accept the map key on this address, so the map cannot load here. Everything else on the page still works.</div>`);
  });
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("load", () => { addLayers(); buildMarkers(); layered = true; if (booted && S.sel) select(S.sel, true, true); else fitAll(false); });
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
/* Only the 1 km ring and the lines to nearby rivals are map layers; they are
   re-added after a basemap switch. Every pin is an SVG marker (below), so the
   pins never depend on the map style and stay sharp on the satellite view. */
function add(layer) { if (!map.getLayer(layer.id)) map.addLayer(layer); }
function addLayers() {
  if (!map.getSource("ring")) map.addSource("ring", { type: "geojson", data: ringFC() });
  add({ id: "ring-fill", type: "fill", source: "ring", slot: "middle", paint: { "fill-color": "#a3502c", "fill-opacity": .08 } });
  add({ id: "ring-line", type: "line", source: "ring", slot: "middle", paint: { "line-color": "#a3502c", "line-width": 1.8, "line-dasharray": [2, 2] } });
  if (!map.getSource("links")) map.addSource("links", { type: "geojson", data: linkFC() });
  add({ id: "links", type: "line", source: "links", paint: { "line-color": "#ffffff", "line-width": 1.6, "line-opacity": .9, "line-dasharray": [1, 1.5] } });
  applyLayerVisibility();
}

/* ------------------------------------------------------------ markers ---- */
const MK = { option: new Map(), centre: new Map(), station: [] };
function pinSVG(o) {
  return `<svg class="pin" width="38" height="48" viewBox="0 0 38 48" aria-hidden="true">
    <path d="M19 2C9.6 2 2 9.4 2 18.6 2 30.6 19 46 19 46s17-15.4 17-27.4C36 9.4 28.4 2 19 2z" fill="#2a1e16" stroke="${o.prime ? "#e8a33d" : "#c8693a"}" stroke-width="3"/>
    <text x="19" y="23.5" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="13" font-weight="600" fill="#fff">${optNo(o)}</text></svg>`;
}
function marker(el, lngLat, anchor) { return new mapboxgl.Marker({ element: el, anchor }).setLngLat(lngLat).addTo(map); }
function buildMarkers() {
  for (const o of O) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "mk-opt" + (o.prime ? " prime" : "");
    el.setAttribute("aria-label", `Autopilot option ${o.n}, ${o.name}`);
    el.innerHTML = `<span class="blip" aria-hidden="true"></span>${pinSVG(o)}<span class="mk-label">${esc(o.name)}${o.precision === "building" ? "" : ` <i>approx.</i>`}</span>`;
    el.addEventListener("click", e => { e.stopPropagation(); select(o.id, true); });
    MK.option.set(o.id, marker(el, [o.lng, o.lat], "bottom"));
  }
  for (const c of C) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "mk-ctr";
    el.setAttribute("aria-label", `${c.operator}${c.building ? ", " + c.building : ""}, ${rs(c.price)} per seat`);
    el.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="mk-label">${esc(c.operator)} · ${rs(c.price)}</span>`;
    el.addEventListener("click", e => { e.stopPropagation(); select(c.id, true); });
    MK.centre.set(c.id, marker(el, DRAWN.get(c.id), "center"));
  }
  for (const s of ST) {
    const el = document.createElement("div");
    el.className = "mk-st";
    el.title = `${s.name}, metro station`;
    el.innerHTML = `<span class="m" aria-hidden="true">M</span><span class="mk-label">${esc(s.name)}</span>`;
    MK.station.push(marker(el, [s.lng, s.lat], "center"));
  }
  const zoomClass = () => { const z = map.getZoom(); document.body.classList.toggle("z-near", z >= 15.2); document.body.classList.toggle("z-mid", z >= 13.4); };
  map.on("zoom", zoomClass); zoomClass();
  refreshMarkers();
}
function refreshMarkers() {
  if (!MK.option.size) return;
  const x = S.sel && ALL.get(S.sel);
  const near = x && x.kind === "option" ? new Set(nearby(x).map(({ c }) => c.id)) : null;
  for (const [id, m] of MK.option) m.getElement().classList.toggle("sel", S.sel === id);
  for (const [id, m] of MK.centre) {
    const el = m.getElement();
    el.classList.toggle("sel", S.sel === id);
    el.classList.toggle("near", !!near && near.has(id));
    el.classList.toggle("off", !passes(ALL.get(id)));
  }
}
function refreshMap() {
  refreshMarkers();
  if (!map || !map.getSource("ring")) return;
  map.getSource("ring").setData(ringFC());
  map.getSource("links").setData(linkFC());
}
function applyLayerVisibility() {
  document.body.classList.toggle("hide-options", !S.layers.options);
  document.body.classList.toggle("hide-centres", !S.layers.centres);
  document.body.classList.toggle("hide-metro", !S.layers.metro);
  if (!map || !map.getLayer("ring-fill")) return;
  ["ring-fill", "ring-line", "links"].forEach(id => map.setLayoutProperty(id, "visibility", S.layers.options ? "visible" : "none"));
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
        <span class="mk" style="background:${COL.centre}">${Math.round(c.price / 1000)}k</span>
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
    if (x.kind === "option") map.flyTo({ center: [x.lng, x.lat], zoom: 15.6, padding: padding(), duration: REDUCED() ? 0 : 1200, essential: true });
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
  head(`AUTOPILOT · ANDHERI EAST · ${M.asOfText.toUpperCase()}`, "Autopilot's options against the market",
    `<p class="lede">${O.length} Autopilot options and ${C.length} coworking and managed-office centres run by ${new Set(C.map(c => c.operator)).size} operators, across Chandivali, Marol, J B Nagar, Chakala and the Western Express Highway.</p>`);
  const rows = sortedOptions().map(o => {
    const n = nearby(o);
    return `<tr data-id="${o.id}"><td><b>${optNo(o)} ${esc(o.name)}</b>${o.prime ? `<span class="prime">Prime</span>` : ""}</td><td class="num">${rs(o.perSeat)}</td><td class="num">${n.length}</td><td class="num">${priceRange(n.map(({ c }) => c.price))}</td></tr>`;
  }).join("");
  $("#p-body").innerHTML = `
    <div class="kpis">
      ${kpi("Competitor prices", `${rs(Math.min(...prices))} to ${rs(Math.max(...prices))}`, `per seat a month plus taxes, ${esc(lo.operator)} to ${esc(hi.operator)}`)}
      ${kpi("Autopilot options", `${rs(oLo)} to ${rs(oHi)}`, "per seat, from the inventory sheet")}
      ${kpi("Occupancy", `${Math.min(...C.map(c => c.occLo))}% to ${Math.max(...C.map(c => c.occHi))}%`, "lowest to highest in the sheet")}
      ${kpi("Within 1 km of a metro", `${O.filter(o => nearestSt(o).d <= 1).length} of ${O.length}`, "Autopilot options, straight line")}
      ${kpi("Prime option", esc(O.find(o => o.prime)?.name || "none"), "marked in the inventory sheet")}
    </div>
    <h3 style="margin-top:18px">Each option against the centres within 1 km</h3>
    <table class="near"><thead><tr><th>Option</th><th class="num">Per seat</th><th class="num">Rivals</th><th class="num">Rival prices</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Rivals are the competitor centres within 1 km in a straight line of the option's pin. Prices are per seat a month plus taxes, as surveyed in ${esc(M.asOfText)}.</p>
    <h3 style="margin-top:18px">Map key</h3>
    <div class="legend"><span><i style="background:${COL.option};box-shadow:0 0 0 2px #c8693a"></i>Autopilot option (numbered pin)</span><span><i style="background:${COL.centre}"></i>Competitor centre</span><span><i style="background:${COL.metro}"></i>Metro station (M)</span></div>
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
    return `<tr data-micro="${z.key}"><td><b>${esc(z.label)}</b><br><span class="note">${esc(z.name)}</span></td><td class="num">${cs.length}</td><td class="num">${p.length ? priceRange(p) : "none"}</td><td>${os.map(o => `<span class="badge" title="${esc(o.name)}">${o.n}</span>`).join(" ") || "none"}</td></tr>`;
  }).join("");
  $("#p-body").innerHTML = `<table class="near"><thead><tr><th>Area</th><th class="num">Centres</th><th class="num">Price range</th><th>Autopilot</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Click an area to list its centres. Prices per seat a month plus taxes, ${esc(M.asOfText)}.</p>`;
  document.querySelectorAll("#p-body tr[data-micro]").forEach(tr => tr.addEventListener("click", () => {
    S.mode = "centres"; S.micro = tr.dataset.micro; renderFilters(); renderSort(); renderList(); refreshMap(); fitAll();
  }));
}
function optionPanel(o) {
  const r = nearestSt(o), n = nearby(o);
  head(`AUTOPILOT OPTION ${optNo(o)} · ${esc(ZONE[o.micro].label.toUpperCase())}`, esc(o.name) + (o.prime ? ` <span class="prime">Prime option</span>` : ""));
  const spec = [["Grade", o.grade], ["Total floors", o.floors], ["Floors offered", o.floorsOffered], ["Typical floor plate", o.plate], ["Carpet area", o.carpet],
    ["Built-up area", o.builtup], ["OC status", ocText(o)], ["Condition", o.condition], ["Car parking", o.parking], ["Nearest commute (sheet)", o.commute]]
    .filter(([, v]) => v).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");
  const rows = n.map(({ c, d }) => `<tr data-id="${c.id}"><td><b>${esc(c.operator)}</b><br><span class="note">${esc(c.building || "Building not given")}</span></td><td class="num">${dist(d, o, c)}</td><td class="num">${rs(c.price)}</td><td class="num">${c.occLo}-${c.occHi}%</td><td>${esc(c.grade)}</td></tr>`).join("");
  $("#p-body").innerHTML = `
    <div class="kpis">
      ${kpi("Per seat", rs(o.perSeat), "a month, inventory sheet")}
      ${kpi("Rivals within 1 km", String(n.length), "straight line")}
      ${kpi("Rival prices", priceRange(n.map(({ c }) => c.price)), "per seat, centres within 1 km")}
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
  head(`${esc(ZONE[c.micro].label.toUpperCase())} · COMPETITOR · ${M.asOfText.toUpperCase()}`, esc(c.operator), `<p class="lede">${esc(c.building || "Building not given in the sheet")}</p>`);
  const spec = [["Price", c.priceText], ["Occupancy", `${c.occLo}% to ${c.occHi}%`], ["Grade", c.grade], ["Workstation size", c.desk], ["Total seats", c.seats ? c.seats + (c.seatsNote ? ` (${c.seatsNote})` : "") : null],
    ["Sheet name", c.sheetBuilding && c.sheetBuilding !== c.building ? `${c.sheetOperator}, ${c.sheetBuilding}` : null], ["Area note", c.microNote]]
    .filter(([, v]) => v).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");
  $("#p-body").innerHTML = `
    <div class="kpis">
      ${kpi("Per seat", rs(c.price), "a month plus taxes")}
      ${kpi("Occupancy", `${c.occLo}% to ${c.occHi}%`, "as the sheet gives it")}
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
    ["Rival prices within 1 km", o => priceRange(nearby(o).map(({ c }) => c.price))]];
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
const LAYERS = [
  { key: "options", label: "Autopilot options", sw: `<svg width="12" height="15" viewBox="0 0 38 48" aria-hidden="true"><path d="M19 2C9.6 2 2 9.4 2 18.6 2 30.6 19 46 19 46s17-15.4 17-27.4C36 9.4 28.4 2 19 2z" fill="${COL.option}" stroke="#c8693a" stroke-width="4"/></svg>` },
  { key: "centres", label: "Competitors", sw: `<span class="sw-dot" style="background:${COL.centre}"></span>` },
  { key: "metro", label: "Metro", sw: `<span class="sw-dot sw-m" style="background:${COL.metro}">M</span>` },
  { key: "sat", label: "Satellite", sw: "" },
];
function renderLayers() {
  $("#layers").innerHTML = LAYERS.map(l => `<button class="chip lay${S.layers[l.key] ? " on" : ""}" type="button" data-layer="${l.key}" aria-pressed="${S.layers[l.key]}">${l.sw}${l.label}</button>`).join("")
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
  if (map && layered) { refreshMap(); if (S.sel) select(S.sel, true, true); else fitAll(false); }
}
initGate();
