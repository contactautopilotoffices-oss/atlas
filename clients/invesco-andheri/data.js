/* ============================================================================
   INVESCO — ANDHERI EAST / CHANDIVALI — DATA LAYER
   Source of truth: "Invesco - Andheri East options.pdf" (WorkSquare Enterprise
   Workspace · Inventory Proposal: Invesco). 7 units across 6 buildings:
   Hubtown Solaris, 723 Avenue, Rushabh Chambers, Kanakia Boomerang (2 units),
   K.P Aurum, Indiana House. Every commercial figure below — carpet, built-up,
   structure, condition, possession, car park, station distance — is copied
   verbatim from that PDF. T.B.D stays T.B.D (nothing invented).

   FIT INDEX (0–10) — qualitative composite, weights below:
     Handover readiness 35% · Station walk 25% · Carpet fit 25% · Parking 15%
   TIERS:
     BEST FIT = furnished + immediate
     WORKABLE = furnished-but-far, or warm-shell near metro
     STRETCH  = bare-shell fit-out risk / possession not immediate

   HONESTY NOTES:
   - Footprints: Kanakia Boomerang is a named OSM polygon. Hubtown Solaris,
     KP Aurum, Indiana House are OSM polygons snapped to mappls-verified pins
     (4–20 m). Rushabh Chambers is snapped from its street address (5 Makwana
     Rd) — verify on site. 723 Avenue reuses the box from the Flipkart client.
   - Station distances shown are the PDF's own figures (walking), kept as-is.
   - Hubtown Solaris built-up area and 723 Avenue floor are T.B.D in the PDF.
   ============================================================================ */

const WEIGHTS = { readiness: 0.35, station: 0.25, size: 0.25, parking: 0.15 };

const FIT_COLORS = {
  "BEST FIT": "#2fbf71",
  "WORKABLE": "#f0a020",
  "STRETCH":  "#d1495b"
};

const OPTIONS = [
  { rank:6, bldg:"kpaurum", unit:"K.P Aurum — 2nd Flr (2,150 sqft carpet)", floor:"2nd", furn:"Furnished",
    carpet:2150, charge:"3,580 sqft", eff:0.60, parking:"2 car parks",
    poss:"Immediately Available", aqua:0.70, score:9.3, scoreLabel:"9.3 / 10", bar:93, fit:"BEST FIT", hops:0,
    note:"The biggest furnished unit in the set — 2,150 sqft carpet, immediate, 2 car parks, ~700m from Marol Metro. The only option that combines scale with walk-in readiness." },
  { rank:2, bldg:"hubtown", unit:"Hubtown Solaris — 6th Flr (700 sqft carpet)", floor:"6th", furn:"Furnished",
    carpet:700, charge:"T.B.D", eff:null, parking:"1 car park",
    poss:"Immediately Available", aqua:0.45, score:8.7, scoreLabel:"8.7 / 10", bar:87, fit:"BEST FIT", hops:0,
    note:"Furnished and immediate, ~450m from Andheri Railway Station — the best transit anchor in the set (Western line + Metro L1). Compact 700 sqft; built-up T.B.D per proposal." },
  { rank:4, bldg:"kanakia", unit:"Kanakia Boomerang — Ground (970 sqft carpet)", floor:"Ground", furn:"Furnished",
    carpet:970, charge:"1,550 sqft", eff:0.63, parking:"1 car park",
    poss:"Immediately Available", aqua:1.8, score:7.9, scoreLabel:"7.9 / 10", bar:79, fit:"WORKABLE", hops:0,
    note:"Furnished ground-floor unit in the marquee Chandivali campus — but ~1.8km from Sakinaka Metro, the longest station walk in the set." },
  { rank:5, bldg:"kanakia", unit:"Kanakia Boomerang — Lower Grd (690 sqft carpet)", floor:"Lower Grd", furn:"Furnished",
    carpet:690, charge:"1,050 sqft", eff:0.66, parking:"1 @ ₹3,500/month",
    poss:"Immediately Available", aqua:1.8, score:7.3, scoreLabel:"7.3 / 10", bar:73, fit:"WORKABLE", hops:0,
    note:"Same campus, smaller lower-ground unit with paid parking (₹3,500/month). Same ~1.8km station walk applies." },
  { rank:3, bldg:"rushabh", unit:"Rushabh Chambers — 2nd Flr (650 sqft carpet)", floor:"2nd", furn:"Warm-Shell",
    carpet:650, charge:"1,083 sqft", eff:0.60, parking:"1 @ ₹3,500/month",
    poss:"Immediately Available", aqua:0.40, score:6.8, scoreLabel:"6.8 / 10", bar:68, fit:"WORKABLE", hops:0,
    note:"~400m from Marol Metro on Makwana Road — great walk, but warm-shell means fit-out time and capex before move-in." },
  { rank:7, bldg:"indiana", unit:"Indiana House — Ground (1,700 sqft carpet)", floor:"Ground", furn:"Bare-shell",
    carpet:1700, charge:"2,039 sqft", eff:0.83, parking:"T.B.D",
    poss:"Immediately Available", aqua:0.35, score:5.6, scoreLabel:"5.6 / 10", bar:56, fit:"STRETCH", hops:0,
    note:"Best station walk (~350m to Marol) and a big 1,700 sqft ground-floor plate at 83% efficiency — but BARE shell with car park T.B.D: full fit-out before occupancy." },
  { rank:1, bldg:"avenue723", unit:"723 Avenue — Flr T.B.D (800–900 sqft carpet)", floor:"T.B.D", furn:"Bare-shell",
    carpet:800, charge:"1,333–1,500 sqft", eff:0.60, parking:"1 car park",
    poss:"OC expected August 2026", aqua:0.70, score:5.0, scoreLabel:"5.0 / 10", bar:50, fit:"STRETCH", hops:0,
    note:"Bare-shell AND not ready — OC expected August 2026, floor not yet assigned. New-build quality, but the only option Invesco cannot occupy now." }
];

