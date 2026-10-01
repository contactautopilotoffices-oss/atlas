/* ============================================================================
   ATLAS · INDORE OFFICE STUDY · data layer

   Three kinds of fact live here, and they are kept apart on purpose so a
   reader can always tell which is which:

     DECK     taken verbatim from "Autopilot Indore First cut inventory option"
              (BD Autopilot, Canva, 29 Sep 2026, 19 pages). Every field the
              deck prints for an option is carried over, including its typos,
              and the page it came from is recorded.
     RESEARCH public sources gathered for this study, each with a URL, a date
              and a confidence word. Nothing here is from the deck.
     MAP      positions on the map. The deck gives no coordinates (its "Map
              View" page links to a Google My Maps file this build could not
              read), so every point carries a precision class and a note.

   Where the deck and research disagree, both are kept and the disagreement is
   written into CAVEATS rather than silently resolved.
   ============================================================================ */
"use strict";

window.IND_META = {
  title: "Indore Office Study",
  sub: "BPO / KPO / IT-ITeS · market overview and first-cut inventory",
  deck: "Autopilot Indore First cut inventory option (BD Autopilot, 29 Sep 2026)",
  deckPages: 19,
  asOf: "2026-09-30",
  mapLink: "https://www.google.com/maps/d/u/0/edit?mid=15lwh4XAlLak_fVroUZ1UFavPGHfIsQo&usp=sharing",
  center: [75.862, 22.748],
  zoom: 11.6
};

/* -------------------------------------------------------------- EXISTING --
   The building in use today. Every option is read against it: how far the
   move is, and what changes for metro access, talent reach and rivals.
   Position taken from the Google Maps place shared by the BD team. */
window.IND_EXISTING = {
  id: "nrk-star", name: "NRK Star", label: "Existing building",
  locality: "Vijay Nagar", micro: "sbd",
  lat: 22.7460077, lng: 75.8926233, precision: "building",
  occupant: "Altruist Technologies (BPO), 3rd to 5th floors",
  geoNote: "Google Maps place pin for NRK Star, shared by the BD team.",
  geoSrc: "https://www.google.com/maps/place/NRK+Star/@22.7460077,75.8926233,17z"
};

/* ------------------------------------------------------------------ DECK --
   The ten shortlisted options. `n` is our running number. The deck numbers
   the last two pages "Option 02" and "Option 03" again, so its own label is
   kept in `deckLabel` and the renumbering is listed in CAVEATS. */
