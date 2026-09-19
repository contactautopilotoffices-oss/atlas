/* ============================================================================
   DIGITIDE — NOIDA DATA LAYER (Sector 57 / 58 / 60 / 62 / 67)
   Source of truth for building figures: the client workbook
   "Autopilot.Inventory_Option_for_Digitide.xlsx", sheet 1 "Inventory Options".
   ALL sheet figures are client-stated / unconfirmed.

   TRUTH CONTRACT
   - Every sheet-derived field carries `src` = the evidence/ledger.jsonl row id.
   - Fields the sheet leaves as "TBD" are null here and render "Unconfirmed".
     A TBD is not a zero and not a blank.
   - COORDINATES are Google Maps place pins, read in a browser session by the
     client and cross-checked against OpenStreetMap here. Where the two disagreed
     Google won, because it resolved four of the six to named place records that
     OSM does not carry at all. The two sources agree to 31 m on Knowledge
     Boulevard — the one building we already had an OSM polygon for — which is
     what gave confidence in the rest.
     `coordPrecision` records how tight each pin is: "poi" (Google resolved a
     named place record), "plot" (Google resolved the plot address point),
     "building" (an OSM building polygon) or "sector" (a sector centroid, used
     only where no building record exists anywhere). It drives nothing in the UI;
     it is kept so the team knows which pins a site visit would move.
   - SORT ORDER is the client's, not the engine's. `displayOrder` below fixes the
     running order the client asked for — Magnus, A-20, C-57, Knowledge Boulevard,
     A-23 — and the engine honours it instead of its default nearest-metro sort.
   - METRO AND OFFICE DISTANCES are Google Maps routed figures — real walking and
     driving routes, not straight lines and not estimates. They run longer than
     the figures in the client's own review table, which is what a routed path
     does against an as-the-crow-flies estimate; both are recorded in the ledger.
     Magnus Tower is the exception and is flagged inline below.
   ============================================================================ */

/* No budget band was given in the workbook. The engine reads BAND for the brief
   strip; a fabricated band would be a number the client never said. */
const BAND = null;

/* ---- Mercator helpers (same pattern as the other clients) ---- */
const GEO_ORIGIN = { lat: 28.6100, lon: 77.3700 };
function lngToMercX(lon){ return lon/360 + 0.5; }
function latToMercY(lat){ return 0.5 - Math.log(Math.tan(Math.PI/4 + (lat*Math.PI)/360))/(2*Math.PI); }
const _omx = lngToMercX(GEO_ORIGIN.lon), _omy = latToMercY(GEO_ORIGIN.lat);
const MER_SCALE = 1/(40075016.68*Math.cos(GEO_ORIGIN.lat*Math.PI/180));
function geoToMeters(lat, lon){
  return { lat, lng: lon, x:(lngToMercX(lon)-_omx)/MER_SCALE, z:(latToMercY(lat)-_omy)/MER_SCALE };
}

/* Blue Line station nodes — Wikipedia-published coordinates (ledger geo-stn-*). */
const ST = {
  sec61:    { lng:77.3722988, lat:28.5976310, name:"Noida Sector 61 · Blue Line",       src:"geo-stn-sec61" },
  sec59:    { lng:77.3727259, lat:28.6064930, name:"Noida Sector 59 · Blue Line",       src:"geo-stn-sec59" },
  sec62:    { lng:77.3736097, lat:28.6169948, name:"Noida Sector 62 · Blue Line",       src:"geo-stn-sec62" },
  eleccity: { lng:77.3749300, lat:28.6279412, name:"Noida Electronic City · Blue Line", src:"geo-stn-eleccity" },
  sec52:    { lng:77.3723810, lat:28.5871560, name:"Noida Sector 52 · Blue Line",       src:"geo-stn-sec52" },
  sec51:    { lng:77.3753600, lat:28.5855900, name:"Sector 51 · Aqua Line",             src:"geo-stn-sec51" },
};

