"""Structure from motion with pycolmap (CPU): camera poses and a sparse point cloud from a folder of frames.

  .w3d/bin/python te-whitefield/splat/sfm.py FRAMES_DIR WORK_DIR [--overlap 12] [--exhaustive]

SIFT features (one shared camera, OPENCV model for a phone lens), sequential matching with the given overlap (the
frames come from a walk, so neighbours match), then incremental mapping. Writes WORK_DIR/sparse/<n>/ (COLMAP binary)
and prints how many images registered in each model. The trainer for the splat (nerfstudio splatfacto, OpenSplat or
gsplat) reads this folder with the frames.
"""
import sys, os, time, pycolmap
FR, W = sys.argv[1], sys.argv[2]; os.makedirs(W, exist_ok=True)
ov = int(sys.argv[sys.argv.index("--overlap") + 1]) if "--overlap" in sys.argv else 12
db = os.path.join(W, "db.db"); t = time.time()
if os.path.exists(db): os.remove(db)
opts = pycolmap.ImageReaderOptions(); opts.camera_model = "OPENCV"
pycolmap.extract_features(db, FR, camera_mode=pycolmap.CameraMode.SINGLE, reader_options=opts)
print("features", round(time.time() - t), "s", flush=True)
if "--exhaustive" in sys.argv: pycolmap.match_exhaustive(db)
else: pycolmap.match_sequential(db, pairing_options=pycolmap.SequentialPairingOptions(overlap=ov, loop_detection=False))
print("matches", round(time.time() - t), "s", flush=True)
sp = os.path.join(W, "sparse"); os.makedirs(sp, exist_ok=True)
maps = pycolmap.incremental_mapping(db, FR, sp)
for k, m in maps.items(): print("model", k, "registered", m.num_reg_images(), "of", len(os.listdir(FR)), "images;", m.num_points3D(), "points; reprojection error", round(m.compute_mean_reprojection_error(), 2))
print("done", round(time.time() - t), "s")
