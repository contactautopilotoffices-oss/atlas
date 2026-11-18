"""Shared CAD reading for the RTP exterior (run under the venv with python -I; the DWG JSON is untrusted data)."""
import json, math
import numpy as np

FAC = ("STRUCTURAL GLAZING", "A.C.P.CLADDING", "A.C.P. CLADDING", "RCC  FINS", "STRUCTURAL ASSEMBLY", "RAILING",
       "WINDOW", "walls", "Column", "Structural Column", "STAIR", "ELE", "M.S.STEEL")

def load(flat, clusters, cid, frames, plan="rtp4-shell"):
    d = json.load(open(flat)); R = d["rec"]
    C = {c["cluster"]: c for c in json.load(open(clusters))}[cid]
    x0, y0 = C["x0"], C["y0"]; x1, y1 = x0 + C["w_m"] * 1000, y0 + C["h_m"] * 1000
    M = np.array(json.load(open(frames))["plans"][plan]["cad_m_to_rtp_local"], float)
    return R, (x0, y0, x1, y1), M

def to_local(M, P):
    P = np.asarray(P, float) / 1000.0
    return P @ M[:, :2].T + M[:, 2]

def rec_points(r, step_mm=300.0):
    """Polyline points (mm) of a record; arcs and circles are resampled from their exact parameters."""
    if r.get("arc"):
        cx, cy, rad, a0, a1 = r["arc"]
        if a1 < a0: a1 += 2 * math.pi
        n = max(2, int(math.ceil(rad * (a1 - a0) / step_mm)) + 1)
        a = np.linspace(a0, a1, n); return np.c_[cx + rad * np.cos(a), cy + rad * np.sin(a)]
    if r.get("c") and r["t"] == "Circle":
        cx, cy, rad = r["c"]; n = max(12, int(2 * math.pi * rad / step_mm))
        a = np.linspace(0, 2 * math.pi, n + 1); return np.c_[cx + rad * np.cos(a), cy + rad * np.sin(a)]
    p = r.get("p")
    if not p or isinstance(p[0], (int, float)): return None
    P = np.array([q[:2] for q in p], float)
    if r.get("closed") and len(P) > 2 and np.linalg.norm(P[0] - P[-1]) > 1e-6: P = np.vstack([P, P[:1]])
    return P

def layer_lines(R, box, M, layers, pad=1000.0):
    x0, y0, x1, y1 = box; out = []
    for r in R:
        if r["L"] not in layers or r["t"] in ("TextEntity", "MText", "HATCH", "INS", "AttributeEntity"): continue
        P = rec_points(r)
        if P is None or len(P) < 2: continue
        c = P.mean(0)
        if not (x0 - pad <= c[0] <= x1 + pad and y0 - pad <= c[1] <= y1 + pad): continue
        out.append({"L": r["L"], "t": r["t"], "closed": bool(r.get("closed")) or r["t"] == "Circle", "pts": to_local(M, P),
                    "circle": ([*to_local(M, [r["c"][:2]])[0], r["c"][2] / 1000.0] if r["t"] == "Circle" else None)})
    return out
