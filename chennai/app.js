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

   The revised ranking (Oct 2026) is the client's own sheet: rank, fit
   group, pricing and ecosystem scores and the reason for each rank. It
   leads the list and the overview; the chooser re-ranks the same buildings
   with the sheet's two scores alongside the map measures. The sheet's rents
   and areas are tentative, so the page does not show them.

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

/* ---------------------------------------------------- revised ranking ----
   The three fit groups on the client's sheet. Pins and tiles take the group
   colour; the group is always written beside it too. */
const FITS = {
  best:        { label: "Best fit",         color: "#2e7d5b", bg: "rgba(46,125,91,.12)" },
  value:       { label: "Value-driven fit", color: "#b7791f", bg: "rgba(183,121,31,.13)" },
  conditional: { label: "Conditional fit",  color: "#7b6a5c", bg: "rgba(123,106,92,.13)" }
};
const fitOf = (o) => FITS[o.fit] || null;
const fitColor = (o) => (fitOf(o) || ZONE[o.micro] || { color: "#a3502c" }).color;
const fitBadge = (o) => { const f = fitOf(o); return f ? `<span class="fitb" style="--f:${f.color};--fb:${f.bg}">${esc(f.label)}</span>` : ""; };
const isNum = (v) => typeof v === "number" && isFinite(v);
const fmtDate = (iso) => { const d = iso && new Date(iso + "T00:00:00Z"); return d && !isNaN(d) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : ""; };

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
/* Studio talent is only mentioned where a building has a studio within 30
   minutes; where there is none, the page says nothing rather than "0". */
const hasStudios = (o) => upTo(catchOf(o), 1, "studio") > 0;
/* MTC bus stops near the list (CHN_BUS in data.js): the nearest one to each
   building and how many MTC routes call there. */
const BUSD = window.CHN_BUS || { stops: [] };
const BUS = (BUSD.stops || []).map(([name, lat, lng, routes], i) => ({ id: "bus" + i, name, lat, lng, routes }));
const nearestBus = (p) => BUS.length ? nearest(p, BUS) : null;
const routesTxt = (n) => n ? `about ${n} MTC route${n === 1 ? "" : "s"}` : "MTC stop";
const busWalk = (b) => b.d <= 1.2 ? `${walkMin(b.d)} min walk` : "a short ride";
const exKm = (o) => km(o, EX);
/* Distance from today's office by road: the sheet's figure where it gives
   one, otherwise the straight line with the road factor. */
const homeKm = (o) => isNum(o.roadKm) ? o.roadKm : exKm(o) * ROAD_FACTOR;
const homeMin = (o) => o.driveText || `~${driveMin(exKm(o))} min`;
const homeTxt = (o) => isNum(o.roadKm) ? `~${o.roadKm} km by road · ${o.driveText}` : `${fmtKm(exKm(o) * ROAD_FACTOR)} by road (est.) · ~${driveMin(exKm(o))} min`;

/* ------------------------------------------------------------ scoring ----
   Seven measures, each scored 0 to 1, then weighted by what the client says
   matters. Price and ecosystem are the revised sheet's own scores out of
   10; the other five come from the map. */
