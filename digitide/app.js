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

/* Access gate. Client-side demo gate, same pattern as clients/manifest.js.
   Placeholder passcode: rotate before the link is shared. */
const GATE = { id: "DIGGRPACC", pass: "DGRP1234" };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const inr = (n) => n == null ? "n/a" : "₹" + Math.round(n).toLocaleString("en-IN");
const TODAY = new Date();
const TIER_COLOR = { 1: "#e0603a", 2: "#e0a91f", 3: "#1f8f77" };
const TIER_NAME  = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };
const SEAT_SQFT = 50;   // stated assumption for per-seat rent maths, shown wherever used

/* ------------------------------------------------------------------ gate -- */
(function gate(){
  const go = () => {
    const id = $("#g-id").value.trim().toUpperCase(), pw = $("#g-pw").value;
    if (id === GATE.id && pw === GATE.pass) {
      sessionStorage.setItem("dg-auth", "1"); $("#gate").remove(); boot();
    } else $("#g-err").textContent = "Not recognised. Access is issued per person.";
  };
  if (sessionStorage.getItem("dg-auth") === "1") { $("#gate").remove(); boot(); return; }
  $("#g-go").addEventListener("click", go);
  $("#gate").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
})();

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
const expiryClass = (m) => m == null ? "exp-ok" : m <= 12 ? "exp-red" : m <= 24 ? "exp-amber" : "exp-ok";

function wageRow(stateKey, zone){
  const w = window.DG_WAGES[stateKey];
  return w && w.zones ? w.zones[zone] || null : null;
}
function perSeatRent(rent){
  return (rent && rent.low != null) ? Math.round(((rent.low + rent.high) / 2) * SEAT_SQFT) : null;
}
/* Indicative direct cost of one seat per month: the rent that seat occupies
   plus the midpoint entry agent gross. It is deliberately only those two
   lines, because they are the two the location decision actually moves.
   It is NOT a loaded cost: no supervision, no telecom, no facilities opex,
   no attrition replacement. Comparable across cities, not a budget figure. */
function seatCost(cityKey){
  const c = window.DG_CITIES[cityKey], t = window.DG_TALENT[cityKey];
  if (!c || !t) return null;
  const rent = perSeatRent(c.rent);
  const pay = Math.round((t.salary[0] + t.salary[1]) / 2);
  return { rent, pay, total: rent != null ? rent + pay : null };
}
/* Where a facility sits on the map. Building coordinate when geo.js has one,
   otherwise the city centroid, and the pin says which it is. */
function locOf(f){
  const g = window.DG_GEO && window.DG_GEO[f.sr];
  if (g) return { lng: g.lng, lat: g.lat, precision: g.precision, source: g.source };
  const c = window.DG_CITIES[f.city];
  return c ? { lng: c.lng, lat: c.lat, precision: "city", source: "city centroid" } : null;
}
function pressureScore(f){
  const m = monthsLeft(f.leaseEnd);
  if (m == null) return null;                       // owned, or no end date recorded
  let s = m <= 6 ? 55 : m <= 12 ? 48 : m <= 18 ? 40 : m <= 24 ? 32 : m <= 36 ? 20 : m <= 51 ? 10 : 0;
  if (s === 0) return null;                          // beyond the FY30 window
  const c = window.DG_CITIES[f.city];
  s += c ? (c.tier === 1 ? 25 : c.tier === 2 ? 12 : 4) : 0;
  s += /call/i.test(f.centreType) ? 15 : /collection/i.test(f.centreType) ? 6 : 2;
  return Math.min(100, s);
}

