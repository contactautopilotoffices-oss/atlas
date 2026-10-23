/* ============================================================================
   ATLAS CMS · one call to a model

   The helper and the PDF reader both need the same thing: give a model a
   system prompt and a question, get JSON back. Provider by key, the same
   keys God's Eye uses: ANTHROPIC_API_KEY (Claude) or ENGY_API_KEY (engy.ai,
   OpenAI-compatible). CMS_LLM_PROVIDER picks when both are set;
   CMS_LLM_MODEL overrides the model.
   ============================================================================ */
"use strict";

function providerName() {
  const want = (process.env.CMS_LLM_PROVIDER || process.env.CMS_PDF_PROVIDER || "").toLowerCase();
  if (want === "claude" && process.env.ANTHROPIC_API_KEY) return "claude";
  if (want === "engy" && process.env.ENGY_API_KEY) return "engy";
  return process.env.ANTHROPIC_API_KEY ? "claude" : process.env.ENGY_API_KEY ? "engy" : null;
}
const ready = () => !!providerName();

function parseJSON(text) {
  let s = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw Object.assign(new Error("The model did not return JSON."), { status: 502 });
  return JSON.parse(s.slice(a, b + 1));
}

/* { system, user, maxTokens, temperature } -> { json, text, model, provider }
   Claude no longer takes a temperature (any value is refused), so it only
   reaches the OpenAI-compatible endpoint; with Claude, how loose an answer
   is comes from the instructions. */
async function complete({ system, user, maxTokens = 8000, temperature = 0.2, fetchFn = fetch }, provider = providerName()) {
  if (!provider) throw Object.assign(new Error("This needs ENGY_API_KEY or ANTHROPIC_API_KEY set in Vercel."), { status: 503 });
  if (provider === "claude") {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic();
    const r = await client.messages.create({ model: process.env.CMS_LLM_MODEL || "claude-sonnet-5-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
    const t = (r.content.find((b) => b.type === "text") || {}).text || "";
    return { json: parseJSON(t), text: t, model: r.model, provider };
  }
  const base = (process.env.ENGY_BASE_URL || "https://api.engy.ai/v1").replace(/\/+$/, "");
  const model = process.env.CMS_LLM_MODEL || "engy/deepseek-v4-flash-0731";
  const res = await fetchFn(base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.ENGY_API_KEY },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw Object.assign(new Error(`The model endpoint answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`), { status: 502 });
  const j = await res.json();
  const t = ((j.choices && j.choices[0] && j.choices[0].message) || {}).content || "";
  return { json: parseJSON(t), text: t, model: j.model || model, provider };
}

module.exports = { providerName, ready, complete, parseJSON };
