/* ============================================================================
   BASILIC FLY STUDIO — DATA LAYER (Whitefield / Mahadevapura / Varthur, Bengaluru)
   Source of truth: "Basilic Fly inventory options .pdf" broker deck (11 pp) —
   ALL property figures are client-stated / unconfirmed (evidence/ledger.jsonl).
   Coordinates: 5 of 6 properties match a named OSM footprint polygon. Y Living is a
   REGISTRY-VERIFIED PROJECT PIN (RERA PRM/KA/RERA/1251/446/PR/130722/005066 + a named
   Y@Whitefield map listing) — the project location is verified, but no surveyed polygon
   exists for its commercial block, so it carries coordPrecision:"project" and renders
   as a project pin rather than a footprint. Ledger geo-* rows; raw responses recon/osm/.

   TRUTH CONTRACT:
   - Every numeric field carries `src` = evidence/ledger.jsonl row id.
   - Fields with no ledger-backed value are null and render "Unconfirmed" —
     never a blank, never a guess (provisional render gate until the real
     ledger assertion layer lands).
   - SORT ORDER: deck metro distance ascending (nearest first).
     PROVISIONAL — final sort must come from Mappls when credentials land
     (Phase 1 blocked; see evidence/mappls-endpoints.md when filed).
   - N is derived everywhere; nothing assumes the deck's count of options.
   ============================================================================ */

/* Budget band from the brief (ledger: budget-band). */
const BAND = { lo: 8000, hi: 9500, src: "budget-band" };

/* ---- Mercator helpers (same pattern as cp-delhi) ---- */
const GEO_ORIGIN = { lat: 12.9655, lon: 77.7370 };
function lngToMercX(lon){ return lon/360 + 0.5; }
function latToMercY(lat){ return 0.5 - Math.log(Math.tan(Math.PI/4 + (lat*Math.PI)/360))/(2*Math.PI); }
const _omx = lngToMercX(GEO_ORIGIN.lon), _omy = latToMercY(GEO_ORIGIN.lat);
const MER_SCALE = 1/(40075016.68*Math.cos(GEO_ORIGIN.lat*Math.PI/180));
function geoToMeters(lat, lon){
  return { lat, lng: lon, x:(lngToMercX(lon)-_omx)/MER_SCALE, z:(latToMercY(lat)-_omy)/MER_SCALE };
}

/* Nearest-metro station nodes — verified OSM coordinates (ledger geo-stn-*). */
const ST = {
  whitefield:  { lng:77.7579489, lat:12.9957428, name:"Whitefield (Kadugodi) · Purple Line", src:"geo-stn-whitefield" },
  kadugodi:    { lng:77.7470121, lat:12.9856503, name:"Kadugodi Tree Park · Purple Line", src:"geo-stn-kadugodi-tree-park" },
  hoodi:       { lng:77.7113260, lat:12.9888029, name:"Hoodi · Purple Line", src:"geo-stn-hoodi" },
  garudachar:  { lng:77.7036768, lat:12.9934505, name:"Garudacharpalya · Purple Line", src:"geo-stn-garudacharpalya" },
  pattandur:   { lng:77.7377718, lat:12.9876393, name:"Pattandur Agrahara · Purple Line", src:"geo-stn-pattandur" },
  nallurhalli: { lng:77.7248845, lat:12.9766408, name:"Nallurahalli · Purple Line", src:"geo-stn-nallurhalli" },
  saisathya:   { lng:77.7275361, lat:12.9811949, name:"Sri Sathya Sai Hospital · Purple Line", src:"geo-stn-saisathya" },
  beratena:    { lng:77.6579036, lat:12.8638780, name:"Beratena Agrahara · Yellow Line", src:"geo-stn-beratena" },
  seetharampalya: { lng:77.7087854, lat:12.9808558, name:"Seetharampalya · Purple Line", src:"geo-stn-seetharampalya" },
};

