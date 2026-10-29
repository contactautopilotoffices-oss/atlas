#!/usr/bin/env node
/* ============================================================================
   ATLAS · Andheri East coworking competitors

     node scripts/examples/andheri-coworking.js
         writes examples/andheri-coworking.bundle.json and engine/bundle.js
         (the atlas, built in memory; no workbook file is written)

   A competitive analysis of the coworking centres Autopilot's team visited
   in Andheri East in October 2026, read against the three buildings
   Autopilot is proposing to take. Built from two files the team was handed:

     Visited_Co-working_Space.xlsx   12 centres visited: operator, building,
                                     grade, seats, price per seat, desk size,
                                     vacant seats, clients seen, amenities,
                                     hours, parking, nearest metro
     Proposed_Inventory.pdf          4 buildings proposed: floors, grade,
                                     furnishing, carpet and built-up area,
                                     rent, CAM, parking, approvals, timeline,
                                     nearest metro

   Rustomjee Central Park is left out of the PROPOSED inventory, as asked;
   the Executive Spaces centre there is a competitor and stays in. That
   makes 12 centres (11 in Andheri East, one in Vile Parle East on the same
   highway) and 3 proposed buildings.

   Neither file carries a coordinate. Every pin was researched on 23 Oct
   2026 from OpenStreetMap, Wikipedia, map place pages and operator or
   listing pages; each row names its source and how exact the pin is, and a
   position taken from an address or a listing (not an OSM object) is marked
   as such. Everything that is not a position comes from the two files or
   from the public source linked on the row. Nothing is estimated.
   ============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { buildTemplate, readWorkbook } = require("../lib/workbook");

/* Write a row by heading, as the person filling the sheet would. */
function heads(ws) { const m = new Map(); ws.getRow(3).eachCell({ includeEmpty: false }, (c, i) => { const t = String(c.value == null ? "" : c.value).replace(/\*/g, "").trim(); if (t) m.set(t, i); }); return m; }
function addRow(ws, obj) { const h = heads(ws), r = ws.getRow(ws.rowCount + 1); for (const [k, v] of Object.entries(obj)) { if (v === undefined || v === null || v === "") continue; const i = h.get(k); if (!i) throw new Error(`no column "${k}" on ${ws.name}`); r.getCell(i).value = v; } r.commit(); }
function addCol(ws, label) { ws.getRow(3).getCell(ws.columnCount + 1).value = label; }
function setField(ws, label, v) { for (let r = 4; r <= ws.rowCount; r++) { const l = String(ws.getRow(r).getCell(1).value == null ? "" : ws.getRow(r).getCell(1).value).replace(/\*/g, "").trim(); if (l === label) { ws.getRow(r).getCell(2).value = v; return; } } throw new Error(`no field "${label}"`); }

/* ---------------------------------------------------------------- data -- */
const AS_OF = "2026-10";
const VISIT = "Detailed Data - Coworking Spaces, Andheri East (Autopilot site visits, October 2026)";

/* Building positions, researched 23 Oct 2026. `exact` is what the pin can
   claim; `geoNote` says where the figure came from and what sits next to it. */
