// Per-level pieces of the building, in rtp_local (three (x, y, z) = (x east, height, -y north)). Level n's finished floor is at base + n * ftf.
// Outside, the photo-based twin (js/twin.js) is the building; these groups add, per level:
//   - interior hints seen through the glass: a ceiling with a soft grid of lit fixtures, the core, and on tenant
//     floors the desk rows from the CAD layout (setDesks);
//   - the one band that marks a chosen floor, along its slab edge;
//   - the floor's own slab, CAD curtain wall, spandrel and lid, shown only when that floor is opened or walked.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glassMaterial } from './look.js';

const P = (x, y, h) => new THREE.Vector3(x, h, -y);
const ccw = (ring) => { let A = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; A += a[0] * b[1] - b[0] * a[1]; } return A >= 0 ? ring : ring.slice().reverse(); };
const edgesOf = (ring) => ccw(ring).map((p, i, r) => [p, r[(i + 1) % r.length]]).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > .05);
const shapeOf = (ring) => new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
function along(a, b, h, ht, out, thick) {                 // a box hugging edge a-b (ccw ring), pushed `out` metres outside
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = Math.sin(ang), ny = -Math.cos(ang);
  return new THREE.BoxGeometry(len + .06, ht, thick).applyMatrix4(new THREE.Matrix4().compose(P((a[0] + b[0]) / 2 + nx * out, (a[1] + b[1]) / 2 + ny * out, h + ht / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1)));
}
// a single plane along edge a-b whose normal points outside (ccw ring)
function panel(a, b, h, ht) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return new THREE.PlaneGeometry(len, ht).applyMatrix4(new THREE.Matrix4().compose(P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, h + ht / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1)));
}
// clip a polygon by a convex one (Sutherland-Hodgman): the CAD plate inside the twin's footprint
export function clipConvex(subject, clip) {
  let out = ccw(subject); const C = ccw(clip);
  for (let i = 0; i < C.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length], inside = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const inter = (p, q) => { const x1 = p[0], y1 = p[1], x2 = q[0], y2 = q[1], x3 = a[0], y3 = a[1], x4 = b[0], y4 = b[1]; const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4) || 1e-9;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d; return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]; };
    const inp = out; out = []; if (!inp.length) break;
    for (let j = 0; j < inp.length; j++) { const p = inp[j], q = inp[(j + 1) % inp.length];
      if (inside(q)) { if (!inside(p)) out.push(inter(p, q)); out.push(q); } else if (inside(p)) out.push(inter(p, q)); }
  }
  return out;
}

