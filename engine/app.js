/* ============================================================================
   ATLAS · ENGINE

   One renderer for any Atlas. It reads a single bundle (engine/SCHEMA.md)
   from window.ATLAS and draws whatever is in it. Nothing here knows about a
   city, a client or an industry.

   Ported from the Chennai study, so it inherits a UI that has been in front
   of clients, with four kinds of coupling taken out:

     data      nine CHN_* globals become one bundle
     copy      the study's own words come from bundle.copy, with a default
               behind every line
     measures  the priority chooser was seven hardcoded measures with a
               scoring function each; it is now declarative over four kinds
     latitude  KM_LNG was a constant computed at Chennai's latitude, which
               would have skewed every distance in any other city

   Every block except meta and options is optional. A missing block hides the
   section it feeds; it never breaks the page.
   ============================================================================ */
"use strict";

/* ----------------------------------------------------------- the bundle -- */
const A = window.ATLAS || {};
const SLUG = A.slug || "atlas";
const M = A.meta || {};
const O = Array.isArray(A.options) ? A.options : [];
const F = A.facts || {};
const EX = A.existing || null;
const Z = Array.isArray(A.zones) ? A.zones : [];
const TR = A.transit || { lines: [] };
const PL = Array.isArray(A.places) ? A.places : [];
const CP = A.copy || {};
const BUSD = A.bus || {};
const ZONE = Object.fromEntries(Z.map(z => [z.key, z]));

/* Copy: the study's own words. Every line has a default, so an Atlas with no
   copy block still reads properly; it just reads generically. {tokens} are
   filled from the bundle. */
const TOKENS = () => ({
  title: M.title || "This atlas",
  asOf: M.asOfText || M.asOf || "",
  optionCount: String(O.length),
  zoneCount: String(Z.length),
  existingName: EX ? EX.name : "",
  city: M.city || ""
});
function fill(s) {
  const t = TOKENS();
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in t ? t[k] : m));
}
/* say("connect.title", "How people get to each option") */
function say(path, fallback) {
  const v = path.split(".").reduce((o, k) => (o == null ? o : o[k]), CP);
  return fill(v == null || v === "" ? fallback : v);
}

/* Access gate. A bundle may carry { gate: { hash } }, the SHA-256 of the
   normalised "ID:PASSWORD", exactly as the committed studies do. With no
   gate the engine assumes the page that loaded it has already decided who
   may see this, which is how a server-checked credential will work. */
const GATE_HASH = (A.gate && A.gate.hash) || "";
async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const AUTH_KEY = SLUG + "-auth", HANDOFF = A.path || ("/" + SLUG + "/");
/* CMS (atlas-cms.js): features switched off in /admin/ and visit tracking.
   Without the CMS script everything is on and nothing is tracked. */
