#!/usr/bin/env node
/* ============================================================================
   ATLAS · the three kinds of atlas, on the server side

     node scripts/types.test.js

   The type picked in Create (compare and decide, show a place, show a
   network) changes where the model puts the rows, what the web is searched
   for and what research may add. This checks each of those with stand-ins
   for the model, Exa and the geocoder, and that Build opens a network on the
   country rather than one street.
   ============================================================================ */
"use strict";
const { askFor, typeOf, build } = require("../api/cms/_pdf");
const { plan } = require("../api/cms/_sources");
const { research, discover, queriesFor } = require("../api/cms/_research");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 400)}` : ""}`); } };

(async () => {
  console.log("\nThe type steers the plan");
  ok("an unknown type reads as compare and decide", typeOf("nonsense") === "decide" && typeOf("place") === "place" && typeOf(undefined) === "decide");
  ok("compare and decide adds nothing to the prompt", !/WHAT THIS ATLAS SHOWS/.test(askFor("x", null, "decide")));
  const pl = askFor("Lakeside Campus, Hoodi", null, "place");
  ok("a place puts the site on Options and the competition on Places, with operators", /WHAT THIS ATLAS SHOWS \(these lines win/.test(pl) && /ONE site/.test(pl) && /"Operator"/.test(pl) && /Kind "flex"/.test(pl), pl.slice(0, 300));
  const nw = askFor("", null, "network");
  ok("a network puts every location on Options with its City", /every location/i.test(nw) && /Always fill "City"/.test(nw));

  let seen = null;
  const llm = async (a) => { seen = a; return { model: "fake", provider: "test", rows: { "Atlas": { "Title": "T" }, "Options": [{ "ID": "a", "Property name": "A" }] } }; };
  await plan([{ name: "list.csv", buf: Buffer.from("Operator,Building\nAwfis,Skyline\n") }], { llm, type: "place" });
  ok("planning from files hands the type to the model", seen && seen.type === "place");
  await plan([{ name: "list.csv", buf: Buffer.from("Operator,Building\nAwfis,Skyline\n") }], { llm, type: "bogus" });
  ok("and a type it does not know is sent as compare and decide", seen.type === "decide");

  console.log("\nWhat the web is searched for");
  const SITE = { "Atlas": { "Title": "Hoodi", "City": "Bengaluru" }, "Options": [{ "ID": "lakeside-campus", "Property name": "Lakeside Campus", "Locality": "Hoodi", "Address": "ITPL Main Road" }], "Places": [{ "ID": "wework-x", "Kind": "flex", "Name": "WeWork Prestige", "Operator": "WeWork" }] };
  const qp = queriesFor(SITE, { type: "place" });
  ok("a place is searched around its site: centres nearby, operators, deals, supply", /^coworking centres near Lakeside Campus Hoodi, Bengaluru/.test(qp.market[0].query) && qp.market.some(m => /flex operators/.test(m.query)) && qp.market.some(m => /deals/.test(m.query)) && qp.place === "Hoodi, Bengaluru", JSON.stringify(qp.market.map(m => m.query)));
  const NET = { "Atlas": { "Title": "Offices" }, "Options": [
    { "ID": "a", "Property name": "A", "City": "Mumbai", "Address": "x" }, { "ID": "b", "Property name": "B", "City": "Mumbai", "Address": "x" },
    { "ID": "c", "Property name": "C", "City": "Pune", "Address": "x" }, { "ID": "d", "Property name": "D", "City": "Noida" } ] };
  const qn = queriesFor(NET, { type: "network" });
  ok("a network is searched city by city, the biggest first", /^Mumbai office rent/.test(qn.market[0].query) && qn.market.some(m => /^Pune /.test(m.query)) && qn.market.some(m => /^Noida /.test(m.query)), JSON.stringify(qn.market.map(m => m.query)));
  ok("and a location with no address is looked up in its own city", qn.gaps.length === 1 && /D Noida address/.test(qn.gaps[0].query), JSON.stringify(qn.gaps));

  console.log("\nResearch around one site");
  process.env.EXA_API_KEY = "k";
  const R = { title: "Coworking in Hoodi", url: "https://example.com/hoodi", published: "2026-08-01", highlights: ["Awfis ITPL and WeWork Prestige Shantiniketan serve Hoodi."] };
  const search = async (jobs) => jobs.map(j => ({ query: j.query, results: [R] }));
  let told = null;
  const complete = async (a) => { told = a; return { model: "fake", json: { "Places": [
    { "Kind": "flex", "Name": "Awfis ITPL", "Operator": "Awfis", "Address": "ITPL Main Road", "Second line": "400 seats", "Source": "https://example.com/hoodi", "Latitude": 12.9 },
    { "Kind": "flex", "Name": "WeWork Prestige", "Operator": "WeWork", "Source": "https://example.com/hoodi" },
    { "Kind": "flex", "Name": "Invented Hub", "Operator": "Nobody", "Source": "https://made-up.example.com" },
    { "Name": "No kind given", "Source": "https://example.com/hoodi" },
  ], "Facts": [] } }; };
  const out = await research({ rows: SITE, type: "place" }, { search, complete });
  ok("the model is told the atlas shows one site", /THE ATLAS SHOWS ONE SITE/.test(told.user) && /WeWork Prestige/.test(told.user));
  const added = out.rows["Places"].slice(1);
  ok("centres the results name are added with their operator and source, never a coordinate", added.length === 2 && added[0]["Name"] === "Awfis ITPL" && added[0]["Operator"] === "Awfis" && added[0]["Source"] === "https://example.com/hoodi" && added[0]["Latitude"] === undefined && /web research/.test(added[0]["Note"]), JSON.stringify(added));
  ok("one already in the plan is not added twice, one from a page nobody found is dropped", !added.some(p => /WeWork|Invented/.test(p["Name"])));
  ok("a place with no kind is counted as flex", added[1]["Kind"] === "flex" && added[1]["Name"] === "No kind given");
  ok("the note says how many were found around the site", out.added.places === 2 && /2 centres or deals found around the site/.test(out.notes[0]), out.notes[0]);
  const cmp = await research({ rows: SITE, type: "decide" }, { search, complete });
  ok("compare and decide never adds places from research", (cmp.rows["Places"] || []).length === 1 && /COMPARES/.test(told.user));

  console.log("\nStarting from words");
  let asked = null;
  const dsearch = async (jobs) => { asked = jobs; return jobs.map(j => ({ query: j.query, results: [R] })); };
  const dcomplete = async (a) => { told = a; return { model: "fake", json: { "Atlas": { "Title": "Lakeside Campus" }, "Options": [{ "ID": "lakeside-campus", "Property name": "Lakeside Campus", "Address": "ITPL Main Road", "Source": "https://example.com/hoodi" }],
    "Places": [{ "Kind": "flex", "Name": "Awfis ITPL", "Operator": "Awfis", "Source": "https://example.com/hoodi", "Longitude": 77.7 }, { "Kind": "flex", "Name": "Ghost", "Source": "https://nope.example.com" }] } }; };
  const d = await discover({ requirement: "Lakeside Campus, ITPL Main Road, Hoodi", type: "place" }, { search: dsearch, complete: dcomplete });
  ok("a place from words searches for the site and what is around it", /address location/.test(asked[0].query) && asked.some(j => /^coworking centres near/.test(j.query)) && /ONE SITE/.test(told.user), JSON.stringify(asked.map(j => j.query)));
  ok("and comes back as the site plus the sourced centres around it", d.rows["Options"].length === 1 && d.rows["Places"].length === 1 && d.rows["Places"][0]["Longitude"] === undefined && /the site and 1 centre or deal around it/.test(d.notes[0]), d.notes[0]);
  const dn = await discover({ requirement: "Every office of Acme in India", type: "network" }, { search: dsearch, complete: dcomplete });
  ok("a network from words searches for every location and keeps no places", asked.some(j => /offices locations cities India/.test(j.query)) && !dn.rows["Places"] && /1 location,/.test(dn.notes[0]), dn.notes[0]);

  console.log("\nBuild");
  const across = { "Atlas": { "Title": "Offices", "Data current to": "2026-10" }, "Options": [
    { "ID": "a", "Property name": "A", "Latitude": 19.12, "Longitude": 72.86 }, { "ID": "b", "Property name": "B", "Latitude": 12.97, "Longitude": 77.75 },
    { "ID": "c", "Property name": "C", "Address": "Sector 62, Noida" } ] };
  const geocoder = async (q) => /Noida/.test(q) ? { lat: 28.62, lng: 77.36, precision: "street", label: "Sector 62, Noida", city: "Noida" } : null;
  const b = await build(across, { geocoder, metro: false });
  ok("pins across the country open on the country, not one street", b.bundle.meta.zoom === 4.4, JSON.stringify(b.bundle.meta));
  ok("a geocoded location gets its city from the geocoder", b.rows["Options"][2]["City"] === "Noida" && b.bundle.options.find(o => o.id === "c").city === "Noida");
  const one = await build({ "Atlas": { "Title": "One" }, "Options": [{ "ID": "a", "Property name": "A", "Latitude": 19.12, "Longitude": 72.86 }, { "ID": "b", "Property name": "B", "Latitude": 19.07, "Longitude": 72.87 }] }, { geocoder: async () => null, metro: false });
  ok("pins in one city still open on the street", one.bundle.meta.zoom === 13);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
