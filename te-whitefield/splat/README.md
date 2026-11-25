# Gaussian splat of Total Environment, Hoodi

What is done, what needs a GPU, and what comes after. Written 25 Nov 2026.

## Done here (CPU)

1. `pick_frames.py` picked the sharpest frames from the walk-through video (148 s, 848 x 478, handheld phone):
   445 sampled at 3 fps, 334 kept.
2. `sfm.py` (pycolmap, SIFT, sequential matching) solved the cameras in 13 minutes on 4 cores:
   - model 1: 223 frames (frames 97 to 319, about 32 s to 106 s: the drive and courtyard to the building entrance),
     26,736 points, reprojection error 0.75 px;
   - model 0: 92 frames (frames 0 to 95: the approach and the entrance wall), 11,575 points, 0.93 px;
   - the lobby (frames 320 to 333) did not connect: different light indoors and a fast turn.
3. `export_dataset.py` wrote each model as a ready-to-train dataset (COLMAP layout, `images/` and `sparse/0/`, zipped).

## Needs a GPU (training)

No GPU and no way to fetch the trainers from this environment (GitHub is blocked), so training runs on the MacBook:

- **Brush** (a desktop app, Metal on Apple Silicon): open the unzipped folder `te_walk_entrance`, train, export a `.ply`.
- or **OpenSplat** (command line, Metal build): `opensplat te_walk_entrance -n 7000 -o te_walk_entrance.ply`.
- Train `te_walk_entrance` first (223 frames), then `te_walk_approach`.

(Neither was run from here; check each tool's own README for its current flags.)

## After training

1. Clean it in a splat editor (SuperSplat): crop to the courtyard and entrance, remove floaters, the sky, people and cars.
2. Align it to the site. The solve has an arbitrary scale and orientation: pick 3 or more known points (the gate, the
   entrance wall's corners, the tower's door; the Overture footprint gives metres) and fit a similarity transform.
3. Show it with a web splat viewer (Spark or GaussianSplats3D) in `te-drone/film/`, and capture camera paths frame by
   frame like the Mapbox clips.

## For the new capture

The same two scripts work on any walk or drone video: `pick_frames.py VIDEO FRAMES`, then `sfm.py FRAMES WORK`.
For the tower itself (what this footage does not show), orbit it three times at about 40, 80 and 120 m, with
at least 70% overlap, slow, in even light. Do not zoom. Keep the sky out of frame when you can.
