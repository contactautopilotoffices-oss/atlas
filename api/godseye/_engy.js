/* Engy runner (engy.ai, OpenAI-compatible chat completions; works with any
   OpenAI-compatible endpoint via ENGY_BASE_URL).

   Engy has no built-in web search, so the model gets two tools that run
   here on our server: search_news (Google News for any query) and read_page
   (open a URL, get its text). The loop streams each round, runs whatever
   tools the model asks for, and goes again until it answers.

   If the endpoint or model rejects tool definitions, the run falls back to a
   single pass over the feed, and the prompt tells the model to mark every
   fact as unverified. */
"use strict";
const { systemPrompt, searchNews, readPage } = require("./_lib");
const exa = require("./_exa");

const BASE = (process.env.ENGY_BASE_URL || "https://api.engy.ai/v1").replace(/\/+$/, "");
const MAX_ROUNDS = 10;
const MAX_TOOL_CALLS = 20;

const SEARCH_WEB = { type: "function", function: {
  name: "search_web",
  description: "Search the whole web (Exa) for news and company pages from the last 90 days. Returns up to 6 pages with title, date, link and quoted passages. Best for verifying a specific event, finding headcount, India leadership or office plans.",
  parameters: { type: "object", properties: { query: { type: "string", description: "What to find, in plain words, e.g. 'Acme India headcount Bengaluru office 2026'." } }, required: ["query"], additionalProperties: false },
} };

const TOOLS = [
  { type: "function", function: {
    name: "search_news",
    description: "Search recent Indian and global business news (Google News, India edition). Returns up to 8 headlines with publisher, date and link. Use short, specific queries such as a company name plus 'funding' or 'office Bengaluru'.",
    parameters: { type: "object", properties: { query: { type: "string", description: "The search query." } }, required: ["query"], additionalProperties: false },
  } },
  { type: "function", function: {
    name: "read_page",
    description: "Open a public web page and return its title and main text (first ~7,000 characters). Use it on a primary source when you need exact dates, amounts, headcount or city.",
    parameters: { type: "object", properties: { url: { type: "string", description: "Full http(s) URL." } }, required: ["url"], additionalProperties: false },
  } },
];

/* Some open models (Qwen, DeepSeek) put their reasoning inside <think> tags
   in the normal content stream. This strips it while streaming, including a
   tag split across two chunks. */
function thinkFilter() {
  let inside = false, carry = "";
  const f = (chunk) => {
    let s = carry + chunk, out = "";
    carry = "";
    for (;;) {
      const tag = inside ? "</think>" : "<think>";
      const i = s.indexOf(tag);
      if (i === -1) {
        /* hold back a possible partial tag at the end */
        let keep = 0;
        for (let k = Math.min(tag.length - 1, s.length); k > 0; k--) if (tag.startsWith(s.slice(-k))) { keep = k; break; }
        if (!inside) out += s.slice(0, s.length - keep);
        carry = s.slice(s.length - keep);
        return out;
      }
      if (!inside) out += s.slice(0, i);
      s = s.slice(i + tag.length);
      inside = !inside;
    }
  };
  /* End of stream: anything held back was not a tag after all. */
  f.flush = () => { const out = inside ? "" : carry; carry = ""; return out; };
  return f;
}

async function* sse(body) {
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try { yield JSON.parse(data); } catch { /* keep-alive or partial line */ }
    }
  }
}

class EngyError extends Error {
  constructor(status, detail) { super(detail); this.status = status; }
}

