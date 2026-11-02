#!/usr/bin/env node
/* ============================================================================
   ATLAS · Flipkart, Andheri East

     node scripts/examples/flipkart-andheri.js
         writes examples/flipkart-andheri.bundle.json and
         engine/atlases/flipkart-andheri.js (the page at /flipkart-andheri)

   The Flipkart atlas, rebuilt on the engine like the Andheri, Chennai and
   Noida studies: one bundle, every claim carrying its source.

   WHAT IS ON SCREEN
     The deck   "Flipkart Property Inventory, Andheri East" (Autopilot, Nov
                2026), 7 slides. Carpet and built-up area, grade, furnishing,
                efficiency, possession, per seat, floors, ceiling height,
                parking, parking charges, Fire NOC, OC & CC and DG are copied
                from it word for word. The deck marks 723 Avenue as PRIORITY 1
                and Corporate Avenue as PRIORITY 2.
     Research   The deck carries no connectivity and no coordinates. Metro
                stations and walking distances, and every pin, were researched
                in Nov 2026 from developer, broker and operator pages, MMRCL
                and Wikipedia; each says where it came from.

   Nothing else goes on screen. No seat counts, tiers, scores, chooser, flags
   or commentary: if it is not in the deck, or the research above, it is not
   in the atlas. (Earlier drafts carried seats at 4x2, a three-way verdict and
   a priority chooser; the client asked for them to be removed.)
   ============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SLUG = "flipkart-andheri";
const ACCESS = { id: "FLIPDEMOACC", pass: "FLIP1234" };
const DECK = "Flipkart Property Inventory, Andheri East (Autopilot deck, Nov 2026)";

/* ---- the deck, one block per slide, in slide order ---------------------- */
const D = [
  { id: "723-avenue", name: "723 Avenue", priority: "PRIORITY 1", floor: "13th & 14th", micro: "marol", grade: "A", floors: "G+15",
    furnishing: "Bareshell", efficiency: "60%", carpet: 11331, builtUp: 18885, ceiling: "11.7 ft", perSeat: "Rs. 16,000 - Rs. 16,500 + GST",
    parking: "11 Car Parking", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", microText: "Marol" },
  { id: "corporate-avenue", name: "Corporate Avenue", priority: "PRIORITY 2", floor: "3rd and 4th", micro: "chakala", grade: "A-", floors: "G+8",
    furnishing: "Furnished", efficiency: "60%", carpet: 12414, builtUp: 20690, ceiling: "11 ft", perSeat: "Rs. 15,200 - Rs. 15,700 + GST",
    parking: "5 car parking per floor", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", microText: "Chakala" },
  { id: "vaman-techno-centre", name: "Vaman Techno Centre", priority: "", floor: "3rd", micro: "marol-metro-station", grade: "B", floors: "G+7",
    furnishing: "Bareshell", efficiency: "62%", carpet: 12300, builtUp: 19700, ceiling: "11 ft - 12 ft (approx.)", perSeat: "Rs. 13,400 - Rs. 13,900 + GST",
    parking: "13 Car parking", parkingCharges: "Rs. 5,000 per car park per month + Taxes", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", microText: "Marol Metro Station" },
  { id: "privilon", name: "Privilon", priority: "", floor: "Multiple", micro: "marol", grade: "A", floors: "G+15",
    furnishing: "Bareshell", efficiency: "60%", carpet: 11331, builtUp: 18885, ceiling: "11.7 ft", perSeat: "Rs. 18,000 - Rs. 18,500 + GST",
    parking: "5 Car parking", parkingCharges: "To Be Discussed", noc: "Jan 2027", occ: "Jan 2027", dg: "Common area only", possession: "Jan 2027", microText: "Marol" },
  { id: "landmark", name: "Landmark", priority: "", floor: "6th", micro: "weh", grade: "B", floors: "G+6",
    furnishing: "Furnished", efficiency: "60%", carpet: 10000, builtUp: 16666.7, ceiling: "11 ft (approx.)", perSeat: "Rs. 15,200 - Rs. 15,700 + GST",
    parking: "8 car parking", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", microText: "Western Express Highway" },
  { id: "rustomjee-central-park", name: "Rustomjee Central Park", priority: "", floor: "4th", micro: "chakala", grade: "B", floors: "G+9",
    furnishing: "Furnished", efficiency: "60%", carpet: 9000, builtUp: 15000, ceiling: "12 ft", perSeat: "Rs. 16,000 - Rs. 16,500 + GST",
    parking: "10 Car parking", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Feb 2027 - Can be discussed for early vacancy", microText: "Chakala" },
  { id: "fulcrum", name: "Fulcrum", priority: "", floor: "1st", micro: "csmi", grade: "B+", floors: "G+9",
    furnishing: "Furnished", efficiency: "65%", carpet: 11700, builtUp: 18000, ceiling: "11 ft - 12 ft (approx.)", perSeat: "Rs. 14,400 - Rs. 14,900 + GST",
    parking: "9 car parking", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", microText: "CSMI Metro" },
];

/* ---- research: pins and connectivity, each with its source -------------- */
const R = {
  "723-avenue": {
    lat: 19.109713, lng: 72.884422, precision: "building", geoSrc: "https://dhcrealty.in/property/wadhwa-723-avenue/",
    geoNote: "Plus code 4V5M+VQM printed on the listing, decoded. Marol Co-operative Industrial Estate Road, off Andheri-Kurla Road.",
    address: "Wadhwa 723 Avenue, Marol Co-operative Industrial Estate Road, Sag Baug, Marol, Andheri East, Mumbai 400059",
    metro: "Marol Naka (Line 1 and Line 3)", walk: "about 1 km on the developer's figure (540 m in a straight line from the pin)",
    metroSrc: "https://houseofwadhwa.com/wp-content/uploads/2023/08/Wadhwa-723-Avenue-Project-Brochure-3.pdf", metroNote: "The developer's brochure: '1 km away from Marol Naka Metro Station'." },
  "corporate-avenue": {
    lat: 19.110625, lng: 72.859637, precision: "complex", geoSrc: "https://exa.ai/library/place/3kk3s3wpqbl",
    geoNote: "Map place page; Wikimapia outlines 'Corporate Avenue (Atul Projects)' 55 m away. Sonawala Road, off Andheri-Kurla Road.",
    address: "Corporate Avenue, Sonawala Road, off Andheri-Kurla Road, Chakala, Andheri East, Mumbai",
    metro: "Western Express Highway and Gundavali", walk: "650 m, 9 min walk; Chakala (J B Nagar) 850 m",
    metroSrc: "https://myhq.in/dedicated/coworking-space/atul-corporate-avenue-chakala", metroNote: "myHQ lists Gundavali and WEH at 650 m (9 min) and Chakala J B Nagar at 850 m (11 min)." },
  "vaman-techno-centre": {
    lat: 19.111483, lng: 72.882235, precision: "building", geoSrc: "https://exa.ai/library/place/3vrh78m08q4",
    geoNote: "Map place page. Makwana Road, Marol. About 460 m from Marol Naka station in a straight line.",
    address: "Vaman Techno Centre, Makwana Road, Gamdevi, Marol, Andheri East, Mumbai 400059",
    metro: "Marol Naka (Line 1 and Line 3)", walk: "about 7 min walk",
    metroSrc: "https://www.office-hub.com/in/properties/makwana-rd-marol-circle-near-web-techneeq-gamdevi-marol-andheri-east-mumbai-maharashtra-a0vQg000004wOE9IAM", metroNote: "Office Hub, for the Awfis centre in this building: Marol Naka metro, 7 minute walk. Awfis's own page says 0.30 km." },
  "privilon": {
    lat: 19.108207, lng: 72.879563, precision: "approx", geoSrc: "https://exa.ai/library/place/s8x6jf6zts0",
    geoNote: "The place page pin sits within 10 m of the Marol Naka station coordinate, so it marks the address, not a footprint. The developer says 'right next to Marol Metro Station'.",
    address: "Privilon, Metro Station Marol Naka, Gamdevi, Marol, Andheri East, Mumbai 400059",
    metro: "Marol Naka (Line 1 and Line 3)", walk: "right next to the station",
    metroSrc: "https://bsafal.com/mumbai/", metroNote: "The developer: 'right next to Marol Metro Station'. OpenStreetMap puts Line 1 at about 0 m and Line 3 at about 100 m (mumbaipropertyexchange.com)." },
  "landmark": {
    lat: 19.116739, lng: 72.855679, precision: "building", geoSrc: "https://exa.ai/library/place/g4bgsvhmz93",
    geoNote: "Map place page for Landmark, Suren Road, Gundavali, at the junction of the Western Express Highway and Andheri-Kurla Road.",
    address: "Landmark, Suren Road, Gundavali, Andheri East, Mumbai 400093",
    metro: "Western Express Highway (Line 1 and Line 7)", walk: "about 200 m",
    metroSrc: "https://property.jll.co.in/listings/landmark-wing-a-suren-road-gundavali", metroNote: "JLL: 'just 200 metres from the Western Express Highway metro station'." },
  "rustomjee-central-park": {
    lat: 19.114042, lng: 72.860671, precision: "building", geoSrc: "https://exa.ai/library/place/83qqct91nth",
    geoNote: "Map place page; not the OSM 'Rustomjee' pin at 19.11642, 72.85428. Andheri-Kurla Road at the Chakala signal.",
    address: "Rustomjee Central Park, Andheri-Kurla Road, Chakala, Andheri East, Mumbai 400093",
    metro: "Western Express Highway (Line 1 and Line 7)", walk: "3 min walk; Chakala (J B Nagar) 0.7 km",
    metroSrc: "https://rustomjeeltd.net/central-park-business-spaces/", metroNote: "The developer: 'The nearest metro stop, Western Express Highway, is a 3 min walk away'; Chakala Metro Station 0.7 km." },
  "fulcrum": {
    lat: 19.101, lng: 72.8716, precision: "approx", geoSrc: "https://property.jll.co.in/listings/fulcrum-ia-project-road-ashok-nagar",
    geoNote: "An estimate. No map pin was found for the building; it adjoins the Hyatt Regency on IA Project Road, Sahar, so the pin is placed beside the hotel.",
    address: "Fulcrum, IA Project Road, Sahar Road, next to Hyatt Regency, Ashok Nagar, Andheri East, Mumbai 400099",
    metro: "Sahar Road (Line 3)", walk: "about 690 m, measured from the Hyatt Regency next door",
    metroSrc: "https://moovitapp.com/index/en/public_transit-Hyatt_Regency_Mumbai-Mumbai-site_36354746-3732", metroNote: "Moovit: Sahar Road station is 687 m and a 9 min walk from the Hyatt Regency. Line 3 only, so a 3rd hop for Central Line riders." },
};

/* ---- the card's one line: the deck's own words ------------------------- */
const reason = (o) => [o.priority, `Floor ${o.floor}`, o.furnishing, `Carpet area ${o.carpet.toLocaleString("en-US")} sq. ft.`, `Possession: ${o.possession}`, `Per seat: ${o.perSeat}`].filter(Boolean).join(" · ");

const sqft = (n) => n.toLocaleString("en-US") + " sq. ft.";
const options = D.map((o, i) => {
  const r = R[o.id];
  /* The deck's "Property specifications" table, in its order and its words. */
  const spec = [
    ["Micro-market", o.microText], ["Floor / Unit", o.floor], ["Grade", o.grade], ["Total floors", o.floors], ["Building type", "Commercial"],
    ["Furnishing", o.furnishing], ["Efficiency", o.efficiency], ["Carpet area", sqft(o.carpet)], ["Built-up area", sqft(o.builtUp)],
    ["Ceiling height", o.ceiling], ["Per seat", o.perSeat], ["Parking", o.parking], ["Parking charges", o.parkingCharges],
    ["Fire NOC", o.noc], ["OC & CC", o.occ], ["DG", o.dg], ["Possession", o.possession],
  ].filter(([, v]) => v);
  return {
    id: o.id, n: i + 1, name: o.name, lat: r.lat, lng: r.lng, precision: r.precision, geoSrc: r.geoSrc, geoNote: r.geoNote,
    micro: o.micro, reason: reason(o), address: r.address, locality: "Andheri East",
    facts: [
      ...spec.map(([k, v]) => ({ k, v, conf: "high" })),
      { k: "Nearest metro", v: `${r.metro}, ${r.walk}`, src: r.metroSrc, conf: "medium", note: r.metroNote },
    ],
  };
});

/* ---- transit: the lines these options are measured against -------------- */
const WIKI = (n) => `https://en.wikipedia.org/wiki/${n}`;
const transit = {
  asOf: "2026-11", asOfText: "November 2026",
  lines: [
    { key: "line1", name: "Metro Line 1 (Blue)", short: "L1", mode: "metro", color: "#1d6fa5", status: "open", src: WIKI("Western_Express_Highway_metro_station"),
      stations: [
        { name: "Western Express Highway", lat: 19.11556, lng: 72.85639, open: true },
        { name: "Chakala (J B Nagar)", lat: 19.112045, lng: 72.867696, open: true },
        { name: "Airport Road", lat: 19.11027, lng: 72.87475, open: true },
        { name: "Marol Naka", lat: 19.108195, lng: 72.879536, open: true },
        { name: "Saki Naka", lat: 19.103528, lng: 72.887962, open: true },
      ] },
    { key: "line3", name: "Metro Line 3 (Aqua)", short: "L3", mode: "metro", color: "#1d8a8a", status: "open", src: WIKI("Sahar_Road_metro_station"),
      note: "Drawn straight between the stations shown, so the line is indicative.",
      stations: [
        { name: "SEEPZ", lat: 19.125999, lng: 72.873727, open: true },
        { name: "MIDC Andheri", lat: 19.117352, lng: 72.873603, open: true },
        { name: "Marol Naka", lat: 19.108195, lng: 72.879536, open: true },
        { name: "Sahar Road", lat: 19.102196, lng: 72.865236, open: true },
      ] },
  ],
};

/* The micro-markets exactly as the deck names them. */
const zones = [
  { key: "chakala", label: "Chakala", name: "Chakala", color: "#2e7d5b" },
  { key: "marol", label: "Marol", name: "Marol", color: "#b7791f" },
  { key: "weh", label: "Western Express Highway", name: "Western Express Highway", color: "#1d6fa5" },
  { key: "marol-metro-station", label: "Marol Metro Station", name: "Marol Metro Station", color: "#8a3d6b" },
  { key: "csmi", label: "CSMI Metro", name: "CSMI Metro", color: "#5b7a8c" },
];

const bundle = {
  meta: {
    title: "Flipkart Andheri East Atlas",
    sub: "Office inventory options for Flipkart",
    asOf: "2026-11", asOfText: "November 2026", city: "Mumbai", center: [72.87, 19.1085], zoom: 13.5,
    stationShot: true,   /* selecting a building zooms to it and its nearest station and draws the walk */
    sheet: `${DECK}. Positions and connectivity researched Nov 2026; each carries its source.`,
  },
  options, zones, transit,
  copy: {
    overview: { eyebrow: "Autopilot · Andheri East · Nov 2026", title: "Flipkart office inventory, Andheri East",
      intro: "{optionCount} buildings from Autopilot's inventory deck, with the metro around them.", ranking: "The list" },
    /* No ranking is made, so the page says "list", not "ranked". */
    sort: { rank: "Listed order" },
    ranking: { ungrouped: "Options", option: "Option" },
    insights: { first: "First on the list" },
    option: { rank: false },
  },
};

/* The gate hash is SHA-256 of the normalised "ID:PASSWORD", as engine/app.js
   checks it. It is not the password, but it is guessable, so rotate the pair
   in the manifest and here together. It lives in the engine file only: the
   validator does not know a "gate" block. */
const GATE_HASH = crypto.createHash("sha256").update(`${ACCESS.id}:${ACCESS.pass}`.toUpperCase().replace(/[\s-]/g, "")).digest("hex");
const root = path.join(__dirname, "..", "..");
fs.mkdirSync(path.join(root, "examples"), { recursive: true });
fs.mkdirSync(path.join(root, "engine", "atlases"), { recursive: true });
fs.writeFileSync(path.join(root, "examples", `${SLUG}.bundle.json`), JSON.stringify(bundle, null, 1) + "\n");
fs.writeFileSync(path.join(root, "engine", "atlases", `${SLUG}.js`),
  "/* Generated by scripts/examples/flipkart-andheri.js. Do not edit: edit the script and rerun it. */\nwindow.ATLAS = " +
  JSON.stringify({ slug: SLUG, path: "/" + SLUG, gate: { hash: GATE_HASH }, ...bundle }) + ";\n");
console.log(`Wrote examples/${SLUG}.bundle.json and engine/atlases/${SLUG}.js (${options.length} options)`);
