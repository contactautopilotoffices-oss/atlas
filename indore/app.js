/* ============================================================================
   ATLAS · INDORE OFFICE STUDY

   Built from the same parts as the Digitide command centre (front-end gate,
   Mapbox map behind glass panes, cited facts) and the client property
   template (option cards, spec sheet, catchment bands), then taken further in
   the directions this brief needs:

     catchment     drive-time rings from any option, with the institutions,
                   residential belts and rival employers that fall inside
     employability talent pool, wages, attrition and night-shift rules, per
                   option as well as for the city
     transit       the real metro, as opened on 6 Sep 2026, beside what the
                   deck says about it

   Files: data.js holds every fact and says where each came from. This file
   only reads it; it never invents a number that is not derived on screen.
   ============================================================================ */
"use strict";

/* Access gate. Same pattern as /digitide/, with one change: the page holds
   only a SHA-256 of the normalised "ID:PASSWORD", so the password is not
   readable in the source. It is still a browser-side check: it keeps a
   casual visitor out of the view, it does not make data.js private. The site
   root login routes here via clients/manifest.js. */
const GATE_HASH = "f9d02aff981245d59ef77ee1074fdadde41a1f2b40c8b122226eea45b8e86331";
async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const MEDIA = "../media/indore/";
const base = (f) => f.replace(/\.jpg$/, "");
/* Photos ship as WebP with the JPEG as fallback; the option list uses 240 px
   thumbnails (about 5 KB each) instead of the full photos. */
const pic = (o, size) => size === "thumb"
  ? `<picture><source type="image/webp" srcset="${MEDIA}${base(o.photo)}-thumb.webp"><img src="${MEDIA}${base(o.photo)}-thumb.jpg" alt="" width="74" height="62" loading="lazy" decoding="async"></picture>`
  : `<picture><source type="image/webp" srcset="${MEDIA}${base(o.photo)}.webp"><img src="${MEDIA}${o.photo}" alt="${esc(o.name)}" width="1040" height="627" decoding="async"></picture>`;
const figPic = (f, alt) => `<picture><source type="image/webp" srcset="${MEDIA}${base(f)}.webp"><img src="${MEDIA}${f}" alt="${esc(alt)}" loading="lazy" decoding="async"></picture>`;

