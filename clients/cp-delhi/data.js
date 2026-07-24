/* ============================================================================
   CONNAUGHT PLACE / DELHI CBD — DATA LAYER
   Source of truth: "Autopilot.Cannaught Place Space Option" PDF (10 options:
   7 in Connaught Place, Videocon Tower @ Jhandewalan, Milap Bhawan & Nehru
   House @ ITO). All areas, structures, condition, parking figures verbatim
   from that PDF. Carpet ≈ chargeable × stated building efficiency.

   FIT INDEX (0–10) — qualitative composite, weights below:
     Asset grade 35% · Handover condition 30% · Metro walk 20% · Parking 15%
   TIERS:
     BEST FIT = Grade A + move-in ready (furnished) in the CBD
     WORKABLE = Grade A needing fit-out, or Grade B move-in ready
     STRETCH  = bare shell fit-out risk, or satellite address + Grade B

   HONESTY NOTES:
   - All 10 footprints are real OSM polygons. WTC is snapped to the unnamed
     Babar Rd block south of the rail corridor (way/351561073) — VERIFY the
     exact building before a site visit.
   - PDF repeats one PROPERTY_ID across options — IDs not used here.
   - Station walks are straight-line from footprint centroid (OSM station
     nodes), not door-to-door.
   ============================================================================ */

const WEIGHTS = { grade: 0.35, readiness: 0.30, connectivity: 0.20, parking: 0.15 };

const FIT_COLORS = {
  "BEST FIT": "#2fbf71",
  "WORKABLE": "#f0a020",
  "STRETCH":  "#d1495b"
};

const OPTIONS = [
  { rank:1, bldg:"wtc", unit:"World Trade Center — GF (5,000 sqft chg)", floor:"GF", furn:"Furnished",
    carpet:3250, charge:5000, eff:0.65, parking:"1:1000 · FOC",
    poss:"Immediate", aqua:0.49, score:9.4, scoreLabel:"9.4 / 10", bar:94, fit:"BEST FIT", hops:0,
    note:"Lalit Group Grade A, ground floor, furnished, immediate — and the only option with free parking. Walk-in-ready CBD flagship. (Footprint snapped to the Babar Rd block — building unnamed in OSM; verify on site.)" },
  { rank:2, bldg:"videocon", unit:"Videocon Tower — 5th Flr (3,300 sqft chg)", floor:"5th", furn:"Furnished",
    carpet:2475, charge:3300, eff:0.75, parking:"1:1000 · ₹6.5k/car",
    poss:"Immediate", aqua:0.31, score:9.2, scoreLabel:"9.2 / 10", bar:92, fit:"BEST FIT", hops:1,
    note:"Primary Flagship Asset — Grade A furnished unit (3,300 sqft chargeable, 75% efficiency) 306 m from Jhandewalan Metro (Blue Line, 2 stops to Rajiv Chowk). Walk-in-ready, immediate handover." },
  { rank:3, bldg:"thapar", unit:"Thapar House — 1st Flr (5,060 sqft chg)", floor:"1st", furn:"Furnished",
    carpet:4048, charge:5060, eff:0.80, parking:"1:1000 · ₹2.5–3k/car",
    poss:"Immediate", aqua:0.43, score:9.1, scoreLabel:"9.1 / 10", bar:91, fit:"BEST FIT", hops:0,
    note:"Best efficiency in the set (80%) — 4,048 sqft carpet from 5,060 chargeable. Furnished, 1st floor on Janpath, cheapest CP parking." },
  { rank:4, bldg:"statesman", unit:"Statesman House — 12th Flr (6,200 sqft chg)", floor:"12th", furn:"Warm shell",
    carpet:4030, charge:6200, eff:0.65, parking:"1:1000 · ₹8k/car",
    poss:"Immediate", aqua:0.27, score:7.9, scoreLabel:"7.9 / 10", bar:79, fit:"WORKABLE", hops:0,
    note:"Marquee Barakhamba address, high-floor views from the 12th of a G+16 tower, 266 m to the metro. Warm shell = budget fit-out time and capex." },
  { rank:5, bldg:"dlfcapitol", unit:"DLF Capitol — 1st Flr (4,000 sqft chg)", floor:"1st", furn:"Warm shell",
    carpet:2600, charge:4000, eff:0.65, parking:"1:1000 · ₹5k/car",
    poss:"Immediate", aqua:0.43, score:7.6, scoreLabel:"7.6 / 10", bar:76, fit:"WORKABLE", hops:0,
    note:"DLF-owned Grade A on Baba Kharak Singh Marg with a huge 43,000 sqft plate. Warm shell; 434 m to Rajiv Chowk interchange." },
  { rank:6, bldg:"indraprakash", unit:"Indra Prakash — UGF (3,000 sqft chg)", floor:"UGF", furn:"Pre-furnished",
    carpet:2250, charge:3000, eff:0.75, parking:"1:1000 · ₹8k/car",
    poss:"Immediate", aqua:0.09, score:6.9, scoreLabel:"6.9 / 10", bar:69, fit:"WORKABLE", hops:0,
    note:"90 m from Barakhamba Road station — second-best metro walk in the set. Grade B and upper-ground floor cap the score; pre-furnished softens fit-out." },
  { rank:7, bldg:"kanchenjunga", unit:"Kanchenjunga — 7th Flr (6,000 sqft chg)", floor:"7th", furn:"Pre-furnished",
    carpet:4500, charge:6000, eff:0.75, parking:"1:1000 · ₹10k/car",
    poss:"Immediate", aqua:0.05, score:6.6, scoreLabel:"6.6 / 10", bar:66, fit:"WORKABLE", hops:0,
    note:"53 m to the metro — the best station walk of ALL ten options, with the biggest carpet (4,500 sqft). Grade B, individual landlord and the priciest parking (₹10k/car) hold it back." },
  { rank:8, bldg:"barakhamba", unit:"Barakhamba Tower — 3rd Flr (4,000 sqft chg)", floor:"3rd", furn:"Bare shell",
    carpet:2800, charge:4000, eff:0.70, parking:"1:1000 · ₹8k/car",
    poss:"Immediate", aqua:0.10, score:5.4, scoreLabel:"5.4 / 10", bar:54, fit:"STRETCH", hops:0,
    note:"Skipper Group Grade B, BARE shell — full fit-out capex and 3–4 months before occupancy. Great 104 m metro walk doesn't offset the readiness gap." },
  { rank:9, bldg:"nehruhouse", unit:"Nehru House — GF (3,000 sqft chg)", floor:"GF", furn:"Semi-furnished",
    carpet:2400, charge:3000, eff:0.80, parking:"MCD · ₹2k/car",
    poss:"Immediate", aqua:0.26, score:5.0, scoreLabel:"5.0 / 10", bar:50, fit:"STRETCH", hops:1,
    note:"Ground floor on Bahadur Shah Zafar Marg, 255 m from ITO station, 80% efficient — but a Grade B press-district address with MCD street parking only." },
  { rank:10, bldg:"milap", unit:"Milap Bhawan — 2nd Flr (3,300 sqft chg)", floor:"2nd", furn:"Semi-furnished",
    carpet:2640, charge:3300, eff:0.80, parking:"MCD · ₹2k/car",
    poss:"Immediate", aqua:0.48, score:4.7, scoreLabel:"4.7 / 10", bar:47, fit:"STRETCH", hops:1,
    note:"Smallest building in the set (50,000 sqft, B+GF+4) with MCD parking and a 480 m station walk. Cheapest profile — a budget fallback, not a CBD statement." }
];

