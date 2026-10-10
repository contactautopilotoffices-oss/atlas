/* ============================================================================
   ATLAS Admin · /admin/

   One page, hash routes:
     #/dashboard        visitors, sessions, sign-ins, time spent, live now
     #/links            every Atlas link: status, versions, visits
     #/content/<slug>   the content editor for one link (draft, preview,
                        publish, history): properties and sources, what is
                        shown (tabs, filters, layers, buttons), 3D models,
                        facts, notice banner, new properties
     #/brokers          broker links (create, switch off, new link)
     #/inbox            what brokers sent, to approve into a draft
     #/team             who can sign in here, and their role
     #/audit            who changed what
     #/account          password, and whether your own visits count

   Talks only to /api/cms (same origin, session cookie). Every write carries
   the x-cms header. Every value from the server is escaped before it is put
   on the page.
   ============================================================================ */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CMS = window.AtlasCMS;
const ROLES = ["viewer", "editor", "admin", "owner"];
const ROLE_TEXT = { viewer: "Viewer: sees analytics and content, changes nothing", editor: "Editor: edits and publishes content, manages broker links", admin: "Admin: everything except owners, including the team and links", owner: "Owner: everything" };
const ST = { me: null, links: [], pending: 0, probes: {} };
const can = (role) => ST.me && ROLES.indexOf(ST.me.role) >= ROLES.indexOf(role);
const linkName = (slug) => (ST.links.find(l => l.slug === slug) || {}).name || slug;
/* Access ids are counted without spaces or hyphens (the way the sign-in
   pages match them); show them the way the link's id is written. */
const normId = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const prettyId = (id) => { const l = ST.links.find(x => x.access_id && normId(x.access_id) === normId(id)); return l ? l.access_id : id; };

