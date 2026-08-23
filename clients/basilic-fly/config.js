/* BASILIC FLY STUDIO — client config (gate, framing, registry, Purple Line overrides) */
window.CLIENT = {
  slug: "basilic-fly",
  gate: { id: "FLYDEMOACC", pass: "FLY1234",   // PLACEHOLDER — rotate before deploy; real password supplied by user out of band
          sub: "Invitation-only geospatial experience · Bengaluru office options" },
  brand: {
    title: 'ATLAS <span style="color:var(--mut);font-weight:400">by Autopilot · Basilic Fly Studio — Whitefield Digital Twin</span>',
    sub: "Geospatial intelligence view · Whitefield · Mahadevapura · Varthur · Electronic City · Bengaluru"
  },
  lb: {
    title: "Options for Basilic Fly Studio",
    why: 'Every figure is <b>client-stated from the broker deck (unconfirmed)</b> until Mappls verification lands. Band: <b>₹8,000–9,500/seat</b>. Metro connectivity is the top priority.'
  },
  tierColors: false,         // no verdict colouring — truth-first: selected property is the only accent
  shortlist: true,
  walkthrough: false,        // no verified media yet — honest empty states instead
  props: false,              // no street props — roads layer is BKC geography, not Whitefield
  rain: false,
  // Map framing: fitted to the Whitefield/ITPL cluster + Brigade Utopia (Varthur, far south) + Purple Line stretch
  // Framing spans two clusters: Whitefield/ITPL (north-east) and Electronic City
  // (south-west, Purva Gainz). Centroid of the 8-property bbox; zoomed out one step
  // and pitched flatter so both ends stay on screen.
  map: { center: [77.7036, 12.9282], zoom: 11.6, pitch: 50, bearing: -15 },
  // Engine registry: heightMeters = deck total floors (above ground) × 3.2m — deck page cited per row.
  // primeco  G+12 → 13×3.2 (deck p4) · totalenv G+21 → 22×3.2 (p5) · sumadhura G+11 → 12×3.2 (p6)
  // yliving  G+8  →  9×3.2 (deck p7) · starmark/purva have no deck entry (heights indicative)
  registry: {
    primeco:   { renderMode:"extrusion", heightMeters:42, color:"#9aa7b5", footprintName:"Primeco Union City — Tower B" },
    sumadhura: { renderMode:"extrusion", heightMeters:38, color:"#9aa7b5", footprintName:"Sumadhura Capitol" },
    totalenv:  { renderMode:"extrusion", heightMeters:70, color:"#9aa7b5", footprintName:"Total Environment — Imagine" },
    yliving:   { renderMode:"extrusion", heightMeters:29, color:"#9aa7b5" },  // no OSM footprint — fallback box at unconfirmed locality centroid
    starmark:  { renderMode:"extrusion", heightMeters:38, color:"#9aa7b5", footprintName:"Starmark Camelot" },
    purva:     { renderMode:"extrusion", heightMeters:45, color:"#9aa7b5" },   // no OSM footprint — box at Google place pin
  },
  hint: "Click any property · two-finger drag pans · horizontal two-finger swipe orbits · pinch zooms"
};

/* Namma Metro PURPLE LINE — Whitefield stretch (Singayyanapalya → Whitefield (Kadugodi)).
   Stations are verified OSM railway=station nodes (evidence/ledger.jsonl geo-stn-* rows,
   raw responses recon/osm/basilic-metro_stations.json).
   ALIGNMENT: straight-through-stations — OSM railway=subway geometry was fetched
   (recon/osm/basilic-purple-*.json) but dual tracks + an incomplete route relation
   make automated chaining unreliable; segments between stations are indicative
   straight lines, not surveyed alignment (ledger geo-purple-alignment). */
