"""Total Environment Whitefield: turn the open data into a scene the drone shot is built from.

  .w3d/bin/python scripts/te/site.py DATA_DIR OUT_DIR

DATA_DIR is what scripts/world/fetch.py wrote for the box 77.700-77.742 E,
12.970-13.008 N (Overture Maps 2026-10-21 and Copernicus GLO-30).
Writes to OUT_DIR:
  scene.json   buildings (metre footprints, heights), water, metro centrelines, tree points
  ground.jpg   the ground texture, 1 px = GPX m, painted from land use and roads (no imagery)
  terrain.npy  the ground height (m above the site) on the same grid as ground.jpg

The origin is the Google place pin of Pursuit of a Radical Rhapsody,
12.9912103 N, 77.7207093 E, given by the founder. x is east, y is north.

Heights. Overture carries a height for about 90 buildings here (the Rhapsody
pods at 102 m, the Workcations tower at 74 m). Everything else is read off the
surface model (the highest 30 m cell over the footprint less the local ground)
and capped by footprint size, since the 30 m model blurs small buildings.
"""
import sys, os, json, math, hashlib
import numpy as np, pyarrow.parquet as pq, shapely, shapely.ops
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

D, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
LAT0, LNG0 = 12.9912103, 77.7207093
KX, KY = math.cos(math.radians(LAT0)) * 111320.0, 110600.0
BB = (77.700, 12.970, 77.742, 13.008)
X0, Y0 = (BB[0] - LNG0) * KX, (BB[1] - LAT0) * KY
X1, Y1 = (BB[2] - LNG0) * KX, (BB[3] - LAT0) * KY
GPX = 1.0                                   # ground texture metres per pixel
W, H = int((X1 - X0) / GPX), int((Y1 - Y0) / GPX)
HERO_ID = "13c2744e-9fef-4c24-b2dc-ca9eccff5053"   # the Workcations tower footprint in Overture

def proj(g): return shapely.transform(g, lambda c: np.c_[(c[:, 0] - LNG0) * KX, (c[:, 1] - LAT0) * KY])
def rows(n): return pq.read_table(f"{D}/{n}.parquet").to_pylist()
def parts(g): return list(g.geoms) if hasattr(g, "geoms") else [g]
def h01(s): return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xffffffff

# ---- the surface model and the ground under it -------------------------------
dsm = np.load(f"{D}/dsm.npy").astype(np.float32); T = json.load(open(f"{D}/dsm_t.json"))
ground = ndimage.percentile_filter(dsm, 8, size=13)
ground = ndimage.gaussian_filter(ground, 2.0)
def cell(x, y):
    lng, lat = x / KX + LNG0, y / KY + LAT0
    return int((lat - T[5]) / T[4]), int((lng - T[2]) / T[0])
def at(arr, x, y):
    r, c = cell(x, y); return float(arr[min(max(r, 0), arr.shape[0] - 1), min(max(c, 0), arr.shape[1] - 1)])
G0 = at(ground, 0, 0)

# terrain grid at 20 m for Blender
TS = 20.0; tx = np.arange(X0, X1 + TS, TS); ty = np.arange(Y0, Y1 + TS, TS)
terr = np.array([[at(ground, x, y) - G0 for x in tx] for y in ty], np.float32)
terr = ndimage.gaussian_filter(terr, 1.5)
np.save(f"{OUT}/terrain.npy", terr)

# ---- buildings -----------------------------------------------------------------
B = []
for x in rows("building"):
    for p in parts(proj(shapely.from_wkb(x["geometry"]))):
        if not isinstance(p, Polygon) or p.area < 12: continue
        p = p.simplify(0.4)
        if not p.is_valid or p.is_empty: continue
        a = p.area; c = p.centroid
        if x["height"]: h = float(x["height"])
        else:
            cells = [at(dsm, *pt) for pt in list(p.exterior.coords)[::2] + [(c.x, c.y)]]
            h = max(cells) - at(ground, c.x, c.y)
            cap = 7 if a < 60 else 11 if a < 150 else 16 if a < 400 else 26 if a < 1500 else 40
            h = min(max(h, 3.4 + 3.2 * int(h01(x["id"]) * 2)), cap)
        B.append({"id": x["id"], "hero": x["id"] == HERO_ID, "h": round(h, 1),
                  "z": round(at(ground, c.x, c.y) - G0, 2), "cls": x["class"] or "",
                  "ring": [[round(u, 2), round(v, 2)] for u, v in p.exterior.coords[:-1]]})
print(len(B), "buildings;", sum(b["h"] > 30 for b in B), "over 30 m")

