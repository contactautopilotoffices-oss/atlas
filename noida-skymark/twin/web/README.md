# F1 Skymark twin: web viewer

One building page for F1 Skymark (Noida). It shows every floor and every tenant on its floor, with a walkthrough per tenant floor that you move through by walking. It is built on three.js r169, the same stack as `../../volt/volt.js`. It will replace the live Volt page later. For now it is a separate page at `/noida-skymark/twin/web/`.

## Run locally

```
python3 noida-skymark/twin/web/tools/serve_nocache.py 8137     # serves the repo root, caching off
open http://localhost:8137/noida-skymark/twin/web/
```

The `.claude/launch.json` entry `twin-web` starts the same server. The page needs `/engine/vendor/three` and the tenant folders, so it must be served from the repo root.

URL flags:

| Flag | Effect |
|---|---|
| `?model=placeholder` | Force the placeholder model even when a GLB exists |
| `?build` | Also try the Blender worker's local `../_build/<t>/` output (it is not deployed) |
| `?fps` | Show the frame-rate meter |
| `?nocity` | Skip the 500 m context and the 500–650 m ring |
| `?fast` | Glides at a quarter of their length (for automated checks) |
| `?present` | TV mode: shows the QR code and waits for a phone (Volt's presenter remote) |
| `#tenant=paytm` | Open on that tenant's reception |

## How the page works

1. **Building.** It opens on a slow three-quarter orbit of the real F1 Skymark.
   - The building is the same photo-based twin and 500 m city that the live Volt page uses (`../../exports/fm_skymark_atlas.glb` and `fm_skymark_context_500m.glb`). They are placed with Volt's `site_fit`, exactly as `volt.js` places them.
   - The Overture buildings 500–650 m out (`../../reconstruction/context_overture.json`) are added as plain massing.
   - The twin's glass is replaced with clear vision glass (`js/look.js`): slightly green-grey and mostly see-through face-on, with a Fresnel term that makes the edges more opaque and reflective. It reflects a sky environment.
   - The twin's solid `Building_Mass` is hidden, so you see into the building. Behind the glass, every level shows its slab, a ceiling with a soft grid of lit fixtures, the core (from Paytm's `shell.core`), and on tenant floors the desk rows from the layouts.
   - Spandrels stay opaque dark metal.
   - One floor list covers every floor. An occupied floor shows each tenant's name and work-seat count. Any other floor shows a grey "Available" (the ground floor shows "Lobby"). Altruist is listed on floor 2 in grey as "fit-out drawing to follow".
   - Hovering a floor lights one band along its slab edge.
2. **Floor.** Choosing a floor glides the camera down along the orbit sphere. The floors above lift away (the section cut) and the floor's facade and partitions are cut to about 1.2 m. Tenant tags sit at each tenant's reception.
3. **Tenant.** Choosing a tenant moves the camera down over its reception while the walls rise back to full height. It lands on the reception's entry view.
   - The left panel shows the seat proof (the groups from `<t>_summary.json`), the room list, an "Assumptions" section (rendered from the assumptions file) and where the model and views came from.
   - The room card is on the right. The frame is shifted with `setViewOffset` so the card never covers the subject; on phones the card sits at the bottom.
4. **Quick views.** Use Next/Prev, keys 1–4 or the card's buttons.
   - Each view is reached by a 1–1.5 s eased glide along an A* route over the floor's walkable grid.
   - Moving to another room glides through the doors along the real route (about 1.7 m/s, up to 8 s) and lands on that room's entry view.
   - Once every view of a room has been seen, its Finishes panel opens.
5. **Walk.** "Enter" (or the Return key) starts the walk.
   - Desktop: W A S D or the arrow keys to move, Shift to go faster, drag to look. "Mouse look" turns on pointer lock.
   - Phones: a virtual joystick to move, drag to look.
   - Eye height is 1.6 m and the near plane is 0.1 m.
   - Collision uses a 0.25 m body radius against walls, glass, columns, furniture footprints and open door leaves.
   - There is no click-to-move and no jump cut anywhere.
   - Only the chosen floor's slab, facade, ceiling and lid are drawn.
6. **Floor plan (every tenant, from the layout JSON alone; `js/minimap.js`).** It shows in quick views, the walk and the tour, and is hidden in the building orbit.
   - The CAD plan: rooms tinted by kind, walls, glass, doors, desks and room names (overlapping names are dropped).
   - Areas that are not this tenant's fit-out are hatched; another tenant on the same plate is grey and named (Altruist shows as "Altruist (later)").
   - "You are here": a dot with the view cone, live.
   - "Where you're heading next": the next authored view marked, or, during a glide or the tour, the planned A* route as a dashed line with the destination room outlined and "Heading to …" above it.
   - Tap a room on the plan to glide there along the route.
   - Desktop: an inset bottom-left (⤢ toggles the whole floor). Phone: a "Plan" chip that opens a sheet, placed so the room card stays clear.
