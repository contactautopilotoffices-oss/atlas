/* Build-time generator for config.js.

   Reads public runtime config from the environment and writes the window.* globals
   index.html expects, so nothing secret is committed to Git.

   On what belongs here: MAPBOX_TOKEN and SUPABASE_ANON_KEY are PUBLISHABLE keys —
   they are designed to sit in a browser bundle, and the Supabase anon key is safe
   only because row-level security is enabled (anon may SELECT, never write; verified
   against the live project). A Supabase service_role key or a Mappls client secret
   must NEVER be added to this file — those stay server-side behind /api. */

const fs = require('fs');
const path = require('path');

const token = process.env.MAPBOX_TOKEN;
if (!token) {
  console.error('Error: MAPBOX_TOKEN environment variable is not set.');
  process.exit(1);
}

const sbUrl = process.env.SUPABASE_URL || '';
const sbKey = process.env.SUPABASE_ANON_KEY || '';
if (!sbUrl || !sbKey) {
  console.warn('Warning: SUPABASE_URL / SUPABASE_ANON_KEY not set — the app will fall back to the local media manifest.');
}

// Refuse to ship a service_role key even if one is mis-set in the environment.
if (sbKey && /"role"\s*:\s*"service_role"/.test(Buffer.from((sbKey.split('.')[1] || ''), 'base64').toString('utf8'))) {
  console.error('Error: SUPABASE_ANON_KEY looks like a service_role key. Refusing to write it into the browser bundle.');
  process.exit(1);
}

// Google Maps Platform BROWSER key (Map Tiles API for photorealistic 3D tiles,
// Maps Embed API). It is meant to sit in the browser; restrict it in Google
// Cloud to the site's referrers and to those APIs. Optional: pages that need it
// fall back to their own model when it is missing.
const gKey = process.env.GOOGLE_MAPS_BROWSER_KEY || '';

// Cesium ion access token (browser): serves the same Google photorealistic 3D
// tiles (ion asset 2275207) without a Google Cloud billing account. Optional;
// restrict it in Cesium ion to the site's URLs and to that asset.
const ionToken = process.env.CESIUM_ION_TOKEN || '';

const outPath = path.join(__dirname, '..', 'config.js');
const content = [
  `window.MAPBOX_TOKEN = ${JSON.stringify(token)};`,
  `window.SUPABASE_URL = ${JSON.stringify(sbUrl)};`,
  `window.SUPABASE_ANON_KEY = ${JSON.stringify(sbKey)};`,
  `window.GOOGLE_MAPS_KEY = ${JSON.stringify(gKey)};`,
  `window.CESIUM_ION_TOKEN = ${JSON.stringify(ionToken)};`,
  ''
].join('\n');

fs.writeFileSync(outPath, content, 'utf8');
console.log('Generated config.js (mapbox + supabase public config).');
