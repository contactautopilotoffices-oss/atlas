// Reliable Tech Park, Airoli, for Altruist: one building, the offered floors (4th suite; 6th option A / B), and a walk-to-move
// walkthrough per plan. Forked from the F1 Skymark twin viewer. World frame = rtp_local (x east, y north, metres from the
// Maps pin): three (x, y, z) = (x, height, -y). Level n's finished floor is at B.ffl0 + n * B.floor_to_floor.
// One camera owner: either a running glide (anim) or the current mode's controller writes the camera each frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildLevels, clipConvex } from './building.js';
import { loadExterior } from './exterior.js';
import { sunAt, sunDir, lookFor, skyCanvasTexture, STOPS } from './tod.js';
import { skyTexture } from './look.js';
import { Tenant } from './tenant.js';
import { inRings, polyLen, polySmooth } from './nav.js';
import { md } from './md.js';
import { createMinimap } from './minimap.js';
import { createPresenter } from '../../../../noida-skymark/volt/present.js';

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const TOUCH = matchMedia('(pointer:coarse)').matches;
const PHONE = () => innerWidth <= 760;
const FAST = Q.has('fast');                                   // automated checks: shorter glides
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUR = (s) => FAST ? s * .25 : s;
const KTX2_CDN = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/';   // pinned with the vendored r169
if (TOUCH) document.body.classList.add('touch');

// ------------------------------------------------------------------ data
const fetchJSON = async (u) => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
const firstOK = async (list, kind = 'json') => { for (const u of [].concat(list || [])) { try { const r = await fetch(u, { method: 'GET', cache: 'no-cache' }); if (r.ok) return { url: u, data: kind === 'json' ? await r.json() : await r.text() }; } catch (e) { /* next */ } } return null; };
const B = await fetchJSON('building.json');
const MAN = {}; for (const f of B.floors) for (const t of new Set([...(f.tenants || []), ...(f.options || [])])) MAN[t] = await fetchJSON(`tenants/${t}.json`);
const PJ = await fetchJSON(B.plate);
// a plan whose CAD layout has not been delivered yet is listed as 'in preparation' (never a broken glide)
await Promise.all(Object.values(MAN).map(async m => { try { const r = await fetch(m.layout, { method: 'HEAD', cache: 'no-cache' }); m.missing = !r.ok; } catch (e) { m.missing = true; } }));
for (const f of B.floors) if (f.options && (f.tenants || []).every(id => MAN[id].missing)) { const ok = f.options.find(id => !MAN[id].missing); if (ok) f.tenants = [ok]; }
for (const f of B.floors) if ((f.tenants || []).every(id => MAN[id] && MAN[id].missing) && f.tenants && f.tenants.length) { f.pending = f.tenants; f.tenants = []; }
const MODELS = await fetchJSON('models/index.json').catch(() => ({ tenants: {} }));
const PLATE = PJ.plate, OUTER = PJ.outer, FTF = B.floor_to_floor, FFL0 = B.ffl0 ?? .6;
const ZL = (lv) => FFL0 + lv * FTF;              // finished floor level of level lv (m above ground)

// ------------------------------------------------------------------ renderer, scene, light
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });   // 0.1 m to 9 km without depth fighting (the bake's renderer note)
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.6 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15; renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = !TOUCH; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene();
const skyTex = skyTexture(); scene.background = skyTex; scene.fog = new THREE.Fog(0xdfe6ea, 420, 1100);
const pmrem = new THREE.PMREMGenerator(renderer);
const ENV = { skyRT: pmrem.fromEquirectangular(skyTex), room: pmrem.fromScene(new RoomEnvironment(), .04).texture, hdr: {} }; ENV.sky = ENV.skyRT.texture;
scene.environment = ENV.sky; scene.environmentIntensity = .9;      // the sky: what the glass reflects outside; the room when inside a GLB floor
const hemi = new THREE.HemisphereLight(0xfffaf2, 0xb3a58f, .85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1de, 2.1); scene.add(sun, sun.target);
sun.castShadow = !TOUCH; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .1, 9000); camera.rotation.order = 'YXZ';
let shadowsDirty = true;

// ------------------------------------------------------------------ the building: the photo twin outside, per-level pieces inside
const shell = buildLevels(PLATE, { levels: B.levels, ftf: FTF, base: FFL0, accent: B.accent || '#2f8fe6', mobile: TOUCH });
scene.add(shell.root);
const PX = PLATE.map(p => p[0]), PY = PLATE.map(p => p[1]);
const CX = (Math.min(...PX) + Math.max(...PX)) / 2, CY = (Math.min(...PY) + Math.max(...PY)) / 2, SPAN = Math.max(Math.max(...PX) - Math.min(...PX), Math.max(...PY) - Math.min(...PY));
const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 72).rotateX(-Math.PI / 2).translate(CX, -.3, -CY), new THREE.MeshStandardMaterial({ color: 0xb9ac95, roughness: 1 }));   // until the city loads (then removed: no coplanar ground)
ground.receiveShadow = true; scene.add(ground);
const SUN = { dir: new THREE.Vector3(-.4, .75, .5).normalize() };
const fitSun = (y) => { const d = SUN.dir.y > .05 ? SUN.dir : new THREE.Vector3(SUN.dir.x, .05, SUN.dir.z).normalize(); sun.position.set(CX + d.x * 180, y + d.y * 180, -CY + d.z * 180); sun.target.position.set(CX, y, -CY); const s = SPAN * .8;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 420 }); sun.shadow.camera.updateProjectionMatrix(); shadowsDirty = true; };
fitSun(0);
const LV = shell.levels.map((g, i) => ({ g, lift: 0, liftTo: 0, z: ZL(i) }));
let gltfLoader = null;
async function loader() {
  if (gltfLoader) return gltfLoader;
  gltfLoader = new GLTFLoader(); gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  try { const { KTX2Loader } = await import(KTX2_CDN + 'loaders/KTX2Loader.js'); const k = new KTX2Loader().setTranscoderPath(KTX2_CDN + 'libs/basis/').detectSupport(renderer); gltfLoader.setKTX2Loader(k); }
  catch (e) { console.warn('[twin] KTX2 decoder not loaded; KTX2 textures will fail', e && e.message); }
  return gltfLoader;
}
// the real building and its city: the exterior worker's Blender bake when delivered, else the procedural build (exterior.js)
const TW = await loadExterior(await loader(), { plate: PLATE, outer: OUTER, levels: B.levels, ftf: FTF, ffl0: FFL0, ctxUrl: B.context, forceProcedural: Q.get('exterior') === 'procedural' })
  .catch(e => { console.warn('[rtp] exterior failed', e); return null; });
if (TW) scene.add(TW.frame);
// per level: the plate itself (the L is not convex: clipped by a big square, i.e. kept whole); the band on the facade's outer face
LV.forEach((L, i) => shell.setOutline(i, [TW ? TW.footprint : [[-2000, -2000], [2000, -2000], [2000, 2000], [-2000, 2000]]], [], [OUTER]));
// desk rows on plan floors, from each plan's layout (already in rtp_local: identity frame); only the plan shown on that floor
function deskHints() { for (const f of B.floors) for (const id of (f.tenants || []).slice(0, 1)) { const m = MAN[id]; fetchJSON(m.layout).then(Lt => {
  const th = ((m.frame && m.frame.rot_deg) || 0) * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), dx = (m.frame && m.frame.dx) || 0, dy = (m.frame && m.frame.dy) || 0;
  shell.setDesks(m.floor, (Lt.desks || []).map(d => ({ ...d, c: [c * d.c[0] - s * d.c[1] + dx, s * d.c[0] + c * d.c[1] + dy], a: d.a + th }))); shadowsDirty = true; }).catch(() => {}); } }
deskHints();

