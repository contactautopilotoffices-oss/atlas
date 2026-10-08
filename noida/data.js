/* ============================================================================
   ATLAS · NOIDA OFFICE STUDY (Digitide) · data layer

   Generated from the files for this study and kept apart by kind, so a reader
   can always tell where a fact came from:

     SHEET    the broker sheet "Property_Options_in_Sector_57-67_1.xlsx" (Oct
              2026): 20 buildings, their figures and Autopilot's reason for
              each. Broker-stated and unconfirmed. Reasons are cleaned for the
              client view: typos fixed, internal names removed.
     PICKS    Autopilot's highlights in order (A-20, C-57, Magnus Tower) and
              D-245/5 as an option, as instructed by Autopilot (Oct 2026).
              D-245/5 was D-247/5 on the sheet, a typo.
     MAP      positions, each read from a published record and never placed
              by eye. "building" is pinned to the building or plot; "locality"
              means only the sector is known. Sources are in evidence/ledger.jsonl.
     RESEARCH the Blue and Aqua Line stations, institutes, residential belts,
              PG operators and BPO employers from the earlier Noida study, each
              with its source.

   Distances are straight lines between pins, never routed paths.
   ============================================================================ */
"use strict";

window.NOI_META = {
 "title": "Noida Office Study",
 "asOf": "2026-10-08",
 "center": [
  77.369,
  28.613
 ],
 "zoom": 12.6,
 "sheet": "Property_Options_in_Sector_57-67_1.xlsx: 20 buildings in Sectors 57 to 67, each with Autopilot's reason for shortlisting or rejecting it (Oct 2026)",
 "speed": {
  "kmh": 22,
  "factor": 1.3,
  "note": "Autopilot's working assumption for peak-hour driving on Noida's sector roads, not a published index",
  "src": ""
 },
 "picks": "Autopilot's highlights, in order: A-20, C-57 and Magnus Tower. D-245/5 stays as an option.",
 "nextSteps": [
  "A-20: confirm the date the new owner gives access (expected after October 2026) and that the bare shell can be handed over in the quoted 60 to 75 days.",
  "C-57: ask Digitide what did not work; the landlord can address parking (5 car parks per floor) and the split between pre-furnished and warm-shell floors.",
  "Magnus Tower: get the plot number or a map pin from the landlord; this map places it at the Sector 67 centre, so its distances are approximate.",
  "D-245/5: confirm the plot number (the sheet said D-247/5) and whether the stilt floor can be used, since the building area falls short without it.",
  "Ask every landlord for the same numbers: chargeable area, efficiency, rent, CAM, escalation and lock-in, so options compare like for like.",
  "Parking: most buildings rely on Noida Authority parking; count cars and two-wheelers at shift change before deciding.",
  "Visit at shift change and time the walk from the nearest metro station. Distances here are straight lines and drive times are estimates.",
  "Power: 100% DG backup, UPS space and twelve months of outage logs for the shifts the operation runs."
 ]
};

/* The current office: every option is read against it. */
window.NOI_EXISTING = {
 "id": "digitide-58",
 "name": "Digitide Sector 58",
 "label": "Current office",
 "locality": "A-94/5 & A-94/6, Sector 58",
 "micro": "s5758",
 "lat": 28.604613,
 "lng": 77.358912,
 "precision": "building",
 "geoNote": "Google Maps place record for Digitide Solutions Ltd; the plot split between A-94/5 and A-94/6 is not confirmed on the map (ledger geo-digitide-58).",
 "geoSrc": "",
 "src": "https://www.bsigroup.com/en-ZA/products-and-services/assessment-and-certification/validation-and-verification/client-directory-profile/E2E_SE-0047219867-014",
 "note": "2nd and 3rd floor, Plot A-94/5 and A-94/6, Sector 58, Noida 201301 (BSI client directory)."
};

/* The 20 buildings: Autopilot's highlights first, then the option, then the
   rest in the sheet's order. sheetNo is the column on the sheet. */
