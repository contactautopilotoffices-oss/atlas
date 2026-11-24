// Soft cumulus layers for the descent (the same cloud shader as the Andheri film), drawn in a WebGL canvas over the map. Each layer is a flat deck at a height
// below the camera; a screen pixel looks straight down through it, so a deck's features grow and slide outward as the
// camera sinks towards it (true parallax against the map), and it fills the frame as the camera passes through it.
// Everything is a pure function of the uniforms, so a frame is the same however many times it is drawn.
const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `precision highp float;
uniform vec2 uRes; uniform float uA; uniform vec2 uCam, uRight, uUp, uSun; uniform float uT, uHaze, uFog, uShadow, uFogS;
uniform vec4 uL[4]; uniform vec3 uD[4]; uniform float uF[4];
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
 vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx); vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
 vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i); vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
 vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.); m=m*m; m=m*m;
 vec3 x=2.*fract(p*C.www)-1.; vec3 h=abs(x)-.5; vec3 ox=floor(x+.5); vec3 a0=x-ox; m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
 vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw; return 130.*dot(m,g);}
float fbm(vec2 p){float a=.5,s=0.; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<6;i++){s+=a*snoise(p); p=r*p*2.02+vec2(1.7,9.2); a*=.5;} return s;}
float fbm3(vec2 p){float a=.5,s=0.; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<3;i++){s+=a*snoise(p); p=r*p*2.02+vec2(1.7,9.2); a*=.5;} return s;}
float billow(vec2 p){float a=.5,s=0.; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<5;i++){s+=a*abs(snoise(p)); p=r*p*2.03+vec2(3.1,1.7); a*=.5;} return s;}
float fbm4(vec2 p){float a=.5,s=0.; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<4;i++){s+=a*snoise(p); p=r*p*2.02+vec2(1.7,9.2); a*=.5;} return s;}
// deck L at world point w (km): x = coverage alpha, y = thickness (for shading). D: a denser patch (centre, radius)
vec2 dens(vec2 w, vec4 L, vec3 D, float seed, bool cheap){
  vec2 p = w / L.z + vec2(seed, seed * .37) + vec2(uT * .02, uT * .008);
  float shape = fbm4(p * .5) * .5 + .5;
  float cov = L.y;
  if (D.z > 0.) { vec2 r = (w - D.xy) / D.z; cov -= .34 * exp(-dot(r, r)); }
  float h = shape - cov;
  h += cheap ? (abs(snoise(p * 1.7)) - .38) * .10 : (billow(p * 1.7) - .40) * .17;
  return vec2(smoothstep(0., .15, h), h);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec2 ax = uRight * uv.x + uUp * uv.y;
  // cloud shadows on the ground, then the high-altitude haze, then the decks from the lowest (farthest) up
  float sh = 0.;
  vec2 g = uCam + ax * .6667 * uA;
  for (int i = 0; i < 4; i++) { vec4 L = uL[i]; if (L.w <= 0. || uA - L.x <= 0.) continue;
    sh += dens(g + uSun * L.z * .9, L, uD[i], float(i) * 13.1, true).x * L.w; }
  vec4 acc = vec4(0., 0., 0., clamp(sh, 0., 1.) * uShadow);
  vec3 hz = vec3(.86, .90, .95);
  acc = vec4(hz * uHaze, uHaze) + acc * (1. - uHaze);
  for (int i = 0; i < 4; i++) { vec4 L = uL[i]; float d = uA - L.x; if (L.w <= 0. || d <= .0) continue;
    vec2 w = uCam + ax * .6667 * d;
    vec2 c0 = dens(w, L, uD[i], float(i) * 13.1, false);
    vec2 c1 = dens(w - uSun * L.z * .05, L, uD[i], float(i) * 13.1, false);
    float lit = clamp(.66 + (c0.y - c1.y) * 3.2 + smoothstep(.0, .3, c0.y) * .18, 0., 1.);
    vec3 col = mix(vec3(.62, .68, .77), vec3(1., .996, .988), lit);
    float a = c0.x * L.w * smoothstep(0., uF[i], d / uA);   // dissolves as the camera reaches it (no pop)
    acc = vec4(col * a, a) + acc * (1. - a);
  }
  // inside the main deck: a soft moving whiteout with texture
  if (uFog > 0.) { float f = uFog * (.78 + .22 * (fbm3(uv * uFogS + vec2(3.1, 7.7)) * .5 + .5));
    vec3 fc = vec3(.93, .95, .975); acc = vec4(fc * f, f) + acc * (1. - f); }
  gl_FragColor = acc;
}`;

export function makeClouds(canvas, scale = 1) {
  canvas.width = 1920 * scale; canvas.height = 1080 * scale;
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true, antialias: false });
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(pr, n);
  const u = { res: U('uRes'), A: U('uA'), cam: U('uCam'), right: U('uRight'), up: U('uUp'), sun: U('uSun'), t: U('uT'), haze: U('uHaze'), fog: U('uFog'), fogS: U('uFogS'), shadow: U('uShadow'), L: U('uL'), D: U('uD'), F: U('uF') };
  return {
    // p: { A km, cam [x,y] km, bearing deg, t s, haze, fog, shadow, layers: [{h, cov, scale, alpha, dense:[x,y,r]}] }
    draw(p) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      const br = p.bearing * Math.PI / 180;
      gl.uniform2f(u.res, canvas.width, canvas.height); gl.uniform1f(u.A, p.A); gl.uniform2f(u.cam, p.cam[0], p.cam[1]);
      gl.uniform2f(u.right, Math.cos(br), -Math.sin(br)); gl.uniform2f(u.up, Math.sin(br), Math.cos(br));
      gl.uniform2f(u.sun, .55, .35); gl.uniform1f(u.t, p.t); gl.uniform1f(u.haze, p.haze); gl.uniform1f(u.fog, p.fog); gl.uniform1f(u.fogS, p.fogS || 2.); gl.uniform1f(u.shadow, p.shadow);
      const L = new Float32Array(16), D = new Float32Array(12), F = new Float32Array([.2, .2, .2, .2]);
      p.layers.slice(0, 4).forEach((l, i) => { L.set([l.h, l.cov, l.scale, l.alpha], i * 4); D.set(l.dense || [0, 0, 0], i * 3); F[i] = l.fade || .2; });
      gl.uniform4fv(u.L, L); gl.uniform3fv(u.D, D); gl.uniform1fv(u.F, F);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    clear() { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
  };
}
