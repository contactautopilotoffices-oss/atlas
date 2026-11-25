/* Benchmark the 3D explorer (engine/world.js) in a real browser.

  node scripts/world-bench.cjs [BASE_URL] [ATLAS_SLUG] [OPTION_ID] [OUT.json]

  BASE_URL defaults to http://localhost:8137 (PORT=8137 node scripts/atlas-dev.js).
  Opens /<slug>/world?perf=1#<option>, which exposes window.__world (see the ?perf hook in
  engine/world.js), and measures:

    load       cold (cache disabled) and warm (repeat visit) time to the first full frame,
               and every request: bytes on the wire, decoded size, duration
    dollhouse  10 s idle (auto-rotate as shipped), then 8 s of continuous orbiting
    walk       8 s walking forward with the W key
    per state  frame interval (median, p95; FPS = 1000 / median), JS time per frame,
               draw calls and triangles summed over every pass of one frame (shadow map,
               scene, ambient occlusion, output), GPU geometries and textures, JS heap

  Headless Chromium here renders with SwiftShader (WebGL on the CPU): absolute FPS is far
  below a real GPU's, but draw calls, triangles, JS time and bytes are exact, and frame time
  scales with the GPU work, so before/after ratios hold. Set CHROME_GPU=1 on a machine with
  a GPU to use it instead.
*/
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:8137";
const SLUG = process.argv[3] || "jindalx-noida";
const OPT = process.argv[4] || "a14-18-19";
const OUT = process.argv[5];
const W = +(process.env.BENCH_W || 960), H = +(process.env.BENCH_H || 540), N = +(process.env.BENCH_FRAMES || 8);

const stats = (a) => { if (!a.length) return {}; const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: a.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) }; };

/* n frames rendered one at a time through window.__world.tick, each timed to the end of its GPU work (a 1-pixel readPixels) */
async function ticks(page, n, step) {
  return page.evaluate(([n, step]) => {
    const w = window.__world, gl = w.renderer.getContext(), ms = [], js = [], px = new Uint8Array(4); let calls = 0, tris = 0;
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // blocks until the GPU has drawn the frame (gl.finish does not, in Chrome)
    for (let i = 0; i < n; i++) {
      if (step === "orbit") { w.controls.autoRotate = true; w.controls.autoRotateSpeed = 30; }
      if (step === "walk") w.walk.keys.add("w");
      const t0 = performance.now(); w.tick(1, 1 / 30); const t1 = performance.now(); sync(); const t2 = performance.now();
      ms.push(t2 - t0); js.push(t1 - t0); calls = Math.max(calls, w.PERF.calls); tris = Math.max(tris, w.PERF.tris);
    }
    w.walk.keys.delete("w"); w.controls.autoRotate = false; w.controls.autoRotateSpeed = 0.35;
    const m = w.renderer.info.memory;
    return { ms, js, calls, tris, geometries: m.geometries, textures: m.textures, heap: performance.memory ? performance.memory.usedJSHeapSize : null };
  }, [n, step]);
}
function summarise(r) { const f = stats(r.ms.slice(1)); return { frameMs: f, fps: f.median ? +(1000 / f.median).toFixed(1) : 0, jsMs: stats(r.js.slice(1)), drawCalls: r.calls, triangles: r.tris, geometries: r.geometries, textures: r.textures, heapMB: r.heap ? +(r.heap / 1e6).toFixed(1) : null }; }
async function sample(page, ms) {
  await page.evaluate(() => { const P = window.__world.PERF; P.js.length = 0; P.at.length = 0; P.maxCalls = 0; P.maxTris = 0; });
  const t0 = Date.now(); let calls = 0, tris = 0;
  while (Date.now() - t0 < ms) { await page.waitForTimeout(250); const r = await page.evaluate(() => [window.__world.PERF.calls, window.__world.PERF.tris]); calls = Math.max(calls, r[0]); tris = Math.max(tris, r[1]); }
  const r = await page.evaluate(() => { const w = window.__world, P = w.PERF, m = w.renderer.info.memory; return { at: P.at.slice(), js: P.js.slice(), geometries: m.geometries, textures: m.textures, heap: performance.memory ? performance.memory.usedJSHeapSize : null, programs: w.renderer.info.programs ? w.renderer.info.programs.length : null }; });
  const iv = r.at.slice(1).map((t, i) => t - r.at[i]);
  const fi = stats(iv);
  return { frames: r.at.length, frameMs: fi, fps: fi.median ? +(1000 / fi.median).toFixed(1) : 0, fpsMean: r.at.length > 1 ? +((r.at.length - 1) / ((r.at[r.at.length - 1] - r.at[0]) / 1000)).toFixed(1) : 0, jsMs: stats(r.js), drawCalls: calls, triangles: tris, geometries: r.geometries, textures: r.textures, programs: r.programs, heapMB: r.heap ? +(r.heap / 1e6).toFixed(1) : null };
}