const GEO = {
  "boston-house":  { lat: 19.117079, lng: 72.856675, precision: "building", src: "https://www.openstreetmap.org/way/353202822", note: "OSM building way 353202822 (centroid). Just off the Western Express Highway, about two minutes' walk from WEH metro (Line 1)." },
  "rustomjee-central-park": { lat: 19.114042, lng: 72.860671, precision: "building", src: "https://exa.ai/library/place/83qqct91nth", note: "Map place page, as used in the earlier Andheri study; not the OSM 'Rustomjee' pin at 19.11642, 72.85428. Andheri-Kurla Road at the Chakala signal, opposite Kanakia Wall Street; the operator says 2 minutes' walk from WEH metro." },
  "chandak-chambers": { lat: 19.115847, lng: 72.855922, precision: "building", src: "https://exa.ai/library/place/dwzfqrcs71d", note: "Map place page; not in OpenStreetMap. The developer's own page puts WEH metro at 50 m and Andheri railway station at 1.1 km (chandakgroup.com/chambers)." },
  "technopolis":   { lat: 19.116337, lng: 72.863254, precision: "complex", src: "https://www.openstreetmap.org/way/102525674", note: "OSM landuse polygon 'Technopolis Knowledge Park', centroid. Mahakali Caves Road, between WEH and MIDC Andheri (Line 3) stations." },
  "akruti-trade-centre": { lat: 19.117623, lng: 72.871394, precision: "building", src: "https://exa.ai/library/place/108dhc19w0v", note: "Map place page for A Wing, Ackruti Trade Centre, Road No. 7, Kondivita (MIDC); a second site gives 19.1179, 72.8714, 30 m away. Not in OpenStreetMap. myHQ gives Chakala (J B Nagar) metro 700 m and Airport Road 850 m; MIDC Andheri on Line 3 is about 250 m east." },
  "solitaire":     { lat: 19.111739, lng: 72.860714, precision: "building", src: "https://exa.ai/library/place/f4cys4hn5nm", note: "Map place page, Guru Hargovindji Road, Chakala; a DigiPin lookup for the park's address sits 45 m away. About 300 m from the Corporate Avenue pin." },
  "technopark-74": { lat: 19.122896, lng: 72.872855, precision: "building", src: "https://myhq.in/virtual-office/91springboard-andherieast-2", note: "Coordinate printed on the myHQ listing for 91Springboard Technopark (74/II, C Cross Road, opp. Gate No 2, MIDC); a map place page is 100 m south. Near SEEPZ." },
  "vkg":           { lat: 19.110926, lng: 72.870906, precision: "building", src: "https://exa.ai/library/place/shf1t6tvjgg", note: "Map place page for VKG Corporate Centre, as used in the earlier Andheri study. Andheri-Kurla Road between Chakala and Airport Road stations." },
  "dynasty":       { lat: 19.112709, lng: 72.865906, precision: "building", src: "https://exa.ai/library/place/dlth3l6n2fw", note: "Map place page, as used in the earlier Andheri study; three sources agree. Andheri-Kurla Road near Chakala (J B Nagar) station." },
  "aj-house":      { lat: 19.112195, lng: 72.87929, precision: "building", src: "https://exa.ai/library/place/j6vcm4h6ng9", note: "Map place page, plus code 4V6H+VPF, Marol Maroshi Road, Gamdevi, Marol. Teloz's own page puts Marol Naka metro about 450 m away." },
  "lotus-star":    { lat: 19.119976, lng: 72.874911, precision: "building", src: "https://myhq.in/virtual-office/91springboard-andherieast", note: "Coordinate printed on the myHQ listing for 91Springboard Lotus Star, Plot D, Road No. 20 (5th Road), Marol MIDC. The sheet names DN Nagar metro; every source puts this centre in Marol MIDC, near MIDC Andheri (Line 3)." },
  "trade-star":    { lat: 19.111638, lng: 72.870408, precision: "poi", src: "https://www.openstreetmap.org/node/2188869089", note: "OSM node 2188869089 'Trade Star', Andheri-Kurla Road, between Chakala (J B Nagar) and Airport Road stations on Line 1." },
  "raheja-platinum": { lat: 19.109416, lng: 72.885635, precision: "building", src: "https://digitalnomadindex.com/spaces/india/maharashtra/mumbai/wework-raheja-platinum-mumbai", note: "Listing page coordinate; a cafe on the building's ground floor is pinned within 2 m of it. Not in OpenStreetMap. Sag Baug Road, off Andheri-Kurla Road; myHQ gives Marol Naka 650 to 800 m and Saki Naka 750 m." },
  "zion-house":    { lat: 19.107648, lng: 72.852979, precision: "building", src: "https://exa.ai/library/place/jdcpx8jszb7", note: "Map place page for Innov8 Zion House; not in OpenStreetMap. On the Western Express Highway in Vile Parle East; Innov8 says 850 m from Andheri station, myHQ gives Gundavali 900 m and WEH 1 km." },
  "fleet-house":   { lat: 19.108687, lng: 72.879151, precision: "building", src: "https://exa.ai/library/place/x65yvwhmfnx", note: "Map place page; not in OpenStreetMap. Marol Maroshi Road at Marol Naka: JLL's listing calls it adjacent to Marol Naka metro, and both Line 1 and Line 3 stations are at the door." },
  "silver-utopia": { lat: 19.112617, lng: 72.859672, precision: "building", src: "https://exa.ai/library/place/n2hx8mv5chs", note: "Map place page; another centre in the same building is pinned within 5 m. Cardinal Gracias Road, Chakala; myHQ gives WEH and Gundavali metro 500 m, Chakala (J B Nagar) 900 m." },
  "skyline-icon":  { lat: 19.105690, lng: 72.881125, precision: "building", src: "https://myhq.in/virtual-office/awfis-skyline-icon", note: "Coordinate printed on the myHQ listing, matched by a map place page within 1 m. Andheri-Kurla Road, Marol; myHQ gives Marol Naka 350 m." },
  "corporate-avenue": { lat: 19.110625, lng: 72.859637, precision: "complex", src: "https://exa.ai/library/place/3kk3s3wpqbl", note: "Map place page; Wikimapia's outline for 'Corporate Avenue (Atul Projects)' is 55 m away (https://wikimapia.org/9438559/CORPORATE-AVENUE-Atul-Projects). The PDF says Chakala metro 800 m; myHQ gives WEH and Gundavali 650 m." },
  "723-avenue":    { lat: 19.109713, lng: 72.884422, precision: "building", src: "https://dhcrealty.in/property/wadhwa-723-avenue/", note: "Plus code 4V5M+VQM printed on the listing, decoded. Marol Co-operative Industrial Estate Road, off Andheri-Kurla Road; the brochure says 1 km from Marol Naka, the PDF 700 m." },
  "privilon":      { lat: 19.108207, lng: 72.879563, precision: "approx", src: "https://exa.ai/library/place/s8x6jf6zts0", note: "The place page pin sits within 10 m of the Marol Naka station coordinate, so it marks the address, not a footprint. The developer says 'right next to Marol Metro Station'; the PDF says 93 m." }
};

