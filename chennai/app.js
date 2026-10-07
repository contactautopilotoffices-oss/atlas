/* ============================================================================
   ATLAS · CHENNAI OFFICE STUDY

   Built on the Indore study (front-end gate, Mapbox map behind glass panes,
   cited facts, priority mapping), kept deliberately lean for this brief.
   The client asked for seven things and each has one home:

     connectivity        Connectivity tab: open rail today, Phase 2 metro next
     distance between    Distances tab: a matrix of every option to every
                         other option and to the current office
     nearest commute     every option card, panel and the Connectivity table
     talent pool         Talent tab: colleges and homes inside 30 minutes
     existing talent     Talent tab: VFX and post studios already nearby
     micro-markets       Micro-markets tab: rent, vacancy, pros and cons
     conclusion          Conclusion tab, which follows the chooser
     chooser             Your priorities: the client says what matters and
                         the list, pins, brief and conclusion all re-rank

   data.js holds every fact and where it came from. This file only reads it;
   every number on screen is either quoted from data.js with its source or
   derived here from the map positions, and says so.
   ============================================================================ */
"use strict";

/* Access gate, as on /indore/: the page holds only a SHA-256 of the
   normalised "ID:PASSWORD", never the password. It is a browser-side check:
   it keeps a casual visitor out of the view, it does not make data.js
   private. The site root login routes here via clients/manifest.js. */
const GATE_HASH = "5b3ed37afa2ba526f37727dfc4f854266e927bdee009db491346fa7f56ce4079";
async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const AUTH_KEY = "chn-auth", HANDOFF = "/chennai/";
/* CMS (atlas-cms.js): features switched off in /admin/ and visit tracking.
   Without the CMS script everything is on and nothing is tracked. */
const CMS = window.AtlasCMS || null;
const cmsOn = (key) => !CMS || CMS.on(key);
const MEDIA = "../media/chennai/";

const O = window.CHN_OPTIONS, M = window.CHN_META, F = window.CHN_FACTS, EX = window.CHN_EXISTING;
const Z = window.CHN_ZONES, TR = window.CHN_TRANSIT, PL = window.CHN_PLACES;
const ZONE = Object.fromEntries(Z.map(z => [z.key, z]));
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cite = (u, label) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || host(u))} ↗</a>` : "";
const nn = (o) => String(o.n).padStart(2, "0");
const REDUCED = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ------------------------------------------------------------ geometry -- */
function km(a, b) {
  const toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}
/* Offsets in km to lng/lat at Chennai's latitude; good to well under 1% over
   the 40 km the study covers. */
const KM_LAT = 110.6, KM_LNG = 111.32 * Math.cos(12.98 * Math.PI / 180);
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
/* A stadium-shaped band of half-width w km along a polyline's first and last point. */
function band(a, b, w) {
  const ax = a[0] * KM_LNG, ay = a[1] * KM_LAT, bx = b[0] * KM_LNG, by = b[1] * KM_LAT;
  const ang = Math.atan2(by - ay, bx - ax), pts = [];
  for (let i = 0; i <= 24; i++) { const t = ang - Math.PI / 2 - i / 24 * Math.PI; pts.push([(bx + w * Math.cos(t + Math.PI)) / KM_LNG, (by + w * Math.sin(t + Math.PI)) / KM_LAT]); }
  for (let i = 0; i <= 24; i++) { const t = ang + Math.PI / 2 - i / 24 * Math.PI; pts.push([(ax + w * Math.cos(t + Math.PI)) / KM_LNG, (ay + w * Math.sin(t + Math.PI)) / KM_LAT]); }
  pts.push(pts[0]);
  return pts;
}
const zonePolygon = (z) => z.shape.type === "band" ? band(z.shape.from, z.shape.to, z.shape.w) : ellipse(z.shape.c, z.shape.rx, z.shape.ry);
const zoneCentre = (z) => z.shape.type === "band" ? [(z.shape.from[0] + z.shape.to[0]) / 2, (z.shape.from[1] + z.shape.to[1]) / 2] : z.shape.c;

/* ------------------------------------------------------- drive time ------
   Drive time is a straight-line distance turned into minutes with a road
   factor and a peak-hour speed. Both are stated in data.js with a source;
   they are indicative, not routed, and every view that uses them says so. */
const SPEED_KMH = M.speed.kmh, ROAD_FACTOR = M.speed.factor;
const RINGS = [{ min: 15, color: "#a3502c" }, { min: 30, color: "#c8693a" }, { min: 45, color: "#d9a07a" }];
const ringKm = (min) => min / 60 * SPEED_KMH / ROAD_FACTOR;
const driveMin = (k) => Math.max(1, Math.round(k * ROAD_FACTOR / SPEED_KMH * 60));
const METHOD = `Drive times are straight-line distances at ${SPEED_KMH} km/h with a ${ROAD_FACTOR}x road factor (${M.speed.note}). Indicative, not routed.`;
const fmtKm = (d) => `${d < 1 ? d.toFixed(2) : d < 10 ? d.toFixed(1) : Math.round(d)} km`;
const fmtM = (d) => d < 1 ? `${Math.round(d * 1000 / 10) * 10} m` : fmtKm(d);
const walkMin = (d) => Math.round(d * 1000 / 80);

/* --------------------------------------------------------------- rail ----
   A station counts as open if the data says so, or once its opening date has
   passed (the first Phase 2 stretch opens on 11 Oct 2026), so the view keeps
   itself current. `through` marks a station trains run past without stopping:
   the line is drawn as running there, but nobody can board. */
const NOW = new Date();
const from = (iso) => !!iso && NOW >= new Date(iso + "T00:00:00+05:30");
const LINES = TR.lines.map(L => ({ ...L, stations: L.stations.map(s => {
  const open = !!s.open || from(s.opens), through = !open && from(s.through);
  return { ...s, open, through, target: open ? null : through ? "Trains pass; no stop yet" : s.target, line: L.key, lineName: L.short || L.name, mode: L.mode, color: L.color };
}) }));
const STATIONS = LINES.flatMap(L => L.stations);
const OPEN = STATIONS.filter(s => s.open);
/* "Metro coming" looks only at metro stations not yet open; new suburban or
   MRTS halts stay on the map but do not count as the metro pipeline. */
const PLAN = STATIONS.filter(s => !s.open && s.mode === "metro");
const nearest = (p, list) => list.map(s => ({ s, d: km(p, s) })).sort((a, b) => a.d - b.d)[0];
const nearestOpen = (p) => nearest(p, OPEN);
const nearestPlan = (p) => nearest(p, PLAN);
const MODE_WORD = { metro: "metro", mrts: "MRTS", suburban: "train" };
const stLabel = (s) => `${s.name} · ${s.lineName}`;
const accessWord = (d) => d <= 1.2 ? `${walkMin(d)} min walk` : d <= 3 ? "short auto or feeder" : "cab or bus";
const targetYear = (s) => s.eta || null;

/* ---------------------------------------------------------- catchment ---- */
const KINDS = ["edu", "res", "studio", "it"];
function catchment(p) {
  const out = RINGS.map(r => ({ min: r.min, km: ringKm(r.min), edu: [], res: [], studio: [], it: [] }));
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
/* For scoring, reach decays with drive time instead of stopping dead at a
   ring: a place inside 15 min counts 1, inside 30 min 0.6, inside 45 min 0.3.
   The tables still show plain counts per ring. */
const DECAY = [1, .6, .3];
const reach = (o, kinds) => catchOf(o).reduce((t, r, i) => t + kinds.reduce((u, k) => u + r[k].length, 0) * DECAY[i], 0);
const talentRaw = (o) => reach(o, ["edu", "res"]);
const studioRaw = (o) => reach(o, ["studio"]);
const nearestStudio = (p) => nearest(p, PL.filter(x => x.kind === "studio"));
const exKm = (o) => km(o, EX);

/* ------------------------------------------------------------ scoring ----
   Six measures, each scored 0 to 1 from the data, then weighted by what the
   client says matters. Nothing is hand-scored. */
const PARTS = [
  { key: "rail",    noun: "rail access today",         label: "Rail today",            q: "Can people walk to an open metro, MRTS or suburban station?",          of: "distance to the nearest open station" },
  { key: "home",    noun: "closeness to today's office", label: "Close to today's office", q: "Should today's team keep roughly the same commute?",                 of: "distance from the current office at KRC Commerzone, Porur" },
  { key: "talent",  noun: "the talent pool",           label: "Talent pool",           q: "Do you want colleges and homes within a 30 minute drive?",            of: "institutes and residential belts by drive time (inside 15 min counts 1, 30 min 0.6, 45 min 0.3)" },
  { key: "studios", noun: "studio talent nearby",      label: "Studio talent nearby",  q: "Do you want experienced VFX and post artists already working nearby?", of: "VFX, animation and post studios by drive time (inside 15 min counts 1, 30 min 0.6, 45 min 0.3)" },
  { key: "future",  noun: "the metro pipeline",        label: "Metro coming",          q: "Does a Phase 2 metro station opening close by matter?",               of: "distance to the nearest Phase 2 station, discounted by its target year" },
  { key: "rent",    noun: "rent",                      label: "Lower rent",            q: "How much does the micro-market's rent matter?",                       of: "micro-market Grade A rent band (zone level, not the building's quote)" }
];
const LEVELS = [{ v: 0, l: "Skip" }, { v: 1, l: "Low" }, { v: 2, l: "Medium" }, { v: 3, l: "High" }, { v: 5, l: "Critical" }];
const PRESETS = {
  balanced: { label: "Balanced",         note: "Rail access leads; the team, talent and studios count equally; metro plans and rent count a little.", lv: { rail: 3, home: 2, talent: 2, studios: 2, future: 1, rent: 1 } },
  team:     { label: "Keep the team",    note: "Today's people stay: the shortest move from the current office, then rail and nearby studios.",       lv: { rail: 2, home: 4, talent: 1, studios: 2, future: 1, rent: 1 } },
  rail:     { label: "Commute by rail",  note: "Staff arrive by metro, MRTS or train: an open station on foot first, a Phase 2 station next.",        lv: { rail: 4, home: 1, talent: 2, studios: 1, future: 3, rent: 1 } },
  hire:     { label: "Hire at scale",    note: "Grow the team fast: colleges, homes and experienced studio artists within 30 minutes.",               lv: { rail: 3, home: 1, talent: 4, studios: 3, future: 1, rent: 1 } },
  cost:     { label: "Keep cost down",   note: "The cheapest micro-market rent leads; access still counts.",                                         lv: { rail: 2, home: 2, talent: 2, studios: 1, future: 0, rent: 4 } },
  future:   { label: "Built for 2030",   note: "Bet on where the metro is going and where talent is growing.",                                      lv: { rail: 2, home: 1, talent: 3, studios: 2, future: 4, rent: 1 } }
};
for (const k of Object.keys(PRESETS)) if (k !== "balanced" && !cmsOn("preset:" + k)) delete PRESETS[k];
const wOf = (lv) => Object.fromEntries(PARTS.map(p => [p.key, LEVELS[lv[p.key]].v]));
const clamp = (v) => Math.max(0, Math.min(1, v));
function railV(d) {
  const m = d * 1000;
  if (m <= 400) return 1;
  if (m <= 1000) return 1 - .25 * (m - 400) / 600;
  if (m <= 3000) return .75 - .55 * (m - 1000) / 2000;
  return Math.max(.05, .2 - .15 * (m - 3000) / 4000);
}
function futureV(p) {
  const n = nearestPlan(p); if (!n) return 0;
  const y = targetYear(n.s);
  const f = y == null ? .7 : y <= 2026 ? 1 : y === 2027 ? .9 : y === 2028 ? .8 : .7;
  return railV(n.d) * f;
}
const homeV = (d) => d <= 2 ? 1 : Math.max(.05, 1 - (d - 2) / 26);
const rentMid = (z) => z && z.rent && z.rent.lo ? (z.rent.lo + z.rent.hi) / 2 : null;
const MIDS = Z.map(rentMid).filter(v => v != null);
const rentV = (z) => { const m = rentMid(z); if (m == null || MIDS.length < 2) return .5; const lo = Math.min(...MIDS), hi = Math.max(...MIDS); return hi === lo ? .6 : .2 + .8 * (hi - m) / (hi - lo); };
let TALENT_MAX = 1, STUDIO_MAX = 1;
const PCACHE = new Map();
function scoreParts(o) {
  if (PCACHE.has(o.id)) return PCACHE.get(o.id);
  const p = {
    rail: railV(nearestOpen(o).d),
    home: homeV(exKm(o)),
    talent: clamp(talentRaw(o) / TALENT_MAX),
    studios: clamp(studioRaw(o) / STUDIO_MAX),
    future: futureV(o),
    rent: rentV(ZONE[o.micro])
  };
  PCACHE.set(o.id, p);
  return p;
}
function exactWith(o, w) {
  const p = scoreParts(o), tw = PARTS.reduce((s, x) => s + w[x.key], 0);
  if (!tw) return 0;
  return PARTS.reduce((s, x) => s + p[x.key] * w[x.key], 0) / tw * 100;
}
const W = () => wOf(S.lv);
const exact = (o) => exactWith(o, W());
const score = (o) => Math.round(exact(o));
const byFit = (a, b) => exact(b) - exact(a) || a.n - b.n;
const rankWith = (w) => O.slice().sort((a, b) => exactWith(b, w) - exactWith(a, w) || a.n - b.n);
const levelWith = (o) => O.filter(x => x.id !== o.id && score(x) === score(o));
const topParts = () => PARTS.slice().sort((a, b) => S.lv[b.key] - S.lv[a.key]).filter(x => S.lv[x.key] > 0);

/* --------------------------------------------------------------- state -- */
const S = {
  tab: "overview", sel: null, hov: null, pair: null, shot: "close", sort: "score", preset: "balanced", sheet: "half",
  lv: { ...PRESETS.balanced.lv }, filters: new Set(),
  layers: { existing: true, zones: true, rail: true, future: true, links: true, studio: true, it: false, edu: false, res: false, rings: true }
};
const ZONE_FILTERS = Z.map(z => ({ key: z.key, label: z.label, test: o => o.micro === z.key })).filter(f => cmsOn("filter:" + f.key));
const OTHER_FILTERS = [{ key: "near", label: "Rail ≤ 1 km", test: o => nearestOpen(o).d <= 1 }].filter(f => cmsOn("filter:" + f.key));
for (const k of Object.keys(S.layers)) if (!cmsOn("layer:" + k)) S.layers[k] = false;
const passes = (o) => {
  const on = [...S.filters], zs = on.filter(k => ZONE[k]), other = on.filter(k => !ZONE[k]);
  return (zs.length === 0 || zs.includes(o.micro)) && other.every(k => OTHER_FILTERS.find(f => f.key === k).test(o));
};
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "markets", label: "Micro-markets" },
  { key: "connect", label: "Connectivity" },
  { key: "distance", label: "Distances" },
  { key: "talent", label: "Talent" },
  { key: "priorities", label: "Your priorities" },
  { key: "conclusion", label: "Conclusion" },
  { key: "compare", label: "Compare all" }
].filter(t => t.key === "overview" || cmsOn("tab:" + t.key));
function setLevels(lv, preset) {
  S.lv = { ...lv }; S.preset = preset || matchPreset(S.lv);
}
function matchPreset(lv) {
  const k = Object.keys(PRESETS).find(k => PARTS.every(p => PRESETS[k].lv[p.key] === lv[p.key]));
  return k || "custom";
}
const lvCode = (lv) => PARTS.map(p => lv[p.key]).join("");
const lvFrom = (code) => /^[0-4]{6}$/.test(code || "") ? Object.fromEntries(PARTS.map((p, i) => [p.key, +code[i]])) : null;
const presetName = () => PRESETS[S.preset] ? PRESETS[S.preset].label : "your own mix";

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
  const ready = OPEN.length ? O.filter(o => nearestOpen(o).d <= 1).length : 0;
  $("#g-stats").innerHTML = `<span><b>${O.length}</b>buildings</span><span><b>${Z.length}</b>micro-markets</span>`
    + `<span><b>${ready}</b>within 1 km of open rail</span><span><b>${PL.filter(p => p.kind === "studio").length}</b>studios mapped</span>`;
  let handoff = null;
  try { handoff = sessionStorage.getItem("atlas-handoff"); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
  let authed = false;
  try { if (handoff === HANDOFF) sessionStorage.setItem(AUTH_KEY, "1"); authed = sessionStorage.getItem(AUTH_KEY) === "1"; } catch (e) {}
  if (handoff === HANDOFF && CMS) { let id = null; try { id = sessionStorage.getItem("atlas-access-id"); } catch (e) {} CMS.signin(id); }
  if (authed) { $("#gate").remove(); boot(); return; }
  try { if (sessionStorage.getItem("chn-out") === "1") { sessionStorage.removeItem("chn-out"); const e = $("#g-err"); e.style.color = "var(--ok)"; e.textContent = "You have signed out on this device."; } } catch (e) {}
  $("#g-form").addEventListener("submit", e => { e.preventDefault(); $("#g-err").removeAttribute("style"); go(); });
  $("#g-id").focus();
}
/* The hex field backdrop is rendered from the study's own map (the shortlist
   lights the cells it sits in) and committed with the site, so it does not
   depend on any outside service. WebP first, then the JPEG copy; if both
   fail the image is removed and the CSS hex field under it shows instead.
   Phones get the portrait render. */
function loadBackdrop() {
  const img = $("#g-bg"); if (!img) return;
  const b = MEDIA + (matchMedia("(max-aspect-ratio: 3/4)").matches ? "hexfield-tall" : "hexfield-wide");
  const tries = [b + ".webp", b + ".jpg"];
  const next = () => { const u = tries.shift(); if (!u) { img.remove(); return; } img.src = u; };
  img.addEventListener("load", () => img.classList.add("on"));
  img.addEventListener("error", next);
  next();
}
/* Sign out ends this tab's session, clears the hand-off from the site root
   and anything this page keeps on the device, and brings the sign-in page
   back with a note that it worked. Pane widths and dismissed tips are
   preferences, not access, so they stay. */
function signOut() {
  if (CMS) CMS.signout();
  try { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem("atlas-handoff"); sessionStorage.setItem("chn-out", "1"); } catch (e) {}
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
  TALENT_MAX = Math.max(...O.map(talentRaw), 1);
  STUDIO_MAX = Math.max(...O.map(studioRaw), 1);
  if (!window.MAPBOX_TOKEN) return mapUnavailable();
  loadMapbox().then(initMap).catch(mapUnavailable);
}
function boot() {
  booted = true;
  applyRoute(false);
  renderTabs(); renderFilters(); renderList(); renderPanel(); renderLayers();
  wireBoard(); wireSheet(); wirePanes(); wireHints();
  $("#signout").addEventListener("click", signOut);
  $("#sort").dataset.hint = "Order the list by fit to your priorities, distance from the current office, nearest rail or talent reach.";
  addEventListener("popstate", () => applyRoute(true));
  if (map && map.getSource("options")) { refreshMap(); if (S.sel) select(S.sel, true, true); else fitAll(false); }
}
/* Mapbox Standard, the same basemap as the main ATLAS map and the Indore
   study, faded so the pins lead. */
const MAP_STYLE = "mapbox://styles/mapbox/standard";
const BASEMAP = { lightPreset: "day", theme: "faded", showPointOfInterestLabels: true, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true, show3dObjects: true };
function initMap() {
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  const style = window.CHN_MAP_STYLE || MAP_STYLE;
  map = new mapboxgl.Map({
    container: "map", style, center: M.center, zoom: M.zoom, pitch: innerWidth > 860 ? 30 : 0,
    attributionControl: false, projection: "mercator", cooperativeGestures: false, antialias: innerWidth > 860
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
  map.on("load", () => { addLayers(); wireMap(); if (booted && S.sel) select(S.sel, true, true); else fitAll(false); });
}

/* ------------------------------------------------------------ deep links --
   Every view has an address: #/option/chennai-one, #/distance,
   #/priorities/team, or #/priorities/320211 for a hand-set mix, so the BD
   team can send a client exactly the view they discussed. */
function routeHash() {
  if (S.sel) return `#/option/${S.sel}`;
  if (S.tab === "priorities" || S.tab === "conclusion") {
    if (S.preset === "balanced") return `#/${S.tab}`;
    return `#/${S.tab}/${PRESETS[S.preset] ? S.preset : lvCode(S.lv)}`;
  }
  return S.tab === "overview" ? "#/" : `#/${S.tab}`;
}
function pushRoute() { const h = routeHash(); if (location.hash !== h && !(h === "#/" && !location.hash)) history.pushState(null, "", h); }
function applyRoute(render) {
  const [kind, val] = location.hash.replace(/^#\/?/, "").split("/");
  S.sel = null;
  if (kind === "option" && O.some(o => o.id === val)) S.sel = val;
  else if (TABS.some(t => t.key === kind && t.key !== "compare")) {
    S.tab = kind;
    if (kind === "priorities" || kind === "conclusion") {
      if (PRESETS[val]) setLevels(PRESETS[val].lv, val);
      else if (lvFrom(val)) setLevels(lvFrom(val));
    }
  } else S.tab = "overview";
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
  map.fitBounds(b, { padding: padding(), maxZoom: opts.maxZoom || 13.5, pitch: innerWidth > 860 ? 30 : 0, bearing: 0, duration: opts.animate === false || REDUCED() ? 0 : 1100 });
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
const focusOf = (o) => (S.sel === o.id || S.hov === o.id || (S.pair && S.pair.includes(o.id))) ? 2 : !passes(o) ? 0 : (S.sel || S.hov) ? .5 : 1;
const optionFC = () => FC(O.map(o => ({ ...pt(o.lng, o.lat, { id: o.id, n: nn(o), name: o.name, color: ZONE[o.micro].color, foc: focusOf(o) }), id: o.n })));
function ringFC() {
  const o = O.find(x => x.id === S.sel);
  if (!o || !S.layers.rings) return FC([]);
  return FC(RINGS.slice().reverse().map(r => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [circle([o.lng, o.lat], ringKm(r.min))] }, properties: { min: r.min, color: r.color } })));
}
function ringLabelFC() {
  const o = O.find(x => x.id === S.sel);
  if (!o || !S.layers.rings) return FC([]);
  return FC(RINGS.map(r => pt(o.lng, o.lat + ringKm(r.min) / KM_LAT, { label: `${r.min} min` })));
}
/* Links: the open option to its three nearest options, or the pair picked
   on the distance matrix. Each carries its distance at the midpoint. */
