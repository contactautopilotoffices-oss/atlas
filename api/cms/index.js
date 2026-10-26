/* ============================================================================
   /api/cms?r=<route>   ATLAS admin and broker API (one function, many routes)

   Admin routes need a signed-in session (cookie) and, for writes, the x-cms
   header. Broker routes need the x-broker-token header from a broker link.
   Roles, lowest to highest: viewer, editor, admin, owner.

     GET  status                       is the CMS set up? (for the sign-in page)
     POST auth/setup                   create the first owner (needs CMS_SETUP_KEY)
     POST auth/login | auth/logout     GET auth/me     POST auth/password
     GET  links                        POST links/save (admin)   POST links/status (admin)
     GET  overrides&link=              POST overrides/draft (editor)
     POST overrides/publish (editor)   POST overrides/discard (editor)
     POST overrides/rollback (admin)
     GET  analytics&days=&link=        (viewer)
     GET  users (admin)                POST users/save | users/signout | users/delete (admin)
     GET  brokers (editor)             POST brokers/create | brokers/update | brokers/rotate (editor)
     GET  submissions&status= (editor) POST submissions/review (editor)
     POST upload/sign (editor)         GET audit (admin)
     GET  preflight (admin)            the system check: database, migrations,
                                       storage, keys, PDF reader, Mapbox
     GET  broker/me                    POST broker/submit         (broker token)

   Atlases built from a workbook (no code, no deploy):
     GET  bundle/template (editor)     the empty workbook, as a download
     POST bundle/import (editor)       a filled workbook -> bundle + report; saves nothing
     POST bundle/import-pdf (editor)   a PDF -> rows via a model, pins via Mapbox,
                                       the filled workbook and the bundle (_pdf.js)
     GET  bundle/sheets   (editor)     the sheets and headings, for the plan editor
     POST bundle/enhance  (editor)     a rough requirement (+ files' text) -> a brief (_brief.js)
     POST bundle/plan     (editor)     up to 6 files (Excel, PDF, Word) + the brief ->
                                       editable rows (_sources.js); a lone filled
                                       Atlas workbook is read directly
     POST bundle/research (editor)     rows -> rows + addresses and market facts found by Exa
     POST bundle/build    (editor)     rows -> pins, metro, repairs, workbook, bundle, report
     POST bundle/draft (editor)        save a bundle as a link's draft
     POST bundle/publish (admin)       draft -> live, kept as a numbered version
     GET  bundle/history&link= (viewer) every publish so far
     POST bundle/rollback (admin)      make an earlier version live again
     GET  bundle&link=[&draft=1]       the bundle itself: live needs the visitor's
                                       access cookie for that link, draft an admin
     GET  access/list&link= (editor)   POST access/issue | access/revoke (admin)
     POST access                       a VISITOR signs in with an access ID and
                                       password; sets the access cookie

   Case studies built from a workbook: see _case.js (case/template, import,
   draft, image, assist, apply, publish, history, rollback, status; GET case).
   ============================================================================ */
"use strict";
const store = require("./_store");
const auth = require("./_auth");
const { summarise } = require("./_analytics");
const { buildTemplate, readWorkbook, SHEETS: WB_SHEETS } = require("../../scripts/lib/workbook");
const { validate } = require("../../scripts/lib/validate-bundle");
const pdf = require("./_pdf");
const sources = require("./_sources");
const brief = require("./_brief");
const research = require("./_research");
const caseRoutes = require("./_case");
const preflight = require("./_preflight");

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const clip = (v, n) => (v == null ? "" : String(v)).slice(0, n);
const MAX_DOC = 600 * 1024;

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

async function readBody(req, limit = 1024 * 1024) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) fail(413, "Request too large."); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { fail(400, "Body is not valid JSON."); }
}
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
const audit = (user, action, target, detail) =>
  store.insert("cms_audit", { by_email: user ? user.email : null, action, target, detail: detail || null, at: store.now() }).catch(() => {});
function originOf(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "atlas.autopilotoffices.com";
  const proto = req.headers["x-forwarded-proto"] || (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/* ------------------------------------------------------------ guards ---- */
async function needUser(req, role = "viewer") {
  const u = await auth.currentUser(req);
  if (!u) fail(401, "Please sign in.");
  if (!auth.atLeast(u, role)) fail(403, `This needs the ${role} role or higher.`);
  return u;
}
function needWrite(req) {
  if (req.headers["x-cms"] !== "1") fail(403, "Missing x-cms header.");
}
function needLink(user, slug) {
  if (!SLUG.test(slug || "")) fail(400, "Unknown link.");
  if (!auth.canLink(user, slug)) fail(403, "You do not have access to this link.");
}
async function needBroker(req) {
  const t = req.headers["x-broker-token"];
  if (!t || String(t).length > 100) fail(401, "This broker link is not valid.");
  const b = await store.one("broker_links", { eq: { token_hash: auth.hashToken(t) } });
  if (!b) fail(401, "This broker link is not valid. Ask Autopilot for a new one.");
  if (!b.active) fail(401, "This broker link has been switched off. Ask Autopilot for a new one.");
  if (b.expires_at && Date.parse(b.expires_at) < Date.now()) fail(401, "This broker link has expired. Ask Autopilot for a new one.");
  return b;
}

/* ------------------------------------------------------------ helpers --- */
async function linkNames() {
  const links = await store.select("atlas_links", { select: "slug,name" });
  return Object.fromEntries(links.map(l => [l.slug, l.name]));
}
async function overridesRow(slug) {
  let row = await store.one("atlas_overrides", { eq: { link_slug: slug } });
  if (!row) [row] = await store.upsert("atlas_overrides", { link_slug: slug, draft: {}, published: {}, version: 0 }, "link_slug");
  return row;
}
function cleanDoc(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) fail(400, "The draft must be an object.");
  const s = JSON.stringify(doc);
  if (s.length > MAX_DOC) fail(413, "The draft is too large (over 600 KB).");
  return JSON.parse(s);
}
/* Broker field values: plain strings, numbers or booleans, bounded. */
function cleanFields(f, maxKeys = 40) {
  if (!f || typeof f !== "object" || Array.isArray(f)) return {};
  const out = {};
  for (const [k, v] of Object.entries(f).slice(0, maxKeys)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (v != null && String(v).trim() !== "") out[k] = clip(v, 2000);
  }
  return out;
}
const ADDS = new Set(["chennai"]);
const slugify = (s) => clip(String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), 40) || "new-property";

/* ------------------------------------------------------------ routes ---- */
const R = {};

