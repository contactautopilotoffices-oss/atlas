/* The opening screen (see world-loader.css). An atlas opts in with meta.world.loader = { slides[{src,name,tag}], stages[] }.
   Behind: the rendered buildings, side by side. In front: a small isometric city that builds itself, stage by stage (environment,
   buildings, trees, textures, light), driven by the loading progress. Unhurried on purpose: it holds for at least MIN ms and never
   moves faster than the calm pace, however fast the download is. world.js asks window.__plRemain() how much longer to wait. */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STAGES = ["Laying out the environment", "Raising the buildings", "Growing the trees", "Finishing the textures", "Setting the light"];
const CUT = [0, 0.2, 0.46, 0.68, 0.88, 1];                        // where each stage begins and ends along 0 to 1
const MIN = 9000, RATE = 11;                                      // at least 9 s; never faster than 11% a second
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), seg = (p, a, b) => clamp((p - a) / (b - a));
const easeOut = (t) => 1 - (1 - t) ** 3, back = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function premiumLoader({ slides = [], stages = STAGES, data = "", ver = "" }) {
  const root = document.querySelector("#load"), box = root && root.querySelector(".box"), bar = document.querySelector("#l-bar");
  if (!root || !box) return;
  if (!document.querySelector("link[data-pl]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/engine/world-loader.css"; l.dataset.pl = ""; document.head.appendChild(l); }
  root.classList.add("pl"); root.style.backgroundImage = "none";
  const bg = document.createElement("div"); bg.className = "pl-bg"; bg.style.setProperty("--n", slides.length || 1);
  bg.innerHTML = slides.map((s, i) => `<figure style="--i:${i}"><i style="background-image:url('${esc(data + s.src + ver)}')"></i><figcaption><b>${esc(s.tag || "")}</b>${esc(s.name || "")}</figcaption></figure>`).join("");
  root.prepend(bg);

  const msg = box.querySelector("#l-msg"), title = box.querySelector("#l-title");
  if (msg) msg.textContent = "Building the district around each building.";
  const cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true");
  const stat = document.createElement("div"); stat.className = "pl-stat"; stat.innerHTML = '<b id="pl-s"></b><span><em id="pl-n">0</em>%</span>';
  const line = document.createElement("div"); line.className = "pl-line"; line.innerHTML = "<i></i>";
  (msg || title).after(cv); cv.after(stat); stat.after(line);
  const sEl = stat.querySelector("#pl-s"), nEl = stat.querySelector("#pl-n"), fill = line.firstChild;
  const ctx = cv.getContext("2d"); let W = 0, H = 0, dpr = 1;
  function size() { dpr = Math.min(2, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = Math.max(280, r.width); H = W * 0.625; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size(); addEventListener("resize", size);

  /* the little city: a grid of lots, every third line a road */
  const R = rng(67), N = 10, lots = [], trees = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i % 3 === 2 || j % 3 === 2) continue;
    const d = Math.hypot(i - 4.5, j - 4.5), hero = i === 4 && j === 4;
    lots.push({ i, j, w: 0.78 + R() * 0.12, dd: 0.78 + R() * 0.12, h: hero ? 5.2 : 1 + R() * 3 * (1.1 - d / 9), hero, d, tone: R(), win: 2 + (R() * 3 | 0) });
  }
  const road = (a) => a % 3 === 2;
  for (let k = 0; k < 150; k++) { const i = R() * N, j = R() * N; if (!(road(Math.floor(i)) || road(Math.floor(j)) || (Math.floor(i) % 3 === 0 && Math.floor(j) % 3 === 0 && R() < 0.3))) continue; trees.push({ i, j, s: 0.7 + R() * 0.6, at: R() }); }
  lots.sort((a, b) => a.i + a.j - (b.i + b.j));

  const tw = () => W / (N * 2.25), th = () => tw() / 2, ox = () => W / 2, oy = () => H * 0.2, zh = () => tw() * 0.62;
  const P = (i, j, z = 0) => [ox() + (i - j) * tw(), oy() + (i + j) * th() - z * zh()];
  const poly = (pts, fillS, strokeS, lw = 1) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fillS) { ctx.fillStyle = fillS; ctx.fill(); } if (strokeS) { ctx.strokeStyle = strokeS; ctx.lineWidth = lw; ctx.stroke(); } };

  function frame(p, now) {
    ctx.clearRect(0, 0, W, H);
    const a = seg(p, CUT[0], CUT[1]), b = seg(p, CUT[1], CUT[2]), c = seg(p, CUT[2], CUT[3]), d = seg(p, CUT[3], CUT[4]), e = seg(p, CUT[4], CUT[5]);
    // 1 the environment: the ground plate and the street grid draw themselves
    ctx.globalAlpha = easeOut(clamp(p / 0.1)); poly([P(0, 0), P(N, 0), P(N, N), P(0, N)], "rgba(255,255,255,.035)", "rgba(207,230,255,.45)", 1); ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(207,230,255,.22)"; ctx.lineWidth = 1;
    for (let k = 1; k < N; k++) {
      const t = easeOut(clamp(a * 1.25 - k / N * 0.25)); if (t <= 0) continue;
      let [x0, y0] = P(k, 0), [x1, y1] = P(k, N); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); ctx.stroke();
      [x0, y0] = P(0, k); [x1, y1] = P(N, k); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); ctx.stroke();
    }
    if (a > 0.5) { const f = `rgba(255,255,255,${0.04 * easeOut((a - 0.5) * 2)})`; for (let k = 2; k < N; k += 3) { poly([P(k, 0), P(k + 1, 0), P(k + 1, N), P(k, N)], f); poly([P(0, k), P(N, k), P(N, k + 1), P(0, k + 1)], f); } }
    // 3 the trees (drawn first, so the buildings stand in front of them)
    for (const t of trees) {
      const q = clamp((c - t.at * 0.7) / 0.3), k = easeOut(q), kk = back(q); if (c <= 0 || k <= 0) continue;
      const [x, y] = P(t.i, t.j), s = tw() * 0.2 * t.s * kk;
      ctx.fillStyle = `rgba(90,70,50,${k})`; ctx.fillRect(x - 0.7, y - s * 1.2, 1.4, s * 1.2);
      ctx.beginPath(); ctx.arc(x, y - s * 1.7, s, 0, 7);
      ctx.fillStyle = d > 0 ? `rgba(${88 + 40 * d | 0},${150 + 40 * d | 0},${92 + 20 * d | 0},${k})` : `rgba(127,214,138,${0.14 * k})`; ctx.fill();
      ctx.strokeStyle = `rgba(127,214,138,${0.85 * k * (1 - d * 0.3)})`; ctx.lineWidth = 1; ctx.stroke();
    }
    // 2 the buildings rise in a wave from the middle; 4 their faces take their textures
    for (const l of lots) {
      const g = easeOut(clamp((b * 1.5 - l.d / 9 * 0.5) / 0.9)); if (b <= 0 || g <= 0) continue;
      const z = l.h * g, x0 = l.i + 0.1, y0 = l.j + 0.1, w = l.w, dd = l.dd;
      const tx = easeOut(clamp((d * 1.6 - l.d / 9 * 0.6) / 0.8));
      const edge = l.hero ? `rgba(255,194,0,${0.95 - tx * 0.2})` : `rgba(207,230,255,${0.8 - tx * 0.45})`;
      const base = l.tone < 0.35 ? [196, 188, 172] : l.tone < 0.7 ? [172, 166, 158] : [210, 190, 150], hc = l.hero ? [240, 200, 90] : base;
      const sh = (k) => `rgba(${hc[0] * k | 0},${hc[1] * k | 0},${hc[2] * k | 0},${0.1 + tx * 0.9})`;
      const left = [P(x0, y0 + dd, 0), P(x0 + w, y0 + dd, 0), P(x0 + w, y0 + dd, z), P(x0, y0 + dd, z)];
      const right = [P(x0 + w, y0, 0), P(x0 + w, y0 + dd, 0), P(x0 + w, y0 + dd, z), P(x0 + w, y0, z)];
      const top = [P(x0, y0, z), P(x0 + w, y0, z), P(x0 + w, y0 + dd, z), P(x0, y0 + dd, z)];
      poly(left, sh(0.72), edge, 1); poly(right, sh(0.55), edge, 1); poly(top, sh(1), edge, 1);
      if (tx > 0.15 && z > 0.8) {
        const rows = Math.max(1, Math.floor(z * 1.6)), cols = l.win; ctx.fillStyle = `rgba(66,76,94,${0.8 * tx})`;
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
          const u = (q + 0.5) / cols, zz = (r + 0.5) / rows * z * 0.86 + 0.1;
          const [lx, ly] = P(x0 + w * u, y0 + dd, zz), [rx, ry] = P(x0 + w, y0 + dd * u, zz), s = tw() * 0.07;
          ctx.fillRect(lx - s, ly - s * 0.9, s * 1.6, s * 1.3); ctx.fillRect(rx - s * 0.3, ry - s * 0.9, s * 1.4, s * 1.3);
        }
      }
      if (l.hero) { ctx.shadowColor = "rgba(255,194,0,.9)"; ctx.shadowBlur = 14 * (0.6 + 0.4 * Math.sin(now / 420)); poly(top, null, "rgba(255,194,0,.9)", 1.4); ctx.shadowBlur = 0; }
    }
    // a scanner line sweeps the plate while it works
    if (p < 1) {
      const sw = (now / 2600) % 1, [sx0, sy0] = P(sw * N, 0), [sx1, sy1] = P(sw * N, N), gr = ctx.createLinearGradient(sx0, sy0, sx1, sy1);
      gr.addColorStop(0, "rgba(255,194,0,0)"); gr.addColorStop(0.5, "rgba(255,194,0,.55)"); gr.addColorStop(1, "rgba(255,194,0,0)");
      ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1); ctx.stroke();
    }
    // 5 the light settles: one warm wash sweeps across
    if (e > 0) { const k = e * 1.4 - 0.2, gr = ctx.createLinearGradient(W * (k - 0.35), 0, W * (k + 0.05), H * 0.4); gr.addColorStop(0, "rgba(255,226,150,0)"); gr.addColorStop(0.5, `rgba(255,226,150,${0.16 * Math.sin(Math.PI * clamp(e))})`); gr.addColorStop(1, "rgba(255,226,150,0)"); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
  }

  const t0 = performance.now(); let shown = 0, last = t0, stage = -1;
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  window.__plRemain = () => (shown >= 99.5 ? 0 : Math.max(0, (100 - shown) / RATE * 1000 + 300));
  function setStage(i) {
    if (i === stage) return; stage = i; sEl.classList.add("sw");
    setTimeout(() => { sEl.textContent = stages[Math.min(i, stages.length - 1)]; sEl.classList.remove("sw"); }, reduce ? 0 : 320);
  }
  function tick(now) {
    if (!root.isConnected) return removeEventListener("resize", size);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const real = bar ? parseFloat(bar.style.width) || 0 : 0, ready = real >= 100;
    const pace = (now - t0) / MIN * 100, cap = Math.min(pace, 96);
    const target = ready && pace >= 100 ? 100 : Math.min(cap, Math.max(real, 4) + 14);
    shown += Math.max(0, Math.min(target - shown, dt * (reduce ? 100 : RATE)));
    const p = shown / 100; frame(reduce ? 1 : p, now);
    nEl.textContent = Math.round(shown); fill.style.width = shown + "%";
    let si = 0; for (let k = 0; k < CUT.length - 1; k++) if (p >= CUT[k]) si = k; setStage(si);
    requestAnimationFrame(tick);
  }
  setStage(0); requestAnimationFrame(tick);
}