window.NOI_OPTIONS = [
 {
  "id": "techm",
  "n": 1,
  "sheetNo": 20,
  "name": "A-20 (former Tech Mahindra)",
  "sheetName": "A-20",
  "micro": "s5960",
  "sheetMicro": "Sector 60",
  "address": "A-20, Sector 60, Noida",
  "lat": 28.604926,
  "lng": 77.368878,
  "precision": "building",
  "geoNote": "Google Maps place record \"Tech Mahindra\" for A-20, Sector 60 (Plus Code J939+XH).",
  "geoSrc": "",
  "pick": 1,
  "verdict": "Highlight",
  "verdictNote": "Could be a promising option. The building is changing owners, and we will have access to it after October 2026.",
  "photo": "techm-9864e473.jpg",
  "thumb": "techm-9864e473-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 2",
  "floorPlate": "~27,000 sq ft",
  "plate": 27000,
  "offeredArea": "As per requirement",
  "floorOffered": "Entire building",
  "condition": "Bare shell",
  "handover": "60 to 75 days",
  "rent": "Bare shell: INR 55 / sq ft / month",
  "rentLo": 55.0,
  "cam": "Actual cost + 20%",
  "parking": "Surface parking",
  "buildingArea": "~1,08,000 sq ft",
  "powerBackup": "100%",
  "lastOccupier": "Tech Mahindra",
  "vacatedSince": "Sep 2026",
  "flag": {
   "v": "Access: the building is changing owners. Autopilot expects access after October 2026 and quotes 60 to 75 days to hand over the bare shell.",
   "src": ""
  }
 },
 {
  "id": "tv18",
  "n": 2,
  "sheetNo": 4,
  "name": "C-57 (former TV18)",
  "sheetName": "C-57",
  "micro": "s5758",
  "sheetMicro": "Sector 57",
  "address": "C-57, Sector 57, Noida",
  "lat": 28.60391,
  "lng": 77.352742,
  "precision": "building",
  "geoNote": "Google plot geocode for C-57, Sector 57; no TV18 place record exists at the plot, so the former tenant is not shown on maps.",
  "geoSrc": "",
  "pick": 2,
  "verdict": "Highlight",
  "verdictNote": "Well maintained, the entire building is available and the floor plates are larger. We recommend it strongly. Digitide has passed on it so far; if Digitide can tell us what did not work, we will take it up with the landlord.",
  "photo": "tv18-198e461b.jpg",
  "thumb": "tv18-198e461b-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 3",
  "floorPlate": "~18,000 sq ft",
  "plate": 18000,
  "offeredArea": "As per requirement",
  "floorOffered": "Entire building",
  "layout": "~800 seats across the ground and 1st floors",
  "condition": "Ground and 1st: pre-furnished. 2nd and 3rd: warm shell",
  "handover": "Ground and 1st: immediate. 2nd and 3rd: 3 months from signing",
  "rent": "Ground and 1st: INR 60 / sq ft / month as is where is. 2nd and 3rd: INR 80 with a new fit-out",
  "rentLo": 60.0,
  "cam": "Included in rent",
  "parking": "5 car parks for each floor leased",
  "sheetMetro": "Sector 59: 2 km",
  "buildingArea": "~72,000 sq ft",
  "powerBackup": "100%",
  "lastOccupier": "TV18",
  "vacatedSince": "Jun 2026"
 },
 {
  "id": "magnus",
  "n": 3,
  "sheetNo": 12,
  "name": "Magnus Tower",
  "sheetName": "Magnus Tower",
  "micro": "s67",
  "sheetMicro": "Sector 67",
  "address": "Magnus Tower, Sector 67, Noida",
  "lat": 28.604823,
  "lng": 77.3847901,
  "precision": "locality",
  "geoNote": "Sector 67 centre. There is no map record for the Sector 67 Magnus Tower; the only \"Magnus Tower\" place record is a separate, occupied building at Plot 6, Sector 73, 1.45 km south. A plot number or pin from the landlord will sharpen the distances.",
  "geoSrc": "https://www.openstreetmap.org/way/71834192",
  "pick": 3,
  "verdict": "Highlight",
  "verdictNote": "A good, new building with larger floor plates and room to grow. Digitide has passed on it so far.",
  "photo": "magnus-cbd04471.jpg",
  "thumb": "magnus-cbd04471-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 5",
  "floorPlate": "~38,000 sq ft",
  "plate": 38000,
  "offeredArea": "As per requirement",
  "floorOffered": "Multiple floors",
  "condition": "Warm shell",
  "handover": "October 2026",
  "rent": "Warm shell: INR 45 / sq ft / month",
  "rentLo": 45.0,
  "cam": "INR 10 / sq ft / month",
  "parking": "1 car park per 1,000 sq ft leased, included in rent",
  "sheetMetro": "Sector 61: 1 km",
  "buildingArea": "~2,20,000 sq ft",
  "powerBackup": "100%",
  "existingTenant": "New building, no existing tenant",
  "magnusNote": "This is the Sector 67 development, not the Magnus Tower at Plot 6, Sector 73, which is a separate, occupied 11-storey building 1.45 km to the south. Everything shown here is measured to the Sector 67 site. A plot number or map pin from the landlord will sharpen the distances further.",
  "catchmentNote": "Client read: the immediate catchment is the Sector 71 / 72 / 73 residential belt, and travel time to the Sector 15 area runs 30 to 40 minutes.",
  "flag": {
   "v": "Position: the pin is the Sector 67 centre, not the building. Ask the landlord for the plot number or a map pin.",
   "src": ""
  }
 },
 {
  "id": "noida-d245",
  "n": 4,
  "sheetNo": 11,
  "name": "D-245/5",
  "sheetName": "D-247/5 on the sheet, corrected to D-245/5",
  "micro": "s6364",
  "sheetMicro": "Sector 63",
  "address": "D-245/5, Sector 63, Noida",
  "lat": 28.62285,
  "lng": 77.38546,
  "precision": "locality",
  "geoNote": "Sector 63 centroid from Apple Maps (maps.apple.com/place?auid=13811944267343915519); D-245/5 has no published pin. The pin marks the sector, so distances are approximate.",
  "geoSrc": "",
  "verdict": "Option",
  "verdictNote": "Newly built, the entire building is available and it sits on a corner plot. The basement and the open area around it give plenty of parking, and the stilt floor can be used for parking or support areas. The building area is not enough unless the stilt floor can be used.",
  "photo": "noida-d245-b17a1e16.jpg",
  "thumb": "noida-d245-b17a1e16-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground or stilt + 2.5",
  "floorPlate": "~21,000 sq ft",
  "plate": 21000,
  "offeredArea": "As per requirement",
  "floorOffered": "Entire building",
  "condition": "Bare shell",
  "handover": "Immediate",
  "rent": "Bare shell: INR 45 / sq ft / month",
  "rentLo": 45.0,
  "cam": "Actual cost + 20%",
  "parking": "1 car park per 1,000 sq ft leased, included in rent",
  "sheetMetro": "Noida Electronic City: 1 km",
  "flag": {
   "v": "Plot number: the sheet said D-247/5, corrected to D-245/5. Confirm it with the broker; the map pin is the Sector 63 centre until the plot is pinned. The building area falls short unless the stilt floor can be used.",
   "src": ""
  }
 },
 {
  "id": "noida-a31",
  "n": 5,
  "sheetNo": 1,
  "name": "A-31",
  "sheetName": "A-31",
  "micro": "s6364",
  "sheetMicro": "Sector 64",
  "address": "A-31, Sector 64, Noida",
  "lat": 28.61053,
  "lng": 77.378246,
  "precision": "building",
  "geoNote": "Exa place directory entry (Google-Maps-style listing with rating, reviews and popular times) for 'NTA Exam Centre (Noida Sector - 64, U.P.)', address 'A, 31, Sector 64 Rd, Block A, Sector 64'. It lists Coordinates: 28.61053, 77.378246.",
  "geoSrc": "https://exa.ai/library/place/djs6r0h3ch4",
  "verdict": "Not suitable",
  "verdictNote": "Good floor plates, but the location and the approach road are poor. The building is in use as an NTA exam centre, with no date for when it will be free.",
  "photo": "noida-a31-bb6a1d03.jpg",
  "thumb": "noida-a31-bb6a1d03-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 3",
  "floorPlate": "~30,000 sq ft",
  "plate": 30000,
  "offeredArea": "As per requirement",
  "floorOffered": "Entire building",
  "layout": "1,100 workstations per floor",
  "condition": "Pre-furnished",
  "handover": "To be discussed",
  "rent": "INR 60 / sq ft / month, as is where is",
  "rentLo": 60.0,
  "cam": "Actual cost + 20%",
  "parking": "Noida Authority parking",
  "sheetMetro": "Sector 62: 0.5 km"
 },
 {
  "id": "noida-a100",
  "n": 6,
  "sheetNo": 2,
  "name": "A-100",
  "sheetName": "A-100",
  "micro": "s5758",
  "sheetMicro": "Sector 58",
  "address": "A-100, Sector 58, Noida",
  "lat": 28.605217,
  "lng": 77.361982,
  "precision": "building",
  "geoNote": "myHQ virtual-office listing for 'AltF Coworking, A100, A Block, Sector 58, Noida'. Its 'Longitude & Latitude' field reads 28.605217024090408, 77.3619820202395.",
  "geoSrc": "https://myhq.in/virtual-office/altf-coworking-sector58",
  "verdict": "Not suitable",
  "verdictNote": "An old building with only two lifts, and parking is difficult. The current tenant is planning to move out.",
  "photo": "noida-a100-7262371f.jpg",
  "thumb": "noida-a100-7262371f-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 3",
  "floorPlate": "~19,500 sq ft",
  "plate": 19500,
  "offeredArea": "~39,000 sq ft across 2 floors",
  "floorOffered": "1st floor (immediate) and 3rd floor (November 2026)",
  "layout": "500 workstations (3 x 2 ft) on each floor",
  "condition": "Pre-furnished",
  "handover": "Immediate",
  "rent": "INR 65 / sq ft / month, as is where is",
  "rentLo": 65.0,
  "cam": "INR 12 / sq ft / month",
  "parking": "Noida Authority parking",
  "sheetMetro": "Sector 59: 1.2 km"
 },
 {
  "id": "noida-a94-9",
  "n": 7,
  "sheetNo": 3,
  "name": "A-94/9",
  "sheetName": "A-94/9",
  "micro": "s5758",
  "sheetMicro": "Sector 58",
  "address": "A-94/9, Sector 58, Noida",
  "lat": 28.604788,
  "lng": 77.360328,
  "precision": "building",
  "geoNote": "IndiaBiz listing for 'Infinite Computer Solutions Limited'. The address is given as Plus Code 'J936+W48, A Block, Sector 58, Noida 201301', with a Google Maps link. I decoded the Plus Code (Open Location Code, full code 7JWVJ936+W48) locally to 28.6047875, 77.3603281. The decode is deterministic, about a 3 m cell, and used no geocoding API.",
  "geoSrc": "https://www.indiabiz.info/en/infinite-computer-solutions-limited_2N",
  "verdict": "Not suitable",
  "verdictNote": "Well maintained but old, with smaller floor plates. Only about 47,500 sq ft is available, and parking is limited because the basement is used as office space.",
  "photo": "noida-a94-9-4cd8a9df.jpg",
  "thumb": "noida-a94-9-4cd8a9df-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 2",
  "floorPlate": "~12,500 sq ft",
  "plate": 12500,
  "offeredArea": "As per requirement",
  "floorOffered": "Entire building",
  "layout": "~700 workstations (3.5 x 2 ft) across the building",
  "condition": "Pre-furnished",
  "handover": "November 2026",
  "rent": "INR 55 / sq ft / month as is where is. INR 75 with a new fit-out",
  "rentLo": 55.0,
  "cam": "Included in rent",
  "parking": "Noida Authority parking",
  "sheetMetro": "Sector 59: 1.2 km"
 },
 {
  "id": "noida-c49",
  "n": 8,
  "sheetNo": 5,
  "name": "C-49",
  "sheetName": "C-49",
  "micro": "s5758",
  "sheetMicro": "Sector 57",
  "address": "C-49, Sector 57, Noida",
  "lat": 28.60577,
  "lng": 77.355743,
  "precision": "locality",
  "geoNote": "Block C, Sector 57: the published pin for plot C-40 (Qualitek Labs), a sourced point in the same block; C-49 itself has no pin. The pin marks the sector, so distances are approximate.",
  "geoSrc": "",
  "verdict": "Not suitable",
  "verdictNote": "The building is too old.",
  "photo": "noida-c49-a42b82c5.jpg",
  "thumb": "noida-c49-a42b82c5-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 2",
  "floorPlate": "~15,000 sq ft",
  "plate": 15000,
  "offeredArea": "As per requirement",
  "floorOffered": "Entire building",
  "layout": "550 workstations plus cabins",
  "condition": "Pre-furnished",
  "handover": "Immediate",
  "rent": "INR 55 / sq ft / month, as is where is",
  "rentLo": 55.0,
  "cam": "Actual cost + 20%",
  "parking": "Noida Authority parking",
  "sheetMetro": "Sector 59: 2 km"
 },
 {
  "id": "noida-d233",
  "n": 9,
  "sheetNo": 6,
  "name": "D-233",
  "sheetName": "D-233",
  "micro": "s6364",
  "sheetMicro": "Sector 63",
  "address": "D-233, Sector 63, Noida",
  "lat": 28.627368,
  "lng": 77.385174,
  "precision": "building",
  "geoNote": "Exa place directory entry for 'Triangles Business Park', address 'D-233, D Block, Sector 63, 201309'. It lists Coordinates: 28.627368, 77.385174.",
  "geoSrc": "https://exa.ai/library/place/1prz56y1kc4",
  "verdict": "Not suitable",
  "verdictNote": "The building is too old.",
  "photo": "noida-d233-99bfce43.jpg",
  "thumb": "noida-d233-99bfce43-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 2",
  "floorPlate": "~18,000 sq ft",
  "plate": 18000,
  "offeredArea": "As per requirement",
  "floorOffered": "Ground, 1st and 2nd floors",
  "condition": "Bare shell",
  "handover": "Immediate",
  "rent": "Warm shell: INR 40 / sq ft / month",
  "rentLo": 40.0,
  "cam": "Actual cost + 20%",
  "parking": "Noida Authority parking",
  "sheetMetro": "Noida Electronic City: 1 km"
 },
 {
  "id": "noida-c24",
  "n": 10,
  "sheetNo": 7,
  "name": "C-24",
  "sheetName": "C-24",
  "micro": "s5758",
  "sheetMicro": "Sector 58",
  "address": "C-24, Sector 58, Noida",
  "lat": 28.608889,
  "lng": 77.361944,
  "precision": "building",
  "geoNote": "Wikimapia building object 'CSC Noida C 24/25 Sector -58' (office building, C Block 58). Its Coordinates read 28°36'32\"N 77°21'43\"E, which converts to 28.608889, 77.361944. The page rounds to whole arcseconds, about ±15 m.",
  "geoSrc": "http://wikimapia.org/15197253/CSC-Noida-C-24-25-Sector-58",
  "verdict": "Not suitable",
  "verdictNote": "An old building, and parking is difficult.",
  "photo": "noida-c24-9b88f551.jpg",
  "thumb": "noida-c24-9b88f551-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 3",
  "floorPlate": "~17,000 sq ft",
  "plate": 17000,
  "offeredArea": "As per requirement",
  "floorOffered": "Multiple floors",
  "condition": "Warm shell",
  "handover": "Immediate",
  "rent": "Warm shell: INR 50 / sq ft / month",
  "rentLo": 50.0,
  "cam": "Actual cost + 20%",
  "parking": "Noida Authority parking",
  "sheetMetro": "Sector 59: 1 km"
 },
 {
  "id": "noida-b25",
  "n": 11,
  "sheetNo": 8,
  "name": "B-25/1 & 2",
  "sheetName": "B-25/1 & 2",
  "micro": "s5960",
  "sheetMicro": "Sector 59",
  "address": "B-25/1 & 2, Sector 59, Noida",
  "lat": 28.6080248,
  "lng": 77.3676283,
  "precision": "locality",
  "geoNote": "Sector 59 anchor, OSM way 71649651 (same anchor as data.js); B-25 has no published pin. The pin marks the sector, so distances are approximate.",
  "geoSrc": "",
  "verdict": "Not suitable",
  "verdictNote": "An old building with smaller floor plates, and not enough area available.",
  "photo": "noida-b25-05ccd576.jpg",
  "thumb": "noida-b25-05ccd576-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 4",
  "floorPlate": "~12,000 sq ft",
  "plate": 12000,
  "offeredArea": "~36,000 sq ft",
  "floorOffered": "2nd, 3rd and 4th floors",
  "condition": "Bare shell",
  "handover": "Immediate",
  "rent": "Bare shell: INR 55 / sq ft / month. New fit-out: to be decided",
  "rentLo": 55.0,
  "cam": "INR 10 / sq ft / month",
  "parking": "Noida Authority parking",
  "sheetMetro": "Sector 59: 1 km"
 },
 {
  "id": "noida-b13",
  "n": 12,
  "sheetNo": 9,
  "name": "B-13",
  "sheetName": "B-13",
  "micro": "s6364",
  "sheetMicro": "Sector 63",
  "address": "B-13, Sector 63, Noida",
  "lat": 28.6166308,
  "lng": 77.3807004,
  "precision": "locality",
  "geoNote": "Sector 63 Road anchor, OSM way 71686932 (same anchor as data.js); B-13 has no published pin. The pin marks the sector, so distances are approximate.",
  "geoSrc": "",
  "verdict": "Not suitable",
  "verdictNote": "The floor plates are too small.",
  "photo": "noida-b13-cc821907.jpg",
  "thumb": "noida-b13-cc821907-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 3",
  "floorPlate": "~10,000 sq ft",
  "plate": 10000,
  "offeredArea": "~30,000 sq ft",
  "floorOffered": "Ground, 1st and 2nd floors",
  "condition": "Bare shell",
  "handover": "Immediate",
  "rent": "New fit-out: INR 65 / sq ft / month",
  "rentLo": 65.0,
  "cam": "INR 7 / sq ft / month",
  "parking": "Noida Authority parking",
  "sheetMetro": "Sector 62: 1 km"
 },
 {
  "id": "noida-a38",
  "n": 13,
  "sheetNo": 10,
  "name": "A-38/E & F",
  "sheetName": "A-38/E & F",
  "micro": "s6364",
  "sheetMicro": "Sector 64",
  "address": "A-38/E & F, Sector 64, Noida",
  "lat": 28.6144555,
  "lng": 77.3772344,
  "precision": "locality",
  "geoNote": "Sector 64 anchor, OSM way 357481072 (same anchor as data.js); A-38/E & F has no published pin. The pin marks the sector, so distances are approximate.",
  "geoSrc": "",
  "verdict": "Not suitable",
  "verdictNote": "Parking is the problem. The basement is used as office space, so the building takes only 8 to 10 cars, with limited two-wheeler parking along its edge and no parking nearby.",
  "photo": "noida-a38-ffa10c2d.jpg",
  "thumb": "noida-a38-ffa10c2d-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 3",
  "floorPlate": "~14,500 sq ft",
  "plate": 14500,
  "offeredArea": "As per requirement",
  "floorOffered": "Entire building",
  "condition": "Bare shell",
  "handover": "Immediate",
  "rent": "New fit-out: INR 75 / sq ft / month",
  "rentLo": 75.0,
  "cam": "Included in rent",
  "parking": "Noida Authority parking",
  "sheetMetro": "Sector 62: 0.5 km"
 },
 {
  "id": "noida-vin",
  "n": 14,
  "sheetNo": 13,
  "name": "Vin Tower",
  "sheetName": "Vin Tower",
  "micro": "s62",
  "sheetMicro": "Sector 62",
  "address": "Vin Tower, Sector 62, Noida",
  "lat": 28.614009,
  "lng": 77.355786,
  "precision": "building",
  "geoNote": "Place listing 'VIN Tower' (Google-style place record, 4.4 stars from 18 reviews, website studiokhozi.com Vin Tower listing): address '20/A3, C 20/1A/2, C Block, Phase 2, Industrial Area, Sector 62, 201309'; Coordinates 28.614009, 77.355786.",
  "geoSrc": "https://exa.ai/library/place/vnmp7fw2268",
  "verdict": "Not suitable",
  "verdictNote": "Recently built, but the floor plates are too small.",
  "photo": "noida-vin-23027b17.jpg",
  "thumb": "noida-vin-23027b17-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "2 Basements + Ground + 8",
  "floorPlate": "~9,000 sq ft",
  "plate": 9000,
  "offeredArea": "As per requirement",
  "floorOffered": "Multiple floors",
  "condition": "Warm shell",
  "handover": "Immediate",
  "rent": "Warm shell: INR 50 / sq ft / month. New fit-out: INR 70",
  "rentLo": 50.0,
  "cam": "INR 15 / sq ft / month",
  "parking": "1 car park per 1,000 sq ft leased, included in rent",
  "sheetMetro": "Sector 61: 2.5 km"
 },
 {
  "id": "noida-c56a3",
  "n": 15,
  "sheetNo": 14,
  "name": "C-56/A3",
  "sheetName": "C-56/A3",
  "micro": "s62",
  "sheetMicro": "Sector 62",
  "address": "C-56/A3, Sector 62, Noida",
  "lat": 28.614947,
  "lng": 77.363617,
  "precision": "building",
  "geoNote": "Place listing 'SPG NEXUS' (office): address 'C-56/A-3, C Block, Phase 2, Industrial Area, Sector 62, 201309'; Coordinates 28.614947, 77.363617.",
  "geoSrc": "https://exa.ai/library/place/05dl3cm42v0",
  "verdict": "Not suitable",
  "verdictNote": "The floor plates are too small.",
  "photo": "noida-c56a3-8c69f1f8.jpg",
  "thumb": "noida-c56a3-8c69f1f8-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "2 Basements + Ground + 7",
  "floorPlate": "~6,500 sq ft",
  "plate": 6500,
  "offeredArea": "As per requirement",
  "floorOffered": "Entire building",
  "condition": "Warm shell",
  "handover": "Immediate",
  "rent": "New fit-out: INR 85 / sq ft / month",
  "rentLo": 85.0,
  "cam": "INR 15 / sq ft / month",
  "parking": "Can be discussed",
  "sheetMetro": "Sector 62: 2 km"
 },
 {
  "id": "noida-c20",
  "n": 16,
  "sheetNo": 15,
  "name": "C-20/1A/4",
  "sheetName": "C-20/1A/4",
  "micro": "s62",
  "sheetMicro": "Sector 62",
  "address": "C-20/1A/4, Sector 62, Noida",
  "lat": 28.614336,
  "lng": 77.356492,
  "precision": "building",
  "geoNote": "Place listing 'Saamag Group' (office): address 'C-20/1A/4, C Block, Phase 2, Industrial Area, Sector 62, 201309'; Coordinates 28.614336, 77.356492.",
  "geoSrc": "https://exa.ai/library/place/zzdjwp4trv7",
  "verdict": "Not suitable",
  "verdictNote": "The floor plates are too small.",
  "photo": "noida-c20-81942261.jpg",
  "thumb": "noida-c20-81942261-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "2 Basements + Ground + 8",
  "floorPlate": "~5,000 sq ft",
  "plate": 5000,
  "offeredArea": "~30,000 sq ft",
  "floorOffered": "Ground, 1st and 3rd to 7th floors",
  "condition": "Ground and 1st: pre-furnished. 3rd to 7th: bare shell",
  "handover": "Immediate",
  "rent": "Bare shell: INR 60 / sq ft / month. As is where is: INR 80",
  "rentLo": 60.0,
  "cam": "INR 12 / sq ft / month",
  "parking": "1 car park per 1,000 sq ft leased, included in rent",
  "sheetMetro": "Sector 62: 2.5 km"
 },
 {
  "id": "noida-bhutani",
  "n": 17,
  "sheetNo": 16,
  "name": "Bhutani Cyberpark",
  "sheetName": "Bhutani Cyberpark",
  "micro": "s62",
  "sheetMicro": "Sector 62",
  "address": "Bhutani Cyberpark, Sector 62, Noida",
  "lat": 28.613032,
  "lng": 77.367175,
  "precision": "building",
  "geoNote": "Place listing 'Bhutani Cyberpark' (office, 4.0 stars from 74 reviews, website bhutani-groups.in/cyberpark): address 'Bhutani 62 Avenue, Block - C, C Block, Phase 2, Industrial Area, Sector 62, 201309'; Coordinates 28.613032, 77.367175.",
  "geoSrc": "https://exa.ai/library/place/ly259ykxwb7",
  "verdict": "Not suitable",
  "verdictNote": "No continuous space. The available floors are spread across different towers.",
  "photo": "noida-bhutani-3ce2ac9a.jpg",
  "thumb": "noida-bhutani-3ce2ac9a-thumb.jpg",
  "photoRender": true,
  "floorsTotal": "Towers A to D: 2 Basements + Ground + 10",
  "floorPlate": "~27,000 to 32,000 sq ft",
  "plate": 30000,
  "offeredArea": "Tower A 5th floor: 32,000 sq ft. Tower B 9th floor: 32,000 sq ft. Tower C ground floor: 30,000 sq ft",
  "floorOffered": "Tower A 5th, Tower B 9th and Tower C ground floors",
  "condition": "Bare shell",
  "handover": "Immediate",
  "rent": "Bare shell: INR 65 / sq ft / month. New fit-out: INR 80",
  "rentLo": 65.0,
  "cam": "INR 18.5 / sq ft / month",
  "parking": "1 car park per 1,000 sq ft leased, at INR 2,500 / car / month",
  "sheetMetro": "Sector 62: 2 km"
 },
 {
  "id": "kboulevard",
  "n": 18,
  "sheetNo": 17,
  "name": "Knowledge Boulevard",
  "sheetName": "Knowledge Boulevard",
  "micro": "s62",
  "sheetMicro": "Sector 62",
  "address": "Plot A-8A, Sector 62, Noida",
  "lat": 28.6301158,
  "lng": 77.3679468,
  "precision": "building",
  "geoNote": "OSM footprint for Plot A-8A, Sector 62 (way 634075406); Google's pin agrees to 31 m.",
  "geoSrc": "https://www.openstreetmap.org/way/634075406",
  "verdict": "Not suitable",
  "verdictNote": "No continuous space: the available floors are spread across the towers. It is also an expensive building, at a tentative INR 6,500 to 7,500 per seat.",
  "photo": "kboulevard-170bb675.jpg",
  "thumb": "kboulevard-170bb675-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Towers A and B: Basement + Stilt + 9",
  "floorPlate": "~95,000 sq ft",
  "plate": 95000,
  "offeredArea": "Tower A 8th floor: 22,000 sq ft. Tower B 3rd floor: 43,000 sq ft. Tower B 8th floor: 17,400 sq ft",
  "floorOffered": "Tower A 8th, Tower B 3rd and Tower B 8th floors",
  "condition": "Warm shell",
  "handover": "Immediate",
  "rent": "Warm shell: INR 65 / sq ft / month. New fit-out: INR 85",
  "rentLo": 65.0,
  "cam": "INR 24 / sq ft / month",
  "parking": "1 car park per 1,200 sq ft leased, included in rent",
  "sheetMetro": "Noida Electronic City: 2 km",
  "buildingArea": "Towers A and B: ~6,66,260 sq ft",
  "powerBackup": "100%",
  "cafeteria": "Yes, on the ground floor, for up to 1,000 people",
  "existingTenant": "Ericsson, Tech Mahindra, Tecture Infotech, Bharti Infratel and others"
 },
 {
  "id": "noida-c5646",
  "n": 19,
  "sheetNo": 18,
  "name": "C-56/46",
  "sheetName": "C-56/46",
  "micro": "s62",
  "sheetMicro": "Sector 62",
  "address": "C-56/46, Sector 62, Noida",
  "lat": 28.6211447,
  "lng": 77.3643493,
  "precision": "locality",
  "geoNote": "Sector 62 anchor, OSM node 10811810934 (same anchor as data.js); C-56/46 has no published pin. The pin marks the sector, so distances are approximate.",
  "geoSrc": "",
  "verdict": "Not suitable",
  "verdictNote": "The floor plates are too small.",
  "photo": "noida-c5646-7615c647.jpg",
  "thumb": "noida-c5646-7615c647-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 4",
  "floorPlate": "~4,000 sq ft",
  "plate": 4000,
  "offeredArea": "Entire building (~30,000 sq ft)",
  "floorOffered": "Entire building",
  "layout": "275 workstations, 3 conference rooms and 12 cabins",
  "condition": "Pre-furnished",
  "handover": "Immediate",
  "rent": "INR 65 / sq ft / month, as is where is",
  "rentLo": 65.0,
  "cam": "Paid by the tenant",
  "parking": "To be confirmed",
  "sheetMetro": "Noida Electronic City: 2 km"
 },
 {
  "id": "noida-d212",
  "n": 20,
  "sheetNo": 19,
  "name": "D-212",
  "sheetName": "D-212",
  "micro": "s6364",
  "sheetMicro": "Sector 63",
  "address": "D-212, Sector 63, Noida",
  "lat": 28.626609,
  "lng": 77.382075,
  "precision": "building",
  "geoNote": "Place listing 'Forever Placement Agency-Job Placement Agency in Noida': address 'D-212, Sector 63 Rd, D Block, Sector 63, 201309'; Coordinates 28.626609, 77.382075.",
  "geoSrc": "https://exa.ai/library/place/86njls22w9l",
  "verdict": "Not suitable",
  "verdictNote": "Not available, and an old building.",
  "photo": "noida-d212-2d2aa510.jpg",
  "thumb": "noida-d212-2d2aa510-thumb.jpg",
  "photoRender": false,
  "floorsTotal": "Basement + Ground + 1",
  "floorPlate": "~33,000 sq ft",
  "plate": 33000,
  "offeredArea": "As per requirement",
  "floorOffered": "Basement",
  "condition": "Warm shell",
  "handover": "Immediate",
  "rent": "Warm shell: INR 40 / sq ft / month",
  "rentLo": 40.0,
  "cam": "Actual cost + 20%",
  "parking": "To be confirmed",
  "sheetMetro": "Sector 62: 1 km"
 }
];

