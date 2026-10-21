#!/usr/bin/env node
/* ============================================================================
   ATLAS · validate a bundle from the command line

     node scripts/validate-bundle.js path/to/bundle.json
     node scripts/validate-bundle.js --study chennai
     node scripts/validate-bundle.js --all        every committed study

   Exits 1 if anything is an error, so it can gate a deploy. Warnings never
   fail the run: a thin Atlas is a smaller Atlas, not a broken one.
   ============================================================================ */
"use strict";
const fs = require("fs");
const { validate, format } = require("./lib/validate-bundle");
const studies = require("./lib/study-bundle");

function run(label, bundle) {
  const rep = validate(bundle);
  console.log(format(rep, `=== ${label} ===`));
  console.log("");
  return rep.ok;
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: validate-bundle.js <bundle.json> | --study <name> | --all");
  process.exit(2);
}

let ok = true;
try {
  if (args[0] === "--all") {
    for (const n of studies.names()) ok = run(`study: ${n}`, studies.bundleFor(n)) && ok;
  } else if (args[0] === "--study") {
    if (!args[1]) { console.error(`--study needs a name (${studies.names().join(", ")})`); process.exit(2); }
    ok = run(`study: ${args[1]}`, studies.bundleFor(args[1]));
  } else {
    ok = run(args[0], JSON.parse(fs.readFileSync(args[0], "utf8")));
  }
} catch (e) {
  console.error(`Could not read that: ${e.message}`);
  process.exit(2);
}
process.exit(ok ? 0 : 1);
