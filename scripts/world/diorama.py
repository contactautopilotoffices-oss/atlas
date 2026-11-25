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
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "realism"))   # film-quality modules (realism/*.py)
import numpy as np
import bpy, bmesh
from mathutils import Matrix
import shapely
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box
from shapely.ops import unary_union

A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]   # bpy module, or Blender app after --
SCENE, WORLD, TEX, OID, OUT = A[:5]
bpy.ops.wm.read_factory_settings(use_empty=True)
FAST = "--fast" in A
os.makedirs(OUT, exist_ok=True)
S = json.load(open(SCENE)); WJ = json.load(open(WORLD))
# buildings the open maps miss, added from survey (scripts/world/refs/*.json "added")
_RD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "refs")
_REFS = [] if "--no-refs" in A else (sorted(os.listdir(_RD)) if os.path.isdir(_RD) else [])   # --no-refs: another city; the refs are Andheri's survey
for _fn in _REFS:
    for _e in json.load(open(os.path.join(_RD, _fn))).get("added", []):
        _ap = Polygon(_e["poly"]); S["buildings"] = [b for b in S["buildings"] if b.get("opt") or not _ap.contains(Polygon(b["p"]).centroid)]   # map slivers inside it
        S["buildings"].append({"p": _e["poly"], "h": _e["h"], "c": _e.get("c", "yes"), "r": 0.5, "added": _e["name"]})
BUNDLE = json.load(open(S.get("bundle", "examples/flipkart-andheri.bundle.json")))
BO = next(o for o in BUNDLE["options"] if o["id"] == OID)
FACT = {f["k"]: f["v"] for f in BO["facts"]}
SO = next(o for o in S["options"] if o["id"] == OID)
if "--opt-at" in A:   # --opt-at X,Y: the option's real footprint, when the map pin put it on a neighbour (Privilon was on Fleet House)
    ox_, oy_ = (float(v) for v in A[A.index("--opt-at") + 1].split(","))
    for b in S["buildings"]:
        if b.get("opt") == OID: del b["opt"]
    min(S["buildings"], key=lambda b: Polygon(b["p"]).centroid.distance(Point(ox_, oy_)))["opt"] = OID
for _key in ("privilon", "corporate-avenue"):   # options whose outline is fixed in scripts/world/refs/*.json (founder + Google satellite), in every district
    _poly, _h = None, 67.5
    for _fn in _REFS:
        _e = json.load(open(os.path.join(_RD, _fn))).get(_key, {})
        if _e.get("poly"): _poly, _h = _e["poly"], _e.get("h", 67.5)
    if not _poly: continue
    _op = Polygon(_poly)
    for b in S["buildings"]:   # the old pin's footprint is a real neighbour (Privilon's pin sat on Fleet House): keep it, drop the tag
        if b.get("opt") == _key: del b["opt"]
    S["buildings"] = [b for b in S["buildings"] if not (_op.contains(Polygon(b["p"]).centroid) or Polygon(b["p"]).intersection(_op).area > min(100, 0.25 * Polygon(b["p"]).area))]
    S["buildings"].append({"p": _poly, "h": _h, "c": "commercial", "r": 0.5, "opt": _key})
OPTB = next(b for b in S["buildings"] if b.get("opt") == OID)
# --brick-zone X0,Y0,X1,Y1 (scene metres): towers over 30 m inside it take the te_brick facade, not a Mumbai default
BRICKZ = box(*(float(v) for v in A[A.index("--brick-zone") + 1].split(","))) if "--brick-zone" in A else None
# --neighbour-hero ID=BLEND (repeatable): another shortlisted property standing in this district, shown with its
# own facade study and a pin, not as a generic block (723 Avenue is visible from Privilon)
NEIGH = dict(A[i + 1].split("=", 1) for i, a in enumerate(A) if a == "--neighbour-hero")
rnd = random.Random(OID)

# ------------------------------------------------------------ the slab ----
foot = Polygon(OPTB["p"]); fc = foot.centroid
metro_r = next((r for r in SO["routes"] if r["kind"] == "metro"), None)
pts = [fc.coords[0]] + ([tuple(metro_r["path"][-1])] if metro_r else [])
bx = shapely.MultiPoint(pts).envelope.buffer(170, join_style="mitre")
minx, miny, maxx, maxy = bx.bounds
SMIN = float(A[A.index("--slab-min") + 1]) if "--slab-min" in A else 760   # --slab-min: a wider district slab
w, h = max(SMIN, maxx - minx), max(SMIN, maxy - miny)
cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
w, h = min(w, max(1500, SMIN)), min(h, max(1500, SMIN))
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
       "shop": (6, 4.5), "chawl": (4, 3), "opt_glass": (6, 16.4), "opt_plaster": (6, 16.4), "glass723": (6, 4.1), "retail723": (7.2, 5.6),
       "cw_teal": (6, 4.1), "cw_blue": (6, 4.1), "cw_grey": (6, 4.1), "cw_silver": (6, 4.1), "ribbon_red": (6, 4.1), "ribbon_white": (6, 4.1),
       "shophouse": (6, 12), "signs": (6, 4.5), "glass_grid": (6, 4.1)}   # corridor facades from Street View (tex_corridor.py)
if "--brick-zone" in A: MOD["te_brick"] = (6, 12)   # Total Environment brick towers (te-whitefield/world/tex_te_brick.py)
for k in MOD: mat("wall_" + k, tex=k + ".jpg", rtex=k + "_r.jpg", glass=k in ("com_glass", "opt_glass", "com_ribbon", "opt_plaster", "res_tower", "glass723", "retail723") or k.startswith(("cw_", "ribbon_")))
mat("fin_723", "#3d4752", 0.45, 0.35); mat("pier_723", "#32373d", 0.5, 0.3); mat("band_723", "#c8cbcd", 0.55, 0.15); mat("frame_723", "#d9dcde", 0.35, 0.7)
mat("acp_grey", "#b8bcbf", 0.4, 0.55); mat("acp_red", "#ad322c", 0.42, 0.35); mat("acp_white", "#e7e7e3", 0.45, 0.25); mat("fin_white", "#ecebe7", 0.5, 0.1)
mat("roof", tex="roof.jpg", rough=0.9); mat("roof_tin", "#8f8f8a", 0.45, 0.6); mat("roof_tarp", "#2f63a8", 0.6); mat("roof_tin_rust", "#7a5b45", 0.7, 0.3)
mat("parapet", "#ada695", 0.9); mat("ground", "#a29c8f", 0.95, tex="roof.jpg"); mat("asphalt", tex="asphalt.jpg", rough=0.85); mat("pavers", tex="pavers.jpg", rough=0.9)
mat("kerb", "#bdb8ab", 0.85); mat("grass", tex="grass.jpg", rough=0.95); mat("water", "#3d5257", 0.05, 0.1); mat("marking", "#efefe8", 0.6)
mat("soil", tex="soil.jpg", rough=1.0); mat("concrete", "#a9a59c", 0.8); mat("concrete_dark", "#9f9b92", 0.8); mat("metal", "#a9adb1", 0.35, 0.9)
mat("station_roof", "#d9dde0", 0.3, 0.85); mat("station_glass", "#8fb4c4", 0.05, 0.2, alpha=0.35); mat("sign_l1", "#1c5fa8", 0.4); mat("sign_l3", "#1d8a8a", 0.4)
mat("sign_text", "#ffffff", 0.4, emit="#ffffff", ek=0.6); mat("rail", "#6f6a64", 0.4, 0.9); mat("tank", "#1d1f22", 0.5)
mat("mullion", "#c4c9cc", 0.3, 0.9); mat("slab_edge", "#e6e3dc", 0.6); mat("glass_lobby", "#6e8a96", 0.03, 0.6); mat("canopy", "#2b2e31", 0.4, 0.6)
mat("pier_blue", "#3f78a6", 0.6, 0.1); mat("roof_blue", "#2f6fb0", 0.5, 0.3); mat("acp_station", "#d7dadb", 0.45, 0.4)
mat("ad_red", "#b8322a", 0.5); mat("ad_yellow", "#e2b42c", 0.5); mat("ad_blue", "#1f4f9a", 0.5); mat("ad_white", "#efefea", 0.5)
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
DROPPED, TRIMMED = [], []
# --detail-around "x,y,r;x,y,r" (scene metres): buildings whose centroid is inside are handed to realism/facades.py
# for modelled, film-quality facades instead of painted walls. DETAILED collects them (local coordinates).
DETAIL_ZONE = unary_union([Point(*(float(v) for v in c.split(",")[:2])).buffer(float(c.split(",")[2]))
                           for c in A[A.index("--detail-around") + 1].split(";")]) if "--detail-around" in A else Polygon()
DETAILED = []
LOGIC = {}   # what the build kept, for realism/../check_logic.py   # footprints removed for the metro, and kept but trimmed to its clearance
# where the eye must not stand: inside the Line 1 station or its stairs, or under a Line 3 entrance canopy
KEEP_OUT = unary_union([METRO_CLEAR] + [Point(s["x"], s["y"]).buffer(30) for s in S["stations"] if s["line"] == "L3"])
def blocks_metro(p):
    if METRO_CLEAR.is_empty: return False
    i = p.intersection(METRO_CLEAR).area
    return i > 40 or i > 0.25 * p.area

def generic_option(ob, q, ring, GH, FH, floors, H, glassy, style):
    """An option building in the house style: lobby glass, a facade texture, slab edges, mullions, a crown."""
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

def _faces(ring):
    """The footprint's faces, counter-clockwise, each as (A, B, length, angle, outward normal)."""
    r = ring[:-1] if ring[0] == ring[-1] else ring
    if not Polygon(r).exterior.is_ccw: r = r[::-1]
    out = []
    for i in range(len(r)):
        (ax, ay), (bx_, by) = r[i], r[(i + 1) % len(r)]; d = math.hypot(bx_ - ax, by - ay)
        if d < 2: continue
        ang = math.atan2(by - ay, bx_ - ax); out.append(((ax, ay), (bx_, by), d, ang, (math.sin(ang), -math.cos(ang))))
    return out

def _at(A, B, d, s_, n, off):
    return (A[0] + (B[0] - A[0]) * s_ / d + n[0] * off, A[1] + (B[1] - A[1]) * s_ / d + n[1] * off)

