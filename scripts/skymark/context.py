"""Skymark F-1, Sector 6, Noida: the 1 km context as a GLB, for /skymark.

  python scripts/skymark/context.py DATA_DIR OUT_DIR

DATA_DIR holds the Overture Maps extracts (building, segment, water,
land_use .parquet) for the box 77.3092-77.3292 E, 28.5821-28.6001 N, and the
Copernicus GLO-30 tile N28 E077 (dsm.tif). Fetch them with
scripts/world/fetch.py after setting its box.

Writes OUT_DIR/context.glb (every footprint within RADIUS m extruded, roads,
footpaths, green and water, coloured per vertex) and OUT_DIR/site.json (the
origin, Skymark's real footprint, the radius). Metres around ORIGIN, x east,
y north; the GLB is Y-up as glTF expects.

This is the fallback context. Where the Google Maps key is set, the page
streams Google's photorealistic 3D tiles instead (the real buildings), and
uses this only for picking and for the cutaway.
"""
import sys, os, json, math, hashlib
import numpy as np, pyarrow.parquet as pq, shapely, trimesh, rasterio
from shapely.geometry import Point, Polygon, MultiPolygon, LineString
from shapely.ops import unary_union
from rasterio.windows import from_bounds

D, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SITE_LL = (77.318977, 28.591317)          # Skymark F-1, footprint centroid (Overture)
RADIUS = 1000.0
KX, KY = math.cos(math.radians(SITE_LL[1])) * 111320.0, 110950.0
P = lambda lng, lat: ((lng - SITE_LL[0]) * KX, (lat - SITE_LL[1]) * KY)
proj = lambda g: shapely.transform(g, lambda c: np.c_[(c[:, 0] - SITE_LL[0]) * KX, (c[:, 1] - SITE_LL[1]) * KY])
rows = lambda n: pq.read_table(f"{D}/{n}.parquet").to_pylist()
h01 = lambda s: int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xffffffff
CLIP = Point(0, 0).buffer(RADIUS, quad_segs=32)

# surface model, for relative heights
with rasterio.open(f"{D}/dsm.tif") as r:
    w = from_bounds(77.300, 28.575, 77.338, 28.608, r.transform); dsm = r.read(1, window=w); T = r.window_transform(w)
from numpy.lib.stride_tricks import sliding_window_view
g = np.pad(dsm, 6, mode="edge"); ground = np.percentile(sliding_window_view(g, (13, 13)), 8, axis=(-1, -2))
def cell(lng, lat):
    c, rr = ~T * (lng, lat); return min(max(int(rr), 0), dsm.shape[0] - 1), min(max(int(c), 0), dsm.shape[1] - 1)
def excess(geo):
    x0, y0, x1, y1 = geo.bounds
    top = max(dsm[cell(x, y)] for x in np.linspace(x0, x1, 3) for y in np.linspace(y0, y1, 3))
    c = geo.representative_point(); return float(top - ground[cell(c.x, c.y)])

PAL = [(0.84, 0.82, 0.77), (0.80, 0.78, 0.72), (0.74, 0.74, 0.72), (0.86, 0.80, 0.70), (0.70, 0.73, 0.75), (0.82, 0.76, 0.68)]
meshes = {"buildings": [], "roads": [], "foot": [], "green": [], "water": [], "ground": []}
skymark = None
for x in rows("building"):
    geo = shapely.from_wkb(x["geometry"])
    for k, pg in enumerate(geo.geoms if isinstance(geo, MultiPolygon) else [geo]):
        if not isinstance(pg, Polygon): continue
        q = proj(pg)
        if not CLIP.contains(q.representative_point()) or q.area < 12: continue
        if q.contains(Point(0, 0)) or q.distance(Point(0, 0)) < 2:
            if skymark is None or q.area > skymark.area: skymark = q
            continue                                   # the page builds Skymark itself
        a = q.area; j = h01(x["id"] + str(k)); ex = max(0.0, excess(pg))
        # Sector 6 and around: industrial and IT plots of G+2 to G+5, housing
        # blocks, and low sheds; footprint size sets the range, the surface
        # model lifts a building within it
        if a < 60: h = 3.2 + j * 3
        elif a < 250: h = 6 + j * 6 + ex * 0.3
        elif a < 1200: h = 9 + j * 9 + ex * 0.6
        else: h = 12 + j * 10 + ex * 0.8
        h = round(min(h, 45), 1)
        m = trimesh.creation.extrude_polygon(q.simplify(0.3), h)
        col = np.array(PAL[int(j * 997) % len(PAL)]) * (0.9 + 0.2 * h01(x["id"] + "c"))
        m.visual.vertex_colors = np.tile(np.r_[np.clip(col, 0, 1) * 255, 255].astype(np.uint8), (len(m.vertices), 1))
        meshes["buildings"].append(m)
