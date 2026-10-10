/* ============================================================================
   ATLAS CMS · sign-in, sessions and roles

   Passwords   scrypt with a random salt per user, compared in constant time.
   Sessions    an HttpOnly, Secure, SameSite=Strict cookie holding
               { user id, token version, expiry } signed with HMAC-SHA256
               (CMS_SESSION_SECRET). Bumping a user's token_version signs them
               out everywhere. Every request re-reads the user, so a
               deactivated user loses access at once.
   CSRF        SameSite=Strict, plus every write must carry the x-cms header,
               which a cross-site form cannot set.
   Lockout     five wrong passwords lock the account for 15 minutes.
   Brokers     a broker link carries a random token; only its SHA-256 is
               stored, so a database leak does not leak working links.
   ============================================================================ */
"use strict";
const crypto = require("crypto");
const store = require("./_store");

const SECRET = process.env.CMS_SESSION_SECRET || (store.MODE === "dev" ? "dev-only-secret-do-not-use" : "");
const COOKIE = "atlas_cms";
const TTL_S = 60 * 60 * 12;             // a working day
const ROLES = ["viewer", "editor", "admin", "owner"];
const rank = (r) => ROLES.indexOf(r);

/* ---------------------------------------------------------- passwords -- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString("base64")}$${key.toString("base64")}`;
}
function checkPassword(pw, stored) {
  try {
    const [algo, n, salt, key] = String(stored).split("$");
    if (algo !== "scrypt") return false;
    const want = Buffer.from(key, "base64");
    const got = crypto.scryptSync(String(pw), Buffer.from(salt, "base64"), want.length, { N: +n, r: 8, p: 1 });
    return crypto.timingSafeEqual(want, got);
  } catch (e) { return false; }
}
function passwordProblem(pw) {
  const s = String(pw || "");
  if (s.length < 10) return "Use at least 10 characters.";
  if (!/[a-z]/i.test(s) || !/\d/.test(s)) return "Use letters and at least one number.";
  return null;
}

/* ----------------------------------------------------------- sessions -- */
const b64u = (buf) => Buffer.from(buf).toString("base64url");
function sign(payload) {
  if (!SECRET) throw new store.StoreError("CMS_SESSION_SECRET is not set in Vercel (see admin/README.md).", 503);
  const body = b64u(JSON.stringify(payload));
  const mac = b64u(crypto.createHmac("sha256", SECRET).update(body).digest());
  return `${body}.${mac}`;
}
function verify(token) {
  if (!SECRET || !token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const want = b64u(crypto.createHmac("sha256", SECRET).update(body).digest());
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch (e) { return null; }
}
function cookieOf(req) {
  const raw = req.headers.cookie || "";
  const m = raw.split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : "";
}
const secureFlag = () => (store.MODE === "dev" ? "" : " Secure;");
function setSession(res, user) {
  const token = sign({ uid: user.id, ver: user.token_version, exp: Math.floor(Date.now() / 1000) + TTL_S });
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly;${secureFlag()} SameSite=Strict; Max-Age=${TTL_S}`);
}
function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly;${secureFlag()} SameSite=Strict; Max-Age=0`);
}
/* The signed-in user, re-read from the database, or null. */
async function currentUser(req) {
  const p = verify(cookieOf(req));
  if (!p) return null;
  const u = await store.one("cms_users", { eq: { id: p.uid } });
  if (!u || !u.active || u.token_version !== p.ver) return null;
  return u;
}
/* Can this user see or change this link? null `links` means every link. */
const canLink = (user, slug) => !user.links || user.links.length === 0 || user.links.includes(slug);
const atLeast = (user, role) => user && rank(user.role) >= rank(role);
const publicUser = (u) => u && ({ id: u.id, email: u.email, name: u.name, role: u.role, links: u.links, active: u.active, last_login_at: u.last_login_at, created_at: u.created_at });

/* ------------------------------------------------------------ brokers -- */
const newToken = () => crypto.randomBytes(24).toString("base64url");
const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

module.exports = {
  ROLES, rank, atLeast, canLink, publicUser,
  hashPassword, checkPassword, passwordProblem,
  setSession, clearSession, currentUser,
  newToken, hashToken,
};
