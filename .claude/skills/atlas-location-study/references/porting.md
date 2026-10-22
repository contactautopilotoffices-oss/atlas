# Putting a study on another website

A study is a plain folder of static files. Anything that can serve files can host it: your own site, Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3, or a shared host. There is nothing to install and no server code.

```
<slug>/
  index.html     layout and styles (same for every study)
  app.js         the UI (same for every study)
  data.js        this study (from pack_data.js)
  config.js      your Mapbox public token (you create it)
  logo.png
  media/hexfield-wide.webp, hexfield-tall.webp (+ .jpg)
```

## Steps

1. **Build the study** with the main process in `SKILL.md` (copy the template, `study.json`, `pack_data.js`, `render_backdrop.js`).
2. **Mapbox token.** Create a free Mapbox account, make a *public* token (starts `pk.`), and under URL restrictions add your site, e.g. `https://www.yoursite.com/*`. Copy `config.example.js` to `config.js` and paste it in. Never use a secret (`sk.`) token: every file in the folder is sent to every visitor. Without a token the page still works; the map shows "Map unavailable".
3. **Try it locally:** `cd <slug> && python3 -m http.server 8000`, open `http://localhost:8000/`. Add `http://localhost:8000/*` to the token's allowed URLs while testing, or the map will refuse to load.
4. **Run the checker** on the folder (`check_study.js`). It does not need the token.
5. **Upload the folder** so it is served at `https://yoursite.com/<something>/<slug>/`. The page needs the trailing slash (or `/index.html`); it adds the slash itself if someone types the address without it.
6. **Open it on a phone and a laptop**, sign in, open an option, turn on Satellite.

## By kind of website

**Static site or any host where you can upload files** (cPanel, S3, Netlify, Vercel, Cloudflare Pages, GitHub Pages): upload the folder as is. Done.

**Next.js / Nuxt / SvelteKit / Astro:** put the folder in `public/studies/<slug>/` (Next.js, Nuxt 3, Astro) or `static/studies/<slug>/` (SvelteKit). Link to `/studies/<slug>/index.html`; the frameworks don't serve `index.html` for a bare folder path unless you add a rewrite, for example in `next.config.js`:
```js
async rewrites() { return [{ source: "/studies/:slug/", destination: "/studies/:slug/index.html" }]; }
```
Don't import `app.js` into a React or Vue component. It owns the whole page (it looks up elements by id, listens on `window` and `document`, and manages the URL hash), so it belongs in its own page, linked or framed.

**WordPress, Webflow, Wix, Squarespace, Framer:** these can't serve a folder of scripts reliably. Host the folder on a free static host (Cloudflare Pages, Netlify or Vercel) on a subdomain such as `atlas.yoursite.com`, then link to it from a button, or embed it:
```html
<iframe src="https://atlas.yoursite.com/<slug>/" style="width:100%;height:85vh;border:0;border-radius:12px" allow="fullscreen; clipboard-write" loading="lazy" title="Office location study"></iframe>
```
A full page reads better than a frame; the map, the sign-in and "Copy link" all work best at the study's own address.

## Content Security Policy

If your site sends a CSP header, the study needs:
```
script-src  'self' 'unsafe-inline' https://api.mapbox.com;
style-src   'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com;
font-src    https://fonts.gstatic.com;
img-src     'self' data: blob: https://*.mapbox.com https://services.arcgisonline.com;
connect-src https://*.mapbox.com https://events.mapbox.com https://services.arcgisonline.com;
worker-src  blob:;
child-src   blob:;
```
`'unsafe-inline'` covers the two small inline scripts in `index.html` (the address fix and the start-up); move them into files if your policy forbids inline code.

## Licences and credits

- **Mapbox:** keep the attribution control (bottom right) on the map. The free tier covers 50,000 map loads a month.
- **Esri World Imagery:** the satellite chip and roof crops use Esri's public World Imagery service, credited on the page. Esri's terms of use apply; for commercial use outside ArcGIS, read them and consider an ArcGIS Location Platform account. To turn Esri off entirely, set `"imagery": false` in `meta` and re-pack: the Satellite chip and roof crops disappear and option tiles show their number and fit colour instead.
- **GTFS and OpenStreetMap data:** keep the credit line (`bus.credit`, line `note`s). ODbL data needs attribution.
- **Fonts:** Playfair Display and IBM Plex Mono from Google Fonts (open licences).
- **The Autopilot logo** is Autopilot's. Replace `logo.png` and `meta.text.brand` for any other brand.

## Privacy: what the sign-in does and doesn't do

The sign-in compares a SHA-256 of the ID and password with the hash in `data.js`. It keeps casual visitors out of the view and keeps the password out of the files, but `data.js` is still downloadable by anyone who knows its URL. That is fine for a shortlist built from public data and the client's own sheet; it is not fine for anything that must stay confidential.

For real protection, put the folder behind your host's access control instead of (or as well as) the page's sign-in:
- **Cloudflare Access** (free for small teams): email one-time codes per person.
- **Netlify** password protection or basic auth; **Vercel** deployment protection (paid plans).
- **Your own server:** serve the folder only after your normal login, then set `meta.gate.hash` empty so people sign in once.

## Updating a live study

Edit `study.json`, re-run `pack_data.js`, upload the new `data.js`. Browsers cache scripts: bump the `?v=1` on the `data.js` (and `app.js` if it changed) script tags in `index.html` to `?v=2` so everyone gets the new version.

## Inside the ATLAS repo, for comparison

The ATLAS site (Vercel) differs from a plain host in four ways:
- `config.js` is generated at the site root by `scripts/build-config.js` from the `MAPBOX_TOKEN` environment variable, so studies load `../config.js`.
- `vercel.json` redirects `/<slug>` to `/<slug>/`.
- The site root has its own login (`index.html` + `clients/manifest.js`): an entry `"<ID>": { redirect: "/<slug>/", passHash: "<passHash from make_password.py>" }` sends people from `atlas.autopilotoffices.com` to the study, and the study's `meta.gate.handoff` (`"/<slug>/"`) lets them in without signing in twice.
- `atlas-cms.js` adds the admin panel (switch tabs, layers and presets off per study, broker-stated figures, visit counts). For a template study, add an entry to `ADAPTERS` in `atlas-cms.js` with `scripts: ["/<slug>/data.js"]`, `props: "ATLAS_OPTIONS"`, `facts: "ATLAS_FACTS"`, and include the script tag in `index.html`. Optional: the page runs without it.