const O = window.IND_OPTIONS, M = window.IND_META, F = window.IND_FACTS;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inr = (n) => n == null ? "n/a" : Math.round(n).toLocaleString("en-IN");
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cite = (u, label) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || host(u))} ↗</a>` : "";
const TODAY = new Date(M.asOf + "T00:00:00");

/* ------------------------------------------------------------ geometry -- */
const R = 6371;
function km(a, b) {
  const toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/* Offsets in km to lng/lat at Indore's latitude. Good to well under 1% over
   the 30 km the study covers. */
const KM_LAT = 110.57, KM_LNG = 111.32 * Math.cos(22.74 * Math.PI / 180);
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
/* A stadium-shaped band of half-width w km around a segment. */
function band(a, b, w) {
  const ax = a[0] * KM_LNG, ay = a[1] * KM_LAT, bx = b[0] * KM_LNG, by = b[1] * KM_LAT;
  const ang = Math.atan2(by - ay, bx - ax), pts = [];
  for (let i = 0; i <= 24; i++) { const t = ang - Math.PI / 2 - i / 24 * Math.PI; pts.push([(bx + w * Math.cos(t + Math.PI)) / KM_LNG, (by + w * Math.sin(t + Math.PI)) / KM_LAT]); }
  for (let i = 0; i <= 24; i++) { const t = ang + Math.PI / 2 - i / 24 * Math.PI; pts.push([(ax + w * Math.cos(t + Math.PI)) / KM_LNG, (ay + w * Math.sin(t + Math.PI)) / KM_LAT]); }
  pts.push(pts[0]);
  return pts;
}
function zonePolygon(z) {
  const s = z.shape;
  return s.type === "band" ? band(s.from, s.to, s.w) : ellipse(s.c, s.rx, s.ry);
}

/* ------------------------------------------------------------ catchment --
   Drive-time rings are straight-line radii at an assumed average speed. They
   are not routed isochrones; the method line says so wherever they appear. */
const SPEED_KMH = 22;              // peak-hour average for city driving, assumed
const ROAD_FACTOR = 1.3;           // straight line to road distance, assumed
const RINGS = [
  { min: 15, color: "#a3502c" },
  { min: 30, color: "#c8693a" },
  { min: 45, color: "#d9a07a" }
];
const ringKm = (min) => min / 60 * SPEED_KMH / ROAD_FACTOR;
const driveMin = (k) => Math.round(k * ROAD_FACTOR / SPEED_KMH * 60);
const METHOD = `Rings are straight-line radii for 15, 30 and 45 minutes of driving at ${SPEED_KMH} km/h with a ${ROAD_FACTOR}x road factor. Indicative, not routed.`;

function catchment(o) {
  const out = RINGS.map(r => ({ min: r.min, km: ringKm(r.min), edu: [], res: [], emp: [] }));
  for (const p of window.IND_PLACES) {
    if (!["edu", "res", "emp"].includes(p.kind)) continue;
    const d = km(o, p), i = out.findIndex(r => d <= r.km);
    if (i >= 0) out[i][p.kind].push({ ...p, d });
  }
  return out;
}
/* cumulative counts up to and including ring i */
const upTo = (c, i, kind) => c.slice(0, i + 1).reduce((s, r) => s + r[kind].length, 0);

/* --------------------------------------------------------------- metro -- */
const STN = window.IND_METRO.stations;
function stationFor(name) {
  const n = name.toLowerCase();
  return STN.find(s => n.includes(s.name.toLowerCase()) || (s.alias || []).some(a => n.includes(a.toLowerCase().replace(" metro station", ""))));
}
function deckStations(o) {
  return o.commute.split("/").map(s => s.trim()).map(s => ({ label: s, stn: stationFor(s) }));
}

/* ------------------------------------------------- existing building ---- */
/* NRK Star is the building in use today. Each option is read against it so
   the move itself is visible: distance, metro, talent reach and rivals. */
const EX = window.IND_EXISTING;
const nearestOpen = (p) => STN.filter(s => s.open).map(s => ({ s, d: km(p, s) })).sort((a, b) => a.d - b.d)[0];
const fmtKm = (d) => `${d < 1 ? d.toFixed(2) : d.toFixed(1)} km`;
/* The deck prints metro distances in metres; this adds the same in km. */
const metroKm = (o) => fmtKm(o.commuteM / 1000);
const exKm = (o) => km(o, EX);
function moveRead(d) {
  const m = driveMin(d);
  if (d < 1) return "Next door. Existing staff keep their commute; the choice is about the building, not the location.";
  if (d < 3) return `Same neighbourhood. Commutes for existing staff change by a few minutes at most.`;
  if (d < 8) return `Across town. Some staff gain and some lose up to about ${m} min each way; worth mapping where the current team lives.`;
  return `A real relocation. Commutes for existing staff change by up to about ${m} min each way; plan for retention before committing.`;
}
/* One link per option, loaded once; the map filters to the open option.
   The labels read from their own copy of the data, as elsewhere on this
   map: a glyph failure then costs only the text, never the line. */
function exLinkFC() {
  return { type: "FeatureCollection", features: O.flatMap(o => { const d = exKm(o); return [
    { type: "Feature", geometry: { type: "LineString", coordinates: [[o.lng, o.lat], [EX.lng, EX.lat]] }, properties: { id: o.id, part: "line" } },
    { type: "Feature", geometry: { type: "Point", coordinates: [(o.lng + EX.lng) / 2, (o.lat + EX.lat) / 2] },
      properties: { id: o.id, part: "label", label: `${fmtKm(d)} · about ${driveMin(d)} min to ${EX.name}` } }
  ]; }) };
}
const exLinkFilter = (part) => ["all", ["==", ["get", "part"], part], ["==", ["get", "id"], S.sel || ""]];

/* --------------------------------------------------------- handover ------ */
function monthsTo(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return (d.getFullYear() - TODAY.getFullYear()) * 12 + (d.getMonth() - TODAY.getMonth());
}
function handoverRank(o) {
  if (o.handoverKind === "ready") return 0;
  if (o.handoverKind === "loi90") return 3;
  const m = monthsTo(o.handoverISO);
  return m <= 0 ? 1 : m;
}
/* NRK prints two handover dates on one page; show both rather than pick
   silently. Where the table only adds detail to the headline, show the detail. */
function handoverText(o) {
  if (o.handoverDetail.startsWith(o.handover)) return o.handoverDetail;
  return `${o.handover} (page table: "${o.handoverDetail}")`;
}
function handoverNote(o) {
  if (o.handoverKind === "ready") return "Ready now";
  if (o.handoverKind === "loi90") return "About 3 months after LOI";
  const m = monthsTo(o.handoverISO);
  if (m <= 0) return "Date has passed; confirm status";
  return `In about ${m} month${m === 1 ? "" : "s"}`;
}

/* ------------------------------------------------------------ scoring ----
   Fit score out of 100. Eight parts with stated ceilings; the ceilings are the
   default weights and can be changed on the Compare sheet. Every part is
   derived from a deck field except talent reach, which uses the approximate
   map positions and is labelled so. */
const PARTS = [
  { key: "transit", label: "Metro access",   w: 25, of: "deck distance to the nearest metro station" },
  { key: "ready",   label: "Readiness",      w: 20, of: "handover date against today" },
  { key: "talent",  label: "Talent reach",   w: 15, of: "institutions and residential belts inside 30 min (indicative)" },
  { key: "scale",   label: "Scale",          w: 10, of: "super built-up area offered" },
  { key: "eff",     label: "Efficiency",     w: 10, of: "carpet to super built-up" },
  { key: "grade",   label: "Grade",          w: 8,  of: "Grade A or B as the deck states" },
  { key: "parking", label: "Parking",        w: 7,  of: "car parks per 1,000 sq ft" },
  { key: "infra",   label: "Infrastructure", w: 5,  of: "power, fire, sprinklers, lifts, security, parking listed" }
];
const W = Object.fromEntries(PARTS.map(p => [p.key, p.w]));
const clamp = (v) => Math.max(0, Math.min(1, v));
function transitV(m) {
  if (m <= 300) return 1;
  if (m <= 1000) return 1 - .25 * (m - 300) / 700;
  if (m <= 3000) return .75 - .55 * (m - 1000) / 2000;
  return Math.max(.05, .2 - .15 * (m - 3000) / 6300);
}
function readyV(o) {
  if (o.handoverKind === "ready") return 1;
  if (o.handoverKind === "loi90") return .85;
  const m = monthsTo(o.handoverISO);
  if (m <= 0) return .6;    // a past date is not proof of readiness
  return Math.max(.2, 1 - m * .1);
}
const INFRA = ["security", "power", "fire", "sprinkler", "lifts", "parking"];
const amenKeys = (o) => new Set(o.amenities.map(a => window.IND_AMENITY_KEYS[a]).filter(Boolean));

let TALENT_MAX = 1;
function talentRaw(o) {
  const c = catchment(o);
  return upTo(c, 1, "edu") + upTo(c, 1, "res");
}
function scoreParts(o) {
  const maxSuper = Math.max(...O.map(x => x.superArea));
  const k = amenKeys(o);
  const parking = o.parkingPer1000 == null ? .2 : o.parkingPer1000 >= 1 ? 1 : o.parkingPer1000 >= .6 ? .75 : .35;
  return {
    transit: transitV(o.commuteM),
    ready: readyV(o),
    talent: clamp(talentRaw(o) / TALENT_MAX),
    scale: clamp(o.superArea / maxSuper),
    eff: clamp((o.efficiency - 60) / 15),
    grade: o.grade === "A" ? 1 : .5,
    parking,
    infra: INFRA.filter(x => k.has(x)).length / INFRA.length
  };
}
/* The fit score is shown rounded, but every ranking uses the exact value,
   so two options that both read "83" still sit in a fixed, explainable
   order (NRK 83.32 against Fortune Azure 83.30, for example). */
function exact(o) {
  const p = scoreParts(o), tw = PARTS.reduce((s, x) => s + W[x.key], 0) || 1;
  return PARTS.reduce((s, x) => s + p[x.key] * W[x.key], 0) / tw * 100;
}
const score = (o) => Math.round(exact(o));
const byFit = (a, b) => exact(b) - exact(a);
/* Options that show the same rounded score as `o`. */
const levelWith = (o) => O.filter(x => x.id !== o.id && score(x) === score(o));

/* ------------------------------------------------------------- presets --
   Priority mapping. A client rarely weighs everything equally; each preset
   is a named set of weights over the same eight parts, so the ranking can be
   re-read through the client's own priority in one click. */
const PRESETS = {
  balanced: { label: "Balanced", note: "The default weights: metro access and readiness lead, everything else counts.",
    w: { transit: 25, ready: 20, talent: 15, scale: 10, eff: 10, grade: 8, parking: 7, infra: 5 } },
  commute: { label: "Commute first", note: "Staff arrive by metro and on foot; walking distance to an open station dominates.",
    w: { transit: 45, ready: 10, talent: 20, scale: 5, eff: 5, grade: 5, parking: 5, infra: 5 } },
  speed: { label: "Move in fast", note: "Go live in weeks: ready-now space and full listed infrastructure first.",
    w: { transit: 15, ready: 45, talent: 10, scale: 5, eff: 5, grade: 5, parking: 5, infra: 10 } },
  scale: { label: "Room to scale", note: "One large floor now and space to grow; area offered dominates.",
    w: { transit: 15, ready: 10, talent: 10, scale: 35, eff: 10, grade: 10, parking: 5, infra: 5 } },
  talent: { label: "Hire at volume", note: "Fresher hiring at scale: institutions and residential belts within 30 minutes.",
    w: { transit: 25, ready: 10, talent: 40, scale: 5, eff: 5, grade: 5, parking: 5, infra: 5 } },
  premium: { label: "Premium & efficient", note: "Grade A, high carpet efficiency, parking and full infrastructure.",
    w: { transit: 15, ready: 10, talent: 5, scale: 5, eff: 25, grade: 20, parking: 10, infra: 10 } }
};
function setPreset(key) {
  const p = PRESETS[key]; if (!p) return;
  S.preset = key; Object.assign(W, p.w);
}
function exactWith(o, w) {
  const p = scoreParts(o), tw = PARTS.reduce((s, x) => s + w[x.key], 0) || 1;
  return PARTS.reduce((s, x) => s + p[x.key] * w[x.key], 0) / tw * 100;
}
const scoreWith = (o, w) => Math.round(exactWith(o, w));
const rankBy = (w) => O.slice().sort((a, b) => exactWith(b, w) - exactWith(a, w)).map(o => o.id);

/* --------------------------------------------------------------- state -- */
const S = {
  tab: "brief", sel: null, hov: null, shot: "close", sort: "score", target: null, preset: "balanced", sheet: "half",
  filters: new Set(),
  layers: { existing: true, zones: true, metro: true, walk: false, bus: true, edu: true, emp: true, res: true, rings: true }
};
const FILTERS = [
  { key: "A", label: "Grade A", test: o => o.grade === "A" },
  { key: "B", label: "Grade B", test: o => o.grade === "B" },
  { key: "ready", label: "Ready now", test: o => o.handoverKind === "ready" },
  { key: "metro", label: "Metro ≤ 1 km", test: o => o.commuteM <= 1000 },
  { key: "sbd", label: "SBD", test: o => o.micro === "sbd" },
  { key: "pbd", label: "Super Corridor", test: o => o.micro === "pbd" }
];
const TABS = [
  { key: "brief", label: "Brief" },
  { key: "priorities", label: "Priorities" },
  { key: "talent", label: "Talent & catchment" },
  { key: "transit", label: "Transit" },
  { key: "market", label: "Market & incentives" },
  { key: "deck", label: "Deck map" },
  { key: "compare", label: "Compare all" }
];
const passes = (o) => {
  const groups = { grade: ["A", "B"], micro: ["sbd", "pbd"] };
  const on = [...S.filters];
  const gradeOn = on.filter(k => groups.grade.includes(k)), microOn = on.filter(k => groups.micro.includes(k));
  const other = on.filter(k => !groups.grade.includes(k) && !groups.micro.includes(k));
  const t = (k) => FILTERS.find(f => f.key === k).test(o);
  return (gradeOn.length === 0 || gradeOn.some(t)) && (microOn.length === 0 || microOn.some(t)) && other.every(t);
};
const fits = (o) => S.target == null ? null : o.carpetArea >= S.target * 0.97;

/* ================================================================ gate == */
function initGate() {
  const norm = (v) => v.trim().toUpperCase().replace(/[\s-]/g, "");
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true;
    let ok = false;
    try { ok = (await sha256(norm($("#g-id").value) + ":" + norm($("#g-pw").value))) === GATE_HASH; } catch (e) { ok = false; }
    busy = false;
    if (ok) { sessionStorage.setItem("ind-auth", "1"); openApp(); }
    else { $("#g-err").textContent = "Not recognised. Access is issued per person."; $("#g-pw").value = ""; $("#g-pw").focus(); }
  };
  startMap();
  const openApp = () => { const g = $("#gate"); g.classList.add("out"); setTimeout(() => g.remove(), 450); boot(); };
  loadBackdrop();
  const tot = O.reduce((t, o) => t + o.superArea, 0);
  $("#g-stats").innerHTML = `<span><b>${O.length}</b>options</span><span><b>${(tot / 1e5).toFixed(2)} L</b>sq ft</span>`
    + `<span><b>${STN.filter(x => x.open).length}</b>metro stations open</span><span><b>${O.filter(o => o.handoverKind === "ready").length}</b>ready now</span>`;
  let handoff = null;
  try { handoff = sessionStorage.getItem("atlas-handoff"); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
  if (handoff === "/indore/") sessionStorage.setItem("ind-auth", "1");
  if (sessionStorage.getItem("ind-auth") === "1") { $("#gate").remove(); boot(); return; }
  $("#g-form").addEventListener("submit", e => { e.preventDefault(); go(); });
  $("#g-id").focus();
}
/* The sign-in backdrop was generated with Higgsfield. The build copies it
   into media/indore/ (scripts/fetch-indore-backdrop.js); if that copy is
   missing, the page falls back to Higgsfield's CDN, and if that fails too, to
   a deck photo stored with the site. Phones get the portrait crop. */
const BACKDROP = {
  wide: { local: MEDIA + "backdrop-wide.webp", remote: "https://d8j0ntlcm91z4.cloudfront.net/user_3Fo7i4SvZozV6ke0Djuea827rgj/hf_20260930_052823_8e4eed0a-51d0-40fb-945e-8a78aeae19fb_min.webp" },
  tall: { local: MEDIA + "backdrop-tall.webp", remote: "https://d8j0ntlcm91z4.cloudfront.net/user_3Fo7i4SvZozV6ke0Djuea827rgj/hf_20260930_052821_229f2ecc-8cb5-4c46-89f6-e033184efa7c_min.webp" }
};
/* Last resort: a deck photo that ships with the site, so the sign-in page
   always has an image even when the build copy and the CDN both fail. */
const BACKDROP_SAFE = MEDIA + "scape-it-park.webp";
function loadBackdrop() {
  const img = $("#g-bg"); if (!img) return;
  const b = matchMedia("(max-aspect-ratio: 3/4)").matches ? BACKDROP.tall : BACKDROP.wide;
  const tries = [b.local, b.remote, BACKDROP_SAFE];
  const next = () => { const u = tries.shift(); if (!u) { img.remove(); return; } img.src = u; };
  img.addEventListener("load", () => img.classList.add("on"));
  img.addEventListener("error", next);
  next();
}

/* ================================================================ map === */
let map;
/* Focus levels for the pins: 2 = the option open or hovered, 1 = normal,
   0.5 = pushed back because another option has the focus, 0 = filtered out.
   One number drives size, opacity and labels, so the pin being discussed
   always reads first and the rest recede, as on the main ATLAS map. */
const focusOf = (o) => (S.sel === o.id || S.hov === o.id) ? 2 : !passes(o) ? 0 : (S.sel || S.hov) ? .5 : 1;
const optionFC = () => ({ type: "FeatureCollection", features: O.map(o => ({
  type: "Feature", id: o.n, geometry: { type: "Point", coordinates: [o.lng, o.lat] },
  properties: { id: o.id, n: String(o.n).padStart(2, "0"), name: o.name, grade: o.grade,
    dim: passes(o) ? 0 : 1, sel: S.sel === o.id ? 1 : 0, fit: fits(o) === false ? 0 : 1, foc: focusOf(o) } })) });

function ringFC() {
  const o = O.find(x => x.id === S.sel);
  if (!o || !S.layers.rings) return { type: "FeatureCollection", features: [] };
  return { type: "FeatureCollection", features: RINGS.slice().reverse().map(r => ({
    type: "Feature", geometry: { type: "Polygon", coordinates: [circle([o.lng, o.lat], ringKm(r.min))] },
    properties: { min: r.min, color: r.color, label: `${r.min} min` } })) };
}
function ringLabelFC() {
  const o = O.find(x => x.id === S.sel);
  if (!o || !S.layers.rings) return { type: "FeatureCollection", features: [] };
  return { type: "FeatureCollection", features: RINGS.map(r => ({ type: "Feature",
    geometry: { type: "Point", coordinates: [o.lng, o.lat + ringKm(r.min) / KM_LAT] }, properties: { label: `${r.min} min` } })) };
}

/* Symbol layers need the style's glyphs. If a label layer fails, the data
   layer under it must still draw, so every layer is added on its own. */
function add(layer, before) { try { map.addLayer(layer, before); } catch (e) { console.warn("layer", layer.id, e.message); } }

/* Mapbox GL starts loading the moment the page opens and the map builds
   behind the sign-in screen, so it is already drawn when the gate lifts.
   The script is injected rather than put in the head so it never holds up
   the first paint of the sign-in page; the preload hint starts the fetch. */
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
  TALENT_MAX = Math.max(...O.map(talentRaw), 1);
  if (!window.MAPBOX_TOKEN) return mapUnavailable();
  loadMapbox().then(initMap).catch(mapUnavailable);
}
function boot() {
  booted = true;
  applyRoute(false);
  renderTabs(); renderFilters(); renderList(); renderPanel(); renderLayers();
  wireBoard(); wireSheet(); wirePanes(); wireHints();
  /* Sign out ends this tab's session and brings the sign-in screen back.
     The root login keeps nothing for redirect clients, so there is nothing
     else to clear. */
  $("#signout").addEventListener("click", () => {
    try { sessionStorage.removeItem("ind-auth"); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
    location.replace(location.pathname);
  });
  $("#sort").dataset.hint = "Order the list by fit, metro distance, size, handover, efficiency or deck order.";
  $("#t-area").dataset.hint = "Type the carpet area the client needs. Each option then shows whether it fits or falls short.";
  addEventListener("popstate", () => applyRoute(true));
  /* The map may already be up from behind the gate: bring it in line with
     the route and the panels that now exist. */
  if (map && map.getSource("options")) { refreshMap(); if (S.sel) select(S.sel, true, true); else fitAll(false); }
}
/* Mapbox Standard, the same basemap as the main ATLAS map: real landmarks,
   metro and transit labels, and 3D buildings once you zoom in. The faded
   theme keeps it quiet enough for the pins to lead. */
const MAP_STYLE = "mapbox://styles/mapbox/standard";
const BASEMAP = { lightPreset: "day", theme: "faded", showPointOfInterestLabels: true, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true, show3dObjects: true };
function initMap() {
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  const style = window.IND_MAP_STYLE || MAP_STYLE;
  map = new mapboxgl.Map({
    container: "map", style, center: M.center, zoom: M.zoom, pitch: innerWidth > 860 ? 35 : 0,
    attributionControl: false, projection: "mercator", cooperativeGestures: false, antialias: innerWidth > 860
  });
  if (style === MAP_STYLE) map.on("style.load", () => {
    for (const [k, v] of Object.entries(BASEMAP)) { try { map.setConfigProperty("basemap", k, v); } catch (e) {} }
  });
  /* If Mapbox refuses the key (for example a token locked to the live domain
     and opened on a preview address), say so on the map instead of leaving a
     blank background. */
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
   Every view has an address: #/option/metro-tower, #/talent, #/priorities/
   commute. The BD team can send a client straight to one building, and the
   browser's back button walks the views. */
function routeHash() {
  if (S.sel) return `#/option/${S.sel}`;
  if (S.tab === "priorities" && S.preset !== "balanced" && S.preset !== "custom") return `#/priorities/${S.preset}`;
  return S.tab === "brief" ? "#/" : `#/${S.tab}`;
}
function pushRoute() { const h = routeHash(); if (location.hash !== h && !(h === "#/" && !location.hash)) history.pushState(null, "", h); }
function applyRoute(render) {
  const [kind, val] = location.hash.replace(/^#\/?/, "").split("/");
  S.sel = null;
  if (kind === "option" && O.some(o => o.id === val)) S.sel = val;
  else if (TABS.some(t => t.key === kind && t.key !== "compare")) {
    S.tab = kind;
    if (kind === "priorities" && PRESETS[val]) setPreset(val);
  } else S.tab = "brief";
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
    /* Phone: the panel is a bottom sheet in portrait and a right-hand panel
       in landscape; keep the camera clear of whichever it is. */
    const sh = document.getElementById("panel").getBoundingClientRect();
    pad = sh.left > Wd * .3
      ? { top: 70, bottom: 90, left: 20, right: Wd - sh.left + 20 }
      : { top: 110, bottom: Math.max(60, Hd - sh.top + 110), left: 24, right: 24 };
  } else {
    const b = document.getElementById("board").getBoundingClientRect(), p = document.getElementById("panel").getBoundingClientRect();
    const l = document.getElementById("layers").getBoundingClientRect();
    pad = { top: 100, bottom: Hd - l.top + 24, left: Math.max(30, b.right + 30), right: Math.max(30, Wd - p.left + 30) };
  }
  /* Never ask for more margin than the map has room for (with the sheet
     pulled up, Mapbox would otherwise refuse to fit). */
  const squeeze = (a, c, room) => { const k = Math.min(1, room / (pad[a] + pad[c])); pad[a] *= k; pad[c] *= k; };
  squeeze("top", "bottom", Hd - 80); squeeze("left", "right", Wd - 80);
  return pad;
}
function fitAll(animate = true) {
  if (!map) return;
  const b = new mapboxgl.LngLatBounds();
  O.filter(passes).forEach(o => b.extend([o.lng, o.lat]));
  if (b.isEmpty()) return;
  map.fitBounds(b, { padding: padding(), maxZoom: 13.5, pitch: innerWidth > 860 ? 35 : 0, bearing: 0, duration: animate && !REDUCED() ? 1100 : 0 });
}