/* ---------------------------------------------------------------------------
   BUILDINGS — OSM-verified centroids + footprints (see geo.js).
   stnLng/stnLat/stnName = nearest metro station (straight-line walk).
   hops = 0 (CP core, walkable), 1 (one Metro ride from the CP interchanges).
--------------------------------------------------------------------------- */
const GEO_ORIGIN = { lat: 28.6310, lon: 77.2245 };
function lngToMercX(lon){ return lon/360 + 0.5; }
function latToMercY(lat){ return 0.5 - Math.log(Math.tan(Math.PI/4 + (lat*Math.PI)/360))/(2*Math.PI); }
const _omx = lngToMercX(GEO_ORIGIN.lon), _omy = latToMercY(GEO_ORIGIN.lat);
const MER_SCALE = 1/(40075016.68*Math.cos(GEO_ORIGIN.lat*Math.PI/180));
function geoToMeters(lat, lon){
  return { lat, lng: lon, x:(lngToMercX(lon)-_omx)/MER_SCALE, z:(latToMercY(lat)-_omy)/MER_SCALE };
}

const ST = {
  rajivchowk: { lng:77.21931, lat:28.63271, name:"Rajiv Chowk (Blue × Yellow interchange)" },
  barakhamba: { lng:77.22525, lat:28.62981, name:"Barakhamba Road (Blue Line)" },
  mandihouse: { lng:77.23420, lat:28.62561, name:"Mandi House (Blue × Violet interchange)" },
  janpath:    { lng:77.21926, lat:28.62405, name:"Janpath (Violet Line)" },
  jhandewalan:{ lng:77.19992, lat:28.64432, name:"Jhandewalan (Blue Line)" },
  ito:        { lng:77.24104, lat:28.62819, name:"ITO (Violet Line)" },
};
function stn(s){ return { stnLng:s.lng, stnLat:s.lat, stnName:s.name }; }