# ---- water, metro ------------------------------------------------------------------
WATER = []
for x in rows("water"):
    if x["subtype"] in ("physical",): continue
    for p in parts(proj(shapely.from_wkb(x["geometry"]))):
        if isinstance(p, Polygon) and p.area > 30:
            WATER.append({"cls": x["class"], "ring": [[round(u, 1), round(v, 1)] for u, v in p.exterior.coords[:-1]],
                          "holes": [[[round(u, 1), round(v, 1)] for u, v in r.coords[:-1]] for r in p.interiors]})
SEG = rows("segment")
METRO = []
for x in SEG:
    if x["subtype"] == "rail" and x["class"] == "subway":
        for l in parts(proj(shapely.from_wkb(x["geometry"]))):
            METRO.append([[round(u, 1), round(v, 1)] for u, v in l.coords])
print(len(WATER), "water bodies;", len(METRO), "metro segments")

# ---- the ground texture -----------------------------------------------------------
def px(pts): return [((u - X0) / GPX, (Y1 - v) / GPX) for u, v in pts]
rng = np.random.default_rng(7)
def noise(scale, oct=4):
    acc = np.zeros((H, W), np.float32); amp = 1.0
    for o in range(oct):
        s = max(int(scale / 2 ** o), 2)
        n = rng.random((H // s + 2, W // s + 2)).astype(np.float32)
        acc += amp * np.array(Image.fromarray(n).resize((W + s, H + s), Image.BICUBIC))[:H, :W]; amp *= 0.5
    return (acc - acc.min()) / (np.ptp(acc) + 1e-6)
n1, n2 = noise(160), noise(24, 3)
# base: dry Deccan ground, built-up dust and patchy scrub
base = np.stack([0.60 + 0.08 * n1, 0.56 + 0.07 * n1, 0.47 + 0.05 * n1], -1) * (0.88 + 0.2 * n2[..., None])
img = Image.fromarray(np.clip(base * 255, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(img)
LU = {"park": (92, 128, 70), "grass": (110, 140, 78), "garden": (86, 122, 64), "orchard": (78, 112, 58),
      "recreation_ground": (112, 140, 80), "pitch": (104, 138, 74), "farmland": (128, 132, 84), "cemetery": (104, 118, 80),
      "species_management_area": (70, 104, 56), "residential": (168, 156, 136), "commercial": (172, 166, 152),
      "industrial": (160, 154, 142), "construction": (176, 150, 116), "school": (160, 150, 128), "retail": (170, 164, 150)}
LC = {"forest": (74, 100, 58), "wetland": (96, 112, 82)}   # Overture's grass and crop cover spills over built-up blocks here, so only these
for x in rows("land_cover"):
    c = LC.get(x["subtype"])
    if c:
        for p in parts(proj(shapely.from_wkb(x["geometry"]))):
            if isinstance(p, Polygon): dr.polygon(px(p.exterior.coords), fill=c)
for order in (("residential", "commercial", "industrial", "construction", "school", "retail"),
              ("park", "grass", "garden", "orchard", "recreation_ground", "pitch", "farmland", "cemetery", "species_management_area")):
    for x in rows("land_use"):
        if x["class"] in order:
            for p in parts(proj(shapely.from_wkb(x["geometry"]))):
                if isinstance(p, Polygon) and p.area > 40: dr.polygon(px(p.exterior.coords), fill=LU[x["class"]])
# re-texture so flat fills read as ground, not paint
a = np.asarray(img).astype(np.float32) / 255 * (0.84 + 0.3 * n2[..., None])
img = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(img)
RW = {"trunk": 16, "primary": 14, "secondary": 11, "tertiary": 8, "residential": 5.5, "unclassified": 5.5, "living_street": 4.5,
      "service": 3.5, "unknown": 4, "track": 3, "footway": 1.6, "path": 1.4, "steps": 1.4, "cycleway": 2}
for want in ("minor", "major"):
    for x in SEG:
        if x["subtype"] != "road": continue
        w = RW.get(x["class"], 4)
        if (w >= 8) != (want == "major"): continue
        col = (96, 94, 92) if w >= 8 else (120, 116, 110) if w >= 4 else (150, 140, 124)
        for l in parts(proj(shapely.from_wkb(x["geometry"]))):
            if isinstance(l, LineString):
                pts = px(l.coords)
                dr.line(pts, fill=(176, 168, 152), width=max(int((w + 3) / GPX), 1), joint="curve")   # verge / footpath
                dr.line(pts, fill=col, width=max(int(w / GPX), 1), joint="curve")
                if w >= 11: dr.line(pts, fill=(200, 196, 184), width=1)                              # centre marking
for x in SEG:
    if x["subtype"] == "rail" and x["class"] != "subway":
        for l in parts(proj(shapely.from_wkb(x["geometry"]))):
            if isinstance(l, LineString): dr.line(px(l.coords), fill=(112, 100, 90), width=int(7 / GPX))
# lake margins: a darker damp band and reeds
for w in WATER:
    if w["cls"] in ("lake", "pond", "reservoir", "water"):
        dr.polygon(px(w["ring"]), fill=(96, 104, 74), outline=(88, 96, 66), width=int(10 / GPX))
# building contact shadows (ambient occlusion on the ground)
occ = Image.new("L", (W, H), 0); od = ImageDraw.Draw(occ)
for b in B: od.polygon(px(b["ring"]), fill=255)
occ = np.asarray(occ.filter(ImageFilter.GaussianBlur(3 / GPX))).astype(np.float32) / 255
a = np.asarray(img).astype(np.float32) * (1 - 0.35 * occ[..., None])
img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
img.save(f"{OUT}/ground.jpg", quality=90)

# ---- trees: scatter in green land, along major roads and in open plots -------------
green = np.asarray(img).astype(np.float32)
gmask = (green[..., 1] > green[..., 0] * 1.06) & (green[..., 1] > green[..., 2] * 1.15)
bmask = np.asarray(Image.new("L", (W, H), 0)); bm = Image.new("L", (W, H), 0); bd = ImageDraw.Draw(bm)
for b in B: bd.polygon(px(b["ring"]), fill=255)
for x in SEG:
    if x["subtype"] == "road" and RW.get(x["class"], 4) >= 4:
        for l in parts(proj(shapely.from_wkb(x["geometry"]))):
            if isinstance(l, LineString): bd.line(px(l.coords), fill=255, width=int(RW.get(x["class"], 4) / GPX))
for w in WATER: bd.polygon(px(w["ring"]), fill=255)
free = np.asarray(bm.filter(ImageFilter.MaxFilter(5))) == 0
TREES = []
ys, xs = np.nonzero(gmask[::3, ::3] & free[::3, ::3]); sel = rng.random(len(xs)) < 0.34
for u, v in zip(xs[sel] * 3, ys[sel] * 3): TREES.append((u, v))
ys, xs = np.nonzero(free[::6, ::6]); sel = rng.random(len(xs)) < 0.075 * (0.4 + n1[ys * 6, xs * 6])
for u, v in zip(xs[sel] * 6, ys[sel] * 6): TREES.append((u, v))
for x in SEG:      # avenue trees
    if x["subtype"] == "road" and RW.get(x["class"], 4) >= 8:
        w = RW[x["class"]] / 2 + 3
        for l in parts(proj(shapely.from_wkb(x["geometry"]))):
            if not isinstance(l, LineString) or l.length < 20: continue
            for side in (-1, 1):
                o = l.offset_curve(side * w)
                for d in np.arange(4, o.length, 11 + 6 * rng.random()):
                    pt = o.interpolate(d); TREES.append(((pt.x - X0) / GPX, (Y1 - pt.y) / GPX))
TT = []
for u, v in TREES:
    u, v = int(u), int(v)
    if 0 <= u < W and 0 <= v < H and free[v, u]:
        x, y = X0 + u * GPX + rng.random() - .5, Y1 - v * GPX + rng.random() - .5
        TT.append([round(x, 1), round(y, 1), round(float(5 + 9 * rng.random() ** 1.5), 1), int(rng.integers(0, 4))])
print(len(TT), "trees")

# ---- the near field: 800 m round the tower at 4 px a metre, for the close push-in ---------
# (the camera ends about 300 m from the tower, where 1 px a metre turns to mush)
HX, HY = -23.5, -42.1; NR = 400.0; NG = 0.25
NX0, NY0, NX1, NY1 = HX - NR, HY - NR, HX + NR, HY + NR; NW_ = int(2 * NR / NG)
def npx(pts): return [((u - NX0) / NG, (NY1 - v) / NG) for u, v in pts]
# painted afresh at this scale (an upsampled coarse map carries its blurred shadows along)
def nnoise(cell):
    g = rng.random((NW_ // cell + 2, NW_ // cell + 2)).astype(np.float32)
    return np.asarray(Image.fromarray(g).resize((NW_ + cell, NW_ + cell), Image.BICUBIC))[:NW_, :NW_]
m1, m2, grain = nnoise(240), nnoise(24), rng.random((NW_, NW_)).astype(np.float32)
base = np.stack([0.60 + 0.07 * m1, 0.56 + 0.06 * m1, 0.47 + 0.05 * m1], -1) * (0.86 + 0.14 * m2[..., None] + 0.06 * grain[..., None])
near = Image.fromarray(np.clip(base * 255, 0, 255).astype(np.uint8)); nd = ImageDraw.Draw(near)
for x in rows("land_cover"):
    c = LC.get(x["subtype"])
    if c:
        for p in parts(proj(shapely.from_wkb(x["geometry"]))):
            if isinstance(p, Polygon): nd.polygon(npx(p.exterior.coords), fill=c)
for order in (("residential", "commercial", "industrial", "construction", "school", "retail"),
              ("park", "grass", "garden", "orchard", "recreation_ground", "pitch", "farmland", "cemetery", "species_management_area")):
    for x in rows("land_use"):
        if x["class"] in order:
            for p in parts(proj(shapely.from_wkb(x["geometry"]))):
                if isinstance(p, Polygon) and p.area > 40: nd.polygon(npx(p.exterior.coords), fill=LU[x["class"]])
hero_ring = next(b["ring"] for b in B if b["hero"])
nd.polygon(npx(Polygon(hero_ring).buffer(11, join_style=2).exterior.coords), fill=(186, 178, 164))     # the forecourt, paved
a_ = np.asarray(near).astype(np.float32) * (0.88 + 0.16 * m2[..., None] + 0.05 * grain[..., None])
near = Image.fromarray(np.clip(a_, 0, 255).astype(np.uint8)); nd = ImageDraw.Draw(near)
ROADS_NEAR = []
for want in ("minor", "major"):
    for x in SEG:
        if x["subtype"] != "road": continue
        w = RW.get(x["class"], 4)
        if (w >= 8) != (want == "major"): continue
        for l in parts(proj(shapely.from_wkb(x["geometry"]))):
            if not isinstance(l, LineString) or l.distance(Point(HX, HY)) > NR + 50: continue
            pts = npx(l.coords)
            if w >= 4:
                nd.line(pts, fill=(168, 162, 150), width=int((w + 4.0) / NG), joint="curve")      # footpath, pavers
                nd.line(pts, fill=(140, 136, 128), width=int((w + 0.6) / NG), joint="curve")      # kerb line
            nd.line(pts, fill=(82, 82, 82) if w >= 8 else (104, 102, 98) if w >= 4 else (150, 140, 124), width=int(w / NG), joint="curve")
            ROADS_NEAR.append({"cls": x["class"], "w": w, "name": (x["names"] or {}).get("primary") if x["names"] else None,
                               "pts": [[round(u, 2), round(v, 2)] for u, v in l.coords]})
for r in ROADS_NEAR:     # lane markings on the main road: dashed lane lines, a solid centre
    if r["w"] < 11: continue
    l = LineString(r["pts"])
    for off in (-3.5, 3.5):
        o = l.offset_curve(off)
        for d in np.arange(0, o.length, 9.0):
            seg = shapely.ops.substring(o, d, min(d + 3.0, o.length))
            if seg.length > 0.5: nd.line(npx(seg.coords), fill=(214, 210, 198), width=max(1, round(0.15 / NG)))
    nd.line(npx(r["pts"]), fill=(226, 196, 92), width=int(0.2 / NG))
# contact shadows, sharper
occ = Image.new("L", (NW_, NW_), 0); od = ImageDraw.Draw(occ)
for b in B:
    if abs(b["ring"][0][0] - HX) < NR + 30 and abs(b["ring"][0][1] - HY) < NR + 30: od.polygon(npx(b["ring"]), fill=255)
occ = np.asarray(occ.filter(ImageFilter.GaussianBlur(1.2 / NG))).astype(np.float32) / 255
a = np.asarray(near).astype(np.float32) * (1 - 0.4 * occ[..., None])
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f"{OUT}/ground_near.jpg", quality=92)
INFRA = []
for x in rows("infrastructure"):
    g = proj(shapely.from_wkb(x["geometry"]))
    if g.distance(Point(HX, HY)) < NR and x["class"] in ("bus_stop", "gate", "atm", "parking"):
        c = g.centroid; INFRA.append({"cls": x["class"], "name": (x["names"] or {}).get("primary") if x["names"] else None, "xy": [round(c.x, 1), round(c.y, 1)]})
print(len(ROADS_NEAR), "near roads;", len(INFRA), "near street things")

json.dump({"origin": [LAT0, LNG0], "kx": KX, "ky": KY, "box": [X0, Y0, X1, Y1], "gpx": GPX, "ground0": G0,
           "near": {"box": [NX0, NY0, NX1, NY1], "gpx": NG}, "roads_near": ROADS_NEAR, "infra_near": INFRA,
           "terrain": {"x0": float(tx[0]), "y0": float(ty[0]), "step": TS, "nx": len(tx), "ny": len(ty)},
           "buildings": B, "water": WATER, "metro": METRO, "trees": TT}, open(f"{OUT}/scene.json", "w"))
print("written", OUT)