function addLayers() {
  const zones = window.IND_ZONES;
  map.addSource("zones", { type: "geojson", data: { type: "FeatureCollection", features: zones.map(z => ({
    type: "Feature", geometry: { type: "Polygon", coordinates: [zonePolygon(z)] }, properties: { label: z.label, color: z.color, key: z.key } })) } });
  map.addSource("zone-labels", { type: "geojson", data: { type: "FeatureCollection", features: zones.map(z => {
    const c = z.shape.type === "band" ? [(z.shape.from[0] + z.shape.to[0]) / 2, (z.shape.from[1] + z.shape.to[1]) / 2] : z.shape.c;
    return { type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { label: z.label } }; }) } });
  add({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": ["get", "color"], "fill-opacity": .13 } });
  add({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": ["get", "color"], "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": .7 } });
  add({ id: "zones-label", type: "symbol", source: "zone-labels", layout: { "text-field": ["get", "label"], "text-size": 13,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-letter-spacing": .2 }, paint: { "text-color": "#6c5b4d", "text-opacity": .75, "text-halo-color": "#fff", "text-halo-width": 1.2 } });

  map.addSource("rings", { type: "geojson", data: ringFC() });
  map.addSource("ring-labels", { type: "geojson", data: ringLabelFC() });
  add({ id: "rings-fill", type: "fill", source: "rings", paint: { "fill-color": ["get", "color"], "fill-opacity": .06 } });
  add({ id: "rings-line", type: "line", source: "rings", paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-opacity": .8 } });
  add({ id: "rings-label", type: "symbol", source: "ring-labels", layout: { "text-field": ["get", "label"], "text-size": 11,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, -.6] }, paint: { "text-color": "#a3502c", "text-halo-color": "#fff", "text-halo-width": 1.4 } });

  const bus = window.IND_BUS;
  map.addSource("bus", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: bus.path }, properties: {} } });
  add({ id: "bus-line", type: "line", source: "bus", layout: { "line-cap": "round" }, paint: { "line-color": "#c0392b", "line-width": 2.2, "line-dasharray": [1, 1.6], "line-opacity": .75 } });

  const open = STN.filter(s => s.open), planned = STN.filter(s => !s.open || s.n === 16);
  map.addSource("metro-open", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: open.map(s => [s.lng, s.lat]) }, properties: {} } });
  map.addSource("metro-plan", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: [...planned.map(s => [s.lng, s.lat]), [STN[0].lng, STN[0].lat]] }, properties: {} } });
  const stationsData = { type: "FeatureCollection", features: STN.map(s => ({ type: "Feature",
    geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { name: s.name, open: s.open ? 1 : 0, n: s.n } })) };
  map.addSource("stations", { type: "geojson", data: stationsData });
  map.addSource("walk", { type: "geojson", data: { type: "FeatureCollection", features: open.flatMap(s => [1, .5].map(r => ({ type: "Feature",
    geometry: { type: "Polygon", coordinates: [circle([s.lng, s.lat], r, 40)] }, properties: { r } }))) } });
  add({ id: "walk-fill", type: "fill", source: "walk", paint: { "fill-color": "#d9a400", "fill-opacity": ["case", ["==", ["get", "r"], .5], .10, .05] } });
  add({ id: "walk-line", type: "line", source: "walk", paint: { "line-color": "#b58900", "line-width": .8, "line-dasharray": [2, 2], "line-opacity": .6 } });
  add({ id: "metro-plan", type: "line", source: "metro-plan", layout: { "line-cap": "round" }, paint: { "line-color": "#d9a400", "line-width": 3, "line-dasharray": [1.2, 1.4], "line-opacity": .7 } });
  add({ id: "metro-casing", type: "line", source: "metro-open", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#6b5200", "line-width": 6.5, "line-opacity": .35 } });
  add({ id: "metro-open", type: "line", source: "metro-open", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#f2c200", "line-width": 4.5 } });
  add({ id: "stations", type: "circle", source: "stations", paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 5.5],
    "circle-color": ["case", ["==", ["get", "open"], 1], "#fff", "#f6ecc8"],
    "circle-stroke-color": "#6b5200", "circle-stroke-width": ["case", ["==", ["get", "open"], 1], 1.8, 1] } });
  /* Labels read from their own copy of the data: a glyph failure then costs
     only the text, never the points underneath (seen on the God's Eye map). */
  map.addSource("stations-lbl", { type: "geojson", data: stationsData });
  add({ id: "stations-label", type: "symbol", source: "stations-lbl", minzoom: 12.2, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
    paint: { "text-color": "#6b5200", "text-halo-color": "#fff", "text-halo-width": 1.3 } });

  const COL = { edu: "#5b3aa7", emp: "#d0417b", res: "#0a8a3a", hub: "#4a4a4a" };
  const placesData = { type: "FeatureCollection", features: window.IND_PLACES.map(p => ({ type: "Feature",
    geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: { id: p.id, kind: p.kind, name: p.name, color: COL[p.kind] } })) };
  map.addSource("places", { type: "geojson", data: placesData });
  add({ id: "places", type: "circle", source: "places", paint: {
    "circle-radius": ["case", ["==", ["get", "kind"], "res"], 7, ["==", ["get", "kind"], "hub"], 6, 5.5],
    "circle-color": ["get", "color"], "circle-opacity": ["case", ["==", ["get", "kind"], "res"], .28, .9],
    "circle-stroke-color": ["case", ["==", ["get", "kind"], "res"], ["get", "color"], "#fff"], "circle-stroke-width": 1.4 } });
  map.addSource("places-lbl", { type: "geojson", data: placesData });
  add({ id: "places-label", type: "symbol", source: "places-lbl", minzoom: 11.8, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"], "text-offset": [0, .95], "text-anchor": "top", "text-optional": true, "text-max-width": 9 },
    paint: { "text-color": ["get", "color"], "text-halo-color": "#fff", "text-halo-width": 1.3 } });

  /* The existing building: a dark ringed target so it never reads as an
     option, plus a dashed link to whichever option is open. */
  map.addSource("ex-link", { type: "geojson", data: exLinkFC() });
  add({ id: "ex-link", type: "line", source: "ex-link", filter: exLinkFilter("line"), layout: { "line-cap": "round" },
    paint: { "line-color": "#2a1e16", "line-width": 2, "line-dasharray": [1.4, 1.4], "line-opacity": .75 } });
  const exData = { type: "Feature", geometry: { type: "Point", coordinates: [EX.lng, EX.lat] }, properties: { name: EX.name } };
  map.addSource("existing", { type: "geojson", data: exData });
  add({ id: "ex-pin", type: "circle", source: "existing", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 8, 15, 12],
    "circle-color": "#2a1e16", "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } });
  add({ id: "ex-dot", type: "circle", source: "existing", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 4.5], "circle-color": "#fff" } });

  map.addSource("options", { type: "geojson", data: optionFC() });
  const gradeCol = ["case", ["==", ["get", "grade"], "A"], "#a3502c", "#2f6f9f"];
  const foc = ["get", "foc"];
  add({ id: "opt-halo", type: "circle", source: "options", filter: ["==", foc, 2], paint: {
    "circle-radius": 24, "circle-color": gradeCol, "circle-opacity": .16, "circle-stroke-color": gradeCol, "circle-stroke-width": 2,
    "circle-stroke-opacity": .75, "circle-pitch-alignment": "map" } });
  add({ id: "opt", type: "circle", source: "options", paint: {
    "circle-radius": ["case", ["==", foc, 2], 15, ["==", foc, 1], 11, 8],
    "circle-color": gradeCol,
    "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["==", foc, 2], 3, 2],
    "circle-opacity": ["case", ["==", foc, 2], 1, ["==", foc, 0], .18, ["==", foc, .5], .38, ["==", ["get", "fit"], 0], .45, 1],
    "circle-stroke-opacity": ["case", ["==", foc, 0], .25, ["==", foc, .5], .5, 1] } });
  map.addSource("options-lbl", { type: "geojson", data: optionFC() });
  add({ id: "opt-num", type: "symbol", source: "options-lbl", layout: { "text-field": ["get", "n"],
    "text-size": ["case", ["==", foc, 2], 12.5, ["==", foc, 1], 10.5, 9], "text-allow-overlap": true,
    "text-ignore-placement": true, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] },
    paint: { "text-color": "#fff", "text-opacity": ["case", ["==", foc, 0], .3, ["==", foc, .5], .6, 1] } });
  add({ id: "opt-name", type: "symbol", source: "options-lbl", minzoom: 11, filter: ["!=", foc, 2], layout: { "text-field": ["get", "name"], "text-size": 12,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [1.2, 0], "text-anchor": "left", "text-optional": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 1.6, "text-opacity": ["case", ["==", foc, 1], 1, .3] } });
  /* The focused option always carries its name, at any zoom. */
  add({ id: "opt-name-focus", type: "symbol", source: "options-lbl", filter: ["==", foc, 2], layout: { "text-field": ["get", "name"], "text-size": 14,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-offset": [1.6, 0], "text-anchor": "left", "text-allow-overlap": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  map.addSource("existing-lbl", { type: "geojson", data: exData });
  map.addSource("ex-link-lbl", { type: "geojson", data: exLinkFC() });
  add({ id: "ex-label", type: "symbol", source: "existing-lbl", layout: { "text-field": `${EX.name} · existing`, "text-size": 12,
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-offset": [0, 1.3], "text-anchor": "top", "text-allow-overlap": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2 } });
  add({ id: "ex-link-label", type: "symbol", source: "ex-link-lbl", filter: exLinkFilter("label"), layout: { "text-field": ["get", "label"],
    "text-size": 11.5, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.2 } });
  applyLayerVisibility();
}

/* The layer chips double as the legend: each carries the swatch its layer
   draws with, so there is no separate key to cover the map. */
const LAYERS = [
  { key: "existing", label: "NRK Star (existing)", sw: `<span class="dot" style="background:#2a1e16;box-shadow:inset 0 0 0 2.5px #2a1e16,inset 0 0 0 5px #fff"></span>`, ids: ["ex-link", "ex-link-label", "ex-pin", "ex-dot", "ex-label"] },
  { key: "zones", label: "Zones", sw: `<span class="sw" style="height:9px;background:rgba(111,179,164,.35);border:1px dashed #6fb3a4"></span>`, ids: ["zones-fill", "zones-line", "zones-label"] },
  { key: "metro", label: "Metro", sw: `<span class="sw" style="background:linear-gradient(90deg,#f2c200 55%,transparent 55% 65%,#d9a400 65% 80%,transparent 80%)"></span>`, ids: ["metro-open", "metro-casing", "metro-plan", "stations", "stations-label"] },
  { key: "walk", label: "Walk 0.5/1 km", sw: `<span class="dot" style="background:rgba(217,164,0,.18);border:1px dashed #b58900"></span>`, ids: ["walk-fill", "walk-line"] },
  { key: "bus", label: "iBus", sw: `<span class="sw" style="background:repeating-linear-gradient(90deg,#c0392b 0 3px,transparent 3px 6px)"></span>`, ids: ["bus-line"] },
  { key: "edu", label: "Institutions", sw: `<span class="dot" style="background:#5b3aa7"></span>` },
  { key: "emp", label: "Employers", sw: `<span class="dot" style="background:#d0417b"></span>` },
  { key: "res", label: "Homes", sw: `<span class="dot" style="background:rgba(10,138,58,.22);border:1.5px solid #0a8a3a"></span>` },
  { key: "rings", label: "Drive rings", sw: `<span class="dot" style="background:transparent;border:1.5px solid #a3502c"></span>`, ids: ["rings-fill", "rings-line", "rings-label"] }
];
function applyLayerVisibility() {
  if (!map || !map.getLayer("opt")) return;
  for (const l of LAYERS) {
    for (const id of l.ids || []) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", S.layers[l.key] ? "visible" : "none");
  }
  const kinds = ["hub", ...["edu", "emp", "res"].filter(k => S.layers[k])];
  for (const id of ["places", "places-label"]) if (map.getLayer(id)) map.setFilter(id, ["in", ["get", "kind"], ["literal", kinds]]);
  const rs = map.getSource("rings"); if (rs) rs.setData(ringFC());
  const rl = map.getSource("ring-labels"); if (rl) rl.setData(ringLabelFC());
  if (map.getLayer("ex-link")) map.setFilter("ex-link", exLinkFilter("line"));
  if (map.getLayer("ex-link-label")) map.setFilter("ex-link-label", exLinkFilter("label"));
  recede();
}
/* With an option open, only its own context keeps full weight: the metro
   stations within 1.5 km and the places inside its 30 minute drive ring.
   Everything else fades back so the eye stays on the building. */
function recede() {
  if (!map || !map.getLayer("opt")) return;
  const o = S.sel && O.find(x => x.id === S.sel);
  const set = (id, prop, v) => { if (map.getLayer(id)) try { map.setPaintProperty(id, prop, v); } catch (e) {} };
  if (!o) {
    set("stations", "circle-opacity", 1); set("stations", "circle-stroke-opacity", 1); set("stations-label", "text-opacity", 1);
    set("places", "circle-opacity", ["case", ["==", ["get", "kind"], "res"], .28, .9]); set("places", "circle-stroke-opacity", 1); set("places-label", "text-opacity", 1);
    set("zones-fill", "fill-opacity", .13); set("zones-label", "text-opacity", .75);
    return;
  }
  const nearSt = STN.filter(st => km(o, st) <= 1.5).map(st => st.n);
  const nearPl = window.IND_PLACES.filter(pl => km(o, pl) <= ringKm(30)).map(pl => pl.id);
  const inSt = ["in", ["get", "n"], ["literal", nearSt]], inPl = ["in", ["get", "id"], ["literal", nearPl]];
  set("stations", "circle-opacity", ["case", inSt, 1, .35]); set("stations", "circle-stroke-opacity", ["case", inSt, 1, .35]);
  set("stations-label", "text-opacity", ["case", inSt, 1, .3]);
  set("places", "circle-opacity", ["case", inPl, ["case", ["==", ["get", "kind"], "res"], .28, .9], .15]);
  set("places", "circle-stroke-opacity", ["case", inPl, 1, .25]); set("places-label", "text-opacity", ["case", inPl, 1, .25]);
  set("zones-fill", "fill-opacity", .06); set("zones-label", "text-opacity", .35);
}
/* A slow breathing ring on the open option. Skipped when the viewer has
   asked for reduced motion. */
let pulseRaf = null;
function pulse() {
  if (pulseRaf || REDUCED()) return;
  const t0 = performance.now();
  const step = (t) => {
    if (!map || !map.getLayer("opt-halo") || (!S.sel && !S.hov)) { pulseRaf = null; return; }
    const k = (Math.sin((t - t0) / 520) + 1) / 2;
    try { map.setPaintProperty("opt-halo", "circle-radius", 20 + k * 10); map.setPaintProperty("opt-halo", "circle-opacity", .22 - k * .14); } catch (e) {}
    pulseRaf = requestAnimationFrame(step);
  };
  pulseRaf = requestAnimationFrame(step);
}
const REDUCED = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function refreshPins() {
  if (!map || !map.getSource("options")) return;
  const fc = optionFC();
  map.getSource("options").setData(fc);
  if (map.getSource("options-lbl")) map.getSource("options-lbl").setData(fc);
  if (S.sel || S.hov) pulse();
}
function refreshMap() {
  if (!map || !map.getSource("options")) return;
  refreshPins();
  applyLayerVisibility();
}

function wireMap() {
  const pop = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
  const hover = (layer, html) => {
    map.on("mouseenter", layer, e => { map.getCanvas().style.cursor = "pointer"; const f = e.features[0]; pop.setLngLat(f.geometry.coordinates).setHTML(html(f.properties)).addTo(map); });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; pop.remove(); });
  };
  hover("opt", p => { const o = O.find(x => x.id === p.id);
    return `<div class="pop">${pic(o, "thumb")}<div><b>${esc(p.n)} · ${esc(o.name)}</b><br>${esc(o.locality)}<br>Grade ${o.grade} · ${inr(o.superArea)} SF · ${esc(o.handover)}<br>${esc(o.commuteDist)} to metro · fit ${score(o)}</div></div>`; });
  hover("places", p => { const x = window.IND_PLACES.find(y => y.id === p.id);
    const kind = { edu: "Institution", emp: "Employer", res: "Residential catchment", hub: "Transport" }[x.kind];
    return `<b>${esc(x.name)}</b>${x.sub ? `<br>${esc(x.sub)}` : ""}<br><span style="color:#6c5b4d">${kind}</span><br>${esc(x.note)}`; });
  hover("ex-pin", () => { const m = nearestOpen(EX), o = S.sel && O.find(x => x.id === S.sel);
    return `<b>${esc(EX.name)}</b><br>${esc(EX.label)} · ${esc(EX.locality)}${EX.occupant ? `<br>Occupied by ${esc(EX.occupant)}` : ""}<br>Nearest open metro: ${esc(m.s.name)}, ${fmtKm(m.d)}${o ? `<br>${fmtKm(exKm(o))} from ${esc(o.name)}` : ""}<br><span style="color:#6c5b4d">Pinned from Google Maps</span>`; });
  hover("stations", p => `<b>${esc(p.name)}</b><br>Yellow Line station ${p.n} · ${p.open ? "open" : "not yet open"}<br><span style="color:#6c5b4d">Position approximate</span>`);
  map.on("click", "opt", e => select(e.features[0].properties.id, true));
  map.on("mousemove", "opt", e => { const id = e.features[0].properties.id; if (id !== S.sel && S.hov !== id) { S.hov = id; refreshPins(); } });
  map.on("mouseleave", "opt", () => { if (S.hov) { S.hov = null; refreshPins(); } });
}

/* ============================================================ board ===== */
function renderFilters() {
  $("#filters").innerHTML = FILTERS.map(f => `<button class="chip ${S.filters.has(f.key) ? "on" : ""}" data-f="${f.key}" type="button" aria-pressed="${S.filters.has(f.key)}" data-hint="${esc(`Keep only ${f.label} options. The rest fade on the map and drop down the list.`)}">${esc(f.label)}</button>`).join("");
}
function sorted() {
  const by = {
    score: byFit,
    metro: (a, b) => a.commuteM - b.commuteM,
    area: (a, b) => b.superArea - a.superArea,
    handover: (a, b) => handoverRank(a) - handoverRank(b),
    eff: (a, b) => b.efficiency - a.efficiency,
    deck: (a, b) => a.n - b.n
  }[S.sort];
  return O.slice().sort(by);
}
function renderList() {
  const shown = O.filter(passes);
  $("#b-count").textContent = `${shown.length} of ${O.length} options`;
  $("#b-area").textContent = `${inr(shown.reduce((s, o) => s + o.superArea, 0))} SF super`;
  $("#list").innerHTML = sorted().map(o => {
    const f = fits(o);
    return `<button class="card ${S.sel === o.id ? "sel" : ""} ${passes(o) ? "" : "dim"}" data-id="${o.id}" role="listitem" type="button" data-hint="${esc(`Open ${o.name}: the map flies in, the other options fade back, and the full spec and catchment open in the panel.`)}">
      ${pic(o, "thumb")}
      <div>
        <div class="nm"><span class="no">${String(o.n).padStart(2, "0")}</span>${esc(o.name)}</div>
        <div class="loc">${esc(o.locality)}</div>
        <div class="facts"><span class="g g${o.grade}">${o.grade}</span><span class="num">${inr(o.superArea)} SF</span><span>${esc(o.handover)}</span><span>${esc(o.commuteDist)} metro (${metroKm(o)})</span>
          ${f == null ? "" : `<span class="fit ${f ? "yes" : "no"}">${f ? "fits" : "short"}</span>`}</div>
      </div>
      <span class="score" title="Fit score out of 100">${score(o)}</span>
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
  $("#t-area").addEventListener("input", e => {
    const v = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
    S.target = Number.isFinite(v) && v > 0 ? v : null;
    renderList(); refreshMap(); if (S.sel) renderPanel();
  });
  $("#list").addEventListener("click", e => { const c = e.target.closest("[data-id]"); if (c) select(c.dataset.id, true); });
  /* Pointing at a card lifts its pin on the map and pushes the others back. */
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
    const pr = e.target.closest("[data-preset]"); if (pr) { setPreset(pr.dataset.preset); renderList(); renderPanel(); pushRoute(); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { copyLink(cp); return; }
    const pt = e.target.closest("[data-print]"); if (pt) { window.print(); return; }
    const tv = e.target.closest("[data-tableview]"); if (tv) { const t2 = $("#pm-table"); t2.hidden = !t2.hidden; tv.textContent = t2.hidden ? "Show as table" : "Hide table"; return; }
    const img = e.target.closest("figure img, .hero img"); if (img) { const lb = $("#lightbox"); lb.querySelector("img").src = img.currentSrc || img.src; lb.classList.add("on"); }
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

/* ---------------------------------------------------------- camera ------
   The main ATLAS zoom: opening an option flies the camera down to it in a
   tilted close-up. How close depends on how well the position is known:
   right onto a building we have pinned exactly, less far for a street-level
   position, and only to the neighbourhood for a locality-level one, so the
   map never pretends to know which building it is. */
const SHOT_ZOOM = { building: 17.3, street: 16.4, locality: 15.3 };
const SHOTS = {
  close: { label: "Close-up", hint: "Tilted view down onto the building and its streets." },
  street: { label: "Street", hint: "Low angle, as you would approach it by road." },
  area: { label: "Catchment", hint: "Top-down view of the 15, 30 and 45 minute drive rings." }
};
function flyToOption(o, shot) {
  if (!map || !o) return;
  S.shot = shot || "close";
  const phone = innerWidth <= 860, z = SHOT_ZOOM[o.precision] || 15.3, pad = padding();
  const dur = REDUCED() ? 0 : 1700;
  if (S.shot === "area") {
    const b = circle([o.lng, o.lat], ringKm(30), 16).reduce((bb, pt) => bb.extend(pt), new mapboxgl.LngLatBounds());
    map.fitBounds(b, { padding: pad, pitch: 0, bearing: 0, duration: REDUCED() ? 0 : 1200 });
  } else {
    const s = S.shot === "street" ? { zoom: z + .5, pitch: phone ? 60 : 72, bearing: -25 } : { zoom: z, pitch: phone ? 45 : 58, bearing: 30 };
    map.flyTo({ center: [o.lng, o.lat], ...s, padding: pad, duration: dur, curve: 1.42, essential: true });
  }
  document.querySelectorAll("[data-shot]").forEach(b => { b.classList.toggle("on", b.dataset.shot === S.shot); b.setAttribute("aria-pressed", b.dataset.shot === S.shot); });
}
const PRECISION_TEXT = { building: "Pinned to the building", street: "Pinned to the street, building approximate", locality: "Neighbourhood only, exact building not confirmed" };
const shotBar = (o) => `<div class="shots" role="group" aria-label="Camera">${Object.entries(SHOTS).map(([k, v]) =>
  `<button type="button" class="shot ${S.shot === k ? "on" : ""}" data-shot="${k}" aria-pressed="${S.shot === k}" data-hint="${esc(v.hint)}">${v.label}</button>`).join("")}
  <span class="prec ${o.precision}" data-hint="How exactly this option is placed on the map">${PRECISION_TEXT[o.precision] || "Position approximate"}</span></div>`;

function select(id, fly, fromRoute) {
  if (document.body.classList.contains("fold-panel")) setFold("panel", false);
  S.sel = id; S.hov = null; if (fly) S.shot = "close"; renderList(); renderPanel(); refreshMap();
  if (!fromRoute) pushRoute();
  if (innerWidth <= 860 && !fromRoute) setSheet("half");
  const card = document.querySelector(`.card[data-id="${id}"]`); if (card) card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  if (fly) flyToOption(O.find(x => x.id === id), "close");
  $("#p-body").scrollTop = 0;
}

function goTab(key) {
  if (document.body.classList.contains("fold-panel")) setFold("panel", false);
  const had = S.sel; S.tab = key; S.sel = null;
  renderTabs(); renderList(); renderPanel(); refreshMap(); if (had) fitAll(); pushRoute();
  if (innerWidth <= 860) setSheet("half");
}
function renderTabs() {
  $("#tabs").innerHTML = TABS.map(t => {
    const n = t.count ? t.count() : 0;
    return `<button class="tab ${S.tab === t.key && !S.sel ? "on" : ""}" data-t="${t.key}" type="button" data-hint="${esc(GUIDE[t.key] ? GUIDE[t.key].hint : "")}">${esc(t.label)}${n ? `<span class="ct">${n}</span>` : ""}</button>`;
  }).join("");
}
function renderLayers() {
  $("#layers").innerHTML = `<span class="key"><span class="pin" style="background:var(--gradeA)">A</span><span class="pin" style="background:var(--gradeB)">B</span>Grade</span>` +
    LAYERS.map(l => `<button class="chip lay ${S.layers[l.key] ? "on" : ""}" data-l="${l.key}" type="button" aria-pressed="${S.layers[l.key]}" data-hint="${esc((S.layers[l.key] ? "Hide: " : "Show: ") + LAYER_HINT[l.key])}">${l.sw}${esc(l.label)}</button>`).join("") +
    `<span class="key note" title="Map positions are approximate; zone outlines are indicative">ⓘ approx.</span>`;
}
/* ============================================================ guide =====
   "What to expect" help, in two forms:
   - an intro card at the top of every section and option, saying what is in
     it and what clicking does. "Got it" folds it to a one-line link, and the
     choice is remembered on this device;
   - a hover card on anything clickable (tabs, option cards, map layers,
     filters, presets, insights, camera buttons). Phones have no hover, so
     there the intro cards carry the same information. */
const GUIDE = {
  brief: { hint: "The short answer: insights, headline numbers and the top three options.",
    items: ["Insight cards pick out the best option for each question a client asks first. Click one to open that option.",
      "Headline numbers for all ten options, then the top three on today's weights with the reason each ranks high.",
      "The deck's nine requirements answered, and who to call."] },
  priorities: { hint: "Re-rank the ten options by what the client cares about most.",
    items: ["Pick a priority such as Commute first or Move in fast. The ranking, the list on the left and the pins re-order.",
      "Arrows show how far each option moved against the balanced view.",
      "The chart plots how soon each option is ready against how close it is to an open metro station. Point at a dot for details, click it to open the option."] },
  talent: { hint: "Where the people are: colleges, homes and rival employers around each option.",
    items: ["Employability facts for Indore with their sources.",
      "For every option, how many institutions, residential belts and employers sit within 15, 30 and 45 minutes by car.",
      "Turn on Institutions, Employers and Homes in the map bar to see them as points."] },
  transit: { hint: "What the deck says about getting to work, next to what actually runs today.",
    items: ["The Yellow Line as it runs since 6 Sep 2026: 16 stations open, the rest dashed on the map.",
      "iBus on AB Road, and why the BRTS spine in the deck no longer exists.",
      "Turn on Walk 0.5/1 km in the map bar to see walking circles around open stations."] },
  market: { hint: "Rents, micro-markets and the MP IT policy incentives.",
    items: ["Super Corridor against the SBD, with the pros and cons of each.",
      "Rent ranges and the state incentives an IT or ITeS tenant can claim, each with source and date."] },
  deck: { hint: "Where each of the 19 deck pages lives in this app.",
    items: ["Every page of the BD deck, and the tab or option where its content now sits, so nothing from the deck is lost."] },
  compare: { hint: "All ten options side by side, with weights you can adjust." },
  option: { items: ["The map flies down to the building. Other options and far-away places fade back so this one stands out.",
      "Use Close-up, Street and Catchment to change the camera. The label beside them says how exactly the building is placed.",
      "Below: the deck's specs word for word, the fit score broken into parts, who is within 15, 30 and 45 minutes, and what is missing.",
      "Back returns to the section you came from."] }
};
const LAYER_HINT = { existing: "NRK Star, the building in use today, with a dashed line and the distance to the open option.", zones: "CBD, SBD and Super Corridor outlines.", metro: "The Yellow Line: open stations solid, planned ones dashed.",
  walk: "Half and one kilometre walking circles around open stations.", bus: "The AB Road iBus corridor.",
  edu: "Colleges and institutes: the fresher pipeline.", emp: "Rival employers competing for the same people.",
  res: "Residential belts where staff are likely to live.", rings: "15, 30 and 45 minute drive rings around the open option." };
let seenIntro = new Set();
try { seenIntro = new Set(JSON.parse(localStorage.getItem("ind-intro") || "[]")); } catch (e) {}
const saveIntro = () => { try { localStorage.setItem("ind-intro", JSON.stringify([...seenIntro])); } catch (e) {} };
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
    let left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 8), innerWidth - w - 8);
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
  if (S.sel) renderOption(O.find(x => x.id === S.sel));
  else ({ brief: renderBrief, priorities: renderPriorities, talent: renderTalent, transit: renderTransit, market: renderMarket, deck: renderDeck }[S.tab] || renderBrief)();
  $("#p-body").insertAdjacentHTML("afterbegin", introCard(S.sel ? "option" : S.tab));
}
const head = (eyebrow, title, lede) => { $("#p-head").innerHTML = `<div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${lede ? `<div class="lede">${lede}</div>` : ""}`; };
const factList = (arr) => `<ul class="facts">${arr.map(f => `<li class="fact"><span class="k">${esc(f.k)}.</span> ${esc(f.v)}<span class="conf ${f.conf}">${f.conf}</span>
  <div class="meta">${esc(f.asOf)}${f.note ? " · " + esc(f.note) : ""}${f.src ? " · " + cite(f.src) : ""}</div></li>`).join("")}</ul>`;
const optLink = (o) => `<a href="#" data-go="${o.id}">${String(o.n).padStart(2, "0")} ${esc(o.name)}</a>`;

/* ---------- Brief ---------- */
function renderBrief() {
  const tot = O.reduce((s, o) => s + o.superArea, 0), carpet = O.reduce((s, o) => s + o.carpetArea, 0);
  const ready = O.filter(o => o.handoverKind === "ready"), loi = O.filter(o => o.handoverKind === "loi90"), near = O.filter(o => o.commuteM <= 1000), gradeA = O.filter(o => o.grade === "A");
  const ranked = O.slice().sort(byFit);
  head("Autopilot · Indore · Sep 2026", "Where to put a BPO / KPO floor in Indore",
    `Ten bare-shell options from the BD deck of 29 Sep 2026, placed on the real metro and checked against public sources. Pick any option to see its catchment.`);
  const top = ranked.slice(0, 3).map(o => {
    const p = scoreParts(o);
    const why = PARTS.filter(x => p[x.key] >= .85).slice(0, 3).map(x => x.label.toLowerCase()).join(", ");
    return `<li>${optLink(o)} <span class="mono" style="color:var(--mut)">${score(o)}/100</span><br><span class="note">Strong on ${why || "balance"}. ${esc(o.commuteDist)} to ${esc(o.commute)}. Handover: ${esc(o.handover)}.</span></li>`;
  }).join("");
  const lensAns = {
    location: `${O.filter(o => o.micro === "sbd").length} in the SBD, ${O.filter(o => o.micro === "pbd").length} on the Super Corridor, 1 at Sinhasa`,
    req: `${inr(Math.min(...O.map(o => o.carpetArea)))} to ${inr(Math.max(...O.map(o => o.carpetArea)))} SF carpet per option`,
    scale: `Largest headroom: ${O.slice().sort((a, b) => (b.buildingTotal - b.superArea) - (a.buildingTotal - a.superArea))[0].name}`,
    parking: `1 per 1,000 SF at ${O.filter(o => o.parkingPer1000 >= 1).length} options; F&B listed only at The Hub`,
    infra: `Power backup listed at ${O.filter(o => amenKeys(o).has("power")).length} of 10`,
    timeline: `${ready.length} ready now, ${loi.length} at 90 days from LOI; ${O.filter(o => /Under Construction/i.test(o.handoverDetail)).length} under construction`,
    manpower: "Moderate pool, ₹14-20k entry pay, 25-40% attrition",
    bench: "Infosys, TCS, TaskUs, Teleperformance and more mapped",
    amenities: "Every option's amenity list, with gaps struck through"
  };
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">Insights</h3>
    ${insightsHTML()}
    <div class="kpis">
      <div class="kpi"><div class="l">Options</div><div class="v">${O.length}</div><div class="s">${gradeA.length} Grade A · ${O.length - gradeA.length} Grade B</div></div>
      <div class="kpi"><div class="l">Super built-up</div><div class="v num">${(tot / 100000).toFixed(2)} L</div><div class="s">${inr(carpet)} SF carpet</div></div>
      <div class="kpi"><div class="l">Ready now</div><div class="v">${ready.length}</div><div class="s">+${loi.length} at 90 days from LOI</div></div>
      <div class="kpi"><div class="l">Metro ≤ 1 km</div><div class="v">${near.length}</div><div class="s">deck distances</div></div>
      <div class="kpi"><div class="l">Efficiency</div><div class="v">${Math.min(...O.map(o => o.efficiency))}-${Math.max(...O.map(o => o.efficiency))}%</div><div class="s">carpet / super</div></div>
      <div class="kpi"><div class="l">Metro open</div><div class="v">16 stn</div><div class="s">since 6 Sep 2026</div></div>
    </div>
    <h3>Highest fit today · ${esc(PRESETS[S.preset] ? PRESETS[S.preset].label : "custom weights")}</h3>
    <ol style="padding-left:18px;margin:0;line-height:1.5;font-size:13px">${top}</ol>
    <p class="note">Fit score weighs metro access, readiness, talent reach, scale, efficiency, grade, parking and listed infrastructure. Re-rank by the client's priority on <a href="#" data-tab="priorities">Priorities</a>.</p>
    <h3>The nine requirement lenses (deck page 3)</h3>
    <div class="lens">${window.IND_LENSES.map(l => `<div class="l"><b>${esc(l.label)}</b>${esc(lensAns[l.key])}</div>`).join("")}</div>
    <h3>Micro-markets in one line each</h3>
    ${window.IND_ZONES.map(z => { const os = O.filter(o => o.micro === z.key);
      return `<div class="fact"><span class="dot" style="background:${z.color}"></span><span class="k">${esc(z.label)} · ${esc(z.name)}</span> <span class="note">${esc(z.sub)}</span><br>${os.length ? os.map(optLink).join(" · ") : '<span class="note">No option offered here. The deck: "Best transit access; least Grade-A office supply."</span>'}</div>`; }).join("")}
    <h3>Contacts (deck page 19)</h3>
    ${window.IND_CONTACTS.map(c => `<div class="contact"><b>${esc(c.name)}</b><span><a href="tel:${esc(c.phone.replace(/\s/g, ""))}">${esc(c.phone)}</a> · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></span></div>`).join("")}
    <p class="note" style="margin-top:10px">Deck map view: ${cite(M.mapLink, "Google My Maps")}</p>`;
}

/* ---------- shared: insights, verdict, actions ---------- */
const actions = () => `<div class="actions"><button type="button" class="act" data-copy data-hint="Copies a link that opens exactly this view, ready to send to a client.">Copy link</button><button type="button" class="act" data-print data-hint="Prints this view, or saves it as a PDF from the print dialog.">Print / PDF</button></div>`;
/* The few facts a client asks first, each one tap from its option. */
function insightsHTML() {
  const top = (f) => O.slice().sort((a, b) => f(b) - f(a))[0];
  const best = top(exact), near = top(o => -o.commuteM), big = top(o => o.superArea), eff = top(o => o.efficiency), tal = top(talentRaw);
  const readyNow = O.filter(o => o.handoverKind === "ready"), readyBest = readyNow.slice().sort(byFit)[0];
  const tc = catchment(tal), home = top(o => -exKm(o));
  const cards = [
    { l: "Best overall", v: best.name, s: `Fit ${score(best)}/100 on ${PRESETS[S.preset] ? PRESETS[S.preset].label.toLowerCase() : "custom"} weights${levelWith(best).length ? `, just ahead of ${levelWith(best)[0].name} (${exact(best).toFixed(2)} against ${exact(levelWith(best)[0]).toFixed(2)})` : ""}`, go: best.id, tone: "lead" },
    { l: `Closest to ${EX.name}`, v: fmtKm(exKm(home)), s: `${home.name}, about ${driveMin(exKm(home))} min by road from the existing building`, go: home.id },
    { l: "Closest to metro", v: near.commuteDist, s: `${metroKm(near)} · ${near.name}, to ${deckStations(near)[0].stn ? deckStations(near)[0].stn.name : near.commute}`, go: near.id },
    { l: "Move in now", v: readyBest.name, s: `Best of ${readyNow.length} ready-now options`, go: readyBest.id },
    { l: "Largest space", v: `${inr(big.superArea)} SF`, s: `${big.name}, handover ${big.handover}`, go: big.id },
    { l: "Most efficient", v: `${eff.efficiency}%`, s: `${eff.name}, carpet to super`, go: eff.id },
    { l: "Deepest talent reach", v: tal.name, s: `${upTo(tc, 1, "edu")} institutions, ${upTo(tc, 1, "res")} belts in 30 min`, go: tal.id }
  ];
  return `<div class="ins" role="list">${cards.map(c => `<button type="button" role="listitem" class="in ${c.tone || ""}" ${c.go ? `data-go="${c.go}"` : `data-tab="${c.tab}"`} data-hint="Open this option: the map flies in and its details open.">
    <span class="l">${esc(c.l)}</span><span class="v">${esc(c.v)}</span><span class="s">${esc(c.s)}</span></button>`).join("")}</div>`;
}
/* Strengths are parts scoring 85% or more, watch-outs 35% or less, plus the
   Derived, never hand-written. */
function verdictHTML(o, p) {
  const good = PARTS.filter(x => p[x.key] >= .85).map(x => x.label);
  const weak = PARTS.filter(x => p[x.key] <= .35).map(x => x.label);
  return `<div class="verdict">${good.map(g => `<span class="vd up">✓ ${esc(g)}</span>`).join("")}${weak.map(w => `<span class="vd dn">! ${esc(w)}</span>`).join("")}</div>`;
}

/* ---------- Priorities ---------- */
function renderPriorities() {
  head("Priority mapping", "Rank the options by what matters most",
    "Pick the client's priority. The weights change, the ranking re-sorts, and the list, map pins and brief follow.");
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const base = rankBy(PRESETS.balanced.w);
  const cur = O.slice().sort(byFit);
  const rows = cur.map((o, i) => {
    const d = base.indexOf(o.id) - i;
    const dl = d > 0 ? `<span class="dl up" title="Up ${d} against balanced">▲ ${d}</span>` : d < 0 ? `<span class="dl dn" title="Down ${-d} against balanced">▼ ${-d}</span>` : `<span class="dl">–</span>`;
    return `<div class="rk"><span class="pos">${i + 1}</span><span class="nm">${optLink(o)} <span class="g g${o.grade}">${o.grade}</span></span>
      <div class="tr" aria-hidden="true"><div class="fl" style="width:${score(o)}%"></div></div><span class="val">${score(o)}</span>${dl}</div>`;
  }).join("");
  const wsum = PARTS.reduce((s, x) => s + W[x.key], 0) || 1;
  $("#p-body").innerHTML = `
    <div class="presets" role="group" aria-label="Client priority">${Object.entries(PRESETS).map(([k, v]) => `<button type="button" class="chip ${S.preset === k ? "on" : ""}" aria-pressed="${S.preset === k}" data-preset="${k}" data-hint="${esc(v.note)}">${esc(v.label)}</button>`).join("")}</div>
    <p class="lede" style="margin-top:8px">${esc(PRESETS[S.preset] ? PRESETS[S.preset].note : "Custom weights set on Compare all.")}</p>
    <div class="wts">${PARTS.map(x => `<span title="${esc(x.of)}">${esc(x.label)} <b>${Math.round(W[x.key] / wsum * 100)}%</b></span>`).join("")}</div>
    <h3>Ranking ${S.preset !== "balanced" ? "· arrows show the move against Balanced" : ""}</h3>
    <div class="rks">${rows}</div>
    <h3>Readiness against metro access</h3>
    ${quadrantHTML()}
    <p class="note">x: the deck's distance to the nearest metro station. y: handover against today (${esc(M.asOf.split("-").reverse().join("/"))}). A past handover date is placed below "now" until confirmed.</p>`;
  wireQuadrant();
}
/* Scatter of the two parts a client asks about first. Two series (Grade A,
   Grade B), validated colours, legend always shown, 2 px surface ring, a
   hover and keyboard tooltip on every dot, and a table view. */
function quadrantHTML() {
  const Wd = 460, Hd = 326, L = 70, Rr = 16, T = 30, B = 40, pw = Wd - L - Rr, ph = Hd - T - B;
  /* Domains padded so no dot sits on the frame: readiness 0.15-1.08, access 0-1.04. */
  const X = (v) => L + v / 1.04 * pw, Y = (v) => T + (1.08 - v) / .93 * ph;
  const xt = [[9300, "9 km"], [3000, "3 km"], [2000, "2 km"], [1000, "1 km"], [300, "300 m"]];
  const yt = [[1, "Now"], [.85, "90 days"], [.7, "3 mo"], [.4, "6 mo"]];
  const grid = xt.map(([m, l]) => `<line x1="${X(transitV(m))}" x2="${X(transitV(m))}" y1="${T}" y2="${T + ph}" class="gl"/><text x="${X(transitV(m))}" y="${T + ph + 16}" class="tk" text-anchor="middle">${l}</text>`).join("")
    + yt.map(([v, l]) => `<line x1="${L}" x2="${L + pw}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="tk" text-anchor="end">${l}</text>`).join("");
  const q = `<text x="${L + pw - 4}" y="${T - 12}" class="ql" text-anchor="end">Ready and connected</text>
    <text x="${L + 6}" y="${T - 12}" class="ql">Ready, cab-dependent</text>
    <text x="${L + pw - 4}" y="${T + ph - 6}" class="ql" text-anchor="end">Connected, wait for handover</text>
    <text x="${L + 6}" y="${T + ph - 6}" class="ql">Wait and cab-dependent</text>`;
  const dots = O.slice().sort((a, b) => exact(a) - exact(b)).map(o => {
    const p = scoreParts(o), cx = X(p.transit), cy = Y(p.ready);
    return `<g class="qd" tabindex="0" role="button" data-q="${o.id}" aria-label="${esc(o.name)}, Grade ${o.grade}, ${esc(o.commuteDist)} to metro, handover ${esc(o.handover)}, fit ${score(o)}">
      <circle cx="${cx}" cy="${cy}" r="15" class="hit"/><circle cx="${cx}" cy="${cy}" r="9.5" class="g${o.grade}"/>
      <text x="${cx}" y="${cy + 3.4}" text-anchor="middle" class="dn">${o.n}</text></g>`;
  }).join("");
  const table = `<table class="ring-tbl" id="pm-table" hidden><thead><tr><th>Option</th><th>Grade</th><th>Metro (deck)</th><th>Handover</th><th>Fit</th></tr></thead><tbody>${
    O.slice().sort(byFit).map(o => `<tr><td>${optLink(o)}</td><td>${o.grade}</td><td>${esc(o.commuteDist)}</td><td>${esc(handoverText(o))}</td><td class="num">${score(o)}</td></tr>`).join("")}</tbody></table>`;
  return `<div class="qwrap"><div class="qleg"><span><i class="sA"></i>Grade A</span><span><i class="sB"></i>Grade B</span><button type="button" class="act" data-tableview>Show as table</button></div>
    <svg viewBox="0 0 ${Wd} ${Hd}" class="quad" role="img" aria-label="Scatter of options by readiness and metro access">${grid}
      <line x1="${X(.6)}" x2="${X(.6)}" y1="${T}" y2="${T + ph}" class="mid"/><line x1="${L}" x2="${L + pw}" y1="${Y(.6)}" y2="${Y(.6)}" class="mid"/>${q}
      <text x="${L + pw / 2}" y="${Hd - 4}" class="ax" text-anchor="middle">Closer to an open metro station →</text>
      <text transform="translate(11 ${T + ph / 2}) rotate(-90)" class="ax" text-anchor="middle">Sooner handover →</text>${dots}</svg>
    <div class="qtip" hidden></div></div>${table}`;
}
function wireQuadrant() {
  const wrap = $(".qwrap"); if (!wrap) return;
  const tip = wrap.querySelector(".qtip");
  const show = (g) => {
    const o = O.find(x => x.id === g.dataset.q), r = g.querySelector("circle.hit").getBoundingClientRect(), w = wrap.getBoundingClientRect();
    tip.innerHTML = `<b>${String(o.n).padStart(2, "0")} ${esc(o.name)}</b><br>Grade ${o.grade} · ${esc(o.commuteDist)} to metro<br>Handover ${esc(o.handover)} · fit ${score(o)}`;
    tip.hidden = false;
    const left = Math.min(Math.max(r.left - w.left + r.width / 2 - 90, 0), w.width - 180);
    tip.style.left = left + "px"; tip.style.top = (r.top - w.top - tip.offsetHeight - 6) + "px";
  };
  wrap.querySelectorAll(".qd").forEach(g => {
    g.addEventListener("mouseenter", () => show(g)); g.addEventListener("focus", () => show(g));
    g.addEventListener("mouseleave", () => { tip.hidden = true; }); g.addEventListener("blur", () => { tip.hidden = true; });
    g.addEventListener("click", () => select(g.dataset.q, true));
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(g.dataset.q, true); } });
  });
}

/* ---------- mobile sheet ----------
   On a phone the map fills the screen and the panel is a bottom sheet with
   three stops: peek (option strip only), half, and full. Drag the grip or
   tap it to cycle. */
function setSheet(state) { S.sheet = state; document.body.dataset.sheet = state; }
/* The sheet follows the finger while dragged, then settles on the nearest
   stop; a quick flick goes one stop in its direction. A tap toggles half and
   full. */
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
  g.addEventListener("pointerdown", e => {
    y0 = e.clientY; t0 = performance.now(); moved = false; h0 = $("#panel").getBoundingClientRect().height;
    try { g.setPointerCapture(e.pointerId); } catch (x) {}
  });
  g.addEventListener("pointermove", e => {
    if (y0 == null) return;
    if (!moved && Math.abs(e.clientY - y0) > 6) { moved = true; document.body.classList.add("sheet-drag"); }
    if (moved) {
      const st = SHEET_STOPS(), h = Math.max(st.peek - 30, Math.min(st.full, h0 - (e.clientY - y0)));
      document.body.style.setProperty("--sheet-h", h + "px");
    }
  });
  g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
  g.addEventListener("click", () => { if (moved) { moved = false; return; } setSheet(S.sheet === "half" ? "full" : "half"); });
}

/* ------------------------------------------------ resizable panes (desktop)
   As in Digitide: drag the inner edge of the options list or the details
   panel (or focus it and use the arrow keys); double-click resets. Widths
   are clamped so a width saved on a wide screen cannot swallow a narrow
   one. The fold buttons (or [ and ]) slide a pane away for more map. */
const PANE = { board: { v: "--board-w", min: 260, max: 520, def: 340 }, panel: { v: "--panel-w", min: 380, max: 820, def: 500 } };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
function setPaneW(k, px, save = true) {
  const c = PANE[k], w = Math.round(Math.min(c.max, Math.max(c.min, px), innerWidth * .42));
  document.documentElement.style.setProperty(c.v, w + "px");
  if (save) store.set("ind-w-" + k, String(w));
}
function setFold(k, on) {
  document.body.classList.toggle("fold-" + k, on);
  store.set("ind-fold-" + k, on ? "1" : "");
  const pane = document.getElementById(k);
  if (on && pane.contains(document.activeElement)) document.querySelector(`.reopen-${k}`).focus();
  /* Re-frame the map for the room the pane gave up or took back. */
  clearTimeout(setFold.t);
  setFold.t = setTimeout(() => { if (!map) return; if (S.sel) flyToOption(O.find(x => x.id === S.sel), S.shot); else fitAll(); }, 320);
}
function wirePanes() {
  for (const k of ["board", "panel"]) {
    const v = Number(store.get("ind-w-" + k)); if (v) setPaneW(k, v, false);
    if (store.get("ind-fold-" + k) === "1" && innerWidth > 860) setFold(k, true);
  }
  document.querySelectorAll("[data-fold]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.fold; setFold(k, !document.body.classList.contains("fold-" + k));
  }));
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
  const p = scoreParts(o), sc = score(o), c = catchment(o), k = amenKeys(o), f = fits(o);
  const zone = window.IND_ZONE_OF[o.micro];
  $("#p-head").innerHTML = `<button class="back" type="button">← Back to ${esc(TABS.find(t => t.key === S.tab).label)}</button>
    <div class="eyebrow">Option ${String(o.n).padStart(2, "0")} · ${esc(o.locality)} · ${esc(zone)}</div>
    <h2>${esc(o.name)} <span class="g g${o.grade}" style="vertical-align:5px">Grade ${o.grade}</span></h2>${verdictHTML(o, p)}${shotBar(o)}${actions()}`;
  const allAmen = Object.keys(window.IND_AMENITY_LABELS);
  const missing = allAmen.filter(a => !k.has(a) && a !== "firetank" && a !== "fnb");
  const stations = deckStations(o);
  const anchors = [
    { name: "Airport", p: window.IND_PLACES.find(x => x.id === "airport") },
    { name: "Railway station", p: window.IND_PLACES.find(x => x.id === "rail") },
    { name: "Rajwada (old CBD)", p: { lat: 22.7186, lng: 75.8553 } },
    { name: "Bhawarkua student belt", p: window.IND_PLACES.find(x => x.id === "bhawarkua") }
  ].map(a => ({ ...a, d: km(o, a.p) }));
  const headroom = o.buildingTotal - o.superArea;
  const ringRows = c.map((r, i) => `<tr><td>≤ ${r.min} min <span class="note">(${r.km.toFixed(1)} km)</span></td><td class="num">${upTo(c, i, "edu")}</td><td class="num">${upTo(c, i, "res")}</td><td class="num">${upTo(c, i, "emp")}</td></tr>`).join("");
  const within = (kind, i) => c.slice(0, i + 1).flatMap(r => r[kind]).sort((a, b) => a.d - b.d);
  $("#p-body").innerHTML = `
    <div class="hero">${pic(o, "full")}<span class="ph">Photo from deck page ${o.page}</span></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Super built-up</div><div class="v num">${inr(o.superArea)}</div><div class="s">SF</div></div>
      <div class="kpi"><div class="l">Carpet</div><div class="v num">${inr(o.carpetArea)}</div><div class="s">SF, ±3% ${f == null ? "" : `<span class="fit ${f ? "yes" : "no"}">${f ? "fits target" : "short of target"}</span>`}</div></div>
      <div class="kpi"><div class="l">Efficiency</div><div class="v">${o.efficiency}%</div><div class="s">as printed</div></div>
      <div class="kpi"><div class="l">Handover</div><div class="v" style="font-size:16px">${esc(o.handover)}</div><div class="s">${esc(handoverNote(o))}</div></div>
      <div class="kpi"><div class="l">Metro</div><div class="v">${esc(o.commuteDist)}</div><div class="s">${metroKm(o)} · ${stations.map(s => esc(s.stn ? s.stn.name : s.label)).join(" / ")}${stations.every(s => s.stn && s.stn.open) ? " · open" : ""}</div></div>
      <div class="kpi"><div class="l">Fit score</div><div class="v">${sc}<span style="font-size:13px;color:var(--mut)">/100</span></div><div class="s">rank ${O.slice().sort(byFit).findIndex(x => x.id === o.id) + 1} of 10${levelWith(o).length ? `, level on ${sc} with ${esc(levelWith(o).map(x => x.name).join(", "))} (exact ${exact(o).toFixed(2)})` : ""}</div></div>
    </div>

    ${vsExistingHTML(o, c)}

    <h3>As the deck states it (page ${o.page})</h3>
    <table class="spec">
      <tr><th>Grade</th><td>Grade ${esc(o.grade)}</td></tr>
      <tr><th>Floor(s) available</th><td>${esc(o.floors)}</td></tr>
      <tr><th>Area available</th><td>${esc(o.areaNote)}</td></tr>
      <tr><th>Space condition</th><td>${esc(o.condition)}</td></tr>
      <tr><th>Handover</th><td>${esc(o.handoverDetail)}${o.handoverDetail !== o.handover ? ` <span class="note">(headline: ${esc(o.handover)})</span>` : ""}</td></tr>
      <tr><th>Typical floor plate</th><td class="num">${inr(o.floorPlate)} SF</td></tr>
      <tr><th>Building efficiency</th><td>${o.efficiency}%</td></tr>
      <tr><th>Building</th><td>${esc(o.structureText)}</td></tr>
      <tr><th>Car Parking Ratio</th><td>${esc(o.parkingRatio)}</td></tr>
      <tr><th>Car Parking Charges</th><td>${esc(o.parkingCharges)}</td></tr>
      <tr><th>Nearest commute (page 7)</th><td>${esc(o.commute)} · ${esc(o.commuteDist)}</td></tr>
      <tr><th>Name in key points table</th><td>${esc(o.keyPointsName)}${o.deckAltName ? ` · also "${esc(o.deckAltName)}"` : ""} · printed as ${esc(o.deckLabel)}</td></tr>
    </table>
    <h3>Key amenities</h3>
    <div class="am">${o.amenities.map(a => `<span>${esc(a)}</span>`).join("")}${missing.map(a => `<span class="miss" title="Not listed in the deck">${esc(window.IND_AMENITY_LABELS[a])}</span>`).join("")}</div>
    <p class="note">Struck through: not listed for this option. Ask before assuming it exists.</p>

    <h3>Fit score, part by part</h3>
    <div class="bars">${PARTS.map(x => `<div class="bar" title="${esc(x.of)}"><span>${esc(x.label)}</span><div class="tr"><div class="fl" style="width:${Math.round(p[x.key] * 100)}%"></div></div><span class="val">${(p[x.key] * W[x.key]).toFixed(1)} / ${W[x.key]}</span></div>`).join("")}</div>

    <h3>Catchment and employability</h3>
    <table class="ring-tbl"><thead><tr><th>Drive time</th><th>Institutions</th><th>Residential belts</th><th>Rival employers</th></tr></thead><tbody>${ringRows}</tbody></table>
    <p class="note">${esc(METHOD)}</p>
    <div class="two" style="margin-top:8px">
      <div class="box"><h4>Talent inside 30 min</h4><div class="plc">${[...within("edu", 1), ...within("res", 1)].map(x => `<span title="${esc(x.note)}"><span class="dot" style="background:${x.kind === "edu" ? "var(--edu)" : "var(--res)"}"></span>${esc(x.name)} · ${x.d.toFixed(1)} km</span>`).join("") || '<span>None mapped</span>'}</div></div>
      <div class="box"><h4>Competing for the same people, inside 15 min</h4><div class="plc">${within("emp", 0).map(x => `<span title="${esc(x.note)}"><span class="dot" style="background:var(--emp)"></span>${esc(x.name)} · ${x.d.toFixed(1)} km</span>`).join("") || '<span>None mapped</span>'}</div></div>
    </div>
    <p class="note" style="margin-top:8px">${employabilityRead(o, c)}</p>

    <h3>How far from the anchors</h3>
    <table class="spec">${anchors.map(a => `<tr><th>${esc(a.name)}</th><td>${a.d.toFixed(1)} km straight line · about ${driveMin(a.d)} min by road</td></tr>`).join("")}</table>

    <h3>Room to grow</h3>
    <p>${inr(o.superArea)} SF offered in a ${inr(o.buildingTotal)} SF building, leaving ${inr(headroom)} SF (${Math.round(headroom / o.buildingTotal * 100)}%) that is either occupied or unoffered. ${headroom < 60000 ? "Little room to expand in the same building." : "Enough stock in the building to ask for a right of first refusal on adjacent floors."}</p>

    <h3>Where it sits on the map</h3>
    <p class="note">Precision: <b>${esc(o.precision)}</b>. ${esc(o.geoNote)} ${o.geoSrc ? cite(o.geoSrc, "source") : ""}</p>`;
}
/* The move from NRK Star, side by side. Metro is measured on the map for
   both buildings (straight line to the nearest open station) so the two
   figures are like for like; the deck's own figure stays in the spec. */
