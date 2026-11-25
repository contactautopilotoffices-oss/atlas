/* Identical-camera screenshots of the JindalX explorer, for before-and-after comparisons
   (VISUAL_REALISM_REPORT.md). Cameras are in scene metres around Magnus Towers.
     PORT=8137 node scripts/atlas-dev.js     (and an older checkout on another port)
     node scripts/world-compare.cjs 8137 /tmp/new      -> /tmp/new-<camera>.png
   Any option: node scripts/world-compare.cjs 8137 /tmp/new d1 /path/to/d1.glb.site.json
     (cameras placed from the site file's front face, entrance and street view; scene metres)  */
const { chromium } = require('playwright');
const CAMS = {
  regional: { eye: [150, -520, 470], at: [-47, 37, 0] },
  property: { eye: [43, -113, 110], at: [-47, 37, 10] },
  closeup: { eye: [-14, -34, 14], at: [-52, 6, 11] },
  landscape: { eye: [-120, -25, 32], at: [-75, 12, 2] },
  street: { walk: [-66.5, -17.8], look: [-50, 37.7], pitch: 0.2 },
};
(async () => {
  const [port, out, OPT = 'magnus-towers', SITE] = process.argv.slice(2);
  if (SITE) {   // cameras from the modelled plot: t along the front face, n out towards the road
    const st = JSON.parse(require('fs').readFileSync(SITE, 'utf8')); const [A, B] = st.front, E = st.entrance;
    const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], W = Math.hypot(B[0] - A[0], B[1] - A[1]), t = [(B[0] - A[0]) / W, (B[1] - A[1]) / W];
    let n = [-t[1], t[0]]; if ((E[0] - M[0]) * n[0] + (E[1] - M[1]) * n[1] < 0) n = [-n[0], -n[1]];
    const P = (o, a, b, z) => [o[0] + t[0] * a + n[0] * b, o[1] + t[1] * a + n[1] * b, z];
    const ctr = P(M, 0, -18, 0);
    for (const k of Object.keys(CAMS)) delete CAMS[k];
    Object.assign(CAMS, {
      regional: { eye: P(ctr, -200, 540, 470), at: ctr },
      property: { eye: P(ctr, -W * 1.1, 120, 105), at: [ctr[0], ctr[1], 8] },
      closeup: { eye: P(M, -W * 0.22, 16, 6.5), at: P(M, -W * 0.05, 0, 10) },
      landscape: { eye: P(B, 2, 13, 4), at: P(B, -W * 0.35, 4, 1) },
      street: { walk: st.street_cam, look: M, pitch: 0.2 },
    });
  }
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${port}/jindalx-noida/world?perf=1&bench=1&adapt=0#${OPT}`, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__world && !document.querySelector('#veil.on'), null, { timeout: 600000, polling: 500 });
  await p.addStyleTag({ content: '#load,#veil,#hint{display:none!important}' });
  const origin = await p.evaluate(async (OPT) => (await (await fetch(`/media/jindalx-noida/world/d/${OPT}.json`)).json()).origin, OPT);
  for (const [name, c] of Object.entries(CAMS)) {
    await p.evaluate(([c, o]) => {
      const w = window.__world, L = (x, y, z) => [x - o[0], z, -(y - o[1])];
      if (c.walk) { w.startWalk([c.walk[0] - o[0], c.walk[1] - o[1]]); w.walk.yaw = Math.atan2(c.look[0] - c.walk[0], c.look[1] - c.walk[1]); w.walk.pitch = c.pitch; }
      else { if (w.mode !== 'dollhouse') w.dollhouse(); w.controls.autoRotate = false; w.controls.minDistance = 1; w.controls.maxDistance = 1e5; w.controls.maxPolarAngle = Math.PI / 2;
        w.controls.target.set(...L(...c.at)); w.camera.position.set(...L(...c.eye)); w.controls.update(); }
      w.tick(1, 0.016); w.tick(1, 0.016);
    }, [c, origin]);
    await p.screenshot({ path: `${out}-${name}.png`, timeout: 600000 });
    console.log(name, 'ok');
  }
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