FIN_STEP, FIN_D, FIN_W = 0.62, 0.38, 0.08
def house_of_wadhwa(ob, q, ring, GH, FH, floors, H):
    """House of Wadhwa 723 Avenue, after the developer's image: a dark glass tower wrapped in dense full-height
    vertical fins, solid piers that break each face, a light grey end band, slim floor lines, an open crown of
    blades above the roof, and a lit glass retail ground floor. The front face gets its own pieces below."""
    walls(ob, ring, 0, GH, "wall_retail723", *MOD["retail723"])
    walls(ob, ring, GH, H, "wall_glass723", *MOD["glass723"], v0=GH)
    # floor lines: a slim transom at every slab
    for k in range(floors):
        z = GH + k * FH
        out = q.buffer(0.14, join_style="mitre")
        walls(ob, [L(x, y) for x, y in out.exterior.coords], z - 0.1, z + 0.1, "fin_723", 2, 2)
        flat(ob, lpoly(out.difference(q)), z + 0.1, "fin_723", 2)
    # the podium's dark head band over the retail glass, projecting like a fascia
    out = q.buffer(1.2, join_style="mitre")
    walls(ob, [L(x, y) for x, y in out.exterior.coords], GH - 0.9, GH + 0.15, "pier_723", 2, 2)
    flat(ob, lpoly(out.difference(q)), GH + 0.15, "pier_723", 2); flat(ob, lpoly(out.difference(q)), GH - 0.9, "pier_723", 2, up=False)
    F = _faces(ring)
    for i, (A, B, d, ang, n) in enumerate(F):
        # where the solid piers and the light band break the fins on this face
        breaks = [(0.71 * d, 0.71 * d + 3.6, "band_723")] if i % 2 == 0 else [(0.31 * d, 0.31 * d + 2.4, "pier_723"), (d - 3.2, d, "band_723")]
        for b0, b1, m in breaks:
            c0 = _at(A, B, d, (b0 + b1) / 2, n, 0.22)
            boxm(ob, *c0, GH, H + 0.4, b1 - b0, 0.45, ang, m)
        s_ = 0.4
        while s_ < d - 0.3:
            if not any(b0 - 0.2 <= s_ <= b1 + 0.2 for b0, b1, _ in breaks):
                boxm(ob, *_at(A, B, d, s_, n, FIN_D / 2), GH, H + 0.4, FIN_W, FIN_D, ang, "fin_723")
            s_ += FIN_STEP
        # the crown: an open screen of thin blades standing above the roof line
        s_ = 0.3
        while s_ < d - 0.2:
            boxm(ob, *_at(A, B, d, s_, n, 0.2), H, H + 6.0, 0.07, 0.12, ang, "frame_723")
            s_ += 1.2
        boxm(ob, *_at(A, B, d, d / 2, n, 0.2), H + 5.85, H + 6.05, d, 0.22, ang, "frame_723")
    # the roof and its plant
    inner = q.buffer(-0.3)
    flat(ob, lpoly(q), H + 0.05, "roof", 5)
    walls(ob, ring, H, H + 1.1, "pier_723", 2, 2)
    c = inner.representative_point(); a_ = math.sqrt(inner.area)
    boxm(ob, *L(c.x, c.y), H, H + 3.0, a_ * 0.45, a_ * 0.4, 0.0, "pier_723")

def house_of_wadhwa_front(ob, A, B, r, GH, FH, H):
    """The pieces only the front face has: the projecting two-storey frame box low on the left, and the framed
    notch at the top left corner."""
    d = math.hypot(B[0] - A[0], B[1] - A[1]); ang = math.atan2(B[1] - A[1], B[0] - A[0]); n = (math.sin(ang), -math.cos(ang))
    zb = GH + 2 * FH; w = min(9.0, d * 0.32); c = _at(A, B, d, 0.6 + w / 2, n, 0.8)
    for z0, z1 in ((zb - 0.35, zb + 0.35), (zb + 2 * FH - 0.35, zb + 2 * FH + 0.35)):
        boxm(ob, *c, z0, z1, w + 0.6, 1.6, ang, "frame_723", bottom=True)
    for e in (-1, 1):
        boxm(ob, *_at(A, B, d, 0.6 + w / 2 + e * (w / 2), n, 0.8), zb, zb + 2 * FH, 0.6, 1.6, ang, "frame_723")
    boxm(ob, *_at(A, B, d, 0.6 + w / 2, n, 1.3), zb + 0.35, zb + 2 * FH - 0.35, w - 0.6, 0.06, ang, "wall_glass723")
    # top left: two floors set back behind a white frame
    zn = H - 2 * FH; wn = min(5.0, d * 0.2)
    boxm(ob, *_at(A, B, d, wn / 2, n, 0.3), H - 0.3, H + 0.3, wn + 0.4, 0.8, ang, "frame_723", bottom=True)
    boxm(ob, *_at(A, B, d, wn + 0.2, n, 0.3), zn, H, 0.4, 0.8, ang, "frame_723")

# --- the other six options, after what their developers, brokers and RERA filings say (see the PR notes):
#     a curtain-wall or ribbon-window skin, and the structural pieces each one is known for ---
SPECS = {
    # Atul Corporate Avenue, Chakala: a glass-fronted G+8 block of wings round a full-height atrium, rooftop sundecks
    "corporate-avenue": dict(skin="cw_teal", mull=1.5, bands=("acp_grey", 0.45, 0.4), corners="acp_grey", crown="acp_grey", roofdeck=True, skylight=True),
    # Bsafal Privilon (Morphogenesis): a 14-storey slab with a kinetic facade of sunbreakers, double-height lobby, landscaped roof deck
    "privilon": dict(skin="cw_grey", lobby2=True, fins=dict(step=1.1, d0=0.3, d1=1.4, w=0.16, mat="fin_white"), crown="fin_white", roofgarden=True),
    # Silver Landmark (1998, Uttam C. Jain): ACP and glass, the building people know as the red one by the highway
    "landmark": dict(skin="ribbon_red", corners="acp_red", crown="acp_red"),
    # Rustomjee Central Park (Sanjay Puri): a full glass curtain wall in performance glazing, an 18 ft sheltered driveway
    "rustomjee-central-park": dict(skin="cw_silver", mull=1.25, crown="acp_grey", porte=True),
    # Vaman Techno Centre (2007): a mid-rise block; facade not documented, so a typical ribbon of blue glass in white ACP
    "vaman-techno-centre": dict(skin="ribbon_white", corners="acp_white", crown="acp_white"),
    # Hiranandani Fulcrum (2013): a glass-fronted G+9 of two wings, double glazed, a cafeteria on the terrace
    "fulcrum": dict(skin="cw_blue", mull=1.5, bands=("acp_grey", 0.35, 0.3), crown="acp_grey", roofdeck=True),
}

def facade_spec(ob, q, ring, GH, FH, floors, H, sp):
    lob = GH + (FH if sp.get("lobby2") else 0)
    walls(ob, ring, 0, lob, "glass_lobby", 3, lob)
    walls(ob, ring, lob, H, "wall_" + sp["skin"], 6, FH, v0=GH)
    if sp.get("bands"):   # an ACP band at every slab
        m, d_, h_ = sp["bands"]; out = q.buffer(d_, join_style="mitre"); oring = [L(x, y) for x, y in out.exterior.coords]
        for k in range(1 if sp.get("lobby2") else 0, floors):
            z = GH + k * FH; walls(ob, oring, z - h_, z, m, 2, 2); flat(ob, lpoly(out.difference(q)), z, m, 2); flat(ob, lpoly(out.difference(q)), z - h_, m, 2, up=False)
    F = _faces(ring)
    for i, (A, B, d, ang, n) in enumerate(F):
        if sp.get("mull"):
            s_ = sp["mull"] / 2
            while s_ < d:
                boxm(ob, *_at(A, B, d, s_, n, 0.11), lob, H + 0.3, 0.08, 0.22, ang, "mullion"); s_ += sp["mull"]
        if sp.get("fins"):   # sunbreakers whose depth rises and falls across each face: the kinetic read
            f = sp["fins"]; s_ = f["step"] / 2
            while s_ < d - 0.2:
                t = s_ / d; dep = f["d0"] + (f["d1"] - f["d0"]) * (0.5 + 0.5 * math.sin(math.tau * (t * 1.3 + i * 0.3)))
                boxm(ob, *_at(A, B, d, s_, n, dep / 2), lob, H + 1.6, f["w"], dep, ang, f["mat"]); s_ += f["step"]
    if sp.get("corners"):   # solid cladding at the corners, full height
        r = ring[:-1] if ring[0] == ring[-1] else ring
        for k in range(len(r)):
            a0 = math.atan2(r[k][1] - r[k - 1][1], r[k][0] - r[k - 1][0])
            boxm(ob, r[k][0], r[k][1], 0, H + 1.4, 1.3, 1.3, a0, sp["corners"])
    # parapet, roof and plant
    cm = sp.get("crown", "parapet"); inner = q.buffer(-0.3)
    walls(ob, ring, H, H + 1.4, cm, 2, 2); walls(ob, [L(x, y) for x, y in inner.exterior.coords], H, H + 1.4, cm, 2, 2, outward=False)
    flat(ob, lpoly(q.difference(inner)), H + 1.4, cm, 2); flat(ob, lpoly(inner), H + 0.1, "roof", 5)
    c = inner.representative_point(); a_ = math.sqrt(inner.area)
    if sp.get("skylight"):   # the atrium's glass roof
        boxm(ob, *L(c.x, c.y), H, H + 1.3, a_ * 0.32, a_ * 0.22, 0.0, "glass_lobby")
    else:
        boxm(ob, *L(c.x, c.y), H, H + 3.4, a_ * 0.3, a_ * 0.25, 0.0, "concrete")
    if sp.get("roofdeck"):   # a shaded sundeck: slender posts and a slatted pergola over part of the roof
        px0, py0 = L(c.x + a_ * 0.22, c.y + a_ * 0.18)
        for ix in range(4):
            for iy in range(3): cyl(ob, px0 + (ix - 1.5) * 3.2, py0 + (iy - 1) * 3.2, H + 0.1, H + 3.2, 0.09, 0.09, 0, "metal", 8)
        for k in range(14): boxm(ob, px0 + (k - 6.5) * 0.8, py0, H + 3.2, H + 3.45, 0.12, 7.6, 0.0, "fin_white")
    if sp.get("roofgarden"):   # the landscaped roof terrace: lawn, planters, shade
        g = inner.buffer(-2.0)
        if not g.is_empty: flat(ob, lpoly(g), H + 0.35, "grass", 4)
        for k in range(5): boxm(ob, *L(c.x + (k - 2) * a_ * 0.15, c.y - a_ * 0.28), H + 0.1, H + 1.0, 2.4, 1.0, 0.0, "concrete")

def porte_cochere(ob, A, B, GH):
    """An 18 ft (5.5 m) sheltered driveway: a deep slab on two round columns in front of the entrance."""
    d = math.hypot(B[0] - A[0], B[1] - A[1]); ang = math.atan2(B[1] - A[1], B[0] - A[0]); n = (math.sin(ang), -math.cos(ang))
    w = min(16.0, d * 0.55); c = _at(A, B, d, d / 2, n, 5.0)
    boxm(ob, *c, 5.5, 6.2, w, 10.0, ang, "acp_grey", bottom=True)
    for e in (-1, 1): cyl(ob, *_at(A, B, d, d / 2 + e * w * 0.38, n, 8.6), 0, 5.5, 0.45, 0.45, 0, "concrete", 18)

