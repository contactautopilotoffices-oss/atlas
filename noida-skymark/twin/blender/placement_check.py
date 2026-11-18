"""Placement check: the hard gate before export.

Lists
  * every pair of objects that intersect (BVH triangle overlap; furniture against furniture, and furniture against
    walls, glass, balustrades, columns, door leaves and frames, stairs),
  * every floor-standing object floating or sunk by more than 2 mm (ray casts from its lowest vertices onto the
    floor finish / rug / stair below; nothing below at all = "over a void"), and every ceiling fixture not touching
    the ceiling or soffit above it,
  * every stretch of a circulation route narrower than 1.2 m. Routes are derived from the plan: the free floor
    (room outlines minus walls, glass, columns, balustrades and furniture footprints) is searched for the widest
    path from the entry to every door; layout "circulation" polylines are measured too if the layout has them, and
    so are the passages the CAD labels ("4'3\" WIDE PASSAGE").
Writes <out>/<tenant>_placement.json. Nudges of up to 20 mm (the CAD tolerance) are applied and logged; anything
larger is reported, never moved, never hidden, never deleted.

Run on a built .blend:
  Blender -b <out>/<tenant>_geometry.blend --python placement_check.py -- --tenant volt --layout L.json --style S.json --out DIR [--no-nudge] [--save]
build_floor.py --stage geometry runs it automatically.
"""
import bpy, json, math, os, re, sys, time, heapq, argparse
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from twin_lib import Raster, norm_layout, load_style, pip, script_args

FURN = {"DESK", "SEAT", "TABLE", "PLANTER", "PLANT", "FIXTURE", "FEATURE"}
BARRIER = {"WALL", "GLASS", "RAILING", "COLUMN", "DOOR", "STAIR", "SKIRTING"}
TOL = 0.002; NUDGE_MAX = 0.020; MIN_ROUTE = 1.2
ROUTE_IGNORE = set()


def world_geom(o, cache):
    me = o.data
    if me.name not in cache:
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co)
        soft = {i for i, m in enumerate(me.materials) if m and m.get("twin_kind") == "leaf"}     # foliage is soft: it may brush a wall
        cache[me.name] = (co.reshape(-1, 3), [list(p.vertices) for p in me.polygons if p.material_index not in soft])
    co, polys = cache[me.name]; M = np.array(o.matrix_world, np.float32)
    w = co @ M[:3, :3].T + M[:3, 3]
    return w, polys

def footprint(o):
    """Oriented footprint (4 xy corners) of an object's local bounding box."""
    bb = [Vector(c) for c in o.bound_box]; x0 = min(c.x for c in bb); x1 = max(c.x for c in bb); y0 = min(c.y for c in bb); y1 = max(c.y for c in bb)
    mw = o.matrix_world
    return [tuple((mw @ Vector((x, y, 0)))[:2]) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]


# ------------------------------------------------------------------ plan rasters shared with make_cameras.py
def obstacle_raster(L, ras, res=0.05, furniture=True, objs=None):
    """Boolean grid (res metres) of everything a person cannot walk through, and the grid frame."""
    nx = int(ras.nx * ras.res / res); ny = int(ras.ny * ras.res / res)
    gx = ras.x0 + (np.arange(nx) + 0.5) * res; gy = ras.y0 + (np.arange(ny) + 0.5) * res; X, Y = np.meshgrid(gx, gy)
    fl = np.zeros(X.shape, bool)
    for f in L["floor"]:
        m = pip(X, Y, f["outer"])
        for h in f["holes"]: m &= ~pip(X, Y, h)
        fl |= m
    if L.get("atrium"): fl &= ~pip(X, Y, L["atrium"])
    O = ~fl
    def poly(p, grow=0.0, holes=()):
        xs = [q[0] for q in p]; ys = [q[1] for q in p]
        j0 = max(0, int((min(xs) - grow - ras.x0) / res) - 1); j1 = min(nx, int((max(xs) + grow - ras.x0) / res) + 2)
        i0 = max(0, int((min(ys) - grow - ras.y0) / res) - 1); i1 = min(ny, int((max(ys) + grow - ras.y0) / res) + 2)
        if j1 <= j0 or i1 <= i0: return
        m = pip(X[i0:i1, j0:j1], Y[i0:i1, j0:j1], p)
        for h in holes: m &= ~pip(X[i0:i1, j0:j1], Y[i0:i1, j0:j1], h)
        O[i0:i1, j0:j1] |= m
    def seg(x0, y0, x1, y1, half):
        ln = math.hypot(x1 - x0, y1 - y0)
        if ln < 1e-6: return
        ux, uy = (x1 - x0) / ln, (y1 - y0) / ln; nx_, ny_ = -uy * half, ux * half
        poly([(x0 + nx_, y0 + ny_), (x1 + nx_, y1 + ny_), (x1 - nx_, y1 - ny_), (x0 - nx_, y0 - ny_)])
    for w in L["walls"]: poly(w["outer"], 0.0, w.get("holes", []))
    for c in L["columns"]: poly(c)
    for g in L["glass"]: seg(g[0], g[1], g[2], g[3], 0.04)
    if L.get("atrium"):
        a = L["atrium"]
        for i in range(len(a)): seg(*a[i], *a[(i + 1) % len(a)], 0.05)
    names = np.full(X.shape, -1, np.int32); fps = []
    if furniture:
        for o in (objs or bpy.context.scene.objects):
            if o.type != "MESH" or o.get("twin_layer") not in FURN or o.get("wall_mounted"): continue
            if o.get("twin_layer") in ROUTE_IGNORE: continue     # style 'route_ignore_layers' (opt-in): e.g. chairs, which people move
            if o.get("twin_layer") == "FEATURE": continue
            fp = footprint(o); fps.append((o.name, fp)); poly(fp)
    return {"O": O, "X": X, "Y": Y, "res": res, "x0": ras.x0, "y0": ras.y0, "floor": fl, "fps": fps}

