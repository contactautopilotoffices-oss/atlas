// Volt, first floor, Skymark F-1. The floor plate is built in the browser from
// volt-floor1.layout.json, which noida-skymark/volt/cad/layout.py reads out of the
// client's DWG: every wall, glass line, column, desk, table, chair and plant sits where
// the drawing puts it. Heights and finishes come from standard fit-out sizes and the
// design deck's mood board (colours sampled from page 3).
import * as THREE from 'three';
import CameraControls from '/engine/vendor/camera-controls/camera-controls.module.min.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createPresenter } from './present.js';

CameraControls.install({ THREE });
const $ = (s) => document.querySelector(s);
const MOBILE = matchMedia('(max-width:760px)').matches || matchMedia('(pointer:coarse)').matches;
const LITE = /[?&]lite\b/.test(location.search);
// Presenter remote: a phone drives this page through runCommand() below. On a display with no keyboard
// (opened with ?present) the page waits here until a phone signs in.
const presenter = createPresenter({ run: (t, a) => runCommand(t, a), hello: () => helloPayload(), state: () => remoteState() });
await presenter.gateIfNeeded();
const ST = (v) => LITE ? .02 : v;                       // camera easing time; near-instant in the light test mode      // light mode for automated checks: no city, small shadows, no AO

// Deck palette (page 3 of the Volt presentation, sampled)
const PAL = { orange: 0xdd8d36, teal: 0x286e7a, charcoal: 0x474747, warmGray: 0xa69687, beige: 0xd4c2ae, lightWood: 0xd5a97f,
  acoustic: 0x3d6a8b, fabricBeige: 0xbca998, wood: 0xc28f5e, planter: 0x3f3f3f, frosted: 0xc1c2c5, carpet: 0x7a7067 };
const GROUP_COL = { W: 0xd6452b, M: 0x2b62d6, C: 0x1f9a55, L: 0xd68a1f, O: 0x8a8a8a };
const DECK = { 'Open workstations': [4, 5, 6, 7], 'Sales office': [8, 9], 'Director cabin 01': [10, 11], 'Director cabin 02': [12],
  'Lounge area (north)': [13], '18 seater conference room': [14, 15], 'Control room / command centre': [16, 17],
  'Collab area 01': [18], 'Collab area 02': [19], 'Phone booths PH-05 to 07': [20], 'Cafeteria': [21, 22] };
const RD = '/media/noida-skymark/volt/renders/';
const OURS = { '18 seater conference room': [RD + '18-seater-conference-room.jpg', RD + 'conf18.jpg'], 'Open workstations': [RD + 'open-workstations.jpg'], 'Cafeteria': [RD + 'cafeteria.jpg'] };   // Blender Cycles base, finished with Higgsfield
try { const rj = await (await fetch(RD + 'renders.json', { cache: 'no-cache' })).json(); const m = rj.rooms || rj; for (const [k, v] of Object.entries(m)) if (Array.isArray(v) && v.length) OURS[k] = v.map(f => f.startsWith('/') ? f : RD + f); } catch (e) { /* no list yet: the static one above stands */ }
Object.values(OURS).flat().forEach(u => { const i = new Image(); i.src = u; });                // warm the cache so cards never flash empty
const TOUR = ['Reception', 'Open workstations', 'Control room / command centre', 'Sales office', 'Calling room', 'Cafeteria',
  '18 seater conference room', 'Finance room', 'Lounge area (north)', 'Director cabin 01', 'Collab area 01'];

const L = await (await fetch('./volt-floor1.layout.json')).json();
const H = L.heights.ceiling, CUT = 1.15;
const [bx0, by0, bx1, by1] = L.bounds; const CX = (bx0 + bx1) / 2, CY = (by0 + by1) / 2;
const W = (x, y, h = 0) => new THREE.Vector3(x - CX, h, -(y - CY));        // plan (x east, y north) to world
const toPlan = (v) => [v.x + CX, -v.z + CY];
const v3 = new THREE.Vector3();

// ---------------------------------------------------------------- renderer
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(devicePixelRatio, MOBILE ? 1.75 : 2);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe7e3dc);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.62;
const camera = new THREE.PerspectiveCamera(MOBILE ? 50 : 38, innerWidth / innerHeight, 0.08, 3000);
const BASE_FOV = camera.fov;
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

const hemi = new THREE.HemisphereLight(0xfffaf2, 0xb9a88f, 0.55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1de, 2.2);
sun.position.set(-18, 34, -22); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
sun.castShadow = true; { const sm = LITE ? 1024 : MOBILE ? 2048 : 4096; sun.shadow.mapSize.set(sm, sm); }
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;

// ---------------------------------------------------------------- textures (drawn, no downloads)
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const carpetTex = canvasTex(512, (g, n) => {      // dark graphic carpet tile, like the deck's
  g.fillStyle = '#4b4845'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) { const y = rnd() * n, x = rnd() * n, w = 8 + rnd() * 60, v = rnd();
    g.fillStyle = v < .45 ? 'rgba(120,114,106,.35)' : v < .8 ? 'rgba(30,28,26,.35)' : 'rgba(150,142,130,.25)'; g.fillRect(x, y, w, 2 + rnd() * 2); }
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(0, 0, n, n);
}, 1 / 1.0);
const woodTex = canvasTex(512, (g, n) => {
  for (let i = 0; i < 8; i++) { const l = 62 + rnd() * 10; g.fillStyle = `hsl(30,45%,${l}%)`; g.fillRect(0, i * n / 8, n, n / 8);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(110,70,35,${.04 + rnd() * .06})`; g.fillRect(0, i * n / 8 + rnd() * n / 8, n, 1); }
    g.fillStyle = 'rgba(80,50,25,.25)'; g.fillRect(0, i * n / 8, n, 1.5); g.fillRect((rnd() * n) | 0, i * n / 8, 1.5, n / 8); }
}, 1 / 1.6);
const stoneTex = canvasTex(512, (g, n) => {
  g.fillStyle = '#d9d4cb'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '90,80,70'},${rnd() * .06})`; g.fillRect(rnd() * n, rnd() * n, 2, 2); }
  g.strokeStyle = 'rgba(120,110,100,.35)'; g.lineWidth = 1.5; g.strokeRect(0, 0, n, n);
}, 1 / 1.2);
const leafTex = canvasTex(256, (g, n) => {      // one sprig of broad leaves, alpha cut
  g.clearRect(0, 0, n, n);
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.32, len = n * (.36 + rnd() * .1);
    g.save(); g.translate(n / 2, n * .95); g.rotate(a + Math.PI / 2);
    const grd = g.createLinearGradient(0, 0, 0, -len); grd.addColorStop(0, '#2f5a22'); grd.addColorStop(1, i % 2 ? '#5d9a3b' : '#4c8a33');
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, -n * .12); g.quadraticCurveTo(len * .32, -n * .12 - len * .5, 0, -n * .12 - len);
    g.quadraticCurveTo(-len * .32, -n * .12 - len * .5, 0, -n * .12); g.fill();
    g.strokeStyle = 'rgba(220,240,200,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -n * .12); g.lineTo(0, -n * .12 - len * .95); g.stroke();
    g.strokeStyle = '#3d6b2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -n * .12); g.stroke(); g.restore(); }
});
leafTex.wrapS = leafTex.wrapT = THREE.ClampToEdgeWrapping; leafTex.repeat.set(1, 1);

// ---------------------------------------------------------------- materials
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, metalness: 0, ...o });
const mat = {
  carpet: M(0xffffff, { map: carpetTex, roughness: .95 }), wood: M(0xffffff, { map: woodTex, roughness: .55 }),
  stone: M(0xffffff, { map: stoneTex, roughness: .35 }), tile: M(0xf0eeea, { roughness: .3 }), vinyl: M(0xb9b5ae, { roughness: .6 }),
  wall: M(0xf2efea, { roughness: .9 }), wallCap: M(0x3a3836, { roughness: .8 }), slab: M(0x2c2b29, { roughness: .9 }),
  column: M(0xeeebe5, { roughness: .85 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xd8e9ee, roughness: .04, metalness: 0, transparent: true, opacity: .2, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }),
  frost: M(0xf6f6f4, { transparent: true, opacity: .72, roughness: .5, depthWrite: false, side: THREE.DoubleSide }),
  mullion: M(0x2d2d2d, { roughness: .5, metalness: .4 }),
  deskTop: M(0xffffff, { map: woodTex, roughness: .45 }), deskFrame: M(0xf3f2ef, { roughness: .5, metalness: .1 }),
  screenO: M(PAL.orange, { roughness: .85 }), screenW: M(0xf4f3ef, { roughness: .85 }),
  monitor: M(0x1a1a1c, { roughness: .25, metalness: .3 }), monitorBack: M(0xd8d8d8, { roughness: .3, metalness: .6 }),
  chair: M(0x1d1d1f, { roughness: .92 }), chairBase: M(0x2a2a2c, { roughness: .35, metalness: .7 }),
  cafeShell: M(PAL.orange, { roughness: .55 }), legWood: M(PAL.wood, { roughness: .5 }),
  sofa: M(PAL.warmGray, { roughness: .95 }), sofaTeal: M(PAL.teal, { roughness: .95 }), sofaOrange: M(PAL.orange, { roughness: .95 }),
  table: M(0xffffff, { map: woodTex, roughness: .45 }), tableWhite: M(0xf3f1ec, { roughness: .4 }), tableLeg: M(0x2e2e30, { roughness: .4, metalness: .6 }),
  planterBody: M(0xf3f2ef, { roughness: .6 }), planterWood: M(0xffffff, { map: woodTex, roughness: .5 }), planterTop: M(PAL.planter, { roughness: .7 }),
  pot: M(0x3a3a3a, { roughness: .6 }),
  leaf: new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: .5, side: THREE.DoubleSide, roughness: .6 }),
  ceiling: M(0xf3f1ed, { roughness: .95 }), panel: new THREE.MeshBasicMaterial({ color: 0xfffdf7 }),
  void: M(0xffffff, { map: stoneTex, roughness: .4 }), rail: M(0x2c2c2e, { roughness: .4, metalness: .6 }),
  hl: new THREE.MeshBasicMaterial({ color: 0xdd8d36, transparent: true, opacity: 0, depthWrite: false }),
};
woodTex.repeat.set(1 / 1.6, 1 / 1.6);

