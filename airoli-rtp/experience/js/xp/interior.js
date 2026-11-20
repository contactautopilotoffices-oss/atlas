// Semantic architecture is loaded from the frozen FreeCAD export. Furniture is retained only
// where its original block position matches CAD. Materials and heights keep their assumptions.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchMaterial, ffl, fetchJSON, fetchBytes } from './core.js';

// Source-faithful architecture. The GLB already carries the CAD-to-local plan transform;
// only the storey elevation is added here. Never rebuild walls from the legacy 2D layout.
export async function loadSemanticInterior(layout, { level = 6 } = {}) {
  const base = '../interior-semantic/web/';
  const manifest = await fetchJSON(base + 'manifest.json');
  const bytes = await fetchBytes(base + manifest.asset.glb, (manifest.asset.mb || 6.4) * 1e6);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const asset = await new Promise((resolve, reject) => loader.parse(bytes, base, resolve, reject));
  const root = new THREE.Group();
  root.name = 'level6_semantic_CAD';
  root.position.y = Number(manifest.ffl_above_ground_m?.value ?? ffl(level));
  root.add(asset.scene);
  const ceilingMeshes = [], reviewMarkers = [], reviewGeometry = [], unsettledMeshes = [];
  const normalMaterial = (key) => key === 'glass' ? new THREE.MeshPhysicalMaterial({
    name: 'PRESENTATION_ASSUMPTION_glass', color: 0xc7dde0, transparent: true, opacity: .24,
    roughness: .075, metalness: .12, ior: 1.5, depthWrite: false,
  }) : new THREE.MeshStandardMaterial({
    name: 'PRESENTATION_ASSUMPTION_' + key,
    color: key === 'timber' ? 0xa77c50 : key === 'aluminium' ? 0x414a50 : /stud|brick|rcc/.test(key) ? 0xb9b6ae : 0xe8e6df,
    roughness: key === 'aluminium' ? .38 : .72, metalness: key === 'aluminium' ? .65 : 0,
  });
  asset.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    const layer = o.userData.layer || o.name;
    o.userData.sourceGeometry = 'FreeCAD CAD tessellation';
    if (layer === 'REVIEW_markers') {
      reviewMarkers.push(o); o.castShadow = false; return;
    }
    if (layer.startsWith('False_ceiling')) ceilingMeshes.push(o);
    if (layer.startsWith('Walls_UNSETTLED')) unsettledMeshes.push(o);
    const mats = [].concat(o.material).map(m => {
      const result = m.clone();
      if (/glass/i.test(result.name)) {
        result.color.set('#c7dde0'); result.transparent = true; result.opacity = .24;
        result.roughness = .075; result.metalness = .12; result.depthWrite = false;
        result.envMapIntensity = 1.2; o.castShadow = false; o.renderOrder = 4;
      } else if (/floor_neutral/.test(result.name)) {
        result.color.set('#a5a7a6'); result.roughness = .86;
      }
      return patchMaterial(result);
    });
    o.material = mats.length === 1 ? mats[0] : mats;
    if (o.userData.material_key === 'glass') { o.castShadow = false; o.renderOrder = 4; }
    if (o.userData.review) {
      reviewGeometry.push({ mesh: o, review: o.material,
        presentation: patchMaterial(normalMaterial(o.userData.material_key || 'paint')) });
    }
  });
  const unknownMaterials = unsettledMeshes.map(mesh => ({ mesh, review: mesh.material,
    presentation: patchMaterial(normalMaterial('unsettled_visual_assumption')) }));
  const setReviewMode = (enabled) => {
    reviewMarkers.forEach(o => { o.visible = !!enabled; });
    for (const r of [...reviewGeometry, ...unknownMaterials]) r.mesh.material = enabled ? r.review : r.presentation;
    root.userData.reviewMode = !!enabled;
  };
  const setCeiling = (visible) => {
    ceilingMeshes.forEach(o => { o.visible = !!visible; });
    root.userData.ceilingVisible = !!visible;
  };
  Object.assign(root.userData, { manifest, ceilingMeshes, reviewMarkers, setReviewMode, setCeiling,
    counts: manifest.counts, status: manifest.status, source: manifest.sources,
    note: 'Finishes are visual assumptions. Geometry checks do not certify default design dimensions.' });
  root.userData.elementAt = (hit) => {
    const attr = hit?.object?.geometry?.getAttribute('_element');
    if (!attr || !hit.face) return null;
    const index = Math.round(attr.getX(hit.face.a));
    return index >= 0 ? manifest.elements[index] || null : null;
  };
  setReviewMode(false); setCeiling(false);
  try {
    const furniture = await fetchJSON(base + 'furniture.json');
    root.add(buildMatchedFurniture(furniture));
    root.userData.furnitureCounts = { seats: furniture.seats.length, desks: furniture.desks.length };
  } catch (error) { console.warn('[semantic interior] CAD-matched furniture unavailable:', error.message); }
  return root;
}