function vsExistingHTML(o, c) {
  /* Employers inside NRK Star itself (Altruist) are left out of both
     sides here, so the rival count compares like with like. */
  const inEx = (pl) => km(pl, EX) < .05;
  const strip = (cc) => cc.map(r => ({ ...r, emp: r.emp.filter(pl => !inEx(pl)) }));
  const d = exKm(o), xc = strip(catchment(EX)), mo = nearestOpen(o), mx = nearestOpen(EX);
  c = strip(c);
  const delta = (a, b, moreIsGood) => { const v = a - b; if (!v) return `<span class="dl">same</span>`;
    return `<span class="dl ${(v > 0) === moreIsGood ? "up" : "dn"}">${v > 0 ? "+" : "−"}${Math.abs(v)}</span>`; };
  const mDelta = Math.round((mo.d - mx.d) * 1000), mTxt = Math.abs(mDelta) < 100 ? `<span class="dl">about the same</span>`
    : `<span class="dl ${mDelta < 0 ? "up" : "dn"}">${mDelta < 0 ? "closer" : "farther"} by ${fmtKm(Math.abs(mDelta) / 1000)}</span>`;
  const rows = [
    ["Micro-market", esc(window.IND_ZONE_OF[EX.micro]), `${esc(window.IND_ZONE_OF[o.micro])} ${o.micro === EX.micro ? `<span class="dl">same</span>` : `<span class="dl dn">different</span>`}`],
    ["Nearest open metro", `${esc(mx.s.name)} · ${fmtKm(mx.d)}`, `${esc(mo.s.name)} · ${fmtKm(mo.d)} ${mTxt}`],
    ["Institutions ≤30 min", upTo(xc, 1, "edu"), `${upTo(c, 1, "edu")} ${delta(upTo(c, 1, "edu"), upTo(xc, 1, "edu"), true)}`],
    ["Residential belts ≤30 min", upTo(xc, 1, "res"), `${upTo(c, 1, "res")} ${delta(upTo(c, 1, "res"), upTo(xc, 1, "res"), true)}`],
    ["Rival employers ≤15 min", upTo(xc, 0, "emp"), `${upTo(c, 0, "emp")} ${delta(upTo(c, 0, "emp"), upTo(xc, 0, "emp"), false)}`]
  ];
  return `<h3>Against ${esc(EX.name)}, the existing building</h3>
    <p class="vsx"><b>${fmtKm(d)} apart</b>, about ${driveMin(d)} min by road. ${esc(moveRead(d))}</p>
    <table class="ring-tbl"><thead><tr><th></th><th>${esc(EX.name)} (existing)</th><th>${esc(o.name)}</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td></tr>`).join("")}</tbody></table>
    <p class="note">Green is better for the move, red is worse. Rival counts leave out employers inside ${esc(EX.name)} itself. Distances are straight line on the map; drive time uses the same assumptions as the rings. ${esc(EX.name)} is pinned to the building; this option's pin is ${esc(o.precision)}-level.</p>`;
}
function employabilityRead(o, c) {
  const edu = upTo(c, 1, "edu"), res = upTo(c, 1, "res"), emp = upTo(c, 0, "emp");
  const bk = km(o, window.IND_PLACES.find(x => x.id === "bhawarkua"));
  const parts = [];
  parts.push(`${edu} institutions and ${res} residential belts sit inside a 30-minute drive.`);
  parts.push(bk <= ringKm(30) ? `The Bhawarkua student belt, the city's deepest fresher pool, is about ${driveMin(bk)} min away.` : `The Bhawarkua student belt is about ${driveMin(bk)} min away, so fresher hiring leans on cabs or the not-yet-open south metro.`);
  parts.push(emp >= 3 ? `${emp} rival employers within 15 minutes: good for experienced hires, a retention risk at entry level.` : emp ? `${emp} rival employer${emp > 1 ? "s" : ""} within 15 minutes.` : "No mapped rival employer within 15 minutes.");
  if (o.commuteM > 2000) parts.push("Budget cab coverage for every shift; the metro is not a walk away.");
  return parts.join(" ");
}

