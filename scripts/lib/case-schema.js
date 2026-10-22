/* ============================================================================
   ATLAS · what the case study workbook looks like

   One description of every sheet and column of a business case, used to
   GENERATE the template and to READ a filled one, exactly as
   workbook-schema.js does for an atlas. The Andheri Business Case Study
   2026 was taken apart page by page to decide these sheets: every table,
   chart, number and paragraph in it lives on one of them, and every
   computed figure (prices, break-even, levers) comes from casestudy/
   costing.js, never from a cell.

   Required: Case and Options. Everything else adds a section; a sheet left
   empty leaves its section out and the contents page renumbers itself.
   ============================================================================ */
"use strict";

const SECTIONS = ["options", "assets", "market", "infrastructure", "why", "plan", "risks", "rivals", "decision"];
const CHARTS = ["vacancy", "rent", "topBand", "absorptionShare", "flexSeats", "operatorOccupancy", "other"];
const SLOTS = ["cover", "options", "assets", "market", "infrastructure", "why", "plan", "rivals", "back"];
const MODES = ["metro", "bus", "suburban rail", "airport", "road"];
const DEAL_KINDS = ["occupier", "flex operator", "global centre"];
const POINT_SECTIONS = ["market", "infrastructure", "why", "plan", "risks"];
const COPY_KEYS = ["cover", "readFirst", "options", "costing", "earns", "seat", "occupancy", "levers", "assets", "access", "market", "deals", "flex", "catchment", "pools", "infrastructure", "why", "plan", "pipelines", "risks", "rivals", "corridor", "openings", "occupancyRivals", "ladder", "decision", "back"];
const LISTS = ["askFor", "firstCalls", "pack", "watchlist", "questions", "nextSteps"];

