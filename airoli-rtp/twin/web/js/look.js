// Shared look: a sky for the background and for reflections, and clear vision glass.
import * as THREE from 'three';

// A simple sky: blue at the zenith, pale at the horizon, warm grey below. Used as the background and, through
// PMREM, as the environment every glass pane reflects (so edges catch the sky, face-on panes stay see-through).
export function skyTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#6f9fd2'); gr.addColorStop(.32, '#a9c6e2'); gr.addColorStop(.485, '#e9eef0'); gr.addColorStop(.5, '#d9d4cb');
  gr.addColorStop(.56, '#a59e92'); gr.addColorStop(1, '#6f6a62');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  // a soft sun glow, so reflections have a highlight to pick up
  const s = g.createRadialGradient(150, 70, 0, 150, 70, 60); s.addColorStop(0, 'rgba(255,250,235,.95)'); s.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = s; g.fillRect(60, 0, 190, 150);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Vision glass: slightly green-grey, mostly see-through face-on, more reflective and opaque at grazing angles
// (a Fresnel term on alpha; the reflection itself comes from the environment). Front side only, no depth write,
// drawn after opaque things (renderOrder set by the caller). Same material on desktop and phones: no transmission
// pass, so it costs nothing extra.
export function glassMaterial({ color = 0xa9bdb4, opacity = .13, edge = .7, env = 1.8, tint = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(tint), roughness: .02, metalness: .05, transparent: true, opacity,
    depthWrite: false, side: THREE.FrontSide, envMapIntensity: env });
  m.userData.glass = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEdge = { value: edge };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uEdge;')
      .replace('#include <opaque_fragment>', `{ float fr = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 4.0);
          diffuseColor.a = mix(diffuseColor.a, uEdge, fr); }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'glass-fresnel';
  return m;
}
