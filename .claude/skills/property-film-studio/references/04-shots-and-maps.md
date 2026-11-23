# 04: Shots (Blender) and map clips (Mapbox)

## Camera shots: `andheri-project/film/shots/shots.json`

```json
"corp_drone": { "frames": 200, "note": "why this camera",
  "keys": [ {"f":0,"pos":[-990,70,125],"look":[-805,-20,24],"lens":30},
            {"f":199,"pos":[-925,38,92],"look":[-798,-26,18],"lens":35} ],
  "pins": { "Corporate Avenue": [-795,-26,44] } }
```

- Positions are in scene metres. Use 2 or 3 keys with eased interpolation.
  Use a 24 to 35 mm lens for architecture, and keep the verticals straight.
- `pins` are the 3D points the edit pins label cards to, projected per
  frame.
- **The shot language**, in the order the film plays them:
  1. a descent through cloud;
  2. the interchange;
  3. a hero reveal at sunrise;
  4. the same hero at dusk;
  5. a drone over the campus;
  6. a rise up the tower to the lit floors;
  7. a closing pull-back over every property.
- Before committing to a camera, render a 3-frame test (`--frames 1,100,199
  --fast`). Check that:
  - the hero is not hidden behind a neighbour;
  - the main face is lit;
  - no frame starts inside a building (the logic gate checks this).

## Render on every core: the two-pass queue (`render_queue3.sh`)

```bash
shot close_pullback privilon "${PRV[@]}" "${DUSK[@]}" --samples 16 --frames 1-192 --frame-step 2   # pass 1: odd frames
shot close_pullback privilon "${PRV[@]}" "${DUSK[@]}" --samples 16 --frames 2-192 --frame-step 2   # pass 2: fill
```

- Pass 1 is enough for a complete cut: the edit interpolates the gaps (see
  `06`). Pass 2 fills in the real frames, and the film is rebuilt.
- Run the queue with `nohup ... &` and log to `queue.log`. A session restart
  kills foreground jobs.
- The GPU takes the Cycles work; ffmpeg and HyperFrames use the CPU cores at
  the same time.
- **Budget.** Wide shots ran at 60 to 80 s a frame at 24 samples. Cutting
  the samples to 16, using a tighter camera and frame-step halved the night.

## Map clips: `andheri-project/film/maps/`

- `src/index.html`, `app.js` and `style.css` hold a Mapbox GL page driven by
  `window.__seek(t)`. Each call resolves only once every tile of that frame
  has drawn, so no frame is half-loaded.
- `tools/capture.mjs <clip>` captures through Playwright with
  `channel:'chrome'`. Use real Chrome, because bundled Chromium has no
  H.264. Frames are taken at DPR 2 and Lanczos-downscaled to 1080p at 24 fps,
  then encoded H.264 at CRF 14 in BT.709.
- The clips:
  - `descent`: satellite through clouds (`clouds.js`);
  - `interchange`: metro lines with every property pinned;
  - `route_<prop>`: the walk from the station stairs to the door.
- **Walking routes:** `tools/route.py` finds the shortest path on OSM
  walkable ways.
  - Fetch the ways from Overpass.
  - Start at the station's `highway=steps`.
  - End at the property's door pin.

  It writes the measured length next to the deck's figure. Show the deck
  figure only if the founder chose it.
- **Route chip:** "140 m · 2 min" counts up with an outQuart ease over about
  1.8 s. Use tabular numbers and a fixed min-width, and no wheels or blur.
- Show the Mapbox and OSM attribution (Mapbox's terms require the logo).