7. **Tour.** It plays every room's views as slow shots. Each shot holds about 5 s with a gentle push in and pan, and the camera glides along the route between shots. Esc or any navigation stops it.
8. **Finishes.** These are true material swaps: a different material object goes on every mesh of that part. For a GLB, the option names a material that is in the GLB. The page never recolours pixels.
9. **Leaving.** "All floors" rises back out through the section to the orbit. The floor's tenants are disposed (geometries, materials and textures). Floors load lazily when they are chosen.

Room names are cleaned up for display only (`displayName` in `js/tenant.js`); the layout data is unchanged. For example: "4 SEATER MEETING ROOM 01 (2)" becomes "4-Seater Meeting Room 1B" (the CAD repeats "01" for three rooms), "8 PAX MEETING RM 01" becomes "8-Person Meeting Room 1", "CABIN-02" becomes "Cabin 2", and "Entry" becomes "Entry Lobby".

### Presenter remote (ported)

The page uses Volt's `present.js`, `link.js` and `remote-config.js` unchanged, and the phone side is still `../../volt/remote.html`.

These remote commands are mapped:

- `building` and `reset`
- `floor`
- `enter`
- `room`
- `next` and `prev`
- `walk`
- `tour`
- `move`
- `look`
- `zoom`
- `goto` (a tap on the plan goes to that room by route)

These are ignored: time of day, elevation, cut, seats, walls, gallery, place.

The phone's room list and plan image are those of the tenant shown on the display when the phone connects.

## Files

| Path | What |
|---|---|
| `index.html` | Page, CSS (desktop and phone), importmap to `/engine/vendor/three` (r169) |
| `js/main.js` | Scene, single camera owner (glides / orbit / walk), floor picker, section, landing, quick views, tour, options, panels, presenter |
| `js/tenant.js` | Tenant loader: layout to rooms, walkable grid, views; placeholder model from the layout; GLB + lightmaps; option swaps; dispose |
| `js/nav.js` | Walkable grid (exact distance transforms), collision, A* with string pulling, route smoothing, fallback cameras |
| `js/twin.js` | The photo twin + 500 m context (as on the Volt page), placed by `site_fit`; two clipped copies for the section; the 500–650 m Overture ring |
| `js/look.js` | Sky texture/environment and the vision-glass material |
| `js/building.js` | Per level: interior hints (ceiling, fixtures, core, desk rows), the band, and the floor's own slab / CAD curtain wall / lid shown when it is opened or walked |
| `js/md.js` | Small markdown renderer for the assumptions |
| `building.json` | Floors, levels, floor-to-floor height, which tenants are on which floor |
| `tenants/<t>.json` | One manifest per tenant (schema below) |
| `models/index.json` | What the Blender builder has delivered (empty = placeholder everywhere) |
| `tools/serve_nocache.py` | Local server. Its POST `/__review` saves frames to `_review/` (local checks only) |
| `_review/` | Screenshots from checks (gitignored) |

## Data contract with the Blender builder

### Coordinate frames

Every tenant file uses that tenant's own CAD plan frame: metres, x east, y north, z up from the finished floor. This holds for the layout, the cameras and the GLB (in glTF, three `(x, y, z)` = plan `(x, z, -y)`, with no recentring). The viewer places each tenant on the building with the manifest's `frame`, which is the column registration from `cad/plate_fit.json` onto Volt's frame:

```
p_volt = R(rot_deg) · p_tenant + (dx, dy)      // rotate about the tenant origin, then shift
world  = (p_volt.x, level · 4.1 + z, -p_volt.y)
```

Volt's frame is the building frame (identity). **The builder must not recentre or rotate its exports.**

### Tenant manifest: `tenants/<tenant>.json`

```jsonc
{
  "id": "paytm", "name": "Paytm", "floor": 1, "accent": "#00baf2",
  "layout":  "../../paytm/paytm-floor1.layout.json",          // CAD layout (cad/README.md schema)
  "summary": "../../paytm/paytm_summary.json",                 // seat proof (read at runtime for the DWG name)
  "frame": { "rot_deg": -0.04, "dx": -25.281, "dy": -6.147, "source": "cad/plate_fit.json" },
  "seats": { "work": 244, "all": 313, "groups": { "Work seats (desk + chair)": 244, "...": 0 } },  // copied from the summary
  "reception": "RECEPTION/ WAITING AREA",                      // the room the landing goes to (else the first room of kind reception)
  "tour": ["optional", "room", "order"],                        // optional; default: reception, then nearest next
  "shared_with": "volt",                                        // optional: that neighbour's demise is drawn by the neighbour (the shared east strip)
  "assumptions": { "path": "../../paytm/paytm_assumptions.md", "section": null },   // section: a heading to cut out of a longer file
  "seat_plan": "../../paytm/paytm_seat_plan.png",              // used by the phone remote's map
  "model": { "use": "auto|placeholder", "index": "models/index.json",
             "dev_build": { "viewer": "../_build/paytm/export/paytm_viewer.json", "cameras": "../_build/paytm/paytm_cameras.json" } },
  "stills": [ { "camera": "paytm_CAM_reception_entry", "src": "models/paytm/stills/paytm_CAM_reception_entry.jpg", "option": null } ],
  "options": [ { "id": "carpet", "label": "Carpet", "part": "carpet", "rooms": "*" /* or ["room name"] or {"kinds": ["work"]} */,
                 "choices": [ { "id": "blue", "label": "Slate blue tile", "swatch": "#8fa3c4",
                                "preset": "carpet-blue",          // placeholder: a material preset in js/tenant.js
                                "material": "carpet_blue",        // GLB: a material of this exact name must be in the GLB
                                "part_material": "carpet",        // GLB: the material it replaces (default: the part name)
                                "stills": { "<camera name>": "url" } } ] } ],   // optional pre-rendered stills per view
  "panos": []                                                    // optional 360 spots; never used for navigation
}
```

