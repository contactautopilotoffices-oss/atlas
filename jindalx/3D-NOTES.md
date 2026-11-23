# JindalX Noida: the 3D explorer

The four JindalX options in 3D, the same way as Andheri and Skymark. Each option is a
dollhouse: a slab of its district around the building and its nearest Blue Line station,
built in headless Blender and shown in three.js. You can orbit it, walk the street at eye
height, light the offered floors and walk to the metro.

- **Explorer:** `/jindalx-noida/world`. It opens at `#magnus-towers`, `#a104`,
  `#a14-18-19` or `#d1`, and the 2D atlas shows a "3D world" button.
- **No film.** This is the 3D model only, as asked on 23 November 2026.

## Update, 24 November 2026: rebuilt from imagery (read this first)

The first build placed each building by an indicative pin with an assumed facade. A check against Google
satellite and Street View (`docs/JINDALX_VERIFICATION.md`) found all four wrong, so they were rebuilt.
Where the tables below disagree with this section, this section wins.

- **Positions** (`jindalx/build-data.cjs`, `positions`): the building seen in imagery, not the sheet's pin.
  Magnus is Magnus Greens, plot C-2 (Google geocode), 520 m from the old pin. A104 is the best candidate only.
- **Footprints and gates** (`scripts/world/refs/noida_jindalx.json`): from the proposals in the verification
  document. `poly` is the building, `plot` the compound, plus `gates` and `front_toward`.
- **Facades** (`scripts/world/heroes/noida_jindalx.json`, `hero_building.py`): Magnus long dark-glass block with
  white fascias and three portals; A104 charcoal panels and blue-grey glass; A-14 copper, green glass and grey
  crown on a stilt floor (452 m2 plot, G+4); D1 cream stucco, teal windows and a round corner tower.
- **Textures** (`scripts/world/hero_textures.py --facades`): ten PBR sets, real tile sizes in
  `media/jindalx-noida/world/tex/TILES.json`. Procedural: no imagery is copied.
- **Walks** are recomputed from the new positions: `routes.py` per region, merged into `world-routes.json`, then
  `node jindalx/build-data.cjs` and `node jindalx/make-bundle.cjs`.
- **Magnus slab** needs `--slab-min 1870`: the Sector 59 station is 2.4 km away by street.
- **Environment** (`scripts/world/prep.py` / `diorama.py`): see the vegetation and walls entry in
  `docs/JOURNAL.md`.
- **Environment needs a Python 3.13 venv** for bpy 5.2.3 (`uv venv --python 3.13 .w3d`).

## What every figure comes from

| Option | Storeys modelled | Floor plate modelled | Offered floors lit | Walk to metro (measured from pin) | Workbook says | Facade |
| ------ | ---------------- | -------------------- | ------------------ | --------------------------------- | ------------- | ------ |
| Magnus Towers, Sector 67 | G+5 (B+G+5) | 38,000 sq ft, 3,530 m² | 5th | Sector 59, 1,640 m, 20 min | Sector 59, ~2 km | Glass |
| A104, Sector 4 | G+3 (B+G/S+3) | 25,000 sq ft, 2,323 m² | 1st, 2nd | Sector 16, 1,200 m, 15 min | Sector 16, ~800 m | Plaster with ribbon windows |
| A14/18/19, Sector 9 | G+4 (B+G/S+2+2) | 18,000 sq ft, 1,672 m² | 2nd, 3rd | Sector 16, 1,670 m, 21 min | Sector 16, ~2 km | Plaster with ribbon windows |
| D1, Sector 3 | G+2 (B+G+2) | 20,000 sq ft, 1,858 m² | 2nd | Sector 16, 930 m, 12 min | Sector 16, ~500 m | Plaster with ribbon windows |

- **Storeys and floor plates:** the client's workbook (`source-options.json`).
- **Storey heights:**
  - Sectors 3, 4 and 9: a 4.5 m ground floor, then 3.9 m a floor, as at Skymark.
  - Sector 67: a 5.0 m ground floor, then 4.0 m a floor.
- **Walks:** the shortest path on Overture Maps streets (OpenStreetMap), measured from the
  indicative pin at 4.8 km/h (`scripts/world/routes.py`, stored in `world-routes.json`).
  The workbook's figure stays in the facts, next to the measured one, until the entrances
  are confirmed.
- **Magnus glass facade:** in September 2025 Jagdamba Optics awarded a glass, glazing and
  windows contract for "C-2, Sector 67, Noida". This is Faalcon Concepts' BSE filing.
  Sanjiv Tandon Architects list Jagdamba's "Magnus Greens", Sector 67, at 210,060 sq ft
  built up.
  - Six floors of 38,000 sq ft is 228,000 sq ft, which is close.
  - So Magnus Towers is very likely Magnus Greens at plot C-2, with a handover in
    December 2026.
  - It is not the Magnus Tower on Plot 6, Sector 73, which is a different 14-floor building.
- **Other facades:** the other three are not documented, so they use the plain plaster
  treatment.