// ------------------------------------------------------------------ time of day (real sun for the site; one slider)
const TOD = { h: Q.has('hour') ? +Q.get('hour') : 10.5, sky: null };
function applyTod(h, rebuildEnv = true) {
  TOD.h = h; const { az, el } = sunAt(h), L = lookFor(el); TOD.L = L;
  SUN.dir.copy(el > -2 ? sunDir(az, el) : sunDir((az + 180) % 360, 35));      // at night the shadows come from the moon
  // the light fades to ~0 on both sides of the sun/moon switch, so the shadow direction never visibly flips
  sun.color.copy(el > -2 ? L.sunColor : new THREE.Color('#9fb3d9')); sun.userData.base = el > -2 ? L.sunI * THREE.MathUtils.smoothstep(el, -2, 1.5) : .25 * THREE.MathUtils.smoothstep(-el, 2, 7);
  hemi.color.copy(L.zen.clone().lerp(new THREE.Color('#ffffff'), .55)); hemi.groundColor.copy(L.ground); hemi.userData.base = L.hemiI;
  if (TOD.sky) TOD.sky.dispose(); TOD.sky = skyCanvasTexture(L, az, el); scene.background = TOD.sky;
  if (rebuildEnv) { const night = L.night > .5, hd = ENV.hdr[night ? 'night' : 'day'];
    if (hd) ENV.sky = hd.texture;                                                      // the bake's own reflections from RTP's court
    else { if (ENV.skyRT) ENV.skyRT.dispose(); ENV.skyRT = pmrem.fromEquirectangular(TOD.sky); ENV.sky = ENV.skyRT.texture; } }
  scene.fog.color.copy(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar; TOD.exposure = L.exposure;
  if (TW) TW.setNight(L.night);
  for (const lvl of shell.levels) for (const o of [lvl.userData.hints]) o && o.traverse(x => { if (x.isInstancedMesh && x.material.isMeshBasicMaterial) x.material.color.setScalar(.75 + .5 * L.night); });
  fitSun(S.level !== null && S.level !== undefined ? ZL(S.level) : 0); applyExposure(S.tenant);
  const lab = el < -6 ? 'Night' : el < 0 ? (h < 12 ? 'Dawn' : 'Blue hour') : el < 10 ? (h < 12 ? 'Sunrise' : 'Golden hour') : h < 11.5 ? 'Morning' : h < 14.5 ? 'Midday' : 'Afternoon';
  const el2 = $('#todl'); if (el2) el2.textContent = `${lab} · ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round(h % 1 * 60) % 60).padStart(2, '0')}`;
}
if (TW && TW.envUrl) import('three/addons/loaders/RGBELoader.js').then(({ RGBELoader }) => {
  const ld = new RGBELoader();
  for (const k of ['day', 'night']) { const u = TW.envUrl(k === 'night'); if (!u) continue;
    ld.loadAsync(u).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; ENV.hdr[k] = pmrem.fromEquirectangular(t); t.dispose(); applyTod(TOD.h, true); }).catch(() => {}); }
}).catch(() => {});
if (TW && TW.addUplights) TW.addUplights(!TOUCH);
{ const r = $('#tod'); if (r) { r.value = TOD.h; let pend = 0; r.oninput = () => { applyTod(+r.value, false); clearTimeout(pend); pend = setTimeout(() => applyTod(+r.value, true), 160); }; } }
// ------------------------------------------------------------------ camera poses and glides (one owner)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpCam = new THREE.PerspectiveCamera(); tmpCam.rotation.order = 'YXZ';
const pose = () => ({ p: camera.position.clone(), yaw: camera.rotation.y, pitch: camera.rotation.x, fov: camera.fov });
const lookPose = (p, t, fov) => { tmpCam.position.copy(p); tmpCam.lookAt(t); const e = new THREE.Euler().setFromQuaternion(tmpCam.quaternion, 'YXZ'); return { p: p.clone(), yaw: e.y, pitch: e.x, fov }; };
function setPose(o) { camera.position.copy(o.p); camera.rotation.set(o.pitch, o.yaw, 0, 'YXZ'); if (Number.isFinite(o.fov) && camera.fov !== o.fov) { camera.fov = o.fov; camera.updateProjectionMatrix(); } }
const ease = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;      // ease in-out cubic
const sstep = (a, b, k) => { const t = Math.min(1, Math.max(0, (k - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAng = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const vfovFor = (hfov) => { const a = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 16 / 9;   // a hidden pane can report a 0 x 0 window
  let v = 2 * Math.atan(Math.tan(hfov * Math.PI / 360) / a) * 180 / Math.PI; return Math.max(38, Math.min(PHONE() ? 78 : 64, v)); };
let anim = null;
function play(dur, fn) {
  if (anim) { const a = anim; anim = null; a.res(false); }
  return new Promise(res => { anim = { t0: performance.now(), dur: Math.max(1, dur * 1000), fn, res }; });
}
function cancelAnim() { if (anim) { const a = anim; anim = null; a.res(false); } }
const bez = (a, b, c, d, t) => { const u = 1 - t; return a.clone().multiplyScalar(u * u * u).add(b.clone().multiplyScalar(3 * u * u * t)).add(c.clone().multiplyScalar(3 * u * t * t)).add(d.clone().multiplyScalar(t * t * t)); };
function glidePose(to, dur, ctrl) {                     // eased move; optional bezier control points (world)
  const from = pose();
  const c1 = ctrl ? ctrl[0] : from.p.clone().lerp(to.p, 1 / 3), c2 = ctrl ? ctrl[1] : from.p.clone().lerp(to.p, 2 / 3);
  return play(dur, (k) => { const e = ease(k); setPose({ p: bez(from.p, c1, c2, to.p, e), yaw: lerpAng(from.yaw, to.yaw, e), pitch: lerp(from.pitch, to.pitch, e), fov: lerp(from.fov, to.fov, e) }); });
}

// orbit (building and section views)
const orbit = { target: V(CX, 14, -CY), az: 5.45, polar: 1.16, dist: SPAN * (innerWidth <= 760 ? 3.4 : 2.05), auto: true, idleAt: 0 };
const BASE_FOV = () => PHONE() ? 55 : 38;
const orbitPose = (o) => { const p = V(o.target.x + o.dist * Math.sin(o.polar) * Math.sin(o.az), o.target.y + o.dist * Math.cos(o.polar), o.target.z + o.dist * Math.sin(o.polar) * Math.cos(o.az)); return lookPose(p, o.target, BASE_FOV()); };
function glideOrbit(to, dur) {                           // move along the orbit sphere: no straight cut through the building
  const f = { target: orbit.target.clone(), az: orbit.az, polar: orbit.polar, dist: orbit.dist };
  const dAz = Math.atan2(Math.sin(to.az - f.az), Math.cos(to.az - f.az));
  return play(dur, (k) => { const e = ease(k); orbit.target.lerpVectors(f.target, to.target, e); orbit.az = f.az + dAz * e; orbit.polar = lerp(f.polar, to.polar, e); orbit.dist = lerp(f.dist, to.dist, e); setPose(orbitPose(orbit)); });
}

// ------------------------------------------------------------------ app state
const S = { mode: 'orbit', level: null, tenant: null, room: null, view: 0, seen: {}, hover: -1, tourOn: false };
const T = {};                                             // loaded tenants by id
const frameOf = (m) => { const f = m.frame || {}; return { th: (f.rot_deg || 0) * Math.PI / 180, dx: f.dx || 0, dy: f.dy || 0 }; };
const toTenantFrame = (m, [x, y]) => { const { th, dx, dy } = frameOf(m), c = Math.cos(-th), s = Math.sin(-th), u = x - dx, v = y - dy; return [c * u - s * v, s * u + c * v]; };
let loadCount = 0; const loadChip = (d, txt) => { loadCount += d; $('#load').textContent = txt || 'Loading the floor…'; $('#load').classList.toggle('show', loadCount > 0); };

async function loadTenant(id) {
  if (T[id]) return T[id].ready;
  const m = MAN[id], t = new Tenant(m); T[id] = t;
  t.ready = (async () => {
    if (m.blueprint) try { t.bpBounds = (await fetchJSON(m.blueprint.meta)).bounds; } catch (e) { }
    loadChip(1, `Loading ${m.name}…`);
    try {
      let exclude = null;
      if (m.shared_with && MAN[m.shared_with]) {        // a strip both drawings show (Volt + Paytm): drawn once, by the neighbour
        const nb = await fetchJSON(MAN[m.shared_with].layout); const ring = (nb.demise ? nb.demise.outer : nb.floor[0].outer);
        exclude = [ring.map(p => toTenantFrame(m, [p[0], p[1]]))];
      }
      await t.load(fetchJSON, exclude);
      const { th, dx, dy } = frameOf(m); t.theta = th;
      t.group.rotation.y = th; t.group.position.set(dx, ZL(m.floor), -dy);
      // what exists: models/index.json (delivered files); ?build also tries the Blender worker's local _build output
      const idx = (MODELS.tenants || {})[id], dev = Q.has('build') ? m.model.dev_build : null;
      const camList = [idx && idx.cameras && 'models/' + idx.cameras, dev && dev.cameras].filter(Boolean);
      const viewList = [idx && idx.viewer && 'models/' + idx.viewer, dev && dev.viewer].filter(Boolean);
      const cams = camList.length ? await firstOK(camList) : null; t.camSource = cams ? cams.url : 'fallback';
      const want = Q.get('model') || m.model.use || 'auto';
      let viewer = want !== 'placeholder' && viewList.length ? await firstOK(viewList) : null;
      if (viewer && want !== 'placeholder') {
        try { await t.loadGLB(await loader(), viewer.data, viewer.url.replace(/[^/]*$/, '')); t.modelSource = viewer.url; }
        catch (e) { console.warn('[twin] GLB failed, using the placeholder', e); t.group.clear(); viewer = null; }
      }
      if (!viewer) { t.buildPlaceholder(); t.modelSource = 'placeholder (from the CAD layout)'; }
      t.setupViews(cams && cams.data);
      LV[m.floor].g.add(t.group);                                    // lifts and hides with its level
      t.group.updateMatrixWorld(true); shadowsDirty = true;
      try { const sm = await fetchJSON(m.summary); if (sm._proof) t.proof = sm._proof; t.summary = sm; } catch (e) { }
      try { const a = await firstOK([m.assumptions.path], 'text'); t.assumptions = a ? section(a.data, m.assumptions.section) : ''; } catch (e) { t.assumptions = ''; }
    } finally { loadChip(-1); }
    return t;
  })();
  return t.ready;
}
const section = (text, head) => { if (!head) return text; const i = text.indexOf(head); if (i < 0) return text; const rest = text.slice(i); const lv = (text.slice(0, i).match(/(#+)\s*$/) || ['', '###'])[1]; const j = rest.slice(head.length).search(new RegExp(`\\n#{1,${lv.length}}\\s`)); return '## ' + (j < 0 ? rest : rest.slice(0, head.length + j)); };
function unloadLevel(lv) { for (const id of Object.keys(T)) if (MAN[id].floor === lv) { T[id].ready.then(t => t.dispose()); delete T[id]; } shadowsDirty = true; }

// ------------------------------------------------------------------ tenant-frame helpers
const W = (t, x, y, h) => t.group.localToWorld(V(x, h, -y));
const toPlan = (t, v) => { const l = t.group.worldToLocal(v.clone()); return [l.x, -l.z, l.y]; };
// plan heading A (CCW from +x) in the tenant frame <-> camera yaw
const yawOf = (t, A) => A + t.theta - Math.PI / 2;
const headOf = (t, yaw) => yaw - t.theta + Math.PI / 2;
function viewPose(t, v) {
  const [x, y, z] = v.position, tg = v.target || v.level_target;
  return lookPose(W(t, x, y, z), W(t, tg[0], tg[1], tg[2]), vfovFor(v.fov_h_deg || 75));
}

// ------------------------------------------------------------------ level visibility, section cut, band
// the offered floors glow softly on the facade in the building view (a sales-board read: these are the floors on offer);
// the hovered or chosen one glows full
const OFFERED = new Set(B.floors.filter(f => (f.tenants || []).length || (f.pending || []).length || (f.options || []).length).map(f => f.level));
function setBand(lv) { LV.forEach((L, i) => { const b = L.g.userData.band, on = i === lv || (OFFERED.has(i) && S.mode === 'orbit'); b.visible = on;
  b.traverse(o => { if (o.isMesh) { if (!o.userData.own) { o.material = o.material.clone(); o.material.transparent = true; o.userData.own = true; } o.material.opacity = i === lv ? 1 : .55; } }); }); }
function setFacadeCut(lv, s) { const L = LV[lv]; const f = L.g.userData.fac; f.scale.y = s; f.position.y = L.z * (1 - s); }
function liftAbove(lv) { LV.forEach((L, i) => { L.liftTo = lv !== null && i > lv ? 1 : 0; }); }
// what is drawn, by mode:
//   orbit   - the twin whole (its glass shows each level's ceiling, fixtures, core and desk rows), the band on hover
//   section - the twin cut just under the chosen floor; the part above lifts away; that floor's own slab, CAD facade
//             (cut low) and tenants; the floors below keep their hints
//   inside  - only the chosen floor (slab, facade, lid, tenants) plus the twin below it and the city round it
function insideLevel(lv) {
  const inside = lv !== null && S.mode !== 'section' && S.mode !== 'orbit';
  LV.forEach((L, i) => {
    const u = L.g.userData, hasT = Object.values(T).some(t => t.man.floor === i && t.group.parent);
    L.g.visible = lv === null || i === lv || (i < lv && S.mode === 'section') || (L.liftTo === 1 && L.lift < .97);
    u.shell.visible = lv !== null && i === lv; u.lid.visible = inside && i === lv;
    u.hints.visible = lv === null || i < lv || (i === lv && !hasT && !inside) || i > lv;
  });
  if (TW) { TW.setCut(lv === null ? 1e4 : ZL(lv) - .06); TW.high.visible = lv !== null && S.mode === 'section'; }
  shadowsDirty = true;
}
const TOP = { lift: 0 };
function tickLevels(dt) {
  let moving = false;
  for (const L of LV) { const k = 1 - Math.exp(-dt * 2.4); const before = L.lift; L.lift += (L.liftTo - L.lift) * k; if (Math.abs(L.liftTo - L.lift) < .002) L.lift = L.liftTo;
    if (L.lift !== before) moving = true; L.g.position.y = L.lift * 150; if (L.liftTo === 1 && L.lift > .97) L.g.visible = false; else if (L.liftTo === 0 && S.mode !== 'walk' && S.mode !== 'view' && S.mode !== 'tour') L.g.visible = true; }
  if (TW) { TOP.lift += ((S.mode === 'section' && S.level === LV.length - 1 ? 1 : 0) - TOP.lift) * (1 - Math.exp(-dt * 2.4));
    const up = S.level !== null ? (LV[S.level + 1] ? LV[S.level + 1].lift : TOP.lift) : 0; TW.high.position.y = up * 150;
    TW.cutHigh.constant = -((TW.cutY ?? 1e4) + up * 150);            // the lifted copy keeps only what was above the cut
    if (S.mode === 'section') TW.high.visible = up < .97; }
  if (moving) shadowsDirty = true;
}
let wallS = 1, wallTo = 1;
function setWalls(s, instant) { wallTo = s; if (instant) wallS = s; }
function tickWalls(dt) { if (wallS === wallTo) return; wallS += (wallTo - wallS) * (1 - Math.exp(-dt * 5)); if (Math.abs(wallS - wallTo) < .003) wallS = wallTo;
  for (const t of Object.values(T)) if (t.group.parent) t.setWallScale(wallS); shadowsDirty = true; }

// ------------------------------------------------------------------ floor picker
// a training-led suite (4th: 135 training seats, 18 work) is shown by all its seats, not by its few desks
const leadAll = (m) => m.seats.all && m.seats.all > 2 * (m.seats.work || 0);
const seatsTxt = (m) => leadAll(m) ? `${m.seats.all} seats · ${m.seats.work || 0} work` : m.seats.work ? `${m.seats.work} work seats` : m.seats.all ? `${m.seats.all} seats` : 'seat count to follow';
const floorsEl = $('#floors');
function renderFloors() {
  floorsEl.innerHTML = '';
  for (const f of B.floors) {
    const d = document.createElement('div'); d.className = 'floor' + (S.level === f.level ? ' sel' : ''); d.dataset.level = f.level;
    const occupied = (f.tenants || []).length || (f.pending || []).length;
    d.innerHTML = `<button class="fh"><b>${f.level || 'G'}</b><span>${f.name}</span></button>`;
    for (const id of f.options || (f.tenants && f.tenants.length ? f.tenants : f.pending) || []) { const m = MAN[id]; const b = document.createElement('button'); const cur = (f.tenants || []).includes(id); b.className = 'tn' + (f.options ? ' opt' + (cur ? ' cur' : '') : ''); b.innerHTML = `<i style="background:${m.accent}"></i>${m.name}<small>${seatsTxt(m)}${m.area_sqft ? ' · ' + m.area_sqft.toLocaleString('en-IN') + ' sq ft' : ''}</small>`; b.onclick = (e) => { e.stopPropagation(); if (!m.missing) chooseTenant(id); }; if (m.missing) { b.classList.add('later'); b.querySelector('small').textContent = '3D model in preparation'; } d.appendChild(b); }
    for (const l of f.later || []) { const b = document.createElement('div'); b.className = 'tn later'; b.innerHTML = `<i style="background:#c8c3bb"></i>${l.name}<small>${l.note}</small>`; d.appendChild(b); }
    if (!occupied) { const a = document.createElement('div'); a.className = 'avail'; a.textContent = f.status === 'lobby' ? (f.note || 'Lobby') : f.status === 'other' ? 'Not part of this offer' : 'Available'; d.appendChild(a); }
    d.querySelector('.fh').onclick = () => chooseFloor(f.level);
    d.onmouseenter = () => { S.hover = f.level; if (S.mode === 'orbit') setBand(f.level); };
    d.onmouseleave = () => { S.hover = -1; if (S.mode === 'orbit') setBand(S.level); };
    floorsEl.appendChild(d);
  }
}
renderFloors();

// ------------------------------------------------------------------ building -> floor -> tenant
const sectionOrbit = (lv) => ({ target: V(CX, ZL(lv) + .6, -CY), az: orbit.az, polar: PHONE() ? .62 : .78, dist: SPAN * (PHONE() ? 2.3 : 1.25) });
let navToken = 0;
async function toBuildingView() {
  const my = ++navToken; stopTour(); exitWalk(); setInside(false);
  if (S.mode !== 'orbit' && S.mode !== 'section' && S.level !== null) {    // inside: rise out to the section first
    setWalls(.42); for (const t of Object.values(T)) t.setCeiling(false); LV[S.level].g.userData.lid.visible = false;
    S.mode = 'section'; applyExposure(null); insideLevel(S.level);
    const so = sectionOrbit(S.level); const to = orbitPose(so), from = pose();
    await glidePose(to, DUR(2.2), [from.p.clone().add(V(0, 6, 0)), to.p.clone().add(V(0, -12, 0))]); Object.assign(orbit, so, { target: so.target.clone() });
    if (my !== navToken) return;
  }
  const old = S.level; S.mode = 'orbit'; applyExposure(null); S.level = null; S.tenant = null; liftAbove(null); setFacadeCut(old ?? 0, 1); setWalls(1); insideLevel(null); setBand(-1); renderFloors(); showFloorPanel();
  clearTags(); updateDock();
  await glideOrbit({ target: V(CX, 14, -CY), az: orbit.az + .5, polar: 1.16, dist: SPAN * (PHONE() ? 3.4 : 2.05) }, DUR(2.6));
  if (old !== null && my === navToken) unloadLevel(old);
  orbit.auto = true;
}
async function chooseFloor(lv, then) {
  const my = ++navToken; stopTour(); exitWalk();
  if (S.level !== null && S.level !== lv && S.mode !== 'orbit') { await toBuildingView(); if (my + 1 !== navToken && my !== navToken) { /* replaced */ } }
  const prev = S.level; if (prev !== null && prev !== lv) unloadLevel(prev);
  if (S.mode === 'view' || S.mode === 'walk' || S.mode === 'tour') {           // already inside this floor (another tenant): rise to the section
    setInside(false); setWalls(.42); for (const t of Object.values(T)) t.setCeiling(false);
    const so = sectionOrbit(lv); S.mode = 'section'; applyExposure(null); insideLevel(lv); const to = orbitPose(so), from = pose();
    await glidePose(to, DUR(2), [from.p.clone().add(V(0, 6, 0)), to.p.clone().add(V(0, -12, 0))]); Object.assign(orbit, so, { target: so.target.clone() });
  }
  my === navToken || (navToken = my);
  S.level = lv; S.mode = 'section'; orbit.auto = false; renderFloors(); setBand(-1); clearTags(); updateDock();
  const f = B.floors.find(x => x.level === lv);
  const loads = (f.tenants || []).map(id => loadTenant(id));
  liftAbove(lv); setFacadeCut(lv, .3); setWalls(.42, true); insideLevel(lv); fitSun(ZL(lv));
  await glideOrbit(sectionOrbit(lv), DUR(2.6));
  const ts = await Promise.all(loads); ts.forEach(t => { t.setWallScale(.42); t.setCeiling(false); }); insideLevel(lv);
  if (my !== navToken) return;
  sectionTags(f); showFloorPanel(f);
  if (then) return then();
  if (ts.length === 1 && !f.options) return land(ts[0]);
}
function swapOption(id) {                               // a floor with options (6th: A / B) shows one plan at a time
  const m = MAN[id], f = B.floors.find(x => x.level === m.floor); if (!f || !f.options || (f.tenants || []).includes(id)) return false;
  for (const o of f.tenants || []) if (T[o]) { T[o].ready.then(t => t.dispose()); delete T[o]; }
  f.tenants = [id]; shell.setOutline(m.floor, [TW ? TW.footprint : [[-2000, -2000], [2000, -2000], [2000, 2000], [-2000, 2000]]], [], [OUTER]);
  fetchJSON(m.layout).then(Lt => shell.setDesks(m.floor, Lt.desks || [])).catch(() => {}); renderFloors(); return true;
}
async function chooseTenant(id) {
  const m = MAN[id]; if (!m || m.missing) return;
  if (swapOption(id) && S.level === m.floor && S.mode !== 'orbit') { S.mode = 'section'; return chooseFloor(m.floor, async () => land(await loadTenant(id))); }
  if (S.level === m.floor && S.mode === 'section') { const t = await loadTenant(id); return land(t); }
  return chooseFloor(m.floor, async () => land(await loadTenant(id)));
}
// from the section, down into the tenant's reception entry view (walls rise as the camera comes down)
async function land(t) {
  const my = ++navToken; clearTags(); S.tenant = t; S.seen = {};
  const room = t.tourRooms[0]; if (!room) { console.warn('[twin] no rooms with views for', t.id); return; }
  const v = room.views[0], to = viewPose(t, v), from = pose();
  const back = V(Math.sin(to.yaw), 0, Math.cos(to.yaw));                              // behind the view direction
  const c1 = V(to.p.x, from.p.y * .5 + to.p.y * .5, to.p.z).addScaledVector(back, 5), c2 = to.p.clone().add(V(0, 2.6, 0));   // comes down over the room, settles at eye height
  S.room = room; S.view = -1; renderCard(); renderRoomsList();   // fill the room card before it is shown: setInside() reveals #right at once, and the card used to stay an empty white bar until the glide ended
  showTenantPanel(t); setInside(true);
  const start = from;
  const ok = await play(DUR(3.4), (k) => { const e = ease(k);
    setPose({ p: bez(start.p, c1, c2, to.p, e), yaw: lerpAng(start.yaw, to.yaw, sstep(.2, .95, k)), pitch: lerp(start.pitch, to.pitch, sstep(.15, .95, k)), fov: lerp(start.fov, to.fov, e) });
    if (k > .45) { setWalls(1); setFacadeCut(t.man.floor, Math.min(1, .3 + (k - .45) * 1.6)); }
    if (k > .8 && S.mode === 'section') { S.mode = 'view'; t.setCeiling(true); insideLevel(t.man.floor); for (const o of Object.values(T)) o.setCeiling(true); }
  });
  if (!ok || my !== navToken) return;
  S.mode = 'view'; setFacadeCut(t.man.floor, 1); insideLevel(t.man.floor); applyExposure(t);
  arriveRoom(room, 0); updateDock(); hint('Enter to walk · 1–4 views · ‹ › next');
}
function applyExposure(t) {
  // one rule: a GLB floor is lit by its bake (unlit lightmapped materials, AgX at 2^EV from <t>_viewer.json); the few
  // unbaked meshes (instanced furniture) get a dim room environment; the sun and sky lights are turned well down
  const glb = t && t.kind === 'glb' && S.mode !== 'orbit' && S.mode !== 'section';
  const out = S.mode === 'orbit' || S.mode === 'section', ex = (TOD && TOD.exposure) || 1.15;
  renderer.toneMappingExposure = glb ? 2 ** (t.exposureEV || 0) : (out ? ex : .92);
  // inside a floor the offices are lit as by day (placeholder floors have no bake): the slider is for the outside
  hemi.intensity = glb ? .12 : out ? (hemi.userData.base ?? .85) : .85; sun.intensity = glb ? .35 : out ? (sun.userData.base ?? 2.1) : 1.6;
  if (!out) { hemi.color.set('#fffaf2'); hemi.groundColor.set('#b3a58f'); sun.color.set('#fff1de'); } else if (TOD && TOD.L) { hemi.color.copy(TOD.L.zen.clone().lerp(new THREE.Color('#ffffff'), .55)); hemi.groundColor.copy(TOD.L.ground); }
  scene.environment = glb || !out ? ENV.room : ENV.sky; scene.environmentIntensity = glb ? .6 : out ? .9 : .7; }

// ------------------------------------------------------------------ rooms and quick views
const KINDS = { entry: 'Entry', feature: 'Feature', reverse: 'Reverse', detail: 'Detail' };
function arriveRoom(room, vi) {
  S.room = room; S.view = vi; (S.seen[room.name] = S.seen[room.name] || new Set()).add(vi);
  renderCard(); renderRoomsList();
  if (S.seen[room.name].size >= room.views.length) openOptions(room, true);
}
function renderCard() {
  const r = S.room, t = S.tenant; if (!r || !t) return;
  const v = r.views[S.view] || {};
  $('#card').innerHTML = `<div class="k">${t.man.name} · floor ${t.man.floor}</div><h2>${r.label}</h2>
    <div class="meta">${r.seats ? r.seats + ' seats · ' : ''}${Math.round(r.area)} m²${v.source === 'fallback' ? ' · view from layout' : ''}</div>
    <div class="views">${r.views.map((x, i) => `<button data-i="${i}" class="${i === S.view ? 'on' : ''} ${S.seen[r.name] && S.seen[r.name].has(i) ? 'seen' : ''}">${i + 1}<small>${KINDS[x.kind] || x.kind}</small></button>`).join('')}</div>`;
  $('#card').querySelectorAll('.views button').forEach(b => b.onclick = () => goView(+b.dataset.i));
}
async function goView(i, opts = {}) {
  const t = S.tenant, r = S.room; if (!t || !r || !r.views[i]) return false;
  if (S.mode === 'walk') exitWalk(true);
  if (S.mode === 'tour' && !opts.tour) stopTour();
  const v = r.views[i]; S.goal = { room: r, view: v, i }; const ok = await routeGlide(t, viewPose(t, v), v.position, { inRoom: true });
  if (ok) arriveRoom(r, i); return ok;
}
async function goRoom(r, opts = {}) {
  const t = S.tenant; if (!t) return false;
  if (S.mode === 'walk') exitWalk(true);
  if (S.mode === 'tour' && !opts.tour) stopTour();
  closeOptions();
  const v = r.views[0]; S.goal = { room: r, view: v, i: 0 }; S.room = r; S.view = 0; renderCard(); renderRoomsList();
  const ok = await routeGlide(t, viewPose(t, v), v.position, {});
  if (ok) arriveRoom(r, 0); return ok;
}
function step(d) {
  const t = S.tenant, r = S.room; if (!t || !r) return;
  const i = S.view + d;
  if (i >= 0 && i < r.views.length) return goView(i);
  const ri = t.tourRooms.indexOf(r), nr = t.tourRooms[(ri + d + t.tourRooms.length) % t.tourRooms.length];
  return goRoom(nr);
}
// glide along the walkway: A* over the floor's walkable grid, through doors, never through walls
async function routeGlide(t, to, planTo, { inRoom }) {
  const [x0, y0, h0] = toPlan(t, camera.position), [x1, y1] = planTo, h1 = planTo[2] ?? 1.55;
  const path = t.grid.path(x0, y0, x1, y1) || [[x0, y0], [x1, y1]];
  const L = polyLen(path), from = pose();
  const dur = inRoom && L < 6 ? Math.min(1.5, Math.max(1, .9 + L * .1)) : Math.min(8, Math.max(1.5, L / 1.7));
  const travel = L > 2.2;
  S.lastPath = path; S.routing = true;
  return play(DUR(dur), (k) => {
    const e = ease(k), s = e * L, [x, y] = polySmooth(path, s, L), h = lerp(h0, h1, e);
    let yaw = from.yaw, pitch = from.pitch;
    if (travel) { const a = polySmooth(path, Math.min(L, s + 1.2), L), A = Math.atan2(a[1] - y, a[0] - x), py = yawOf(t, A);
      const w1 = sstep(0, .22, k); yaw = lerpAng(from.yaw, py, w1); pitch = lerp(from.pitch, -.03, w1); }
    const w2 = travel ? sstep(.68, 1, k) : e; yaw = lerpAng(yaw, to.yaw, w2); pitch = lerp(pitch, to.pitch, w2);
    setPose({ p: W(t, x, y, h), yaw, pitch, fov: lerp(from.fov, to.fov, e) });
  }).finally(() => { S.routing = false; });
}

// ------------------------------------------------------------------ walk (WASD / joystick + look)
const walk = { on: false, x: 0, y: 0, A: 0, pitch: 0, keys: {}, joy: [0, 0], lock: false, h: 1.6 };
function enterWalk() {
  const t = S.tenant; if (!t) return; stopTour(); cancelAnim();
  const [x, y] = toPlan(t, camera.position);
  const [fx, fy] = t.grid.nearestFree(x, y, .32, 2);
  Object.assign(walk, { on: true, x: fx, y: fy, A: headOf(t, camera.rotation.y), pitch: camera.rotation.x });
  // ease the eye to 1.6 m and the field of view to the walking lens
  const to = { ...pose(), p: W(t, fx, fy, walk.h), fov: vfovFor(PHONE() ? 70 : 78) };
  glidePose(to, DUR(.6)).then(ok => { if (ok) S.mode = 'walk'; });
  S.mode = 'walk'; document.body.classList.add('walk'); updateDock(); hint(TOUCH ? 'Stick to walk · drag to look' : 'W A S D to walk · drag to look · 1–4 views · Esc to stop');
  closeOptions();
}
function exitWalk(keepInside) {
  if (!walk.on) return; walk.on = false; walk.keys = {}; walk.joy = [0, 0]; document.body.classList.remove('walk');
  if (document.pointerLockElement) document.exitPointerLock();
  if (keepInside !== false && S.tenant) S.mode = 'view'; updateDock();
}
function tickWalk(dt) {
  const t = S.tenant; if (!t || !walk.on || anim) return;
  const k = walk.keys, f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + walk.joy[1], s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + walk.joy[0];
  const turn = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0); walk.A += turn * dt * 1.6;
  const sp = (k.ShiftLeft || k.ShiftRight ? 2.6 : 1.45) * dt, ca = Math.cos(walk.A), sa = Math.sin(walk.A);
  if (f || s) { const dx = (ca * f + sa * s) * sp, dy = (sa * f - ca * s) * sp; [walk.x, walk.y] = t.grid.move(walk.x, walk.y, dx, dy, .25); }
  camera.position.copy(W(t, walk.x, walk.y, walk.h)); camera.rotation.set(walk.pitch, yawOf(t, walk.A), 0, 'YXZ');
  const r = t.roomAt(walk.x, walk.y); const tr = r && t.tourRooms.find(q => q.name === r.name);
  if (tr && tr !== S.room) { S.room = tr; S.view = -1; renderCard(); renderRoomsList(); }
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (walk.on) walk.keys[e.code] = true;
  if (e.code === 'Escape') { if (S.mode === 'tour') stopTour(); else if (walk.on) exitWalk(); else if ($('#lb').classList.contains('show')) $('#lb').classList.remove('show'); else $('#gal').classList.remove('show'); return; }
  if (/^Digit[1-4]$/.test(e.code) && S.tenant && S.mode !== 'orbit' && S.mode !== 'section') { goView(+e.code.slice(5) - 1); return; }
  if ((e.code === 'KeyN' || e.code === 'PageDown') && S.tenant) step(1);
  if ((e.code === 'KeyB' || e.code === 'PageUp') && S.tenant) step(-1);
  if (e.code === 'Enter' && S.mode === 'view') enterWalk();
  if (e.code === 'KeyP' && !walk.on) presenter.toggle();
});
addEventListener('keyup', (e) => { walk.keys[e.code] = false; });
addEventListener('blur', () => { walk.keys = {}; });
// pointer: drag to look (walk / view) or orbit (building, section)
let drag = null;
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && e.isPrimary === false && drag) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { canvas.setPointerCapture(e.pointerId); } catch (er) { } orbit.idleAt = performance.now(); });
canvas.addEventListener('pointermove', (e) => {
  if (document.pointerLockElement === canvas && walk.on) { walk.A -= e.movementX * .0022; walk.pitch = THREE.MathUtils.clamp(walk.pitch - e.movementY * .0022, -1.1, .9); return; }
  if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (walk.on) { walk.A += dx * .004; walk.pitch = THREE.MathUtils.clamp(walk.pitch + dy * .004, -1.1, .9); }
  else if ((S.mode === 'orbit' || S.mode === 'section') && !anim) { orbit.az -= dx * .005; orbit.polar = THREE.MathUtils.clamp(orbit.polar - dy * .004, .25, 1.45); orbit.auto = false; orbit.idleAt = performance.now(); }
  else if (S.mode === 'view' && !anim) { camera.rotation.y += dx * .003; camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x + dy * .003, -1, .8); }
});
const endDrag = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag); canvas.addEventListener('lostpointercapture', endDrag);
canvas.addEventListener('wheel', (e) => { if ((S.mode === 'orbit' || S.mode === 'section') && !anim) { orbit.dist = THREE.MathUtils.clamp(orbit.dist * Math.exp(e.deltaY * .001), SPAN * .7, SPAN * 4); orbit.auto = false; orbit.idleAt = performance.now(); } e.preventDefault(); }, { passive: false });
// joystick (phones)
{ const j = $('#joy'), knob = j.querySelector('i'); let id = null;
  const at = (e) => { const b = j.getBoundingClientRect(), r = b.width / 2; let x = (e.clientX - b.left - r) / r, y = (e.clientY - b.top - r) / r; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } walk.joy = [x, -y]; knob.style.transform = `translate(${x * 35}px,${y * 35}px)`; };
  j.addEventListener('pointerdown', (e) => { id = e.pointerId; try { j.setPointerCapture(id); } catch (er) { } at(e); e.stopPropagation(); });
  j.addEventListener('pointermove', (e) => { if (e.pointerId === id) at(e); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; walk.joy = [0, 0]; knob.style.transform = ''; };
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end); }

