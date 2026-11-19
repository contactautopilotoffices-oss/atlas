// The real building and its city: the photo-based Skymark twin (noida-skymark/exports/fm_skymark_atlas.glb, made by
// reconstruction/skymark_reconstruction.py) and the 500 m context (fm_skymark_context_500m.glb), placed exactly as
// the live Volt page places them (volt.js: CAD plan <-> map ENU <-> twin local, from Volt's layout site_fit), plus
// the 500-650 m ring of Overture buildings from reconstruction/context_overture.json as plain massing.
// Two copies of the twin are clipped at a cut height: the part below stays, the part above lifts away (section).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glassMaterial } from './look.js';

const D2R = Math.PI / 180;
export function frames(SF) {
  const RHO = SF.rot_deg * D2R, PHI = SF.twin_phi_deg * D2R;
  const enuToPlan = ([ex, ey]) => { const x = ex - SF.footprint_centroid[0] - SF.dx, y = ey - SF.footprint_centroid[1] - SF.dy, c = Math.cos(-RHO), s = Math.sin(-RHO);
    return [c * x - s * y + SF.plate_centroid[0], s * x + c * y + SF.plate_centroid[1]]; };
  return { RHO, PHI, enuToPlan };
}

export async function loadTwin(loader, SF, base = '../../exports/') {
  const { RHO, PHI, enuToPlan } = frames(SF);
  const frame = new THREE.Group(); frame.name = 'twinFrame';
  { const o = enuToPlan(SF.twin_C); frame.position.set(o[0], 0, -o[1]); frame.rotation.y = PHI - RHO; }   // twin ground = our ground floor (y 0)
  const cutLow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4), cutHigh = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1e4);
  const spandrel = new THREE.MeshStandardMaterial({ color: 0x34373b, roughness: .45, metalness: .5 });
  const glassFaint = glassMaterial({ opacity: .05, edge: .3 });      // the plane behind side B's glazing: other glass sits in front of most of it
  const glassClear = glassMaterial(), glassDark = glassMaterial({ color: 0x9fb0aa, opacity: .32, edge: .8 });
  const gltf = await loader.loadAsync(base + 'fm_skymark_atlas.glb');
  const prep = (rootObj, plane) => {
    const cache = new Map();
    rootObj.traverse(o => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      o.material = [].concat(o.material).map(m => {
        const key = m.uuid + (/SlabEdge/.test(o.name) ? 'band' : /Floor_Slabs/.test(o.name) ? 'floor' : /SideB_Wall_Plane/.test(o.name) ? 'wp' : '');
        if (cache.has(key)) return cache.get(key);
        let c;
        if (/SlabEdge/.test(o.name)) c = spandrel.clone();                         // spandrels at the slabs stay opaque dark metal
        else if (/Floor_Slabs/.test(o.name)) { c = m.clone(); c.color.set(0x77736d); c.roughness = .9; }   // seen through the glass these are office floors, not white concrete
        // the plane behind side B's glazing reads as more glazing, not a white wall
        else if (/Glass/i.test(m.name) || /SideB_Wall_Plane/.test(o.name)) { c = (/SideB_Wall_Plane/.test(o.name) ? glassFaint : /Dark/i.test(m.name) ? glassDark : glassClear).clone(); c.onBeforeCompile = glassClear.onBeforeCompile; c.customProgramCacheKey = glassClear.customProgramCacheKey; o.renderOrder = 6; o.castShadow = false; }
        else c = m.clone();
        c.clippingPlanes = [plane]; cache.set(key, c); return c;
      });
      if (o.material.some(x => x.userData.glass)) { o.renderOrder = 6; o.castShadow = false; }
      if (o.material.length === 1) o.material = o.material[0];
    });
    const int = rootObj.getObjectByName('Interiors'); if (int) int.visible = false;
    // the solid mass the facade panels are laid on: hidden so the glass is glass (the cladding, piers, slabs, roof and
    // rear facades are separate pieces and stay)
    for (const n of ['Building_Mass']) { const x = rootObj.getObjectByName(n); if (x) x.traverse(o => { if (o.isMesh) o.visible = false; }); }   // the side B plane sat behind all its glazing     // the per-level hints (building.js) replace the 6.5 m deep generic offices
    const palm = rootObj.getObjectByName('SKY_Site_Palm_2'); if (palm) palm.visible = false;   // stood in front of the porch (as on the Volt page)
  };
  const low = gltf.scene, high = gltf.scene.clone(true);
  prep(low, cutLow); prep(high, cutHigh);
  high.visible = false; frame.add(low, high);
  // footprint of the main block, for clipping the CAD plate above the podium (plan coordinates, convex)
  frame.updateMatrixWorld(true);
  const mass = low.getObjectByName('Building_Mass') || low.getObjectByName('SKY_Floor_Slabs') || low;   // hidden, but its box is the main block's footprint
  const bb = new THREE.Box3(), v = new THREE.Vector3(); const corners = [];
  mass.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) { v.set(x, 0, z).applyMatrix4(o.matrixWorld); corners.push([v.x, -v.z]); } } });
  // minimum box in the twin's own axes, back to plan
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert(), loc = corners.map(([x, y]) => { const p = new THREE.Vector3(x, 0, -y).applyMatrix4(inv); return [p.x, p.z]; });
  const lx = loc.map(p => p[0]), lz = loc.map(p => p[1]), lb = [Math.min(...lx), Math.min(...lz), Math.max(...lx), Math.max(...lz)];
  const IN = .3;                                                  // interiors stay this far inside the glass
  const toPlanRect = (b) => [[b[0] + IN, b[1] + IN], [b[2] - IN, b[1] + IN], [b[2] - IN, b[3] - IN], [b[0] + IN, b[3] - IN]].map(([x, z]) => { const p = new THREE.Vector3(x, 0, z).applyMatrix4(frame.matrixWorld); return [p.x, -p.z]; });
  const footprint = toPlanRect(lb);
  // the facade's outer face (all four facade groups), for the floor band: it must sit on the outside of the cladding
  const outerRect = (names, pad) => { const pts = []; for (const n of names) { const g = low.getObjectByName(n); if (!g) continue; g.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) { const p = new THREE.Vector3(x, 0, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv); pts.push([p.x, p.z]); } } }); }
    if (!pts.length) return null; const b = [Math.min(...pts.map(p => p[0])) - pad, Math.min(...pts.map(p => p[1])) - pad, Math.max(...pts.map(p => p[0])) + pad, Math.max(...pts.map(p => p[1])) + pad];
    return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([x, z]) => { const p = new THREE.Vector3(x, 0, z).applyMatrix4(frame.matrixWorld); return [p.x, -p.z]; }); };
  const outer = outerRect(['Facade_Front_A', 'Facade_Rear_C', 'Facade_Side_D', 'SKY_FrontA_CornerPier_Cladding', 'SKY_FacadeC_Rear_Unobserved', 'SKY_FacadeD_FarSide_Unobserved', 'SKY_SideB_PanelPier_Cladding', 'SKY_SideB_EndPier_Cladding'], .06);
  const annexOuter = outerRect(['SKY_Annex_Body', 'SKY_Annex_Fascia_Cladding'], .06);
  // the two-storey annex on the street front (ground + first floor)
  let annex = null; { const an = low.getObjectByName('SKY_Annex_Body'); if (an) { const pts = []; an.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) { const p = new THREE.Vector3(x, 0, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv); pts.push([p.x, p.z]); } } });
    if (pts.length) annex = toPlanRect([Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]); } }
  return { frame, low, high, cutLow, cutHigh, footprint, annex, outer, annexOuter, enuToPlan,
    setCut(y) { cutLow.constant = y; cutHigh.constant = -y; },
    async context() {
      const g = await loader.loadAsync(base + 'fm_skymark_context_500m.glb');
      g.scene.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; for (const m of [].concat(o.material)) if (m && /CTX_(wall|roof|parapet)/.test(m.name || '')) m.side = THREE.FrontSide; } });
      frame.add(g.scene); return g.scene;
    },
  };
}

// 500-650 m: the Overture footprints the context GLB stops short of, as plain warm massing (one mesh)
export async function outerRing(url, enuToPlan, { r0 = 500, r1 = 650 } = {}) {
  const d = await (await fetch(url)).json(), geos = [];
  for (const b of d.buildings) {
    const ring = b.ring; if (!ring || ring.length < 4) continue;
    let cx = 0, cy = 0; ring.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= ring.length; cy /= ring.length;
    const r = Math.hypot(cx, cy); if (r < r0 || r > r1) continue;
    const h = b.height || (b.floors ? b.floors * 3.3 : 7 + ((Math.abs(cx * 13 + cy * 7) | 0) % 9));
    const s = new THREE.Shape(ring.slice(0, -1).map(p => { const q = enuToPlan(p); return new THREE.Vector2(q[0], q[1]); }));
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); geos.push(g.index ? g.toNonIndexed() : g);
  }
  if (!geos.length) return null;
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0xd9cbb5, roughness: .9 }));
  m.name = 'ring_500_650'; m.receiveShadow = true; return m;
}