def dist_map(O, res, max_m=3.0):
    """Approximate Euclidean distance (m) from every cell to the nearest obstacle cell (octagonal metric)."""
    D = np.full(O.shape, np.inf, np.float32); D[O] = 0.0; cov = O.copy(); k = 0
    while k * res < max_m:
        k += 1
        g = cov.copy()
        g[1:, :] |= cov[:-1, :]; g[:-1, :] |= cov[1:, :]; g[:, 1:] |= cov[:, :-1]; g[:, :-1] |= cov[:, 1:]
        if k % 2 == 0:
            g[1:, 1:] |= cov[:-1, :-1]; g[:-1, :-1] |= cov[1:, 1:]; g[1:, :-1] |= cov[:-1, 1:]; g[:-1, 1:] |= cov[1:, :-1]
        new = g & ~cov; D[new] = k * res; cov = g
        if cov.all(): break
    D[np.isinf(D)] = max_m
    return D


# ------------------------------------------------------------------ checks
def overlaps(objs, nudge=True):
    cache = {}; geo = {}
    def G(o):
        if o.name not in geo:
            w, polys = world_geom(o, cache); used = sorted({i for p in polys for i in p}) or [0]
            geo[o.name] = (w, polys, w[used].min(0), w[used].max(0), None)
        return geo[o.name]
    def tree(o):
        w, polys, lo, hi, t = G(o)
        if t is None:
            used = sorted({i for p in polys for i in p}); remap = {v: k for k, v in enumerate(used)}
            t = BVHTree.FromPolygons([tuple(w[i]) for i in used], [[remap[i] for i in p] for p in polys], epsilon=0.0)
            geo[o.name] = (w[used] if used else w[:0], polys, lo, hi, t)
        return t
    cand = [o for o in objs if o.get("twin_layer") in FURN | BARRIER]
    for o in cand: G(o)
    cand.sort(key=lambda o: geo[o.name][2][0])
    pairs = []; active = []
    for o in cand:
        lo = geo[o.name][2]; active = [a for a in active if geo[a.name][3][0] >= lo[0]]
        for a in active:
            la, ha = geo[a.name][2], geo[a.name][3]; lb, hb = geo[o.name][2], geo[o.name][3]
            if (la > hb).any() or (lb > ha).any(): continue
            A, B = a.get("twin_layer"), o.get("twin_layer")
            if A not in FURN and B not in FURN: continue          # wall against wall: the shell's own joints
            if {A, B} == {"FEATURE", "WALL"} or {A, B} == {"FEATURE", "SKIRTING"}: continue    # wall cladding sits on its wall by design
            pairs.append((a, o))
        active.append(o)
    out, nudged = [], []
    for a, b in pairs:
        if not tree(a).overlap(tree(b)): continue
        depth, axis = penetration(geo[a.name][0], geo[b.name][0], a, b, tree(a), tree(b))
        if depth <= 0.001: continue                                  # touching, end to end (abutting desks): not an intersection
        mov = b if b.get("twin_layer") in FURN and (a.get("twin_layer") not in FURN or len(b.data.vertices) <= len(a.data.vertices)) else a
        if nudge and depth <= NUDGE_MAX and mov.get("twin_layer") in FURN:
            other = a if mov is b else b; ax = Vector(axis)
            if ax.length < 1e-6: ax = Vector((1, 0, 0))
            ax.normalize(); d = ax * (1.0 if mov is b else -1.0) * (depth + 0.001)
            mov.location += d; bpy.context.view_layer.update(); geo.pop(mov.name, None); G(mov)
            if not tree(a if mov is a else a).overlap(tree(b)):
                nudged.append({"object": mov.name, "by_m": [round(d.x, 4), round(d.y, 4)], "away_from": other.name}); continue
            mov.location -= d; bpy.context.view_layer.update(); geo.pop(mov.name, None); G(mov)
        out.append({"a": a.name, "b": b.name, "layers": f"{a.get('twin_layer')}x{b.get('twin_layer')}", "depth_m": round(depth, 3),
                    "where": [round(float(v), 2) for v in ((np.maximum(geo[a.name][2], geo[b.name][2]) + np.minimum(geo[a.name][3], geo[b.name][3])) / 2)[:2]],
                    "fixable_by_nudge": depth <= NUDGE_MAX})
    return out, nudged

