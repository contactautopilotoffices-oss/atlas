// Altruist demo: Reliable Tech Park from outside (the exterior bake, nothing inside), the walk to Airoli station, and
// each offered floor as its 2D CAD plan with the processes colour-coded (js/plan.js). There is no 3D interior here:
// a floor always opens as the plan. World frame = rtp_local (x east, y north, metres from the Maps pin); three (x, y, z)
// = (x, height, -y). The camera eases to a goal that every input moves, and frames are drawn only while it moves.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadExterior } from '../../twin/web/js/exterior.js';
import { sunAt, sunDir, lookFor, skyCanvasTexture } from '../../twin/web/js/tod.js';
import { openPlan, closePlan, loadPlan } from './plan.js';
import { buildRTP } from './codebuild.js';

const $ = (s) => document.querySelector(s);
const WEB = '../twin/web/';
const DPR = Math.min(devicePixelRatio || 1, 2), DPR_MOVE = Math.min(DPR, 1.35);
const P = (x, y, h) => new THREE.Vector3(x, h, -y);
const load = (t) => { $('#load').textContent = t; $('#load').classList.toggle('show', !!t); };

// ------------------------------------------------------------------ renderer and light (10:30 in the morning, real sun)
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.AgXToneMapping;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 1, 9000);
const { az, el } = sunAt(10.5), LK = lookFor(el);
const sky = skyCanvasTexture(LK, az, el); scene.background = sky;
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromEquirectangular(sky).texture; scene.environmentIntensity = .9;
renderer.toneMappingExposure = LK.exposure;
scene.fog = new THREE.Fog(LK.fog, 700, 3200);
const hemi = new THREE.HemisphereLight(LK.zen.clone().lerp(new THREE.Color('#fff'), .55), LK.ground, LK.hemiI); scene.add(hemi);
const sun = new THREE.DirectionalLight(LK.sunColor, LK.sunI); sun.position.copy(sunDir(az, el).multiplyScalar(500)); scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(2600, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5d6b43, roughness: 1 }));
ground.position.y = -.8; scene.add(ground);

// ------------------------------------------------------------------ data, then the building first (2 MB), the city after
const fetchJSON = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const [B, PJ] = await Promise.all([fetchJSON(WEB + 'building.json'), fetchJSON(WEB + 'plate.json')]);
const ZL = (lv) => (B.ffl0 ?? .6) + lv * B.floor_to_floor;
const xs = PJ.outer.map(p => p[0]), ys = PJ.outer.map(p => p[1]);
const CX = (Math.min(...xs) + Math.max(...xs)) / 2, CY = (Math.min(...ys) + Math.max(...ys)) / 2, SPAN = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
load('Loading the building…');
const CODE = new URLSearchParams(location.search).has('code');      // ?code: everything built in the browser from data (no Blender bake, no GLB)
const TW = await loadExterior(gltf, { plate: PJ.plate, outer: PJ.outer, levels: B.levels, ftf: B.floor_to_floor, ffl0: B.ffl0, base: WEB + 'models/exterior/', ctxUrl: WEB + B.context, forceProcedural: CODE });
scene.add(TW.frame); TW.setNight(0); load('');
// ?code: RTP itself is generated here too (js/codebuild.js), lit by a real-time sun shadow and screen-space ambient
// occlusion, with the city reflected in its glass. Nothing in this mode comes from Blender.
let BUILDING = TW.low, composer = null, CB = null;
if (CODE) {
  CB = buildRTP({ outer: PJ.outer, levels: B.levels, ftf: B.floor_to_floor, ffl0: B.ffl0 ?? .6 }); TW.low.visible = false; TW.high.visible = false; scene.add(CB.group); BUILDING = CB.group;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const d = sunDir(az, el); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0005; sun.shadow.normalBias = .25;
  sun.position.set(CX + d.x * 600, d.y * 600, -CY + d.z * 600); sun.target.position.set(CX, 0, -CY); scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -360, right: 360, top: 360, bottom: -360, near: 50, far: 1400 }); sun.shadow.camera.updateProjectionMatrix();
  sun.intensity = LK.sunI * 1.15; hemi.intensity = LK.hemiI * .8;
  const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'), import('three/addons/postprocessing/GTAOPass.js'), import('three/addons/postprocessing/OutputPass.js')]);
  const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { samples: 4, type: THREE.HalfFloatType });
  composer = new EffectComposer(renderer, rt); composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight); ao.blendIntensity = .9; ao.updateGtaoMaterial({ radius: 4.5, distanceExponent: 1.4, thickness: 2.5, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false }); composer.addPass(ao);
  composer.addPass(new OutputPass());
  renderer.shadowMap.needsUpdate = true;
}
const HEIGHT = (CB ? CB.height : TW.height) || ZL(B.levels);

