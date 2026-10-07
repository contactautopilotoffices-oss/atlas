/* ============================================================================
   ATLAS broker portal · /broker/#t=<token>

   A broker opens their private link, picks a property and sends what they
   know (rent, availability, condition, a note), or proposes a new building.
   Everything lands in the admin Inbox; nothing reaches a client until the
   Autopilot team approves and publishes it.

   The token comes in the link's #fragment, so it never reaches server logs
   or referrers. It is kept on this device (localStorage) and the fragment is
   removed from the address bar straight away.
   ============================================================================ */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CMS = window.AtlasCMS;
const KEY = "atlas-broker-token";
const S = { token: null, me: null, link: null, probes: {}, q: "" };

function readToken() {
  const m = location.hash.match(/[#&]t=([A-Za-z0-9_-]{20,100})/);
  if (m) {
    try { localStorage.setItem(KEY, m[1]); } catch (e) {}
    history.replaceState(null, "", location.pathname + location.search);
    return m[1];
  }
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}
async function api(route, body) {
  const r = await fetch(`/api/cms?r=${route}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { "x-broker-token": S.token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let j = {};
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const e = new Error(j.error || `Something went wrong (${r.status}). Please try again.`); e.status = r.status; throw e; }
  return j;
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500);
}
function probe(slug, kind) {
  if (S.probes[slug]) return S.probes[slug];
  S.probes[slug] = new Promise((ok, bad) => {
    const f = document.createElement("iframe");
    f.hidden = true; f.setAttribute("aria-hidden", "true");
    f.src = `/admin/probe.html?link=${encodeURIComponent(slug)}&kind=${encodeURIComponent(kind || "")}`;
    const t = setTimeout(() => { done(); bad(new Error("Could not load the property list. Please refresh.")); }, 20000);
    const on = (e) => { if (e.origin === location.origin && e.data && e.data.type === "atlas-probe" && e.data.link === slug) { done(); e.data.data.error ? bad(new Error(e.data.data.error)) : ok(e.data.data); } };
    const done = () => { clearTimeout(t); removeEventListener("message", on); setTimeout(() => f.remove(), 0); };
    addEventListener("message", on);
    document.body.appendChild(f);
  });
  S.probes[slug].catch(() => { delete S.probes[slug]; });
  return S.probes[slug];
}
const ago = (iso) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
function mapsLatLng(s) {
  s = String(s || "");
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}

/* ------------------------------------------------------------ screens -- */
function fatal(title, text) {
  $("#who").textContent = "";
  $("#main").innerHTML = `<div class="card" style="margin-top:20px;text-align:center;padding:28px 18px"><h1 style="font-size:24px">${esc(title)}</h1><p class="mut" style="margin:0">${esc(text)}</p></div>`;
}
async function start() {
  S.token = readToken();
  if (!S.token) return fatal("This link is incomplete", "Open the link exactly as Autopilot sent it to you, including everything after the # sign.");
  try { S.me = await api("broker/me"); }
  catch (e) {
    if (e.status === 401) { try { localStorage.removeItem(KEY); } catch (x) {} return fatal("This link is not working", e.message); }
    return fatal("Something went wrong", e.message);
  }
  const live = S.me.links.filter(l => l.status !== "paused");
  if (!S.link || !live.some(l => l.slug === S.link)) S.link = (live[0] || S.me.links[0] || {}).slug;
  $("#who").innerHTML = `${esc(S.me.broker.name)}${S.me.broker.firm ? `<br><span style="opacity:.7">${esc(S.me.broker.firm)}</span>` : ""}`;
  render();
}
function subLine(p) {
  const f = p.fields || {};
  return f.address || f.locality || f.sheetMicro || "";
}
async function render() {
  const me = S.me, B = me.broker, L = me.links;
  const first = String(B.name || "").split(" ")[0];
  const cur = L.find(l => l.slug === S.link);
  $("#main").innerHTML = `<h1>Hi ${esc(first)}</h1>
    <p class="lead">Pick a property you have news on: rent, availability, condition, anything a tenant should know. The Autopilot team checks every update before it reaches a client.</p>
    ${L.length > 1 ? `<div class="chips" role="group" aria-label="Area">${L.map(l => `<button type="button" data-link="${esc(l.slug)}" class="${l.slug === S.link ? "on" : ""}">${esc(l.label)}</button>`).join("")}</div>` : ""}
    <div id="plist"><div class="empty">Loading properties…</div></div>
    ${B.can_propose ? `<button class="new" type="button" id="propose" style="margin-top:12px"><span style="font-size:26px;color:var(--acc)">+</span><span><b>Know a building that should be here?</b><span class="small mut">Propose it, with what you know about it.</span></span></button>` : ""}
    <h2>What you have sent</h2>
    <div class="card" id="sent">${sentHTML()}</div>
    <div class="foot">This link is personal to you. If a colleague wants to help, ask Autopilot for their own link.${B.expires_at ? `<br>It works until ${esc(new Date(B.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}.` : ""}
      <br><button type="button" id="forget" style="border:0;background:none;color:var(--acc);text-decoration:underline;cursor:pointer;font-size:12.5px;margin-top:6px">Forget this link on this device</button></div>`;
  $$("[data-link]").forEach(b => b.onclick = () => { S.link = b.dataset.link; S.q = ""; render(); });
  if ($("#propose")) $("#propose").onclick = () => proposeSheet();
  $("#forget").onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} fatal("Forgotten on this device", "Open the link from your messages again whenever you want to send an update."); };
  if (!cur) { $("#plist").innerHTML = `<div class="card empty">No properties are open to you at the moment.</div>`; return; }
  if (cur.status === "paused") { $("#plist").innerHTML = `<div class="card empty">This area is paused for now. Please check back later.</div>`; return; }
  let pr;
  try { pr = await probe(cur.slug, cur.kind); } catch (e) { $("#plist").innerHTML = `<div class="card empty">${esc(e.message)}</div>`; return; }
  if (S.link !== cur.slug) return;
  pr.__props = Object.fromEntries((pr.properties || []).map(p => [p.id, p.name]));
  $("#sent").innerHTML = sentHTML();
  const scope = B.properties && B.properties.length ? new Set(B.properties) : null;
  const props = (pr.properties || []).filter(p => !scope || scope.has(p.id));
  const sent = {};
  me.submissions.filter(s => s.link_slug === cur.slug && s.property_id).forEach(s => { sent[s.property_id] = (sent[s.property_id] || 0) + 1; });
  const draw = () => {
    const q = S.q.trim().toLowerCase();
    const list = props.filter(p => !q || (p.name + " " + subLine(p)).toLowerCase().includes(q));
    $("#plist-items").innerHTML = list.map(p => `<button class="prop" type="button" data-p="${esc(p.id)}"><span style="min-width:0"><span class="nm">${esc(p.name)}</span><br><span class="sb">${esc(subLine(p))}</span></span>${sent[p.id] ? `<span class="ct">${sent[p.id]} sent</span>` : ""}<span class="go" aria-hidden="true">›</span></button>`).join("")
      || `<div class="card empty">No property matches "${esc(S.q)}".</div>`;
    $$("[data-p]", $("#plist-items")).forEach(b => b.onclick = () => updateSheet(props.find(p => p.id === b.dataset.p), cur));
  };
  $("#plist").innerHTML = `${props.length > 6 ? `<input class="in" id="q" type="search" placeholder="Find a property" aria-label="Find a property" value="${esc(S.q)}">` : ""}<div class="props" id="plist-items"></div>`;
  if ($("#q")) $("#q").oninput = (e) => { S.q = e.target.value; draw(); };
  draw();
}
function sentHTML() {
  const subs = S.me.submissions;
  if (!subs.length) return `<div class="empty" style="padding:8px">Nothing yet. Your updates will show here with their status.</div>`;
  const label = { pending: "being checked", approved: "accepted", rejected: "not used" };
  return subs.slice(0, 30).map(s => {
    const what = s.kind === "new_property" ? `New property: ${((s.payload || {}).property || {}).name || ""}` : `${Object.keys((s.payload || {}).fields || {}).map(k => CMS.humanize(k).toLowerCase()).join(", ")}`;
    const link = S.me.links.find(l => l.slug === s.link_slug);
    return `<div class="sub"><div style="flex:1;min-width:0"><div>${esc(what)}</div><div class="small mut">${esc(s.kind === "update" ? propLabel(s) : (link ? link.label : ""))} · ${esc(ago(s.created_at))}</div></div><span class="st ${s.status}">${label[s.status] || s.status}</span></div>`;
  }).join("");
}
function propLabel(s) {
  const pr = S.probes[s.link_slug];
  return (pr && pr.__props && pr.__props[s.property_id]) || "Update";
}

/* -------------------------------------------------------------- forms -- */
function sheet(html, onReady) {
  $("#sheet-body").innerHTML = `<button class="x" type="button" data-close aria-label="Close">×</button>` + html;
  $("#sheet").classList.add("on");
  document.body.style.overflow = "hidden";
  onReady($("#sheet-body"));
  setTimeout(() => { const f = $("#sheet-body input, #sheet-body textarea"); if (f && innerWidth > 700) f.focus(); }, 40);
}
function closeSheet() { $("#sheet").classList.remove("on"); document.body.style.overflow = ""; }
$("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet" || e.target.closest("[data-close]")) closeSheet(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

const fieldHTML = (f, val = "") => f.type === "long"
  ? `<label class="f" for="bf-${f.key}">${esc(f.label)} <span class="opt">optional</span></label><textarea class="in" id="bf-${f.key}" data-f="${f.key}" maxlength="2000">${esc(val)}</textarea>`
  : `<label class="f" for="bf-${f.key}">${esc(f.label)} <span class="opt">optional</span></label><input class="in" id="bf-${f.key}" data-f="${f.key}" ${f.type === "number" ? `inputmode="decimal"` : ""} maxlength="300" value="${esc(val)}">`;
const SOURCES = ["I represent the landlord or developer", "I visited or showed it recently", "From a recent deal or quote", "Heard in the market"];
const sourceHTML = () => `<label class="f" for="bf-src">How do you know?</label><select class="in" id="bf-src">${SOURCES.map(s => `<option>${esc(s)}</option>`).join("")}<option value="other">Something else</option></select>
  <input class="in" id="bf-src2" placeholder="Tell us how" maxlength="300" hidden>`;
function readFields(box) {
  const out = {};
  let bad = null;
  $$("[data-f]", box).forEach(el => {
    const f = CMS.BROKER_FIELDS.find(x => x.key === el.dataset.f), raw = el.value.trim();
    el.style.borderColor = "";
    if (!raw) return;
    if (f && f.type === "number") {
      const n = parseFloat(raw.replace(/[, ]/g, "").replace(/^(inr|rs\.?|₹)/i, ""));
      if (!Number.isFinite(n)) { el.style.borderColor = "var(--bad)"; bad = bad || el; return; }
      out[f.key] = n;
    } else out[el.dataset.f] = raw;
  });
  return { out, bad };
}
function wireSource(box) {
  $("#bf-src", box).onchange = (e) => { $("#bf-src2", box).hidden = e.target.value !== "other"; if (!$("#bf-src2", box).hidden) $("#bf-src2", box).focus(); };
}
const sourceValue = (box) => $("#bf-src", box).value === "other" ? $("#bf-src2", box).value.trim() || "Other" : $("#bf-src", box).value;
function thanks(box, text) {
  box.innerHTML = `<div class="done"><div class="tick" aria-hidden="true">✓</div><h3>Thank you</h3><p class="mut">${esc(text)}</p><button class="btn pri" type="button" data-close>Back to the list</button></div>`;
}

function updateSheet(p, link) {
  sheet(`<h3>${esc(p.name)}</h3><div class="small mut" style="margin-bottom:14px">${esc(subLine(p))}</div>
    <p class="small mut" style="margin-top:0">Fill in only what you know. Leave the rest empty.</p>
    <div class="grid2">${CMS.BROKER_FIELDS.filter(f => f.type !== "long").map(f => `<div>${fieldHTML(f)}</div>`).join("")}</div>
    ${CMS.BROKER_FIELDS.filter(f => f.type === "long").map(f => fieldHTML(f)).join("")}
    ${sourceHTML()}
    <div class="err" id="bf-err"></div>
    <button class="btn acc wide" type="button" id="bf-send">Send update</button>`, (box) => {
    wireSource(box);
    $("#bf-send", box).onclick = async (e) => {
      const { out, bad } = readFields(box);
      if (bad) { $("#bf-err", box).textContent = "Use numbers only in the box marked red."; bad.focus(); return; }
      const note = out.marketNote; delete out.marketNote;
      if (!Object.keys(out).length && !note) { $("#bf-err", box).textContent = "Fill in at least one box."; return; }
      if (note) out.marketNote = note;
      e.target.disabled = true; e.target.textContent = "Sending…";
      try {
        await api("broker/submit", { link: link.slug, kind: "update", property_id: p.id, fields: out, source_note: sourceValue(box) });
        thanks(box, "The Autopilot team will check your update. You can see its status in the list.");
        refresh();
      } catch (err) { $("#bf-err", box).textContent = err.message; e.target.disabled = false; e.target.textContent = "Send update"; }
    };
  });
}
function proposeSheet() {
  const link = S.me.links.find(l => l.slug === S.link);
  sheet(`<h3>Propose a property</h3><div class="small mut" style="margin-bottom:14px">${esc(link ? link.label : "")}</div>
    <label class="f" for="np-name">Building name</label><input class="in" id="np-name" maxlength="120">
    <label class="f" for="np-addr">Address <span class="opt">optional</span></label><input class="in" id="np-addr" maxlength="240">
    <label class="f" for="np-maps">Google Maps link</label><input class="in" id="np-maps" placeholder="Open the building in Google Maps, tap Share, paste here" maxlength="600">
    <div class="small" id="np-pin" style="margin:-6px 0 12px"></div>
    <div class="grid2">${CMS.BROKER_FIELDS.filter(f => f.type !== "long").map(f => `<div>${fieldHTML(f)}</div>`).join("")}</div>
    ${CMS.BROKER_FIELDS.filter(f => f.type === "long").map(f => fieldHTML(f)).join("")}
    ${sourceHTML()}
    <div class="err" id="np-err"></div>
    <button class="btn acc wide" type="button" id="np-send">Send proposal</button>`, (box) => {
    wireSource(box);
    $("#np-maps", box).oninput = (e) => {
      const p = mapsLatLng(e.target.value);
      $("#np-pin", box).innerHTML = p ? `<span style="color:var(--ok)">✓ Pin found (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})</span>` : e.target.value.trim() ? `<span class="mut">Short links (maps.app.goo.gl) are fine too; the team will place the pin.</span>` : "";
    };
    $("#np-send", box).onclick = async (e) => {
      const name = $("#np-name", box).value.trim();
      if (!name) { $("#np-err", box).textContent = "Add the building name."; $("#np-name", box).focus(); return; }
      const { out, bad } = readFields(box);
      if (bad) { $("#np-err", box).textContent = "Use numbers only in the box marked red."; bad.focus(); return; }
      const maps = $("#np-maps", box).value.trim(), pin = mapsLatLng(maps);
      const property = { name, address: $("#np-addr", box).value.trim(), mapsLink: maps, ...(pin ? { lat: pin.lat, lng: pin.lng } : {}), ...out };
      e.target.disabled = true; e.target.textContent = "Sending…";
      try {
        await api("broker/submit", { link: S.link, kind: "new_property", property, source_note: sourceValue(box) });
        thanks(box, "The Autopilot team will look at it and may call you for details.");
        refresh();
      } catch (err) { $("#np-err", box).textContent = err.message; e.target.disabled = false; e.target.textContent = "Send proposal"; }
    };
  });
}
async function refresh() {
  try { S.me = await api("broker/me"); } catch (e) { return; }
  render();
}

start();
