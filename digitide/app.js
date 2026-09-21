/* ============================================================================
   ATLAS · DIGITIDE GROUP PORTFOLIO COMMAND CENTRE
   Pan-India analysis over the group facility tracker (56 rows, 1 Sep 2026).

   The screen is an analysis first and a map second. It opens on the portfolio
   overview, because the first question a board asks is "how exposed are we and
   when", not "where is one building". Selecting anything drills from that
   overview into a single location, and the back link returns.

   Per location it answers, in the order the argument has to be made:
     1. What do we hold here and when does each lease close?
     2. What is the statutory wage floor here against the alternatives?
     3. What does space cost here against there?
     4. Who else recruits this catchment?
     5. Is the talent there to absorb us, and at what churn and wage?
     6. So what is the call?

   Data layers, each kept separate so provenance stays legible:
     facilities.js  the tracker, verbatim
     geo.js         per-building coordinates, each carrying its precision class
     intel.js       DG_CITIES, DG_WAGES, DG_TALENT
   ============================================================================ */
"use strict";

/* Access gate, same pattern as clients/manifest.js.

   WHAT THIS DOES AND DOES NOT DO. It gates the interface, not the data. The
   check runs in the browser, so the passcode below is readable by anyone who
   opens dev tools, and facilities.js is fetchable directly by URL whether or
   not anyone signs in. It keeps a casual visitor out of the view; it does not
   protect the tracker. Making the data actually private means moving it behind
   a server-side session, which is a deliberate piece of work, not a setting. */
const GATE = { id: "DIGITIDE-GRP", pass: "K2SY-2K5J" };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const inr = (n) => n == null ? "n/a" : "₹" + Math.round(n).toLocaleString("en-IN");
/* A cited source that cannot be opened is not really a citation. Every source
   with a URL renders as a link; every source without one renders as plain text
   rather than a dead-looking link. */
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cite = (url, label) => url
  ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label || host(url))} ↗</a>`
  : "";
const linkify = (txt) => esc(txt).replace(/https?:\/\/[^\s)<"']+/g,
  u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${host(u)} ↗</a>`);
const TODAY = new Date();
const TIER_COLOR = { 1: "#e0603a", 2: "#e0a91f", 3: "#1f8f77" };
const TIER_NAME  = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };

/* ------------------------------------------------------------------ gate -- */
function initGate(){
  const go = () => {
    const norm = (v) => v.trim().toUpperCase().replace(/[\s-]/g, "");
    const id = norm($("#g-id").value), pw = norm($("#g-pw").value);
    if (id === norm(GATE.id) && pw === norm(GATE.pass)) {
      sessionStorage.setItem("dg-auth", "1"); $("#gate").remove(); boot();
    } else $("#g-err").textContent = "Not recognised. Access is issued per person.";
  };
  if (sessionStorage.getItem("dg-auth") === "1") { $("#gate").remove(); boot(); return; }
  $("#g-go").addEventListener("click", go);
  $("#gate").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
}

/* --------------------------------------------------------------- helpers -- */
function monthsLeft(iso){
  if (!iso) return null;
  const end = new Date(iso + "T00:00:00");
  return (end.getFullYear() - TODAY.getFullYear()) * 12 + (end.getMonth() - TODAY.getMonth());
}
function fyOf(iso){
  if (!iso) return null;
  const d = new Date(iso);
  return d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();   // Indian FY, Apr to Mar
}
const fyLabel = (iso) => { const y = fyOf(iso); return y ? "FY" + String(y).slice(2) : "n/a"; };
/* Dates are shown dd/mm/yyyy. The ISO form stays in the data files because
   that is what sorts and compares correctly; only the display changes. */