R["GET status"] = async () => {
  if (store.MODE === "off") return { mode: "off", needsSetup: false, configured: false };
  const any = await store.select("cms_users", { select: "id", limit: 1 });
  return { mode: store.MODE, configured: true, needsSetup: any.length === 0, setupKey: !!process.env.CMS_SETUP_KEY || store.MODE === "dev" };
};

R["POST auth/setup"] = async (req, res, b) => {
  const any = await store.select("cms_users", { select: "id", limit: 1 });
  if (any.length) fail(409, "The CMS already has users. Sign in instead.");
  const key = process.env.CMS_SETUP_KEY || (store.MODE === "dev" ? "dev-setup" : "");
  if (!key) fail(503, "Set CMS_SETUP_KEY in Vercel to create the first admin.");
  if (clip(b.setupKey, 200) !== key) fail(403, "The setup key is not right.");
  const email = clip(b.email, 200).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, "Enter a valid email.");
  const prob = auth.passwordProblem(b.password); if (prob) fail(400, prob);
  const [u] = await store.insert("cms_users", { email, name: clip(b.name, 80), role: "owner", password_hash: auth.hashPassword(b.password), links: null });
  auth.setSession(res, u);
  await audit(u, "setup", email);
  return { user: auth.publicUser(u) };
};

R["POST auth/login"] = async (req, res, b) => {
  const email = clip(b.email, 200).trim().toLowerCase();
  const u = await store.one("cms_users", { eq: { email } });
  const generic = "Email or password not recognised.";
  if (!u || !u.active) { auth.checkPassword(b.password, "scrypt$16384$AAAA$AAAA"); fail(401, generic); }
  if (u.locked_until && Date.parse(u.locked_until) > Date.now()) fail(429, "Too many attempts. Try again in 15 minutes.");
  if (!auth.checkPassword(b.password, u.password_hash)) {
    const n = (u.failed_logins || 0) + 1;
    await store.update("cms_users", { eq: { id: u.id } }, { failed_logins: n >= 5 ? 0 : n, locked_until: n >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null });
    fail(401, generic);
  }
  await store.update("cms_users", { eq: { id: u.id } }, { failed_logins: 0, locked_until: null, last_login_at: store.now() });
  auth.setSession(res, u);
  await audit(u, "login", email);
  return { user: auth.publicUser(u) };
};
R["POST auth/logout"] = async (req, res) => { auth.clearSession(res); return { ok: true }; };
R["GET auth/me"] = async (req) => {
  const u = await auth.currentUser(req);
  return { user: auth.publicUser(u) };
};
R["POST auth/password"] = async (req, res, b) => {
  const u = await needUser(req);
  if (!auth.checkPassword(b.current, u.password_hash)) fail(401, "Your current password is not right.");
  const prob = auth.passwordProblem(b.next); if (prob) fail(400, prob);
  const [nu] = await store.update("cms_users", { eq: { id: u.id } }, { password_hash: auth.hashPassword(b.next), token_version: u.token_version + 1, updated_at: store.now() });
  auth.setSession(res, nu);
  await audit(u, "password", u.email);
  return { ok: true };
};

/* links */
R["GET links"] = async (req) => {
  const u = await needUser(req);
  const [links, ovs] = await Promise.all([store.select("atlas_links", { order: "created_at.asc" }), store.select("atlas_overrides", { select: "link_slug,version,published_at,published_by,draft_updated_at,draft_updated_by,draft,published" })]);
  const ov = Object.fromEntries(ovs.map(o => [o.link_slug, o]));
  return {
    links: links.filter(l => auth.canLink(u, l.slug)).map(l => {
      const o = ov[l.slug] || {};
      return { ...l, version: o.version || 0, published_at: o.published_at || null, published_by: o.published_by || null,
        draft_updated_at: o.draft_updated_at || null, unpublished: JSON.stringify(o.draft || {}) !== JSON.stringify(o.published || {}) };
    })
  };
};
R["POST links/save"] = async (req, res, b) => {
  const u = await needUser(req, "admin");
  const slug = clip(b.slug, 40);
  if (!SLUG.test(slug)) fail(400, "Use lower-case letters, numbers and hyphens for the link id.");
  if (!["client", "study", "tool"].includes(b.kind)) fail(400, "Pick a kind.");
  const row = { slug, name: clip(b.name, 120) || slug, kind: b.kind, path: clip(b.path, 120) || "/", access_id: clip(b.access_id, 40) || null,
    city: clip(b.city, 60) || null, notes: clip(b.notes, 1000) || null, updated_at: store.now() };
  const [l] = await store.upsert("atlas_links", row, "slug");
  await overridesRow(slug);
  await audit(u, "link.save", slug, row);
  return { link: l };
};
R["POST links/status"] = async (req, res, b) => {
  const u = await needUser(req, "admin"); needLink(u, b.slug);
  if (!["live", "paused"].includes(b.status)) fail(400, "Status is live or paused.");
  const [l] = await store.update("atlas_links", { eq: { slug: b.slug } }, { status: b.status, updated_at: store.now() });
  await audit(u, "link.status", b.slug, { status: b.status });
  return { link: l };
};

/* content overrides */
R["GET overrides"] = async (req, res, b, q) => {
  const u = await needUser(req); needLink(u, q.get("link"));
  const row = await overridesRow(q.get("link"));
  const history = await store.select("atlas_override_history", { eq: { link_slug: q.get("link") }, order: "at.desc", limit: 30, select: "id,version,action,by_email,note,at" });
  return { ...row, history };
};
R["POST overrides/draft"] = async (req, res, b) => {
  const u = await needUser(req, "editor"); needLink(u, b.link);
  const draft = cleanDoc(b.draft);
  await overridesRow(b.link);
  const [row] = await store.update("atlas_overrides", { eq: { link_slug: b.link } }, { draft, draft_updated_at: store.now(), draft_updated_by: u.email });
  return { ok: true, draft_updated_at: row.draft_updated_at };
};
R["POST overrides/publish"] = async (req, res, b) => {
  const u = await needUser(req, "editor"); needLink(u, b.link);
  const row = await overridesRow(b.link);
  const version = (row.version || 0) + 1;
  await store.update("atlas_overrides", { eq: { link_slug: b.link } }, { published: row.draft, published_at: store.now(), published_by: u.email, version });
  await store.insert("atlas_override_history", { link_slug: b.link, version, doc: row.draft, action: "publish", by_email: u.email, note: clip(b.note, 300) || null, at: store.now() });
  await audit(u, "publish", b.link, { version, note: clip(b.note, 300) });
  return { ok: true, version };
};
R["POST overrides/discard"] = async (req, res, b) => {
  const u = await needUser(req, "editor"); needLink(u, b.link);
  const row = await overridesRow(b.link);
  await store.update("atlas_overrides", { eq: { link_slug: b.link } }, { draft: row.published, draft_updated_at: store.now(), draft_updated_by: u.email });
  await audit(u, "draft.discard", b.link);
  return { ok: true };
};
R["POST overrides/rollback"] = async (req, res, b) => {
  const u = await needUser(req, "admin"); needLink(u, b.link);
  const h = await store.one("atlas_override_history", { eq: { id: clip(b.historyId, 60), link_slug: b.link } });
  if (!h) fail(404, "That version was not found.");
  const row = await overridesRow(b.link);
  const version = (row.version || 0) + 1;
  await store.update("atlas_overrides", { eq: { link_slug: b.link } }, { published: h.doc, draft: h.doc, published_at: store.now(), published_by: u.email, version, draft_updated_at: store.now(), draft_updated_by: u.email });
  await store.insert("atlas_override_history", { link_slug: b.link, version, doc: h.doc, action: "rollback", by_email: u.email, note: `Back to version ${h.version}`, at: store.now() });
  await audit(u, "rollback", b.link, { to: h.version, version });
  return { ok: true, version };
};

