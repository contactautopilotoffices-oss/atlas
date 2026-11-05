"""Street routes from Overture Maps road data, for when the OSRM servers used
for scripts/examples/data/flipkart-routes.json can't be reached.

  python3 -I scripts/examples/overture-route.py SEGMENTS.parquet FROM_LNG,FROM_LAT TO_LNG,TO_LAT foot|car

SEGMENTS.parquet is Overture's transportation/segment theme for the area
(release 2026-10-21, OpenStreetMap-derived; scripts/world/fetch.py writes
it). Segments are joined wherever they share a vertex, as Overture splits
them at junctions. Walking uses every road and path except motorways and
trunk roads; driving uses roads only, not footways, paths or steps. Both
ends snap to the nearest usable street. Prints a JSON route in the shape
flipkart-routes.json keeps: m (metres along the streets), sec (at 1.3 m/s on
foot, 30 km/h by car, only indicative), path (lng, lat).
"""
import heapq, json, math, sys
import pyarrow.parquet as pq
import shapely

FOOT_NO = {"motorway", "trunk"}
CAR_NO = {"footway", "steps", "path", "pedestrian", "cycleway", "bridleway"}

def main():
    seg_f, a, b, prof = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    A = tuple(map(float, a.split(","))); B = tuple(map(float, b.split(",")))
    lat0 = (A[1] + B[1]) / 2
    KX, KY = 111320 * math.cos(math.radians(lat0)), 110950
    t = pq.read_table(seg_f, columns=["geometry", "class", "subtype"]).to_pylist()
    key = lambda p: (round(p[0], 7), round(p[1], 7))
    adj = {}
    for r in t:
        if r["subtype"] != "road": continue
        c = r["class"] or "unknown"
        if (prof == "foot" and c in FOOT_NO) or (prof == "car" and c in CAR_NO): continue
        g = shapely.from_wkb(r["geometry"])
        cs = list(g.coords) if g.geom_type == "LineString" else [p for part in g.geoms for p in part.coords]
        for p, q in zip(cs, cs[1:]):
            d = math.hypot((q[0] - p[0]) * KX, (q[1] - p[1]) * KY)
            u, v = key(p), key(q)
            adj.setdefault(u, []).append((v, d)); adj.setdefault(v, []).append((u, d))
    near = lambda P: min(adj, key=lambda n: (n[0] - P[0]) ** 2 * KX * KX + (n[1] - P[1]) ** 2 * KY * KY)
    s, e = near(A), near(B)
    dist, prev, pq_ = {s: 0.0}, {}, [(0.0, s)]
    while pq_:
        d, u = heapq.heappop(pq_)
        if u == e: break
        if d > dist.get(u, 1e18): continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq_, (nd, v))
    if e not in dist: raise SystemExit("no route: the ends are not connected in this data")
    path, n = [e], e
    while n != s: n = prev[n]; path.append(n)
    path.reverse()
    m = dist[e]
    # thin the path for the map (every 25 m or so), keeping both ends
    thin, acc = [path[0]], 0.0
    for p, q in zip(path, path[1:]):
        acc += math.hypot((q[0] - p[0]) * KX, (q[1] - p[1]) * KY)
        if acc >= 25: thin.append(q); acc = 0.0
    if thin[-1] != path[-1]: thin.append(path[-1])
    print(json.dumps({"profile": prof, "m": round(m), "sec": round(m / (1.3 if prof == "foot" else 8.33)),
                      "path": [[round(x, 5), round(y, 5)] for x, y in thin], "src": "Overture Maps 2026-10-21 transportation segments (OpenStreetMap), shortest path (scripts/examples/overture-route.py)"}))

if __name__ == "__main__":
    main()
