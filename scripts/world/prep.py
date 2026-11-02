"""Andheri East 3D world: turn open map data into a scene file Blender can build.

  python scripts/world/prep.py DATA_DIR OUT.json

DATA_DIR holds the Overture Maps 2026-10-21 extracts (building, segment,
water, land_use, infrastructure .parquet) for the box 72.838-72.896 E,
19.094-19.128 N, and the Copernicus GLO-30 surface model (dsm.npy plus its
transform dsm_t.json). Everything is projected to metres around ORIGIN.

Heights. Overture has a height for almost no building here, so each one is
read off the Copernicus surface model: the highest 30 m cell over the
footprint, less the ground (a low percentile of the cells around it). The
model blurs slender towers, so the reading is a floor, and small footprints
are capped at what a chawl or bungalow can be. The seven Flipkart options
take their floors from the deck (G+15 is 16 storeys).
"""
import json, sys, math, hashlib, os
import numpy as np, pyarrow.parquet as pq, shapely
from shapely.geometry import Point, Polygon, MultiPolygon, LineString
from shapely.ops import unary_union

D, OUT = sys.argv[1], sys.argv[2]
LNG0, LAT0 = 72.867, 19.111
KX, KY = math.cos(math.radians(LAT0)) * 111320.0, 110540.0
def P(lng, lat): return ((lng - LNG0) * KX, (lat - LAT0) * KY)
def proj(g): return shapely.transform(g, lambda c: np.c_[(c[:, 0] - LNG0) * KX, (c[:, 1] - LAT0) * KY])
def rows(n): return pq.read_table(f"{D}/{n}.parquet").to_pylist()
def h01(s): return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xffffffff
CLIP = proj(shapely.box(72.840, 19.0955, 72.894, 19.1265))

# ---- the surface model and the ground under it -----------------------------
dsm = np.load(f"{D}/dsm.npy"); T = json.load(open(f"{D}/dsm_t.json"))  # a,b,c,d,e,f (affine)
def cell(lng, lat):
    c = int((lng - T[2]) / T[0]); r = int((lat - T[5]) / T[4]); return r, c
from numpy.lib.stride_tricks import sliding_window_view
pad = 6; g = np.pad(dsm, pad, mode="edge")
ground = np.percentile(sliding_window_view(g, (2 * pad + 1, 2 * pad + 1)), 8, axis=(-1, -2))
def sample(arr, lng, lat):
    r, c = cell(lng, lat); r = min(max(r, 0), arr.shape[0] - 1); c = min(max(c, 0), arr.shape[1] - 1); return float(arr[r, c])

# ---- the seven options (deck floors) and their pins --------------------------
OPTS = json.load(open("examples/flipkart-andheri.bundle.json"))["options"]
DECK_FLOORS = {"723-avenue": 16, "corporate-avenue": 9, "vaman-techno-centre": 8, "privilon": 16, "landmark": 7, "rustomjee-central-park": 10, "fulcrum": 10}

# ---- buildings ---------------------------------------------------------------
B = []
for x in rows("building"):
    geo = shapely.from_wkb(x["geometry"])
    parts = list(geo.geoms) if isinstance(geo, MultiPolygon) else [geo]
    for k, pg in enumerate(parts):
        if not isinstance(pg, Polygon): continue
        lng, lat = pg.representative_point().coords[0]
        q = proj(pg).simplify(0.4)
        if q.is_empty or q.area < 14 or not CLIP.intersects(q): continue
        B.append({"id": f'{x["id"]}{k}', "g": q, "lng": lng, "lat": lat, "geo": pg, "h": x["height"], "nf": x["num_floors"],
                  "cls": x["class"] or "", "name": (x["names"] or {}).get("primary") or ""})
print("buildings", len(B))
tree = shapely.STRtree([b["g"] for b in B])

def dsm_excess(b):
    minx, miny, maxx, maxy = b["geo"].bounds
    top = max(sample(dsm, lng, lat) for lng in np.linspace(minx, maxx, 3) for lat in np.linspace(miny, maxy, 3))
    return top - sample(ground, b["lng"], b["lat"])