def penetration(wa, wb, a, b, ta, tb):
    """How deep the two meshes really are inside each other: vertices of one that lie inside the other (behind the
    nearest surface, by its outward normal), measured to that surface. Returns (depth, push direction for b)."""
    lo = np.maximum(wa.min(0), wb.min(0)) - 0.01; hi = np.minimum(wa.max(0), wb.max(0)) + 0.01
    best = (0.0, (0.0, 0.0, 0.0))
    for verts, tree, sign in ((wb, ta, 1.0), (wa, tb, -1.0)):
        sel = verts[np.all((verts >= lo) & (verts <= hi), axis=1)]
        if len(sel) > 4000: sel = sel[:: len(sel) // 4000 + 1]
        for v in sel:
            loc, nrm, idx, d = tree.find_nearest(Vector(v))
            if loc is None or d is None: continue
            if (Vector(v) - loc).dot(nrm) < 0 and d > best[0]:
                n = nrm * sign; best = (float(d), (n.x, n.y, 0.0))
    return best

def support(objs, kinds):
    verts, polys, soft = [], [], []
    for o in objs:
        if o.type != "MESH" or o.get("twin_layer") not in kinds: continue
        mw = o.matrix_world; k = len(verts)
        verts += [mw @ v.co for v in o.data.vertices]; polys += [[k + i for i in p.vertices] for p in o.data.polygons]
        soft += [bool(o.get("soft"))] * len(o.data.polygons)
    return BVHTree.FromPolygons(verts, polys), soft

def floating(objs):
    bvh, soft = support(objs, ("FLOOR", "RUG", "STAIR")); top, _ = support([o for o in objs if o.get("static") or o.get("twin_layer") == "SLAB"], ("CEILING", "SLAB"))
    out = []; cache = {}
    for o in objs:
        L = o.get("twin_layer")
        if o.type != "MESH": continue
        if L in ("DESK", "SEAT", "TABLE", "PLANTER", "PLANT", "FIXTURE") and not o.get("wall_mounted"):
            me = o.data
            if me.name not in cache:
                zs = [v.co.z for v in me.vertices]; zmin = min(zs); low = [v.co.copy() for v in me.vertices if v.co.z < zmin + 0.004]
                cache[me.name] = low[::max(1, len(low) // 16)][:24]
            gaps = []; miss = 0; mw = o.matrix_world
            for p in cache[me.name]:
                w = mw @ p; h = bvh.ray_cast(Vector((w.x, w.y, w.z + 0.3)), Vector((0, 0, -1)), 1.5)
                if h[0] is None: miss += 1; continue
                g = w.z - h[0].z
                if soft[h[2]] and -0.0045 <= g <= TOL: g = 0.0         # feet pressed into a soft rug
                gaps.append(g)
            n = len(cache[me.name])
            if miss == n: out.append({"object": o.name, "layer": L, "problem": "nothing under it (over a void / outside the slab)", "at": [round(o.location.x, 2), round(o.location.y, 2)]}); continue
            if miss: out.append({"object": o.name, "layer": L, "problem": f"{miss} of {n} feet over a void", "at": [round(o.location.x, 2), round(o.location.y, 2)]})
            if gaps and min(gaps) > TOL: out.append({"object": o.name, "layer": L, "problem": "floating", "gap_m": round(min(gaps), 4), "at": [round(o.location.x, 2), round(o.location.y, 2)]})
            elif gaps and min(gaps) < -TOL: out.append({"object": o.name, "layer": L, "problem": "sunk", "gap_m": round(min(gaps), 4), "at": [round(o.location.x, 2), round(o.location.y, 2)]})
        elif L == "LIGHT":
            zs = [ (o.matrix_world @ v.co).z for v in o.data.vertices ]; zt = max(zs)
            h = top.ray_cast(Vector((o.location.x, o.location.y, zt - 0.05)), Vector((0, 0, 1)), 3.0)
            if h[0] is None: out.append({"object": o.name, "layer": L, "problem": "no ceiling above"}); continue
            g = h[0].z - zt
            if abs(g) > TOL: out.append({"object": o.name, "layer": L, "problem": "not touching the ceiling" if g > 0 else "into the ceiling", "gap_m": round(g, 4), "at": [round(o.location.x, 2), round(o.location.y, 2)]})
    return out

def parse_width(t):
    m = re.search(r"(\d+)\s*'\s*(\d+)?", t)
    if not m: return None
    return round((int(m.group(1)) * 12 + int(m.group(2) or 0)) * 0.0254, 3)

def routes(L, ras, meta, R, S_=None):
    S_ = S_ or {}
    O, res, x0, y0 = R["O"], R["res"], R["x0"], R["y0"]; D = dist_map(O, res); ny, nx = O.shape
    def cell(x, y): return int((y - y0) / res), int((x - x0) / res)
    def free_near(i, j, rad=12):
        best = None
        for di in range(-rad, rad + 1):
            for dj in range(-rad, rad + 1):
                a, b = i + di, j + dj
                if 0 <= a < ny and 0 <= b < nx and not O[a, b] and (best is None or di * di + dj * dj < best[0]): best = (di * di + dj * dj, a, b)
        return (best[1], best[2]) if best else None
    doors = [d for d in meta.get("doors", []) if d.get("opening")]
    if not doors: return [], [], {"routes": 0}
    # the entry: a door near a label saying ENTRY / LIFT / RECEPTION, else the door nearest the floor's first room named so
    lab = [l for l in L["labels"] if re.search(r"ENTRY|LIFT|RECEPTION", l["t"], re.I)]
    ref = (lab[0]["x"], lab[0]["y"]) if lab else (doors[0]["opening"][0], doors[0]["opening"][1])
    entry = min(doors, key=lambda d: math.hypot(d["opening"][0] - ref[0], d["opening"][1] - ref[1]))
    # door cells: walk through the opening, so stamp each doorway free (the leaf is drawn open beside it)
    Of = O.copy()
    for d in doors:
        ox, oy, oa, w = d["opening"]; ca, sa = math.cos(oa), math.sin(oa)
        for t in np.linspace(-0.35, 0.35, 15):
            for u in np.linspace(-w / 2 + 0.05, w / 2 - 0.05, 9):
                i, j = cell(ox + ca * u - sa * t, oy + sa * u + ca * t)
                if 0 <= i < ny and 0 <= j < nx and R["floor"][i, j]: Of[i, j] = False
    st = free_near(*cell(entry["opening"][0], entry["opening"][1]))
    if st is None: return [], [], {"routes": 0, "error": "entry not on free floor"}
    # widest-path Dijkstra on a 2-cell (10 cm) lattice: stepping costs more where clearance is under 0.9 m
    # (style 'route_clearance_penalty', default 6; RTP uses 40 so a route does not cut round a wall end, where the
    # clearance measured on the route is a few cm although the opening is wide)
    PEN = S_.get("route_clearance_penalty", 6)
    s = 2; INF = 1e18; dist = {}; prev = {}; pq = [(0.0, st)]; dist[st] = 0.0
    while pq:
        dcur, (i, j) = heapq.heappop(pq)
        if dcur > dist.get((i, j), INF): continue
        for di, dj in ((s, 0), (-s, 0), (0, s), (0, -s), (s, s), (s, -s), (-s, s), (-s, -s)):
            a, b = i + di, j + dj
            if not (0 <= a < ny and 0 <= b < nx) or Of[a, b] or Of[(i + a) // 2, (j + b) // 2]: continue
            c = math.hypot(di, dj) * res; cl = D[a, b]
            nd = dcur + c * (1 + PEN * max(0.0, (0.9 - cl) / 0.9))
            if nd < dist.get((a, b), INF): dist[(a, b)] = nd; prev[(a, b)] = (i, j); heapq.heappush(pq, (nd, (a, b)))
    door_cells = []
    for d in doors:
        ox, oy = d["opening"][0], d["opening"][1]; door_cells.append((ox, oy))
    narrow, unreached, paths = [], [], 0; seen = set(); allpath = []
    EXEMPT = re.compile(S_.get("route_exempt_rooms"), re.I) if S_.get("route_exempt_rooms") else None; exempt_n = [0]
    def near_door(x, y): return any(math.hypot(x - dx, y - dy) < 0.75 for dx, dy in door_cells)
    for d in doors:
        if d is entry: continue
        c = free_near(*cell(d["opening"][0], d["opening"][1]), 8)
        tgt = None
        if c:
            for di in range(-2, 3):
                for dj in range(-2, 3):
                    if (c[0] + di, c[1] + dj) in dist: tgt = (c[0] + di, c[1] + dj); break
                if tgt: break
        if tgt is None: unreached.append({"door": d["name"], "at": d["opening"][:2]}); continue
        path = [tgt]
        while path[-1] in prev: path.append(prev[path[-1]])
        paths += 1; run = []; allpath.extend(path)
        for (i, j) in path:
            x, y = x0 + (j + 0.5) * res, y0 + (i + 0.5) * res; wdt = 2 * float(D[i, j]) - res        # clear width between the obstacles' faces
            bad = wdt < MIN_ROUTE and not near_door(x, y)
            if bad and EXEMPT is not None:                   # style 'route_exempt_rooms' (opt-in): e.g. inside a toilet, not a walkway
                rr_ = ras.room_at(x, y)
                if rr_ and EXEMPT.search(rr_["name"]): exempt_n[0] += 1; bad = False
            if bad: run.append((x, y, wdt, i, j))
            if (not bad or (i, j) == path[-1]) and run:
                if len(run) * s * res >= 0.15:
                    key = (round(run[0][0], 1), round(run[0][1], 1))
                    if key not in seen:
                        seen.add(key); mn = min(run, key=lambda r: r[2]); rr = ras.room_at(mn[0], mn[1])
                        blockers = sorted({nm for nm, fp in R["fps"] if min(math.hypot(px - mn[0], py - mn[1]) for px, py in fp + [((fp[0][0] + fp[2][0]) / 2, (fp[0][1] + fp[2][1]) / 2)]) < mn[2] / 2 + 0.6})[:8]
                        narrow.append({"from": [round(run[0][0], 2), round(run[0][1], 2)], "to": [round(run[-1][0], 2), round(run[-1][1], 2)], "length_m": round(len(run) * s * res, 2),
                                       "min_width_m": round(mn[2], 2), "at": [round(mn[0], 2), round(mn[1], 2)], "room": rr["name"] if rr else None,
                                       "route_to_door": d["name"], "nearby_objects": blockers})
                run = []
    # a picture of it all, for people: grey = blocked, white = free floor, blue = routes, red = narrow, green = doors
    img = np.where(R["floor"][..., None], np.array([0.97, 0.97, 0.95]), np.array([0.25, 0.25, 0.27])).astype(np.float32)
    img[O & R["floor"]] = (0.55, 0.55, 0.55)
    for (i, j) in allpath: img[max(0, i - 1):i + 2, max(0, j - 1):j + 2] = (0.2, 0.45, 0.95)
    for n_ in narrow:
        i, j = cell(*n_["at"]); img[max(0, i - 4):i + 5, max(0, j - 4):j + 5] = (0.9, 0.1, 0.1)
    for d in doors:
        i, j = cell(d["opening"][0], d["opening"][1]); img[max(0, i - 3):i + 4, max(0, j - 3):j + 4] = (0.1, 0.75, 0.2) if d is not entry else (0.85, 0.1, 0.85)
    R["picture"] = img[::-1]
    passages = []
    for l in L["labels"]:
        if "PASSAGE" not in re.sub(r"\s+", "", l["t"].upper()): continue
        i, j = cell(l["x"], l["y"]); spans = []
        for (di, dj) in ((0, 1), (1, 0)):
            n1 = n2 = 0
            while 0 <= i + di * n1 < ny and 0 <= j + dj * n1 < nx and not O[i + di * n1, j + dj * n1] and n1 < 200: n1 += 1
            while 0 <= i - di * n2 < ny and 0 <= j - dj * n2 < nx and not O[i - di * n2, j - dj * n2] and n2 < 200: n2 += 1
            spans.append((n1 + n2 - 1) * res)
        wdt = min(spans); stated = parse_width(re.sub(r"\s+", "", l["t"]))
        passages.append({"label": re.sub(r"\s+", " ", l["t"]), "at": [l["x"], l["y"]], "stated_m": stated, "measured_clear_m": round(wdt, 2), "ok": wdt >= min(MIN_ROUTE, (stated or MIN_ROUTE) - 0.02)})
    circ = L.get("circulation") or []
    if isinstance(circ, dict): circ = circ.get("paths", []) or []      # a dict of walkway polygons (ARCIL schema): the derived routes cover it
    for c in circ:
        if not isinstance(c, (dict, list)): continue
        pts = c.get("path") if isinstance(c, dict) else c; mn = 9.0
        if not pts or not isinstance(pts[0], (list, tuple)) or len(pts[0]) != 2: continue
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            for t in np.linspace(0, 1, max(2, int(math.hypot(xb - xa, yb - ya) / 0.1))):
                i, j = cell(xa + (xb - xa) * t, ya + (yb - ya) * t)
                if 0 <= i < ny and 0 <= j < nx: mn = min(mn, 2 * float(D[i, j]) - res)
        passages.append({"label": c.get("name", "circulation") if isinstance(c, dict) else "circulation", "path": pts, "measured_clear_m": round(mn, 2), "ok": mn >= (c.get("min_width", MIN_ROUTE) if isinstance(c, dict) else MIN_ROUTE)})
    return narrow, passages, {"routes": paths, "entry_door": entry["name"], "unreachable_doors": unreached,
                              **({"exempt_rooms": S_.get("route_exempt_rooms"), "exempt_cells_under_1_2_m": exempt_n[0]} if EXEMPT is not None else {})}


def run(tenant, L, S, out, nudge=True, ras=None):
    global ROUTE_IGNORE; ROUTE_IGNORE = set(S.get("route_ignore_layers", []))
    t0 = time.time(); bpy.context.view_layer.update()
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.get("twin_layer")]
    meta = json.loads(bpy.context.scene.get("twin_meta", "{}"))
    ras = ras or Raster(L)
    ov, nudged = overlaps(objs, nudge); bpy.context.view_layer.update()
    fl = floating(objs)
    R = obstacle_raster(L, ras, 0.05, True, objs)
    narrow, passages, rinfo = routes(L, ras, meta, R, S)
    rep = {"tenant": tenant, "checked_objects": len(objs), "tolerance_m": TOL, "nudge_max_m": NUDGE_MAX, "min_route_width_m": MIN_ROUTE,
           "overlaps": ov, "floating_or_sunk": fl, "narrow_routes": narrow, "labelled_passages": passages, "routing": rinfo, "nudged": nudged,
           "summary": {"overlaps": len(ov), "floating_or_sunk": len(fl), "narrow_routes": len(narrow),
                       "passages_failing": sum(1 for p in passages if not p["ok"]), "nudged": len(nudged),
                       "overlaps_by_layers": {k: sum(1 for o in ov if o["layers"] == k) for k in sorted({o["layers"] for o in ov})}},
           "seconds": round(time.time() - t0, 1)}
    rep["ok"] = not ov and not fl and not narrow and not any(not p["ok"] for p in passages)
    path = os.path.join(out, f"{tenant}_placement.json"); json.dump(rep, open(path, "w"), indent=1)
    if "picture" in R:
        from twin_lib import write_png; write_png(os.path.join(out, f"{tenant}_circulation.png"), R["picture"])
    print(f"placement check: {rep['summary']}  ok={rep['ok']}  ({rep['seconds']} s) -> {path}", flush=True)
    return rep


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--tenant", required=True); ap.add_argument("--layout", required=True); ap.add_argument("--style", required=True)
    ap.add_argument("--out", required=True); ap.add_argument("--no-nudge", action="store_true"); ap.add_argument("--save", action="store_true")
    A = ap.parse_args(script_args())
    L = norm_layout(json.load(open(A.layout))); S = load_style(A.style)
    run(A.tenant, L, S, A.out, not A.no_nudge)
    if A.save: bpy.ops.wm.save_mainfile()