/* ---------------------------------------------------------------------------
   OPTIONS — one per deck property, sorted by DECK metro distance ascending
   (nearest first). PROVISIONAL sort: re-derive via Mappls when credentials
   land (Phase 1 blocked — evidence/mappls-endpoints.md when filed).
   `metroKm` is the deck-stated figure (unconfirmed), used ONLY for sorting.
--------------------------------------------------------------------------- */
const OPTIONS = [
  { bldg:"primeco", name:"Primeco Union City — Tower B", locality:"Whitefield",
    costPerSeat: 9800, costSrc:"primeco-cost",
    floorsTotal:"2 Basement + Ground + 12", floorsSrc:"primeco-floors",
    floorOffered:"Part of 2nd floor", offeredSrc:"primeco-offered",
    condition:"Warm shell", conditionSrc:"primeco-offered",
    metroName:"Whitefield (Kadugodi)", metroDist:"0.8 km", metroSrc:"primeco-metro", metroKm:0.8,
    kia:"39 km", kiaSrc:"primeco-kia-km",
    parking:"1 car park / 1000 sqft", parkingSrc:"deck-source",
    coordSrc:"geo-primeco", coordConfirmed:true },
  { bldg:"sumadhura", name:"Sumadhura Capitol", locality:"Whitefield",
    costPerSeat: 10200, costSrc:"sumadhura-cost",
    floorsTotal:"Wing A & B: 3 Basements + Ground + 11", floorsSrc:"sumadhura-floors",
    floorOffered:"Part of 1st floor", offeredSrc:"sumadhura-offered",
    condition:"Warm shell", conditionSrc:"sumadhura-offered",
    metroName:"Kadugodi Tree Park", metroDist:"~1.1 km", metroSrc:"sumadhura-metro", metroKm:1.1,
    kia:"~36 km", kiaSrc:"sumadhura-kia-km",
    parking:"1 car park / 1000 sqft", parkingSrc:"deck-source",
    coordSrc:"geo-sumadhura", coordConfirmed:true },
  { bldg:"starmark", name:"Starmark Camelot", locality:"Whitefield",
    floorsTotal:null, floorsSrc:null,
    floorOffered:null, offeredSrc:null,
    condition:null, conditionSrc:null,
    parking:null, parkingSrc:null,
    coordSrc:"geo-starmark", coordConfirmed:true },   // no deck entry — space details genuinely unknown
  { bldg:"purva", name:"Purva Gainz", locality:"Electronic City · Hosur Road",
    floorsTotal:null, floorsSrc:null,
    floorOffered:null, offeredSrc:null,
    condition:null, conditionSrc:null,
    parking:null, parkingSrc:null,
    coordSrc:"geo-purva", coordConfirmed:true, coordPrecision:"project" },   // Google named-place pin; no surveyed footprint
  { bldg:"totalenv", name:"Total Environment — Imagine", locality:"EPIP Zone · ITPL Main Road",
    costPerSeat: 9600, costSrc:"totalenv-cost",
    floorsTotal:"Basement + Ground + 21", floorsSrc:"totalenv-floors",
    floorOffered:"9th or 10th or 11th floor", offeredSrc:"totalenv-offered",
    condition:"Warm shell", conditionSrc:"totalenv-offered",
    metroName:"Hoodi", metroDist:"1.2 km", metroSrc:"totalenv-metro", metroKm:1.2,
    kia:"39.6 km", kiaSrc:"totalenv-kia-km",
    parking:"1 car park / 1000 sqft", parkingSrc:"deck-source",
    coordSrc:"geo-totalenv-v2", coordConfirmed:true },   // OSM way/1145006727, No.78 ITPL Main Rd
  { bldg:"yliving", name:"Y Living", locality:"Kaveri Nagara · Whitefield",
    costPerSeat: 9600, costSrc:"yliving-cost",
    floorsTotal:"Basement + Ground + 8", floorsSrc:"yliving-floors",
    floorOffered:"5th & 6th floor", offeredSrc:"yliving-offered",
    condition:"Warm shell", conditionSrc:"yliving-offered",
    metroName:"Garudacharpalya", metroDist:"2.4 km", metroSrc:"yliving-metro", metroKm:2.4,
    kia:"42.8 km", kiaSrc:"yliving-kia-km",
    parking:"1 car park / 1000 sqft", parkingSrc:"deck-source",
    coordSrc:"geo-yliving-v3", coordConfirmed:true, coordPrecision:"project" },   // project location verified; not a surveyed footprint
];

