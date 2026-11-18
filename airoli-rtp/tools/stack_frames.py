"""Register every plan onto one frame (rtp_local) using the structural columns.
The footprint fit (north_fit_c*.json) is good to ~1 m; columns repeat on every floor, so a rigid
Procrustes fit of each plan's columns onto the reference plan's columns stacks floors to centimetres.
usage: python -I stack_frames.py <scratch rtp dir> <review dir>
Writes review/frames.json: per plan, a 2x3 matrix CAD metres -> rtp_local metres, plus residuals."""
import json, sys, os, math
import numpy as np

W, REV = sys.argv[1], sys.argv[2]
PLANS = {"rtp4-shell": ("f4", 10), "rtp4-suite": ("f4", 22), "rtp6-a": ("f6", 3), "rtp6-b": ("f6", 50)}
REF = "rtp4-shell"
COL = ("Column", "Structural Column", "column-hatch")

def columns(f, cid):
    d = json.load(open(os.path.join(W, f, "flat.json"))); C = {c["cluster"]: c for c in json.load(open(os.path.join(W, f, "clusters.json")))}[cid]
    x0, y0 = C["x0"], C["y0"]; x1, y1 = x0 + C["w_m"] * 1000, y0 + C["h_m"] * 1000
    pts = []
    for r in d["rec"]:
        if r["L"] not in COL or r["t"] not in ("LwPolyline", "HATCH"): continue
        ring = r["rings"][0] if r.get("rings") else r.get("p")
        if not ring or isinstance(ring[0], (int, float)): continue
        xs = [q[0] for q in ring]; ys = [q[1] for q in ring]
        w, h = (max(xs) - min(xs)) / 1000, (max(ys) - min(ys)) / 1000
        cx, cy = sum(xs) / len(xs) / 1000, sum(ys) / len(ys) / 1000
        if 0.25 < w < 2.5 and 0.25 < h < 2.5 and x0 / 1000 <= cx <= x1 / 1000 and y0 / 1000 <= cy <= y1 / 1000:
            pts.append((round(cx, 2), round(cy, 2)))
    return np.array(sorted(set(pts)))

def apply(M, P): return P @ np.array(M)[:, :2].T + np.array(M)[:, 2]

fits = {k: json.load(open(os.path.join(REV, f"north_fit_c{c}.json")))["cad_m_to_rtp_local"]["matrix_2x3"] for k, (f, c) in PLANS.items()}
cols = {k: columns(*PLANS[k]) for k in PLANS}
ref = apply(fits[REF], cols[REF])
out = {"frame": "rtp_local: x east, y north, metres from the Maps pin 19.1692159 N 73.0017703 E; z up from ground",
       "reference": REF, "plans": {}}
for k in PLANS:
    P = apply(fits[k], cols[k]); M = np.array(fits[k], float)
    for it in range(6):
        d = np.linalg.norm(P[:, None, :] - ref[None, :, :], axis=2); j = d.argmin(1); ok = d[np.arange(len(P)), j] < (2.0 if it else 3.0)
        A, B = P[ok], ref[j[ok]]
        if len(A) < 6: break
        ca, cb = A.mean(0), B.mean(0); U, _, Vt = np.linalg.svd((A - ca).T @ (B - cb)); Rm = (U @ Vt).T
        if np.linalg.det(Rm) < 0: Vt[-1] *= -1; Rm = (U @ Vt).T
        t = cb - Rm @ ca
        M = np.hstack([Rm @ M[:, :2], (Rm @ M[:, 2] + t)[:, None]]); P = apply(M.tolist(), cols[k])
    d = np.linalg.norm(P[:, None, :] - ref[None, :, :], axis=2).min(1)
    out["plans"][k] = {"dwg": PLANS[k][0], "cluster": PLANS[k][1], "cad_m_to_rtp_local": M.tolist(),
                       "rotation_deg": round(math.degrees(math.atan2(M[1, 0], M[0, 0])), 3),
                       "columns": int(len(P)), "matched": int((d < 0.3).sum()), "median_residual_m": round(float(np.median(d)), 3)}
    print(k, out["plans"][k]["rotation_deg"], "cols", len(P), "matched<0.3m", int((d < 0.3).sum()), "median", round(float(np.median(d)), 3))
json.dump(out, open(os.path.join(REV, "frames.json"), "w"), indent=1)