STATION_NAMES = {"Marol Naka", "Airport Road", "Saki Naka", "Chakala - J.B. Nagar", "Western Express Highway", "Sahar Road", "MIDC - Andheri", "SEEPZ", "Gundavali", "Andheri"}
# The option's footprint: the building under its pin, else the biggest one
# within 35 m of it.
opt_b = {}
for o in OPTS:
    p = Point(*P(o["lng"], o["lat"]))
    # A pin can mark an address on a metro station (Privilon's does), so a
    # building named after a station, or a transport building, never counts.
    ok = lambda i: B[i]["name"] not in STATION_NAMES and B[i]["cls"] != "transportation" and B[i]["g"].area > 250
    hit = [i for i in tree.query(p, predicate="intersects") if ok(i)]
    if not hit:
        near = [i for i in tree.query(p.buffer(40)) if ok(i)]
        hit = sorted(near, key=lambda i: -B[i]["g"].area)[:1]
    if hit:
        i = max(hit, key=lambda i: B[i]["g"].area); opt_b[o["id"]] = i; B[i]["opt"] = o["id"]
        print(f'  {o["name"]:24s} footprint {B[i]["g"].area:7.0f} m2  {B[i]["name"]}')
    else: print("  NO FOOTPRINT", o["name"])

for b in B:
    a = b["g"].area; j = h01(b["id"])
    if b.get("opt"): h = DECK_FLOORS[b["opt"]] * 4.1 + 2.5
    elif b["h"]: h = b["h"]
    elif b["nf"]: h = b["nf"] * 3.2 + 1
    else:
        # The 30 m model blurs towers and predates many of them, so it is a
        # relative signal: footprint size sets the range, the model's excess
        # pushes a building up within it, and a few large blocks are towers.
        ex = max(0.0, dsm_excess(b)); j2 = h01(b["id"] + "t")
        if a < 70: h = 3.4 + j * 3.6
        elif a < 180: h = 6.5 + j * 6.5 + ex * 0.3
        elif a < 400: h = 10 + j * 12 + ex * 0.9
        elif a < 1500: h = 14 + j * 20 + ex * 1.5
        else: h = 18 + j * 26 + ex * 1.5
        if a > 450 and j2 > 0.975 - min(0.035, ex / 400): h = 50 + (j2 - 0.94) * 700 + ex
        h = min(h, 115)
    b["H"] = round(max(3.0, h), 1)
H = np.array([b["H"] for b in B]); print("height pctl", np.percentile(H, [10, 50, 90, 99]).round(1), "max", H.max())

# ---- roads, rail, metro -------------------------------------------------------
W = {"motorway": 34, "trunk": 26, "primary": 18, "secondary": 13, "tertiary": 10, "unclassified": 7, "residential": 6.5,
     "living_street": 5, "service": 4.5, "unknown": 5, "pedestrian": 4, "footway": 2.2, "path": 2, "steps": 2}
roads = {"major": [], "minor": [], "foot": []}; rails = []; metro = {}
for x in rows("segment"):
    g = proj(shapely.from_wkb(x["geometry"]))
    if not CLIP.intersects(g): continue
    g = g.intersection(CLIP.buffer(60))
    if x["subtype"] == "road":
        w = W.get(x["class"], 5); grp = "major" if w >= 13 else "foot" if w <= 2.2 else "minor"
        roads[grp].append(g.buffer(w / 2, cap_style="flat", join_style="round", quad_segs=3))
    elif x["subtype"] == "rail":
        nm = (x["names"] or {}).get("primary") or ""
        if x["class"] == "standard_gauge": rails.append(g)
        else: metro.setdefault(nm, []).append(g)
# Centrelines of the main roads, for traffic and street lamps on the page.
MAIN = {"motorway", "trunk", "primary", "secondary"}
traffic = []
for x in rows("segment"):
    if x["subtype"] != "road" or x["class"] not in MAIN: continue
    g = proj(shapely.from_wkb(x["geometry"])).intersection(CLIP)
    for l in (g.geoms if hasattr(g, "geoms") else [g]):
        if l.geom_type == "LineString" and l.length > 60:
            traffic.append({"w": W[x["class"]], "p": [[round(a, 1), round(b, 1)] for a, b in l.simplify(1.0).coords]})
road_poly = {k: unary_union(v).simplify(0.5) for k, v in roads.items()}
road_poly["minor"] = road_poly["minor"].difference(road_poly["major"])
road_poly["foot"] = road_poly["foot"].difference(road_poly["major"]).difference(road_poly["minor"])
rail_poly = unary_union([r.buffer(2.6, cap_style="flat") for r in rails]).simplify(0.4)
print("metro lines", {k: round(sum(g.length for g in v)) for k, v in metro.items()})

