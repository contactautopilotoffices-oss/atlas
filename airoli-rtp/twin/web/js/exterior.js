// Reliable Tech Park, Airoli: the building and its city, in rtp_local (x east, y north, metres from the Maps pin;
// three (x, y, z) = (x, height, -y)). Two sources:
//   1. the exterior worker's Blender bake (models/exterior/exterior_viewer.json -> building / context / terrain GLBs);
//   2. until that exists (or if it fails), a procedural build from the same data: the CAD facade line (plate.json),
//      floor bands of glass ribbon and silver ACP, the roof drums at the rounded ends, the RELIABLE sign, and the
//      Overture city (review/context_overture.json) with windows, roofs, roads and trees. Never bare grey boxes.
// The building is drawn twice with clipping planes (as the Skymark twin is): the part below the cut stays, the part
// above lifts away for the section.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glassMaterial } from './look.js';

const P = (x, y, h) => new THREE.Vector3(x, h, -y);
const ccw = (ring) => { let A = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; A += a[0] * b[1] - b[0] * a[1]; } return A >= 0 ? ring : ring.slice().reverse(); };
const edges = (ring) => ccw(ring).map((p, i, r) => [p, r[(i + 1) % r.length]]).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > .05);
const shapeOf = (ring) => new THREE.Shape(ccw(ring).map(([x, y]) => new THREE.Vector2(x, y)));
const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
function strip(a, b, h, ht, out, thick) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = Math.sin(ang), ny = -Math.cos(ang);
  return new THREE.BoxGeometry(len + .04, ht, thick).applyMatrix4(new THREE.Matrix4().compose(P((a[0] + b[0]) / 2 + nx * out, (a[1] + b[1]) / 2 + ny * out, h + ht / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1)));
}
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ------------------------------------------------------------------ facade materials (procedural fallback)
function facadeMats() {
  const acp = new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: .32, metalness: .75 });
  const spine = new THREE.MeshStandardMaterial({ color: 0x8d9399, roughness: .45, metalness: .5 });
  const mull = new THREE.MeshStandardMaterial({ color: 0x4d5a60, roughness: .3, metalness: .7 });
  const roof = new THREE.MeshStandardMaterial({ color: 0xb8b2a8, roughness: .95 });
  const drum = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: .35, metalness: .45 });
  const dome = new THREE.MeshStandardMaterial({ color: 0xf2f3f2, roughness: .25, metalness: .2 });
  // the curtain wall: blue-green reflective glass. Seen from outside it must read as glass, not plastic: low opacity
  // face-on (the lit ceilings behind show through), strongly reflective at grazing angles.
  const glass = glassMaterial({ color: 0x4f8f97, opacity: .42, edge: .9, env: 2.4 });
  return { acp, spine, mull, roof, drum, dome, glass };
}

function signTexture() {
  return canvasTex(1024, 192, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.font = '700 132px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,40,40,.9)'; g.shadowBlur = 26; g.fillStyle = '#ff3b3b'; g.fillText('RELIABLE', w / 2, h / 2 + 6);
    g.shadowBlur = 0; g.fillStyle = '#ffd9d9'; g.fillText('RELIABLE', w / 2, h / 2 + 6);
  });
}

// rounded ends of the L: the two plate edges with the tightest curvature clusters (found from the ring, not hard-coded)
function roundEnds(ring) {
  const R = ccw(ring), n = R.length, pts = [];
  for (let i = 0; i < n; i++) { const a = R[(i - 1 + n) % n], b = R[i], c = R[(i + 1) % n];
    const t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])); const turn = Math.min(t, 2 * Math.PI - t);
    if (turn > .02 && turn < .5) pts.push(b); }
  // cluster curved vertices into arcs (gap > 8 m starts a new arc)
  const arcs = []; for (const p of pts) { const a = arcs.find(q => q.some(r => Math.hypot(r[0] - p[0], r[1] - p[1]) < 8)); if (a) a.push(p); else arcs.push([p]); }
  return arcs.filter(a => a.length >= 5).map(a => { const cx = a.reduce((s, p) => s + p[0], 0) / a.length, cy = a.reduce((s, p) => s + p[1], 0) / a.length; return { c: [cx, cy], n: a.length }; })
    .sort((u, v) => v.n - u.n).slice(0, 2);
}

