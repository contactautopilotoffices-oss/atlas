/* ============================================================================
   ATLAS · F1 SKYMARK, SECTOR 6, NOIDA

   One property, centre stage, on a flat 2D map. The only 3D object on the
   page is the property itself: its Blender twin (exports/fm_skymark_atlas.glb)
   stands at the property's pin. The basemap draws no 3D buildings.

     Property       the twin in a viewer you can turn, the key figures and
                    what is published about the building
     Connectivity   metro stations and the city's anchors, by distance
     Around         what sits inside 1, 3 and 5 km: employers, coworking,
                    institutes, homes, PG, retail, hotels, hospitals
     3D twin        the model's stills, what it is based on, what is unknown
     Sources        every position and fact with its source

   Every distance is a straight line from the property's pin: the shortest
   possible distance, never a road route. Times are estimates from that line
   and say so. data.js holds every fact; this file only reads it.
   ============================================================================ */
"use strict";

/* Access gate, as on /noida/: the page holds only a SHA-256 of the normalised
   "ID:PASSWORD". It keeps a casual visitor out; it does not make data.js
   private. The site root login routes here via clients/manifest.js. */
const GATE_HASH = "d9f586a32c88a68d2496a990cff6773768d43fd080548c4193d56091c737af56";
const AUTH_KEY = "sky-auth", HANDOFF = "/noida-skymark/";
const CMS = window.AtlasCMS || null;

const M = window.SKY_META, PR = window.SKY_PROPERTY, MD = window.SKY_MODEL, TR = window.SKY_TRANSIT;
const AN = window.SKY_ANCHORS, PL = window.SKY_PLACES;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const cite = (u, label) => /^https?:\/\//.test(u || "") ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || host(u))} ↗</a>` : "";
const REDUCED = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const PHONE = () => innerWidth <= 860;

async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------ geometry -- */
const HOME = { lat: PR.lat, lng: PR.lng };
/* Where the twin stands: on the footprint it was fitted to (MD.anchor),
   which is not exactly the published pin. Distances stay from the pin. */
const SPOT = MD.anchor || HOME;
function km(a, b) {
  const toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}
const KM_LAT = 110.6, KM_LNG = 111.32 * Math.cos(HOME.lat * Math.PI / 180);
function circle(c, rKm, n = 96) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n * 2 * Math.PI; pts.push([c[0] + rKm * Math.cos(t) / KM_LNG, c[1] + rKm * Math.sin(t) / KM_LAT]); }
  return pts;
}
const RINGS = M.rings.map((k, i) => ({ km: k, color: ["#a3502c", "#c8693a", "#d9a07a"][i] || "#d9a07a" }));
const OUTER = RINGS[RINGS.length - 1].km;
const fmtKm = (d) => d < 1 ? `${Math.round(d * 100) * 10} m` : `${d < 10 ? d.toFixed(1) : Math.round(d)} km`;
const walkMin = (d) => Math.max(1, Math.round(d * 1000 * M.walk.factor / M.walk.m_per_min));
const driveMin = (d) => Math.max(2, Math.round(d * M.speed.factor / M.speed.kmh * 60));
/* How you would cover it: on foot up to about 1.2 km, otherwise by road. */
const reach = (d) => d <= 1.2 ? `about ${walkMin(d)} min walk` : `about ${driveMin(d)} min drive`;

