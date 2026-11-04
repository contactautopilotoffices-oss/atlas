"""One building's diorama: a dollhouse slab of Andheri East, built in Blender.

  python scripts/world/diorama.py SCENE.json WORLD.json TEX_DIR OPTION_ID OUT_DIR [--glb] [--render hero street station ...] [--fast]

For one option it cuts a rounded slab of the district around the building
and its nearest metro station and builds it at close-up quality:

  the building   real geometry from the deck's floors: curtain wall with
                 mullions and slab edges (grade A) or banded plaster with
                 chajjas (grade B), a double-height lobby, an entrance
                 canopy facing the street with the building's name, a crown
                 and rooftop plant
  the metro      Line 1 and Line 7 as Mumbai builds them: elliptical piers
                 with hammerhead caps, a U-girder deck with parapets, two
                 tracks, overhead wire masts, and each station as a
                 concourse spanning the road, platforms under a barrel roof,
                 glass screens, stair towers to the footpath and name
                 boards; Line 3 (underground) as its street entrances
  the street     asphalt with lane markings, raised footpaths with kerbs,
                 grass, nalas, and every footprint around it extruded with
                 a facade texture at true scale, shopfronts where it meets
                 the road, parapets, water tanks and stair cabins
  the plinth     the slab's cut edge, in soil, which is what makes it read
                 as a dollhouse

Trees, street lamps, cars and the train are exported once as prototypes
(proto_*) and placed by the page from <id>.json, which also carries the
building, the routes, the walk start and the stations in the diorama's own
metres (origin at the slab's centre, x east, y north).

--render writes Cycles stills: hero (the dollhouse from above), street (from
the footpath at eye height, verticals kept straight) and station.
"""
import sys, os, json, math, random
import numpy as np
import bpy, bmesh
import shapely
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box
from shapely.ops import unary_union

A = sys.argv[1:]
SCENE, WORLD, TEX, OID, OUT = A[:5]
bpy.ops.wm.read_factory_settings(use_empty=True)
FAST = "--fast" in A
os.makedirs(OUT, exist_ok=True)
S = json.load(open(SCENE)); WJ = json.load(open(WORLD))
BUNDLE = json.load(open("examples/flipkart-andheri.bundle.json"))
BO = next(o for o in BUNDLE["options"] if o["id"] == OID)
FACT = {f["k"]: f["v"] for f in BO["facts"]}
SO = next(o for o in S["options"] if o["id"] == OID)
OPTB = next(b for b in S["buildings"] if b.get("opt") == OID)
rnd = random.Random(OID)

# ------------------------------------------------------------ the slab ----
foot = Polygon(OPTB["p"]); fc = foot.centroid
metro_r = next((r for r in SO["routes"] if r["kind"] == "metro"), None)
pts = [fc.coords[0]] + ([tuple(metro_r["path"][-1])] if metro_r else [])
bx = shapely.MultiPoint(pts).envelope.buffer(170, join_style="mitre")
minx, miny, maxx, maxy = bx.bounds
w, h = max(760, maxx - minx), max(760, maxy - miny)
cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
w, h = min(w, 1500), min(h, 1500)
SLAB = box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2).buffer(-60).buffer(60, quad_segs=12)
OX, OY = cx, cy
def L(x, y): return (x - OX, y - OY)
def lpoly(g): return shapely.transform(g, lambda c: c - np.array([OX, OY]))
SL = lpoly(SLAB)
print(f"{OID}: slab {w:.0f} x {h:.0f} m")

# --------------------------------------------------------- mesh builder ----
class MB:
    def __init__(s, mats): s.V, s.P, s.UV, s.M, s.mats = [], [], [], [], list(mats)
    def mi(s, m):
        if m not in s.mats: s.mats.append(m)
        return s.mats.index(m)
    def poly(s, pts3, uvs, m):
        b = len(s.V); s.V.extend(pts3); s.P.append(len(pts3)); s.UV.extend(uvs); s.M.append(s.mi(m))
    def quad(s, a, b, c, d, uva, m): s.poly([a, b, c, d], uva, m)
    def build(s, name, MATS):
        if not s.P: return None
        me = bpy.data.meshes.new(name); V = np.asarray(s.V, np.float32)
        me.vertices.add(len(V)); me.vertices.foreach_set("co", V.ravel())
        n = np.asarray(s.P, np.int32); starts = np.concatenate([[0], np.cumsum(n)[:-1]]).astype(np.int32)
        me.loops.add(int(n.sum())); me.loops.foreach_set("vertex_index", np.arange(int(n.sum()), dtype=np.int32))
        me.polygons.add(len(n)); me.polygons.foreach_set("loop_start", starts)
        me.update(calc_edges=True)
        uvl = me.uv_layers.new(name="UVMap"); uvl.data.foreach_set("uv", np.asarray(s.UV, np.float32).ravel())
        me.polygons.foreach_set("material_index", np.asarray(s.M, np.int32))
        for m in s.mats: me.materials.append(MATS[m])
        me.validate(); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob

def flat(mb, g, z, m, uvk=4.0, up=True):
    """Triangulate polygons (with holes) at height z; world-scale UVs."""
    if g is None or g.is_empty: return
    geoms = [p for p in (g.geoms if hasattr(g, "geoms") else [g]) if p.geom_type == "Polygon" and p.area > 0.5]
    if not geoms: return
    def tris(gs):
        try: return list(shapely.constrained_delaunay_triangles(np.array(gs, dtype=object)))
        except Exception:
            out = []
            for g1 in gs:   # one at a time, then cleaned, then skipped
                for cand in (g1, g1.buffer(0.01).buffer(-0.01).simplify(0.05)):
                    try: out.append(shapely.constrained_delaunay_triangles(cand)); break
                    except Exception: continue
            return out
    for gc in tris(geoms):
        for t in getattr(gc, "geoms", []):
            c = np.asarray(t.exterior.coords)[:3]
            ar = (c[1, 0] - c[0, 0]) * (c[2, 1] - c[0, 1]) - (c[2, 0] - c[0, 0]) * (c[1, 1] - c[0, 1])
            if abs(ar) < 1e-6: continue
            if (ar < 0) == up: c = c[::-1]
            mb.poly([(x, y, z) for x, y in c], [(x / uvk, y / uvk) for x, y in c], m)

def walls(mb, ring, z0, z1, m, mw=4.0, mh=4.0, v0=0.0, s0=0.0, outward=True):
    """A ring of walls from z0 to z1, UV in true metres / module size."""
    r = list(ring)
    if r[0] == r[-1]: r = r[:-1]
    if Polygon(r).exterior.is_ccw != outward: r = r[::-1]
    s = s0
    for i in range(len(r)):
        (ax, ay), (bx_, by) = r[i], r[(i + 1) % len(r)]; d = math.hypot(bx_ - ax, by - ay)
        if d < 0.05: continue
        mb.quad((ax, ay, z0), (bx_, by, z0), (bx_, by, z1), (ax, ay, z1),
                [(s / mw, (z0 - v0) / mh), ((s + d) / mw, (z0 - v0) / mh), ((s + d) / mw, (z1 - v0) / mh), (s / mw, (z1 - v0) / mh)], m)
        s += d
    return s

def boxm(mb, cx_, cy_, z0, z1, lx, ly, ang, m, uvk=2.0, top=True, bottom=False):
    ca, sa = math.cos(ang), math.sin(ang)
    P = [(cx_ + dx * ca - dy * sa, cy_ + dx * sa + dy * ca) for dx, dy in ((-lx / 2, -ly / 2), (lx / 2, -ly / 2), (lx / 2, ly / 2), (-lx / 2, ly / 2))]
    walls(mb, P + [P[0]], z0, z1, m, uvk, uvk)
    if top: flat(mb, Polygon(P), z1, m, uvk)
    if bottom: flat(mb, Polygon(P), z0, m, uvk, up=False)

def cyl(mb, cx_, cy_, z0, z1, rx, ry, ang, m, seg=20, cap=True):
    ca, sa = math.cos(ang), math.sin(ang)
    P = [(cx_ + rx * math.cos(t) * ca - ry * math.sin(t) * sa, cy_ + rx * math.cos(t) * sa + ry * math.sin(t) * ca) for t in np.linspace(0, math.tau, seg, endpoint=False)]
    walls(mb, P + [P[0]], z0, z1, m, 3, 3)
    if cap: flat(mb, Polygon(P), z1, m)

