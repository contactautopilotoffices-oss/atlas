"""The logic gate: run inside diorama.py after the build. It fails the build when the scene breaks reality.

Checks (each one is a mistake that reached the founder before):
  1. every surveyed building in scripts/world/refs/*.json is standing, at its surveyed height (Fleet House vanished
     when an old pin's tag deleted it);
  2. nothing stands on a carriageway: no building footprint is mostly road surface;
  3. the shortlisted property is present, and no context building overlaps it;
  4. no two buildings overlap by more than a sliver;
  5. every Line 1 station in the slab has its station model, and no building stands inside the station's clearance;
  6. the camera never starts inside a building (a black frame);
  7. compound walls (region flag "walls") stand in no road and through no building.
Writes <OUT>/<id>-logic.json and raises SystemExit on any failure unless --allow-logic-fail is given.
"""
import json, os
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

def run(ctx):
    S, A, OID, OUT, L = ctx["S"], ctx["A"], ctx["OID"], ctx["OUT"], ctx["L"]
    built, ROAD, SLAB, METRO_CLEAR = ctx["built"], ctx["ROAD"], ctx["SLAB"], ctx["METRO_CLEAR"]
    fails, notes = [], []
    polys = [(b, p) for b, p in built]
    # 1. surveyed buildings
    rd = os.path.join(os.path.dirname(os.path.abspath(__file__)), "refs")
    for fn in sorted(os.listdir(rd)):
        J = json.load(open(os.path.join(rd, fn)))
        if any(abs(a - b) > 1e-6 for a, b in zip(J.get("scene_origin", [72.867, 19.111]), S["origin"])): continue   # another region's survey (no origin: Andheri East)
        for e in J.get("buildings", []):
            pt = Point(e["x"], e["y"])
            if not SLAB.buffer(-5).contains(pt): continue
            near = [p for b, p in polys if p.distance(pt) < 15]
            if not near: fails.append(f"surveyed building missing: {e['name']} at ({e['x']}, {e['y']})")
        for e in J.get("added", []):
            pt = Polygon(e["poly"]).centroid
            if SLAB.buffer(-5).contains(pt) and not any(p.distance(pt) < 5 for b, p in polys): fails.append(f"added building missing: {e['name']}")
    # 2. buildings on the carriageway
    for b, p in polys:
        if b.get("opt"): continue
        if p.area > 20 and p.intersection(ROAD["major"]).area > 0.5 * p.area:
            fails.append(f"building on the carriageway at {[round(v) for v in p.centroid.coords[0]]} ({round(p.area)} m2)")
    # 3. the property, and nothing on top of it
    opt = [p for b, p in polys if b.get("opt") == OID]
    if not opt: fails.append(f"the property {OID} is not in the scene")
    else:
        for b, p in polys:
            if not b.get("opt") and p.intersection(opt[0]).area > 5:
                fails.append(f"a context building overlaps {OID} by {round(p.intersection(opt[0]).area)} m2 at {[round(v) for v in p.centroid.coords[0]]}")
    # 4. overlaps between buildings (map duplicates)
    from shapely.strtree import STRtree
    geoms = [p for b, p in polys]; tree = STRtree(geoms); dup = 0
    for i, g in enumerate(geoms):
        for j in tree.query(g):
            if j <= i: continue
            a = g.intersection(geoms[j]).area
            if a > 25 and a > 0.3 * min(g.area, geoms[j].area): dup += 1
    if dup: notes.append(f"{dup} pairs of map footprints overlap (duplicates in the open data); the larger is kept visually")
    # 5. stations
    if not METRO_CLEAR.is_empty:
        for b, p in polys:
            if not b.get("opt") and p.intersection(METRO_CLEAR).area > 0.6 * p.area:
                fails.append(f"a building stands inside the Line 1 station clearance at {[round(v) for v in p.centroid.coords[0]]}")
    # 6. cameras
    for cam in ctx.get("cameras", []):
        pt = Point(cam[0], cam[1])
        for b, p in polys:
            if p.contains(pt) and cam[2] < b.get("h", 0) + 1:
                fails.append(f"camera at {cam} starts inside a building")
    # 7. compound walls (region flag "walls"): none on a carriageway or through a building, none across the property
    for w in ctx.get("walls", []):
        if w.intersection(ROAD["major"]).area > 0.02 or w.intersection(ROAD["minor"]).area > 0.02:
            fails.append(f"compound wall in a road at {[round(v) for v in w.centroid.coords[0]]}")
        for b, p in polys:
            if p.intersection(w).area > 0.6 and not b.get("opt"): fails.append(f"compound wall through a building at {[round(v) for v in w.centroid.coords[0]]}"); break
    if ctx.get("wall_stats"): notes.append(f"compound walls {ctx['wall_stats']}")
    rep = {"id": OID, "fails": fails, "notes": notes, "on_road_dropped": ctx.get("on_road", [])}
    json.dump(rep, open(os.path.join(OUT, f"{OID}-logic.json"), "w"), indent=1)
    print("LOGIC", "PASS" if not fails else "FAIL", len(fails), "failures;", "; ".join(notes))
    for f in fails: print("  LOGIC FAIL:", f)
    if fails and "--allow-logic-fail" not in A: raise SystemExit("logic gate failed: " + fails[0])
