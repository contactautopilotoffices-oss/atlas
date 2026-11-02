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
    l1: "Marol Naka",
    lat: 19.109713, lng: 72.884422, precision: "building", geoSrc: "https://dhcrealty.in/property/wadhwa-723-avenue/",
    geoNote: "Plus code 4V5M+VQM printed on the listing, decoded. Marol Co-operative Industrial Estate Road, off Andheri-Kurla Road.",
    address: "Wadhwa 723 Avenue, Marol Co-operative Industrial Estate Road, Sag Baug, Marol, Andheri East, Mumbai 400059",
    metro: "Marol Naka (Line 1 and Line 3)", walk: "about 1 km on the developer's figure (540 m in a straight line from the pin)",
    metroSrc: "https://houseofwadhwa.com/wp-content/uploads/2023/08/Wadhwa-723-Avenue-Project-Brochure-3.pdf", metroNote: "The developer's brochure: '1 km away from Marol Naka Metro Station'." },
  "corporate-avenue": {
    l1: "Western Express Highway",
    lat: 19.110625, lng: 72.859637, precision: "complex", geoSrc: "https://exa.ai/library/place/3kk3s3wpqbl",
    geoNote: "Map place page; Wikimapia outlines 'Corporate Avenue (Atul Projects)' 55 m away. Sonawala Road, off Andheri-Kurla Road.",
    address: "Corporate Avenue, Sonawala Road, off Andheri-Kurla Road, Chakala, Andheri East, Mumbai",
    metro: "Western Express Highway and Gundavali", walk: "650 m, 9 min walk; Chakala (J B Nagar) 850 m",
    metroSrc: "https://myhq.in/dedicated/coworking-space/atul-corporate-avenue-chakala", metroNote: "myHQ lists Gundavali and WEH at 650 m (9 min) and Chakala J B Nagar at 850 m (11 min)." },
  "vaman-techno-centre": {
    l1: "Marol Naka",
    lat: 19.111483, lng: 72.882235, precision: "building", geoSrc: "https://exa.ai/library/place/3vrh78m08q4",
    geoNote: "Map place page. Makwana Road, Marol. About 460 m from Marol Naka station in a straight line.",
    address: "Vaman Techno Centre, Makwana Road, Gamdevi, Marol, Andheri East, Mumbai 400059",
    metro: "Marol Naka (Line 1 and Line 3)", walk: "about 7 min walk",
    metroSrc: "https://www.office-hub.com/in/properties/makwana-rd-marol-circle-near-web-techneeq-gamdevi-marol-andheri-east-mumbai-maharashtra-a0vQg000004wOE9IAM", metroNote: "Office Hub, for the Awfis centre in this building: Marol Naka metro, 7 minute walk. Awfis's own page says 0.30 km." },
  "privilon": {
    l1: "Marol Naka",
    lat: 19.108207, lng: 72.879563, precision: "approx", geoSrc: "https://exa.ai/library/place/s8x6jf6zts0",
    geoNote: "The place page pin sits within 10 m of the Marol Naka station coordinate, so it marks the address, not a footprint. The developer says 'right next to Marol Metro Station'.",
    address: "Privilon, Metro Station Marol Naka, Gamdevi, Marol, Andheri East, Mumbai 400059",
    metro: "Marol Naka (Line 1 and Line 3)", walk: "right next to the station",
    metroSrc: "https://bsafal.com/mumbai/", metroNote: "The developer: 'right next to Marol Metro Station'. OpenStreetMap puts Line 1 at about 0 m and Line 3 at about 100 m (mumbaipropertyexchange.com)." },
  "landmark": {
    l1: "Western Express Highway",
    lat: 19.116739, lng: 72.855679, precision: "building", geoSrc: "https://exa.ai/library/place/g4bgsvhmz93",
    geoNote: "Map place page for Landmark, Suren Road, Gundavali, at the junction of the Western Express Highway and Andheri-Kurla Road.",
    address: "Landmark, Suren Road, Gundavali, Andheri East, Mumbai 400093",
    metro: "Western Express Highway (Line 1 and Line 7)", walk: "about 200 m",
    metroSrc: "https://property.jll.co.in/listings/landmark-wing-a-suren-road-gundavali", metroNote: "JLL: 'just 200 metres from the Western Express Highway metro station'." },
  "rustomjee-central-park": {
    l1: "Western Express Highway",
    lat: 19.114042, lng: 72.860671, precision: "building", geoSrc: "https://exa.ai/library/place/83qqct91nth",
    geoNote: "Map place page; not the OSM 'Rustomjee' pin at 19.11642, 72.85428. Andheri-Kurla Road at the Chakala signal.",
    address: "Rustomjee Central Park, Andheri-Kurla Road, Chakala, Andheri East, Mumbai 400093",
    metro: "Western Express Highway (Line 1 and Line 7)", walk: "3 min walk; Chakala (J B Nagar) 0.7 km",
    metroSrc: "https://rustomjeeltd.net/central-park-business-spaces/", metroNote: "The developer: 'The nearest metro stop, Western Express Highway, is a 3 min walk away'; Chakala Metro Station 0.7 km." },
  "fulcrum": {
    l1: "Airport Road",
    lat: 19.104032, lng: 72.872132, precision: "building", geoSrc: "https://exa.ai/library/place/55wlsy8vkny",
    geoNote: "Map place page for The Empire Business Centre, A Wing, 5th Floor, Fulcrum, IA Project Road, beside the Hyatt Regency (OpenStreetMap puts the hotel at 19.1037, 72.8713).",
    address: "Fulcrum, IA Project Road, Sahar Road, next to Hyatt Regency, Ashok Nagar, Andheri East, Mumbai 400099" },
};

