import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from '../../../engine/vendor/three/three.module.min.js';

const threeURL = new URL('../../../engine/vendor/three/three.module.min.js', import.meta.url).href;
const source = (await fs.readFile(new URL('../js/xp/overlays.js', import.meta.url), 'utf8'))
  .replace("from 'three'", `from '${threeURL}'`)
  .replace("import { U, W } from './core.js';", 'const U={uTime:{value:0}}, W=(x,y,h)=>new THREE.Vector3(x,h,-y);');
const { buildOverlays } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

// A hill between two equal-height route vertices must not swallow the line.
const hill = x => 24 * Math.exp(-(((x + 850) / 45) ** 2));
const raised = buildOverlays({ route: { route: [[-700, -10], [-1000, -10]] }, heightAt: hill });
const points = raised.walk.userData.points;
assert(points.length > 100);
for (const p of points) assert(p.y > hill(p.x), 'The route must clear intermediate terrain, not only its endpoints.');

const route = JSON.parse(await fs.readFile(new URL('../../demo/data/route.json', import.meta.url), 'utf8'));
const real = buildOverlays({ route, heightAt: () => 0 });
for (const [point, xy] of [[real.walk.userData.points[0], route.route[0]], [real.walk.userData.points.at(-1), route.route.at(-1)]]) {
  assert(point.distanceTo(new THREE.Vector3(xy[0], point.y, -xy[1])) < 1e-6, 'Preserve the sourced station and gate coordinates.');
}
assert(real.arrival.userData.points.every(p => p.y < 1), 'The guided entrance path must finish at ground level before the CAD handoff.');
console.log('PASS: terrain crest clearance, sourced route endpoints, ground-level CAD approach.');
