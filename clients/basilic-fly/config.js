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
   ALIGNMENT: REAL. Track geometry from OSM route relation 7841331 (raw response
   recon/osm/purple-alignment.json). Dual tracks defeated naive end-to-end chaining,
   so each point is projected onto the station sequence, filtered to a ~275 m
   corridor, and bucket-averaged — which collapses the two tracks to one centreline
   and preserves the real curve. Replaces the straight-line placeholder that cut
   diagonally across city blocks (ledger geo-purple-alignment-v2). */
window.BKC_LINE3 = {
  name: "Namma Metro Purple Line — Whitefield stretch",
  color: "#7b2d8e",
  path: [
    [77.6927176,12.9965445],
    [77.6930464,12.9964536],
    [77.693731,12.9962102],
    [77.6946718,12.9958002],
    [77.6954055,12.9954984],
    [77.6958819,12.9954081],
    [77.696998,12.9952721],
    [77.6980114,12.9951026],
    [77.6985418,12.9949094],
    [77.6991853,12.9946689],
    [77.7000233,12.9944014],
    [77.7008362,12.9942131],
    [77.7015224,12.9940525],
    [77.7023959,12.993794],
    [77.7033268,12.9935526],
    [77.7036768,12.9934505],
    [77.7044337,12.993256],
    [77.7058344,12.9930207],
    [77.708641,12.9863411],
    [77.7083538,12.9853756],
    [77.7082699,12.9843123],
    [77.70831,12.9831035],
    [77.7083879,12.982451],
    [77.7086554,12.981378],
    [77.7087854,12.9808558],
    [77.7086554,12.981378],
    [77.7084681,12.982074],
    [77.7083425,12.9826937],
    [77.7083133,12.9829892],
    [77.7082708,12.9839609],
    [77.7082744,12.9845002],
    [77.7083008,12.985079],
    [77.7084068,12.9856723],
    [77.7085753,12.98617],
    [77.7087066,12.9865123],
    [77.7091517,12.987277],
    [77.7097292,12.9878615],
    [77.7102671,12.9881656],
    [77.7111069,12.9886494],
    [77.711326,12.9888029],
    [77.7103448,12.9881992],
    [77.7131762,12.9779198],
    [77.714716,12.9777349],
    [77.7155586,12.977594],
    [77.7159458,12.977548],
    [77.7165088,12.9774659],
    [77.7175204,12.9773696],
    [77.7184192,12.9773014],
    [77.719845,12.9771914],
    [77.7216556,12.9769944],
    [77.7227444,12.9768777],
    [77.7231199,12.9768101],
    [77.7235936,12.9767378],
    [77.7243773,12.9766628],
    [77.7248845,12.9766408],
    [77.7255229,12.9765587],
    [77.726293,12.9765162],
    [77.726745,12.9766569],
    [77.7270527,12.976917],
    [77.7272402,12.9772416],
    [77.7272962,12.9774861],
    [77.7273114,12.9780455],
    [77.7273198,12.9784738],
    [77.7273128,12.9788052],
    [77.7272855,12.9794519],
    [77.7272905,12.9796921],
    [77.7273438,12.9801837],
    [77.7274254,12.9806324],
    [77.7274981,12.9810226],
    [77.7275361,12.9811949],
    [77.7276977,12.9818726],
    [77.7279537,12.9827006],
    [77.7284613,12.9836079],
    [77.729011,12.9843087],
    [77.7297159,12.9851276],
    [77.7304021,12.9857485],
    [77.7317891,12.9866123],
    [77.7322034,12.9870507],
    [77.7337981,12.987907],
    [77.7353066,12.9876858],
    [77.7362527,12.9876347],
    [77.7372334,12.9876376],
    [77.7377718,12.9876393],
    [77.7382191,12.987637],
    [77.7392017,12.9876362],
    [77.7400863,12.9876116],
    [77.7439323,12.9866544],
    [77.7454028,12.9862664],
    [77.7458499,12.9861211],
    [77.7470121,12.9856503],
    [77.7471946,12.9856078],
    [77.7481544,12.9852481],
    [77.749025,12.9849401],
    [77.7498792,12.9846397],
    [77.7511552,12.984242],
    [77.7516967,12.9842546],
    [77.7521648,12.9844199],
    [77.7526074,12.9847313],
    [77.752951,12.9851682],
    [77.7532814,12.9858967],
    [77.7536268,12.9867454],
    [77.7538033,12.9873426],
    [77.7539652,12.9875337],
    [77.7541399,12.9879405],
    [77.7545246,12.9888468],
    [77.7548004,12.989495],
    [77.7551071,12.9901001],
    [77.7553629,12.9904734],
    [77.7563761,12.9918121],
    [77.7568179,12.9923999],
    [77.7570449,12.9928198],
    [77.7572437,12.9934041],
    [77.7576555,12.9947495],
    [77.7577806,12.9951972],
    [77.7579489,12.9957428]
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