/* Micro-markets are Autopilot's grouping of the sheet's sectors. Outlines are
   indicative ellipses around the buildings in each. Rents are the sheet's
   quotes, not a market survey. */
window.NOI_ZONES = [
 {
  "key": "s5758",
  "label": "Sectors 57-58",
  "name": "Sectors 57 and 58: around today's office",
  "color": "#c48a3a",
  "shape": {
   "type": "ellipse",
   "c": [
    77.35736,
    28.6064
   ],
   "rx": 0.82,
   "ry": 0.6
  },
  "character": "Older industrial plots turned into offices, around Digitide's current office at A-94, Sector 58. Mostly smaller, older and pre-furnished buildings on Noida Authority parking.",
  "rent": {
   "v": "INR 50-80 per sq ft a month quoted on the sheet",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium",
   "lo": 50.0,
   "hi": 80.0
  },
  "plates": {
   "v": "~12,500 to ~19,500 sq ft per floor",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium"
  },
  "count": {
   "v": "5 on the sheet: C-57 (former TV18), A-100, A-94/9, C-49, C-24",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "high"
  },
  "pros": [
   "Digitide's current office is in this belt, so today's team keeps its commute.",
   "C-57 is available as a whole building, with pre-furnished ground and first floors (sheet)."
  ],
  "cons": [
   "The sheet rates C-49, A-100 and C-24 as old buildings, and parking comes up again and again.",
   "Most buildings rely on Noida Authority parking."
  ],
  "occupiers": {
   "v": "Colwell & Salmon, Concentrix Daksh, EXL Service, Genpact, HCL BPO / HCL Comnet, NSB BPO Solutions, iEnergizer (BPO and BPM employers within about 1 km; sources on the Talent tab)",
   "src": ""
  },
  "sources": []
 },
 {
  "key": "s5960",
  "label": "Sectors 59-60",
  "name": "Sectors 59 and 60: by the Sector 59 metro",
  "color": "#3d8c7a",
  "shape": {
   "type": "ellipse",
   "c": [
    77.36825,
    28.60648
   ],
   "rx": 0.5,
   "ry": 0.48
  },
  "character": "Industrial blocks between Sector 58 and the Blue Line at Sector 59. A-20 sits here, in the same block as BPO employers such as iEnergizer.",
  "rent": {
   "v": "INR 55-55 per sq ft a month quoted on the sheet",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium",
   "lo": 55.0,
   "hi": 55.0
  },
  "plates": {
   "v": "~12,000 to ~27,000 sq ft per floor",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium"
  },
  "count": {
   "v": "2 on the sheet: A-20 (former Tech Mahindra), B-25/1 & 2",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "high"
  },
  "pros": [
   "A-20 has 27,000 sq ft floor plates, the largest in this belt (sheet).",
   "Noida Sector 59 metro station is within about 1 km."
  ],
  "cons": [
   "A-20 is changing owners; Autopilot expects access after October 2026 (sheet).",
   "B-25 has small floor plates and not enough area (sheet)."
  ],
  "occupiers": {
   "v": "Colwell & Salmon, Concentrix Daksh, EXL Service, Genpact, HCL BPO / HCL Comnet, NSB BPO Solutions, Tech Mahindra (Sector 64), iEnergizer (BPO and BPM employers within about 1 km; sources on the Talent tab)",
   "src": ""
  },
  "sources": []
 },
 {
  "key": "s62",
  "label": "Sector 62",
  "name": "Sector 62: the institutional and IT pocket",
  "color": "#7a5fa8",
  "shape": {
   "type": "ellipse",
   "c": [
    77.36187,
    28.62157
   ],
   "rx": 0.98,
   "ry": 1.37
  },
  "character": "JIIT, JSS Academy and the IMS cluster, IT campuses such as Knowledge Boulevard and Bhutani Cyberpark, and the Sector 62 and Electronic City metro stations.",
  "rent": {
   "v": "INR 50-85 per sq ft a month quoted on the sheet",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium",
   "lo": 50.0,
   "hi": 85.0
  },
  "plates": {
   "v": "~4,000 to ~95,000 sq ft per floor",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium"
  },
  "count": {
   "v": "6 on the sheet: Vin Tower, C-56/A3, C-20/1A/4, Bhutani Cyberpark, Knowledge Boulevard, C-56/46",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "high"
  },
  "pros": [
   "Institutes on the doorstep: JIIT, JSS Academy and the IMS cluster.",
   "Recently built towers: Vin Tower, Bhutani Cyberpark and Knowledge Boulevard."
  ],
  "cons": [
   "Floor plates on the C-block plots are small, about 4,000 to 9,000 sq ft (sheet).",
   "The two campuses have no continuous space, and Knowledge Boulevard is expensive (sheet)."
  ],
  "occupiers": {
   "v": "Barclays Shared Services, Colwell & Salmon, Concentrix Daksh, EXL Service, Genpact, HCL BPO / HCL Comnet, NSB BPO Solutions, Tech Mahindra (Sector 64), iEnergizer (BPO and BPM employers within about 1 km; sources on the Talent tab)",
   "src": ""
  },
  "sources": []
 },
 {
  "key": "s6364",
  "label": "Sectors 63-64",
  "name": "Sectors 63 and 64: the NH-24 industrial belt",
  "color": "#5a7f3a",
  "shape": {
   "type": "ellipse",
   "c": [
    77.38135,
    28.61895
   ],
   "rx": 0.76,
   "ry": 1.35
  },
  "character": "Large industrial sectors along NH-24 with a mix of newer and older office plots, and Noida Electronic City metro on the north side.",
  "rent": {
   "v": "INR 40-75 per sq ft a month quoted on the sheet",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium",
   "lo": 40.0,
   "hi": 75.0
  },
  "plates": {
   "v": "~10,000 to ~33,000 sq ft per floor",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium"
  },
  "count": {
   "v": "6 on the sheet: D-245/5, A-31, D-233, B-13, A-38/E & F, D-212",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "high"
  },
  "pros": [
   "D-245/5 is newly built, with plenty of parking in the basement and around the building (sheet).",
   "Noida Electronic City metro station serves the north of Sector 63."
  ],
  "cons": [
   "A-31 is in use as an NTA exam centre with no availability date, and A-38 has almost no parking (sheet).",
   "D-233 and D-212 are old buildings (sheet)."
  ],
  "occupiers": {
   "v": "Cogent E Services, Concentrix Daksh, Genpact, HCL BPO / HCL Comnet, Pacific BPO (Access Healthcare), Tech Mahindra (Sector 64) (BPO and BPM employers within about 1 km; sources on the Talent tab)",
   "src": ""
  },
  "sources": []
 },
 {
  "key": "s67",
  "label": "Sector 67",
  "name": "Sector 67: newer development to the east",
  "color": "#b0567a",
  "shape": {
   "type": "ellipse",
   "c": [
    77.38479,
    28.60482
   ],
   "rx": 0.5,
   "ry": 0.4
  },
  "character": "A newer development east of the Sector 62 to 66 belt, next to the Mamura and Sector 71 to 73 residential belts.",
  "rent": {
   "v": "INR 45-45 per sq ft a month quoted on the sheet",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium",
   "lo": 45.0,
   "hi": 45.0
  },
  "plates": {
   "v": "~38,000 sq ft per floor",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "medium"
  },
  "count": {
   "v": "1 on the sheet: Magnus Tower",
   "asOf": "Oct 2026",
   "src": "",
   "conf": "high"
  },
  "pros": [
   "Magnus Tower: a new building with ~38,000 sq ft floor plates and room to grow (sheet).",
   "Next to the Sector 71 to 73 residential belt and Mamura, where many staff can live."
  ],
  "cons": [
   "The sheet puts the Sector 61 metro about 1 km away; the map pin is the sector centre, so check on site.",
   "Digitide has passed on Magnus Tower so far."
  ],
  "sources": []
 }
];

