/* ============================================================================
   GOD'S EYE · client
   Left: the live feed (public headlines, keyword-tagged, newest first).
   Right: the desk. A question plus the feed goes to /api/godseye/ask, which
   streams back a ranked, sourced answer on where Autopilot should bet next.
   ============================================================================ */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const LANES = [
  ["funding", "Funding"], ["gcc", "GCC"], ["hiring", "Hiring"], ["expansion", "Expansion"],
  ["leasing", "Leasing"], ["competitor", "Competitors"], ["rto", "Work model"],
  ["policy", "Policy"], ["contraction", "Contraction"],
];
const LANE_NAME = Object.fromEntries(LANES);
const laneColor = (k) => `var(--${k})`;

const PRESETS = [
  ["Where do we bet this week?", "Where should Autopilot place its next bets this week? Rank the companies to call and the micro-markets to build supply in."],
  ["Fresh money", "Which companies raised Series A or later in the last 14 days and employ people in Mumbai, Delhi NCR or Bengaluru? Rank them by how soon they will need 30 or more seats."],
  ["GCC radar", "Which foreign companies announced or expanded a GCC or India centre in the last 30 days? For each: city, headcount target, the named site leader if a source names one, and how Autopilot gets in front of them."],
  ["Competitor watch", "What have WeWork India, Awfis, Smartworks, IndiQube, Table Space and BHIVE done in the last 30 days? Where are they adding supply, and what should Autopilot do about it?"],
  ["Micro-market heat", "Which Indian office micro-markets are heating up right now based on leasing, GCC and hiring news, and which are cooling? Say which ones Autopilot should build supply in."],
  ["Work model debate", "What is the current debate on return to office in India, which large employers changed policy recently, and what does it mean for seat demand?"],
];

let KEY = "";
let FEED = null;
let SERVER = { key_configured: true };
const state = { lane: "", q: "", city: "", pinned: new Map(), busy: null };

