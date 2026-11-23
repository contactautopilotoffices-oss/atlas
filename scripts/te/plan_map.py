"""Total Environment Whitefield: top-down plan of the open data around the site (a check image, not a deliverable).

  .w3d/bin/python scripts/te/plan_map.py DATA_DIR OUT.png [half_size_m]
"""
import sys, math, numpy as np, pyarrow.parquet as pq, shapely
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString
D, OUT = sys.argv[1], sys.argv[2]; R = float(sys.argv[3]) if len(sys.argv) > 3 else 1500
LAT0, LNG0 = 12.9912103, 77.7207093
KX, KY = math.cos(math.radians(LAT0)) * 111320, 110600
pr = lambda g: shapely.transform(g, lambda c: np.c_[(c[:, 0] - LNG0) * KX, (c[:, 1] - LAT0) * KY])
fig, ax = plt.subplots(figsize=(14, 14), dpi=110); ax.set_facecolor("#e9e6dc")
def polys(g): return list(g.geoms) if hasattr(g, "geoms") else [g]
for n, col in (("land_use", None), ("water", "#7fb3d5")):
    for x in pq.read_table(f"{D}/{n}.parquet").to_pylist():
        for p in polys(pr(shapely.from_wkb(x["geometry"]))):
            if isinstance(p, Polygon):
                c = col or {"park": "#b9d9a0", "grass": "#b9d9a0", "forest": "#8fbf7a", "recreation_ground": "#c6e2ae"}.get(x["subtype"] if n == "water" else x["class"], None)
                if c: ax.fill(*p.exterior.xy, color=c, lw=0)
            elif n == "water" and isinstance(p, LineString): ax.plot(*p.xy, color="#7fb3d5", lw=1)
for x in pq.read_table(f"{D}/segment.parquet").to_pylist():
    if x["subtype"] == "rail": c, w = "#7a3db8", 1.6
    elif x["subtype"] != "road": continue
    else: w = {"motorway": 3, "trunk": 3, "primary": 2.6, "secondary": 2, "tertiary": 1.5}.get(x["class"], .6); c = "#ffffff" if w < 1 else "#f4c86a"
    for l in polys(pr(shapely.from_wkb(x["geometry"]))): ax.plot(*l.xy, color=c, lw=w, zorder=2)
for x in pq.read_table(f"{D}/building.parquet").to_pylist():
    h = x["height"] or 0
    for p in polys(pr(shapely.from_wkb(x["geometry"]))):
        if isinstance(p, Polygon) and abs(p.centroid.x) < R and abs(p.centroid.y) < R:
            ax.fill(*p.exterior.xy, color=plt.cm.inferno(min(h, 90) / 110) if h else "#9a948a", lw=0, zorder=3)
ax.plot([0], [0], "c*", ms=18, zorder=5); ax.set_xlim(-R, R); ax.set_ylim(-R, R); ax.set_aspect("equal"); ax.grid(alpha=.3)
plt.savefig(OUT, bbox_inches="tight")
