#!/usr/bin/env node
/* ============================================================================
   ATLAS · pictures from Higgsfield, with a stand-in Higgsfield

     node scripts/images.test.js

   The real API is asynchronous: submit, poll, copy the result. This runs
   that path against a fake that answers the way docs.higgsfield.ai says
   the real one does, including a slow job, a refused one and a missing key.
   ============================================================================ */
"use strict";
process.env.CMS_DEV_STORE = require("path").join(require("os").tmpdir(), `atlas-img-${Date.now()}.json`);
delete process.env.HIGGSFIELD_API_KEY;
process.env.HIGGSFIELD_API_KEY_ID = "kid"; process.env.HIGGSFIELD_API_KEY_SECRET = "ksec";
const images = require("../api/cms/_images");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`); } };
const res = (status, body, headers = {}) => ({ ok: status < 400, status, json: async () => body, arrayBuffer: async () => Buffer.from("PNGDATA"), headers: { get: (k) => headers[k.toLowerCase()] } });

(async () => {
  console.log("\nHiggsfield images");
  const p = images.promptFor("cover", "Two towers at dusk", { place: "Marol", city: "Mumbai" });
  ok("the prompt carries the words, the place, the slot's hint and the house style", /Two towers at dusk/.test(p) && /Marol, Mumbai/.test(p) && /room for a title/.test(p) && /no logos/.test(p), p);

  const calls = [];
  let polls = 0;
  const fakeFetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", headers: opts.headers || {}, body: opts.body });
    if (/soul\/v2\/standard$/.test(url)) return res(200, { status: "queued", request_id: "req-1", status_url: "https://api.higgsfield.ai/requests/req-1/status" });
    if (/req-1\/status$/.test(url)) { polls++; return res(200, polls < 3 ? { status: polls === 1 ? "queued" : "in_progress" } : { status: "completed", images: [{ url: "https://cdn.example.com/pic.png" }] }); }
    if (/cdn\.example\.com/.test(url)) return res(200, {}, { "content-type": "image/png" });
    if (/dev-upload/.test(url)) return res(200, { ok: true });
    return res(404, {});
  };
  const sleeps = [];
  const g = await images.generate(p, { fetchFn: fakeFetch, sleepFn: async (ms) => sleeps.push(ms) });
  ok("submits with the key pair in the Authorization header and the prompt in the body", calls[0].method === "POST" && calls[0].headers.Authorization === "Key kid:ksec" && JSON.parse(calls[0].body).prompt === p && JSON.parse(calls[0].body).aspect_ratio === "16:9", JSON.stringify(calls[0]));
  ok("polls the status URL it was given until completed, backing off", polls === 3 && sleeps.length === 3 && sleeps[0] === 2000 && sleeps[1] === 3000, JSON.stringify(sleeps));
  ok("returns the image URL and the request id", g.url === "https://cdn.example.com/pic.png" && g.requestId === "req-1");

  const k = await images.keep(g.url, "andheri", "cover", { fetchFn: fakeFetch });
  ok("copies the picture into our storage under the case's slug", /\/media\/_cms-dev\/andheri\/case-cover-[a-z0-9]+\.png$/.test(k.url) && k.bytes === 7, k.url);
  const put = calls.find(c => /dev-upload/.test(c.url));
  ok("the copy is a PUT with the image's type", put && put.method === "PUT" && put.headers["Content-Type"] === "image/png");

  let err = null;
  try { await images.generate("x", { fetchFn: async (url) => /standard$/.test(url) ? res(200, { status: "queued", request_id: "r2", status_url: "s2" }) : res(200, { status: "nsfw" }), sleepFn: async () => {} }); } catch (e) { err = e; }
  ok("a refused picture says so and asks for a new prompt", err && err.status === 422 && /Change the prompt/.test(err.message), err && err.message);
  err = null;
  try { await images.generate("x", { fetchFn: async () => res(401, { detail: "Invalid credentials" }), sleepFn: async () => {} }); } catch (e) { err = e; }
  ok("a rejected key is reported with Higgsfield's reason", err && err.status === 502 && /Invalid credentials/.test(err.message), err && err.message);
  err = null;
  let t = 0;
  try { await images.generate("x", { fetchFn: async (url) => /standard$/.test(url) ? res(200, { status: "queued", request_id: "r3", status_url: "s3" }) : res(200, { status: "in_progress" }), sleepFn: async () => { t += 60000; }, timeoutMs: 100000 }); } catch (e) { err = e; }
  ok("a slow job stops waiting at the limit and keeps the request id", err && err.status === 504 && err.requestId === "r3", err && err.message);
  /* One key, as the console shows it: on its own, or as ID:SECRET, with or without "Key ". */
  delete process.env.HIGGSFIELD_API_KEY_ID; delete process.env.HIGGSFIELD_API_KEY_SECRET;
  const authWith = async (v) => { process.env.HIGGSFIELD_API_KEY = v; const seen = []; await images.generate("x", { fetchFn: async (url, o = {}) => { seen.push(o.headers && o.headers.Authorization); return /standard$/.test(url) ? res(200, { status: "queued", request_id: "r", status_url: "s" }) : res(200, { status: "completed", images: [{ url: "u" }] }); }, sleepFn: async () => {} }); return seen[0]; };
  ok("a single key is sent as Key <key>", (await authWith("hf_single_key_123")) === "Key hf_single_key_123");
  ok("an ID:SECRET pair in the one variable is sent as it is", (await authWith("abc:def")) === "Key abc:def");
  ok("a pasted 'Key ...' prefix is not doubled", (await authWith("Key abc:def ")) === "Key abc:def");
  delete process.env.HIGGSFIELD_API_KEY;
  err = null; try { await images.generate("x"); } catch (e) { err = e; }
  ok("no key: a plain message naming the variable", err && err.status === 503 && /HIGGSFIELD_API_KEY set/.test(err.message));
  ok("ready() says so", images.ready() === false);

  try { require("fs").unlinkSync(process.env.CMS_DEV_STORE); } catch (e) {}
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