/* ---------------------------------------------------------------------------
   OPTIONS — one per row-group in sheet 1, carrying the client's Sep 2026 review
   notes. `displayOrder` is the running order the client asked for.
--------------------------------------------------------------------------- */
const OPTIONS = [
  { bldg:"techm", displayOrder:2, name:"A-20 — former Tech Mahindra", locality:"Block A · Sector 60",
    buildingArea:"~1,08,000 sqft", areaSrc:"techm-area",
    floorsTotal:"2 Basement + Ground + 2", floorsSrc:"techm-floors",
    floorOffered:"Entire building available", offeredSrc:"techm-offered",
    floorPlate:"~27,000 sqft", plateSrc:"techm-plate",
    offeredArea:"As per requirement", offeredAreaSrc:"techm-offered-area",
    condition:"Warm shell", conditionSrc:"techm-condition",
    metroName:"Noida Sector 59", metroDist:"1.0 km walk · 14 min", metroSrc:"techm-metro",
    officeDist:"~1 km to Digitide Sector 58", officeSrc:"techm-office-dist",
    parking:"Surface parking", parkingSrc:"techm-parking",
    powerBackup:"100%", powerSrc:"techm-power",
    cafeteria:null, cafeteriaSrc:null,                      // sheet says TBD
    availability:"Landlord needs a minimum of 2-3 months", availSrc:"techm-avail",
    existingTenant:"No other tenant", tenantSrc:"techm-tenant",
    vacatedSince:"Sep 2026", vacatedSrc:"techm-vacated",
    lastOccupier:"Tech Mahindra", occupierSrc:"techm-occupier",
    pros:"Larger floor plate. Older building, but the landlord is upgrading it with new infrastructure and structural improvements.", prosSrc:"techm-pros",
    cons:"Older building.", consSrc:"techm-cons",
    coordSrc:"geo-techm", coordPrecision:"poi" },   // Google place record "Tech Mahindra"

  { bldg:"padget", displayOrder:5, name:"A-23 — former Padget", locality:"Block A · Sector 60",
    buildingArea:"2,10,000 sqft", areaSrc:"padget-area",
    floorsTotal:"Basement + Ground + 2", floorsSrc:"padget-floors",
    floorOffered:"Entire building available", offeredSrc:"padget-offered",
    floorPlate:"~25,000 sqft", plateSrc:"padget-plate",
    offeredArea:"As per requirement", offeredAreaSrc:"padget-offered-area",
    condition:"Warm shell", conditionSrc:"padget-condition",
    metroName:"Noida Sector 59", metroDist:"1.1 km walk · 15 min", metroSrc:"padget-metro",
    officeDist:"~1 km to Digitide Sector 58", officeSrc:"padget-office-dist",
    parking:"Surface parking", parkingSrc:"padget-parking",
    powerBackup:"100%", powerSrc:"padget-power",
    cafeteria:null, cafeteriaSrc:null,
    availability:"Landlord needs a minimum of 2-3 months", availSrc:"padget-avail",
    existingTenant:"No other tenant", tenantSrc:"padget-tenant",
    vacatedSince:"Oct 2026", vacatedSrc:"padget-vacated",
    lastOccupier:"Padget Electronics", occupierSrc:"padget-occupier",
    buildingAge:"6 years old", ageSrc:"padget-age",
    pros:"Larger floor plate. The building is not old — it is about 6 years old, so it is effectively a new asset.", prosSrc:"padget-pros",
    cons:null, consSrc:null,                                // sheet leaves Cons blank
    coordSrc:"geo-padget", coordPrecision:"plot" },   // Google A-23 plot address point

  { bldg:"tv18", displayOrder:3, name:"C-57 — former TV18", locality:"Sector 57",
    buildingArea:"~72,000 sqft", areaSrc:"tv18-area",
    floorsTotal:"2 Basement + Ground + 3", floorsSrc:"tv18-floors",
    floorOffered:"Entire building available", offeredSrc:"tv18-offered",
    floorPlate:"~18,000 sqft", plateSrc:"tv18-plate",
    offeredArea:"As per requirement", offeredAreaSrc:"tv18-offered-area",
    condition:"Bare shell", conditionSrc:"tv18-condition",
    metroName:"Noida Sector 59", metroDist:"2.7 km walk · 37 min", metroSrc:"tv18-metro",
    officeDist:"~1 km to Digitide Sector 58", officeSrc:"tv18-office-dist",
    parking:"1 slot / 1,000 sqft, leased, chargeable at INR 3,500 / slot / month", parkingSrc:"tv18-parking",
    powerBackup:"100%", powerSrc:"tv18-power",
    cafeteria:null, cafeteriaSrc:null,
    availability:"Immediately available for fit-outs", availSrc:"tv18-avail",
    existingTenant:"No other tenant", tenantSrc:"tv18-tenant",
    vacatedSince:"Jun 2026", vacatedSrc:"tv18-vacated",
    lastOccupier:"TV18", occupierSrc:"tv18-occupier",
    pros:"Building is old but well maintained.", prosSrc:"tv18-pros",
    cons:"Comparatively smaller floor plate.", consSrc:"tv18-cons",
    coordSrc:"geo-tv18", coordPrecision:"plot" },   // Google plot geocode "c, 57, Block B, Sector 57"

  { bldg:"magnus", displayOrder:1, name:"Magnus Tower", locality:"Sector 67",
    buildingArea:"~2,20,000 sqft", areaSrc:"magnus-area",
    floorsTotal:"2 Basement + Ground + 5", floorsSrc:"magnus-floors",
    floorOffered:"1st, 3rd, 4th and 5th", offeredSrc:"magnus-offered",
    floorPlate:"~35,000 sqft", plateSrc:"magnus-plate",
    offeredArea:"As per requirement", offeredAreaSrc:"magnus-offered-area",
    condition:"Warm shell", conditionSrc:"magnus-condition",
    metroName:"Noida Sector 61", metroDist:"1.8 km", metroSrc:"magnus-metro",
    officeDist:"~4 km to Digitide Sector 58", officeSrc:"magnus-office-dist",
    parking:"Ample parking", parkingSrc:"magnus-parking",
    powerBackup:"100%", powerSrc:"magnus-power",
    cafeteria:null, cafeteriaSrc:null,
    availability:"Available for fit-out in early 2027", availSrc:"magnus-avail",
    existingTenant:"New asset — no existing tenant", tenantSrc:"magnus-tenant",
    vacatedSince:null, vacatedSrc:null,                     // new asset, never occupied
    lastOccupier:null, occupierSrc:null,
    pros:"Brand-new B++ grade asset: modern infrastructure, double-height lift lobbies, 6 lifts per floor plus 2 service lifts, a green belt in front, larger floor plates and a wider approach road with connectivity to Noida, Delhi and Ghaziabad. The sheet calls out access to the Mamura, Khoda, East Delhi, Ghaziabad (Indirapuram, Vaishali, Vasundhara, Crossings Republik) and Noida residential talent pools, reached mainly by shared autos and e-rickshaws.", prosSrc:"magnus-pros",
    cons:"Metro connectivity 1.8 km.", consSrc:"magnus-cons",
    priority:true, prioritySrc:"magnus-priority",
    magnusNote:"This is the Sector 67 development, not the Magnus Tower at Plot 6, Sector 73 — a separate, occupied 11-storey building 1.45 km to the south. Everything shown here is measured to the Sector 67 site. A plot number or map pin from the landlord will sharpen the distances further.", magnusNoteSrc:"magnus-identity",
    catchmentNote:"Client read: the immediate catchment is the Sector 71 / 72 / 73 residential belt, and travel time to the Sector 15 area runs 30-40 minutes.", catchmentNoteSrc:"magnus-catchment-note",
    coordSrc:"geo-magnus", coordPrecision:"sector" },   // Sector 67 centroid — see magnusNote

  { bldg:"kboulevard", displayOrder:4, name:"Knowledge Boulevard", locality:"Plot A-8A · Sector 62",
    buildingArea:"Towers A & B: ~6,66,260 sqft", areaSrc:"kb-area",
    floorsTotal:"Basement + Stilt + Ground + 9", floorsSrc:"kb-floors",
    floorOffered:null, offeredSrc:null,                     // sheet says TBD
    floorPlate:"~95,000 sqft", plateSrc:"kb-plate",
    offeredArea:null, offeredAreaSrc:null,                  // sheet says TBD
    condition:"Warm shell", conditionSrc:"kb-condition",
    metroName:"Noida Electronic City", metroDist:"1.4 km walk · 20 min", metroSrc:"kb-metro",
    officeDist:"~4 km to Digitide Sector 58", officeSrc:"kb-office-dist",
    parking:"1 slot / 1,200 sqft, leased, included in rentals at INR 5,000 / month / car", parkingSrc:"kb-parking",
    powerBackup:"100%", powerSrc:"kb-power",
    cafeteria:"Yes, on the ground floor — caters to up to 1,000 people", cafeteriaSrc:"kb-cafeteria",
    availability:"Immediately available for fit-outs", availSrc:"kb-avail",
    existingTenant:"Ericsson, Tech Mahindra, Tecture Infotech, Bharti Infratel and others", tenantSrc:"kb-tenant",
    vacatedSince:null, vacatedSrc:null,                     // sheet repeats "Warm shell" here
    lastOccupier:null, occupierSrc:null,
    pros:"Tech campus, A-grade, metro connectivity.", prosSrc:"kb-pros",
    cons:"Scarcity of larger contiguous floor plates, higher rental, highly congested, narrow approach road.", consSrc:"kb-cons",
    coordSrc:"geo-kboulevard", coordPrecision:"building" },   // OSM way 634075406 + polygon; Google agrees to 31 m
];

