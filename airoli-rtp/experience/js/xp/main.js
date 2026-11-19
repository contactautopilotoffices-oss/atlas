// Altruist x Autopilot: the entry experience for Reliable Tech Park, B Wing, MIDC Airoli.
// Enter -> a real-sun descent from above the clouds to the building (shots.json) -> the client explores: orbit, time of day,
// location intelligence (location.json, route.json), the arrival line to level 6, then "Explore your floors" (../demo/).
// Capture contract for the judges: ?capture=<shot>[&t=<s>][&ui=1][&hour=<h>] renders one fixed frame, then window.__READY__.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Q, CAPTURE, TV, UI_IN_CAPTURE, REDUCED, TOUCH, W, U, LOAD, ANISO, fetchJSON, fetchBytes, vfovOf, clamp, sstep, lerp, ffl, EASE } from './core.js';
import { sunAt, sunDir, lookFor } from '../../../twin/web/js/tod.js';
import { createSky, buildNoise } from './sky.js';
import { loadGround, drapeTwinTerrain, siteUnderlay, GROUND } from './ground.js';
import { loadTwin, makeTraffic, GLASS } from './twin.js';
import { buildPath, fixedPose } from './path.js';
import { buildOverlays } from './overlays.js';
import { loadSemanticInterior } from './interior.js';
import { timedText, initHud, updateTimedText, createLabels, fillPanel, shortSource } from './ui.js';
import { probeAudio, createAudio } from './audio.js';
import { createControls, footprintsFrom } from './controls.js';
import { createPost } from './post.js';

const $ = (s) => document.querySelector(s);
const CAD_HANDOFF_AT = 90.5;
const TWIN = '../twin/web/models/exterior/', GEO = 'assets/geo/';
const DATE = new Date(2026, 10, 20);                   // the demo date (shots.json sun block)
const STATS = { fps: 0, frames: 0, dpr: 1, calls: 0, tris: 0, slow: 0 };
window.__STATS__ = STATS; window.__READY__ = false;
document.body.classList.toggle('capture', !!CAPTURE && !UI_IN_CAPTURE);
document.body.classList.toggle('tv', TV);

// ------------------------------------------------------------------ renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true, stencil: false, preserveDrawingBuffer: !!CAPTURE });
} catch (e) { document.body.classList.add('nogl'); $('#enter-note').textContent = 'This screen cannot show 3D. The floors open directly.'; throw e; }
renderer.toneMapping = ({ neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping })[Q.get('tm') || 'neutral']; renderer.toneMappingExposure = 1.1; renderer.autoClear = false;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;
// the shadow map is redrawn only when the sun moves; the flag is applied right before the world render (the sky and
// cloud passes would otherwise consume three's needsUpdate)
const SHADOWS = { dirty: true };
ANISO.max = renderer.capabilities.getMaxAnisotropy();
const DPR_MAX = Math.min(devicePixelRatio || 1, TV ? 1.5 : 2), DPR_MOVING = Math.min(DPR_MAX, 1.25);
let dpr = CAPTURE ? Math.min(devicePixelRatio || 1, 2) : DPR_MAX;
renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .3, 1.6e6);
const pmrem = new THREE.PMREMGenerator(renderer);
const sun = new THREE.DirectionalLight(0xfff1de, 3); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.00025; sun.shadow.normalBias = .04;
Object.assign(sun.shadow.camera, { left: -190, right: 190, top: 190, bottom: -190, near: 10, far: 1200 }); sun.shadow.camera.updateProjectionMatrix();
const SHADOW_C = W(0, 45, 0);
sun.target.position.copy(SHADOW_C); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8174, .7); scene.add(hemi);
const sky = createSky();

// ------------------------------------------------------------------ data
const [shots, loc, route, geo, man, ctxData, layout] = await Promise.all([
  fetchJSON('shots.json'), fetchJSON('data/location.json'), fetchJSON('../demo/data/route.json'), fetchJSON(GEO + 'geo.json'),
  fetchJSON(TWIN + 'exterior_viewer.json'), fetchJSON('data/context.json'), fetchJSON('../rtp6-c/rtp6-c-floor6.twin.layout.json').catch(() => null)]);
const plate = await fetchJSON('../twin/web/plate.json').catch(() => null);
const PATH = buildPath(shots); let TT = timedText(shots);
initHud(); fillPanel(loc);
const setCredit = (with2026) => { const a = geo.attribution || {}; $('#credit').textContent = (with2026 && a.on_screen_with_2026_plates) || a.on_screen || 'Imagery: Sentinel-2 cloudless 2016 by EOX (s2maps.eu), contains modified Copernicus Sentinel data 2016'; };
setCredit(false);

