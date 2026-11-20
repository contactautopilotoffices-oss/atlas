// The real building and its 500 m city: the exterior worker's Blender bake (twin/web/models/exterior, read only), with
// glass that behaves like glass (env reflections, Fresnel, sun glints, per-pane tilt, lit rooms behind every pane),
// baked AO, night emission levels from the bake's extras, wind in the foliage and traffic on the real roads.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { U, GLSL_NOISE, patchMaterial, fetchBytes, loadTexture, W } from './core.js';

export const GLASS = {
  uRoomK: { value: .4 }, uRoomBright: { value: .32 }, uLitLevel: { value: -1 }, uLitK: { value: 0 }, uPaneJitter: { value: .012 },
  uNightRooms: { value: 0 },
  // the sky seen in the glass: the bake's HDR holds the court and its buildings (kept), but its sky is a blown haze lid
  // (radiance about 2.3, white); where the reflection reaches that sky it is replaced by the live sky and clouds
  uSkyZen: { value: new THREE.Color(.05, .16, .45) }, uSkyHor: { value: new THREE.Color(.6, .68, .76) }, uCloudLit: { value: new THREE.Color(.9, .9, .9) },
  uSkyReflK: { value: 1 }, uSkyLum: { value: new THREE.Vector2(.9, 1.7) },
};

