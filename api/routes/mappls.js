/* GET /api/routes/mappls?atlas=flipkart-andheri          road routes, as JSON
   GET /api/routes/mappls?atlas=flipkart-andheri&probe=1  which Mappls endpoint
                                                         answers, for set-up

   Measures the walk from each Flipkart building to its nearest metro stations
   and the drive to Andheri railway station with Mappls (MapmyIndia), whose
   Indian street data matches what people see in Google Maps more closely than
   OpenStreetMap does. The key is MAPPLS_API_KEY in the deployment's
   environment and never leaves the server.

   Only the fixed pairs in _pairs-<atlas>.json are measured, so this cannot be
   used to route anything else on our key. Results are cached at the edge for
   a day. The atlas page loads this once at start (meta.routeFeed) and swaps
   these routes in for the baked OpenStreetMap ones; if it fails, the baked
   routes stay. */
"use strict";
const fs = require("fs");
const path = require("path");

const ATLASES = new Set(["flipkart-andheri"]);

/* Mappls serves routing at two addresses depending on the kind of key; try
   the token form first, then the older key-in-path form. */
const ENDPOINTS = [
  { name: "route.mappls.com", url: (k, prof, c) => `https://route.mappls.com/route/direction/route_adv/${prof}/${c}?access_token=${encodeURIComponent(k)}&geometries=polyline&overview=simplified&steps=false&region=ind` },
  { name: "apis.mappls.com", url: (k, prof, c) => `https://apis.mappls.com/advancedmaps/v1/${encodeURIComponent(k)}/route_adv/${prof}/${c}?geometries=polyline&overview=simplified&steps=false` },
];

async function call(ep, key, p) {
  const coords = `${p.from[0]},${p.from[1]};${p.to[0]},${p.to[1]}`;
  const res = await fetch(ep.url(key, p.profile, coords), { headers: { accept: "application/json" } });
  const text = await res.text();
  let j = null; try { j = JSON.parse(text); } catch (e) {}
  const r = j && Array.isArray(j.routes) && j.routes[0];
  return { status: res.status, ok: !!(r && isFinite(r.distance)), route: r || null, body: text.slice(0, 300) };
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const atlas = String(q.atlas || "");
  const key = process.env.MAPPLS_API_KEY;
  res.setHeader("Content-Type", "application/json");
  if (!ATLASES.has(atlas)) { res.statusCode = 404; return res.end(JSON.stringify({ error: "unknown atlas" })); }
  if (!key) { res.statusCode = 503; return res.end(JSON.stringify({ error: "MAPPLS_API_KEY is not set in this deployment" })); }
  const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, `_pairs-${atlas}.json`), "utf8"));
  const redact = (s) => String(s).split(key).join("KEY");

  if (q.probe) {
    const out = [];
    for (const ep of ENDPOINTS) for (const prof of ["walking", "driving"]) {
      try { const r = await call(ep, key, { ...pairs[0], profile: prof }); out.push({ endpoint: ep.name, profile: prof, status: r.status, ok: r.ok, body: redact(r.body) }); }
      catch (e) { out.push({ endpoint: ep.name, profile: prof, error: redact(e.message) }); }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ probe: out }, null, 1));
  }

  const routes = await Promise.all(pairs.map(async (p) => {
    for (const ep of ENDPOINTS) {
      try {
        const r = await call(ep, key, p);
        if (r.ok) return { id: p.id, option: p.option, kind: p.kind, name: p.name, profile: p.profile, from: p.from, to: p.to, endpoint: ep.name,
          m: r.route.distance, sec: r.route.duration, geometry: r.route.geometry };
      } catch (e) { /* try the next endpoint */ }
    }
    return { id: p.id, option: p.option, kind: p.kind, name: p.name, error: "no route" };
  }));
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
  res.end(JSON.stringify({ source: "Mappls (MapmyIndia) route_adv", fetched: new Date().toISOString(), routes }));
};