def lines_of(geoms):
    out = []
    for g in geoms:
        for l in (g.geoms if hasattr(g, "geoms") else [g]):
            if l.geom_type == "LineString" and l.length > 20: out.append([[round(a, 1), round(b, 1)] for a, b in l.simplify(1.5).coords])
    return out
METRO = {
    "L1": {"name": "Metro Line 1", "kind": "elevated", "color": "#1d6fa5", "lines": lines_of(metro.get("Mumbai Metro Line 1", []))},
    "L7": {"name": "Metro Line 7", "kind": "elevated", "color": "#d23c3c", "lines": lines_of(metro.get("Line 7", []))},
    "L3": {"name": "Metro Line 3", "kind": "underground", "color": "#1d8a8a", "lines": lines_of(metro.get("Mumbai Metro Line 3", []))},
}
# Keep one of each pair of parallel tracks on a viaduct (one deck carries both).
for k in ("L1", "L7"):
    ls = sorted(METRO[k]["lines"], key=lambda l: -LineString(l).length); keep = []
    for l in ls:
        if not any(LineString(l).hausdorff_distance(LineString(m)) < 25 for m in keep): keep.append(l)
    METRO[k]["lines"] = keep

STATIONS = []
for x in rows("infrastructure"):
    if x["class"] != "subway_station": continue
    nm = (x["names"] or {}).get("primary") or ""; g = proj(shapely.from_wkb(x["geometry"]))
    if not CLIP.intersects(g) or not nm: continue
    c = g.centroid
    line = "L3" if nm in ("SEEPZ", "MIDC - Andheri", "Sahar Road", "Chhatrapati Shivaji Maharaj International Airport - T2") or (nm == "Marol Naka" and x["geometry"] and g.geom_type == "Point") \
        else "L7" if nm in ("Gundavali", "Airport Colony Station") else "L1"
    STATIONS.append({"name": nm.replace("Chakala - J.B. Nagar", "Chakala (J B Nagar)").replace("MIDC - Andheri", "MIDC Andheri").replace("Andheri L1", "Andheri")
                     .replace("Chhatrapati Shivaji Maharaj International Airport - T2", "CSMIA T2"), "line": line, "x": round(c.x, 1), "y": round(c.y, 1)})
# Dedupe by name+line
seen = set(); STATIONS = [s for s in STATIONS if not ((s["name"], s["line"]) in seen or seen.add((s["name"], s["line"])))]
print("stations", [(s["name"], s["line"]) for s in STATIONS])
platforms = [proj(shapely.from_wkb(x["geometry"])) for x in rows("infrastructure") if x["class"] == "platform"]
rail_platforms = unary_union([p for p in platforms if p.geom_type == "Polygon" and p.area > 200 and p.centroid.x < -1500]) if platforms else None

# ---- land use and water -------------------------------------------------------
GREEN = {"park", "grass", "garden", "playground", "recreation_ground", "pitch", "forest", "wood", "golf_course", "cemetery", "meadow"}
land = {"green": [], "built": [], "school": [], "water": [], "airport": []}
for x in rows("land_use"):
    g = proj(shapely.from_wkb(x["geometry"]))
    if g.geom_type not in ("Polygon", "MultiPolygon") or not CLIP.intersects(g): continue
    g = g.intersection(CLIP)
    k = "green" if x["class"] in GREEN else "school" if x["subtype"] in ("education", "medical") else "airport" if x["subtype"] == "transportation" and "air" in (x["class"] or "") else "built"
    land[k].append(g)
for x in rows("water"):
    g = proj(shapely.from_wkb(x["geometry"]))
    if not CLIP.intersects(g): continue
    g = g.intersection(CLIP)
    if g.geom_type in ("LineString", "MultiLineString"): g = g.buffer(6 if x["subtype"] in ("river",) else 3)
    if x["class"] != "swimming_pool": land["water"].append(g)
land = {k: unary_union(v).simplify(0.6) if v else None for k, v in land.items()}