window.IND_OPTIONS = [
  {
    id: "hub", n: 1, deckLabel: "Option 01", page: 8, photo: "hub.jpg",
    name: "The Hub", keyPointsName: "The Hub",
    locality: "Vijay Nagar", micro: "sbd",
    grade: "B",
    handover: "Immediate", handoverDetail: "Immediate", handoverISO: null, handoverKind: "ready",
    floors: "2nd (Half) & 3rd",
    superArea: 42000, carpetArea: 28000, areaNote: "42,000 SF super built-up · 28,000 SF built-up/carpet area (+/-3%)",
    condition: "Bare Shell",
    floorPlate: 30000,
    efficiency: 67,
    structure: "1B + G + 5 floors", buildingTotal: 150000, structureText: "1B + G + 5 floors · 1,50,000 SF total",
    parkingRatio: "1 per 3500 SF and two wheelers common ( At best we can get 12 Car parks Dedicated )",
    parkingPer1000: 1000 / 3500, parkingDedicated: 12,
    parkingCharges: "To Be Discussed",
    amenities: ["24*7 Security", "Car Parking", "F&B Facility", "Fire Protection System", "Lifts", "Power Backup", "Sprinkler System"],
    commute: "Hira Nagar Metro Station / Bapat Chauraha Metro Station", commuteDist: "1.5 Km Each", commuteM: 1500,
    lat: 22.762262, lng: 75.886857, precision: "street",
    geoNote: "Scheme 78 Part 2, Vijay Nagar (Mappls place pin for The Hub parking).",
    geoSrc: "https://www.mappls.com/place-the+hub+parking-the+hub-near+vrindavan+restraunt-scheme+no+78-part+2-vijay+nagar-indore-madhya+pradesh-452010-JQ0JUY@zdata=MjIuNzYyMjYyKzc1Ljg4Njg1NysxNytKUTBKVVkrK25yed"
  },
  {
    id: "metro-tower", n: 2, deckLabel: "Option 02", page: 9, photo: "metro-tower.jpg",
    name: "Metro Tower", keyPointsName: "Metro Tower",
    locality: "Near Satyasai Square – Vijay Nagar", micro: "sbd",
    grade: "B",
    handover: "90 days from LOI", handoverDetail: "90 days from LOI", handoverISO: null, handoverKind: "loi90",
    floors: "5th & 6th",
    superArea: 32400, carpetArea: 24000, areaNote: "32,400 SF super built-up · 24,000 SF Built-up/carpet area (+/-3%)",
    condition: "Bare Shell",
    floorPlate: 25000,
    efficiency: 74,
    structure: "G + 8 floors", buildingTotal: 225000, structureText: "G + 8 floors · 2,25,000 SF total",
    parkingRatio: "Common First Come First Serve Basis on Ground Floor",
    parkingPer1000: null, parkingDedicated: 0,
    parkingCharges: "NA",
    amenities: ["Lifts", "24*7 Security"],
    commute: "Vijay Nagar Chauraha Metro Station", commuteDist: "550 m", commuteM: 550,
    lat: 22.753333, lng: 75.896944, precision: "building",
    geoNote: "Metro Tower, Scheme 54, Vijay Nagar (Wikimapia polygon).",
    geoSrc: "http://wikimapia.org/24082769/Metro-Tower"
  },
  {
    id: "princes", n: 3, deckLabel: "Option 03", page: 10, photo: "princes-midtown-crest.jpg",
    name: "Princes’ Midtown Crest", keyPointsName: "Princess Midtown Crest",
    locality: "Near Fairfield Marriott – Ring Road", micro: "sbd",
    grade: "A",
    handover: "December 2026", handoverDetail: "December 2026 (CC received)", handoverISO: "2026-12-01", handoverKind: "date",
    floors: "All floors available",
    superArea: 46728, carpetArea: 31152, areaNote: "46,728 SF super built-up · 31,152 SF built-up/carpet area (+/-3%)",
    condition: "Bare Shell",
    floorPlate: 11682,
    efficiency: 67,
    structure: "2B + G + 1P + S + 7 floors", buildingTotal: 81774, structureText: "2B + G + 1P + S + 7 floors · 81,774 SF total",
    parkingRatio: "Common First Come First Serve Basis",
    parkingPer1000: null, parkingDedicated: 0,
    parkingCharges: "Rs. 5000 per Car",
    amenities: ["24*7 Security", "Car Parking", "Fire Protection System", "Lifts", "Power Backup", "Sprinkler System"],
    commute: "Malviya Nagar Chauraha Metro Station", commuteDist: "170 m", commuteM: 170,
    lat: 22.7510, lng: 75.9018, precision: "locality",
    geoNote: "Placed 170 m from Malviya Nagar Chauraha (Radisson Square) station as the deck states. The deck also says 'near Fairfield Marriott', which public listings put about 700 m further north on Ring Road. Confirm the plot.",
    geoSrc: ""
  },
  {
    id: "apollo", n: 4, deckLabel: "Option 04", page: 11, photo: "apollo-gold-plaza.jpg",
    name: "Apollo Gold Plaza", keyPointsName: "Apollo Gold Plaza", deckAltName: "Apollo Goldplaza",
    locality: "Near DB City – Nipania", micro: "sbd",
    grade: "B",
    handover: "Immediate", handoverDetail: "Immediate", handoverISO: null, handoverKind: "ready",
    floors: "7th (half floor) & 8th (full floor)",
    superArea: 53428, carpetArea: 36847, areaNote: "53,428 SF super built-up · 36,847 SF built-up/Carpet area (+/-3%)",
    condition: "Bare Shell",
    floorPlate: 35600,
    efficiency: 69,
    structure: "1B + G + 8 floors", buildingTotal: 212480, structureText: "1B + G + 8 floors · 2,12,480 SF total",
    parkingRatio: "1: 1500 SF per car & Two wheeler common",
    parkingPer1000: 1000 / 1500, parkingDedicated: null,
    parkingCharges: "To be discussed",
    amenities: ["24*7 Security", "Car Parking", "Fire Protection System", "Lifts", "Power Backup", "Sprinkler System"],
    commute: "Malviya Nagar Chauraha Metro Station", commuteDist: "3 km", commuteM: 3000,
    lat: 22.7635, lng: 75.9245, precision: "locality",
    geoNote: "Nipania, opposite Apollo DB City township, about 3 km from Malviya Nagar Chauraha as the deck states. Plot not confirmed.",
    geoSrc: "https://wikimapia.org/17050368/Apollo-DB-city"
  },
  {
    id: "bcm", n: 5, deckLabel: "Option 05", page: 12, photo: "bcm-zodiac.jpg",
    name: "BCM Zodiac", keyPointsName: "BCM Zodiac",
    locality: "Tulsi Nagar Road – Nipania", micro: "sbd",
    grade: "A",
    handover: "March 2027", handoverDetail: "March 2027 (Under Construction)", handoverISO: "2027-03-01", handoverKind: "date",
    floors: "6th",
    superArea: 60666, carpetArea: 39527, areaNote: "60,666 SF super built-up · 39,527 SF carpet/built up area (+/-3%)",
    condition: "Bare Shell",
    floorPlate: 111842,
    efficiency: 67,
    structure: "1B + G + UG + 8 floors", buildingTotal: 1118420, structureText: "1B + G + UG + 8 floors · 11,18,420 SF total",
    parkingRatio: "1 Car park & 5 two wheeler in 1000 SF",
    parkingPer1000: 1, parkingDedicated: null,
    parkingCharges: "Rs- 5000/- per car",
    amenities: ["24*7 Security", "Car Parking", "Fire Protection System", "Lifts", "Power Backup", "Sprinkler System"],
    commute: "Malviya Nagar Chauraha Metro Station", commuteDist: "2 km", commuteM: 2000,
    lat: 22.7590, lng: 75.9130, precision: "locality",
    geoNote: "Tulsi Nagar Road, Nipania (developer listing, opposite Advanced Academy), about 2 km from Malviya Nagar Chauraha as the deck states. Plot not confirmed.",
    geoSrc: "https://houssed.com/commercial/indore/bcm-group/bcm-zodiac-149694"
  },
  {
    id: "nrk", n: 6, deckLabel: "Option 06", page: 13, photo: "nrk-cyber-park.jpg",
    name: "NRK Cyber Park", keyPointsName: "NRK Cyber Park", deckAltName: "NRK Cyberpark",
    locality: "Near Fairfield Marriott – Ring Road", micro: "sbd",
    grade: "A",
    handover: "January 2027", handoverDetail: "January 2026 (Under Construction)", handoverISO: "2027-01-01", handoverKind: "date",
    floors: "All floors available",
    superArea: 59235, carpetArea: 40851, areaNote: "59,235 SF super built-up · 40,851 SF built-up / carpet area ( -/+3%)",
    condition: "Bare Shell",
    floorPlate: 19745,
    efficiency: 69,
    structure: "1B + G + 2P + S + 8 floors", buildingTotal: 157960, structureText: "1B + G + 2P + S + 8 floors · 1,57,960 SF total",
    parkingRatio: "1:1000 SF per car & Two wheeler common",
    parkingPer1000: 1, parkingDedicated: null,
    parkingCharges: "To be discussed",
    amenities: ["24*7 Security", "Car Parking", "Fire Protection System", "Lifts", "Power Backup", "Sprinkler System"],
    commute: "Vijay Nagar Chauraha Metro Station", commuteDist: "350 m", commuteM: 350,
    lat: 22.7560, lng: 75.9035, precision: "locality",
    geoNote: "Plot 9/C, Scheme 94, Ring Road, beside Fairfield by Marriott (Justdial listing for NRK Techpark). The deck gives 350 m to Vijay Nagar Chauraha station, which this position does not match; confirm on site.",
    geoSrc: "https://www.justdial.com/Indore/Nrk-Techpark-Scheme-94B/0731PX731-X731-231023181618-Y1P5_BZDET"
  },
  {
    id: "fortune", n: 7, deckLabel: "Option 07", page: 14, photo: "fortune-azure.jpg",
    name: "Fortune Azure", keyPointsName: "Fortune Azuro",
    locality: "Mechanic Nagar – Vijay Nagar", micro: "sbd",
    grade: "A",
    handover: "January 2026", handoverDetail: "January 2026", handoverISO: "2026-01-01", handoverKind: "date",
    floors: "1st & 2nd floor",
    superArea: 50750, carpetArea: 35000, areaNote: "50,750 SF super built-up · 35,000 SF built-up / Carpet Area (-/+ 3)",
    condition: "Bare Shell",
    floorPlate: 30000,
    efficiency: 69,
    structure: "3B + G + UG + 7 floors", buildingTotal: 270000, structureText: "3B + G + UG + 7 floors · 2,70,000 SF total",
    parkingRatio: "1:1000 SF per car & two wheeler common",
    parkingPer1000: 1, parkingDedicated: null,
    parkingCharges: "To be discussed ·",
    amenities: ["Fire Tank Capacity", "Car Parking", "24*7 Security", "Fire Protection System", "Lifts", "Sprinkler System"],
    commute: "Vijay Nagar Chauraha Metro Station / Megdoot Garden Metro Station", commuteDist: "700 m / 550 m", commuteM: 550,
    lat: 22.7475, lng: 75.8900, precision: "locality",
    geoNote: "Plots 14-16, Scheme 54 (Mechanic Nagar extension), placed to match the deck's 700 m to Vijay Nagar Chauraha and 550 m to Meghdoot Garden.",
    geoSrc: "https://www.magicbricks.com/fortune-azure-scheme-no-54-indore-pdpid-4d4235323234343631"
  },
  {
    id: "scape", n: 8, deckLabel: "Option 08", page: 15, photo: "scape-it-park.jpg",
    name: "Scape IT Park", keyPointsName: "Scape IT Park",
    locality: "Scheme No.166 – Super Corridor", micro: "pbd",
    grade: "A",
    handover: "Immediate", handoverDetail: "Immediate", handoverISO: null, handoverKind: "ready",
    floors: "6&7",
    superArea: 41450, carpetArea: 29608, areaNote: "41,450 SF super built-up · 29,608 SF carpet/built-up area ( +/-3)",
    condition: "Bare Shell",
    floorPlate: 21000,
    efficiency: 71,
    structure: "2B + G + 8 floors", buildingTotal: 169306, structureText: "2B + G + 8 floors · 1,69,306 SF total",
    parkingRatio: "1:1000 SF per car & two wheeler common ·",
    parkingPer1000: 1, parkingDedicated: null,
    parkingCharges: "To be discussed",
    amenities: ["Sprinkle system", "Car Parking", "24*7 Security", "Fire Protection System", "Lifts", "Power bank"],
    commute: "Veerangana Metro Station", commuteDist: "2 km", commuteM: 2000,
    lat: 22.7599256, lng: 75.8188386, precision: "building",
    geoNote: "Plot 41, IDA Scheme 166, Tigariya Badshah, behind Infosys (MagicBricks project page).",
    geoSrc: "https://www.magicbricks.com/scape-it-park-super-corridor-indore-pdpid-4d4235343136373939"
  },
  {
    id: "ideal", n: 9, deckLabel: "Option 02 (repeated)", page: 16, photo: "ideal-techno-it-park.jpg",
    name: "Ideal Techno IT Park", keyPointsName: "Ideal IT Park",
    locality: "Sinhasa IT Park – Dhar Road", micro: "west",
    grade: "B",
    handover: "Immediate", handoverDetail: "Immediate", handoverISO: null, handoverKind: "ready",
    floors: "All floors available",
    superArea: 33000, carpetArea: 22758, areaNote: "33,000 SF super built-up · 22,758 SF carpet/built-up area (-/+3)",
    condition: "Bare shell",
    floorPlate: 11000,
    efficiency: 69,
    structure: "G + 2P + 7 floors", buildingTotal: 77000, structureText: "G + 2P + 7 floors · 77,000 SF total",
    parkingRatio: "1:1000 SF per car & two wheeler common",
    parkingPer1000: 1, parkingDedicated: null,
    parkingCharges: "To be discussed",
    amenities: ["Lifts", "Car Parking", "24*7 Security"],
    commute: "Devi Ahilya Bai Holkar Metro Station", commuteDist: "9.3 km", commuteM: 9300,
    lat: 22.6908, lng: 75.7864, precision: "locality",
    geoNote: "Plots 31 & 34, Sinhasa IT Park, Indore-Dhar Road (developer contact page).",
    geoSrc: "https://www.idealittechno.com/contactUs.html"
  },
  {
    id: "veda", n: 10, deckLabel: "Option 03 (repeated)", page: 17, photo: "veda-commune.jpg",
    name: "Veda Commune", keyPointsName: "Veda Commune",
    locality: "Near Luvkush Square – Super Corridor", micro: "pbd",
    grade: "A",
    handover: "April 2027", handoverDetail: "April 2027 (Under construction)", handoverISO: "2027-04-01", handoverKind: "date",
    floors: "5th floor (A block)",
    superArea: 28578, carpetArea: 19709, areaNote: "28,578 SF super built-up · 19,709 SF carpet/built-up area (-/+3)",
    condition: "Bare Shell",
    floorPlate: 57000,
    efficiency: 69,
    structure: "3B + G + 8 floors", buildingTotal: 514836, structureText: "3B + G + 8 floors · 5,14,836 SF total",
    parkingRatio: "1:1000 SF per car & two wheeler common ·",
    parkingPer1000: 1, parkingDedicated: null,
    parkingCharges: "To be discussed",
    amenities: ["24*7 Security", "Car Parking", "Fire Protection System", "Lifts", "Power Backup", "Sprinkler System"],
    commute: "Bhawarsala Square Metro Station", commuteDist: "1.2 km", commuteM: 1200,
    lat: 22.7995, lng: 75.8445, precision: "locality",
    geoNote: "D-69 Super Corridor Road near Luv Kush Square, Bhawarsala (developer page), placed about 1.2 km from Bhawarshala Chauraha as the deck states.",
    geoSrc: "https://adconrealty.com/veda-commune/"
  }
];