const SHEETS = [
  {
    name: "Case", shape: "form", block: "meta", required: true,
    blurb: "The case study itself: what it is called, where, when, and the one-line story on the cover and the back page.",
    fields: [
      { key: "title", label: "Title", required: true, hint: "On the cover and every page header.", example: "Andheri Business Case Study 2026" },
      { key: "kind", label: "Kind", hint: "The small label above the title.", example: "Business case" },
      { key: "sub", label: "Subtitle", hint: "One line under the title: the place and the two options.", example: "Marol, Andheri East, Mumbai. Privilon and 723 Avenue, side by side" },
      { key: "asOf", label: "Dated", required: true, hint: "Month of the figures, as 2026-10.", example: "2026-10" },
      { key: "place", label: "Place", hint: "The locality, used in headings.", example: "Marol, Andheri East" },
      { key: "city", label: "City", example: "Mumbai" },
      { key: "by", label: "Prepared by", example: "Autopilot Offices" },
      { key: "tagline", label: "Cover line", hint: "What the study is: one line under the subtitle.", example: "Speculative managed-office take-up by Autopilot Offices" },
      { key: "backTitle", label: "Back page title", hint: "The closing line, two parts on two lines with a line break.", example: "Marol, Andheri East:\none stop from the airport, two lines at the door" },
      { key: "credits", label: "Credits", hint: "The closing note on sources and images.", example: "Prepared from the Andheri costing workbook, a Knight Frank market overview and public sources named on each page. Photographs are AI-generated illustrations and do not show either building." },
      { key: "currency", label: "Currency symbol", hint: "Leave empty for the rupee sign.", example: "₹" },
    ],
  },
  {
    name: "Assumptions", shape: "form", block: "assumptions",
    blurb: "The costing sheet's method. These apply to every option unless the option's own row says otherwise. Leave a field empty for the default shown.",
    fields: [
      { key: "runningRate", label: "Running costs (per sq ft of carpet a month)", type: "number", hint: "Power, housekeeping, security, staff, internet. Default 75.", example: 75 },
      { key: "lockinMonths", label: "Lock-in (months)", type: "number", hint: "The fit-out is recovered over this. Default 60.", example: 60 },
      { key: "margin", label: "Margin on cost (%)", type: "number", hint: "Added on top of cost. Default 20.", example: 20 },
      { key: "sqftPerSeat", label: "Sq ft of carpet a seat", type: "number", hint: "Default 35.", example: 35 },
      { key: "efficiency", label: "Efficiency (%)", type: "number", hint: "Carpet as a share of built-up, when a landlord quotes on built-up. Default 60.", example: 60 },
      { key: "brokeragePct", label: "Brokerage (% of the bill)", type: "number", hint: "Default 10.", example: 10 },
      { key: "adsPerMonth", label: "Ad budget a month", type: "number", hint: "What the costing sheet budgets. Default 1,50,000.", example: 150000 },
      { key: "adsFloorPerMonth", label: "Ad budget floor a month", type: "number", hint: "The least the ad plan needs, if different.", example: 135000 },
      { key: "adsNote", label: "Ad budget note", hint: "Where the ad figures come from.", example: "LinkedIn ₹3,000 + Meta ₹1,500 a day, minimum, one ad, one location" },
      { key: "targetPrice", label: "Target price a seat", type: "number", hint: "The price the levers are worked back from, usually the rival inside or next to the building.", example: 18000 },
      { key: "targetNote", label: "Target price note", example: "Matches IA Spaces, inside 723 Avenue" },
      { key: "rivalsLow", label: "Most rivals run from (%)", type: "number", hint: "The occupancy band most rival centres report. Default 75.", example: 75 },
      { key: "rivalsHigh", label: "Most rivals run to (%)", type: "number", example: 80 },
      { key: "rivalsNote", label: "Rivals occupancy note", example: "14 of the 30 that told us; none above 85%" },
      { key: "nationalLow", label: "National operators run from (%)", type: "number", example: 83 },
      { key: "nationalHigh", label: "National operators run to (%)", type: "number", example: 93 },
      { key: "nationalNote", label: "National operators note", example: "Listed operators, centres open over a year, Apr to Jun 2026" },
      { key: "walkMPerMin", label: "Walking speed (m a minute)", type: "number", hint: "Default 80.", example: 80 },
      { key: "notInSheet", label: "Not in the costing sheet", hint: "Costs the sheet leaves out, one per line. Shown beside the costing so they are asked for.", example: "Rent escalation\nSecurity deposit\nMaintenance (CAM) on top of rent\nRent-free fit-out months\nGST" },
    ],
  },
  {
    name: "Options", shape: "table", block: "options", required: true,
    blurb: "The buildings being compared. One row each. The money columns feed the costing; the rest describe the asset.",
    columns: [
      { key: "id", label: "ID", required: true, hint: "A short lower-case name, such as privilon.", example: "privilon" },
      { key: "name", label: "Name", required: true, hint: "As the document calls it.", example: "Privilon" },
      { key: "carpet", label: "Carpet area (sq ft)", required: true, type: "number", example: 15343 },
      { key: "rentRate", label: "Rent (per sq ft a month)", required: true, type: "number", example: 405 },
      { key: "rentBasis", label: "Rent quoted on", list: ["carpet", "builtup"], hint: "Is that rent per sq ft of carpet or of built-up area? Default carpet.", example: "carpet" },
      { key: "efficiency", label: "Efficiency (%)", type: "number", hint: "Carpet as a share of built-up. Leave empty for the Assumptions figure.", example: 60 },
      { key: "fitoutRate", label: "Fit-out (per sq ft of carpet)", required: true, type: "number", example: 2000 },
      { key: "runningRate", label: "Running costs (per sq ft a month)", type: "number", hint: "Only if this option differs from the Assumptions.", example: "" },
      { key: "lockinMonths", label: "Lock-in (months)", type: "number", hint: "Only if different.", example: "" },
      { key: "fullName", label: "Full name", example: "B Safal Privilon" },
      { key: "developer", label: "Developer", example: "Bsafal Properties, the Ahmedabad Bsafal group's first Mumbai project" },
      { key: "address", label: "Address", example: "Next to Marol Naka metro, Gamdevi, Marol, Andheri East 400059" },
      { key: "locality", label: "Locality", example: "Marol" },
      { key: "floorsOffered", label: "Floors offered", example: "Two floors, about" },
      { key: "stage", label: "Stage today", example: "Under construction. Excavation done; basement and plinth about 40%; 19% complete overall" },
      { key: "built", label: "Built?", hint: "The one-line answer on the terms table.", example: "Not before 2030" },
      { key: "builtNote", label: "Built note", example: "still being built; RERA completion 31 Jan 2030" },
      { key: "reraId", label: "RERA number", example: "P51800079264" },
      { key: "reraDate", label: "RERA completion", example: "31 January 2030" },
      { key: "floors", label: "Floors", example: "14 storeys, one tower (RERA lists 8 floors so far)" },
      { key: "offices", label: "Offices in total", example: "About 2.5 lakh sq ft on a 0.78-acre plot" },
      { key: "floorPlate", label: "Floor plate", example: "Not published; largest units 7,500 to 7,700 sq ft" },
      { key: "green", label: "Green rating", example: "IGBC Platinum pre-certified (design stage)" },
      { key: "amenities", label: "Amenities", example: "11.7 ft ceilings, car and two-wheeler parking, power backup" },
      { key: "occupant", label: "Who is there now", example: "Nobody yet" },
      { key: "verdict", label: "Verdict", hint: "The short call on this building, as a heading.", example: "Privilon: not for a 2026 launch" },
      { key: "verdictText", label: "Verdict text", example: "RERA puts completion in January 2030. Unless the landlord can show an earlier handover for our floors, treat Privilon as a future pre-lease, not this year's centre." },
      { key: "marketRent", label: "Rent against the market", hint: "One line for the decision table.", example: "About ₹243 built-up: above the top-building band" },
      { key: "canOpen", label: "Can we open this year?", example: "No: RERA completion Jan 2030" },
      { key: "rivalInside", label: "Rival in the same building", example: "None yet" },
      { key: "src", label: "Sources", example: "Bsafal Mumbai page; RERA copies on Square Yards and Quietlist" },
    ],
    extras: "Any other column is kept and shown on the side-by-side table.",
  },
  {
    name: "Access", shape: "table", block: "access",
    blurb: "How people reach each option: the stations and stops near it, with distances. Walking times are worked out from the distance.",
    columns: [
      { key: "option", label: "Option", required: true, hint: "An ID from the Options sheet.", example: "privilon" },
      { key: "name", label: "Stop or station", required: true, example: "Marol Naka metro" },
      { key: "mode", label: "Mode", list: MODES, example: "metro" },
      { key: "distanceM", label: "Distance (m)", required: true, type: "number", example: 89 },
      { key: "line", label: "Line", example: "Line 1 and Line 3 (Aqua)" },
      { key: "note", label: "Note", example: "550 m on myHQ, 1 km in the brochure" },
    ],
  },
  {
    name: "Rivals", shape: "table", block: "rivals",
    blurb: "The competitor survey: every centre, what it charges and how full it runs. The price ladder, the occupancy chart and the corridor tables are all drawn from this sheet.",
    columns: [
      { key: "operator", label: "Operator", required: true, example: "WeWork" },
      { key: "building", label: "Building", example: "Raheja Platinum" },
      { key: "locality", label: "Locality", required: true, example: "Marol" },
      { key: "grade", label: "Grade", example: "A" },
      { key: "price", label: "Price a seat a month", required: true, type: "number", example: 26500 },
      { key: "occLow", label: "Occupancy from (%)", type: "number", example: 80 },
      { key: "occHigh", label: "Occupancy to (%)", type: "number", example: 85 },
      { key: "near", label: "Next to our buildings?", list: ["yes", "no"], hint: "yes puts it on the 'who sells next to our buildings' table.", example: "yes" },
      { key: "sameBuilding", label: "In one of our buildings?", hint: "The ID of the option it sits in, if any.", example: "" },
      { key: "note", label: "Note", example: "Sets the ceiling next door" },
    ],
  },
  {
    name: "Openings", shape: "table", block: "openings",
    blurb: "New flex centres opened or signed nearby in the last few years, for the 'more operators are opening' page.",
    columns: [
      { key: "operator", label: "Operator", required: true, example: "Table Space" },
      { key: "seats", label: "Seats", type: "number", example: 1500 },
      { key: "area", label: "Area", example: "1.31 lakh sq ft" },
      { key: "building", label: "Building", example: "R Square, Andheri Kurla Rd" },
      { key: "when", label: "When", example: "Jan 2024" },
      { key: "note", label: "Note", example: "75% let on day one" },
    ],
  },
  {
    name: "KPIs", shape: "table", block: "kpis",
    blurb: "The big numbers on the section openers and the cover. Where a figure is one the costing works out, write its code instead of a number: price, priceLow, priceHigh, breakEven, seats, cost, commitment, rivals, rivalsMedian, rivalsRange.",
    columns: [
      { key: "section", label: "Section", required: true, list: ["cover", ...SECTIONS, "back"], example: "market" },
      { key: "value", label: "Value", required: true, hint: "A number as the document prints it, or a code from the list above.", example: "10.85%" },
      { key: "label", label: "Label", required: true, example: "Andheri Kurla vacancy, Q2 2026" },
      { key: "sub", label: "Second line", example: "down from 17.0%" },
      { key: "option", label: "Option", hint: "For a code like price: which option.", example: "" },
    ],
  },
  {
    name: "Series", shape: "table", block: "series",
    blurb: "The numbers behind the charts. One row per point. The chart column says which chart; the known ones are drawn in their own way, anything else as a bar chart.",
    columns: [
      { key: "chart", label: "Chart", required: true, list: CHARTS, example: "vacancy" },
      { key: "label", label: "Label", required: true, hint: "The x-axis label: a quarter, a year, an operator.", example: "Q4 23" },
      { key: "value", label: "Value", required: true, type: "number", example: 17.0 },
      { key: "value2", label: "Second value", type: "number", hint: "For a band: the top of it.", example: "" },
      { key: "flag", label: "Flag", list: ["", "projection", "ours", "highlight"], hint: "projection draws it dashed; ours marks our own figure.", example: "" },
      { key: "note", label: "Note", example: "a 16-year low (JLL)" },
    ],
  },
  {
    name: "Deals", shape: "table", block: "deals",
    blurb: "Recent leases in the area: who, how much, at what rent.",
    columns: [
      { key: "who", label: "Who", required: true, example: "HDFC Bank" },
      { key: "area", label: "Area", required: true, example: "2,72,000 sq ft" },
      { key: "rent", label: "Rent", example: "₹237 a sq ft" },
      { key: "building", label: "Building", example: "R Square, JB Nagar" },
      { key: "when", label: "When", example: "Jan 2025" },
      { key: "kind", label: "Kind", list: DEAL_KINDS, example: "occupier" },
      { key: "note", label: "Note", example: "₹6.45 Cr a month on carpet" },
    ],
  },
  {
    name: "Occupiers", shape: "table", block: "occupiers",
    blurb: "Who is in the catchment, by sector: the named companies within about 5 km and 10 km.",
    columns: [
      { key: "sector", label: "Sector", required: true, example: "Banking, finance and insurance" },
      { key: "share", label: "Share of leasing", example: "29.5% of Mumbai leasing, Apr to Jun 2026" },
      { key: "within5", label: "Within 5 km", hint: "Companies, separated by semicolons.", example: "HDFC Bank (R Square); SBI Life head office; Angel One" },
      { key: "within10", label: "Within 10 km", example: "CRISIL; Nomura; JP Morgan Services" },
      { key: "fit", label: "Fit", list: ["strong", "good", "weak"], example: "strong" },
      { key: "note", label: "Note", example: "" },
    ],
  },
  {
    name: "Pools", shape: "table", block: "pools",
    blurb: "The demand catchment: the pools of buyers, each with its chain of places or names and a line on what it means.",
    columns: [
      { key: "title", label: "Title", required: true, example: "Geographic catchment" },
      { key: "chain", label: "Chain", hint: "Names in order, separated by semicolons; drawn with arrows.", example: "Marol; Chakala; JB Nagar; Saki Naka; MIDC and SEEPZ; Chandivali; Powai" },
      { key: "text", label: "Text", example: "Andheri East's office belt and its eastern neighbour Powai, within one metro ride or a short drive." },
      { key: "kpi", label: "Big number", example: "2 lines" },
      { key: "kpiLabel", label: "Big number label", example: "meet at Marol Naka; Airport T2 one stop away" },
    ],
  },
  {
    name: "Points", shape: "table", block: "points",
    blurb: "Numbered points for the market, infrastructure, why-here, plan and risks pages: a title, a paragraph, and for a risk, how it is reduced.",
    columns: [
      { key: "section", label: "Section", required: true, list: POINT_SECTIONS, example: "infrastructure" },
      { key: "n", label: "Number", type: "number", example: 1 },
      { key: "title", label: "Title", required: true, example: "Metro Line 3 (Aqua), fully open" },
      { key: "text", label: "Text", required: true, example: "Opened end to end on 9 Oct 2025: 33.5 km, 27 stations. About 1.61 lakh riders a day in July 2026." },
      { key: "kpi", label: "Big number", hint: "For a risk or a why-here point.", example: "" },
      { key: "kpiLabel", label: "Big number label", example: "" },
      { key: "mitigate", label: "How we reduce it", hint: "Risks only.", example: "" },
      { key: "chart", label: "Chart", hint: "Market points only: a Chart key from the Series sheet drawn beside the text.", example: "" },
    ],
  },
  {
    name: "Lists", shape: "table", block: "lists",
    blurb: "Short lists that appear as bullets: what to ask the landlords for, the first calls, the broker pack, the watch list, the open questions.",
    columns: [
      { key: "list", label: "List", required: true, list: LISTS, example: "askFor" },
      { key: "item", label: "Item", required: true, example: "Rent-free months to cover the fit-out." },
      { key: "note", label: "Note", example: "" },
    ],
  },
  {
    name: "Decision", shape: "table", block: "decision",
    blurb: "The decision on one page: one row per question per option, with the edge marked once per question (an option ID, or level).",
    columns: [
      { key: "question", label: "Question", required: true, example: "Can we open in 2026-27?" },
      { key: "option", label: "Option", required: true, hint: "An ID from the Options sheet.", example: "privilon" },
      { key: "answer", label: "Answer", required: true, example: "No: RERA completion Jan 2030" },
      { key: "edge", label: "Edge", hint: "Which option wins this line: its ID, or level. Fill it on any one row of the question.", example: "723-avenue" },
      { key: "code", label: "Code", hint: "Leave the answer empty and write a code to have the costing fill it: seats, cost, fitout, price, profit, breakEven, commitment, walk.", example: "" },
    ],
  },
  {
    name: "Copy", shape: "table", block: "copy",
    blurb: "The written parts: the 'what it means for us' paragraphs and the section intros, keyed by where they go. The helper in the CMS can draft these from the numbers; what is here wins.",
    columns: [
      { key: "key", label: "Where", required: true, list: COPY_KEYS, example: "occupancy" },
      { key: "text", label: "Text", required: true, hint: "One paragraph per row; several rows with the same key are shown in order.", example: "The sheet's 20% only appears when the floor is full." },
      { key: "role", label: "Role", list: ["means", "intro", "read", "note"], hint: "means = a 'what it means for us' line; intro = the section's opening sentence; read = the decision's 'our read'.", example: "means" },
    ],
  },
  {
    name: "Sources", shape: "table", block: "sources",
    blurb: "The source line at the foot of each page, keyed the same way as Copy.",
    columns: [
      { key: "key", label: "Where", required: true, list: COPY_KEYS, example: "costing" },
      { key: "text", label: "Source", required: true, example: "Andheri costing workbook (Costing sheet), formulas reproduced exactly." },
    ],
  },
  {
    name: "Images", shape: "table", block: "images",
    blurb: "The picture slots: the cover, each section opener, the back. Give each a prompt in words; the CMS generates the picture with Higgsfield and fills in the address, or paste an address of your own.",
    columns: [
      { key: "slot", label: "Slot", required: true, list: SLOTS, example: "cover" },
      { key: "prompt", label: "Prompt", hint: "What the picture should show, in plain words. The house style is added for you.", example: "A new glass office tower beside an elevated metro station at dusk, Mumbai suburb, monsoon sky" },
      { key: "url", label: "Image address", hint: "Filled in by the CMS when generated, or your own https link.", example: "" },
      { key: "caption", label: "Caption", hint: "Default: AI-generated illustration.", example: "" },
    ],
  },
];

module.exports = { SHEETS, SECTIONS, CHARTS, SLOTS, MODES, COPY_KEYS, LISTS, POINT_SECTIONS };