/* ----------------------------------------------------------------- gate -- */
async function ping(key) {
  const r = await fetch("/api/godseye/ask", {
    method: "POST", headers: { "Content-Type": "application/json", "x-godseye-key": key }, body: JSON.stringify({ ping: true }),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}
function initGate() {
  const go = async () => {
    const key = $("#g-key").value.trim();
    if (!key) return;
    $("#g-go").disabled = true; $("#g-err").textContent = "";
    try {
      const r = await ping(key);
      if (r.status === 200) { try { sessionStorage.setItem("ge-key", key); } catch {} open(key, r); }
      else $("#g-err").textContent = r.status === 401 ? "Not recognised. Access is issued per person." : (r.error || "Server error " + r.status);
    } catch { const e = $("#g-err"); if (e) e.textContent = "Could not reach the server."; }
    const b = $("#g-go"); if (b) b.disabled = false;
  };
  $("#g-go").onclick = go;
  $("#g-key").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  let saved = ""; try { saved = sessionStorage.getItem("ge-key") || ""; } catch {}
  if (saved) ping(saved).then((r) => (r.status === 200 ? open(saved, r) : null)).catch(() => {});
}
function open(key, info) {
  KEY = key; SERVER = info || SERVER;
  $("#gate").remove(); $("#app").classList.add("on");
  boot();
}

/* ----------------------------------------------------------------- feed -- */
const ago = (iso) => {
  if (!iso) return "date unknown";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60); if (h < 36) return h + "h ago";
  const d = Math.round(h / 24); return d + "d ago";
};

async function loadFeed(force) {
  $("#health").textContent = "Pulling feed";
  try {
    const r = await fetch("/api/godseye/feed" + (force ? "?force=1" : ""), { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
    FEED = j;
    const dot = $("#dot"); dot.className = "dot live"; void dot.offsetWidth; dot.classList.add("ping");
    renderFilters(); renderFeed(); renderHealth();
  } catch (e) {
    $("#dot").className = "dot";
    $("#health").textContent = "Feed unavailable: " + e.message;
    if (!FEED) $("#feed").innerHTML = `<div class="empty">The feed could not be loaded (${esc(e.message)}). The desk still works: it runs its own searches.</div>`;
  }
}

function renderHealth() {
  const s = FEED.sources || [];
  const ok = s.filter((x) => x.ok).length;
  const t = new Date(FEED.fetched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  $("#health").innerHTML = `Updated ${esc(t)} IST<span class="long"> · ${ok}/${s.length} sources live</span>`;
  $("#srcs").innerHTML = "Sources: " + s.map((x) => x.ok
    ? `${esc(x.label)} <span title="${x.ms} ms">(${x.count})</span>`
    : `<span class="bad" title="${esc(x.error)}">${esc(x.label)} (failed)</span>`).join(" · ");
}

function renderFilters() {
  const items = FEED.items || [];
  const count = (k) => items.filter((i) => i.tags.includes(k)).length;
  $("#lanes").innerHTML = [`<button class="chip ${state.lane ? "" : "on"}" data-lane="">All <span class="c">${items.length}</span></button>`]
    .concat(LANES.map(([k, n]) => `<button class="chip ${state.lane === k ? "on" : ""}" data-lane="${k}"><i style="background:${laneColor(k)}"></i>${n} <span class="c">${count(k)}</span></button>`))
    .join("");
  const cities = [...new Set(items.flatMap((i) => i.cities))].sort();
  const sel = $("#city");
  sel.innerHTML = `<option value="">All cities</option>` + cities.map((c) => `<option ${c === state.city ? "selected" : ""}>${esc(c)}</option>`).join("");
}

function visible() {
  const q = state.q.toLowerCase();
  return (FEED && FEED.items || []).filter((i) =>
    (!state.lane || i.tags.includes(state.lane)) &&
    (!state.city || i.cities.includes(state.city)) &&
    (!q || (i.title + " " + i.publisher).toLowerCase().includes(q)));
}

function renderFeed() {
  const list = visible();
  $("#count").textContent = FEED ? `${list.length} shown · keyword tags, not verified` : "";
  if (!list.length) {
    const failed = (FEED && FEED.sources || []).filter((s) => !s.ok);
    $("#feed").innerHTML = FEED && !FEED.items.length
      ? `<div class="empty">No headlines came back from the sources${failed.length ? ` (${failed.length} of ${FEED.sources.length} failed, see below)` : ""}. The desk still works: it runs its own searches.</div>`
      : `<div class="empty">Nothing matches this filter right now.</div>`;
    return;
  }
  $("#feed").innerHTML = list.slice(0, 300).map((i) => {
    const pinned = state.pinned.has(i.id);
    return `<article class="item ${pinned ? "pinned" : ""}" data-id="${i.id}">
      <div class="meta"><b>${esc(i.publisher)}</b><span>${esc(ago(i.published_at))}</span></div>
      <a class="hl" href="${esc(i.link)}" target="_blank" rel="noopener noreferrer">${esc(i.title)}</a>
      <div class="tags">
        ${i.amount ? `<span class="tag amt" title="As printed in the headline">${esc(i.amount)}</span>` : ""}
        ${i.cities.map((c) => `<span class="tag city">${esc(c)}</span>`).join("")}
        ${i.tags.map((t) => `<span class="tag"><i style="background:${laneColor(t)}"></i>${esc(LANE_NAME[t] || t)}</span>`).join("")}
      </div>
      <div class="acts">
        <button class="mini assess" title="Ask the desk about this signal">Assess</button>
        <button class="mini pin ${pinned ? "on" : ""}" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>
      </div>
    </article>`;
  }).join("");
}

function renderPins() {
  const el = $("#pins");
  if (!state.pinned.size) { el.classList.remove("on"); el.innerHTML = ""; return; }
  el.classList.add("on");
  el.innerHTML = `<span>${state.pinned.size} pinned signal${state.pinned.size > 1 ? "s" : ""} will be sent with your question.</span><button class="mini" id="clearpins">Clear</button>`;
  $("#clearpins").onclick = () => { state.pinned.clear(); renderPins(); renderFeed(); };
}

/* ------------------------------------------------------------ markdown -- */
/* Small, safe renderer: everything is escaped first, then a fixed set of
   patterns is turned into tags. Only http(s) links survive. */
function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener noreferrer">${host(u)}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
function md(src) {
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map((x) => `<li>${inline(x)}</li>`).join("")}</${list.t}>`); list = null; } };
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushP(); flushL(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushP(); flushL(); const n = Math.min(Math.max(m[1].length, 2), 4); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushP(); flushL(); out.push("<hr>"); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ul") { flushL(); list = { t: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(m[1]); continue; }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    flushL(); para.push(line.trim());
  }
  flushP(); flushL();
  return out.join("");
}

/* ----------------------------------------------------------------- desk -- */
function renderRecent() {
  const rec = store.get("ge-recent", []);
  const el = $("#recent");
  if (!rec.length) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<h4>Recent answers on this device</h4>` + rec.map((r, i) =>
    `<button data-i="${i}">${esc(r.q.slice(0, 110))}<small>${esc(new Date(r.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }))}</small></button>`).join("");
  el.querySelectorAll("button").forEach((b) => b.onclick = () => {
    const r = rec[+b.dataset.i];
    $("#question").value = r.q;
    $("#out").innerHTML = `<div class="report">${md(r.a)}</div>${sourcesHtml(r.sources || [])}<div class="foot">Saved answer from ${esc(new Date(r.at).toLocaleString("en-IN"))}. Ask again for a fresh read.</div>`;
  });
}
function sourcesHtml(list) {
  if (!list.length) return "";
  return `<details class="sources"><summary>${list.length} source${list.length === 1 ? "" : "s"} read</summary><ol>${list.map((s) =>
    `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || host(s.url))}</a> <span>${esc(host(s.url))}${s.page_age ? " · " + esc(s.page_age) : ""}</span></li>`).join("")}</ol></details>`;
}

async function ask(question) {
  question = (question || $("#question").value).trim();
  if (!question || state.busy) return;
  $("#question").value = question;
  if (matchMedia("(max-width:860px)").matches) setTab("desk");

  const ctrl = new AbortController();
  state.busy = ctrl;
  $("#ask").disabled = true; $("#ask").textContent = "Working"; $("#stop").hidden = false;
  const out = $("#out");
  out.innerHTML = `<div class="log" id="log"></div><div class="report" id="report"></div><div id="srclist"></div><div class="foot" id="foot"></div>`;
  const log = $("#log"), report = $("#report");
  let text = "", roundStart = 0, sources = [], raf = 0, t0 = Date.now();
  const logLine = (t) => { log.querySelectorAll(".now").forEach((n) => n.classList.remove("now")); log.insertAdjacentHTML("beforeend", `<div class="now">${esc(t)}</div>`); log.scrollTop = log.scrollHeight; };
  const paint = () => { raf = 0; report.innerHTML = md(text); };

  try {
    const r = await fetch("/api/godseye/ask", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-godseye-key": KEY },
      body: JSON.stringify({ question, focus: [...state.pinned.values()] }),
    });
    if (!r.ok || !(r.headers.get("content-type") || "").includes("event-stream")) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || "Server error " + r.status);
    }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = (chunk.match(/^event: (.*)$/m) || [])[1];
        const data = (chunk.match(/^data: (.*)$/m) || [])[1];
        if (!ev || !data) continue;
        const d = JSON.parse(data);
        if (ev === "status") logLine(d.text);
        else if (ev === "round") roundStart = text.length;
        else if (ev === "discard") { text = text.slice(0, roundStart); if (!raf) raf = requestAnimationFrame(paint); }
        else if (ev === "text") { text += d.t; if (!raf) raf = requestAnimationFrame(paint); }
        else if (ev === "sources") { sources = sources.concat(d.items); $("#srclist").innerHTML = sourcesHtml(sources); }
        else if (ev === "error") out.insertAdjacentHTML("beforeend", `<div class="err">${esc(d.message)}</div>`);
        else if (ev === "done") {
          const u = d.usage || {};
          const searches = u.searches;
          $("#foot").textContent = `${d.provider || ""} · ${d.model || ""} · ${Math.round((Date.now() - t0) / 1000)}s` +
            (u.exa_checks ? ` · ${u.exa_checks} Exa checks` : "") +
            (searches != null ? ` · ${searches} search${searches === 1 ? "" : "es"}` : "") +
            (u.output_tokens ? ` · ${u.input_tokens} in / ${u.output_tokens} out tokens` : "");
        }
      }
    }
    paint();
    logLine("Done");
    if (text.trim()) {
      const rec = store.get("ge-recent", []);
      rec.unshift({ q: question, a: text, sources, at: Date.now() });
      store.set("ge-recent", rec.slice(0, 8));
      renderRecent();
    }
  } catch (e) {
    if (e.name === "AbortError") { paint(); logLine("Stopped"); }
    else out.insertAdjacentHTML("beforeend", `<div class="err">${esc(e.message)}</div>`);
  } finally {
    state.busy = null;
    $("#ask").disabled = false; $("#ask").textContent = "Ask"; $("#stop").hidden = true;
  }
}

