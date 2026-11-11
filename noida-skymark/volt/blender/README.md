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

## What is in here

- `volt_render.py`: builds the scene and renders it.
- `volt-floor1.layout.json`: every wall, glass line, door, column, desk, table,
  seat, planter and ceiling light, read from the DWG (see `../cad`).
- `cameras.json`: a still camera and a panorama spot per room, made by
  `make_cameras.py` from the same layout.
- `models/`: the mesh chair and the lounge chair.

## What comes from where

- **From the CAD:** all positions and counts.
- **Assumed:** heights (desk 0.75 m, ceiling 2.85 m), because a 2D plan has none.
- **From the design deck's mood board:** finishes and colours.
- **From the deck, not the CAD:** the black linear lights over the desk rows.
