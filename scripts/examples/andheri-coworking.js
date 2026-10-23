#!/usr/bin/env node
/* ============================================================================
   ATLAS · Andheri East coworking competitors, as a workbook

     node scripts/examples/andheri-coworking.js
         writes examples/andheri-coworking.xlsx
         and    examples/andheri-coworking.bundle.json (the same, read back)

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
const VISIT = "Visited_Co-working_Space.xlsx, Autopilot site visits, October 2026";

/* Building positions, researched 23 Oct 2026. `exact` is what the pin can
   claim; `geoNote` says where the figure came from and what sits next to it. */
const GEO = {
  "boston-house":  { lat: 19.117079, lng: 72.856675, precision: "building", src: "https://www.openstreetmap.org/way/353202822", note: "OSM building way 353202822 (centroid). Just off the Western Express Highway, about two minutes' walk from WEH metro (Line 1)." },
  "rustomjee-central-park": { lat: 19.114042, lng: 72.860671, precision: "building", src: "https://exa.ai/library/place/83qqct91nth", note: "Map place page, as used in the earlier Andheri study; not the OSM 'Rustomjee' pin at 19.11642, 72.85428. Andheri-Kurla Road at the Chakala signal, opposite Kanakia Wall Street; the operator says 2 minutes' walk from WEH metro." },
  "chandak-chambers": { lat: 19.115847, lng: 72.855922, precision: "building", src: "https://exa.ai/library/place/dwzfqrcs71d", note: "Map place page; not in OpenStreetMap. The developer's own page puts WEH metro at 50 m and Andheri railway station at 1.1 km (chandakgroup.com/chambers)." },
  "technopolis":   { lat: 19.116337, lng: 72.863254, precision: "complex", src: "https://www.openstreetmap.org/way/102525674", note: "OSM landuse polygon 'Technopolis Knowledge Park', centroid. Mahakali Caves Road, between WEH and MIDC Andheri (Line 3) stations." },
  "akruti-trade-centre": { lat: 19.117623, lng: 72.871394, precision: "building", src: "https://exa.ai/library/place/108dhc19w0v", note: "Map place page for A Wing, Ackruti Trade Centre, Road No. 7, Kondivita (MIDC); a second site gives 19.1179, 72.8714, 30 m away. Not in OpenStreetMap. myHQ gives Chakala (J B Nagar) metro 700 m and Airport Road 850 m; MIDC Andheri on Line 3 is about 250 m east." },
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
const CENTRES = [
  { id: "rush-coworks-boston-house", pubDesk: "Rs 13,000 (myHQ, quoted, negotiable)", pubCabin: "Rs 12,500 for a 1-person office (Office Hub)", pubCap: "14,000 sq ft, about 100 seats (myHQ)", pubSrc: "https://myhq.in/dedicated/coworking-space/inspire-cospace-andheri", n: 1, sheetNo: 1, operator: "Rush Co-works", building: "Boston House", geo: "boston-house", micro: "weh", grade: "B", seats: 125, price: 18000, desk: "3 x 2 ft", vacant: "6-seater and 2-seater cabins", clients: "Ocean One Ship Management, SIAS Group, Pacific Group", amenities: "Standard, breakout, printing", hours: "9 am to 9 pm, Monday to Saturday", parking: "Car Rs 4,000; two-wheeler Rs 1,500 a month", metro: "WEH (Line 1)", metroM: 160,
    fit: "value", reason: "125 seats, Rs 18,000 a seat for a 3 x 2 ft desk, Grade B. Free on the visit: a 6-seater and a 2-seater cabin." },
  { id: "innov8-boston-house", pubDesk: "Rs 15,999 to 16,999 (operator); Rs 13,000 (myHQ)", pubCabin: "Rs 17,999 to 19,999 (operator); Rs 12,499 (myHQ)", pubCap: "160+ seats (operator); 11,800 sq ft, about 164 seats (myHQ)", pubSrc: "https://www.innov8.work/coworking-space/mumbai/boston-house-andheri-east-6447d29b27e6c20001281193/", n: 2, sheetNo: 2, operator: "Innov8", building: "Boston House", geo: "boston-house", micro: "weh", grade: "B", seats: 180, price: 20000, desk: "3 x 2 ft", vacant: "12 seats", clients: "OYO, Bluestar Enviro Services, Goal Mine", amenities: "Standard, breakout area, printing", hours: "9 am to 9 pm, Monday to Saturday", parking: "Car Rs 4,000; two-wheeler Rs 1,500 a month", metro: "WEH (Line 1)", metroM: 160,
    fit: "premium", reason: "180 seats, Rs 20,000 a seat for a 3 x 2 ft desk, Grade B, in the same building as Rush. Free on the visit: 12 seats." },
  { id: "executive-spaces-rustomjee-central-park", pubDesk: "Rs 14,000 (operator centre page; Rs 13,000 on the home page); Rs 11,999 (myHQ)", pubCabin: "Rs 16,000 (operator centre page; Rs 15,000 on the home page and Houssed)", pubCap: "7,500 sq ft, about 150 seats, 4th and 6th floor B wing (myHQ); 250 seats (Houssed)", pubSrc: "https://www.executivespaces.in/coworking-shared-office-space-in-rustomjee-central-park-andheri-east", n: 3, sheetNo: 3, operator: "Executive Spaces", building: "Rustomjee Central Park", geo: "rustomjee-central-park", micro: "weh", grade: "A-", seats: 125, price: 14000, desk: "3 x 2 ft", vacant: "Not shared (managed office)", clients: "Big 92.7 FM", amenities: "Not shared (managed office)", hours: "Not shared; myHQ lists 10 am to 8 pm, Monday to Saturday", parking: "Not shared; myHQ lists car and two-wheeler parking", metro: "WEH", metroM: 480,
    fit: "value", reason: "125 seats, Rs 14,000 a seat for a 3 x 2 ft desk, Grade A-: the lowest price on the visit sheet. Run as a managed office, so vacancy, hours, amenities and parking were not shared." },
  { id: "executive-spaces-chandak-chambers", pubDesk: "Rs 16,000 (operator); Rs 15,999 (myHQ)", pubCabin: "Rs 18,000 (operator); Rs 13,999 (myHQ)", pubCap: "Not published", pubSrc: "https://executivespaces.in/coworking-spaces-in-andheri-east-Chandak-Chambers", n: 4, sheetNo: 4, operator: "Executive Spaces", building: "Chandak Chambers", geo: "chandak-chambers", micro: "weh", grade: "B", seats: 150, price: 16000, desk: "3 x 2 ft", vacant: "5-, 5- and 10-seater cabins", clients: "Pixel Mint, Leeway Softech, MedNeo, Right Horizon", amenities: "Standard, small breakout, printing", hours: "9 am to 9 pm, Monday to Saturday", parking: "Car Rs 4,500 a month", metro: "WEH (Line 1)", metroM: 50,
    fit: "value", reason: "150 seats, Rs 16,000 a seat for a 3 x 2 ft desk, Grade B, at the WEH metro station. Free on the visit: 5-, 5- and 10-seater cabins." },
  { id: "quest-coworks-technopolis", pubDesk: "Rs 12,000 (myHQ); from Rs 14,500 (Qdesq)", pubCabin: "Rs 17,999 (myHQ); from Rs 18,000 (Qdesq)", pubCap: "87,000 sq ft, about 1,750 seats on two floors (myHQ); 700 to 1,050 on other sites", pubSrc: "https://myhq.in/dedicated/coworking-space/quest-coworks-technopolis-knowledge-park", n: 5, sheetNo: 5, operator: "Quest Coworks", building: "Technopolis Knowledge Park", geo: "technopolis", micro: "chakala", grade: "B", seats: 1800, price: 18000, desk: "3.5 x 2 ft", vacant: "150-seater cabin, 15-seater cabin, 22-seater, 15 open dedicated desks and some small cabins", clients: "MK Tech Innovation, Sheffield Energy, Easebuzz, Escalent, Satco Wealth, Knauf, Idam, Esri India, Brickwork", amenities: "Standard, printing, gym, play zone, swimming pool access", hours: "8 am to 8 pm, Monday to Saturday", parking: "Car Rs 4,000; two-wheeler Rs 2,000 a month", metro: "WEH (Line 1)", metroM: 800,
    fit: "scale", reason: "1,800 seats, Rs 18,000 a seat for a 3.5 x 2 ft desk, Grade B, with gym, play zone and pool access. Free on the visit: a 150-seater cabin, a 15-seater cabin, a 22-seater, 15 open desks and some small cabins." },
  { id: "community-coworks-akruti-trade-centre", pubDesk: "Rs 15,000 (myHQ); from Rs 11,000 (Instant Offices)", pubCabin: "From Rs 16,000 (Qdesq, may be the Solitaire centre)", pubCap: "21,450 sq ft, about 800 seats (myHQ); 16,000 sq ft, 350 seats (Flexo)", pubSrc: "https://myhq.in/dedicated/coworking-space/community-coworks-andherieast", n: 6, sheetNo: 6, operator: "Community Coworks", building: "Akruti Trade Centre (MIDC Road 7)", geo: "akruti-trade-centre", micro: "chakala", grade: "B", seats: 380, price: 16500, desk: "4 x 2 ft", vacant: "15-, 16-, 5- and 10-seater cabins", clients: "Emerging Media, Erutech, FM Logistics", amenities: "Standard, printing, breakout zone", hours: "9 am to 9 pm, Monday to Saturday", parking: "Car Rs 5,000; two-wheeler Rs 1,500 a month", metro: "MIDC and Chakala", metroM: 700,
    fit: "value", reason: "380 seats, Rs 16,500 a seat for a 4 x 2 ft desk, Grade B. Free on the visit: 15-, 16-, 5- and 10-seater cabins. The sheet also notes a 16,000 sq ft carpet managed office for CTS India run by this operator." },
  { id: "wework-raheja-platinum", pubDesk: "Rs 24,500 (myHQ, quoted, negotiable)", pubCabin: "Rs 26,500 (myHQ); 8-person office Rs 2,33,800 a month (Office Hub)", pubCap: "154,000 sq ft, about 3,026 seats, 10 floors (myHQ)", pubSrc: "https://myhq.in/dedicated/coworking-space/wework-raheja-platinum", n: 7, sheetNo: 7, operator: "WeWork", building: "K Raheja Platinum", geo: "raheja-platinum", micro: "marol", grade: "A", seats: 3000, price: 28000, desk: "4 x 2 ft", vacant: "300 seats, a mix of open desks and cabins", clients: "Not shared", amenities: "Standard, printing, gym, play zone, swimming pool", hours: "9 am to 9 pm, Monday to Friday", parking: "Car Rs 8,000; two-wheeler Rs 3,000 a month", metro: "Marol Naka (Lines 1 and 3)", metroM: 700,
    fit: "premium", reason: "3,000 seats, Rs 28,000 a seat for a 4 x 2 ft desk, Grade A: the highest price and the only Grade A building visited. Free on the visit: 300 seats, a mix of open desks and cabins. Monday to Friday only." },
  { id: "innov8-zion-house", pubDesk: "From Rs 21,999 (operator); Rs 20,000 (myHQ)", pubCabin: "From Rs 24,999 (operator)", pubCap: "Over 1,900 seats (operator); 1,500 at launch, Dec 2024; about 1 lakh sq ft", pubSrc: "https://www.innov8.work/coworking-space/mumbai/house-andheri-east-6798d4b2b8e08e00015e1bf6/", n: 8, sheetNo: 8, operator: "Innov8", building: "Zion House", geo: "zion-house", micro: "vile-parle", grade: "B", seats: 1500, price: 26000, desk: "4 x 2 ft", vacant: "20-seater cabin, 5-, 13- and 4-seaters", clients: "OLX, Tata Digital", amenities: "Standard, breakout, printing", hours: "9 am to 9 pm, Monday to Saturday", parking: "Car Rs 3,500 a month; no two-wheeler parking", metro: "WEH (Line 1) and Gundavali (Line 7)", metroM: 900,
    fit: "premium", reason: "1,500 seats, Rs 26,000 a seat for a 4 x 2 ft desk, Grade B, in Vile Parle on the Western Express Highway. Free on the visit: a 20-seater cabin, 5-, 13- and 4-seaters." },
  { id: "smartworks-fleet-house", pubDesk: "Not published (managed campuses only)", pubCabin: "Rs 10,000 a seat managed office, 24-month lock-in (myHQ)", pubCap: "30,000 sq ft floor, about 1,000 seats (myHQ)", pubSrc: "https://myhq.in/managed-office/smartworks-andheri", n: 9, sheetNo: 9, operator: "Smartworks", building: "Fleet House", geo: "fleet-house", micro: "marol", grade: "B", seats: 2500, price: 23000, desk: "4 x 2 ft", vacant: "30-, 6-, 6-, 8- and 50-seater", clients: "upGrad, Bacardi, ShareChat", amenities: "Standard, breakout, printing", hours: "9 am to 9 pm, Monday to Saturday", parking: "Car Rs 4,000; two-wheeler Rs 1,500 a month", metro: "Marol Naka (Lines 1 and 3)", metroM: 100,
    fit: "scale", reason: "2,500 seats, Rs 23,000 a seat for a 4 x 2 ft desk, Grade B, at Marol Naka. Free on the visit: 30-, 6-, 6-, 8- and 50-seaters." },
  { id: "innov8-trade-star", pubDesk: "From Rs 16,000 (operator); Rs 17,000 (myHQ)", pubCabin: "From Rs 18,000 (operator)", pubCap: "Over 688 seats (operator); 12,500 sq ft, about 265 seats on the 3rd floor (myHQ)", pubSrc: "https://www.innov8.work/coworking-space/mumbai/trade-star-andheri-east-69d769aba3824000017d7e6e/", n: 10, sheetNo: 10, operator: "Innov8", building: "Akruti Trade Star", geo: "trade-star", micro: "jbnagar", grade: "B", seats: 330, price: 20000, desk: "3 x 2 ft", vacant: "20-seater and 6-seater", clients: "Marsh Communication, Delta", amenities: "Standard, breakout, printing", hours: "9 am to 9 pm, Monday to Saturday", parking: "To be confirmed", metro: "Marol (sheet); the building stands at Chakala J B Nagar metro", metroM: 300,
    fit: "premium", reason: "330 seats, Rs 20,000 a seat for a 3 x 2 ft desk, Grade B. Free on the visit: a 20-seater and a 6-seater. Parking to be confirmed." },
  { id: "315work-avenue-silver-utopia", pubDesk: "On request; brand-level from Rs 10,999 for 25+ seats", pubCabin: "On request", pubCap: "6,530 sq ft, about 200 seats (myHQ)", pubSrc: "https://myhq.in/managed-office/315-work-avenue-andheri", n: 11, sheetNo: 11, operator: "315Work Avenue", building: "Silver Utopia", geo: "silver-utopia", micro: "chakala", grade: "B", seats: 240, price: 18000, desk: "3.5 x 2 ft", vacant: "10 seats", clients: "BNY Mellon, Tata Technologies", amenities: "Standard, breakout, printing", hours: "9 am to 9 pm, Monday to Saturday", parking: "Car Rs 6,000; two-wheeler Rs 3,000 a month", metro: "WEH (Line 1) and Gundavali (Line 7)", metroM: 500,
    fit: "value", reason: "240 seats, Rs 18,000 a seat for a 3.5 x 2 ft desk, Grade B. Free on the visit: 10 seats." },
  { id: "awfis-skyline-icon", pubDesk: "Rs 12,999 (myHQ); hot desk Rs 9,099 (BookMyCoworking)", pubCabin: "Rs 12,999 (myHQ)", pubCap: "60,000 sq ft, about 1,200 seats (7th floor unit) plus 16,000 sq ft, about 535 seats (4th floor unit), myHQ", pubSrc: "https://myhq.in/dedicated/coworking-space/awfis-skyline-icon", n: 12, sheetNo: 12, operator: "Awfis", building: "Skyline Icon", geo: "skyline-icon", micro: "marol", grade: "B", seats: 825, price: 18000, desk: "3.5 x 2 ft", vacant: "20-seater, 6-seater and a 10-seater cabin", clients: "MobiKwik, PhonePe, Rentomojo", amenities: "Standard, breakout, printing", hours: "9 am to 9 pm, Monday to Saturday", parking: "To be confirmed", metro: "Marol Naka (Lines 1 and 3)", metroM: 350,
    fit: "value", reason: "825 seats, Rs 18,000 a seat for a 3.5 x 2 ft desk, Grade B, at Marol. Free on the visit: a 20-seater, a 6-seater and a 10-seater cabin. Parking to be confirmed." }
];

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
    "Price Autopilot's seats against the building each proposed site actually competes with: Smartworks at Fleet House (Rs 23,000) and WeWork at Raheja Platinum (Rs 28,000) for Privilon and 723 Avenue; Quest, 315Work and the two Executive Spaces centres (Rs 14,000 to 18,000) for Corporate Avenue.",
    "Re-visit Quest Coworks and WeWork: together they hold about 500 of the roughly 800 vacant seats counted, so their pricing on the big cabins is the real competition for a 100-plus seat enquiry.",
    "Ask Innov8 and Community Coworks for their list price at Akruti Trade Star in writing: the same building was quoted at Rs 16,500 and Rs 20,000 on the same week.",
    "Confirm parking at Innov8 Trade Star and Awfis Skyline Icon, which the visit sheet left as TBD, before quoting parking in any comparison.",
    "Time the walk from the station each centre names at 6 to 7 pm; the metro distances here are the sources' figures, not measured."
  ].join("\n"));

  /* ---- Options: the 11 centres ---- */
  const O = wb.getWorksheet("Options");
  for (const c of ["Operator", "Building", "Grade", "Total seats", "Price per seat (Rs a month, plus GST)", "Desk size", "Vacant seats on the visit", "Vacant seats (count)", "Clients seen", "Amenities", "Hours", "Parking", "Nearest metro", "Metro distance (m)", "Position note",
    "Floor / unit", "Total floors", "Furnishing", "Carpet area (sq ft)", "Built-up area (sq ft)", "Ceiling height", "Rent on carpet (Rs per sq ft a month)", "CAM (Rs per sq ft a month)", "Fire NOC", "OC and CC", "Available from"]) addCol(O, c);
  for (const c of CENTRES) {
    const g = GEO[c.geo];
    addRow(O, {
      "ID": c.id, "Rank": c.n, "Property name": `${c.operator} · ${c.building}`,
      "Latitude": g.lat, "Longitude": g.lng, "How exact is the pin": g.precision, "Source for the position": g.src,
      "Micro-market": c.micro, "Fit group": "coworking-competitors", "Why it scores as it does": c.reason,
      "Address": `${c.building}, ${c.micro === "vile-parle" ? "Vile Parle East" : "Andheri East"}, Mumbai`, "Locality": c.micro === "vile-parle" ? "Vile Parle East" : "Andheri East",
      "Operator": c.operator, "Building": c.building, "Grade": c.grade, "Total seats": c.seats,
      "Price per seat (Rs a month, plus GST)": c.price, "Desk size": c.desk, "Vacant seats on the visit": c.vacant, "Vacant seats (count)": vacantCount(c.vacant),
      "Clients seen": c.clients, "Amenities": c.amenities, "Hours": c.hours, "Parking": c.parking,
      "Nearest metro": c.metro, "Metro distance (m)": c.metroM, "Position note": g.note
    });
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
  const xlsx = path.join(dir, "andheri-coworking.xlsx");
  const json = path.join(dir, "andheri-coworking.bundle.json");
  const wb = await build();
  await wb.xlsx.writeFile(xlsx);
  const { bundle, notes } = await readWorkbook(xlsx);
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
  console.log(`Wrote ${path.relative(process.cwd(), xlsx)}, ${path.relative(process.cwd(), json)} and ${path.relative(process.cwd(), demo)}`);
  notes.forEach(n => console.log("  note: " + n));
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { build, CENTRES, PROPOSED, GEO, vacantCount };
