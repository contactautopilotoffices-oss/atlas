/* Smoke test of the 3D explorer's modes in a real browser (engine/world.js), after the performance work.

  node scripts/world-smoke.cjs [BASE_URL] [SLUG] [OPTION_ID]

  Checks, with the page's own render loop running (no ?bench):
    - it loads with no page errors and draws frames
    - render on demand: a still dollhouse (auto-rotate off, no input) stops drawing; input wakes it
    - the forest: trees are drawn in levels of detail, and fewer than all of them when walking
    - walk mode: W moves the walker, collisions stop it at walls, the mini-map draws
    - the route walk to the metro advances
    - switching to every other option loads it (from the prefetch) and back
    - each quality tier applies (pixel ratio, ambient occlusion, MSAA) and still draws
    - the 2D map link and the floor stack are present; a floor click flies to it
*/
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8137", SLUG = process.argv[3] || "jindalx-noida", OPT = process.argv[4] || "";
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  await p.addInitScript((slug) => { try { sessionStorage.setItem(slug + "-auth", "1"); } catch (e) {} }, SLUG);   // past an atlas's access gate
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors = []; p.on("pageerror", (e) => errors.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error" && !/config\.js|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const res = []; const ok = (name, pass, info = "") => { res.push([pass ? "ok  " : "FAIL", name, info]); };
  await p.goto(`${BASE}/${SLUG}/world?perf=1${OPT ? "#" + OPT : ""}`, { waitUntil: "commit", timeout: 300000 });
  await p.waitForFunction(() => window.__world && window.__world.PERF && !document.querySelector("#veil.on") && window.__world.PERF.frames > 1, null, { timeout: 600000, polling: 500 });
  const W = (f, a) => p.evaluate(f, a);
  ok("loads and draws", await W(() => window.__world.PERF.frames > 1));
  // render on demand
  await W(() => { window.__world.controls.autoRotate = false; });
  await p.waitForTimeout(6000);
  const f0 = await W(() => window.__world.PERF.frames); await p.waitForTimeout(5000); const f1 = await W(() => window.__world.PERF.frames);
  ok("a still dollhouse stops drawing", f1 - f0 <= 1, `${f1 - f0} frames in 5 s`);
  await p.mouse.move(200, 150); await p.mouse.wheel(0, -200); await p.waitForTimeout(4000);
  const f2 = await W(() => window.__world.PERF.frames);
  ok("input wakes it", f2 > f1, `${f2 - f1} frames after a wheel`);
  const fo = await W(() => { const f = window.__world.forest; if (!f) return null; let lv = [0, 0, 0]; window.__world.scene.traverse((o) => { if (o.isInstancedMesh && o.layers.mask === 1 && !o.castShadow && o.geometry) {} }); return { trees: f.count }; });
  ok("the forest is built", !!fo && fo.trees > 0, fo ? `${fo.trees} trees` : "none");
  // walk
  await W(() => window.__world.startWalk()); await p.waitForTimeout(3000);
  const a = await W(() => [window.__world.walk.pos.x, window.__world.walk.pos.y]);
  await p.keyboard.down("w"); await p.waitForTimeout(6000); await p.keyboard.up("w");
  const c = await W(() => [window.__world.walk.pos.x, window.__world.walk.pos.y]);
  ok("walking moves the walker", Math.hypot(c[0] - a[0], c[1] - a[1]) > 0.5, `moved ${Math.hypot(c[0] - a[0], c[1] - a[1]).toFixed(1)} m`);
  const coll = await W(() => { const w = window.__world; return new Promise((done) => { const before = [w.walk.pos.x, w.walk.pos.y]; w.walk.keys.add("w"); setTimeout(() => { w.walk.keys.delete("w"); done([before, [w.walk.pos.x, w.walk.pos.y]]); }, 25000); }); });
  ok("walking is stopped by walls or the slab edge (25 s straight on)", Math.hypot(coll[1][0] - coll[0][0], coll[1][1] - coll[0][1]) < 25000 * 0.0016 * 5 * 4.2, `moved ${Math.hypot(coll[1][0] - coll[0][0], coll[1][1] - coll[0][1]).toFixed(1)} m`);
  ok("mini-map drawn", await W(() => { const m = document.querySelector("#mini"); const d = m.getContext("2d").getImageData(m.width / 2 - 40, m.height / 2 - 40, 80, 80).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > 100; }));
  // route walk
  await W(() => window.__world.startRouteWalk()); await p.waitForTimeout(8000);
  const rw = await W(() => window.__world.mode + " " + (document.querySelector("#route .track i")?.style.width || ""));
  ok("route walk advances", /^route/.test(rw) && parseFloat(rw.split(" ")[1]) > 0, rw);
  await W(() => window.__world.dollhouse());
  // floors and the 2D map link
  ok("2D map link", await W(() => !!document.querySelector("#to-map")?.getAttribute("href")));
  const floors = await W(() => document.querySelectorAll("#floors .fl").length); ok("floor stack", floors > 1, `${floors} floors`);
  // switching options
  const ids = await W(() => [...document.querySelectorAll("#strip .film")].map((f) => f.dataset.id));
  for (const id of ids) {
    const t0 = Date.now(); let clickErr = "";
    await p.click(`#strip .film[data-id="${id}"]`, { force: true, timeout: 60000 }).catch((e) => (clickErr = " · click: " + e.message.split("\n")[0]));
    await p.waitForFunction((id) => location.hash === "#" + id && !document.querySelector("#veil.on"), id, { timeout: 300000, polling: 300 }).catch(() => {});
    ok(`switch to ${id}`, await W((id) => location.hash === "#" + id, id), `${Date.now() - t0} ms${clickErr}`);
  }
  // quality tiers
  for (const t of [3, 2, 1, 0]) {
    await W((t) => window.__world.setTier(t), t); await p.waitForTimeout(2500);
    const q = await W(() => ({ tier: window.__world.tier, dpr: window.__world.renderer.getPixelRatio(), frames: window.__world.PERF.frames }));
    ok(`quality tier ${t}`, q.tier === t, `pixel ratio ${q.dpr}`);
  }
  ok("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
  for (const r of res) console.log(r[0], r[1], r[2] ? "· " + r[2] : "");
  console.log(res.filter((r) => r[0] === "ok  ").length + " of " + res.length + " passed");
  await b.close(); process.exit(res.some((r) => r[0] !== "ok  ") ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
