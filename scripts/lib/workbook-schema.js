/* ============================================================================
   ATLAS · what the workbook looks like

   One description of every sheet and column, used to GENERATE the template
   and to READ a filled one. That is the point: a template and a parser kept
   in two places drift, and the person who finds out is whoever filled in the
   workbook.

   Sheet order is the order a person should fill them in. Required sheets
   come first; the rest can be left empty and the Atlas simply has fewer
   sections (see "What the engine needs, in tiers" in engine/SCHEMA.md).

   Two sheet shapes:
     table   a header row and one row per thing (options, places, facts)
     form    a two-column key and value sheet (the atlas itself, the
             current office), because nobody should scroll sideways to fill
             in six fields
   ============================================================================ */
"use strict";
const { PRECISION, CONFIDENCE, MODES, MEASURE_KINDS } = require("./validate-bundle");

const LEVEL_WORDS = ["0 Skip", "1 Low", "2 Medium", "3 High", "4 Critical"];

const SHEETS = [
  {
    name: "Atlas",
    shape: "form",
    block: "meta",
    required: true,
    blurb: "The atlas itself. Everything on this sheet is about the whole study, not one property.",
    fields: [
      { key: "title", label: "Title", required: true, hint: "The name on the page and the browser tab, such as \"Pune Office Study\".", example: "Pune Office Study" },
      { key: "sub", label: "Subtitle", hint: "One line under the title. Optional.", example: "Where the next Pune office should go" },
      { key: "asOf", label: "Data current to", required: true, hint: "The date the figures are current to. Write it as 2026-10 or 2026-10-08.", example: "2026-10" },
      { key: "city", label: "City", hint: "Used as a label in the admin panel. Optional.", example: "Pune" },
      { key: "centerLng", label: "Centre longitude", required: true, type: "number", hint: "Where the map opens. Longitude is the EAST-west number; in India it is roughly 68 to 97.", example: 73.8567 },
      { key: "centerLat", label: "Centre latitude", required: true, type: "number", hint: "Where the map opens. Latitude is the NORTH-south number; in India it is roughly 6 to 37.", example: 18.5204 },
      { key: "zoom", label: "Opening zoom", required: true, type: "number", hint: "About 11 for a whole city, 14 for a single district. Between 0 and 22.", example: 11.5 },
      { key: "sheet", label: "Source workbook", hint: "Which workbook these numbers came from. This is what lets you answer a client who questions a figure.", example: "Pune_Options_Oct2026.xlsx" },
      { key: "speedKmh", label: "Peak speed (km/h)", type: "number", hint: "Used for drive times. Leave empty for 20.", example: 18 },
      { key: "speedFactor", label: "Road factor", type: "number", hint: "How much longer the road is than the straight line. Leave empty for 1.3.", example: 1.35 },
      { key: "speedNote", label: "Speed source", hint: "Where the speed figure comes from. Shown with every drive time.", example: "TomTom Traffic Index 2025, Pune rush hour" },
      { key: "nextSteps", label: "Next steps", hint: "What the client should do next. One per line (press Alt+Enter inside the cell for a new line).", example: "Visit the three best-fit options first.\nAsk each landlord for firm rent, CAM and lock-in in writing." }
    ]
  },
  {
    name: "Options",
    shape: "table",
    block: "options",
    required: true,
    blurb: "The properties being compared. One row per property. This is the only sheet the atlas cannot do without.",
    columns: [
      { key: "id", label: "ID", required: true, hint: "A short lower-case name, letters numbers and hyphens only, such as amar-tech. It appears in the page address and must be unique.", example: "amar-tech" },
      { key: "n", label: "Rank", type: "number", hint: "The order to show them in. 1 is first.", example: 1 },
      { key: "name", label: "Property name", required: true, hint: "What the property is called, as the client would say it.", example: "Amar Tech Park" },
      { key: "lat", label: "Latitude", required: true, type: "number", hint: "The NORTH-south number, in decimal degrees, such as 18.5074. Get it from Google Maps: right-click the building, and the first number is the latitude.", example: 18.5074 },
      { key: "lng", label: "Longitude", required: true, type: "number", hint: "The EAST-west number, such as 73.9280. The second of the two numbers in Google Maps.", example: 73.928 },
      { key: "precision", label: "How exact is the pin", list: PRECISION, hint: "How exact that position is. The pin says so on the page, which is how a rough position stays honest instead of looking wrong.", example: "building" },
      { key: "geoSrc", label: "Source for the position", hint: "A link to where you got the position. Without it the pin cannot be defended.", example: "https://www.openstreetmap.org/node/123456" },
      { key: "micro", label: "Micro-market", hint: "Must match a Key on the Micro-markets sheet. Leave empty if you are not using micro-markets.", example: "kharadi" },
      { key: "fit", label: "Fit group", hint: "How you are grouping the options: best, value, conditional, or your own words. Options with the same value are grouped and coloured together.", example: "best" },
      { key: "reason", label: "Why it scores as it does", hint: "One or two sentences. Shown on the card and in the ranking.", example: "Best overall balance of rent, floor plate and metro access." },
      { key: "address", label: "Address", example: "Hadapsar, Pune 411028" },
      { key: "locality", label: "Locality", example: "Hadapsar" },
      { key: "roadKm", label: "Km from current office", type: "number", hint: "By road, if you have the figure. Leave empty and the atlas estimates it.", example: 12 },
      { key: "driveText", label: "Drive time from current office", hint: "In words, such as \"20-25 min\".", example: "25-30 min" }
    ],
    extras: "Any other column you add is kept and shown on the property card. Put numbers you want to rank on (a rent, a score, a rating) in their own column and declare it on the Priorities sheet."
  },
  {
    name: "Micro-markets",
    shape: "table",
    block: "zones",
    blurb: "The parts of the city the options sit in. Leave the sheet empty if this atlas does not divide the city up.",
    columns: [
      { key: "key", label: "Key", required: true, hint: "A short lower-case code the Options sheet points at, such as kharadi.", example: "kharadi" },
      { key: "label", label: "Short name", required: true, hint: "What goes on the filter button. Keep it to a word or two.", example: "Kharadi" },
      { key: "name", label: "Full name", hint: "The name on the micro-market's own card.", example: "Kharadi and the EON corridor" },
      { key: "color", label: "Colour", hint: "A hex colour such as #2e7d5b. Leave empty and one is chosen.", example: "#2e7d5b" },
      { key: "character", label: "What it is like", hint: "A sentence on what this part of the city is like for an office.", example: "Established IT corridor; the deepest Grade A supply in the east." },
      { key: "rentV", label: "Rent", hint: "The figure as you would write it, such as \"INR 85-95 per sq ft\".", example: "INR 85-95 per sq ft" },
      { key: "rentSrc", label: "Rent source", hint: "A link. Every figure on this sheet can carry its own source.", example: "https://example.org/report" },
      { key: "vacancyV", label: "Vacancy", example: "8%" },
      { key: "vacancySrc", label: "Vacancy source", example: "https://example.org/report" },
      { key: "stockV", label: "Stock or supply", example: "14 msf" },
      { key: "stockSrc", label: "Stock source", example: "https://example.org/report" },
      { key: "pros", label: "In its favour", hint: "One per line (Alt+Enter inside the cell).", example: "Deep Grade A supply\nMetro on the doorstep" },
      { key: "cons", label: "Watch", hint: "One per line.", example: "Rents rising fastest in the city" }
    ]
  },
  {
    name: "Places",
    shape: "table",
    block: "places",
    blurb: "Everything else worth plotting around the options: employers, colleges, housing, hospitals, whatever this atlas is about. Each Kind becomes its own map layer you can switch on and off.",
    columns: [
      { key: "id", label: "ID", required: true, hint: "A short unique lower-case name.", example: "coep" },
      { key: "kind", label: "Kind", required: true, hint: "The group this belongs to, such as edu, employer, res, hospital. Each distinct value becomes a map layer, so keep the spelling consistent.", example: "edu" },
      { key: "name", label: "Name", required: true, example: "College of Engineering Pune" },
      { key: "lat", label: "Latitude", required: true, type: "number", example: 18.5308 },
      { key: "lng", label: "Longitude", required: true, type: "number", example: 73.8567 },
      { key: "sub", label: "Second line", hint: "Shown under the name.", example: "Government, since 1854" },
      { key: "precision", label: "How exact is the pin", list: PRECISION, example: "building" },
      { key: "note", label: "Note", example: "About 1,200 engineering graduates a year." },
      { key: "src", label: "Source", example: "https://www.coep.org.in/" }
    ]
  },
  {
    name: "Transit",
    shape: "table",
    block: "transit",
    blurb: "Rail, metro and anything else people arrive on. One row per STATION. Stations with the same Line name are drawn as one line, in the order you list them.",
    columns: [
      { key: "line", label: "Line name", required: true, hint: "Stations sharing this name are joined into one line, in sheet order.", example: "Purple Line" },
      { key: "lineShort", label: "Line short name", hint: "Used where space is tight.", example: "Purple" },
      { key: "mode", label: "Mode", list: MODES, hint: "What kind of service it is.", example: "metro" },
      { key: "color", label: "Line colour", hint: "A hex colour such as #6b3fa0.", example: "#6b3fa0" },
      { key: "name", label: "Station name", required: true, example: "Ramwadi" },
      { key: "lat", label: "Latitude", required: true, type: "number", example: 18.5512 },
      { key: "lng", label: "Longitude", required: true, type: "number", example: 73.9158 },
      { key: "open", label: "Open?", list: ["yes", "no"], hint: "Is it running today? Anything not open is drawn dashed and marked indicative.", example: "yes" },
      { key: "eta", label: "Target year", type: "number", hint: "For a station not yet open. A station opening sooner counts for more.", example: 2028 },
      { key: "target", label: "When it opens, in words", hint: "Shown as given, such as \"Works by Mar 2028; opening not announced\".", example: "Works by Mar 2028" },
      { key: "src", label: "Source", example: "https://example.org/metro" }
    ]
  },
  {
    name: "Facts",
    shape: "table",
    block: "facts",
    blurb: "The sourced facts that make up the written sections. Group them however you like; each Group becomes a section.",
    columns: [
      { key: "group", label: "Group", required: true, hint: "Facts sharing a group are shown together, such as market, talent, transit.", example: "market" },
      { key: "k", label: "Label", required: true, hint: "The short name of the fact.", example: "Grade A rent" },
      { key: "v", label: "Value", required: true, hint: "The fact itself, as you would write it.", example: "INR 85-95 per sq ft per month" },
      { key: "asOf", label: "As of", hint: "When this was true. 2026-09 or 2026-09-30.", example: "2026-09" },
      { key: "conf", label: "How firm", list: CONFIDENCE, hint: "How confident you are in it. Shown beside the fact.", example: "high" },
      { key: "src", label: "Source", hint: "A link. A fact without one cannot be defended when a client questions it.", example: "https://example.org/report" },
      { key: "note", label: "Note", hint: "An extra line under the fact.", example: "Quoted rents; deals are closing 5 to 8% below." }
    ]
  },
  {
    name: "Current office",
    shape: "form",
    block: "existing",
    blurb: "Today's office, if this atlas is about moving out of one. Leave it empty and the atlas simply drops every \"distance from today's office\" measure rather than showing zeroes.",
    fields: [
      { key: "id", label: "ID", hint: "A short lower-case name.", example: "current" },
      { key: "name", label: "Name", hint: "What the current office is called.", example: "Tech Park One" },
      { key: "lat", label: "Latitude", type: "number", example: 18.5679 },
      { key: "lng", label: "Longitude", type: "number", example: 73.9143 },
      { key: "locality", label: "Locality", example: "Yerwada" },
      { key: "micro", label: "Micro-market", hint: "A Key from the Micro-markets sheet.", example: "kharadi" },
      { key: "precision", label: "How exact is the pin", list: PRECISION, example: "building" },
      { key: "geoSrc", label: "Source for the position", example: "https://www.openstreetmap.org/node/123456" },
      { key: "note", label: "Note", example: "Lease expires Mar 2027." }
    ]
  },
  {
    name: "Priorities",
    shape: "table",
    block: "measures",
    optional: true,
    blurb: "OPTIONAL. The sliders a client moves to re-rank the options. Leave this sheet empty and the atlas has no priority chooser, which is the honest default until you have decided what the study argues.",
    columns: [
      { key: "key", label: "Key", required: true, hint: "A short lower-case code, such as rent.", example: "rent" },
      { key: "label", label: "Slider name", required: true, hint: "What the client sees on the slider.", example: "Rent" },
      { key: "kind", label: "What it measures", required: true, list: MEASURE_KINDS, hint: "column = a number on the Options sheet. nearestStation = how close a station is. nearestPlace = how close places of a kind are. fromExisting = how close today's office is.", example: "column" },
      { key: "column", label: "Which column", hint: "For a column measure: the exact column heading on the Options sheet it reads.", example: "Rent per sq ft" },
      { key: "higherIsBetter", label: "Higher is better?", list: ["yes", "no"], hint: "For a column measure. A rent is usually no; a score is usually yes.", example: "no" },
      { key: "max", label: "Top of the scale", type: "number", hint: "For a column measure scored out of something, such as 10. Leave empty and the best option sets the top.", example: 10 },
      { key: "placeKind", label: "Which kind of place", hint: "For a nearestPlace measure: a Kind from the Places sheet. Several, separated by commas, count together.", example: "edu, res" },
      { key: "status", label: "Open or planned", list: ["open", "planned"], hint: "For a nearestStation measure.", example: "open" },
      { key: "mode", label: "Which mode", list: MODES, hint: "For a nearestStation measure, to count only metro, say. Leave empty for any.", example: "metro" },
      { key: "question", label: "The question to ask", hint: "Shown above the slider, phrased as a question to the client.", example: "How much does the rent matter?" },
      { key: "of", label: "What it is calculated from", hint: "One line saying how this is worked out. Shown so the number can be questioned.", example: "the rent per sq ft on the sheet" }
    ]
  },
  {
    name: "Presets",
    shape: "table",
    block: "presets",
    optional: true,
    blurb: "OPTIONAL. Named starting points for the sliders, such as \"Keep cost down\". One row per preset per slider. Needs the Priorities sheet.",
    columns: [
      { key: "key", label: "Preset key", required: true, hint: "A short lower-case code. Every row with the same key is one preset.", example: "cost" },
      { key: "label", label: "Preset name", required: true, hint: "The name on the button.", example: "Keep cost down" },
      { key: "note", label: "What it means", hint: "One line explaining the preset.", example: "The best rent leads; access still counts." },
      { key: "default", label: "Start here?", list: ["yes", "no"], hint: "Exactly one preset should say yes. That is where a client starts.", example: "yes" },
      { key: "measure", label: "Slider", required: true, hint: "A Key from the Priorities sheet.", example: "rent" },
      { key: "level", label: "How much it counts", required: true, list: LEVEL_WORDS, hint: "From Skip to Critical.", example: "4 Critical" }
    ]
  }
];

module.exports = { SHEETS, LEVEL_WORDS };
