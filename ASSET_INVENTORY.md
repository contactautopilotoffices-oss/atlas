# Asset inventory: JindalX 3D explorer

`/jindalx-noida/world`, branch `update-jindal-dev`, 23 November 2026. Every asset below is generated
by a script in this repository: there are no third-party models or textures, so there is nothing to
license. Sizes are as served (meshopt GLBs, JPEG and PNG textures).

## Dioramas (what the page loads per option)

One GLB per option: the district slab, the context buildings, the Blue Line, the roads and the modelled
property. Trees are not in the GLB. The page instances them from the prototypes listed under "Trees"
below, at the positions in the option's `.json`.

| Option | File | Size | Triangles (static) | Primitives | Before the pilot (`d178278`) |
| --- | --- | --- | --- | --- | --- |
| Magnus Towers | `media/jindalx-noida/world/d/magnus-towers.glb` | 3.82 MB | 213,448 | 106 | 2.82 MB, 168,446, 86 |
| A104 | `d/a104.glb` | 3.66 MB | 192,655 | 109 | 2.63 MB, 148,647, 87 |
| A14/18/19 | `d/a14-18-19.glb` | 6.02 MB | 333,905 | 110 | 4.99 MB, 289,961, 88 |
| D1 | `d/d1.glb` | 2.83 MB | 147,914 | 106 | 1.90 MB, 107,542, 85 |

Each option also has a `d/<option>.json`. It holds the origin, the slab, the building and floors (with
the upper block for A14/18/19), the tree list, the entrance, the walk start and the routes.

## Property models (one per option)

Made by `scripts/world/hero_building.py` from `scripts/world/heroes/noida_jindalx.json`.

| Option | Family | Storeys | Triangles | Materials | Editable source |
| --- | --- | --- | --- | --- | --- |
| Magnus Towers | Grade A curtain wall, stone colonnade | B+G+5 | 48,729 | 29 | `assets/blender/magnus-towers.blend` (1.5 MB) |
| A104 | Grade B plaster, aluminium pilasters, stilt | B+G/S+3 | 43,888 | 31 | `assets/blender/a104.blend` (1.2 MB) |
| A14/18/19 | Grade B plaster, stilt, set-back upper floors and terrace | B+G/S+2+2 | 45,878 | 30 | `assets/blender/a14-18-19.blend` (1.3 MB) |
| D1 | Grade B plaster, glazed lobby | B+G+2 | 39,885 | 29 | `assets/blender/d1.blend` (1.1 MB) |

Each `.blend` is organised into ten collections: Architecture, Building_Facades,
Windows_And_Balconies, Rooftops, Vegetation, Landscaping, Amenities (empty), Street_Infrastructure,
Materials and Lighting_And_Cameras. `scripts/world/heroes/README.md` lists what goes in each.

## Building kit (inside `hero_building.py`)

| Part | Grade A | Grade B |
| --- | --- | --- |
| Ground floor | Stone colonnade, recessed glazing, a 12 m double-height portal | Stilt parking (columns, soffit, bays, a glazed lobby) or a glazed ground floor behind plaster piers |
| Upper floors | Curtain wall: mullions every 1.5 m, spandrels, aluminium slab bands, fins, a framed bay | Plaster sill and lintel bands, recessed ribbon glazing with mullions, chajjas, pilasters every 13 m, split ACs on older blocks |
| Upper block | n/a | A smaller plate at the back, with a paved terrace and railing |
| Roof | Parapet, lift room, chillers, cooling towers, tanks, solar | Parapet, lift room, tanks, VRV condensers, solar where the spec says |
| Entrance | 16 m by 7 m canopy with downlights, name on the fascia, lit lobby | 10 m by 4.5 m canopy on posts, name, lit lobby with a reception desk |
| Plot | Boundary wall with railing and pillars, two gates, guard cabin, boom barrier, forecourt, drive, parallel bays, basement ramp where it fits, pole lights, bollards | Same |
| Planting | Layered road-side bed, hedges, shrubs and flowers round the building, entrance planters, bougainvillea at the gates | Same |

## Trees (instanced by the page)

