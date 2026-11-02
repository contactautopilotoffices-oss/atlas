# 3D world: Andheri East

The atlas at `/flipkart-andheri` has a 3D model of its district at
`/flipkart-andheri/world`. It covers 24,000 real building footprints, the metro
on its viaducts, the streets with traffic, the trees, the sky, time of day and
weather. It keeps the same list and "How you get there" rows as the map. The
model is built in Blender and drawn in the browser with three.js.

## Pipeline

```
fetch.py   Overture Maps (S3) + Copernicus GLO-30  ->  data/*.parquet, dsm.npy
prep.py    footprints, heights, roads, metro, trees ->  scene.json (Blender)
                                                      world.json (the page)
build.py   Blender (bpy 5.2.3, headless)           ->  andheri-east.glb
                                                      hero.png, opt-<id>.png (Cycles)
gltf-transform weld + meshopt                      ->  media/.../andheri-east.glb
finish.py  haze, tilt-shift, labels                ->  hero.jpg, opt-<id>.jpg,
                                                      blender-wide/tall (sign-in)
```

To run it again:

```bash
python3 -m venv .w3d && .w3d/bin/pip install bpy==5.2.3 pyarrow shapely numpy rasterio
```

```bash
.w3d/bin/python scripts/world/fetch.py /tmp/w3data
```

```bash
.w3d/bin/python scripts/world/prep.py /tmp/w3data /tmp/w3data/scene.json media/flipkart-andheri/world/world.json
```

```bash
.w3d/bin/python scripts/world/build.py /tmp/w3data/scene.json /tmp/w3out --glb
```

```bash
npx @gltf-transform/cli@4 weld /tmp/w3out/andheri-east.glb /tmp/w3out/w.glb
```

```bash
npx @gltf-transform/cli@4 meshopt /tmp/w3out/w.glb media/flipkart-andheri/world/andheri-east.glb --level high
```

```bash
.w3d/bin/python scripts/world/build.py /tmp/w3data/scene.json /tmp/w3renders --render hero opt:723-avenue opt:corporate-avenue opt:vaman-techno-centre opt:privilon opt:landmark opt:rustomjee-central-park opt:fulcrum
```

```bash
python3 scripts/world/finish.py /tmp/w3renders media/flipkart-andheri
```

The Cycles stills take about 7 minutes each on 4 CPU cores. Add `--fast` for
a quick, low-resolution check. Blender's bundled Draco and meshopt libraries
are missing from the `bpy` wheel, so gltf-transform compresses the model
instead. Meshopt's decoder ships with three.js, so the page needs no extra
CDN.

## What is real and what is estimated

- **Footprints:** Overture Maps 2026-10-21, which combines OpenStreetMap,
  Microsoft and Google Open Buildings footprints.
- **Heights:** Overture has a height for 5 of the 29,000 buildings here. Every
  other height is estimated. Footprint size sets the range, and the
  Copernicus 30 m surface model raises a building within that range. The
  surface model blurs towers and predates many of them, so it is a relative
  signal only. The seven options use the deck's floor counts (G+15 is 16
  storeys at 4.1 m).
- **Option footprints:** each option is the building under its pin, or the
  biggest one within 40 m. Buildings named after a metro station never count,
  because Privilon's pin marks an address on Marol Naka station.
- **Metro and rail:** Metro Line 1 and Line 7 are swept as elevated decks
  along their Overture centrelines, with piers every 30 m and station boxes at
  the station footprints. Line 3 is underground, so it shows as entrances only.
- **Trees:** scattered from land use (parks, roadsides, open ground). They
  give the picture density, not a tree survey.
- **Distances and walk times:** these are the atlas's figures, from the
  Google Maps report. The ribbon drawn in the model follows the street route.

## References used

These were given as the brief for this work:

- **MengTo/Skills** (MIT) is the main source for the page. The patterns used:
  - `threejs-weather`: rain carried in front of the camera, a storm made by
    pushing the rain harder, lightning on its own light with return strokes,
    wet ground, and relighting only when slow values change.
  - `threejs-landscape` and `3d-sky-background`: a gradient sky dome that
    shares one sun with the light and the fog, and a time of day that
    cross-fades.
  - `threejs-towers`: buildings merged by material, and lit windows with no
    light leaks.
  - `3d-retina-resolution`: an explicit pixel-ratio cap.
- **3ditions kits** (arctic-waters): the workflow of writing Blender Python,
  building headless, exporting a compressed GLB and finishing in three.js
  with sky, weather and light states.
- **Geopogo**: closed source. This pipeline is the open equivalent of what it
  does, which is map footprints extruded and dressed in Blender.
- **OneCanvas** (TUM and Huawei, NeurIPS 2026): read, but not usable here. It
  answers text questions about posed RGB-D scans and does not reconstruct
  meshes. It also needs a CUDA GPU and Hugging Face weights, which this build
  environment cannot reach.
