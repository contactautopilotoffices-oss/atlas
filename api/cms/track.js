/* POST /api/cms/track   body: { events: [ {e, link, v, s, a?, p?, r?, m?} ] }

   Visit events from the tracking script on each Atlas link (atlas-cms.js).
   Sent with navigator.sendBeacon, so the body arrives as text.

     e  view | signin | heartbeat | open | tab | signout
     v  visitor id (random, kept in localStorage)
     s  session id (random, kept in sessionStorage)
     a  the access ID used at sign-in, if any
     p  path, r referrer, m { item } or { tab }

   Privacy: no IP address is stored. Country and city come from Vercel's
   edge headers, the device class from the user agent. Bots are dropped, and
   so are events for links that are not in the CMS. Always answers 204, so a
   tracking problem can never surface on a client's screen. */
"use strict";
const store = require("./_store");

const EVENTS = new Set(["view", "signin", "heartbeat", "open", "tab", "signout"]);
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;
const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

/* Known links, cached per function instance for five minutes. */
let known = null, knownAt = 0;
async function knownLinks() {
  if (known && Date.now() - knownAt < 300000) return known;
  const rows = await store.select("atlas_links", { select: "slug" });
  known = new Set(rows.map(r => r.slug)); knownAt = Date.now();
  return known;
}
function device(ua) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}
const decodeHeader = (v) => { try { return v ? decodeURIComponent(v) : null; } catch (e) { return v || null; } };
function refHost(r, selfHost) {
  try { const h = new URL(r).hostname.replace(/^www\./, ""); return h && h !== selfHost ? h : null; } catch (e) { return null; }
}

module.exports = async (req, res) => {
  const done = () => { res.statusCode = 204; res.setHeader("Cache-Control", "no-store"); res.end(); };
  if (req.method !== "POST" || store.MODE === "off") return done();
  const ua = String(req.headers["user-agent"] || "");
  if (!ua || BOT.test(ua)) return done();
  try {
    let raw = "";
    if (typeof req.body === "string") raw = req.body;
    else if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) raw = JSON.stringify(req.body);
    else { const chunks = []; let size = 0; for await (const c of req) { size += c.length; if (size > 32768) return done(); chunks.push(c); } raw = Buffer.concat(chunks).toString("utf8"); }
    const body = JSON.parse(raw || "{}");
    const list = Array.isArray(body.events) ? body.events.slice(0, 25) : [];
    if (!list.length) return done();
    const links = await knownLinks();
    const selfHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").replace(/^www\./, "");
    const country = clip(req.headers["x-vercel-ip-country"], 4);
    const city = clip(decodeHeader(req.headers["x-vercel-ip-city"]), 60);
    const dev = device(ua);
    const ts = new Date().toISOString();
    const rows = [];
    for (const ev of list) {
      if (!ev || !EVENTS.has(ev.e) || !SLUG.test(ev.link || "") || !links.has(ev.link)) continue;
      if (!ID.test(ev.v || "") || !ID.test(ev.s || "")) continue;
      const m = ev.m && typeof ev.m === "object" ? ev.m : null;
      const meta = m ? Object.fromEntries(["item", "tab", "label"].filter(k => m[k] != null).map(k => [k, clip(m[k], 80)])) : null;
      rows.push({
        ts, link_slug: ev.link, event: ev.e, visitor_id: ev.v, session_id: ev.s,
        access_id: ev.a ? clip(String(ev.a).toUpperCase().replace(/[^A-Z0-9]/g, ""), 40) || null : null,
        path: clip(ev.p, 200), ref_host: ev.r ? refHost(ev.r, selfHost) : null,
        country, city, device: dev, meta: meta && Object.keys(meta).length ? meta : null
      });
    }
    if (rows.length) await store.insertQuiet("atlas_events", rows);
  } catch (e) {
    console.error("[cms/track]", e.message);
  }
  return done();
};
