/* GET /api/godseye/feed
   The live signal feed: public headlines, tagged by keyword, newest first.
   Public news only, so it is not gated; the edge caches it for five minutes
   so a room full of screens costs one upstream fetch, not one each. */
"use strict";
const { getFeed } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") { res.statusCode = 405; return res.end(); }
  try {
    const data = await getFeed({ force: /[?&]force=1/.test(req.url || "") });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Feed failed: " + (e && e.message || e) }));
  }
};
