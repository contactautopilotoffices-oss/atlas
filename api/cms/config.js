/* GET /api/cms/config?link=<slug>[&draft=1]

   What a live Atlas link reads at start-up: its status (live or paused) and
   the published content overrides. Public and cached at the edge for 30 s,
   so a room full of screens costs one database read, and a change goes live
   within about half a minute of being published.

   ?draft=1 returns the unpublished draft instead, only to someone signed in
   to /admin/ with access to that link (used by "Preview draft"). It is never
   cached.

   Never fails a page: with no database, or on any error, it answers
   { status:"live", doc:{} } and the link shows its built-in data. */
"use strict";
const store = require("./_store");
const auth = require("./_auth");

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
function send(res, status, data, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.setHeader("X-Robots-Tag", "noindex");
  res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  const slug = url.searchParams.get("link") || "";
  const wantDraft = url.searchParams.get("draft") === "1";
  const empty = { link: slug, status: "live", version: 0, doc: {} };
  if (req.method !== "GET" || !SLUG.test(slug)) return send(res, 400, { ...empty, error: "Unknown link." }, "no-store");
  if (store.MODE === "off") return send(res, 200, empty, "public, s-maxage=300");
  try {
    const [link, ov] = await Promise.all([
      store.one("atlas_links", { eq: { slug }, select: "slug,status" }),
      store.one("atlas_overrides", { eq: { link_slug: slug } })
    ]);
    if (!link) return send(res, 200, empty, "public, s-maxage=60");
    if (wantDraft) {
      const u = await auth.currentUser(req);
      if (!u || !auth.canLink(u, slug)) return send(res, 401, { ...empty, error: "Sign in to /admin/ to preview a draft." }, "private, no-store");
      return send(res, 200, { link: slug, status: link.status, version: ov ? ov.version : 0, draft: true, doc: (ov && ov.draft) || {} }, "private, no-store");
    }
    return send(res, 200, { link: slug, status: link.status, version: ov ? ov.version : 0, doc: (ov && ov.published) || {} },
      "public, s-maxage=30, stale-while-revalidate=300");
  } catch (e) {
    console.error("[cms/config]", e);
    return send(res, 200, empty, "public, s-maxage=15");
  }
};