# -------------------------------------------------------------- the build ----
def build():
    sc = bpy.context.scene
    ROAD = {k: unary_union([Polygon(r[0], r[1:]).buffer(0) for r in S["roads"][k]]) if S["roads"][k] else Polygon() for k in ("major", "minor", "foot")}
    clipw = SLAB.buffer(2)
    road_all = unary_union([ROAD["major"], ROAD["minor"]]).intersection(SLAB)
    bpolys = []
    ON_ROAD = []
    for b in S["buildings"]:
        p = Polygon(b["p"])
        if not p.is_valid: p = p.buffer(0)
        _on = p.intersection(ROAD["major"]).area / max(p.area, 1e-6)
        if not b.get("opt") and not b.get("added") and (_on > 0.6 or (p.area < 100 and _on > 0.5)):
            # a map footprint drawn on the carriageway: not a building. Small ones (kiosks, stalls, a mapping offset at the
            # road edge) go at half on the road, the logic gate's own line; bigger ones still fail the gate between 50-60%.
            ON_ROAD.append([round(v) for v in p.centroid.coords[0]]); continue
        if b.get("opt") != OID and blocks_metro(p):
            # the map draws the station and viaduct as a building; we build the real thing there. Real buildings that only
            # touch the clearance are trimmed back to its edge, not deleted (deleting them left empty lots by the stations)
            if b.get("c") == "transportation" or p.intersection(METRO_CLEAR).area > 0.6 * p.area: DROPPED.append(round(p.area)); continue
            p = p.difference(METRO_CLEAR)
            if p.is_empty or p.area < 30: DROPPED.append(round(p.area)); continue
            if p.geom_type == "MultiPolygon": p = max(p.geoms, key=lambda g: g.area)
            TRIMMED.append(round(p.area))
        if SLAB.contains(p.centroid): bpolys.append((b, p.intersection(SLAB)))
    built = unary_union([p for _, p in bpolys]) if bpolys else Polygon()
    print("metro clearance: dropped", len(DROPPED), "footprints", sum(DROPPED), "m2; trimmed and kept", len(TRIMMED), "| dropped on the carriageway:", len(ON_ROAD))
    LOGIC.update(on_road=ON_ROAD, built=[(b, p) for b, p in bpolys], road=ROAD)

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
    # named landmarks near the options (footprint nearest the point; height from the surface model)
    # Times Square: the 8,600 m2 complex north of Andheri-Kurla Road, 90 m from the geocoded Le Western hotel
    LMK = [("Times Square", 72.867 + 1751 / S["k"][0], 19.111 - 319 / S["k"][1], "cw_blue"), ("Le Western", 72.8828176, 19.1078771, "cw_silver")]
    lmk = {}
    for nm, lo_, la_, sty in LMK:
        pt = Point((lo_ - S["origin"][0]) * S["k"][0], (la_ - S["origin"][1]) * S["k"][1])
        cand = [(p_.centroid.distance(pt), id(b_)) for b_, p_ in bpolys if p_.area > 1200 and b_.get("opt") != OID and id(b_) not in lmk]
        if cand and min(cand)[0] < 60: lmk[min(cand)[1]] = (nm, sty, None, None)   # only a building actually at the landmark (another city has none)
    # buildings surveyed in Street View (scripts/world/refs/*.json): facade and, where counted, height
    RD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "refs")
    for fn in _REFS:
        for e in json.load(open(os.path.join(RD, fn))).get("buildings", []):
            pt = Point(e["x"], e["y"]); cand = [(p_.centroid.distance(pt), id(b_)) for b_, p_ in bpolys if b_.get("opt") != OID]
            if cand and min(cand)[0] < 15: lmk[min(cand)[1]] = (e["name"], e["style"], e.get("h"), e.get("ground"))
    road_near = unary_union([ROAD["major"], ROAD["minor"]]).buffer(6)
    for b, p in bpolys:
        if b.get("opt") == OID or b.get("opt") in NEIGH: continue
        for q in (p.geoms if hasattr(p, "geoms") else [p]):
            if q.geom_type != "Polygon" or q.area < 8: continue
            q = q.simplify(0.15); hgt = b["h"]; a = q.area; r_ = random.Random(b["r"])
            ring = [L(x, y) for x, y in q.exterior.coords]
            OFFICE = ["cw_teal", "cw_blue", "cw_grey", "cw_silver", "ribbon_red", "ribbon_white", "com_ribbon"]
            if id(b) in lmk:
                style = lmk[id(b)][1]; hgt = lmk[id(b)][2] or hgt; print("landmark", lmk[id(b)][0], round(a), "m2", hgt, "m")
                nm_ = lmk[id(b)][0].split(",")[0].split(" (")[0]; c_ = q.centroid
                if SLAB.buffer(-30).contains(c_) and (nm_ not in LANDMARKS or LANDMARKS[nm_]["h"] < hgt):
                    lx_, ly_ = L(c_.x, c_.y); LANDMARKS[nm_] = {"name": nm_, "x": round(lx_, 1), "y": round(ly_, 1), "h": round(hgt, 1)}
            elif BRICKZ is not None and BRICKZ.contains(q.centroid) and hgt > 30: style = "te_brick"   # --brick-zone: a developer's own brick towers (Rhapsody)
            elif a < 70: style = "chawl"
            elif hgt > 45: style = "res_tower" if r_.random() < 0.6 else "com_glass"
            elif b["c"] in ("commercial", "office", "retail", "hotel") or (a > 1500 and r_.random() < 0.5): style = OFFICE[int(b["r"] * 991) % len(OFFICE)]
            else: style = WALL_STYLES[int(b["r"] * 997) % len(WALL_STYLES)]
            mw, mh = MOD[style]
            gband = lmk[id(b)][3] if id(b) in lmk else None
            shop = (a > 80 and hgt > 7 and road_near.intersects(q) and style != "chawl") or gband == "signs"
            z_shop = min(4.5, hgt - 1.0) if shop else 0.0
            if not DETAIL_ZONE.is_empty and DETAIL_ZONE.contains(q.centroid):
                DETAILED.append({"ring": ring, "h": round(hgt, 2), "style": style, "shop": bool(shop), "z_shop": z_shop, "area": round(a, 1),
                                 "seed": b.get("r", 0.5), "name": lmk[id(b)][0] if id(b) in lmk else None,
                                 "near_road": bool(road_near.intersects(q))})
                continue
            if shop: walls(ctx, ring, 0, z_shop, "wall_signs" if gband == "signs" else "wall_shop", *MOD["signs" if gband == "signs" else "shop"])
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
    if DETAILED:
        import facades; facades.build(DETAILED, {"MATS": MATS, "mat": mat, "L": L, "OX": OX, "OY": OY, "A": A})
        print("detailed facades:", len(DETAILED), "buildings")

    # --- the option itself ---
    ob = MB([]); q = Polygon(OPTB["p"]).simplify(0.2); ring = [L(x, y) for x, y in q.exterior.coords]
    floors = 1 + int(''.join(ch for ch in FACT.get("Total floors", "G+9").split("+")[-1] if ch.isdigit()) or 9)
    grade = FACT.get("Grade", "B"); glassy = grade.startswith("A") or grade == "B+"
    FH, GH = S.get("floor_h", 4.1), S.get("ground_h", 5.6); H = GH + (floors - 1) * FH
    EXT = A[A.index("--exterior") + 1] if "--exterior" in A else None   # a building modelled on its own (scripts/skymark/blender/exterior.py)
    style = "opt_glass" if glassy else "opt_plaster"
    if EXT:
        pass   # placed after the entrance is found, below
    elif OID == "723-avenue":
        house_of_wadhwa(ob, q, ring, GH, FH, floors, H)
    elif OID in SPECS:
        facade_spec(ob, q, ring, GH, FH, floors, H, SPECS[OID])
    else:
        generic_option(ob, q, ring, GH, FH, floors, H, glassy, style)
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
    if OID == "723-avenue":
        house_of_wadhwa_front(ob, (ax, ay), (bx_, by), r, GH, FH, H)
    if EXT: pass
    elif SPECS.get(OID, {}).get("porte"): porte_cochere(ob, (ax, ay), (bx_, by), GH)
    else:
      boxm(ob, mx + nx * 3.2, my + ny * 3.2, GH - 0.1, GH + 0.45, cw, 6.4, ang, "canopy", bottom=True)
      for sgn in (-1, 1): cyl(ob, mx + nx * 6.0 + math.cos(ang) * sgn * cw * 0.42, my + ny * 6.0 + math.sin(ang) * sgn * cw * 0.42, 0, GH, 0.18, 0.18, 0, "metal", 12)
    if EXT:
        # the modelled building, in its own frame (x along the footprint's long axis, y across), moved onto the footprint
        fr = json.load(open(EXT + ".frame.json")); before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=EXT)
        Mx = Matrix.Translation((fr["C"][0] - OX, fr["C"][1] - OY, 0)) @ Matrix.Rotation(fr["phi"], 4, "Z")
        for o in set(bpy.data.objects) - before:
            if o.parent is None: o.matrix_world = Mx @ o.matrix_world
            o.name = "opt_" + OID + "_" + o.name
    else:
        ob.build("opt_" + OID, MATS)
        tm = text_mesh(BO["name"].upper(), 1.1, 0.08, "opt_name")
        tm.data.materials.append(MATS["opt_name"])
        tm.rotation_euler = (math.pi / 2, 0, ang); tm.location = (mx + nx * 6.45, my + ny * 6.45, GH + 0.18)
    if OID == "723-avenue":   # the brand on the crown, high on the front face
        for txt, size, dz in (("WADHWA", 2.2, 2.2), ("HOUSE OF", 0.85, 4.7)):
            t2 = text_mesh(txt, size, 0.08, "sign_723_" + txt.replace(" ", "_")); t2.data.materials.append(MATS["sign_text"])
            sx, sy = ax + (bx_ - ax) * 0.3, ay + (by - ay) * 0.3
            t2.rotation_euler = (math.pi / 2, 0, ang); t2.location = (sx + nx * 0.6, sy + ny * 0.6, H + dz)
    entrance = (mx + nx * 0.5, my + ny * 0.5); walk0 = (mx + nx * 16, my + ny * 16)
    back = max(38.0, H * 0.62); street_cam = None
    for side in (0.35, -0.35, 0.6, -0.6, 0.0, 0.9, -0.9):
        for kk in (1.0, 0.8, 1.25, 0.65, 1.5):
            c_ = (mx + nx * back * kk + math.cos(ang) * back * side, my + ny * back * kk + math.sin(ang) * back * side)
            if not built.buffer(1.5).contains(Point(c_[0] + OX, c_[1] + OY)) and not KEEP_OUT.contains(Point(c_[0] + OX, c_[1] + OY)) and not built.intersects(LineString([(c_[0] + OX, c_[1] + OY), (mx + nx * 8 + OX, my + ny * 8 + OY)])):
                street_cam = c_; break
        if street_cam: break
    if not street_cam:   # no clear spot in front: search all round for open ground with a clear view of the face
        others = unary_union([p for b_, p in bpolys if b_.get("opt") != OID]) if bpolys else Polygon()
        fx_, fy_ = mx + nx * 2 + OX, my + ny * 2 + OY
        for rad in (back, back * 0.8, back * 1.3, back * 0.6, back * 1.7):
            for t in np.linspace(0, math.tau, 48, endpoint=False):
                c_ = (fx_ + math.cos(t) * rad, fy_ + math.sin(t) * rad)
                if (math.cos(t) * nx + math.sin(t) * ny) < 0.2: continue   # stay in front of the face
                if not built.buffer(1.5).contains(Point(c_)) and not KEEP_OUT.contains(Point(c_)) and not others.intersects(LineString([c_, (fx_, fy_)])):
                    street_cam = (c_[0] - OX, c_[1] - OY); break
            if street_cam: break
    street_cam = street_cam or (mx + nx * back, my + ny * back)
    # make sure the walk starts on open ground (footpath or road)
    # and not under the station's stairs or viaduct, where the eye would sit inside the structure
    def _open(w): q = Point(w[0] + OX, w[1] + OY); return not built.contains(q) and not KEEP_OUT.contains(q)
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
                for sg in (-1, 1): boxm(stn, *R(k, sg * 10.4), 0, ZC0, 1.1, 1.1, ang, "pier_blue")   # blue square columns at the deck edge
                cyl(stn, *R(k, 0), 0, ZC0 - 1.6, 1.5, 1.5, 0, "concrete", 24)                              # the big round pier on the median
                boxm(stn, *R(k, 0), ZC0 - 1.6, ZC0, 1.8, 22.4, ang, "concrete", bottom=True)
            boxm(stn, px, py, ZC0, ZC0 + 0.45, 98, 23.6, ang, "concrete", bottom=True)            # concourse floor slab
            boxm(stn, px, py, ZC1, ZC1 + 0.6, 100, 24.4, ang, "concrete", bottom=True)            # platform slab over it
            boxm(stn, px, py, ZC0 + 0.45, ZC0 + 0.5, 97, 22.8, ang, "pavers")                     # concourse floor finish (seen through the glass)
            for sg in (-1, 1):
                n = sg * 11.6
                boxm(stn, *R(0, n), ZC0 + 0.45, ZC0 + 1.4, 98, 0.35, ang, "metal")                 # ACP base band
                boxm(stn, *R(0, sg * 11.5), ZC0 + 1.4, ZC1 - 1.3, 97, 0.12, ang, "acp_station")    # opaque cladding
                boxm(stn, *R(0, sg * 11.5), ZC1 - 1.3, ZC1 - 0.1, 97, 0.06, ang, "station_glass")  # clerestory glazing
                ads = ["ad_white", "ad_red", "ad_blue", "ad_yellow", "ad_white", "ad_blue"]
                for i_, k in enumerate(np.arange(-40, 41, 16)):                                      # billboard band
                    boxm(stn, *R(k, n + sg * 0.25), ZC0 + 1.7, ZC0 + 4.6, 13.5, 0.15, ang, ads[(i_ + (sg > 0)) % len(ads)])
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
            prof = [(n, ZD + 8.0 + 0.9 * math.cos(n / HALF * math.pi / 2)) for n in np.linspace(-HALF, HALF, 21)]
            pr2 = prof + [(n, z + 0.18) for n, z in prof[::-1]]
            line2 = [(px - ca * 74, py - sa * 74), (px + ca * 74, py + sa * 74)]
            sweep(stn, line2, pr2, "station_roof", 6)
            for sg in (-1, 1):   # eaves fascia and gutter
                sweep(stn, line2, [(sg * HALF - 0.3, ZD + 7.3), (sg * HALF + 0.35, ZD + 7.3), (sg * HALF + 0.35, ZD + 8.6), (sg * HALF - 0.3, ZD + 8.6)], "acp_station", 6)
            for k in np.arange(-72, 72.1, 6):   # ribs: a curved steel I-section under the roof skin, on posts
                rib = [(n, z - 0.05) for n, z in prof]; ribb = [(n, z - 0.75) for n, z in prof[::-1]]
                sweep(stn, [R(k - 0.12, 0), R(k + 0.12, 0)], rib + ribb, "metal", 2)
                for sg in (-1, 1): boxm(stn, *R(k, sg * 11.3), ZD + 1.1, ZD + 7.9, 0.35, 0.35, ang, "pier_blue")
            for sg in (-1, 1):   # a purlin line each side, and the ridge
                for nn in (sg * 5.0, sg * 10.0):
                    zz = ZD + 8.0 + 0.9 * math.cos(nn / HALF * math.pi / 2) - 0.85
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
                    boxm(stn, bx2, by2, ZC0 + 3.0, ZC0 + 3.25, 24, 4.4, ang, "roof_blue")           # canopy
                    for k in (-11, -3.5, 3.5, 11):
                        for side in (-1, 1): cyl(stn, bx2 + ca * k + nx2 * side * 2.0, by2 + sa * k + ny2 * side * 2.0, 0, ZC0 + 3.0, 0.1, 0.1, 0, "pier_blue", 8)
                    boxm(stn, bx2 + nx2 * -sg * 2.5, by2 + ny2 * -sg * 2.5, ZC0, ZC0 + 0.45, 6, 5, ang, "concrete")   # landing to the concourse
            for e in (-1, 1):   # lift and stair core: white cladding framed in blue, rising to the platform
                lx, ly = R(e * 47, 14.5)
                boxm(stn, lx, ly, 0, ZD + 4.5, 5.2, 5.2, ang, "acp_white")
                for c_ in ((-2.6, -2.6), (2.6, -2.6), (2.6, 2.6), (-2.6, 2.6)):
                    boxm(stn, lx + ca * c_[0] - sa * c_[1], ly + sa * c_[0] + ca * c_[1], 0, ZD + 4.7, 0.35, 0.35, ang, "pier_blue")
                boxm(stn, lx, ly, ZD + 4.5, ZD + 4.9, 6.0, 6.0, ang, "roof_blue")
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
LANDMARKS = {}   # named neighbours (refs/*.json and the built-in landmarks), labelled in the explorer
def page_data(info):
    def inside(x, y, pad=0): return SLAB.buffer(-pad).contains(Point(x, y))
    trees = []
    # keep the view from the street to the entrance open
    E, W0 = info["entrance"], info["street_cam"]
    sight = LineString([W0, E]).buffer(9).union(Point(*W0).buffer(14)).union(Point(*info["walk0"]).buffer(10))
    for x, y, k in list(S["trees"]) + [(x_, y_, 1.0) for x_, y_ in EXTRA_TREES]:
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
            "walk0": [round(v, 1) for v in info["walk0"]], "street_cam": [round(v, 1) for v in info["street_cam"]], "stations": info["stations"], "landmarks": [m for m in LANDMARKS.values() if m.get("prop") or m["name"] in ("Times Square", "Fleet House")], "routes": routes,
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
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = int(sys.argv[sys.argv.index("--samples") + 1]) if "--samples" in sys.argv else 16 if FAST else 64; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 8
    sc.render.resolution_x, sc.render.resolution_y = size; sc.render.resolution_percentage = int(sys.argv[sys.argv.index("--pct") + 1]) if "--pct" in sys.argv else 40 if FAST else 100
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

