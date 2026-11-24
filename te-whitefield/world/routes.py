"""Walking routes from the Total Environment Workcations gate on Whitefield Road to the metro, along the Overture road network.

  python te-whitefield/world/routes.py DATA_DIR OUT.json

The street graph is every road segment in the extract (footways included), split at shared
nodes; the route is the shortest path from the street point nearest the entrance to the one
nearest each station. Lengths are along the streets, rounded to 10 m; minutes at 4.8 km/h.
"""
import sys, json, math, heapq
import pyarrow.parquet as pq, shapely
from shapely.geometry import Point

D, OUT = sys.argv[1], sys.argv[2]
SKY = (77.7207185, 12.9912826)   # the site gate on Whitefield Road (ITPL Main Road), Overture barrier
STATIONS = {"Hoodi": (77.711326, 12.9888029), "Sri Sathya Sai Hospital": (77.7275361, 12.9811949)}   # Purple Line, OpenStreetMap nodes
LAT0 = SKY[1]; KX, KY = math.cos(math.radians(LAT0)) * 111320.0, 110600.0
xy = lambda p: ((p[0] - SKY[0]) * KX, (p[1] - SKY[1]) * KY)
G = {}; key = lambda p: (round(p[0], 6), round(p[1], 6))
for x in pq.read_table(f"{D}/segment.parquet").to_pylist():
    if x["subtype"] != "road": continue
    g = shapely.from_wkb(x["geometry"])
    for l in (g.geoms if hasattr(g, "geoms") else [g]):
        c = list(l.coords)
        for a, b in zip(c, c[1:]):
            pa, pb = xy(a), xy(b); d = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
            G.setdefault(key(a), []).append((key(b), d)); G.setdefault(key(b), []).append((key(a), d))
nodes = list(G); pts = [xy(n) for n in nodes]
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
    out = [t]
    while out[-1] != s: out.append(prev[out[-1]])
    return dist[t], out[::-1]
src = nearest(SKY); res = []
for nm, p in STATIONS.items():
    d, pp = path(src, nearest(p)); m = int(round(d / 10.0) * 10)
    line = [list(SKY)] + [list(n) for n in pp] + [list(p)]
    res.append({"kind": "metro", "name": nm, "lines": ["L1"], "lat": p[1], "lng": p[0], "m": m, "min": max(1, round(m / 80)), "mode": "walk",
                "path": [[round(a, 6), round(b, 6)] for a, b in shapely.LineString(line).simplify(0.00002).coords], "dist": "OpenStreetMap streets (Overture), shortest walk"})
    print(nm, m, "m", res[-1]["min"], "min", len(res[-1]["path"]), "points")
json.dump(res, open(OUT, "w"), indent=1)
