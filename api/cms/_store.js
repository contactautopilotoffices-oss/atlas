/* ============================================================================
   ATLAS CMS · storage

   One small table API with two backends, so every route runs the same code
   in production and on a laptop:

     Supabase   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set (production).
                Talks to PostgREST with the service_role key, which bypasses
                row level security. That key lives only in Vercel's
                environment; it never reaches a browser.
     JSON file  CMS_DEV_STORE=/path/to/store.json (local development and the
                test run). Same filters, same defaults, same seed links.

   Files in /api that start with "_" are not routes on Vercel.
   ============================================================================ */
"use strict";
const fs = require("fs");
const crypto = require("crypto");

const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DEV = process.env.CMS_DEV_STORE || "";
const MODE = SB_URL && SB_KEY ? "supabase" : DEV ? "dev" : "off";

class StoreError extends Error {
  constructor(msg, status) { super(msg); this.status = status || 500; }
}

/* ------------------------------------------------------------ filters ----
   q = { eq:{col:v}, neq:{}, gte:{}, lte:{}, gt:{}, lt:{}, in:{col:[...]},
         is:{col:null}, order:"col.desc", limit, offset, select:"a,b" } */
function pgParams(q = {}) {
  const p = new URLSearchParams();
  if (q.select) p.set("select", q.select);
  for (const op of ["eq", "neq", "gte", "lte", "gt", "lt"]) {
    for (const [k, v] of Object.entries(q[op] || {})) p.append(k, `${op}.${v}`);
  }
  for (const [k, list] of Object.entries(q.in || {})) {
    p.append(k, `in.(${list.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`);
  }
  for (const [k, v] of Object.entries(q.is || {})) p.append(k, `is.${v === null ? "null" : v}`);
  if (q.order) p.set("order", q.order);
  if (q.limit != null) p.set("limit", String(q.limit));
  if (q.offset != null) p.set("offset", String(q.offset));
  return p;
}
function matches(row, q = {}) {
  const cmp = (a, b) => (a > b ? 1 : a < b ? -1 : 0);
  for (const [k, v] of Object.entries(q.eq || {})) if (String(row[k]) !== String(v)) return false;
  for (const [k, v] of Object.entries(q.neq || {})) if (String(row[k]) === String(v)) return false;
  for (const [k, v] of Object.entries(q.gte || {})) if (row[k] == null || cmp(row[k], v) < 0) return false;
  for (const [k, v] of Object.entries(q.lte || {})) if (row[k] == null || cmp(row[k], v) > 0) return false;
  for (const [k, v] of Object.entries(q.gt || {})) if (row[k] == null || cmp(row[k], v) <= 0) return false;
  for (const [k, v] of Object.entries(q.lt || {})) if (row[k] == null || cmp(row[k], v) >= 0) return false;
  for (const [k, list] of Object.entries(q.in || {})) if (!list.map(String).includes(String(row[k]))) return false;
  for (const [k, v] of Object.entries(q.is || {})) if ((row[k] ?? null) !== v) return false;
  return true;
}

/* ------------------------------------------------------------ Supabase -- */
async function sb(method, table, { q, body, prefer, conflict } = {}) {
  const p = pgParams(q);
  if (conflict) p.set("on_conflict", conflict);
  const url = `${SB_URL}/rest/v1/${table}${[...p].length ? "?" + p : ""}`;
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new StoreError(`Database ${method} ${table} failed (${r.status}): ${text.slice(0, 300)}`, r.status >= 500 ? 502 : 400);
  return text ? JSON.parse(text) : null;
}

