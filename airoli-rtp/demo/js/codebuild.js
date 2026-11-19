// Reliable Tech Park built entirely in the browser: no Blender, no GLB, no baked maps. Input is the CAD facade line
// (plate.json 'outer', rtp_local metres) plus the floor count and heights; everything else is generated here:
// the banded curtain wall (reflective blue-green glass ribbons between silver slab bands), terraced round ends,
// the roof with its parapet, plant and drums, the dome, the RELIABLE sign and the entrance canopy.
// three (x, y, z) = rtp_local (x, height, -y). Every repeated element comes from one module: a 1.5 m glazing panel.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PANEL = 1.5;                                         // the facade module (m): mullion pitch
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const ccw = (r) => { let A = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; A += a[0] * b[1] - b[0] * a[1]; } return A >= 0 ? r.slice() : r.slice().reverse(); };
const inRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; if (repeat) t.repeat.set(repeat[0], repeat[1]); return t;
}

// ---- the outline, prepared once: clean ring, per-vertex outward normals (mitred), distance along the perimeter
function prepRing(outer) {
  let R = ccw(outer).filter((p, i, a) => { const q = a[(i + 1) % a.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > .05; });
  const n = R.length, en = [], vn = [], turn = [], dist = [0];
  for (let i = 0; i < n; i++) { const a = R[i], b = R[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); en.push([(b[1] - a[1]) / l, -(b[0] - a[0]) / l]); dist.push(dist[i] + l); }
  for (let i = 0; i < n; i++) { const p = en[(i - 1 + n) % n], q = en[i], d = p[0] * q[0] + p[1] * q[1], t = Math.acos(Math.max(-1, Math.min(1, d)));
    turn.push(t); let mx = p[0] + q[0], my = p[1] + q[1], ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml; const k = 1 / Math.max(.5, Math.cos(t / 2)); vn.push([mx * k, my * k, t]); }
  return { R, n, en, vn, turn, dist, length: dist[n] };
}
// a closed wall of quads along the ring: offset out by `off` (m), from z0 to z1; u runs along the perimeter in metres / uM
function wall(P, off, z0, z1, uM = 1, vRange = [0, 1], pick = null) {
  const pos = [], nor = [], uv = [], { R, n, en, vn, turn, dist } = P;
  for (let i = 0; i < n; i++) {
    if (pick && !pick(i)) continue; const j = (i + 1) % n, e = en[i];
    const sm = (k) => turn[k] < .6;                       // smooth across gentle bends (the round ends), hard at real corners
    const na = sm(i) ? vn[i] : e, nb = sm(j) ? vn[j] : e, oa = sm(i) ? vn[i] : [e[0], e[1]], ob = sm(j) ? vn[j] : [e[0], e[1]];
    const ax = R[i][0] + oa[0] * off, ay = R[i][1] + oa[1] * off, bx = R[j][0] + ob[0] * off, by = R[j][1] + ob[1] * off;
    const A0 = [ax, z0, -ay], B0 = [bx, z0, -by], B1 = [bx, z1, -by], A1 = [ax, z1, -ay], ua = dist[i] / uM, ub = dist[i + 1] / uM;
    const nA = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, 0, -v[1] / l]; }, NA = nA(na), NB = nA(nb);
    pos.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1); nor.push(...NA, ...NB, ...NB, ...NA, ...NB, ...NA);
    uv.push(ua, vRange[0], ub, vRange[0], ub, vRange[1], ua, vRange[0], ub, vRange[1], ua, vRange[1]);
  }
  return geo(pos, nor, uv);
}
// a flat ring strip (a slab edge's top or underside) between two offsets at height z
function shelf(P, off0, off1, z, up = true, pick = null) {
  const pos = [], nor = [], uv = [], { R, n, en, vn, turn, dist } = P;
  for (let i = 0; i < n; i++) {
    if (pick && !pick(i)) continue; const j = (i + 1) % n, e = en[i], oa = turn[i] < .6 ? vn[i] : e, ob = turn[j] < .6 ? vn[j] : e;
    const p = (k, o, off) => [R[k][0] + o[0] * off, z, -(R[k][1] + o[1] * off)];
    const ai = p(i, oa, off0), ao = p(i, oa, off1), bo = p(j, ob, off1), bi = p(j, ob, off0);
    const q = up ? [ai, ao, bo, ai, bo, bi] : [ai, bo, ao, ai, bi, bo]; for (const v of q) { pos.push(...v); nor.push(0, up ? 1 : -1, 0); uv.push(dist[i], 0); }
  }
  return geo(pos, nor, uv);
}
function geo(pos, nor, uv) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; }
// the round ends: runs of gently turning vertices, each fitted with a circle (centre, radius)
function roundEnds(P) {
  const { R, n, turn } = P, on = turn.map(t => t > .07 && t < .6), runs = []; let start = on.findIndex((v, i) => v && !on[(i - 1 + n) % n]);
  if (start < 0) return [];
  for (let k = 0, i = start; k < n; k++, i = (i + 1) % n) { if (on[i]) { if (!runs.length || runs[runs.length - 1].done) runs.push({ idx: [], done: false }); runs[runs.length - 1].idx.push(i); } else if (runs.length) runs[runs.length - 1].done = true; }
  return runs.map(r => { const sweep = r.idx.reduce((a, i) => a + turn[i], 0); if (sweep < 2.2 || r.idx.length < 5) return null;       // more than ~125 degrees of arc
    const pts = r.idx.map(i => R[i]); let sx = 0, sy = 0; for (const p of pts) { sx += p[0]; sy += p[1]; } const mx = sx / pts.length, my = sy / pts.length;
    let Suu = 0, Suv = 0, Svv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;                    // least-squares circle
    for (const p of pts) { const u = p[0] - mx, v = p[1] - my; Suu += u * u; Suv += u * v; Svv += v * v; Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u; }
    const det = Suu * Svv - Suv * Suv; if (Math.abs(det) < 1e-9) return null;
    const uc = ((Suuu + Suvv) / 2 * Svv - (Svvv + Svuu) / 2 * Suv) / det, vc = ((Svvv + Svuu) / 2 * Suu - (Suuu + Suvv) / 2 * Suv) / det;
    return { c: [mx + uc, my + vc], r: Math.sqrt(uc * uc + vc * vc + (Suu + Svv) / pts.length), idx: new Set(r.idx), sweep };
  }).filter(Boolean).sort((a, b) => b.r - a.r);
}

