/* ============================================================================
   ATLAS GUIDE · a small talking face for the study pages

   Shows once the page's gate is passed. People type or speak a question; the
   server (/api/guide/ask) answers from this page's own data file and returns
   a mood for the face, an optional place to fly the map to, and the source
   links behind the answer. The guide reads its answer aloud when voice is on.

   The page only needs to include this file and atlas-guide.css. It finds its
   page from the data globals (CHN_*, NOI_*, WF) and drives the map through the
   page's own select(id, fly) function.
   ============================================================================ */
(function () {
  "use strict";

  const PAGE = window.CHN_OPTIONS ? "chennai" : window.NOI_OPTIONS ? "noida" : window.WF ? "whitefield" : null;
  if (!PAGE) return;

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  function suggestions() {
    if (PAGE === "chennai") {
      const O = window.CHN_OPTIONS;
      return ["Which options are the best fit, and why?", `How far is ${O[0].name} from the current office?`, "Which option is closest to a station?", "What is the rent at each option?"];
    }
    if (PAGE === "noida") {
      const O = window.NOI_OPTIONS, pick = O.find((o) => o.pick) || O[0];
      return ["What are Autopilot's top picks?", `Tell me about ${pick.name}.`, "Which buildings have parking problems?"];
    }
    const site = window.WF.site;
    return [`Tell me about Autopilot's offices at ${site.name}.`, `What is ${site.name}?`, "What is the nearest metro station to the site?", "Which big companies lease nearby?"];
  }

  /* The open option on the page, if any. `S` is the page's top-level state. */
  function selectedId() {
    try { return (typeof S !== "undefined" && S && S.sel) || null; } catch (e) { return null; } // eslint-disable-line no-undef
  }
  function showOnMap(id) {
    try { if (typeof window.select === "function") window.select(id, true); } catch (e) {}
  }

  /* --------------------------------------------------------------- face -- */
  const FACE = `
<svg class="ag-face" viewBox="0 0 120 120" aria-hidden="true">
  <ellipse class="ag-shadow" cx="60" cy="112" rx="30" ry="4"/>
  <g class="ag-head">
    <rect class="ag-skin" x="14" y="12" width="92" height="92" rx="40"/>
    <ellipse class="ag-shine" cx="42" cy="32" rx="16" ry="8"/>
    <g class="ag-gaze"><g class="ag-eyes">
      <g class="ag-eye ag-eye-l"><g class="ag-lid"><rect x="37" y="42" width="13" height="26" rx="6.5"/><circle class="ag-glint" cx="46" cy="48" r="2.6"/></g></g>
      <g class="ag-eye ag-eye-r"><g class="ag-lid"><rect x="70" y="42" width="13" height="26" rx="6.5"/><circle class="ag-glint" cx="79" cy="48" r="2.6"/></g></g>
    </g></g>
    <g class="ag-mouths">
      <path class="ag-m ag-m-neutral" d="M50 82 Q60 87 70 82"/>
      <path class="ag-m ag-m-happy" d="M46 79 Q60 93 74 79"/>
      <path class="ag-m ag-m-flat" d="M52 84 L68 83"/>
      <path class="ag-m ag-m-doubt" d="M51 85 Q60 81 70 83"/>
      <ellipse class="ag-m ag-m-o" cx="60" cy="84" rx="4.5" ry="5.5"/>
      <ellipse class="ag-m ag-m-talk" cx="60" cy="83" rx="7" ry="4"/>
    </g>
  </g>
</svg>`;

  const root = document.createElement("div");
  root.className = "ag-root ag-mood-neutral";
  root.innerHTML = `
<button type="button" class="ag-fab" aria-label="Ask the Atlas guide">${FACE}<span>Ask Atlas</span></button>
<section class="ag-panel" role="dialog" aria-label="Atlas guide" hidden>
  <header class="ag-head-bar">
    <div class="ag-avatar">${FACE}</div>
    <div class="ag-title"><strong>Atlas guide</strong><small>Answers from this study's data only</small></div>
    <button type="button" class="ag-icon ag-voice" aria-label="Voice"></button>
    <button type="button" class="ag-icon ag-close" aria-label="Close guide">✕</button>
  </header>
  <div class="ag-list" aria-live="polite"></div>
  <form class="ag-form">
    <input class="ag-input" type="text" maxlength="600" placeholder="Ask about this study" aria-label="Your question" autocomplete="off">
    <button type="button" class="ag-icon ag-mic" aria-label="Speak your question" hidden>🎙</button>
    <button type="submit" class="ag-send" aria-label="Ask">Ask</button>
  </form>
</section>`;

  const $ = (s) => root.querySelector(s);
  const panel = $(".ag-panel"), list = $(".ag-list"), input = $(".ag-input"), sendBtn = $(".ag-send"), micBtn = $(".ag-mic"), voiceBtn = $(".ag-voice");
  const history = [];
  let busy = false;
  let voiceOn = store.get("atlas-guide-voice", "1") === "1";

  function setMood(mood) {
    root.className = root.className.replace(/\bag-mood-\w+/g, "").trim() + " ag-mood-" + mood;
  }
  function setTalking(on) { root.classList.toggle("ag-talking", on); }

  /* Blink every few seconds; the eyes drift toward the pointer when idle. */
  (function blinkLoop() {
    setTimeout(() => {
      root.classList.add("ag-blink");
      setTimeout(() => root.classList.remove("ag-blink"), 140);
      blinkLoop();
    }, 2600 + Math.random() * 3200);
  })();
  document.addEventListener("pointermove", (e) => {
    const box = root.getBoundingClientRect();
    const dx = Math.max(-1, Math.min(1, (e.clientX - (box.left + box.width / 2)) / 400));
    const dy = Math.max(-1, Math.min(1, (e.clientY - (box.top + box.height / 2)) / 400));
    root.style.setProperty("--ag-gx", (dx * 4).toFixed(2) + "px");
    root.style.setProperty("--ag-gy", (dy * 3).toFixed(2) + "px");
  }, { passive: true });

  /* ------------------------------------------------------------ messages -- */
  function renderEmpty() {
    list.innerHTML = `<div class="ag-hello"><p>Hi, I'm the Atlas guide. Ask me anything about the options on this page. If something isn't in the study, I'll tell you.</p>
      <div class="ag-chips">${suggestions().map((s) => `<button type="button" class="ag-chip">${esc(s)}</button>`).join("")}</div></div>`;
  }
  function addTurn(role, html) {
    if (list.querySelector(".ag-hello")) list.innerHTML = "";
    const el = document.createElement("div");
    el.className = "ag-turn ag-" + role;
    el.innerHTML = html;
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
    return el;
  }

  function speak(text) {
    if (!voiceOn || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 1.02;
    u.onstart = () => setTalking(true);
    u.onend = u.onerror = () => setTalking(false);
    speechSynthesis.speak(u);
  }
  function renderVoice() {
    voiceBtn.textContent = voiceOn ? "🔊" : "🔇";
    voiceBtn.setAttribute("aria-label", voiceOn ? "Mute the guide's voice" : "Let the guide speak");
  }

  async function ask(text) {
    const question = text.trim();
    if (!question || busy) return;
    busy = true; sendBtn.disabled = true; input.value = "";
    addTurn("user", `<p>${esc(question)}</p>`);
    const pending = addTurn("bot", `<p class="ag-dots"><i></i><i></i><i></i></p>`);
    setMood("thinking");
    try {
      const res = await fetch("/api/guide/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: PAGE, question, history: history.slice(-8), selected: selectedId() }),
      });
      const data = await res.json().catch(() => ({ error: "The guide answered in a way this page could not read." }));
      if (data.error || !data.say) throw new Error(data.error || "No answer came back.");
      history.push({ role: "user", text: question }, { role: "assistant", text: data.say });
      const links = (data.sources || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(host(u))} ↗</a>`).join("");
      const showBtn = data.show ? `<button type="button" class="ag-show" data-id="${esc(data.show)}">Show on map</button>` : "";
      pending.innerHTML = `<p>${esc(data.say)}</p>${links || showBtn ? `<div class="ag-meta">${showBtn}${links}</div>` : ""}`;
      setMood(data.mood || "neutral");
      if (data.show) showOnMap(data.show);
      speak(data.say);
    } catch (e) {
      pending.className = "ag-turn ag-error";
      pending.innerHTML = `<p>${esc(e.message || "Something went wrong.")}</p>`;
      setMood("doubtful");
    } finally {
      busy = false; sendBtn.disabled = false;
      list.scrollTop = list.scrollHeight;
    }
  }

  /* ---------------------------------------------------------------- wiring -- */
  function open() { panel.hidden = false; root.classList.add("ag-open"); if (!list.children.length) renderEmpty(); setTimeout(() => input.focus(), 50); }
  function close() { panel.hidden = true; root.classList.remove("ag-open"); if ("speechSynthesis" in window) speechSynthesis.cancel(); setTalking(false); }
  $(".ag-fab").addEventListener("click", open);
  $(".ag-close").addEventListener("click", close);
  voiceBtn.addEventListener("click", () => { voiceOn = !voiceOn; store.set("atlas-guide-voice", voiceOn ? "1" : "0"); if (!voiceOn && "speechSynthesis" in window) { speechSynthesis.cancel(); setTalking(false); } renderVoice(); });
  $(".ag-form").addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  list.addEventListener("click", (e) => {
    const chip = e.target.closest(".ag-chip"); if (chip) { ask(chip.textContent); return; }
    const show = e.target.closest(".ag-show"); if (show) showOnMap(show.dataset.id);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });

  /* Speech input, where the browser has it and the page's permissions allow the mic. */
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const pp = document.permissionsPolicy || document.featurePolicy;
  const micAllowed = !pp || typeof pp.allowsFeature !== "function" || pp.allowsFeature("microphone");
  if (Rec && micAllowed) {
    micBtn.hidden = false;
    micBtn.addEventListener("click", () => {
      if (busy) return;
      const rec = new Rec();
      rec.lang = "en-IN"; rec.interimResults = false;
      rec.onresult = (ev) => ask(ev.results[0][0].transcript);
      rec.onend = rec.onerror = () => { micBtn.classList.remove("ag-on"); input.placeholder = "Ask about this study"; };
      micBtn.classList.add("ag-on"); input.placeholder = "Listening…";
      rec.start();
    });
  }
  renderVoice();

  /* Appear only after the page's sign-in gate is gone or hidden. */
  function gateOpen() {
    const g = document.getElementById("gate");
    return !g || g.hidden || g.classList.contains("out") || getComputedStyle(g).display === "none";
  }
  (function mountWhenReady() {
    if (gateOpen()) document.body.appendChild(root);
    else setTimeout(mountWhenReady, 400);
  })();
})();
