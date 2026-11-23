"""Indicative plot massings for options whose pin does not sit on a plot-sized footprint.

  python scripts/world/plot_massing.py OUT_REFS.json SCENE.json:OPTION_ID[:SETBACK_M] ...

For each option, a rectangle with the floor plate of the client's workbook (built-up area per
floor, sq ft), standing at the pin. Its long side is set parallel to the nearest road edge, and
it sits back from that edge by SETBACK_M (default 9 m: Noida's front setback for plots of this
size is 9 m and more). The frontage-to-depth ratio is 1:1.3. The result is written in the
format scripts/world/diorama.py reads for a fixed option outline (refs/*.json, keyed by the
option id); diorama.py then removes the map footprints it overlaps.

This is a massing, not a survey: the pins in jindalx/build-data.cjs are indicative, so the
building's size and storeys are the workbook's, its position and orientation are not verified.
Each entry says so in "basis".
"""
import sys, json, math
import shapely
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union, nearest_points

OUT = sys.argv[1]
SQFT = 0.09290304
out = {"about": "Indicative plot massings for the JindalX options (scripts/world/plot_massing.py). Floor plate and storeys from the client's workbook (JindalX options.xlsx); position from the indicative pins in jindalx/build-data.cjs; orientation squared to the nearest Overture road. Not surveyed: confirm the plot with the landlord, then replace the outline."}
for arg in sys.argv[2:]:
    parts = arg.split(":"); scene_p, oid = parts[0], parts[1]; setback = float(parts[2]) if len(parts) > 2 else 9.0
    S = json.load(open(scene_p)); B = json.load(open(S["bundle"]))
    o = next(x for x in B["options"] if x["id"] == oid); so = next(x for x in S["options"] if x["id"] == oid)
    fact = {f["k"]: f["v"] for f in o["facts"]}
    plate_sqft = float(fact["BUA each floor, sqft"].split()[0].split("-")[-1].replace(",", "")) if fact["BUA each floor, sqft"][0].isdigit() else None
    if plate_sqft is None:   # "G,1,2- 18000 3,4- 8000": the lower (largest) plate
        plate_sqft = max(float(t) for t in fact["BUA each floor, sqft"].replace("-", " ").split() if t.replace(".", "").isdigit() and float(t) > 1000)
    area = plate_sqft * SQFT; front = math.sqrt(area / 1.3); depth = area / front
    pin = Point(so["x"], so["y"])
    roads = unary_union([Polygon(r[0], r[1:]).buffer(0) for k in ("major", "minor") for r in S["roads"][k]
                         if Polygon(r[0]).distance(pin) < 250])
    # the road edge nearest the pin, and its direction
    edge = roads.boundary; q = nearest_points(edge, pin)[0]
    segs = [LineString(c) for g in (edge.geoms if hasattr(edge, "geoms") else [edge]) for c in zip(g.coords, list(g.coords)[1:])]
    seg = min(segs, key=lambda s: s.distance(q)); (ax, ay), (bx, by) = seg.coords
    ux, uy = (bx - ax), (by - ay); n = math.hypot(ux, uy); ux, uy = ux / n, uy / n
    nx, ny = -uy, ux   # normal; point it from the road towards the pin
    if (pin.x - q.x) * nx + (pin.y - q.y) * ny < 0: nx, ny = -nx, -ny
    if roads.contains(pin): pin = Point(q.x + nx * 1, q.y + ny * 1)
    # along the road: centred on the pin's foot; across: front face at the setback
    t0 = (pin.x - q.x) * ux + (pin.y - q.y) * uy
    def place(t, fr, dp, sb):
        cx, cy = q.x + ux * t + nx * (sb + dp / 2), q.y + uy * t + ny * (sb + dp / 2)
        return cx, cy, [(cx + ux * a * fr / 2 + nx * b * dp / 2, cy + uy * a * fr / 2 + ny * b * dp / 2) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    # the position nearest the pin that clears every road by `clear` metres: first the frontage on the nearest
    # road at the setback, sliding along it; failing that, any centre within 90 m, squared to the same road
    clear = 3.0
    shapely.prepare(roads)
    # mapped buildings near the pin: covering them costs 1 m of distance per 40 m2, so a new building
    # (Magnus Towers, handover December 2026) prefers the empty plot the older map data shows
    built = unary_union([Polygon(b["p"]).buffer(0) for b in S["buildings"] if Polygon(b["p"]).distance(pin) < 200])
    cost = lambda cs, d: d + Polygon(cs).intersection(built).area / 40
    def rect(cx, cy, fr, dp): return [(cx + ux * a * fr / 2 + nx * b * dp / 2, cy + uy * a * fr / 2 + ny * b * dp / 2) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    best = None
    for sb in (setback, 6.0):
        for fr, dp in ((front, depth), (depth, front)):
            for dt in range(-60, 61, 3):
                cx_, cy_, cs = place(t0 + dt, fr, dp, sb)
                if Polygon(cs).buffer(clear).intersects(roads): continue
                d = cost(cs, math.hypot(cx_ - pin.x, cy_ - pin.y))
                if best is None or d < best[0]: best = (d, cx_, cy_, cs, fr, dp, sb)
    if best is None:
        for fr, dp in ((front, depth), (depth, front)):
            for i in range(-30, 31):
                for j in range(-30, 31):
                    cx_, cy_ = pin.x + ux * i * 3 + nx * j * 3, pin.y + uy * i * 3 + ny * j * 3
                    if math.hypot(cx_ - pin.x, cy_ - pin.y) > 90: continue
                    cs = rect(cx_, cy_, fr, dp); d = cost(cs, math.hypot(cx_ - pin.x, cy_ - pin.y))
                    if best and d >= best[0]: continue
                    if not Polygon(cs).buffer(clear).intersects(roads): best = (d, cx_, cy_, cs, fr, dp, None)
    _, cx, cy, corners, front, depth, setback = best
    if setback is None: setback = Polygon(corners).distance(roads)
    poly = Polygon(corners)
    if poly.intersects(roads): print(f"  {oid}: massing touches a road ({poly.intersection(roads).area:.0f} m2); check the overlay")
    floors = 1 + int(fact["Total floors"].split("+")[-1]); h = round(S.get("ground_h", 5.6) + (floors - 1) * S.get("floor_h", 4.1) + 1.2, 1)
    shift = math.hypot(cx - so["x"], cy - so["y"])
    out[oid] = {"poly": [[round(x, 1), round(y, 1)] for x, y in corners], "h": h, "scene_origin": S["origin"],
                "basis": f"Indicative plot massing, not surveyed. {front:.1f} m frontage x {depth:.1f} m deep = {area:.0f} m2, the workbook's {plate_sqft:.0f} sq ft a floor; "
                         f"{floors} storeys above ground ({fact['Building structure']}). Squared to the nearest road edge and set back {setback:.0f} m from it; "
                         f"its centre is {shift:.0f} m from the indicative pin. Replace with the landlord's plot outline."}
    print(f"  {oid}: {front:.1f} x {depth:.1f} m, {area:.0f} m2, h {h} m, {shift:.0f} m from pin, road bearing {math.degrees(math.atan2(ux, uy)) % 180:.0f} deg")
json.dump(out, open(OUT, "w"), indent=1)