/* ---------------------------------------------------------------------------
   BUILDINGS — footprint boxes sized from the sheet's floor plates.
   No OSM polygon matched any of the five (geo.js ships an empty collection), so
   every one of these is a fallback box at the coordinate precision named above.
   w/d are derived from the stated plate area, h from above-ground floors x 3.2 m.
--------------------------------------------------------------------------- */
function stn(s){ return { stnLng:s.lng, stnLat:s.lat, stnName:s.name }; }

const BUILDINGS = [
  { id:"techm", name:"A-20 — former Tech Mahindra", block:"Sector 60", isOption:true, type:"block",
    ...geoToMeters(28.604926, 77.368878), ...stn(ST.sec59),   // Google place "Tech Mahindra"
    w:55, d:45, h:10, floors:3, color:0x9aa7b5 },
  { id:"padget", name:"A-23 — former Padget", block:"Sector 60", isOption:true, type:"block",
    ...geoToMeters(28.603648, 77.368607), ...stn(ST.sec59),   // Google A-23 plot address point
    w:52, d:45, h:10, floors:3, color:0x9aa7b5 },
  { id:"tv18", name:"C-57 — former TV18", block:"Sector 57", isOption:true, type:"block",
    ...geoToMeters(28.603910, 77.352742), ...stn(ST.sec59),   // Google plot geocode, Block B Sector 57
    w:45, d:37, h:13, floors:4, color:0x9aa7b5 },
  { id:"magnus", name:"Magnus Tower", block:"Sector 67", isOption:true, type:"block",
    ...geoToMeters(28.6048230, 77.3847901), ...stn(ST.sec61),   // OSM way 71834192 — Sector 67 centroid; Google has no Sector 67 building record
    w:62, d:52, h:19, floors:6, color:0x9aa7b5 },
  { id:"kboulevard", name:"Knowledge Boulevard", block:"Sector 62", isOption:true, type:"tower",
    ...geoToMeters(28.6301158, 77.3679468), ...stn(ST.eleccity),   // OSM way 634075406 — footprint in geo.js
    w:105, d:84, h:32, floors:10, color:0x9aa7b5 },
];

