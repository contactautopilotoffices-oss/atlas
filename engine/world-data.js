/* The data layer of an Atlas explorer: what the 2D atlas knows about each option, said around the 3D.
   The 3D stays the star. A small dock in the header opens one glass panel at the side with four views of the
   selected building (the offer, the trade-offs, how the four compare, what to confirm), and the guided tour
   (world-story.js) can open the same panels as it goes.

   An atlas opts in with meta.world.dataLayer. Nothing here knows a client or a workbook: every label, key and sentence
   is the atlas's, and every number is read from the atlas at runtime (options[].facts, routes, flag, meta.nextSteps,
   facts.source, existing). The schema:

     rows[]   the measures: { id, label,
                source   fact: "<facts key>" | field: "<option property>" | calc: "roadKm" | "walk" | "scale"
                parse    first | money | min | max (largest number, >= row.min) | months (the lower end of a range)
                fmt      text (default) | money | area | percent        unit / suffix: words after the figure
                best     "min" | "max": the cell that wins the row in Compare        lead: "the lowest outflow"
                basis    workbook | measured | assumed | derived (the tag shown beside the figure)
                sheetFact   (calc roadKm) the sheet's own figure, shown beside the atlas's estimate }
     offer[]  groups for the offer card: { title, ids[] }          compare[]  row ids in the compare table
     pros / cons   the facts keys of the two lists                  currency, locale, fixes{} (misspellings to mend)
     tour[]   extra tour steps { view, panel, basis, title, text }; text tokens: {name} {<row id>} {pros} {cons}
              {leads} {best:<row id>} {flag}, {token:l} for lower case, and {token|fallback}. A sentence with a token that has no value is dropped.
   A field the sheet does not give is shown as "Not in the sheet", or left out when no option has it. */
import { easyTabs } from "./andheri-ui.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BASIS = { workbook: ["Sheet", "From the client's sheet"], measured: ["Measured", "Measured on the map"], assumed: ["Estimate", "Our estimate, not confirmed"], derived: ["Worked out", "Worked out from sheet figures"] };
const TABS = [["offer", "Offer"], ["tradeoffs", "Trade-offs"], ["compare", "Compare"], ["next", "To confirm"]];
const ICON = { offer: '<path d="M4 7h16M4 12h16M4 17h10"/>', tradeoffs: '<path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/>', compare: '<path d="M4 5h6v14H4zM14 5h6v14h-6z"/>', next: '<path d="M5 12l4 4 10-10"/>' };

/* every number in a piece of text; "20,08,000" is one number, "G,1,2- 18000" is 1, 2 and 18000 */
function nums(t) {
  const out = [];
  for (const m of String(t || "").matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const s = m[0];
    if (/^\d{1,3}(,\d{2,3})+(\.\d+)?$/.test(s)) out.push(+s.replace(/,/g, ""));
    else for (const p of s.split(",")) if (p) out.push(+p);
  }
  return out.filter(Number.isFinite);
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const gone = (t) => !t || /^not (specified|given|stated|available)/i.test(String(t).trim());
const hav = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dg = (b.lng - a.lng) * r; const s = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(s)); };
const fmtKm = (d) => `${d < 1 ? d.toFixed(2) : d < 10 ? d.toFixed(1) : Math.round(d)} km`;   // the 2D atlas's own rule
const fmtWalk = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

