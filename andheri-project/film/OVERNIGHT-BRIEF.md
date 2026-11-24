# Overnight brief: Andheri film and the experience, 23 to 24 Nov 2026

The founder is asleep and reviews in the morning. Work autonomously and do not ask questions: decide, record the decision, and move on. Everything stays local and committed on branch `feat/andheri-district-twin`. Nothing is published or deployed.

## The goal

A client opens the Flipkart Andheri experience, clicks **Enter the experience**, and watches a two-minute film. When the film ends, the three properties appear as choices. Everything must look ultra premium; the founder's word for the current state was "cartoonish". The film's script is `andheri-project/film/SCRIPT.md` (draft 4). Its language is the Reliable Tech Park film's: Autopilot as the partner helping Flipkart choose, never a feature list.

## Canonical facts. Use these and nothing else.

| | Privilon | Corporate Avenue | 723 Avenue |
| --- | --- | --- | --- |
| Micro-market | Marol | Chakala | Marol |
| Building | Grade A, G+15, new | Grade A-, G+8, gated campus; Flipkart's floors are in **Atul Corporate Avenue** | Grade A, G+15 |
| Offered | single floor plate, plans for 260 / 280 / 301 workstations | 3rd and 4th floors, 6,207 sq ft carpet each (12,414 sq ft total); plans 266 / 281 / 373 | 13th and 14th floors plus the terrace (available to Flipkart, confirmed by the founder) |
| Carpet | 11,331 sq ft | 12,414 sq ft | 11,331 sq ft |
| Condition and possession | bare shell, Jan 2027 | ready now (do not say furnished or warm shell: the sources disagree) | bare shell, immediate |
| Metro walk | Marol Naka (Line 1), **140 m, about 2 min** | Chakala (J B Nagar, Line 1), **850 m, about 11 min** | Marol Naka (Line 1), **700 m, about 9 min** |
| Pin (lat, lng) | 19.10827, 72.87968 (real plot, front edge on Fleet House's road line) | Atul Corporate Avenue: 19.110625, 72.859637 | 19.1096039, 72.8843436 |

- **Stations:** Marol Naka (Line 1) at about 19.108195, 72.879536; Line 3 Marol Naka (underground) next to it; Chakala (J B Nagar) at 19.112045, 72.867696.
- **Autopilot figures** (from the Reliable film): 15,000+ seats, 20+ centres, 7 cities. Belief: *Pehle vyavahar, phir vyapar*, "relationship first, business next".
- **Brand:**
  - Flipkart blue `#2A55E5` and yellow `#FFC200`. The Flipkart logo is **blue and yellow**, on a **transparent** background, never on a white plaque.
  - The Autopilot logo is also transparent: white on dark, black on light.

## Who owns what (never edit another owner's files)

- **Integrator (main session):**
  - `scripts/world/diorama.py`, `scripts/world/realism/*`, the Blender shot renders in `andheri-project/film/shots/`;
  - the final edit in `andheri-project/film/edit/` and the final film at `media/flipkart-andheri/film/andheri-intro.mp4` (with `andheri-intro-poster.jpg`).
- **Corporate model agent:** `scripts/world/corporate_hero.py`, `.w3d/corporate_hero.blend`, `andheri-project/film/corporate/`.
- **Maps agent:** `andheri-project/film/maps/` (sources and rendered clips).
- **Audio agent:** `andheri-project/film/narration-v4/`, `andheri-project/film/audio/`.
- **UI agent:**
  - `engine/world.html`, `engine/andheri-ui.css`, `engine/andheri-ui.js`;
  - any new `engine/andheri-*` files, and `media/flipkart-andheri/brand/`;
  - plus only the intro and flow parts of `engine/world.js`. Keep everything else there: the `?preview=` loader, baked AO, landmark labels, and the 3D and CAD features.

## Environment

- **Repo:** `/Users/lohit/Downloads/Atlas`. The local server is already running at `http://localhost:8137`. The explorer is `/flipkart-andheri/world`, with the gate passed via `sessionStorage['flipkart-andheri-auth']='1'`.
- **Blender:** `/Applications/Blender.app/Contents/MacOS/Blender` (5.2, Apple M5 GPU, Metal). For shapely inside Blender: `PYTHONPATH=$PWD/.w3d/bpylib Blender -b --python-use-system-env --python …`.
- **Data Python** (pyarrow, shapely): `.w3d/bin/python`. System `python3` has PIL and numpy.
- **Scene data:** `.w3d/data/scene.json`, origin lng/lat `[72.867, 19.111]`. Metres: x = (lng − 72.867) × 105184.7, y = (lat − 19.111) × 110540. It holds buildings, roads (major/minor/foot polygons), metro lines and stations.
- **CC0 assets:** Poly Haven and ambientCG are reachable. Downloaded HDRIs and scans are in `.w3d/assets/`.
- **ElevenLabs:** use `airoli-rtp/film-src/audio/tools/{el.py, voice.py}`. They read the key from the founder's `.env` and never print it. Alka is `Z1oY2Vw237R6ALt5CZcD`.
- **HyperFrames:** `npx --yes hyperframes@0.9.70` (see `airoli-rtp/film/` for a working project).
- **Capture tools:** `airoli-rtp/film/tools/capture_*.mjs`. ffmpeg is installed.
- **Mapbox** is configured in `config.js`; satellite and streets may be used in video, with visible Mapbox and OpenStreetMap attribution.
- **Google imagery** (Street View, satellite, Map Tiles) may be used only to check things. It must never appear in a deliverable.

## Quality bar

- Read `.claude/skills/archviz-quality-bar/SKILL.md`. Score your output against it before calling it done.
- Look at what you make (render a still, screenshot the page) and fix anything that reads as CG or cheap.
- A logic gate runs in every diorama build (`scripts/world/check_logic.py`). Never deliver something that breaks reality: buildings on roads, missing landmarks, wrong positions.
- Commit your own files with clear messages. Do not commit `.w3d/` or anything under 100 MB that is a render intermediate. Final mp4s go in `media/` or `andheri-project/film/*/out/`.
- **Report back:** what you made, where it is, how to rebuild it, what is estimated, and what is left.