/* ---------------------------------------------------------------------------
   BUILDINGS — mappls/OSM-verified centroids + footprints (see geo.js).
   aqua = the PDF's own station distance in km (walking, per proposal).
--------------------------------------------------------------------------- */
const GEO_ORIGIN = { lat: 19.1120, lon: 72.8720 };
function lngToMercX(lon){ return lon/360 + 0.5; }
function latToMercY(lat){ return 0.5 - Math.log(Math.tan(Math.PI/4 + (lat*Math.PI)/360))/(2*Math.PI); }
const _omx = lngToMercX(GEO_ORIGIN.lon), _omy = latToMercY(GEO_ORIGIN.lat);
const MER_SCALE = 1/(40075016.68*Math.cos(GEO_ORIGIN.lat*Math.PI/180));
function geoToMeters(lat, lon){
  return { lat, lng: lon, x:(lngToMercX(lon)-_omx)/MER_SCALE, z:(latToMercY(lat)-_omy)/MER_SCALE };
}

const ST = {
  andheri:  { lng:72.84642, lat:19.11970, name:"Andheri Station (Western line × Metro L1)" },
  marolnaka:{ lng:72.87949, lat:19.10816, name:"Marol Naka (Line 1 · L3 interchange)" },
  sakinaka: { lng:72.88796, lat:19.10354, name:"Sakinaka (Line 1)" },
};
function stn(s){ return { stnLng:s.lng, stnLat:s.lat, stnName:s.name }; }

