"""Package an SfM model as a ready-to-train dataset (COLMAP layout: images/ and sparse/0/), zipped.

  .w3d/bin/python te-whitefield/splat/export_dataset.py WORK_DIR MODEL_ID FRAMES_DIR OUT_DIR NAME

Copies only the frames the model registered, writes the model as COLMAP binary into
OUT_DIR/NAME/sparse/0, and zips the folder. Splat trainers (OpenSplat, Brush, nerfstudio, gsplat) read this layout.
"""
import sys, os, shutil, pycolmap
W, MID, FR, OUT, NAME = sys.argv[1:6]
m = pycolmap.Reconstruction(os.path.join(W, "sparse", MID))
d = os.path.join(OUT, NAME); shutil.rmtree(d, ignore_errors=True)
os.makedirs(os.path.join(d, "images")); os.makedirs(os.path.join(d, "sparse", "0"))
for im in m.images.values(): shutil.copy(os.path.join(FR, im.name), os.path.join(d, "images", im.name))
m.write(os.path.join(d, "sparse", "0"))   # binary only: the text copy of the 2D keypoints alone is 30 MB
shutil.make_archive(d, "zip", OUT, NAME)
print(NAME, m.num_reg_images(), "images,", m.num_points3D(), "points ->", d + ".zip", round(os.path.getsize(d + ".zip") / 1e6, 1), "MB")
