// Andheri film maps. One page, five clips (?clip=descent|interchange|route_privilon|route_corporate|route_723).
// Nothing here runs on the wall clock: window.__seek(t) sets the camera, the line geometry and every overlay for time
// t (seconds), waits until Mapbox has every tile for that view on screen, and resolves; tools/capture.mjs screenshots
// each frame. So a frame always looks the same, however long its tiles take.
import { makeClouds } from './clouds.js';

const Q = new URLSearchParams(location.search);
const CLIP = Q.get('clip') || 'descent';
const DATA = '../data/';
mapboxgl.accessToken = window.MAPBOX_TOKEN;

/* ------------------------------------------------------------------ maths */
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const E = {
  inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  inOutCubic: (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  inOutQuint: (k) => (k < .5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2),
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  outQuart: (k) => 1 - Math.pow(1 - k, 4),
  outQuint: (k) => 1 - Math.pow(1 - k, 5),
  outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  outBack: (k, s = 1.25) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
};
const KX = 105184.7, KY = 110540.0;              // metres per degree here (same as .w3d/data/scene.json)
const mpp = (z, lat) => 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, z));   // metres per CSS px
const metres = (a, b) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY);

const PROPS = {
  privilon: { name: 'Privilon', sub: 'Marol', ll: [72.87968, 19.10827] },
  a723: { name: '723 Avenue', sub: 'Marol', ll: [72.8843436, 19.1096039] },
  corporate: { name: 'Corporate Avenue', sub: 'Chakala', ll: [72.859637, 19.110625] },
};

/* ------------------------------------------------------------------ DOM helpers */
const ov = document.getElementById('ov');
const el = (cls, html = '', parent = ov) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d; };
const place = (node, p) => { node.style.transform = `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`; };

const ICON_TRAIN = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 2.5c-4.2 0-7 .6-7 3.8v9.3c0 1.7 1.3 3 3 3.1L6.6 20.3v.6h2.1l1.6-1.6h3.4l1.6 1.6h2.1v-.6l-1.4-1.6c1.7-.1 3-1.4 3-3.1V6.3c0-3.2-2.8-3.8-7-3.8zM8.3 16.3a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8zm7.4 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8zM17 10.6H7V6.4h10v4.2z"/></svg>';
const ICON_WALK = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>';
const PIN_SVG = '<svg viewBox="0 0 38 54"><path d="M19 1C9.06 1 1 8.9 1 18.65 1 31.9 19 53 19 53s18-21.1 18-34.35C37 8.9 28.94 1 19 1z" fill="#EA4335" stroke="#B3261E" stroke-width="1.2"/><circle cx="19" cy="18.6" r="6.6" fill="#8E1A14"/></svg>';

