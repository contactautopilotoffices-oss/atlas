// The camera timeline, read from shots.json (beats b01..b11). Every key is a position, a look-at point and a lens; between
// keys the camera follows monotone cubic curves in time (no overshoot: it never dips below a key's height or swings past
// a target), with height interpolated in log space so the descent slows naturally as it nears the ground.
import * as THREE from 'three';
import { W, fromLL, hfovOfLens, clamp } from './core.js';

const R = Math.PI / 180;
function keyFrom(k, t) {
  const hfov = hfovOfLens(k.lens_mm || 35);
  if (k.frame === 'latlng') {
    const p = fromLL(k.lat, k.lng, k.alt_m), hd = k.heading_deg * R, pt = k.pitch_deg * R;
    const dir = new THREE.Vector3(Math.sin(hd) * Math.cos(pt), Math.sin(pt), -Math.cos(hd) * Math.cos(pt));
    // aim at where the view ray meets the ground, or far ahead when it barely dips
    const dist = pt < -2 * R ? p.y / -Math.sin(pt) : 40000;
    return { t, p, target: p.clone().addScaledVector(dir, Math.min(dist, 40000)), hfov };
  }
  return { t, p: W(k.pos[0], k.pos[1], k.pos[2]), target: W(k.look_at[0], k.look_at[1], k.look_at[2]), hfov };
}

// Fritsch-Carlson monotone cubic: tangents per key for one channel
function tangents(ts, ys) {
  const n = ts.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, ts[i + 1] - ts[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  return m;
}
function hermite(ts, ys, ms, t) {
  let i = 0; while (i < ts.length - 2 && t > ts[i + 1]) i++;
  const h = Math.max(1e-6, ts[i + 1] - ts[i]), s = clamp((t - ts[i]) / h, 0, 1), s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * ms[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * ms[i + 1];
}

export function buildPath(shots) {
  const beats = shots.beats.filter(b => b.t1 > b.t0);
  const keys = [];
  const push = (k) => { const last = keys[keys.length - 1]; if (last && Math.abs(last.t - k.t) < 1e-3) keys[keys.length - 1] = k; else keys.push(k); };
  for (const b of beats) {
    const c = b.camera; push(keyFrom(c.from, b.t0));
    for (const v of (c.via || []).slice().sort((a, b) => a.t - b.t)) push(keyFrom(v, v.t));
    push(keyFrom(c.to, b.t1));
  }
  const ts = keys.map(k => k.t);
  const ch = {
    px: keys.map(k => k.p.x), pz: keys.map(k => k.p.z), ph: keys.map(k => Math.log(Math.max(.5, k.p.y + 20))),
    tx: keys.map(k => k.target.x), ty: keys.map(k => k.target.y), tz: keys.map(k => k.target.z), fov: keys.map(k => k.hfov),
  };
  const tan = Object.fromEntries(Object.entries(ch).map(([k, v]) => [k, tangents(ts, v)]));
  const at = (k, t) => hermite(ts, ch[k], tan[k], t);
  const T0 = ts[0], T1 = ts[ts.length - 1];
  // the sun clock per beat (clock_ist), linear between beat starts
  const clocks = beats.filter(b => b.clock_ist).map(b => { const [h, m] = b.clock_ist.split(':').map(Number); return { t: b.t0, h: h + m / 60 }; });
  return {
    keys, T0, T1, beats,
    sample(t, out = {}) {
      t = clamp(t, T0, T1);
      out.p = (out.p || new THREE.Vector3()).set(at('px', t), Math.exp(at('ph', t)) - 20, at('pz', t));
      out.target = (out.target || new THREE.Vector3()).set(at('tx', t), at('ty', t), at('tz', t));
      out.hfov = at('fov', t); return out;
    },
    hourAt(t) {
      if (!clocks.length) return 9.5; if (t <= clocks[0].t) return clocks[0].h;
      for (let i = 0; i < clocks.length - 1; i++) if (t < clocks[i + 1].t) { const a = clocks[i], b = clocks[i + 1]; return a.h + (b.h - a.h) * (t - a.t) / (b.t - a.t); }
      return clocks[clocks.length - 1].h;
    },
    beatAt(t) { return beats.find(b => t >= b.t0 && t < b.t1) || beats[beats.length - 1]; },
  };
}

// a named camera for a fixed shot (exterior_viewer.json cameras and the shots.json alt view)
export function fixedPose(name, manifest, shots) {
  const c = manifest.cameras || {};
  const fromThree = (cam) => ({ p: new THREE.Vector3(...cam.position_three), target: new THREE.Vector3(...cam.target_three), hfov: cam.hfov_deg });
  if (name === 'hero_court') return c.court ? fromThree(c.court) : { p: W(-36.5, 32.8, 1.65), target: W(13.5, 80.8, 15), hfov: 84 };
  if (name === 'hero_road') return c.road ? fromThree(c.road) : { p: W(-258, -96, 1.7), target: W(10, 55, 18), hfov: 39.6 };
  if (name === 'hero_orbit') return c.orbit ? fromThree(c.orbit) : { p: W(-235, -205, 150), target: W(8, 52, 14), hfov: 48.5 };
  if (name === 'b10alt') {
    const b = shots.beats.find(x => x.id === 'b10_view'); const a = b && b.camera.alt && b.camera.alt.to;
    if (a) return { p: W(...a.pos), target: W(...a.look_at), hfov: hfovOfLens(a.lens_mm || 24) };
  }
  return null;
}
