/* POST /api/godseye/ask
   Body: { question: string, focus?: FeedItem[], ping?: true }
   Header: x-godseye-key

   Streams Server-Sent Events back to the page:
     status  {text}                 what the desk is doing ("Searching: ...")
     round   {}                     a new model turn starts
     text    {t}                    a chunk of the answer (markdown)
     discard {}                     drop the text of the current round (it was
                                    narration before a tool call, not answer)
     sources {items:[{url,title}]}  links the model read or cited
     done    {stop_reason, model, provider, usage}
     error   {message}

   Provider, chosen by GODSEYE_PROVIDER or else by which key is set:
     engy    ENGY_API_KEY       open models on engy.ai, with our own
                                search_news and read_page tools
     claude  ANTHROPIC_API_KEY  Claude with Anthropic's built-in web search */
"use strict";
const { getFeed, checkAccess, buildUserMessage } = require("./_lib");
const { runClaude, claudeError } = require("./_claude");
const { runEngy, engyError } = require("./_engy");

const PROVIDERS = {
  engy:   { key: "ENGY_API_KEY",      model: "engy/deepseek-v4-flash-0731", run: runEngy,   explain: engyError },
  claude: { key: "ANTHROPIC_API_KEY", model: "claude-opus-5",               run: runClaude, explain: claudeError },
};
function provider() {
  const want = (process.env.GODSEYE_PROVIDER || "").toLowerCase();
  const name = PROVIDERS[want] ? want : process.env.ENGY_API_KEY ? "engy" : process.env.ANTHROPIC_API_KEY ? "claude" : "engy";
  const p = PROVIDERS[name];
  return { name, ...p, model: process.env.GODSEYE_MODEL || p.model, ready: !!process.env[p.key] };
}

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
  const P = provider();
  if (body.ping) return json(200, { ok: true, provider: P.name, model: P.model, key_configured: P.ready, key_name: P.key });

  if (!P.ready) return json(503, { error: P.key + " is not set on the server yet." });
  const question = clip(body.question, 4000).trim();
  if (!question) return json(400, { error: "Ask a question." });

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  /* res, not req: since Node 16 req "close" fires once the body is read,
     which would end the stream before it starts. */
  let closed = false;
  const closers = [];
  res.on("close", () => { closed = true; if (!res.writableEnded) closers.forEach((f) => f()); });
  const send = (event, data) => { if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  /* Proxies drop idle streams; a comment line every 15s keeps it open while
     the model is searching and nothing else is being written. */
  const beat = setInterval(() => { if (!closed) res.write(": keep-alive\n\n"); }, 15000);

  const seen = new Set();
  const addSources = (list) => {
    const fresh = list.filter((s) => s.url && !seen.has(s.url));
    fresh.forEach((s) => seen.add(s.url));
    if (fresh.length) send("sources", { items: fresh });
  };

  try {
    send("status", { text: "Reading the live feed" });
    let feed = null;
    try { feed = await getFeed(); } catch { send("status", { text: "Live feed unavailable, relying on search" }); }
    const userMessage = buildUserMessage({ question, feed, focus: cleanFocus(body.focus) });
    const result = await P.run({ model: P.model, userMessage, send, addSources, onClose: (f) => closers.push(f) });
    send("done", { ...result, provider: P.name });
  } catch (e) {
    if (!closed) send("error", { message: P.explain(e) || String(e && e.message || e) });
  } finally {
    clearInterval(beat);
    if (!closed) res.end();
  }
};
