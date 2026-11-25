"""Where the greenery really is: a 10 m NDVI from open Sentinel-2 L2A (Copernicus, free and open licence).

  python scripts/world/fetch_ndvi.py DATA_DIR --region scripts/world/regions/noida-jindalx-west.json

Reads the cloud-optimised GeoTIFFs of the AWS Open Data copy of Sentinel-2 L2A through the Element 84 Earth Search
STAC API (no key, no sign-in; the same scenes are on Microsoft's Planetary Computer). It takes the dry, leaf-on scenes
of April to June (before the monsoon, so lawns and crops are brown and a green pixel is a tree), masks cloud, shadow and
snow with the scene classification, and writes the median of the red and near-infrared bands as NDVI:

  DATA_DIR/ndvi.npy       float32, 10 m, NaN where no scene saw the ground
  DATA_DIR/ndvi_t.json    {"crs": "EPSG:326xx", "t": [a, b, c, d, e, f], "scenes": [...], "source": "..."}

prep.py (region flag "greens": "evidence") turns it into canopy cover. Nothing from any map company's imagery is used.
"""
import json, sys, os, urllib.request
import numpy as np, rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds

D = sys.argv[1]
RG = json.load(open(sys.argv[sys.argv.index("--region") + 1])) if "--region" in sys.argv else {}
bx = RG.get("clip", [72.840, 19.0955, 72.894, 19.1265]); PAD = 0.004
box = [bx[0] - PAD, bx[1] - PAD, bx[2] + PAD, bx[3] + PAD]
DATES = RG.get("ndvi_dates", "2026-04-13T00:00:00Z/2026-06-20T23:59:59Z"); MAXN = RG.get("ndvi_scenes", 8)
q = {"collections": ["sentinel-2-l2a"], "bbox": box, "datetime": DATES, "query": {"eo:cloud_cover": {"lt": 5}}, "limit": 40,
     "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}]}
req = urllib.request.Request("https://earth-search.aws.element84.com/v1/search", json.dumps(q).encode(), {"Content-Type": "application/json"})
items = json.load(urllib.request.urlopen(req, timeout=120))["features"]
items = [i for i in items if i["properties"].get("s2:nodata_pixel_percentage", 0) < 20][:MAXN]
print(len(items), "scenes:", [(i["id"], round(i["properties"]["eo:cloud_cover"], 2)) for i in items])
T, crs = None, None
stack = []
for it in items:
    A = it["assets"]
    off = 0.0   # raw digital numbers: the +1000 BOA offset of baseline 04.00 and later is left in on purpose. Subtracting it sends the dark-red pixels
                # (shade, asphalt, dense canopy) to zero reflectance and NDVI to 1 over half the city; without it NDVI matches the street trees in the true-colour image
    try:
        with rasterio.open(A["red"]["href"]) as r_:
            crs = r_.crs; w = from_bounds(*transform_bounds("EPSG:4326", r_.crs, *box), r_.transform).round_offsets().round_lengths()
            red = r_.read(1, window=w).astype(np.float32); t_ = r_.window_transform(w)
        with rasterio.open(A["nir"]["href"]) as r_: nir = r_.read(1, window=w).astype(np.float32)
        with rasterio.open(A["scl"]["href"]) as r_: scl = r_.read(1, window=w, out_shape=red.shape, resampling=rasterio.enums.Resampling.nearest)
    except Exception as e:
        print("skip", it["id"], e); continue
    red = np.clip((red - off) / 10000.0, 0, 1.5); nir = np.clip((nir - off) / 10000.0, 0, 1.5)
    nd = (nir - red) / np.maximum(nir + red, 1e-3)
    ok = np.isin(scl, (4, 5, 6, 7, 11)) & (red + nir > 0.02)   # vegetation, bare, water, unclassified (not cloud, shadow, snow)
    nd[~ok] = np.nan
    if T is None: T = t_; shape = nd.shape
    if nd.shape == shape: stack.append(nd)
    print("  ", it["id"], "valid", round(float(ok.mean()), 3))
if not stack: raise SystemExit("no scene could be read")
ndvi = np.nanmedian(np.stack(stack), axis=0).astype(np.float32)
np.save(f"{D}/ndvi.npy", ndvi)
json.dump({"crs": str(crs), "t": [T.a, T.b, T.c, T.d, T.e, T.f], "scenes": [i["id"] for i in items],
           "source": "Copernicus Sentinel-2 L2A (ESA, free and open licence) via AWS Open Data / Element 84 Earth Search; median NDVI of the dry-season scenes"},
          open(f"{D}/ndvi_t.json", "w"))
print("wrote", f"{D}/ndvi.npy", ndvi.shape, "NDVI pctl", np.nanpercentile(ndvi, [5, 25, 50, 75, 95, 99]).round(2))
