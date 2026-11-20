// The real ground for the descent: the geo pack's Sentinel-2 plates (assets/geo/geo.json) on Copernicus GLO-30 terrain,
// nested coarse to fine. Each plate discards where a finer plate exists, so no two ever overlap (no z-fighting, no seams
// to fade). The finest plate (6.4 km) is draped on the twin's own rtp_terrain.glb. Real scale: no height exaggeration.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, GLSL_COMMON, GLSL_NOISE, loadTexture, fetchBytes, exists } from './core.js';

const EARTH_2R = 12742000;
const drop = (d) => Math.max(0, d - 4600) ** 2 / EARTH_2R;      // the Earth's curve, zero inside the twin's square

export const GROUND = {
  uGAmb: { value: new THREE.Color(.45, .47, .5) }, uGSun: { value: new THREE.Color(.75, .73, .7) },
  uSkyRefl: { value: new THREE.Color('#b8c8d6') }, uGlitter: { value: 1 },
};

function groundMaterial(tex, bounds, holes, { detail = null, water = true } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  m.userData.hzPatched = true; m.fog = false;
  const H = holes.slice(0, 6); while (H.length < 6) H.push(new THREE.Vector4(1, -1, 1, -1));
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, GROUND, { uPlate: { value: tex }, uBounds: { value: new THREE.Vector4(bounds.xmin, bounds.xmax, bounds.ymin, bounds.ymax) },
      uHoles: { value: H }, uDetail: { value: detail } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vW; varying vec3 vN; varying float vH; uniform vec4 uBounds; varying vec2 vPUv;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz; vN = normalize(mat3(modelMatrix) * normal); vH = vW.y;
        vPUv = vec2((vW.x - uBounds.x) / (uBounds.y - uBounds.x), (-vW.z - uBounds.z) / (uBounds.w - uBounds.z));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${GLSL_NOISE}
        varying vec3 vW; varying vec3 vN; varying float vH; varying vec2 vPUv;
        uniform sampler2D uPlate; uniform vec4 uHoles[6]; uniform vec3 uGAmb; uniform vec3 uGSun; uniform vec3 uSkyRefl; uniform float uGlitter;
        ${detail ? 'uniform sampler2D uDetail;' : ''}`)
      .replace('#include <map_fragment>', `
        for (int i = 0; i < 6; i++) { vec4 h = uHoles[i]; if (vW.x > h.x && vW.x < h.y && -vW.z > h.z && -vW.z < h.w) discard; }
        vec3 base = texture2D(uPlate, vPUv).rgb;
        { vec3 soft = texture2D(uPlate, vPUv, 2.0).rgb; base = max(base + (base - soft) * .55, base * .55); }
        ${detail ? `{ float dd = length(vW - cameraPosition); vec3 dt = texture2D(uDetail, vW.xz / 11.0).rgb; float l = dot(dt, vec3(.3333)) / .42;
           base *= mix(1.0, clamp(l, .6, 1.4), .35 * (1.0 - smoothstep(60.0, 700.0, dd))); }` : ''}
        vec3 n = normalize(vN);
        float lam = clamp(dot(n, uSunDir), 0.0, 1.0) / max(.35, uSunDir.y + .05);
        float cs = hz_cloudShadow(vW);
        vec3 col = base * (uGAmb + uGSun * mix(.75, lam, .4) * cs);
        ${water ? `
        // water: at sea level in the terrain and dark blue in the imagery (mangroves at sea level are green, so not water)
        float wl = smoothstep(-9.8, -11.0, vH) * (1.0 - smoothstep(.006, .045, base.g - max(base.r, base.b))) * (1.0 - smoothstep(.3, .46, dot(base, vec3(.33))));
        if (wl > .01) {
          vec3 rd = normalize(vW - cameraPosition);
          vec2 wp = vW.xz * .045 + uTime * vec2(.21, .13);
          vec2 g = vec2(texture2D(uWeather, wp * .11).r - texture2D(uWeather, wp * .11 + vec2(.013, 0.0)).r, texture2D(uWeather, wp * .093 + .4).r - texture2D(uWeather, wp * .093 + vec2(.4, .413)).r);
          vec3 wn = normalize(vec3(g.x * 9.0, 1.0, g.y * 9.0));
          vec3 r = reflect(rd, wn);
          float fr = .02 + .98 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 5.0);
          float sp = pow(max(dot(r, uSunDir), 0.0), 420.0) * 90.0 + pow(max(dot(r, uSunDir), 0.0), 40.0) * 1.2;
          vec3 wc = mix(col, uSkyRefl * (uGAmb + uGSun * .6), fr * .85) + uSunCol * sp * uGlitter * cs * smoothstep(-.02, .06, uSunDir.y);
          col = mix(col, wc, wl);
        }` : ''}
        diffuseColor.rgb = col;`)
      .replace('#include <fog_fragment>', `{ vec4 hz = hz_haze(vW); gl_FragColor.rgb = mix(gl_FragColor.rgb, hz.rgb, hz.a); }`);
  };
  m.customProgramCacheKey = () => 'hzground' + (detail ? 'd' : '') + (water ? 'w' : '');
  return m;
}

// terrain grid size: cols x rows (current geo.json) or grid [cols, rows] (earlier)
const gridOf = (t) => t.cols ? [t.cols, t.rows] : (t.grid || [0, 0]);
function terrainPath(geo, t) { const [c, r] = gridOf(t); return [t.file, `terrain/${t.id}_${c}x${r}.f32`].filter(Boolean); }

// geo: parsed geo.json; base: url prefix of assets/geo/
export async function loadGround(geo, base, { onPlate } = {}) {
  const root = new THREE.Group(); root.name = 'ground_plates';
  // from the 50 km plate down the geo pack offers a 12 Nov 2026 Sentinel-2 pass on the same ground (mosaics_2026): use it
  const recent = Object.fromEntries((geo.mosaics_2026 || []).map(m => [m.same_ground_as, m]));
  const plates = (geo.mosaics || []).filter(m => m.bounds_m && m.file).map(m => { const r = recent[m.id];
      return { ...m, file: r ? r.file : m.file, bytes: r ? r.bytes : m.bytes, vintage: r ? 2026 : 2016, w: m.bounds_m.xmax - m.bounds_m.xmin, h: m.bounds_m.ymax - m.bounds_m.ymin }; })
    .sort((a, b) => b.metres_per_px - a.metres_per_px);
  const terr = Object.fromEntries((geo.terrain || []).map(t => [t.id, t]));
  const heights = {};
  // fetch everything in parallel (progress counted), then build
  const jobs = plates.map(async (p, i) => {
    const tex = await loadTexture(base + p.file, { expect: p.bytes || 0 });
    let H = null; const t = terr[p.terrain || p.id];
    if (t) { for (const u of terrainPath(geo, t)) { try { const b = await fetchBytes(base + u, t.bytes || 0); H = { data: new Float32Array(b), t }; break; } catch (e) { /* next name */ } } }
    return { p, tex, H };
  });
  const got = await Promise.all(jobs);
  const isTwinPlate = (p) => Math.abs(p.w - 6400) < 1 && Math.abs(p.bounds_m.xmin + 3200) < 1;
  // the surface of an already built plate at (x, y), on the same two triangles per cell as THREE.PlaneGeometry
  const built = [];
  const surfaceAt = (B, x, y) => { const b = B.bounds; const fx = (x - b.xmin) / (b.xmax - b.xmin) * (B.cols - 1), fy = (b.ymax - y) / (b.ymax - b.ymin) * (B.rows - 1);
    const ix = Math.min(B.cols - 2, Math.max(0, Math.floor(fx))), iy = Math.min(B.rows - 2, Math.max(0, Math.floor(fy))), u = fx - ix, v = fy - iy, Y = B.Y, C = B.cols;
    const a = Y[iy * C + ix], bb = Y[(iy + 1) * C + ix], c = Y[(iy + 1) * C + ix + 1], d = Y[iy * C + ix + 1];
    return u + v <= 1 ? a + (d - a) * u + (bb - a) * v : c + (bb - c) * (1 - u) + (d - c) * (1 - v); };
  const coarserAt = (x, y) => { for (let i = built.length - 1; i >= 0; i--) { const b = built[i].bounds; if (x >= b.xmin - .01 && x <= b.xmax + .01 && y >= b.ymin - .01 && y <= b.ymax + .01) return built[i]; } return null; };
  function withSkirt(geom, cols, rows, depth) {
    const P = geom.attributes.position, UV = geom.attributes.uv, pos = [], nor = [], uv = [], idx = [];
    const ring = []; for (let i = 0; i < cols; i++) ring.push(i); for (let j = 1; j < rows; j++) ring.push(j * cols + cols - 1);
    for (let i = cols - 2; i >= 0; i--) ring.push((rows - 1) * cols + i); for (let j = rows - 2; j >= 0; j--) ring.push(j * cols);
    ring.forEach((k, n) => { pos.push(P.getX(k), P.getY(k), P.getZ(k), P.getX(k), P.getY(k) - depth, P.getZ(k)); nor.push(0, 1, 0, 0, 1, 0); uv.push(UV.getX(k), UV.getY(k), UV.getX(k), UV.getY(k));
      if (n < ring.length - 1) { const a = n * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const sk = new THREE.BufferGeometry(); sk.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sk.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    sk.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sk.setIndex(idx);
    return mergeGeometries([geom, sk]);
  }
  got.forEach(({ p, tex, H }, i) => {
    // finer plates that will actually draw (have terrain, or are the twin plate) are holes in this one
    const holes = got.slice(i + 1).filter(g => g.H || isTwinPlate(g.p)).map(g => new THREE.Vector4(g.p.bounds_m.xmin, g.p.bounds_m.xmax, g.p.bounds_m.ymin, g.p.bounds_m.ymax));
    if (isTwinPlate(p)) { root.userData.twinPlate = { tex, bounds: p.bounds_m }; return; }
    let geom;
    if (H) {
      // grid: row 0 north, columns west to east (PlaneGeometry order after rotateX(-90 deg))
      const [cols, rows] = gridOf(H.t);
      geom = new THREE.PlaneGeometry(p.w, p.h, cols - 1, rows - 1); geom.rotateX(-Math.PI / 2);
      const pos = geom.attributes.position, cx = (p.bounds_m.xmin + p.bounds_m.xmax) / 2, cy = (p.bounds_m.ymin + p.bounds_m.ymax) / 2;
      for (let k = 0; k < pos.count; k++) { const x = pos.getX(k) + cx, z = pos.getZ(k) - cy, d = Math.hypot(x, z);
        pos.setXYZ(k, x, (H.data[k] ?? 0) - drop(d), z); }
      geom.computeVertexNormals();
      // the border vertices take the height of the coarser plate they meet, so the two surfaces share an edge
      for (let k = 0; k < pos.count; k++) { const i = k % cols, j = Math.floor(k / cols); if (i && j && i < cols - 1 && j < rows - 1) continue;
        const x = pos.getX(k), y = -pos.getZ(k), B = coarserAt(x, y); if (B) pos.setY(k, surfaceAt(B, x, y)); }
      built.push({ bounds: p.bounds_m, cols, rows, Y: Float32Array.from({ length: pos.count }, (_, k) => pos.getY(k)) });
      geom = withSkirt(geom, cols, rows, Math.max(8, (p.w / (cols - 1)) * .25));
      geom.computeBoundingSphere();
      heights[p.id] = { data: H.data, cols, rows, bounds: p.bounds_m };
    } else {
      // no terrain: the backdrop plate, flat at sea level with the Earth's curve
      geom = new THREE.PlaneGeometry(p.w, p.h, 96, 96); geom.rotateX(-Math.PI / 2);
      const pos = geom.attributes.position, cx = (p.bounds_m.xmin + p.bounds_m.xmax) / 2, cy = (p.bounds_m.ymin + p.bounds_m.ymax) / 2;
      const sea = (geo.terrain && geo.terrain[0] && geo.terrain[0].sea_level_m) ?? -11.56;
      for (let k = 0; k < pos.count; k++) { const x = pos.getX(k) + cx, z = pos.getZ(k) - cy; pos.setXYZ(k, x, sea - drop(Math.hypot(x, z)), z); }
      geom.computeVertexNormals(); geom.computeBoundingSphere();
    }
    const mesh = new THREE.Mesh(geom, groundMaterial(tex, p.bounds_m, holes));
    mesh.name = 'plate_' + p.id; mesh.renderOrder = -10 + i; mesh.frustumCulled = false; mesh.userData.plate = p;
    root.add(mesh); if (onPlate) onPlate(mesh);
  });
  // CPU height lookup (rtp_local x, y) from the finest grid that covers the point; 0 inside the twin's flattened site
  root.userData.heightAt = (x, y) => {
    if (Math.hypot(x, y) < 560) return 0;
    const list = Object.values(heights).sort((a, b) => (a.bounds.xmax - a.bounds.xmin) - (b.bounds.xmax - b.bounds.xmin));
    for (const h of list) { const b = h.bounds; if (x <= b.xmin || x >= b.xmax || y <= b.ymin || y >= b.ymax) continue;
      const fx = (x - b.xmin) / (b.xmax - b.xmin) * (h.cols - 1), fy = (b.ymax - y) / (b.ymax - b.ymin) * (h.rows - 1);
      const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, at = (ii, jj) => h.data[Math.min(h.rows - 1, jj) * h.cols + Math.min(h.cols - 1, ii)] || 0;
      return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v; }
    return 0;
  };
  root.userData.vintages = [...new Set(plates.map(p => p.vintage))];
  root.userData.coarserSurface = (x, y) => { const B = coarserAt(x, y); return B ? surfaceAt(B, x, y) : null; };
  return root;
}

// the twin's own terrain (6.4 km, flattened inside 560 m) wears the 6.4 km plate, with its dry-grass texture as detail
export function drapeTwinTerrain(terrainRoot, twinPlate, coarserSurface = null) {
  if (!twinPlate) return;
  terrainRoot.updateMatrixWorld(true);
  terrainRoot.traverse(o => { if (!o.isMesh) return;
    // its outer border takes the 12 km plate's surface, so the two meet without a crack
    if (coarserSurface) { const P = o.geometry.attributes.position, v = new THREE.Vector3(), inv = o.matrixWorld.clone().invert(), b = twinPlate.bounds; let n = 0;
      for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k).applyMatrix4(o.matrixWorld); const x = v.x, y = -v.z;
        if (Math.min(Math.abs(x - b.xmin), Math.abs(x - b.xmax), Math.abs(y - b.ymin), Math.abs(y - b.ymax)) > 1.5) continue;
        const h = coarserSurface(x, y); if (h === null) continue; v.y = h - .3; v.applyMatrix4(inv); P.setXYZ(k, v.x, v.y, v.z); n++; }
      if (n) { P.needsUpdate = true; o.geometry.computeBoundingSphere(); } }
    const detail = o.material && o.material.map ? o.material.map : null;
    if (detail) { detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.needsUpdate = true; }
    o.material = groundMaterial(twinPlate.tex, twinPlate.bounds, [], { detail, water: true }); o.receiveShadow = true; o.renderOrder = -2; });
}

export function siteUnderlay(twinPlate) {
  const g = new THREE.CircleGeometry(432, 128); g.rotateX(-Math.PI / 2); g.translate(0, -.12, -45);
  const m = new THREE.Mesh(g, groundMaterial(twinPlate.tex, twinPlate.bounds, [], { water: false })); m.name = 'site_underlay'; m.receiveShadow = true; m.renderOrder = -3;
  return m;
}
export { groundMaterial };