/* ------------------------------------------------------------------ map styles */
function satStyle({ dark = 0 } = {}) {
  return { version: 8, glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    sources: { sat: { type: 'raster', url: 'mapbox://mapbox.satellite', tileSize: 512 } },
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0d1520' } },
      { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 0, 'raster-saturation': -0.2 - dark * .1, 'raster-contrast': 0.08,
        'raster-brightness-min': 0.015, 'raster-brightness-max': 0.97 - dark * .2 } }] };
}
// Google-like palette on Mapbox Streets v8 vector tiles: pale grey land, white streets, yellow arterials,
// light green parks, blue-grey water, quiet grey labels.
function lightStyle() {
  const F = ['Roboto Regular', 'Arial Unicode MS Regular'], FM = ['Roboto Medium', 'Arial Unicode MS Regular'];
  const W = (stops) => ['interpolate', ['exponential', 2], ['zoom'], ...stops.flat()];
  const road = (id, classes, fill, casing, wf, wc, extra = {}) => [
    { id: id + '-case', type: 'line', source: 'v', 'source-layer': 'road', filter: ['all', ['in', ['get', 'class'], ['literal', classes]], ['!=', ['get', 'structure'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': casing, 'line-width': W(wc), ...extra } },
    { id: id, type: 'line', source: 'v', 'source-layer': 'road', filter: ['all', ['in', ['get', 'class'], ['literal', classes]], ['!=', ['get', 'structure'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': fill, 'line-width': W(wf) } }];
  const minor = ['street', 'street_limited', 'pedestrian', 'track'];
  return { version: 8, glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    sources: { v: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' } },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': '#EEF0F3' } },
      { id: 'lu-green', type: 'fill', source: 'v', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['park', 'grass', 'pitch', 'cemetery', 'wood', 'scrub', 'garden', 'golf_course', 'agriculture']]],
        paint: { 'fill-color': '#CFE7CB', 'fill-opacity': 1 } },
      { id: 'lu-hospital', type: 'fill', source: 'v', 'source-layer': 'landuse', filter: ['==', ['get', 'class'], 'hospital'], paint: { 'fill-color': '#F2E6E8' } },
      { id: 'lu-school', type: 'fill', source: 'v', 'source-layer': 'landuse', filter: ['==', ['get', 'class'], 'school'], paint: { 'fill-color': '#EFEBE1' } },
      { id: 'lu-airport', type: 'fill', source: 'v', 'source-layer': 'landuse', filter: ['==', ['get', 'class'], 'airport'], paint: { 'fill-color': '#E6E9EE' } },
      { id: 'water', type: 'fill', source: 'v', 'source-layer': 'water', paint: { 'fill-color': '#AFC6D8' } },
      { id: 'waterway', type: 'line', source: 'v', 'source-layer': 'waterway', paint: { 'line-color': '#AFC6D8', 'line-width': W([[13, 1], [18, 8]]) } },
      { id: 'building', type: 'fill', source: 'v', 'source-layer': 'building', minzoom: 14, filter: ['!=', ['get', 'underground'], 'true'],
        paint: { 'fill-color': '#E2E5EA', 'fill-outline-color': '#D2D6DD', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1] } },
      { id: 'path', type: 'line', source: 'v', 'source-layer': 'road', minzoom: 15,
        filter: ['all', ['==', ['get', 'class'], 'path'], ['!', ['in', ['get', 'type'], ['literal', ['sidewalk', 'crossing', 'piste', 'corridor']]]]],
        layout: { 'line-cap': 'round' }, paint: { 'line-color': '#CDD3DB', 'line-width': W([[15, .6], [18, 1.8], [20, 3]]), 'line-dasharray': [1.5, 1.2] } },
      ...road('service', ['service'], '#FFFFFF', '#DADEE4', [[14, .4], [16, 2.2], [18, 7.5], [20, 28]], [[14, .8], [16, 3.4], [18, 9.5], [20, 31]]),
      ...road('minor', minor, '#FFFFFF', '#D6DAE1', [[13, .5], [15, 2.6], [17, 9], [19, 30], [20, 58]], [[13, 1], [15, 3.8], [17, 11], [19, 33], [20, 62]]),
      ...road('tertiary', ['tertiary', 'tertiary_link', 'secondary', 'secondary_link'], '#FFFFFF', '#CDD2DA', [[12, .8], [14, 2.6], [16, 7], [18, 24], [20, 86]], [[12, 1.4], [14, 3.8], [16, 9], [18, 27], [20, 90]]),
      ...road('primary', ['primary', 'primary_link', 'trunk', 'trunk_link'], '#FCE3A1', '#E7C77B', [[10, 1], [13, 2.6], [15, 6], [17, 15], [19, 50], [20, 98]], [[10, 1.6], [13, 3.6], [15, 7.6], [17, 17.5], [19, 53], [20, 102]]),
      ...road('motorway', ['motorway', 'motorway_link'], '#FBD56E', '#DDB257', [[8, 1], [12, 2.6], [15, 8], [17, 19], [19, 60], [20, 110]], [[8, 1.6], [12, 3.6], [15, 9.6], [17, 21.5], [19, 63], [20, 114]]),
      { id: 'rail', type: 'line', source: 'v', 'source-layer': 'road', filter: ['in', ['get', 'class'], ['literal', ['major_rail', 'minor_rail']]],
        paint: { 'line-color': '#C3C9D2', 'line-width': W([[12, .8], [18, 3]]) } },
      { id: 'road-label', type: 'symbol', source: 'v', 'source-layer': 'road', minzoom: 14.5,
        filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'street', 'street_limited']]]],
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': F, 'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11.5, 19, 15], 'text-letter-spacing': .02, 'symbol-spacing': 420, 'text-max-angle': 28, 'text-padding': 8 },
        paint: { 'text-color': '#636B78', 'text-halo-color': 'rgba(255,255,255,.95)', 'text-halo-width': 1.6 } },
      { id: 'place-label', type: 'symbol', source: 'v', 'source-layer': 'place_label', filter: ['in', ['get', 'class'], ['literal', ['settlement_subdivision']]],
        layout: { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': FM, 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 18, 15], 'text-letter-spacing': .12, 'text-transform': 'uppercase', 'text-padding': 30 },
        paint: { 'text-color': '#8A93A1', 'text-halo-color': 'rgba(238,240,243,.9)', 'text-halo-width': 1.4 } },
    ] };
}