| Prototype | Species | Built by | Leaf texture |
| --- | --- | --- | --- |
| `proto_tree_a` | Neem: broad, open crown | `protos()` in `diorama.py` | `leaves_a.png` |
| `proto_tree_b` | Ashoka: tall, narrow column | `protos()` | `leaves_b.png` |
| `proto_palm` | Palm: crownshaft and cut-out fronds | `protos()` | `leaves_palm.png` |

- Each tree gets its own height and width at load.
- Levels of detail, culling and shadow cells come from `buildForest` in `engine/world.js`.
- Counts per option: A14/18/19 7,926 (with 24 planted on its plot); Magnus Towers 5,468 (25); A104 3,559 (28); D1 2,536 (27).

## Textures (`media/jindalx-noida/world/tex/`, by `scripts/world/hero_textures.py`)

Each surface set has a colour map, a roughness map (`_r`) and a normal map (`_n`). Leaf atlases are
256-colour PNGs with alpha.

| Set | Tile | Size (all maps) | Used for |
| --- | --- | --- | --- |
| `hero_glass` | 6 m by 8 m | 52 KB | Curtain wall and windows, with a painted interior (ceiling lights, blinds) |
| `hero_spandrel` | 3 m | 9 KB | Spandrel glass |
| `hero_alu` | 2.4 m | 60 KB | Champagne aluminium panels, fins, canopy |
| `hero_stone` | 2.4 m | 111 KB | Sandstone cladding, plinths, pillars |
| `hero_plaster` | 2.4 m | 125 KB | Painted cement render (Grade B walls) |
| `hero_plaster_b` | 2.4 m | 125 KB | Accent render (pilasters, stilt columns, lift room) |
| `hero_concrete` | 4.8 m | 80 KB | Fair-face concrete, chajjas, copings |
| `hero_roof` | 4 m | 20 KB | Roof membrane |
| `hero_pavers` | 2 m | 188 KB | Interlocking pavers with the red Noida cells |
| `hero_asphalt` | 4 m | 423 KB | Drives |
| `hero_lawn` | 4 m | 569 KB | Lawns |
| `hero_mulch` | 2 m | 110 KB | Planting beds |
| `hero_bark` | 2 m | 65 KB | Trunks |
| `ground_noida` | 1.5 m | 213 KB | Open ground: dry soil with patchy grass |
| `leaves_a`, `leaves_b`, `leaves_palm` | card | 98, 53, 46 KB | Neem, ashoka, palm |
| `leaves_shrub`, `leaves_bloom` | card | 95, 82 KB | Shrubs and hedges; bougainvillea |
| `leaves_grass`, `leaves_flower` | card | 78, 80 KB | Ornamental grass; mixed border (salvia, alyssum, vinca, marigold) |

The context facades (`res_*`, `com_*`, `cw_*`, `opt_*` and others) come from the earlier pipeline
(`textures.py`, `tex_facades.py`) and are unchanged.

## Lighting

| Asset | What it is |
| --- | --- |
| `media/jindalx-noida/world/sky.hdr` | The baked Blender sky, used until the studio takes over |
| `engine/andheri-scene-lighting.js` | The time-of-day studio: real sun position for the site and date, sky, reflections, fog. JindalX opens at 15:45, with exposure -0.35 EV |

## Stills

| File | What it is |
| --- | --- |
| `media/jindalx-noida/world/r/<option>-hero.jpg` | Cycles aerial of each diorama (the option cards) |
| `media/jindalx-noida/world/r/<option>-street.jpg` | Cycles street view of each diorama |
| `docs/visual-realism/*.jpg` | Before-and-after comparisons from identical cameras, Blender previews, the texture sheet |

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/world/hero_building.py` | Property model, site file, `.blend`, Blender stills |
| `scripts/world/heroes/noida_jindalx.json` | The four option specs (known and assumed) |
| `scripts/world/hero_textures.py` | All `hero_*` textures and leaf atlases |
| `scripts/world/diorama.py` | District slab, tree prototypes, `--exterior` and `--site`, logic gate, stills |
| `scripts/world/prep.py` | Region scene: footprints, heights, roads, tree placement |
| `scripts/world/plot_massing.py` | Indicative plot massings (9 m road setback) |
| `scripts/world-compare.cjs` | Before-and-after screenshots from identical cameras |
| `scripts/world-bench.cjs` | Frame time, draw calls, triangles, bytes, load |
| `scripts/world-smoke.cjs` | Every mode, option and quality tier |
