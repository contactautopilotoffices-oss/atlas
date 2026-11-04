# Photo to digital twin

Photos of a real building in; out come a structured model in which every
element says how we know it, a photoreal scan, and both on the web.
Skymark F-1 is the first building.

Two representations, one coordinate frame (metres, x east, y north, z up,
around the building's origin in `buildings/<id>.json`):

| | Visual twin | Structured twin |
| --- | --- | --- |
| What | A Gaussian splat (and the COLMAP point cloud) | Storeys, slabs, facade grid, doors, roof, rooms, assets, each with a stable id |
| From | COLMAP camera poses + splat training | Blender Python generators, driven by `buildings/<id>.json` |
| Good for | Showing clients exactly how it looks | Selecting, measuring, linking to tickets, assets and vendors |
| Can't | Give editable objects | Be more right than its evidence |

## Stages

Each stage writes files that the next one reads, so any stage can be rerun on
its own.

| # | Stage | Script | Runs here? |
| --- | --- | --- | --- |
| 1 | Ingest: EXIF, GPS, blur, exposure, duplicates | `ingest.py PHOTOS` | yes |
| 2 | Building understanding: storeys, facade types, grid, materials, as `buildings/<id>.json` with evidence | Claude, reading the photos and the ingest report | yes |
| 3 | Camera poses + sparse points (COLMAP) | `sfm.py PHOTOS WORK` | yes, CPU (minutes for 50 photos) |
| 4 | Gaussian splat (Nerfstudio splatfacto or OpenSplat) | to come | **no: needs an NVIDIA GPU** (or an Apple Silicon Mac for OpenSplat) |
| 5 | Structured model in Blender, matched to the points and photos | to come, on the pattern of `scripts/skymark/blender/conf18.py` | yes |
| 6 | Validation: render from each photo's recovered camera, side by side with the photo; export GLB and splat | to come | yes (render), GPU for the splat |

Video instead of photos: `ffmpeg -i walk.mp4 -vf fps=2 -q:v 2 PHOTOS/f%04d.jpg`.

## Evidence

Every element in `buildings/<id>.json` (schema: `schemas/building.schema.json`)
carries one of five evidence classes:

- **measured:** by us, with a tape, laser or survey, or a photo model scaled by one.
- **documented:** from an authoritative document (developer, approved drawings,
  a fit-out deck).
- **reconstructed:** derived from several photos or from map data.
- **estimated:** inferred from limited evidence or typical values.
- **unknown:** no evidence, so shown only as a placeholder.

A photo reconstruction has no scale until something measured fixes it, so
`sfm.py` reports its scale as relative until then. No made-up quality scores:
confidence is given only where it can be computed (e.g. reprojection error, or
the camera position error against a known capture).

## Testing without photos

`scripts/skymark/blender/conf18.py --capture N --out DIR` renders N photos of
a modelled room with known cameras (`DIR/truth.json`). Run `sfm.py DIR WORK
--truth DIR/truth.json` to see how far the recovered cameras are from the
true ones, in metres. That's the pipeline's own accuracy check, before real
photos arrive.

### Results so far (Volt conference room, 36 synthetic photos, 1024 x 576)

| Run | Registered | Reprojection | Camera error, mean / max |
| --- | --- | --- | --- |
| Defaults (a lens per photo, exhaustive matching) | 36 / 36 | 0.76 px | 0.77 m / 3.1 m |
| One shared lens, exhaustive | 36 / 36 | 0.76 px | 0.76 m / 2.8 m |
| One shared lens, sequential (8) | 36 / 36 | 0.67 px | 0.62 m / 1.7 m |
| Same, with nothing outside the window | 11 / 36 | 0.82 px | 0.58 m / 2.2 m |

Low reprojection error with metre-level camera error means the solve agrees
with itself but not with reality. This room is a hard case: both long walls are
glass, the cameras face the window, and the chairs and bays repeat. Glass
reflections put features where nothing is, and repeats get matched to the wrong
copy. What helps on real photos: one lens for the set, sequential matching
along a walk, GPS from the phone as a prior, shooting glass at an angle, and
plenty of solid, textured surfaces in every frame (all in `CAPTURE.md`). Not
yet tried: masking glass and sky, and GPS priors in the solve. A real exterior
capture is the test that matters.

## Not here yet, on purpose

- **The upload app, job queue and database** (Supabase tables `dt_*`, Redis
  workers) come when a second building needs it. One building is run from
  these scripts, and every stage is a command.
- **MCP for Blender** is for working live in Blender on a desktop. Here and in
  production, Blender runs headless from versioned scripts (`pip install
  bpy`), which is the reproducible path anyway.
- **MEP, IoT and facility management links** come after the exterior is proven.

What to shoot: `CAPTURE.md`.
