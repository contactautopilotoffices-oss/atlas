/* ============================================================================
   FLIPKART ANDHERI EAST - DATA LAYER
   Source of truth: "Flipkart Property Inventory, Andheri East" deck (Autopilot,
   Prepared for Flipkart, Nov 2026), 7 slides. Every figure in the unit cards
   (carpet area, built-up area, grade, furnishing, efficiency, possession,
   per seat, floors, ceiling height, parking, Fire NOC, OC & CC, DG, parking
   charges) is copied word for word from the deck. Seats = carpet / 55 sqft
   (4x2 workstation layout, incl. meeting/cafe/circulation) against a
   ~220-seat requirement (~12,100 sqft); that is our analysis, not the deck.

   The deck marks two options as client priorities: 723 Avenue = PRIORITY 1,
   Corporate Avenue = PRIORITY 2. Both carry the priority badge and rank first.

   CONNECTIVITY IS NOT IN THE DECK. Metro stations, distances (aqua, in km) and
   hop counts are our own research (developer and broker listings, MMRCL and
   Wikipedia station data), refreshed Nov 2026:
     723 Avenue    ~1 km to Marol Naka (developer's own figure)
     Corporate Av. ~650 m to WEH / Gundavali (myHQ listing); Chakala 850 m
     Privilon      right next to Marol Naka (developer); OSM puts L1 at ~0 m, L3 ~100 m
     Vaman         ~7 min walk to Marol Naka (broker listings)
     Landmark      ~200 m to WEH (JLL)
     Rustomjee     2-3 min walk to WEH (developer and operator); Chakala 0.7 km
     Fulcrum       Sahar Road (Line 3) ~690 m, measured from the Hyatt Regency next door

   TIERS (no numeric scoring, categorical, per client's ask):
     BEST FIT        = contiguous block >= 220 seats AND <= 2 hops from
                       Central Line (Ghatkopar -> Metro L1) AND ready now
     WORKABLE        = 2 hops but undersized, floors not confirmed contiguous,
                       or possession still pending
     NOT RECOMMENDED = Line 3 station = 3rd hop (commute stress compounds) or
                       fails both filters

   HONESTY NOTES:
   - Privilon's carpet (11,331) and built-up (18,885) are identical to 723
     Avenue's in the deck, and the earlier options sheet had 15,343 for
     Privilon. Shown as in the deck; VERIFY with the landlord.
   - Vaman's pin moved to a map place page (19.1115, 72.8822); the old OSM snap
     sat south of Andheri-Kurla Rd. Fulcrum's pin is estimated from the Hyatt.
   - Every footprint is a generated box on a researched pin (not OSM outlines).
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
  { rank:1, bldg:"avenue723", priority:true, unit:"723 Avenue - 13th & 14th Flr", floor:"13th & 14th", furn:"Bareshell",
    carpet:11331, charge:"18,885 sq. ft.", eff:0.60, parking:"11 Car Parking",
    poss:"Immediately", aqua:1.0, score:206, scoreLabel:"206 seats", bar:seatBar(206), fit:"WORKABLE", hops:2,
    perSeat:"Rs. 16,000 - Rs. 16,500 + GST",
    extra:[["Micro-market","Marol"],["Grade","A"],["Total floors","G+15"],["Building type","Commercial"],["Ceiling height","11.7 ft"],["Per seat","Rs. 16,000 - Rs. 16,500 + GST"],["Fire NOC","Available"],["OC & CC","Available"],["DG","Common area only"]],
    note:"PRIORITY 1 in the deck. Grade A, G+15, bareshell, immediate with Fire NOC and OC in hand. At 4x2 (55 sqft a seat) the 11,331 sqft carpet seats 206, 14 short of the 220 ask; it fits at about 51 sqft a seat. Connectivity: about 1 km to Marol Naka (Line 1 x Line 3), the developer's own figure." },
  { rank:2, bldg:"corporate", priority:true, unit:"Corporate Avenue - 3rd and 4th Flr", floor:"3rd and 4th", furn:"Furnished",
    carpet:12414, charge:"20,690 sq. ft.", eff:0.60, parking:"5 car parking per floor",
    poss:"Immediately", aqua:0.65, score:225, scoreLabel:"225 seats", bar:seatBar(225), fit:"BEST FIT", hops:2,
    perSeat:"Rs. 15,200 - Rs. 15,700 + GST",
    extra:[["Micro-market","Chakala"],["Grade","A-"],["Total floors","G+8"],["Building type","Commercial"],["Ceiling height","11 ft"],["Per seat","Rs. 15,200 - Rs. 15,700 + GST"],["Fire NOC","Available"],["OC & CC","Available"],["DG","Common area only"]],
    note:"PRIORITY 2 in the deck, and the only option that is furnished, immediate and big enough: 225 seats at 4x2 across two contiguous floors. Connectivity: about 650 m to WEH and Gundavali metro (9 min walk), Chakala J B Nagar 850 m." },
  { rank:3, bldg:"vaman", unit:"Vaman Techno Centre - 3rd Flr", floor:"3rd", furn:"Bareshell",
    carpet:12300, charge:"19,700 sq. ft.", eff:0.62, parking:"13 Car parking",
    poss:"Immediately", aqua:0.45, score:223, scoreLabel:"223 seats", bar:seatBar(223), fit:"WORKABLE", hops:2,
    perSeat:"Rs. 13,400 - Rs. 13,900 + GST",
    extra:[["Micro-market","Marol Metro Station"],["Grade","B"],["Total floors","G+7"],["Building type","Commercial"],["Ceiling height","11 ft - 12 ft (approx.)"],["Per seat","Rs. 13,400 - Rs. 13,900 + GST"],["Parking Charges","Rs. 5,000 per car park per month + Taxes"],["Fire NOC","Available"],["OC & CC","Available"],["DG","Common area only"]],
    note:"The lowest per seat rate in the set. One plate seats 223 at 4x2, only 3 above the ask, so no expansion room. Immediate but bareshell and Grade B. Connectivity: about a 7 min walk to Marol Naka (Line 1 x Line 3) on broker listings." },
  { rank:4, bldg:"privilon", unit:"Privilon - Multiple floors", floor:"Multiple", furn:"Bareshell",
    carpet:11331, charge:"18,885 sq. ft.", eff:0.60, parking:"5 Car parking",
    poss:"Jan 2027", aqua:0.1, score:206, scoreLabel:"206 seats", bar:seatBar(206), fit:"WORKABLE", hops:2,
    perSeat:"Rs. 18,000 - Rs. 18,500 + GST",
    extra:[["Micro-market","Marol"],["Grade","A"],["Total floors","G+15"],["Building type","Commercial"],["Ceiling height","11.7 ft"],["Per seat","Rs. 18,000 - Rs. 18,500 + GST"],["Parking Charges","To Be Discussed"],["Fire NOC","Jan 2027"],["OC & CC","Jan 2027"],["DG","Common area only"]],
    note:"The dearest per seat rate in the set, and not ready until Jan 2027 (Fire NOC and OC too). Floors are only listed as Multiple, so a contiguous block is unconfirmed, and the carpet equals 723 Avenue's (verify). Connectivity: the best in the set, right next to Marol Naka (Line 1 x Line 3)." },
  { rank:5, bldg:"landmark", unit:"Landmark - 6th Flr", floor:"6th", furn:"Furnished",
    carpet:10000, charge:"16,666.7 sq. ft.", eff:0.60, parking:"8 car parking",
    poss:"Immediately", aqua:0.2, score:181, scoreLabel:"181 seats", bar:seatBar(181), fit:"WORKABLE", hops:2,
    perSeat:"Rs. 15,200 - Rs. 15,700 + GST",
    extra:[["Micro-market","Western Express Highway"],["Grade","B"],["Total floors","G+6"],["Building type","Commercial"],["Ceiling height","11 ft (approx.)"],["Per seat","Rs. 15,200 - Rs. 15,700 + GST"],["Fire NOC","Available"],["OC & CC","Available"],["DG","Common area only"]],
    note:"Furnished and immediate, but 10,000 sqft seats only 181 at 4x2, about 40 short of the ask. Connectivity: about 200 m to WEH metro (Line 1 x Line 7), per JLL." },
  { rank:6, bldg:"rustomjee", unit:"Rustomjee Central Park - 4th Flr", floor:"4th", furn:"Furnished",
    carpet:9000, charge:"15,000 sq. ft.", eff:0.60, parking:"10 Car parking",
    poss:"Feb 2027 - Can be discussed for early vacancy", aqua:0.45, score:163, scoreLabel:"163 seats", bar:seatBar(163), fit:"WORKABLE", hops:2,
    perSeat:"Rs. 16,000 - Rs. 16,500 + GST",
    extra:[["Micro-market","Chakala"],["Grade","B"],["Total floors","G+9"],["Building type","Commercial"],["Ceiling height","12 ft"],["Per seat","Rs. 16,000 - Rs. 16,500 + GST"],["Fire NOC","Available"],["OC & CC","Available"],["DG","Common area only"]],
    note:"The smallest plate in the set (163 seats at 4x2, 57 short) and not available until Feb 2027 unless early vacancy is agreed. Connectivity: a 2 to 3 min walk to WEH metro (Line 1 x Line 7), Chakala J B Nagar 0.7 km." },
  { rank:7, bldg:"fulcrum", unit:"Fulcrum - 1st Flr", floor:"1st", furn:"Furnished",
    carpet:11700, charge:"18,000 sq. ft.", eff:0.65, parking:"9 car parking",
    poss:"Immediately", aqua:0.7, score:212, scoreLabel:"212 seats", bar:seatBar(212), fit:"NOT RECOMMENDED", hops:3,
    perSeat:"Rs. 14,400 - Rs. 14,900 + GST",
    extra:[["Micro-market","CSMI Metro"],["Grade","B+"],["Total floors","G+9"],["Building type","Commercial"],["Ceiling height","11 ft - 12 ft (approx.)"],["Per seat","Rs. 14,400 - Rs. 14,900 + GST"],["Fire NOC","Available"],["OC & CC","Available"],["DG","Common area only"]],
    note:"Furnished and immediate, but it fails both filters: 212 seats at 4x2 (8 short) and the nearest metro is Sahar Road on Line 3 (about 690 m), a 3rd hop for Central Line riders." }
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
  sahar:    { lng:72.86524, lat:19.10220, name:"Sahar Road (Line 3, 3rd hop)" },
};
function stn(s){ return { stnLng:s.lng, stnLat:s.lat, stnName:s.name }; }

const BUILDINGS = [
  { id:"avenue723", name:"723 Avenue", block:"Marol", isOption:true, type:"tower",
    ...geoToMeters(19.109713, 72.884422), ...stn(ST.marolnaka), w:34, d:26, h:51, floors:16, color:0xf0a020, aqua:1.0,
    bandra:2, busStops:"Marol Naka", busRoutes:"Central Line -> Ghatkopar -> L1 to Marol Naka (2 hops), about 1 km",
    tenants:"G+15 Commercial, Bareshell; 13th & 14th floors, 11,331 sq. ft. carpet, Immediately.",
    posh:["Marol Naka","Sag Baug Rd offices"],
    grade:"A", gradeNote:"PRIORITY 1 in the deck. 206 seats at 4x2, 14 short of 220." },
  { id:"corporate", name:"Corporate Avenue", block:"Chakala", isOption:true, type:"slab",
    ...geoToMeters(19.110625, 72.859637), ...stn(ST.weh), w:50, d:34, h:29, floors:9, color:0x2fbf71, aqua:0.65,
    bandra:2, busStops:"WEH / Gundavali", busRoutes:"Central Line -> Ghatkopar -> L1 to WEH (2 hops), about 650 m",
    tenants:"G+8 Commercial, Furnished; 3rd and 4th floors, 12,414 sq. ft. carpet, Immediately.",
    posh:["Chakala junction plazas","WEH access"],
    grade:"A-", gradeNote:"PRIORITY 2 in the deck. The only furnished, immediate option that seats 220." },
  { id:"vaman", name:"Vaman Techno Centre", block:"Marol Metro Station", isOption:true, type:"block",
    ...geoToMeters(19.111483, 72.882235), ...stn(ST.marolnaka), w:40, d:30, h:26, floors:8, color:0xf0a020, aqua:0.45,
    bandra:2, busStops:"Marol Naka", busRoutes:"Central Line -> Ghatkopar -> L1 to Marol Naka (2 hops), about 7 min walk",
    tenants:"G+7 Commercial, Bareshell; 3rd floor, 12,300 sq. ft. carpet, Immediately.",
    posh:["Marol Makwana Rd","Marol Naka food street"],
    grade:"B", gradeNote:"Lowest per seat rate in the set; 223 seats, almost no headroom." },
  { id:"privilon", name:"Privilon", block:"Marol", isOption:true, type:"tower",
    ...geoToMeters(19.10872, 72.88040), ...stn(ST.marolnaka), w:40, d:30, h:51, floors:16, color:0xf0a020, aqua:0.1,
    bandra:2, busStops:"Marol Naka", busRoutes:"Central Line -> Ghatkopar -> L1 to Marol Naka (2 hops), right next to the station",
    tenants:"G+15 Commercial, Bareshell; Multiple floors, 11,331 sq. ft. carpet, Jan 2027.",
    posh:["Marol Naka food street","Andheri-Kurla Rd frontage"],
    grade:"A", gradeNote:"Right at the interchange, but Jan 2027 and the dearest per seat rate." },
  { id:"landmark", name:"Landmark", block:"Western Express Highway", isOption:true, type:"block",
    ...geoToMeters(19.116739, 72.855679), ...stn(ST.weh), w:44, d:34, h:22, floors:7, color:0xf0a020, aqua:0.2,
    bandra:2, busStops:"WEH station", busRoutes:"Central Line -> Ghatkopar -> L1 to WEH (2 hops), about 200 m",
    tenants:"G+6 Commercial, Furnished; 6th floor, 10,000 sq. ft. carpet, Immediately.",
    posh:["WEH junction","Highway frontage"],
    grade:"B", gradeNote:"About 200 m from WEH metro; 181 seats caps it below the ask." },
  { id:"rustomjee", name:"Rustomjee Central Park", block:"Chakala", isOption:true, type:"slab",
    ...geoToMeters(19.114042, 72.860671), ...stn(ST.weh), w:38, d:30, h:32, floors:10, color:0xf0a020, aqua:0.45,
    bandra:2, busStops:"WEH / Chakala", busRoutes:"Central Line -> Ghatkopar -> L1 to WEH (2 hops), 2 to 3 min walk",
    tenants:"G+9 Commercial, Furnished; 4th floor, 9,000 sq. ft. carpet, Feb 2027 (early vacancy can be discussed).",
    posh:["Chakala signal","Andheri-Kurla Rd corporate strip"],
    grade:"B", gradeNote:"Smallest plate in the set (163 seats) and a Feb 2027 start." },
  { id:"fulcrum", name:"Fulcrum", block:"CSMI Metro", isOption:true, type:"block",
    ...geoToMeters(19.10100, 72.87160), ...stn(ST.sahar), w:40, d:30, h:32, floors:10, color:0xd1495b, aqua:0.7,
    bandra:3, busStops:"Sahar Road (Line 3)", busRoutes:"Central Line -> Ghatkopar -> L1 -> Marol Naka -> L3 to Sahar Road (3 HOPS), about 690 m",
    tenants:"G+9 Commercial, Furnished; 1st floor, 11,700 sq. ft. carpet, Immediately.",
    posh:["Sahar hotel belt (JW, Hyatt)","T2 approach"],
    grade:"B+", gradeNote:"Fails both client filters: 212 seats and a 3-hop commute." },

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