const dmy = (iso) => {
  if (!iso) return "n/a";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
/* Free-text fields (policy validity, wage effective periods) carry ISO dates
   inside prose. Rewrite them in place so one date format appears on screen. */
const dmyIn = (txt) => String(txt ?? "").replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1");
const expiryClass = (m) => m == null ? "exp-ok" : m <= 12 ? "exp-red" : m <= 24 ? "exp-amber" : "exp-ok";

function wageRow(stateKey, zone){
  const w = window.DG_WAGES[stateKey];
  return w && w.zones ? w.zones[zone] || null : null;
}
/* Rent is compared as quoted per sq ft per month and never converted into a
   cost per seat. A seat figure needs a fit-out density assumption this tool has
   no business making, and it anchors a commercial conversation that belongs
   elsewhere. Midpoint of a quoted range, used only to compare two markets. */
function rentMid(rent){
  return (rent && rent.low != null) ? (rent.low + rent.high) / 2 : null;
}
/* Where a facility sits on the map. Building coordinate when geo.js has one,
   otherwise the city centroid, and the pin says which it is. */
function locOf(f){
  const g = window.DG_GEO && window.DG_GEO[f.sr];
  if (g) return { lng: g.lng, lat: g.lat, precision: g.precision, source: g.source };
  const c = window.DG_CITIES[f.city];
  return c ? { lng: c.lng, lat: c.lat, precision: "city", source: "city centroid" } : null;
}
/* Relocation pressure, 0 to 100, for one facility.

   Three parts, each with a stated ceiling, and the ceilings total exactly 100:
     urgency  0-50  how soon the lease closes, the only part that is a deadline
     gravity  0-30  what the seat city costs, so a Tier 1 site scores higher
     weight   0-20  how much operation sits there, a call centre above a
                    collection desk above a training room
   A facility with no dated lease, or one closing beyond FY30, scores null and
   is excluded rather than given a zero, because there is no decision to rank. */
const SCORE_PARTS = {
  urgency: { max: 50, label: "Lease urgency",      of: "months to lease close" },
  gravity: { max: 30, label: "Seat cost gravity",  of: "tier of the city it sits in" },
  weight:  { max: 20, label: "Operational weight", of: "what kind of centre it is" }
};
function scoreParts(f){
  const m = monthsLeft(f.leaseEnd);
  if (m == null) return null;
  const urgency = m <= 6 ? 50 : m <= 12 ? 44 : m <= 18 ? 36 : m <= 24 ? 30
                : m <= 36 ? 20 : m <= 51 ? 10 : 0;
  if (urgency === 0) return null;                    // beyond the FY30 window
  const c = window.DG_CITIES[f.city];
  const gravity = c ? (c.tier === 1 ? 30 : c.tier === 2 ? 16 : 6) : 0;
  const weight = /call/i.test(f.centreType) ? 20 : /collection/i.test(f.centreType) ? 10 : 4;
  return { urgency, gravity, weight, total: urgency + gravity + weight, months: m };
}
function pressureScore(f){ const p = scoreParts(f); return p ? p.total : null; }
const scoreBand = (n) => n >= 75 ? "hot" : n >= 50 ? "warm" : "ok";

/* ------------------------------------------------- the portfolio index ----
   One number for the whole estate, built from the four legs the brief names.

   THE ARITHMETIC, stated so it can be checked rather than trusted:
     · each factor gets a score from 0 to 100, computed from the data below
     · each factor carries a stated weight, and the weights total exactly 100
     · contribution   = score x weight / 100
     · the index      = the sum of the four contributions
     · share of index = contribution / index x 100, and the four shares total
                        exactly 100 because they are parts of that same sum
   Displayed shares are rounded by largest remainder, not independently, so the
   integers on screen also total exactly 100 rather than 99 or 101.

   The weights are a stated judgement, not a derived fact, and the panel says
   so. Everything else is computed.
------------------------------------------------------------------------- */
const INDEX_WEIGHTS = { wage: 30, rent: 25, competition: 20, talent: 25 };

/* Linear scale with clamping: `lo` maps to 0, `hi` maps to 100. */
const scale = (v, lo, hi) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

/* Lowest statutory unskilled floor reachable from a given city: the cheapest
   zone in its own state, or any of its named candidates' zones. */
function bestFloorFrom(c){
  const here = wageRow(c.stateKey, c.wageZone);
  if (!here || here.unskilled == null) return null;
  let best = here.unskilled;
  const own = window.DG_WAGES[c.stateKey];
  if (own) for (const z of Object.values(own.zones))
    if (z.unskilled != null && z.unskilled < best) best = z.unskilled;
  for (const k of c.candidates || []){
    const t = window.DG_CITIES[k]; if (!t) continue;
    const w = wageRow(t.stateKey, t.wageZone);
    if (w && w.unskilled != null && w.unskilled < best) best = w.unskilled;
  }
  return { current: here.unskilled, best };
}

function portfolioIndex(){
  /* Scored over the facilities a decision is actually live on, which is the
     same set the pressure board ranks. Scoring the whole estate would dilute
     it with leases nobody can act on. */
  const rows = visible().filter(f => pressureScore(f) != null);
  const cityOf = (f) => window.DG_CITIES[f.city];

  const wageCuts = [], rentCuts = [], attrition = [];
  let contested = 0, wageCov = 0, rentCov = 0, talentCov = 0;

  for (const f of rows){
    const c = cityOf(f); if (!c) continue;

    const bf = bestFloorFrom(c);
    if (bf){ wageCuts.push((bf.current - bf.best) / bf.current * 100); wageCov++; }

    const hereRent = rentMid(c.rent);
    if (hereRent){
      const opts = (c.candidates || []).map(k => rentMid((window.DG_CITIES[k]||{}).rent))
        .filter(v => v != null);
      if (opts.length){ rentCuts.push((hereRent - Math.min(...opts)) / hereRent * 100); rentCov++; }
    }

    if (/very high|high/i.test(c.presence || "")) contested++;

    const t = window.DG_TALENT[f.city];
    if (t && t.attrition){
      const m = t.attrition.match(/(\d+)\s*-\s*(\d+)/);
      if (m){ attrition.push((+m[1] + +m[2]) / 2); talentCov++; }
    }
  }

  const scores = {
    /* a 25% statutory cut is treated as the practical ceiling */
    wage: scale(mean(wageCuts), 0, 25),
    /* an 80% rent cut is the practical ceiling; the observed portfolio mean is
       around 65%, so the factor still discriminates instead of pinning at 100 */
    rent: scale(mean(rentCuts), 0, 80),
    /* already a percentage of facilities, so it needs no scaling */
    competition: rows.length ? (contested / rows.length) * 100 : 0,
    /* 15% annual churn scores 0, 65% scores 100 */
    talent: scale(mean(attrition), 15, 65)
  };

  const contrib = {}; let index = 0;
  for (const k of Object.keys(INDEX_WEIGHTS)){
    contrib[k] = scores[k] * INDEX_WEIGHTS[k] / 100;
    index += contrib[k];
  }

  /* Largest remainder, so the four printed integers total exactly 100. */
  let shares = {};
  if (index > 0){
    const exact = {}, floors = {};
    for (const k of Object.keys(contrib)){
      exact[k] = contrib[k] / index * 100;
      floors[k] = Math.floor(exact[k]);
    }
    let left = 100 - Object.values(floors).reduce((a, b) => a + b, 0);
    const order = Object.keys(exact).sort((a, b) => (exact[b] - floors[b]) - (exact[a] - floors[a]));
    shares = { ...floors };
    for (let i = 0; i < left; i++) shares[order[i % order.length]]++;
  } else {
    for (const k of Object.keys(contrib)) shares[k] = 0;
  }

  return { rows: rows.length, scores, contrib, index,
    shares, weights: INDEX_WEIGHTS,
    coverage: { wage: wageCov, rent: rentCov, competition: rows.length, talent: talentCov },
    raw: { wageCut: mean(wageCuts), rentCut: mean(rentCuts),
           contested, attrition: mean(attrition) } };
}

/* ----------------------------------------------------------------- state -- */
let map, selected = null, selectedSr = null, regionFilter = "All", soonOnly = false;

const visible = () => window.DG_FACILITIES.filter(f =>
  (regionFilter === "All" || f.region === regionFilter) &&
  (!soonOnly || (monthsLeft(f.leaseEnd) != null && monthsLeft(f.leaseEnd) <= 24)));
const facsOf = (city) => window.DG_FACILITIES.filter(f => f.city === city);

/* ------------------------------------------------------------------ boot -- */
function boot(){
  const token = window.MAPBOX_TOKEN || "";
  try {
    mapboxgl.accessToken = token;
    map = new mapboxgl.Map({
      container: "map", style: "mapbox://styles/mapbox/dark-v11",
      center: [80.6, 22.4], zoom: 4.2, minZoom: 3.5, maxZoom: 16,
      attributionControl: false, projection: "mercator"
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => { addLayers(); refreshMap(); });
    map.on("error", () => {});
  } catch (e) { map = null; }
  buildFilters(); renderBoard(); showPortfolio(); updateBrand(); updateLegend();
  renderIndex(); wireIndex(); wireResize();
  $("#p-back").addEventListener("click", () => select(null));
}

/* ------------------------------------------------------------- map layers -- */
function siteGeo(){
  /* One feature per building: facilities sharing an address stack onto one pin. */
  const byLoc = {};
  for (const f of visible()){
    const l = locOf(f); if (!l) continue;
    const k = l.lng.toFixed(5) + "," + l.lat.toFixed(5);
    if (!byLoc[k]) byLoc[k] = { loc: l, rows: [] };
    byLoc[k].rows.push(f);
  }
  return { type: "FeatureCollection", features: Object.values(byLoc).map(({ loc, rows }) => {
    const c = window.DG_CITIES[rows[0].city] || {};
    const soonest = rows.map(r => monthsLeft(r.leaseEnd)).filter(v => v != null).sort((a,b)=>a-b)[0];
    return { type: "Feature", geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
      properties: { city: rows[0].city, name: rows.length > 1 ? c.name : rows[0].facility,
        label: c.name || rows[0].location, count: rows.length, tier: c.tier || 2,
        color: TIER_COLOR[c.tier] || "#888", sr: rows[0].sr,
        urgent: soonest != null && soonest <= 12 ? 1 : 0 } };
  }) };
}
function candidateGeo(){
  return { type: "FeatureCollection", features: Object.entries(window.DG_CITIES)
    .filter(([, c]) => c.candidateOnly)
    .map(([k, c]) => ({ type: "Feature", geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: { city: k, name: c.name } })) };
}
function linkGeo(){
  const empty = { type: "FeatureCollection", features: [] };
  if (!selected) return empty;
  const c = window.DG_CITIES[selected];
  if (!c || !c.candidates) return empty;
  return { type: "FeatureCollection", features: c.candidates.map(k => {
    const t = window.DG_CITIES[k]; if (!t) return null;
    return { type: "Feature", geometry: { type: "LineString",
      coordinates: [[c.lng, c.lat], [t.lng, t.lat]] }, properties: {} };
  }).filter(Boolean) };
}

function addLayers(){
  map.addSource("links", { type: "geojson", data: linkGeo() });
  map.addLayer({ id: "links", type: "line", source: "links",
    paint: { "line-color": "#4f9cd9", "line-width": 1.3, "line-dasharray": [2,2], "line-opacity": .7 } });

  map.addSource("cand", { type: "geojson", data: candidateGeo() });
  map.addLayer({ id: "cand", type: "circle", source: "cand",
    paint: { "circle-radius": 4.5, "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#4f9cd9", "circle-stroke-width": 1.5, "circle-opacity": .9 } });
  map.addLayer({ id: "cand-lbl", type: "symbol", source: "cand",
    layout: { "text-field": ["get","name"], "text-size": 10, "text-offset": [0,1.1], "text-anchor": "top",
      "text-font": ["DIN Pro Regular","Arial Unicode MS Regular"] },
    paint: { "text-color": "rgba(150,198,235,.82)", "text-halo-color": "#0b0f16", "text-halo-width": 1.2 } });

  map.addSource("sites", { type: "geojson", data: siteGeo() });
  map.addLayer({ id: "sites-halo", type: "circle", source: "sites",
    filter: ["==", ["get","urgent"], 1],
    paint: { "circle-radius": ["+", 10, ["*", 2, ["get","count"]]], "circle-color": "#e0603a",
      "circle-opacity": .14, "circle-blur": .55 } });
  map.addLayer({ id: "sites", type: "circle", source: "sites",
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"],
        4, ["+", 3.4, ["*", .9, ["get","count"]]],
        11, ["+", 6, ["*", 1.6, ["get","count"]]]],
      "circle-color": ["get","color"], "circle-stroke-color": "#0b0f16", "circle-stroke-width": 1.6,
      "circle-pitch-alignment": "map" } });
  map.addLayer({ id: "sites-lbl", type: "symbol", source: "sites",
    minzoom: 5.2,
    layout: { "text-field": ["get","name"], "text-size": 10.5, "text-offset": [0,1.15], "text-anchor": "top",
      "text-font": ["DIN Pro Medium","Arial Unicode MS Regular"], "text-allow-overlap": false },
    paint: { "text-color": "rgba(255,255,255,.88)", "text-halo-color": "#0b0f16", "text-halo-width": 1.3 } });
  /* Selection is drawn as three concentric layers rather than one stroke:
     a soft halo that lifts the pin off the basemap, a wide translucent collar
     that gives the ring somewhere to sit, and a crisp hairline on the outside.
     The gap between pin and ring is what makes it read as deliberate; a ring
     pressed against the marker just looks like a thick border. */
  const selR = ["+", 15, ["*", 2.2, ["get","count"]]];
  map.addLayer({ id: "sites-sel-halo", type: "circle", source: "sites",
    filter: ["==", ["get","city"], "__none__"],
    paint: { "circle-radius": ["+", selR, 9], "circle-color": "#ffffff",
      "circle-opacity": .10, "circle-blur": .85 } });
  map.addLayer({ id: "sites-sel-collar", type: "circle", source: "sites",
    filter: ["==", ["get","city"], "__none__"],
    paint: { "circle-radius": selR, "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 3, "circle-stroke-opacity": .22 } });
  map.addLayer({ id: "sites-sel", type: "circle", source: "sites",
    filter: ["==", ["get","city"], "__none__"],
    paint: { "circle-radius": ["+", selR, 1.5], "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.75, "circle-stroke-opacity": .95 } });

  for (const id of ["sites","cand"]){
    map.on("click", id, e => select(e.features[0].properties.city));
    map.on("mouseenter", id, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", id, () => map.getCanvas().style.cursor = "");
  }
}
function refreshMap(){
  if (!map || !map.getSource("sites")) return;
  map.getSource("sites").setData(siteGeo());
  map.getSource("links").setData(linkGeo());
  for (const id of ["sites-sel-halo","sites-sel-collar","sites-sel"])
    if (map.getLayer(id)) map.setFilter(id, ["==", ["get","city"], selected || "__none__"]);
}

/* --------------------------------------------------------------- filters -- */
function buildFilters(){
  const wrap = $("#filters"); wrap.innerHTML = "";
  for (const r of ["All","North","South","East","West","Central"]){
    const b = document.createElement("button");
    b.className = "tg" + (r === regionFilter ? " on" : ""); b.textContent = r;
    b.addEventListener("click", () => { regionFilter = r; redraw(); });
    wrap.appendChild(b);
  }
  const s = document.createElement("button");
  s.className = "tg" + (soonOnly ? " on" : ""); s.textContent = "Closing ≤ 24 mo";
  s.addEventListener("click", () => { soonOnly = !soonOnly; redraw(); });
  wrap.appendChild(s);
}
function redraw(){
  buildFilters(); renderBoard(); refreshMap(); updateBrand(); renderIndex();
  if (!selected) showPortfolio();
}

/* ----------------------------------------------------------------- board -- */
function renderBoard(){
  const rows = visible()
    .map(f => ({ f, s: pressureScore(f), m: monthsLeft(f.leaseEnd) }))
    .filter(x => x.s != null)
    .sort((a,b) => b.s - a.s || a.m - b.m);
  $("#board-list").innerHTML = rows.map((x,i) => {
    const c = window.DG_CITIES[x.f.city] || {};
    return `<div class="b-row" data-city="${esc(x.f.city)}" data-sr="${x.f.sr}"
        role="button" tabindex="0" aria-label="${esc(c.name || x.f.location)}, ${esc(x.f.facility)}, tracker row ${x.f.sr}">
      <div class="b-rank" title="Rank ${i+1} by relocation pressure">${i+1}</div>
      <div class="b-main">
        <div class="b-name">${esc(c.name || x.f.location)} · ${esc(x.f.facility)}</div>
        <div class="b-meta"><span class="dot" style="background:${TIER_COLOR[c.tier]||"#888"}"></span>${TIER_NAME[c.tier]||""} · ${esc(x.f.centreType)} · <span class="b-ref">Row ${x.f.sr}</span></div>
      </div>
      <div class="b-score ${scoreBand(x.s)}" title="Relocation pressure ${x.s} of 100">${x.s}</div>
      <div class="b-exp ${expiryClass(x.m)}">${fyLabel(x.f.leaseEnd)}<span class="mo">${x.m} mo</span></div>
    </div>`; }).join("");
  $("#board-foot").textContent = `${rows.length} leased facilities closing FY27 to FY30`
    + (regionFilter !== "All" ? ` · ${regionFilter}` : "")
    + `. Owned sites and open-ended leases are excluded rather than scored.`;
  document.querySelectorAll(".b-row").forEach(el => {
    const go = () => select(el.dataset.city, Number(el.dataset.sr));
    el.addEventListener("click", go);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); go(); } });
  });
  markActive();
}
/* The board lists facilities, so the active row is the facility that was
   picked. Marking by city lit up every row in that city at once, which is what
   made two facilities in one city indistinguishable. */
const markActive = () => document.querySelectorAll(".b-row").forEach(el => {
  const sameCity = el.dataset.city === selected;
  el.classList.toggle("active", sameCity && (selectedSr == null || Number(el.dataset.sr) === selectedSr));
  el.classList.toggle("sibling", sameCity && selectedSr != null && Number(el.dataset.sr) !== selectedSr);
});

/* ------------------------------------------------- portfolio analysis view -- */
function portfolioStats(){
  const F = visible();
  const leased = F.filter(f => f.leaseEnd);
  const byFY = {};
  for (const f of leased){ const y = fyOf(f.leaseEnd); byFY[y] = (byFY[y]||0)+1; }
  const within = (n) => leased.filter(f => monthsLeft(f.leaseEnd) <= n).length;
  const mix = {};
  for (const f of F){ const k = /call/i.test(f.centreType) ? "Call centre"
    : /collection/i.test(f.centreType) ? "Collection centre" : "Training / other";
    mix[k] = (mix[k]||0)+1; }
  const tenure = {};
  for (const f of F){
    const t = /owned/i.test(f.officeType) ? "Owned"
      : /partner|managed office/i.test(f.officeType) ? "Partner-managed" : "Leased direct";
    tenure[t] = (tenure[t]||0)+1; }
  const lessors = {};
  for (const f of F){
    let L = (f.lessor||"").trim();
    if (/^EFC/i.test(L)) L = "EFC Limited";
    else if (/Parsvatech/i.test(L)) L = "Parsvatech Workspaces";
    else if (/Awfis/i.test(L)) L = "Awfis Space Solutions";
    else if (/TATA|Tata/.test(L)) L = "Tata group entities";
    if (!L) continue;
    (lessors[L] = lessors[L] || { n:0, cities:new Set() }); lessors[L].n++; lessors[L].cities.add(f.city);
  }
  const topLessors = Object.entries(lessors).filter(([,v]) => v.n > 1)
    .sort((a,b) => b[1].n - a[1].n).slice(0,5);
  const cities = new Set(F.map(f => f.city));
  /* Canonical state keys, not the tracker's raw spelling: the sheet writes
     both "Telengana"/"Telangana" and "Tamilnadu"/"Tamil Nadu", which would
     otherwise inflate the count. */
  const states = new Set(F.map(f => (window.DG_CITIES[f.city]||{}).stateKey).filter(Boolean));
  return { F, leased, byFY, within, mix, tenure, topLessors, cities, states };
}
/* Highest and lowest statutory floor actually sitting under this portfolio. */
function wageSpread(){
  let hi = null, lo = null;
  for (const f of visible()){
    const c = window.DG_CITIES[f.city]; if (!c) continue;
    const w = wageRow(c.stateKey, c.wageZone); if (!w || w.unskilled == null) continue;
    const rec = { city: c.name, state: c.state, zone: c.wageZone, v: w.unskilled };
    if (!hi || rec.v > hi.v) hi = rec;
    if (!lo || rec.v < lo.v) lo = rec;
  }
  return { hi, lo };
}

function showPortfolio(){
  selected = null; selectedSr = null; markActive(); refreshMap();
  $("#p-back").classList.remove("show");
  $("#p-title").textContent = "Portfolio overview";
  const st = portfolioStats();
  $("#p-sub").textContent = `${st.F.length} facilities · ${st.cities.size} cities · ${st.states.size} states`
    + (regionFilter !== "All" ? ` · ${regionFilter} region` : "") + ` · tracker as on 1 Sep 2026`;

  const n12 = st.within(12), n24 = st.within(24);
  const fys = Object.keys(st.byFY).map(Number).sort((a,b)=>a-b);
  const maxFY = Math.max(...Object.values(st.byFY), 1);
  const ws = wageSpread();

  let h = "";

  /* 1. exposure headline: the number the board reacts to */
  h += `<div class="sec"><h4>Exposure</h4>
    <div class="hero"><div class="big">${n12}</div>
      <div class="cap">leases close within <b>12 months</b>, and ${n24} within 24. Each one is a renew-or-relocate decision that has to be taken before the clock runs out, not after.</div></div>
    <div class="kpis" style="margin-top:9px">
      <div class="kpi"><div class="n">${st.F.length}</div><div class="l">Facilities</div></div>
      <div class="kpi"><div class="n">${st.cities.size}</div><div class="l">Cities</div></div>
      <div class="kpi"><div class="n">${st.leased.length}</div><div class="l">On a dated lease</div></div>
    </div></div>`;

  /* 2. lease expiry profile: single series, one hue, ordered by FY */
  h += `<div class="sec"><h4>Lease expiry profile</h4><div class="chart">`;
  for (const y of fys){
    const v = st.byFY[y], pct = Math.round(v / maxFY * 100);
    h += `<div class="crow"><span class="cl">FY${String(y).slice(2)}</span>
      <span class="ct"><span class="cb" style="width:${pct}%"></span></span>
      <span class="cv">${v}</span></div>`;
  }
  h += `</div><div class="axis">Count of leases ending in each Indian financial year, April to March. The FY27 and FY28 bars are the working agenda; anything beyond FY30 is a watch item.</div></div>`;

  /* 3. what the portfolio is made of */
  const mixColors = { "Call centre":"#e0603a", "Collection centre":"#e0a91f", "Training / other":"#1f8f77" };
  const tenColors = { "Leased direct":"#e0603a", "Partner-managed":"#e0a91f", "Owned":"#1f8f77" };
  const bar = (obj, colors) => {
    const tot = Object.values(obj).reduce((a,b)=>a+b,0) || 1;
    return `<div class="split">${Object.entries(obj).map(([k,v]) =>
      `<i style="width:${v/tot*100}%;background:${colors[k]||"#888"}"></i>`).join("")}</div>
      <div class="legend2">${Object.entries(obj).map(([k,v]) =>
      `<span><span class="dot" style="background:${colors[k]||"#888"}"></span>${esc(k)} <b>${v}</b></span>`).join("")}</div>`;
  };
  h += `<div class="sec"><h4>What the portfolio is</h4>${bar(st.mix, mixColors)}
    <div style="height:11px"></div>${bar(st.tenure, tenColors)}</div>`;

  /* 4. the wage argument, portfolio-wide */
  if (ws.hi && ws.lo){
    const d = ws.hi.v - ws.lo.v;
    h += `<div class="sec"><h4>Statutory wage spread</h4>
      <div class="hero calm"><div class="big">${inr(d)}</div>
      <div class="cap">per employee per month separates the most expensive statutory seat in the portfolio (<b>${esc(ws.hi.city)}</b>, ${esc(ws.hi.state)}${ws.hi.zone && !/statewide/i.test(ws.hi.zone) ? ", " + esc(ws.hi.zone) : ""}, ${inr(ws.hi.v)}) from the cheapest (<b>${esc(ws.lo.city)}</b>, ${esc(ws.lo.state)}, ${inr(ws.lo.v)}). Unskilled floor, shops and establishments schedule.</div></div>
      <div class="note">This is the ceiling on statutory arbitrage, not an achievable saving: work does not move to a city because the floor is lower there. It sets the size of the prize the rest of the analysis argues about. <span class="flag">VALIDATE VS GAZETTE</span></div></div>`;
  }

  /* 5. concentration, a finding that falls out of the lessor column */
  if (st.topLessors.length){
    h += `<div class="sec"><h4>Landlord concentration</h4>
      <div class="para">Facilities are not spread across as many counterparties as they look. These landlords each hold more than one site:</div>
      <div style="margin-top:8px">`;
    for (const [name, v] of st.topLessors){
      h += `<div class="kv"><span class="k">${esc(name)}</span><span class="v">${v.n} sites · ${v.cities.size} ${v.cities.size===1?"city":"cities"}</span></div>`;
    }
    h += `</div><div class="note">A single landlord across several sites is leverage in a renewal negotiation and exposure if that counterparty has a problem. Worth knowing before each lease is negotiated in isolation.</div></div>`;
  }

  /* 6. the shortlist the board should actually discuss */
  const top = visible().map(f => ({ f, s: pressureScore(f), m: monthsLeft(f.leaseEnd) }))
    .filter(x => x.s != null).sort((a,b) => b.s - a.s || a.m - b.m).slice(0,5);
  h += `<div class="sec"><h4>Where the decision is live</h4><div class="movelist">`;
  top.forEach((x,i) => {
    const c = window.DG_CITIES[x.f.city] || {};
    const cand = (c.candidates||[]).map(k => (window.DG_CITIES[k]||{}).name).filter(Boolean);
    h += `<div class="mv"><div class="i">${i+1}</div><div class="c">
      <div class="h" data-city="${esc(x.f.city)}" data-sr="${x.f.sr}">${esc(c.name||x.f.location)} · ${esc(x.f.facility)}</div>
      <div class="d">${esc(x.f.centreType)} in a ${TIER_NAME[c.tier]||"tier"} city. Lease ends <b>${dmy(x.f.leaseEnd)}</b>, ${x.m} months out.${cand.length ? ` Options on the table: ${cand.map(esc).join(", ")}.` : ""}</div>
    </div></div>`;
  });
  h += `</div></div>`;

  /* Movement strategy: the same facilities, grouped by how much runway each
     one still has. Horizon decides posture; the pressure board decides order. */
  const horizons = [
    { k:"now",  lo:-999, hi:12, t:"Decide now",              c:"#e0603a",
      p:"Inside one year. Too late to run a site search, shortlist, fit-out and migration in sequence, so each of these is either a renewal on better terms or a consolidation into space the group already holds. Treat a new city here as the exception, not the plan." },
    { k:"plan", lo:13,   hi:24, t:"Plan now, move next year", c:"#e0a91f",
      p:"Twelve to twenty-four months. This is the window where a relocation is actually deliverable: enough runway to validate a candidate city on the ground, negotiate, fit out and migrate without paying for two sites for long. This is where the wage and rent arbitrage gets captured." },
    { k:"opt",  lo:25,   hi:51, t:"Option window",            c:"#1f8f77",
      p:"Two to four years out. Nothing forces a decision, which makes these the cheapest places to experiment: pilot a tier-2 or tier-3 site now against one of these leases and the result is evidence by the time the lease actually closes." }
  ];
  const rowsH = visible().map(f => ({ f, m: monthsLeft(f.leaseEnd), s: pressureScore(f) }))
    .filter(x => x.s != null);
  h += `<div class="sec"><h4>Movement strategy</h4>`;
  for (const hz of horizons){
    const set = rowsH.filter(x => x.m >= hz.lo && x.m <= hz.hi);
    if (!set.length) continue;
    const cities = [...new Set(set.map(x => (window.DG_CITIES[x.f.city]||{}).name || x.f.location))];
    const calls = set.filter(x => /call/i.test(x.f.centreType)).length;
    h += `<div style="margin-bottom:12px">
      <div style="display:flex;align-items:baseline;gap:8px">
        <span class="dot" style="background:${hz.c};width:8px;height:8px"></span>
        <span style="font-size:12px;font-weight:700">${hz.t}</span>
        <span style="font-size:10px;color:var(--dim);font-family:var(--num)">${set.length} facilities · ${calls} call centre${calls===1?"":"s"}</span>
      </div>
      <div class="para" style="margin-top:5px">${hz.p}</div>
      <div class="note"><b style="color:var(--mut)">Sites:</b> ${cities.map(esc).join(", ")}.</div>
    </div>`;
  }
  h += `<div class="note">Horizon sets the posture, the pressure board above sets the order within each horizon. Anything closing beyond FY30 is deliberately left out: a decision taken now against a 2034 lease is a guess.</div></div>`;

  /* The incentive map does not agree with the wage map, and that is the point
     of putting it on the same screen. */
  h += `<div class="sec"><h4>What the incentive map changes</h4>
    <div class="para">States pay employers to open delivery centres, and several pay materially more outside their own capital. That money offsets one-off move cost, which is the number a relocation case usually loses on. Three findings change the shortlist before any of the detail matters.</div>
    <div class="movelist" style="margin-top:10px">

      <div class="mv"><div class="i" style="background:#e0603a">1</div><div class="c">
        <div class="h" data-city="kolkata">West Bengal is currently the weakest, not the strongest</div>
        <div class="d">The Revocation of West Bengal Incentive Schemes Act 2025 retrospectively cancelled the schemes that IT and ITeS units draw their cash incentives from, and the Act is under challenge in the Calcutta High Court. What is left is a property tax exemption and extra floor area, no cash. A successor policy worth about ₹5,000 crore was expected around Oct 2026, with an IT park at Siliguri and a unit at Durgapur named in budget papers. <b>Do not underwrite a Durgapur or Siliguri move on 2018-policy language.</b> Wait for the new notification and negotiate a bespoke package.</div>
      </div></div>

      <div class="mv"><div class="i" style="background:#e0a91f">2</div><div class="c">
        <div class="h" data-city="noida">The ₹1 lakh per seat central subsidy no longer exists</div>
        <div class="d">The India BPO Promotion Scheme closed to claims in Aug 2024 and has no BPO-specific successor. The live central instrument pays up to ₹3,000 per employee per month for two years, but it is <b>additive against the employer's national headcount baseline, not per site</b>. Seats merely moved out of a metro generate little or no benefit. If this is in a business case as a relocation saving, it is wrong. Uttar Pradesh's own policy also still ties its per-seat BPO subsidy to the dead scheme, which Invest UP needs to confirm.</div>
      </div></div>

      <div class="mv"><div class="i" style="background:#1f8f77">3</div><div class="c">
        <div class="h" data-city="indore">The best per-head money is where Digitide already operates</div>
        <div class="d">Punjab pays a reported ₹5,000 per employee per month for five years, and Madhya Pradesh ₹4,000 to ₹5,000 per employee per month for three years plus up to ₹3,000 per seat per month of rent. Digitide already holds Mohali in Punjab and Indore and Chhindwara in MP. <b>Scaling an existing site may beat opening a new one</b>, because the incentive is the same and the setup risk is gone. Both figures are press-sourced and need gazette verification before they reach a model, and Punjab's reported ₹25 crore investment floor may exclude a seat-leased centre entirely.</div>
      </div></div>

    </div>
    <div class="note">One trap worth naming: Tamil Nadu's headline payroll subsidy of 30, 20 and 10 percent applies only to roles paying at least ₹1 lakh a month, so it excludes every voice agent. It looks generous in a summary and is worth nothing to this portfolio.</div>
    <div class="note">Government policy documents were not reachable from the research environment, so entries marked press-sourced rest on advisory and press summaries. Each names the specific figure to check against the gazette. Open any location to see its state's position in full.</div>
  </div>`;

  /* Pin precision, stated at portfolio level so a coarse pin is never a surprise */
  const gp = {};
  for (const f of window.DG_FACILITIES){
    const g = window.DG_GEO && window.DG_GEO[f.sr];
    const sp = scoreParts(f);
    const k = g ? g.precision : "city";
    gp[k] = (gp[k]||0) + 1;
  }
  const precOrder = ["building","street","locality","city"];
  const precLabel = { building:"Pinned to the building", street:"Pinned to the street or plot",
    locality:"Pinned to the locality or sector", city:"City centroid only" };
  h += `<div class="sec"><h4>Map precision</h4>`;
  for (const k of precOrder) if (gp[k])
    h += `<div class="kv"><span class="k">${precLabel[k]}</span><span class="v">${gp[k]}</span></div>`;
  h += `<div class="note">Every facility card states which of these its own pin carries. A coarse pin is shown as coarse rather than nudged onto a nearby building, because a pin that looks exact and is not is worse than one that admits it.</div></div>`;

  /* Tracker discrepancies found while locating each building. Surfaced, never
     written back: facilities.js stays the client's data as given. */
  const dq = window.DG_DATAQUALITY || [];
  if (dq.length){
    const sev = { fix:"#e0603a", check:"#e0a91f", note:"#1f8f77" };
    const sevLabel = { fix:"FIX", check:"CHECK", note:"NOTE" };
    const nFix = dq.filter(d => d.severity === "fix").length;
    h += `<div class="sec"><h4>Tracker data quality</h4>
      <div class="para">Locating each building against public records turned up <b>${dq.length} discrepancies</b> in the tracker itself, ${nFix} of them plain errors. None changes the analysis. All of them would be noticed by anyone who cross-checked a slide.</div>
      <div style="margin-top:10px">`;
    for (const d of dq){
      h += `<div class="fac" style="border-left:2px solid ${sev[d.severity]}">
        <div class="fn"><span>${esc(d.site)}</span><span class="sr">#${d.sr.join(", #")}</span></div>
        <div class="row2" style="margin-top:5px">
          <span class="pill" style="background:${sev[d.severity]}22;color:${sev[d.severity]}">${sevLabel[d.severity]}</span>
          <span class="pill">${esc(d.field)}</span></div>
        <div class="addr" style="margin-top:6px">Tracker says <b style="color:var(--mut)">${esc(d.tracker)}</b>. Public records say <b style="color:#fff">${esc(d.found)}</b>.</div>
        <div class="addr" style="margin-top:4px">${esc(d.why)}</div></div>`;
    }
    h += `</div><div class="note">These are reported, not applied. The facility data in this tool is still the tracker exactly as supplied, so nothing here has been quietly rewritten underneath you.</div></div>`;
  }

  h += `<div class="sec"><h4>How to read this</h4>
    <div class="para">Facility rows, addresses, lessors and lease dates come from the Digitide tracker and are reproduced as given. Wage floors are the latest notified state rates. Rents are quoted market ranges. Talent and competitor figures are <span class="flag ind">INDICATIVE</span> planning bands, there to make thirty cities comparable on one yardstick, and are not audited.</div>
    <div class="note">${esc(window.DG_META.disclaimer)}</div></div>`;

  $("#p-body").innerHTML = h;
  $("#p-body").scrollTop = 0;
  $("#p-body").querySelectorAll(".mv .h").forEach(el =>
    el.addEventListener("click", () => select(el.dataset.city, Number(el.dataset.sr))));
}

/* ------------------------------------------------------------- city view -- */
function select(city, sr){
  if (!city){ showPortfolio(); return; }
  const c = window.DG_CITIES[city]; if (!c) return;
  selected = city; selectedSr = sr != null ? Number(sr) : null;
  markActive(); refreshMap();
  renderCity(city, c, selectedSr);
  /* Camera moves are motion too: honour the system setting rather than
     assuming everyone can tolerate a 900 ms fly-through. */
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const f = selectedSr != null && window.DG_FACILITIES.find(x => x.sr === selectedSr);
  const loc = f ? locOf(f) : null;
  if (map) map.flyTo({ center: loc ? [loc.lng, loc.lat] : [c.lng, c.lat],
    zoom: Math.max(map.getZoom(), loc && loc.precision === "building" ? 14 : 11),
    duration: reduced ? 0 : 900, essential: true });
}

function wageTable(c){
  const w = window.DG_WAGES[c.stateKey];
  if (!w) return `<div class="note">No wage record loaded for ${esc(c.state)}.</div>`;
  const lvls = ["unskilled","semiSkilled","skilled","highlySkilled"];
  const head = { unskilled:"Unskilled", semiSkilled:"Semi", skilled:"Skilled", highlySkilled:"Highly sk." };
  const used = lvls.filter(l => Object.values(w.zones).some(z => z[l] != null));
  let t = `<table class="t"><tr><th>Zone</th>${used.map(l=>`<th>${head[l]}</th>`).join("")}</tr>`;
  for (const [name,z] of Object.entries(w.zones))
    t += `<tr class="${name===c.wageZone?"cur":""}"><td>${esc(name)}</td>${used.map(l =>
      `<td>${z[l]!=null?inr(z[l]):"n/a"}</td>`).join("")}</tr>`;
  t += `</table><div class="note">${esc(w.zoneDefinition||"")}. ${esc(w.state)}, shops and establishments schedule, effective ${esc(dmyIn(w.effective||"n/a"))}. Monthly floors including VDA.
    ${w.srcUrl ? "Source: " + cite(w.srcUrl) + "." : ""} <span class="flag">VALIDATE VS GAZETTE</span></div>`;
  if (w.note) t += `<div class="note">${esc(w.note)}</div>`;
  return t;
}

function candidateCard(c, key){
  const t = window.DG_CITIES[key]; if (!t) return "";
  const cw = wageRow(c.stateKey, c.wageZone), tw = wageRow(t.stateKey, t.wageZone);
  let wage = "Statutory comparison unavailable for this pair.";
  if (cw && tw && cw.unskilled != null && tw.unskilled != null){
    const d = cw.unskilled - tw.unskilled;
    const ds = (cw.skilled != null && tw.skilled != null) ? cw.skilled - tw.skilled : null;
    wage = d > 0 ? `Statutory floor <b class="delta-pos">${inr(d)} per employee per month lower</b> on unskilled${ds!=null?`, ${inr(ds)} lower on skilled`:""}.`
      : d < 0 ? `Statutory floor <b class="delta-neg">${inr(Math.abs(d))} higher</b>. The case here is market wages and rent, not the statutory floor.`
      : `<b>Same statutory floor</b>${t.stateKey===c.stateKey?" (same state and zone class)":""}. Any saving comes from market wages, churn and rent, not the wage schedule.`;
  }
  let rent = "";
  const a = rentMid(c.rent), b = rentMid(t.rent);
  if (a != null && b != null){
    const pct = Math.round((a - b) / a * 100);
    rent = `<div class="cm">Rent <b>₹${t.rent.low} to ₹${t.rent.high}</b> per sq ft per month against <b>₹${c.rent.low} to ₹${c.rent.high}</b> here, about <b class="${pct>0?"delta-pos":"delta-neg"}">${Math.abs(pct)}% ${pct>0?"lower":"higher"}</b> on the quoted midpoints.</div>`;
  } else if (t.rent && t.rent.low == null){
    rent = `<div class="cm">No published office market for ${esc(t.name)}. Rent to be established by a local broker check.</div>`;
  }
  const tt = window.DG_TALENT[key];
  const talent = tt ? `<div class="cm">Indicative: agent gross ${inr(tt.salary[0])} to ${inr(tt.salary[1])}, attrition ${esc(tt.attrition)}, competing employers ${esc(tt.compCount)}.</div>` : "";
  const ti = window.DG_INCENTIVES[t.stateKey];
  const incLine = ti
    ? (ti.perHead
        ? `<div class="cm"><b>Incentive:</b> ${esc(ti.perHead)} under ${esc(ti.policy)}.${ti.confidence !== "verified" ? " Press-sourced, verify before modelling." : ""}</div>`
        : `<div class="cm"><b>Incentive:</b> no claimable per-head cash today. ${esc(ti.risk || "")}</div>`)
    : "";
  return `<div class="cand"><div class="cn"><span>${esc(t.name)}, ${esc(t.state)}</span>
      <span style="color:${TIER_COLOR[t.tier]};font-size:10.5px">${TIER_NAME[t.tier]}</span></div>
    <div class="cm">${wage}</div>${rent}${talent}${incLine}
    ${t.catchment ? `<div class="cm">${esc(t.catchment)}</div>` : ""}</div>`;
}

function renderCity(key, c, focusSr){
  $("#p-back").classList.add("show");
  $("#p-title").innerHTML = `${esc(c.name)}<span class="tierchip" style="background:${TIER_COLOR[c.tier]}22;color:${TIER_COLOR[c.tier]}">${TIER_NAME[c.tier]}</span>`;
  const facs = facsOf(key);
  $("#p-sub").textContent = `${c.state} · ${facs.length} facilit${facs.length===1?"y":"ies"} · wage zone ${c.wageZone}`
    + (c.market ? ` · ${c.market}` : "");
  const tt = window.DG_TALENT[key];
  let h = "";

  /* facilities held here */
  h += `<div class="sec"><h4>Facilities here</h4>`;
  for (const f of facs.sort((a,b) => (monthsLeft(a.leaseEnd) ?? 9999) - (monthsLeft(b.leaseEnd) ?? 9999))){
    const m = monthsLeft(f.leaseEnd);
    const g = window.DG_GEO && window.DG_GEO[f.sr];
    const sp = scoreParts(f);
    const pill = f.leaseEnd == null
      ? `<span class="pill ok">Owned, no end date</span>`
      : `<span class="pill ${m<=12?"hot":m<=24?"warm":"ok"}">Lease ends ${dmy(f.leaseEnd)} · ${m} mo</span>`;
    h += `<div class="fac${m!=null&&m<=12?" urgent":""}${f.sr===focusSr?" focused":""}" id="fac-${f.sr}"
        data-sr="${f.sr}" role="button" tabindex="0"
        aria-label="${esc(f.facility)}, tracker row ${f.sr}. Select to locate on the map.">
      <div class="fn"><span>${esc(f.facility)}</span>${sp ? `<span class="fscore ${scoreBand(sp.total)}" title="Relocation pressure ${sp.total} of 100">${sp.total}</span>` : ``}</div>
      <div class="addr">${esc(f.address)}</div>
      <div class="row2">${pill}<span class="pill">${esc(f.centreType)}</span><span class="pill">${esc(f.officeType)}</span>
        <span class="pill">Lessor: ${esc(f.lessor.length>32?f.lessor.slice(0,30)+"…":f.lessor)}</span>
        ${g ? `<span class="pill">Pin: ${esc(g.precision)}${g.confidence === "verified" ? " · verified" : ""}</span>` : `<span class="pill">Pin: city</span>`}</div>
      ${f.sr === focusSr ? `<div class="facdet">
        ${sp ? `<div class="scorebox">
          <div class="sb-h">Relocation pressure <b>${sp.total}</b> <span>of 100</span></div>
          ${Object.entries(SCORE_PARTS).map(([k, meta]) => `
            <div class="sb-r"><span class="sb-l">${meta.label}<small>${meta.of}</small></span>
              <span class="sb-t"><span class="sb-f" style="width:${sp[k] / meta.max * 100}%"></span></span>
              <span class="sb-v">${sp[k]}<span>/${meta.max}</span></span></div>`).join("")}
          <div class="sb-tot"><span>Total</span><span class="sb-v">${sp.total}<span>/100</span></span></div>
          <div class="note">Urgency is the only part that is a deadline. The other two say how much is at stake if the deadline is missed, not how bad the site is.</div>
        </div>` : `<div class="note">No dated lease, so no relocation pressure score. Nothing here is on a clock.</div>`}
        <div class="kv"><span class="k">Region · state</span><span class="v" style="font-family:var(--font)">${esc(f.region)} · ${esc(f.state)}</span></div>
        <div class="kv"><span class="k">Lease term</span><span class="v">${f.leaseStart ? dmy(f.leaseStart) + " to " + dmy(f.leaseEnd) : "Owned, no dated term"}</span></div>
        ${m != null ? `<div class="kv"><span class="k">Runs out in</span><span class="v ${m<=12?"delta-neg":""}">${m} months · ${fyLabel(f.leaseEnd)}</span></div>` : ""}
        <div class="kv"><span class="k">Lessor</span><span class="v" style="font-family:var(--font);max-width:62%">${esc(f.lessor)}</span></div>
        <div class="kv"><span class="k">Lessee on record</span><span class="v" style="font-family:var(--font)">${esc(f.lessee)}</span></div>
        <div class="kv"><span class="k">Tenure</span><span class="v" style="font-family:var(--font)">${esc(f.officeType)}</span></div>
        ${g ? `<div class="kv"><span class="k">Coordinate</span><span class="v">${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}</span></div>` : ""}
        ${g && g.source ? `<div class="note">Pin located to ${esc(g.precision)} level. Source: ${linkify(g.source)}</div>` : ""}
        ${g && g.notes ? `<div class="note">${linkify(g.notes)}</div>` : ""}
      </div>` : (g && g.source ? `<div class="addr" style="margin-top:6px;color:var(--dim)">Pin: ${esc(g.precision)}</div>` : "")}</div>`;
  }
  h += `</div>`;

  h += `<div class="sec"><h4>Zone-wise minimum wage</h4>${wageTable(c)}</div>`;

  /* real estate */
  h += `<div class="sec"><h4>Real estate</h4>`;
  if (c.rent && c.rent.low != null){
    h += `<div class="kv"><span class="k">${esc(c.market||c.name)}${c.rent.grade?" · Grade "+esc(c.rent.grade):""}</span><span class="v">₹${c.rent.low} to ₹${c.rent.high} /sq ft/mo</span></div>
      <div class="note">${esc(c.rent.note||"")} Quoted range as of ${esc(c.rent.asOf||"n/a")}.
        ${c.rent.srcUrl ? "Source: " + cite(c.rent.srcUrl) + "." : ""} <span class="flag">BROKER-CHECK BEFORE COMMIT</span></div>`;
  } else {
    h += `<div class="note">No published office market data for this location. To be established by a local broker check before any commitment.</div>`;
  }
  h += `</div>`;

  /* what the state pays you to be there: the leg that offsets move cost */
  const inc = window.DG_INCENTIVES[c.stateKey], cen = window.DG_INCENTIVES.central;
  if (inc){
    const conf = inc.confidence === "verified"
      ? `<span class="pill ok">Government or Big-4 sourced</span>`
      : `<span class="pill warm">Press / advisory sourced</span>`;
    h += `<div class="sec"><h4>Government incentives</h4>
      <div class="kv"><span class="k">Policy</span><span class="v" style="font-family:var(--font);text-align:right">${esc(inc.policy)}</span></div>
      ${inc.perHead ? `<div class="kv"><span class="k">Per-head cash</span><span class="v">${esc(inc.perHead)}</span></div>` : ""}
      <div class="kv"><span class="k">Valid</span><span class="v" style="font-family:var(--font)">${esc(dmyIn(inc.validTill||"not stated"))}</span></div>
      <div class="para" style="margin-top:9px"><b>Tier bias.</b> ${esc(inc.tierBias)}</div>
      <ul style="margin:9px 0 0;padding-left:16px;font-size:10.5px;color:var(--mut);line-height:1.6">
        ${inc.items.map(i => `<li style="margin-bottom:4px">${esc(i)}</li>`).join("")}</ul>
      <div class="row2" style="margin-top:9px">${conf}${inc.srcUrl ? `<span class="pill">Source: ${cite(inc.srcUrl)}</span>` : ""}</div>
      ${inc.risk ? `<div class="note" style="color:#ffb09b;margin-top:9px"><b>Risk.</b> ${esc(inc.risk)}</div>` : ""}
      ${inc.verify ? `<div class="note"><b style="color:var(--mut)">Verify before modelling.</b> ${esc(inc.verify)}</div>` : ""}
      <div class="note" style="margin-top:9px"><b style="color:var(--mut)">Central, on top.</b> ${esc(cen.perHead)}, ${esc(dmyIn(cen.validTill))}. ${esc(cen.risk)} Source: ${cite(cen.srcUrl)}.</div>
    </div>`;
  }

  /* competitors, with indicative density */
  h += `<div class="sec"><h4>Competitor analysis</h4>
    <div class="kv"><span class="k">Hiring-pool contest</span><span class="v">${esc((c.presence||"unassessed").toUpperCase())}</span></div>
    ${tt ? `<div class="kv"><span class="k">Organised BPO / BPM employers in catchment <span class="flag ind">IND</span></span><span class="v">${esc(tt.compCount)}</span></div>` : ""}
    <div class="chips2">${(c.players||[]).map(p=>`<span class="pl">${esc(p)}</span>`).join("") || `<span class="note">None mapped in this catchment.</span>`}</div>
    <div class="note">Presence means operating delivery or collection centres competing for the same agents. It cuts both ways: a busy market proves the labour model works and bids up the price of holding onto people.</div></div>`;

  /* talent catchment, indicative bands */
  if (tt){
    h += `<div class="sec"><h4>Talent catchment <span class="flag ind">INDICATIVE</span></h4>
      <div class="kv"><span class="k">Addressable entry-level pool</span><span class="v">${esc(tt.pool)}</span></div>
      <div class="kv"><span class="k">Annual graduate output, catchment</span><span class="v">${esc(tt.grads)}</span></div>
      <div class="kv"><span class="k">Business-English readiness</span><span class="v">${esc(tt.english)}</span></div>
      <div class="kv"><span class="k">Annualised voice attrition</span><span class="v">${esc(tt.attrition)}</span></div>
      <div class="kv"><span class="k">Entry agent gross, monthly</span><span class="v">${inr(tt.salary[0])} to ${inr(tt.salary[1])}</span></div>
      ${c.catchment ? `<div class="para" style="margin-top:9px">${esc(c.catchment)}</div>` : ""}
      <div class="note">Planning bands, not audited figures. They exist so thirty cities can be compared on one yardstick; confirm against your own hiring data for any city that reaches a shortlist.</div></div>`;
  }

  if (c.candidates && c.candidates.length)
    h += `<div class="sec"><h4>Movement options</h4>${c.candidates.map(k => candidateCard(c,k)).join("")}</div>`;
  if (c.strategy)
    h += `<div class="sec"><h4>The call</h4><div class="para">${c.strategy}</div></div>`;

  $("#p-body").innerHTML = h;
  $("#p-body").scrollTop = 0;
  /* Clicking a facility card selects that facility: it becomes the focused one,
     the map goes to its own coordinate, and the board row for it lights up. */
  $("#p-body").querySelectorAll(".fac[data-sr]").forEach(el => {
    const go = () => select(key, Number(el.dataset.sr));
    el.addEventListener("click", go);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); go(); } });
  });
  if (focusSr){
    const el = document.getElementById("fac-" + focusSr);
    if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
  }
}

/* ------------------------------------------------------- index rendering -- */
const FACTOR_META = {
  wage:        { label:"Statutory wage headroom", color:"#e0603a",
                 how:"Mean cut available on the unskilled floor, against the cheapest zone in the same state or a named candidate" },
  rent:        { label:"Real estate headroom",    color:"#e0a91f",
                 how:"Mean cut available on quoted rent per sq ft, against the cheapest candidate market" },
  competition: { label:"Competitor pressure",     color:"#4f9cd9",
                 how:"Share of these facilities sitting in high or very high competitor density catchments" },
  talent:      { label:"Talent churn and cost",   color:"#1f8f77",
                 how:"Mean annualised voice attrition of the catchments these facilities sit in" }
};

function renderIndex(){
  const r = portfolioIndex();
  const n = Math.round(r.index);
  $("#idx-n").textContent = n;
  $("#idx-bar").innerHTML = Object.keys(FACTOR_META)
    .map(k => `<i style="width:${r.shares[k]}%;background:${FACTOR_META[k].color}"></i>`).join("");
  $("#idx-pill").setAttribute("title", `Portfolio index ${n} of 100. Click for the breakdown.`);

  const sumShares = Object.values(r.shares).reduce((a,b)=>a+b,0);
  const sumW = Object.values(r.weights).reduce((a,b)=>a+b,0);
  const rows = Object.keys(FACTOR_META).map(k => {
    const m = FACTOR_META[k];
    return `<div class="fr">
      <span class="sw" style="background:${m.color}"></span>
      <span class="nm">${m.label}<small>${m.how}. ${r.coverage[k]} of ${r.rows} facilities carry the data.</small></span>
      <span class="sc">${r.scores[k].toFixed(0)} <span style="color:var(--dim);font-size:9px">/100</span></span>
      <span class="sh" style="color:${m.color}">${r.shares[k]}%</span>
    </div>`;
  }).join("");

  $("#idx-pop").innerHTML = `
    <h5>Portfolio index ${n} <span style="color:var(--dim);font-weight:400;font-size:11px">of 100</span></h5>
    <div class="lede">How much room there is to improve, across the ${r.rows} facilities with a live decision${regionFilter!=="All"?` in ${esc(regionFilter)}`:""}. Higher means more headroom, not worse performance. The right-hand column is each leg's share of that total, and the four shares add to 100 by construction.</div>
    <div class="frh"><span></span><span>Factor</span><span>Score</span><span>Share</span></div>
    ${rows}
    <div class="frt"><span></span><span>Total</span><span class="sc">${n}</span><span class="sh">${sumShares}%</span></div>
    <div class="note">Weights are a stated judgement: wage ${r.weights.wage}, real estate ${r.weights.rent}, competition ${r.weights.competition}, talent ${r.weights.talent}, totalling ${sumW}. Each factor's share is its score times its weight, divided by the index. Shares are rounded by largest remainder so the printed figures total exactly 100 rather than 99 or 101.</div>
    <div class="note">Underlying means: ${r.raw.wageCut.toFixed(1)}% statutory cut available, ${r.raw.rentCut.toFixed(1)}% rent cut available, ${r.raw.contested} of ${r.rows} facilities in contested catchments, ${r.raw.attrition.toFixed(0)}% mean attrition.</div>
    <div class="note">Scores are those means placed on a stated scale: a 25% statutory cut scores 100, an 80% rent cut scores 100, competitor pressure is already a percentage so it is used as is, and attrition runs 15% for 0 to 65% for 100. Change a scale and only the scores move; the shares still total 100.</div>`;

  /* If either total ever drifts, say so on screen rather than print a wrong
     number quietly. */
  if (sumShares !== 100 || sumW !== 100)
    $("#idx-pop").innerHTML += `<div class="note" style="color:#ffb09b">Totals check failed: shares ${sumShares}, weights ${sumW}. Do not use these figures.</div>`;
  return r;
}

function wireIndex(){
  const pill = $("#idx-pill"), pop = $("#idx-pop");
  const close = () => { pop.classList.remove("show"); pill.setAttribute("aria-expanded","false");
    setTimeout(() => { if (!pop.classList.contains("show")) pop.hidden = true; }, 180); };
  const open = () => { pop.hidden = false; requestAnimationFrame(() => pop.classList.add("show"));
    pill.setAttribute("aria-expanded","true"); };
  pill.addEventListener("click", e => {
    e.stopPropagation();
    pop.classList.contains("show") ? close() : open();
  });
  document.addEventListener("click", e => {
    if (pop.classList.contains("show") && !pop.contains(e.target) && e.target !== pill) close();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}

/* ------------------------------------------------------ resizable panes -- */
function wireResize(){
  const MIN = { board: 240, panel: 340 }, MAX = { board: 560, panel: 760 };
  const varOf = { board: "--board-w", panel: "--panel-w" };
  const root = document.documentElement;

  /* restore, clamped, because a width saved on a wide screen must not swallow
     a narrow one */
  for (const k of ["board","panel"]){
    const v = Number(localStorage.getItem("dg-w-" + k));
    if (v) setW(k, v);
  }
  function setW(k, px){
    const cap = Math.min(MAX[k], Math.max(MIN[k], px), window.innerWidth * 0.45);
    root.style.setProperty(varOf[k], Math.round(cap) + "px");
    try { localStorage.setItem("dg-w-" + k, String(Math.round(cap))); } catch (e) {}
    return cap;
  }
  document.querySelectorAll(".grip").forEach(g => {
    const k = g.dataset.grip;
    g.addEventListener("pointerdown", e => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = document.getElementById(k).getBoundingClientRect().width;
      document.body.classList.add("resizing");
      g.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const d = ev.clientX - startX;
        setW(k, k === "board" ? startW + d : startW - d);   // panel grows leftward
        if (map) map.resize();
      };
      const up = () => {
        document.body.classList.remove("resizing");
        g.removeEventListener("pointermove", move);
        g.removeEventListener("pointerup", up);
        g.removeEventListener("pointercancel", up);
      };
      g.addEventListener("pointermove", move);
      g.addEventListener("pointerup", up);
      g.addEventListener("pointercancel", up);
    });
    /* keyboard: the grip is a real control, so arrows resize it too */
    g.addEventListener("keydown", e => {
      const step = e.shiftKey ? 48 : 16;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const w = document.getElementById(k).getBoundingClientRect().width;
      const d = (e.key === "ArrowRight" ? step : -step) * (k === "board" ? 1 : -1);
      setW(k, w + d);
      if (map) map.resize();
    });
  });
}

/* ------------------------------------------------------------------ misc -- */
function updateBrand(){
  const F = visible();
  $("#brand-sub").textContent = `${F.length} facilities · ${new Set(F.map(f=>f.city)).size} cities · tracker as on 1 Sep 2026`
    + (regionFilter !== "All" ? ` · ${regionFilter}` : "") + (soonOnly ? " · closing within 24 months" : "");
}
function updateLegend(){
  const g = window.DG_GEO || {};
  const n = window.DG_FACILITIES.filter(f => g[f.sr]).length;
  const el = $("#legend-geo");
  if (!el) return;
  /* Say what is actually true: "pinned" covers four precision classes and
     lumping them together would overstate the map. */
  const exact = window.DG_FACILITIES.filter(f => g[f.sr] &&
    (g[f.sr].precision === "building" || g[f.sr].precision === "street")).length;
  el.textContent = "Pin size = facilities at that site";
}

/* Everything above is declared before the gate runs. Booting any earlier put
   boot() inside the temporal dead zone of the state bindings and blanked the
   page for anyone who reloaded after signing in. */
initGate();
