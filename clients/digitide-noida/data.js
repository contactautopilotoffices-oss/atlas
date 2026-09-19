/* ============================================================================
   DIGITIDE — NOIDA DATA LAYER (Sector 57 / 58 / 60 / 62 / 67)
   Source of truth for building figures: the client workbook
   "Autopilot.Inventory_Option_for_Digitide.xlsx", sheet 1 "Inventory Options".
   ALL sheet figures are client-stated / unconfirmed.

   TRUTH CONTRACT
   - Every sheet-derived field carries `src` = the evidence/ledger.jsonl row id.
   - Fields the sheet leaves as "TBD" are null here and render "Unconfirmed".
     A TBD is not a zero and not a blank.
   - COORDINATES. Overpass, Nominatim and the Mapbox geocoder are all blocked by
     this environment's egress policy, so no coordinate in this file was machine
     geocoded. Each one states its own precision:
       "confirmed"   two independent published sources agree on a lat/long.
       "plot-approx" the plot address is confirmed in a published record, but the
                     lat/long is placed from the sector layout. Good to roughly
                     150 m, not better.
       "sector"      only the sector is known. The pin is a sector centroid.
     Nothing here is presented as a surveyed building footprint, and geo.js ships
     no polygons, so every building renders as an explicit fallback box.
   - SORT ORDER is the engine's: routed walk to the nearest station, from
     connectivity.json. The sheet's own metro distances are carried as
     `metroDist` for comparison and are flagged where they disagree.
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
};

/* ---------------------------------------------------------------------------
   OPTIONS — one per row-group in sheet 1, in sheet order.
   `metroDist` / `metroName` are the SHEET's claims. `metroFlag` is set where the
   sheet's claim does not survive a check against the published station
   coordinates — the discrepancy is shown to the client rather than silently
   corrected, because the resolution needs the landlord, not us.
--------------------------------------------------------------------------- */
const OPTIONS = [
  { bldg:"techm", name:"A-20 — former Tech Mahindra", locality:"Block A · Sector 60",
    buildingArea:"~1,08,000 sqft", areaSrc:"techm-area",
    floorsTotal:"2 Basement + Ground + 2", floorsSrc:"techm-floors",
    floorOffered:"Entire building available", offeredSrc:"techm-offered",
    floorPlate:"~27,000 sqft", plateSrc:"techm-plate",
    offeredArea:"As per requirement", offeredAreaSrc:"techm-offered-area",
    condition:"Warm shell", conditionSrc:"techm-condition",
    metroName:"Noida Sector 62", metroDist:"0.7 km (sheet)", metroSrc:"techm-metro",
    metroFlag:"Sheet names Sector 62 at 0.7 km. From the published Sector 62 and Sector 59 station coordinates, a Block A / Sector 60 address sits ~1.8 km from Sector 62 and ~0.8 km from Sector 59. Sector 59 is the likely intended station — confirm with the landlord.",
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
    coordSrc:"geo-techm", coordConfirmed:false, coordPrecision:"plot-approx" },

  { bldg:"padget", name:"A-23 — former Padget", locality:"Block A · Sector 60",
    buildingArea:"2,10,000 sqft", areaSrc:"padget-area",
    floorsTotal:"Basement + Ground + 2", floorsSrc:"padget-floors",
    floorOffered:"Entire building available", offeredSrc:"padget-offered",
    floorPlate:"~25,000 sqft", plateSrc:"padget-plate",
    offeredArea:"As per requirement", offeredAreaSrc:"padget-offered-area",
    condition:"Warm shell", conditionSrc:"padget-condition",
    metroName:"Noida Sector 59", metroDist:"0.8 km (sheet)", metroSrc:"padget-metro",
    officeDist:"~1 km to Digitide Sector 58", officeSrc:"padget-office-dist",
    parking:"Surface parking", parkingSrc:"padget-parking",
    powerBackup:"100%", powerSrc:"padget-power",
    cafeteria:null, cafeteriaSrc:null,
    availability:"Landlord needs a minimum of 2-3 months", availSrc:"padget-avail",
    existingTenant:"No other tenant", tenantSrc:"padget-tenant",
    vacatedSince:"Oct 2026", vacatedSrc:"padget-vacated",
    lastOccupier:"Padget Electronics", occupierSrc:"padget-occupier",
    pros:"Larger floor plate. Older building, but the landlord is upgrading it with new infrastructure and structural improvements.", prosSrc:"padget-pros",
    cons:null, consSrc:null,                                // sheet leaves Cons blank
    coordSrc:"geo-padget", coordConfirmed:false, coordPrecision:"plot-approx" },

  { bldg:"tv18", name:"C-57 — former TV18", locality:"Sector 57",
    buildingArea:"~72,000 sqft", areaSrc:"tv18-area",
    floorsTotal:"2 Basement + Ground + 3", floorsSrc:"tv18-floors",
    floorOffered:"Entire building available", offeredSrc:"tv18-offered",
    floorPlate:"~18,000 sqft", plateSrc:"tv18-plate",
    offeredArea:"As per requirement", offeredAreaSrc:"tv18-offered-area",
    condition:"Bare shell", conditionSrc:"tv18-condition",
    metroName:"Noida Sector 59", metroDist:"2.5 km (sheet)", metroSrc:"tv18-metro",
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
    coordSrc:"geo-tv18", coordConfirmed:false, coordPrecision:"sector" },

  { bldg:"magnus", name:"Magnus Tower", locality:"Sector 67",
    buildingArea:"~2,20,000 sqft", areaSrc:"magnus-area",
    floorsTotal:"2 Basement + Ground + 5", floorsSrc:"magnus-floors",
    floorOffered:"1st, 3rd, 4th and 5th", offeredSrc:"magnus-offered",
    floorPlate:"~35,000 sqft", plateSrc:"magnus-plate",
    offeredArea:"As per requirement", offeredAreaSrc:"magnus-offered-area",
    condition:"Warm shell", conditionSrc:"magnus-condition",
    metroName:"Noida Sector 61", metroDist:"~1.8 km (sheet)", metroSrc:"magnus-metro",
    officeDist:"~4 km to Digitide Sector 58", officeSrc:"magnus-office-dist",
    parking:"Ample parking", parkingSrc:"magnus-parking",
    powerBackup:"100%", powerSrc:"magnus-power",
    cafeteria:null, cafeteriaSrc:null,
    availability:"Available for fit-out in early 2027", availSrc:"magnus-avail",
    existingTenant:"New asset — no existing tenant", tenantSrc:"magnus-tenant",
    vacatedSince:null, vacatedSrc:null,                     // new asset, never occupied
    lastOccupier:null, occupierSrc:null,
    pros:"Brand-new B++ grade asset: modern infrastructure, double-height lift lobbies, 6 lifts per floor plus 2 service lifts, a green belt in front, larger floor plates and a wider approach road with connectivity to Noida, Delhi and Ghaziabad. The sheet calls out access to the Mamura, Khoda, East Delhi, Ghaziabad (Indirapuram, Vaishali, Vasundhara, Crossings Republik) and Noida residential talent pools, reached mainly by shared autos and e-rickshaws.", prosSrc:"magnus-pros",
    cons:"Metro connectivity ~1.8 km.", consSrc:"magnus-cons",
    coordSrc:"geo-magnus", coordConfirmed:false, coordPrecision:"sector",
    coordNote:"IDENTITY UNRESOLVED. The sheet places Magnus Tower in Sector 67 as a brand-new 2B+G+5 asset. The only Magnus Tower found in published records is Plot 6, Sector 73 — an occupied B+Stilt+11 building, which is a different structure. Either the sheet's sector is loose or this is a second, newer development not yet in any public record. The pin is a Sector 67 centroid and the nearest-station claim is the sheet's, unverified. Ask the landlord for the plot number before this option is shortlisted." },

  { bldg:"kboulevard", name:"Knowledge Boulevard", locality:"Plot A-8A · Sector 62",
    buildingArea:"Towers A & B: ~6,66,260 sqft", areaSrc:"kb-area",
    floorsTotal:"Basement + Stilt + Ground + 9", floorsSrc:"kb-floors",
    floorOffered:null, offeredSrc:null,                     // sheet says TBD
    floorPlate:"~95,000 sqft", plateSrc:"kb-plate",
    offeredArea:null, offeredAreaSrc:null,                  // sheet says TBD
    condition:"Warm shell", conditionSrc:"kb-condition",
    metroName:"Noida Electronic City", metroDist:"~1 km (sheet)", metroSrc:"kb-metro",
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
    coordSrc:"geo-kboulevard", coordConfirmed:true, coordPrecision:"confirmed" },
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
    ...geoToMeters(28.60300, 77.36600), ...stn(ST.sec59),
    w:55, d:45, h:10, floors:3, color:0x9aa7b5 },
  { id:"padget", name:"A-23 — former Padget", block:"Sector 60", isOption:true, type:"block",
    ...geoToMeters(28.60450, 77.36800), ...stn(ST.sec59),
    w:52, d:45, h:10, floors:3, color:0x9aa7b5 },
  { id:"tv18", name:"C-57 — former TV18", block:"Sector 57", isOption:true, type:"block",
    ...geoToMeters(28.59850, 77.36250), ...stn(ST.sec59),
    w:45, d:37, h:13, floors:4, color:0x9aa7b5 },
  { id:"magnus", name:"Magnus Tower", block:"Sector 67", isOption:true, type:"block",
    ...geoToMeters(28.61150, 77.39050), ...stn(ST.sec62),
    w:62, d:52, h:19, floors:6, color:0x9aa7b5 },
  { id:"kboulevard", name:"Knowledge Boulevard", block:"Sector 62", isOption:true, type:"tower",
    ...geoToMeters(28.63060, 77.36800), ...stn(ST.eleccity),
    w:105, d:84, h:32, floors:10, color:0x9aa7b5 },
];