window.NOI_TRANSIT = {
 "asOf": "2026-10-08",
 "asOfText": "Oct 2026",
 "lines": [
  {
   "key": "blue",
   "name": "Delhi Metro Blue Line (Noida branch)",
   "short": "Blue Line",
   "mode": "metro",
   "status": "open",
   "color": "#2b6cb0",
   "note": "The Noida branch of the Blue Line; shown are the five stations that serve this study. Station coordinates are from each station's Wikipedia page.",
   "src": "https://en.wikipedia.org/wiki/Blue_Line_(Delhi_Metro)",
   "stations": [
    {
     "name": "Noida Sector 52",
     "lat": 28.587156,
     "lng": 77.372381,
     "open": true,
     "coordSrc": "https://en.wikipedia.org/wiki/Noida_Sector_52_metro_station"
    },
    {
     "name": "Noida Sector 61",
     "lat": 28.597631,
     "lng": 77.3722988,
     "open": true,
     "coordSrc": "https://en.wikipedia.org/wiki/Noida_Sector_61_metro_station"
    },
    {
     "name": "Noida Sector 59",
     "lat": 28.606493,
     "lng": 77.3727259,
     "open": true,
     "coordSrc": "https://en.wikipedia.org/wiki/Noida_Sector_59_metro_station"
    },
    {
     "name": "Noida Sector 62",
     "lat": 28.6169948,
     "lng": 77.3736097,
     "open": true,
     "coordSrc": "https://en.wikipedia.org/wiki/Noida_Sector_62_metro_station"
    },
    {
     "name": "Noida Electronic City",
     "lat": 28.6279412,
     "lng": 77.37493,
     "open": true,
     "coordSrc": "https://en.wikipedia.org/wiki/Noida_Electronic_City_metro_station"
    }
   ]
  },
  {
   "key": "aqua",
   "name": "Noida Metro Aqua Line",
   "short": "Aqua Line",
   "mode": "metro",
   "status": "open",
   "color": "#1aa3b8",
   "note": "Starts at Sector 51, a street-level walk of about 300 m from Blue Line Sector 52; not a paid-area interchange.",
   "src": "https://en.wikipedia.org/wiki/Aqua_Line_(Noida_Metro)",
   "stations": [
    {
     "name": "Sector 51",
     "lat": 28.58559,
     "lng": 77.37536,
     "open": true,
     "coordSrc": "Google Maps place record (ledger geo-stn-sec51)"
    }
   ]
  }
 ],
 "anchors": []
};