/* ------------------------------------------------------------- catalogue -- */
const KINDS = [
  { key: "corp", label: "Employers", one: "Employer", ic: "E", color: "#d0417b", hint: "Company offices nearby: who else hires here." },
  { key: "cowork", label: "Coworking", one: "Coworking / flex space", ic: "C", color: "#1f6f8b", hint: "Other flexible offices: the alternatives a client will compare." },
  { key: "edu", label: "Institutes", one: "Institute", ic: "I", color: "#5b3aa7", hint: "Colleges and institutes: the graduate pipeline." },
  { key: "res", label: "Homes", one: "Residential area", ic: "H", color: "#0a8a3a", hint: "Residential areas where staff are likely to live." },
  { key: "pg", label: "PG and co-living", one: "PG or co-living", ic: "P", color: "#b7791f", hint: "Where joiners from out of town can stay." },
  { key: "retail", label: "Retail and food", one: "Retail / food", ic: "R", color: "#c2410c", hint: "Malls, markets and places to eat." },
  { key: "hotel", label: "Hotels", one: "Hotel", ic: "S", color: "#4d5d73", hint: "Business hotels for visiting clients and teams." },
  { key: "health", label: "Hospitals", one: "Hospital", ic: "+", color: "#b23b2a", hint: "Hospitals within reach." }
];
const KIND = Object.fromEntries(KINDS.map(k => [k.key, k]));
const PLACES = PL.map(p => ({ ...p, d: km(HOME, p) })).sort((a, b) => a.d - b.d);
const LINES = TR.lines.map(L => ({ ...L, stations: L.stations.map(s => ({ ...s, id: `st-${L.key}-${s.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), line: L.key, lineName: L.short, color: L.color, d: km(HOME, s) })) }));
const STATIONS = LINES.flatMap(L => L.stations).sort((a, b) => a.d - b.d);
const NEAR_ST = STATIONS[0];
const ANCHORS = AN.map(a => ({ ...a, d: km(HOME, a) })).sort((a, b) => a.d - b.d);
const ALL = new Map([...PLACES.map(p => [p.id, { ...p, type: "place" }]), ...STATIONS.map(s => [s.id, { ...s, type: "station" }]), ...ANCHORS.map(a => [a.id, { ...a, type: "anchor" }])]);
const within = (k, kind) => PLACES.filter(p => p.d <= k && (!kind || p.kind === kind));
const fact = (k) => (PR.facts.find(f => f.k === k) || {}).v || "";

/* --------------------------------------------------------------- state -- */
const S = {
  tab: "property", sel: null, kinds: new Set(), twin: true, bearing: MD.frontBearing, realSat: true,
  layers: Object.fromEntries([["sat", true], ["rail", true], ["rings", true], ...KINDS.map(k => [k.key, ["corp", "cowork"].includes(k.key)])])
};
try { const b = parseFloat(localStorage.getItem("sky-bearing")); if (!MD.bearingConfirmed && isFinite(b)) S.bearing = b; } catch (e) {}
const TABS = [
  { key: "property", label: "Property" }, { key: "connect", label: "Connectivity" }, { key: "around", label: "Around" },
  { key: "nearby", label: "Nearby list", ph: true }, { key: "twin", label: "3D twin" }, { key: "sources", label: "Sources" }
];

/* ================================================================ gate == */
function initGate() {
  const norm = (v) => v.trim().toUpperCase().replace(/[\s-]/g, "");
  let busy = false;
  const openApp = () => { const g = $("#gate"); g.classList.add("out"); setTimeout(() => g.remove(), 450); boot(); };
  const go = async () => {
    if (busy) return; busy = true; $("#g-go").disabled = true;
    let ok = false;
    try { ok = (await sha256(norm($("#g-id").value) + ":" + norm($("#g-pw").value))) === GATE_HASH; } catch (e) { ok = false; }
    busy = false; $("#g-go").disabled = false;
    if (ok) { try { sessionStorage.setItem(AUTH_KEY, "1"); } catch (e) {} if (CMS) CMS.signin(norm($("#g-id").value)); openApp(); }
    else { $("#g-err").textContent = "Not recognised. Access is issued per person."; $("#g-pw").value = ""; $("#g-pw").focus(); }
  };
  startMap();
  $("#g-stats").innerHTML = `<span><b>${fmtKm(NEAR_ST.d)}</b>to ${esc(NEAR_ST.name)} metro</span><span><b>${PLACES.length}</b>places mapped within ${OUTER} km</span>`
    + `<span><b>${STATIONS.length}</b>metro stations</span><span><b>1</b>building in 3D</span>`;
  let handoff = null;
  try { handoff = sessionStorage.getItem("atlas-handoff"); sessionStorage.removeItem("atlas-handoff"); } catch (e) {}
  let authed = false;
  try { if (handoff === HANDOFF) sessionStorage.setItem(AUTH_KEY, "1"); authed = sessionStorage.getItem(AUTH_KEY) === "1"; } catch (e) {}
  if (handoff === HANDOFF && CMS) { let id = null; try { id = sessionStorage.getItem("atlas-access-id"); } catch (e) {} CMS.signin(id); }
  if (authed) { $("#gate").remove(); boot(); return; }
  try { if (sessionStorage.getItem("sky-out") === "1") { sessionStorage.removeItem("sky-out"); const e = $("#g-err"); e.style.color = "var(--ok)"; e.textContent = "You have signed out on this device."; } } catch (e) {}
  $("#g-form").addEventListener("submit", e => { e.preventDefault(); $("#g-err").removeAttribute("style"); go(); });
  $("#g-id").focus();
}
function signOut() {
  if (CMS) CMS.signout();
  try { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem("atlas-handoff"); sessionStorage.setItem("sky-out", "1"); } catch (e) {}
  location.replace(location.pathname);
}

/* ============================================================== three ====
   three.js (vendored under /engine/vendor/three) draws the twin twice: in
   the panel's viewer, and standing on the map. It loads once. */
let THREEP = null;
function loadThree() {
  if (!THREEP) THREEP = Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/controls/OrbitControls.js")])
    .then(([THREE, g, o]) => ({ THREE, GLTFLoader: g.GLTFLoader, OrbitControls: o.OrbitControls }));
  return THREEP;
}
/* The twin, and the 500 m round it (meshopt-compressed, as the Andheri
   world's models are, so the loader needs the decoder). */
const GLB = {};
const loadGLB = (url) => GLB[url] || (GLB[url] = loadThree().then(async ({ GLTFLoader }) => {
  const l = new GLTFLoader();
  try { const { MeshoptDecoder } = await import("three/addons/libs/meshopt_decoder.module.js"); l.setMeshoptDecoder(MeshoptDecoder); } catch (e) {}
  return new Promise((ok, no) => l.load(url, g => ok(g.scene), undefined, no));
}));
const loadTwin = () => loadGLB(MD.glb);

/* ------------------------------------------------- real satellite drape --
   The 500 m model's walls are painted (no open source has real wall
   images), but everything seen from above is real: the page fetches the
   Mapbox satellite tiles round the property with its own map key, stitches
   them on a canvas, and lays the photo on every upward-facing surface of the
   surroundings: ground, streets, parks and roofs. */
const SAT_Z = 17, SAT_R = 580;
const KLAT_M = 110574, KLNG_M = 111320 * Math.cos(SPOT.lat * Math.PI / 180);
const TH = (180 - (MD.frontBearing ?? 180)) * Math.PI / 180;   // the model's frame -> east/north
function mercPx(lng, lat, z) {
  const n = 256 * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}
/* glTF is y-up: scene x is the model's x, scene z is minus the model's y. */
function sceneLngLat(x, z) {
  const lx = x, ly = -z, e = lx * Math.cos(TH) - ly * Math.sin(TH), n = lx * Math.sin(TH) + ly * Math.cos(TH);
  return [SPOT.lng + e / KLNG_M, SPOT.lat + n / KLAT_M];
}
let SATP = null;
function loadSatellite(THREE) {
  if (SATP) return SATP;
  if (!window.MAPBOX_TOKEN) return (SATP = Promise.reject(new Error("no map key")));
  SATP = (async () => {
    const dl = SAT_R / KLAT_M, dg = SAT_R / KLNG_M;
    const [x0, y0] = mercPx(SPOT.lng - dg, SPOT.lat + dl, SAT_Z), [x1, y1] = mercPx(SPOT.lng + dg, SPOT.lat - dl, SAT_Z);
    const tx0 = Math.floor(x0 / 256), ty0 = Math.floor(y0 / 256), tx1 = Math.floor(x1 / 256), ty1 = Math.floor(y1 / 256);
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1, T = 512;
    const cv = document.createElement("canvas"); cv.width = nx * T; cv.height = ny * T;
    const g = cv.getContext("2d"); g.fillStyle = "#8b8778"; g.fillRect(0, 0, cv.width, cv.height);
    let got = 0;
    await Promise.all([...Array(nx * ny).keys()].map(i => new Promise(ok => {
      const tx = tx0 + (i % nx), ty = ty0 + Math.floor(i / nx), im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => { g.drawImage(im, (tx - tx0) * T, (ty - ty0) * T, T, T); got++; ok(); };
      im.onerror = () => ok();
      im.src = `https://api.mapbox.com/v4/mapbox.satellite/${SAT_Z}/${tx}/${ty}@2x.jpg90?access_token=${encodeURIComponent(window.MAPBOX_TOKEN)}`;
    })));
    if (!got) throw new Error("no satellite tiles");
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    /* scene (x, z) -> texture uv, as an affine map (Mercator is linear to
       well under a pixel over a kilometre) */
    const uv = (x, z) => { const [lng, lat] = sceneLngLat(x, z), [px, py] = mercPx(lng, lat, SAT_Z);
      return [(px - tx0 * 256) / (nx * 256), 1 - (py - ty0 * 256) / (ny * 256)]; };
    const o = uv(0, 0), ax = uv(1, 0), az = uv(0, 1);
    return { tex, o, ux: [ax[0] - o[0], ax[1] - o[1]], uz: [az[0] - o[0], az[1] - o[1]], tiles: got };
  })();
  return SATP;
}
const NOT_DRAPED = /trunk|leaf|frond|Sign|Glass|Aluminium/i;
function drape(THREE, root, sat, state) {
  const U = { uSat: { value: sat.tex }, uSatO: { value: new THREE.Vector2(...sat.o) }, uSatX: { value: new THREE.Vector2(...sat.ux) },
    uSatZ: { value: new THREE.Vector2(...sat.uz) }, uSatMix: state };
  const done = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m || done.has(m) || NOT_DRAPED.test(m.name || "")) continue;
      done.add(m);
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vSatW; varying vec3 vSatN;")
          .replace("#include <project_vertex>", "#include <project_vertex>\nvSatW = (modelMatrix * vec4(transformed, 1.0)).xyz; vSatN = normalize(mat3(modelMatrix) * objectNormal);");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vSatW; varying vec3 vSatN; uniform sampler2D uSat; uniform vec2 uSatO, uSatX, uSatZ; uniform float uSatMix;")
          .replace("#include <map_fragment>", `#include <map_fragment>
            { float up = smoothstep(0.7, 0.95, normalize(vSatN).y) * uSatMix;
              vec2 suv = uSatO + uSatX * vSatW.x + uSatZ * vSatW.z;
              if (up > 0.0 && suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0) diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uSat, suv).rgb, up); }`);
      };
      m.needsUpdate = true;
    }
  });
}
/* A soft sky to reflect in the glass: blue overhead, pale at the horizon,
   warm grey below. Without it the metallic glass would render black. */
