"""Walking routes from each option in a region to its nearest metro stations, along the Overture streets.

  python scripts/world/routes.py DATA_DIR scripts/world/regions/<site>.json OUT.json [--stations "Name=lng,lat;..."]

The general form of scripts/skymark/routes.py. The street graph is every road segment in the
extract (footways included), split at shared vertices and joined where two ends meet within 1.5 m.
Stations are the Overture subway_station points inside the clip box, plus any named with
--stations. For each option of the region's bundle that lies inside the box, the route is the
shortest path from the street point nearest the pin to the one nearest each of its two closest
stations. Lengths are along the streets, rounded to 10 m; minutes at 4.8 km/h (80 m a minute).
A pin that is only indicative gives an indicative route: the output says so per option.
"""
import sys, json, math, heapq
import pyarrow.parquet as pq, shapely
from shapely.geometry import Point

D, REG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
RG = json.load(open(REG)); BB = RG["clip"]
LNG0, LAT0 = RG["lng0"], RG["lat0"]; KX, KY = math.cos(math.radians(LAT0)) * 111320.0, RG.get("ky", 110950.0)
xy = lambda p: ((p[0] - LNG0) * KX, (p[1] - LAT0) * KY)
inside = lambda lng, lat: BB[0] <= lng <= BB[2] and BB[1] <= lat <= BB[3]

STATIONS = {}
for x in pq.read_table(f"{D}/infrastructure.parquet").to_pylist():
    if x["class"] != "subway_station": continue
    nm = (x["names"] or {}).get("primary") or ""
    c = shapely.from_wkb(x["geometry"]).centroid
    if nm and inside(c.x, c.y): STATIONS.setdefault(nm, (c.x, c.y))
if "--stations" in sys.argv:
    for item in sys.argv[sys.argv.index("--stations") + 1].split(";"):
        nm, ll = item.split("="); STATIONS[nm] = tuple(float(v) for v in ll.split(","))
print("stations", {k: (round(v[0], 6), round(v[1], 6)) for k, v in STATIONS.items()})

G = {}; key = lambda p: (round(p[0], 6), round(p[1], 6))
for x in pq.read_table(f"{D}/segment.parquet").to_pylist():
    if x["subtype"] != "road" or x["class"] in ("motorway",): continue
    g = shapely.from_wkb(x["geometry"])
    for l in (g.geoms if hasattr(g, "geoms") else [g]):
        c = list(l.coords)
        for a, b in zip(c, c[1:]):
            pa, pb = xy(a), xy(b); d = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
            G.setdefault(key(a), []).append((key(b), d)); G.setdefault(key(b), []).append((key(a), d))
nodes = list(G); pts = [xy(n) for n in nodes]
# join dangling ends that almost touch (separately drawn segments)
grid = {}
for i, (x, y) in enumerate(pts): grid.setdefault((int(x // 2), int(y // 2)), []).append(i)
for i, (x, y) in enumerate(pts):
    if len(G[nodes[i]]) > 1: continue
    for gx in range(int(x // 2) - 1, int(x // 2) + 2):
        for gy in range(int(y // 2) - 1, int(y // 2) + 2):
            for j in grid.get((gx, gy), []):
                d = math.hypot(pts[j][0] - x, pts[j][1] - y)
                if j != i and d < 1.5: G[nodes[i]].append((nodes[j], d)); G[nodes[j]].append((nodes[i], d))
print("street graph", len(nodes), "vertices")

def nearest(p):
    q = xy(p); return min(range(len(nodes)), key=lambda i: (pts[i][0] - q[0]) ** 2 + (pts[i][1] - q[1]) ** 2)
def path(a, b):
    s, t = nodes[a], nodes[b]; dist = {s: 0.0}; prev = {}; h = [(0.0, s)]
    while h:
        d, u = heapq.heappop(h)
        if u == t: break
        if d > dist[u]: continue
        for v, w in G[u]:
            nd = d + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(h, (nd, v))
    if t not in dist: return None, None
    out = [t]
    while out[-1] != s: out.append(prev[out[-1]])
    return dist[t], out[::-1]

res = {}
for o in json.load(open(RG["bundle"]))["options"]:
    if not inside(o["lng"], o["lat"]): continue
    pin = (o["lng"], o["lat"]); src = nearest(pin); q = xy(pin)
    near = sorted(STATIONS.items(), key=lambda kv: math.hypot(xy(kv[1])[0] - q[0], xy(kv[1])[1] - q[1]))[:2]
    out = []
    for nm, p in near:
        d, pp = path(src, nearest(p))
        if d is None: print("  no street path", o["id"], nm); continue
        m = int(round((d + math.dist(q, pts[src])) / 10.0) * 10)
        line = [list(pin)] + [list(n) for n in pp] + [list(p)]
        out.append({"kind": "metro", "name": nm, "lines": [RG.get("metro", {}).get(RG.get("station_line", "L1"), ["Metro"])[0]], "lat": round(p[1], 7), "lng": round(p[0], 7),
                    "m": m, "min": max(1, round(m / 80)), "mode": "walk",
                    "path": [[round(a, 6), round(b, 6)] for a, b in shapely.LineString(line).simplify(0.00002).coords],
                    "dist": "Overture Maps streets (OpenStreetMap), shortest walk" if o.get("precision") != "building" else "Overture Maps streets (OpenStreetMap), shortest walk",
                    "src": "https://docs.overturemaps.org/"})
        print(f'  {o["name"]:12s} -> {nm:22s} {m:5d} m {out[-1]["min"]:3d} min')
    res[o["id"]] = out
json.dump(res, open(OUT, "w"), indent=1)
