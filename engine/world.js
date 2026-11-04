/* ============================================================================
   ATLAS · Explorer (the 3D world)

   /<slug>/world shows each option as a dollhouse: a slab of its district
   cut out around the building and its nearest metro station, built in
   Blender by scripts/world/diorama.py at close-up quality. Two ways in:

     Dollhouse   the slab on a turntable, tilt-shifted like a model
     Walk        stand on the footpath at eye height, look up at the facade,
                 walk around it (the buildings are solid), and see how far
                 the entrance and the metro are; "Walk to the metro" follows
                 the street route at walking pace, time-lapsed

   Lighting is the Blender sky (an equirectangular HDR rendered with the
   same sun), with soft sun shadows and ambient occlusion. The facades are
   painted textures at true scale (scripts/world/textures.py).

   Options, routes and figures come from the atlas bundle; the diorama's
   own file (<id>.json) carries the building, the walk start, the stations,
   the trees, lamps, traffic and metro lines in the slab's metres
   (x east, y north). three's X is east, Y up, -Z north.
   ============================================================================ */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const Q = new URLSearchParams(location.search);
const MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const STILL = Q.get("still") === "1";
const SLUG = ((Q.get("atlas") || location.pathname.split("/")[1] || "") + "").toLowerCase().replace(/[^a-z0-9-]/g, "");
const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtM = (m) => m < 1000 ? [`${Math.round(m / 10) * 10}`, "M"] : [`${(m / 1000).toFixed(1)}`, "KM"];
const fm = (m) => fmtM(m).join(" ");
const LINE = { L1: ["#3d8fd6", "Line 1"], L3: ["#2bb3a6", "Line 3"], L7: ["#e2584f", "Line 7"] };
const P3 = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