- **A14 on listing sites:** myHQ and Amadhi list A-14, Sector 9 as B+G+4 with 17,000 sq ft a
  floor, which is consistent with the workbook.

## What is NOT verified (say this when you show it)

1. **The buildings are placed by indicative pins, not surveyed plots.**
   - No pin sits on a plot-sized footprint. A104's pin is on a 224 m² building, D1's and
     A14's on about 450 m² ones, and Magnus's on the Sector 67 road junction.
   - So each option is a massing: a rectangle with the workbook's floor plate, squared to
     the nearest road, set back 9 m, clear of every road by 3 m, as near the pin as that
     allows. That is `scripts/world/plot_massing.py`, written to
     `scripts/world/refs/noida_jindalx.json`.
   - The centres are 0 to 63 m from the pins. Magnus goes onto the empty block north-west of
     the junction, because a new building is what older map data would miss.
2. **The setbacks are assumed.** A14/18/19's upper two floors (8,000 sq ft) are modelled at
   the full plate, not set back.
3. **The surrounding heights are estimates.**
   - They come from the Copernicus 30 m surface model, capped at 24 m (about G+5).
   - Where Overture has a real height it is kept.
4. **Walks run from the pins**, so they change once the entrances are known.
5. **Unchecked against satellite imagery.** No Google key was available in this session,
   so the satellite overlay (`verify_overlay.py`) has not been run. The check was done on
   a top-down plot of the Overture roads and footprints instead.

To fix an option once the landlord sends the plot:
1. Replace its `poly` in `scripts/world/refs/noida_jindalx.json` (scene metres, with
   `scene_origin` as written).
2. Rerun `diorama.py ... --glb` for that id, then weld and meshopt.

## How it was built (to rerun)

```bash
python3 -m venv .w3d && .w3d/bin/pip install bpy==5.2.3 pyarrow shapely numpy rasterio pillow matplotlib
```

```bash
for R in west 67; do
  .w3d/bin/python scripts/world/fetch.py /tmp/jx/$R --region scripts/world/regions/noida-jindalx-$R.json
  .w3d/bin/python scripts/world/routes.py /tmp/jx/$R scripts/world/regions/noida-jindalx-$R.json /tmp/jx/$R-routes.json
done
```

Then merge the two route files into `jindalx/world-routes.json` and regenerate
`examples/jindalx.bundle.json` from the atlas.

```bash
.w3d/bin/python scripts/world/prep.py /tmp/jx/west /tmp/jx/west/scene.json /tmp/jx/west/world.json --region scripts/world/regions/noida-jindalx-west.json
```

Do the same for 67.

```bash
.w3d/bin/python scripts/world/plot_massing.py scripts/world/refs/noida_jindalx.json /tmp/jx/s67/scene.json:magnus-towers /tmp/jx/west/scene.json:a104 /tmp/jx/west/scene.json:a14-18-19 /tmp/jx/west/scene.json:d1
```

Make the textures with `textures.py`, `tex_facades.py`, `tex_723.py` and `tex_corridor.py`,
all writing to `/tmp/jx/tex`. Then, for each id (add `--cam-on-road` for `a14-18-19`):

```bash
.w3d/bin/python scripts/world/diorama.py SCENE WORLD /tmp/jx/tex ID /tmp/jx/dio --glb
```

```bash
.w3d/bin/python scripts/world/diorama.py SCENE WORLD /tmp/jx/tex ID /tmp/jx/dio --render hero street --fast
```

```bash
npx @gltf-transform/cli@4 weld then meshopt
```

The meshopt output goes to `media/jindalx-noida/world/d/ID.glb`.

```bash
node jindalx/build-data.cjs
```

That last step writes `engine/atlases/jindalx-noida.js` with `meta.world`.

## Changes to the shared pipeline, made for this build

- `fetch.py --region`: takes the box and the Copernicus tile from the region file. Without
  it, Andheri behaves as before.
- `routes.py`: the general form of `scripts/skymark/routes.py`, for any region and bundle.
- `plot_massing.py`: new (see above).
- `diorama.py`:
  - **Any option can have a fixed outline.** It used to be Privilon and Corporate Avenue
    only.
  - **Neighbours are trimmed.** Ones that only partly overlap the outline are cut back,
    not left overlapping.
  - **Refs stay in their own region.** Each refs file and entry is applied only in its own
    region (`scene_origin`; none means Andheri East).
  - **`--cam-on-road`.** The street still and the walk start stand on the carriageway in
    front of the entrance, not in the first gap 38 m out. Used for A14/18/19, whose
    entrance faces a narrow Sector 9 street.
  - **The Andheri landmark tags need a nearby building.** They now only attach to a
    building within 400 m, which never happens outside Andheri.
- `check_logic.py`: skips another region's survey.
- `engine/world.js`:
  - `W.origins` gives each model its own map origin (two regions in one atlas).
  - `W.factKeys` maps the explorer's fact names onto the workbook's columns.
  - `W.specSourced` shows sourced facts in the details panel.