/* Institutes (edu), residential belts (res), PG and co-living (pg) and BPO /
   BPM employers hiring from the same pool (bpo). Sector-level points share a
   sector anchor. */
window.NOI_PLACES = [
 {
  "id": "ienergizer",
  "kind": "bpo",
  "name": "iEnergizer",
  "sub": "A-37, Sector 60, the same industrial block as option A-20",
  "lat": 28.6039578,
  "lng": 77.3648303,
  "precision": "landuse",
  "note": "A-37, Sector 60, the same industrial block as option A-20. Hiring graduate freshers for domestic voice at ₹19,000-23,000 CTC, 200 openings in one recent drive.",
  "src": "https://vacancy9.com/ienergizer-noida-sector-60-job/"
 },
 {
  "id": "exl-58",
  "kind": "bpo",
  "name": "EXL Service",
  "sub": "A-48, Block A, Sector 58",
  "lat": 28.6065664,
  "lng": 77.3590182,
  "precision": "sector",
  "note": "A-48, Block A, Sector 58 , the same sector as Digitide's existing office.",
  "src": "https://www.noidaonline.in/guide/bpos-in-noida"
 },
 {
  "id": "hcl-bpo-59",
  "kind": "bpo",
  "name": "HCL BPO / HCL Comnet",
  "sub": "B-34/3, Sector 59",
  "lat": 28.6080248,
  "lng": 77.3676283,
  "precision": "sector",
  "note": "B-34/3, Sector 59.",
  "src": "https://www.noidaonline.in/guide/bpos-in-noida"
 },
 {
  "id": "genpact-59",
  "kind": "bpo",
  "name": "Genpact",
  "sub": "D-4, Sector 59",
  "lat": 28.6080248,
  "lng": 77.3676283,
  "precision": "sector",
  "note": "D-4, Sector 59 , listed on Genpact's own locations page alongside its larger Sector 135 campuses.",
  "src": "https://www.genpact.com/about-us/locations"
 },
 {
  "id": "concentrix-62",
  "kind": "bpo",
  "name": "Concentrix Daksh",
  "sub": "Ground floor, Tower C, Logix Cyber Park, C-28 & C-29, Sector 62",
  "lat": 28.6118616,
  "lng": 77.3663002,
  "precision": "landuse",
  "note": "Ground floor, Tower C, Logix Cyber Park, C-28 & C-29, Sector 62 , the same sector as Knowledge Boulevard.",
  "src": "https://traffictail.com/bpo-companies-in-noida/"
 },
 {
  "id": "colwell-58",
  "kind": "bpo",
  "name": "Colwell & Salmon",
  "sub": "A-17, Sector 58",
  "lat": 28.6065664,
  "lng": 77.3590182,
  "precision": "sector",
  "note": "A-17, Sector 58.",
  "src": "https://www.grotal.com/Noida/Call-Center-Outsourcing-Services-C52/"
 },
 {
  "id": "pacific-63",
  "kind": "bpo",
  "name": "Pacific BPO (Access Healthcare)",
  "sub": "A-61, Sector 63",
  "lat": 28.6166308,
  "lng": 77.3807004,
  "precision": "sector",
  "note": "A-61, Sector 63.",
  "src": "https://www.noidaonline.in/guide/bpos-in-noida"
 },
 {
  "id": "cogent-63",
  "kind": "bpo",
  "name": "Cogent E Services",
  "sub": "C-100, Sector 63",
  "lat": 28.6166308,
  "lng": 77.3807004,
  "precision": "sector",
  "note": "C-100, Sector 63.",
  "src": "https://www.noidaonline.in/guide/bpos-in-noida"
 },
 {
  "id": "techm-64",
  "kind": "bpo",
  "name": "Tech Mahindra (Sector 64)",
  "sub": "A-6, Sector 64, near Sahara Chowk",
  "lat": 28.6144555,
  "lng": 77.3772344,
  "precision": "sector",
  "note": "A-6, Sector 64, near Sahara Chowk. Running walk-in customer-service drives at ₹1.25-3.25 LPA, 100+ openings. The same employer vacated option A-20.",
  "src": "https://vacancy9.com/tech-mahindra-customer-service/"
 },
 {
  "id": "barclays-62",
  "kind": "bpo",
  "name": "Barclays Shared Services",
  "sub": "Unitech Infospace, Sector 62",
  "lat": 28.6211447,
  "lng": 77.3643493,
  "precision": "sector",
  "note": "Unitech Infospace, Sector 62. A BFSI captive competing for the same graduate voice and back-office pool.",
  "src": "https://www.grotal.com/Noida/Call-Center-Outsourcing-Services-C52/"
 },
 {
  "id": "nsb-58",
  "kind": "bpo",
  "name": "NSB BPO Solutions",
  "sub": "Sector 58",
  "lat": 28.6065664,
  "lng": 77.3590182,
  "precision": "sector",
  "note": "Sector 58. Advertising 99 fresher customer-support seats at ₹12,000-16,000 per month , the floor of the local pay band.",
  "src": "https://www.jobhai.com/customer-support-telecaller-customer-support-executive-job-in-nsb-bpo-solutions-limited-sector-58-noida-0-to-0-years-1774958477-7452995-jid"
 },
 {
  "id": "pg-zolo-58",
  "kind": "pg",
  "name": "Zolo County, Sector 58",
  "sub": "H-10, Bishanpura Road, Sector 58",
  "lat": 28.6065664,
  "lng": 77.3590182,
  "precision": "sector",
  "note": "H-10, Bishanpura Road, Sector 58. Men's co-living: two-sharing from ₹4,263, private room from ₹7,708. The cheapest sourced bed next to the Sector 58-60 belt.",
  "src": "https://zolostays.com/pg-hostel-near-sector_58-in-noida-zolo_county-znd019"
 },
 {
  "id": "pg-hooliv-58",
  "kind": "pg",
  "name": "HooLiv Mitra, Sector 58",
  "sub": "H-8, Bishanpura, Sector 58",
  "lat": 28.6065664,
  "lng": 77.3590182,
  "precision": "sector",
  "note": "H-8, Bishanpura, Sector 58. Unisex co-living from ₹12,000 with meals. Sister properties Aura (₹15,000), Luxor and Ociana (₹12,000) and Sanskar (₹10,000) sit in the same pocket.",
  "src": "https://hooliv.com/hooliv-mitra-unisex-hostel-in-noida-boys-girls-hostel-near-jss-academy-fosma-aaft-symbiosis-ims-noida-sector-58-noida-sector-62-noida-sector-63-pg-premium-affordable-rooms/"
 },
 {
  "id": "pg-ohmyplace-58",
  "kind": "pg",
  "name": "Oh My Place, Sector 58",
  "sub": "M-73C, Sector 58, near Stellar Business Park",
  "lat": 28.6065664,
  "lng": 77.3590182,
  "precision": "sector",
  "note": "M-73C, Sector 58, near Stellar Business Park. Furnished 1RK studio co-living at ₹18,000 a month, 90 units. 1.6 km to Sector 62 metro, 1.9 km to Sector 59.",
  "src": "https://www.ohmyplace.com/co-living/omp-co-living-pg-in-noida-sector-58/"
 },
 {
  "id": "pg-housitize-58",
  "kind": "pg",
  "name": "Housitize PG, Sector 58",
  "sub": "Sector 58 co-living, 28 rooms",
  "lat": 28.6065664,
  "lng": 77.3590182,
  "precision": "sector",
  "note": "Sector 58 co-living, 28 rooms. Double sharing ₹8,500 with meals, single occupancy ₹14,500. Three-month minimum stay.",
  "src": "https://housitizepg.com/property/coliving-pg-near-sector-62-noida-4/"
 },
 {
  "id": "pg-pgnoida-62",
  "kind": "pg",
  "name": "PGNoida cluster, Sector 62",
  "sub": "Multiple houses across Sectors 58-63",
  "lat": 28.6211447,
  "lng": 77.3643493,
  "precision": "sector",
  "note": "Multiple houses across Sectors 58-63. Four-sharing from ₹6,500, triple ₹7,000, double ₹8,500, single ₹14,000-22,000. Operating since 2009, no lock-in.",
  "src": "https://www.pgnoida.com/"
 },
 {
  "id": "pg-premium-62",
  "kind": "pg",
  "name": "Premium PG, Sector 62",
  "sub": "About 1 km from Sector 62 metro",
  "lat": 28.6211447,
  "lng": 77.3643493,
  "precision": "sector",
  "note": "About 1 km from Sector 62 metro. Double sharing ₹13,000-14,000 per bed, AC, meals, 24x7 security. Serves Knowledge Boulevard directly.",
  "src": "https://www.pgnoida.com/post/premium-pg-in-noida-sector-62"
 },
 {
  "id": "pg-mamura",
  "kind": "pg",
  "name": "Mamura informal rental market",
  "sub": "Dense low-cost rentals south-east of the Sector 60 belt",
  "lat": 28.6036193,
  "lng": 77.3754881,
  "precision": "sector",
  "note": "Dense low-cost rental settlement south-east of the Sector 60 belt, named in the inventory sheet as a primary talent source. Informal market , no organised-PG rate card, which is exactly why it absorbs night-shift staff at the lowest cost.",
  "src": "https://www.pgnoida.com/"
 },
 {
  "id": "pg-sec61",
  "kind": "pg",
  "name": "Sector 61 residential PG belt",
  "sub": "Planned residential sector next to the Sector 60 options",
  "lat": 28.5964581,
  "lng": 77.3675644,
  "precision": "sector",
  "note": "Planned residential sector directly between the Sector 60 options and Sector 61 metro. Standard family-flat sublets and PG rooms; the walk-to-work option for A-20.",
  "src": "https://www.pgnoida.com/"
 },
 {
  "id": "pg-sec71",
  "kind": "pg",
  "name": "Sector 71 / 72 / 73 PG belt",
  "sub": "High-density residential belt near Magnus Tower",
  "lat": 28.5942367,
  "lng": 77.3761378,
  "precision": "sector",
  "note": "High-density residential belt the client names as Magnus Tower's immediate catchment. Large supply of shared flats and PG rooms aimed at the Sector 62-67 office floors.",
  "src": "https://www.pgnoida.com/"
 },
 {
  "id": "jiit-62",
  "kind": "edu",
  "name": "Jaypee Institute of Information Technology",
  "sub": "A-10, Sector 62",
  "lat": 28.6300443,
  "lng": 77.3720823,
  "precision": "poi",
  "note": "A-10, Sector 62. Deemed university on a 46.94-acre campus, NIRF engineering band 101-150. B.Tech, MBA, BBA, BCA and MCA , the BBA/BCA/MCA streams are the realistic BPM feeder, not the CSE batch. JIIT also runs a Sector 128 campus on the Expressway with centralised placements, so it feeds the same recruiter pipeline; it has no OSM record of its own, so it is not pinned separately.",
  "src": "https://www.jiit.ac.in/"
 },
 {
  "id": "jss-62",
  "kind": "edu",
  "name": "JSS Academy of Technical Education",
  "sub": "C-20/1, Sector 62",
  "lat": 28.6139258,
  "lng": 77.3595011,
  "precision": "poi",
  "note": "C-20/1, Sector 62. 4,000+ students, roughly 900 B.Tech seats a year plus MBA and MCA. 577 students placed in the 2024 drive at an average of ₹5.2 LPA.",
  "src": "https://www.collegedekho.com/colleges/jss-noida"
 },
 {
  "id": "ims-62",
  "kind": "edu",
  "name": "IMS Noida / Symbiosis / Jaipuria cluster",
  "sub": "Sector 62 institutional pocket",
  "lat": 28.6305337,
  "lng": 77.3689271,
  "precision": "poi",
  "note": "Sector 62 institutional pocket. Management and mass-communication intakes, cited by local PG operators as their student base , graduate supply on the doorstep of Knowledge Boulevard.",
  "src": "https://www.pgnoida.com/post/premium-pg-in-noida-sector-62"
 },
 {
  "id": "amity-125",
  "kind": "edu",
  "name": "Amity University, Sector 125",
  "sub": "Large graduate output across management and engineering",
  "lat": 28.5432229,
  "lng": 77.3327483,
  "precision": "poi",
  "note": "Largest single graduate output in Noida across management, communication and humanities. 12-14 km from the shortlist , a bus-route catchment, not a walk-in one.",
  "src": "https://digitalconvey.com/mnc-companies-in-noida/"
 },
 {
  "id": "res-mamura",
  "kind": "res",
  "name": "Mamura",
  "sub": "Dense low-cost rental settlement",
  "lat": 28.6036193,
  "lng": 77.3754881,
  "precision": "locality",
  "note": "Named in the inventory sheet as a primary talent source. Walk-in and e-rickshaw range for the whole Sector 57-67 belt.",
  "src": ""
 },
 {
  "id": "res-sec71",
  "kind": "res",
  "name": "Sector 71 / 72 / 73 belt",
  "sub": "High-density planned residential",
  "lat": 28.5942367,
  "lng": 77.3761378,
  "precision": "locality",
  "note": "The client's stated immediate catchment for Magnus Tower. Large shared-flat and PG supply aimed at the Sector 62-67 floors.",
  "src": ""
 },
 {
  "id": "res-sec61",
  "kind": "res",
  "name": "Sector 61 residential",
  "sub": "Planned residential, metro-adjacent",
  "lat": 28.5964581,
  "lng": 77.3675644,
  "precision": "locality",
  "note": "Sits between Sector 60 and Sector 61 metro. The genuine walk-to-work catchment for A-20.",
  "src": ""
 },
 {
  "id": "res-sec51",
  "kind": "res",
  "name": "Sector 51 / Hoshiyarpur",
  "sub": "Urban village plus planned sector",
  "lat": 28.5821535,
  "lng": 77.371457,
  "precision": "locality",
  "note": "Sector 51 Aqua Line and Sector 52 Blue Line interchange put it one hop from the shortlist.",
  "src": ""
 },
 {
  "id": "res-nithari",
  "kind": "res",
  "name": "Nithari",
  "sub": "Established low-cost colony",
  "lat": 28.5762127,
  "lng": 77.3422231,
  "precision": "locality",
  "note": "Long-standing BPO labour catchment for central Noida.",
  "src": ""
 },
 {
  "id": "res-sec15",
  "kind": "res",
  "name": "Sector 15 area",
  "sub": "Older planned sectors, Blue Line served",
  "lat": 28.5827979,
  "lng": 77.3102221,
  "precision": "locality",
  "note": "The client puts real travel time from Magnus Tower at 30-40 minutes. Established white-collar and support workforce.",
  "src": ""
 },
 {
  "id": "res-sec62res",
  "kind": "res",
  "name": "Sector 62 residential",
  "sub": "Mixed institutional and residential",
  "lat": 28.6211447,
  "lng": 77.3643493,
  "precision": "locality",
  "note": "Student and young-professional housing around the JIIT / JSS / IMS cluster. On Knowledge Boulevard's doorstep.",
  "src": ""
 },
 {
  "id": "res-indirapuram",
  "kind": "res",
  "name": "Indirapuram",
  "sub": "Mid-income Ghaziabad suburb",
  "lat": 28.6380466,
  "lng": 77.3644168,
  "precision": "locality",
  "note": "Named in the inventory sheet. Graduate and experienced voice/back-office supply, car and two-wheeler commuters.",
  "src": ""
 },
 {
  "id": "res-vaishali",
  "kind": "res",
  "name": "Vaishali",
  "sub": "Mid-income, Blue Line metro",
  "lat": 28.6471629,
  "lng": 77.3346949,
  "precision": "locality",
  "note": "Named in the inventory sheet. On the same Blue Line as the shortlist , the cleanest metro-borne catchment.",
  "src": ""
 },
 {
  "id": "res-vasundhara",
  "kind": "res",
  "name": "Vasundhara",
  "sub": "Mid-income Ghaziabad suburb",
  "lat": 28.6619725,
  "lng": 77.3732972,
  "precision": "locality",
  "note": "Named in the inventory sheet. Feeds the Sector 62-63 belt by road.",
  "src": ""
 },
 {
  "id": "res-crossings",
  "kind": "res",
  "name": "Crossings Republik",
  "sub": "High-density apartment township",
  "lat": 28.6284686,
  "lng": 77.434157,
  "precision": "locality",
  "note": "Named in the inventory sheet. Large young-professional population, but NH-24 dependent and shuttle-reliant , read it one band later than shown.",
  "src": ""
 },
 {
  "id": "res-mayur-vihar",
  "kind": "res",
  "name": "Mayur Vihar / East Delhi",
  "sub": "Dense East Delhi residential",
  "lat": 28.6098555,
  "lng": 77.2926318,
  "precision": "locality",
  "note": "Named in the inventory sheet as East Delhi. Very large pool, entirely metro-dependent for this belt.",
  "src": ""
 }
];