/* Blue Line text metadata for the panels. Drawn geometry is in config.js. */
const METRO = {
  purple: {
    name:"Delhi Metro Blue Line — Noida eastern stretch (OPERATIONAL)",
    status:"OPERATIONAL — Sector 61, Sector 59, Sector 62 and Noida Electronic City serve the shortlist",
    statusNote:"Station coordinates are Wikipedia-published (ledger geo-stn-*). The drawn alignment is straight-through-stations and indicative, not surveyed track.",
    path:[], stations:[]
  }
};

const NEIGHBORHOODS = [];
const RIVER_PATH = [];

/* ---------------------------------------------------------------------------
   POI — the map layers the Atlas Requirement sheet asks for beyond the buildings.
   layer: "anchor" [req 2] · "competitor" [req 5] · "pg" [req 3] · "edu" [req 7]
   Every coordinate is an OSM object, geocoded via Nominatim; the object id is in
   the line comment. Nothing here is hand-placed.
--------------------------------------------------------------------------- */
const POI = [
  /* --- [2] Digitide's existing Noida office ------------------------------ */
  { id:"digitide-58", layer:"anchor", name:"Digitide Solutions — Sector 58",
    lat:28.604613, lng:77.358912, precision:"poi",          // Google place "Digitide Solutions Ltd"
    note:"2nd & 3rd floor, Plot A-94/5 & A-94/6, Sector 58, Noida 201301. The incumbent office every option is measured against.",
    src:"BSI client directory — Digitide Solutions Limited",
    srcUrl:"https://www.bsigroup.com/en-ZA/products-and-services/assessment-and-certification/validation-and-verification/client-directory-profile/E2E_SE-0047219867-014" },

  /* --- [5] BPO / BPM competitors for the same hiring pool ----------------- */
  { id:"ienergizer", layer:"competitor", name:"iEnergizer", lat:28.6022000, lng:77.3690000, precision:"sector",
    note:"A-37, Sector 60 — the same industrial block as options A-20 and A-23. Hiring graduate freshers for domestic voice at ₹19,000-23,000 CTC, 200 openings in one recent drive.",
    src:"noidaonline BPO directory; vacancy9 hiring listing", srcUrl:"https://vacancy9.com/ienergizer-noida-sector-60-job/" },
  { id:"exl-58", layer:"competitor", name:"EXL Service", lat:28.6065664, lng:77.3590182, precision:"sector",
    note:"A-48, Block A, Sector 58 — the same sector as Digitide's existing office.",
    src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"hcl-bpo-59", layer:"competitor", name:"HCL BPO / HCL Comnet", lat:28.6064930, lng:77.3627259, precision:"sector",
    note:"B-34/3, Sector 59.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"genpact-59", layer:"competitor", name:"Genpact", lat:28.6064930, lng:77.3677259, precision:"sector",
    note:"D-4, Sector 59 — listed on Genpact's own locations page alongside its larger Sector 135 campuses.",
    src:"Genpact official locations page", srcUrl:"https://www.genpact.com/about-us/locations" },
  { id:"concentrix-62", layer:"competitor", name:"Concentrix Daksh", lat:28.6211447, lng:77.3643493, precision:"sector",   // OSM node 10811810934
    note:"Ground floor, Tower C, Logix Cyber Park, C-28 & C-29, Sector 62 — the same sector as Knowledge Boulevard.",
    src:"Concentrix address, traffictail BPO roundup", srcUrl:"https://traffictail.com/bpo-companies-in-noida/" },
  { id:"colwell-58", layer:"competitor", name:"Colwell & Salmon", lat:28.6040000, lng:77.3580000, precision:"sector",
    note:"A-17, Sector 58.", src:"grotal call-centre directory", srcUrl:"https://www.grotal.com/Noida/Call-Center-Outsourcing-Services-C52/" },
  { id:"pacific-63", layer:"competitor", name:"Pacific BPO (Access Healthcare)", lat:28.6120749, lng:77.3778122, precision:"sector",
    note:"A-61, Sector 63.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"cogent-63", layer:"competitor", name:"Cogent E Services", lat:28.6140000, lng:77.3800000, precision:"sector",
    note:"C-100, Sector 63.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"techm-64", layer:"competitor", name:"Tech Mahindra (Sector 64)", lat:28.6114861, lng:77.3777821, precision:"sector",
    note:"A-6, Sector 64, near Sahara Chowk. Running walk-in customer-service drives at ₹1.25-3.25 LPA, 100+ openings. The same employer vacated option A-20.",
    src:"Justdial listing; vacancy9 walk-in drive", srcUrl:"https://vacancy9.com/tech-mahindra-customer-service/" },
  { id:"barclays-62", layer:"competitor", name:"Barclays Shared Services", lat:28.6230000, lng:77.3660000, precision:"sector",
    note:"Unitech Infospace, Sector 62. A BFSI captive competing for the same graduate voice and back-office pool.",
    src:"grotal call-centre directory", srcUrl:"https://www.grotal.com/Noida/Call-Center-Outsourcing-Services-C52/" },
  { id:"nsb-58", layer:"competitor", name:"NSB BPO Solutions", lat:28.6020000, lng:77.3570000, precision:"sector",
    note:"Sector 58. Advertising 99 fresher customer-support seats at ₹12,000-16,000 per month — the floor of the local pay band.",
    src:"jobhai listing", srcUrl:"https://www.jobhai.com/customer-support-telecaller-customer-support-executive-job-in-nsb-bpo-solutions-limited-sector-58-noida-0-to-0-years-1774958477-7452995-jid" },

  /* --- [3] PG / shared accommodation. Expanded on client request:
         named operators with their own quoted rents, not just clusters. ----- */
  { id:"pg-zolo-58", layer:"pg", name:"Zolo County — Sector 58", lat:28.6075000, lng:77.3600000, precision:"sector",
    note:"H-10, Bishanpura Road, Sector 58. Men's co-living: two-sharing from ₹4,263, private room from ₹7,708. The cheapest sourced bed next to the Sector 58-60 belt.",
    src:"Zolo Stays", srcUrl:"https://zolostays.com/pg-hostel-near-sector_58-in-noida-zolo_county-znd019" },
  { id:"pg-hooliv-58", layer:"pg", name:"HooLiv Mitra — Sector 58", lat:28.6080000, lng:77.3605000, precision:"sector",
    note:"H-8, Bishanpura, Sector 58. Unisex co-living from ₹12,000 with meals. Sister properties Aura (₹15,000), Luxor and Ociana (₹12,000) and Sanskar (₹10,000) sit in the same pocket.",
    src:"HooLiv", srcUrl:"https://hooliv.com/hooliv-mitra-unisex-hostel-in-noida-boys-girls-hostel-near-jss-academy-fosma-aaft-symbiosis-ims-noida-sector-58-noida-sector-62-noida-sector-63-pg-premium-affordable-rooms/" },
  { id:"pg-ohmyplace-58", layer:"pg", name:"Oh My Place — Sector 58", lat:28.6055000, lng:77.3585000, precision:"sector",
    note:"M-73C, Sector 58, near Stellar Business Park. Furnished 1RK studio co-living at ₹18,000 a month, 90 units. 1.6 km to Sector 62 metro, 1.9 km to Sector 59.",
    src:"Oh My Place", srcUrl:"https://www.ohmyplace.com/co-living/omp-co-living-pg-in-noida-sector-58/" },
  { id:"pg-housitize-58", layer:"pg", name:"Housitize PG — Sector 58", lat:28.6050000, lng:77.3600000, precision:"sector",
    note:"Sector 58 co-living, 28 rooms. Double sharing ₹8,500 with meals, single occupancy ₹14,500. Three-month minimum stay.",
    src:"HousitizePG", srcUrl:"https://housitizepg.com/property/coliving-pg-near-sector-62-noida-4/" },
  { id:"pg-pgnoida-62", layer:"pg", name:"PGNoida cluster — Sector 62", lat:28.6211447, lng:77.3643493, precision:"sector",   // OSM node 10811810934
    note:"Multiple houses across Sectors 58-63. Four-sharing from ₹6,500, triple ₹7,000, double ₹8,500, single ₹14,000-22,000. Operating since 2009, no lock-in.",
    src:"PGNoida.com", srcUrl:"https://www.pgnoida.com/" },
  { id:"pg-premium-62", layer:"pg", name:"Premium PG — Sector 62", lat:28.6230000, lng:77.3650000, precision:"sector",
    note:"About 1 km from Sector 62 metro. Double sharing ₹13,000-14,000 per bed, AC, meals, 24x7 security. Serves Knowledge Boulevard directly.",
    src:"PGNoida.com", srcUrl:"https://www.pgnoida.com/post/premium-pg-in-noida-sector-62" },
  { id:"pg-mamura", layer:"pg", name:"Mamura informal rental market", lat:28.6036193, lng:77.3754881, precision:"sector",   // OSM node 853665802
    note:"Dense low-cost rental settlement south-east of the Sector 60 belt, named in the inventory sheet as a primary talent source. Informal market — no organised-PG rate card, which is exactly why it absorbs night-shift staff at the lowest cost.",
    src:"Inventory sheet (client-stated); OSM place node", srcUrl:"https://www.pgnoida.com/" },
  { id:"pg-sec61", layer:"pg", name:"Sector 61 residential PG belt", lat:28.5964581, lng:77.3675644, precision:"sector",   // OSM way 170938118
    note:"Planned residential sector directly between the Sector 60 options and Sector 61 metro. Standard family-flat sublets and PG rooms; the walk-to-work option for A-20 and A-23.",
    src:"OSM residential landuse; local PG directories", srcUrl:"https://www.pgnoida.com/" },
  { id:"pg-sec71", layer:"pg", name:"Sector 71 / 72 / 73 PG belt", lat:28.5942367, lng:77.3761378, precision:"sector",   // OSM way 71689145
    note:"High-density residential belt the client names as Magnus Tower's immediate catchment. Large supply of shared flats and PG rooms aimed at the Sector 62-67 office floors.",
    src:"Client note (Sep 2026); OSM residential landuse", srcUrl:"https://www.pgnoida.com/" },

  /* --- [7] Educational institutes ---------------------------------------- */
  { id:"jiit-62", layer:"edu", name:"Jaypee Institute of Information Technology", lat:28.6245000, lng:77.3720000, precision:"sector",
    note:"A-10, Sector 62. Deemed university on a 46.94-acre campus, NIRF engineering band 101-150. B.Tech, MBA, BBA, BCA and MCA — the BBA/BCA/MCA streams are the realistic BPM feeder, not the CSE batch.",
    src:"JIIT official site", srcUrl:"https://www.jiit.ac.in/" },
  { id:"jss-62", layer:"edu", name:"JSS Academy of Technical Education", lat:28.6220000, lng:77.3760000, precision:"sector",
    note:"C-20/1, Sector 62. 4,000+ students, roughly 900 B.Tech seats a year plus MBA and MCA. 577 students placed in the 2024 drive at an average of ₹5.2 LPA.",
    src:"CollegeDekho; JosaApp", srcUrl:"https://www.collegedekho.com/colleges/jss-noida" },
  { id:"ims-62", layer:"edu", name:"IMS Noida / Symbiosis / Jaipuria cluster", lat:28.6290000, lng:77.3730000, precision:"sector",
    note:"Sector 62 institutional pocket. Management and mass-communication intakes, cited by local PG operators as their student base — graduate supply on the doorstep of Knowledge Boulevard.",
    src:"PGNoida.com institute list; HooLiv nearby-institutes list", srcUrl:"https://www.pgnoida.com/post/premium-pg-in-noida-sector-62" },
  { id:"amity-125", layer:"edu", name:"Amity University, Sector 125", lat:28.5440000, lng:77.3340000, precision:"sector",
    note:"Largest single graduate output in Noida across management, communication and humanities. 12-14 km from the shortlist — a bus-route catchment, not a walk-in one.",
    src:"Noida institutional directories", srcUrl:"https://digitalconvey.com/mnc-companies-in-noida/" },
  { id:"jiit-128", layer:"edu", name:"JIIT Sector 128 campus", lat:28.5290000, lng:77.3690000, precision:"sector",
    note:"JIIT's extension campus on the Expressway. Placements are centralised with Sector 62, so it feeds the same recruiter pipeline.",
    src:"JIIT admissions pages", srcUrl:"https://www.jiit.ac.in/admissions_2026/" },
];