function linkFC() {
  const out = [];
  const add = (a, b, kind) => {
    const d = km(a, b);
    out.push(ln([[a.lng, a.lat], [b.lng, b.lat]], { part: "line", kind }));
    out.push(pt((a.lng + b.lng) / 2, (a.lat + b.lat) / 2, { part: "label", kind, label: `${fmtKm(d)} · ~${driveMin(d)} min` }));
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
    pt((o.lng + EX.lng) / 2, (o.lat + EX.lat) / 2, { part: "label", label: `${fmtKm(d)} · ~${driveMin(d)} min to the current office` })]);
}
function railFC() {
  const feats = [], runs = (x) => x.open || x.through;
  for (const L of LINES) {
    const st = L.stations;
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], b = st[i + 1];
      feats.push(ln([[a.lng, a.lat], [b.lng, b.lat]], { line: L.key, color: L.color, open: runs(a) && runs(b) ? 1 : 0, mode: L.mode }));
    }
  }
  return FC(feats);
}
const stationFC = () => FC(STATIONS.map((s, i) => ({ ...pt(s.lng, s.lat, { name: s.name, line: s.lineName, color: s.color, open: s.open ? 1 : 0, target: s.target || "", key: `${s.line}:${s.name}` }), id: i + 1 })));
const COL = { edu: "#5b3aa7", res: "#0a8a3a", studio: "#d0417b", it: "#4a5a6a", hub: "#4a4a4a" };
const placesFC = () => FC(PL.map(p => pt(p.lng, p.lat, { id: p.id, kind: p.kind, name: p.name, color: COL[p.kind] || "#4a4a4a" })));

