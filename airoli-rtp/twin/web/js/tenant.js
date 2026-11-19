// One tenant's floor: its layout, rooms, walkable grid, cameras and 3D model.
// The model is the Blender GLB when the manifest's file is there, else a clean placeholder built here from
// the CAD layout (extruded walls, glass, slab finishes, ceiling, desk / chair / table blocks).
// Everything in this group is in the tenant's own plan frame: three (x, y, z) = plan (x, z_up, -y).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NavGrid, ringsOf, inRings, area, centroid, boxRing, rectRing, roomRings, fallbackCameras } from './nav.js';

const P = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
const KIND_RX = [[/autopilot/i, 'operator'], [/recep|entry|lobby|waiting/i, 'reception'], [/train/i, 'training'], [/meeting|conference|interview|pax/i, 'meeting'],
  [/cafe|pantry/i, 'cafe'], [/lounge|collab/i, 'lounge'], [/work|sales|calling|finance|staff|control|cabin|cubic/i, 'work'],
  [/toilet|washroom|wc/i, 'wc'], [/ups|server|electric|janitor|battery/i, 'service'], [/lift|stair|shaft|duct/i, 'core'], [/autopilot/i, 'operator']];
export const kindOf = (r) => r.kind || (KIND_RX.find(([rx]) => rx.test(r.name)) || [0, 'other'])[1];
export const TOUR_KINDS = new Set(['reception', 'work', 'meeting', 'training', 'cafe', 'lounge']);
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Display names from CAD room text, without touching the layout data. "4 SEATER MEETING ROOM 01 (2)" -> "4-Seater Meeting
// Room 1B" (the CAD repeats "01" for three rooms; the pipeline numbers the copies), "16 PAX CONFERENCE ROOM" -> "16-Person
// Conference Room", "WORKSTATION - 238 NOS" -> "Workstations (238)", "CABIN-02" -> "Cabin 2", "Entry" -> "Entry Lobby".
const SMALL = new Set(['and', 'of', 'to', 'the']);
export function displayName(n) {
  let s = n.trim(), dup = null;
  const m = s.match(/\s*\((\d+)\)$/); if (m) { dup = +m[1]; s = s.slice(0, m.index); }
  s = s.replace(/WORKSTATIONS?\s*-\s*(\d+)\s*NOS.*$/i, 'Workstations ($1)')
    .replace(/TRAINING ROOM\s*-?\s*0*(\d+)\s+(\d+\s*\+\s*\d+)/i, 'Training Room $1 ($2)')
    .replace(/(\d+)\s*PAX\b/i, (x, k) => `${+k}-Person`).replace(/(\d+)\s*SEATER\b/i, (x, k) => `${+k}-Seater`)
    .replace(/\bRM\b/i, 'Room').replace(/\bCUBICAL\b/i, 'Cubicle').replace(/\s*\/\s*/g, ' / ').replace(/\s*-\s*(?=\d)/g, ' ')
    .replace(/\b0+(\d)/g, '$1').replace(/\s+/g, ' ').trim();
  s = s.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (x, a, c) => a + c.toUpperCase()).replace(/\b(And|Of|To|The)\b/g, (w, x, i) => i ? w.toLowerCase() : w)
    .replace(/-(Seater|Person)/g, (x, w) => '-' + w).replace(/\b(Ups|Ph|Ahu|Ac)\b/g, (w) => w.toUpperCase()).replace(/ Or /g, ' or ').replace(/-Side\b/, '-side');
  if (/^Entry$/i.test(s)) s = 'Entry Lobby';
  if (dup) s += /\d$/.test(s) && !/^Lift/.test(s) ? String.fromCharCode(64 + dup) : ' ' + dup;     // 1 -> 1A, 1B, 1C
  return s;
}
const nice = displayName;

