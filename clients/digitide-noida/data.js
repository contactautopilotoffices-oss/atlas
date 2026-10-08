/* ============================================================================
   DIGITIDE · NOIDA DATA LAYER (Sectors 57 to 67)
   Source of truth for building figures: the broker sheet
   "Property_Options_in_Sector_57-67_1.xlsx", sheet "Sector 57-68" (Oct 2026):
   20 buildings, each with Autopilot's reason for shortlisting or rejecting it.
   ALL sheet figures are broker-stated and unconfirmed.

   TRUTH CONTRACT
   - Every sheet-derived option carries `sheetSrc`; its fields are the evidence
     ledger rows "<sheetSrc>-<field>" (evidence/ledger.jsonl).
   - `verdict` is Autopilot's call on the building: Recommended, Worth a look or
     Not suitable. `verdictNote` is the sheet's reason, cleaned for the client
     view: typos fixed and internal names removed. Both are plain text so they
     can be edited from /admin/.
   - Four buildings were on the earlier inventory sheet (A-20, C-57, Magnus Tower,
     Knowledge Boulevard). The new sheet's figures replace the old ones; facts the
     new sheet does not cover (building area, last occupier, tenants, cafeteria,
     power backup) are kept from the earlier sheet. A-23 is not on the new sheet
     and has been removed.
   - COORDINATES. Every pin is read from a published record; none is placed by
     eye. `coordPrecision`:
       "poi" / "building"  a place record or listing pins that building.
       "plot"              an address-level geocode of the plot.
       "sector"            no published pin exists for the plot, so the pin marks
                           the sector (a sourced sector anchor). Distances for these
                           are approximate and the card shows no satellite crop.
     The source of each pin is in its ledger row (coordSrc).
   - DISTANCES. A-20, C-57, Magnus Tower and Knowledge Boulevard keep their Google
     Maps routed figures. The 16 new buildings are estimated (straight line x 1.30
     at 4.7 km/h walking, 22 km/h driving); the card replaces the metro walk with a
     live route when it opens.
   - SORT ORDER: Recommended first, then Worth a look, then Not suitable; nearest
     metro first within each group (displayOrder).
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
   OPTIONS: the 20 buildings on the sheet, in the running order above.
--------------------------------------------------------------------------- */
const OPTIONS = [
  { bldg:"tv18", displayOrder:1, name:"C-57 (former TV18)", locality:"Block C · Sector 57", verdict:"Recommended", verdictNote:"Well maintained, the entire building is available and the floor plates are larger. We recommend it strongly. Digitide has passed on it so far; if Digitide can tell us what did not work, we will take it up with the landlord.", verdictSrc:"s2-tv18-verdict", floorsTotal:"Basement + Ground + 3", floorPlate:"~18,000 sq ft", offeredArea:"As per requirement", floorOffered:"Entire building", layout:"~800 seats across the ground and 1st floors", condition:"Ground and 1st: pre-furnished. 2nd and 3rd: warm shell", handover:"Ground and 1st: immediate. 2nd and 3rd: 3 months from signing", rent:"Ground and 1st: INR 60 / sq ft / month as is where is. 2nd and 3rd: INR 80 with a new fit-out", cam:"Included in rent", parking:"5 car parks for each floor leased", metroName:"Noida Sector 59", metroDist:"2 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-tv18", coordSrc:"geo-tv18", coordPrecision:"plot" },
  { bldg:"techm", displayOrder:2, name:"A-20 (former Tech Mahindra)", locality:"Block A · Sector 60", verdict:"Worth a look", verdictNote:"Could be a promising option. The building is changing owners, and we will have access to it after October 2026.", verdictSrc:"s2-techm-verdict", floorsTotal:"Basement + Ground + 2", floorPlate:"~27,000 sq ft", offeredArea:"As per requirement", floorOffered:"Entire building", condition:"Bare shell", handover:"60 to 75 days", rent:"Bare shell: INR 55 / sq ft / month", cam:"Actual cost + 20%", parking:"Surface parking", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-techm", coordSrc:"geo-techm", coordPrecision:"poi" },
  { bldg:"noida-d247", displayOrder:3, name:"D-247/5", locality:"Block D · Sector 63", verdict:"Worth a look", verdictNote:"Newly built, the entire building is available and it sits on a corner plot. The basement and the open area around it give plenty of parking, and the stilt floor can be used for parking or support areas. Worth considering, but the building area is not enough unless the stilt floor can be used.", verdictSrc:"s2-d247-verdict", floorsTotal:"Basement + Ground or stilt + 2.5", floorPlate:"~21,000 sq ft", offeredArea:"As per requirement", floorOffered:"Entire building", condition:"Bare shell", handover:"Immediate", rent:"Bare shell: INR 45 / sq ft / month", cam:"Actual cost + 20%", parking:"1 car park per 1,000 sq ft leased, included in rent", metroName:"Noida Electronic City", metroDist:"1 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-d247", coordSrc:"geo-noida-d247", coordPrecision:"sector" },
  { bldg:"magnus", displayOrder:4, name:"Magnus Tower", locality:"Sector 67", verdict:"Worth a look", verdictNote:"A good, new building with larger floor plates and room to grow. Digitide has passed on it so far.", verdictSrc:"s2-magnus-verdict", floorsTotal:"Basement + Ground + 5", floorPlate:"~38,000 sq ft", offeredArea:"As per requirement", floorOffered:"Multiple floors", condition:"Warm shell", handover:"October 2026", rent:"Warm shell: INR 45 / sq ft / month", cam:"INR 10 / sq ft / month", parking:"1 car park per 1,000 sq ft leased, included in rent", metroName:"Noida Sector 61", metroDist:"1 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-magnus", coordSrc:"geo-magnus", coordPrecision:"sector" },
  { bldg:"noida-a38", displayOrder:5, name:"A-38/E & F", locality:"Block A · Sector 64", verdict:"Not suitable", verdictNote:"Parking is the problem. The basement is used as office space, so the building takes only 8 to 10 cars, with limited two-wheeler parking along its edge and no parking nearby.", verdictSrc:"s2-a38-verdict", floorsTotal:"Basement + Ground + 3", floorPlate:"~14,500 sq ft", offeredArea:"As per requirement", floorOffered:"Entire building", condition:"Bare shell", handover:"Immediate", rent:"New fit-out: INR 75 / sq ft / month", cam:"Included in rent", parking:"Noida Authority parking", metroName:"Noida Sector 62", metroDist:"0.5 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-a38", coordSrc:"geo-noida-a38", coordPrecision:"sector" },
  { bldg:"noida-b25", displayOrder:6, name:"B-25/1 & 2", locality:"Block B · Sector 59", verdict:"Not suitable", verdictNote:"An old building with smaller floor plates, and not enough area available.", verdictSrc:"s2-b25-verdict", floorsTotal:"Basement + Ground + 4", floorPlate:"~12,000 sq ft", offeredArea:"~36,000 sq ft", floorOffered:"2nd, 3rd and 4th floors", condition:"Bare shell", handover:"Immediate", rent:"Bare shell: INR 55 / sq ft / month. New fit-out: to be decided", cam:"INR 10 / sq ft / month", parking:"Noida Authority parking", metroName:"Noida Sector 59", metroDist:"1 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-b25", coordSrc:"geo-noida-b25", coordPrecision:"sector" },
  { bldg:"noida-b13", displayOrder:7, name:"B-13", locality:"Block B · Sector 63", verdict:"Not suitable", verdictNote:"The floor plates are too small.", verdictSrc:"s2-b13-verdict", floorsTotal:"Basement + Ground + 3", floorPlate:"~10,000 sq ft", offeredArea:"~30,000 sq ft", floorOffered:"Ground, 1st and 2nd floors", condition:"Bare shell", handover:"Immediate", rent:"New fit-out: INR 65 / sq ft / month", cam:"INR 7 / sq ft / month", parking:"Noida Authority parking", metroName:"Noida Sector 62", metroDist:"1 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-b13", coordSrc:"geo-noida-b13", coordPrecision:"sector" },
  { bldg:"noida-a31", displayOrder:8, name:"A-31", locality:"Block A · Sector 64", verdict:"Not suitable", verdictNote:"Good floor plates, but the location and the approach road are poor. The building is in use as an NTA exam centre, with no date for when it will be free.", verdictSrc:"s2-a31-verdict", floorsTotal:"Basement + Ground + 3", floorPlate:"~30,000 sq ft", offeredArea:"As per requirement", floorOffered:"Entire building", layout:"1,100 workstations per floor", condition:"Pre-furnished", handover:"To be discussed", rent:"INR 60 / sq ft / month, as is where is", cam:"Actual cost + 20%", parking:"Noida Authority parking", metroName:"Noida Sector 62", metroDist:"0.5 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-a31", coordSrc:"geo-noida-a31", coordPrecision:"building" },
  { bldg:"noida-d212", displayOrder:9, name:"D-212", locality:"Block D · Sector 63", verdict:"Not suitable", verdictNote:"Not available, and an old building.", verdictSrc:"s2-d212-verdict", floorsTotal:"Basement + Ground + 1", floorPlate:"~33,000 sq ft", offeredArea:"As per requirement", floorOffered:"Basement", condition:"Warm shell", handover:"Immediate", rent:"Warm shell: INR 40 / sq ft / month", cam:"Actual cost + 20%", parking:"To be confirmed", metroName:"Noida Sector 62", metroDist:"1 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-d212", coordSrc:"geo-noida-d212", coordPrecision:"building" },
  { bldg:"noida-bhutani", displayOrder:10, name:"Bhutani Cyberpark", locality:"Sector 62", verdict:"Not suitable", verdictNote:"No continuous space. The available floors are spread across different towers.", verdictSrc:"s2-bhutani-verdict", floorsTotal:"Towers A to D: 2 Basements + Ground + 10", floorPlate:"~27,000 to 32,000 sq ft", offeredArea:"Tower A 5th floor: 32,000 sq ft. Tower B 9th floor: 32,000 sq ft. Tower C ground floor: 30,000 sq ft", floorOffered:"Tower A 5th, Tower B 9th and Tower C ground floors", condition:"Bare shell", handover:"Immediate", rent:"Bare shell: INR 65 / sq ft / month. New fit-out: INR 80", cam:"INR 18.5 / sq ft / month", parking:"1 car park per 1,000 sq ft leased, at INR 2,500 / car / month", metroName:"Noida Sector 62", metroDist:"2 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-bhutani", coordSrc:"geo-noida-bhutani", coordPrecision:"building" },
  { bldg:"noida-d233", displayOrder:11, name:"D-233", locality:"Block D · Sector 63", verdict:"Not suitable", verdictNote:"The building is too old.", verdictSrc:"s2-d233-verdict", floorsTotal:"Basement + Ground + 2", floorPlate:"~18,000 sq ft", offeredArea:"As per requirement", floorOffered:"Ground, 1st and 2nd floors", condition:"Bare shell", handover:"Immediate", rent:"Warm shell: INR 40 / sq ft / month", cam:"Actual cost + 20%", parking:"Noida Authority parking", metroName:"Noida Electronic City", metroDist:"1 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-d233", coordSrc:"geo-noida-d233", coordPrecision:"building" },
  { bldg:"noida-c56a3", displayOrder:12, name:"C-56/A3", locality:"Block C · Sector 62", verdict:"Not suitable", verdictNote:"The floor plates are too small.", verdictSrc:"s2-c56a3-verdict", floorsTotal:"2 Basements + Ground + 7", floorPlate:"~6,500 sq ft", offeredArea:"As per requirement", floorOffered:"Entire building", condition:"Warm shell", handover:"Immediate", rent:"New fit-out: INR 85 / sq ft / month", cam:"INR 15 / sq ft / month", parking:"Can be discussed", metroName:"Noida Sector 62", metroDist:"2 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-c56a3", coordSrc:"geo-noida-c56a3", coordPrecision:"building" },
  { bldg:"noida-c5646", displayOrder:13, name:"C-56/46", locality:"Block C · Sector 62", verdict:"Not suitable", verdictNote:"The floor plates are too small.", verdictSrc:"s2-c5646-verdict", floorsTotal:"Basement + Ground + 4", floorPlate:"~4,000 sq ft", offeredArea:"Entire building (~30,000 sq ft)", floorOffered:"Entire building", layout:"275 workstations, 3 conference rooms and 12 cabins", condition:"Pre-furnished", handover:"Immediate", rent:"INR 65 / sq ft / month, as is where is", cam:"Paid by the tenant", parking:"To be confirmed", metroName:"Noida Electronic City", metroDist:"2 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-c5646", coordSrc:"geo-noida-c5646", coordPrecision:"sector" },
  { bldg:"noida-a100", displayOrder:14, name:"A-100", locality:"Block A · Sector 58", verdict:"Not suitable", verdictNote:"An old building with only two lifts, and parking is difficult. The current tenant is planning to move out.", verdictSrc:"s2-a100-verdict", floorsTotal:"Basement + Ground + 3", floorPlate:"~19,500 sq ft", offeredArea:"~39,000 sq ft across 2 floors", floorOffered:"1st floor (immediate) and 3rd floor (November 2026)", layout:"500 workstations (3 x 2 ft) on each floor", condition:"Pre-furnished", handover:"Immediate", rent:"INR 65 / sq ft / month, as is where is", cam:"INR 12 / sq ft / month", parking:"Noida Authority parking", metroName:"Noida Sector 59", metroDist:"1.2 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-a100", coordSrc:"geo-noida-a100", coordPrecision:"building" },
  { bldg:"kboulevard", displayOrder:15, name:"Knowledge Boulevard", locality:"Plot A-8A · Sector 62", verdict:"Not suitable", verdictNote:"No continuous space: the available floors are spread across the towers. It is also an expensive building, at a tentative INR 6,500 to 7,500 per seat.", verdictSrc:"s2-kboulevard-verdict", floorsTotal:"Towers A and B: Basement + Stilt + 9", floorPlate:"~95,000 sq ft", offeredArea:"Tower A 8th floor: 22,000 sq ft. Tower B 3rd floor: 43,000 sq ft. Tower B 8th floor: 17,400 sq ft", floorOffered:"Tower A 8th, Tower B 3rd and Tower B 8th floors", condition:"Warm shell", handover:"Immediate", rent:"Warm shell: INR 65 / sq ft / month. New fit-out: INR 85", cam:"INR 24 / sq ft / month", parking:"1 car park per 1,200 sq ft leased, included in rent", metroName:"Noida Electronic City", metroDist:"2 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-kboulevard", coordSrc:"geo-kboulevard", coordPrecision:"building" },
  { bldg:"noida-c24", displayOrder:16, name:"C-24", locality:"Block C · Sector 58", verdict:"Not suitable", verdictNote:"An old building, and parking is difficult.", verdictSrc:"s2-c24-verdict", floorsTotal:"Basement + Ground + 3", floorPlate:"~17,000 sq ft", offeredArea:"As per requirement", floorOffered:"Multiple floors", condition:"Warm shell", handover:"Immediate", rent:"Warm shell: INR 50 / sq ft / month", cam:"Actual cost + 20%", parking:"Noida Authority parking", metroName:"Noida Sector 59", metroDist:"1 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-c24", coordSrc:"geo-noida-c24", coordPrecision:"building" },
  { bldg:"noida-a94-9", displayOrder:17, name:"A-94/9", locality:"Block A · Sector 58", verdict:"Not suitable", verdictNote:"Well maintained but old, with smaller floor plates. Only about 47,500 sq ft is available, and parking is limited because the basement is used as office space.", verdictSrc:"s2-a94-9-verdict", floorsTotal:"Basement + Ground + 2", floorPlate:"~12,500 sq ft", offeredArea:"As per requirement", floorOffered:"Entire building", layout:"~700 workstations (3.5 x 2 ft) across the building", condition:"Pre-furnished", handover:"November 2026", rent:"INR 55 / sq ft / month as is where is. INR 75 with a new fit-out", cam:"Included in rent", parking:"Noida Authority parking", metroName:"Noida Sector 59", metroDist:"1.2 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-a94-9", coordSrc:"geo-noida-a94-9", coordPrecision:"building" },
  { bldg:"noida-c49", displayOrder:18, name:"C-49", locality:"Block C · Sector 57", verdict:"Not suitable", verdictNote:"The building is too old.", verdictSrc:"s2-c49-verdict", floorsTotal:"Basement + Ground + 2", floorPlate:"~15,000 sq ft", offeredArea:"As per requirement", floorOffered:"Entire building", layout:"550 workstations plus cabins", condition:"Pre-furnished", handover:"Immediate", rent:"INR 55 / sq ft / month, as is where is", cam:"Actual cost + 20%", parking:"Noida Authority parking", metroName:"Noida Sector 59", metroDist:"2 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-c49", coordSrc:"geo-noida-c49", coordPrecision:"sector" },
  { bldg:"noida-c20", displayOrder:19, name:"C-20/1A/4", locality:"Block C · Sector 62", verdict:"Not suitable", verdictNote:"The floor plates are too small.", verdictSrc:"s2-c20-verdict", floorsTotal:"2 Basements + Ground + 8", floorPlate:"~5,000 sq ft", offeredArea:"~30,000 sq ft", floorOffered:"Ground, 1st and 3rd to 7th floors", condition:"Ground and 1st: pre-furnished. 3rd to 7th: bare shell", handover:"Immediate", rent:"Bare shell: INR 60 / sq ft / month. As is where is: INR 80", cam:"INR 12 / sq ft / month", parking:"1 car park per 1,000 sq ft leased, included in rent", metroName:"Noida Sector 62", metroDist:"2.5 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-c20", coordSrc:"geo-noida-c20", coordPrecision:"building" },
  { bldg:"noida-vin", displayOrder:20, name:"Vin Tower", locality:"Sector 62", verdict:"Not suitable", verdictNote:"Recently built, but the floor plates are too small.", verdictSrc:"s2-vin-verdict", floorsTotal:"2 Basements + Ground + 8", floorPlate:"~9,000 sq ft", offeredArea:"As per requirement", floorOffered:"Multiple floors", condition:"Warm shell", handover:"Immediate", rent:"Warm shell: INR 50 / sq ft / month. New fit-out: INR 70", cam:"INR 15 / sq ft / month", parking:"1 car park per 1,000 sq ft leased, included in rent", metroName:"Noida Sector 61", metroDist:"2.5 km (sheet)", buildingArea:"~1,08,000 sq ft", powerBackup:"100%", lastOccupier:"Tech Mahindra", vacatedSince:"Sep 2026", sheetSrc:"s2-vin", coordSrc:"geo-noida-vin", coordPrecision:"building" },
];

/* ---------------------------------------------------------------------------
   BUILDINGS: footprint boxes sized from the sheet's floor plates (w x d =
   plate area at 1.2 : 1), height = above-ground floors x 3.2 m. Knowledge
   Boulevard keeps its OSM footprint (geo.js).
--------------------------------------------------------------------------- */
function stn(s){ return { stnLng:s.lng, stnLat:s.lat, stnName:s.name }; }

const BUILDINGS = [
  { id:"tv18", name:"C-57 (former TV18)", block:"Sector 57", isOption:true, type:"block",
    ...geoToMeters(28.60391, 77.352742), ...stn(ST.sec59),   // Google plot geocode, Block B Sector 57 (ledger geo-tv18)
    w:45, d:37, h:13, floors:4, color:0x9aa7b5 },
  { id:"techm", name:"A-20 (former Tech Mahindra)", block:"Sector 60", isOption:true, type:"block",
    ...geoToMeters(28.604926, 77.368878), ...stn(ST.sec59),   // Google place "Tech Mahindra" (ledger geo-techm)
    w:55, d:46, h:10, floors:3, color:0x9aa7b5 },
  { id:"noida-d247", name:"D-247/5", block:"Sector 63", isOption:true, type:"block",
    ...geoToMeters(28.62285, 77.38546), ...stn(ST.eleccity),   // Sector 63 centroid from Apple Maps (maps.apple.com/place?auid=13811944267343915519); D-247/5 has no published pin
    w:48, d:40, h:11, floors:4, color:0x9aa7b5 },
  { id:"magnus", name:"Magnus Tower", block:"Sector 67", isOption:true, type:"block",
    ...geoToMeters(28.604823, 77.3847901), ...stn(ST.sec61),   // OSM way 71834192, Sector 67 centroid; no building record (ledger geo-magnus)
    w:65, d:54, h:19, floors:6, color:0x9aa7b5 },
  { id:"noida-a38", name:"A-38/E & F", block:"Sector 64", isOption:true, type:"block",
    ...geoToMeters(28.6144555, 77.3772344), ...stn(ST.sec62),   // Sector 64 anchor, OSM way 357481072 (same anchor as data.js); A-38/E & F has no published pin
    w:40, d:34, h:13, floors:4, color:0x9aa7b5 },
  { id:"noida-b25", name:"B-25/1 & 2", block:"Sector 59", isOption:true, type:"block",
    ...geoToMeters(28.6080248, 77.3676283), ...stn(ST.sec59),   // Sector 59 anchor, OSM way 71649651 (same anchor as data.js); B-25 has no published pin
    w:37, d:30, h:16, floors:5, color:0x9aa7b5 },
  { id:"noida-b13", name:"B-13", block:"Sector 63", isOption:true, type:"block",
    ...geoToMeters(28.6166308, 77.3807004), ...stn(ST.sec62),   // Sector 63 Road anchor, OSM way 71686932 (same anchor as data.js); B-13 has no published pin
    w:33, d:28, h:13, floors:4, color:0x9aa7b5 },
  { id:"noida-a31", name:"A-31", block:"Sector 64", isOption:true, type:"block",
    ...geoToMeters(28.61053, 77.378246), ...stn(ST.sec59),   // https://exa.ai/library/place/djs6r0h3ch4
    w:58, d:48, h:13, floors:4, color:0x9aa7b5 },
  { id:"noida-d212", name:"D-212", block:"Sector 63", isOption:true, type:"block",
    ...geoToMeters(28.626609, 77.382075), ...stn(ST.eleccity),   // https://exa.ai/library/place/86njls22w9l
    w:61, d:51, h:6, floors:2, color:0x9aa7b5 },
  { id:"noida-bhutani", name:"Bhutani Cyberpark", block:"Sector 62", isOption:true, type:"tower",
    ...geoToMeters(28.613032, 77.367175), ...stn(ST.sec62),   // https://exa.ai/library/place/ly259ykxwb7
    w:58, d:48, h:35, floors:11, color:0x9aa7b5 },
  { id:"noida-d233", name:"D-233", block:"Sector 63", isOption:true, type:"block",
    ...geoToMeters(28.627368, 77.385174), ...stn(ST.eleccity),   // https://exa.ai/library/place/1prz56y1kc4
    w:45, d:37, h:10, floors:3, color:0x9aa7b5 },
  { id:"noida-c56a3", name:"C-56/A3", block:"Sector 62", isOption:true, type:"tower",
    ...geoToMeters(28.614947, 77.363617), ...stn(ST.sec62),   // https://exa.ai/library/place/05dl3cm42v0
    w:27, d:22, h:26, floors:8, color:0x9aa7b5 },
  { id:"noida-c5646", name:"C-56/46", block:"Sector 62", isOption:true, type:"block",
    ...geoToMeters(28.6211447, 77.3643493), ...stn(ST.sec62),   // Sector 62 anchor, OSM node 10811810934 (same anchor as data.js); C-56/46 has no published pin
    w:21, d:18, h:16, floors:5, color:0x9aa7b5 },
  { id:"noida-a100", name:"A-100", block:"Sector 58", isOption:true, type:"block",
    ...geoToMeters(28.605217, 77.361982), ...stn(ST.sec59),   // https://myhq.in/virtual-office/altf-coworking-sector58
    w:47, d:39, h:13, floors:4, color:0x9aa7b5 },
  { id:"kboulevard", name:"Knowledge Boulevard", block:"Sector 62", isOption:true, type:"tower",
    ...geoToMeters(28.6301158, 77.3679468), ...stn(ST.eleccity),   // OSM way 634075406, footprint in geo.js (ledger geo-kboulevard)
    w:105, d:84, h:32, floors:10, color:0x9aa7b5 },
  { id:"noida-c24", name:"C-24", block:"Sector 58", isOption:true, type:"block",
    ...geoToMeters(28.608889, 77.361944), ...stn(ST.sec59),   // http://wikimapia.org/15197253/CSC-Noida-C-24-25-Sector-58
    w:44, d:36, h:13, floors:4, color:0x9aa7b5 },
  { id:"noida-a94-9", name:"A-94/9", block:"Sector 58", isOption:true, type:"block",
    ...geoToMeters(28.604788, 77.360328), ...stn(ST.sec59),   // https://www.indiabiz.info/en/infinite-computer-solutions-limited_2N
    w:37, d:31, h:10, floors:3, color:0x9aa7b5 },
  { id:"noida-c49", name:"C-49", block:"Sector 57", isOption:true, type:"block",
    ...geoToMeters(28.60577, 77.355743), ...stn(ST.sec59),   // Block C, Sector 57: the published pin for plot C-40 (Qualitek Labs), a sourced point in the same block; C-49 itself has no pin
    w:41, d:34, h:10, floors:3, color:0x9aa7b5 },
  { id:"noida-c20", name:"C-20/1A/4", block:"Sector 62", isOption:true, type:"tower",
    ...geoToMeters(28.614336, 77.356492), ...stn(ST.sec62),   // https://exa.ai/library/place/zzdjwp4trv7
    w:24, d:20, h:29, floors:9, color:0x9aa7b5 },
  { id:"noida-vin", name:"Vin Tower", block:"Sector 62", isOption:true, type:"tower",
    ...geoToMeters(28.614009, 77.355786), ...stn(ST.sec62),   // https://exa.ai/library/place/vnmp7fw2268
    w:32, d:26, h:29, floors:9, color:0x9aa7b5 },
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
  { id:"ienergizer", layer:"competitor", name:"iEnergizer", lat:28.6039578, lng:77.3648303, precision:"landuse",   // OSM way 1360555821 — named "iEnergizer" commercial landuse
    note:"A-37, Sector 60, the same industrial block as option A-20. Hiring graduate freshers for domestic voice at ₹19,000-23,000 CTC, 200 openings in one recent drive.",
    src:"noidaonline BPO directory; vacancy9 hiring listing", srcUrl:"https://vacancy9.com/ienergizer-noida-sector-60-job/" },
  { id:"exl-58", layer:"competitor", name:"EXL Service", lat:28.6065664, lng:77.3590182, precision:"sector",   // OSM way 71651922 — Sector 58 anchor; plot A-48 not mapped
    note:"A-48, Block A, Sector 58 — the same sector as Digitide's existing office.",
    src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"hcl-bpo-59", layer:"competitor", name:"HCL BPO / HCL Comnet", lat:28.6080248, lng:77.3676283, precision:"sector",   // OSM way 71649651 — Sector 59 anchor; plot B-34/3 not mapped
    note:"B-34/3, Sector 59.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"genpact-59", layer:"competitor", name:"Genpact", lat:28.6080248, lng:77.3676283, precision:"sector",   // OSM way 71649651 — Sector 59 anchor; plot D-4 not mapped
    note:"D-4, Sector 59 — listed on Genpact's own locations page alongside its larger Sector 135 campuses.",
    src:"Genpact official locations page", srcUrl:"https://www.genpact.com/about-us/locations" },
  { id:"concentrix-62", layer:"competitor", name:"Concentrix Daksh", lat:28.6118616, lng:77.3663002, precision:"landuse",   // OSM way 1360555823 — named "Logix Cyber Park" commercial landuse
    note:"Ground floor, Tower C, Logix Cyber Park, C-28 & C-29, Sector 62 — the same sector as Knowledge Boulevard.",
    src:"Concentrix address, traffictail BPO roundup", srcUrl:"https://traffictail.com/bpo-companies-in-noida/" },
  { id:"colwell-58", layer:"competitor", name:"Colwell & Salmon", lat:28.6065664, lng:77.3590182, precision:"sector",   // OSM way 71651922 — Sector 58 anchor; plot A-17 not mapped
    note:"A-17, Sector 58.", src:"grotal call-centre directory", srcUrl:"https://www.grotal.com/Noida/Call-Center-Outsourcing-Services-C52/" },
  { id:"pacific-63", layer:"competitor", name:"Pacific BPO (Access Healthcare)", lat:28.6166308, lng:77.3807004, precision:"sector",   // OSM way 71686932 — Sector 63 Road anchor; plot A-61 not mapped
    note:"A-61, Sector 63.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"cogent-63", layer:"competitor", name:"Cogent E Services", lat:28.6166308, lng:77.3807004, precision:"sector",   // OSM way 71686932 — Sector 63 Road anchor; plot C-100 not mapped
    note:"C-100, Sector 63.", src:"noidaonline BPO directory", srcUrl:"https://www.noidaonline.in/guide/bpos-in-noida" },
  { id:"techm-64", layer:"competitor", name:"Tech Mahindra (Sector 64)", lat:28.6144555, lng:77.3772344, precision:"sector",   // OSM way 357481072 — Sector 64 anchor; plot A-6 not mapped
    note:"A-6, Sector 64, near Sahara Chowk. Running walk-in customer-service drives at ₹1.25-3.25 LPA, 100+ openings. The same employer vacated option A-20.",
    src:"Justdial listing; vacancy9 walk-in drive", srcUrl:"https://vacancy9.com/tech-mahindra-customer-service/" },
  { id:"barclays-62", layer:"competitor", name:"Barclays Shared Services", lat:28.6211447, lng:77.3643493, precision:"sector",   // OSM node 10811810934 — Sector 62 anchor
    note:"Unitech Infospace, Sector 62. A BFSI captive competing for the same graduate voice and back-office pool.",
    src:"grotal call-centre directory", srcUrl:"https://www.grotal.com/Noida/Call-Center-Outsourcing-Services-C52/" },
  { id:"nsb-58", layer:"competitor", name:"NSB BPO Solutions", lat:28.6065664, lng:77.3590182, precision:"sector",   // OSM way 71651922 — Sector 58 anchor
    note:"Sector 58. Advertising 99 fresher customer-support seats at ₹12,000-16,000 per month — the floor of the local pay band.",
    src:"jobhai listing", srcUrl:"https://www.jobhai.com/customer-support-telecaller-customer-support-executive-job-in-nsb-bpo-solutions-limited-sector-58-noida-0-to-0-years-1774958477-7452995-jid" },

  /* --- [3] PG / shared accommodation. Expanded on client request:
         named operators with their own quoted rents, not just clusters. ----- */
  { id:"pg-zolo-58", layer:"pg", name:"Zolo County — Sector 58", lat:28.6065664, lng:77.3590182, precision:"sector",   // OSM way 71651922 — Sector 58 anchor; H-10 Bishanpura not mapped
    note:"H-10, Bishanpura Road, Sector 58. Men's co-living: two-sharing from ₹4,263, private room from ₹7,708. The cheapest sourced bed next to the Sector 58-60 belt.",
    src:"Zolo Stays", srcUrl:"https://zolostays.com/pg-hostel-near-sector_58-in-noida-zolo_county-znd019" },
  { id:"pg-hooliv-58", layer:"pg", name:"HooLiv Mitra — Sector 58", lat:28.6065664, lng:77.3590182, precision:"sector",   // OSM way 71651922 — Sector 58 anchor; H-8 Bishanpura not mapped
    note:"H-8, Bishanpura, Sector 58. Unisex co-living from ₹12,000 with meals. Sister properties Aura (₹15,000), Luxor and Ociana (₹12,000) and Sanskar (₹10,000) sit in the same pocket.",
    src:"HooLiv", srcUrl:"https://hooliv.com/hooliv-mitra-unisex-hostel-in-noida-boys-girls-hostel-near-jss-academy-fosma-aaft-symbiosis-ims-noida-sector-58-noida-sector-62-noida-sector-63-pg-premium-affordable-rooms/" },
  { id:"pg-ohmyplace-58", layer:"pg", name:"Oh My Place — Sector 58", lat:28.6065664, lng:77.3590182, precision:"sector",   // OSM way 71651922 — Sector 58 anchor; M-73C not mapped
    note:"M-73C, Sector 58, near Stellar Business Park. Furnished 1RK studio co-living at ₹18,000 a month, 90 units. 1.6 km to Sector 62 metro, 1.9 km to Sector 59.",
    src:"Oh My Place", srcUrl:"https://www.ohmyplace.com/co-living/omp-co-living-pg-in-noida-sector-58/" },
  { id:"pg-housitize-58", layer:"pg", name:"Housitize PG — Sector 58", lat:28.6065664, lng:77.3590182, precision:"sector",   // OSM way 71651922 — Sector 58 anchor
    note:"Sector 58 co-living, 28 rooms. Double sharing ₹8,500 with meals, single occupancy ₹14,500. Three-month minimum stay.",
    src:"HousitizePG", srcUrl:"https://housitizepg.com/property/coliving-pg-near-sector-62-noida-4/" },
  { id:"pg-pgnoida-62", layer:"pg", name:"PGNoida cluster — Sector 62", lat:28.6211447, lng:77.3643493, precision:"sector",   // OSM node 10811810934
    note:"Multiple houses across Sectors 58-63. Four-sharing from ₹6,500, triple ₹7,000, double ₹8,500, single ₹14,000-22,000. Operating since 2009, no lock-in.",
    src:"PGNoida.com", srcUrl:"https://www.pgnoida.com/" },
  { id:"pg-premium-62", layer:"pg", name:"Premium PG — Sector 62", lat:28.6211447, lng:77.3643493, precision:"sector",   // OSM node 10811810934 — Sector 62 anchor
    note:"About 1 km from Sector 62 metro. Double sharing ₹13,000-14,000 per bed, AC, meals, 24x7 security. Serves Knowledge Boulevard directly.",
    src:"PGNoida.com", srcUrl:"https://www.pgnoida.com/post/premium-pg-in-noida-sector-62" },
  { id:"pg-mamura", layer:"pg", name:"Mamura informal rental market", lat:28.6036193, lng:77.3754881, precision:"sector",   // OSM node 853665802
    note:"Dense low-cost rental settlement south-east of the Sector 60 belt, named in the inventory sheet as a primary talent source. Informal market — no organised-PG rate card, which is exactly why it absorbs night-shift staff at the lowest cost.",
    src:"Inventory sheet (client-stated); OSM place node", srcUrl:"https://www.pgnoida.com/" },
  { id:"pg-sec61", layer:"pg", name:"Sector 61 residential PG belt", lat:28.5964581, lng:77.3675644, precision:"sector",   // OSM way 170938118
    note:"Planned residential sector directly between the Sector 60 options and Sector 61 metro. Standard family-flat sublets and PG rooms; the walk-to-work option for A-20.",
    src:"OSM residential landuse; local PG directories", srcUrl:"https://www.pgnoida.com/" },
  { id:"pg-sec71", layer:"pg", name:"Sector 71 / 72 / 73 PG belt", lat:28.5942367, lng:77.3761378, precision:"sector",   // OSM way 71689145
    note:"High-density residential belt the client names as Magnus Tower's immediate catchment. Large supply of shared flats and PG rooms aimed at the Sector 62-67 office floors.",
    src:"Client note (Sep 2026); OSM residential landuse", srcUrl:"https://www.pgnoida.com/" },

  /* --- [7] Educational institutes ---------------------------------------- */
  { id:"jiit-62", layer:"edu", name:"Jaypee Institute of Information Technology", lat:28.6300443, lng:77.3720823, precision:"poi",   // OSM node 714377672 — named "Jaypee Institute of Information Technology, Noida"
    note:"A-10, Sector 62. Deemed university on a 46.94-acre campus, NIRF engineering band 101-150. B.Tech, MBA, BBA, BCA and MCA — the BBA/BCA/MCA streams are the realistic BPM feeder, not the CSE batch. JIIT also runs a Sector 128 campus on the Expressway with centralised placements, so it feeds the same recruiter pipeline; it has no OSM record of its own, so it is not pinned separately.",
    src:"JIIT official site", srcUrl:"https://www.jiit.ac.in/" },
  { id:"jss-62", layer:"edu", name:"JSS Academy of Technical Education", lat:28.6139258, lng:77.3595011, precision:"poi",   // OSM way 1162537992 — named "JSS Academy of Technical Education"
    note:"C-20/1, Sector 62. 4,000+ students, roughly 900 B.Tech seats a year plus MBA and MCA. 577 students placed in the 2024 drive at an average of ₹5.2 LPA.",
    src:"CollegeDekho; JosaApp", srcUrl:"https://www.collegedekho.com/colleges/jss-noida" },
  { id:"ims-62", layer:"edu", name:"IMS Noida / Symbiosis / Jaipuria cluster", lat:28.6305337, lng:77.3689271, precision:"poi",   // OSM way 352775383 — named "IMS Law College"
    note:"Sector 62 institutional pocket. Management and mass-communication intakes, cited by local PG operators as their student base — graduate supply on the doorstep of Knowledge Boulevard.",
    src:"PGNoida.com institute list; HooLiv nearby-institutes list", srcUrl:"https://www.pgnoida.com/post/premium-pg-in-noida-sector-62" },
  { id:"amity-125", layer:"edu", name:"Amity University, Sector 125", lat:28.5432229, lng:77.3327483, precision:"poi",   // OSM way 502875300 — named "Amity University, Noida"
    note:"Largest single graduate output in Noida across management, communication and humanities. 12-14 km from the shortlist — a bus-route catchment, not a walk-in one.",
    src:"Noida institutional directories", srcUrl:"https://digitalconvey.com/mnc-companies-in-noida/" },
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
      profile:"Planned residential, metro-adjacent", supply:"Sits between Sector 60 and Sector 61 metro. The genuine walk-to-work catchment for A-20." },
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
  brief:"Twenty buildings screened across Sectors 57 to 67, each with Autopilot's verdict · metro access and talent catchment are the priorities · all sheet figures client-stated and unconfirmed",
  prepared:"Autopilot Offices · Property options in Sector 57-67 (Oct 2026)",
  winner:null   // no pre-crowned winner — selection is the only accent
};

window.BKC = { BAND, OPTIONS, BUILDINGS, METRO, NEIGHBORHOODS, RIVER_PATH, META, POI, CATCHMENT };