def sweep(mb, line, prof, m, uvk=6.0, closed=True):
    """Sweep a 2D profile [(n, z), ...] along a polyline of (x, y)."""
    P = np.asarray(line, float)
    if len(P) < 2: return
    d = np.diff(P, axis=0); dl = np.linalg.norm(d, axis=1); d /= dl[:, None] + 1e-9
    t = np.vstack([d[:1], (d[:-1] + d[1:]) / 2, d[-1:]]); t /= np.linalg.norm(t, axis=1)[:, None] + 1e-9
    nrm = np.c_[-t[:, 1], t[:, 0]]
    S_ = np.concatenate([[0], np.cumsum(dl)])
    rings = [[(P[i, 0] + nrm[i, 0] * n, P[i, 1] + nrm[i, 1] * n, z) for n, z in prof] for i in range(len(P))]
    pl = [0]
    for k in range(1, len(prof)): pl.append(pl[-1] + math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]))
    K = len(prof) if closed else len(prof) - 1
    for i in range(len(P) - 1):
        for k in range(K):
            k1 = (k + 1) % len(prof)
            a, b, c, e = rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]
            v0, v1 = pl[k] / uvk, (pl[k] + math.hypot(prof[k1][0] - prof[k][0], prof[k1][1] - prof[k][1])) / uvk
            mb.quad(a, b, c, e, [(S_[i] / uvk, v0), (S_[i] / uvk, v1), (S_[i + 1] / uvk, v1), (S_[i + 1] / uvk, v0)], m)

def text_mesh(txt, size, extrude, name):
    cu = bpy.data.curves.new(name, "FONT"); cu.body = txt; cu.size = size; cu.extrude = extrude; cu.align_x = "CENTER"; cu.align_y = "CENTER"
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob); o2 = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o2); return o2