async function load(ctx, cold) {
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: cold });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/config\.js|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const t0 = Date.now();
  const qs = process.env.BENCH_QS ? "&" + process.env.BENCH_QS : "";   // e.g. BENCH_QS=ao=0 to price one feature
  await page.goto(`${BASE}/${SLUG}/world?perf=1&bench=1${qs}#${OPT}`, { waitUntil: "commit", timeout: 600000 });
  await page.waitForFunction(() => window.__world && window.__world.PERF && !document.querySelector("#veil.on"), null, { timeout: 600000, polling: 500 });
  const ready = Date.now() - t0;
  const res = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => ({ name: e.name.replace(location.origin, ""), wire: e.transferSize, size: e.decodedBodySize, ms: Math.round(e.duration) })));
  return { page, ready, res, errors };
}

(async () => {
  const args = process.env.CHROME_GPU ? ["--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  const browser = await chromium.launch({ args: [...args, "--enable-precise-memory-info"] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const out = { url: `${BASE}/${SLUG}/world#${OPT}`, viewport: `${W}x${H} @1x`, renderer: process.env.CHROME_GPU ? "GPU" : "SwiftShader (CPU WebGL)", at: new Date().toISOString() };

  const cold = await load(ctx, true);
  const big = cold.res.filter((r) => r.size > 50000).sort((a, b) => b.size - a.size).map((r) => ({ file: r.name.split("?")[0], wireKB: Math.round(r.wire / 1024), sizeKB: Math.round(r.size / 1024), ms: r.ms }));
  out.load = { coldReadyMs: cold.ready, coldRequests: cold.res.length, coldWireMB: +(cold.res.reduce((s, r) => s + (r.wire || 0), 0) / 1e6).toFixed(2), coldDecodedMB: +(cold.res.reduce((s, r) => s + (r.size || 0), 0) / 1e6).toFixed(2), largest: big.slice(0, 12) };
  out.load.coldFirstFrameMs = await cold.page.evaluate(() => { const w = window.__world, t0 = performance.now(); w.tick(1, 0.016); const gl = w.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); return Math.round(performance.now() - t0); });
  out.gpuInfo = await cold.page.evaluate(() => { const gl = document.createElement("canvas").getContext("webgl2"); const d = gl && gl.getExtension("WEBGL_debug_renderer_info"); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown"; });
  await cold.page.close();

  const warm = await load(ctx, false);
  out.load.warmReadyMs = warm.ready; out.load.warmWireMB = +(warm.res.reduce((s, r) => s + (r.wire || 0), 0) / 1e6).toFixed(2);
  const page = warm.page;
  await page.addStyleTag({ content: "#load,#veil{display:none!important}" });

  // stop the page's own loop from competing, then render frames one at a time
  await page.evaluate(() => { window.__world.PERF.frozen = true; });
  out.dollhouseIdle = summarise(await ticks(page, N, "idle"));
  out.dollhouseOrbit = summarise(await ticks(page, N, "orbit"));
  await page.evaluate(() => window.__world.startWalk());
  out.walk = summarise(await ticks(page, N, "walk"));
  out.walk.moved = await page.evaluate(() => [window.__world.walk.pos.x, window.__world.walk.pos.y].map((v) => +v.toFixed(1)));
  out.errors = [...cold.errors, ...warm.errors];
  await browser.close();
  const s = JSON.stringify(out, null, 1); console.log(s); if (OUT) fs.writeFileSync(OUT, s);
})().catch((e) => { console.error(e); process.exit(1); });
