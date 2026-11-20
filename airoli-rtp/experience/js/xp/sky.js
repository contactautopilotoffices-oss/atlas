// The sky and the cloud deck. The sky is an analytic gradient lit by the real sun (tod.js colours). The clouds are a
// ray-marched slab (2,190 to 2,640 m above the site) of Perlin-Worley noise, rendered at reduced resolution and
// composited over (camera in or above the deck) or behind (camera below) the scene. Clouds are art, not a weather record.
import * as THREE from 'three';
import { U, GLSL_COMMON, GLSL_NOISE } from './core.js';

// ------------------------------------------------------------------ noise volumes, built in a worker (no main-thread jank)
const WORKER = `
const hashI = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 1440662683 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const G = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const wrap = (i, P) => ((i % P) + P) % P;
function perlin3(x, y, z, P, s) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z;
  const u = fade(fx), v = fade(fy), w = fade(fz); let out = 0;
  for (let k = 0; k < 8; k++) { const dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1;
    const g = G[Math.floor(hashI(wrap(X + dx, P), wrap(Y + dy, P), wrap(Z + dz, P), s) * 12)];
    const d = g[0] * (fx - dx) + g[1] * (fy - dy) + g[2] * (fz - dz);
    out += d * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); }
  return out;
}
function perlin2(x, y, P, s) { return perlin3(x, y, 0.5, P, s); }
function worley3(x, y, z, P, s) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); let m = 9;
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = X + dx, cy = Y + dy, cz = Z + dz, wx = wrap(cx, P), wy = wrap(cy, P), wz = wrap(cz, P);
    const px = cx + hashI(wx, wy, wz, s), py = cy + hashI(wx, wy, wz, s + 1), pz = cz + hashI(wx, wy, wz, s + 2);
    const d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2; if (d < m) m = d; }
  return Math.min(1, Math.sqrt(m));
}
onmessage = (e) => {
  const { N, W2 } = e.data;
  const vol = new Uint8Array(N * N * N * 2);
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, w = k / N;
    let p = 0, a = .5, n = 0; for (const P of [4, 8, 16]) { p += a * perlin3(u * P, v * P, w * P, P, 7 + P); n += a; a *= .5; } p = p / n * .5 + .5;
    const wf = (1 - worley3(u * 4, v * 4, w * 4, 4, 11)) * .625 + (1 - worley3(u * 8, v * 8, w * 8, 8, 13)) * .25 + (1 - worley3(u * 16, v * 16, w * 16, 16, 17)) * .125;
    let pw = (p - (wf - 1)) / (1 - (wf - 1)); pw = Math.min(1, Math.max(0, (pw - .35) / .65));
    const det = (1 - worley3(u * 8, v * 8, w * 8, 8, 23)) * .625 + (1 - worley3(u * 16, v * 16, w * 16, 16, 29)) * .25 + (1 - worley3(u * 32, v * 32, w * 32, 32, 31)) * .125;
    const o = (i + j * N + k * N * N) * 2; vol[o] = Math.round(Math.min(1, Math.max(0, pw)) * 255); vol[o + 1] = Math.round(Math.min(1, Math.max(0, det)) * 255);
  }
  const wx = new Uint8Array(W2 * W2);
  for (let j = 0; j < W2; j++) for (let i = 0; i < W2; i++) {
    const u = i / W2, v = j / W2; let p = 0, a = .5, n = 0;
    for (const P of [4, 8, 16, 32, 64]) { p += a * perlin2(u * P, v * P, P, 41 + P); n += a; a *= .52; }
    p = p / n; const wv = 1 - worley3(u * 6, v * 6, .5, 6, 51);
    wx[i + j * W2] = Math.round(Math.min(1, Math.max(0, (p * .5 + .5) * .78 + wv * .22)) * 255);
  }
  postMessage({ vol, wx }, [vol.buffer, wx.buffer]);
};`;

export function buildNoise(N = 64, W2 = 512) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
    const w = new Worker(url); w.onerror = rej;
    w.onmessage = (e) => {
      const shape = new THREE.Data3DTexture(e.data.vol, N, N, N); shape.format = THREE.RGFormat; shape.type = THREE.UnsignedByteType;
      shape.wrapS = shape.wrapT = shape.wrapR = THREE.RepeatWrapping; shape.minFilter = THREE.LinearMipmapLinearFilter; shape.magFilter = THREE.LinearFilter;
      shape.generateMipmaps = true; shape.unpackAlignment = 1; shape.needsUpdate = true;
      const weather = new THREE.DataTexture(e.data.wx, W2, W2, THREE.RedFormat, THREE.UnsignedByteType);
      weather.wrapS = weather.wrapT = THREE.RepeatWrapping; weather.minFilter = THREE.LinearMipmapLinearFilter; weather.magFilter = THREE.LinearFilter;
      weather.generateMipmaps = true; weather.unpackAlignment = 1; weather.needsUpdate = true;
      w.terminate(); URL.revokeObjectURL(url); res({ shape, weather });
    };
    w.postMessage({ N, W2 });
  });
}

