/* The data layer of an Atlas explorer: what the 2D atlas knows about each option, said around the 3D.
   The 3D stays the star. A small dock in the header opens one glass panel at the side with four views of the
   selected building (the offer, the trade-offs, how the four compare, what to confirm).

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
     tabs[]   which views to offer, in order: overview offer tradeoffs compare distances next (default: all that the atlas can fill)
     offer[]  groups for the offer card: { title, ids[] }          compare[]  row ids in the compare table
     pros / cons   the facts keys of the two lists                  currency, locale, fixes{} (misspellings to mend)
     notes{}  per building, what we know about the model: { <option id>: { facade, approach, position: { text, basis } } },
              shown in To confirm as 'About this model'
   A field the sheet does not give is shown as "Not in the sheet", or left out when no option has it. */
import { easyTabs } from "./andheri-ui.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BASIS = { workbook: ["Sheet", "From the client's sheet"], measured: ["Measured", "Measured on the map"], assumed: ["Estimate", "Our estimate, not confirmed"], derived: ["Worked out", "Worked out from sheet figures"] };
const TABS = [["overview", "Overview"], ["offer", "Offer"], ["tradeoffs", "Trade-offs"], ["compare", "Compare"], ["distances", "Distances"], ["next", "To confirm"]];
const ICON = { overview: '<path d="M4 6h16M4 12h10M4 18h16"/>', distances: '<circle cx="6" cy="17" r="2"/><circle cx="18" cy="7" r="2"/><path d="M8 15l8-6"/>', offer: '<path d="M4 7h16M4 12h16M4 17h10"/>', tradeoffs: '<path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/>', compare: '<path d="M4 5h6v14H4zM14 5h6v14h-6z"/>', next: '<path d="M5 12l4 4 10-10"/>' };

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

