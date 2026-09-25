/* Exa (exa.ai) search, used two ways:

   1. The evidence pack. Before the model runs, the server searches Exa for the
      question, the pinned headlines and the strongest feed signals, and puts
      what it finds (title, date, link, quoted highlights) into the prompt.
      This needs no tool support from the model, so verification works on any
      provider, including an Engy model that cannot call tools.
   2. The search_web tool, for models that can call tools.

   Optional: without EXA_API_KEY both are skipped and the desk works as before. */
"use strict";

const BASE = (process.env.EXA_BASE_URL || "https://api.exa.ai").replace(/\/+$/, "");
const enabled = () => !!process.env.EXA_API_KEY;

async function exaSearch(query, { num = 5, days = 45 } = {}) {
  const q = String(query || "").slice(0, 400).trim();
  if (!q) return { query: q, results: [] };
  try {
    const r = await fetch(BASE + "/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.EXA_API_KEY },
      body: JSON.stringify({
        query: q,
        type: "auto",
        category: "news",
        numResults: num,
        userLocation: "IN",
        startPublishedDate: new Date(Date.now() - days * 86400e3).toISOString(),
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { query: q, error: (r.status === 401 || r.status === 403 ? "Exa key rejected" : "HTTP " + r.status) + (t ? ": " + t.slice(0, 160) : ""), results: [] };
    }
    const j = await r.json();
    return {
      query: q,
      results: (j.results || []).map((x) => ({
        title: String(x.title || "").slice(0, 300),
        url: x.url,
        published: x.publishedDate ? String(x.publishedDate).slice(0, 10) : null,
        author: x.author || null,
        highlights: (x.highlights || []).slice(0, 2).map((h) => String(h).replace(/\s+/g, " ").trim().slice(0, 500)),
      })).filter((x) => x.url),
    };
  } catch (e) {
    return { query: q, error: String(e && e.message || e), results: [] };
  }
}

/* Which feed items are worth checking before the model even starts: the
   newest ones that carry a demand tag. Pinned items always go first. */
const DEMAND = ["funding", "gcc", "hiring", "expansion", "leasing", "competitor", "contraction"];
function pickCandidates(feed, focus, max = 5) {
  if (focus && focus.length) return focus.slice(0, max);
  return (feed && feed.items || []).filter((i) => (i.tags || []).some((t) => DEMAND.includes(t))).slice(0, max);
}

async function buildEvidence({ question, feed, focus, send, addSources }) {
  if (!enabled()) return null;
  const jobs = [{ query: question, num: 8, label: "the question" }]
    .concat(pickCandidates(feed, focus).map((it) => ({ query: it.title, num: 4, label: it.title })));
  send("status", { text: `Checking ${jobs.length} leads with Exa` });
  const packs = await Promise.all(jobs.map(async (j) => {
    const out = await exaSearch(j.query, { num: j.num });
    send("status", { text: (out.error ? "Exa failed: " : "Exa: ") + j.label.slice(0, 100) + (out.error ? " (" + out.error.slice(0, 60) + ")" : ` (${out.results.length} pages)`) });
    addSources(out.results.map((x) => ({ url: x.url, title: x.title, page_age: x.published })));
    return out;
  }));
  return { fetched_at: new Date().toISOString(), searches: packs.length, packs };
}

function formatEvidence(ev) {
  if (!ev) return "";
  const lines = [`<evidence source="Exa news search, run by the server just now" fetched_at="${ev.fetched_at}">`,
    "Pages found while checking the question and the top feed signals. A fact confirmed here counts as checked: cite the page, with its date."];
  for (const p of ev.packs) {
    lines.push(`## Search: ${p.query}`);
    if (p.error) { lines.push(`(search failed: ${p.error})`); continue; }
    if (!p.results.length) { lines.push("(no pages found)"); continue; }
    for (const r of p.results) {
      lines.push(`- [${r.published || "date unknown"}] ${r.title} ${r.url}`);
      for (const h of r.highlights) lines.push(`  > ${h}`);
    }
  }
  lines.push("</evidence>");
  return lines.join("\n");
}

module.exports = { enabled, exaSearch, buildEvidence, formatEvidence };