// ---------------------------------------------------------------- helpers
const root = new THREE.Group(); scene.add(root);
const wallsG = new THREE.Group(); root.add(wallsG);           // scaled for the cut-away
const shapeFrom = (outer, holes = []) => {
  const s = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x - CX, y - CY)));
  holes.forEach(h => s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x - CX, y - CY)))));
  return s;
};
function extrudeUp(shape, depth, y0 = 0) {      // shape in plan, extruded upwards in world
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g;
}
function flatPlan(shape, y) { const g = new THREE.ShapeGeometry(shape, 12); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; }
const add = (g, m, o = {}) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = o.cast ?? true; mesh.receiveShadow = o.recv ?? true; (o.parent || root).add(mesh); return mesh; };
const RB = (w, h, d, r = .02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001));
const at = (g, x, y, z, ry = 0, rz = 0) => { g = g.clone(); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
function instanced(geo, material, mats) {
  const m = new THREE.InstancedMesh(geo, material, mats.length);
  mats.forEach((x, i) => m.setMatrixAt(i, x)); m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere(); root.add(m); return m;
}
const place = (x, y, a, h = 0, s = 1) => new THREE.Matrix4().compose(W(x, y, h), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(s, s, s));
const placeS = (x, y, a, sx, sy, sz, h = 0) => new THREE.Matrix4().compose(W(x, y, h), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(sx, sy, sz));

// ---------------------------------------------------------------- floor, rooms, atrium
const floorShape = L.floor.map(f => shapeFrom(f.outer, f.holes));
const floorMeshes = [];
floorShape.forEach(s => {
  const slab = add(extrudeUp(s, .32, -.32), [mat.carpet, mat.slab], { cast: false });
  slab.geometry.groups.forEach(gr => { if (gr.materialIndex === 0) gr.materialIndex = 0; });
  floorMeshes.push(slab);
});
// floor finish overlays per room (wood, stone, tile) clipped to the room box
const roomMeshes = [];
for (const r of L.rooms) {
  const [x0, y0, x1, y1] = r.box;
  const s = shapeFrom([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  if (r.floor !== 'carpet') add(flatPlan(s, .004), mat[r.floor], { cast: false });
  const hl = new THREE.Mesh(flatPlan(s, .012), mat.hl.clone()); hl.renderOrder = 2; hl.userData.room = r.name; root.add(hl); roomMeshes.push(hl);
}
if (L.atrium) {
  const a = L.atrium; const xs = a.map(p => p[0]), ys = a.map(p => p[1]);
  const [ax0, ax1, ay0, ay1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const v = add(flatPlan(shapeFrom([[ax0, ay0], [ax1, ay0], [ax1, ay1], [ax0, ay1]]), -4.6), mat.void, { cast: false });
  const edges = [[ax0, ay0, ax1, ay0], [ax1, ay0, ax1, ay1], [ax1, ay1, ax0, ay1], [ax0, ay1, ax0, ay0]];
  for (const [x0, y0, x1, y1] of edges) {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    const m1 = add(at(new THREE.BoxGeometry(len, 1.05, .02), 0, .525, 0), mat.glass, { cast: false });
    m1.applyMatrix4(place((x0 + x1) / 2, (y0 + y1) / 2, ang));
    const m2 = add(at(new THREE.BoxGeometry(len, .05, .06), 0, 1.075, 0), mat.rail);
    m2.applyMatrix4(place((x0 + x1) / 2, (y0 + y1) / 2, ang));
    const m3 = add(at(new THREE.BoxGeometry(len, 4.6, .3), 0, -2.3, 0), mat.column, { cast: false });
    m3.applyMatrix4(place((x0 + x1) / 2 + Math.sin(ang) * .15, (y0 + y1) / 2 - Math.cos(ang) * .15, ang));
  }
}

// ---------------------------------------------------------------- walls, glass, columns
for (const w of L.walls) add(extrudeUp(shapeFrom(w.outer, w.holes), H), [mat.wallCap, mat.wall], { parent: wallsG });
for (const c of L.columns) add(extrudeUp(shapeFrom(c), H), [mat.wallCap, mat.column], { parent: wallsG });
{
  const gl = [], fr = [], mu = [];
  for (const [x0, y0, x1, y1, layer] of L.glass) {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0), facade = layer === 'AR-WINDOW';
    const M4 = place((x0 + x1) / 2, (y0 + y1) / 2, ang);
    gl.push(at(new THREE.BoxGeometry(len, H, .012), 0, H / 2, 0).applyMatrix4(M4));
    if (!facade) fr.push(at(new THREE.BoxGeometry(len, .55, .016), 0, 1.25, 0).applyMatrix4(M4));
    mu.push(at(new THREE.BoxGeometry(len, .05, .05), 0, .025, 0).applyMatrix4(M4));
    const n = Math.max(1, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) mu.push(at(new THREE.BoxGeometry(.04, H, .05), -len / 2 + len * i / n, H / 2, 0).applyMatrix4(M4));
  }
  const g = add(mergeGeometries(gl), mat.glass, { cast: false, parent: wallsG }); g.renderOrder = 5;
  if (fr.length) { const f = add(mergeGeometries(fr), mat.frost, { cast: false, parent: wallsG }); f.renderOrder = 6; }
  add(mergeGeometries(mu), mat.mullion, { parent: wallsG });
}

// ---------------------------------------------------------------- furniture models (local +X = the way a sitter faces)
function taskChair() {
  const fab = mergeGeometries([at(RB(.48, .08, .48, .03), 0, .47, 0), at(RB(.06, .55, .46, .025), -.24, .8, 0, 0, .14),
    at(RB(.28, .04, .05, .02), -.02, .66, .24), at(RB(.28, .04, .05, .02), -.02, .66, -.24)]);
  const parts = [at(new THREE.CylinderGeometry(.025, .03, .34, 10), 0, .26, 0)];
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; parts.push(at(new THREE.BoxGeometry(.3, .03, .04), Math.cos(a) * .15, .07, Math.sin(a) * .15, -a));
    parts.push(at(new THREE.SphereGeometry(.028, 8, 6), Math.cos(a) * .29, .03, Math.sin(a) * .29)); }
  parts.push(at(new THREE.BoxGeometry(.03, .2, .03), -.02, .58, .24), at(new THREE.BoxGeometry(.03, .2, .03), -.02, .58, -.24));
  return [fab, mergeGeometries(parts)];
}
function cafeChair() {
  const shell = mergeGeometries([at(RB(.44, .05, .44, .02), 0, .45, 0), at(RB(.05, .36, .42, .02), -.21, .66, 0, 0, .12)]);
  const legs = []; for (const [x, z] of [[.18, .18], [.18, -.18], [-.18, .18], [-.18, -.18]]) legs.push(at(new THREE.CylinderGeometry(.015, .012, .45, 8), x, .225, z));
  return [shell, mergeGeometries(legs)];
}
function stool() {
  const seat = at(new THREE.CylinderGeometry(.19, .19, .05, 20), 0, .66, 0);
  const legs = []; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .78; legs.push(at(new THREE.CylinderGeometry(.013, .013, .66, 6), Math.cos(a) * .14, .33, Math.sin(a) * .14)); }
  legs.push(at(new THREE.TorusGeometry(.15, .008, 6, 20), 0, .25, 0).rotateX(0));
  return [seat, mergeGeometries(legs)];
}
function armchair(s = .78) {
  return [mergeGeometries([at(RB(s, .22, s, .06), 0, .27, 0), at(RB(.16, .42, s, .06), -s / 2 + .08, .5, 0), at(RB(s - .1, .2, .14, .05), .03, .45, s / 2 - .07),
    at(RB(s - .1, .2, .14, .05), .03, .45, -s / 2 + .07), at(RB(s - .2, .1, s - .3, .04), .06, .43, 0)]),
    mergeGeometries([0, 1, 2, 3].map(i => at(new THREE.CylinderGeometry(.02, .02, .16, 6), (i & 1 ? 1 : -1) * (s / 2 - .08), .08, (i & 2 ? 1 : -1) * (s / 2 - .08))))];
}
function tubChair() {
  return [mergeGeometries([at(new THREE.CylinderGeometry(.34, .3, .42, 24), 0, .21, 0), at(new THREE.CylinderGeometry(.36, .36, .26, 24, 1, true, Math.PI * .6, Math.PI * .8), 0, .55, 0)]), null];
}

// seats --------------------------------------------------------------
const seatBuckets = new Map();
const bucket = (k, maker, mats) => { if (!seatBuckets.has(k)) seatBuckets.set(k, { maker, mats, list: [] }); return seatBuckets.get(k).list; };
const sofaList = [];
for (const s of L.seats) {
  const a = s.face, k = s.kind;
  if (k === 'task chair' || k === 'meeting chair' || k === 'staff chair' || k === 'director chair') bucket('task', taskChair, [mat.chair, mat.chairBase]).push(place(s.x, s.y, a));
  else if (k === 'cafe chair') bucket('cafe', cafeChair, [mat.cafeShell, mat.legWood]).push(place(s.x, s.y, a));
  else if (k === 'cafe stool') bucket('stool', stool, [mat.cafeShell, mat.tableLeg]).push(place(s.x, s.y, a));
  else if (k === 'lounge armchair' || k === 'visitor chair') bucket(k === 'visitor chair' ? 'armT' : 'armO', armchair, [k === 'visitor chair' ? mat.sofaTeal : mat.sofaOrange, mat.tableLeg]).push(place(s.x, s.y, a));
  else if (k === 'lounge tub chair' || k === 'lounge chair') bucket('tub', tubChair, [mat.sofaTeal]).push(place(s.x, s.y, a));
  else if (k.includes('sofa')) sofaList.push(s);
}
const bucketMeshes = {};
for (const [key, { maker, mats, list }] of seatBuckets) { const geos = maker(); bucketMeshes[key] = geos.map((g, i) => g && instanced(g, mats[i], list)).filter(Boolean); }
for (const s of sofaList) {     // sofas are sized to the block in the drawing
  const len = Math.max(1.3, s.len), dep = Math.min(.95, Math.max(.75, s.dep));
  const g = mergeGeometries([at(RB(dep, .24, len, .07), 0, .28, 0), at(RB(.2, .44, len, .07), -dep / 2 + .1, .52, 0),
    at(RB(dep, .3, .18, .07), 0, .45, len / 2 - .09), at(RB(dep, .3, .18, .07), 0, .45, -len / 2 + .09),
    ...Array.from({ length: s.ids.length }, (_, i) => at(RB(dep - .26, .12, (len - .4) / s.ids.length - .02, .05), .08, .45, -len / 2 + .2 + (i + .5) * (len - .4) / s.ids.length))]);
  const m = add(g, s.ids.length > 2 ? mat.sofa : mat.sofaTeal); m.applyMatrix4(place(s.x, s.y, s.face));
}

// desks: top, end frames, a screen and a monitor on the side away from the chair -----------
{
  const tops = [], frames = [], scrO = [], scrW = [], mons = [], monB = [];
  const seats = L.seats.filter(s => s.kind === 'task chair');
  L.desks.forEach((d, i) => {
    const [cx, cy] = d.c, a = d.a, w = d.w, dp = d.d;
    tops.push(placeS(cx, cy, a, w, 1, dp, d.h - .03));
    for (const e of [-1, 1]) frames.push(placeS(cx + Math.cos(a) * e * (w / 2 - .03), cy + Math.sin(a) * e * (w / 2 - .03), a, .04, d.h - .03, dp * .86));
    const nx = -Math.sin(a), ny = Math.cos(a);
    let best = null, bd = 1.3;
    for (const s of seats) { const dd = Math.hypot(s.x - cx, s.y - cy); if (dd < bd) { bd = dd; best = s; } }
    if (!best || !d.kind.includes('workstation')) return;
    const side = Math.sign((best.x - cx) * nx + (best.y - cy) * ny) || 1;
    const bxp = cx - side * nx * (dp / 2 - .01), byp = cy - side * ny * (dp / 2 - .01);
    (i % 2 ? scrW : scrO).push(placeS(bxp, byp, a, w - .06, .38, .025, d.h + .0));
    const fa = Math.atan2(side * ny, side * nx);
    const mx = cx - side * nx * (dp / 2 - .17), my = cy - side * ny * (dp / 2 - .17);
    mons.push(place(mx, my, fa, d.h)); monB.push(place(mx, my, fa, d.h));
  });
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, .5, 0);
  const topG = RB(1, .03, 1, .006, 1); topG.translate(0, .015, 0);
  instanced(topG, mat.deskTop, tops);
  instanced(box, mat.deskFrame, frames);
  instanced(box, mat.screenO, scrO); instanced(box, mat.screenW, scrW);
  const mon = mergeGeometries([at(RB(.03, .34, .56, .01), 0, .24, 0)]);
  const stand = mergeGeometries([at(new THREE.BoxGeometry(.03, .16, .06), -.02, .08, 0), at(new THREE.BoxGeometry(.16, .01, .2), -.03, .005, 0)]);
  instanced(mon, mat.monitor, mons); instanced(stand, mat.monitorBack, monB);
}

// tables --------------------------------------------------------------
for (const t of L.tables) {
  const top = t.h < .6 ? mat.tableWhite : mat.table;
  if (t.circle) {
    const [x, y, r] = t.circle;
    add(at(new THREE.CylinderGeometry(r, r, .035, 40), 0, t.h - .0175, 0), top).applyMatrix4(place(x, y, 0));
    add(mergeGeometries([at(new THREE.CylinderGeometry(.035, .035, t.h - .03, 10), 0, (t.h - .03) / 2, 0), at(new THREE.CylinderGeometry(r * .5, r * .55, .02, 24), 0, .01, 0)]), mat.tableLeg).applyMatrix4(place(x, y, 0));
    continue;
  }
  const s = shapeFrom(t.poly);
  add(extrudeUp(s, .04, t.h - .04), [top, top]);
  const xs = t.poly.map(p => p[0]), ys = t.poly.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys);
  const legs = [];
  if (Math.max(w, d) > 1.6) { const ax = w > d; for (const e of [-1, 1]) legs.push(at(new THREE.BoxGeometry(ax ? .06 : Math.min(w, .7) * .8, t.h - .04, ax ? Math.min(d, .9) * .7 : .06), 0, (t.h - .04) / 2, 0).translate(ax ? e * (w / 2 - .35) : 0, 0, ax ? 0 : -e * (d / 2 - .35))); }
  else legs.push(at(new THREE.CylinderGeometry(.04, .04, t.h - .04, 10), 0, (t.h - .04) / 2, 0));
  add(mergeGeometries(legs), mat.tableLeg).applyMatrix4(place(cx, cy, 0));
}

// planters and plants -----------------------------------------------
{
  const body = [], woodP = [], tray = [];
  for (const p of L.planters) {
    body.push(placeS(p.c[0], p.c[1], p.a, p.w, L.heights.planter, p.d));
    woodP.push(placeS(p.c[0], p.c[1], p.a, p.w * .5, L.heights.planter - .08, p.d + .012, .04));
    tray.push(placeS(p.c[0], p.c[1], p.a, p.w + .02, .07, p.d + .02, L.heights.planter));
  }
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, .5, 0);
  instanced(box, mat.planterBody, body); instanced(box, mat.planterWood, woodP); instanced(box, mat.planterTop, tray);
  const sprig = []; const n = 9;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + (i % 2) * .3, tilt = .35 + (i % 3) * .12;
    const q = new THREE.PlaneGeometry(.55, .55); q.translate(0, .27, 0); q.rotateX(-tilt); q.rotateY(a); sprig.push(q); }
  const plant = mergeGeometries(sprig);
  const leaves = [], pots = [];
  for (const p of L.plants) {
    const s = Math.max(.7, Math.min(1.6, p.r * 2.4));
    leaves.push(place(p.x, p.y, rnd() * 6, p.in_box ? L.heights.planter + .02 : .42, s));
    if (!p.in_box) pots.push(place(p.x, p.y, 0, 0, Math.max(.8, s * .8)));
  }
  instanced(plant, mat.leaf, leaves).castShadow = true;
  instanced(at(new THREE.CylinderGeometry(.17, .13, .44, 20), 0, .22, 0), mat.pot, pots);
}

// ceiling with light panels: one-sided, facing down, so it shows when walking and vanishes from above
const ceiling = new THREE.Group(); root.add(ceiling);
L.floor.forEach(f => {
  const s = new THREE.Shape(f.outer.map(([x, y]) => new THREE.Vector2(x - CX, -(y - CY))));
  const g = new THREE.ShapeGeometry(s); g.rotateX(Math.PI / 2); g.translate(0, H, 0);
  const m = new THREE.Mesh(g, mat.ceiling); m.receiveShadow = false; ceiling.add(m);
});
{
  const pg = new THREE.PlaneGeometry(.6, .6); pg.rotateX(Math.PI / 2); pg.translate(0, H - .005, 0);
  const dg = new THREE.CircleGeometry(.07, 16); dg.rotateX(Math.PI / 2); dg.translate(0, H - .005, 0);
  const P = L.lights.filter(l => l.kind === 'panel600'), D = L.lights.filter(l => l.kind === 'downlight');
  const pm = new THREE.InstancedMesh(pg, mat.panel, P.length); P.forEach((l, i) => pm.setMatrixAt(i, place(l.c[0], l.c[1], 0)));
  const dm = new THREE.InstancedMesh(dg, mat.panel, D.length); D.forEach((l, i) => dm.setMatrixAt(i, place(l.c[0], l.c[1], 0)));
  ceiling.add(pm, dm);
}
ceiling.visible = false;

// seat markers (discs over every chair, one colour per group) ------------------
const seatDots = (() => {
  const g = new THREE.CircleGeometry(.17, 20); g.rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, depthTest: false }), L.seats.length);
  L.seats.forEach((s, i) => { m.setMatrixAt(i, place(s.x, s.y, 0, 1.25)); m.setColorAt(i, new THREE.Color(GROUP_COL[s.group])); });
  m.renderOrder = 10; m.visible = false; root.add(m); return m;
})();

// ---------------------------------------------------------------- doors (leaves read from the CAD door blocks, drawn open as in the plan)
{
  const wood = [], glassD = [], fire = [];
  for (const d of L.doors) {
    const g = at(new THREE.BoxGeometry(d.w, 2.1, Math.max(.04, d.d)), 0, 1.05, 0).applyMatrix4(place(d.c[0], d.c[1], d.a));
    (d.glass ? glassD : d.fire ? fire : wood).push(g);
  }
  if (wood.length) add(mergeGeometries(wood), M(0xffffff, { map: woodTex, roughness: .5 }), { parent: wallsG });
  if (fire.length) add(mergeGeometries(fire), M(0x6b6f74, { roughness: .45, metalness: .3 }), { parent: wallsG });
  if (glassD.length) { const m = add(mergeGeometries(glassD), mat.glass, { cast: false, parent: wallsG }); m.renderOrder = 5; }
}

// ---------------------------------------------------------------- the building: the existing Skymark twin, with Volt's CAD floor fitted inside it
// noida-skymark/volt/cad/fit_twin.py fits the CAD's first-floor outline to the real footprint the twin stands on
// (Overture Maps, IoU about 0.89) and stores the turn and shift as L.site_fit.
const FTF = L.storeys.floor_to_floor, GROUND = -FTF, ROOF = 4 * FTF;
const SF = L.site_fit, D2R = Math.PI / 180, RHO = SF.rot_deg * D2R, PHI = SF.twin_phi_deg * D2R;
const enuToPlan = ([ex, ey]) => { const x = ex - SF.footprint_centroid[0] - SF.dx, y = ey - SF.footprint_centroid[1] - SF.dy, c = Math.cos(-RHO), s = Math.sin(-RHO);
  return [c * x - s * y + SF.plate_centroid[0], s * x + c * y + SF.plate_centroid[1]]; };
const bearingToPlan = (b) => { const e = [Math.sin(b * D2R), Math.cos(b * D2R)], c = Math.cos(-RHO), s = Math.sin(-RHO); return [c * e[0] - s * e[1], s * e[0] + c * e[1]]; };
const bldg = new THREE.Group(); scene.add(bldg);
const twinFrame = new THREE.Group(); bldg.add(twinFrame);
{ const o = enuToPlan(SF.twin_C); twinFrame.position.copy(W(o[0], o[1], GROUND)); twinFrame.rotation.y = PHI - RHO; }
const CUTY = -.06;                                     // the twin is opened just under Volt's floor
const cutLow = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUTY), cutHigh = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CUTY);
const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
// Everything the first view needs is fetched in parallel behind the loading screen and shown together.
const LOADS = [];
function track(label, pr) { LOADS.push(label); const el = $('#load b'); const done = () => { LOADS.splice(LOADS.indexOf(label), 1); el.textContent = LOADS.length ? `Loading ${LOADS[0]}…` : 'Ready'; };
  el.textContent = `Loading ${LOADS[0]}…`; return pr.then(v => { done(); return v; }, e => { done(); throw e; }); }
