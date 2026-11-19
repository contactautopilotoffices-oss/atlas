// Time of day for Reliable Tech Park (19.169 N, 73.002 E, IST): the real sun position (NOAA approximation), and the
// sky, light colours, fog and exposure that go with it. One slider drives morning -> golden hour -> blue hour -> night.
import * as THREE from 'three';

const LAT = 19.1692159, LNG = 73.0017703, TZ = 5.5;
const R = Math.PI / 180;
// sun azimuth (deg clockwise from north) and elevation (deg) for a local IST hour on a date
export function sunAt(hour, date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0), doy = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 864e5);
  const g = 2 * Math.PI / 365 * (doy - 1 + (hour - 12) / 24);
  const eq = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
  const dec = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  const tst = hour * 60 + eq + 4 * LNG - 60 * TZ, ha = (tst / 4 - 180) * R, lat = LAT * R;
  const cz = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha), zen = Math.acos(Math.max(-1, Math.min(1, cz)));
  let az = Math.acos(Math.max(-1, Math.min(1, (Math.sin(lat) * Math.cos(zen) - Math.sin(dec)) / (Math.cos(lat) * Math.sin(zen))))) / R;
  if (ha > 0) az = (az + 180) % 360; else az = (540 - az) % 360;
  return { az, el: 90 - zen / R };
}
// a unit vector toward the sun in three.js (x east, y up, z = -north)
export function sunDir(az, el) { const a = az * R, e = el * R; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); }

const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));
// the look for a sun elevation (deg): day, golden, blue hour, night. Returns colours, intensities and night factor.
export function lookFor(el) {
  const day = THREE.MathUtils.smoothstep(el, 6, 30), gold = THREE.MathUtils.smoothstep(el, -2, 6) * (1 - THREE.MathUtils.smoothstep(el, 10, 22));
  const night = 1 - THREE.MathUtils.smoothstep(el, -9, 1);
  const zen = mix(mix('#0b1830', '#2c4f86', 1 - night), '#5f93cf', day), hor = mix(mix(mix('#1a2236', '#e8a873', 1 - night), '#f2c48d', gold), '#dfe9ef', day);
  const sunC = mix(mix('#ff9a52', '#ffd6a3', THREE.MathUtils.smoothstep(el, 4, 18)), '#fff3e2', day);
  return { day, gold, night, zen, hor, ground: mix('#2b2a2a', '#a59e92', 1 - night * .85),
    sunColor: sunC, sunI: (1 - night) * (.6 + 2.0 * THREE.MathUtils.smoothstep(el, 0, 25)), hemiI: .18 + .7 * (1 - night) * (.5 + .5 * day),
    // the haze is the horizon's colour (never navy against a peach sky)
    fog: hor.clone().lerp(new THREE.Color('#dfe6ea'), .3 * day), fogNear: 380 - 120 * gold, fogFar: 1150 - 350 * gold - 300 * night,
    exposure: 1.1 + .25 * gold + .35 * night };
}
// the sky as an equirect canvas: gradient + a sun disc (or a moon at night) at the right place
export function skyCanvasTexture(L, az, el) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#' + L.zen.getHexString()); gr.addColorStop(.72, '#' + L.zen.clone().lerp(L.hor, .6).getHexString()); gr.addColorStop(1, '#' + L.hor.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
  const gg = g.createLinearGradient(0, 256, 0, 512); gg.addColorStop(0, '#' + L.hor.clone().lerp(L.ground, .5).getHexString()); gg.addColorStop(1, '#' + L.ground.getHexString()); g.fillStyle = gg; g.fillRect(0, 256, 1024, 256);
  // three's equirect lookup (equirectUv): u = atan(dir.z, dir.x) / 2pi + 0.5, v = asin(dir.y) / pi + 0.5; the canvas is
  // flipped (flipY), so row = (0.5 - asin(y) / pi) * H. Glows are drawn three times so they wrap across the seam.
  const toUV = (d) => [((.5 + Math.atan2(d.z, d.x) / (2 * Math.PI)) * 1024 + 1024) % 1024, (.5 - Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI) * 512];
  const glow = (u, v, r, stops) => { for (const du of [-1024, 0, 1024]) { const s = g.createRadialGradient(u + du, v, 0, u + du, v, r); for (const [o, c] of stops) s.addColorStop(o, c); g.fillStyle = s; g.fillRect(u + du - r, v - r, 2 * r, 2 * r); } };
  const [u, v] = toUV(sunDir(az, Math.max(el, -4)));
  if (L.night < .95) glow(u, v, 120 + 80 * L.gold, [[0, `rgba(255,245,225,${.95 - L.night * .6})`], [.12, `rgba(255,214,160,${.55 * (1 - L.night)})`], [1, 'rgba(255,200,150,0)']]);
  if (L.night > .3) { // the moon where the night light comes from (main.js: sunDir(az + 180, 35)), and a city glow on the horizon
    const [mu, mv] = toUV(sunDir((az + 180) % 360, 35)); glow(mu, mv, 40, [[0, `rgba(235,240,255,${L.night})`], [.2, `rgba(200,215,255,${.35 * L.night})`], [1, 'rgba(200,215,255,0)']]);
    const cg = g.createLinearGradient(0, 200, 0, 256); cg.addColorStop(0, 'rgba(255,150,90,0)'); cg.addColorStop(1, `rgba(255,150,90,${.25 * L.night})`); g.fillStyle = cg; g.fillRect(0, 200, 1024, 56); }
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
// slider positions -> local hours (sunrise to night), labelled
export const STOPS = [{ h: 7.0, label: 'Sunrise' }, { h: 10.0, label: 'Morning' }, { h: 13.0, label: 'Midday' }, { h: 17.6, label: 'Golden hour' }, { h: 18.7, label: 'Blue hour' }, { h: 21.0, label: 'Night' }];
