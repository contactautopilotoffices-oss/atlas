#!/usr/bin/env node
/* ============================================================================
   ATLAS · the system check, with stand-ins for the outside services

     node scripts/preflight.test.js
   ============================================================================ */
"use strict";
const path = require("path"), os = require("os"), fs = require("fs");
process.env.CMS_DEV_STORE = path.join(os.tmpdir(), `atlas-preflight-${Date.now()}.json`);
for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CMS_SESSION_SECRET", "ANTHROPIC_API_KEY", "ENGY_API_KEY", "MAPBOX_TOKEN", "HIGGSFIELD_API_KEY", "HIGGSFIELD_API_KEY_ID", "HIGGSFIELD_API_KEY_SECRET", "EXA_API_KEY"]) delete process.env[k];
const { run, tinyPdf } = require("../api/cms/_preflight");
const { pdfText } = require("../api/cms/_pdf");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 300)}` : ""}`); } };
const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
const by = (r) => Object.fromEntries(r.checks.map(c => [c.key, c]));

(async () => {
  console.log("\nSystem check");
  const t = await pdfText(tinyPdf("Atlas system check"));
  ok("the built-in test PDF is a real PDF the reader can read", t.numPages === 1 && /Atlas system check/.test(t.pages[0]), JSON.stringify(t.pages));

  /* Nothing set up: the local store, no keys. */
  const bare = by(await run({ fetchFn: async () => res(500, {}) }));
  ok("the dev store is a note, not a failure", bare.db.status === "warn");
  ok("the migrations' tables are checked (dev store has them all)", bare.mig016.status === "ok" && bare.mig017.status === "ok" && bare.mig018.status === "ok");
  ok("the PDF reader passes by actually reading the test PDF", bare.pdf.status === "ok", bare.pdf.detail);
  ok("no AI key fails and says which key", bare.ai.status === "fail" && /ANTHROPIC_API_KEY/.test(bare.ai.fix));
  ok("no Mapbox token fails and says what it breaks", bare.mapbox.status === "fail" && /no pins/.test(bare.mapbox.detail));
  ok("Higgsfield and Exa are optional: off, not failed", bare.higgsfield.status === "off" && bare.exa.status === "off");

  /* Everything set, services answering. */
  Object.assign(process.env, { CMS_SESSION_SECRET: "s", ANTHROPIC_API_KEY: "a", MAPBOX_TOKEN: "pk.x", HIGGSFIELD_API_KEY: "h", EXA_API_KEY: "e" });
  const seen = [];
  const good = await run({ fetchFn: async (url, o = {}) => {
    seen.push(url);
    if (/api\.anthropic\.com\/v1\/models/.test(url)) return res(o.headers["x-api-key"] === "a" ? 200 : 401, { data: [] });
    if (/api\.mapbox\.com/.test(url)) return res(200, { features: [{ geometry: { coordinates: [72.87, 19.11] }, properties: { feature_type: "locality", full_address: "Andheri East" } }] });
    return res(404, {});
  } });
  const g = by(good);
  ok("a working Anthropic key is ok, checked with a free models call", g.ai.status === "ok" && seen.some(u => /v1\/models/.test(u)));
  ok("Mapbox is ok when a test address geocodes", g.mapbox.status === "ok" && /19\.110, 72\.870/.test(g.mapbox.detail), g.mapbox.detail);
  ok("the session secret, Higgsfield and Exa are ok when set", g.secret.status === "ok" && g.higgsfield.status === "ok" && g.exa.status === "ok");
  ok("ready to create an atlas and a case study", good.ready.atlas && good.ready.case, JSON.stringify(good.ready));

  /* A rejected key. */
  process.env.ANTHROPIC_API_KEY = "wrong";
  const badKey = by(await run({ fetchFn: async (url, o = {}) => /anthropic/.test(url) ? res(401, {}) : res(200, { features: [] }) }));
  ok("a rejected AI key fails with the status", badKey.ai.status === "fail" && /401/.test(badKey.ai.detail));
  ok("a token whose geocode finds nothing fails with a fix", badKey.mapbox.status === "fail" && /Geocoding API/.test(badKey.mapbox.fix));

  try { fs.unlinkSync(process.env.CMS_DEV_STORE); } catch (e) {}
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