// ------------------------------------------------------------------ camera: goal-driven orbit (turn, pan, zoom), eased
const home = { t: P(CX, CY, 14), az: 5.45, polar: 1.12, dist: SPAN * (innerWidth <= 760 ? 3.2 : 2.0) };
const cur = { t: home.t.clone(), az: home.az + .35, polar: home.polar - .08, dist: home.dist * 1.25 }, goal = { t: home.t.clone(), az: home.az, polar: home.polar, dist: home.dist };
let dirty = true, lastMove = 0;
const LIM = { dmin: 30, dmax: 3400, pmin: .12, pmax: 1.47 };
function poseCamera() {
  const s = Math.sin(cur.polar); camera.position.set(cur.t.x + cur.dist * s * Math.sin(cur.az), cur.t.y + cur.dist * Math.cos(cur.polar), cur.t.z + cur.dist * s * Math.cos(cur.az));
  camera.lookAt(cur.t);
}
const angD = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
function glideTo(g) { Object.assign(goal, { az: g.az ?? goal.az, polar: g.polar ?? goal.polar, dist: g.dist ?? goal.dist }); if (g.t) goal.t.copy(g.t); dirty = true; }
// screen point -> ground point at the target's height (zoom towards the cursor, like a map)
const rc = new THREE.Raycaster(), ndc = new THREE.Vector2();
function groundAt(px, py, y = goal.t.y) { ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1); rc.setFromCamera(ndc, camera); const r = rc.ray; if (Math.abs(r.direction.y) < 1e-4) return null; const k = (y - r.origin.y) / r.direction.y; return k > 0 ? r.origin.clone().addScaledVector(r.direction, k) : null; }
function zoomBy(f, px, py) {
  const d1 = THREE.MathUtils.clamp(goal.dist * f, LIM.dmin, LIM.dmax), real = d1 / goal.dist;
  if (px !== undefined) { const g = groundAt(px, py); if (g) goal.t.lerp(g, 1 - real); }
  goal.dist = d1; dirty = true;
}
function panBy(dx, dy) {          // drag on screen = move over the ground (right / forward), scaled with distance
  const k = goal.dist * 0.0011 * (camera.fov / 36), right = new THREE.Vector3(Math.cos(cur.az), 0, -Math.sin(cur.az)), fwd = new THREE.Vector3(-Math.sin(cur.az), 0, -Math.cos(cur.az));
  goal.t.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k); clampTarget(); dirty = true;
}
function clampTarget() { const d = Math.hypot(goal.t.x - CX, -goal.t.z - CY); if (d > 1500) { const s = 1500 / d; goal.t.x = CX + (goal.t.x - CX) * s; goal.t.z = -CY + (goal.t.z + CY) * s; } goal.t.y = THREE.MathUtils.clamp(goal.t.y, 0, 80); }

const ptrs = new Map(); let pinch = null, downAt = null, moved = false;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey }); downAt = { x: e.clientX, y: e.clientY }; moved = false; pinch = null; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) { hover(e); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) moved = true;
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (pinch) { zoomBy(pinch.d / d, mx, my); panBy(mx - pinch.mx, my - pinch.my); } pinch = { d, mx, my }; return;
  }
  if (p.b === 2 || p.b === 1 || p.sh) panBy(dx, dy);
  else { goal.az -= dx * .0055; goal.polar = THREE.MathUtils.clamp(goal.polar - dy * .0042, LIM.pmin, LIM.pmax); dirty = true; }
});
const endPtr = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
canvas.addEventListener('pointerup', (e) => { const click = !moved && ptrs.size === 1; endPtr(e); if (click) pick(e); });
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault();
  if (e.ctrlKey) zoomBy(Math.exp(e.deltaY * .01), e.clientX, e.clientY);                       // trackpad pinch
  else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2) panBy(-e.deltaX, 0);                // trackpad sideways swipe
  else zoomBy(Math.exp(e.deltaY * .0016), e.clientX, e.clientY); }, { passive: false });