const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
const ctxP = LITE ? Promise.resolve(null) : track('the streets round it', gltf.loadAsync('/noida-skymark/exports/fm_skymark_context_500m.glb')).catch(e => { console.warn('[volt] context', e && e.message); return null; });
const chairP = track('the chairs', gltf.loadAsync('/media/noida-skymark/volt/models/chair.glb')).catch(() => null);
const loungeP = track('the lounge chairs', gltf.loadAsync('/media/noida-skymark/volt/models/lounge.glb')).catch(() => null);
const twinGLTF = await track('the Skymark twin', gltf.loadAsync('/noida-skymark/exports/fm_skymark_atlas.glb'));
const highMats = [];
function prepTwin(rootObj, plane, list) {
  rootObj.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    const ms = (Array.isArray(o.material) ? o.material : [o.material]).map(m => { const c = m.clone(); c.clippingPlanes = [plane];
      c.userData.o = c.opacity; c.userData.t = c.transparent; c.userData.dw = c.depthWrite; list && list.push(c); return c; });
    o.material = Array.isArray(o.material) ? ms : ms[0];
  });
}
const twinLow = twinGLTF.scene, twinHigh = twinGLTF.scene.clone(true);
prepTwin(twinLow, cutLow); prepTwin(twinHigh, cutHigh, highMats);
twinFrame.add(twinLow, twinHigh);
const twinInteriorsLow = twinLow.getObjectByName('Interiors');
// real furniture models (the mesh chair and lounge chair used for the Cycles render of the conference room) in place of the block ones
async function realModel(gP, height, keys, seatBand) {
  const g = await gP; if (!g) return; let mesh = null; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const src = mesh.geometry.attributes.position, P = new Float32Array(src.count * 3), q = new THREE.Vector3();
  for (let i = 0; i < src.count; i++) { q.fromBufferAttribute(src, i).applyMatrix4(mesh.matrixWorld); P[i * 3] = q.x; P[i * 3 + 1] = q.y; P[i * 3 + 2] = q.z; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  if (mesh.geometry.attributes.uv) geo.setAttribute('uv', mesh.geometry.attributes.uv); geo.setIndex(mesh.geometry.index);
  geo.computeBoundingBox(); const bb = geo.boundingBox, k = height / (bb.max.y - bb.min.y);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(k, k, k);
  // which way it faces: from the top of the backrest towards the seat
  let bx = 0, bz = 0, bn = 0, sx = 0, sz = 0, sn = 0; const A = geo.attributes.position;
  for (let i = 0; i < A.count; i++) { const y = A.getY(i) / height; if (y > .86) { bx += A.getX(i); bz += A.getZ(i); bn++; } if (y > seatBand[0] && y < seatBand[1]) { sx += A.getX(i); sz += A.getZ(i); sn++; } }
  geo.rotateY(Math.atan2(sz / sn - bz / bn, sx / sn - bx / bn)); geo.computeVertexNormals();
  const m = mesh.material; m.normalMap = null; m.envMapIntensity = .9;
  for (const key of keys) { const b = seatBuckets.get(key); if (!b) continue;
    const im = new THREE.InstancedMesh(geo, m, b.list.length); b.list.forEach((x, i) => im.setMatrixAt(i, x)); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
    root.add(im); (bucketMeshes[key] || []).forEach(o => root.remove(o)); }
  needRender = true; shadowsDirty = true;
}
const modelsP = Promise.all([realModel(chairP, 1.02, ['task'], [.40, .52]), realModel(loungeP, .82, ['armO', 'armT'], [.3, .5])]).catch(e => console.warn('[volt] furniture models', e && e.message));
// the 500 m round it, in the same frame (streets, blocks, trees): loaded after the first frame
for (const t of [twinLow, twinHigh]) { const pm = t.getObjectByName('SKY_Site_Palm_2'); if (pm) pm.visible = false; }   // this palm stood in front of the porch
const PIN0 = window.SKY_MODEL?.anchor || { lat: 28.5913167, lng: 77.3189671 }, KLAT = 110574, KLNG = 111320 * Math.cos(PIN0.lat * D2R);
const planToEnu = ([px, py]) => { const x = px - SF.plate_centroid[0], y = py - SF.plate_centroid[1], c = Math.cos(RHO), sn = Math.sin(RHO);
  return [c * x - sn * y + SF.footprint_centroid[0] + SF.dx, sn * x + c * y + SF.footprint_centroid[1] + SF.dy]; };
const llToPlan = (lat, lng) => enuToPlan([(lng - PIN0.lng) * KLNG, (lat - PIN0.lat) * KLAT]);
// Satellite photo draped on the ground and roofs of the city model, as on the atlas page (needs the site's map key)
async function satellite() {
  if (!window.MAPBOX_TOKEN) throw new Error('no map key');
  const Z = 17, RAD = 580, merc = (lng, lat) => { const n = 256 * 2 ** Z, sn = Math.sin(lat * D2R); return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI)) * n]; };
  const dl = RAD / KLAT, dg = RAD / KLNG, [x0, y0] = merc(PIN0.lng - dg, PIN0.lat + dl), [x1, y1] = merc(PIN0.lng + dg, PIN0.lat - dl);
  const tx0 = Math.floor(x0 / 256), ty0 = Math.floor(y0 / 256), nx = Math.floor(x1 / 256) - tx0 + 1, ny = Math.floor(y1 / 256) - ty0 + 1, T = 512;
  const cv = document.createElement('canvas'); cv.width = nx * T; cv.height = ny * T; const g = cv.getContext('2d'); g.fillStyle = '#8b8778'; g.fillRect(0, 0, cv.width, cv.height);
  let got = 0;
  await Promise.all([...Array(nx * ny).keys()].map(i => new Promise(ok => { const tx = tx0 + (i % nx), ty = ty0 + Math.floor(i / nx), im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { g.drawImage(im, (tx - tx0) * T, (ty - ty0) * T, T, T); got++; ok(); }; im.onerror = () => ok();
    im.src = `https://api.mapbox.com/v4/mapbox.satellite/${Z}/${tx}/${ty}@2x.jpg90?access_token=${encodeURIComponent(window.MAPBOX_TOKEN)}`; })));
  if (!got) throw new Error('no satellite tiles');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const uv = (x, z) => { const [e, n] = planToEnu([x + CX, -z + CY]), [px, py] = merc(PIN0.lng + e / KLNG, PIN0.lat + n / KLAT); return [(px - tx0 * 256) / (nx * 256), 1 - (py - ty0 * 256) / (ny * 256)]; };
  const o = uv(0, 0), ax = uv(1, 0), az = uv(0, 1);
  return { tex, o, ux: [ax[0] - o[0], ax[1] - o[1]], uz: [az[0] - o[0], az[1] - o[1]] };
}
function drape(rootObj, sat) {
  const U = { uSat: { value: sat.tex }, uSatO: { value: new THREE.Vector2(...sat.o) }, uSatX: { value: new THREE.Vector2(...sat.ux) }, uSatZ: { value: new THREE.Vector2(...sat.uz) } };
  const done = new Set();
  rootObj.traverse(o => { if (!o.isMesh) return;
    for (const m of [].concat(o.material)) { if (!m || done.has(m) || /trunk|leaf|frond|Sign|Glass|Aluminium/i.test(m.name || '')) continue; done.add(m);
      m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSatW; varying vec3 vSatN;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvSatW = (modelMatrix * vec4(transformed, 1.0)).xyz; vSatN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSatW; varying vec3 vSatN; uniform sampler2D uSat; uniform vec2 uSatO, uSatX, uSatZ;')
          .replace('#include <map_fragment>', `#include <map_fragment>
            { float up = smoothstep(0.7, 0.95, normalize(vSatN).y);
              vec2 suv = uSatO + uSatX * vSatW.x + uSatZ * vSatW.z;
              if (up > 0.0 && suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0) diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uSat, suv).rgb, up); }`); };
      m.needsUpdate = true; } });
}
// the 500 m round it, in the same frame (streets, blocks, trees): loaded after the first frame
const cityP = (async () => {
  const g = await ctxP; if (!g) return;
  g.scene.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false;
    for (const m of [].concat(o.material)) if (m && /CTX_(wall|roof|parapet)/.test(m.name || '')) m.side = THREE.FrontSide; } });   // buildings solid from outside
  // The satellite photo is not painted on here: matched to these footprints it smeared tree and roof colours across the roofs.
  document.body.dataset.sat = 'off';
  twinFrame.add(g.scene);
})();
// where the twin's entrance is (the porch modelled on the street front), in plan coordinates
const ENTR = (() => {
  const box = new THREE.Box3(); let n = 0; twinFrame.updateMatrixWorld(true);
  twinLow.traverse(o => { if (o.isMesh && /entrance|porch|canopy|door/i.test(o.name)) { box.union(new THREE.Box3().setFromObject(o)); n++; } });
  const c = n ? box.getCenter(new THREE.Vector3()) : W(SF.plate_centroid[0], SF.plate_centroid[1]);
  return toPlan(c);
})();
// the podium: a two-storey glass wing where the CAD's first floor runs beyond the twin (cad/fit_to_twin.py)
const podLow = new THREE.Group(), podHigh = new THREE.Group(); bldg.add(podLow, podHigh);
{
  const PH = 9.7, gl = [], mul = [], band = [];
  for (const [x0, y0, x1, y1] of (L.podium_edges || [])) {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0), M4 = place((x0 + x1) / 2, (y0 + y1) / 2, ang);
    gl.push(at(new THREE.BoxGeometry(len, PH - .9, .05), 0, GROUND + (PH - .9) / 2, 0).applyMatrix4(M4));
    band.push(at(new THREE.BoxGeometry(len + .06, .55, .16), 0, -.24, 0).applyMatrix4(M4), at(new THREE.BoxGeometry(len + .06, .9, .2), 0, GROUND + PH - .45, 0).applyMatrix4(M4));
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) mul.push(at(new THREE.BoxGeometry(.07, PH - .9, .14), -len / 2 + len * i / n, GROUND + (PH - .9) / 2, 0).applyMatrix4(M4));
  }
  const roofs = (L.podium || []).map(r => extrudeUp(shapeFrom(r), .5, GROUND + PH - .5));
  const parts = [[gl, new THREE.MeshPhysicalMaterial({ color: 0x2c4f72, roughness: .06, metalness: .3, transparent: true, opacity: .82, envMapIntensity: 1.6 })],
    [mul, M(0xc9ccd0, { roughness: .35, metalness: .6 })], [band, M(0x3a3d42, { roughness: .6 })], [roofs, M(0xbdb7ae, { roughness: .95 })]];
  for (const [geos, m0] of parts) {
    if (!geos.length) continue; const g = mergeGeometries(geos);
    for (const [grp, plane, list] of [[podLow, cutLow, null], [podHigh, cutHigh, highMats]]) {
      const m = m0.clone(); m.clippingPlanes = [plane]; m.userData.o = m.opacity; m.userData.t = m.transparent; m.userData.dw = m.depthWrite; list && list.push(m);
      const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
    }
  }
}
// first-floor slab over the whole plate (under Volt and the part marked OCCUPIED)
const plateShape = shapeFrom(L.plate);
const PX = L.plate.map(p => p[0]), PY = L.plate.map(p => p[1]);
const PB = [Math.min(...PX), Math.min(...PY), Math.max(...PX), Math.max(...PY)];
const plateSlab = add(extrudeUp(plateShape, .3, -.34), [M(0xb9b3aa, { roughness: .9 }), mat.slab], { cast: false });
// hover bands for picking a floor: the CAD outline at each level, invisible until hovered
const levelGlass = [], levelMeshes = [];
const bandsG = new THREE.Group(); scene.add(bandsG);
for (let lv = 0; lv < 5; lv++) {
  const y0 = (lv - 1) * FTF, gm = new THREE.MeshBasicMaterial({ color: lv === 1 ? 0xdd8d36 : 0x9fb3c8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });   // a coloured band on that floor, like the floors on a sales table
  const P = L.shell_outline || L.plate, gl = [];        // just outside the building's own facade, so it reads as that floor's band
  for (let i = 0; i < P.length; i++) { const [x0, ya] = P[i], [x1, yb] = P[(i + 1) % P.length]; const len = Math.hypot(x1 - x0, yb - ya); if (len < .15) continue;
    gl.push(at(new THREE.BoxGeometry(len + .04, FTF - .5, .06), 0, y0 + (FTF - .5) / 2 + .2, 0).applyMatrix4(place((x0 + x1) / 2, (ya + yb) / 2, Math.atan2(yb - ya, x1 - x0)))); }
  const m = new THREE.Mesh(mergeGeometries(gl), gm); m.userData.level = lv; m.renderOrder = 8; bandsG.add(m); levelGlass.push(gm); levelMeshes.push(m);
}
const LX = L.lifts.length ? L.lifts.reduce((a, p) => a + p[0], 0) / L.lifts.length : (bx0 + bx1) / 2;
const LY = L.lifts.length ? L.lifts[0][1] : by0;

// floor picker: a list beside the building (as on the touch table in the reference), Volt's floor marked on the building itself
const FLOORS = [[4, 'Fourth floor', ''], [3, 'Third floor', ''], [2, 'Second floor', ''], [1, 'First floor · Volt', `${L.seats.filter(s => s.group === 'W').length} work seats`], [0, 'Ground floor', 'Entrance, lobby and lifts']];
{ const ul = $('#floors .rows');
  for (const [lv, name, sub] of FLOORS) {
    const b = document.createElement('button'); b.className = lv === 1 ? 'volt' : lv === 0 ? 'gf' : 'other'; b.dataset.lv = lv;
    b.innerHTML = `<span class="n">${lv === 0 ? 'G' : lv}</span><span class="t">${name}<small>${sub || 'Not in this drawing'}</small></span>${lv === 1 ? '<em>Enter</em>' : lv === 0 ? '<em>View</em>' : ''}`;
    b.onmouseenter = () => hoverLevel(lv); b.onmouseleave = () => hoverLevel(-1);
    b.onclick = () => { if (lv === 1) enterVolt(); else if (lv === 0) entranceView(); };
    ul.appendChild(b);
  } }
// known places round the building, from the atlas's own list (noida-skymark/data.js), at their real positions
const KIND = { metro: ['Metro', '#2b6cb0'], corp: ['Office', '#5b4bb5'], cowork: ['Coworking', '#0f8a7e'], retail: ['Shops', '#c2571f'], health: ['Health', '#c2334d'],
  hotel: ['Hotel', '#8a5a14'], edu: ['Education', '#2f7a36'], res: ['Housing', '#6b6b6b'], pg: ['PG', '#6b6b6b'] };