function proceduralBuilding({ plate, outer, levels, ftf, ffl0 }) {
  const M = facadeMats(), g = new THREE.Group(); g.name = 'rtp_building_procedural';
  const ring = outer || plate, BAND = .82, glassG = [], acpG = [], mullG = [];
  for (let lv = 0; lv <= levels; lv++) {
    const z = lv === 0 ? 0 : ffl0 + lv * ftf;
    const top = lv === levels;
    for (const [a, b] of edges(ring)) {
      acpG.push(strip(a, b, z - (lv === 0 ? 0 : .5), lv === 0 ? ffl0 + .25 : BAND, .08, .22));
      if (top) continue;
      const g0 = z + (lv === 0 ? ffl0 + .25 : BAND - .5), ght = (lv === 0 ? ffl0 + ftf : z + ftf) - .5 - g0;
      glassG.push(strip(a, b, g0, ght, 0, .03));
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nM = Math.max(1, Math.round(len / 1.5)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let i = 0; i < nM; i++) { const t = (i + .5) / nM, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        mullG.push(new THREE.BoxGeometry(.06, ght, .14).applyMatrix4(new THREE.Matrix4().compose(P(x + Math.sin(ang) * .06, y - Math.cos(ang) * .06, g0 + ght / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1)))); }
    }
  }
  const H = ffl0 + levels * ftf;
  const gl = new THREE.Mesh(mergeGeometries(glassG), M.glass); gl.renderOrder = 6; gl.name = 'facade_glass';
  const ac = new THREE.Mesh(mergeGeometries(acpG), M.acp); ac.name = 'acp_bands'; ac.castShadow = true; ac.receiveShadow = true;
  const mu = new THREE.Mesh(mergeGeometries(mullG), M.mull); mu.name = 'mullions'; mu.castShadow = true;
  const roofG = new THREE.ExtrudeGeometry(shapeOf(ring), { depth: .5, bevelEnabled: false }); roofG.rotateX(-Math.PI / 2); roofG.translate(0, H, 0);
  const rf = new THREE.Mesh(roofG, M.roof); rf.castShadow = rf.receiveShadow = true; rf.name = 'roof';
  g.add(gl, ac, mu, rf);
  // parapet
  const par = new THREE.Mesh(mergeGeometries(edges(ring).map(([a, b]) => strip(a, b, H, 1.1, .05, .2))), M.acp); par.castShadow = true; g.add(par);
  // roof drums over the rounded ends, the white dome on the larger, the RELIABLE sign on the other
  const ends = roundEnds(plate), signTex = signTexture();
  ends.forEach((e, i) => {
    const dEdge = Math.min(...ccw(plate).map(p => Math.hypot(p[0] - e.c[0], p[1] - e.c[1]))), r = Math.max(4, Math.min(9.5 - i * 1.5, dEdge - 1.2)), hD = 5.5 + (i ? 0 : 1.5);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hD, 64, 1, true), M.drum); drum.position.copy(P(e.c[0], e.c[1], H + .5 + hD / 2)); drum.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r + .05, r + .05, hD * .45, 64, 1, true), M.glass); band.position.copy(drum.position); band.renderOrder = 6;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 64).rotateX(-Math.PI / 2), M.roof); cap.position.copy(P(e.c[0], e.c[1], H + .5 + hD));
    g.add(drum, band, cap);
    if (i === 0) { const dm = new THREE.Mesh(new THREE.SphereGeometry(r * .82, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.dome); dm.position.copy(P(e.c[0], e.c[1], H + .5 + hD)); dm.scale.y = .45; dm.castShadow = true; g.add(dm); }
    else {
      // the sign faces the court (south-west), on the drum's face
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, depthWrite: false }));
      const ang = Math.atan2(-1, -1); sg.position.copy(P(e.c[0] + Math.cos(ang) * (r + .35), e.c[1] + Math.sin(ang) * (r + .35), H + .5 + hD * .72)); sg.rotation.y = ang + Math.PI / 2; sg.renderOrder = 7; sg.name = 'reliable_sign'; g.add(sg);
    }
  });
  g.traverse(o => { if (o.isMesh && !o.material.userData.glass) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, mats: M, height: H };
}

