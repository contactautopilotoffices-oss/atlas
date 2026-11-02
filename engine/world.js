/* ============================================================================
   ATLAS · 3D World

   /<slug>/world draws the atlas's options in a 3D model of their district:
   every building footprint from open map data, the metro on its viaducts,
   the streets with traffic, trees, sky, time of day and weather. The list,
   the "How you get there" rows and the shots work as they do on the map.

   The model is built in Blender by scripts/world/build.py and loaded as one
   meshopt-compressed GLB; scripts/world/prep.py writes the page's data file
   (trees, lamps, roads, metro, footprints). Options, routes and facts come
   from the atlas bundle itself (/engine/atlases/<slug>.js), so the figures
   are the atlas's figures.

   Patterns from MengTo/Skills (MIT): threejs-weather (rain carried in front
   of the lens, a storm as the rain leaned on, lightning on its own light,
   wet ground, relight only when slow values move), threejs-landscape and
   3d-sky-background (a gradient sky dome sharing one sun with the light and
   the fog, a time of day that cross-fades), threejs-towers (merge by
   material, light windows without leaks), 3d-retina-resolution.

   Coordinates: metres around the scene origin; three's X is east, Y is up
   and -Z is north (the GLB is exported Y-up).
   ============================================================================ */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MapControls } from "three/addons/controls/MapControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const Q = new URLSearchParams(location.search);
const LITE = Q.get("lite") === "1" || /Mobi|Android/i.test(navigator.userAgent);
const SLUG = ((Q.get("atlas") || location.pathname.split("/")[1] || "") + "").toLowerCase().replace(/[^a-z0-9-]/g, "");
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const fmtM = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

