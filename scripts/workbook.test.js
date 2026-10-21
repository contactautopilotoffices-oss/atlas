#!/usr/bin/env node
/* ============================================================================
   ATLAS · workbook round trip

     node scripts/workbook.test.js

   Builds the template, fills it in the way a person would, reads it back and
   checks the bundle. The point is that the template and the parser are the
   same description of the sheets: if they ever drift, this is what notices.

   It fills the sheets through their HEADINGS, not their positions, for the
   same reason the parser reads them that way.
   ============================================================================ */
"use strict";
const { readWorkbook } = require("./lib/workbook");
const { fillSampleWorkbook: fill } = require("./lib/sample-workbook");
const { validate, format } = require("./lib/validate-bundle");

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log("  ok    " + name); };
const bad = (name, detail) => { fail++; console.log("  FAIL  " + name + (detail ? "\n        " + String(detail).replace(/\n/g, "\n        ") : "")); };
function is(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) ok(name); else bad(name, `wanted ${b}\ngot    ${a}`);
}

(async () => {
  console.log("\nA workbook filled in the way a person would");
  const buf = await fill();
  const { bundle, notes } = await readWorkbook(buf);
  const rep = validate(bundle);

  if (rep.ok && rep.warnings.length === 0) ok("reads back with nothing to fix");
  else bad("reads back with nothing to fix", format(rep));

  const egNotes = notes.filter(n => /example row/.test(n)).length;
  if (egNotes >= 6) ok(`the ${egNotes} example rows are skipped and reported`);
  else bad("example rows skipped", notes.join("\n"));

  console.log("\nWhat survived the round trip");
  is("the title", bundle.meta.title, "Pune Office Study");
  is("the centre, longitude first", bundle.meta.center, [73.8567, 18.5204]);
  is("the speed block", bundle.meta.speed, { kmh: 18, factor: 1.35, note: "TomTom Traffic Index 2025" });
  is("next steps split into lines", bundle.meta.nextSteps.length, 2);
  is("three options", bundle.options.length, 3);
  is("an option's coordinates", [bundle.options[0].lat, bundle.options[0].lng], [18.5074, 73.928]);
  is("a column the schema never heard of", bundle.options[0].rentPerSqFt, 88);
  is("two micro-markets", bundle.zones.length, 2);
  is("a zone figure with its source", bundle.zones[0].rent, { v: "INR 85-95 per sq ft", src: "https://example.org/r" });
  is("pros split into lines", bundle.zones[0].pros, ["Deep Grade A supply", "Metro on the doorstep"]);
  is("four places", bundle.places.length, 4);
  is("two transit lines", bundle.transit.lines.map(l => l.name), ["Purple Line", "Aqua Line"]);
  is("three stations on the first line", bundle.transit.lines[0].stations.length, 3);
  is("a line's details carry from its first station", [bundle.transit.lines[0].mode, bundle.transit.lines[0].color], ["metro", "#6b3fa0"]);
  is("an open station", bundle.transit.lines[0].stations[0].open, true);
  is("a planned station keeps its year", [bundle.transit.lines[0].stations[2].open, bundle.transit.lines[0].stations[2].eta], [false, 2028]);
  is("facts in two groups", Object.keys(bundle.facts).sort(), ["market", "talent"]);
  is("the current office", bundle.existing.name, "Tech Park One");
  is("four measures", bundle.measures.map(m => m.kind), ["column", "nearestStation", "nearestPlace", "fromExisting"]);
  is("a column measure points at the column's key", bundle.measures[0].column, "rentPerSqFt");
  is("higher-is-better read as no", bundle.measures[0].higherIsBetter, false);
  is("two place kinds counted together", bundle.measures[2].placeKind, ["edu", "res"]);
  is("two presets", bundle.presets.map(p => p.key), ["balanced", "cost"]);
  is("preset levels", bundle.presets[1].levels, { rent: 4, rail: 1, talent: 1, home: 1 });
  is("exactly one default", bundle.presets.filter(p => p.default).length, 1);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e.stack); process.exit(2); });