// ------------------------------------------------------------------ the world (loaded behind the Enter screen)
const progressEl = $('#enter-bar i');
LOAD.listeners.add(f => { progressEl.style.transform = `scaleX(${(f * .97).toFixed(4)})`; });
const noiseP = buildNoise().then(n => { sky.setNoise(n); return n; });
const hdrLoad = async (url, expect) => {
  const buf = await fetchBytes(url, expect); const r = new RGBELoader().parse(buf);
  const t = new THREE.DataTexture(r.data, r.width, r.height, THREE.RGBAFormat, r.type);
  t.colorSpace = THREE.LinearSRGBColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = true; t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true;
  const env = pmrem.fromEquirectangular(t).texture; t.dispose(); return env;
};
const ENV = {};
const envP = Promise.all([
  hdrLoad(TWIN + (man.env_maps && man.env_maps.day ? man.env_maps.day.file : 'env/rtp_env_day.hdr'), 4.7e6).then(e => { ENV.day = e; }),
  hdrLoad(TWIN + (man.env_maps && man.env_maps.night ? man.env_maps.night.file : 'env/rtp_env_night.hdr'), 4.4e6).then(e => { ENV.night = e; }),
]);
const groundP = loadGround(geo, GEO);
const twinP = loadTwin(renderer, TWIN, man);
const audioP = probeAudio(shots, loc).then(f => createAudio(f)).catch((e) => { console.warn('[xp] audio', e); return createAudio({ vo: [], bed: null, sfx: [], caps: null, verifiedBeats: new Set() }); });

const [ground, twin] = await Promise.all([groundP, twinP]);
await Promise.all([noiseP, envP]);
scene.add(ground); setCredit((ground.userData.vintages || []).includes(2026));
drapeTwinTerrain(twin.terrain, ground.userData.twinPlate, ground.userData.coarserSurface);
if (ground.userData.twinPlate) { U.uSat.value = ground.userData.twinPlate.tex; const b = ground.userData.twinPlate.bounds; U.uSatB.value.set(b.xmin, b.xmax, b.ymin, b.ymax); }
const site = new THREE.Group(); site.name = 'site'; site.add(twin.building, twin.context, twin.terrain); scene.add(site);
if (ground.userData.twinPlate) site.add(siteUnderlay(ground.userData.twinPlate));
const traffic = makeTraffic(twin.context, ctxData); if (traffic) site.add(traffic.group);
const interior = await loadSemanticInterior(layout); interior.visible = false; site.add(interior);
const OV = buildOverlays({ route, layoutLifts: layout && layout.lifts && layout.lifts.slice(2, 4), heightAt: ground.userData.heightAt });
scene.add(OV.root); for (const k of ['walk', 'rail', 'ring', 'arrival']) OV.show(k, false);
const heightAt = ground.userData.heightAt;
const controls = createControls(camera, renderer.domElement, { outer: plate && plate.outer, boxes: twin.boxes, footprints: footprintsFrom(ctxData), heightAt });
const audio = await audioP;
TT = timedText(shots, { verifiedBeats: audio.verifiedBeats, caps: audio.caps }); TT.raw = {};

// labels pinned to real places (geo.json OSM positions; location.json points)
const labels = createLabels($('#labels'));
const LBL = Object.fromEntries((geo.labels || []).map(l => [l.key, l]));
for (const k of ['mumbai', 'thane', 'thane_creek', 'navi_mumbai', 'airoli']) if (LBL[k]) labels.add('geo_' + k, LBL[k].text, W(LBL[k].x_m, LBL[k].y_m, Math.max(0, heightAt(LBL[k].x_m, LBL[k].y_m)) + 30), { kind: 'place' });
const PTS = Object.fromEntries((loc.points || []).map(p => [p.id, p]));
const st = PTS.airoli_station, dg = PTS.digha_gaon_station;
if (st) labels.add('stn_airoli', 'Airoli station', W(st.x, st.y, 14), { kind: 'station', sub: 'Trans-Harbour line · 17 min walk' });
if (dg) labels.add('stn_digha', 'Digha Gaon station', W(dg.x, dg.y, 14), { kind: 'station', sub: `Trans-Harbour line · ${dg.walk_min} min walk` });
labels.add('rtp', 'Reliable Tech Park · B Wing', W(5, 50, 52), { kind: 'site' });
const NEAR_KINDS = /food|cafe|bus|atm|bank|hospital/;
const nearby = (loc.points || []).filter(p => NEAR_KINDS.test(p.kind) && !/not verified/i.test(p.status || '') && p.walk_min && p.walk_min <= 16);
for (const p of nearby) labels.add('poi_' + p.id, p.name.replace(/ \(NMMT\)$/, ''), W(p.x, p.y, 6), { kind: 'poi', sub: `${p.walk_min} min walk` });
const ringLbl = labels.add('ring', '5 min walk · ≈ ' + OV.ring.userData.r + ' m (est.)', W(OV.ring.userData.c[0] - OV.ring.userData.r * .7, OV.ring.userData.c[1] - OV.ring.userData.r * .7, 4), { kind: 'ring' });

