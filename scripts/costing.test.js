#!/usr/bin/env node
/* ============================================================================
   ATLAS · the costing engine against the Andheri Business Case Study 2026

   Every figure here was printed in that document (pages 4 to 9, 25, 32).
   The engine must produce the same number from the sheet's inputs, which
   is what makes the case study reproducible from a workbook.
   ============================================================================ */
"use strict";
const C = require("../casestudy/costing");

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${got !== undefined ? `  (got ${JSON.stringify(got)})` : ""}`); } };
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

const A = { runningRate: 75, lockinMonths: 60, margin: 0.2, sqftPerSeat: 35, brokeragePct: 0.1, adsPerMonth: 150000, targetPrice: 18000 };
const PRIVILON = { id: "privilon", name: "Privilon", carpet: 15343, efficiency: 0.6, rentRate: 405, rentBasis: "carpet", fitoutRate: 2000 };
const AVENUE = { id: "723-avenue", name: "723 Avenue", carpet: 12950, efficiency: 0.6, rentRate: 200, rentBasis: "builtup", fitoutRate: 1800 };

console.log("\nCosting: page 5, the costing line by line");
const p = C.cost(PRIVILON, A), v = C.cost(AVENUE, A);
ok("723 Avenue built-up = carpet / 0.6 = 21,583", near(v.builtup, 21583), v.builtup);
ok("723 Avenue rent on carpet = Rs 333", near(v.rentOnCarpet, 333.33, 0.1), v.rentOnCarpet);
ok("Privilon rent a month = Rs 62,13,915", near(p.rent, 6213915), p.rent);
ok("723 Avenue rent a month = Rs 43,16,667", near(v.rent, 4316667), v.rent);
ok("fit-out: Rs 3,06,86,000 and Rs 2,33,10,000", near(p.fitout, 30686000) && near(v.fitout, 23310000));
ok("fit-out recovered a month: Rs 5,11,433 and Rs 3,88,500", near(p.fitoutMonthly, 511433) && near(v.fitoutMonthly, 388500));
ok("running costs: Rs 11,50,725 and Rs 9,71,250", near(p.running, 1150725) && near(v.running, 971250));
ok("total cost a month: Rs 78,76,073 and Rs 56,76,417", near(p.total, 7876073) && near(v.total, 5676417), [p.total, v.total]);
ok("margin: Rs 15,75,215 and Rs 11,35,283", near(p.margin, 1575215) && near(v.margin, 1135283));
ok("billed a month: Rs 94,51,288 and Rs 68,11,700", near(p.billed, 9451288) && near(v.billed, 6811700));
ok("seats: 438 and 370", p.seats === 438 && v.seats === 370);
ok("price a seat: Rs 21,560 and Rs 18,410", near(p.price, 21560) && near(v.price, 18410), [p.price, v.price]);
ok("price a sq ft of carpet: Rs 616 and Rs 526", near(p.pricePerSqft, 616) && near(v.pricePerSqft, 526));
ok("with 10% brokerage: Rs 23,716 and Rs 20,251 a seat", near(p.withBrokerage.price, 23716) && near(v.withBrokerage.price, 20251));
ok("with Rs 1.5 L of ads: Rs 21,902 and Rs 18,815 a seat", near(p.withAds.price, 21902) && near(v.withAds.price, 18815));
ok("Rs 678 and Rs 579 a sq ft with brokerage; Rs 626 and Rs 538 with ads", near(p.withBrokerage.pricePerSqft, 678) && near(v.withBrokerage.pricePerSqft, 579) && near(p.withAds.pricePerSqft, 626) && near(v.withAds.pricePerSqft, 538));

console.log("\nPages 6 and 7: what each floor earns, what a seat costs");
ok("profit a month, full: Rs 15.75 L and Rs 11.35 L; a year about 1.89 Cr and 1.36 Cr", near(p.profitFullYear, 18902580, 10) && near(v.profitFullYear, 13623400, 10));
ok("locked in over 60 months: Rs 40.4 Cr and Rs 28.2 Cr", near(p.commitment / 1e7, 40.4, 0.05) && near(v.commitment / 1e7, 28.2, 0.05), [p.commitment, v.commitment]);
ok("rent is 79% of Privilon's cost and 76% of 723 Avenue's", near(p.rentShareOfCost, 0.789, 0.005) && near(v.rentShareOfCost, 0.760, 0.005));
ok("rent's share of every seat: 66% and 63%", near(p.rentShareOfPrice, 0.657, 0.005) && near(v.rentShareOfPrice, 0.634, 0.005));
ok("rent a seat: Rs 14,175 and Rs 11,667", near(p.perSeat.rent, 14175) && near(v.perSeat.rent, 11667));
ok("margin a seat: Rs 3,593 and Rs 3,068", near(p.perSeat.margin, 3593) && near(v.perSeat.margin, 3068), [p.perSeat.margin, v.perSeat.margin]);
ok("brokerage a seat: Rs 2,156 and Rs 1,841", near(p.perSeat.brokerage, 2156) && near(v.perSeat.brokerage, 1841));
ok("ads a seat: Rs 342 and Rs 405 (page 24)", near(p.perSeat.ads, 342) && near(v.perSeat.ads, 405));
ok("Privilon's Rs 405 on carpet is about Rs 243 on built-up", near(p.rentOnBuiltup, 243));

console.log("\nPage 8: how full each floor must be");
ok("every cost covered at 83%", near(p.breakEven, 0.8333, 0.001) && near(v.breakEven, 0.8333, 0.001));
ok("365 of 438 seats at Privilon, 308 of 370 at 723 Avenue", near(p.breakEven * p.seatsExact, 365.3, 0.5) && near(v.breakEven * v.seatsExact, 308.3, 0.5));
ok("running costs covered at 78%", near(p.runningCovered, 0.779, 0.005) && near(v.runningCovered, 0.776, 0.005));
ok("85% with Rs 1.5 L of ads a month", near(p.breakEvenWithAds, 0.849, 0.005) && near(v.breakEvenWithAds, 0.855, 0.005));
ok("at 80% full Privilon loses Rs 3.15 L and 723 Avenue Rs 2.27 L", near(C.atOccupancy(p, 0.8), -315000, 1000) && near(C.atOccupancy(v, 0.8), -227000, 1000), [C.atOccupancy(p, 0.8), C.atOccupancy(v, 0.8)]);

console.log("\nPage 9: the levers");
const lp = Object.fromEntries(p.levers.map(l => [l.key, l])), lv = Object.fromEntries(v.levers.map(l => [l.key, l]));
ok("rent Rs 10 lower takes Rs 420 off a seat, either floor", near(lp.rent.saving, 420) && near(lv.rent.saving, 420));
ok("one rent-free month: Rs 284 and Rs 233", near(lp.rentFree.saving, 284) && near(lv.rentFree.saving, 233), [lp.rentFree.saving, lv.rentFree.saving]);
ok("fit-out Rs 100 cheaper: Rs 70", near(lp.fitout.saving, 70) && near(lv.fitout.saving, 70));
ok("no broker: Rs 2,156 and Rs 1,841", near(lp.broker.saving, 2156) && near(lv.broker.saving, 1841));
ok("Rs 18,000 needs Rs 320 a sq ft carpet at Privilon", near(lp.target.rent.onCarpet, 320, 1), lp.target.rent);
ok("Rs 18,000 needs Rs 194 a sq ft built-up at 723 Avenue", near(lv.target.rent.onBuiltup, 194, 1), lv.target.rent);
ok("the rule of thumb: Rs 1 a sq ft moves a seat by Rs 42", near(p.perSqftPerSeat, 42));

console.log("\nFormats and defaults");
ok("inr formats lakh, crore and plain", C.inr(9451288) === "₹94.51 L" && C.inr(403520900) === "₹40.4 Cr" && C.inr(21560) === "₹21,560" && C.inr(-315000, { unit: "L" }) === "−₹3.15 L", [C.inr(9451288), C.inr(403520900), C.inr(21560), C.inr(-315000, { unit: "L" })]);
ok("percentages given as 20 or 0.2 both mean a fifth", C.cost({ carpet: 1000, rentRate: 100, fitoutRate: 0, margin: 20 }).price === C.cost({ carpet: 1000, rentRate: 100, fitoutRate: 0, margin: 0.2 }).price);
ok("an option with no carpet area costs nothing and divides by nothing", C.cost({}).price === 0 && C.cost({}).breakEven === 0);
const cc = C.caseCosting([PRIVILON, AVENUE], A);
ok("the case set carries both options, the break-even and the price range", cc.options.length === 2 && near(cc.breakEven, 0.8333, 0.001) && near(cc.priceLow, 18410) && near(cc.priceHigh, 21560));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
