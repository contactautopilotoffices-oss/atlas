"""Open the wall solid over every glazed partition and window.

The CAD draws a thin wall strip on or just inside most glass lines (WS-GLAZ-GLAS partitions, some AR-WINDOW facade
windows). Built as drawn, the strip is a solid wall and the glass is hidden behind it. This cuts the wall over the
glass run only (flat ends, so the wall on either side stays) so the glass can be seen through.

Run after layout.py and fit_to_twin.py:  python3 open_glass.py volt-floor1.layout.json
"""
import json, sys
from shapely.geometry import Polygon, LineString, MultiPolygon
from shapely.ops import unary_union

p = sys.argv[1]; L = json.load(open(p))
if L.get("glass_opened"): sys.exit("already done")
solid = lambda w: Polygon(w["outer"]).buffer(0).difference(unary_union([Polygon(h) for h in w["holes"]])) if w["holes"] else Polygon(w["outer"]).buffer(0)
W = unary_union([solid(w) for w in L["walls"]])
cuts, n = [], 0
for x0, y0, x1, y1, layer in L["glass"]:
    ln = LineString([(x0, y0), (x1, y1)])
    if ln.length < .3: continue
    if ln.buffer(.35).intersection(W).area / (ln.length * .7) > .3:            # a wall strip lies on or beside this glass
        cuts.append(ln.buffer(.35, cap_style=2)); n += 1
cut = unary_union(cuts)
out = []
for w in L["walls"]:
    g = solid(w).difference(cut)
    for part in (g.geoms if isinstance(g, MultiPolygon) else [g]):
        if part.is_empty or part.area < .004: continue
        out.append({**{k: v for k, v in w.items() if k not in ("outer", "holes")},
                    "outer": [[round(x, 3), round(y, 3)] for x, y in list(part.exterior.coords)[:-1]],
                    "holes": [[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in part.interiors]})
print(f"opened {n} glass runs; wall pieces {len(L['walls'])} -> {len(out)}")
L["walls"] = out; L["glass_opened"] = True
json.dump(L, open(p, "w"), separators=(",", ":"))