function materials(levelsGlassH) {
  // one curtain-wall texture: 32 panels (48 m) wide so the repeat is not seen; a transom, mullions, tint drift, the odd louvre
  const glassMap = tex(2048, 256, (g, w, h) => {
    const pw = w / 32;
    for (let i = 0; i < 32; i++) { const k = hash(i, 3), lou = hash(i, 9) < .045;
      const top = lou ? '#22292c' : `hsl(${186 + k * 10},${34 + k * 10}%,${46 + hash(i, 5) * 9}%)`, bot = lou ? '#1b2124' : `hsl(${190 + k * 8},${36 + k * 8}%,${36 + hash(i, 6) * 7}%)`;
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(i * pw, 0, pw, h);
      if (lou) { g.fillStyle = 'rgba(255,255,255,.07)'; for (let y = 6; y < h; y += 10) g.fillRect(i * pw + 3, y, pw - 6, 2); }
      if (hash(i, 14) < .22 && !lou) { g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(i * pw, 0, pw, h * (.25 + hash(i, 15) * .3)); }   // a blind part down
    }
    g.fillStyle = '#141b1e'; for (let i = 0; i <= 32; i++) g.fillRect(i * pw - 2, 0, 4, h);            // mullions
    g.fillStyle = '#1a2225'; g.fillRect(0, h * .30, w, 3); g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);   // transom, head, sill
  });
  const rough = tex(2048, 256, (g, w, h) => { g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, w, h); const pw = w / 32; g.fillStyle = '#9a9a9a'; for (let i = 0; i <= 32; i++) g.fillRect(i * pw - 2, 0, 4, h); g.fillRect(0, h * .30, w, 3); for (let i = 0; i < 32; i++) if (hash(i, 9) < .045) g.fillRect(i * pw, 0, pw, h); });
  rough.colorSpace = THREE.NoColorSpace;
  const acpMap = tex(512, 64, (g, w, h) => { g.fillStyle = '#d6dadd'; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(0,0,0,${.02 + hash(i, 2) * .04})`; g.fillRect(i * 64, 0, 64, h); } g.fillStyle = 'rgba(40,46,50,.55)'; for (let i = 0; i <= 8; i++) g.fillRect(i * 64 - 1, 0, 2, h); });
  const roofMap = tex(256, 256, (g, w, h) => { g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${hash(i, 1) < .5 ? '60,55,48' : '235,230,220'},${.06 + hash(i, 2) * .12})`; g.fillRect(hash(i, 3) * w, hash(i, 4) * h, 2, 2); } }, [1 / 6, 1 / 6]);
  const stoneMap = tex(256, 128, (g, w, h) => { g.fillStyle = '#4a4744'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h); g.fillRect(0, h / 2, w, 2); });
  return {
    glass: new THREE.MeshStandardMaterial({ map: glassMap, roughnessMap: rough, metalness: 1, roughness: 1, envMapIntensity: 1.35, name: 'cw_glass' }),
    acp: new THREE.MeshStandardMaterial({ map: acpMap, color: 0xffffff, metalness: .8, roughness: .34, envMapIntensity: 1.0, name: 'acp' }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b2023, metalness: .4, roughness: .6, name: 'reveal' }),
    roof: new THREE.MeshStandardMaterial({ map: roofMap, roughness: 1, name: 'roof' }),
    stone: new THREE.MeshStandardMaterial({ map: stoneMap, roughness: .8, name: 'plinth' }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f1ee, roughness: .55, name: 'white' }),
    steel: new THREE.MeshStandardMaterial({ color: 0xaab0b4, metalness: .9, roughness: .35, name: 'steel' }),
    rail: new THREE.MeshStandardMaterial({ color: 0x9fc7cf, metalness: .9, roughness: .08, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide, name: 'rail_glass' }),
    plant: new THREE.MeshStandardMaterial({ color: 0xc9ccce, metalness: .5, roughness: .55, name: 'plant' }),
  };
}