const CMS = window.AtlasCMS || null;
const cmsOn = (key) => !CMS || CMS.on(key);
const MEDIA = A.media || ("/media/" + SLUG + "/");

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cite = (u, label) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || host(u))} ↗</a>` : "";
const nn = (o) => String(o.n == null ? "" : o.n).padStart(2, "0");
const REDUCED = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ------------------------------------------------------- fit groups ------
   How the options are grouped and coloured: "Best fit", "Grade A", whatever
   this Atlas sorts its options into. Declared in meta.fits; failing that,
   taken from the distinct `fit` values in order of first appearance, so a
   workbook that just fills a Fit column still gets groups. An Atlas with no
   fit column has none, and the pins fall back to micro-market colour. */
const FIT_PALETTE = [
  { color: "#2e7d5b", bg: "rgba(46,125,91,.12)" },
  { color: "#b7791f", bg: "rgba(183,121,31,.13)" },
  { color: "#7b6a5c", bg: "rgba(123,106,92,.13)" },
  { color: "#1d6fa5", bg: "rgba(29,111,165,.12)" },
  { color: "#8a3d6b", bg: "rgba(138,61,107,.12)" }
];
const titleCase = (k) => String(k).replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());
const FITS = (() => {
  const out = {};
  if (M.fits && typeof M.fits === "object") {
    Object.keys(M.fits).forEach((k, i) => {
      const f = M.fits[k] || {};
      out[k] = { label: f.label || titleCase(k), color: f.color || FIT_PALETTE[i % FIT_PALETTE.length].color,
                 bg: f.bg || FIT_PALETTE[i % FIT_PALETTE.length].bg };
    });
    return out;
  }
  const seen = [];
  for (const o of O) if (o.fit && !seen.includes(o.fit)) seen.push(o.fit);
  seen.forEach((k, i) => { out[k] = { label: titleCase(k), ...FIT_PALETTE[i % FIT_PALETTE.length] }; });
  return out;
})();
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
/* Offsets in km to lng/lat at this Atlas's own latitude. Taken from the map
   centre, because a constant computed for one city skews every distance in
   any other. Good to well under 1% over the tens of km an Atlas covers. */
const CENTRE_LAT = Array.isArray(M.center) && isFinite(M.center[1]) ? M.center[1] : 0;
const KM_LAT = 110.6, KM_LNG = 111.32 * Math.cos(CENTRE_LAT * Math.PI / 180);
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
/* A micro-market may carry a drawn shape, and a workbook cannot easily give
   one. Without a shape the zone is still a filter, a label and a card; it
   simply has no outline on the map, and its label sits on the options it
   holds, which is where a reader looks for it anyway. */
const hasShape = (z) => !!(z && z.shape && (z.shape.type === "band" ? z.shape.from && z.shape.to : z.shape.c));
const zonePolygon = (z) => z.shape.type === "band" ? band(z.shape.from, z.shape.to, z.shape.w) : ellipse(z.shape.c, z.shape.rx, z.shape.ry);
function zoneCentre(z) {
  if (hasShape(z)) return z.shape.type === "band" ? [(z.shape.from[0] + z.shape.to[0]) / 2, (z.shape.from[1] + z.shape.to[1]) / 2] : z.shape.c;
  const mine = O.filter(o => o.micro === z.key);
  if (mine.length) return [mine.reduce((t, o) => t + o.lng, 0) / mine.length, mine.reduce((t, o) => t + o.lat, 0) / mine.length];
  return Array.isArray(M.center) ? M.center : [0, 0];
}

/* ------------------------------------------------------- drive time ------
   Drive time is a straight-line distance turned into minutes with a road
   factor and a peak-hour speed. Both are stated in data.js with a source;
   they are indicative, not routed, and every view that uses them says so. */
const SPEED = M.speed || {};
const SPEED_KMH = isFinite(SPEED.kmh) ? SPEED.kmh : 20;
const ROAD_FACTOR = isFinite(SPEED.factor) ? SPEED.factor : 1.3;
const RING_COLORS = ["#a3502c", "#c8693a", "#d9a07a", "#e6c2aa"];
const RINGS = (Array.isArray(M.rings) && M.rings.length ? M.rings : [15, 30, 45])
  .filter(n => isFinite(n)).map((min, i) => ({ min, color: RING_COLORS[Math.min(i, RING_COLORS.length - 1)] }));
const ringKm = (min) => min / 60 * SPEED_KMH / ROAD_FACTOR;
const driveMin = (k) => Math.max(1, Math.round(k * ROAD_FACTOR / SPEED_KMH * 60));
const METHOD = `Drive times are straight-line distances at ${SPEED_KMH} km/h with a ${ROAD_FACTOR}x road factor${SPEED.note ? ` (${SPEED.note})` : ""}. Indicative, not routed.`;
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
const LINES = (TR.lines || []).map(L => ({ ...L, stations: (L.stations || []).map(s => {
  const open = !!s.open || from(s.opens), through = !open && from(s.through);
  return { ...s, open, through, target: open ? null : through ? "Trains pass; no stop yet" : s.target, line: L.key, lineName: L.short || L.name, mode: L.mode, color: L.color };
}) }));
const STATIONS = LINES.flatMap(L => L.stations);
const OPEN = STATIONS.filter(s => s.open);
/* Stations not yet open. A measure may narrow this by mode, because a
   "metro coming" measure must not count a new suburban halt as a metro
   pipeline. With no metro line at all, every unopened station counts. */
const planFor = (modes) => {
  const want = modes == null ? null : [].concat(modes).map(String);
  return STATIONS.filter(s => !s.open && (!want || want.includes(String(s.mode))));
};
const HAS_METRO = STATIONS.some(s => s.mode === "metro");
const PLAN = HAS_METRO ? planFor("metro") : planFor(null);
const nearest = (p, list) => (list && list.length) ? list.map(s => ({ s, d: km(p, s) })).sort((a, b) => a.d - b.d)[0] : null;
/* An Atlas with no transit block still renders. nearestOpen answers with a
   sentinel rather than nothing, so the many places that read .d to sort or
   filter stay arithmetic and the places that read .s.name print an empty
   string instead of throwing. `none` is there for copy that should be
   dropped altogether. nearestPlan answers null, which every caller already
   checks, because an upcoming station is optional by nature. */
const NO_NEAR = { s: { name: "", lineName: "", mode: "", target: null }, d: Infinity, none: true };
const nearestOpen = (p) => (p ? nearest(p, OPEN) : null) || NO_NEAR;
const nearestPlan = (p) => (p ? nearest(p, PLAN) : null);
const stLabel = (s) => `${s.name} · ${s.lineName}`;
const accessWord = (d) => d <= 1.2 ? `${walkMin(d)} min walk` : d <= 3 ? "short auto or feeder" : "cab or bus";
const targetYear = (s) => s.eta || null;

/* ---------------------------------------------------------- catchment ---- */
/* The kinds of place this Atlas plots, in the order they first appear, so a
   workbook that invents its own ("hospital", "port") gets layers and
   catchment counts without a code change. */
const KINDS = (() => { const out = []; for (const x of PL) if (x.kind && !out.includes(x.kind)) out.push(x.kind); return out; })();
function catchment(p, mins) {
  const out = (mins || RINGS.map(r => r.min)).map(min => {
    const r = { min, km: ringKm(min) };
    for (const k of KINDS) r[k] = [];
    return r;
  });
  if (!p) return out;
  for (const x of PL) {
    if (!KINDS.includes(x.kind)) continue;
    const d = km(p, x), i = out.findIndex(r => d <= r.km);
    if (i >= 0) out[i][x.kind].push({ ...x, d });
  }
  return out;
}
const upTo = (c, i, kind) => c.slice(0, i + 1).reduce((s, r) => s + ((r[kind] || []).length), 0);
/* Cached per option, and per ring set, because a measure may use its own. */
const CATCH = new Map();
const catchOf = (o, mins) => {
  const key = (o && o.id) + "|" + (mins ? mins.join(",") : "-");
  if (!CATCH.has(key)) CATCH.set(key, catchment(o, mins));
  return CATCH.get(key);
};
/* For scoring, reach decays with drive time instead of stopping dead at a
   ring: a place inside 15 min counts 1, inside 30 min 0.6, inside 45 min 0.3.
   The tables still show plain counts per ring. */
const DECAY = [1, .6, .3];
const decayAt = (i) => (DECAY[i] == null ? DECAY[DECAY.length - 1] : DECAY[i]);
const reach = (o, kinds, mins) => catchOf(o, mins).reduce((t, r, i) => t + kinds.reduce((u, k) => u + ((r[k] || []).length), 0) * decayAt(i), 0);
const placesOfKind = (k) => PL.filter(x => x.kind === k);
const nearestOfKind = (p, k) => (p ? nearest(p, placesOfKind(k)) : null);
/* A kind is only written about where an option actually has one within the
   second ring; where there is none the page says nothing rather than "0". */
const hasKind = (o, k) => upTo(catchOf(o), 1, k) > 0;
/* Bus stops near the list: the nearest one to each option, and how many
   routes call there. */
/* Stops ship in two shapes and both are right: objects, or the compact
   [name, lat, lng, routes] tuple one study uses for 108 of them. */
const BUS = (BUSD.stops || []).map((s, i) => Array.isArray(s)
  ? { id: "bus" + i, name: s[0], lat: s[1], lng: s[2], routes: s[3] }
  : { id: s.id || ("bus" + i), name: s.name, lat: s.lat, lng: s.lng, routes: s.routes });
const nearestBus = (p) => (BUS.length && p) ? nearest(p, BUS) : null;
const BUS_OP = BUSD.name || BUSD.credit || "bus";
const routesTxt = (n) => n ? `about ${n} route${n === 1 ? "" : "s"}` : `${BUS_OP} stop`;
const busWalk = (b) => b.d <= 1.2 ? `${walkMin(b.d)} min walk` : "a short ride";
const exKm = (o) => EX ? km(o, EX) : NaN;
/* Distance from today's office by road: the sheet's figure where it gives
   one, otherwise the straight line with the road factor. */
const homeKm = (o) => isNum(o.roadKm) ? o.roadKm : exKm(o) * ROAD_FACTOR;
const homeMin = (o) => o.driveText || `~${driveMin(exKm(o))} min`;
const homeTxt = (o) => isNum(o.roadKm)
  ? `~${o.roadKm} km by road · ${o.driveText || `~${driveMin(o.roadKm / ROAD_FACTOR)} min`}`
  : `${fmtKm(exKm(o) * ROAD_FACTOR)} by road (est.) · ~${driveMin(exKm(o))} min`;

/* ------------------------------------------------------------ scoring ----
   The priority chooser. Each measure is scored 0 to 1 and then weighted by
   what the reader says matters.

   This is the part that was a model rather than a layout: the study this is
   ported from had seven measures with a scoring function each, one of which
   counted VFX studios. All seven turned out to reduce to four kinds, which
   is what lets an Atlas declare its own:

     column          a number on the option (a sheet score, a rent, a rating)
     nearestStation  distance to the nearest station, by status and mode
     nearestPlace    distance to the nearest place of a kind, or of several
     fromExisting    distance from the current office

   With no measures declared the chooser is hidden and the options keep the
   order the bundle gave them. */
const PARTS = (Array.isArray(A.measures) ? A.measures : []).filter(m => m && m.key && m.kind);
const HAS_CHOOSER = PARTS.length > 0;
const LEVELS = [{ v: 0, l: "Skip" }, { v: 1, l: "Low" }, { v: 2, l: "Medium" }, { v: 3, l: "High" }, { v: 5, l: "Critical" }];

/* Presets arrive as a list and are keyed here, because the ported UI reads
   them by key. One may be marked default; failing that the first wins. */
const PRESETS = {};
let DEFAULT_PRESET = null;
(Array.isArray(A.presets) ? A.presets : []).forEach(ps => {
  if (!ps || !ps.key) return;
  const lv = {};
  for (const m of PARTS) {
    const v = ps.levels ? ps.levels[m.key] : 0;
    lv[m.key] = (isFinite(v) && v >= 0 && v < LEVELS.length) ? v : 0;
  }
  PRESETS[ps.key] = { label: ps.label || titleCase(ps.key), note: ps.note || "", lv: lv };
  if (ps.default && !DEFAULT_PRESET) DEFAULT_PRESET = ps.key;
});
if (!DEFAULT_PRESET) DEFAULT_PRESET = Object.keys(PRESETS)[0] || null;
/* A reader with measures but no presets starts with every slider at medium
   rather than at zero, which would score every option identically. */
if (HAS_CHOOSER && !DEFAULT_PRESET) {
  PRESETS.balanced = { label: "Balanced", note: "", lv: Object.fromEntries(PARTS.map(m => [m.key, 2])) };
  DEFAULT_PRESET = "balanced";
}
for (const k of Object.keys(PRESETS)) if (k !== DEFAULT_PRESET && !cmsOn("preset:" + k)) delete PRESETS[k];

const wOf = (lv) => Object.fromEntries(PARTS.map(p => [p.key, LEVELS[lv[p.key] || 0].v]));
const clamp = (v) => Math.max(0, Math.min(1, v));

/* Distance to a station: on the doorstep counts 1, 400 m still counts 1,
   and it falls away to almost nothing past 3 km. */
function railV(d) {
  if (!isFinite(d)) return 0;
  const m = d * 1000;
  if (m <= 400) return 1;
  if (m <= 1000) return 1 - .25 * (m - 400) / 600;
  if (m <= 3000) return .75 - .55 * (m - 1000) / 2000;
  return Math.max(.05, .2 - .15 * (m - 3000) / 4000);
}
/* A station still being built is worth less the further off it is. The year
   is read against this Atlas's own date, not a year written into the code. */
const THIS_YEAR = (() => { const y = parseInt(String(M.asOf || "").slice(0, 4), 10); return isFinite(y) ? y : new Date().getFullYear(); })();
function etaFactor(st) {
  const y = targetYear(st);
  if (y == null) return .7;
  if (y <= THIS_YEAR) return 1;
  if (y === THIS_YEAR + 1) return .9;
  if (y === THIS_YEAR + 2) return .8;
  return .7;
}
/* Road distance from today's office: next door counts 1, and it is worth
   almost nothing by the far edge of the study. */
const homeV = (r) => !isFinite(r) ? .5 : r <= 3 ? 1 : Math.max(.05, 1 - (r - 3) / 34);
/* Kept for the Conclusion and Compare views, which name the upcoming
   station directly rather than through a measure. */
const futureV = (o) => { const n = nearestPlan(o); return n ? railV(n.d) * etaFactor(n.s) : 0; };

/* A measure's scale. An explicit max keeps a sheet score out of 10 scored
   out of 10 even when nothing reaches 10; otherwise the best option in the
   bundle sets the top of the scale. */
const MAX = new Map();
function maxFor(m) {
  if (MAX.has(m.key)) return MAX.get(m.key);
  let v = 1;
  if (m.kind === "column") {
    v = isFinite(m.max) ? m.max : Math.max(...O.map(o => (isNum(o[m.column]) ? o[m.column] : 0)), 1);
  } else if (m.kind === "nearestPlace") {
    const kinds = [].concat(m.placeKind || []);
    v = Math.max(...O.map(o => reach(o, kinds, m.rings)), 1);
  }
  MAX.set(m.key, v || 1);
  return MAX.get(m.key);
}
/* One measure, one option, scored 0 to 1. An option a measure cannot read
   scores .5, middling, rather than worst: a building added from a broker
   link has no sheet score yet and should not be punished for it. */
function measureValue(m, o) {
  switch (m.kind) {
    case "column": {
      const v = o[m.column];
      if (!isNum(v)) return .5;
      const n = clamp(v / maxFor(m));
      return m.higherIsBetter === false ? 1 - n : n;
    }
    case "nearestStation": {
      const planned = m.status === "planned";
      const list = planned ? planFor(m.mode) : (m.mode ? OPEN.filter(s => [].concat(m.mode).map(String).includes(String(s.mode))) : OPEN);
      const n = nearest(o, list);
      if (!n) return 0;
      return railV(n.d) * (planned && m.etaDiscount !== false ? etaFactor(n.s) : 1);
    }
    case "nearestPlace": {
      const kinds = [].concat(m.placeKind || []);
      if (!kinds.length) return .5;
      return clamp(reach(o, kinds, m.rings) / maxFor(m));
    }
    case "fromExisting":
      return EX ? homeV(homeKm(o)) : .5;
  }
  return .5;
}
/* Whether a measure has anything to say about an option. The study this was
   ported from hid its "studio talent" measure for a building with no studio
   near it, rather than showing a zero; this is that rule, generalised to any
   place-based measure. */
function measureApplies(m, o) {
  if (!m || m.kind !== "nearestPlace") return true;
  return [].concat(m.placeKind || []).some(k => hasKind(o, k));
}
const kindLabel = (k) => say("layerLabels." + k, titleCase(k));
const PCACHE = new Map();
function scoreParts(o) {
  if (PCACHE.has(o.id)) return PCACHE.get(o.id);
  const p = {};
  for (const m of PARTS) p[m.key] = measureValue(m, o);
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
/* Colours and layer chips are declared here, above the state, because the
   state's initial layer switches are built from them. */
/* A colour per kind of place. meta.placeColors names them; anything it does
   not name takes the next colour off the palette, so an Atlas that invents
   its own kinds still gets distinct pins. "hub" is the transport anchors and
   is always the same neutral. */
const KIND_PALETTE = ["#5b3aa7", "#0a8a3a", "#d0417b", "#4a5a6a", "#1d6fa5", "#b7791f", "#2e7d5b", "#8a3d6b"];
const COL = (() => {
  const named = M.placeColors || {};
  const out = { hub: "#4a4a4a" };
  KINDS.forEach((k, i) => { out[k] = named[k] || KIND_PALETTE[i % KIND_PALETTE.length]; });
  return out;
})();

/* The map's layer chips. The structural layers appear only when the bundle
   has something to draw on them, and one is generated per kind of place, so
   an Atlas with hospitals and ports gets those chips without a code change. */
const LAYERS = [
  EX && { key: "existing", label: say("layerLabels.existing", "Current office"), sw: `<span class="dot" style="background:#2a1e16;box-shadow:inset 0 0 0 2.5px #2a1e16,inset 0 0 0 5px #fff"></span>`, ids: ["ex-pin", "ex-dot", "ex-label", "ex-link", "ex-link-label"] },
  Z.length && { key: "zones", label: say("layerLabels.zones", "Micro-markets"), sw: `<span class="sw" style="height:9px;background:rgba(163,80,44,.18);border:1px dashed #a3502c"></span>`, ids: ["zones-fill", "zones-line", "zones-label"] },
  OPEN.length && { key: "rail", label: say("layerLabels.rail", "Rail open"), sw: `<span class="sw" style="background:linear-gradient(90deg,#3281C4 25%,#53B848 25% 50%,#FF9900 50% 75%,#6E6E6E 75%)"></span>`, ids: ["rail-open", "rail-casing", "st-open"] },
  PLAN.length && { key: "future", label: say("layerLabels.future", "Upcoming, indicative"), sw: `<span class="sw" style="background:repeating-linear-gradient(90deg,#800080 0 3px,transparent 3px 5px,#FF0000 5px 8px,transparent 8px 10px,#e0b800 10px 13px,transparent 13px 15px)"></span>`, ids: ["rail-plan", "rail-plan-label", "st-plan", "st-plan-m"] },
  BUS.length && { key: "bus", label: say("layerLabels.bus", "Bus stops"), sw: `<span class="dot" style="background:#1d6fa5;box-shadow:inset 0 0 0 1.5px #fff,0 0 0 1px #1d6fa5"></span>`, ids: ["bus-stop", "bus-label"] },
  O.length > 1 && { key: "links", label: say("layerLabels.links", "Distances"), sw: `<span class="sw" style="background:repeating-linear-gradient(90deg,#6c5b4d 0 3px,transparent 3px 6px)"></span>`, ids: ["links", "links-label"] }
].filter(Boolean).concat(
  KINDS.map(k => ({ key: k, label: kindLabel(k), sw: `<span class="dot" style="background:${COL[k]}"></span>` }))
).concat([
  { key: "rings", label: say("layerLabels.rings", "Drive rings"), sw: `<span class="dot" style="background:transparent;border:1.5px solid #a3502c"></span>`, ids: ["rings-fill", "rings-line", "rings-label"] },
  { key: "sat", label: say("layerLabels.sat", "Satellite"), sw: `<span class="dot" style="background:linear-gradient(135deg,#5b6b4a,#a39a7a 55%,#3f4f5f)"></span>`, ids: ["sat"] }
]);
/* One line of explanation per chip. Copy may override any of them; these
   defaults say what the layer is without claiming to know the city. */
const RING_WORDS = RINGS.map(r => r.min).join(", ").replace(/, (\d+)$/, " and $1");
const LAYER_HINT_DEFAULT = {
  existing: EX ? `${EX.name}${EX.locality ? `, ${EX.locality}` : ""}, with a dashed line and the distance to the open option.` : "The current office.",
  zones: `The ${Z.length} micro-market${Z.length === 1 ? "" : "s"} the options sit in. Outlines are indicative.`,
  rail: "Lines running today, each in its own colour.",
  future: "Under construction: dashed lines with their stations. Routes and positions are indicative.",
  bus: `Bus stops near the list${BUSD.credit ? ` (${BUSD.credit})` : ""}. They show once you zoom in to street level.`,
  links: "Lines to the three nearest options from the open one. A pair picked on the distance matrix is always drawn.",
  rings: `${RING_WORDS} minute drive rings around the open option. The Catchment camera turns them on.`,
  sat: `The newest satellite imagery under the map${M.imagery ? `: ${M.imagery.name}, ${M.imagery.detail}` : ""}. Turns off the buildings and road fills so the roofs show.`
};
const LAYER_HINT = new Proxy({}, { get: (_, k) => say("layerHints." + String(k), LAYER_HINT_DEFAULT[k] || `${kindLabel(String(k))} on the map.`) });

/* The map opens light: the ranked buildings, today's office, faint
   micro-markets, open rail and the upcoming metro. Talent layers come on
   with the Talent tab (and go again after), drive rings with the Catchment
   camera; distance lines, rings and satellite are one click away. */
/* The map opens light: the options, the current office, faint micro-markets
   and whatever rail runs today. Places and drive rings come on with the tab
   or the camera that needs them. Anything the bundle has no data for is not
   in LAYERS at all, so it cannot be switched on. */
const LAYERS_ON_AT_START = ["existing", "zones", "rail", "future", "bus"];
const S = {
  tab: "overview", sel: null, hov: null, pair: null, shot: "close", sort: "rank", preset: DEFAULT_PRESET, sheet: "half",
  lv: DEFAULT_PRESET ? { ...PRESETS[DEFAULT_PRESET].lv } : {}, filters: new Set(), auto: new Set(), only: new Set(),
  layers: Object.fromEntries(LAYERS.map(l => [l.key, LAYERS_ON_AT_START.includes(l.key)]))
};
/* Filters: the fit groups (any of those ticked), and walking distance to a
   station where this Atlas has any stations to walk to. */
const FIT_FILTERS = Object.entries(FITS).map(([k, f]) => ({ key: k, label: f.label, test: o => o.fit === k })).filter(f => O.some(f.test) && cmsOn("filter:" + f.key));
const OTHER_FILTERS = (OPEN.length ? [{ key: "near", label: say("filters.near", "Station ≤ 1 km"), test: o => nearestOpen(o).d <= 1 }] : []).filter(f => cmsOn("filter:" + f.key));
for (const k of Object.keys(S.layers)) if (!cmsOn("layer:" + k)) S.layers[k] = false;
/* S.only is the map bar's property picker: empty means every property. */
const passes = (o) => {
  const on = [...S.filters], fits = on.filter(k => FITS[k]), other = on.filter(k => !FITS[k]);
  return (S.only.size === 0 || S.only.has(o.id)) && (fits.length === 0 || fits.includes(o.fit)) && other.every(k => OTHER_FILTERS.find(f => f.key === k).test(o));
};
const byRank = (a, b) => a.n - b.n;
const RANKED = () => O.slice().sort(byRank);
/* A tab appears only when the bundle can fill it. A thin Atlas is a smaller
   Atlas, never a page with empty sections. Overview and Compare always have
   the options themselves to show. */
const TABS = [
  { key: "overview", label: say("tabs.overview", "Overview"), when: true },
  { key: "markets", label: say("tabs.markets", "Micro-markets"), when: Z.length > 0 },
  { key: "connect", label: say("tabs.connect", "Connectivity"), when: OPEN.length > 0 || PLAN.length > 0 || BUS.length > 0 },
  { key: "distance", label: say("tabs.distance", "Distances"), when: O.length > 1 },
  { key: "places", label: say("tabs.places", "Places nearby"), when: KINDS.length > 0 },
  { key: "priorities", label: say("tabs.priorities", "Your priorities"), when: HAS_CHOOSER },
  { key: "conclusion", label: say("tabs.conclusion", "Conclusion"), when: HAS_CHOOSER && O.length > 1 },
  { key: "compare", label: say("tabs.compare", "Compare all"), when: O.length > 1 }
].filter(t => t.when && (t.key === "overview" || cmsOn("tab:" + t.key)));
function setLevels(lv, preset) {
  S.lv = { ...lv }; S.preset = preset || matchPreset(S.lv);
}
function matchPreset(lv) {
  const k = Object.keys(PRESETS).find(k => PARTS.every(p => PRESETS[k].lv[p.key] === lv[p.key]));
  return k || "custom";
}
/* A shared link carries the chooser's levels as one digit per measure, in
   the order the bundle declares them. A code from a bundle with a different
   number of measures is ignored rather than misread. */
const lvCode = (lv) => PARTS.map(p => lv[p.key] || 0).join("");
function lvFrom(code) {
  if (!PARTS.length) return null;
  const re = new RegExp("^[0-4]{" + PARTS.length + "}$");
  if (!re.test(code || "")) return null;
  return Object.fromEntries(PARTS.map((p, i) => [p.key, +code[i]]));
}
const presetName = () => PRESETS[S.preset] ? PRESETS[S.preset].label : say("priorities.custom", "your own mix");

/* ================================================================ gate == */
/* The page shell is one file for every Atlas, so its title, brand line and
   sign-in copy are filled from the bundle before anything else runs. */
function dressShell() {
  const t = M.title || "Atlas";
  const sub = M.sub || "";
  const asOf = M.asOfText || M.asOf || "";
  document.title = say("brand.pageTitle", `${t} · Autopilot ATLAS`);
  const d = document.querySelector('meta[name="description"]');
  if (d) d.setAttribute("content", say("brand.description", [t, sub].filter(Boolean).join(" · ")));
  const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  const brand = (M.brand || {});
  set("#brand-t", brand.title || t);
  set("#brand-s", (brand.sub || [sub, asOf].filter(Boolean).join(" · ")).toUpperCase());
  set("#g-eyebrow", say("gate.eyebrow", [sub, asOf].filter(Boolean).join(" · ")));
  const gt = $("#g-title"); if (gt) gt.textContent = say("gate.title", t);
  set("#g-lede", say("gate.lede", sub || `${O.length} ${O.length === 1 ? "option" : "options"}, read against what matters to you.`));
  set("#g-credit", say("gate.credit", ""));
  const map = $("#map"); if (map) map.setAttribute("aria-label", say("brand.mapLabel", `Map of ${t}`));
}
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
  const firstFit = Object.keys(FITS)[0];
  const nFirst = firstFit ? O.filter(o => o.fit === firstFit).length : 0;
  const stats = [
    [O.length, say("gate.statOptions", O.length === 1 ? "option" : "options")],
    nFirst && [nFirst, FITS[firstFit].label.toLowerCase()],
    Z.length && [Z.length, say("gate.statZones", "micro-markets")],
    PL.length && [PL.length, say("gate.statPlaces", "places mapped")],
    M.imagery && M.imagery.checked && [new Date(M.imagery.checked).getFullYear(), say("gate.statImagery", "satellite imagery")]
  ].filter(Boolean);
  $("#g-stats").innerHTML = stats.map(([n, l]) => `<span><b>${esc(String(n))}</b>${esc(l)}</span>`).join("");
  let handoff = null;
  try { handoff = sessionStorage.getItem("atlas-handoff"); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
  let authed = false;
  try { if (handoff === HANDOFF) sessionStorage.setItem(AUTH_KEY, "1"); authed = sessionStorage.getItem(AUTH_KEY) === "1"; } catch (e) {}
  if (handoff === HANDOFF && CMS) { let id = null; try { id = sessionStorage.getItem("atlas-access-id"); } catch (e) {} CMS.signin(id); }
  if (authed) { $("#gate").remove(); boot(); return; }
  try { if (sessionStorage.getItem(SLUG + "-out") === "1") { sessionStorage.removeItem(SLUG + "-out"); const e = $("#g-err"); e.style.color = "var(--ok)"; e.textContent = "You have signed out on this device."; } } catch (e) {}
  $("#g-form").addEventListener("submit", e => { e.preventDefault(); $("#g-err").removeAttribute("style"); go(); });
  $("#g-id").focus();
}
/* An optional sign-in backdrop, served from this Atlas's own media folder.
   WebP first, then the JPEG copy; if neither is there the image is removed
   and the CSS pattern underneath shows instead, so an Atlas with no artwork
   still has a sign-in page that looks deliberate. Phones get the portrait
   render where one exists. */
function loadBackdrop() {
  const img = $("#g-bg"); if (!img) return;
  const base = (M.backdrop || "hexfield");
  const b = /^(https?:|\/)/.test(base) ? base : MEDIA + base + (matchMedia("(max-aspect-ratio: 3/4)").matches ? "-tall" : "-wide");
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
  try { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem("atlas-handoff"); sessionStorage.setItem(SLUG + "-out", "1"); } catch (e) {}
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
  renderSort();
  renderTabs(); renderFilters(); renderList(); renderPanel(); renderLayers();
  wireBoard(); wireSheet(); wirePanes(); wireHints();
  const so = $("#signout");
  if (GATE_HASH) so.addEventListener("click", signOut);
  else if (window.AtlasAccess && window.AtlasAccess.slug) so.addEventListener("click", () => { if (CMS) CMS.signout(); window.AtlasAccess.signOut(); });
  else so.remove();
  $("#sort").dataset.hint = say("sort.hint", "Change the order of the list.");
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
  const style = A.mapStyle || MAP_STYLE;
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
  SPREAD = new Map(pts.filter(q => (!EX || q.id !== EX.id) && Math.hypot(q.x - q.x0, q.y - q.y0) > 1.5).map(q => [q.id, map.unproject([q.x, q.y]).toArray()]));
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
    const [a, b] = S.pair.map(id => (EX && id === EX.id) ? EX : O.find(o => o.id === id));
    if (a && b) add(a, b, "pair");
  } else if (S.sel && S.layers.links) {
    const o = O.find(x => x.id === S.sel);
    O.filter(x => x.id !== o.id).map(x => ({ x, d: km(o, x) })).sort((a, b) => a.d - b.d).slice(0, 3).forEach(({ x }) => add(o, x, "nb"));
  }
  return FC(out);
}
function exLinkFC() {
  const o = S.sel && O.find(x => x.id === S.sel);
  if (!o || !EX) return FC([]);
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
const placesFC = () => FC(PL.map(p => pt(p.lng, p.lat, { id: p.id, kind: p.kind, name: p.name, color: COL[p.kind] || "#4a4a4a" })));

function add(layer, before) { try { map.addLayer(layer, before); } catch (e) { console.warn("layer", layer.id, e.message); } }
function addLayers() {
  /* Satellite: the newest Esri World Imagery, drawn under the roads and
     labels (Mapbox Standard's bottom slot) and under everything of ours.
     Tiles load only while the layer is on. */
  map.addSource("sat", { type: "raster", tiles: [`${ESRI}/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution: esc(IMG.credit || "Esri World Imagery") });
  const standard = (A.mapStyle || MAP_STYLE) === MAP_STYLE;
  add({ id: "sat", type: "raster", source: "sat", ...(standard ? { slot: "bottom" } : {}), layout: { visibility: "none" }, paint: { "raster-fade-duration": 120 } });

  /* zones */
  map.addSource("zones", { type: "geojson", data: FC(Z.filter(hasShape).map(z => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [zonePolygon(z)] }, properties: { key: z.key, color: z.color || "#a3502c" } }))) });
  map.addSource("zone-labels", { type: "geojson", data: FC(Z.map(z => pt(...zoneCentre(z), { label: String(z.label || z.name || z.key).toUpperCase() }))) });
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

  /* places, one layer per kind */
  const pData = placesFC();
  map.addSource("places", { type: "geojson", data: pData });
  add({ id: "places", type: "circle", source: "places", paint: {
    "circle-radius": 6,
    "circle-color": ["get", "color"], "circle-opacity": ["case", ["==", ["get", "kind"], "res"], .25, .9],
    "circle-stroke-color": ["case", ["==", ["get", "kind"], "res"], ["get", "color"], "#fff"], "circle-stroke-width": 1.4 } });
  map.addSource("places-lbl", { type: "geojson", data: pData });
  add({ id: "places-label", type: "symbol", source: "places-lbl", minzoom: 11.8, layout: { "text-field": ["get", "name"], "text-size": 10.5,
    "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"], "text-offset": [0, .95], "text-anchor": "top", "text-optional": true, "text-max-width": 9 },
    paint: { "text-color": ["get", "color"], "text-halo-color": "#fff", "text-halo-width": 1.3 } });

  /* Bus stops: from street-level zoom only, so the city view stays clean */
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
  /* With no current office the source is empty rather than absent, so every
     ex-* layer still exists and the layer switches need no special case. */
  const exData = EX ? pt(EX.lng, EX.lat, { name: EX.name }) : FC([]);
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
  add({ id: "ex-label", type: "symbol", source: "existing-lbl", layout: { "text-field": EX ? `${EX.name} · ${say("map.currentOffice", "current office")}` : "", "text-size": 12,
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
/* With satellite on, Standard's 3D buildings and trees would hide the
   roofs, so they go while it is on; and the imagery moves up to the middle
   slot, above the basemap's flat building footprints and road fills, which
   otherwise sit as white shapes on top of the photo. Labels stay above. */
function basemapForSat() {
  if (!map || (A.mapStyle || MAP_STYLE) !== MAP_STYLE) return;
  try { map.setConfigProperty("basemap", "show3dObjects", !S.layers.sat); } catch (e) {}
  try { if (map.getLayer("sat") && map.setSlot) map.setSlot("sat", S.layers.sat ? "middle" : "bottom"); } catch (e) {}
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
    const kind = x.kind === "hub" ? say("layerLabels.hub", "Transport") : kindLabel(x.kind);
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
/* What this Atlas can be sorted by. Only what it actually has: no chooser
   means no "fit to your priorities", no current office means no "distance
   from it", and a numeric column declared as a measure sorts on its own. */
const SORTS = (() => {
  const out = [{ key: "rank", label: say("sort.rank", "Ranking"), fn: byRank }];
  if (HAS_CHOOSER) out.push({ key: "score", label: say("sort.score", "Fit to your priorities"), fn: (a, b) => exact(b) - exact(a) || byRank(a, b) });
  if (EX) out.push({ key: "home", label: say("sort.home", "Distance from the current office"), fn: (a, b) => homeKm(a) - homeKm(b) || byRank(a, b) });
  if (OPEN.length) out.push({ key: "rail", label: say("sort.rail", "Nearest station today"), fn: (a, b) => nearestOpen(a).d - nearestOpen(b).d });
  if (KINDS.length) out.push({ key: "places", label: say("sort.places", "Places within reach"), fn: (a, b) => reach(b, KINDS) - reach(a, KINDS) || byRank(a, b) });
  for (const m of PARTS) {
    if (m.kind !== "column") continue;
    out.push({ key: "col:" + m.key, label: m.label || titleCase(m.key),
      fn: (a, b) => (measureValue(m, b) - measureValue(m, a)) || byRank(a, b) });
  }
  return out;
})();
function renderSort() {
  const el = $("#sort"); if (!el) return;
  el.innerHTML = SORTS.map(x => `<option value="${esc(x.key)}">${esc(x.label)}</option>`).join("");
  el.value = S.sort;
  el.parentElement && el.parentElement.classList.toggle("off", SORTS.length < 2);
}
function sorted() {
  const x = SORTS.find(x => x.key === S.sort);
  return O.slice().sort(x ? x.fn : byRank);
}
function renderList() {
  const shown = O.filter(passes);
  $("#b-count").textContent = shown.length === O.length ? `${O.length} ${O.length === 1 ? "option" : "options"}` : `${shown.length} of ${O.length} options`;
  const sx = SORTS.find(x => x.key === S.sort);
  $("#b-sub").textContent = S.sort === "score" ? presetName() : sx ? sx.label : "";
  $("#list").innerHTML = sorted().map(o => {
    const r = nearestOpen(o);
    return `<button class="card ${S.sel === o.id ? "sel" : ""} ${passes(o) ? "" : "dim"}" data-id="${o.id}" role="listitem" type="button" data-hint="${esc(o.reason || `Open ${o.name}: the map flies in and draws the line to the current office.`)}">
      ${tile(o)}
      <div>
        <div class="nm"><span class="no">${nn(o)}</span>${esc(o.name)}</div>
        <div class="loc">${fitBadge(o)} ${esc(o.sheetMicro)}</div>
        <div class="facts">${EX ? `<span title="From the current office by road">${isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o))}${homeMin(o) ? ` · ${esc(homeMin(o))}` : ""}</span>` : ""}${r.none ? "" : `<span title="Nearest station open: ${esc(r.s.name)}">${fmtM(r.d)} to rail</span>`}${(b => b ? `<span title="Nearest bus stop: ${esc(b.s.name)}">${fmtM(b.d)} to bus</span>` : "")(nearestBus(o))}${flagChip(o)}</div>
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
/* Opening the Places tab turns on every kind of place, and turns them off
   again on the way out, so the map does not silently accumulate layers. */
const TAB_LAYERS = { places: KINDS.slice() };
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
/* Which chips get an "i" button listing what is on them: the place kinds. */
const INFO = Object.fromEntries(KINDS.map(k => [k, kindLabel(k)]));
/* The property chip's swatch: one slice per fit group, or a plain dot when
   this Atlas does not group its options. */
function fitWheel() {
  const cols = Object.values(FITS).map(f => f.color);
  if (!cols.length) return "#a3502c";
  if (cols.length === 1) return cols[0];
  const step = 100 / cols.length;
  return `conic-gradient(${cols.map((c, i) => `${c} 0 ${Math.round((i + 1) * step)}%`).join(",")})`;
}
function renderLayers() {
  const n = S.only.size;
  const props = `<button class="chip lay props ${n ? "on" : ""}" type="button" data-pop="props" aria-haspopup="dialog" aria-expanded="${POP && POP.dataset.for === "props"}" data-hint="Choose which properties show on the map and in the list.">`
    + `<span class="dot" style="background:${fitWheel()}"></span>${n ? `${n} of ${O.length} properties` : "All properties"} ▾</button>`;
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
const GUIDE = (() => {
  const r2 = (RINGS[1] || RINGS[0]).min;
  const kindWords = KINDS.map(k => kindLabel(k).toLowerCase());
  const g = {
    overview: { hint: say("guide.overview.hint", "The ranking, and what stands out across the options."),
      items: [say("guide.overview.1", "Each card at the top answers one question a client asks first. Click it to open that option."),
        HAS_CHOOSER && say("guide.overview.2", "Your priorities re-ranks the same options against the measures on the map.")].filter(Boolean) },
    markets: { hint: say("guide.markets.hint", "The micro-markets: what each is like, what it costs and who is there."),
      items: [say("guide.markets.1", "One card per micro-market, with the options that sit in it."),
        say("guide.markets.2", "Every figure is quoted from the source named under it, with its date.")] },
    connect: { hint: say("guide.connect.hint", "How people get to each option."),
      items: [OPEN.length && say("guide.connect.1", "The nearest station open today for every option, and how you get from it."),
        PLAN.length && say("guide.connect.2", "The nearest station being built, with its reported target. Routes and positions are indicative."),
        BUS.length && say("guide.connect.3", "The nearest bus stop and how many routes call there.")].filter(Boolean) },
    distance: { hint: say("guide.distance.hint", "How far every option is from every other one."),
      items: [say("guide.distance.1", "The matrix is ordered by micro-market, so clusters show as dark blocks."),
        say("guide.distance.2", "Click any cell: the map draws that pair and its distance."),
        EX && say("guide.distance.3", "The bars below show how far each option moves the team from today's office.")].filter(Boolean) },
    places: { hint: say("guide.places.hint", "What each option is close to."),
      items: [say("guide.places.1", `For each option, how many ${kindWords.join(", ").replace(/, ([^,]*)$/, " and $1")} are within ${r2} minutes.`),
        say("guide.places.2", "They show on the map while this tab is open, and go again when you leave it.")] },
    priorities: { hint: say("guide.priorities.hint", "Tell us what matters most; the ranking follows."),
      items: [say("guide.priorities.1", `Answer ${PARTS.length} question${PARTS.length === 1 ? "" : "s"} from Skip to Critical, or start from a preset.`),
        say("guide.priorities.2", "The top three, the list, the pins and the Conclusion all re-rank as you go."),
        say("guide.priorities.3", "Copy link keeps your answers, so the client can open the same ranking.")] },
    conclusion: { hint: say("guide.conclusion.hint", "The answer on your priorities, and what to check next."),
      items: [say("guide.conclusion.1", "The leading option on your current priorities, and whether the ranking agrees."),
        say("guide.conclusion.2", "How often each option makes the top three across every preset, so you can see which hold up.")] },
    compare: { hint: say("guide.compare.hint", "Every option side by side.") }
  };
  return g;
})();
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
  else ({ overview: renderOverview, markets: renderMarkets, connect: renderConnect, distance: renderDistance, places: renderPlaces, priorities: renderPriorities, conclusion: renderConclusion }[S.tab] || renderOverview)();
  $("#p-body").insertAdjacentHTML("afterbegin", introCard(S.sel ? "option" : S.tab));
}
const head = (eyebrow, title, lede) => { $("#p-head").innerHTML = `<div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${lede ? `<div class="lede">${lede}</div>` : ""}`; };
const factList = (arr) => (arr || []).length ? `<ul class="facts">${arr.map(f => { const conf = f.conf || f.confidence || ""; return `<li class="fact"><span class="k">${esc(f.k)}.</span> ${esc(f.v)}${conf ? `<span class="conf ${esc(conf)}">${esc(conf)}</span>` : ""}
  <div class="meta">${esc(f.asOf || "")}${f.note ? " · " + esc(f.note) : ""}${f.src ? " · " + cite(f.src) : ""}</div></li>`; }).join("")}</ul>` : "";
/* A group of sourced facts with its own heading, or nothing at all when the
   bundle has no facts in that group. Group headings come from copy, because
   "market" should read as "Chennai office market" on one Atlas and
   "Industrial land in Pune" on another. */
function factsSection(group, fallbackHeading) {
  const arr = F[group];
  if (!Array.isArray(arr) || !arr.length) return "";
  return `<h3>${esc(say("factGroups." + group, fallbackHeading || titleCase(group)))}</h3>${factList(arr)}`;
}
/* Every facts group the bundle carries that no tab has already shown. */
function factsRest(shown) {
  return Object.keys(F).filter(g => !shown.includes(g)).map(g => factsSection(g)).join("");
}
const optLink = (o) => `<a href="#" data-go="${o.id}">${nn(o)} ${esc(o.name)}</a>`;
/* "Check first" notes: things to confirm before relying on an option. */
const flagBox = (o) => o.flag ? `<div class="flag"><b>Check first</b>${esc(o.flag.v)} ${cite(o.flag.src)}</div>` : "";
/* Updates from broker links, approved and published in /admin/. */
const marketHTML = (o) => o.cmsExtra && o.cmsExtra.length ? `<h3>Latest from the market</h3><table class="spec">${o.cmsExtra.map(x => `<tr><th>${esc(x.label)}</th><td>${esc(x.value)}${x.by || x.asOf ? ` <span class="src">· broker-stated${x.asOf ? ", " + esc(x.asOf) : ""}</span>` : ""}</td></tr>`).join("")}</table>` : "";
const flagChip = (o) => o.flag ? `<span class="chk" title="${esc(o.flag.v)}">check first</span>` : "";
const actions = (extra = "") => `<div class="actions">${extra}<button type="button" class="act" data-copy data-hint="Copies a link that opens exactly this view, ready to send to a client.">Copy link</button><button type="button" class="act" data-print data-hint="Prints this view, or saves it as a PDF from the print dialog.">Print / PDF</button></div>`;
/* An option may sit in no micro-market, and a bundle may declare none at
   all, so the tag is nothing rather than a broken chip. */
const zoneTag = (z) => z ? `<span class="zt" style="--z:${z.color || "#a3502c"}"><i></i>${esc(z.label || z.name || z.key)}</span>` : "";

/* ---------- Overview ---------- */
/* The revised ranking, one table per fit group. */
/* The ranking table. Its columns are what this Atlas has: distance from the
   current office only when there is one, then the first two numbers the
   bundle declares as measures. The study this was ported from hard-coded
   its sheet's two scores here, which printed NaN for any other Atlas. */
function rankingHTML(list) {
  const groups = Object.entries(FITS).map(([k, f]) => ({ f, os: list.filter(o => o.fit === k) })).filter(g => g.os.length);
  const rest = list.filter(o => !fitOf(o));
  if (rest.length) groups.push({ f: { label: say("ranking.ungrouped", groups.length ? "Not grouped" : "Options"), color: "#9a8878", bg: "rgba(60,40,25,.07)" }, os: rest });
  const cols = PARTS.filter(m => m.kind === "column" && O.some(o => isNum(o[m.column]))).slice(0, 2);
  const unitOf = (m) => m.unit ? ` ${m.unit}` : isFinite(m.max) ? ` / ${m.max}` : "";
  const where = (o) => o.sheetMicro || (ZONE[o.micro] && ZONE[o.micro].label) || o.locality || "";
  return groups.map(({ f, os }) => `<div class="fg"><div class="fgh"><span class="fitb" style="--f:${f.color};--fb:${f.bg}">${esc(f.label)}</span><span class="note">${os.length} option${os.length === 1 ? "" : "s"}</span></div>
    <table class="rt"><thead><tr><th>${esc(say("ranking.option", "Option"))}</th>${EX ? `<th class="num">${esc(say("ranking.fromExisting", "From office"))}</th>` : ""}${cols.map(m => `<th class="num" title="${esc(m.of || "")}">${esc(m.label || titleCase(m.key))}</th>`).join("")}</tr></thead>
    <tbody>${os.map(o => `<tr><td><span class="mono no">${nn(o)}</span> ${optLinkLight(o)} ${flagChip(o)}${where(o) ? `<br><span class="note">${esc(where(o))}</span>` : ""}${o.reason ? `<div class="why">${esc(o.reason)}</div>` : ""}</td>
      ${EX ? `<td class="num">${isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o))}<br><span class="note">${esc(homeMin(o))}</span></td>` : ""}
      ${cols.map(m => `<td class="num">${isNum(o[m.column]) ? esc(o[m.column].toLocaleString("en-IN") + unitOf(m)) : "-"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`).join("");
}
function renderOverview() {
  const counts = Object.entries(FITS).map(([k, f]) => [f.label, O.filter(o => o.fit === k).length]).filter(x => x[1]);
  const groups = counts.length ? ` in ${counts.map(([l, n]) => `${n} ${l.toLowerCase()}`).join(", ")}` : "";
  const against = [OPEN.length && say("overview.railWord", "transit"), KINDS.length && kindLabel(KINDS[0]).toLowerCase(), EX && say("overview.existingWord", "today's office")].filter(Boolean);
  head(
    say("overview.eyebrow", `${M.title || "Atlas"}${M.asOfText || M.asOf ? ` · ${M.asOfText || M.asOf}` : ""}`),
    say("overview.title", M.sub || `${O.length} ${O.length === 1 ? "option" : "options"}, compared`),
    say("overview.intro", `${O.length} ${O.length === 1 ? "option" : "options"}${groups}${against.length ? `, read against ${against.join(", ")}` : ""}${EX ? ` at ${EX.name}${EX.locality ? `, ${EX.locality}` : ""}` : ""}.`)
  );
  if (HAS_CHOOSER) $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act pri" data-tab="priorities">${esc(say("overview.cta", "Set your priorities"))}</button>`));
  else $("#p-head").insertAdjacentHTML("beforeend", actions());
  const note = say("overview.note", HAS_CHOOSER
    ? "Your priorities re-ranks the same options against the measures on the map."
    : "");
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">${esc(say("overview.standout", "What stands out"))}</h3>
    ${insightsHTML()}
    <h3>${esc(say("overview.ranking", "The ranking"))}</h3>
    ${rankingHTML(RANKED())}
    ${note ? `<p class="note">${esc(note)}</p>` : ""}`;
}
/* The cards at the top of the Overview. Each one is only built where the
   bundle can answer it, so an Atlas with no current office does not claim a
   closest option to one, and the measures the bundle declares each get a
   card of their own rather than a fixed six. */
function insightsHTML() {
  if (!O.length) return "";
  const top = (f, list = O) => list.slice().sort((a, b) => f(b) - f(a) || byRank(a, b))[0];
  const first = RANKED()[0];
  const cards = [{ l: say("insights.first", "Ranked first"), v: first.name, s: [fitOf(first) && fitOf(first).label, first.sheetMicro || (ZONE[first.micro] && ZONE[first.micro].label)].filter(Boolean).join(" · "), go: first.id, tone: "lead" }];

  if (HAS_CHOOSER) {
    const best = top(exact);
    const level = levelWith(best);
    cards.push({ l: say("insights.best", "Best on your priorities"), v: best.name,
      s: `${score(best)}/100 on ${presetName().toLowerCase()}${level.length ? `, level with ${level[0].name}` : ""}`, go: best.id });
  }
  if (EX) {
    const home = top(o => -homeKm(o));
    cards.push({ l: say("insights.home", "Closest to today's office"), v: isNum(home.roadKm) ? `~${home.roadKm} km` : fmtKm(homeKm(home)),
      s: `${home.name}, ${homeMin(home)} by road`, go: home.id });
  }
  if (OPEN.length) {
    const rail = top(o => -nearestOpen(o).d), rr = nearestOpen(rail);
    if (!rr.none) cards.push({ l: say("insights.rail", "Closest to a station today"), v: fmtM(rr.d), s: `${rail.name}, to ${rr.s.name}${rr.s.lineName ? ` (${rr.s.lineName})` : ""}`, go: rail.id });
  }
  if (PLAN.length) {
    const fut = top(o => futureV(o)), fN = nearestPlan(fut);
    if (fN) cards.push({ l: say("insights.future", "Closest to one being built"), v: fmtM(fN.d), s: `${fut.name}, to ${fN.s.name}${fN.s.target ? ` (${fN.s.target})` : ""}`, go: fut.id });
  }
  /* One card for the kind of place the Atlas plots most of, which is the
     one it is most likely to be about. */
  if (KINDS.length) {
    const k = KINDS.slice().sort((a, b) => placesOfKind(b).length - placesOfKind(a).length)[0];
    const near = top(o => reach(o, [k]));
    const c = catchOf(near), r1 = RINGS[0], r2 = RINGS[1];
    if (upTo(c, 0, k) || upTo(c, 1, k)) {
      cards.push({ l: say("insights.places", `Most ${kindLabel(k).toLowerCase()} nearby`), v: near.name,
        s: `${upTo(c, Math.min(1, RINGS.length - 1), k)} within ${(r2 || r1).min} min`, go: near.id });
    }
  }
  return `<div class="ins" role="list">${cards.map(c => `<button type="button" role="listitem" class="in ${c.tone || ""}" data-go="${c.go}" data-hint="Open this option: the map flies in and its details open.">
    <span class="l">${esc(c.l)}</span><span class="v">${esc(c.v)}</span><span class="s">${esc(c.s)}</span></button>`).join("")}</div>`;
}
function verdictHTML(o, p) {
  const parts = PARTS.filter(x => measureApplies(x, o));
  const good = parts.filter(x => p[x.key] >= .8).map(x => x.label);
  const weak = parts.filter(x => p[x.key] <= .3).map(x => x.label);
  return `<div class="verdict">${good.map(g => `<span class="vd up">✓ ${esc(g)}</span>`).join("")}${weak.map(w => `<span class="vd dn">! ${esc(w)}</span>`).join("")}</div>`;
}

/* ---------- Micro-markets ---------- */
const figure = (f) => f && f.v ? `<span>${esc(f.v)}${f.conf === "low" ? `<span class="conf low">low</span>` : ""}<span class="src" style="display:block;margin-top:2px">${esc(f.asOf || "")}${f.src ? " · " + cite(f.src) : ""}</span>${f.alt ? `<span class="note" style="display:block;margin-top:3px">${esc(f.alt.v)} ${cite(f.alt.src)}</span>` : ""}</span>` : `<span class="note">Not published for this micro-market</span>`;
const zoneSources = (z) => (z.sources || []).length ? `<div class="src" style="margin-top:8px">Sources for the points above: ${z.sources.map(u => cite(u)).join(" · ")}</div>` : "";
function renderMarkets() {
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
  head(say("markets.eyebrow", "Micro-market overview"),
    say("markets.title", `${words[Z.length] || Z.length} micro-markets, one ranking`),
    say("markets.intro", "What each part of the city is like, what it costs and who is already there. Figures are quoted with their source and date."));
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  /* A zone shows only the figures it carries, so a bundle that fills rent
     but not vacancy gets one key figure rather than two "not published". */
  const FIGS = [["rent", say("markets.rent", "Rent")], ["vacancy", say("markets.vacancy", "Vacancy")], ["stock", say("markets.stock", "Stock / supply")],
                ["plates", say("markets.plates", "Floor plates")], ["count", say("markets.count", "Buildings")]];
  const prosTitle = say("markets.pros", "In its favour"), consTitle = say("markets.cons", "Watch");
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">${esc(say("markets.heading", "The micro-markets"))}</h3>
    ${Z.map(z => { const os = O.filter(o => o.micro === z.key);
      const figs = FIGS.filter(([k]) => z[k] && z[k].v);
      const pros = z.pros || [], cons = z.cons || [];
      return `<div class="zc" style="--z:${z.color || "#a3502c"}">
        <div class="zh"><b>${esc(z.name || z.label)}</b>${zoneTag(z)}<span class="note">${os.length} option${os.length === 1 ? "" : "s"}</span></div>
        ${z.character ? `<div class="note">${esc(z.character)}</div>` : ""}
        ${figs.length ? `<div class="zk">${figs.map(([k, l]) => `<div><span class="l">${esc(l)}</span>${figure(z[k])}</div>`).join("")}</div>` : ""}
        ${z.occupiers && z.occupiers.v ? `<div class="note"><b style="color:var(--ink)">${esc(say("markets.who", "Who is there:"))}</b> ${esc(z.occupiers.v)} ${cite(z.occupiers.src)}</div>` : ""}
        ${(pros.length || cons.length) ? `<div class="pc"><div class="pro"><h4>${esc(prosTitle)}</h4><ul>${pros.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div class="con"><h4>${esc(consTitle)}</h4><ul>${cons.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>` : ""}
        ${zoneSources(z)}
        <div class="note" style="margin-top:8px">${esc(say("markets.optionsHere", "Options here:"))} ${os.map(optLink).join(" · ") || esc(say("markets.none", "none on the ranking"))}</div>
      </div>`; }).join("")}
    ${CP.markets && CP.markets.note ? `<p class="note">${esc(fill(CP.markets.note))}</p>` : ""}
    ${factsSection("market")}`;
}

/* ---------- Connectivity ---------- */
function renderConnect() {
  const net = [OPEN.length && say("connect.openWord", "stations open today"), PLAN.length && say("connect.planWord", "those being built"), BUS.length && say("connect.busWord", "bus stops")].filter(Boolean);
  head(say("connect.eyebrow", "Connectivity"),
    say("connect.title", "How people get to each option"),
    say("connect.intro", `${net.join(", ").replace(/, ([^,]*)$/, " and $1")}${TR.asOfText || TR.asOf ? `. Network as of ${TR.asOfText || TR.asOf}` : ""}.`));
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  /* Named points distances are measured to, such as a central station or an
     airport. Whatever the bundle lists, rather than two fixed ids. */
  const anchors = (TR.anchors || []).filter(a => a && isNum(a.lat) && isNum(a.lng));
  const cols = [OPEN.length && "open", PLAN.length && "plan", BUS.length && "bus"].filter(Boolean);
  const head2 = { open: say("connect.colOpen", "Nearest station open"), plan: say("connect.colPlan", "Nearest being built"), bus: say("connect.colBus", "Nearest bus stop") };
  const rows = O.slice().sort((a, b) => nearestOpen(a).d - nearestOpen(b).d).map(o => {
    const r = nearestOpen(o), f = nearestPlan(o), b = nearestBus(o);
    const cell = {
      open: r.none ? "-" : `<b class="num">${fmtM(r.d)}</b> to ${esc(r.s.name)}<br><span class="note">${esc(r.s.lineName || "")} · ${esc(accessWord(r.d))}</span>`,
      plan: f ? `<b class="num">${fmtM(f.d)}</b> to ${esc(f.s.name)}<br><span class="note">${esc(f.s.lineName || "")}${f.s.target ? ` · ${esc(f.s.target)}` : ""}</span>` : "-",
      bus: b ? `<b class="num">${fmtM(b.d)}</b> to ${esc(b.s.name)}<br><span class="note">${esc(busWalk(b))} · ${esc(routesTxt(b.s.routes))}</span>` : "-"
    };
    return `<tr><td>${optLink(o)}<br>${zoneTag(ZONE[o.micro])}</td>${cols.map(c => `<td>${cell[c]}</td>`).join("")}</tr>`;
  }).join("");
  const lines = LINES.map(L => {
    const open = L.stations.filter(s => s.open).length;
    const soon = L.stations.find(x => !x.open && x.opens);
    const when = open ? `${open} of ${L.stations.length} stations shown open`
      : soon && soon.target ? `opens ${String(soon.target).replace(/^Opens /, "")}` : say("connect.building", "under construction");
    return `<div class="fact"><span class="sw" style="background:${L.color || "#6c5b4d"};${open ? "" : `background:repeating-linear-gradient(90deg,${L.color || "#6c5b4d"} 0 4px,transparent 4px 7px)`}"></span><span class="k">${esc(L.name)}</span> <span class="note">· ${esc(when)}</span>${L.note ? `<br><span class="note">${esc(L.note)}</span>` : ""}${L.src ? ` <span class="src">${cite(L.src)}</span>` : ""}</div>`;
  }).join("");
  /* The current office's own connectivity, only where there is one and
     there is something to measure it to. */
  let fromEx = "";
  if (EX) {
    const r = nearestOpen(EX), f = nearestPlan(EX);
    const bits = [];
    if (!r.none) bits.push(`${fmtM(r.d)} from ${esc(r.s.name)}${r.s.lineName ? ` (${esc(r.s.lineName)})` : ""}`);
    if (f) bits.push(`${fmtM(f.d)} from ${esc(f.s.name)}${f.s.lineName ? ` on ${esc(f.s.lineName)}` : ""}`);
    const anchorTxt = anchors.map(a => `${esc(a.name)} is ${fmtKm(km(EX, a))} away`).join("; ");
    if (bits.length || anchorTxt) {
      fromEx = `<h3>${esc(say("connect.fromExisting", "From the current office"))}</h3>
        <p class="vsx">${bits.length ? `${esc(EX.name)} is ${bits.join(" and ")}.` : ""}${anchorTxt ? ` ${anchorTxt}.` : ""}</p>`;
    }
  }
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">${esc(say("connect.heading", "Nearest for each option"))}</h3>
    <table class="ring-tbl"><thead><tr><th style="width:26%">${esc(say("connect.colOption", "Option"))}</th>${cols.map(c => `<th>${esc(head2[c])}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
    <p class="note">${esc(say("connect.note", "Straight-line distance from the pin. Walk time at 80 m a minute where it is under 1.2 km. Anything not yet open is indicative."))}${BUSD.src ? ` ${say("connect.busSource", "Bus stops")}: ${cite(BUSD.src, BUSD.credit || BUS_OP)}.` : ""} ${esc(METHOD)}</p>
    ${fromEx}
    ${lines ? `<h3>${esc(say("connect.network", "The network"))}</h3>${lines}` : ""}
    ${factsSection("transit", "What has changed and what is coming")}`;
}

/* ---------- Distances ---------- */
/* The matrix is grouped by micro-market so clusters show as dark blocks.
   Anything not in a zone, and every option when the bundle has no zones at
   all, still has to appear: an option missing from the matrix is a silent
   hole in the page. */
const MX_ORDER = () => {
  const byZone = Z.flatMap(z => O.filter(o => o.micro === z.key).sort(byRank));
  const seen = new Set(byZone.map(o => o.id));
  return byZone.concat(O.filter(o => !seen.has(o.id)).sort(byRank));
};
function mxColor(d, max) {
  const t = Math.min(1, d / max), a = [163, 80, 44], b = [233, 180, 143], c = [246, 241, 234];
  const mix = (x, y, k) => x.map((v, i) => Math.round(v + (y[i] - v) * k));
  const rgb = t < .5 ? mix(a, b, t / .5) : mix(b, c, (t - .5) / .5);
  return { bg: `rgb(${rgb.join(",")})`, fg: t < .32 ? "#fff" : "#2a1e16" };
}
function pickPair(ids) {
  S.pair = ids; S.sel = null;
  refreshMap();
  const [a, b] = ids.map(id => (EX && id === EX.id) ? EX : O.find(o => o.id === id));
  const box = $("#mx-pick");
  if (box) { const d = km(a, b); box.innerHTML = `<b>${esc(a.name)}</b> to <b>${esc(b.name)}</b>: ${fmtKm(d)} straight line, about ${driveMin(d)} min by road. <span class="note">Drawn on the map.</span>`; }
  document.querySelectorAll("table.mx td.on").forEach(td => td.classList.remove("on"));
  if (map) fitPoints([[a.lng, a.lat], [b.lng, b.lat]], { maxZoom: 14 });
  if (innerWidth <= 860) setSheet("peek");
}
function renderDistance() {
  head("Distance between options", "How far apart the shortlist is", "Every option against every other option and against today's office. Straight-line kilometres; click a cell to draw the pair on the map.");
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  const list = MX_ORDER(), all = [EX, ...list].filter(Boolean);
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
  const table = `<div class="mx-wrap"><table class="mx"><thead><tr><th></th>${all.map(c => `<th title="${esc(c.name)}" style="${c === EX || !ZONE[c.micro] ? "" : `box-shadow:inset 0 -3px 0 ${ZONE[c.micro].color || "#a3502c"}`}">${lab(c)}</th>`).join("")}</tr></thead>
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
  const homeMax = EX ? Math.max(...O.map(homeKm).filter(isNum), 1) : 0;
  const homeBars = EX ? O.slice().sort((a, b) => homeKm(a) - homeKm(b) || byRank(a, b)).map(o => `<div class="r"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${optLink(o)}</span><div class="tr"><div class="fl" style="width:${Math.round(Math.min(1, homeKm(o) / homeMax) * 100)}%"></div></div><span class="v" title="${esc(homeMin(o))}">${isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o))}</span></div>`).join("") : "";
  $("#p-body").innerHTML = `
    <div class="kpis" style="margin-top:14px">
      ${close ? `<div class="kpi"><div class="l">${esc(say("distance.closest", "Closest pair"))}</div><div class="v">${fmtKm(close.d)}</div><div class="s">${esc(close.a.name)} and ${esc(close.b.name)}</div></div>` : ""}
      ${far && far !== close ? `<div class="kpi"><div class="l">${esc(say("distance.farthest", "Farthest pair"))}</div><div class="v">${fmtKm(far.d)}</div><div class="s">${esc(far.a.name)} and ${esc(far.b.name)}</div></div>` : ""}
      <div class="kpi"><div class="l">${esc(say("distance.clusters", "Clusters"))}</div><div class="v">${clusters.length}</div><div class="s">${esc(say("distance.clusterNote", "groups within 2.5 km of each other"))}</div></div>
    </div>
    <h3>The matrix</h3>
    <div class="mx-leg"><span>Near</span><span class="ramp"></span><span>Far (${fmtKm(max)})</span><span style="margin-left:auto">Ordered by micro-market</span></div>
    <div id="mx-pick" class="mx-pick">Click any cell to draw that pair on the map.</div>
    ${table}
    <h3>Clusters</h3>
    ${clusters.map(g => `<div class="fact">${zoneTag(ZONE[g[0].micro])} <span class="k">${g.length} options within ${fmtKm(spread(g))} of each other</span><br>${g.map(optLink).join(" · ")}</div>`).join("")}
    ${lone.length ? `<div class="fact"><span class="k">Stand-alone</span> <span class="note">(no other option within 2.5 km)</span><br>${lone.map(optLink).join(" · ")}</div>` : ""}
    ${homeBars ? `<h3>${esc(say("distance.moves", "How far each option moves the team from today's office"))}</h3>
    <div class="nb">${homeBars}</div>` : ""}
    <p class="note" style="margin-top:8px">Road distances from today's office are the client's sheet. The matrix above is straight-line. ${esc(METHOD)}</p>`;
}

/* ---------- Talent ---------- */
function renderPlaces() {
  const r1 = RINGS[0], r2 = RINGS[1] || RINGS[0];
  head(say("places.eyebrow", "Places nearby"),
    say("places.title", "What each option is close to"),
    say("places.intro", `Everything this atlas maps around the options, counted by drive time. Inside ${r2.min} minutes is the figure to compare on.`));
  $("#p-head").insertAdjacentHTML("beforeend", actions());
  /* One column per kind of place, in the order the bundle plots them. */
  const rows = O.slice().sort((a, b) => reach(b, KINDS) - reach(a, KINDS) || byRank(a, b)).map(o => {
    const c = catchOf(o);
    return `<tr><td>${optLink(o)}</td>${KINDS.map(k => {
      const near = upTo(c, Math.min(1, RINGS.length - 1), k), far = upTo(c, RINGS.length - 1, k);
      return `<td class="num">${far ? `<b>${near}</b>${RINGS.length > 1 ? ` <span class="note">/ ${far}</span>` : ""}` : `<span class="note">-</span>`}</td>`;
    }).join("")}</tr>`;
  }).join("");
  const listOf = (kind) => placesOfKind(kind).map(p => `<div class="fact"><span class="dot" style="background:${COL[kind]}"></span><span class="k">${esc(p.name)}</span> <span class="note">${esc(p.sub || "")}</span><br><span class="note">${esc(p.note || "")}${p.size ? ` · ${esc(p.size)}` : ""} ${p.src ? cite(p.src) : ""}</span></div>`).join("");
  /* The current office's own reach, as the thing to beat. */
  let exNote = "";
  if (EX) {
    const ex = catchOf(EX);
    const bits = KINDS.map(k => `${upTo(ex, Math.min(1, RINGS.length - 1), k)} ${kindLabel(k).toLowerCase()}`);
    if (bits.length) exNote = `${say("places.exPrefix", "For comparison, today's office reaches")} ${bits.join(", ").replace(/, ([^,]*)$/, " and $1")} ${say("places.exSuffix", `within ${r2.min} minutes`)}. `;
  }
  $("#p-body").innerHTML = `
    <h3 style="margin-top:14px">${esc(say("places.heading", "Reach by option"))}</h3>
    <table class="ring-tbl"><thead><tr><th>${esc(say("connect.colOption", "Option"))}</th>${KINDS.map(k => `<th class="num">${esc(kindLabel(k))} ≤${r2.min}′${RINGS.length > 1 ? ` / ${RINGS[RINGS.length - 1].min}′` : ""}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
    <p class="note">${esc(exNote)}${esc(METHOD)} ${esc(say("places.precisionNote", "Some positions are approximate; each pin says how exact it is."))}</p>
    ${factsSection("talent", "City and state facts")}
    ${KINDS.map(k => { const l = listOf(k); return l ? `<h3>${esc(kindLabel(k))}</h3>${l}` : ""; }).join("")}`;
}

/* ---------- Your priorities (the chooser) ---------- */
function podiumHTML() {
  const r = O.slice().sort(byFit).slice(0, 3);
  return `<div class="podium">${r.map((o, i) => `<button type="button" data-go="${o.id}" data-hint="Open ${esc(o.name)}"><span class="p">${["First", "Second", "Third"][i]}</span><span class="n">${esc(o.name)}</span><span class="s">${score(o)}/100${o.n ? ` · ranked #${o.n}` : ""}</span></button>`).join("")}</div>`;
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
    <h3>${esc(say("priorities.answerEach", "Or answer each question"))}</h3>
    <div class="chooser">${q}</div>
    <h3>${esc(say("priorities.fullRanking", "Full ranking · arrows compare with the ranking"))}</h3>
    <div class="rks">${rows}</div>
    <p class="note" style="margin-top:10px">${esc(say("priorities.howScored", "How each measure is scored"))}: ${PARTS.filter(p => p.of).map(p => `<b>${esc(p.label)}</b>, ${esc(p.of)}`).join("; ")}. ${esc(say("priorities.scaleNote", "Counts are scaled against the best option on the list."))}</p>`;
}

/* ---------- Conclusion ---------- */
function renderConclusion() {
  const ranked = O.slice().sort(byFit), lead = ranked[0], second = ranked[1], third = ranked[2];
  const p = scoreParts(lead), r = nearestOpen(lead), f = nearestPlan(lead), c = catchOf(lead);
  const pri = topParts().slice(0, 2).map(x => x.noun || (x.label || "").toLowerCase()).filter(Boolean);
  head(say("conclusion.eyebrow", "Conclusion"),
    say("conclusion.title", `On ${presetName().toLowerCase()}, ${lead.name} leads`),
    say("conclusion.intro", "The answer follows the priorities you set. Below: why it leads, how robust that is, and what to check before signing."));
  $("#p-head").insertAdjacentHTML("beforeend", actions(`<button type="button" class="act" data-tab="priorities">${esc(say("conclusion.change", "Change priorities"))}</button>`));
  /* Robustness: how often each option is in the top three across presets. */
  const presetRanks = Object.entries(PRESETS).map(([k, v]) => ({ k, v, top: rankWith(wOf(v.lv)).slice(0, 3) }));
  const tally = new Map(O.map(o => [o.id, 0]));
  presetRanks.forEach(pr => pr.top.forEach(o => { if (o) tally.set(o.id, tally.get(o.id) + 1); }));
  const robust = O.filter(o => tally.get(o.id) > 0).sort((a, b) => tally.get(b.id) - tally.get(a.id) || exact(b) - exact(a));
  const first = RANKED()[0];
  const sheetLine = lead.id === first.id
    ? say("conclusion.agrees", `This agrees with the ranking, where it is first${fitOf(lead) ? ` (${fitOf(lead).label})` : ""}.`)
    : `${say("conclusion.rankWord", "On the ranking")} ${optLinkLight(first)} ${say("conclusion.isFirst", "is first")}${fitOf(first) ? ` (${esc(fitOf(first).label)})` : ""} and ${esc(lead.name)} is ${lead.n ? `#${lead.n}` : "unranked"}.`;
  const gap = exact(lead) - (second ? exact(second) : 0);
  const firm = gap >= 4 ? say("conclusion.clear", "a clear lead") : gap >= 1.5 ? say("conclusion.modest", "a modest lead") : say("conclusion.tight", "a lead within a point or two, so treat the top two as joint");
  const clean = ranked.find(o => !o.flag);
  const nounOf = (x) => x.noun || (x.label || "").toLowerCase();
  const leadStrong = PARTS.filter(x => p[x.key] >= .75 && S.lv[x.key] > 0 && measureApplies(x, lead)).map(nounOf);
  const leadWeak = PARTS.filter(x => p[x.key] <= .35 && S.lv[x.key] > 0 && measureApplies(x, lead)).map(nounOf);
  const lb = nearestBus(lead);
  /* One sentence of position, built only from what this Atlas knows. */
  const where = [];
  if (EX) where.push(`${esc(homeTxt(lead))} ${say("conclusion.fromExisting", "from today's office")}`);
  if (!r.none) where.push(`${fmtM(r.d)} to ${esc(r.s.name)}${r.s.lineName ? ` on ${esc(r.s.lineName)}` : ""}`);
  if (f) where.push(`${fmtM(f.d)} to ${esc(f.s.name)}${f.s.lineName ? ` on ${esc(f.s.lineName)}` : ""}${f.s.target ? ` (${esc(f.s.target)})` : ""}`);
  if (lb) where.push(`${fmtM(lb.d)} to ${esc(lb.s.name)} (${esc(routesTxt(lb.s.routes))})`);
  const r2 = RINGS[1] || RINGS[0];
  const nearBits = KINDS.map(k => { const n = upTo(c, Math.min(1, RINGS.length - 1), k); return n ? plural(n, kindLabel(k).toLowerCase().replace(/s$/, "")) : null; }).filter(Boolean);
  /* The move: best option that keeps the team close, against the lead. */
  const stay = EX ? O.slice().sort((a, b) => homeKm(a) - homeKm(b) || byRank(a, b))[0] : null;
  $("#p-body").innerHTML = `
    <div class="verd" style="margin-top:14px">
      <div class="l">${esc(say("conclusion.answer", "The answer on your priorities"))}${pri.length ? ` · ${esc(say("conclusion.ledBy", "led by"))} ${esc(listJoin(pri))}` : ""}</div>
      <div class="h">${esc(lead.name)}${lead.sheetMicro || ZONE[lead.micro] ? `, ${esc(lead.sheetMicro || ZONE[lead.micro].label)}` : ""}</div>
      <p>${score(lead)}/100${second ? `, ${esc(firm)} over ${optLinkLight(second)} (${score(second)})${third ? ` and ${optLinkLight(third)} (${score(third)})` : ""}` : ""}. ${sheetLine}</p>
      ${lead.reason ? `<p><i>${esc(lead.reason)}</i></p>` : ""}
      ${where.length || nearBits.length ? `<p>${where.join("; ")}${where.length && nearBits.length ? ". " : ""}${nearBits.length ? `${say("conclusion.within", `Within ${r2.min} minutes`)}: ${listJoin(nearBits)}` : ""}.</p>` : ""}
      ${leadStrong.length || leadWeak.length ? `<p>${leadStrong.length ? `${say("conclusion.strongOn", "Strong on")} ${esc(listJoin(leadStrong))}.` : ""} ${leadWeak.length ? `${say("conclusion.weakerOn", "Weaker on")} ${esc(listJoin(leadWeak))}, ${say("conclusion.tradeoff", "which is the trade-off to accept")}.` : ""}</p>` : ""}
      ${lead.flag ? `<p class="vchk"><b>${esc(say("conclusion.checkFirst", "Check first."))}</b> ${esc(lead.flag.v)} ${clean && clean.id !== lead.id ? `${say("conclusion.ifNot", "If it is not available, the best option without an open question is")} ${optLinkLight(clean)} (${score(clean)}/100).` : ""}</p>` : ""}
    </div>
    ${presetRanks.length > 1 ? `<h3>${esc(say("conclusion.robust", "How robust is that?"))}</h3>
    <table class="rob"><thead><tr><th>${esc(say("conclusion.ifPriority", "If the priority is"))}</th><th>First</th><th>Second</th><th>Third</th></tr></thead>
      <tbody>${presetRanks.map(pr => `<tr><td>${esc(pr.v.label)}</td>${pr.top.map(o => `<td>${optLink(o)}${o.flag ? " " + flagChip(o) : ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <p class="note">${robust.slice(0, 3).map(o => `<b>${esc(o.name)}</b> ${say("conclusion.topThree", "makes the top three in")} ${tally.get(o.id)} of ${presetRanks.length}`).join("; ")}. ${esc(say("conclusion.holdsUp", "An option that holds up across most presets is the safer recommendation if priorities are still moving."))}</p>` : ""}
    ${stay ? `<h3>${esc(say("conclusion.tradeHeading", "The trade-off in one line"))}</h3>
    <p class="vsx">${stay.id === lead.id
      ? `${esc(lead.name)} ${esc(say("conclusion.noTrade", "is also the shortest move from today's office, so on these priorities there is no trade-off between keeping the team and the other measures."))}`
      : `${esc(stay.name)} ${say("conclusion.keepsClose", "keeps the team closest")} (${esc(homeTxt(stay))}, ${score(stay)}/100). ${esc(lead.name)} ${say("conclusion.movesIt", "moves it")} ${isNum(lead.roadKm) ? `~${lead.roadKm} km` : fmtKm(homeKm(lead))} ${say("conclusion.inExchange", "in exchange for")} ${esc(gainsOver(lead, stay))}.`}</p>` : ""}
    ${(M.nextSteps || []).length ? `<h3>${esc(say("conclusion.nextSteps", "Before signing: what to check on site"))}</h3>
    <ol class="steps">${(M.nextSteps || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
    ${CP.conclusion && CP.conclusion.note ? `<p class="note" style="margin-top:10px">${esc(fill(CP.conclusion.note))}</p>` : ""}
    ${factsRest(["market", "transit", "talent"])}`;
}
const optLinkLight = (o) => `<a href="#" data-go="${o.id}">${esc(o.name)}</a>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
/* What one option gives you that another does not, in words. Built from the
   measures the bundle declares, so it says "a better pricing score" on one
   Atlas and "a shorter lease" on another without knowing either in advance. */
function gainsOver(a, b) {
  const pa = scoreParts(a), pb = scoreParts(b), out = [];
  for (const m of PARTS) {
    if ((pa[m.key] - pb[m.key]) <= .1) continue;
    if (!measureApplies(m, a)) continue;
    if (m.kind === "nearestStation") {
      const list = m.status === "planned" ? planFor(m.mode) : OPEN;
      const na = nearest(a, list), nb = nearest(b, list);
      out.push(na && nb ? `${say("gains.closer", "closer")} ${(m.label || m.key).toLowerCase()} (${fmtM(na.d)} ${say("gains.against", "against")} ${fmtM(nb.d)})` : `${say("gains.closer", "closer")} ${(m.label || m.key).toLowerCase()}`);
    } else if (m.kind === "nearestPlace") {
      const kinds = [].concat(m.placeKind || []);
      const ring = Math.min(1, RINGS.length - 1);
      const ca = kinds.reduce((t, k) => t + upTo(catchOf(a), ring, k), 0);
      const cb = kinds.reduce((t, k) => t + upTo(catchOf(b), ring, k), 0);
      const what = kinds.map(kindLabel).join(" and ").toLowerCase();
      out.push(cb ? `${say("gains.more", "more")} ${what} (${ca} ${say("gains.against", "against")} ${cb})` : `${what} nearby (${ca})`);
    } else if (m.kind === "column" && isNum(a[m.column]) && isNum(b[m.column])) {
      out.push(`${say("gains.better", "a better")} ${(m.label || m.key).toLowerCase()} (${a[m.column]} ${say("gains.against", "against")} ${b[m.column]})`);
    } else {
      out.push(`${say("gains.better", "a better")} ${(m.label || m.key).toLowerCase()}`);
    }
  }
  return out.length ? listJoin(out) : say("gains.balance", "a better balance across your priorities");
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
  const b = nearestBus(o), bx = EX ? nearestBus(EX) : null;
  /* Only the kinds this option actually reaches, so the table has no column
     of zeroes for something the Atlas plots on the far side of the city. */
  const myKinds = KINDS.filter(k => upTo(c, RINGS.length - 1, k) > 0);
  const ex = EX ? catchOf(EX) : null, mo = nearestOpen(o), mx = nearestOpen(EX);
  const delta = (a, b, moreIsGood) => { const v = a - b; if (!v) return `<span class="dl">same</span>`; return `<span class="dl ${(v > 0) === moreIsGood ? "up" : "dn"}">${v > 0 ? "+" : "−"}${Math.abs(v)}</span>`; };
  const mDelta = Math.round((mo.d - mx.d) * 1000);
  const mTxt = Math.abs(mDelta) < 150 ? `<span class="dl">about the same</span>` : `<span class="dl ${mDelta < 0 ? "up" : "dn"}">${mDelta < 0 ? "closer" : "farther"} by ${fmtM(Math.abs(mDelta) / 1000)}</span>`;
  /* Columns the bundle declared as measures, then the fixed few, then
     anything else the row carries that has not been shown already. */
  const SHOWN = new Set(["id", "n", "name", "sheetName", "address", "lat", "lng", "micro", "sheetMicro", "precision", "geoSrc", "geoNote", "fit", "reason", "facts", "flag", "img", "photo", "thumb", "cmsExtra", "roadKm", "driveText", "locality"]);
  const colMeasures = PARTS.filter(m => m.kind === "column" && isNum(o[m.column]));
  colMeasures.forEach(m => SHOWN.add(m.column));
  const sheetRows = [
    [say("option.rank", "Rank"), fit && o.n ? `${o.n} of ${O.filter(x => fitOf(x)).length} · ${esc(fit.label)}` : ""],
    ...colMeasures.map(m => [m.label || titleCase(m.key), `${o[m.column]}${m.unit ? ` ${esc(m.unit)}` : isFinite(m.max) ? ` / ${m.max}` : ""}`]),
    [say("option.fromExisting", "From today's office"), EX ? (isNum(o.roadKm) ? `~${o.roadKm} km by road${o.driveText ? `, ${esc(o.driveText)}` : ""}` : fmtKm(homeKm(o))) : ""],
    [say("option.sheetName", "Name on the sheet"), o.sheetName && o.sheetName !== o.name ? esc(o.sheetName) : ""],
    [say("option.address", "Address"), esc(o.address || "")],
    ...Object.keys(o).filter(k => !SHOWN.has(k) && (typeof o[k] === "string" || typeof o[k] === "number") && String(o[k]).trim() !== "")
      .map(k => [titleCase(k.replace(/([a-z])([A-Z])/g, "$1 $2")), esc(o[k])])
  ].filter(x => x[1]);
  $("#p-body").innerHTML = `
    ${sat ? `<div class="hero"><img src="${sat}" alt="Satellite view of ${esc(o.name)}" onerror="this.closest('.hero').remove()"><span class="ph">Satellite${imgDate(o) ? ` · captured <span data-img-date="${o.id}">${fmtDate(imgDate(o))}</span>` : ""} · Esri, Vantor</span></div>` : ""}
    <div class="kpis">
      ${colMeasures.slice(0, 2).map(m => `<div class="kpi"><div class="l">${esc(m.label || titleCase(m.key))}</div><div class="v">${esc(String(o[m.column]))}</div><div class="s">${esc(m.unit || (isFinite(m.max) ? `out of ${m.max}` : ""))}</div></div>`).join("")}
      ${EX ? `<div class="kpi"><div class="l">${esc(say("option.fromExisting", "From today's office"))}</div><div class="v">${isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o))}</div><div class="s">${esc(homeMin(o))} by road</div></div>` : ""}
      ${HAS_CHOOSER ? `<div class="kpi"><div class="l">${esc(say("option.fit", "Fit"))}</div><div class="v">${score(o)}<span style="font-size:13px;color:var(--mut)">/100</span></div><div class="s">#${rank} of ${O.length} on ${esc(presetName().toLowerCase())}</div></div>` : ""}
      ${!r.none ? `<div class="kpi"><div class="l">${esc(say("option.railToday", "Station today"))}</div><div class="v">${fmtM(r.d)}</div><div class="s">${esc(r.s.name)}${r.s.lineName ? ` · ${esc(r.s.lineName)}` : ""}</div></div>` : ""}
      ${b ? `<div class="kpi"><div class="l">${esc(say("option.bus", "Bus stop"))}</div><div class="v">${fmtM(b.d)}</div><div class="s">${esc(b.s.name)} · ${esc(busWalk(b))} · ${esc(routesTxt(b.s.routes))}</div></div>` : ""}
      ${f ? `<div class="kpi"><div class="l">${esc(say("option.future", "Being built"))}</div><div class="v">${fmtM(f.d)}</div><div class="s">${esc(f.s.name)}${f.s.lineName ? ` · ${esc(f.s.lineName)}` : ""}${f.s.target ? ` · ${esc(f.s.target)}` : ""} · indicative</div></div>` : ""}
    </div>

    ${flagBox(o)}
    ${marketHTML(o)}

    ${sheetRows.length ? `<h3>${esc(say("option.spec", "The detail"))}</h3>` : ""}
    <table class="spec">${sheetRows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join("")}
      ${(o.facts || []).map(x => `<tr><th>${esc(x.k)}</th><td>${esc(x.v)} ${cite(x.src)}</td></tr>`).join("")}</table>

    ${EX ? `<h3>${esc(say("option.against", "Against today's office"))}</h3>
    <p class="vsx"><b>${esc(homeTxt(o))}</b> from ${esc(EX.name)}. ${esc(moveRead(o))}</p>
    <table class="ring-tbl"><thead><tr><th></th><th>${esc(EX.name)} (today)</th><th>${esc(o.name)}</th></tr></thead><tbody>
      ${!mo.none && !mx.none ? `<tr><td>${esc(say("option.nearestStation", "Nearest station open"))}</td><td>${esc(mx.s.name)} · ${fmtM(mx.d)}</td><td>${esc(mo.s.name)} · ${fmtM(mo.d)} ${mTxt}</td></tr>` : ""}
      ${b && bx ? `<tr><td>${esc(say("option.bus", "Nearest bus stop"))}</td><td>${esc(bx.s.name)} · ${fmtM(bx.d)}</td><td>${esc(b.s.name)} · ${fmtM(b.d)}</td></tr>` : ""}
      ${myKinds.map(k => `<tr><td>${esc(kindLabel(k))} ≤${(RINGS[1] || RINGS[0]).min} min</td><td class="num">${upTo(ex, 1, k)}</td><td class="num">${upTo(c, 1, k)} ${delta(upTo(c, 1, k), upTo(ex, 1, k), true)}</td></tr>`).join("")}
    </tbody></table>` : ""}

    ${HAS_CHOOSER ? `<h3>${esc(say("option.fitByPart", "Fit, part by part"))}</h3>
    <div class="bars">${PARTS.filter(x => measureApplies(x, o)).map(x => `<div class="bar" title="${esc(x.of || "")}"><span>${esc(x.label)}</span><div class="tr"><div class="fl" style="width:${Math.round(p[x.key] * 100)}%"></div></div><span class="val">${w[x.key] ? `${(p[x.key] * 100).toFixed(0)} · ×${w[x.key]}` : "skipped"}</span></div>`).join("")}</div>
    <p class="note">${esc(say("option.barNote", "Each bar is the measure out of 100; ×n is the weight from Your priorities."))}</p>` : ""}

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
  const r2 = (RINGS[1] || RINGS[0]).min, rLast = RINGS[RINGS.length - 1].min;
  const rows = [
    [say("compare.rank", "Rank"), o => fitOf(o) && o.n ? `<b>${o.n}</b> · ${fitBadge(o)}` : o.n ? `<b>${o.n}</b>` : "-"],
    [say("compare.reason", "Reason"), o => o.reason ? `<span class="note">${esc(o.reason)}</span>` : "-"],
    HAS_CHOOSER && [say("compare.fit", "Fit (your priorities)"), o => `<b>${score(o)}</b>/100`, best(score)],
    /* One row per declared column measure, named and scaled by the bundle. */
    ...PARTS.filter(m => m.kind === "column").map(m => [
      m.label || titleCase(m.key),
      o => isNum(o[m.column]) ? `${o[m.column]}${m.unit ? ` ${esc(m.unit)}` : isFinite(m.max) ? ` / ${m.max}` : ""}` : "-",
      best(o => isNum(o[m.column]) ? (m.higherIsBetter === false ? -o[m.column] : o[m.column]) : NaN)
    ]),
    EX && [say("compare.fromExisting", "From today's office"), o => esc(homeTxt(o)), best(o => -homeKm(o))],
    Z.length && [say("compare.micro", "Micro-market"), o => zoneTag(ZONE[o.micro])],
    OPEN.length && [say("compare.rail", "Nearest station open"), o => { const r = nearestOpen(o); return r.none ? "-" : `${esc(r.s.name)}${r.s.lineName ? ` (${esc(r.s.lineName)})` : ""} · ${fmtM(r.d)}`; }, best(o => -nearestOpen(o).d)],
    BUS.length && [say("compare.bus", "Nearest bus stop"), o => { const b = nearestBus(o); return b ? `${esc(b.s.name)} · ${fmtM(b.d)} <span class="note">(${esc(routesTxt(b.s.routes))})</span>` : "-"; }, best(o => { const b = nearestBus(o); return b ? -b.d : NaN; })],
    PLAN.length && [say("compare.future", "Nearest being built"), o => { const f = nearestPlan(o); return f ? `${esc(f.s.name)} · ${fmtM(f.d)}${f.s.target ? ` · ${esc(f.s.target)}` : ""}` : "-"; }, best(o => futureV(o))],
    /* One row per kind of place the Atlas maps. */
    ...KINDS.map(k => [
      `${kindLabel(k)} ≤${r2}${RINGS.length > 1 ? ` / ≤${rLast}` : ""} min`,
      o => { const c = catchOf(o); const far = upTo(c, RINGS.length - 1, k); return far ? `${upTo(c, Math.min(1, RINGS.length - 1), k)}${RINGS.length > 1 ? ` / ${far}` : ""}` : "-"; },
      best(o => reach(o, [k]))
    ]),
    /* Named points the bundle measures distance to, such as an airport. */
    ...(TR.anchors || []).filter(a => a && isNum(a.lat) && isNum(a.lng)).map(a => [
      a.name, o => `${fmtKm(km(o, a))} · ~${driveMin(km(o, a))} min`, best(o => -km(o, a))
    ])
  ].filter(Boolean);
  $("#cmp-body").innerHTML = `
    <div class="sortrow" style="margin:12px 0 4px;flex-wrap:wrap;gap:10px">
      ${PARTS.map(p => `<label style="display:flex;flex-direction:column;gap:2px;min-width:120px">${esc(p.label)}<select data-cw="${p.key}">${LEVELS.map((l, i) => `<option value="${i}" ${S.lv[p.key] === i ? "selected" : ""}>${l.l}</option>`).join("")}</select></label>`).join("")}
      <label style="display:flex;flex-direction:column;gap:2px;min-width:120px">${esc(say("compare.order", "Order"))}<select id="cmp-sort"><option value="rank" ${CMP_SORT === "rank" ? "selected" : ""}>${esc(say("sort.rank", "Ranking"))}</option>${HAS_CHOOSER ? `<option value="score" ${CMP_SORT === "score" ? "selected" : ""}>${esc(say("sort.score", "Fit to your priorities"))}</option>` : ""}</select></label>
    </div>
    <p class="note" style="margin:0 0 8px">${esc(say("compare.note", (HAS_CHOOSER ? "The selectors are the same questions as Your priorities. " : "") + "Shaded cells are the best value in the row. Click a column head to open that option."))}</p>
    <div style="overflow:auto"><table class="cmp"><thead><tr><th></th>${list.map(o => `<th data-open="${o.id}">${nn(o)} ${esc(o.name)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(([l, fn, b]) => `<tr><th>${esc(l)}</th>${list.map(o => `<td class="${b && b(o) ? "best" : ""}">${fn(o)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  $("#cmp-body").querySelectorAll("[data-cw]").forEach(s => s.addEventListener("change", e => {
    setLevels({ ...S.lv, [e.target.dataset.cw]: +e.target.value }); renderCompare(); renderList(); renderPanel(); refreshPins();
    const again = $(`#cmp-body [data-cw="${e.target.dataset.cw}"]`); if (again) again.focus();
  }));
  $("#cmp-sort").addEventListener("change", e => { CMP_SORT = e.target.value; renderCompare(); });
  $("#cmp-body").querySelectorAll("[data-open]").forEach(h => h.addEventListener("click", () => { $("#cmp").classList.remove("on"); select(h.dataset.open, true); }));
}

/* Start. The shell is dressed from the bundle first, so a slow map or a
   missing token still leaves a page that says what it is.

   An Atlas with a gate hash asks for the ID and password, as the committed
   studies do. One without assumes the page that loaded it has already
   decided who may see this, which is how a server-checked credential will
   work: the engine never becomes the only thing standing between a visitor
   and the data. */
dressShell();
if (GATE_HASH) {
  initGate();
} else {
  const g = $("#gate"); if (g) g.remove();
  loadBackdrop();
  startMap();
  if (CMS) { let id = null; try { id = sessionStorage.getItem("atlas-access-id"); } catch (e) {} if (id) CMS.signin(id); }
  boot();
}