function skyEnv(THREE, renderer) {
  const sc = new THREE.Scene(), geo = new THREE.SphereGeometry(50, 32, 16), col = [];
  const top = new THREE.Color("#7fa6cf"), hor = new THREE.Color("#eef2f4"), gnd = new THREE.Color("#8d8880"), c = new THREE.Color();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 50; if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, .6)); else c.copy(hor).lerp(gnd, Math.min(1, -y * 4)); col.push(c.r, c.g, c.b); }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(sc, 0.02).texture;
  pm.dispose(); geo.dispose();
  return tex;
}
/* Daylight as in the Blender stills: a warm sun from the front left, high
   enough for short shadows, a soft sky fill, and shadows from every block
   and tree. `span` is the radius the shadows must cover. */
function lightScene(THREE, scene, renderer, span = 60) {
  scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x6f6658, 0.75));
  const sun = new THREE.DirectionalLight(0xfff0db, 2.9);
  /* the stills' sun: toward (-0.42, -0.72, 0.55) in the model's frame; glTF y-up */
  const d = new THREE.Vector3(-0.42, 0.55, 0.72).normalize();
  sun.position.copy(d.multiplyScalar(span * 2.2)); sun.target.position.set(0, 0, 0);
  scene.add(sun); scene.add(sun.target);
  if (renderer && renderer.shadowMap) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true;
    const c = sun.shadow.camera; c.left = -span; c.right = span; c.top = span; c.bottom = -span; c.near = 1; c.far = span * 5;
    sun.shadow.mapSize.set(span > 200 ? 4096 : 2048, span > 200 ? 4096 : 2048);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = span > 200 ? 0.6 : 0.05;
  }
  return sun;
}
const shadowsOn = (root) => root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

/* The viewer in the Property tab: the twin on a turntable. Drag to turn it,
   scroll or pinch to zoom. It stops when its tab is not showing. */
let viewer = null;
function mountViewer(el, withContext) {
  if (viewer) { viewer.dispose(); viewer = null; }
  const still = () => { el.innerHTML = `<img src="./renders/${esc(MD.renders[0][0])}" alt="F1 Skymark, rendered from the 3D twin"><span class="ph">Still from the 3D twin</span>`; };
  loadThree().then(async ({ THREE, OrbitControls }) => {
    if (!el.isConnected) return;
    const model = (await loadTwin()).clone(true);
    const ctx = withContext && MD.contextGlb ? await loadGLB(MD.contextGlb).catch(() => null) : null;
    if (!el.isConnected) return;
    const w = el.clientWidth || 460, h = Math.round(Math.min(withContext ? 380 : 300, Math.max(210, w * (withContext ? .72 : .58))));
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    const scene = new THREE.Scene(); scene.environment = skyEnv(THREE, renderer); scene.environmentIntensity = 0.8;
    lightScene(THREE, scene, renderer, ctx ? 560 : 60); shadowsOn(model); scene.add(model);
    /* distant blocks fade into a light haze, as they do in the stills */
    if (ctx) scene.fog = new THREE.Fog(0xe9e4dc, 700, 2600);
    let satState = null;
    if (ctx) {
      const c = ctx.clone(true);
      c.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); });
      shadowsOn(c); scene.add(c);
      satState = { value: S.realSat ? 1 : 0 };
      loadSatellite(THREE).then(sat => { drape(THREE, c, sat, satState); window.__skySatTiles = sat.tiles; el.dataset.sat = "on"; if (viewer) viewer.redraw(); })
        .catch(e => { el.dataset.sat = "off"; console.warn("[skymark] satellite", e && e.message); });
    }
    const cam = new THREE.PerspectiveCamera(32, w / h, 1, 6000);
    /* Start where the photograph was taken from: in front, toward side B.
       With the surroundings, start high, as the Andheri dollhouse does. */
    if (ctx) cam.position.set(-330, 300, 420); else cam.position.set(-62, 30, 78);
    const ctl = new OrbitControls(cam, renderer.domElement);
    ctl.target.set(0, ctx ? 0 : MD.heightM * .42, 0); ctl.enablePan = !!ctx; ctl.minDistance = ctx ? 60 : 45; ctl.maxDistance = ctx ? 1400 : 220; ctl.maxPolarAngle = Math.PI * .47;
    /* The sun and the city never move, so shadows are drawn once, and the
       large model redraws only when the view changes. */
    if (renderer.shadowMap.enabled) { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; }
    let dirty = true;
    const redraw = () => { dirty = true; };
    ctl.autoRotate = !REDUCED() && !ctx; ctl.autoRotateSpeed = .7; ctl.enableDamping = true;
    ctl.addEventListener("start", () => { ctl.autoRotate = false; });
    ctl.addEventListener("change", redraw);
    el.innerHTML = ""; el.appendChild(renderer.domElement);
    el.insertAdjacentHTML("beforeend", `<span class="ph">${ctx ? "3D twin and the real 500 m round it · drag to turn, scroll to zoom" : "3D twin · drag to turn"}</span>`);
    let raf = 0, alive = true, cw = w, ch = h;
    /* follows the box it sits in, so full screen and back just work */
    const fit = () => {
      const W = el.clientWidth || cw, H = el.classList.contains("full") ? el.clientHeight : h;
      if (W !== cw || H !== ch) { cw = W; ch = H; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); dirty = true; }
    };
    const tick = () => {
      if (!alive) return;
      if (!el.isConnected) { viewer && viewer.dispose(); return; }
      fit(); ctl.update();
      if (dirty || ctl.autoRotate) { dirty = false; renderer.render(scene, cam); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    viewer = { redraw, setSat(on) { if (satState) satState.value = on ? 1 : 0; redraw(); }, dispose() { alive = false; cancelAnimationFrame(raf); ctl.dispose(); renderer.dispose(); if (viewer === this) viewer = null; } };
    window.__skyViewerReady = true;
  }).catch((e) => { console.warn("[skymark] viewer", e && e.message); still(); });
}

/* The twin on the map: a Mapbox custom layer. The model is in metres with
   its footprint centre at the origin; glTF +Z is the front. With no turn the
   front faces south, so the turn is 180 degrees minus the front's bearing. */