/* analytics */
R["GET analytics"] = async (req, res, b, q) => {
  const u = await needUser(req);
  const days = Math.max(1, Math.min(90, parseInt(q.get("days") || "30", 10) || 30));
  const to = new Date().toISOString(), from = new Date(Date.now() - days * 86400000).toISOString();
  const link = q.get("link");
  const filt = { gte: { ts: from }, order: "ts.asc", select: "ts,link_slug,event,visitor_id,session_id,access_id,country,city,device,ref_host,meta" };
  if (link) { needLink(u, link); filt.eq = { link_slug: link }; }
  else if (u.links && u.links.length) filt.in = { link_slug: u.links };
  const [{ rows, capped }, names] = await Promise.all([store.selectAll("atlas_events", filt), linkNames()]);
  return { ...summarise(rows, { from, to, days, linkNames: names }), capped };
};

/* team */
R["GET users"] = async (req) => {
  await needUser(req, "admin");
  const users = await store.select("cms_users", { order: "created_at.asc" });
  return { users: users.map(auth.publicUser) };
};
R["POST users/save"] = async (req, res, b) => {
  const me = await needUser(req, "admin");
  if (!auth.ROLES.includes(b.role)) fail(400, "Pick a role.");
  if (b.role === "owner" && me.role !== "owner") fail(403, "Only an owner can make another owner.");
  const links = Array.isArray(b.links) && b.links.length ? b.links.filter(s => SLUG.test(s)).slice(0, 50) : null;
  const patch = { name: clip(b.name, 80), role: b.role, links, active: b.active !== false, updated_at: store.now() };
  if (b.id) {
    const cur = await store.one("cms_users", { eq: { id: clip(b.id, 60) } });
    if (!cur) fail(404, "User not found.");
    if (cur.role === "owner" && me.role !== "owner") fail(403, "Only an owner can change an owner.");
    if (cur.id === me.id && (b.role !== me.role || b.active === false)) fail(400, "You cannot change your own role or switch yourself off.");
    if (b.password) { const prob = auth.passwordProblem(b.password); if (prob) fail(400, prob); patch.password_hash = auth.hashPassword(b.password); patch.token_version = cur.token_version + 1; }
    if (b.active === false) patch.token_version = cur.token_version + 1;
    const [u] = await store.update("cms_users", { eq: { id: cur.id } }, patch);
    await audit(me, "user.update", u.email, { role: u.role, active: u.active, links: u.links, password: !!b.password });
    return { user: auth.publicUser(u) };
  }
  const email = clip(b.email, 200).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, "Enter a valid email.");
  const prob = auth.passwordProblem(b.password); if (prob) fail(400, prob);
  if (await store.one("cms_users", { eq: { email } })) fail(409, "Someone already has that email.");
  const [u] = await store.insert("cms_users", { ...patch, email, password_hash: auth.hashPassword(b.password) });
  await audit(me, "user.create", email, { role: u.role, links: u.links });
  return { user: auth.publicUser(u) };
};
R["POST users/signout"] = async (req, res, b) => {
  const me = await needUser(req, "admin");
  const cur = await store.one("cms_users", { eq: { id: clip(b.id, 60) } });
  if (!cur) fail(404, "User not found.");
  await store.update("cms_users", { eq: { id: cur.id } }, { token_version: cur.token_version + 1 });
  await audit(me, "user.signout", cur.email);
  return { ok: true };
};
R["POST users/delete"] = async (req, res, b) => {
  const me = await needUser(req, "admin");
  const cur = await store.one("cms_users", { eq: { id: clip(b.id, 60) } });
  if (!cur) fail(404, "User not found.");
  if (cur.id === me.id) fail(400, "You cannot remove yourself.");
  if (cur.role === "owner" && me.role !== "owner") fail(403, "Only an owner can remove an owner.");
  await store.remove("cms_users", { eq: { id: cur.id } });
  await audit(me, "user.delete", cur.email);
  return { ok: true };
};