// Lightweight web proxies only for the furniture retained by the CAD alignment check.
// Coordinates/orientations are from the editable Blender scene; no seats are added.
function buildMatchedFurniture(data) {
  const root = new THREE.Group(); root.name = 'Furniture_CAD_matched_visual_proxies';
  const desk = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xe4dfd3, roughness: .62 }));
  const metal = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x676d70, metalness: .4, roughness: .5 }));
  const chair = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x353e44, roughness: .85 }));
  const screen = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x1d2932, roughness: .3 }));
  const Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), M = new THREE.Matrix4();
  function instances(records, geometry, material, getPose) {
    if (!records.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    mesh.castShadow = mesh.receiveShadow = true;
    records.forEach((record, i) => {
      const { position, scale = [1, 1, 1] } = getPose(record);
      q.setFromAxisAngle(Y, record.a || 0);
      M.compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale));
      mesh.setMatrixAt(i, M);
    });
    mesh.userData.source = data.about; root.add(mesh);
  }
  instances(data.desks, new THREE.BoxGeometry(1, .035, 1), desk,
    r => ({ position: [r.x, .75, -r.y], scale: [r.w, 1, r.d] }));
  instances(data.desks, new THREE.BoxGeometry(1, .68, .035), metal,
    r => ({ position: [r.x, .39, -r.y], scale: [r.w * .85, 1, 1] }));
  instances(data.desks, new THREE.BoxGeometry(.5, .32, .025), screen,
    r => ({ position: [r.x, .97, -r.y] }));
  instances(data.seats, new THREE.BoxGeometry(.48, .08, .46), chair,
    r => ({ position: [r.x, .46, -r.y] }));
  instances(data.seats, new THREE.BoxGeometry(.46, .46, .06), chair,
    r => ({ position: [r.x + Math.sin(r.a || 0) * .2, .73, -r.y + Math.cos(r.a || 0) * .2] }));
  return root;
}

const shape = (ring, holes = []) => { const s = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))); for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))); return s; };
// ShapeGeometry / ExtrudeGeometry live in the x-y plane; turn them so plan y (north) becomes three -z, then lift
const toWorld = (g, h) => { g.rotateX(-Math.PI / 2); g.translate(0, h, 0); return g; };

function panelTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#fff'; g.fillRect(96, 96, 64, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 2.4, 1 / 2.4); t.anisotropy = 16; return t;
}