const POIS = (() => {
  const dist = (q) => Math.hypot((q.lng - PIN0.lng) * KLNG, (q.lat - PIN0.lat) * KLAT), out = [];
  const st = (window.SKY_TRANSIT?.lines || []).flatMap(l => l.stations.map(x => ({ ...x, line: l.short }))).sort((a, b) => dist(a) - dist(b))[0];
  if (st) out.push({ name: st.name + ' metro', sub: st.line, kind: 'metro', lat: st.lat, lng: st.lng });
  const per = {};
  for (const q of [...(window.SKY_PLACES || [])].sort((a, b) => dist(a) - dist(b))) { const d = dist(q);
    if (d < 30 || d > 700 || q.kind === 'pg' || q.kind === 'res') continue; if ((per[q.kind] = (per[q.kind] || 0) + 1) > 2) continue; out.push(q); if (out.length >= 9) break; }
  return out.map(q => ({ ...q, d: dist(q), plan: llToPlan(q.lat, q.lng) }));
})();
const PIN_H = GROUND + 26;
{ const pos = []; for (const q of POIS) { const a = W(q.plan[0], q.plan[1], GROUND), b = W(q.plan[0], q.plan[1], PIN_H); pos.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  var pinStems = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1d1c1a, transparent: true, opacity: .55, fog: false })); scene.add(pinStems); }
for (const q of POIS) {
  const el = document.createElement('div'); el.className = 'poi'; const [kn, kc] = KIND[q.kind] || ['Place', '#555'];
  const dtxt = q.d >= 1000 ? (q.d / 1000).toFixed(1) + ' km' : Math.round(q.d / 10) * 10 + ' m';
  el.innerHTML = `<i style="background:${kc}"></i><span>${q.name.replace(/\s*\(.*?\)/g, '').slice(0, 34)}</span><small>${kn} · ${dtxt}</small>`;
  el.title = `${q.name}${q.sub ? ' · ' + q.sub : ''} · ${dtxt} in a straight line`;
  el.onclick = (e) => { e.stopPropagation(); showPlace(q); };
  $('#labels').appendChild(el); q.el = el; q.p = W(q.plan[0], q.plan[1], PIN_H);
}
function showPlace(q) {
  const pts = buildingPts(); pts.push([q.plan[0], q.plan[1], GROUND], [q.plan[0], q.plan[1], PIN_H + 4]);
  const d = [SF.plate_centroid[0] - q.plan[0], SF.plate_centroid[1] - q.plan[1]], az = Math.atan2(d[0], -d[1]) + .5;
  const { tgt, dist } = frameView(pts, az, .98, false); lastInput = performance.now() + 20000;
  controls.moveTo(tgt.x, tgt.y, tgt.z, true); controls.rotateTo(az, .98, true); controls.dollyTo(dist * 1.05, true);
}
const entTag = document.createElement('div'); entTag.className = 'ftag ent'; entTag.innerHTML = 'Main entrance <small>street front</small>';
entTag.onclick = (e) => { e.stopPropagation(); entranceView(); };
$('#labels').appendChild(entTag);
// The entrance seen from Skymark's own drive, inside the gate: the camera never goes past the boundary wall into the street or a neighbour.
async function entranceView() {
  lastInput = performance.now() + 60000;
  const p = W(ENTR[0] + OUT[0] * 8.2 + OUT[1] * 3.0, ENTR[1] + OUT[1] * 8.2 - OUT[0] * 3.0, GROUND + 1.9), t = W(ENTR[0] - OUT[0] * 1.5, ENTR[1] - OUT[1] * 1.5, GROUND + 3.6);
  await fade(true); groundView(true);
  controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false); controls.update(0); needRender = true; await sleep(150); fade(false);
}
// At the entrance the camera is a person on the drive; anywhere else outside it stays above the rooftops.
function groundView(on) {
  camera.fov = on ? 58 : BASE_FOV; camera.updateProjectionMatrix();
  if (on) { controls.minDistance = 1; controls.maxDistance = 14; controls.maxPolarAngle = 1.62; controls.minPolarAngle = .9; controls.setBoundary(null); }
  else { controls.minDistance = 45; controls.maxDistance = 900; controls.minPolarAngle = .05; controls.maxPolarAngle = 1.12;
    controls.setBoundary(new THREE.Box3(new THREE.Vector3(PB[0] - CX - 40, -3, -(PB[3] - CY) - 40), new THREE.Vector3(PB[2] - CX + 40, 20, -(PB[1] - CY) + 40))); }
}
let hoverLv = -1;
function hoverLevel(lv) {
  hoverLv = lv;
  levelGlass.forEach((m, i) => { m.opacity = i === lv ? (i === 1 ? .62 : .3) : (i === 1 ? .38 : 0); });
  document.querySelectorAll('#floors [data-lv]').forEach(el => el.classList.toggle('hl', +el.dataset.lv === lv));
  canvas.style.cursor = lv === 1 ? 'pointer' : ''; needRender = true;
}
let stage = 'building', shellA = 1, shellT = 1, upY = 0, upT = 0;
function setShell(a, instant) {
  shellT = a; upT = a > .5 ? 0 : 16;
  const sc = sun.shadow.camera, k = a > .5 ? 1 : 0;                       // the shadow area changes once per view, never while moving
  Object.assign(sc, k ? { left: -70, right: 70, top: 60, bottom: -60 } : { left: -26, right: 26, top: 22, bottom: -22 }); sc.updateProjectionMatrix();
  if (instant || LITE) { shellA = a; upY = upT; applyShell(); }
}
let highTransparent = false;
function applyShell() {
  twinHigh.position.y = upY; cutHigh.constant = -(CUTY + upY);
  const fadeOn = shellA < .995;
  if (fadeOn !== highTransparent) { highTransparent = fadeOn; for (const m of highMats) { m.transparent = fadeOn || m.userData.t; m.depthWrite = fadeOn ? false : m.userData.dw; m.needsUpdate = true; } }
  for (const m of highMats) m.opacity = m.userData.o * shellA;
  twinHigh.visible = shellA > .01;
  root.visible = shellA < .99; plateSlab.visible = root.visible;
  if (twinInteriorsLow) twinInteriorsLow.visible = shellA > .5;
  bandsG.visible = stage === 'building' && shellA > .9 && camera.position.y > GROUND + 12;   // the floor marker is for the view from above, not at the door
  podHigh.position.y = upY;
  shadowsDirty = true;
}
const camAzFor = (bearing) => { const n = bearingToPlan(bearing); return Math.atan2(n[0], -n[1]); };
const BUILDING_VIEW = { az: camAzFor(176), polar: .98 };    // from the street front, high enough to see the roads round it
function buildingPts() { const p = []; L.plate.forEach(([x, y]) => p.push([x, y, GROUND], [x, y, ROOF + 2.2])); return p; }
async function toBuilding(t = true) {
  if (mode !== 'orbit') setMode('orbit', 'stay');
  const low = t && camera.position.y < GROUND + 8;                        // leaving the drive or a room: a short cut, never a climb through walls
  if (low) { await fade(true); t = false; }
  stage = 'building'; setFocus(null); setShell(1); document.body.dataset.stage = 'building'; updateCrumbs();
  groundView(false);
  const { tgt, dist } = frameView(buildingPts(), BUILDING_VIEW.az, BUILDING_VIEW.polar, false);
  const pr = Promise.all([controls.moveTo(tgt.x, tgt.y, tgt.z, t), controls.rotateTo(BUILDING_VIEW.az, BUILDING_VIEW.polar, t), controls.dollyTo(Math.max(70, dist * 1.25), t)]);
  if (low) { controls.update(0); needRender = true; await sleep(150); fade(false); }
  return pr;
}
async function enterFloor() {
  stage = 'floor'; document.body.dataset.stage = 'floor'; hoverLevel(-1); setShell(0);
  controls.minDistance = 2.5; controls.maxDistance = 85; controls.minPolarAngle = .05; controls.maxPolarAngle = 1.38;
  controls.setBoundary(new THREE.Box3(new THREE.Vector3(bx0 - CX - 2, -1, -(by1 - CY) - 2), new THREE.Vector3(bx1 - CX + 2, 3, -(by0 - CY) + 2)));
  updateCrumbs(); return overview();
}

// ---------------------------------------------------------------- rooms meta
const seatsIn = (name) => L.seats.filter(s => s.room === name);
const placesOf = (s) => s.ids ? s.ids.length : 1;
const ROOMS = L.rooms.map(r => {
  const ss = seatsIn(r.name), by = {};
  ss.forEach(s => { by[s.group] = (by[s.group] || 0) + placesOf(s); });
  const [x0, y0, x1, y1] = r.box;
  return { ...r, by, total: ss.reduce((a, s) => a + placesOf(s), 0), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0, area: (x1 - x0) * (y1 - y0) };
});
const RAIL = ROOMS.filter(r => r.total > 0 || ['Reception', 'Wet pantry', 'Entry'].includes(r.name) === false && r.name.startsWith('Phone'))
  .sort((a, b) => (b.by.W || 0) - (a.by.W || 0) || b.total - a.total);
const nWork = L.seats.filter(s => s.group === 'W').length, nAll = L.seats.reduce((a, s) => a + placesOf(s), 0);
$('#nwork').textContent = nWork; $('#nall').textContent = `${nAll} seats of every kind, counted from the CAD drawing`;
const roomAt = (x, y) => ROOMS.find(r => x >= r.box[0] && x <= r.box[2] && y >= r.box[1] && y <= r.box[3]);
const mainGroup = (r) => ['W', 'M', 'C', 'L'].find(g => r.by[g]) || 'L';
const countTxt = (r) => { const g = mainGroup(r); const n = r.by[g] || 0; return n ? `${n} ${({ W: 'work', M: 'meeting', C: 'cafe', L: 'lounge' })[g]}` : ''; };

// ---------------------------------------------------------------- camera controls
const controls = new CameraControls(camera, canvas);
controls.smoothTime = ST(.32); controls.draggingSmoothTime = .09; controls.dollyToCursor = true; controls.infinityDolly = false;
controls.minDistance = 2.5; controls.maxDistance = 85; controls.minPolarAngle = .05; controls.maxPolarAngle = 1.38;
controls.azimuthRotateSpeed = .9; controls.polarRotateSpeed = .9; controls.dollySpeed = .7; controls.truckSpeed = 2.2;
controls.setBoundary(new THREE.Box3(new THREE.Vector3(bx0 - CX - 2, -1, -(by1 - CY) - 2), new THREE.Vector3(bx1 - CX + 2, 3, -(by0 - CY) + 2)));
controls.boundaryEnclosesCamera = false; controls.boundaryFriction = .2;
const ortCtl = new CameraControls(ortho, canvas); ortCtl.enabled = false;
ortCtl.azimuthRotateSpeed = 0; ortCtl.polarRotateSpeed = 0; ortCtl.dollyToCursor = true; ortCtl.smoothTime = .2;
ortCtl.mouseButtons.left = CameraControls.ACTION.TRUCK; ortCtl.mouseButtons.wheel = CameraControls.ACTION.ZOOM; ortCtl.touches.one = CameraControls.ACTION.TOUCH_TRUCK; ortCtl.touches.two = CameraControls.ACTION.TOUCH_ZOOM_TRUCK;
ortCtl.minZoom = 8; ortCtl.maxZoom = 400;

// Frame a set of plan points inside the free part of the screen (not under the cards and dock).
const tmpCam = new THREE.PerspectiveCamera();
function safeRect(card) {
  const n = innerWidth <= 760;
  const r = { l: n ? 12 : (innerWidth > 1100 ? 330 : 20), r: n ? 12 : (card ? 356 : 24), t: n ? 78 : 24, b: n ? (card ? 300 : 140) : 150 };
  return { x0: r.l / innerWidth * 2 - 1, x1: 1 - r.r / innerWidth * 2, y0: -1 + r.b / innerHeight * 2, y1: 1 - r.t / innerHeight * 2 };
}
function frameView(pts, az, polar, card) {
  const S = safeRect(card), cx = (S.x0 + S.x1) / 2, cy = (S.y0 + S.y1) / 2, hw = (S.x1 - S.x0) / 2, hh = (S.y1 - S.y0) / 2;
  tmpCam.copy(camera); tmpCam.aspect = innerWidth / innerHeight; tmpCam.updateProjectionMatrix();
  const P = pts.map(([x, y, h]) => W(x, y, h || 0));
  const tgt = P.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / P.length); tgt.y = .4;
  const dirTo = new THREE.Vector3().setFromSphericalCoords(1, polar, az);
  const proj = (dist) => { tmpCam.position.copy(tgt).addScaledVector(dirTo, dist); tmpCam.lookAt(tgt); tmpCam.updateMatrixWorld();
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const p of P) { v3.copy(p).project(tmpCam); x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x); y0 = Math.min(y0, v3.y); y1 = Math.max(y1, v3.y); } return { x0, x1, y0, y1 }; };
  let dist = 30;
  for (let it = 0; it < 4; it++) {
    let lo = 1.5, hi = 220;
    for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2, b = proj(m); ((b.x1 - b.x0) / 2 <= hw && (b.y1 - b.y0) / 2 <= hh) ? hi = m : lo = m; }
    dist = hi; const b = proj(dist);
    const ox = (b.x0 + b.x1) / 2 - cx, oy = (b.y0 + b.y1) / 2 - cy;
    const right = new THREE.Vector3().setFromMatrixColumn(tmpCam.matrixWorld, 0); right.y = 0; right.normalize();
    const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
    const halfW = Math.tan(THREE.MathUtils.degToRad(tmpCam.fov) / 2) * dist * tmpCam.aspect, halfH = Math.tan(THREE.MathUtils.degToRad(tmpCam.fov) / 2) * dist;
    tgt.addScaledVector(right, ox * halfW).addScaledVector(fwd, oy * halfH / Math.max(.35, Math.cos(polar)));
  }
  return { tgt, dist };
}
const OVER = { az: .62, polar: .8 };
const platePts = () => { const p = []; L.floor.forEach(f => f.outer.forEach(([x, y]) => { p.push([x, y, 0], [x, y, CUT]); })); return p; };
function overview(t = true) {
  setFocus(null);
  const { tgt, dist } = frameView(platePts(), OVER.az, OVER.polar, innerWidth > 760);
  return Promise.all([controls.moveTo(tgt.x, tgt.y, tgt.z, t), controls.rotateTo(OVER.az, OVER.polar, t), controls.dollyTo(dist, t)]);
}
function flyToRoom(r, t = true) {
  setFocus(r);
  const polar = r.area < 30 ? .55 : r.area < 80 ? .7 : .8;
  let az = controls.azimuthAngle; if (mode !== 'orbit') az = OVER.az;
  const [x0, y0, x1, y1] = r.box; const pts = [];
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) pts.push([x, y, 0], [x, y, CUT]);
  const { tgt, dist } = frameView(pts, az, polar, true);
  return Promise.all([controls.moveTo(tgt.x, tgt.y, tgt.z, t), controls.rotateTo(az, polar, t), controls.dollyTo(Math.max(4, dist), t)]);
}

// ---------------------------------------------------------------- post (AO only when still)
const composer = new EffectComposer(renderer);
composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
ao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 }); ao.blendIntensity = .9;
composer.addPass(ao); composer.addPass(new OutputPass());
let lastMove = 0, needRender = true, aoDone = false;

// ---------------------------------------------------------------- labels
const labelsEl = $('#labels'), labels = [];
for (const r of ROOMS) {
  if (r.total === 0 && !['Reception', 'Wet pantry', 'Server room', 'UPS room', 'Entry'].includes(r.name) && !r.name.startsWith('Phone')) continue;
  const el = document.createElement('div'); el.className = 'lab';
  const g = mainGroup(r), c = countTxt(r);
  el.innerHTML = `${r.name.replace(' / command centre', '')}${c ? `<small class="${g.toLowerCase()}">${c}</small>` : ''}`;
  el.onclick = (e) => { e.stopPropagation(); if (mode === 'orbit') enterWalk(r); };
  labelsEl.appendChild(el); labels.push({ el, r, p: W(r.cx, r.cy, 1.4), big: r.total >= 9 });
}
{ const el = document.createElement('div'); el.className = 'lab'; el.style.opacity = .8; el.innerHTML = 'Occupied · other tenant';
  labelsEl.appendChild(el); labels.push({ el, r: { name: 'occupied' }, p: W((PB[0] + bx0) / 2 + 1, (PB[1] + PB[3]) / 2, .3), big: true }); }
let seatLabels = [];
function showSeatNumbers(r) {
  seatLabels.forEach(s => s.el.remove()); seatLabels = [];
  if (!r || !seatDots.visible) return;
  for (const s of seatsIn(r.name)) {
    const el = document.createElement('div'); el.className = 'seatn'; el.style.background = '#' + GROUP_COL[s.group].toString(16).padStart(6, '0');
    el.textContent = s.ids ? s.ids[0] + '–' + s.ids[s.ids.length - 1].slice(1) : s.id; labelsEl.appendChild(el); seatLabels.push({ el, p: W(s.x, s.y, 1.27) });
  }
}
function updateLabels() {
  placeFloorTags(); placeHotspots();
  const cam = mode === 'elev' ? ortho : camera;
  const show = mode === 'orbit' && stage === 'floor';
  const dist = controls.distance;
  for (const l of labels) {
    v3.copy(l.p).project(cam);
    const vis = show && v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 && (focus ? (focus === l.r || dist < 22) : (l.big || dist < 34));
    l.el.style.opacity = vis ? (focus && focus !== l.r ? .55 : 1) : 0; l.el.style.pointerEvents = vis ? 'auto' : 'none';
    if (vis) l.el.style.transform = `translate(${(v3.x * .5 + .5) * innerWidth}px,${(-v3.y * .5 + .5) * innerHeight}px) translate(-50%,-50%)`;
  }
  for (const s of seatLabels) {
    v3.copy(s.p).project(cam); const vis = show && v3.z < 1;
    s.el.style.opacity = vis ? 1 : 0;
    if (vis) s.el.style.transform = `translate(${(v3.x * .5 + .5) * innerWidth}px,${(-v3.y * .5 + .5) * innerHeight}px) translate(-50%,-50%)`;
  }
}