/* ------------------------------------------------------------------ line geometry helpers */
function cumul(coords) { const c = [0]; for (let i = 1; i < coords.length; i++) c.push(c[i - 1] + metres(coords[i - 1], coords[i])); return c; }
function at(coords, cum, s) {
  s = Math.max(0, Math.min(cum[cum.length - 1], s));
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const k = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
  return [lerp(coords[i - 1][0], coords[i][0], k), lerp(coords[i - 1][1], coords[i][1], k)];
}
function subline(coords, cum, a, b) {
  a = Math.max(0, a); b = Math.min(cum[cum.length - 1], b); if (b - a < .5) return [at(coords, cum, a), at(coords, cum, a + .5)];
  const out = [at(coords, cum, a)];
  for (let i = 0; i < coords.length; i++) if (cum[i] > a && cum[i] < b) out.push(coords[i]);
  out.push(at(coords, cum, b)); return out;
}
function project_s(coords, cum, p) {   // arc length of the point on the line nearest p
  let best = [1e18, 0];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i], ax = (b[0] - a[0]) * KX, ay = (b[1] - a[1]) * KY, px = (p[0] - a[0]) * KX, py = (p[1] - a[1]) * KY;
    const L2 = ax * ax + ay * ay || 1, k = clamp01((px * ax + py * ay) / L2), d = Math.hypot(px - k * ax, py - k * ay);
    if (d < best[0]) best = [d, cum[i - 1] + k * Math.sqrt(L2)];
  }
  return best[1];
}
const line = (coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
const fc = (features) => ({ type: 'FeatureCollection', features });

/* ------------------------------------------------------------------ the map */
const isSat = CLIP === 'descent' || CLIP === 'interchange';
document.body.classList.add(isSat ? 'sat' : 'light');
document.querySelector('#credit span').textContent = isSat ? '© Mapbox  © OpenStreetMap  © Maxar' : '© Mapbox  © OpenStreetMap';
const map = new mapboxgl.Map({ container: 'map', style: isSat ? satStyle({ dark: CLIP === 'interchange' ? .25 : 0 }) : lightStyle(),
  center: [72.872, 19.106], zoom: 14, interactive: false, attributionControl: false, fadeDuration: 0, preserveDrawingBuffer: true,
  antialias: true, projection: 'mercator', maxPitch: 80, trackResize: false, localFontFamily: false, crossSourceCollisions: true });
window.__map = map;

function idle() {
  return new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } };
    map.once('idle', fin); map.triggerRepaint(); setTimeout(() => { if (!done) { console.log('[cap] idle timeout'); fin(); } }, 45000); });
}
const P = (ll) => map.project(ll);