// ------------------------------------------------------------------ the city (procedural fallback)
function wallTex(kind) {
  // a facade with windows: concrete or plaster with punched windows, or glass curtain wall; 1 texture repeat = 3.3 m x 3.3 m
  const base = { plaster: '#d8cdbb', concrete: '#bdb8ae', glass: '#5f7f86', shed: '#c9c4ba', house: '#cfb79b' }[kind];
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${hash(i, 1) < .5 ? '0,0,0' : '255,255,255'},${hash(i, 2) * .05})`; g.fillRect(hash(i, 3) * w, hash(i, 4) * h, 3, 3); }
    if (kind === 'glass') { g.fillStyle = 'rgba(30,45,50,.55)'; g.fillRect(0, 0, w, h * .78); g.fillStyle = 'rgba(200,210,214,.9)'; g.fillRect(0, h * .78, w, h * .22); g.fillStyle = 'rgba(20,30,34,.6)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 3, h * .78); }
    else if (kind === 'shed') { g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h); g.fillStyle = '#5c6568'; g.fillRect(w * .1, h * .25, w * .2, h * .3); }
    else { g.fillStyle = kind === 'house' ? '#3d3a36' : '#3b4548'; g.fillRect(w * .18, h * .3, w * .26, h * .38); g.fillRect(w * .58, h * .3, w * .26, h * .38); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h * .9, w, h * .1); }
  }, [1 / 3.3, 1 / 3.3]);
}
function litTex(kind) {    // night: the same windows, some lit warm
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lit = (x, y, ww, hh, k) => { if (hash(x + k, y) < .55) { g.fillStyle = hash(x, y + k) < .5 ? '#ffd9a0' : '#fff0d0'; g.fillRect(x, y, ww, hh); } };
    if (kind === 'glass') { for (let x = 0; x < w; x += 32) lit(x + 3, 4, 29, h * .74, 3); }
    else if (kind !== 'shed') { lit(w * .18, h * .3, w * .26, h * .38, 1); lit(w * .58, h * .3, w * .26, h * .38, 2); }
  }, [1 / 3.3, 1 / 3.3]);
}
function roofTex(kind) {
  const c = { tin: ['#8d9497', '#6f777a'], terra: ['#a2583c', '#87452e'], slab: ['#b7b0a4', '#9e978b'], shed: ['#a8aeb0', '#8e9597'] }[kind];
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = c[0]; g.fillRect(0, 0, w, h);
    if (kind === 'tin' || kind === 'shed') { g.fillStyle = c[1]; for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 2, h); }
    if (kind === 'terra') { g.fillStyle = c[1]; for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 4; x < w; x += 8) g.fillRect(x, y, 4, 7); }
    if (kind === 'slab') { for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(0,0,0,${hash(i, 9) * .08})`; g.fillRect(hash(i, 7) * w, hash(i, 8) * h, 4, 4); } g.fillStyle = '#e8e6e2'; g.fillRect(w * .62, h * .55, w * .18, h * .18); }
  }, [1 / 8, 1 / 8]);
}