// ------------------------------------------------------------------ textures drawn in the browser
function canvasTex(draw, size = 256, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let rs = 11; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  if (name === 'carpet') TEX[name] = canvasTex((g, n) => { g.fillStyle = '#7d7871'; g.fillRect(0, 0, n, n); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '40,38,35' : '160,152,140'},.18)`; g.fillRect(rnd() * n, rnd() * n, 6 + rnd() * 30, 1.5); } g.strokeStyle = 'rgba(0,0,0,.12)'; g.strokeRect(0, 0, n, n); }, 256, 1 / .6);
  if (name === 'wood') TEX[name] = canvasTex((g, n) => { for (let i = 0; i < 6; i++) { g.fillStyle = `hsl(32,38%,${58 + rnd() * 10}%)`; g.fillRect(0, i * n / 6, n, n / 6); for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(100,65,30,${.04 + rnd() * .05})`; g.fillRect(0, i * n / 6 + rnd() * n / 6, n, 1); } g.fillStyle = 'rgba(70,45,20,.25)'; g.fillRect(0, i * n / 6, n, 1.2); } }, 256, 1 / 1.2);
  if (name === 'stone') TEX[name] = canvasTex((g, n) => { g.fillStyle = '#dcd7cf'; g.fillRect(0, 0, n, n); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '90,80,70'},${rnd() * .07})`; g.fillRect(rnd() * n, rnd() * n, 2, 2); } g.strokeStyle = 'rgba(120,110,100,.3)'; g.strokeRect(0, 0, n, n); }, 256, 1 / 1.2);
  if (name === 'grid') TEX[name] = canvasTex((g, n) => { g.fillStyle = '#f1efea'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 3; g.strokeRect(0, 0, n, n); }, 128, 1 / .6);
  return TEX[name];
}
const MS = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .75, metalness: 0, ...o });

// Material presets used by the placeholder parts and by the option panel's swaps (true material swaps: a different
// material object on the mesh, with its own texture and roughness, never a tint on the rendered image).
export const PRESETS = {
  'carpet-grey': () => MS(0xffffff, { map: tex('carpet'), roughness: .95 }),
  'carpet-blue': () => MS(0x8fa3c4, { map: tex('carpet'), roughness: .95 }),
  'carpet-sand': () => MS(0xd8c6a8, { map: tex('carpet'), roughness: .95 }),
  'oak': () => MS(0xffffff, { map: tex('wood'), roughness: .5 }),
  'walnut': () => MS(0x8a5f43, { map: tex('wood'), roughness: .45 }),
  'white-laminate': () => MS(0xf3f1ec, { roughness: .35 }),
  'black-mesh': () => MS(0x1d1d1f, { roughness: .9 }),
  'teal-fabric': () => MS(0x2b6f78, { roughness: .95 }),
  'orange-fabric': () => MS(0xd9822f, { roughness: .95 }),
  'warm-white': () => MS(0xf2efea, { roughness: .9 }),
  'sage': () => MS(0xc9d3c3, { roughness: .9 }),
  'clay': () => MS(0xd9b9a3, { roughness: .9 }),
};

// ------------------------------------------------------------------ the tenant
export class Tenant {
  constructor(man, frameMatrix) { this.man = man; this.id = man.id; this.group = new THREE.Group(); this.group.name = 'tenant_' + man.id; this.parts = {}; this.owned = []; this.frame = frameMatrix; }
  async load(fetchJSON, exclude) {
    const L = this.L = await fetchJSON(this.man.layout);
    // region this tenant may walk: its demise (or the floor outline on Volt's older layout)
    this.region = L.demise ? ringsOf(L.demise.outer, L.demise.holes) : ringsOf(L.floor[0].outer, L.floor[0].holes);
    this.exclude = exclude || null;                 // rings (in this frame) of a neighbour that draws the shared strip
    const drawn = (x, y) => !this.exclude || !inRings(this.exclude, x, y);
    this.drawn = drawn;
    this.rooms = L.rooms.map(r => ({ ...r, kind: kindOf(r), label: nice(r.name), slug: slug(r.name), rings: roomRings(r) }))
      .map(r => ({ ...r, area: r.area_m2 || area(r.rings[0]), c: centroid(r.rings[0]) }));
    this.buildGrid();
    return this;
  }
  // ---------------------------------------------------------------- walkable grid
  buildGrid() {
    const L = this.L, xs = [], ys = []; this.region[0].forEach(p => { xs.push(p[0]); ys.push(p[1]); });
    const g = this.grid = new NavGrid([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], .1);
    g.fillRings(g.inside, this.region); g.closeInside(2);
    for (const r of this.rooms) if (r.kind === 'core' || r.kind === 'wc' || r.kind === 'service') g.fillRings(g.inside, r.rings, 0);   // never walk into shafts, lifts, toilets
    for (const w of L.walls) { g.fillRings(g.wall, ringsOf(w.outer, w.holes)); g.fillRings(g.see, ringsOf(w.outer, w.holes)); }
    for (const c of L.columns) { g.fillRings(g.wall, [c]); g.fillRings(g.see, [c]); }
    for (const [x0, y0, x1, y1] of L.glass) { g.fillSeg(g.wall, x0, y0, x1, y1, .05); g.fillSeg(g.see, x0, y0, x1, y1, .05); }
    // doors: the CAD leaves the opening free, but glass and partition lines sometimes run across it; open the opening
    const carve = ([ax, ay, bx, by]) => { const len = Math.hypot(bx - ax, by - ay); if (len < .5) return;
      const ux = (bx - ax) / len, uy = (by - ay) / len, s = .08;
      const ring = [[ax + ux * s - uy * .25, ay + uy * s + ux * .25], [bx - ux * s - uy * .25, by - uy * s + ux * .25], [bx - ux * s + uy * .25, by - uy * s - ux * .25], [ax + ux * s + uy * .25, ay + uy * s - ux * .25]];
      g.fillRings(g.wall, [ring], 0); g.fillRings(g.see, [ring], 0); };
    this.carved = 0;
    for (const d of L.doors) {
      // the closed-leaf line (`opening`, generic pipeline only): glass or partition lines sometimes run across it
      let op = d.opening;
      if (!op) {                                       // Volt's older file: only the open leaf (c, w, a). The hinge is the leaf end at the wall;
        const ex = Math.cos(d.a) * d.w / 2, ey = Math.sin(d.a) * d.w / 2, hit = (x, y) => { const i = g.ix(x), j = g.iy(y); return i >= 0 && j >= 0 && i < g.W && j < g.H && g.wall[j * g.W + i]; };
        const cands = [];                              // the closed leaf runs from the hinge, perpendicular to the open leaf, along the wall line to the far jamb
        for (const h of [[d.c[0] - ex, d.c[1] - ey], [d.c[0] + ex, d.c[1] + ey]]) for (const sgn of [1, -1]) {
          const nx = -Math.sin(d.a) * sgn, ny = Math.cos(d.a) * sgn; let ni = 0, e = 0;
          for (let k = 2; k <= 8; k++) if (hit(h[0] + nx * k / 10 * d.w, h[1] + ny * k / 10 * d.w)) ni++;
          for (const t of [.05, .12, .2]) if (hit(h[0] + nx * (d.w + t), h[1] + ny * (d.w + t))) e++;
          const free = (x, y) => { const i = g.ix(x), j = g.iy(y); return i >= 0 && j >= 0 && i < g.W && j < g.H && g.inside[j * g.W + i] && !g.wall[j * g.W + i]; };
          const mx = h[0] + nx * d.w / 2, my = h[1] + ny * d.w / 2, both = free(mx + Math.cos(d.a) * .45, my + Math.sin(d.a) * .45) && free(mx - Math.cos(d.a) * .45, my - Math.sin(d.a) * .45);
          cands.push({ op: [h[0], h[1], h[0] + nx * d.w, h[1] + ny * d.w], ni, e, both }); }
        const open = cands.filter(c => c.e && c.ni === 0 && c.both); if (open.length) continue;          // the gap is already there
        const pick = cands.filter(c => c.e && c.both).sort((a, b) => a.ni - b.ni);
        if (!pick.length) continue;
        // the wall is drawn through the opening (or the leaf is ambiguous): open every candidate with space on both sides
        for (const c of pick.filter(c => c.ni === pick[0].ni)) carve(c.op);
        continue;
      }
      carve(op);
    }
    for (const d of L.doors) if (d.hinge && d.open_leaf_tip) { g.fillSeg(g.furn, d.hinge[0], d.hinge[1], d.open_leaf_tip[0], d.open_leaf_tip[1], .03); g.fillSeg(g.see, d.hinge[0], d.hinge[1], d.open_leaf_tip[0], d.open_leaf_tip[1], .03); }   // open leaves, as drawn
    for (const d of L.desks) g.fillRings(g.furn, [rectRing(d.c[0], d.c[1], d.w, d.d, d.a)]);
    for (const t of L.tables) { if (t.circle) g.fillCircle(g.furn, t.circle[0], t.circle[1], t.circle[2]); else g.fillRings(g.furn, [t.poly]); }
    for (const s of L.seats) { if (s.kind.includes('sofa')) g.fillRings(g.furn, [rectRing(s.x, s.y, s.dep, s.len, s.face)]); else g.fillCircle(g.furn, s.x, s.y, .26); }
    for (const p of L.planters) g.fillRings(g.furn, [rectRing(p.c[0], p.c[1], p.w, p.d, p.a)]);
    for (const p of L.plants) if (!p.in_box) g.fillCircle(g.furn, p.x, p.y, Math.min(.35, p.r));
    g.finish();
  }
  doorsOf(r) {
    if (r.doors && r.doors.length) return r.doors.map(d => ({ c: d.opening ? [(d.opening[0] + d.opening[2]) / 2, (d.opening[1] + d.opening[3]) / 2] : d.c }));
    const [x0, y0, x1, y1] = r.box, m = .9;            // Volt's older layout: doors near the room's box edge
    return this.L.doors.filter(d => d.c[0] > x0 - m && d.c[0] < x1 + m && d.c[1] > y0 - m && d.c[1] < y1 + m &&
      Math.min(Math.abs(d.c[0] - x0), Math.abs(d.c[0] - x1), Math.abs(d.c[1] - y0), Math.abs(d.c[1] - y1)) < m).map(d => ({ c: d.c }));
  }
  // ---------------------------------------------------------------- rooms the viewer visits, with their views
  setupViews(blenderCams) {
    const L = this.L, byRoom = {};
    // two shapes: {cameras: [...]} (Skymark) or {rooms: {name: [...]}} (the RTP builder); hfov_deg is the same as fov_h_deg
    // the rooms-shape file is in glTF / three axes (x, height, -north): back to plan axes (x, north, height)
    const toPlanP = (p) => p && [p[0], -p[2], p[1]];
    const flat = blenderCams ? (blenderCams.cameras || Object.entries(blenderCams.rooms || {}).flatMap(([k, vs]) => vs.map(v => ({ room: k, ...v, position: toPlanP(v.position), target: toPlanP(v.target) })))) : [];
    for (const c of flat) (byRoom[c.room] = byRoom[c.room] || []).push({ ...c, fov_h_deg: c.fov_h_deg || c.hfov_deg, source: 'blender' });
    const ORDER = ['entry', 'feature', 'reverse', 'detail'];
    const list = [];
    for (const r of this.rooms) {
      if (!TOUR_KINDS.has(r.kind) || r.area < 6 || !this.drawn(r.c[0], r.c[1]) || /^unlabelled/i.test(r.name)) continue;
      if (!inRings(this.region, r.c[0], r.c[1]) && !this.rooms.length) continue;
      let cams = byRoom[r.name];
      if (!cams || !cams.length) {
        const focus = [...L.tables.map(t => t.circle ? [t.circle[0], t.circle[1]] : centroid(t.poly)), ...L.desks.filter(d => !/workstation/.test(d.kind)).map(d => d.c)];
        cams = fallbackCameras(this.grid, r, { doors: this.doorsOf(r), focus: focus.length ? focus : L.desks.map(d => d.c) });
      }
      cams = cams.filter(c => !c.failed || !c.failed.length || c.source !== 'blender' || true).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
      if (!cams.length) continue;
      list.push({ ...r, views: cams, seats: L.seats.filter(s => s.room === r.name).reduce((n, s) => n + (s.ids ? s.ids.length : 1), 0) });
    }
    // order: reception first, then nearest-next by walking distance (straight line as a proxy)
    const rec = list.find(r => this.man.reception && r.name === this.man.reception) || list.find(r => r.kind === 'reception') || list[0];
    const out = []; let cur = rec, left = list.filter(r => r !== rec);
    if (rec) out.push(rec);
    if (this.man.tour) { for (const n of this.man.tour) { const r = left.find(q => q.name === n); if (r) { out.push(r); left = left.filter(q => q !== r); } } }
    while (left.length) { left.sort((a, b) => Math.hypot(a.c[0] - cur.c[0], a.c[1] - cur.c[1]) - Math.hypot(b.c[0] - cur.c[0], b.c[1] - cur.c[1])); cur = left.shift(); out.push(cur); }
    // a room the walk cannot reach from reception (the CAD leaves it closed off) stays out of the room list, logged
    const r0 = out[0] && out[0].views[0].position;
    this.unreachable = r0 ? out.filter(r => r !== out[0] && !this.grid.path(r0[0], r0[1], r.views[0].position[0], r.views[0].position[1])).map(r => r.name) : [];
    if (this.unreachable.length) console.info('[twin]', this.id, 'rooms not reachable on foot from reception:', this.unreachable.join(', '));
    this.tourRooms = out.filter(r => !this.unreachable.includes(r.name)); return this.tourRooms;
  }
  roomAt(x, y) { return this.rooms.find(r => TOUR_KINDS.has(r.kind) && inRings(r.rings, x, y)); }

  // ---------------------------------------------------------------- placeholder model from the layout
  buildPlaceholder(opts = {}) {
    const L = this.L, H = L.heights.ceiling || 2.85, G = this.group, drawn = this.drawn, accent = new THREE.Color(this.man.accent || '#dd8d36');
    const part = (name, preset) => { if (!this.parts[name]) { const mk = typeof preset === 'function' ? preset : PRESETS[preset] || (() => MS(preset)); const m = mk(); m.name = name; this.parts[name] = { mat: m, meshes: [] }; this.owned.push(m); } return this.parts[name]; };
    const add = (geo, partName, preset, o = {}) => { const p = part(partName, preset); const m = new THREE.Mesh(geo, p.mat); m.castShadow = o.cast ?? true; m.receiveShadow = true; m.userData.part = partName; p.meshes.push(m); (o.parent || G).add(m); this.owned.push(geo); return m; };
    const shape = (rings) => { const s = new THREE.Shape(rings[0].map(([x, y]) => new THREE.Vector2(x, y))); rings.slice(1).forEach(h => s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))); return s; };
    const up = (rings, h, y0 = 0) => { const g = new THREE.ExtrudeGeometry(shape(rings), { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g; };
    const flat = (rings, y) => { const g = new THREE.ShapeGeometry(shape(rings)); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
    const ringC = (r) => centroid(r);

    // floor: carpet over the demise, finishes per room
    add(flat(this.region, .006), 'carpet', 'carpet-grey', { cast: false });
    const FIN = { reception: 'stone', cafe: 'wood', lounge: 'wood' };
    for (const r of this.rooms) { const f = FIN[r.kind] || (r.floor && r.floor !== 'carpet' ? (r.floor === 'stone' ? 'stone' : 'wood') : null); if (!f || !drawn(r.c[0], r.c[1])) continue;
      add(flat(r.rings, .009), f === 'stone' ? 'floorStone' : 'floorWood', f === 'stone' ? (() => MS(0xffffff, { map: tex('stone'), roughness: .35 })) : 'oak', { cast: false }); }
    // walls, columns (full height; the section view scales the wall group down)
    this.walls = new THREE.Group(); G.add(this.walls);
    const wg = [], cg = [];
    for (const w of L.walls) { const c = ringC(w.outer); if (drawn(c[0], c[1])) wg.push(up(ringsOf(w.outer, w.holes), H)); }
    for (const c of L.columns) cg.push(up([c], H));
    if (wg.length) add(mergeGeometries(wg), 'wall', 'warm-white', { parent: this.walls });
    if (cg.length) add(mergeGeometries(cg), 'column', 0xe9e6e0, { parent: this.walls });
    // glass partitions (facade glass is the building's curtain wall)
    const gl = [], mu = [];
    for (const [x0, y0, x1, y1, layer] of L.glass) {
      if (/WINDOW|STR/i.test(layer) || !drawn((x0 + x1) / 2, (y0 + y1) / 2)) continue;
      const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0); if (len < .05) continue;
      const m4 = new THREE.Matrix4().compose(P((x0 + x1) / 2, (y0 + y1) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1, 1, 1));
      gl.push(new THREE.BoxGeometry(len, H, .012).translate(0, H / 2, 0).applyMatrix4(m4));
      mu.push(new THREE.BoxGeometry(len, .05, .05).translate(0, .025, 0).applyMatrix4(m4), new THREE.BoxGeometry(len, .05, .05).translate(0, H - .025, 0).applyMatrix4(m4));
      const n = Math.max(1, Math.round(len / 1.2)); for (let i = 0; i <= n; i++) mu.push(new THREE.BoxGeometry(.04, H, .05).translate(-len / 2 + len * i / n, H / 2, 0).applyMatrix4(m4));
    }
    if (gl.length) { const m = add(mergeGeometries(gl), 'glassFilm', () => new THREE.MeshPhysicalMaterial({ color: 0xdbe8ec, roughness: .05, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }), { parent: this.walls, cast: false }); m.renderOrder = 5; }
    if (mu.length) add(mergeGeometries(mu), 'mullion', 0x2d2d2d, { parent: this.walls });
    // doors: one leaf each, drawn open as in the CAD
    const dl = [];
    for (const d of L.doors) {                       // the leaf from its hinge to the open tip as drawn; doors without a hinge (Volt's older file) are left open
      if (!d.hinge || !d.open_leaf_tip || !drawn(d.c[0], d.c[1])) continue; const [hx, hy] = d.hinge, [tx, ty] = d.open_leaf_tip, len = Math.hypot(tx - hx, ty - hy); if (len < .3) continue;
      const m4 = new THREE.Matrix4().compose(P((hx + tx) / 2, (hy + ty) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(ty - hy, tx - hx)), new THREE.Vector3(1, 1, 1));
      dl.push(new THREE.BoxGeometry(len, 2.1, .04).translate(0, 1.05, 0).applyMatrix4(m4)); }
    if (dl.length) add(mergeGeometries(dl), 'doors', 'oak', { parent: this.walls });

    // furniture as instanced blocks
    const inst = (geo, partName, preset, mats) => { if (!mats.length) return; const p = part(partName, preset); const m = new THREE.InstancedMesh(geo, p.mat, mats.length); mats.forEach((x, i) => m.setMatrixAt(i, x)); m.castShadow = m.receiveShadow = true; m.userData.part = partName; p.meshes.push(m); G.add(m); this.owned.push(geo); m.computeBoundingSphere(); };
    const mx = (x, y, a, h = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(P(x, y, h), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(sx, sy, sz));
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
    const tops = [], legs = [], scr = [];
    for (const d of L.desks) { if (!drawn(d.c[0], d.c[1])) continue; const h = d.h || .75;
      tops.push(mx(d.c[0], d.c[1], d.a, h - .03, d.w, .03, d.d));
      for (const e of [-1, 1]) legs.push(mx(d.c[0] + Math.cos(d.a) * e * (d.w / 2 - .03), d.c[1] + Math.sin(d.a) * e * (d.w / 2 - .03), d.a, 0, .04, h - .03, d.d * .85));
      if (/workstation/.test(d.kind)) scr.push(mx(d.c[0] - Math.sin(d.a) * (d.d / 2 - .02), d.c[1] + Math.cos(d.a) * (d.d / 2 - .02), d.a, h, d.w - .04, .36, .025)); }
    inst(box.clone(), 'deskTop', 'white-laminate', tops); inst(box.clone(), 'deskFrame', 0xdedcd7, legs); inst(box.clone(), 'screens', 'orange-fabric', scr);
    // chairs: seat, back and stem in one geometry; local +x = where the sitter faces
    const chairG = mergeGeometries([new THREE.BoxGeometry(.46, .07, .46).translate(0, .47, 0), new THREE.BoxGeometry(.06, .5, .44).translate(-.22, .78, 0), new THREE.CylinderGeometry(.025, .025, .42, 8).translate(0, .22, 0), new THREE.CylinderGeometry(.26, .26, .03, 12).translate(0, .03, 0)]);
    const ch = [], so = [];
    for (const s of L.seats) { if (!drawn(s.x, s.y)) continue; if (s.kind.includes('sofa')) so.push(s); else ch.push(mx(s.x, s.y, s.face)); }
    inst(chairG, 'chair', 'black-mesh', ch);
    for (const s of so) { const len = Math.max(1.2, s.len), dep = Math.min(.95, Math.max(.7, s.dep));
      add(mergeGeometries([new THREE.BoxGeometry(dep, .42, len).translate(0, .21, 0), new THREE.BoxGeometry(.18, .4, len).translate(-dep / 2 + .09, .62, 0)]).applyMatrix4(mx(s.x, s.y, s.face)), 'sofa', 'teal-fabric'); }
    // tables
    const tg = [];
    for (const t of L.tables) { const c = t.circle ? t.circle : centroid(t.poly); if (!drawn(c[0], c[1])) continue;
      if (/toilet|washroom/i.test(t.room || '')) continue;
      if (t.circle) tg.push(new THREE.CylinderGeometry(t.circle[2], t.circle[2], .04, 28).translate(t.circle[0], t.h - .02, -t.circle[1]), new THREE.CylinderGeometry(.04, .04, t.h - .04, 8).translate(t.circle[0], (t.h - .04) / 2, -t.circle[1]));
      else { tg.push(up([t.poly], .04, t.h - .04)); const xs = t.poly.map(p => p[0]), ys = t.poly.map(p => p[1]); tg.push(new THREE.BoxGeometry(.08, t.h - .04, .08).translate((Math.min(...xs) + Math.max(...xs)) / 2, (t.h - .04) / 2, -(Math.min(...ys) + Math.max(...ys)) / 2)); } }
    if (tg.length) add(mergeGeometries(tg.map(g => g.index ? g.toNonIndexed() : g)), 'table', 'oak');
    // planters and plants
    const pl = [], lv = [];
    for (const p of L.planters) if (drawn(p.c[0], p.c[1])) pl.push(mx(p.c[0], p.c[1], p.a, 0, p.w, L.heights.planter || 1, p.d));
    for (const p of L.plants) if (drawn(p.x, p.y)) lv.push(mx(p.x, p.y, 0, p.in_box ? (L.heights.planter || 1) : 0, Math.max(.6, p.r * 2), Math.max(.6, p.r * 2), Math.max(.6, p.r * 2)));
    inst(box.clone(), 'planter', 0xf0eee9, pl);
    inst(new THREE.IcosahedronGeometry(.45, 1).translate(0, .55, 0), 'leaf', 0x4f7f3a, lv);
    // reception / feature accent: the tenant colour on the reception's longest wall-side bench (a simple cue)
    // ceiling, facing down, with light panels: shown only inside
    this.ceiling = new THREE.Group(); G.add(this.ceiling);
    add(flat(this.region, H), 'ceiling', () => MS(0xffffff, { map: tex('grid'), roughness: .95, side: THREE.BackSide }), { parent: this.ceiling, cast: false });
    const lights = L.lights.filter(l => drawn(l.c[0], l.c[1]));
    const lp = new THREE.MeshBasicMaterial({ color: 0xfffaf0 }); this.owned.push(lp);
    const pg = new THREE.PlaneGeometry(.6, .6).rotateX(Math.PI / 2), dg = new THREE.CircleGeometry(.08, 12).rotateX(Math.PI / 2), lg = new THREE.PlaneGeometry(1, .08).rotateX(Math.PI / 2);
    const byK = { panel600: [pg, []], downlight: [dg, []], linear: [lg, []] };
    for (const l of lights) { const b = byK[l.kind]; if (!b) continue; b[1].push(mx(l.c[0], l.c[1], l.a || 0, H - .006, l.kind === 'linear' ? (l.len || 1.2) : 1, 1, 1)); }
    for (const [g, list] of Object.values(byK)) if (list.length) { const m = new THREE.InstancedMesh(g, lp, list.length); list.forEach((x, i) => m.setMatrixAt(i, x)); this.ceiling.add(m); this.owned.push(g); }
    this.ceiling.visible = false;
    this.kind = 'placeholder';
    return this;
  }

  // ---------------------------------------------------------------- the Blender GLB (lightmapped, meshopt)
  async loadGLB(loader, viewer, base) {
    const gltf = await loader.loadAsync(base + viewer.glb);
    const root = gltf.scene; this.group.add(root); this.kind = 'glb'; this.gltf = gltf;
    const lmTex = {}, TL = new THREE.TextureLoader();
    const LMS = viewer.lightmaps || (viewer.lightmapped_meshes && viewer.lightmapped_meshes.nodes);   // bake_export.py writes lightmapped_meshes.nodes; older exports wrote lightmaps
    const mats = {}; root.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { mats[m.name] = m; }); } });
    this.glbMats = mats;
    const jobs = [];
    root.traverse(o => {
      if (o.userData && o.userData.collision) { o.visible = false; this.collision = o; return; }
      const lm = LMS && (LMS[o.name] || (o.parent && LMS[o.parent.name]));
      if (lm && o.isMesh) jobs.push((async () => {
        const url = base + lm.lightmap; const t = lmTex[url] || (lmTex[url] = TL.loadAsync(url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.channel = 1; return t; }));
        const tx = await t, src = o.material;
        // baked light only: a lightmapped surface must not be lit again by the sun, sky or environment, so it becomes an
        // unlit material whose light is the lightmap (r169 MeshBasicMaterial: albedo x lightMap x intensity / pi, the
        // same as the standard material's lightmap term, with nothing else added)
        const m = new THREE.MeshBasicMaterial({ name: src.name, color: src.color, map: src.map, lightMap: tx, lightMapIntensity: lm.lightMapIntensity,
          transparent: src.transparent, opacity: src.opacity, side: src.side, alphaTest: src.alphaTest || 0 });
        o.material = m; this.owned.push(m); this.lightmapped = (this.lightmapped || 0) + 1;
      })());
      if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; for (const m of [].concat(o.material)) if (m && 'envMapIntensity' in m) m.envMapIntensity = .6; }
    });
    await Promise.all(jobs);
    // the builder tags every node with its CAD layer (extras.twin_layer): ceilings and lamps hide in the section view,
    // walls / glass / doors scale down for the cut-away
    const CEIL = new Set(['CEILING', 'LIGHT', 'HVAC', 'SLAB']), WALL = new Set(['WALL', 'GLASS', 'DOOR', 'COLUMN', 'BLIND', 'SKIRTING', 'RAILING', 'LOGO']);
    this.ceilingMeshes = []; this.wallMeshes = [];
    root.children.forEach(n => { const lay = (n.userData && n.userData.twin_layer) || (n.name.split('_')[1] || '').toUpperCase();
      if (CEIL.has(lay)) this.ceilingMeshes.push(n); else if (WALL.has(lay)) this.wallMeshes.push(n); });
    // the web path's own exposure wins (renderer.exposure_ev, for the viewer's tone mapping); the stills' EV is separate
    this.exposureEV = (viewer.renderer && typeof viewer.renderer.exposure_ev === 'number') ? viewer.renderer.exposure_ev : (viewer.exposure_ev || 0);
    this.toneMapping = (viewer.renderer && viewer.renderer.toneMapping) || 'NeutralToneMapping';
    return this;
  }
  setCeiling(on) { if (this.kind === 'glb') this.ceilingMeshes.forEach(m => m.visible = on); else if (this.ceiling) this.ceiling.visible = on; }
  setWallScale(s) {
    if (this.kind === 'glb') { this.wallMeshes.forEach(m => { if (m.userData.sy0 === undefined) m.userData.sy0 = m.scale.y; m.scale.y = m.userData.sy0 * s; }); }
    else if (this.walls) this.walls.scale.y = s;
  }
  // a true material swap: the option's material object replaces the part's, on every mesh of that part
  applyOption(partName, choice) {
    if (this.kind === 'glb') {
      const want = choice.material && this.glbMats[choice.material]; if (!want) return false;
      const from = choice.part_material || partName; this.group.traverse(o => { if (o.isMesh && o.material && (o.material.name === from || o.userData.swapFrom === from)) { o.userData.swapFrom = from; o.material = want; } });
      return true;
    }
    const p = this.parts[partName]; if (!p) return false;
    const key = choice.preset; if (!PRESETS[key]) return false;
    const m = PRESETS[key](); m.name = partName; this.owned.push(m);
    p.meshes.forEach(mesh => { mesh.material = m; }); p.mat = m; return true;
  }
  dispose() {
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { for (const k in m) if (m[k] && m[k].isTexture && !Object.values(TEX).includes(m[k])) m[k].dispose(); m.dispose(); }); });
    this.owned.forEach(x => x.dispose && x.dispose()); this.group.removeFromParent(); this.owned = []; this.parts = {};
  }
}
