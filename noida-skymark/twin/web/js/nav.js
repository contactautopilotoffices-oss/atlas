// Walkable-area grid for one tenant floor, in that tenant's own plan frame (metres, x east, y north).
// Built from the CAD layout: the demise is walkable, walls / glass / columns / furniture are not.
// Two distance fields (to structure, to furniture) give collision, path cost and camera clearance.

// ------------------------------------------------------------------ polygon helpers
export const ringsOf = (outer, holes = []) => [outer, ...(holes || [])];
export function inRings(rings, x, y) {             // even-odd over outer + holes
  let c = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function area(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
export function centroid(r) { let x = 0, y = 0; r.forEach(p => { x += p[0]; y += p[1]; }); return [x / r.length, y / r.length]; }
export const boxRing = ([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export function rectRing(cx, cy, w, d, a) {         // w along angle a, d across
  const c = Math.cos(a), s = Math.sin(a), hw = w / 2, hd = d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]);
}
export const roomRings = (r) => r.poly ? ringsOf(r.poly, r.holes) : [boxRing(r.box)];

// ------------------------------------------------------------------ 1D squared EDT (Felzenszwalb)
function edt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    while (true) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k]) { k--; if (k < 0) { k = 0; break; } } else break; }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
}
function edt(mask, W, H, cell) {                    // distance (m) from each cell to the nearest mask cell
  const INF = 1e12, g = new Float64Array(W * H), n = Math.max(W, H);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = mask[y * W + x] ? 0 : INF; edt1(f, H, d, v, z); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = g[y * W + x]; edt1(f, W, d, v, z); for (let x = 0; x < W; x++) out[y * W + x] = Math.sqrt(d[x]) * cell; }
  return out;
}