export function buildRTP({ outer, levels, ftf, ffl0 }) {
  const P = prepRing(outer), M = materials(), g = new THREE.Group(); g.name = 'rtp_code_built';
  const ZL = (lv) => lv === 0 ? 0 : ffl0 + lv * ftf, H = ffl0 + levels * ftf, ends = roundEnds(P), onEnd = (i) => ends.some(e => e.idx.has(i) && e.idx.has((i + 1) % P.n));
  const G = { glass: [], acp: [], dark: [], stone: [], rail: [], steel: [], white: [], plant: [] };
  const BAND = .9, PROJ = .3, TERR = 1.5;                       // slab band height, its projection, the terraces' depth at the round ends
  for (let lv = 0; lv < levels; lv++) {
    const z0 = ZL(lv), z1 = ZL(lv + 1), g0 = lv === 0 ? ffl0 : z0 + .35, g1 = z1 - (BAND - .35);
    if (lv === 0) G.stone.push(wall(P, .12, 0, ffl0, 3, [0, 1]));
    G.glass.push(wall(P, 0, g0, g1, PANEL * 32, [0, 1]));
    // the slab band at the top of this floor: face, top and underside, with a dark shadow gap under it
    const b0 = z1 - (BAND - .35), b1 = z1 + .35;
    G.acp.push(wall(P, PROJ, b0, b1, 9.6, [0, 1], (i) => !onEnd(i)), shelf(P, 0, PROJ, b1, true, (i) => !onEnd(i)));
    G.dark.push(shelf(P, 0, PROJ, b0, false, (i) => !onEnd(i)), wall(P, .02, b0 - .08, b0, 1, [0, 1]));
    // the round ends are terraced: a deeper slab, a glass rail and a steel handrail on every floor
    if (ends.length) {
      G.acp.push(wall(P, TERR, b0, b1, 9.6, [0, 1], onEnd), shelf(P, 0, TERR, b1, true, onEnd)); G.dark.push(shelf(P, 0, TERR, b0, false, onEnd));
      if (lv < levels - 1) { G.rail.push(wall(P, TERR - .08, b1, b1 + 1.05, 1, [0, 1], onEnd)); G.steel.push(wall(P, TERR - .05, b1 + 1.05, b1 + 1.11, 1, [0, 1], onEnd), shelf(P, TERR - .11, TERR - .05, b1 + 1.11, true, onEnd)); }
    }
  }
  // ---- roof: slab, parapet with coping, plant on the gravel
  const shape = new THREE.Shape(P.R.map(([x, y]) => new THREE.Vector2(x, y)));
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .35, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, H, 0), M.roof); roof.name = 'roof';
  G.acp.push(wall(P, PROJ, H + .35, H + 1.45, 9.6, [0, 1]), wall(P, -.25, H + .35, H + 1.45, 9.6, [0, 1]).scale(1, 1, 1), shelf(P, -.25, PROJ, H + 1.45, true));
  // plant, placed by rule on points well inside the outline: chillers with fans, air handlers, tanks, stair heads
  const xs = P.R.map(p => p[0]), ys = P.R.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const inside = (x, y, m) => inRing(P.R, x, y) && [[m, 0], [-m, 0], [0, m], [0, -m], [m * .7, m * .7], [-m * .7, -m * .7], [m * .7, -m * .7], [-m * .7, m * .7]].every(([dx, dy]) => inRing(P.R, x + dx, y + dy));
  const spots = []; for (let y = y0; y < y1; y += 9) for (let x = x0; x < x1; x += 9) { const px = x + hash(x, y) * 4, py = y + hash(y, x) * 4; if (inside(px, py, 7) && !ends.some(e => Math.hypot(px - e.c[0], py - e.c[1]) < e.r + 3)) spots.push([px, py]); }
  const box = (w, h, d, x, y, z, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, z + h / 2, -y);
  const top = H + .35, fans = [];
  spots.forEach(([x, y], i) => { const k = hash(i, 21), ry = hash(i, 22) < .5 ? 0 : Math.PI / 2;
    if (k < .34) { G.plant.push(box(6.4, 2.3, 2.4, x, y, top + .25, ry)); G.dark.push(box(6.6, .25, 2.6, x, y, top, ry)); for (const s of [-2, 0, 2]) fans.push([x + (ry ? 0 : s), y + (ry ? s : 0), top + 2.56]); }
    else if (k < .55) { G.white.push(box(3.2, 1.9, 2.2, x, y, top + .2, ry)); G.dark.push(box(.5, .5, 5, x + (ry ? 1.2 : 0), y + (ry ? 0 : 1.2), top + .9, ry + Math.PI / 2)); }
    else if (k < .7) { for (const s of [-1.5, 1.5]) G.white.push(new THREE.CylinderGeometry(1.25, 1.25, 2.4, 20).translate(x + s, top + 1.5, -y)); G.dark.push(box(6, .3, 3, x, y, top, 0)); }
    else if (k < .8) { G.acp.push(box(6.5, 3.2, 4.5, x, y, top, ry)); G.dark.push(box(1.1, 2.1, .08, x + (ry ? 2.28 : 0), y + (ry ? 0 : -2.28), top, ry)); }
  });
  if (fans.length) { const fg = fans.map(([x, y, z]) => new THREE.CylinderGeometry(.82, .82, .12, 20).translate(x, z, -y)); G.dark.push(...fg); }
  // ---- drums over the round ends: a glazed drum, a cornice, a cap; the dome on the larger, the sign on the other
  const signT = tex(1024, 192, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#d3232a'; c.font = '800 150px Inter, Arial, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText('RELIABLE', w / 2, h / 2 + 8); });
  let cx = 0, cy = 0; for (const p of P.R) { cx += p[0]; cy += p[1]; } cx /= P.n; cy /= P.n;
  ends.slice(0, 2).forEach((e, i) => {
    const r = Math.max(4.5, e.r - 4.2 - i * .6), hD = 6.2, base = top;
    const drum = new THREE.CylinderGeometry(r, r, hD, 72, 1, true); { const uv = drum.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (2 * Math.PI * r) / (PANEL * 32)); }
    const dm = new THREE.Mesh(drum.translate(e.c[0], base + hD / 2, -e.c[1]), M.glass); dm.castShadow = dm.receiveShadow = true; g.add(dm);
    G.acp.push(new THREE.CylinderGeometry(r + .35, r + .35, .7, 72).translate(e.c[0], base + hD + .35, -e.c[1]), new THREE.CylinderGeometry(r + .25, r + .25, .5, 72).translate(e.c[0], base + .25, -e.c[1]));
    if (i === 0) G.white.push(new THREE.SphereGeometry(r * .86, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .5, 1).translate(e.c[0], base + hD + .7, -e.c[1]), new THREE.CylinderGeometry(.18, .18, 3.2, 8).translate(e.c[0], base + hD + .7 + r * .43 + 1.2, -e.c[1]));
    else {   // the sign faces the court (towards the middle of the outline's bounding box), curved round the drum
      const a = Math.atan2(cy - e.c[1], cx - e.c[0]), arc = 15 / (r + .4), sg = new THREE.CylinderGeometry(r + .42, r + .42, 2.7, 40, 1, true, 0, arc);
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: (signT.wrapS = THREE.ClampToEdgeWrapping, signT), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
      // CylinderGeometry's theta 0 is +z in three; the court direction in three is (cos a, -sin a) in (x, z)
      m.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a)) - arc / 2; m.position.set(e.c[0], base + hD * .62, -e.c[1]); m.renderOrder = 5; m.name = 'reliable_sign'; g.add(m);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(r + .3, r + .3, 3.1, 40, 1, true, 0, arc + .06), M.white); back.rotation.y = m.rotation.y - .03; back.position.copy(m.position); g.add(back);
    }
  });
  // ---- the entrance: a canopy on two columns where the outline comes nearest the Maps pin (the gate side)
  { let bi = 0, bd = 1e9; for (let i = 0; i < P.n; i++) { const mx = (P.R[i][0] + P.R[(i + 1) % P.n][0]) / 2, my = (P.R[i][1] + P.R[(i + 1) % P.n][1]) / 2, d = Math.hypot(mx, my); if (d < bd && !onEnd(i)) { bd = d; bi = i; } }
    const a = P.R[bi], b = P.R[(bi + 1) % P.n], n = P.en[bi], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const at = (along, out, z, w, h, d, mat) => { const x = mx + Math.cos(ang) * along + n[0] * out, y = my + Math.sin(ang) * along + n[1] * out; G[mat].push(new THREE.BoxGeometry(w, h, d).rotateY(ang).translate(x, z + h / 2, -y)); };
    at(0, 3.6, 4.6, 14, .45, 7.2, 'acp'); at(0, 3.6, 4.45, 13.6, .15, 6.8, 'dark'); at(-5.6, 6.4, 0, .5, 4.6, .5, 'steel'); at(5.6, 6.4, 0, .5, 4.6, .5, 'steel'); at(0, 3.4, 0, 16, .18, 8, 'stone'); }
  const add = (list, mat, name, cast = true) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list.map(x => x.index ? x.toNonIndexed() : x).map(x => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); return x; })), mat); m.name = name; m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
  add(G.glass, M.glass, 'curtain_wall'); add(G.acp, M.acp, 'acp_bands'); add(G.dark, M.dark, 'reveals'); add(G.stone, M.stone, 'plinth'); add(G.steel, M.steel, 'steel'); add(G.white, M.white, 'white'); add(G.plant, M.plant, 'plant');
  const rl = add(G.rail, M.rail, 'terrace_rails', false); if (rl) rl.renderOrder = 4;
  roof.castShadow = roof.receiveShadow = true; g.add(roof);
  let tris = 0; g.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { group: g, mats: M, height: H + 1.45, ends, triangles: Math.round(tris) };
}
