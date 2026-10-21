#!/usr/bin/env node
/* ============================================================================
   ATLAS · tests for bundle validation

     node scripts/validate-bundle.test.js

   Two halves. First, the mistakes a person actually makes in a workbook must
   each produce a message that names where it is and what to do. Second, the
   four committed studies must pass with no errors, so the schema stays a
   description of real work rather than an opinion about it.
   ============================================================================ */
"use strict";
const { validate } = require("./lib/validate-bundle");
const studies = require("./lib/study-bundle");

let pass = 0, fail = 0;

/* A bundle that is fine, so each test can break exactly one thing. */
function good() {
  return {
    meta: { title: "Pune Office Study", asOf: "2026-10", center: [73.8567, 18.5204], zoom: 11.5, sheet: "Pune_Options.xlsx" },
    zones: [{ key: "kharadi", label: "Kharadi", name: "Kharadi and Eon" }],
    options: [{ id: "amar-tech", name: "Amar Tech Park", lat: 18.5074, lng: 73.928,
                micro: "kharadi", precision: "building", geoSrc: "https://example.org/a" }]
  };
}
const msgs = rep => [...rep.errors, ...rep.warnings].map(x => `${x.where}: ${x.message}`);

/* Asserts the bundle is rejected AND that the message explains it. */
function expectError(name, bundle, needle) {
  const rep = validate(bundle);
  const all = msgs(rep).join("\n");
  const found = rep.errors.some(e => `${e.where}: ${e.message}`.toLowerCase().includes(needle.toLowerCase()));
  if (found) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        wanted an error containing "${needle}", got:\n${all.replace(/^/gm, "          ") || "          (nothing)"}`); }
}
function expectWarning(name, bundle, needle) {
  const rep = validate(bundle);
  const found = rep.warnings.some(w => `${w.where}: ${w.message}`.toLowerCase().includes(needle.toLowerCase()));
  if (found) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        wanted a warning containing "${needle}", got:\n${msgs(rep).join("\n").replace(/^/gm, "          ") || "          (nothing)"}`); }
}
function expectClean(name, bundle) {
  const rep = validate(bundle);
  if (rep.ok && rep.warnings.length === 0) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n${msgs(rep).join("\n").replace(/^/gm, "          ")}`); }
}

console.log("\nA bundle that is fine");
expectClean("passes with nothing to fix", good());
expectClean("passes with only the required blocks", {
  meta: { title: "T", asOf: "2026-10", center: [73.85, 18.52], zoom: 11, sheet: "s.xlsx" },
  options: [{ id: "a", name: "A", lat: 18.52, lng: 73.85, precision: "building", geoSrc: "https://x.org" }]
});

console.log("\nCoordinates, the mistake that costs the most");
expectError("lat and lng swapped is named as swapped", (() => {
  const b = good(); b.options[0].lat = 73.928; b.options[0].lng = 18.5074; return b;
})(), "if lat and lng are swapped");
expectError("an empty lat is refused", (() => {
  const b = good(); b.options[0].lat = ""; return b;
})(), "lat is empty");
expectError("text in a coordinate is refused", (() => {
  const b = good(); b.options[0].lat = "18°30'N"; return b;
})(), "not a number");
expectError("0, 0 is called out as never filled in", (() => {
  const b = good(); b.options[0].lat = 0; b.options[0].lng = 0; return b;
})(), "never filled in");
expectError("a latitude over 90 is refused", (() => {
  const b = good(); b.options[0].lat = 118.5; return b;
})(), "latitude runs from -90 to 90");
expectWarning("a pin far from the centre is flagged", (() => {
  const b = good(); b.options[0].lat = 28.61; b.options[0].lng = 77.21; return b;
})(), "km from the map centre");

console.log("\nMeta");
expectError("a centre written [lat, lng] is refused", (() => {
  const b = good(); b.meta.center = [18.5204, 173.8567]; return b;
})(), "the order is [longitude, latitude]");
expectWarning("a centre that reads like [lat, lng] is flagged", (() => {
  const b = good(); b.meta.center = [18.52, 73.85]; b.options[0].lat = 73.85; b.options[0].lng = 18.52; return b;
})(), "reads like [latitude, longitude]");
expectError("a missing title is refused", (() => {
  const b = good(); delete b.meta.title; return b;
})(), "title is empty");
expectError("a date in the wrong format is refused", (() => {
  const b = good(); b.meta.asOf = "Oct 2026"; return b;
})(), "write it as 2026-10");
expectError("a zoom over 22 is refused", (() => {
  const b = good(); b.meta.zoom = 40; return b;
})(), "runs from 0 to 22");
expectError("no meta block at all is refused", { options: good().options }, "meta block is missing");

console.log("\nOptions");
expectError("no options is refused", (() => {
  const b = good(); b.options = []; return b;
})(), "there are no options");
expectError("a duplicate id is refused and names the other row", (() => {
  const b = good(); b.options.push({ ...b.options[0], name: "Second" }); return b;
})(), "already used by row 1");
expectError("an id with spaces and capitals is refused", (() => {
  const b = good(); b.options[0].id = "Amar Tech"; return b;
})(), "lower-case letters, numbers and hyphens");
expectError("a missing name is refused", (() => {
  const b = good(); delete b.options[0].name; return b;
})(), "name is empty");
expectError("a micro-market that does not exist is refused", (() => {
  const b = good(); b.options[0].micro = "hinjewadi"; return b;
})(), "not one of the micro-market keys");
expectWarning("a duplicate name is flagged", (() => {
  const b = good(); b.options.push({ ...b.options[0], id: "amar-tech-2" }); return b;
})(), "will look identical");
expectWarning("a missing precision is flagged", (() => {
  const b = good(); delete b.options[0].precision; return b;
})(), "cannot say how exact it is");

console.log("\nMicro-markets, transit, places, facts");
expectWarning("a micro-market with no options is flagged", (() => {
  const b = good(); b.zones.push({ key: "hinjewadi", label: "Hinjewadi", name: "Hinjewadi Phase 1" }); return b;
})(), "will always be empty");
expectError("a duplicate micro-market key is refused", (() => {
  const b = good(); b.zones.push({ ...b.zones[0] }); return b;
})(), 'key "kharadi" is used twice');
expectError("a station with no coordinates is refused", (() => {
  const b = good();
  b.transit = { lines: [{ key: "p", name: "Purple", mode: "metro", status: "open", stations: [{ name: "Ramwadi" }] }] };
  return b;
})(), "station 1 (Ramwadi)");
expectError("a bus stop tuple in the wrong shape is refused", (() => {
  const b = good(); b.bus = { stops: [[73.85, 18.52]] }; return b;
})(), "[name, latitude, longitude]");
expectError("a bus path pair in lat-first order is refused", (() => {
  const b = good(); b.bus = { path: [[18.52, 173.85]] }; return b;
})(), "a path is [longitude, latitude]");
expectError("a place with no kind is refused", (() => {
  const b = good(); b.places = [{ id: "x", name: "X", lat: 18.52, lng: 73.85 }]; return b;
})(), "kind is empty");
expectError("a fact with no value is refused", (() => {
  const b = good(); b.facts = { market: [{ k: "Rent", src: "https://x.org" }] }; return b;
})(), "the value (v) is empty");
expectWarning("a fact with no source is flagged", (() => {
  const b = good(); b.facts = { market: [{ k: "Rent", v: "INR 95" }] }; return b;
})(), "cannot be defended");
expectWarning("an unknown block is flagged, not refused", (() => {
  const b = good(); b.competitors = []; return b;
})(), "not a block the engine knows");

console.log("\nOne mistake in many rows reads as one mistake");
(() => {
  const b = good();
  b.options = Array.from({ length: 40 }, (_, i) => ({
    id: `opt-${i}`, name: `Option ${i}`, lat: 18.5, lng: 73.9, micro: "kharadi", precision: "building"
  }));
  const rep = validate(b);
  const lines = require("./lib/validate-bundle").collapse(rep.warnings);
  const oneLine = lines.find(l => l.includes("geoSrc is empty"));
  if (oneLine && oneLine.includes("40 rows") && !lines.some(l => l.split("\n").length > 2)) {
    pass++; console.log("  ok    40 rows missing geoSrc collapse to one line");
  } else {
    fail++; console.log(`  FAIL  40 rows missing geoSrc should collapse to one line, got:\n${lines.join("\n").replace(/^/gm, "          ")}`);
  }
})();

console.log("\nThe priority chooser, which is a model rather than a layout");
/* A chooser bundle: options with a score, places to measure to, and transit. */
function withChooser() {
  const b = good();
  b.options[0].pricingScore = 8;
  b.places = [
    { id: "coep", kind: "edu", name: "COEP", lat: 18.53, lng: 73.86, precision: "building" },
    { id: "viman", kind: "res", name: "Viman Nagar", lat: 18.56, lng: 73.91, precision: "locality" }
  ];
  b.transit = { lines: [{ key: "purple", name: "Purple", mode: "metro", stations: [
    { name: "Ramwadi", lat: 18.55, lng: 73.91, open: true },
    { name: "Wagholi", lat: 18.58, lng: 73.98, target: "2028" }
  ] }] };
  b.measures = [
    { key: "price", kind: "column", column: "pricingScore", higherIsBetter: true, label: "Price", question: "Q?", of: "the score" },
    { key: "rail", kind: "nearestStation", status: "open", label: "Rail", question: "Q?", of: "distance" },
    { key: "talent", kind: "nearestPlace", placeKind: ["edu", "res"], rings: [15, 30, 45], label: "Talent", question: "Q?", of: "distance" }
  ];
  b.presets = [{ key: "balanced", label: "Balanced", default: true, levels: { price: 4, rail: 2, talent: 1 } }];
  return b;
}
expectClean("a chooser with all three kinds wired up passes", withChooser());

expectError("a column no option has is refused", (() => {
  const b = withChooser(); b.measures[0].column = "capRate"; return b;
})(), "which no option has");
expectError("a column with no numbers in it is refused", (() => {
  const b = withChooser(); b.options[0].pricingScore = "eight"; return b;
})(), "cannot rank anything");
expectWarning("a column only some options have is flagged", (() => {
  const b = withChooser();
  b.options.push({ id: "b", name: "B", lat: 18.51, lng: 73.9, micro: "kharadi", precision: "building", geoSrc: "https://x.org" });
  return b;
})(), "of 2 options have a number");
expectError("a place kind nothing is tagged with is refused", (() => {
  const b = withChooser(); b.measures[2].placeKind = "studio"; return b;
})(), "no place has that kind");
expectWarning("one missing kind out of several is only flagged", (() => {
  const b = withChooser(); b.measures[2].placeKind = ["edu", "studio"]; return b;
})(), 'no place has the kind "studio"');
expectError("a station measure with no transit is refused", (() => {
  const b = withChooser(); delete b.transit; return b;
})(), "no transit block");
expectError("a planned-station measure with nothing planned is refused", (() => {
  const b = withChooser();
  b.transit.lines[0].stations = [{ name: "Ramwadi", lat: 18.55, lng: 73.91, open: true }];
  b.measures.push({ key: "future", kind: "nearestStation", status: "planned", label: "Coming", question: "Q?", of: "d" });
  b.presets[0].levels.future = 1;
  return b;
})(), "no station matches");
expectError("a mode no line has is refused", (() => {
  const b = withChooser(); b.measures[1].mode = "monorail"; return b;
})(), "no transit line has that mode");
expectError("measuring from a current office there isn't is refused", (() => {
  const b = withChooser();
  b.measures.push({ key: "home", kind: "fromExisting", label: "Close", question: "Q?", of: "d" });
  b.presets[0].levels.home = 2;
  return b;
})(), "no current office in the bundle");
expectError("an unknown measure kind is refused", (() => {
  const b = withChooser(); b.measures[0].kind = "vibes"; return b;
})(), 'kind is "vibes"');

console.log("\nPresets");
expectError("a preset setting a measure that does not exist is refused", (() => {
  const b = withChooser(); b.presets[0].levels.parking = 2; return b;
})(), "which is not one of the measures");
expectError("a level above 4 is refused", (() => {
  const b = withChooser(); b.presets[0].levels.price = 9; return b;
})(), "from 0 (skip) to 4 (critical)");
expectError("two defaults is refused", (() => {
  const b = withChooser();
  b.presets.push({ key: "cost", label: "Cost", default: true, levels: { price: 4, rail: 1, talent: 0 } });
  return b;
})(), "presets are marked default");
expectError("presets with no measures is refused", (() => {
  const b = good(); b.presets = [{ key: "a", label: "A", levels: {} }]; return b;
})(), "no measures for them to set");
expectWarning("measures with no presets is flagged", (() => {
  const b = withChooser(); delete b.presets; return b;
})(), "every slider at zero");
expectWarning("a preset that skips a measure is flagged", (() => {
  const b = withChooser(); delete b.presets[0].levels.talent; return b;
})(), "treated as skip");

console.log("\nWhen a station counts as open");
const { stationIsOpen } = require("./lib/validate-bundle");
[["open: true is open", { open: true }, null, true],
 ["open: false is not", { open: false }, null, false],
 ["nothing said is not open", { name: "Wagholi" }, null, false],
 ["an opens date in the past is open", { opens: "2020-01-01" }, null, true],
 ["an opens date in the future is not", { opens: "2099-01-01" }, null, false],
 ["an opens month in the past is open", { opens: "2020-01" }, null, true],
 ["a planned line makes a silent station planned", { name: "X" }, { status: "planned" }, false],
 ["an open line makes a silent station open", { name: "X" }, { status: "open" }, true],
 ["the station wins over the line", { open: false }, { status: "open" }, false]
].forEach(([name, st, line, want]) => {
  if (stationIsOpen(st, line) === want) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}: wanted ${want}`); }
});

console.log("\nThe committed studies still fit the schema");
for (const n of studies.names()) {
  const rep = validate(studies.bundleFor(n));
  if (rep.ok) { pass++; console.log(`  ok    ${n} has no errors`); }
  else { fail++; console.log(`  FAIL  ${n} has ${rep.errors.length} errors:\n${rep.errors.map(e => `          ${e.where}: ${e.message}`).join("\n")}`); }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
