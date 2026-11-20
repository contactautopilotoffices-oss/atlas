// Post: one multisampled HDR target (4x MSAA, half float) for the world, gentle bloom only at dusk and night, a filmic
// grade (soft vignette, the in-cloud veil, fades), then AgX tone mapping and sRGB in the output pass.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

class WorldPass extends Pass {
  constructor(draw) { super(); this.draw = draw; this.needsSwap = false; }
  render(renderer, writeBuffer, readBuffer) { renderer.setRenderTarget(this.renderToScreen ? null : readBuffer); this.draw(renderer); }
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: .22 }, uVeil: { value: 0 }, uVeilCol: { value: new THREE.Color(.9, .9, .92) }, uFade: { value: 0 }, uFadeCol: { value: new THREE.Color(0, 0, 0) },
    uTime: { value: 0 }, uGrain: { value: .012 }, uAspect: { value: 1.7 }, uSat: { value: 1.0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette; uniform float uVeil; uniform vec3 uVeilCol; uniform float uFade; uniform vec3 uFadeCol;
    uniform float uTime; uniform float uGrain; uniform float uAspect; uniform float uSat; varying vec2 vUv;
    float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(.2126, .7152, .0722)); c = mix(vec3(l), c, uSat);
      vec2 q = (vUv - .5) * vec2(uAspect, 1.0); float r = dot(q, q);
      c *= 1.0 - uVignette * smoothstep(.12, 1.1, r);
      c = mix(c, uVeilCol * (1.0 + .06 * (h(floor(vUv * 64.0)) - .5)), uVeil);
      c += (h(vUv * 1931.0 + uTime) - .5) * uGrain * (l + .05);
      c = mix(c, uFadeCol, uFade);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export function createPost(renderer, draw) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4, colorSpace: THREE.LinearSRGBColorSpace });
  const composer = new EffectComposer(renderer, rt);
  const world = new WorldPass(draw); composer.addPass(world);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), .35, .55, 1.6); bloom.enabled = false; composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  const out = new OutputPass(); composer.addPass(out);
  return {
    composer, bloom, grade: grade.uniforms,
    setSize(w, h, dpr) { composer.setPixelRatio(dpr); composer.setSize(w, h); grade.uniforms.uAspect.value = w / h; },
    render(dt) { composer.render(dt); },
  };
}
