// The presenter's camera: orbit, zoom toward the cursor, pan along the ground, with weight. Damping and inertia hide
// frame drops; ?tv=1 doubles the inertia for a big screen with lag. The camera never enters a building or the ground:
// a move that would is undone and its momentum dropped (the soft stop of a camera with mass).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TV, W } from './core.js';

const pip = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const nearRing = (r, x, y, m) => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ax, ay] = r[j], [bx, by] = r[i], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)); if (Math.hypot(ax + dx * t - x, ay + dy * t - y) < m) return true; } return false; };

export function createControls(camera, dom, { outer, buildingTop = 48, boxes = [], footprints = [], heightAt = () => 0 }) {
  const c = new OrbitControls(camera, dom);
  c.enableDamping = true; c.dampingFactor = TV ? .035 : .07;
  c.rotateSpeed = TV ? .42 : .5; c.zoomSpeed = TV ? .7 : .9; c.panSpeed = .8; c.keyPanSpeed = 14;
  c.zoomToCursor = true; c.screenSpacePanning = false;
  c.minDistance = 18; c.maxDistance = 3200; c.minPolarAngle = .08; c.maxPolarAngle = Math.PI * .485;
  c.target.copy(W(5, 50, 14));
  c.enabled = false;
  const last = { p: camera.position.clone(), t: c.target.clone() };
  let interiorMode = false;
  const blocked = (p) => {
    if (interiorMode) return p.y < 22.35;
    const x = p.x, y = -p.z, h = p.y;
    const g = heightAt(x, y);
    if (h < g + 1.4) return true;
    if (outer && h < buildingTop + 2 && (pip(outer, x, y) || nearRing(outer, x, y, 2.5))) return true;
    for (const b of boxes) if (b.containsPoint(p)) return true;
    for (const f of footprints) if (h < f.h + 2 && x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1 && pip(f.ring, x, y)) return true;
    return false;
  };
  const api = {
    c, blocked,
    setInteriorMode(on) { interiorMode = on; c.minDistance = on ? 3 : 18; c.maxDistance = on ? 300 : 3200; c.zoomToCursor = !on; },
    update() {
      if (!c.enabled) return false;
      // keep the orbit point on the campus side of the world (never lost under the ground or kilometres away)
      c.target.y = Math.max(0, Math.min(c.target.y, 120));
      const r = Math.hypot(c.target.x, c.target.z); if (r > 2600) c.target.multiplyScalar(2600 / r);
      const moved = c.update();
      if (blocked(camera.position)) {
        camera.position.copy(last.p); c.target.copy(last.t);
        c._sphericalDelta && c._sphericalDelta.set(0, 0, 0); if (c._panOffset) c._panOffset.set(0, 0, 0); if ('_scale' in c) c._scale = 1;
        camera.lookAt(c.target);
      } else { last.p.copy(camera.position); last.t.copy(c.target); }
      return moved;
    },
    setFrom(p, t) { camera.position.copy(p); c.target.copy(t); camera.lookAt(t); last.p.copy(p); last.t.copy(t); c.update(); },
    enable(on) { c.enabled = on; if (on) { last.p.copy(camera.position); last.t.copy(c.target); } },
  };
  return api;
}

// collision footprints from the Overture buildings around the site (height, else floors x 3.3 m, else 9 m; capped)
export function footprintsFrom(ctx, { maxR = 700 } = {}) {
  const out = [];
  for (const b of ctx.buildings || []) {
    const r = b.ring; if (!r || r.length < 4) continue; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (Math.hypot((x0 + x1) / 2, (y0 + y1) / 2) > maxR || /reliable tech park/i.test(b.name || '')) continue;
    out.push({ ring: r, x0, x1, y0, y1, h: Math.min(80, b.height || (b.floors ? b.floors * 3.3 : 9)) });
  }
  return out;
}