// ------------------------------------------------------------------ time of day (tod.js: the real sun for the site)
const TOD = { hour: 9.5, L: null, night: 0, expBoost: 1 };
const moonDir = new THREE.Vector3();
// The atmosphere's palette. tod.js gives the real sun (position, colour, strength, the night factor, exposure); its
// sky and fog colours are tuned for the twin's close views and read as a sandstorm from 3 km up, so the sky, haze and
// cloud light are set here from the same sun elevation: cool blue-grey haze everywhere, warmth only toward the sun.
const C = (h) => new THREE.Color(h);
const PAL = { zenDay: C('#3c71b4'), zenRise: C('#3d5f8f'), zenNight: C('#0c1526'), horDay: C('#d3dee7'), horRise: C('#c2ccd7'), horNight: C('#1b2333'),
  hazeDay: C('#c4d0db'), hazeRise: C('#aab6c4'), hazeNight: C('#202838'), sunHazeDay: C('#efe4d2'), sunHazeRise: C('#efcda4') };
function applyTod(hour) {
  TOD.hour = hour; const { az, el } = sunAt(hour, DATE), L = lookFor(el); TOD.L = L; TOD.el = el; TOD.az = az;
  const sd = sunDir(az, el); U.uSunDir.value.copy(sd); moonDir.copy(sunDir((az + 180) % 360, 35));
  sky.skyMat.uniforms.uMoonDir.value.copy(moonDir);
  const lightDir = el > -2 ? sd : moonDir;
  sun.position.copy(SHADOW_C).addScaledVector(lightDir, 600);
  // the sun's colour, kept clean: tod.js's low-sun orange, half way to white
  const sunC = L.sunColor.clone().lerp(C('#ffffff'), .35 + .25 * L.day);
  sun.color.copy(el > -2 ? sunC : C('#9fb3d9'));
  sun.intensity = el > -2 ? L.sunI * 1.55 * sstep(-2, 1.5, el) : .22 * sstep(2, 7, -el);
  U.uSunCol.value.copy(sunC).multiplyScalar(sstep(-3, 2, el));
  const day = sstep(4, 28, el), nt = L.night;
  const mix3 = (n, r, d) => n.clone().lerp(r, 1 - nt).lerp(d, day);
  const zen = mix3(PAL.zenNight, PAL.zenRise, PAL.zenDay), hor = mix3(PAL.horNight, PAL.horRise, PAL.horDay);
  hemi.color.copy(zen).lerp(C('#ffffff'), .5); hemi.groundColor.copy(L.ground); hemi.intensity = L.hemiI * .3;
  U.uHazeCol.value.copy(mix3(PAL.hazeNight, PAL.hazeRise, PAL.hazeDay));
  U.uHazeSunCol.value.copy(PAL.sunHazeRise).lerp(PAL.sunHazeDay, day).lerp(U.uHazeCol.value, nt);
  U.uHazeD.value = .62e-4 + .12e-4 * L.gold + .3e-4 * nt; U.uHazeH.value = 1150; U.uNight.value = nt;
  GROUND.uGAmb.value.copy(hor).lerp(zen, .5).multiplyScalar(.4 * L.hemiI / .88);
  GROUND.uGSun.value.copy(sunC).multiplyScalar(.74 * L.sunI / 2.6 * sstep(-2, 2, el));
  GROUND.uSkyRefl.value.copy(hor).lerp(zen, .3); U.uGAmbC.value.copy(GROUND.uGAmb.value); U.uGSunC.value.copy(GROUND.uGSun.value);
  sky.setLook({ ...L, zen, hor }, 2.2 + .8 * L.day);
  GLASS.uNightRooms.value = L.night; GLASS.uRoomBright.value = .1 + .22 * L.gold + .12 * L.night;
  GLASS.uSkyZen.value.copy(zen); GLASS.uSkyHor.value.copy(hor);
  GLASS.uCloudLit.value.copy(sunC).multiplyScalar(.55 * sstep(-2, 6, el)).add(zen.clone().lerp(hor, .6).multiplyScalar(.6));
  twin.setNight(L.night);
  if (interior.userData.mats?.ceiling) interior.userData.mats.ceiling.emissiveIntensity = 1.1 + 1.2 * L.night;
  const env = L.night > .5 ? ENV.night : ENV.day; if (scene.environment !== env) scene.environment = env;
  // diffuse surfaces take only a little of the bake's HDR (it holds the sun, so full strength doubles the daylight and
  // erases the shadows); the glass carries the HDR at full strength as its own reflection
  // The bake's day HDR is in Cycles units: its sky has a median radiance of 2.3 (measured), about twice our sun's
  // irradiance once integrated, so at full strength it floods every shadow. Scaled to sit under the live sun and to
  // match the brightness of the sky we draw; the night HDR is dark (median 0.009) and is lifted instead.
  scene.environmentIntensity = lerp(.055, 1.1, L.night);
  for (const g of Object.values(twin.glassMats)) { if (g.envMap !== env) { g.envMap = env; g.needsUpdate = true; } g.envMapIntensity = lerp(.34, 2.4, L.night); }
  TOD.night = L.night; SHADOWS.dirty = true;
  const hh = Math.floor(hour), mm = Math.round((hour - hh) * 60) % 60; TOD.label = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ post
const post = createPost(renderer, (r) => {
  r.setClearColor(0x000000, 1); r.clear(true, true, false);
  sky.renderSky(r);
  const below = sky.below(camera);
  if (below) sky.composite(r);
  if (SHADOWS.dirty) { r.shadowMap.needsUpdate = true; SHADOWS.dirty = false; }
  r.render(scene, camera);
  if (!below) sky.composite(r);
});
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); post.setSize(w, h, dpr);
  sky.scale = (CAPTURE ? .6 : .5) * Math.min(dpr, 1.5) / dpr; sky.resize(w * dpr, h * dpr);
  camera.aspect = w / h; camera.updateProjectionMatrix(); setLetterbox();
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ camera state
const camState = { hfov: 48.5 };
function setCam(p, target, hfov) {
  camera.position.copy(p); camera.lookAt(target);
  if (Number.isFinite(hfov)) camState.hfov = hfov;
  const vf = clamp(vfovOf(camState.hfov, camera.aspect), 20, 80);
  if (Math.abs(camera.fov - vf) > 1e-3) { camera.fov = vf; camera.updateProjectionMatrix(); }
  // near plane by height above ground (logarithmic depth keeps 0.3 m to 1,600 km clean)
  const n = clamp(camera.position.y / 900, .3, 6); if (Math.abs(camera.near - n) > .01) { camera.near = n; camera.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------ the run (timeline) and the explore mode
const S = { mode: CAPTURE ? 'capture' : 'enter', t: 0, playing: false, speed: +Q.get('speed') || 1, runEnd: PATH.T1, from: 0 };
const cover = (t) => lerp(.62, .36, sstep(14, 56, t));
function timelineState(t) {
  // overlays and building states as pure functions of the timeline time (so a capture at t is exactly the run at t)
  const showRing = t > 56 && t < 64.6, showRail = t > 63.5 && t < 82.5, showWalk = t > 71.5 && t < 90, showArr = t > 82 && t < 99;
  OV.show('ring', showRing, { reveal: sstep(56.3, 58.6, t), opacity: Math.min(1, (64.6 - t) / .6) });
  OV.show('rail', showRail, { reveal: 1, opacity: Math.min(sstep(63.5, 65.5, t), (82.5 - t) / 1) });
  OV.show('walk', showWalk, { reveal: sstep(74.6, 81.2, t), opacity: Math.min(1, (90 - t) / 1.5) });
  OV.show('arrival', showArr, { reveal: clamp((t - 82.5) / (95 - 82.5), 0, 1), opacity: Math.min(1, (99 - t) / .8) });
  labels.set('stn_airoli', t > 64.8 && t < 81.5 ? 1 : 0); labels.set('stn_digha', t > 66 && t < 72 ? 1 : 0);
  labels.setKind('poi', t > 57.6 && t < 63.8 ? 1 : 0); labels.set('ring', 0);
  for (const it of [['MUMBAI', 'geo_mumbai'], ['THANE CREEK', 'geo_thane_creek'], ['NAVI MUMBAI', 'geo_navi_mumbai'], ['AIROLI', 'geo_airoli']]) {
    const tx = TT.raw && TT.raw[it[0]]; labels.set(it[1], tx && t > tx.t0 && t < tx.t1 ? 1 : 0); }
  GLASS.uLitLevel.value = 6; GLASS.uLitK.value = sstep(92.5, 94.2, t) * (1 - sstep(97.2, 97.9, t));
  const g6 = twin.glassMats['facade_glass_L06']; if (g6) g6.userData.u.uClear.value = sstep(95.2, 97.6, t);
  interior.visible = t > 91 && t < 200;
  U.uCloudCover.value = cover(t);
  TOD.expBoost = Math.pow(2, 1.5 * sstep(97.6, 98.1, t) * (1 - sstep(107, 109, t) * 0));
}
// the far-flight labels: their timings from shots.json (positions from geo.json, which is OSM)
TT.raw = {}; for (const b of shots.beats) for (const x of b.text || []) if (/^[A-Z ]+$/.test(x.content) && x.t0 != null) TT.raw[x.content] = { t0: x.t0, t1: x.t1 };

function exploreState() {
  OV.show('ring', S.overlay === 'nearby', { reveal: 1, opacity: 1 }); OV.show('rail', S.overlay === 'location' || S.overlay === 'nearby', { opacity: .9 });
  OV.show('walk', S.overlay === 'location', { reveal: 1 }); OV.show('arrival', false);
  labels.set('stn_airoli', S.overlay === 'location' || S.overlay === 'nearby' ? 1 : 0); labels.set('stn_digha', S.overlay === 'location' ? 1 : 0);
  labels.setKind('poi', S.overlay === 'nearby' ? 1 : 0); labels.set('ring', S.overlay === 'nearby' ? 1 : 0);
  labels.set('rtp', S.overlay === 'location' || S.overlay === 'nearby' ? 1 : 0);
  for (const k of ['geo_mumbai', 'geo_thane_creek', 'geo_navi_mumbai', 'geo_airoli', 'geo_thane']) labels.set(k, 0);
  GLASS.uLitK.value = 0; const g6 = twin.glassMats['facade_glass_L06']; if (g6) g6.userData.u.uClear.value = 0;
  const inside = S.overlay === 'interior';
  interior.visible = inside; $('#interior-panel').hidden = !inside;
  controls.setInteriorMode(inside);
  if (inside) { interior.userData.setCeiling?.($('#ceiling-toggle').checked); interior.userData.setReviewMode?.($('#review-toggle').checked); }
  U.uCloudCover.value = .36; TOD.expBoost = inside ? 1.25 : 1;
}

// glides between explore views (one camera owner at a time: the glide, or the orbit controls)
let glide = null;
function glideTo(p, target, hfov, dur = 2.4) {
  controls.enable(false);
  const p0 = camera.position.clone(), t0 = controls.c.target.clone(), f0 = camState.hfov;
  // keep the old look point honest: what the camera actually looks at, at its current distance
  const d = camera.getWorldDirection(new THREE.Vector3()), tt0 = p0.clone().addScaledVector(d, p0.distanceTo(t0));
  glide = { t: 0, dur: REDUCED ? .01 : dur, p0, tt0, p1: p.clone(), t1: target.clone(), f0, f1: hfov || f0 };
}
function stepGlide(dt) {
  if (!glide) return false; glide.t += dt; const k = EASE.easeInOutCubic(clamp(glide.t / glide.dur, 0, 1));
  const arc = Math.sin(Math.PI * k) * Math.min(250, glide.p0.distanceTo(glide.p1) * .18);
  const p = glide.p0.clone().lerp(glide.p1, k); p.y += arc;
  setCam(p, glide.tt0.clone().lerp(glide.t1, k), lerp(glide.f0, glide.f1, k));
  if (k >= 1) { controls.setFrom(glide.p1, glide.t1); glide = null; controls.enable(true); }
  return true;
}
// Semantic floor cameras use the imported CAD bounds; no new layout is inferred.
const ibox = new THREE.Box3().setFromObject(interior), icentre = ibox.getCenter(new THREE.Vector3());
const isize = ibox.getSize(new THREE.Vector3()), floorSpan = Math.max(isize.x, isize.z, 30);
const floorTarget = new THREE.Vector3(icentre.x, ffl(6) + 1.4, icentre.z);
const interiorPose = (top = false) => ({ p: floorTarget.clone().add(new THREE.Vector3(top ? 0 : floorSpan * .55, floorSpan * (top ? 1.5 : 1.1), top ? .01 : floorSpan * .85)), target: floorTarget.clone(), hfov: 65 });
const planData = await fetchJSON('../demo/data/plan_rtp6-c.json');
const frameMatrix = layout?.frame?.cad_m_to_rtp_local, planOrigin = layout?.frame?.cad_plan_origin_m;
const zonePoints = new Map();
if (frameMatrix && planOrigin) for (const z of planData.zones || []) {
  const x = z.label[0] + planOrigin[0], y = z.label[1] + planOrigin[1];
  zonePoints.set(z.id, { name: z.name, point: W(frameMatrix[0][0]*x+frameMatrix[0][1]*y+frameMatrix[0][2], frameMatrix[1][0]*x+frameMatrix[1][1]*y+frameMatrix[1][2], ffl(6)+1.2) });
  const o = document.createElement('option'); o.value = z.id; o.textContent = z.name; $('#process-zone').append(o);
}
const VIEWS = {
  overview: () => fixedPose('hero_orbit', man, shots),
  interior: () => interiorPose(),
  location: () => ({ p: W(-930, -1820, 900), target: W(-140, -560, 0), hfov: 52 }),
  nearby: () => ({ p: W(-520, -1180, 640), target: W(-150, -470, 0), hfov: 50 }),
};

// ------------------------------------------------------------------ letterbox, HUD, buttons
function setLetterbox() {
  const lb = $('#letterbox'); if (!lb) return;
  const wantBars = (S.mode === 'run') && innerWidth > innerHeight;
  const barH = Math.max(0, (innerHeight - innerWidth / 2.39) / 2);
  lb.style.setProperty('--bar', (wantBars ? barH : 0) + 'px');
}
function enterExplore({ fromRun = false } = {}) {
  S.mode = 'explore'; S.playing = false; audio.stopVoice(); document.body.dataset.mode = 'explore'; setLetterbox();
  S.overlay = 'overview'; exploreState(); setActive('overview');
  if (!fromRun) { const v = VIEWS.overview(); setCam(v.p, v.target, v.hfov); controls.setFrom(v.p, v.target); }
  controls.enable(true);
  applyTod(+$('#tod-r').value);
}
function startRun(from = 0, to = CAD_HANDOFF_AT) {
  $('#interior-panel').hidden = true; controls.setInteriorMode(false); $('#pause-tour').textContent = 'Pause'; $('#pause-tour').setAttribute('aria-label','Pause tour');
  S.mode = 'run'; S.t = from; S.from = from; S.runEnd = Math.min(to, CAD_HANDOFF_AT); S.playing = true; controls.enable(false); glide = null;
  document.body.dataset.mode = 'run'; setLetterbox(); audio.seek(from); $('#handoff').classList.remove('on');
}
function setActive(k) { document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); }
function goDemo() { if (document.body.classList.contains('leaving')) return; S.playing = false; document.body.classList.add('leaving'); audio.fadeOut(.9); setTimeout(() => { location.href = '../demo/index.html?floor=rtp6-c'; }, 950); }

$('#enter-btn').addEventListener('click', () => {
  if (document.body.classList.contains('nogl')) { goDemo(); return; }
  audio.unlock(); document.body.classList.add('entered');
  setTimeout(() => { $('#enter').remove(); }, 1600);
  if (REDUCED) goDemo(); else startRun(+Q.get('from') || 0);
});
addEventListener('keydown', (e) => {
  if (S.mode === 'enter' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#enter-btn').click(); }
  else if (S.mode === 'run' && e.key === 'Escape') skipRun();
  else if (S.mode === 'run' && e.code === 'Space' && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); $('#pause-tour').click(); }
});
function skipRun() {
  if (S.mode !== 'run') return;
  goDemo();
}
$('#skip').addEventListener('click', skipRun);
document.querySelectorAll('#modes button').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.k; setActive(k);
  if (k === 'interior') { goDemo(); return; }
  if (k === 'arrival') { fadeThrough(() => { startRun(82, PATH.T1); }); return; }
  S.overlay = k; exploreState(); const v = VIEWS[k](); glideTo(v.p, v.target, v.hfov, 2.6);
  $('#panel').classList.toggle('on', k === 'location');
  if (k === 'interior') { applyTod(9.5); $('#hint').classList.add('gone'); }
}));
$('#rendered-view').addEventListener('click', () => { $('#render-gallery').hidden=false; $('#gallery-close').focus(); });
$('#gallery-close').addEventListener('click', () => { $('#render-gallery').hidden=true; $('#rendered-view').focus(); });
for(const b of document.querySelectorAll('[data-render]')) b.addEventListener('click', () => { $('#gallery-image').src='../interior-semantic/captures/presentation/'+b.dataset.render; });
addEventListener('keydown', e => { if(e.key==='Escape' && !$('#render-gallery').hidden) { e.preventDefault(); $('#gallery-close').click(); } });
$('#ho-interior').addEventListener('click', goDemo);
$('#pause-tour').addEventListener('click', () => {
  S.playing = !S.playing; $('#pause-tour').textContent = S.playing ? 'Pause' : 'Resume';
  $('#pause-tour').setAttribute('aria-label', S.playing ? 'Pause tour' : 'Resume tour');
  if (S.playing) audio.resume?.(); else audio.pause?.();
});
let muted = false;
$('#sound-toggle').addEventListener('click', () => { muted = !muted; audio.setMuted?.(muted); $('#sound-toggle').textContent = muted ? 'Sound off' : 'Sound on'; $('#sound-toggle').setAttribute('aria-pressed', String(!muted)); });
for (const b of document.querySelectorAll('#chapters button')) b.addEventListener('click', () => { audio.unlock(); startRun(+b.dataset.time); });
$('#interior-fit').addEventListener('click', () => { const v=interiorPose(); glideTo(v.p,v.target,v.hfov,1.4); $('#process-zone').value=''; });
$('#interior-top').addEventListener('click', () => { const v=interiorPose(true); glideTo(v.p,v.target,v.hfov,1.4); });
$('#review-toggle').addEventListener('change', e => interior.userData.setReviewMode?.(e.target.checked));
$('#ceiling-toggle').addEventListener('change', e => interior.userData.setCeiling?.(e.target.checked));
$('#process-zone').addEventListener('change', e => {
  const z=zonePoints.get(e.target.value); if(!z) { $('#interior-fit').click(); return; }
  glideTo(z.point.clone().add(new THREE.Vector3(12,22,20)),z.point,72,1.7);
});
$('#panel-close').addEventListener('click', () => $('#panel').classList.remove('on'));
$('#floors').addEventListener('click', (e) => { e.preventDefault(); goDemo(); });
$('#ho-floors').addEventListener('click', (e) => { e.preventDefault(); goDemo(); });
$('#ho-replay').addEventListener('click', () => { fadeThrough(() => startRun(0)); });
$('#ho-site').addEventListener('click', () => { fadeThrough(() => enterExplore()); });
for (const b of document.querySelectorAll('[data-hour]')) b.addEventListener('click', () => { $('#tod-r').value=b.dataset.hour; $('#tod-r').dispatchEvent(new Event('input')); });
{ const r = $('#tod-r'); r.addEventListener('input', () => { applyTod(+r.value); $('#tod-l').textContent = TOD.label + ' IST'; }); }
function fadeThrough(fn) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')); }, 520); }
// first touch of the orbit hides the hint
renderer.domElement.addEventListener('pointerdown', () => { if (S.mode === 'explore') { glide = null; controls.enable(true); $('#hint').classList.add('gone'); } });
renderer.domElement.addEventListener('wheel', () => { if (S.mode === 'explore' && glide) { glide = null; controls.enable(true); } }, { passive: true });