/* Blue Line text metadata for the panels. Drawn geometry is in config.js. */
const METRO = {
  purple: {
    name:"Delhi Metro Blue Line — Noida eastern stretch (OPERATIONAL)",
    status:"OPERATIONAL — Sector 61, Sector 59, Sector 62 and Noida Electronic City serve the shortlist",
    statusNote:"Station coordinates are Wikipedia-published (ledger geo-stn-*). The drawn alignment is straight-through-stations and indicative, not surveyed track. Sheet metro distances are client-stated and unconfirmed.",
    path:[], stations:[]
  }
};

const NEIGHBORHOODS = [];
const RIVER_PATH = [];

/* ---------------------------------------------------------------------------
   POI — the map layers the Atlas Requirement sheet asks for beyond the buildings.
   layer: "anchor" [req 2] · "competitor" [req 5] · "pg" [req 3] · "edu" [req 7]
   Every row carries the source it came from. `precision` follows the same scale
   as the options: nothing here was machine geocoded.
--------------------------------------------------------------------------- */
const POI = [
  /* --- [2] Digitide's existing Noida office ------------------------------ */
  { id:"digitide-58", layer:"anchor", name:"Digitide Solutions — Sector 58",
    lat:28.60680, lng:77.36080, precision:"plot-approx",
    note:"2nd & 3rd floor, Plot A-94/5 & A-94/6, Sector 58, Noida 201301. The incumbent office every option is measured against.",
    src:"BSI client directory — Digitide Solutions Limited",
    srcUrl:"https://www.bsigroup.com/en-ZA/products-and-services/assessment-and-certification/validation-and-verification/client-directory-profile/E2E_SE-0047219867-014" },

  /* --- [5] BPO / BPM competitors for the same hiring pool ----------------- */
  { id:"ienergizer", layer:"competitor", name:"iEnergizer", lat:28.60200, lng:77.36900, precision:"plot-approx",
    note:"A-37, Sector 60. Large BPM operator on the same street as options A-20 and A-23. Hiring graduate freshers for domestic voice at ₹19,000-23,000 CTC, 200 openings in one recent drive.",
    src:"noidaonline BPO directory; vacancy9 hiring listing", srcUrl:"https://vacancy9.com/ienergizer-noida-sector-60-job/" },
  { id:"exl-58", layer:"competitor", name:"EXL Service", lat:28.60550, lng:77.35900, precision:"sector",
    note:"A-48, Block A, Sector 58 — roughly adjacent to Digitide's existing office.",
    src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"hcl-bpo-59", layer:"competitor", name:"HCL BPO / HCL Comnet", lat:28.60900, lng:77.36500, precision:"sector",
    note:"B-34/3, Sector 59.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"genpact-59", layer:"competitor", name:"Genpact", lat:28.60750, lng:77.37100, precision:"sector",
    note:"D-4, Sector 59 — Genpact's own locations page lists this alongside its larger Sector 135 campuses.",
    src:"Genpact official locations page", srcUrl:"https://www.genpact.com/about-us/locations" },
  { id:"concentrix-62", layer:"competitor", name:"Concentrix Daksh", lat:28.62700, lng:77.36400, precision:"plot-approx",
    note:"Ground floor, Tower C, Logix Cyber Park, C-28 & C-29, Sector 62 — under a kilometre from Knowledge Boulevard.",
    src:"Concentrix address, traffictail BPO roundup", srcUrl:"https://traffictail.com/bpo-companies-in-noida/" },
  { id:"colwell-58", layer:"competitor", name:"Colwell & Salmon", lat:28.60400, lng:77.35750, precision:"sector",
    note:"A-17, Sector 58.", src:"grotal call-centre directory", srcUrl:"https://www.grotal.com/Noida/Call-Center-Outsourcing-Services-C52/" },
  { id:"pacific-63", layer:"competitor", name:"Pacific BPO (Access Healthcare)", lat:28.62100, lng:77.37900, precision:"sector",
    note:"A-61, Sector 63.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"cogent-63", layer:"competitor", name:"Cogent E Services", lat:28.62300, lng:77.38200, precision:"sector",
    note:"C-100, Sector 63.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"techm-64", layer:"competitor", name:"Tech Mahindra (Sector 64)", lat:28.61400, lng:77.37700, precision:"sector",
    note:"A-6, Sector 64, near Sahara Chowk. Running walk-in customer-service drives at ₹1.25-3.25 LPA, 100+ openings. Note the same employer vacated option A-20.",
    src:"Justdial listing; vacancy9 walk-in drive", srcUrl:"https://vacancy9.com/tech-mahindra-customer-service/" },
  { id:"barclays-62", layer:"competitor", name:"Barclays Shared Services", lat:28.62500, lng:77.36900, precision:"sector",
    note:"Unitech Infospace, Sector 62. BFSI captive competing for the same graduate voice and back-office pool.",
    src:"grotal call-centre directory", srcUrl:"https://www.grotal.com/Noida/Call-Center-Outsourcing-Services-C52/" },
  { id:"nsb-58", layer:"competitor", name:"NSB BPO Solutions", lat:28.60250, lng:77.35800, precision:"sector",
    note:"Sector 58. Advertising 99 fresher customer-support seats at ₹12,000-16,000 per month — the floor of the local pay band.",
    src:"jobhai listing", srcUrl:"https://www.jobhai.com/customer-support-telecaller-customer-support-executive-job-in-nsb-bpo-solutions-limited-sector-58-noida-0-to-0-years-1774958477-7452995-jid" },

  /* --- [3] PG / shared accommodation clusters ----------------------------- */
  { id:"pg-bishanpura", layer:"pg", name:"Bishanpura (Sector 58) PG cluster", lat:28.60850, lng:77.36250, precision:"sector",
    note:"The densest PG cluster next to the Sector 58-60 belt. Zolo County at H-10 Bishanpura Road quotes ₹4,263 for two-sharing and ₹7,708 for a private room; HooLiv Mitra at H-8 starts at ₹12,000. Walking distance to options A-20 and A-23.",
    src:"Zolo Stays; HooLiv", srcUrl:"https://zolostays.com/pg-hostel-near-sector_58-in-noida-zolo_county-znd019" },
  { id:"pg-sec58-m", layer:"pg", name:"Sector 58 M-block co-living", lat:28.60600, lng:77.36400, precision:"sector",
    note:"M-73C Sector 58, near Stellar Business Park. Studio co-living at ₹18,000 a month, 1.6 km to Sector 62 metro and 1.9 km to Sector 59.",
    src:"Oh My Place", srcUrl:"https://www.ohmyplace.com/co-living/omp-co-living-pg-in-noida-sector-58/" },
  { id:"pg-sec62", layer:"pg", name:"Sector 62 PG cluster", lat:28.62800, lng:77.36200, precision:"sector",
    note:"Operators list double sharing at ₹13,000-14,000 per bed and four-sharing from ₹6,500, about 1 km from Sector 62 metro. Serves Knowledge Boulevard directly.",
    src:"PGNoida.com", srcUrl:"https://www.pgnoida.com/" },
  { id:"pg-mamura", layer:"pg", name:"Mamura / Sector 66 informal housing", lat:28.60000, lng:77.36300, precision:"sector",
    note:"Dense low-cost rental settlement immediately south of the Sector 60 belt. The inventory sheet itself names Mamura as a primary talent source for Magnus Tower. No organised-PG price data found — treat rents as informal-market.",
    src:"Inventory sheet (client-stated); wikimapia Sector-60 neighbour list", srcUrl:"http://wikimapia.org/14339108/Sector-60" },
  { id:"pg-chhijarsi", layer:"pg", name:"Chhijarsi (Sector 63) informal housing", lat:28.62300, lng:77.38000, precision:"sector",
    note:"Village settlement absorbed into the Sector 63 industrial belt; standard low-cost housing for the Sector 62-64 BPO floors.",
    src:"Locality directories", srcUrl:"https://www.pgnoida.com/" },

  /* --- [7] Educational institutes ---------------------------------------- */
  { id:"jiit-62", layer:"edu", name:"Jaypee Institute of Information Technology", lat:28.62450, lng:77.37200, precision:"sector",
    note:"A-10, Sector 62. Deemed university on a 46.94-acre campus, NIRF engineering band 101-150. B.Tech, MBA, BBA, BCA and MCA — the BBA/BCA/MCA streams are the realistic BPM feeder, not the CSE batch.",
    src:"JIIT official site", srcUrl:"https://www.jiit.ac.in/" },
  { id:"jss-62", layer:"edu", name:"JSS Academy of Technical Education", lat:28.62200, lng:77.37600, precision:"sector",
    note:"C-20/1, Sector 62. 4,000+ students, roughly 900 B.Tech seats a year plus MBA and MCA. 577 students placed in the 2024 drive at an average of ₹5.2 LPA.",
    src:"CollegeDekho; JosaApp", srcUrl:"https://www.collegedekho.com/colleges/jss-noida" },
  { id:"ims-62", layer:"edu", name:"IMS Noida / Symbiosis / Jaipuria cluster", lat:28.62900, lng:77.37300, precision:"sector",
    note:"Sector 62 institutional pocket. Management and mass-communication intakes, cited by local PG operators as their student base — a graduate supply on the doorstep of Knowledge Boulevard.",
    src:"PGNoida.com institute list; HooLiv nearby-institutes list", srcUrl:"https://www.pgnoida.com/post/premium-pg-in-noida-sector-62" },
  { id:"amity-125", layer:"edu", name:"Amity University, Sector 125", lat:28.54400, lng:77.33400, precision:"sector",
    note:"Largest single graduate output in Noida across management, communication and humanities. 12-14 km from the shortlist — a bus-route catchment, not a walk-in one.",
    src:"Noida institutional directories", srcUrl:"https://digitalconvey.com/mnc-companies-in-noida/" },
  { id:"jiit-128", layer:"edu", name:"JIIT Sector 128 campus", lat:28.52900, lng:77.36900, precision:"sector",
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
   It is known to run optimistic for the localities whose real route crosses one:
     Crossings Republik  — NH-24 crossing; real road distance is roughly double
                           the straight line, so read it a band later than shown.
     Noida Extension     — same NH-24 / Greater Noida West approach.
     Mayur Vihar / East Delhi — Yamuna crossing, metro-dependent in practice.
   Everything inside the Noida sector grid (Mamura, Bishanpura, Chhijarsi,
   Nithari, Hoshiyarpur, Bhangel) is on a dense local grid and reads true.
   Replace the whole thing with routed isochrones before it drives a lease
   decision — these bands are for shaping a shortlist, not for signing one.

   Locality centroids are approximate, at sector/colony precision.
   Supply notes are qualitative and sourced; no headcount is invented.
--------------------------------------------------------------------------- */
const MINUTES_PER_KM = 6.5;   // 1.30 detour factor at 12 km/h — matches connectivity.json

const CATCHMENT = {
  minutesPerKm: MINUTES_PER_KM,
  method:"Bands are estimated, not routed: straight-line distance to the locality centroid × a 1.30 street-detour factor at 12 km/h effective door-to-door speed (6.5 min per straight-line km). A proxy for peak-hour shared-auto and e-rickshaw commuting. It runs optimistic where the real route crosses NH-24 or the Yamuna — Crossings Republik, Noida Extension and Mayur Vihar each read roughly one band better here than they commute. Replace with routed isochrones before this informs a lease decision.",
  bands: [
    { key:"b0",  label:"0-20 min",  maxMin:20, color:"#2fbf71" },
    { key:"b20", label:"20-40 min", maxMin:40, color:"#d9b310" },
    { key:"b40", label:"40-50 min", maxMin:50, color:"#e0603a" },
  ],
  localities: [
    { id:"mamura", name:"Mamura / Sector 66", lat:28.60000, lng:77.36300,
      profile:"Dense low-cost rental settlement", supply:"Named in the inventory sheet as a primary talent source. Walk-in and e-rickshaw range for the whole Sector 57-60 belt." },
    { id:"bishanpura", name:"Bishanpura / Sector 58", lat:28.60850, lng:77.36250,
      profile:"Village settlement + organised PG", supply:"PG beds from ₹4,263 two-sharing. Night-shift-viable because it is walkable to the Sector 58-60 floors." },
    { id:"chhijarsi", name:"Chhijarsi / Sector 63", lat:28.62300, lng:77.38000,
      profile:"Village settlement in the industrial belt", supply:"Standard housing for the Sector 62-64 BPO floors; already feeding Concentrix, Pacific and Cogent." },
    { id:"nithari", name:"Nithari / Sector 31", lat:28.58700, lng:77.34000,
      profile:"Established low-cost colony", supply:"Long-standing BPO labour catchment for central Noida." },
    { id:"hoshiyarpur", name:"Hoshiyarpur / Sector 51", lat:28.58750, lng:77.37200,
      profile:"Urban village, metro-adjacent", supply:"Sector 51 Aqua Line and Sector 52 Blue Line interchange put it one hop from the shortlist." },
    { id:"khoda", name:"Khoda Colony", lat:28.61850, lng:77.33050,
      profile:"Very large unplanned settlement", supply:"Named in the inventory sheet. One of the biggest single low-cost labour pools on the Noida-Ghaziabad edge." },
    { id:"indirapuram", name:"Indirapuram", lat:28.64400, lng:77.37100,
      profile:"Mid-income Ghaziabad suburb", supply:"Named in the inventory sheet. Graduate and experienced voice/back-office supply, car and two-wheeler commuters." },
    { id:"vaishali", name:"Vaishali", lat:28.64500, lng:77.34000,
      profile:"Mid-income, Blue Line metro", supply:"Named in the inventory sheet. On the same Blue Line as the shortlist — the cleanest metro-borne catchment." },
    { id:"vasundhara", name:"Vasundhara", lat:28.66000, lng:77.37000,
      profile:"Mid-income Ghaziabad suburb", supply:"Named in the inventory sheet. Feeds the Sector 62-63 belt by road." },
    { id:"crossings", name:"Crossings Republik", lat:28.63550, lng:77.42300,
      profile:"High-density apartment township", supply:"Named in the inventory sheet. Large young-professional population, but NH-24 dependent and shuttle-reliant." },
    { id:"noida-ext", name:"Noida Extension / Greater Noida West", lat:28.60800, lng:77.43500,
      profile:"High-density new apartment belt", supply:"Fast-growing entry-level population; no metro to the shortlist, so shuttle or own vehicle." },
    { id:"sec15-16", name:"Noida Sector 15-16 / Nithari fringe", lat:28.58200, lng:77.31200,
      profile:"Older planned sectors", supply:"Blue Line served; established white-collar and support workforce." },
    { id:"mayur-vihar", name:"Mayur Vihar / East Delhi", lat:28.60800, lng:77.29500,
      profile:"Dense East Delhi residential", supply:"Named in the inventory sheet as East Delhi. Very large pool, entirely metro-dependent for this belt." },
    { id:"bhangel", name:"Bhangel / Sector 102", lat:28.56000, lng:77.34800,
      profile:"Urban village, low-cost", supply:"Established Noida labour settlement; road commute only." },
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