/* brokers */
const publicBroker = (b) => { const { token_hash, ...rest } = b; return rest; };
R["GET brokers"] = async (req) => {
  const u = await needUser(req, "editor");
  const list = await store.select("broker_links", { order: "created_at.desc" });
  return { brokers: list.filter(b => b.links.some(s => auth.canLink(u, s))).map(publicBroker) };
};
function brokerFields(b, u) {
  const links = (Array.isArray(b.links) ? b.links : []).filter(s => SLUG.test(s) && auth.canLink(u, s)).slice(0, 20);
  if (!links.length) fail(400, "Pick at least one link the broker may update.");
  const props = Array.isArray(b.properties) && b.properties.length ? b.properties.map(p => clip(p, 80)).slice(0, 200) : null;
  const days = parseInt(b.expires_days, 10);
  return { name: clip(b.name, 80) || "Broker", firm: clip(b.firm, 80) || null, email: clip(b.email, 120) || null, phone: clip(b.phone, 40) || null,
    links, properties: props, can_propose: b.can_propose !== false,
    expires_at: Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : (b.expires_at === undefined ? null : b.expires_at) };
}
R["POST brokers/create"] = async (req, res, b) => {
  const u = await needUser(req, "editor");
  const token = auth.newToken();
  const [row] = await store.insert("broker_links", { ...brokerFields(b, u), token_hash: auth.hashToken(token), created_by: u.email });
  await audit(u, "broker.create", row.name, { links: row.links });
  return { broker: publicBroker(row), url: `${originOf(req)}/broker/#t=${token}` };
};
R["POST brokers/update"] = async (req, res, b) => {
  const u = await needUser(req, "editor");
  const cur = await store.one("broker_links", { eq: { id: clip(b.id, 60) } });
  if (!cur) fail(404, "Broker link not found.");
  if (!cur.links.some(s => auth.canLink(u, s))) fail(403, "You do not have access to this broker.");
  const patch = b.only === "active" ? { active: !!b.active } : { ...brokerFields(b, u), active: b.active !== false };
  const [row] = await store.update("broker_links", { eq: { id: cur.id } }, patch);
  await audit(u, "broker.update", row.name, patch);
  return { broker: publicBroker(row) };
};
R["POST brokers/rotate"] = async (req, res, b) => {
  const u = await needUser(req, "editor");
  const cur = await store.one("broker_links", { eq: { id: clip(b.id, 60) } });
  if (!cur) fail(404, "Broker link not found.");
  const token = auth.newToken();
  const [row] = await store.update("broker_links", { eq: { id: cur.id } }, { token_hash: auth.hashToken(token), active: true });
  await audit(u, "broker.rotate", row.name);
  return { broker: publicBroker(row), url: `${originOf(req)}/broker/#t=${token}` };
};

/* broker submissions inbox */
R["GET submissions"] = async (req, res, b, q) => {
  const u = await needUser(req, "editor");
  const st = q.get("status");
  const list = await store.select("broker_submissions", { ...(st && st !== "all" ? { eq: { status: st } } : {}), order: "created_at.desc", limit: 200 });
  return { submissions: list.filter(s => auth.canLink(u, s.link_slug)) };
};
R["POST submissions/review"] = async (req, res, b) => {
  const u = await needUser(req, "editor");
  const s = await store.one("broker_submissions", { eq: { id: clip(b.id, 60) } });
  if (!s) fail(404, "Submission not found.");
  needLink(u, s.link_slug);
  if (s.status !== "pending") fail(409, "This submission has already been reviewed.");
  if (!["approve", "reject"].includes(b.action)) fail(400, "Approve or reject.");
  if (b.action === "approve") {
    const row = await overridesRow(s.link_slug);
    const draft = JSON.parse(JSON.stringify(row.draft || {}));
    const prov = { by: s.broker_name || "Broker", at: s.created_at, note: s.source_note || null, submission: s.id, approvedBy: u.email };
    if (s.kind === "update") {
      const fields = cleanFields(b.fields || (s.payload && s.payload.fields));
      draft.properties = draft.properties || {};
      const p = draft.properties[s.property_id] = draft.properties[s.property_id] || {};
      p.fields = { ...(p.fields || {}), ...fields };
      p.provenance = { ...(p.provenance || {}) };
      for (const k of Object.keys(fields)) p.provenance[k] = prov;
    } else {
      const prop = cleanFields(b.fields || (s.payload && s.payload.property), 60);
      if (!prop.name) fail(400, "A new property needs a name.");
      const lat = +prop.lat, lng = +prop.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) fail(400, "Add the position (latitude and longitude) before approving a new property.");
      /* Only links whose app can draw a property from a name and a position
         take new properties (Chennai today); elsewhere it is kept as a lead
         in the admin panel and does not change the live link. */
      const list = ADDS.has(s.link_slug) ? "additions" : "leads";
      const id = prop.id ? slugify(prop.id) : slugify(prop.name);
      draft[list] = (draft[list] || []).filter(a => a.id !== id);
      draft[list].push({ ...prop, id, lat, lng, _provenance: prov });
    }
    await store.update("atlas_overrides", { eq: { link_slug: s.link_slug } }, { draft: cleanDoc(draft), draft_updated_at: store.now(), draft_updated_by: u.email });
  }
  const [row] = await store.update("broker_submissions", { eq: { id: s.id } }, { status: b.action === "approve" ? "approved" : "rejected", review_note: clip(b.note, 500) || null, reviewed_by: u.email, reviewed_at: store.now() });
  await audit(u, `submission.${b.action}`, s.link_slug, { id: s.id, property: s.property_id, kind: s.kind });
  return { submission: row };
};

/* uploads (3D models, images, documents) */
const UPLOAD_EXT = /\.(glb|gltf|jpe?g|png|webp|mp4|pdf)$/i;
R["POST upload/sign"] = async (req, res, b) => {
  const u = await needUser(req, "editor"); needLink(u, b.link);
  const name = clip(b.filename, 120).replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!UPLOAD_EXT.test(name)) fail(400, "Upload a .glb, .gltf, image, .mp4 or .pdf file.");
  if (+b.size > 100 * 1024 * 1024) fail(413, "Files are limited to 100 MB.");
  const path = `${b.link}/${Date.now().toString(36)}-${name}`;
  const signed = await store.signUpload(path);
  await audit(u, "upload", b.link, { path, size: +b.size || null });
  return signed;
};
/* Local development only: stands in for Supabase Storage. */
R["PUT dev-upload"] = async (req, res, b, q) => {
  if (store.MODE !== "dev") fail(404, "Not found.");
  await needUser(req, "editor");
  const fs = require("fs"), p = require("path");
  const rel = String(q.get("path") || "").replace(/\.\./g, "");
  const file = p.join(__dirname, "..", "..", "media", "_cms-dev", rel);
  fs.mkdirSync(p.dirname(file), { recursive: true });
  const chunks = []; for await (const c of req) chunks.push(c);
  fs.writeFileSync(file, Buffer.concat(chunks));
  return { ok: true };
};

R["GET audit"] = async (req) => {
  await needUser(req, "admin");
  return { audit: await store.select("cms_audit", { order: "at.desc", limit: 200 }) };
};