export function createDataLayer({ A, W, options, getSel, select, onLayout, wake }) {
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
      Object.assign(out, { missing: false, num: km, text: isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(km), basis: rb(row), sub: `${isNum(o.roadKm) ? "by road" : "by road (est.)"} · ${min}` });
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

  /* ------------------------------------------- distances (the 2D atlas's own maths, engine/app.js) */
  const MX = (() => {
    const geo = options.filter((o) => isNum(o.lat) && isNum(o.lng)); if (geo.length < 2) return null;
    const zones = Array.isArray(A.zones) ? A.zones : [], rank = (a, b) => a.n - b.n;
    const byZone = zones.flatMap((z) => geo.filter((o) => o.micro === z.key).sort(rank)), seen = new Set(byZone.map((o) => o.id));
    const list = byZone.concat(geo.filter((o) => !seen.has(o.id)).sort(rank)), all = EX ? [EX, ...list] : list;
    let max = 0; const pairs = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const d = hav(list[i], list[j]); max = Math.max(max, d); pairs.push({ a: list[i], b: list[j], d }); }
    pairs.sort((x, y) => x.d - y.d);
    const groups = [], done = new Set();   // chained: an option within 2.5 km of any member joins the group
    for (const o of list) { if (done.has(o.id)) continue; const g = [o]; done.add(o.id);
      for (let k = 0; k < g.length; k++) for (const x of list) if (!done.has(x.id) && hav(g[k], x) <= 2.5) { g.push(x); done.add(x.id); } groups.push(g); }
    const spread = (g) => { let m = 0; for (const a of g) for (const b of g) m = Math.max(m, hav(a, b)); return m; };
    const home = EX ? list.slice().sort((a, b) => homeKm(a) - homeKm(b) || rank(a, b)) : [];
    return { list, all, max, pairs, close: pairs[0], far: pairs[pairs.length - 1], clusters: groups.filter((g) => g.length > 1).sort((a, b) => b.length - a.length), lone: groups.filter((g) => g.length === 1).map((g) => g[0]), spread, home,
      homeMax: home.length ? Math.max(...home.map(homeKm).filter(isNum), 1) : 1 };
  })();
  function homeKm(o) { return isNum(o.roadKm) ? o.roadKm : EX ? hav(o, EX) * FACTOR : NaN; }
  const homeMin = (o) => o.driveText || `~${driveMin(hav(o, EX))} min`;
  const driveMin = (k) => Math.max(1, Math.round(k * FACTOR / KMH * 60));
  const homeTxt = (o) => isNum(o.roadKm) ? `~${o.roadKm} km` : fmtKm(homeKm(o));
  const nn = (o) => String(o.n == null ? "" : o.n).padStart(2, "0");
  const near = (d, max) => { const t = Math.min(1, d / max), a = 0.62 * (1 - t) ** 1.4 + 0.04; return `background:rgba(255,194,0,${a.toFixed(2)});color:${a > 0.3 ? "#17140a" : "inherit"}`; };   // near is strong, far is faint
  const METHOD = `Drive times are straight-line distances at ${KMH} km/h with a ${FACTOR}x road factor${SP.note ? ` (${SP.note})` : ""}. Indicative, not routed.`;

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
    const nt = C.notes && C.notes[o.id], NL = { facade: "The facade", approach: "The way in", position: "Where it stands" }, NB = { imagery: "Modelled from imagery", unverified: "Not yet confirmed", workbook: "From the client's sheet", measured: "Measured on the map" };
    const about = nt ? `<section><h3 class="mono">About this model</h3><dl class="dp-open">${["position", "facade", "approach"].filter((k) => nt[k]).map((k) => `<dt>${NL[k]}${nt[k].basis ? ` <i class="dp-tag" data-b="${esc(nt[k].basis)}">${esc(NB[nt[k].basis] || nt[k].basis)}</i>` : ""}</dt><dd>${esc(nt[k].text)}</dd>`).join("")}</dl></section>` : "";
    return `<div class="dp-top">${head(o, "To confirm")}</div><h2 class="dp-name sm">Before you decide</h2>
      ${about}
      ${steps.length ? `<ol class="dp-steps">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : '<p class="dp-empty">Nothing is listed to confirm.</p>'}
      ${src.length ? `<section><h3 class="mono">What the sheet leaves open</h3><dl class="dp-open">${src.map((x) => `<dt>${esc(x.k)}</dt><dd>${esc(x.v)}</dd>`).join("")}</dl></section>` : ""}${srcLine()}`;
  }
  /* What stands out: the cards the 2D overview opens with, then each option with its headline tag and its "check first" chip */
  const cp = (A.copy && A.copy.overview) || {}, ins = (A.copy && A.copy.insights) || {};
  function overviewHTML(o) {
    const first = options.slice().sort((a, b) => a.n - b.n)[0], home = MX && MX.home[0];
    const card = (l, v, sub, id, lead) => `<button type="button" class="dp-card${lead ? " lead" : ""}" data-pick="${esc(id)}"><small>${esc(l)}</small><b>${esc(v)}</b><span>${esc(sub)}</span></button>`;
    const cards = [first && card(ins.first || "Ranked first", first.name, [o === first ? "Selected" : "", first.reason].filter(Boolean).join(" \u00b7 ") || first.address || "", first.id, true),
      home && card(ins.home || "Closest to today's office", homeTxt(home), `${home.name}, ${homeMin(home)} by road (est.)`, home.id)].filter(Boolean).join("");
    const flags = options.filter((x) => x.flag && x.flag.v), same = flags.length && flags.every((x) => x.flag.v === flags[0].flag.v);
    const list = options.map((x) => `<li data-id="${esc(x.id)}"><button type="button" data-pick="${esc(x.id)}"><span class="n">${nn(x)}</span><span class="t"><b>${esc(x.name)}</b>${x.address ? `<small>${esc(x.address)}</small>` : ""}${x.reason ? `<em>${esc(x.reason)}</em>` : ""}</span>
      <span class="r">${EX && isNum(homeKm(x)) ? `<b>${esc(homeTxt(x))}</b><small>${esc(homeMin(x))}</small>` : ""}${x.flag && x.flag.v ? `<i class="dp-chk" title="${esc(x.flag.v)}">check first</i>` : ""}</span></button></li>`).join("");
    return `<div class="dp-top"><span class="mono">${esc(cp.eyebrow || "Overview")}</span></div><h2 class="dp-name sm">${esc(cp.title || "The options")}</h2>${cp.intro ? `<p class="dp-sub">${esc(cp.intro)}</p>` : ""}
      ${cards ? `<section><h3 class="mono">What stands out</h3><div class="dp-cards">${cards}</div></section>` : ""}
      <section><h3 class="mono">${esc((A.copy && A.copy.ranking && A.copy.ranking.ungrouped) || "The options")} \u00b7 ${options.length}</h3><ul class="dp-opts">${list}</ul></section>
      ${same ? `<div class="dp-flag"><b>Check first</b><p>${esc(flags[0].flag.v)}</p></div>` : ""}${EX && EX.note ? `<p class="dp-note">${esc(EX.note)}</p>` : ""}${srcLine()}`;
  }

  /* Distances: today's office and each option against each option, straight line, as the 2D atlas computes them */
  let pair = null;   // [idA, idB]: the cell last clicked
  const exOf = (id) => EX && id === EX.id ? EX : options.find((x) => x.id === id);
  function mapHTML() {   // a plan of the pins, to scale: the selected pair is joined by a line
    const pts = MX.all.map((p) => ({ p, ...(p === EX ? { ex: true } : {}) })); const lat0 = pts.reduce((m, q) => m + q.p.lat, 0) / pts.length, kx = 111.32 * Math.cos(lat0 * Math.PI / 180), ky = 110.6;
    for (const q of pts) { q.x = q.p.lng * kx; q.y = -q.p.lat * ky; }
    const x0 = Math.min(...pts.map((q) => q.x)), x1 = Math.max(...pts.map((q) => q.x)), y0 = Math.min(...pts.map((q) => q.y)), y1 = Math.max(...pts.map((q) => q.y));
    const W0 = 340, H0 = 170, pad = 22, sc = Math.min((W0 - 2 * pad) / Math.max(x1 - x0, 0.5), (H0 - 2 * pad) / Math.max(y1 - y0, 0.5)), ox = (W0 - sc * (x1 - x0)) / 2, oy = (H0 - sc * (y1 - y0)) / 2;
    for (const q of pts) { q.X = ox + (q.x - x0) * sc; q.Y = oy + (q.y - y0) * sc; }
    const at = (id) => pts.find((q) => q.p.id === id), sel = getSel();
    const line = pair ? (() => { const a = at(pair[0]), b = at(pair[1]); return a && b ? `<line class="ln" x1="${a.X.toFixed(1)}" y1="${a.Y.toFixed(1)}" x2="${b.X.toFixed(1)}" y2="${b.Y.toFixed(1)}"/><text class="lk" x="${((a.X + b.X) / 2).toFixed(1)}" y="${((a.Y + b.Y) / 2 - 6).toFixed(1)}" text-anchor="middle">${fmtKm(hav(a.p, b.p))}</text>` : ""; })() : "";
    const dots = pts.map((q) => q.ex ? `<g><circle class="ex" cx="${q.X.toFixed(1)}" cy="${q.Y.toFixed(1)}" r="7"/><text x="${q.X.toFixed(1)}" y="${(q.Y + 19).toFixed(1)}" text-anchor="middle">Today</text></g>`
      : `<g data-pick="${esc(q.p.id)}" class="${q.p.id === sel ? "sel" : ""}${pair && pair.includes(q.p.id) ? " pr" : ""}"><circle cx="${q.X.toFixed(1)}" cy="${q.Y.toFixed(1)}" r="8"/><text x="${q.X.toFixed(1)}" y="${(q.Y + 3.5).toFixed(1)}" text-anchor="middle">${esc(String(q.p.n || ""))}</text></g>`).join("");
    return `<svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="Plan of the options and today's office, to scale">${line}${dots}</svg>`;
  }
  function pickText() {
    if (!pair) return "Pick a cell to join that pair on the plan.";
    const [a, b] = pair.map(exOf), d = hav(a, b);
    return `<b>${esc(a.name)}</b> to <b>${esc(b.name)}</b>: ${fmtKm(d)} straight line, about ${driveMin(d)} min by road.`;
  }
  function distancesHTML(o) {
    const { all, list, max, close, far, clusters, lone, spread, home, homeMax } = MX;
    const lab = (p) => p === EX ? "Now" : nn(p);
    const cell = (r, c) => { if (r === c) return `<td class="self">\u00b7</td>`; const d = hav(r, c);
      return `<td data-mx="${esc(r.id)}|${esc(c.id)}" style="${near(d, max)}"><button type="button" data-mx="${esc(r.id)}|${esc(c.id)}" aria-label="${esc(r.name)} to ${esc(c.name)}: ${fmtKm(d)}">${d < 10 ? d.toFixed(1) : Math.round(d)}</button></td>`; };
    const table = `<div class="dp-scroll"><table class="dp-mx"><caption class="vh">Straight-line kilometres between the options</caption><thead><tr><td></td>${all.map((c) => `<th scope="col" title="${esc(c.name)}">${lab(c)}</th>`).join("")}</tr></thead>
      <tbody>${all.map((r) => `<tr><th scope="row" title="${esc(r.name)}">${r === EX ? "Today" : `${nn(r)} ${esc(r.name)}`}</th>${all.map((c) => cell(r, c)).join("")}</tr>`).join("")}</tbody></table></div>`;
    const kpi = (l, p) => p ? `<div class="dp-kpi"><small>${l}</small><b>${fmtKm(p.d)}</b><span>${esc(p.a.name)} and ${esc(p.b.name)}</span></div>` : "";
    const cl = clusters.map((g) => `<p class="dp-clu"><b>${g.length} options within ${fmtKm(spread(g))} of each other</b>${g.map((x) => `<button type="button" data-pick="${esc(x.id)}">${nn(x)} ${esc(x.name)}</button>`).join("")}</p>`).join("");
    const lo = lone.length ? `<p class="dp-clu"><b>Stand-alone <span>(no other option within 2.5 km)</span></b>${lone.map((x) => `<button type="button" data-pick="${esc(x.id)}">${nn(x)} ${esc(x.name)}</button>`).join("")}</p>` : "";
    const bars = home.length ? `<section><h3 class="mono">How far each option moves the team from today's office</h3><ul class="dp-bars">${home.map((x) => `<li data-id="${esc(x.id)}"><button type="button" data-pick="${esc(x.id)}"><span class="l">${nn(x)} ${esc(x.name)}</span><span class="tr"><i style="width:${Math.round(Math.min(1, homeKm(x) / homeMax) * 100)}%"></i></span><span class="v" title="${esc(homeMin(x))}">${esc(homeTxt(x))}</span></button></li>`).join("")}</ul></section>` : "";
    return `<div class="dp-top"><span class="mono">Distances</span></div><h2 class="dp-name sm">How far apart the shortlist is</h2>
      <p class="dp-sub">Every option against every other and against today's office, straight-line kilometres.</p>
      <div class="dp-kpis">${kpi("Closest pair", close)}${far !== close ? kpi("Farthest pair", far) : ""}<div class="dp-kpi"><small>Clusters</small><b>${clusters.length}</b><span>groups within 2.5 km of each other</span></div></div>
      <div id="dp-map" class="dp-plan">${mapHTML()}</div><p id="dp-pick" class="dp-pick" aria-live="polite">${pickText()}</p>
      <section><h3 class="mono">The matrix</h3><div class="dp-leg"><span>Near</span><i></i><span>Far (${fmtKm(max)})</span></div>${table}</section>
      <section><h3 class="mono">Clusters</h3>${cl}${lo}</section>${bars}
      <p class="dp-note">${esc(METHOD)}${EX && EX.note ? " " + esc(EX.note) : ""}</p>${srcLine()}`;
  }
  const AVAIL = { overview: () => options.some((x) => x.reason || x.flag) || !!MX, offer: () => true, tradeoffs: () => true, compare: () => options.length > 1, distances: () => !!MX, next: () => ((A.meta && A.meta.nextSteps) || []).length || ((A.facts && A.facts.source) || []).length };
  const BUILD = { overview: overviewHTML, offer: offerHTML, tradeoffs: tradeHTML, compare: compareHTML, distances: distancesHTML, next: nextHTML };
  const TAB_LIST = (C.tabs || TABS.map((t) => t[0])).filter((k) => BUILD[k] && AVAIL[k]());

  /* ---------------------------------------------------------------- shell */
  const dock = document.createElement("nav"); dock.id = "data-dock"; dock.setAttribute("aria-label", "Numbers for this building");
  dock.innerHTML = TABS.filter(([k]) => TAB_LIST.includes(k)).map(([k, t]) => `<button type="button" data-tab="${k}" aria-pressed="false" aria-controls="data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg><span>${t}</span></button>`).join("");
  const top = document.querySelector("#top"), modes = document.querySelector("#modes");
  if (top) top.insertBefore(dock, modes || null); else document.body.append(dock);
  document.body.classList.add("has-data"); easyTabs(dock);
  const panel = document.createElement("aside"); panel.id = "data"; panel.hidden = true; panel.setAttribute("aria-label", "Numbers for this building");
  panel.innerHTML = `<button type="button" id="data-x" aria-label="Close">×</button><div id="data-body"></div>`;
  document.body.append(panel);
  const bodyEl = panel.querySelector("#data-body");
  let tab = null, raf = 0;
  const optOf = (id) => options.find((x) => x.id === id) || options[0];

  function render(keepScroll) {
    const o = optOf(getSel()), top0 = keepScroll ? panel.scrollTop : 0;
    if (!tab) return;
    bodyEl.innerHTML = BUILD[tab](o); panel.scrollTop = top0; mark(); if (tab === "distances" && pair) markPair();
  }
  const KEEP = new Set(["overview", "compare", "distances"]);   // views that only move their highlight when the building changes (focus stays where it is)
  function mark() {
    if (!KEEP.has(tab)) return; const id = getSel();
    for (const el of bodyEl.querySelectorAll("li[data-id],th[data-id],td[data-id]")) el.classList.toggle("sel", el.dataset.id === id);
    for (const b of bodyEl.querySelectorAll("button[data-pick]")) b.toggleAttribute("aria-current", b.dataset.pick === id);
    if (tab === "distances") { const m = bodyEl.querySelector("#dp-map"); if (m) m.innerHTML = mapHTML(); }
  }
  function markPair() {
    for (const td of bodyEl.querySelectorAll("td[data-mx]")) { const [a, b] = td.dataset.mx.split("|"); td.classList.toggle("on", !!pair && pair.includes(a) && pair.includes(b)); }
    const t = bodyEl.querySelector("#dp-pick"); if (t) t.innerHTML = pickText(); const m = bodyEl.querySelector("#dp-map"); if (m) m.innerHTML = mapHTML();
  }
  function layout() { document.body.classList.toggle("data-open", !!tab); document.body.dataset.dataTab = tab || ""; panel.dataset.w = tab === "compare" ? "wide" : "";
    for (const b of dock.querySelectorAll("button")) { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
    onLayout && onLayout(); wake && wake(900); }
  function open(t) {
    if (!BUILD[t]) return; const same = tab === t; tab = t; panel.hidden = false; if (!same) { panel.classList.remove("in"); void panel.offsetWidth; panel.classList.add("in"); }
    render(same); layout();
  }
  function close() { if (!tab) return; tab = null; panel.hidden = true; bodyEl.innerHTML = ""; layout(); }

  dock.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; if (tab === b.dataset.tab) close(); else open(b.dataset.tab); });
  panel.addEventListener("click", (e) => {
    if (e.target.closest("#data-x")) { const t = tab; close(); dock.querySelector(`[data-tab="${t}"]`)?.focus(); return; }
    const x = e.target.closest("button[data-mx]"); if (x) { pair = x.dataset.mx.split("|"); markPair(); return; }
    const p = e.target.closest("[data-pick]"); if (p && p.dataset.pick !== getSel()) select(p.dataset.pick);
  });
  addEventListener("keydown", (e) => { if (e.key !== "Escape" || !tab) return; if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    const t = tab; close(); dock.querySelector(`[data-tab="${t}"]`)?.focus(); });

  return {
    open, close,
    get tab() { return tab; },
    /* the explorer switched building: rebuild the open panel for it */
    select() { if (KEEP.has(tab)) mark(); else if (tab) render(false); },
    /* what the panel takes of the screen, for the camera to frame the rest: null when it is not showing */
    frame() { if (!tab || document.body.classList.contains("walk") || !panel.offsetWidth) return null;
      return { width: panel.offsetWidth, hud: tab !== "compare" }; },
  };
}
