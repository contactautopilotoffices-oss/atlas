#!/usr/bin/env node
/* ============================================================================
   ATLAS · the Andheri Business Case Study 2026, as a workbook

     node scripts/examples/andheri-case.js     writes examples/andheri-case.xlsx

   Every table, chart point, paragraph and source line of the 33-page
   document, typed into the case study sheets the way a team member would.
   Not one computed figure is typed: the prices, the break-even, the levers
   and the money rows of the decision table come out of casestudy/costing.js
   from the eight inputs on the Options sheet. scripts/case.test.js reads
   this workbook back and checks the page prints the document's numbers.
   ============================================================================ */
"use strict";
const path = require("path");
const { buildCaseTemplate } = require("../lib/case-workbook");

function heads(ws) { const m = new Map(); ws.getRow(3).eachCell({ includeEmpty: false }, (c, i) => { const t = String(c.value == null ? "" : c.value).replace(/\*/g, "").trim(); if (t) m.set(t, i); }); return m; }
function addRow(ws, obj) { const h = heads(ws), r = ws.getRow(ws.rowCount + 1); for (const [k, v] of Object.entries(obj)) { const i = h.get(k); if (!i) throw new Error(`no column "${k}" on ${ws.name}`); r.getCell(i).value = v; } r.commit(); }
function setField(ws, label, v) { for (let r = 4; r <= ws.rowCount; r++) { const l = String(ws.getRow(r).getCell(1).value == null ? "" : ws.getRow(r).getCell(1).value).replace(/\*/g, "").trim(); if (l === label) { ws.getRow(r).getCell(2).value = v; return; } } throw new Error(`no field "${label}" on ${ws.name}`); }