/* ---------------------------------------------------- broker portal ---- */
R["GET broker/me"] = async (req) => {
  const bk = await needBroker(req);
  /* Brokers see a city label, never the client's name. */
  const rows = await store.select("atlas_links", { in: { slug: bk.links }, select: "slug,kind,city,status", order: "created_at.asc" });
  const seen = {};
  const links = rows.map(l => {
    const base = `${l.city && l.city !== "Multi-city" ? l.city : "Office"} properties`;
    seen[base] = (seen[base] || 0) + 1;
    return { slug: l.slug, kind: l.kind, status: l.status, label: seen[base] > 1 ? `${base} (${seen[base]})` : base };
  });
  const subs = await store.select("broker_submissions", { eq: { broker_id: bk.id }, order: "created_at.desc", limit: 50, select: "id,link_slug,property_id,kind,payload,status,created_at,reviewed_at" });
  await store.update("broker_links", { eq: { id: bk.id } }, { last_used_at: store.now() });
  return { broker: { name: bk.name, firm: bk.firm, properties: bk.properties, can_propose: bk.can_propose, expires_at: bk.expires_at }, links, submissions: subs };
};
R["POST broker/submit"] = async (req, res, b) => {
  const bk = await needBroker(req);
  if (!bk.links.includes(b.link)) fail(403, "This link is not open to you.");
  const kind = b.kind === "new_property" ? "new_property" : "update";
  if (kind === "new_property" && !bk.can_propose) fail(403, "Your link does not allow proposing new properties.");
  const pid = kind === "update" ? clip(b.property_id, 80) : null;
  if (kind === "update" && !pid) fail(400, "Pick a property.");
  if (kind === "update" && bk.properties && bk.properties.length && !bk.properties.includes(pid)) fail(403, "This property is not open to you.");
  const payload = kind === "update" ? { fields: cleanFields(b.fields) } : { property: cleanFields(b.property, 60) };
  if (kind === "update" && !Object.keys(payload.fields).length) fail(400, "Change at least one value.");
  if (kind === "new_property" && !payload.property.name) fail(400, "Give the property a name.");
  const today = new Date(Date.now() - 86400000).toISOString();
  const recent = await store.select("broker_submissions", { eq: { broker_id: bk.id }, gte: { created_at: today }, select: "id", limit: 101 });
  if (recent.length >= 100) fail(429, "That is a lot for one day. Please send the rest tomorrow.");
  const [row] = await store.insert("broker_submissions", { broker_id: bk.id, broker_name: [bk.name, bk.firm].filter(Boolean).join(", "), link_slug: b.link, property_id: pid, kind, payload,
    note: clip(b.note, 2000) || null, source_note: clip(b.source_note, 500) || null, created_at: store.now() });
  await store.update("broker_links", { eq: { id: bk.id } }, { submissions: (bk.submissions || 0) + 1, last_used_at: store.now() });
  return { submission: { id: row.id, status: row.status } };
};

/* ================================================== workbook atlases ==
   An Atlas made in /admin/ from a workbook. The bundle lives in
   atlas_bundles with a draft and a live version; its link row in atlas_links
   has kind "bundle" and path "/<slug>": that is where the atlas is served
   (a rewrite in vercel.json hands /<slug> to the engine page). A visitor
   reaches it by signing in at the site root with an access ID, or at the
   atlas's own address. Each publish is kept in atlas_bundle_history with a
   number the team sees in /admin/; the visitor only ever sees what is live. */
const MAX_BUNDLE = 4 * 1024 * 1024;
const ACCESS_ID = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
const normAccess = (v) => clip(v, 60).trim().toUpperCase().replace(/[\s_]+/g, "-");
/* A workbook atlas is served at /<link id>, after the site's own files, so
   an id that names a folder or page that already exists could never be
   reached: /chennai would open the Chennai study, never the atlas. */
const RESERVED = new Set(["2d-to-3d", "admin", "andheri", "api", "assets", "atlas", "broker", "chennai", "clients", "config", "data",
  "digitide", "docs", "engine", "evidence", "examples", "glb-3d", "godseye", "guide", "index", "indore", "media", "noida",
  "node-modules", "recon", "references", "scripts", "supabase", "whitefield", "login", "logout", "static", "public", "favicon"]);
const atlasUrl = (slug) => `/${slug}`;

async function bundleRow(slug) {
  let row = await store.one("atlas_bundles", { eq: { link_slug: slug } });
  if (!row) [row] = await store.upsert("atlas_bundles", { link_slug: slug, draft: null, published: null, version: 0 }, "link_slug");
  return row;
}
function cleanBundle(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) fail(400, "The bundle must be an object.");
  const s = JSON.stringify(b);
  if (s.length > MAX_BUNDLE) fail(413, "The atlas is too large (over 4 MB).");
  return JSON.parse(s);
}
/* The validator's report, shaped for the page: the plain-words lines the
   person who filled in the workbook will read. */
const reportOf = (rep) => ({ ok: rep.ok, errors: rep.errors, warnings: rep.warnings, stats: rep.stats });

R["GET bundle/template"] = async (req, res) => {
  await needUser(req, "editor");
  const wb = buildTemplate();
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="atlas-workbook.xlsx"');
  res.setHeader("Cache-Control", "no-store");
  res.end(buf);
  return { __sent: true };
};

R["POST bundle/import"] = async (req, res, b) => {
  await needUser(req, "editor");
  if (!b.file || typeof b.file !== "string") fail(400, "Send the workbook as a base64 string in `file`.");
  let buf;
  try { buf = Buffer.from(b.file.replace(/^data:[^,]*,/, ""), "base64"); } catch (e) { fail(400, "The file could not be read."); }
  if (!buf.length) fail(400, "The file is empty.");
  if (buf.length > MAX_BUNDLE) fail(413, "The workbook is too large (over 4 MB).");
  let out;
  try { out = await readWorkbook(buf); }
  catch (e) { fail(400, `That does not look like an Atlas workbook: ${clip(e.message, 200)}. Download the template from this page and fill that in.`); }
  const rep = validate(out.bundle);
  return { bundle: out.bundle, notes: out.notes, report: reportOf(rep) };
};

/* A PDF instead of a workbook. The model fills the sheets, Mapbox places the
   pins, and the person gets the workbook back to check. Nothing is saved. */
R["POST bundle/import-pdf"] = async (req, res, b) => {
  await needUser(req, "editor");
  if (!b.file || typeof b.file !== "string") fail(400, "Send the PDF as a base64 string in `file`.");
  let buf;
  try { buf = Buffer.from(b.file.replace(/^data:[^,]*,/, ""), "base64"); } catch (e) { fail(400, "The file could not be read."); }
  if (!buf.length) fail(400, "The file is empty.");
  if (buf.length > MAX_BUNDLE) fail(413, "The PDF is too large (over 4 MB). Split it, or save it at a lower quality.");
  if (buf.slice(0, 5).toString() !== "%PDF-") fail(400, "That is not a PDF.");
  if (!pdf.providerName()) fail(503, "Reading a PDF needs ENGY_API_KEY or ANTHROPIC_API_KEY set in Vercel. Until then, fill in the workbook instead.");
  try {
    const out = await pdf.importPdf(buf, { fileName: clip(b.name, 120) || "document.pdf" });
    return { bundle: out.bundle, notes: out.notes, report: out.report, workbook: out.workbook, read: out.read, model: out.model, provider: out.provider, placed: out.placed.length, unplaced: out.unplaced };
  } catch (e) {
    if (e.status) fail(e.status, e.message);
    fail(502, `The PDF could not be read into an atlas: ${clip(e.message, 300)}`);
  }
};