/* The amenity vocabulary the deck uses, mapped to one canonical key so options
   can be compared. The deck's own wording is always what is displayed. */
window.IND_AMENITY_KEYS = {
  "24*7 Security": "security", "Car Parking": "parking", "F&B Facility": "fnb",
  "Fire Protection System": "fire", "Fire Tank Capacity": "firetank", "Lifts": "lifts",
  "Power Backup": "power", "Power bank": "power", "Sprinkler System": "sprinkler", "Sprinkle system": "sprinkler"
};
window.IND_AMENITY_LABELS = {
  security: "24x7 security", parking: "Car parking", fnb: "F&B / cafeteria", fire: "Fire protection",
  firetank: "Fire tank", lifts: "Lifts", power: "Power backup", sprinkler: "Sprinklers"
};

/* Deck page 3: how Autopilot frames a requirement. Each lens is answered in
   the app; `where` says where. */
window.IND_LENSES = [
  { key: "location",  label: "Strategic Location Intelligence",  where: "Map: micro-markets, metro, drive-time rings" },
  { key: "req",       label: "Comprehensive Requirement Mapping", where: "Target area filter and fit check on every option" },
  { key: "scale",     label: "Scalable Expansion Planning",       where: "Building total against the area offered" },
  { key: "parking",   label: "Parking & Cafeteria",               where: "Parking ratio, charges and F&B on every option" },
  { key: "infra",     label: "Infrastructure requirements",       where: "Power, fire, sprinklers and lifts on every option" },
  { key: "timeline",  label: "Timelines & Compliance Alignment",  where: "Handover date, CC status and construction flag" },
  { key: "manpower",  label: "Tailored Manpower Solutions",       where: "Talent catchment, institutions and night-shift rules" },
  { key: "bench",     label: "Competitor Benchmarking",           where: "Employer map and nearby occupiers" },
  { key: "amenities", label: "Mapping Key Amenities",             where: "Amenity chips and nearby places" }
];

