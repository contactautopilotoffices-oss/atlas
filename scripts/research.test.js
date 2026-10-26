#!/usr/bin/env node
/* ============================================================================
   ATLAS · web research (Exa) for an atlas, with stand-ins for Exa and the model

     node scripts/research.test.js

   Checks what is searched for (each property with no address, and the area's
   market), that only what a search result supports is added, always with its
   link, that nothing the files said is overwritten, and that research never
   stands in the way of an atlas (no key, or Exa down: the plan comes back
   unchanged with a note).
   ============================================================================ */
"use strict";
const { research, queriesFor, webContext, exaSearch } = require("../api/cms/_research");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 400)}` : ""}`); } };

const PLAN = {
  "Atlas": { "Title": "Andheri coworking", "City": "Mumbai" },
  "Options": [
    { "ID": "awfis-skyline", "Property name": "Awfis, Skyline Icon", "Locality": "Marol" },
    { "ID": "wework-lightbridge", "Property name": "WeWork, Light Bridge", "Locality": "Chandivali", "Address": "Saki Vihar Road, Chandivali" },
    { "ID": "pinned", "Property name": "Already pinned", "Locality": "Marol", "Latitude": 19.12, "Longitude": 72.88 },
  ],
  "Facts": [{ "Group": "market", "Label": "Flex price range", "Value": "Rs 10,000 to 35,000", "Source": "the survey" }],
};
const RESULTS = {
  address: { title: "Awfis Skyline Icon, Andheri Kurla Road", url: "https://example.com/awfis-skyline", published: "2026-05-01", highlights: ["Awfis at Skyline Icon, Andheri Kurla Road, Marol, Mumbai 400059."] },
  rent: { title: "Andheri East office rents rise", url: "https://example.com/rents", published: "2026-08-10", highlights: ["Grade A rents in Andheri East averaged Rs 145 a sq ft a month in Q2 2026."] },
};