function placeFloorTags() {
  const on = stage === 'building' && mode === 'orbit' && shellA > .5;
  // put the tags on the building face nearest the camera
  const sides = [[(PB[0] + PB[2]) / 2, PB[1]], [(PB[0] + PB[2]) / 2, PB[3]], [PB[0], (PB[1] + PB[3]) / 2], [PB[2], (PB[1] + PB[3]) / 2]];
  let best = sides[0], bd = 1e9; for (const sd of sides) { const d = W(sd[0], sd[1]).distanceTo(camera.position); if (d < bd) { bd = d; best = sd; } }
  pinStems.visible = on;
  for (const q of POIS) { v3.copy(q.p).project(camera); const vis = on && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    q.el.style.opacity = vis ? 1 : 0; q.el.style.pointerEvents = vis ? 'auto' : 'none';
    if (vis) q.el.style.transform = `translate(${(v3.x * .5 + .5) * innerWidth}px,${(-v3.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`; }
  { v3.copy(W(ENTR[0], ENTR[1], GROUND + 3.2)).project(camera); const vis = on && v3.z < 1;
    entTag.style.opacity = vis ? 1 : 0; entTag.style.pointerEvents = vis ? 'auto' : 'none';
    if (vis) entTag.style.transform = `translate(${(v3.x * .5 + .5) * innerWidth}px,${(-v3.y * .5 + .5) * innerHeight}px) translate(-50%,-50%)`; }
}
// breadcrumbs, back pill and time of day
function updateCrumbs() {
  const c = [`<span data-go="building">Skymark F-1</span>`];
  if (stage === 'floor') c.push(`<span data-go="floor">First floor · Volt</span>`);
  if (stage === 'floor' && focus) c.push(`<span>${focus.name}</span>`);
  if (mode === 'walk') c.push('<span>Walking</span>'); if (mode === 'elev') c.push('<span>Elevations</span>'); if (mode === 'tour') c.push('<span>Tour</span>');
  $('#crumbs .path').innerHTML = c.join('<i>›</i>');
  $('#back').style.display = stage === 'floor' ? '' : 'none';
  $('#list').classList.toggle('show', stage === 'floor' && mode === 'orbit' && !focus);
  $('#back').textContent = '← ' + (focus || mode !== 'orbit' ? 'Floor' : 'Building');
  $('#crumbs .path').querySelectorAll('[data-go]').forEach(el => el.onclick = () => el.dataset.go === 'building' ? toBuilding() : setMode('orbit', true));
}
$('#back').onclick = () => { if (focus || mode !== 'orbit') setMode('orbit', true); else toBuilding(); };
const TOD = { t: .3 };
const cSunLow = new THREE.Color(0xffa860), cSunHigh = new THREE.Color(0xfff3e2), bgDay = new THREE.Color(0xe7e3dc), bgDusk = new THREE.Color(0xe8c9a6), bgNight = new THREE.Color(0x1c2230);
function setTOD(t) {
  TOD.t = t; const hr = 7 + t * 15, a = Math.PI * (hr - 6) / 13, el = Math.sin(a);
  const day = THREE.MathUtils.smoothstep(el, -.05, .25), low = 1 - THREE.MathUtils.smoothstep(el, .15, .6);
  sun.position.set(Math.cos(a) * 45, Math.max(.05, el) * 55 + 4, 28); sun.intensity = 2.4 * day;
  sun.color.copy(cSunHigh).lerp(cSunLow, low);
  hemi.intensity = .25 + .35 * day; hemi.color.setHex(day > .5 ? 0xfffaf2 : 0xffd9a8);
  scene.environmentIntensity = .38 + .3 * day;
  const bg = day > .5 ? bgDay.clone().lerp(bgDusk, low * .8) : bgNight.clone().lerp(bgDusk, day * 2);
  scene.background.copy(bg); if (scene.fog) scene.fog.color.copy(bg);
  mat.panel.color.setScalar(1 + (1 - day) * 1.5);
  const h = Math.floor(hr), mm = Math.round((hr - h) * 60 / 15) * 15;
  $('#todl').textContent = `${((h + 11) % 12) + 1}:${String(mm % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  document.body.classList.toggle('night', day < .35);
  shadowsDirty = true; needRender = true;
}
$('#tod').oninput = (e) => setTOD(+e.target.value / 1000);

// ---------------------------------------------------------------- focus card and rail
let focus = null;
const rail = $('#rail');
for (const r of RAIL) {
  const b = document.createElement('button'); b.className = 'glass'; const g = mainGroup(r);
  b.innerHTML = `${r.name.replace(' / command centre', '').replace(' room', '')}${r.total ? `<span class="n ${g === 'W' ? '' : g.toLowerCase()}">${r.by[g] || r.total}</span>` : ''}`;
  b.onclick = () => enterWalk(r);
  b.onmouseenter = () => hover(r); b.onmouseleave = () => hover(null);
  r.btn = b; rail.appendChild(b);
}
{ const list = $('#list .rows');
  for (const r of RAIL) { const g = mainGroup(r), b = document.createElement('button'); b.dataset.room = r.name;
    b.innerHTML = `<span>${r.name.replace(' / command centre', '')}</span><small class="${g.toLowerCase()}">${r.total ? (r.by[g] || r.total) + ' ' + ({ W: 'work', M: 'meeting', C: 'cafe', L: 'lounge', O: 'operator' })[g] : ''}</small><i>→</i>`;
    b.onclick = () => enterWalk(r); b.onmouseenter = () => hover(r); b.onmouseleave = () => hover(null); list.appendChild(b); }
  $('#list .fig').innerHTML = `<b>${nWork}</b> work seats <span>· ${nAll} seats in all</span>`; }
function hover(r) { for (const m of roomMeshes) { const on = r && m.userData.room === r.name; m.material.opacity = on ? .22 : (focus && m.userData.room === focus.name ? .14 : 0); } needRender = true; }
const GN = { W: 'work seats', M: 'meeting seats', C: 'cafeteria seats', L: 'lounge and visitor seats', O: 'operator seats' };
function setFocus(r) {
  focus = r;
  RAIL.forEach(x => x.btn.classList.toggle('on', x === r));
  if (r?.btn) r.btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  $('#b-over').classList.toggle('on', !r && mode === 'orbit');
  hover(null);
  showSeatNumbers(r); showHotspots(mode === 'walk' || mode === 'tour' ? r : null); updateCrumbs();
  $('#walkhere').textContent = mode === 'walk' ? 'Seats from above' : 'Step inside';
  document.querySelectorAll('#list [data-room]').forEach(el => el.classList.toggle('on', !!r && el.dataset.room === r.name));
  const card = $('#card');
  if (!r) { card.classList.remove('show'); return; }
  $('#cname').textContent = r.name;
  $('#cmeta').textContent = `${(r.area).toFixed(0)} m² (${(r.area * 10.764).toFixed(0)} sq ft) · floor: ${r.floor}`;
  $('#cseats').innerHTML = Object.entries(r.by).map(([g, n]) => `<span style="color:#${GROUP_COL[g].toString(16).padStart(6, '0')}">${n} ${GN[g]}</span>`).join('') || '<span>No seats</span>';
  const imgs = roomImages(r), img = $('#cimg');
  if (imgs.length) { img.style.display = ''; const want = imgs[0]; img.dataset.want = want; const pre = new Image(); pre.onload = () => { if (img.dataset.want === want) img.style.backgroundImage = `url(${want})`; }; pre.src = want; if (pre.complete) img.style.backgroundImage = `url(${want})`;
    img.querySelector('.tag').textContent = OURS[r.name] ? 'Photoreal render' : 'Design render'; $('#ccnt').textContent = imgs.length > 1 ? `1 / ${imgs.length}` : ''; }
  else img.style.display = 'none';
  card.classList.add('show');
}
const roomImages = (r) => (OURS[r.name] || []).concat((DECK[r.name] || []).map(n => `/media/noida-skymark/volt/deck/p${String(n).padStart(2, '0')}.jpg`));
$('#cimg').onclick = () => { if (!focus) return; openLB(roomImages(focus), `${focus.name}: ${OURS[focus.name] ? 'our Cycles render first, then ' : ''}design renders from the Volt deck (21 Aug 2026)`); };
$('#cardx').onclick = () => setMode('orbit', true);
const step = (k) => { const i = RAIL.indexOf(focus); const r = RAIL[(i + k + RAIL.length) % RAIL.length]; mode === 'walk' ? enterWalk(r) : flyToRoom(r); };
$('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
$('#walkhere').onclick = () => { if (mode === 'walk') { const r = focus; setMode('orbit', 'stay'); seatDots.visible = true; $('#b-seats').classList.add('on'); flyToRoom(r); } else enterWalk(focus); };

// hotspots: pills on the real things in the room, counted from the CAD
let hots = [];
function roomHotspots(r) {
  const inR = (x, y, pad = 0) => x >= r.box[0] - pad && x <= r.box[2] + pad && y >= r.box[1] - pad && y <= r.box[3] + pad, hs = [];
  const cen = (list, f) => { const c = list.reduce((a, o) => { const q = f(o); a[0] += q[0]; a[1] += q[1]; return a; }, [0, 0]); return [c[0] / list.length, c[1] / list.length]; };
  const byK = {}; L.desks.filter(d => d.kind.includes('workstation') && inR(d.c[0], d.c[1])).forEach(d => (byK[d.kind] = byK[d.kind] || []).push(d));
  for (const [k, list] of Object.entries(byK)) { const c = cen(list, d => d.c); hs.push({ t: `${list.length} desks · ${k.replace(' workstation', '')}`, p: [c[0], c[1], 1.25] }); }
  const ss = seatsIn(r.name), nOf = (g) => ss.filter(x => x.group === g).reduce((a, x) => a + placesOf(x), 0);
  if (nOf('M')) { const tb = L.tables.filter(t => inR(...tCentre(t))).sort((a, b) => tArea(b) - tArea(a))[0]; if (tb) hs.push({ t: `${nOf('M')}-seat meeting table`, p: [...tCentre(tb), 1.0] }); }
  if (nOf('C')) { const c = cen(ss, x => [x.x, x.y]); hs.push({ t: `Cafe seating · ${nOf('C')}`, p: [c[0], c[1], 1.0] }); }
  const lg = ss.filter(x => x.group === 'L'); if (lg.length) { const c = cen(lg, x => [x.x, x.y]); hs.push({ t: `Lounge seating · ${nOf('L')}`, p: [c[0], c[1], .95] }); }
  const pl = L.planters.filter(q => inR(q.c[0], q.c[1])); if (pl.length) hs.push({ t: `${pl.length} planter boxes`, p: [pl[0].c[0], pl[0].c[1], 1.05] });
  const li = L.lights.filter(l => inR(l.c[0], l.c[1])); if (li.length) { const n = li.sort((a, b) => Math.hypot(a.c[0] - r.cx, a.c[1] - r.cy) - Math.hypot(b.c[0] - r.cx, b.c[1] - r.cy))[0];
    hs.push({ t: `${li.length} ceiling lights · from the ceiling plan`, p: [n.c[0], n.c[1], H - .12] }); }
  const gl = L.glass.filter(g => g[4] !== 'AR-WINDOW' && inR((g[0] + g[2]) / 2, (g[1] + g[3]) / 2, .35)).sort((a, b) => Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1]))[0];
  if (gl) hs.push({ t: 'Glass partition · frosted band', p: [(gl[0] + gl[2]) / 2, (gl[1] + gl[3]) / 2, 1.75] });
  const wn = L.glass.filter(g => g[4] === 'AR-WINDOW' && inR((g[0] + g[2]) / 2, (g[1] + g[3]) / 2, .8))[0];
  if (wn) hs.push({ t: 'Facade window', p: [(wn[0] + wn[2]) / 2, (wn[1] + wn[3]) / 2, 1.9] });
  if (roomImages(r).length) hs.push({ t: OURS[r.name] ? 'See the photoreal render' : 'See the design render', render: true, p: [r.cx, r.cy, 2.05] });
  return hs;
}
const tCentre = (t) => t.circle ? [t.circle[0], t.circle[1]] : [t.poly.reduce((a, q) => a + q[0], 0) / t.poly.length, t.poly.reduce((a, q) => a + q[1], 0) / t.poly.length];
const tArea = (t) => t.circle ? Math.PI * t.circle[2] ** 2 : (Math.max(...t.poly.map(q => q[0])) - Math.min(...t.poly.map(q => q[0]))) * (Math.max(...t.poly.map(q => q[1])) - Math.min(...t.poly.map(q => q[1])));
function showHotspots(r) {
  hots.forEach(h => h.el.remove()); hots = [];
  if (!r) return;
  for (const h of roomHotspots(r)) {
    const el = document.createElement('div'); el.className = 'hot' + (h.render ? ' r' : ''); el.innerHTML = `<i></i>${h.t}`;
    if (h.render) el.onclick = (e) => { e.stopPropagation(); $('#cimg').onclick(); };
    labelsEl.appendChild(el); hots.push({ el, p: W(h.p[0], h.p[1], h.p[2]), render: h.render });
  }
}
function placeHotspots() {
  const on = mode === 'walk' || mode === 'tour';
  for (const h of hots) { v3.copy(h.p).project(camera); const d = h.p.distanceTo(camera.position);
    const vis = on && v3.z < 1 && Math.abs(v3.x) < .98 && Math.abs(v3.y) < .95 && d < 22 && d > .6;
    h.el.style.opacity = vis ? 1 : 0; h.el.style.pointerEvents = vis && h.render ? 'auto' : 'none';
    if (vis) h.el.style.transform = `translate(${(v3.x * .5 + .5) * innerWidth}px,${(-v3.y * .5 + .5) * innerHeight}px) translate(-50%,-50%)`; }
}

// lightbox
let lbList = [], lbI = 0;
function openLB(list, cap) { lbList = list; lbI = 0; $('#lbimg').src = list[0]; $('#lbcap').textContent = cap + (list.length > 1 ? ` · ${1}/${list.length}, click for next` : ''); $('#lb').classList.add('show'); $('#lb').dataset.cap = cap; }
$('#lb').onclick = () => { if (lbList.length > 1 && lbI < lbList.length - 1) { lbI++; $('#lbimg').src = lbList[lbI]; $('#lbcap').textContent = $('#lb').dataset.cap + ` · ${lbI + 1}/${lbList.length}`; } else $('#lb').classList.remove('show'); };
$('#proof').onclick = () => openLB(['/media/noida-skymark/volt/volt_seat_plan.png'], 'Every seat numbered on the CAD plan (W work, M meeting, C cafeteria, L lounge, O operator)');

// ---------------------------------------------------------------- walls height (cut-away by default)
let wallScale = CUT / H, wallTarget = CUT / H, wallsFull = false;
wallsG.scale.y = wallScale;
function setWalls(full) { wallsFull = full; wallTarget = (full || mode === 'walk' || mode === 'elev' || mode === 'tour') ? 1 : CUT / H; $('#b-walls').classList.toggle('on', full); }
$('#b-walls').onclick = () => setWalls(!wallsFull);
$('#b-seats').onclick = () => { seatDots.visible = !seatDots.visible; $('#b-seats').classList.toggle('on', seatDots.visible); showSeatNumbers(focus); needRender = true; };

// ---------------------------------------------------------------- walk mode (first person, collision against the CAD walls)
const GRID = 10; // cells per metre
const grid = (() => {
  const c = document.createElement('canvas'); c.width = Math.ceil((bx1 - bx0 + 2) * GRID); c.height = Math.ceil((by1 - by0 + 2) * GRID);
  const g = c.getContext('2d'); const T = ([x, y]) => [(x - bx0 + 1) * GRID, (by1 + 1 - y) * GRID];
  const poly = (pts) => { g.beginPath(); pts.forEach((p, i) => { const [a, b] = T(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); };
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; L.floor.forEach(f => { poly(f.outer); g.fill(); });
  g.fillStyle = '#000';
  if (L.atrium) { poly(L.atrium); g.fill(); }
  L.walls.forEach(w => { poly(w.outer); g.fill('evenodd'); w.holes.forEach(h => { g.fillStyle = '#fff'; poly(h); g.fill(); g.fillStyle = '#000'; }); });
  L.columns.forEach(cc => { poly(cc); g.fill(); });
  g.strokeStyle = '#000'; g.lineWidth = .12 * GRID;
  L.glass.forEach(([x0, y0, x1, y1]) => { g.beginPath(); g.moveTo(...T([x0, y0])); g.lineTo(...T([x1, y1])); g.stroke(); });
  g.fillStyle = '#fff';                                                         // every door is an opening you can walk through (the leaf is drawn separately)
  L.doors.forEach(d => { const ca = Math.cos(d.a), sa = Math.sin(d.a), hw = Math.max(d.w, .9) / 2 - .02, hd = .45; poly([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [d.c[0] + ca * u * hw - sa * v * hd, d.c[1] + sa * u * hw + ca * v * hd])); g.fill(); });
  g.fillStyle = '#000';
  L.desks.forEach(d => { const ca = Math.cos(d.a), sa = Math.sin(d.a); poly([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [d.c[0] + ca * u * d.w / 2 - sa * v * d.d / 2, d.c[1] + sa * u * d.w / 2 + ca * v * d.d / 2])); g.fill(); });
  L.tables.forEach(t => { if (t.circle) { const [a, b] = T(t.circle); g.beginPath(); g.arc(a, b, t.circle[2] * GRID, 0, 7); g.fill(); } else { poly(t.poly); g.fill(); } });
  L.planters.forEach(p => { const ca = Math.cos(p.a), sa = Math.sin(p.a); poly([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [p.c[0] + ca * u * p.w / 2 - sa * v * p.d / 2, p.c[1] + sa * u * p.w / 2 + ca * v * p.d / 2])); g.fill(); });
  const data = g.getImageData(0, 0, c.width, c.height).data;
  return { c, T, free(x, y) { const [a, b] = T([x, y]); const i = ((b | 0) * c.width + (a | 0)) * 4; return a >= 0 && b >= 0 && a < c.width && b < c.height && data[i] > 128; } };
})();
const R_BODY = .16;
const freeAt = (x, y) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (!grid.free(x + Math.cos(a) * R_BODY, y + Math.sin(a) * R_BODY)) return false; } return grid.free(x, y); };
function clearance(x, y) { if (!freeAt(x, y)) return 0; let r = .3; for (; r < 2; r += .1) { let ok = true; for (let k = 0; k < 12 && ok; k++) { const a = k * Math.PI / 6; ok = grid.free(x + Math.cos(a) * r, y + Math.sin(a) * r); } if (!ok) break; } return r; }
function clearSpot(r, bias = [0, 0]) {
  let best = [r.cx, r.cy], bs = -1;
  for (let x = r.box[0] + .4; x < r.box[2] - .4; x += .25) for (let y = r.box[1] + .4; y < r.box[3] - .4; y += .25) {
    const c = clearance(x, y); if (!c) continue; const sc = Math.min(c, 1.2) * 3 - Math.hypot((x - r.box[0]) / r.w - .5 + bias[0], (y - r.box[1]) / r.d - .5 + bias[1]);
    if (sc > bs) { bs = sc; best = [x, y]; } }
  return best;
}
function nearestFree(x, y) { if (freeAt(x, y)) return [x, y]; for (let r = .1; r < 4; r += .1) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, X = x + Math.cos(a) * r, Y = y + Math.sin(a) * r; if (freeAt(X, Y)) return [X, Y]; } return [x, y]; }
const EYE = 1.55;
const walk = { x: 0, y: 0, yaw: 0, pitch: -.05, keys: {}, glide: null, path: null, joy: [0, 0] };
// ---------------------------------------------------------------- path-finding: tap anywhere and the walker goes round the walls
const PG = { cs: .1, x0: Math.min(...PX) - 1, y0: Math.min(...PY) - 1 }; PG.nx = Math.ceil((Math.max(...PX) - PG.x0 + 1) / PG.cs); PG.ny = Math.ceil((Math.max(...PY) - PG.y0 + 1) / PG.cs);
const pgFree = new Uint8Array(PG.nx * PG.ny);                                  // 0 unknown, 1 free, 2 blocked (the scene is static, so this is kept)
const cellOf = (x, y) => [Math.round((x - PG.x0) / PG.cs), Math.round((y - PG.y0) / PG.cs)];
const cellXY = (i, j) => [PG.x0 + i * PG.cs, PG.y0 + j * PG.cs];
function cellFree(i, j) { if (i < 0 || j < 0 || i >= PG.nx || j >= PG.ny) return false; const k = j * PG.nx + i; if (!pgFree[k]) { const [x, y] = cellXY(i, j); pgFree[k] = freeAt(x, y) ? 1 : 2; } return pgFree[k] === 1; }
function flood(x, y) {                                                          // distance from the walker to every reachable cell (8 neighbours)
  const par = new Int32Array(PG.nx * PG.ny).fill(-1), dist = new Float32Array(PG.nx * PG.ny).fill(-1);
  let [ci, cj] = cellOf(x, y); if (!cellFree(ci, cj)) { const [fx, fy] = nearestFree(x, y); [ci, cj] = cellOf(fx, fy); }
  const q = [ci + cj * PG.nx]; dist[q[0]] = 0; par[q[0]] = q[0];
  for (let h = 0; h < q.length; h++) { const k = q[h], i = k % PG.nx, j = (k / PG.nx) | 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (!a && !b) continue; const ni = i + a, nj = j + b, nk = nj * PG.nx + ni;
      if (dist[nk] >= 0 || !cellFree(ni, nj)) continue; if (a && b && !(cellFree(i + a, j) && cellFree(i, j + b))) continue;   // no cutting corners
      dist[nk] = dist[k] + (a && b ? 1.414 : 1) * PG.cs; par[nk] = k; q.push(nk); } }
  return { par, dist };
}
function pathTo(F, x, y) { let [i, j] = cellOf(x, y); let k = j * PG.nx + i; if (!(F.dist[k] >= 0)) { const [fx, fy] = nearestFree(x, y); [i, j] = cellOf(fx, fy); k = j * PG.nx + i; if (!(F.dist[k] >= 0)) return null; }
  const pts = []; for (let g = 0; g < 5000; g++) { pts.push(cellXY(k % PG.nx, (k / PG.nx) | 0)); if (F.par[k] === k) break; k = F.par[k]; } return pts.reverse(); }
const lineFree = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / .1); for (let t = 1; t <= n; t++) if (!freeAt(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n)) return false; return true; };
function smooth(pts) { if (!pts || pts.length < 3) return pts; const out = [pts[0]]; let a = 0; while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !lineFree(pts[a], pts[b])) b--; out.push(pts[b]); a = b; } return out; }
function goTo(x, y) {
  const [tx, ty] = nearestFree(x, y); const pts = smooth(pathTo(flood(walk.x, walk.y), tx, ty));
  if (!pts || pts.length < 2) { walk.glide = { x: tx, y: ty }; walk.path = null; return !!pts; }
  const wp = pts.slice(1); wp[wp.length - 1] = [tx, ty]; const f = wp.shift(); walk.glide = { x: f[0], y: f[1] }; walk.path = wp; return true;
}


// ---------------------------------------------------------------- live CAD locator: the drawing itself, with you on it
// The blueprint is drawn from the DWG's own lines (cad/blueprint.py). The marker is the walker's real position in the
// drawing's frame, so the map, the 3D and the seat list all agree.
const BP = await (await fetch('./cad_blueprint.json')).json();
const bpImg = new Image(); bpImg.src = '/media/noida-skymark/volt/cad_blueprint.png'; bpImg.onload = () => { needRender = true; };
const locC = $('#locc'), lctx = locC.getContext('2d');
const loc = { big: false, headUp: false, trail: [], view: null, lastRoom: null };
const NORTH = bearingToPlan(0);                                   // true north as a direction on the plan
const ENTRY = (L.labels.find(l => /^ENTRY$/i.test(l.t.trim())) || null);
const CARD8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function locPose() {
  if (walk.active) return { x: walk.x, y: walk.y, yaw: walk.yaw };
  const d = camera.getWorldDirection(new THREE.Vector3()), [x, y] = toPlan(camera.position);
  return { x, y, yaw: Math.atan2(-d.z, d.x) };
}
function trueBearing(yaw) { const dx = Math.cos(yaw), dy = Math.sin(yaw), c = Math.cos(RHO), sn = Math.sin(RHO); return (Math.atan2(c * dx - sn * dy, sn * dx + c * dy) / D2R + 360) % 360; }
const ftIn = (m) => { const t = Math.round(m / .0254), f = Math.floor(Math.abs(t) / 12), i = Math.abs(t) % 12; return `${t < 0 ? '-' : ''}${f}′${i}″`; };
function drawLoc() {
  const inside = stage === 'floor' && camera.position.y > -1 && camera.position.y < H + .5;
  $('#loc').style.display = inside ? '' : 'none'; $('#compass').style.display = inside ? '' : 'none';
  if (!inside) return;
  const P = locPose(), dpr = Math.min(2, devicePixelRatio || 1), cw = locC.clientWidth, chh = locC.clientHeight;
  if (locC.width !== Math.round(cw * dpr) || locC.height !== Math.round(chh * dpr)) { locC.width = Math.round(cw * dpr); locC.height = Math.round(chh * dpr); }
  const [x0, y0, x1, y1] = BP.bounds, follow = !loc.big || loc.headUp;
  const k = (follow ? cw / (loc.big ? 30 : 17) : Math.min(cw / (x1 - x0), chh / (y1 - y0))), rot = loc.headUp ? P.yaw - Math.PI / 2 : 0;
  const cx = follow ? P.x : (x0 + x1) / 2, cy = follow ? P.y : (y0 + y1) / 2;
  loc.view = { k, rot, cx, cy, cw, chh };
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.fillStyle = '#123b7a'; lctx.fillRect(0, 0, cw, chh);
  lctx.save(); lctx.translate(cw / 2, chh / 2); lctx.rotate(rot); lctx.scale(k, k); lctx.translate(-cx, cy);
  if (bpImg.complete && bpImg.naturalWidth) lctx.drawImage(bpImg, x0, -y1, x1 - x0, y1 - y0);
  const rm = roomAt(P.x, P.y);
  if (rm) { lctx.fillStyle = 'rgba(242,162,76,.22)'; lctx.strokeStyle = 'rgba(242,162,76,.9)'; lctx.lineWidth = 1.5 / k; lctx.fillRect(rm.box[0], -rm.box[3], rm.w, rm.d); lctx.strokeRect(rm.box[0], -rm.box[3], rm.w, rm.d); }
  if (loc.trail.length > 1) { lctx.strokeStyle = 'rgba(255,255,255,.75)'; lctx.lineWidth = 2 / k; lctx.setLineDash([5 / k, 5 / k]); lctx.beginPath(); loc.trail.forEach(([tx, ty], i) => i ? lctx.lineTo(tx, -ty) : lctx.moveTo(tx, -ty)); lctx.stroke(); lctx.setLineDash([]); }
  if (ENTRY) { lctx.fillStyle = '#35d07f'; lctx.beginPath(); lctx.arc(ENTRY.x + .9, -ENTRY.y + .35, 5 / k, 0, 7); lctx.fill(); }
  // you: view cone and dot
  lctx.translate(P.x, -P.y); lctx.rotate(-P.yaw);
  const g = lctx.createRadialGradient(0, 0, 0, 0, 0, 5); g.addColorStop(0, 'rgba(255,190,90,.75)'); g.addColorStop(1, 'rgba(255,190,90,0)');
  lctx.fillStyle = g; lctx.beginPath(); lctx.moveTo(0, 0); lctx.arc(0, 0, 5, -.5, .5); lctx.closePath(); lctx.fill();
  lctx.fillStyle = '#ff9f2e'; lctx.strokeStyle = '#fff'; lctx.lineWidth = 2.5 / k; lctx.beginPath(); lctx.arc(0, 0, 6.5 / k, 0, 7); lctx.fill(); lctx.stroke();
  lctx.fillStyle = '#fff'; lctx.beginPath(); lctx.moveTo(12 / k, 0); lctx.lineTo(6 / k, -4 / k); lctx.lineTo(6 / k, 4 / k); lctx.closePath(); lctx.fill();
  lctx.restore();
  if (ENTRY) { const [ex, ey] = locToScreen(ENTRY.x + .9, ENTRY.y - .35); lctx.font = '700 10px Inter,sans-serif'; lctx.fillStyle = '#35d07f'; lctx.fillText('IN / OUT', ex + 8, ey + 3); }
  // true north
  { const na = Math.atan2(-NORTH[1], NORTH[0]) + rot, ox = cw - 26, oy = 26; lctx.save(); lctx.translate(ox, oy);
    lctx.fillStyle = 'rgba(8,24,56,.75)'; lctx.beginPath(); lctx.arc(0, 0, 19, 0, 7); lctx.fill(); lctx.rotate(na);
    lctx.fillStyle = '#ff5a4d'; lctx.beginPath(); lctx.moveTo(15, 0); lctx.lineTo(-3, -6); lctx.lineTo(-3, 6); lctx.closePath(); lctx.fill();
    lctx.fillStyle = '#fff'; lctx.beginPath(); lctx.moveTo(-15, 0); lctx.lineTo(-3, -6); lctx.lineTo(-3, 6); lctx.closePath(); lctx.fill(); lctx.restore();
    lctx.font = '800 10px Inter,sans-serif'; lctx.fillStyle = '#fff'; lctx.textAlign = 'center'; lctx.fillText('N', ox + Math.cos(na) * 27, oy + Math.sin(na) * 27 + 3.5); lctx.textAlign = 'left'; }
  // readouts
  const br = trueBearing(P.yaw), [e, n] = planToEnu([P.x, P.y]);
  $('#locroom').textContent = rm ? rm.name : 'Passage';
  $('#locface').textContent = `Facing ${CARD8[Math.round(br / 45) % 8]} · ${Math.round(br)}°`;
  $('#locxy').textContent = `CAD  X ${P.x.toFixed(1)} m (${ftIn(P.x)})  ·  Y ${P.y.toFixed(1)} m (${ftIn(P.y)})`;
  $('#locll').textContent = `GPS  ${(PIN0.lat + n / KLAT).toFixed(5)}° N, ${(PIN0.lng + e / KLNG).toFixed(5)}° E  (approx.)`;
  const lt = loc.trail[loc.trail.length - 1]; if (!lt || Math.hypot(lt[0] - P.x, lt[1] - P.y) > .5) { loc.trail.push([P.x, P.y]); if (loc.trail.length > 500) loc.trail.shift(); }
  if (rm !== loc.lastRoom) { if (loc.lastRoom !== null && rm && mode === 'walk') toast(`Entering ${rm.name}`); else if (loc.lastRoom && !rm && mode === 'walk') toast(`Leaving ${loc.lastRoom.name}`); loc.lastRoom = rm || null; }
  drawCompass(br);
}
function locToScreen(x, y) { const v = loc.view, dx = (x - v.cx) * v.k, dy = -(y - v.cy) * v.k, c = Math.cos(v.rot), sn = Math.sin(v.rot); return [v.cw / 2 + c * dx - sn * dy, v.chh / 2 + sn * dx + c * dy]; }
function screenToLoc(px, py) { const v = loc.view, dx = px - v.cw / 2, dy = py - v.chh / 2, c = Math.cos(-v.rot), sn = Math.sin(-v.rot); return [v.cx + (c * dx - sn * dy) / v.k, v.cy - (sn * dx + c * dy) / v.k]; }
locC.onpointerdown = (e) => {
  if (!loc.view || mode !== 'walk') return; const r = locC.getBoundingClientRect(), [x, y] = screenToLoc(e.clientX - r.left, e.clientY - r.top);
  goTo(x, y); e.stopPropagation();
};
$('#locsize').onclick = () => { loc.big = !loc.big; $('#loc').classList.toggle('big', loc.big); needRender = true; };
$('#locmode').onclick = () => { loc.headUp = !loc.headUp; $('#locmode').textContent = loc.headUp ? 'Heading up' : 'Plan up'; needRender = true; };
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1900); }
const compC = $('#compc'), cctx = compC.getContext('2d');
function drawCompass(br) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = compC.clientWidth, h = compC.clientHeight;
  if (compC.width !== Math.round(w * dpr)) { compC.width = Math.round(w * dpr); compC.height = Math.round(h * dpr); }
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0); cctx.clearRect(0, 0, w, h); cctx.textAlign = 'center';
  const ppd = w / 150;                                             // 150 degrees across the strip
  for (let d = Math.ceil((br - 80) / 15) * 15; d <= br + 80; d += 15) { const x = w / 2 + (d - br) * ppd, dd = ((d % 360) + 360) % 360, main = dd % 45 === 0;
    const fadeA = 1 - Math.min(1, Math.abs(d - br) / 78); cctx.globalAlpha = fadeA;
    cctx.fillStyle = dd === 0 ? '#ff5a4d' : '#fff'; cctx.fillRect(x - .75, main ? 4 : 8, 1.5, main ? 9 : 5);
    if (main) { cctx.font = `${dd % 90 === 0 ? 800 : 600} ${dd % 90 === 0 ? 13 : 10.5}px Inter,sans-serif`; cctx.fillText(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][dd / 45], x, 28); } }
  cctx.globalAlpha = 1; cctx.fillStyle = '#f2a24c'; cctx.beginPath(); cctx.moveTo(w / 2, 3); cctx.lineTo(w / 2 - 5, -3); cctx.lineTo(w / 2 + 5, -3); cctx.closePath(); cctx.fill(); cctx.fillRect(w / 2 - 1, 0, 2, 15);
}

function walkPose() {
  const p = W(walk.x, walk.y, EYE); const dir = new THREE.Vector3(Math.cos(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), -Math.sin(walk.yaw) * Math.cos(walk.pitch));
  return { p, t: p.clone().add(dir) };
}
// Clicking Volt's floor: the floors above lift away and you arrive in the lift lobby at eye level, as a visitor would.
async function enterVolt() {
  stopTour(); hoverLevel(-1);
  stage = 'floor'; document.body.dataset.stage = 'floor'; setShell(0);
  controls.minDistance = 2.5; controls.maxDistance = 85; controls.minPolarAngle = .05; controls.maxPolarAngle = 1.38;
  const lob = lobbyPose();
  controls.smoothTime = ST(1.0);
  await controls.setLookAt(lob.x - 2, 16, -(lob.y - CY) + 6, lob.x, 0, -(lob.y - CY), true);   // over the lobby while the floors lift
  controls.smoothTime = ST(.32);
  return enterWalk(null);
}
function lobbyPose() { const [x, y] = nearestFree(LX, LY + 3.4); return { x: x - CX, y, px: x, py: y }; }
async function enterWalk(r) {
  stopTour();
  if (stage !== 'floor') { stage = 'floor'; document.body.dataset.stage = 'floor'; hoverLevel(-1); setShell(0); }
  const rec = ROOMS.find(x => x.name === 'Reception'), start = r || rec;
  let tp = tourPose(start);
  if (!r) { const lb = lobbyPose(); tp = { p: W(lb.px, lb.py, EYE), t: W(rec.cx, rec.cy, 1.2) }; }       // no room asked for: start in the lift lobby
  const [x, y] = toPlan(tp.p), [tx, ty] = toPlan(tp.t);
  const jump = walk.active;                       // already inside: cut with a short fade instead of flying through walls
  if (jump) await fade(true);
  walk.active = false; walk.glide = null; walk.path = null;
  walk.x = x; walk.y = y; walk.yaw = Math.atan2(ty - y, tx - x); walk.pitch = -.07;
  setMode('walk'); setFocus(start);
  const { p, t } = walkPose();
  controls.enabled = true; controls.maxPolarAngle = Math.PI; controls.minDistance = 0.01; controls.setBoundary(null);
  if (jump) { controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false); controls.update(0); needRender = true; await sleep(120); fade(false); }
  else {   // come down inside the room: first above the spot, then straight down, so the camera never passes through a wall
    controls.smoothTime = ST(.7); const dir = t.clone().sub(p).setY(0).normalize();
    await controls.setLookAt(p.x - dir.x * .6, 7.5, p.z - dir.z * .6, p.x + dir.x * 3, 0, p.z + dir.z * 3, true);
    controls.smoothTime = ST(.8); await controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true); controls.smoothTime = ST(.32); }
  if (mode !== 'walk') return;
  controls.enabled = false; walk.active = true; needRender = true;
}
function exitWalk() {
  if (walk.active) { const { p, t } = walkPose(); const far = p.clone().add(t.clone().sub(p).multiplyScalar(4)); controls.setLookAt(p.x, p.y, p.z, far.x, far.y, far.z, false); }
  walk.active = false; controls.enabled = true; controls.minDistance = 2.5; controls.maxPolarAngle = 1.38;
  controls.setBoundary(new THREE.Box3(new THREE.Vector3(bx0 - CX - 2, -1, -(by1 - CY) - 2), new THREE.Vector3(bx1 - CX + 2, 3, -(by0 - CY) + 2)));
}

// look by dragging, glide by clicking the floor
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (mode === 'tour') stopTour();
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId };
  if (walk.active) canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (walk.active) { walk.yaw += dx * .0042; walk.pitch = THREE.MathUtils.clamp(walk.pitch - dy * .0036, -1.1, 1.0); needRender = true; }
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return; const click = drag.moved < 6 && performance.now() - drag.t < 450; drag = null;
  if (!click) return;
  if (stage === 'building') { if (pickLevel(e) === 1) enterVolt(); return; }
  const hit = pickFloor(e); if (!hit) return;
  if (walk.active) goTo(hit[0], hit[1]);
  else if (mode === 'orbit' && stage === 'floor') { const r = roomAt(...hit); if (r) enterWalk(r); }
});
canvas.addEventListener('dblclick', (e) => { if (mode === 'orbit' && stage === 'floor') { const hit = pickFloor(e); const r = hit && roomAt(...hit); if (r) enterWalk(r); } });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickLevel(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(levelMeshes, false)[0]; return h ? h.object.userData.level : -1;
}
canvas.addEventListener('pointermove', (e) => { if (stage === 'building' && mode === 'orbit' && !drag) { const lv = pickLevel(e); if (lv !== hoverLv) hoverLevel(lv); } });
function pickFloor(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
  const t = -ray.ray.origin.y / ray.ray.direction.y; if (!(t > 0)) return null;
  return toPlan(ray.ray.origin.clone().addScaledVector(ray.ray.direction, t));
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  walk.keys[e.code] = true;
  if (e.code === 'Escape') { if ($('#lb').classList.contains('show')) $('#lb').classList.remove('show'); else setMode('orbit', true); }
  if (mode === 'orbit' && !walk.active) {
    if (e.code === 'ArrowRight' && focus) step(1); if (e.code === 'ArrowLeft' && focus) step(-1);
    if (e.code === 'KeyS') $('#b-seats').click(); if (e.code === 'KeyH') $('#b-walls').click();
    if (e.code === 'KeyW') enterWalk(focus); if (e.code === 'KeyE') setMode('elev'); if (e.code === 'KeyT') startTour();
  }
});
addEventListener('keyup', (e) => { walk.keys[e.code] = false; });

// joystick (touch)
const joy = $('#joy'), knob = joy.querySelector('i');
if (MOBILE) joy.style.display = 'block';
joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); joy.dataset.on = 1; moveJoy(e); });
joy.addEventListener('pointermove', (e) => { if (joy.dataset.on === '1') moveJoy(e); });
joy.addEventListener('pointerup', () => { joy.dataset.on = 0; walk.joy = [0, 0]; knob.style.transform = ''; });
function moveJoy(e) { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } walk.joy = [x, -y]; knob.style.transform = `translate(${x * 35}px,${y * 35}px)`; }

function stepWalk(dt) {
  const k = walk.keys; let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + walk.joy[1];
  let s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + walk.joy[0];
  if (k.ArrowLeft) walk.yaw += dt * 1.6; if (k.ArrowRight) walk.yaw -= dt * 1.6;
  let moving = false;
  if (walk.glide) {
    const dx = walk.glide.x - walk.x, dy = walk.glide.y - walk.y, d = Math.hypot(dx, dy);
    const more = walk.path && walk.path.length;
    if (d < (more ? .12 : .05)) { const n = more ? walk.path.shift() : null; walk.glide = n ? { x: n[0], y: n[1] } : null; if (!n) walk.path = null; }
    else { const sp = Math.min(d, (more ? 2.2 : Math.max(1.2, d * 2.2)) * dt); tryMove(dx / d * sp, dy / d * sp) || (walk.glide = null, walk.path = null);
      const want = Math.atan2(dy, dx); let da = want - walk.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); walk.yaw += da * Math.min(1, dt * 3); moving = true; }
  }
  if (f || s) {
    const sp = (k.ShiftLeft ? 3.2 : 1.9) * dt, l = Math.hypot(f, s); f /= Math.max(1, l); s /= Math.max(1, l);
    const dx = (Math.cos(walk.yaw) * f + Math.sin(walk.yaw) * s) * sp, dy = (Math.sin(walk.yaw) * f - Math.cos(walk.yaw) * s) * sp;
    tryMove(dx, dy); moving = true; walk.glide = null; walk.path = null;
  }
  if (k.ArrowLeft || k.ArrowRight) moving = true;
  return moving;
}
function tryMove(dx, dy) {
  if (freeAt(walk.x + dx, walk.y + dy)) { walk.x += dx; walk.y += dy; return true; }
  if (freeAt(walk.x + dx, walk.y)) { walk.x += dx; return true; }
  if (freeAt(walk.x, walk.y + dy)) { walk.y += dy; return true; }
  return false;
}


// ---------------------------------------------------------------- "where to next": arrows to the nearest rooms, turning as you turn
const wayEl = document.getElementById('way'); let wayItems = [], wayAt = [1e9, 1e9, null];
function wayUpdate(force) {
  if (!wayEl) return; if (!(mode === 'walk' && walk.active)) { wayEl.classList.remove('show'); return; }
  const here = roomAt(walk.x, walk.y);
  if (!force && Math.hypot(walk.x - wayAt[0], walk.y - wayAt[1]) < .6 && here === wayAt[2]) return;
  wayAt = [walk.x, walk.y, here]; const F = flood(walk.x, walk.y), cand = [];
  for (const r of RAIL) { if (r === here) continue; const [sx, sy] = clearSpot(r); const pts = pathTo(F, sx, sy); if (!pts) continue; cand.push({ r, sx, sy, pts, d: F.dist[cellOf(sx, sy)[1] * PG.nx + cellOf(sx, sy)[0]] }); }
  cand.sort((a, b) => a.d - b.d); wayItems = cand.slice(0, 4).map(c => { let k = 0, acc = 0; while (k < c.pts.length - 1 && acc < 1.5) { acc += Math.hypot(c.pts[k + 1][0] - c.pts[k][0], c.pts[k + 1][1] - c.pts[k][1]); k++; } const t = c.pts[k]; return { ...c, bx: t[0] - walk.x, by: t[1] - walk.y }; });
  wayEl.innerHTML = '<small>Where to next</small>';
  wayItems.forEach(it => { const b = document.createElement('button'); b.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 3l7 12h-5v6h-4v-6H5z"/></svg><span>${it.r.name.replace(' / command centre', '')}</span><em>${Math.max(1, Math.round(it.d))} m</em>`; b.onclick = () => { goTo(it.sx, it.sy); toast('Walking to ' + it.r.name); }; it.el = b; wayEl.appendChild(b); });
  wayEl.classList.add('show'); wayTurn();
}
function wayTurn() { for (const it of wayItems) { const a = Math.atan2(it.by, it.bx) - walk.yaw, d = Math.atan2(Math.sin(a), Math.cos(a)) * 180 / Math.PI; it.el.firstChild.style.transform = `rotate(${-d}deg)`; it.el.dataset.side = Math.abs(d) < 25 ? 'ahead' : Math.abs(d) > 150 ? 'behind' : d > 0 ? 'left' : 'right'; } }

