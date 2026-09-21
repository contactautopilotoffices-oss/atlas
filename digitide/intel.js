/* ============================================================================
   DIGITIDE GROUP — LOCATION INTELLIGENCE LAYER
   Three blocks:
     DG_CITIES — every city holding a facility, plus relocation candidates
                 (candidateOnly:true). Coordinates are city-level centroids
                 (coordPrecision "city"); the exact-address geocode pass is a
                 stated next step, not silently pretended.
     DG_WAGES  — statutory monthly minimum wage floors, shops & establishments
                 schedule, per state, zone-wise where the state has zones.
                 Latest notified rates found in public compliance trackers
                 (Sep 2026 pass); every table renders with a VALIDATE flag.
     DG_META   — the one-line honesty footer every panel carries.
   Rent figures are quoted listing / market-report ranges (sources in rentSrc),
   not negotiated deals. Competitor and catchment blocks are directional
   research, kept short on purpose: the board reads three lines, not thirty.
   ============================================================================ */

window.DG_META = {
  asOf: "2026-09-01",
  disclaimer: "Wage floors are the latest notified state rates held in Atlas; rents are quoted listing ranges, not negotiated deals. Both are direction-setting inputs: validate wages against the state gazette and rents with a broker check before any figure reaches the board."
};

window.DG_CITIES = {

  /* ------------------------------- NORTH ------------------------------- */
  delhi: {
    name: "Delhi", state: "Delhi (NCT)", stateKey: "delhi", tier: 1,
    lat: 28.6519, lng: 77.1700, wageZone: "Statewide",
    presence: "very high", players: ["Concentrix", "Teleperformance", "EXL", "iEnergizer", "Startek"],
    catchment: "Deepest labour market in the country, but the NCT carries India's highest statutory floor, so a Delhi seat is the most expensive statutory seat in the portfolio.",
    candidates: ["noida"],
    strategy: "One collection centre in West Patel Nagar, lease to Mar 2027. The NCT wage floor is the highest in the country; the collection footprint can consolidate into the Noida facilities (UP floor, same catchment) when the lease closes. Small money, but it is the cleanest statutory-arbitrage move on the books."
  },
  noida: {
    name: "Noida", state: "Uttar Pradesh", stateKey: "up", tier: 1,
    lat: 28.5900, lng: 77.3600, wageZone: "Category I",
    market: "Sector 58 / 62", rent: { low: 40, high: 90, grade: "mixed", asOf: "2025",
      note: "Sector 62 Grade-A IT parks quote ₹65–95 psf; Sector 58 industrial-conversion stock sits at the lower end." },
    presence: "very high", players: ["Concentrix", "Teleperformance", "EXL", "Genpact", "iEnergizer", "Tech Mahindra BPS", "Startek", "WNS"],
    catchment: "Bottomless NCR hiring pool and the most contested: every large BPS employer bids for the same agents, so attrition, not availability, is the Noida problem.",
    candidates: ["lucknow", "kanpur"],
    strategy: "UP split its wage schedule in Apr 2026 and put Noida alone (with Ghaziabad) in the top category — the floor here now runs about ₹680/month above Lucknow or Kanpur on unskilled and ₹840 on skilled. Stack that on rent (Sector 62-grade space at 2–3x a Vibhuti Khand floor) and NCR churn, and the case writes itself. Digitide already runs a full-floor Lucknow call centre — scale where the model is proven before the Sector-62 lease closes Mar 2027."
  },
  jaipur: {
    name: "Jaipur", state: "Rajasthan", stateKey: "rajasthan", tier: 2,
    lat: 26.9124, lng: 75.7873, wageZone: "Statewide",
    market: "Khatipura Rd / C-Scheme", rent: { low: 16, high: 58, grade: "mixed", asOf: "2025",
      note: "Vaishali Nagar ~₹16 psf; C-Scheme Grade A ~₹58 psf." },
    presence: "medium", players: ["Genpact", "Teleperformance", "Infosys BPM"],
    catchment: "Large Hindi-belt graduate pool with an established BPS base; comfortable tier-2 economics.",
    strategy: "Collection centre lease ends 30 Sep 2026 — this month. Renew or move is a live decision today, not a plan. City economics are sound; the urgency is purely the calendar."
  },
  jalandhar: {
    name: "Jalandhar", state: "Punjab", stateKey: "punjab", tier: 2,
    lat: 31.3260, lng: 75.5762, wageZone: "Statewide",
    presence: "low", players: [],
    catchment: "Doaba-region collection catchment; adequate for a collection footprint, thin for scaled voice."
  },
  lucknow: {
    name: "Lucknow", state: "Uttar Pradesh", stateKey: "up", tier: 2,
    lat: 26.8467, lng: 80.9462, wageZone: "Category II",
    market: "Vibhuti Khand, Gomti Nagar", rent: { low: 30, high: 90, grade: "mixed", asOf: "2025",
      note: "Better buildings (Levana Cyber Heights class) at the top end; solid mid-grade floors ₹30–50 psf." },
    presence: "medium", players: ["HCLTech", "Teleperformance", "Tech Mahindra BPS"],
    catchment: "One of the largest graduate outputs in the Hindi belt, materially lower attrition than NCR, and Digitide already operates two facilities here including a full-floor call centre — the model is proven.",
    strategy: "Lucknow is the receiving end of the NCR argument, not a candidate to leave. The Summit Building lease runs to Mar 2029; treat it as the anchor to scale into."
  },
  ludhiana: {
    name: "Ludhiana", state: "Punjab", stateKey: "punjab", tier: 2,
    lat: 30.9010, lng: 75.8573, wageZone: "Statewide",
    presence: "low", players: [],
    catchment: "Punjab's largest city; collection catchment role."
  },
  mohali: {
    name: "Mohali", state: "Punjab", stateKey: "punjab", tier: 2,
    lat: 30.7046, lng: 76.7179, wageZone: "Statewide",
    market: "Industrial Area Phase 7", rent: { low: 25, high: 65, grade: "B", asOf: "2025",
      note: "Phase 7/9 industrial-area floors; cheaper than Chandigarh Sector 17." },
    presence: "medium", players: ["Teleperformance", "IDS Infotech"],
    catchment: "Tricity (Chandigarh–Mohali–Panchkula) pool: strong English voice catchment for the North at tier-2 cost. Lease runs to Sep 2030 — a settled site.",
  },
  hissar: {
    name: "Hissar", state: "Haryana", stateKey: "haryana", tier: 3,
    lat: 29.1492, lng: 75.7217, wageZone: "Statewide",
    presence: "low", players: [],
    catchment: "District-town collection catchment."
  },

  /* ------------------------------- SOUTH ------------------------------- */
  bangalore: {
    name: "Bengaluru", state: "Karnataka", stateKey: "karnataka", tier: 1,
    lat: 12.9716, lng: 77.5946, wageZone: "Zone 1",
    market: "BTM / Bommanahalli (Hosur Rd)", rent: { low: 50, high: 100, grade: "mixed", asOf: "2025",
      note: "Conventional office ₹50–100 psf on this corridor; tech parks at the upper end." },
    presence: "very high", players: ["Infosys BPM", "Accenture Ops", "Concentrix", "Teleperformance", "Genpact", "Firstsource", "[24]7.ai"],
    catchment: "The deepest multilingual ITES pool in India, and the most expensive to hold: every employer in the sector bids for it.",
    candidates: ["mysore", "hubli", "bellary"],
    strategy: "Karnataka went zonal in May 2026: Bengaluru (Zone 1) now sits about ₹2,100/employee/month above Zone 2 corporations like Mysuru, Hubballi and Ballari — a real statutory delta for the first time, though the notification is under litigation. Add rent at half or less and lower churn, and Digitide's own Ballari call centre already proves the delivery model. Krimson Square runs to May 2028; SS Plaza to 2034 is the long-hold anchor. Grow the next Karnataka seat outside Bengaluru rather than adding a third city facility."
  },
  bellary: {
    name: "Ballari", state: "Karnataka", stateKey: "karnataka", tier: 3,
    lat: 15.1394, lng: 76.9214, wageZone: "Zone 2",
    presence: "low", players: [],
    catchment: "Existing Digitide call centre — the in-house proof that tier-3 Karnataka voice delivery works. North Karnataka graduate pool with almost no competing BPS employer."
  },
  hyderabad: {
    name: "Hyderabad / Secunderabad", state: "Telangana", stateKey: "telangana", tier: 1,
    lat: 17.4399, lng: 78.4983, wageZone: "Zone I",
    market: "MG Rd Ranigunj / Begumpet", rent: { low: 40, high: 70, grade: "mixed", asOf: "2025",
      note: "Begumpet/Secunderabad corridor; materially cheaper than HITEC City." },
    presence: "very high", players: ["Genpact", "Concentrix", "Teleperformance", "HGS", "Sutherland", "Cognizant", "[24]7.ai"],
    catchment: "Deep Telugu+English pool. Six of the group's facilities sit on one EFC stack in Ranigunj — heavy single-building, single-partner concentration.",
    candidates: ["warangal"],
    strategy: "Five of six Ranigunj floors close Jan 2029 and one closes Mar 2027 — a natural decision window on the whole stack at once. Telangana's Jun 2026 restructure is zonal, but Warangal's corporation status keeps it in Zone I alongside Hyderabad, so the statutory floor moves nothing; the case there is TSIIC-subsidised space and the Tech Mahindra BPS precedent, keeping Secunderabad as the client-facing core."
  },
  munnar: {
    name: "Munnar", state: "Kerala", stateKey: "kerala", tier: 3,
    lat: 10.0889, lng: 77.0595, wageZone: "Statewide (Ernakulam DA)",
    presence: "low", players: [],
    catchment: "Hill-station micro site; 11-month lease to Jan 2027. A location decision, not a portfolio one."
  },
  coimbatore: {
    name: "Coimbatore", state: "Tamil Nadu", stateKey: "tamilnadu", tier: 2,
    lat: 11.0168, lng: 76.9558, wageZone: "Zone A",
    market: "Puliyakulam", rent: { low: null, high: null },
    presence: "medium", players: ["Sutherland", "KGiSL", "Vee Healthtek"],
    catchment: "Strong engineering-college output, Tamil+English voice pool, visibly lower attrition than Chennai. Digitide already holds three floors in one building here — a working tier-2 hub.",
    strategy: "One of the three Manchester Square leases ends Oct 2026 (next month) and another Dec 2027. The city works; the near action is simply renewing or re-stacking the floors on better terms."
  },
  chennai: {
    name: "Chennai", state: "Tamil Nadu", stateKey: "tamilnadu", tier: 1,
    lat: 12.9200, lng: 80.2100, wageZone: "Zone A",
    market: "Pallikaranai (Velachery–Tambaram Rd)", rent: { low: 25, high: 45, grade: "mixed", asOf: "2025",
      note: "Standalone B-grade floors on this corridor ~₹25–31 psf; institutional Grade A elsewhere in Chennai runs ₹45+." },
    presence: "very high", players: ["Sutherland", "Concentrix", "Teleperformance", "WNS", "Firstsource", "HGS"],
    catchment: "Deep Tamil+English pool; RVI Tower leases run to 2029/2030, so this is a settled anchor rather than a pressure point.",
    candidates: ["madurai", "trichy"],
    strategy: "TN's Zone A/B wage spread is about ₹70/month, and Madurai and Trichy are Zone A corporations anyway — so this is an expansion play (rent at a third, untapped catchment, ELCOT space), not a statutory-wage one. No forced move: both Chennai leases are long."
  },

  /* -------------------------------- EAST ------------------------------- */
  jamshedpur: {
    name: "Jamshedpur", state: "Jharkhand", stateKey: "jharkhand", tier: 2,
    lat: 22.8046, lng: 86.2029, wageShow: true, wageZone: "Area A",
    presence: "low", players: [],
    catchment: "Tata-anchored site (lessor is Tata Steel) serving a client relationship; not a relocation question."
  },
  kolkata: {
    name: "Kolkata", state: "West Bengal", stateKey: "wb", tier: 1,
    lat: 22.5800, lng: 88.4200, wageZone: "Zone A",
    market: "Sector V, Bidhannagar", rent: { low: 50, high: 65, grade: "A", asOf: "2025",
      note: "Warm-shell Grade A; ~14.6 mn sq ft stock, the largest Grade-A pool in the metro." },
    presence: "high", players: ["Concentrix", "Teleperformance", "Wipro", "TCS", "Genpact", "Firstsource", "Cognizant"],
    catchment: "Large English+Bengali+Hindi pool built over two decades of Sector V ITES; both facilities (Technopolis to Oct 2027, Millennium City to Jun 2030) sit in the state's highest wage band.",
    candidates: ["durgapur", "siliguri"],
    strategy: "The Technopolis lease (Oct 2027) is the trigger. Note the fine print: Durgapur and Siliguri are municipal corporations, which keeps them in the same Zone A wage band as Kolkata — the statutory floor moves nothing. The material gains are rent (Durgapur at a third of Sector V) and an untapped catchment. Directional today: both towns need an on-ground talent and infrastructure validation before anything moves."
  },
  bhubaneswar: {
    name: "Bhubaneswar", state: "Odisha", stateKey: "odisha", tier: 2,
    lat: 20.2961, lng: 85.8245, wageZone: "Statewide",
    market: "Rasulgarh / Infocity", rent: { low: 35, high: 75, grade: "mixed", asOf: "2025",
      note: "Infocity fitted space quoted ~₹75 psf; broader city floors materially lower." },
    presence: "medium", players: ["Concentrix", "Infosys BPM", "TCS", "Sutherland"],
    catchment: "Government-backed IT push, good graduate output, low cost. Collection lease ends Dec 2026 — a near-term renew-or-move call.",
    strategy: "Lease closes 31 Dec 2026. City fundamentals argue renew; the decision is terms, not geography."
  },
  patna: {
    name: "Patna", state: "Bihar", stateKey: "bihar", tier: 2,
    lat: 25.5941, lng: 85.1376, wageZone: "Statewide",
    presence: "low", players: ["iEnergizer"],
    catchment: "Very large, very young labour pool; almost no organised BPS employer — deep for collections, unproven for scaled voice.",
    strategy: "Lease ends 10 Nov 2026 — inside the quarter. Renew-or-move decision is live now."
  },
  guwahati: {
    name: "Guwahati", state: "Assam", stateKey: "assam", tier: 2,
    lat: 26.1445, lng: 91.7362, wageZone: "Statewide",
    presence: "low", players: [],
    catchment: "Gateway catchment for the North-East; multilingual pool (Assamese, Bengali, Hindi).",
    strategy: "Lease ends 2 Dec 2026. Same shape as Patna: near-term renewal call, small footprint."
  },

  /* -------------------------------- WEST ------------------------------- */
  navimumbai: {
    name: "Navi Mumbai", state: "Maharashtra", stateKey: "maharashtra", tier: 1,
    lat: 19.1550, lng: 73.0000, wageZone: "Zone I",
    market: "Airoli / Rabale, Thane–Belapur Rd", rent: { low: 70, high: 110, grade: "A", asOf: "Q3 2025",
      note: "This belt led MMR leasing in 2025 and has the fastest 3-yr rent growth in the country — the cost line only goes up here." },
    presence: "high", players: ["WNS", "Teleperformance", "Concentrix", "Firstsource", "IGT Solutions", "TCS BPS"],
    catchment: "Deep central-suburban catchment along the Thane–Belapur ITES spine; five facilities across Airoli and Rabale make this the group's densest cluster.",
    candidates: ["nasik", "aurangabad"],
    strategy: "Airoli 3 closes 23 Dec 2026 and Airoli 4 in May 2027 — two live decisions. Note the wage trap: Nashik and Sambhajinagar are also Zone I under Maharashtra's schedule, so the statutory floor moves nothing; the case is rent (₹19–65 vs ₹70–110 psf) and lower churn. Consolidating the two expiring EFC floors into the Rabale/Kolshet holds is the zero-risk alternative."
  },
  thane: {
    name: "Thane", state: "Maharashtra", stateKey: "maharashtra", tier: 1,
    lat: 19.2183, lng: 72.9781, wageZone: "Zone I",
    market: "Wagle Estate / Kolshet / GB Rd", rent: { low: 90, high: 140, grade: "mixed", asOf: "2025",
      note: "Corridor quotes; older industrial-estate B-grade floors trade below this range." },
    presence: "high", players: ["WNS", "Teleperformance", "Tech Mahindra BPS", "Firstsource"],
    catchment: "Same central-line catchment as Navi Mumbai from the north side; four facilities including the four-floor Kolshet block.",
    candidates: ["nasik", "aurangabad"],
    strategy: "MBC Park 8th floor closes May 2027; the rest run 2028–29. Same Maharashtra Zone-I wage trap as Airoli — any move west or north is a rent-and-attrition case, not a statutory one."
  },
  mumbai: {
    name: "Mumbai (Borivali)", state: "Maharashtra", stateKey: "maharashtra", tier: 1,
    lat: 19.2307, lng: 72.8567, wageZone: "Zone I",
    presence: "high", players: ["Teleperformance", "WNS", "Concentrix"],
    catchment: "Western-suburb collection catchment.",
    strategy: "Collection centre, lease ends 4 Dec 2026. Candidate to fold into the Thane cluster when it closes — same catchment, one less lease."
  },
  pune: {
    name: "Pune", state: "Maharashtra", stateKey: "maharashtra", tier: 1,
    lat: 18.5600, lng: 73.9000, wageZone: "Zone I",
    market: "Kharadi / Pimpri", rent: { low: 50, high: 100, grade: "mixed", asOf: "2025-26",
      note: "Kharadi Grade A ~₹93–100 psf; Pimpri materially cheaper at ₹50–90. The owned Devi IT Park floor carries no rent line at all." },
    presence: "high", players: ["Infosys BPM", "WNS", "EXL", "Concentrix", "Teleperformance", "Genpact"],
    catchment: "Deep multilingual pool (Marathi, Hindi, English); the owned Pimpri floor is the only zero-rent asset in the portfolio.",
    candidates: ["kolhapur", "aurangabad", "nasik"],
    strategy: "Almonte closes Mar 2027 — decision live. Kharadi is the group's priciest Pune space; the owned Devi IT Park floor and cheaper Pimpri stock are the natural absorbers before any new lease is signed. Kolhapur (existing Digitide site) covers the southern-Maharashtra collection catchment already."
  },
  mithapur: {
    name: "Mithapur", state: "Gujarat", stateKey: "gujarat", tier: 3,
    lat: 22.4072, lng: 69.0000, wageZone: "Zone II",
    presence: "low", players: [],
    catchment: "Tata Chemicals campus site serving a client relationship; not a relocation question."
  },
  nagpur: {
    name: "Nagpur", state: "Maharashtra", stateKey: "maharashtra", tier: 2,
    lat: 21.1458, lng: 79.0882, wageZone: "Zone I",
    market: "Dharampeth / MIHAN", rent: { low: null, high: null },
    presence: "medium", players: ["TCS", "Infosys BPM", "HCLTech"],
    catchment: "Central-India catchment with MIHAN SEZ capacity; managed-office collection site to May 2027."
  },
  kolhapur: {
    name: "Kolhapur", state: "Maharashtra", stateKey: "maharashtra", tier: 2,
    lat: 16.7050, lng: 74.2433, wageZone: "Zone I",
    market: "Shivaji Peth", rent: { low: 35, high: 35, grade: "B", asOf: "2025", note: "Thin listing depth; single Tarabai Park reference." },
    presence: "low", players: [],
    catchment: "Southern-Maharashtra collection catchment; existing Digitide site."
  },
  srirampur: {
    name: "Shrirampur", state: "Maharashtra", stateKey: "maharashtra", tier: 3,
    lat: 19.6220, lng: 74.6560, wageZone: "Zone II",
    presence: "low", players: [],
    catchment: "Training room in a municipal-council town — the one Maharashtra site actually inside the cheaper Zone II band."
  },
  nasik: {
    name: "Nashik", state: "Maharashtra", stateKey: "maharashtra", tier: 2,
    lat: 19.9975, lng: 73.7898, wageZone: "Zone I",
    market: "City", rent: { low: 28, high: 65, grade: "B", asOf: "2025", note: "No institutional Grade A; furnished floors mid-range." },
    presence: "low", players: ["WNS (Nashik)", "eClerx (Nashik)"],
    catchment: "Strong graduate output, very low BPS density, half the rent of the Thane–Belapur belt; Digitide already holds a collection centre here to Jan 2027 — a ready expansion beachhead."
  },
  baroda: {
    name: "Vadodara", state: "Gujarat", stateKey: "gujarat", tier: 2,
    lat: 22.3072, lng: 73.1812, wageZone: "Zone I",
    presence: "medium", players: ["Concentrix", "Etech"],
    catchment: "Gujarat's education hub; collection footprint."
  },
  ahmedabad: {
    name: "Ahmedabad", state: "Gujarat", stateKey: "gujarat", tier: 1,
    lat: 23.0225, lng: 72.5714, wageZone: "Zone I",
    presence: "medium", players: ["Teleperformance", "Etech", "Motif"],
    catchment: "Large Gujarati+Hindi pool; collection footprint to Jun 2027."
  },

  /* ------------------------------ CENTRAL ------------------------------ */
  indore: {
    name: "Indore", state: "Madhya Pradesh", stateKey: "mp", tier: 2,
    lat: 22.7196, lng: 75.8577, wageZone: "Statewide",
    market: "Vijay Nagar", rent: { low: 64, high: 112, grade: "mixed", asOf: "2025",
      note: "Small-unit listing skew; large warm-shell floors likely at or below the low end." },
    presence: "medium", players: ["TaskUs", "Teleperformance", "Infosys BPM", "TCS"],
    catchment: "MP's commercial capital: strong graduate pool, growing ITES base, tier-2 cost. Two facilities incl. the new Brilliant Sapphire lease to Aug 2029.",
    candidates: ["chhindwara"],
    strategy: "Indore is a hold-and-scale city. Chhindwara (existing Ambara site) is the group's own rural-delivery proof for overflow domestic work at the lowest cost point in the portfolio."
  },
  chhindwara: {
    name: "Chhindwara", state: "Madhya Pradesh", stateKey: "mp", tier: 3,
    lat: 22.0574, lng: 78.9382, wageZone: "Statewide",
    presence: "low", players: [],
    catchment: "Village-delivery site (Ambara) — the in-house rural-sourcing proof point; lease to Jan 2028."
  },
  raipur: {
    name: "Raipur", state: "Chhattisgarh", stateKey: "chhattisgarh", tier: 2,
    lat: 21.2514, lng: 81.6296, wageZone: "Zone A",
    market: "Devendra Nagar Rd", rent: { low: 35, high: 70, grade: "B", asOf: "2025", note: "Floor-wise quotes; furnished Pandri/Telibandha ~₹40–60 psf." },
    presence: "low", players: [],
    catchment: "State-capital collection catchment; lease ends 20 Nov 2026 — near-term renewal call.",
    strategy: "Lease closes 20 Nov 2026. Renew-or-move is live this quarter; footprint is small."
  },

  /* --------------------- RELOCATION CANDIDATES ONLY --------------------- */
  durgapur: {
    name: "Durgapur", state: "West Bengal", stateKey: "wb", tier: 3, candidateOnly: true,
    lat: 23.5204, lng: 87.3119, wageZone: "Zone A",
    market: "Bidhannagar (Durgapur)", rent: { low: 20, high: 40, grade: "B", asOf: "2025", note: "No Grade A market; floor-wise commercial stock." },
    presence: "low", players: [],
    catchment: "~170 km from Kolkata. NIT Durgapur plus a dense engineering-college belt; effectively no organised BPS employer competing for the pool. Untested at scale — needs an on-ground validation pass."
  },
  siliguri: {
    name: "Siliguri", state: "West Bengal", stateKey: "wb", tier: 3, candidateOnly: true,
    lat: 26.7271, lng: 88.3953, wageZone: "Zone A",
    market: "Sevoke Rd corridor", rent: { low: 55, high: 75, grade: "B", asOf: "2025", note: "Small-format, retail-driven pricing; large floors thin." },
    presence: "low", players: [],
    catchment: "North Bengal + NE gateway: Bengali, Hindi and Nepali voice pool, North Bengal University. No organised ITES employer at scale; same validation caveat as Durgapur."
  },
  kanpur: {
    name: "Kanpur", state: "Uttar Pradesh", stateKey: "up", tier: 2, candidateOnly: true,
    lat: 26.4499, lng: 80.3319, wageZone: "Category II",
    market: "Kakadeo / Lajpat Nagar", rent: { low: 17, high: 22, grade: "B", asOf: "2025", note: "No Grade A office market." },
    presence: "low", players: [],
    catchment: "UP's second-largest graduate pool with almost no BPS employer bidding for it; the cheapest credible Hindi-belt voice catchment on this map."
  },
  aurangabad: {
    name: "Chh. Sambhajinagar", state: "Maharashtra", stateKey: "maharashtra", tier: 2, candidateOnly: true,
    lat: 19.8762, lng: 75.3433, wageZone: "Zone I",
    market: "City / Beed Bypass", rent: { low: 19, high: 27, grade: "B", asOf: "2025", note: "Thin data; no published Grade A market." },
    presence: "low", players: [],
    catchment: "Industrial city, Marathi+Hindi pool, very low BPS density. Zone I under the wage schedule — the saving vs MMR is rent and churn, not the floor."
  },
  mysore: {
    name: "Mysuru", state: "Karnataka", stateKey: "karnataka", tier: 2, candidateOnly: true,
    lat: 12.2958, lng: 76.6394, wageZone: "Zone 2",
    market: "Hebbal Industrial Area", rent: { low: null, high: null },
    presence: "medium", players: ["Infosys", "Teleperformance", "Excelsoft"],
    catchment: "Quality graduate pool 3 hours from Bengaluru, anchored by the Infosys campus; the standard first stop for Karnataka de-concentration."
  },
  hubli: {
    name: "Hubballi", state: "Karnataka", stateKey: "karnataka", tier: 2, candidateOnly: true,
    lat: 15.3647, lng: 75.1240, wageZone: "Zone 2",
    market: "Vidya Nagar / Aryabhata Tech Park", rent: { low: 45, high: 45, grade: "B", asOf: "2025", note: "Single published listing; broker check needed." },
    presence: "low", players: ["Infosys (Hubballi)"],
    catchment: "North Karnataka's education hub (Deshpande ecosystem, KLE colleges) with minimal BPS competition."
  },
  madurai: {
    name: "Madurai", state: "Tamil Nadu", stateKey: "tamilnadu", tier: 2, candidateOnly: true,
    lat: 9.9252, lng: 78.1198, wageZone: "Zone A",
    market: "ELCOT IT Park / Anna Nagar", rent: { low: 14, high: 37, grade: "B", asOf: "2025", note: "ELCOT government space typically below listed private rates." },
    presence: "medium", players: ["HCLTech", "Zoho (region)", "Techmango"],
    catchment: "Very large Tamil voice pool, ELCOT-subsidised space, rents a third of Chennai's corridor."
  },
  trichy: {
    name: "Tiruchirappalli", state: "Tamil Nadu", stateKey: "tamilnadu", tier: 2, candidateOnly: true,
    lat: 10.7905, lng: 78.7047, wageZone: "Zone A",
    market: "Thillai Nagar / Cantonment", rent: { low: 25, high: 41, grade: "B", asOf: "2025", note: "No published Grade A market." },
    presence: "low", players: [],
    catchment: "NIT Trichy plus a strong college belt; BHEL-town labour stability, low BPS competition."
  },
  warangal: {
    name: "Warangal", state: "Telangana", stateKey: "telangana", tier: 3, candidateOnly: true,
    lat: 17.9689, lng: 79.5941, wageZone: "Zone I",
    market: "Madikonda IT corridor", rent: { low: null, high: null },
    presence: "low", players: ["Tech Mahindra BPS"],
    catchment: "Kakatiya University + NIT Warangal catchment; Telangana government actively subsidises IT space here, and the Tech Mahindra BPS centre is the working precedent."
  }
};

