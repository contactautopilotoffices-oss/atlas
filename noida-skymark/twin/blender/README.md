# Twin floor builder (tenant-generic, headless)

Builds a tenant's fitted floor in Blender from its CAD layout JSON and a style JSON,
checks it, lights it, places cameras, renders stills, bakes lightmaps and exports a
GLB for the three.js viewer. Geometry always comes from the CAD; the style only says
what things are made of.

Blender 5.2 (tested 5.2.3 on a MacBook Air M5, Cycles on the Metal GPU). No cloud.

```
B=/Applications/Blender.app/Contents/MacOS/Blender
T=noida-skymark/twin/blender
$B -b --factory-startup --python $T/build_floor.py -- \
   --tenant arcil --layout noida-skymark/arcil/arcil-floor2.layout.json \
   --style $T/styles/arcil.json --out noida-skymark/twin/_build/arcil --stage geometry
```

Run the stages in order (each opens the previous stage's `.blend` in `--out`):

| stage | what it does | output in `--out` |
| --- | --- | --- |
| `geometry` | slab, floor finishes, walls with glass openings, enclosure, atrium, glazing, doors, ceilings, fixtures, furniture, logo, feature walls; snaps to the floor; runs `placement_check.py` | `<t>_geometry.blend`, `<t>_placement.json`, `<t>_circulation.png` |
| `light` | sun + physical sky (portals in every facade window), a lamp in every downlight / pendant, AgX; exposure from a grey card; 3 previews checked for blown / black pixels | `<t>_light.blend`, `<t>_greycard.json`, `previews/` |
| `cameras` | `make_cameras.py`: entry / feature / reverse / detail per room, ray-cast gated; hand overrides from `cameras_override/<t>.json`; contact sheets | `<t>_cameras.json` (web), `<t>_cameras_plan.json`, `<t>_cameras_report.json`, `review/contact_<room>.png` |
| `stills` | 1920x1080 Cycles, denoised; multilayer EXR with Cryptomatte; one mask PNG per style part; a copy of each still in `review/` | `stills/`, `review/still_*.png` |
| `bake` | lightmaps (2nd UV `lightmap`): 2048 px atlases, 256 samples, ~2.5 cm/texel (columns 1.5 cm in their own atlases), objects bigger than an atlas cut into 8 m tiles, margin 16 px, OIDN with albedo + normal guides | `<t>_baked.blend`, `export/lightmaps/` |
| `export` | web GLB (architecture merged per lightmap atlas and layer, other statics merged per layer, furniture decimated and turned into EXT_mesh_gpu_instancing, EXT_meshopt_compression), `<t>_lod.glb` (boxes, no textures) for the section view, `<t>_viewer.json` (exact renderer settings), collision node; copies them to `noida-skymark/twin/web/models/<t>/` and adds the tenant to `models/index.json`. **Refuses if the placement check is not clean** unless `--allow-placement-issues` | `export/`, `../web/models/<t>/` |

`--stage geometry,light,cameras` runs several; `--stage all` = geometry..export (no stills).
Every stage prints its seconds and appends them to `<out>/<t>_timings.json`.

Night-planning knobs (fast defaults):
`--preview-samples 32  --contact-samples 16  --stills-samples 128  --stills-res 1920x1080  --stills-max 0 (all)
 --stills-kinds entry,feature,reverse,detail  --rooms REGEX  --bake-res 1024  --bake-samples 64  --bake-texel 0.04
 --tex-res 1024  --option ceiling=black_open  --device gpu|cpu`

Standalone checks on a built file:
```
$B -b OUT/<t>_geometry.blend --python $T/placement_check.py -- --tenant <t> --layout L.json --style S.json --out OUT [--no-nudge] [--save]
$B -b OUT/<t>_light.blend    --python $T/make_cameras.py   -- --tenant <t> --layout L.json --style S.json --out OUT
```

## Frames and units

- Layout, `<t>_cameras_plan.json`, `cameras_override` (default): **plan frame**, metres, x east, y north, z up from
  the finished floor (z = 0), origin = the CAD drawing's origin as the layout states it.
- `<t>.glb`, `<t>_lod.glb`, `<t>_cameras.json`: **glTF / three.js frame** of the same plan, metres, Y up:
  three (x, y, z) = plan (x, z, -y). Not recentred, not rotated; the viewer applies the plate fit (layout `site_fit`).
- `<t>_cameras.json` shape: `{"frame": ..., "rooms": {"<room>": [{"kind": "entry|feature|reverse|detail", "position": [x, y, z],
  "target": [x, y, z], "hfov_deg": 75, "room": "<room>", "label": "...", "name": "<t>_CAM_<room>_<kind>", "still": "stills/<name>.png"}]}}`.
- Style options are true re-builds: `--option ceiling=black_open --out <out>/options/ceiling-black_open --stage geometry,light
  --exposure-ev <main EV> --daylight-scale <main scale>` then `--stage stills --cameras-from <out>/<t>_cameras_plan.json
  --camera-names <hero camera>` renders the same camera with the other ceiling (the main EV keeps the comparison fair).

## Review

`python3 montage.py <out>/review [0|1|2|3]` puts the entry (feature, reverse, detail) view of every room on one labelled sheet.
Exterior: windows look out on the Overture neighbours (extruded blocks) on a ground plane and the physical sky; the light
stage keeps the view through the windows within 3 stops of the interior grey card (`<t>_windows.json`) by scaling the
daylight down if needed. Glass materials have fixed names for the viewer: `facade_glass`, `partition_glass`,
`partition_glass_frost`.

## Looking at it in the user's live Blender

`live.py` talks to the blender-mcp add-on (socket 9876; protocol: one JSON
`{"type": "execute", "code": ..., "strict_json": true}` + NUL per connection; the code sets `result = {...}`).
```
python3 $T/live.py info
python3 $T/live.py open OUT/<t>_light.blend          # refuses if the live file has unsaved work
python3 $T/live.py shot /tmp/v.png --camera <t>_CAM_reception_entry --shading RENDERED --wait 8
python3 $T/live.py shot /tmp/top.png --shading SOLID --view top
python3 $T/live.py run some_script.py
```
Heavy work (bake, stills, export) stays in headless `-b` runs. Never two Cycles jobs at once on 16 GB.

## The rules it enforces (each was a past failure)

1. One object per CAD block instance, named `<tenant>_<LAYER>_<block>_<n>`, one collection per layer.
   Identical blocks share one mesh (linked duplicates): the GLB keeps them as instances. No joining.
2. Floor finishes are a partition of the floor (a 25 mm raster gives every cell to exactly one room;
   overlapping CAD room boxes go to the smaller room), so no finish lies on another; the structural slab
   stops 20 mm below them; rugs sit 4 mm above. Everything floor-standing is snapped onto the surface
   below it (ray casts from its lowest vertices).
3. Ceilings per room, type from the style by room kind or name: `grid` (600 tiles, T-grid with main runners
   and cross tees 2 mm apart, LED panels where the CAD has them, AC grilles on a regular pattern (assumed),
   accent tiles, optional perimeter gypsum band with a cove), `open` (painted soffit, duct, mesh cable tray,
   red sprinkler pipe with drops, pendants, optional felt raft and linear pendant), `cove` (gypsum raft with
   an upward LED strip behind a lip), `baffle` (slats under a painted soffit), `plain`. Light positions from
   the layout's `lights`; a room with none gets a 1.8 m grid, logged as assumed.
4. Light: sun + physical sky (Blender's multiple-scattering sky, white-balanced), a light portal in every
   facade window, spot lamps in downlights and pendants, emissive panels / LED strips; AgX Medium High
   Contrast; exposure from 18 % grey cards at desk height in the three biggest rooms
   (EV = log2(0.18 / median card value)); previews scored for blown (>= 0.98) and crushed (<= 0.03) pixels.
5. Enclosure: walking the floor outline, any stretch with no wall or glass within 0.35 m gets an assumed
   closing wall (logged); walls and columns run up to the soffit; the slab above closes the top; the atrium
   has a glass balustrade and shaft walls above and below.
6. Doors: the CAD draws the leaf open; the frame goes in the wall opening beside the hinge (the candidate
   that is clear along its width with wall or glass at both jambs), with a header wall up to the soffit.
   Stairs from the STAIR layer's treads. Logo on a flat wall of the matched room (image, else text mesh).
7. Detail: bevels on walls, columns and furniture, weighted normals, skirting, frames; textures generated
   as tileable PNGs at true scale on a metre UV (a 600 mm carpet tile is 600 mm).
8. `placement_check.py` (see its docstring): BVH overlaps with real penetration depth (vertices inside the
   other mesh), floating / sunk > 2 mm, ceiling fixtures off the ceiling, circulation narrower than 1.2 m on
   widest-path routes from the entry to every door, CAD-labelled passages. Nudges <= 20 mm are applied and
   logged; anything larger is reported, never moved or deleted. Foliage is treated as soft.
9. `make_cameras.py`: eye 1.55 m, hFOV 75 deg, level camera with lens shift (7 deg, 10 deg in deep rooms),
   >= 0.8 m from furniture (relaxed and flagged in small rooms), ray-cast gates (void, mean distance, one
   surface <= 38 % of the frame, ceiling <= 35 %, centre distance).
10. Export: see `bake_export.py`'s docstring for how three.js r169 applies the lightmaps.
11. Stills: Cryptomatte material masks per style part (style `parts`, wildcards allowed).

## Layout schema the builder relies on

Metres, plan frame (x east, y north), z up from the finished floor. Required: `floor` (or `bounds`),
`walls` (`outer` + `holes`), `glass` (`[x0, y0, x1, y1, layer]` or `{"a", "b", "layer"}`), `rooms`
(`name` + `box` or `poly`; optional `floor` finish key and `kind`), `doors` (`c`, `w`, `a` = the open
leaf's centre, width, angle; `glass`, `fire`). Optional, used when present: `columns`, `desks` (`c, w, d,
a, kind, h, block`), `tables` (`poly` or `circle`, `h`), `seats` (`x, y, face, kind, len, dep, block`,
sofas with `ids`), `planters`, `plants`, `lights` (`c`, `kind` panel600 / downlight), `skirting`,
`fixtures`, `stairs.steps`, `atrium`, `extra_rooms`, `labels` (ENTRY / LIFT / RECEPTION find the entry
door; "... WIDE PASSAGE" labels are measured), `heights`, `storeys.floor_to_floor`, `site_fit.rot_deg`
(sun bearing to plan), `circulation` (polylines are measured; a dict of polygons is tolerated and the
derived routes are used). Unknown keys are ignored.

## Styles

`styles/volt.json` (from volt_render.py's look), `styles/arcil.json`, `styles/paytm.json` (both `extends`
volt.json for the shared basics). Keys: `materials` (kinds: paint, carpet (tile / plank), wood, terrazzo,
stone, tile, ceiling_tile, fabric, felt, plain, plastic, metal, glass, frost, emission (kelvin), screen,
leaf, image), `floors` / `floor_by_kind` / `aisle`, `room_kinds` (regex -> kind), `ceilings` (default /
kinds / rooms), `glass`, `facade`, `walls`, `doors`, `furniture`, `logo` (one or a list), `feature_walls`
(panel, fluted, triangles, lockers, wave), `parts` (masks), `options` (switchable groups, e.g. Paytm's
`ceiling`: navy_open (default), black_open, timber_baffle_aisle, perforated_metal_aisle, green_baffle),
`brief_gaps` (what the brief asks for that is not built yet).