// ---------------------------------------------------------------- guided tour
let tourI = -1, tourTimer = null;
function tourPose(r) {
  const [ex, ey] = clearSpot(r, [.3, .25]);
  const far = [r.box[0] + r.box[2] - ex, r.box[1] + r.box[3] - ey];
  return { p: W(ex, ey, EYE), t: W((far[0] + r.cx) / 2, (far[1] + r.cy) / 2, 1.0), r };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fade = (on) => { $('#fade').classList.toggle('on', on); return sleep(on ? 520 : 50); };
const OUT = bearingToPlan(146);                    // straight out of the street front
function buildStops() {
  const lobby = nearestFree(LX, LY + 3.4), rec = ROOMS.find(x => x.name === 'Reception');
  const stops = [
    { cap: 'Skymark F-1, Sector 6, Noida', sub: 'Plot F-01 · G+4 · the street front, with the road in front and along the long side', ext: true, p: W(ENTR[0] + OUT[0] * 62 + OUT[1] * 24, ENTR[1] + OUT[1] * 62 - OUT[0] * 24, GROUND + 46), t: W(SF.plate_centroid[0], SF.plate_centroid[1], GROUND + 6) },
    { cap: 'The way in', sub: 'On the drive inside the gate, at the entrance porch', ext: true, cut: true, p: W(ENTR[0] + OUT[0] * 7.5 + OUT[1] * 2.2, ENTR[1] + OUT[1] * 7.5 - OUT[0] * 2.2, GROUND + 1.7), t: W(ENTR[0], ENTR[1], GROUND + 2.9) },
    { cap: 'Lift lobby, first floor', sub: 'Out of the lift, Volt\'s reception is ahead', fade: true, p: W(lobby[0], lobby[1], EYE), t: W(rec.cx, rec.cy, 1.2) },
  ];
  for (const n of TOUR) { const r = ROOMS.find(x => x.name === n); if (r) { const tp = tourPose(r); stops.push({ r, cap: r.name, p: tp.p, t: tp.t }); } }
  return stops;
}
let STOPS = [];
async function startTour() {
  STOPS = buildStops();
  setMode('tour'); controls.enabled = true; controls.maxPolarAngle = Math.PI; controls.minDistance = .01; controls.maxDistance = 400; controls.setBoundary(null);
  stage = 'building'; document.body.dataset.stage = 'building'; setShell(1, true); tourI = -1; nextStop();
}
async function nextStop() {
  if (mode !== 'tour') return;
  tourI++;
  if (tourI >= STOPS.length) { stopTour(); return enterFloor(); }
  const st = STOPS[tourI], { p, t } = st;
  const cap = $('#caption'); cap.style.display = 'block';
  const r = st.r;
  cap.innerHTML = `${st.cap}<small>${r ? (Object.entries(r.by).map(([g, n]) => `${n} ${GN[g]}`).join(' · ') || '') + (DECK[r.name] ? ' · the card has the design render' : '') : st.sub}</small>`;
  setFocus(r || null); $('#card').classList.toggle('show', !!r && !MOBILE && !!DECK[r.name]);
  if (st.fade || st.cut || (r && tourI > 0)) {     // between places that a camera cannot fly between (through walls or neighbours): a short cut
    await fade(true); if (mode !== 'tour') return fade(false);
    if (st.fade) { stage = 'floor'; document.body.dataset.stage = 'floor'; setShell(0, true); }
    controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false); controls.update(0); needRender = true;
    await sleep(200); fade(false);
  } else {
    controls.smoothTime = ST(st.ext ? 1.6 : 1.1);
    await controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true);
    controls.smoothTime = ST(.32);
  }
  updateCrumbs();
  if (mode !== 'tour') return;
  clearTimeout(tourTimer); tourTimer = setTimeout(nextStop, st.ext ? 1800 : 2600);
}
function stopTour() { if (mode !== 'tour') return; clearTimeout(tourTimer); $('#caption').style.display = 'none'; controls.smoothTime = ST(.32); $('#fade').classList.remove('on');
  setMode('orbit', 'stay'); if (stage === 'building') toBuilding(); }