/* ---------------------------------------------------------------------------
   DG_WAGES — statutory monthly minimum wage floors, shops & establishments
   schedule (BPO/call-centre employment falls under it). Latest notified rates
   found in public compliance trackers on the Sep 2026 research pass; cells a
   tracker derived rather than quoted are called out in each state's note.
   Every rendered table carries a VALIDATE VS GAZETTE flag — these steer the
   decision, the gazette settles the payroll.
--------------------------------------------------------------------------- */
window.DG_WAGES = {
  delhi: {
    state: "Delhi (NCT)", zoneSystem: "flat",
    zones: { "Statewide": { unskilled: 18456, semiSkilled: 20371, skilled: 22411, clerical: 24356 } },
    zoneDefinition: "Single rate across the NCT — the highest floor in the country",
    effective: "2025-04-01 (still in force Sep 2026; next revision due Oct 2026)",
    note: "Delhi skipped the Oct 2025 and Apr 2026 VDA revisions; the Apr 2025 order remains the current legal rate."
  },
  rajasthan: {
    state: "Rajasthan", zoneSystem: "flat",
    zones: { "Statewide": { unskilled: 7410, semiSkilled: 7722, skilled: 8034, highlySkilled: 9334 } },
    zoneDefinition: "One rate statewide — the lowest statutory floor among major states",
    effective: "2024-10-01 onward (latest notified)"
  },
  punjab: {
    state: "Punjab", zoneSystem: "flat",
    zones: { "Statewide": { unskilled: 13486, semiSkilled: 14383, skilled: 15414 } },
    zoneDefinition: "One rate statewide; S&E staff also graded A–D for clerical roles",
    effective: "2026-05-01 onward",
    note: "Large hike notified May 2026 — up from ~9,854 unskilled two months earlier."
  },
  up: {
    state: "Uttar Pradesh", zoneSystem: "district categories",
    zones: {
      "Category I":   { unskilled: 13690, semiSkilled: 15059, skilled: 16868 },
      "Category II":  { unskilled: 13006, semiSkilled: 14306, skilled: 16025 },
      "Category III": { unskilled: 12356, semiSkilled: 13590, skilled: 15224 }
    },
    zoneDefinition: "Cat I: Gautam Buddha Nagar (Noida) & Ghaziabad · Cat II: Nagar Nigam districts (Lucknow, Kanpur…) · Cat III: rest",
    effective: "2026-04-01 to 2026-09-30",
    note: "UP's first geographic split, notified Apr 2026 — Noida now carries a higher floor than Lucknow or Kanpur."
  },
  haryana: {
    state: "Haryana", zoneSystem: "flat",
    zones: { "Statewide": { unskilled: 15221, semiSkilled: 16781, skilled: 18501, highlySkilled: 19426 } },
    zoneDefinition: "One uniform rate across the state",
    effective: "2026-04-01 onward"
  },
  karnataka: {
    state: "Karnataka", zoneSystem: "3 zones (since 22 May 2026)",
    zones: {
      "Zone 1": { unskilled: 23376, semiSkilled: 25714, skilled: 28285, highlySkilled: 31114 },
      "Zone 2": { unskilled: 21251, semiSkilled: 23376, skilled: 25714, highlySkilled: 28285 },
      "Zone 3": { unskilled: 19319, semiSkilled: 21251, skilled: 23376, highlySkilled: 25714 }
    },
    zoneDefinition: "Zone 1: Greater Bengaluru · Zone 2: other municipal corporations + district HQs · Zone 3: rest of state",
    effective: "2026-05-22 onward (FY 2026-27)",
    note: "The ~60% May 2026 hike is under legal challenge; if stayed, the earlier 4-zone schedule (≈14,559–19,972) revives. Track the case before pricing anything off this table."
  },
  telangana: {
    state: "Telangana", zoneSystem: "3 zones (since Jun 2026)",
    zones: {
      "Zone I":   { unskilled: 16000, semiSkilled: 17000, skilled: 18500, highlySkilled: 20000 },
      "Zone II":  { unskilled: 15000, semiSkilled: 16000, skilled: 17500, highlySkilled: 19000 },
      "Zone III": { unskilled: 14000, semiSkilled: 15000, skilled: 16500, highlySkilled: 18000 }
    },
    zoneDefinition: "Zone I: municipal corporations (GHMC, Warangal…) · Zone II: municipalities · Zone III: gram panchayat areas",
    effective: "2026-06-01 onward",
    note: "First comprehensive re-fixation since state formation; Zone II/III skilled cells inferred from the notified ₹1,000 zone step."
  },
  kerala: {
    state: "Kerala", zoneSystem: "grades + district DA",
    zones: { "Statewide (Ernakulam DA)": { unskilled: 14020, semiSkilled: 14286, skilled: 14553, highlySkilled: 14804 } },
    zoneDefinition: "Kerala uses employment grades with district-wise DA, mapped here approximately at Ernakulam DA",
    effective: "2026-01-01 (DA re-indexed Apr 2026)",
    note: "Kerala runs a separate IT/ITeS scheduled employment (≈15,944–26,400/month) that likely governs call-centre staff — check which schedule applies before costing."
  },
  tamilnadu: {
    state: "Tamil Nadu", zoneSystem: "Zone A/B",
    zones: {
      "Zone A": { unskilled: 14044, semiSkilled: 14139, skilled: 14233 },
      "Zone B": { unskilled: 13972, semiSkilled: 14067, skilled: 14161 }
    },
    zoneDefinition: "Zone A: corporations & special-grade municipalities (Chennai, Coimbatore, Madurai…) · Zone B: rest — the zone spread is only ~₹70",
    effective: "2026-04-01 to 2027-03-31"
  },
  wb: {
    state: "West Bengal", zoneSystem: "Zone A/B",
    zones: {
      "Zone A": { unskilled: 10558, semiSkilled: 11615, skilled: 12777, highlySkilled: 14054 },
      "Zone B": { unskilled: 9760,  semiSkilled: 10736, skilled: 11810, highlySkilled: 12990 }
    },
    zoneDefinition: "Zone A: corporation, municipal and notified-authority areas (Kolkata, Durgapur, Siliguri all qualify) · Zone B: rest of state",
    effective: "2026-07-01 to 2026-12-31",
    note: "Zone B semi/skilled cells derived from WB's uniform 10% skill step. 'Skilled' explicitly covers clerks and data-entry operators."
  },
  jharkhand: {
    state: "Jharkhand", zoneSystem: "Areas A/B/C",
    zones: {
      "Area A": { unskilled: 13385, highlySkilled: 21300 },
      "Area C": { unskilled: 12150 }
    },
    zoneDefinition: "Area A: major corporations incl. Jamshedpur NAC/Mango/Adityapur · Area C: rural",
    effective: "2026-04-01 to 2026-09-30",
    note: "Public trackers only publish anchor cells for Jharkhand — the full matrix needs the Labour Dept table."
  },
  odisha: {
    state: "Odisha", zoneSystem: "flat",
    zones: { "Statewide": { unskilled: 12272, semiSkilled: 13572, skilled: 14872, highlySkilled: 16172, clerical: 14872 } },
    zoneDefinition: "Single zone; the skilled tier explicitly includes clerical",
    effective: "2026-04-01 to 2026-09-30"
  },
  bihar: {
    state: "Bihar", zoneSystem: "flat",
    zones: { "Statewide": { unskilled: 11336, semiSkilled: 11752, skilled: 14326, highlySkilled: 17472 } },
    zoneDefinition: "One rate statewide, all scheduled employments",
    effective: "2026-04-01 to 2026-09-30"
  },
  assam: {
    state: "Assam", zoneSystem: "flat",
    zones: { "Statewide": { unskilled: 10543, semiSkilled: 12257, skilled: 15323, highlySkilled: 19710, clerical: 15323 } },
    zoneDefinition: "Uniform statewide; the skilled tier covers clerical",
    effective: "2026-01-01 onward (order of Jun 2026, arrears from Jan)"
  },
  gujarat: {
    state: "Gujarat", zoneSystem: "Zone I/II",
    zones: {
      "Zone I":  { unskilled: 13325, semiSkilled: 13611, skilled: 13897 },
      "Zone II": { unskilled: 13039, semiSkilled: 13325, skilled: 13585 }
    },
    zoneDefinition: "Zone I: corporation, municipality & UDA areas · Zone II: rest of state",
    effective: "2026-04-01 to 2026-09-30",
    note: "Semi-skilled cells interpolated on Gujarat's standard ₹11/day basic step."
  },
  mp: {
    state: "Madhya Pradesh", zoneSystem: "flat",
    zones: { "Statewide": { unskilled: 12425, semiSkilled: 13421, skilled: 15144, highlySkilled: 16769 } },
    zoneDefinition: "One rate statewide for all 67 scheduled employments",
    effective: "2026-04-01 to 2026-09-30"
  },
  chhattisgarh: {
    state: "Chhattisgarh", zoneSystem: "Zones A/B/C",
    zones: {
      "Zone A": { unskilled: 11402, semiSkilled: 12234, skilled: 13482, highlySkilled: 14314 },
      "Zone B": { unskilled: 11142, semiSkilled: 11948, skilled: 13157, highlySkilled: 13963 },
      "Zone C": { unskilled: 10882, semiSkilled: 11662, skilled: 12832, highlySkilled: 13612 }
    },
    zoneDefinition: "Zone A: Raipur, Durg-Bhilai belt corporations · Zone B: other corporations · Zone C: rest",
    effective: "2026-04-01 to 2026-09-30",
    note: "Unskilled row is exact; higher tiers estimated from CG's standard basic differentials."
  },
  maharashtra: {
    state: "Maharashtra", zoneSystem: "Zone I/II/III",
    zones: {
      "Zone I":   { unskilled: 14155, semiSkilled: 14961, skilled: 15766 },
      "Zone II":  { unskilled: 13559, semiSkilled: 14365, skilled: 15170 },
      "Zone III": { unskilled: 12962, semiSkilled: 13768, skilled: 14573 }
    },
    zoneDefinition: "Zone I: all municipal corporation areas + industrial belts within 20 km (so Mumbai, Thane, Navi Mumbai, Pune, Nashik, Nagpur, Sambhajinagar are ALL Zone I) · Zone II: A/B-class municipal councils · Zone III: rest",
    effective: "2026-07-01 to 2026-12-31",
    note: "Zone I unskilled and skilled are notified figures; semi-skilled and Zone II/III skilled cells derived from the uniform skill step."
  }
};