// ------------------------------------------------------------------ tour: authored views as slow shots
async function startTour() {
  const t = S.tenant; if (!t) return; exitWalk(true); S.mode = 'tour'; S.tourOn = true; updateDock(); closeOptions(); hint('Tour · Esc to stop');
  let ri = Math.max(0, t.tourRooms.indexOf(S.room));
  while (S.tourOn) {
    const r = t.tourRooms[ri % t.tourRooms.length];
    for (let vi = 0; vi < r.views.length && S.tourOn; vi++) {
      const first = vi === 0;
      if (first && r !== S.room) { if (!(await goRoom(r, { tour: true }))) break; }
      else if (!(first && S.view === 0)) { if (!(await goView(vi, { tour: true }))) break; }
      if (!S.tourOn) break;
      // the shot: 5 s, a gentle push in and a slow pan, eased
      const p0 = pose(), dir = V(-Math.sin(p0.yaw), 0, -Math.cos(p0.yaw)), push = .45, pan = (vi % 2 ? -1 : 1) * .07;
      const [px, py] = toPlan(t, p0.p.clone().addScaledVector(dir, push)); const room = t.grid.clear(px, py) > .35 ? push : 0;
      const ok = await play(DUR(5), (k) => { const e = ease(k); setPose({ p: p0.p.clone().addScaledVector(dir, room * e), yaw: p0.yaw + pan * e, pitch: p0.pitch, fov: p0.fov }); });
      if (!ok) break;
    }
    ri++;
  }
}
function stopTour() { if (!S.tourOn) return; S.tourOn = false; cancelAnim(); if (S.mode === 'tour') S.mode = 'view'; updateDock(); }

