# Generic Skymark CAD pipeline

Turns a tenant's fit-out DWG into the same layout JSON Volt's 3D floor uses, plus a seat proof,
dimension checks, a layer list and a plan image. Volt's own scripts (`../volt/cad/`) are left as they
are; this folder is the generic version of them. Tenant-specific facts (plan window, block names,
the deck's claims) live in `tenants/<tenant>.json`, not in the code.

## Run

```
ACAD_TS=<folder holding node_modules/@node-projects/acad-ts> PY=<python with shapely + matplotlib> \
  cad/run.sh --tenant arcil --dwg "/path/20260923_SKY MARK NOIDA_2nd floor_ARCIL.dwg" --floor 2
```

Outputs go to `noida-skymark/<tenant>/` (intermediates in `<tenant>/cad_data/`); `--out` / `--work`
override. Python runs with `-I`: the DWG and everything read from it are untrusted data. DWGs are never
copied into the repo. acad-ts reads AC1018 (2004), AC1024 (2010) and AC1032 (2018) files directly; no
converter was needed for any of the four Skymark DWGs.

Then, across tenants:

```
$PY -I cad/plate_fit.py --ref volt/volt-floor1.layout.json --ref-config cad/tenants/volt.json \
    --extra-ref <generic Volt run>/volt-floor1.layout.json \
    --tenant paytm=paytm/paytm-floor1.layout.json,cad/tenants/paytm.json,1 \
    --tenant arcil=arcil/arcil-floor2.layout.json,cad/tenants/arcil.json,2 --out cad
$PY -I cad/fit_to_twin.py --tenant arcil --floor 2 --layout arcil/arcil-floor2.layout.json \
    --volt volt/volt-floor1.layout.json --plate-fit cad/plate_fit.json --context reconstruction/context_overture.json
```

Verification: `cad/run.sh --tenant volt --dwg <Volt R16 DWG> --floor 1 --out <scratch>` reproduces the
live Volt proof exactly: 116 work seats, 213 seats in all, and the same (block instance, group) for
every seat as `volt/volt_seats.csv`.

## Steps

| Script | Does | Writes |
|---|---|---|
| `flatten.mjs` | every model-space entity, blocks exploded to world coordinates, with layer, top block and block chain (Volt's flattener, same record format) + dimensions, hatches, paper-space text, header units | `cad_data/flat.json(.gz)` |
| `inst.py` | one record per block instance in the plan window (never merged) | `cad_data/inst.json` |
| `rooms.py` + `roomplan.py` | free space closed by wall, glass, railing and column lines; door openings closed along the closed leaf (found from the swing arc); revision clouds ignored; partition ends stretched 0.25 m; openings with no door block closed where two wall ends face each other 0.55-1.15 m apart (`auto` closures); hand closures and label fixes from the tenant json. Each closed face becomes one room (named by the CAD text inside), a set of work-hall zones (desk clusters) + furniture zones + `circulation`, or `not_demised` (OCCUPIED / unfitted). Chairs placed in rooms, paired with desks | `cad_data/rooms.json`, `seats.json` |
| `proof.py` | seat table and summary; deck-vs-CAD lines; lockers from unit rectangles | `<t>_seats.csv`, `<t>_summary.json`, `summary.json` |
| `layout.py` | layout JSON (Volt schema + optional keys below) | `<t>-floor<n>.layout.json` |
| `checks.py` | pass / fail / info items: units, columns, walls, doors, rooms, plate, heights | `<t>_checks.json` |
| `plan.py` | plan image: rooms by kind, seats as dots, names | `<t>_seat_plan.png` |
| `assumptions.py` | plain-English list of what is not in the CAD, for the web page | `<t>_assumptions.md` |
| `inventory.py` | every layer and block with counts and the category it maps to; what the drawing does not contain | `<t>_layers.md` |
| `plate_fit.py` | registers each plan on Volt's frame from columns; compares demises | `plate_fit.json/.md/.png` |
| `fit_to_twin.py` | `site_fit`, level, podium or overhang for the twin | updates the layout JSON |

## Seat groups

Same letters as Volt, one added: **W** work (a work chair not in an operator room), **M** meeting,
**T** training (new), **C** cafe, **L** lounge/collab/visitor, **O** operator (rooms matching
`operator_rooms`: Autopilot cabin and its reception on the first floor). Sofas: one row per place.

## Layout JSON

Every key of `volt/volt-floor1.layout.json` is present with the same shape (`about, heights, bounds,
floor, atrium, walls, glass, columns, rooms, desks, tables, seats, planters, plants, doors, lights,
labels, zones, skirting, plate, lifts, storeys, stairs, fixtures, fixtures_about`, and after
`fit_to_twin.py`: `site_fit, podium, podium_edges, podium_about, shell_outline`). A builder written
for Volt's file reads these unchanged. `extra_rooms` holds the washrooms (name + box, as in Volt's file);
`glass_opened` appears once `../volt/cad/open_glass.py <layout>` has been run on the file (optional, as for Volt).
`atrium` is null on a floor without one (ARCIL, second floor); Volt's builder already checks `if (L.atrium)`. Added keys are optional:

| Key | Meaning |
|---|---|
| `rooms[].kind` | work, meeting, training, cafe, lounge, reception, wc, core, service, operator, occupied, circulation, other (from the name, rules in `tenants/_skymark.json`) |
| `rooms[].poly`, `rooms[].holes` | the room polygon (plan metres). `box` stays as the polygon's bounds |
| `rooms[].area_m2`, `rooms[].seats` | area of the polygon; chairs inside |
| `rooms[].enclosed` | false when the walls did not close and the room is a nearest-label share of an open area |
| `rooms[].ceiling` | `{type: grid 600x600 tile / gypsum / mixed / open or not drawn / not in CAD, grid_frac, gypsum_frac, source}` from the reflected ceiling plan layers |
| `doors[].width_m` | leaf length (the opening) |
| `doors[].hinge`, `swing_r_m`, `swing_deg`, `swing` | hinge point, swing radius, sweep, `cw`/`ccw` from closed to open seen from above |
| `doors[].opening` | `[x0, y0, x1, y1]` the closed-leaf line (hinge to closed tip) |
| `doors[].open_leaf_tip`, `layer`, `instance`, `in_block` | leaf tip as drawn; door layer; block instance; parent block (phone booth doors) |
| `lights[].block`, `instance`, `len`, `a` | source block; for linear lights the length and angle |
| `seats[].instance`, `seats[].desk_pair` | the chair's block instance; desk pairing evidence |
| `desks[].instance` | the desk's block instance |
| `stairs_all` | every stair core: bbox, tread-line count, plan note, `rise_total_mm`, `risers`, `riser` |
| `storeys.level`, `slab_z_m`, `cad_floor_to_floor_m` | the floor number; slab height used in the twin; the stair notes' rise per floor (3.9 m) |
| `demise` | `{outer, holes, excluded, area_m2, area_sqft}`: plate minus atrium minus `not_demised` |
| `circulation` | `{polygons: [{name, poly, holes, area_m2, centreline: [[[x,y],...], ...]}], passages: [{label, x, y, width_m}]}`: corridors and open floor left after rooms and zones, each with an approximate centreline (medial axis); and the CAD's passage labels with their widths |
| `not_demised` | `[{poly, holes, area_m2, why}]`: other tenants' space (a face labelled OCCUPIED) or a large unfitted area (Volt's zone on Paytm's plan). Never in `rooms` |
| `closures` | `[{a, b, why, source: 'tenant config' or 'auto', virtual?, gap_m?}]`: every line added to close a room. `virtual: true` = a zone line where no wall exists |
| `rooms[].lights` | the RCP fixtures inside the room: `{c, kind, w, d}` (panel600 0.6 x 0.6), `{c, kind, dia}` (downlight 0.17), `{c, kind, len, a}` (linear) |
| `rooms[].doors` | doors on the room's boundary: `{instance, c, width_m, hinge, hinge_side (left/right, standing in the opening facing into the room), swing (cw/ccw), opens (into/out of the room), glass, fire, opening}` |
| `rooms[].feature_wall` | `{wall: north/east/south/west, at, w, block, instance, what}` when an unnamed 1.09 x 0.09 m wall-screen block (`blocks.wall_displays`) sits on a meeting/training/cabin wall; else null. Inferred, not named in the CAD |
| `rooms[].ceiling.height_m`, `height_note` | null: no ceiling level in any of the drawings |
| `rooms[].how`, `rooms[].cad_text` | how the outline was made (enclosed face / desk cluster / furniture hull / whole open piece); original CAD text when a label was renamed |
| `shell` | `{outline (CAD plate), windows: [{c, width_m, a, a_xy, b_xy, lines}], window_note, sill_height_m: null, head_height_m: null, columns, core: [{name, kind, poly, area_m2}], stairs, lifts: {labels, shafts}, atrium, source}`: what a builder needs to enclose the floor with its real facade. The CAD outline wins over the photo twin (exported as drawn) |
| `ceiling_plan` | `{present, grid_tiles, gypsum_regions, lights_by_kind, ac_grilles, note}` |
| `unplaced_labels` | CAD room labels that could not be given a polygon (their walls did not close) |
| `labels[].clean` | the label text with drawing codes removed |
| `twin_overhang` | above the annex: parts of the plate outside the twin's main body (plan coordinates) |
| `site_fit.via_volt_frame` | the column registration that maps this plan onto Volt's frame |
| `source` | DWG name, units, tenant, floor |

## Tenant json: hand fixes (all traceable)

- `closures`: `[{a, b, why, virtual?}]` in plan metres: wall gaps the CAD leaves open, or (`virtual`) zone lines between open areas.
- `label_fixes`: `[{at, to?, move_to?, drop?, why}]`: rename, move or drop the CAD label nearest `at` (within 1.5 m).
- `label_adds`: `[{t, at, why}]`: a name for a space the CAD leaves unlabelled.

## Known limits

- Room names come from where the drafter put the text. A label outside its room is moved into the
  nearest empty enclosed space within 1.5 m; the rest are fixed by hand in the tenant json. Open-area
  zones (work halls, pantry, lounge, collab) are bounded by their furniture, not by walls.
- Seat groups never depend on room outlines except O (operator rooms); cafe seats are by chair type.
- Heights: no DWG has a section or ceiling level. Ceiling 2.85 m is assumed; the stair notes give 3.9 m
  floor to floor, the twin uses 4.1 m.
- Lockers are one rectangle per column of lockers in plan; tiers come from the labels.