$('#b-tour').onclick = () => mode === 'tour' ? stopTour() : startTour();

// ---------------------------------------------------------------- elevations (orthographic, live section cut)
let elevDir = 'front', elevKind = 'section';
const FACADES = { front: 146, road: 236, rear: 326, side: 56 };   // outward bearing of each face of the real building
const clip = new THREE.Plane();
function elevSetup(first) {
  const n = bearingToPlan(FACADES[elevDir]), dx = -n[0], dy = -n[1];          // looking at that face
  const D = new THREE.Vector3(dx, 0, -dy).normalize();
  const sec = elevKind === 'section';
  const pts = sec ? L.floor[0].outer : L.plate;
  const pr = pts.map(([x, y]) => x * dx + y * dy), pp = pts.map(([x, y]) => -x * dy + y * dx);
  const lo = Math.min(...pr), hi = Math.max(...pr);
  const f = +$('#cut').value / 1000, s = lo + (hi - lo) * f;
  const mid = (Math.min(...pp) + Math.max(...pp)) / 2;
  const S = W(dx * s - dy * mid, dy * s + dx * mid);
  if (sec) { clip.normal.copy(D); clip.constant = -D.dot(S); renderer.clippingPlanes = [clip]; setShell(0, true); }
  else { renderer.clippingPlanes = []; setShell(1, true); bandsG.visible = false; }
  $('#cut').style.display = sec ? '' : 'none';
  $('#cutl').textContent = sec ? `Section cut ${(s - lo).toFixed(1)} m in` : 'Facade of the twin';
  const span = Math.max(...pp) - Math.min(...pp);
  ortho.left = -innerWidth / 2; ortho.right = innerWidth / 2; ortho.top = innerHeight / 2; ortho.bottom = -innerHeight / 2; ortho.updateProjectionMatrix();
  if (first) {
    const cy = sec ? 1.4 : GROUND + (ROOF - GROUND) / 2 + 1.5, F = sec ? S : W(dx * lo - dy * mid, dy * lo + dx * mid);
    const eye = F.clone().addScaledVector(D, -90); eye.y = cy; const tgt = F.clone(); tgt.y = cy;
    ortCtl.setLookAt(eye.x, eye.y, eye.z, tgt.x, tgt.y, tgt.z, false);
    ortCtl.zoomTo(Math.min(innerWidth / (span * (sec ? 1.12 : 1.35)), (innerHeight - (sec ? 0 : 210)) / (sec ? 6 : ROOF - GROUND + 5)), false);
  }
  document.querySelectorAll('#elev [data-d]').forEach(b => b.classList.toggle('on', b.dataset.d === elevDir));
  document.querySelectorAll('#elev [data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === elevKind));
  needRender = true;
}
document.querySelectorAll('#elev [data-d]').forEach(b => b.onclick = () => { elevDir = b.dataset.d; elevSetup(true); });
document.querySelectorAll('#elev [data-k]').forEach(b => b.onclick = () => { elevKind = b.dataset.k; elevSetup(true); });
$('#cut').oninput = () => elevSetup(false);
function drawRuler() {
  const el = $('#ruler'); if (mode !== 'elev') { el.style.display = 'none'; return; } el.style.display = 'block';
  const marks = elevKind === 'section' ? [[0, 'Floor 0.00'], [.75, 'Desk 0.75'], [1.05, 'Rail 1.05'], [H, `Ceiling ${H.toFixed(2)}`]]
    : [[GROUND, 'Ground 0.00'], [0, `First floor +${FTF.toFixed(2)}`], [ROOF, `Roof +${(ROOF - GROUND).toFixed(2)}`], [ROOF + 2, `Parapet +${(ROOF + 2 - GROUND).toFixed(2)}`]];
  el.innerHTML = marks.filter(m => m[1]).map(([h, t]) => { v3.set(0, h, 0); const tgt = ortCtl.getTarget(new THREE.Vector3()); v3.x = tgt.x; v3.z = tgt.z; v3.project(ortho);
    return `<div style="top:${(-v3.y * .5 + .5) * innerHeight}px">${t} m</div>`; }).join('');
}

// ---------------------------------------------------------------- modes
let mode = 'orbit', hintT = 0;
function setMode(m, toOverview) {
  if (mode === 'tour' && m !== 'tour') { clearTimeout(tourTimer); $('#caption').style.display = 'none'; controls.smoothTime = ST(.32); }
  if (mode === 'walk' && m !== 'walk') exitWalk();
  if (mode === 'elev' && m !== 'elev') { renderer.clippingPlanes = []; ortCtl.enabled = false; controls.enabled = true; setShell(stage === 'building' ? 1 : 0, true); }
  mode = m;
  document.body.dataset.mode = m; if (m !== 'walk') wayUpdate();
  $('#walkui').classList.toggle('show', m === 'walk' || m === 'tour');
  if (m === 'walk' || m === 'tour') { loc.trail = []; loc.lastRoom = null; clearTimeout(hintT); $('#hint').classList.remove('gone'); hintT = setTimeout(() => $('#hint').classList.add('gone'), 6000); }
  $('#elev').classList.toggle('show', m === 'elev');
  $('#rail').style.display = m === 'orbit' ? '' : 'none';
  $('#help').style.display = m === 'orbit' ? '' : 'none';
  $('#b-walk').classList.toggle('on', m === 'walk'); $('#b-elev').classList.toggle('on', m === 'elev'); $('#b-tour').classList.toggle('on', m === 'tour');
  $('#b-over').classList.toggle('on', m === 'orbit' && !focus);
  ceiling.visible = m === 'walk' || m === 'tour';
  seatDots.visible = seatDots.visible && m === 'orbit';
  if (m === 'elev') $('#card').classList.remove('show');
  if (m !== 'walk' && m !== 'tour') showHotspots(null);
  setWalls(wallsFull);
  if (m === 'elev') { controls.enabled = false; ortCtl.enabled = true; elevSetup(true); }
  if (m === 'orbit') {
    controls.enabled = true; controls.minDistance = 2.5; controls.maxPolarAngle = 1.38;
    if (stage === 'building') { if (toOverview !== 'stay') toBuilding(); else groundView(false); }
    else if (toOverview === true) overview(); else if (toOverview !== 'stay') { if (focus) flyToRoom(focus); else overview(); }
  }
  document.body.classList.toggle('immersive', m === 'walk' || m === 'tour' || m === 'elev');
  { const fov = (m === 'walk' || m === 'tour') ? 62 : BASE_FOV; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); } }
  updateCrumbs(); shadowsDirty = true; needRender = true;
}
$('#b-plan').onclick = async () => {
  if (stage !== 'floor') await enterFloor(); if (mode !== 'orbit') setMode('orbit', 'stay');
  setFocus(null); seatDots.visible = true; $('#b-seats').classList.add('on');
  const { tgt, dist } = frameView(platePts(), 0, .06, innerWidth > 760);
  controls.moveTo(tgt.x, tgt.y, tgt.z, true); controls.rotateTo(0, .06, true); controls.dollyTo(dist, true);
};
$('#b-over').onclick = () => { if (stage === 'building') { if (mode !== 'orbit') setMode('orbit', 'stay'); enterFloor(); } else setMode('orbit', true); };
const needFloor = async () => { if (stage !== 'floor') { await enterFloor(); } };
$('#b-walk').onclick = async () => { if (mode === 'walk') return setMode('orbit'); await needFloor(); enterWalk(focus); };
$('#b-elev').onclick = async () => { if (mode === 'elev') return setMode('orbit'); elevKind = stage === 'building' ? 'facade' : 'section'; setMode('elev'); };

