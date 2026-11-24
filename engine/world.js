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
import {createSceneLighting} from "./andheri-scene-lighting.js";
import {createWorldLayouts} from "./andheri-world-layouts.js";
import { applyAndheriTheme, easyTabs, propertySpotlight } from "./andheri-ui.js";
import { createDataLayer } from "./world-data.js";
import { premiumLoader } from "./world-loader.js";
import { andheriExperience, applyCanonicalFacts } from "./andheri-experience.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const Q = new URLSearchParams(location.search);
const MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const STILL = Q.get("still") === "1";
const REALISM_IDS=new Set(["723-avenue","privilon"]);
/* The look: "real" (default) reads as a photograph of the place: no tilt-shift,
   a 35 mm lens from drone height, sky and haze behind, ground to the horizon,
   relief in the facades. ?look=model brings back the architect's-model look
   (tilt-shift, a high turntable, the slab floating on the page). */
const REALLOOK = Q.get("look") !== "model";   // the photographic look is the default; ?look=model brings back the plain model look
const SLUG = ((Q.get("atlas") || location.pathname.split("/")[1] || "") + "").toLowerCase().replace(/[^a-z0-9-]/g, "");
/* the Andheri look (theme, tabs, yellow accent) is a UI choice, separate from the Flipkart-only content (film, shortlist, CAD): an atlas opts in with meta.world.ui = "andheri" */
const AUI = (W) => W.branding === "autopilot-flipkart" || W.ui === "andheri";
const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* 50 mm on a 36x24 mm frame: the lens that matches the human eye. Vertical field of view in degrees. */
const EYE_FOV = 2 * Math.atan(12 / 50) * 180 / Math.PI;
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
  if(AUI(W))applyAndheriTheme("world", W.branding === "autopilot-flipkart" ? "" : W.client);
  if(W.branding==="autopilot-flipkart")applyCanonicalFacts(A.options);
  document.title = `${A.meta.title} · Explorer`;
  /* the loader names this atlas the moment its data is known, never another client's name */
  { const lt = $("#l-title"); if (lt && W.branding !== "autopilot-flipkart") lt.textContent = (W.brand && W.brand.title) || A.meta.title; }
  /* W.ver: a hash of the atlas's world media (models, textures, sky, stills), written by its build-data script. The
     media are cached for a while (vercel.json), so every URL carries it: a rebuild is a new URL, never a stale copy. */
  const MV = W.ver ? "?v=" + encodeURIComponent(W.ver) : "";
  const poster = W.branding === "autopilot-flipkart" && W.thumbs?.[location.hash.slice(1)] || W.poster;
  if (poster) for (const id of ["#load", "#gate"]) $(id).style.backgroundImage = `url("${W.data}${poster}${MV}")`;
  if (W.loader && W.branding !== "autopilot-flipkart") premiumLoader({ slides: W.loader.slides || [], stages: W.loader.stages, data: W.data, ver: W.ver ? "?v=" + encodeURIComponent(W.ver) : "" });
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
  if(W.branding==='autopilot-flipkart' && window.MAPBOX_TOKEN && Q.get('map')!=='0') {
    const credits=document.createElement('div');credits.id='map-credits';
    credits.setAttribute('aria-label','Map imagery attribution');
    credits.innerHTML='<a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener"><img src="/media/flipkart-andheri/brand/mapbox-logo.svg" alt="Mapbox" width="76" height="20"></a><span><a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://www.maxar.com/" target="_blank" rel="noopener">© Maxar</a> <a href="https://www.mapbox.com/contribute/" target="_blank" rel="noopener" aria-label="Improve this map" title="Improve this map">↗</a></span>';
    document.body.append(credits);
  }
  const options=A.options.filter(o=>!W.thumbs||W.thumbs[o.id]);
  const first=options.find(o=>o.id===location.hash.slice(1))||options[0];
  const intro=W.branding==="autopilot-flipkart"?andheriExperience({options,first:first?.id}):null;
  start(A, W, intro).catch((e) => { console.error(e); fail("The explorer could not load: " + e.message); });
}

