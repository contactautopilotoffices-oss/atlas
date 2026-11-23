/* The guided tour: the hybrid format for an Atlas explorer.
   The 3D is the star. Each step flies the camera to one thing worth seeing (the building, its facade, the
   way in, the walk to the metro, the offered floor) while a short caption says what it is, how we know,
   and what is still unconfirmed. The same words can be read aloud (the browser's own voice; no audio files).

   An atlas supplies its steps in meta.world.story[optionId] = [{ view, title, text, basis, panel? }]:
     view   overview | facade | approach | metro | floor | stay   (world.js knows how to fly to each; stay leaves the camera)
     basis  workbook | measured | assumed | unverified | verified | mixed   (shown as a small tag, never hidden)
     panel  offer | tradeoffs | compare | next   (optional: opens that data panel beside the 3D, see world-data.js,
            which also adds the data steps from meta.world.dataLayer.tour and keeps the closing step last)
   world.js passes the helpers; this file owns only the panel, the voice and the order of play. */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BASIS = { workbook: "From the client's sheet", measured: "Measured on the map", assumed: "Modelled, not confirmed", unverified: "Not yet confirmed", verified: "Checked against imagery", mixed: "Mixed sources" };

export function createStory({ steps, go, onOpen, onClose }) {
  const root = document.createElement("section");
  root.id = "story"; root.hidden = true; root.setAttribute("aria-label", "Guided tour"); root.setAttribute("aria-live", "polite");
  root.innerHTML = `<header><span class="mono" id="st-count"></span><span class="st-basis" id="st-basis"></span><button type="button" id="st-x" aria-label="Close the tour">×</button></header>
    <h3 id="st-title"></h3><p id="st-text"></p>
    <footer><button type="button" id="st-prev" aria-label="Previous step">‹</button><div id="st-dots" role="tablist"></div><button type="button" id="st-next" aria-label="Next step">›</button>
    <button type="button" id="st-play" aria-pressed="false">Play</button><button type="button" id="st-say" aria-pressed="false" title="Read each step aloud">Voice</button></footer>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  let list = [], i = 0, open = false, playing = false, voice = false, timer = 0, token = 0;
  const speech = "speechSynthesis" in window;
  if (!speech) $("#st-say").hidden = true;

  const stop = () => { clearTimeout(timer); if (speech) speechSynthesis.cancel(); };
  const pick = () => { const v = speech ? speechSynthesis.getVoices() : []; return v.find((x) => /en[-_]IN/i.test(x.lang)) || v.find((x) => /^en/i.test(x.lang)) || null; };
  function after(ms, fn) { clearTimeout(timer); timer = setTimeout(fn, ms); }
  function advance() { if (!playing) return; if (i < list.length - 1) show(i + 1); else { playing = false; sync(); } }
  function speak(text, mine) {
    stop();
    if (voice && speech) {
      const u = new SpeechSynthesisUtterance(text); u.lang = "en-IN"; u.rate = 0.97; const v = pick(); if (v) u.voice = v;
      u.onend = () => { if (mine === token) after(900, advance); };
      speechSynthesis.speak(u);
    } else if (playing) after(Math.max(5200, text.length * 62), advance);   // reading time when there is no voice
  }
  function sync() {
    $("#st-play").textContent = playing ? "Pause" : "Play"; $("#st-play").setAttribute("aria-pressed", String(playing));
    $("#st-say").setAttribute("aria-pressed", String(voice)); $("#st-say").classList.toggle("on", voice);
    $("#st-prev").disabled = i === 0; $("#st-next").disabled = i >= list.length - 1;
    for (const d of root.querySelectorAll("#st-dots button")) { const on = +d.dataset.i === i; d.classList.toggle("on", on); d.setAttribute("aria-selected", String(on)); }
  }
  function show(n) {
    if (!list.length) return; i = Math.max(0, Math.min(list.length - 1, n)); const s = list[i]; token++;
    $("#st-count").textContent = `${String(i + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
    $("#st-title").textContent = s.title; $("#st-text").textContent = s.text;
    const b = $("#st-basis"); b.textContent = BASIS[s.basis] || ""; b.dataset.b = s.basis || ""; b.hidden = !s.basis;
    root.classList.remove("swap"); void root.offsetWidth; root.classList.add("swap");
    sync(); go(s.view, s); speak(s.title + ". " + s.text, token);
  }
  function build() {
    $("#st-dots").innerHTML = list.map((s, n) => `<button type="button" role="tab" data-i="${n}" aria-label="${esc(s.title)}"></button>`).join("");
  }
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.id === "st-x") close();
    else if (t.id === "st-prev") { playing = false; show(i - 1); }
    else if (t.id === "st-next") { playing = false; show(i + 1); }
    else if (t.id === "st-play") { playing = !playing; sync(); if (playing) { if (i >= list.length - 1) show(0); else speak(list[i].title + ". " + list[i].text, token); } else stop(); }
    else if (t.id === "st-say") { voice = !voice; sync(); if (voice) speak(list[i].title + ". " + list[i].text, token); else { stop(); if (playing) after(3000, advance); } }
    else if (t.dataset.i) { playing = false; show(+t.dataset.i); }
  });
  addEventListener("keydown", (e) => { if (!open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    if (e.key === "Escape") close(); else if (e.key === "ArrowRight") { playing = false; show(i + 1); } else if (e.key === "ArrowLeft") { playing = false; show(i - 1); } });

  function begin(optionId) { list = steps(optionId) || []; if (!list.length) return false; build(); open = true; root.hidden = false; document.body.classList.add("touring"); onOpen?.(); playing = false; show(0); return true; }
  function close() { open = false; playing = false; stop(); root.hidden = true; document.body.classList.remove("touring"); onClose?.(); }
  return {
    get open() { return open; },
    toggle(optionId) { open ? close() : begin(optionId); },
    /* the explorer switched option: restart the tour on the new one, or do nothing if it is closed */
    retarget(optionId) { if (!open) return; const keep = playing; list = steps(optionId) || []; if (!list.length) return close(); build(); playing = keep; show(0); },
    close,
  };
}
