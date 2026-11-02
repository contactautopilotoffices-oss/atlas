#!/usr/bin/env node
/* ============================================================================
   ATLAS · Flipkart, Andheri East

     node scripts/examples/flipkart-andheri.js
         writes examples/flipkart-andheri.bundle.json and
         engine/atlases/flipkart-andheri.js (the page at /flipkart-andheri)

   The Flipkart atlas, rebuilt on the engine like the Andheri, Chennai and
   Noida studies: one bundle, every claim carrying its source.

   WHAT COMES FROM WHERE
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
     Ours       Seats at 4x2 (carpet / 55 sqft) and the tiers are Autopilot's
                reading against the ~220-seat ask carried over from the earlier
                Flipkart brief. That ask is not in the deck; it is stated as
                client-stated and to be confirmed.

   Open questions are flagged on the option itself ("check first"), not
   smoothed over: Privilon's carpet equals 723 Avenue's in the deck, and
   Fulcrum's pin is an estimate.
   ============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SLUG = "flipkart-andheri";
const ACCESS = { id: "FLIPDEMOACC", pass: "FLIP1234" };
const SEAT_SQFT = 55, ASK = 220;
const DECK = "Flipkart Property Inventory, Andheri East (Autopilot deck, Nov 2026)";

/* ---- the deck, one block per slide, in slide order ---------------------- */
const D = [
  { id: "723-avenue", name: "723 Avenue", priority: "PRIORITY 1", floor: "13th & 14th", micro: "marol", grade: "A", floors: "G+15",
    furnishing: "Bareshell", efficiency: "60%", carpet: 11331, builtUp: 18885, ceiling: "11.7 ft", perSeat: "Rs. 16,000 - Rs. 16,500 + GST", perSeatLow: 16000, perSeatHigh: 16500,
    parking: "11 Car Parking", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", months: 0, microText: "Marol" },
  { id: "corporate-avenue", name: "Corporate Avenue", priority: "PRIORITY 2", floor: "3rd and 4th", micro: "chakala", grade: "A-", floors: "G+8",
    furnishing: "Furnished", efficiency: "60%", carpet: 12414, builtUp: 20690, ceiling: "11 ft", perSeat: "Rs. 15,200 - Rs. 15,700 + GST", perSeatLow: 15200, perSeatHigh: 15700,
    parking: "5 car parking per floor", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", months: 0, microText: "Chakala" },
  { id: "vaman-techno-centre", name: "Vaman Techno Centre", priority: "", floor: "3rd", micro: "marol", grade: "B", floors: "G+7",
    furnishing: "Bareshell", efficiency: "62%", carpet: 12300, builtUp: 19700, ceiling: "11 ft - 12 ft (approx.)", perSeat: "Rs. 13,400 - Rs. 13,900 + GST", perSeatLow: 13400, perSeatHigh: 13900,
    parking: "13 Car parking", parkingCharges: "Rs. 5,000 per car park per month + Taxes", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", months: 0, microText: "Marol Metro Station" },
  { id: "privilon", name: "Privilon", priority: "", floor: "Multiple", micro: "marol", grade: "A", floors: "G+15",
    furnishing: "Bareshell", efficiency: "60%", carpet: 11331, builtUp: 18885, ceiling: "11.7 ft", perSeat: "Rs. 18,000 - Rs. 18,500 + GST", perSeatLow: 18000, perSeatHigh: 18500,
    parking: "5 Car parking", parkingCharges: "To Be Discussed", noc: "Jan 2027", occ: "Jan 2027", dg: "Common area only", possession: "Jan 2027", months: 2, microText: "Marol" },
  { id: "landmark", name: "Landmark", priority: "", floor: "6th", micro: "weh", grade: "B", floors: "G+6",
    furnishing: "Furnished", efficiency: "60%", carpet: 10000, builtUp: 16666.7, ceiling: "11 ft (approx.)", perSeat: "Rs. 15,200 - Rs. 15,700 + GST", perSeatLow: 15200, perSeatHigh: 15700,
    parking: "8 car parking", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", months: 0, microText: "Western Express Highway" },
  { id: "rustomjee-central-park", name: "Rustomjee Central Park", priority: "", floor: "4th", micro: "chakala", grade: "B", floors: "G+9",
    furnishing: "Furnished", efficiency: "60%", carpet: 9000, builtUp: 15000, ceiling: "12 ft", perSeat: "Rs. 16,000 - Rs. 16,500 + GST", perSeatLow: 16000, perSeatHigh: 16500,
    parking: "10 Car parking", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Feb 2027 - Can be discussed for early vacancy", months: 3, microText: "Chakala" },
  { id: "fulcrum", name: "Fulcrum", priority: "", floor: "1st", micro: "csmi", grade: "B+", floors: "G+9",
    furnishing: "Furnished", efficiency: "65%", carpet: 11700, builtUp: 18000, ceiling: "11 ft - 12 ft (approx.)", perSeat: "Rs. 14,400 - Rs. 14,900 + GST", perSeatLow: 14400, perSeatHigh: 14900,
    parking: "9 car parking", parkingCharges: "", noc: "Available", occ: "Available", dg: "Common area only", possession: "Immediately", months: 0, microText: "CSMI Metro" },
];

/* ---- research: pins and connectivity, each with its source -------------- */
const R = {
  "723-avenue": {
    lat: 19.109713, lng: 72.884422, precision: "building", geoSrc: "https://dhcrealty.in/property/wadhwa-723-avenue/",
    geoNote: "Plus code 4V5M+VQM printed on the listing, decoded. Marol Co-operative Industrial Estate Road, off Andheri-Kurla Road.",
    address: "Wadhwa 723 Avenue, Marol Co-operative Industrial Estate Road, Sag Baug, Marol, Andheri East, Mumbai 400059",
    hops: 2, metro: "Marol Naka (Line 1 and Line 3)", walk: "about 1 km on the developer's figure (540 m in a straight line from the pin)",
    metroSrc: "https://houseofwadhwa.com/wp-content/uploads/2023/08/Wadhwa-723-Avenue-Project-Brochure-3.pdf", metroNote: "The developer's brochure: '1 km away from Marol Naka Metro Station'." },
  "corporate-avenue": {
    lat: 19.110625, lng: 72.859637, precision: "complex", geoSrc: "https://exa.ai/library/place/3kk3s3wpqbl",
    geoNote: "Map place page; Wikimapia outlines 'Corporate Avenue (Atul Projects)' 55 m away. Sonawala Road, off Andheri-Kurla Road.",
    address: "Corporate Avenue, Sonawala Road, off Andheri-Kurla Road, Chakala, Andheri East, Mumbai",
    hops: 2, metro: "Western Express Highway and Gundavali", walk: "650 m, 9 min walk; Chakala (J B Nagar) 850 m",
    metroSrc: "https://myhq.in/dedicated/coworking-space/atul-corporate-avenue-chakala", metroNote: "myHQ lists Gundavali and WEH at 650 m (9 min) and Chakala J B Nagar at 850 m (11 min)." },
  "vaman-techno-centre": {
    lat: 19.111483, lng: 72.882235, precision: "building", geoSrc: "https://exa.ai/library/place/3vrh78m08q4",
    geoNote: "Map place page. Makwana Road, Marol. About 460 m from Marol Naka station in a straight line.",
    address: "Vaman Techno Centre, Makwana Road, Gamdevi, Marol, Andheri East, Mumbai 400059",
    hops: 2, metro: "Marol Naka (Line 1 and Line 3)", walk: "about 7 min walk",
    metroSrc: "https://www.office-hub.com/in/properties/makwana-rd-marol-circle-near-web-techneeq-gamdevi-marol-andheri-east-mumbai-maharashtra-a0vQg000004wOE9IAM", metroNote: "Office Hub, for the Awfis centre in this building: Marol Naka metro, 7 minute walk. Awfis's own page says 0.30 km." },
  "privilon": {
    lat: 19.108207, lng: 72.879563, precision: "approx", geoSrc: "https://exa.ai/library/place/s8x6jf6zts0",
    geoNote: "The place page pin sits within 10 m of the Marol Naka station coordinate, so it marks the address, not a footprint. The developer says 'right next to Marol Metro Station'.",
    address: "Privilon, Metro Station Marol Naka, Gamdevi, Marol, Andheri East, Mumbai 400059",
    hops: 2, metro: "Marol Naka (Line 1 and Line 3)", walk: "right next to the station",
    metroSrc: "https://bsafal.com/mumbai/", metroNote: "The developer: 'right next to Marol Metro Station'. OpenStreetMap puts Line 1 at about 0 m and Line 3 at about 100 m (mumbaipropertyexchange.com)." },
  "landmark": {
    lat: 19.116739, lng: 72.855679, precision: "building", geoSrc: "https://exa.ai/library/place/g4bgsvhmz93",
    geoNote: "Map place page for Landmark, Suren Road, Gundavali, at the junction of the Western Express Highway and Andheri-Kurla Road.",
    address: "Landmark, Suren Road, Gundavali, Andheri East, Mumbai 400093",
    hops: 2, metro: "Western Express Highway (Line 1 and Line 7)", walk: "about 200 m",
    metroSrc: "https://property.jll.co.in/listings/landmark-wing-a-suren-road-gundavali", metroNote: "JLL: 'just 200 metres from the Western Express Highway metro station'." },
  "rustomjee-central-park": {
    lat: 19.114042, lng: 72.860671, precision: "building", geoSrc: "https://exa.ai/library/place/83qqct91nth",
    geoNote: "Map place page; not the OSM 'Rustomjee' pin at 19.11642, 72.85428. Andheri-Kurla Road at the Chakala signal.",
    address: "Rustomjee Central Park, Andheri-Kurla Road, Chakala, Andheri East, Mumbai 400093",
    hops: 2, metro: "Western Express Highway (Line 1 and Line 7)", walk: "3 min walk; Chakala (J B Nagar) 0.7 km",
    metroSrc: "https://rustomjeeltd.net/central-park-business-spaces/", metroNote: "The developer: 'The nearest metro stop, Western Express Highway, is a 3 min walk away'; Chakala Metro Station 0.7 km." },
  "fulcrum": {
    lat: 19.101, lng: 72.8716, precision: "approx", geoSrc: "https://property.jll.co.in/listings/fulcrum-ia-project-road-ashok-nagar",
    geoNote: "An estimate. No map pin was found for the building; it adjoins the Hyatt Regency on IA Project Road, Sahar, so the pin is placed beside the hotel.",
    address: "Fulcrum, IA Project Road, Sahar Road, next to Hyatt Regency, Ashok Nagar, Andheri East, Mumbai 400099",
    hops: 3, metro: "Sahar Road (Line 3)", walk: "about 690 m, measured from the Hyatt Regency next door",
    metroSrc: "https://moovitapp.com/index/en/public_transit-Hyatt_Regency_Mumbai-Mumbai-site_36354746-3732", metroNote: "Moovit: Sahar Road station is 687 m and a 9 min walk from the Hyatt Regency. Line 3 only, so a 3rd hop for Central Line riders." },
};

/* ---- our reading: seats and tiers --------------------------------------- */
const seats = (o) => Math.floor(o.carpet / SEAT_SQFT);
function tier(o) {
  const r = R[o.id];
  if (r.hops >= 3) return "not-recommended";
  if (seats(o) >= ASK && o.months === 0 && o.floor !== "Multiple") return "best-fit";
  return "workable";
}
function reason(o) {
  const s = seats(o), gap = s - ASK, r = R[o.id];
  const cap = gap >= 0 ? `${s} seats at 4x2, ${gap} above the ${ASK} ask` : `${s} seats at 4x2, ${-gap} short of the ${ASK} ask`;
  const ready = o.months === 0 ? "immediate" : `available ${o.possession}`;
  const lead = o.priority ? `${o.priority[0] + o.priority.slice(1).toLowerCase()} in the deck. ` : "";
  return `${lead}${o.furnishing}, ${ready}; ${cap}. Metro: ${r.metro}, ${r.walk}.`;
}
const FLAGS = {
  "privilon": { v: "The deck gives Privilon the same carpet (11,331) and built-up (18,885) as 723 Avenue, and the floors only as 'Multiple'. Fire NOC, OC & CC and possession are Jan 2027. Confirm the area, the floors and the date with the landlord.", src: "" },
  "fulcrum": { v: "The pin is an estimate beside the Hyatt Regency, and the building is a 3rd hop for Central Line riders.", src: R["fulcrum"].geoSrc },
  "vaman-techno-centre": { v: "The deck says 'Marol Metro Station'. Listings put Marol Naka 0.3 km to 7 min away; confirm the walk on site.", src: R["vaman-techno-centre"].metroSrc },
};

const options = D.map((o, i) => {
  const r = R[o.id], s = seats(o);
  const row = {
    id: o.id, n: i + 1, name: o.name, lat: r.lat, lng: r.lng, precision: r.precision, geoSrc: r.geoSrc, geoNote: r.geoNote,
    micro: o.micro, fit: tier(o), reason: reason(o), address: r.address, locality: "Andheri East",
    perSeat: o.perSeat, perSeatLow: o.perSeatLow, perSeatHigh: o.perSeatHigh,
    carpetArea: o.carpet, builtUpArea: o.builtUp, seatsAt55: s, grade: o.grade, furnishing: o.furnishing, efficiency: o.efficiency,
    possession: o.possession, monthsToPossession: o.months,
    floor: o.floor, totalFloors: o.floors, microMarket: o.microText, buildingType: "Commercial", ceilingHeight: o.ceiling,
    parking: o.parking, fireNoc: o.noc, ocCc: o.occ, dg: o.dg,
    metroStation: r.metro, metroWalk: r.walk, hopsFromCentralLine: r.hops,
    facts: [
      { k: "Nearest metro", v: `${r.metro}, ${r.walk}`, src: r.metroSrc, conf: "medium", note: r.metroNote },
      { k: "Per seat", v: o.perSeat, conf: "high", note: `From the deck: ${DECK}.` },
    ],
  };
  if (o.parkingCharges) { row.parkingCharges = o.parkingCharges; row.facts.push({ k: "Parking charges", v: o.parkingCharges, conf: "high", note: `From the deck.` }); }
  if (o.priority) row.priority = o.priority;
  if (FLAGS[o.id]) row.flag = FLAGS[o.id];
  return row;
});

/* ---- transit: the lines these options are measured against -------------- */
const WIKI = (n) => `https://en.wikipedia.org/wiki/${n}`;
const transit = {
  asOf: "2026-11", asOfText: "November 2026",
  lines: [
    { key: "line1", name: "Metro Line 1 (Blue)", short: "L1", mode: "metro", color: "#1d6fa5", status: "open", src: WIKI("Western_Express_Highway_metro_station"),
      note: "Versova to Ghatkopar. Central Line riders change at Ghatkopar: the first hop.",
      stations: [
        { name: "Western Express Highway", lat: 19.11556, lng: 72.85639, open: true },
        { name: "Chakala (J B Nagar)", lat: 19.112045, lng: 72.867696, open: true },
        { name: "Airport Road", lat: 19.11027, lng: 72.87475, open: true },
        { name: "Marol Naka", lat: 19.108195, lng: 72.879536, open: true },
        { name: "Saki Naka", lat: 19.103528, lng: 72.887962, open: true },
      ] },
    { key: "line3", name: "Metro Line 3 (Aqua)", short: "L3", mode: "metro", color: "#1d8a8a", status: "open", src: WIKI("Sahar_Road_metro_station"),
      note: "Underground, Aarey JVLR to Cuffe Parade. From Marol Naka a Central Line rider changes again: the third hop. The line is drawn straight between the stations shown, so it is indicative.",
      stations: [
        { name: "SEEPZ", lat: 19.125999, lng: 72.873727, open: true },
        { name: "MIDC Andheri", lat: 19.117352, lng: 72.873603, open: true },
        { name: "Marol Naka", lat: 19.108195, lng: 72.879536, open: true },
        { name: "Sahar Road", lat: 19.102196, lng: 72.865236, open: true },
      ] },
  ],
};

const zones = [
  { key: "weh", label: "WEH", name: "Western Express Highway end of Andheri-Kurla Road", color: "#1d6fa5", character: "Where Line 1 meets Line 7 and the highway." },
  { key: "chakala", label: "Chakala", name: "Chakala (Andheri-Kurla Road and Sonawala Road)", color: "#2e7d5b", character: "A short walk from the WEH and Chakala stations on Line 1." },
  { key: "marol", label: "Marol", name: "Marol (Marol Naka interchange, Makwana Road, Sag Baug)", color: "#b7791f", character: "The interchange of Lines 1 and 3: the only place both are one walk away." },
  { key: "csmi", label: "CSMI", name: "Sahar Road, by the airport", color: "#8a3d6b", character: "Airport hotel belt. Reached on Line 3, not Line 1." },
];

/* ---- the chooser: what Flipkart can weight ------------------------------ */
const measures = [
  { key: "price", kind: "column", column: "perSeatLow", label: "Per seat rate", higherIsBetter: false,
    question: "How much does the per seat rate matter?", of: "the low end of each option's per seat range in the deck" },
  { key: "space", kind: "column", column: "seatsAt55", label: "Seats it holds", higherIsBetter: true,
    question: "Does it have to hold the whole team?", of: "carpet area over 55 sqft a seat (4x2)" },
  { key: "ready", kind: "column", column: "monthsToPossession", label: "Ready now", higherIsBetter: false,
    question: "How soon must you move in?", of: "months to possession from November 2026, from the deck" },
  { key: "metro", kind: "nearestStation", status: "open", label: "Walk to a metro station",
    question: "Can people walk to a metro station?", of: "straight-line distance to the nearest open station" },
  { key: "hops", kind: "column", column: "hopsFromCentralLine", label: "Hops from the Central Line", higherIsBetter: false,
    question: "Is a third metro hop acceptable?", of: "the client's rule: two hops or fewer, Line 3 counts as a third (client-stated, to be confirmed)" },
];
const presets = [
  { key: "balanced", label: "Balanced", note: "A bit of everything.", default: true, levels: { price: 2, space: 2, ready: 2, metro: 2, hops: 3 } },
  { key: "cost", label: "Cost first", note: "The lowest per seat rate wins.", levels: { price: 4, space: 1, ready: 1, metro: 1, hops: 2 } },
  { key: "space", label: "Whole team on one plate", note: "Capacity over everything else.", levels: { price: 1, space: 4, ready: 1, metro: 1, hops: 2 } },
  { key: "move", label: "Move in soon", note: "Ready now and close to the metro.", levels: { price: 1, space: 2, ready: 4, metro: 3, hops: 3 } },
];

const facts = {
  brief: [
    { k: "Seats", v: "About 220 seats on 4x2 workstations (about 55 sqft a seat, about 12,100 sqft)", conf: "medium", note: "Client-stated, carried over from the earlier Flipkart brief. Not in the deck: confirm." },
    { k: "Commute", v: "Two metro hops or fewer from the Central Line (Ghatkopar to Line 1); a Line 3 station is a third hop", conf: "medium", note: "Client-stated, carried over from the earlier Flipkart brief. Not in the deck: confirm." },
    { k: "Client priorities", v: "723 Avenue is Priority 1 and Corporate Avenue Priority 2", conf: "high", note: `Marked in the deck: ${DECK}.` },
  ],
  deck: [
    { k: "Rates", v: "Per seat rates are a range per month and exclude GST", conf: "high", note: `As the deck gives them ('+ Taxes' on the summary, '+ GST' in the specifications).` },
    { k: "Same in every building", v: "Building type Commercial; DG common area only", conf: "high", note: "From the deck." },
  ],
};

const bundle = {
  meta: {
    title: "Flipkart Andheri East Atlas",
    sub: "Seven office options for Flipkart, read against the metro and the per seat rate",
    asOf: "2026-11", asOfText: "November 2026", city: "Mumbai", center: [72.87, 19.1085], zoom: 13.5,
    sheet: `${DECK}. Positions and connectivity researched Nov 2026; each carries its source.`,
    speed: { kmh: 16, factor: 1.3, note: "TomTom Traffic Index 2025, Mumbai rush hour" },
    fits: {
      "best-fit": { label: "Best fit", color: "#2e7d5b" },
      "workable": { label: "Workable", color: "#b7791f" },
      "not-recommended": { label: "Not recommended", color: "#b3402f" },
    },
    columns: {
      perSeat: { label: "Per seat", type: "text" },
      perSeatLow: { label: "Per seat, low end", unit: "INR / seat / month + GST", type: "number", sortable: true, higherIsBetter: false },
      perSeatHigh: { label: "Per seat, high end", unit: "INR / seat / month + GST", type: "number", sortable: true, higherIsBetter: false },
      carpetArea: { label: "Carpet area", unit: "sq. ft.", type: "number", sortable: true, higherIsBetter: true },
      builtUpArea: { label: "Built-up area", unit: "sq. ft.", type: "number", sortable: true },
      seatsAt55: { label: "Seats at 4x2 (55 sqft)", unit: "seats", type: "number", sortable: true, higherIsBetter: true },
      grade: { label: "Grade", type: "text" }, furnishing: { label: "Furnishing", type: "text" }, efficiency: { label: "Efficiency", type: "text" },
      possession: { label: "Possession", type: "text" },
      monthsToPossession: { label: "Months to possession", unit: "months from Nov 2026", type: "number", sortable: true, higherIsBetter: false },
      floor: { label: "Floor / Unit", type: "text" }, totalFloors: { label: "Total floors", type: "text" }, microMarket: { label: "Micro-market", type: "text" },
      buildingType: { label: "Building type", type: "text" }, ceilingHeight: { label: "Ceiling height", type: "text" },
      parking: { label: "Parking", type: "text" }, parkingCharges: { label: "Parking charges", type: "text" },
      fireNoc: { label: "Fire NOC", type: "text" }, ocCc: { label: "OC & CC", type: "text" }, dg: { label: "DG", type: "text" },
      metroStation: { label: "Nearest metro", type: "text" }, metroWalk: { label: "Walk to metro", type: "text" },
      hopsFromCentralLine: { label: "Metro hops from the Central Line", type: "number", sortable: true, higherIsBetter: false },
      priority: { label: "Client priority", type: "text" },
    },
    nextSteps: [
      "Confirm Privilon's carpet and built-up area, its floors and its January 2027 approvals with the landlord: the deck repeats 723 Avenue's figures.",
      "Confirm the 220-seat ask and the two-hop commute rule, which come from the earlier brief and are not in the deck.",
      "Walk the last stretch from the metro to 723 Avenue and Vaman Techno Centre: the sources give about 1 km and about 7 minutes.",
      "Confirm Fulcrum's exact position; the pin is an estimate.",
    ],
  },
  options, zones, transit, facts, measures, presets,
  copy: {
    overview: { eyebrow: "Autopilot · Andheri East · Nov 2026", title: "Where Flipkart's team should sit in Andheri East",
      intro: "{optionCount} buildings from Autopilot's inventory deck, by per seat rate, seats and the walk to the metro. 723 Avenue is the client's Priority 1 and Corporate Avenue its Priority 2." },
    connect: { title: "How people get to each option", intro: "Metro Line 1 is two hops from the Central Line; Line 3 is a third." },
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