print("buildings", len(meshes["buildings"]), "skymark footprint", round(skymark.area), "m2")

W = {"motorway": 30, "trunk": 24, "primary": 16, "secondary": 12, "tertiary": 9, "residential": 6.5, "unclassified": 6, "service": 4.5, "living_street": 5, "unknown": 5, "footway": 2.2, "path": 2}
road, foot, lines = [], [], []
for x in rows("segment"):
    if x["subtype"] != "road": continue
    gg = proj(shapely.from_wkb(x["geometry"])).intersection(CLIP)
    if gg.is_empty: continue
    w_ = W.get(x["class"], 5)
    (foot if w_ <= 2.2 else road).append(gg.buffer(w_ / 2, cap_style="flat", join_style="round", quad_segs=3))
    if w_ >= 9: lines.append(gg)
roadU = unary_union(road).simplify(0.4); footU = unary_union(foot).difference(roadU).simplify(0.4)
pave = unary_union([l.buffer(W.get("tertiary") / 2 + 2.2) for l in lines]).difference(roadU).intersection(CLIP) if lines else Polygon()
def flat(geom, z, rgb, key):
    for p in (geom.geoms if hasattr(geom, "geoms") else [geom]):
        if p.geom_type != "Polygon" or p.area < 1: continue
        try: v, f = trimesh.creation.triangulate_polygon(p)
        except Exception: continue
        v3 = np.c_[v, np.full(len(v), z)]; m = trimesh.Trimesh(v3, f, process=False)
        m.visual.vertex_colors = np.tile(np.r_[np.array(rgb) * 255, 255].astype(np.uint8), (len(v3), 1)); meshes[key].append(m)
flat(roadU, 0.05, (0.24, 0.245, 0.255), "roads"); flat(footU.union(pave), 0.08, (0.62, 0.60, 0.56), "foot")
GREEN = {"park", "grass", "garden", "playground", "recreation_ground", "pitch", "forest", "wood", "golf_course", "cemetery", "meadow"}
gr = [proj(shapely.from_wkb(x["geometry"])).intersection(CLIP) for x in rows("land_use") if x["class"] in GREEN]
wa = [proj(shapely.from_wkb(x["geometry"])).intersection(CLIP) for x in rows("water")]
if gr: flat(unary_union(gr).difference(roadU), 0.03, (0.36, 0.47, 0.27), "green")
if wa: flat(unary_union([w.buffer(3) if w.geom_type.endswith("String") else w for w in wa]), 0.04, (0.24, 0.33, 0.36), "water")
flat(CLIP, 0.0, (0.66, 0.63, 0.57), "ground")

scene = trimesh.Scene()
Z_UP_TO_Y_UP = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], float)   # (x, y, z) -> (x, z, -y)
for k, ms in meshes.items():
    if not ms: continue
    m = trimesh.util.concatenate(ms); m.apply_transform(Z_UP_TO_Y_UP); scene.add_geometry(m, node_name=k, geom_name=k)
scene.export(os.path.join(OUT, "context.glb"))
print("context.glb", round(os.path.getsize(os.path.join(OUT, "context.glb")) / 1e6, 1), "MB")
mrr = skymark.minimum_rotated_rectangle; e = list(mrr.exterior.coords)
sides = [(math.hypot(e[i + 1][0] - e[i][0], e[i + 1][1] - e[i][1]), math.atan2(e[i + 1][1] - e[i][1], e[i + 1][0] - e[i][0])) for i in range(4)]
long_ = max(sides, key=lambda s: s[0])
json.dump({"origin": SITE_LL, "radius": RADIUS, "k": [KX, KY],
           "footprint": [[round(a, 2), round(b, 2)] for a, b in skymark.exterior.coords][:-1],
           "rect": {"long": round(long_[0], 2), "short": round(min(s[0] for s in sides), 2), "angle": round(long_[1], 4)},
           "source": "Overture Maps 2026-10-21 footprints (OpenStreetMap, Microsoft, Google); heights estimated (Copernicus GLO-30)"},
          open(os.path.join(OUT, "site.json"), "w"), indent=1)
print("site.json")
