"""Pick the spots the walk stands on and write them as a camera file the renderer reads.

The walk is a set of 360 degree renders. Where you stand, the nearest render is shown and you look round inside it; moving
swaps to the next one. This script covers the floor you can walk on (the same rule the page uses: walls, glass, desks,
tables, planters and columns block you; door openings are open) with spots about SPACING metres apart, plus one in
every room and one on each side of every door.

Usage: python3 make_nodes.py [spacing_m]   ->  nodes_cameras.json, ../nodes.json (what the page reads)
"""
import json, math, sys
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import prepared

SP = float(sys.argv[1]) if len(sys.argv) > 1 else 4.2
L = json.load(open("../volt-floor1.layout.json")); EYE = 1.55

def solid(w):
    p = Polygon(w["outer"]).buffer(0)
    return p.difference(unary_union([Polygon(h) for h in w["holes"]])) if w["holes"] else p
def rect(c, w, d, a):
    ca, sa = math.cos(a), math.sin(a)
    return Polygon([(c[0] + ca * u * w / 2 - sa * v * d / 2, c[1] + sa * u * w / 2 + ca * v * d / 2) for u, v in [(-1, -1), (1, -1), (1, 1), (-1, 1)]])

floor = unary_union([Polygon(f["outer"]).buffer(0) for f in L["floor"]])
obst = [solid(w) for w in L["walls"]] + [Polygon(c).buffer(0) for c in L["columns"]]
obst += [LineString([(g[0], g[1]), (g[2], g[3])]).buffer(.06) for g in L["glass"]]
obst += [rect(d["c"], d["w"], d["d"], d["a"]) for d in L["desks"]]
for t in L["tables"]: obst.append(Point(t["circle"][0], t["circle"][1]).buffer(t["circle"][2]) if t.get("circle") else Polygon(t["poly"]).buffer(0))
obst += [rect(p["c"], p["w"], p["d"], p["a"]) for p in L["planters"]]
if L.get("atrium"): obst.append(Polygon(L["atrium"]))
if L.get("stairs"): a, b, c, d = L["stairs"]["bbox"]; obst.append(box(a, b, c, d))
doors = [rect(d["c"], max(d["w"], .9) - .04, .9, d["a"]) for d in L["doors"]]
blocked = unary_union(obst).difference(unary_union(doors))
free = floor.difference(blocked)
clear = free.buffer(-.4)                                 # a spot needs 0.4 m of room round it so the picture is not up against a wall
cp = prepared.prep(clear)

def room_of(x, y):
    for r in L["rooms"]:
        b = r["box"]
        if b[0] <= x <= b[2] and b[1] <= y <= b[3]: return r["name"]
    return "Circulation"

pts = []
def ok(p): return cp.contains(Point(p))
def add(p):
    if ok(p) and all(math.hypot(p[0] - q[0], p[1] - q[1]) > 1.6 for q in pts): pts.append((round(p[0], 2), round(p[1], 2))); return True
    return False
# one in every room: the roomiest clear spot near its centre
for r in L["rooms"]:
    b = r["box"]; best = None
    for i in range(int(b[0] * 4), int(b[2] * 4) + 1):
        for j in range(int(b[1] * 4), int(b[3] * 4) + 1):
            p = (i / 4, j / 4)
            if not ok(p): continue
            sc = free.distance(Point(p)) if False else -math.hypot(p[0] - (b[0] + b[2]) / 2, p[1] - (b[1] + b[3]) / 2)
            if best is None or sc > best[0]: best = (sc, p)
    if best: add(best[1])
# each side of each door
for d in L["doors"]:
    ca, sa = math.cos(d["a"]), math.sin(d["a"])
    for s in (-1, 1):
        for off in (.9, 1.3, 1.8):
            if add((d["c"][0] - sa * s * off, d["c"][1] + ca * s * off)): break
# fill the rest of the walkable floor so no spot is more than about SP/1.4 from a render
minx, miny, maxx, maxy = floor.bounds; step = .5
cand = [(minx + i * step, miny + j * step) for i in range(int((maxx - minx) / step) + 1) for j in range(int((maxy - miny) / step) + 1)]
cand = [c for c in cand if ok(c)]
while True:
    far = max(cand, key=lambda c: min(math.hypot(c[0] - q[0], c[1] - q[1]) for q in pts) if pts else 99, default=None)
    if not far or (pts and min(math.hypot(far[0] - q[0], far[1] - q[1]) for q in pts) < SP / 1.4): break
    pts.append((round(far[0], 2), round(far[1], 2)))
nodes = [{"id": f"n{i + 1:02d}", "x": p[0], "y": p[1], "room": room_of(*p)} for i, p in enumerate(pts)]
json.dump({"eye": EYE, "about": "Spots the walk stands on. Plan coordinates in metres.", "nodes": nodes}, open("../nodes.json", "w"), separators=(",", ":"))
json.dump({"about": "One panorama per walk spot, for volt_render.py --cameras. Made by make_nodes.py.", "eye": EYE,
           "rooms": [{"slug": n["id"], "room": n["room"], "pano": {"pos": [n["x"], n["y"], EYE]}, "still": {"pos": [n["x"], n["y"], EYE], "look": [n["x"], n["y"] + 1, EYE], "lens_mm": 20}} for n in nodes]},
          open("nodes_cameras.json", "w"), indent=0)
print(len(nodes), "spots;", round(free.area), "m2 walkable;", "rooms covered:", len({n["room"] for n in nodes}))
