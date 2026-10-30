/* ============================================================================
   FLIPKART ANDHERI EAST - DATA LAYER
   Source of truth: "Flipkart Inventory Options Sheet" (Autopilot / Worksquare,
   Oct 2026), 7 buildings. Carpet area, built-up area, floors, grade, furnishing,
   efficiency, ceiling height, parking, Fire NOC, OC & CC, DG and timeline are
   verbatim from that sheet. Seats = carpet / 55 sqft (4x2 workstation layout,
   incl. meeting/cafe/circulation) for a ~220-seat requirement (~12,100 sqft).

   The sheet marks two options as client priorities: 723 Avenue = Priority 1,
   Corporate Avenue = Priority 2. Both carry the priority badge and rank first.

   TIERS (no numeric scoring, categorical, per client's ask):
     BEST FIT        = contiguous block >= 220 seats AND <= 2 hops from
                       Central Line (Ghatkopar -> Metro L1) AND no open
                       approval risk
     WORKABLE        = 2 hops but undersized, floors not confirmed contiguous,
                       or approvals/possession still pending
     NOT RECOMMENDED = Line 3 station = 3rd hop (commute stress compounds) or
                       fails both filters

   HONESTY NOTES:
   - Metro distances are NOT in the sheet. 723 Avenue (700 m) and Privilon
     (93 m) are from the earlier Proposed Inventory PDF; Corporate Avenue,
     Rustomjee, Landmark are straight-line estimates from researched pins;
     Vaman and Fulcrum carry over from the previous version. VERIFY.
   - "Marol Metro Station" for Vaman is ambiguous between Marol Naka (L1) and
     the Line 3 stop; treated as Marol Naka L1.
   - Efficiency of 60% is ASSUMED for Corporate Avenue, Rustomjee, Privilon and
     Landmark (landlord quoted on carpet), exactly as the sheet says.
   - Every footprint except Vaman is a generated box on a researched pin.
   - Hop counts assume Central Line -> Ghatkopar interchange -> Metro Line 1.
   ============================================================================ */

const WEIGHTS = { contiguity: 0.4, connectivity: 0.4, readiness: 0.2 }; // qualitative, not scored

const FIT_COLORS = {
  "BEST FIT":        "#2fbf71",
  "WORKABLE":        "#f0a020",
  "NOT RECOMMENDED": "#d1495b"
};

/* score = SEATS at 4x2 density (real capacity, not an index).
   bar   = seat capacity vs the 220-seat requirement, capped at 100. */
const REQ_SEATS = 220;
function seatBar(s){ return Math.min(100, Math.round(s / (REQ_SEATS*1.25) * 100)); }