// ------------------------------------------------------------------ material options (true swaps)
const chosen = {};
function optionsFor(t, r) { return (t.man.options || []).filter(o => o.rooms === '*' || (o.rooms && o.rooms.kinds && r && o.rooms.kinds.includes(r.kind)) || (Array.isArray(o.rooms) && r && o.rooms.includes(r.name))); }
function openOptions(r, auto) {
  const t = S.tenant; if (!t) return; const list = optionsFor(t, r); if (!list.length) return;
  const el = $('#opts'); const glb = t.kind === 'glb';
  el.innerHTML = `<div class="k">Finishes${r ? ' · ' + r.label : ''}</div>` + list.map(o => `<h4>${o.label}</h4><div class="sw">${o.choices.map(c => {
    const can = glb ? !!(t.glbMats && t.glbMats[c.material]) : !!c.preset; const on = (chosen[t.id + o.id] || o.choices[0].id) === c.id;
    return `<button data-o="${o.id}" data-c="${c.id}" class="${on ? 'on' : ''}" ${can ? '' : 'disabled title="This option is not in the model yet"'}><i style="background:${c.swatch}"></i>${c.label}</button>`; }).join('')}</div>`).join('');
  el.querySelectorAll('button[data-o]').forEach(b => b.onclick = () => { const o = list.find(x => x.id === b.dataset.o), c = o.choices.find(x => x.id === b.dataset.c);
    if (t.applyOption(o.part, c)) { chosen[t.id + o.id] = c.id; shadowsDirty = true; openOptions(r); } });
  el.classList.add('show'); $('#b-opts').classList.add('on');
}
function closeOptions() { $('#opts').classList.remove('show'); $('#b-opts').classList.remove('on'); }

