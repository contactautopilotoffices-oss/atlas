// Shared frame, units and the one atmosphere every material reads (haze, cloud shadows, wind).
// Frame: rtp_local metres (x east, y north from the Maps pin 19.1692159 N 73.0017703 E); three (x, y, z) = (x, height, -y).
import * as THREE from 'three';

export const Q = new URLSearchParams(location.search);
export const CAPTURE = Q.get('capture');                       // ?capture=<shot>&t=<s>: fixed frame for the judges
export const TV = Q.get('tv') === '1' || Q.has('tv');           // big screen with lag: more inertia, lower DPR
export const UI_IN_CAPTURE = Q.get('ui') === '1';
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const TOUCH = matchMedia('(pointer:coarse)').matches;

// geo.json frame constants (the plates are resampled so this linear conversion is exact for them)
export const LAT0 = 19.1692159, LNG0 = 73.0017703, KLAT = 110574, KLNG = 105147.632, GROUND_ASL = 11.557;
export const W = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
export const toLocal = (lat, lng) => [(lng - LNG0) * KLNG, (lat - LAT0) * KLAT];
export const fromLL = (lat, lng, altASL) => { const [x, y] = toLocal(lat, lng); return W(x, y, altASL - GROUND_ASL); };
export const hfovOfLens = (mm) => 2 * Math.atan(18 / mm) * 180 / Math.PI;              // lens on a 36 mm wide frame
export const vfovOf = (hfov, aspect) => 2 * Math.atan(Math.tan(hfov * Math.PI / 360) / aspect) * 180 / Math.PI;
export const ffl = (level) => 0.6 + 3.6 * level;                                     // building.json (logged assumption)

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const EASE = {
  linear: (t) => t, hold: () => 0, 'linear-drift': (t) => t,
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInOutCubic: (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutSine: (t) => Math.sin(t * Math.PI / 2),
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
};

export async function fetchJSON(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
export async function exists(url) { try { const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' }); return r.ok; } catch (e) { return false; } }

// ------------------------------------------------------------------ the loader with an honest progress figure
// Every heavy file goes through here so the Enter button's underline is the real share of bytes in memory.
export const LOAD = { want: 0, got: 0, files: new Map(), listeners: new Set(),
  frac() { return this.want ? Math.min(1, this.got / this.want) : 0; },
  tick() { for (const f of this.listeners) f(this.frac()); } };
export async function fetchBytes(url, expect = 0) {
  const rec = { want: expect, got: 0 }; LOAD.files.set(url, rec); LOAD.want += expect; LOAD.tick();
  const r = await fetch(url);
  if (!r.ok) { LOAD.want -= rec.want; LOAD.files.delete(url); LOAD.tick(); throw new Error(url + ' ' + r.status); }
  const len = +r.headers.get('content-length') || expect;
  if (len && len !== rec.want) { LOAD.want += len - rec.want; rec.want = len; }
  const rd = r.body.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; LOAD.got += value.length; rec.got = n; LOAD.tick(); }
  if (n < rec.want) { LOAD.got += rec.want - n; LOAD.tick(); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}
// an image as a texture, decoded off the main thread; flipY done by the decoder (ImageBitmaps ignore texture.flipY)
export async function loadTexture(url, { expect = 0, flipY = true, srgb = true, repeat = false } = {}) {
  const buf = await fetchBytes(url, expect);
  const bmp = await createImageBitmap(new Blob([buf]), { imageOrientation: flipY ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const t = new THREE.Texture(bmp); t.flipY = false; t.needsUpdate = true;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; else t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = ANISO.max; return t;
}
export const ANISO = { max: 16 };

// ------------------------------------------------------------------ the atmosphere: shared uniforms
// Haze is an exponential-height aerosol layer (scale height H, ground extinction D per metre) whose colour leans warm
// toward the sun. Cloud shadows come from the same coverage map the cloud deck is ray-marched from, so they line up.
export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(.5, .5, .5).normalize() },
  uSunCol: { value: new THREE.Color(1, .95, .9) },
  uHazeCol: { value: new THREE.Color('#c9d3dc') },
  uHazeSunCol: { value: new THREE.Color('#f1dcc0') },
  uHazeD: { value: 2.2e-4 }, uHazeH: { value: 1300 },
  uWeather: { value: null },                                 // 2D tileable coverage noise (R)
  uCloudCover: { value: .45 }, uCloudBase: { value: 2190 }, uCloudTop: { value: 2640 },
  uCloudWind: { value: new THREE.Vector2(-5.5, 2.2) },          // m/s in three x/z (art, not a weather record)
  uCloudShadowK: { value: .55 },
  uWind: { value: 1 },                                       // foliage sway strength
  uNight: { value: 0 },
  // the finest satellite plate, so the 3D context can hand over to it at its edge (no hard disc of city on a photo)
  uSat: { value: null }, uSatB: { value: new THREE.Vector4(-3200, 3200, -3200, 3200) },
  uGAmbC: { value: new THREE.Color(.45, .47, .5) }, uGSunC: { value: new THREE.Color(.75, .73, .7) },
  uEdge: { value: new THREE.Vector2(540, 660) }, uSatFade: { value: new THREE.Vector2(470, 590) }, uSatAlt: { value: 0 },
};

export const GLSL_COMMON = /* glsl */`
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uHazeCol; uniform vec3 uHazeSunCol;
uniform float uHazeD; uniform float uHazeH; uniform sampler2D uWeather; uniform float uCloudCover; uniform float uCloudBase;
uniform float uCloudTop; uniform vec2 uCloudWind; uniform float uCloudShadowK; uniform float uNight;
uniform sampler2D uSat; uniform vec4 uSatB; uniform vec3 uGAmbC; uniform vec3 uGSunC; uniform vec2 uSatFade; uniform float uSatAlt;
float hz_coverage(vec2 xz) {
  vec2 p = xz + uCloudWind * uTime;
  float a = texture2D(uWeather, p / 23000.0).r, b = texture2D(uWeather, p / 7300.0 + vec2(.37, .71)).r;
  float n = clamp((a * .68 + b * .32 - .5) * 2.4 + .5, 0.0, 1.0);
  return smoothstep(1.0 - uCloudCover - .16, 1.0 - uCloudCover + .16, n);
}
float hz_cloudShadow(vec3 wp) {
  vec3 s = normalize(vec3(uSunDir.x, max(uSunDir.y, .08), uSunDir.z));
  float h = mix(uCloudBase, uCloudTop, .4);
  vec3 q = wp + s * ((h - wp.y) / s.y);
  float c = hz_coverage(q.xz);
  return 1.0 - uCloudShadowK * smoothstep(.12, .7, c) * smoothstep(-.02, .12, uSunDir.y);
}
// fraction of light scattered in by haze between the camera and a point, and its colour
vec4 hz_haze(vec3 wp) {
  vec3 rd = wp - cameraPosition; float dist = length(rd); rd /= max(dist, 1e-3);
  float b = 1.0 / uHazeH, ry = rd.y;
  float k = abs(ry) < 1e-4 ? dist : (1.0 - exp(-dist * ry * b)) / (ry * b);
  float od = uHazeD * exp(-max(cameraPosition.y, -12.0) * b) * k;
  float f = 1.0 - exp(-od);
  float s = pow(max(dot(rd, uSunDir), 0.0), 7.0);
  return vec4(mix(uHazeCol, uHazeSunCol, s), f);
}
`;

// Patch any built-in material: haze instead of three's fog, cloud shadows on the sun light, optional foliage wind.
// Idempotent; every patched material shares the uniforms above.
export function patchMaterial(m, { wind = 0, shadow = true, haze = true, edgeFade = null, edge = false, sat = false, satFade = null, clipR = 0 } = {}) {
  if (!m || m.userData.hzPatched) return m;
  m.userData.hzPatched = true; m.fog = false;
  if (edgeFade) { m.transparent = true; m.depthWrite = true; }
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vHzW;\nuniform float uTime; uniform float uWind; uniform vec2 uEdge;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${edge ? `{ vec4 we = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            we = instanceMatrix * we;
          #endif
          we = modelMatrix * we; float ke = 1.0 - smoothstep(uEdge.x, uEdge.y, length(we.xz + vec2(0.0, 45.0)));
          transformed.y = mix(min(transformed.y, .05), transformed.y, ke); }` : ''}
        ${wind ? `{ vec4 wb = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            wb = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          #endif
          float ph = wb.x * .13 + wb.z * .17;
          float amp = uWind * ${wind.toFixed(3)} * (max(position.y, 0.0) * .6 + length(position.xz) * .35);
          float g = sin(uTime * 1.3 + ph) * .65 + sin(uTime * 2.9 + ph * 1.7) * .25 + sin(uTime * 6.1 + ph * 3.1 + position.x) * .1;
          transformed.x += g * amp; transformed.z += g * amp * .55; transformed.y -= abs(g) * amp * .15; }` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 hw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            hw = instanceMatrix * hw;
          #endif
          vHzW = (modelMatrix * hw).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vHzW;\n${GLSL_COMMON}`)
      .replace('#include <fog_fragment>', (sat ? `{ float ks = max(smoothstep(${satFade ? satFade[0].toFixed(1) : 'uSatFade.x'}, ${satFade ? satFade[1].toFixed(1) : 'uSatFade.y'}, length(vHzW.xz + vec2(0.0, 45.0))), uSatAlt);
          if (ks > 0.0) { vec2 su = vec2((vHzW.x - uSatB.x) / (uSatB.y - uSatB.x), (-vHzW.z - uSatB.z) / (uSatB.w - uSatB.z));
            vec3 sc = texture2D(uSat, su).rgb * (uGAmbC + uGSunC * .75 * hz_cloudShadow(vHzW)); gl_FragColor.rgb = mix(gl_FragColor.rgb, sc, ks); } }` : '')
        + (haze ? `{ vec4 hz = hz_haze(vHzW); gl_FragColor.rgb = mix(gl_FragColor.rgb, hz.rgb, hz.a); }` : ''));
    if (clipR) sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (length(vHzW.xz + vec2(0.0, 45.0)) > ${clipR.toFixed(1)}) discard;`);
    if (edgeFade) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
      `diffuseColor.a *= 1.0 - smoothstep(${edgeFade[0].toFixed(1)}, ${edgeFade[1].toFixed(1)}, length(vHzW.xz) + (texture2D(uWeather, vHzW.xz / 520.0).r - .5) * 150.0);\n#include <opaque_fragment>`);
    if (shadow && sh.fragmentShader.includes('#include <lights_fragment_end>'))
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { float cs = hz_cloudShadow(vHzW); reflectedLight.directDiffuse *= cs; reflectedLight.directSpecular *= cs; }`);
  };
  const key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  m.customProgramCacheKey = () => (key ? key() : '') + `|hz${wind ? 'w' + wind : ''}${shadow ? 's' : ''}${haze ? 'h' : ''}${edgeFade ? 'e' + edgeFade.join('_') : ''}${edge ? 'E' : ''}${sat ? 'S' + (satFade ? satFade.join('_') : '') : ''}${clipR ? 'c' + clipR : ''}`;
  m.needsUpdate = true; return m;
}

// interleaved gradient noise etc. for shader jitter
export const GLSL_NOISE = /* glsl */`
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
`;