/* The 12 centres visited, in the sheet's order. The Executive Spaces
   centre at Rustomjee Central Park is a competitor and stays in; the
   building is only left out of the proposed inventory layer. Prices are per seat per month plus GST, as quoted on the
   visit. */
/* The competitors, read from the team's detailed sheet exactly as written
   (examples/andheri-coworking-detailed-data.xlsx, one column per centre).
   Only the position (building -> pin) and the micro-market are added
   here; every other value on a card is a cell from that sheet. */
const DETAIL = path.join(__dirname, "..", "..", "examples", "andheri-coworking-detailed-data.xlsx");
const PLACE = {
  "boston house": ["boston-house", "weh"], "rustomje central park": ["rustomjee-central-park", "weh"], "chandak chambers": ["chandak-chambers", "weh"],
  "technopolis": ["technopolis", "chakala"], "akruti trade star": ["akruti-trade-centre", "chakala"], "k raheja platinum": ["raheja-platinum", "marol"],
  "zion house": ["zion-house", "vile-parle"], "trade star": ["trade-star", "jbnagar"], "solitaire corporate park": ["solitaire", "chakala"],
  "74 technopark": ["technopark-74", "midc"], "vkg": ["vkg", "jbnagar"], "dynasty business park": ["dynasty", "jbnagar"],
  "aj house": ["aj-house", "marol"], "lotus": ["lotus-star", "midc"], "silver utopia": ["silver-utopia", "chakala"]
};
/* Where the sheet's building name needs a word to find the right pin. */
const PLACE_NOTE = {
  "akruti trade star": "The sheet says Akruti Trade Star; every public source puts Community Coworks at Ackruti Trade Centre, MIDC Road 7, which also fits the sheet's 'MIDC & Chakala' metro.",
  "lotus": "The sheet says Lotus with DN Nagar metro; 91Springboard's Lotus centre is Lotus Star, Marol MIDC.",
  "vkg": "VKG Corporate Centre, Andheri-Kurla Road."
};
/* Corrections the team gave after the sheet was shared (29 Oct 2026). They
   replace the sheet's cell for that centre; the sheet file is unchanged. */
const CORRECTIONS = [
  { operator: "91 Springboard", building: "74 Technopark", set: { meeting: "3 to 5 seater - Rs. 800 + GST, 7 seater - Rs. 1000 + GST" } },
  { operator: "DevX", building: "Dynasty Business Park", set: { price: "Rs. 18,000 + GST", desks: "Dedicated Seats - Rs. 14,000 + GST" } }
];
const ROWS = { "Operator": "operator", "Type": "type", "Building Name": "building", "Grade": "grade", "Location": "location", "Total Seats": "seats",
  "Per Seat Cost": "price", "Workstation Size": "desk", "Vacant Seats": "vacant", "Client Present": "clients", "Amenities": "amenities",
  "Operational Hours": "hours", "Parking": "parking", "Metro": "metro", "Note": "note", "Image Link": "photos", "Meeting Room Charges": "meeting",
  "Post Operational hour charges": "afterHours", "Printing Charges": "printing", "Open and Dedicated Desk": "desks", "Sunday Charges": "sunday",
  "Land and Cabels": "lan", "Distance from Privilon": "toPrivilon", "Distance from Corporate Avenue": "toCorporateAvenue" };