async function build() {
  const wb = buildCaseTemplate();
  const S = (n) => wb.getWorksheet(n);

  /* ---- Case ---- */
  const C = S("Case");
  setField(C, "Title", "Andheri Business Case Study 2026");
  setField(C, "Kind", "Business case");
  setField(C, "Subtitle", "Marol, Andheri East, Mumbai. Privilon and 723 Avenue, side by side");
  setField(C, "Dated", "2026-10");
  setField(C, "Place", "Marol, Andheri East");
  setField(C, "City", "Mumbai");
  setField(C, "Prepared by", "Autopilot Offices");
  setField(C, "Cover line", "Speculative managed-office take-up by Autopilot Offices");
  setField(C, "Back page title", "Marol, Andheri East:\none stop from the airport, two lines at the door");
  setField(C, "Credits", "Prepared from the Andheri costing workbook, a Knight Frank market overview of Western Suburb 1 and public sources named on each page. Photographs are AI-generated illustrations (Higgsfield) and do not show either building.");

  /* ---- Assumptions ---- */
  const A = S("Assumptions");
  setField(A, "Running costs (per sq ft of carpet a month)", 75);
  setField(A, "Lock-in (months)", 60);
  setField(A, "Margin on cost (%)", 20);
  setField(A, "Sq ft of carpet a seat", 35);
  setField(A, "Efficiency (%)", 60);
  setField(A, "Brokerage (% of the bill)", 10);
  setField(A, "Ad budget a month", 150000);
  setField(A, "Ad budget floor a month", 135000);
  setField(A, "Ad budget note", "The sheet uses ₹5,000 a day (₹1.5 L a month). The ad plan's floor is ₹4,500 a day: LinkedIn ₹3,000 + Meta ₹1,500.");
  setField(A, "Target price a seat", 18000);
  setField(A, "Target price note", "Matches IA Spaces, inside 723 Avenue");
  setField(A, "Most rivals run from (%)", 75);
  setField(A, "Most rivals run to (%)", 80);
  setField(A, "Rivals occupancy note", "14 of the 30 that told us; none above 85%");
  setField(A, "National operators run from (%)", 83);
  setField(A, "National operators run to (%)", 93);
  setField(A, "National operators note", "Listed operators report 83 to 93% in centres open over a year");
  setField(A, "Walking speed (m a minute)", 80);
  setField(A, "Not in the costing sheet", "Rent escalation\nSecurity deposit\nMaintenance (CAM) on top of rent\nRent-free fit-out months\nGST");

  /* ---- Options ---- */
  const O = S("Options");
  addRow(O, { "ID": "privilon", "Name": "Privilon", "Carpet area (sq ft)": 15343, "Rent (per sq ft a month)": 405, "Rent quoted on": "carpet", "Efficiency (%)": 60, "Fit-out (per sq ft of carpet)": 2000,
    "Full name": "B Safal Privilon", "Developer": "Bsafal Properties, the Ahmedabad Bsafal group's first Mumbai project",
    "Address": "Next to Marol Naka metro, Gamdevi, Marol, Andheri East 400059", "Locality": "Marol", "Floors offered": "About two of its floors",
    "Stage today": "Under construction. Excavation done; basement and plinth about 40%; 19% complete overall", "Built?": "Not before 2030", "Built note": "still being built; RERA completion 31 Jan 2030",
    "RERA number": "P51800079264", "RERA completion": "31 January 2030", "Floors": "14 storeys, one tower (RERA lists 8 floors so far)", "Offices in total": "About 2.5 lakh sq ft on a 0.78-acre plot",
    "Floor plate": "Not published; largest units 7,500 to 7,700 sq ft", "Green rating": "IGBC Platinum pre-certified (design stage)", "Amenities": "11.7 ft ceilings, car and two-wheeler parking, power backup", "Who is there now": "Nobody yet",
    "Verdict": "Privilon: not for a 2026 launch", "Verdict text": "RERA puts completion in January 2030. Unless the landlord can show an earlier handover for our floors, treat Privilon as a future pre-lease, not this year's centre.",
    "Rent against the market": "About ₹243 built-up: above the top-building band", "Can we open this year?": "No: RERA completion Jan 2030", "Rival in the same building": "None yet",
    "Sources": "Bsafal Mumbai page; RERA copies on Square Yards, Ghar.tv, Quietlist (read 19 Jul and 6 Oct 2026) and Horizon (Sep 2026). Not taken from MahaRERA directly." });
  addRow(O, { "ID": "723-avenue", "Name": "723 Avenue", "Carpet area (sq ft)": 12950, "Rent (per sq ft a month)": 200, "Rent quoted on": "builtup", "Efficiency (%)": 60, "Fit-out (per sq ft of carpet)": 1800,
    "Full name": "Wadhwa 723 Avenue", "Developer": "House of Wadhwa (Mumbai, since 1964); RERA promoter Harshvardhan Constructions",
    "Address": "CTS 723, Marol Co-op Industrial Estate Road, off Andheri Kurla Road; Raheja Platinum next door", "Locality": "Marol", "Floors offered": "One floor",
    "Stage today": "Built. Launched April 2023. No occupancy certificate found", "Built?": "Built", "Built note": "occupancy certificate not yet found",
    "RERA number": "P51800050698", "RERA completion": "31 May 2026 (one site shows 30 Sep 2026)", "Floors": "Marketed 3 basements + G + 14; RERA lists G + 8", "Offices in total": "About 2 lakh sq ft",
    "Floor plate": "About 8,000 sq ft", "Green rating": "None found; double glazing, fresh-air system, EV charging", "Amenities": "Rooftop restaurant, terrace garden, amphitheatre park, 150+ car parks, VRF air-conditioning, building management", "Who is there now": "IA Spaces (coworking, ₹18,000 a desk)",
    "Verdict": "723 Avenue: papers first", "Verdict text": "Ask for the occupancy certificate for our floors before we sign. RERA lists G + 8 against a marketed G + 14, and two trackers say quarterly RERA updates were missed.",
    "Rent against the market": "₹200: top-building rent; area average ₹167", "Can we open this year?": "Yes, once the occupancy certificate is seen", "Rival in the same building": "IA Spaces at ₹18,000",
    "Sources": "House of Wadhwa project page; Wadhwa 723 Avenue brochure (Jan 2025); Cityinfo; myHQ listing for IA Spaces." });

  /* ---- Access ---- */
  const X = S("Access");
  for (const [opt, name, mode, m, line, note] of [
    ["privilon", "SEEPZ Marol Naka bus", "bus", 60, "", ""],
    ["privilon", "Marol Naka metro", "metro", 89, "Line 1 and Line 3 (Aqua)", ""],
    ["privilon", "Airport Road bus", "bus", 350, "", ""],
    ["privilon", "Airport Road metro", "metro", 500, "Line 1", ""],
    ["723-avenue", "Gamdevi bus", "bus", 120, "", ""],
    ["723-avenue", "Mittal Estate bus", "bus", 350, "", ""],
    ["723-avenue", "Marol Naka metro", "metro", 700, "Line 1 and Line 3 (Aqua)", "550 m on myHQ, 1 km in the brochure"],
    ["723-avenue", "Airport Road metro", "metro", 1300, "Line 1", ""],
  ]) addRow(X, { "Option": opt, "Stop or station": name, "Mode": mode, "Distance (m)": m, "Line": line, "Note": note });

  /* ---- Rivals: the 31-centre survey ---- */
  const R = S("Rivals");
  const riv = (op, bld, loc, grade, price, lo, hi, near, same, note) => addRow(R, { "Operator": op, "Building": bld, "Locality": loc, "Grade": grade, "Price a seat a month": price, "Occupancy from (%)": lo, "Occupancy to (%)": hi, "Next to our buildings?": near ? "yes" : "no", "In one of our buildings?": same || "", "Note": note || "" });
  riv("WeWork", "Raheja Platinum", "Marol", "A", 26500, 80, 85, true, "", "Next door to 723 Avenue; sets the ceiling");
  riv("IA Spaces", "723 Avenue", "Marol", "A", 18000, undefined, undefined, true, "723-avenue", "Did not share occupancy");
  riv("Teloz Space", "AJ House", "Marol", "B", 14500, 75, 80, true);
  riv("Awfis", "Vaman Techno Centre", "Marol", "A", 13000, 80, 85, true);
  riv("Innov8", "Pan Infotech", "Marol", "B", 13000, 75, 80, true);
  riv("91springboard", "Lotus Star", "Marol", "B", 11800, 80, 85, true);
  riv("Smartworks", "Fleet House", "Marol", "A", 10000, 80, 85, true);
  riv("AKT", "", "Chakala", "A", 35000, 70, 75);
  riv("DBS", "Kanakia Wallstreet", "Chakala", "A", 20000, 70, 75);
  riv("Quest CoWorks", "Technopolis", "Chakala", "A", 18000, 75, 80);
  riv("Innov8", "Solitaire Corporate Park", "Chakala", "B", 17000, 75, 80);
  riv("Akasa Coworking", "Satellite Gazebo", "Chakala", "A", 14000, 70, 75);
  riv("Innov8", "Boston House", "Chakala", "A", 13000, 75, 80);
  riv("Inspire Coworking", "", "Chakala", "A", 13000, 75, 80);
  riv("Table Space", "R Square", "Marol", "A", 30000, 75, 80);
  riv("Innov8", "", "Marol", "A", 16000, 75, 80);
  riv("Awfis", "Skyline Icon", "Marol", "A", 13000, 80, 85);
  riv("Zon Collab", "Indiana Business Centre", "Marol", "B", 13000, 75, 80);
  riv("Smartworks", "Times Square", "Marol", "A", 10000, 75, 80);
  riv("Innov8", "", "JB Nagar", "A", 18000, 75, 80);
  riv("DevX", "Dynasty Business Park", "JB Nagar", "B", 16000, 70, 75);
  riv("DevX", "215 Atrium", "JB Nagar", "A", 15000, 70, 75);
  riv("Lets Work", "VKG Corporate Park", "JB Nagar", "A", 15000, 70, 75);
  riv("Executive Spaces", "Trade Star", "JB Nagar", "A", 13500, 70, 75);
  riv("Dextrus", "Sahar Plaza (Mint)", "Bhim Nagar", "A", 28000, 75, 80);
  riv("SynQ Work", "Windfall", "Bhim Nagar", "A", 18000, 70, 75);
  riv("Executive Spaces", "Chintamani Plaza", "W. Express Highway", "B", 14000, 70, 75);
  riv("Executive Spaces", "Rustomjee Central Park", "W. Express Highway", "A", 13000, 70, 75);
  riv("WeWork", "Lightbridge", "Chandivali", "A", 25000, 75, 80);
  riv("Simpliwork", "Prime Bay", "Chandivali", "A", 18000, 60, 65);
  riv("Incuspaze", "Lighthall", "Chandivali", "A", 15000, 75, 80);

  /* ---- Openings ---- */
  const Op = S("Openings");
  for (const [op, seats, area, bld, when, note] of [
    ["Table Space", 1500, "1.31 lakh sq ft", "R Square, Andheri Kurla Rd", "Jan 2024", ""],
    ["Kontor Space", 500, "", "Ackruti Star, MIDC Marol", "Jul 2024", "75% let on day one"],
    ["Innov8", 1500, "about 1 lakh sq ft", "Zion, Western Express Highway", "Dec 2024", ""],
    ["WeWork India", 2000, "1.27 lakh sq ft", "Lightbridge, Saki Vihar Road", "Apr 2025", ""],
    ["Smartworks", undefined, "1,82,300 sq ft", "The Square, near T2", "Feb 2026", "seats not published"],
    ["Quest CoWorks", undefined, "57,500 sq ft", "Akruti Softech Park, MIDC", "Mar 2026", "bought for ₹55.84 Cr"],
  ]) addRow(Op, { "Operator": op, "Seats": seats, "Area": area, "Building": bld, "When": when, "Note": note });

  /* ---- KPIs ---- */
  const K = S("KPIs");
  const kpi = (section, value, label, sub, option) => addRow(K, { "Section": section, "Value": value, "Label": label, "Second line": sub || "", "Option": option || "" });
  kpi("cover", "seats", "seats, at 35 sq ft of carpet a seat", "Privilon · 723 Avenue");
  kpi("cover", "price", "price we need a seat, a month, to cover every cost and earn 20% on top", "");
  kpi("cover", "breakEven", "full on either floor; most rivals here run 75 to 80% full", "");
  kpi("cover", "rivalsMedian", "middle price a seat across the rival centres we surveyed", "");
  kpi("options", "carpet", "carpet area", "", "privilon");
  kpi("options", "carpet", "carpet area", "", "723-avenue");
  kpi("options", "60 months", "lock-in on both", "");
  kpi("assets", "89 m", "from Privilon to Marol Naka metro", "");
  kpi("assets", "31 Jan 2030", "Privilon's RERA completion date", "");
  kpi("assets", "G + 14", "723 Avenue as marketed; RERA lists G + 8", "");
  kpi("market", "10.85%", "Andheri Kurla vacancy, Q2 2026", "down from 17.0%");
  kpi("market", "₹167", "average rent a sq ft a month", "up from ₹138");
  kpi("market", "25,820", "flex seats leased in Mumbai, H1 2026", "+130%");
  kpi("infrastructure", "1.61 lakh", "riders a day on the Aqua Line, July 2026", "");
  kpi("why", "1 stop", "from Marol Naka to Airport T2 on the Aqua Line", "");
  kpi("rivals", "rivals", "rival centres surveyed", "");
  kpi("rivals", "rivalsRange", "price range a seat, a month", "");
  kpi("rivals", "75 to 80%", "how full most of them run", "");
  kpi("back", "priceLow", "a seat needed at 723 Avenue; ₹21,560 at Privilon", "");
  kpi("back", "breakEven", "full to cover every cost, either floor", "");
  kpi("back", "rivals", "rival centres; middle price ₹15,000", "");
  kpi("back", "2030", "Privilon's RERA completion date", "");

  /* ---- Series (charts) ---- */
  const Se = S("Series");
  const pt = (chart, label, value, value2, flag, note) => addRow(Se, { "Chart": chart, "Label": label, "Value": value, "Second value": value2, "Flag": flag || "", "Note": note || "" });
  for (const [l, v] of [["Q4 23", 17.0], ["Q4 24", 13.5], ["Q1 25", 13.1], ["Q4 25", 12.6], ["Q2 26", 10.85]]) pt("vacancy", l, v, undefined, "", l === "Q2 26" ? "a 16-year low (JLL)" : "");
  for (const [l, v] of [["Q4 24", 138.1], ["Q1 25", 150.2], ["Q4 25", 159], ["Q2 26", 166.87]]) pt("rent", l, v);
  pt("absorptionShare", "H1 2026", 19, undefined, "", "about 21% across 2025");
  for (const [l, lo, hi, f] of [["2022", 130, 140, ""], ["2023", 140, 145, ""], ["2024", 150, 165, ""], ["2025", 170, 190, ""], ["2026 (P)", 190, 210, "projection"]]) pt("topBand", l, lo, hi, f);
  pt("flexSeats", "H1 2025", 11226); pt("flexSeats", "H1 2026", 25820);
  for (const [l, v] of [["Table Space", 92.6], ["IndiQube", 90], ["Smartworks", 89], ["WeWork India", 87.5], ["Awfis", 83]]) pt("operatorOccupancy", l, v);

  /* ---- Deals ---- */
  const D = S("Deals");
  for (const [who, area, rent, bld, when, kind, note] of [
    ["HDFC Bank", "2,72,000 sq ft", "₹237", "R Square, JB Nagar", "Jan 2025", "occupier", "₹6.45 Cr a month on carpet"],
    ["Smartworks", "1,82,300 sq ft", "not disclosed", "The Square, near T2", "Feb 2026", "flex operator", ""],
    ["Table Space", "84,347 sq ft", "₹185", "R Square", "", "flex operator", "Knight Frank"],
    ["Eternal (Zomato)", "84,157 sq ft", "₹160", "R Square", "May 2025", "occupier", ""],
    ["Julius Baer (GCC)", "74,037 sq ft", "₹215", "Waterstones", "May 2026", "global centre", "Knight Frank lists 50,000 sq ft at ₹210"],
    ["Grid Controller of India", "35,237 sq ft", "₹163", "Lighthall", "", "occupier", "Knight Frank"],
    ["Sugar Cosmetics", "14,000 sq ft", "not disclosed", "300-seat managed office", "Mar 2025", "occupier", ""],
    ["Unext Learning", "9,052 sq ft", "₹196", "Timesquare", "", "occupier", "Knight Frank"],
  ]) addRow(D, { "Who": who, "Area": area, "Rent": rent, "Building": bld, "When": when, "Kind": kind, "Note": note });

  /* ---- Occupiers ---- */
  const Oc = S("Occupiers");
  const occ = (sector, share, w5, w10, fit, note) => addRow(Oc, { "Sector": sector, "Share of leasing": share, "Within 5 km": w5, "Within 10 km": w10, "Fit": fit, "Note": note || "" });
  occ("Banking, finance and insurance", "29.5% of Mumbai leasing, Apr to Jun 2026", "HDFC Bank (R Square); Julius Baer's global centre (Waterstones); SBI Life head office; Angel One (Ackruti Star); Equifax (Solitaire); Nuvama, ICICI Lombard, Manappuram (Kanakia Wallstreet)", "CRISIL; Nomura; JP Morgan Services; TIAA; M&G Global Services (Powai)", "strong");
  occ("IT, SaaS and tech global centres", "20.3% of Mumbai leasing, Apr to Jun 2026", "TCS; Zycus; Indus Valley Partners; Lumina Datamatics; Mastek (SEEPZ); Datamatics head office (MIDC); Eternal / Zomato (R Square)", "LTIMindtree; General Mills India; Deloitte (Powai)", "strong");
  occ("Aviation and logistics", "clustered around the airport", "Mumbai International Airport (Adani); Blue Dart head office (Sahar); DHL Express head office (Chakala); DB Schenker (MIDC, Sahar cargo)", "Allcargo Logistics and Gati (Kalina)", "good");
  occ("Pharma, med-tech and healthcare", "head offices along Chakala and the highway", "Glenmark head office (Chakala); Medtronic India (Solitaire); Apiore Pharmaceutical (Kanakia Wallstreet)", "Sanofi India (Powai); Sun Pharma (Goregaon East); Lupin (Santacruz East)", "good");
  occ("Media and consumer brands", "Andheri's traditional strength", "Shemaroo (Marol); UFO Moviez (MIDC); Sugar Cosmetics (300 seats, managed office); Skechers South Asia (Sahar Road); Coca-Cola (Kanakia Wallstreet)", "Culver Max / Sony (Goregaon East); Colgate-Palmolive head office (Powai)", "good");
  occ("Gems and jewellery", "mostly factories", "Renaissance Global; Goldiam; Tara Jewels; Shanker Jewels (SEEPZ): their corporate and design teams only", "", "weak", "a weak fit");

  /* ---- Pools ---- */
  const P = S("Pools");
  addRow(P, { "Title": "Geographic catchment", "Chain": "Marol; Chakala; JB Nagar; Saki Naka; MIDC and SEEPZ; Chandivali; Powai", "Text": "Andheri East's office belt and its eastern neighbour Powai, within one metro ride or a short drive. Both suburban railway lines feed it through Line 1.", "Big number": "2 lines", "Big number label": "meet at Marol Naka; Airport T2 one stop away" });
  addRow(P, { "Title": "Company catchment", "Chain": "Banks and financial firms; global capability centres; IT and SaaS; aviation and logistics; pharma; media and consumer brands", "Text": "Mid-size firms and smaller global centres that need 40 to 100+ seats, fast, without a fit-out of their own, named on the previous page.", "Big number": "50%", "Big number label": "of Mumbai's leasing came from banks and IT, Apr to Jun 2026" });
  addRow(P, { "Title": "Flex demand catchment", "Chain": "WeWork; Table Space; Smartworks; Awfis; Innov8; Simpliwork; Incuspaze; Executive Spaces; DevX", "Text": "Members already in flex centres nearby: prospects for expansion, relocation, consolidation or an upgrade at renewal.", "Big number": "31 centres", "Big number label": "in our survey, from ₹10,000 to ₹35,000 a seat" });

  /* ---- Points ---- */
  const Pt = S("Points");
  const point = (section, n, title, text, kpi, kpiLabel, mitigate, chart) => addRow(Pt, { "Section": section, "Number": n, "Title": title, "Text": text, "Big number": kpi || "", "Big number label": kpiLabel || "", "How we reduce it": mitigate || "", "Chart": chart || "" });
  point("market", 1, "Demand is absorbing supply", "Vacancy fell from 17% to under 11% in eighteen months while average rent rose 21%. Occupiers are taking space faster than it is built. Andheri Kurla takes about a fifth of all office space absorbed in Mumbai.", "3.10 mn sq ft", "new supply planned or under construction in Andheri Kurla to 2028", "", "vacancy");
  point("market", 2, "The best buildings already ask ₹190 to 210", "723 Avenue's ₹200 is a top-building rent: inside Knight Frank's 2026 band, about 20% above the area average. Privilon's ₹405 on carpet sits above even the top band unless much more than 60% of it is usable. Ask for its built-up area and loading. Rents are rising, so a 60-month lock-in protects our cost, if escalation is kept modest.", "", "", "", "topBand");
  point("market", 3, "A landlord's market, with rents still rising", "Knight Frank's property clock puts Andheri in 'rents rising' and the market balanced, leaning to landlords. Consumer brands, healthcare, IT and media rent here: a front-office market of client-facing teams, not back offices. Rising rents favour a managed office: members avoid fit-out and long leases in a market that is getting dearer. Landlords have the edge, so expect little give on headline rent; spend the negotiating effort on rent-free months, escalation and deposit.");
  point("market", 4, "Large occupiers keep signing here", "Banks, global centres and operators all take big floors here at ₹160 to 240 a sq ft. Flex operators are among the largest takers: Smartworks and Table Space alone signed over 2.6 lakh sq ft. Watch: Bank of America's centre is moving from Andheri to Powai.", "1.2 mn sq ft", "leased by global capability centres in Mumbai in six months, H1 2026 (Colliers)");
  point("market", 5, "Flex is an established product in Mumbai", "We enter a flex market that is already large and growing fast; we do not have to create the demand. Deals have doubled in size to about 50 seats: our 40 to 100+ seat buyer is the typical buyer now. Settled national centres run 83 to 93% full, but it takes them 12 to 14 months to get there.", "23.8%", "flex share of Mumbai leasing, Apr to Jun 2026 (JLL); 28% across 2025 (Knight Frank)", "", "flexSeats");
  point("infrastructure", 1, "Metro Line 3 (Aqua), fully open", "Opened end to end on 9 Oct 2025: 33.5 km, 27 stations. About 1.61 lakh riders a day in July 2026. Marol Naka was its busiest station in the first quarter.");
  point("infrastructure", 2, "Metro Line 1, more trains", "About 5 lakh riders a weekday. From 10 Aug 2026, evening trains between Andheri and Ghatkopar run every 3 minutes, room for 28,000 more riders.");
  point("infrastructure", 3, "Navi Mumbai airport and the T1 to T2 shift", "Navi Mumbai opened in Dec 2025; 30% of Mumbai's international flights moved there on 1 Oct 2026. From 25 Oct a third of T1's flights move to T2, next to Marol.");
  point("infrastructure", 4, "Gokhale bridge reopened", "The Andheri West to East road link reopened fully in May 2025, seven years after it closed. Easier for staff and clients driving in from the west.");
  point("infrastructure", 5, "Metro Line 7A delayed", "The 3.4 km Andheri East to T2 link is now unlikely in 2026-27 after a design clash with airport height limits. Marol already reaches T2 by Line 3.");
  point("infrastructure", 6, "New office supply after 2028", "Prestige and Advent plan 1.5 mn sq ft at Sahar; Hiranandani a 4 lakh sq ft tower in Andheri East. New competition arrives in 2028 to 30, with Privilon.");
  point("why", 1, "On the metro grid", "Two lines meet at Marol Naka. Line 3 reaches BKC, Worli and Churchgate; Line 1 links both suburban railway lines. Privilon is a one-minute walk.");
  point("why", 2, "Next to the airport", "Airport T2 is one stop away. Knight Frank calls Andheri East a front-office hub for shipping and logistics: firms that fly clients in.");
  point("why", 3, "Rents only going one way", "Grade-A rent rose from ₹130 to 140 (2022) to ₹190 to 210 (2026 projection). Firms that want to avoid fit-out and long leases turn to managed offices.");
  point("why", 4, "Big names already here", "HDFC Bank took 2.72 lakh sq ft at R Square; Zomato and Julius Baer's global centre followed. Glenmark, SBI Life, DHL and Blue Dart have head offices here.");
  point("why", 5, "A proven flex market", "Mumbai flex leasing rose 130% in a year, and 31 rival centres sit between Saki Naka and the highway, charging ₹10,000 to 35,000 a seat.");
  point("plan", 1, "Broker-led commercialisation", "Curate: 25 to 60 brokers across the western suburbs, split Tier 1, 2 and 3; pick the ones who already close ₹15,000 to 22,000-a-seat deals in Andheri East, Powai and BKC. Activate: a Tier-1 walkthrough of the floor; hand over the ammunition: floor plans, price card, the metro map and the rival price ladder. Incentivise: standard brokerage plus a bonus on the first three closures, a time-bound first-mover incentive, and protected accounts so brokers trust us.", "brokerage", "of the monthly bill, for as long as we bill");
  point("plan", 2, "Named account ABM", "Build 100 to 150 priority accounts from the sectors in the market section: banks and financial firms, global capability centres, logistics and aviation, IT and consulting. For each: company, contact, LinkedIn, email, headcount, location, trigger, seat estimate. Automate the touches; BD personally follows the top accounts.");
  point("plan", 3, "High-volume outbound", "Twenty calls a person a day, but do not measure calls. Measure the funnel: calls, conversations, qualified opportunities, site visits, proposals, closures.");
  point("plan", 4, "Inbound", "Meta, Google and LinkedIn ads pointing at the metro story: 'one minute from Marol Naka' (Privilon) or 'one stop from T2' (both).", "ads", "a month, minimum: one ad, one location");
  point("plan", 5, "Affiliate", "If brokers, ABM and inbound do not fill the floor fast enough, switch on affiliate platforms such as myHQ after three to four months to widen reach. myHQ already lists IA Spaces inside 723 Avenue; expect members to compare us side by side.");
  point("risks", 1, "Occupancy risk", "Both floors cover every cost only above 83% full. Most rival centres here run 75 to 80%. National brands reach 83 to 93%, but only after 12 to 14 months. At 80% full the sheet's price loses ₹3.15 L a month at Privilon and ₹2.27 L at 723 Avenue.", "breakEven", "needed to break even", "Rent-free fit-out months; an anchor client before opening; a 12-month sales plan.");
  point("risks", 2, "Price and sales-cost risk", "We need ₹18,410 to 21,560 a seat; the middle rival price is ₹15,000. IA Spaces sells at ₹18,000 inside 723 Avenue. Brokerage adds another 10%, and discounts to close deals cut straight into the margin.", "rivalsMedian", "middle rival price", "Negotiate the rent to quote ₹18,000 or less; sell direct where we can.");
  point("risks", 3, "Building risk", "Privilon's RERA completion date is 31 Jan 2030; it is 19% built. 723 Avenue: no occupancy certificate found; RERA lists G + 8 against a marketed G + 14. Larger new supply (Sahar, Hiranandani) arrives in 2028 to 30.", "2030", "Privilon completion (RERA)", "Occupancy certificate and RERA check before any deposit; written handover date.");

  /* ---- Lists ---- */
  const L = S("Lists");
  const li = (list, item, note) => addRow(L, { "List": list, "Item": item, "Note": note || "" });
  li("askFor", "Rent-free months to cover the fit-out. Total Environment gave five at Whitefield; neither Andheri quote has any.");
  li("askFor", "A rent that lets us quote ₹18,000 a seat or less: ₹194 a sq ft built-up at 723 Avenue, ₹320 a sq ft carpet at Privilon.");
  li("askFor", "Escalation, deposit and maintenance charges in writing: the sheet has none of them, and each one moves the price.");
  for (const n of ["Sugar Cosmetics", "Indus Valley Partners", "Zycus", "Equifax", "Kanakia Wallstreet tenants", "ISS", "M&G Global Services", "TIAA", "University of York", "University of Western Australia"]) li("firstCalls", n);
  for (const n of ["Floor plans and seat counts", "Price card per seat and per cabin", "The metro map", "The rival price ladder", "Protected-account rules and the bonus calendar"]) li("pack", n);
  li("watchlist", "Bank of America's Andheri centre is moving to Powai: big occupiers can and do leave the area.");
  li("watchlist", "From October 2026 about 30% of Mumbai's international flights use Navi Mumbai; some visiting clients will land across the harbour.");
  li("watchlist", "Smartworks signed 1.82 lakh sq ft at The Square near T2 in February 2026: a large new rival opening close by.");
  li("questions", "Is Privilon meant as a pre-lease, or has the landlord offered an earlier handover?");
  li("questions", "Which floors at 723 Avenue, and do they have an occupancy certificate?");
  li("questions", "Do we keep 35 sq ft a seat, or plan denser?");

  /* ---- Decision ---- */
  const Dc = S("Decision");
  const dq = (q, a1, a2, edge, code) => { addRow(Dc, { "Question": q, "Option": "privilon", "Answer": a1 || "", "Edge": edge || "", "Code": code || "" }); addRow(Dc, { "Question": q, "Option": "723-avenue", "Answer": a2 || "" }); };
  dq("Can we open in 2026-27?", "No: RERA completion Jan 2030", "Yes, once the occupancy certificate is seen", "723-avenue");
  dq("Walk to Marol Naka metro", "", "", "privilon", "walk");
  dq("Seats to sell", "", "", "privilon", "seats");
  dq("Cost a month", "", "", "723-avenue", "cost");
  dq("Fit-out", "", "", "723-avenue", "fitout");
  dq("Price we need a seat", "", "", "723-avenue", "price");
  dq("Rent vs the market", "About ₹243 built-up: above the top-building band", "₹200: top-building rent; area average ₹167", "723-avenue");
  dq("Rival in the same building", "None yet", "IA Spaces at ₹18,000", "privilon");
  dq("Profit a month, full", "", "", "privilon", "profit");
  dq("Full enough to cover every cost", "", "", "level", "breakEven");
  dq("Locked in over 60 months", "", "", "723-avenue", "commitment");

  /* ---- Copy ---- */
  const Cp = S("Copy");
  const cp = (key, text, role) => addRow(Cp, { "Where": key, "Text": text, "Role": role || "means" });
  cp("readFirst", "Privilon is still being built. Its RERA completion date is 31 Jan 2030, so it cannot host a 2026-27 launch.", "intro");
  cp("readFirst", "At the sheet's prices, either floor covers every cost only above 83% full. 14 of 30 rival centres run 75 to 80%.", "intro");
  cp("readFirst", "723 Avenue needs ₹18,410 a seat. IA Spaces sells in the same building at ₹18,000. A 3% lower rent closes the gap.", "intro");
  cp("options", "Two office floors in Marol, priced with one costing sheet: fit-out recovered over a 60-month lock-in, 20% added on top of cost, one seat for every 35 sq ft of carpet.", "intro");
  cp("options", "Every number below is from the Andheri costing sheet unless the last column says otherwise.", "note");
  cp("costing", "The 20% is added to cost. As a share of what we bill, it is 16.7%. The price assumes every seat is sold, every month; the occupancy page shows what happens when they are not. Brokerage is modelled as 10% of the monthly bill, for as long as we bill.", "note");
  cp("earns", "Privilon earns ₹4.40 L more a month when full, but costs ₹22.0 L more a month and needs ₹3,150 more for every seat.");
  cp("earns", "Rent is 79% of Privilon's cost and 76% of 723 Avenue's. The rent we agree decides the price we can quote.");
  cp("earns", "Over the lock-in we commit ₹40.4 Cr at Privilon and ₹28.2 Cr at 723 Avenue, before any escalation.");
  cp("seat", "At ₹21,560, Privilon prices above 26 of the 31 rival centres. Only WeWork (two centres), Table Space, Dextrus and AKT charge more.");
  cp("seat", "At ₹18,410, 723 Avenue is ₹410 above IA Spaces in the same building, and ₹8,090 below WeWork next door.");
  cp("seat", "Paying brokers 10% adds ₹2,156 (Privilon) and ₹1,841 (723 Avenue) a seat. Direct sales protect the price.");
  cp("occupancy", "The sheet's 20% only appears when the floor is full. At 80% full, Privilon loses ₹3.15 L a month and 723 Avenue ₹2.27 L.");
  cp("occupancy", "To earn at rivals' occupancy we need a lower cost, not a higher price: at 75 to 80% full, the rent has to come down.");
  cp("levers", "Not agreed with either landlord. These are our own calculations of what each lever is worth, on the sheet's method.", "intro");
  cp("levers", "A 3% lower rent puts us level with the only operator already in the building. A 21% cut, or 14% with the five rent-free months we won at Whitefield.");
  cp("assets", "Privilon, a tower being built beside Marol Naka metro station, and 723 Avenue, a finished building off the Andheri Kurla Road. Both are in Marol, Andheri East.", "intro");
  cp("access", "Marol Naka is where Line 1 and Line 3 cross. In the Aqua Line's first quarter it was the line's busiest station: 16.45 lakh entries and exits.");
  cp("access", "From Marol Naka one ride reaches BKC, Worli and Churchgate; Airport T2 is the next stop. Line 1 links both suburban railway lines.");
  cp("access", "Privilon is a one-minute walk. 723 Avenue is seven to nine minutes: fine, but not a selling point.");
  cp("market", "A front-office market where vacancy is falling, rents are rising, landlords hold the stronger hand, and flex is already an established product.", "intro");
  cp("catchment", "Start account-based selling with banks and tech global centres: together, half of Mumbai's office leasing this year.");
  cp("catchment", "Aviation and logistics firms value the airport next door; pharma and media head offices bring client-facing teams that suit a managed office.");
  cp("pools", "Three pools, one pipeline: the plan turns them into named accounts.");
  cp("pools", "Renewal dates in rival centres are the cheapest leads we will find.");
  cp("infrastructure", "Marol's metro access is already built, not promised: two lines meet at its door. The airport shifts bring more flights, and more traffic, to T2 next door.");
  cp("infrastructure", "The new office supply on the way lands around 2028 to 30. Signing a finished floor now gets us two to three years ahead of it.");
  cp("why", "Why Andheri East gives us the conditions to make the speculative model work", "intro");
  cp("why", "But location is not the whole case. The market works. Whether our floor works depends on the price we can quote.");
  cp("plan", "Brokers bring the 40 to 100-seat buyers fastest, but 10% of the bill is the most expensive line after rent. Use them to fill the floor's first half; sell the second half direct.");
  cp("pipelines", "The two cheapest pipelines (ABM and outbound) carry no brokerage, so every seat they sell keeps the full margin.");
  cp("pipelines", "Ads at ₹1.35 to 1.5 L a month add ₹342 to 405 a seat: small next to brokerage at ₹1,841 to 2,156.");
  cp("rivals", "31 managed-office and coworking centres between Saki Naka and the Western Express Highway: who they are, what they charge, and how full they run.", "intro");
  cp("rivals", "WeWork at Raheja Platinum, next door to 723 Avenue, sets the ceiling at ₹26,500.");
  cp("rivals", "Smartworks (₹10,000), 91springboard and Awfis (₹11,800 to 13,000) set the floor, and are the fullest, at 80 to 85%.");
  cp("rivals", "At the sheet's price, either building would be the second-dearest centre here, behind only WeWork.");
  cp("openings", "The big brands are adding thousands of seats a year nearby. Our 370 to 438 seats are small next to them.");
  cp("openings", "We do not win on size. We win on fit, service and price for the 40 to 100-seat buyer.");
  cp("occupancyRivals", "The fullest five are national brands, mostly at ₹10,000 to 13,000. The ten at 70 to 75% are smaller operators at ₹13,000 to 20,000: our price bracket.");
  cp("occupancyRivals", "Plan year one at 75% full, not 85%.");
  cp("ladder", "17 of 31 centres sell at ₹15,000 or less. Most buyers here shop in that band.");
  cp("ladder", "Above ₹20,000 sit only big brands, WeWork and Table Space, and a few boutique operators.");
  cp("ladder", "A new name needs a reason to charge ₹18,000+: a better building, a metro door, or service. Privilon has the door; 723 Avenue must win on service.");
  cp("decision", "723 Avenue is the case for this year. It is built, its rent is the market rate, and a 3% lower rent lets us match IA Spaces at ₹18,000. Sign only with the occupancy certificate in hand, rent-free fit-out months, and a plan to reach 83% full.", "read");
  cp("decision", "Privilon is the better address, but not this year's building. Keep it as a pre-lease conversation for 2029-30, at a rent that brings the seat price near ₹18,000.", "read");

  /* ---- Sources ---- */
  const Sr = S("Sources");
  const src = (key, text) => addRow(Sr, { "Where": key, "Source": text });
  src("options", "Andheri costing workbook (Costing sheet). Building stage: MahaRERA records P51800079264 (Privilon) and P51800050698 (723 Avenue) as shown on Square Yards, Quietlist and Horizon, read 7 Oct 2026.");
  src("costing", "Andheri costing workbook, Costing and Marketing Cost sheets, formulas reproduced exactly. Rupee figures rounded to the nearest rupee.");
  src("earns", "Andheri costing workbook (Costing sheet). Profit is the 20% margin when every seat is billed. 60-month commitment = rent × 60 + fit-out; the sheet has no escalation, deposit or CAM line.");
  src("seat", "Andheri costing workbook (Costing sheet), per-seat lines = each monthly line ÷ seats. Rival prices: Andheri competitor survey (Competitors sheet), list prices before taxes.");
  src("occupancy", "Andheri costing workbook; Andheri competitor survey (occupancy bands as reported); listed operators' Q1 FY27 releases.");
  src("levers", "Andheri costing workbook (Costing sheet); price = (rent + fit-out ÷ 60 + ₹75) × 35 × 1.2 per sq ft of carpet. Rent-free months assumed to reduce rent paid across the 60-month lock-in. Whitefield terms: Whitefield Business Case Study 2026, page 3.");
  src("assets", "Bsafal Mumbai page; RERA copies on Square Yards, Ghar.tv, Quietlist (read 19 Jul and 6 Oct 2026) and Horizon (Sep 2026); House of Wadhwa project page; Wadhwa 723 Avenue brochure (Jan 2025); Cityinfo; myHQ listing for IA Spaces. Not taken from MahaRERA directly.");
  src("access", "Andheri costing workbook (Connectivity sheet: distances); myHQ and Wadhwa brochure (723 Avenue metro distance); Free Press Journal, 10 Jan 2026 (Marol Naka ridership, Oct to Dec 2025); Aqua Line full opening 9 Oct 2025. Walking time = distance ÷ 80 m a minute.");
  src("market", "Cushman & Wakefield MarketBeat, Mumbai office, Q4 2023 to Q2 2026 (Andheri-Kurla submarket); JLL Mumbai office Q2 2026; Knight Frank, Market overview, Western Suburb 1; ICRA (Feb 2026).");
  src("deals", "Knight Frank, Market overview, Western Suburb 1; The Realty Today (HDFC Bank 29 Jan 2025; Eternal); Construction World 17 Aug 2026 (Julius Baer; Colliers GCC figure); Smartworks release 11 Feb 2026; The Flex Insights (Sugar); The Realty Today (BA Continuum).");
  src("flex", "Cushman & Wakefield, India flex space H1 2026 (27 Aug 2026); JLL Mumbai office Q2 2026; Knight Frank via Free Press Journal (1 Apr 2026); myHQ/ANAROCK via Realty n More (Apr 2026); Q1 FY27 investor releases of Awfis, Smartworks, IndiQube, WeWork India; Table Space IPO filing (Aug 2026).");
  src("catchment", "Company filings, contact and location pages, and property news (The Realty Today, Construction World, CRE Matrix, Storyboard18, The Flex Insights), read 7 Oct 2026; sector shares from JLL Mumbai Q2 2026. Distances are approximate.");
  src("pools", "Occupier research; competitor survey; The Flex Insights (Sugar Cosmetics, Mar 2025); UWA news (Mumbai campus, Sep 2026); The Realty Today (University of York, Dec 2025).");
  src("infrastructure", "Wikipedia (Aqua Line); Free Press Journal (10 Jan, 11 Jul, 27 Aug 2026); Business Standard/PTI (8 Jun 2025); Swarajya (9 Aug, 17 Jun 2026); Indian Infrastructure (26 Dec 2025); The Week/PTI (11 May 2025); Curly Tales (27 Aug 2026); Business Today (6 Jul 2026); MGS Architecture.");
  src("why", "The assets section (metro), the market section (Knight Frank rents and occupiers; HDFC Bank and Julius Baer deals) and the competitive landscape (competitor survey).");
  src("plan", "Andheri costing workbook (Costing sheet, 10% brokerage). Pipeline structure follows the Whitefield Business Case Study 2026, section 06.");
  src("pipelines", "Andheri costing workbook (Marketing Cost sheet: LinkedIn ₹3,000 and Meta ₹1,500 a day, minimum, one ad and one location; Costing sheet: ₹5,000 a day). myHQ listing for IA Spaces at 723 Avenue.");
  src("risks", "The costing and break-even, the building records, the new supply and the competitor survey, as on their own pages.");
  src("rivals", "Andheri competitor survey (Competitors sheet, centres nearest the two buildings): prices are for managed offices and private cabins, per seat a month, plus taxes; occupancy as reported to our team.");
  src("corridor", "Andheri competitor survey (Competitors sheet, Andheri Kurla Road, Sakinaka to WEH). Operator names tidied; building not named where the survey left it blank.");
  src("openings", "ghar.tv and The Realty Today (Table Space, Jan 2024, Mar 2025); Kontor Space NSE release (10 Jul 2024); The Realty Today (Innov8, 21 Dec 2024; WeWork, 31 Dec 2024); Realty n More (7 Apr 2025); Smartworks release (11 Feb 2026); CRE Matrix (Quest CoWorks, Mar 2026).");
  src("occupancyRivals", "Andheri competitor survey: 30 centres that shared an occupancy band (IA Spaces did not). Bands are as reported to our team, not audited.");
  src("ladder", "Andheri competitor survey, all 31 centres (Competitors sheet). Middle price = median. Autopilot prices: the costing section, every seat sold, before brokerage and ads.");
  src("decision", "All figures from the sections above. 'Edge' marks the better building on each line; it is a reading aid, not a weighted score.");

  /* ---- Images: the prompts, and the pictures Higgsfield made from them
     (generated once through the Higgsfield MCP, in the house style
     api/cms/_images.js adds; the CMS does the same and copies the file
     into our own storage) ---- */
  const Im = S("Images");
  const HF = "https://d8j0ntlcm91z4.cloudfront.net/user_3Fo7i4SvZozV6ke0Djuea827rgj/hf_20261021_";
  const URLS = {"cover": "224738_f96800db-c373-43a1-a4c0-86d8f52425e4", "options": "224708_79f674bd-40a9-415e-8d52-7d163c3a9c73", "assets": "224709_a33c27ba-bf66-4ad9-8c9f-8ae60d64dd8c", "market": "224709_74e781c3-32bb-4c56-ba29-2ab581eb25a3", "infrastructure": "224737_72e23284-41af-44f6-bdbe-2c9848c8c719", "why": "224708_cf24c231-cc12-4b8c-b9cf-7113f26ed66b", "plan": "224737_62e955e1-1914-4ff2-9cab-320ba490c692", "rivals": "224753_06320c03-f620-4731-9cd8-c743827c8b5d", "back": "224737_55db2f1f-9306-438b-996f-a7585c1fdb2e"};
  const im = (slot, prompt) => addRow(Im, { "Slot": slot, "Prompt": prompt, "Image address": URLS[slot] ? HF + URLS[slot] + ".png" : "", "Caption": "AI-generated illustration (Higgsfield)" });
  im("cover", "Two modern office buildings in a Mumbai suburb at dusk, one finished glass tower and one under construction with cranes, an elevated metro line in the foreground, monsoon sky clearing");
  im("options", "An empty bare-shell office floor with floor-to-ceiling windows looking out over Andheri East, late afternoon light, measuring tape and floor plans on the concrete floor");
  im("assets", "A new office tower beside an elevated metro station at street level, people walking from the station entrance, Mumbai, early morning");
  im("market", "A busy Mumbai business district street with Grade A office towers, taxis and office workers, overcast bright sky");
  im("infrastructure", "An elevated metro viaduct curving past office towers towards an airport terminal, aircraft landing in the distance, Mumbai");
  im("why", "A managed office interior with a client meeting in a glass cabin, city view of Andheri East through the window");
  im("plan", "A broker showing an office floor to two clients, floor plan in hand, large windows, Mumbai skyline");
  im("rivals", "A row of coworking centre signs along a busy Andheri Kurla Road, evening, neon and glass");
  im("back", "Aerial view of Marol at dusk, two metro lines crossing, the airport runway lights beyond");

  const out = path.join(__dirname, "..", "..", "examples", "andheri-case.xlsx");
  await wb.xlsx.writeFile(out);
  return out;
}

if (require.main === module) build().then(p => console.log(`wrote ${p}`)).catch(e => { console.error(e); process.exit(1); });
module.exports = { build };
