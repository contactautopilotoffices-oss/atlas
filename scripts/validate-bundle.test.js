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

console.log("\nThe committed studies still fit the schema");
for (const n of studies.names()) {
  const rep = validate(studies.bundleFor(n));
  if (rep.ok) { pass++; console.log(`  ok    ${n} has no errors`); }
  else { fail++; console.log(`  FAIL  ${n} has ${rep.errors.length} errors:\n${rep.errors.map(e => `          ${e.where}: ${e.message}`).join("\n")}`); }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