async function readCentres() {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(DETAIL);
  const ws = wb.worksheets[0];
  const txt = (v) => { if (v == null) return ""; if (typeof v === "object") v = v.text || v.result || (v.richText ? v.richText.map(r => r.text).join("") : ""); return String(v).replace(/\s+/g, " ").trim(); };
  const byField = {};
  ws.eachRow((row) => { const k = ROWS[txt(row.getCell(1).value)]; if (k) byField[k] = row; });
  const out = [];
  for (let col = 2; col <= ws.columnCount; col++) {
    const c = {};
    for (const [k, row] of Object.entries(byField)) c[k] = txt(row.getCell(col).value);
    if (!c.operator) continue;
    c.operator = c.operator.replace(/^\d+\.\s*/, "").replace(/\s*-\s*$/, "").replace(/^Wework$/i, "WeWork");
    const key = c.building.toLowerCase();
    const pl = PLACE[key];
    if (!pl) throw new Error(`no position for building "${c.building}" (column ${col}); add it to PLACE`);
    Object.assign(c, (CORRECTIONS.find(x => x.operator === c.operator && x.building === c.building) || {}).set || {});
    const slug = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    out.push({ ...c, n: out.length + 1, id: `${slug(c.operator)}-${slug(c.building)}`, geo: pl[0], micro: pl[1], placeNote: PLACE_NOTE[key] || "" });
  }
  return out;
}


/* The three proposed buildings, from Proposed_Inventory.pdf. */
const PROPOSED = [
  { id: "proposed-corporate-avenue", name: "Corporate Avenue (Atul Projects)", geo: "corporate-avenue", micro: "chakala", address: "Corporate Avenue, Sonawala Road, off Andheri-Kurla Road, Chakala, Andheri East, Mumbai", grade: "A", floor: "3rd and 4th", floors: "G + 8", furnishing: "Furnished", carpet: 12414, builtup: 20690, ceiling: "11 ft", rent: 300, cam: "Included in rent", parking: "5 car parks a floor", noc: "Available", oc: "Available", available: "Immediately", metro: "Chakala (J B Nagar)", metroM: 800,
    reason: "Grade A, G+8, furnished. 3rd and 4th floors, 12,414 sq ft carpet, 20,690 sq ft built-up. Rs 300 per sq ft on carpet, CAM included. Fire NOC and OC available; ready immediately. 5 car parks a floor. Chakala metro 800 m. Efficiency 60% assumed because the landlord quoted on carpet." },
  { id: "proposed-723-avenue", name: "723 Avenue (Wadhwa)", geo: "723-avenue", micro: "marol", address: "Wadhwa 723 Avenue, Marol Co-operative Industrial Estate Road, Sag Baug, Marol, Andheri East, Mumbai 400059", grade: "A", floor: "13th and 14th", floors: "G + 15", furnishing: "Bare shell", carpet: 12952, builtup: 21586, ceiling: "11.7 ft", rent: 316, cam: 16, parking: "1 per 1,000 sq ft built-up", noc: "November 2026", oc: "November 2026", available: "November 2026", metro: "Marol Naka (Lines 1 and 3)", metroM: 700,
    reason: "Grade A, G+15, bare shell, 11.7 ft ceilings. 13th and 14th floors, 12,952 sq ft carpet, 21,586 sq ft built-up. Rs 316 per sq ft on carpet plus Rs 16 CAM. Fire NOC, OC and CC due November 2026; available November 2026. Parking 1 per 1,000 sq ft built-up. Marol metro 700 m." },
  { id: "proposed-privilon", name: "Privilon (Bsafal)", geo: "privilon", micro: "marol", address: "Privilon, Marol Naka metro station, Gamdevi, Marol, Andheri East, Mumbai 400059", grade: "A", floor: "Multiple", floors: "G + 15", furnishing: "Bare shell", carpet: 15343, builtup: "Not given", ceiling: "11.7 ft", rent: 375, cam: 30, parking: "To be confirmed", noc: "January 2027", oc: "January 2027", available: "January 2027", metro: "Marol Metro (93 m per the PDF; the map pin is the station address)", metroM: 93,
    reason: "Grade A, G+15, bare shell, 11.7 ft ceilings. Multiple floors, 15,343 sq ft carpet. Rs 375 per sq ft on carpet plus Rs 30 CAM. Fire NOC, OC and CC due January 2027; available January 2027. Parking to be confirmed. Marol metro 93 m. Efficiency 60% assumed because the landlord quoted on carpet." }
];