/* Create an atlas, the Describe it card: files and a requirement in, an
   editable plan (rows keyed by the workbook's headings) out, then built.
   Nothing here saves; Save as draft does. */
const filesFrom = (list) => {
  if (!Array.isArray(list)) return [];
  if (list.length > sources.MAX_FILES) fail(400, `Up to ${sources.MAX_FILES} files at a time; you chose ${list.length}.`);
  const files = list.map((f, i) => {
    const name = clip(f && f.name, 120) || `file-${i + 1}`;
    let buf;
    try { buf = Buffer.from(String((f && f.file) || "").replace(/^data:[^,]*,/, ""), "base64"); } catch (e) { fail(400, `"${name}" could not be read.`); }
    if (!buf.length) fail(400, `"${name}" is empty.`);
    return { name, buf };
  });
  const total = files.reduce((a, f) => a + f.buf.length, 0);
  if (total > MAX_BUNDLE) fail(413, `The files come to ${(total / 1048576).toFixed(1)} MB; the limit is about 3 MB together. Use fewer at a time.`);
  return files;
};
const needModel = (what) => { if (!pdf.providerName()) fail(503, `${what} needs ENGY_API_KEY or ANTHROPIC_API_KEY set in Vercel. A filled Atlas workbook on its own works without it.`); };
const briefFrom = (v) => (v && typeof v === "object" && !Array.isArray(v)) ? brief.tidy(v) : null;
const modelFail = (e, what) => { if (e.status) fail(e.status, e.message); fail(502, `${what}: ${clip(e.message, 300)}`); };

/* The sheets and their headings, for the editor's tabs and columns. */
R["GET bundle/sheets"] = async (req) => {
  await needUser(req, "editor");
  return { sheets: WB_SHEETS.map(s => ({ name: s.name, shape: s.shape, blurb: s.blurb || "", extras: s.name === "Options" || s.name === "Places",
    columns: (s.columns || s.fields || []).map(c => ({ label: c.label, required: !!c.required, number: c.type === "number", hint: c.hint || "", list: Array.isArray(c.list) ? c.list.map(String) : null })) })) };
};

/* Enhance: the rough requirement, with the files' text, into a brief. */
R["POST bundle/enhance"] = async (req, res, b) => {
  await needUser(req, "editor");
  needModel("Enhance");
  let text = clip(b.text, 200000) || "";
  if (Array.isArray(b.files) && b.files.length) {
    try { text = sources.sourceText((await sources.readAll(filesFrom(b.files))).sources); }
    catch (e) { if (e.status) fail(e.status, e.message); throw e; }
  }
  /* What the web says about the place in the requirement, when Exa is set up. */
  const web = await research.webContext(clip(b.requirement, 4000)).catch(() => "");
  if (web) text = `${text}\n\n===== WEB RESULTS (Exa search, with links) =====\n${web}`;
  try { return { ...(await brief.enhance({ requirement: clip(b.requirement, 4000), text, brief: briefFrom(b.brief) })), web: !!web }; }
  catch (e) { modelFail(e, "Enhance did not work"); }
};

/* Plan: the files into editable rows. Nothing is geocoded or built yet. */
R["POST bundle/plan"] = async (req, res, b) => {
  await needUser(req, "editor");
  const files = filesFrom(b.files);
  if (!files.length) fail(400, "Add at least one file to plan from.");
  const requirement = clip(b.requirement, 4000) || "", br = briefFrom(b.brief);
  const lone = files.length === 1 && /\.xlsx$/i.test(files[0].name) && !requirement && !(br && Object.keys(br).length);
  if (!lone) needModel("Reading PDFs, Word documents and other spreadsheets");
  try {
    const p = await sources.plan(files, { requirement, brief: br });
    return { direct: !!p.direct, rows: p.rows, notes: p.notes, files: p.files, label: p.label, text: p.text, model: p.model || null, provider: p.provider || null };
  } catch (e) { modelFail(e, "The files could not be read into a plan"); }
};

/* Research: the web (Exa) fills what the files left out: addresses for
   properties with none, and market facts with their sources. */
R["POST bundle/research"] = async (req, res, b) => {
  await needUser(req, "editor");
  if (!b.rows || typeof b.rows !== "object" || Array.isArray(b.rows)) fail(400, "Send the plan as an object in `rows`, one key per sheet.");
  if (research.enabled()) needModel("Web research");
  try { return await research.research({ rows: pdf.shapeRows(JSON.parse(JSON.stringify(b.rows))), requirement: clip(b.requirement, 4000) || "", brief: briefFrom(b.brief) }); }
  catch (e) { modelFail(e, "Web research did not work"); }
};

/* Build: rows (planned, edited, or typed from scratch) into the atlas. */
R["POST bundle/build"] = async (req, res, b) => {
  await needUser(req, "editor");
  if (!b.rows || typeof b.rows !== "object" || Array.isArray(b.rows)) fail(400, "Send the plan as an object in `rows`, one key per sheet.");
  if (JSON.stringify(b.rows).length > MAX_BUNDLE) fail(413, "The plan is too large (over 4 MB).");
  const rows = pdf.shapeRows(JSON.parse(JSON.stringify(b.rows)));
  /* Nothing to compare but places to show: the places are the options. */
  const moved = pdf.promotePlaces(rows);
  if (!(rows["Options"] || []).length) fail(400, "The plan has nothing to compare yet: the atlas needs at least one row on the Options tab (a building or centre). Add one there, or plan from files that name some.");
  const out = await pdf.build(rows, { fileName: clip(b.label, 200) || "Atlas", notes: moved ? [`There was nothing on Options, so the ${moved} place${moved === 1 ? "" : "s"} became the options the atlas compares.`] : [] });
  return { bundle: out.bundle, notes: out.notes, report: out.report, workbook: out.workbook, rows: out.rows, placed: out.placed.length, unplaced: out.unplaced };
};

