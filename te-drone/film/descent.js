// Total Environment Whitefield: the opening, built the way the Andheri descent was. One continuous move:
// above the cloud over east Bengaluru, down through it onto the satellite map, Whitefield and Hoodi named as they
// come up, a glass pin card landing on the tower, then a slow push in to the tower model on its footprint.
// Nothing runs on the wall clock: window.__seek(t) sets the camera, clouds and overlays for time t (s) and resolves
// once every tile is drawn; capture.mjs (with ?page=descent) screenshots each frame.
import { makeClouds } from './clouds.js';

mapboxgl.accessToken = window.MAPBOX_TOKEN;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const E = {
  inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  inOutCubic: (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  outBack: (k, s = 1.25) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
};
const KX = 108474, KY = 110600;                                   // metres per degree at 13 N
const mpp = (z, lat) => 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, z));
const HERO = [77.7204927, 12.9908297];                            // the Workcations tower, centre of its footprint

const ov = document.getElementById('ov');
const el = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; ov.appendChild(d); return d; };
const place = (node, p) => { node.style.transform = `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`; };

const map = new mapboxgl.Map({ container: 'map', style: 'mapbox://styles/mapbox/standard-satellite',
  config: { basemap: { lightPreset: 'day', showPointOfInterestLabels: false, showTransitLabels: false, showPlaceLabels: false, showRoadLabels: false, show3dObjects: true } },
  center: [77.7395, 12.9735], zoom: 11.3, interactive: false, attributionControl: false, fadeDuration: 0, preserveDrawingBuffer: true,
  antialias: true, maxPitch: 80, trackResize: false });
window.__map = map;
const P = (ll) => map.project(ll);
function idle() {
  return new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } };
    map.once('idle', fin); map.triggerRepaint(); setTimeout(fin, 45000); });
}

function clip() {
  const DUR = 16;
  // the descent (as Andheri), then a slow push to the tower from the east-south-east
  const c0 = [77.7395, 12.9735], z0 = 11.3, z1 = 16.0, T1 = 9.7;
  const cam = (t) => {
    if (t <= T1) {
      const k = seg(t, 0, T1), ez = .12 * k + .88 * E.inOutSine(k), ec = E.inOutSine(k);
      return { center: [lerp(c0[0], HERO[0], ec), lerp(c0[1], HERO[1], ec)], zoom: lerp(z0, z1, ez),
        pitch: lerp(0, 55, E.inOutCubic(seg(t, 4.6, 10.4))), bearing: lerp(-6, -58, E.inOutSine(seg(t, 2.0, 11.0))) };
    }
    const k = E.inOutSine(seg(t, T1, DUR));
    return { center: HERO, zoom: lerp(z1, 18.0, k), pitch: lerp(55, 63, k),
      bearing: lerp(-58 + (-58 - -58), -70, E.inOutSine(seg(t, 9.0, DUR))) };
  };
  const altKm = (c) => 1.5 * 1080 * mpp(c.zoom, c.center[1]) * Math.cos(c.pitch * Math.PI / 180) / 1000;
  const groundKm = (c) => { const back = altKm(c) * Math.tan(c.pitch * Math.PI / 180), b = c.bearing * Math.PI / 180;
    return [(c.center[0] - HERO[0]) * KX / 1000 - back * Math.sin(b), (c.center[1] - HERO[1]) * KY / 1000 - back * Math.cos(b)]; };
  const tc = 4.55, cross = cam(tc), gx = groundKm(cross), g3 = groundKm(cam(3.1));
  const decks = [
    { h: altKm(cam(6.0)), cov: .63, scale: 1.7, alpha: .5, fade: .3 },
    { h: altKm(cross), cov: .60, scale: 2.9, alpha: .97, dense: [gx[0] + 1.2, gx[1] + 1.0, 5.0], fade: .12 },
    { h: altKm(cam(3.1)), cov: .66, scale: 3.8, alpha: .75, dense: [g3[0] - 1.5, g3[1] + .8, 3.2], fade: .3 },
  ];
  const clouds = makeClouds(document.getElementById('clouds'), .75);
  const labels = [
    { cls: 'gl small', html: 'Bengaluru', ll: [77.600, 12.972], t0: .3, t1: 3.0 },
    { cls: 'gl small', html: '<span class="tick"></span>ITPL', ll: [77.7377, 12.9846], t0: .7, t1: 3.0, anchor: 'dot' },
    { cls: 'gl big', html: 'Whitefield', ll: [77.7500, 12.9700], t0: 5.6, t1: 8.3 },
    { cls: 'gl caps', html: 'Hoodi', ll: [77.7120, 12.9950], t0: 7.6, t1: 11.2 },
    { cls: 'gl small', html: '<span class="tick"></span>Hoodi Lake', ll: [77.7230, 12.9869], t0: 8.0, t1: 11.2, anchor: 'dot' },
    { cls: 'gl small', html: '<span class="tick"></span>ITPL Main Road', ll: [77.7232, 12.9921], t0: 8.4, t1: 11.2, anchor: 'dot' },
  ].map((l) => ({ ...l, node: el(l.cls, l.html) }));
  const pin = makePin({ name: 'Total Environment', sub: 'Workcations · Hoodi, Whitefield', ll: HERO, t0: 9.1, t1: 13.4, stem: 190 });
  return { DUR, apply(t) {
    const c = cam(t); map.jumpTo(c);
    const A = altKm(c), fog = .92 * Math.exp(-Math.pow((t - tc) / .5, 2)) + .3 * Math.exp(-Math.pow((t - (tc + .6)) / .55, 2));
    clouds.draw({ A, cam: groundKm(c), bearing: c.bearing, t, layers: decks, haze: .12 * clamp01((A - 9) / 34), fog: Math.min(.95, fog), fogS: 2.6 * Math.exp(-(t - tc) * 1.3), shadow: .22 });
    return () => {
      for (const l of labels) { const p = P(l.ll), a = seg(t, l.t0, l.t0 + .8) * (1 - seg(t, l.t1 - .6, l.t1));
        const w = l.node.offsetWidth, h = l.node.offsetHeight; l.node.style.opacity = a.toFixed(3);
        l.node.style.transform = `translate(${(p.x - (l.anchor === 'dot' ? 9 : w / 2)).toFixed(1)}px, ${(p.y - h / 2 + (1 - E.outCubic(seg(t, l.t0, l.t0 + 1.2))) * 8).toFixed(1)}px)`;
        l.node.style.filter = a < 1 ? `blur(${((1 - a) * 4).toFixed(2)}px)` : 'none'; }
      pin.update(t);
    };
  } };
}

