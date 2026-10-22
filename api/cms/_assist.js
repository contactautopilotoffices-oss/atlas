/* ============================================================================
   ATLAS CMS · the helper

   A model that works FROM the case bundle, never around it. It is given the
   numbers the costing engine produced and the rows the workbook holds, and
   asked for one kind of thing at a time:

     means      the "what it means for us" lines for pages that have none
     read       the decision page's "our read", and "read this first"
     risks      three risks with a figure each and how to reduce them
     prompts    a picture prompt for every slot
     check      what is thin, missing or inconsistent, in plain words
     research   market facts with sources, found on the web through Exa
                (EXA_API_KEY), shaped as candidate rows for the sheets

   Nothing it returns touches the draft by itself. The page shows each
   suggestion and the person adds it to the draft, where the usual
   checks and the publish step still stand between it and a client.
   ============================================================================ */
"use strict";
const llm = require("./_llm");
const Costing = require("../../casestudy/costing");
const { COPY_KEYS, SLOTS } = require("../../scripts/lib/case-schema");

const TASKS = ["means", "read", "risks", "prompts", "check", "research"];
const PAGE_OF = {
  readFirst: "the three things the numbers say, on the contents page", options: "the terms table", costing: "the costing line by line", earns: "what each floor earns and keeps (profit, commitment)",
  seat: "what one seat costs and what we must charge, against rivals", occupancy: "how full each floor must be; break-even; loss at rivals' occupancy", levers: "the negotiating levers and what each is worth",
  assets: "the buildings side by side", access: "getting there: stations and walking times", market: "the market section opener", deals: "recent deals in the area", flex: "flex as an established product",
  catchment: "who is in the catchment by sector", pools: "the three demand pools", infrastructure: "infrastructure developments", why: "why this location works", plan: "pipeline 1, broker-led", pipelines: "pipelines 2 to 5 and the ad budget",
  risks: "the top risks", rivals: "who sells next to our buildings", corridor: "the wider corridor of rivals", openings: "new centres opening nearby", occupancyRivals: "how full rivals run", ladder: "where we sit on the price ladder", decision: "the decision on one page",
};

const STYLE = `House style: plain spoken English a client reads aloud without stumbling. Short sentences. Indian rupee figures as the document writes them (₹21,560; ₹62.14 L; ₹3.07 Cr). No em dashes; use commas, colons and full stops. No marketing words, no exclamation marks, no bullet symbols inside a line. Never add a figure that is not in the DATA; if a point needs one the DATA lacks, say so in the check instead of inventing it.`;

/* The bundle as the model should see it: computed figures first, then the
   rows, trimmed so a 31-row survey does not drown the costing. */
function brief(b) {
  const c = Costing.caseCosting(b.options || [], b.assumptions || {});
  const money = c.options.map(o => ({ id: o.id, name: o.name, carpet: o.inputs.carpet, rentRate: o.inputs.rentRate, rentBasis: o.inputs.rentBasis, rentMonth: Math.round(o.rent), fitout: Math.round(o.fitout), costMonth: Math.round(o.total), billedMonth: Math.round(o.billed), seats: o.seats, priceSeat: Math.round(o.price), priceWithBrokerage: Math.round(o.withBrokerage.price), priceWithAds: Math.round(o.withAds.price), breakEven: +(o.breakEven * 100).toFixed(1), lossAt80pc: Math.round(Costing.atOccupancy(o, 0.8)), profitFullMonth: Math.round(o.profitFull), commitmentLockin: Math.round(o.commitment), rentShareOfPrice: +(o.rentShareOfPrice * 100).toFixed(0), levers: o.levers.map(l => ({ label: l.label, saving: Math.round(l.saving) })) }));
  const rivals = (b.rivals || []).map(r => ({ operator: r.operator, building: r.building, locality: r.locality, price: r.price, occ: r.occLow != null ? `${r.occLow}-${r.occHigh || r.occLow}%` : null, near: !!r.near, sameBuilding: r.sameBuilding || null }));
  const prices = rivals.map(r => r.price).filter(isFinite).sort((p, q) => p - q);
  return {
    meta: b.meta, assumptions: b.assumptions, costed: money, breakEvenPct: +(c.breakEven * 100).toFixed(1),
    rivalsSummary: { count: rivals.length, median: prices.length ? prices[Math.floor(prices.length / 2)] : null, min: prices[0] || null, max: prices[prices.length - 1] || null },
    rivals, openings: b.openings, access: b.access, kpis: b.kpis, series: b.series, deals: b.deals, occupiers: b.occupiers, pools: b.pools, points: b.points, lists: b.lists, decision: b.decision,
    copyPresent: Object.keys(b.copy || {}), imagesPresent: Object.keys(b.images || {}).filter(k => b.images[k] && b.images[k].url), imagePrompts: Object.fromEntries(Object.entries(b.images || {}).map(([k, v]) => [k, v.prompt])),
    options: (b.options || []).map(o => ({ id: o.id, name: o.name, address: o.address, locality: o.locality, stage: o.stage, built: o.built, reraDate: o.reraDate, occupant: o.occupant, verdict: o.verdict })),
  };
}