window.NOI_FACTS = {
 "market": [
  {
   "k": "Quoted rents on the sheet",
   "v": "INR 40 to 85 per sq ft a month across the 20 buildings. Bare and warm shell mostly INR 40 to 65; pre-furnished as is where is INR 55 to 65; new fit-outs INR 65 to 85.",
   "asOf": "Oct 2026",
   "conf": "medium",
   "src": "",
   "note": "Broker-stated, from the property options sheet"
  },
  {
   "k": "Maintenance (CAM)",
   "v": "INR 7 to 24 per sq ft a month where a figure is quoted; seven buildings charge actual cost plus 20%, and four include it in the rent.",
   "asOf": "Oct 2026",
   "conf": "medium",
   "src": "",
   "note": "Broker-stated, from the property options sheet"
  },
  {
   "k": "Floor plates",
   "v": "From about 4,000 sq ft (C-56/46) to about 38,000 sq ft (Magnus Tower) for single buildings; Knowledge Boulevard's towers run to about 95,000 sq ft.",
   "asOf": "Oct 2026",
   "conf": "medium",
   "src": "",
   "note": "Broker-stated, from the property options sheet"
  },
  {
   "k": "The screening",
   "v": "Of the 20 buildings, Autopilot highlights three (A-20, C-57 and Magnus Tower) and keeps D-245/5 as an option. The other 16 are not suitable, mostly for age, small floor plates, parking or availability.",
   "asOf": "Oct 2026",
   "conf": "high",
   "src": "",
   "note": "Autopilot's reasons are on each building"
  }
 ],
 "talent": [
  {
   "k": "Live BPO openings, Noida",
   "v": "~720 listed. LinkedIn job board, filtered to Noida; 279 tagged Noida city against 197 Gurgaon.",
   "asOf": "2026",
   "conf": "medium",
   "src": "https://in.linkedin.com/jobs/bpo-jobs-noida"
  },
  {
   "k": "Live customer-support openings, Noida",
   "v": "~146-161 full-time. apna.co verified vacancies, Aug 2026.",
   "asOf": "2026",
   "conf": "medium",
   "src": "https://apna.co/jobs/dep_customer_support-full_time-jobs-in-noida"
  },
  {
   "k": "Entry-level pay band",
   "v": "₹12,000-23,000 / month. NSB BPO Sector 58 at ₹12,000-16,000; iEnergizer Sector 60 at ₹19,000-23,000 CTC; Tech Mahindra Sector 64 at ₹1.25-3.25 LPA.",
   "asOf": "2026",
   "conf": "medium",
   "src": "https://vacancy9.com/ienergizer-noida-sector-60-job/"
  },
  {
   "k": "PG bed cost, Sector 58-62",
   "v": "₹4,263-18,000 / month. Zolo two-sharing ₹4,263 at the floor; Housitize double ₹8,500; PGNoida four-sharing ₹6,500; Oh My Place studio ₹18,000 at the ceiling. Night-shift staff can live walking distance from the Sector 58-60 options.",
   "asOf": "2026",
   "conf": "medium",
   "src": "https://zolostays.com/pg-hostel-near-sector_58-in-noida-zolo_county-znd019"
  },
  {
   "k": "Single-drive hiring volume",
   "v": "100-200 seats. One iEnergizer Sector 60 drive advertised 200 openings; one Tech Mahindra Sector 64 drive advertised 100+. The belt absorbs volume hiring routinely.",
   "asOf": "2026",
   "conf": "medium",
   "src": "https://vacancy9.com/tech-mahindra-customer-service/"
  },
  {
   "k": "Sector-level hiring trend",
   "v": "+21% YoY. National BPO/ITES hiring growth, Jan 2026, with foreign MNCs driving over 80% of the increase. Directional context, not a Noida-specific figure.",
   "asOf": "2026",
   "conf": "medium",
   "src": "https://www.newspaperinsider.com/business/noidas-it-bpo-hiring-surge-whats-driving-the-growth/"
  },
  {
   "k": "Local graduate supply",
   "v": "~1,500+ / year, Sector 62 alone. JSS Academy alone runs ~900 B.Tech seats plus MBA/MCA and placed 577 in 2024; JIIT Sector 62 adds B.Tech, MBA, BBA, BCA and MCA on a 46.94-acre campus. Counts are intake/placement figures from the institutions, not a modelled BPM-addressable total.",
   "asOf": "2026",
   "conf": "medium",
   "src": "https://www.collegedekho.com/colleges/jss-noida"
  }
 ],
 "transit": [
  {
   "k": "Blue Line in Noida",
   "v": "The Blue Line's Noida branch runs through Sector 52, Sector 61, Sector 59, Sector 62 and Noida Electronic City, all open. Every building on the sheet is within about 2.5 km of one of them in a straight line.",
   "asOf": "Oct 2026",
   "conf": "high",
   "src": "https://en.wikipedia.org/wiki/Blue_Line_(Delhi_Metro)"
  },
  {
   "k": "Aqua Line interchange",
   "v": "Noida Metro's Aqua Line starts at Sector 51, a street-level walk of about 300 m from Blue Line Sector 52.",
   "asOf": "Oct 2026",
   "conf": "high",
   "src": "https://en.wikipedia.org/wiki/Aqua_Line_(Noida_Metro)"
  },
  {
   "k": "The last mile",
   "v": "Shared autos and e-rickshaws carry most of the last mile from the stations into the sector blocks, as the sheet notes for Magnus Tower's talent access.",
   "asOf": "Oct 2026",
   "conf": "medium",
   "src": "",
   "note": "From the earlier inventory sheet"
  }
 ]
};