// ------------------------------------------------------------------ the grid
export class NavGrid {
  constructor(bounds, cell = 0.2) {
    const [x0, y0, x1, y1] = bounds; this.cell = cell; this.x0 = x0 - 1; this.y0 = y0 - 1;
    this.W = Math.ceil((x1 - x0 + 2) / cell); this.H = Math.ceil((y1 - y0 + 2) / cell);
    const N = this.W * this.H; this.inside = new Uint8Array(N); this.wall = new Uint8Array(N); this.furn = new Uint8Array(N); this.see = new Uint8Array(N);
  }
  ix(x) { return Math.floor((x - this.x0) / this.cell); } iy(y) { return Math.floor((y - this.y0) / this.cell); }
  cx(i) { return this.x0 + (i + .5) * this.cell; } cy(j) { return this.y0 + (j + .5) * this.cell; }
  fillRings(arr, rings, val = 1) {                  // scanline fill at cell centres
    let ya = Infinity, yb = -Infinity; rings.forEach(r => r.forEach(p => { ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); }));
    const j0 = Math.max(0, this.iy(ya)), j1 = Math.min(this.H - 1, this.iy(yb));
    for (let j = j0; j <= j1; j++) {
      const y = this.cy(j), xs = [];
      for (const r of rings) for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
        const [xi, yi] = r[i], [xk, yk] = r[k]; if ((yi > y) !== (yk > y)) xs.push(xi + (y - yi) * (xk - xi) / (yk - yi));
      }
      xs.sort((a, b) => a - b);
      for (let n = 0; n + 1 < xs.length; n += 2) {
        const i0 = Math.max(0, Math.ceil((xs[n] - this.x0) / this.cell - .5)), i1 = Math.min(this.W - 1, Math.floor((xs[n + 1] - this.x0) / this.cell - .5));
        for (let i = i0; i <= i1; i++) arr[j * this.W + i] = val;
      }
    }
  }
  fillSeg(arr, ax, ay, bx, by, half, val = 1) {     // thick line
    const r = half + this.cell * .5, i0 = Math.max(0, this.ix(Math.min(ax, bx) - r)), i1 = Math.min(this.W - 1, this.ix(Math.max(ax, bx) + r));
    const j0 = Math.max(0, this.iy(Math.min(ay, by) - r)), j1 = Math.min(this.H - 1, this.iy(Math.max(ay, by) + r));
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = this.cx(i), py = this.cy(j); let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
      if (Math.hypot(px - ax - t * dx, py - ay - t * dy) <= r) arr[j * this.W + i] = val;
    }
  }
  fillCircle(arr, x, y, rad, val = 1) { this.fillSeg(arr, x, y, x, y, rad, val); }
  // morphological closing of the walkable region: seams and slivers in the CAD outline (zero-width slits) must not split the floor
  closeInside(r = 2) {
    const W = this.W, H = this.H, a = this.inside, b = new Uint8Array(W * H), c = new Uint8Array(W * H);
    const pass = (src, dst, dil) => { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let v = dil ? 0 : 1;
      for (let dj = -r; dj <= r && (dil ? !v : v); dj++) for (let di = -r; di <= r; di++) { const x = i + di, y = j + dj; const s = x < 0 || y < 0 || x >= W || y >= H ? 0 : src[y * W + x]; if (dil && s) { v = 1; break; } if (!dil && !s) { v = 0; break; } }
      dst[j * W + i] = v; } };
    pass(a, b, true); pass(b, c, false); this.inside = c;
  }
  finish() {
    const N = this.W * this.H, blocked = new Uint8Array(N), hard = new Uint8Array(N);
    for (let k = 0; k < N; k++) { hard[k] = !this.inside[k] || this.wall[k]; blocked[k] = hard[k] || this.furn[k]; }
    this.dAll = edt(blocked, this.W, this.H, this.cell);   // clearance for walking
    this.dWall = edt(hard, this.W, this.H, this.cell);     // clearance from structure / demise edge
    this.dFurn = edt(this.furn, this.W, this.H, this.cell); // clearance from furniture (camera spawn rule)
    return this;
  }
  sample(field, x, y) {                              // bilinear
    const fx = (x - this.x0) / this.cell - .5, fy = (y - this.y0) / this.cell - .5, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= this.W - 1 || j >= this.H - 1) return 0;
    const u = fx - i, v = fy - j, W = this.W, k = j * W + i;
    return field[k] * (1 - u) * (1 - v) + field[k + 1] * u * (1 - v) + field[k + W] * (1 - u) * v + field[k + W + 1] * u * v;
  }
  clear(x, y) { return this.sample(this.dAll, x, y); }
  sightBlocked(x, y) { const i = this.ix(x), j = this.iy(y); if (i < 0 || j < 0 || i >= this.W || j >= this.H) return true; const k = j * this.W + i; return !this.inside[k] || this.see[k]; }
  ray(x, y, ang, max = 14) {                         // eye-height ray: walls and glass stop it, furniture does not
    const c = Math.cos(ang), s = Math.sin(ang), st = this.cell * .5;
    for (let d = st; d < max; d += st) if (this.sightBlocked(x + c * d, y + s * d)) return d;
    return max;
  }
  nearestFree(x, y, minClear = .35, maxR = 6) {
    if (this.clear(x, y) >= minClear) return [x, y];
    const i0 = this.ix(x), j0 = this.iy(y); let best = null, bd = Infinity; const R = Math.ceil(maxR / this.cell);
    for (let j = Math.max(0, j0 - R); j <= Math.min(this.H - 1, j0 + R); j++) for (let i = Math.max(0, i0 - R); i <= Math.min(this.W - 1, i0 + R); i++) {
      if (this.dAll[j * this.W + i] < minClear) continue; const d = (i - i0) ** 2 + (j - j0) ** 2; if (d < bd) { bd = d; best = [this.cx(i), this.cy(j)]; }
    }
    return best || [x, y];
  }
  // collision: move from (x, y) by (dx, dy), sliding along obstacles; radius r
  move(x, y, dx, dy, r = .28) {
    const ok = (a, b) => this.clear(a, b) >= r;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .05)); dx /= steps; dy /= steps;
    for (let n = 0; n < steps; n++) {
      if (ok(x + dx, y + dy)) { x += dx; y += dy; }
      else if (ok(x + dx, y)) x += dx;
      else if (ok(x, y + dy)) y += dy;
      else if (!ok(x, y)) { const [fx, fy] = this.nearestFree(x, y, r, 1.5); x = fx; y = fy; break; }   // spawned inside something: step out
      else break;
    }
    return [x, y];
  }
  los(ax, ay, bx, by, minClear = .33) {
    const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / (this.cell * .5)));
    for (let k = 0; k <= n; k++) { const t = k / n; if (this.clear(ax + (bx - ax) * t, ay + (by - ay) * t) < minClear) return false; }
    return true;
  }
  // A* over cells, 8-connected; cost grows near obstacles so routes keep to the middle of walkways
  path(ax, ay, bx, by) {
    for (const need of [.42, .32, .25]) { const p = this._astar(ax, ay, bx, by, need); if (p) return p; }
    return null;
  }
  _astar(ax, ay, bx, by, need) {
    const W = this.W, H = this.H, D = this.dAll;
    const [sx, sy] = this.nearestFree(ax, ay, need, 2), [tx, ty] = this.nearestFree(bx, by, need, 2);
    const s = this.iy(sy) * W + this.ix(sx), t = this.iy(ty) * W + this.ix(tx);
    if (D[s] < need || D[t] < need) return null;
    const g = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
    const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const tI = t % W, tJ = (t / W) | 0, h = (k) => Math.hypot(k % W - tI, ((k / W) | 0) - tJ);
    g[s] = 0; push(s, h(s));
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    let iter = 0;
    while (heap.length && iter++ < 400000) {
      const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === t) break;
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj, c] of NB) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nk = nj * W + ni; if (closed[nk] || D[nk] < need) continue;
        const pen = 1 + 2.5 * Math.max(0, .9 - D[nk]);            // prefer the middle of the walkway
        const ng = g[k] + c * pen; if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(nk, ng + h(nk)); }
      }
    }
    if (from[t] < 0 && s !== t) return null;
    const cells = []; for (let k = t; k >= 0; k = from[k]) { cells.push([this.cx(k % W), this.cy((k / W) | 0)]); if (k === s) break; }
    cells.reverse(); cells[0] = [ax, ay]; cells.push([bx, by]);
    // string-pull: keep only the corners we need, with a clearance margin
    const out = [cells[0]]; let i = 0;
    while (i < cells.length - 1) { let j = cells.length - 1; while (j > i + 1 && !this.los(cells[i][0], cells[i][1], cells[j][0], cells[j][1], Math.min(need, .3))) j--; out.push(cells[j]); i = j; }
    return out;
  }
}

