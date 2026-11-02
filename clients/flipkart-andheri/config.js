/* FLIPKART ANDHERI - client config (gate, framing, registry, metro overrides) */
window.CLIENT = {
  slug: "flipkart-andheri",
  gate: { id: "FLIPDEMOACC", pass: "FLIP1234",
          sub: "Invitation-only geospatial experience for Flipkart" },
  brand: {
    title: 'ATLAS <span style="color:var(--mut);font-weight:400">by Autopilot · Andheri East Digital Twin</span>',
    sub: "Geospatial intelligence view for Flipkart · ~220 seats @ 4×2"
  },
  lb: {
    title: "Why 723 Avenue leads",
    why: 'Tiered by Flipkart\u2019s three asks: <b>contiguous block for 220 seats (4x2, about 55 sqft/seat)</b> | <b>2 metro hops or fewer from the Central Line</b> (Ghatkopar to Line 1) | <b>Line 3 = a 3rd hop = downgrade</b>. Numbers shown are real seat capacity, not scores. 723 Avenue is the client\u2019s Priority 1 and Corporate Avenue its Priority 2. Privilon has the most space (278 seats) but its floors and Jan 2027 approvals are unconfirmed.'
  },
  winnerBtnText: "\u25b6 Fly to 723 Avenue (Priority 1)",
  tierColors: true,   // buildings wear their verdict: green/amber/red on the map
  shortlistText: "Add to Flipkart shortlist",
  // Map framing: Gundavali to Marol Naka belt along Andheri-Kurla Rd
  map: { center: [72.8710, 19.1105], zoom: 14.2, pitch: 60, bearing: -18 },
  // Engine registry: renderMode/height/color per building id (heights from sheet G+N x 3.2m)
  registry: {
    avenue723:   { renderMode:"extrusion", heightMeters:51, color:"#2fbf71", footprintName:"723 Avenue" },
    corporate:   { renderMode:"extrusion", heightMeters:29, color:"#2fbf71", footprintName:"Corporate Avenue" },
    privilon:    { renderMode:"extrusion", heightMeters:51, color:"#f0a020", footprintName:"Privilon" },
    vaman:       { renderMode:"extrusion", heightMeters:26, color:"#f0a020", footprintName:"Vaman Techno Centre" },
    landmark:    { renderMode:"extrusion", heightMeters:22, color:"#f0a020", footprintName:"Landmark" },
    rustomjee:   { renderMode:"extrusion", heightMeters:32, color:"#f0a020", footprintName:"Rustomjee Central Park" },
    fulcrum:     { renderMode:"extrusion", heightMeters:32, color:"#d1495b", footprintName:"Fulcrum" },
    marolnaka_stn:{ renderMode:"extrusion", heightMeters:12, color:"#14b8c4", footprintName:"Marol Naka L1" },
    weh_stn:     { renderMode:"extrusion", heightMeters:12, color:"#14b8c4" },
    chakala_stn: { renderMode:"extrusion", heightMeters:12, color:"#14b8c4" },
  },
  hint: "Click any coloured property · two-finger drag pans · horizontal two-finger swipe orbits · pinch zooms"
};

/* Metro Line 1 (primary, solid): Andheri to Saki Naka, through the stations used by the options */
window.BKC_LINE3 = {
  path: [
    [72.8467,19.1197],[72.85639,19.11556],[72.86770,19.11205],[72.87475,19.11027],
    [72.87954,19.10820],[72.8870,19.1035],[72.8960,19.0950]
  ],
  stations: [
    { name:"WEH", lng:72.85639, lat:19.11556 },
    { name:"Chakala (J B Nagar)", lng:72.86770, lat:19.11205 },
    { name:"Airport Road", lng:72.87475, lat:19.11027 },
    { name:"Marol Naka \u21c4 L3", lng:72.87954, lat:19.10820, interchange:true },
    { name:"Saki Naka", lng:72.8870, lat:19.1035 }
  ]
};
/* Metro Line 3 segment (dashed = the 3rd hop): Marol Naka to Sahar Road */
window.BKC_LINE2 = {
  path: [
    [72.87954,19.10820],[72.8745,19.0990],[72.86209,19.09861]
  ],
  stations: [
    { name:"Sahar Road (L3 \u00b7 3rd hop)", lng:72.86209, lat:19.09861 }
  ]
};
