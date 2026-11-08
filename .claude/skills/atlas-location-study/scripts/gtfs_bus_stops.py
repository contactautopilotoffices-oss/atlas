"""Bus stops near every option, from a GTFS feed, written into study.json.

    python3 -I gtfs_bus_stops.py study.json path/to/gtfs \
        --credit "MTC bus stops: ChennaiGTFS (Apr 2026), ODbL" \
        --src https://github.com/ungalsoththu/ChennaiGTFS --as-of "Apr 2026"

The GTFS folder holds stops.txt, routes.txt, trips.txt and stop_times.txt.
Some feeds prefix them (mtc_stops.txt); pass --prefix mtc_ for those.

What it does, and why:
  * keeps stops within --radius km (default 1.5) of an option or today's
    office, so the page carries a few dozen stops, not the whole city;
  * merges the two sides of a road (same name within 250 m) into one stop,
    because riders think of them as one;
  * counts distinct route numbers per stop, folding short-trip and return
    variants ("102 CT1", "102CT11", "102 R") into "102", so "about 12
    routes" is not inflated by timetable bookkeeping.
Prints the nearest two stops for every option so you can sanity-check them
against a map before shipping.
"""
import argparse, csv, json, math, os, re
from collections import defaultdict

ap = argparse.ArgumentParser()
ap.add_argument("study"); ap.add_argument("gtfs")
ap.add_argument("--prefix", default=""); ap.add_argument("--radius", type=float, default=1.5)
ap.add_argument("--credit", required=True); ap.add_argument("--src", required=True); ap.add_argument("--as-of", default="")
a = ap.parse_args()

def km(p, q):
    t = math.pi / 180
    dl, dg = (q[0] - p[0]) * t, (q[1] - p[1]) * t
    s = math.sin(dl / 2) ** 2 + math.cos(p[0] * t) * math.cos(q[0] * t) * math.sin(dg / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(s))

def rows(name):
    path = os.path.join(a.gtfs, a.prefix + name)
    with open(path, encoding="utf-8-sig") as f:
        yield from csv.DictReader(f)

study = json.load(open(a.study, encoding="utf-8"))
pts = [(o["lat"], o["lng"], o["id"]) for o in study["options"]]
if study.get("existing"):
    e = study["existing"]; pts.append((e["lat"], e["lng"], e.get("id", "existing")))

stops = {r["stop_id"]: r for r in rows("stops.txt") if r.get("stop_lat") and r.get("stop_lon")}
near = {sid: s for sid, s in stops.items()
        if any(km((float(s["stop_lat"]), float(s["stop_lon"])), p[:2]) <= a.radius for p in pts)}

def base(n):
    t = (n or "").upper().split()
    return (re.sub(r"CT\d*$", "", t[0]) or t[0]) if t else ""

route_name = {r["route_id"]: base(r.get("route_short_name") or r.get("route_long_name")) for r in rows("routes.txt")}
trip_route = {r["trip_id"]: r["route_id"] for r in rows("trips.txt")}
routes = defaultdict(set)
for r in rows("stop_times.txt"):
    if r["stop_id"] in near:
        rid = trip_route.get(r["trip_id"])
        if rid: routes[r["stop_id"]].add(route_name.get(rid) or rid)

merged = []
for sid, s in sorted(near.items(), key=lambda kv: kv[1]["stop_name"]):
    p = (float(s["stop_lat"]), float(s["stop_lon"]))
    name = " ".join(s["stop_name"].split())
    m = next((m for m in merged if m["name"].lower() == name.lower() and km(m["pts"][0], p) <= .25), None)
    if m: m["routes"] |= routes[sid]; m["pts"].append(p)
    else: merged.append({"name": name, "pts": [p], "routes": set(routes[sid])})

out = []
for m in merged:
    lat = sum(p[0] for p in m["pts"]) / len(m["pts"]); lng = sum(p[1] for p in m["pts"]) / len(m["pts"])
    out.append([m["name"], round(lat, 5), round(lng, 5), len(m["routes"])])
out.sort(key=lambda x: (x[1], x[2]))

study["bus"] = {"src": a.src, "credit": a.credit, "asOf": a.as_of, "stops": out}
json.dump(study, open(a.study, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(near)} raw stops within {a.radius} km, {len(out)} after merging, {sum(1 for x in out if not x[3])} with no route")
for lat, lng, pid in pts:
    best = sorted((km((x[1], x[2]), (lat, lng)), x) for x in out)[:2]
    print(pid.ljust(26), " | ".join(f"{x[0]} {d * 1000:.0f} m ({x[3]} routes)" for d, x in best) or "no stop in range")
