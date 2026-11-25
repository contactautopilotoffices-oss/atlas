# Property models: how to regenerate and update them

Each JindalX option has a modelled building and plot, made by a script in headless Blender. Nothing
is placed by hand, so every step below can be rerun at any time and gives the same result.

## What you need

- **Python with Blender as a module** (`pip install bpy`, Blender 5.2), plus `numpy`, `shapely` and `Pillow`. In the cloud container this is `/tmp/w3d/bin/python`.
- **Node**, to run `npx @gltf-transform/cli@4` for the meshopt step.
- **The region scenes** from `scripts/world/prep.py`:
  - `west` for A104, A14/18/19 and D1;
  - `s67` for Magnus Towers.

  `scripts/world/README.md` explains how they are made.

## The files

| File | What it is |
| --- | --- |
| `scripts/world/heroes/noida_jindalx.json` | One entry per option. Facts from the workbook (storeys, grade, stilt or lobby ground floor, a smaller upper block), plus a "known" and an "assumed" list |
| `scripts/world/refs/noida_jindalx.json` | Each option's footprint: an indicative massing from `plot_massing.py` until the plot is surveyed |
| `scripts/world/hero_textures.py` | Writes every texture and leaf atlas into a folder |
| `scripts/world/hero_building.py` | Builds one option: the GLB, the site file, the editable `.blend`, Blender stills |
| `scripts/world/diorama.py` | Builds the option's district slab around the model (`--exterior`, `--site`) |
| `assets/blender/<option>.blend` | The editable Blender scene for each option, organised in collections |

## Regenerate everything

```bash
P=/tmp/w3d/bin/python          # Python with bpy
TEX=media/jindalx-noida/world/tex

# 1. textures (only when hero_textures.py changes)
$P scripts/world/hero_textures.py $TEX

# 2. the building and plot of one option (repeat per option; Magnus uses the s67 scene)
$P scripts/world/hero_building.py scripts/world/heroes/noida_jindalx.json d1 /tmp/jx/west/scene.json $TEX /tmp/jx/hero2/d1.glb \
   --blend assets/blender/d1.blend --render /tmp/jx/hero2/r-d1 --fast

# 3. the diorama around it, then weld and meshopt into the page's media
$P scripts/world/diorama.py /tmp/jx/west/scene.json /tmp/jx/west/world.json $TEX d1 /tmp/jx/dio2 --glb \
   --exterior /tmp/jx/hero2/d1.glb --site /tmp/jx/hero2/d1.glb.site.json
npx -y @gltf-transform/cli@4 weld /tmp/jx/dio2/d1.glb /tmp/jx/dio2/d1-w.glb
npx -y @gltf-transform/cli@4 meshopt /tmp/jx/dio2/d1-w.glb media/jindalx-noida/world/d/d1.glb
cp /tmp/jx/dio2/d1.json media/jindalx-noida/world/d/d1.json

# 4. the option cards and the first-paint image
$P scripts/world/diorama.py /tmp/jx/west/scene.json /tmp/jx/west/world.json $TEX d1 /tmp/jx/dio2 \
   --exterior /tmp/jx/hero2/d1.glb --site /tmp/jx/hero2/d1.glb.site.json --render hero street --fast
```

`diorama.py` prints `LOGIC PASS 0 failures` when nothing stands in a road, nothing overlaps and the
entrance faces a road. Do not publish a build that fails it.

## Check it

```bash
PORT=8137 node scripts/atlas-dev.js &
node scripts/world-smoke.cjs                                          # every mode, option and quality tier
node scripts/world-bench.cjs http://localhost:8137 jindalx-noida d1 /tmp/bench-d1.json
node scripts/world-compare.cjs 8137 /tmp/new d1 /tmp/jx/hero2/d1.glb.site.json   # five fixed cameras
```

Run `world-compare.cjs` on an older checkout too, served on another port, to get before-and-after
pairs from identical cameras.

## Changing a building

- **Real design arrives:** edit the option's entry in the spec file. Change `facade`, `ground`, `floors` or `upper`, and move each fact from "assumed" to "known". Then rerun steps 2 to 4.
- **Surveyed plot arrives:** replace the option's `poly` in the refs file with the surveyed outline, then rerun steps 2 to 4.
- **Something the spec cannot express** (a curved facade, a podium): add a facade family to `hero_building.py`. Grade A and Grade B are the two families today.
- **In Blender by hand:** open `assets/blender/<option>.blend`.
  - Edit inside the collections. The collections are listed below.
  - Export with "Selected objects" after joining the exportable collections. That is what `hero_building.py` does.
  - Hand edits are lost the next time the script runs, so prefer changing the script.

## The collections in each .blend

| Collection | Holds |
| --- | --- |
| Architecture | Plinth, columns, soffits, the entrance lobby and canopy |
| Building_Facades | Curtain wall or plaster, pilasters, fins, slab bands, the name |
| Windows_And_Balconies | Glass, mullions, spandrels, sunshades, terrace railings, split ACs |
| Rooftops | Roof, parapets, lift rooms, tanks, chillers or VRV units, solar |
| Vegetation | Hedges, shrubs, grasses, flowers, bougainvillea. Also preview trees, which are not exported: the page plants its own tree models from the site file |
| Landscaping | Pavers, lawn, mulch beds, kerbs, planters, terraces. Also a preview ground, which is not exported |
| Amenities | Empty: the workbook lists no amenities. Add only what the landlord confirms |
| Street_Infrastructure | Drive, parking, ramp, boundary wall, gates, guard cabin, barrier, lights |
| Materials | One swatch per material: the material library, not exported |
| Lighting_And_Cameras | A late-afternoon sun and the property, closeup, street and landscape cameras |
