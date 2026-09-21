/* ============================================================================
   ATLAS · DIGITIDE GROUP COMMAND CENTRE
   Pan-India view over the group facility tracker (56 rows, as on 1 Sep 2026).
   Answers five questions per location, in this order, because this is the order
   the board will ask them in:
     1. What do we hold here, and when does each lease close?
     2. What does the statutory wage floor look like here vs the nearby
        cheaper zone or town (zone-wise minimum wage)?
     3. What does space cost here vs there (real estate)?
     4. Who else recruits this catchment (competitors)?
     5. Is the talent there to absorb us (catchment)?
   The left board ranks where a move decision is live: leases closing FY27-FY30,
   weighted by seat-city cost gravity and how movable the operation is.
   Data layers: facilities.js (tracker, verbatim) + intel.js (wage / rent /
   competitor / catchment intelligence, each block carrying its own effective
   date and validation flag).
   ============================================================================ */
"use strict";

/* ---- access gate (client-side demo gate, same pattern as clients/manifest.js;
        placeholder pass — rotate before deploy, real one supplied out of band) ---- */
const GATE = { id: "DIGGRPACC", pass: "DGRP1234" };

const $ = (s) => document.querySelector(s);
const fmt = (n) => n == null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

const TODAY = new Date();
const TIER_COLOR = { 1: "#e0603a", 2: "#d9b310", 3: "#2fbf71" };
const TIER_NAME  = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };
const SEAT_SQFT = 50; // stated assumption for per-seat rent arithmetic, shown in the UI wherever used

/* ---------------------------------------------------------------- gate ---- */
(function gate(){
  const go = () => {
    const id = $("#g-id").value.trim().toUpperCase(), pw = $("#g-pw").value;
    if (id === GATE.id && pw === GATE.pass) {
      sessionStorage.setItem("dg-auth", "1");
      $("#gate").remove(); boot();
    } else $("#g-err").textContent = "Not recognised. Access is issued per person — ask Autopilot.";
  };
  if (sessionStorage.getItem("dg-auth") === "1") { $("#gate").remove(); boot(); return; }
  $("#g-go").addEventListener("click", go);
  $("#gate").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
})();

/* ------------------------------------------------------------- helpers ---- */
function monthsLeft(iso){
  if (!iso) return null;
  const end = new Date(iso + "T00:00:00");
  return (end.getFullYear() - TODAY.getFullYear()) * 12 + (end.getMonth() - TODAY.getMonth());
}
function expiryClass(m){ return m == null ? "exp-ok" : m <= 12 ? "exp-red" : m <= 24 ? "exp-amber" : "exp-ok"; }
function fy(iso){
  if (!iso) return "—";
  const d = new Date(iso); const y = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();
  return "FY" + String(y).slice(2);
}
function wageRow(stateKey, zone){
  const w = window.DG_WAGES[stateKey];
  return w && w.zones ? w.zones[zone] || null : null;
}
/* Cheapest zone in the same state, by unskilled floor. */
function cheapestZone(stateKey){
  const w = window.DG_WAGES[stateKey]; if (!w) return null;
  let best = null;
  for (const [name, z] of Object.entries(w.zones || {}))
    if (z.unskilled != null && (!best || z.unskilled < best.z.unskilled)) best = { name, z };
  return best;
}
function pressureScore(f){
  const m = monthsLeft(f.leaseEnd);
  if (m == null) return null;                       // owned / no lease date
  let s = m <= 6 ? 55 : m <= 12 ? 48 : m <= 18 ? 40 : m <= 24 ? 32 : m <= 36 ? 20 : m <= 51 ? 10 : 0;
  if (s === 0) return null;                          // beyond the FY30 window
  const c = window.DG_CITIES[f.city];
  s += c ? (c.tier === 1 ? 25 : c.tier === 2 ? 12 : 4) : 0;
  s += /call/i.test(f.centreType) ? 15 : /collection/i.test(f.centreType) ? 6 : 2;
  const cz = c && cheapestZone(c.stateKey), cur = c && wageRow(c.stateKey, c.wageZone);
  if (cz && cur && cur.unskilled != null && cz.z.unskilled < cur.unskilled) s += 5;
  return Math.min(100, s);
}

/* --------------------------------------------------------------- state ---- */
let map, selected = null, regionFilter = "All", soonOnly = false;