function twinLayer(THREE, model) {
  const mc = mapboxgl.MercatorCoordinate.fromLngLat([SPOT.lng, SPOT.lat], 0);
  const s = mc.meterInMercatorCoordinateUnits();
  const rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  let renderer, scene, camera;
  return {
    id: "twin", type: "custom", renderingMode: "3d",
    onAdd(mp, gl) {
      camera = new THREE.Camera(); scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ canvas: mp.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      try { scene.environment = skyEnv(THREE, renderer); } catch (e) {}
      lightScene(THREE, scene); scene.add(model);
      renderer.resetState();
    },
    render(gl, matrix) {
      if (!S.twin) return;
      const turn = new THREE.Matrix4().makeRotationY((180 - S.bearing) * Math.PI / 180);
      const l = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(rotX).multiply(turn);
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(l);
      renderer.resetState(); renderer.render(scene, camera);
    },
    onRemove() { try { renderer.dispose(); } catch (e) {} }
  };
}
function addTwin() {
  if (!map || map.getLayer("twin")) return;
  Promise.all([loadThree(), loadTwin()]).then(([{ THREE }, model]) => {
    if (map.getLayer("twin")) return;
    try { map.addLayer(twinLayer(THREE, model.clone(true))); window.__skyTwinOnMap = true; map.triggerRepaint(); }
    catch (e) { console.warn("[skymark] twin layer", e.message); }
  }).catch((e) => console.warn("[skymark] twin", e && e.message));
}

/* ================================================================ map === */
let map, booted = false, layered = false, hq = null;
const MAPBOX_CDN = "https://api.mapbox.com/mapbox-gl-js/v3.10.0/";
function loadMapbox() {
  if (window.mapboxgl) return Promise.resolve();
  return new Promise((resolve, reject) => { const js = document.createElement("script"); js.src = MAPBOX_CDN + "mapbox-gl.js"; js.onload = resolve; js.onerror = reject; document.head.appendChild(js); });
}
const mapUnavailable = () => { $("#map").innerHTML = `<div class="nomap">Map unavailable right now. Everything else on the page still works.</div>`; };
function startMap() {
  if (!window.MAPBOX_TOKEN) return mapUnavailable();
  loadMapbox().then(initMap).catch(mapUnavailable);
}
/* Two flat basemaps and no 3D from either: the plain map is Mapbox Standard,
   faded, with 3D objects off; satellite is Standard Satellite. Shop labels
   are off; the study's own layers carry what matters.
   SKY_MAP_STYLES ({ std, sat }) lets a test swap in local styles. */
const STYLES = window.SKY_MAP_STYLES || { std: "mapbox://styles/mapbox/standard", sat: "mapbox://styles/mapbox/standard-satellite" };
const IS_MAPBOX = !window.SKY_MAP_STYLES;
const styleUrl = () => S.layers.sat ? STYLES.sat : STYLES.std;
const basemap = () => S.layers.sat
  ? { lightPreset: "day", showPointOfInterestLabels: false, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true }
  : { lightPreset: "day", theme: "faded", showPointOfInterestLabels: false, showTransitLabels: true, showPlaceLabels: true, showRoadLabels: true, show3dObjects: false };
function applyBasemap() { if (IS_MAPBOX) for (const [k, v] of Object.entries(basemap())) { try { map.setConfigProperty("basemap", k, v); } catch (e) {} } }
function initMap() {
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  map = new mapboxgl.Map({
    container: "map", style: styleUrl(), center: M.center, zoom: 13.2, pitch: 0, bearing: 0, maxPitch: 62,
    attributionControl: false, projection: "mercator", antialias: true, renderWorldCopies: false,
    config: IS_MAPBOX ? { basemap: basemap() } : undefined
  });
  map.on("style.load", () => { applyBasemap(); if (layered && !map.getSource("places")) { addLayers(); addTwin(); } });
  let told = false;
  map.on("error", (e) => {
    const st = e && e.error && e.error.status;
    if (told || (st !== 401 && st !== 403)) return;
    told = true;
    $("#map").insertAdjacentHTML("beforeend", `<div class="nomap warn">Mapbox did not accept the map key on this address, so the map cannot load here. Everything else on the page still works.</div>`);
  });
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
  map.on("load", () => { addLayers(); addTwin(); addHQ(); wireMap(); layered = true; if (booted) frame(false); });
}
function addHQ() {
  const el = document.createElement("div"); el.className = "hq";
  el.innerHTML = `<div class="pulse"></div><div class="pin" title="F1 Skymark">F1</div><div class="tag"><b>F1 Skymark</b><span>PLOT F-01 · SECTOR 6</span></div>`;
  el.querySelector(".pin").addEventListener("click", () => { select(null); goTab("property"); });
  hq = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([SPOT.lng, SPOT.lat]).addTo(map);
  syncHQ(); map.on("zoom", syncHQ);
}
/* Close in, the twin is the marker; the pin steps back to a small dot. */
function syncHQ() { if (hq) hq.getElement().classList.toggle("near", map.getZoom() >= 16.2 && S.twin && !!window.__skyTwinOnMap); }

function padding() {
  const W = innerWidth, H = innerHeight;
  if (PHONE()) return { top: 150, bottom: Math.round(H * .56) + 20, left: 24, right: 24 };
  const b = $("#board").getBoundingClientRect(), p = $("#panel").getBoundingClientRect();
  return { top: 96, bottom: 76, left: Math.min(W * .4, b.right + 30), right: Math.min(W * .45, W - p.left + 30) };
}
/* The camera for each view. Close on the property the map tilts so the twin
   reads as a building; every wider view is flat, straight down. */
function frame(animate = true) {
  if (!map) return;
  const dur = animate && !REDUCED() ? 1200 : 0, pad = padding();
  const it = S.sel && ALL.get(S.sel);
  if (it) {
    const b = new mapboxgl.LngLatBounds().extend([HOME.lng, HOME.lat]).extend([it.lng, it.lat]);
    return map.fitBounds(b, { padding: pad, maxZoom: 16.4, pitch: 0, bearing: 0, duration: dur });
  }
  if (S.tab === "property" || S.tab === "twin") {
    /* Look at the corner between the front and side B, as the photo does. */
    /* Look at the corner between the front and side B, as the photo does:
       the camera stands in front of the building, 32 degrees round toward
       side B. `offset` centres the twin in the gap between the panes; padding
       is not used here because the map keeps it and adds it to the next fit. */
    return map.easeTo({ center: [SPOT.lng, SPOT.lat], zoom: PHONE() ? 17.3 : 17.9, pitch: 56, bearing: (S.bearing + 180 + 32) % 360,
      offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2], duration: dur });
  }
  const r = S.tab === "connect" ? Math.max(3, ...STATIONS.slice(0, 6).map(s => s.d)) : OUTER;
  const b = circle([HOME.lng, HOME.lat], r, 8).reduce((bb, p) => bb.extend(p), new mapboxgl.LngLatBounds());
  map.fitBounds(b, { padding: pad, pitch: 0, bearing: 0, duration: dur });
}

