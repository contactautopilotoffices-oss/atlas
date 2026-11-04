/* ============================================================================
   ATLAS · Skymark F-1, Sector 6, Noida  (/skymark)

   A showcase for builders: the real building in its real street, and one
   floor opened as a dollhouse with the tenant's fit-out in 3D.

     Area      1 km around the site, the plot outlined
     Building  the building and its street; the floor stack on the right
               highlights a floor in the model as you point at it
     Volt      the first floor opened: the floors above lift away, the
               facade goes clear, and Volt's layout from the design deck
               stands in 3D; every room is a label that flies you there
               and shows the deck's render of it
     Plan      the same floor from straight above, like the drawing
     Street    Google Street View in front of the building

   The context: Google's photorealistic 3D tiles where window.GOOGLE_MAPS_KEY
   (config.js, from the GOOGLE_MAPS_BROWSER_KEY environment variable) works,
   else our own model of every footprint within 1 km. The building is always
   ours, so a floor can be opened; over Google's mesh it stays hidden until
   a floor is opened, when Google's Skymark is pressed flat under it.

   Skills: .claude/skills/archviz-* (quality bar, location mapping, facade
   detail, facade to interior, floor zoom, lighting day and dusk).
   Data: engine/atlases/skymark-f1.js (scripts/skymark/build.js).
   Coordinates: metres, x east, y north around the site; three is Y-up with
   -Z north.
   ============================================================================ */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const Q = new URLSearchParams(location.search);
const STILL = Q.get("still") === "1";
const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V3 = (e, n, h = 0) => new THREE.Vector3(e, h, -n);
const MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