// polyline helpers for gliding along a route
export function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
export function polyAt(p, s) {
  if (s <= 0) return p[0].slice();
  for (let i = 1; i < p.length; i++) { const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (s <= L) { const t = L ? s / L : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t]; } s -= L; }
  return p[p.length - 1].slice();
}
// smoothed point at arc length s: average over a short window, so corners round off without leaving the corridor
export function polySmooth(p, s, L, win = .45) {
  const lo = Math.min(win, s, L - s); let x = 0, y = 0; const n = 7;
  for (let k = 0; k < n; k++) { const q = polyAt(p, s + lo * (k / (n - 1) * 2 - 1)); x += q[0]; y += q[1]; }
  return [x / n, y / n];
}

// ------------------------------------------------------------------ fallback cameras (until Blender cameras arrive)
// Rules: eye 1.55 m, ~45 deg across the room, pitch 7 deg down (10 for detail / deep rooms), hFOV 75 (70 detail),
// level horizon, >= 0.8 m from furniture (relaxed in small rooms, flagged), never facing a blank wall.
const EYE = 1.55, HFOV = 75;
export function fallbackCameras(grid, room, opts = {}) {
  const rings = roomRings(room), [bx0, by0, bx1, by1] = room.box;
  const diag = Math.hypot(bx1 - bx0, by1 - by0), cen = centroid(rings[0]);
  const cand = (minF) => { const out = []; const st = Math.max(1, Math.round(.4 / grid.cell));
    for (let j = grid.iy(by0); j <= grid.iy(by1); j += st) for (let i = grid.ix(bx0); i <= grid.ix(bx1); i += st) {
      if (i < 0 || j < 0 || i >= grid.W || j >= grid.H) continue; const k = j * grid.W + i, x = grid.cx(i), y = grid.cy(j);
      if (grid.dWall[k] < .5 || grid.dFurn[k] < minF || grid.dAll[k] < .35 || !inRings(rings, x, y)) continue; out.push([x, y]); }
    return out; };
  let relaxed = false, C = cand(.8); if (C.length < 3) { C = cand(.55); relaxed = true; } if (C.length < 2) { C = cand(.3); relaxed = true; }
  if (!C.length) return [];
  const view = (x, y, yaw, hf = HFOV) => {         // mean free distance across the frame; centre must not be a near wall
    let sum = 0, n = 9, near = 0; for (let k = 0; k < n; k++) { const a = yaw + (k / (n - 1) - .5) * hf * Math.PI / 180, d = grid.ray(x, y, a, 16); sum += Math.min(d, 12); if (d < 1.5) near++; }
    const c = grid.ray(x, y, yaw, 16);
    let fn = 0; for (const da of [-.4, -.2, 0, .2, .4]) for (let d = .4; d < 2.2; d += .1) { const i = grid.ix(x + Math.cos(yaw + da) * d), j = grid.iy(y + Math.sin(yaw + da) * d), k = j * grid.W + i; if (i >= 0 && j >= 0 && i < grid.W && j < grid.H && (grid.furn[k] || grid.see[k])) { if (d < 1.7 || grid.see[k]) fn++; break; } }
    return { mean: sum / n - fn * 1.2, centre: c, near: near / n, furnNear: fn };
  };
  const doors = (opts.doors || []);
  const entryRef = doors.length ? doors.map(d => d.c) : [[room.box[0], room.box[1]]];
  const nearDoor = (x, y) => Math.min(...entryRef.map(d => Math.hypot(x - d[0], y - d[1])));
  const far = (x, y) => { let b = null, bd = -1; rings[0].forEach(p => { const d = Math.hypot(p[0] - x, p[1] - y); if (d > bd) { bd = d; b = p; } }); return b; };
  const pick = (score) => { let best = null; for (const [x, y] of C) for (let a = 0; a < 24; a++) { const yaw = a / 24 * Math.PI * 2, s = score(x, y, yaw); if (s && (!best || s.s > best.s)) best = { ...s, x, y, yaw }; } return best; };
  const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const ok = (v) => v.centre >= Math.min(2.5, diag * .4) && v.near <= .34 && v.furnNear < 2;
  const out = [];
  // entry: just inside the door, looking ~45 deg across to the far corner
  const E = pick((x, y, yaw) => { const nd = nearDoor(x, y); if (nd > 3.2) return null; const f = far(x, y), aim = Math.atan2(f[1] - y, f[0] - x);
    const v = view(x, y, yaw); if (!ok(v)) return null; return { s: v.mean - 1.2 * angDiff(yaw, aim) - .5 * Math.max(0, nd - 1.2), v }; })
    || pick((x, y, yaw) => { const v = view(x, y, yaw); return { s: v.mean - .3 * nearDoor(x, y), v }; });
  if (E) out.push(['entry', E]);
  if (E) {
    // reverse: from the far side, looking back towards the entry
    const R = pick((x, y, yaw) => { const d = Math.hypot(x - E.x, y - E.y); if (d < Math.min(2.5, diag * .35)) return null; const aim = Math.atan2(E.y - y, E.x - x), v = view(x, y, yaw);
      if (!ok(v)) return null; return { s: v.mean + .35 * d - 1.4 * angDiff(yaw, aim), v }; });
    if (R) out.push(['reverse', R]);
    // feature: the feature wall if the CAD has one, else across the other diagonal
    const fw = room.feature_wall && room.feature_wall.at;
    const F = pick((x, y, yaw) => { const v = view(x, y, yaw); if (!ok(v)) return null;
      if (fw) { const d = Math.hypot(fw[0] - x, fw[1] - y), aim = Math.atan2(fw[1] - y, fw[0] - x); if (d < 2) return null; return { s: -angDiff(yaw, aim) * 3 - Math.abs(d - Math.min(5, diag * .6)) * .4 + v.mean * .2, v, tgt: fw }; }
      const ax = Math.atan2(R ? R.y - E.y : 1, R ? R.x - E.x : 0), aim = Math.atan2(cen[1] - y, cen[0] - x), perp = Math.abs(Math.sin(aim - ax));
      const d = Math.min(Math.hypot(x - E.x, y - E.y), R ? Math.hypot(x - R.x, y - R.y) : 9);
      return { s: v.mean + 2 * perp + .3 * Math.min(d, 4) - 1.2 * angDiff(yaw, aim), v }; });
    if (F) out.push(['feature', F]);
    // detail: closer, at the main table / desk cluster
    const items = (opts.focus || []).filter(p => inRings(rings, p[0], p[1]));
    if (items.length) {
      const fc = items.reduce((a, p) => [a[0] + p[0] / items.length, a[1] + p[1] / items.length], [0, 0]);
      const D = pick((x, y, yaw) => { const d = Math.hypot(fc[0] - x, fc[1] - y); if (d < 1.4 || d > 3.6) return null; const aim = Math.atan2(fc[1] - y, fc[0] - x), v = view(x, y, yaw, 70);
        if (v.centre < .9) return null; return { s: -angDiff(yaw, aim) * 3 - Math.abs(d - 2.3) + v.mean * .1, v, detail: true }; });
      if (D) out.push(['detail', D]);
    }
  }
  return out.map(([kind, c]) => {
    const pitch = kind === 'detail' || diag > 10 ? 10 : 7, hf = kind === 'detail' ? 70 : HFOV, dist = Math.max(1.5, Math.min(8, c.v.centre * .8));
    const tz = EYE - Math.tan(pitch * Math.PI / 180) * dist;
    return { name: `fallback_${room.name}_${kind}`, room: room.name, kind, position: [+c.x.toFixed(3), +c.y.toFixed(3), EYE],
      target: [+(c.x + Math.cos(c.yaw) * dist).toFixed(3), +(c.y + Math.sin(c.yaw) * dist).toFixed(3), +tz.toFixed(3)],
      fov_h_deg: hf, pitch_deg: pitch, roll_deg: 0, source: 'fallback', relaxed_clearance: relaxed, checks: { mean_free_m: +c.v.mean.toFixed(2), centre_m: +c.v.centre.toFixed(2) } };
  });
}