def swap_hero(path):
    """--hero-blend: replace the generated opt_<id> with the photo-matched facade study
    (andheri-project/_build/exteriors/<id>.blend), moved onto this slab's footprint."""
    old = bpy.data.objects.get("opt_" + OID)
    with bpy.data.libraries.load(path, link=False) as (src, dst): dst.objects = ["opt_" + OID]
    new = dst.objects[0]
    if old: bpy.data.objects.remove(old, do_unlink=True)
    new.name = "opt_" + OID; bpy.context.scene.collection.objects.link(new)
    ring = np.array([L(x, y) for x, y in OPTB["p"]])
    bb = np.array([new.matrix_world @ __import__("mathutils").Vector(c) for c in new.bound_box])
    new.location.x += (ring[:, 0].min() + ring[:, 0].max()) / 2 - (bb[:, 0].min() + bb[:, 0].max()) / 2
    new.location.y += (ring[:, 1].min() + ring[:, 1].max()) / 2 - (bb[:, 1].min() + bb[:, 1].max()) / 2
    print("hero swapped from", path, "moved by", tuple(round(v, 2) for v in new.location))
    if "--hero-fit" in A:   # the study was shaped for another footprint: rotate and scale it onto this one's outline
        import mathutils as _mu
        V = np.array([new.matrix_world @ v.co for v in new.data.vertices])[:, :2]
        def rect(pts):
            r = shapely.MultiPoint([tuple(p) for p in pts]).minimum_rotated_rectangle; c_ = list(r.exterior.coords)[:4]
            e0, e1 = np.subtract(c_[1], c_[0]), np.subtract(c_[2], c_[1])
            if np.linalg.norm(e0) < np.linalg.norm(e1): e0, e1 = e1, e0
            return np.array(r.centroid.coords[0]), math.atan2(e0[1], e0[0]), np.linalg.norm(e0), np.linalg.norm(e1)
        ch, ah, lh, sh = rect(V[:: max(1, len(V) // 4000)]); ct, at, lt, st = rect(ring)
        # An irregular footprint's minimum rectangle can sit turned off the real walls (Corporate Avenue: -11.6 deg against
        # walls 1.5 deg off east-west), which skews the hero into its neighbour. Use the walls' own direction instead: the
        # length-weighted mean of the edge angles (mod 90), the representative nearest the rectangle's (keeps the facing),
        # and the footprint's extent and centre measured along it.
        E = np.diff(np.vstack([ring, ring[:1]]), axis=0); wl = np.hypot(E[:, 0], E[:, 1]); th = np.arctan2(E[:, 1], E[:, 0])
        aw = math.atan2((wl * np.sin(4 * th)).sum(), (wl * np.cos(4 * th)).sum()) / 4
        aw = min((aw + k * math.pi / 2 for k in range(-4, 5)), key=lambda a: abs((a - at + math.pi) % (2 * math.pi) - math.pi))
        aw = (aw + math.pi) % (2 * math.pi) - math.pi
        u, w_ = np.array([math.cos(aw), math.sin(aw)]), np.array([-math.sin(aw), math.cos(aw)])
        pu, pw = ring @ u, ring @ w_
        if abs(math.degrees(aw - at)) > 0.5:
            print("hero fit: walls run %.1f deg, minimum rectangle %.1f deg; using the walls" % (math.degrees(aw), math.degrees(at)))
            at, lt, st = aw, pu.max() - pu.min(), pw.max() - pw.min()
            ct = u * (pu.max() + pu.min()) / 2 + w_ * (pw.max() + pw.min()) / 2
        M = (_mu.Matrix.Translation((*ct, 0)) @ _mu.Matrix.Rotation(at, 4, "Z") @ _mu.Matrix.Diagonal((lt / lh, st / sh, 1, 1))
             @ _mu.Matrix.Rotation(-ah, 4, "Z") @ _mu.Matrix.Translation((-ch[0], -ch[1], 0)))
        new.matrix_world = M @ new.matrix_world
        print("hero fitted: %.1f x %.1f m -> %.1f x %.1f m, turned %.1f deg" % (lh, sh, lt, st, math.degrees(at - ah)))

def bake_ao(outdir, tiles=2, size=4096, dist=14.0, samples=96):
    """--bake-ao: bake ambient occlusion (how much open sky each surface sees) into a second UV set (LM)
    for the static meshes, one JPEG per mesh, plus <id>-ao.json naming them. The page uses them as
    aoMaps: they darken the sky light in streets, courtyards and under the viaduct, while the sun and its
    shadows stay live. The big context mesh is first cut into tiles x tiles pieces for texel density."""
    import bmesh as _bm
    sc = bpy.context.scene; os.makedirs(outdir, exist_ok=True)
    def split(ob, n):
        if not ob: return []
        me = ob.data; pts = np.array([p.center[:] for p in me.polygons])
        if len(pts) == 0: return []
        x0, x1, y0, y1 = pts[:, 0].min(), pts[:, 0].max() + 1e-3, pts[:, 1].min(), pts[:, 1].max() + 1e-3
        out = []
        for i in range(n):
            for j in range(n):
                keep = (pts[:, 0] >= x0 + (x1 - x0) * i / n) & (pts[:, 0] < x0 + (x1 - x0) * (i + 1) / n) & (pts[:, 1] >= y0 + (y1 - y0) * j / n) & (pts[:, 1] < y0 + (y1 - y0) * (j + 1) / n)
                if not keep.any(): continue
                bm = _bm.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
                _bm.ops.delete(bm, geom=[f for f in bm.faces if not keep[f.index]], context="FACES")
                m2 = me.copy(); bm.to_mesh(m2); bm.free()
                o2 = bpy.data.objects.new(f"{ob.name}_{i}{j}", m2); sc.collection.objects.link(o2); o2.matrix_world = ob.matrix_world; out.append(o2)
        bpy.data.objects.remove(ob, do_unlink=True); return out
    targets = []
    for nm in ("context", "rooftops", "ground"):
        targets += split(bpy.data.objects.get(nm), tiles if nm == "context" else 1 if nm == "rooftops" else 2)
    for nm in ("metro", "stations", "entries_l3", "opt_" + OID, "roof_garden_723", "lobby_723", "plinth", "nb_roof_723", "campus_corporate", *("nb_" + n for n in NEIGH)):
        if bpy.data.objects.get(nm): targets.append(bpy.data.objects[nm])
    sc.render.engine = "CYCLES"; sc.cycles.samples = samples; sc.cycles.use_denoising = True
    try:
        pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = "METAL"; pr.get_devices()
        for dv in pr.devices: dv.use = True
        sc.cycles.device = "GPU"
    except Exception as e: print("GPU unavailable", e)
    try: sc.world.light_settings.distance = dist
    except Exception: pass
    out = {}
    for ob in targets:
        me = ob.data
        if len(me.polygons) == 0: continue
        if "LM" not in me.uv_layers: me.uv_layers.new(name="LM")
        uv0 = me.uv_layers[0].name; me.uv_layers.active = me.uv_layers["LM"]
        bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002, area_weight=1.0, scale_to_bounds=True)
        bpy.ops.object.mode_set(mode="OBJECT")
        sz = size if ob.name.startswith(("context", "ground")) else 2048
        im = bpy.data.images.new("AO_" + ob.name, sz, sz, alpha=False, float_buffer=False); im.generated_color = (1, 1, 1, 1)
        nodes = []
        for slot in ob.material_slots:
            if not slot.material: continue
            slot.material.use_nodes = True; nt = slot.material.node_tree
            n = nt.nodes.new("ShaderNodeTexImage"); n.image = im; nt.nodes.active = n; nodes.append((nt, n))
        t0 = __import__("time").time()
        bpy.ops.object.bake(type="AO", uv_layer="LM", margin=6, use_clear=True)
        fn = f"{OID}-ao-{ob.name}.jpg"; im.filepath_raw = os.path.join(outdir, fn); im.file_format = "JPEG"; im.save()
        for nt, n in nodes: nt.nodes.remove(n)
        me.uv_layers.active = me.uv_layers[uv0]
        try: me.uv_layers[uv0].active_render = True
        except Exception: pass
        out[ob.name] = fn; print("baked AO", ob.name, sz, round(__import__("time").time() - t0, 1), "s")
    json.dump({"uv": "LM", "maps": out}, open(os.path.join(outdir, f"{OID}-ao.json"), "w"), indent=1)

def lobby_723(info, GH=5.6, W_=16.0, D_=12.0):
    """--lobby: the street-level entrance lobby of 723 Avenue, from the developer's brochure render (glazed
    double-height ground floor, steps and a ramp to a raised forecourt, a canopy). In Feb 2026 Street View the
    ground floor is still behind hoarding, so this is the developer's design, not the as-built lobby. Interior
    fit-out (stone floor, reception desk, timber-fin feature wall, lift doors, lit coffer) is a proposal."""
    import bmesh as _bm, mathutils as _mu
    for k, c, r_, m_ in (("lobby_floor", "#d9d3c7", 0.18, 0.0), ("lobby_stone", "#26272a", 0.25, 0.0), ("lobby_ceiling", "#efede8", 0.8, 0.0),
                         ("door_metal", "#2a2c2e", 0.35, 0.8), ("granite", "#5d5b58", 0.45, 0.0)):
        mat(k, c, r_, m_)
    mat("lobby_light", "#fff4e0", 0.4, emit="#fff1d6", ek=2.5)
    E = info["entrance"]; F = info["canopy_ang"]; nx, ny = math.sin(F), -math.cos(F); tx, ty = math.cos(F), math.sin(F)
    foot_l = Polygon([L(x, y) for x, y in OPTB["p"]])
    if foot_l.contains(Point(E[0] + nx * 5, E[1] + ny * 5)): nx, ny, F = -nx, -ny, F + math.pi; tx, ty = -tx, -ty   # make v point out of the building
    lobby_723.out = (nx, ny, tx, ty, F)
    P = lambda u, v: (E[0] + tx * u + nx * v, E[1] + ty * u + ny * v)   # u along the face, v outward (negative = inside)
    # open the ground storey of the facade study where the lobby is (it was modelled solid)
    hero = bpy.data.objects.get("opt_" + OID)
    if hero and hero.type == "MESH":
        bm = _bm.new(); bm.from_mesh(hero.data); mw = hero.matrix_world; cut = []
        for f in bm.faces:
            c = mw @ f.calc_center_median(); u = (c.x - E[0]) * tx + (c.y - E[1]) * ty; v = (c.x - E[0]) * nx + (c.y - E[1]) * ny
            if c.z < GH - 0.1 and abs(u) < W_ / 2 and -D_ - 0.5 < v < 3.0: cut.append(f)
        _bm.ops.delete(bm, geom=cut, context="FACES"); bm.to_mesh(hero.data); bm.free(); print("lobby: opened", len(cut), "facade faces")
    if bpy.data.objects.get("opt_name"): bpy.data.objects.remove(bpy.data.objects["opt_name"], do_unlink=True)   # the canopy carries the name now
    lb = MB([]); z0 = 0.6
    rect = lambda u0, u1, v0, v1: Polygon([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)])
    # the lobby box: stone floor, lit ceiling with a coffer, side and back walls
    flat(lb, rect(-W_ / 2, W_ / 2, -D_, 0), z0, "lobby_floor", 1.2)
    flat(lb, rect(-W_ / 2, W_ / 2, -D_, 0), GH - 0.3, "lobby_ceiling", 2, up=False)
    flat(lb, rect(-W_ / 2 + 2, W_ / 2 - 2, -D_ + 2, -1.5), GH - 0.35, "lobby_light", 2, up=False)
    boxm(lb, *P(0, -D_ - 0.1), 0, GH, W_ + 0.4, 0.2, F, "lobby_ceiling")                     # back wall
    for e in (-1, 1): boxm(lb, *P(e * (W_ / 2 + 0.1), -D_ / 2), 0, GH, 0.2, D_ + 0.2, F, "lobby_ceiling")   # side walls
    # back wall: timber-fin feature wall with the lift doors in it
    for k in np.arange(-W_ / 2 + 0.4, W_ / 2 - 0.3, 0.35):
        if abs(k) < 3.2: continue
        boxm(lb, *P(k, -D_ + 0.25), z0, GH - 0.3, 0.12, 0.3, F, "fin_timber")
    for k in (-1.8, 0.0, 1.8):
        boxm(lb, *P(k, -D_ + 0.12), z0, z0 + 2.4, 1.3, 0.1, F, "door_metal")
    # reception desk and planters
    boxm(lb, *P(-3.5, -6.5), z0, z0 + 1.1, 5.0, 1.0, F, "lobby_stone"); boxm(lb, *P(-3.5, -6.5), z0 + 1.1, z0 + 1.16, 5.2, 1.2, F, "lobby_floor")
    for k in (5.2, 6.4):
        cyl(lb, *P(k, -9.5), z0, z0 + 0.7, 0.5, 0.5, 0, "planter", 14); cyl(lb, *P(k, -9.5), z0 + 0.7, z0 + 2.2, 0.75, 0.75, 0, "canopy_leaf", 12)
    # glazed front: full-height clear glass on slim dark mullions, a pair of entrance doors
    boxm(lb, *P(0, 0.05), z0, GH, W_, 0.04, F, "rail_glass")
    for k in np.arange(-W_ / 2, W_ / 2 + 0.01, 2.0):
        boxm(lb, *P(k, 0.08), z0, GH, 0.08, 0.16, F, "door_metal")
    boxm(lb, *P(0, 0.12), z0 + 2.6, z0 + 2.75, W_, 0.18, F, "door_metal")   # transom
    # raised forecourt, steps across the front and a ramp at one end, in granite
    flat(lb, rect(-W_ / 2 - 1, W_ / 2 + 1, 0, 4.0), z0, "granite", 1.5)
    boxm(lb, *P(0, 2.0), 0, z0 - 0.02, W_ + 2, 4.0, F, "granite")          # the plinth under the forecourt
    for i in range(4):
        st = i * 0.15; boxm(lb, *P(-1.5, 4.0 + 0.35 * (4 - i) - 0.175), 0, z0 - st, 13.0, 0.35, F, "granite")
    ram = [P(W_ / 2 - 1.8, 4.0), P(W_ / 2 + 1, 4.0), P(W_ / 2 + 1, 10.0), P(W_ / 2 - 1.8, 10.0)]
    lb.poly([(*ram[0], z0), (*ram[1], z0), (*ram[2], 0.02), (*ram[3], 0.02)], [(0, 0), (1, 0), (1, 1), (0, 1)], "granite")
    # canopy over the entrance: a thin dark slab with a lit soffit
    boxm(lb, *P(-1.5, 2.2), GH + 0.1, GH + 0.5, 14.0, 4.8, F, "door_metal", bottom=True)
    flat(lb, rect(-8.0, 5.0, 0.4, 4.2), GH + 0.08, "lobby_light", 2, up=False)
    lb.build("lobby_723", MATS); print("lobby built at", tuple(round(v, 1) for v in E))
    t = text_mesh("723 AVENUE", 0.55, 0.05, "sign_723_lobby"); t.data.materials.append(MATS["sign_text"])
    t.rotation_euler = (math.pi / 2, 0, F); t.location = (*P(-4.5, 4.62), GH + 0.18)

EXTRA_TREES = []   # (world x, y): trees added by --campus, placed by the page with the district's own tree models
def campus(gate_off=None):
    """--campus: Corporate Avenue reads as a gated campus (satellite and the founder): a compound wall, two gates
    on the main road (Guru Hargovindji Road) on either side of the long block, paved driveways and parking around
    the buildings, and a planted edge with trees. Gate details and planting are proposals; the layout follows
    the satellite view, which shows a driveway on each side of the block running in from the main road."""
    from shapely.ops import nearest_points
    mat("gate_pillar", "#d8d4ca", 0.6); mat("boom", "#d23b2c", 0.4); mat("cabin", "#e9e6de", 0.6)
    q = Polygon(OPTB["p"]); c = q.centroid
    roads = unary_union([Polygon(r[0], r[1:]).buffer(0) for r in S["roads"]["major"] if Polygon(r[0]).distance(q) < 250])
    MAIN = Point(*(float(v) for v in A[A.index("--campus-road") + 1].split(","))) if "--campus-road" in A else nearest_points(c, roads)[1]
    rp = nearest_points(MAIN, roads)[1] if roads.distance(MAIN) < 40 else MAIN   # a point on the main road (Guru Hargovindji Road)
    n = np.array([rp.x - c.x, rp.y - c.y]); n /= np.linalg.norm(n); t = np.array([-n[1], n[0]])
    others = unary_union([Polygon(b["p"]).buffer(1.0) for b in S["buildings"] if b is not OPTB and Polygon(b["p"]).distance(q) < 40])
    # the campus: every footprint inside --campus-box (x0,y0,x1,y1, scene metres), from the main road to the option's block
    bx_ = [float(v) for v in A[A.index("--campus-box") + 1].split(",")] if "--campus-box" in A else None
    members = [Polygon(b["p"]) for b in S["buildings"] if bx_ and bx_[0] <= Polygon(b["p"]).centroid.x <= bx_[2] and bx_[1] <= Polygon(b["p"]).centroid.y <= bx_[3]] + [q]
    others = unary_union([Polygon(b["p"]).buffer(1.0) for b in S["buildings"] if b is not OPTB and Polygon(b["p"]).distance(q) < 160 and not any(Polygon(b["p"]).equals(m_) for m_ in members)])
    hull = unary_union(members).convex_hull.buffer(8, join_style="mitre")
    # reach the main road: extend the hull towards it, then cut at the road edge
    hull = unary_union([hull, hull.buffer(0).union(Polygon([*hull.exterior.coords])).convex_hull, LineString([hull.centroid, rp]).buffer(28)]).convex_hull
    parcel = hull.difference(roads.buffer(1.5)).difference(others)
    if parcel.geom_type == "MultiPolygon": parcel = max(parcel.geoms, key=lambda g: g.area if g.intersects(q) else 0)
    cp = MB([])
    inner = parcel.buffer(-3.0)
    if inner.geom_type == "MultiPolygon": inner = max(inner.geoms, key=lambda g: g.area)
    flat(cp, lpoly(parcel.difference(q.buffer(0.5))), 0.07, "grass", 3)                 # planted edge
    if not inner.is_empty: flat(cp, lpoly(inner.difference(q.buffer(0.5))), 0.09, "asphalt", 6)   # driveways and parking
    # parking bays along the inner edge
    if not inner.is_empty and inner.geom_type == "Polygon":
        ring = LineString(inner.exterior.coords)
        for s_ in np.arange(0, ring.length, 2.6):
            p = ring.interpolate(s_); p2 = ring.interpolate(min(ring.length, s_ + 0.5)); a_ = math.atan2(p2.y - p.y, p2.x - p.x)
            if q.buffer(6).contains(p): continue
            boxm(cp, *L(p.x - math.sin(a_) * 2.5, p.y + math.cos(a_) * 2.5), 0.1, 0.12, 0.12, 5.0, a_, "marking")
    # two gates where the driveways meet the main road: either side of the block
    w = max(e for e in (math.dist(*list(q.minimum_rotated_rectangle.exterior.coords)[i:i + 2]) for i in range(2)))
    half = abs(np.dot(np.array(q.exterior.coords) - np.array(c.coords[0]), t)).max()
    gates = []
    GT = [tuple(float(v) for v in g.split(",")) for g in A[A.index("--campus-gates") + 1].split(";")] if "--campus-gates" in A else \
         [(c.x + t[0] * sg * (half + 7) + n[0] * 200, c.y + t[1] * sg * (half + 7) + n[1] * 200) for sg in (-1, 1)]
    for gx_, gy_ in GT:
        gates.append(nearest_points(parcel.exterior, Point(gx_, gy_))[0])
    # the compound wall, broken at the gates
    ext = LineString(parcel.exterior.coords); gap = unary_union([gp.buffer(4.5) for gp in gates])
    wall = ext.difference(gap)
    for seg in (wall.geoms if hasattr(wall, "geoms") else [wall]):
        cs = list(seg.coords)
        for a, b in zip(cs[:-1], cs[1:]):
            d = math.dist(a, b)
            if d < 0.2: continue
            boxm(cp, *L((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), 0, 2.2, d, 0.25, math.atan2(b[1] - a[1], b[0] - a[0]), "gate_pillar")
    for i, gp in enumerate(gates):
        tt = np.array(nearest_points(ext, Point(gp.x + 0.01, gp.y))[0].coords[0]) - np.array(gp.coords[0])
        a_ = math.atan2(*(lambda v: (v[1], v[0]))(t))    # gate line along the road
        for e in (-1, 1):
            boxm(cp, *L(gp.x + t[0] * e * 4.5, gp.y + t[1] * e * 4.5), 0, 3.4, 0.9, 0.9, a_, "gate_pillar")
        boxm(cp, *L(gp.x + t[0] * -2.0, gp.y + t[1] * -2.0), 1.0, 1.12, 6.0, 0.12, a_, "boom")
        cx_, cy_ = gp.x - n[0] * 4 + t[0] * 7.5, gp.y - n[1] * 4 + t[1] * 7.5
        boxm(cp, *L(cx_, cy_), 0, 2.7, 2.6, 2.6, a_, "cabin"); boxm(cp, *L(cx_, cy_), 2.7, 2.95, 3.4, 3.4, a_, "canopy")
        if i == 0:
            boxm(cp, *L(gp.x, gp.y), 3.4, 4.2, 10.0, 0.9, a_, "canopy")
            tm = text_mesh("CORPORATE AVENUE", 0.5, 0.04, "sign_corporate_gate"); tm.data.materials.append(MATS["sign_text"])
            tm.rotation_euler = (math.pi / 2, 0, a_ + (math.pi if np.dot(n, [math.sin(a_), -math.cos(a_)]) < 0 else 0)); tm.location = (*L(gp.x + n[0] * 0.5, gp.y + n[1] * 0.5), 3.55)
    # trees along the planted edge
    pb = parcel.buffer(-1.6)
    if pb.geom_type == "MultiPolygon": pb = max(pb.geoms, key=lambda g: g.area)
    for s_ in np.arange(3, ext.length, 9):
        p = pb.exterior.interpolate(s_) if not pb.is_empty else None
        if p is None or gap.buffer(3).contains(p) or q.buffer(3).contains(p): continue
        EXTRA_TREES.append((p.x, p.y))
    campus.members = members
    cp.build("campus_corporate", MATS); print("campus: parcel", round(parcel.area), "m2, gates at", [tuple(round(v) for v in L(g.x, g.y)) for g in gates])

def roof_garden(H, foot=None, name="roof_garden_723"):
    """--roof-garden: the developer brochure's rooftop for 723 Avenue (House of Wadhwa): a timber deck,
    a curving planted band with trees, checkerboard paving, a glazed pavilion with timber fins and a
    glass railing inside the fin screen. Layout proportions are read from the brochure image; sizes are estimates."""
    mat("deck_wood", "#8a6a4a", 0.7); mat("pave_dark", "#2c2e31", 0.6); mat("pave_light", "#d9d6cf", 0.6)
    mat("planter", "#5a4a3c", 0.8); mat("soil_green", "#3f5f2a", 0.95); mat("fin_timber", "#b36a2c", 0.6)
    mat("rail_glass", "#9fb8c2", 0.05, 0.2, alpha=0.3); mat("canopy_leaf", "#3c6a2c", 0.9); mat("trunk", "#4b3a2c", 0.9)
    q = Polygon(foot or OPTB["p"]).simplify(0.2); rr = q.minimum_rotated_rectangle
    cs = list(rr.exterior.coords)[:4]; e0 = np.subtract(cs[1], cs[0]); e1 = np.subtract(cs[2], cs[1])
    ax = e0 if np.linalg.norm(e0) >= np.linalg.norm(e1) else e1; ang = math.atan2(ax[1], ax[0])
    Lg, Sh = max(np.linalg.norm(e0), np.linalg.norm(e1)), min(np.linalg.norm(e0), np.linalg.norm(e1))
    c = q.centroid; ca, sa = math.cos(ang), math.sin(ang)
    def W(u, v): return (c.x + u * ca - v * sa, c.y + u * sa + v * ca)      # roof frame: u along the long side
    z = H + 0.25; rg = MB([])
    deck = q.buffer(-1.0); flat(rg, lpoly(deck), z, "deck_wood", 1.2)
    walls(rg, [L(*p) for p in deck.exterior.coords], z, z + 1.15, "rail_glass", 2, 2)
    # pavilion at one end (a third of the long side), glazed, with a band of timber fins
    pu0, pu1 = Lg * 0.18, Lg * 0.48; pv = Sh * 0.42
    pav = Polygon([W(pu0, -pv), W(pu1, -pv), W(pu1, pv), W(pu0, pv)]).intersection(deck)
    if not pav.is_empty and pav.geom_type == "Polygon":
        ring = [L(*p) for p in pav.exterior.coords]
        walls(rg, ring, z, z + 4.2, "glass_lobby", 2, 2); flat(rg, lpoly(pav.buffer(0.6)), z + 4.2, "roof", 4)
        walls(rg, [L(*p) for p in pav.buffer(0.6).exterior.coords], z + 3.9, z + 4.6, "slab_edge", 2, 2)
        for k in range(14):   # timber fins on the face toward the garden
            t = k / 13; px, py = W(pu0, -pv + 0.3 + t * (2 * pv - 0.6)); boxm(rg, *L(px, py), z, z + 3.9, 0.18, 0.6, ang, "fin_timber")
    # checkerboard paving between the pavilion and the garden
    tile = 1.2; cu0, cu1 = -Lg * 0.05, Lg * 0.16
    for i, u in enumerate(np.arange(cu0, cu1, tile)):
        for j, v in enumerate(np.arange(-Sh * 0.3, Sh * 0.3, tile)):
            t_ = Polygon([W(u, v), W(u + tile, v), W(u + tile, v + tile), W(u, v + tile)])
            if deck.contains(t_): flat(rg, lpoly(t_), z + 0.03, "pave_dark" if (i + j) % 2 else "pave_light", 1.2)
    # a curving planted band across the other half, with small trees
    band = LineString([W(u, Sh * 0.32 * math.sin((u + Lg * 0.5) / (Lg * 0.5) * math.pi * 1.2)) for u in np.linspace(-Lg * 0.48, -Lg * 0.06, 30)])
    pl = band.buffer(1.1).intersection(deck)
    for g in (pl.geoms if hasattr(pl, "geoms") else [pl]):
        if g.geom_type != "Polygon": continue
        walls(rg, [L(*p) for p in g.exterior.coords], z, z + 0.7, "planter", 2, 2); flat(rg, lpoly(g), z + 0.65, "soil_green", 2)
    for k, t in enumerate(np.linspace(0.05, 0.95, 7)):
        p = band.interpolate(t, normalized=True); h_ = 2.6 + (k % 3) * 0.7
        cyl(rg, *L(p.x, p.y), z + 0.65, z + h_, 0.12, 0.12, 0, "trunk", 8)
        cyl(rg, *L(p.x, p.y), z + h_ - 0.4, z + h_ + 1.4, 1.5, 1.3, k, "canopy_leaf", 12)
    # planters along the railing, as in the brochure's edge greenery
    edge = deck.exterior
    for t in np.linspace(0, 1, 26, endpoint=False):
        p = edge.interpolate(t, normalized=True); cyl(rg, *L(p.x, p.y), z, z + 0.9, 0.7, 0.7, 0, "canopy_leaf", 10)
    rg.build(name, MATS); print("roof garden built", round(Lg, 1), "x", round(Sh, 1), "m at", round(z, 1))

def animate(data, info, spec_path, name):
    """--anim SPEC.json NAME: a keyframed camera move rendered as a PNG sequence to OUT/NAME/, with every frame's
    screen position of the named pins written to OUT/NAME/pins.json (for labels that track in the edit).
    SPEC[NAME] = {"frames": N, "fps": 24, "keys": [{"f", "pos": [x,y,z], "look": [x,y,z], "lens"}], "pins": {name: [x,y,z]}}
    in scene metres; lighting comes from the same flags as aerial() (--hdri, --sky-mode, --sun-az/-el, --night...)."""
    from bpy_extras.object_utils import world_to_camera_view
    sp = json.load(open(spec_path))[name]
    sc = bpy.context.scene
    aerial(data, info, "_setup", az_off=((sp["keys"][0]["pos"][0], sp["keys"][0]["pos"][1], sp["keys"][0]["pos"][2]), tuple(sp["keys"][0]["look"]), sp["keys"][0].get("lens", 28)), render_now=False)
    cam = sc.camera; cd = cam.data; cd.sensor_width = 36
    tgt = bpy.data.objects.new("cam_target", None); sc.collection.objects.link(tgt)
    for c in list(cam.constraints): cam.constraints.remove(c)
    tc = cam.constraints.new("TRACK_TO"); tc.target = tgt; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
    for k in sp["keys"]:
        sc.frame_set(k["f"] + 1)
        cam.location = (k["pos"][0] - OX, k["pos"][1] - OY, k["pos"][2]); cam.keyframe_insert("location", frame=k["f"] + 1)
        tgt.location = (k["look"][0] - OX, k["look"][1] - OY, k["look"][2]); tgt.keyframe_insert("location", frame=k["f"] + 1)
        cd.lens = k.get("lens", 28); cd.keyframe_insert("lens", frame=k["f"] + 1)
    for ob in (cam, tgt, cd):
        ad = ob.animation_data
        if ad and ad.action:
            try: fcs = ad.action.fcurves
            except Exception: fcs = [fc for l in ad.action.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]
            for fc in fcs:
                for kp in fc.keyframe_points: kp.interpolation = "BEZIER"; kp.easing = "AUTO"; kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
    sc.frame_start, sc.frame_end = 1, sp["frames"]; sc.render.fps = sp.get("fps", 24)
    out = os.path.join(OUT, name); os.makedirs(out, exist_ok=True)
    pins = {}
    import mathutils
    for f in range(1, sp["frames"] + 1):
        sc.frame_set(f)
        pins[f] = {k: [round(c, 4) for c in world_to_camera_view(sc, cam, mathutils.Vector((v[0] - OX, v[1] - OY, v[2])))] for k, v in sp.get("pins", {}).items()}
    json.dump({"fps": sc.render.fps, "frames": sp["frames"], "pins": pins}, open(os.path.join(out, "pins.json"), "w"))
    sc.render.use_persistent_data = True
    sc.render.use_overwrite = False   # resume: frames already on disk are kept
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGB"; sc.render.image_settings.color_depth = "8"
    sc.render.filepath = os.path.join(out, "f_####")
    if "--frames" in A: sc.frame_start, sc.frame_end = (int(v) for v in A[A.index("--frames") + 1].split("-"))
    if "--frame-step" in A: sc.frame_step = int(A[A.index("--frame-step") + 1])   # render every Nth frame first; a later pass fills the rest
    bpy.ops.render.render(animation=True); print("ANIM DONE", name, sc.frame_start, sc.frame_end)

def hdri_light(sc):
    """--hdri FILE [--sun-az DEG --sun-el DEG --sky K --sun K --night 0..1]: a real sky (Poly Haven CC0 HDRI) turned so
    its glow sits where the real sun is, plus a sun lamp at the computed solar position for crisp shadows.
    Compass azimuth: 0 north, 90 east. Night drives the hero's lit interiors (object property 'night')."""
    g = lambda k, d: float(A[A.index(k) + 1]) if k in A else d
    az, el = g("--sun-az", 246.0), g("--sun-el", 5.5)
    w = bpy.data.worlds.new("hdri"); sc.world = w; w.use_nodes = True; nt = w.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(os.path.abspath(A[A.index("--hdri") + 1]))
    px = np.array(env.image.pixels[:], dtype=np.float32).reshape(env.image.size[1], env.image.size[0], 4)[..., :3].sum(-1)
    u = (np.unravel_index(px.argmax(), px.shape)[1] + 0.5) / env.image.size[0]
    az_hdr = math.pi / 2 - (0.5 - u) * 2 * math.pi
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value = (0, 0, math.radians(az) - az_hdr)
    nt.links.new(tc.outputs["Generated"], mp.inputs[0]); nt.links.new(mp.outputs[0], env.inputs[0])
    nt.links.new(env.outputs[0], nt.nodes["Background"].inputs[0]); nt.nodes["Background"].inputs[1].default_value = g("--sky", 1.0)
    sun = bpy.data.lights.get("sun")
    if sun:
        sun.energy = g("--sun", 3.0) * max(0.0, math.sin(math.radians(max(el, 0))) * 4 + 0.15) if el > 0 else 0.0
        sun.color = (1.0, 0.72, 0.48) if el < 12 else (1, 0.93, 0.82); sun.angle = math.radians(1.2)
        bpy.data.objects["sun"].rotation_euler = (math.radians(90 - el), 0, -math.radians(az + 180))
    lit_ = []
    for o in bpy.data.objects:
        if o.name.startswith("opt_") or o.name.startswith("nb_") or o.name == "farfield": o["night"] = g("--night", 0.0); lit_.append(o.name)
    cm = bpy.data.materials.get("ANDHERI_PRV_Ceiling")
    print("night set on", lit_, "| ceiling material", bool(cm), [(n.bl_idname, getattr(n, "attribute_name", ""), getattr(n, "attribute_type", "")) for n in cm.node_tree.nodes if n.bl_idname == "ShaderNodeAttribute"] if cm else None)
    hz = bpy.data.objects.get("haze")
    if hz and "--haze" not in A: bpy.data.objects.remove(hz, do_unlink=True)
    elif hz:   # aerial perspective over the far city, tinted to the hour
        hz.scale = (9000, 9000, 600); hz.location.z = 300
        v = hz.data.materials[0].node_tree.nodes["Principled Volume"]
        v.inputs["Density"].default_value = g("--haze", 0.0003)
        v.inputs["Color"].default_value = (0.95, 0.82, 0.72, 1) if 0 < el < 12 else (0.62, 0.7, 0.86, 1) if el <= 0 else (0.86, 0.88, 0.92, 1)
    print("HDRI sky", os.path.basename(A[A.index("--hdri") + 1]), "sun az %.0f el %.1f" % (az, el))

def aerial(data, info, name="aerial", az_off=-0.6, dist_k=1.0, el_k=0.42, lens=35, render_now=True):
    """A photographic drone still of the district: GPU Cycles, a hazy Mumbai sky, aerial
    perspective from a thin world volume, no tilt-shift and no transparent film."""
    sc = bpy.context.scene
    if not getattr(aerial, "lit", False):
        place_instances(data); light(sc, az=235, el=38); aerial.lit = True
        sky = next(n for n in sc.world.node_tree.nodes if n.bl_idname == "ShaderNodeTexSky")
        for k_, v_ in (("air_density", 1.0), ("aerosol_density", 1.2), ("sun_intensity", 1.0)):
            try: setattr(sky, k_, v_)
            except Exception: pass
        sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.45; bpy.data.lights["sun"].energy = 4.2
        # haze in a bounded box (a world volume would swallow the sky and the sun at infinity)
        hm = bpy.data.materials.new("haze"); hm.use_nodes = True; ht = hm.node_tree; ht.nodes.remove(ht.nodes["Principled BSDF"])
        vol = ht.nodes.new("ShaderNodeVolumePrincipled"); vol.inputs["Density"].default_value = 0.00006
        vol.inputs["Color"].default_value = (0.86, 0.87, 0.9, 1); vol.inputs["Anisotropy"].default_value = 0.35
        ht.links.new(vol.outputs[0], ht.nodes["Material Output"].inputs["Volume"])
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 140)); hz = bpy.context.active_object; hz.name = "haze"
        hz.scale = (6000, 6000, 280); hz.data.materials.append(hm); hz.visible_shadow = False
        try:
            pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = "METAL"; pr.get_devices()
            for dv in pr.devices: dv.use = True
            sc.cycles.device = "GPU"
        except Exception as e: print("GPU unavailable", e)
        if "--hdri" in A: hdri_light(sc)
        if "--sky-mode" in A:   # realism/sky.py: what the camera sees of the sky (no foreign horizon from the HDRI photo)
            import sky; sky.setup(sc, {"A": A, "az": float(A[A.index("--sun-az") + 1]) if "--sun-az" in A else 246.0,
                                      "el": float(A[A.index("--sun-el") + 1]) if "--sun-el" in A else 5.5,
                                      "hdri": os.path.abspath(A[A.index("--hdri") + 1]) if "--hdri" in A else None})
    E = info["entrance"]; F = info["canopy_ang"]; nx, ny = math.sin(F), -math.cos(F); H = info["H"]
    bc = Polygon(data["building"]["foot"]).centroid
    if isinstance(az_off, tuple):   # explicit shot in the scene frame: (pos, look, lens)
        (px_, py_, pz_), (lx_, ly_, lz_) = az_off[0], az_off[1]
        camera(sc, (px_ - OX, py_ - OY, pz_), (lx_ - OX, ly_ - OY, lz_), az_off[2]); a = None
    else:
        a = math.atan2(ny, nx) + az_off; dist = max(420, H * 6) * dist_k
        camera(sc, (bc.x + math.cos(a) * dist, bc.y + math.sin(a) * dist, dist * el_k), (bc.x - math.cos(a) * 60, bc.y - math.sin(a) * 60, H * 0.2), lens)
    sc.render.engine = "CYCLES"; sc.cycles.samples = int(A[A.index("--samples") + 1]) if "--samples" in A else 96; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 8; sc.cycles.volume_step_rate = 4
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080; sc.render.resolution_percentage = int(A[A.index("--pct") + 1]) if "--pct" in A else 100
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast" if "--hdri" in A else "AgX - Base Contrast"
    sc.view_settings.exposure = float(A[A.index("--exposure") + 1]) if "--exposure" in A else 0.0
    sc.render.film_transparent = False; sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGB"
    if not render_now: return
    sc.render.filepath = os.path.join(OUT, f"{OID}-{name}.png"); bpy.ops.render.render(write_still=True); print("rendered", name)