/* ================================================================== clip: descent */
function clipDescent() {
  const DUR = 12;
  const c0 = [72.8706, 19.0990], z0 = 11.3, c1 = [72.8722, 19.1062], z1 = 15.06, T1 = 9.7;
  const cam = (t) => {
    const k = seg(t, 0, T1), ez = .12 * k + .88 * E.inOutSine(k);
    let zoom = lerp(z0, z1, ez);
    const ec = E.inOutSine(k);
    const center = [lerp(c0[0], c1[0], ec), lerp(c0[1], c1[1], ec)];
    const pitch = lerp(0, 50, E.inOutCubic(seg(t, 4.6, 10.4)));
    let bearing = lerp(-8, 9, E.inOutSine(seg(t, 0, 11.4)));
    zoom += .12 * E.inOutSine(seg(t, T1 - .4, DUR));          // a slow settle after the landing
    bearing += 1.5 * seg(t, T1, DUR);
    return { center, zoom, pitch, bearing };
  };
  // camera altitude (km) for a camera state: Mapbox's camera sits 1.5 screen heights from its centre
  const altKm = (c) => 1.5 * 1080 * mpp(c.zoom, c.center[1]) * Math.cos(c.pitch * Math.PI / 180) / 1000;
  const groundKm = (c) => { const back = altKm(c) * Math.tan(c.pitch * Math.PI / 180), b = c.bearing * Math.PI / 180;
    return [(c.center[0] - c1[0]) * KX / 1000 - back * Math.sin(b), (c.center[1] - c1[1]) * KY / 1000 - back * Math.cos(b)]; };
  const tc = 4.55, cross = cam(tc);
  const gx = groundKm(cross), g3 = groundKm(cam(3.1));
  const decks = [  // lowest first; each deck sits where the camera is at the given time, so that is when it passes
    { h: altKm(cam(6.0)), cov: .63, scale: 1.7, alpha: .5, fade: .3 },
    { h: altKm(cross), cov: .60, scale: 2.9, alpha: .97, dense: [gx[0] + 1.2, gx[1] + 1.0, 5.0], fade: .12 },
    { h: altKm(cam(3.1)), cov: .66, scale: 3.8, alpha: .75, dense: [g3[0] - 1.5, g3[1] + .8, 3.2], fade: .3 },
  ];
  console.log('[cap] altitude km', altKm(cam(0)).toFixed(1), '->', altKm(cam(DUR)).toFixed(2), 'decks', decks.map((d) => d.h.toFixed(1)).join(' '));
  const clouds = makeClouds(document.getElementById('clouds'), .75);

  const labels = [
    { cls: 'gl small', html: 'Arabian Sea', ll: [72.776, 19.075], t0: .3, t1: 3.0 },
    { cls: 'gl small', html: '<span class="tick"></span>Mumbai Airport', ll: [72.8668, 19.0905], t0: .55, t1: 3.0, anchor: 'dot' },
    { cls: 'gl small', html: 'Powai', ll: [72.9055, 19.1235], t0: .8, t1: 3.0 },
    { cls: 'gl big', html: 'Andheri East', ll: [72.8715, 19.1125], t0: 5.6, t1: 8.3 },
    { cls: 'gl caps', html: 'Marol', ll: [72.8822, 19.1068], t0: 7.7, t1: 99 },
    { cls: 'gl caps', html: 'Chakala', ll: [72.8648, 19.1078], t0: 8.0, t1: 99 },
  ].map((l) => ({ ...l, node: el(l.cls, l.html) }));
  const pins = [
    { ...PROPS.privilon, t0: 8.55, stem: 112 },
    { ...PROPS.a723, t0: 9.3, stem: 150 },
    { ...PROPS.corporate, t0: 10.05, stem: 128 },
  ].map(makePin);

  return { DUR, apply(t) {
    const c = cam(t); map.jumpTo(c);
    // clouds
    const A = altKm(c), fog = .92 * Math.exp(-Math.pow((t - tc) / .5, 2)) + .3 * Math.exp(-Math.pow((t - (tc + .6)) / .55, 2));
    clouds.draw({ A, cam: groundKm(c), bearing: c.bearing, t, layers: decks, haze: .12 * clamp01((A - 9) / 34), fog: Math.min(.95, fog), fogS: 2.6 * Math.exp(-(t - tc) * 1.3), shadow: .22 });
    return () => {
      for (const l of labels) { const p = P(l.ll), a = seg(t, l.t0, l.t0 + .8) * (1 - seg(t, l.t1 - .6, l.t1));
        const w = l.node.offsetWidth, h = l.node.offsetHeight;
        l.node.style.opacity = a.toFixed(3);
        l.node.style.transform = `translate(${(p.x - (l.anchor === 'dot' ? 9 : w / 2)).toFixed(1)}px, ${(p.y - h / 2 + (1 - E.outCubic(seg(t, l.t0, l.t0 + 1.2))) * 8).toFixed(1)}px)`;
        l.node.style.filter = a < 1 ? `blur(${((1 - a) * 4).toFixed(2)}px)` : 'none'; }
      for (const p of pins) p.update(t);
    };
  } };
}