/* ---------- Talent ---------- */
function renderTalent() {
  head("Talent & catchment", "Who can get here, and who else wants them",
    "City-level employability, then every option's reach. Institutions, residential belts and rival employers are mapped; switch them on and off with the layer chips.");
  const rows = O.slice().sort((a, b) => talentRaw(b) - talentRaw(a)).map(o => {
    const c = catchment(o), bk = km(o, window.IND_PLACES.find(x => x.id === "bhawarkua"));
    return `<tr><td>${optLink(o)}</td><td class="num">${upTo(c, 0, "edu")} / ${upTo(c, 1, "edu")}</td><td class="num">${upTo(c, 1, "res")}</td><td class="num">${upTo(c, 0, "emp")}</td><td class="num">${driveMin(bk)} min</td></tr>`;
  }).join("");
  $("#p-body").innerHTML = `
    <h3>Employability, city level</h3>
    ${factList(F.talent)}
    <h3>Reach by option</h3>
    <table class="ring-tbl"><thead><tr><th>Option</th><th>Institutions ≤15 / ≤30 min</th><th>Residential ≤30</th><th>Rivals ≤15</th><th>To Bhawarkua</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">${esc(METHOD)} Institution and belt positions are approximate.</p>
    <h3>Shift planning</h3>
    <div class="deckq">"${esc(window.IND_DECK_MARKET.transport.shift)}"</div>
    ${factList(F.living.filter(x => /night/i.test(x.k)))}
    <h3>Employers recruiting the same pool</h3>
    ${factList(F.employers)}
    <h3>Institutions mapped</h3>
    ${window.IND_PLACES.filter(p => p.kind === "edu").map(p => `<div class="fact"><span class="dot" style="background:var(--edu)"></span><span class="k">${esc(p.name)}</span> <span class="note">${esc(p.sub || "")}</span><br><span class="note">${esc(p.note)} ${p.src ? cite(p.src) : ""}</span></div>`).join("")}
    <h3>Residential catchments mapped</h3>
    ${window.IND_PLACES.filter(p => p.kind === "res").map(p => `<div class="fact"><span class="dot" style="background:var(--res)"></span><span class="k">${esc(p.name)}</span><br><span class="note">${esc(p.note)}</span></div>`).join("")}`;
}