const PARTS = [
  { key: "price",   noun: "price",                     label: "Price",                 q: "How much does the price matter?",                                      of: "the pricing score out of 10 on the revised sheet" },
  { key: "eco",     noun: "the ecosystem",             label: "Ecosystem",             q: "How much does the business ecosystem around the building matter?",     of: "the ecosystem score out of 10 on the revised sheet" },
  { key: "rail",    noun: "rail access today",         label: "Rail today",            q: "Can people walk to an open metro, MRTS or suburban station?",          of: "distance to the nearest open station" },
  { key: "home",    noun: "closeness to today's office", label: "Close to today's office", q: "Should today's team keep roughly the same commute?",                 of: "road distance from the current office at KRC Commerzone, Porur (the sheet's figure)" },
  { key: "talent",  noun: "the talent pool",           label: "Talent pool",           q: "Do you want colleges and homes within a 30 minute drive?",            of: "institutes and residential belts by drive time (inside 15 min counts 1, 30 min 0.6, 45 min 0.3)" },
  { key: "studios", noun: "studio talent nearby",      label: "Studio talent nearby",  q: "Do you want experienced VFX and post artists already working nearby?", of: "VFX, animation and post studios by drive time (inside 15 min counts 1, 30 min 0.6, 45 min 0.3)" },
  { key: "future",  noun: "the metro pipeline",        label: "Metro coming",          q: "Does a Phase 2 metro station opening close by matter?",               of: "distance to the nearest Phase 2 station, discounted by its target year" }
];
const LEVELS = [{ v: 0, l: "Skip" }, { v: 1, l: "Low" }, { v: 2, l: "Medium" }, { v: 3, l: "High" }, { v: 5, l: "Critical" }];
const PRESETS = {
  balanced: { label: "Balanced",         note: "The sheet's price and ecosystem scores lead, then rail access; the team, talent, studios and the metro pipeline count a little.", lv: { price: 4, eco: 3, rail: 2, home: 1, talent: 1, studios: 1, future: 1 } },
  sheet:    { label: "Sheet scores only", note: "Only the revised sheet's pricing and ecosystem scores, nothing from the map.",                                          lv: { price: 3, eco: 3, rail: 0, home: 0, talent: 0, studios: 0, future: 0 } },
  team:     { label: "Keep the team",    note: "Today's people stay: the shortest move from the current office, then rail, price and nearby studios.",                  lv: { price: 2, eco: 1, rail: 2, home: 4, talent: 1, studios: 2, future: 1 } },
  rail:     { label: "Commute by rail",  note: "Staff arrive by metro, MRTS or train: an open station on foot first, a Phase 2 station next.",                          lv: { price: 2, eco: 1, rail: 4, home: 1, talent: 2, studios: 1, future: 3 } },
  hire:     { label: "Hire at scale",    note: "Grow the team fast: colleges, homes and experienced studio artists within 30 minutes.",                                 lv: { price: 1, eco: 2, rail: 2, home: 1, talent: 4, studios: 3, future: 1 } },
  cost:     { label: "Keep cost down",   note: "The best price on the sheet leads; the ecosystem and access still count.",                                              lv: { price: 4, eco: 2, rail: 1, home: 1, talent: 1, studios: 1, future: 0 } },
  future:   { label: "Built for 2030",   note: "Bet on where the metro is going and where talent is growing.",                                                        lv: { price: 1, eco: 2, rail: 2, home: 1, talent: 3, studios: 2, future: 4 } }
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
/* Road km from today's office: next door counts 1, 37 km or more counts
   almost nothing. */
const homeV = (r) => r <= 3 ? 1 : Math.max(.05, 1 - (r - 3) / 34);
/* A building added later from a broker link has no sheet scores yet, so
   its price and ecosystem count as middling until the sheet scores it. */
const priceV = (o) => isNum(o.pricingScore) ? clamp(o.pricingScore / 10) : .5;
const ecoV = (o) => isNum(o.ecoScore) ? clamp(o.ecoScore / 10) : .5;
let TALENT_MAX = 1, STUDIO_MAX = 1;
const PCACHE = new Map();
function scoreParts(o) {
  if (PCACHE.has(o.id)) return PCACHE.get(o.id);
  const p = {
    price: priceV(o),
    eco: ecoV(o),
    rail: railV(nearestOpen(o).d),
    home: homeV(homeKm(o)),
    talent: clamp(talentRaw(o) / TALENT_MAX),
    studios: clamp(studioRaw(o) / STUDIO_MAX),
    future: futureV(o)
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
/* The map opens light: the ranked buildings, today's office, faint
   micro-markets, open rail and the upcoming metro. Talent layers come on
   with the Talent tab (and go again after), drive rings with the Catchment
   camera; distance lines, rings and satellite are one click away. */
const S = {
  tab: "overview", sel: null, hov: null, pair: null, shot: "close", sort: "rank", preset: "balanced", sheet: "half",
  lv: { ...PRESETS.balanced.lv }, filters: new Set(), auto: new Set(), only: new Set(),
  layers: { existing: true, zones: true, rail: true, future: true, bus: true, links: false, studio: false, it: false, edu: false, res: false, rings: false, sat: false }
};
/* Filters: the sheet's fit groups (any of those ticked) and rail on foot. */
const FIT_FILTERS = Object.entries(FITS).map(([k, f]) => ({ key: k, label: f.label, test: o => o.fit === k })).filter(f => O.some(f.test) && cmsOn("filter:" + f.key));
const OTHER_FILTERS = [{ key: "near", label: "Rail ≤ 1 km", test: o => nearestOpen(o).d <= 1 }].filter(f => cmsOn("filter:" + f.key));
for (const k of Object.keys(S.layers)) if (!cmsOn("layer:" + k)) S.layers[k] = false;
/* S.only is the map bar's property picker: empty means every property. */
const passes = (o) => {
  const on = [...S.filters], fits = on.filter(k => FITS[k]), other = on.filter(k => !FITS[k]);
  return (S.only.size === 0 || S.only.has(o.id)) && (fits.length === 0 || fits.includes(o.fit)) && other.every(k => OTHER_FILTERS.find(f => f.key === k).test(o));
};
const byRank = (a, b) => a.n - b.n;
const RANKED = () => O.slice().sort(byRank);
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
/* Seven digits in PARTS order. Links made before the revised ranking carry
   six (rail, home, talent, studios, future, rent): their rent level becomes
   the price level and the ecosystem takes the Balanced level. */
const OLD_PARTS = ["rail", "home", "talent", "studios", "future", "price"];
function lvFrom(code) {
  if (/^[0-4]{7}$/.test(code || "")) return Object.fromEntries(PARTS.map((p, i) => [p.key, +code[i]]));
  if (/^[0-4]{6}$/.test(code || "")) return { eco: PRESETS.balanced.lv.eco, ...Object.fromEntries(OLD_PARTS.map((k, i) => [k, +code[i]])) };
  return null;
}
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
  const best = O.filter(o => o.fit === "best").length;
  $("#g-stats").innerHTML = `<span><b>${O.length}</b>buildings ranked</span>${best ? `<span><b>${best}</b>best fit</span>` : ""}<span><b>${Z.length}</b>micro-markets</span>`
    + `<span><b>${M.imagery ? new Date(M.imagery.checked).getFullYear() : ""}</b>satellite imagery</span>`;
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
   study, faded so the pins lead. Shop, POI and transit labels (bus stops
   among them) are off: the study draws its own rail. */
const MAP_STYLE = "mapbox://styles/mapbox/standard";
const BASEMAP = { lightPreset: "day", theme: "faded", showPointOfInterestLabels: false, showTransitLabels: false, showPlaceLabels: true, showRoadLabels: true, show3dObjects: true };
function initMap() {
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  const style = window.CHN_MAP_STYLE || MAP_STYLE;
  map = new mapboxgl.Map({
    container: "map", style, center: M.center, zoom: M.zoom, pitch: innerWidth > 860 ? 30 : 0,
    attributionControl: false, projection: "mercator", cooperativeGestures: false, antialias: false
  });
  if (style === MAP_STYLE) map.on("style.load", () => {
    for (const [k, v] of Object.entries(BASEMAP)) { try { map.setConfigProperty("basemap", k, v); } catch (e) {} }
    if (S.layers.sat) basemapForSat();
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
  map.on("load", () => { addLayers(); wireMap(); if (booted && S.sel) select(S.sel, true, true); else fitAll(false); spreadPins(); });
  map.on("moveend", spreadPins);
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
  tabLayers(S.tab);
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
/* Six of the buildings sit within 400 m of each other in Perungudi, so at
   city zoom their pins would stack into one. After every camera move each
   pin is drawn where it fits on screen, nudged only as far as it must be,
   with a thin leader line and a dot at its true position; today's office
   and the open option never move. Zoom in and the pins settle onto their
   buildings. 13 pins, so this costs nothing. */
const PIN_GAP = 25;
let SPREAD = new Map();
function spreadPins() {
  if (!map || !map.getSource("options")) return;
  const P = (o, fixed) => { const q = map.project([o.lng, o.lat]); return { id: o.id, x0: q.x, y0: q.y, x: q.x, y: q.y, fixed }; };
  const pts = [...O.map(o => P(o, o.id === S.sel)), ...(S.layers.existing ? [P(EX, true)] : [])];
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if (a.fixed && b.fixed) continue;
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= PIN_GAP) continue;
      if (d < .01) { const t = (i + j) * 2.39996; dx = Math.cos(t); dy = Math.sin(t); d = 1; }
      const need = PIN_GAP - d + .5, ux = dx / d, uy = dy / d;
      const ka = a.fixed ? 0 : b.fixed ? 1 : .5, kb = 1 - ka;
      a.x -= ux * need * ka; a.y -= uy * need * ka; b.x += ux * need * kb; b.y += uy * need * kb; moved = true;
    }
    if (!moved) break;
  }
  SPREAD = new Map(pts.filter(q => q.id !== EX.id && Math.hypot(q.x - q.x0, q.y - q.y0) > 1.5).map(q => [q.id, map.unproject([q.x, q.y]).toArray()]));
  refreshPins();
}
const shownAt = (o) => SPREAD.get(o.id) || [o.lng, o.lat];
const optionFC = () => FC(O.map(o => ({ ...pt(...shownAt(o), { id: o.id, n: nn(o), name: o.name, color: fitColor(o), foc: focusOf(o) }), id: o.n })));
const leaderFC = () => FC(O.filter(o => SPREAD.has(o.id)).flatMap(o => [ln([[o.lng, o.lat], shownAt(o)], { color: fitColor(o) }), pt(o.lng, o.lat, { color: fitColor(o) })]));
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
  } else if (S.sel && S.layers.links) {
    const o = O.find(x => x.id === S.sel);
    O.filter(x => x.id !== o.id).map(x => ({ x, d: km(o, x) })).sort((a, b) => a.d - b.d).slice(0, 3).forEach(({ x }) => add(o, x, "nb"));
  }
  return FC(out);
}
function exLinkFC() {
  const o = S.sel && O.find(x => x.id === S.sel);
  if (!o) return FC([]);
  return FC([ln([[o.lng, o.lat], [EX.lng, EX.lat]], { part: "line" }),
    pt((o.lng + EX.lng) / 2, (o.lat + EX.lat) / 2, { part: "label", label: `${homeTxt(o)} to the current office` })]);
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
/* One line per unbroken run of Phase 2 track, to carry the "indicative"
   label along it. */
function railPlanFC() {
  const out = [], runs = (x) => x.open || x.through;
  for (const L of LINES) {
    let cur = null;
    L.stations.forEach((s, i) => {
      const b = L.stations[i + 1], plan = b && !(runs(s) && runs(b)) && L.mode === "metro";
      if (plan) { if (!cur) { cur = [[s.lng, s.lat]]; out.push(ln(cur, { color: L.color })); } cur.push([b.lng, b.lat]); }
      else cur = null;
    });
  }
  return FC(out);
}
const stationFC = () => FC(STATIONS.map((s, i) => ({ ...pt(s.lng, s.lat, { name: s.name, line: s.lineName, color: s.color, open: s.open ? 1 : 0, target: s.target || "", key: `${s.line}:${s.name}` }), id: i + 1 })));
const COL = { edu: "#5b3aa7", res: "#0a8a3a", studio: "#d0417b", it: "#4a5a6a", hub: "#4a4a4a" };
const placesFC = () => FC(PL.map(p => pt(p.lng, p.lat, { id: p.id, kind: p.kind, name: p.name, color: COL[p.kind] || "#4a4a4a" })));

function add(layer, before) { try { map.addLayer(layer, before); } catch (e) { console.warn("layer", layer.id, e.message); } }
function addLayers() {
  /* Satellite: the newest Esri World Imagery, drawn under the roads and
     labels (Mapbox Standard's bottom slot) and under everything of ours.
     Tiles load only while the layer is on. */
  map.addSource("sat", { type: "raster", tiles: [`${ESRI}/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution: esc(IMG.credit || "Esri World Imagery") });
  const standard = (window.CHN_MAP_STYLE || MAP_STYLE) === MAP_STYLE;
  add({ id: "sat", type: "raster", source: "sat", ...(standard ? { slot: "bottom" } : {}), layout: { visibility: "none" }, paint: { "raster-fade-duration": 120 } });

  /* zones */
  map.addSource("zones", { type: "geojson", data: FC(Z.map(z => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [zonePolygon(z)] }, properties: { key: z.key, color: z.color } }))) });
  map.addSource("zone-labels", { type: "geojson", data: FC(Z.map(z => pt(...zoneCentre(z), { label: z.label.toUpperCase() }))) });
  /* Kept faint: the micro-markets are context, the pins are the subject. */
  add({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": ["get", "color"], "fill-opacity": .05 } });
  add({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": ["get", "color"], "line-width": 1, "line-dasharray": [2, 2], "line-opacity": .4 } });
  add({ id: "zones-label", type: "symbol", source: "zone-labels", layout: { "text-field": ["get", "label"], "text-size": 11, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-letter-spacing": .18, "text-max-width": 12 },
    paint: { "text-color": "#6c5b4d", "text-opacity": .45, "text-halo-color": "#fff", "text-halo-width": 1.2 } });

  /* drive rings */
  map.addSource("rings", { type: "geojson", data: ringFC() });
  map.addSource("ring-labels", { type: "geojson", data: ringLabelFC() });
  add({ id: "rings-fill", type: "fill", source: "rings", paint: { "fill-color": ["get", "color"], "fill-opacity": .05 } });
  add({ id: "rings-line", type: "line", source: "rings", paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": .8 } });
  add({ id: "rings-label", type: "symbol", source: "ring-labels", layout: { "text-field": ["get", "label"], "text-size": 11, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, -.6] },
    paint: { "text-color": "#a3502c", "text-halo-color": "#fff", "text-halo-width": 1.4 } });

  /* Rail: open sections solid, the upcoming Phase 2 metro dashed, each in
     its line colour. Upcoming stations carry an M so they read as metro,
     and the line is labelled indicative: routes and station positions are
     from CMRL's plans, not surveyed. The basemap's own transit and bus stop
     labels are off, so these are the only stops on the map. */
  map.addSource("rail", { type: "geojson", data: railFC() });
  map.addSource("rail-plan-lbl", { type: "geojson", data: railPlanFC() });
  add({ id: "rail-plan", type: "line", source: "rail", filter: ["==", ["get", "open"], 0], layout: { "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 14, 3.5], "line-dasharray": [1.2, 1.4], "line-opacity": .8 } });
  add({ id: "rail-casing", type: "line", source: "rail", filter: ["==", ["get", "open"], 1], layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#fff", "line-width": 5, "line-opacity": .7 } });
  add({ id: "rail-open", type: "line", source: "rail", filter: ["==", ["get", "open"], 1], layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": .8 } });
  add({ id: "rail-plan-label", type: "symbol", source: "rail-plan-lbl", minzoom: 10.5, layout: { "symbol-placement": "line", "symbol-spacing": 420,
    "text-field": "Upcoming metro · indicative", "text-size": 10.5, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-letter-spacing": .04, "text-offset": [0, -.9] },
    paint: { "text-color": ["get", "color"], "text-halo-color": "#fff", "text-halo-width": 1.6 } });
  const stData = stationFC();
  map.addSource("stations", { type: "geojson", data: stData });
  add({ id: "st-plan", type: "circle", source: "stations", filter: ["==", ["get", "open"], 0], paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 12, 5, 15, 8], "circle-color": "#fff",
    "circle-stroke-color": ["get", "color"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 12, 1.8] } });
  add({ id: "st-plan-m", type: "symbol", source: "stations", minzoom: 11.6, filter: ["==", ["get", "open"], 0], layout: { "text-field": "M",
    "text-size": ["interpolate", ["linear"], ["zoom"], 11.6, 7, 15, 11], "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": ["get", "color"] } });
  add({ id: "st-open", type: "circle", source: "stations", filter: ["==", ["get", "open"], 1], paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 14, 5], "circle-color": "#fff",
    "circle-stroke-color": ["get", "color"], "circle-stroke-width": 1.8, "circle-opacity": .9 } });
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

  /* MTC bus stops: from street-level zoom only, so the city view stays clean */
  map.addSource("bus", { type: "geojson", data: FC(BUS.map(b => pt(b.lng, b.lat, { id: b.id, name: b.name, routes: b.routes }))) });
  add({ id: "bus-stop", type: "circle", source: "bus", minzoom: 12, paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.4, 15, 5.5], "circle-color": "#1d6fa5",
    "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } });
  add({ id: "bus-label", type: "symbol", source: "bus", minzoom: 14.2, layout: { "text-field": ["get", "name"], "text-size": 10,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [0, .9], "text-anchor": "top", "text-optional": true, "text-max-width": 8 },
    paint: { "text-color": "#1d4f73", "text-halo-color": "#fff", "text-halo-width": 1.3 } });

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

  /* leaders from a nudged pin back to its building */
  map.addSource("pin-leaders", { type: "geojson", data: leaderFC() });
  add({ id: "pin-leader", type: "line", source: "pin-leaders", filter: ["==", ["geometry-type"], "LineString"],
    paint: { "line-color": ["get", "color"], "line-width": 1.2, "line-opacity": .7 } });
  add({ id: "pin-true", type: "circle", source: "pin-leaders", filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 2.6, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });

  /* options: every pin stays readable; the open one is larger with a halo */
  map.addSource("options", { type: "geojson", data: optionFC() });
  const foc = ["get", "foc"], col = ["get", "color"];
  add({ id: "opt-halo", type: "circle", source: "options", filter: ["==", foc, 2], paint: {
    "circle-radius": 24, "circle-color": col, "circle-opacity": .18, "circle-stroke-color": col, "circle-stroke-width": 2, "circle-stroke-opacity": .75, "circle-pitch-alignment": "map" } });
  add({ id: "opt", type: "circle", source: "options", paint: {
    "circle-radius": ["case", ["==", foc, 2], 14, ["==", foc, 1], 11, ["==", foc, .5], 10, 8], "circle-color": col,
    "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["==", foc, 2], 3, 2],
    "circle-opacity": ["case", ["==", foc, 0], .25, ["==", foc, .5], .85, 1],
    "circle-stroke-opacity": ["case", ["==", foc, 0], .3, 1] } });
  map.addSource("options-lbl", { type: "geojson", data: optionFC() });
  add({ id: "opt-num", type: "symbol", source: "options-lbl", layout: { "text-field": ["get", "n"], "text-size": ["case", ["==", foc, 2], 12.5, ["==", foc, 0], 9, 10.5],
    "text-allow-overlap": true, "text-ignore-placement": true, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] },
    paint: { "text-color": "#fff", "text-opacity": ["case", ["==", foc, 0], .4, 1] } });
  add({ id: "opt-name", type: "symbol", source: "options-lbl", minzoom: 12, filter: ["!=", foc, 2], layout: { "text-field": ["get", "name"], "text-size": 12,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-offset": [1.2, 0], "text-anchor": "left", "text-optional": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 1.6, "text-opacity": ["case", ["==", foc, 0], .35, 1] } });
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
  { key: "future", label: "Upcoming metro (indicative)", sw: `<span class="sw" style="background:repeating-linear-gradient(90deg,#800080 0 3px,transparent 3px 5px,#FF0000 5px 8px,transparent 8px 10px,#e0b800 10px 13px,transparent 13px 15px)"></span>`, ids: ["rail-plan", "rail-plan-label", "st-plan", "st-plan-m"] },
  { key: "bus", label: "Bus stops", sw: `<span class="dot" style="background:#1d6fa5;box-shadow:inset 0 0 0 1.5px #fff,0 0 0 1px #1d6fa5"></span>`, ids: ["bus-stop", "bus-label"] },
  { key: "links", label: "Distances", sw: `<span class="sw" style="background:repeating-linear-gradient(90deg,#6c5b4d 0 3px,transparent 3px 6px)"></span>`, ids: ["links", "links-label"] },
  { key: "studio", label: "VFX studios", sw: `<span class="dot" style="background:${COL.studio}"></span>` },
  { key: "it", label: "IT parks", sw: `<span class="dot" style="background:${COL.it}"></span>` },
  { key: "edu", label: "Institutes", sw: `<span class="dot" style="background:${COL.edu}"></span>` },
  { key: "res", label: "Homes", sw: `<span class="dot" style="background:rgba(10,138,58,.22);border:1.5px solid #0a8a3a"></span>` },
  { key: "rings", label: "Drive rings", sw: `<span class="dot" style="background:transparent;border:1.5px solid #a3502c"></span>`, ids: ["rings-fill", "rings-line", "rings-label"] },
  { key: "sat", label: "Satellite", sw: `<span class="dot" style="background:linear-gradient(135deg,#5b6b4a,#a39a7a 55%,#3f4f5f)"></span>`, ids: ["sat"] }
];
const LAYER_HINT = {
  bus: `MTC bus stops near the list, with how many routes call there (${BUSD.credit || "MTC timetable"}). They show once you zoom in to street level.`,
  sat: `The newest satellite imagery under the map: ${M.imagery ? `${M.imagery.name}, ${M.imagery.detail}, captured Feb to Mar 2026` : "Esri World Imagery"}. Turns off the 3D buildings so the roofs show.`,
  existing: "The current office at KRC Commerzone, Porur, with a dashed line and the distance to the open option.",
  zones: "The six micro-markets the shortlist sits in. Outlines are indicative.",
  rail: "Metro, MRTS and suburban rail that run today, in each line's own colour.",
  future: "Chennai Metro Phase 2, under construction: dashed lines with M stations. Routes and station positions are indicative, from CMRL's plans.",
  links: "Lines to the three nearest options from the open one. A pair picked on the distance matrix is always drawn.",
  studio: "VFX, animation and post studios: the experienced talent already working in the city.",
  it: "Large IT parks that hire from the same technical pool.",
  edu: "Institutes that train artists and graduates: the fresher pipeline.",
  res: "Residential belts where staff are likely to live.",
  rings: "15, 30 and 45 minute drive rings around the open option. The Catchment camera turns them on."
};
/* With satellite on, Standard's 3D buildings and trees would hide the
   roofs, so they go while it is on. */
function basemapForSat() {
  if (!map || (window.CHN_MAP_STYLE || MAP_STYLE) !== MAP_STYLE) return;
  try { map.setConfigProperty("basemap", "show3dObjects", !S.layers.sat); } catch (e) {}
}
function applyLayerVisibility() {
  if (!map || !map.getLayer("opt")) return;
  for (const l of LAYERS) for (const id of l.ids || []) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", S.layers[l.key] ? "visible" : "none");
  if (applyLayerVisibility.sat !== S.layers.sat) { applyLayerVisibility.sat = S.layers.sat; basemapForSat(); }
  /* a pair picked on the distance matrix is always drawn */
  if (S.pair) for (const id of ["links", "links-label"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
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
    set("zones-fill", "fill-opacity", .05); set("zones-label", "text-opacity", .45);
    return;
  }
  const nearSt = STATIONS.filter(s => km(o, s) <= 2).map(s => `${s.line}:${s.name}`);
  const nearPl = PL.filter(p => km(o, p) <= ringKm(30)).map(p => p.id);
  const inSt = ["in", ["get", "key"], ["literal", nearSt]], inPl = ["in", ["get", "id"], ["literal", nearPl]];
  set("st-open", "circle-opacity", ["case", inSt, 1, .4]); set("st-open", "circle-stroke-opacity", ["case", inSt, 1, .4]);
  set("st-label", "text-opacity", ["case", inSt, 1, .3]);
  set("places", "circle-opacity", ["case", inPl, ["case", ["==", ["get", "kind"], "res"], .25, .9], .15]);
  set("places", "circle-stroke-opacity", ["case", inPl, 1, .25]); set("places-label", "text-opacity", ["case", inPl, 1, .25]);
  set("zones-fill", "fill-opacity", .03); set("zones-label", "text-opacity", .25);
}
/* The halo around the open option is static: a pulsing halo repainted the
   whole 3D map every frame, which is what made the study feel heavy. */
function refreshPins() {
  if (!map || !map.getSource("options")) return;
  const fc = optionFC();
  map.getSource("options").setData(fc);
  if (map.getSource("options-lbl")) map.getSource("options-lbl").setData(fc);
  if (map.getSource("pin-leaders")) map.getSource("pin-leaders").setData(leaderFC());
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
  hover("opt", p => { const o = O.find(x => x.id === p.id), r = nearestOpen(o), f = fitOf(o);
    return `<div class="pop">${tile(o, "pop")}<div><b>${nn(o)} · ${esc(o.name)}</b><br>${f ? `${esc(f.label)} · ` : ""}${esc(o.sheetMicro)}<br>${esc(homeTxt(o))}<br>${fmtM(r.d)} to ${esc(r.s.name)} (${esc(r.s.lineName)})${(b => b ? `<br>${fmtM(b.d)} to ${esc(b.s.name)} bus stop` : "")(nearestBus(o))}</div></div>`; });
  hover("places", p => { const x = PL.find(y => y.id === p.id);
    const kind = { edu: "Institute", res: "Residential belt", studio: "VFX / post studio", it: "IT park", hub: "Transport" }[x.kind];
    return `<b>${esc(x.name)}</b>${x.sub ? `<br>${esc(x.sub)}` : ""}<br><span style="color:#6c5b4d">${kind}</span><br>${esc(x.note)}`; });
  hover("bus-stop", p => `<b>${esc(p.name)}</b><br>Bus stop · ${esc(routesTxt(+p.routes))}`);
  hover("st-open", p => `<b>${esc(p.name)}</b><br>${esc(p.line)} · open`);
  hover("st-plan", p => `<b>${esc(p.name)}</b> <span style="color:#6c5b4d">upcoming metro</span><br>${esc(p.line)} · not open yet${p.target ? `<br>${esc(p.target)}` : ""}<br><span style="color:#6c5b4d">Position indicative</span>`);
  hover("ex-pin", () => { const r = nearestOpen(EX), o = S.sel && O.find(x => x.id === S.sel);
    return `<b>${esc(EX.name)}</b><br>Current office · ${esc(EX.locality)}<br>Nearest open rail: ${esc(r.s.name)}, ${fmtM(r.d)}${o ? `<br>${fmtKm(exKm(o))} from ${esc(o.name)}` : ""}`; });
  map.on("click", "opt", e => select(e.features[0].properties.id, true));
  map.on("mousemove", "opt", e => { const id = e.features[0].properties.id; if (id !== S.sel && S.hov !== id) { S.hov = id; refreshPins(); } });
  map.on("mouseleave", "opt", () => { if (S.hov) { S.hov = null; refreshPins(); } });
}

/* ============================================================ board ===== */
/* Satellite crops come from Esri World Imagery: Vantor WorldView-3 at 30 cm,
   captured in Feb and Mar 2026 over every pin on the list, years newer than
   the Mapbox satellite layer used before. The export endpoint cuts one JPEG
   at the pin, sized for the screen, and needs no key. A crop is cut only
   where the building itself is pinned; anything less exact gets its fit
   colour and number, so the picture never shows the wrong building. */
const IMG = M.imagery || {};
const ESRI = "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer";
const DPR = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
const merc = (lng, lat) => [lng * 20037508.342789244 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137];
/* z is a Mapbox zoom (512 px tiles), so a crop frames the building as the
   map does at that zoom. */
function satUrl(o, w, h, z) {
  if (o.precision !== "building") return "";
  const [x, y] = merc(o.lng, o.lat), r = 78271.51696402048 / 2 ** z, hw = w / 2 * r, hh = h / 2 * r;
  return `${ESRI}/export?bbox=${(x - hw).toFixed(1)},${(y - hh).toFixed(1)},${(x + hw).toFixed(1)},${(y + hh).toFixed(1)}&bboxSR=3857&imageSR=3857&size=${w * DPR},${h * DPR}&format=jpg&f=image`;
}
/* The capture date shipped in data.js was read on the date in M.imagery;
   when an option opens, the live service is asked again, so the label stays
   true if Esri publishes a newer capture. */
const IMG_LIVE = new Map();
const imgDate = (o) => IMG_LIVE.get(o.id) || o.img || "";
function checkImgDate(o) {
  if (IMG_LIVE.has(o.id) || !window.fetch || o.precision !== "building") return;
  IMG_LIVE.set(o.id, null);
  const d = .002, q = `geometry=${o.lng},${o.lat}&geometryType=esriGeometryPoint&sr=4326&layers=all:0&tolerance=1&mapExtent=${o.lng - d},${o.lat - d},${o.lng + d},${o.lat + d}&imageDisplay=200,200,96&returnGeometry=false&f=json`;
  fetch(`${ESRI}/identify?${q}`).then(r => r.json()).then(j => {
    const a = (j && j.results && j.results[0] && j.results[0].attributes) || {};
    const v = Object.entries(a).map(([k, x]) => /DATE/i.test(k) && String(x).match(/^(20\d\d)(\d\d)(\d\d)$/)).find(Boolean);
    if (!v) return;
    IMG_LIVE.set(o.id, `${v[1]}-${v[2]}-${v[3]}`);
    const el = document.querySelector(`[data-img-date="${o.id}"]`); if (el) el.textContent = fmtDate(imgDate(o));
  }).catch(() => {});
}
/* The list is rebuilt on every click, so each thumbnail is one <img> made
   once and moved into the new card: it downloads once per visit. */
const TILE_IMG = new Map();
function tileImg(o) {
  if (TILE_IMG.has(o.id)) return TILE_IMG.get(o.id);
  const u = satUrl(o, 124, 112, 16.2);
  let im = null;
  if (u) {
    im = new Image(); im.alt = ""; im.decoding = "async"; im.loading = "lazy";
    im.onerror = () => { im.remove(); TILE_IMG.set(o.id, null); };
    im.src = u;
  }
  TILE_IMG.set(o.id, im);
  return im;
}
function mountTiles(root) {
  root.querySelectorAll("[data-tile]").forEach(t => { const o = O.find(x => x.id === t.dataset.tile), im = o && tileImg(o); if (im) t.prepend(im); });
}
function tile(o, kind) {
  return `<span class="tile" style="--z:${fitColor(o)}" aria-hidden="true"${kind !== "pop" ? ` data-tile="${o.id}"` : ""}><span>${nn(o)}</span></span>`;
}
function renderFilters() {
  const all = [...FIT_FILTERS, ...OTHER_FILTERS];
  $("#filters").innerHTML = all.map(f => `<button class="chip ${S.filters.has(f.key) ? "on" : ""}" data-f="${f.key}" type="button" aria-pressed="${S.filters.has(f.key)}" data-hint="${esc(FITS[f.key] ? `Keep only the ${FITS[f.key].label} group on the revised ranking.` : "Keep only options within 1 km of an open metro, MRTS or suburban station.")}">${FITS[f.key] ? `<span class="dot" style="background:${FITS[f.key].color};margin:0"></span>` : ""}${esc(f.label)}</button>`).join("");
}
function sorted() {
  const by = {
    rank: byRank,
    score: byFit,
    price: (a, b) => priceV(b) - priceV(a) || a.n - b.n,
    home: (a, b) => homeKm(a) - homeKm(b) || a.n - b.n,
    rail: (a, b) => nearestOpen(a).d - nearestOpen(b).d,
    talent: (a, b) => (talentRaw(b) + studioRaw(b)) - (talentRaw(a) + studioRaw(a)) || a.n - b.n
  }[S.sort] || byRank;
  return O.slice().sort(by);
}
function renderList() {
  const shown = O.filter(passes);
  $("#b-count").textContent = `${shown.length} of ${O.length} options`;
  $("#b-sub").textContent = S.sort === "score" ? presetName() : S.sort === "rank" ? "Revised ranking" : "";
  $("#list").innerHTML = sorted().map(o => {
    const r = nearestOpen(o);
    return `<button class="card ${S.sel === o.id ? "sel" : ""} ${passes(o) ? "" : "dim"}" data-id="${o.id}" role="listitem" type="button" data-hint="${esc(o.reason || `Open ${o.name}: the map flies in and draws the line to the current office.`)}">
      ${tile(o)}
      <div>
        <div class="nm"><span class="no">${nn(o)}</span>${esc(o.name)}</div>
        <div class="loc">${fitBadge(o)} ${esc(o.sheetMicro)}</div>
        <div class="facts"><span title="From the current office by road">${isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o))} · ${esc(homeMin(o))}</span><span title="Nearest open rail station">${fmtM(r.d)} to rail</span>${(b => b ? `<span title="Nearest MTC bus stop: ${esc(b.s.name)}">${fmtM(b.d)} to bus</span>` : "")(nearestBus(o))}${flagChip(o)}</div>
      </div>
      <span class="score" title="Fit to your priorities, out of 100">${score(o)}</span>
    </button>`;
  }).join("");
  mountTiles($("#list"));
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
    const pb = e.target.closest("[data-pop]"); if (pb) { openPop(pb, pb.dataset.pop); renderLayers(); return; }
    const b = e.target.closest("[data-l]"); if (!b) return;
    S.auto.delete(b.dataset.l);
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
  addEventListener("keydown", e => { if (e.key === "Escape") { closePop(); $("#cmp").classList.remove("on"); $("#lightbox").classList.remove("on"); } });
  document.addEventListener("pointerdown", e => { if (POP && !POP.contains(e.target) && !e.target.closest("[data-pop]")) closePop(); });
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
    if (!S.layers.rings && cmsOn("layer:rings")) { S.layers.rings = true; renderLayers(); applyLayerVisibility(); }
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
/* Layers a tab needs come on with it and go when you leave, unless you
   switched them yourself; every other view keeps the map light. */
const TAB_LAYERS = { talent: ["studio", "edu", "res"] };
function tabLayers(key) {
  for (const k of S.auto) S.layers[k] = false;
  S.auto.clear();
  for (const k of TAB_LAYERS[key] || []) if (!S.layers[k] && cmsOn("layer:" + k)) { S.layers[k] = true; S.auto.add(k); }
  if (booted) renderLayers();
}
function goTab(key) {
  if (document.body.classList.contains("fold-panel")) setFold("panel", false);
  const had = S.sel || S.pair; S.tab = key; S.sel = null; S.pair = null;
  if (CMS) CMS.tab(key);
  tabLayers(key);
  renderTabs(); renderList(); renderPanel(); refreshMap(); if (had) fitAll(); pushRoute();
  if (innerWidth <= 860) setSheet("half");
  $("#p-body").scrollTop = 0;
}
function renderTabs() {
  $("#tabs").innerHTML = TABS.map(t => `<button class="tab ${S.tab === t.key && !S.sel ? "on" : ""}" data-t="${t.key}" type="button" data-hint="${esc(GUIDE[t.key] ? GUIDE[t.key].hint : "")}">${esc(t.label)}</button>`).join("");
}
/* The map bar: a property picker first, then the layers. Place layers
   carry an i button that lists exactly which places they are. */
const INFO = { studio: "VFX studios", it: "IT parks", edu: "Institutes", res: "Residential belts" };
function renderLayers() {
  const n = S.only.size;
  const props = `<button class="chip lay props ${n ? "on" : ""}" type="button" data-pop="props" aria-haspopup="dialog" aria-expanded="${POP && POP.dataset.for === "props"}" data-hint="Choose which properties show on the map and in the list.">`
    + `<span class="dot" style="background:conic-gradient(${FITS.best.color} 0 33%,${FITS.value.color} 0 66%,${FITS.conditional.color} 0)"></span>${n ? `${n} of ${O.length} properties` : "All properties"} ▾</button>`;
  $("#layers").innerHTML = props + LAYERS.filter(l => cmsOn("layer:" + l.key)).map(l => {
    const chip = `<button class="chip lay ${S.layers[l.key] ? "on" : ""}" data-l="${l.key}" type="button" aria-pressed="${S.layers[l.key]}" data-hint="${esc((S.layers[l.key] ? "Hide: " : "Show: ") + LAYER_HINT[l.key])}">${l.sw}${esc(l.label)}</button>`;
    return INFO[l.key] ? `<span class="lg">${chip}<button class="ib" type="button" data-pop="info:${l.key}" aria-haspopup="dialog" aria-label="Which ${esc(INFO[l.key].toLowerCase())} are these?" data-hint="Which ${esc(INFO[l.key].toLowerCase())} are these?">i</button></span>` : chip;
  }).join("") + `<span class="key note" title="Rail lines are drawn station to station; zone outlines and upcoming metro are indicative">ⓘ schematic</span>`;
}

/* ---------------------------------------------- map bar pop-overs ------ */
let POP = null;
function closePop() { if (POP) { POP.remove(); POP = null; } }
function openPop(btn, key) {
  const again = POP && POP.dataset.for === key;
  closePop(); if (again) return;
  const el = document.createElement("div");
  el.className = "lpop"; el.setAttribute("role", "dialog"); el.dataset.for = key;
  document.body.appendChild(el); POP = el;
  fillPop();
  el.addEventListener("click", popClick); el.addEventListener("change", popClick);
  const r = btn.getBoundingClientRect(), w = Math.min(340, innerWidth - 16);
  el.style.width = w + "px";
  el.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
  if (r.top < innerHeight / 2) { el.style.top = (r.bottom + 6) + "px"; el.style.maxHeight = (innerHeight - r.bottom - 18) + "px"; }
  else { el.style.bottom = (innerHeight - r.top + 6) + "px"; el.style.maxHeight = (r.top - 18) + "px"; }
  const first = el.querySelector("button,input"); if (first) first.focus({ preventScroll: true });
}
function fillPop() {
  if (!POP) return;
  const key = POP.dataset.for, all = S.only.size === 0;
  if (key === "props") {
    const groups = Object.entries(FITS).map(([k, f]) => ({ k, f, os: RANKED().filter(o => o.fit === k) })).filter(g => g.os.length);
    const rest = RANKED().filter(o => !fitOf(o));
    const row = (o) => `<label class="pi"><input type="checkbox" data-only-id="${o.id}" ${all || S.only.has(o.id) ? "checked" : ""}><span class="no">${nn(o)}</span>${esc(o.name)}<span class="note">${esc(o.sheetMicro)}</span></label>`;
    POP.innerHTML = `<div class="lph"><b>Properties</b><button type="button" class="act ${all ? "pri" : ""}" data-only="all">All properties</button><button type="button" class="x" data-pop-x aria-label="Close">×</button></div>
      ${groups.map(g => `<div class="pg"><button type="button" class="pgh" data-only-fit="${g.k}" data-hint="Show only the ${esc(g.f.label)} group"><span class="dot" style="background:${g.f.color}"></span>${esc(g.f.label)} <span class="note">only</span></button>${g.os.map(row).join("")}</div>`).join("")}
      ${rest.length ? `<div class="pg"><div class="pgh">Added since the sheet</div>${rest.map(row).join("")}</div>` : ""}`;
    return;
  }
  const kind = key.split(":")[1], list = PL.filter(p => p.kind === kind);
  const near = (p) => { const n = nearest(p, O); return n ? `${fmtKm(n.d)} from ${n.s.name}` : ""; };
  POP.innerHTML = `<div class="lph"><b>${esc(INFO[kind])} on the map <span class="note">(${list.length})</span></b><button type="button" class="act ${S.layers[kind] ? "pri" : ""}" data-show="${kind}">${S.layers[kind] ? "Showing" : "Show on map"}</button><button type="button" class="x" data-pop-x aria-label="Close">×</button></div>
    <ol class="plist">${list.map(p => `<li><a href="#" class="pl" data-fly="${p.lng},${p.lat}" data-show-kind="${kind}"><b>${esc(p.name)}</b></a>${p.sub ? ` <span class="note">· ${esc(p.sub)}</span>` : ""}
      <div class="note">${esc(p.note)}${p.size ? ` · ${esc(p.size)}` : ""}</div><div class="src">Nearest on the list: ${esc(near(p))}${p.src ? ` · ${cite(p.src)}` : ""}</div></li>`).join("")}</ol>
    <p class="note" style="margin:8px 0 0">Positions of some ${esc(INFO[kind].toLowerCase())} are approximate. Click a name to fly there.</p>`;
}
function popClick(e) {
  if (e.type === "click" && e.target.closest("[data-pop-x]")) { closePop(); return; }
  const id = e.target.closest("[data-only-id]");
  if (id && e.type === "change") {
    const cur = S.only.size ? new Set(S.only) : new Set(O.map(o => o.id));
    id.checked ? cur.add(id.dataset.onlyId) : cur.delete(id.dataset.onlyId);
    if (!cur.size) { id.checked = true; return; }
    S.only = cur.size === O.length ? new Set() : cur; afterOnly(); return;
  }
  if (e.type !== "click") return;
  if (e.target.closest("[data-only]")) { S.only = new Set(); afterOnly(); return; }
  const g = e.target.closest("[data-only-fit]"); if (g) { S.only = new Set(O.filter(o => o.fit === g.dataset.onlyFit).map(o => o.id)); afterOnly(); return; }
  const sh = e.target.closest("[data-show]"); if (sh) { const k = sh.dataset.show; S.auto.delete(k); S.layers[k] = true; renderLayers(); applyLayerVisibility(); fillPop(); return; }
  const fl = e.target.closest("[data-fly]");
  if (fl) {
    e.preventDefault();
    const k = fl.dataset.showKind; if (!S.layers[k]) { S.auto.delete(k); S.layers[k] = true; renderLayers(); applyLayerVisibility(); fillPop(); }
    const [lng, lat] = fl.dataset.fly.split(",").map(Number);
    if (map) map.flyTo({ center: [lng, lat], zoom: 14.2, pitch: innerWidth > 860 ? 30 : 0, padding: padding(), duration: REDUCED() ? 0 : 1200, essential: true });
  }
}
function afterOnly() {
  if (S.sel && !passes(O.find(o => o.id === S.sel))) { S.sel = null; renderPanel(); pushRoute(); }
  renderLayers(); renderList(); refreshMap(); fillPop(); fitAll();
}

/* ============================================================ guide =====
   "What to expect" cards at the top of each view, and hover hints on
   anything clickable. Dismissed cards fold to a one-line link and the
   choice is remembered on this device. */
const GUIDE = {
  overview: { hint: "The short answer: the revised ranking in its three fit groups, and what stands out.",
    items: ["The revised ranking is the client's sheet: rank, fit group, pricing and ecosystem scores and the reason for each rank.",
      "Each insight card answers one question a client asks first. Click it to open that option.",
      "Your priorities re-ranks the same buildings with the sheet's scores and the map's measures."] },
  markets: { hint: "The micro-markets: rent, vacancy, who is there, pros and cons.",
    items: ["One card per micro-market, with the options that sit in it.",
      "Rents and vacancy are quoted from the source named under each figure, with its date."] },
  connect: { hint: "How people get to each option: rail and bus today, and the metro once Phase 2 opens.",
    items: ["The nearest open metro, MRTS or suburban station for every option, and how you get from it.",
      "The nearest Phase 2 metro station under construction, with its reported target.",
      "Rail open and Upcoming metro in the map bar show the lines; upcoming routes and stations are indicative."] },
  distance: { hint: "How far every option is from every other option and from the current office.",
    items: ["The matrix is ordered by micro-market, so clusters show as dark blocks.",
      "Click any cell: the map draws that pair and its distance.",
      "The bars below show how far each option moves the team from today's office."] },
  talent: { hint: "Where artists train, where they live and where experienced ones already work.",
    items: ["For each option: institutes and residential belts inside 30 minutes (the talent pool), and VFX studios inside 30 minutes (the existing pool).",
      "Studios, institutes and homes show on the map while this tab is open; IT parks are in the map bar."] },
  priorities: { hint: "Tell us what matters most; the ranking follows.",
    items: ["Answer seven questions from Skip to Critical, or start from a preset. Price and ecosystem are the revised sheet's scores.",
      "The top three, the list on the left, the pins and the Conclusion all re-rank as you go.",
      "Copy link keeps your answers, so the client can open the same ranking."] },
  conclusion: { hint: "The answer on your priorities, how it compares with the revised ranking, and what to check next.",
    items: ["The lead option on your current priorities, and whether the revised ranking agrees.",
      "How often each option makes the top three across every preset, so you can see which choices hold up.",
      "The next steps for site visits."] },
  compare: { hint: "Every option side by side, with the seven questions to re-weight." },
  option: { items: ["The map flies to the building and draws the line to the current office. Distances in the map bar adds its three nearest options.",
      "The picture is the newest satellite capture, with its date. Turn on Satellite in the map bar to see it on the map.",
      "Below: the sheet's figures, rail today and next, talent within reach and the fit score part by part.",
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

/* ---------- Overview ---------- */
/* The revised ranking, one table per fit group. */
function rankingHTML(list) {
  const groups = Object.entries(FITS).map(([k, f]) => ({ f, os: list.filter(o => o.fit === k) })).filter(g => g.os.length);
  const rest = list.filter(o => !fitOf(o));
  if (rest.length) groups.push({ f: { label: "Added since the sheet", color: "#9a8878", bg: "rgba(60,40,25,.07)" }, os: rest });
  return groups.map(({ f, os }) => `<div class="fg"><div class="fgh"><span class="fitb" style="--f:${f.color};--fb:${f.bg}">${esc(f.label)}</span><span class="note">${os.length} option${os.length === 1 ? "" : "s"}</span></div>
    <table class="rt"><thead><tr><th>Building</th><th class="num">From office</th><th class="num" title="Pricing and ecosystem scores out of 10">Price · eco</th></tr></thead>
    <tbody>${os.map(o => `<tr><td><span class="mono no">${nn(o)}</span> ${optLinkLight(o)} ${flagChip(o)}<br><span class="note">${esc(o.sheetMicro)}</span>${o.reason ? `<div class="why">${esc(o.reason)}</div>` : ""}</td>
      <td class="num">${isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o))}<br><span class="note">${esc(homeMin(o))}</span></td>
      <td class="num">${isNum(o.pricingScore) ? `${o.pricingScore} · ${o.ecoScore}` : "-"}</td></tr>`).join("")}</tbody></table></div>`).join("");
}
function renderOverview() {
  const counts = Object.entries(FITS).map(([k, f]) => [f.label, O.filter(o => o.fit === k).length]).filter(x => x[1]);
  head("Autopilot · Chennai · Oct 2026", "Where the next Chennai office should go",
    `The revised ranking: ${O.length} buildings in ${counts.map(([l, n]) => `${n} ${l.toLowerCase()}`).join(", ")}, read against rail, talent and today's office at ${esc(EX.name)}, ${esc(EX.locality)}.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act pri" data-tab="priorities">Set your priorities</button>`));
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">What stands out</h3>
    ${insightsHTML()}
    <h3>The revised ranking</h3>
    ${rankingHTML(RANKED())}
    <p class="note">Distance and drive time from today's office are by road, as given on the client's sheet. Price · eco are the sheet's pricing and ecosystem scores out of 10. <a href="#" data-tab="priorities">Your priorities</a> re-ranks the same buildings with the map's measures as well.</p>`;
}
function insightsHTML() {
  const top = (f, list = O) => list.slice().sort((a, b) => f(b) - f(a) || a.n - b.n)[0];
  const first = RANKED()[0], best = top(exact), home = top(o => -homeKm(o)), rail = top(o => -nearestOpen(o).d);
  const fut = top(o => futureV(o)), fN = nearestPlan(fut);
  const stu = top(o => upTo(catchOf(o), 1, "studio") + studioRaw(o) / 1000), sc = catchOf(stu), rr = nearestOpen(rail);
  const cards = [
    { l: "Ranked first", v: first.name, s: `${fitOf(first) ? fitOf(first).label + " · " : ""}${first.sheetMicro}`, go: first.id, tone: "lead" },
    { l: "Best on your priorities", v: best.name, s: `${score(best)}/100 on ${presetName().toLowerCase()}${levelWith(best).length ? `, level with ${levelWith(best)[0].name}` : ""}`, go: best.id },
    { l: "Closest to today's office", v: isNum(home.roadKm) ? `~${home.roadKm} km` : fmtKm(homeKm(home)), s: `${home.name}, ${homeMin(home)} by road`, go: home.id },
    { l: "Closest to open rail", v: fmtM(rr.d), s: `${rail.name}, to ${rr.s.name} (${rr.s.lineName})`, go: rail.id },
    fN && { l: "Closest upcoming metro", v: fmtM(fN.d), s: `${fut.name}, to ${fN.s.name}${fN.s.target ? ` (${fN.s.target})` : ""}`, go: fut.id },
    { l: "Most studios nearby", v: stu.name, s: `${upTo(sc, 1, "studio")} VFX and post studios in 30 min, ${upTo(sc, 2, "studio")} in 45`, go: stu.id }
  ].filter(Boolean);
  return `<div class="ins" role="list">${cards.map(c => `<button type="button" role="listitem" class="in ${c.tone || ""}" data-go="${c.go}" data-hint="Open this option: the map flies in and its details open.">
    <span class="l">${esc(c.l)}</span><span class="v">${esc(c.v)}</span><span class="s">${esc(c.s)}</span></button>`).join("")}</div>`;
}
function verdictHTML(o, p) {
  const parts = PARTS.filter(x => x.key !== "studios" || hasStudios(o));
  const good = parts.filter(x => p[x.key] >= .8).map(x => x.label);
  const weak = parts.filter(x => p[x.key] <= .3).map(x => x.label);
  return `<div class="verdict">${good.map(g => `<span class="vd up">✓ ${esc(g)}</span>`).join("")}${weak.map(w => `<span class="vd dn">! ${esc(w)}</span>`).join("")}</div>`;
}

/* ---------- Micro-markets ---------- */
const figure = (f) => f && f.v ? `<span>${esc(f.v)}${f.conf === "low" ? `<span class="conf low">low</span>` : ""}<span class="src" style="display:block;margin-top:2px">${esc(f.asOf || "")}${f.src ? " · " + cite(f.src) : ""}</span>${f.alt ? `<span class="note" style="display:block;margin-top:3px">${esc(f.alt.v)} ${cite(f.alt.src)}</span>` : ""}</span>` : `<span class="note">Not published for this micro-market</span>`;
const zoneSources = (z) => (z.sources || []).length ? `<div class="src" style="margin-top:8px">Sources for the points above: ${z.sources.map(u => cite(u)).join(" · ")}</div>` : "";
function renderMarkets() {
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
  head("Micro-market overview", `${words[Z.length] || Z.length} micro-markets, one ranking`, "What each part of the city is like for an office, what it costs and who is already there. Figures are quoted with their source and date.");
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
        <div class="note" style="margin-top:8px">Options here: ${os.map(optLink).join(" · ") || "none on the ranking"}</div>
      </div>`; }).join("")}
    <p class="note">Rent, vacancy and stock figures come from one source (Savills, Dec 2025) so they compare like for like; the line under each is the newest figure from another broker. They are micro-market bands, not the asking rent of any building on the list.</p>
    <h3>Chennai office market</h3>
    ${factList(F.market)}`;
}

/* ---------- Connectivity ---------- */
function renderConnect() {
  head("Connectivity", "How people get to each option", `Nearest open station today, and the nearest Chennai Metro Phase 2 station being built. Network as of ${esc(TR.asOfText || TR.asOf)}.`);
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const air = (TR.anchors || []).find(a => a.id === "airport"), cen = (TR.anchors || []).find(a => a.id === "central");
  const rows = O.slice().sort((a, b) => nearestOpen(a).d - nearestOpen(b).d).map(o => {
    const r = nearestOpen(o), f = nearestPlan(o), b = nearestBus(o);
    return `<tr><td>${optLink(o)}<br>${zoneTag(ZONE[o.micro])}</td>
      <td><b class="num">${fmtM(r.d)}</b> to ${esc(r.s.name)}<br><span class="note">${esc(r.s.lineName)} · ${esc(accessWord(r.d))}</span></td>
      <td>${f ? `<b class="num">${fmtM(f.d)}</b> to ${esc(f.s.name)}<br><span class="note">${esc(f.s.lineName)}${f.s.target ? ` · ${esc(f.s.target)}` : ""}</span>` : "-"}</td>
      <td>${b ? `<b class="num">${fmtM(b.d)}</b> to ${esc(b.s.name)}<br><span class="note">${esc(busWalk(b))} · ${esc(routesTxt(b.s.routes))}</span>` : "-"}</td></tr>`;
  }).join("");
  const lines = LINES.map(L => {
    const open = L.stations.filter(s => s.open).length;
    const soon = L.stations.find(x => !x.open && x.opens);
    return `<div class="fact"><span class="sw" style="background:${L.color};${open ? "" : `background:repeating-linear-gradient(90deg,${L.color} 0 4px,transparent 4px 7px)`}"></span><span class="k">${esc(L.name)}</span> <span class="note">· ${open ? `${open} of ${L.stations.length} stations shown open` : soon ? `opens ${esc(soon.target.replace(/^Opens /, ""))}` : "under construction"}</span>${L.note ? `<br><span class="note">${esc(L.note)}</span>` : ""}${L.src ? ` <span class="src">${cite(L.src)}</span>` : ""}</div>`;
  }).join("");
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">Nearest station for each option</h3>
    <table class="ring-tbl"><thead><tr><th style="width:26%">Option</th><th>Nearest open station</th><th>Nearest upcoming metro</th><th>Nearest bus stop</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Straight-line distance from the pin to the station or stop. Walk time at 80 m a minute where it is under 1.2 km. Upcoming metro stations are indicative. Bus stops: ${cite(BUSD.src, BUSD.credit || "MTC")}. ${esc(METHOD)}</p>
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
  const homeMax = Math.max(...O.map(homeKm));
  const homeBars = O.slice().sort((a, b) => homeKm(a) - homeKm(b) || a.n - b.n).map(o => `<div class="r"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${optLink(o)}</span><div class="tr"><div class="fl" style="width:${Math.round(homeKm(o) / homeMax * 100)}%"></div></div><span class="v" title="${esc(homeMin(o))}">${isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o))}</span></div>`).join("");
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
    <p class="note" style="margin-top:8px">Road distances from today's office are the client's sheet. The matrix above is straight-line. ${esc(METHOD)}</p>`;
}