# -------------------------------------------------------------- materials ----
def hexc(h, k=1.0): h = h.lstrip("#"); return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) * k for i in (0, 2, 4)) + (1,)
MATS = {}
def mat(name, col="#808080", rough=0.8, metal=0.0, tex=None, rtex=None, glass=False, emit=None, ek=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hexc(col); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if tex:
        im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(os.path.join(TEX, tex)); nt.links.new(im.outputs[0], b.inputs["Base Color"])
    if rtex:
        im2 = nt.nodes.new("ShaderNodeTexImage"); im2.image = bpy.data.images.load(os.path.join(TEX, rtex)); im2.image.colorspace_settings.name = "Non-Color"
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 0.05; mr.inputs["To Max"].default_value = 0.92
        nt.links.new(im2.outputs[0], mr.inputs[0]); nt.links.new(mr.outputs[0], b.inputs["Roughness"])
        if glass:   # the dark (glass) parts of a facade reflect
            inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "LESS_THAN"; inv.inputs[1].default_value = 0.4; nt.links.new(im2.outputs[0], inv.inputs[0]); nt.links.new(inv.outputs[0], b.inputs["Metallic"])
    if emit: b.inputs["Emission Color"].default_value = hexc(emit); b.inputs["Emission Strength"].default_value = ek
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    MATS[name] = m; return m

WALL_STYLES = ["res_cream", "res_peach", "res_grey", "res_ochre"]
MOD = {"res_cream": (6, 12), "res_peach": (6, 12), "res_grey": (6, 12), "res_ochre": (6, 12), "res_tower": (6, 12), "com_ribbon": (8, 16), "com_glass": (6, 16),
       "shop": (6, 4.5), "chawl": (4, 3), "opt_glass": (6, 16.4), "opt_plaster": (6, 16.4)}
for k in MOD: mat("wall_" + k, tex=k + ".jpg", rtex=k + "_r.jpg", glass=k in ("com_glass", "opt_glass", "com_ribbon", "opt_plaster", "res_tower"))
mat("roof", tex="roof.jpg", rough=0.9); mat("roof_tin", "#8f8f8a", 0.45, 0.6); mat("roof_tarp", "#2f63a8", 0.6); mat("roof_tin_rust", "#7a5b45", 0.7, 0.3)
mat("parapet", "#cfc8b8", 0.9); mat("ground", "#a29c8f", 0.95, tex="roof.jpg"); mat("asphalt", tex="asphalt.jpg", rough=0.85); mat("pavers", tex="pavers.jpg", rough=0.9)
mat("kerb", "#bdb8ab", 0.85); mat("grass", tex="grass.jpg", rough=0.95); mat("water", "#3d5257", 0.05, 0.1); mat("marking", "#efefe8", 0.6)
mat("soil", tex="soil.jpg", rough=1.0); mat("concrete", "#c9c5bb", 0.75); mat("concrete_dark", "#9f9b92", 0.8); mat("metal", "#a9adb1", 0.35, 0.9)
mat("station_roof", "#d9dde0", 0.3, 0.85); mat("station_glass", "#8fb4c4", 0.05, 0.2, alpha=0.35); mat("sign_l1", "#1c5fa8", 0.4); mat("sign_l3", "#1d8a8a", 0.4)
mat("sign_text", "#ffffff", 0.4, emit="#ffffff", ek=0.6); mat("rail", "#6f6a64", 0.4, 0.9); mat("tank", "#1d1f22", 0.5)
mat("mullion", "#c4c9cc", 0.3, 0.9); mat("slab_edge", "#e6e3dc", 0.6); mat("glass_lobby", "#6e8a96", 0.03, 0.6); mat("canopy", "#2b2e31", 0.4, 0.6)
mat("opt_name", "#f2f0ea", 0.3, 0.6, emit="#fff4de", ek=0.4); mat("wire", "#3a3a3a", 0.5, 0.8); mat("ballast", "#7d7568", 0.95)

# --- ground kept clear for the metro: the map's footprints include Line 1's stations and viaduct as plain
# buildings, which extrude into tall solid blocks right where the station structure has to stand ---
def _metro_clear():
    zs = []
    for key in ("L1",):
        lines = [LineString(l) for l in S["metro"].get(key, {}).get("lines", [])]
        zs += [l.buffer(5.5, cap_style=2) for l in lines]
        for s in S["stations"]:
            if s["line"] != key or not lines: continue
            pt = Point(s["x"], s["y"]); l = min(lines, key=lambda l: l.distance(pt))
            if l.distance(pt) > 80: continue
            t0 = l.project(pt)
            seg = LineString([l.interpolate(max(0, t0 - 75)), l.interpolate(min(l.length, t0 + 75))])
            zs.append(seg.buffer(17, cap_style=2))
            for e in (-52, 52):                       # the stairs down to each footpath
                q = l.interpolate(min(l.length, max(0, t0 + e))); zs.append(q.buffer(22))
    return unary_union(zs) if zs else Polygon()
METRO_CLEAR = _metro_clear()
def blocks_metro(p):
    if METRO_CLEAR.is_empty: return False
    i = p.intersection(METRO_CLEAR).area
    return i > 40 or i > 0.25 * p.area

# -------------------------------------------------------------- the build ----
def build():
    sc = bpy.context.scene
    ROAD = {k: unary_union([Polygon(r[0], r[1:]).buffer(0) for r in S["roads"][k]]) if S["roads"][k] else Polygon() for k in ("major", "minor", "foot")}
    clipw = SLAB.buffer(2)
    road_all = unary_union([ROAD["major"], ROAD["minor"]]).intersection(SLAB)
    bpolys = []
    for b in S["buildings"]:
        p = Polygon(b["p"])
        if not p.is_valid: p = p.buffer(0)
        if b.get("opt") != OID and blocks_metro(p): continue   # the map draws the station and viaduct as a building; we build the real thing there
        if SLAB.contains(p.centroid): bpolys.append((b, p.intersection(SLAB)))
    built = unary_union([p for _, p in bpolys]) if bpolys else Polygon()

    # --- plinth: the cut edge and the ground ---
    pl = MB([]); ring = list(SL.exterior.coords)
    walls(pl, ring, -14, 0.0, "soil", 8, 8); flat(pl, SL, -14, "soil", 8, up=False)
    pl.build("plinth", MATS)
    gr = MB([])
    flat(gr, SL, 0.0, "ground", 6)
    for k, m, z in (("green", "grass", 0.03), ("water", "water", 0.02)):
        g = unary_union([Polygon(r[0], r[1:]).buffer(0) for r in (S["land"].get(k) or [])]) if S["land"].get(k) else None
        if g is not None: flat(gr, lpoly(g.intersection(SLAB).difference(built)), z, m, 6)
    flat(gr, lpoly(road_all), 0.06, "asphalt", 6)
    foot_ring = road_all.buffer(2.6).difference(road_all).difference(built.buffer(0.3)).intersection(SLAB)
    flat(gr, lpoly(foot_ring), 0.2, "pavers", 2)
    for p in (foot_ring.geoms if hasattr(foot_ring, "geoms") else [foot_ring]):
        if p.geom_type == "Polygon":
            for ir in [p.exterior] + list(p.interiors): walls(gr, [L(x, y) for x, y in ir.coords], 0.06, 0.2, "kerb", 2, 2, outward=False)
    # lane markings on the main roads
    for t in WJ["traffic"]:
        ls = LineString(t["p"]).intersection(SLAB.buffer(-3))
        for l in (ls.geoms if hasattr(ls, "geoms") else [ls]):
            if l.geom_type != "LineString" or l.length < 10: continue
            for s0 in np.arange(2, l.length - 3, 9):
                a, b2 = l.interpolate(s0), l.interpolate(min(l.length, s0 + 3)); dx, dy = b2.x - a.x, b2.y - a.y; n = math.hypot(dx, dy) or 1
                nx, ny = -dy / n * 0.08, dx / n * 0.08
                A_, B_ = L(a.x, a.y), L(b2.x, b2.y)
                gr.quad((A_[0] + nx, A_[1] + ny, 0.075), (A_[0] - nx, A_[1] - ny, 0.075), (B_[0] - nx, B_[1] - ny, 0.075), (B_[0] + nx, B_[1] + ny, 0.075), [(0, 0)] * 4, "marking")
    if S.get("rail"):
        rg = unary_union([Polygon(r[0], r[1:]).buffer(0) for r in S["rail"]]).intersection(SLAB)
        flat(gr, lpoly(rg), 0.1, "ballast", 3)
    gr.build("ground", MATS)

    # --- the buildings around it ---
    ctx = MB([]); props = MB([])
    road_near = unary_union([ROAD["major"], ROAD["minor"]]).buffer(6)
    for b, p in bpolys:
        if b.get("opt") == OID: continue
        for q in (p.geoms if hasattr(p, "geoms") else [p]):
            if q.geom_type != "Polygon" or q.area < 8: continue
            q = q.simplify(0.15); hgt = b["h"]; a = q.area; r_ = random.Random(b["r"])
            ring = [L(x, y) for x, y in q.exterior.coords]
            if a < 70: style = "chawl"
            elif hgt > 45: style = "res_tower" if r_.random() < 0.6 else "com_glass"
            elif b["c"] in ("commercial", "office", "retail") or (a > 1500 and r_.random() < 0.5): style = "com_ribbon"
            else: style = WALL_STYLES[int(b["r"] * 997) % len(WALL_STYLES)]
            mw, mh = MOD[style]
            shop = a > 80 and hgt > 7 and road_near.intersects(q) and style != "chawl"
            z_shop = 4.5 if shop else 0.0
            if shop: walls(ctx, ring, 0, 4.5, "wall_shop", *MOD["shop"])
            walls(ctx, ring, z_shop, hgt, "wall_" + style, mw, mh, v0=z_shop)
            # roof and parapet
            inner = q.buffer(-0.25)
            if a > 60 and hgt > 6 and not inner.is_empty and inner.geom_type == "Polygon":
                walls(ctx, ring, hgt, hgt + 1.0, "parapet", 2, 2)
                walls(ctx, [L(x, y) for x, y in inner.exterior.coords], hgt + 0.15, hgt + 1.0, "parapet", 2, 2, outward=False)
                flat(ctx, lpoly(q.difference(inner)), hgt + 1.0, "parapet", 2)
                flat(ctx, lpoly(inner), hgt + 0.15, "roof", 5)
                if hgt > 14 and a > 200:   # stair cabin
                    c = inner.representative_point(); boxm(props, *L(c.x, c.y), hgt + 0.15, hgt + 3.2, 4.2, 3.6, 0.0, "parapet")
                if 120 < a < 3000 and hgt < 50:
                    for _ in range(1 + int(r_.random() * 3)):
                        c = inner.representative_point(); tx, ty = c.x + r_.uniform(-4, 4), c.y + r_.uniform(-4, 4)
                        if inner.contains(Point(tx, ty)): cyl(props, *L(tx, ty), hgt + 0.15, hgt + 1.8 + r_.random() * 0.6, 0.75, 0.75, 0, "tank", 16)
            else:
                m = "roof_tarp" if r_.random() < 0.35 else "roof_tin_rust" if r_.random() < 0.4 else "roof_tin"
                flat(ctx, lpoly(q), hgt, m, 3)
    ctx.build("context", MATS); props.build("rooftops", MATS)

    # --- the option itself ---
    ob = MB([]); q = Polygon(OPTB["p"]).simplify(0.2); ring = [L(x, y) for x, y in q.exterior.coords]
    floors = 1 + int(''.join(ch for ch in FACT.get("Total floors", "G+9").split("+")[-1] if ch.isdigit()) or 9)
    grade = FACT.get("Grade", "B"); glassy = grade.startswith("A") or grade == "B+"
    FH, GH = 4.1, 5.6; H = GH + (floors - 1) * FH
    style = "opt_glass" if glassy else "opt_plaster"
    walls(ob, ring, 0, GH, "glass_lobby", 3, GH)
    walls(ob, ring, GH, H, "wall_" + style, *MOD[style], v0=GH)
    # slab edges at every floor, and chajjas on plaster buildings
    for k in range(floors):
        z = GH + k * FH if k else GH
        out = q.buffer(0.28 if glassy else 0.6, join_style="mitre")
        walls(ob, [L(x, y) for x, y in out.exterior.coords], z - 0.42, z, "slab_edge", 2, 2)
        flat(ob, lpoly(out.difference(q)), z, "slab_edge", 2); flat(ob, lpoly(out.difference(q)), z - 0.42, "slab_edge", 2, up=False)
    # mullions: fins every 1.5 m along each face
    if glassy:
        r = ring[:-1] if ring[0] == ring[-1] else ring
        if not Polygon(r).exterior.is_ccw: r = r[::-1]
        for i in range(len(r)):
            (ax, ay), (bx_, by) = r[i], r[(i + 1) % len(r)]; d = math.hypot(bx_ - ax, by - ay); ang = math.atan2(by - ay, bx_ - ax)
            nx, ny = math.sin(ang), -math.cos(ang)
            for s_ in np.arange(0.75, d, 1.5):
                px, py = ax + (bx_ - ax) * s_ / d + nx * 0.16, ay + (by - ay) * s_ / d + ny * 0.16
                boxm(ob, px, py, GH, H + 2.2, 0.1, 0.32, ang, "mullion", top=True)
    # crown, roof and plant
    inner = q.buffer(-0.3)
    walls(ob, ring, H, H + 2.4, "wall_" + style if glassy else "parapet", *MOD[style], v0=GH)
    walls(ob, [L(x, y) for x, y in inner.exterior.coords], H, H + 2.4, "parapet", 2, 2, outward=False)
    flat(ob, lpoly(q.difference(inner)), H + 2.4, "slab_edge", 2); flat(ob, lpoly(inner), H + 0.1, "roof", 5)
    c = inner.representative_point(); a_ = math.sqrt(inner.area)
    boxm(ob, *L(c.x, c.y), H, H + 4.5, a_ * 0.35, a_ * 0.3, 0.0, "concrete")
    for k in range(4): boxm(ob, *L(c.x + (k - 1.5) * 3.2, c.y - a_ * 0.25), H, H + 1.6, 2.2, 1.6, 0.0, "metal")
    # entrance: the face nearest a road gets a canopy and the name
    roads = unary_union([ROAD["major"], ROAD["minor"]])
    r = ring[:-1] if ring[0] == ring[-1] else ring
    if not Polygon(r).exterior.is_ccw: r = r[::-1]
    best = None
    for i in range(len(r)):
        (ax, ay), (bx_, by) = r[i], r[(i + 1) % len(r)]; d = math.hypot(bx_ - ax, by - ay)
        if d < 6: continue
        mx, my = (ax + bx_) / 2 + OX, (ay + by) / 2 + OY; dist = roads.distance(Point(mx, my)) - d * 0.05
        if best is None or dist < best[0]: best = (dist, (ax, ay), (bx_, by), d)
    _, (ax, ay), (bx_, by), d = best; ang = math.atan2(by - ay, bx_ - ax); nx, ny = math.sin(ang), -math.cos(ang)
    mx, my = (ax + bx_) / 2, (ay + by) / 2; cw = min(14, d * 0.6)
    boxm(ob, mx + nx * 3.2, my + ny * 3.2, GH - 0.1, GH + 0.45, cw, 6.4, ang, "canopy", bottom=True)
    for sgn in (-1, 1): cyl(ob, mx + nx * 6.0 + math.cos(ang) * sgn * cw * 0.42, my + ny * 6.0 + math.sin(ang) * sgn * cw * 0.42, 0, GH, 0.18, 0.18, 0, "metal", 12)
    ob.build("opt_" + OID, MATS)
    tm = text_mesh(BO["name"].upper(), 1.1, 0.08, "opt_name")
    tm.data.materials.append(MATS["opt_name"])
    tm.rotation_euler = (math.pi / 2, 0, ang); tm.location = (mx + nx * 6.45, my + ny * 6.45, GH + 0.18)
    entrance = (mx + nx * 0.5, my + ny * 0.5); walk0 = (mx + nx * 16, my + ny * 16)
    back = max(38.0, H * 0.62); street_cam = None
    for side in (0.35, -0.35, 0.6, -0.6, 0.0, 0.9, -0.9):
        for kk in (1.0, 0.8, 1.25, 0.65, 1.5):
            c_ = (mx + nx * back * kk + math.cos(ang) * back * side, my + ny * back * kk + math.sin(ang) * back * side)
            if not built.buffer(1.5).contains(Point(c_[0] + OX, c_[1] + OY)) and not built.intersects(LineString([(c_[0] + OX, c_[1] + OY), (mx + nx * 8 + OX, my + ny * 8 + OY)])):
                street_cam = c_; break
        if street_cam: break
    if not street_cam:   # no clear spot in front: search all round for open ground with a clear view of the face
        others = unary_union([p for b_, p in bpolys if b_.get("opt") != OID]) if bpolys else Polygon()
        fx_, fy_ = mx + nx * 2 + OX, my + ny * 2 + OY
        for rad in (back, back * 0.8, back * 1.3, back * 0.6, back * 1.7):
            for t in np.linspace(0, math.tau, 48, endpoint=False):
                c_ = (fx_ + math.cos(t) * rad, fy_ + math.sin(t) * rad)
                if (math.cos(t) * nx + math.sin(t) * ny) < 0.2: continue   # stay in front of the face
                if not built.buffer(1.5).contains(Point(c_)) and not others.intersects(LineString([c_, (fx_, fy_)])):
                    street_cam = (c_[0] - OX, c_[1] - OY); break
            if street_cam: break
    street_cam = street_cam or (mx + nx * back, my + ny * back)
    # make sure the walk starts on open ground (footpath or road)
    # and not under the station's stairs or viaduct, where the eye would sit inside the structure
    def _open(w): q = Point(w[0] + OX, w[1] + OY); return not built.contains(q) and not METRO_CLEAR.contains(q)
    cands = [(mx + nx * d - ny * t, my + ny * d + nx * t) for d in range(16, 64, 4) for t in (0, -8, 8, -16, 16)]
    walk0 = next((w for w in cands if _open(w)), walk0)

    # --- the metro ---
    mt = MB([]); stn = MB([]); STATIONS = []
    U = [(-2.5, -2.3), (2.5, -2.3), (4.55, -0.4), (4.72, 1.15), (4.42, 1.15), (4.3, 0.05), (-4.3, 0.05), (-4.42, 1.15), (-4.72, 1.15), (-4.55, -0.4)]
    for key, ZD in (("L1", 13.0), ("L7", 11.0)):
        for line in S["metro"].get(key, {}).get("lines", []):
            ls = LineString(line).intersection(SLAB.buffer(-1))
            for l in (ls.geoms if hasattr(ls, "geoms") else [ls]):
                if l.geom_type != "LineString" or l.length < 20: continue
                l = l.simplify(0.5); pts_ = [L(x, y) for x, y in l.coords]
                # densify so curves stay smooth
                ll = LineString(pts_); pts_ = [ll.interpolate(s).coords[0] for s in np.arange(0, ll.length, 6)] + [pts_[-1]]
                sweep(mt, pts_, [(n, ZD + z) for n, z in U], "concrete", 6)
                for off in (-1.9, 1.9):    # track slab and rails
                    sweep(mt, pts_, [(off - 1.3, ZD + 0.05), (off + 1.3, ZD + 0.05), (off + 1.3, ZD + 0.32), (off - 1.3, ZD + 0.32)], "concrete_dark", 4)
                    for rr in (-0.76, 0.76): sweep(mt, pts_, [(off + rr - 0.04, ZD + 0.32), (off + rr + 0.04, ZD + 0.32), (off + rr + 0.04, ZD + 0.48), (off + rr - 0.04, ZD + 0.48)], "rail", 4)
                    sweep(mt, pts_, [(off - 0.02, ZD + 5.3), (off + 0.02, ZD + 5.3), (off + 0.02, ZD + 5.36), (off - 0.02, ZD + 5.36)], "wire", 8)
                ll = LineString(pts_)
                for s_ in np.arange(16, ll.length - 4, 30):   # piers with hammerhead caps
                    p = ll.interpolate(s_); p2 = ll.interpolate(min(ll.length, s_ + 1)); ang = math.atan2(p2.y - p.y, p2.x - p.x)
                    cyl(mt, p.x, p.y, 0, ZD - 4.3, 0.85, 1.25, ang, "concrete", 24, cap=False)
                    ca, sa = math.cos(ang), math.sin(ang); top = ZD - 2.3; mid = ZD - 4.3
                    rect = lambda lx, ly: [(p.x + dx * ca - dy * sa, p.y + dx * sa + dy * ca) for dx, dy in ((-lx / 2, -ly / 2), (lx / 2, -ly / 2), (lx / 2, ly / 2), (-lx / 2, ly / 2))]
                    lo, hi = rect(2.2, 2.8), rect(2.4, 9.2)
                    for k in range(4):
                        a0, a1, b0, b1 = lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]
                        mt.quad((*a0, mid), (*a1, mid), (*b0, top), (*b1, top), [(0, 0), (1, 0), (1, 1), (0, 1)], "concrete")
                    flat(mt, Polygon(lo), mid, "concrete", up=False)
                for s_ in np.arange(8, ll.length - 4, 45):    # overhead wire masts
                    p = ll.interpolate(s_); p2 = ll.interpolate(min(ll.length, s_ + 1)); ang = math.atan2(p2.y - p.y, p2.x - p.x); nx2, ny2 = -math.sin(ang), math.cos(ang)
                    for sg in (-1, 1):
                        bx2, by2 = p.x + nx2 * sg * 4.45, p.y + ny2 * sg * 4.45
                        boxm(mt, bx2, by2, ZD + 1.1, ZD + 6.4, 0.22, 0.22, ang, "metal")
                        boxm(mt, p.x + nx2 * sg * 3.3, p.y + ny2 * sg * 3.3, ZD + 5.9, ZD + 6.05, 0.08, 2.3, ang, "metal")
        for s in S["stations"]:
            if s["line"] != key or not SLAB.buffer(-20).contains(Point(s["x"], s["y"])): continue
            best = None
            for line in S["metro"][key]["lines"]:
                l = LineString(line); dd = l.distance(Point(s["x"], s["y"]))
                if best is None or dd < best[0]: best = (dd, l)
            if not best or best[0] > 80: continue
            l = best[1]; t0 = l.project(Point(s["x"], s["y"])); p = l.interpolate(t0)
            a0, a1 = l.interpolate(max(0, t0 - 60)), l.interpolate(min(l.length, t0 + 60)); ang = math.atan2(a1.y - a0.y, a1.x - a0.x)
            px, py = L(p.x, p.y); ca, sa = math.cos(ang), math.sin(ang); nx2, ny2 = -sa, ca
            STATIONS.append({"name": s["name"], "line": key, "x": round(px, 1), "y": round(py, 1), "ang": round(ang, 3)})
            # --- a Line 1 station as Mumbai builds it, not a block ---
            R = lambda k, n: (px + ca * k + nx2 * n, py + sa * k + ny2 * n)   # station frame: k along the line, n across it
            ZC0, ZC1 = ZD - 9.0, ZD - 3.0                                     # concourse floor and ceiling
            # portal frames: twin round columns with a deep crosshead, every 15 m, carrying the concourse
            for k in np.arange(-60, 61, 15):
                for sg in (-1, 1): cyl(stn, *R(k, sg * 9.2), 0, ZC0, 0.75, 0.75, 0, "concrete", 20)
                boxm(stn, *R(k, 0), ZC0 - 1.6, ZC0, 1.8, 21.0, ang, "concrete", bottom=True)
            boxm(stn, px, py, ZC0, ZC0 + 0.45, 98, 23.6, ang, "concrete", bottom=True)            # concourse floor slab
            boxm(stn, px, py, ZC1, ZC1 + 0.6, 100, 24.4, ang, "concrete", bottom=True)            # platform slab over it
            boxm(stn, px, py, ZC0 + 0.45, ZC0 + 0.5, 97, 22.8, ang, "pavers")                     # concourse floor finish (seen through the glass)
            for sg in (-1, 1):
                n = sg * 11.6
                boxm(stn, *R(0, n), ZC0 + 0.45, ZC0 + 1.4, 98, 0.35, ang, "metal")                 # ACP base band
                boxm(stn, *R(0, sg * 11.5), ZC0 + 1.4, ZC1 - 0.1, 97, 0.06, ang, "station_glass")  # glazing
                for k in np.arange(-48, 48.1, 1.5):                                               # mullions
                    boxm(stn, *R(k, n + sg * 0.08), ZC0 + 1.4, ZC1 - 0.1, 0.09, 0.22, ang, "metal")
                boxm(stn, *R(0, n + sg * 0.1), ZC1 - 0.45, ZC1, 99, 0.5, ang, "metal")            # head fascia
                boxm(stn, *R(0, sg * 11.85), ZD - 5.2, ZD - 3.7, 26, 0.18, ang, "sign_l1")        # name board
            # platforms: side platforms, open to the air behind louvres and a parapet
            for sg in (-1, 1):
                boxm(stn, *R(0, sg * 7.6), ZD - 0.6, ZD + 1.1, 136, 5.6, ang, "concrete")
                boxm(stn, *R(0, sg * 7.6), ZD + 1.1, ZD + 1.14, 136, 5.4, ang, "pavers")
                boxm(stn, *R(0, sg * 10.35), ZD + 1.14, ZD + 1.24, 136, 0.5, ang, "sign_l1")      # yellow-line edge stand-in: platform edge band
                boxm(stn, *R(0, sg * 11.9), ZD + 1.1, ZD + 2.2, 138, 0.25, ang, "concrete")       # parapet
                for k in np.arange(-68, 68.1, 0.9):                                               # vertical louvres above it
                    boxm(stn, *R(k, sg * 12.0), ZD + 2.2, ZD + 6.6, 0.08, 0.32, ang, "metal")
                boxm(stn, *R(0, sg * 12.0), ZD + 6.6, ZD + 6.85, 138, 0.4, ang, "metal")
            # the roof: a shallow arch on exposed steel ribs, with overhanging eaves and a fascia
            HALF = 14.2
            prof = [(n, ZD + 8.0 + 2.6 * math.cos(n / HALF * math.pi / 2)) for n in np.linspace(-HALF, HALF, 21)]
            pr2 = prof + [(n, z + 0.18) for n, z in prof[::-1]]
            line2 = [(px - ca * 74, py - sa * 74), (px + ca * 74, py + sa * 74)]
            sweep(stn, line2, pr2, "station_roof", 6)
            for sg in (-1, 1):   # eaves fascia and gutter
                sweep(stn, line2, [(sg * HALF - 0.3, ZD + 7.7), (sg * HALF + 0.35, ZD + 7.7), (sg * HALF + 0.35, ZD + 8.3), (sg * HALF - 0.3, ZD + 8.3)], "metal", 6)
            for k in np.arange(-72, 72.1, 6):   # ribs: a curved steel I-section under the roof skin, on posts
                rib = [(n, z - 0.05) for n, z in prof]; ribb = [(n, z - 0.75) for n, z in prof[::-1]]
                sweep(stn, [R(k - 0.12, 0), R(k + 0.12, 0)], rib + ribb, "metal", 2)
                for sg in (-1, 1): cyl(stn, *R(k, sg * 11.3), ZD + 1.1, ZD + 7.9, 0.2, 0.2, 0, "metal", 10)
            for sg in (-1, 1):   # a purlin line each side, and the ridge
                for nn in (sg * 5.0, sg * 10.0):
                    zz = ZD + 8.0 + 2.6 * math.cos(nn / HALF * math.pi / 2) - 0.85
                    boxm(stn, *R(0, nn), zz, zz + 0.2, 146, 0.2, ang, "metal")
            # stairs and escalators down to the footpath, each under its own canopy
            for sg in (-1, 1):
                for e in (-1, 1):
                    bx2, by2 = px + ca * e * 52 + nx2 * sg * 16, py + sa * e * 52 + ny2 * sg * 16
                    for st_ in range(14):
                        z0 = st_ * (ZC0) / 14; ox = (st_ - 7) * 1.6
                        boxm(stn, bx2 + ca * ox, by2 + sa * ox, z0, z0 + ZC0 / 14, 1.6, 3.2, ang, "concrete")
                    for side in (-1, 1):   # handrail walls in glass with a steel top rail
                        sweep(stn, [(bx2 + ca * -11.2 + nx2 * side * 1.65, by2 + sa * -11.2 + ny2 * side * 1.65), (bx2 + ca * 11.2 + nx2 * side * 1.65, by2 + sa * 11.2 + ny2 * side * 1.65)],
                              [(-0.03, 0.9), (0.03, 0.9), (0.03, 1.0), (-0.03, 1.0)], "metal", 4)
                    boxm(stn, bx2, by2, ZC0 + 3.0, ZC0 + 3.25, 24, 4.4, ang, "station_roof")        # canopy
                    for k in (-11, -3.5, 3.5, 11):
                        for side in (-1, 1): cyl(stn, bx2 + ca * k + nx2 * side * 2.0, by2 + sa * k + ny2 * side * 2.0, 0, ZC0 + 3.0, 0.1, 0.1, 0, "metal", 8)
                    boxm(stn, bx2 + nx2 * -sg * 2.5, by2 + ny2 * -sg * 2.5, ZC0, ZC0 + 0.45, 6, 5, ang, "concrete")   # landing to the concourse
            for sg in (-1, 1):
                t = text_mesh(s["name"].upper(), 1.15, 0.05, f"sign_{s['name']}_{sg}")
                t.data.materials.append(MATS["sign_text"])
                t.rotation_euler = (math.pi / 2, 0, ang if sg < 0 else ang + math.pi)
                t.location = (px + nx2 * sg * 11.9, py + ny2 * sg * 11.9, ZD - 4.55)
    l3 = MB([])
    for s in S["stations"]:
        if s["line"] != "L3" or not SLAB.buffer(-15).contains(Point(s["x"], s["y"])): continue
        px, py = L(s["x"], s["y"]); STATIONS.append({"name": s["name"], "line": "L3", "x": round(px, 1), "y": round(py, 1), "ang": 0})
        for k in (-1, 1):
            ex, ey = px + k * 14, py + k * 4
            boxm(l3, ex, ey, 0, 0.3, 15, 8, 0.3, "concrete")
            for cxx in (-7, 7):
                for cyy in (-3.7, 3.7): cyl(l3, ex + cxx * math.cos(0.3) - cyy * math.sin(0.3), ey + cxx * math.sin(0.3) + cyy * math.cos(0.3), 0.3, 4.4, 0.12, 0.12, 0, "metal", 8)
            boxm(l3, ex, ey, 4.4, 4.75, 16, 9, 0.3, "station_roof", bottom=True)
            boxm(l3, ex, ey, 3.6, 4.4, 8, 0.2, 0.3, "sign_l3")
    mt.build("metro", MATS); stn.build("stations", MATS); l3.build("entries_l3", MATS)

    # --- prototypes: trees, palm, lamp, cars, a Line 1 car ---
    protos()
    return {"entrance": entrance, "walk0": walk0, "street_cam": street_cam, "stations": STATIONS, "H": H, "floors": floors, "glassy": glassy, "canopy_ang": ang}