const keys = {};
addEventListener('keydown', (e) => { if ($('#plan').classList.contains('on')) return; keys[e.code] = true; if (e.key === '+' || e.key === '=') zoomBy(.8); if (e.key === '-') zoomBy(1.25); if (e.code === 'KeyH' || e.code === 'Escape') toHome(); dirty = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function keyPan(dt) {
  const s = 600 * dt; let any = false;
  if (keys.ArrowLeft || keys.KeyA) { panBy(s, 0); any = true; } if (keys.ArrowRight || keys.KeyD) { panBy(-s, 0); any = true; }
  if (keys.ArrowUp || keys.KeyW) { panBy(0, s); any = true; } if (keys.ArrowDown || keys.KeyS) { panBy(0, -s); any = true; }
  if (keys.KeyE || keys.PageUp) { goal.t.y += 25 * dt; clampTarget(); any = true; } if (keys.KeyQ || keys.PageDown) { goal.t.y -= 25 * dt; clampTarget(); any = true; }
  return any;
}

// ------------------------------------------------------------------ the two offered floors: a band on the facade, a card
const OFFER = B.floors.filter(f => (f.tenants || []).length).map(f => ({ level: f.level, id: f.tenants[0] }));
const ccw = (r) => { let A = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; A += a[0] * b[1] - b[0] * a[1]; } return A >= 0 ? r : r.slice().reverse(); };
function bandGeometry(lv) {
  const R = ccw(PJ.outer), gs = [], z0 = ZL(lv) + .15, h = B.floor_to_floor - .3;
  for (let i = 0; i < R.length; i++) {
    const a = R[i], b = R[(i + 1) % R.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < .05) continue;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = Math.sin(ang), ny = -Math.cos(ang), off = .55;
    const g = new THREE.BoxGeometry(len + .3, h, .12); g.rotateY(ang); g.translate((a[0] + b[0]) / 2 + nx * off, z0 + h / 2, -((a[1] + b[1]) / 2 + ny * off)); gs.push(g);
  }
  return mergeGeometries(gs);
}
const bands = {};
for (const o of OFFER) {
  const m = new THREE.Mesh(bandGeometry(o.level), new THREE.MeshBasicMaterial({ color: 0x2f6fe8, transparent: true, opacity: .34, depthWrite: false }));
  m.renderOrder = 2; m.userData.offer = o; scene.add(m); bands[o.level] = m;
}
function hiBand(lv) { for (const [k, m] of Object.entries(bands)) m.material.opacity = +k === lv ? .7 : .34; dirty = true; }
function hover(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); rc.setFromCamera(ndc, camera);
  const hit = rc.intersectObjects(Object.values(bands), false)[0]; const lv = hit ? hit.object.userData.offer.level : null;
  canvas.style.cursor = hit ? 'pointer' : ''; hiBand(lv);
}
function pick(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); rc.setFromCamera(ndc, camera);
  const hit = rc.intersectObjects(Object.values(bands), false)[0]; if (hit) showFloor(hit.object.userData.offer);
}
const plans = {};
async function floorCards() {
  const box = $('#floors'); box.innerHTML = '';
  for (const o of OFFER.slice().sort((a, b) => b.level - a.level)) {
    const b = document.createElement('button'); b.className = 'fl';
    b.innerHTML = `<b>${o.level}</b><div><span>${o.level === 6 ? '6th floor' : o.level === 4 ? '4th floor' : o.level + 'th floor'}</span><small>…</small></div><span class="go">Plan ›</span>`;
    b.onclick = () => showFloor(o); b.onmouseenter = () => hiBand(o.level); b.onmouseleave = () => hiBand(null); box.appendChild(b);
    loadPlan(o.id).then(p => { plans[o.id] = p; const n = p.zones.length; b.querySelector('small').textContent = p.zones[0] && p.zones[0].kind === 'process'
      ? `${p.title.replace(/^.*·\s*/, '')} · ${p.totals.work_seats.toLocaleString('en-IN')} CAD work seats · ${n} processes` : `${p.title.replace(/^.*·\s*/, '')} · ${p.totals.all_seats} seats · ${n} rooms`; });
  }
}
floorCards();
function showFloor(o) { hiBand(o.level); stopRoute(); openPlan(o.id, () => { hiBand(null); dirty = true; }); }
function toHome() { stopRoute(); glideTo({ ...home, t: home.t.clone() }); }