// a premium pin: ground dot + ripple, a fine stem and a dark glass card that drops in and lands
function makePin(o) {
  const node = el('pin' + (o.mini ? ' mini' : ''), `<div class="ring"></div><div class="dot"></div><div class="drop"><div class="stem" style="height:${o.stem}px"></div>
    <div class="card" style="bottom:${o.stem}px"><span class="acc"></span><div><b>${o.name}</b><small>${o.sub}</small></div></div></div>`);
  const ring = node.querySelector('.ring'), dot = node.querySelector('.dot'), drop = node.querySelector('.drop'), stem = node.querySelector('.stem'), card = node.querySelector('.card');
  node.style.opacity = 0;
  return { node, update(t) {
    const u = t - o.t0; if (u < 0) { node.style.opacity = 0; return; }
    const pp = P(o.ll); place(node, pp);
    node.style.opacity = (clamp01((1770 - pp.x) / 130) * clamp01((pp.x - 150) / 130) * clamp01((pp.y - 120) / 100)).toFixed(3);
    const kd = seg(u, 0, .8), fall = 1 - E.outExpo(kd);
    drop.style.transform = `translateY(${(-90 * fall).toFixed(2)}px)`;
    drop.style.opacity = seg(u, 0, .3).toFixed(3);
    stem.style.transform = `scaleY(${(.55 + .45 * E.outCubic(seg(u, .05, .7))).toFixed(3)})`;
    card.style.filter = u < .55 ? `blur(${(5 * (1 - seg(u, 0, .55))).toFixed(2)}px)` : 'none';
    const kl = seg(u, .28, .8); dot.style.transform = `scale(${E.outBack(kl, 1.8).toFixed(3)})`;
    const kr = seg(u, .3, 1.5); ring.style.transform = `scale(${(.15 + 1.25 * E.outCubic(kr)).toFixed(3)})`; ring.style.opacity = (kr > 0 ? .85 * (1 - kr) : 0).toFixed(3);
  } };
}