/* ------------------------------------------------------------- boot ------ */
function script(src) { return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
async function sha256(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
const normId = (v) => String(v).trim().toUpperCase().replace(/[\s-]/g, "");

async function boot() {
  try { await script(`/engine/atlases/${SLUG}.js`); } catch (e) { return fail("This atlas has no 3D world."); }
  const A = window.ATLAS, W = A && A.meta && A.meta.world;
  if (!A || !W) return fail("This atlas has no 3D world.");
  document.title = `${A.meta.title} · 3D World`;
  if (W.poster) { $("#load").style.backgroundImage = `url("${W.data}${W.poster}")`; $("#gate").style.backgroundImage = `url("${W.data}${W.poster}")`; }
  const KEY = SLUG + "-auth";
  let authed = !(A.gate && A.gate.hash);
  try { if (sessionStorage.getItem(KEY) === "1") authed = true; } catch (e) {}
  if (!authed) {
    $("#load").hidden = true; $("#gate").hidden = false;
    await new Promise((done) => {
      $("#g-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const ok = (await sha256(normId($("#g-id").value) + ":" + normId($("#g-pw").value))) === A.gate.hash;
        if (!ok) { $("#g-err").textContent = "That ID and password do not match."; return; }
        try { sessionStorage.setItem(KEY, "1"); } catch (x) {}
        $("#gate").hidden = true; $("#load").hidden = false; done();
      });
    });
  }
  start(A, W).catch((e) => { console.error(e); fail("The 3D world could not load: " + e.message); });
}
function fail(msg) { $("#l-title").textContent = "Not available"; $("#l-msg").textContent = msg; $("#l-bar").style.width = "0"; }

/* ------------------------------------------------------------ world ------ */
async function start(A, W) {
  const DATA = await (await fetch(W.data + "world.json")).json();
  const [LNG0, LAT0] = DATA.origin, [KX, KY] = DATA.k;
  const toXZ = (lng, lat) => [(lng - LNG0) * KX, -(lat - LAT0) * KY];
  const B = DATA.bounds; // minx, miny, maxx, maxy in scene metres (y north)
  const CX = (B[0] + B[2]) / 2, CZ = -(B[1] + B[3]) / 2;

  /* renderer: 2x on retina, capped (3d-retina-resolution) */
  const canvas = $("#c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LITE ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !LITE; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 4, 40000);
  const controls = new MapControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = false;
  controls.minDistance = 60; controls.maxDistance = 7500; controls.maxPolarAngle = 84 * D2R; controls.zoomSpeed = 1.2;

  /* --------------------------------------------------- sky, sun, fog ---- */
  const U = { uTime: { value: 0 }, uNight: { value: 0 }, uLit: { value: 0.5 }, uWet: { value: 0 }, uSky: { value: new THREE.Color(0x8fb6d8) }, uSel: { value: 0 } };
  const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, low: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunK: { value: 1 }, flash: { value: 0 }, stars: { value: 0 }, cloud: { value: 0 }, uTime: U.uTime };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30000, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top,mid,hor,low,sunDir,sunCol; uniform float sunK,flash,stars,cloud,uTime; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){ vec3 d=normalize(vD); float y=d.y;
        vec3 c = y<0. ? mix(hor, low, smoothstep(0., -.25, y)) : mix(mix(hor, mid, smoothstep(0., .18, y)), top, smoothstep(.18, .75, y));
        float s = max(dot(d, normalize(sunDir)), 0.);
        c += sunCol * (pow(s, 900.) * 18. + pow(s, 12.) * .35 + pow(s, 3.) * .12) * sunK;
        if (y > 0.) { vec2 p = d.xz / (y + .12) * 1.6 + uTime * .006; float cl = smoothstep(.62 - cloud * .42, 1.05 - cloud * .3, fbm(p * 1.3));
          vec3 cc = mix(hor * 1.05, vec3(1.), .35) * (.55 + .45 * sunK) + sunCol * pow(s, 4.) * .4 * sunK; cc = mix(cc, cc * .55, cloud * .8);
          c = mix(c, cc, cl * smoothstep(0., .12, y) * (.25 + cloud * .75));
          float st = step(.9975, h(floor(d.xz / (y + .2) * 260.))) * stars * smoothstep(.05, .3, y) * (1. - cloud); c += st * .9; }
        c *= 1. + flash * .8; gl_FragColor = vec4(c, 1.); }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  scene.fog = new THREE.FogExp2(0xc9d7e0, 0.0001);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = !LITE;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.2;
  const sc = sun.shadow.camera; sc.near = 10; sc.far = 9000;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd6ee, 0x5a5446, 0.8); scene.add(hemi);
  const bolt = new THREE.DirectionalLight(0xe6ecff, 0); scene.add(bolt, bolt.target);

  /* ------------------------------------------------------ the model ----- */
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((ok, bad) => loader.load(W.data + W.glb, ok, (e) => { if (e.total) $("#l-bar").style.width = `${Math.round(e.loaded / e.total * 90)}%`; }, bad));
  const root = gltf.scene; scene.add(root);
  const COL = { ground: 0x8b8574, land_green: 0x5b7a3f, land_built: 0x928a78, land_school: 0x9a8f71, water: 0x41575c, roads_major: 0x3b3c3f, roads_minor: 0x5a5a5c,
    roads_foot: 0x8c877c, rail: 0x5c544b, platforms: 0xa6a39b, platform_roofs: 0xb9bcc0, tanks: 0x1c1e21, viaduct: 0xc6c3ba, piers: 0xb8b4aa, stations: 0xd5d9dd, entries_l3: 0x1d8a8a };
  const flatMats = {}, WET = [];
  const flat = (k) => flatMats[k] || (flatMats[k] = (() => {
    const m = new THREE.MeshStandardMaterial({ color: COL[k], roughness: k === "water" ? 0.12 : k.startsWith("roads") ? 0.88 : 0.95, metalness: k === "platform_roofs" ? 0.4 : 0, flatShading: true });
    m.userData.base = m.color.clone(); m.userData.rough = m.roughness;
    if (/^(roads|ground|land|rail|platforms)/.test(k)) WET.push(m);
    if (k === "stations" || k === "entries_l3" || k === "viaduct") m.emissive = new THREE.Color(k === "entries_l3" ? 0x2fd3c4 : k === "viaduct" ? 0x6f9fd8 : 0xcfe6ff);
    m.emissiveIntensity = 0; return m;
  })());

  /* buildings: facade colour per vertex, windows and storeys from world
     position, lit windows at night by a hashed cell (threejs-towers: one
     material for all, glow only where there is a window) */
  const facade = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.0, flatShading: true });
  facade.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uNight: U.uNight, uLit: U.uLit, uWet: U.uWet, uSky: U.uSky });
    sh.vertexShader = "attribute vec2 aSeed; varying vec3 vW; varying vec2 vSeed;\n" + sh.vertexShader.replace("#include <worldpos_vertex>",
      "#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz; vSeed = aSeed;");
    sh.fragmentShader = `uniform float uNight, uLit, uWet; uniform vec3 uSky; varying vec3 vW; varying vec2 vSeed;
      float h13(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float gWin, gAvg, gWall;\n` + sh.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 wn = normalize(cross(dFdx(vW), dFdy(vW)));
        gWall = 1.0 - step(0.55, abs(wn.y));
        float hor = abs(wn.x) > abs(wn.z) ? vW.z : vW.x;
        vec2 f = vec2(hor / 2.6, vW.y / 3.3); vec2 cu = fract(f); vec2 fw = fwidth(f);
        float aa = clamp(1.6 - max(fw.x, fw.y) * 3.0, 0.0, 1.0);
        float wx = smoothstep(0.16, 0.16 + fw.x * 1.5, cu.x) * (1.0 - smoothstep(0.84 - fw.x * 1.5, 0.84, cu.x));
        float wy = smoothstep(0.30, 0.30 + fw.y * 1.5, cu.y) * (1.0 - smoothstep(0.86 - fw.y * 1.5, 0.86, cu.y));
        float body = gWall * step(2.8, vW.y) * step(vW.y, vSeed.y * 128.0 - 0.9);
        gWin = wx * wy * body; gAvg = mix(0.35 * body, gWin, aa);
        vec3 glass = vec3(0.09, 0.12, 0.15) + uSky * 0.22;
        diffuseColor.rgb = mix(diffuseColor.rgb, glass, gAvg * 0.85);
        diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.07 + fw.y, cu.y)) * gWall * aa * 0.22;
        diffuseColor.rgb *= 1.0 - uWet * 0.22;
        vec3 cid = vec3(floor(f), floor(vSeed.x * 997.0));`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.16, gAvg); roughnessFactor = mix(roughnessFactor, 0.35, uWet * (1.0 - gWall));")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float r = h13(cid); float lit = step(1.0 - uLit, r) * gWin;
        vec3 warm = mix(vec3(1.0, 0.62, 0.30), vec3(1.0, 0.92, 0.78), h13(cid + 3.1));
        totalEmissiveRadiance += warm * uNight * (lit * 1.35 + gAvg * (1.0 - step(0.5, gWin)) * uLit * 0.35);`);
  };
  facade.customProgramCacheKey = () => "facade";

  /* the options: glass with storey bands, lit inside at night, and a warm
     edge when selected */
  const OPTS = A.options.map((o) => ({ ...o, w: (DATA.options || []).find((x) => x.id === o.id) || {} }));
  const optMat = new Map();
  const glassMat = (id) => {
    const u = { uSelK: { value: 0 } };
    const m = new THREE.MeshStandardMaterial({ color: 0x4f7486, roughness: 0.08, metalness: 0.55, flatShading: true, envMapIntensity: 0.9 });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uNight: U.uNight, uTime: U.uTime }, u);
      sh.vertexShader = "varying vec3 vW;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = "uniform float uNight, uTime, uSelK; varying vec3 vW;\n" + sh.fragmentShader
        .replace("#include <color_fragment>", `#include <color_fragment>
          vec3 wn = normalize(cross(dFdx(vW), dFdy(vW))); float wall = 1.0 - step(0.55, abs(wn.y));
          float band = step(fract(vW.y / 4.1), 0.22) * wall; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.84, 0.79), band);`)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.6, band);")
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 0.0, band);")
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 0.86, 0.66) * uNight * (1.0 - band) * wall * 0.55;
          float edge = smoothstep(0.82, 1.0, fract(vW.y / 4.1)) * wall;
          totalEmissiveRadiance += vec3(1.0, 0.55, 0.22) * uSelK * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 3.0))) * (0.25 + edge);`);
    };
    m.customProgramCacheKey = () => "optglass";
    m.userData.u = u; optMat.set(id, m); return m;
  };

  const OPT_MESH = new Map();
  root.traverse((ob) => {
    if (!ob.isMesh) return;
    const n = ob.name || (ob.parent && ob.parent.name) || "";
    if (n.startsWith("buildings_")) {
      const g = ob.geometry; if (g.getAttribute("uv")) g.setAttribute("aSeed", g.getAttribute("uv"));
      g.deleteAttribute("normal"); ob.material = facade; ob.castShadow = ob.receiveShadow = true;
    } else if (n.startsWith("opt_")) {
      const id = n.slice(4).replace(/_\d+$/, ""); ob.material = glassMat(id); ob.castShadow = ob.receiveShadow = true; OPT_MESH.set(id, ob); ob.userData.opt = id;
    } else {
      const k = Object.keys(COL).find((k) => n === k || n.startsWith(k)) || (n.startsWith("viaduct") ? "viaduct" : n.startsWith("piers") ? "piers" : n.startsWith("stations") ? "stations" : "ground");
      ob.material = flat(k); ob.receiveShadow = true; ob.castShadow = /^(viaduct|piers|stations|platform_roofs|tanks)/.test(k);
    }
  });

  /* trees: one instanced crown, coloured per tree, swaying a little */
  const TREES = DATA.trees.filter((t, i) => LITE ? i % 3 === 0 : i % 3 !== 2 || i < 20000);
  /* a lumpy, smooth-shaded crown reads as foliage; a faceted one as a gem */
  let crownG = new THREE.IcosahedronGeometry(1, LITE ? 0 : 1);
  { const p = crownG.getAttribute("position"); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.16 * Math.sin(x * 5.1 + z * 3.7) * Math.cos(y * 4.3);
      p.setXYZ(i, x * k, y * k * 0.72, z * k); } }
  crownG.deleteAttribute("normal"); crownG.deleteAttribute("uv"); crownG = mergeVertices(crownG); crownG.computeVertexNormals(); crownG.translate(0, 1.0, 0);
  const treeMat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  treeMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.uniforms.uWet = U.uWet;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05; transformed.x += sin(uTime * 1.3 + ph) * 0.06 * position.y; transformed.z += cos(uTime * 1.1 + ph) * 0.05 * position.y;`); };
  const trees = new THREE.InstancedMesh(crownG, treeMat, TREES.length);
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(), e = new THREE.Euler();
    const greens = [0x2f5a22, 0x3d6b2b, 0x4c7a33, 0x5e8a3a, 0x37602a, 0x6a8f3f];
    TREES.forEach(([x, y, k], i) => { const r = 4.2 * k; e.set(0, (x * 13.1 + y * 7.7) % 6.28, 0); q.setFromEuler(e);
      p.set(x, 1.6 * k, -y); s.set(r, r * (0.9 + ((x * 3.3) % 0.3)), r); m4.compose(p, q, s); trees.setMatrixAt(i, m4);
      c.setHex(greens[Math.abs(Math.floor(x * 7 + y * 3)) % greens.length]); trees.setColorAt(i, c); }); }
  trees.castShadow = !LITE; trees.receiveShadow = true; scene.add(trees);

  /* the city carries on past the data: a low-detail ring of blocks that
     fades into the haze, so the horizon is Mumbai rather than an edge */
  { const N = LITE ? 14000 : 40000, g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    const m = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }); m.onBeforeCompile = (sh) => { sh.uniforms.uNight = U.uNight; sh.uniforms.uLit = U.uLit;
      sh.vertexShader = "varying vec3 vW; varying float vR;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vR = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);");
      sh.fragmentShader = "uniform float uNight, uLit; varying vec3 vW; varying float vR;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n float w = step(0.5, fract(vW.y / 3.3)) * step(0.45, fract((vW.x + vW.z) / 2.6)); totalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * w * step(1.0 - uLit, fract(vR * 37.0 + floor(vW.y / 3.3) * 0.31)) * uNight * 1.6;"); };
    const far = new THREE.InstancedMesh(g, m, N), m4 = new THREE.Matrix4(), c = new THREE.Color(), pal = [0xcfc6b4, 0xd9d2c3, 0xbdbcb4, 0xaab5bb, 0xc9b49a, 0xe2d6bd];
    const x0 = B[0], x1 = B[2], z0 = -B[3], z1 = -B[1]; let n = 0; const R = 4200, cell = 34;
    const rnd = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let gx = x0 - R; gx < x1 + R && n < N; gx += cell) for (let gz = z0 - R; gz < z1 + R && n < N; gz += cell) {
      if (gx > x0 - 30 && gx < x1 + 30 && gz > z0 - 30 && gz < z1 + 30) continue;
      const d = Math.max(x0 - gx, gx - x1, z0 - gz, gz - z1), r0 = rnd(gx, gz);
      if (r0 > 0.62 - d / R * 0.25 || (Math.floor(gx / 170) + Math.floor(gz / 170)) % 7 === 0 && r0 > 0.2) continue; // streets and open ground
      const big = rnd(gz, gx) < 0.05, w = big ? 26 + r0 * 20 : 12 + r0 * 16, h = big ? 35 + rnd(gx, 1) * 60 : 5 + rnd(1, gz) * 20;
      const ang = (rnd(Math.floor(gx / 600), Math.floor(gz / 600)) - 0.5) * 0.9;
      m4.makeRotationY(ang).scale(new THREE.Vector3(w, h, w * (0.7 + rnd(gz, 3) * 0.6))).setPosition(gx + (rnd(gx, 7) - 0.5) * 8, 0, gz + (rnd(7, gz) - 0.5) * 8);
      far.setMatrixAt(n, m4); far.setColorAt(n, c.setHex(pal[n % pal.length])); n++; }
    far.count = n; far.receiveShadow = false; scene.add(far); }

  /* street lamps: a glow sprite each, on at dusk */
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,220,170,.55)"); gr.addColorStop(1, "rgba(255,200,140,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const lampG = new THREE.BufferGeometry(); lampG.setAttribute("position", new THREE.Float32BufferAttribute(DATA.lamps.flatMap(([x, y]) => [x, 8, -y]), 3));
  const lampM = new THREE.PointsMaterial({ map: glowTex, color: 0xffb46a, size: 26, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const lamps = new THREE.Points(lampG, lampM); lamps.visible = false; scene.add(lamps);

  /* traffic on the main roads: cars, buses, and the yellow-green autos */
  const ROADS = DATA.traffic.map((r) => { const P = r.p.map(([x, y]) => new THREE.Vector2(x, -y)); const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1])); return { P, L, len: L[L.length - 1], w: r.w }; });
  const along = (rd, s, out) => { s = clamp(s, 0, rd.len); let i = 1; while (i < rd.L.length - 1 && rd.L[i] < s) i++; const t = (s - rd.L[i - 1]) / Math.max(1e-6, rd.L[i] - rd.L[i - 1]);
    out.x = rd.P[i - 1].x + (rd.P[i].x - rd.P[i - 1].x) * t; out.y = rd.P[i - 1].y + (rd.P[i].y - rd.P[i - 1].y) * t; return Math.atan2(rd.P[i].y - rd.P[i - 1].y, rd.P[i].x - rd.P[i - 1].x); };
  const totalLen = ROADS.reduce((a, r) => a + r.len * r.w, 0);
  const NCARS = LITE ? 700 : 1800;
  const cars = []; for (const rd of ROADS) { const n = Math.round(NCARS * rd.len * rd.w / totalLen); for (let i = 0; i < n; i++) { const dir = Math.random() < 0.5 ? 1 : -1; const kind = Math.random();
    cars.push({ rd, s: Math.random() * rd.len, dir, v: (7 + Math.random() * 7) * (kind < 0.12 ? 0.8 : 1), lane: dir * (rd.w * (0.18 + Math.random() * 0.16)), kind }); } }
  const carG = new THREE.BoxGeometry(1, 1, 1); carG.translate(0, 0.5, 0);
  const carMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 });
  carMat.onBeforeCompile = (sh) => { sh.uniforms.uNight = U.uNight; sh.fragmentShader = "uniform float uNight;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += vInstanceGlow * uNight * 2.4;");
    sh.vertexShader = "attribute vec3 aGlow; varying vec3 vInstanceGlow;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vInstanceGlow = aGlow;"); sh.fragmentShader = "varying vec3 vInstanceGlow;\n" + sh.fragmentShader; };
  const carMesh = new THREE.InstancedMesh(carG, carMat, cars.length); carMesh.castShadow = false;
  { const c = new THREE.Color(), glow = new Float32Array(cars.length * 3);
    const bodies = [0xf2f2f0, 0xd9dadb, 0x9aa0a6, 0x3a3d42, 0x8c1d1d, 0x1f3d6b, 0xf3f1ec];
    cars.forEach((k, i) => { if (k.kind < 0.12) c.setHex(0x2f8f3a).lerp(new THREE.Color(0xf2c230), 0.45); else if (k.kind > 0.96) c.setHex(0xb8322a); else if (k.kind > 0.9) c.setHex(0x1c1c1c).lerp(new THREE.Color(0xf2c230), 0.5); else c.setHex(bodies[i % bodies.length]);
      carMesh.setColorAt(i, c); const g = k.dir > 0 ? [1.0, 0.85, 0.6] : [1.0, 0.12, 0.08]; glow.set(g, i * 3); });
    carG.setAttribute("aGlow", new THREE.InstancedBufferAttribute(glow, 3)); }
  scene.add(carMesh);
  const _v2 = new THREE.Vector2(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  function stepCars(dt) {
    for (let i = 0; i < cars.length; i++) { const k = cars[i]; k.s += k.v * k.dir * dt; if (k.s > k.rd.len) k.s -= k.rd.len; else if (k.s < 0) k.s += k.rd.len;
      const a = along(k.rd, k.s, _v2); const nx = -Math.sin(a), nz = Math.cos(a);
      _p.set(_v2.x + nx * k.lane, 0.12, _v2.y + nz * k.lane); _e.set(0, -a, 0); _q.setFromEuler(_e);
      if (k.kind < 0.12) _s.set(2.7, 1.7, 1.4); else if (k.kind > 0.96) _s.set(11, 3.1, 2.5); else _s.set(4.3, 1.45, 1.8);
      _m4.compose(_p, _q, _s); carMesh.setMatrixAt(i, _m4); }
    carMesh.instanceMatrix.needsUpdate = true;
  }

  /* metro trains on the viaducts: Line 1 (blue and white) and Line 7 */
  const TRAINS = [];
  const trainG = new THREE.BoxGeometry(1, 1, 1); trainG.translate(0, 0.5, 0);
  for (const [key, deck, col, n] of [["L1", 13.0, 0x2d6db0, 3], ["L7", 11.0, 0xc8443c, 2]]) {
    const ls = (DATA.metro[key] && DATA.metro[key].lines) || []; if (!ls.length) continue;
    const longest = ls.slice().sort((a, b) => b.length - a.length)[0];
    const rd = { P: longest.map(([x, y]) => new THREE.Vector2(x, -y)) }; rd.L = [0]; for (let i = 1; i < rd.P.length; i++) rd.L.push(rd.L[i - 1] + rd.P[i].distanceTo(rd.P[i - 1])); rd.len = rd.L[rd.L.length - 1];
    const m = new THREE.MeshStandardMaterial({ color: 0xe9edf1, roughness: 0.35, metalness: 0.5 });
    m.onBeforeCompile = (sh) => { sh.uniforms.uNight = U.uNight; sh.uniforms.uStripe = { value: new THREE.Color(col) };
      sh.vertexShader = "varying vec3 vP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vP = position;");
      sh.fragmentShader = "uniform float uNight; uniform vec3 uStripe; varying vec3 vP;\n" + sh.fragmentShader
        .replace("#include <color_fragment>", "#include <color_fragment>\n float stripe = step(0.18, vP.y) * step(vP.y, 0.34); diffuseColor.rgb = mix(diffuseColor.rgb, uStripe, stripe); float win = step(0.45, vP.y) * step(vP.y, 0.78) * step(0.08, fract(vP.x * 6.0));")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(0.85, 0.93, 1.0) * win * uNight * 1.6;"); };
    const cars6 = 6, mesh = new THREE.InstancedMesh(trainG, m, n * cars6); mesh.castShadow = true; scene.add(mesh);
    for (let t = 0; t < n; t++) TRAINS.push({ rd, deck, mesh, base: t * cars6, s: rd.len * (t / n), dir: t % 2 ? -1 : 1, off: t % 2 ? -2.3 : 2.3, v: 15, wait: 0 });
  }
  function stepTrains(dt) {
    for (const t of TRAINS) {
      if (t.wait > 0) t.wait -= dt; else { t.s += t.v * t.dir * dt; if (t.s > t.rd.len - 70 || t.s < 70) { t.dir *= -1; t.off *= -1; t.wait = 6; t.s = clamp(t.s, 70, t.rd.len - 70); } }
      for (let c = 0; c < 6; c++) { const s = t.s - t.dir * c * 21; const a = along(t.rd, s, _v2); const nx = -Math.sin(a), nz = Math.cos(a);
        _p.set(_v2.x + nx * t.off, t.deck, _v2.y + nz * t.off); _e.set(0, -a, 0); _q.setFromEuler(_e); _s.set(20.2, 3.7, 3.1); _m4.compose(_p, _q, _s); t.mesh.setMatrixAt(t.base + c, _m4); }
      t.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /* the options: a beam each so they read from the overview */
  const beamG = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); beamG.translate(0, 0.5, 0);
  const beamMat = (k) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { k: { value: k }, uTime: U.uTime },
    vertexShader: "varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: "uniform float k,uTime; varying float vY; void main(){ float a = (1.0 - vY) * (0.55 + 0.45 * sin(uTime * 2.0 - vY * 9.0)); gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * a * k, a * k); }" });
  const OBJ = new Map();
  for (const o of OPTS) {
    const [x, z] = toXZ(o.lng, o.lat); const h = o.w.h || 40;
    const foot = o.w.foot ? o.w.foot.map(([a, b]) => [a, -b]) : null;
    const cx = foot ? foot.reduce((s, p) => s + p[0], 0) / foot.length : x, cz = foot ? foot.reduce((s, p) => s + p[1], 0) / foot.length : z;
    const r = foot ? Math.max(...foot.map(([a, b]) => Math.hypot(a - cx, b - cz))) : 25;
    const beam = new THREE.Mesh(beamG, beamMat(0.35)); beam.position.set(cx, h, cz); beam.scale.set(r * 0.25, 260, r * 0.25); beam.userData.opt = o.id; scene.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.15, r * 1.35, 64), new THREE.MeshBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.6, cz); scene.add(ring);
    OBJ.set(o.id, { o, x: cx, z: cz, h, r, beam, ring });
  }

  /* --------------------------------------------- routes and stations ---- */
  const LINE_COL = { L1: "#3b8fd0", L3: "#2fb3a8", L7: "#e0574f" };
  const routeGroup = new THREE.Group(); scene.add(routeGroup);
  const routeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, uniforms: { uTime: U.uTime, col: { value: new THREE.Color(0xffa860) } },
    vertexShader: "attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: "uniform float uTime; uniform vec3 col; varying float vS; void main(){ float d = fract(vS / 22.0 - uTime * 0.9); float a = 0.55 + 0.45 * smoothstep(0.0, 0.25, d) * (1.0 - smoothstep(0.55, 0.7, d)); gl_FragColor = vec4(col * (1.2 + a), 0.95); }" });
  function ribbon(path, w, y) {
    const P = path.map(([lng, lat]) => { const [x, z] = toXZ(lng, lat); return new THREE.Vector2(x, z); });
    const pos = [], sA = [], idx = []; let s = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; const d = new THREE.Vector2().subVectors(b, a).normalize(); const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(w / 2);
      if (i) s += P[i].distanceTo(P[i - 1]);
      pos.push(P[i].x + n.x, y, P[i].y + n.y, P[i].x - n.x, y, P[i].y - n.y); sA.push(s, s);
      if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("aS", new THREE.Float32BufferAttribute(sA, 1)); g.setIndex(idx);
    return { g, P, len: s };
  }
  const stationEnd = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1.2, 40), new THREE.MeshBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0.85 })); stationEnd.visible = false; scene.add(stationEnd);

  /* --------------------------------------------------------- labels ----- */
  const LAB = $("#labels"); const labels = [];
  const mkLabel = (cls, html, pos, data) => { const el = document.createElement("div"); el.className = "lb " + cls; el.innerHTML = html; LAB.appendChild(el); const L = { el, pos, ...data }; labels.push(L); return L; };
  for (const [id, ob] of OBJ) { const o = ob.o; const L = mkLabel("opt", `<span class="n">${String(o.n).padStart(2, "0")}</span>${esc(o.name)}`, new THREE.Vector3(ob.x, ob.h + 24, ob.z), { opt: id }); L.el.addEventListener("click", () => select(id)); ob.label = L; }
  const STN = [];
  for (const s of DATA.stations) { const L = mkLabel("st", `<i style="background:${LINE_COL[s.line] || "#888"}">${s.line}</i>${esc(s.name)}`, new THREE.Vector3(s.x, s.line === "L3" ? 8 : 24, -s.y), { st: s }); STN.push(L); }
  { const [ax, az] = toXZ(72.846944, 19.119167); STN.push(mkLabel("st", `<i style="background:#d0634e">RLY</i>Andheri railway station`, new THREE.Vector3(ax, 12, az), { st: { name: "Andheri", line: "RLY" } })); }
  const routeLabel = mkLabel("rt hide", "", new THREE.Vector3(), {});
  const _pv = new THREE.Vector3();
  function placeLabels() {
    const w = innerWidth, h = innerHeight, dist = camera.position.distanceTo(controls.target);
    for (const L of labels) {
      if (L.el.classList.contains("hide") && L !== routeLabel) continue;
      _pv.copy(L.pos).project(camera);
      const vis = _pv.z < 1 && Math.abs(_pv.x) < 1.1 && Math.abs(_pv.y) < 1.1;
      const show = vis && (!L.st || dist < 3800 || L.el.classList.contains("hl"));
      L.el.style.display = show ? "" : "none"; if (!show) continue;
      L.el.style.transform = `translate(${((_pv.x + 1) / 2 * w).toFixed(1)}px, ${((1 - _pv.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  /* -------------------------------------------------- time of day ------ */
  /* The sun over Andheri in November (latitude 19.11 N, declination about
     -15 degrees, solar noon about 12:22 IST). */
  function sunAt(hour) {
    const lat = 19.11 * D2R, dec = -15.5 * D2R, H = (hour - 12.37) * 15 * D2R;
    const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) + Math.PI;
    return { el: el / D2R, az };
  }
  /* key states by sun elevation; everything in between is a cross-fade */
  const KEYS = [
    { el: -14, top: 0x05080f, mid: 0x0b1222, hor: 0x18213a, low: 0x0b0d12, sun: 0x8fa6ff, sunI: 0.0, hemiS: 0x24304f, hemiG: 0x0d0d12, hemiI: 0.55, fog: 0x121827, night: 1, lit: 0.55, exp: 1.25, stars: 1 },
    { el: -5, top: 0x16223f, mid: 0x3a3f63, hor: 0xd47e5a, low: 0x2b2228, sun: 0xff7a40, sunI: 0.25, hemiS: 0x50587a, hemiG: 0x2a2222, hemiI: 0.6, fog: 0x5b5260, night: 0.85, lit: 0.6, exp: 1.15, stars: 0.4 },
    { el: 3, top: 0x3d6aa3, mid: 0x9a93a8, hor: 0xf5a86a, low: 0x6b5a4c, sun: 0xffa45c, sunI: 1.9, hemiS: 0xb7b5c9, hemiG: 0x5a4a3c, hemiI: 0.62, fog: 0xd9a57f, night: 0.25, lit: 0.35, exp: 1.05, stars: 0 },
    { el: 12, top: 0x3c76bb, mid: 0x86aed3, hor: 0xe6cfae, low: 0x7b7462, sun: 0xffd6a0, sunI: 2.7, hemiS: 0xc6d8ea, hemiG: 0x5e5848, hemiI: 0.7, fog: 0xd8cdb8, night: 0, lit: 0.2, exp: 1.0, stars: 0 },
    { el: 45, top: 0x2f6db5, mid: 0x7fb0dd, hor: 0xcfdfe8, low: 0x7d7a6c, sun: 0xfff6e8, sunI: 3.1, hemiS: 0xcfe2f4, hemiG: 0x60604f, hemiI: 0.8, fog: 0xcbd9e2, night: 0, lit: 0.15, exp: 1.0, stars: 0 },
  ];
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  const lerpHex = (a, b, t, out) => out.copy(_ca.setHex(a)).lerp(_cb.setHex(b), t);
  function stateAt(el) {
    let i = 0; while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = smooth((el - a.el) / (b.el - a.el)), o = {};
    for (const k of Object.keys(a)) o[k] = typeof a[k] === "number" && k !== "el" && /^(top|mid|hor|low|sun|hemiS|hemiG|fog)$/.test(k) ? lerpHex(a[k], b[k], t, new THREE.Color()) : a[k] + (b[k] - a[k]) * t;
    return o;
  }

  /* --------------------------------------------------------- weather ---- */
  /* one table, blended over a second and a half (threejs-weather) */
  const WEATHER = [
    { id: "clear", label: "Clear", cloud: 0.12, sunK: 1, fogK: 1, grey: 0, wet: 0, rain: 0, rainV: 1, bolt: 0, haze: 0 },
    { id: "cloudy", label: "Cloudy", cloud: 0.7, sunK: 0.45, fogK: 0.8, grey: 0.35, wet: 0, rain: 0, rainV: 1, bolt: 0, haze: 0 },
    { id: "monsoon", label: "Monsoon", cloud: 0.95, sunK: 0.18, fogK: 0.36, grey: 0.72, wet: 1, rain: 0.65, rainV: 1, bolt: 0, haze: 0 },
    { id: "storm", label: "Storm", cloud: 1, sunK: 0.06, fogK: 0.26, grey: 0.95, wet: 1, rain: 1, rainV: 1.42, bolt: 1, haze: 0 },
    { id: "haze", label: "Haze", cloud: 0.25, sunK: 0.55, fogK: 0.26, grey: 0.15, wet: 0, rain: 0, rainV: 1, bolt: 0, haze: 1 },
  ];
  let wxFrom = WEATHER[0], wxTo = WEATHER[0], wxMix = 1;
  const wxN = (k) => wxFrom[k] + (wxTo[k] - wxFrom[k]) * wxMix;

  /* rain: a narrow, deep volume carried in front of the lens, sized to the
     camera's distance, drawn as streaks; density is a draw range */
  const RN = LITE ? 6000 : 16000;
  const RU = new Float32Array(RN * 3), rainDat = new Float32Array(RN);   // each drop in a unit box
  for (let i = 0; i < RN * 3; i++) RU[i] = (Math.random() - 0.5) * 2;
  for (let i = 0; i < RN; i++) rainDat[i] = Math.random();
  const rainG = new THREE.BufferGeometry();
  const rainAttr = new THREE.Float32BufferAttribute(new Float32Array(RN * 6), 3); rainAttr.setUsage(THREE.DynamicDrawUsage); rainG.setAttribute("position", rainAttr);
  const RW = rainAttr.array; // the attribute copies what it is given, so write to its own array
  const rain = new THREE.LineSegments(rainG, new THREE.LineBasicMaterial({ color: 0xc9d4de, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const _fw = new THREE.Vector3();
  function stepRain(dt) {
    const amt = wxN("rain"); rain.visible = amt > 0.01; if (!rain.visible) return;
    rain.material.opacity = 0.42 * Math.min(1, amt * 1.4);
    rainG.setDrawRange(0, Math.round(RN * Math.min(1, amt)) * 2);
    const d = clamp(camera.position.distanceTo(controls.target) * 0.18, 40, 520), half = d * 0.9;
    camera.getWorldDirection(_fw); const cx = camera.position.x + _fw.x * d, cy = camera.position.y + _fw.y * d, cz = camera.position.z + _fw.z * d;
    const v = wxN("rainV"), fall = 1.8 * v * dt, slant = 0.25 * v * v * dt, len = 0.09 * v;
    for (let i = 0; i < RN; i++) {
      const o = i * 3; RU[o + 1] -= fall * (0.8 + rainDat[i] * 0.4); RU[o] -= slant;
      if (RU[o + 1] < -1 || RU[o] < -1) { RU[o + 1] = 1; RU[o] = (Math.random() - 0.5) * 2; RU[o + 2] = (Math.random() - 0.5) * 2; }
      const x = cx + RU[o] * half, y = cy + RU[o + 1] * half, z = cz + RU[o + 2] * half * 0.9, w = i * 6;
      RW[w] = x; RW[w + 1] = y; RW[w + 2] = z; RW[w + 3] = x + slant / dt * len * half * 0.15; RW[w + 4] = y + len * half; RW[w + 5] = z;
    }
    rainAttr.needsUpdate = true;
  }

  /* lightning: a light nobody else touches, a few return strokes each */
  let pulses = [], boltAge = 0, boltNext = 3, boltK = 0;
  function strike() { const near = Math.random(), s = 0.42 + near * 0.58; pulses = [{ t: 0, a: s }]; let tt = 0;
    for (let i = 0, m = 1 + (Math.random() * 2.6 | 0); i < m; i++) { tt += 0.05 + Math.random() * 0.14; pulses.push({ t: tt, a: s * (0.3 + Math.random() * 0.65) }); }
    boltAge = 0; const az = Math.random() * 6.283; bolt.position.set(controls.target.x + Math.sin(az) * 3000, 2500, controls.target.z + Math.cos(az) * 3000); bolt.target.position.copy(controls.target); }
  function stepBolt(dt) {
    const en = wxN("bolt");
    if (en > 0.55) { boltNext -= dt; if (boltNext <= 0) { strike(); boltNext = 3.5 + Math.random() * 7; } }
    if (pulses.length) { boltAge += dt; let v = 0; for (const q of pulses) if (boltAge >= q.t) v += q.a * Math.exp(-(boltAge - q.t) / 0.085); boltK = Math.min(1.4, v); if (boltAge > 2.4) { pulses = []; boltK = 0; } }
    else boltK = 0;
    bolt.intensity = boltK * 4; skyU.flash.value = boltK; $("#flash").style.opacity = boltK > 0.002 ? (boltK * 0.14).toFixed(3) : "0";
  }

  /* ---------------------------------------------------------- the look -- */
  let HOUR = 16.5, BEAM_K = 1, FOG_D = 0.00015;
  const _sunDir = new THREE.Vector3(), _grey = new THREE.Color(0x5d6874), _haze = new THREE.Color(0xc9b597);
  let bloom;
  function applyLook() {
    const { el, az } = sunAt(HOUR); const st = stateAt(el);
    const grey = wxN("grey"), cloud = wxN("cloud"), haze = wxN("haze");
    const tint = (c) => c.lerp(_grey.clone().multiplyScalar(0.35 + 0.65 * (1 - st.night)), grey * 0.85).lerp(_haze.clone().multiplyScalar(0.3 + 0.7 * (1 - st.night)), haze * 0.6);
    skyU.top.value.copy(tint(st.top)); skyU.mid.value.copy(tint(st.mid)); skyU.hor.value.copy(tint(st.hor)); skyU.low.value.copy(tint(st.low));
    _sunDir.set(Math.sin(az) * Math.cos(el * D2R), Math.sin(el * D2R), -Math.cos(az) * Math.cos(el * D2R));
    skyU.sunDir.value.copy(_sunDir); skyU.sunCol.value.copy(st.sun); skyU.sunK.value = Math.max(0, (1 - cloud * 0.85)) * smooth((el + 4) / 6);
    skyU.cloud.value = cloud; skyU.stars.value = st.stars;
    const sunI = st.sunI * wxN("sunK") * smooth((el + 1) / 4);
    sun.intensity = sunI; sun.color.copy(st.sun); sun.castShadow = !LITE && sunI > 0.15;
    hemi.color.copy(tint(st.hemiS)); hemi.groundColor.copy(st.hemiG); hemi.intensity = st.hemiI * (1 + grey * 0.15);
    scene.fog.color.copy(skyU.hor.value);
    const fk = wxN("fogK"); FOG_D = 0.00015 / fk * (st.night > 0.5 ? 1.2 : 1);
    U.uNight.value = st.night; U.uLit.value = st.lit; U.uSky.value.copy(skyU.top.value).lerp(skyU.hor.value, 0.5);
    renderer.toneMappingExposure = st.exp * (1 - grey * 0.36) * (1 - haze * 0.05);
    lamps.visible = st.night > 0.08; lampM.opacity = Math.min(1, st.night * 1.2);
    for (const k of ["stations", "entries_l3", "viaduct"]) if (flatMats[k]) flatMats[k].emissiveIntensity = st.night * (k === "viaduct" ? 0.05 : k === "stations" ? 0.22 : 0.5);
    BEAM_K = 1 - st.night * 0.65; for (const [k, x] of OBJ) x.beam.material.uniforms.k.value = (k === SEL ? 0.9 : SEL ? 0.22 : 0.35) * BEAM_K;
    // wet ground (threejs-weather): darker, smoother, catches the sky
    const wet = wxN("wet"); U.uWet.value = wet;
    for (const m of WET) { m.color.copy(m.userData.base).multiplyScalar(1 - wet * 0.45); m.roughness = m.userData.rough - wet * (m.userData.rough - 0.12); m.metalness = wet * 0.25; }
    scene.environmentIntensity = 0.5 + wet * 0.5;
    treeMat.color.setScalar(1 - st.night * 0.6).lerp(new THREE.Color(1.05, 1.1, 1.0), wet * 0.1);
    if (bloom) { bloom.strength = 0.1 + st.night * 0.42; bloom.threshold = 0.85 - st.night * 0.12; }
    envDirty = true;
    $("#hour-t").textContent = fmtHour(HOUR);
  }
  const fmtHour = (h) => { const H = Math.floor(h), M = Math.round((h - H) * 60) % 60, ap = H >= 12 && H < 24 ? "pm" : "am"; return `${((H + 11) % 12) + 1}:${String(M).padStart(2, "0")} ${ap}`; };

  /* reflections: the sky prefiltered, rebuilt only when the look changes */
  const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null, envDirty = true, envAt = 0;
  const envScene = new THREE.Scene(); const envSky = sky.clone(); envSky.material = sky.material; envSky.scale.setScalar(0.01); envScene.add(envSky);
  function refreshEnv(now) { if (!envDirty || now - envAt < 250) return; envDirty = false; envAt = now; const rt = pmrem.fromScene(envScene, 0, 1, 1000); if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture; }

  /* -------------------------------------------------------- composer ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.6, 0.8); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* --------------------------------------------------------- camera ----- */
  let fly = null;
  function flyTo(target, pos, ms = 1600) { fly = { t0: performance.now(), ms, a: { t: controls.target.clone(), p: camera.position.clone() }, b: { t: target.clone(), p: pos.clone() } }; }
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function stepFly(now) { if (!fly) return; const t = Math.min(1, (now - fly.t0) / fly.ms), e = ease(t);
    controls.target.lerpVectors(fly.a.t, fly.b.t, e); camera.position.lerpVectors(fly.a.p, fly.b.p, e);
    const lift = Math.sin(Math.PI * e) * fly.a.p.distanceTo(fly.b.p) * 0.12; camera.position.y += lift; if (t >= 1) fly = null; }
  const orbitPos = (t, dist, polarDeg, azDeg) => new THREE.Vector3(t.x + dist * Math.sin(polarDeg * D2R) * Math.sin(azDeg * D2R), t.y + dist * Math.cos(polarDeg * D2R), t.z + dist * Math.sin(polarDeg * D2R) * Math.cos(azDeg * D2R));
  const curAz = () => Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) / D2R;
  function fitPoints(pts, polar, az, pad = 1.25) {
    const box = new THREE.Box3().setFromPoints(pts); const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
    const r = Math.max(sz.x, sz.z, sz.y * 1.4) / 2 * pad; const fov = camera.fov * D2R; const aspect = Math.min(camera.aspect, 1.6);
    const dist = r / Math.tan(fov / 2) / Math.min(1, aspect) + r * 0.3; return { t: c.setY(Math.min(c.y, 20)), p: orbitPos(c, clamp(dist, 180, 7000), polar, az) };
  }
  function overview(ms) { const pts = [...OBJ.values()].flatMap((b) => [new THREE.Vector3(b.x, 0, b.z), new THREE.Vector3(b.x, b.h, b.z)]); const f = fitPoints(pts, 54, 345, 1.12); flyTo(f.t, f.p, ms); }

  /* -------------------------------------------------------- selection --- */
  let SEL = null, CONN = null, SHOT = "close";
  const conns = (o) => (o.routes || []);
  function drawRoute() {
    routeGroup.clear(); stationEnd.visible = false; routeLabel.el.classList.add("hide"); STN.forEach((L) => L.el.classList.remove("hl"));
    if (!SEL || !CONN) return;
    const r = CONN; const rb = ribbon(r.path, r.mode === "walk" ? 6 : 9, 2.2);
    const m = routeMat.clone(); m.uniforms.uTime = U.uTime; m.uniforms.col.value.set(r.kind === "rail" ? 0xff7a5c : 0xffb060);
    const mesh = new THREE.Mesh(rb.g, m); mesh.renderOrder = 10; routeGroup.add(mesh);
    const end = rb.P[rb.P.length - 1]; stationEnd.position.set(end.x, 0.8, end.y); stationEnd.visible = true; stationEnd.material.color.set(m.uniforms.col.value);
    const mid = rb.P[Math.floor(rb.P.length / 2)]; routeLabel.pos.set(mid.x, 18, mid.y);
    routeLabel.el.textContent = r.mode === "walk" ? `${fmtM(r.m)} walk · ${r.min} min` : `${fmtM(r.m)} by road`; routeLabel.el.classList.remove("hide");
    const hit = STN.find((L) => L.st.name === r.name || (r.kind === "rail" && L.st.line === "RLY")); if (hit) hit.el.classList.add("hl");
    return rb;
  }
  function shot(kind, ms = 1500) {
    if (!SEL) return; SHOT = kind; const b = OBJ.get(SEL); const c = new THREE.Vector3(b.x, b.h * 0.45, b.z); const az = curAz();
    document.querySelectorAll(".shots button").forEach((x) => x.classList.toggle("on", x.dataset.shot === kind));
    if (kind === "close") flyTo(c, orbitPos(c, Math.max(260, b.h * 4.2 + b.r * 2.4), 58, az), ms);
    else if (kind === "street") { const t = new THREE.Vector3(b.x, b.h * 0.55, b.z); flyTo(t, orbitPos(t, Math.max(150, b.r * 3 + b.h * 1.6), 84, az), ms); }
    else if (kind === "metro" && CONN) { const pts = CONN.path.map(([lng, lat]) => { const [x, z] = toXZ(lng, lat); return new THREE.Vector3(x, 0, z); }); pts.push(new THREE.Vector3(b.x, b.h, b.z)); const f = fitPoints(pts, 48, az, 1.3); flyTo(f.t, f.p, ms); }
    else if (kind === "aerial") { const f = fitPoints([new THREE.Vector3(b.x - 600, 0, b.z - 600), new THREE.Vector3(b.x + 600, 0, b.z + 600)], 40, az, 1); flyTo(f.t, f.p, ms); }
  }
  function select(id, conn) {
    SEL = id; const b = OBJ.get(id); const o = b.o; document.body.classList.add("sel"); $("#panel").hidden = false;
    CONN = conn || conns(o).find((r) => r.kind === "metro") || conns(o)[0] || null;
    for (const [k, x] of OBJ) { const on = k === id; x.beam.material.uniforms.k.value = (on ? 0.9 : 0.22) * BEAM_K; x.ring.material.opacity = on ? 0.9 : 0; x.label.el.classList.toggle("on", on); const m = optMat.get(k); if (m) m.userData.u.uSelK.value = on ? 1 : 0; }
    document.querySelectorAll(".card").forEach((c) => c.classList.toggle("on", c.dataset.id === id));
    renderPanel(o); drawRoute(); shot(conn ? "metro" : "close");
    try { history.replaceState(null, "", `#${id}`); } catch (e) {}
  }
  function deselect() {
    SEL = null; CONN = null; document.body.classList.remove("sel"); drawRoute();
    for (const [k, x] of OBJ) { x.beam.material.uniforms.k.value = 0.35 * BEAM_K; x.ring.material.opacity = 0; x.label.el.classList.remove("on"); const m = optMat.get(k); if (m) m.userData.u.uSelK.value = 0; }
    document.querySelectorAll(".card").forEach((c) => c.classList.remove("on")); overview(1400);
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
  }

  /* --------------------------------------------------------------- UI --- */
  const near = (o) => { const r = conns(o).find((x) => x.kind === "metro"); return r ? `${fmtM(r.m)}<i>to metro</i>` : ""; };
  $("#t-title").textContent = A.meta.title; $("#t-sub").textContent = "3D world · " + (A.meta.city || "");
  $("#b-eyebrow").textContent = (A.copy && A.copy.overview && A.copy.overview.eyebrow) || "Autopilot";
  $("#b-title").textContent = (A.copy && A.copy.overview && A.copy.overview.title) || A.meta.title;
  $("#b-sub").textContent = `${OPTS.length} buildings in a 3D model of the district. Pick one to fly there and walk it to the metro.`;
  $("#to-map").href = A.path || "/" + SLUG;
  $("#list").innerHTML = OPTS.map((o) => `<button class="card" data-id="${esc(o.id)}"><span class="n">${String(o.n).padStart(2, "0")}</span><span class="nm">${esc(o.name)}${(o.reason || "").startsWith("PRIORITY") ? `<span class="prio">${esc(o.reason.split(" · ")[0])}</span>` : ""}</span><span class="m">${near(o)}</span><span class="sub">${esc((o.facts.find((f) => f.k === "Micro-market") || {}).v || o.locality || "")} · ${esc((o.facts.find((f) => f.k === "Floor / Unit") || {}).v ? "Floor " + o.facts.find((f) => f.k === "Floor / Unit").v : "")}</span></button>`).join("");
  $("#list").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) (SEL === c.dataset.id ? shot("close") : select(c.dataset.id)); });
  $("#legend").innerHTML = `<span><i style="background:${LINE_COL.L1}"></i>Metro Line 1</span><span><i style="background:${LINE_COL.L3}"></i>Line 3 (underground)</span><span><i style="background:${LINE_COL.L7}"></i>Line 7</span><span><i style="background:#ffa860"></i>Route on show</span>`;
  $("#credit").textContent = `Model: ${DATA.source}. Heights estimated; the seven options use the deck's floors. Built in Blender.`;
  function renderPanel(o) {
    const rows = conns(o);
    const row = (r) => `<button class="cn ${r.kind}${CONN === r ? " on" : ""}" data-conn="${esc(r.kind)}|${esc(r.name)}"><span class="ck" ${r.kind === "metro" ? `style="background:${LINE_COL[(r.lines || [])[0]] || LINE_COL.L1}"` : ""}></span><span><b>${esc(r.name)}</b><i>${esc((r.lines || []).join(" · "))}${r.mode === "walk" ? ` · ${r.min} min walk` : " · by road"}</i></span><span class="cd">${fmtM(r.m)}</span></button>`;
    const metro = rows.filter((r) => r.kind === "metro"), rail = rows.filter((r) => r.kind === "rail");
    const spec = (o.facts || []).filter((f) => !f.src);
    const img = A.meta.world.renders && A.meta.world.renders[o.id];
    $("#p-head").innerHTML = `<div class="eyebrow">${String(o.n).padStart(2, "0")} · ${esc((spec.find((f) => f.k === "Micro-market") || {}).v || "")}</div><h2>${esc(o.name)}</h2><p class="reason">${esc(o.reason || "")}</p>
      <div class="shots">${[["close", "Close-up"], ["street", "Street"], ["metro", "Metro"], ["aerial", "Aerial"]].map(([k, l]) => `<button data-shot="${k}" class="${SHOT === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
    const by = (o.facts || []).find((f) => f.k === "Railway by metro");
    $("#p-body").innerHTML = `<h3>How you get there</h3>${metro.length ? `<div class="ch">Metro</div>${metro.map(row).join("")}` : ""}${rail.length ? `<div class="ch">Railway station</div>${rail.map(row).join("")}` : ""}
      ${by ? `<p class="note">${esc(by.v)}</p>` : ""}<p class="note">${esc((A.copy && A.copy.connect && A.copy.connect.note) || "")} The line in the model follows the streets.</p>
      ${img ? `<figure class="render"><img src="${esc(A.meta.world.data + img)}" alt="${esc(o.name)} rendered in Blender" loading="lazy"><figcaption>Rendered in Blender (Cycles) from the same model</figcaption></figure>` : ""}
      <h3>Property</h3><dl class="facts">${spec.map((f) => `<dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd>`).join("")}</dl>`;
  }
  $("#p-head").addEventListener("click", (e) => { const b = e.target.closest("[data-shot]"); if (b) shot(b.dataset.shot); });
  $("#p-body").addEventListener("click", (e) => { const b = e.target.closest("[data-conn]"); if (!b || !SEL) return; const [k, n] = b.dataset.conn.split("|"); const o = OBJ.get(SEL).o; CONN = conns(o).find((r) => r.kind === k && r.name === n); renderPanel(o); drawRoute(); shot("metro"); });
  $("#p-close").addEventListener("click", deselect);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && SEL) deselect(); });
  $("#wx").innerHTML = WEATHER.map((w) => `<button data-wx="${w.id}" class="${w.id === "clear" ? "on" : ""}"><span>${w.label}</span></button>`).join("");
  const WX_ICON = { clear: "☀", cloudy: "☁", monsoon: "🌧", storm: "⛈", haze: "🌫" };
  document.querySelectorAll("#wx button").forEach((b) => b.insertAdjacentText("afterbegin", WX_ICON[b.dataset.wx] + " "));
  function setWeather(id) { const w = WEATHER.find((x) => x.id === id) || WEATHER[0]; const now = {}; for (const k of Object.keys(WEATHER[0])) now[k] = typeof WEATHER[0][k] === "number" ? wxN(k) : w[k]; wxFrom = now; wxTo = w; wxMix = 0;
    document.querySelectorAll("#wx button").forEach((b) => b.classList.toggle("on", b.dataset.wx === id)); try { localStorage.setItem("world-wx", id); } catch (e) {} }
  $("#wx").addEventListener("click", (e) => { const b = e.target.closest("[data-wx]"); if (b) setWeather(b.dataset.wx); });
  $("#hour").addEventListener("input", (e) => { HOUR = +e.target.value; applyLook(); });
  if (Q.get("t")) { HOUR = clamp(+Q.get("t"), 5.5, 23.5); $("#hour").value = HOUR; }
  if (Q.get("wx")) setWeather(Q.get("wx")), wxMix = 1;

  /* click a building in the model */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; ptr.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects([...OPT_MESH.values(), ...[...OBJ.values()].map((b) => b.beam)], false)[0];
    if (hit) { let ob = hit.object; while (ob && !ob.userData.opt) ob = ob.parent; if (ob) select(ob.userData.opt); }
  });
  addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

  /* --------------------------------------------------------------- go --- */
  applyLook();
  overview(0); camera.position.copy(fly ? fly.b.p : camera.position); controls.target.copy(fly ? fly.b.t : controls.target); fly = null;
  { const p = camera.position.clone(), t = controls.target.clone(); camera.position.copy(orbitPos(t, p.distanceTo(t) * 1.6, 30, 300)); flyTo(t, p, 3200); }
  for (const h of ["top", "board"]) $("#" + h).hidden = false;
  $("#l-bar").style.width = "100%";
  setTimeout(() => { $("#load").style.transition = "opacity .8s"; $("#load").style.opacity = "0"; setTimeout(() => $("#load").remove(), 900); $("#hint").hidden = false; setTimeout(() => ($("#hint").style.opacity = "0"), 5000); }, 250);
  const deep = location.hash.slice(1); if (deep && OBJ.has(deep)) setTimeout(() => select(deep), 900);

  let last = performance.now();
  const clock = { frames: 0 };
  function frame(now) {
    const dt = Math.min(STILL ? 0.5 : 0.05, (now - last) / 1000); last = now; U.uTime.value += dt;
    if (wxMix < 1) { wxMix = Math.min(1, wxMix + dt / 1.5); applyLook(); }
    stepFly(now); controls.update();
    // keep the camera over the district
    controls.target.x = clamp(controls.target.x, B[0], B[2]); controls.target.z = clamp(controls.target.z, -B[3], -B[1]);
    // the sun's shadow box follows what we look at
    const dist = camera.position.distanceTo(controls.target), half = clamp(dist * 0.7, 300, 2600);
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix();
    sun.target.position.copy(controls.target); sun.position.copy(controls.target).addScaledVector(_sunDir.y > 0.02 ? _sunDir : _sunDir.clone().setY(0.3).normalize(), 4000);
    scene.fog.density = FOG_D * clamp(2400 / dist, 0.45, 1);
    stepCars(dt); stepTrains(dt); stepRain(dt); stepBolt(dt);
    refreshEnv(now);
    composer.render();
    placeLabels();
    clock.frames++;
    if (!STILL) requestAnimationFrame(frame);
  }
  /* ?still=1 draws a frame only when asked (window.__world.tick), for
     screenshots in a browser without a GPU */
  const STILL = Q.get("still") === "1";
  if (STILL) { last = performance.now() - 16; frame(performance.now()); } else requestAnimationFrame(frame);
  window.__world = { tick: (n = 1, dt = 0.25) => { for (let i = 0; i < n; i++) { last = performance.now() - dt * 1000; fly = fly && { ...fly, t0: fly.t0 - 1e9 }; frame(performance.now()); } }, select, deselect, setWeather, setHour: (h) => { HOUR = h; $("#hour").value = h; applyLook(); }, shot, clock, scene, renderer };
}

boot();
