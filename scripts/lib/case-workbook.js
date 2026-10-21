/* ============================================================================
   ATLAS · the case study workbook

     buildCaseTemplate()      the empty sheets (case-schema.js) as an .xlsx
     readCaseWorkbook(input)  a filled one, turned into a case bundle

   A case bundle is plain JSON (casestudy/SCHEMA.md). The page draws it; the
   costing engine turns its options into every money figure. Nothing here
   computes a number: that is costing.js's job, done at render time, so a
   change to one input changes every page.
   ============================================================================ */
"use strict";
const { buildTemplate, readSheets } = require("./workbook");
const { SHEETS } = require("./case-schema");

function buildCaseTemplate() {
  return buildTemplate({
    sheets: SHEETS,
    intro: {
      title: "Building a case study",
      lead: "Fill in the sheets, upload this file in the CMS, and the case study is built from it: the pages, the charts, the costing and the PDF. You never need to write code.",
      needed: "Only two sheets are needed: Case and Options. Every other sheet adds a section, and a section left empty is left out; the contents page renumbers itself.",
      tips: [
        "Prices, break-even, levers and the decision table's money lines are worked out from the Options and Assumptions sheets. Never type a result; type the input it comes from, and every page that quotes it changes together.",
        "Every row that starts with the word \"example\" is skipped when you upload. They are there to show you the shape.",
        "Columns are matched by their heading, not their position. Extra columns on Options are kept and shown on the side-by-side table.",
        "Pictures: give each slot a prompt in plain words on the Images sheet, and the CMS generates it in the house style, or paste a link of your own.",
      ],
    },
  });
}

const lines = (v) => String(v == null ? "" : v).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const semis = (v) => String(v == null ? "" : v).split(/;|\n/).map(s => s.trim()).filter(Boolean);
const strip = (o) => { const out = {}; for (const [k, v] of Object.entries(o)) if (k !== "__row" && v !== undefined && v !== "") out[k] = v; return out; };
const pctOrNum = (v) => v;

async function readCaseWorkbook(input) {
  const { bySheet, notes } = await readSheets(input, SHEETS);
  const b = {};

  /* ---- meta ---- */
  const m = bySheet["Case"];
  b.meta = strip({ ...m, backTitle: m.backTitle ? lines(m.backTitle).join("\n") : undefined });
  if (b.meta.asOf !== undefined) b.meta.asOf = String(b.meta.asOf);

  /* ---- assumptions ---- */
  const a = bySheet["Assumptions"];
  if (Object.keys(a).length) b.assumptions = strip({ ...a, notInSheet: a.notInSheet ? lines(a.notInSheet) : undefined });

  /* ---- options ---- */
  b.options = bySheet["Options"].map(r => strip(r));

  const table = (name, fn) => { const rows = bySheet[name].map(r => strip(r)); return rows.length ? (fn ? fn(rows) : rows) : undefined; };
  b.access = table("Access");
  b.rivals = table("Rivals", rows => rows.map(r => ({ ...r, near: r.near === undefined ? undefined : /^y/i.test(String(r.near)) })));
  b.openings = table("Openings");
  b.kpis = table("KPIs");
  b.series = table("Series", rows => rows.map(r => ({ ...r, value: typeof r.value === "number" ? r.value : parseFloat(String(r.value).replace(/[^0-9.\-]/g, "")) })));
  b.deals = table("Deals");
  b.occupiers = table("Occupiers", rows => rows.map(r => ({ ...r, within5: semis(r.within5), within10: semis(r.within10) })));
  b.pools = table("Pools", rows => rows.map(r => ({ ...r, chain: semis(r.chain) })));
  b.points = table("Points");
  b.lists = table("Lists", rows => { const out = {}; for (const r of rows) (out[r.list] = out[r.list] || []).push(r.note ? { item: r.item, note: r.note } : r.item); return out; });
  b.decision = table("Decision", rows => {
    const out = [];
    for (const r of rows) {
      let q = out.find(x => x.question === r.question);
      if (!q) { q = { question: r.question, answers: {} }; out.push(q); }
      if (r.option) q.answers[r.option] = r.answer !== undefined ? r.answer : "";
      if (r.code) q.code = r.code;
      if (r.edge) q.edge = r.edge;
    }
    return out;
  });
  b.copy = table("Copy", rows => { const out = {}; for (const r of rows) (out[r.key] = out[r.key] || []).push({ text: r.text, role: r.role || "means" }); return out; });
  b.sources = table("Sources", rows => { const out = {}; for (const r of rows) (out[r.key] = out[r.key] || []).push(r.text); return out; });
  b.images = table("Images", rows => { const out = {}; for (const r of rows) out[r.slot] = strip({ prompt: r.prompt, url: r.url, caption: r.caption }); return out; });

  for (const k of Object.keys(b)) if (b[k] === undefined) delete b[k];
  return { bundle: b, notes };
}

module.exports = { buildCaseTemplate, readCaseWorkbook };