/* ------------------------------------------------------------ dev file -- */
const DEFAULTS = {
  cms_users: () => ({ id: crypto.randomUUID(), name: "", links: null, active: true, token_version: 1, failed_logins: 0, locked_until: null, last_login_at: null, created_at: now(), updated_at: now() }),
  atlas_links: () => ({ status: "live", notes: null, access_id: null, city: null, created_at: now(), updated_at: now() }),
  atlas_overrides: () => ({ draft: {}, published: {}, draft_updated_at: null, draft_updated_by: null, published_at: null, published_by: null, version: 0 }),
  atlas_override_history: () => ({ id: crypto.randomUUID(), at: now() }),
  broker_links: () => ({ id: crypto.randomUUID(), links: [], properties: null, can_propose: true, active: true, expires_at: null, created_at: now(), last_used_at: null, submissions: 0 }),
  broker_submissions: () => ({ id: crypto.randomUUID(), status: "pending", review_note: null, reviewed_by: null, reviewed_at: null, created_at: now() }),
  atlas_events: () => ({ ts: now() }),
  cms_audit: () => ({ at: now() }),
};
const PK = { atlas_links: "slug", atlas_overrides: "link_slug" };
const SEED_LINKS = [
  ["flipkart-andheri", "Flipkart · Andheri", "client", "/", "FLIPDEMOACC", "Mumbai"],
  ["vfs-bkc", "VFS · BKC", "client", "/", "VFSDEMOACC", "Mumbai"],
  ["cp-delhi", "Connaught Place · Delhi", "client", "/", "CPDEMOACC", "Delhi"],
  ["invesco-andheri", "Invesco · Andheri", "client", "/", "INVDEMOACC", "Mumbai"],
  ["basilic-fly", "Whitefield · Bengaluru", "client", "/", "FLYDEMOACC", "Bengaluru"],
  ["digitide-noida", "Digitide · Noida", "client", "/", "DIGDEMOACC", "Noida"],
  ["digitide", "Digitide group command centre", "study", "/digitide/", "DIGITIDE-GRP", "Multi-city"],
  ["indore", "Indore office study", "study", "/indore/", "INDORE-AP", "Indore"],
  ["chennai", "Chennai office study", "study", "/chennai/", "CHENNAI-AP", "Chennai"],
  ["godseye", "God's Eye", "tool", "/godseye/", null, null],
];
function now() { return new Date().toISOString(); }
function devLoad() {
  if (!fs.existsSync(DEV)) {
    const db = { tables: {}, seq: {} };
    db.tables.atlas_links = SEED_LINKS.map(([slug, name, kind, path, access_id, city]) => ({ ...DEFAULTS.atlas_links(), slug, name, kind, path, access_id, city }));
    db.tables.atlas_overrides = SEED_LINKS.map(([slug]) => ({ ...DEFAULTS.atlas_overrides(), link_slug: slug }));
    fs.writeFileSync(DEV, JSON.stringify(db));
  }
  return JSON.parse(fs.readFileSync(DEV, "utf8"));
}
const devSave = (db) => fs.writeFileSync(DEV, JSON.stringify(db));
function devWithDefaults(db, table, row) {
  const out = { ...(DEFAULTS[table] ? DEFAULTS[table]() : {}), ...row };
  if ((table === "atlas_events" || table === "cms_audit") && out.id == null) { db.seq[table] = (db.seq[table] || 0) + 1; out.id = db.seq[table]; }
  return out;
}
function devSort(rows, order) {
  if (!order) return rows;
  const [col, dir] = order.split(".");
  return rows.slice().sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === "desc" ? -1 : 1));
}
function devPick(rows, select) {
  if (!select || select === "*") return rows;
  const cols = select.split(",").map(s => s.trim());
  return rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
}

/* ------------------------------------------------------------ public API -- */
const clone = (x) => JSON.parse(JSON.stringify(x));
function need() {
  if (MODE === "off") throw new StoreError("The CMS has no database configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel (see admin/README.md).", 503);
}

async function select(table, q = {}) {
  need();
  if (MODE === "supabase") return sb("GET", table, { q });
  const db = devLoad();
  let rows = (db.tables[table] || []).filter(r => matches(r, q));
  rows = devSort(rows, q.order);
  const off = q.offset || 0;
  rows = rows.slice(off, q.limit != null ? off + q.limit : undefined);
  return clone(devPick(rows, q.select));
}
async function one(table, q = {}) { const r = await select(table, { ...q, limit: 1 }); return r[0] || null; }
/* Every page of a query, for analytics. Capped so a runaway table cannot
   take the function down; the cap is reported to the caller. */