window.BKC_LINE3 = {
  name: "Namma Metro Purple Line — Whitefield stretch",
  color: "#7b2d8e",
  path: [
    [77.6927176,12.9965445],  // Singayyanapalya
    [77.7036768,12.9934505],  // Garudacharpalya
    [77.7087854,12.9808558],  // Seetharampalya
    [77.7113260,12.9888029],  // Hoodi
    [77.7155586,12.9775940],  // Kundalahalli
    [77.7248845,12.9766408],  // Nallurahalli
    [77.7275361,12.9811949],  // Sri Sathya Sai Hospital
    [77.7377718,12.9876393],  // Pattandur Agrahara
    [77.7470121,12.9856503],  // Kadugodi Tree Park
    [77.7538033,12.9873426],  // Hopefarm Channasandra
    [77.7579489,12.9957428],  // Whitefield (Kadugodi) — terminus
  ],
  stations: [
    { name:"Singayyanapalya", lng:77.6927176, lat:12.9965445 },
    { name:"Garudacharpalya", lng:77.7036768, lat:12.9934505 },
    { name:"Seetharampalya", lng:77.7087854, lat:12.9808558 },
    { name:"Hoodi", lng:77.7113260, lat:12.9888029 },
    { name:"Kundalahalli", lng:77.7155586, lat:12.9775940 },
    { name:"Nallurahalli", lng:77.7248845, lat:12.9766408 },
    { name:"Sri Sathya Sai Hospital", lng:77.7275361, lat:12.9811949 },
    { name:"Pattandur Agrahara", lng:77.7377718, lat:12.9876393 },
    { name:"Kadugodi Tree Park", lng:77.7470121, lat:12.9856503 },
    { name:"Hopefarm Channasandra", lng:77.7538033, lat:12.9873426 },
    { name:"Whitefield (Kadugodi)", lng:77.7579489, lat:12.9957428 }
  ]
};
/* Namma Metro YELLOW LINE — Rashtreeya Vidyalaya Road ↔ Bommasandra.
   Added when the shortlist widened past Whitefield: Purva Gainz sits on Hosur Road,
   290 m from Beratena Agrahara, and the Purple Line is 14 km away from it.
   Stations are verified OSM railway=station nodes on route relation 19421944
   (raw response recon/osm/yellow-stations.json). ALIGNMENT: straight-through-stations,
   indicative between stations — not surveyed geometry (same caveat as the Purple Line). */
window.BKC_LINE2 = {
  name: "Namma Metro Yellow Line — Hosur Road corridor",
  color: "#d9b310",
  path: [
    [77.5802015,12.9215807],  // Rashtreeya Vidyalaya Road,
    [77.5883015,12.9170807],  // Ragigudda,
    [77.5999663,12.916731],  // Jayadeva Hospital,
    [77.6081182,12.9165878],  // BTM Layout,
    [77.620567,12.9165816],  // Central Silk Board,
    [77.6264782,12.9106157],  // Bommanahalli,
    [77.6319861,12.9016952],  // Hongasandra,
    [77.6392156,12.8899259],  // Kudlu Gate,
    [77.6448456,12.8808178],  // Singasandra,
    [77.652447,12.8707491],  // Hosa Road,
    [77.6579036,12.863878],  // Beratena Agrahara,
    [77.6635228,12.8565053],  // Electronic City,
    [77.6711872,12.8464399],  // Infosys Foundation Konappana Agrahara,
    [77.6773716,12.8391572],  // Huskur Road,
    [77.6813744,12.8290325],  // Biocon Hebbagodi,
    [77.6883453,12.8193944],  // Delta Electronics Bommasandra
  ],
  stations: [
    { name:"Rashtreeya Vidyalaya Road", lng:77.5802015, lat:12.9215807 },
    { name:"Ragigudda", lng:77.5883015, lat:12.9170807 },
    { name:"Jayadeva Hospital", lng:77.5999663, lat:12.916731 },
    { name:"BTM Layout", lng:77.6081182, lat:12.9165878 },
    { name:"Central Silk Board", lng:77.620567, lat:12.9165816 },
    { name:"Bommanahalli", lng:77.6264782, lat:12.9106157 },
    { name:"Hongasandra", lng:77.6319861, lat:12.9016952 },
    { name:"Kudlu Gate", lng:77.6392156, lat:12.8899259 },
    { name:"Singasandra", lng:77.6448456, lat:12.8808178 },
    { name:"Hosa Road", lng:77.652447, lat:12.8707491 },
    { name:"Beratena Agrahara", lng:77.6579036, lat:12.863878 },
    { name:"Electronic City", lng:77.6635228, lat:12.8565053 },
    { name:"Infosys Foundation Konappana Agrahara", lng:77.6711872, lat:12.8464399 },
    { name:"Huskur Road", lng:77.6773716, lat:12.8391572 },
    { name:"Biocon Hebbagodi", lng:77.6813744, lat:12.8290325 },
    { name:"Delta Electronics Bommasandra", lng:77.6883453, lat:12.8193944 }
  ]
};
