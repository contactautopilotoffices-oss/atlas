/* CONNAUGHT PLACE / DELHI CBD — client config (gate, framing, registry, metro overrides) */
window.CLIENT = {
  slug: "cp-delhi",
  gate: { id: "CPDEMOACC", pass: "CP1234",
          sub: "Invitation-only geospatial experience · Delhi CBD options" },
  brand: {
    title: 'ATLAS <span style="color:var(--mut);font-weight:400">by Autopilot · Delhi CBD Digital Twin</span>',
    sub: "Geospatial intelligence view · Connaught Place · Jhandewalan · ITO"
  },
  lb: {
    title: "Why World Trade Center leads",
    why: 'Fit Index weights — <b>Asset grade 35% · Handover condition 30% · Metro walk 20% · Parking 15%</b>. WTC and Thapar House are the only Grade A + furnished + immediate combinations in the CBD core; WTC adds a ground-floor unit and the set’s only free parking. Bare shell and satellite Grade B options drop to Stretch.'
  },
  winnerBtnText: "▶ Fly to World Trade Center",
  tierColors: true,   // buildings wear their verdict: green/amber/red on the map
  shortlist: false,          // no shortlist button for Delhi properties
  walkthrough: false,        // no 360 virtual walkthrough for Delhi properties
  props: false,             // no street props for Delhi — tile-derived kerb offsets misalign on CP's wide avenues
  rain: false,              // no rain-on-lens for this client (weather chip stays live)
  // Map framing: Connaught Place CBD core at zoom 15.6, pitch 60°, bearing -20°
  map: { center: [77.2215, 28.6315], zoom: 15.6, pitch: 60, bearing: -20 },
  // Engine registry: renderMode/height/color per building id (heights from PDF structure × 3.2m)
  registry: {
    wtc:          { renderMode:"extrusion", heightMeters:20, color:"#2fbf71", footprintName:"World Trade Center" },
    thapar:       { renderMode:"extrusion", heightMeters:16, color:"#2fbf71", footprintName:"Thapar House" },
    statesman:    { renderMode:"extrusion", heightMeters:54, color:"#f0a020", footprintName:"Statesman House" },
    dlfcapitol:   { renderMode:"extrusion", heightMeters:26, color:"#f0a020", footprintName:"DLF Capitol Point" },
    videocon:     { renderMode:"extrusion", heightMeters:45, color:"#2fbf71", footprintName:"Videocon Tower" },
    indraprakash: { renderMode:"extrusion", heightMeters:42, color:"#f0a020", footprintName:"Indra Prakash" },
    kanchenjunga: { renderMode:"extrusion", heightMeters:35, color:"#f0a020", footprintName:"Kanchenjunga" },
    barakhamba:   { renderMode:"extrusion", heightMeters:35, color:"#d1495b", footprintName:"Barakhamba Tower" },
    nehruhouse:   { renderMode:"extrusion", heightMeters:16, color:"#d1495b", footprintName:"Nehru House" },
    milap:        { renderMode:"extrusion", heightMeters:16, color:"#d1495b", footprintName:"Milap Bhawan" },
    rajivchowk_stn:  { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
    barakhamba_stn:  { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
    mandihouse_stn:  { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
    janpath_stn:     { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
    jhandewalan_stn: { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
    ito_stn:         { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
  },
  hint: "Click any coloured property · two-finger drag pans · horizontal two-finger swipe orbits · pinch zooms"
};

/* Blue Line (primary, solid) — Jhandewalan → R K Ashram → Rajiv Chowk →
   Barakhamba Road → Mandi House. Stations on OSM nodes; alignment indicative. */
window.BKC_LINE3 = {
  path: [
    [77.19992,28.64432],[77.20858,28.63924],[77.21360,28.63590],
    [77.21931,28.63271],[77.22525,28.62981],[77.23420,28.62561]
  ],
  stations: [
    { name:"Jhandewalan", lng:77.19992, lat:28.64432 },
    { name:"R K Ashram Marg", lng:77.20858, lat:28.63924 },
    { name:"Rajiv Chowk ⇄ Yellow", lng:77.21931, lat:28.63271, interchange:true },
    { name:"Barakhamba Road", lng:77.22525, lat:28.62981 },
    { name:"Mandi House ⇄ Violet", lng:77.23420, lat:28.62561, interchange:true }
  ]
};
/* Violet Line arm (dashed) — Janpath → Mandi House → ITO */
window.BKC_LINE2 = {
  path: [
    [77.21926,28.62405],[77.22800,28.62430],[77.23420,28.62561],[77.24104,28.62819]
  ],
  stations: [
    { name:"Janpath (Violet)", lng:77.21926, lat:28.62405 },
    { name:"ITO (Violet)", lng:77.24104, lat:28.62819 }
  ]
};