/* Deck pages 4 and 5, verbatim. */
window.IND_DECK_MARKET = {
  transport: {
    page: 4, heading: "How employees get to work.",
    micro: [
      { name: "Vijay Nagar", text: "Direct BRTS spine; 3 stops from CBD talent." },
      { name: "Super Corridor", text: "Metro connectivity maturing; cab dependence high near-term." },
      { name: "CBD", text: "Best transit access; least Grade-A office supply." }
    ],
    shift: "3-shift operations are viable with cab coverage; plan transport for night shifts where metro is still maturing.",
    mapCaption: "Public transport connectivity map. Indicative; validate locally.",
    image: "deck-transport-map.jpg",
    legend: ["Indore Metro Yellow Line, 16 operational stations", "BRTS dedicated corridors", "City bus network, 188 bus routes",
             "CBD, SBD and PBD zones", "Walking radius from metro stations: 500 m (6 min), 1 km (12 min)"]
  },
  superCorridor: {
    page: 5, heading: "Super Corridor: scale plates on the airport axis.",
    advantages: ["Large contiguous plates (30–60k sq.ft)", "Airport & highway connectivity", "Master-planned IT-park zoning", "Lower entry rents vs SBD"],
    challenges: ["Longer commutes for talent pool", "Uneven last-mile transit", "Amenity density still building", "Pipeline delivery slippage risk"],
    claims: ["8 km premium IT corridor, Indore International Airport (west) to Vijay Nagar (east)",
             "40+ IT / ITeS companies", "50,000+ working professionals", "High growth investment destination",
             "Major IT companies: Infosys, TCS, Yash Technologies, InfoBeans",
             "Micro Mitti Cybercity IT Park development zone", "DCNPL Hills Vistaa premium residential project",
             "Residential catchments: Sanwer, Ujjain Road, Rau",
             "Office pricing zones (INR per sq ft): ₹7,000–8,500 · ₹8,500–10,000 · ₹10,000–12,000 · ₹12,000+"],
    image: "deck-super-corridor-map.jpg"
  }
};

window.IND_CONTACTS = [
  { name: "Mehul Kapadia", phone: "+91 9833237615", email: "mehul.kapadia@worksquare.in" },
  { name: "Madhvi Jain",   phone: "+91 9911936066", email: "madhvi.jain@worksquare.in" }
];

/* ------------------------------------------------------------------- MAP --
   Micro-market zones. The deck names CBD, SBD and PBD but draws them
   schematically; these outlines follow the same working definitions
   (CBD M.G. Road/Palasia, SBD Vijay Nagar-AB Road-Ring Road, PBD Super
   Corridor) and are indicative, not surveyed. */
window.IND_ZONES = [
  { key: "cbd",  label: "CBD", name: "Central Business District", sub: "Rajwada · M.G. Road · Palasia", color: "#b9c46a",
    shape: { type: "ellipse", c: [75.872, 22.7205], rx: 2.4, ry: 1.7 } },
  { key: "sbd",  label: "SBD", name: "Secondary Business District", sub: "Vijay Nagar · AB Road · Ring Road · Nipania", color: "#6fb3a4",
    shape: { type: "ellipse", c: [75.905, 22.7545], rx: 3.4, ry: 2.0 } },
  { key: "pbd",  label: "PBD", name: "Peripheral Business District", sub: "Super Corridor, airport to Bhawarsala", color: "#7a9ed6",
    shape: { type: "band", from: [75.7922, 22.7372], to: [75.8470, 22.7908], w: 1.3 } },
  { key: "west", label: "West", name: "Sinhasa IT Park", sub: "Indore-Dhar Road, off the metro", color: "#b08fd0",
    shape: { type: "ellipse", c: [75.7864, 22.6908], rx: 1.1, ry: 0.9 } }
];
window.IND_ZONE_OF = { cbd: "CBD", sbd: "SBD", pbd: "PBD", west: "West (Sinhasa)" };

/* Indore Metro Yellow Line. Order, names and status follow the Wikipedia
   station list (16 open, 13 approved/under construction, Sep 2026). Station
   positions are approximate: few sources state station coordinates, so most
   are placed on the corridor they serve and are good to a few hundred metres.
   The line between them is schematic. */
