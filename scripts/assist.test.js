#!/usr/bin/env node
/* ============================================================================
   ATLAS · the helper, with a stand-in model

     node scripts/assist.test.js

   The helper is only as good as what it is given and what it is allowed
   to change. This checks the brief carries the computed figures (never
   the workbook's cells alone), each task asks for the right shape, and
   apply() folds suggestions into the draft without breaking it.
   ============================================================================ */
"use strict";
const path = require("path");
const { readCaseWorkbook } = require("./lib/case-workbook");
const { validate } = require("./lib/validate-case");
const assist = require("../api/cms/_assist");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 300)}` : ""}`); } };

(async () => {
  console.log("\nThe helper");
  const { bundle } = await readCaseWorkbook(path.join(__dirname, "..", "examples", "andheri-case.xlsx"));
  const br = assist.brief(bundle);
  ok("the brief carries the costed figures, not just the inputs", br.costed[0].priceSeat === 21560 && br.costed[1].priceSeat === 18410 && br.breakEvenPct === 83.3 && Math.abs(br.costed[0].lossAt80pc + 315000) < 100, JSON.stringify(br.costed[0]));
  ok("the brief summarises the rivals", br.rivalsSummary.count === 31 && br.rivalsSummary.median === 15000 && br.rivalsSummary.max === 35000, JSON.stringify(br.rivalsSummary));
  ok("the brief lists which copy and pictures exist", br.copyPresent.includes("occupancy") && br.imagesPresent.length === 9);

  const seen = [];
  const fake = (reply) => async ({ system, user }) => { seen.push({ system, user }); return { json: reply, model: "fake", provider: "test" }; };
  const thin = JSON.parse(JSON.stringify(bundle)); delete thin.copy; delete thin.images;
  const m = await assist.run("means", thin, {}, { complete: fake({ copy: { occupancy: ["Line one.", "Line two."], nonsense: ["x"] } }) });
  ok("means asks for the pages with no lines and names each page", /occupancy: how full/.test(seen[0].system) && /Write lines for these keys/.test(seen[0].user) && /"priceSeat":21560/.test(seen[0].user));
  ok("keys the pages do not have are dropped", m.copy.occupancy.length === 2 && !m.copy.nonsense);
  const full = await assist.run("means", bundle, {}, { complete: fake({ copy: {} }) });
  ok("pages that already have their lines are not asked for again", !/occupancy|seat|earns/.test(seen[seen.length - 1].user.split("DATA")[0]) && /deals|flex|corridor/.test(seen[seen.length - 1].user.split("DATA")[0]), seen[seen.length - 1].user.split("DATA")[0]);
  const done = JSON.parse(JSON.stringify(bundle)); for (const k of ["deals", "flex", "corridor", "pipelines", "catchment", "pools", "access", "earns", "seat", "occupancy", "infrastructure", "plan", "risks", "openings", "occupancyRivals", "ladder"]) done.copy[k] = [{ text: "x", role: "means" }];
  const none = await assist.run("means", done, {}, { complete: fake({}) });
  ok("a case with every line written is left alone", /already has its lines/.test(none.note), JSON.stringify(none));
  const r = await assist.run("read", thin, {}, { complete: fake({ read: ["A.", "B."], readFirst: ["1", "2", "3"] }) });
  ok("read returns the two paragraphs and the three lines", r.read.length === 2 && r.readFirst.length === 3);
  const p = await assist.run("prompts", thin, {}, { complete: fake({ prompts: { cover: "Towers at dusk", bogus: "x" } }) });
  ok("prompts keeps only real slots", p.prompts.cover === "Towers at dusk" && !p.prompts.bogus);
  let err = null; try { await assist.run("poem", thin, {}, { complete: fake({}) }); } catch (e) { err = e; }
  ok("an unknown task is refused with the list", err && err.status === 400 && /means, read, risks/.test(err.message));
  ok("the style forbids invented figures and em dashes", /Never add a figure/.test(seen[0].system) && /No em dashes/.test(seen[0].system));

  console.log("\napply()");
  const next = assist.apply(thin, { copy: { occupancy: ["New line."] }, read: ["Our read."], readFirst: ["One", "Two", "Three"], risks: [{ title: "R1", text: "t", kpi: "83%", kpiLabel: "l", mitigate: "m" }], prompts: { cover: "Scene" }, deals: [{ who: "X", area: "1,000 sq ft", src: "https://e.x/1" }], series: [{ chart: "vacancy", label: "Q3 26", value: "9.9", src: "https://e.x/2" }, { chart: "vacancy", label: "bad", value: "n/a" }] });
  ok("copy lines land with the means role, the read with the read role", next.copy.occupancy[0].role === "means" && next.copy.decision[0].role === "read" && next.copy.readFirst.length === 3);
  ok("risks replace the risks points only", next.points.filter(x => x.section === "risks").length === 1 && next.points.filter(x => x.section === "market").length === 5);
  ok("a prompt lands on its slot; a deal and a numeric series row are appended with their sources", next.images.cover.prompt === "Scene" && next.deals.length === 9 && /https:\/\/e\.x\/1/.test(next.deals[8].note) && next.series.length === 23 && next.series[22].value === 9.9);
  ok("the original is untouched", !thin.copy && bundle.deals.length === 8);
  ok("what apply() makes still passes the checks", validate(next).ok, JSON.stringify(validate(next).errors));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