const OPTIONS = [
  { rank:1, bldg:"avenue723", priority:true, unit:"723 Avenue - 13th + 14th Flr (contiguous)", floor:"13th+14th", furn:"Bare-shell",
    carpet:12952, charge:21586, eff:0.60, parking:"1:1000 on chargeable area",
    poss:"Immediate", aqua:0.70, score:235, scoreLabel:"235 seats", bar:seatBar(235), fit:"BEST FIT", hops:2,
    extra:[["Ceiling","11.7 ft"],["Fire NOC / OC & CC","Available"],["DG","Common area only"]],
    note:"Client Priority 1. Grade A, G+15, two contiguous top floors with the most headroom of the ready options (235 seats). Fire NOC and OC are now in hand and it is immediate, so the only lead time is the bare-shell fit-out. Footprint approximate (too new for OSM)." },
  { rank:2, bldg:"corporate", priority:true, unit:"Corporate Avenue - 3rd + 4th Flr (contiguous)", floor:"3rd+4th", furn:"Furnished",
    carpet:12414, charge:20690, eff:0.60, parking:"5 car parks per floor",
    poss:"Immediate", aqua:0.65, score:225, scoreLabel:"225 seats", bar:seatBar(225), fit:"BEST FIT", hops:2,
    extra:[["Ceiling","11 ft"],["Fire NOC / OC & CC","Available"],["DG","Common area only"]],
    note:"Client Priority 2. The only furnished, move-in-ready contiguous pair in the set: Grade A, G+8, 225 seats with slim headroom. Nearest station is WEH (about 650 m); the sheet places it in the Chakala micro-market. Efficiency 60% assumed (landlord quoted on carpet)." },
  { rank:3, bldg:"privilon", unit:"Privilon - Multiple floors", floor:"Multiple", furn:"Bare-shell",
    carpet:15343, charge:"Not given", eff:0.60, parking:"1:2000 (TBD)",
    poss:"Jan 2027", aqua:0.093, score:278, scoreLabel:"278 seats", bar:seatBar(278), fit:"WORKABLE", hops:2,
    extra:[["Ceiling","11.7 ft"],["Fire NOC / OC & CC","Jan 2027"],["DG","Common area only"]],
    note:"Largest offer in the 2-hop set (278 seats) and 93 m from Marol Naka, but it is not yet an upgrade to Best Fit: the floors are listed only as 'Multiple' (contiguity unconfirmed), Fire NOC and OC land Jan 2027, parking is TBD and it is bare-shell. Confirm the floors and the NOC date to promote." },
  { rank:4, bldg:"vaman", unit:"Vaman Techno Centre - 3rd Flr", floor:"3rd", furn:"Bare-shell",
    carpet:12300, charge:19700, eff:0.62, parking:"1:1500 + Rs. 5,000 per car park",
    poss:"Immediate", aqua:0.50, score:223, scoreLabel:"223 seats", bar:seatBar(223), fit:"WORKABLE", hops:2,
    extra:[["Ceiling","11-12 ft approx"],["Fire NOC / OC & CC","Available"],["DG","Common area only"]],
    note:"Grade B. A single plate fits 223 seats, just 1.4% headroom over the 220 ask and no expansion room. Immediate but bare-shell, and parking is chargeable." },
  { rank:5, bldg:"landmark", unit:"Landmark - 6th Flr", floor:"6th", furn:"Furnished",
    carpet:10000, charge:16667, eff:0.60, parking:"8 car parks",
    poss:"Immediate", aqua:0.20, score:181, scoreLabel:"181 seats", bar:seatBar(181), fit:"WORKABLE", hops:2,
    extra:[["Ceiling","11 ft approx"],["Fire NOC / OC & CC","Available"],["DG","Common area only"]],
    note:"Grade B, G+6 on Suren Road off the WEH, about 200 m from WEH metro. Furnished and immediate, but 181 seats is about 40 short of the ask; works only if headcount phases down." },
  { rank:6, bldg:"rustomjee", unit:"Rustomjee Central Park - 4th Flr", floor:"4th", furn:"Furnished",
    carpet:9000, charge:15000, eff:0.60, parking:"10 car parks",
    poss:"Feb 2027 (early vacancy can be discussed)", aqua:0.48, score:163, scoreLabel:"163 seats", bar:seatBar(163), fit:"WORKABLE", hops:2,
    extra:[["Ceiling","12 ft"],["Fire NOC / OC & CC","Available"],["DG","Common area only"]],
    note:"Grade B+, G+9, furnished, on Andheri-Kurla Rd at the Chakala signal. The smallest plate in the set (163 seats, 57 short of the ask) and not available until Feb 2027 unless early vacancy is agreed." },
  { rank:7, bldg:"fulcrum", unit:"Fulcrum - 1st Flr", floor:"1st", furn:"Furnished",
    carpet:11700, charge:18000, eff:0.65, parking:"9 car parks",
    poss:"Immediate", aqua:0.90, score:212, scoreLabel:"212 seats", bar:seatBar(212), fit:"NOT RECOMMENDED", hops:3,
    extra:[["Ceiling","11-12 ft approx"],["Fire NOC / OC & CC","Available"],["DG","Common area only"]],
    note:"Grade A and furnished, but it fails both filters: 212 seats (8 short) AND the airport-side Line 3 stop is a 3rd hop for Central Line riders. The airport-belt address does not offset the daily commute." }
];

/* ---------------------------------------------------------------------------
   BUILDINGS - geocoded + footprint-snapped coordinates (see geo.js).
   stnLng/stnLat/stnName = each building's own nearest station for the
   walking-route overlay. hops = interchanges from the Central Line.
--------------------------------------------------------------------------- */
const GEO_ORIGIN = { lat: 19.111, lon: 72.869 };
function lngToMercX(lon){ return lon/360 + 0.5; }
function latToMercY(lat){ return 0.5 - Math.log(Math.tan(Math.PI/4 + (lat*Math.PI)/360))/(2*Math.PI); }
const _omx = lngToMercX(GEO_ORIGIN.lon), _omy = latToMercY(GEO_ORIGIN.lat);
const MER_SCALE = 1/(40075016.68*Math.cos(GEO_ORIGIN.lat*Math.PI/180));
function geoToMeters(lat, lon){
  return { lat, lng: lon, x:(lngToMercX(lon)-_omx)/MER_SCALE, z:(latToMercY(lat)-_omy)/MER_SCALE };
}