def protos():
    def tree(name, crowns, trunk_h, trunk_r):
        mb = MB([]); cyl(mb, 0, 0, 0, trunk_h, trunk_r, trunk_r, 0, "trunk", 10)
        me_ = mb.build(name, MATS); bm = bmesh.new()
        # each crown is a cloud of crossed leaf cards (cut-out texture), the
        # way real-time foliage is built: the outline and the light through
        # it then read as leaves, not as a solid blob
        rr = random.Random(name); uv = bm.loops.layers.uv.new("UVMap")
        for (x, y, z, rx, rz) in crowns:
            for _ in range(int(30 + rx * 14)):   # dense enough that the crown reads as foliage, not a few cards
                u, v_, w_ = rr.uniform(-1, 1), rr.uniform(-1, 1), rr.uniform(-1, 1)
                if u * u + v_ * v_ + w_ * w_ > 1: continue
                cx_, cy_, cz_ = x + u * rx * 0.8, y + v_ * rx * 0.8, z + w_ * rz * 0.75
                s_ = rr.uniform(1.2, 2.1) * (rx + rz) / 6
                for k in range(2):   # two crossed cards per tuft
                    a = rr.uniform(0, math.pi) + k * math.pi / 2; tl = rr.uniform(-0.5, 0.5)
                    ex, ey, ez = math.cos(a) * s_, math.sin(a) * s_, 0.0
                    fx, fy, fz = -math.sin(a) * math.sin(tl) * s_, math.cos(a) * math.sin(tl) * s_, math.cos(tl) * s_
                    vs = [bm.verts.new((cx_ + sx * ex + sy * fx, cy_ + sx * ey + sy * fy, cz_ + sx * ez + sy * fz)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                    f = bm.faces.new(vs)
                    for lp, (uu, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uv].uv = (uu, vv)
        cm = bpy.data.meshes.new(name + "_c"); bm.to_mesh(cm); bm.free()
        for p in cm.polygons: p.use_smooth = True
        cm.materials.append(MATS["leaf_b" if name.endswith("_b") else "leaf"]); co = bpy.data.objects.new(name + "_crown", cm); bpy.context.scene.collection.objects.link(co); co.parent = me_
        return me_
    mat("trunk", "#5b4a3b", 0.9); mat("leaf", "#4d7a33", 0.75); mat("leaf_b", "#3f6a2c", 0.75); mat("frond", "#5c8a36", 0.7)
    for k, img in (("leaf", "leaves_a.png"), ("leaf_b", "leaves_b.png")):   # leaf cards: colour and cut-out from the texture
        nt = MATS[k].node_tree; b_ = nt.nodes.get("Principled BSDF"); im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(os.path.join(TEX, img))
        nt.links.new(im.outputs["Color"], b_.inputs["Base Color"]); nt.links.new(im.outputs["Alpha"], b_.inputs["Alpha"]); b_.inputs["Subsurface Weight"].default_value = 0.1
        try: MATS[k].surface_render_method = "DITHERED"
        except Exception: pass
    for k in ("frond",):   # palm fronds: colour varies across the crown
        nt = MATS[k].node_tree; nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 1.6
        cr = nt.nodes.new("ShaderNodeValToRGB"); cr.color_ramp.elements[0].color = hexc("#2c4f1f"); cr.color_ramp.elements[1].color = hexc("#7c9a43")
        nt.links.new(nz.outputs["Fac"], cr.inputs[0]); nt.links.new(cr.outputs[0], nt.nodes.get("Principled BSDF").inputs["Base Color"])
        nt.nodes.get("Principled BSDF").inputs["Subsurface Weight"].default_value = 0.15
    tree("proto_tree_a", [(0, 0, 7.5, 4.6, 2.6), (2.6, 1.0, 6.8, 3.0, 2.0), (-2.4, -1.2, 7.0, 3.2, 2.1), (0.6, -2.5, 6.6, 2.8, 1.9), (-0.8, 2.3, 8.0, 2.6, 1.8)], 5.5, 0.32)
    tree("proto_tree_b", [(0, 0, 4.5, 1.9, 3.2), (0, 0, 7.5, 1.6, 2.8), (0, 0, 10.0, 1.1, 2.0)], 3.0, 0.22)
    # coconut palm: a leaning trunk and fronds
    mb = MB([]); hgt = 11.0
    for k in range(10):
        z0, z1 = k * hgt / 10, (k + 1) * hgt / 10; lx0, lx1 = 0.04 * (z0 / hgt) ** 2 * hgt, 0.04 * (z1 / hgt) ** 2 * hgt
        cyl(mb, lx0, 0, z0, z1, 0.2 - 0.005 * k, 0.2 - 0.005 * k, 0, "trunk", 8, cap=False)
    tip = (0.04 * hgt, 0, hgt)
    for f in range(12):
        a = f / 12 * math.tau; pts_ = []
        for t in np.linspace(0, 1, 7):
            r_ = 4.8 * t; z = tip[2] + 1.2 * t - 3.4 * t * t; pts_.append((tip[0] + math.cos(a) * r_, tip[1] + math.sin(a) * r_, z))
        for i in range(len(pts_) - 1):
            wdt = 0.55 * math.sin(math.pi * (i + 0.5) / 6) + 0.05; p0, p1 = pts_[i], pts_[i + 1]
            nxx, nyy = -math.sin(a) * wdt, math.cos(a) * wdt
            mb.quad((p0[0] + nxx, p0[1] + nyy, p0[2]), (p0[0] - nxx, p0[1] - nyy, p0[2]), (p1[0] - nxx, p1[1] - nyy, p1[2]), (p1[0] + nxx, p1[1] + nyy, p1[2]), [(0, 0)] * 4, "frond")
    mb.build("proto_palm", MATS)
    mb = MB([]); cyl(mb, 0, 0, 0, 9.0, 0.09, 0.09, 0, "metal", 8); boxm(mb, 1.0, 0, 8.8, 8.95, 2.2, 0.08, 0, "metal"); boxm(mb, 2.0, 0, 8.6, 8.9, 0.8, 0.3, 0, "lamp_head")
    mat("lamp_head", "#e6e2d6", 0.4, emit="#fff0d0", ek=0.0); mb.build("proto_lamp", MATS)
    mat("car_body", "#ffffff", 0.22, 0.55); mat("car_glass", "#1a2026", 0.04, 0.6); mat("tyre", "#161616", 0.9); mat("hub", "#b9bcbf", 0.3, 0.9)
    mat("auto_body", "#2f7d36", 0.4, 0.15); mat("auto_top", "#f2c230", 0.55); mat("bus_body", "#b52a22", 0.35, 0.25)
    mat("lamp_front", "#fff6e0", 0.2, emit="#fff6e0", ek=0.6); mat("lamp_rear", "#a01010", 0.3, emit="#ff2010", ek=0.4); mat("trim", "#202224", 0.5, 0.3)
    def xprof(mb, prof, y0, y1, m, ox=0.0):
        """Extrude a side profile [(x, z)] across the width (y0..y1), capped both sides."""
        P = [(x + ox, z) for x, z in prof]; n = len(P)
        for k in range(n):
            a_, b_ = P[k], P[(k + 1) % n]
            mb.quad((a_[0], y0, a_[1]), (b_[0], y0, b_[1]), (b_[0], y1, b_[1]), (a_[0], y1, a_[1]), [(0, 0), (1, 0), (1, 1), (0, 1)], m)
        mb.poly([(x, y0, z) for x, z in P[::-1]], [(0, 0)] * n, m); mb.poly([(x, y1, z) for x, z in P], [(0, 0)] * n, m)
    def wheel(mb, x, yc, r, w):
        ring = [(x + r * math.cos(t), r + r * math.sin(t)) for t in np.linspace(0, math.tau, 16, endpoint=False)]
        xprof(mb, ring, yc - w / 2, yc + w / 2, "tyre")
        hub = [(x + r * 0.55 * math.cos(t), r + r * 0.55 * math.sin(t)) for t in np.linspace(0, math.tau, 12, endpoint=False)]
        sg = 1 if yc > 0 else -1
        xprof(mb, hub, yc + sg * w / 2, yc + sg * (w / 2 + 0.012), "hub")
    # a saloon car, 4.4 m: low body to the beltline, a glass cabin set in from the sides, a body-colour roof
    mb = MB([]); W2 = 0.88
    xprof(mb, [(-2.2, 0.32), (2.2, 0.32), (2.24, 0.55), (2.12, 0.78), (1.25, 0.9), (-1.7, 0.95), (-2.18, 0.86), (-2.24, 0.55)], -W2, W2, "car_body")
    xprof(mb, [(1.22, 0.9), (0.42, 1.36), (-0.92, 1.4), (-1.66, 0.96)], -W2 + 0.07, W2 - 0.07, "car_glass")
    xprof(mb, [(0.46, 1.36), (-0.9, 1.4), (-0.9, 1.44), (0.44, 1.4)], -W2 + 0.09, W2 - 0.09, "car_body")
    for sx in (1.38, -1.38):
        for sy in (-W2 + 0.12, W2 - 0.12): wheel(mb, sx, sy, 0.32, 0.22)
    for sy in (-0.62, 0.62):
        xprof(mb, [(2.2, 0.62), (2.25, 0.62), (2.22, 0.74), (2.15, 0.74)], sy - 0.14, sy + 0.14, "lamp_front")
        xprof(mb, [(-2.25, 0.7), (-2.2, 0.7), (-2.2, 0.82), (-2.22, 0.82)], sy - 0.15, sy + 0.15, "lamp_rear")
    xprof(mb, [(2.21, 0.36), (2.27, 0.36), (2.27, 0.5), (2.23, 0.5)], -0.8, 0.8, "trim"); mb.build("proto_car", MATS)
    # the auto rickshaw: green tub, yellow canvas hood, one wheel in front, two behind
    mb = MB([]); W3 = 0.68
    xprof(mb, [(-1.25, 0.28), (0.9, 0.28), (1.35, 0.55), (1.3, 1.0), (0.95, 1.05), (-1.25, 0.95)], -W3, W3, "auto_body")
    xprof(mb, [(1.05, 1.05), (0.95, 1.72), (-1.05, 1.8), (-1.3, 1.45), (-1.25, 0.95)], -W3 - 0.04, W3 + 0.04, "auto_top")
    xprof(mb, [(1.25, 1.0), (1.32, 1.0), (1.0, 1.62), (0.93, 1.62)], -W3 + 0.04, W3 - 0.04, "car_glass")   # windscreen
    wheel(mb, 1.05, 0.0, 0.22, 0.12)
    for sy in (-W3 + 0.08, W3 - 0.08): wheel(mb, -0.85, sy, 0.22, 0.14)
    mb.build("proto_auto", MATS)
    # a BEST bus, 11.5 m: red body, a dark window band, white roof
    mb = MB([]); W4 = 1.25
    xprof(mb, [(-5.75, 0.45), (5.75, 0.45), (5.85, 1.2), (5.8, 3.0), (5.6, 3.2), (-5.7, 3.2), (-5.8, 3.0), (-5.85, 1.2)], -W4, W4, "bus_body")
    for sy in (-W4 - 0.01, W4 + 0.01):
        boxm(mb, -0.2, sy, 1.75, 2.75, 10.6, 0.02, 0, "car_glass")
    boxm(mb, 5.84, 0, 1.45, 2.85, 0.02, 2.2, 0, "car_glass")
    boxm(mb, 0, 0, 3.2, 3.32, 11.2, 2.3, 0, "concrete")
    for sx in (3.6, -3.4):
        for sy in (-W4 + 0.15, W4 - 0.15): wheel(mb, sx, sy, 0.5, 0.3)
    mb.build("proto_bus", MATS)
    # a person, 1.7 m, walking: trousers, shirt (the page tints it per person), arms, head, hair
    mat("person_trousers", "#2b3240", 0.85); mat("person_shirt", "#ffffff", 0.8); mat("person_skin", "#8a5a3c", 0.6); mat("person_hair", "#15110e", 0.7)
    mb = MB([])
    for sy in (-0.1, 0.1): boxm(mb, 0, sy, 0, 0.86, 0.15, 0.13, 0, "person_trousers")
    boxm(mb, 0, 0, 0.86, 1.42, 0.24, 0.4, 0, "person_shirt"); boxm(mb, 0, 0, 1.36, 1.46, 0.2, 0.3, 0, "person_shirt")
    for sy in (-0.25, 0.25): boxm(mb, 0, sy, 0.84, 1.4, 0.1, 0.09, 0, "person_shirt")
    cyl(mb, 0, 0, 1.46, 1.52, 0.05, 0.05, 0, "person_skin", 8)
    cyl(mb, 0, 0, 1.52, 1.71, 0.095, 0.085, 0, "person_skin", 12)
    cyl(mb, -0.01, 0, 1.66, 1.73, 0.1, 0.09, 0, "person_hair", 12)
    mb.build("proto_person", MATS)
    # one Line 1 car, 20 m: a rounded body, the window band and the blue stripe
    mat("train_body", "#eef1f4", 0.25, 0.5); mat("train_win", "#1e2832", 0.05, 0.6); mat("train_stripe", "#1c5fa8", 0.35)
    mb = MB([]); prof = [(-1.45, 0.4), (1.45, 0.4), (1.5, 2.6), (1.3, 3.6), (0.0, 3.9), (-1.3, 3.6), (-1.5, 2.6)]
    sweep(mb, [(-10, 0), (10, 0)], prof, "train_body", 4)
    for sg in (-1, 1):
        boxm(mb, 0, sg * 1.51, 1.9, 2.9, 18.6, 0.02, 0, "train_win"); boxm(mb, 0, sg * 1.5, 1.0, 1.4, 19.8, 0.03, 0, "train_stripe")
    for e in (-10, 10): flat(mb, Polygon([(e, n) for n, _ in prof] if False else [(e - 0.01, -1.45), (e + 0.01, -1.45), (e + 0.01, 1.45), (e - 0.01, 1.45)]), 3.6, "train_body")
    mb.build("proto_train", MATS)

# ------------------------------------------------------------------ data ----
def page_data(info):
    def inside(x, y, pad=0): return SLAB.buffer(-pad).contains(Point(x, y))
    trees = []
    # keep the view from the street to the entrance open
    E, W0 = info["entrance"], info["street_cam"]
    sight = LineString([W0, E]).buffer(9).union(Point(*W0).buffer(14)).union(Point(*info["walk0"]).buffer(10))
    for x, y, k in S["trees"]:
        if not inside(x, y, 6): continue
        lx, ly = L(x, y)
        if sight.contains(Point(lx, ly)): continue
        t = 2 if rnd.random() < 0.18 else 1 if rnd.random() < 0.3 else 0; trees.append([round(lx, 1), round(ly, 1), t, round(k, 2), round(rnd.random() * 6.28, 2)])
    lamps = [[*map(lambda v: round(v, 1), L(x, y))] for x, y in WJ["lamps"] if inside(x, y, 4)]
    traffic = []
    for t in WJ["traffic"]:
        ls = LineString(t["p"]).intersection(SLAB.buffer(-6))
        for l in (ls.geoms if hasattr(ls, "geoms") else [ls]):
            if l.geom_type == "LineString" and l.length > 40: traffic.append({"w": t["w"], "p": [[round(a, 1), round(b, 1)] for a, b in (L(x, y) for x, y in l.coords)]})
    metro = {}
    for key, ZD in (("L1", 13.0), ("L7", 11.0)):
        for line in S["metro"].get(key, {}).get("lines", []):
            ls = LineString(line).intersection(SLAB.buffer(-1))
            for l in (ls.geoms if hasattr(ls, "geoms") else [ls]):
                if l.geom_type == "LineString" and l.length > 60: metro.setdefault(key, []).append({"z": ZD, "p": [[round(a, 1), round(b, 1)] for a, b in (L(x, y) for x, y in l.coords)]})
    blds = [[[round(a, 1), round(b, 1)] for a, b in (L(x, y) for x, y in Polygon(b["p"]).exterior.coords)] for b in S["buildings"] if SLAB.contains(Polygon(b["p"]).centroid) and Polygon(b["p"]).area > 20 and (b.get("opt") == OID or not blocks_metro(Polygon(b["p"]).buffer(0)))]
    routes = [{"kind": r["kind"], "name": r["name"], "m": r["m"], "min": r.get("min"), "path": [[round(a, 1), round(b, 1)] for a, b in (L(x, y) for x, y in r["path"])]} for r in SO["routes"]]
    return {"id": OID, "name": BO["name"], "origin": [round(OX, 2), round(OY, 2)], "slab": [[round(a, 1), round(b, 1)] for a, b in SL.exterior.coords],
            "building": {"foot": [[round(a, 1), round(b, 1)] for a, b in (L(x, y) for x, y in OPTB["p"])], "h": round(info["H"], 1), "floors": info["floors"], "glassy": info["glassy"],
                         "entrance": [round(v, 1) for v in info["entrance"]], "facing": round(info["canopy_ang"], 3)},
            "walk0": [round(v, 1) for v in info["walk0"]], "street_cam": [round(v, 1) for v in info["street_cam"]], "stations": info["stations"], "routes": routes,
            "trees": trees, "lamps": lamps, "traffic": traffic, "metro": metro, "blocks": blds}

# ---------------------------------------------------------------- export ----
def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True, export_normals=True,
                              export_materials="EXPORT", export_image_format="NONE", export_texcoords=True)
    print("glb", path, round(os.path.getsize(path) / 1e6, 2), "MB")

# ---------------------------------------------------------------- stills ----
def place_instances(data):
    """For Cycles: real copies of the prototypes where the page instances them."""
    import mathutils
    P = {n: bpy.data.objects[n] for n in ("proto_tree_a", "proto_tree_b", "proto_palm", "proto_lamp", "proto_car", "proto_auto", "proto_bus", "proto_train")}
    def inst(proto, x, y, z, rot, s=1.0):
        o = proto.copy(); o.location = (x, y, z); o.rotation_euler = (0, 0, rot); o.scale = (s, s, s); bpy.context.scene.collection.objects.link(o)
        for ch in proto.children:
            c = ch.copy(); c.parent = o; bpy.context.scene.collection.objects.link(c)
    for x, y, t, k, r in data["trees"]: inst(P[("proto_tree_a", "proto_tree_b", "proto_palm")[t]], x, y, 0, r, 0.75 + 0.35 * k)
    for x, y in data["lamps"]: inst(P["proto_lamp"], x, y, 0.2, rnd.random() * 6.28)
    for t in data["traffic"]:
        l = LineString(t["p"])
        for s_ in np.arange(rnd.uniform(5, 25), l.length - 5, rnd.uniform(14, 30)):
            p = l.interpolate(s_); q = l.interpolate(min(l.length, s_ + 1)); a = math.atan2(q.y - p.y, q.x - p.x); lane = rnd.choice((-1, 1)) * t["w"] * 0.22
            kind = rnd.random(); pr = P["proto_auto"] if kind < 0.3 else P["proto_bus"] if kind > 0.95 else P["proto_car"]
            inst(pr, p.x - math.sin(a) * lane, p.y + math.cos(a) * lane, 0.06, a + (math.pi if lane < 0 else 0))
    for key, ls in data["metro"].items():
        for m in ls[:1]:
            l = LineString(m["p"]); s0 = l.length * 0.35
            for c in range(4):
                p = l.interpolate(s0 + c * 20.5); q = l.interpolate(s0 + c * 20.5 + 1); a = math.atan2(q.y - p.y, q.x - p.x)
                inst(P["proto_train"], p.x - math.sin(a) * 1.9, p.y + math.cos(a) * 1.9, m["z"] + 0.48, a)
    for n, o in P.items(): o.hide_render = True
    for o in list(P.values()):
        for ch in o.children: ch.hide_render = True

def light(sc, az=235, el=24):
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes.get("Background")
    sky = nt.nodes.new("ShaderNodeTexSky")
    for t in ("MULTIPLE_SCATTERING", "NISHITA"):
        try: sky.sky_type = t; break
        except Exception: pass
    try: sky.sun_elevation = math.radians(el); sky.sun_rotation = math.radians(90 - az); sky.altitude = 100; sky.air_density = 1.4; sky.aerosol_density = 2.8; sky.sun_intensity = 0.6
    except Exception: pass
    nt.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.28
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.2; sun.angle = math.radians(1.5); sun.color = (1, 0.93, 0.82)
    so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(90 - el), 0, math.radians(-az))

