# Volt floor: render package for Blender

This folder builds Volt's whole first floor in Blender from the CAD layout and
renders every room on your own computer. Blender 4.2 or newer.

## On a Mac

1. Put this folder anywhere, for example inside "2d to 3d".
2. Double-click **1 Quick test.command**. It renders one room at low quality in
   about a minute and opens the picture. If macOS refuses to open it, right-click
   it, choose Open, then Open again.
3. If the test picture looks right, double-click **2 Render everything.command**.
   It renders a still and a 360 degree panorama of each of the 19 rooms into
   `renders/`. It keeps the Mac awake while it runs. You can stop it with
   Ctrl+C and start it again later; finished pictures are kept.
4. Zip the `renders` folder and send it back.

## From Terminal, any system

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P volt_render.py -- --out renders
```

Useful options after the `--`:

- `--quality preview`, `normal` or `high`
- `--what stills` or `--what panos`
- `--rooms open-workstations,sales-office` to render only some rooms
- `--exposure 0.8` for a brighter picture, `0.2` for a darker one
- `--sun-az 100 --sun-el 26` to move the sun (compass bearing and height)
- `--no-render` to build and save `renders/volt_floor.blend` only, then open it in Blender
- `--sky 0.35` and `--sun 22` for the strength of the daylight
- `--no-post` to skip the finishing step and keep the plain render
- `--res-scale 0.5` for a quick small picture
- `--cameras my_cameras.json` to try other views (same shape as `cameras.json`)

## What is in here

- `volt_render.py`: builds the scene and renders it.
- `volt-floor1.layout.json`: every wall, glass line, door, column, desk, table,
  seat, planter and ceiling light, read from the DWG (see `../cad`).
- `cameras.json`: a still camera and a panorama spot per room, made by
  `make_cameras.py` from the same layout. Ten rooms have a camera set by hand
  to match the design deck's view (the `OVERRIDE` table in `make_cameras.py`).
- `models/`: the mesh chair and the lounge chair.

## What makes the picture look like a photograph

- Every hard edge is bevelled (walls and columns 8 to 10 mm, furniture 3 to
  8 mm), with weighted normals so flat faces stay flat.
- No surface has one flat roughness: it varies in soft patches and a fine
  grain, and the painted walls are a little scuffed below knee height.
- Light is Blender's physical sky and a sun through the facade windows (with a
  light portal in each), plus the ceiling lights at 4000 K. The camera is white
  balanced at about 4150 K.
- The camera has depth of field at f/8 with seven blades. At 20 mm that is
  barely visible, which is right for a room.
- After the denoised render a small finishing step (numpy, no compositor):
  a faint glow round the lamps and windows, a trace of chromatic aberration,
  a slight softening, a light vignette and fine grain.
- Plants are thin single-sheet leaves on slim stalks, with a paler midrib and
  veins, and light passes through them.

## What comes from where

- **From the CAD:** all positions and counts of walls, glass, doors, columns,
  furniture, planters and ceiling lights.
- **Assumed:** heights (desk 0.75 m, ceiling 2.85 m), because a 2D plan has none.
  That includes the windows (sill 0.9 m, head 2.25 m) and the glazed
  partitions (0.1 m to 2.4 m).
- **From the design deck's mood board:** finishes and colours, the plant species,
  the shape of the cafe chairs and tub chairs.
- **From the deck, not the CAD:** the black linear lights over the desk rows.
- **Added by us, not in the CAD:** the small things on desks (mugs, notebooks,
  bottles, a few bags), the lamp colour, the ground outside and the atrium's
  walls above this floor.

## How the drawing is read where it is ambiguous

- The CAD draws a window or a glazed partition as glass lines along an unbroken
  wall line. Built exactly as drawn, every window would be bricked up. So where
  a glass line runs along a thin wall strip, the script opens the strip over the
  length of the glass. Nothing is moved.
- The CAD draws both faces of a glazed partition, and one facade window twice.
  One pane is built for each.
- A table that bar stools stand at is built as a high counter (1.05 m).
- A big low "table" outline with a sofa standing inside it (Collab area 01) is
  built as a rug.