/* -------------------------------------------------------------- world ---- */
async function start(A, W, intro=null) {
  const MV = W.ver ? "?v=" + encodeURIComponent(W.ver) : "";   // the world media's version (see boot)
  if(W.contexts || W.cad)document.body.classList.add('project-tools');
  if(W.mapHref)$("#to-map").href=W.mapHref;
  const canvas = $("#c");
  let wakeUntil = 0; const wake = (ms = 1200) => { wakeUntil = Math.max(wakeUntil, performance.now() + ms); };
  for (const ev of ["pointerdown", "pointermove", "wheel", "keydown", "keyup", "touchstart", "touchmove", "input", "change", "click"]) addEventListener(ev, () => wake(), { passive: true, capture: true });
  // the Flipkart Andheri explorer opens on the re-modelled buildings (d-preview: new Privilon, Corporate Avenue's tower)
  // unless ?preview= names others; ?preview=none shows the older district models
  const defaultPreview = W.branding === "autopilot-flipkart" ? "privilon,corporate-avenue,723-avenue" : "";
  const previewIds = new Set(((Q.get("preview") ?? defaultPreview) === "none" ? "" : (Q.get("preview") ?? defaultPreview)).split(",").filter(Boolean));
  const realismFor = id => W.branding === "autopilot-flipkart" && REALISM_IDS.has(id) &&
    (W.models?.[id]?.aoBase || previewIds.has(id));
  let lightingBuilder=null,worldLayouts=null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  /* Quality tiers. The pixel ratio is capped at 1.5 (a 2x screen at 2 draws 78% more pixels for little visible gain
     on a city seen from 300 m), and the explorer steps down a tier while frames run slow (adapt(), in the loop):
     0 the full look, 1 a lower pixel ratio, 2 no ambient occlusion and 2x MSAA at pixel ratio 1, 3 no MSAA below 1
     for very weak GPUs (4x MSAA on the half-float target is about 30% of a frame once the trees are culled).
     ?q=low starts at 2, ?dpr= forces a ratio, ?adapt=0 holds the starting tier. */
  const DPR = devicePixelRatio || 1;
  const TIERS = [{ dpr: Math.min(DPR, 1.5), ao: true, msaa: 4 }, { dpr: Math.min(DPR, 1.25), ao: true, msaa: 4 }, { dpr: Math.min(DPR, 1), ao: false, msaa: 2 }, { dpr: Math.min(DPR, 0.8), ao: false, msaa: 0 }];
  let tier = MOBILE || Q.get("q") === "low" ? 2 : 0;
  try { const saved = +sessionStorage.getItem("atlas-world-tier"); if (saved > tier && saved < TIERS.length) tier = saved; } catch (e) {}
  if (Q.has("dpr")) TIERS.forEach((t) => (t.dpr = +Q.get("dpr") || 1));
  renderer.setPixelRatio(TIERS[tier].dpr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  if (previewIds.size || Object.values(W.models || {}).some(model => model.aoBase) || W.tone === "agx") {
    renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.05;
  }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /* The shadow map is redrawn only when something that casts or receives a shadow moves: the sun, the shadow box
     (sunBox), a new diorama. Cars, people and trains do not cast (at 300 m they are a few pixels). Trees cast from
     per-cell copies on layer 1, which only the sun's camera sees (buildForest). */
  renderer.shadowMap.autoUpdate = false; let shadowDirty = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.3, 6000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.maxPolarAngle = 76 * D2R; controls.minPolarAngle = 18 * D2R;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.35; controls.zoomSpeed = 0.9;
  controls.addEventListener("start", () => { controls.autoRotate = false; });
  controls.addEventListener("end", () => wake(1500));   // orbit damping eases on after the pointer is let go

  /* Models: the chosen option's diorama starts downloading now, alongside the sky, instead of after it; the
     other options are fetched once the first is on screen, in idle time (only for atlases of up to six plain
     models), so switching parses from memory instead of waiting on the network. */
  const prefetched = new Map();
  const plainModel = (id) => !W.models?.[id] && !(W.branding === "autopilot-flipkart");
  function prefetch(id) {
    if (!plainModel(id) || prefetched.has(id)) return prefetched.get(id);
    const p = Promise.all([fetch(`${W.data}d/${id}.glb${MV}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }), fetch(`${W.data}d/${id}.json${MV}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })]).catch(() => { prefetched.delete(id); return null; });
    prefetched.set(id, p); return p;
  }
  { const opts0 = A.options.filter((o) => !W.thumbs || W.thumbs[o.id]); const f0 = opts0.find((o) => o.id === location.hash.slice(1)) || opts0[0]; if (f0) prefetch(f0.id); }
  /* the Blender sky: lighting and reflections; the background only when walking */
  const hdr = await new RGBELoader().loadAsync(W.data + W.sky + MV);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer); const env = pmrem.fromEquirectangular(hdr).texture;
  scene.environment = env; scene.environmentIntensity = REALLOOK ? 0.75 : 0.55;
  /* real look: the ground runs on past the slab to the horizon, under the haze */
  const farGround = new THREE.Mesh(new THREE.CircleGeometry(6000, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8c8476, roughness: 1 }));
  farGround.position.y = -0.04; farGround.receiveShadow = true; farGround.visible = REALLOOK; scene.add(farGround);
  /* the sun the sky was rendered with: azimuth 235, elevation 24 (golden afternoon) */
  const SUN = new THREE.Vector3(Math.sin(235 * D2R) * Math.cos(24 * D2R), Math.sin(24 * D2R), -Math.cos(235 * D2R) * Math.cos(24 * D2R)).normalize();
  const sun = new THREE.DirectionalLight(0xffe6c4, 3.1); sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 2048 : 4096, MOBILE ? 2048 : 4096); sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.6; sun.shadow.radius = 2.5;
  sun.shadow.camera.layers.enable(1);
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight(0xcfe0f0, 0x6b6253, 0.35); scene.add(fill);

  /* textures, loaded once and shared by every diorama */
  const texL = new THREE.TextureLoader(); const TEX = {},textureJobs=[]; const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (name, srgb = true) => TEX[name] || (TEX[name] = (() => { let ready;const done=new Promise(resolve=>ready=resolve);textureJobs.push(done);const t = texL.load(W.data + "tex/" + name + (name.startsWith("leaves") ? ".png" : ".jpg") + MV,()=>{ready(true);wake();},undefined,()=>{t.userData.failed=true;ready(false);}); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; return t; })());
  const GLASSY = new Set(["wall_com_glass", "wall_opt_glass", "wall_com_ribbon", "wall_opt_plaster", "wall_res_tower", "wall_glass723", "wall_retail723", "wall_cw_teal", "wall_cw_blue", "wall_cw_grey", "wall_cw_silver", "wall_ribbon_red", "wall_ribbon_white"]);
  const MAT = {};
  /* The modelled properties (scripts/world/hero_building.py) and the premium ground: PBR sets from tex/ by name,
     NAME.jpg (colour), NAME_r.jpg (roughness), NAME_n.jpg (normal), made by scripts/world/hero_textures.py.
     [texture, metalness, normal scale, env intensity, extra] */
  const HERO = {
    hero_glass: ["hero_glass", 0.22, 0.25, 1.1], hero_spandrel: ["hero_spandrel", 0.3, 0.3, 1.0], hero_alu: ["hero_alu", 0.65, 0.6, 1.2],
    hero_stone: ["hero_stone", 0, 0.8, 0.8], hero_concrete: ["hero_concrete", 0, 0.7, 0.7], hero_roof: ["hero_roof", 0, 0.5, 0.6],
    hero_pavers: ["hero_pavers", 0, 0.9, 0.6], hero_asphalt: ["hero_asphalt", 0, 0.6, 0.5], hero_lawn: ["hero_lawn", 0, 0.8, 0.5],
    hero_mulch: ["hero_mulch", 0, 0.8, 0.4], hero_hedge: ["leaves_shrub", 0, 0, 0.5], ground_noida: ["ground_noida", 0, 0.6, 0.5],
    hero_plaster: ["hero_plaster", 0, 0.5, 0.6], hero_plaster_b: ["hero_plaster_b", 0, 0.5, 0.6], hero_bark: ["hero_bark", 0, 0.8, 0.4],
    /* the four JindalX buildings as imagery shows them (docs/JINDALX_VERIFICATION.md): composite panels, tinted glass, cream and white render */
    hero_acp_white: ["hero_acp_white", 0.5, 0.45, 1.2], hero_acp_charcoal: ["hero_acp_charcoal", 0.55, 0.45, 1.2], hero_acp_copper: ["hero_acp_copper", 0.6, 0.45, 1.25], hero_acp_grey: ["hero_acp_grey", 0.55, 0.45, 1.2],
    hero_glass_dark: ["hero_glass_dark", 0.22, 0.25, 1.15], hero_glass_bluegrey: ["hero_glass_bluegrey", 0.22, 0.25, 1.15], hero_glass_green: ["hero_glass_green", 0.22, 0.25, 1.15], hero_glass_teal: ["hero_glass_teal", 0.2, 0.25, 1.1],
    hero_plaster_cream: ["hero_plaster_cream", 0, 0.5, 0.6], hero_plaster_white: ["hero_plaster_white", 0, 0.5, 0.6],
  };
  const HERO_FLAT = { hero_mullion: [0x2e3236, 0.35, 0.8], hero_hvac: [0xb8bcbe, 0.45, 0.6], hero_solar: [0x1c2a44, 0.14, 0.35], hero_dark: [0x121416, 0.9, 0], hero_rail: [0x2a2c2e, 0.4, 0.8] };
  function material(name) {
    if (MAT[name]) return MAT[name];
    let m;
    if (HERO[name]) {
      const [t, metal, ns, env] = HERO[name], png = t.startsWith("leaves");
      m = new THREE.MeshStandardMaterial({ map: tex(t), roughnessMap: png ? null : tex(t + "_r", false), roughness: png ? 0.9 : 1, metalness: metal, envMapIntensity: env });
      if (ns && !png) { m.normalMap = tex(t + "_n", false); m.normalScale = new THREE.Vector2(ns, ns); }
      m.name = name; return (MAT[name] = m);
    }
    if (HERO_FLAT[name]) { const [c, r, mt] = HERO_FLAT[name]; m = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt }); m.name = name; return (MAT[name] = m); }
    if (name === "hero_lobby_glass") { m = new THREE.MeshStandardMaterial({ color: 0x9cb4bc, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.26, depthWrite: false, envMapIntensity: 1.4 }); m.name = name; return (MAT[name] = m); }
    if (name.startsWith("wall_")) {
      const k = name.slice(5);
      m = new THREE.MeshStandardMaterial({ map: tex(k), roughnessMap: tex(k + "_r", false), roughness: 1, metalness: 0, envMapIntensity: GLASSY.has(name) && REALLOOK ? 1.7 : 1 });
      if (REALLOOK) { m.normalMap = tex(k + "_n", false); m.normalScale = new THREE.Vector2(0.9, 0.9); }   // relief from scripts/world/normals.py
      if (GLASSY.has(name)) m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n metalnessFactor = 1.0 - smoothstep(0.22, 0.5, roughnessFactor);"); };
    } else {
      const C = {
        roof: [0xffffff, 0.92, 0, "roof"], ground: [0xd8d2c6, 0.95, 0, "roof"], asphalt: [0xffffff, 0.86, 0, "asphalt"], pavers: [0xffffff, 0.9, 0, "pavers"], grass: [0xffffff, 0.96, 0, "grass"], soil: [0xffffff, 1, 0, "soil"],
        parapet: [0xcfc8b8, 0.9], kerb: [0xbdb8ab, 0.85], water: [0x3b4f54, 0.06, 0.2], marking: [0xeeeee6, 0.6], concrete: [0xcac6bc, 0.78], concrete_dark: [0x9f9b92, 0.82], metal: [0xa9adb1, 0.35, 0.9],
        station_roof: [0xdadde0, 0.28, 0.85], sign_l1: [0x1c5fa8, 0.4], sign_l3: [0x1d8a8a, 0.4], rail: [0x77716a, 0.35, 0.9], tank: [0x1d1f22, 0.5], mullion: [0xc4c9cc, 0.28, 0.9], slab_edge: [0xe8e5de, 0.6],
        glass_lobby: [0x4e6a76, 0.04, 0.75], canopy: [0x2b2e31, 0.4, 0.6], wire: [0x333333, 0.5, 0.8], ballast: [0x7d7568, 0.95], roof_tin: [0x8f8f8a, 0.42, 0.6], roof_tarp: [0x2f63a8, 0.6], roof_tin_rust: [0x7a5b45, 0.7, 0.3],
        trunk: [0x5b4a3b, 0.9], leaf: [0xffffff, 0.8], leaf_b: [0xffffff, 0.8], frond: [0x5a8735, 0.75], lamp_head: [0xe6e2d6, 0.4], car_body: [0xffffff, 0.22, 0.55], car_glass: [0x1a2026, 0.04, 0.6], tyre: [0x161616, 0.9], hub: [0xb9bcbf, 0.3, 0.9], trim: [0x202224, 0.5, 0.3],
        lamp_front: [0xfff6e0, 0.2], lamp_rear: [0xa01010, 0.3], person_trousers: [0x2b3240, 0.85], person_shirt: [0xffffff, 0.8], person_skin: [0x8a5a3c, 0.6], person_hair: [0x15110e, 0.7],
        fin_723: [0x3d4752, 0.45, 0.35], pier_723: [0x32373d, 0.5, 0.3], band_723: [0xc8cbcd, 0.55, 0.15], frame_723: [0xd9dcde, 0.35, 0.7], acp_grey: [0xb8bcbf, 0.4, 0.55], acp_red: [0xad322c, 0.42, 0.35], acp_white: [0xe7e7e3, 0.45, 0.25], fin_white: [0xecebe7, 0.5, 0.1],   /* House of Wadhwa 723 Avenue */
        pier_blue: [0x3f78a6, 0.6, 0.1], roof_blue: [0x2f6fb0, 0.5, 0.3], acp_station: [0xd7dadb, 0.45, 0.4], ad_red: [0xb8322a, 0.5], ad_yellow: [0xe2b42c, 0.5], ad_blue: [0x1f4f9a, 0.5], ad_white: [0xefefea, 0.5],   /* Line 1 stations, from Street View of Marol Naka */
        deck_wood: [0x8a6a4a, 0.7], pave_dark: [0x2c2e31, 0.6], pave_light: [0xd9d6cf, 0.6], planter: [0x5a4a3c, 0.8], soil_green: [0x3f5f2a, 0.95], fin_timber: [0xb36a2c, 0.6], canopy_leaf: [0x3c6a2c, 0.9], rail_glass: [0x9fb8c2, 0.05, 0.2],   /* 723 roof garden, from the brochure */
        gate_pillar: [0xd8d4ca, 0.6], boom: [0xd23b2c, 0.4], cabin: [0xe9e6de, 0.6],   /* Corporate Avenue campus */
        lobby_floor: [0xd9d3c7, 0.18], lobby_stone: [0x26272a, 0.25], lobby_ceiling: [0xefede8, 0.8], door_metal: [0x2a2c2e, 0.35, 0.8], granite: [0x5d5b58, 0.45], planter: [0x5a4a3c, 0.8],   /* 723 lobby, from the brochure */
        auto_body: [0x2d7d3a, 0.4, 0.2], auto_top: [0xf0c22e, 0.5], bus_body: [0xb8322a, 0.4, 0.3], train_body: [0xeef1f4, 0.25, 0.45], train_win: [0x1e2832, 0.05, 0.6], train_stripe: [0x1c5fa8, 0.35],
      }[name] || [0x9a9a9a, 0.8];
      m = new THREE.MeshStandardMaterial({ color: C[0], roughness: C[1], metalness: C[2] || 0 });
      if (name === "ground" && W.groundTex) C[3] = W.groundTex, C[0] = 0xffffff;   // an atlas's own open-ground texture (JindalX: ground_noida)
      if (C[3]) { m.map = tex(C[3]); if (REALLOOK) { m.normalMap = tex(C[3] + "_n", false); m.normalScale = new THREE.Vector2(0.6, 0.6); } }
      if (name === "rail_glass") Object.assign(m, { transparent: true, opacity: 0.3, depthWrite: false });
      if (name === "station_glass") Object.assign(m, { color: new THREE.Color(0x9cc0cf), roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false });
      if (name === "lobby_light") Object.assign(m, { color: new THREE.Color(0xfff4e0), emissive: new THREE.Color(0xfff1d6), emissiveIntensity: 1.6 });
      if (name === "sign_text" || name === "opt_name") Object.assign(m, { color: new THREE.Color(0xffffff), emissive: new THREE.Color(name === "opt_name" ? 0xfff2da : 0xffffff), emissiveIntensity: 0.55, roughness: 0.4 });
      const leafCard = /^leaf(_[a-z]+)?$/.test(name);   // leaf, leaf_b, leaf_palm, leaf_shrub, leaf_bloom: cut-out cards
      if (leafCard) Object.assign(m, { color: new THREE.Color(0xffffff), map: tex(name === "leaf" ? "leaves_a" : name === "leaf_b" ? "leaves_b" : "leaves_" + name.slice(5)), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78 });
      if (leafCard || name === "frond") m.onBeforeCompile = (sh) => {   // colour drifts across a crown, as in the stills (instanced trees and the plot's own shrubs)
        sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n#ifdef USE_INSTANCING\n vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif");
        sh.fragmentShader = "varying vec3 vWp;\n" + sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n float nz = sin(vWp.x * 0.9) * sin(vWp.z * 1.1 + vWp.y * 0.7) * 0.5 + 0.5; diffuseColor.rgb *= mix(vec3(0.72, 0.82, 0.62), vec3(1.25, 1.18, 0.95), nz);");
      };
    }
    m.name = name; return (MAT[name] = m);
  }

  /* -------------------------------------------------------- post ---- */
  const LOW = MOBILE || Q.get("q") === "low";
  const MSAA_OK = !(LOW || Q.get("msaa") === "0");
  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: MSAA_OK ? TIERS[tier].msaa : 0, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.output = GTAOPass.OUTPUT.Default;
  gtao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.4, thickness: 6, scale: 1.2, samples: 16 }); gtao.blendIntensity = REALLOOK ? 0.5 : 0.9;
  /* GTAO at half resolution: ambient occlusion is soft, low-frequency shading, and its normal pass, sampling and
     denoise cost scale with pixels (a quarter of them here). The result is blended over the full-resolution frame. */
  const gtaoSetSize = GTAOPass.prototype.setSize;
  gtao.setSize = (w, h) => gtaoSetSize.call(gtao, Math.max(1, Math.round(w * 0.5)), Math.max(1, Math.round(h * 0.5)));
  gtao.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
  const AO_ALLOWED = !LOW && Q.get("ao") !== "0";
  if (AO_ALLOWED) composer.addPass(gtao);
  gtao.enabled = AO_ALLOWED && TIERS[tier].ao;
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

  /* ------------------------------------------------ reflections ---- */
  /* glass reflects the real street, not just the sky: a cube camera at the chosen building's middle
     photographs the diorama around it (with the building itself hidden), and every glass surface uses
     that picture as its reflection. Taken once per building, and again once its textures have arrived. */
  const probeRT = new THREE.WebGLCubeRenderTarget(LOW ? 256 : 512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const probe = new THREE.CubeCamera(1, 4000, probeRT);
  const REFLECTS = new Set([...GLASSY, "glass_lobby", "station_glass", "car_glass", "train_win", "water", "hero_glass", "hero_spandrel", "hero_lobby_glass", "hero_glass_dark", "hero_glass_bluegrey", "hero_glass_green", "hero_glass_teal", "hero_acp_white", "hero_acp_charcoal", "hero_acp_copper", "hero_acp_grey"]);
  function captureReflections() { try { captureReflections_(); } catch (e) { console.warn("reflections skipped", e); } }
  function captureReflections_() {
    if (areaMode || !REALLOOK || !D || !root || Q.get("refl") === "0") return;
    const hide = []; root.traverse((o) => { if (o.visible && o.name && (o.name.startsWith("opt_") || o.name.startsWith("sign_723"))) { o.visible = false; hide.push(o); } });
    const c = centroid(D.building.foot); probe.position.copy(P3(c[0], c[1], Math.max(12, D.building.h * 0.45)));
    const bg = scene.background, fog = scene.fog, bands_ = bands.map((b) => b.visible);
    scene.background = lightingBuilder?.sky||hdr; scene.fog = null; bands.forEach((b) => (b.visible = false));
    if (forest) forest.showAll(2);
    probe.update(renderer, scene); probeRT.texture.needsPMREMUpdate = true;
    if (forest) forest.update(camera, true);
    scene.background = bg; scene.fog = fog; bands.forEach((b, i) => (b.visible = bands_[i])); hide.forEach((o) => (o.visible = true));
    root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(/^ANDHERI_.*[Gg]lass/.test(m.name||'')){m.envMap=probeRT.texture;m.envMapIntensity=1.25;m.needsUpdate=true;}});
    for (const [n, m] of Object.entries(MAT)) if (REFLECTS.has(n) && m.envMap !== probeRT.texture) { m.envMap = probeRT.texture; m.envMapIntensity = n.startsWith("wall_") ? 1.9 : 1.4; m.needsUpdate = true; }
    root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.ao&&REFLECTS.has(m.name)){m.envMap=probeRT.texture;m.envMapIntensity=m.name.startsWith("wall_")?1.9:1.4;m.needsUpdate=true;}});   // AO-baked copies
  }
  /* baked ambient occlusion (scripts/world/diorama.py --bake-ao): <id>-ao.json names one map per mesh, on UV 1.
     Each baked mesh gets its own copies of its materials carrying its aoMap; the sun and shadows stay live. */
  async function applyBakedAO(id, base, revision, modelRoot) {
    const version=revision?'?v='+encodeURIComponent(revision):'';
    let J;try{const r=await fetch(base+id+'-ao.json'+version,{cache:'no-store'});if(!r.ok)return;J=await r.json();}catch{return;}
    const files=[...new Set(Object.values(J.maps||{}))],textures=new Map();
    await Promise.all(files.map(async file=>{try{const t=await new THREE.TextureLoader().loadAsync(base+file+version);t.channel=1;t.flipY=false;t.colorSpace=THREE.NoColorSpace;t.anisotropy=4;textures.set(file,t);}catch{console.warn('AO map unavailable:',file);}}));
    if(modelRoot!==root){for(const t of textures.values())t.dispose();return;}
    const requested=Number(Q.get('ao')),strength=Q.has('ao')?clamp(Number.isFinite(requested)?requested:1,0,1):realismFor(id)?.55:1;
    for(const t of textures.values())ownedTextures.add(t);
    let count=0;modelRoot.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.uv1)return;let file;for(let p=o;p&&!file;p=p.parent)file=J.maps?.[p.name];const ao=textures.get(file);if(!ao)return;
      const one=m=>{const copy=m.clone();ownedMaterials.add(copy);copy.aoMap=ao;copy.aoMapIntensity=realismFor(id)&&(REFLECTS.has(m.name)||/^ANDHERI_.*glass/i.test(m.name))?Math.min(strength,.25):strength;copy.userData.ao=true;copy.needsUpdate=true;return copy;};o.material=Array.isArray(o.material)?o.material.map(one):one(o.material);count++;
    });document.body.dataset.aoMeshes=String(count);
  }

  /* ------------------------------------------- the map beyond the model ---- */
  /* the model covers a few hundred metres round each building; past its edge the ground is the real map
     (Mapbox satellite with streets), so a route to a station 4 km away runs across Andheri, not empty haze */
  /* the region's origin: Andheri East unless the atlas names another (W.origin, W.ky), as the
     Noida explorer does (scripts/world/regions/*.json) */
  let [LNG0, LAT0] = W.origin || [72.867, 19.111], KX = Math.cos(LAT0 * D2R) * 111320;
  const KY = W.ky || 110540;
  /* an atlas whose buildings stand in different regions (JindalX: Sectors 3-9 and Sector 67) names each model's origin */
  const useOrigin = (id) => { const o = W.origins?.[id]; if (!o) return; [LNG0, LAT0] = o; KX = Math.cos(LAT0 * D2R) * 111320; };
  let mapGround = null;
  const aerialTextures = new Map();
  async function applyAerialSurfaces(modelRoot, data) {
    const aerial = data.modelReview?.photoReconstruction?.aerial;
    const token = window.MAPBOX_TOKEN;
    if (!aerial || !token || Q.get('map') === '0') return;
    const groups = new Map();
    modelRoot.traverse(o => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!/^ANDHERI_CTX_AERIAL_(?:DETAIL_)?(GROUND|ROOF)$/.test(m?.name || '')) continue;
        const source = m.name.includes('_DETAIL_') ? aerial.detail : aerial;
        if (!source) continue;
        if (!groups.has(source)) groups.set(source, new Set());
        groups.get(source).add(m);
      }
    });
    await Promise.all([...groups].map(async ([source, materials]) => {
      const bbox = source.bbox_wgs84;
      if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) return;
      const key = bbox.join(',');
      let pending = aerialTextures.get(key);
      if (!pending) {
        const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/[${key}]/1280x1280@2x.jpeg?padding=0&logo=false&attribution=false&access_token=${encodeURIComponent(token)}`;
        pending = texL.loadAsync(url).then(t => {
          t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
          t.channel = Number.isInteger(source.uv_channel) ? source.uv_channel : 0;
          t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
          return t;
        }).catch(() => { aerialTextures.delete(key); return null; });
        aerialTextures.set(key, pending);
      }
      const texture = await pending;
      if (!texture) { console.warn('Satellite detail unavailable; showing the source surface material.'); return; }
      for (const m of materials) {
        m.map = texture; m.color.setScalar(0.3);
        m.emissive.set(0xffffff); m.emissiveMap = texture; m.emissiveIntensity = 0.7;
        m.needsUpdate = true;
      }
    }));
  }
  function buildMapGround() {
    if (mapGround) { scene.remove(mapGround); mapGround.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); mapGround = null; }
    const tok = window.MAPBOX_TOKEN; if (!tok || !D || !D.origin || Q.get("map") === "0") return;
    const [ox, oy] = D.origin, Z = 15, N = 2 ** Z;
    const toLL = (x, y) => [LNG0 + (x + ox) / KX, LAT0 + (y + oy) / KY];
    const toXY = (lng, lat) => [(lng - LNG0) * KX - ox, (lat - LAT0) * KY - oy];
    const tx = (lng) => (lng + 180) / 360 * N, ty = (lat) => (1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2 * N;
    const lngOf = (x) => x / N * 360 - 180, latOf = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / N))) / D2R;
    // cover the model and every route from it, with a margin
    let x0 = -1600, x1 = 1600, y0 = -1600, y1 = 1600;
    for (const r of D.routes || []) for (const [x, y] of r.path) { x0 = Math.min(x0, x - 900); x1 = Math.max(x1, x + 900); y0 = Math.min(y0, y - 900); y1 = Math.max(y1, y + 900); }
    const [lA, bA] = toLL(x0, y0), [lB, bB] = toLL(x1, y1);
    const X0 = Math.floor(tx(lA)), X1 = Math.floor(tx(lB)), Y0 = Math.floor(ty(bB)), Y1 = Math.floor(ty(bA));
    if ((X1 - X0 + 1) * (Y1 - Y0 + 1) > 120) return;
    mapGround = new THREE.Group(); mapGround.name = "map_ground";
    for (let X = X0; X <= X1; X++) for (let Y = Y0; Y <= Y1; Y++) {
      const [ax, ay] = toXY(lngOf(X), latOf(Y)), [bx, by] = toXY(lngOf(X + 1), latOf(Y + 1));
      const t = texL.load(`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/${Z}/${X}/${Y}?access_token=${encodeURIComponent(tok)}`);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(bx - ax, ay - by).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, color: 0xd8d4cc, fog: false }));
      m.position.copy(P3((ax + bx) / 2, (ay + by) / 2, -0.6)); m.renderOrder = -1; mapGround.add(m);
    }
    scene.add(mapGround); farGround.position.y = -1.5;
  }

  /* ----------------------------------------------------- the diorama ---- */
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  let ownedMaterials=new Set(),ownedTextures=new Set();
  let D = null, root = null, rootResources = null, inst = [], movers = [], solid = [], groundMeshes = [], selectionRequest=0, forest = null, solidGrid = null, solidPath = null;
  function importedResources(modelRoot) {
    const geometries=new Set(),materials=new Set(),textures=new Set();
    modelRoot.traverse(o=>{
      if(!o.isMesh)return;geometries.add(o.geometry);
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(!m)continue;materials.add(m);
        for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
      }
    });
    return {geometries,materials,textures};
  }
  function disposeImported(resources) {
    if(!resources)return;
    resources.geometries.forEach(g=>g.dispose());
    resources.materials.forEach(m=>m.dispose());
    resources.textures.forEach(t=>t.dispose());
  }
  let areaRoot = null, areaPin = null, areaMode = false, areaRequest = 0;
  function disposeArea() {
    areaRequest++;
    if(areaRoot) { scene.remove(areaRoot);areaRoot.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});areaRoot=null; }
  }
  function leaveArea() {
    if(!areaMode)return;areaMode=false;document.body.classList.remove('showing-area');if(areaRoot)areaRoot.visible=false;
    if(root)root.visible=true;inst.forEach(o=>o.visible=true);bands.forEach(o=>o.visible=true);
    if(mapGround)mapGround.visible=true;farGround.visible=REALLOOK;
    const b=$('#mapped-area');if(b)b.setAttribute('aria-pressed','false');
    if(D)placeLabels(true);
    $('#credit').textContent=W.credit || "Built in Blender from Overture Maps footprints. Heights around each building are estimated; the buildings use the deck's floors. Distances: Google Maps.";
  }
  async function showArea() {
    if(!W.contexts || !D || (W.contexts.reviewOnly && Q.get('context-review')!=='1'))return;
    const request=++areaRequest, id=SEL;
    const button=$('#mapped-area');button.disabled=true;button.textContent='Loading area…';
    try {
      if(!areaRoot) {
        const base=W.contexts.base+id+'/';
        const [gltf,r]=await Promise.all([loader.loadAsync(base+'context.glb'),fetch(base+'metadata.json')]);
        if(!r.ok)throw new Error('Mapped area is unavailable');const meta=await r.json();
        if(request!==areaRequest || id!==SEL)return;
        const x=(meta.origin.lon-LNG0)*KX-D.origin[0],y=(meta.origin.lat-LAT0)*KY-D.origin[1];
        areaRoot=gltf.scene;areaRoot.name='mapped_surroundings';areaRoot.position.copy(P3(x,y));
        areaPin=[x,y];areaRoot.userData.metadata=meta;
        areaRoot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
        scene.add(areaRoot);
        const marker=new THREE.Mesh(new THREE.ConeGeometry(5,16,12),new THREE.MeshBasicMaterial({color:AUI(W)?0xffc200:0xc6f24a}));
        areaRoot.userData.pinHeight=new THREE.Box3().setFromObject(areaRoot).max.y+14;
        marker.position.set(0,areaRoot.userData.pinHeight,0);marker.rotation.z=Math.PI;areaRoot.add(marker);
      }
      setRoute(null);areaMode=true;document.body.classList.add('showing-area');areaRoot.visible=true;
      root.visible=false;inst.forEach(o=>o.visible=false);bands.forEach(o=>o.visible=false);
      if(mapGround)mapGround.visible=false;farGround.visible=false;
      controls.enabled=true;controls.autoRotate=false;MODE='dollhouse';document.body.classList.remove('walk','routing');setModeUI();
      for(const id of ['#walkhud','#compass','#mini','#hint','#route'])$(id).hidden=true;
      const box=new THREE.Box3().setFromObject(areaRoot),size=box.getSize(new THREE.Vector3()),at=box.getCenter(new THREE.Vector3());
      const R=areaRoot.userData.metadata.radius_m*2,distance=Math.max(R,R/camera.aspect)*1.75;
      at.set(areaPin[0],0,-areaPin[1]);
      camera.fov=46;camera.near=.5;camera.far=15000;camera.updateProjectionMatrix();
      controls.minDistance=60;controls.maxDistance=distance*2;controls.minPolarAngle=12*D2R;controls.maxPolarAngle=84*D2R;
      scene.background=hdr;scene.fog=new THREE.Fog(0xd9cbb4,R*2,R*5);tilt.enabled=false;sunBox(R*.65,at);
      flyTo(at,new THREE.Vector3(at.x+distance*.4,at.y+distance*.65,at.z+distance*.65),1400);
      button.setAttribute('aria-pressed','true');placeLabels(true);
      $('#credit').innerHTML='Mapped surroundings · Concept Studio OSM · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · NASA SRTM. Unspecified heights are estimated. <a href="'+W.contexts.base+id+'/source-osm.json">Source data</a>';
    } catch(e) { console.warn(e);button.title='Mapped area could not load. Try again.'; }
    finally {button.disabled=false;button.textContent='Surroundings';}
  }
  if(W.contexts && (!W.contexts.reviewOnly || Q.get('context-review')==='1')) {
    const b=document.createElement('button');b.id='mapped-area';b.textContent='Surroundings';b.setAttribute('aria-pressed','false');
    b.onclick=()=>areaMode?dollhouse():showArea();$('#modes').appendChild(b);
  }
  if(W.cad) {
    const link=document.createElement('a');link.id='cad-link';link.textContent='Explore floor plans →';link.hidden=true;
    Object.assign(link.style,{marginTop:'12px',padding:'11px 16px',borderRadius:'999px',background:'var(--acc)',color:'var(--acc-ink)',fontWeight:'650',alignSelf:'flex-start'});
    $('#hud').insertBefore(link,$('#conn'));
  }
  if(AUI(W))easyTabs($("#modes"));
  if(W.branding==="autopilot-flipkart" || W.lighting){
    if(W.branding==="autopilot-flipkart")worldLayouts=createWorldLayouts();
    lightingBuilder=createSceneLighting({renderer,scene,sun,fill,direction:SUN,ev:+W.lightingEV||0,hour0:+W.lightingHour||10,onChange:()=>{if(D){sunBox(160,P3(...centroid(D.building.foot),D.building.h*.35));captureReflections();}}});
  }
  const OPTS = A.options.filter((o) => !W.thumbs || W.thumbs[o.id]);   // buildings with a 3D model
  function protoParts(node) {   // every mesh under a prototype, with its transform relative to it
    const out = []; node.updateMatrixWorld(true); const inv = node.matrixWorld.clone().invert();
    const finish = m => /^(SKY_|ANDHERI_)/.test(m?.name || '') ? m : material(m?.name || 'concrete');
    node.traverse((o) => { if (o.isMesh) out.push({ geo: o.geometry, mat: Array.isArray(o.material) ? o.material.map(finish) : finish(o.material), m: inv.clone().multiply(o.matrixWorld) }); });
    return out;
  }
  function instance(parts, mats, shadow = true) {   // mats: array of Matrix4
    const out = [];
    for (const p of parts) { const im = new THREE.InstancedMesh(p.geo, p.mat, mats.length); const t = new THREE.Matrix4();
      mats.forEach((m, i) => im.setMatrixAt(i, t.multiplyMatrices(m, p.m))); im.castShadow = shadow; im.receiveShadow = true; scene.add(im); out.push(im); }
    return out;
  }

  /* ------------------------------------------------------- the forest ---- */
  /* Up to 20,000 trees a diorama (Noida's sectors are green), each crown 300 to 830 leaf cards. Drawn as one
     InstancedMesh a tree type they were 17 million triangles a pass, three passes a frame (shadow, scene, AO).
     Now:
       cells      the trees are binned into 100 m cells; a cell outside the view (with a margin) is skipped whole
       LOD        by distance from the eye: under 150 m the full crown, under 450 m every second leaf card grown
                  1.4x about its centre, beyond that every eighth card grown 2.6x with no trunk (a tree 450 m away
                  is a few pixels; its outline and colour hold)
       culling    each tree in a visible cell is tested against the view frustum; only the visible ones are copied
                  into the level's InstancedMesh (count), re-sorted when the eye moves 4 m or turns 2 degrees
       shadows    copies at the middle level in 200 m cells on layer 1, seen only by the sun's camera: every tree
                  keeps its shadow, the shadow map culls whole cells, and it is redrawn only when the shadow box moves
  */
  const isCard = (m) => /(^|_)leaf(_[a-z]+)?$/i.test((Array.isArray(m) ? m[0] : m)?.name || "");
  function cardSubset(geo, keep, grow) {   // leaf-card crown: every keep-th card (two triangles), grown about its centre
    const ix = geo.index, P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
    const tri = ix ? ix.count / 3 : P.count / 3; if (tri % 2) return geo;
    const at = (k) => (ix ? ix.getX(k) : k), kept = [], map = new Map(); let n = 0;
    for (let c = 0; c < tri / 2; c += keep) { const vs = []; for (let k = c * 6; k < c * 6 + 6; k++) vs.push(at(k)); kept.push(vs); for (const v of vs) if (!map.has(v)) map.set(v, n++); }
    const pos = new Float32Array(n * 3), nor = N ? new Float32Array(n * 3) : null, uv = U ? new Float32Array(n * 2) : null, idx = [];
    for (const vs of kept) {
      const u = [...new Set(vs)]; let cx = 0, cy = 0, cz = 0; for (const v of u) { cx += P.getX(v); cy += P.getY(v); cz += P.getZ(v); } cx /= u.length; cy /= u.length; cz /= u.length;
      for (const v of u) { const j = map.get(v); pos[j * 3] = cx + (P.getX(v) - cx) * grow; pos[j * 3 + 1] = cy + (P.getY(v) - cy) * grow; pos[j * 3 + 2] = cz + (P.getZ(v) - cz) * grow;
        if (nor) { nor[j * 3] = N.getX(v); nor[j * 3 + 1] = N.getY(v); nor[j * 3 + 2] = N.getZ(v); } if (uv) { uv[j * 2] = U.getX(v); uv[j * 2 + 1] = U.getY(v); } }
      for (const v of vs) idx.push(map.get(v));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); if (nor) g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); if (uv) g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeBoundingSphere(); g.userData.derived = true; return g;
  }
  function lodParts(parts, level) {
    if (level === 0) return parts;
    const out = [];
    for (const p of parts) {
      const card = isCard(p.mat);
      if (card) out.push({ ...p, geo: level === 1 ? cardSubset(p.geo, 2, 1.4) : cardSubset(p.geo, 8, 2.6) });
      else if (level === 1 || !parts.some((q) => isCard(q.mat))) out.push(p);   // the far level drops the trunk under a crown
    }
    return out;
  }
  function buildForest(protoList, lists) {
    const CELL = 100, NEAR = 150, MID = 450, meshes = [], types = [], derived = new Set();
    const mk = (parts, n, shadow) => parts.map((p) => { const im = new THREE.InstancedMesh(p.geo, p.mat, Math.max(1, n)); im.count = 0; im.castShadow = shadow; im.receiveShadow = !shadow; im.frustumCulled = shadow; scene.add(im); meshes.push(im); if (p.geo.userData.derived) derived.add(p.geo); return im; });
    protoList.forEach((parts, t) => {
      const mats = lists[t]; if (!parts.length || !mats.length) return;
      const L = [0, 1, 2].map((l) => lodParts(parts, l));
      const xs = new Float32Array(mats.length), zs = new Float32Array(mats.length), cells = new Map(), e = new THREE.Vector3();
      mats.forEach((m, i) => { e.setFromMatrixPosition(m); xs[i] = e.x; zs[i] = e.z; const key = Math.floor(e.x / CELL) + "," + Math.floor(e.z / CELL); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(i); });
      const levels = L.map((parts) => mk(parts, mats.length, false));
      // the shadow casters: one InstancedMesh per 200 m cell and part at the middle level, on layer 1 only
      // (coarser than the 100 m view cells: they are drawn only when the shadow map is, and fewer means fewer draw calls then)
      const casterCells = new Map();
      mats.forEach((m, i) => { const key = Math.floor(xs[i] / (CELL * 2)) + "," + Math.floor(zs[i] / (CELL * 2)); if (!casterCells.has(key)) casterCells.set(key, []); casterCells.get(key).push(i); });
      for (const ids of casterCells.values()) {
        const casters = mk(L[1], ids.length, true);
        casters.forEach((im, k) => { ids.forEach((i, j) => im.setMatrixAt(j, _fm.multiplyMatrices(mats[i], L[1][k].m))); im.count = ids.length; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.layers.set(1); });
      }
      types.push({ parts, L, mats, xs, zs, levels, cells: [...cells.entries()].map(([key, ids]) => { const [cx, cz] = key.split(",").map(Number); return { ids, x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL }; }) });
    });
    const fr = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere(), lastP = new THREE.Vector3(1e9, 0, 0), lastQ = new THREE.Quaternion();
    let lastFov = 0, lastAsp = 0;
    function update(cam, force) {
      if (!force && cam.position.distanceToSquared(lastP) < 16 && cam.quaternion.angleTo(lastQ) < 0.035 && cam.fov === lastFov && cam.aspect === lastAsp) return false;
      lastP.copy(cam.position); lastQ.copy(cam.quaternion); lastFov = cam.fov; lastAsp = cam.aspect;
      cam.updateMatrixWorld(); pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pv);
      const cx = cam.position.x, cz = cam.position.z, cy = cam.position.y;
      for (const ty of types) {
        const n = [0, 0, 0];
        for (const c of ty.cells) {
          sph.center.set(c.x, 10, c.z); sph.radius = 0.71 * CELL + 40;   // the cell's corners and the tallest crown, plus slack for 2 degrees of turn
          if (!fr.intersectsSphere(sph)) continue;
          for (const i of c.ids) {
            const dx = ty.xs[i] - cx, dz = ty.zs[i] - cz, d = Math.sqrt(dx * dx + dz * dz + cy * cy * 0.25);
            sph.center.set(ty.xs[i], 8, ty.zs[i]); sph.radius = 14 + d * 0.035;
            if (!fr.intersectsSphere(sph)) continue;
            const l = d < NEAR ? 0 : d < MID ? 1 : 2; const k = n[l]++;
            ty.levels[l].forEach((im, j) => { _fm.multiplyMatrices(ty.mats[i], ty.L[l][j].m); _fm.toArray(im.instanceMatrix.array, k * 16); });
          }
        }
        ty.levels.forEach((ims, l) => ims.forEach((im) => { im.count = n[l]; const a = im.instanceMatrix; if (a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, n[l] * 16); } a.needsUpdate = true; }));
      }
      return true;
    }
    function showAll(level) {   // every tree at one level, for the reflection probe (it looks all round, not along the view)
      for (const ty of types) { ty.levels.forEach((ims, l) => ims.forEach((im) => (im.count = 0)));
        ty.levels[level].forEach((im, j) => { ty.mats.forEach((m, i) => { _fm.multiplyMatrices(m, ty.L[level][j].m); _fm.toArray(im.instanceMatrix.array, i * 16); }); im.count = ty.mats.length; if (im.instanceMatrix.clearUpdateRanges) im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.needsUpdate = true; }); }
      lastP.set(1e9, 0, 0);
    }
    return { meshes, update, showAll, dispose() { derived.forEach((g) => g.dispose()); }, get count() { return types.reduce((s, t) => s + t.mats.length, 0); } };
  }
  const _fm = new THREE.Matrix4();
  async function loadDiorama(id, request) {
    leaveArea();disposeArea();
    $("#veil").classList.add("on");
    const revision = Date.now();
    const previewBase = W.data + "d-preview/";
    const model = previewIds.has(id)
      ? { glb: previewBase + id + ".glb", data: previewBase + id + ".json", aoBase: previewBase }
      : W.models?.[id];
    const version = model?.aoBase ? "?v=" + revision : MV;
    const pre = !model && previewIds.size === 0 ? await (prefetch(id) || null) : null;
    const [gltf, data] = pre ? [await loader.parseAsync(pre[0], `${W.data}d/`), pre[1]] : await Promise.all([
      new Promise((ok, bad) => loader.load((model?.glb || `${W.data}d/${id}.glb`) + version, ok, (e) => { if (e.total && $("#l-bar")) $("#l-bar").style.width = `${Math.round(e.loaded / e.total * 90)}%`; }, bad)),
      fetch((model?.data || `${W.data}d/${id}.json`) + version).then((r) => r.json())]);
    const resources=importedResources(gltf.scene);
    if(request!==selectionRequest){disposeImported(resources);return null;}
    if (root) { scene.remove(root); disposeImported(rootResources); }
    for(const m of ownedMaterials)m.dispose();for(const t of ownedTextures)t.dispose();ownedMaterials.clear();ownedTextures.clear();
    for (const m of inst) { scene.remove(m); m.dispose(); } inst = []; movers = []; groundMeshes = []; if (forest) { forest.dispose(); forest = null; }
    D = data; root = gltf.scene; rootResources = resources; scene.add(root); useOrigin(id); buildMapGround();
    const protos = {};
    root.traverse((o) => {
      if (o.name && o.name.startsWith("proto_") && !o.name.endsWith("_c") && !o.name.includes("_crown") && o.parent === root) protos[o.name] = o;
      if (!o.isMesh) return;
      /* a building modelled on its own (the F1 Skymark twin) brings its own PBR materials,
         named SKY_*: keep them, with the scene's sky in their reflections */
      const finish = m => {
        if (!/^(SKY_|ANDHERI_)/.test(m?.name || '')) return material(m?.name || 'concrete');
        m.envMapIntensity = 1; if (m.transmission) m.thickness = 0.02; return m;
      };
      o.material = Array.isArray(o.material) ? o.material.map(finish) : finish(o.material);
      const names = (Array.isArray(o.material) ? o.material : [o.material]).map(m => m.name || '');
      const isGround = names.every(n => /^(?:ANDHERI_CTX_)?(?:ground|asphalt|pavers|grass|marking|water|kerb|soil|AERIAL_GROUND)$/i.test(n));
      o.castShadow = !isGround; o.receiveShadow = true;
      if (isGround) groundMeshes.push(o);
    });
    await applyAerialSurfaces(root, data);
    if (model?.aoBase) await applyBakedAO(id, model.aoBase, revision, root);
    if(realismFor(id)){await Promise.all(textureJobs);if(request!==selectionRequest)return null;
      root.traverse(o=>{if(!o.isMesh)return;const hero=/^opt_/.test(o.name)||o.parent?.name?.startsWith("opt_");const finish=m=>{for(const key of ["map","roughnessMap","normalMap"])if(m[key]?.userData.failed)m[key]=null;
        if(!hero||!GLASSY.has(m.name))return m;const glass=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(glass,m);glass.defines={STANDARD:'',PHYSICAL:''};glass.name=m.name;glass.clearcoat=.55;glass.clearcoatRoughness=.07;glass.ior=1.52;glass.envMapIntensity=1.25;if(glass.normalScale)glass.normalScale.set(.25,.25);glass.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace("#include <metalnessmap_fragment>","#include <metalnessmap_fragment>\n metalnessFactor = 0.12 + 0.38 * (1.0-smoothstep(0.22,0.5,roughnessFactor));");};glass.userData.heroGlass=true;ownedMaterials.add(glass);return glass;};
        o.material=Array.isArray(o.material)?o.material.map(finish):finish(o.material);const materials=Array.isArray(o.material)?o.material:[o.material];if(hero&&materials.every(m=>m.userData.heroGlass||m.transmission>0))o.castShadow=false;
      });
    }
    if(request!==selectionRequest)return null;
    for (const p of Object.values(protos)) p.visible = false;
    const pp = (k) => protos[k] ? protoParts(protos[k]) : [];
    // trees and palms
    const m4 = (x, y, z, rot, s) => new THREE.Matrix4().compose(P3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s, s, s));
    if (!(model?.bakedProps?.trees || D.modelReview?.photoReconstruction?.bakedProps?.trees)) {
      /* each tree its own height and spread (from its position, so the same every visit): no two alike */
      const m4t = (x, y, rot, s) => { const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1, w = Math.abs(Math.sin(x * 39.346 + y * 11.135) * 24634.6345) % 1;
        return new THREE.Matrix4().compose(P3(x, y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s * (0.86 + 0.28 * w), s * (0.82 + 0.36 * h), s * (0.86 + 0.28 * w))); };
      const T = [[], [], []]; for (const [x, y, t, k, r] of D.trees) T[t].push(m4t(x, y, r, 0.75 + 0.35 * k));
      forest = buildForest([pp("proto_tree_a"), pp("proto_tree_b"), pp("proto_palm")], T); inst.push(...forest.meshes);
    }
    inst.push(...instance(pp("proto_lamp"), D.lamps.map(([x, y], i) => m4(x, y, 0.2, (i * 2.4) % 6.28, 1)), false));
    // traffic: cars, autos and buses running in their lanes
    const lanes = D.traffic.map((t) => { const P = t.p.map(([x, y]) => new THREE.Vector2(x, -y)); const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1])); return { P, L, len: L[L.length - 1], w: t.w }; });
    const kinds = { proto_car: [], proto_auto: [], proto_bus: [] };
    for (const ln of lanes) for (let s = Math.random() * 20; s < ln.len; s += 16 + Math.random() * 26) {
      const r = Math.random(), k = r < 0.3 ? "proto_auto" : r > 0.95 ? "proto_bus" : "proto_car", dir = Math.random() < 0.5 ? 1 : -1;
      kinds[k].push({ ln, s, dir, v: (6 + Math.random() * 6) * (k === "proto_bus" ? 0.8 : 1), lane: dir * ln.w * (0.18 + Math.random() * 0.1) });
    }
    // people on the footpaths either side of every lane, at walking pace
    if (protos.proto_person) {
      kinds.proto_person = [];
      for (const ln of lanes) for (const side of [-1, 1]) for (let s = Math.random() * 12; s < ln.len; s += 7 + Math.random() * 22)
        kinds.proto_person.push({ ln, s, dir: Math.random() < 0.5 ? 1 : -1, v: 1.1 + Math.random() * 0.45, lane: side * (ln.w * 0.5 + 1.4 + Math.random() * 1.2), walk: true });
    }
    const PAINT = [0xf4f4f2, 0xf4f4f2, 0xc9ccd0, 0x8e9297, 0x2b2d31, 0x16171a, 0x7a1d1d, 0x1f3a6b, 0xb8b2a6];
    const SHIRT = [0xf2f2f0, 0x2f4f7f, 0x8a1f2b, 0xd9c7a4, 0x3a5a3a, 0x6b4a8a, 0xe0a030, 0x1f1f22, 0xa8c4d8];
    for (const [k, list] of Object.entries(kinds)) { if (!list.length) continue; const parts = instance(pp(k), list.map(() => new THREE.Matrix4()), false); inst.push(...parts); movers.push({ parts, list, base: pp(k) });
      // each car its own paint, each person their own shirt
      const tint = k === "proto_car" ? ["car_body", PAINT] : k === "proto_person" ? ["person_shirt", SHIRT] : null;
      if (tint) parts.forEach((im) => { if (im.material && im.material.name.replace(/^ANDHERI_CTX_/, '') === tint[0]) { const c = new THREE.Color(); list.forEach((_, i) => im.setColorAt(i, c.setHex(tint[1][Math.floor(Math.random() * tint[1].length)]))); im.instanceColor.needsUpdate = true; } });
    }
    // the Line 1 / Line 7 trains
    for (const [key, ls] of Object.entries(D.metro || {})) for (const m of ls.slice(0, 1)) {
      const P = m.p.map(([x, y]) => new THREE.Vector2(x, -y)); const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
      const ln = { P, L, len: L[L.length - 1], z: m.z };
      const trains = [{ ln, s: ln.len * 0.3, dir: 1, off: 1.9, v: 11, wait: 0 }, { ln, s: ln.len * 0.75, dir: -1, off: -1.9, v: 11, wait: 0 }];
      const parts = instance(pp("proto_train"), Array(trains.length * 4).fill(0).map(() => new THREE.Matrix4()), false); inst.push(...parts);
      movers.push({ parts, trains, base: pp("proto_train"), key });
    }
    // solid footprints for walking
    solid = D.blocks.map((r) => r.map(([x, y]) => [x, y]));
    /* walking tests the footprints in the walker's 20 m cell, not all of them (2,459 at A14/18/19) */
    solidGrid = new Map(); solidPath = new Path2D();
    solid.forEach((p) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let gx = Math.floor((x0 - 1) / 20); gx <= Math.floor((x1 + 1) / 20); gx++) for (let gy = Math.floor((y0 - 1) / 20); gy <= Math.floor((y1 + 1) / 20); gy++) { const k = gx + "," + gy; if (!solidGrid.has(k)) solidGrid.set(k, []); solidGrid.get(k).push(p); }
      p.forEach(([x, y], i) => (i ? solidPath.lineTo(x, y) : solidPath.moveTo(x, y))); solidPath.closePath(); });
    placeLabels(true);
    await new Promise((r) => setTimeout(r, 50));
    if(request!==selectionRequest)return null;
    $("#veil").classList.remove("on"); shadowDirty = true; wake(2000);
    return D;
  }
  const along = (ln, s, out) => { s = clamp(s, 0, ln.len); let i = 1; while (i < ln.L.length - 1 && ln.L[i] < s) i++; const t = (s - ln.L[i - 1]) / Math.max(1e-6, ln.L[i] - ln.L[i - 1]);
    out.x = ln.P[i - 1].x + (ln.P[i].x - ln.P[i - 1].x) * t; out.y = ln.P[i - 1].y + (ln.P[i].y - ln.P[i - 1].y) * t; return Math.atan2(ln.P[i].y - ln.P[i - 1].y, ln.P[i].x - ln.P[i - 1].x); };
  const _v2 = new THREE.Vector2(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _t = new THREE.Matrix4();
  function stepMovers(dt) {
    for (const mv of movers) {
      if (mv.list) mv.list.forEach((c, i) => { c.s += c.v * c.dir * dt; if (c.s > c.ln.len) c.s -= c.ln.len; if (c.s < 0) c.s += c.ln.len;
        const a = along(c.ln, c.s, _v2); _p.set(_v2.x - Math.sin(a) * c.lane, c.walk ? 0.16 : 0.06, _v2.y + Math.cos(a) * c.lane); _e.set(0, -a + (c.dir < 0 ? Math.PI : 0), 0); _q.setFromEuler(_e); _m.compose(_p, _q, _one);
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
      add("bld", `<b>${esc(D.name)}</b><i></i>`, areaMode && areaPin ? P3(areaPin[0],areaPin[1],(areaRoot?.userData.pinHeight||36)+12) : P3(c[0], c[1], b.h + 6), { bld: true });
      for (const s of D.stations) { const [col] = LINE[s.line] || ["#888"]; add("st", `<em style="background:${col}">${s.line}</em>${esc(s.name)}`, P3(s.x, s.y, s.line === "L3" ? 8 : 26)); }
      for (const m of D.landmarks || []) add(m.prop ? "lmk prop" : "lmk", `<b>${esc(m.name)}</b>${m.prop ? "<i></i>" : ""}`, P3(m.x, m.y, m.h + 4));   // named neighbours: Times Square, Fleet House…
      distEl = add("dist", "", new THREE.Vector3(), { dist: true });
    }
    const w = innerWidth, h = innerHeight;
    const blocked=AUI(W) ? [...document.querySelectorAll('#top,#hud,#strip,#credit')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>el.getBoundingClientRect()) : [];
    const placed=[];const overlaps=(a,b)=>a.left<b.right+10&&a.right>b.left-10&&a.top<b.bottom+10&&a.bottom>b.top-10;
    for (const L of LBL) {
      if (L.dist && (!ROUTE || MODE !== "dollhouse")) { L.el.style.display = "none"; continue; }
      _p.copy(L.v).project(camera); const vis = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
      L.el.style.display = vis ? "" : "none"; if (!vis) continue;
      L.el.style.transform = `translate(${((_p.x + 1) / 2 * w).toFixed(1)}px,${((1 - _p.y) / 2 * h).toFixed(1)}px) ${L.dist ? "translate(-50%,-50%)" : "translate(-50%,-100%)"}`;
      if(AUI(W)){const rect=L.el.getBoundingClientRect();if(!L.bld&&(blocked.some(b=>overlaps(rect,b))||placed.some(b=>overlaps(rect,b))))L.el.style.display='none';else placed.push(rect);}
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
    const mid = P[Math.floor(P.length / 2)]; const L = LBL.find((x) => x.dist); if (L) { L.v.set(mid.x, 12, mid.y); L.el.textContent = r.kind === "metro" ? `${fm(r.m)}${r.min ? ` · ${r.min} MIN WALK` : " WALK"}` : `${fm(r.m)} BY ROAD`; }
  }
  const routeOf = (r) => { const dr = r && D.routes.find((x) => x.kind === r.kind && x.name === r.name); return dr ? { ...r, path: dr.path } : null; };

  /* ---------------------------------------------------- the HUD ---- */
  let SEL = null;
  /* W.factKeys maps the explorer's fact names onto an atlas's own (JindalX: the workbook's column names) */
  const factOf = (o, k) => { const f = (o.facts || []).find((x) => x.k === k) || (W.factKeys?.[k] && (o.facts || []).find((x) => x.k === W.factKeys[k])); return (f || {}).v || ""; };
  /* Floors: G is the 5.6 m lobby, then 4.1 m a floor (scripts/world/prep.py);
     the offered floors come from the atlas's "Floor / Unit" (the deck's words). */
  const floorZ = (n) => n === 0 ? 0 : 5.6 + (n - 1) * 4.1, floorH = (n) => n === 0 ? 5.6 : 4.1;
  const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
  function offered(o) {
    const t = String(factOf(o, "Floor / Unit") || "").toLowerCase(); const out = new Set();
    for (const m of t.matchAll(/(\d+)\s*(st|nd|rd|th)?/g)) out.add(+m[1]);
    for (const [w, n] of Object.entries(ORD)) if (t.includes(w)) out.add(n);
    return { floors: [...out].filter((n) => n >= 0 && n < (D ? D.building.floors : 99)), text: factOf(o, "Floor / Unit") || "" };
  }
  let bands = [], FLOOR_SEL = null;
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const hoverMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  function floorBand(n, mat) {   // a lit slice of the building at floor n: its footprint, a hair larger, extruded through the floor
    const up = D.building.upper, foot = up && n >= up.from ? up.foot : D.building.foot;   // a stepped building: the upper floors have their own, smaller plate
    const sh = new THREE.Shape(foot.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: floorH(n) - 0.25, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); const c = centroid(foot); m.position.set(-c[0] * 0.012, floorZ(n) + 0.12, c[1] * 0.012); m.scale.set(1.012, 1, 1.012);
    m.renderOrder = 4; scene.add(m); return m;
  }
  function setBands(o) {
    for (const b of bands) { scene.remove(b); b.geometry.dispose(); } bands = [];
    if (!D) return; for (const n of offered(o).floors) bands.push(floorBand(n, bandMat));
  }
  let hoverBand = null;
  function hoverFloor(n) { if (hoverBand) { scene.remove(hoverBand); hoverBand.geometry.dispose(); hoverBand = null; } if (n != null && D) hoverBand = floorBand(n, hoverMat); }
  function renderStack(o) {
    const el = $("#floors"); if (!el || !D) return;
    const F = D.building.floors, on = new Set(offered(o).floors), H = Math.min(22, Math.max(13, Math.floor(330 / F))), gap = 3;
    let y = 4, rows = "";
    for (let n = F - 1; n >= 0; n--) {
      const lit = on.has(n), lab = n === 0 ? "G" : String(n);
      rows += `<g class="fl${lit ? " on" : ""}${FLOOR_SEL === n ? " sel" : ""}" data-n="${n}" transform="translate(0,${y})"><rect class="b" x="0" y="0" width="150" height="${H}" rx="5"/><text x="12" y="${H / 2 + 4}">${lab}</text>${lit ? `<text class="tag" x="138" y="${H / 2 + 3.5}" text-anchor="end">ON OFFER</text>` : ""}</g>`;
      y += H + gap;
    }
    el.querySelector("svg").innerHTML = rows; el.querySelector("svg").setAttribute("viewBox", `0 0 150 ${y}`);
    el.querySelector(".fnote").textContent = on.size ? `Floor ${offered(o).text}, lit on the building` : `Floor: ${offered(o).text || "not given"}`;
  }
  function flyToFloor(n) {   // push in to a floor: level with it, close enough to read the slab
    leaveArea();
    if (!D) return; FLOOR_SEL = n; const o = OPTS.find((x) => x.id === SEL); renderStack(o);
    const c = centroid(D.building.foot), z = floorZ(n) + floorH(n) / 2, t = P3(c[0], c[1], z), az = D.building.facing + Math.PI / 2 + 0.55, d = 70 + D.building.h * 0.4;
    if (MODE !== "dollhouse") dollhouse(0);
    controls.autoRotate = false;
    flyTo(t, new THREE.Vector3(t.x + Math.cos(az) * d, Math.max(z + 6, 8), t.z - Math.sin(az) * d), 1500);
  }
  function renderHUD(o) {
    worldLayouts?.select(o.id);
    const cad=$('#cad-link');if(cad){cad.hidden=!W.cad[o.id];if(W.cad[o.id])cad.href=W.cad[o.id];}
    const pr = (o.reason || "").startsWith("PRIORITY") ? o.reason.split(" · ")[0] : "";
    $("#h-eyebrow").textContent = `${String(o.n).padStart(2, "0")} · ${factOf(o, "Micro-market")}`;
    $("#h-prio").hidden = !pr; $("#h-prio").textContent = pr;
    $("#name").textContent = o.name;
    $("#line1").textContent = [factOf(o, "Floor / Unit") && `Floor ${factOf(o, "Floor / Unit")}`, factOf(o, "Carpet area") && `${factOf(o, "Carpet area")} carpet`, factOf(o, "Furnishing")].filter(Boolean).join(" · ");
    $("#line2").textContent = [factOf(o, "Per seat") && `${factOf(o, "Per seat")} per seat`, factOf(o, "Possession") && `Possession: ${factOf(o, "Possession")}`].filter(Boolean).join(" · ");
    const rows = (o.routes || []);
    $("#conn").innerHTML = `<div class="mono">From the entrance</div>` + rows.map((r, i) => { const [v, u] = fmtM(r.m); const col = r.kind === "rail" ? "var(--rail)" : (LINE[(r.lines || [])[0]] || ["#3d8fd6"])[0];
      return `<button class="row${ROUTE && ROUTE.name === r.name && ROUTE.kind === r.kind ? " on" : ""}" data-i="${i}"><span class="dot" style="background:${col}"></span><span><b>${esc(r.kind === "rail" ? `${r.name} station` : r.name)}</b><i>${esc((r.lines || []).join(" · "))}${r.kind === "rail" ? " · by road" : " · on foot"}</i></span><span class="v">${v}<small>${u}</small>${r.kind === "rail" || !r.min ? "" : `<em>${r.min} MIN</em>`}</span></button>`; }).join("");
    const r = ROUTE && ROUTE.kind !== "rail" ? ROUTE : rows.find((x) => x.kind === "metro");
    $("#go").hidden = !r; if (r) $("#go").innerHTML = `Walk to ${esc(r.name)} <span aria-hidden="true">→</span>`;
    $("#src").textContent = (A.copy && A.copy.connect && A.copy.connect.note) || "";
    $("#spec").innerHTML = (o.facts || []).filter((f) => !f.src || W.specSourced).map((f) => `<dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd>`).join("");
    const ph = W.renders && W.renders[o.id]; $("#photo").hidden = !ph || $("#spec").hidden; if (ph) $("#photo img").src = W.data + ph + MV;
    if(W.branding==="autopilot-flipkart")propertySpotlight(o,r=>{leaveArea();setRoute(routeOf(r));renderHUD(o);if(MODE==="dollhouse")frameRoute();});
    renderStack(o);
  }
  { const f = $("#floors");
    if (f) {
      f.addEventListener("pointerover", (e) => { const g = e.target.closest(".fl"); hoverFloor(g ? +g.dataset.n : null); });
      f.addEventListener("pointerleave", () => hoverFloor(null));
      f.addEventListener("click", (e) => { const g = e.target.closest(".fl"); if (g) flyToFloor(+g.dataset.n); });
    } }
  $("#more").addEventListener("click", () => { const h = !$("#spec").hidden; $("#spec").hidden = h; $("#photo").hidden = h || !(W.renders && W.renders[SEL]); $("#more").textContent = h ? "Property details" : "Hide details"; });
  $("#conn").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const o = OPTS.find((x) => x.id === SEL); leaveArea();setRoute(routeOf(o.routes[+b.dataset.i])); renderHUD(o); if (MODE === "dollhouse") frameRoute(); });
  $("#go").addEventListener("click", () => startRouteWalk());

  /* ---------------------------------------------------- cameras ---- */
  let MODE = "dollhouse", fly = null;
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function flyTo(t, p, ms = 1500) { wake(ms + 300); fly = { t0: performance.now(), ms, a: { t: controls.target.clone(), p: camera.position.clone() }, b: { t, p } }; }
  function slabSize() { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of D.slab) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return Math.max(x1 - x0, y1 - y0); }
  function sunBox(half, at) { if(lightingBuilder?.active&&D){half=Math.min(half,W.lighting?420:160);at=P3(...centroid(D.building.foot),D.building.h*.35);}const sc = sun.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 10; sc.far = half * 6; sc.updateProjectionMatrix(); sun.target.position.copy(at); sun.position.copy(at).addScaledVector(SUN, half * 3); shadowDirty = true; wake(); }
  function dollhouse(ms = 1600) {
    leaveArea();
    MODE = "dollhouse"; RW = null; document.body.classList.remove("walk", "routing"); setModeUI();
    controls.enabled = true; camera.fov = 32; camera.near = 1; camera.far = 8000; camera.updateProjectionMatrix(); scene.background = null; scene.fog = null;
    // the building at the centre of the turntable; pulled back until the whole slab fits
    const c = centroid(D.building.foot), R = slabSize(); const t = P3(c[0] * 0.35, c[1] * 0.35, D.building.h * 0.2);
    const proof=W.branding && D.modelReview?.camera;
    const az=proof ? Math.atan2(proof.position[1]-proof.target[1],proof.position[0]-proof.target[0]) : D.building.facing+Math.PI/2+.55, polar=52*D2R, dist=R*1.95;
    controls.minDistance = Math.max(90, D.building.h * 1.4); controls.maxDistance = R * 3;
    flyTo(t, new THREE.Vector3(t.x + Math.cos(az) * Math.sin(polar) * dist, t.y + Math.cos(polar) * dist, t.z - Math.sin(az) * Math.sin(polar) * dist), ms);
    frameOffset(true);
    controls.autoRotate = !(AUI(W) && matchMedia("(prefers-reduced-motion:reduce)").matches); tilt.enabled = !REALLOOK; sunBox(R * 0.62, P3(0, 0));
    if (REALLOOK) {
      // a photograph of the place through the eye's own lens: 50 mm on full frame (EYE_FOV, 27 deg vertical), pulled back so the frame holds the same street
      camera.fov = EYE_FOV; camera.updateProjectionMatrix();
      scene.background = lightingBuilder?.sky||hdr; scene.backgroundIntensity = 1.0; scene.fog = new THREE.Fog(0xd9cbb4, 460, 1500);
      const h = D.building.h, tr = P3(c[0], c[1], h * 0.4), d2 = Math.max(330, h * 6.3), pol = 67 * D2R;
      controls.minDistance = 100; controls.maxDistance = 1050; controls.minPolarAngle = 35 * D2R; controls.maxPolarAngle = 84 * D2R;
      if (W.branding === "autopilot-flipkart" && SEL === "corporate-avenue") {
        // The client-selected view, fitted to the roof corners in the November 22 reference.
        const at = P3(155.14, -265.35, 18.5), eye = P3(179.34, 18.51, 166.5);
        const narrow = Math.max(1, 1.15 / camera.aspect);
        controls.autoRotate = false;
        flyTo(at, eye.sub(at).multiplyScalar(narrow).add(at), ms);
      } else if(proof){
        const at=P3(...proof.target),position=P3(...proof.position);position.sub(at).multiplyScalar(innerWidth>900?1.4:1.7).add(at);controls.minDistance=60;controls.autoRotate=false;flyTo(at,position,ms);
      }else flyTo(tr, new THREE.Vector3(tr.x + Math.cos(az) * Math.sin(pol) * d2, tr.y + Math.cos(pol) * d2, tr.z - Math.sin(az) * Math.sin(pol) * d2), ms);
    }
    for (const id of ["#walkhud", "#compass", "#mini", "#hint", "#route"]) $(id).hidden = true;
    lightingBuilder?.atmosphere();
    if (W.freePan) freePan();
  }
  /* the satellite view: drag to move across the whole slab (the metro station included), right-drag or two fingers to turn,
     scroll to zoom, and look straight down if you like. The view stays inside the slab. Atlases opt in with meta.world.freePan. */
  let panBox = null, hintTimer = 0;
  /* arrow keys or W A S D slide across the city while held (Shift: faster); + and - zoom. The speed follows how far out you are. */
  const held = new Set(); let keysOn = false;
  function initKeys() {
    if (keysOn) return; keysOn = true;
    const ok = (e) => MODE === "dollhouse" && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    const MAP = { ArrowUp: "f", ArrowDown: "b", ArrowLeft: "l", ArrowRight: "r", w: "f", s: "b", a: "l", d: "r", W: "f", S: "b", A: "l", D: "r" };
    addEventListener("keydown", (e) => { if (!ok(e)) return; const k = MAP[e.key]; if (k) { e.preventDefault(); held.add(k); controls.autoRotate = false; wake(400); } else if (e.key === "+" || e.key === "=") { zoomStep(0.85); wake(600); } else if (e.key === "-" || e.key === "_") { zoomStep(1.18); wake(600); } });
    addEventListener("keyup", (e) => { const k = MAP[e.key]; if (k) held.delete(k); });
    addEventListener("blur", () => held.clear());
    addEventListener("keydown", (e) => { if (e.key === "Shift") held.add("shift"); }); addEventListener("keyup", (e) => { if (e.key === "Shift") held.delete("shift"); });
  }
  function stepKeys(dt, fast) {
    if (!held.size || (held.size === 1 && held.has("shift"))) return;
    const fwd = controls.target.clone().sub(camera.position); fwd.y = 0; if (fwd.lengthSq() < 1e-6) return; fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x), mv = new THREE.Vector3();
    if (held.has("f")) mv.add(fwd); if (held.has("b")) mv.sub(fwd); if (held.has("r")) mv.add(right); if (held.has("l")) mv.sub(right);
    if (!mv.lengthSq()) return;
    const dist = camera.position.distanceTo(controls.target), v = Math.max(120, dist * 1.6) * (fast ? 2.6 : 1) * dt;
    mv.normalize().multiplyScalar(v); camera.position.add(mv); controls.target.add(mv); wake(300);
  }
  function zoomStep(f) { const d = camera.position.clone().sub(controls.target), n = clamp(d.length() * f, controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(d.setLength(n)); }
  function freePan() {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of D.slab) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    panBox = { x0, x1, z0: -y1, z1: -y0 };
    controls.enablePan = true; controls.screenSpacePanning = false; controls.panSpeed = 1.15;
    // drag turns and tilts the view as in the model view; right-drag, Shift-drag, two fingers or the arrow keys move across the city
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    initKeys();
    controls.minPolarAngle = 4 * D2R; controls.maxPolarAngle = 84 * D2R; controls.minDistance = 50; controls.maxDistance = Math.max(1050, slabSize() * 1.4);
    if (scene.fog) { scene.fog.near = Math.max(scene.fog.near, 1400); scene.fog.far = Math.max(scene.fog.far, 5200); }
    camera.far = Math.max(camera.far, 9000); camera.updateProjectionMatrix();
    const h = $("#hint"); if (h) { h.textContent = "Drag to turn and tilt \u00b7 arrow keys or W A S D to move across the city (Shift: faster) \u00b7 scroll to zoom"; h.hidden = false; clearTimeout(hintTimer); hintTimer = setTimeout(() => { if (MODE === "dollhouse") h.hidden = true; }, 7000); }
  }
  function clampPan() {
    if (!panBox) return; const t = controls.target, x = clamp(t.x, panBox.x0, panBox.x1), z = clamp(t.z, panBox.z0, panBox.z1);
    if (x !== t.x || z !== t.z) { camera.position.x += x - t.x; camera.position.z += z - t.z; t.x = x; t.z = z; }
  }
  /* on a wide screen the overlay takes the left, so the view's centre moves right */
  /* An atlas with a data layer (W.dataLayer, engine/world-data.js) has a panel at the side: the view's centre then moves to the middle of
     what is left, and eases there. Without one this is exactly the old fixed offset. */
  let dataUI = null, frameOn = false, FR = null, frameAnim = 0;
  const putFrame = (x, y) => { const w = innerWidth, h = innerHeight; if (!x && !y) camera.clearViewOffset(); else camera.setViewOffset(w, h, x, y, w, h); camera.updateProjectionMatrix(); wake(160); };
  function frameGoal(on) {
    const w = innerWidth, h = innerHeight, p = dataUI && dataUI.frame();
    if (w <= 900) return { x: 0, y: p ? h * 0.2 : 0 };   // a phone: the panel is a sheet at the bottom, the building rises above it
    if (!p) return on ? { x: -w * 0.16, y: h * 0.04 } : { x: 0, y: 0 };
    const L = on && p.hud ? 392 : 0, R = w - p.width - 20; return { x: w / 2 - (L + R) / 2, y: on ? h * 0.04 : 0 };
  }
  function frameOffset(on) {
    frameOn = on;
    if (!dataUI) { const w = innerWidth, h = innerHeight; if (on && w > 900) camera.setViewOffset(w, h, -w * 0.16, h * 0.04, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); return; }
    const g = frameGoal(on); cancelAnimationFrame(frameAnim);
    if (!FR || matchMedia("(prefers-reduced-motion:reduce)").matches) { FR = g; putFrame(g.x, g.y); return; }
    const a = { ...FR }, t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 520), e = ease(k); FR = { x: a.x + (g.x - a.x) * e, y: a.y + (g.y - a.y) * e }; putFrame(FR.x, FR.y); if (k < 1) frameAnim = requestAnimationFrame(step); };
    frameAnim = requestAnimationFrame(step);
  }
  function frameRoute() { if (!ROUTE) return; const box = new THREE.Box3(); ROUTE.path.forEach(([x, y]) => box.expandByPoint(P3(x, y))); const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), R = Math.max(s.x, s.z, 200);
    if (scene.fog) { scene.fog.near = Math.max(scene.fog.near, R * 1.4); scene.fog.far = Math.max(scene.fog.far, R * 4); }   // a long route is seen whole, not through haze
    const az = Math.atan2(camera.position.x - c.x, camera.position.z - c.z); controls.autoRotate = false; flyTo(c, new THREE.Vector3(c.x + Math.sin(az) * R * 0.9, R * 0.95, c.z + Math.cos(az) * R * 0.9)); }

  /* walk: yaw/pitch by drag, WASD to move, click the ground to go there */
  const walk = { pos: new THREE.Vector2(), yaw: 0, pitch: 0.12, keys: new Set(), goal: null }; let shadowAt = null;
  const EYE = 1.68;
  function pip(x, y, P, r) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi) c = !c; } if (c) return true;
    if (r) for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i]; const dx = bx - ax, dy = by - ay; const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1); if (Math.hypot(x - ax - dx * t, y - ay - dy * t) < r) return true; } return false; }
  function blocked(x, y) { if (!pip(x, y, D.slab, 0)) return true; for (const p of solidGrid?.get(Math.floor(x / 20) + "," + Math.floor(y / 20)) || []) if (pip(x, y, p, 0.6)) return true; return false; }
  function startWalk(at) {
    leaveArea();
    MODE = "walk"; document.body.classList.add("walk"); document.body.classList.remove("routing"); setModeUI(); controls.enabled = false; controls.autoRotate = false; tilt.enabled = false; fly = null;
    camera.fov = EYE_FOV; camera.near = 0.3;   /* eye level: 1.68 m up, through a 50 mm lens: what the eye sees, not wide-angle, not zoomed */ camera.far = 2500; frameOffset(false); scene.background = lightingBuilder?.sky||hdr; scene.backgroundIntensity = 0.9; scene.fog = new THREE.Fog(0xd9cbb4, 260, 900);
    const w0 = at || D.street_cam || D.walk0; walk.pos.set(w0[0], w0[1]);
    const c = centroid(D.building.foot); walk.yaw = Math.atan2(c[0] - w0[0], c[1] - w0[1]); walk.pitch = clamp(Math.atan2(D.building.h * 0.42, Math.hypot(c[0] - w0[0], c[1] - w0[1])), 0, 0.9);
    for (const id of ["#walkhud", "#compass", "#mini", "#hint"]) $(id).hidden = false; $("#route").hidden = true; $("#hint").style.opacity = "1";
    setTimeout(() => ($("#hint").style.opacity = "0"), 6000);
    lightingBuilder?.atmosphere();
  }
  function setModeUI() { document.querySelectorAll("#modes button").forEach((b) => { const on=areaMode ? b.id==="mapped-area" : b.dataset.mode===MODE || (MODE==="route" && b.dataset.mode==="walk");b.classList.toggle("on",on);b.setAttribute("aria-pressed",String(on)); }); }
  /* a plain way out of the street: the button, or Escape, goes back to the model */
  { const back = document.createElement("button"); back.id = "walk-back"; back.type = "button"; back.textContent = "\u2190 Back to the model";
    back.onclick = () => { if (MODE !== "dollhouse") dollhouse(); }; document.body.append(back);
    addEventListener("keydown", (e) => { if (e.key === "Escape" && MODE !== "dollhouse" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) dollhouse(); }); }
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
  addEventListener("keydown", (e) => { if (!e.key || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return; walk.keys.add(e.key.toLowerCase()); if (e.key === "Escape" && MODE !== "dollhouse") dollhouse(); });
  addEventListener("keyup", (e) => e.key && walk.keys.delete(e.key.toLowerCase()));
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
    if (!shadowAt || Math.hypot(camera.position.x - shadowAt.x, camera.position.z - shadowAt.z) > 25) { shadowAt = camera.position.clone().setY(0); sunBox(110, shadowAt); }
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
  let miniKey = "";
  function drawMini() {
    const key = walk.pos.x.toFixed(1) + walk.pos.y.toFixed(1) + walk.yaw.toFixed(3) + (ROUTE ? ROUTE.name : ""); if (key === miniKey) return; miniKey = key;   // redrawn only when the walker moves or turns
    const S = 380, k = S / 2 / 220; mctx.clearRect(0, 0, S, S); mctx.save(); mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2 - 2, 0, 6.283); mctx.clip();
    mctx.translate(S / 2, S / 2); mctx.rotate(-walk.yaw); mctx.scale(k, -k); mctx.translate(-walk.pos.x, -walk.pos.y);
    mctx.fillStyle = "rgba(255,255,255,.18)"; if (solidPath) mctx.fill(solidPath);
    mctx.fillStyle = AUI(W)?"#ffc200":"#c6f24a"; mctx.beginPath(); D.building.foot.forEach(([x, y], i) => (i ? mctx.lineTo(x, y) : mctx.moveTo(x, y))); mctx.fill();
    if (ROUTE) { mctx.strokeStyle = AUI(W)?"#ffc200":"#c6f24a"; mctx.lineWidth = 3 / k; mctx.beginPath(); ROUTE.path.forEach(([x, y], i) => (i ? mctx.lineTo(x, y) : mctx.moveTo(x, y))); mctx.stroke(); }
    for (const s of D.stations) { mctx.fillStyle = (LINE[s.line] || ["#888"])[0]; mctx.beginPath(); mctx.arc(s.x, s.y, 7 / k, 0, 6.283); mctx.fill(); }
    mctx.restore(); mctx.fillStyle = "#fff"; mctx.beginPath(); mctx.moveTo(S / 2, S / 2 - 12); mctx.lineTo(S / 2 + 8, S / 2 + 9); mctx.lineTo(S / 2 - 8, S / 2 + 9); mctx.fill();
  }

  /* the route walk: along the street path at walking pace, time-lapsed */
  let RW = null;
  function startRouteWalk() {
    leaveArea();
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
    $("#route").innerHTML = `<div class="top"><div><span class="mono">Walking to the metro · ${fm(ROUTE.m)}${ROUTE.min ? ` · ${ROUTE.min} min` : ""} · shown 9x faster</span><h4>${esc(ROUTE.name)}</h4></div><div class="big">${f >= 1 ? "ARRIVED" : `${v} ${u}`}<small>${f >= 1 ? "" : `${mins} MIN TO GO`}</small></div></div>
      <div class="track"><i style="width:${(f * 100).toFixed(1)}%"></i><b style="left:${(f * 100).toFixed(1)}%"></b></div><div class="ends"><span class="mono">${esc(D.name)}</span><div class="ctl"><button data-rw="pause">${RW.paused ? "Resume" : "Pause"}</button><button data-rw="exit">Look around</button><button data-rw="back">Dollhouse</button></div><span class="mono">${esc(ROUTE.name)}</span></div>`;
  }
  $("#route").addEventListener("click", (e) => { const b = e.target.closest("[data-rw]"); if (!b) return; const k = b.dataset.rw;
    if (k === "pause") RW.paused = !RW.paused; else if (k === "exit") { RW = null; startWalk([walk.pos.x, walk.pos.y]); } else dollhouse(); });

  /* ------------------------------------------------------ switching ---- */
  async function select(id, first) {
    wake(4000); const request=++selectionRequest;if(!first)intro?.selection();
    SEL = id; const o = OPTS.find((x) => x.id === id);
    document.querySelectorAll(".film").forEach((f) => f.classList.toggle("on", f.dataset.id === id));
    RW = null; ROUTE = null; renderHUD(o);
    await loadDiorama(id,request);
    if(request!==selectionRequest)return;
    FLOOR_SEL = null; setBands(o);
    lightingBuilder?.select(o,realismFor(id)||!!W.lighting);
    gtao.blendIntensity=realismFor(id)?.25:REALLOOK?.5:.9;gtao.updateGtaoMaterial({radius:realismFor(id)?1.25:6,thickness:realismFor(id)?1.5:6});
    await Promise.all(textureJobs);if(request!==selectionRequest)return;captureReflections();
    setRoute(routeOf(o.routes.find((x) => x.kind === "metro"))); renderHUD(o);
    if (MODE === "walk" || MODE === "route") startWalk(); else dollhouse(first ? 0 : 1600);
    if (first && fly && W.branding === "autopilot-flipkart" && id === "corporate-avenue" && REALLOOK) {
      controls.target.copy(fly.b.t); camera.position.copy(fly.b.p); controls.update(); fly = null;
    } else if (first && fly) { controls.target.copy(fly.b.t); const p0 = fly.b.p.clone(); fly = null; camera.position.copy(controls.target.clone().add(p0.clone().sub(controls.target).multiplyScalar(1.6))); flyTo(controls.target.clone(), p0, 2600); }
    try { history.replaceState(null, "", `#${id}`); } catch (e) {}
    dataUI?.select();
  }
  /* the wording is the atlas's when it gives it (W.brand, W.credit), Andheri East's otherwise */
  const BR = W.brand || { kicker: "Autopilot · Flipkart", title: "Andheri East" };
  $("#t-eyebrow").textContent = BR.kicker; $("#t-title").textContent = BR.title;
  (function(){const home=W.home;if(!home)return;const b=document.querySelector("#brand");if(!b)return;b.style.cursor="pointer";b.setAttribute("role","link");b.tabIndex=0;b.title="Back to the proposal";const go=()=>{location.href=home;};b.addEventListener("click",go);b.addEventListener("keydown",e=>{if(e.key==="Enter")go();});})();
  if (!intro && $("#l-title")) $("#l-title").textContent = BR.title;
  $("#to-map").href = W.mapHref || A.path || "/" + SLUG;
  $("#credit").textContent = W.credit || "Built in Blender from Overture Maps footprints. Heights around each building are estimated; the buildings use the deck's floors. Distances: Google Maps.";
  $("#strip").innerHTML = OPTS.map((o) => { const r = (o.routes || []).find((x) => x.kind === "metro"); const th = W.thumbs && W.thumbs[o.id];
    return `<button class="film" data-id="${esc(o.id)}" style="${th ? `background-image:url('${W.data}${th}${MV}')` : ""}"><span><span class="n">${String(o.n).padStart(2, "0")}</span><b>${esc(o.name)}</b>${r ? `<i>${fm(r.m)} · ${esc(r.name)}</i>` : ""}</span></button>`; }).join("");
  $("#strip").addEventListener("click", (e) => { const f = e.target.closest(".film"); if (f && f.dataset.id !== SEL) select(f.dataset.id); });
  addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; frameOffset(MODE === "dollhouse"); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); tilt.uniforms.uRes.value.set(innerWidth, innerHeight); wake(); });

  if (W.dataLayer && AUI(W)) dataUI = createDataLayer({ A, W, options: OPTS, getSel: () => SEL, select: (id) => { if (id !== SEL) select(id); }, onLayout: () => frameOffset(frameOn), wake });
  const deep = location.hash.slice(1); const first = OPTS.some((o) => o.id === deep) ? deep : OPTS[0].id;
  await select(first, true);
  for (const id of ["#top", "#hud", "#strip"]) $(id).hidden = false;
  if(intro)intro.ready({select:(id)=>select(id),selected:()=>SEL});else { $("#l-bar").style.width = "100%"; const hold = window.__plRemain ? window.__plRemain() : 0; setTimeout(() => { $("#load").style.transition = "opacity .9s"; $("#load").style.opacity = "0"; setTimeout(() => $("#load").remove(), 950); }, 200 + hold); }
  if (Q.get("mode") === "walk") startWalk();
  if (OPTS.length <= 6) (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => setTimeout(() => { if (!navigator.connection?.saveData) OPTS.forEach((o) => prefetch(o.id)); }, 2500));

  /* -------------------------------------------------------- loop ---- */
  let last = performance.now(), coveredAt = 0, lastDrawn = 0; const clock = { frames: 0 };
  /* Render on demand. A frame is drawn when something changes: input, the camera easing (fly, orbit damping),
     auto-rotate, walking, the route walk, a texture arriving, a resize. Standing still in the street draws at
     30 fps (the traffic keeps moving); a still dollhouse nobody is touching draws nothing. */
  const busy = () => fly || drag || MODE === "route" && RW && !RW.paused || (MODE === "walk" && (walk.keys.size || walk.goal));
  const IDLE_MS = 1000 / 30;
  /* adapt the quality tier: the median frame over the last 90 drawn at full rate */
  const intervals = []; let tierAt = performance.now(), downs = 0;
  function setTier(t) {
    tier = t; tierAt = performance.now(); intervals.length = 0;
    renderer.setPixelRatio(TIERS[t].dpr); composer.setPixelRatio(TIERS[t].dpr); gtao.enabled = AO_ALLOWED && TIERS[t].ao;
    const samples = MSAA_OK ? TIERS[t].msaa : 0;
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== samples) { rt.samples = samples; rt.dispose(); }
    wake();
    try { sessionStorage.setItem("atlas-world-tier", String(t)); } catch (e) {}
    document.body.dataset.quality = String(t);
  }
  function adapt(dt) {
    if (Q.get("adapt") === "0" || STILL || performance.now() - tierAt < 3000) return;   // not while shaders compile after a load or a change
    intervals.push(dt); if (intervals.length < 90) return;
    const m = [...intervals].sort((a, b) => a - b)[45]; intervals.length = 0;
    if (m > 28 && tier < TIERS.length - 1) { downs++; setTier(tier + 1); }
    else if (m < 17.5 && tier > 0 && downs < 3 && performance.now() - tierAt > 20000) setTier(tier - 1);
  }
  document.body.dataset.quality = String(tier);
  /* ?perf=1: what a frame costs, for scripts/world-bench.cjs (every pass of one frame: shadows, scene, AO, output) */
  const PERF = Q.has("perf") ? { frames: 0, js: [], calls: 0, tris: 0, at: [] } : null;
  if (PERF) renderer.info.autoReset = false;
  function frame(now) {
    if (PERF && (PERF.frozen || Q.has("bench")) && !PERF.ticking) { requestAnimationFrame(frame); return; }   // the benchmark renders through tick() alone
    if (!STILL) {
      const full = now < wakeUntil || busy() || (MODE === "dollhouse" && controls.autoRotate && !areaMode), animated = MODE !== "dollhouse";
      if (!full && !(animated && now - lastDrawn >= IDLE_MS - 2)) { last = now; requestAnimationFrame(frame); return; }
      if (full && lastDrawn) adapt(now - lastDrawn);
      lastDrawn = now;
    }
    if (PERF) { const t0 = performance.now(); renderer.info.reset(); frame_(now); PERF.js.push(performance.now() - t0); PERF.at.push(now); PERF.frames++; PERF.calls = renderer.info.render.calls; PERF.tris = renderer.info.render.triangles; if (PERF.js.length > 600) { PERF.js.shift(); PERF.at.shift(); } if (!STILL) requestAnimationFrame(frame); return; }
    frame_(now); if (!STILL) requestAnimationFrame(frame);
  }
  function frame_(now) {
    // while the full-screen opening, film or shortlist covers the canvas, draw a frame only every 400 ms
    if (!STILL && document.body.classList.contains("ax-covered")) { if (now - coveredAt < 400) return; coveredAt = now; }
    const dt = Math.min(STILL ? 0.5 : 0.05, (now - last) / 1000); last = now; ribbonMat.uniforms.uTime.value += dt;
    if (fly) { const t = Math.min(1, (now - fly.t0) / fly.ms), e = ease(t); controls.target.lerpVectors(fly.a.t, fly.b.t, e); camera.position.lerpVectors(fly.a.p, fly.b.p, e); if (t >= 1) fly = null; }
    if (MODE === "dollhouse") { if (W.freePan && !fly) stepKeys(dt, held.has("shift")); controls.update(); if (W.freePan && !fly) clampPan(); }
    else if (MODE === "walk") stepWalk(dt); else if (MODE === "route") stepRouteWalk(dt);
    if(!areaMode)stepMovers(dt);
    if (forest) forest.update(camera, false);
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    composer.render(); placeLabels(false); clock.frames++;
  }
  if (STILL) frame(performance.now()); else requestAnimationFrame(frame);
  window.__world = { PERF, scene, camera, controls, get mode() { return MODE; }, get tier() { return tier; }, setTier, get forest() { return forest; }, tick: (n = 1, dt = 0.25) => { if (PERF) PERF.ticking = true; for (let i = 0; i < n; i++) { last = performance.now() - dt * 1000; if (fly) fly.t0 -= 1e9; if (PERF) { renderer.info.reset(); frame_(performance.now()); PERF.calls = renderer.info.render.calls; PERF.tris = renderer.info.render.triangles; } else { wake(1); frame(performance.now()); } } if (PERF) PERF.ticking = false; }, select, startWalk, startRouteWalk, dollhouse, clock, renderer, walk, setRW: (s) => { if (RW) RW.s = s; } };
}

boot();
