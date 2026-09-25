/* Splits a desk answer into the shape SYSTEM_PROMPT asks for: a preamble,
   a Verdict, a list of bets, and other sections. Anything that does not match
   stays as markdown, so a partial (still streaming) or unusual answer always
   renders. */
import { findCity } from "./model.js";

const SCORE_PARTS = [["Signal", "signal", 30], ["Timing", "timing", 25], ["Fit", "fit", 20], ["Reach", "reach", 15], ["Evidence", "evidence", 10]];

export function parseBet(block) {
  const lines = block.split("\n");
  const head = (lines.shift() || "").trim();
  const m = head.match(/^(\d+)[.)]?\s*(.+?)(?:\s*[·•|:,-]+\s*(\d{1,3})\s*\/\s*100)?\s*$/);
  if (!m) return null;
  const fields = [];
  let cur = null;
  for (const raw of lines) {
    const fm = raw.match(/^\s*[-*•]\s+\*\*(.+?):?\*\*:?\s*(.*)$/);
    if (fm) { cur = { label: fm[1].replace(/:$/, "").trim(), text: fm[2] }; fields.push(cur); }
    else if (raw.trim() && cur) cur.text += " " + raw.trim();
    else if (raw.trim()) { cur = { label: "", text: raw.trim().replace(/^[-*•]\s+/, "") }; fields.push(cur); }
  }
  const field = (re) => (fields.find((f) => re.test(f.label)) || {}).text || "";
  const scoreText = field(/^score/i);
  const parts = SCORE_PARTS.map(([label, key, max]) => {
    const r = scoreText.match(new RegExp(key + "\\D{0,12}(\\d+)\\s*\\/\\s*" + max, "i"));
    return { label, value: r ? +r[1] : null, max };
  });
  const name = m[2].replace(/\*\*/g, "").trim();
  const where = field(/^where/i);
  return {
    n: +m[1], name, score: m[3] ? +m[3] : null, parts,
    fields: fields.filter((f) => !/^score/i.test(f.label)),
    city: findCity(where) || findCity(name),
  };
}

export function parseAnswer(text) {
  const secs = String(text || "").split(/^##\s+/m);
  const out = { preamble: secs[0], verdict: null, bets: [], betsIntro: "", sections: [] };
  if (secs.length < 2) return out;
  for (const sec of secs.slice(1)) {
    const nl = sec.indexOf("\n");
    const title = (nl < 0 ? sec : sec.slice(0, nl)).trim();
    const body = nl < 0 ? "" : sec.slice(nl + 1);
    if (/^verdict/i.test(title)) out.verdict = body;
    else if (/bets/i.test(title) && /^###\s+/m.test(body)) {
      const blocks = body.split(/^###\s+/m);
      out.betsIntro = blocks[0];
      for (const b of blocks.slice(1)) {
        const bet = parseBet(b);
        if (bet) out.bets.push(bet); else out.sections.push({ title: "", body: "### " + b });
      }
    } else out.sections.push({ title, body });
  }
  return out;
}