// a glass pin card that drops in and lands on the tower, then lifts away before the push ends
function makePin(o) {
  const node = el('pin', `<div class="ring"></div><div class="dot"></div><div class="drop"><div class="stem" style="height:${o.stem}px"></div>
    <div class="card" style="bottom:${o.stem}px"><span class="acc"></span><div><b>${o.name}</b><small>${o.sub}</small></div></div></div>`);
  const ring = node.querySelector('.ring'), dot = node.querySelector('.dot'), drop = node.querySelector('.drop'), stem = node.querySelector('.stem'), card = node.querySelector('.card');
  node.style.opacity = 0;
  return { update(t) {
    const u = t - o.t0; if (u < 0) { node.style.opacity = 0; return; }
    place(node, P(o.ll));
    node.style.opacity = (1 - seg(t, o.t1 - .7, o.t1)).toFixed(3);
    const fall = 1 - E.outExpo(seg(u, 0, .8));
    drop.style.transform = `translateY(${(-90 * fall).toFixed(2)}px)`; drop.style.opacity = seg(u, 0, .3).toFixed(3);
    stem.style.transform = `scaleY(${(.55 + .45 * E.outCubic(seg(u, .05, .7))).toFixed(3)})`;
    card.style.filter = u < .55 ? `blur(${(5 * (1 - seg(u, 0, .55))).toFixed(2)}px)` : 'none';
    dot.style.transform = `scale(${E.outBack(seg(u, .28, .8), 1.8).toFixed(3)})`;
    const kr = seg(u, .3, 1.5); ring.style.transform = `scale(${(.15 + 1.25 * E.outCubic(kr)).toFixed(3)})`; ring.style.opacity = (kr > 0 ? .85 * (1 - kr) : 0).toFixed(3);
  } };
}

let C = null;
window.__seek = async (t) => { const after = C.apply(t); await idle(); if (after) after(); return true; };
map.on('style.load', async () => {
  map.addSource('te', { type: 'model', models: { tower: { uri: 'te_tower.glb', position: HERO, orientation: [0, 0, 0] } } });
  map.addLayer({ id: 'te-tower', type: 'model', source: 'te', slot: 'top',
    paint: { 'model-type': 'common-3d', 'model-cast-shadows': true, 'model-receive-shadows': true, 'model-emissive-strength': 0.6 } });
  map.setFog({ range: [1.2, 9], color: 'rgb(214, 224, 236)', 'high-color': '#9fb9d8', 'horizon-blend': .08, 'space-color': '#cfdcea', 'star-intensity': 0 });
  C = clip();
  await document.fonts.ready;
  window.__DUR = C.DUR;
  await window.__seek(0);
  window.__ready = true;
});
map.on('error', (e) => console.log('[cap] map error', e && e.error && e.error.message));
