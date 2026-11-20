// The whole floor in one view, for presenting: "this is where you arrive, this is the way in, this is each room".
// Everything is built from the plan's own CAD layout (rtp_local), in the tenant group's frame (three (x, y, z) = (x, h, -y)):
//   - zones: every room tinted by its use, just above the finishes;
//   - CAD: the DWG's own linework (blueprints/<plan>.png) laid on the floor, the live 3D model standing on it;
//   - arrival: lifts -> front door -> reception, a glowing route that draws itself, with pins;
//   - labels: room names and seat counts (placed by the caller as HTML tags).
import * as THREE from 'three';

export const KIND_COLOR = { work: '#3b82f6', meeting: '#f59e0b', training: '#8b5cf6', cafe: '#10b981', lounge: '#ec4899',
  reception: '#ef4444', cabin: '#14b8a6', wc: '#94a3b8', service: '#64748b', core: '#475569', other: '#cbd5e1' };
export const KIND_NAME = { work: 'Workstations', meeting: 'Meeting', training: 'Training', cafe: 'Cafeteria', lounge: 'Lounge',
  reception: 'Reception', cabin: 'Cabins', wc: 'Washrooms', service: 'Services', core: 'Core', other: 'Other' };
const P = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

// lifts in clusters (a bank is lifts within 4 m of each other)
function liftBanks(lifts) {
  const banks = [];
  for (const p of lifts || []) { const q = Array.isArray(p) ? p : [p.x, p.y]; const b = banks.find(b => Math.hypot(b.c[0] - q[0], b.c[1] - q[1]) < 4);
    if (b) { b.pts.push(q); b.c = [b.pts.reduce((s, r) => s + r[0], 0) / b.pts.length, b.pts.reduce((s, r) => s + r[1], 0) / b.pts.length]; } else banks.push({ c: q.slice(), pts: [q] }); }
  return banks;
}

export function buildOverview(t, { blueprint } = {}) {
  const L = t.L, group = new THREE.Group(); group.name = 'overview'; group.visible = false;
  const parts = { zones: new THREE.Group(), cad: new THREE.Group(), route: new THREE.Group() };
  Object.values(parts).forEach(g => group.add(g));
  // zones: rooms by use, 30 mm above the floor (above every finish), never written to depth (nothing fights them)
  const counts = {};
  for (const r of t.rooms) {
    const k = r.kind in KIND_COLOR ? r.kind : 'other'; if (k === 'core') continue;
    counts[k] = counts[k] || { rooms: 0, seats: 0, area: 0 }; counts[k].rooms++; counts[k].seats += r.seats || 0; counts[k].area += r.area || 0;
    { const rings = r.rings || [], outer = rings[0]; if (!outer || outer.length < 3) continue;       // rings = [outer, ...holes]
      const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
      for (const h of rings.slice(1)) if (h && h.length > 2) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
      const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, .03, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: KIND_COLOR[k], transparent: true, opacity: .34, depthWrite: false, toneMapped: false }));
      m.renderOrder = 4; m.userData.room = r.name; parts.zones.add(m);
    }
  }
  // CAD: the DWG linework on the floor (its bounds are rtp_local metres, the same frame as the layout)
  if (blueprint && blueprint.img && blueprint.bounds) {
    const [x0, y0, x1, y1] = blueprint.bounds, tex = new THREE.TextureLoader().load(blueprint.img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, .025, -(y0 + y1) / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .92, depthWrite: false, toneMapped: false }));
    m.renderOrder = 3; parts.cad.add(m); parts.cad.visible = false;
  }
  // arrival: the lift bank nearest reception, the door between it and the offer, then the walk to reception's entry view
  const rec = t.tourRooms && t.tourRooms[0], banks = liftBanks(L.lifts);
  let route = null, pins = [];
  if (rec && banks.length) {
    const rc = rec.views && rec.views[0] ? rec.views[0].position : rec.c;
    const bank = banks.slice().sort((a, b) => Math.hypot(a.c[0] - rc[0], a.c[1] - rc[1]) - Math.hypot(b.c[0] - rc[0], b.c[1] - rc[1]))[0];
    const doors = (L.doors || []).map(d => ({ d, p: d.opening ? [(d.opening[0] + d.opening[2]) / 2, (d.opening[1] + d.opening[3]) / 2] : d.c })).filter(o => o.p);
    const door = doors.sort((a, b) => Math.hypot(a.p[0] - bank.c[0], a.p[1] - bank.c[1]) - Math.hypot(b.p[0] - bank.c[0], b.p[1] - bank.c[1]))[0];
    const start = door && Math.hypot(door.p[0] - bank.c[0], door.p[1] - bank.c[1]) < 25 ? door.p : bank.c;
    const [sx, sy] = t.grid.nearestFree ? t.grid.nearestFree(start[0], start[1], .3, 3) : start;
    const walk = t.grid.path(sx, sy, rc[0], rc[1]) || [[sx, sy], [rc[0], rc[1]]];
    const pts = [bank.c, ...(door ? [door.p] : []), ...walk].filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > .15);
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => P(x, y, .12)), false, 'centripetal', .2);
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const tube = new THREE.TubeGeometry(curve, Math.max(40, Math.round(len * 6)), .14, 8, false);
    // a dash that runs along the route (the shader's progress clips it, so the route "draws itself")
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { t: { value: 0 }, prog: { value: 0 }, col: { value: new THREE.Color('#ff8a1f') } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float t, prog; uniform vec3 col; varying vec2 vUv;
        void main(){ if (vUv.x > prog) discard; float dash = step(.45, fract(vUv.x * ${Math.max(8, Math.round(len / 1.6))}.0 - t)); gl_FragColor = vec4(col * (1.2 + .8 * dash), .55 + .45 * dash); }` });
    const tm = new THREE.Mesh(tube, mat); tm.renderOrder = 7; parts.route.add(tm);
    // pins: lifts, front door, reception
    const pin = (p, c) => { const g = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .08, 24), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); g.position.copy(P(p[0], p[1], .1)); g.renderOrder = 7; parts.route.add(g); };
    pin(bank.c, '#ff8a1f'); if (door) pin(door.p, '#ffffff'); pin(rc, '#ef4444');
    route = { mat, len, pts, bank, door: door && door.p, end: rc };
    pins = [{ p: bank.c, label: `Lifts<small>${bank.pts.length} lifts · arrive here</small>` }, ...(door ? [{ p: door.p, label: 'Front door<small>into the office</small>' }] : []),
      { p: rc, label: `${rec.label}<small>${Math.round(len)} m from the lifts</small>` }];
  }
  t.group.add(group);
  return { group, parts, counts, route, pins,
    tick(dt) { if (!route || !group.visible || !parts.route.visible) return; route.mat.uniforms.t.value += dt * .9; route.mat.uniforms.prog.value = Math.min(1, route.mat.uniforms.prog.value + dt * .45); },
    replay() { if (route) route.mat.uniforms.prog.value = 0; },
    dispose() { group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); group.removeFromParent(); } };
}
