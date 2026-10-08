/* ============================================================================
   DIGITIDE · NOIDA (Sectors 57 to 67) · client config
   Gate, framing, registry, Blue Line overrides and the POI/catchment layers
   the Atlas Requirement sheet asks for.

   REQUIREMENT SOURCE — workbook "Autopilot.Inventory_Option_for_Digitide.xlsx",
   sheet 2 "Atlas Requirement", seven numbered asks:
     1 building details (sheet 1)   2 Digitide's Sector 58 office
     3 PG accommodation             4 metro
     5 competitors                  6 talent pool 0-20 / 20-40 / 40-50 min
     7 educational institutes
   Each is a named POI layer below or a card section in the engine.
   ============================================================================ */
window.CLIENT = {
  slug: "digitide-noida",
  gate: { id: "DIGDEMOACC", pass: "DIG1234",
          sub: "Invitation-only geospatial experience · Noida office options" },
  brand: {
    title: 'ATLAS <span style="color:var(--mut);font-weight:400">by Autopilot · Noida Digital Twin</span>',
    sub: "20 buildings · Sectors 57 to 67 · Noida"
  },
  lb: {
    title: "Buildings screened",
    why: 'Twenty buildings across Sectors 57 to 67, each tagged with <b>Autopilot\'s verdict</b>: Recommended, Worth a look or Not suitable, with the reason on the card. Building figures are <b>broker-stated from the property options sheet (unconfirmed)</b>. Distances, competitor pins and talent bands are re-derived here and carry their own sources.'
  },
  tierColors: false,         // no verdict colouring — selection is the only accent
  shortlist: true,
  shortlistText: "Add to shortlist",
  walkthrough: false,        // one exterior photo per building, no walkthrough media
  photoMinimum: false,
  satellite: "on",           // Mapbox satellite imagery under the 3D city, on from the start; a crop on each pinned card       // one sheet photo per building is all there is; no "below minimum" note
  props: false,              // street props are BKC geography, not Noida
  rain: false,
  /* Competitor layer wording. The engine's default copy is the Bengaluru VFX
     brief; this client's competitor set is BPO/BPM employers competing for the
     same hiring pool, so the heading and radius have to say that instead. */
  competitorLabel: "BPO / BPM competitors nearby",
  competitorRadius: "3 km radius",
  /* POI layers — each becomes a toggle chip and a marker set. `key` matches
     POI[].layer in data.js. Requirement numbers from sheet 2 in brackets. */
  poiLayers: [
    { key:"anchor",     label:"Digitide office", icon:"D", color:"#2fbf71", on:true },   // [2]
    { key:"competitor", label:"Competitors",     icon:"C", color:"#e0603a", on:false },  // [5]
    { key:"pg",         label:"PG clusters",     icon:"P", color:"#4f9cd9", on:false },  // [3]
    { key:"edu",        label:"Institutes",      icon:"E", color:"#b681d8", on:false },  // [7]
    { key:"catchment",  label:"Talent pool",     icon:"T", color:"#d9b310", on:false },  // [6]
  ],
  // Map framing: the 20 buildings sit in a ~3.5 x 3 km box across Sectors 57 to
  // 67. Centre of that box, pitched back so the Blue Line corridor and
  // Digitide's existing Sector 58 office stay in frame together.
  map: { center: [77.3690, 28.6165], zoom: 12.8, pitch: 52, bearing: -12 },
  // Engine registry: heightMeters = above-ground floors x 3.2 m from the sheet's
  // building structure. Recommended and Worth a look read lighter than Not
  // suitable, so the shortlist stands out without a second accent colour.
  registry: {
    "tv18": { renderMode:"extrusion", heightMeters:13, color:"#d3dbe4" },
    "techm": { renderMode:"extrusion", heightMeters:10, color:"#d3dbe4" },
    "noida-d247": { renderMode:"extrusion", heightMeters:11, color:"#d3dbe4" },
    "magnus": { renderMode:"extrusion", heightMeters:19, color:"#d3dbe4" },
    "noida-a38": { renderMode:"extrusion", heightMeters:13, color:"#8f99a4" },
    "noida-b25": { renderMode:"extrusion", heightMeters:16, color:"#8f99a4" },
    "noida-b13": { renderMode:"extrusion", heightMeters:13, color:"#8f99a4" },
    "noida-a31": { renderMode:"extrusion", heightMeters:13, color:"#8f99a4" },
    "noida-d212": { renderMode:"extrusion", heightMeters:6, color:"#8f99a4" },
    "noida-bhutani": { renderMode:"extrusion", heightMeters:35, color:"#8f99a4" },
    "noida-d233": { renderMode:"extrusion", heightMeters:10, color:"#8f99a4" },
    "noida-c56a3": { renderMode:"extrusion", heightMeters:26, color:"#8f99a4" },
    "noida-c5646": { renderMode:"extrusion", heightMeters:16, color:"#8f99a4" },
    "noida-a100": { renderMode:"extrusion", heightMeters:13, color:"#8f99a4" },
    "kboulevard": { renderMode:"extrusion", heightMeters:32, color:"#8f99a4" },
    "noida-c24": { renderMode:"extrusion", heightMeters:13, color:"#8f99a4" },
    "noida-a94-9": { renderMode:"extrusion", heightMeters:10, color:"#8f99a4" },
    "noida-c49": { renderMode:"extrusion", heightMeters:10, color:"#8f99a4" },
    "noida-c20": { renderMode:"extrusion", heightMeters:29, color:"#8f99a4" },
    "noida-vin": { renderMode:"extrusion", heightMeters:29, color:"#8f99a4" },
  },

  hint: "Click any property · two-finger swipe pans · shift-swipe or right-drag orbits · pinch zooms"
};

/* ---------------------------------------------------------------------------
   DELHI METRO BLUE LINE — Noida eastern stretch (requirement 4).
   Stations are the four Wikipedia-published station coordinates that serve the
   shortlist; every one is cited in evidence/ledger.jsonl (geo-stn-* rows).
   ALIGNMENT: straight-through-stations, INDICATIVE — not surveyed track
   geometry. The viaduct runs along the Noida-Greater Noida link road and curves
   between stations; this polyline does not. It is drawn only when
   CLIENT.metroLine is set, which it is not, so it serves as station ordering
   and panel metadata rather than as a map claim.
   Sector 52 was added once a verified coordinate for it came back from the
   Google Maps pass; it anchors the southern end of the drawn stretch and is the
   Blue Line side of the Sector 51 Aqua Line walking transfer. Sector 34 and City
   Centre stay out: neither is the nearest station to any shortlisted property.
--------------------------------------------------------------------------- */
window.BKC_LINE3 = {
  name: "Delhi Metro Blue Line — Noida eastern stretch",
  color: "#2b6cb0",
  path: [
    [77.3723810, 28.5871560],
    [77.3722988, 28.5976310],
    [77.3727259, 28.6064930],
    [77.3736097, 28.6169948],
    [77.3749300, 28.6279412]
  ],
  stations: [
    { name:"Noida Sector 52", lng:77.3723810, lat:28.5871560 },
    { name:"Noida Sector 61", lng:77.3722988, lat:28.5976310 },
    { name:"Noida Sector 59", lng:77.3727259, lat:28.6064930 },
    { name:"Noida Sector 62", lng:77.3736097, lat:28.6169948 },
    { name:"Noida Electronic City", lng:77.3749300, lat:28.6279412 }
  ]
};