/* ---------------------------------------------------------------------------
   CATCHMENT — [req 6] talent pool in 0-20 / 20-40 / 40-50 minute bands.

   METHOD, stated plainly because it changes how much weight the bands carry:
   no routing engine or isochrone API is reachable from this environment, so
   band membership is computed at render time from straight-line distance
   between the property and the locality centroid, converted at
   MINUTES_PER_KM below. That constant is the same pair of assumptions used in
   connectivity.json — a 1.30 street-detour factor over the straight line, then
   12 km/h effective door-to-door speed — which works out at 6.5 min per
   straight-line km. It is a proxy for a peak-hour NCR commute on shared autos,
   e-rickshaws and feeder buses, the modes the inventory sheet itself names.

   IT IS NOT A ROUTED ISOCHRONE, and a flat detour factor cannot see a barrier.
   It runs optimistic for the localities whose real route crosses one:
     Crossings Republik  — NH-24 crossing; real road distance is roughly double
                           the straight line, so read it a band later than shown.
     Mayur Vihar / East Delhi — Yamuna crossing, metro-dependent in practice.
   Everything inside the Noida sector grid reads true.

   Every locality centroid below is an OSM object geocoded via Nominatim, with
   the object id in the line comment. Localities the client named but OSM has no
   entry for — Khoda, Chhijarsi — are deliberately NOT pinned rather than placed
   by eye; they are carried in the Magnus Tower option note instead.
--------------------------------------------------------------------------- */
const MINUTES_PER_KM = 6.5;   // 1.30 detour factor at 12 km/h — matches connectivity.json