/* ================================================================== clip: interchange */
async function clipInterchange() {
  const DUR = 7;
  const metro = await (await fetch(DATA + 'metro.geojson')).json();
  const F = (pred) => metro.features.find(pred);
  const L1 = F((f) => f.properties.id === 'L1').geometry.coordinates, L3 = F((f) => f.properties.id === 'L3').geometry.coordinates;
  const st = Object.fromEntries(metro.features.filter((f) => f.properties.kind === 'station').map((f) => [f.properties.id, f.geometry.coordinates]));
  const c1 = cumul(L1), c3 = cumul(L3);
  const s1 = project_s(L1, c1, st['marol-l1']), s3 = project_s(L3, c3, st['marol-l3']);
  map.addSource('l1', { type: 'geojson', data: fc([]) }); map.addSource('l3', { type: 'geojson', data: fc([]) });
  for (const [id, col, w] of [['l3', '#22C3B6', 5], ['l1', '#3E8BF0', 6]]) {
    map.addLayer({ id: id + '-glow', type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': w * 3.2, 'line-blur': w * 2.2, 'line-opacity': .5 } });
    map.addLayer({ id: id + '-case', type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,.85)', 'line-width': w + 3 } });
    map.addLayer({ id: id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': w } });
  }
  const A = { center: [72.8813, 19.1086], zoom: 16.12, pitch: 54, bearing: 20 }, B = { center: [72.8683, 19.1098], zoom: 15.3, pitch: 48, bearing: 12 };
  const cam = (t) => {
    const k = E.inOutCubic(seg(t, 3.75, 6.75));
    const z = lerp(A.zoom + .1 * E.inOutSine(seg(t, 0, 3.9)), B.zoom, k) - .22 * Math.sin(Math.PI * k);   // lift a little mid-move
    return { center: [lerp(A.center[0], B.center[0], k), lerp(A.center[1], B.center[1], k)], zoom: z, pitch: lerp(A.pitch, B.pitch, k), bearing: lerp(A.bearing, B.bearing, k) };
  };
  const tags = [
    { id: 'marol-l1', name: 'Marol Naka', line: 'Line 1', c: 'var(--l1)', t0: .95, dx: -22, dy: 26, side: 'bl' },
    { id: 'marol-l3', name: 'Marol Naka', line: 'Line 3', c: 'var(--l3)', t0: 1.35, dx: -22, dy: -24, side: 'tl' },
    { id: 'airport-road', c: 'var(--l1)', t0: 1.75, minor: true },
    { id: 'chakala', name: 'Chakala (J B Nagar)', line: 'Line 1', c: 'var(--l1)', t0: 5.15, dx: 22, dy: 24, side: 'br' },
  ].map((o) => {
    const node = el('st', `<div class="node${o.minor ? ' minor' : ''}"></div>` + (o.minor ? '' : `<div class="tag"><i>${o.line.replace('Line ', 'L')}</i><b>${o.name}</b></div>`));
    node.style.setProperty('--c', o.c); return { ...o, node, tag: node.querySelector('.tag'), dotn: node.querySelector('.node') };
  });
  const pins = [
    { ...PROPS.privilon, t0: 2.25, stem: 150, mini: true },
    { ...PROPS.a723, t0: 2.85, stem: 120 },
    { ...PROPS.corporate, t0: 5.55, stem: 120 },
  ].map(makePin);
  const labels = [
    { cls: 'gl caps', html: 'Marol', ll: [72.8836, 19.1068], t0: .3, t1: 4.6 },
    { cls: 'gl caps', html: 'Chakala', ll: [72.8640, 19.1081], t0: 5.0, t1: 99 },
  ].map((l) => ({ ...l, node: el(l.cls, l.html) }));
  return { DUR, apply(t) {
    map.jumpTo(cam(t));
    const r1 = 2900 * E.outCubic(seg(t, .2, 2.5)), r3 = 2600 * E.outCubic(seg(t, .5, 2.7));
    map.getSource('l1').setData(fc(r1 > 1 ? [line(subline(L1, c1, s1 - r1, s1 + r1))] : []));
    map.getSource('l3').setData(fc(r3 > 1 ? [line(subline(L3, c3, s3 - r3, s3 + r3))] : []));
    return () => {
      for (const g of tags) {
        const a = seg(t, g.t0, g.t0 + .5); g.node.style.opacity = a.toFixed(3); place(g.node, P(st[g.id]));
        g.dotn.style.transform = `scale(${E.outBack(seg(t, g.t0, g.t0 + .45), 1.6).toFixed(3)})`;
        if (g.tag) { const w = g.tag.offsetWidth, h = g.tag.offsetHeight, k = E.outCubic(seg(t, g.t0 + .1, g.t0 + .7));
          const x = g.side[1] === 'l' ? g.dx - w : g.dx, y = g.side[0] === 't' ? g.dy - h : g.dy;
          g.tag.style.transform = `translate(${(x + (g.side[1] === 'l' ? 1 : -1) * 10 * (1 - k)).toFixed(1)}px, ${y.toFixed(1)}px)`; g.tag.style.opacity = k.toFixed(3); }
      }
      for (const l of labels) { const p = P(l.ll), a = seg(t, l.t0, l.t0 + .8) * (1 - seg(t, l.t1 - .6, l.t1));
        l.node.style.opacity = a.toFixed(3); l.node.style.transform = `translate(${(p.x - l.node.offsetWidth / 2).toFixed(1)}px, ${(p.y - l.node.offsetHeight / 2).toFixed(1)}px)`; }
      for (const p of pins) p.update(t);
    };
  } };
}

/* ================================================================== clips: walking routes (Google look) */
const ROUTES = {
  route_privilon: { prop: 'privilon', station: 'Marol Naka', m: 140, min: 2, from: 'Marol Naka', pinSide: 'left', badgeSide: 'right' },
  route_corporate: { prop: 'corporate', station: 'Chakala (J B Nagar)', m: 850, min: 11, from: 'Chakala', pinSide: 'left', badgeSide: 'right' },
  route_723: { prop: 'a723', station: 'Marol Naka', m: 700, min: 9, from: 'Marol Naka', pinSide: 'right', badgeSide: 'left' },
};
async function clipRoute() {
  const DUR = 6, R = ROUTES[CLIP], prop = PROPS[R.prop];
  const gj = await (await fetch(DATA + 'routes/' + CLIP + '.geojson')).json();
  const metro = await (await fetch(DATA + 'metro.geojson')).json();
  const route = gj.features[0].geometry.coordinates, rc = cumul(route), RL = rc[rc.length - 1];
  map.addSource('metro', { type: 'geojson', data: fc(metro.features.filter((f) => f.properties.kind === 'station_area' || f.properties.id === 'L1')) });
  map.addLayer({ id: 'st-area', type: 'fill', source: 'metro', filter: ['==', ['get', 'kind'], 'station_area'], paint: { 'fill-color': '#DCE6F4', 'fill-outline-color': '#AFC3E2' } }, 'road-label');
  map.addLayer({ id: 'l1-case', type: 'line', source: 'metro', filter: ['==', ['get', 'id'], 'L1'], paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 14, 3, 19, 9] } }, 'road-label');
  map.addLayer({ id: 'l1', type: 'line', source: 'metro', filter: ['==', ['get', 'id'], 'L1'], paint: { 'line-color': '#6E9FE3', 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 14, 1.6, 19, 5] } }, 'road-label');

  // framing: the whole walk, the pin and the badge, clear of the distance chip (bottom left)
  const xs = route.map((c) => c[0]), ys = route.map((c) => c[1]);
  const bounds = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
  const fit = map.cameraForBounds(bounds, { padding: { top: 230, bottom: 300, left: 520, right: 420 } });
  const zEnd = Math.min(fit.zoom, 18.6), cEnd = [fit.center.lng, fit.center.lat];
  const start = route[0];
  const camA = { center: [lerp(cEnd[0], start[0], .12), lerp(cEnd[1], start[1], .12)], zoom: zEnd + .26, bearing: -3 }, camB = { center: cEnd, zoom: zEnd, bearing: 0 };
  const cam = (t) => { const k = E.inOutSine(seg(t, 0, DUR)), kc = E.inOutCubic(seg(t, 0, DUR - .6));
    return { center: [lerp(camA.center[0], camB.center[0], kc), lerp(camA.center[1], camB.center[1], kc)], zoom: lerp(camA.zoom, camB.zoom, k), bearing: lerp(camA.bearing, camB.bearing, k), pitch: 0 }; };

  // walking dots: fixed on the ground, 15 px apart at the final zoom
  const gap = 15.5 * mpp(zEnd, cEnd[1]), nDots = Math.max(2, Math.round(RL / gap)), dots = [];
  for (let i = 0; i <= nDots; i++) dots.push(at(route, rc, RL * i / nDots));
  const cv = document.getElementById('dots'), DPR = window.devicePixelRatio || 1; cv.width = 1920 * DPR; cv.height = 1080 * DPR; const g = cv.getContext('2d');

  // the pin, the station badge, their cards
  const pin = el('gpin', `<div class="shadow"></div>${PIN_SVG}`);
  const pinCard = el('card-l', `<b>${prop.name}</b><small>${prop.sub === 'Marol' ? 'Marol' : 'Chakala'}, Andheri East</small>`);
  const badge = el('badge', `<div class="ico">${ICON_TRAIN}</div>`);
  const badgeCard = el('card-l', `<b>${R.station}</b><small><i></i>Metro Line 1</small>`, badge);
  const pinSvg = pin.querySelector('svg'), pinShadow = pin.querySelector('.shadow'), ico = badge.querySelector('.ico');

  // the distance chip: digit wheels that spin and land on the canonical figure
  const chip = el('chip', `<div class="walk">${ICON_WALK}</div><div><div class="nums"></div><div class="cap">Walk from <em>${R.from}</em> metro</div></div>`);
  // the figures count up and settle on the canonical walk (plain text: no wheels, no blur, nothing to collide)
  const nums = chip.querySelector('.nums');
  nums.innerHTML = `<span class="n" id="nm"></span><span class="unit">m</span><span class="sep"></span><span class="n" id="nmin"></span><span class="unit">min</span>`;
  const nm = nums.querySelector('#nm'), nmin = nums.querySelector('#nmin');
  nm.style.minWidth = `${String(R.m).length * .62}em`; nmin.style.minWidth = `${String(R.min).length * .62}em`;
  const T_COUNT0 = 1.55, T_COUNT1 = 3.35;

  const DOT_T0 = 1.35, DOT_T1 = 4.35;
  return { DUR, apply(t) {
    map.jumpTo(cam(t));
    return () => {
      // badge
      const pb = P(route[0]); place(badge, pb);
      const kb = seg(t, .25, .75); ico.style.transform = `scale(${(.4 + .6 * E.outBack(kb, 1.7)).toFixed(3)})`; ico.style.opacity = seg(t, .25, .45).toFixed(3);
      const kbc = E.outCubic(seg(t, .5, 1.1)), bw = badgeCard.offsetWidth, bh = badgeCard.offsetHeight;
      const bx = R.badgeSide === 'right' ? 34 : -34 - bw;
      badgeCard.style.transform = `translate(${(bx + (R.badgeSide === 'right' ? -12 : 12) * (1 - kbc)).toFixed(1)}px, ${(-bh / 2).toFixed(1)}px)`; badgeCard.style.opacity = kbc.toFixed(3);
      // pin
      const pp = P(prop.ll); place(pin, pp);
      const kp = seg(t, .75, 1.35), fall = 1 - E.outQuint(kp);
      pinSvg.style.transform = `translateY(${(-70 * fall).toFixed(2)}px) scale(${(1 + .05 * Math.sin(Math.PI * seg(t, 1.2, 1.5)) * -1).toFixed(3)}, ${(1 - .05 * Math.sin(Math.PI * seg(t, 1.2, 1.5))).toFixed(3)})`;
      pinSvg.style.opacity = seg(t, .75, .95).toFixed(3);
      pinShadow.style.opacity = (seg(t, .8, 1.3)).toFixed(3); pinShadow.style.transform = `scale(${(.4 + .6 * E.outCubic(seg(t, .8, 1.35))).toFixed(3)})`;
      const kpc = E.outCubic(seg(t, 1.05, 1.65)), pw = pinCard.offsetWidth, ph = pinCard.offsetHeight;
      const px = R.pinSide === 'right' ? pp.x + 30 : pp.x - 30 - pw;
      pinCard.style.transform = `translate(${(px + (R.pinSide === 'right' ? -12 : 12) * (1 - kpc)).toFixed(1)}px, ${(pp.y - 36 - ph / 2).toFixed(1)}px)`; pinCard.style.opacity = kpc.toFixed(3);
      // dots
      g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, 1920, 1080);
      const kd = E.inOutSine(seg(t, DOT_T0, DOT_T1)), head = kd * nDots;
      for (let i = 0; i <= nDots; i++) {
        const s = clamp01((head - i + 1.2) / 1.2); if (s <= 0) break;
        const q = P(dots[i]), r = 5.6 * (.35 + .65 * E.outBack(s, 2));
        g.beginPath(); g.arc(q.x, q.y, r + 1.9, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.96)'; g.fill();
        g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2); g.fillStyle = '#2A55E5'; g.fill();
      }
      // chip
      const kc = E.outCubic(seg(t, 1.1, 1.75));
      chip.style.opacity = kc.toFixed(3); chip.style.transform = `translateY(${(22 * (1 - kc)).toFixed(2)}px)`;
      const kn = E.outQuart(seg(t, T_COUNT0, T_COUNT1));
      nm.textContent = String(Math.round(R.m * kn)); nmin.textContent = String(Math.max(kn > 0 ? 1 : 0, Math.round(R.min * kn)));
    };
  } };
}

/* ================================================================== boot */
let clip = null;
window.__seek = async (t) => {
  const after = clip.apply(t);
  await idle();
  if (after) after();
  return true;
};
map.on('load', async () => {
  if (CLIP === 'descent') { map.setFog({ range: [1.2, 9], color: 'rgb(214, 224, 236)', 'high-color': '#9fb9d8', 'horizon-blend': .08, 'space-color': '#cfdcea', 'star-intensity': 0 }); clip = clipDescent(); }
  else if (CLIP === 'interchange') { map.setFog({ range: [1, 7], color: 'rgb(200, 212, 228)', 'high-color': '#8fa9cc', 'horizon-blend': .1, 'space-color': '#c4d2e4', 'star-intensity': 0 }); clip = await clipInterchange(); }
  else clip = await clipRoute();
  await document.fonts.ready;
  window.__DUR = clip.DUR;
  await window.__seek(0);
  window.__ready = true;
  console.log('[cap] ready', CLIP, clip.DUR);
});
map.on('error', (e) => console.log('[cap] map error', e && e.error && e.error.message));