info = build()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import check_logic
SHOT_CAMS = {"prv_street": (1405, -380, 30), "prv_west": (1175, -300, 70), "prv_aerial": (1262, -430, 105), "road": (1440, -378, 24)}
_rk = A[A.index("--render") + 1:] if "--render" in A else []
check_logic.run({"S": S, "A": A, "OID": OID, "OUT": OUT, "L": L, "built": LOGIC.get("built", []), "ROAD": LOGIC["road"],
                 "SLAB": SLAB, "METRO_CLEAR": METRO_CLEAR, "on_road": LOGIC.get("on_road", []),
                 "cameras": [SHOT_CAMS[k] for k in _rk if k in SHOT_CAMS] +
                            ([tuple(k["pos"]) for k in json.load(open(A[A.index("--anim") + 1]))[A[A.index("--anim") + 2]]["keys"]] if "--anim" in A else [])})
if "--hero-blend" in A: swap_hero(A[A.index("--hero-blend") + 1])
if "--far-field" in A:   # realism/farfield.py: the rest of the city out to the horizon, beyond the slab
    if bpy.data.objects.get("plinth"): bpy.data.objects["plinth"].hide_render = True   # the city continues; no dollhouse edge
    import farfield; farfield.build(S, {"OX": OX, "OY": OY, "SLAB": SLAB, "L": L, "MATS": MATS, "mat": mat, "A": A, "radius": float(A[A.index("--far-field") + 1])})