// ------------------------------------------------------------------ frame
const clock = new THREE.Clock(); let animT = 0, lastMove = 0, prevCam = new THREE.Matrix4(), ftimes = [], stillShown = false;
const sample = {};
const still = $('#still'); still.src = TWIN + ((man.stills && man.stills.morning_orbit && man.stills.morning_orbit.file) || 'stills/rtp_morning_orbit.jpg');
function frame() {
  const dt = Math.min(.1, clock.getDelta());
  if (S.mode === 'explore' || S.mode === 'enter' || (S.mode === 'run' && S.playing)) animT += dt;
  U.uTime.value = animT; post.grade.uTime.value = animT % 100;
  if (traffic) traffic.update(animT);

  if (S.mode === 'run' || S.mode === 'enter') {
    if (S.mode === 'run' && S.playing) S.t = Math.min(S.runEnd, S.t + dt * S.speed);
    const t = S.mode === 'enter' ? .0 : S.t;
    PATH.sample(t, sample); setCam(sample.p, sample.target, sample.hfov);
    applyTodMaybe(PATH.hourAt(t)); timelineState(t);
    updateTimedText(TT, S.mode === 'run' ? t : -1, { hourLabel: TOD.label });
    if (S.playing) audio.update(t);
    $('#tour-time').textContent = Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2,'0');
    for(const b of document.querySelectorAll('#chapters button')) b.classList.toggle('current', t >= +b.dataset.time && t < +(b.nextElementSibling?.dataset.time || PATH.T1));
    if(t >= S.runEnd) { S.playing = false; goDemo(); }
    // the Cycles still of this exact camera, crossfaded in for a moment (only when the frame is the still's frame)
    const fit = Math.abs(camera.aspect - 16 / 9) < .03 && S.mode === 'run';
    const a = fit ? Math.min(sstep(41.6, 42.2, t), 1 - sstep(43.0, 43.6, t)) : 0;
    if (a > .001 || stillShown) { still.style.opacity = a.toFixed(3); stillShown = a > .001; }
    // floor counter on the rise
    const cnt = $('#counter'); const rising = t > 90.4 && t < 95.4; cnt.style.opacity = rising ? 1 : 0;
    if (rising) cnt.textContent = String(clamp(Math.floor((camera.position.y - .6) / 3.6), 1, 6));
    if (S.mode === 'run' && t >= PATH.T1 - 6 && !$('#handoff').classList.contains('on')) { $('#handoff').classList.add('on'); document.body.dataset.mode = 'handoff'; setLetterboxOff(); }
  } else if (S.mode === 'explore') {
    if (!stepGlide(dt)) controls.update();
    setCam(camera.position, controls.c.target.clone().lerp(controls.c.target, 1), undefined);
    camera.lookAt(controls.c.target);
  }
  worldUpdate();

  renderer.info.reset();
  OV.setPixelAngle(camera, innerHeight * dpr);
  camera.updateMatrixWorld(); sky.update(camera);
  sky.renderClouds(renderer);
  post.render(dt);
  labels.update(camera, innerWidth, innerHeight, S.mode === 'capture' ? 10 : dt);

  // adaptive resolution: drop to 1.25 while moving on a slow GPU, back to full when still
  const moving = !prevCam.equals(camera.matrixWorld); prevCam.copy(camera.matrixWorld); if (moving) lastMove = performance.now();
  ftimes.push(dt); if (ftimes.length > 40) ftimes.shift();
  STATS.frames++; STATS.fps = ftimes.length / ftimes.reduce((a, b) => a + b, 0); STATS.dpr = dpr; STATS.calls = renderer.info.render.calls; STATS.tris = renderer.info.render.triangles;
  if (!CAPTURE) {
    const avg = ftimes.reduce((a, b) => a + b, 0) / ftimes.length;
    if (moving && avg > 1 / 48 && dpr > DPR_MOVING && ftimes.length >= 40) { dpr = DPR_MOVING; resize(); ftimes.length = 0; STATS.slow++; }
    else if (!moving && dpr < DPR_MAX && performance.now() - lastMove > 600) { dpr = DPR_MAX; resize(); ftimes.length = 0; }
  }
  requestAnimationFrame(frame);
}
// per-frame world state shared by the live loop and the capture
function worldUpdate() {
  renderer.toneMappingExposure = (TOD.L ? TOD.L.exposure : 1.1) * .92 * TOD.expBoost;
  sky.enabled = U.uCloudCover.value > .01;                       // the cloud deck is only drawn when it can be seen
  { const near = camera.position.y < 3000, inside = S.mode === 'explore' && S.overlay === 'interior'; twin.building.visible = near && !inside; twin.context.visible = near; if (traffic) traffic.group.visible = near; }   // the terrain (the 6.4 km plate) always draws
  // from altitude the 3D city's ground becomes the satellite plate it sits on, and its outer ring sinks into it
  { const a = sstep(230, 720, camera.position.y); U.uSatAlt.value = a; U.uEdge.value.set(lerp(560, 300, a), lerp(680, 515, a)); }
  // in-cloud veil (the motion-blur stand-in while crossing the deck)
  const yb = U.uCloudBase.value, yt = U.uCloudTop.value, cy = camera.position.y;
  post.grade.uVeil.value = cy > yb - 60 && cy < yt + 60 ? .5 * Math.min(sstep(yb - 60, yb + 120, cy), 1 - sstep(yt - 120, yt + 60, cy)) : 0;
  post.grade.uVeilCol.value.copy(U.uHazeCol.value).lerp(new THREE.Color(1, 1, 1), .4).multiplyScalar(1.1);
  post.grade.uGrain.value = S.mode === 'capture' ? 0 : .010;
  post.bloom.enabled = TOD.night > .3; post.bloom.strength = .3 * TOD.night;
}
function setLetterboxOff() { const lb = $('#letterbox'); if (lb) lb.style.setProperty('--bar', '0px'); }
let lastHour = -1;
function applyTodMaybe(h) { if (Math.abs(h - lastHour) > 1 / 120) { applyTod(h); lastHour = h; } }