// ------------------------------------------------------------------ labels over the 3D
const tags = $('#tags'), TAGS = [];
const occl = new THREE.Raycaster();
function hidden(pos) { const d = pos.clone().sub(camera.position), L = d.length(); occl.set(camera.position, d.normalize()); occl.far = L - 2; return occl.intersectObject(BUILDING, true).length > 0; }
function addTag(html, pos, cls = '', when = () => true, occlude = false) { const d = document.createElement('div'); d.className = 'tag ' + cls; d.innerHTML = `<div>${html}</div>`; tags.appendChild(d); const t = { d, pos, when, occlude }; TAGS.push(t); return t; }
function placeTags() {
  const v = new THREE.Vector3();
  for (const t of TAGS) { const on = t.when(); if (!on) { t.d.style.display = 'none'; continue; }
    v.copy(t.pos).project(camera); const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && !(t.occlude && hidden(t.pos)); t.d.style.display = vis ? '' : 'none';
    if (vis) t.d.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px,${(1 - v.y) / 2 * innerHeight}px) translate(-50%,-100%)`; }
}
addTag('Reliable Tech Park<small>MIDC Airoli</small>', P(CX + 8, CY + 6, HEIGHT + 10));

// ------------------------------------------------------------------ the city (after the first frames)
let terrain = null;
const heightAt = (x, y) => { if (!terrain) return 0; const r = new THREE.Raycaster(new THREE.Vector3(x, 400, -y), new THREE.Vector3(0, -1, 0), 0, 900); const h = r.intersectObject(terrain, true)[0]; return h ? h.point.y : 0; };
const inRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
function minRect(ring) {          // the smallest rectangle round a footprint: centre, length, width, angle
  let best = null; const pts = ring.slice(0, -1);
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], t = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(t), s = Math.sin(t);
    const u = pts.map(p => p[0] * c + p[1] * s), v = pts.map(p => -p[0] * s + p[1] * c), w = Math.max(...u) - Math.min(...u), h = Math.max(...v) - Math.min(...v);
    if (!best || w * h < best.w * best.h) { const cu = (Math.max(...u) + Math.min(...u)) / 2, cv = (Math.max(...v) + Math.min(...v)) / 2; best = { w, h, t, cx: cu * c - cv * s, cy: cu * s + cv * c }; } }
  if (best.h > best.w) { [best.w, best.h] = [best.h, best.w]; best.t += Math.PI / 2; } return best;
}
// take a building out of the city mesh (its triangles above the ground inside the footprint), to put the real one there
function cutOut(root, ring, groundY) {
  const tri = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let n = 0;
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o === terrain || !o.geometry.attributes.position) return;
    o.updateWorldMatrix(true, false); const g = o.geometry, pos = g.attributes.position, idx = g.index, cnt = idx ? idx.count : pos.count, keep = []; let cut = 0;
    for (let i = 0; i < cnt; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      tri.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      if (tri.y > groundY + .5 && inRing(ring, tri.x, -tri.z)) { cut++; continue; } keep.push(i0, i1, i2);
    }
    if (cut) { const ng = g.clone(); ng.setIndex(keep); o.geometry = ng; n += cut; }
  });
  return n;
}
function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function cafeteria(ring, gy) {
  const r = minRect(ring), L = r.w - .6, W = r.h - .6, wallH = 4.2, rise = Math.min(4, W * .2), g = new THREE.Group(); g.name = 'cafeteria';
  const wallTex = canvasTex(512, 64, (x, w, h) => { x.fillStyle = '#efe9df'; x.fillRect(0, 0, w, h); x.fillStyle = '#5b7f8e'; for (let i = 6; i < w; i += 32) x.fillRect(i, 18, 24, 30); });
  wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(Math.round(L / 6), 1);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(L, wallH, W), [new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: .9 }), new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: .9 }),
    new THREE.MeshStandardMaterial({ color: 0xbfc4c6 }), new THREE.MeshStandardMaterial({ color: 0xbfc4c6 }), new THREE.MeshStandardMaterial({ map: wallTex, roughness: .8 }), new THREE.MeshStandardMaterial({ map: wallTex, roughness: .8 })]);
  walls.position.y = wallH / 2; g.add(walls);
  // the barrel roof (an arch of metal sheet with ribs), as in the satellite view
  const ribTex = canvasTex(256, 32, (x, w, h) => { x.fillStyle = '#d6dadc'; x.fillRect(0, 0, w, h); x.fillStyle = '#aeb4b8'; for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 3, h); });
  ribTex.wrapS = THREE.RepeatWrapping; ribTex.repeat.set(Math.round(L / 1.2), 1);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, L + .8, 40, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: ribTex, roughness: .45, metalness: .55, side: THREE.DoubleSide }));
  roof.rotation.z = Math.PI / 2; roof.scale.set(rise, 1, W / 2 + .4); roof.position.y = wallH; g.add(roof);
  const gable = new THREE.Shape(); gable.moveTo(-W / 2, 0); gable.absarc(0, 0, W / 2, Math.PI, 0, true);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.ShapeGeometry(gable, 24), new THREE.MeshStandardMaterial({ color: 0xe6e1d8, side: THREE.DoubleSide })); m.scale.set(1, rise / (W / 2), 1); m.rotation.y = Math.PI / 2; m.position.set(s * L / 2, wallH, 0); g.add(m); }
  g.position.set(r.cx, gy, -r.cy); g.rotation.y = r.t; return { g, top: gy + wallH + rise };
}
function tennis(ring, gy) {
  const r = minRect(ring), L = Math.min(r.w, 36.6), W = Math.min(r.h, 18.3), g = new THREE.Group(); g.name = 'tennis court';
  const tex = canvasTex(1024, 512, (x, w, h) => { x.fillStyle = '#3f7d55'; x.fillRect(0, 0, w, h); const sx = w / L, sy = h / W, cl = 23.77, cw = 10.97, x0 = (L - cl) / 2, y0 = (W - cw) / 2;
    x.fillStyle = '#4f9e6a'; x.fillRect(x0 * sx, y0 * sy, cl * sx, cw * sy); x.strokeStyle = '#fff'; x.lineWidth = 4;
    x.strokeRect(x0 * sx, y0 * sy, cl * sx, cw * sy); const d = 1.37; x.beginPath(); x.moveTo(x0 * sx, (y0 + d) * sy); x.lineTo((x0 + cl) * sx, (y0 + d) * sy); x.moveTo(x0 * sx, (y0 + cw - d) * sy); x.lineTo((x0 + cl) * sx, (y0 + cw - d) * sy);
    const sl = 6.4; x.moveTo((L / 2 - sl) * sx, (y0 + d) * sy); x.lineTo((L / 2 - sl) * sx, (y0 + cw - d) * sy); x.moveTo((L / 2 + sl) * sx, (y0 + d) * sy); x.lineTo((L / 2 + sl) * sx, (y0 + cw - d) * sy);
    x.moveTo((L / 2 - sl) * sx, h / 2); x.lineTo((L / 2 + sl) * sx, h / 2); x.stroke(); });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(L, W).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: .95, polygonOffset: true, polygonOffsetFactor: -4 }));
  surf.position.y = .06; g.add(surf);
  const net = new THREE.Mesh(new THREE.BoxGeometry(.05, 1, 12.8), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, transparent: true, opacity: .7 })); net.position.y = .5; g.add(net);
  const fence = new THREE.Mesh(new THREE.BoxGeometry(L, 3, W), new THREE.MeshStandardMaterial({ color: 0x2f4a3a, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide })); fence.position.y = 1.5; g.add(fence);
  g.position.set(r.cx, gy, -r.cy); g.rotation.y = r.t; return g;
}
async function city() {
  load('Loading the city…');
  const ctx = await TW.context(); const CT = await fetchJSON(WEB + B.context);
  ctx.traverse(o => { if (o.isMesh && /terrain/i.test(o.name + (o.parent && o.parent.name))) terrain = o; });
  if (terrain) ground.position.y = Math.min(-.8, heightAt(CX + 700, CY) - .6);
  // the cafeteria behind RTP (north): a barrel-roofed hall on its mapped footprint, in place of the plain city block
  const cafe = CT.buildings.find(b => b.id.startsWith('54ce'));
  if (cafe) { const c = minRect(cafe.ring), gy = heightAt(c.cx, c.cy), grow = cafe.ring.map(([x, y]) => [c.cx + (x - c.cx) * 1.12, c.cy + (y - c.cy) * 1.12]);
    let n = cutOut(ctx, grow, gy); const big = cafe.ring.map(([x, y]) => [c.cx + (x - c.cx) * 1.35, c.cy + (y - c.cy) * 1.35]);
    for (const b of CT.buildings) { if (b === cafe) continue; const bx = b.ring.reduce((a, p) => a + p[0], 0) / b.ring.length, by = b.ring.reduce((a, p) => a + p[1], 0) / b.ring.length; if (inRing(big, bx, by)) n += cutOut(ctx, b.ring.map(([x, y]) => [bx + (x - bx) * 1.15, by + (y - by) * 1.15]), gy); }
    const m = cafeteria(cafe.ring, gy); scene.add(m.g);
    addTag('Cafeteria', P(c.cx, c.cy, m.top + 3), '', () => !routeOn, true); console.log('[demo] cafeteria in, city triangles cut', n); }
  // the court between the arms: the tennis court on its mapped outline
  const court = (CT.green || []).find(g => /playground|pitch|tennis/.test(g.kind || ''));
  if (court) { const c = minRect(court.ring); scene.add(tennis(court.ring, heightAt(c.cx, c.cy))); }
  if (CODE) {
    ctx.traverse(o => { if (o.isMesh) { const m = [].concat(o.material)[0]; const flat = /ground|road|grass|water/i.test(o.name + m.name); o.receiveShadow = true; o.castShadow = !flat && !m.transparent; } });
    scene.traverse(o => { if (o.isMesh && (o.parent.name === 'cafeteria' || o.parent.name === 'tennis court')) { o.castShadow = !o.material.transparent; o.receiveShadow = true; } });
    renderer.shadowMap.needsUpdate = true;
    // what the curtain wall reflects: the real surroundings, captured once from the court
    const crt = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }), cc = new THREE.CubeCamera(1, 4000, crt);
    cc.position.set(CX - 25, 16, -CY + 25); CB.group.visible = false; const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping; cc.update(renderer, scene); renderer.toneMapping = tm; CB.group.visible = true;
    for (const k of ['glass', 'acp', 'steel', 'rail']) { CB.mats[k].envMap = crt.texture; CB.mats[k].needsUpdate = true; }
  }
  load(''); dirty = true; buildRoute();
}

// ------------------------------------------------------------------ the walk to Airoli station (OpenStreetMap path)
let RT = null, routeOn = false;
async function buildRoute() {
  const R = await fetchJSON('data/route.json'); const grp = new THREE.Group(); grp.visible = false; scene.add(grp);
  const ribbon = (pts, w, y, mat, ro) => {
    const pos = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
      const h = (typeof y === 'function' ? y(p) : y); pos.push(p[0] + nx, h, -(p[1] + ny), p[0] - nx, h, -(p[1] - ny));
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.renderOrder = ro || 0; return m;
  };
  // densify the route so it follows the terrain
  const dense = []; for (let i = 0; i < R.route.length - 1; i++) { const a = R.route[i], b = R.route[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12)); for (let k = 0; k < n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  dense.push(R.route[R.route.length - 1]);
  const H = dense.map(p => Math.hypot(p[0], p[1]) < 640 ? heightAt(p[0], p[1]) : ground.position.y + .4);
  let i = 0; const yOf = () => H[Math.min(i++, H.length - 1)] + 1.2;
  grp.add(ribbon(dense, 16, (p) => yOf(), new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, transparent: true, opacity: .95 }), 3));
  i = 0; grp.add(ribbon(dense, 10, (p) => yOf() + .3, new THREE.MeshBasicMaterial({ color: 0x2f6fe8, depthWrite: false, transparent: true, opacity: 1 }), 4));
  // beyond the city model (650 m): the roads and the railway from OpenStreetMap, flat on the ground
  const far = (pts) => { const out = []; let run = []; for (const p of pts) { if (Math.hypot(p[0], p[1]) > 630) run.push(p); else { if (run.length > 1) out.push(run); run = []; } } if (run.length > 1) out.push(run); return out; };
  const W = { trunk: 18, primary: 16, secondary: 12, tertiary: 9, residential: 6, unclassified: 6, service: 4 };
  const roadM = new THREE.MeshStandardMaterial({ color: 0x55534f, roughness: 1 }), gy = ground.position.y + .05;
  const rg = []; for (const r of R.roads) for (const run of far(r.p)) rg.push(ribbon(run, W[r.k] || 6, gy + (W[r.k] || 6) * .002, roadM).geometry);
  if (rg.length) grp.add(new THREE.Mesh(mergeGeometries(rg), roadM));
  const railM = new THREE.MeshStandardMaterial({ color: 0x6e655c, roughness: .9 }); const rl = [];
  for (const r of R.rail) for (const run of far(r)) rl.push(ribbon(run, 9, gy + .08, railM).geometry);
  if (rl.length) grp.add(new THREE.Mesh(mergeGeometries(rl), railM));
  for (const pl of R.platforms) { const sh = new THREE.Shape(pl.map(([x, y]) => new THREE.Vector2(x, y))); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8e2d6 })); m.position.y = gy; grp.add(m); }
  if (R.station && R.station.length > 2) { const sh = new THREE.Shape(R.station.map(([x, y]) => new THREE.Vector2(x, y))); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 7, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9d3c6, transparent: true, opacity: .75 })); m.position.y = gy; grp.add(m); }
  const st = R.station_xy, mid = dense[Math.floor(dense.length * .55)];
  addTag(`Airoli station<small>${R.label_km} km · ${R.label_min} min walk</small>`, P(st[0], st[1], ground.position.y + 30), 'st', () => routeOn);
  addTag(`Walk to Airoli station<small>${R.label_km} km · ${R.label_min} min</small>`, P(mid[0], mid[1], H[Math.floor(dense.length * .55)] + 12), 'st', () => routeOn);
  RT = { grp, dense, st };
}
function startRoute() {
  if (!RT) return; routeOn = true; RT.grp.visible = true; $('#route').classList.add('on');
  const xs = RT.dense.map(p => p[0]), ys = RT.dense.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  scene.fog.near = 4000; scene.fog.far = 9000; glideTo({ t: P(cx + 40, cy - 20, 0), dist: span * 2.0, polar: .2, az: 0 }); $('#hint').style.display = 'none'; dirty = true;
}
function stopRoute() { if (!routeOn) return; routeOn = false; $('#hint').style.display = ''; scene.fog.near = 700; scene.fog.far = 3200; if (RT) RT.grp.visible = false; $('#route').classList.remove('on'); dirty = true; }
$('#route').onclick = () => { if (routeOn) { stopRoute(); toHome(); } else startRoute(); };

// ------------------------------------------------------------------ frame loop: draw only when something moves
const clock = new THREE.Clock(); let lowRes = false;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, clock.getDelta()), k = 1 - Math.exp(-dt * 7.5);
  if (keyPan(dt)) dirty = true;
  const da = angD(cur.az, goal.az), moving = Math.abs(da) > 1e-4 || Math.abs(goal.polar - cur.polar) > 1e-4 || Math.abs(Math.log(goal.dist / cur.dist)) > 1e-4 || cur.t.distanceToSquared(goal.t) > 1e-4;
  if (moving) { cur.az += da * k; cur.polar += (goal.polar - cur.polar) * k; cur.dist *= Math.pow(goal.dist / cur.dist, k); cur.t.lerp(goal.t, k); dirty = true; lastMove = performance.now(); }
  if (moving && !lowRes) { renderer.setPixelRatio(DPR_MOVE); renderer.setSize(innerWidth, innerHeight, false); if (composer) { composer.setPixelRatio(DPR_MOVE); composer.setSize(innerWidth, innerHeight); } lowRes = true; }
  if (!moving && lowRes && performance.now() - lastMove > 220) { renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight, false); if (composer) { composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight); } lowRes = false; dirty = true; }
  if (!dirty || $('#plan').classList.contains('on')) return;
  dirty = false; poseCamera(); if (composer) composer.render(); else renderer.render(scene, camera); placeTags();
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); if (composer) composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); dirty = true; });
camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); frame();
setTimeout(city, 60);
window.__demo = { scene, camera, renderer, goal, cur, glideTo, startRoute, stopRoute, showFloor: (lv) => showFloor(OFFER.find(o => o.level === lv)), get dirty() { return dirty; }, set dirty(v) { dirty = v; } };
// Route state and the viewer must exist before a direct CAD link calls showFloor.
const requestedFloor = new URLSearchParams(location.search).get('floor');
if (requestedFloor) { const offer = OFFER.find(o => o.id === requestedFloor); if (offer) showFloor(offer); }