const FC = (features) => ({ type: "FeatureCollection", features });
const pt = (lng, lat, properties) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties });
const ln = (coords, properties) => ({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties });
function linkFC() {
  const it = S.sel && ALL.get(S.sel);
  if (!it) return FC([]);
  return FC([ln([[HOME.lng, HOME.lat], [it.lng, it.lat]], { part: "line" }),
    pt((HOME.lng + it.lng) / 2, (HOME.lat + it.lat) / 2, { part: "label", label: `${fmtKm(it.d)} · ${reach(it.d)}` })]);
}
function add(layer) {
  try { map.addLayer(layer); } catch (e) { console.warn("layer", layer.id, e.message); }
  if (!map.getLayer(layer.id) && layer.slot) { const { slot, ...rest } = layer; try { map.addLayer(rest); } catch (e) {} }
}
function addLayers() {
  const B = ["DIN Pro Bold", "Arial Unicode MS Bold"], R = ["DIN Pro Medium", "Arial Unicode MS Regular"];
  /* distance rings round the property */
  map.addSource("rings", { type: "geojson", data: FC(RINGS.slice().reverse().map(r => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [circle([HOME.lng, HOME.lat], r.km)] }, properties: { color: r.color } }))) });
  map.addSource("ring-labels", { type: "geojson", data: FC(RINGS.map(r => pt(HOME.lng, HOME.lat + r.km / KM_LAT, { label: `${r.km} km` }))) });
  add({ id: "rings-fill", type: "fill", source: "rings", slot: "middle", paint: { "fill-color": ["get", "color"], "fill-opacity": .05 } });
  add({ id: "rings-line", type: "line", source: "rings", slot: "middle", paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-dasharray": [2, 2], "line-opacity": .9 } });
  add({ id: "rings-label", type: "symbol", source: "ring-labels", layout: { "text-field": ["get", "label"], "text-size": 11.5, "text-font": B, "text-offset": [0, -.6] }, paint: { "text-color": "#a3502c", "text-halo-color": "#fff", "text-halo-width": 1.8 } });
  /* metro: drawn station to station, in each line's colour */
  map.addSource("rail", { type: "geojson", data: FC(LINES.flatMap(L => L.stations.slice(1).map((s, i) => ln([[L.stations[i].lng, L.stations[i].lat], [s.lng, s.lat]], { color: L.color })))) });
  add({ id: "rail-casing", type: "line", source: "rail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 7, "line-opacity": .85 } });
  add({ id: "rail-line", type: "line", source: "rail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 4 } });
  map.addSource("stations", { type: "geojson", data: FC(STATIONS.map(s => pt(s.lng, s.lat, { id: s.id, name: s.name, line: s.lineName, color: s.color, near: s.id === NEAR_ST.id ? 1 : 0 }))) });
  add({ id: "st", type: "circle", source: "stations", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 14, 7], "circle-color": "#fff", "circle-stroke-color": ["get", "color"], "circle-stroke-width": 2.4 } });
  add({ id: "st-label", type: "symbol", source: "stations", minzoom: 11.5, layout: { "text-field": ["get", "name"], "text-size": 11, "text-font": R, "text-offset": [0, 1.1], "text-anchor": "top", "symbol-sort-key": ["-", 1, ["get", "near"]] },
    paint: { "text-color": "#1d3f66", "text-halo-color": "#fff", "text-halo-width": 1.6 } });
  /* what is around */
  map.addSource("places", { type: "geojson", data: FC(PLACES.map(p => pt(p.lng, p.lat, { id: p.id, kind: p.kind, name: p.name, color: KIND[p.kind].color, ic: KIND[p.kind].ic, res: p.kind === "res" ? 1 : 0 }))) });
  add({ id: "places", type: "circle", source: "places", paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 5, 15, 9], "circle-color": ["get", "color"],
    "circle-opacity": ["case", ["==", ["get", "res"], 1], .28, .95], "circle-stroke-color": ["case", ["==", ["get", "res"], 1], ["get", "color"], "#fff"], "circle-stroke-width": 1.6 } });
  add({ id: "places-ic", type: "symbol", source: "places", minzoom: 12.2, layout: { "text-field": ["get", "ic"], "text-size": 9.5, "text-font": B, "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": ["case", ["==", ["get", "res"], 1], ["get", "color"], "#fff"] } });
  add({ id: "places-label", type: "symbol", source: "places", minzoom: 13, layout: { "text-field": ["get", "name"], "text-size": 10.5, "text-font": R, "text-offset": [0, 1.05], "text-anchor": "top", "text-max-width": 9 },
    paint: { "text-color": ["get", "color"], "text-halo-color": "#fff", "text-halo-width": 1.5 } });
  /* the line from the property to whatever is selected */
  map.addSource("link", { type: "geojson", data: linkFC() });
  add({ id: "link", type: "line", source: "link", filter: ["==", ["get", "part"], "line"], layout: { "line-cap": "round" }, paint: { "line-color": "#2a1e16", "line-width": 2.6, "line-dasharray": [1.4, 1.4] } });
  add({ id: "link-label", type: "symbol", source: "link", filter: ["==", ["get", "part"], "label"], layout: { "text-field": ["get", "label"], "text-size": 12, "text-font": B, "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": "#2a1e16", "text-halo-color": "#fff", "text-halo-width": 2.4 } });
  applyLayers();
}
function applyLayers() {
  if (!map || !map.getLayer("places")) return;
  const vis = (ids, on) => ids.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
  vis(["rings-fill", "rings-line", "rings-label"], S.layers.rings);
  vis(["rail-casing", "rail-line", "st", "st-label"], S.layers.rail);
  /* The selected place always shows, whatever its layer says. */
  const kinds = KINDS.filter(k => S.layers[k.key]).map(k => k.key);
  const f = ["any", ["in", ["get", "kind"], ["literal", kinds]], ["==", ["get", "id"], S.sel || ""]];
  ["places", "places-ic", "places-label"].forEach(id => map.setFilter(id, f));
  const src = map.getSource("link"); if (src) src.setData(linkFC());
  syncHQ(); map.triggerRepaint();
}
function wireMap() {
  const pop = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
  const hover = (layer, html) => {
    map.on("mouseenter", layer, e => { map.getCanvas().style.cursor = "pointer"; const f = e.features[0]; pop.setLngLat(f.geometry.coordinates).setHTML(html(ALL.get(f.properties.id))).addTo(map); });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; pop.remove(); });
    map.on("click", layer, e => select(e.features[0].properties.id));
  };
  hover("places", p => `<b>${esc(p.name)}</b><br>${esc(KIND[p.kind].one)}${p.sub ? ` · ${esc(p.sub)}` : ""}<br>${fmtKm(p.d)} from F1 Skymark · ${reach(p.d)}`);
  hover("st", s => `<b>${esc(s.name)}</b><br>${esc(s.lineName)}<br>${fmtKm(s.d)} from F1 Skymark · ${reach(s.d)}`);
}

/* ================================================================ boot == */
function boot() {
  booted = true;
  applyRoute(false);
  renderTabs(); renderFilters(); renderList(); renderLayers(); renderPanel();
  $("#signout").addEventListener("click", signOut);
  $("#lightbox").addEventListener("click", () => $("#lightbox").classList.remove("on"));
  document.addEventListener("click", (e) => { const im = e.target.closest("[data-zoom]"); if (im) { $("#lightbox img").src = im.dataset.zoom; $("#lightbox").classList.add("on"); } });
  addEventListener("popstate", () => applyRoute(true));
  addEventListener("resize", () => { clearTimeout(boot.t); boot.t = setTimeout(() => frame(false), 200); });
  if (map && layered) frame(false);
}
/* Every view has an address (#/around, #/place/<id>), so a link opens on
   exactly the view that was discussed. */
