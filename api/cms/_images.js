/* ============================================================================
   ATLAS CMS · pictures for a case study, from Higgsfield

   Every case study has nine picture slots (cover, one per section opener,
   back). The workbook gives each slot a prompt in plain words; this turns
   it into a Higgsfield request in the house style, waits for the picture,
   copies it into our own storage (Higgsfield keeps its output URL for a
   week; ours is forever) and hands back the address the bundle stores.

   Higgsfield's API (docs.higgsfield.ai): submit to a model endpoint, poll
   the status URL until completed. Credentials are a key ID and secret from
   console.higgsfield.ai. Set it in Vercel as HIGGSFIELD_API_KEY, exactly as
   the console shows it: either one key, or the key ID and secret joined as
   ID:SECRET. (HIGGSFIELD_API_KEY_ID and HIGGSFIELD_API_KEY_SECRET, set as a
   pair, also work.) The model endpoint can be changed with
   HIGGSFIELD_MODEL_PATH (default: Soul, standard).

   The house style is fixed here, not in the workbook, so every picture in
   every case study is the same kind of picture: an editorial architectural
   photograph, muted and warm, no people in close-up, no text or logos, and
   it is always captioned as an AI-generated illustration on the page.
   ============================================================================ */
"use strict";
const store = require("./_store");

const BASE = (process.env.HIGGSFIELD_BASE_URL || "https://api.higgsfield.ai").replace(/\/+$/, "");
const MODEL_PATH = process.env.HIGGSFIELD_MODEL_PATH || "/higgsfield-ai/soul/v2/standard";
const STYLE = "Editorial architectural photograph for a business document: natural light, muted warm tones, realistic, wide composition, no people in close-up, no text, no signage, no logos, no watermark.";
const SLOT_HINTS = {
  cover: "Wide establishing view, room for a title on the left.",
  options: "An office floor or building interior, honest and unstaged.",
  assets: "The buildings and their street, from eye level.",
  market: "The business district: towers, traffic, movement.",
  infrastructure: "Transport: metro, roads, the airport.",
  why: "A working office with the city outside.",
  plan: "People at work selling or viewing office space, seen from a distance.",
  rivals: "The street of competing centres, evening.",
  back: "A calm aerial or dusk view, room for a closing line at the bottom.",
};

/* The credential as Higgsfield's Authorization header wants it: "Key <id>:<secret>",
   or "Key <key>" when the console gave a single key. */
function credential() {
  const one = String(process.env.HIGGSFIELD_API_KEY || "").trim().replace(/^Key\s+/i, "");
  if (one) return one;
  const id = String(process.env.HIGGSFIELD_API_KEY_ID || "").trim(), secret = String(process.env.HIGGSFIELD_API_KEY_SECRET || "").trim();
  return id && secret ? `${id}:${secret}` : "";
}
const ready = () => !!credential();
const authHeader = () => "Key " + credential();

/* The prompt Higgsfield gets: the slot's words, the slot's hint, the style. */
function promptFor(slot, words, meta) {
  const place = meta && (meta.place || meta.city) ? ` Setting: ${meta.place || ""}${meta.place && meta.city ? ", " : ""}${meta.city || ""}.` : "";
  return `${String(words || "").trim()}${place} ${SLOT_HINTS[slot] || ""} ${STYLE}`.replace(/\s+/g, " ").trim();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Submit, poll, return the first image URL. `fetchFn` and `sleepFn` are
   injectable for the test. */
async function generate(prompt, { fetchFn = fetch, sleepFn = sleep, aspect = "16:9", timeoutMs = 110000, idempotencyKey } = {}) {
  if (!ready()) throw Object.assign(new Error("Generating pictures needs HIGGSFIELD_API_KEY set in Vercel. Until then, paste an image address into the Images sheet."), { status: 503 });
  const r = await fetchFn(BASE + MODEL_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader(), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ prompt, aspect_ratio: aspect }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Higgsfield refused the request (${r.status}): ${String(j.detail || j.error || JSON.stringify(j)).slice(0, 200)}`), { status: 502 });
  if (!j.status_url) throw Object.assign(new Error("Higgsfield accepted the request but gave no status URL."), { status: 502 });
  const started = Date.now();
  let delay = 2000;
  for (;;) {
    await sleepFn(delay);
    delay = Math.min(delay * 1.5, 10000);
    const s = await fetchFn(j.status_url, { headers: { Authorization: authHeader() } });
    const st = await s.json().catch(() => ({}));
    if (st.status === "completed") {
      const url = st.images && st.images[0] && st.images[0].url;
      if (!url) throw Object.assign(new Error("Higgsfield finished but returned no image."), { status: 502 });
      return { url, requestId: j.request_id };
    }
    if (st.status === "failed" || st.status === "nsfw" || st.status === "canceled") throw Object.assign(new Error(`Higgsfield did not make the picture (${st.status})${st.error ? ": " + String(st.error).slice(0, 200) : ""}. Change the prompt and try again.`), { status: 422 });
    if (Date.now() - started > timeoutMs) throw Object.assign(new Error("Higgsfield is taking longer than this request may wait. Try again in a minute; the picture may be ready then."), { status: 504, requestId: j.request_id });
  }
}

/* Copy a picture into our storage under the case's slug, so the bundle
   never points at an address that expires. */
async function keep(url, slug, slot, { fetchFn = fetch } = {}) {
  const r = await fetchFn(url);
  if (!r.ok) throw Object.assign(new Error("The generated picture could not be fetched."), { status: 502 });
  const buf = Buffer.from(await r.arrayBuffer());
  const type = r.headers.get("content-type") || "image/jpeg";
  const ext = /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : "jpg";
  const path = `${slug}/case-${slot}-${Date.now().toString(36)}.${ext}`;
  const signed = await store.signUpload(path);
  const put = await fetchFn(signed.uploadUrl.startsWith("/") ? signed.uploadUrl : signed.uploadUrl, { method: signed.method || "PUT", headers: { "Content-Type": type, ...(store.MODE === "supabase" ? { "x-upsert": "true" } : {}) }, body: buf });
  if (!put.ok) throw Object.assign(new Error("The picture could not be saved to storage."), { status: 502 });
  return { url: signed.publicUrl, bytes: buf.length, type };
}

module.exports = { ready, promptFor, generate, keep, STYLE, SLOT_HINTS };
