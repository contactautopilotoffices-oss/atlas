---
name: archviz-digital-twin
description: Rules and pipeline for turning photos of a real building into an Autopilot digital twin (a structured, editable model where every element records how we know it, plus a photoreal Gaussian splat, in one coordinate frame, on the web). Use whenever a task reconstructs a building or room from photos or video, plans a capture, runs COLMAP or splat training, builds a building's structured model, or decides what the twin may claim about a building. Start with Skymark F-1 (scripts/twin).
---

# Digital twin from photos

Read `archviz-quality-bar` for what good looks like and
`archviz-blender-photorealism` for rendering. This skill is about **truth**:
the twin shows the real building and says how sure it is.

## Rules (never break these)

1. **Never build a building as generic boxes.** Repeated parts (mullions,
   bays, slabs, windows) come from parameters in `buildings/<id>.json`, not
   hand-placed cubes.
2. **A photo is not a measurement.** A photo model has no scale until a
   measured dimension, a survey point or GPS fixes it.
3. **Every element carries evidence:** measured, documented, reconstructed,
   estimated or unknown, with its sources (`schemas/building.schema.json`).
   The viewer shows the class. Unknown elements are placeholders, drawn so
   they read as placeholders.
4. **Stable ids** (`skymark-f1.storey.1`, `skymark-f1.facade.se.bay.07`). An id is
   never reused for something else, because tickets and assets will point at
   it.
5. **One coordinate frame** for the structured model, the splat, the point
   cloud and the web viewer: metres, x east, y north, z up, around the
   building's origin.
6. **Keep the originals.** Never edit, drop or overwrite source photos. Flag
   them instead.
7. **Every stage is a script** in the repo, rerunnable on its own, and its
   output is versioned. Never overwrite an approved model version; add a
   new one.
8. **No invented scores.** Confidence is given only where it can be computed
   (reprojection error, camera error against known poses, model-to-photo
   overlay error).

## Pipeline (`scripts/twin/README.md`)

1. **Ingest** (`ingest.py`): EXIF, GPS, blur, exposure, duplicates. Tell the
   user what to reshoot before anything else runs.
2. **Understand.** Read the photos and write or extend `buildings/<id>.json`:
   storeys, facade systems and grid, entrance, canopy, roof, materials, each
   with evidence.
3. **Cameras** (`sfm.py`, COLMAP on CPU): registered photos, reprojection
   error and sparse points.
4. **Splat:** Nerfstudio splatfacto (NVIDIA) or OpenSplat (Apple Silicon or
   CPU). This cloud session has no GPU, so this runs on a GPU machine. Export
   PLY for a web splat viewer (GaussianSplats3D / Spark).
5. **Structured model:** Blender Python generators, fitted to the points and
   the photos. Massing first (height to width, storeys, footprint, roof,
   entrance), then the facade, then materials and light.
6. **Validate:**
   - Render the model from each photo's recovered camera.
   - Show the render beside or over the photo.
   - List every discrepancy, fix it, and save a version.
   - Then export GLB (structured) and PLY (splat).

## Definition of done for a building

- Its visible geometry is reconstructed and reviewed against the photos.
- The objects are organised in a hierarchy with stable ids.
- Unverified geometry is marked as such.
- The GLB and splat are exported, and the viewer loads and navigates both.
- The whole thing can be rebuilt from the scripts and the photos.

## What we can't know from photos

Hidden dimensions, internal layouts, structure and MEP can't be seen. They
come from documents (drawings, a fit-out deck: "documented") or stay
"estimated" or "unknown". Volt's floor is documented, from its deck. Where it
sits in the building is estimated until we see the building's floor plan.

## Capture

Send the client or the team `scripts/twin/CAPTURE.md`. One Street View
panorama is not enough to reconstruct a building: COLMAP needs many
overlapping viewpoints. Without them, model the massing and mark the facade
"unknown".

## Tested so far

- COLMAP on a synthetic capture with known cameras, rendered from the Volt
  conference room (`conf18.py --capture`). `sfm.py --truth` reports the
  camera error in metres. See `scripts/twin/README.md`.
