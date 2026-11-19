// Lines on the world: the station walk (route.json, Google Maps figure), the rail line and platforms (route.json, OSM),
// the five-minute ring (estimate, labelled), and the arrival line (gate from route.json; lifts and waiting area from the
// 6th-floor CAD layout). Lines sit on the ground or float in the lift core; they never draw over the CAD (the floor plan
// is not drawn here at all) and never over the facade (depth tested).
import * as THREE from 'three';
import { U, W } from './core.js';

export const ACCENT_LINE = new THREE.Color('#1776F2');          // Altruist blue (brand/altruist.png), the client's line
const INK = new THREE.Color('#F4F1EC');

const VS = /* glsl */`
  attribute float aSide; attribute float aS; attribute vec3 aTan; attribute float aFlat; attribute vec3 aSideDir;
  uniform float uWidth; uniform float uMinPx; uniform float uPxAngle; uniform float uHalo;
  varying float vSide; varying float vS; varying float vPx;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    float dist = length(position - cameraPosition);
    float px = dist * uPxAngle;                                   // metres per pixel at this distance
    float hw = max(uWidth * .5, uMinPx * px * .5) * uHalo;
    vec3 side = aSideDir;
    if (aFlat < .5) { vec3 v = normalize(cameraPosition - position); side = normalize(cross(aTan, v)); }
    vec3 p = position + side * aSide * hw;
    vSide = aSide; vS = aS; vPx = hw / max(px, 1e-4) / uHalo;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;
const FS = /* glsl */`
  uniform vec3 uCore; uniform vec3 uGlow; uniform float uReveal; uniform float uLen; uniform float uTime; uniform float uOpacity;
  uniform float uHalo; uniform float uDash; uniform float uFromEnd;
  varying float vSide; varying float vS; varying float vPx;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float s = uFromEnd > .5 ? uLen - vS : vS;
    float shown = uReveal * uLen;
    if (s > shown) discard;
    float x = abs(vSide) * uHalo;                                  // 0 at the centre, 1 at the core edge
    float aa = 1.2 / max(vPx * 2.0, 1.0);
    float core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, x);
    float halo = exp(-x * x * 1.6) * .28 * step(1.01, uHalo);
    float head = exp(-pow((shown - s) / 9.0, 2.0)) * step(.001, 1.0 - uReveal) * 1.4;
    float dash = uDash > 0.0 ? .55 + .45 * smoothstep(.75, 1.0, fract((s - uTime * 14.0) / max(uDash, 1.0))) : 1.0;
    vec3 c = uCore * core * dash * 2.4 + uGlow * halo * 1.4 + uCore * head * core * 2.0;
    gl_FragColor = vec4(c * uOpacity, 1.0);
  }`;

// resample a polyline (three Vector3s) every `step` metres, rounding corners a little
function resample(pts, step = 3) {
  const out = [pts[0].clone()];
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = a.distanceTo(b), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n)); }
  // light Chaikin-like smoothing on horizontal corners only (keeps the vertical rise straight)
  for (let it = 0; it < 2; it++) for (let i = 1; i < out.length - 1; i++) { const p = out[i], q = out[i - 1], r = out[i + 1];
    if (Math.abs(q.y - p.y) < .01 && Math.abs(r.y - p.y) < .01) { p.x = p.x * .5 + (q.x + r.x) * .25; p.z = p.z * .5 + (q.z + r.z) * .25; } }
  return out;
}

export function ribbon(points, { width = 3, minPx = 2.4, halo = 3, core = ACCENT_LINE, glow = null, dash = 0, opacity = 1, flat = true, step = 3, fromEnd = false, renderOrder = 8 } = {}) {
  const P = resample(points, step), n = P.length;
  const pos = [], side = [], sArr = [], tan = [], flatA = [], sdir = [], idx = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) s += P[i].distanceTo(P[i - 1]);
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], t = b.clone().sub(a).normalize();
    const vertical = Math.abs(t.y) > .7;
    const sd = vertical ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-t.z, 0, t.x).normalize();
    for (const sg of [-1, 1]) { pos.push(P[i].x, P[i].y, P[i].z); side.push(sg); sArr.push(s); tan.push(t.x, t.y, t.z); flatA.push(flat && !vertical ? 1 : 0); sdir.push(sd.x, sd.y, sd.z); }
    if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(sArr, 1)); g.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 3));
  g.setAttribute('aFlat', new THREE.Float32BufferAttribute(flatA, 1)); g.setAttribute('aSideDir', new THREE.Float32BufferAttribute(sdir, 3)); g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uWidth: { value: width }, uMinPx: { value: minPx }, uPxAngle: { value: .001 }, uHalo: { value: halo }, uCore: { value: core.clone() },
      uGlow: { value: (glow || core).clone() }, uReveal: { value: 1 }, uLen: { value: s }, uTime: U.uTime, uOpacity: { value: opacity }, uDash: { value: dash }, uFromEnd: { value: fromEnd ? 1 : 0 } },
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = renderOrder; mesh.frustumCulled = false; mesh.userData.len = s; mesh.userData.points = P;
  mesh.userData.pointAt = (f) => { const target = f * s; let acc = 0; for (let i = 1; i < P.length; i++) { const d = P[i].distanceTo(P[i - 1]); if (acc + d >= target) return P[i - 1].clone().lerp(P[i], (target - acc) / Math.max(d, 1e-6)); acc += d; } return P[P.length - 1].clone(); };
  return mesh;
}

function polyFill(rings, h, color, opacity) {
  const geos = rings.map(r => { const sh = new THREE.Shape(r.map(([x, y]) => new THREE.Vector2(x, y))); const gg = new THREE.ShapeGeometry(sh); gg.rotateX(-Math.PI / 2); gg.translate(0, h, 0); return gg; });
  const grp = new THREE.Group();
  for (const gg of geos) { const m = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 7; grp.add(m); }
  return grp;
}

export function buildOverlays({ route, layoutLifts, heightAt }) {
  const root = new THREE.Group(); root.name = 'overlays';
  const groundH = (x, y, lift) => Math.max(heightAt ? heightAt(x, y) : 0, Math.hypot(x, y) < 560 ? 0 : -50) + (Math.hypot(x, y) < 560 ? lift : lift + 1.2);
  // the station walk: drawn from the platform to the gate (the morning arrival)
  const walkPts = route.route.map(([x, y]) => W(x, y, groundH(x, y, .45)));
  const walk = ribbon(walkPts, { width: 6.5, minPx: 3.6, halo: 2.6, dash: 26, fromEnd: true }); walk.name = 'walk'; root.add(walk);
  // rail and platforms (OSM via route.json): quiet ink, not the accent
  const rail = new THREE.Group(); rail.name = 'rail';
  for (const line of route.rail || []) { if (line.length < 2) continue; rail.add(ribbon(line.map(([x, y]) => W(x, y, groundH(x, y, 1.0))), { width: 2.2, minPx: 1.6, halo: 1, core: INK.clone().multiplyScalar(.5), step: 8, renderOrder: 7 })); }
  rail.add(polyFill((route.platforms || []).map(r => r.slice(0, -1)), 1.2, 0xF4F1EC, .16));
  root.add(rail);
  // five-minute walk ring: Google's own pace on the station route (1,300 m in 17 min = 76.5 m/min) x 5 min, straight line, estimate
  const ringC = [15.5, 82.8], ringR = Math.round(1300 / 17 * 5 / 10) * 10;
  const ringPts = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2, x = ringC[0] + Math.cos(a) * ringR, y = ringC[1] + Math.sin(a) * ringR; ringPts.push(W(x, y, groundH(x, y, .5))); }
  const ring = ribbon(ringPts, { width: 1.4, minPx: 1.4, halo: 1, core: INK.clone().multiplyScalar(.55), step: 6 }); ring.name = 'ring'; ring.userData.r = ringR; ring.userData.c = ringC; root.add(ring);
  // arrival: gate -> court drive -> entrance -> lobby -> lift core -> rise -> level 6 passage -> waiting area door
  const L6 = 22.2 + .06;
  const lifts = layoutLifts || [[25.13, 86.75], [27.91, 86.71]];
  const lx = (lifts[0][0] + lifts[1][0]) / 2, ly = Math.max(lifts[0][1], lifts[1][1]) + 1.6;
  const arrivalPts = [
    W(-3.9, -3.8, .4), W(3.5, 8, .4), W(7.5, 30, .4), W(8.6, 56, .4), W(9, 76, .4), W(15.5, 82.8, .4), W(lx - 3.5, ly, .4), W(lx, ly, .4),
    W(lx, ly, L6), W(lx, ly + 1.2, L6), W(lx, 91.2, L6)];
  const arrival = ribbon(arrivalPts, { width: 2.2, minPx: 3, halo: 2.6, dash: 9, step: 1.2 }); arrival.name = 'arrival'; arrival.userData.riseAt = [lx, ly]; root.add(arrival);
  const all = [walk, ring, arrival, ...rail.children.filter(c => c.isMesh)];
  return {
    root, walk, rail, ring, arrival,
    setPixelAngle(camera, heightPx) { const a = 2 * Math.tan(camera.fov * Math.PI / 360) / heightPx; for (const m of all) if (m.material.uniforms) m.material.uniforms.uPxAngle.value = a; },
    show(name, on, { reveal = 1, opacity = 1 } = {}) { const o = { walk, rail, ring, arrival }[name]; if (!o) return; o.visible = on;
      const set = (m) => { if (m.material && m.material.uniforms) { m.material.uniforms.uReveal.value = reveal; m.material.uniforms.uOpacity.value = opacity; } else if (m.material) m.material.opacity = .16 * opacity; };
      if (o.isMesh) set(o); else o.traverse(c => { if (c.isMesh) set(c); }); },
  };
}