# ---- trees: dense in green areas, scattered in open ground elsewhere ---------
rng = np.random.default_rng(7)
blocked = unary_union([road_poly["major"], road_poly["minor"], rail_poly, unary_union([b["g"].buffer(1.5) for b in B])]).buffer(0.5)
if land["water"] is not None: blocked = blocked.union(land["water"])
minx, miny, maxx, maxy = CLIP.bounds
def scatter(area_geom, n):
    if area_geom is None or area_geom.is_empty: return np.zeros((0, 2))
    bx = area_geom.bounds; pts = np.c_[rng.uniform(bx[0], bx[2], n), rng.uniform(bx[1], bx[3], n)]
    ok = shapely.contains_xy(area_geom, pts[:, 0], pts[:, 1]) & ~shapely.contains_xy(blocked, pts[:, 0], pts[:, 1])
    return pts[ok]
shapely.prepare(blocked)
tg = scatter(land["green"], 60000)
# Roadside trees: a band along minor and major roads.
band = unary_union([road_poly["major"].buffer(5), road_poly["minor"].buffer(3.5)]).difference(unary_union([road_poly["major"], road_poly["minor"]]))
tr = scatter(band, 420000)[::2]
to = scatter(CLIP, 520000)[::3]
trees = np.vstack([tg, tr, to]); print("trees", len(tg), len(tr), len(to))

# ---- write ----------------------------------------------------------------------
def rings(g):
    out = []
    if g is None or g.is_empty: return out
    for p in (g.geoms if hasattr(g, "geoms") else [g]):
        if p.geom_type != "Polygon" or p.area < 4: continue
        out.append([[[round(a, 1), round(b, 1)] for a, b in p.exterior.coords[:-1]]] + [[[round(a, 1), round(b, 1)] for a, b in r.coords[:-1]] for r in p.interiors])
    return out
scene = {
    "origin": [LNG0, LAT0], "k": [KX, KY], "bounds": [round(v, 1) for v in CLIP.bounds],
    "source": "Overture Maps 2026-10-21 (OpenStreetMap, Microsoft, Google footprints); heights from Copernicus GLO-30; options from the deck",
    "buildings": [{"p": [[round(a, 1), round(b, 1)] for a, b in b["g"].exterior.coords[:-1]], "h": b["H"], "c": b["cls"], **({"opt": b["opt"]} if b.get("opt") else {}),
                   "r": round(h01(b["id"]), 3)} for b in B],
    "roads": {k: rings(v) for k, v in road_poly.items()}, "rail": rings(rail_poly), "platforms": rings(rail_platforms),
    "land": {k: rings(v) for k, v in land.items()},
    "metro": METRO, "stations": STATIONS,
    "trees": [[round(a, 1), round(b, 1), round(float(s), 2)] for (a, b), s in zip(trees, rng.uniform(0.7, 1.4, len(trees)))],
    "options": [{"id": o["id"], "name": o["name"], "x": round(P(o["lng"], o["lat"])[0], 1), "y": round(P(o["lng"], o["lat"])[1], 1),
                 "h": B[opt_b[o["id"]]]["H"] if o["id"] in opt_b else 40,
                 "routes": [{"kind": r["kind"], "name": r["name"], "m": r["m"], "min": r.get("min"), "path": [[round(a, 1), round(b, 1)] for a, b in (P(*q) for q in r["path"])]} for r in o["routes"]]}
                for o in OPTS],
}
json.dump(scene, open(OUT, "w"), separators=(",", ":"))

# The page's slice: no building polygons (the GLB has them), but the trees,
# the lamps, the main roads for traffic, the metro and the seven footprints.
lamps = []
for t in traffic:
    ls = LineString(t["p"])
    for d in np.arange(12, ls.length, 34):
        p, q = ls.interpolate(d), ls.interpolate(min(ls.length, d + 1))
        dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
        off = t["w"] / 2 + 0.8
        lamps.append([round(p.x - dy / n * off, 1), round(p.y + dx / n * off, 1)])
web = {k: scene[k] for k in ("origin", "k", "bounds", "source", "metro", "stations", "trees")}
web["traffic"] = traffic; web["lamps"] = lamps
web["options"] = [{**o, "foot": next((b["p"] for b in scene["buildings"] if b.get("opt") == o["id"]), None)} for o in scene["options"]]
if len(sys.argv) > 3:
    json.dump(web, open(sys.argv[3], "w"), separators=(",", ":"))
    print("wrote", sys.argv[3], round(os.path.getsize(sys.argv[3]) / 1e6, 2), "MB", len(traffic), "roads", len(lamps), "lamps")
import os
print("wrote", OUT, round(os.path.getsize(OUT) / 1e6, 1), "MB")