/* ---------------------------------------------------------------------------
   BUILDINGS — OSM-verified centroids + footprints (geo.js) where matched;
   totalenv/yliving are OSM locality centroids (unconfirmed, ledger geo-*).
   stnLng/stnLat/stnName = deck-named nearest metro station (verified node).
--------------------------------------------------------------------------- */
function stn(s){ return { stnLng:s.lng, stnLat:s.lat, stnName:s.name }; }

const BUILDINGS = [
  { id:"primeco", name:"Primeco Union City — Tower B", block:"Whitefield", isOption:true, type:"tower",
    ...geoToMeters(12.989057, 77.732626), ...stn(ST.pattandur),
    w:55, d:45, h:42, floors:13, color:0x9aa7b5 },
  { id:"sumadhura", name:"Sumadhura Capitol", block:"Whitefield", isOption:true, type:"tower",
    ...geoToMeters(12.984959, 77.750298), ...stn(ST.kadugodi),
    w:70, d:55, h:38, floors:12, color:0x9aa7b5 },
  { id:"starmark", name:"Starmark Camelot", block:"Whitefield", isOption:true, type:"tower",
    ...geoToMeters(12.9849722, 77.7266886), ...stn(ST.saisathya),   // OSM way/1303625869 — CONFIRMED footprint
    w:60, d:45, h:38, floors:12, color:0x9aa7b5 },
  { id:"purva", name:"Purva Gainz", block:"Electronic City", isOption:true, type:"tower",
    ...geoToMeters(12.8662484, 77.6568443), ...stn(ST.beratena),   // Google Maps place pin — single-source
    w:55, d:45, h:45, floors:14, color:0x9aa7b5 },
  { id:"totalenv", name:"Total Environment — Imagine", block:"EPIP Zone", isOption:true, type:"tower",
    ...geoToMeters(12.9876277, 77.7307563), ...stn(ST.pattandur),   // OSM way/1145006727 — CONFIRMED footprint
    w:50, d:40, h:70, floors:22, color:0x9aa7b5 },
  { id:"yliving", name:"Y Living", block:"Kaveri Nagara", isOption:true, type:"block",
    ...geoToMeters(12.9854982, 77.707817), ...stn(ST.seetharampalya),   // RERA PRM/KA/RERA/1251/446/PR/130722/005066 + named map listing
    w:40, d:35, h:29, floors:9, color:0x9aa7b5 }
];

/* Purple Line (operational, Whitefield stretch) — text metadata for panels.
   Drawn geometry lives in config.js as window.BKC_LINE3. */
const METRO = {
  purple: {
    name:"Namma Metro Purple Line — Whitefield stretch (OPERATIONAL)",
    status:"OPERATIONAL — client's top-priority connectivity",
    statusNote:"Stations on verified OSM nodes (ledger geo-stn-*). Alignment straight-through-stations, indicative (ledger geo-purple-alignment). Deck metro distances are client-stated and unconfirmed until Mappls verification.",
    path:[], stations:[]
  }
};

const NEIGHBORHOODS = [];
const RIVER_PATH = [];

const META = {
  client:"Basilic Fly Studio shortlist",
  business:"VFX studio office — ~5,000 sqft across Whitefield, Mahadevapura & Varthur (deck brief, unconfirmed)",
  brief:"Metro connectivity is the top priority · budget band ₹8,000–9,500/seat · all deck figures client-stated/unconfirmed",
  prepared:"Autopilot Offices · Basilic Fly inventory options deck (2026)",
  winner:null   // no pre-crowned winner — selection is the only accent; engine hides #winnerBtn when winner is null (mapbox_app.js wireUI)
};

window.BKC = { BAND, OPTIONS, BUILDINGS, METRO, NEIGHBORHOODS, RIVER_PATH, META };