const ZONES = [
  { key: "weh", label: "WEH", name: "Western Express Highway end of Andheri-Kurla Road (WEH and Gundavali metro)", color: "#1d6fa5", character: "Where Line 1 meets Line 7 and the highway. B-grade blocks at the station: the cheapest desks visited and the smallest centres." },
  { key: "chakala", label: "Chakala and MIDC", name: "Chakala and MIDC (Mahakali Caves Road, Cardinal Gracias Road, MIDC Road 7)", color: "#2e7d5b", character: "Campus-style B buildings a short walk from WEH, Chakala or MIDC Andheri stations. Where Corporate Avenue, the only ready proposed floor, sits." },
  { key: "jbnagar", label: "J B Nagar", name: "J B Nagar (Andheri-Kurla Road at Chakala metro)", color: "#8a3d6b", character: "Mid-corridor on Andheri-Kurla Road, at the Chakala (J B Nagar) station. Trade Star here now has Innov8 and, from 2026, Executive Spaces; Table Space's R Square and HDFC Bank are neighbours." },
  { key: "marol", label: "Marol", name: "Marol (Marol Naka interchange, Sag Baug Road, Andheri-Kurla Road)", color: "#b7791f", character: "The interchange of Lines 1 and 3 and the big national operators: WeWork, Smartworks and Awfis. The dearest seats and the two bare-shell proposed buildings." },
  { key: "midc", label: "MIDC and SEEPZ", name: "MIDC Andheri and SEEPZ (Line 3)", color: "#6b4f8a", character: "The MIDC industrial estate and SEEPZ, on Metro Line 3. 91Springboard runs two centres here." },
  { key: "vile-parle", label: "Vile Parle E", name: "Vile Parle East, on the Western Express Highway", color: "#4a5a6a", character: "South of Andheri East on the same highway; one large Innov8 centre competing for WEH tenants." }
];

const STATIONS = [
  ["Metro Line 1 (Blue)", "L1", "#1d6fa5", "Western Express Highway", 19.115560, 72.856390, "https://en.wikipedia.org/wiki/Western_Express_Highway_metro_station"],
  ["Metro Line 1 (Blue)", "L1", "#1d6fa5", "Chakala (J B Nagar)", 19.112045, 72.867696, "https://en.wikipedia.org/wiki/Chakala_metro_station"],
  ["Metro Line 1 (Blue)", "L1", "#1d6fa5", "Airport Road", 19.110270, 72.874750, "https://en.wikipedia.org/wiki/Airport_Road_metro_station"],
  ["Metro Line 1 (Blue)", "L1", "#1d6fa5", "Marol Naka", 19.108195, 72.879536, "https://en.wikipedia.org/wiki/Marol_Naka_metro_station"],
  ["Metro Line 1 (Blue)", "L1", "#1d6fa5", "Saki Naka", 19.103528, 72.887962, "https://en.wikipedia.org/wiki/Saki_Naka_metro_station"],
  ["Metro Line 3 (Aqua)", "L3", "#1d8a8a", "SEEPZ", 19.125999, 72.873727, "https://www.indiametroroute.com/mumbai-metro-station/seepz"],
  ["Metro Line 3 (Aqua)", "L3", "#1d8a8a", "MIDC Andheri", 19.117352, 72.873603, "https://en.wikipedia.org/wiki/MIDC_%E2%80%93_Andheri_metro_station"],
  ["Metro Line 3 (Aqua)", "L3", "#1d8a8a", "Marol Naka", 19.108195, 72.879536, "https://en.wikipedia.org/wiki/Marol_Naka_metro_station"],
  ["Metro Line 3 (Aqua)", "L3", "#1d8a8a", "CSMIA T2", 19.102334, 72.874469, "https://en.wikipedia.org/wiki/Chhatrapati_Shivaji_Maharaj_International_Airport_-_T2_metro_station"],
  ["Metro Line 3 (Aqua)", "L3", "#1d8a8a", "Sahar Road", 19.102196, 72.865236, "https://en.wikipedia.org/wiki/Sahar_Road_metro_station"],
  ["Metro Line 7 (Red)", "L7", "#c0392b", "Gundavali", 19.115020, 72.855170, "https://en.wikipedia.org/wiki/Gundavali_metro_station"],
  ["Western Railway (suburban)", "WR", "#6b4f3a", "Andheri", 19.119167, 72.846944, "https://en.wikipedia.org/wiki/Andheri_railway_station"]
];

