"""Put the explorer's walk at F1 Skymark's real way in.

    python noida-skymark/world/fit_dollhouse.py media/noida-skymark/world/d/skymark-f1.json

scripts/world/diorama.py guesses the entrance as the face nearest a road, which for Skymark is
the long side with the angular frame. The twin knows better: the gate and the entrance porch are
on the street front (facing south-east, 146 degrees). This moves the entrance, the walk's start
(the footpath outside the pedestrian gate) and the street view to that front, and clears trees
off the line from the gate to the doors and off the plot itself. Everything is read from
facade_parameters.json, so it follows the model when the model changes.
"""
import json, math, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
P = json.load(open(os.path.join(ROOT, "noida-skymark/reconstruction/facade_parameters.json")))
path = sys.argv[1]; D = json.load(open(path))
m, an, e, s = P["massing"], P["annex"], P["entrance"], P["site"]
W, L, d = m["front_width_A"], m["side_length_B"], an["depth"]
fc = (W / 2, (L - d) / 2)
phi = math.radians(P["map"]["phi_deg"])
cx, cy = P["map"]["region_xy"][0] - D["origin"][0], P["map"]["region_xy"][1] - D["origin"][1]

def to_d(u, y):
    """a point in the twin's frame (u along the front from the corner, y out from the front is
    negative) to the diorama's metres"""
    x, yy = u - fc[0], y - fc[1]
    return [round(cx + x * math.cos(phi) - yy * math.sin(phi), 1), round(cy + x * math.sin(phi) + yy * math.cos(phi), 1)]

gp = s["gate"].get("pedestrian") or s["gate"]["vehicle"]
ug = (gp[0] + gp[1]) / 2
wall_y = -d - s.get("margin_front", 9.0)
ent = to_d((e["u0"] + e["u1"]) / 2, -d - 0.5)
walk0 = to_d(ug, wall_y - 2.5)              # on the footpath, just outside the pedestrian gate
cam = to_d(ug - 4.0, wall_y - 26.0)         # across the street, looking at the front
D["building"]["entrance"] = ent
D["building"]["facing"] = round(phi, 3)
D["walk0"] = walk0
D["street_cam"] = cam
D["building"]["twin"] = {"source": "noida-skymark/reconstruction (Blender, from the client's photographs)", "gate": to_d(ug, wall_y)}

# trees: none on the plot, none on the line from the street view to the doors
plot = [to_d(u, y) for u, y in ((-s.get("margin_side_B", 6.0), wall_y), (W + 2, wall_y), (W + 2, L + 2), (-s.get("margin_side_B", 6.0), L + 2))]
def inside(p, poly):
    x, y = p; n = len(poly); c = False
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p; dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)
before = len(D["trees"])
D["trees"] = [t for t in D["trees"] if not inside(t[:2], plot) and seg_dist(t[:2], cam, ent) > 7 and math.hypot(t[0] - walk0[0], t[1] - walk0[1]) > 8]
json.dump(D, open(path, "w"), separators=(",", ":"))
print("entrance", ent, "walk0", walk0, "street_cam", cam, "trees", before, "->", len(D["trees"]))
