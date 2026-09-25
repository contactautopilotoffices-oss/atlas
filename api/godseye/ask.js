/* POST /api/godseye/ask
   Body: { question: string, focus?: FeedItem[], ping?: true }
   Header: x-godseye-key

   Streams Server-Sent Events back to the page:
     status  {text}              what the desk is doing ("Searching: ...")
     text    {t}                 a chunk of the answer (markdown)
     sources {items:[{url,title}]} links the model read or cited
     done    {stop_reason, model, usage}
     error   {message}

   One call = one Claude request with live web search, plus up to a few
   continuations when the server-side search loop pauses. */
"use strict";
const Anthropic = require("@anthropic-ai/sdk");
const { getFeed, checkAccess, SYSTEM_PROMPT, buildUserMessage } = require("./_lib");

const MODEL = process.env.GODSEYE_MODEL || "claude-opus-5";
const MAX_CONTINUATIONS = 4;

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/* Pinned items come from the browser, so they are re-shaped and clipped here:
   the model sees plain strings of bounded length, never arbitrary objects. */
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
function cleanFocus(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 12).map((it) => ({
    title: clip(it.title, 300), link: clip(it.link, 600), publisher: clip(it.publisher, 80),
    published_at: clip(it.published_at, 40) || null,
    tags: Array.isArray(it.tags) ? it.tags.slice(0, 8).map((t) => clip(t, 20)) : [],
    cities: Array.isArray(it.cities) ? it.cities.slice(0, 5).map((t) => clip(t, 30)) : [],
    amount: it.amount ? clip(it.amount, 40) : null,
  }));
}

module.exports = async (req, res) => {
  const json = (status, obj) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const gate = checkAccess(req);
  if (!gate.ok) return json(gate.status, { error: gate.error });

  let body;
  try { body = await readBody(req); } catch { return json(400, { error: "Body is not valid JSON." }); }
  if (body.ping) return json(200, { ok: true, model: MODEL, key_configured: !!process.env.ANTHROPIC_API_KEY });

  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: "ANTHROPIC_API_KEY is not set on the server yet." });
  const question = clip(body.question, 4000).trim();
  if (!question) return json(400, { error: "Ask a question." });

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  let closed = false;
  /* res, not req: since Node 16 req "close" fires once the body is read,
     which would end the stream before it starts. */
  res.on("close", () => { closed = true; });
  const send = (event, data) => { if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  /* Proxies drop idle streams; a comment line every 15s keeps it open while
     the model is searching and nothing else is being written. */
  const beat = setInterval(() => { if (!closed) res.write(": keep-alive\n\n"); }, 15000);

  try {
    send("status", { text: "Reading the live feed" });
    let feed = null;
    try { feed = await getFeed(); } catch (e) { send("status", { text: "Live feed unavailable, relying on web search" }); }

    const client = new Anthropic();
    const messages = [{ role: "user", content: buildUserMessage({ question, feed, focus: cleanFocus(body.focus) }) }];
    const seen = new Set();
    const addSources = (list) => {
      const fresh = list.filter((s) => s.url && !seen.has(s.url));
      fresh.forEach((s) => seen.add(s.url));
      if (fresh.length) send("sources", { items: fresh });
    };

    let final = null;
    for (let turn = 0; turn <= MAX_CONTINUATIONS && !closed; turn++) {
      send("status", { text: turn ? "Continuing the search" : "Scanning the market" });
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: SYSTEM_PROMPT,
        tools: [{
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 15,
          user_location: { type: "approximate", country: "IN", city: "Mumbai", region: "Maharashtra", timezone: "Asia/Kolkata" },
        }],
        messages,
      });
      stream.on("text", (delta) => send("text", { t: delta }));
      stream.on("contentBlock", (block) => {
        if (block.type === "server_tool_use" && block.input && block.input.query) {
          send("status", { text: "Searching: " + block.input.query });
        } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          addSources(block.content.filter((r) => r.type === "web_search_result").map((r) => ({ url: r.url, title: r.title, page_age: r.page_age || null })));
        } else if (block.type === "text" && Array.isArray(block.citations)) {
          addSources(block.citations.filter((c) => c.url).map((c) => ({ url: c.url, title: c.title, cited: true })));
        }
      });
      res.on("close", () => { if (!res.writableEnded) stream.abort(); });
      final = await stream.finalMessage();

      if (final.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: final.content });
        continue;
      }
      break;
    }

    if (final && final.stop_reason === "refusal") {
      send("error", { message: "The model declined this request. Rephrase the question around companies, markets or office demand." });
    } else if (final && final.stop_reason === "max_tokens") {
      send("status", { text: "Answer hit the length limit and was cut off" });
    }
    send("done", { stop_reason: final && final.stop_reason, model: final && final.model, usage: final && final.usage });
  } catch (e) {
    let message = String(e && e.message || e);
    if (e instanceof Anthropic.AuthenticationError) message = "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
    else if (e instanceof Anthropic.RateLimitError) message = "Rate limited by the API. Try again in a minute.";
    else if (e instanceof Anthropic.APIConnectionError) message = "Could not reach the Anthropic API.";
    send("error", { message });
  } finally {
    clearInterval(beat);
    if (!closed) res.end();
  }
};
