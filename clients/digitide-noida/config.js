/* ============================================================================
   DIGITIDE — NOIDA (Sector 57 / 58 / 60 / 62 / 67) — client config
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
    sub: "Geospatial intelligence view · Sector 57 · 58 · 60 · 62 · 67 · Noida"
  },
  lb: {
    title: "Options for Clients",
    why: 'Every building figure is <b>client-stated from the inventory sheet (unconfirmed)</b>. Distances, competitor pins and talent bands are re-derived here and carry their own sources. Metro access and talent catchment are the ranking priorities.'
  },
  tierColors: false,         // no verdict colouring — selection is the only accent
  shortlist: true,
  shortlistText: "Add to shortlist",
  walkthrough: false,        // no captured media for these properties yet
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
  // Map framing: the five options sit in a ~4 km box across Sector 57-67. Centroid
  // of that box, pitched back so the Blue Line corridor and Digitide's existing
  // Sector 58 office stay in frame together.
  map: { center: [77.3735, 28.6135], zoom: 12.7, pitch: 52, bearing: -12 },
  // Engine registry: heightMeters = above-ground floors × 3.2 m, floor counts from
  // the inventory sheet. techm 2B+G+2 → 3 · padget B+G+2 → 3 · tv18 2B+G+3 → 4
  // magnus 2B+G+5 → 6 · kboulevard B+S+G+9 → 10 (stilt counted as a level).
  registry: {
    techm:      { renderMode:"extrusion", heightMeters:10, color:"#9aa7b5" },
    padget:     { renderMode:"extrusion", heightMeters:10, color:"#9aa7b5" },
    tv18:       { renderMode:"extrusion", heightMeters:13, color:"#9aa7b5" },
    magnus:     { renderMode:"extrusion", heightMeters:19, color:"#9aa7b5" },
    kboulevard: { renderMode:"extrusion", heightMeters:32, color:"#9aa7b5" },
  },
  hint: "Click any property · toggle the talent, competitor, PG and institute layers above"
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