const ST = {
  weh:      { lng:72.85639, lat:19.11556, name:"WEH (Line 1)" },
  chakala:  { lng:72.86770, lat:19.11205, name:"Chakala J B Nagar (Line 1)" },
  airport:  { lng:72.87475, lat:19.11027, name:"Airport Road (Line 1)" },
  marolnaka:{ lng:72.87954, lat:19.10820, name:"Marol Naka (Line 1 x Line 3 interchange)" },
  sahar:    { lng:72.86209, lat:19.09861, name:"Sahar Road (Line 3, 3rd hop)" },
};
function stn(s){ return { stnLng:s.lng, stnLat:s.lat, stnName:s.name }; }

const BUILDINGS = [
  { id:"avenue723", name:"723 Avenue", block:"Marol", isOption:true, type:"tower",
    ...geoToMeters(19.109713, 72.884422), ...stn(ST.marolnaka), w:34, d:26, h:51, floors:16, color:0x2fbf71, aqua:0.70,
    bandra:2, busStops:"Marol Naka", busRoutes:"Central Line -> Ghatkopar -> L1 to Marol Naka (2 hops)",
    tenants:"G+15 Grade A tower, bare-shell; 13th + 14th floors on offer, immediate, Fire NOC and OC available.",
    posh:["Marol Naka","Sag Baug Rd offices"],
    grade:"A", gradeNote:"Client Priority 1: contiguous top floors, 235 seats, approvals in hand." },
  { id:"corporate", name:"Corporate Avenue", block:"Chakala", isOption:true, type:"slab",
    ...geoToMeters(19.110625, 72.859637), ...stn(ST.weh), w:50, d:34, h:29, floors:9, color:0x2fbf71, aqua:0.65,
    bandra:2, busStops:"WEH / Chakala", busRoutes:"Central Line -> Ghatkopar -> L1 to WEH (2 hops)",
    tenants:"Furnished G+8, 3rd + 4th floors on offer, immediate, 5 car parks per floor.",
    posh:["Chakala junction plazas","WEH access"],
    grade:"A", gradeNote:"Client Priority 2: the only furnished, move-in-ready contiguous pair." },
  { id:"privilon", name:"Privilon", block:"Marol Naka", isOption:true, type:"tower",
    ...geoToMeters(19.10872, 72.88040), ...stn(ST.marolnaka), w:40, d:30, h:51, floors:16, color:0xf0a020, aqua:0.093,
    bandra:2, busStops:"Marol Naka (93 m)", busRoutes:"Central Line -> Ghatkopar -> L1 to Marol Naka (2 hops)",
    tenants:"Bare-shell G+15, 15,343 sqft across multiple floors; Fire NOC and OC due Jan 2027.",
    posh:["Marol Naka food street","Andheri-Kurla Rd frontage"],
    grade:"A", gradeNote:"Most space in the 2-hop set (278 seats) at the interchange; floors and NOC date to confirm." },
  { id:"vaman", name:"Vaman Techno Centre", block:"Marol Makwana Rd", isOption:true, type:"block",
    ...geoToMeters(19.10693, 72.87954), ...stn(ST.marolnaka), w:40, d:30, h:26, floors:8, color:0xf0a020, aqua:0.50,
    bandra:2, busStops:"Marol Naka", busRoutes:"Central Line -> Ghatkopar -> L1 (2 hops)",
    tenants:"Single 12,300 sqft plate, immediate, bare-shell, G+7.",
    posh:["Marol Makwana Rd","Marol Naka food street"],
    grade:"B", gradeNote:"Fits the ask with almost zero headroom and no expansion runway." },
  { id:"landmark", name:"Landmark", block:"WEH", isOption:true, type:"block",
    ...geoToMeters(19.116739, 72.855679), ...stn(ST.weh), w:44, d:34, h:22, floors:7, color:0xf0a020, aqua:0.20,
    bandra:2, busStops:"WEH station", busRoutes:"Central Line -> Ghatkopar -> L1 to WEH (2 hops)",
    tenants:"Furnished G+6 on Suren Rd beside the WEH / Andheri-Kurla Rd junction; 6th floor, immediate.",
    posh:["WEH junction","Highway frontage"],
    grade:"B", gradeNote:"Best door-to-metro walk after Privilon; 181 seats caps it below the ask." },
  { id:"rustomjee", name:"Rustomjee Central Park", block:"Chakala", isOption:true, type:"slab",
    ...geoToMeters(19.114042, 72.860671), ...stn(ST.weh), w:38, d:30, h:32, floors:10, color:0xf0a020, aqua:0.48,
    bandra:2, busStops:"WEH / Chakala", busRoutes:"Central Line -> Ghatkopar -> L1 to WEH (2 hops)",
    tenants:"Furnished G+9, 4th floor, 9,000 sqft; available Feb 2027, early vacancy negotiable.",
    posh:["Chakala signal","Andheri-Kurla Rd corporate strip"],
    grade:"B+", gradeNote:"Good address, but the smallest plate in the set (163 seats) and a Feb 2027 start." },
  { id:"fulcrum", name:"Fulcrum", block:"Sahar Rd", isOption:true, type:"block",
    ...geoToMeters(19.10310, 72.86560), ...stn(ST.sahar), w:40, d:30, h:32, floors:10, color:0xd1495b, aqua:0.90,
    bandra:3, busStops:"Sahar Road (Line 3)", busRoutes:"Central Line -> Ghatkopar -> L1 -> Marol Naka -> L3 (3 HOPS)",
    tenants:"Furnished G+9 beside the airport hotel cluster; 11,700 sqft on the 1st floor, immediate.",
    posh:["Sahar hotel belt (JW, Hyatt)","T2 approach"],
    grade:"A", gradeNote:"Undersized AND a 3-hop commute: fails both client filters." },

  // ---- Context landmarks (not selectable) ----
  { id:"marolnaka_stn", name:"Marol Naka Station (L1 x L3)", block:"Marol", type:"slab",
    ...geoToMeters(ST.marolnaka.lat, ST.marolnaka.lng), w:60, d:20, h:12, floors:2, color:0x14b8c4 },
  { id:"weh_stn", name:"WEH Station (L1)", block:"WEH", type:"slab",
    ...geoToMeters(ST.weh.lat, ST.weh.lng), w:60, d:20, h:12, floors:2, color:0x14b8c4 },
  { id:"chakala_stn", name:"Chakala Station (L1)", block:"Chakala", type:"slab",
    ...geoToMeters(ST.chakala.lat, ST.chakala.lng), w:60, d:20, h:12, floors:2, color:0x14b8c4 },
];