(async () => {
  console.log("\nWeb research");
  const q = queriesFor(PLAN);
  ok("each property with no address and no pin is searched for by name and area", q.gaps.length === 1 && /Awfis, Skyline Icon Marol Mumbai address/.test(q.gaps[0].query), JSON.stringify(q.gaps));
  ok("the main area's market is searched: rents, coworking, deals, supply, metro", q.market.slice(0, 5).every(m => /^Marol, Mumbai/.test(m.query)) && q.market.some(m => /coworking/.test(m.query)) && q.market.some(m => /metro/.test(m.query)), JSON.stringify(q.market.map(m => m.query)));
  ok("and the other areas the properties are in", q.market.some(m => /^Chandivali, Mumbai office market rent/.test(m.query)));

  let searched = null, told = null;
  const search = async (jobs) => { searched = jobs; return jobs.map(j => ({ query: j.query, results: /address/.test(j.query) ? [RESULTS.address] : /rent/.test(j.query) ? [RESULTS.rent] : [] })); };
  const complete = async (a) => { told = a; return { model: "fake", provider: "test", json: {
    "Options": [
      { "ID": "awfis-skyline", "Address": "Skyline Icon, Andheri Kurla Road, Marol", "Locality": "Marol", "Source": "https://example.com/awfis-skyline" },
      { "ID": "wework-lightbridge", "Address": "Somewhere else", "Source": "https://example.com/rents" },
      { "ID": "pinned", "Address": "Should not be written", "Source": "https://example.com/rents" },
      { "ID": "made-up", "Address": "Nowhere", "Source": "https://example.com/rents" },
    ],
    "Facts": [
      { "Group": "market", "Label": "Grade A rent, Andheri East", "Value": "Rs 145 a sq ft a month", "As of": "2026-06", "Source": "https://example.com/rents", "How firm": "high" },
      { "Group": "market", "Label": "A figure with no source", "Value": "Rs 999" },
      { "Group": "market", "Label": "A figure from a page nobody found", "Value": "Rs 1", "Source": "https://invented.example.com" },
      { "Group": "market", "Label": "Flex price range", "Value": "Rs 1 to 2", "Source": "https://example.com/rents" },
    ] } }; };
  const out = await research({ rows: PLAN, requirement: "120 seats near the metro" }, { search, complete });
  ok("the model is given the plan's IDs, the requirement and every result with its link", /awfis-skyline/.test(told.user) && /120 seats/.test(told.user) && /example\.com\/rents/.test(told.user) && told.effort === "low");
  const aw = out.rows["Options"].find(o => o["ID"] === "awfis-skyline");
  ok("a found address is added where the plan had none, with its source", aw["Address"] === "Skyline Icon, Andheri Kurla Road, Marol" && aw["Address source"] === "https://example.com/awfis-skyline");
  ok("an address the files gave is never overwritten", out.rows["Options"].find(o => o["ID"] === "wework-lightbridge")["Address"] === "Saki Vihar Road, Chandivali");
  ok("a pinned property is left alone, and an ID not in the plan is ignored", !out.rows["Options"].find(o => o["ID"] === "pinned")["Address"] && out.rows["Options"].length === 3);
  const facts = out.rows["Facts"];
  ok("a market fact with a real source is added, marked as found by research", facts.some(f => f["Label"] === "Grade A rent, Andheri East" && f["Source"] === "https://example.com/rents" && /web research/.test(f["Note"])));
  ok("a fact with no source, or a source no search returned, is dropped", !facts.some(f => /no source|nobody found/.test(f["Label"])));
  ok("a fact already in the plan by label is not added twice", facts.filter(f => f["Label"] === "Flex price range").length === 1 && facts.find(f => f["Label"] === "Flex price range")["Value"] === "Rs 10,000 to 35,000");
  ok("the note says what research added", out.added.addresses === 1 && out.added.facts === 1 && out.notes.some(n => /1 address found/.test(n) && /1 market fact added/.test(n)), out.notes.join(" | "));
  ok("the sources come back for the page to list", out.sources.length === 2);
  ok("the plan passed in is not changed in place", !PLAN["Options"][0]["Address"]);

  /* Research never stands in the way. */
  delete process.env.EXA_API_KEY;
  const off = await research({ rows: PLAN });
  ok("without an Exa key the plan comes back as it was, with a note", JSON.stringify(off.rows) === JSON.stringify(PLAN) && /EXA_API_KEY/.test(off.notes[0]));
  const down = await research({ rows: PLAN }, { search: async (jobs) => jobs.map(j => ({ query: j.query, error: "Exa answered 500", results: [] })), complete });
  ok("when every search fails the plan is unchanged and the note says why", JSON.stringify(down.rows) === JSON.stringify(PLAN) && /did not work \(Exa answered 500\)/.test(down.notes[0]));
  ok("Enhance gets no web text without a key", (await webContext("Andheri 120 seats")) === "");

  /* The Exa request itself. */
  process.env.EXA_API_KEY = "k";
  let sent = null;
  const r = await exaSearch("Marol office rent", { fetchFn: async (url, o) => { sent = { url, o }; return { ok: true, json: async () => ({ results: [{ title: "T", url: "https://x", publishedDate: "2026-07-01T00:00:00Z", highlights: ["a  b"] }] }) }; } });
  ok("Exa is asked with the key, for India, with highlights", /\/search$/.test(sent.url) && sent.o.headers["x-api-key"] === "k" && JSON.parse(sent.o.body).userLocation === "IN" && JSON.parse(sent.o.body).contents.highlights);
  ok("its answer is kept short and dated", r.results[0].published === "2026-07-01" && r.results[0].highlights[0] === "a b");
  const refused = await exaSearch("x", { fetchFn: async () => ({ ok: false, status: 401, json: async () => ({}) }) });
  ok("a refused key is named as such", refused.error === "the Exa key was refused");

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
