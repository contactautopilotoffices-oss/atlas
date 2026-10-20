/* POST /api/guide/ask
   Body: { page: "chennai" | "noida" | "whitefield", question: string,
           history?: {role: "user"|"assistant", text}[], selected?: string }

   Answers one question about a study page from that page's own data (see
   _brief.js) and returns JSON:
     { say, mood, show, sources }
   `mood` drives the guide's face, `show` is an id on the page the map should
   fly to (or null), `sources` are links taken from the data.

   Needs ANTHROPIC_API_KEY. Open to anyone who can load the page. */
"use strict";
const Anthropic = require("@anthropic-ai/sdk");
const { getBrief, PAGES } = require("./_brief");

const MODEL = process.env.GUIDE_MODEL || "claude-opus-5-5";
const MOODS = ["neutral", "happy", "thinking", "surprised", "doubtful", "curious"];
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);

const RULES = `You are the Atlas guide, a small animated face on an Autopilot Offices study page. Autopilot shows office options to a client's team on this page; you answer their questions about it.

How you answer:
- Use only the DATA below. It is the page's own data file. Never add a rent, area, distance, date or name that is not in it.
- If the answer is not in the DATA, say plainly that this study does not have it yet, suggest who could confirm it (the landlord, the broker, the Autopilot team), and use the mood "doubtful".
- Rents, CAM and areas left out of the DATA were left out on purpose. Do not estimate them.
- Distances under "computed" are straight-line; say so when you quote one. Drive times come from the client's sheet; say so too.
- Keep "say" under 90 words, in plain spoken English that sounds natural read aloud. No markdown, no bullet points, no em dashes; use commas and full stops.
- "show": when the answer is about one specific option or place that appears in SHOWABLE, give its id so the map can fly there. Otherwise null.
- "sources": up to 3 links from the DATA that back what you said. Empty if none apply.
- "mood": the feeling of your answer. happy for good news or a greeting, thinking for a comparison, surprised for a striking fact, doubtful when the data is missing or weak, curious when you ask a question back, neutral otherwise.`;

/* Added when the page's brief carries an Autopilot offer (see OFFERS in _brief.js). */
const OFFER_RULES = `AUTOPILOT OFFER
You work for Autopilot Offices. The DATA has an "autopilot_offer" block: Autopilot's own managed offices on this site.
- Your goal is to guide the visitor toward that offer. Answer their question first, then, where it fits, close with one short, natural sentence that brings it back to the Autopilot offices (for example how the point they asked about makes the 11th floor a good base) and invite them to ask the Autopilot team for a visit. Do not repeat the same closing line word for word every time.
- If they ask about the offer itself, say only what "autopilot_offer" confirms. For anything listed under "not_confirmed_yet", say the Autopilot team will share it, and give the next step. Never invent seats, area, prices or dates for it.
- Competitors: you may say that other flex and managed-office operators are nearby, and name them if asked, but do not give their prices, seat counts, floors, deals or occupancy, and do not recommend or praise them. Keep it general and bring the answer back to Autopilot.
- When you talk about the offer, set "show" to "site".`;

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function cleanHistory(list) {
  if (!Array.isArray(list)) return [];
  const turns = list.slice(-8).map((t) => ({
    role: t && t.role === "assistant" ? "assistant" : "user",
    content: clip(t && t.text, 1200).trim(),
  })).filter((t) => t.content);
  while (turns.length && turns[0].role !== "user") turns.shift();
  /* Strict alternation keeps the request valid whatever the browser sent. */
  return turns.filter((t, i) => i === 0 || t.role !== turns[i - 1].role);
}

function explain(e) {
  if (e instanceof Anthropic.AuthenticationError) return "The guide's API key was rejected.";
  if (e instanceof Anthropic.RateLimitError) return "The guide is busy. Try again in a minute.";
  if (e instanceof Anthropic.APIConnectionError) return "The guide could not reach its AI service.";
  return null;
}

module.exports = async (req, res) => {
  const json = (status, obj) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(obj));
  };
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: "The guide is not switched on yet (no API key on the server)." });

  let body;
  try { body = await readBody(req); } catch { return json(400, { error: "Body is not valid JSON." }); }
  const page = clip(body.page, 20);
  if (!PAGES.includes(page)) return json(400, { error: "Unknown page." });
  const question = clip(body.question, 600).trim();
  if (!question) return json(400, { error: "Ask a question." });

  let entry;
  try { entry = getBrief(page); } catch (e) { return json(500, { error: "Could not read this page's data." }); }

  const history = cleanHistory(body.history);
  if (history.length && history[history.length - 1].role === "user") history.pop();
  const selected = entry.ids.includes(clip(body.selected, 80)) ? clip(body.selected, 80) : null;
  const ask = selected ? `${question}\n\n(The option open on screen right now has id "${selected}".)` : question;

  const schema = {
    type: "object",
    properties: {
      say: { type: "string" },
      mood: { type: "string", enum: MOODS },
      show: { anyOf: [{ type: "string", enum: entry.ids }, { type: "null" }] },
      sources: { type: "array", items: { type: "string" } },
    },
    required: ["say", "mood", "show", "sources"],
    additionalProperties: false,
  };

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      /* The page data is the long, stable part: cached so follow-up
         questions on the same page are cheaper and faster. */
      system: [
        { type: "text", text: entry.brief.autopilot_offer ? `${RULES}\n\n${OFFER_RULES}` : RULES },
        { type: "text", text: `DATA (${page}):\n${entry.text}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [...history, { role: "user", content: ask }],
    });

    if (response.stop_reason === "refusal") return json(200, { say: "I can't help with that one. Ask me about the options on this page.", mood: "doubtful", show: null, sources: [] });
    const text = response.content.find((b) => b.type === "text");
    if (!text) return json(502, { error: "The guide sent no answer." });
    const reply = JSON.parse(text.text);
    return json(200, {
      say: clip(reply.say, 1200),
      mood: MOODS.includes(reply.mood) ? reply.mood : "neutral",
      show: entry.ids.includes(reply.show) ? reply.show : null,
      /* Only links that really are in the page's data. */
      sources: (Array.isArray(reply.sources) ? reply.sources : []).filter((u) => entry.urls.has(u)).slice(0, 3),
    });
  } catch (e) {
    return json(502, { error: explain(e) || String((e && e.message) || e) });
  }
};