/* --------------------------------------------------------------- boot ---- */
function script(src) { return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
async function sha256(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
const normId = (v) => String(v).trim().toUpperCase().replace(/[\s-]/g, "");
function fail(msg) { $("#l-title").textContent = "Not available"; $("#l-msg").textContent = msg; }
async function boot() {
  try { await script(`/engine/atlases/${SLUG}.js`); } catch (e) { return fail("This atlas has no 3D explorer."); }
  const A = window.ATLAS, W = A && A.meta && A.meta.world;
  if (!A || !W) return fail("This atlas has no 3D explorer.");
  document.title = `${A.meta.title} · Explorer`;
  if (W.poster) for (const id of ["#load", "#gate"]) $(id).style.backgroundImage = `url("${W.data}${W.poster}")`;
  const KEY = SLUG + "-auth"; let authed = !(A.gate && A.gate.hash);
  try { if (sessionStorage.getItem(KEY) === "1") authed = true; } catch (e) {}
  if (!authed) {
    $("#load").hidden = true; $("#gate").hidden = false;
    await new Promise((done) => $("#g-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if ((await sha256(normId($("#g-id").value) + ":" + normId($("#g-pw").value))) !== A.gate.hash) { $("#g-err").textContent = "That ID and password do not match."; return; }
      try { sessionStorage.setItem(KEY, "1"); } catch (x) {}
      $("#gate").hidden = true; $("#load").hidden = false; done();
    }));
  }
  start(A, W).catch((e) => { console.error(e); fail("The explorer could not load: " + e.message); });
}

/* -------------------------------------------------------------- world ---- */
async function start(A, W) {
  const canvas = $("#c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.3, 6000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.maxPolarAngle = 76 * D2R; controls.minPolarAngle = 18 * D2R;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.35; controls.zoomSpeed = 0.9;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  /* the Blender sky: lighting and reflections; the background only when walking */
  const hdr = await new RGBELoader().loadAsync(W.data + W.sky);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer); const env = pmrem.fromEquirectangular(hdr).texture;
  scene.environment = env; scene.environmentIntensity = 0.55;
  /* the sun the sky was rendered with: azimuth 235, elevation 24 (golden afternoon) */
  const SUN = new THREE.Vector3(Math.sin(235 * D2R) * Math.cos(24 * D2R), Math.sin(24 * D2R), -Math.cos(235 * D2R) * Math.cos(24 * D2R)).normalize();
  const sun = new THREE.DirectionalLight(0xffe6c4, 3.1); sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 2048 : 4096, MOBILE ? 2048 : 4096); sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.6; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight(0xcfe0f0, 0x6b6253, 0.35); scene.add(fill);

  /* textures, loaded once and shared by every diorama */
  const texL = new THREE.TextureLoader(); const TEX = {}; const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (name, srgb = true) => TEX[name] || (TEX[name] = (() => { const t = texL.load(W.data + "tex/" + name + (name.startsWith("leaves") ? ".png" : ".jpg")); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; return t; })());
  const GLASSY = new Set(["wall_com_glass", "wall_opt_glass", "wall_com_ribbon", "wall_opt_plaster", "wall_res_tower"]);
  const MAT = {};
  function material(name) {
    if (MAT[name]) return MAT[name];
    let m;
    if (name.startsWith("wall_")) {
      const k = name.slice(5);
      m = new THREE.MeshStandardMaterial({ map: tex(k), roughnessMap: tex(k + "_r", false), roughness: 1, metalness: 0, envMapIntensity: 1 });
      if (GLASSY.has(name)) m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n metalnessFactor = 1.0 - smoothstep(0.22, 0.5, roughnessFactor);"); };
    } else {
      const C = {
        roof: [0xffffff, 0.92, 0, "roof"], ground: [0xd8d2c6, 0.95, 0, "roof"], asphalt: [0xffffff, 0.86, 0, "asphalt"], pavers: [0xffffff, 0.9, 0, "pavers"], grass: [0xffffff, 0.96, 0, "grass"], soil: [0xffffff, 1, 0, "soil"],
        parapet: [0xcfc8b8, 0.9], kerb: [0xbdb8ab, 0.85], water: [0x3b4f54, 0.06, 0.2], marking: [0xeeeee6, 0.6], concrete: [0xcac6bc, 0.78], concrete_dark: [0x9f9b92, 0.82], metal: [0xa9adb1, 0.35, 0.9],
        station_roof: [0xdadde0, 0.28, 0.85], sign_l1: [0x1c5fa8, 0.4], sign_l3: [0x1d8a8a, 0.4], rail: [0x77716a, 0.35, 0.9], tank: [0x1d1f22, 0.5], mullion: [0xc4c9cc, 0.28, 0.9], slab_edge: [0xe8e5de, 0.6],
        glass_lobby: [0x4e6a76, 0.04, 0.75], canopy: [0x2b2e31, 0.4, 0.6], wire: [0x333333, 0.5, 0.8], ballast: [0x7d7568, 0.95], roof_tin: [0x8f8f8a, 0.42, 0.6], roof_tarp: [0x2f63a8, 0.6], roof_tin_rust: [0x7a5b45, 0.7, 0.3],
        trunk: [0x5b4a3b, 0.9], leaf: [0xffffff, 0.8], leaf_b: [0xffffff, 0.8], frond: [0x5a8735, 0.75], lamp_head: [0xe6e2d6, 0.4], car_body: [0xd8d8d6, 0.25, 0.55], car_glass: [0x1f252a, 0.06, 0.5], tyre: [0x1b1b1b, 0.9],
        auto_body: [0x2d7d3a, 0.4, 0.2], auto_top: [0xf0c22e, 0.5], bus_body: [0xb8322a, 0.4, 0.3], train_body: [0xeef1f4, 0.25, 0.45], train_win: [0x1e2832, 0.05, 0.6], train_stripe: [0x1c5fa8, 0.35],
      }[name] || [0x9a9a9a, 0.8];
      m = new THREE.MeshStandardMaterial({ color: C[0], roughness: C[1], metalness: C[2] || 0 });
      if (C[3]) m.map = tex(C[3]);
      if (name === "station_glass") Object.assign(m, { color: new THREE.Color(0x9cc0cf), roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false });
      if (name === "sign_text" || name === "opt_name") Object.assign(m, { color: new THREE.Color(0xffffff), emissive: new THREE.Color(name === "opt_name" ? 0xfff2da : 0xffffff), emissiveIntensity: 0.55, roughness: 0.4 });
      if (name === "leaf" || name === "leaf_b") Object.assign(m, { color: new THREE.Color(0xffffff), map: tex(name === "leaf" ? "leaves_a" : "leaves_b"), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78 });
      if (name === "leaf" || name === "leaf_b" || name === "frond") m.onBeforeCompile = (sh) => {   // colour drifts across a crown, as in the stills
        sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;");
        sh.fragmentShader = "varying vec3 vWp;\n" + sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n float nz = sin(vWp.x * 0.9) * sin(vWp.z * 1.1 + vWp.y * 0.7) * 0.5 + 0.5; diffuseColor.rgb *= mix(vec3(0.72, 0.82, 0.62), vec3(1.25, 1.18, 0.95), nz);");
      };
    }
    m.name = name; return (MAT[name] = m);
  }

  /* -------------------------------------------------------- post ---- */
  const LOW = MOBILE || Q.get("q") === "low";
  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: LOW || Q.get("msaa") === "0" ? 0 : 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.output = GTAOPass.OUTPUT.Default;
  gtao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.4, thickness: 6, scale: 1.2, samples: 16 }); gtao.blendIntensity = 0.9;
  if (!LOW && Q.get("ao") !== "0") composer.addPass(gtao);
  /* tilt-shift: sharp across the middle band, blurred above and below, the
     miniature read of a model photographed close */
  const tilt = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) }, uK: { value: 1 }, uMid: { value: 0.52 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uK, uMid; varying vec2 vUv;
      void main(){ float d = abs(vUv.y - uMid); float r = smoothstep(0.2, 0.55, d) * 5.0 * uK; vec4 c = vec4(0.); float tw = 0.;
        for (int i = -4; i <= 4; i++) for (int j = -4; j <= 4; j++) { vec2 o = vec2(float(i), float(j)) * r / uRes; float w = exp(-float(i*i + j*j) / 12.); c += texture2D(tDiffuse, vUv + o) * w; tw += w; }
        vec4 base = texture2D(tDiffuse, vUv); gl_FragColor = mix(base, c / tw, smoothstep(0.0, 0.5, r)); }` });
  composer.addPass(tilt);
  composer.addPass(new OutputPass());

  /* ----------------------------------------------------- the diorama ---- */
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  let D = null, root = null, inst = [], movers = [], solid = [], groundMeshes = [];
  const OPTS = A.options;
  function protoParts(node) {   // every mesh under a prototype, with its transform relative to it
    const out = []; node.updateMatrixWorld(true); const inv = node.matrixWorld.clone().invert();
    node.traverse((o) => { if (o.isMesh) out.push({ geo: o.geometry, mat: material(o.material.name), m: inv.clone().multiply(o.matrixWorld) }); });
    return out;
  }
  function instance(parts, mats, shadow = true) {   // mats: array of Matrix4
    const out = [];
    for (const p of parts) { const im = new THREE.InstancedMesh(p.geo, p.mat, mats.length); const t = new THREE.Matrix4();
      mats.forEach((m, i) => im.setMatrixAt(i, t.multiplyMatrices(m, p.m))); im.castShadow = shadow; im.receiveShadow = true; scene.add(im); out.push(im); }
    return out;
  }
  /* Google's photorealistic 3D tiles: the real buildings of Andheri, with
     their real facades, in place of our Blender blocks, wherever the Maps key
     allows it (window.GOOGLE_MAPS_KEY from /config.js, with the Map Tiles
     API and billing on). Pins, routes, labels and walking stay ours.
     ?own=1 keeps the Blender dioramas. The world frame is scripts/world/
     prep.py's: metres east and north of 72.867 E, 19.111 N. */
  const GKEY = Q.get("own") === "1" ? "" : (window.GOOGLE_MAPS_KEY || "");
  const LNG0 = 72.867, LAT0 = 19.111, KXW = Math.cos(LAT0 * D2R) * 111320, KYW = 110540;
  let tiles = null, tilesHold = null, TILES_MOD = null; window.__googleTiles = "off";
  const draco = new DRACOLoader(); draco.setDecoderPath("/engine/vendor/three/jsm/libs/draco/gltf/");
  async function googleAt(origin) {
    if (!GKEY) return false;
    try {
      if (!TILES_MOD) TILES_MOD = await Promise.all([import("3d-tiles-renderer"), import("3d-tiles-renderer/plugins"), import("3d-tiles-renderer/three/plugins")]);
      const [{ TilesRenderer }, P, TP] = TILES_MOD;
      if (tiles) { tilesHold.remove(tiles.group); scene.remove(tilesHold); tiles.dispose(); tiles = null; }
      const lng = LNG0 + origin[0] / KXW, lat = LAT0 + origin[1] / KYW;
      const t = new TilesRenderer();
      t.registerPlugin(new P.GoogleCloudAuthPlugin({ apiToken: GKEY, autoRefreshToken: true }));
      t.registerPlugin(new P.GLTFExtensionsPlugin({ dracoLoader: draco }));
      t.registerPlugin(new TP.TileCompressionPlugin()); t.registerPlugin(new P.TilesFadePlugin());
      t.registerPlugin(new P.ReorientationPlugin({ lat: lat * D2R, lon: lng * D2R, height: 0, up: "+y", recenter: true }));
      t.errorTarget = MOBILE ? 14 : 5;
      t.setCamera(camera); t.setResolutionFromRenderer(camera, renderer);
      // photographs, already lit: show their colours as they are
      t.addEventListener("load-model", ({ scene: m }) => m.traverse((o) => { if (o.material) { o.material.toneMapped = false; o.castShadow = false; o.receiveShadow = false; } }));
      let failed = false; t.addEventListener("load-error", () => { failed = true; });
      tilesHold = new THREE.Group(); tilesHold.add(t.group); scene.add(tilesHold);
      const ok = await new Promise((res) => { const t0 = performance.now(); const tick = () => { camera.updateMatrixWorld(); t.update(); let n = 0; t.group.traverse((o) => { if (o.isMesh) n++; });
        if (n > 30) return res(true); if (failed || performance.now() - t0 > 15000) return res(false); requestAnimationFrame(tick); }; tick(); });
      if (!ok) { scene.remove(tilesHold); t.dispose(); window.__googleTiles = "failed"; return false; }
      // put Google's ground at our y = 0: the lowest surface straight down at the slab centre
      await new Promise((r) => setTimeout(r, 1500)); t.update();
      const hits = new THREE.Raycaster(new THREE.Vector3(0, 800, 0), new THREE.Vector3(0, -1, 0)).intersectObject(t.group, true);
      if (hits.length) tilesHold.position.y = -hits[hits.length - 1].point.y;
      tiles = t; window.__googleTiles = "on";
      return true;
    } catch (e) { console.warn("Google 3D tiles:", e); window.__googleTiles = "failed"; return false; }
  }
  async function loadDiorama(id) {
    $("#veil").classList.add("on");
    const [gltf, data] = await Promise.all([
      new Promise((ok, bad) => loader.load(`${W.data}d/${id}.glb`, ok, (e) => { if (e.total) $("#l-bar").style.width = `${Math.round(e.loaded / e.total * 90)}%`; }, bad)),
      fetch(`${W.data}d/${id}.json`).then((r) => r.json())]);
    if (root) { scene.remove(root); root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
    for (const m of inst) { scene.remove(m); m.dispose(); } inst = []; movers = []; groundMeshes = [];
    D = data; root = gltf.scene; scene.add(root);
    const protos = {};
    root.traverse((o) => {
      if (o.name && o.name.startsWith("proto_") && !o.name.endsWith("_c") && !o.name.includes("_crown") && o.parent === root) protos[o.name] = o;
      if (!o.isMesh) return;
      const n = o.material && o.material.name; o.material = material(n || "concrete");
      o.castShadow = !/^(ground|asphalt|pavers|grass|marking|water|kerb|soil)$/.test(n); o.receiveShadow = true;
      if (/^(ground|asphalt|pavers|grass|kerb|marking|water)$/.test(n)) groundMeshes.push(o);
    });
    for (const p of Object.values(protos)) p.visible = false;
    const pp = (k) => protos[k] ? protoParts(protos[k]) : [];
    // trees and palms
    const m4 = (x, y, z, rot, s) => new THREE.Matrix4().compose(P3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s, s, s));
    const T = [[], [], []]; for (const [x, y, t, k, r] of D.trees) T[t].push(m4(x, y, 0, r, 0.75 + 0.35 * k));
    inst.push(...instance(pp("proto_tree_a"), T[0]), ...instance(pp("proto_tree_b"), T[1]), ...instance(pp("proto_palm"), T[2]));
    inst.push(...instance(pp("proto_lamp"), D.lamps.map(([x, y], i) => m4(x, y, 0.2, (i * 2.4) % 6.28, 1)), false));
    // traffic: cars, autos and buses running in their lanes
    const lanes = D.traffic.map((t) => { const P = t.p.map(([x, y]) => new THREE.Vector2(x, -y)); const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1])); return { P, L, len: L[L.length - 1], w: t.w }; });
    const kinds = { proto_car: [], proto_auto: [], proto_bus: [] };
    for (const ln of lanes) for (let s = Math.random() * 20; s < ln.len; s += 16 + Math.random() * 26) {
      const r = Math.random(), k = r < 0.3 ? "proto_auto" : r > 0.95 ? "proto_bus" : "proto_car", dir = Math.random() < 0.5 ? 1 : -1;
      kinds[k].push({ ln, s, dir, v: (6 + Math.random() * 6) * (k === "proto_bus" ? 0.8 : 1), lane: dir * ln.w * (0.18 + Math.random() * 0.1) });
    }
    for (const [k, list] of Object.entries(kinds)) { if (!list.length) continue; const parts = instance(pp(k), list.map(() => new THREE.Matrix4())); inst.push(...parts); movers.push({ parts, list, base: pp(k) }); }
    // the Line 1 / Line 7 trains
    for (const [key, ls] of Object.entries(D.metro || {})) for (const m of ls.slice(0, 1)) {
      const P = m.p.map(([x, y]) => new THREE.Vector2(x, -y)); const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
      const ln = { P, L, len: L[L.length - 1], z: m.z };
      const trains = [{ ln, s: ln.len * 0.3, dir: 1, off: 1.9, v: 11, wait: 0 }, { ln, s: ln.len * 0.75, dir: -1, off: -1.9, v: 11, wait: 0 }];
      const parts = instance(pp("proto_train"), Array(trains.length * 4).fill(0).map(() => new THREE.Matrix4())); inst.push(...parts);
      movers.push({ parts, trains, base: pp("proto_train"), key });
    }
    // solid footprints for walking
    solid = D.blocks.map((r) => r.map(([x, y]) => [x, y]));
    // the real city, where Google's tiles load: our blocks, trees and traffic make way for it
    const real = await googleAt(D.origin);
    root.visible = !real; for (const m of inst) m.visible = !real;
    $("#credit").textContent = real ? "3D: Google photorealistic 3D tiles (Map data ©Google). Pins, routes and labels: Autopilot. Distances: Google Maps."
      : "Built in Blender from Overture Maps footprints. Heights around each building are estimated; the buildings use the deck's floors. Distances: Google Maps.";
    placeLabels(true);
    await new Promise((r) => setTimeout(r, 50));
    $("#veil").classList.remove("on");
    return D;
  }
  const along = (ln, s, out) => { s = clamp(s, 0, ln.len); let i = 1; while (i < ln.L.length - 1 && ln.L[i] < s) i++; const t = (s - ln.L[i - 1]) / Math.max(1e-6, ln.L[i] - ln.L[i - 1]);
    out.x = ln.P[i - 1].x + (ln.P[i].x - ln.P[i - 1].x) * t; out.y = ln.P[i - 1].y + (ln.P[i].y - ln.P[i - 1].y) * t; return Math.atan2(ln.P[i].y - ln.P[i - 1].y, ln.P[i].x - ln.P[i - 1].x); };
  const _v2 = new THREE.Vector2(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _t = new THREE.Matrix4();
  function stepMovers(dt) {
    for (const mv of movers) {
      if (mv.list) mv.list.forEach((c, i) => { c.s += c.v * c.dir * dt; if (c.s > c.ln.len) c.s -= c.ln.len; if (c.s < 0) c.s += c.ln.len;
        const a = along(c.ln, c.s, _v2); _p.set(_v2.x - Math.sin(a) * c.lane, 0.06, _v2.y + Math.cos(a) * c.lane); _e.set(0, -a + (c.dir < 0 ? Math.PI : 0), 0); _q.setFromEuler(_e); _m.compose(_p, _q, _one);
        mv.parts.forEach((im, k) => im.setMatrixAt(i, _t.multiplyMatrices(_m, mv.base[k].m))); });
      if (mv.trains) mv.trains.forEach((t, j) => { if (t.wait > 0) t.wait -= dt; else { t.s += t.v * t.dir * dt; if (t.s > t.ln.len - 50 || t.s < 50) { t.dir *= -1; t.wait = 5; t.s = clamp(t.s, 50, t.ln.len - 50); } }
        for (let c = 0; c < 4; c++) { const a = along(t.ln, t.s - t.dir * c * 20.5, _v2); _p.set(_v2.x - Math.sin(a) * t.off, t.ln.z + 0.48, _v2.y + Math.cos(a) * t.off); _e.set(0, -a, 0); _q.setFromEuler(_e); _m.compose(_p, _q, _one);
          mv.parts.forEach((im, k) => im.setMatrixAt(j * 4 + c, _t.multiplyMatrices(_m, mv.base[k].m))); } });
      mv.parts.forEach((im) => (im.instanceMatrix.needsUpdate = true));
    }
  }

  /* ------------------------------------------------------- labels ---- */
  const LAB = $("#labels"); let LBL = [], distEl = null;
  const centroid = (r) => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
  function placeLabels(rebuild) {
    if (rebuild) {
      LAB.innerHTML = ""; LBL = [];
      const b = D.building; const c = centroid(b.foot);
      const add = (cls, html, v, extra = {}) => { const el = document.createElement("div"); el.className = "lb " + cls; el.innerHTML = html; LAB.appendChild(el); LBL.push({ el, v, ...extra }); return el; };
      add("bld", `<b>${esc(D.name)}</b><i></i>`, P3(c[0], c[1], b.h + 6), { bld: true });
      for (const s of D.stations) { const [col] = LINE[s.line] || ["#888"]; add("st", `<em style="background:${col}">${s.line}</em>${esc(s.name)}`, P3(s.x, s.y, s.line === "L3" ? 8 : 26)); }
      distEl = add("dist", "", new THREE.Vector3(), { dist: true });
    }
    const w = innerWidth, h = innerHeight;
    for (const L of LBL) {
      if (L.dist && (!ROUTE || MODE !== "dollhouse")) { L.el.style.display = "none"; continue; }
      _p.copy(L.v).project(camera); const vis = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
      L.el.style.display = vis ? "" : "none"; if (!vis) continue;
      L.el.style.transform = `translate(${((_p.x + 1) / 2 * w).toFixed(1)}px,${((1 - _p.y) / 2 * h).toFixed(1)}px) ${L.dist ? "translate(-50%,-50%)" : "translate(-50%,-100%)"}`;
    }
  }

  /* ---------------------------------------------- the route ribbon ---- */
  let ROUTE = null, routeMesh = null;
  const ribbonMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
    vertexShader: "attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: "uniform float uTime; varying float vS; void main(){ float d = fract(vS / 14.0 - uTime * 0.6); float a = 0.6 + 0.4 * smoothstep(0.0, 0.3, d) * (1.0 - smoothstep(0.5, 0.7, d)); gl_FragColor = vec4(vec3(0.78, 0.95, 0.29) * (0.9 + a * 0.6), 0.88); }" });
  function setRoute(r) {
    ROUTE = r; if (routeMesh) { scene.remove(routeMesh); routeMesh.geometry.dispose(); routeMesh = null; }
    if (!r) return;
    const P = r.path.map(([x, y]) => new THREE.Vector2(x, -y)); const pos = [], sa = [], idx = []; let s = 0;
    for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; const d = b.clone().sub(a).normalize(); const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(r.kind === "rail" ? 3 : 1.6);
      if (i) s += P[i].distanceTo(P[i - 1]); pos.push(P[i].x + n.x, 0.45, P[i].y + n.y, P[i].x - n.x, 0.45, P[i].y - n.y); sa.push(s, s); if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("aS", new THREE.Float32BufferAttribute(sa, 1)); g.setIndex(idx);
    routeMesh = new THREE.Mesh(g, ribbonMat); routeMesh.renderOrder = 5; scene.add(routeMesh);
    r._P = P; r._L = [0]; for (let i = 1; i < P.length; i++) r._L.push(r._L[i - 1] + P[i].distanceTo(P[i - 1])); r._len = r._L[r._L.length - 1];
    const mid = P[Math.floor(P.length / 2)]; const L = LBL.find((x) => x.dist); if (L) { L.v.set(mid.x, 12, mid.y); L.el.textContent = r.kind === "metro" ? `${fm(r.m)} · ${r.min} MIN WALK` : `${fm(r.m)} BY ROAD`; }
  }
  const routeOf = (r) => { const dr = r && D.routes.find((x) => x.kind === r.kind && x.name === r.name); return dr ? { ...r, path: dr.path } : null; };

  /* ---------------------------------------------------- the HUD ---- */
  let SEL = null;
  const factOf = (o, k) => ((o.facts || []).find((f) => f.k === k) || {}).v || "";
  function renderHUD(o) {
    const pr = (o.reason || "").startsWith("PRIORITY") ? o.reason.split(" · ")[0] : "";
    $("#h-eyebrow").textContent = `${String(o.n).padStart(2, "0")} · ${factOf(o, "Micro-market")}`;
    $("#h-prio").hidden = !pr; $("#h-prio").textContent = pr;
    $("#name").textContent = o.name;
    $("#line1").textContent = [factOf(o, "Floor / Unit") && `Floor ${factOf(o, "Floor / Unit")}`, factOf(o, "Carpet area") && `${factOf(o, "Carpet area")} carpet`, factOf(o, "Furnishing")].filter(Boolean).join(" · ");
    $("#line2").textContent = [factOf(o, "Per seat") && `${factOf(o, "Per seat")} per seat`, factOf(o, "Possession") && `Possession: ${factOf(o, "Possession")}`].filter(Boolean).join(" · ");
    const rows = (o.routes || []);
    $("#conn").innerHTML = `<div class="mono">From the entrance</div>` + rows.map((r, i) => { const [v, u] = fmtM(r.m); const col = r.kind === "rail" ? "var(--rail)" : (LINE[(r.lines || [])[0]] || ["#3d8fd6"])[0];
      return `<button class="row${ROUTE && ROUTE.name === r.name && ROUTE.kind === r.kind ? " on" : ""}" data-i="${i}"><span class="dot" style="background:${col}"></span><span><b>${esc(r.kind === "rail" ? `${r.name} station` : r.name)}</b><i>${esc((r.lines || []).join(" · "))}${r.kind === "rail" ? " · by road" : " · on foot"}</i></span><span class="v">${v}<small>${u}</small>${r.kind === "rail" ? "" : `<em>${r.min} MIN</em>`}</span></button>`; }).join("");
    const r = ROUTE && ROUTE.kind !== "rail" ? ROUTE : rows.find((x) => x.kind === "metro");
    $("#go").hidden = !r; if (r) $("#go").innerHTML = `Walk to ${esc(r.name)} <span aria-hidden="true">→</span>`;
    $("#src").textContent = (A.copy && A.copy.connect && A.copy.connect.note) || "";
    $("#spec").innerHTML = (o.facts || []).filter((f) => !f.src).map((f) => `<dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd>`).join("");
    const ph = W.renders && W.renders[o.id]; $("#photo").hidden = !ph || $("#spec").hidden; if (ph) $("#photo img").src = W.data + ph;
  }
  $("#more").addEventListener("click", () => { const h = !$("#spec").hidden; $("#spec").hidden = h; $("#photo").hidden = h || !(W.renders && W.renders[SEL]); $("#more").textContent = h ? "Property details" : "Hide details"; });
  $("#conn").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const o = OPTS.find((x) => x.id === SEL); setRoute(routeOf(o.routes[+b.dataset.i])); renderHUD(o); if (MODE === "dollhouse") frameRoute(); });
  $("#go").addEventListener("click", () => startRouteWalk());

  /* ---------------------------------------------------- cameras ---- */
  let MODE = "dollhouse", fly = null;
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function flyTo(t, p, ms = 1500) { fly = { t0: performance.now(), ms, a: { t: controls.target.clone(), p: camera.position.clone() }, b: { t, p } }; }
  function slabSize() { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of D.slab) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return Math.max(x1 - x0, y1 - y0); }
  function sunBox(half, at) { const sc = sun.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 10; sc.far = half * 6; sc.updateProjectionMatrix(); sun.target.position.copy(at); sun.position.copy(at).addScaledVector(SUN, half * 3); }
  function dollhouse(ms = 1600) {
    MODE = "dollhouse"; RW = null; document.body.classList.remove("walk", "routing"); setModeUI();
    controls.enabled = true; camera.fov = 32; camera.near = 1; camera.far = 8000; camera.updateProjectionMatrix(); scene.background = null; scene.fog = null;
    // the building at the centre of the turntable; pulled back until the whole slab fits
    const c = centroid(D.building.foot), R = slabSize(); const t = P3(c[0] * 0.35, c[1] * 0.35, D.building.h * 0.2);
    const az = D.building.facing + Math.PI / 2 + 0.55, polar = 52 * D2R, dist = R * 1.95;
    controls.minDistance = Math.max(90, D.building.h * 1.4); controls.maxDistance = R * 3;
    flyTo(t, new THREE.Vector3(t.x + Math.cos(az) * Math.sin(polar) * dist, t.y + Math.cos(polar) * dist, t.z - Math.sin(az) * Math.sin(polar) * dist), ms);
    frameOffset(true);
    controls.autoRotate = true; tilt.enabled = true; sunBox(R * 0.62, P3(0, 0));
    for (const id of ["#walkhud", "#compass", "#mini", "#hint", "#route"]) $(id).hidden = true;
  }
  /* on a wide screen the overlay takes the left, so the view's centre moves right */
  function frameOffset(on) { const w = innerWidth, h = innerHeight; if (on && w > 900) camera.setViewOffset(w, h, -w * 0.16, h * 0.04, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  function frameRoute() { if (!ROUTE) return; const box = new THREE.Box3(); ROUTE.path.forEach(([x, y]) => box.expandByPoint(P3(x, y))); const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), R = Math.max(s.x, s.z, 200);
    const az = Math.atan2(camera.position.x - c.x, camera.position.z - c.z); controls.autoRotate = false; flyTo(c, new THREE.Vector3(c.x + Math.sin(az) * R * 0.9, R * 0.95, c.z + Math.cos(az) * R * 0.9)); }

  /* walk: yaw/pitch by drag, WASD to move, click the ground to go there */
  const walk = { pos: new THREE.Vector2(), yaw: 0, pitch: 0.12, keys: new Set(), goal: null };
  const EYE = 1.68;
  function pip(x, y, P, r) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi) c = !c; } if (c) return true;
    if (r) for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i]; const dx = bx - ax, dy = by - ay; const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1); if (Math.hypot(x - ax - dx * t, y - ay - dy * t) < r) return true; } return false; }
  function blocked(x, y) { if (!pip(x, y, D.slab, 0)) return true; for (const p of solid) if (pip(x, y, p, 0.6)) return true; return false; }
  function startWalk(at) {
    MODE = "walk"; document.body.classList.add("walk"); document.body.classList.remove("routing"); setModeUI(); controls.enabled = false; controls.autoRotate = false; tilt.enabled = false; fly = null;
    camera.fov = 62; camera.near = 0.3; camera.far = 2500; frameOffset(false); scene.background = hdr; scene.backgroundIntensity = 0.9; scene.fog = new THREE.Fog(0xd9cbb4, 260, 900);
    const w0 = at || D.street_cam || D.walk0; walk.pos.set(w0[0], w0[1]);
    const c = centroid(D.building.foot); walk.yaw = Math.atan2(c[0] - w0[0], c[1] - w0[1]); walk.pitch = clamp(Math.atan2(D.building.h * 0.42, Math.hypot(c[0] - w0[0], c[1] - w0[1])), 0, 0.9);
    for (const id of ["#walkhud", "#compass", "#mini", "#hint"]) $(id).hidden = false; $("#route").hidden = true; $("#hint").style.opacity = "1";
    setTimeout(() => ($("#hint").style.opacity = "0"), 6000);
  }
  function setModeUI() { document.querySelectorAll("#modes button").forEach((b) => b.classList.toggle("on", b.dataset.mode === MODE || (MODE === "route" && b.dataset.mode === "walk"))); }
  $("#modes").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (!b) return; if (b.dataset.mode === "walk") startWalk(); else dollhouse(); });
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { if (MODE === "dollhouse") return; drag = { x: e.clientX, y: e.clientY, yaw: walk.yaw, pitch: walk.pitch, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true; walk.yaw = drag.yaw - dx * 0.0042; walk.pitch = clamp(drag.pitch + dy * 0.0036, -0.6, 1.25); });
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  canvas.addEventListener("pointerup", (e) => {
    const moved = drag && drag.moved; drag = null; if (MODE !== "walk" || moved) return;
    ptr.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ptr, camera);
    const h = ray.intersectObjects(groundMeshes, false)[0]; if (h) walk.goal = new THREE.Vector2(h.point.x, -h.point.z);
  });
  addEventListener("keydown", (e) => { if (/INPUT/.test(document.activeElement.tagName)) return; walk.keys.add(e.key.toLowerCase()); if (e.key === "Escape" && MODE !== "dollhouse") dollhouse(); });
  addEventListener("keyup", (e) => walk.keys.delete(e.key.toLowerCase()));
  function stepWalk(dt) {
    const k = walk.keys, run = k.has("shift") ? 4.2 : 1.6; let fx = 0, fz = 0;
    if (k.has("w") || k.has("arrowup")) fz += 1; if (k.has("s") || k.has("arrowdown")) fz -= 1; if (k.has("a")) fx -= 1; if (k.has("d")) fx += 1;
    if (k.has("arrowleft")) walk.yaw -= dt * 1.6; if (k.has("arrowright")) walk.yaw += dt * 1.6;
    let mx = 0, my = 0;
    if (fx || fz) { walk.goal = null; const s = Math.sin(walk.yaw), c = Math.cos(walk.yaw); mx = (s * fz + c * fx) * run * dt * 5; my = (c * fz - s * fx) * run * dt * 5; }
    else if (walk.goal) { const d = walk.goal.clone().sub(walk.pos); const L = d.length(); if (L < 0.5) walk.goal = null; else { const st = Math.min(L, 1.6 * 5 * dt); mx = d.x / L * st; my = d.y / L * st; const want = Math.atan2(d.x, d.y); walk.yaw += Math.atan2(Math.sin(want - walk.yaw), Math.cos(want - walk.yaw)) * Math.min(1, dt * 3); } }
    // the buildings are solid and the slab has an edge
    const nx = walk.pos.x + mx, ny = walk.pos.y + my;
    if (!blocked(nx, ny)) walk.pos.set(nx, ny); else if (!blocked(nx, walk.pos.y)) walk.pos.x = nx; else if (!blocked(walk.pos.x, ny)) walk.pos.y = ny; else walk.goal = null;
    placeWalkCam(true);
  }
  function placeWalkCam(hud) {
    camera.position.set(walk.pos.x, EYE + (walk.goal || walk.keys.size ? Math.sin(performance.now() / 160) * 0.025 : 0), -walk.pos.y);
    const cp = Math.cos(walk.pitch); camera.lookAt(camera.position.x + Math.sin(walk.yaw) * cp, camera.position.y + Math.sin(walk.pitch), camera.position.z - Math.cos(walk.yaw) * cp);
    sunBox(110, camera.position.clone().setY(0));
    const deg = ((walk.yaw / D2R) % 360 + 360) % 360; $("#compass").textContent = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8] + " · " + Math.round(deg) + "°";
    if (hud) {   // straight-line distances from where you stand
      const e = D.building.entrance, dE = Math.hypot(e[0] - walk.pos.x, e[1] - walk.pos.y);
      const st = (D.stations.find((s) => s.line !== "L3") || D.stations[0]); const dS = st ? Math.hypot(st.x - walk.pos.x, st.y - walk.pos.y) : 0;
      const [a1, u1] = fmtM(dE), [a2, u2] = fmtM(dS);
      $("#walkhud").innerHTML = `<div><span class="mono">To the entrance</span><b>${a1}<small>${u1}</small></b></div>${st ? `<div><span class="mono">${esc(st.name)} metro</span><b>${a2}<small>${u2}</small></b></div>` : ""}<div><span class="mono">Straight line from you</span><b style="font-size:16px;color:var(--mut)">${Math.round(D.building.h)} M TALL · ${D.building.floors} FLOORS</b></div>`;
    }
    drawMini();
  }
  const mini = $("#mini"), mctx = mini.getContext("2d");
  function drawMini() {
    const S = 380, k = S / 2 / 220; mctx.clearRect(0, 0, S, S); mctx.save(); mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2 - 2, 0, 6.283); mctx.clip();
    mctx.translate(S / 2, S / 2); mctx.rotate(-walk.yaw); mctx.scale(k, -k); mctx.translate(-walk.pos.x, -walk.pos.y);
    mctx.fillStyle = "rgba(255,255,255,.18)"; for (const p of solid) { mctx.beginPath(); p.forEach(([x, y], i) => (i ? mctx.lineTo(x, y) : mctx.moveTo(x, y))); mctx.fill(); }
    mctx.fillStyle = "#c6f24a"; mctx.beginPath(); D.building.foot.forEach(([x, y], i) => (i ? mctx.lineTo(x, y) : mctx.moveTo(x, y))); mctx.fill();
    if (ROUTE) { mctx.strokeStyle = "#c6f24a"; mctx.lineWidth = 3 / k; mctx.beginPath(); ROUTE.path.forEach(([x, y], i) => (i ? mctx.lineTo(x, y) : mctx.moveTo(x, y))); mctx.stroke(); }
    for (const s of D.stations) { mctx.fillStyle = (LINE[s.line] || ["#888"])[0]; mctx.beginPath(); mctx.arc(s.x, s.y, 7 / k, 0, 6.283); mctx.fill(); }
    mctx.restore(); mctx.fillStyle = "#fff"; mctx.beginPath(); mctx.moveTo(S / 2, S / 2 - 12); mctx.lineTo(S / 2 + 8, S / 2 + 9); mctx.lineTo(S / 2 - 8, S / 2 + 9); mctx.fill();
  }

  /* the route walk: along the street path at walking pace, time-lapsed */
  let RW = null;
  function startRouteWalk() {
    const o = OPTS.find((x) => x.id === SEL); const r0 = (ROUTE && ROUTE.kind !== "rail") ? ROUTE : o.routes.find((x) => x.kind === "metro"); const r = routeOf(r0); if (!r) return;
    setRoute(r); renderHUD(o);
    startWalk(ROUTE.path[0]); MODE = "route"; document.body.classList.add("routing"); setModeUI();
    RW = { s: 0, speed: 1.4 * 9, paused: false }; $("#route").hidden = false;
  }
  function stepRouteWalk(dt) {
    if (!RW || !ROUTE) return; if (!RW.paused) RW.s = Math.min(ROUTE._len, RW.s + RW.speed * dt);
    const ln = { P: ROUTE._P, L: ROUTE._L, len: ROUTE._len }; along(ln, RW.s, _v2); const ahead = new THREE.Vector2(); along(ln, Math.min(ln.len, RW.s + 14), ahead);
    walk.pos.set(_v2.x, -_v2.y); const want = Math.atan2(ahead.x - _v2.x, -(ahead.y - _v2.y)); walk.yaw += Math.atan2(Math.sin(want - walk.yaw), Math.cos(want - walk.yaw)) * Math.min(1, dt * 2.5); walk.pitch += (0.05 - walk.pitch) * Math.min(1, dt * 2);
    placeWalkCam(false);
    const f = RW.s / ROUTE._len, left = ROUTE.m * (1 - f), [v, u] = fmtM(left), mins = Math.max(0, Math.ceil((ROUTE.min || 0) * (1 - f)));
    $("#route").innerHTML = `<div class="top"><div><span class="mono">Walking to the metro · ${fm(ROUTE.m)} · ${ROUTE.min} min · shown 9x faster</span><h4>${esc(ROUTE.name)}</h4></div><div class="big">${f >= 1 ? "ARRIVED" : `${v} ${u}`}<small>${f >= 1 ? "" : `${mins} MIN TO GO`}</small></div></div>
      <div class="track"><i style="width:${(f * 100).toFixed(1)}%"></i><b style="left:${(f * 100).toFixed(1)}%"></b></div><div class="ends"><span class="mono">${esc(D.name)}</span><div class="ctl"><button data-rw="pause">${RW.paused ? "Resume" : "Pause"}</button><button data-rw="exit">Look around</button><button data-rw="back">Dollhouse</button></div><span class="mono">${esc(ROUTE.name)}</span></div>`;
  }
  $("#route").addEventListener("click", (e) => { const b = e.target.closest("[data-rw]"); if (!b) return; const k = b.dataset.rw;
    if (k === "pause") RW.paused = !RW.paused; else if (k === "exit") { RW = null; startWalk([walk.pos.x, walk.pos.y]); } else dollhouse(); });

  /* ------------------------------------------------------ switching ---- */
  async function select(id, first) {
    SEL = id; const o = OPTS.find((x) => x.id === id);
    document.querySelectorAll(".film").forEach((f) => f.classList.toggle("on", f.dataset.id === id));
    RW = null; ROUTE = null; renderHUD(o);
    await loadDiorama(id);
    setRoute(routeOf(o.routes.find((x) => x.kind === "metro"))); renderHUD(o);
    if (MODE === "walk" || MODE === "route") startWalk(); else dollhouse(first ? 0 : 1600);
    if (first && fly) { controls.target.copy(fly.b.t); const p0 = fly.b.p.clone(); fly = null; camera.position.copy(controls.target.clone().add(p0.clone().sub(controls.target).multiplyScalar(1.6))); flyTo(controls.target.clone(), p0, 2600); }
    try { history.replaceState(null, "", `#${id}`); } catch (e) {}
  }
  $("#t-eyebrow").textContent = "Autopilot · Flipkart";
  $("#t-title").textContent = "Andheri East";
  $("#to-map").href = A.path || "/" + SLUG;
  $("#credit").textContent = "Built in Blender from Overture Maps footprints. Heights around each building are estimated; the buildings use the deck's floors. Distances: Google Maps.";
  $("#strip").innerHTML = OPTS.map((o) => { const r = (o.routes || []).find((x) => x.kind === "metro"); const th = W.thumbs && W.thumbs[o.id];
    return `<button class="film" data-id="${esc(o.id)}" style="${th ? `background-image:url('${W.data}${th}')` : ""}"><span><span class="n">${String(o.n).padStart(2, "0")}</span><b>${esc(o.name)}</b>${r ? `<i>${fm(r.m)} · ${esc(r.name)}</i>` : ""}</span></button>`; }).join("");
  $("#strip").addEventListener("click", (e) => { const f = e.target.closest(".film"); if (f && f.dataset.id !== SEL) select(f.dataset.id); });
  addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; frameOffset(MODE === "dollhouse"); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); gtao.setSize(innerWidth, innerHeight); tilt.uniforms.uRes.value.set(innerWidth, innerHeight); if (tiles) tiles.setResolutionFromRenderer(camera, renderer); });

  const deep = location.hash.slice(1); const first = OPTS.some((o) => o.id === deep) ? deep : OPTS[0].id;
  await select(first, true);
  for (const id of ["#top", "#hud", "#strip"]) $(id).hidden = false;
  $("#l-bar").style.width = "100%"; setTimeout(() => { $("#load").style.transition = "opacity .9s"; $("#load").style.opacity = "0"; setTimeout(() => $("#load").remove(), 950); }, 200);
  if (Q.get("mode") === "walk") startWalk();

  /* -------------------------------------------------------- loop ---- */
  let last = performance.now(); const clock = { frames: 0 };
  function frame(now) {
    const dt = Math.min(STILL ? 0.5 : 0.05, (now - last) / 1000); last = now; ribbonMat.uniforms.uTime.value += dt;
    if (fly) { const t = Math.min(1, (now - fly.t0) / fly.ms), e = ease(t); controls.target.lerpVectors(fly.a.t, fly.b.t, e); camera.position.lerpVectors(fly.a.p, fly.b.p, e); if (t >= 1) fly = null; }
    if (MODE === "dollhouse") controls.update();
    else if (MODE === "walk") stepWalk(dt); else if (MODE === "route") stepRouteWalk(dt);
    stepMovers(dt);
    if (tiles) { camera.updateMatrixWorld(); tiles.update(); }
    composer.render(); placeLabels(false); clock.frames++;
    if (!STILL) requestAnimationFrame(frame);
  }
  if (STILL) frame(performance.now()); else requestAnimationFrame(frame);
  window.__world = { tick: (n = 1, dt = 0.25) => { for (let i = 0; i < n; i++) { last = performance.now() - dt * 1000; if (fly) fly.t0 -= 1e9; frame(performance.now()); } }, select, startWalk, startRouteWalk, dollhouse, clock, renderer, walk, setRW: (s) => { if (RW) RW.s = s; } };
}

boot();
