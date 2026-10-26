#!/usr/bin/env node
/* ============================================================================
   ATLAS · the metro, added automatically, with a stand-in OpenStreetMap

     node scripts/metro.test.js

   The Overpass answer below has the shape the real one has: a line mapped
   as two route relations (one per direction), stop members pointing at
   nodes whose names carry "Metro Station", and a monorail mapped with
   platforms instead of stops. Build must turn that into one line per line,
   stations in order, on the Transit sheet, without adding a line twice and
   without failing the atlas when OpenStreetMap does not answer.
   ============================================================================ */
"use strict";
delete process.env.ATLAS_METRO;
const { metroRows, linesFrom, areas } = require("../api/cms/_metro");
const { build } = require("../api/cms/_pdf");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 400)}` : ""}`); } };

const node = (id, name, lat, lon) => ({ type: "node", id, lat, lon, tags: { name } });
const rel = (id, tags, stops, role = "stop") => ({ type: "relation", id, tags: { type: "route", ...tags }, members: stops.map(ref => ({ type: "node", ref, role })) });
const OSM = { elements: [
  rel(101, { route: "subway", name: "Mumbai Metro Line 1: Versova → Ghatkopar", network: "Mumbai Metro", ref: "1", colour: "#0072BC" }, [1, 2, 3, 4]),
  rel(102, { route: "subway", name: "Mumbai Metro Line 1: Ghatkopar → Versova", network: "Mumbai Metro", ref: "1", colour: "#0072BC" }, [4, 3, 2]),
  rel(201, { route: "monorail", name: "Mumbai Monorail", network: "Mumbai Monorail", colour: "teal" }, [11, 12, 13], "platform"),
  rel(301, { route: "subway", name: "A stub with one stop", ref: "9" }, [21]),
  node(1, "Versova Metro Station", 19.1309, 72.8209), node(2, "D N Nagar", 19.1240, 72.8318),
  node(3, "Andheri Metro Station", 19.1208, 72.8484), node(4, "Ghatkopar (Platform 1)", 19.0866, 72.9081),
  node(11, "Chembur", 19.0622, 72.9003), node(12, "VNP Marg", 19.0545, 72.9001), node(13, "Fertiliser Township", 19.0461, 72.8996),
  node(21, "Lonely", 19.2, 72.9),
] };

(async () => {
  console.log("\nMetro, added automatically");

  const lines = linesFrom(OSM);
  ok("a line mapped in two directions becomes one line, the longer direction kept", lines.filter(l => /Line 1/.test(l.name)).length === 1 && lines.find(l => /Line 1/.test(l.name)).stations.length === 4);
  const l1 = lines.find(l => /Line 1/.test(l.name));
  ok("the line is named without its direction, with its number and colour", l1.name === "Mumbai Metro Line 1" && l1.short === "1" && l1.colour === "#0072BC" && l1.mode === "metro", JSON.stringify(l1).slice(0, 200));
  ok("station names lose \"Metro Station\" and \"(Platform 1)\"", l1.stations.map(s => s.name).join("|") === "Versova|D N Nagar|Andheri|Ghatkopar");
  ok("a monorail mapped with platforms still gets its stations", lines.some(l => l.name === "Mumbai Monorail" && l.stations.length === 3 && l.mode === "monorail"));
  ok("a route with fewer than two stations is not drawn", !lines.some(l => /stub/.test(l.name)));

  const bbs = areas([{ lat: 19.11, lng: 72.86 }, { lat: 19.12, lng: 72.88 }, { lat: 12.97, lng: 77.75 }]);
  ok("pins in two cities are asked about as two areas, each with a margin", bbs.length === 2 && bbs[0][0] < 19.11 && bbs[0][3] > 72.88, JSON.stringify(bbs));

  let asked = [];
  const fakeFetch = async (url, o) => { asked.push(decodeURIComponent(String(o.body)).slice(5)); return { ok: true, json: async () => OSM }; };
  const m = await metroRows([{ lat: 19.11, lng: 72.86 }], { fetchFn: fakeFetch });
  ok("Overpass is asked for subway, light rail and monorail routes in the area", asked.length === 1 && /route"~"\^\(subway\|light_rail\|monorail\)\$"/.test(asked[0]) && /node\(r\.r\)/.test(asked[0]), asked[0]);
  ok("the answer becomes Transit sheet rows, with the OSM link as the source", m.rows.length === 7 && m.rows[0]["Line name"] === "Mumbai Metro Line 1" && m.rows[0]["Open?"] === "yes" && /openstreetmap\.org\/relation\/101/.test(m.rows[0]["Source"]), JSON.stringify(m.rows[0]));
  const again = await metroRows([{ lat: 19.11, lng: 72.86 }], { fetchFn: fakeFetch, have: ["Mumbai Metro Line 1"] });
  ok("a line already in the sheet is not added twice", again.lines.length === 1 && again.lines[0].name === "Mumbai Monorail");

  /* Through Build: the metro joins the plan and the atlas. */
  const rows = { "Atlas": { "Title": "Andheri", "City": "Mumbai" }, "Options": [{ "ID": "a", "Property name": "A", "Latitude": 19.115, "Longitude": 72.86 }] };
  const built = await build(JSON.parse(JSON.stringify(rows)), { geocoder: async () => null, metroFn: (pts, o) => metroRows(pts, { ...o, fetchFn: fakeFetch }) });
  ok("Build adds the metro to the plan and to the atlas", built.rows["Transit"].length === 7 && built.bundle.transit.lines.length === 2 && built.report.ok, JSON.stringify(built.report.errors));
  ok("and says which lines it added", built.notes.some(n => /Added 2 metro lines from OpenStreetMap: Mumbai Metro Line 1 \(4 stations\)/.test(n)), built.notes.join(" | "));
  const rebuilt = await build(built.rows, { geocoder: async () => null, metroFn: (pts, o) => metroRows(pts, { ...o, fetchFn: fakeFetch }) });
  ok("building the same plan again does not add the lines twice", rebuilt.bundle.transit.lines.length === 2 && rebuilt.rows["Transit"].length === 7);
  const down = await build(JSON.parse(JSON.stringify(rows)), { geocoder: async () => null, metroFn: async () => { throw new Error("Overpass answered 504"); } });
  ok("when OpenStreetMap does not answer, the atlas still builds and says so", down.report.ok && down.notes.some(n => /could not be fetched from OpenStreetMap/.test(n)));
  const off = await build(JSON.parse(JSON.stringify(rows)), { geocoder: async () => null, metro: false, metroFn: async () => { throw new Error("should not be called"); } });
  ok("the metro can be switched off", off.report.ok && !off.bundle.transit);

  process.env.ATLAS_METRO = "off";
  const skipped = await metroRows([{ lat: 19.11, lng: 72.86 }], { fetchFn: async () => { throw new Error("network"); } });
  ok("ATLAS_METRO=off skips it without a network call", skipped.skipped && !skipped.rows.length);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