export function createDataLayer({ A, W, options, getSel, select, onLayout, isTouring, wake }) {
  const C = W.dataLayer; if (!C || !Array.isArray(C.rows) || !options.length) return null;
  const rows = C.rows, byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const loc = C.locale || "en-IN", cur = C.currency || "", grp = (n) => Math.round(n).toLocaleString(loc);
  const EX = A.existing && isNum(A.existing.lat) ? A.existing : null, SP = (A.meta && A.meta.speed) || {};
  const FACTOR = isFinite(SP.factor) ? SP.factor : 1.3, KMH = isFinite(SP.kmh) ? SP.kmh : 20;
  const fixes = Object.entries(C.fixes || {});

  /* ------------------------------------------------------------- values */
  const factText = (o, k) => { const f = (o.facts || []).find((x) => x.k === k); return f ? String(f.v ?? "").trim() : ""; };
  const tidy = (t) => { let s = String(t || "").replace(/\s+/g, " ").trim(); for (const [a, b] of fixes) s = s.split(a).join(b);
    return s.replace(/(\w)\(/g, "$1 (").replace(/(\d)\s*-\s*(\d)/g, "$1–$2").replace(/\s*\/-/g, "").replace(/\.$/, ""); };
  const sentence = (t) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  /* a figure with a unit; a sheet line with several parts ("G,1,2- 18000   3,4- 8000") becomes one part a line */
  function area(raw, unit, scale = 1) {
    const parts = String(raw).split(/\s{2,}/).map((s) => s.trim()).filter(Boolean).map((s) => {
      const m = s.match(/^(.*?)\s*[-–:]\s*(\d[\d,.]*)\s*$/), n = nums(m ? m[2] : s).filter((x) => x >= (C.minArea || 0))[0];
      return n == null ? null : { label: m ? m[1].replace(/,\s*/g, ", ") : "", n: n * scale };
    }).filter(Boolean);
    if (!parts.length) return null;
    const lines = parts.map((p) => `${p.label && parts.length > 1 ? p.label + ": " : ""}${grp(p.n)}${unit ? " " + unit : ""}`);
    return { lines, text: lines.join(" · "), nums: parts.map((p) => p.n) };
  }
  const rb = (r) => r.basis || ({ roadKm: "assumed", walk: "measured", scale: "derived" }[r.calc]) || "workbook";
  function val(row, o) {
    const out = { text: "", sub: "", lines: null, num: null, basis: rb(row), missing: true };
    let raw = "";
    if (row.calc === "roadKm") {
      if (!EX || !isNum(o.lat)) return out;
      const ex = hav(o, EX), km = isNum(o.roadKm) ? o.roadKm : ex * FACTOR, min = o.driveText || `~${Math.max(1, Math.round(ex * FACTOR / KMH * 60))} min`;
      Object.assign(out, { missing: false, num: km, text: fmtKm(km), basis: rb(row), sub: `${isNum(o.roadKm) ? "by road" : "by road (est.)"} · ${min}` });
      const s = row.sheetFact ? factText(o, row.sheetFact) : ""; if (!gone(s)) out.sheet = `The sheet says ${tidy(s)}`;
      return out;
    }
    if (row.calc === "walk") {
      const r = (o.routes || []).filter((x) => x.kind === "metro" && isNum(x.m)).sort((a, b) => a.m - b.m)[0]; if (!r) return out;
      return Object.assign(out, { missing: false, num: r.m, text: `${fmtWalk(r.m)}${r.min ? ` · ${r.min} min` : ""}`, sub: `on foot to ${String(r.name).replace(/^Noida /, "")}`, basis: rb(row) });
    }
    if (row.calc === "scale") {
      const a = byId[row.of], b = byId[row.by]; if (!a || !b) return out;
      const ta = a.fact ? factText(o, a.fact) : "", k = nums(b.fact ? factText(o, b.fact) : "")[0]; if (gone(ta) || !isNum(k)) return out;
      const ar = area(ta, row.unit || a.unit || "", k); if (!ar) return out;
      return Object.assign(out, { missing: false, text: ar.text, lines: ar.lines.length > 1 ? ar.lines : null, num: Math.max(...ar.nums), basis: rb(row) });
    }
    raw = row.fact ? factText(o, row.fact) : row.field != null && o[row.field] != null ? String(o[row.field]) : "";
    if (gone(raw)) return out;
    const n = nums(raw).filter((x) => x >= (row.min || 0));
    out.missing = false;
    if (row.parse === "max") out.num = n.length ? Math.max(...n) : null; else if (row.parse === "min" || row.parse === "months") out.num = n.length ? Math.min(...n) : null; else out.num = n.length ? n[0] : null;
    if (row.fmt === "money" && isNum(out.num)) { out.text = cur + grp(out.num); out.sub = row.suffix || ""; }
    else if (row.fmt === "percent" && isNum(out.num)) out.text = (out.num <= 1 ? Math.round(out.num * 100) : out.num) + "%";
    else if (row.fmt === "area") { const ar = area(raw, row.unit || "sq ft"); if (ar) { out.text = ar.text; out.lines = ar.lines.length > 1 ? ar.lines : null; out.num = Math.max(...ar.nums); } else out.text = tidy(raw); }
    else { out.text = tidy(raw); if (row.suffix && /^\d+$/.test(out.text)) out.text += " " + row.suffix; }
    return out;
  }
  const cache = new Map();   // option id -> { rowId -> value }; the atlas does not change while the explorer is open
  const valOf = (o, id) => { let m = cache.get(o.id); if (!m) cache.set(o.id, m = {}); return m[id] || (m[id] = val(byId[id], o)); };
  /* the winners of a row across all the options: only when the figures differ */
  const winners = (id) => { const r = byId[id]; if (!r || !r.best) return new Set();
    const v = options.map((o) => [o.id, valOf(o, id).num]).filter(([, n]) => isNum(n)); if (v.length < 2) return new Set();
    const ext = Math[r.best === "max" ? "max" : "min"](...v.map((x) => x[1])); if (v.every((x) => x[1] === ext)) return new Set();
    return new Set(v.filter((x) => x[1] === ext).map((x) => x[0])); };
  const bestOf = {}; for (const r of rows) if (r.best) bestOf[r.id] = winners(r.id);
  const anyHas = (id) => options.some((o) => !valOf(o, id).missing);

  /* ------------------------------------------------- pros and cons lists */
  function listOf(o, key) {
    const raw = key ? factText(o, key) : ""; if (gone(raw)) return [];
    const out = [];
    for (const seg of tidy(raw).split(/\s*(?:[;,]|\.(?=\s|$))\s*(?![^(]*\))/)) {   // commas and full stops outside brackets
      let s = seg.trim(); if (!s) continue;
      const m = s.length > 50 && s.match(/^(.{15,}?)\s+and\s+(.{15,})$/);
      for (const part of m ? [m[1], m[2]] : [s]) out.push(sentence(part.trim()));
    }
    return out;
  }
  const leadsOf = (o) => rows.filter((r) => r.lead && bestOf[r.id] && bestOf[r.id].has(o.id));

  /* -------------------------------------------------------------- panels */
  const tag = (b) => { const t = b !== "workbook" && BASIS[b]; return t ? `<i class="dp-tag" data-b="${esc(b)}" title="${esc(t[1])}">${esc(t[0])}</i>` : ""; };
  const cellText = (v) => v.lines ? v.lines.map(esc).join("<br>") : esc(v.text);
  const none = '<span class="dp-none">Not in the sheet</span>';
  const srcLine = () => A.meta && A.meta.sheet ? `<p class="dp-src">${esc(A.meta.sheet)}${A.meta.asOf ? ` As of ${esc(A.meta.asOf)}.` : ""} Figures without a tag are the sheet's.</p>` : "";
  const head = (o, kicker) => `<span class="mono">${esc(String(o.n || "").padStart(2, "0"))} · ${esc(kicker)}</span>`;
  const flagHTML = (o) => o.flag && o.flag.v ? `<div class="dp-flag"><b>Check first</b><p>${esc(o.flag.v)}</p></div>` : "";

  function offerRow(o, id) {
    const r = byId[id]; if (!r) return "";
    const v = valOf(o, id); if (v.missing && !anyHas(id)) return "";
    if (v.missing) return `<div class="dp-row"><dt>${esc(r.label)}${r.hint ? `<small>${esc(r.hint)}</small>` : ""}</dt><dd>${none}</dd></div>`;
    return `<div class="dp-row"><dt>${esc(r.label)}${tag(v.basis)}${r.hint ? `<small>${esc(r.hint)}</small>` : ""}</dt><dd><span class="dp-v">${cellText(v)}</span>${v.sub ? `<small>${esc(v.sub)}</small>` : ""}${v.sheet ? `<small>${esc(v.sheet)}</small>` : ""}</dd></div>`;
  }
  function offerHTML(o) {
    const groups = C.offer && C.offer.length ? C.offer : [{ title: "", ids: rows.map((r) => r.id) }];
    const first = groups[0].ids[0], hv = first && valOf(o, first), hr = byId[first];
    const hero = hr && hv && !hv.missing && hr.fmt === "money" ? `<div class="dp-hero"><span class="dp-big">${esc(hv.text)}</span><span class="dp-per">${esc(hv.sub)}</span>${tag(hv.basis)}</div>` : "";
    const note = hr && hr.noteFact ? ((A.facts && A.facts.source || []).find((x) => x.k === hr.noteFact) || {}).v : "";
    const rest = groups.map((g, i) => { const ids = g.ids.filter((id) => !(i === 0 && hero && id === first)); const html = ids.map((id) => offerRow(o, id)).join("");
      return html ? `<section>${g.title ? `<h3 class="mono">${esc(g.title)}</h3>` : ""}<dl class="dp-list">${html}</dl></section>` : ""; }).join("");
    return `<div class="dp-top">${head(o, "The offer")}</div><h2 class="dp-name">${esc(o.name)}</h2><p class="dp-sub">${esc(o.address || o.locality || "")}</p>
      ${hero}${note ? `<p class="dp-note">${esc(note)}</p>` : ""}${rest}${flagHTML(o)}${EX && EX.note ? `<p class="dp-note">${esc(EX.note)}</p>` : ""}${srcLine()}`;
  }
  function listHTML(items, cls, empty) { return items.length ? `<ul class="dp-ul ${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="dp-empty">${esc(empty)}</p>`; }
  function tradeHTML(o) {
    const pros = listOf(o, C.pros), cons = listOf(o, C.cons), leads = leadsOf(o);
    return `<div class="dp-top">${head(o, "Trade-offs")}</div><h2 class="dp-name">${esc(o.name)}</h2>${o.reason ? `<p class="dp-sub">${esc(o.reason)}</p>` : ""}
      <section><h3 class="mono">In its favour</h3>${listHTML(pros, "pro", "The sheet lists no strengths.")}</section>
      <section><h3 class="mono">Watch for</h3>${listHTML(cons, "con", "The sheet lists no downsides. Confirm on site.")}</section>
      <section><h3 class="mono">Best of the ${options.length} on</h3>${leads.length ? `<ul class="dp-chips">${leads.map((r) => `<li>${esc(sentence(r.lead.replace(/^the /, "")))}</li>`).join("")}</ul>` : '<p class="dp-empty">No headline measure. Weigh it on the list above.</p>'}</section>
      ${flagHTML(o)}${o.geoNote ? `<section><h3 class="mono">About the pin</h3><p class="dp-note">${esc(o.geoNote)}</p></section>` : ""}${srcLine()}`;
  }
  function compareHTML(o) {
    const ids = (C.compare && C.compare.length ? C.compare : rows.map((r) => r.id)).filter((id) => byId[id] && anyHas(id));
    const body = ids.map((id) => { const r = byId[id], win = bestOf[id];
      return `<tr><th scope="row">${esc(r.label)}${tag(rb(r))}</th>${options.map((x) => { const v = valOf(x, id), b = win && win.has(x.id);
        return `<td data-id="${esc(x.id)}"${b ? ' class="best"' : ""}>${v.missing ? none : `<span class="dp-v">${cellText(v)}</span>${v.sub ? `<small>${esc(v.sub)}</small>` : ""}${v.sheet ? `<small>${esc(v.sheet)}</small>` : ""}`}${b ? '<span class="vh"> (best in this row)</span>' : ""}</td>`; }).join("")}</tr>`; }).join("");
    return `<div class="dp-top"><span class="mono">Compare all ${options.length}</span></div><h2 class="dp-name sm">Side by side</h2>
      <p class="dp-sub">Shaded is the best in a row. Pick a column to see that building in 3D.</p>
      <div class="dp-scroll"><table class="dp-cmp"><caption class="vh">The options, compared</caption><colgroup><col>${options.map(() => "<col>").join("")}</colgroup><thead><tr><td></td>${options.map((x) => `<th scope="col" data-id="${esc(x.id)}"><button type="button" data-pick="${esc(x.id)}"><span class="n">${esc(String(x.n || "").padStart(2, "0"))}</span><b>${esc(x.name)}</b></button></th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="dp-note">Tagged rows: Measured is walked on the map, Estimate is ours from indicative pins, Worked out is arithmetic on sheet figures.${EX && EX.note ? " " + esc(EX.note) : ""}</p>${srcLine()}`;
  }
  function nextHTML(o) {
    const steps = (A.meta && A.meta.nextSteps) || [], src = (A.facts && A.facts.source) || [];
    return `<div class="dp-top">${head(o, "To confirm")}</div><h2 class="dp-name sm">Before you decide</h2>
      ${steps.length ? `<ol class="dp-steps">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : '<p class="dp-empty">Nothing is listed to confirm.</p>'}
      ${src.length ? `<section><h3 class="mono">What the sheet leaves open</h3><dl class="dp-open">${src.map((x) => `<dt>${esc(x.k)}</dt><dd>${esc(x.v)}</dd>`).join("")}</dl></section>` : ""}${srcLine()}`;
  }
  const BUILD = { offer: offerHTML, tradeoffs: tradeHTML, compare: compareHTML, next: nextHTML };

  /* ---------------------------------------------------------------- shell */
  const dock = document.createElement("nav"); dock.id = "data-dock"; dock.setAttribute("aria-label", "Numbers for this building");
  dock.innerHTML = TABS.map(([k, t]) => `<button type="button" data-tab="${k}" aria-pressed="false" aria-controls="data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg><span>${t}</span></button>`).join("");
  const top = document.querySelector("#top"), modes = document.querySelector("#modes");
  if (top) top.insertBefore(dock, modes || null); else document.body.append(dock);
  document.body.classList.add("has-data"); easyTabs(dock);
  const panel = document.createElement("aside"); panel.id = "data"; panel.hidden = true; panel.setAttribute("aria-label", "Numbers for this building");
  panel.innerHTML = `<button type="button" id="data-x" aria-label="Close">×</button><div id="data-body"></div>`;
  document.body.append(panel);
  const bodyEl = panel.querySelector("#data-body");
  let tab = null, byTour = false, raf = 0;
  const optOf = (id) => options.find((x) => x.id === id) || options[0];

  function render(keepScroll) {
    const o = optOf(getSel()), top0 = keepScroll ? panel.scrollTop : 0;
    if (!tab) return;
    bodyEl.innerHTML = BUILD[tab](o); panel.scrollTop = top0; mark();
  }
  function mark() {   // the selected building's column, without rebuilding the table (focus stays where it is)
    if (tab !== "compare") return; const id = getSel();
    for (const el of bodyEl.querySelectorAll("[data-id]")) el.classList.toggle("sel", el.dataset.id === id);
    for (const b of bodyEl.querySelectorAll("[data-pick]")) b.toggleAttribute("aria-current", b.dataset.pick === id);
  }
  function layout() { document.body.classList.toggle("data-open", !!tab); document.body.dataset.dataTab = tab || ""; panel.dataset.w = tab === "compare" ? "wide" : "";
    for (const b of dock.querySelectorAll("button")) { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
    onLayout && onLayout(); wake && wake(900); }
  function open(t, fromTour) {
    if (!BUILD[t]) return; const same = tab === t; tab = t; byTour = !!fromTour; panel.hidden = false; if (!same) { panel.classList.remove("in"); void panel.offsetWidth; panel.classList.add("in"); }
    render(same); layout();
  }
  function close() { if (!tab) return; tab = null; byTour = false; panel.hidden = true; bodyEl.innerHTML = ""; layout(); }

  dock.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; if (tab === b.dataset.tab) close(); else open(b.dataset.tab); });
  panel.addEventListener("click", (e) => {
    if (e.target.closest("#data-x")) { const t = tab; close(); dock.querySelector(`[data-tab="${t}"]`)?.focus(); return; }
    const p = e.target.closest("[data-pick]"); if (p && p.dataset.pick !== getSel()) select(p.dataset.pick);
  });
  addEventListener("keydown", (e) => { if (e.key !== "Escape" || !tab || isTouring()) return; if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    const t = tab; close(); dock.querySelector(`[data-tab="${t}"]`)?.focus(); });
  /* the tour card's height, so a panel opened beside it on a phone can sit above it */
  const sty = () => document.querySelector("#story");
  if ("ResizeObserver" in window) { const ro = new ResizeObserver(() => { const s = sty(); if (s) document.body.style.setProperty("--story-h", Math.ceil(s.getBoundingClientRect().height) + "px"); }); const t = setInterval(() => { const s = sty(); if (s) { ro.observe(s); clearInterval(t); } }, 400); }

  /* ----------------------------------------------------------------- tour */
  const lowFirst = (t) => t.replace(/^([A-Z])(?![A-Z])/, (c) => c.toLowerCase());   // not for "DND" or "A104"
  function fill(tpl, o) {
    const get = (k) => {
      if (k === "name") return o.name; if (k === "pros" || k === "cons") return listJoin(listOf(o, C[k]).map(lowFirst));
      if (k === "leads") return listJoin(leadsOf(o).map((r) => r.lead)); if (k === "flag") return o.flag && o.flag.v || "";
      if (k.startsWith("best:")) { const id = k.slice(5); return listJoin(options.filter((x) => bestOf[id] && bestOf[id].has(x.id)).map((x) => x.name)); }
      const r = byId[k]; if (!r) return ""; const v = valOf(o, k); return v.missing ? "" : v.lines ? v.lines.join(", ") : v.text + (r.fmt === "money" && v.sub ? " " + v.sub : "");
    };
    return String(tpl).split(/(?<=[.!?])\s+(?=[A-Z{])/).map((s) => {
      let dead = false; const out = s.replace(/\{([^}|]+)(?:\|([^}]*))?\}/g, (_, k, fb) => { let key = k.trim(), low = false; if (key.endsWith(":l")) { key = key.slice(0, -2); low = true; } const v = get(key); if (v) return low ? v.toLowerCase() : v; if (fb != null) return fb; dead = true; return ""; });
      return dead ? "" : out;
    }).filter(Boolean).join(" ");
  }
  function tourSteps(id, base) {
    const o = optOf(id), list = (base || []).slice(), extra = [];
    for (const s of C.tour || []) { const text = fill(s.text || "", o); if (text) extra.push({ view: s.view || "stay", panel: s.panel, basis: s.basis, title: fill(s.title || "", o) || s.title, text }); }
    const last = list.length ? list.pop() : null;
    if (last && !last.panel && (A.meta.nextSteps || []).length) last.panel = "next";
    return [...list, ...extra, ...(last ? [last] : [])];
  }
  const tourStep = (s) => { if (s && s.panel && BUILD[s.panel]) open(s.panel, true); else if (byTour) close(); };
  const tourEnd = () => { if (byTour) close(); };

  return {
    open, close, tourSteps, tourStep, tourEnd,
    get tab() { return tab; },
    /* the explorer switched building: rebuild the open panel for it */
    select() { if (tab === "compare") mark(); else if (tab) render(false); },
    /* what the panel takes of the screen, for the camera to frame the rest: null when it is not showing */
    frame() { if (!tab || document.body.classList.contains("walk") || !panel.offsetWidth) return null;
      return { width: panel.offsetWidth, hud: tab !== "compare" && !isTouring() }; },
  };
}