// ------------------------------------------------------------------ panels, tags, dock
function showFloorPanel(f) { $('#fp').hidden = false; $('#tp').hidden = true; document.body.classList.remove('info');
  const c = $('#cmp'); if (!c) return; const ids = f && f.options; if (!ids) { c.hidden = true; return; }
  const ms = ids.map(id => MAN[id]), per = (m) => m.area_sqft && m.seats.work ? Math.round(m.area_sqft / m.seats.work) : null;
  const row = (k, f2) => `<tr><td>${k}</td>${ms.map(m => `<td>${f2(m) ?? '–'}</td>`).join('')}</tr>`;
  c.innerHTML = `<div class="k" style="margin:10px 0 4px">${f.name}: compare the layouts</div><table class="cmp"><tr><td></td>${ms.map(m => `<th><i style="background:${m.accent}"></i>${m.name.replace(/^.*·\s*/, '')}</th>`).join('')}</tr>
    ${row('Work seats', m => m.seats.work || null)}${row('All seats', m => m.seats.all || null)}${row('Carpet on the sheet', m => m.area_sqft ? m.area_sqft.toLocaleString('en-IN') + ' sq ft' : 'not stated')}${row('Measured floor', m => m.measured_sqft ? m.measured_sqft.toLocaleString('en-IN') + ' sq ft' : null)}${row('Measured floor per work seat', m => m.measured_sqft && m.seats.work ? Math.round(m.measured_sqft / m.seats.work) + ' sq ft' : null)}
    ${ms.some(m => m.highlights) ? row('Highlights', m => (m.highlights || []).join(', ') || null) : ''}</table>
    <div class="row">${ms.map(m => m.missing ? `<button class="pill" disabled style="opacity:.55;cursor:default">${m.name.replace(/^.*·\s*/, '')} · 3D model in preparation</button>` : `<button class="pill" data-id="${m.id}"><i style="width:8px;height:8px;border-radius:50%;background:${m.accent}"></i>Walk ${m.name.replace(/^.*·\s*/, '')}</button>`).join('')}</div>`;
  c.hidden = false; c.querySelectorAll('button[data-id]').forEach(b => b.onclick = () => chooseTenant(b.dataset.id)); }
