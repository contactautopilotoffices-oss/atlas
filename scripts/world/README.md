# Explorer: Andheri East in 3D

The atlas at `/flipkart-andheri` has a 3D explorer at `/flipkart-andheri/world`.
Each of the seven buildings gets a dollhouse: a slab of its district, cut out
around the building and its nearest metro station, built in Blender at
close-up quality. The browser shows it with three.js in two ways:

- **Dollhouse:** the slab on a turntable, tilt-shifted like a photographed
  model.
- **Walk:** stand on the footpath at eye height, look up at the facade, walk
  around (the buildings are solid), and see how far the entrance and the
  metro station are. "Walk to the metro" follows the street route at walking
  pace, shown nine times faster, with the distance and minutes left.

## What is modelled

- **The building** is built from the deck's floors.
  - Grade A and B+ get a curtain wall with mullions every 1.5 m and slab
    edges at every floor. Grade B gets banded plaster with chajjas.
  - Every building gets a double-height lobby, an entrance canopy facing the
    nearest road with the building's name on it, a crown and rooftop plant.
- **The metro** is built as Mumbai builds it.
  - Line 1 and Line 7 have elliptical piers every 30 m with hammerhead caps,
    a U-girder deck with parapets, two tracks with rails, and overhead wire
    masts.
  - Each station has a concourse spanning the road, platforms under a barrel
    roof, glass screens, four stair towers down to the footpath, and name
    boards.
  - Line 3 runs underground, so it shows as its street entrances.
  - Line 1 trains run on the deck.
- **The street** has:
  - asphalt with lane markings, and raised footpaths with kerbs;
  - every footprint around it extruded with a facade texture at true scale,
    with shopfront shutters where it meets the road, parapets, water tanks and
    stair cabins;
  - leaf-card trees and coconut palms, street lamps, and moving cars, autos
    and buses.
- **The plinth** is the slab's cut edge, in soil. It is what makes it read as
  a dollhouse.

## Pipeline

```
fetch.py         Overture Maps (S3) + Copernicus GLO-30  ->  data/*.parquet, dsm.npy
prep.py          footprints, heights, roads, metro, trees ->  scene.json, world.json
textures.py      facade, ground and leaf textures         ->  tex/*.jpg, leaves_*.png
diorama.py       Blender (bpy 5.2.3, headless), per building:
                   --glb      <id>.glb (named materials, no images) + <id>.json
                   --render   <id>-close.png, <id>-street.png (Cycles)
                   --sky      sky.hdr (the same sky; the sun disc clamped out)
gltf-transform   weld + meshopt                           ->  media/.../d/<id>.glb
finish_dioramas.py                                        ->  media/.../r/*.jpg
```

To run it again:

```bash
python3 -m venv .w3d && .w3d/bin/pip install bpy==5.2.3 pyarrow shapely numpy rasterio
```

```bash
.w3d/bin/python scripts/world/fetch.py /tmp/w3data
```

```bash
.w3d/bin/python scripts/world/prep.py /tmp/w3data /tmp/w3data/scene.json /tmp/w3data/world.json
```

```bash
python3 scripts/world/textures.py /tmp/tex
```

```bash
.w3d/bin/python scripts/world/diorama.py /tmp/w3data/scene.json /tmp/w3data/world.json /tmp/tex 723-avenue /tmp/dio --glb --sky
```

```bash
npx @gltf-transform/cli@4 weld /tmp/dio/723-avenue.glb /tmp/dio/w.glb
```

```bash
npx @gltf-transform/cli@4 meshopt /tmp/dio/w.glb media/flipkart-andheri/world/d/723-avenue.glb --level high
```

```bash
.w3d/bin/python scripts/world/diorama.py /tmp/w3data/scene.json /tmp/w3data/world.json /tmp/tex 723-avenue /tmp/dior --render close street
```

```bash
python3 scripts/world/finish_dioramas.py /tmp/dior media/flipkart-andheri/world
```

Repeat the diorama and compression steps for each option id. Copy
`<id>.json`, the textures (resized to 1024 px) and `sky.hdr` into
`media/flipkart-andheri/world/`.

Each diorama is 1.6 to 2.2 MB after compression. The textures are shared.
The `bpy` wheel ships without its Draco and meshopt libraries, so
gltf-transform compresses the model instead. Meshopt's decoder ships with
three.js.

`build.py` and `finish.py` are the earlier whole-district model. The atlas
sign-in backdrop (`blender-wide`/`blender-tall`) still comes from them.

## What is real and what is estimated

- **Footprints:** Overture Maps 2026-10-21, which combines OpenStreetMap,
  Microsoft and Google Open Buildings footprints.
- **Heights:** the seven buildings use the deck's floor counts (G+15 is
  16 storeys, with a 5.6 m lobby and 4.1 m floors). Every other height is
  estimated from footprint size and the Copernicus 30 m surface model.
- **Facades:** the seven are modelled from their grade in the deck, not from
  photographs. The buildings around them get one of eleven painted Mumbai
  facade styles.
- **Metro:** the lines follow their Overture centrelines, and the stations
  their footprints. Pier spacing, the deck section and the station form are
  typical of Line 1, not surveyed.
- **Distances and walk times:** these are the atlas's figures, from the
  Google Maps report. Walk mode's live readouts are straight lines from where
  you stand, and say so.

## References used

- **MengTo/Skills** (MIT):
  - `threejs-towers`: merge by material, and parameterised building parts.
  - `3d-sky-background`: one sun shared by the sky, the light and the
    shadows.
  - `3d-virtual-tour`: authored camera paths and mode hand-offs, used for the
    route walk.
  - `3d-high-poly-models` and `3d-high-resolution-textures`: detail where the
    camera gets close, and textures at true scale.
  - `3d-retina-resolution`: a pixel-ratio cap.
- **3ditions kits:** Blender Python built headless, exported as a compressed
  GLB, and finished in three.js.
- **Geopogo:** closed source. This pipeline is the open equivalent.
- **OneCanvas** (TUM and Huawei, NeurIPS 2026): it answers questions about
  RGB-D scans and does not build meshes. It also needs a CUDA GPU, so it is
  not used.