const routeHash = () => S.sel ? `#/place/${S.sel}` : S.tab === "property" ? "#/" : `#/${S.tab}`;
function pushRoute() { const h = routeHash(); if (location.hash !== h && !(h === "#/" && !location.hash)) history.pushState(null, "", h); }
function applyRoute(render) {
  const [kind, val] = location.hash.replace(/^#\/?/, "").split("/");
  S.sel = kind === "place" && ALL.has(val) ? val : null;
  if (!S.sel) S.tab = TABS.some(t => t.key === kind) ? kind : "property";
  if (render) { renderTabs(); renderList(); renderPanel(); applyLayers(); frame(); }
}
function goTab(key) { S.tab = key; S.sel = null; pushRoute(); renderTabs(); renderList(); renderPanel(); applyLayers(); frame(); }
function select(id) {
  S.sel = id && ALL.has(id) ? id : null;
  pushRoute(); renderTabs(); renderList(); renderPanel(); applyLayers(); frame();
}

/* ============================================================== board === */
function renderTabs() {
  $("#tabs").innerHTML = TABS.map(t => `<button class="tab${t.ph ? " ph" : ""}${!S.sel && S.tab === t.key ? " on" : ""}" data-tab="${t.key}">${esc(t.label)}</button>`).join("");
  $("#tabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) goTab(b.dataset.tab); };
}
function renderFilters() {
  $("#b-sub").textContent = `${PLACES.length} places within ${OUTER} km, nearest first. Distances are straight lines.`;
  $("#filters").innerHTML = KINDS.map(k => `<button class="chip${S.kinds.has(k.key) ? " on" : ""}" data-kind="${k.key}" title="${esc(k.hint)}"><span class="dot" style="background:${k.color}"></span>${esc(k.label)} <span class="c">${within(OUTER, k.key).length}</span></button>`).join("");
  $("#filters").onclick = (e) => {
    const b = e.target.closest("[data-kind]"); if (!b) return;
    const k = b.dataset.kind; S.kinds.has(k) ? S.kinds.delete(k) : S.kinds.add(k);
    if (S.kinds.has(k)) S.layers[k] = true;   // filtering to a kind also shows it on the map
    renderFilters(); renderList(); renderLayers(); applyLayers();
  };
}
const itemHTML = (p, color, ic, sub) => `<button class="it${S.sel === p.id ? " sel" : ""}" data-id="${esc(p.id)}" role="listitem"><span class="ic" style="background:${color}">${esc(ic)}</span>`
  + `<div><div class="nm">${esc(p.name)}</div><div class="sb">${esc(sub)}</div></div><div class="d">${fmtKm(p.d)}<small>${reach(p.d).replace("about ", "")}</small></div></button>`;
function listHTML() {
  const show = PLACES.filter(p => !S.kinds.size || S.kinds.has(p.kind));
  let out = "";
  if (!S.kinds.size) out += `<div class="grp">Metro · nearest three</div>` + STATIONS.slice(0, 3).map(s => itemHTML(s, s.color, "M", s.lineName)).join("");
  let from = 0;
  for (const r of RINGS) {
    const inR = show.filter(p => p.d > from && p.d <= r.km);
    if (inR.length) out += `<div class="grp">${from ? `${from} to ${r.km} km` : `Within ${r.km} km`} · ${inR.length}</div>` + inR.map(p => itemHTML(p, KIND[p.kind].color, KIND[p.kind].ic, p.sub || KIND[p.kind].one)).join("");
    from = r.km;
  }
  return out || `<p class="note" style="padding:10px">Nothing of that kind is mapped within ${OUTER} km.</p>`;
}
function renderList() {
  const el = $("#list"); el.innerHTML = listHTML();
  el.onclick = (e) => { const b = e.target.closest("[data-id]"); if (b) select(b.dataset.id); };
}
function renderLayers() {
  const chips = [
    { key: "twin", label: "3D twin", sw: `<span class="dot" style="background:#a3502c"></span>`, on: S.twin, hint: "The building itself, in 3D, standing at its pin. Nothing else on the map is 3D." },
    { key: "sat", label: "Satellite", sw: `<span class="sw" style="height:9px;background:linear-gradient(135deg,#55603f,#9a9474 45%,#4b5660)"></span>`, on: S.layers.sat, hint: "Satellite photo, flat. Off shows the plain map." },
    { key: "rail", label: "Metro", sw: `<span class="sw" style="background:linear-gradient(90deg,#2b6cb0 60%,#b0306f 60%)"></span>`, on: S.layers.rail, hint: "Blue and Magenta Line stations, drawn station to station." },
    { key: "rings", label: `${M.rings.join(", ")} km`, sw: `<span class="dot" style="background:transparent;border:1.5px dashed #a3502c"></span>`, on: S.layers.rings, hint: "Straight-line rings round the property." },
    ...KINDS.map(k => ({ key: k.key, label: k.label, sw: `<span class="dot" style="background:${k.color}"></span>`, on: S.layers[k.key], hint: k.hint }))
  ];
  $("#layers").innerHTML = chips.map(c => `<button class="chip lay${c.on ? " on" : ""}" data-layer="${c.key}" aria-pressed="${c.on}" title="${esc(c.hint)}">${c.sw}${esc(c.label)}</button>`).join("");
  $("#layers").onclick = (e) => {
    const b = e.target.closest("[data-layer]"); if (!b) return;
    const k = b.dataset.layer;
    if (k === "twin") S.twin = !S.twin; else S.layers[k] = !S.layers[k];
    renderLayers();
    if (k === "sat" && map && layered) map.setStyle(styleUrl(), { diff: false }); else applyLayers();
  };
}

/* ============================================================== panel === */
function renderPanel() {
  const it = S.sel && ALL.get(S.sel);
  const head = $("#p-head"), body = $("#p-body");
  if (it) { head.innerHTML = placeHead(it); body.innerHTML = placeBody(it); }
  else {
    const H = { property: ["The property", "F1 Skymark", `${PR.address}`], connect: ["Connectivity", "Metro and the city", "How far the stations and the city's anchors are from the door."],
      around: ["Location intelligence", `Within ${OUTER} km`, "What sits around the property, counted by ring."], nearby: ["Nearby", "Everything, nearest first", "Tap a place to see it on the map."],
      twin: ["3D twin", "The building, modelled", MD.basis], sources: ["Sources", "Where each fact came from", M.method] }[S.tab];
    head.innerHTML = `<div class="eyebrow">${esc(H[0])}</div><h2>${esc(H[1])}</h2><div class="lede">${esc(H[2])}</div>`;
    body.innerHTML = ({ property: propertyHTML, connect: connectHTML, around: aroundHTML, nearby: () => `<div id="list2">${listHTML()}</div>`, twin: twinHTML, sources: sourcesHTML }[S.tab])();
  }
  body.scrollTop = 0;
  body.onclick = panelClick; body.oninput = panelInput;
  const v = $("#viewer"); if (v) mountViewer(v, v.dataset.context === "1"); else if (viewer) viewer.dispose();
}
function setFull(on) {
  const v = $("#viewer"); if (!v) return;
  v.classList.toggle("full", on);
  if (on && !v.querySelector(".vx")) { v.insertAdjacentHTML("beforeend", `<button class="vx act" type="button">Close full screen</button>`); v.querySelector(".vx").onclick = () => setFull(false); }
  if (!on) { const x = v.querySelector(".vx"); if (x) x.remove(); }
}
addEventListener("keydown", (e) => { if (e.key === "Escape") setFull(false); });
function panelClick(e) {
  if (e.target.closest("#vfull")) return setFull(true);
  if (e.target.closest("#realsat")) {
    S.realSat = !S.realSat; if (viewer && viewer.setSat) viewer.setSat(S.realSat);
    const b = $("#realsat"); b.classList.toggle("pri", S.realSat); b.textContent = `Real satellite on the ground and roofs: ${S.realSat ? "on" : "off"}`;
    return;
  }
  const id = e.target.closest("[data-id]"); if (id) return select(id.dataset.id);
  const tab = e.target.closest("[data-go]"); if (tab) return goTab(tab.dataset.go);
  if (e.target.closest("[data-back]")) return select(null);
  const k = e.target.closest("[data-show]");
  if (k) { S.kinds = new Set([k.dataset.show]); S.layers[k.dataset.show] = true; renderFilters(); renderList(); renderLayers(); applyLayers(); if (PHONE()) goTab("nearby"); }
}
function panelInput(e) {
  if (e.target.id !== "rot") return;
  S.bearing = +e.target.value; $("#rot-v").textContent = `${S.bearing}°`;
  try { localStorage.setItem("sky-bearing", String(S.bearing)); } catch (err) {}
  if (map) { map.triggerRepaint(); frame(false); }
}

const kpi = (l, v, s, lead) => `<div class="kpi${lead ? " lead" : ""}"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`;
function propertyHTML() {
  const dnd = ANCHORS.find(a => /DND/i.test(a.name)), air = ANCHORS.find(a => /IGI/i.test(a.name)), cp = ANCHORS.find(a => /Connaught/i.test(a.name));
  const s18 = STATIONS.find(s => /Sector 18/.test(s.name));
  const cw = within(OUTER, "cowork"), co = within(OUTER, "corp"), rs = within(3, "res");
  return `<div class="hero" id="viewer"><img src="./renders/${esc(MD.renders[0][0])}" alt="F1 Skymark, rendered from the 3D twin"><span class="ph">Loading the 3D twin</span></div>
  <div class="kpis">
    ${kpi("Nearest metro", fmtKm(NEAR_ST.d), `${NEAR_ST.name}, ${NEAR_ST.lineName}; ${reach(NEAR_ST.d)}`, true)}
    ${kpi("Building", MD.floors, "Single tower with basement parking (developer)")}
    ${kpi("Plot", "2,940 sq m", "Plot No. F-01, Sector 6 (developer)")}
    ${dnd ? kpi("DND Flyway", fmtKm(dnd.d), `To Delhi; ${reach(dnd.d)}`) : ""}
    ${s18 ? kpi("Sector 18", fmtKm(s18.d), `Noida's retail centre; ${reach(s18.d)}`) : ""}
    ${air ? kpi("IGI Airport T3", fmtKm(air.d), `${reach(air.d)}, off-peak estimate`) : ""}
  </div>
  <div class="read"><b class="h">The location in four lines</b><ul>
    <li><b>Metro on foot:</b> ${esc(NEAR_ST.name)} on the ${esc(NEAR_ST.lineName)} is ${fmtKm(NEAR_ST.d)} away in a straight line, ${reach(NEAR_ST.d)}.</li>
    <li><b>Delhi side of Noida:</b> ${dnd ? `the DND Flyway is ${fmtKm(dnd.d)} away` : "close to the DND Flyway"}${cp ? ` and Connaught Place ${fmtKm(cp.d)}` : ""}, so teams from East and South Delhi reach it without crossing Noida.</li>
    <li><b>An established office pocket:</b> ${co.length} employers and ${cw.length} coworking spaces are mapped within ${OUTER} km${co[0] ? `; the nearest is ${esc(co[0].name)} at ${fmtKm(co[0].d)}` : ""}.</li>
    <li><b>Homes close by:</b> ${rs.length} residential areas within 3 km${rs[0] ? `, the nearest ${esc(rs[0].name)} at ${fmtKm(rs[0].d)}` : ""}.</li>
  </ul></div>
  <div class="actions"><button class="act" data-go="connect">See connectivity</button><button class="act" data-go="around">See what is around</button><button class="act" data-go="twin">About the 3D twin</button></div>
  <h3>What is published about the building</h3>
  <table class="spec">${PR.facts.map(f => `<tr><th>${esc(f.k)}</th><td>${esc(f.v)}<div class="src">${cite(f.src)}</div></td></tr>`).join("")}</table>
  <div class="flag"><b>Check before quoting</b>Sources disagree on the leasable area (45,000 sq ft on Autopilot's listing, 90,551 sq ft on the developer's page) and on the plot number some listings use. Each figure above is shown with its own source.</div>
  <h3>Where the pin is</h3>
  <p class="note"><span class="prec ${esc(PR.precision)}">${esc(PR.precision)} level</span> · ${PR.lat.toFixed(6)}, ${PR.lng.toFixed(6)} · ${cite(PR.geoSrc)}</p>
  <p class="note">${esc(PR.geoNote)}</p>`;
}
function barRows(items, color, max) {
  return `<div class="bars">${items.map(s => `<div class="bar" data-id="${esc(s.id)}"><span class="nm">${esc(s.name)}${s.lineName ? ` <span class="src">${esc(s.lineName)}</span>` : ""}</span>`
    + `<span class="tr"><span class="fl" style="display:block;width:${Math.max(3, Math.round(s.d / max * 100))}%;background:${s.color || color}"></span></span><span class="val">${fmtKm(s.d)} · ${reach(s.d).replace("about ", "")}</span></div>`).join("")}</div>`;
}
function connectHTML() {
  const st = STATIONS, mx = Math.max(...st.map(s => s.d));
  const inter = STATIONS.filter(s => /Botanical/.test(s.name)).sort((a, b) => a.d - b.d)[0];
  return `<div class="kpis">
    ${kpi("Nearest station", fmtKm(NEAR_ST.d), `${NEAR_ST.name}; ${reach(NEAR_ST.d)}`, true)}
    ${kpi("Stations within 3 km", String(st.filter(s => s.d <= 3).length), st.filter(s => s.d <= 3).map(s => s.name.replace("Noida ", "")).join(", "))}
    ${inter ? kpi("Blue / Magenta interchange", fmtKm(inter.d), `${inter.name}; ${reach(inter.d)}`) : ""}
  </div>
  <h3>Metro stations, nearest first</h3>${barRows(st, "#2b6cb0", mx)}
  <p class="note">Lines are drawn station to station, not along the track. Station positions are from each station's Wikipedia page.</p>
  <h3>The city from here</h3>${barRows(ANCHORS, "#2a1e16", Math.max(...ANCHORS.map(a => a.d)))}
  <p class="note">${esc(M.method)} Drive times use ${M.speed.kmh} km/h on a road ${M.speed.factor} times the straight line (${esc(M.speed.note)}); walks use ${esc(M.walk.note)}.</p>
  <div class="flag"><b>Listings get this wrong</b>${esc(fact("Nearest metro") || "Some listings name Botanical Garden as the nearest metro. Noida Sector 15 is nearer.")}</div>`;
}
function aroundHTML() {
  const rows = KINDS.map(k => {
    const c = RINGS.map(r => within(r.km, k.key).length), near = PLACES.find(p => p.kind === k.key);
    return `<tr data-show="${k.key}"><td><span class="k"><span class="dot" style="background:${k.color}"></span>${esc(k.label)}</span></td>${c.map(n => `<td class="n">${n}</td>`).join("")}<td>${near ? `${esc(near.name)} <span class="src">${fmtKm(near.d)}</span>` : "none mapped"}</td></tr>`;
  }).join("");
  const top = (k, n = 5) => PLACES.filter(p => p.kind === k).slice(0, n);
  return `<div class="cnt">${RINGS.map(r => `<div><b>${within(r.km).length}</b>places within ${r.km} km</div>`).join("")}<div><b>${STATIONS.filter(s => s.d <= OUTER).length}</b>metro stations within ${OUTER} km</div></div>
  <h3>By ring</h3>
  <table class="rt"><thead><tr><th></th>${RINGS.map(r => `<th class="n">≤ ${r.km} km</th>`).join("")}<th>Nearest</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="note">Counts are cumulative. Tap a row to list that kind and show it on the map. These are the places this study mapped and sourced, not a census of the area.</p>
  ${KINDS.map(k => { const t = top(k.key); return t.length ? `<h3><span class="dot" style="background:${k.color};margin-right:6px"></span>${esc(k.label)} · ${esc(k.hint)}</h3>${barRows(t, k.color, OUTER)}` : ""; }).join("")}`;
}
function twinHTML() {
  return `<div class="hero" id="viewer" data-context="1"><img src="./renders/${esc(MD.renders[0][0])}" alt="F1 Skymark, rendered from the 3D twin"><span class="ph">Loading the 3D twin</span></div>
  <div class="kpis">${kpi("Front", `${MD.widthM} m`, "From the photo's proportions", true)}${kpi("Side", `${MD.lengthM} m`, "From the photo's proportions")}${kpi("Height", `${MD.heightM} m`, `${MD.floors} at an assumed ${MD.floorToFloorM} m a floor`)}</div>
  <div class="actions"><button class="act" id="vfull" type="button">Full screen</button><button class="act${S.realSat ? " pri" : ""}" id="realsat" type="button">${S.realSat ? "Real satellite on the ground and roofs: on" : "Real satellite on the ground and roofs: off"}</button></div>
  <p class="note">The ground, streets, parks and roofs round the building carry the real Mapbox satellite photo. The walls of the surrounding blocks are painted in the Andheri world's styles: no open source has photographs of every wall. The footprints and streets are real (Overture Maps); heights come from the Copernicus surface model. Imagery © Mapbox © Maxar.</p>
  <div class="flag"><b>What this model is</b>${esc(MD.basis)} The back and the far side are not in the photograph and are plain walls in the model. One measured length on site would fix the scale of everything.</div>
  <h3>Where it stands</h3>
  <p class="note">${esc(MD.bearingNote)}</p>
  <p class="note"><label for="rot">Rotate: the front faces <b id="rot-v">${S.bearing}°</b> from north</label><br><input id="rot" type="range" min="0" max="355" step="5" value="${S.bearing}" style="width:100%"></p>
  <h3>Stills</h3>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${MD.renders.map(([f, cap]) => `<figure style="margin:0"><img src="./renders/${esc(f)}" data-zoom="./renders/${esc(f)}" alt="${esc(cap)}" loading="lazy" style="width:100%;border-radius:9px;display:block;cursor:zoom-in;aspect-ratio:4/3;object-fit:cover"><figcaption class="src" style="margin-top:3px">${esc(cap)}</figcaption></figure>`).join("")}</div>
  <h3>Files</h3>
  <ul class="srcs"><li><a href="${esc(MD.glb)}" download>fm_skymark_atlas.glb</a><span class="src">The building (glTF binary, metres, PBR materials, one group per facade)</span></li>
  <li><a href="${esc(MD.contextGlb)}" download>fm_skymark_context_500m.glb</a><span class="src">The 500 m round it, in the same frame</span></li>
  <li><a href="${esc(MD.blend)}" download>fm_skymark_final.blend</a><span class="src">The editable Blender file</span></li>
  <li><a href="${esc(MD.report)}" target="_blank" rel="noopener">validation_report.json</a><span class="src">What matches the photograph, what does not, and how sure each part is</span></li>
  <li><a href="${esc(MD.params)}" target="_blank" rel="noopener">facade_parameters.json</a><span class="src">Every dimension with its source and confidence</span></li></ul>`;
}
function sourcesHTML() {
  const grp = (title, items) => `<h3>${esc(title)}</h3><ul class="srcs">${items.map(i => `<li data-id="${esc(i.id || "")}"><b>${esc(i.name)}</b>${i.sub ? ` · ${esc(i.sub)}` : ""}<span class="src">${i.precision ? `${esc(i.precision)} level · ` : ""}${cite(i.src) || esc(i.src || "")}</span></li>`).join("")}</ul>`;
  return `<p class="note">${esc(M.method)}</p>
  ${grp("Metro stations", STATIONS)}${grp("City anchors", ANCHORS)}${KINDS.map(k => grp(k.label, PLACES.filter(p => p.kind === k.key))).join("")}
  <h3>Open points</h3><ul class="srcs">${M.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`;
}
function placeHead(it) {
  const k = it.type === "place" ? KIND[it.kind] : null;
  const label = k ? k.one : it.type === "station" ? `Metro station · ${it.lineName}` : "City anchor";
  return `<button class="act" data-back style="margin-bottom:8px">‹ Back to the property</button><div class="eyebrow">${esc(label)}</div><h2>${esc(it.name)}</h2><div class="lede">${esc(it.sub || "")}</div>`;
}
function placeBody(it) {
  const same = it.type === "place" ? PLACES.filter(p => p.kind === it.kind && p.id !== it.id).slice(0, 5) : it.type === "station" ? STATIONS.filter(s => s.id !== it.id).slice(0, 5) : ANCHORS.filter(a => a.id !== it.id).slice(0, 5);
  return `<div class="kpis">${kpi("From F1 Skymark", fmtKm(it.d), "Straight line", true)}${kpi("On foot", `${walkMin(it.d)} min`, "Estimate from the line")}${kpi("By road", `${driveMin(it.d)} min`, "Estimate from the line")}</div>
  <p class="note" style="margin-top:12px">${it.precision ? `<span class="prec ${esc(it.precision)}">${esc(it.precision)} level</span> · ` : ""}${it.lat.toFixed(5)}, ${it.lng.toFixed(5)} · ${cite(it.src) || esc(it.src || "")}</p>
  <p class="note">${esc(M.method)}</p>
  ${same.length ? `<h3>Others of this kind, nearest first</h3>${barRows(same, it.type === "place" ? KIND[it.kind].color : "#2a1e16", Math.max(...same.map(s => s.d)))}` : ""}`;
}
/* The phone's Nearby tab renders the list inside the panel. */
document.addEventListener("click", (e) => { const b = e.target.closest("#list2 [data-id]"); if (b) select(b.dataset.id); });

initGate();