function showTenantPanel(t) {
  const m = t.man, g = m.seats.groups || {};
  $('#fp').hidden = true; const el = $('#tp'); el.hidden = false; document.documentElement.style.setProperty('--accent', m.accent);
  el.innerHTML = `<div class="k">Reliable Tech Park · ${m.floor_label || 'floor ' + m.floor}</div>
    <div style="display:flex;align-items:center;justify-content:space-between"><h1 style="margin:2px 0 4px">${m.name}</h1><button class="pill" id="b-info" style="display:none">Info</button></div>
    <div class="full">
    <div class="big"><b>${leadAll(m) ? m.seats.all : m.seats.work || m.seats.all || '–'}</b><span>${leadAll(m) ? 'seats (' + (m.seats.work || 0) + ' work)' : m.seats.work ? 'work seats' : 'seats'}</span></div>
    <div class="k" style="margin-top:6px">Seat proof · ${m.seats.all} seats in all</div>
    <table>${Object.entries(g).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    ${t.proof && t.proof.dwg ? `<div style="font-size:11.5px;color:var(--sub)">Counted from <code>${t.proof.dwg}</code>, one chair block per seat.</div>` : ''}
    <div class="k" style="margin-top:10px">Rooms</div><div class="rooms" id="rooms"></div>
    <details id="assume"><summary>Assumptions</summary><div class="md">${md(t.assumptions || 'No assumptions file yet.')}</div></details>
    <div style="font-size:11px;color:var(--mute);margin-top:8px">Model: ${t.modelSource}. Views: ${t.camSource === 'fallback' ? 'computed from the layout' : 'Blender cameras'}.</div>
    </div>
    <div class="row"><button class="pill" id="b-floors">All floors</button><button class="pill" id="b-stills" hidden>Stills</button></div>`;
  $('#b-floors').onclick = () => toBuildingView();
  const st = stillsOf(t); if (st.count) { $('#b-stills').hidden = false; $('#b-stills').textContent = `Stills (${st.count})`; $('#b-stills').onclick = () => openGallery(t); }
  if (PHONE()) { $('#b-info').style.display = ''; $('#b-info').onclick = () => document.body.classList.toggle('info'); }
  renderRoomsList();
}
// stills: the tenant's rendered views (manifest stills[]) and, per finish option, its own set of stills. Empty = hidden.
function stillsOf(t) {
  const views = (t.man.stills || []).filter(x => x && x.src), sets = [];
  for (const o of t.man.options || []) for (const c of o.choices || []) { const e = Object.entries(c.stills || {}); if (e.length) sets.push({ title: `${o.label} · ${c.label}`, items: e.map(([cam, src]) => ({ camera: cam, src })) }); }
  return { views, sets, count: views.length + sets.reduce((n, s) => n + s.items.length, 0) };
}
function openGallery(t) {
  const st = stillsOf(t), cap = (x) => (x.title || x.camera || '').replace(new RegExp('^' + t.id + '_CAM_'), '').replace(/_/g, ' ');
  const fig = (x) => `<figure data-src="${x.src}"><img loading="lazy" src="${x.src}" alt=""><figcaption>${cap(x)}</figcaption></figure>`;
  $('#galbody').innerHTML = `<div class="k" style="color:#aaa">${t.man.name} · stills</div>` + (st.views.length ? `<h3>Views</h3><div class="grid">${st.views.map(fig).join('')}</div>` : '')
    + st.sets.map(s => `<h3>${s.title}</h3><div class="grid">${s.items.map(fig).join('')}</div>`).join('');
  $('#galbody').querySelectorAll('figure').forEach(f => f.onclick = () => { $('#lb img').src = f.dataset.src; $('#lb').classList.add('show'); });
  $('#gal').classList.add('show');
}
$('#gal .gx').onclick = () => $('#gal').classList.remove('show');
// the building's own renders (Blender Cycles, exterior worker): one per light state and camera
{ const st = TW && TW.manifest && TW.manifest.stills; const list = st ? Object.entries(st).filter(([, v]) => v && v.file) : [];
  const ORDER = ['morning', 'golden', 'night'], NAME = { morning: 'Morning', golden: 'Golden hour', night: 'Night' }, CAM = { court: 'from the court', road: 'from Thane-Belapur Road', orbit: 'from above' };
  if (list.length) { const b = $('#b-renders'); b.hidden = false; b.textContent = `Renders of the building (${list.length})`;
    b.onclick = () => { const groups = ORDER.map(k => [k, list.filter(([n]) => n.startsWith(k))]).filter(([, l]) => l.length);
      $('#galbody').innerHTML = `<div class="k" style="color:#aaa">Reliable Tech Park · Blender renders from the CAD and the site data</div>` + groups.map(([k, l]) => `<h3>${NAME[k] || k}</h3><div class="grid">${l.map(([n, v]) => `<figure data-src="models/exterior/${v.file}"><img loading="lazy" src="models/exterior/${v.file}" alt=""><figcaption>${NAME[k]} ${CAM[n.split('_').slice(1).join('_')] || ''}</figcaption></figure>`).join('')}</div>`).join('');
      $('#galbody').querySelectorAll('figure').forEach(f => f.onclick = () => { $('#lb img').src = f.dataset.src; $('#lb').classList.add('show'); });
      $('#gal').classList.add('show'); }; } }
