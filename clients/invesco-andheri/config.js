/* INVESCO — ANDHERI EAST / CHANDIVALI — client config (gate, framing, registry, metro overrides) */
window.CLIENT = {
  slug: "invesco-andheri",
  gate: { id: "INVDEMOACC", pass: "INV1234",
          sub: "Invitation-only geospatial experience for Invesco" },
  brand: {
    title: 'ATLAS <span style="color:var(--mut);font-weight:400">by Autopilot · Andheri East Digital Twin</span>',
    sub: "Geospatial intelligence view for Invesco · Andheri East & Chandivali"
  },
  winnerBtnText: "▶ Fly to K.P Aurum",
  tierColors: true,   // buildings wear their verdict: green/amber/red on the map
  shortlist: false,
  walkthrough: false, // no 360 virtual walkthrough for these properties
  rain: false,
  props: { trees: false, lamps: false },
  // Map framing: Marol cluster centre; Hubtown Solaris west, Kanakia east sit at frame edges
  map: { center: [72.8720, 19.1115], zoom: 13.9, pitch: 60, bearing: -18 },
  // Engine registry: renderMode/height/color per building id (heights from PDF structure × 3.2m)
  registry: {
    kpaurum:   { renderMode:"extrusion", heightMeters:38, color:"#2fbf71", footprintName:"KP Aurum" },
    hubtown:   { renderMode:"extrusion", heightMeters:45, color:"#2fbf71", footprintName:"Hubtown Solaris" },
    kanakia:   { renderMode:"extrusion", heightMeters:29, color:"#f0a020", footprintName:"Kanakia Boomerang" },
    rushabh:   { renderMode:"extrusion", heightMeters:22, color:"#f0a020", footprintName:"Rushabh Chambers" },
    indiana:   { renderMode:"extrusion", heightMeters:29, color:"#d1495b", footprintName:"Indiana House" },
    avenue723: { renderMode:"extrusion", heightMeters:48, color:"#d1495b", footprintName:"723 Avenue" },
    andheri_stn:   { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
    marolnaka_stn: { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
    sakinaka_stn:  { renderMode:"extrusion", heightMeters:10, color:"#14b8c4" },
  },
  hint: "Click any coloured property · two-finger drag pans · horizontal two-finger swipe orbits · pinch zooms"
};

/* Metro Line 1 (primary, solid) — Andheri → WEH → Chakala → Airport Road →
   Marol Naka → Saki Naka (alignment reused from the verified Andheri client). */
window.BKC_LINE3 = {
  path: [
    [72.84884,19.12056],[72.8481,19.1190],[72.8515,19.1130],[72.85465,19.1072],[72.8590,19.1085],
    [72.86735,19.11091],[72.87441,19.10935],[72.87949,19.10816],[72.8870,19.1035],[72.8960,19.0950]
  ],
  stations: [
    { name:"Andheri ⇄ Western Rly", lng:72.84884, lat:19.12056, interchange:true },
    { name:"WEH", lng:72.85465, lat:19.10720 },
    { name:"Chakala (J B Nagar)", lng:72.86735, lat:19.11091 },
    { name:"Airport Road", lng:72.87441, lat:19.10935 },
    { name:"Marol Naka ⇄ L3", lng:72.87949, lat:19.10816, interchange:true },
    { name:"Saki Naka", lng:72.8870, lat:19.1035 }
  ]
};
/* Metro Line 3 segment (dashed) — SEEPZ → MIDC → Marol Naka → T2 → Sahar Rd */
window.BKC_LINE2 = {
  path: [
    [72.8730,19.1245],[72.87593,19.11961],[72.87949,19.10816],[72.8745,19.0990],[72.86209,19.09861]
  ],
  stations: [
    { name:"MIDC (L3)", lng:72.87593, lat:19.11961 },
    { name:"Sahar Road (L3)", lng:72.86209, lat:19.09861 }
  ]
};