async function selectAll(table, q = {}, cap = 50000) {
  const out = []; const page = 1000;
  for (let off = 0; off < cap; off += page) {
    const rows = await select(table, { ...q, limit: page, offset: off });
    out.push(...rows);
    if (rows.length < page) return { rows: out, capped: false };
  }
  return { rows: out, capped: true };
}
async function insert(table, rows) {
  need();
  const list = Array.isArray(rows) ? rows : [rows];
  if (MODE === "supabase") return sb("POST", table, { body: list, prefer: "return=representation" });
  const db = devLoad();
  db.tables[table] = db.tables[table] || [];
  const made = list.map(r => devWithDefaults(db, table, r));
  const pk = PK[table];
  for (const m of made) {
    if (table === "cms_users" && db.tables[table].some(x => x.email === m.email)) throw new StoreError("duplicate key value violates unique constraint (email)", 400);
    if (table === "broker_links" && db.tables[table].some(x => x.token_hash === m.token_hash)) throw new StoreError("duplicate token", 400);
    if (pk && db.tables[table].some(x => x[pk] === m[pk])) throw new StoreError(`duplicate key value violates unique constraint (${pk})`, 400);
  }
  db.tables[table].push(...made);
  devSave(db);
  return clone(made);
}
/* Fire-and-forget inserts (events) do not need the rows back. */
async function insertQuiet(table, rows) {
  need();
  if (MODE === "supabase") return sb("POST", table, { body: Array.isArray(rows) ? rows : [rows], prefer: "return=minimal" });
  return insert(table, rows);
}
async function update(table, q, patch) {
  need();
  if (MODE === "supabase") return sb("PATCH", table, { q, body: patch, prefer: "return=representation" });
  const db = devLoad();
  const rows = (db.tables[table] || []).filter(r => matches(r, q));
  rows.forEach(r => Object.assign(r, patch));
  devSave(db);
  return clone(rows);
}
async function upsert(table, row, conflict) {
  need();
  if (MODE === "supabase") return sb("POST", table, { body: [row], prefer: "resolution=merge-duplicates,return=representation", conflict });
  const db = devLoad();
  db.tables[table] = db.tables[table] || [];
  const hit = db.tables[table].find(r => r[conflict] === row[conflict]);
  if (hit) { Object.assign(hit, row); devSave(db); return clone([hit]); }
  const made = devWithDefaults(db, table, row);
  db.tables[table].push(made); devSave(db);
  return clone([made]);
}
async function remove(table, q) {
  need();
  if (MODE === "supabase") return sb("DELETE", table, { q, prefer: "return=representation" });
  const db = devLoad();
  const keep = [], gone = [];
  for (const r of db.tables[table] || []) (matches(r, q) ? gone : keep).push(r);
  db.tables[table] = keep; devSave(db);
  return clone(gone);
}

/* ------------------------------------------------------------ storage ----
   A short-lived signed upload URL for one object in the atlas-cms bucket.
   The browser PUTs the file straight to Supabase, so large 3D models never
   pass through a Vercel function (which caps request bodies at 4.5 MB). */
const BUCKET = "atlas-cms";
async function signUpload(objectPath) {
  need();
  if (MODE !== "supabase") {
    return { uploadUrl: `/api/cms?r=dev-upload&path=${encodeURIComponent(objectPath)}`, publicUrl: `/media/_cms-dev/${objectPath}`, method: "PUT" };
  }
  const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/${BUCKET}/${objectPath}`, {
    method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" }, body: "{}"
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new StoreError("Could not create an upload link: " + (j.message || j.error || r.status), 502);
  return { uploadUrl: `${SB_URL}/storage/v1${j.url}`, publicUrl: `${SB_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`, method: "PUT" };
}

module.exports = { MODE, StoreError, select, one, selectAll, insert, insertQuiet, update, upsert, remove, signUpload, now };