function ask(task, b, extra) {
  const data = JSON.stringify(brief(b));
  const keys = COPY_KEYS.filter(k => PAGE_OF[k]).map(k => `${k}: ${PAGE_OF[k]}`).join("\n");
  switch (task) {
    case "means": {
      const want = extra && extra.key ? [extra.key] : COPY_KEYS.filter(k => PAGE_OF[k] && !["readFirst", "decision", "market", "why", "assets", "options", "levers", "rivals"].includes(k) && !(b.copy || {})[k]);
      return { system: `You write the "What it means for us" lines of a managed-office business case for Autopilot Offices. ${STYLE}\nReply with ONE JSON object: { "copy": { "<key>": ["line", "line"] } }. Two or three lines per key, each one sentence or two, each a consequence for us (what to do, what to watch, what it costs), drawn from the DATA. Keys and the page each belongs to:\n${keys}`, user: `Write lines for these keys: ${want.join(", ")}.\n\nDATA\n${data}`, want };
    }
    case "read":
      return { system: `You write the closing judgement of a managed-office business case for Autopilot Offices. ${STYLE}\nReply with ONE JSON object: { "read": ["paragraph", "paragraph"], "readFirst": ["line", "line", "line"] }. "read" is two short paragraphs: which option is the case for this year and on what conditions, and what to do with the other. "readFirst" is the three things the numbers say, one sentence each, with the figure in it.`, user: `DATA\n${data}` };
    case "risks":
      return { system: `You name the top three risks of a managed-office business case. ${STYLE}\nReply with ONE JSON object: { "risks": [ { "title": "...", "kpi": "83%", "kpiLabel": "needed to break even", "text": "...", "mitigate": "..." } ] }. Exactly three. Each kpi is a figure from the DATA (or a code: breakEven, rivalsMedian, price). "text" is two or three sentences; "mitigate" one or two.`, user: `DATA\n${data}` };
    case "prompts":
      return { system: `You write picture prompts for the illustration slots of a business case. The pictures are editorial architectural photographs; the house style (muted, warm, no logos, no text) is added later, so do not repeat it. Reply with ONE JSON object: { "prompts": { "<slot>": "one sentence describing the scene" } } for the slots ${SLOTS.join(", ")}. Each scene must be specific to the place and the section: cover (the buildings and the place), options (an office floor), assets (the buildings from the street), market (the business district), infrastructure (transport), why (a working office with the city outside), plan (viewing or selling space, from a distance), rivals (the street of competing centres), back (a calm closing view).`, user: `DATA\n${data}` };
    case "check":
      return { system: `You review a managed-office business case before it goes to a client. ${STYLE}\nReply with ONE JSON object: { "findings": [ { "where": "sheet or page", "severity": "fix|check|thin", "note": "one or two sentences" } ] }. Look for: options with figures that do not add up or look mistyped (a rent of 20 or 2000, a carpet area in the wrong unit); rivals without prices or occupancy; a decision table with no edge; copy keys with no lines; image slots with no picture; claims in points that no series, deal or source backs; missing sources; dates older than a year. At most twelve findings, most important first.`, user: `DATA\n${data}` };
    default: throw Object.assign(new Error(`Unknown task "${task}". Use ${TASKS.join(", ")}.`), { status: 400 });
  }
}

