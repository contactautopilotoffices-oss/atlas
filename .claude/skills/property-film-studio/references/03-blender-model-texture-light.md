# 03: Blender, headless. Model, UV, texture, colour and light.

See also `archviz-blender-photorealism`, `blender-hyperrealism` and
`archviz-lighting-day-night`. This file covers what the Andheri build
actually used.

## Running Blender headless on the Mac

```bash
B=(env PYTHONPATH=$PWD/.w3d/bpylib /Applications/Blender.app/Contents/MacOS/Blender -b --python-use-system-env --python)
"${B[@]}" scripts/world/diorama.py -- SCENE WORLD TEX OPTION OUT --render hero --samples 24
```

- Use Cycles on Metal:
  - `prefs.addons['cycles'].preferences.compute_device_type='METAL'`;
  - enable every device;
  - set `scene.cycles.device='GPU'`.
- Turn the denoiser on (OpenImageDenoise). Use 16 to 24 samples for
  animation and 64 to 160 for hero stills.
- In build scripts, never call `bpy.ops.object.transform_apply`; it acts on
  everything selected. Transform the mesh data instead (`mesh.transform(M)`).
- Use the Blender MCP only for inspecting a scene interactively. Batch work
  is scripts run with `-b`.

## Modelling a hero from references (`scripts/world/privilon_hero.py`, `corporate_hero.py`)

- Build each hero in its own local frame:
  - x is the road face;
  - y runs back from the road;
  - z is up.

  `diorama.py --hero-blend X.blend --hero-fit` places it on the zoned
  footprint.
- Heights come from the deck. For example: ground 6.0 m, then 15 floors at
  4.1 m, then a 2.4 m crown.
- Depth is what sells it. Model these, never paint them:
  - fins and mullions;
  - slab edges at every floor;
  - recessed slots;
  - a podium on columns;
  - the canopy with the building's name.
- Bevel every hard edge (5 to 20 mm).
- Name materials `ANDHERI_*` (or `<CLIENT>_*`) so the web explorer keeps
  and recognises them.

## UVs and texturing at true scale

- **Box-project by world metres.** Set u to the metres along the wall
  divided by the module width, and v to the metres up divided by the module
  height. `scripts/world/textures.py` paints facade modules at a known real
  size (128 px/m):
  - plaster with monsoon streaks under the sills;
  - grills, chajjas, AC units and shutters;
  - glass and plaster variants;
  - a matching `_r` roughness map for each.
- For heroes, use CC0 PBR scans (Poly Haven or ambientCG) for albedo,
  roughness and normal, mapped by the same metre rule. Keep the asset
  folder outside git (`.w3d/assets`) and note the licence.
- **Colour.** Match the developer render or the brochure, sampled from a
  photo; don't invent colours. Vary roughness by about ±15% with a noise
  everywhere. Add dirt and AO in the crevices (an Ambient Occlusion node
  times the base colour).
- **UV painting and touch-up.** For signage, stains or a logo on a canopy,
  paint into an image on a second UV map (Smart UV Project, 0.02 margin)
  and mix it over the true-scale material. Keep paint layers as separate
  images so they can be re-baked.
- **Glass.** For curtain walls, use a thin pane: a fresnel mix of
  transparent and glossy, invisible to shadow rays. Put a lit interior card
  or interior mapping behind it, so the glass never looks empty at dusk.

## Light: physically right, controllable

- **The sun from the date and place.** Compute the azimuth and elevation
  for the lat/lng and time.
  - Andheri afternoon: az 245, el 18.
  - Andheri dusk: az 250, el −4.

  `diorama.py` takes `--sun-az --sun-el --sun`.
- **Sky.**
  - Diffuse light comes from the HDRI (`--hdri`).
  - Camera and glossy rays see Blender's physical sky
    (`--sky-mode physical`, `scripts/world/realism/sky.py`), so the props
    on a photographed HDRI's horizon never show.
  - `--sky-cam 0.12` sets how strong that sky looks to the camera.
- **Exposure and the view transform.** Use AgX with Medium High Contrast.
  Set `--exposure`; don't dim the lights.
- **Night and dusk.**
  - `--night 1.4` lights the windows.
  - Light the property's offered floors brighter than the rest; in the
    film, 723's 13th and 14th floors are lit.
  - Use warm 3000 K in lobbies and 4000 K in offices.
- **Haze and far field.** `--haze 0.0003` adds aerial perspective.
  `--far-field 2500` adds the distant city, so the horizon is not a void.
- The light presets the film uses (from `render_queue3.sh`):

  ```
  DUSK=(--hdri cedar_bridge_sunset_2_4k.hdr --sun-az 250 --sun-el -4 --sky 0.12 --night 1.4 --exposure 1.4 --haze 0.0003)
  AFTERNOON=(--hdri cedar_bridge_sunset_1_4k.hdr --sun-az 245 --sun-el 18 --sky 0.8 --sun 3 --night 0.1 --exposure 0.1 --haze 0.0003)
  ```

## Baked lighting for the web views (ultra-realistic in the browser)

three.js can't do Cycles' bounce light live, so bake it:

1. Duplicate the hero. Give every mesh a second UV (`lightmap`) with
   Lightmap Pack, or Smart UV with a margin of 0.03 or more.
2. Bake in Cycles:
   - **Combined** (or Diffuse with Direct, Indirect and Color) for a
     full-bake look at one time of day;
   - or **AO only**, for a neutral bake that the web's own sun relights.

   Use 2048 to 4096 px per hero and 256 to 512 samples, then denoise the
   baked image with the compositor's Denoise node.
3. Save it as `<prop>_lm_<time>.png`. Export the GLB with the second UV,
   and on the page set `material.lightMap` (or `aoMap`) with
   `lightMapIntensity` around 1.
4. Bake one map per time of day (day, dusk) and switch maps in the
   explorer's light control (`engine/andheri-scene-lighting.js`). That is
   the "light controls" UI: time-of-day buttons that swap lightmaps and the
   environment, with an optional live sun for shadows.
5. The Andheri d-preview GLBs (`media/flipkart-andheri/world/d-preview/`)
   were re-exported with AO baked in.

## Outputs per property

- `<prop>_hero_day.jpg`, `_dusk.jpg`: stills at 3840×2160, graded lightly
  (`scripts/world/finish.py`).
- The film shot frames (see `04`).
- `<prop>.glb` with baked maps, for the explorer.
- Before shipping, compress the GLB with meshopt (`gltf-transform optimize`,
  which needs the founder's OK to download the tool). Keep the
  uncompressed master for Blender; Blender's importer can't read meshopt.