function renderRoomsList() {
  const t = S.tenant, el = $('#rooms'); if (!t || !el) return;
  el.innerHTML = t.tourRooms.map((r, i) => `<button data-i="${i}" class="${r === S.room ? 'on' : ''}">${r.label}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => goRoom(t.tourRooms[+b.dataset.i]));
}
function setInside(on) { document.body.classList.toggle('inside', on); if (!on) { closeOptions(); document.body.classList.remove('walk'); } updateDock(); }
function updateDock() {
  const inside = !!S.tenant && ['view', 'walk', 'tour'].includes(S.mode);
  $('#b-enter').hidden = !inside; $('#b-enter').textContent = S.mode === 'walk' ? 'Stop walking' : 'Enter'; $('#b-enter').classList.toggle('go', S.mode !== 'walk');
  for (const id of ['#b-prev', '#b-next', '#b-tour', '#b-opts']) $(id).hidden = !inside;
  $('#b-tour').classList.toggle('on', S.mode === 'tour'); $('#b-tour').textContent = S.mode === 'tour' ? 'Stop tour' : 'Tour';
  $('#b-lock').hidden = !(S.mode === 'walk' && !TOUCH);
  $('#b-back').textContent = S.mode === 'orbit' ? 'Building' : 'All floors';
  if (S.mode === 'orbit' || S.mode === 'section') { /* nothing else */ }
}
$('#b-back').onclick = () => toBuildingView();
$('#b-enter').onclick = () => { if (S.mode === 'walk') exitWalk(); else enterWalk(); };
$('#b-next').onclick = () => step(1); $('#b-prev').onclick = () => step(-1);
$('#b-tour').onclick = () => { if (S.mode === 'tour') stopTour(); else startTour(); };
$('#b-opts').onclick = () => { if ($('#opts').classList.contains('show')) closeOptions(); else openOptions(S.room); };
$('#b-lock').onclick = () => { canvas.requestPointerLock && canvas.requestPointerLock(); };
$('#lb button').onclick = () => $('#lb').classList.remove('show');
let hintT = 0; function hint(s) { const h = $('#hint'); h.textContent = s; h.classList.add('show'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('show'), 5000); }

const tagsEl = $('#tags'); let tags = [];
function clearTags() { tagsEl.innerHTML = ''; tags = []; }
function sectionTags(f) {
  clearTags();
  for (const id of f.tenants || []) { const t = T[id]; if (!t || !t.rooms) continue; const m = MAN[id];
    const r = t.tourRooms[0]; if (!r) continue; const p = r.views[0].position;      // the tag stands at the tenant's reception
    addTag(() => W(t, p[0], p[1], 2.2), `${m.name}<small>${seatsTxt(m)} · enter at reception</small>`, () => land(t)); }
  if (!(f.tenants || []).length) addTag(() => V(CX, ZL(f.level) + 1.5, -CY), `${f.name}<small>${f.status === 'lobby' ? f.note : f.status === 'other' ? 'Not part of this offer' : (f.pending || []).length ? '3D model in preparation' : 'Available'}</small>`, null, true);
}
function addTag(pos, html, onclick, grey) { if (!html) return; const d = document.createElement('div'); d.className = 'tag' + (grey ? ' grey' : ''); d.innerHTML = html; if (onclick) d.onclick = onclick; tagsEl.appendChild(d); tags.push({ d, pos }); }
const pv = new THREE.Vector3();
function placeTags() { for (const g of tags) { const p = g.pos(); if (!p) continue; pv.copy(p).project(camera); const vis = pv.z < 1; g.d.style.display = vis ? '' : 'none'; g.d.style.left = (pv.x * .5 + .5) * innerWidth + 'px'; g.d.style.top = (-pv.y * .5 + .5) * innerHeight + 'px'; } }

// ------------------------------------------------------------------ the room card never covers the subject: shift the frame
function frameShift() {
  const W0 = innerWidth, H0 = innerHeight; const inside = document.body.classList.contains('inside');
  if (!inside) { if (PHONE()) { const oy = Math.round(H0 * .2); camera.setViewOffset(W0, H0 + 2 * oy, 0, 2 * oy, W0, H0); } else camera.clearViewOffset(); return; }
  if (PHONE()) { const oy = S.mode === 'walk' ? 0 : 60; camera.setViewOffset(W0, H0 + 2 * oy, 0, 2 * oy, W0, H0); }
  else { const ox = 150; camera.setViewOffset(W0 + 2 * ox, H0, 2 * ox, 0, W0, H0); }
}

// ------------------------------------------------------------------ presenter remote (Volt's present.js, ported)
const presenter = createPresenter({ run: (c, a) => runCommand(c, a), hello: () => helloPayload(), state: () => ({ stage: S.mode === 'orbit' ? 'building' : 'floor', mode: S.mode === 'walk' ? 'walk' : S.mode === 'tour' ? 'tour' : 'orbit', room: S.room ? S.room.name : null, tod: .5, lb: false, seats: false, walls: true, elev: null,
  pose: S.tenant && walk.on ? { x: Math.round(walk.x * 10) / 10, y: Math.round(walk.y * 10) / 10, yaw: Math.round(walk.A * 20) / 20 } : null }) });
await presenter.gateIfNeeded();
function helloPayload() {
  const t = S.tenant || Object.values(T)[0]; const L = t && t.L;
  return { title: 'Reliable Tech Park' + (t ? ' · ' + t.man.name : ''), seats: { work: t ? t.man.seats.work : 0, all: t ? t.man.seats.all : 0 },
    rooms: t ? t.tourRooms.map(r => ({ name: r.name, n: r.seats, g: 'W', box: r.box, img: 0 })) : [], places: [],
    bp: t && t.bpBounds ? { img: new URL(t.man.blueprint.img, location.href).href, bounds: t.bpBounds } : { img: t ? new URL(t.man.seat_plan, location.href).href : '', bounds: L ? L.bounds : [0, 0, 1, 1] }, facades: [] };
}
const CMD = {
  building: () => toBuildingView(), reset: () => toBuildingView(),
  floor: (a) => chooseFloor(a.level ?? (S.tenant ? S.tenant.man.floor : 1)),
  enter: () => (S.tenant ? enterWalk() : chooseTenant(Object.keys(MAN)[0])),
  room: (a) => { const r = S.tenant && S.tenant.tourRooms.find(x => x.name === a.name); if (r) goRoom(r); },
  next: () => step(1), prev: () => step(-1), walk: () => enterWalk(),
  tour: (a) => { if (a.on === false) stopTour(); else startTour(); },
  move: (a) => { walk.joy = [Math.max(-1, Math.min(1, +a.s || 0)), Math.max(-1, Math.min(1, +a.f || 0))]; },
  look: (a) => { if (walk.on) { walk.A -= +a.dx || 0; walk.pitch = THREE.MathUtils.clamp(walk.pitch - (+a.dy || 0), -1.1, .9); } else if (S.mode === 'orbit') { orbit.az -= +a.dx || 0; orbit.auto = false; } },
  zoom: (a) => { if (S.mode === 'orbit' || S.mode === 'section') orbit.dist = THREE.MathUtils.clamp(orbit.dist * (1 + (+a.d || 0) * .35), SPAN * .7, SPAN * 4); },
  goto: (a) => { const t = S.tenant; if (!t) return; const r = t.roomAt(+a.x, +a.y); const tr = r && t.tourRooms.find(q => q.name === r.name); if (tr) goRoom(tr); },
};
function runCommand(c, a) { const f = CMD[c]; if (f) return f(a || {}); }
$('#b-present').onclick = () => presenter.toggle();

// ------------------------------------------------------------------ the floor plan: where you are, where you're heading
const MM = createMinimap({ root: $('#mm'), onPickRoom: (r) => goRoom(r), onPickView: (r, i) => (S.room === r ? goView(i) : goRoom(r)) });
const viewMark = (v) => v ? { x: v.position[0], y: v.position[1], a: Math.atan2((v.target || v.level_target)[1] - v.position[1], (v.target || v.level_target)[0] - v.position[0]) } : null;
const toFrame = (from, to, [x, y]) => {               // a point in one tenant's plan to another's (through the building frame)
  const a = frameOf(from), ca = Math.cos(a.th), sa = Math.sin(a.th), bx = ca * x - sa * y + a.dx, by = sa * x + ca * y + a.dy;
  return toTenantFrame(to, [bx, by]); };
function drawPlan() {
  const t = S.tenant, on = !!t && ['view', 'walk', 'tour'].includes(S.mode) && !!t.tourRooms;
  if (!on) { MM.draw({ visible: false }); return; }
  const others = Object.values(T).filter(o => o !== t && o.man.floor === t.man.floor && o.region).map(o => ({ name: o.man.name, ring: o.region[0].map(p => toFrame(o.man, t.man, p)) }));
  const fl = B.floors.find(f => f.level === t.man.floor), later = fl && fl.later && fl.later.length ? fl.later.map(l => `${l.name} (later)`).join(', ') : null;
  MM.setTenant(t, others, later);
  const [x, y] = walk.on ? [walk.x, walk.y] : toPlan(t, camera.position), a = walk.on ? walk.A : headOf(t, camera.rotation.y);
  const here = t.roomAt(x, y), room = here ? (t.tourRooms.find(q => q.name === here.name) || here) : null;
  const moving = S.routing && S.goal, g = S.goal;
  // what Next › does from here
  let next = null, nextTxt = '';
  if (S.room && S.view >= 0 && S.view + 1 < S.room.views.length) { next = S.room.views[S.view + 1]; nextTxt = `Next: ${KINDS[next.kind] || next.kind} view`; }
  else if (S.room) { const ri = t.tourRooms.indexOf(S.room), nr = t.tourRooms[(ri + 1) % t.tourRooms.length]; if (nr) { next = nr.views[0]; nextTxt = `Next: ${nr.label}`; } }
  MM.draw({ visible: true, pose: { x, y, a }, room, dest: moving ? g.room : (next && t.tourRooms.find(q => q.views.includes(next))) || null,
    route: (moving || S.mode === 'tour') ? S.lastPath : null, target: moving ? viewMark(g.view) : null, next: moving ? null : viewMark(next),
    headingText: moving ? `Heading to ${g.room.label} · ${KINDS[g.view.kind] || g.view.kind}` : nextTxt });
}

// ------------------------------------------------------------------ frame loop
const clock = new THREE.Clock(); const fpsEl = $('#fps'); const showFps = Q.has('fps'); if (showFps) fpsEl.style.display = 'block';
const FPS = { frames: 0, t0: performance.now(), value: 0, samples: [] };
let lastFrame = 0, rafId = 0;
function frame() {
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(frame); lastFrame = performance.now();
  const dt = Math.min(.05, clock.getDelta()), now = performance.now();
  if (anim) { const k = Math.min(1, (now - anim.t0) / anim.dur); anim.fn(k); if (k >= 1) { const a = anim; anim = null; a.res(true); } }
  else if (S.mode === 'orbit' || (S.mode === 'section' && !anim)) {
    if (S.mode === 'orbit' && !REDUCED && (orbit.auto || now - orbit.idleAt > 6000)) orbit.az += dt * .045;   // the slow three-quarter orbit
    setPose(orbitPose(orbit));
  }
  if (walk.on) tickWalk(dt);
  tickLevels(dt); tickWalls(dt);
  frameShift(); placeTags(); drawPlan();
  if (shadowsDirty && renderer.shadowMap.enabled) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
  renderer.render(scene, camera);
  FPS.frames++; if (now - FPS.t0 > 500) { FPS.value = FPS.frames * 1000 / (now - FPS.t0); FPS.samples.push(FPS.value); if (FPS.samples.length > 120) FPS.samples.shift(); FPS.frames = 0; FPS.t0 = now; if (showFps) fpsEl.textContent = FPS.value.toFixed(0) + ' fps · ' + renderer.info.render.calls + ' calls'; }
}
addEventListener('resize', () => { if (!innerWidth || !innerHeight) return; renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
applyTod(TOD.h); setPose(orbitPose(orbit)); frame(); updateDock(); setBand(-1);
if (TW && !Q.has('nocity')) setTimeout(() => {
  TW.context().then(() => { scene.remove(ground); applyTod(TOD.h, true); shadowsDirty = true; }).catch(e => console.warn('[rtp] context', e && e.message));
}, 300);
// some embedded panes stop rAF while the page still reports "visible": keep glides finishing with a timer fallback
setInterval(() => { if (document.visibilityState === 'visible' && performance.now() - lastFrame > 250) frame(); }, 50);
presenter.ready(); if (Q.has('present') && !presenter.on) presenter.toggle();

// deep links: #tenant=paytm lands straight on that tenant's reception (after the glide)
const h = new URLSearchParams(location.hash.slice(1)); if (h.get('tenant') && MAN[h.get('tenant')]) setTimeout(() => chooseTenant(h.get('tenant')), 600);

// test hooks for automated checks (read-only state + the same commands the buttons use)
// snap(): render now and show the frame as an image under the UI (some embedded panes stop compositing WebGL while
// hidden); with a name it is also saved to _review/ by tools/serve_nocache.py
async function snap(name) {
  frameShift(); renderer.render(scene, camera); const u = canvas.toDataURL('image/jpeg', .9);
  let im = document.getElementById('snapimg'); if (!im) { im = document.createElement('img'); im.id = 'snapimg'; im.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none'; document.body.appendChild(im); }
  im.src = u; if (name) await fetch('/__review?name=' + encodeURIComponent(name), { method: 'POST', body: u }).catch(() => {});
  return u.length;
}
const unsnap = () => { const im = document.getElementById('snapimg'); if (im) im.remove(); };
window.__twin = { MM, openGallery, showTenantPanel, snap, unsnap, S, T, MAN, FPS, walk, orbit, chooseTenant, chooseFloor, toBuildingView, goView, goRoom, step, enterWalk, exitWalk, startTour, stopTour, openOptions, renderer, camera, scene,
  get busy() { return !!anim; }, toPlan: (id) => toPlan(T[id], camera.position) };