def camera(sc, pos, look, lens, shift_y=0.0, dof=None):
    cd = bpy.data.cameras.new("cam"); cd.lens = lens; cd.clip_start = 0.1; cd.clip_end = 8000; cd.shift_y = shift_y; cd.sensor_width = 36
    cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam; cam.location = pos
    d = np.subtract(look, pos)
    if shift_y:   # architectural: a level camera, the frame shifted up
        cam.rotation_euler = (math.pi / 2, 0, math.atan2(d[1], d[0]) - math.pi / 2)
    else: cam.rotation_euler = (math.atan2(math.hypot(d[0], d[1]), -d[2]), 0, math.atan2(d[1], d[0]) - math.pi / 2)
    if dof: cd.dof.use_dof = True; cd.dof.focus_distance = float(np.linalg.norm(d)); cd.dof.aperture_fstop = dof
    return cam

def render(kind, data, info):
    sc = bpy.context.scene
    place_instances(data); light(sc)
    E = info["entrance"]; F = info["canopy_ang"]; nx, ny = math.sin(F), -math.cos(F); H = info["H"]
    bc = Polygon(data["building"]["foot"]).centroid
    if kind == "hero":
        R = max(Polygon(data["slab"]).bounds[2] - Polygon(data["slab"]).bounds[0], Polygon(data["slab"]).bounds[3] - Polygon(data["slab"]).bounds[1])
        a = math.atan2(ny, nx) - 0.6; dist = R * 1.25
        camera(sc, (bc.x + math.cos(a) * dist * 0.75, bc.y + math.sin(a) * dist * 0.75, dist * 0.62), (bc.x * 0.6, bc.y * 0.6, 0), 50)
        size = (2400, 1500)
    elif kind == "close":
        a = math.atan2(ny, nx) + 0.5; dist = max(160, H * 3.2)
        camera(sc, (bc.x + math.cos(a) * dist, bc.y + math.sin(a) * dist, dist * 0.55 + H * 0.4), (bc.x, bc.y, H * 0.35), 50)
        size = (1600, 1000)
    elif kind == "street":
        px, py = info["street_cam"]
        camera(sc, (px, py, 1.7), (bc.x, bc.y, 1.7), 18, shift_y=0.3)
        size = (1280, 960)
    elif kind == "station":
        st = data["stations"][0] if data["stations"] else None
        if not st: return
        a = st["ang"] + math.pi / 2
        camera(sc, (st["x"] + math.cos(a) * 70 + math.cos(st["ang"]) * 50, st["y"] + math.sin(a) * 70 + math.sin(st["ang"]) * 50, 22), (st["x"], st["y"], 10), 28)
        size = (1600, 1000)
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 16 if FAST else 64; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 8
    sc.render.resolution_x, sc.render.resolution_y = size; sc.render.resolution_percentage = 40 if FAST else 100
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = -0.3
    sc.render.film_transparent = kind == "hero"
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    sc.render.filepath = os.path.join(OUT, f"{OID}-{kind}.png"); bpy.ops.render.render(write_still=True); print("rendered", kind)

