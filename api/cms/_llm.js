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

/* JSON out of a model's answer, or an error that says why there is none:
   an answer that ran out of room (thinking counts against the limit), or
   one that wrote something else. `stop` is the reason the model stopped. */
function parseJSON(text, stop) {
  let s = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  const cut = stop === "max_tokens" || stop === "length";
  if (a >= 0 && b < a) throw Object.assign(new Error(cut ? "The model's answer was cut off before its JSON was finished. Use fewer or shorter files, or split a long document."
    : "The model's JSON was not finished. Press it again."), { status: 502 });
  if (a < 0) {
    const why = cut ? "it ran out of room before it wrote any. Press it again; if it keeps happening, use fewer or shorter files"
      : s ? `it wrote: "${s.slice(0, 120)}${s.length > 120 ? "…" : ""}"` : "it wrote nothing";
    throw Object.assign(new Error(`The model did not return JSON: ${why}.`), { status: 502 });
  }
  try { return JSON.parse(s.slice(a, b + 1)); }
  catch (e) {
    throw Object.assign(new Error(cut ? "The model's answer was cut off before its JSON was finished. Use fewer or shorter files, or split a long document."
      : `The model's JSON did not parse (${String(e.message).slice(0, 100)}). Press it again.`), { status: 502 });
  }
}

/* One Claude call, made the way God's Eye makes it: streamed, so a long
   answer never meets the SDK's limit on waiting, with room for thinking
   (current models think before answering, and those tokens count against
   max_tokens: a tight limit leaves no room for the answer) and an explicit
   effort, low for reading files, higher where the answer needs judgement.
   A model set through an environment variable that does not take an
   effort is asked again without one. */
async function claude({ model, system, content, maxTokens = 32000, effort = "low", client } = {}) {
  const Anthropic = require("@anthropic-ai/sdk");
  const c = client || new Anthropic();
  const ask = (withEffort) => c.messages.stream({
    model, max_tokens: maxTokens, ...(system ? { system } : {}),
    messages: [{ role: "user", content }],
    ...(withEffort && effort ? { output_config: { effort } } : {}),
  }).finalMessage();
  let r;
  try { r = await ask(true); }
  catch (e) {
    if (!(e && e.status === 400 && /effort|output_config/i.test(String(e.message)))) throw e;
    r = await ask(false);
  }
  if (r.stop_reason === "refusal") throw Object.assign(new Error("The model declined to answer this one. Press it again, or change the wording."), { status: 422 });
  const text = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, model: r.model, stop: r.stop_reason };
}

/* { system, user, maxTokens, temperature, effort } -> { json, text, model, provider }
   Claude no longer takes a temperature (any value is refused), so it only
   reaches the OpenAI-compatible endpoint; with Claude, how loose an answer
   is comes from the instructions and the effort. */
async function complete({ system, user, maxTokens = 16000, temperature = 0.2, effort = "low", fetchFn = fetch, client }, provider = providerName()) {
  if (!provider) throw Object.assign(new Error("This needs ENGY_API_KEY or ANTHROPIC_API_KEY set in Vercel."), { status: 503 });
  if (provider === "claude") {
    const r = await claude({ model: process.env.CMS_LLM_MODEL || "claude-sonnet-5-5", system, content: user, maxTokens: Math.max(maxTokens, 16000), effort, client });
    return { json: parseJSON(r.text, r.stop), text: r.text, model: r.model, provider };
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
  const ch = (j.choices && j.choices[0]) || {};
  const t = (ch.message || {}).content || "";
  return { json: parseJSON(t, ch.finish_reason), text: t, model: j.model || model, provider };
}

module.exports = { providerName, ready, complete, claude, parseJSON };