/* ---- distances, bus stops and the railway ------------------------------ */
const kmBetween = (a, b) => {
  const t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
};
const titleCase = (n) => n.toLowerCase().replace(/(^|[\s./(-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Stn|Rly)\./g, (m, w) => w + ".");
const BEST = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "best-bus-stops-andheri-east.json"), "utf8"));
const NEAR_BUS_KM = 0.9;
const busStops = BEST.stops
  .filter(b => D.some(o => kmBetween(R[o.id], b) <= NEAR_BUS_KM))
  .map(b => ({ id: "best-" + b.id, name: titleCase(b.name), lat: b.lat, lng: b.lng }));

/* Metro Line 1 chainage (km from Versova) and station order, from the line's
   Wikipedia page. Andheri and Ghatkopar are the interchanges with the suburban
   railway: Andheri with the Western and Harbour lines, Ghatkopar with the
   Central line. */
const L1 = [["Andheri", 3.111], ["Western Express Highway", 4.118], ["Chakala (J B Nagar)", 5.382], ["Airport Road", 6.107], ["Marol Naka", 6.705],
  ["Saki Naka", 7.780], ["Asalpha", 8.903], ["Jagruti Nagar", 9.765], ["Ghatkopar", 10.821]];
const L1_SRC = "https://en.wikipedia.org/wiki/Line_1_(Mumbai_Metro)";
const l1Stops = (a, b) => Math.abs(L1.findIndex(x => x[0] === a) - L1.findIndex(x => x[0] === b));
const l1Km = (a, b) => Math.abs(L1.find(x => x[0] === a)[1] - L1.find(x => x[0] === b)[1]);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
/* "Railway by metro": from the property's own Line 1 station to the two
   interchanges. Fulcrum is on Line 3, which meets Line 1 at Marol Naka. */
function railByMetro(id) {
  const st = R[id].l1;
  if (st) {
    const a = `to Andheri (Western and Harbour lines) in ${plural(l1Stops(st, "Andheri"), "stop")}, ${l1Km(st, "Andheri").toFixed(1)} km of track`;
    const g = `to Ghatkopar (Central line) in ${plural(l1Stops(st, "Ghatkopar"), "stop")}, ${l1Km(st, "Ghatkopar").toFixed(1)} km of track`;
    return { v: `By metro: from ${st}, Line 1 runs ${a}, and ${g}. Both are metro and railway interchanges.`, src: L1_SRC };
  }
  return { v: "By metro: from Sahar Road, Line 3 reaches Marol Naka in 2 stops; change to Line 1 there for Andheri (Western and Harbour lines, 4 stops) or Ghatkopar (Central line, 4 stops).", src: L1_SRC };
}

/* ---- road routes ---------------------------------------------------------
   Every connection is measured along the streets, not as the crow flies:
   walks to metro stations and bus stops on the OSRM foot profile, the trip to
   a railway station on the car profile, from routing.openstreetmap.de
   (OpenStreetMap data), fetched 2 Nov 2026. scripts/examples/data/
   flipkart-routes.json keeps every route with the request it came from. The
   car router's time is free-flow, so only its distance is shown. */
const ROUTES = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "flipkart-routes.json"), "utf8"));
const METRO_LINES = { "Marol Naka": ["L1", "L3"] };
const metroLines = (name) => METRO_LINES[name] || [name === "Sahar Road" || name === "MIDC Andheri" || name === "SEEPZ" ? "L3" : "L1"];
const RAIL_LINE = { "Jogeshwari": "western", "Andheri": "western", "Vile Parle": "western", "Kurla": "central", "Vidyavihar": "central", "Ghatkopar": "central" };
const fmtRoad = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
/* Every route runs from the building to the station or stop itself: the
   router starts and ends on the nearest street, so the stretch from the
   building out to that street, and from the street to the station, is added
   to the path and to the distance (walk time scales with it). */