### Delivered files: `models/index.json`

```json
{ "tenants": { "volt": { "viewer": "volt/volt_viewer.json", "cameras": "volt/volt_cameras.json" } } }
```

Copy the builder's `export/` folder to `models/<t>/` (GLB, lightmaps, `<t>_viewer.json`), copy `<t>_cameras.json` next to it, and add the entry. A tenant without an entry gets the placeholder and computed views. The page never probes for files that are not listed, so a missing GLB does not cause 404 errors in the console.

### `<t>_viewer.json` (from `bake_export.py`, used as is)

`glb`, `lightmaps` (`{node name: {lightmap, lightMapIntensity, uv: 1}}`), `exposure_ev`, `collision_node`.

Every lightmapped mesh becomes an unlit `MeshBasicMaterial`: its colour and map, times the lightmap, times the intensity, divided by π. That is the same lightmap term as the standard material, with no sun, sky or environment added on top. Each lightmap is applied as the docstring in `bake_export.py` says:

- `channel = 1`
- `flipY = false`
- sRGB colour space
- `lightMapIntensity` taken from the manifest
- tone mapping AgX at `2 ** exposure_ev`

While a GLB floor is in view, the unbaked meshes (instanced furniture) get a dim room environment (0.6), and the sun and hemisphere lights are turned down to 0.35 and 0.12. Other rules for the GLB:

- **Section view.** Nodes are grouped by `extras.twin_layer`:
  - `CEILING`, `LIGHT`, `HVAC` and `SLAB` hide in the section view.
  - `WALL`, `GLASS`, `DOOR`, `COLUMN`, `BLIND`, `SKIRTING`, `RAILING` and `LOGO` are scaled down to cut the walls away.
- **Collision.** The collision node is hidden. Walking and routes use the grid built from the layout.

### `<t>_cameras.json` (from `make_cameras.py`, used as is)

`cameras[]` with `room` (exact layout room name), `kind` (`entry | feature | reverse | detail`), `position` [x, y, z], `target` [x, y, z], `fov_h_deg`. The viewer looks from `position` to `target`, which gives the real 7°/10° tilt. A room with no cameras gets computed views (see below). Order on the card is entry, feature, reverse, detail.

### Fallback views (until the cameras arrive)

`js/nav.js · fallbackCameras` computes up to four views per room on the walkable grid. The rules:

- **Eye height** 1.55 m.
- **Pitch** 7° down, or 10° in rooms deeper than 10 m and for detail views.
- **Field of view** hFOV 75° (70° for detail views).
- **Horizon** level.
- **Clearance** at least 0.8 m from furniture. In small rooms this is relaxed to 0.55 m and then 0.3 m, and the view is flagged `relaxed_clearance`.
- **No blank walls.** The centre ray must reach at least min(2.5 m, 0.4 × the room diagonal). No more than a third of the frame may be closer than 1.5 m. Furniture, glass or door leaves inside 1.7–2.2 m of the central 45° count against a candidate.

How each view is chosen:

| View | Where | Looks at |
|---|---|---|
| Entry | Within 3.2 m of the room's door | Across the room to the far corner |
| Reverse | The far side of the room | Back towards the entry |
| Feature | Any free point | The CAD `feature_wall`, else across the other diagonal |
| Detail | 1.4–3.6 m from the main table or desk cluster | That table or cluster |

## Known gaps

- The phone `remote.html` is still Volt's. Its title and plan follow the tenant in view when the phone connects.
- **Stills.** The tenant panel shows a "Stills (n)" button when `stills[]` or any option's `stills` map has entries. It opens a gallery with "Views" and one section per finish option. With no stills, the button stays hidden. It has only been tried with test data.
- The 360 photo spots are not built (they are optional).
- **Rooms the walk cannot reach.** A room that cannot be reached on foot from reception is left out of the room list and logged in the console. On Volt this is the "Atrium-side lounge".
- **Volt doors.** Volt's older layout has no door `opening` or `hinge`. The viewer infers each opening from the open leaf and the walls. Where a wall is drawn through an opening, the viewer opens every candidate that has floor space on both sides, so collision there can be up to one door width looser than the real wall.