def sky_hdr():
    """The same sky as an equirectangular HDR, for the page's lighting."""
    sc = bpy.context.scene; light(sc)
    for o in list(sc.objects):
        if o.type == "MESH": o.hide_render = True
    cd = bpy.data.cameras.new("pano"); cd.type = "PANO"
    try: cd.panorama_type = "EQUIRECTANGULAR"
    except Exception: cd.cycles.panorama_type = "EQUIRECTANGULAR"
    cam = bpy.data.objects.new("pano", cd); sc.collection.objects.link(cam); sc.camera = cam; cam.location = (0, 0, 2); cam.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    sc.render.engine = "CYCLES"; sc.cycles.samples = 8; sc.render.resolution_x, sc.render.resolution_y = 2048, 1024; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "HDR"; sc.render.filepath = os.path.join(OUT, "sky.hdr"); bpy.ops.render.render(write_still=True)
    # the sun disc is the page's directional light, so the sky keeps only its glow
    im = bpy.data.images.load(sc.render.filepath); px = np.array(im.pixels[:]).reshape(-1, 4); px[:, :3] = np.minimum(px[:, :3], 8.0)
    im.pixels[:] = px.ravel(); im.filepath_raw = sc.render.filepath; im.file_format = "HDR"; im.save(); print("sky.hdr")

info = build()
data = page_data(info)
json.dump(data, open(os.path.join(OUT, f"{OID}.json"), "w"), separators=(",", ":"))
if "--glb" in A: export(os.path.join(OUT, f"{OID}.glb"))
if "--render" in A:
    for k in A[A.index("--render") + 1:]:
        if k.startswith("--"): break
        render(k, data, info)
if "--sky" in A: sky_hdr()