/* ------------------------------------------------------------ format ---- */
const n0 = (v) => (v == null ? "-" : Math.round(v).toLocaleString("en-IN"));
const compact = (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e4 ? (v / 1e3).toFixed(1) + "K" : n0(v);
function dur(s) {
  if (!s) return "0s";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function ago(iso) {
  if (!iso) return "never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
const when = (iso) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
const dayLabel = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/* --------------------------------------------------------------- api ---- */
async function api(route, { method = "GET", body, query = {} } = {}) {
  const qs = new URLSearchParams({ r: route, ...query });
  const res = await fetch(`/api/cms?${qs}`, {
    method, credentials: "same-origin",
    headers: method === "GET" ? {} : { "Content-Type": "application/json", "x-cms": "1" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let j = {};
  try { j = await res.json(); } catch (e) {}
  if (res.status === 401 && ST.me && !route.startsWith("auth/")) { ST.me = null; showLogin("Your session ended. Please sign in again."); }
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status}).`);
  return j;
}
function toast(msg, bad) {
  const d = document.createElement("div");
  if (bad) d.className = "bad";
  d.innerHTML = msg;
  $("#toast").appendChild(d);
  setTimeout(() => d.remove(), bad ? 6500 : 3800);
}
const fail = (e) => toast(esc(e.message || e), true);
function modal(html, onReady) {
  $("#modal-body").innerHTML = html;
  $("#modal").classList.add("on");
  const first = $("#modal-body").querySelector("input,select,textarea,button");
  if (first) setTimeout(() => first.focus(), 30);
  if (onReady) onReady($("#modal-body"));
}
const closeModal = () => $("#modal").classList.remove("on");
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" || e.target.closest("[data-close]")) closeModal(); });
addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !$("#modal").classList.contains("on")) return;
  const c = $("#modal-body [data-close]");
  c ? c.click() : closeModal();
});
function confirmBox(title, text, okText = "Confirm", danger = false) {
  return new Promise((ok) => {
    modal(`<h2>${esc(title)}</h2><p class="mut">${text}</p><div class="acts"><button class="btn" data-close>Cancel</button><button class="btn ${danger ? "danger" : "pri"}" id="cf-ok">${esc(okText)}</button></div>`, (m) => {
      $("#cf-ok", m).onclick = () => { closeModal(); ok(true); };
      $("#modal").addEventListener("click", function h(e) { if (e.target.id === "modal" || e.target.closest("[data-close]")) { $("#modal").removeEventListener("click", h); ok(false); } });
    });
  });
}
const copy = async (text, btn) => {
  try { await navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = "Copied"; setTimeout(() => btn.textContent = t, 1500); } }
  catch (e) { window.prompt("Copy this", text); }
};
function randomPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", b = new Uint32Array(14);
  crypto.getRandomValues(b);
  return [...b].map(x => a[x % a.length]).join("").replace(/^(.{4})(.{5})(.{5})$/, "$1-$2-$3") + "7";
}

/* ------------------------------------------------------------ probe ----
   Reads a link's own data files in a hidden frame and returns its
   properties, fields, facts and settings (see probe.html). */
function probe(slug, kind) {
  if (ST.probes[slug]) return ST.probes[slug];
  ST.probes[slug] = new Promise((ok, bad) => {
    const f = document.createElement("iframe");
    f.hidden = true; f.setAttribute("aria-hidden", "true");
    f.src = `./probe.html?link=${encodeURIComponent(slug)}&kind=${encodeURIComponent(kind || "")}`;
    const t = setTimeout(() => { done(); bad(new Error("Could not read this link's data.")); }, 20000);
    const on = (e) => { if (e.origin === location.origin && e.data && e.data.type === "atlas-probe" && e.data.link === slug) { done(); e.data.data.error ? bad(new Error(e.data.data.error)) : ok(e.data.data); } };
    const done = () => { clearTimeout(t); removeEventListener("message", on); setTimeout(() => f.remove(), 0); };
    addEventListener("message", on);
    document.body.appendChild(f);
  });
  ST.probes[slug].catch(() => { delete ST.probes[slug]; });
  return ST.probes[slug];
}

/* ------------------------------------------------------------ sign-in -- */
async function init() {
  let st;
  try { st = await api("status"); } catch (e) { return showLogin(null, { error: e.message }); }
  if (st.mode === "off") return showLogin(null, { off: true });
  if (st.needsSetup) return showLogin(null, { setup: true });
  try { const me = await api("auth/me"); if (me.user) return enter(me.user); } catch (e) {}
  showLogin();
}
function showLogin(msg, opt = {}) {
  $("#shell").hidden = true; $("#login").hidden = false;
  const B = $("#login-body");
  if (opt.off) {
    B.innerHTML = `<h1>ATLAS Admin</h1><p>The admin panel is installed but has no database yet.</p>
      <div class="note">Set these in Vercel (Project, Settings, Environment Variables) and redeploy:<br><br>
      <span class="mono">SUPABASE_URL</span>, <span class="mono">SUPABASE_SERVICE_ROLE_KEY</span>, <span class="mono">CMS_SESSION_SECRET</span>, <span class="mono">CMS_SETUP_KEY</span>.<br><br>
      Then run <span class="mono">supabase/migrations/013_cms.sql</span> in the Supabase SQL editor. Full steps are in <span class="mono">admin/README.md</span>.</div>`;
    return;
  }
  if (opt.error) { B.innerHTML = `<h1>ATLAS Admin</h1><p class="err">${esc(opt.error)}</p>`; return; }
  if (opt.setup) {
    B.innerHTML = `<h1>Set up ATLAS Admin</h1><p>Create the first owner account. You need the setup key from Vercel (<span class="mono">CMS_SETUP_KEY</span>).</p>
      <form id="f-setup"><label class="f" for="s-key">Setup key</label><input class="in" id="s-key" type="password" required>
      <label class="f" for="s-name">Your name</label><input class="in" id="s-name" required>
      <label class="f" for="s-email">Email</label><input class="in" id="s-email" type="email" autocomplete="username" required>
      <label class="f" for="s-pw">Password (10+ characters, letters and a number)</label><input class="in" id="s-pw" type="password" autocomplete="new-password" required>
      <button class="btn pri wide" type="submit">Create owner and sign in</button><div class="err" id="s-err"></div></form>`;
    $("#f-setup").onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await api("auth/setup", { method: "POST", body: { setupKey: $("#s-key").value, name: $("#s-name").value, email: $("#s-email").value, password: $("#s-pw").value } }); enter(r.user); }
      catch (err) { $("#s-err").textContent = err.message; }
    };
    return;
  }
  B.innerHTML = `<h1>ATLAS Admin</h1><p>Sign in to manage every Atlas link, see who is using them and review broker updates.</p>
    <form id="f-login"><label class="f" for="l-email">Email</label><input class="in" id="l-email" type="email" autocomplete="username" required>
    <label class="f" for="l-pw">Password</label><input class="in" id="l-pw" type="password" autocomplete="current-password" required>
    <button class="btn pri wide" type="submit">Sign in</button><div class="err" id="l-err">${esc(msg || "")}</div></form>`;
  $("#f-login").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter || $("#f-login button"); b.disabled = true;
    try { const r = await api("auth/login", { method: "POST", body: { email: $("#l-email").value, password: $("#l-pw").value } }); enter(r.user); }
    catch (err) { $("#l-err").textContent = err.message; $("#l-pw").value = ""; }
    b.disabled = false;
  };
  setTimeout(() => $("#l-email") && $("#l-email").focus(), 30);
}
async function enter(user) {
  ST.me = user;
  document.body.classList.toggle("ro", !can("editor"));
  /* Your own visits to the links are not counted unless you ask for it. */
  try { if (localStorage.getItem("atlas-team-count") !== "1") localStorage.setItem("atlas-team", "1"); } catch (e) {}
  $("#login").hidden = true; $("#shell").hidden = false;
  try { ST.links = (await api("links")).links; } catch (e) { fail(e); }
  refreshPending();
  route();
}
async function signOut() {
  if (ED && ED.dirty && !(await confirmBox("Leave without saving?", "Your unsaved changes will be lost.", "Sign out", true))) return;
  try { await api("auth/logout", { method: "POST", body: {} }); } catch (e) {}
  ST.me = null; ED = null; location.hash = "#/dashboard"; showLogin("You have signed out.");
}
async function refreshPending() {
  if (!can("editor")) return;
  try { ST.pending = (await api("submissions", { query: { status: "pending" } })).submissions.length; } catch (e) { ST.pending = 0; }
  renderNav();
}

/* --------------------------------------------------------------- nav ---- */
const ICON = {
  dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  links: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  brokers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  team: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  audit: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  account: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
function renderNav() {
  if (!ST.me) return;
  const cur = (location.hash.replace(/^#\/?/, "").split("/")[0]) || "dashboard";
  const items = [
    ["dashboard", "Dashboard", "viewer"], ["links", "Atlas links", "viewer"], ["brokers", "Broker links", "editor"],
    ["inbox", "Inbox", "editor"], ["team", "Team", "admin"], ["audit", "Audit log", "admin"], ["account", "Account", "viewer"]
  ].filter(i => can(i[2]));
  $("#nav").innerHTML = `<div class="brand"><img src="/autopilot-logo-trimmed.png" alt="Autopilot"><span>Admin</span></div>
    ${items.map(([k, label]) => `<a class="it ${cur === k || (k === "links" && cur === "content") ? "on" : ""}" href="#/${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>${label}${k === "inbox" && ST.pending ? `<span class="badge">${ST.pending}</span>` : ""}</a>`).join("")}
    <div class="foot"><b>${esc(ST.me.name || ST.me.email)}</b>${esc(ST.me.role)}${ST.me.links && ST.me.links.length ? ` · ${ST.me.links.length} link${ST.me.links.length > 1 ? "s" : ""}` : ""}
      <div class="row"><button class="btn sm" id="nav-out" type="button">Sign out</button></div></div>`;
  $("#nav-out").onclick = signOut;
}

/* ------------------------------------------------------------ router ---- */
let ED = null;          // the content editor's state, when open
let lastHash = location.hash;
async function route() {
  if (!ST.me) return;
  const [page, a, b] = location.hash.replace(/^#\/?/, "").split("/");
  if (ED && ED.dirty && !(page === "content" && a === ED.slug)) {
    if (!(await confirmBox("Leave without saving?", "This link has unsaved changes in its draft.", "Leave", true))) { history.replaceState(null, "", lastHash); return; }
    ED = null;
  }
  if (!(page === "content" && ED && a === ED.slug)) ED = null;
  lastHash = location.hash;
  renderNav();
  const M = $("#main");
  const go = { dashboard: pageDashboard, links: pageLinks, content: pageContent, brokers: pageBrokers, inbox: pageInbox, team: pageTeam, audit: pageAudit, account: pageAccount }[page || "dashboard"] || pageDashboard;
  try { await go(M, a, b); } catch (e) { M.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}
addEventListener("hashchange", route);
addEventListener("beforeunload", (e) => { if (ED && ED.dirty) { e.preventDefault(); e.returnValue = ""; } });
const header = (eyebrow, title, sub, actions = "") => `<div class="hd"><div class="t"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div><div class="act">${actions}</div></div>`;

/* ========================================================= dashboard == */
const DASH = { days: 30, link: "", metric: "visitors", table: false };
async function pageDashboard(M) {
  if (!M.querySelector(".tiles")) M.innerHTML = header("Analytics", "Who is using the Atlas links", "Visitors, sign-ins and time spent across every link. Visits by the Autopilot team are not counted.") + `<div class="card empty">Loading…</div>`;
  const d = await api("analytics", { query: { days: DASH.days, ...(DASH.link ? { link: DASH.link } : {}) } });
  const T = d.totals;
  const filters = `<div class="seg" role="group" aria-label="Period">${[7, 30, 90].map(n => `<button type="button" class="${DASH.days === n ? "on" : ""}" data-days="${n}">${n} days</button>`).join("")}</div>
    <select class="sel" id="d-link" aria-label="Link"><option value="">All links</option>${ST.links.map(l => `<option value="${esc(l.slug)}" ${DASH.link === l.slug ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select>
    <button class="btn" id="d-refresh" type="button">Refresh</button>`;
  M.innerHTML = header("Analytics", "Who is using the Atlas links", `Last ${DASH.days} days${DASH.link ? ` · ${esc(linkName(DASH.link))}` : " · all links"}. Visits by the Autopilot team are not counted.`, filters) + `
    ${d.capped ? `<div class="card note" style="margin-bottom:12px;border-color:var(--warn)">Very busy period: only the first 50,000 events were counted. Pick a shorter period for exact numbers.</div>` : ""}
    <div class="tiles">
      <div class="tile lead"><div class="l"><span class="live"></span>Active now</div><div class="v">${n0(T.activeNow)}</div><div class="s">visitors in the last 5 min</div></div>
      <div class="tile"><div class="l">Visitors</div><div class="v">${compact(T.visitors)}</div><div class="s">${n0(T.returning)} came back on another day</div></div>
      <div class="tile"><div class="l">Sessions</div><div class="v">${compact(T.sessions)}</div><div class="s">${n0(T.views)} page loads</div></div>
      <div class="tile"><div class="l">Signed in</div><div class="v">${compact(T.signedSessions)}</div><div class="s">${T.sessions ? Math.round(T.signedSessions / T.sessions * 100) : 0}% of sessions</div></div>
      <div class="tile"><div class="l">Average time</div><div class="v">${dur(T.avgSessionSec)}</div><div class="s">per session, tab in front</div></div>
      <div class="tile"><div class="l">Properties opened</div><div class="v">${compact(T.opens)}</div><div class="s">across all sessions</div></div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <h3 style="margin:0" id="ch-title">${{ visitors: "Visitors per day", views: "Page loads per day", signins: "Sign-ins per day" }[DASH.metric]}</h3>
        <div class="seg" role="group" aria-label="Measure" style="margin-left:auto">${[["visitors", "Visitors"], ["views", "Page loads"], ["signins", "Sign-ins"]].map(([k, l]) => `<button type="button" class="${DASH.metric === k ? "on" : ""}" data-metric="${k}">${l}</button>`).join("")}</div>
        <button class="btn sm" type="button" id="ch-table">${DASH.table ? "Show chart" : "Show as table"}</button>
      </div>
      <div id="chart">${DASH.table ? dailyTable(d.daily) : dailyChart(d.daily, DASH.metric)}</div>
      <div class="note" style="margin-top:6px">Days are counted in India time. A visitor is one browser; a session is one visit in one tab.</div>
    </div>
    <div class="grid g2" style="margin-bottom:14px">
      <div class="card"><h3>By link</h3>${linksTable(d.links)}</div>
      <div class="card"><h3>Who signed in (access ID)</h3>${idsTable(d.accessIds)}</div>
    </div>
    <div class="card" style="margin-bottom:14px"><h3>Recent sessions</h3>${sessionsTable(d.sessions)}</div>
    <div class="grid g4" style="margin-bottom:14px">
      ${breakdown("Countries", d.countries)}${breakdown("Cities", d.cities)}${breakdown("Devices", d.devices)}${breakdown("Came from", d.referrers, "Direct or bookmarked links do not show here.")}
    </div>
    <div class="grid g2">
      <div class="card"><h3>Most opened properties</h3>${d.opens.length ? `<div class="list">${d.opens.map(o => `<div class="kv"><span>${esc(o.label || o.item)} <span class="dim small">· ${esc(o.name)}</span></span><b class="num">${n0(o.n)}</b></div>`).join("")}</div>` : `<div class="empty">Nothing opened yet.</div>`}</div>
      <div class="card"><h3>Sections viewed</h3>${d.tabs.length ? `<div class="list">${d.tabs.map(o => `<div class="kv"><span>${esc(tabLabel(o.link, o.tab))} <span class="dim small">· ${esc(o.name)}</span></span><b class="num">${n0(o.n)}</b></div>`).join("")}</div>` : `<div class="empty">No section views yet.</div>`}</div>
    </div>`;
  $$("[data-days]", M).forEach(b => b.onclick = () => { DASH.days = +b.dataset.days; pageDashboard(M); });
  $$("[data-metric]", M).forEach(b => b.onclick = () => { DASH.metric = b.dataset.metric; pageDashboard(M); });
  $("#d-link").onchange = (e) => { DASH.link = e.target.value; pageDashboard(M); };
  $("#d-refresh").onclick = () => pageDashboard(M);
  $("#ch-table").onclick = () => { DASH.table = !DASH.table; pageDashboard(M); };
  wireChart();
}
function niceMax(v) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
/* One series, one axis: bars capped at 24 px, 4 px rounded tops, square at
   the baseline, a hover/focus tooltip on every day, and a table view. */
function dailyChart(rows, metric) {
  /* Drawn at the width it is shown, so text stays at its real size. */
  const W = Math.max(300, Math.round((($("#main") || {}).clientWidth || 1000) - 72)), H = 220, L = 40, R = 10, T = 12, B = 26, pw = W - L - R, ph = H - T - B;
  const vals = rows.map(r => r[metric]);
  const max = niceMax(Math.max(1, ...vals));
  const slot = pw / rows.length, bw = Math.min(24, Math.max(2, slot - 2));
  const y = (v) => T + ph - v / max * ph;
  const ticks = [0, .25, .5, .75, 1].map(f => f * max);
  const every = Math.ceil(rows.length / Math.max(3, Math.floor(pw / 80)));
  const bar = (x, top, w, h) => {
    if (h <= 0) return "";
    const r = Math.min(4, w / 2, h);
    return `<path class="b" d="M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + h}Z"/>`;
  };
  const cols = rows.map((r, i) => {
    const x = L + i * slot + (slot - bw) / 2, v = r[metric], top = y(v);
    return `<g class="col" tabindex="0" role="img" data-i="${i}" aria-label="${esc(dayLabel(r.day))}: ${v} ${metric}">
      <rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}"/>${bar(x, top, bw, T + ph - top)}</g>`;
  }).join("");
  const axis = ticks.map(t => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="tk" x="${L - 6}" y="${y(t) + 3.5}" text-anchor="end">${t % 1 ? t.toFixed(1) : n0(t)}</text>`).join("")
    + rows.map((r, i) => (i % every === 0 || (i === rows.length - 1 && (rows.length - 1) % every >= every / 2)) ? `<text class="tk" x="${L + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle">${esc(dayLabel(r.day))}</text>` : "").join("");
  CHART_ROWS = rows; CHART_METRIC = metric;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" aria-label="Daily ${metric}">${axis}${cols}</svg><div class="tip" hidden></div></div>`;
}
let CHART_ROWS = [], CHART_METRIC = "visitors";
function wireChart() {
  const wrap = $(".chart"); if (!wrap) return;
  const tip = $(".tip", wrap);
  const show = (g) => {
    const r = CHART_ROWS[+g.dataset.i], b = g.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const pl = (n, one, many) => `${n0(n)} ${n === 1 ? one : many}`;
    tip.innerHTML = `<b>${esc(dayLabel(r.day))}</b><br>${pl(r.visitors, "visitor", "visitors")} · ${pl(r.views, "page load", "page loads")} · ${pl(r.signins, "sign-in", "sign-ins")}`;
    tip.hidden = false;
    const left = Math.min(Math.max(b.left - w.left + b.width / 2 - tip.offsetWidth / 2, 0), w.width - tip.offsetWidth);
    tip.style.left = left + "px"; tip.style.top = Math.max(0, b.top - w.top + 4) + "px";
  };
  $$("g.col", wrap).forEach(g => { g.onmouseenter = () => show(g); g.onfocus = () => show(g); g.onmouseleave = g.onblur = () => { tip.hidden = true; }; });
}
const dailyTable = (rows) => `<div class="tw" style="max-height:320px"><table class="t"><thead><tr><th>Day</th><th class="n">Visitors</th><th class="n">Page loads</th><th class="n">Sign-ins</th></tr></thead><tbody>${rows.slice().reverse().map(r => `<tr><td>${esc(dayLabel(r.day))}</td><td class="n">${n0(r.visitors)}</td><td class="n">${n0(r.views)}</td><td class="n">${n0(r.signins)}</td></tr>`).join("")}</tbody></table></div>`;
function linksTable(rows) {
  if (!rows.length) return `<div class="empty">No visits in this period.</div>`;
  const max = Math.max(...rows.map(r => r.visitors), 1);
  return `<div class="tw"><table class="t"><thead><tr><th>Link</th><th class="n">Visitors</th><th class="n">Sign-ins</th><th class="n">Avg time</th><th>Last visit</th></tr></thead><tbody>${rows.map(r => `<tr>
    <td>${r.activeNow ? `<span class="live" title="${r.activeNow} active now"></span>` : ""}<a href="#/content/${esc(r.slug)}">${esc(r.name)}</a><div class="bar" aria-hidden="true"><i style="width:${Math.round(r.visitors / max * 100)}%"></i></div></td>
    <td class="n">${n0(r.visitors)}</td><td class="n">${n0(r.signins)}</td><td class="n">${dur(r.avgSessionSec)}</td><td class="mut">${ago(r.lastSeen)}</td></tr>`).join("")}</tbody></table></div>`;
}
function idsTable(rows) {
  if (!rows.length) return `<div class="empty">No sign-ins in this period.</div>`;
  return `<div class="tw"><table class="t"><thead><tr><th>Access ID</th><th>Link</th><th class="n">Sign-ins</th><th class="n">Browsers</th><th>Last seen</th></tr></thead><tbody>${rows.map(r => `<tr>
    <td class="mono">${esc(prettyId(r.id))}</td><td>${r.links.map(s => esc(linkName(s))).join(", ")}</td><td class="n">${n0(r.signins)}</td><td class="n">${n0(r.visitors)}</td><td class="mut">${ago(r.lastSeen)}</td></tr>`).join("")}</tbody></table></div>
    <div class="note" style="margin-top:6px">An access ID is shared by everyone a client gives it to; "browsers" counts the different browsers that used it.</div>`;
}
function sessionsTable(rows) {
  if (!rows.length) return `<div class="empty">No sessions in this period.</div>`;
  return `<div class="tw" style="max-height:420px"><table class="t"><thead><tr><th>When</th><th>Link</th><th>Signed in</th><th class="n">Time</th><th>Where</th><th>Device</th><th>Opened</th></tr></thead><tbody>${rows.map(s => `<tr>
    <td class="mut" style="white-space:nowrap">${s.live ? `<span class="live"></span>` : ""}${esc(when(s.start))}</td><td>${esc(s.name)}</td>
    <td>${s.signedIn ? `<span class="chip ok">${esc(s.accessId ? prettyId(s.accessId) : "yes")}</span>` : `<span class="chip">no</span>`}</td>
    <td class="n">${dur(s.secs)}</td><td>${esc([s.city, s.country].filter(Boolean).join(", ") || "-")}</td><td>${esc(s.device || "-")}</td>
    <td class="small">${s.opens.length ? s.opens.map(esc).join(", ") : `<span class="dim">-</span>`}</td></tr>`).join("")}</tbody></table></div>`;
}
const tabLabel = (link, tab) => ((CMS.FEATURES[link] || []).find(f => f.key === "tab:" + tab) || {}).label || CMS.humanize(tab);
const breakdown = (title, rows, note) => `<div class="card"><h3>${esc(title)}</h3>${rows.length ? `<div class="list">${rows.map(r => `<div class="kv"><span>${esc(r.k)}</span><b class="num">${n0(r.n)}</b></div>`).join("")}</div>` : `<div class="empty" style="padding:14px">No data yet.</div>`}${note ? `<div class="note" style="margin-top:6px">${esc(note)}</div>` : ""}</div>`;

/* ============================================================= links == */
const KIND = { client: "Client view", study: "Study", tool: "Tool" };
const openUrl = (l) => l.kind === "client" ? "/" : l.path;
const previewUrl = (l) => (l.kind === "client" ? "/" : l.path) + "?cms-preview=1";
async function pageLinks(M) {
  M.innerHTML = header("Content", "Atlas links", "Every link shipped so far. Open one to edit what it shows.", can("admin") ? `<button class="btn pri" id="l-add" type="button">Add a link</button>` : "") + `<div class="card empty">Loading…</div>`;
  const [l, a] = await Promise.all([api("links"), api("analytics", { query: { days: 30 } }).catch(() => ({ links: [] }))]);
  ST.links = l.links;
  const stat = Object.fromEntries(a.links.map(x => [x.slug, x]));
  M.innerHTML = header("Content", "Atlas links", "Every link shipped so far. Open one to edit what it shows; changes go live when you publish.", can("admin") ? `<button class="btn pri" id="l-add" type="button">Add a link</button>` : "") + `
    <div class="card"><div class="tw"><table class="t"><thead><tr><th>Link</th><th>Where</th><th>Access ID</th><th>Status</th><th>Content</th><th class="n">Visitors (30 d)</th><th>Last visit</th><th></th></tr></thead><tbody>
    ${ST.links.map(x => { const s = stat[x.slug] || {}; return `<tr>
      <td><b>${esc(x.name)}</b><div class="small dim">${esc(KIND[x.kind])}${x.city ? " · " + esc(x.city) : ""}</div></td>
      <td><a href="${esc(openUrl(x))}" target="_blank" rel="noopener">${esc(x.kind === "client" ? "/ (sign in with the ID)" : x.path)} ↗</a></td>
      <td class="mono small">${esc(x.access_id || "-")}</td>
      <td>${can("admin") ? `<label class="toggle" title="Live or paused"><input type="checkbox" data-status="${esc(x.slug)}" ${x.status === "live" ? "checked" : ""}><span class="sw"></span><span>${x.status === "live" ? "Live" : "Paused"}</span></label>` : `<span class="chip ${x.status === "live" ? "ok" : "warn"}">${x.status}</span>`}</td>
      <td>${x.version ? `<span class="chip">v${x.version}</span> <span class="small mut">${esc(ago(x.published_at))}</span>` : `<span class="small mut">built-in only</span>`}${x.unpublished ? ` <span class="chip acc">unpublished changes</span>` : ""}</td>
      <td class="n">${s.activeNow ? `<span class="live"></span>` : ""}${n0(s.visitors || 0)}</td><td class="mut">${ago(s.lastSeen)}</td>
      <td style="white-space:nowrap"><a class="btn sm" href="#/content/${esc(x.slug)}">${can("editor") ? "Edit content" : "View content"}</a>${can("admin") ? ` <button class="btn sm ghost" type="button" data-edit="${esc(x.slug)}">Details</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>
    <div class="note" style="margin-top:8px">A paused link shows "This study is paused" instead of its data, within about 30 seconds. Client views on the main map open at "/" and need the client's access ID.</div></div>`;
  $$("[data-status]", M).forEach(c => c.onchange = async () => {
    const slug = c.dataset.status, status = c.checked ? "live" : "paused";
    if (status === "paused" && !(await confirmBox("Pause this link?", `<b>${esc(linkName(slug))}</b> will show a paused screen to everyone instead of its data, until you switch it back on.`, "Pause link", true))) { c.checked = true; return; }
    try { await api("links/status", { method: "POST", body: { slug, status } }); toast(`${esc(linkName(slug))} is now ${status}.`); pageLinks(M); } catch (e) { fail(e); c.checked = !c.checked; }
  });
  $$("[data-edit]", M).forEach(b => b.onclick = () => linkModal(ST.links.find(x => x.slug === b.dataset.edit), M));
  if ($("#l-add")) $("#l-add").onclick = () => linkModal(null, M);
}
function linkModal(l, M) {
  const v = l || { kind: "study", status: "live" };
  modal(`<h2>${l ? "Link details" : "Add a link"}</h2><p class="mut small">${l ? "The link id cannot change." : "Register a link that already exists on the site, so it can be tracked and edited here."}</p>
    <div class="formgrid">
      <div><label class="f">Link id</label><input class="in mono" id="m-slug" value="${esc(v.slug || "")}" ${l ? "disabled" : ""} placeholder="e.g. pune"></div>
      <div><label class="f">Name</label><input class="in" id="m-name" value="${esc(v.name || "")}"></div>
      <div><label class="f">Kind</label><select class="in" id="m-kind">${Object.entries(KIND).map(([k, t]) => `<option value="${k}" ${v.kind === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div><label class="f">Path</label><input class="in mono" id="m-path" value="${esc(v.path || "/")}" placeholder="/pune/"></div>
      <div><label class="f">Access ID</label><input class="in mono" id="m-access" value="${esc(v.access_id || "")}"></div>
      <div><label class="f">City</label><input class="in" id="m-city" value="${esc(v.city || "")}"></div>
      <div class="full"><label class="f">Notes (internal)</label><textarea class="in" id="m-notes">${esc(v.notes || "")}</textarea></div>
    </div>
    <div class="note">A new link also needs the tracking script on its page to report visits; see admin/README.md.</div>
    <div class="acts"><button class="btn" data-close>Cancel</button><button class="btn pri" id="m-save">Save</button></div>`, (m) => {
    $("#m-save", m).onclick = async () => {
      try {
        await api("links/save", { method: "POST", body: { slug: l ? l.slug : $("#m-slug", m).value.trim(), name: $("#m-name", m).value, kind: $("#m-kind", m).value, path: $("#m-path", m).value,
          access_id: $("#m-access", m).value, city: $("#m-city", m).value, notes: $("#m-notes", m).value } });
        closeModal(); toast("Saved."); ST.links = (await api("links")).links; pageLinks(M);
      } catch (e) { fail(e); }
    };
  });
}

/* ==================================================== content editor ==
   The draft is a small document of changes over the link's built-in data
   (see atlas-cms.js for how a link applies it). The editor keeps a working
   copy, saves it as the draft, and publishing copies the draft live. */
const clone = (o) => JSON.parse(JSON.stringify(o ?? {}));
const stable = (o) => JSON.stringify(o ?? {}, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v);
function prune(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === undefined || v === null || v === "") delete o[k];
    else if (typeof v === "object" && !Array.isArray(v)) { prune(v); if (!Object.keys(v).length) delete o[k]; }
  }
  return o;
}
const ensure = (o, k) => (o[k] = o[k] && typeof o[k] === "object" ? o[k] : {});
const numOrNull = (s) => { const n = parseFloat(String(s).replace(/[, ]/g, "")); return Number.isFinite(n) ? n : null; };
function newEd(slug, link, row, pr) {
  return { slug, link, row, probe: pr, draft: clone(row.draft), saved: stable(row.draft || {}), sel: null, q: "", tab: null,
    get dirty() { return stable(prune(clone(this.draft))) !== this.saved; } };
}
const propName = (id) => ((ED.probe.properties || []).find(p => p.id === id) || {}).name || id;
const bldgName = (id) => { const p = (ED.probe.properties || []).find(x => x.bldg === id); return p ? (p.building && p.building.name) || p.name : id; };
const featLabel = (k) => ((ED.probe.features || []).find(f => f.key === k) || {}).label || k;
function lockRO(el) {
  if (can("editor")) return;
  $$("input,select,textarea", el).forEach(x => { if (!x.dataset.keep) x.disabled = true; });
}
function fmtVal(v) {
  if (v == null || v === "") return `<span class="dim">-</span>`;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return esc(v.join(", "));
  const s = String(v);
  if (/^https?:\/\//.test(s)) return `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48))}${s.length > 60 ? "…" : ""} ↗</a>`;
  return s.length > 260 ? `<span title="${esc(s)}">${esc(s.slice(0, 260))}…</span>` : esc(s);
}
function provHTML(p) {
  if (!p) return "";
  const who = p.submission ? `Broker: ${esc(p.by)}` : `Set by ${esc(p.by || "admin")}`;
  return `<div class="prov">${who} · ${esc(ago(p.at))}${p.note ? ` · "${esc(p.note)}"` : ""}${p.approvedBy ? ` · approved by ${esc(p.approvedBy)}` : ""}</div>`;
}

async function pageContent(M, slug, tab) {
  let link = ST.links.find(l => l.slug === slug);
  if (!link) { ST.links = (await api("links")).links; link = ST.links.find(l => l.slug === slug); }
  if (!link) throw new Error("That link was not found, or you do not have access to it.");
  if (!ED || ED.slug !== slug) {
    M.innerHTML = header("Edit content", esc(link.name), "Reading this link's built-in data…") + `<div class="card empty">Loading…</div>`;
    const [row, pr] = await Promise.all([api("overrides", { query: { link: slug } }),
      probe(slug, link.kind).catch(e => ({ error: e.message, properties: [], features: [] }))]);
    ED = newEd(slug, link, row, pr);
  }
  ED.link = link;
  const tabs = edTabs().map(t => t[0]);
  ED.tab = tabs.includes(tab) ? tab : tabs[0];
  renderEditor(M);
}
function edTabs() {
  const P = ED.probe, d = ED.draft, c = ED.link.kind === "client", hasProps = P.properties && P.properties.length;
  const n = (o) => Object.keys(o || {}).length;
  return [
    hasProps && ["properties", "Properties and data", n(d.properties)],
    P.features && P.features.length && ["display", "What is shown", n(d.features)],
    c && hasProps && ["models", "3D models", n(d.models3d)],
    P.facts && n(P.facts) && ["facts", "Sources and facts", n(d.facts)],
    ["texts", c ? "Notice and texts" : "Notice banner", (d.banner && d.banner.text ? 1 : 0) + n(d.texts)],
    hasProps && ["additions", ED.slug === "chennai" ? "New properties" : "Broker leads", ((ED.slug === "chennai" ? d.additions : d.leads) || []).length],
    ["history", "History", 0],
    ["raw", "Raw", 0]
  ].filter(Boolean);
}
function renderEditor(M) {
  const L = ED.link;
  M.innerHTML = header("Edit content", esc(L.name),
    `<a href="${esc(openUrl(L))}" target="_blank" rel="noopener">Open the live link ↗</a> · ${esc(KIND[L.kind])}${L.access_id ? ` · access ID <span class="mono">${esc(L.access_id)}</span>` : ""}${L.status === "paused" ? ` · <span class="chip warn">paused</span>` : ""}`)
    + `<div class="bar-save" id="ed-bar"></div>`
    + (ED.probe.error ? `<div class="card note" style="margin-bottom:12px;border-color:var(--warn)">Could not read this link's built-in data (${esc(ED.probe.error)}). The notice banner and the Raw tab still work.</div>` : "")
    + `<nav class="tabs" id="ed-tabs" role="tablist" aria-label="Sections"></nav><div id="ed-body"></div>`;
  edChrome();
  const fn = { properties: tabProperties, display: tabDisplay, models: tabModels, facts: tabFacts, texts: tabTexts, additions: tabAdditions, history: tabHistory, raw: tabRaw }[ED.tab];
  fn($("#ed-body"));
}
/* The save bar and the tab counts; called after every change. */
function edChrome() {
  if (!$("#ed-bar")) return;
  const r = ED.row, dirty = ED.dirty, ro = !can("editor");
  const pending = stable(prune(clone(ED.draft))) !== stable(r.published || {});
  const st = ro ? `View only: your role cannot change content.`
    : dirty ? `<span class="dirty">Unsaved changes</span>`
    : pending ? `Draft saved ${esc(ago(r.draft_updated_at))}${r.draft_updated_by ? " by " + esc(r.draft_updated_by) : ""}. <b>Not live yet.</b> Publish to put it on the link.`
    : r.version ? `Live: version ${r.version}, published ${esc(ago(r.published_at))}${r.published_by ? " by " + esc(r.published_by) : ""}.`
    : `The link shows its built-in data. Nothing has been published from here yet.`;
  $("#ed-bar").innerHTML = `<div class="st">${st}</div>` + (ro ? "" : `
    <button class="btn ${dirty ? "pri" : ""}" id="ed-save" type="button" ${dirty ? "" : "disabled"}>Save draft</button>
    <button class="btn" id="ed-preview" type="button">Preview draft ↗</button>
    ${pending ? `<button class="btn ghost danger" id="ed-discard" type="button">Discard draft</button>` : ""}
    <button class="btn acc" id="ed-publish" type="button" ${pending ? "" : "disabled"}>Publish</button>`);
  $("#ed-tabs").innerHTML = edTabs().map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${ED.tab === k}" class="${ED.tab === k ? "on" : ""}" data-tab="${k}">${l}${n ? `<span class="ct">${n}</span>` : ""}</button>`).join("");
  $$("[data-tab]", $("#ed-tabs")).forEach(b => b.onclick = () => { location.hash = `#/content/${ED.slug}/${b.dataset.tab}`; });
  if (ro) return;
  $("#ed-save").onclick = edSave;
  $("#ed-preview").onclick = () => edPreview();
  if ($("#ed-discard")) $("#ed-discard").onclick = edDiscard;
  $("#ed-publish").onclick = edPublish;
}
async function edPreview(extra = "") {
  const w = window.open("about:blank", "_blank");
  if (ED.dirty && !(await edSave(true))) { if (w) w.close(); return; }
  const url = previewUrl(ED.link) + extra;
  if (w) { w.opener = null; w.location.href = url; } else location.href = url;
  if (ED.link.kind === "client") toast(`In the preview tab, sign in with access ID <b>${esc(ED.link.access_id || "")}</b> to see this client's view with the draft.`);
}
async function edSave(quiet) {
  const draft = prune(clone(ED.draft));
  try {
    const r = await api("overrides/draft", { method: "POST", body: { link: ED.slug, draft } });
    Object.assign(ED.row, { draft, draft_updated_at: r.draft_updated_at, draft_updated_by: ST.me.email });
    ED.saved = stable(draft);
    edChrome();
    if (quiet !== true) toast("Draft saved. It is not live until you publish.");
    return true;
  } catch (e) { fail(e); return false; }
}
async function edReload() {
  const row = await api("overrides", { query: { link: ED.slug } });
  const keep = { tab: ED.tab, sel: ED.sel, q: ED.q };
  ED = Object.assign(newEd(ED.slug, ED.link, row, ED.probe), keep);
  ST.links = (await api("links")).links;
  renderEditor($("#main"));
}
async function edDiscard() {
  if (!(await confirmBox("Discard the draft?", "The draft goes back to exactly what is live now. Changes that were saved but not published are lost.", "Discard draft", true))) return;
  try { await api("overrides/discard", { method: "POST", body: { link: ED.slug } }); toast("Draft discarded."); await edReload(); } catch (e) { fail(e); }
}
async function edPublish() {
  if (ED.dirty && !(await edSave(true))) return;
  const ch = changeList(ED.row.published || {}, ED.row.draft || {});
  modal(`<h2>Publish ${esc(ED.link.name)}</h2><p class="mut">Everyone who opens this link sees the change within a couple of minutes. You can roll back from History at any time.</p>
    ${ch.length ? `<div class="sub-card"><b class="small">What changes</b><ul class="small" style="margin:6px 0 0;padding-left:18px">${ch.slice(0, 14).map(c => `<li>${c}</li>`).join("")}${ch.length > 14 ? `<li>and ${ch.length - 14} more</li>` : ""}</ul></div>` : ""}
    <label class="f" for="pb-note">Note for the history (optional)</label><input class="in" id="pb-note" maxlength="300" placeholder="e.g. Q3 rents from broker quotes">
    <div class="acts"><button class="btn" data-close type="button">Cancel</button><button class="btn acc" id="pb-go" type="button">Publish now</button></div>`, (m) => {
    $("#pb-go", m).onclick = async (e) => {
      e.target.disabled = true;
      try {
        const r = await api("overrides/publish", { method: "POST", body: { link: ED.slug, note: $("#pb-note", m).value } });
        closeModal(); toast(`Published version ${r.version} of ${esc(ED.link.name)}.`); await edReload();
      } catch (err) { fail(err); e.target.disabled = false; }
    };
  });
}
/* A plain-language list of what differs between two documents. */
function changeList(a, b) {
  const out = [], keys = (x, y) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])];
  const ne = (x, y) => stable(x) !== stable(y);
  const ba = (a.banner || {}).text || "", bb = (b.banner || {}).text || "";
  if (ba !== bb) out.push(bb ? (ba ? "Notice banner changed" : "Notice banner added") : "Notice banner removed");
  else if (ne(a.banner, b.banner)) out.push("Notice banner style changed");
  const pa = a.properties || {}, pb = b.properties || {};
  for (const id of keys(pa, pb)) {
    const x = pa[id] || {}, y = pb[id] || {}, nm = esc(propName(id));
    if (!!x.hidden !== !!y.hidden) out.push(`${y.hidden ? "Hide" : "Show again"}: ${nm}`);
    const fk = keys(x.fields, y.fields).filter(k => ne((x.fields || {})[k], (y.fields || {})[k]));
    if (fk.length) out.push(`${nm}: ${fk.slice(0, 4).map(k => esc(CMS.humanize(k).toLowerCase())).join(", ")}${fk.length > 4 ? ` and ${fk.length - 4} more` : ""}`);
    if (ne(x.building, y.building)) out.push(`${esc(bldgName(id))}: building name or position`);
    if (ne(x.lists, y.lists)) out.push(`${nm}: facts and sources on the card`);
  }
  const fa = a.features || {}, fb = b.features || {};
  const fk = keys(fa, fb).filter(k => fa[k] !== fb[k]);
  if (fk.length) out.push(`Shown or hidden: ${fk.slice(0, 5).map(k => `${esc(featLabel(k))} ${(k in fb ? fb[k] : true) ? "on" : "off"}`).join(", ")}${fk.length > 5 ? ` and ${fk.length - 5} more` : ""}`);
  for (const id of keys(a.models3d, b.models3d)) if (ne((a.models3d || {})[id], (b.models3d || {})[id])) out.push(`3D model settings: ${esc(bldgName(id))}`);
  for (const g of keys(a.facts, b.facts)) if (ne((a.facts || {})[g], (b.facts || {})[g])) out.push(`Facts and sources: ${esc(((ED.probe.facts || {})[g] || {}).label || g)}`);
  for (const k of keys(a.texts, b.texts)) if (ne((a.texts || {})[k], (b.texts || {})[k])) out.push(`Text: ${esc((((ED.probe.texts || {})[k]) || {}).label || k)}`);
  for (const list of ["additions", "leads"]) {
    const x = a[list] || [], y = b[list] || [];
    if (ne(x, y)) out.push(list === "additions" ? `New properties: ${y.length} (was ${x.length})` : `Broker leads: ${y.length} (was ${x.length})`);
  }
  return out;
}
const touched = () => edChrome();

/* ---------------------------------------------------- properties tab -- */
function propFlags(id) {
  const d = (ED.draft.properties || {})[id] || {}, pv = Object.values(d.provenance || {});
  return { ed: !!(d.fields && Object.keys(d.fields).length) || !!d.building || !!d.lists, br: pv.some(p => p && p.submission), hid: !!d.hidden };
}
function tabProperties(B) {
  const P = ED.probe.properties;
  if (!ED.sel || !P.some(p => p.id === ED.sel)) ED.sel = P[0].id;
  B.innerHTML = `<div class="split">
    <div class="card" style="padding:8px">
      <input class="in" id="pp-q" data-keep="1" placeholder="Find a property" aria-label="Find a property" value="${esc(ED.q)}" style="margin:2px 0 6px">
      <div class="plist" id="pp-list" role="listbox" aria-label="Properties"></div>
      <div class="note" style="padding:8px 8px 2px"><span class="dotx ed" style="display:inline-block"></span> changed here &nbsp; <span class="dotx br" style="display:inline-block"></span> broker update &nbsp; <s>struck</s> hidden</div>
    </div>
    <div id="pp-main"></div></div>`;
  const list = () => {
    const q = ED.q.trim().toLowerCase();
    $("#pp-list").innerHTML = P.filter(p => !q || (p.name + " " + p.id).toLowerCase().includes(q)).map(p => {
      const f = propFlags(p.id);
      return `<button type="button" role="option" aria-selected="${p.id === ED.sel}" class="${p.id === ED.sel ? "on" : ""} ${f.hid ? "hid" : ""}" data-p="${esc(p.id)}"><span class="dotx ${f.br ? "br" : f.ed ? "ed" : ""}"></span><span class="nm">${esc(p.name)}</span></button>`;
    }).join("") || `<div class="empty">No match.</div>`;
    $$("[data-p]", $("#pp-list")).forEach(b => b.onclick = () => { ED.sel = b.dataset.p; list(); propMain(); if (innerWidth < 860) $("#pp-main").scrollIntoView({ behavior: "smooth" }); });
  };
  $("#pp-q").oninput = (e) => { ED.q = e.target.value; list(); };
  const propMain = () => renderProp($("#pp-main"), P.find(p => p.id === ED.sel), list);
  list(); propMain();
}
function fieldInput(k, orig, cur, attr) {
  const val = cur == null ? "" : Array.isArray(cur) ? cur.join(", ") : String(cur);
  if (typeof orig === "boolean") return `<select class="in" ${attr}><option value="">keep built-in</option><option value="true" ${cur === true ? "selected" : ""}>yes</option><option value="false" ${cur === false ? "selected" : ""}>no</option></select>`;
  if ((typeof orig === "string" && orig.length > 80) || val.length > 80) return `<textarea class="in" rows="3" ${attr} placeholder="keep built-in">${esc(val)}</textarea>`;
  return `<input class="in" ${attr} value="${esc(val)}" placeholder="keep built-in" ${typeof orig === "number" ? `inputmode="decimal"` : ""}>`;
}
function renderProp(C, p, relist) {
  const id = p.id, props = ED.draft.properties || {}, d = props[id] || {}, F = d.fields || {}, PV = d.provenance || {};
  const builtin = Object.keys(p.fields);
  const market = CMS.BROKER_FIELDS.filter(f => !builtin.includes(f.key));
  const other = Object.keys(F).filter(k => !builtin.includes(k) && !CMS.BROKER_FIELDS.some(f => f.key === k));
  const row = (k, label, orig) => `<tr data-k="${esc(k)}" class="${k in F ? "chg" : ""}"><td class="k">${esc(label)}<div class="key">${esc(k)}</div></td>
    <td class="o">${fmtVal(orig)}</td><td>${fieldInput(k, orig, F[k], `data-f="${esc(k)}" aria-label="${esc(label)}"`)}${provHTML(PV[k])}</td></tr>`;
  const bp = p.bldg ? ((props[p.bldg] || {}).building || {}) : null;
  C.innerHTML = `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:200px"><div style="font:500 20px/1.25 var(--serif)">${esc(p.name)}</div><div class="small dim mono">${esc(id)}</div></div>
        <label class="toggle"><input type="checkbox" id="pp-show" ${d.hidden ? "" : "checked"}><span class="sw"></span><span>${d.hidden ? "Hidden from the link" : "Shown on the link"}</span></label>
        ${Object.keys(d).length ? `<button class="btn sm ghost w" id="pp-reset" type="button">Undo all changes to this property</button>` : ""}
      </div>
      <div class="note" style="margin-top:6px">Type a new value to replace the built-in one; clear the box to go back. Source fields (ending in "source" or "Src") change the link the value cites.</div>
    </div>
    <div class="card" style="margin-bottom:12px"><h3>Data shown for this property</h3><div class="tw"><table class="ed"><thead><tr><th>Field</th><th>Built-in value</th><th>New value</th></tr></thead>
      <tbody>${builtin.map(k => row(k, CMS.humanize(k), p.fields[k])).join("")}</tbody></table></div></div>
    ${Object.keys(p.lists || {}).map(k => `<div class="card" style="margin-bottom:12px" data-list="${esc(k)}"></div>`).join("")}
    ${p.bldg ? `<div class="card" style="margin-bottom:12px"><h3>Building on the map</h3><div class="formgrid">
      <div class="full"><label class="f">Building name</label><input class="in" data-b="name" value="${esc(bp.name || "")}" placeholder="${esc(p.building.name || "")}"></div>
      <div><label class="f">Latitude</label><input class="in" data-b="lat" inputmode="decimal" value="${esc(bp.lat ?? "")}" placeholder="${esc(p.building.lat ?? "")}"></div>
      <div><label class="f">Longitude</label><input class="in" data-b="lng" inputmode="decimal" value="${esc(bp.lng ?? "")}" placeholder="${esc(p.building.lng ?? "")}"></div></div>
      <div class="note">Moves the pin and the 3D building. Leave empty to keep the built-in position.</div></div>` : ""}
    <div class="card"><h3>Latest from the market</h3>
      <div class="note" style="margin-bottom:8px">These show on the property card under "Latest from the market", labelled as broker-stated with the date. Broker updates you approve land here too.</div>
      <div class="tw"><table class="ed"><tbody>${market.map(f => row(f.key, f.label, null)).join("")}${other.map(k => row(k, CMS.humanize(k), null)).join("")}</tbody></table></div></div>`;
  const save = () => { prune(ED.draft); touched(); relist(); };
  const dp = () => ensure(ensure(ED.draft, "properties"), id);
  $("#pp-show", C).onchange = (e) => { const x = dp(); if (e.target.checked) delete x.hidden; else x.hidden = true; e.target.nextElementSibling.nextElementSibling.textContent = e.target.checked ? "Shown on the link" : "Hidden from the link"; save(); };
  if ($("#pp-reset", C)) $("#pp-reset", C).onclick = () => { delete (ED.draft.properties || {})[id]; if (p.bldg && ED.draft.properties) delete ED.draft.properties[p.bldg]; save(); renderProp(C, p, relist); };
  $$("[data-f]", C).forEach(el => {
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      const k = el.dataset.f, orig = p.fields[k], raw = el.value;
      let v;
      el.style.borderColor = "";
      if (raw.trim() === "") v = undefined;
      else if (typeof orig === "number" || (CMS.BROKER_FIELDS.find(f => f.key === k) || {}).type === "number") {
        v = numOrNull(raw);
        if (v == null) { el.style.borderColor = "var(--bad)"; return; }
      } else if (typeof orig === "boolean") v = raw === "true";
      else if (Array.isArray(orig)) v = raw.split(",").map(s => s.trim()).filter(Boolean);
      else v = raw;
      const x = dp(), f = ensure(x, "fields"), pv = ensure(x, "provenance");
      if (v === undefined) { delete f[k]; delete pv[k]; }
      else { f[k] = v; pv[k] = { by: ST.me.name || ST.me.email, at: new Date().toISOString(), admin: true }; }
      el.closest("tr").classList.toggle("chg", v !== undefined);
      save();
    });
  });
  $$("[data-list]", C).forEach(box => listEditor(box, p, box.dataset.list, dp, save));
  $$("[data-b]", C).forEach(el => el.addEventListener("input", () => {
    const b = ensure(ensure(ensure(ED.draft, "properties"), p.bldg), "building"), k = el.dataset.b, raw = el.value.trim();
    el.style.borderColor = "";
    if (!raw) delete b[k];
    else if (k === "name") b[k] = raw;
    else { const n = numOrNull(raw); if (n == null || Math.abs(n) > 180) { el.style.borderColor = "var(--bad)"; return; } b[k] = n; }
    save();
  }));
  lockRO(C);
}

/* A property's own list of sourced facts (label, value, source link). The
   first edit copies the built-in list into the draft; "Back to built-in"
   drops the copy. */
function listEditor(box, p, key, dp, save) {
  const builtin = p.lists[key];
  const draw = (focus) => {
    const own = (((ED.draft.properties || {})[p.id] || {}).lists || {})[key];
    const list = own || builtin;
    box.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><h3 style="margin:0">${key === "facts" ? "Facts on this property's card" : esc(CMS.humanize(key))}</h3>${own ? `<span class="chip acc">edited</span>` : ""}<span style="flex:1"></span>
        ${own ? `<button class="btn sm ghost w" type="button" data-lreset>Back to built-in</button>` : ""}<button class="btn sm w" type="button" data-ladd>Add a row</button></div>
      <div class="note" style="margin-bottom:4px">Each row shows on the property card with its source link. Change a source by pasting a new https:// link.</div>
      ${list.map((f, i) => `<div class="facts-row" style="grid-template-columns:1fr 2.4fr 1.6fr auto" data-i="${i}">
        <input class="in" data-lf="k" value="${esc(f.k)}" placeholder="Label" aria-label="Label">
        <textarea class="in" data-lf="v" placeholder="Value" aria-label="Value" style="min-height:42px">${esc(f.v)}</textarea>
        <div><input class="in" data-lf="src" value="${esc(f.src || "")}" placeholder="https://" aria-label="Source link">${f.src ? `<a class="small" href="${esc(f.src)}" target="_blank" rel="noopener noreferrer">open ↗</a>` : ""}</div>
        <div style="display:flex;gap:2px" class="w"><button class="btn sm ghost" type="button" data-lmv="-1" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button class="btn sm ghost" type="button" data-lmv="1" aria-label="Move down" ${i < list.length - 1 ? "" : "disabled"}>↓</button><button class="btn sm ghost danger" type="button" data-lrm aria-label="Remove">×</button></div>
      </div>`).join("") || `<div class="empty" style="padding:12px">No rows.</div>`}`;
    const mine = () => { const L = ensure(dp(), "lists"); if (!L[key]) L[key] = clone(builtin); return L[key]; };
    $$("[data-lf]", box).forEach(el => el.addEventListener("input", () => {
      const i = +el.closest("[data-i]").dataset.i, k = el.dataset.lf, v = el.value;
      el.style.borderColor = "";
      if (k === "src" && v && !/^https?:\/\/[^\s"'<>]+$/.test(v)) { el.style.borderColor = "var(--bad)"; return; }
      const wasOwn = !!(((ED.draft.properties || {})[p.id] || {}).lists || {})[key];
      const L = mine();
      if (k === "src" && !v) delete L[i].src; else L[i][k] = v;
      save();
      if (!wasOwn) { draw(); const a = box.querySelector(`[data-i="${i}"] [data-lf="${k}"]`); if (a) { a.focus(); a.selectionStart = a.selectionEnd = a.value.length; } }
    }));
    box.querySelector("[data-ladd]").onclick = () => { mine().push({ k: "", v: "" }); save(); draw(); const r = box.querySelectorAll("[data-i]"); if (r.length) r[r.length - 1].querySelector("input").focus(); };
    if (box.querySelector("[data-lreset]")) box.querySelector("[data-lreset]").onclick = () => { delete dp().lists[key]; save(); draw(); };
    $$("[data-lmv]", box).forEach(b => b.onclick = () => { const i = +b.closest("[data-i]").dataset.i, j = i + +b.dataset.lmv, L = mine(); [L[i], L[j]] = [L[j], L[i]]; save(); draw(); });
    $$("[data-lrm]", box).forEach(b => b.onclick = () => { mine().splice(+b.closest("[data-i]").dataset.i, 1); save(); draw(); });
    lockRO(box);
  };
  draw();
}

/* ------------------------------------------------------- display tab -- */
function tabDisplay(B) {
  const P = ED.probe, c = ED.link.kind === "client";
  const groups = {};
  P.features.forEach(x => (groups[x.group] = groups[x.group] || []).push(x));
  const def = (k) => (P.defaults && k in P.defaults ? P.defaults[k] : true);
  const draw = (focusKey) => {
    const f = ED.draft.features || {};
    const val = (k) => (k in f ? f[k] : def(k));
    B.innerHTML = `<div class="card note" style="margin-bottom:12px;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:240px">
      Switch off anything this client should not see. Off removes it from the link: a tab disappears, a filter or map layer is not offered, a preset is not listed, a toolbar button is hidden.
      ${c ? "Map chips are the point-of-interest buttons along the bottom of the map." : "The Overview tab always stays."}</div>
      ${Object.keys(f).length ? `<button class="btn sm w" id="ft-reset" type="button">Reset all to built-in</button>` : ""}</div>`
      + Object.entries(groups).map(([g, list]) => `<div class="card" style="margin-bottom:12px"><h3>${esc(g)}</h3><div class="feat">${list.map(x => `
        <div class="fi ${x.key in f ? "chg" : ""}"><span>${esc(x.label)}${x.key in f ? `<div class="small dim">built-in: ${def(x.key) ? "on" : "off"}</div>` : ""}</span>
        <label class="toggle"><input type="checkbox" data-feat="${esc(x.key)}" ${val(x.key) ? "checked" : ""} aria-label="${esc(x.label)}"><span class="sw"></span></label></div>`).join("")}</div></div>`).join("");
    $$("[data-feat]", B).forEach(el => el.onchange = () => {
      const k = el.dataset.feat, ff = ensure(ED.draft, "features");
      if (el.checked === def(k)) delete ff[k]; else ff[k] = el.checked;
      prune(ED.draft); touched(); draw(k);
    });
    if ($("#ft-reset", B)) $("#ft-reset", B).onclick = () => { delete ED.draft.features; touched(); draw(); };
    if (focusKey) { const el = B.querySelector(`[data-feat="${CSS.escape(focusKey)}"]`); if (el) el.focus(); }
    lockRO(B);
  };
  draw();
}

/* -------------------------------------------------------- 3D models tab -- */
const MODE_NAME = { extrusion: "Footprint block (extruded)", "gltf-model": "3D model file (.glb)", "custom-model": "Procedural tower" };
function tabModels(B) {
  const P = ED.probe;
  const blds = [...new Set(P.properties.map(p => p.bldg).filter(Boolean))];
  B.innerHTML = `<div class="card note" style="margin-bottom:12px">
      Each building on this link can be drawn as its footprint block, as a 3D model file, or as a procedural tower. To add a model: pick "3D model file", upload the .glb, set the height, then line it up.
      <b>Lining up:</b> save, then open the alignment tool. It shows sliders for rotation, scale and offsets on the live map; copy the numbers back here.
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm w" type="button" id="m3-align">Open the alignment tool ↗</button></div></div>
    <datalist id="fp-list">${(P.footprints || []).slice(0, 2000).map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <div id="m3-list"></div>`;
  $("#m3-align", B).onclick = () => edPreview("&dev=1");
  const L = $("#m3-list", B);
  L.innerHTML = blds.map(id => `<div class="card" style="margin-bottom:12px" data-m3="${esc(id)}"></div>`).join("");
  blds.forEach(id => modelCard($(`[data-m3="${CSS.escape(id)}"]`, L), id));
}
function modelCard(C, id) {
  const base = ED.probe.models[id] || null, m = (ED.draft.models3d || {})[id] || {}, t = m.transform || {}, bt = (base && base.transform) || {};
  const eff = { ...(base || {}), ...m };
  const baseText = base ? `${MODE_NAME[base.renderMode] || base.renderMode || "footprint block"}${base.heightMeters ? `, ${base.heightMeters} m` : ""}${base.modelUrl ? ", model file set" : ""}` : "set in the map code";
  const inp = (key, label, ph, extra = "") => `<div><label class="f">${label}</label><input class="in" data-mk="${key}" value="${esc(m[key] ?? "")}" placeholder="${esc(ph ?? "")}" ${extra}></div>`;
  const tin = (key, label) => `<div><label class="f">${label}</label><input class="in" data-tk="${key}" inputmode="decimal" value="${esc(t[key] ?? "")}" placeholder="${esc(bt[key] ?? (key === "uniformScale" ? 1 : 0))}"></div>`;
  C.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px">
      <div style="flex:1;min-width:200px"><div style="font:500 18px/1.25 var(--serif)">${esc(bldgName(id))}</div><div class="small mut">Built-in: ${esc(baseText)}</div></div>
      ${Object.keys(m).length ? `<span class="chip acc">changed</span><button class="btn sm ghost w" type="button" data-reset>Back to built-in</button>` : ""}</div>
    <div class="formgrid">
      <div class="full"><label class="f">How it is drawn</label><select class="in" data-mk="renderMode"><option value="">Keep built-in (${esc(MODE_NAME[base && base.renderMode] || "footprint block")})</option>${Object.entries(MODE_NAME).map(([k, v]) => `<option value="${k}" ${m.renderMode === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="full"><label class="f">Model file (.glb)</label><div style="display:flex;gap:6px;align-items:flex-start"><input class="in" data-mk="modelUrl" value="${esc(m.modelUrl || "")}" placeholder="${esc((base && base.modelUrl) || "Upload a .glb, or paste an https:// link")}" style="flex:1">
        <label class="btn w" style="margin:0">Upload<input type="file" accept=".glb,.gltf" data-up hidden></label></div>
        <div class="progress" hidden><i></i></div><div class="small err" data-warn></div></div>
      ${inp("heightMeters", "Height (metres)", base && base.heightMeters, `inputmode="decimal"`)}
      <div><label class="f">Colour</label><div style="display:flex;gap:6px"><input class="in" data-mk="color" value="${esc(m.color || "")}" placeholder="${esc((base && base.color) || "#9aa7b5")}" style="flex:1"><input type="color" data-color value="${esc(eff.color && /^#[0-9a-f]{6}$/i.test(eff.color) ? eff.color : "#9aa7b5")}" aria-label="Pick a colour" style="width:44px;height:42px;border:1px solid var(--line);border-radius:9px;padding:2px;background:#fff"></div></div>
      <div class="full"><label class="f">Footprint on the map</label><input class="in" data-mk="footprintName" list="fp-list" value="${esc(m.footprintName || "")}" placeholder="${esc((base && base.footprintName) || "Start typing a building name")}"></div>
      <div class="full row4">${tin("rotationDegrees", "Rotation (degrees)")}${tin("uniformScale", "Scale")}${tin("offsetX", "Shift east-west (m)")}${tin("offsetZ", "Shift north-south (m)")}</div>
    </div>`;
  const dm = () => ensure(ensure(ED.draft, "models3d"), id);
  const warn = () => {
    const e = { ...(base || {}), ...((ED.draft.models3d || {})[id] || {}) };
    $("[data-warn]", C).textContent = e.renderMode === "gltf-model" && !e.modelUrl ? "Add a model file, or this building will not be drawn." : "";
  };
  const changed = () => { prune(ED.draft); touched(); warn(); };
  $$("[data-mk]", C).forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
    const k = el.dataset.mk, raw = el.value.trim(), x = dm();
    el.style.borderColor = "";
    if (!raw) delete x[k];
    else if (k === "heightMeters") { const n = numOrNull(raw); if (n == null || n <= 0 || n > 900) { el.style.borderColor = "var(--bad)"; return; } x[k] = n; }
    else if (k === "color") { if (!/^#[0-9a-f]{6}$/i.test(raw)) { el.style.borderColor = "var(--bad)"; return; } x[k] = raw; $("[data-color]", C).value = raw; }
    else if (k === "modelUrl") { if (!/^(https:\/\/|\/|\.\/)[^\s"'<>]+$/.test(raw)) { el.style.borderColor = "var(--bad)"; return; } x[k] = raw; }
    else x[k] = raw;
    changed();
  }));
  $("[data-color]", C).oninput = (e) => { const i = $('[data-mk="color"]', C); i.value = e.target.value; i.dispatchEvent(new Event("input")); };
  $$("[data-tk]", C).forEach(el => el.addEventListener("input", () => {
    const k = el.dataset.tk, raw = el.value.trim(), x = ensure(dm(), "transform");
    el.style.borderColor = "";
    if (!raw) delete x[k];
    else { const n = numOrNull(raw); if (n == null) { el.style.borderColor = "var(--bad)"; return; } x[k] = n; }
    changed();
  }));
  if ($("[data-reset]", C)) $("[data-reset]", C).onclick = () => { delete (ED.draft.models3d || {})[id]; prune(ED.draft); touched(); modelCard(C, id); };
  $("[data-up]", C).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const bar = $(".progress", C), i = $(".progress i", C);
    bar.hidden = false; i.style.width = "0";
    try {
      const url = await uploadFile(ED.slug, file, (f) => { i.style.width = Math.round(f * 100) + "%"; });
      const x = dm(); x.modelUrl = url; if (!x.renderMode && !(base && base.renderMode === "gltf-model")) x.renderMode = "gltf-model";
      touched(); modelCard(C, id); toast(`Uploaded ${esc(file.name)}. Save the draft, then preview it.`);
    } catch (err) { fail(err); bar.hidden = true; }
  };
  warn();
  lockRO(C);
}
async function uploadFile(link, file, onProgress) {
  if (file.size > 100 * 1024 * 1024) throw new Error("Files are limited to 100 MB.");
  const s = await api("upload/sign", { method: "POST", body: { link, filename: file.name, size: file.size } });
  await new Promise((ok, bad) => {
    const x = new XMLHttpRequest();
    x.open(s.method || "PUT", s.uploadUrl);
    if (s.uploadUrl.startsWith("/")) { x.withCredentials = true; x.setRequestHeader("x-cms", "1"); }
    x.setRequestHeader("Content-Type", file.type || (/\.glb$/i.test(file.name) ? "model/gltf-binary" : "application/octet-stream"));
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => (x.status < 300 ? ok() : bad(new Error(`The upload was refused (${x.status}).`)));
    x.onerror = () => bad(new Error("The upload did not go through. Check the connection and try again."));
    x.send(file);
  });
  return s.publicUrl;
}

/* --------------------------------------------------------- facts tab -- */
function tabFacts(B) {
  const P = ED.probe.facts;
  const draw = () => {
    const DF = ED.draft.facts || {};
    B.innerHTML = `<div class="card note" style="margin-bottom:12px">The facts in each section of the study, with the date and source link each one cites. Edit the text, change the source, add or remove facts, or reorder them. Sources must be full https:// links.</div>`
      + Object.entries(P).map(([g, { label, items }]) => {
        const list = DF[g] || items, chg = !!DF[g];
        return `<div class="card" style="margin-bottom:12px" data-g="${esc(g)}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><h3 style="margin:0">${esc(label)}</h3>${chg ? `<span class="chip acc">edited</span>` : ""}<span style="flex:1"></span>
            ${chg ? `<button class="btn sm ghost w" type="button" data-reset>Back to built-in</button>` : ""}<button class="btn sm w" type="button" data-add>Add a fact</button></div>
          <div class="facts-row hdr small mut"><span>Label</span><span>Fact</span><span>As of</span><span>Confidence</span><span>Source link</span><span></span></div>
          ${list.map((f, i) => `<div class="facts-row" data-i="${i}">
            <input class="in" data-ff="k" value="${esc(f.k)}" placeholder="Label" aria-label="Label">
            <div><textarea class="in" data-ff="v" placeholder="The fact" aria-label="Fact">${esc(f.v)}</textarea><input class="in" data-ff="note" value="${esc(f.note || "")}" placeholder="Note (optional)" aria-label="Note" style="margin-top:4px"></div>
            <input class="in" data-ff="asOf" value="${esc(f.asOf || "")}" placeholder="e.g. Sep 2026" aria-label="As of">
            <select class="in" data-ff="conf" aria-label="Confidence">${["high", "medium", "low"].map(c => `<option ${f.conf === c ? "selected" : ""}>${c}</option>`).join("")}</select>
            <div><input class="in" data-ff="src" value="${esc(f.src || "")}" placeholder="https://" aria-label="Source link">${f.src ? `<a class="small" href="${esc(f.src)}" target="_blank" rel="noopener noreferrer">open ↗</a>` : ""}</div>
            <div style="display:flex;gap:2px" class="w"><button class="btn sm ghost" type="button" data-mv="-1" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button class="btn sm ghost" type="button" data-mv="1" aria-label="Move down" ${i < list.length - 1 ? "" : "disabled"}>↓</button><button class="btn sm ghost danger" type="button" data-rm aria-label="Remove">×</button></div>
          </div>`).join("") || `<div class="empty">No facts in this section.</div>`}</div>`;
      }).join("");
    const own = (g) => { const DF2 = ensure(ED.draft, "facts"); if (!DF2[g]) DF2[g] = clone(P[g].items); return DF2[g]; };
    $$("[data-g]", B).forEach(card => {
      const g = card.dataset.g;
      $$("[data-ff]", card).forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
        const i = +el.closest("[data-i]").dataset.i, k = el.dataset.ff, v = el.value;
        el.style.borderColor = "";
        if (k === "src" && v && !/^https?:\/\/[^\s"'<>]+$/.test(v)) { el.style.borderColor = "var(--bad)"; return; }
        const list = own(g);
        if (k === "note" && !v) delete list[i].note; else list[i][k] = v;
        if (!card.querySelector(".chip.acc")) { touched(); draw(); const again = B.querySelector(`[data-g="${CSS.escape(g)}"] [data-i="${i}"] [data-ff="${k}"]`); if (again) { again.focus(); again.selectionStart = again.selectionEnd = again.value.length; } return; }
        touched();
      }));
      card.querySelector("[data-add]").onclick = () => { own(g).push({ k: "", v: "", asOf: "", conf: "medium", src: "" }); touched(); draw(); const rows = B.querySelectorAll(`[data-g="${CSS.escape(g)}"] [data-i]`); if (rows.length) rows[rows.length - 1].querySelector("input").focus(); };
      if (card.querySelector("[data-reset]")) card.querySelector("[data-reset]").onclick = () => { delete ED.draft.facts[g]; prune(ED.draft); touched(); draw(); };
      $$("[data-mv]", card).forEach(b => b.onclick = () => { const i = +b.closest("[data-i]").dataset.i, j = i + +b.dataset.mv, list = own(g); [list[i], list[j]] = [list[j], list[i]]; touched(); draw(); });
      $$("[data-rm]", card).forEach(b => b.onclick = () => { own(g).splice(+b.closest("[data-i]").dataset.i, 1); touched(); draw(); });
    });
    lockRO(B);
  };
  draw();
}

/* --------------------------------------------------------- texts tab -- */
function tabTexts(B) {
  const T = ED.probe.texts;
  const bn = () => ED.draft.banner || {};
  B.innerHTML = `<div class="card" style="margin-bottom:12px"><h3>Notice banner</h3>
      <div class="note" style="margin-bottom:8px">A short message at the top of the link for everyone who opens it, for example "Rents updated on 7 Oct from broker quotes". Visitors can close it. Leave empty for no banner.</div>
      <textarea class="in" id="bn-text" maxlength="400" placeholder="Type the message">${esc(bn().text || "")}</textarea>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="small mut">Style</span><div class="seg" role="group" aria-label="Banner style">
        <button type="button" data-tone="info">Information</button><button type="button" data-tone="warn">Important</button></div></div>
      <div id="bn-prev" style="margin-top:12px"></div></div>
    ${T ? `<div class="card"><h3>Texts on the map</h3><div class="note" style="margin-bottom:8px">Leave a box empty to keep the built-in text.</div><div class="tw"><table class="ed"><thead><tr><th>Text</th><th>Built-in</th><th>New text</th></tr></thead><tbody>
      ${Object.entries(T).map(([k, t]) => { const cur = (ED.draft.texts || {})[k] || ""; return `<tr class="${cur ? "chg" : ""}"><td class="k">${esc(t.label)}</td><td class="o">${fmtVal(t.value)}</td><td>${t.long || (t.value || "").length > 80 ? `<textarea class="in" rows="3" data-tx="${esc(k)}" placeholder="keep built-in">${esc(cur)}</textarea>` : `<input class="in" data-tx="${esc(k)}" value="${esc(cur)}" placeholder="keep built-in">`}</td></tr>`; }).join("")}
    </tbody></table></div></div>` : ""}`;
  const prev = () => {
    const b = bn(), warn = b.tone === "warn";
    $$("[data-tone]", B).forEach(x => x.classList.toggle("on", (x.dataset.tone === "warn") === warn));
    $("#bn-prev", B).innerHTML = b.text ? `<div class="small mut" style="margin-bottom:4px">How it looks</div><div style="display:flex;gap:12px;background:${warn ? "#fff4e5" : "#faf6f0"};border:1px solid ${warn ? "rgba(183,121,31,.45)" : "rgba(60,40,25,.15)"};border-left:4px solid ${warn ? "#b7791f" : "#a3502c"};border-radius:10px;padding:10px 12px;font-size:13px;max-width:640px"><div style="flex:1">${esc(b.text)}</div><span style="color:#6c5b4d">×</span></div>` : "";
  };
  $("#bn-text", B).oninput = (e) => { const b = ensure(ED.draft, "banner"); b.text = e.target.value.trim() ? e.target.value : ""; if (!b.text) delete ED.draft.banner; prune(ED.draft); touched(); prev(); };
  $$("[data-tone]", B).forEach(x => x.onclick = () => { if (!bn().text) { toast("Type the message first."); return; } ensure(ED.draft, "banner").tone = x.dataset.tone; touched(); prev(); });
  $$("[data-tx]", B).forEach(el => el.addEventListener("input", () => {
    const t = ensure(ED.draft, "texts"), v = el.value;
    if (v.trim()) t[el.dataset.tx] = v; else delete t[el.dataset.tx];
    el.closest("tr").classList.toggle("chg", !!v.trim());
    prune(ED.draft); touched();
  }));
  prev();
  lockRO(B);
}

/* ---------------------------------------------- new properties / leads -- */
function mapsLatLng(s) {
  s = String(s || "");
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}
function tabAdditions(B) {
  const chennai = ED.slug === "chennai";
  const list = (chennai ? ED.draft.additions : ED.draft.leads) || [];
  const zones = ED.probe.zones || [];
  const zoneName = (k) => (zones.find(z => z.key === k) || {}).label || "nearest micro-market";
  B.innerHTML = `<div class="card note" style="margin-bottom:12px">${chennai
      ? "Properties added here, or approved from a broker's proposal, join the study as extra options with their own pin, distances and micro-market. They are marked as added from broker information. Add the exact position: paste a Google Maps link and the coordinates fill in."
      : "This link's map cannot draw a new property from a name and a position alone, so approved broker proposals are kept here as leads for the team. They are not shown on the live link."}
      ${chennai ? `<div style="margin-top:8px"><button class="btn sm pri w" type="button" id="ad-new">Add a property</button></div>` : ""}</div>
    ${list.length ? list.map((a, i) => `<div class="card" style="margin-bottom:10px"><div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
      <div style="flex:1;min-width:220px"><div style="font:500 18px/1.25 var(--serif)">${esc(a.name)}</div>
        <div class="small mut">${esc(a.address || "")}${chennai ? ` · ${esc(zoneName(a.micro))}` : ""} · <a href="https://www.google.com/maps?q=${+a.lat},${+a.lng}" target="_blank" rel="noopener noreferrer">${(+a.lat).toFixed(5)}, ${(+a.lng).toFixed(5)} ↗</a></div>
        ${a._provenance ? provHTML(a._provenance) : ""}</div>
      ${chennai ? `<button class="btn sm w" type="button" data-ed="${i}">Edit</button>` : ""}<button class="btn sm ghost danger w" type="button" data-rm="${i}">Remove</button></div>
      ${Object.keys(a).filter(k => !["id", "name", "address", "lat", "lng", "micro", "precision", "geoSrc"].includes(k) && k[0] !== "_").length ? `<div class="kv" style="flex-wrap:wrap;gap:4px 16px;justify-content:flex-start">${Object.entries(a).filter(([k]) => !["id", "name", "address", "lat", "lng", "micro", "precision", "geoSrc"].includes(k) && k[0] !== "_").map(([k, v]) => `<span class="small"><span class="mut">${esc(CMS.humanize(k))}:</span> ${esc(v)}</span>`).join("")}</div>` : ""}
    </div>`).join("") : `<div class="card empty">${chennai ? "No properties added yet." : "No broker leads yet."}</div>`}`;
  const key = chennai ? "additions" : "leads";
  $$("[data-rm]", B).forEach(b => b.onclick = async () => {
    const i = +b.dataset.rm, a = ED.draft[key][i];
    if (!(await confirmBox("Remove this property?", `<b>${esc(a.name)}</b> will be removed from the draft. ${chennai ? "Publish to take it off the link." : ""}`, "Remove", true))) return;
    ED.draft[key].splice(i, 1); if (!ED.draft[key].length) delete ED.draft[key];
    touched(); tabAdditions(B);
  });
  $$("[data-ed]", B).forEach(b => b.onclick = () => additionModal(ED.draft.additions[+b.dataset.ed], +b.dataset.ed, B));
  if ($("#ad-new", B)) $("#ad-new", B).onclick = () => additionModal(null, -1, B);
}
function additionModal(a, idx, B) {
  const v = a || { precision: "street" }, zones = ED.probe.zones || [];
  const extra = CMS.BROKER_FIELDS;
  modal(`<h2>${a ? "Edit property" : "Add a property"}</h2><p class="mut small">It joins the Chennai study after you publish.</p>
    <div class="formgrid">
      <div class="full"><label class="f">Name</label><input class="in" id="a-name" value="${esc(v.name || "")}" maxlength="120"></div>
      <div class="full"><label class="f">Address</label><input class="in" id="a-addr" value="${esc(v.address || "")}" maxlength="240"></div>
      <div class="full"><label class="f">Google Maps link or "lat, lng"</label><input class="in" id="a-maps" value="${esc(v.geoSrc || "")}" placeholder="Paste the link from Share in Google Maps"></div>
      <div><label class="f">Latitude</label><input class="in" id="a-lat" inputmode="decimal" value="${esc(v.lat ?? "")}"></div>
      <div><label class="f">Longitude</label><input class="in" id="a-lng" inputmode="decimal" value="${esc(v.lng ?? "")}"></div>
      <div><label class="f">Micro-market</label><select class="in" id="a-micro"><option value="">Nearest to the pin</option>${zones.map(z => `<option value="${esc(z.key)}" ${v.micro === z.key ? "selected" : ""}>${esc(z.label)}</option>`).join("")}</select></div>
      <div><label class="f">Position accuracy</label><select class="in" id="a-prec">${[["building", "Exact building"], ["street", "Street"], ["locality", "Locality only"]].map(([k, l]) => `<option value="${k}" ${v.precision === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      ${extra.map(f => `<div class="${f.type === "long" ? "full" : ""}"><label class="f">${esc(f.label)}</label>${f.type === "long" ? `<textarea class="in" data-x="${f.key}">${esc(v[f.key] || "")}</textarea>` : `<input class="in" data-x="${f.key}" value="${esc(v[f.key] ?? "")}" ${f.type === "number" ? `inputmode="decimal"` : ""}>`}</div>`).join("")}
    </div><div class="err" id="a-err"></div>
    <div class="acts"><button class="btn" data-close type="button">Cancel</button><button class="btn pri" id="a-save" type="button">${a ? "Save" : "Add to the draft"}</button></div>`, (m) => {
    $("#a-maps", m).oninput = (e) => { const p = mapsLatLng(e.target.value); if (p) { $("#a-lat", m).value = p.lat; $("#a-lng", m).value = p.lng; } };
    $("#a-save", m).onclick = () => {
      const name = $("#a-name", m).value.trim(), lat = numOrNull($("#a-lat", m).value), lng = numOrNull($("#a-lng", m).value);
      if (!name) return ($("#a-err", m).textContent = "Give the property a name.");
      if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return ($("#a-err", m).textContent = "Add the position: paste a Google Maps link or type the latitude and longitude.");
      const maps = $("#a-maps", m).value.trim();
      const o = { ...(a || {}), id: (a && a.id) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40), name, address: $("#a-addr", m).value.trim(), lat, lng,
        micro: $("#a-micro", m).value, precision: $("#a-prec", m).value, geoSrc: /^https:\/\//.test(maps) ? maps : "" };
      $$("[data-x]", m).forEach(el => { const f = extra.find(x => x.key === el.dataset.x), raw = el.value.trim(); if (!raw) delete o[f.key]; else o[f.key] = f.type === "number" && numOrNull(raw) != null ? numOrNull(raw) : raw; });
      if (!a) o._provenance = { by: ST.me.name || ST.me.email, at: new Date().toISOString(), admin: true };
      prune(o);
      const list = ED.draft.additions = ED.draft.additions || [];
      if (idx >= 0) list[idx] = o; else { if (list.some(x => x.id === o.id)) o.id += "-" + Date.now().toString(36).slice(-3); list.push(o); }
      closeModal(); touched(); tabAdditions(B); toast("Added to the draft. Save and publish to put it on the link.");
    };
  });
}

/* ------------------------------------------------------- history tab -- */
const ACTION_TEXT = { publish: "Published", rollback: "Rolled back" };
function tabHistory(B) {
  const H = ED.row.history || [];
  B.innerHTML = `<div class="card"><h3>Published versions</h3>${H.length ? `<div class="tw"><table class="t"><thead><tr><th>Version</th><th>What</th><th>By</th><th>When</th><th>Note</th><th></th></tr></thead><tbody>
    ${H.map(h => `<tr><td><span class="chip ${h.version === ED.row.version ? "dark" : ""}">v${h.version}</span>${h.version === ED.row.version ? ` <span class="small mut">live</span>` : ""}</td><td>${ACTION_TEXT[h.action] || esc(h.action)}</td><td>${esc(h.by_email || "")}</td><td class="mut">${esc(when(h.at))}</td><td class="small">${esc(h.note || "")}</td>
      <td>${can("admin") && h.version !== ED.row.version ? `<button class="btn sm" type="button" data-rb="${esc(h.id)}" data-v="${h.version}">Go back to this</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div><div class="note" style="margin-top:8px">Going back publishes that version again as a new version, and resets the draft to it.${can("admin") ? "" : " Only admins can go back."}</div>`
    : `<div class="empty">Nothing published yet. The link shows its built-in data.</div>`}</div>`;
  $$("[data-rb]", B).forEach(b => b.onclick = async () => {
    if (!(await confirmBox(`Go back to version ${b.dataset.v}?`, "That version goes live straight away, and replaces the current draft.", "Go back", true))) return;
    try { const r = await api("overrides/rollback", { method: "POST", body: { link: ED.slug, historyId: b.dataset.rb } }); toast(`Version ${b.dataset.v} is live again (now version ${r.version}).`); await edReload(); } catch (e) { fail(e); }
  });
}

/* ----------------------------------------------------------- raw tab -- */
function tabRaw(B) {
  B.innerHTML = `<div class="card"><h3>The draft as data</h3><div class="note" style="margin-bottom:8px">For the team only. This is exactly what is saved. Edit with care: the link ignores anything it does not understand.</div>
    <textarea class="in mono" id="raw" rows="22" spellcheck="false" style="font-size:12px;min-height:420px">${esc(JSON.stringify(prune(clone(ED.draft)), null, 2))}</textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri w" type="button" id="raw-apply">Use this as the draft</button><button class="btn" type="button" id="raw-copy">Copy</button>
    <button class="btn ghost" type="button" id="raw-live">Show what is live</button></div><div class="err" id="raw-err"></div></div>`;
  $("#raw-apply", B).onclick = () => {
    try { const d = JSON.parse($("#raw", B).value || "{}"); if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("The draft must be an object, in curly braces."); ED.draft = d; touched(); toast("Draft updated. Save it to keep it."); $("#raw-err", B).textContent = ""; }
    catch (e) { $("#raw-err", B).textContent = e.message; }
  };
  $("#raw-copy", B).onclick = (e) => copy($("#raw", B).value, e.target);
  $("#raw-live", B).onclick = (e) => { const live = e.target.dataset.on !== "1"; e.target.dataset.on = live ? "1" : ""; e.target.textContent = live ? "Show the draft" : "Show what is live"; $("#raw", B).value = JSON.stringify(live ? ED.row.published || {} : prune(clone(ED.draft)), null, 2); $("#raw", B).readOnly = live; };
  lockRO(B);
}

/* ============================================================ brokers == */
const brokerLinks = () => ST.links.filter(l => CMS.adapterFor(l.slug, l.kind).props);
async function pageBrokers(M) {
  const top = (sub) => header("Brokers", "Broker links", sub, `<button class="btn pri" id="bk-new" type="button">New broker link</button>`);
  M.innerHTML = top("Loading…") + `<div class="card empty">Loading…</div>`;
  const { brokers } = await api("brokers");
  M.innerHTML = top("A private link for a broker to send updates on properties they know: rents, availability, condition, new buildings. Nothing reaches a client until someone here approves it.") + `
    <div class="card">${brokers.length ? `<div class="tw"><table class="t"><thead><tr><th>Broker</th><th>Can update</th><th class="n">Sent</th><th>Last used</th><th>Expires</th><th>Link on</th><th></th></tr></thead><tbody>
    ${brokers.map(b => { const exp = b.expires_at && Date.parse(b.expires_at) < Date.now(); return `<tr>
      <td><b>${esc(b.name)}</b>${b.firm ? `<div class="small mut">${esc(b.firm)}</div>` : ""}<div class="small dim">${esc([b.phone, b.email].filter(Boolean).join(" · "))}</div></td>
      <td>${b.links.map(s => `<span class="chip" style="margin:0 3px 3px 0">${esc(linkName(s))}</span>`).join("")}<div class="small mut">${b.properties ? `${b.properties.length} chosen propert${b.properties.length === 1 ? "y" : "ies"}` : "All properties"}${b.can_propose ? " · can propose new ones" : ""}</div></td>
      <td class="n">${n0(b.submissions || 0)}</td><td class="mut">${ago(b.last_used_at)}</td>
      <td>${b.expires_at ? `<span class="${exp ? "chip bad" : "mut"}">${exp ? "expired" : esc(new Date(b.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</span>` : `<span class="dim">never</span>`}</td>
      <td><label class="toggle"><input type="checkbox" data-on="${esc(b.id)}" ${b.active ? "checked" : ""} aria-label="Link switched on"><span class="sw"></span></label></td>
      <td style="white-space:nowrap"><button class="btn sm" type="button" data-edit="${esc(b.id)}">Edit</button> <button class="btn sm ghost" type="button" data-rot="${esc(b.id)}">New link</button></td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="empty">No broker links yet. Create one, then send it to the broker on WhatsApp or email.</div>`}
    <div class="note" style="margin-top:8px">The link is shown once when you create it. If a broker loses it, use "New link": the old one stops working at once. Switching a link off blocks it without deleting what the broker already sent.</div></div>`;
  $("#bk-new").onclick = () => brokerModal(null, M);
  $$("[data-edit]", M).forEach(b => b.onclick = () => brokerModal(brokers.find(x => x.id === b.dataset.edit), M));
  $$("[data-on]", M).forEach(c => c.onchange = async () => {
    try { await api("brokers/update", { method: "POST", body: { id: c.dataset.on, only: "active", active: c.checked } }); toast(c.checked ? "Link switched on." : "Link switched off. The broker can no longer open it."); }
    catch (e) { fail(e); c.checked = !c.checked; }
  });
  $$("[data-rot]", M).forEach(b => b.onclick = async () => {
    const bk = brokers.find(x => x.id === b.dataset.rot);
    if (!(await confirmBox("Make a new link?", `The current link for <b>${esc(bk.name)}</b> stops working at once. You will get a new one to send.`, "Make a new link"))) return;
    try { const r = await api("brokers/rotate", { method: "POST", body: { id: bk.id } }); showBrokerUrl(r.broker, r.url, () => pageBrokers(M)); } catch (e) { fail(e); }
  });
}
function brokerModal(b, M) {
  const v = b || { links: [], properties: null, can_propose: true };
  const opts = brokerLinks();
  modal(`<h2>${b ? "Edit broker link" : "New broker link"}</h2><p class="mut small">The broker sees only the links and properties you pick here.</p>
    <div class="formgrid">
      <div><label class="f">Broker name</label><input class="in" id="b-name" value="${esc(v.name || "")}" maxlength="80"></div>
      <div><label class="f">Firm</label><input class="in" id="b-firm" value="${esc(v.firm || "")}" maxlength="80"></div>
      <div><label class="f">Phone (for WhatsApp)</label><input class="in" id="b-phone" value="${esc(v.phone || "")}" inputmode="tel" maxlength="40"></div>
      <div><label class="f">Email</label><input class="in" id="b-email" type="email" value="${esc(v.email || "")}" maxlength="120"></div>
    </div>
    <label class="f" style="margin-top:4px">Links they can update</label>
    <div class="sub-card" id="b-links">${opts.map(l => `<label class="check"><input type="checkbox" value="${esc(l.slug)}" ${v.links.includes(l.slug) ? "checked" : ""}>${esc(l.name)}${l.city ? ` <span class="dim small">${esc(l.city)}</span>` : ""}</label>`).join("") || `<div class="note">No links with properties.</div>`}</div>
    <label class="f">Properties</label>
    <div class="seg" role="group" style="margin-bottom:8px"><button type="button" data-scope="all" class="${v.properties ? "" : "on"}">All on those links</button><button type="button" data-scope="some" class="${v.properties ? "on" : ""}">Only some</button></div>
    <div id="b-props" class="sub-card" style="max-height:260px;overflow:auto" ${v.properties ? "" : "hidden"}></div>
    <label class="check"><input type="checkbox" id="b-prop" ${v.can_propose ? "checked" : ""}>Can propose new properties</label>
    <div style="margin-top:8px"><label class="f" for="b-exp">Link expires</label><select class="in" id="b-exp" style="max-width:260px">
      ${b && b.expires_at ? `<option value="keep" selected>Keep (${esc(new Date(b.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))})</option>` : ""}
      <option value="0" ${b && b.expires_at ? "" : "selected"}>Never</option><option value="30">In 30 days</option><option value="90">In 90 days</option><option value="180">In 6 months</option><option value="365">In a year</option></select></div>
    <div class="err" id="b-err"></div>
    <div class="acts"><button class="btn" data-close type="button">Cancel</button><button class="btn pri" id="b-save" type="button">${b ? "Save" : "Create link"}</button></div>`, (m) => {
    let scope = v.properties ? "some" : "all";
    const chosen = new Set(v.properties || []);
    const drawProps = async () => {
      const box = $("#b-props", m);
      if (scope !== "some") { box.hidden = true; return; }
      box.hidden = false;
      const links = $$("#b-links input:checked", m).map(i => i.value);
      if (!links.length) { box.innerHTML = `<div class="note">Pick a link first.</div>`; return; }
      box.innerHTML = `<div class="note">Reading properties…</div>`;
      const parts = await Promise.all(links.map(s => probe(s, (ST.links.find(l => l.slug === s) || {}).kind).then(p => [s, p]).catch(() => [s, { properties: [] }])));
      box.innerHTML = parts.map(([s, p]) => `<div class="small mut" style="margin:4px 0">${esc(linkName(s))}</div>${p.properties.map(x => `<label class="check"><input type="checkbox" value="${esc(x.id)}" ${chosen.has(x.id) ? "checked" : ""}>${esc(x.name)}</label>`).join("")}`).join("");
      $$("input", box).forEach(i => i.onchange = () => { i.checked ? chosen.add(i.value) : chosen.delete(i.value); });
    };
    $$("[data-scope]", m).forEach(x => x.onclick = () => { scope = x.dataset.scope; $$("[data-scope]", m).forEach(y => y.classList.toggle("on", y === x)); drawProps(); });
    $$("#b-links input", m).forEach(i => i.onchange = drawProps);
    drawProps();
    $("#b-save", m).onclick = async (e) => {
      const links = $$("#b-links input:checked", m).map(i => i.value);
      if (!$("#b-name", m).value.trim()) return ($("#b-err", m).textContent = "Add the broker's name.");
      if (!links.length) return ($("#b-err", m).textContent = "Pick at least one link.");
      const visible = new Set($$("#b-props input", m).map(i => i.value));
      const props = scope === "some" ? [...chosen].filter(id => visible.has(id)) : null;
      if (scope === "some" && !props.length) return ($("#b-err", m).textContent = "Pick at least one property, or choose all.");
      const exp = $("#b-exp", m).value;
      const body = { name: $("#b-name", m).value.trim(), firm: $("#b-firm", m).value.trim(), phone: $("#b-phone", m).value.trim(), email: $("#b-email", m).value.trim(),
        links, properties: props, can_propose: $("#b-prop", m).checked, ...(exp === "keep" ? { expires_at: b.expires_at } : { expires_days: +exp, expires_at: null }) };
      e.target.disabled = true;
      try {
        if (b) { await api("brokers/update", { method: "POST", body: { ...body, id: b.id, active: b.active } }); closeModal(); toast("Saved."); pageBrokers(M); }
        else { const r = await api("brokers/create", { method: "POST", body }); showBrokerUrl(r.broker, r.url, () => pageBrokers(M)); }
      } catch (err) { $("#b-err", m).textContent = err.message; e.target.disabled = false; }
    };
  });
}
function showBrokerUrl(b, url, after) {
  const msg = `Hi ${b.name.split(" ")[0]}, this is your private Autopilot link to share updates on office properties you know (rents, availability, new buildings). It works on your phone, no sign-up needed: ${url}`;
  const wa = `https://wa.me/${(b.phone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
  const mail = `mailto:${encodeURIComponent(b.email || "")}?subject=${encodeURIComponent("Your Autopilot broker link")}&body=${encodeURIComponent(msg)}`;
  modal(`<h2>Send this link to ${esc(b.name)}</h2><p class="mut">Copy it now. For safety it is shown only this once; if it is lost, make a new one.</p>
    <div class="urlbox"><span style="flex:1">${esc(url)}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" type="button" id="u-copy">Copy link</button>
      <a class="btn" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>${b.email ? `<a class="btn" href="${esc(mail)}">Send by email</a>` : ""}<button class="btn ghost" type="button" id="u-msg">Copy with message</button></div>
    <div class="note" style="margin-top:10px">Anyone with this link can send updates as ${esc(b.name)}. They cannot see other brokers, analytics or anything unpublished.</div>
    <div class="acts"><button class="btn" data-close type="button">Done</button></div>`, (m) => {
    $("#u-copy", m).onclick = (e) => copy(url, e.target);
    $("#u-msg", m).onclick = (e) => copy(msg, e.target);
  });
  const h = () => { $("#modal").removeEventListener("click", h2); after && after(); };
  const h2 = (e) => { if (e.target.id === "modal" || e.target.closest("[data-close]")) h(); };
  $("#modal").addEventListener("click", h2);
}

/* ============================================================== inbox == */
const INBOX = { status: "pending" };
async function pageInbox(M) {
  const tabs = [["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]];
  const top = header("Brokers", "Inbox", "Updates and new properties sent from broker links. Approving puts the change into that link's draft; it goes live when the draft is published.",
    `<div class="seg" role="group" aria-label="Show">${tabs.map(([k, l]) => `<button type="button" data-st="${k}" class="${INBOX.status === k ? "on" : ""}">${l}</button>`).join("")}</div>`);
  M.innerHTML = top + `<div class="card empty">Loading…</div>`;
  const { submissions } = await api("submissions", { query: { status: INBOX.status } });
  const slugs = [...new Set(submissions.map(s => s.link_slug))];
  const probes = Object.fromEntries(await Promise.all(slugs.map(s => probe(s, (ST.links.find(l => l.slug === s) || {}).kind).then(p => [s, p]).catch(() => [s, { properties: [] }]))));
  const rows = Object.fromEntries(await Promise.all(slugs.map(s => api("overrides", { query: { link: s } }).then(r => [s, r]).catch(() => [s, {}]))));
  M.innerHTML = top + (submissions.length ? submissions.map(s => subCard(s, probes[s.link_slug], rows[s.link_slug])).join("") : `<div class="card empty">${INBOX.status === "pending" ? "Nothing waiting. New broker updates appear here." : "Nothing here."}</div>`);
  $$("[data-st]", M).forEach(b => b.onclick = () => { INBOX.status = b.dataset.st; pageInbox(M); });
  $$("[data-sub]", M).forEach(card => wireSub(card, submissions.find(s => s.id === card.dataset.sub), M));
  if (INBOX.status === "pending" && ST.pending !== submissions.length) { ST.pending = submissions.length; renderNav(); }
}
function subCard(s, pr, row) {
  const p = (pr.properties || []).find(x => x.id === s.property_id);
  const live = ((row.published || {}).properties || {})[s.property_id] || {};
  const pend = s.status === "pending";
  const chip = { pending: "warn", approved: "ok", rejected: "bad" }[s.status];
  const fieldType = (k) => (p && typeof p.fields[k] === "number") || (CMS.BROKER_FIELDS.find(f => f.key === k) || {}).type === "number" ? "number" : "text";
  let body;
  if (s.kind === "update") {
    const F = (s.payload && s.payload.fields) || {};
    body = `<div class="tw"><table class="ed diff"><thead><tr><th>Field</th><th>On the link now</th><th>Broker says</th></tr></thead><tbody>${Object.entries(F).map(([k, v]) => {
      const cur = (live.fields || {})[k] ?? (p ? p.fields[k] : undefined);
      return `<tr><td class="k">${esc(CMS.humanize(k))}</td><td class="o cur">${fmtVal(cur)}</td><td class="new">${pend ? `<input class="in" data-k="${esc(k)}" data-t="${fieldType(k)}" value="${esc(v)}">` : esc(v)}</td></tr>`;
    }).join("")}</tbody></table></div>${pend ? `<div class="note">You can correct a value before approving. Clear a box to leave that value out.</div>` : ""}`;
  } else {
    const P = (s.payload && s.payload.property) || {};
    const keys = ["name", "address", "lat", "lng", "mapsLink", ...Object.keys(P).filter(k => !["name", "address", "lat", "lng", "mapsLink", "micro"].includes(k))];
    const ll = mapsLatLng(P.mapsLink || "") || {};
    body = `<div class="formgrid">${keys.map(k => { const val = P[k] ?? (k === "lat" ? ll.lat : k === "lng" ? ll.lng : ""); return `<div class="${["name", "address", "mapsLink", "marketNote"].includes(k) ? "full" : ""}"><label class="f">${esc(k === "mapsLink" ? "Google Maps link" : CMS.humanize(k))}</label>${pend ? `<input class="in" data-k="${esc(k)}" data-t="${["lat", "lng"].includes(k) || (CMS.BROKER_FIELDS.find(f => f.key === k) || {}).type === "number" ? "number" : "text"}" value="${esc(val ?? "")}">` : `<div>${fmtVal(val)}</div>`}</div>`; }).join("")}
      ${pend && s.link_slug === "chennai" && pr.zones ? `<div><label class="f">Micro-market</label><select class="in" data-k="micro" data-t="text"><option value="">Nearest to the pin</option>${pr.zones.map(z => `<option value="${esc(z.key)}">${esc(z.label)}</option>`).join("")}</select></div>` : ""}</div>
      ${pend ? `<div class="note">${s.link_slug === "chennai" ? "Approving adds it to the Chennai draft as a new option." : "This link cannot draw new properties, so approving keeps it as a lead under Broker leads in the content editor."} A position (latitude and longitude) is needed; paste a Google Maps link to fill it.</div>` : ""}`;
  }
  return `<div class="card" style="margin-bottom:12px" data-sub="${esc(s.id)}">
    <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px">
      <div style="flex:1;min-width:240px"><div class="small mut">${esc(linkName(s.link_slug))} · ${s.kind === "update" ? "Update" : "New property"}</div>
        <div style="font:500 19px/1.25 var(--serif)">${esc(s.kind === "update" ? (p ? p.name : s.property_id) : ((s.payload || {}).property || {}).name || "New property")}</div>
        <div class="small">From <b>${esc(s.broker_name || "a broker")}</b> · ${esc(when(s.created_at))}</div></div>
      <span class="chip ${chip}">${s.status === "pending" ? "waiting" : s.status}</span></div>
    ${body}
    ${s.note || s.source_note ? `<div class="sub-card" style="margin-top:10px">${s.note ? `<div><span class="mut small">Broker's note:</span> ${esc(s.note)}</div>` : ""}${s.source_note ? `<div><span class="mut small">How they know:</span> ${esc(s.source_note)}</div>` : ""}</div>` : ""}
    ${pend ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px"><input class="in" data-note placeholder="Note to keep with the decision (optional)" style="flex:1;min-width:200px;margin:0"><button class="btn danger" type="button" data-rej>Reject</button><button class="btn acc" type="button" data-ok>Approve into draft</button></div>`
      : `<div class="small mut" style="margin-top:8px">${s.status === "approved" ? "Approved" : "Rejected"} by ${esc(s.reviewed_by || "")} · ${esc(when(s.reviewed_at))}${s.review_note ? ` · "${esc(s.review_note)}"` : ""}${s.status === "approved" ? ` · <a href="#/content/${esc(s.link_slug)}/${s.kind === "update" ? "properties" : "additions"}">open in the editor</a>` : ""}</div>`}
  </div>`;
}
function wireSub(card, s, M) {
  if (!card.querySelector("[data-ok]")) return;
  const maps = card.querySelector('[data-k="mapsLink"]');
  if (maps) maps.addEventListener("input", () => { const p = mapsLatLng(maps.value); if (p) { card.querySelector('[data-k="lat"]').value = p.lat; card.querySelector('[data-k="lng"]').value = p.lng; } });
  const review = async (action, btn) => {
    const fields = {};
    let bad = false;
    $$("[data-k]", card).forEach(el => {
      const raw = el.value.trim(); el.style.borderColor = "";
      if (!raw || el.dataset.k === "mapsLink") return;
      if (el.dataset.t === "number") { const n = numOrNull(raw); if (n == null) { el.style.borderColor = "var(--bad)"; bad = true; return; } fields[el.dataset.k] = n; }
      else fields[el.dataset.k] = raw;
    });
    if (maps && /^https:\/\//.test(maps.value.trim())) fields.geoSrc = maps.value.trim();
    if (action === "approve" && bad) return toast("Fix the values marked in red first.", true);
    if (action === "approve" && !Object.keys(fields).length) return toast("Nothing left to approve. Reject it instead.", true);
    btn.disabled = true;
    try {
      await api("submissions/review", { method: "POST", body: { id: s.id, action, note: card.querySelector("[data-note]").value, fields: action === "approve" ? fields : undefined } });
      toast(action === "approve" ? `Added to the draft of ${esc(linkName(s.link_slug))}. <a href="#/content/${esc(s.link_slug)}" style="color:#f2c9a8">Review and publish</a>` : "Rejected.");
      pageInbox(M);
    } catch (e) { fail(e); btn.disabled = false; }
  };
  card.querySelector("[data-ok]").onclick = (e) => review("approve", e.target);
  card.querySelector("[data-rej]").onclick = (e) => review("reject", e.target);
}

/* =============================================================== team == */
async function pageTeam(M) {
  const top = header("Settings", "Team", "Who can sign in to this admin panel, and what they can do.", `<button class="btn pri" id="u-new" type="button">Add a person</button>`);
  M.innerHTML = top + `<div class="card empty">Loading…</div>`;
  const { users } = await api("users");
  M.innerHTML = top + `<div class="card"><div class="tw"><table class="t"><thead><tr><th>Person</th><th>Role</th><th>Links</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead><tbody>
    ${users.map(u => `<tr><td><b>${esc(u.name || "-")}</b>${u.id === ST.me.id ? ` <span class="chip">you</span>` : ""}<div class="small mut">${esc(u.email)}</div></td>
      <td><span class="chip ${u.role === "owner" ? "dark" : u.role === "admin" ? "acc" : ""}">${esc(u.role)}</span></td>
      <td class="small">${u.links && u.links.length ? u.links.map(s => esc(linkName(s))).join(", ") : "All links"}</td>
      <td class="mut">${ago(u.last_login_at)}</td><td>${u.active ? `<span class="chip ok">active</span>` : `<span class="chip bad">switched off</span>`}</td>
      <td style="white-space:nowrap">${u.role !== "owner" || ST.me.role === "owner" ? `<button class="btn sm" type="button" data-edit="${esc(u.id)}">Edit</button>${u.id !== ST.me.id ? ` <button class="btn sm ghost" type="button" data-out="${esc(u.id)}">Sign out everywhere</button> <button class="btn sm ghost danger" type="button" data-del="${esc(u.id)}">Remove</button>` : ""}` : ""}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="note" style="margin-top:10px">${["viewer", "editor", "admin", "owner"].map(r => esc(ROLE_TEXT[r])).join("<br>")}</div></div>`;
  $("#u-new").onclick = () => userModal(null, M);
  $$("[data-edit]", M).forEach(b => b.onclick = () => userModal(users.find(u => u.id === b.dataset.edit), M));
  $$("[data-out]", M).forEach(b => b.onclick = async () => {
    const u = users.find(x => x.id === b.dataset.out);
    try { await api("users/signout", { method: "POST", body: { id: u.id } }); toast(`${esc(u.name || u.email)} is signed out on every device.`); } catch (e) { fail(e); }
  });
  $$("[data-del]", M).forEach(b => b.onclick = async () => {
    const u = users.find(x => x.id === b.dataset.del);
    if (!(await confirmBox("Remove this person?", `<b>${esc(u.name || u.email)}</b> can no longer sign in. Their past changes stay in the audit log.`, "Remove", true))) return;
    try { await api("users/delete", { method: "POST", body: { id: u.id } }); toast("Removed."); pageTeam(M); } catch (e) { fail(e); }
  });
}
function userModal(u, M) {
  const v = u || { role: "editor", links: null, active: true };
  const roles = ROLES.filter(r => r !== "owner" || ST.me.role === "owner");
  modal(`<h2>${u ? "Edit " + esc(u.name || u.email) : "Add a person"}</h2>
    <div class="formgrid">
      <div><label class="f">Name</label><input class="in" id="u-name" value="${esc(v.name || "")}" maxlength="80"></div>
      <div><label class="f">Email</label><input class="in" id="u-email" type="email" value="${esc(v.email || "")}" ${u ? "disabled" : ""} maxlength="200"></div>
      <div class="full"><label class="f">Role</label><select class="in" id="u-role" ${u && u.id === ST.me.id ? "disabled" : ""}>${roles.map(r => `<option value="${r}" ${v.role === r ? "selected" : ""}>${esc(ROLE_TEXT[r])}</option>`).join("")}</select></div>
    </div>
    <label class="f">Links they can see</label>
    <div class="seg" role="group" style="margin-bottom:8px"><button type="button" data-all="1" class="${v.links && v.links.length ? "" : "on"}">All links</button><button type="button" data-all="0" class="${v.links && v.links.length ? "on" : ""}">Only some</button></div>
    <div class="sub-card" id="u-links" ${v.links && v.links.length ? "" : "hidden"}>${ST.links.map(l => `<label class="check"><input type="checkbox" value="${esc(l.slug)}" ${(v.links || []).includes(l.slug) ? "checked" : ""}>${esc(l.name)}</label>`).join("")}</div>
    <label class="f" for="u-pw">${u ? "New password (leave empty to keep)" : "Password"}</label>
    <div style="display:flex;gap:6px"><input class="in" id="u-pw" autocomplete="new-password" style="flex:1"><button class="btn" type="button" id="u-gen" style="margin-bottom:12px">Make one</button></div>
    ${u && u.id !== ST.me.id ? `<label class="check"><input type="checkbox" id="u-active" ${v.active ? "checked" : ""}>Can sign in</label>` : ""}
    <div class="err" id="u-err"></div>
    <div class="acts"><button class="btn" data-close type="button">Cancel</button><button class="btn pri" id="u-save" type="button">${u ? "Save" : "Add"}</button></div>`, (m) => {
    let all = !(v.links && v.links.length);
    $$("[data-all]", m).forEach(b => b.onclick = () => { all = b.dataset.all === "1"; $$("[data-all]", m).forEach(x => x.classList.toggle("on", x === b)); $("#u-links", m).hidden = all; });
    $("#u-gen", m).onclick = () => { $("#u-pw", m).value = randomPassword(); };
    $("#u-save", m).onclick = async (e) => {
      const links = all ? null : $$("#u-links input:checked", m).map(i => i.value);
      if (!all && !links.length) return ($("#u-err", m).textContent = "Pick at least one link, or choose all links.");
      const pw = $("#u-pw", m).value;
      const body = { id: u ? u.id : undefined, name: $("#u-name", m).value.trim(), email: $("#u-email", m).value.trim(), role: $("#u-role", m).value, links, password: pw || undefined,
        active: $("#u-active", m) ? $("#u-active", m).checked : true };
      e.target.disabled = true;
      try {
        await api("users/save", { method: "POST", body });
        if (pw) {
          const email = u ? u.email : body.email;
          modal(`<h2>Send these to ${esc(body.name || email)}</h2><p class="mut">The password is not shown again.</p>
            <div class="urlbox" style="flex-direction:column;align-items:flex-start"><div>Address: ${esc(location.origin)}/admin/</div><div>Email: ${esc(email)}</div><div>Password: ${esc(pw)}</div></div>
            <div class="note" style="margin-top:8px">Ask them to change the password under Account after signing in.</div>
            <div class="acts"><button class="btn" type="button" id="u-cp">Copy</button><button class="btn pri" data-close type="button">Done</button></div>`, (m2) => {
            $("#u-cp", m2).onclick = (ev) => copy(`Address: ${location.origin}/admin/\nEmail: ${email}\nPassword: ${pw}`, ev.target);
          });
        } else { closeModal(); toast("Saved."); }
        pageTeam(M);
      } catch (err) { $("#u-err", m).textContent = err.message; e.target.disabled = false; }
    };
  });
}

/* ============================================================== audit == */
const AUDIT_TEXT = {
  setup: "Set up the admin panel", login: "Signed in", password: "Changed their password", "link.save": "Saved link details", "link.status": "Changed link status",
  publish: "Published", "draft.discard": "Discarded a draft", rollback: "Went back to an earlier version", "user.create": "Added a person", "user.update": "Changed a person",
  "user.signout": "Signed a person out everywhere", "user.delete": "Removed a person", "broker.create": "Created a broker link", "broker.update": "Changed a broker link",
  "broker.rotate": "Made a new broker link", "submission.approve": "Approved a broker update", "submission.reject": "Rejected a broker update", upload: "Uploaded a file"
};
function auditDetail(a) {
  const d = a.detail || {};
  if (a.action === "publish") return `version ${d.version}${d.note ? ` · ${esc(d.note)}` : ""}`;
  if (a.action === "rollback") return `to version ${d.to} (now ${d.version})`;
  if (a.action === "link.status") return esc(d.status);
  if (a.action === "upload") return esc(String(d.path || "").split("/").pop());
  if (a.action.startsWith("submission.")) return esc(d.property || (d.kind === "new_property" ? "new property" : ""));
  if (a.action.startsWith("user.")) return esc([d.role, d.active === false ? "switched off" : "", d.password ? "new password" : ""].filter(Boolean).join(", "));
  if (a.action.startsWith("broker.") && d.links) return esc(d.links.map(linkName).join(", "));
  if (a.action === "broker.update" && "active" in d && Object.keys(d).length === 1) return d.active ? "switched on" : "switched off";
  return "";
}
async function pageAudit(M) {
  M.innerHTML = header("Settings", "Audit log", "The last 200 actions in this admin panel.") + `<div class="card empty">Loading…</div>`;
  const { audit } = await api("audit");
  M.innerHTML = header("Settings", "Audit log", "The last 200 actions in this admin panel.") + `<div class="card">${audit.length ? `<div class="tw"><table class="t"><thead><tr><th>When</th><th>Who</th><th>What</th><th>On</th><th>Detail</th></tr></thead><tbody>
    ${audit.map(a => `<tr><td class="mut" style="white-space:nowrap">${esc(when(a.at))}</td><td>${esc(a.by_email || "-")}</td><td>${esc(AUDIT_TEXT[a.action] || a.action)}</td>
      <td>${esc(ST.links.some(l => l.slug === a.target) ? linkName(a.target) : a.target || "")}</td><td class="small mut">${auditDetail(a)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">Nothing yet.</div>`}</div>`;
}

/* ============================================================ account == */
function pageAccount(M) {
  let counting = false;
  try { counting = localStorage.getItem("atlas-team") !== "1"; } catch (e) {}
  M.innerHTML = header("Settings", "Your account", "") + `<div class="grid g2">
    <div class="card"><h3>You</h3><div class="kv"><span class="mut">Name</span><b>${esc(ST.me.name || "-")}</b></div><div class="kv"><span class="mut">Email</span><b>${esc(ST.me.email)}</b></div>
      <div class="kv"><span class="mut">Role</span><b>${esc(ST.me.role)}</b></div><div class="note" style="margin-top:6px">${esc(ROLE_TEXT[ST.me.role])}</div>
      <h3 style="margin-top:18px">This browser</h3>
      <label class="toggle"><input type="checkbox" id="ac-count" ${counting ? "checked" : ""}><span class="sw"></span><span>Count my own visits to the Atlas links</span></label>
      <div class="note" style="margin-top:6px">Off by default once you sign in here, so the team's own checks do not inflate the numbers. Applies to this browser only.</div>
      <div style="margin-top:18px"><button class="btn" type="button" id="ac-out">Sign out</button></div></div>
    <div class="card"><h3>Change password</h3><form id="ac-pw">
      <label class="f" for="ac-cur">Current password</label><input class="in" id="ac-cur" type="password" autocomplete="current-password" required>
      <label class="f" for="ac-new">New password (10+ characters, letters and a number)</label><input class="in" id="ac-new" type="password" autocomplete="new-password" required>
      <label class="f" for="ac-rep">New password again</label><input class="in" id="ac-rep" type="password" autocomplete="new-password" required>
      <button class="btn pri" type="submit">Change password</button><div class="err" id="ac-err"></div>
      <div class="note">Changing it signs you out on your other devices.</div></form></div></div>`;
  $("#ac-count").onchange = (e) => {
    try { if (e.target.checked) { localStorage.removeItem("atlas-team"); localStorage.setItem("atlas-team-count", "1"); } else { localStorage.setItem("atlas-team", "1"); localStorage.removeItem("atlas-team-count"); } } catch (err) {}
    toast(e.target.checked ? "Your visits from this browser now count." : "Your visits from this browser are not counted.");
  };
  $("#ac-out").onclick = signOut;
  $("#ac-pw").onsubmit = async (e) => {
    e.preventDefault();
    if ($("#ac-new").value !== $("#ac-rep").value) return ($("#ac-err").textContent = "The two new passwords do not match.");
    try { await api("auth/password", { method: "POST", body: { current: $("#ac-cur").value, next: $("#ac-new").value } }); toast("Password changed."); e.target.reset(); $("#ac-err").textContent = ""; }
    catch (err) { $("#ac-err").textContent = err.message; }
  };
}

/* ---------------------------------------------------------------- go --- */
setInterval(() => { if (ST.me && !document.hidden && /^(#\/?(dashboard)?)?$/.test(location.hash) && !$("#modal").classList.contains("on")) pageDashboard($("#main")).catch(() => {}); }, 60000);
setInterval(() => { if (ST.me && !document.hidden) refreshPending(); }, 120000);
init();
