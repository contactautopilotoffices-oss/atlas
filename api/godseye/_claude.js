/* Claude runner: one streamed request with Anthropic's server-side web
   search, plus continuations when the search loop pauses. */
"use strict";
const Anthropic = require("@anthropic-ai/sdk");
const { systemPrompt } = require("./_lib");

const MAX_CONTINUATIONS = 4;

async function runClaude({ model, userMessage, send, addSources, onClose }) {
  const client = new Anthropic();
  const messages = [{ role: "user", content: userMessage }];
  let final = null;
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    send("status", { text: turn ? "Continuing the search" : "Scanning the market" });
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: systemPrompt("web"),
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
    onClose(() => stream.abort());
    final = await stream.finalMessage();
    if (final.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: final.content });
  }
  if (final && final.stop_reason === "refusal") {
    send("error", { message: "The model declined this request. Rephrase the question around companies, markets or office demand." });
  } else if (final && final.stop_reason === "max_tokens") {
    send("status", { text: "Answer hit the length limit and was cut off" });
  }
  const u = final && final.usage || {};
  return {
    stop_reason: final && final.stop_reason, model: final && final.model,
    usage: { input_tokens: u.input_tokens, output_tokens: u.output_tokens, searches: u.server_tool_use ? u.server_tool_use.web_search_requests : null },
  };
}

function claudeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by the API. Try again in a minute.";
  if (e instanceof Anthropic.APIConnectionError) return "Could not reach the Anthropic API.";
  return null;
}

module.exports = { runClaude, claudeError };