function routesFor(id, linesOf) {
  const pin = { lat: R[id].lat, lng: R[id].lng };
  const mine = ROUTES.routes.filter(r => r.option === id).map(r => {
    const p0 = r.path[0], p1 = r.path[r.path.length - 1], to = { lng: r.to[0], lat: r.to[1] };
    const lead = kmBetween(pin, { lng: p0[0], lat: p0[1] }) * 1000, tail = kmBetween({ lng: p1[0], lat: p1[1] }, to) * 1000;
    const m = Math.round(r.m + lead + tail), sec = r.m > 0 ? r.sec * m / r.m : m / 1.3;
    return { ...r, m, sec, path: [[pin.lng, pin.lat], ...r.path, [to.lng, to.lat]] };
  }).sort((a, b) => a.m - b.m);
  const pick = (kind, n, keyOf = (r) => r.name) => { const seen = new Set(); return mine.filter(r => r.kind === kind && !seen.has(keyOf(r)) && seen.add(keyOf(r))).slice(0, n); };
  return [...pick("metro", 2), ...pick("rail", 2, r => RAIL_LINE[r.name]), ...pick("bus", 3)].map(r => ({
    kind: r.kind, name: r.name, lines: linesOf(r), lat: r.to[1], lng: r.to[0], m: r.m,
    ...(r.profile === "foot" ? { min: Math.max(1, Math.round(r.sec / 60)), mode: "walk" } : { mode: "road" }), path: r.path, src: r.src,
  }));
}

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
  const routes = routesFor(o.id, (x) => x.kind === "metro" ? metroLines(x.name) : x.kind === "rail" ? [RAIL_LINE[x.name] === "western" ? "Western line" : "Central line"] : []);
  const m1 = routes.find(x => x.kind === "metro");
  return {
    id: o.id, n: i + 1, name: o.name, lat: r.lat, lng: r.lng, precision: r.precision, geoSrc: r.geoSrc, geoNote: r.geoNote,
    micro: o.micro, reason: reason(o), address: r.address, locality: "Andheri East",
    routes,
    facts: [
      ...spec.map(([k, v]) => ({ k, v, conf: "high" })),
      { k: "Nearest metro", v: `${m1.name} (${m1.lines.join(", ")}), ${fmtRoad(m1.m)} walk by road, about ${m1.min} min`, src: m1.src, conf: "high", note: "Walking route along OpenStreetMap streets (FOSSGIS OSRM)." },
      { k: "Railway by metro", v: railByMetro(o.id).v, src: railByMetro(o.id).src, conf: "medium" },
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
    { key: "western", name: "Western and Harbour lines (suburban railway)", short: "Western line", mode: "suburban", color: "#b3402f", status: "open", src: WIKI("Andheri_railway_station"),
      note: "Andheri is the interchange with Metro Line 1. Harbour line trains also stop at these stations.",
      stations: [
        { name: "Jogeshwari", lat: 19.1365, lng: 72.849, open: true },
        { name: "Andheri", lat: 19.119167, lng: 72.846944, open: true },
        { name: "Vile Parle", lat: 19.099532, lng: 72.843964, open: true },
      ] },
    { key: "central", name: "Central line (suburban railway)", short: "Central line", mode: "suburban", color: "#7a4aa3", status: "open", src: WIKI("Kurla_railway_station"),
      note: "Ghatkopar is the interchange with Metro Line 1. Kurla is also on the Harbour line.",
      stations: [
        { name: "Kurla", lat: 19.0656, lng: 72.8791, open: true },
        { name: "Vidyavihar", lat: 19.07944, lng: 72.89722, open: true },
        { name: "Ghatkopar", lat: 19.0857, lng: 72.9081, open: true },
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
    stationShot: true,
    hideNearbyOptions: true,   /* no "Nearest other options" on a building's panel */
    routing: ROUTES.source,   /* where the road routes on each option came from */   /* selecting a building zooms to it and its nearest station and draws the walk */
    sheet: `${DECK}. Positions and connectivity researched Nov 2026; each carries its source.`,
  },
  options, zones, transit,
  bus: {
    name: "BEST", credit: "BEST, from the ChaloBEST GTFS feed", src: BEST.source,
    note: "Stop positions only, within 900 m of a building. The feed predates today's route numbers, so no routes are shown; confirm a stop's name on site.",
    stops: busStops,
  },
  copy: {
    connect: { note: "Walking distance along the streets to each building's nearest metro station and bus stop (OpenStreetMap routing). Railway stations are by road." },
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