R["POST bundle/draft"] = async (req, res, b) => {
  const u = await needUser(req, "editor");
  const slug = clip(b.slug, 40).trim().toLowerCase();
  if (!SLUG.test(slug)) fail(400, "Use lower-case letters, numbers and hyphens for the link id.");
  if (RESERVED.has(slug)) fail(400, `"${slug}" is already a page on this site, so the atlas could never be opened at /${slug}. Pick another link id.`);
  const existing = await store.one("atlas_links", { eq: { slug } });
  if (existing && existing.kind !== "bundle" && existing.kind !== "case") fail(400, `"${slug}" is already a ${existing.kind} link. Pick another id.`);
  if (existing) needLink(u, slug);
  const bundle = cleanBundle(b.bundle);
  const rep = validate(bundle);
  if (!rep.ok) fail(400, `The atlas has ${rep.errors.length} problem${rep.errors.length === 1 ? "" : "s"} that stop it being drawn. Fix them in the workbook and upload it again.`);
  const name = clip(b.name, 120).trim() || (bundle.meta && bundle.meta.title) || slug;
  const city = clip(b.city, 60).trim() || (bundle.meta && bundle.meta.city) || null;
  const row = { slug, name, kind: "bundle", path: atlasUrl(slug), city, notes: clip(b.notes, 1000) || (existing ? existing.notes : null), updated_at: store.now() };
  if (!existing) row.access_id = null;
  await store.upsert("atlas_links", row, "slug");
  await overridesRow(slug);
  await bundleRow(slug);
  const [saved] = await store.update("atlas_bundles", { eq: { link_slug: slug } }, { draft: bundle, draft_updated_at: store.now(), draft_updated_by: u.email });
  await audit(u, "bundle.draft", slug, { options: (bundle.options || []).length, warnings: rep.warnings.length });
  return { slug, name, version: saved ? saved.version : 0, report: reportOf(rep), created: !existing };
};

R["POST bundle/publish"] = async (req, res, b) => {
  const u = await needUser(req, "admin");
  const slug = clip(b.slug, 40);
  needLink(u, slug);
  const link = await store.one("atlas_links", { eq: { slug } });
  if (!link || link.kind !== "bundle") fail(404, "That is not an atlas built from a workbook.");
  const row = await bundleRow(slug);
  if (!row.draft) fail(400, "There is no draft to publish. Upload a workbook first.");
  const rep = validate(row.draft);
  if (!rep.ok) fail(400, "The draft no longer passes its checks. Upload the workbook again.");
  const version = (row.version || 0) + 1;
  await store.update("atlas_bundles", { eq: { link_slug: slug } }, { published: row.draft, published_at: store.now(), published_by: u.email, version });
  await store.insert("atlas_bundle_history", { link_slug: slug, version, bundle: row.draft, action: "publish", by_email: u.email, note: clip(b.note, 300) || null, at: store.now() });
  await audit(u, "bundle.publish", slug, { version, note: clip(b.note, 300) });
  return { slug, version };
};

/* Every publish of a workbook atlas, newest first. The bundles themselves
   stay in the database; the page gets the list. */
R["GET bundle/history"] = async (req, res, b, q) => {
  const u = await needUser(req, "viewer");
  const slug = clip(q.get("link"), 40);
  needLink(u, slug);
  const row = await store.one("atlas_bundles", { eq: { link_slug: slug } });
  const history = await store.select("atlas_bundle_history", { eq: { link_slug: slug }, order: "at.desc", limit: 50, select: "id,version,action,by_email,note,at" });
  return { live: row ? row.version : 0, history };
};

/* Make an earlier publish live again. It goes out as a new version, so the
   history stays a straight line, and the draft is reset to it so the next
   workbook upload starts from what the client is seeing. */
R["POST bundle/rollback"] = async (req, res, b) => {
  const u = await needUser(req, "admin");
  const slug = clip(b.slug, 40);
  needLink(u, slug);
  const h = await store.one("atlas_bundle_history", { eq: { id: clip(b.historyId, 60), link_slug: slug } });
  if (!h) fail(404, "That version was not found.");
  const row = await bundleRow(slug);
  const version = (row.version || 0) + 1;
  await store.update("atlas_bundles", { eq: { link_slug: slug } }, { published: h.bundle, draft: h.bundle, published_at: store.now(), published_by: u.email, version, draft_updated_at: store.now(), draft_updated_by: u.email });
  await store.insert("atlas_bundle_history", { link_slug: slug, version, bundle: h.bundle, action: "rollback", by_email: u.email, note: `Back to version ${h.version}`, at: store.now() });
  await audit(u, "bundle.rollback", slug, { to: h.version, version });
  return { slug, version };
};

/* The bundle a page renders. Live needs the visitor's access cookie for this
   link; the draft needs an admin, which is what "Preview draft" uses. */
R["GET bundle"] = async (req, res, b, q) => {
  const slug = clip(q.get("link"), 40);
  if (!SLUG.test(slug)) fail(400, "Unknown atlas.");
  const wantDraft = q.get("draft") === "1";
  const link = await store.one("atlas_links", { eq: { slug } });
  if (!link || link.kind !== "bundle") fail(404, "Unknown atlas.");
  const row = await store.one("atlas_bundles", { eq: { link_slug: slug } });
  if (wantDraft) {
    const u = await auth.currentUser(req);
    if (!u || !auth.canLink(u, slug)) fail(401, "Sign in to /admin/ to preview a draft.");
    if (!row || !row.draft) fail(404, "There is no draft yet.");
    return { slug, name: link.name, draft: true, version: row.version, bundle: row.draft };
  }
  const a = auth.accessOf(req);
  const u = a && a.slug === slug ? null : await auth.currentUser(req);
  if (!(a && a.slug === slug) && !(u && auth.canLink(u, slug))) fail(401, "Sign in with your access ID.");
  if (link.status === "paused") return { slug, name: link.name, paused: true };
  if (!row || !row.published) fail(404, "This atlas has not been published yet.");
  return { slug, name: link.name, version: row.version, bundle: row.published, accessId: a ? a.aid : null };
};

/* ---- credentials ---- */
const publicAccess = (a) => ({ access_id: a.access_id, link_slug: a.link_slug, name: a.name, active: a.active, last_used_at: a.last_used_at, created_at: a.created_at });

R["GET access/list"] = async (req, res, b, q) => {
  const u = await needUser(req, "editor");
  const slug = clip(q.get("link"), 40);
  needLink(u, slug);
  const rows = await store.select("atlas_access", { eq: { link_slug: slug }, order: "created_at.asc" });
  return { access: rows.map(publicAccess) };
};

