/* ============================================================================
   ATLAS CMS · Enhance: a rough requirement into a structured brief

   The person types what the client needs in their own words ("120 seats near
   the metro, under 18k"). Enhance reads that with the text of the files they
   brought and returns a brief with fixed keys, every one of which the admin
   shows as an editable field. Reading the files into rows stays strict; this
   is the one step allowed to infer, suggest and fill gaps, and it has to say
   what it assumed so a person can correct it.

   It runs looser than reading: temperature 0.8 on the OpenAI-compatible
   endpoint. Claude no longer takes a temperature, so there the looseness
   comes from these instructions, and pressing Enhance again still gives a
   different take.
   ============================================================================ */
"use strict";
const llm = require("./_llm");

const KEYS = ["Client", "In one line", "Seats", "Area (sq ft)", "Budget", "Where", "Move-in", "Term", "Office type",
  "Must have", "Nice to have", "Avoid", "Rank on", "From the documents", "Assumptions", "Questions to ask"];
const LISTS = new Set(["Where", "Must have", "Nice to have", "Avoid", "Rank on", "From the documents", "Assumptions", "Questions to ask"]);
const NUMBERS = new Set(["Seats", "Area (sq ft)"]);
const TEMPERATURE = 0.8;
const MAX_TEXT = 60000;

const RULES = `You turn a rough office requirement into a clear, structured brief for a property search in India. You get the requirement in the person's own words and the text of the documents they have (inventories, lists of centres, notes). The brief decides what the atlas built from those documents shows and how it ranks the options.

Reply with ONE JSON object and nothing else, using only these keys (leave a key out when there is nothing to say):
- "Client": who it is for.
- "In one line": the requirement restated plainly in one sentence.
- "Seats": a number. "Area (sq ft)": a number, carpet area. If only one is given you may estimate the other at 60 to 70 sq ft of carpet a seat, and say so under "Assumptions".
- "Budget": in the units the person used (per seat a month, or per sq ft on carpet).
- "Where": a list of micro-markets or localities.
- "Move-in": month and year. "Term": lock-in or lease length.
- "Office type": managed office, conventional lease, coworking, or open to all.
- "Must have", "Nice to have", "Avoid": lists.
- "Rank on": what matters most, most important first (rent, metro distance, floor plate, grade, date available and so on).
- "From the documents": a list of what the documents say that bears on this brief, with their figures (for example "4 buildings offered, rents Rs 300 to 375 a sq ft on carpet").
- "Assumptions": a list of everything you inferred rather than read.
- "Questions to ask": a list of what is missing and worth asking the client.

Be useful the way a good broker is: infer what is reasonable, suggest what the person has not thought of, and fill gaps, but put every inference in "Assumptions". Never present a figure the requirement or the documents do not support as fact; a range you worked out from the documents says so. If a current brief is given, the person may have edited it: keep what they wrote unless the requirement contradicts it, and improve the rest. Plain words, short lines, no em dashes, no markdown.`;

/* What the model sent, held to the keys the admin knows how to show. */
function tidy(raw) {
  const out = {};
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const clean = (v) => String(v == null ? "" : v).replace(/\u2014/g, ", ").replace(/\s+/g, " ").trim().slice(0, 400);
  for (const k of KEYS) {
    const v = src[k];
    if (v == null || v === "") continue;
    if (LISTS.has(k)) {
      const list = (Array.isArray(v) ? v : String(v).split(/\n|;\s*/)).map(clean).filter(Boolean).slice(0, 20);
      if (list.length) out[k] = list;
    } else if (NUMBERS.has(k)) {
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[, ]/g, ""));
      out[k] = isFinite(n) ? Math.round(n) : clean(v);
    } else out[k] = clean(Array.isArray(v) ? v.join(", ") : v);
  }
  return out;
}

/* { requirement, text, brief } -> { brief, model, provider } */
async function enhance({ requirement, text, brief }, { complete = llm.complete } = {}) {
  const req = String(requirement || "").trim();
  if (!req && !(brief && Object.keys(brief).length)) throw Object.assign(new Error("Describe the requirement first: a line or two in your own words is enough."), { status: 400 });
  const docs = String(text || "").slice(0, MAX_TEXT);
  const user = [
    `THE REQUIREMENT, IN THE PERSON'S WORDS\n${req.slice(0, 4000) || "(none: improve the current brief)"}`,
    brief && Object.keys(brief).length ? `THE CURRENT BRIEF\n${JSON.stringify(brief, null, 1).slice(0, 8000)}` : "",
    docs ? `THE DOCUMENTS' TEXT${String(text).length > MAX_TEXT ? " (the start of it)" : ""}\n${docs}` : "THE DOCUMENTS' TEXT\n(no documents yet)",
  ].filter(Boolean).join("\n\n");
  const r = await complete({ system: RULES, user, maxTokens: 4000, temperature: TEMPERATURE });
  const out = tidy(r.json);
  if (!Object.keys(out).length) throw Object.assign(new Error("The model returned an empty brief. Press Enhance again."), { status: 502 });
  return { brief: out, model: r.model, provider: r.provider };
}

module.exports = { enhance, tidy, KEYS, LISTS, TEMPERATURE, RULES };
