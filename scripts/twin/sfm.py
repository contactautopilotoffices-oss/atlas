"""Stage 3 of the photo to digital twin pipeline: camera positions and a sparse
point cloud from photos, with COLMAP (pycolmap, runs on CPU).

  pip install pycolmap==4.2.1 numpy
  python3 scripts/twin/sfm.py PHOTOS_DIR WORK_DIR [--sequential [N]] [--focal-px F] [--per-image]
                              [--truth truth.json] [--scale-from truth.json]

Writes WORK_DIR/sparse/0 (the COLMAP model), WORK_DIR/cameras.json (one pose
per registered photo), WORK_DIR/points.ply and WORK_DIR/sfm.json (what was
registered, reprojection error, and, with --truth, how far the recovered
cameras are from the true ones after a best fit similarity transform).

A photo reconstruction has no scale of its own. Every distance it gives is
"reconstructed" only once it is scaled by something measured (a known
dimension, a survey point, GPS): until then it is relative.
"""
import json, os, sys, shutil, time
import numpy as np
import pycolmap

def umeyama(src, dst):
    """Similarity (s, R, t) that best maps src points onto dst (least squares)."""
    mu_s, mu_d = src.mean(0), dst.mean(0); a, b = src - mu_s, dst - mu_d
    U, S, Vt = np.linalg.svd(b.T @ a / len(src)); D = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0: D[2, 2] = -1
    R = U @ D @ Vt; s = np.trace(np.diag(S) @ D) / a.var(0).sum(); t = mu_d - s * R @ mu_s
    return s, R, t

def main():
    photos, work = sys.argv[1], sys.argv[2]
    os.makedirs(work, exist_ok=True); db = os.path.join(work, "database.db")
    if os.path.exists(db): os.remove(db)
    t0 = time.time()
    names = sorted(f for f in os.listdir(photos) if f.lower().endswith((".jpg", ".jpeg", ".png")))
    # One lens for the whole set when the photos are the same size (one phone,
    # one zoom, as CAPTURE.md asks). Letting every photo have its own focal
    # length let repeated chairs and bays pull cameras to the wrong place.
    from PIL import Image
    sizes = {Image.open(os.path.join(photos, n)).size for n in names}
    single = len(sizes) == 1 and "--per-image" not in sys.argv
    ro = pycolmap.ImageReaderOptions(); ro.camera_model = "SIMPLE_RADIAL"
    if "--focal-px" in sys.argv:   # a known focal length in pixels (from EXIF or the lens)
        w, h = next(iter(sizes)); f = float(sys.argv[sys.argv.index("--focal-px") + 1]); ro.camera_params = f"{f},{w / 2},{h / 2},0"
    pycolmap.extract_features(db, photos, camera_mode=pycolmap.CameraMode.SINGLE if single else pycolmap.CameraMode.AUTO, reader_options=ro)
    if "--sequential" in sys.argv:   # a walk: match each photo with its neighbours only, plus loop closure off
        po = pycolmap.SequentialPairingOptions(); po.overlap = int(sys.argv[sys.argv.index("--sequential") + 1]) if len(sys.argv) > sys.argv.index("--sequential") + 1 and sys.argv[sys.argv.index("--sequential") + 1].isdigit() else 8
        pycolmap.match_sequential(db, pairing_options=po)
    else:
        pycolmap.match_exhaustive(db)
    sp = os.path.join(work, "sparse"); shutil.rmtree(sp, ignore_errors=True); os.makedirs(sp)
    recs = pycolmap.incremental_mapping(db, photos, sp)
    if not recs: raise SystemExit("COLMAP could not register the photos: too little overlap, or too few distinct features")
    rec = max(recs.values(), key=lambda r: r.num_reg_images())
    n_in = len([f for f in os.listdir(photos) if f.lower().endswith((".jpg", ".jpeg", ".png"))])
    cams = {}
    for im in rec.images.values():
        if not im.has_pose: continue
        cw = im.cam_from_world() if callable(im.cam_from_world) else im.cam_from_world
        R = np.array(cw.rotation.matrix()); t = np.array(cw.translation)
        cams[im.name] = {"centre": (-R.T @ t).tolist(), "world_from_cam_rotation": R.T.tolist(), "camera_id": im.camera_id}
    pts = np.array([p.xyz for p in rec.points3D.values()]); col = np.array([p.color for p in rec.points3D.values()])
    with open(os.path.join(work, "points.ply"), "w") as f:
        f.write(f"ply\nformat ascii 1.0\nelement vertex {len(pts)}\nproperty float x\nproperty float y\nproperty float z\n"
                "property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n")
        for p, c in zip(pts, col): f.write(f"{p[0]:.4f} {p[1]:.4f} {p[2]:.4f} {int(c[0])} {int(c[1])} {int(c[2])}\n")
    report = {"photos": n_in, "registered": len(cams), "single_camera": single, "matching": "sequential" if "--sequential" in sys.argv else "exhaustive", "points": len(pts),
              "mean_reprojection_error_px": round(float(rec.compute_mean_reprojection_error()), 3),
              "seconds": round(time.time() - t0, 1), "scale": "relative (not yet tied to a measurement)"}
    truth_f = sys.argv[sys.argv.index("--truth") + 1] if "--truth" in sys.argv else None
    if truth_f:
        truth = {p["image"]: np.array(p["centre"]) for p in json.load(open(truth_f))["poses"]}
        common = [k for k in cams if k in truth]
        if len(common) >= 3:
            src = np.array([cams[k]["centre"] for k in common]); dst = np.array([truth[k] for k in common])
            s, R, t = umeyama(src, dst); err = np.linalg.norm((s * (R @ src.T)).T + t - dst, axis=1)
            report["vs_truth"] = {"cameras_compared": len(common), "scale_fitted": round(float(s), 4),
                                  "camera_position_error_m": {"mean": round(float(err.mean()), 4), "max": round(float(err.max()), 4)}}
            if "--scale-from" in sys.argv:   # put the model in metres, in the truth frame
                for k in cams: cams[k]["centre_m"] = ((s * R @ np.array(cams[k]["centre"])) + t).tolist()
                report["scale"] = "metres, fitted to the known camera positions"
    json.dump(cams, open(os.path.join(work, "cameras.json"), "w"), indent=1)
    json.dump(report, open(os.path.join(work, "sfm.json"), "w"), indent=1)
    print(json.dumps(report, indent=1))

if __name__ == "__main__":
    main()