R["POST access/issue"] = async (req, res, b) => {
  const u = await needUser(req, "admin");
  const slug = clip(b.slug, 40);
  needLink(u, slug);
  const link = await store.one("atlas_links", { eq: { slug } });
  if (!link || (link.kind !== "bundle" && link.kind !== "case")) fail(404, "That is not an atlas or case study built from a workbook.");
  const id = normAccess(b.access_id);
  if (!ACCESS_ID.test(id)) fail(400, "An access ID is 3 to 40 letters, numbers and hyphens, such as ACME-PUNE.");
  const pw = String(b.password || "");
  const problem = auth.passwordProblem(pw);
  if (problem) fail(400, problem);
  /* An ID that already opens a committed study cannot be reused here, or the
     site root would not know where to send it. */
  const clash = await store.one("atlas_links", { eq: { access_id: id } });
  if (clash && clash.slug !== slug) fail(400, `"${id}" already opens ${clash.name}. Pick another.`);
  const prior = await store.one("atlas_access", { eq: { access_id: id } });
  if (prior && prior.link_slug !== slug) fail(400, `"${id}" already opens another atlas. Pick another.`);
  const row = { access_id: id, link_slug: slug, password_hash: auth.hashPassword(pw), name: clip(b.name, 120) || null, active: true, failed_logins: 0, locked_until: null };
  await store.upsert("atlas_access", row, "access_id");
  /* The link's own access_id column is what the links table and the
     dashboard show; keep the first one issued there. */
  if (!link.access_id) await store.update("atlas_links", { eq: { slug } }, { access_id: id, updated_at: store.now() });
  await audit(u, "access.issue", slug, { access_id: id, replaced: !!prior });
  return { access: publicAccess({ ...row, created_at: prior ? prior.created_at : store.now(), last_used_at: prior ? prior.last_used_at : null }) };
};

R["POST access/revoke"] = async (req, res, b) => {
  const u = await needUser(req, "admin");
  const id = normAccess(b.access_id);
  const row = await store.one("atlas_access", { eq: { access_id: id } });
  if (!row) fail(404, "No such access ID.");
  needLink(u, row.link_slug);
  await store.update("atlas_access", { eq: { access_id: id } }, { active: !!b.active === true ? true : false });
  await audit(u, b.active ? "access.enable" : "access.revoke", row.link_slug, { access_id: id });
  return { ok: true };
};

/* A visitor at the site root. The same lockout as /admin/: five wrong
   passwords lock the ID for fifteen minutes. The answer to a wrong ID and a
   wrong password is the same, so an ID cannot be confirmed by guessing. */
R["POST access"] = async (req, res, b) => {
  const id = normAccess(b.id);
  const pw = String(b.password || "");
  const bad = () => fail(401, "Invalid Demo ID or password");
  if (!ACCESS_ID.test(id) || !pw) bad();
  const row = await store.one("atlas_access", { eq: { access_id: id } });
  if (!row || !row.active) bad();
  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) fail(429, "Too many attempts. Try again in a few minutes.");
  if (!auth.checkPassword(pw, row.password_hash)) {
    const n = (row.failed_logins || 0) + 1;
    await store.update("atlas_access", { eq: { access_id: id } }, { failed_logins: n, locked_until: n >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null });
    bad();
  }
  const link = await store.one("atlas_links", { eq: { slug: row.link_slug } });
  if (!link) bad();
  await store.update("atlas_access", { eq: { access_id: id } }, { failed_logins: 0, locked_until: null, last_used_at: store.now() });
  auth.setAccess(res, { slug: row.link_slug, aid: id });
  return { slug: row.link_slug, name: link.name, paused: link.status === "paused", open: atlasUrl(row.link_slug) };
};

R["POST access/signout"] = async (req, res) => { auth.clearAccess(res); return { ok: true }; };

/* Where a workbook atlas stands: is there a draft, is anything live. */
R["GET bundle/status"] = async (req, res, b, q) => {
  const u = await needUser(req, "viewer");
  const slug = clip(q.get("link"), 40);
  needLink(u, slug);
  const link = await store.one("atlas_links", { eq: { slug } });
  if (!link || link.kind !== "bundle") fail(404, "That is not an atlas built from a workbook.");
  const row = await store.one("atlas_bundles", { eq: { link_slug: slug } });
  const d = row && row.draft, pub = row && row.published;
  return {
    slug, name: link.name, city: link.city, status: link.status, access_id: link.access_id,
    draft: !!d, draft_updated_at: row ? row.draft_updated_at : null, draft_updated_by: row ? row.draft_updated_by : null,
    draftReport: d ? reportOf(validate(d)) : null,
    draftTitle: d && d.meta ? d.meta.title : null, draftOptions: d ? (d.options || []).length : 0,
    published: !!pub, version: row ? row.version : 0, published_at: row ? row.published_at : null, published_by: row ? row.published_by : null,
    unpublished: !!(d && (!pub || JSON.stringify(d) !== JSON.stringify(pub)))
  };
};

caseRoutes.register(R, { needUser, needLink, fail, clip, audit, SLUG, RESERVED, overridesRow });

/* Is everything an atlas or a case study needs in place? (_preflight.js) */
R["GET preflight"] = async (req) => { await needUser(req, "admin"); return preflight.run(); };

/* ------------------------------------------------------------ handler --- */
module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const route = `${req.method} ${url.searchParams.get("r") || ""}`;
    const fn = R[route];
    if (!fn) fail(404, "Unknown route.");
    /* Broker writes are already proven by their token header; every other
       write must carry x-cms, which a cross-site form cannot send. */
    if (req.method !== "GET" && !route.startsWith("POST broker/")) needWrite(req);
    /* A workbook arrives base64-encoded inside the JSON body. */
    const limit = /^POST (bundle\/(import|import-pdf|plan|enhance|research|build|draft)|case\/(import|draft|apply))$/.test(route) ? 6 * 1024 * 1024 : undefined;
    const body = req.method === "POST" ? await readBody(req, limit) : {};
    const out = await fn(req, res, body, url.searchParams);
    if (out && out.__sent) return;            // the route wrote its own (binary) response
    send(res, 200, out);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error("[cms]", e);
    /* A route's own fail() is written for the person reading it, whatever
       its status; anything else at 5xx is a bug and stays inside. */
    send(res, status, { error: status >= 500 && !(e instanceof store.StoreError) && !(e instanceof HttpError) ? "Something went wrong on the server." : e.message });
  }
};