const BUILDINGS = [
  { id:"kpaurum", name:"K.P Aurum", block:"Marol Maroshi Rd", isOption:true, type:"tower",
    ...geoToMeters(19.11521, 72.88046), ...stn(ST.marolnaka), w:40, d:30, h:38, floors:12, color:0x2fbf71, aqua:0.70,
    bandra:0, busStops:"Marol Metro Station (~700m)", busRoutes:"Line 1 via Marol Naka · L3 interchange",
    tenants:"Commercial G+11, K P Engineering Compound, Marol Maroshi Road; furnished 2nd-floor unit with 2 car parks.",
    posh:["Marol Maroshi belt","Seepz gate"],
    grade:"A", gradeNote:"Biggest furnished unit in the set — scale + walk-in readiness.",
    pdf:{ "Building type":"Commercial", "Building structure":"G + 11", "Carpet area":"2,150 sq.ft",
      "Possession":"Immediately Available", "Condition":"Furnished", "Floor on offer":"2nd",
      "Built-up area":"3,580 sq.ft", "Car park":"2" },
    transit:[
      { ic:"M1", cls:"aqua", text:"<b>~700m</b> to Marol Metro Station", sub:"Line 1 · Marol Naka is also the L3 (Aqua) interchange" } ] },
  { id:"hubtown", name:"Hubtown Solaris", block:"N S Phadke Marg · Andheri E", isOption:true, type:"slab",
    ...geoToMeters(19.11471, 72.85003), ...stn(ST.andheri), w:60, d:45, h:45, floors:14, color:0x2fbf71, aqua:0.45,
    bandra:0, busStops:"Andheri Railway Station (~450m)", busRoutes:"Western line + Metro Line 1 at Andheri",
    tenants:"Commercial G+13 glass-façade landmark opposite Teli Gali; furnished 6th-floor unit.",
    posh:["Teli Gali","Vijay Nagar"],
    grade:"A", gradeNote:"Best transit anchor in the set — suburban rail + Metro L1 in one walk.",
    pdf:{ "Building type":"Commercial", "Building structure":"G + 13", "Carpet area":"700 sq.ft",
      "Possession":"Immediately Available", "Condition":"Furnished", "Floor on offer":"6th",
      "Built-up area":"T.B.D", "Car park":"1" },
    transit:[
      { ic:"R", cls:"rail", text:"<b>~450m</b> to Andheri Railway Station", sub:"Western suburban line · every Mumbai corridor" },
      { ic:"M1", cls:"aqua", text:"<b>~450m</b> to Andheri Metro (Line 1)", sub:"Direct to Marol Naka · Sakinaka · Ghatkopar" } ] },
  { id:"kanakia", name:"Kanakia Boomerang", block:"Chandivali", isOption:true, type:"slab",
    ...geoToMeters(19.11333, 72.89291), ...stn(ST.sakinaka), w:120, d:80, h:29, floors:9, color:0xf0a020, aqua:1.8,
    bandra:0, busStops:"Sakinaka Metro Station (~1.8km)", busRoutes:"Line 1 via Sakinaka",
    tenants:"Commercial G+8 boomerang-shaped campus on Chandivali Farm Road; furnished Ground + Lower Ground units on offer.",
    posh:["Chandivali Farm Road","Powai belt"],
    grade:"A", gradeNote:"Marquee campus quality; the 1.8km station walk is the trade-off.",
    pdf:{ "Building type":"Commercial", "Building structure":"G + 8", "Carpet area":"970 / 690 sq.ft (2 units)",
      "Possession":"Immediately Available", "Condition":"Furnished", "Floor on offer":"Ground · Lower Ground",
      "Built-up area":"1,550 / 1,050 sq.ft", "Car park":"1 · 1 @ Rs. 3,500 per month" },
    transit:[
      { ic:"M1", cls:"aqua", text:"<b>~1.8km</b> to Sakinaka Metro Station", sub:"Longest station walk in the set — auto/shuttle leg" } ] },
  { id:"rushabh", name:"Rushabh Chambers", block:"5 Makwana Rd · Marol", isOption:true, type:"block",
    ...geoToMeters(19.10951, 72.88193), ...stn(ST.marolnaka), w:34, d:27, h:22, floors:7, color:0xf0a020, aqua:0.40,
    bandra:0, busStops:"Marol Metro Station (~400m)", busRoutes:"Line 1 via Marol Naka · L3 interchange",
    tenants:"Commercial G+6 standalone on Makwana Road, off Andheri-Kurla Road; warm-shell 2nd-floor unit.",
    posh:["Makwana Road strip","Marol Naka junction"],
    grade:"B+", gradeNote:"Great metro walk; warm shell needs fit-out. (Footprint snapped from street address — verify on site.)",
    pdf:{ "Building type":"Commercial", "Building structure":"G + 6", "Carpet area":"650 sq.ft",
      "Possession":"Immediately Available", "Condition":"Warm-Shell", "Floor on offer":"2nd",
      "Built-up area":"1,083 sq.ft", "Car park":"1 @ Rs. 3,500 per month" },
    transit:[
      { ic:"M1", cls:"aqua", text:"<b>~400m</b> to Marol Metro Station", sub:"Line 1 · Marol Naka L3 interchange" } ] },
  { id:"indiana", name:"Indiana House", block:"Makwana Rd × Marol Naka", isOption:true, type:"block",
    ...geoToMeters(19.10992, 72.87984), ...stn(ST.marolnaka), w:36, d:28, h:29, floors:9, color:0xd1495b, aqua:0.35,
    bandra:0, busStops:"Marol Metro Station (~350m)", busRoutes:"Line 1 via Marol Naka · L3 interchange",
    tenants:"Commercial G+8 (Indiana Business Centre wings) at Marol Naka; bare-shell Ground unit, 83% efficient.",
    posh:["Marol Naka junction","Andheri-Kurla Road"],
    grade:"B+", gradeNote:"Best station walk of the set — but bare shell with car park T.B.D.",
    pdf:{ "Building type":"Commercial", "Building structure":"G + 8", "Carpet area":"1,700 sq.ft",
      "Possession":"Immediately Available", "Condition":"Bare-shell", "Floor on offer":"Ground",
      "Built-up area":"2,039 sq.ft", "Car park":"T.B.D" },
    transit:[
      { ic:"M1", cls:"aqua", text:"<b>~350m</b> to Marol Metro Station", sub:"Best station walk of all 7 units" } ] },
  { id:"avenue723", name:"723 Avenue", block:"Marol · Andheri E", isOption:true, type:"tower",
    ...geoToMeters(19.10705, 72.88340), rot: -0.25, ...stn(ST.marolnaka), w:34, d:26, h:48, floors:15, color:0xd1495b, aqua:0.70,
    bandra:0, busStops:"Marol Metro Station (~700m)", busRoutes:"Line 1 via Marol Naka · L3 interchange",
    tenants:"Commercial G+14 new-build; bare-shell unit, floor T.B.D, OC expected August 2026.",
    posh:["Marol business district"],
    grade:"A", gradeNote:"New-build quality — but bare shell and not occupiable until OC (Aug 2026).",
    pdf:{ "Building type":"Commercial", "Building structure":"G + 14", "Carpet area":"800–900 sq.ft",
      "OC expected":"August, 2026", "Condition":"Bare-shell", "Floor on offer":"T.B.D",
      "Built-up area":"1,333–1,500 sq.ft", "Car park":"1" },
    transit:[
      { ic:"M1", cls:"aqua", text:"<b>~700m</b> to Marol Metro Station", sub:"Line 1 · Marol Naka L3 interchange" } ] },

  // ---- Context landmarks (not selectable) ----
  { id:"andheri_stn", name:"Andheri Station (WR × L1)", block:"Andheri", type:"slab",
    ...geoToMeters(19.11970, 72.84642), w:90, d:26, h:10, floors:2, color:0x14b8c4 },
  { id:"marolnaka_stn", name:"Marol Naka Station (L1 × L3)", block:"Marol", type:"slab",
    ...geoToMeters(19.10816, 72.87949), w:60, d:20, h:10, floors:2, color:0x14b8c4 },
  { id:"sakinaka_stn", name:"Sakinaka Station (L1)", block:"Sakinaka", type:"slab",
    ...geoToMeters(19.10354, 72.88796), w:60, d:20, h:10, floors:2, color:0x14b8c4 },
];