/* ---------- Transit ---------- */
function renderTransit() {
  const T = window.IND_DECK_MARKET.transport, reality = {
    "Vijay Nagar": "Now: on the metro (Vijay Nagar Chauraha and Meghdoot Garden are open). The BRTS lanes have been removed; iBus runs in mixed traffic.",
    "Super Corridor": "Now: the full corridor is on the open metro, linked to Bhawarsala, MR-10 and Vijay Nagar since 6 Sep 2026. Cabs still needed at night and from the south.",
    "CBD": "Now: still bus-led. Palasia, High Court, Railway Station and Rajwada metro stations are not open yet."
  };
  head("Transit", "How employees get to work", "The deck's view (page 4) beside the network as it runs on 30 Sep 2026.");
  const rows = O.slice().sort((a, b) => a.commuteM - b.commuteM).map(o => {
    const st = deckStations(o);
    return `<tr><td>${optLink(o)}</td><td>${st.map(s => esc(s.stn ? s.stn.name : s.label)).join(" / ")}</td><td class="num">${esc(o.commuteDist)} <span class="note">(${metroKm(o)})</span></td><td>${st.every(s => s.stn && s.stn.open) ? '<span class="tick">open</span>' : "check"}</td><td class="num">${o.commuteM <= 1500 ? `${Math.round(o.commuteM / 80)} min walk` : "cab / feeder"}</td></tr>`;
  }).join("");
  $("#p-body").innerHTML = `
    <h3>Access by micro-market</h3>
    ${T.micro.map(m => `<div class="box" style="margin-bottom:8px"><h4>${esc(m.name)}</h4><div class="deckq" style="margin:4px 0">"${esc(m.text)}"</div><div class="note">${esc(reality[m.name])}</div></div>`).join("")}
    <div class="deckq">"${esc(T.shift)}"</div>
    <h3>Nearest station for each option</h3>
    <table class="ring-tbl"><thead><tr><th>Option</th><th>Station (deck)</th><th>Distance</th><th>Status</th><th>On foot</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Walk time at 80 m a minute on the deck's distance. Every station the deck names is on the open section.</p>
    <h3>Metro</h3>
    ${factList(F.metro)}
    <h3>Buses</h3>
    ${factList(F.bus)}
    <h3>The deck's transit map</h3>
    <figure>${figPic(T.image, "Deck page 4 public transport connectivity map")}<figcaption>Deck page 4. "${esc(T.mapCaption)}" Legend: ${T.legend.map(esc).join("; ")}. Its station sequence does not match the real line.</figcaption></figure>`;
}