window.IND_METRO = {
  name: "Yellow Line",
  openedA: "31 May 2025, Devi Ahilya Bai Holkar Terminal to Veerangana Jhalkari Bai (about 6 km)",
  openedB: "6 Sep 2026, extended to Malviya Nagar Chauraha (16 stations, about 16-17 km)",
  src: "https://en.wikipedia.org/wiki/Yellow_Line_(Indore_Metro)",
  src2: "https://www.alstom.com/press-releases-news/2026/9/alstoms-leading-metro-signalling-and-maintenance-solutions-power-indores-extended-network",
  stations: [
    { n: 1,  name: "Devi Ahilya Bai Holkar Terminal", alias: ["Devi Ahilya Bai Holkar Metro Station"], lat: 22.7372, lng: 75.7922, open: true },
    { n: 2,  name: "Maharani Lakshmi Bai",  lat: 22.7468, lng: 75.8021, open: true },
    { n: 3,  name: "Rani Avanti Bai Lodhi", lat: 22.7554, lng: 75.8108, open: true },
    { n: 4,  name: "Rani Durgavati",        lat: 22.7651, lng: 75.8207, open: true },
    { n: 5,  name: "Veerangana Jhalkari Bai", alias: ["Veerangana Metro Station"], lat: 22.7747, lng: 75.8306, open: true },
    { n: 6,  name: "Super Corridor 2",      lat: 22.7801, lng: 75.8361, open: true },
    { n: 7,  name: "Super Corridor 1",      lat: 22.7855, lng: 75.8416, open: true },
    { n: 8,  name: "Bhawarshala Chauraha",  alias: ["Bhawarsala Square Metro Station"], lat: 22.7908, lng: 75.8470, open: true },
    { n: 9,  name: "MR 10 Road",            lat: 22.7868, lng: 75.8562, open: true },
    { n: 10, name: "ISBT",                  lat: 22.7790, lng: 75.8640, open: true },
    { n: 11, name: "Chandragupta Chauraha", lat: 22.7700, lng: 75.8700, open: true },
    { n: 12, name: "Hira Nagar",            lat: 22.7610, lng: 75.8748, open: true },
    { n: 13, name: "Bapat Chauraha",        lat: 22.7552, lng: 75.8790, open: true },
    { n: 14, name: "Meghdoot Garden",       alias: ["Megdoot Garden Metro Station"], lat: 22.7512, lng: 75.8865, open: true },
    { n: 15, name: "Vijay Nagar Chauraha",  lat: 22.7516, lng: 75.8952, open: true },
    { n: 16, name: "Malviya Nagar Chauraha", alias: ["Radisson Square"], lat: 22.7496, lng: 75.9005, open: true },
    { n: 17, name: "Mumtaj Bag Colony",     lat: 22.7415, lng: 75.9040, open: false },
    { n: 18, name: "Khajrana Square",       lat: 22.7330, lng: 75.9040, open: false },
    { n: 19, name: "Bengali Square",        lat: 22.7215, lng: 75.9010, open: false },
    { n: 20, name: "Patrakar Colony",       lat: 22.7228, lng: 75.8930, open: false },
    { n: 21, name: "Palasia Square",        lat: 22.7229, lng: 75.8868, open: false },
    { n: 22, name: "High Court",            lat: 22.7200, lng: 75.8780, open: false },
    { n: 23, name: "Indore Railway Station", lat: 22.7170, lng: 75.8685, open: false },
    { n: 24, name: "Rajwada",               lat: 22.7186, lng: 75.8553, open: false },
    { n: 25, name: "Chota Ganpati",         lat: 22.7175, lng: 75.8470, open: false },
    { n: 26, name: "Bada Ganpati",          lat: 22.7182, lng: 75.8390, open: false },
    { n: 27, name: "Ramachandra Square",    lat: 22.7195, lng: 75.8255, open: false },
    { n: 28, name: "BSF / Kalani Nagar",    lat: 22.7215, lng: 75.8150, open: false },
    { n: 29, name: "Airport",               lat: 22.7238, lng: 75.8060, open: false }
  ]
};

/* AB Road iBus corridor. The deck calls it a "direct BRTS spine"; the
   segregated lanes were removed from 2025 and buses now run in mixed traffic. */
window.IND_BUS = {
  name: "AB Road iBus corridor",
  path: [[75.8835, 22.7005], [75.8870, 22.7229], [75.8905, 22.7330], [75.8935, 22.7430], [75.8952, 22.7516], [75.8990, 22.7580], [75.9060, 22.7680], [75.9150, 22.7800]],
  note: "About 11.5 km, Rajiv Gandhi Square to Niranjanpur / Dewas Naka. Segregated lanes were dismantled from 2025; iBus now runs in mixed traffic.",
  src: "https://timesofindia.indiatimes.com/city/indore/removal-of-brts-shifts-ibus-ops-to-mixed-lane/articleshow/118663855.cms"
};

/* Places that matter to a hiring and commute decision. `kind`:
     edu    institutions that feed graduates
     emp    employers recruiting the same pool
     res    residential catchments and student hubs
     hub    transport anchors
   Positions are approximate unless precision says otherwise. */
