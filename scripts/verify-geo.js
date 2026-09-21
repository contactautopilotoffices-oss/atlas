/* Quality gate for digitide/geo.js.

   Three failure modes this catches, in the order they would hurt:
     1. a coordinate in the wrong city, which is the one that gets noticed on
        screen and discredits everything beside it;
     2. a coordinate outside India entirely, usually a swapped lat/lng;
     3. a pin claiming "building" precision while sitting implausibly far from
        its own city, which means the claim is wrong even if the point is real.

   Run: node scripts/verify-geo.js        (exits non-zero on any failure) */
const path = require('path');
global.window = {};
for (const f of ['facilities.js', 'geo.js', 'intel.js'])
  require(path.join(__dirname, '..', 'digitide', f));
const { DG_FACILITIES, DG_GEO, DG_CITIES } = global.window;

const IN = { latMin: 6.5, latMax: 35.7, lngMin: 68.0, lngMax: 97.5 };
const km = (a, b, c, d) => {
  const t = x => x * Math.PI / 180, R = 6371;
  const h = Math.sin(t(c - a) / 2) ** 2 +
    Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
/* A city pin may legitimately sit well outside a metro centroid; a building
   pin may not. Different tolerances for different claims. */
const TOL = { building: 45, street: 45, locality: 60, city: 120 };

const fail = [], warn = [];
let checked = 0;
for (const f of DG_FACILITIES){
  const g = DG_GEO[f.sr];
  if (!g) continue;
  checked++;
  const c = DG_CITIES[f.city];
  const where = `#${f.sr} ${f.facility} (${f.location})`;
  if (g.lat < IN.latMin || g.lat > IN.latMax || g.lng < IN.lngMin || g.lng > IN.lngMax)
    fail.push(`${where}: ${g.lat},${g.lng} is outside India`);
  else if (!c) warn.push(`${where}: no city record to check against`);
  else {
    const d = km(g.lat, g.lng, c.lat, c.lng);
    if (d > (TOL[g.precision] ?? 60))
      fail.push(`${where}: ${d.toFixed(1)} km from ${c.name} centroid, too far for precision "${g.precision}"`);
  }
  if (!['building','street','locality','city'].includes(g.precision))
    fail.push(`${where}: unknown precision "${g.precision}"`);
  if (!g.source) warn.push(`${where}: no source recorded`);
}

const tally = {};
for (const sr of Object.keys(DG_GEO)) tally[DG_GEO[sr].precision] = (tally[DG_GEO[sr].precision] || 0) + 1;
console.log(`geo.js: ${checked} of ${DG_FACILITIES.length} facilities pinned`);
console.log('precision:', JSON.stringify(tally));
warn.forEach(w => console.log('  WARN', w));
if (fail.length){ fail.forEach(f => console.error('  FAIL', f)); process.exit(1); }
console.log('all pinned coordinates are inside India and consistent with their city');