async function completion({ model, messages, tools, signal }) {
  const r = await fetch(BASE + "/chat/completions", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.ENGY_API_KEY },
    body: JSON.stringify({
      model, messages, stream: true, max_tokens: 12000,
      stream_options: { include_usage: true },
      ...(tools ? { tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new EngyError(r.status, txt.slice(0, 400) || "HTTP " + r.status);
  }
  return r.body;
}

async function runEngy({ model, userMessage, send, addSources, onClose }) {
  const ctrl = new AbortController();
  onClose(() => ctrl.abort());
  let useTools = true;
  let messages = [{ role: "system", content: systemPrompt("tools") }, { role: "user", content: userMessage }];
  const usage = { input_tokens: 0, output_tokens: 0, searches: 0 };
  let calls = 0, finish = null;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    send("status", { text: round ? "Reading what it found" : "Scanning the market" });
    let body;
    try {
      body = await completion({ model, messages, tools: useTools ? (exa.enabled() ? [SEARCH_WEB, ...TOOLS] : TOOLS) : null, signal: ctrl.signal });
    } catch (e) {
      /* Tools rejected on the very first call: retry once without them. */
      if (useTools && round === 0 && e instanceof EngyError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403 && e.status !== 429) {
        useTools = false;
        messages = [{ role: "system", content: systemPrompt("none") }, { role: "user", content: userMessage }];
        send("status", { text: "This model cannot use search tools; answering from the feed and the checks already run" });
        round--; continue;
      }
      throw e;
    }

    send("round", {});
    const strip = thinkFilter();
    let content = "";
    const pending = []; // tool calls by index
    finish = null;
    for await (const ev of sse(body)) {
      if (ev.usage) { usage.input_tokens += ev.usage.prompt_tokens || 0; usage.output_tokens += ev.usage.completion_tokens || 0; }
      const ch = ev.choices && ev.choices[0];
      if (!ch) continue;
      const d = ch.delta || {};
      if (d.content) { const t = strip(d.content); if (t) { content += t; send("text", { t }); } }
      for (const tc of d.tool_calls || []) {
        const slot = pending[tc.index || 0] || (pending[tc.index || 0] = { id: "", name: "", args: "" });
        if (tc.id) slot.id = tc.id;
        if (tc.function && tc.function.name) slot.name += tc.function.name;
        if (tc.function && tc.function.arguments) slot.args += tc.function.arguments;
      }
      if (ch.finish_reason) finish = ch.finish_reason;
    }
    const tail = strip.flush();
    if (tail) { content += tail; send("text", { t: tail }); }

    const toolCalls = pending.filter(Boolean);
    if (!toolCalls.length) break;

    /* Text written before a tool call is narration, not the answer. */
    if (content) send("discard", {});
    messages.push({
      role: "assistant", content: content || null,
      tool_calls: toolCalls.map((c, i) => ({ id: c.id || "call_" + round + "_" + i, type: "function", function: { name: c.name, arguments: c.args || "{}" } })),
    });
    const results = await Promise.all(toolCalls.map(async (c, i) => {
      const id = c.id || "call_" + round + "_" + i;
      let args = {};
      try { args = JSON.parse(c.args || "{}"); } catch { return { id, out: { error: "Arguments were not valid JSON." } }; }
      if (++calls > MAX_TOOL_CALLS) return { id, out: { error: "Tool budget used up. Write the answer now from what you have." } };
      if (c.name === "search_news") {
        send("status", { text: "Searching: " + String(args.query || "").slice(0, 120) });
        usage.searches++;
        const out = await searchNews(args.query);
        addSources(out.results.map((x) => ({ url: x.link, title: x.title + " (" + x.publisher + ")", page_age: x.published_at ? x.published_at.slice(0, 10) : null })));
        return { id, out };
      }
      if (c.name === "search_web" && exa.enabled()) {
        send("status", { text: "Exa: " + String(args.query || "").slice(0, 120) });
        usage.searches++;
        const out = await exa.exaSearch(args.query, { num: 6, days: 90 });
        addSources(out.results.map((x) => ({ url: x.url, title: x.title, page_age: x.published })));
        return { id, out };
      }
      if (c.name === "read_page") {
        send("status", { text: "Reading: " + String(args.url || "").slice(0, 120) });
        const out = await readPage(args.url);
        if (!out.error) addSources([{ url: out.url, title: out.title || out.url }]);
        return { id, out };
      }
      return { id, out: { error: "Unknown tool " + c.name } };
    }));
    for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: JSON.stringify(r.out) });
  }

  if (finish === "length") send("status", { text: "Answer hit the length limit and was cut off" });
  return { stop_reason: finish, model, usage };
}

function engyError(e) {
  if (!(e instanceof EngyError)) return null;
  if (e.status === 401 || e.status === 403) return "The Engy API key was rejected. Check ENGY_API_KEY.";
  if (e.status === 429) return "Rate limited by Engy. Try again in a minute.";
  if (e.status === 404) return "Engy did not recognise the model. Check GODSEYE_MODEL. (" + e.message.slice(0, 160) + ")";
  return "Engy returned " + e.status + ": " + e.message.slice(0, 200);
}

module.exports = { runEngy, engyError, thinkFilter };