/* --------------------------------------------------------------- boot ---- */
function script(src) { return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
async function sha256(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
const normId = (v) => String(v).trim().toUpperCase().replace(/[\s-]/g, "");
async function boot() {
  await script("/engine/atlases/skymark-f1.js");
  const A = window.SKYMARK;
  const KEY = A.slug + "-auth"; let ok = false;
  try {   // signed in here before, or just now on the site's front page (it hands off to this path)
    if (sessionStorage.getItem("atlas-handoff") === A.path) { sessionStorage.setItem(KEY, "1"); sessionStorage.removeItem("atlas-handoff"); }
    ok = sessionStorage.getItem(KEY) === "1";
  } catch (e) {}
  if (!ok) {
    $("#load").hidden = true; $("#gate").hidden = false; $("#g-id").focus();
    await new Promise((done) => $("#g-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if ((await sha256(normId($("#g-id").value) + ":" + normId($("#g-pw").value))) !== A.gate.hash) { $("#g-err").textContent = "That ID and password do not match."; return; }
      try { sessionStorage.setItem(KEY, "1"); } catch (x) {}
      $("#gate").hidden = true; $("#load").hidden = false; done();
    }));
  }
  start(A).catch((e) => { console.error(e); $("#l-msg").textContent = "Could not load: " + e.message; });
}

/* -------------------------------------------------------------- world ---- */
async function start(A) {
  const B = A.building, ST = B.storeys, site = A.site, volt = A.volt;
  const canvas = $("#c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2)); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 20000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = 84 * D2R; controls.minDistance = 12; controls.maxDistance = 3200;

  /* --- sky, sun and fill (archviz-lighting-day-night: one time value) --- */
  const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, low: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }",
    fragmentShader: "uniform vec3 top,hor,low,sunDir,sunCol; varying vec3 vD; void main(){ float y = vD.y; vec3 c = y < 0. ? mix(hor, low, smoothstep(0., -.2, y)) : mix(hor, top, smoothstep(0., .5, y)); float s = max(dot(vD, normalize(sunDir)), 0.); c += sunCol * (pow(s, 600.) * 12. + pow(s, 8.) * .25); gl_FragColor = vec4(c, 1.); }" }));
  sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.4;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xcfe0f2, 0x6d6656, 0.9); scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xd7dde2, 0.00028);
  const LIGHT = {
    day:  { top: 0x4f86c6, hor: 0xd9e3ea, low: 0x8f8a80, sun: 0xfff1dc, sunI: 3.0, el: 52, az: 150, hemi: 0.9, fog: 0xd7dde2, exp: 1.0, night: 0 },
    dusk: { top: 0x16203d, hor: 0xd9814f, low: 0x221d1d, sun: 0xff8a45, sunI: 0.9, el: 4, az: 255, hemi: 0.22, fog: 0x3a3442, exp: 1.1, night: 1 },
  };
  const U = { uNight: { value: 0 } };
  function applyLight(k) {
    const L = LIGHT[k]; skyU.top.value.setHex(L.top); skyU.hor.value.setHex(L.hor); skyU.low.value.setHex(L.low); skyU.sunCol.value.setHex(L.sun);
    const d = new THREE.Vector3(Math.sin(L.az * D2R) * Math.cos(L.el * D2R), Math.sin(L.el * D2R), -Math.cos(L.az * D2R) * Math.cos(L.el * D2R)); skyU.sunDir.value.copy(d); SUN.copy(d);
    sun.color.setHex(L.sun); sun.intensity = L.sunI; hemi.intensity = L.hemi; scene.environmentIntensity = L.night ? 0.18 : 0.6; scene.fog.color.setHex(L.fog); renderer.toneMappingExposure = L.exp; U.uNight.value = L.night;
    for (const l of INT_LIGHTS) l.intensity = l.userData.k * (0.35 + L.night * 0.65);
    document.querySelectorAll("#light button").forEach((b) => b.classList.toggle("on", b.dataset.light === k));
  }
  const SUN = new THREE.Vector3(0, 1, 0), INT_LIGHTS = [];

  /* --- the building's frame: its real footprint's long axis ------------- */
  const FP = site.footprint;                       // Overture footprint, metres
  let th = site.rect.angle; let u = new THREE.Vector2(Math.cos(th), Math.sin(th)); if (u.y > 0) u.negate();   // u: along the building, to its south-east end
  const v = new THREE.Vector2(-u.y, u.x);          // across it, to the north-east side
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [e, n] of FP) { const a = e * u.x + n * u.y, b = e * v.x + n * v.y; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const VOLT_W = volt.size_px[0] * volt.scale, VOLT_D = volt.size_px[1] * volt.scale;          // 35.6 x 19.6 m
  const L_ = a1 - a0, W_ = Math.max(b1 - b0, VOLT_W + 0.6);                                     // the deck's width wins over the footprint's
  const C = new THREE.Vector2(u.x * (a0 + a1) / 2 + v.x * (b0 + b1) / 2, u.y * (a0 + a1) / 2 + v.y * (b0 + b1) / 2);
  const BE = (a, b) => [C.x + u.x * a + v.x * b, C.y + u.y * a + v.y * b];   // building (a along, b across) -> east, north
  const floorZ = (n) => n === 0 ? 0 : ST.ground + (n - 1) * ST.typical;
  const floorH = (n) => n === 0 ? ST.ground : ST.typical;
  const TOP = floorZ(ST.count);
  /* a group whose local x/z are building a/b: lets us build in the building's own axes */
  const bldg = new THREE.Group(); scene.add(bldg);
  { const X = new THREE.Vector3(u.x, 0, -u.y), Z = new THREE.Vector3(-v.x, 0, v.y), Y = new THREE.Vector3(0, 1, 0); // x along, z across (to the south-west)
    bldg.matrix.makeBasis(X, Y, Z).setPosition(C.x, 0, -C.y); bldg.matrixAutoUpdate = false; }
  const A2L = (a, b, h = 0) => new THREE.Vector3(a, h, -b);   // building a,b,height -> bldg local

  /* --- materials (archviz-facade-detail: real glass, metal, stone) ------- */
  const M = {
    glass: new THREE.MeshPhysicalMaterial({ color: 0x8fa8b4, metalness: 0.0, roughness: 0.04, transmission: 0.0, transparent: true, opacity: 0.55, envMapIntensity: 1.4, depthWrite: false }),
    glassClear: new THREE.MeshPhysicalMaterial({ color: 0xbfd3da, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.12, depthWrite: false }),
    mullion: new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.85, roughness: 0.3 }),
    acp: new THREE.MeshStandardMaterial({ color: 0xd9d8d3, metalness: 0.35, roughness: 0.38 }),
    acpDark: new THREE.MeshStandardMaterial({ color: 0x3d4247, metalness: 0.4, roughness: 0.42 }),
    slab: new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.85 }),
    plinth: new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.9 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.98 }),
    carpetDark: new THREE.MeshStandardMaterial({ color: 0x35373b, roughness: 0.98 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xc8935a, roughness: 0.5 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0xd9b58a, roughness: 0.5 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9b9b98, roughness: 0.9 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xf0eee9, roughness: 0.9 }),
    wallFire: new THREE.MeshStandardMaterial({ color: 0xd8d2cc, roughness: 0.9 }),
    partGlass: new THREE.MeshPhysicalMaterial({ color: 0xd6e6ea, roughness: 0.08, transparent: true, opacity: 0.22, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1e2022, metalness: 0.6, roughness: 0.4 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.55 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xf0962e, roughness: 0.6 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x1f7a85, roughness: 0.8 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x2f5d9a, roughness: 0.95 }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x2c2e31, roughness: 0.8 }),
    beige: new THREE.MeshStandardMaterial({ color: 0xd8ccb8, roughness: 0.85 }),
    rust: new THREE.MeshStandardMaterial({ color: 0xc0653a, roughness: 0.7 }),
    chair: new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.6, metalness: 0.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc8cacc, metalness: 0.95, roughness: 0.2 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.7 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.25, metalness: 0.3, emissive: 0x2a3a52, emissiveIntensity: 0.5 }),
    rack: new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.5, roughness: 0.5, emissive: 0x0f3a1c, emissiveIntensity: 0.3 }),
    voidRail: new THREE.MeshPhysicalMaterial({ color: 0xdfeef0, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false }),
    lit: new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xfff1d8, emissiveIntensity: 1.2 }),
    hl: new THREE.MeshBasicMaterial({ color: 0xf39a2b, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }),
  };
  M.glass.onBeforeCompile = (sh) => { sh.uniforms.uNight = U.uNight; sh.fragmentShader = "uniform float uNight;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.86, 0.66) * uNight * 0.55;"); };
  const box = (w, h, d, mat, x, y, z, parent, round = 0) => { const g = round ? new RoundedBoxGeometry(w, h, d, 2, round) : new THREE.BoxGeometry(w, h, d); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  /* --- the building (archviz-facade-detail: modelled, not painted) ------- */
  const FLOORS = [];
  for (let n = 0; n < ST.count; n++) {
    const z0 = floorZ(n), h = floorH(n), g = new THREE.Group(); g.userData.n = n; bldg.add(g);
    const shell = new THREE.Group(); g.add(shell);
    box(L_, 0.45, W_, M.slab, 0, z0 + 0.225, 0, g);                                                   // slab
    box(L_ + 0.5, 0.55, W_ + 0.5, n === 0 ? M.plinth : M.acp, 0, z0 + h - 0.275, 0, shell, 0.08);      // slab edge, ACP band
    const gh = h - 0.95;                                                                               // glass from slab to band
    for (const [lx, lz, ry] of [[L_, 0, 0], [W_, 1, Math.PI / 2]]) {
      for (const sgn of [-1, 1]) {
        const off = (lz ? L_ : W_) / 2 - 0.25, len = lx;
        const p = lz ? new THREE.Vector3(sgn * off, z0 + 0.45 + gh / 2, 0) : new THREE.Vector3(0, z0 + 0.45 + gh / 2, sgn * off);
        const gl = box(lz ? 0.06 : len - 0.6, gh, lz ? len - 0.6 : 0.06, M.glass, p.x, p.y, p.z, shell); gl.castShadow = false; gl.userData.glass = true;
        // mullions every 1.5 m, deeper fins every 4.5 m
        for (let s = -len / 2 + 0.75; s < len / 2 - 0.5; s += 1.5) {
          const fin = Math.round((s + len / 2) / 1.5) % 3 === 0, d = fin ? 0.45 : 0.12;
          const mx = lz ? sgn * (off + d / 2) : s, mz = lz ? s : sgn * (off + d / 2);
          box(lz ? d : 0.07, gh + 0.1, lz ? 0.07 : d, fin ? M.acpDark : M.mullion, mx, z0 + 0.45 + gh / 2, mz, shell);
        }
        // transom at 1 m (spandrel line) on upper floors
        if (n) box(lz ? 0.1 : len - 0.6, 0.08, lz ? len - 0.6 : 0.1, M.mullion, p.x + (lz ? sgn * 0.03 : 0), z0 + 1.45, p.z + (lz ? 0 : sgn * 0.03), shell);
      }
    }
    if (n) box(L_ - 1, 0.02, W_ - 1, M.concrete, 0, z0 + 0.46, 0, g);                                 // bare slab; a tenant's fit-out sits on it
    // a highlight volume for the floor stack
    const hl = new THREE.Mesh(new THREE.BoxGeometry(L_ + 1.4, h - 0.2, W_ + 1.4), M.hl.clone()); hl.position.set(0, z0 + h / 2, 0); hl.renderOrder = 8; g.add(hl);
    FLOORS.push({ n, g, shell, hl, z0, h });
  }
  // roof: parapet, plant, lift overrun, solar
  const roof = new THREE.Group(); bldg.add(roof);
  box(L_, 0.4, W_, M.slab, 0, TOP + 0.2, 0, roof);
  for (const [x, z, w, d] of [[0, W_ / 2 - 0.15, L_, 0.3], [0, -W_ / 2 + 0.15, L_, 0.3], [L_ / 2 - 0.15, 0, 0.3, W_], [-L_ / 2 + 0.15, 0, 0.3, W_]]) box(w, ST.parapet, d, M.acp, x, TOP + 0.4 + ST.parapet / 2, z, roof, 0.05);
  box(8, 3.2, 6, M.acp, -L_ * 0.18, TOP + 2, 2, roof, 0.1); box(12, 1.8, 4, M.acpDark, L_ * 0.12, TOP + 1.3, -W_ * 0.22, roof);
  for (let i = 0; i < 6; i++) box(3.6, 1.6, 2.2, M.concrete, -L_ * 0.38 + i * 4.2, TOP + 1.2, W_ * 0.3, roof);
  // entrance canopy on the south-east end, where Street View stands
  box(10, 0.35, 4.5, M.acpDark, L_ / 2 + 2.25, ST.ground - 0.6, 0, bldg); for (const s of [-4.2, 4.2]) box(0.25, ST.ground - 0.8, 0.25, M.chrome, L_ / 2 + 4.2, (ST.ground - 0.8) / 2, s, bldg);
  bldg.updateMatrixWorld(true);

  const gl = new GLTFLoader(); gl.setMeshoptDecoder(MeshoptDecoder);
  const draco = new DRACOLoader(); draco.setDecoderPath("/engine/vendor/three/jsm/libs/draco/gltf/");

  /* --- Volt's first floor, from the deck's plan ------------------------- */
  const vf = new THREE.Group(); vf.visible = false; FLOORS[1].g.add(vf);
  const S_ = volt.scale, [OX, OY] = volt.origin, z1 = floorZ(1) + 0.47;
  // plan px -> bldg local: plan x across the end facade (to the south-west), plan y into the building
  const PX = (x, y) => A2L(L_ / 2 - 0.3 - (y - OY) * S_, W_ / 2 - 0.3 - (x - OX) * S_);
  const pw = (dx) => dx * S_;
  const IM = {};   // instanced furniture: key -> list of matrices
  const put = (k, x, y, rot = 0, sx = 1, sy = 1, sz = 1, h = 0) => { const p = PX(x, y); (IM[k] = IM[k] || []).push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, z1 + h, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot + Math.PI / 2), new THREE.Vector3(sx, sy, sz))); };
  // plan axes in bldg local: plan +x -> local -z... we rotate furniture by +90 so its own x runs along plan x
  const ROOMS = [];
  for (const r of volt.rooms) {
    const [x0, y0, x1, y1] = r.rect, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = pw(x1 - x0), d = pw(y1 - y0), c = PX(cx, cy); c.y = z1;   // on the first floor
    ROOMS.push({ ...r, c, w, d });
    if (r.floor === "void") {     // the atrium: a hole with a glass balustrade
      const rails = [[cx, y0, w, 0.05], [cx, y1, w, 0.05], [x0, cy, 0.05, d], [x1, cy, 0.05, d]];
      for (const [xx, yy, ww, dd] of rails) { const p = PX(xx, yy); box(dd || 0.05, 1.1, ww || 0.05, M.voidRail, p.x, z1 + 0.55, p.z, vf).castShadow = false; }
      continue;
    }
    const fl = box(d, 0.02, w, r.floor === "wood" ? M.woodLight : r.floor === "concrete" ? M.concrete : (ROOMS.length % 2 ? M.carpet : M.carpetDark), c.x, z1 + 0.01, c.z, vf); fl.castShadow = false;
    if (r.walls !== "open" && r.walls !== "booths") {
      const mat = r.walls === "glass" ? M.partGlass : r.walls === "fire" ? M.wallFire : M.wall, t = r.walls === "glass" ? 0.04 : 0.12, wh = 2.7;
      for (const [xx, yy, ww, dd, gap] of [[cx, y0, w, 0, 0], [cx, y1, w, 0, 1], [x0, cy, 0, d, 0], [x1, cy, 0, d, 0]]) {
        const p = PX(xx, yy), along = ww ? ww : dd, isX = !!ww;   // isX: the wall runs along plan x
        const segs = gap && along > 2.4 ? [[-along / 2, along / 2 - 1.3], [along / 2 - 0.3, along / 2]] : [[-along / 2, along / 2]];
        for (const [s0, s1] of segs) {
          const len = s1 - s0, mid = (s0 + s1) / 2; const off = isX ? new THREE.Vector3(0, 0, -mid) : new THREE.Vector3(-mid, 0, 0);
          const m = box(isX ? t : len, wh, isX ? len : t, mat, p.x + off.x, z1 + wh / 2, p.z + off.z, vf); if (r.walls === "glass") { m.castShadow = false; box(isX ? 0.06 : len, 0.06, isX ? len : 0.06, M.frame, p.x + off.x, z1 + wh, p.z + off.z, vf); }
        }
      }
    }
    for (const it of r.items || []) {
      const k = it[0];
      if (k === "benches" || k === "desks") {   // rows of desks with screens, chairs either side
        const [, ax0, ay0, ax1, ay1, cols, rows] = it;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const x = ax0 + (ax1 - ax0) * (cols === 1 ? 0.5 : i / (cols - 1)), y = ay0 + (ay1 - ay0) * (rows === 1 ? 0.5 : j / (rows - 1));
          put("desk", x, y); put(((i + j) % 2) ? "screenO" : "screenW", x, y); put("chair", x + (i % 2 ? 1 : -1) * 22, y, i % 2 ? Math.PI : 0);
          if (cols % 2 === 0 && i % 2 === 0) { const x2 = ax0 + (ax1 - ax0) * ((i + 1) / (cols - 1)); put("deskpair", (x + x2) / 2, y); }
        }
      } else if (k === "chairs" || k === "stools") { const [, ax, ay, bx, by, nn] = it; for (let i = 0; i < nn; i++) { const t = nn === 1 ? 0.5 : i / (nn - 1); put(k === "stools" ? "stool" : "chairM", ax + (bx - ax) * t, ay + (by - ay) * t, ay > (r.rect[1] + r.rect[3]) / 2 ? Math.PI / 2 : -Math.PI / 2); } }
      else if (k === "chair") put("chairM", it[1], it[2]);
      else if (k === "table") { const [, ax, ay, bx, by] = it; put("table", (ax + bx) / 2, (ay + by) / 2, 0, pw(bx - ax), 1, pw(by - ay)); }
      else if (k === "exec") { const [, ax, ay, bx, by] = it; put("table", (ax + bx) / 2, (ay + by) / 2, 0, pw(bx - ax), 1, pw(by - ay)); put("chair", bx - 12, (ay + by) / 2, Math.PI / 2); }
      else if (k === "round4") { put("round", it[1], it[2]); for (let q = 0; q < 4; q++) put(q % 2 ? "cafeO" : "cafeG", it[1] + Math.cos(q * Math.PI / 2) * 40, it[2] + Math.sin(q * Math.PI / 2) * 40, -q * Math.PI / 2); }
      else if (k === "sofa") { const [, ax, ay, bx, by, o] = it; const along = o === "v" ? pw(by - ay) : pw(bx - ax); put("sofa", (ax + bx) / 2, (ay + by) / 2, o === "v" ? Math.PI / 2 : 0, along / 2.2, 1, 1); }
      else if (k === "lounge") put("lounge", it[1], it[2], Math.random() * 6.28);
      else if (k === "sidetable") put("side", it[1], it[2]);
      else if (k === "planter") put("planter", it[1], it[2]);
      else if (k === "counter") { const [, ax, ay, bx, by] = it; put("counter", (ax + bx) / 2, (ay + by) / 2, 0, pw(bx - ax), 1, pw(by - ay)); }
      else if (k === "fridge") { const [, ax, ay, bx, by] = it; put("fridge", (ax + bx) / 2, (ay + by) / 2); }
      else if (k === "highdesk") { const [, ax, ay, bx, by] = it; put("high", (ax + bx) / 2, (ay + by) / 2, 0, 1, 1, pw(by - ay) / 3.6); }
      else if (k === "screen") put("tv", it[1], it[2], it[3] === "e" ? Math.PI / 2 : -Math.PI / 2);
      else if (k === "racks") { const [, ax, ay, bx, by, nn] = it; for (let i = 0; i < nn; i++) put("rack", ax + (bx - ax) * (i + 0.5) / nn, (ay + by) / 2); }
      else if (k === "booths") { const [, ax, ay, bx, by, nn] = it; for (let i = 0; i < nn; i++) put("booth", ax + (bx - ax) * (i + 0.5) / nn, (ay + by) / 2, 0, pw(bx - ax) / nn / 1.3, 1, pw(by - ay) / 1.4); }
    }
    if (r.walls !== "void" && r.id !== "ups" && r.id !== "server") {   // ceiling light in each room, lit at dusk
      const l = new THREE.PointLight(0xffe2b8, 0, Math.max(w, d) * 1.4, 1.6); l.userData.k = 6; l.position.set(c.x, z1 + 2.5, c.z); vf.add(l); if (INT_LIGHTS.length < 18) INT_LIGHTS.push(l); else vf.remove(l);
    }
  }
  for (const [x, y] of volt.columns) { const p = PX(x, y); box(0.6, 2.9, 0.6, M.wall, p.x, z1 + 1.45, p.z, vf); }
  // furniture prototypes (modelled pieces, instanced); sizes in metres, built along x
  const proto = (parts) => parts;
  const P = {
    desk: [[1.2, 0.03, 0.6, M.woodLight, 0, 0.74, 0], [0.04, 0.72, 0.55, M.white, -0.57, 0.36, 0], [0.04, 0.72, 0.55, M.white, 0.57, 0.36, 0]],
    screenW: [[1.2, 0.36, 0.025, M.white, 0, 0.94, -0.31], [0.55, 0.36, 0.02, M.screen, 0, 1.0, -0.2], [0.55, 0.07, 0.025, M.chrome, 0, 0.8, -0.2], [0.04, 0.16, 0.04, M.chrome, 0, 0.82, -0.22], [0.2, 0.01, 0.16, M.chrome, 0, 0.765, -0.22], [0.42, 0.012, 0.13, M.white, 0, 0.765, 0.04]],
    screenO: [[1.2, 0.36, 0.025, M.orange, 0, 0.94, -0.31], [0.55, 0.36, 0.02, M.screen, 0, 1.0, -0.2], [0.55, 0.07, 0.025, M.chrome, 0, 0.8, -0.2], [0.04, 0.16, 0.04, M.chrome, 0, 0.82, -0.22], [0.2, 0.01, 0.16, M.chrome, 0, 0.765, -0.22], [0.42, 0.012, 0.13, M.white, 0, 0.765, 0.04]],
    chair: [[0.48, 0.07, 0.46, M.chair, 0, 0.46, 0], [0.46, 0.5, 0.05, M.chair, 0, 0.75, 0.22], [0.06, 0.42, 0.06, M.chrome, 0, 0.22, 0], [0.55, 0.03, 0.55, M.chrome, 0, 0.03, 0]],
    chairM: [[0.5, 0.07, 0.48, M.chair, 0, 0.47, 0], [0.48, 0.55, 0.05, M.chair, 0, 0.78, 0.23], [0.06, 0.42, 0.06, M.chrome, 0, 0.22, 0], [0.55, 0.03, 0.55, M.chrome, 0, 0.03, 0]],
    table: [[1, 0.05, 1, M.wood, 0, 0.74, 0], [0.7, 0.7, 0.7, M.charcoal, 0, 0.36, 0]],
    round: [[0.9, 0.04, 0.9, M.wood, 0, 0.74, 0], [0.08, 0.72, 0.08, M.charcoal, 0, 0.36, 0], [0.5, 0.03, 0.5, M.charcoal, 0, 0.02, 0]],
    cafeO: [[0.45, 0.05, 0.42, M.orange, 0, 0.46, 0], [0.44, 0.38, 0.05, M.orange, 0, 0.68, 0.2], [0.03, 0.45, 0.03, M.charcoal, 0.18, 0.22, 0.18], [0.03, 0.45, 0.03, M.charcoal, -0.18, 0.22, -0.18]],
    cafeG: [[0.45, 0.05, 0.42, M.beige, 0, 0.46, 0], [0.44, 0.38, 0.05, M.beige, 0, 0.68, 0.2], [0.03, 0.45, 0.03, M.charcoal, 0.18, 0.22, 0.18], [0.03, 0.45, 0.03, M.charcoal, -0.18, 0.22, -0.18]],
    stool: [[0.38, 0.05, 0.38, M.white, 0, 0.75, 0], [0.04, 0.74, 0.04, M.woodLight, 0, 0.37, 0]],
    sofa: [[2.2, 0.42, 0.85, M.beige, 0, 0.21, 0], [2.2, 0.45, 0.2, M.beige, 0, 0.63, 0.32], [0.2, 0.3, 0.85, M.beige, -1.0, 0.55, 0], [0.2, 0.3, 0.85, M.beige, 1.0, 0.55, 0], [0.4, 0.3, 0.14, M.orange, -0.5, 0.6, 0.18], [0.4, 0.3, 0.14, M.orange, 0.5, 0.6, 0.18]],
    lounge: [[0.7, 0.42, 0.7, M.rust, 0, 0.3, 0], [0.7, 0.45, 0.14, M.rust, 0, 0.65, 0.28]],
    side: [[0.5, 0.03, 0.5, M.charcoal, 0, 0.5, 0], [0.04, 0.5, 0.04, M.charcoal, 0, 0.25, 0]],
    planter: [[1.1, 0.75, 0.45, M.wood, 0, 0.375, 0], [1.1, 0.06, 0.45, M.charcoal, 0, 0.78, 0], [0.95, 0.4, 0.38, M.leaf, 0, 0.98, 0]],
    counter: [[1, 0.9, 1, M.wood, 0, 0.45, 0], [1, 0.04, 1, M.charcoal, 0, 0.92, 0]],
    fridge: [[0.75, 1.8, 0.7, M.chrome, 0, 0.9, 0]],
    high: [[0.7, 0.05, 3.6, M.white, 0, 1.05, 0], [0.5, 1.02, 0.08, M.orange, 0, 0.51, 0]],
    tv: [[0.06, 0.8, 1.4, M.screen, 0, 1.5, 0]],
    rack: [[0.8, 2.0, 1.0, M.rack, 0, 1.0, 0]],
    booth: [[1.3, 2.4, 0.08, M.blue, 0, 1.2, -0.7], [0.08, 2.4, 1.4, M.charcoal, -0.65, 1.2, 0], [0.08, 2.4, 1.4, M.charcoal, 0.65, 1.2, 0], [1.2, 0.04, 0.35, M.white, 0, 1.05, -0.5]],
  };
  const PGEO = new Map(), PIM = {}; const gkey = (w, h, d) => `${w}|${h}|${d}`;
  for (const [k, mats] of Object.entries(IM)) for (const [w, h, d, mat, x, y, z] of P[k] || []) {
    const geo = PGEO.get(gkey(w, h, d)) || new RoundedBoxGeometry(w, h, d, 2, Math.min(0.03, w / 3, h / 3, d / 3)); PGEO.set(gkey(w, h, d), geo);
    const im = new THREE.InstancedMesh(geo, mat, mats.length), off = new THREE.Matrix4().makeTranslation(x, y, z), t = new THREE.Matrix4();
    mats.forEach((m, i) => im.setMatrixAt(i, t.multiplyMatrices(m, off))); im.castShadow = im.receiveShadow = true; vf.add(im); (PIM[k] = PIM[k] || []).push(im);
  }
  /* Real models (Meshy, scripts/skymark/meshy.py) replace the blocks where we
     have them: each is scaled to its real height, set on the floor, turned to
     face the way the block did, and instanced at every place the plan has
     one. keys: which block pieces it replaces; at: where it goes. */
  const MODELS = [
    { file: "chair.glb", at: ["chair", "chairM"], replaces: ["chair", "chairM"], height: 1.02, rot: Math.PI },
    { file: "lounge.glb", at: ["lounge"], replaces: ["lounge"], height: 0.82, rot: Math.PI },
  ];
  async function upgrade(md) {
    let g; try { g = await gl.loadAsync(A.media + "models/" + md.file); } catch (e) { if (!md.optional) console.warn(md.file, e); return; }
    const root = g.scene; root.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(root), sz = bb.getSize(new THREE.Vector3()), cc = bb.getCenter(new THREE.Vector3());
    const k = md.height ? md.height / sz.y : md.width / Math.max(sz.x, sz.z);
    const N = new THREE.Matrix4().makeRotationY(md.rot).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-cc.x, -bb.min.y, -cc.z));
    const where = md.at.flatMap((key) => IM[key] || []); if (!where.length) return;
    const t = new THREE.Matrix4();
    root.traverse((o) => { if (!o.isMesh) return; const base = new THREE.Matrix4().multiplyMatrices(N, o.matrixWorld); const im = new THREE.InstancedMesh(o.geometry, o.material, where.length);
      if (o.material) { o.material.envMapIntensity = 0.9; }
      where.forEach((m, i) => im.setMatrixAt(i, t.multiplyMatrices(m, base))); im.castShadow = im.receiveShadow = true; vf.add(im); });
    for (const key of md.replaces) for (const im of PIM[key] || []) { vf.remove(im); im.dispose(); }
  }
  MODELS.forEach((md) => upgrade(md));
  bldg.updateMatrixWorld(true);

  /* --- the context: Google's real mesh, else our 1 km model ------------- */
  const gkey_ = window.GOOGLE_MAPS_KEY || "";
  let tiles = null, flatten = null, flatShape = null, groundY = 0;
  const ctx = new THREE.Group(); scene.add(ctx);

  async function loadOwnContext() {
    const g = await gl.loadAsync(A.media + "context.glb");
    g.scene.traverse((o) => { if (!o.isMesh) return; const nm = o.name || ""; o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: nm.startsWith("water") ? 0.1 : 0.9, flatShading: true, side: nm.startsWith("buildings") ? THREE.FrontSide : THREE.DoubleSide });
      o.receiveShadow = true; o.castShadow = nm.startsWith("buildings");
      if (nm.startsWith("buildings")) o.material.onBeforeCompile = (sh) => { // windows from world position, lit at dusk
        sh.uniforms.uNight = U.uNight; sh.vertexShader = "varying vec3 vW;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        sh.fragmentShader = "uniform float uNight; varying vec3 vW;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
          vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); float wall = 1.0 - step(0.5, abs(n.y)); float hor = abs(n.x) > abs(n.z) ? vW.z : vW.x;
          vec2 f = fract(vec2(hor / 2.8, vW.y / 3.4)); float win = wall * step(2.6, vW.y) * step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.2, 0.24), win * 0.8);`).replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          float r = fract(sin(dot(floor(vec3(hor / 2.8, vW.y / 3.4, vW.x * 0.01)), vec3(12.9898, 78.233, 37.719))) * 43758.5453); totalEmissiveRadiance += vec3(1.0, 0.75, 0.45) * win * step(0.55, r) * uNight * 1.3;`); };
    });
    ctx.add(g.scene); $("#src3d").textContent = "Context: " + site.source + ". Google 3D appears when the Maps key is set.";
  }
  async function loadGoogle() {
    const { TilesRenderer } = await import("3d-tiles-renderer");
    const { GoogleCloudAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin, TilesFadePlugin, UpdateOnChangePlugin, TileFlatteningPlugin } = await import("3d-tiles-renderer/plugins");
    const { TileCompressionPlugin } = await import("3d-tiles-renderer/three/plugins");
    tiles = new TilesRenderer();
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: gkey_, autoRefreshToken: true }));
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.registerPlugin(new TileCompressionPlugin()); tiles.registerPlugin(new TilesFadePlugin()); tiles.registerPlugin(new UpdateOnChangePlugin());
    tiles.registerPlugin(new ReorientationPlugin({ lat: (site.origin[1]) * D2R, lon: (site.origin[0]) * D2R, height: 150, up: "+y", recenter: true }));
    flatten = new TileFlatteningPlugin(); tiles.registerPlugin(flatten);
    tiles.errorTarget = MOBILE ? 20 : 8;
    tiles.setCamera(camera); tiles.setResolutionFromRenderer(camera, renderer);
    let failed = false; tiles.addEventListener("load-error", () => { failed = true; });
    ctx.add(tiles.group);
    // wait until something real has loaded, else give up and use ours
    const ok = await new Promise((res) => { let t0 = performance.now(); const tick = () => { tiles.update(); let n = 0; tiles.group.traverse((o) => { if (o.isMesh) n++; });
      if (n > 20) return res(true); if (failed || performance.now() - t0 > 12000) return res(false); requestAnimationFrame(tick); }; tick(); });
    if (!ok) { ctx.remove(tiles.group); tiles.dispose(); tiles = null; return false; }
    // put our model on Google's ground: cast down at the site
    const ray = new THREE.Raycaster(new THREE.Vector3(C.x, 400, -C.y), new THREE.Vector3(0, -1, 0)); await new Promise((r) => setTimeout(r, 1500)); tiles.update();
    const hit = ray.intersectObject(tiles.group, true).filter((h) => h.distance > 300)[0] || ray.intersectObject(tiles.group, true).slice(-1)[0];
    groundY = hit ? hit.point.y - (hit.distance < 340 ? 22 : 0) : 0;
    // Skymark's own Google mesh is what people see; ours stays hidden until a floor opens
    bldg.position.y = 0; bldg.matrix.elements[13] = groundY; bldg.updateMatrixWorld(true);
    FLOORS.forEach((f) => (f.shell.visible = false)); roof.visible = false;
    $("#src3d").innerHTML = "3D: Google (photorealistic 3D tiles). Footprint: Overture Maps.";
    return true;
  }
  let usingGoogle = false;
  if (gkey_ && Q.get("own") !== "1") { $("#l-msg").textContent = "Loading Google's 3D model of Sector 6."; try { usingGoogle = await loadGoogle(); } catch (e) { console.warn("Google tiles:", e); usingGoogle = false; } }
  if (!usingGoogle) { await loadOwnContext(); if (gkey_) toast("Google's 3D tiles did not load (the key needs billing and the Map Tiles API). Showing our model of the area."); }

  /* --- labels ------------------------------------------------------------ */
  const LAB = $("#labels"), LBL = [];
  const label = (cls, html, pos, on) => { const el = document.createElement("div"); el.className = "lb " + cls; el.innerHTML = html; LAB.appendChild(el); const L = { el, pos, on }; LBL.push(L); return L; };
  const siteL = label("site", `<b>${esc(B.name)}</b><i></i>`, new THREE.Vector3(C.x, TOP + 5, -C.y), () => VIEW !== "floor" && VIEW !== "plan");
  for (const [r, txt] of [[500, "500 M"], [1000, "1 KM"]]) label("ring", txt, new THREE.Vector3(C.x + r, 2, -C.y), () => VIEW === "area");
  const roomL = ROOMS.filter((r) => r.floor !== "void").map((r) => { const w = r.c.clone(); bldg.localToWorld(w); const L = label("room", esc(r.name.replace(/, .*$/, "")), w.add(new THREE.Vector3(0, 3.1, 0)), () => VIEW === "floor" || VIEW === "plan"); L.el.addEventListener("click", () => openRoom(r.id)); L.room = r; return L; });
  const _p = new THREE.Vector3();
  function placeLabels() { const w = innerWidth, h = innerHeight; for (const L of LBL) { const on = L.on(); if (!on) { L.el.style.display = "none"; continue; } _p.copy(L.pos); if (groundY && !L.room) _p.y += groundY; else if (L.room) _p.y += bldg.matrix.elements[13];
      _p.project(camera); const vis = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05; L.el.style.display = vis ? "" : "none"; if (vis) L.el.style.transform = `translate(${((_p.x + 1) / 2 * w).toFixed(1)}px,${((1 - _p.y) / 2 * h).toFixed(1)}px) ${L.el.classList.contains("ring") ? "translate(-50%,-50%)" : "translate(-50%,-100%)"}`; } }
  // the site outline and the rings (archviz-location-mapping)
  const outline = new THREE.Group(); scene.add(outline);
  { const pts = FP.map(([e, n]) => V3(e, n, 0.6)); pts.push(pts[0].clone()); const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0), 200, 0.5, 6, false), new THREE.MeshBasicMaterial({ color: 0xf39a2b, toneMapped: false })); outline.add(tube);
    for (const r of [500, 1000]) { const g = new THREE.RingGeometry(r - 1.5, r + 1.5, 160); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false })); m.position.set(C.x, 1, -C.y); m.userData.ring = true; outline.add(m); } }

  /* --- camera moves ------------------------------------------------------ */
  let fly = null; const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function flyTo(t, p, ms = 1700) { fly = { t0: performance.now(), ms, a: { t: controls.target.clone(), p: camera.position.clone() }, b: { t, p } }; }
  const centre = (h = 0) => new THREE.Vector3(C.x, h + groundY, -C.y);
  const around = (t, dist, polar, azDeg) => new THREE.Vector3(t.x + dist * Math.sin(polar * D2R) * Math.sin(azDeg * D2R), t.y + dist * Math.cos(polar * D2R), t.z + dist * Math.sin(polar * D2R) * Math.cos(azDeg * D2R));
  // the hero angle: from the south-east, where the entrance and Street View are
  const HERO_AZ = (Math.atan2(u.x, -u.y) / D2R) + 25;
  // the middle of Volt's floor, for the floor and plan shots
  const VC = PX(volt.origin[0] + volt.size_px[0] / 2, volt.origin[1] + volt.size_px[1] / 2); bldg.localToWorld(VC);
  const U3 = new THREE.Vector3(u.x, 0, -u.y), PLAN_AZ = Math.atan2(-U3.x, -U3.z) / D2R;   // the plan's top (the end facade) to the top of the screen
  const SHOTS = {
    area: () => { const t = centre(0); return [t, around(t, 1900, 52, HERO_AZ - 10)]; },
    building: () => { const t = centre(TOP * 0.45); return [t, around(t, 140, 66, HERO_AZ)]; },
    floor: () => { const t = VC.clone().setY(groundY + floorZ(1) + 1.2); return [t, around(t, 46, 52, PLAN_AZ + 200)]; },
    plan: () => { const t = VC.clone().setY(groundY + floorZ(1)); return [t, around(t, 48, 0.6, PLAN_AZ)]; },
  };

  /* --- views and the UI (controls revamped: one dock, one stack, crumbs) - */
  let VIEW = "building", FLOOR = null, ROOM = null;
  function setOpen(n) {   // open a floor: the ones above lift away, its facade goes clear
    FLOOR = n;
    for (const f of FLOORS) {
      const above = n != null && f.n > n, here = n != null && f.n === n;
      f.g.visible = !above; f.shell.visible = !usingGoogle || n != null;
      f.shell.traverse((o) => { if (o.userData.glass) o.material = here ? M.glassClear : M.glass; });
      f.shell.children.forEach((o) => { if (here && !o.userData.glass && o.position.y > f.z0 + f.h - 0.6) o.visible = false; else o.visible = true; });
    }
    roof.visible = n == null && !usingGoogle; vf.visible = n === 1;
    if (tiles && flatten) {   // press Google's Skymark flat under ours
      try {
        if (n != null && !flatShape) {
          const s = new THREE.Shape(FP.map(([e, nn]) => new THREE.Vector2(e, nn))); const g = new THREE.ShapeGeometry(s); g.scale(1.08, 1.08, 1); g.rotateX(-Math.PI / 2);
          flatShape = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ visible: false })); flatShape.position.y = groundY + 0.2; scene.add(flatShape); flatShape.updateMatrixWorld(true);
          const down = new THREE.Vector3(0, -1, 0).transformDirection(tiles.group.matrixWorld.clone().invert()); flatten.addShape(flatShape, down, { threshold: 80 });
        } else if (n == null && flatShape) { flatten.deleteShape(flatShape); scene.remove(flatShape); flatShape = null; }
      } catch (e) { console.warn("flatten", e); }
    }
    renderStack(); renderCard();
  }
  function go(view, ms) {
    VIEW = view; showRender(null); if (view === "street") { openStreet(); return; }
    $("#sv").hidden = true;
    setOpen(view === "floor" || view === "plan" ? 1 : null);
    outline.children.forEach((o) => { if (o.userData.ring) o.visible = view === "area"; });
    const [t, p] = SHOTS[view](); controls.maxPolarAngle = view === "plan" ? 2 * D2R : 84 * D2R; controls.minPolarAngle = view === "plan" ? 0 : 0; flyTo(t, p, ms);
    document.querySelectorAll("#dock button").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
    renderCrumbs();
  }
  function openRoom(id) {
    const r = ROOMS.find((x) => x.id === id); if (!r) return; ROOM = id; if (VIEW !== "floor" && VIEW !== "plan") go("floor", 0);
    const w = r.c.clone(); bldg.localToWorld(w); const t = w.clone().setY(w.y + 1); const dist = clamp(Math.max(r.w, r.d) * 1.6, 9, 30);
    // from inside the floor, looking out towards the end facade, so no glass is in the way
  flyTo(t, VIEW === "plan" ? around(t, dist * 1.6, 0.6, PLAN_AZ) : around(t, dist * 1.15, 46, PLAN_AZ), 1300);
    roomL.forEach((L) => L.el.classList.toggle("on", L.room.id === id)); renderCard(); renderCrumbs();
    showRender(id);
  }
  /* a room with a Blender render opens as that picture, full screen: the 3D
     gets you there, the render is what the client looks at */
  const RENDERS = A.renders || {};
  function showRender(id, which = "ours") {
    const r = id && RENDERS[id], room = id && ROOMS.find((x) => x.id === id);
    $("#rv").hidden = $("#rv-bar").hidden = !r; $("#mode").style.visibility = r ? "hidden" : "";
    walkClose();
    if (!r) return;
    if (which === "walk" && WALK[id]) { $("#rv").hidden = true; walkOpen(id); }
    const src = which === "deck" && room.slide ? `${A.media}slides/s${String(room.slide).padStart(2, "0")}.jpg` : A.media + r.src;
    if (which === "3d" || which === "walk") { if (which === "3d") $("#rv").hidden = true; } else {
      const img = $("#rv-img"); img.style.animation = "none"; void img.offsetWidth; img.style.animation = ""; img.src = src; img.alt = room.name;
    }
    $("#rv-cap").textContent = which === "deck" ? `The deck's render, slide ${room.slide}` : which === "3d" ? "The plan in 3D" : which === "walk" ? "Walk mode · 360° views rendered in Blender Cycles" : r.caption;
    document.querySelectorAll("#rv-seg button").forEach((b) => { b.classList.toggle("on", b.dataset.rv === which); if (b.dataset.rv === "deck") b.hidden = !room.slide; if (b.dataset.rv === "walk") b.hidden = !WALK[id]; });
  }

  /* --- walk mode: stand in the room, drag to look, click a ring to move ---
     Each point is a 360 panorama rendered in Cycles (scripts/skymark/blender,
     --pano). The panorama's centre looks along the room's +x (the screen
     wall), its left is the facade: in three.js terms room (x, y, up) is
     (x, up, -y), which is how an equirectangular background wraps. */
  const WALK = A.walk || {};
  const W = { r: null, scene: null, cam: null, room: null, at: null, yaw: 0, pitch: -0.08, raf: 0, tex: new Map() };
  function walkInit() {
    if (W.r) return;
    const c = $("#walk-c");
    W.r = new THREE.WebGLRenderer({ canvas: c, antialias: true }); W.r.setPixelRatio(Math.min(devicePixelRatio, 2)); W.r.outputColorSpace = THREE.SRGBColorSpace;
    W.scene = new THREE.Scene(); W.cam = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    let drag = null;
    c.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: W.yaw, pitch: W.pitch }; c.setPointerCapture(e.pointerId); hint(false); });
    c.addEventListener("pointermove", (e) => { if (!drag) return; const k = (W.cam.fov * D2R) / innerHeight;
      W.yaw = drag.yaw - (e.clientX - drag.x) * k; W.pitch = clamp(drag.pitch + (e.clientY - drag.y) * k, -1.35, 1.35); });
    c.addEventListener("pointerup", () => (drag = null));
    c.addEventListener("wheel", (e) => { e.preventDefault(); W.cam.fov = clamp(W.cam.fov + e.deltaY * 0.04, 35, 95); W.cam.updateProjectionMatrix(); }, { passive: false });
    addEventListener("keydown", (e) => { if ($("#walk").hidden) return; if (e.key === "ArrowLeft") W.yaw -= 0.12; if (e.key === "ArrowRight") W.yaw += 0.12; });
    $("#walk-spots").addEventListener("click", (e) => { const b = e.target.closest("[data-pt]"); if (b) walkTo(b.dataset.pt); });
  }
  const hint = (on) => { const h = $("#walk-hint"); if (on) { h.hidden = false; h.style.opacity = "1"; } else { h.style.opacity = "0"; setTimeout(() => (h.hidden = true), 800); } };
  function loadPano(p) {
    if (!W.tex.has(p.src)) W.tex.set(p.src, new Promise((res) => new THREE.TextureLoader().load(A.media + p.src, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; res(t); })));
    return W.tex.get(p.src);
  }
  async function walkTo(id, first) {
    const pts = WALK[W.room], p = pts.find((x) => x.id === id); if (!p) return;
    const prev = W.at; W.at = p; const c = $("#walk-c");
    if (!first) c.style.opacity = "0";
    const t = await loadPano(p); if (W.at !== p) return;
    // keep facing the way you were walking; the first view uses the point's yaw
    if (first || !prev) W.yaw = (p.yaw || 0) * D2R; else W.yaw = Math.atan2(-(p.at[1] - prev.at[1]), p.at[0] - prev.at[0]);
    W.scene.background = t; c.style.opacity = "1";
    $("#walk-spots").innerHTML = pts.filter((q) => q !== p).map((q) => `<button data-pt="${esc(q.id)}" aria-label="Walk to: ${esc(q.name)}"></button><span>${esc(q.name)}</span>`).join("");
    pts.filter((q) => q !== p).forEach(loadPano);   // the next steps are ready before you click
  }
  function walkOpen(room) {
    walkInit(); W.room = room; $("#walk").hidden = false; hint(true);
    walkTo(WALK[room][0].id, true);
    cancelAnimationFrame(W.raf); const loop = () => { walkFrame(); W.raf = requestAnimationFrame(loop); }; loop();
  }
  function walkClose() { if (!W.r) return; cancelAnimationFrame(W.raf); $("#walk").hidden = true; $("#walk-hint").hidden = true; }
  const _v = new THREE.Vector3();
  function walkFrame() {
    const w = innerWidth, h = innerHeight; if (W.r.domElement.width !== Math.round(w * W.r.getPixelRatio())) { W.r.setSize(w, h, false); }
    W.cam.aspect = w / h; W.cam.updateProjectionMatrix();
    const d = new THREE.Vector3(Math.cos(W.pitch) * Math.cos(W.yaw), Math.sin(W.pitch), Math.cos(W.pitch) * Math.sin(W.yaw));
    W.cam.position.set(0, 0, 0); W.cam.lookAt(d); W.r.render(W.scene, W.cam);
    // the rings on the floor, 1.6 m below the eye
    const p = W.at; if (!p) return; const els = $("#walk-spots").children; let i = 0;
    for (const q of WALK[W.room]) {
      if (q === p) continue; const btn = els[i++], lab = els[i++]; if (!btn) break;
      _v.set(q.at[0] - p.at[0], -1.58, -(q.at[1] - p.at[1])); const dist = _v.length(); const front = _v.dot(d) > 0;
      _v.project(W.cam); const x = (_v.x + 1) / 2 * w, y = (1 - _v.y) / 2 * h; const vis = front && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
      for (const el of [btn, lab]) { el.style.display = vis ? "" : "none"; el.style.left = x + "px"; el.style.top = y + "px"; }
      btn.style.setProperty("--s", clamp(150 / dist, 34, 120) + "px");
    }
  }
  $("#rv-seg").addEventListener("click", (e) => { const b = e.target.closest("[data-rv]"); if (b && ROOM) showRender(ROOM, b.dataset.rv); });
  function openStreet() {
    const sv = A.streetview; const f = $("#sv-frame");
    if (!f.src) f.src = `https://www.google.com/maps/embed?pb=!4v1730000000000!6m8!1m7!1s${sv.pano}!2m2!1d${sv.lat}!2d${sv.lng}!3f${sv.heading}!4f${sv.pitch}!5f0.7820865974627469`;
    $("#sv").hidden = false; document.querySelectorAll("#dock button").forEach((b) => b.classList.toggle("on", b.dataset.view === "street"));
  }
  $("#sv-x").addEventListener("click", () => go(FLOOR === 1 ? "floor" : "building"));
  $("#dock").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) { ROOM = null; go(b.dataset.view); } });
  $("#light").addEventListener("click", (e) => { const b = e.target.closest("[data-light]"); if (b) applyLight(b.dataset.light); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") go(VIEW === "plan" || VIEW === "floor" ? "building" : "area"); });

  function renderCrumbs() {
    const parts = [["area", "Sector 6, Noida"], ["building", B.name]]; if (FLOOR === 1) parts.push(["floor", "1st floor · Volt"]);
    const rr = ROOM && ROOMS.find((x) => x.id === ROOM); if (rr && FLOOR === 1) parts.push(["room", rr.name.replace(/, .*$/, "")]);
    $("#crumbs").innerHTML = parts.map(([k, t], i) => `${i ? "<i>›</i>" : ""}<button data-c="${k}" class="${i === parts.length - 1 ? "on" : ""}">${esc(t)}</button>`).join("");
  }
  $("#crumbs").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b || b.dataset.c === "room") return; ROOM = null; go(b.dataset.c); });
  function renderStack() {
    const fl = B.floors.slice().reverse(), H = 36, gap = 6; let y = 4;
    $("#stack-svg").innerHTML = fl.map((f) => { const g = `<g class="fl${FLOOR === f.n ? " on" : ""}" data-n="${f.n}" transform="translate(0,${y})"><rect class="b" x="0" y="0" width="126" height="${H}" rx="9"/><text x="14" y="${H / 2 + 4}">${esc(f.label)}</text>${f.tenant ? `<text class="tag" x="112" y="${H / 2 + 3.5}" text-anchor="end">${esc(f.tenant.toUpperCase())}</text>` : ""}</g>`; y += H + gap; return g; }).join("");
    $("#stack-svg").setAttribute("viewBox", `0 0 126 ${y}`);
  }
  $("#stack-svg").addEventListener("pointerover", (e) => { const g = e.target.closest(".fl"); FLOORS.forEach((f) => (f.hl.material.opacity = g && +g.dataset.n === f.n ? 0.38 : 0)); });
  $("#stack-svg").addEventListener("pointerleave", () => FLOORS.forEach((f) => (f.hl.material.opacity = 0)));
  $("#stack-svg").addEventListener("click", (e) => { const g = e.target.closest(".fl"); if (!g) return; const n = +g.dataset.n;
    if (n === 1) { ROOM = null; go("floor"); return; }
    toast(`${B.floors[n].name}: no fit-out modelled yet. Volt's first floor is the one we have.`); FLOORS.forEach((f) => (f.hl.material.opacity = f.n === n ? 0.5 : 0)); setTimeout(() => FLOORS.forEach((f) => (f.hl.material.opacity = 0)), 1800); });
  function renderCard() {
    if (FLOOR === 1) {
      const r = ROOM && ROOMS.find((x) => x.id === ROOM);
      $("#card").innerHTML = `<span class="mono">1st floor · Volt</span><h1>${esc(r ? r.name : "Volt")}</h1><p class="addr">${esc(r ? "From the deck's layout and renders." : "The proposed layout, in 3D, from the design and build deck.")}</p>
        ${r && r.slide ? `<figure id="photo"><img src="${A.media}slides/s${String(r.slide).padStart(2, "0")}.jpg" alt="${esc(r.name)}, from the deck"><span>The deck's render, slide ${r.slide}</span></figure>` : ""}
        ${r ? "" : `<h3>Capacity (the deck's legend)</h3><div class="legend">${volt.legend.map(([k, n]) => `<span>${esc(k)}</span><b>${n}</b>`).join("")}</div>`}
        <h3>Rooms</h3><div class="rooms">${ROOMS.filter((x) => x.floor !== "void").map((x) => `<button class="room${x.id === ROOM ? " on" : ""}" data-room="${esc(x.id)}"><b>${esc(x.name)}</b><span>${RENDERS[x.id] ? "RENDER" : x.slide ? "PHOTO" : ""}</span></button>`).join("")}</div>
        <span class="src">${esc(B.floors[1].deck)}. Traced to scale from its layout (1 px = 1.8 cm); furniture placed to the drawing. Where the floor sits in the building is indicative. Chair models made with Meshy (CC BY 4.0).</span>`;
    } else {
      $("#card").innerHTML = `<span class="mono">${esc(B.address)}</span><h1>${esc(B.name)}</h1><p class="addr">Office building, IT/ITES</p>
        <dl class="facts">${B.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <span class="src">Source: <a href="${esc(B.src)}" target="_blank" rel="noopener">Skymark Group</a>. Footprint: Overture Maps.</span>
        <div class="cta"><button class="btn pri" data-go="floor">Open Volt's floor</button><button class="btn" data-go="street">Street View</button></div>`;
    }
  }
  $("#card").addEventListener("click", (e) => { const b = e.target.closest("[data-room]"); if (b) return openRoom(b.dataset.room); const g = e.target.closest("[data-go]"); if (g) { ROOM = null; go(g.dataset.go); } });
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; el.style.opacity = "1"; clearTimeout(toast.t); toast.t = setTimeout(() => { el.style.opacity = "0"; setTimeout(() => (el.hidden = true), 700); }, 4200); }
  /* the card takes the left, the floor stack the right: centre the view between them */
  const offset = () => { const w = innerWidth, h = innerHeight; if (w > 900) camera.setViewOffset(w, h, -105, 0, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); };
  offset();
  addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; offset(); renderer.setSize(innerWidth, innerHeight); if (tiles) tiles.setResolutionFromRenderer(camera, renderer); });

  /* --- go ---------------------------------------------------------------- */
  // a reflection environment from the sky
  { const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); const s2 = sky.clone(); s2.scale.setScalar(0.01); es.add(s2); applyLight("day"); scene.environment = pm.fromScene(es, 0, 1, 1000).texture; }
  applyLight(Q.get("light") === "dusk" ? "dusk" : "day");
  renderStack(); renderCrumbs(); renderCard();
  for (const id of ["#crumbs", "#mode", "#card", "#stack", "#dock"]) $(id).hidden = false;
  const first = ["area", "building", "floor", "plan"].includes(Q.get("view")) ? Q.get("view") : "building";
  { const [t, p] = SHOTS.area(); controls.target.copy(t); camera.position.copy(p); } go(first, 2600);
  if (Q.get("room")) setTimeout(() => openRoom(Q.get("room")), 2700);
  $("#l-bar").style.width = "100%"; setTimeout(() => { $("#load").style.transition = "opacity .8s"; $("#load").style.opacity = "0"; setTimeout(() => $("#load").remove(), 900); }, 150);

  let last = performance.now(); const clock = { frames: 0 };
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (fly) { const t = Math.min(1, (now - fly.t0) / fly.ms), e = ease(t); controls.target.lerpVectors(fly.a.t, fly.b.t, e); camera.position.lerpVectors(fly.a.p, fly.b.p, e); if (t >= 1) fly = null; }
    controls.update();
    const d = camera.position.distanceTo(controls.target), half = clamp(d * 0.9, 40, 1400), sc = sun.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = half * 6; sc.updateProjectionMatrix();
    sun.target.position.copy(controls.target); sun.position.copy(controls.target).addScaledVector(SUN.y > 0.05 ? SUN : SUN.clone().setY(0.3).normalize(), half * 3);
    scene.fog.density = 0.00028 * clamp(900 / Math.max(d, 1), 0.25, 1);
    if (tiles) { camera.updateMatrixWorld(); tiles.update(); }
    renderer.render(scene, camera); placeLabels(); clock.frames++;
    if (!STILL) requestAnimationFrame(frame);
  }
  if (STILL) frame(performance.now()); else requestAnimationFrame(frame);
  window.__sky = { go, openRoom, applyLight, clock, cam: () => ({ p: camera.position.toArray().map((v) => +v.toFixed(1)), t: controls.target.toArray().map((v) => +v.toFixed(1)), fly: !!fly }), tick: (n = 1) => { for (let i = 0; i < n; i++) { last = performance.now() - 250; if (fly) fly.t0 -= 1e9; frame(performance.now()); } } };
}

boot();
