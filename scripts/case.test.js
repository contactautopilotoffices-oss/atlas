#!/usr/bin/env node
/* ============================================================================
   ATLAS · the case study, workbook to pages

     node scripts/case.test.js

   Reads examples/andheri-case.xlsx, checks it against the validator, renders
   it in headless Chromium with the real page, and checks that the pages
   print the figures the Andheri Business Case Study 2026 printed, that no
   page overflows, and that a bundle with only the two required sheets still
   draws.
   ============================================================================ */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { readCaseWorkbook, buildCaseTemplate } = require("./lib/case-workbook");
const { validate, sectionsPresent } = require("./lib/validate-case");
const { renderPdf } = require("./casestudy-pdf");
const R = require("../casestudy/render");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 300)}` : ""}`); } };
const has = (text, s) => text.replace(/\s+/g, " ").includes(s);

(async () => {
  console.log("\nCase study: the Andheri example");
  const { bundle, notes } = await readCaseWorkbook(path.join(__dirname, "..", "examples", "andheri-case.xlsx"));
  const rep = validate(bundle);
  ok("the example workbook passes its checks", rep.ok, JSON.stringify(rep.errors));
  ok("every section is present", sectionsPresent(bundle).length === 9, sectionsPresent(bundle).join(","));
  ok("only the example rows were skipped", notes.every(n => /example row/.test(n)), notes.join(" | "));
  ok("the only warnings are the empty picture slots", rep.warnings.every(w => /No picture yet/.test(w.message)), JSON.stringify(rep.warnings));

  const out = R.render(bundle);
  ok("39 pages, nine sections, the contents page numbered", out.pages === 39 && out.toc.length === 9 && out.toc[0].page === 3 && out.toc[8].page === 37, JSON.stringify([out.pages, out.toc.map(t => t.page)]));
  ok("no NaN or undefined on any page", !/NaN|undefined|\[object/.test(out.html));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-case-"));
  const r = await renderPdf(bundle, path.join(dir, "andheri"), { pngs: false });
  ok("the page renders in Chromium with no errors and prints a PDF", r.pages === 39 && fs.statSync(path.join(dir, "andheri.pdf")).size > 100000);
  ok("no page overflows its sheet", r.overflow.length === 0, JSON.stringify(r.overflow));
  const t = r.text;
  for (const s of ["₹21,560", "₹18,410", "₹62,13,915", "₹43,16,667", "₹94,51,288", "₹68,11,700", "₹78,76,073", "₹56,76,417", "83%", "₹40.35 Cr", "₹28.23 Cr", "₹23,716", "₹20,251", "₹21,902", "₹18,815", "−₹420", "−₹284", "−₹233", "−₹2,156", "−₹1,841", "−₹3.15 L", "−₹2.27 L", "4 edges", "6 edges", "Middle ₹15,000", "0 of 30", "24 more centres", "5,500+"]) ok(`the pages print ${s}`, has(t, s));
  ok("the contents page lists the nine sections", has(t, "The two options") && has(t, "Competitive landscape") && has(t, "The decision"));
  fs.rmSync(dir, { recursive: true, force: true });

  console.log("\nA thin case: only the two required sheets");
  const wb = buildCaseTemplate();
  const C = wb.getWorksheet("Case"); C.getRow(4).getCell(2).value = "Thin case"; C.getRow(7).getCell(2).value = "2026-10";
  const O = wb.getWorksheet("Options"); O.spliceRows(4, 1);
  const r5 = O.getRow(4); r5.getCell(1).value = "one"; r5.getCell(2).value = "One Tower"; r5.getCell(3).value = 10000; r5.getCell(4).value = 150; r5.getCell(7).value = 1500; r5.commit();
  const thinPath = path.join(os.tmpdir(), `thin-${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(thinPath);
  const thin = await readCaseWorkbook(thinPath);
  const trep = validate(thin.bundle);
  ok("it passes with warnings only", trep.ok, JSON.stringify(trep.errors));
  const tout = R.render(thin.bundle);
  ok("it draws the cover, contents, the options section and the back", tout.pages >= 8 && tout.toc.length >= 1 && /One Tower/.test(tout.html), String(tout.pages));
  ok("its price is worked out: (150 + 1500/60 + 75) × 35 × 1.2 = ₹10,500", /₹10,500/.test(tout.html));
  fs.unlinkSync(thinPath);

  console.log("\nBad input is named, not drawn");
  const bad = validate({ meta: {}, options: [{ id: "A B", name: "", carpet: "big" }, { id: "x", name: "X", carpet: 100, rentRate: 1, fitoutRate: 1 }, { id: "x", name: "X again", carpet: 100, rentRate: 1, fitoutRate: 1 }], access: [{ option: "nope", distanceM: "far" }], decision: [{ question: "Q", answers: { nope: "a" }, edge: "nope" }] });
  ok("missing title, bad id, text where a number should be, a duplicate id, dangling references", !bad.ok && bad.errors.length >= 7 && bad.errors.some(e => /not a valid ID/.test(e.message)) && bad.errors.some(e => /used twice/.test(e.message)) && bad.errors.some(e => /not an ID on the Options sheet/.test(e.message)), JSON.stringify(bad.errors));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