function proceduralCity(ctx, { exclude, r0 = 0, r1 = 650 }) {
  const root = new THREE.Group(); root.name = 'rtp_city_procedural';
  const KINDS = ['plaster', 'concrete', 'glass', 'shed', 'house'], RK = ['tin', 'terra', 'slab', 'shed'];
  const wallM = {}, roofM = {};
  for (const k of KINDS) wallM[k] = new THREE.MeshStandardMaterial({ map: wallTex(k), roughness: k === 'glass' ? .25 : .9, metalness: k === 'glass' ? .3 : 0, emissiveMap: litTex(k), emissive: 0xffffff, emissiveIntensity: 0 });
  for (const k of RK) roofM[k] = new THREE.MeshStandardMaterial({ map: roofTex(k), roughness: .9, metalness: k === 'tin' || k === 'shed' ? .35 : 0 });
  const walls = {}, roofs = {}, tanks = [];
  const inEx = (x, y) => exclude && exclude(x, y);
  for (const b of ctx.buildings || []) {
    const ring = b.ring; if (!ring || ring.length < 4) continue;
    let cx = 0, cy = 0; ring.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= ring.length; cy /= ring.length;
    const r = Math.hypot(cx, cy); if (r < r0 || r > r1 || inEx(cx, cy) || ring.some(p => inEx(p[0], p[1])) || /reliable tech park/i.test(b.name || '')) continue;   // RTP's own footprint is the building itself
    let A = 0; for (let i = 0; i < ring.length - 1; i++) A += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; A = Math.abs(A / 2); if (A < 12) continue;
    // what it is: Overture height/floors, else the surface model reading (clamped), else small housing
    // the 30 m surface model is unreliable here (the Parsik hill slopes read as 80 m "buildings"): it is used only to
    // pick tall office blocks among large footprints, capped; everything else gets storeys by footprint size
    let h = b.height || (b.floors ? b.floors * 3.3 : null), dsm = b.dsm_excess_m || 0;
    const st = (n) => 3.2 * n + .6;
    if (!h) h = A > 2500 ? (dsm > 18 && dsm < 70 && cx < 120 ? Math.min(42, Math.round(dsm / 3.6) * 3.6) : st(2 + Math.floor(hash(cx, cy) * 4)))
      : A > 900 ? st(1 + Math.floor(hash(cx, cy) * 3)) : A > 250 ? st(1 + Math.floor(hash(cx, cy) * 4)) : st(1 + Math.floor(hash(cx, cy) * 2.6));
    const big = A > 1200 && h > 12, east = cx > 115;      // east of Central Road: dense low-rise housing
    const kind = big ? (h > 24 ? 'glass' : 'concrete') : A > 900 ? 'shed' : east || A < 220 ? 'house' : 'plaster';
    const rk = kind === 'shed' ? 'shed' : big || kind === 'plaster' ? 'slab' : hash(cy, 3) < .5 ? 'tin' : hash(cx, 3) < .6 ? 'terra' : 'slab';
    const s = new THREE.Shape(ccw(ring.slice(0, -1)).map(p => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    // split caps (group 0) from sides (group 1); the bottom cap is never seen: drop it
    const ni = geo.index ? geo.toNonIndexed() : geo, pos = ni.attributes.position.array, uv = ni.attributes.uv.array;
    const pick = (gi) => { const gr = geo.groups[gi]; const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos.slice(gr.start * 3, (gr.start + gr.count) * 3), 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv.slice(gr.start * 2, (gr.start + gr.count) * 2), 2)); return out; };
    const side = pick(1), caps = pick(0);
    // keep only the top cap triangles (y = h)
    { const p = caps.attributes.position.array, u = caps.attributes.uv.array, kp = [], ku = [];
      for (let i = 0; i < p.length; i += 9) if (p[i + 1] > h - .01) { kp.push(...p.slice(i, i + 9)); ku.push(...u.slice(i / 3 * 2, i / 3 * 2 + 6)); }
      caps.setAttribute('position', new THREE.Float32BufferAttribute(kp, 3)); caps.setAttribute('uv', new THREE.Float32BufferAttribute(ku, 2)); }
    side.computeVertexNormals(); caps.computeVertexNormals();
    (walls[kind] = walls[kind] || []).push(side); (roofs[rk] = roofs[rk] || []).push(caps);
    if (rk === 'slab' && A > 80 && A < 1500 && hash(cx, cy + 1) < .55) tanks.push([cx + (hash(cx, 2) - .5) * 3, cy + (hash(cy, 2) - .5) * 3, h]);
  }
  for (const [k, list] of Object.entries(walls)) { const m = new THREE.Mesh(mergeGeometries(list), wallM[k]); m.castShadow = true; m.receiveShadow = true; m.name = 'city_walls_' + k; root.add(m); }
  for (const [k, list] of Object.entries(roofs)) { const m = new THREE.Mesh(mergeGeometries(list), roofM[k]); m.receiveShadow = true; m.name = 'city_roofs_' + k; root.add(m); }
  // terrace water tanks (black Sintex drums), the city's most recognisable roof detail
  if (tanks.length) { const tg = new THREE.CylinderGeometry(.75, .75, 1.3, 12).translate(0, .65, 0), im = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x202224, roughness: .6 }), tanks.length);
    tanks.forEach(([x, y, h], i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, h, -y))); im.castShadow = true; root.add(im); }
  return { root, wallM };
}