/* The web, through Exa: facts with sources, shaped as rows for the sheets. */
async function research(b, { fetchFn = fetch } = {}) {
  if (!process.env.EXA_API_KEY) throw Object.assign(new Error("Research needs EXA_API_KEY set in Vercel."), { status: 503 });
  const meta = b.meta || {}, place = [meta.place, meta.city].filter(Boolean).join(", ") || "Mumbai";
  const queries = [
    `${place} office market vacancy rent 2026 report`,
    `${place} office leasing deals 2026 sq ft`,
    `${meta.city || place} flex coworking seats leased 2026`,
    `${place} metro airport infrastructure 2026 office`,
  ];
  const found = [];
  for (const q of queries) {
    const r = await fetchFn((process.env.EXA_BASE_URL || "https://api.exa.ai").replace(/\/+$/, "") + "/search", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.EXA_API_KEY },
      body: JSON.stringify({ query: q, type: "auto", numResults: 5, userLocation: "IN", startPublishedDate: new Date(Date.now() - 400 * 86400e3).toISOString(), contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } } }),
    });
    if (!r.ok) continue;
    const j = await r.json().catch(() => ({}));
    for (const x of j.results || []) found.push({ query: q, title: x.title, url: x.url, published: x.publishedDate || null, highlights: x.highlights || [] });
  }
  if (!found.length) return { findings: [], sources: [] };
  const out = await llm.complete({
    system: `You turn web search results into candidate rows for a business case's sheets, for a person to review. ${STYLE}\nReply with ONE JSON object: { "deals": [ { "who", "area", "rent", "building", "when", "kind", "note", "src" } ], "points": [ { "section": "market|infrastructure", "title", "text", "src" } ], "series": [ { "chart", "label", "value", "note", "src" } ] }. Only what the RESULTS state, with the result's URL in "src" every time. Leave a list empty rather than guess. Prefer figures with a date.`,
    user: `PLACE: ${place}\nDATED: ${meta.asOf || ""}\n\nRESULTS\n${JSON.stringify(found).slice(0, 60000)}`,
  });
  return { ...out.json, sources: found.map(f => ({ title: f.title, url: f.url, published: f.published })), model: out.model };
}

async function run(task, bundle, extra = {}, deps = {}) {
  if (task === "research") return { task, ...(await research(bundle, deps)) };
  const q = ask(task, bundle, extra);
  if (task === "means" && !q.want.length) return { task, copy: {}, note: "Every page already has its lines." };
  const r = await (deps.complete || llm.complete)({ system: q.system, user: q.user });
  const j = r.json || {};
  if (task === "means" && j.copy) for (const k of Object.keys(j.copy)) if (!COPY_KEYS.includes(k)) delete j.copy[k];
  if (task === "prompts" && j.prompts) for (const k of Object.keys(j.prompts)) if (!SLOTS.includes(k)) delete j.prompts[k];
  return { task, ...j, model: r.model, provider: r.provider };
}

/* Fold accepted suggestions into a bundle, the way the page does. */
function apply(bundle, s) {
  const b = JSON.parse(JSON.stringify(bundle || {}));
  if (s.copy) { b.copy = b.copy || {}; for (const [k, lines] of Object.entries(s.copy)) { b.copy[k] = (b.copy[k] || []).filter(x => x.role !== "means"); for (const t of lines) b.copy[k].push({ text: String(t), role: "means" }); } }
  if (s.read) { b.copy = b.copy || {}; b.copy.decision = (b.copy.decision || []).filter(x => x.role !== "read").concat(s.read.map(t => ({ text: String(t), role: "read" }))); }
  if (s.readFirst) { b.copy = b.copy || {}; b.copy.readFirst = s.readFirst.map(t => ({ text: String(t), role: "intro" })); }
  if (s.risks) { b.points = (b.points || []).filter(p => p.section !== "risks").concat(s.risks.map((r, i) => ({ section: "risks", n: i + 1, title: r.title, text: r.text, kpi: r.kpi, kpiLabel: r.kpiLabel, mitigate: r.mitigate }))); }
  if (s.prompts) { b.images = b.images || {}; for (const [k, p] of Object.entries(s.prompts)) b.images[k] = { ...(b.images[k] || {}), prompt: String(p) }; }
  if (s.deals) b.deals = (b.deals || []).concat(s.deals.map(d => ({ who: d.who, area: d.area, rent: d.rent, building: d.building, when: d.when, kind: d.kind, note: [d.note, d.src].filter(Boolean).join(" · ") })));
  if (s.points) b.points = (b.points || []).concat(s.points.map(p => ({ section: p.section === "infrastructure" ? "infrastructure" : "market", title: p.title, text: [p.text, p.src ? `Source: ${p.src}` : ""].filter(Boolean).join(" ") })));
  if (s.series) b.series = (b.series || []).concat(s.series.filter(x => isFinite(+x.value)).map(x => ({ chart: x.chart || "other", label: x.label, value: +x.value, note: [x.note, x.src].filter(Boolean).join(" · ") })));
  return b;
}

module.exports = { TASKS, run, apply, brief, ask };