window.IND_PLACES = [
  { id: "airport", kind: "hub", name: "Devi Ahilya Bai Holkar Airport", lat: 22.7218, lng: 75.8011, precision: "building",
    note: "3.46 million passengers in FY2023-24; two international destinations in the same filing.", src: "https://www.aera.gov.in/uploads/consultations/17255494725409.pdf" },
  { id: "rail", kind: "hub", name: "Indore Junction railway station", lat: 22.71701, lng: 75.86847, precision: "building",
    note: "Metro station planned (under construction).", src: "https://mapcarta.com/36062622" },
  { id: "isbt", kind: "hub", name: "ISBT Kumedi", lat: 22.7790, lng: 75.8640, precision: "locality",
    note: "Inter-state bus terminal, served by the ISBT metro station.", src: "" },

  { id: "iit", kind: "edu", name: "IIT Indore", sub: "Simrol", lat: 22.52036, lng: 75.92072, precision: "building",
    note: "Engineering and research; graduates rarely enter voice BPO but anchor the tech brand.", src: "https://www.wikidata.org/wiki/Q6020729" },
  { id: "iim", kind: "edu", name: "IIM Indore", sub: "Rau", lat: 22.6223, lng: 75.7977, precision: "locality",
    note: "594 participants in the 2022-24 placement, average CTC ₹25.68 lakh; a KPO and leadership pipeline, not entry-level.", src: "https://iimidr.ac.in/news-and-events/iim-indores-placement-for-batch-2022-24/" },
  { id: "davv", kind: "edu", name: "DAVV Takshashila Campus", sub: "Khandwa Road", lat: 22.6860, lng: 75.8740, precision: "locality",
    note: "State university with the largest general-degree base in the city; the Bhawarkua student belt grows around it.", src: "" },
  { id: "iet", kind: "edu", name: "IET-DAVV", sub: "Khandwa Road", lat: 22.6815, lng: 75.8795, precision: "locality",
    note: "403 offers from 66 companies in 2024-25, average ₹8.10 lakh.", src: "https://www.ietdavv.edu.in/images/downloads/IET_Profile.pdf" },
  { id: "sgsits", kind: "edu", name: "SGSITS", sub: "Park Road", lat: 22.7254, lng: 75.8712, precision: "locality", note: "Government engineering institute near the CBD.", src: "" },
  { id: "holkar", kind: "edu", name: "Holkar Science College", sub: "AB Road, Bhawarkua", lat: 22.6960, lng: 75.8680, precision: "locality", note: "Large science graduate intake in the Bhawarkua belt.", src: "" },
  { id: "medicaps", kind: "edu", name: "Medi-Caps University", sub: "Rau", lat: 22.6205, lng: 75.8035, precision: "locality", note: "Private university, engineering and management.", src: "" },
  { id: "acropolis", kind: "edu", name: "Acropolis Institute", sub: "Bypass Road, Mangliya", lat: 22.8205, lng: 75.9420, precision: "locality", note: "Private engineering and management campus on the bypass.", src: "" },
  { id: "prestige", kind: "edu", name: "Prestige Institute of Management", sub: "Scheme 54, Vijay Nagar", lat: 22.7545, lng: 75.8905, precision: "locality", note: "Management and commerce graduates inside the SBD.", src: "" },
  { id: "symbiosis", kind: "edu", name: "Symbiosis University of Applied Sciences", sub: "Bada Bangarda, Super Corridor", lat: 22.7690, lng: 75.8190, precision: "locality", note: "Applied-skills university on the Super Corridor.", src: "" },
  { id: "svvv", kind: "edu", name: "Shri Vaishnav Vidyapeeth", sub: "Ujjain Road", lat: 22.8165, lng: 75.8425, precision: "locality", note: "Private university north of Bhawarsala.", src: "" },
  { id: "ips", kind: "edu", name: "IPS Academy", sub: "Rajendra Nagar", lat: 22.6870, lng: 75.8430, precision: "locality", note: "Private engineering, management and pharmacy campus.", src: "" },

  { id: "infosys", kind: "emp", name: "Infosys", sub: "Super Corridor campus", lat: 22.7592, lng: 75.8117, precision: "locality", note: "Super Corridor, Bada Bangarda / Tigariya Badshah.", src: "https://www.infosys.com/about/locations.html" },
  { id: "tcs", kind: "emp", name: "TCS", sub: "Super Corridor SEZ campus", lat: 22.7705, lng: 75.8265, precision: "locality", note: "Software development campus on the Super Corridor.", src: "https://www.tcs.com/who-we-are/newsroom/press-release/tcs-software-development-campus-indore-super-corridor" },
  { id: "yash166", kind: "emp", name: "Yash Technologies", sub: "Scheme 166, Super Corridor", lat: 22.7625, lng: 75.8175, precision: "locality", note: "Also at Crystal IT Park; corporate office on M.G. Road.", src: "https://www.yash.com/contact-us/" },
  { id: "crystal", kind: "emp", name: "Crystal IT Park cluster", sub: "Ring Road, Bhawarkua side", lat: 22.7035, lng: 75.8995, precision: "locality",
    note: "Yash Technologies, InfoBeans, Impetus (STP-II) and ClearTrail list offices here. The deck places InfoBeans on the Super Corridor.", src: "https://infobeans.ai/contact-us/" },
  { id: "altruist", kind: "emp", name: "Altruist Technologies", sub: "NRK Star, Scheme 54, opposite C21 Mall", lat: 22.746227, lng: 75.892408, precision: "building",
    note: "BPO / CX. Runs its Indore centre from the 3rd to 5th floors of NRK Star (GST registration and 2026 walk-in drives). Its website also lists Brilliant Titanium and Brilliant Solitaire in Scheme 78.",
    src: "https://www.altruistindia.com/contact-us/" },
  { id: "taskus", kind: "emp", name: "TaskUs", sub: "C21 Business Park, Vijay Nagar", lat: 22.7455, lng: 75.8938, precision: "locality", note: "BPO; the most direct competitor for voice and back-office talent in the SBD.", src: "https://www.taskus.com/locations/india/" },
  { id: "tp", kind: "emp", name: "Teleperformance", sub: "Brilliant Sapphire, Scheme 78", lat: 22.763322, lng: 75.884012, precision: "building", note: "Recruitment address; occupancy to verify.", src: "https://www.tp.com/en-in/locations/india/" },
  { id: "impetus", kind: "emp", name: "Impetus", sub: "Palasia (Sarda House)", lat: 22.7240, lng: 75.8855, precision: "locality", note: "Also STP-II Crystal IT Park and an SEZ at Badiya Keema.", src: "https://www.impetus.com/about/contact/" },
  { id: "diaspark", kind: "emp", name: "Diaspark", sub: "Chhajlani Marg", lat: 22.7310, lng: 75.8820, precision: "locality", note: "IT services, established Indore employer.", src: "https://diaspark.com/contact-us/" },

  { id: "bhawarkua", kind: "res", name: "Bhawarkua student belt", lat: 22.6930, lng: 75.8680, precision: "locality", note: "Densest student and PG-hostel belt in the city (DAVV, Holkar, coaching). The deepest fresher pool for entry-level hiring.", src: "" },
  { id: "vijaynagar", kind: "res", name: "Vijay Nagar / Scheme 54-78", lat: 22.7575, lng: 75.8900, precision: "locality", note: "Young working population and PG stock around the SBD offices.", src: "" },
  { id: "nipania", kind: "res", name: "Nipania / Mahalaxmi Nagar", lat: 22.7660, lng: 75.9190, precision: "locality", note: "Fast-growing apartment belt east of Ring Road.", src: "" },
  { id: "khajrana", kind: "res", name: "Khajrana / Bicholi", lat: 22.7300, lng: 75.9170, precision: "locality", note: "Dense mixed-income neighbourhoods south of Ring Road.", src: "" },
  { id: "rajendra", kind: "res", name: "Rajendra Nagar / Annapurna", lat: 22.6920, lng: 75.8390, precision: "locality", note: "Established middle-income residential south-west.", src: "" },
  { id: "oldcity", kind: "res", name: "Old city / Rajwada", lat: 22.7175, lng: 75.8520, precision: "locality", note: "High density, strongest bus coverage; metro not yet open here.", src: "" },
  { id: "sanwer", kind: "res", name: "Sanwer Road", lat: 22.8060, lng: 75.8380, precision: "locality", note: "Deck: residential catchment for the Super Corridor. Industrial and worker housing belt.", src: "" },
  { id: "ujjainrd", kind: "res", name: "Ujjain Road", lat: 22.8030, lng: 75.8180, precision: "locality", note: "Deck: residential catchment for the Super Corridor.", src: "" },
  { id: "rau", kind: "res", name: "Rau", lat: 22.6380, lng: 75.8120, precision: "locality", note: "Deck: residential catchment for the Super Corridor. In practice nearer to Sinhasa and the IIM belt.", src: "" },
  { id: "mr10", kind: "res", name: "Bhawarsala / MR-10", lat: 22.7880, lng: 75.8560, precision: "locality", note: "New township growth along MR-10 and the metro.", src: "" }
];