function groundAndRoads(ctx, { exclude }) {
  const root = new THREE.Group(); root.name = 'rtp_ground';
  const dust = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b9ac95'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${hash(i, 1) < .5 ? '90,80,60' : '230,220,200'},${hash(i, 2) * .12})`; g.fillRect(hash(i, 3) * w, hash(i, 4) * h, 2 + hash(i, 5) * 5, 2 + hash(i, 6) * 5); } }, [90, 90]);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: dust, roughness: 1 }));
  ground.receiveShadow = true; ground.name = 'ground'; root.add(ground);
  // green areas (Overture) slightly above the ground; roads above both; markings above roads (no coplanar pairs)
  const grass = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#6f8a4c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(${hash(i, 1) < .5 ? '40,60,25' : '150,170,100'},${hash(i, 2) * .2})`; g.fillRect(hash(i, 3) * w, hash(i, 4) * h, 2, 2); } }, [1 / 6, 1 / 6]);
  const gg = []; for (const z of (ctx.green || []).filter(z => { let A = 0; const r = z.ring; for (let i = 0; i < r.length - 1; i++) A += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(A / 2) < 4e5; })) { const s = new THREE.Shape(ccw(z.ring.slice(0, -1)).map(p => new THREE.Vector2(p[0], p[1]))); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.translate(0, .04, 0); gg.push(g); }
  if (gg.length) { const m = new THREE.Mesh(mergeGeometries(gg), new THREE.MeshStandardMaterial({ map: grass, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.receiveShadow = true; root.add(m); }
  const W = { primary: 24, trunk: 24, secondary: 15, tertiary: 11, residential: 6.5, unclassified: 6.5, living_street: 5, service: 4.5, track: 3.5, footway: 2, path: 2, steps: 2 };
  const asphalt = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#3d3f41'; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${hash(i, 1) < .5 ? '0,0,0' : '255,255,255'},${hash(i, 2) * .06})`; g.fillRect(hash(i, 3) * w, hash(i, 4) * h, 2, 2); } }, [1 / 8, 1 / 8]);
  const byW = {}; const marks = [], medians = [], lamps = [], trees = [];
  for (const r of ctx.roads || []) {
    const w = W[r.class] || 5, L = r.line; if (!L || L.length < 2) continue;
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i], b = L[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < .3) continue;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      (byW[w] = byW[w] || []).push(new THREE.PlaneGeometry(len + w * .5, w).rotateX(-Math.PI / 2).applyMatrix4(new THREE.Matrix4().compose(P(mx, my, .06 + w * .0006), q, new THREE.Vector3(1, 1, 1))));
      if (w >= 15) {           // divided arterial: planted median, dashed lane lines, street lamps both sides
        medians.push(new THREE.BoxGeometry(len, .25, 1.6).applyMatrix4(new THREE.Matrix4().compose(P(mx, my, .18), q, new THREE.Vector3(1, 1, 1))));
        for (let s = 0; s < len; s += 9) { const t = s / len, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
          for (const off of [-w * .25, w * .25]) marks.push(new THREE.PlaneGeometry(3, .15).rotateX(-Math.PI / 2).applyMatrix4(new THREE.Matrix4().compose(P(x + Math.sin(ang) * off, y - Math.cos(ang) * off, .12), q, new THREE.Vector3(1, 1, 1))));
          if (s % 36 < 9) for (const side of [-1, 1]) lamps.push([x + Math.sin(ang) * side * (w / 2 + 1), y - Math.cos(ang) * side * (w / 2 + 1), ang]);
          if (s % 18 < 9) trees.push([x, y, 'median']); }
      } else if (w >= 6.5) { for (let s = 4; s < len; s += 14) { const t = s / len, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, side = hash(x, y) < .5 ? -1 : 1;
          const tx = x + Math.sin(ang) * side * (w / 2 + 1.6), ty = y - Math.cos(ang) * side * (w / 2 + 1.6); if (!(exclude && exclude(tx, ty))) trees.push([tx, ty, 'street']);
          if (hash(y, x) < .25) lamps.push([x + Math.sin(ang) * -side * (w / 2 + .5), y - Math.cos(ang) * -side * (w / 2 + .5), ang]); } }
    }
  }
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: .92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const [w, list] of Object.entries(byW)) { const m = new THREE.Mesh(mergeGeometries(list), roadMat); m.receiveShadow = true; m.name = 'roads_' + w; root.add(m); }
  if (marks.length) root.add(new THREE.Mesh(mergeGeometries(marks), new THREE.MeshStandardMaterial({ color: 0xe9e5da, roughness: .7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
  if (medians.length) { const m = new THREE.Mesh(mergeGeometries(medians), new THREE.MeshStandardMaterial({ color: 0xa9a49a, roughness: .9 })); m.receiveShadow = true; root.add(m); }
  return { root, lamps, trees };
}

// trees: rain trees and palms as instanced low-poly forms (two materials so they read at a distance)
function treesMesh(list) {
  const root = new THREE.Group(); if (!list.length) return root;
  const trunk = new THREE.CylinderGeometry(.18, .28, 1, 6).translate(0, .5, 0), crown = new THREE.IcosahedronGeometry(1, 1);
  const palmT = new THREE.CylinderGeometry(.14, .2, 1, 6).translate(0, .5, 0), frond = new THREE.ConeGeometry(1, .6, 7).translate(0, -.1, 0);
  const tm = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 }), cm = new THREE.MeshStandardMaterial({ color: 0x4f6b35, roughness: .95, flatShading: true }), pm = new THREE.MeshStandardMaterial({ color: 0x5f7d3a, roughness: .9, flatShading: true });
  const rain = list.filter(t => t[2] !== 'palm'), palm = list.filter(t => t[2] === 'palm');
  const I = (geo, mat, arr, f) => { const im = new THREE.InstancedMesh(geo, mat, arr.length); arr.forEach((t, i) => im.setMatrixAt(i, f(t))); im.castShadow = true; im.receiveShadow = true; root.add(im); };
  const sc = (t) => .8 + hash(t[0], t[1]) * .7;
  I(trunk, tm, rain, t => new THREE.Matrix4().compose(P(t[0], t[1], 0), new THREE.Quaternion(), new THREE.Vector3(1, 3.2 * sc(t), 1)));
  I(crown, cm, rain, t => new THREE.Matrix4().compose(P(t[0], t[1], 3.2 * sc(t) + 1.6 * sc(t)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hash(t[1], t[0]) * 6, 0)), new THREE.Vector3(2.6 * sc(t), 1.9 * sc(t), 2.6 * sc(t))));
  I(palmT, tm, palm, t => new THREE.Matrix4().compose(P(t[0], t[1], 0), new THREE.Quaternion(), new THREE.Vector3(1, 7.5 * sc(t), 1)));
  I(frond, pm, palm, t => new THREE.Matrix4().compose(P(t[0], t[1], 7.5 * sc(t) + .2), new THREE.Quaternion(), new THREE.Vector3(3 * sc(t), 1.2, 3 * sc(t))));
  return root;
}
function lampsMesh(list) {
  const root = new THREE.Group(); if (!list.length) return { root, glow: null };
  const pole = new THREE.CylinderGeometry(.08, .1, 9, 6).translate(0, 4.5, 0), head = new THREE.BoxGeometry(1.4, .18, .4).translate(.6, 9, 0);
  const pm = new THREE.MeshStandardMaterial({ color: 0x6b6f72, roughness: .5, metalness: .6 }), glow = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xffc982, emissiveIntensity: 0 });
  const a = new THREE.InstancedMesh(pole, pm, list.length), b = new THREE.InstancedMesh(head, glow, list.length);
  list.forEach(([x, y, ang], i) => { const m = new THREE.Matrix4().compose(P(x, y, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang + Math.PI / 2), new THREE.Vector3(1, 1, 1)); a.setMatrixAt(i, m); b.setMatrixAt(i, m); });
  root.add(a, b); return { root, glow };
}