/* ---------------------------------------------------------------------------
   METRO — Line 1 (Versova–Ghatkopar) spine + L3 note. Alignment reused from
   the verified Andheri client; stations on OSM nodes.
--------------------------------------------------------------------------- */
const METRO = {
  aqua: {
    name:"Metro Line 1 — Versova ↔ Ghatkopar (elevated)",
    color:0x14b8c4, status:"OPERATIONAL — the Andheri East spine",
    statusNote:"Andheri → WEH → Chakala → Airport Road → Marol Naka → Sakinaka. Five of the seven units are on this spine; Marol Naka adds the Line 3 (Aqua) interchange toward BKC/Colaba.",
    path:[[ -1500,-300 ]],
    stations:[ {name:"Marol Naka — L1 × L3 interchange", x:780, z:430, interchange:true} ]
  },
  yellow: {
    name:"Western Railway — Andheri suburban hub",
    color:0xf2c200, status:"OPERATIONAL — anchors Hubtown Solaris",
    statusNote:"Andheri station (450 m from Hubtown Solaris per proposal) connects every Western-line corridor plus Metro Line 1 in a single walk.",
    path:[[-2600,-900]],
    stations:[ {name:"Andheri (WR × L1)", x:-2680, z:-940} ]
  }
};

/* Food, retail & landmark pins — the "what clicks" layer */
const NEIGHBORHOODS = [
  { name:"Marol Naka junction", ...geoToMeters(19.10816, 72.87949), tag:"L1 × L3 interchange · Andheri-Kurla Rd" },
  { name:"Makwana Road strip", ...geoToMeters(19.11050, 72.88200), tag:"Offices · lunch spots" },
  { name:"Chandivali Farm Road", ...geoToMeters(19.11200, 72.89000), tag:"Powai-edge campus belt" },
  { name:"Teli Gali · Vijay Nagar", ...geoToMeters(19.11600, 72.85000), tag:"Andheri E station neighbourhood" },
  { name:"Sakinaka junction", ...geoToMeters(19.10354, 72.88796), tag:"L1 station · Andheri-Kurla Rd" },
  { name:"Leela / Airport Rd belt", ...geoToMeters(19.11090, 72.87350), tag:"Hotels · airport approach" }
];

const RIVER_PATH = [];

const META = {
  client:"Invesco",
  business:"Compact managed office — 650–2,150 sqft carpet across Andheri East & Chandivali",
  brief:"Move-in-ready favoured · station walk matters · 7 units from the WorkSquare inventory proposal · T.B.D items flagged, not assumed",
  prepared:"WorkSquare Enterprise Workspace · Inventory Proposal: Invesco",
  winner:"kpaurum"
};

window.BKC = { WEIGHTS, FIT_COLORS, OPTIONS, BUILDINGS, METRO, NEIGHBORHOODS, RIVER_PATH, META };
