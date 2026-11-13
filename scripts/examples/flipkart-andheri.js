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
     Report     "Commercial Property Distance & Transit Report" (Nov 2026):
                each building's two metro stations, walking distance and time,
                and Andheri railway station by road, from Google Maps.
     Research   The pins, and the street paths drawn on the map, were
                researched in Nov 2026; each says where it came from.

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
    address: "Wadhwa 723 Avenue, Marol Co-operative Industrial Estate Road, Sag Baug, Marol, Andheri East, Mumbai 400059" },
  "corporate-avenue": {
    l1: "Western Express Highway",
    lat: 19.110625, lng: 72.859637, precision: "complex", geoSrc: "https://exa.ai/library/place/3kk3s3wpqbl",
    geoNote: "Map place page; Wikimapia outlines 'Corporate Avenue (Atul Projects)' 55 m away. Sonawala Road, off Andheri-Kurla Road.",
    address: "Corporate Avenue, Sonawala Road, off Andheri-Kurla Road, Chakala, Andheri East, Mumbai" },
  "vaman-techno-centre": {
    l1: "Marol Naka",
    lat: 19.111483, lng: 72.882235, precision: "building", geoSrc: "https://exa.ai/library/place/3vrh78m08q4",
    geoNote: "Map place page. Makwana Road, Marol. About 460 m from Marol Naka station in a straight line.",
    address: "Vaman Techno Centre, Makwana Road, Gamdevi, Marol, Andheri East, Mumbai 400059" },
  "privilon": {
    l1: "Marol Naka",
    lat: 19.108207, lng: 72.879563, precision: "approx", geoSrc: "https://exa.ai/library/place/s8x6jf6zts0",
    geoNote: "The place page pin sits within 10 m of the Marol Naka station coordinate, so it marks the address, not a footprint. The developer says 'right next to Marol Metro Station'.",
    address: "Privilon, Metro Station Marol Naka, Gamdevi, Marol, Andheri East, Mumbai 400059" },
  "landmark": {
    l1: "Western Express Highway",
    lat: 19.116739, lng: 72.855679, precision: "building", geoSrc: "https://exa.ai/library/place/g4bgsvhmz93",
    geoNote: "Map place page for Landmark, Suren Road, Gundavali, at the junction of the Western Express Highway and Andheri-Kurla Road.",
    address: "Landmark, Suren Road, Gundavali, Andheri East, Mumbai 400093" },
  "rustomjee-central-park": {
    l1: "Western Express Highway",
    lat: 19.114042, lng: 72.860671, precision: "building", geoSrc: "https://exa.ai/library/place/83qqct91nth",
    geoNote: "Map place page; not the OSM 'Rustomjee' pin at 19.11642, 72.85428. Andheri-Kurla Road at the Chakala signal.",
    address: "Rustomjee Central Park, Andheri-Kurla Road, Chakala, Andheri East, Mumbai 400093" },
  "fulcrum": {
    l1: "Airport Road",
    lat: 19.104032, lng: 72.872132, precision: "building", geoSrc: "https://exa.ai/library/place/55wlsy8vkny",
    geoNote: "Map place page for The Empire Business Centre, A Wing, 5th Floor, Fulcrum, IA Project Road, beside the Hyatt Regency (OpenStreetMap puts the hotel at 19.1037, 72.8713).",
    address: "Fulcrum, IA Project Road, Sahar Road, next to Hyatt Regency, Ashok Nagar, Andheri East, Mumbai 400099" },
};

/* The two Marwah buildings, added to the 2D atlas only from Autopilot's
   "Flipkart Inventory Options Sheet" (Nov 2026). Marwah Business Park is the
   campus on Krishanlal Marwah Marg; the developer lists Marwah House (G+2),
   Marwah Centre (B+G+9) and Marwah Tower (G+14, foundations laid 2023) on it
   (https://marwahbusinesspark.com/marwah-business-park). The sheet's "Marwah
   Tower" is G+9 and its "Marwah Business Park" G+14, so the two names may be
   the other way round: to be confirmed. Both pins are on the campus. */
