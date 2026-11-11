"""F1 Skymark: fetch the real surroundings the context model is built from.

    python noida-skymark/reconstruction/fetch_context.py OUT.json [RADIUS_M]

Overture Maps, read straight from its public S3 bucket with pyarrow (no key
needed), and the Copernicus GLO-30 surface model: the same sources as
scripts/world/fetch.py for Andheri. Keeps building footprints, road
segments and green areas within RADIUS_M (default 650) of the property's
pin and writes them in local metres: x east, y north, origin at the pin.
Each footprint also gets the surface model's reading over it (highest cell
less the local ground), which the builder uses for its height. Nothing is
placed by hand; every footprint carries its Overture id.
"""
import json, math, os, sys, time, urllib.request
import numpy as np
import pyarrow as pa, pyarrow.compute as pc, pyarrow.fs as pafs, pyarrow.parquet as pq
from concurrent.futures import ThreadPoolExecutor
from shapely import wkb

OUT = sys.argv[1]
R = float(sys.argv[2]) if len(sys.argv) > 2 else 650.0
LAT, LNG = 28.593565, 77.3188016          # the property's pin (noida-skymark/data.js)
KLAT, KLNG = 110574.0, 111320.0 * math.cos(math.radians(LAT))
BB = (LNG - R / KLNG, LAT - R / KLAT, LNG + R / KLNG, LAT + R / KLAT)
s3 = pafs.S3FileSystem(anonymous=True, region="us-west-2")
rels = sorted(x.base_name for x in s3.get_file_info(pafs.FileSelector("overturemaps-us-west-2/release/")) if x.type == pafs.FileType.Directory)
REL = "release/" + rels[-1]
print("Overture", REL, "bbox", [round(v, 5) for v in BB], flush=True)

def rgs(path):
    md = pq.ParquetFile(path, filesystem=s3).metadata
    ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
    hits = []
    for r in range(md.num_row_groups):
        g = md.row_group(r); st = lambda n: g.column(ix[n]).statistics
        try:
            if st("bbox.xmin").min < BB[2] and st("bbox.xmax").max > BB[0] and st("bbox.ymin").min < BB[3] and st("bbox.ymax").max > BB[1]: hits.append(r)
        except Exception: hits.append(r)
    return path, hits

def get(theme, typ, cols):
    t = time.time()
    files = [x.path for x in s3.get_file_info(pafs.FileSelector(f"overturemaps-us-west-2/{REL}/theme={theme}/type={typ}/")) if x.path.endswith(".parquet")]
    with ThreadPoolExecutor(32) as ex: res = [(p, h) for p, h in ex.map(rgs, files) if h]
    def read(ph):
        p, h = ph; tb = pq.ParquetFile(p, filesystem=s3).read_row_groups(h, columns=cols)
        b = tb.column("bbox").combine_chunks()
        m = pc.and_(pc.and_(pc.less(b.field("xmin"), BB[2]), pc.greater(b.field("xmax"), BB[0])), pc.and_(pc.less(b.field("ymin"), BB[3]), pc.greater(b.field("ymax"), BB[1])))
        return tb.filter(m)
    with ThreadPoolExecutor(16) as ex: parts = list(ex.map(read, res))
    tb = pa.concat_tables(parts)
    print(typ, len(files), "files,", tb.num_rows, "rows,", round(time.time() - t), "s", flush=True)
    return tb.to_pylist()

xy = lambda lng, lat: [round((lng - LNG) * KLNG, 2), round((lat - LAT) * KLAT, 2)]
ring = lambda cs: [xy(x, y) for x, y in cs]
name = lambda n: (n or {}).get("primary") if isinstance(n, dict) else None

out = {"source": "Overture Maps " + REL, "origin": {"lat": LAT, "lng": LNG}, "radius_m": R, "buildings": [], "roads": []}
for b in get("buildings", "building", ["id", "geometry", "height", "num_floors", "class", "subtype", "names", "bbox", "sources"]):
    g = wkb.loads(b["geometry"])
    for poly in ([g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))):
        if poly.geom_type != "Polygon": continue
        pts = ring(poly.exterior.coords)
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        if math.hypot(cx, cy) > R: continue
        src = sorted({s.get("dataset") for s in (b.get("sources") or []) if s.get("dataset")})
        out["buildings"].append({"id": b["id"], "ring": pts, "height": b.get("height"), "floors": b.get("num_floors"),
                                 "class": b.get("class") or b.get("subtype"), "name": name(b.get("names")), "datasets": src})
for s in get("transportation", "segment", ["id", "geometry", "subtype", "class", "names", "bbox"]):
    if s.get("subtype") != "road": continue
    g = wkb.loads(s["geometry"])
    for line in ([g] if g.geom_type == "LineString" else list(getattr(g, "geoms", []))):
        pts = ring(line.coords)
        if min(math.hypot(*p) for p in pts) > R: continue
        out["roads"].append({"id": s["id"], "line": pts, "class": s.get("class"), "name": name(s.get("names"))})
out["green"] = []
for t, typ in (("base", "land_use"), ("base", "land_cover")):
    for g_ in get(t, typ, ["id", "geometry", "class", "subtype", "bbox"]):
        k = (g_.get("subtype") or "") + "/" + (g_.get("class") or "")
        if not any(w in k for w in ("park", "grass", "forest", "garden", "recreation", "shrub", "wood", "meadow", "pitch", "cemetery", "crop")):
            continue
        g = wkb.loads(g_["geometry"])
        for poly in ([g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))):
            if poly.geom_type == "Polygon":
                out["green"].append({"id": g_["id"], "kind": k, "ring": ring(poly.exterior.coords)})

# The surface model: Copernicus GLO-30, the 1-degree tile N28 E077.
import rasterio
from rasterio.windows import from_bounds
from numpy.lib.stride_tricks import sliding_window_view
tif = os.path.join(os.path.dirname(os.path.abspath(OUT)), ".dsm_N28_E077.tif")
if not os.path.exists(tif):
    urllib.request.urlretrieve("https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N28_00_E077_00_DEM/Copernicus_DSM_COG_10_N28_00_E077_00_DEM.tif", tif)
with rasterio.open(tif) as r:
    pad = 0.004
    win = from_bounds(BB[0] - pad, BB[1] - pad, BB[2] + pad, BB[3] + pad, r.transform)
    dsm = r.read(1, window=win).astype(float); T = r.window_transform(win)
P_ = 6
ground = np.percentile(sliding_window_view(np.pad(dsm, P_, mode="edge"), (2 * P_ + 1, 2 * P_ + 1)), 8, axis=(-1, -2))
def at(arr, x, y):
    lng, lat = LNG + x / KLNG, LAT + y / KLAT
    c, rr = ~T * (lng, lat); rr = min(max(int(rr), 0), arr.shape[0] - 1); c = min(max(int(c), 0), arr.shape[1] - 1)
    return float(arr[rr, c])
for b in out["buildings"]:
    xs = [p[0] for p in b["ring"]]; ys = [p[1] for p in b["ring"]]
    top = max(at(dsm, x, y) for x in np.linspace(min(xs), max(xs), 3) for y in np.linspace(min(ys), max(ys), 3))
    b["dsm_excess_m"] = round(top - at(ground, sum(xs) / len(xs), sum(ys) / len(ys)), 1)
out["dsm_source"] = "Copernicus GLO-30 DSM, tile N28 E077 (copernicus-dem-30m on AWS)"
json.dump(out, open(OUT, "w"))
print(len(out["buildings"]), "buildings,", len(out["roads"]), "road segments,", len(out["green"]), "green areas ->", OUT)
