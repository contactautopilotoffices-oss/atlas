/* The premium opening screen (see world-loader.css). An atlas opts in with meta.world.loader = { slides[], stages[], title? };
   the figures follow the real download (the #l-bar width world.js already writes) with a gentle creep so it never looks stuck,
   and the stages tick over as it passes each mark. */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STAGES = ["Surveying the district", "Raising the buildings", "Growing the trees", "Finishing the textures", "Setting the light"];
export function premiumLoader({ slides = [], stages = STAGES, data = "", ver = "" }) {
  const root = document.querySelector("#load"), box = root && root.querySelector(".box"), bar = document.querySelector("#l-bar");
  if (!root || !box) return;
  if (!document.querySelector("link[data-pl]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/engine/world-loader.css"; l.dataset.pl = ""; document.head.appendChild(l); }
  root.classList.add("pl"); root.style.backgroundImage = "none";
  const bg = document.createElement("div"); bg.className = "pl-slides"; bg.style.setProperty("--n", slides.length || 1);
  bg.innerHTML = slides.map((u, i) => `<i style="--i:${i};background-image:url('${esc(data + u + ver)}')"></i>`).join("");
  root.prepend(bg);
  root.insertAdjacentHTML("afterbegin", '<div class="pl-grid"></div><div class="pl-scan"></div><div class="pl-corners"><b></b><b></b><b></b><b></b></div>');
  const C = 2 * Math.PI * 92;
  const ring = document.createElement("div"); ring.className = "pl-ring"; ring.setAttribute("aria-hidden", "true");
  ring.innerHTML = `<svg viewBox="0 0 208 208">
      <circle class="r1" cx="104" cy="104" r="102" stroke="rgba(255,194,0,.55)" stroke-width="1" stroke-dasharray="2 9"/>
      <circle class="r3" cx="104" cy="104" r="98" stroke="rgba(255,255,255,.22)" stroke-width="5" stroke-dasharray="1 5.1"/>
      <circle class="r2" cx="104" cy="104" r="86" stroke="rgba(255,194,0,.85)" stroke-width="2" stroke-dasharray="46 24 8 24 90 40"/>
      <circle class="track" cx="104" cy="104" r="92"/>
      <circle class="prog" cx="104" cy="104" r="92" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg>
    <div class="pl-pct"><b id="pl-n">0</b><small id="pl-t">Loading</small></div>`;
  const msg = box.querySelector("#l-msg"), title = box.querySelector("#l-title");
  title && title.after(ring);
  const list = document.createElement("ul"); list.className = "pl-steps"; list.setAttribute("aria-label", "Loading steps");
  list.innerHTML = stages.map((s) => `<li><i></i><span>${esc(s)}</span><em></em></li>`).join("");
  msg && msg.after(list);
  if (msg) msg.textContent = "Building the city around the buildings.";
  const items = [...list.children], prog = ring.querySelector(".prog"), num = ring.querySelector("#pl-n"), tag = ring.querySelector("#pl-t");
  let shown = 0, real = 0, t0 = performance.now(), done = false;
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  function paint(p) {
    p = Math.max(0, Math.min(100, p)); num.textContent = Math.round(p); prog.style.strokeDashoffset = (C * (1 - p / 100)).toFixed(1);
    const at = (p / 100) * stages.length;
    items.forEach((li, i) => { const ok = at >= i + 1 || p >= 100, on = !ok && at >= i; li.className = ok ? "ok" : on ? "on" : ""; li.lastElementChild.textContent = ok ? "done" : on ? "working" : ""; });
    tag.textContent = p >= 100 ? "Ready" : "Loading";
  }
  function tick() {
    if (!root.isConnected) return;
    const w = bar ? parseFloat(bar.style.width) || 0 : 0; real = Math.max(real, w);
    if (real >= 100) done = true;
    const creep = Math.min(88, 6 + (performance.now() - t0) / 90);          // eases up to 88% on its own while the models download and parse
    const target = done ? 100 : Math.max(real * 0.97, Math.min(creep, real + 22));
    shown += (target - shown) * (reduce ? 1 : 0.07); if (target - shown < 0.3) shown = target;
    paint(shown); requestAnimationFrame(tick);
  }
  paint(0); requestAnimationFrame(tick);
}
