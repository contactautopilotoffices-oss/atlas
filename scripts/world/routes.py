"""Walking routes from each option in a region to its nearest metro stations, along the Overture streets.

  python scripts/world/routes.py DATA_DIR scripts/world/regions/<site>.json OUT.json [--stations "Name=lng,lat;..."]

The general form of scripts/skymark/routes.py. The street graph is every road segment in the
extract (footways included), split at shared vertices and joined where two ends meet within 1.5 m.
Stations are the Overture subway_station points inside the clip box, plus any named with
--stations. For each option of the region's bundle that lies inside the box, the route is the
shortest path from the street point nearest the pin to the one nearest each of its two closest
stations. Lengths are along the streets, rounded to 10 m; minutes at 4.8 km/h (80 m a minute).
A pin that is only indicative gives an indicative route: the output says so per option.

Optional, for routes that start at the real gate rather than the pin:
  --origins FILE   JSON {"<option id>": [[lng, lat], ...]}: the entrance/gate positions of an option
                   (any number). Each gate is tried; the route is the shortest walk from the best one,
                   and the two stations offered are the two with the shortest WALK (not straight line).
  --no-walk WORD[:M]  a vehicle underpass is not a footpath: segments whose name contains WORD (e.g. "Underpass"),
                   and unnamed lanes that run alongside one (every vertex within M metres, default 30, and
                   longer than 40 m), are left out of the walking graph. See docs/JINDALX_METRO_CHECK.md.
  --report FILE    write every gate x station walk (metres, street-gap at both ends) as JSON.
Routes are measured gate -> nearest street point -> street graph -> street point nearest the station
-> station point (the Overture station point; the data carries no separate platform entrances).
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

G = {}; EDGES = []; key = lambda p: (round(p[0], 6), round(p[1], 6))
SEGS = [x for x in pq.read_table(f"{D}/segment.parquet").to_pylist() if x["subtype"] == "road" and x["class"] not in ("motorway",)]
SKIP = set()
if "--no-walk" in sys.argv:
    word, _, buf = sys.argv[sys.argv.index("--no-walk") + 1].partition(":"); buf = float(buf or 30)
    line = lambda g: shapely.LineString([xy(c) for c in g.coords])
    NAMED = [x for x in SEGS if word.lower() in ((x["names"] or {}).get("primary") or "").lower()]
    SKIP |= {x["id"] for x in NAMED}
    hull = shapely.unary_union([line(shapely.from_wkb(x["geometry"])) for x in NAMED]) if NAMED else None
    for x in SEGS:
        if x["id"] in SKIP or (x["names"] or {}).get("primary") or hull is None: continue
        g = shapely.from_wkb(x["geometry"])
        if g.geom_type == "LineString" and line(g).length > 40 and all(shapely.Point(xy(c)).distance(hull) <= buf for c in g.coords): SKIP.add(x["id"])
    print("not walkable (underpass and its lanes):", len(SKIP), "segments,", round(sum(line(shapely.from_wkb(x["geometry"])).length for x in SEGS if x["id"] in SKIP)), "m")
for x in SEGS:
    if x["id"] in SKIP: continue
    g = shapely.from_wkb(x["geometry"])
    for l in (g.geoms if hasattr(g, "geoms") else [g]):
        c = list(l.coords)
        for a, b in zip(c, c[1:]):
            pa, pb = xy(a), xy(b); d = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
            G.setdefault(key(a), []).append((key(b), d)); G.setdefault(key(b), []).append((key(a), d)); EDGES.append((key(a), key(b), pa, pb))
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

# Every gate and station is snapped to the nearest point ON a street (not the nearest street vertex, which
# can be 100 m away on a long straight): that point becomes a vertex that splits its street.
TREE = shapely.STRtree([shapely.LineString([e[2], e[3]]) for e in EDGES]); ON = {}; VP = {}
def snap(p):
    q = xy(p); i = int(TREE.nearest(shapely.Point(q))); ka, kb, pa, pb = EDGES[i]
    L = math.hypot(pb[0] - pa[0], pb[1] - pa[1]) or 1e-9
    t = max(0.0, min(1.0, ((q[0] - pa[0]) * (pb[0] - pa[0]) + (q[1] - pa[1]) * (pb[1] - pa[1])) / L ** 2))
    pr = (pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1])); vk = ("v", len(VP)); VP[vk] = pr
    ON.setdefault(i, []).append((t, vk)); return vk, math.dist(q, pr)
def lnglat(k): return k if k[0] != "v" else (LNG0 + VP[k][0] / KX, LAT0 + VP[k][1] / KY)

ORIGINS = json.load(open(sys.argv[sys.argv.index("--origins") + 1])) if "--origins" in sys.argv else {}
OPTS = [o for o in json.load(open(RG["bundle"]))["options"] if inside(o["lng"], o["lat"])]
GATES = {o["id"]: [tuple(g) for g in ORIGINS.get(o["id"], [])] or [(o["lng"], o["lat"])] for o in OPTS}
SG = {g: snap(g) for gs in GATES.values() for g in gs}; SS = {nm: snap(p) for nm, p in STATIONS.items()}
for i, vs in ON.items():                                  # chain the vertices that landed on the same street
    ka, kb, pa, pb = EDGES[i]; L = math.hypot(pb[0] - pa[0], pb[1] - pa[1]); seq = [(0.0, ka)] + sorted(vs) + [(1.0, kb)]
    for (t0, k0), (t1, k1) in zip(seq, seq[1:]):
        w = (t1 - t0) * L; G.setdefault(k0, []).append((k1, w)); G.setdefault(k1, []).append((k0, w))

def sssp(s):
    """Shortest street distance from vertex s to every vertex, with the parent of each."""
    dist = {s: 0.0}; prev = {}; h = [(0.0, s)]
    while h:
        d, u = heapq.heappop(h)
        if d > dist[u]: continue
        for v, w in G[u]:
            nd = d + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(h, (nd, v))
    return dist, prev
def trace(prev, s, t):
    out = [t]
    while out[-1] != s: out.append(prev[out[-1]])
    return out[::-1]

REPORT = {}
LINE = RG.get("metro", {}).get(RG.get("station_line", "L1"), ["Metro"])[0]
res = {}
for o in OPTS:
    gates = GATES[o["id"]]
    best = {}                                             # station -> best (metres, gate, path)
    REPORT[o["id"]] = []
    for g in gates:
        src, gap0 = SG[g]; q = xy(g); dist, prev = sssp(src)
        for nm, p in STATIONS.items():
            dst, gap1 = SS[nm]
            if dst not in dist: continue
            d = dist[dst] + gap0 + gap1
            REPORT[o["id"]].append({"gate": [round(g[0], 7), round(g[1], 7)], "station": nm, "walk_m": round(d, 1), "gate_to_street_m": round(gap0, 1),
                                    "street_to_station_m": round(gap1, 1), "straight_m": round(math.dist(q, xy(p)), 1)})
            if nm not in best or d < best[nm][0]: best[nm] = (d, g, [lnglat(k) for k in trace(prev, src, dst)], p)
    out = []
    for nm, (d, g, pp, p) in sorted(best.items(), key=lambda kv: kv[1][0])[:2]:
        m = int(round(d / 10.0) * 10)
        line = [list(g)] + [list(n) for n in pp] + [list(p)]
        out.append({"kind": "metro", "name": nm, "lines": [LINE], "lat": round(p[1], 7), "lng": round(p[0], 7),
                    "m": m, "min": max(1, round(m / 80)), "mode": "walk",
                    "path": [[round(a, 6), round(b, 6)] for a, b in shapely.LineString(line).simplify(0.00002).coords],
                    "dist": "Overture Maps streets (OpenStreetMap), shortest walk",
                    "src": "https://docs.overturemaps.org/"})
        print(f'  {o["name"]:12s} -> {nm:22s} {m:5d} m {out[-1]["min"]:3d} min  from gate {tuple(round(v, 5) for v in g)}')
    if not out: print("  no street path", o["id"])
    res[o["id"]] = out
json.dump(res, open(OUT, "w"), indent=1)
if "--report" in sys.argv: json.dump(REPORT, open(sys.argv[sys.argv.index("--report") + 1], "w"), indent=1)
