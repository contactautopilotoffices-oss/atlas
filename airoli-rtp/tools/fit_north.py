"""Fit the CAD floor outline to the real footprint (Overture) to get true north.
usage: python -I fit_north.py flat.json clusters.json CLUSTER context_overture.json outdir"""
import json, sys, os, math
import numpy as np
from shapely.geometry import LineString, Polygon, Point, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

flat, clj, cid, ctx, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
d = json.load(open(flat)); R = d["rec"]
C = {c["cluster"]: c for c in json.load(open(clj))}[cid]
x0, y0 = C["x0"], C["y0"]; x1, y1 = x0 + C["w_m"] * 1000, y0 + C["h_m"] * 1000
FAC = ("STRUCTURAL GLAZING", "A.C.P.CLADDING", "A.C.P. CLADDING", "RCC  FINS", "WINDOW", "walls", "RAILING", "STRUCTURAL ASSEMBLY")
lines = []
for r in R:
    if r["L"] not in FAC or r["t"] in ("TextEntity", "MText", "HATCH"): continue
    p = r.get("p")
    if not p or isinstance(p[0], (int, float)): continue
    P = [(q[0] / 1000, q[1] / 1000) for q in p if x0 <= q[0] <= x1 and y0 <= q[1] <= y1]
    if len(P) >= 2: lines.append(LineString(P))
blob = unary_union([l.buffer(0.6) for l in lines])
polys = list(blob.geoms) if isinstance(blob, MultiPolygon) else [blob]
big = max(polys, key=lambda g: Polygon(g.exterior).area)
cad = Polygon(big.exterior).buffer(-0.6)
cad = max(cad.geoms, key=lambda g: g.area) if isinstance(cad, MultiPolygon) else cad
print("CAD outline area m2", round(cad.area), "bounds", [round(v, 1) for v in cad.bounds])

ctxd = json.load(open(ctx))
B = ctxd.get("buildings") or ctxd.get("footprints") or []
def ring(b):
    g = b.get("poly") or b.get("footprint") or b.get("ring") or b.get("coords")
    if g and isinstance(g[0][0], (list, tuple)): g = g[0]
    return Polygon(g) if g and len(g) >= 3 else None
cands = []
for b in B:
    pg = ring(b)
    if pg is None or not pg.is_valid: continue
    if pg.centroid.distance(Point(0, 0)) < 250 and pg.area > 2000:
        cands.append((b, pg))
print("candidate footprints near pin:", [(b.get("id", "")[:12], round(pg.area), b.get("height") or b.get("h")) for b, pg in cands])
best = None
cc = cad.centroid
for b, pg in cands:
    for mirror in (False,):
        for a in np.arange(0, 360, 0.5):
            g = affinity.rotate(cad, a, origin=cc)
            g = affinity.translate(g, pg.centroid.x - g.centroid.x, pg.centroid.y - g.centroid.y)
            iou = g.intersection(pg).area / g.union(pg).area
            if best is None or iou > best[0]: best = (iou, a, b, pg, g)
iou, a, b, pg, g = best
# refine translation
for _ in range(2):
    bi = (iou, 0, 0)
    for dx in np.arange(-6, 6.1, 0.5):
        for dy in np.arange(-6, 6.1, 0.5):
            h = affinity.translate(g, dx, dy); v = h.intersection(pg).area / h.union(pg).area
            if v > bi[0]: bi = (v, dx, dy)
    iou = bi[0]; g = affinity.translate(g, bi[1], bi[2])
res = {"rotation_deg_ccw_cad_to_true": float(a), "plan_north_bearing_deg": float((-a) % 360),
       "iou": round(iou, 3), "footprint_id": b.get("id"), "footprint_area_m2": round(pg.area),
       "cad_area_m2": round(cad.area), "footprint_height": b.get("height") or b.get("h"),
       "note": "Rotate the CAD plan by rotation_deg (counter-clockwise) to put true north up."}
json.dump(res, open(os.path.join(out, "north_fit.json"), "w"), indent=1)
print(res)
fig, ax = plt.subplots(figsize=(10, 10))
for bb, p2 in cands: ax.fill(*p2.exterior.xy, color="#ccc")
ax.plot(*pg.exterior.xy, "k-", lw=1.5, label="Overture footprint")
ax.plot(*g.exterior.xy, "r-", lw=1, label=f"CAD outline rotated {a:.1f} deg, IoU {iou:.2f}")
ax.plot(0, 0, "b*", ms=12, label="Maps pin"); ax.set_aspect("equal"); ax.legend(); ax.set_title("x east, y north (m from pin)")
fig.savefig(os.path.join(out, "north_fit.png"), dpi=110, bbox_inches="tight")