/* ---------- Market ---------- */
function renderMarket() {
  const SC = window.IND_DECK_MARKET.superCorridor;
  head("Market & incentives", "What the market and the state offer", "The deck's read on the Super Corridor (page 5), public market signals, and Madhya Pradesh incentives.");
  $("#p-body").innerHTML = `
    <div class="deckq">"${esc(SC.heading)}"</div>
    <div class="two">
      <div class="box"><h4>Strategic advantages</h4><ul>${SC.advantages.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="box"><h4>Challenges</h4><ul>${SC.challenges.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    </div>
    <p class="note">On the list: ${O.filter(o => o.micro === "pbd").map(optLink).join(" and ")} are on the Super Corridor. Their plates (${O.filter(o => o.micro === "pbd").map(o => inr(o.floorPlate)).join(" and ")} SF) bear out "large contiguous plates"; ${O.find(o => o.id === "veda").name} is still under construction, which is the "pipeline slippage risk" in practice.</p>
    <h3>What the deck's Super Corridor graphic claims</h3>
    <ul style="padding-left:18px;font-size:12.5px;line-height:1.6;margin:0">${SC.claims.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    <p class="note">Deck claims, not verified here. InfoBeans lists its office at Crystal IT Park, not on the corridor.</p>
    <figure>${figPic(SC.image, "Deck page 5 Super Corridor map")}<figcaption>Deck page 5, Super Corridor Indore.</figcaption></figure>
    <h3>Office market signals</h3>
    ${factList(F.market)}
    <h3>Madhya Pradesh incentives</h3>
    ${factList(F.incentives)}
    <h3>Living and operating in Indore</h3>
    ${factList(F.living.filter(x => !/night/i.test(x.k)))}`;
}