// ------------------------------------------------------------------ the Blender bake: materials, AO lightmaps, day/night emission
// exterior_viewer.json (airoli-rtp/exterior/tools/write_viewer_json.py): files.rtp_building/context/terrain.file;
// lightmapped_meshes.nodes[name] = {lightmap: lightmaps/<atlas>_day.jpg, lightMapIntensity, uv: 1}; every material carries
// glTF extras {emit_day, emit_night} (the states' emissive levels). The day lightmap holds the midday sun, which would be
// wrong at golden hour and at night, so the page uses the same atlas's AO map (<atlas>_ao.jpg, sun-independent) with the
// live sun and sky instead: one bake, every time of day.
const NIGHT_RX = /interior|sign_|emit|lamp|house_wall|block_wall|glass_curtain|punched/i;
function emitLevels(m, manifest) {
  const u = m.userData || {};
  if (typeof u.emit_day === 'number' || typeof u.emit_night === 'number') return [u.emit_day || 0, u.emit_night || 0];
  const st = manifest && manifest.states, d = st && (st.midday || st.morning), n = st && (st.night || st.blue_hour);
  const nm = m.name || '';
  const look = (s) => { if (!s) return null; for (const [k, v] of Object.entries(s.emissive_intensity || {})) {
    if (v && typeof v === 'object') { const pre = k.replace(/Lnn$/, ''), mm = nm.match(/_L(\d\d)$/); if (nm.startsWith(pre) && mm && v['L' + mm[1]] !== undefined) return v['L' + mm[1]]; continue; }
    if (k.split('|').some(x => nm === x || nm.startsWith(x + '_') || nm.startsWith(x))) return v; } return null; };
  const a = look(d), b = look(n); if (a === null && b === null) return null; return [a || 0, b || 0];
}
async function prepBake(root, manifest, base, { glassFor }) {
  const nodes = (manifest.lightmapped_meshes && manifest.lightmapped_meshes.nodes) || {}, tl = new THREE.TextureLoader(), cache = {};
  const aoTex = (url) => cache[url] || (cache[url] = tl.loadAsync(base + url).then(t => { t.flipY = false; t.channel = 1; t.colorSpace = THREE.NoColorSpace; return t; }).catch(() => null));
  const jobs = [];
  root.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    o.material = [].concat(o.material).map(m => {
      if (/glass/i.test(m.name || '')) { o.renderOrder = 6; o.castShadow = false; return glassFor(m.name); }
      if (m.userData && m.userData.polygonOffset || /road_marking/.test(m.name || '')) { m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4; }
      return m; });
    if (o.material.length === 1) o.material = o.material[0];
    // lightmapped node: this mesh or a parent carries the node name
    let p = o, info = null; while (p && !info) { info = nodes[p.name]; p = p.parent; }
    if (info && info.lightmap) { const url = info.lightmap.replace(/_day\.(jpg|png)$/, '_ao.jpg');
      jobs.push(aoTex(url).then(t => { if (!t) return; for (const m of [].concat(o.material)) { if (m.userData && m.userData.glass) continue; m.aoMap = t; m.aoMapIntensity = 1; m.needsUpdate = true; } })); }
  });
  await Promise.all(jobs);
}
function collectNight(roots, manifest) {
  const out = []; const seen = new Set();
  for (const r of roots) r.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (seen.has(m) || !('emissiveIntensity' in m)) continue;
    const lv = emitLevels(m, manifest) || (NIGHT_RX.test(m.name || '') || m.emissiveMap ? [m.emissiveMap ? .25 : 0, 2.5] : null); if (!lv) continue; seen.add(m); m.userData.emitDN = lv; out.push(m); } });
  return out;
}