if "--pbr" in A:         # realism/pbr.py: scanned CC0 materials on the shared named materials (asphalt, pavers, roof, concrete...)
    import pbr; pbr.apply(MATS, os.path.abspath(A[A.index("--pbr") + 1]))
for nid, path in NEIGH.items():
    nb = next((b for b in S["buildings"] if b.get("opt") == nid), None)
    if not nb: print("neighbour", nid, "not in this scene"); continue
    with bpy.data.libraries.load(path, link=False) as (src, dst): dst.objects = ["opt_" + nid]
    o = dst.objects[0]; o.name = "nb_" + nid; bpy.context.scene.collection.objects.link(o)
    ring = np.array([L(x, y) for x, y in nb["p"]]); bb = np.array([o.matrix_world @ __import__("mathutils").Vector(c) for c in o.bound_box])
    o.location.x += ring[:, 0].mean() * 0 + (ring[:, 0].min() + ring[:, 0].max()) / 2 - (bb[:, 0].min() + bb[:, 0].max()) / 2
    o.location.y += (ring[:, 1].min() + ring[:, 1].max()) / 2 - (bb[:, 1].min() + bb[:, 1].max()) / 2
    if nid in ("privilon",):   # studies built in their own frame: rotate and scale onto the footprint (as --hero-fit)
        import mathutils as _mu
        V = np.array([o.matrix_world @ v.co for v in o.data.vertices])[:, :2]
        def _rect(pts):
            r = shapely.MultiPoint([tuple(p) for p in pts]).minimum_rotated_rectangle; c_ = list(r.exterior.coords)[:4]
            e0, e1 = np.subtract(c_[1], c_[0]), np.subtract(c_[2], c_[1])
            if np.linalg.norm(e0) < np.linalg.norm(e1): e0, e1 = e1, e0
            return np.array(r.centroid.coords[0]), math.atan2(e0[1], e0[0]), np.linalg.norm(e0), np.linalg.norm(e1)
        ch, ah, lh, sh = _rect(V[:: max(1, len(V) // 4000)]); ct, at, lt, st = _rect(ring)
        o.matrix_world = (_mu.Matrix.Translation((*ct, 0)) @ _mu.Matrix.Rotation(at, 4, "Z") @ _mu.Matrix.Diagonal((lt / lh, st / sh, 1, 1))
                          @ _mu.Matrix.Rotation(-ah, 4, "Z") @ _mu.Matrix.Translation((-ch[0], -ch[1], 0))) @ o.matrix_world
        bb = np.array([o.matrix_world @ __import__("mathutils").Vector(c) for c in o.bound_box])
    if nid == "723-avenue": roof_garden(67.1, nb["p"], "nb_roof_723")
    c_ = Polygon(nb["p"]).centroid; lx_, ly_ = L(c_.x, c_.y)
    LANDMARKS[nid] = {"name": next((o_["name"] for o_ in BUNDLE["options"] if o_["id"] == nid), nid), "x": round(lx_, 1), "y": round(ly_, 1), "h": round(float(bb[:, 2].max()), 1), "prop": True}
    print("neighbour", nid, "placed", LANDMARKS[nid])
if "--roof-garden" in A: roof_garden(info["H"])
if "--glow-floors" in A:   # the offered floors lit from inside at dusk: "13,14" (ground 5.6 m, 4.1 m floors, as the deck's G+15)
    mat("offer_glow", "#ffd9a8", 0.5, emit="#ffd2a0", ek=float(A[A.index("--glow-k") + 1]) if "--glow-k" in A else 25.0)
    q_ = Polygon(OPTB["p"]).buffer(-0.9); gb = MB([])
    for n_ in (int(v) for v in A[A.index("--glow-floors") + 1].split(",")):
        z0_ = 5.6 + (n_ - 1) * 4.1 + 0.15; z1_ = z0_ + 3.6
        walls(gb, [L(x, y) for x, y in q_.exterior.coords], z0_, z1_, "offer_glow", 2, 2)
    gb.build("offer_glow_floors", MATS); print("glowing floors", A[A.index("--glow-floors") + 1])
if "--lobby" in A: lobby_723(info)
if "--campus" in A:
    for nm_ in ("trunk", "canopy_leaf"): MATS.get(nm_) or mat(nm_, "#4b3a2c" if nm_ == "trunk" else "#3c6a2c", 0.9)
    campus()
if "--bake-ao" in A: bake_ao(A[A.index("--bake-ao") + 1])
data = page_data(info)
json.dump(data, open(os.path.join(OUT, f"{OID}.json"), "w"), separators=(",", ":"))
if "--glb" in A: export(os.path.join(OUT, f"{OID}.glb"))
if "--anim" in A: animate(data, info, A[A.index("--anim") + 1], A[A.index("--anim") + 2])
if "--render" in A:
    for k in A[A.index("--render") + 1:]:
        if k.startswith("--"): break
        if k == "aerial": aerial(data, info)
        elif k == "aerial2": aerial(data, info, "aerial2", az_off=0.9, dist_k=0.55, el_k=0.35, lens=40)
        # scene-frame shots for 723 Avenue: along Andheri-Kurla Road past Times Square, and the 500 m overview
        elif k == "road": aerial(data, info, "road", az_off=((1440, -378, 24), (1760, -325, 30), 26))
        elif k == "station": aerial(data, info, "station", az_off=((1424, -374, 19), (1310, -316, 12), 26))
        elif k == "lobby":   # from the forecourt, eye height, looking into the lobby
            E = info["entrance"]; nx, ny, tx, ty, F = lobby_723.out
            aerial(data, info, "lobby", az_off=((E[0] + OX + nx * 17 + tx * 6, E[1] + OY + ny * 17 + ty * 6, 1.7), (E[0] + OX - nx * 6, E[1] + OY - ny * 6, 2.6), 22))
        elif k == "prv_street":   # from the road under the Line 1 viaduct, looking up at Privilon's corner (the developer render's view)
            aerial(data, info, "prv_street", az_off=((1405, -380, 30), (1328, -262, 32), 24))
        elif k == "prv_aerial":   # from the east, high: the face the sunrise lands on, the station and the road
            aerial(data, info, "prv_aerial", az_off=((1262, -430, 105), (1328, -262, 30), 30))
        elif k == "prv_west":     # from the west over the junction: the face the sunset lands on
            aerial(data, info, "prv_west", az_off=((1175, -300, 70), (1328, -262, 30), 30))
        elif k == "campus":   # from over the main road, looking down at the gates and the compound
            c_ = Polygon(OPTB["p"]).centroid
            aerial(data, info, "campus", az_off=((c_.x + 70, c_.y + 210, 120), (c_.x - 5, c_.y + 40, 0), 32))
        elif k == "roof": aerial(data, info, "roof", az_off=((1831 + 95, -151 - 120, 165), (1831, -151, 58), 35))
        elif k == "overview": aerial(data, info, "overview", az_off=((1690, -1000, 390), (1765, -265, 12), 30))
        else: render(k, data, info)
if "--sky" in A: sky_hdr()