/* ---------- Deck coverage ---------- */
function renderDeck() {
  head("Deck map", "Every page of the deck, and where it lives here", `${esc(M.deck)}. ${M.deckPages} pages.`);
  const rows = [
    [1, "Cover: Market overview + initial inventory options, Indore Commercial Real Estate", "Header and gate"],
    [2, "About our company", "Gate and header"],
    [3, "Here's how we understand your requirements: nine lenses", `<a href="#" data-tab="brief">Brief</a> (each lens answered)`],
    [4, "Public transport & accessibility: micro-market access, 3-shift note, transport map", `<a href="#" data-tab="transit">Transit</a>, map layers`],
    [5, "Super Corridor · PBD: advantages, challenges, corridor graphic", `<a href="#" data-tab="market">Market</a>, PBD zone on the map`],
    [6, "Shortlisted Office Options (Indore)", "Options list"],
    [7, "Key Points Mapping: nearest commute, distance, super built-up, efficiency", `Every option card and <a href="#" onclick="openCompare();return false">Compare all</a>`],
    ...O.map(o => [o.page, `${o.deckLabel}: ${o.name}, all 11 fields, amenities and photo`, optLink(o)]),
    [18, "Map View: link to Google My Maps", `${cite(M.mapLink, "Google My Maps")} (pins re-placed here with precision notes)`],
    [19, "Contacts: Mehul Kapadia, Madhvi Jain", `<a href="#" data-tab="brief">Brief</a>, contacts`]
  ];
  $("#p-body").innerHTML = `
    <table class="cov"><thead><tr><th>Page</th><th>What it says</th><th>Where</th><th></th></tr></thead>
    <tbody>${rows.map(r => `<tr><td class="num">${r[0]}</td><td>${esc(r[1])}</td><td>${r[2]}</td><td class="tick">✓</td></tr>`).join("")}</tbody></table>
    <p class="note">Every option field is carried over verbatim, typos included. Where two pages disagree, both are kept.</p>
    <h3>Deck maps</h3>
    <figure>${figPic(window.IND_DECK_MARKET.transport.image, "Deck page 4 map")}<figcaption>Page 4, public transport connectivity map (illustrative).</figcaption></figure>
    <figure>${figPic(window.IND_DECK_MARKET.superCorridor.image, "Deck page 5 map")}<figcaption>Page 5, Super Corridor Indore.</figcaption></figure>`;
}

/* ============================================================ compare == */
function openCompare() {
  $("#cmp").classList.add("on");
  renderCompare();
}
window.openCompare = openCompare;
let CMP_SORT = "score";
function renderCompare() {
  const list = O.slice().sort((a, b) => CMP_SORT === "deck" ? a.n - b.n : exact(b) - exact(a));
  const best = (fn, hi = true) => { const v = list.map(fn); const t = hi ? Math.max(...v) : Math.min(...v); return (o) => fn(o) === t; };
  const rows = [
    ["Fit score", o => `<b>${score(o)}</b>/100`, best(score)],
    ["Micro-market", o => esc(window.IND_ZONE_OF[o.micro])],
    ["Location", o => esc(o.locality)],
    [`From ${EX.name} (existing)`, o => `${fmtKm(exKm(o))} · about ${driveMin(exKm(o))} min`, best(o => -exKm(o))],
    ["Grade", o => `Grade ${o.grade}`],
    ["Floor(s) available", o => esc(o.floors)],
    ["Super built-up (SF)", o => inr(o.superArea), best(o => o.superArea)],
    ["Carpet (SF, ±3%)", o => inr(o.carpetArea) + (fits(o) == null ? "" : ` <span class="fit ${fits(o) ? "yes" : "no"}">${fits(o) ? "fits" : "short"}</span>`), best(o => o.carpetArea)],
    ["Efficiency", o => o.efficiency + "%", best(o => o.efficiency)],
    ["Space condition", o => esc(o.condition)],
    ["Handover", o => esc(handoverText(o)), best(o => -handoverRank(o))],
    ["Typical floor plate (SF)", o => inr(o.floorPlate)],
    ["Building", o => esc(o.structureText)],
    ["Headroom in building (SF)", o => inr(o.buildingTotal - o.superArea), best(o => o.buildingTotal - o.superArea)],
    ["Nearest commute", o => esc(o.commute)],
    ["Distance", o => `${esc(o.commuteDist)} <span class="note">(${metroKm(o)})</span>`, best(o => -o.commuteM)],
    ["Car parking ratio", o => esc(o.parkingRatio)],
    ["Car parking charges", o => esc(o.parkingCharges)],
    ["Key amenities", o => o.amenities.map(esc).join(", ")],
    ["Talent reach ≤30 min", o => { const c = catchment(o); return `${upTo(c, 1, "edu")} inst · ${upTo(c, 1, "res")} belts`; }, best(talentRaw)],
    ["Rivals ≤15 min", o => String(upTo(catchment(o), 0, "emp"))],
    ["Deck page", o => `p.${o.page} · ${esc(o.deckLabel)}`]
  ];
  $("#cmp-body").innerHTML = `
    <div class="weights">${PARTS.map(p => `<label>${esc(p.label)} <span class="mono">${W[p.key]}</span><input type="range" min="0" max="40" step="1" value="${W[p.key]}" data-w="${p.key}" aria-label="Weight for ${esc(p.label)}"></label>`).join("")}
      <label>Order<select id="cmp-sort"><option value="score" ${CMP_SORT === "score" ? "selected" : ""}>Fit score</option><option value="deck" ${CMP_SORT === "deck" ? "selected" : ""}>Deck order</option></select></label></div>
    <p class="note" style="margin:0 0 8px">Weights are relative; the score is rescaled to 100. Shaded cells are the best value in the row. Click a column head to open that option.</p>
    <div style="overflow:auto"><table class="cmp"><thead><tr><th></th>${list.map(o => `<th data-open="${o.id}">${String(o.n).padStart(2, "0")} ${esc(o.name)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(([l, fn, b]) => `<tr><th>${esc(l)}</th>${list.map(o => `<td class="${b && b(o) ? "best" : ""}">${fn(o)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  $("#cmp-body").querySelectorAll("[data-w]").forEach(r => r.addEventListener("input", e => {
    W[e.target.dataset.w] = +e.target.value; S.preset = "custom"; renderCompare(); renderList(); if (S.sel || S.tab === "brief") renderPanel();
    const again = $(`#cmp-body [data-w="${e.target.dataset.w}"]`); if (again) again.focus();
  }));
  $("#cmp-sort").addEventListener("change", e => { CMP_SORT = e.target.value; renderCompare(); });
  $("#cmp-body").querySelectorAll("[data-open]").forEach(h => h.addEventListener("click", () => { $("#cmp").classList.remove("on"); select(h.dataset.open, true); }));
}

initGate();