Object.assign(R, {
  "marwah-tower": {
    l1: "Saki Naka",
    lat: 19.110954, lng: 72.886118, precision: "complex", geoSrc: "https://exa.ai/library/place/2n0pkm6kwgr",
    geoNote: "The Marwah Centre address point on the Marwah Business Park campus (place page; findlatitudeandlongitude and an EV charger listing agree within 15 m). The sheet's G+9 matches Marwah Centre, not the G+14 Marwah Tower: the building is to be confirmed.",
    address: "Marwah Business Park, Krishanlal Marwah Marg, off Saki Vihar Road, Marol, Andheri East, Mumbai 400072" },
  "marwah-business-park": {
    l1: "Saki Naka",
    lat: 19.1114, lng: 72.8866, precision: "approx", geoSrc: "https://marwahbusinesspark.com/about-us",
    geoNote: "Placed on the Marwah Business Park campus, beside Krishanlal Marwah Marg; the building on the campus is not identified. The sheet's G+14 matches the new Marwah Tower.",
    address: "Marwah Business Park, Krishanlal Marwah Marg, Ganesh Nagar, Marol, Andheri East, Mumbai 400072" },
});

/* ---- distances, bus stops and the railway ------------------------------ */
const kmBetween = (a, b) => {
  const t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
};
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
    return { v: `By metro: from ${st}, Line 1 runs ${a}. Andheri is the metro and railway interchange.`, src: L1_SRC };
  }
  return { v: "By metro: from Sahar Road, Line 3 reaches Marol Naka in 2 stops; change to Line 1 there for Andheri (Western and Harbour lines, 4 stops).", src: L1_SRC };
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
const metroLines = (name) => METRO_LINES[name] || [name === "Sahar Road" || name === "MIDC Andheri" || name === "SEEPZ" || name === "CSMIA T2" ? "L3" : name === "Gundavali" ? "L7" : "L1"];
const LINES_OF = (x) => x.kind === "metro" ? metroLines(x.name) : x.kind === "rail" ? ["Western and Harbour lines"] : [];
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
  /* Every metro route the router measured, and Andheri railway station; bus
     stops are not shown. gmapsRoutes() then keeps the two stations the report
     names. */
  return [...pick("metro", 9), ...mine.filter(r => r.kind === "rail" && r.name === "Andheri").slice(0, 1)].map(r => ({
    kind: r.kind, name: r.name, lines: linesOf(r), lat: r.to[1], lng: r.to[0], m: r.m,
    ...(r.profile === "foot" ? { min: Math.max(1, Math.round(r.sec / 60)), mode: "walk" } : { mode: "road" }), path: r.path, src: r.src,
  }));
}

/* ---- connectivity as measured in Google Maps ---------------------------
   The client's "Commercial Property Distance & Transit Report (Andheri /
   Marol Region)", Nov 2026: for each building, its two metro stations with
   walking distance and time, and Andheri railway station by road, all from
   Google Maps. These are the figures on screen. The line drawn on the map
   follows the streets (the routes above); its length is not shown. */
