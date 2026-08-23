# ATLAS — Baseline Recon
Date: 2026-08-22. Branch: atlas-build. Method: full code walkthrough (every claim below cites file:line). Live walkthrough with screenshots is pending the Mapbox token (config.js currently ships placeholder `pk.YOUR_TOKEN`; no token in env) — screenshot pairs will be appended here as `recon/baseline-*.png` once supplied.

## 1. What the app actually is
- Static site, no framework, no backend. Entry `index.html`; served locally by `serve.py` (port 8080); deployed to Vercel as static (`vercel.json` runs `scripts/build-config.js`, which injects `MAPBOX_TOKEN` from env into gitignored `config.js`).
- Hybrid renderer: Mapbox GL JS v3.10.0 basemap (`mapbox://styles/mapbox/standard`, `mapbox_app.js:214`) + Three.js 0.160.0 custom layers on the same WebGL canvas (`world_layer.js`, GLB layer for One BKC, traffic layer).
- Login is a client-side gate: `clients/manifest.js` holds 4 accounts with plaintext passwords in shipped JS (FLIPDEMOACC, VFSDEMOACC, CPDEMOACC, INVDEMOACC). Session in localStorage, 7 days (`index.html:466-479`). Success injects `clients/<slug>/{config,data,geo}.js` then `mapbox_app.js` (`index.html:350-452`).

## 2. What moves / glows / is populated (kill-list candidates — full list in recon/KILL_LIST.md)
- 240 instanced box cars on road centrelines, per-frame animated (`mapbox_app.js:2428-2542`), toggle `t-traffic`. Bound to NO real data.
- Animated train dot on metro line, vfs-bkc only (`mapbox_app.js:1283-1330`).
- Building grow-in animation on load (`mapbox_app.js:2549-2564`, GLB grow `917-931`).
- Hero orbit camera + cinematic auto-orbit (`mapbox_app.js:1438-1453`, `2121-2135`).
- Emissive window glow, night headlights, live rain via Open-Meteo (`world_layer.js:44-81`, `mapbox_app.js:2208-2240`).
- NO pedestrians/birds/cranes/animated signage exist. Trees/lamps static.
- Walkthrough engine (`mapbox_app.js:2692-2936`) references `walkthrough/*.jpeg` — directory does not exist in repo.

## 3. Clients today
- vfs-bkc (default, full feature set), cp-delhi, flipkart-andheri, invesco-andheri. Each = config.js + data.js + geo.js under `clients/<slug>/`.
- Bug found: `addMetroLines` early-returns unless slug is vfs-bkc (`mapbox_app.js:1156`) — Delhi/Andheri metro data defined but never drawn.
- `app.js` (33KB legacy pure-Three version) is dead code, unreferenced.

## 4. Data & evidence state at baseline
- No evidence ledger, no provenance, no render gate. All building numbers (heights, floors, costs) are hardcoded in `data.js` files with no sources.
- No Mappls integration. Mapbox Directions API used for walk/drive routes (`mapbox_app.js:1618+`).
- Building footprints from OSM (`buildings_geo.js` / `clients/*/geo.js`), matched by `footprintMatcher` (`mapbox_app.js:448-508`).
- Repo size: ~87MB working tree, 26MB .git; 58MB `GLB_3D/One BKC 3D Model.glb` committed.
- `.gitignore` hazards confirmed: `*.jpg` with ignorecase swallows `.JPG`; videos (*.mp4/*.mov) NOT ignored. Must invert before media ingest (brief §11.3).

## 5. New inputs received 2026-08-22
- `Basilic Fly inventory options .pdf` (11 pp) — extracted to `recon/basilic_deck_text.txt`. 6 options: Primeco Union City Tower B (9800/seat), Total Environment Mahadevapura (9600), Sumadhura Capitol (10200), Y Living (9600), ITPL Explorer Block (10900), Brigade Utopia Elysium (9500). All claims ledgered as client-stated/unconfirmed in `evidence/ledger.jsonl`.
- Deck vs brief mismatch: brief's shortlist names Starmark Camelot + Verman (absent from deck); deck adds ITPL + Brigade Utopia (absent from brief); user mentions Purva Gainz (Electronic City) with a flagged deck distance error. Shortlist is fluid → build for N, never hardcode count.
- Card priorities from user: per-seat cost, location, metro connectivity + distance to nearest metro, pictures.
- Budget band 8000–9500/seat: every deck option is at or above the band top.

## 6. Blockers at baseline (per brief §12 protocol)
- Mappls credentials: not available → Phase 1/3 blocked; finding to be filed in `evidence/mappls-endpoints.md`. All deck figures remain `unconfirmed` until re-derived.
- Mapbox token: awaiting value → scene cannot render locally; screenshots pending.
- Media archives (Starmark/Primeco/Sumadhura): user to drop into repo → Phase 6 ingest pending.
- FLYDEMOACC password: user to supply → account wiring pending.

## 7. Camera positions (fixed, used every cycle per brief §14)
- `recon/cam-default.txt` — default load view, per client slug.
- `recon/cam-hero.txt` — selected hero building view.
- `recon/cam-overview.txt` — zoomed-out full scene.
(Values recorded when screenshots are taken; same positions forever.)