/* ------------------------------------------------------------- RESEARCH --
   City facts, grouped the way the brief reads. Every item carries its own
   source and confidence so the page can cite it inline. */
window.IND_FACTS = {
  metro: [
    { k: "Open today", v: "16 stations, Devi Ahilya Bai Holkar Terminal to Malviya Nagar Chauraha (Radisson Square)", asOf: "Sep 2026", conf: "high", src: "https://en.wikipedia.org/wiki/Yellow_Line_(Indore_Metro)" },
    { k: "Phase 1", v: "About 6 km priority corridor opened 31 May 2025", asOf: "May 2025", conf: "high", src: "https://theprint.in/india/metro-trains-start-running-in-indore-as-pm-inaugurates-first-phase/2643321/" },
    { k: "Phase 2", v: "Super Corridor 2 to Radisson Square, regular service from 6 Sep 2026", asOf: "Sep 2026", conf: "medium", src: "https://timesofindia.indiatimes.com/city/indore/metro-phase-ii-on-tracks-wait-ends-for-hassle-free-ride/articleshow/133813683.cms" },
    { k: "Not yet open", v: "Khajrana, Palasia, High Court, Railway Station, Rajwada, Airport: the CBD and the airport are still off the metro", asOf: "Sep 2026", conf: "high", src: "https://en.wikipedia.org/wiki/Yellow_Line_(Indore_Metro)" },
    { k: "Completion", v: "Underground section projected Dec 2028 in one report; others say later. No binding date", asOf: "2026", conf: "low", src: "https://www.magicbricks.com/news/indore-metro-yellow-line-tunnel-boring-to-begin-in-july-2026-expected-to-open-by-dec-2028-rgmb/148189.html" }
  ],
  bus: [
    { k: "AB Road iBus", v: "About 11.5 km; 50,000-60,000 riders a day on 49 buses", asOf: "Feb 2025", conf: "medium", src: "https://timesofindia.indiatimes.com/city/indore/bus-rapid-transit-to-lose-corridor-of-convenience/articleshow/118610821.cms" },
    { k: "BRTS lanes", v: "Segregated lanes removed from 2025; iBus now in mixed traffic", asOf: "Dec 2025", conf: "high", src: "https://timesofindia.indiatimes.com/city/indore/removal-of-brts-shifts-ibus-ops-to-mixed-lane/articleshow/118663855.cms" },
    { k: "City buses", v: "800+ buses and 300,000+ daily riders across AICTSL services (2022-23)", asOf: "2022-23", conf: "medium", src: "https://www.pppinindia.gov.in/bestpractices/best-practice-detail/atal-indore-city-bus-services" },
    { k: "E-buses", v: "80 electric buses running, 50 more planned", asOf: "Aug 2025", conf: "medium", src: "https://timesofindia.indiatimes.com/city/indore/aictsl-to-get-50-new-electric-buses-this-month/articleshow/123149926.cms" }
  ],
  talent: [
    { k: "City population", v: "19.6 lakh (2011 census, municipal); about 29.6 lakh projected for 2026", asOf: "2011 / 2026", conf: "medium", src: "https://www.census2011.co.in/census/city/299-indore.html" },
    { k: "Urban agglomeration", v: "21.7 lakh (2011); about 32.7 lakh projected for 2026", asOf: "2011 / 2026", conf: "medium", src: "https://www.census2011.co.in/census/metropolitan/242-indore.html" },
    { k: "Graduate pool", v: "Moderate, around 90,000+ graduates a year across the city", asOf: "2026", conf: "low", src: "", note: "ATLAS talent band used across the Digitide study" },
    { k: "English", v: "Moderate; strongest in management and engineering cohorts", asOf: "2026", conf: "low", src: "", note: "ATLAS talent band" },
    { k: "Entry salary", v: "₹14,000-20,000 a month for entry-level voice and back office", asOf: "2026", conf: "low", src: "", note: "ATLAS talent band; validate with a local recruiter" },
    { k: "Attrition", v: "25-40% a year, lower than Tier-1 BPO hubs", asOf: "2026", conf: "low", src: "", note: "ATLAS talent band" },
    { k: "Minimum wage (MP)", v: "₹12,425 unskilled · ₹13,421 semi-skilled · ₹15,144 skilled · ₹16,769 highly skilled a month, one statewide rate", asOf: "Apr-Sep 2026", conf: "medium", src: "https://labourlawhelp.com/madhya-pradesh-minimum-wages/" },
    { k: "State tech jobs", v: "150,000+ direct technology jobs and 300+ technical institutes, statewide (not Indore only)", asOf: "2025", conf: "medium", src: "https://mpsedc.mp.gov.in/Uploaded%20Document/Policies%20and%20Rules/IT%20brochure-Low%20Res.pdf" },
    { k: "Not quantified", v: "College counts, annual graduate output, local IT/ITeS workforce and a comparable employability ranking for Indore alone were not found in a reliable source", asOf: "Sep 2026", conf: "low", src: "" }
  ],
  market: [
    { k: "Commercial stock", v: "5.52 million sq ft office plus mixed-use, projected 7.22 million by 2028 (not Grade A/B office only)", asOf: "Jul 2025", conf: "medium", src: "https://sampratiproperties.com/influx-of-professionals-infra-growth-propel-realty-sector/" },
    { k: "Rent, Vijay Nagar", v: "₹64-112 per sq ft per month on listings; large bare-shell floors likely at or below the low end", asOf: "2025", conf: "low", src: "https://www.squareyards.com/rent/office-spaces-for-rent-in-vijay-nagar-indore" },
    { k: "Rent, city range", v: "₹25-60 per sq ft generally, premium Vijay Nagar ₹75-135 (period and area basis not stated)", asOf: "Apr 2025", conf: "low", src: "https://www.realtynmore.com/growth-hub-indore-turns-bright-spot-in-central-indias-property-market/" },
    { k: "Occupancy signal", v: "Above 80% on the Super Corridor and about 86% on AB Road / Vijay Nagar / Nipania (a take-up ratio, not a vacancy rate)", asOf: "Jul 2025", conf: "low", src: "https://sampratiproperties.com/influx-of-professionals-infra-growth-propel-realty-sector/" },
    { k: "Deck pricing zones", v: "₹7,000 to ₹12,000+ per sq ft on the Super Corridor graphic (reads as capital value, not rent)", asOf: "Sep 2026", conf: "low", src: "", note: "Deck page 5" }
  ],
  incentives: [
    { k: "Policy", v: "MP IT, ITeS & ESDM Investment Promotion Policy 2023; BPO and BPM are named qualifying activities", asOf: "2023-2028", conf: "high", src: "https://mpsedc.mp.gov.in/mpitinvestment/" },
    { k: "Employment assistance", v: "₹4,000-5,000 per employee per month for up to 3 years by headcount band, ceiling ₹15 crore", asOf: "2023", conf: "low", src: "https://invest.mp.gov.in/wp-content/uploads/2025/02/MP-IT-ITeS-ESDM-Investment-Promotion-Policy-2023.pdf", note: "Confirm it is monthly, not annual" },
    { k: "Rental assistance", v: "Up to ₹3,000 per seat per month for 3 years in Category A districts (Indore is one), cap ₹10 crore", asOf: "2023", conf: "low", src: "https://invest.mp.gov.in/wp-content/uploads/2025/02/MP-IT-ITeS-ESDM-Investment-Promotion-Policy-2023.pdf" },
    { k: "Capital assistance", v: "25% of fixed capital investment up to ₹30 crore; appears to be an alternative to rental assistance, not cumulative", asOf: "2023", conf: "medium", src: "https://ascocapital.com/wp-content/uploads/2023/10/Summary-of-IT-Investment-Promotion-Policy-MP.pdf" },
    { k: "Stamp duty", v: "100% stamp duty and registration assistance on qualifying leases", asOf: "2023", conf: "low", src: "https://invest.mp.gov.in/wp-content/uploads/2025/02/MP-IT-ITeS-ESDM-Investment-Promotion-Policy-2023.pdf" },
    { k: "GCC policy", v: "MP GCC Policy 2025 is referenced in a Feb 2026 state tender; the published text is the 2024 draft (capex 40%, payroll and training support). Check the gazette", asOf: "Feb 2026", conf: "medium", src: "https://mpsedc.mp.gov.in/Uploaded%20Document/UpcomingEvents/10122024030121Madhya%20Pradesh%20GCC%20Policy%202024.pdf" }
  ],
  living: [
    { k: "Cleanest city", v: "First in Swachh Survekshan seven rounds running, 2017-2023 (2023 shared with Surat)", asOf: "2023", conf: "high", src: "https://imcindore.mp.gov.in/our-achievement" },
    { k: "Airport", v: "3.46 million passengers FY2023-24", asOf: "FY24", conf: "high", src: "https://www.aera.gov.in/uploads/consultations/17255494725409.pdf" },
    { k: "Women on night shifts", v: "MP permits 9 pm to 7 am shifts with written consent, at least five women per shift and transport and safety conditions", asOf: "Jun 2025", conf: "medium", src: "https://www.mondaq.com/india/employee-rights-labour-relations/1667160/continued-move-towards-women-empowerment-madhya-pradesh-revises-conditions-for-allowing-women-to-work-night-shifts" },
    { k: "Cost of living", v: "State claims about 25% below Tier-1 cities (comparator not stated)", asOf: "2025", conf: "low", src: "https://mpsedc.mp.gov.in/Uploaded%20Document/Policies%20and%20Rules/IT%20brochure-Low%20Res.pdf" },
    { k: "Power", v: "No public feeder-uptime figure; ask each landlord for DG and feeder history", asOf: "Sep 2026", conf: "low", src: "" }
  ],
  employers: [
    { k: "IT services", v: "Infosys and TCS campuses on the Super Corridor; Yash, InfoBeans, Impetus, ClearTrail, Diaspark in the city", asOf: "2025-26", conf: "medium", src: "https://www.tcs.com/who-we-are/newsroom/press-release/tcs-software-development-campus-indore-super-corridor" },
    { k: "BPO / CX", v: "Altruist Technologies (NRK Star, Scheme 54, opposite C21 Mall), TaskUs (C21 Business Park, Vijay Nagar), Teleperformance (Scheme 78), Infosys BPM", asOf: "2025-26", conf: "medium", src: "https://www.taskus.com/locations/india/" },
    { k: "New entrants", v: "Deloitte opened in Indore (address not published)", asOf: "2025-26", conf: "medium", src: "https://www.deloitte.com/in/en/about/press-room/deloitte-india-establishes-presence-in-indore.html" }
  ]
};