function assess(item) {
  state.pinned.set(item.id, item); renderPins(); renderFeed();
  ask(`Assess this signal for Autopilot: "${item.title}" (${item.publisher}). Verify it, find the facts that make it actionable, and tell us whether it is a bet, a watchlist item or noise. If it is a bet, give the full bet card.`);
}

/* ----------------------------------------------------------------- boot -- */
function setTab(t) {
  $("main").dataset.tab = t;
  document.querySelectorAll(".tabs .chip").forEach((c) => c.classList.toggle("on", c.dataset.tab === t));
}

function boot() {
  $("#presets").innerHTML = PRESETS.map(([label], i) => `<button class="chip" data-p="${i}">${esc(label)}</button>`).join("");
  $("#presets").onclick = (e) => { const b = e.target.closest("[data-p]"); if (b) ask(PRESETS[+b.dataset.p][1]); };
  $("#ask").onclick = () => ask();
  $("#stop").onclick = () => state.busy && state.busy.abort();
  $("#question").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(); });
  $("#refresh").onclick = () => loadFeed(true);
  $("#lanes").onclick = (e) => { const b = e.target.closest("[data-lane]"); if (!b) return; state.lane = b.dataset.lane; renderFilters(); renderFeed(); };
  $("#q").oninput = (e) => { state.q = e.target.value; renderFeed(); };
  $("#city").onchange = (e) => { state.city = e.target.value; renderFeed(); };
  $("#feed").onclick = (e) => {
    const card = e.target.closest(".item"); if (!card) return;
    const item = FEED.items.find((i) => i.id === card.dataset.id); if (!item) return;
    if (e.target.closest(".pin")) {
      state.pinned.has(item.id) ? state.pinned.delete(item.id) : state.pinned.set(item.id, item);
      renderPins(); renderFeed();
    } else if (e.target.closest(".assess")) assess(item);
  };
  document.querySelectorAll(".tabs .chip").forEach((c) => c.onclick = () => setTab(c.dataset.tab));

  if (SERVER.key_configured === false) {
    $("#banner").innerHTML = `<div class="banner">The desk is waiting for its API key (${esc(SERVER.key_name || "API key")} on the server). The live feed works now; questions will run as soon as the key is set.</div>`;
  }
  renderRecent();
  loadFeed(false);
  /* Refresh on a five-minute cycle, matching the server cache, and only
     while the tab is visible. */
  setInterval(() => { if (document.visibilityState === "visible") loadFeed(false); }, 5 * 60 * 1000);
}

initGate();