/* Sourced facts: filled in from the research below. */
const FACTS = require("./andheri-coworking-facts");

/* --------------------------------------------------------------- build -- */
async function build() {
  const wb = buildTemplate();

  const A = wb.getWorksheet("Atlas");
  setField(A, "Title", "Andheri East Coworking Atlas");
  setField(A, "Subtitle", "Internal study: the coworking competitors in the market, then Autopilot's proposed inventory");
  setField(A, "Data current to", AS_OF);
  setField(A, "City", "Mumbai");
  setField(A, "Centre longitude", 72.869);
  setField(A, "Centre latitude", 19.1115);
  setField(A, "Opening zoom", 13.9);
  setField(A, "Source workbook", `${VISIT}; Proposed_Inventory.pdf (October 2026). Rustomjee Central Park is left out of the proposed inventory, not of the competitor set. Positions and public facts researched 23 Oct 2026, sources on each row.`);
  setField(A, "Peak speed (km/h)", 16);
  setField(A, "Road factor", 1.3);
  setField(A, "Speed source", "TomTom Traffic Index 2025, Mumbai rush hour");
  setField(A, "Next steps", [
    "Compare each proposed site with the centres the sheet measures it against: the distance-from-Privilon and distance-from-Corporate-Avenue rows on every card.",
    "Confirm parking at Innov8 Trade Star, which the sheet leaves as TBD.",
    "Confirm the 91Springboard Lotus centre: the sheet names DN Nagar metro, but the operator's Lotus centre is Lotus Star in Marol MIDC."
  ].join("\n"));

  /* ---- Options: the competitors, from the detailed sheet ---- */
  const CENTRES = await readCentres();
  const O = wb.getWorksheet("Options");
  const COLS = [["Operator", "operator"], ["Type", "type"], ["Building", "building"], ["Grade", "grade"], ["Location", "location"], ["Total seats", "seats"],
    ["Per seat cost", "price"], ["Workstation size", "desk"], ["Open and dedicated desk", "desks"], ["Vacant seats", "vacant"], ["Clients present", "clients"],
    ["Amenities", "amenities"], ["Operational hours", "hours"], ["Post operational hour charges", "afterHours"], ["Sunday charges", "sunday"],
    ["Meeting room charges", "meeting"], ["Printing charges", "printing"], ["LAN and cables", "lan"], ["Parking", "parking"], ["Metro", "metro"],
    ["Distance from Privilon", "toPrivilon"], ["Distance from Corporate Avenue", "toCorporateAvenue"], ["Note", "note"], ["Photos", "photos"]];
  for (const [label] of COLS) addCol(O, label);
  for (const c of ["Position note", "Floor / unit", "Total floors", "Furnishing", "Carpet area (sq ft)", "Built-up area (sq ft)", "Ceiling height", "Rent on carpet (Rs per sq ft a month)", "CAM (Rs per sq ft a month)", "Fire NOC", "OC and CC", "Available from", "Nearest metro", "Metro distance (m)"]) addCol(O, c);
  for (const c of CENTRES) {
    const g = GEO[c.geo];
    const row = {
      "ID": c.id, "Rank": c.n, "Property name": `${c.operator} · ${c.building}`,
      "Latitude": g.lat, "Longitude": g.lng, "How exact is the pin": g.precision, "Source for the position": g.src,
      "Micro-market": c.micro, "Fit group": "coworking-competitors",
      "Why it scores as it does": [c.type, c.seats && `${c.seats} seats`, c.price, c.grade && `Grade ${c.grade}`, c.vacant && `Vacant: ${c.vacant}`].filter(Boolean).join(" · "),
      "Address": `${c.building}, ${c.location}, Mumbai`, "Locality": c.location
    };
    for (const [label, k] of COLS) row[label] = c[k];
    addRow(O, row);
  }

  /* ---- Options, second group: the proposed inventory, after the
     competitors, in the order the team presents them. ---- */
  PROPOSED.forEach((p, i) => {
    const g = GEO[p.geo];
    addRow(O, {
      "ID": p.id, "Rank": CENTRES.length + 1 + i, "Property name": p.name,
      "Latitude": g.lat, "Longitude": g.lng, "How exact is the pin": g.precision, "Source for the position": g.src,
      "Micro-market": p.micro, "Fit group": "proposed-inventory", "Why it scores as it does": p.reason,
      "Address": p.address, "Locality": "Andheri East", "Building": p.name, "Grade": p.grade,
      "Floor / unit": p.floor, "Total floors": p.floors, "Furnishing": p.furnishing, "Carpet area (sq ft)": p.carpet, "Built-up area (sq ft)": p.builtup,
      "Ceiling height": p.ceiling, "Rent on carpet (Rs per sq ft a month)": p.rent, "CAM (Rs per sq ft a month)": p.cam, "Parking": p.parking,
      "Fire NOC": p.noc, "OC and CC": p.oc, "Available from": p.available, "Nearest metro": p.metro, "Metro distance (m)": p.metroM,
      "Position note": g.note
    });
  });

  /* ---- Micro-markets ---- */
  const Z = wb.getWorksheet("Micro-markets");
  for (const z of ZONES) addRow(Z, { "Key": z.key, "Short name": z.label, "Full name": z.name, "Colour": z.color, "What it is like": z.character });

  /* ---- Transit ---- */
  const T = wb.getWorksheet("Transit");
  for (const [line, short, color, name, lat, lng, src] of STATIONS) addRow(T, { "Line name": line, "Line short name": short, "Mode": line.startsWith("Western Railway") ? "suburban" : "metro", "Line colour": color, "Station name": name, "Latitude": lat, "Longitude": lng, "Open?": "yes", "Source": src });

  /* ---- Facts ---- */
  const F = wb.getWorksheet("Facts");
  for (const f of FACTS) addRow(F, { "Group": f.group, "Label": f.k, "Value": f.v, "As of": f.asOf, "How firm": f.conf, "Source": f.src, "Note": f.note });

  return wb;
}

