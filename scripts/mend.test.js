#!/usr/bin/env node
/* ============================================================================
   ATLAS · repair, don't refuse

     node scripts/mend.test.js

   Feeds mend() the kind of mess people actually send (no ids, positions
   typed as text or the wrong way round, a micro-market nobody listed, a
   slider on a column that does not exist) and checks that what comes back
   draws, says what it changed, and leaves out only what cannot be placed.
   A clean atlas must come back untouched.
   ============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { mend } = require("./lib/mend-bundle");
const { validate } = require("./lib/validate-bundle");
const { readWorkbook } = require("./lib/workbook");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 400)}` : ""}`); } };

(async () => {
  console.log("\nRepair, don't refuse");

  const messy = {
    meta: { asOf: "October 2026", city: "Mumbai" },
    options: [
      { name: "Corporate Avenue!", lat: "19.1106", lng: "72.8596", micro: "Chakala" },
      { id: "Corporate Avenue!", name: "Corporate Avenue Tower B", lat: 72.8606, lng: 19.1116 },
      { id: "723", lat: "19.1097, 72.8844" },
      { id: "privilon", name: "Privilon", lat: 19.1082, lng: 72.8795, micro: "MAROL" },
      { id: "ghost", name: "A building with no address" },
      "not a row",
    ],
    zones: [{ key: "marol", label: "Marol" }],
    transit: { lines: [
      { name: "Line 1", stations: [{ name: "Chakala", lat: 19.1115, lng: 72.8634 }, { name: "Nowhere" }] },
      { key: "empty", name: "Empty line", stations: [] },
    ] },
    places: [
      { name: "Awfis, Skyline Icon", lat: 19.119, lng: 72.882 },
      { id: "awfis", name: "Awfis again", kind: "flex", lat: 19.12, lng: 72.883 },
      { id: "awfis", name: "Awfis, a third", kind: "flex", lat: 19.121, lng: 72.884 },
      { kind: "flex", lat: 19.1, lng: 72.9 },
    ],
    facts: [{ k: "Rents", v: "Rs 90 to 140" }, { k: "Vacancy", v: "" }],
    measures: [
      { key: "rent", label: "Rent", kind: "column", column: "rentOnCarpet", higherIsBetter: false },
    ],
    presets: [{ key: "cheap", label: "Cheapest", levels: { rent: 9, ghost: 2 } }],
  };

  const before = validate(messy);
  ok("the messy bundle fails the checks as given", !before.ok && before.errors.length > 5, before.errors.length);

  const { bundle, fixes, left } = mend(messy);
  const rep = validate(bundle);
  ok("after repair it passes the checks", rep.ok, JSON.stringify(rep.errors.slice(0, 4)));
  ok("four of the five properties are on the map", bundle.options.length === 4, bundle.options.map(o => o.name).join(" | "));
  ok("ids are valid and unique", bundle.options.every(o => /^[a-z0-9][a-z0-9-]*$/.test(o.id)) && new Set(bundle.options.map(o => o.id)).size === 4, bundle.options.map(o => o.id).join(","));
  ok("a property with no name is named after its id", bundle.options.some(o => o.name === "723"));
  ok("a position typed as text is read as numbers", bundle.options[0].lat === 19.1106 && bundle.options[0].lng === 72.8596);
  ok("latitude and longitude the wrong way round are swapped", bundle.options[1].lat === 19.1116 && bundle.options[1].lng === 72.8606, JSON.stringify(bundle.options[1]));
  ok("\"19.11, 72.88\" in one cell is split into two", bundle.options[2].lat === 19.1097 && bundle.options[2].lng === 72.8844);
  ok("a micro-market a property names but nobody listed is added", bundle.zones.some(z => z.label === "Chakala") && bundle.options[0].micro === bundle.zones.find(z => z.label === "Chakala").key);
  ok("a micro-market in another case is matched, not duplicated", bundle.options.find(o => o.id === "privilon").micro === "marol" && bundle.zones.filter(z => /marol/i.test(z.key)).length === 1);
  ok("the date in words is read as a month", bundle.meta.asOf === "2026-10");
  ok("a title, centre and zoom are filled in", bundle.meta.title === "Mumbai atlas" && Array.isArray(bundle.meta.center) && Math.abs(bundle.meta.center[1] - 19.11) < 0.01 && bundle.meta.zoom >= 12);
  ok("a station with no position is dropped, and an empty line removed", bundle.transit.lines.length === 1 && bundle.transit.lines[0].stations.length === 1 && bundle.transit.lines[0].key);
  ok("places get a kind, unique ids, and one with no name is dropped", bundle.places.length === 3 && bundle.places[0].kind === "place" && new Set(bundle.places.map(p => p.id)).size === 3);
  ok("facts as a plain list become a group, empty ones dropped", bundle.facts.facts.length === 1);
  ok("a slider on a column no property has is left out, and its presets with it", !bundle.measures && !bundle.presets);
  ok("the property that cannot be placed is named, with how to bring it back", left.some(l => /A building with no address/.test(l) && /Options tab/.test(l)), left.join(" | "));
  ok("what was changed is said in plain words", fixes.some(f => /wrong way round/.test(f)) && fixes.some(f => /micro-market/.test(f)) && fixes.some(f => /ID/.test(f)), fixes.join(" | "));

  /* A clean atlas comes back exactly as it went in. */
  const clean = (await readWorkbook(fs.readFileSync(path.join(__dirname, "..", "examples", "andheri-flex.xlsx")))).bundle;
  const m2 = mend(clean);
  ok("a clean atlas is left exactly as it was, with nothing to report", JSON.stringify(m2.bundle) === JSON.stringify(clean) && !m2.fixes.length && !m2.left.length, JSON.stringify([m2.fixes, m2.left]));

  /* A slider that works stays. */
  const withRent = mend({ ...clean, options: clean.options.map((o, i) => ({ ...o, rentOnCarpet: 300 + i * 10 })), measures: [{ key: "rent", label: "Rent", kind: "column", column: "rentOnCarpet", higherIsBetter: false }], presets: [{ key: "cheap", label: "Cheapest", levels: { rent: 9 } }] });
  ok("a slider that can rank is kept, and a level of 9 becomes 4", withRent.bundle.measures.length === 1 && withRent.bundle.presets[0].levels.rent === 4 && validate(withRent.bundle).ok);

  /* Nothing to place at all is the one case left failing. */
  const none = mend({ meta: { title: "x" }, options: [{ name: "No address" }] });
  ok("nothing to place at all still fails, and says which", !validate(none.bundle).ok && none.left.some(l => /No address/.test(l)));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