export function buildLevels(plate, { levels = 5, ftf = 4.1, base = 0, accent = '#dd8d36', mobile = false } = {}) {
  const root = new THREE.Group(); root.name = 'levels';
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o });
  const mats = {
    slab: M(0x8f8b84, { roughness: .9 }),          // bare concrete: the unfitted part of a floor reads as shell, not as a white blank edge: M(0x34373b, { roughness: .45, metalness: .5 }), mull: M(0x2b2e31, { roughness: .35, metalness: .6 }),
    glass: glassMaterial(), band: new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), toneMapped: false }),
    lid: M(0xe9e6e0, { roughness: .95, side: THREE.BackSide }),
    ceil: M(0x8c8882, { roughness: .95, side: THREE.BackSide }),        // seen from below / through the glass, softly lit
    fix: new THREE.MeshBasicMaterial({ color: 0xfff1d8 }), core: M(0x6f6c67, { roughness: .9 }), lining: M(0x625f5a, { roughness: .95, side: THREE.BackSide }),
    desk: M(0xb59a7a, { roughness: .7 }), screen: M(0x2f3238, { roughness: .6 }),
  };
  const L = [];
  for (let lv = 0; lv < levels; lv++) {
    const z = base + lv * ftf, g = new THREE.Group(); g.name = 'level' + lv; g.userData = { level: lv, z };
    const shell = new THREE.Group(); shell.name = 'shell'; shell.visible = false; g.add(shell);
    const slab = new THREE.Mesh((() => { const s = new THREE.ExtrudeGeometry(shapeOf(plate), { depth: .35, bevelEnabled: false }); s.rotateX(-Math.PI / 2); s.translate(0, z - .36, 0); return s; })(), mats.slab);   // top 10 mm under the finished floor: never coplanar with a delivered floor
    slab.receiveShadow = true; shell.add(slab);
    const fac = new THREE.Group(); fac.name = 'facade'; shell.add(fac);
    const glass = [], mull = [], edge = [];
    for (const [a, b] of edgesOf(plate)) {
      edge.push(along(a, b, z - .45, .55, .05, .12));                        // spandrel at the slab: opaque dark metal
      glass.push(along(a, b, z + .1, ftf - .55, 0, .012));
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 1.5)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        mull.push(new THREE.BoxGeometry(.045, ftf - .55, .1).applyMatrix4(new THREE.Matrix4().compose(P(x + Math.sin(ang) * .04, y - Math.cos(ang) * .04, z + .1 + (ftf - .55) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1)))); }
    }
    const gm = new THREE.Mesh(mergeGeometries(glass), mats.glass); gm.renderOrder = 6; fac.add(gm);
    const mm = new THREE.Mesh(mergeGeometries(mull), mats.mull); fac.add(mm);
    const em = new THREE.Mesh(mergeGeometries(edge), mats.edge); shell.add(em);
    const lid = new THREE.Mesh((() => { const s = new THREE.ShapeGeometry(shapeOf(plate)); s.rotateX(-Math.PI / 2); s.translate(0, z + ftf - .36, 0); return s; })(), mats.lid); lid.visible = false; shell.add(lid);
    const hints = new THREE.Group(); hints.name = 'hints'; g.add(hints);
    const band = new THREE.Group(); band.name = 'band'; band.visible = false; g.add(band);
    Object.assign(g.userData, { shell, fac, lid, hints, band });
    root.add(g); L.push(g);
  }
  // per level: the CAD plate clipped to the twin's footprint(s) at that level, inset from the glass (main block; the annex
  // too on the ground and first floor). Nothing interior may stand outside the facade line.
  function setOutline(lv, clips, cores = [], bandRings = null) {
    const g = L[lv], z = g.userData.z, { band, hints } = g.userData;
    band.clear(); hints.clear();
    const rings = clips.map(fp => clipConvex(plate, fp)).filter(r => r.length > 2);
    if (!rings.length) return;
    const inOne = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const inRing = (x, y) => rings.some(r => inOne(r, x, y));
    band.add(new THREE.Mesh(mergeGeometries((bandRings || rings).flatMap(r => edgesOf(r).map(([a, b]) => along(a, b, z - .42, .5, bandRings ? .27 : .36, .05)))), mats.band));   // proud of the ACP band (which stands .19 m out)
    // ceiling just under the slab above, facing down, mid grey, with a sparse grid of small lit fixtures
    const cz = z + ftf - .75, st = mobile ? 3.6 : 2.4, pts = [];
    for (const r of rings) { const cg = new THREE.ShapeGeometry(shapeOf(r)); cg.rotateX(-Math.PI / 2); cg.translate(0, cz, 0); hints.add(new THREE.Mesh(cg, mats.ceil));
      const xs = r.map(p => p[0]), ys = r.map(p => p[1]);
      for (let x = Math.min(...xs) + 1.2; x < Math.max(...xs) - .6; x += st) for (let y = Math.min(...ys) + 1.2; y < Math.max(...ys) - .6; y += st) if (inOne(r, x, y)) pts.push([x, y]); }
    const fg = new THREE.PlaneGeometry(.42, .42).rotateX(Math.PI / 2), im = new THREE.InstancedMesh(fg, mats.fix, pts.length);
    pts.forEach(([x, y], i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, cz - .01, -y))); hints.add(im);
    // an inner lining just inside the facade line, seen only from inside (back faces): through the glass the far side of
    // the floor reads as a dim office wall, not as the white back of the cladding
    hints.add(new THREE.Mesh(mergeGeometries(rings.flatMap(r => edgesOf(r).map(([a, b]) => panel(a, b, z, cz - z)))), mats.lining));
    // the core (lifts, stairs, toilets), opaque, floor to ceiling, clipped like everything else
    const cgs = [];
    for (const c of cores) for (const fp of clips) { const r = clipConvex(c, fp); if (r.length < 3) continue;
      const s = new THREE.ExtrudeGeometry(shapeOf(ccw(r)), { depth: cz - z, bevelEnabled: false }); s.rotateX(-Math.PI / 2); s.translate(0, z, 0); cgs.push(s.index ? s.toNonIndexed() : s); }
    if (cgs.length) hints.add(new THREE.Mesh(mergeGeometries(cgs), mats.core));
    g.userData.rings = rings; g.userData.inRing = inRing;
  }
  // tenant floors: the desk rows from the layout as light blocks (desk + screen), clipped to the level outline
  function setDesks(lv, desks) {
    const g = L[lv], z = g.userData.z, inRing = g.userData.inRing || (() => true);
    const ds = desks.filter(d => inRing(d.c[0], d.c[1])); if (!ds.length) return;
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
    const a = new THREE.InstancedMesh(box, mats.desk, ds.length), b = new THREE.InstancedMesh(box.clone(), mats.screen, ds.length);
    const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    ds.forEach((d, i) => { q.setFromAxisAngle(Y, d.a);
      a.setMatrixAt(i, new THREE.Matrix4().compose(P(d.c[0], d.c[1], z), q, new THREE.Vector3(d.w, .75, d.d)));
      b.setMatrixAt(i, new THREE.Matrix4().compose(P(d.c[0] - Math.sin(d.a) * d.d * .45, d.c[1] + Math.cos(d.a) * d.d * .45, z + .75), q, new THREE.Vector3(d.w * .9, .38, .03))); });
    a.computeBoundingSphere(); b.computeBoundingSphere(); g.userData.hints.add(a, b);
  }
  return { root, levels: L, mats, setOutline, setDesks };
}