/* Seats free, counted from the sheet's wording ("15 Seater Cabin + 16 Seater
   Cabin + 5 Seater Cabin"). Every number in those cells is a seat count;
   "some small cabins" and "mix of" add nothing. */
function vacantCount(text) {
  let total = 0;
  for (const m of String(text).matchAll(/\d+/g)) total += +m[0];
  return total;
}

async function main() {
  const dir = path.join(__dirname, "..", "..", "examples");
  const json = path.join(dir, "andheri-coworking.bundle.json");
  const wb = await build();
  const { bundle, notes } = await readWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
  /* This is a list in presentation order, not a ranking: the competitors
     first, then the proposed inventory. The engine's words are overridden
     so nothing on the page calls it one. */
  bundle.copy = {
    sort: { rank: "Listed order" },
    overview: { ranking: "The list" },
    ranking: { ungrouped: "Options", option: "Centre" },
    insights: { first: "First on the list" },
    option: { rank: false },
    filters: { groupHint: "Keep only this group." },
    guide: { overview: { hint: "The competitors in the market, then the proposed inventory, in presentation order." } },
    markets: { title: "Five micro-markets", none: "none on the list" }
  };
  fs.writeFileSync(json, JSON.stringify(bundle, null, 1) + "\n");
  /* The engine's static demo: /engine/ with no atlas named loads
     /engine/bundle.js (see engine/load.js). Until this atlas is published
     from /admin/ with its own link, access ID and password, this is how it
     can be previewed on any deployment of the branch. */
  const demo = path.join(__dirname, "..", "..", "engine", "bundle.js");
  fs.writeFileSync(demo, "/* Generated by scripts/examples/andheri-coworking.js. Do not edit: edit the script and rerun it. */\nwindow.ATLAS = " + JSON.stringify({ slug: "andheri-coworking", path: "/engine/", ...bundle }) + ";\n");
  console.log(`Wrote ${path.relative(process.cwd(), json)} and ${path.relative(process.cwd(), demo)}`);
  notes.forEach(n => console.log("  note: " + n));
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { build, readCentres, PROPOSED, GEO, vacantCount };