/* ----------------------------------------------------------------- state -- */
let map, selected = null, regionFilter = "All", soonOnly = false;

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
      "circle-color": ["get","color"], "circle-stroke-color": "#0b0f16", "circle-stroke-width": 1.3 } });
  map.addLayer({ id: "sites-lbl", type: "symbol", source: "sites",
    minzoom: 5.2,
    layout: { "text-field": ["get","name"], "text-size": 10.5, "text-offset": [0,1.15], "text-anchor": "top",
      "text-font": ["DIN Pro Medium","Arial Unicode MS Regular"], "text-allow-overlap": false },
    paint: { "text-color": "rgba(255,255,255,.88)", "text-halo-color": "#0b0f16", "text-halo-width": 1.3 } });
  map.addLayer({ id: "sites-sel", type: "circle", source: "sites",
    filter: ["==", ["get","city"], "__none__"],
    paint: { "circle-radius": ["+", 9, ["*", 1.8, ["get","count"]]], "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } });

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
  map.setFilter("sites-sel", ["==", ["get","city"], selected || "__none__"]);
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
  buildFilters(); renderBoard(); refreshMap(); updateBrand();
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
    return `<div class="b-row" data-city="${esc(x.f.city)}" data-sr="${x.f.sr}">
      <div class="b-rank">${i+1}</div>
      <div class="b-main">
        <div class="b-name">${esc(c.name || x.f.location)} · ${esc(x.f.facility)}</div>
        <div class="b-meta"><span class="dot" style="background:${TIER_COLOR[c.tier]||"#888"}"></span>${TIER_NAME[c.tier]||""} · ${esc(x.f.centreType)} · ${esc(x.f.region)}</div>
      </div>
      <div class="b-exp ${expiryClass(x.m)}">${fyLabel(x.f.leaseEnd)}<span class="mo">${x.m} mo</span></div>
    </div>`; }).join("");
  $("#board-foot").textContent = `${rows.length} leased facilities closing FY27 to FY30`
    + (regionFilter !== "All" ? ` · ${regionFilter}` : "")
    + `. Owned sites and open-ended leases are excluded rather than scored.`;
  document.querySelectorAll(".b-row").forEach(el =>
    el.addEventListener("click", () => select(el.dataset.city, Number(el.dataset.sr))));
  markActive();
}
const markActive = () => document.querySelectorAll(".b-row")
  .forEach(el => el.classList.toggle("active", el.dataset.city === selected));

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
  selected = null; markActive(); refreshMap();
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
      <div class="d">${esc(x.f.centreType)} in a ${TIER_NAME[c.tier]||"tier"} city. Lease ends <b>${esc(x.f.leaseEnd)}</b>, ${x.m} months out.${cand.length ? ` Options on the table: ${cand.map(esc).join(", ")}.` : ""}</div>
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

  /* Pin precision, stated at portfolio level so a coarse pin is never a surprise */
  const gp = {};
  for (const f of window.DG_FACILITIES){
    const g = window.DG_GEO && window.DG_GEO[f.sr];
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
  selected = city; markActive(); refreshMap();
  renderCity(city, c, sr);
  if (map) map.flyTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 9), duration: 900 });
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
  t += `</table><div class="note">${esc(w.zoneDefinition||"")}. ${esc(w.state)}, shops and establishments schedule, effective ${esc(w.effective||"n/a")}. Monthly floors including VDA. <span class="flag">VALIDATE VS GAZETTE</span></div>`;
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
  const a = perSeatRent(c.rent), b = perSeatRent(t.rent);
  if (a != null && b != null){
    const d = a - b;
    rent = `<div class="cm">Rent ₹${t.rent.low} to ₹${t.rent.high} against ₹${c.rent.low} to ₹${c.rent.high} per sq ft here, about <b class="${d>0?"delta-pos":"delta-neg"}">${inr(Math.abs(d))} per seat per month ${d>0?"saved":"added"}</b> at ${SEAT_SQFT} sq ft a seat.</div>`;
  } else if (t.rent && t.rent.low == null){
    rent = `<div class="cm">No published office market for ${esc(t.name)}. Rent to be established by a local broker check.</div>`;
  }
  const tt = window.DG_TALENT[key];
  const talent = tt ? `<div class="cm">Indicative: agent gross ${inr(tt.salary[0])} to ${inr(tt.salary[1])}, attrition ${esc(tt.attrition)}, competing employers ${esc(tt.compCount)}.</div>` : "";
  return `<div class="cand"><div class="cn"><span>${esc(t.name)}, ${esc(t.state)}</span>
      <span style="color:${TIER_COLOR[t.tier]};font-size:10.5px">${TIER_NAME[t.tier]}</span></div>
    <div class="cm">${wage}</div>${rent}${talent}
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
    const pill = f.leaseEnd == null
      ? `<span class="pill ok">Owned, no end date</span>`
      : `<span class="pill ${m<=12?"hot":m<=24?"warm":"ok"}">Lease ends ${esc(f.leaseEnd)} · ${m} mo</span>`;
    h += `<div class="fac${m!=null&&m<=12?" urgent":""}" id="fac-${f.sr}">
      <div class="fn"><span>${esc(f.facility)}</span><span class="sr">#${f.sr}</span></div>
      <div class="addr">${esc(f.address)}</div>
      <div class="row2">${pill}<span class="pill">${esc(f.centreType)}</span><span class="pill">${esc(f.officeType)}</span>
        <span class="pill">Lessor: ${esc(f.lessor.length>32?f.lessor.slice(0,30)+"…":f.lessor)}</span>
        ${g ? `<span class="pill">Pin: ${esc(g.precision)}</span>` : `<span class="pill">Pin: city</span>`}</div></div>`;
  }
  h += `</div>`;

  h += `<div class="sec"><h4>Zone-wise minimum wage</h4>${wageTable(c)}</div>`;

  /* real estate */
  h += `<div class="sec"><h4>Real estate</h4>`;
  if (c.rent && c.rent.low != null){
    h += `<div class="kv"><span class="k">${esc(c.market||c.name)}${c.rent.grade?" · Grade "+esc(c.rent.grade):""}</span><span class="v">₹${c.rent.low} to ₹${c.rent.high} /sq ft/mo</span></div>
      <div class="kv"><span class="k">Indicative rent per seat at ${SEAT_SQFT} sq ft</span><span class="v">${inr(perSeatRent(c.rent))} /mo</span></div>
      <div class="note">${esc(c.rent.note||"")} Quoted range as of ${esc(c.rent.asOf||"n/a")}. <span class="flag">BROKER-CHECK BEFORE COMMIT</span></div>`;
  } else {
    h += `<div class="note">No published office market data for this location. To be established by a local broker check before any commitment.</div>`;
  }
  h += `</div>`;

  /* the synthesis: what one seat costs here, and against the options */
  const sc = seatCost(key);
  if (sc && sc.total != null){
    h += `<div class="sec"><h4>Indicative seat cost <span class="flag ind">INDICATIVE</span></h4>
      <div class="hero calm"><div class="big">${inr(sc.total)}</div>
        <div class="cap">per seat per month, direct: ${inr(sc.rent)} rent at ${SEAT_SQFT} sq ft plus ${inr(sc.pay)} entry agent gross.</div></div>`;
    const opts = (c.candidates||[]).map(k => ({ k, n: window.DG_CITIES[k], s: seatCost(k) }))
      .filter(o => o.n && o.s && o.s.total != null);
    if (opts.length){
      h += `<table class="t" style="margin-top:10px"><tr><th>Against</th><th>Rent</th><th>Pay</th><th>Seat</th><th>Delta</th></tr>
        <tr class="cur"><td>${esc(c.name)}</td><td>${inr(sc.rent)}</td><td>${inr(sc.pay)}</td><td>${inr(sc.total)}</td><td>—</td></tr>`;
      for (const o of opts){
        const d = sc.total - o.s.total;
        h += `<tr><td>${esc(o.n.name)}</td><td>${inr(o.s.rent)}</td><td>${inr(o.s.pay)}</td><td>${inr(o.s.total)}</td>
          <td class="${d>0?"delta-pos":d<0?"delta-neg":""}">${d>0?"-":d<0?"+":""}${inr(Math.abs(d))}</td></tr>`;
      }
      const best = opts.map(o => sc.total - o.s.total).sort((a,b) => b - a)[0];
      h += `</table>`;
      if (best > 0){
        h += `<div class="note">Delta is the monthly saving per seat against this location. The best option here saves ${inr(best)} a seat, so a 500-seat operation is about <b style="color:#fff">${inr(best*500*12)} a year</b> before any one-off move cost. That is the order of magnitude that justifies a relocation; a smaller gap is an argument for renegotiating the lease, not leaving.</div>`;
      } else {
        h += `<div class="note">No option on this list is cheaper per seat than staying. The case for moving from here, if there is one, rests on capacity, attrition or client requirement rather than cost.</div>`;
      }
    }
    h += `<div class="note">Direct lines only: rent and agent pay. Supervision, telecom, facilities opex, transport and attrition replacement are excluded, so treat this as a comparison between cities rather than a budget.</div></div>`;
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
  if (focusSr){
    const el = document.getElementById("fac-" + focusSr);
    if (el){ el.style.outline = "1px solid rgba(224,96,58,.65)"; el.scrollIntoView({ block:"center" }); }
  }
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
  el.textContent = n
    ? `${n} of ${window.DG_FACILITIES.length} pinned to building or street`
    : `Pin size = facilities at that site`;
}