// ------------------------------------------------------------------ public: load (bake if delivered, else procedural)
export async function loadExterior(loader, { plate, outer, levels, ftf, ffl0, base = 'models/exterior/', ctxUrl = 'context_overture.json', forceProcedural = false }) {
  const frame = new THREE.Group(); frame.name = 'exteriorFrame';
  const cutLow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4), cutHigh = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1e4);
  let manifest = null, source = 'procedural';
  if (!forceProcedural) { try { const r = await fetch(base + 'exterior_viewer.json', { cache: 'no-cache' }); if (r.ok) manifest = await r.json(); } catch (e) { } }
  // both manifest shapes: top-level building/context/terrain, or files.rtp_*.file (the exterior worker's writer)
  const F = (manifest && manifest.files) || {};
  const URLS = manifest ? { building: manifest.building || (F.rtp_building && F.rtp_building.file), context: manifest.context || (F.rtp_context && F.rtp_context.file), terrain: manifest.terrain || (F.rtp_terrain && F.rtp_terrain.file) } : {};
  const glassCache = {};
  const glassFor = (name) => glassCache[name] || (glassCache[name] = (() => { const g = glassMaterial({ color: /L0[46]$/.test(name || '') ? 0x5a9fb0 : 0x4f8f97, opacity: /rail/.test(name || '') ? .25 : .5, edge: .92, env: 2.4 }); g.name = name; return g; })());
  let low = null, high, nightMats = [];
  const clipAll = (root, plane) => { const cache = new Map(); root.traverse(o => { if (!o.isMesh) return; o.material = [].concat(o.material).map(m => { if (cache.has(m.uuid)) return cache.get(m.uuid); const c = m.clone(); c.userData = { ...m.userData }; if (m.onBeforeCompile) { c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; } c.clippingPlanes = [plane]; cache.set(m.uuid, c); return c; }); if (o.material.length === 1) o.material = o.material[0]; }); };
  if (URLS.building) {
    try { const g = await loader.loadAsync(base + URLS.building); await prepBake(g.scene, manifest, base, { glassFor }); low = g.scene; source = 'Blender bake (' + URLS.building + ')'; }
    catch (e) { console.warn('[rtp] building GLB failed, procedural instead', e); low = null; }
  }
  let proc = null;
  if (!low) { proc = proceduralBuilding({ plate, outer, levels, ftf, ffl0 }); low = proc.group; }
  high = low.clone(true); clipAll(low, cutLow); clipAll(high, cutHigh); high.visible = false;
  frame.add(low, high);
  nightMats.push(...collectNight([low, high], manifest));        // the clones that are actually drawn
  const H = proc ? proc.height : ffl0 + levels * ftf;
  // inside the L's footprint (for excluding city buildings and trees that the footprint data double-counts)
  const ringIn = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const near = (x, y) => ringIn(outer || plate, x, y) || (outer || plate).some(p => Math.hypot(p[0] - x, p[1] - y) < 4);
  // night uplights at RTP's base (pink / violet, as in the photos): a few spot lights, desktop only
  const up = new THREE.Group(); up.name = 'uplights'; frame.add(up);
  const api = { frame, low, high, cutLow, cutHigh, cutY: 1e4, source, manifest, height: H, nightMats, cityWalls: null, lampGlow: null, uplights: up,
    footprint: [[-2000, -2000], [2000, -2000], [2000, 2000], [-2000, 2000]], outer,
    envUrl(night) { const st = manifest && manifest.states; const s = st && (night ? (st.night || st.blue_hour) : (st.midday || st.morning)); return s && s.env_map ? base + s.env_map : null; },
    setCut(y) { api.cutY = y; cutLow.constant = y; cutHigh.constant = -y; },
    async context() {
      const grp = new THREE.Group(); grp.name = 'context';
      if (URLS.context) {
        try { const g = await loader.loadAsync(base + URLS.context); await prepBake(g.scene, manifest, base, { glassFor }); grp.add(g.scene);
          if (URLS.terrain) { const t = await loader.loadAsync(base + URLS.terrain).catch(() => null); if (t) { await prepBake(t.scene, manifest, base, { glassFor }); grp.add(t.scene); } }
          nightMats.push(...collectNight([g.scene], manifest)); frame.add(grp); return grp; } catch (e) { console.warn('[rtp] context GLB failed, procedural instead', e); }
      }
      const ctx = await (await fetch(ctxUrl)).json();
      const city = proceduralCity(ctx, { exclude: near }); grp.add(city.root); api.cityWalls = city.wallM;
      const gr = groundAndRoads(ctx, { exclude: near }); grp.add(gr.root);
      // the court: palms along the inner (south-west) faces of the L
      const court = []; const R = outer || plate, xs = R.map(p => p[0]), ys = R.map(p => p[1]);
      for (let i = 0; i < 60; i++) { const x = Math.min(...xs) + hash(i, 1) * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + hash(i, 2) * (Math.max(...ys) - Math.min(...ys)); if (!near(x, y) && !ringIn(R, x, y) && x < 25 && y < 80) court.push([x, y, 'palm']); }
      grp.add(treesMesh([...gr.trees, ...court]));
      const lm = lampsMesh(gr.lamps); grp.add(lm.root); api.lampGlow = lm.glow;
      frame.add(grp); return grp;
    },
    // 0 = day ... 1 = night: interiors, the sign, city windows and street lamps come on (levels from the bake's extras)
    setNight(k) {
      if (api.cityWalls) for (const m of Object.values(api.cityWalls)) m.emissiveIntensity = k * 1.1;
      if (api.lampGlow) api.lampGlow.emissiveIntensity = k * 3;
      for (const m of nightMats) { const [d, n] = m.userData.emitDN || [0, 1]; m.emissiveIntensity = d + (n - d) * k; }
      up.visible = k > .05; up.children.forEach(l => { if (l.isSpotLight) l.intensity = l.userData.i * k; });
    },
    addUplights(enabled) {
      if (!enabled || up.children.length) return;
      const R = ccw(outer || plate), cols = [0xff40bf, 0x8c47ff]; let acc = 0, n = 0;
      for (const [a, b] of edges(R)) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += len; if (acc < 26 || n >= 8) continue; acc = 0;
        // only the court-facing (south / west) faces: outward normal pointing to -x or -y
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = Math.sin(ang), ny = -Math.cos(ang); if (nx > .3 && ny > -.3) continue;
        const mx = (a[0] + b[0]) / 2 + nx * 2.5, my = (a[1] + b[1]) / 2 + ny * 2.5, L = new THREE.SpotLight(cols[n % 2], 0, 40, .45, .6, 1.2);
        L.position.copy(P(mx, my, .4)); L.target.position.copy(P(mx - nx * 2, my - ny * 2, 24)); L.userData.i = 900; up.add(L, L.target); n++; }
    },
  };
  return api;
}