// ------------------------------------------------------------------ shared camera ray for full-screen passes
const RAY_VS = /* glsl */`varying vec2 vNdc; void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const RAY_FN = /* glsl */`uniform mat4 uCamMat; uniform mat4 uInvProj; varying vec2 vNdc;
vec3 viewRay() { vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0); v /= v.w; return normalize((uCamMat * vec4(v.xyz, 0.0)).xyz); }
float hgPhase(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * mu, 1.5)); }`;

export function createSky() {
  const SKYU = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunI: { value: 3 }, uSunDisc: { value: 1 },
    uCamMat: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) } };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...SKYU }, vertexShader: RAY_VS, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`${GLSL_COMMON}\n${RAY_FN}
      uniform vec3 uZen; uniform vec3 uHor; uniform float uSunI; uniform float uSunDisc; uniform vec3 uMoonDir;
      void main() {
        vec3 rd = viewRay(); float y = rd.y;
        vec3 c = mix(uHor, uZen, pow(clamp(y, 0.0, 1.0), .45));
        c = mix(c, uHazeCol, exp(-max(y, 0.0) * 16.0) * .85);
        if (y < 0.0) c = mix(uHazeCol, uHazeCol * .82, clamp(-y * 3.0, 0.0, 1.0));
        float mu = dot(rd, uSunDir), vis = smoothstep(-.06, .02, uSunDir.y);
        c += uSunCol * uSunI * vis * (.045 * hgPhase(mu, .78) + .025 * pow(max(mu, 0.0), 6.0) * exp(-max(y, 0.0) * 4.0));
        float a = acos(clamp(mu, -1.0, 1.0));
        float disc = 1.0 - smoothstep(.0043, .0055, a);
        c += uSunCol * disc * uSunDisc * 60.0 * vis * smoothstep(-.004, .004, y + .002);
        // night: a moon where the night light comes from, and a faint warm city glow on the horizon
        float m = 1.0 - smoothstep(.0045, .007, acos(clamp(dot(rd, uMoonDir), -1.0, 1.0)));
        c += vec3(.75, .8, .9) * (m * 6.0 + .02 * hgPhase(dot(rd, uMoonDir), .7)) * uNight;
        c += vec3(.9, .55, .32) * .08 * uNight * exp(-abs(y) * 14.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

  // the cloud slab, ray-marched into a small target
  const CLU = { uShape: { value: null }, uCamPos: { value: new THREE.Vector3() }, uDensity: { value: 1 }, uSunCloudK: { value: 1 },
    uAmbTop: { value: new THREE.Color() }, uAmbBot: { value: new THREE.Color() }, uMaxDist: { value: 65000 }, uFrozen: { value: 0 }, uJitterT: { value: 0 } };
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...SKYU, ...CLU }, vertexShader: RAY_VS, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`precision highp sampler3D;
      ${GLSL_COMMON}\n${GLSL_NOISE}\n${RAY_FN}
      uniform sampler3D uShape; uniform vec3 uCamPos; uniform float uDensity; uniform float uSunCloudK; uniform float uSunI;
      uniform vec3 uAmbTop; uniform vec3 uAmbBot; uniform float uMaxDist; uniform float uJitterT;
      float remap(float v, float l0, float h0, float l1, float h1) { return l1 + (v - l0) * (h1 - l1) / (h0 - l0); }
      float dens(vec3 p, float lod, bool fine) {
        float hn = (p.y - uCloudBase) / (uCloudTop - uCloudBase);
        if (hn < 0.0 || hn > 1.0) return 0.0;
        float cov = hz_coverage(p.xz);
        if (cov < .002) return 0.0;
        float hg = smoothstep(0.0, .16, hn) * smoothstep(1.0, .42, hn);
        vec3 q = p + vec3(uCloudWind.x, 0.0, uCloudWind.y) * uTime;
        vec2 n = textureLod(uShape, q.xzy / vec3(3400.0, 3400.0, 1900.0), lod).rg;
        float base = remap(n.r * hg, 1.0 - (.3 + .58 * cov), 1.0, 0.0, 1.0);
        if (base <= 0.0) return 0.0;
        if (!fine) return base;
        float det = textureLod(uShape, q.xzy / vec3(620.0, 620.0, 520.0) + vec3(0.0, 0.0, uTime * .006), lod).g;
        return clamp(remap(base, det * .45 * (1.25 - hn), 1.0, 0.0, 1.0), 0.0, 1.0);
      }
      void main() {
        vec3 rd = viewRay(), ro = uCamPos;
        float t0, t1;
        if (abs(rd.y) < 1e-5) { t0 = 0.0; t1 = (ro.y > uCloudBase && ro.y < uCloudTop) ? uMaxDist : -1.0; }
        else { float ta = (uCloudBase - ro.y) / rd.y, tb = (uCloudTop - ro.y) / rd.y; t0 = max(min(ta, tb), 0.0); t1 = max(ta, tb); }
        t1 = min(t1, uMaxDist);
        if (t1 <= t0) { gl_FragColor = vec4(0.0); return; }
        float len = t1 - t0;
        float N = clamp(len / 38.0, 14.0, 60.0), dt = len / N;
        float t = t0 + dt * fract(hash12(gl_FragCoord.xy) + fract(uTime * 7.31) * uJitterT);
        float T = 1.0; vec3 L = vec3(0.0);
        float mu = dot(rd, uSunDir);
        float ph = mix(hgPhase(mu, .62), hgPhase(mu, -.22), .32) * 12.566;
        vec3 sd = normalize(vec3(uSunDir.x, max(uSunDir.y, .03), uSunDir.z));
        float sunVis = smoothstep(-.05, .03, uSunDir.y);
        float tHit = -1.0;
        for (int i = 0; i < 60; i++) {
          if (float(i) >= N || T < .015) break;
          vec3 p = ro + rd * t;
          float lod = clamp(log2(t / 3500.0 + 1.0) * 1.3, 0.0, 4.0);
          float d = dens(p, lod, true) * uDensity;
          if (d > .003) {
            if (tHit < 0.0) tHit = t;
            float od = dens(p + sd * 70.0, lod + 1.0, false) * 90.0 + dens(p + sd * 190.0, lod + 1.0, false) * 140.0 + dens(p + sd * 420.0, lod + 1.5, false) * 260.0;
            od *= .045 * uDensity;
            float lt = max(exp(-od), exp(-od * .22) * .32);
            float hn = (p.y - uCloudBase) / (uCloudTop - uCloudBase);
            float powder = 1.0 - exp(-d * 9.0);
            vec3 S = uSunCol * uSunI * uSunCloudK * sunVis * lt * ph * mix(.55, 1.0, powder) + mix(uAmbBot, uAmbTop, hn) * (.55 + .45 * powder);
            float st = d * .045;
            float dT = exp(-st * dt);
            L += T * S * (1.0 - dT);
            T *= dT;
          }
          t += dt;
        }
        if (tHit > 0.0) { vec4 hz = hz_haze(ro + rd * tHit); L = mix(L, hz.rgb * (1.0 - T), hz.a); }
        gl_FragColor = vec4(L, 1.0 - T);
      }`,
  });
  const compMat = new THREE.ShaderMaterial({
    uniforms: { tClouds: { value: null }, uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) } }, vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`uniform sampler2D tClouds; uniform vec2 uTexel; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tClouds, vUv) * .2;
        c += texture2D(tClouds, vUv + uTexel * vec2( 1.3,  .4)) * .1; c += texture2D(tClouds, vUv + uTexel * vec2(-1.3, -.4)) * .1;
        c += texture2D(tClouds, vUv + uTexel * vec2( -.4, 1.3)) * .1; c += texture2D(tClouds, vUv + uTexel * vec2(  .4, -1.3)) * .1;
        c += texture2D(tClouds, vUv + uTexel * vec2( 2.2, 2.0)) * .1; c += texture2D(tClouds, vUv + uTexel * vec2(-2.2, -2.0)) * .1;
        c += texture2D(tClouds, vUv + uTexel * vec2(-2.0, 2.2)) * .1; c += texture2D(tClouds, vUv + uTexel * vec2( 2.0, -2.2)) * .1;
        gl_FragColor = c; }`,
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const quad = new THREE.PlaneGeometry(2, 2), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mk = (m) => { const s = new THREE.Scene(); const q = new THREE.Mesh(quad, m); q.frustumCulled = false; s.add(q); return s; };
  const skyScene = mk(skyMat), cloudScene = mk(cloudMat), compScene = mk(compMat);
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
  compMat.uniforms.tClouds.value = rt.texture;

  const api = {
    skyMat, cloudMat, rt, enabled: true, scale: .5,
    setNoise({ shape, weather }) { cloudMat.uniforms.uShape.value = shape; U.uWeather.value = weather; },
    setLook(L, sunI) {
      SKYU.uZen.value.copy(L.zen); SKYU.uHor.value.copy(L.hor); SKYU.uSunI.value = sunI;
      // ambient light on the clouds: the sky above, the hazy ground below
      CLU.uAmbTop.value.copy(L.zen).lerp(L.hor, .5).multiplyScalar(.9 + .3 * L.day);
      CLU.uAmbBot.value.copy(L.hor).lerp(L.ground, .5).multiplyScalar(.45);
    },
    resize(w, h) { const s = api.scale; rt.setSize(Math.max(64, Math.round(w * s)), Math.max(64, Math.round(h * s))); compMat.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height); },
    update(camera) {
      SKYU.uCamMat.value.copy(camera.matrixWorld); SKYU.uInvProj.value.copy(camera.projectionMatrixInverse); CLU.uCamPos.value.copy(camera.position);
    },
    below(camera) { return camera.position.y < U.uCloudBase.value - 1; },
    renderSky(renderer) { renderer.render(skyScene, cam); },
    renderClouds(renderer) {           // into the small target
      const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
      if (api.enabled && U.uCloudCover.value > .01) renderer.render(cloudScene, cam);
      renderer.setRenderTarget(prev);
    },
    composite(renderer) { if (api.enabled) renderer.render(compScene, cam); },
  };
  return api;
}
