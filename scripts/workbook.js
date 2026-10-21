#!/usr/bin/env node
/* ============================================================================
   ATLAS · the workbook, from the command line

     node scripts/workbook.js --template [out.xlsx]   write the empty template
     node scripts/workbook.js <filled.xlsx>           read one and check it
     node scripts/workbook.js <filled.xlsx> --json out.json   and save it

   Reading prints the same report the team will see in /admin/, because it is
   the same code: the workbook is turned into a bundle and the bundle is put
   through scripts/lib/validate-bundle.js.
   ============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { buildTemplate, readWorkbook } = require("./lib/workbook");
const { validate, format } = require("./lib/validate-bundle");

(async () => {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: workbook.js --template [out.xlsx] | <filled.xlsx> [--json out.json]");
    process.exit(2);
  }

  if (args[0] === "--template") {
    const out = args[1] || "atlas-workbook.xlsx";
    const wb = buildTemplate();
    await wb.xlsx.writeFile(out);
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`Wrote ${out} (${kb} KB).`);
    console.log(`Sheets: ${wb.worksheets.map(w => w.name).join(", ")}`);
    return;
  }

  const file = args[0];
  if (!fs.existsSync(file)) { console.error(`No such file: ${file}`); process.exit(2); }
  const { bundle, notes } = await readWorkbook(file);
  const rep = validate(bundle);

  console.log(`\n=== ${path.basename(file)} ===\n`);
  if (notes.length) { console.log("Reading the workbook:"); notes.forEach(n => console.log("  " + n)); console.log(""); }
  console.log(format(rep));

  const jsonAt = args.indexOf("--json");
  if (jsonAt >= 0) {
    const out = args[jsonAt + 1] || "bundle.json";
    fs.writeFileSync(out, JSON.stringify(bundle, null, 2));
    console.log(`\nBundle written to ${out}.`);
  }
  process.exit(rep.ok ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