// ------------------------------------------------------------------ warm up: upload textures, compile, first shadow map
resize();
applyTod(9.5);
PATH.sample(0, sample); setCam(sample.p, sample.target, sample.hfov);
scene.traverse(o => { if (o.isMesh && o.material) for (const m of [].concat(o.material)) for (const k of ['map', 'aoMap', 'emissiveMap']) if (m[k]) renderer.initTexture(m[k]); });
for (const m of ground.children) { const u = m.material; } // plate textures are bound via onBeforeCompile uniforms; the first frame uploads them
try { await renderer.compileAsync(scene, camera); } catch (e) { /* compileAsync falls back to sync compile */ }
SHADOWS.dirty = true;

// ------------------------------------------------------------------ capture contract
window.__XP = { scene, camera, THREE, renderer, hemi, sun, U, GLASS, SHADOWS,
  render() { worldUpdate(); camera.updateMatrixWorld(); sky.update(camera); sky.renderClouds(renderer); post.render(0); } };
async function setupCapture() {
  const shot = CAPTURE, hour = Q.has('hour') ? +Q.get('hour') : 9.5;
  const NAMED_T = { descent_clouds: 6, descent_mumbai: 14, descent_creek: 25, descent_airoli: 31, location: 80.5, arrival: 94 };
  let t = Q.has('t') ? +Q.get('t') : null;
  const m = /^b(\d\d)[a-z]?@([\d.]+)$/.exec(shot || '');
  document.body.dataset.mode = 'capture';
  $('#enter') && $('#enter').remove();
  if (['hero_court', 'hero_road', 'hero_orbit', 'b10alt'].includes(shot)) {
    const v = fixedPose(shot, man, shots); exploreState(); applyTod(hour); setCam(v.p, v.target, v.hfov);
    if (shot === 'b10alt') { interior.visible = true; const g6 = twin.glassMats['facade_glass_L06']; if (g6) g6.userData.u.uClear.value = 1; TOD.expBoost = Math.pow(2, 1.5); }
    animT = t ?? 0;
  } else {
    if (m) t = +m[2]; if (t === null) t = NAMED_T[shot] ?? 6;
    S.t = t; PATH.sample(t, sample); setCam(sample.p, sample.target, sample.hfov);
    timelineState(t); applyTod(Q.get('hour') === 'script' ? PATH.hourAt(t) : hour); animT = t;
    if (UI_IN_CAPTURE) { document.body.dataset.mode = 'run'; updateTimedText(TT, t, { hourLabel: TOD.label }); }
  }
  U.uTime.value = animT; if (traffic) traffic.update(animT);
  SHADOWS.dirty = true;
  // render a few frames so every texture is on the GPU and the shadow map is built, then signal
  const one = () => new Promise(r => requestAnimationFrame(() => {
    worldUpdate(); renderer.info.reset(); camera.updateMatrixWorld(); sky.update(camera); sky.renderClouds(renderer); post.render(0);
    STATS.calls = renderer.info.render.calls; STATS.tris = renderer.info.render.triangles; labels.update(camera, innerWidth, innerHeight, 10); r(); }));
  for (let i = 0; i < 6; i++) await one();
  STATS.ready_ms = Math.round(performance.now());
  window.__READY__ = true;
}

// a handle for the automated checks (read only use)
window.__XP__ = { THREE, scene, camera, renderer, OV, twin, ground, interior, labels, U, GLASS, sky, post, S, PATH, TOD, applyTod, setCam };
const DBG = Q.get('dbg') || '';
if (/noao/.test(DBG)) scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.aoMap) { m.aoMap = null; m.needsUpdate = true; } });
if (/noclouds/.test(DBG)) sky.enabled = false;
if (CAPTURE) { await setupCapture(); }
else {
  // the Enter screen: everything above is already in memory, so the underline completes and the button wakes up
  $('#enter-note').textContent = 'A guided arrival. Then open your CAD layout.';
  progressEl.style.transform = 'scaleX(1)'; $('#enter').classList.add('ready'); $('#enter-btn').disabled = false;
  window.__READY__ = true;
  if (Q.has('autostart')) { $('#enter-btn').click(); }
  if (Q.has('explore')) { $('#enter').remove(); document.body.classList.add('entered'); enterExplore(); if (Q.get('explore') === 'interior') document.querySelector('[data-k="interior"]').click(); }
  requestAnimationFrame(frame);
}