// ------------------------------------------------------------------ the curtain wall
function glassMaterial({ name, level = -1, clearable = false }) {
  const m = new THREE.MeshPhysicalMaterial({ name, color: new THREE.Color().setRGB(.26, .5, .6, THREE.LinearSRGBColorSpace), metalness: 0, roughness: .075, envMapIntensity: 1.7,
    specularIntensity: 1, ior: 1.52, thickness: .012, side: THREE.FrontSide, transparent: clearable, depthWrite: !clearable });
  m.userData.glass = true; m.userData.visualTreatment = 'Assumed dielectric glazing; exterior room mapping is illustrative, not surveyed interior geometry'; m.userData.level = level;
  const own = { uClear: { value: 0 } }; m.userData.u = own;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GLASS, own);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_NOISE}
        uniform float uRoomK; uniform float uRoomBright; uniform float uLitLevel; uniform float uLitK; uniform float uPaneJitter; uniform float uNightRooms; uniform float uClear;
        uniform vec3 uSkyZen; uniform vec3 uSkyHor; uniform vec3 uCloudLit; uniform float uSkyReflK; uniform vec2 uSkyLum;
        // a room behind the pane (interior mapping in the pane's own frame): ceiling with light panels, carpet, back wall,
        // a band of desks and screens 3.5 m in, and roller blinds on some panes
        vec3 roomColour(vec3 P, vec3 rd, vec3 nW, out float lit) {
          float lv = floor((P.y - .6) / 3.6); float fy = .6 + lv * 3.6, cy = fy + 3.05;
          vec3 tW = normalize(cross(vec3(0.0, 1.0, 0.0), nW));
          float Wb = 6.84, D = 9.5;
          float u = dot(P, tW), v = P.y; float u0 = floor(u / Wb) * Wb;
          vec2 id = vec2(floor(u / Wb), lv);
          vec3 rl = vec3(dot(rd, tW), rd.y, max(dot(rd, -nW), .05));
          float tU = rl.x > 0.0 ? (u0 + Wb - u) / rl.x : (u0 - u) / min(rl.x, -1e-4);
          float tV = rl.y > 0.0 ? (cy - v) / rl.y : (fy - v) / min(rl.y, -1e-4);
          float tD = D / rl.z;
          float t = min(min(tU, tV), tD);
          vec3 H = vec3(u, v, 0.0) + rl * t;
          float r0 = hash12(id), r1 = hash12(id + 17.3), r2 = hash12(id + 5.1);
          float on = mix(step(.12, r0), step(.3, r0), uNightRooms);
          lit = on;
          vec3 warm = vec3(1.0, .93, .82), cool = vec3(.9, .95, 1.0);
          vec3 lamp = mix(cool, warm, step(.5, r2));
          vec3 c;
          if (t == tV && rl.y > 0.0) {            // ceiling and its light panels
            vec2 g = fract(vec2(H.x / 1.8, H.z / 1.8)); float panel = step(.32, g.x) * step(g.x, .68) * step(.32, g.y) * step(g.y, .68);
            c = vec3(.62) * (.35 + .65 * on) + lamp * panel * on * 5.0;
          } else if (t == tV) {                     // carpet, brighter under the lights
            vec2 g = fract(vec2(H.x / 1.8, H.z / 1.8)) - .5; float pool = exp(-dot(g, g) * 6.0);
            c = vec3(.19, .2, .22) * (.5 + .5 * on) * (.8 + pool * .9 * on);
          } else if (t == tD) {                     // back wall
            vec3 wall = mix(vec3(.55, .54, .52), mix(vec3(.42, .33, .26), vec3(.3, .34, .38), step(.5, r1)), step(.6, r1));
            c = wall * (.35 + .65 * on) * (.8 + .2 * smoothstep(fy, cy, H.y));
          } else {                                  // side partitions
            c = vec3(.48, .48, .47) * (.3 + .6 * on);
          }
          // furniture band 3.5 m in: desks, screens, chair backs (dark silhouettes against the lit room)
          float tF = 3.5 / rl.z;
          if (tF < t) { vec3 F = vec3(u, v, 0.0) + rl * tF; float hy = F.y - fy;
            float k = fract(F.x / 1.6); float desk = step(hy, .75) * step(.0, hy);
            float scr = step(.78, hy) * step(hy, 1.18) * step(.15, k) * step(k, .55) * step(.35, r1 + .3 * hash12(floor(vec2(F.x / 1.6, lv))));
            float chair = step(hy, 1.05) * step(.45, hy) * step(.62, k) * step(k, .9);
            float f = max(max(desk * .85, scr), chair * .7);
            c = mix(c, vec3(.05, .055, .06) * (.6 + .4 * on) + lamp * scr * .25 * on, f); }
          // blinds on some panes, lowered from the head of the glass
          float bl = step(.62, r2) * (.25 + .5 * hash12(id + 9.7));
          float vin = (v - fy) / 3.05;
          if (vin > 1.0 - bl) c = mix(c, vec3(.78, .76, .72) * (.45 + .3 * on), .92);
          return c;
        }`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
        { vec3 rV = reflect(-geometryViewDir, geometryNormal);
          vec3 rW = normalize((vec4(rV, 0.0) * viewMatrix).xyz);
          float envL = dot(radiance, vec3(.2126, .7152, .0722)) / max(envMapIntensity, 1e-3);
          float skyK = smoothstep(-.03, .1, rW.y) * mix(smoothstep(uSkyLum.x, uSkyLum.y, envL), 1.0, uNight);
          vec3 sk = mix(uSkyHor, uSkyZen, pow(clamp(rW.y, 0.0, 1.0), .55));
          if (rW.y > .015) {
            vec3 q = vHzW + rW * ((mix(uCloudBase, uCloudTop, .25) - vHzW.y) / rW.y);
            float c = hz_coverage(q.xz) * smoothstep(.015, .12, rW.y);
            sk = mix(sk, uCloudLit, smoothstep(.12, .8, c) * .9);
          }
          sk += uSunCol * (pow(max(dot(rW, uSunDir), 0.0), 18.0) * .35) * smoothstep(-.02, .05, uSunDir.y);
          radiance = mix(radiance, sk * uSkyReflK, skyK);
        }
        #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 cell = vec2(floor((vHzW.x + vHzW.z) / 1.368), floor((vHzW.y - .6) / 3.6));
          vec3 j = vec3(hash12(cell) - .5, (hash12(cell + 7.1) - .5) * .6, hash12(cell + 3.3) - .5) * uPaneJitter;
          normal = normalize(normal + (viewMatrix * vec4(j, 0.0)).xyz); }`)
      .replace('#include <opaque_fragment>', `{
          vec3 rd = normalize(vHzW - cameraPosition);
          vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float cosv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float F = .08 + .92 * pow(1.0 - cosv, 5.0);
          float lit; vec3 rc = roomColour(vHzW, rd, normalize(vec3(nW.x, 0.0, nW.z)), lit);
          float lv = floor((vHzW.y - .6) / 3.6);
          float hl = uLitK * (1.0 - step(.5, abs(lv - uLitLevel)));
          vec3 room = rc * (uRoomBright + hl * 1.6) * mix(1.0, 1.0 + 2.2 * lit, uNightRooms);
          vec2 pc = vec2(floor((vHzW.x + vHzW.z) / 1.368), floor((vHzW.y - .6) / 3.6));
          float pv = hash12(pc + 41.7) - .5;
          outgoingLight = outgoingLight * mix(.8, 1.0, F) * (1.0 + pv * .07) + room * (1.0 - F) * uRoomK * vec3(.62, .82, .84);
          diffuseColor.a = mix(1.0, .1 + .75 * F, uClear);
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'rtpglass' + (clearable ? 'c' : '');
  return patchMaterial(m, { shadow: true });
}

// ------------------------------------------------------------------ loading
export async function loadTwin(renderer, base, manifest) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const F = manifest.files || {};
  const sizes = { b: (F.rtp_building && F.rtp_building.mb || 2) * 1048576, c: (F.rtp_context && F.rtp_context.mb || 8) * 1048576, t: (F.rtp_terrain && F.rtp_terrain.mb || 1) * 1048576 };
  const parse = (buf) => new Promise((res, rej) => loader.parse(buf, base, res, rej));
  const [bb, cb, tb] = await Promise.all([fetchBytes(base + F.rtp_building.file, sizes.b), fetchBytes(base + F.rtp_context.file, sizes.c), fetchBytes(base + F.rtp_terrain.file, sizes.t)]);
  const [bg, cg, tg] = await Promise.all([parse(bb), parse(cb), parse(tb)]);
  const building = bg.scene, context = cg.scene, terrain = tg.scene;
  building.name = 'rtp_building'; context.name = 'rtp_context'; terrain.name = 'rtp_terrain';

  // AO from the bake (sun-independent, so the live sun can move): lightmapped nodes carry TEXCOORD_1
  const nodes = (manifest.lightmapped_meshes && manifest.lightmapped_meshes.nodes) || {}, lnodes = (manifest.lightmaps && manifest.lightmaps.nodes) || {};
  const aoCache = {}; const aoJobs = [];
  // the AO atlases are mostly empty (black) between thin UV islands: no mipmaps, or the black gutters bleed into the
  // ACP bands as dark stripes at a distance
  const aoTex = (u) => aoCache[u] || (aoCache[u] = loadTexture(base + u, { srgb: false, flipY: false }).then(t => {
    t.channel = 1; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.anisotropy = 1; t.needsUpdate = true; return t; }).catch(() => null));
  const glassCache = {};
  const glassFor = (name) => glassCache[name] || (glassCache[name] = glassMaterial({ name, level: /L06$/.test(name) ? 6 : /L04$/.test(name) ? 4 : -1, clearable: /L06$/.test(name) }));
  const nightMats = new Set(), interiors = [], leafMats = new Set();
  const prepare = (root, { isBuilding = false, isContext = false } = {}) => root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (/_interior$/.test(o.name)) { interiors.push(o); o.visible = false; return; }   // the glass shader draws the rooms now
    o.material = [].concat(o.material).map(m => {
      const nm = m.name || '';
      if (/^(facade_glass|rail_glass)/.test(nm)) { o.castShadow = false; o.renderOrder = 6; return glassFor(nm); }
      if (/road_marking/.test(nm) || (m.userData && m.userData.polygonOffset)) { m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4; }
      // the context's own ground (500 m disc) melts into the satellite ground at its edge instead of ending in a circle
      // The context's own ground meets the twin's terrain (which has a 426 m hole) under the satellite plate: the land-use
      // polygons turn into the plate's own colour by 420 m and stop at 425 m (no overlap, no z-fight); roads and paths run
      // on to the disc's edge and melt into the plate there. From altitude all of it is the plate (uSatAlt).
      if (/^ctx_ground/.test(nm)) { o.castShadow = false; return patchMaterial(m, { sat: true, satFade: [300, 418], clipR: 425 }); }
      if (/^(ctx_paving|ctx_asphalt|ctx_kerb|road_marking|ctx_median|ctx_ballast|ctx_water|ctx_footpath)/.test(nm)) { o.castShadow = false; return patchMaterial(m, { sat: true }); }
      const edge = isContext && !/^ctxB_|ctx_ground|ctx_paving|ctx_asphalt|road_marking|ctx_kerb|ctx_median|ctx_water/.test(nm);
      const sat = isContext && /ctx_ground|ctx_paving|ctx_asphalt|road_marking|ctx_kerb|ctx_median|ctx_water/.test(nm);
      if (/prop_leaf|prop_palm_frond/.test(nm)) { m.alphaTest = Math.max(m.alphaTest || 0, .5); m.transparent = false; m.side = THREE.DoubleSide; leafMats.add(m); return patchMaterial(m, { wind: /palm/.test(nm) ? .02 : .028, edge }); }
      if (m.map) m.map.anisotropy = 16;
      // silver ACP is a painted, flaked finish: less mirror than the bake's metal 0.75 (which reads black when it faces the ground)
      if (/^rtp_acp/.test(nm)) { m.metalness = .42; m.roughness = .36; }
      if (/^rtp_mullion/.test(nm)) { m.color.set('#3a4046'); m.metalness = .55; m.roughness = .42; }
      if (typeof (m.userData || {}).emit_night === 'number' && (m.userData.emit_night || m.userData.emit_day)) nightMats.add(m);
      return patchMaterial(m, { edge, sat });
    });
    if (o.material.length === 1) o.material = o.material[0];
    let p = o, info = null; while (p && !info) { info = nodes[p.name] || lnodes[p.name]; p = p.parent; }
    const aoUrl = info && (info.aomap || (info.lightmap && info.lightmap.replace(/_day\.(jpg|png)$/, '_ao.jpg')));
    if (aoUrl && o.geometry.attributes.uv1) aoJobs.push(aoTex(aoUrl).then(t => { if (!t) return; for (const m of [].concat(o.material)) { if (m.userData.glass) continue; m.aoMap = t; m.aoMapIntensity = /^rtp_(acp|slab|spine|render)/.test(m.name || '') ? .55 : .85; m.needsUpdate = true; } }));
  });
  prepare(building, { isBuilding: true }); prepare(context, { isContext: true }); prepare(terrain);
  await Promise.all(aoJobs);

  // the RELIABLE sign's materials and every other emitter: day / night levels from the bake's extras
  const setNight = (k) => { for (const m of nightMats) { const d = m.userData.emit_day || 0, n = m.userData.emit_night || 0; m.emissiveIntensity = d + (n - d) * k; } };

  // collision volumes: the building (outer ring, roof plant to 48 m) and the class-B towers' boxes from the bake
  const boxes = [];
  context.traverse(o => { if (o.isMesh && /^ctxB_/.test(o.name || (o.parent && o.parent.name) || '')) { const b = new THREE.Box3().setFromObject(o); if (isFinite(b.min.x)) boxes.push(b.expandByScalar(3)); } });
  return { building, context, terrain, setNight, interiors, boxes, glassFor, leafMats, glassMats: glassCache };
}

// ------------------------------------------------------------------ traffic on the real roads (Overture lines, left-hand)
export function makeTraffic(context, ctxData, { maxR = 520, count = 64 } = {}) {
  // the bake's own car prototype (paint + glass + tyres), re-instanced
  let proto = null;
  context.traverse(o => { if (!proto && o.isInstancedMesh && /prop_car_paint_0/.test(o.material && o.material.name)) proto = o.parent; });
  if (!proto) return null;
  const parts = proto.children.filter(c => c.isInstancedMesh);
  const box = new THREE.Box3(); parts.forEach(p => { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); });
  const size = box.getSize(new THREE.Vector3()), alongX = size.x >= size.z;
  // lanes from primary / secondary / tertiary roads inside the flattened site
  const lanes = [];
  for (const r of ctxData.roads || []) {
    if (!/primary|secondary|tertiary|trunk/.test(r.class || '')) continue;
    const L = (r.line || []).filter(p => Math.hypot(p[0], p[1]) < maxR); if (L.length < 2) continue;
    let len = 0; const seg = []; for (let i = 0; i < L.length - 1; i++) { const d = Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]); seg.push(d); len += d; }
    if (len < 120) continue;
    const w = /primary|trunk/.test(r.class) ? 24 : /secondary/.test(r.class) ? 15 : 11;
    for (const dir of [1, -1]) lanes.push({ L: dir > 0 ? L : L.slice().reverse(), seg: dir > 0 ? seg : seg.slice().reverse(), len, off: w * .22 });
  }
  if (!lanes.length) return null;
  const total = lanes.reduce((s, l) => s + l.len, 0);
  const cars = []; let k = 0;
  for (const l of lanes) { const n = Math.max(1, Math.round(count * l.len / total)); for (let i = 0; i < n; i++) cars.push({ lane: l, s: (i + .37 * (k % 3)) / n * l.len, v: 7.5 + 4 * ((k * 0.618) % 1), tint: k++ }); }
  const meshes = parts.map(p => { const m = new THREE.InstancedMesh(p.geometry, p.material, cars.length); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m; });
  const group = new THREE.Group(); group.name = 'traffic'; meshes.forEach(m => group.add(m));
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const at = (l, d) => { let i = 0; while (i < l.seg.length - 1 && d > l.seg[i]) { d -= l.seg[i]; i++; } const a = l.L[i], b = l.L[i + 1], t = Math.min(1, d / l.seg[i]);
    const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1; return [a[0] + dx * t, a[1] + dy * t, dx / n, dy / n]; };
  const update = (time) => {
    cars.forEach((c, i) => {
      const d = (c.s + c.v * time) % c.lane.len; const [x, y, ux, uy] = at(c.lane, d);
      const lx = -uy, ly = ux;                                         // left of travel: India drives on the left
      const px = x + lx * c.lane.off, py = y + ly * c.lane.off;
      const yaw = Math.atan2(uy, ux);                                   // heading in rtp_local, from +x toward +y
      q.setFromAxisAngle(Y, alongX ? yaw : yaw - Math.PI / 2);
      const edge = Math.min(d, c.lane.len - d), sc = Math.min(1, edge / 14);
      s.set(sc, sc, sc); P.copy(W(px, py, .06)); M.compose(P, q, s);
      meshes.forEach(m => m.setMatrixAt(i, M));
    });
    meshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  };
  update(0);
  return { group, update };
}