function facsOf(city){ return window.DG_FACILITIES.filter(f => f.city === city); }
function cityAgg(){
  const agg = {};
  for (const f of window.DG_FACILITIES){
    if (regionFilter !== "All" && f.region !== regionFilter) continue;
    if (soonOnly && !(monthsLeft(f.leaseEnd) != null && monthsLeft(f.leaseEnd) <= 24)) continue;
    (agg[f.city] = agg[f.city] || []).push(f);
  }
  return agg;
}

/* ---------------------------------------------------------------- boot ---- */
function boot(){
  const token = window.MAPBOX_TOKEN || "";
  if (!token || /REPLACE/.test(token)) { $("#hint").textContent = "MAPBOX_TOKEN missing — run scripts/build-config.js"; }
  try {
    mapboxgl.accessToken = token;
    map = new mapboxgl.Map({
      container: "map", style: "mapbox://styles/mapbox/dark-v11",
      center: [80.2, 22.6], zoom: 4.35, minZoom: 3.6, maxZoom: 13,
      attributionControl: false, projection: "mercator"
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => { addLayers(); renderAll(); });
    map.on("error", () => {});         // board and panel must survive a dead tile source
  } catch (e) {
    map = null;                        // no token: the board and panel still work
  }
  renderBoard(); updateBrand();        // DOM side renders even before (or without) style load
  buildFilters();
  $("#intel-close").addEventListener("click", () => select(null));
}

function cityFeature(key, facs){
  const c = window.DG_CITIES[key]; if (!c) return null;
  return { type: "Feature", geometry: { type: "Point", coordinates: [c.lng, c.lat] },
    properties: { key, name: c.name, tier: c.tier, count: facs ? facs.length : 0,
      color: TIER_COLOR[c.tier], cand: !!c.candidateOnly } };
}
function currentGeo(){
  const agg = cityAgg();
  return { type: "FeatureCollection",
    features: Object.entries(agg).map(([k, fs]) => cityFeature(k, fs)).filter(Boolean) };
}
function candidateGeo(){
  return { type: "FeatureCollection",
    features: Object.entries(window.DG_CITIES).filter(([, c]) => c.candidateOnly)
      .map(([k]) => cityFeature(k, null)).filter(Boolean) };
}
function linkGeo(){
  if (!selected) return { type: "FeatureCollection", features: [] };
  const c = window.DG_CITIES[selected]; if (!c || !c.candidates) return { type: "FeatureCollection", features: [] };
  return { type: "FeatureCollection", features: c.candidates.map(k => {
    const t = window.DG_CITIES[k]; if (!t) return null;
    return { type: "Feature", geometry: { type: "LineString", coordinates: [[c.lng, c.lat], [t.lng, t.lat]] }, properties: {} };
  }).filter(Boolean) };
}

function addLayers(){
  map.addSource("links", { type: "geojson", data: linkGeo() });
  map.addLayer({ id: "links", type: "line", source: "links",
    paint: { "line-color": "#4f9cd9", "line-width": 1.4, "line-dasharray": [2, 2], "line-opacity": .75 } });

  map.addSource("cand", { type: "geojson", data: candidateGeo() });
  map.addLayer({ id: "cand", type: "circle", source: "cand",
    paint: { "circle-radius": 4.5, "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#4f9cd9", "circle-stroke-width": 1.6, "circle-opacity": .9 } });
  map.addLayer({ id: "cand-lbl", type: "symbol", source: "cand",
    layout: { "text-field": ["get", "name"], "text-size": 10, "text-offset": [0, 1.1], "text-anchor": "top",
      "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"] },
    paint: { "text-color": "rgba(147,197,235,.85)", "text-halo-color": "#0b0f16", "text-halo-width": 1.2 } });

  map.addSource("cities", { type: "geojson", data: currentGeo() });
  map.addLayer({ id: "cities-glow", type: "circle", source: "cities",
    paint: { "circle-radius": ["+", 9, ["*", 2.4, ["get", "count"]]],
      "circle-color": ["get", "color"], "circle-opacity": .16, "circle-blur": .6 } });
  map.addLayer({ id: "cities", type: "circle", source: "cities",
    paint: { "circle-radius": ["+", 4, ["*", 1.1, ["get", "count"]]],
      "circle-color": ["get", "color"], "circle-stroke-color": "#0b0f16", "circle-stroke-width": 1.4 } });
  map.addLayer({ id: "cities-lbl", type: "symbol", source: "cities",
    layout: { "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top",
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"] },
    paint: { "text-color": "rgba(255,255,255,.88)", "text-halo-color": "#0b0f16", "text-halo-width": 1.3 } });
  map.addLayer({ id: "cities-sel", type: "circle", source: "cities",
    filter: ["==", ["get", "key"], "__none__"],
    paint: { "circle-radius": ["+", 9, ["*", 1.1, ["get", "count"]]], "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.6 } });

  for (const id of ["cities", "cand"]){
    map.on("click", id, e => { const k = e.features[0].properties.key; select(k); });
    map.on("mouseenter", id, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", id, () => map.getCanvas().style.cursor = "");
  }
}

function refreshMap(){
  if (!map || !map.getSource("cities")) return;
  map.getSource("cities").setData(currentGeo());
  map.getSource("links").setData(linkGeo());
  map.setFilter("cities-sel", ["==", ["get", "key"], selected || "__none__"]);
}

/* ------------------------------------------------------------- filters ---- */
function buildFilters(){
  const regions = ["All", "North", "South", "East", "West", "Central"];
  const wrap = $("#filters");
  wrap.innerHTML = "";
  for (const r of regions){
    const b = document.createElement("button");
    b.className = "tg" + (r === regionFilter ? " on" : "");
    b.textContent = r;
    b.addEventListener("click", () => { regionFilter = r; buildFilters(); renderAll(); });
    wrap.appendChild(b);
  }
  const s = document.createElement("button");
  s.className = "tg" + (soonOnly ? " on" : "");
  s.textContent = "Lease ≤ 24 mo";
  s.addEventListener("click", () => { soonOnly = !soonOnly; buildFilters(); renderAll(); });
  wrap.appendChild(s);
}

/* --------------------------------------------------------------- board ---- */
function renderBoard(){
  const list = $("#board-list");
  const rows = window.DG_FACILITIES
    .filter(f => regionFilter === "All" || f.region === regionFilter)
    .map(f => ({ f, s: pressureScore(f), m: monthsLeft(f.leaseEnd) }))
    .filter(x => x.s != null && (!soonOnly || x.m <= 24))
    .sort((a, b) => b.s - a.s || a.m - b.m);
  list.innerHTML = rows.map((x, i) => {
    const c = window.DG_CITIES[x.f.city] || {};
    return `<div class="b-row" data-city="${x.f.city}" data-sr="${x.f.sr}">
      <div class="b-rank">${i + 1}</div>
      <div class="b-main">
        <div class="b-name">${esc(c.name || x.f.location)} · ${esc(x.f.facility)}</div>
        <div class="b-meta"><span class="dot" style="background:${TIER_COLOR[c.tier] || "#888"}"></span>
          ${TIER_NAME[c.tier] || ""} · ${esc(x.f.centreType)} · ${esc(x.f.region)}</div>
      </div>
      <div class="b-exp ${expiryClass(x.m)}">${fy(x.f.leaseEnd)}<span class="mo">${x.m} mo</span></div>
    </div>`;
  }).join("");
  $("#board-foot").textContent =
    `${rows.length} leased facilities inside the FY27–FY30 window` +
    (regionFilter !== "All" ? ` · ${regionFilter}` : "") +
    ` · owned sites and open-ended leases excluded.`;
  list.querySelectorAll(".b-row").forEach(el =>
    el.addEventListener("click", () => select(el.dataset.city, Number(el.dataset.sr))));
  markActive();
}
function markActive(){
  document.querySelectorAll(".b-row").forEach(el =>
    el.classList.toggle("active", el.dataset.city === selected));
}

/* --------------------------------------------------------------- intel ---- */
function select(city, sr){
  selected = city;
  refreshMap(); markActive();
  const panel = $("#intel");
  if (!city){ panel.classList.remove("open"); return; }
  const c = window.DG_CITIES[city]; if (!c) return;
  renderIntel(city, c, sr);
  panel.classList.add("open");
  if (map) map.flyTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 5.4), duration: 900 });
}

function wageTable(c){
  const w = window.DG_WAGES[c.stateKey];
  if (!w) return `<div class="note">No wage record loaded for ${esc(c.state)}.</div>`;
  const lvls = ["unskilled", "semiSkilled", "skilled", "highlySkilled"];
  const heads = { unskilled: "Unskilled", semiSkilled: "Semi", skilled: "Skilled", highlySkilled: "Highly sk." };
  const used = lvls.filter(l => Object.values(w.zones).some(z => z[l] != null));
  let html = `<table class="wage"><tr><th>Zone</th>${used.map(l => `<th>${heads[l]}</th>`).join("")}</tr>`;
  for (const [name, z] of Object.entries(w.zones)){
    const cur = name === c.wageZone;
    html += `<tr class="${cur ? "cur" : ""}"><td>${esc(name)}</td>${used.map(l =>
      `<td>${z[l] != null ? fmt(z[l]) : "—"}</td>`).join("")}</tr>`;
  }
  html += `</table><div class="note">${esc(w.zoneDefinition || "")} · ${esc(w.state)}, shops &amp; establishments schedule, effective ${esc(w.effective || "n/a")}. Monthly floors incl. VDA. <span class="flag">VALIDATE VS GAZETTE</span></div>`;
  if (w.note) html += `<div class="note">${esc(w.note)}</div>`;
  return html;
}

function candidateCard(c, key){
  const t = window.DG_CITIES[key]; if (!t) return "";
  const cur = wageRow(c.stateKey, c.wageZone), tw = wageRow(t.stateKey, t.wageZone);
  let wageLine = "Statutory floor comparison unavailable.";
  if (cur && tw && cur.unskilled != null && tw.unskilled != null){
    const d = cur.unskilled - tw.unskilled;
    const dsk = (cur.skilled != null && tw.skilled != null) ? cur.skilled - tw.skilled : null;
    wageLine = d > 0
      ? `Statutory floor <b class="delta-pos">₹${d.toLocaleString("en-IN")}/employee/month lower</b> (unskilled)` +
        (dsk != null ? `, ₹${dsk.toLocaleString("en-IN")} lower on skilled.` : ".")
      : d < 0
      ? `Statutory floor <b class="delta-neg">₹${Math.abs(d).toLocaleString("en-IN")}/month HIGHER</b> — the case there is market wages and rent, not the statutory floor.`
      : `Same statutory floor (${t.stateKey === c.stateKey ? "same state and zone class" : "flat-rate states"}) — the saving, if any, is market wages, attrition and rent.`;
  }
  let rentLine = "";
  if (c.rent && t.rent && c.rent.low != null && t.rent.low != null){
    const perSeat = (a) => Math.round(((a.low + a.high) / 2) * SEAT_SQFT);
    const d = perSeat(c.rent) - perSeat(t.rent);
    rentLine = `<div class="cm">Rent ${t.rent.low}–${t.rent.high} vs ${c.rent.low}–${c.rent.high} ₹/sq ft/mo here → about <b class="${d > 0 ? "delta-pos" : "delta-neg"}">₹${Math.abs(d).toLocaleString("en-IN")}/seat/month ${d > 0 ? "saved" : "added"}</b> at ${SEAT_SQFT} sq ft a seat.</div>`;
  } else if (t.rent && t.rent.low == null){
    rentLine = `<div class="cm">No published office market for ${esc(t.name)} — rent to be confirmed by a local broker check.</div>`;
  }
  return `<div class="cand"><div class="cn"><span>${esc(t.name)}, ${esc(t.state)}</span>
      <span class="d" style="color:${TIER_COLOR[t.tier]}">${TIER_NAME[t.tier]}</span></div>
    <div class="cm">${wageLine}</div>${rentLine}
    ${t.catchment ? `<div class="cm">${esc(t.catchment)}</div>` : ""}
    ${t.players && t.players.length ? `<div class="cm">Also here: ${t.players.map(esc).join(", ")}.</div>` : ""}
  </div>`;
}

function renderIntel(key, c, focusSr){
  $("#ih-city").innerHTML = `${esc(c.name)}<span class="tierchip" style="background:${TIER_COLOR[c.tier]}22;color:${TIER_COLOR[c.tier]}">${TIER_NAME[c.tier]}</span>`;
  const facs = facsOf(key);
  $("#ih-sub").textContent = `${c.state} · ${facs.length} facilit${facs.length === 1 ? "y" : "ies"} · wage zone: ${c.wageZone}${c.market ? " · " + c.market : ""}`;
  const body = $("#intel-body");

  let html = `<div class="sec"><h4>Facilities here</h4>`;
  for (const f of facs.sort((a, b) => (monthsLeft(a.leaseEnd) ?? 999) - (monthsLeft(b.leaseEnd) ?? 999))){
    const m = monthsLeft(f.leaseEnd);
    const pill = f.leaseEnd == null ? `<span class="pill ok">Owned / no end date</span>`
      : `<span class="pill ${m <= 12 ? "hot" : m <= 24 ? "warm" : "ok"}">Lease ends ${f.leaseEnd} · ${m} mo</span>`;
    html += `<div class="fac" id="fac-${f.sr}"><div class="fn"><span>${esc(f.facility)}</span><span style="color:var(--dim);font-weight:400">#${f.sr}</span></div>
      <div class="addr">${esc(f.address)}</div>
      <div class="row2">${pill}<span class="pill">${esc(f.centreType)}</span><span class="pill">${esc(f.officeType)}</span>
      <span class="pill">Lessor: ${esc(f.lessor.length > 34 ? f.lessor.slice(0, 32) + "…" : f.lessor)}</span></div></div>`;
  }
  html += `</div>`;

  html += `<div class="sec"><h4>Zone-wise minimum wage</h4>${wageTable(c)}</div>`;

  html += `<div class="sec"><h4>Real estate</h4>`;
  if (c.rent && c.rent.low != null){
    html += `<div class="kv"><span class="k">${esc(c.market || c.name)} · ${esc(c.rent.grade || "")}</span>
      <span class="v">₹${c.rent.low}–${c.rent.high} / sq ft / mo</span></div>
    <div class="kv"><span class="k">Indicative per seat at ${SEAT_SQFT} sq ft</span>
      <span class="v">${fmt(((c.rent.low + c.rent.high) / 2) * SEAT_SQFT)} / mo</span></div>
    <div class="note">${esc(c.rent.note || "")} As of ${esc(c.rent.asOf || "n/a")}. <span class="flag">BROKER-CHECK BEFORE COMMIT</span></div>`;
  } else {
    html += `<div class="note">No published office market data for this location — to be confirmed by local broker check before any commitment.</div>`;
  }
  html += `</div>`;

  html += `<div class="sec"><h4>Competitor presence</h4>
    <div class="para">BPO / BPM employers hiring the same pool: <b>${esc(c.presence || "unassessed")}</b> density.</div>
    <div class="chips2" style="margin-top:8px">${(c.players || []).map(p => `<span class="pl">${esc(p)}</span>`).join("") || '<span class="note">None mapped.</span>'}</div>
    <div class="note">Presence = operating delivery or collection centres in this catchment. Double-edged: proof the market works, and the bidder for your agents.</div></div>`;

  html += `<div class="sec"><h4>Talent catchment</h4><div class="para">${c.catchment ? esc(c.catchment) : "Not yet assessed."}</div>`;
  if (c.catchmentStats) html += c.catchmentStats.map(s => `<div class="kv"><span class="k">${esc(s.k)}</span><span class="v">${esc(s.v)}</span></div>`).join("");
  html += `</div>`;

  if (c.candidates && c.candidates.length){
    html += `<div class="sec"><h4>Movement options</h4>${c.candidates.map(k => candidateCard(c, k)).join("")}</div>`;
  }
  if (c.strategy){
    html += `<div class="sec"><h4>The call</h4><div class="para">${c.strategy}</div></div>`;
  }
  html += `<div class="note" style="margin-top:18px">${esc((window.DG_META && window.DG_META.disclaimer) || "")}</div>`;
  body.innerHTML = html;
  body.scrollTop = 0;
  if (focusSr){
    const el = document.getElementById("fac-" + focusSr);
    if (el){ el.style.outline = "1px solid rgba(224,96,58,.7)"; el.scrollIntoView({ block: "center" }); }
  }
}

/* ---------------------------------------------------------------- misc ---- */
function renderAll(){ renderBoard(); refreshMap(); updateBrand(); }
function updateBrand(){
  const agg = cityAgg();
  const n = Object.values(agg).reduce((a, b) => a + b.length, 0);
  const cities = Object.keys(agg).length;
  $("#brand-sub").textContent = `${n} facilities · ${cities} cities · tracker as on 1 Sep 2026` +
    (regionFilter !== "All" ? ` · ${regionFilter}` : "") + (soonOnly ? " · lease ≤ 24 mo" : "");
}