const BUILDINGS = [
  { id:"wtc", name:"World Trade Center", block:"Babar Rd · CP", isOption:true, type:"slab",
    ...geoToMeters(28.62990, 77.23329), ...stn(ST.mandihouse), w:55, d:42, h:20, floors:6, color:0x2fbf71, aqua:0.49,
    bandra:0, busStops:"Mandi House · Barakhamba Rd", busRoutes:"Blue/Violet via Mandi House (485 m) · CP core walkable",
    tenants:"Lalit Group Grade A, 1.5 L sqft, 2B+GF+5, 25,000 sqft plates; GF furnished unit on offer.",
    posh:["Bengali Market","The Lalit · Barakhamba Ave"],
    grade:"A", gradeNote:"Furnished ground floor with FOC parking — the walk-in-ready CBD flagship.",
    pdf:{ "Ownership":"Lalit Group", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"1,50,000 sqft", "Asset class":"Grade A", "Building structure":"2B + GF + 5",
      "Typical floor plate":"25,000 sqft", "Building efficiency":"65%", "Floor unit offered":"GF",
      "Chargeable area":"5,000 sqft", "Handover condition":"Furnished", "Car parking ratio":"1:1000",
      "Car parking charges":"FOC" },
    transit:[
      { ic:"B", cls:"aqua", text:"<b>485 m</b> to Mandi House (Blue × Violet) · ~7 min walk", sub:"Also Barakhamba Road (Blue) 785 m · ITO (Violet) 780 m" },
      { ic:"M", cls:"yellow", text:"Rajiv Chowk interchange — 2 stops on the Blue Line", sub:"Yellow Line access to Gurgaon & North Delhi" },
      { ic:"W", cls:"bus", text:"CP core walkable · Bengali Market ~350 m", sub:"New Delhi railway station ~2.5 km" } ],
    transitDetails: {
      metro: { name: "Mandi House Metro Station (Gate 1)", line: "Blue × Violet", distText: "549 m", durationText: "8 min walk", mode: "walking", icon: "🚇", coords: [77.23420, 28.62561] },
      railway: { name: "New Delhi Railway Station (NDLS)", distText: "2.5 km", durationText: "8 min drive", mode: "driving", icon: "🚆", coords: [77.22150, 28.64280] },
      bus: { name: "Babar Road / Bengali Market Bus Stop", distText: "120 m", durationText: "2 min walk", mode: "walking", icon: "🚌", routes: ["374", "410", "440"], coords: [77.23350, 28.62980] }
    } },
  { id:"thapar", name:"Thapar House", block:"Janpath", isOption:true, type:"block",
    ...geoToMeters(28.62755, 77.21735), ...stn(ST.janpath), w:50, d:39, h:16, floors:5, color:0x2fbf71, aqua:0.43,
    bandra:0, busStops:"Janpath", busRoutes:"Violet Line via Janpath (431 m) · Rajiv Chowk 605 m",
    tenants:"Thapar Group Grade A, GF+UGF+3, 21,000 sqft plates, 80% efficiency; furnished 1st floor.",
    posh:["Janpath Market","Inner Circle restaurants"],
    grade:"A", gradeNote:"Best efficiency in the set — most usable carpet per chargeable sqft.",
    pdf:{ "Ownership":"Thapper Group", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"1,00,000 sqft", "Asset class":"Grade A", "Building structure":"GF + UGF + 3",
      "Typical floor plate":"21,000 sqft", "Building efficiency":"80%", "Floor unit offered":"1F",
      "Chargeable area":"5,060 sqft", "Handover condition":"Furnished", "Car parking ratio":"1:1000",
      "Car parking charges":"₹2,500–3,000 / car" },
    transit:[
      { ic:"V", cls:"yellow", text:"<b>431 m</b> to Janpath (Violet) · ~6 min walk", sub:"1 stop to Mandi House interchange (Violet ↔ Blue)" },
      { ic:"B", cls:"aqua", text:"Rajiv Chowk (Blue × Yellow) 605 m", sub:"Airport Express at Shivaji Stadium ~900 m" },
      { ic:"W", cls:"bus", text:"Janpath Market at the doorstep", sub:"Inner Circle restaurants ~400 m" } ],
    transitDetails: {
      metro: { name: "Janpath Metro Station (Gate 2)", line: "Violet Line", distText: "431 m", durationText: "6 min walk", mode: "walking", icon: "🚇", coords: [77.21926, 28.62405] },
      railway: { name: "Shivaji Stadium (Airport Express)", distText: "900 m", durationText: "3 min drive", mode: "driving", icon: "🚆", coords: [77.21480, 28.63350] },
      bus: { name: "Janpath Road Bus Stop", distText: "90 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["522", "604", "620"], coords: [77.21820, 28.62700] }
    } },
  { id:"statesman", name:"Statesman House", block:"Barakhamba Rd", isOption:true, type:"tower",
    ...geoToMeters(28.63029, 77.22258), ...stn(ST.barakhamba), w:40, d:30, h:54, floors:17, color:0xf0a020, aqua:0.27,
    bandra:0, busStops:"Barakhamba Road", busRoutes:"Blue Line via Barakhamba Rd (266 m) · Rajiv Chowk 418 m",
    tenants:"Ansal Group Grade A, 2.2 L sqft, G+16 — the marquee tower of Barakhamba Road; 12th-floor warm shell.",
    posh:["Inner Circle","Agrasen ki Baoli heritage lane"],
    grade:"A", gradeNote:"High-floor CBD views; warm shell means fit-out before move-in.",
    pdf:{ "Ownership":"Anshal Group", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"2,20,000 sqft", "Asset class":"Grade A", "Building structure":"2B + GF + 16",
      "Typical floor plate":"13,000 sqft", "Building efficiency":"65%", "Floor unit offered":"12th",
      "Chargeable area":"6,200 sqft", "Handover condition":"Warm shell", "Car parking ratio":"1:1000",
      "Car parking charges":"₹8,000 / car" },
    transit:[
      { ic:"B", cls:"aqua", text:"<b>266 m</b> to Barakhamba Road (Blue) · ~4 min walk", sub:"Rajiv Chowk (Blue × Yellow) 418 m" },
      { ic:"M", cls:"yellow", text:"1 stop to Rajiv Chowk or Mandi House interchanges", sub:"Blue Line both directions" },
      { ic:"W", cls:"bus", text:"Outer Circle frontage", sub:"Agrasen ki Baoli heritage lane behind" } ],
    transitDetails: {
      metro: { name: "Barakhamba Road Metro (Gate 2)", line: "Blue Line", distText: "120 m", durationText: "2 min walk", mode: "walking", icon: "🚇", coords: [77.22380, 28.63020] },
      railway: { name: "New Delhi Railway Station (NDLS)", distText: "1.8 km", durationText: "6 min drive", mode: "driving", icon: "🚆", coords: [77.22150, 28.64280] },
      bus: { name: "Statesman House Bus Stop", distText: "40 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["433", "440", "522", "620"], coords: [77.22220, 28.63060] }
    } },
  { id:"dlfcapitol", name:"DLF Capitol", block:"Baba Kharak Singh Marg", isOption:true, type:"slab",
    ...geoToMeters(28.63342, 77.21493), ...stn(ST.rajivchowk), w:70, d:57, h:26, floors:8, color:0xf0a020, aqua:0.43,
    bandra:0, busStops:"Rajiv Chowk · Shivaji Stadium", busRoutes:"Blue/Yellow via Rajiv Chowk (434 m) · Airport Exp at Shivaji Stadium",
    tenants:"DLF Grade A, 2B+GF+7 with an unusually large 43,000 sqft plate; 1st-floor warm shell.",
    posh:["Hanuman Mandir","Connaught Place Outer Circle"],
    grade:"A", gradeNote:"DLF covenant + the double-interchange at Rajiv Chowk; needs fit-out.",
    pdf:{ "Ownership":"DLF Group", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"85,000 sqft", "Asset class":"Grade A", "Building structure":"2B + GF + 7",
      "Typical floor plate":"43,000 sqft", "Building efficiency":"65%", "Floor unit offered":"1F",
      "Chargeable area":"4,000 sqft", "Handover condition":"Warm shell", "Car parking ratio":"1:1000",
      "Car parking charges":"₹5,000 / car" },
    transit:[
      { ic:"B", cls:"aqua", text:"<b>434 m</b> to Rajiv Chowk (Blue × Yellow) · ~6 min walk", sub:"Two-line interchange — Gurgaon & Noida direct" },
      { ic:"A", cls:"rail", text:"Airport Express at Shivaji Stadium 614 m", sub:"IGI T3 in ~20 min" },
      { ic:"W", cls:"bus", text:"Hanuman Mandir & Outer Circle at the doorstep", sub:"Baba Kharak Singh Marg frontage" } ],
    transitDetails: {
      metro: { name: "Rajiv Chowk Metro (Gate 1)", line: "Blue × Yellow", distText: "434 m", durationText: "6 min walk", mode: "walking", icon: "🚇", coords: [77.21931, 28.63271] },
      railway: { name: "Shivaji Stadium (Airport Express)", distText: "150 m", durationText: "2 min walk", mode: "walking", icon: "🚆", coords: [77.21480, 28.63350] },
      bus: { name: "BKS Marg Bus Stop", distText: "50 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["73", "522", "859"], coords: [77.21460, 28.63320] }
    } },
  { id:"videocon", name:"Videocon Tower", block:"Jhandewalan", isOption:true, type:"tower",
    ...geoToMeters(28.64511, 77.20292), ...stn(ST.jhandewalan), w:42, d:33, h:45, floors:14, color:0x2fbf71, aqua:0.31,
    bandra:1, busStops:"Jhandewalan", busRoutes:"Blue Line via Jhandewalan (306 m) — 2 stops to Rajiv Chowk",
    tenants:"Grade A 2.5 L sqft tower, 2B+GF+13; furnished 5th-floor unit.",
    posh:["Jhandewalan Hanuman Mandir","Karol Bagh retail belt"],
    grade:"A", gradeNote:"Primary Flagship Asset — Grade A + Furnished move-in ready.",
    pdf:{ "Ownership":"Videocon", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"2,50,000 sqft", "Asset class":"Grade A", "Building structure":"2B + GF + 13",
      "Typical floor plate":"15,000 sqft", "Building efficiency":"75%", "Floor unit offered":"5F",
      "Chargeable area":"3,300 sqft", "Handover condition":"Furnished", "Car parking ratio":"1:1000",
      "Car parking charges":"₹6,500 / car" },
    transit:[
      { ic:"B", cls:"aqua", text:"<b>306 m</b> to Jhandewalan (Blue) · ~4 min walk", sub:"2 stops to Rajiv Chowk (Blue × Yellow)" },
      { ic:"B", cls:"aqua", text:"R K Ashram Marg (Blue) 855 m", sub:"Blue Line spine into the CBD" },
      { ic:"W", cls:"bus", text:"Jhandewalan Hanuman Mandir landmark", sub:"Karol Bagh retail belt nearby" } ],
    transitDetails: {
      metro: { name: "Jhandewalan Metro (Gate 2)", line: "Blue Line", distText: "306 m", durationText: "4 min walk", mode: "walking", icon: "🚇", coords: [77.19992, 28.64432] },
      railway: { name: "New Delhi Railway Station (NDLS)", distText: "2.0 km", durationText: "7 min drive", mode: "driving", icon: "🚆", coords: [77.21650, 28.64350] },
      bus: { name: "Jhandewalan Link Road Bus Stop", distText: "100 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["753", "966", "181"], coords: [77.20180, 28.64460] }
    } },
  { id:"indraprakash", name:"Indra Prakash", block:"21 Barakhamba Rd", isOption:true, type:"tower",
    ...geoToMeters(28.62937, 77.22448), ...stn(ST.barakhamba), w:37, d:30, h:42, floors:13, color:0xf0a020, aqua:0.09,
    bandra:0, busStops:"Barakhamba Road (90 m)", busRoutes:"Blue Line at the doorstep — 90 m to Barakhamba Rd",
    tenants:"Ansal Group Grade B, 2B+GF+12; pre-furnished upper-ground unit.",
    posh:["Barakhamba corporate strip","Inner Circle"],
    grade:"B+", gradeNote:"Doorstep metro; Grade B and UGF floor keep it mid-table.",
    pdf:{ "Ownership":"Anshal Group", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"1,30,000 sqft", "Asset class":"Grade B", "Building structure":"2B + GF + 12",
      "Typical floor plate":"12,000 sqft", "Building efficiency":"75%", "Floor unit offered":"UGF",
      "Chargeable area":"3,000 sqft", "Handover condition":"Pre-furnished", "Car parking ratio":"1:1000",
      "Car parking charges":"₹8,000 / car" },
    transit:[
      { ic:"B", cls:"aqua", text:"<b>90 m</b> to Barakhamba Road (Blue) · ~1 min walk", sub:"Metro at the doorstep" },
      { ic:"M", cls:"yellow", text:"1 stop to Rajiv Chowk (Blue × Yellow)", sub:"1 stop to Mandi House (Blue × Violet)" },
      { ic:"W", cls:"bus", text:"Barakhamba corporate strip", sub:"Inner Circle ~600 m" } ],
    transitDetails: {
      metro: { name: "Barakhamba Road Metro (Gate 1)", line: "Blue Line", distText: "160 m", durationText: "2 min walk", mode: "walking", icon: "🚇", coords: [77.22560, 28.62990] },
      railway: { name: "New Delhi Railway Station (NDLS)", distText: "1.9 km", durationText: "6 min drive", mode: "driving", icon: "🚆", coords: [77.22150, 28.64280] },
      bus: { name: "Barakhamba Road Bus Stop", distText: "40 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["433", "522", "620"], coords: [77.22470, 28.62970] }
    } },
  { id:"kanchenjunga", name:"Kanchenjunga", block:"18 Barakhamba Rd", isOption:true, type:"tower",
    ...geoToMeters(28.63019, 77.22557), ...stn(ST.barakhamba), w:37, d:30, h:35, floors:11, color:0xf0a020, aqua:0.05,
    bandra:0, busStops:"Barakhamba Road (53 m)", busRoutes:"Blue Line at the doorstep — 53 m, best walk of all 10 options",
    tenants:"Individual landlord, Grade B, 2B+GF+10; pre-furnished 7th floor, biggest carpet in the set.",
    posh:["Barakhamba corporate strip","Statesman House cluster"],
    grade:"B+", gradeNote:"Best metro walk + biggest carpet; individual ownership and ₹10k parking to negotiate.",
    pdf:{ "Ownership":"Individual", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"1,30,000 sqft", "Asset class":"Grade B", "Building structure":"2B + GF + 10",
      "Typical floor plate":"12,000 sqft", "Building efficiency":"75%", "Floor unit offered":"7F",
      "Chargeable area":"6,000 sqft", "Handover condition":"Pre-furnished", "Car parking ratio":"1:1000",
      "Car parking charges":"₹10,000 / car" },
    transit:[
      { ic:"B", cls:"aqua", text:"<b>53 m</b> to Barakhamba Road (Blue) — at the doorstep", sub:"Best station walk of all 10 options" },
      { ic:"M", cls:"yellow", text:"1 stop to Rajiv Chowk (Blue × Yellow)", sub:"1 stop to Mandi House (Blue × Violet)" },
      { ic:"W", cls:"bus", text:"Barakhamba corporate strip", sub:"Statesman House cluster adjacent" } ],
    transitDetails: {
      metro: { name: "Barakhamba Road Metro (Gate 1)", line: "Blue Line", distText: "70 m", durationText: "1 min walk", mode: "walking", icon: "🚇", coords: [77.22560, 28.62990] },
      railway: { name: "New Delhi Railway Station (NDLS)", distText: "2.0 km", durationText: "6 min drive", mode: "driving", icon: "🚆", coords: [77.22150, 28.64280] },
      bus: { name: "Kanchenjunga Bus Stop", distText: "50 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["433", "440", "522"], coords: [77.22460, 28.63030] }
    } },
  { id:"barakhamba", name:"Barakhamba Tower", block:"22 Barakhamba Rd", isOption:true, type:"tower",
    ...geoToMeters(28.63064, 77.22477), ...stn(ST.barakhamba), w:34, d:27, h:35, floors:11, color:0xd1495b, aqua:0.10,
    bandra:0, busStops:"Barakhamba Road (104 m)", busRoutes:"Blue Line via Barakhamba Rd (104 m)",
    tenants:"Skipper Group Grade B, 2B+GF+10, 10,000 sqft plates; 3rd-floor BARE shell.",
    posh:["Barakhamba corporate strip"],
    grade:"B", gradeNote:"Bare shell = full fit-out capex and lead time — the readiness outlier.",
    pdf:{ "Ownership":"Skipper Group", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"1,10,000 sqft", "Asset class":"Grade B", "Building structure":"2B + GF + 10",
      "Typical floor plate":"10,000 sqft", "Building efficiency":"70%", "Floor unit offered":"3F",
      "Chargeable area":"4,000 sqft", "Handover condition":"Bare shell", "Car parking ratio":"1:1000",
      "Car parking charges":"₹8,000 / car" },
    transit:[
      { ic:"B", cls:"aqua", text:"<b>104 m</b> to Barakhamba Road (Blue) · ~2 min walk", sub:"Rajiv Chowk (Blue × Yellow) 580 m" },
      { ic:"M", cls:"yellow", text:"1 stop to Rajiv Chowk or Mandi House interchanges", sub:"Blue Line both directions" },
      { ic:"W", cls:"bus", text:"Barakhamba corporate strip", sub:"22 Barakhamba Road address" } ],
    transitDetails: {
      metro: { name: "Barakhamba Road Metro (Gate 1)", line: "Blue Line", distText: "140 m", durationText: "2 min walk", mode: "walking", icon: "🚇", coords: [77.22560, 28.62990] },
      railway: { name: "New Delhi Railway Station (NDLS)", distText: "1.9 km", durationText: "6 min drive", mode: "driving", icon: "🚆", coords: [77.22150, 28.64280] },
      bus: { name: "Barakhamba Fire Station Bus Stop", distText: "50 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["433", "522"], coords: [77.22460, 28.63030] }
    } },
  { id:"nehruhouse", name:"Nehru House", block:"BSZ Marg · ITO", isOption:true, type:"block",
    ...geoToMeters(28.63041, 77.24168), ...stn(ST.ito), w:37, d:30, h:16, floors:5, color:0xd1495b, aqua:0.26,
    bandra:1, busStops:"ITO (255 m)", busRoutes:"Violet Line via ITO (255 m) — 1 stop to Mandi House interchange",
    tenants:"Bal Bhawan-owned Grade B, B+GF+4; semi-furnished ground floor.",
    posh:["BSZ Marg press belt","Pragati Maidan"],
    grade:"B", gradeNote:"Press-district economy; MCD street parking only.",
    pdf:{ "Ownership":"Bal Bhawan", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"90,000 sqft", "Asset class":"Grade B", "Building structure":"B + GF + 4",
      "Typical floor plate":"12,000 sqft", "Building efficiency":"80%", "Floor unit offered":"GF",
      "Chargeable area":"3,000 sqft", "Handover condition":"Semi-furnished", "Car parking ratio":"MCD parking",
      "Car parking charges":"₹2,000 / car" },
    transit:[
      { ic:"V", cls:"yellow", text:"<b>255 m</b> to ITO (Violet) · ~4 min walk", sub:"1 stop to Mandi House (Violet ↔ Blue)" },
      { ic:"B", cls:"aqua", text:"Blue Line via Mandi House interchange", sub:"Pragati Maidan across BSZ Marg" },
      { ic:"W", cls:"bus", text:"BSZ Marg press belt", sub:"4 Bahadur Shah Zafar Marg address" } ],
    transitDetails: {
      metro: { name: "ITO Metro Station (Gate 3)", line: "Violet Line", distText: "255 m", durationText: "4 min walk", mode: "walking", icon: "🚇", coords: [77.24104, 28.62819] },
      railway: { name: "New Delhi Railway Station (NDLS)", distText: "2.8 km", durationText: "9 min drive", mode: "driving", icon: "🚆", coords: [77.22150, 28.64280] },
      bus: { name: "BSZ Marg Press District Bus Stop", distText: "40 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["260", "273", "418"], coords: [77.24150, 28.63050] }
    } },
  { id:"milap", name:"Milap Bhawan", block:"BSZ Marg · ITO", isOption:true, type:"block",
    ...geoToMeters(28.63249, 77.24149), ...stn(ST.ito), w:31, d:24, h:16, floors:5, color:0xd1495b, aqua:0.48,
    bandra:1, busStops:"ITO (480 m)", busRoutes:"Violet Line via ITO (480 m)",
    tenants:"Milap Group Grade B, 50,000 sqft, B+GF+4; semi-furnished 2nd floor.",
    posh:["BSZ Marg press belt","Daryaganj book market (Sun)"],
    grade:"B", gradeNote:"Smallest, cheapest profile — budget fallback.",
    pdf:{ "Ownership":"Milap Group", "Type of building":"Commercial", "Handover timeline":"Immediate",
      "Total building size":"50,000 sqft", "Asset class":"Grade B", "Building structure":"B + GF + 4",
      "Typical floor plate":"8,000 sqft", "Building efficiency":"80%", "Floor unit offered":"2F",
      "Chargeable area":"3,300 sqft", "Handover condition":"Semi-furnished", "Car parking ratio":"MCD parking",
      "Car parking charges":"₹2,000 / car" },
    transit:[
      { ic:"V", cls:"yellow", text:"<b>480 m</b> to ITO (Violet) · ~7 min walk", sub:"1 stop to Mandi House (Violet ↔ Blue)" },
      { ic:"B", cls:"aqua", text:"Blue Line via Mandi House interchange", sub:"Delhi Gate (Violet) ~900 m" },
      { ic:"W", cls:"bus", text:"BSZ Marg press belt", sub:"Daryaganj Sunday book market nearby" } ],
    transitDetails: {
      metro: { name: "ITO Metro Station (Gate 2)", line: "Violet Line", distText: "480 m", durationText: "7 min walk", mode: "walking", icon: "🚇", coords: [77.24104, 28.62819] },
      railway: { name: "New Delhi Railway Station (NDLS)", distText: "2.6 km", durationText: "8 min drive", mode: "driving", icon: "🚆", coords: [77.22150, 28.64280] },
      bus: { name: "Milap Niketan Bus Stop", distText: "30 m", durationText: "1 min walk", mode: "walking", icon: "🚌", routes: ["260", "273", "418"], coords: [77.24150, 28.63240] }
    } },

  // ---- Context landmarks (not selectable) ----
  { id:"rajivchowk_stn", name:"Rajiv Chowk (Blue × Yellow)", block:"Connaught Place", type:"slab",
    ...geoToMeters(28.63271, 77.21931), w:70, d:24, h:10, floors:2, color:0x14b8c4 },
  { id:"barakhamba_stn", name:"Barakhamba Road Station (Blue)", block:"Barakhamba", type:"slab",
    ...geoToMeters(28.62981, 77.22525), w:60, d:20, h:10, floors:2, color:0x14b8c4 },
  { id:"mandihouse_stn", name:"Mandi House (Blue × Violet)", block:"Mandi House", type:"slab",
    ...geoToMeters(28.62561, 77.23420), w:60, d:20, h:10, floors:2, color:0x14b8c4 },
  { id:"janpath_stn", name:"Janpath Station (Violet)", block:"Janpath", type:"slab",
    ...geoToMeters(28.62405, 77.21926), w:60, d:20, h:10, floors:2, color:0x14b8c4 },
  { id:"jhandewalan_stn", name:"Jhandewalan Station (Blue)", block:"Jhandewalan", type:"slab",
    ...geoToMeters(28.64432, 77.19992), w:60, d:20, h:10, floors:2, color:0x14b8c4 },
  { id:"ito_stn", name:"ITO Station (Violet)", block:"ITO", type:"slab",
    ...geoToMeters(28.62819, 77.24104), w:60, d:20, h:10, floors:2, color:0x14b8c4 },
];

/* ---------------------------------------------------------------------------
   METRO — Blue Line spine (Jhandewalan → Mandi House) + Violet Line arm
   (Janpath → ITO). Alignments indicative; stations placed on OSM nodes.
--------------------------------------------------------------------------- */
const METRO = {
  aqua: {
    name:"Blue Line — Dwarka ↔ Noida (CP spine)",
    color:0x14b8c4, status:"OPERATIONAL — the CBD spine",
    statusNote:"Runs under the CBD: Jhandewalan → R K Ashram → Rajiv Chowk (Yellow interchange) → Barakhamba Road → Mandi House (Violet interchange). Every CP-core option is ≤550 m from one of its stations; three are under 110 m.",
    path:[[ -1500,-300 ]],
    stations:[ {name:"Rajiv Chowk — Blue × Yellow interchange", x:-500, z:-120, interchange:true} ]
  },
  yellow: {
    name:"Violet Line — Janpath · Mandi House · ITO arm",
    color:0xf2c200, status:"OPERATIONAL — serves Janpath & the ITO options",
    statusNote:"Thapar House rides from Janpath; Nehru House and Milap Bhawan sit off ITO station — one stop from the Mandi House interchange back into the Blue Line spine.",
    path:[[600,-900]],
    stations:[ {name:"ITO (Violet)", x:1620, z:-560}, {name:"Janpath (Violet)", x:-510, z:770} ]
  }
};

/* Food circles, markets & hubs — the "what clicks" layer */
const NEIGHBORHOODS = [
  { name:"CP Inner Circle", ...geoToMeters(28.63155, 77.21967), tag:"Restaurants · retail · the colonnades" },
  { name:"Janpath Market", ...geoToMeters(28.62660, 77.21850), tag:"Street retail · lunch walk" },
  { name:"Bengali Market", ...geoToMeters(28.63340, 77.23480), tag:"Iconic chaat & sweets · 5 min from WTC" },
  { name:"Agrasen ki Baoli", ...geoToMeters(28.62624, 77.22474), tag:"Heritage stepwell · Barakhamba lane" },
  { name:"BSZ Marg press belt", ...geoToMeters(28.63100, 77.24200), tag:"Media district · ITO" },
  { name:"Jhandewalan Hanuman Mandir", ...geoToMeters(28.64360, 77.20120), tag:"Landmark · Karol Bagh edge" }
];

const RIVER_PATH = [];

const META = {
  client:"Delhi CBD mandate",
  business:"CBD office — 3,000–6,200 sqft chargeable across Connaught Place, Jhandewalan & ITO",
  brief:"Grade A preference · move-in-ready favoured · walkable Metro · parking economics matter (₹0–10k/car spread) · CP pin-code premium vs satellite value",
  prepared:"Autopilot Offices · Connaught Place space options (Jul 2026)",
  winner:"wtc"
};

window.BKC = { WEIGHTS, FIT_COLORS, OPTIONS, BUILDINGS, METRO, NEIGHBORHOODS, RIVER_PATH, META };