/* ---------- Talent ---------- */
function renderTalent() {
  head("Talent", "Where artists train, live and already work", "The talent pool is institutes and residential belts within 30 minutes. The existing pool is VFX, animation and post studios within 30 minutes, the people you can hire with experience.");
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const rows = O.slice().sort((a, b) => (talentRaw(b) + studioRaw(b)) - (talentRaw(a) + studioRaw(a)) || a.n - b.n).map(o => {
    const c = catchOf(o), ns = nearestStudio(o);
    return `<tr><td>${optLink(o)}</td><td class="num">${upTo(c, 1, "edu")}</td><td class="num">${upTo(c, 1, "res")}</td><td class="num">${upTo(c, 2, "studio") ? `<b>${upTo(c, 1, "studio")}</b> <span class="note">/ ${upTo(c, 2, "studio")}</span>` : `<span class="note">-</span>`}</td><td class="num">${upTo(c, 0, "it")}</td><td>${ns ? `${esc(ns.s.name)}<br><span class="note">${fmtKm(ns.d)}</span>` : "-"}</td></tr>`;
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
  return `<div class="podium">${r.map((o, i) => `<button type="button" data-go="${o.id}" data-hint="Open ${esc(o.name)}"><span class="p">${["First", "Second", "Third"][i]}</span><span class="n">${esc(o.name)}</span><span class="s">${score(o)}/100 · sheet #${o.n}</span></button>`).join("")}</div>`;
}
function renderPriorities() {
  head("Your priorities", "What matters most to you?", "Answer seven questions. Price and ecosystem are the revised sheet's scores; the rest come from the map. The ranking, the list, the pins and the conclusion follow straight away.");
  $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act pri" data-tab="conclusion">See the conclusion</button>`));
  const base = RANKED().map(o => o.id);
  const cur = O.slice().sort(byFit);
  const w = W(), tw = PARTS.reduce((s, x) => s + w[x.key], 0) || 1;
  const rows = cur.map((o, i) => {
    const d = base.indexOf(o.id) - i;
    const dl = d > 0 ? `<span class="dl up" title="${d} above its place on the revised ranking">▲ ${d}</span>` : d < 0 ? `<span class="dl dn" title="${-d} below its place on the revised ranking">▼ ${-d}</span>` : `<span class="dl" title="Same place as on the revised ranking">=</span>`;
    return `<div class="rk"><span class="pos">${i + 1}</span><span class="nm">${optLink(o)}</span>
      <div class="tr" aria-hidden="true"><div class="fl" style="width:${score(o)}%;background:${fitColor(o)}"></div></div><span class="val">${score(o)}</span>${dl}</div>`;
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
    <h3>Full ranking · arrows compare with the revised ranking</h3>
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
  /* The move: best option that keeps the team close, against the lead. */
  const stay = O.slice().sort((a, b) => homeKm(a) - homeKm(b) || a.n - b.n)[0];
  const first = RANKED()[0];
  const sheetLine = lead.id === first.id
    ? `This agrees with the revised ranking, where it is first${fitOf(lead) ? ` (${esc(fitOf(lead).label)})` : ""}.`
    : `On the revised ranking ${optLinkLight(first)} is first${fitOf(first) ? ` (${esc(fitOf(first).label)})` : ""} and ${esc(lead.name)} is ${lead.n ? `#${lead.n}` : "unranked"}.`;
  const gap = exact(lead) - exact(second);
  const firm = gap >= 4 ? "a clear lead" : gap >= 1.5 ? "a modest lead" : "a lead within a point or two, so treat the top two as joint";
  const clean = ranked.find(o => !o.flag);
  const leadStrong = PARTS.filter(x => p[x.key] >= .75 && S.lv[x.key] > 0).map(x => x.noun);
  const leadWeak = PARTS.filter(x => p[x.key] <= .35 && S.lv[x.key] > 0 && (x.key !== "studios" || hasStudios(lead))).map(x => x.noun);
  const lb = nearestBus(lead);
  $("#p-body").innerHTML = `
    <div class="verd" style="margin-top:14px">
      <div class="l">The answer on your priorities${pri.length ? ` · led by ${esc(pri.join(" and "))}` : ""}</div>
      <div class="h">${esc(lead.name)}, ${esc(lead.sheetMicro)}</div>
      <p>${score(lead)}/100, ${esc(firm)} over ${optLinkLight(second)} (${score(second)}) and ${optLinkLight(third)} (${score(third)}). ${sheetLine}</p>
      ${lead.reason ? `<p><i>${esc(lead.reason)}</i></p>` : ""}
      <p>${esc(homeTxt(lead))} from today's office; ${fmtM(r.d)} to ${esc(r.s.name)} on ${esc(r.s.lineName)}${f ? `, ${fmtM(f.d)} to ${esc(f.s.name)} on ${esc(f.s.lineName)}${f.s.target ? ` (${esc(f.s.target)})` : ""}` : ""}. ${lb ? ` The nearest bus stop is ${esc(lb.s.name)}, ${fmtM(lb.d)} away (${esc(routesTxt(lb.s.routes))}).` : ""} Within 30 minutes: ${hasStudios(lead) ? `${plural(upTo(c, 1, "edu"), "institute")}, ${plural(upTo(c, 1, "res"), "residential belt")} and ${plural(upTo(c, 1, "studio"), "studio")}` : `${plural(upTo(c, 1, "edu"), "institute")} and ${plural(upTo(c, 1, "res"), "residential belt")}`}.</p>
      ${leadStrong.length || leadWeak.length ? `<p>${leadStrong.length ? `Strong on ${esc(listJoin(leadStrong))}.` : ""} ${leadWeak.length ? `Weaker on ${esc(listJoin(leadWeak))}, which is the trade-off to accept.` : ""}</p>` : ""}
      ${lead.flag ? `<p class="vchk"><b>Check first.</b> ${esc(lead.flag.v)} ${clean && clean.id !== lead.id ? `If it is not available, the best option without an open question is ${optLinkLight(clean)} (${score(clean)}/100, ${esc(clean.sheetMicro)}).` : ""}</p>` : ""}
    </div>
    <h3>How robust is that?</h3>
    <table class="rob"><thead><tr><th>If the priority is</th><th>First</th><th>Second</th><th>Third</th></tr></thead>
      <tbody>${presetRanks.map(pr => `<tr><td>${esc(pr.v.label)}</td>${pr.top.map(o => `<td>${optLink(o)}${o.flag ? " " + flagChip(o) : ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <p class="note">${robust.slice(0, 3).map(o => `<b>${esc(o.name)}</b> makes the top three in ${tally.get(o.id)} of ${presetRanks.length}`).join("; ")}. An option that holds up across most presets is the safer recommendation if priorities are still moving.</p>
    <h3>The trade-off in one line</h3>
    <p class="vsx">${stay.id === lead.id
      ? `${esc(lead.name)} is also the shortest move from today's office, so on these priorities there is no trade-off between keeping the team and the other measures.`
      : `${esc(stay.name)} keeps the team closest (${esc(homeTxt(stay))}, fit ${score(stay)}). ${esc(lead.name)} moves it ${isNum(lead.roadKm) ? `~${lead.roadKm} km` : fmtKm(homeKm(lead))} in exchange for ${esc(gainsOver(lead, stay))}.`}</p>
    <h3>Before signing: what to check on site</h3>
    <ol class="steps">${(M.nextSteps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    <p class="note" style="margin-top:10px">Scores combine the revised sheet's pricing and ecosystem scores with position, rail and talent on this map. Floor plates, escalation, power and fit-out terms are not on the sheet yet; they decide between options that score close together.</p>`;
}
const optLinkLight = (o) => `<a href="#" data-go="${o.id}">${esc(o.name)}</a>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
function gainsOver(a, b) {
  const pa = scoreParts(a), pb = scoreParts(b), out = [];
  const ra = nearestOpen(a), rb = nearestOpen(b);
  if (pa.rail - pb.rail > .1) out.push(`closer rail (${fmtM(ra.d)} against ${fmtM(rb.d)})`);
  const ca = catchOf(a), cb = catchOf(b);
  const ta = upTo(ca, 1, "edu") + upTo(ca, 1, "res"), tb = upTo(cb, 1, "edu") + upTo(cb, 1, "res");
  if (ta > tb) out.push(`a larger talent pool (${ta} against ${tb} institutes and belts within 30 min)`);
  const sa = upTo(ca, 1, "studio"), sb = upTo(cb, 1, "studio");
  if (sa > sb) out.push(sb ? `more studios nearby (${sa} against ${sb} within 30 min)` : `studios nearby (${sa} within 30 min)`);
  if (pa.future - pb.future > .1) out.push("a closer Phase 2 metro station");
  if (pa.price - pb.price > .1) out.push(isNum(a.pricingScore) && isNum(b.pricingScore) ? `a better pricing score (${a.pricingScore} against ${b.pricingScore} out of 10)` : "a better price");
  if (pa.eco - pb.eco > .1) out.push("a stronger ecosystem score");
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
  const p = scoreParts(o), c = catchOf(o), r = nearestOpen(o), f = nearestPlan(o), w = W(), fit = fitOf(o);
  const rank = O.slice().sort(byFit).findIndex(x => x.id === o.id) + 1;
  const backTo = TABS.find(t => t.key === S.tab) || TABS[0];
  $("#p-head").innerHTML = `<button class="back" type="button">← Back to ${esc(backTo.label)}</button>
    <div class="eyebrow">${fit ? `Rank ${o.n} · ` : `Option ${nn(o)} · `}${esc(o.sheetMicro)}</div>
    <h2>${esc(o.name)}</h2>${fitBadge(o)}${o.reason ? `<p class="reason">${esc(o.reason)}</p>` : ""}${verdictHTML(o, p)}${shotBar(o)}${actions()}`;
  const sat = satUrl(o, 640, 250, 16.6);
  const others = O.filter(x => x.id !== o.id).map(x => ({ x, d: km(o, x) })).sort((a, b) => a.d - b.d);
  const nbMax = others.length ? others[Math.min(2, others.length - 1)].d : 1;
  const studios = upTo(c, 2, "studio") > 0, b = nearestBus(o), bx = nearestBus(EX);
  const ringRows = c.map((rr, i) => `<tr><td>≤ ${rr.min} min <span class="note">(${rr.km.toFixed(1)} km)</span></td><td class="num">${upTo(c, i, "edu")}</td><td class="num">${upTo(c, i, "res")}</td>${studios ? `<td class="num">${upTo(c, i, "studio")}</td>` : ""}<td class="num">${upTo(c, i, "it")}</td></tr>`).join("");
  const ex = catchOf(EX), mo = nearestOpen(o), mx = nearestOpen(EX);
  const delta = (a, b, moreIsGood) => { const v = a - b; if (!v) return `<span class="dl">same</span>`; return `<span class="dl ${(v > 0) === moreIsGood ? "up" : "dn"}">${v > 0 ? "+" : "−"}${Math.abs(v)}</span>`; };
  const mDelta = Math.round((mo.d - mx.d) * 1000);
  const mTxt = Math.abs(mDelta) < 150 ? `<span class="dl">about the same</span>` : `<span class="dl ${mDelta < 0 ? "up" : "dn"}">${mDelta < 0 ? "closer" : "farther"} by ${fmtM(Math.abs(mDelta) / 1000)}</span>`;
  const sheetRows = [
    ["Rank on the revised sheet", fit ? `${o.n} of ${O.filter(x => fitOf(x)).length} · ${esc(fit.label)}` : ""],
    ["Pricing score", isNum(o.pricingScore) ? `${o.pricingScore} / 10` : ""],
    ["Ecosystem score", isNum(o.ecoScore) ? `${o.ecoScore} / 10` : ""],
    ["From today's office", isNum(o.roadKm) ? `~${o.roadKm} km by road, ${esc(o.driveText)}` : ""],
    ["Name on the sheet", esc(o.sheetName)],
    ["Address", esc(o.address)]
  ].filter(x => x[1]);
  $("#p-body").innerHTML = `
    ${sat ? `<div class="hero"><img src="${sat}" alt="Satellite view of ${esc(o.name)}" onerror="this.closest('.hero').remove()"><span class="ph">Satellite${imgDate(o) ? ` · captured <span data-img-date="${o.id}">${fmtDate(imgDate(o))}</span>` : ""} · Esri, Vantor</span></div>` : ""}
    <div class="kpis">
      <div class="kpi"><div class="l">Sheet scores</div><div class="v">${isNum(o.pricingScore) ? `${o.pricingScore} · ${o.ecoScore}` : "-"}</div><div class="s">pricing · ecosystem, out of 10</div></div>
      <div class="kpi"><div class="l">From today's office</div><div class="v">${isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o))}</div><div class="s">${esc(homeMin(o))} by road</div></div>
      <div class="kpi"><div class="l">Fit</div><div class="v">${score(o)}<span style="font-size:13px;color:var(--mut)">/100</span></div><div class="s">#${rank} of ${O.length} on ${esc(presetName().toLowerCase())}</div></div>
      <div class="kpi"><div class="l">Rail today</div><div class="v">${fmtM(r.d)}</div><div class="s">${esc(r.s.name)} · ${esc(r.s.lineName)}</div></div>
      <div class="kpi"><div class="l">Bus stop</div><div class="v">${b ? fmtM(b.d) : "-"}</div><div class="s">${b ? `${esc(b.s.name)} · ${esc(busWalk(b))} · ${esc(routesTxt(b.s.routes))}` : ""}</div></div>
      <div class="kpi"><div class="l">Upcoming metro</div><div class="v">${f ? fmtM(f.d) : "-"}</div><div class="s">${f ? `${esc(f.s.name)} · ${esc(f.s.lineName)}${f.s.target ? ` · ${esc(f.s.target)}` : ""} · indicative` : ""}</div></div>
    </div>

    ${flagBox(o)}
    ${marketHTML(o)}

    <h3>From the revised sheet</h3>
    <table class="spec">${sheetRows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}
      ${(o.facts || []).map(x => `<tr><th>${esc(x.k)}</th><td>${esc(x.v)} ${cite(x.src)}</td></tr>`).join("")}</table>

    <h3>Against today's office</h3>
    <p class="vsx"><b>${esc(homeTxt(o))}</b> from ${esc(EX.name)}. ${esc(moveRead(o))}</p>
    <table class="ring-tbl"><thead><tr><th></th><th>${esc(EX.name)} (today)</th><th>${esc(o.name)}</th></tr></thead><tbody>
      <tr><td>Nearest open rail</td><td>${esc(mx.s.name)} · ${fmtM(mx.d)}</td><td>${esc(mo.s.name)} · ${fmtM(mo.d)} ${mTxt}</td></tr>
      ${b && bx ? `<tr><td>Nearest bus stop</td><td>${esc(bx.s.name)} · ${fmtM(bx.d)}</td><td>${esc(b.s.name)} · ${fmtM(b.d)}</td></tr>` : ""}
      <tr><td>Institutes ≤30 min</td><td class="num">${upTo(ex, 1, "edu")}</td><td class="num">${upTo(c, 1, "edu")} ${delta(upTo(c, 1, "edu"), upTo(ex, 1, "edu"), true)}</td></tr>
      <tr><td>Residential belts ≤30 min</td><td class="num">${upTo(ex, 1, "res")}</td><td class="num">${upTo(c, 1, "res")} ${delta(upTo(c, 1, "res"), upTo(ex, 1, "res"), true)}</td></tr>
      ${hasStudios(o) ? `<tr><td>Studios ≤30 min</td><td class="num">${upTo(ex, 1, "studio")}</td><td class="num">${upTo(c, 1, "studio")} ${delta(upTo(c, 1, "studio"), upTo(ex, 1, "studio"), true)}</td></tr>` : ""}
    </tbody></table>

    <h3>Fit, part by part</h3>
    <div class="bars">${PARTS.filter(x => x.key !== "studios" || hasStudios(o)).map(x => `<div class="bar" title="${esc(x.of)}"><span>${esc(x.label)}</span><div class="tr"><div class="fl" style="width:${Math.round(p[x.key] * 100)}%"></div></div><span class="val">${w[x.key] ? `${(p[x.key] * 100).toFixed(0)} · ×${w[x.key]}` : "skipped"}</span></div>`).join("")}</div>
    <p class="note">Each bar is the measure out of 100; ×n is the weight from <a href="#" data-tab="priorities">Your priorities</a>.</p>

    <h3>Talent within reach</h3>
    <table class="ring-tbl"><thead><tr><th>Drive time</th><th class="num">Institutes</th><th class="num">Homes</th>${studios ? `<th class="num">Studios</th>` : ""}<th class="num">IT parks</th></tr></thead><tbody>${ringRows}</tbody></table>
    <p class="note" style="margin-top:6px">The names are on <a href="#" data-tab="talent">Talent</a>. ${esc(METHOD)}</p>

    <h3>Nearest other options</h3>
    <div class="nb">${others.slice(0, 3).map(({ x, d }) => `<div class="r"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${optLink(x)}</span><div class="tr"><div class="fl" style="width:${Math.max(3, Math.round(d / nbMax * 100))}%"></div></div><span class="v">${fmtKm(d)} · ${driveMin(d)}′</span></div>`).join("")}</div>
    <p class="note">Turn on Distances in the map bar to draw them. Micro-market rent, vacancy and supply are on <a href="#" data-tab="markets">Micro-markets</a>${o.geoSrc ? `; the pin's source is ${cite(o.geoSrc, host(o.geoSrc))}` : ""}.</p>`;
  checkImgDate(o);
}
/* How big a move this is for today's team, by road distance. */
function moveRead(o) {
  const d = homeKm(o), m = homeMin(o);
  if (d < 4) return "Next door. Today's team keeps its commute; the choice is about the building.";
  if (d < 10) return `Same side of the city, ${m} by road. Commutes change a little for some staff.`;
  if (d < 20) return `Across town, ${m} by road. Some staff gain and some lose; map where today's team lives before deciding.`;
  return `A real relocation, ${m} by road each way. Expect some of today's team to weigh the move; plan retention and transport before committing.`;
}

/* ============================================================ compare == */
function openCompare() { $("#cmp").classList.add("on"); renderCompare(); }
window.openCompare = openCompare;
let CMP_SORT = "rank";
function renderCompare() {
  const list = O.slice().sort((a, b) => CMP_SORT === "score" ? byFit(a, b) : byRank(a, b));
  const best = (fn, hi = true) => { const v = list.map(fn).filter(isNum); const t = hi ? Math.max(...v) : Math.min(...v); return (o) => fn(o) === t; };
  const air = (TR.anchors || []).find(a => a.id === "airport");
  const rows = [
    ["Revised rank", o => fitOf(o) ? `<b>${o.n}</b> · ${fitBadge(o)}` : "-"],
    ["Reason", o => o.reason ? `<span class="note">${esc(o.reason)}</span>` : "-"],
    ["Fit (your priorities)", o => `<b>${score(o)}</b>/100`, best(score)],
    ["Pricing score", o => isNum(o.pricingScore) ? `${o.pricingScore} / 10` : "-", best(o => isNum(o.pricingScore) ? o.pricingScore : NaN)],
    ["Ecosystem score", o => isNum(o.ecoScore) ? `${o.ecoScore} / 10` : "-", best(o => isNum(o.ecoScore) ? o.ecoScore : NaN)],
    ["From today's office", o => esc(homeTxt(o)), best(o => -homeKm(o))],
    ["Micro-market", o => zoneTag(ZONE[o.micro])],
    ["Nearest open rail", o => { const r = nearestOpen(o); return `${esc(r.s.name)} (${esc(r.s.lineName)}) · ${fmtM(r.d)}`; }, best(o => -nearestOpen(o).d)],
    ["Nearest bus stop", o => { const b = nearestBus(o); return b ? `${esc(b.s.name)} · ${fmtM(b.d)} <span class="note">(${esc(routesTxt(b.s.routes))})</span>` : "-"; }, best(o => { const b = nearestBus(o); return b ? -b.d : NaN; })],
    ["Nearest upcoming metro", o => { const f = nearestPlan(o); return f ? `${esc(f.s.name)} · ${fmtM(f.d)}${f.s.target ? ` · ${esc(f.s.target)}` : ""}` : "-"; }, best(o => futureV(o))],
    ["Institutes ≤30 min", o => String(upTo(catchOf(o), 1, "edu")), best(o => upTo(catchOf(o), 1, "edu"))],
    ["Residential belts ≤30 min", o => String(upTo(catchOf(o), 1, "res")), best(o => upTo(catchOf(o), 1, "res"))],
    ["Studios ≤30 / ≤45 min", o => upTo(catchOf(o), 2, "studio") ? `${upTo(catchOf(o), 1, "studio")} / ${upTo(catchOf(o), 2, "studio")}` : "-", best(studioRaw)],
    ...(air ? [["Airport", o => `${fmtKm(km(o, air))} · ~${driveMin(km(o, air))} min`, best(o => -km(o, air))]] : [])
  ];
  $("#cmp-body").innerHTML = `
    <div class="sortrow" style="margin:12px 0 4px;flex-wrap:wrap;gap:10px">
      ${PARTS.map(p => `<label style="display:flex;flex-direction:column;gap:2px;min-width:120px">${esc(p.label)}<select data-cw="${p.key}">${LEVELS.map((l, i) => `<option value="${i}" ${S.lv[p.key] === i ? "selected" : ""}>${l.l}</option>`).join("")}</select></label>`).join("")}
      <label style="display:flex;flex-direction:column;gap:2px;min-width:120px">Order<select id="cmp-sort"><option value="rank" ${CMP_SORT === "rank" ? "selected" : ""}>Revised ranking</option><option value="score" ${CMP_SORT === "score" ? "selected" : ""}>Fit to your priorities</option></select></label>
    </div>
    <p class="note" style="margin:0 0 8px">The selectors are the same seven questions as Your priorities. Shaded cells are the best value in the row. Click a column head to open that option.</p>
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