function add(layer, before) { try { map.addLayer(layer, before); } catch (e) { console.warn("layer", layer.id, e.message); } }
function addLayers() {
  /* zones */
  map.addSource("zones", { type: "geojson", data: FC(Z.map(z => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [zonePolygon(z)] }, properties: { key: z.key, color: z.color } }))) });
  map.addSource("zone-labels", { type: "geojson", data: FC(Z.map(z => pt(...zoneCentre(z), { label: z.label.toUpperCase() }))) });
  add({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": ["get", "color"], "fill-opacity": .12 } });
  add({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": ["get", "color"], "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": .75 } });
  add({ id: "zones-label", type: "symbol", source: "zone-labels", layout: { "text-field": ["get", "label"], "text-size": 12, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-letter-spacing": .18, "text-max-width": 12 },
    paint: { "text-color": "#6c5b4d", "text-opacity": .75, "text-halo-color": "#fff", "text-halo-width": 1.2 } });

  /* drive rings */
  map.addSource("rings", { type: "geojson", data: ringFC() });
  map.addSource("ring-labels", { type: "geojson", data: ringLabelFC() });
  add({ id: "rings-fill", type: "fill", source: "rings", paint: { "fill-color": ["get", "color"], "fill-opacity": .05 } });
  add({ id: "rings-line", type: "line", source: "rings", paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": .8 } });
  add({ id: "rings-label", type: "symbol", source: "ring-labels", layout: { "text-field": ["get", "label"], "text-size": 11, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, -.6] },
    paint: { "text-color": "#a3502c", "text-halo-color": "#fff", "text-halo-width": 1.4 } });

  /* rail: open sections solid, Phase 2 dashed, each in its line colour */
  map.addSource("rail", { type: "geojson", data: railFC() });
  add({ id: "rail-plan", type: "line", source: "rail", filter: ["==", ["get", "open"], 0], layout: { "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 3, "line-dasharray": [1.2, 1.4], "line-opacity": .6 } });
  add({ id: "rail-casing", type: "line", source: "rail", filter: ["==", ["get", "open"], 1], layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#fff", "line-width": 7, "line-opacity": .85 } });
  add({ id: "rail-open", type: "line", source: "rail", filter: ["==", ["get", "open"], 1], layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 4 } });
  const stData = stationFC();
  map.addSource("stations", { type: "geojson", data: stData });
  add({ id: "st-plan", type: "circle", source: "stations", filter: ["==", ["get", "open"], 0], paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 4.5], "circle-color": "#fff", "circle-opacity": .8,
    "circle-stroke-color": ["get", "color"], "circle-stroke-width": 1.2, "circle-stroke-opacity": .7 } });
  add({ id: "st-open", type: "circle", source: "stations", filter: ["==", ["get", "open"], 1], paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.8, 14, 6], "circle-color": "#fff",
    "circle-stroke-color": ["get", "color"], "circle-stroke-width": 2 } });
  map.addSource("stations-lbl", { type: "geojson", data: stData });
  add({ id: "st-label", type: "symbol", source: "stations-lbl", minzoom: 12.4, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
    paint: { "text-color": "#3a3a3a", "text-halo-color": "#fff", "text-halo-width": 1.3 } });

  /* talent and studios */
  const pData = placesFC();
  map.addSource("places", { type: "geojson", data: pData });
  add({ id: "places", type: "circle", source: "places", paint: {
    "circle-radius": ["case", ["==", ["get", "kind"], "res"], 8, ["==", ["get", "kind"], "studio"], 6, 5.5],
    "circle-color": ["get", "color"], "circle-opacity": ["case", ["==", ["get", "kind"], "res"], .25, .9],
    "circle-stroke-color": ["case", ["==", ["get", "kind"], "res"], ["get", "color"], "#fff"], "circle-stroke-width": 1.4 } });
  map.addSource("places-lbl", { type: "geojson", data: pData });
  add({ id: "places-label", type: "symbol", source: "places-lbl", minzoom: 11.8, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"], "text-offset": [0, .95], "text-anchor": "top", "text-optional": true, "text-max-width": 9 },
    paint: { "text-color": ["get", "color"], "text-halo-color": "#fff", "text-halo-width": 1.3 } });

  /* links between options, and to the current office */
  map.addSource("links", { type: "geojson", data: linkFC() });
  map.addSource("links-lbl", { type: "geojson", data: linkFC() });
  add({ id: "links", type: "line", source: "links", filter: ["==", ["get", "part"], "line"], layout: { "line-cap": "round" },
    paint: { "line-color": ["case", ["==", ["get", "kind"], "pair"], "#a3502c", "#6c5b4d"], "line-width": ["case", ["==", ["get", "kind"], "pair"], 3, 1.8], "line-dasharray": [1, 1.2], "line-opacity": .85 } });
  map.addSource("ex-link", { type: "geojson", data: exLinkFC() });
  map.addSource("ex-link-lbl", { type: "geojson", data: exLinkFC() });
  add({ id: "ex-link", type: "line", source: "ex-link", filter: ["==", ["get", "part"], "line"], layout: { "line-cap": "round" },
    paint: { "line-color": "#2a1e16", "line-width": 2.2, "line-dasharray": [1.4, 1.4], "line-opacity": .8 } });
  const exData = pt(EX.lng, EX.lat, { name: EX.name });
  map.addSource("existing", { type: "geojson", data: exData });
  add({ id: "ex-pin", type: "circle", source: "existing", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 9, 15, 13],
    "circle-color": "#2a1e16", "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } });
  add({ id: "ex-dot", type: "circle", source: "existing", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.2, 15, 4.8], "circle-color": "#fff" } });

  /* options */
  map.addSource("options", { type: "geojson", data: optionFC() });
  const foc = ["get", "foc"], col = ["get", "color"];
  add({ id: "opt-halo", type: "circle", source: "options", filter: ["==", foc, 2], paint: {
    "circle-radius": 24, "circle-color": col, "circle-opacity": .16, "circle-stroke-color": col, "circle-stroke-width": 2, "circle-stroke-opacity": .75, "circle-pitch-alignment": "map" } });
  add({ id: "opt", type: "circle", source: "options", paint: {
    "circle-radius": ["case", ["==", foc, 2], 15, ["==", foc, 1], 11, 8], "circle-color": col,
    "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["==", foc, 2], 3, 2],
    "circle-opacity": ["case", ["==", foc, 2], 1, ["==", foc, 0], .18, ["==", foc, .5], .4, 1],
    "circle-stroke-opacity": ["case", ["==", foc, 0], .25, ["==", foc, .5], .5, 1] } });
  map.addSource("options-lbl", { type: "geojson", data: optionFC() });
  add({ id: "opt-num", type: "symbol", source: "options-lbl", layout: { "text-field": ["get", "n"], "text-size": ["case", ["==", foc, 2], 12.5, ["==", foc, 1], 10.5, 9],
    "text-allow-overlap": true, "text-ignore-placement": true, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] },
    paint: { "text-color": "#fff", "text-opacity": ["case", ["==", foc, 0], .3, ["==", foc, .5], .6, 1] } });
  add({ id: "opt-name", type: "symbol", source: "options-lbl", minzoom: 12, filter: ["!=", foc, 2], layout: { "text-field": ["get", "name"], "text-size": 12,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [1.2, 0], "text-anchor": "left", "text-optional": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 1.6, "text-opacity": ["case", ["==", foc, 1], 1, .3] } });
  add({ id: "opt-name-focus", type: "symbol", source: "options-lbl", filter: ["==", foc, 2], layout: { "text-field": ["get", "name"], "text-size": 14,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-offset": [1.6, 0], "text-anchor": "left", "text-allow-overlap": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  map.addSource("existing-lbl", { type: "geojson", data: exData });
  add({ id: "ex-label", type: "symbol", source: "existing-lbl", layout: { "text-field": `${EX.name} · current office`, "text-size": 12,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-offset": [0, 1.4], "text-anchor": "top", "text-allow-overlap": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2 } });
  add({ id: "links-label", type: "symbol", source: "links-lbl", filter: ["==", ["get", "part"], "label"], layout: { "text-field": ["get", "label"],
    "text-size": 11, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": ["case", ["==", ["get", "kind"], "pair"], "#a3502c", "#4a3a2e"], "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  add({ id: "ex-link-label", type: "symbol", source: "ex-link-lbl", filter: ["==", ["get", "part"], "label"], layout: { "text-field": ["get", "label"],
    "text-size": 11.5, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  applyLayerVisibility();
}

/* The layer chips double as the legend. */
const LAYERS = [
  { key: "existing", label: "Current office", sw: `<span class="dot" style="background:#2a1e16;box-shadow:inset 0 0 0 2.5px #2a1e16,inset 0 0 0 5px #fff"></span>`, ids: ["ex-pin", "ex-dot", "ex-label", "ex-link", "ex-link-label"] },
  { key: "zones", label: "Micro-markets", sw: `<span class="sw" style="height:9px;background:rgba(163,80,44,.18);border:1px dashed #a3502c"></span>`, ids: ["zones-fill", "zones-line", "zones-label"] },
  { key: "rail", label: "Rail open", sw: `<span class="sw" style="background:linear-gradient(90deg,#3281C4 25%,#53B848 25% 50%,#FF9900 50% 75%,#6E6E6E 75%)"></span>`, ids: ["rail-open", "rail-casing", "st-open"] },
  { key: "future", label: "Metro Phase 2", sw: `<span class="sw" style="background:repeating-linear-gradient(90deg,#800080 0 3px,transparent 3px 5px,#FF0000 5px 8px,transparent 8px 10px,#e0b800 10px 13px,transparent 13px 15px)"></span>`, ids: ["rail-plan", "st-plan"] },
  { key: "links", label: "Distances", sw: `<span class="sw" style="background:repeating-linear-gradient(90deg,#6c5b4d 0 3px,transparent 3px 6px)"></span>`, ids: ["links", "links-label"] },
  { key: "studio", label: "VFX studios", sw: `<span class="dot" style="background:${COL.studio}"></span>` },
  { key: "it", label: "IT parks", sw: `<span class="dot" style="background:${COL.it}"></span>` },
  { key: "edu", label: "Institutes", sw: `<span class="dot" style="background:${COL.edu}"></span>` },
  { key: "res", label: "Homes", sw: `<span class="dot" style="background:rgba(10,138,58,.22);border:1.5px solid #0a8a3a"></span>` },
  { key: "rings", label: "Drive rings", sw: `<span class="dot" style="background:transparent;border:1.5px solid #a3502c"></span>`, ids: ["rings-fill", "rings-line", "rings-label"] }
];
const LAYER_HINT = {
  existing: "The current office at KRC Commerzone, Porur, with a dashed line and the distance to the open option.",
  zones: "The six micro-markets the shortlist sits in. Outlines are indicative.",
  rail: "Metro, MRTS and suburban rail that run today, in each line's own colour.",
  future: "Chennai Metro Phase 2 corridors under construction, dashed, with their stations.",
  links: "Lines to the three nearest options from the open one, or the pair you picked on the distance matrix.",
  studio: "VFX, animation and post studios: the experienced talent already working in the city.",
  it: "Large IT parks that hire from the same technical pool.",
  edu: "Institutes that train artists and graduates: the fresher pipeline.",
  res: "Residential belts where staff are likely to live.",
  rings: "15, 30 and 45 minute drive rings around the open option."
};
function applyLayerVisibility() {
  if (!map || !map.getLayer("opt")) return;
  for (const l of LAYERS) for (const id of l.ids || []) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", S.layers[l.key] ? "visible" : "none");
  const kinds = ["hub", ...KINDS.filter(k => S.layers[k])];
  for (const id of ["places", "places-label"]) if (map.getLayer(id)) map.setFilter(id, ["in", ["get", "kind"], ["literal", kinds]]);
  const stShow = [S.layers.rail ? 1 : -1, S.layers.future ? 0 : -1];
  if (map.getLayer("st-label")) map.setFilter("st-label", ["in", ["get", "open"], ["literal", stShow]]);
  const set = (src, data) => { const s = map.getSource(src); if (s) s.setData(data); };
  set("rings", ringFC()); set("ring-labels", ringLabelFC());
  const lk = linkFC(); set("links", lk); set("links-lbl", lk);
  const ek = exLinkFC(); set("ex-link", ek); set("ex-link-lbl", ek);
  recede();
}
/* With an option open, only its own context keeps full weight: stations
   within 2 km and places inside its 30 minute ring. */
function recede() {
  if (!map || !map.getLayer("opt")) return;
  const o = S.sel && O.find(x => x.id === S.sel);
  const set = (id, prop, v) => { if (map.getLayer(id)) try { map.setPaintProperty(id, prop, v); } catch (e) {} };
  if (!o) {
    set("st-open", "circle-opacity", 1); set("st-open", "circle-stroke-opacity", 1); set("st-label", "text-opacity", 1);
    set("places", "circle-opacity", ["case", ["==", ["get", "kind"], "res"], .25, .9]); set("places", "circle-stroke-opacity", 1); set("places-label", "text-opacity", 1);
    set("zones-fill", "fill-opacity", .12); set("zones-label", "text-opacity", .75);
    return;
  }
  const nearSt = STATIONS.filter(s => km(o, s) <= 2).map(s => `${s.line}:${s.name}`);
  const nearPl = PL.filter(p => km(o, p) <= ringKm(30)).map(p => p.id);
  const inSt = ["in", ["get", "key"], ["literal", nearSt]], inPl = ["in", ["get", "id"], ["literal", nearPl]];
  set("st-open", "circle-opacity", ["case", inSt, 1, .4]); set("st-open", "circle-stroke-opacity", ["case", inSt, 1, .4]);
  set("st-label", "text-opacity", ["case", inSt, 1, .3]);
  set("places", "circle-opacity", ["case", inPl, ["case", ["==", ["get", "kind"], "res"], .25, .9], .15]);
  set("places", "circle-stroke-opacity", ["case", inPl, 1, .25]); set("places-label", "text-opacity", ["case", inPl, 1, .25]);
  set("zones-fill", "fill-opacity", .05); set("zones-label", "text-opacity", .35);
}
let pulseRaf = null;
function pulse() {
  if (pulseRaf || REDUCED()) return;
  const t0 = performance.now();
  const step = (t) => {
    if (!map || !map.getLayer("opt-halo") || (!S.sel && !S.hov && !S.pair)) { pulseRaf = null; return; }
    const k = (Math.sin((t - t0) / 520) + 1) / 2;
    try { map.setPaintProperty("opt-halo", "circle-radius", 20 + k * 10); map.setPaintProperty("opt-halo", "circle-opacity", .22 - k * .14); } catch (e) {}
    pulseRaf = requestAnimationFrame(step);
  };
  pulseRaf = requestAnimationFrame(step);
}
function refreshPins() {
  if (!map || !map.getSource("options")) return;
  const fc = optionFC();
  map.getSource("options").setData(fc);
  if (map.getSource("options-lbl")) map.getSource("options-lbl").setData(fc);
  if (S.sel || S.hov || S.pair) pulse();
}
function refreshMap() {
  if (!map || !map.getSource("options")) return;
  refreshPins(); applyLayerVisibility();
}
function wireMap() {
  const pop = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
  const hover = (layer, html) => {
    map.on("mouseenter", layer, e => { map.getCanvas().style.cursor = "pointer"; const f = e.features[0]; pop.setLngLat(f.geometry.coordinates).setHTML(html(f.properties)).addTo(map); });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; pop.remove(); });
  };
  hover("opt", p => { const o = O.find(x => x.id === p.id), r = nearestOpen(o);
    return `<div class="pop">${tile(o, "pop")}<div><b>${nn(o)} · ${esc(o.name)}</b><br>${esc(ZONE[o.micro].label)}<br>${fmtKm(exKm(o))} from the current office<br>${fmtM(r.d)} to ${esc(r.s.name)} (${esc(r.s.lineName)})<br>Fit ${score(o)} on ${esc(presetName().toLowerCase())}</div></div>`; });
  hover("places", p => { const x = PL.find(y => y.id === p.id);
    const kind = { edu: "Institute", res: "Residential belt", studio: "VFX / post studio", it: "IT park", hub: "Transport" }[x.kind];
    return `<b>${esc(x.name)}</b>${x.sub ? `<br>${esc(x.sub)}` : ""}<br><span style="color:#6c5b4d">${kind}</span><br>${esc(x.note)}`; });
  hover("st-open", p => `<b>${esc(p.name)}</b><br>${esc(p.line)} · open`);
  hover("st-plan", p => `<b>${esc(p.name)}</b><br>${esc(p.line)} · not open yet${p.target ? `<br>${esc(p.target)}` : ""}`);
  hover("ex-pin", () => { const r = nearestOpen(EX), o = S.sel && O.find(x => x.id === S.sel);
    return `<b>${esc(EX.name)}</b><br>Current office · ${esc(EX.locality)}<br>Nearest open rail: ${esc(r.s.name)}, ${fmtM(r.d)}${o ? `<br>${fmtKm(exKm(o))} from ${esc(o.name)}` : ""}`; });
  map.on("click", "opt", e => select(e.features[0].properties.id, true));
  map.on("mousemove", "opt", e => { const id = e.features[0].properties.id; if (id !== S.sel && S.hov !== id) { S.hov = id; refreshPins(); } });
  map.on("mouseleave", "opt", () => { if (S.hov) { S.hov = null; refreshPins(); } });
}

/* ============================================================ board ===== */
/* A satellite crop only where the building itself is pinned; anything less
   exact gets its micro-market colour and number, so the picture never shows
   the wrong building. */
function satUrl(o, w, h, z) {
  if (!window.MAPBOX_TOKEN || o.precision !== "building") return "";
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${o.lng},${o.lat},${z},0/${w}x${h}@2x?access_token=${encodeURIComponent(window.MAPBOX_TOKEN)}&attribution=false&logo=false`;
}
function tile(o, kind) {
  const u = satUrl(o, 124, 112, 16.2);
  return `<span class="tile" style="--z:${ZONE[o.micro].color}" aria-hidden="true">${u && kind !== "pop" ? `<img src="${u}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}<span>${nn(o)}</span></span>`;
}
function renderFilters() {
  const all = [...ZONE_FILTERS, ...OTHER_FILTERS];
  $("#filters").innerHTML = all.map(f => `<button class="chip ${S.filters.has(f.key) ? "on" : ""}" data-f="${f.key}" type="button" aria-pressed="${S.filters.has(f.key)}" data-hint="${esc(ZONE[f.key] ? `Keep only options in ${ZONE[f.key].name}.` : "Keep only options within 1 km of an open metro, MRTS or suburban station.")}">${ZONE[f.key] ? `<span class="dot" style="background:${ZONE[f.key].color};margin:0"></span>` : ""}${esc(f.label)}</button>`).join("");
}
function sorted() {
  const by = {
    score: byFit,
    home: (a, b) => exKm(a) - exKm(b),
    rail: (a, b) => nearestOpen(a).d - nearestOpen(b).d,
    talent: (a, b) => (talentRaw(b) + studioRaw(b)) - (talentRaw(a) + studioRaw(a)) || a.n - b.n,
    sheet: (a, b) => a.n - b.n
  }[S.sort];
  return O.slice().sort(by);
}
function renderList() {
  const shown = O.filter(passes);
  $("#b-count").textContent = `${shown.length} of ${O.length} options`;
  $("#b-sub").textContent = S.sort === "score" ? presetName() : "";
  $("#list").innerHTML = sorted().map(o => {
    const r = nearestOpen(o);
    return `<button class="card ${S.sel === o.id ? "sel" : ""} ${passes(o) ? "" : "dim"}" data-id="${o.id}" role="listitem" type="button" data-hint="${esc(`Open ${o.name}: the map flies in, the nearest options and the current office are drawn with their distances.`)}">
      ${tile(o)}
      <div>
        <div class="nm"><span class="no">${nn(o)}</span>${esc(o.name)}</div>
        <div class="loc">${esc(o.sheetMicro)}</div>
        <div class="facts"><span title="Distance from the current office">${fmtKm(exKm(o))} from office</span><span title="Nearest open rail station">${fmtM(r.d)} to ${esc(MODE_WORD[r.s.mode])}</span><span class="zt" style="--z:${ZONE[o.micro].color}"><i></i>${esc(ZONE[o.micro].label)}</span>${flagChip(o)}</div>
      </div>
      <span class="score" title="Fit to your priorities, out of 100">${score(o)}</span>
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
  const hov = (id) => { if (S.hov === id) return; S.hov = id; refreshPins(); };
  $("#list").addEventListener("mouseover", e => { const c = e.target.closest("[data-id]"); if (c && c.dataset.id !== S.sel) hov(c.dataset.id); });
  $("#list").addEventListener("mouseleave", () => hov(null));
  $("#list").addEventListener("focusin", e => { const c = e.target.closest("[data-id]"); if (c && c.dataset.id !== S.sel) hov(c.dataset.id); });
  $("#list").addEventListener("focusout", () => hov(null));
  $("#tabs").addEventListener("click", e => {
    const t = e.target.closest("[data-t]"); if (!t) return;
    if (t.dataset.t === "compare") { openCompare(); return; }
    goTab(t.dataset.t);
  });
  $("#layers").addEventListener("click", e => {
    const b = e.target.closest("[data-l]"); if (!b) return;
    S.layers[b.dataset.l] = !S.layers[b.dataset.l]; renderLayers(); applyLayerVisibility();
  });
  $("#p-body").addEventListener("click", e => {
    const ix = e.target.closest("[data-intro-x]"); if (ix) { seenIntro.add(ix.dataset.introX); saveIntro(); ix.closest(".intro").outerHTML = introCard(ix.dataset.introX); return; }
    const io = e.target.closest("[data-intro-open]"); if (io) { seenIntro.delete(io.dataset.introOpen); saveIntro(); io.outerHTML = introCard(io.dataset.introOpen); return; }
    const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); select(a.dataset.go, true); return; }
    const t = e.target.closest("[data-tab]"); if (t) { e.preventDefault(); goTab(t.dataset.tab); return; }
    const pr = e.target.closest("[data-preset]"); if (pr) { setLevels(PRESETS[pr.dataset.preset].lv, pr.dataset.preset); afterWeights(); return; }
    const lv = e.target.closest("[data-lv]"); if (lv) { const [k, v] = lv.dataset.lv.split(":"); setLevels({ ...S.lv, [k]: +v }); afterWeights(lv.dataset.lv); return; }
    const mx = e.target.closest("[data-mx]"); if (mx) { pickPair(mx.dataset.mx.split("|")); mx.classList.add("on"); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { copyLink(cp); return; }
    if (e.target.closest("[data-print]")) { window.print(); return; }
    if (e.target.closest("[data-compare]")) { openCompare(); return; }
    const img = e.target.closest(".hero img"); if (img) { const lb = $("#lightbox"); lb.querySelector("img").src = img.currentSrc || img.src; lb.classList.add("on"); }
  });
  $("#p-head").addEventListener("click", e => {
    if (e.target.closest(".back")) { S.sel = null; renderList(); renderPanel(); refreshMap(); fitAll(); pushRoute(); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { copyLink(cp); return; }
    const sh = e.target.closest("[data-shot]"); if (sh) { flyToOption(O.find(x => x.id === S.sel), sh.dataset.shot); return; }
    if (e.target.closest("[data-print]")) window.print();
  });
  $("#lightbox").addEventListener("click", () => $("#lightbox").classList.remove("on"));
  $("#cmp-x").addEventListener("click", () => $("#cmp").classList.remove("on"));
  addEventListener("keydown", e => { if (e.key === "Escape") { $("#cmp").classList.remove("on"); $("#lightbox").classList.remove("on"); } });
}
/* After the chooser changes: re-rank everything that depends on weights and
   keep the keyboard where it was. */
function afterWeights(focusKey) {
  const y = $("#p-body").scrollTop;
  renderList(); renderPanel(); refreshPins();
  history.replaceState(null, "", routeHash());
  $("#p-body").scrollTop = y;
  if (focusKey) { const b = $(`[data-lv="${focusKey}"]`); if (b) b.focus(); }
}

/* ---------------------------------------------------------- camera ------ */
const SHOT_ZOOM = { building: 17.2, street: 16.3, locality: 15.2 };
const SHOTS = {
  close: { label: "Close-up", hint: "Tilted view down onto the building and its streets." },
  street: { label: "Street", hint: "Low angle, as you would approach it by road." },
  area: { label: "Catchment", hint: "Top-down view of the 15, 30 and 45 minute drive rings." }
};
function flyToOption(o, shot) {
  if (!map || !o) return;
  S.shot = shot || "close";
  const phone = innerWidth <= 860, z = SHOT_ZOOM[o.precision] || 15.2, pad = padding();
  if (S.shot === "area") {
    const b = circle([o.lng, o.lat], ringKm(30), 16).reduce((bb, p) => bb.extend(p), new mapboxgl.LngLatBounds());
    map.fitBounds(b, { padding: pad, pitch: 0, bearing: 0, duration: REDUCED() ? 0 : 1200 });
  } else {
    const s = S.shot === "street" ? { zoom: z + .5, pitch: phone ? 60 : 72, bearing: -25 } : { zoom: z, pitch: phone ? 45 : 58, bearing: 30 };
    map.flyTo({ center: [o.lng, o.lat], ...s, padding: pad, duration: REDUCED() ? 0 : 1700, curve: 1.42, essential: true });
  }
  document.querySelectorAll("[data-shot]").forEach(b => { b.classList.toggle("on", b.dataset.shot === S.shot); b.setAttribute("aria-pressed", b.dataset.shot === S.shot); });
}
const PRECISION_TEXT = { building: "Pinned to the building", street: "Pinned to the street, building approximate", locality: "Neighbourhood only, exact building not confirmed" };
const shotBar = (o) => `<div class="shots" role="group" aria-label="Camera">${Object.entries(SHOTS).map(([k, v]) =>
  `<button type="button" class="shot ${S.shot === k ? "on" : ""}" data-shot="${k}" aria-pressed="${S.shot === k}" data-hint="${esc(v.hint)}">${v.label}</button>`).join("")}
  <span class="prec ${o.precision}" data-hint="How exactly this option is placed on the map">${PRECISION_TEXT[o.precision] || "Position approximate"}</span></div>`;

function select(id, fly, fromRoute) {
  if (document.body.classList.contains("fold-panel")) setFold("panel", false);
  S.sel = id; S.hov = null; S.pair = null; if (fly) S.shot = "close"; renderList(); renderPanel(); refreshMap();
  if (!fromRoute) pushRoute();
  if (innerWidth <= 860 && !fromRoute) setSheet("half");
  const card = document.querySelector(`.card[data-id="${id}"]`); if (card) card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
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
    `<span class="key note" title="Rail lines are drawn station to station; zone outlines are indicative">ⓘ schematic</span>`;
}

/* ============================================================ guide =====
   "What to expect" cards at the top of each view, and hover hints on
   anything clickable. Dismissed cards fold to a one-line link and the
   choice is remembered on this device. */
const GUIDE = {
  overview: { hint: "The short answer: what stands out, and the top three on your priorities.",
    items: ["Each insight card answers one question a client asks first. Click it to open that option.",
      "The top three follow your priorities. Change them on Your priorities and this view follows.",
      "Every option shows its distance from the current office, its nearest rail and its fit."] },
  markets: { hint: "The six micro-markets: rent, vacancy, who is there, pros and cons.",
    items: ["One card per micro-market, with the options that sit in it.",
      "Rents and vacancy are quoted from the source named under each figure, with its date."] },
  connect: { hint: "How people get to each option, today and once Phase 2 opens.",
    items: ["The nearest open metro, MRTS or suburban station for every option, and how you get from it.",
      "The nearest Phase 2 metro station under construction, with its reported target.",
      "Turn on Rail open and Metro Phase 2 in the map bar to see the lines."] },
  distance: { hint: "How far every option is from every other option and from the current office.",
    items: ["The matrix is ordered by micro-market, so clusters show as dark blocks.",
      "Click any cell: the map draws that pair and its distance.",
      "The bars below show how far each option moves the team from today's office."] },
  talent: { hint: "Where artists train, where they live and where experienced ones already work.",
    items: ["For each option: institutes and residential belts inside 30 minutes (the talent pool), and VFX studios inside 30 minutes (the existing pool).",
      "Turn on VFX studios, Institutes, Homes and IT parks in the map bar to see them."] },
  priorities: { hint: "Tell us what matters most; the ranking follows.",
    items: ["Answer six questions from Skip to Critical, or start from a preset.",
      "The top three, the list on the left, the pins and the Conclusion all re-rank as you go.",
      "Copy link keeps your answers, so the client can open the same ranking."] },
  conclusion: { hint: "The answer on your priorities, how robust it is, and what to check next.",
    items: ["The lead option on your current priorities and why.",
      "How often each option makes the top three across every preset, so you can see which choices hold up.",
      "The best option in each micro-market, and the next steps for site visits."] },
  compare: { hint: "Every option side by side, with the six questions to re-weight." },
  option: { items: ["The map flies to the building, draws its three nearest options and the current office with distances.",
      "Close-up, Street and Catchment change the camera. The label beside them says how exactly the building is placed.",
      "Below: rail today and next, distance from the current office, talent within reach and the fit score part by part.",
      "Back returns to the section you came from."] }
};
let seenIntro = new Set();
try { seenIntro = new Set(JSON.parse(localStorage.getItem("chn-intro") || "[]")); } catch (e) {}
const saveIntro = () => { try { localStorage.setItem("chn-intro", JSON.stringify([...seenIntro])); } catch (e) {} };
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
  else ({ overview: renderOverview, markets: renderMarkets, connect: renderConnect, distance: renderDistance, talent: renderTalent, priorities: renderPriorities, conclusion: renderConclusion }[S.tab] || renderOverview)();
  $("#p-body").insertAdjacentHTML("afterbegin", introCard(S.sel ? "option" : S.tab));
}
const head = (eyebrow, title, lede) => { $("#p-head").innerHTML = `<div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${lede ? `<div class="lede">${lede}</div>` : ""}`; };
const factList = (arr) => (arr || []).length ? `<ul class="facts">${arr.map(f => `<li class="fact"><span class="k">${esc(f.k)}.</span> ${esc(f.v)}<span class="conf ${esc(f.conf)}">${esc(f.conf)}</span>
  <div class="meta">${esc(f.asOf)}${f.note ? " · " + esc(f.note) : ""}${f.src ? " · " + cite(f.src) : ""}</div></li>`).join("")}</ul>` : `<p class="note">No sourced figure yet.</p>`;
const optLink = (o) => `<a href="#" data-go="${o.id}">${nn(o)} ${esc(o.name)}</a>`;
/* "Check first" notes: things to confirm before relying on an option. */
const flagBox = (o) => o.flag ? `<div class="flag"><b>Check first</b>${esc(o.flag.v)} ${cite(o.flag.src)}</div>` : "";
/* Updates from broker links, approved and published in /admin/. */
const marketHTML = (o) => o.cmsExtra && o.cmsExtra.length ? `<h3>Latest from the market</h3><table class="spec">${o.cmsExtra.map(x => `<tr><th>${esc(x.label)}</th><td>${esc(x.value)}${x.by || x.asOf ? ` <span class="src">· broker-stated${x.asOf ? ", " + esc(x.asOf) : ""}</span>` : ""}</td></tr>`).join("")}</table>` : "";
const flagChip = (o) => o.flag ? `<span class="chk" title="${esc(o.flag.v)}">check first</span>` : "";
const actions = (extra = "") => `<div class="actions">${extra}<button type="button" class="act" data-copy data-hint="Copies a link that opens exactly this view, ready to send to a client.">Copy link</button><button type="button" class="act" data-print data-hint="Prints this view, or saves it as a PDF from the print dialog.">Print / PDF</button></div>`;
const zoneTag = (z) => `<span class="zt" style="--z:${z.color}"><i></i>${esc(z.label)}</span>`;
const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/* ---------- Overview ---------- */
function renderOverview() {
  const ranked = O.slice().sort(byFit);
  const near = O.filter(o => nearestOpen(o).d <= 1), nextNear = O.filter(o => { const n = nearestPlan(o); return n && n.d <= 1; });
  const homes = O.map(exKm);
  head("Autopilot · Chennai · Oct 2026", "Where the next Chennai office should go",
    `${O.length} shortlisted buildings in ${Z.length} micro-markets, placed on the rail network and read against talent and today's office at ${esc(EX.name)}, ${esc(EX.locality)}.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act pri" data-tab="priorities">Set your priorities</button>`));
  const top = ranked.slice(0, 3).map(o => `<li>${optLink(o)} <span class="mono" style="color:var(--mut)">${score(o)}/100</span> ${flagChip(o)}<br><span class="note">${esc(whyLine(o))}</span></li>`).join("");
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">What stands out</h3>
    ${insightsHTML()}
    <div class="kpis">
      <div class="kpi"><div class="l">Options</div><div class="v">${O.length}</div><div class="s">in ${Z.length} micro-markets</div></div>
      <div class="kpi"><div class="l">Rail ≤ 1 km today</div><div class="v">${near.length}</div><div class="s">open metro, MRTS or train</div></div>
      <div class="kpi"><div class="l">Phase 2 ≤ 1 km</div><div class="v">${nextNear.length}</div><div class="s">metro under construction</div></div>
      <div class="kpi"><div class="l">From today's office</div><div class="v" style="font-size:16px">${fmtKm(Math.min(...homes))} to ${fmtKm(Math.max(...homes))}</div><div class="s">median ${fmtKm(median(homes))}</div></div>
      <div class="kpi"><div class="l">Studios mapped</div><div class="v">${PL.filter(p => p.kind === "studio").length}</div><div class="s">VFX, animation, post</div></div>
      <div class="kpi"><div class="l">Talent points</div><div class="v">${PL.filter(p => p.kind === "edu" || p.kind === "res").length}</div><div class="s">institutes and belts</div></div>
    </div>
    <h3>Top three on ${esc(presetName().toLowerCase())}</h3>
    <ol style="padding-left:18px;margin:0;line-height:1.5;font-size:13px">${top}</ol>
    <p class="note">Change what matters on <a href="#" data-tab="priorities">Your priorities</a>; the answer and its reasons are on <a href="#" data-tab="conclusion">Conclusion</a>.</p>
    <h3>The micro-markets in one line each</h3>
    ${Z.map(z => { const os = O.filter(o => o.micro === z.key);
      return `<div class="fact">${zoneTag(z)} <span class="k">${esc(z.name)}</span> <span class="note">· ${os.length} option${os.length === 1 ? "" : "s"}</span><br><span class="note">${esc(z.character)}</span><br>${os.map(optLink).join(" · ")}</div>`; }).join("")}
    <h3>How to read this study</h3>
    <p class="note">The shortlist (names, micro-markets and addresses) is the client's sheet. Positions, rail, talent and market facts come from the public sources linked beside each one. Distances are straight-line on the map; drive times use one stated speed. ${esc(METHOD)}</p>`;
}
function whyLine(o) {
  const p = scoreParts(o), w = W();
  const strong = PARTS.filter(x => w[x.key] > 0 && p[x.key] >= .75).sort((a, b) => w[b.key] * p[b.key] - w[a.key] * p[a.key]).slice(0, 3).map(x => x.noun);
  const r = nearestOpen(o);
  return `${strong.length ? `Strong on ${strong.join(", ")}. ` : ""}${fmtKm(exKm(o))} from today's office; ${fmtM(r.d)} to ${r.s.name} (${r.s.lineName}).`;
}
function insightsHTML() {
  const top = (f) => O.slice().sort((a, b) => f(b) - f(a) || a.n - b.n)[0];
  const cnt = (o, kinds, i) => kinds.reduce((t, k) => t + upTo(catchOf(o), i, k), 0);
  const best = top(exact), home = top(o => -exKm(o)), rail = top(o => -nearestOpen(o).d);
  const tal = top(o => cnt(o, ["edu", "res"], 1) + talentRaw(o) / 1000), stu = top(o => cnt(o, ["studio"], 1) + studioRaw(o) / 1000);
  const fut = top(o => futureV(o)), fN = nearestPlan(fut);
  const cheapZ = Z.filter(z => rentMid(z) != null).sort((a, b) => rentMid(a) - rentMid(b))[0];
  const tc = catchOf(tal), sc = catchOf(stu), rr = nearestOpen(rail);
  const cards = [
    { l: "Best fit", v: best.name, s: `${score(best)}/100 on ${presetName().toLowerCase()}${levelWith(best).length ? `, level with ${levelWith(best)[0].name}` : ""}`, go: best.id, tone: "lead" },
    { l: "Closest to today's office", v: fmtKm(exKm(home)), s: `${home.name}, about ${driveMin(exKm(home))} min by road`, go: home.id },
    { l: "Closest to open rail", v: fmtM(rr.d), s: `${rail.name}, to ${rr.s.name} (${rr.s.lineName})`, go: rail.id },
    { l: "Deepest talent pool", v: tal.name, s: `${upTo(tc, 1, "edu")} institutes, ${upTo(tc, 1, "res")} belts in 30 min`, go: tal.id },
    { l: "Most studios nearby", v: stu.name, s: `${upTo(sc, 1, "studio")} VFX and post studios in 30 min, ${upTo(sc, 2, "studio")} in 45`, go: stu.id },
    { l: "Best metro pipeline", v: fut.name, s: fN ? `${fmtM(fN.d)} to ${fN.s.name} (${fN.s.lineName})${fN.s.target ? `, ${fN.s.target}` : ""}` : "", go: fut.id }
  ];
  if (cheapZ) cards.push({ l: "Lowest rent band", v: cheapZ.label, s: `INR ${cheapZ.rent.lo}-${cheapZ.rent.hi} a sq ft a month quoted (Savills, ${cheapZ.rent.asOf})`, tab: "markets" });
  return `<div class="ins" role="list">${cards.map(c => `<button type="button" role="listitem" class="in ${c.tone || ""}" ${c.go ? `data-go="${c.go}"` : `data-tab="${c.tab}"`} data-hint="${c.go ? "Open this option: the map flies in and its details open." : "Open the micro-market overview."}">
    <span class="l">${esc(c.l)}</span><span class="v">${esc(c.v)}</span><span class="s">${esc(c.s)}</span></button>`).join("")}</div>`;
}
function verdictHTML(o, p) {
  const good = PARTS.filter(x => p[x.key] >= .8).map(x => x.label);
  const weak = PARTS.filter(x => p[x.key] <= .3).map(x => x.label);
  return `<div class="verdict">${good.map(g => `<span class="vd up">✓ ${esc(g)}</span>`).join("")}${weak.map(w => `<span class="vd dn">! ${esc(w)}</span>`).join("")}</div>`;
}

/* ---------- Micro-markets ---------- */
const figure = (f) => f && f.v ? `<span>${esc(f.v)}${f.conf === "low" ? `<span class="conf low">low</span>` : ""}<span class="src" style="display:block;margin-top:2px">${esc(f.asOf || "")}${f.src ? " · " + cite(f.src) : ""}</span>${f.alt ? `<span class="note" style="display:block;margin-top:3px">${esc(f.alt.v)} ${cite(f.alt.src)}</span>` : ""}</span>` : `<span class="note">Not published for this micro-market</span>`;
const zoneSources = (z) => (z.sources || []).length ? `<div class="src" style="margin-top:8px">Sources for the points above: ${z.sources.map(u => cite(u)).join(" · ")}</div>` : "";
function renderMarkets() {
  head("Micro-market overview", "Six micro-markets, one shortlist", "What each part of the city is like for an office, what it costs and who is already there. Figures are quoted with their source and date.");
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">The micro-markets</h3>
    ${Z.map(z => { const os = O.filter(o => o.micro === z.key);
      return `<div class="zc" style="--z:${z.color}">
        <div class="zh"><b>${esc(z.name)}</b>${zoneTag(z)}<span class="note">${os.length} option${os.length === 1 ? "" : "s"}</span></div>
        <div class="note">${esc(z.character)}</div>
        <div class="zk"><div><span class="l">Rent</span>${figure(z.rent)}</div><div><span class="l">Vacancy</span>${figure(z.vacancy)}</div><div><span class="l">Stock / supply</span>${figure(z.stock)}</div></div>
        ${z.occupiers && z.occupiers.v ? `<div class="note"><b style="color:var(--ink)">Who is there:</b> ${esc(z.occupiers.v)} ${cite(z.occupiers.src)}</div>` : ""}
        <div class="pc"><div class="pro"><h4>For a studio</h4><ul>${(z.pros || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div class="con"><h4>Watch</h4><ul>${(z.cons || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
        ${zoneSources(z)}
        <div class="note" style="margin-top:8px">Options here: ${os.map(optLink).join(" · ")}</div>
      </div>`; }).join("")}
    <p class="note">All six rent, vacancy and stock figures come from one source (Savills, Dec 2025) so they compare like for like; the line under each is the newest figure from another broker. They are micro-market bands, not the asking rent of any building on the list.</p>
    <h3>Chennai office market</h3>
    ${factList(F.market)}`;
}

/* ---------- Connectivity ---------- */
function renderConnect() {
  head("Connectivity", "How people get to each option", `Nearest open station today, and the nearest Chennai Metro Phase 2 station being built. Network as of ${esc(TR.asOfText || TR.asOf)}.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const air = (TR.anchors || []).find(a => a.id === "airport"), cen = (TR.anchors || []).find(a => a.id === "central");
  const rows = O.slice().sort((a, b) => nearestOpen(a).d - nearestOpen(b).d).map(o => {
    const r = nearestOpen(o), f = nearestPlan(o);
    return `<tr><td>${optLink(o)}<br>${zoneTag(ZONE[o.micro])}</td>
      <td><b class="num">${fmtM(r.d)}</b> to ${esc(r.s.name)}<br><span class="note">${esc(r.s.lineName)} · ${esc(accessWord(r.d))}</span></td>
      <td>${f ? `<b class="num">${fmtM(f.d)}</b> to ${esc(f.s.name)}<br><span class="note">${esc(f.s.lineName)}${f.s.target ? ` · ${esc(f.s.target)}` : ""}</span>` : "-"}</td>
      ${air ? `<td class="num">${fmtKm(km(o, air))}<br><span class="note">~${driveMin(km(o, air))} min</span></td>` : ""}</tr>`;
  }).join("");
  const lines = LINES.map(L => {
    const open = L.stations.filter(s => s.open).length;
    const soon = L.stations.find(x => !x.open && x.opens);
    return `<div class="fact"><span class="sw" style="background:${L.color};${open ? "" : `background:repeating-linear-gradient(90deg,${L.color} 0 4px,transparent 4px 7px)`}"></span><span class="k">${esc(L.name)}</span> <span class="note">· ${open ? `${open} of ${L.stations.length} stations shown open` : soon ? `opens ${esc(soon.target.replace(/^Opens /, ""))}` : "under construction"}</span>${L.note ? `<br><span class="note">${esc(L.note)}</span>` : ""}${L.src ? ` <span class="src">${cite(L.src)}</span>` : ""}</div>`;
  }).join("");
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">Nearest station for each option</h3>
    <table class="ring-tbl"><thead><tr><th style="width:26%">Option</th><th>Nearest open station</th><th>Nearest Phase 2 metro</th>${air ? `<th class="num">Airport</th>` : ""}</tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Straight-line distance from the pin to the station. Walk time at 80 m a minute where it is under 1.2 km. ${esc(METHOD)}</p>
    <h3>From the current office</h3>
    <p class="vsx">${esc(EX.name)} is ${fmtM(nearestOpen(EX).d)} from ${esc(nearestOpen(EX).s.name)} (${esc(nearestOpen(EX).s.lineName)})${nearestPlan(EX) ? ` and ${fmtM(nearestPlan(EX).d)} from ${esc(nearestPlan(EX).s.name)} on ${esc(nearestPlan(EX).s.lineName)}` : ""}.${cen ? ` Chennai Central is ${fmtKm(km(EX, cen))} away.` : ""}</p>
    <h3>The network</h3>
    ${lines}
    <h3>What has changed and what is coming</h3>
    ${factList(F.transit)}`;
}

/* ---------- Distances ---------- */
const MX_ORDER = () => Z.flatMap(z => O.filter(o => o.micro === z.key).sort((a, b) => a.n - b.n));
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
  if (box) { const d = km(a, b); box.innerHTML = `<b>${esc(a.name)}</b> to <b>${esc(b.name)}</b>: ${fmtKm(d)} straight line, about ${driveMin(d)} min by road. <span class="note">Drawn on the map.</span>`; }
  document.querySelectorAll("table.mx td.on").forEach(td => td.classList.remove("on"));
  if (map) fitPoints([[a.lng, a.lat], [b.lng, b.lat]], { maxZoom: 14 });
  if (innerWidth <= 860) setSheet("peek");
}
function renderDistance() {
  head("Distance between options", "How far apart the shortlist is", "Every option against every other option and against today's office. Straight-line kilometres; click a cell to draw the pair on the map.");
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const list = MX_ORDER(), all = [EX, ...list];
  let max = 0, pairs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const d = km(list[i], list[j]); max = Math.max(max, d); pairs.push({ a: list[i], b: list[j], d }); }
  pairs.sort((x, y) => x.d - y.d);
  const far = pairs[pairs.length - 1], close = pairs[0];
  const lab = (o) => o === EX ? "Now" : nn(o);
  const cell = (r, c) => {
    if (r === c) return `<td class="self">·</td>`;
    const d = km(r, c), col = mxColor(d, max);
    return `<td data-mx="${r.id}|${c.id}" style="background:${col.bg};color:${col.fg}" title="${esc(r.name)} to ${esc(c.name)}: ${fmtKm(d)}, about ${driveMin(d)} min">${d < 10 ? d.toFixed(1) : Math.round(d)}</td>`;
  };
  const table = `<div class="mx-wrap"><table class="mx"><thead><tr><th></th>${all.map(c => `<th title="${esc(c.name)}" style="${c === EX ? "" : `box-shadow:inset 0 -3px 0 ${ZONE[c.micro].color}`}">${lab(c)}</th>`).join("")}</tr></thead>
    <tbody>${all.map(r => `<tr class="${r === EX ? "ex" : ""}"><th title="${esc(r.name)}">${r === EX ? `Today · ${esc(EX.name)}` : `${nn(r)} ${esc(r.name)}`}</th>${all.map(c => cell(r, c)).join("")}</tr>`).join("")}</tbody></table></div>`;
  /* Clusters: options that sit within 2.5 km of another, chained. */
  const groups = [], seen = new Set();
  for (const o of list) {
    if (seen.has(o.id)) continue;
    const g = [o]; seen.add(o.id);
    for (let k = 0; k < g.length; k++) for (const x of list) if (!seen.has(x.id) && km(g[k], x) <= 2.5) { g.push(x); seen.add(x.id); }
    groups.push(g);
  }
  const clusters = groups.filter(g => g.length > 1).sort((a, b) => b.length - a.length);
  const lone = groups.filter(g => g.length === 1).map(g => g[0]);
  const spread = (g) => { let m = 0; for (const a of g) for (const b of g) m = Math.max(m, km(a, b)); return m; };
  const homeMax = Math.max(...O.map(exKm));
  const homeBars = O.slice().sort((a, b) => exKm(a) - exKm(b)).map(o => `<div class="r"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${optLink(o)}</span><div class="tr"><div class="fl" style="width:${Math.round(exKm(o) / homeMax * 100)}%"></div></div><span class="v">${fmtKm(exKm(o))} · ${driveMin(exKm(o))}′</span></div>`).join("");
  $("#p-body").innerHTML = `
    <div class="kpis" style="margin-top:14px">
      <div class="kpi"><div class="l">Closest pair</div><div class="v">${fmtKm(close.d)}</div><div class="s">${esc(close.a.name)} and ${esc(close.b.name)}</div></div>
      <div class="kpi"><div class="l">Farthest pair</div><div class="v">${fmtKm(far.d)}</div><div class="s">${esc(far.a.name)} and ${esc(far.b.name)}</div></div>
      <div class="kpi"><div class="l">Clusters</div><div class="v">${clusters.length}</div><div class="s">groups within 2.5 km of each other</div></div>
    </div>
    <h3>The matrix</h3>
    <div class="mx-leg"><span>Near</span><span class="ramp"></span><span>Far (${fmtKm(max)})</span><span style="margin-left:auto">Ordered by micro-market</span></div>
    <div id="mx-pick" class="mx-pick">Click any cell to draw that pair on the map.</div>
    ${table}
    <h3>Clusters</h3>
    ${clusters.map(g => `<div class="fact">${zoneTag(ZONE[g[0].micro])} <span class="k">${g.length} options within ${fmtKm(spread(g))} of each other</span><br>${g.map(optLink).join(" · ")}</div>`).join("")}
    ${lone.length ? `<div class="fact"><span class="k">Stand-alone</span> <span class="note">(no other option within 2.5 km)</span><br>${lone.map(optLink).join(" · ")}</div>` : ""}
    <h3>How far each option moves the team from today's office</h3>
    <div class="nb">${homeBars}</div>
    <p class="note" style="margin-top:8px">${esc(METHOD)}</p>`;
}

/* ---------- Talent ---------- */
function renderTalent() {
  head("Talent", "Where artists train, live and already work", "The talent pool is institutes and residential belts within 30 minutes. The existing pool is VFX, animation and post studios within 30 minutes, the people you can hire with experience.");
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const rows = O.slice().sort((a, b) => (talentRaw(b) + studioRaw(b)) - (talentRaw(a) + studioRaw(a)) || a.n - b.n).map(o => {
    const c = catchOf(o), ns = nearestStudio(o);
    return `<tr><td>${optLink(o)}</td><td class="num">${upTo(c, 1, "edu")}</td><td class="num">${upTo(c, 1, "res")}</td><td class="num"><b>${upTo(c, 1, "studio")}</b> <span class="note">/ ${upTo(c, 2, "studio")}</span></td><td class="num">${upTo(c, 0, "it")}</td><td>${ns ? `${esc(ns.s.name)}<br><span class="note">${fmtKm(ns.d)}</span>` : "-"}</td></tr>`;
  }).join("");
  const ex = catchOf(EX);
  const listOf = (kind, dotVar) => PL.filter(p => p.kind === kind).map(p => `<div class="fact"><span class="dot" style="background:var(${dotVar})"></span><span class="k">${esc(p.name)}</span> <span class="note">${esc(p.sub || "")}</span><br><span class="note">${esc(p.note)}${p.size ? ` · ${esc(p.size)}` : ""} ${p.src ? cite(p.src) : ""}</span></div>`).join("") || `<p class="note">None mapped.</p>`;
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">Reach by option</h3>
    <table class="ring-tbl"><thead><tr><th>Option</th><th class="num">Institutes ≤30′</th><th class="num">Homes ≤30′</th><th class="num">Studios ≤30′ / 45′</th><th class="num">IT parks ≤15′</th><th>Nearest studio</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">For comparison, today's office reaches ${upTo(ex, 1, "edu")} institutes, ${upTo(ex, 1, "res")} residential belts and ${upTo(ex, 1, "studio")} studios within 30 minutes (${upTo(ex, 2, "studio")} within 45). IT parks compete for the same technical hires. ${esc(METHOD)} Positions of belts and some institutes are approximate.</p>
    <h3>City and state facts</h3>
    ${factList(F.talent)}
    <h3>Studios already in the city (existing talent pool)</h3>
    ${listOf("studio", "--studio")}
    <h3>Institutes (talent pool)</h3>
    ${listOf("edu", "--edu")}
    <h3>Residential belts (talent pool)</h3>
    ${listOf("res", "--res")}
    <h3>IT parks hiring from the same pool</h3>
    ${listOf("it", "--it")}`;
}

/* ---------- Your priorities (the chooser) ---------- */
function podiumHTML() {
  const r = O.slice().sort(byFit).slice(0, 3);
  return `<div class="podium">${r.map((o, i) => `<button type="button" data-go="${o.id}" data-hint="Open ${esc(o.name)}"><span class="p">${["First", "Second", "Third"][i]}</span><span class="n">${esc(o.name)}</span><span class="s">${score(o)}/100 · ${esc(ZONE[o.micro].label)}</span></button>`).join("")}</div>`;
}
function renderPriorities() {
  head("Your priorities", "What matters most to you?", "Answer six questions. Each one weighs a measure from the map; the ranking, the list, the pins and the conclusion follow straight away.");
  $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act pri" data-tab="conclusion">See the conclusion</button>`));
  const base = rankWith(wOf(PRESETS.balanced.lv)).map(o => o.id);
  const cur = O.slice().sort(byFit);
  const w = W(), tw = PARTS.reduce((s, x) => s + w[x.key], 0) || 1;
  const rows = cur.map((o, i) => {
    const d = base.indexOf(o.id) - i;
    const dl = S.preset === "balanced" ? "" : d > 0 ? `<span class="dl up" title="Up ${d} against Balanced">▲ ${d}</span>` : d < 0 ? `<span class="dl dn" title="Down ${-d} against Balanced">▼ ${-d}</span>` : `<span class="dl">-</span>`;
    return `<div class="rk"><span class="pos">${i + 1}</span><span class="nm">${optLink(o)}</span>
      <div class="tr" aria-hidden="true"><div class="fl" style="width:${score(o)}%;background:${ZONE[o.micro].color}"></div></div><span class="val">${score(o)}</span>${dl}</div>`;
  }).join("");
  const q = PARTS.map(p => `<div class="cq"><div class="qh"><b>${esc(p.label)}</b><span class="pct">${Math.round(w[p.key] / tw * 100)}% of the score</span></div>
    <div class="qs">${esc(p.q)}</div>
    <div class="seg" role="radiogroup" aria-label="${esc(p.label)}">${LEVELS.map((l, i) => `<button type="button" role="radio" aria-checked="${S.lv[p.key] === i}" class="${S.lv[p.key] === i ? "on" : ""} l${i}" data-lv="${p.key}:${i}">${l.l}</button>`).join("")}</div></div>`).join("");
  $("#p-body").innerHTML = `
    <div class="sticky-res"><div class="note" style="margin-bottom:6px">Top three on <b style="color:var(--ink)">${esc(presetName())}</b></div>${podiumHTML()}</div>
    <h3>Start from a preset</h3>
    <div class="presets" role="group" aria-label="Presets">${Object.entries(PRESETS).map(([k, v]) => `<button type="button" class="chip ${S.preset === k ? "on" : ""}" aria-pressed="${S.preset === k}" data-preset="${k}" data-hint="${esc(v.note)}">${esc(v.label)}</button>`).join("")}${S.preset === "custom" ? `<span class="chip on" aria-current="true">Your own mix</span>` : ""}</div>
    <p class="lede" style="margin-top:8px">${esc(PRESETS[S.preset] ? PRESETS[S.preset].note : "Your own answers below.")}</p>
    <h3>Or answer each question</h3>
    <div class="chooser">${q}</div>
    <h3>Full ranking${S.preset !== "balanced" ? " · arrows show the move against Balanced" : ""}</h3>
    <div class="rks">${rows}</div>
    <p class="note" style="margin-top:10px">How each measure is scored: ${PARTS.map(p => `<b>${esc(p.label)}</b>, ${esc(p.of)}`).join("; ")}. Talent and studio counts are scaled against the best option on the list.</p>`;
}

/* ---------- Conclusion ---------- */
function renderConclusion() {
  const ranked = O.slice().sort(byFit), lead = ranked[0], second = ranked[1], third = ranked[2];
  const p = scoreParts(lead), r = nearestOpen(lead), f = nearestPlan(lead), c = catchOf(lead);
  const pri = topParts().slice(0, 2).map(x => x.noun);
  head("Conclusion", `On ${esc(presetName().toLowerCase())}, ${esc(lead.name)} leads`, "The answer follows the priorities you set. Below: why it leads, how robust that is, and what to check before signing.");
  $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act" data-tab="priorities">Change priorities</button>`));
  /* Robustness: how often each option is in the top three across presets. */
  const presetRanks = Object.entries(PRESETS).map(([k, v]) => ({ k, v, top: rankWith(wOf(v.lv)).slice(0, 3) }));
  const tally = new Map(O.map(o => [o.id, 0]));
  presetRanks.forEach(pr => pr.top.forEach(o => tally.set(o.id, tally.get(o.id) + 1)));
  const robust = O.filter(o => tally.get(o.id) > 0).sort((a, b) => tally.get(b.id) - tally.get(a.id) || exact(b) - exact(a));
  const zoneBest = Z.map(z => { const os = O.filter(o => o.micro === z.key).sort(byFit); return { z, best: os[0], avg: os.reduce((s, o) => s + exact(o), 0) / os.length, n: os.length }; }).sort((a, b) => exact(b.best) - exact(a.best));
  /* The move: best option that keeps the team close, against the lead. */
  const stay = O.slice().sort((a, b) => exKm(a) - exKm(b))[0];
  const gap = exact(lead) - exact(second);
  const firm = gap >= 4 ? "a clear lead" : gap >= 1.5 ? "a modest lead" : "a lead within a point or two, so treat the top two as joint";
  const clean = ranked.find(o => !o.flag);
  const leadStrong = PARTS.filter(x => p[x.key] >= .75 && S.lv[x.key] > 0).map(x => x.noun);
  const leadWeak = PARTS.filter(x => p[x.key] <= .35 && S.lv[x.key] > 0).map(x => x.noun);
  $("#p-body").innerHTML = `
    <div class="verd" style="margin-top:14px">
      <div class="l">The answer on your priorities${pri.length ? ` · led by ${esc(pri.join(" and "))}` : ""}</div>
      <div class="h">${esc(lead.name)}, ${esc(lead.sheetMicro)}</div>
      <p>${score(lead)}/100, ${esc(firm)} over ${optLinkLight(second)} (${score(second)}) and ${optLinkLight(third)} (${score(third)}).</p>
      <p>${fmtKm(exKm(lead))} from today's office (about ${driveMin(exKm(lead))} min by road), ${fmtM(r.d)} to ${esc(r.s.name)} on ${esc(r.s.lineName)}${f ? `, ${fmtM(f.d)} to ${esc(f.s.name)} on ${esc(f.s.lineName)}${f.s.target ? ` (${esc(f.s.target)})` : ""}` : ""}. Within 30 minutes: ${upTo(c, 1, "edu")} institutes, ${upTo(c, 1, "res")} residential belts and ${upTo(c, 1, "studio")} studios.</p>
      ${leadStrong.length || leadWeak.length ? `<p>${leadStrong.length ? `Strong on ${esc(listJoin(leadStrong))}.` : ""} ${leadWeak.length ? `Weaker on ${esc(listJoin(leadWeak))}, which is the trade-off to accept.` : ""}</p>` : ""}
      ${lead.flag ? `<p class="vchk"><b>Check first.</b> ${esc(lead.flag.v)} ${clean && clean.id !== lead.id ? `If it is not available, the best option without an open question is ${optLinkLight(clean)} (${score(clean)}/100, ${esc(clean.sheetMicro)}).` : ""}</p>` : ""}
    </div>
    <h3>How robust is that?</h3>
    <table class="rob"><thead><tr><th>If the priority is</th><th>First</th><th>Second</th><th>Third</th></tr></thead>
      <tbody>${presetRanks.map(pr => `<tr><td>${esc(pr.v.label)}</td>${pr.top.map(o => `<td>${optLink(o)}${o.flag ? " " + flagChip(o) : ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <p class="note">${robust.slice(0, 3).map(o => `<b>${esc(o.name)}</b> makes the top three in ${tally.get(o.id)} of ${presetRanks.length}`).join("; ")}. An option that holds up across most presets is the safer recommendation if priorities are still moving.</p>
    <h3>Best in each micro-market</h3>
    <table class="rob"><thead><tr><th>Micro-market</th><th>Best option</th><th class="num">Fit</th><th class="num">Zone average</th></tr></thead>
      <tbody>${zoneBest.map(x => `<tr><td>${zoneTag(x.z)}</td><td>${optLink(x.best)}</td><td class="num">${score(x.best)}</td><td class="num">${Math.round(x.avg)}${x.n > 1 ? ` <span class="note">(${x.n})</span>` : ""}</td></tr>`).join("")}</tbody></table>
    <h3>The trade-off in one line</h3>
    <p class="vsx">${stay.id === lead.id
      ? `${esc(lead.name)} is also the shortest move from today's office, so on these priorities there is no trade-off between keeping the team and the other measures.`
      : `${esc(stay.name)} keeps the team closest (${fmtKm(exKm(stay))} from today's office, fit ${score(stay)}). ${esc(lead.name)} moves it ${fmtKm(exKm(lead))} in exchange for ${esc(gainsOver(lead, stay))}.`}</p>
    <h3>Before signing: what to check on site</h3>
    <ol class="steps">${(M.nextSteps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    <p class="note" style="margin-top:10px">Scores come only from position, rail, talent and micro-market rent on this map. Floor plates, rent quotes, power and fit-out terms are not in the shortlist yet; they decide between options that score close together.</p>`;
}
const optLinkLight = (o) => `<a href="#" data-go="${o.id}">${esc(o.name)}</a>`;
const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
function gainsOver(a, b) {
  const pa = scoreParts(a), pb = scoreParts(b), out = [];
  const ra = nearestOpen(a), rb = nearestOpen(b);
  if (pa.rail - pb.rail > .1) out.push(`closer rail (${fmtM(ra.d)} against ${fmtM(rb.d)})`);
  const ca = catchOf(a), cb = catchOf(b);
  const ta = upTo(ca, 1, "edu") + upTo(ca, 1, "res"), tb = upTo(cb, 1, "edu") + upTo(cb, 1, "res");
  if (ta > tb) out.push(`a larger talent pool (${ta} against ${tb} institutes and belts within 30 min)`);
  const sa = upTo(ca, 1, "studio"), sb = upTo(cb, 1, "studio");
  if (sa > sb) out.push(`more studios nearby (${sa} against ${sb} within 30 min)`);
  if (pa.future - pb.future > .1) out.push("a closer Phase 2 metro station");
  if (pa.rent - pb.rent > .1) out.push("a cheaper micro-market");
  return out.length ? listJoin(out) : "a better balance across your priorities";
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
const PANE = { board: { v: "--board-w", min: 260, max: 520, def: 340 }, panel: { v: "--panel-w", min: 400, max: 860, def: 520 } };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
function setPaneW(k, px, save = true) {
  const c = PANE[k], w = Math.round(Math.min(c.max, Math.max(c.min, px), innerWidth * .45));
  document.documentElement.style.setProperty(c.v, w + "px");
  if (save) store.set("chn-w-" + k, String(w));
}
function setFold(k, on) {
  document.body.classList.toggle("fold-" + k, on);
  store.set("chn-fold-" + k, on ? "1" : "");
  const pane = document.getElementById(k);
  if (on && pane.contains(document.activeElement)) document.querySelector(`.reopen-${k}`).focus();
  clearTimeout(setFold.t);
  setFold.t = setTimeout(() => { if (!map) return; if (S.sel) flyToOption(O.find(x => x.id === S.sel), S.shot); else fitAll(); }, 320);
}
function wirePanes() {
  for (const k of ["board", "panel"]) {
    const v = Number(store.get("chn-w-" + k)); if (v) setPaneW(k, v, false);
    if (store.get("chn-fold-" + k) === "1" && innerWidth > 860) setFold(k, true);
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

/* ---------- Option ---------- */
function renderOption(o) {
  const p = scoreParts(o), z = ZONE[o.micro], c = catchOf(o), r = nearestOpen(o), f = nearestPlan(o), w = W();
  const rank = O.slice().sort(byFit).findIndex(x => x.id === o.id) + 1;
  const backTo = TABS.find(t => t.key === S.tab) || TABS[0];
  $("#p-head").innerHTML = `<button class="back" type="button">← Back to ${esc(backTo.label)}</button>
    <div class="eyebrow">Option ${nn(o)} · ${esc(o.sheetMicro)}</div>
    <h2>${esc(o.name)}</h2>${verdictHTML(o, p)}${shotBar(o)}${actions()}`;
  const sat = satUrl(o, 640, 250, 16.6);
  const others = O.filter(x => x.id !== o.id).map(x => ({ x, d: km(o, x) })).sort((a, b) => a.d - b.d);
  const nbMax = others[others.length - 1].d;
  const anchors = (TR.anchors || []).map(a => ({ ...a, d: km(o, a) }));
  const ringRows = c.map((rr, i) => `<tr><td>≤ ${rr.min} min <span class="note">(${rr.km.toFixed(1)} km)</span></td><td class="num">${upTo(c, i, "edu")}</td><td class="num">${upTo(c, i, "res")}</td><td class="num">${upTo(c, i, "studio")}</td><td class="num">${upTo(c, i, "it")}</td></tr>`).join("");
  const within = (kind, i) => c.slice(0, i + 1).flatMap(x => x[kind]).sort((a, b) => a.d - b.d);
  const ex = catchOf(EX), mo = nearestOpen(o), mx = nearestOpen(EX);
  const delta = (a, b, moreIsGood) => { const v = a - b; if (!v) return `<span class="dl">same</span>`; return `<span class="dl ${(v > 0) === moreIsGood ? "up" : "dn"}">${v > 0 ? "+" : "−"}${Math.abs(v)}</span>`; };
  const mDelta = Math.round((mo.d - mx.d) * 1000);
  const mTxt = Math.abs(mDelta) < 150 ? `<span class="dl">about the same</span>` : `<span class="dl ${mDelta < 0 ? "up" : "dn"}">${mDelta < 0 ? "closer" : "farther"} by ${fmtM(Math.abs(mDelta) / 1000)}</span>`;
  $("#p-body").innerHTML = `
    ${sat ? `<div class="hero"><img src="${sat}" alt="Satellite view of ${esc(o.name)}" onerror="this.closest('.hero').remove()"><span class="ph">Satellite · © Mapbox © Maxar</span></div>` : ""}
    <div class="kpis">
      <div class="kpi"><div class="l">From today's office</div><div class="v">${fmtKm(exKm(o))}</div><div class="s">about ${driveMin(exKm(o))} min by road</div></div>
      <div class="kpi"><div class="l">Rail today</div><div class="v">${fmtM(r.d)}</div><div class="s">${esc(r.s.name)} · ${esc(r.s.lineName)}</div></div>
      <div class="kpi"><div class="l">Metro coming</div><div class="v">${f ? fmtM(f.d) : "-"}</div><div class="s">${f ? `${esc(f.s.name)} · ${esc(f.s.lineName)}${f.s.target ? ` · ${esc(f.s.target)}` : ""}` : ""}</div></div>
      <div class="kpi"><div class="l">Talent ≤30 min</div><div class="v">${upTo(c, 1, "edu") + upTo(c, 1, "res")}</div><div class="s">${upTo(c, 1, "edu")} institutes · ${upTo(c, 1, "res")} belts</div></div>
      <div class="kpi"><div class="l">Studios ≤30 min</div><div class="v">${upTo(c, 1, "studio")}</div><div class="s">${upTo(c, 2, "studio")} within 45 min · VFX, animation, post</div></div>
      <div class="kpi"><div class="l">Fit</div><div class="v">${score(o)}<span style="font-size:13px;color:var(--mut)">/100</span></div><div class="s">rank ${rank} of ${O.length} on ${esc(presetName().toLowerCase())}</div></div>
    </div>

    ${flagBox(o)}
    ${marketHTML(o)}
    <h3>Against today's office</h3>
    <p class="vsx"><b>${fmtKm(exKm(o))} from ${esc(EX.name)}</b>, about ${driveMin(exKm(o))} min by road. ${esc(moveRead(exKm(o)))}</p>
    <table class="ring-tbl"><thead><tr><th></th><th>${esc(EX.name)} (today)</th><th>${esc(o.name)}</th></tr></thead><tbody>
      <tr><td>Micro-market</td><td>${esc(ZONE[EX.micro] ? ZONE[EX.micro].label : EX.locality)}</td><td>${esc(z.label)} ${EX.micro === o.micro ? `<span class="dl">same</span>` : `<span class="dl dn">different</span>`}</td></tr>
      <tr><td>Nearest open rail</td><td>${esc(mx.s.name)} · ${fmtM(mx.d)}</td><td>${esc(mo.s.name)} · ${fmtM(mo.d)} ${mTxt}</td></tr>
      <tr><td>Institutes ≤30 min</td><td class="num">${upTo(ex, 1, "edu")}</td><td class="num">${upTo(c, 1, "edu")} ${delta(upTo(c, 1, "edu"), upTo(ex, 1, "edu"), true)}</td></tr>
      <tr><td>Residential belts ≤30 min</td><td class="num">${upTo(ex, 1, "res")}</td><td class="num">${upTo(c, 1, "res")} ${delta(upTo(c, 1, "res"), upTo(ex, 1, "res"), true)}</td></tr>
      <tr><td>Studios ≤30 min</td><td class="num">${upTo(ex, 1, "studio")}</td><td class="num">${upTo(c, 1, "studio")} ${delta(upTo(c, 1, "studio"), upTo(ex, 1, "studio"), true)}</td></tr>
    </tbody></table>

    <h3>Nearest other options</h3>
    <div class="nb">${others.slice(0, 5).map(({ x, d }) => `<div class="r"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${optLink(x)}</span><div class="tr"><div class="fl" style="width:${Math.max(3, Math.round(d / nbMax * 100))}%"></div></div><span class="v">${fmtKm(d)} · ${driveMin(d)}′</span></div>`).join("")}</div>
    <p class="note">The three nearest are drawn on the map. Every pair is on <a href="#" data-tab="distance">Distances</a>.</p>

    <h3>Fit, part by part</h3>
    <div class="bars">${PARTS.map(x => `<div class="bar" title="${esc(x.of)}"><span>${esc(x.label)}</span><div class="tr"><div class="fl" style="width:${Math.round(p[x.key] * 100)}%"></div></div><span class="val">${w[x.key] ? `${(p[x.key] * 100).toFixed(0)} · ×${w[x.key]}` : "skipped"}</span></div>`).join("")}</div>
    <p class="note">Each bar is the measure out of 100; ×n is the weight from <a href="#" data-tab="priorities">Your priorities</a>.</p>

    <h3>Talent within reach</h3>
    <table class="ring-tbl"><thead><tr><th>Drive time</th><th class="num">Institutes</th><th class="num">Homes</th><th class="num">Studios</th><th class="num">IT parks</th></tr></thead><tbody>${ringRows}</tbody></table>
    <div class="two" style="margin-top:8px">
      <div class="box"><h4>Studios inside 30 min</h4><div class="plc">${within("studio", 1).map(x => `<span title="${esc(x.note)}"><span class="dot" style="background:var(--studio)"></span>${esc(x.name)} · ${x.d.toFixed(1)} km</span>`).join("") || "<span>None mapped</span>"}</div></div>
      <div class="box"><h4>Institutes and homes inside 30 min</h4><div class="plc">${[...within("edu", 1), ...within("res", 1)].map(x => `<span title="${esc(x.note)}"><span class="dot" style="background:${x.kind === "edu" ? "var(--edu)" : "var(--res)"}"></span>${esc(x.name)} · ${x.d.toFixed(1)} km</span>`).join("") || "<span>None mapped</span>"}</div></div>
    </div>
    <p class="note" style="margin-top:6px">${esc(METHOD)}</p>

    <h3>The micro-market</h3>
    <div class="zc" style="--z:${z.color}"><div class="zh"><b>${esc(z.name)}</b></div><div class="note">${esc(z.character)}</div>
      <div class="zk"><div><span class="l">Rent</span>${figure(z.rent)}</div><div><span class="l">Vacancy</span>${figure(z.vacancy)}</div><div><span class="l">Stock / supply</span>${figure(z.stock)}</div></div></div>

    ${anchors.length ? `<h3>How far from the anchors</h3><table class="spec">${anchors.map(a => `<tr><th>${esc(a.name)}</th><td>${fmtKm(a.d)} straight line · about ${driveMin(a.d)} min by road</td></tr>`).join("")}</table>` : ""}

    <h3>From the shortlist</h3>
    <table class="spec">
      <tr><th>Name on the sheet</th><td>${esc(o.sheetName)}</td></tr>
      <tr><th>Micro-market on the sheet</th><td>${esc(o.sheetMicro)}</td></tr>
      <tr><th>Address</th><td>${esc(o.address)}</td></tr>
      ${(o.facts || []).map(x => `<tr><th>${esc(x.k)}</th><td>${esc(x.v)} ${cite(x.src)}</td></tr>`).join("")}
    </table>
    <h3>Where it sits on the map</h3>
    <p class="note">Precision: <b>${esc(o.precision)}</b>. ${esc(o.geoNote)} ${o.geoSrc ? cite(o.geoSrc, "source") : ""}</p>`;
}
function moveRead(d) {
  const m = driveMin(d);
  if (d < 2) return "Next door. Today's team keeps its commute; the choice is about the building.";
  if (d < 6) return `Same side of the city. Commutes change by up to about ${m} min each way for some staff.`;
  if (d < 12) return `Across town. Some staff gain and some lose up to about ${m} min each way; map where today's team lives before deciding.`;
  return `A real relocation, about ${m} min each way by road. Expect some of today's team to weigh the move; plan retention and transport before committing.`;
}

/* ============================================================ compare == */
function openCompare() { $("#cmp").classList.add("on"); renderCompare(); }
window.openCompare = openCompare;
let CMP_SORT = "score";
function renderCompare() {
  const list = O.slice().sort((a, b) => CMP_SORT === "sheet" ? a.n - b.n : byFit(a, b));
  const best = (fn, hi = true) => { const v = list.map(fn); const t = hi ? Math.max(...v) : Math.min(...v); return (o) => fn(o) === t; };
  const air = (TR.anchors || []).find(a => a.id === "airport");
  const rows = [
    ["Fit (your priorities)", o => `<b>${score(o)}</b>/100`, best(score)],
    ["Micro-market", o => zoneTag(ZONE[o.micro])],
    ["Address (sheet)", o => esc(o.address)],
    ["From today's office", o => `${fmtKm(exKm(o))} · ~${driveMin(exKm(o))} min`, best(o => -exKm(o))],
    ["Nearest open rail", o => { const r = nearestOpen(o); return `${esc(r.s.name)} (${esc(r.s.lineName)}) · ${fmtM(r.d)}`; }, best(o => -nearestOpen(o).d)],
    ["Nearest Phase 2 metro", o => { const f = nearestPlan(o); return f ? `${esc(f.s.name)} · ${fmtM(f.d)}${f.s.target ? ` · ${esc(f.s.target)}` : ""}` : "-"; }, best(o => futureV(o))],
    ["Institutes ≤30 min", o => String(upTo(catchOf(o), 1, "edu")), best(o => upTo(catchOf(o), 1, "edu"))],
    ["Residential belts ≤30 min", o => String(upTo(catchOf(o), 1, "res")), best(o => upTo(catchOf(o), 1, "res"))],
    ["Studios ≤30 / ≤45 min", o => `${upTo(catchOf(o), 1, "studio")} / ${upTo(catchOf(o), 2, "studio")}`, best(studioRaw)],
    ["Nearest studio", o => { const s = nearestStudio(o); return s ? `${esc(s.s.name)} · ${fmtKm(s.d)}` : "-"; }, best(o => -(nearestStudio(o) || { d: 99 }).d)],
    ["IT parks ≤15 min", o => String(upTo(catchOf(o), 0, "it"))],
    ["Micro-market rent", o => { const z = ZONE[o.micro]; return z.rent && z.rent.v ? esc(z.rent.v) : "-"; }, best(o => scoreParts(o).rent)],
    ...(air ? [["Airport", o => `${fmtKm(km(o, air))} · ~${driveMin(km(o, air))} min`, best(o => -km(o, air))]] : []),
    ["Map precision", o => esc(o.precision)]
  ];
  $("#cmp-body").innerHTML = `
    <div class="sortrow" style="margin:12px 0 4px;flex-wrap:wrap;gap:10px">
      ${PARTS.map(p => `<label style="display:flex;flex-direction:column;gap:2px;min-width:120px">${esc(p.label)}<select data-cw="${p.key}">${LEVELS.map((l, i) => `<option value="${i}" ${S.lv[p.key] === i ? "selected" : ""}>${l.l}</option>`).join("")}</select></label>`).join("")}
      <label style="display:flex;flex-direction:column;gap:2px;min-width:120px">Order<select id="cmp-sort"><option value="score" ${CMP_SORT === "score" ? "selected" : ""}>Fit</option><option value="sheet" ${CMP_SORT === "sheet" ? "selected" : ""}>Shortlist order</option></select></label>
    </div>
    <p class="note" style="margin:0 0 8px">The selectors are the same six questions as Your priorities. Shaded cells are the best value in the row. Click a column head to open that option.</p>
    <div style="overflow:auto"><table class="cmp"><thead><tr><th></th>${list.map(o => `<th data-open="${o.id}">${nn(o)} ${esc(o.name)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(([l, fn, b]) => `<tr><th>${esc(l)}</th>${list.map(o => `<td class="${b && b(o) ? "best" : ""}">${fn(o)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  $("#cmp-body").querySelectorAll("[data-cw]").forEach(s => s.addEventListener("change", e => {
    setLevels({ ...S.lv, [e.target.dataset.cw]: +e.target.value }); renderCompare(); renderList(); renderPanel(); refreshPins();
    const again = $(`#cmp-body [data-cw="${e.target.dataset.cw}"]`); if (again) again.focus();
  }));
  $("#cmp-sort").addEventListener("change", e => { CMP_SORT = e.target.value; renderCompare(); });
  $("#cmp-body").querySelectorAll("[data-open]").forEach(h => h.addEventListener("click", () => { $("#cmp").classList.remove("on"); select(h.dataset.open, true); }));
}

initGate();
