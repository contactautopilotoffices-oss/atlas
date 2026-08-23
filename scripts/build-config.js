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

const outPath = path.join(__dirname, '..', 'config.js');
const content = [
  `window.MAPBOX_TOKEN = ${JSON.stringify(token)};`,
  `window.SUPABASE_URL = ${JSON.stringify(sbUrl)};`,
  `window.SUPABASE_ANON_KEY = ${JSON.stringify(sbKey)};`,
  ''
].join('\n');

fs.writeFileSync(outPath, content, 'utf8');
console.log('Generated config.js (mapbox + supabase public config).');