export function buildInterior(layout, { level = 6 } = {}) {
  const root = new THREE.Group(); root.name = 'level6_interior';
  const z0 = ffl(level), CH = (layout.heights && layout.heights.ceiling) || 3.05;
  const mat = {
    carpet: patchMaterial(new THREE.MeshStandardMaterial({ color: 0x4f5357, roughness: .96 })),
    ceiling: patchMaterial(new THREE.MeshStandardMaterial({ color: 0xe6e4df, roughness: .9, emissive: 0xfff4e6, emissiveMap: panelTexture(), emissiveIntensity: 1.4, side: THREE.DoubleSide })),
    wall: patchMaterial(new THREE.MeshStandardMaterial({ color: 0xdcd9d2, roughness: .85 })),
    desk: patchMaterial(new THREE.MeshStandardMaterial({ color: 0xd9d1c2, roughness: .55 })),
    leg: patchMaterial(new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: .5, metalness: .5 })),
    screen: patchMaterial(new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .3, metalness: .2, emissive: 0x9fb6d6, emissiveIntensity: .08 })),
    chair: patchMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: .8 })),
    glass: patchMaterial(new THREE.MeshStandardMaterial({ color: 0xcfe0de, roughness: .05, metalness: 0, transparent: true, opacity: .14, depthWrite: false })),
  };
  // floor and ceiling from the floor outline
  for (const f of layout.floor || []) {
    const s = shape(f.outer, f.holes || []);
    const fl = new THREE.Mesh(toWorld(new THREE.ShapeGeometry(s), z0 + .025), mat.carpet); fl.receiveShadow = true; root.add(fl);
    const ce = new THREE.Mesh(toWorld(new THREE.ShapeGeometry(s), z0 + CH), mat.ceiling); ce.receiveShadow = true; root.add(ce);
  }
  // walls and columns
  const wg = [];
  for (const w of layout.walls || []) { try { wg.push(toWorld(new THREE.ExtrudeGeometry(shape(w.outer, w.holes || []), { depth: CH, bevelEnabled: false }), z0)); } catch (e) { /* degenerate */ } }
  for (const c of layout.columns || []) { try { wg.push(toWorld(new THREE.ExtrudeGeometry(shape(c), { depth: CH, bevelEnabled: false }), z0)); } catch (e) { } }
  if (wg.length) { const m = new THREE.Mesh(mergeGeometries(wg.map(g => g.index ? g.toNonIndexed() : g)), mat.wall); m.castShadow = m.receiveShadow = true; root.add(m); }
  // glass partitions (each CAD line once)
  const seen = new Set(), gg = [];
  for (const [x1, y1, x2, y2] of layout.glass || []) {
    const k = [x1, y1, x2, y2].map(v => Math.round(v * 5)).join(','), k2 = [x2, y2, x1, y1].map(v => Math.round(v * 5)).join(',');
    if (seen.has(k) || seen.has(k2)) continue; seen.add(k);
    const L = Math.hypot(x2 - x1, y2 - y1); if (L < .2) continue;
    const g = new THREE.BoxGeometry(L, CH - .05, .012); g.rotateY(Math.atan2(y2 - y1, x2 - x1)); g.translate((x1 + x2) / 2, z0 + CH / 2, -(y1 + y2) / 2); gg.push(g);
  }
  if (gg.length) { const m = new THREE.Mesh(mergeGeometries(gg), mat.glass); m.renderOrder = 5; root.add(m); }
  // desks, screens and chairs, instanced
  const desks = layout.desks || [], seats = layout.seats || [];
  const top = new THREE.BoxGeometry(1, .03, 1), panel = new THREE.BoxGeometry(1, .62, .018), scr = new THREE.BoxGeometry(.56, .34, .025);
  const seatG = new THREE.BoxGeometry(.48, .07, .46), backG = new THREE.BoxGeometry(.46, .5, .05);
  const I = (g, m, n) => { const im = new THREE.InstancedMesh(g, m, n); im.castShadow = true; im.receiveShadow = true; root.add(im); return im; };
  const iTop = I(top, mat.desk, desks.length), iPan = I(panel, mat.leg, desks.length), iScr = I(scr, mat.screen, desks.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  // the chair grid for a quick nearest-chair lookup (the screen faces the chair)
  const cell = 2, grid = new Map(); seats.forEach((s, i) => { const k = Math.floor(s.x / cell) + ',' + Math.floor(s.y / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); });
  const nearest = (x, y) => { let best = null, bd = 9; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of grid.get((Math.floor(x / cell) + i) + ',' + (Math.floor(y / cell) + j)) || []) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } } return best; };
  desks.forEach((d, i) => {
    const h = d.h || .75, a = d.a || 0; q.setFromAxisAngle(Y, a);
    M.compose(v.set(d.c[0], z0 + h, -d.c[1]), q, sc.set(d.w, 1, d.d)); iTop.setMatrixAt(i, M);
    // the screen and the modesty panel sit on the far side from this desk's chair
    const s = nearest(d.c[0], d.c[1]); let bx = -Math.sin(a), by = Math.cos(a);
    if (s) { const dx = d.c[0] - s.x, dy = d.c[1] - s.y; if (dx * bx + dy * by < 0) { bx = -bx; by = -by; } }
    const off = d.d * .5 - .04;
    M.compose(v.set(d.c[0] + bx * off, z0 + h - .32, -(d.c[1] + by * off)), q, sc.set(d.w * .96, 1, 1)); iPan.setMatrixAt(i, M);
    M.compose(v.set(d.c[0] + bx * (off - .12), z0 + h + .22, -(d.c[1] + by * (off - .12))), q, sc.set(1, 1, 1)); iScr.setMatrixAt(i, M);
  });
  const iSeat = I(seatG, mat.chair, seats.length), iBack = I(backG, mat.chair, seats.length);
  seats.forEach((s, i) => {
    const f = s.face || 0; q.setFromAxisAngle(Y, f + Math.PI / 2);
    M.compose(v.set(s.x, z0 + .46, -s.y), q, sc.set(1, 1, 1)); iSeat.setMatrixAt(i, M);
    const bx = -Math.cos(f) * .22, by = -Math.sin(f) * .22;
    M.compose(v.set(s.x + bx, z0 + .78, -(s.y + by)), q, sc.set(1, 1, 1)); iBack.setMatrixAt(i, M);
  });
  root.userData.counts = { desks: desks.length, seats: seats.length };
  root.userData.mats = mat;
  return root;
}