/* ---------------------------------------------------------------------------
   METRO - Line 1 (the 2-hop lifeline) + Line 3 segment (the 3rd hop).
   Alignments are indicative for visualization; stations are placed accurately.
--------------------------------------------------------------------------- */
const METRO = {
  aqua: {
    name:"Metro Line 1 - Versova-Ghatkopar (Blue)",
    color:0x14b8c4, status:"OPERATIONAL - the 2-hop lifeline",
    statusNote:"Central Line employees ride to Ghatkopar, interchange once to Line 1, and reach every green/amber option. That's the 2-hop budget: Central to Ghatkopar (hop 1), L1 to the office station (hop 2).",
    path:[[ -1500,-300 ]],
    stations:[ {name:"Marol Naka - L1 x L3 interchange", x:1100, z:320, interchange:true} ]
  },
  yellow: {
    name:"Metro Line 3 - Aqua (Marol Naka to Sahar Road segment)",
    color:0xf2c200, status:"OPERATIONAL - but a 3rd hop for Central Line riders",
    statusNote:"Sahar Road (Fulcrum) sits on Line 3. Reaching it from the Central Line means a second interchange at Marol Naka, hop 3. Daily, both ways: this is the commute-stress line.",
    path:[[600,-900]],
    stations:[ {name:"Sahar Road (L3)", x:-720, z:1370} ]
  }
};

/* Food circles, plazas & hubs - the "what clicks" layer */
const NEIGHBORHOODS = [
  { name:"Marol Naka food street", ...geoToMeters(19.1073,72.8810), tag:"Khau gali - lunch crowd" },
  { name:"Sahar hotel belt - JW, Hyatt", ...geoToMeters(19.0995,72.8655), tag:"Client dinners - airport 10 min" },
  { name:"Chakala junction plazas", ...geoToMeters(19.1105,72.8620), tag:"Retail & quick-service" },
  { name:"WEH / Gundavali junction", ...geoToMeters(19.1150,72.8560), tag:"Highway frontage - cafes & banks" },
  { name:"Andheri-Kurla Rd corporate strip", ...geoToMeters(19.1100,72.8700), tag:"Offices - cafes & quick-service" }
];

const RIVER_PATH = [];

const META = {
  client:"Flipkart",
  business:"Tech office - ~220 seats on 4x2 workstations (~55 sqft/seat = ~12,100 sqft)",
  brief:"Contiguous or single-plate block for 220 | <=2 metro hops from the Central Line (via Ghatkopar -> Line 1) | Line 3 = 3rd hop = downgrade | amenities: metro walk, food circles, plazas",
  prepared:"Autopilot Offices - Andheri East inventory options sheet (Oct 2026)",
  winner:"avenue723"
};

window.BKC = { WEIGHTS, FIT_COLORS, OPTIONS, BUILDINGS, METRO, NEIGHBORHOODS, RIVER_PATH, META };