const GMAPS_SRC = "https://www.google.com/maps";
const GMAPS = {
  "723-avenue":             { metro: [["Marol Naka", 810, 11], ["Saki Naka", 940, 13]], rail: 5500 },
  "corporate-avenue":       { metro: [["Western Express Highway", 920, 12], ["Chakala (J B Nagar)", 990, 13]], rail: 2500 },
  "vaman-techno-centre":    { metro: [["Marol Naka", 600, 8], ["Airport Road", 1200, 16]], rail: 5200 },
  "privilon":               { metro: [["Marol Naka", 140, 2], ["Airport Road", 580, 8]], rail: 4900 },
  "landmark":               { metro: [["Western Express Highway", 320, 4], ["Chakala (J B Nagar)", 1400, 19]], rail: 3200 },
  "rustomjee-central-park": { metro: [["Western Express Highway", 570, 8], ["Chakala (J B Nagar)", 870, 12]], rail: 2900 },
  "fulcrum":                { metro: [["Airport Road", 1300, 17], ["Sahar Road", 1300, 18]], rail: 4700 },
};
function gmapsRoutes(id, routes) {
  const g = GMAPS[id], out = [];
  for (const [name, m, min] of g.metro) {
    const r = routes.find(x => x.kind === "metro" && x.name === name);
    if (!r) throw new Error(`${id}: no street route to ${name}`);
    out.push({ ...r, m, min, src: GMAPS_SRC, dist: "Google Maps" });
  }
  const rail = routes.find(x => x.kind === "rail" && x.name === "Andheri");
  if (!rail) throw new Error(`${id}: no street route to Andheri`);
  out.push({ ...rail, m: g.rail, src: GMAPS_SRC, dist: "Google Maps" });
  return out;
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
  const routes = gmapsRoutes(o.id, routesFor(o.id, LINES_OF));
  return {
    id: o.id, n: i + 1, name: o.name, lat: r.lat, lng: r.lng, precision: r.precision, geoSrc: r.geoSrc, geoNote: r.geoNote,
    micro: o.micro, reason: reason(o), address: r.address, locality: "Andheri East",
    routes,
    facts: [
      ...spec.map(([k, v]) => ({ k, v, conf: "high" })),
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
    /* The railway is shown at Andheri only: the interchange with Metro Line 1. */
    { key: "western", name: "Andheri railway station (Western and Harbour lines)", short: "Western and Harbour lines", mode: "suburban", color: "#b3402f", status: "open", src: WIKI("Andheri_railway_station"),
      stations: [
        { name: "Andheri", lat: 19.119167, lng: 72.846944, open: true },
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
    backdrop: "blender",   /* the sign-in backdrop: the Blender render of the district (scripts/world/finish.py) */
    hideNearbyOptions: true,   /* no "Nearest other options" on a building's panel */
    routing: ROUTES.source,
    routeFeed: "/api/routes/mappls?atlas=flipkart-andheri",
    /* The 3D world at /flipkart-andheri/world: the model is built in Blender
       by scripts/world/ (see scripts/world/README.md). */
    world: { href: "/flipkart-andheri/world", data: "/media/flipkart-andheri/world/", sky: "sky.hdr", poster: "hero.jpg",
      thumbs: Object.fromEntries(D.map(o => [o.id, `r/${o.id}-close.jpg`])), renders: Object.fromEntries(D.map(o => [o.id, `r/${o.id}-street.jpg`])) },
    sheet: `${DECK}. Positions and connectivity researched Nov 2026; each carries its source.`,
  },
  options, zones, transit,
  copy: {
    connect: { note: "Walking distance and time from each building to its two metro stations, and Andheri railway station by road, as measured in Google Maps." },
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
const root = path.join(__dirname, "..", "..");
fs.mkdirSync(path.join(root, "examples"), { recursive: true });
fs.mkdirSync(path.join(root, "engine", "atlases"), { recursive: true });
function write(slug, b, access, extra = {}) {
  const hash = crypto.createHash("sha256").update(`${access.id}:${access.pass}`.toUpperCase().replace(/[\s-]/g, "")).digest("hex");
  fs.writeFileSync(path.join(root, "examples", `${slug}.bundle.json`), JSON.stringify(b, null, 1) + "\n");
  fs.writeFileSync(path.join(root, "engine", "atlases", `${slug}.js`),
    "/* Generated by scripts/examples/flipkart-andheri.js. Do not edit: edit the script and rerun it. */\nwindow.ATLAS = " +
    JSON.stringify({ slug, path: "/" + slug, gate: { hash }, ...extra, ...b }) + ";\n");
  console.log(`Wrote examples/${slug}.bundle.json and engine/atlases/${slug}.js (${b.options.length} options)`);
}
/* /flipkart-andheri: written last, below, from the same data as the 2D atlas. */
/* /flipkart-andheri-east: the same atlas, 2D only, to send out while the 3D
   explorer is finished. Same deck, same figures; no meta.world, so no 3D
   button. It takes the same ID and password, on its own sign-in page (the
   site root's sign-in sends FLIPDEMOACC to /flipkart-andheri). Its sign-in
   backdrop is read from the first atlas's media folder. */
const MAP_SLUG = "flipkart-andheri-east", MAP_ACCESS = ACCESS;   // the same ID and password as /flipkart-andheri
const flat = JSON.parse(JSON.stringify(bundle)); delete flat.meta.world;
/* Its own connectivity, as Autopilot measured it in Google Maps (Nov 2026): two metro stations
   and Andheri railway station per building, distances only (no walk times
   were given, so none are shown). Landmark's second station is Gundavali
   (Line 7) and Fulcrum's is CSMIA T2 (Line 3); the line on the map follows
   the streets (OpenStreetMap routing); the figure is the measured one. */
const EAST = {
  "723-avenue":             { metro: [["Marol Naka", 700], ["Saki Naka", 800]], rail: 4400 },
  "corporate-avenue":       { metro: [["Chakala (J B Nagar)", 850], ["Western Express Highway", 900]], rail: 1500 },
  "privilon":               { metro: [["Marol Naka", 40], ["Airport Road", 500]], rail: 3700 },
  "landmark":               { metro: [["Western Express Highway", 48], ["Gundavali", 350]], rail: 3000 },
  "rustomjee-central-park": { metro: [["Western Express Highway", 550], ["Chakala (J B Nagar)", 900]], rail: 1700 },
  "vaman-techno-centre":    { metro: [["Marol Naka", 500], ["Airport Road", 1100]], rail: 4300 },
  "fulcrum":                { metro: [["CSMIA T2", 650], ["Airport Road", 1200]], rail: 4100 },
};
/* ...and its own order: 723 Avenue, Corporate Avenue, Privilon, Landmark,
   Rustomjee Central Park, Vaman Techno Centre, Fulcrum. */
const EAST_ORDER = ["723-avenue", "corporate-avenue", "privilon", "landmark", "rustomjee-central-park", "vaman-techno-centre", "fulcrum"];
flat.options = EAST_ORDER.map((id, i) => {
  const o = flat.options.find(x => x.id === id), e = EAST[id], all = routesFor(id, LINES_OF);
  const pickR = (kind, name, m) => {
    const r = all.find(x => x.kind === kind && x.name === name);
    if (!r) throw new Error(`${id}: no street route to ${name}`);
    const { min, ...rest } = r; return { ...rest, m, src: GMAPS_SRC, dist: "Google Maps" };
  };
  return { ...o, n: i + 1, routes: [...e.metro.map(([n, m]) => pickR("metro", n, m)), pickR("rail", "Andheri", e.rail)] };
});
/* The two Marwah buildings, from the sheet, in its words. Their distances
   are Autopilot's Google Maps figures (Nov 2026), like the others; the line
   on the map follows OpenStreetMap streets (Overture Maps,
   scripts/examples/overture-route.py, as the OSRM servers were unreachable). */
const SHEET = "Flipkart Inventory Options Sheet (Autopilot, Nov 2026)";
const MARWAH = [
  { id: "marwah-tower", name: "Marwah Tower", floor: "3rd or 4th", grade: "B", floors: "G+9", furnishing: "Furnished", efficiency: "60%",
    carpet: "5,600 sq. ft. per floor", builtUp: "9,333 sq. ft. per floor", ceiling: "10 ft - 11 ft (approx.)", perSeat: "Rs. 13,300 - Rs. 13,800",
    parking: "4 per floor", noc: "Available", occ: "Available", dg: "NA", possession: "Immediately" },
  { id: "marwah-business-park", name: "Marwah Business Park", floor: "Multiple floors", grade: "B", floors: "G+14", furnishing: "Bareshell", efficiency: "60%",
    carpet: "5,150 and 5,450 sq. ft.", builtUp: "8,583 and 9,083 sq. ft.", ceiling: "10 ft - 11 ft (approx.)", perSeat: "Rs. 15,800 - Rs. 16,300",
    parking: "5 per floor", noc: "NA", occ: "NA", dg: "NA", possession: "Feb - March 2027" },
];
const MARWAH_GMAPS = {
  "marwah-tower":         { metro: [["Saki Naka", 800], ["Marol Naka", 1200]], rail: 4900 },
  "marwah-business-park": { metro: [["Saki Naka", 800], ["Marol Naka", 1600]], rail: 4900 },
};
for (const o of MARWAH) {
  const r = R[o.id], all = routesFor(o.id, LINES_OF);
  const pick = (kind, name, m) => { const x = all.find(y => y.kind === kind && y.name === name); if (!x) throw new Error(`${o.id}: no street route to ${name}`); const { min, ...rest } = x; return { ...rest, m, src: GMAPS_SRC, dist: "Google Maps" }; };
  const g = MARWAH_GMAPS[o.id];
  const spec = [
    ["Micro-market", "Sakinaka Metro"], ["Floor / Unit", o.floor], ["Grade", o.grade], ["Total floors", o.floors], ["Building type", "Commercial"],
    ["Furnishing", o.furnishing], ["Efficiency", o.efficiency], ["Carpet area", o.carpet], ["Built-up area", o.builtUp], ["Ceiling height", o.ceiling],
    ["Per seat", o.perSeat], ["Parking", o.parking], ["Fire NOC", o.noc], ["OC & CC", o.occ], ["DG", o.dg], ["Possession", o.possession],
  ];
  flat.options.push({
    id: o.id, n: flat.options.length + 1, name: o.name, lat: r.lat, lng: r.lng, precision: r.precision, geoSrc: r.geoSrc, geoNote: r.geoNote,
    micro: "sakinaka-metro", address: r.address, locality: "Andheri East",
    reason: [`Floor ${o.floor}`, o.furnishing, `Carpet area ${o.carpet}`, `Possession: ${o.possession}`, `Per seat: ${o.perSeat}`].join(" · "),
    routes: [...g.metro.map(([n, m]) => pick("metro", n, m)), pick("rail", "Andheri", g.rail)],
    facts: [
      ...spec.map(([k, v]) => ({ k, v, conf: "high" })),
      { k: "Railway by metro", v: railByMetro(o.id).v, src: railByMetro(o.id).src, conf: "medium" },
    ],
  });
}
/* The 2D atlas is read by the client: the detail table shows the figures
   only, bold, with no source links (the sources stay in this script). */
for (const o of flat.options) o.facts = o.facts.map(({ src, ...f }) => f);
flat.meta.boldSpec = true;
flat.zones.push({ key: "sakinaka-metro", label: "Sakinaka Metro", name: "Sakinaka Metro", color: "#6b5bb5" });
flat.meta.sheet = `${DECK}; Marwah Tower and Marwah Business Park from the ${SHEET}. Positions and connectivity researched Nov 2026; each carries its source.`;

/* the two stations the other atlas does not draw */
const L3 = flat.transit.lines.find(l => l.key === "line3");
L3.stations.splice(L3.stations.findIndex(s => s.name === "Sahar Road"), 0, { name: "CSMIA T2", lat: 19.10233, lng: 72.87447, open: true });
flat.transit.lines.splice(2, 0, { key: "line7", name: "Metro Line 7 (Red)", short: "L7", mode: "metro", color: "#d23c3c", status: "open", src: "https://en.wikipedia.org/wiki/Line_7_(Mumbai_Metro)",
  stations: [{ name: "Gundavali", lat: 19.11451, lng: 72.85516, open: true }] });
flat.copy.connect.note = "Walking distance from each building to its two metro stations, and Andheri railway station by road, as measured in Google Maps (Nov 2026).";
write(MAP_SLUG, flat, MAP_ACCESS, { media: `/media/${SLUG}/` });

/* /flipkart-andheri: the same buildings, figures, order and Google Maps
   distances as /flipkart-andheri-east, plus the 3D explorer. One source, so
   the map and the 3D world always agree. Buildings with no 3D model yet
   (the two Marwah buildings) show on the map only. */
const withWorld = JSON.parse(JSON.stringify(flat)); withWorld.meta.world = bundle.meta.world;
write(SLUG, withWorld, ACCESS);
