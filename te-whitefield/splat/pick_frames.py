"""Pick sharp, well-spaced frames from a walk-through video for structure-from-motion.

  .w3d/bin/python te-whitefield/splat/pick_frames.py VIDEO OUT_DIR [--fps 3] [--keep 0.7]

Samples at --fps, scores each frame by the variance of its Laplacian (a blur measure), and within every window of
about one second keeps the sharpest, then drops the blurriest fraction overall. Handheld video is the usual source of
failed reconstructions: a blurred frame matches nothing. Frames are written at their native size; nothing is resized.
"""
import sys, os, cv2, numpy as np
V, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
opt = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
FPS, KEEP = opt("--fps", 3.0), opt("--keep", 0.7)
cap = cv2.VideoCapture(V); src = cap.get(cv2.CAP_PROP_FPS); step = max(1, int(round(src / FPS)))
cand, i = [], 0
while True:
    ok, fr = cap.read()
    if not ok: break
    if i % step == 0:
        g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY); cand.append((i, float(cv2.Laplacian(g, cv2.CV_64F).var()), fr))
    i += 1
sc = np.array([c[1] for c in cand]); thr = np.quantile(sc, 1 - KEEP)
kept = [c for c in cand if c[1] >= thr]
for n, (idx, s, fr) in enumerate(kept): cv2.imwrite(os.path.join(OUT, f"f{n:05d}.jpg"), fr, [cv2.IMWRITE_JPEG_QUALITY, 95])
print(f"{len(cand)} sampled at ~{src/step:.1f} fps, kept {len(kept)} (sharpness >= {thr:.0f}; median {np.median(sc):.0f})")