// ---------------------------------------------------------------- loop
let shadowsDirty = true, lastInput = 0, frameN = 0;
addEventListener('pointerdown', () => { lastInput = performance.now(); }, true); addEventListener('wheel', () => { lastInput = performance.now(); }, true);
const clock = new THREE.Clock();
function resize() {
  renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (mode === 'elev') elevSetup(false); needRender = true;
}
addEventListener('resize', resize);
function frame() {
  const dt = Math.min(.1, clock.getDelta());
  let moved = false;
  if (Math.abs(shellA - shellT) > .002 || Math.abs(upY - upT) > .01) { shellA += (shellT - shellA) * Math.min(1, dt * 3.2); upY += (upT - upY) * Math.min(1, dt * 2.6); applyShell(); moved = true; }
  if (stage === 'building' && mode === 'orbit' && performance.now() - lastInput > 4000) controls.rotate(dt * .035, 0, false);
  if (Math.abs(wallScale - wallTarget) > .001) { wallScale += (wallTarget - wallScale) * Math.min(1, dt * 7); wallsG.scale.y = wallScale; moved = true; shadowsDirty = true; }
  if (walk.active) {
    if (stepWalk(dt)) moved = true;
    const { p, t } = walkPose(); camera.position.copy(p); camera.lookAt(t);
    if ((frameN++ & 15) === 0) { const rr = roomAt(walk.x, walk.y); if (rr && rr !== focus) setFocus(rr); wayUpdate(); } if ((frameN & 3) === 0) wayTurn();
    if (needRender) moved = true;
  } else if (mode === 'elev') { if (ortCtl.update(dt)) moved = true; }
  else if (controls.update(dt)) moved = true;
  if (stage === 'building') { const bv = shellA > .9 && camera.position.y > GROUND + 12; if (bandsG.visible !== bv) { bandsG.visible = bv; moved = true; } }
  { // depth range to suit the view: close planes indoors, far ones over the city (keeps surfaces from shimmering)
    const inside = walk.active || ((mode === 'tour' || mode === 'walk') && camera.position.y < 5);
    const nr = inside ? .05 : stage === 'floor' ? .2 : .8, fr = inside ? 900 : stage === 'floor' ? 1600 : 2600;
    if (camera.near !== nr || camera.far !== fr) { camera.near = nr; camera.far = fr; camera.updateProjectionMatrix(); moved = true; } }
  if (moved) { lastMove = performance.now(); aoDone = false; }
  const still = performance.now() - lastMove > 160;
  if (moved || needRender || (still && !aoDone)) {
    if (shadowsDirty && (still || !moved)) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
    if (mode === 'elev') renderer.render(scene, ortho);
    else if (still && !LITE) { composer.render(); aoDone = true; }
    else if (still) { renderer.render(scene, camera); aoDone = true; }
    else renderer.render(scene, camera);
    updateLabels(); drawRuler(); if (mode === 'walk' || mode === 'tour') drawLoc(); needRender = false;
  }
  requestAnimationFrame(frame);
}
// ---------------------------------------------------------------- one command layer (used by the presenter remote)
const clampN = (v, a = -1, b = 1) => Math.max(a, Math.min(b, +v || 0));
let lastRemoteMove = 0;
const CMD = {
  building: () => { stopTour(); return toBuilding(); },
  entrance: async () => { stopTour(); if (stage !== 'building') await toBuilding(false); entranceView(); },
  place: async (a) => { const q = POIS[a.i | 0]; if (!q) return; stopTour(); if (stage !== 'building') await toBuilding(false); showPlace(q); },
  floor: () => { stopTour(); if (stage !== 'floor') return enterFloor(); setMode('orbit', true); },
  enter: () => enterVolt(),
  room: (a) => { const r = ROOMS.find(x => x.name === a.name); if (r) enterWalk(r); },
  above: async (a) => { const r = ROOMS.find(x => x.name === a.name) || focus; if (!r) return; stopTour(); if (stage !== 'floor') await enterFloor(); if (mode !== 'orbit') setMode('orbit', 'stay');
    seatDots.visible = true; $('#b-seats').classList.add('on'); flyToRoom(r); },
  next: () => step(1), prev: () => step(-1),
  walk: () => enterWalk(focus),
  tour: (a) => { if (a.on === false) stopTour(); else if (mode !== 'tour') startTour(); },
  move: (a) => { walk.joy = [clampN(a.s), clampN(a.f)]; lastRemoteMove = performance.now(); needRender = true; },
  look: (a) => { const dx = clampN(a.dx, -.6, .6), dy = clampN(a.dy, -.6, .6);
    if (walk.active) { walk.yaw -= dx; walk.pitch = THREE.MathUtils.clamp(walk.pitch - dy, -1.1, 1.0); } else if (mode === 'orbit') { lastInput = performance.now(); controls.rotate(-dx, -dy, true); }
    needRender = true; },
  zoom: (a) => { if (mode === 'orbit') { lastInput = performance.now(); controls.dolly(clampN(a.d) * controls.distance * .35, true); } },
  goto: (a) => { if (stage !== 'floor') return; const [fx, fy] = nearestFree(+a.x, +a.y); if (walk.active) goTo(fx, fy); else { const r = roomAt(fx, fy); if (r) enterWalk(r); } },
  tod: (a) => { const t = clampN(a.t, 0, 1); $('#tod').value = Math.round(t * 1000); setTOD(t); },
  plan: () => $('#b-plan').click(), seats: () => $('#b-seats').click(), walls: () => $('#b-walls').click(),
  elev: (a) => { stopTour(); if (a.kind === 'section' || a.kind === 'facade') elevKind = a.kind; if (FACADES[a.dir] !== undefined) elevDir = a.dir;
    if (mode !== 'elev') setMode('elev'); else elevSetup(true); },
  cut: (a) => { if (mode === 'elev') { $('#cut').value = Math.round(clampN(a.f, 0, 1) * 1000); elevSetup(false); } },
  render: (a) => { const lb = $('#lb'); if (a.open === false) { lb.classList.remove('show'); return; }
    if (lb.classList.contains('show')) lb.onclick(); else if (focus && roomImages(focus).length) $('#cimg').onclick(); },
  proof: () => $('#proof').click(),
  reset: () => { stopTour(); $('#lb').classList.remove('show'); return toBuilding(); },
};
function runCommand(t, a) { const f = CMD[t]; if (f) return f(a || {}); }
setInterval(() => { if ((walk.joy[0] || walk.joy[1]) && joy.dataset.on !== '1' && performance.now() - lastRemoteMove > 700) { walk.joy = [0, 0]; } }, 250);   // a dropped link must not leave the walker moving
function helloPayload() {
  return { title: 'Volt · First floor · Skymark F-1', seats: { work: nWork, all: nAll },
    rooms: RAIL.map(r => ({ name: r.name, n: r.total ? (r.by[mainGroup(r)] || r.total) : 0, g: mainGroup(r), box: r.box, img: roomImages(r).length })),
    places: POIS.map(q => ({ name: q.name, kind: q.kind, d: Math.round(q.d) })),
    bp: { img: '/media/noida-skymark/volt/cad_blueprint.png', bounds: BP.bounds }, facades: Object.keys(FACADES) };
}
function remoteState() {
  const inside = stage === 'floor' && (mode === 'walk' || mode === 'tour') && camera.position.y > -1 && camera.position.y < H + .5;
  const p = inside ? locPose() : null;
  return { stage, mode, room: focus ? focus.name : null, tod: Math.round(TOD.t * 100) / 100, lb: $('#lb').classList.contains('show'), seats: seatDots.visible, walls: wallsFull,
    elev: mode === 'elev' ? { kind: elevKind, dir: elevDir } : null, pose: p ? { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, yaw: Math.round(p.yaw * 20) / 20 } : null };
}
$('#b-present').onclick = () => presenter.toggle();
addEventListener('keydown', (e) => { if (e.code === 'KeyP' && e.target.tagName !== 'INPUT' && !walk.active) presenter.toggle(); });

renderer.shadowMap.needsUpdate = true;
scene.fog = new THREE.Fog(0xe7e3dc, 260, 900);
setTOD(TOD.t); setShell(1, true); hoverLevel(-1); document.body.dataset.mode = 'orbit';
await Promise.all([cityP, modelsP, new Promise(ok => { if (bpImg.complete) ok(); else { bpImg.addEventListener('load', ok); bpImg.addEventListener('error', ok); } })]);
shadowsDirty = true;
if (/[#&]floor/.test(location.hash)) { stage = 'floor'; setShell(0, true); document.body.dataset.stage = 'floor'; controls.maxDistance = 85; overview(false); }
else { await toBuilding(false);
  if (!LITE && !matchMedia('(prefers-reduced-motion: reduce)').matches) { controls.rotateTo(BUILDING_VIEW.az + .35, .62, false); controls.dollyTo(controls.distance * 1.8, false);
    setTimeout(() => { if (stage === 'building' && mode === 'orbit') { controls.smoothTime = ST(2.2); toBuilding(true).then(() => { controls.smoothTime = ST(.32); }); } }, 900); } }
controls.update(0); updateCrumbs();
frame();
renderer.render(scene, camera); setTimeout(() => $('#load').classList.add('done'), 60);
setTimeout(() => { $('#load').remove(); }, 900);
function snap(name, fov = 62) {
  const r = ROOMS.find(x => x.name === name); if (!r) return null;
  stage = 'floor'; setShell(0, true); wallsG.scale.y = 1; wallScale = wallTarget = 1; ceiling.visible = true; seatDots.visible = false;
  const tp = tourPose(r), keep = camera.fov; camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.copy(tp.p); camera.lookAt(tp.t); camera.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
  const url = canvas.toDataURL('image/jpeg', .93); camera.fov = keep; camera.updateProjectionMatrix();
  return { url, pose: { x: toPlan(tp.p)[0], y: toPlan(tp.p)[1], tx: toPlan(tp.t)[0], ty: toPlan(tp.t)[1] } };
}
presenter.ready();
if (/[?&]present\b/.test(location.search) && !presenter.on) presenter.toggle();
window.__volt = { RAIL, flood, pathTo, clearSpot, cellOf, PG, goTo, enterVolt, entranceView, presenter, runCommand, remoteState, snap, POIS, showPlace, entranceView, L, ROOMS, controls, flyToRoom, overview, enterWalk, setMode, startTour, stopTour, walk, enterFloor, toBuilding, setTOD, get stage() { return stage; }, get mode() { return mode; }, render: () => { needRender = true; } };