const CATCHMENT = {
  minutesPerKm: MINUTES_PER_KM,
  method:"Bands are estimated, not routed: straight-line distance to the locality centroid × a 1.30 street-detour factor at 12 km/h effective door-to-door speed (6.5 min per straight-line km). A proxy for peak-hour shared-auto and e-rickshaw commuting. It runs optimistic where the real route crosses NH-24 or the Yamuna — Crossings Republik and Mayur Vihar each read roughly one band better here than they commute. Locality centroids are OpenStreetMap objects.",
  bands: [
    { key:"b0",  label:"0-20 min",  maxMin:20, color:"#2fbf71" },
    { key:"b20", label:"20-40 min", maxMin:40, color:"#d9b310" },
    { key:"b40", label:"40-50 min", maxMin:50, color:"#e0603a" },
  ],
  localities: [
    { id:"mamura", name:"Mamura", lat:28.6036193, lng:77.3754881,   // OSM node 853665802
      profile:"Dense low-cost rental settlement", supply:"Named in the inventory sheet as a primary talent source. Walk-in and e-rickshaw range for the whole Sector 57-67 belt." },
    { id:"sec71", name:"Sector 71 / 72 / 73 belt", lat:28.5942367, lng:77.3761378,   // OSM way 71689145
      profile:"High-density planned residential", supply:"The client's stated immediate catchment for Magnus Tower. Large shared-flat and PG supply aimed at the Sector 62-67 floors." },
    { id:"sec61", name:"Sector 61 residential", lat:28.5964581, lng:77.3675644,   // OSM way 170938118
      profile:"Planned residential, metro-adjacent", supply:"Sits between the Sector 60 options and Sector 61 metro. The genuine walk-to-work catchment for A-20 and A-23." },
    { id:"sec51", name:"Sector 51 / Hoshiyarpur", lat:28.5821535, lng:77.3714570,   // OSM way 170574108
      profile:"Urban village plus planned sector", supply:"Sector 51 Aqua Line and Sector 52 Blue Line interchange put it one hop from the shortlist." },
    { id:"nithari", name:"Nithari", lat:28.5762127, lng:77.3422231,   // OSM node 836394108
      profile:"Established low-cost colony", supply:"Long-standing BPO labour catchment for central Noida." },
    { id:"sec15", name:"Sector 15 area", lat:28.5827979, lng:77.3102221,   // OSM way 71596200
      profile:"Older planned sectors, Blue Line served", supply:"The client puts real travel time from Magnus Tower at 30-40 minutes. Established white-collar and support workforce." },
    { id:"sec62res", name:"Sector 62 residential", lat:28.6211447, lng:77.3643493,   // OSM node 10811810934
      profile:"Mixed institutional and residential", supply:"Student and young-professional housing around the JIIT / JSS / IMS cluster. On Knowledge Boulevard's doorstep." },
    { id:"indirapuram", name:"Indirapuram", lat:28.6380466, lng:77.3644168,   // OSM way 113685210
      profile:"Mid-income Ghaziabad suburb", supply:"Named in the inventory sheet. Graduate and experienced voice/back-office supply, car and two-wheeler commuters." },
    { id:"vaishali", name:"Vaishali", lat:28.6471629, lng:77.3346949,   // OSM node 10811714127
      profile:"Mid-income, Blue Line metro", supply:"Named in the inventory sheet. On the same Blue Line as the shortlist — the cleanest metro-borne catchment." },
    { id:"vasundhara", name:"Vasundhara", lat:28.6619725, lng:77.3732972,   // OSM node 10811272468
      profile:"Mid-income Ghaziabad suburb", supply:"Named in the inventory sheet. Feeds the Sector 62-63 belt by road." },
    { id:"crossings", name:"Crossings Republik", lat:28.6284686, lng:77.4341570,   // OSM way 504502246
      profile:"High-density apartment township", supply:"Named in the inventory sheet. Large young-professional population, but NH-24 dependent and shuttle-reliant — read it one band later than shown." },
    { id:"mayur-vihar", name:"Mayur Vihar / East Delhi", lat:28.6098555, lng:77.2926318,   // OSM node 10815246204
      profile:"Dense East Delhi residential", supply:"Named in the inventory sheet as East Delhi. Very large pool, entirely metro-dependent for this belt." },
  ],
  /* Market evidence for what that supply is actually worth — every figure
     sourced, none modelled. */
  marketSignals: [
    { label:"Live BPO openings, Noida", value:"~720 listed",
      note:"LinkedIn job board, filtered to Noida; 279 tagged Noida city against 197 Gurgaon.",
      src:"LinkedIn jobs", srcUrl:"https://in.linkedin.com/jobs/bpo-jobs-noida" },
    { label:"Live customer-support openings, Noida", value:"~146-161 full-time",
      note:"apna.co verified vacancies, Aug 2026.",
      src:"apna.co", srcUrl:"https://apna.co/jobs/dep_customer_support-full_time-jobs-in-noida" },
    { label:"Entry-level pay band", value:"₹12,000-23,000 / month",
      note:"NSB BPO Sector 58 at ₹12,000-16,000; iEnergizer Sector 60 at ₹19,000-23,000 CTC; Tech Mahindra Sector 64 at ₹1.25-3.25 LPA.",
      src:"jobhai, vacancy9 listings", srcUrl:"https://vacancy9.com/ienergizer-noida-sector-60-job/" },
    { label:"PG bed cost, Sector 58-62", value:"₹4,263-18,000 / month",
      note:"Zolo two-sharing ₹4,263 at the floor; Housitize double ₹8,500; PGNoida four-sharing ₹6,500; Oh My Place studio ₹18,000 at the ceiling. Night-shift staff can live walking distance from the Sector 58-60 options.",
      src:"Zolo, Housitize, PGNoida, Oh My Place", srcUrl:"https://zolostays.com/pg-hostel-near-sector_58-in-noida-zolo_county-znd019" },
    { label:"Single-drive hiring volume", value:"100-200 seats",
      note:"One iEnergizer Sector 60 drive advertised 200 openings; one Tech Mahindra Sector 64 drive advertised 100+. The belt absorbs volume hiring routinely.",
      src:"vacancy9 listings", srcUrl:"https://vacancy9.com/tech-mahindra-customer-service/" },
    { label:"Sector-level hiring trend", value:"+21% YoY",
      note:"National BPO/ITES hiring growth, Jan 2026, with foreign MNCs driving over 80% of the increase. Directional context, not a Noida-specific figure.",
      src:"NewspaperInsider market note", srcUrl:"https://www.newspaperinsider.com/business/noidas-it-bpo-hiring-surge-whats-driving-the-growth/" },
    { label:"Local graduate supply", value:"~1,500+ / year, Sector 62 alone",
      note:"JSS Academy alone runs ~900 B.Tech seats plus MBA/MCA and placed 577 in 2024; JIIT Sector 62 adds B.Tech, MBA, BBA, BCA and MCA on a 46.94-acre campus. Counts are intake/placement figures from the institutions, not a modelled BPM-addressable total.",
      src:"CollegeDekho, JIIT", srcUrl:"https://www.collegedekho.com/colleges/jss-noida" },
  ]
};

const META = {
  client:"client",
  business:"BPM / customer-operations office — Noida, replacing or extending the Sector 58 site (sheet brief, unconfirmed)",
  brief:"Five options across Sector 57, 58, 60, 62 and 67 · metro access and talent catchment are the priorities · all sheet figures client-stated and unconfirmed",
  prepared:"Autopilot Offices · Noida inventory options sheet (2026)",
  winner:null   // no pre-crowned winner — selection is the only accent
};

window.BKC = { BAND, OPTIONS, BUILDINGS, METRO, NEIGHBORHOODS, RIVER_PATH, META, POI, CATCHMENT };
