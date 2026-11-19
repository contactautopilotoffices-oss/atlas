# Reliable Tech Park, Airoli: twin viewer (for Altruist)

Forked from `noida-skymark/twin/web` (same walk, tour, section cut, minimap and presenter remote). Served from the repo root:
`python3 noida-skymark/twin/web/tools/serve_nocache.py 8137`, then open `/airoli-rtp/twin/web/`.

- Frame: `rtp_local` (x east, y north, metres from the Maps pin 19.1692159 N 73.0017703 E); three (x, y, z) = (x, height, -y).
  Level n finished floor = `ffl0 + n * floor_to_floor` (0.6 + 3.6 n, assumed). Plans are registered on the structural columns
  (`airoli-rtp/review/frames.json`), so floors stack within 1 cm.
- Exterior: `models/exterior/exterior_viewer.json` (the Blender bake: per-floor nodes, AO lightmaps on UV 1, day/night emission
  from glTF extras, HDR reflections). Without it, `js/exterior.js` builds a procedural building and city from `plate.json`
  and `context_overture.json`. `?exterior=procedural` forces the fallback.
- Floors: `building.json`; plans: `tenants/*.json` (the 6th floor has `options`, shown one at a time). A plan with no Blender export in
  `models/index.json` is built from its CAD layout (`airoli-rtp/<plan>/<plan>-floor<n>.twin.layout.json`). A plan whose layout
  has not been delivered shows "3D model in preparation".
- Light: `js/tod.js`, the real sun for the site; the slider drives sky, fog, exposure, and the bake's day/night emission.
- CAD locator: `blueprints/<plan>.png` is the DWG's own linework (`airoli-rtp/tools/blueprint_rtp.py`), under "you are here".
- Flags: `?hour=17.7`, `?nocity`, `?fps`, `?fast`, `?present`, `#tenant=rtp6-a`.
