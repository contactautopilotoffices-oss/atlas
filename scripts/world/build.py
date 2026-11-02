"""Andheri East 3D world: build the scene in Blender, export it for the web,
and render stills.

  python scripts/world/build.py SCENE.json OUT_DIR [--glb] [--render NAME ...] [--fast] [--labels-only]

Runs headless with Blender as a Python module (pip install bpy==5.2.3), the
"Blender writes the geometry, three.js shows it" pipeline of the 3ditions kits
and of blosm/Geopogo: footprints from the scene file (scripts/world/prep.py)
are extruded to their heights, roofs and grounds are triangulated, the metro
viaducts are swept along their lines, and the whole is exported as one GLB
(compressed afterwards with gltf-transform meshopt: the bpy wheel ships
without its Draco and meshopt libraries). Trees are left out of the GLB (the page instances them
from the scene file) but are in the stills.

Mesh names are the contract with engine/world.js:
  ground, land_green, land_built, land_school, water, roads_major,
  roads_minor, roads_foot, rail, platforms, platform_roofs, buildings_<i>,
  tanks, opt_<option id>, viaduct_<line>, piers_<line>, stations_<line>,
  entries_l3
Buildings carry UV0 = (random seed, height in metres / 128, so both stay in 0..1 through quantisation) and a colour attribute
(facade colour); the page draws windows from those.
"""
import sys, json, math, os, random
import numpy as np
import bpy, bmesh
import shapely
from shapely.geometry import Polygon, LineString, Point

args = sys.argv[1:]
SCENE, OUT = args[0], args[1]
FAST = "--fast" in args
os.makedirs(OUT, exist_ok=True)
S = json.load(open(SCENE))
rnd = random.Random(11)

# ---------------------------------------------------------------- helpers ----
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)

def mesh_obj(name, V, F, uv=None, col=None, mat=None, smooth=False):
    V = np.asarray(V, dtype=np.float32).reshape(-1, 3); F = np.asarray(F, dtype=np.int32).reshape(-1, 3)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V)); me.vertices.foreach_set("co", V.ravel())
    me.loops.add(len(F) * 3); me.loops.foreach_set("vertex_index", F.ravel())
    me.polygons.add(len(F)); me.polygons.foreach_set("loop_start", np.arange(0, len(F) * 3, 3, dtype=np.int32))
    me.update(calc_edges=True); me.validate(clean_customdata=False)
    if uv is not None:
        L = me.uv_layers.new(name="UVMap"); L.data.foreach_set("uv", np.asarray(uv, dtype=np.float32)[F.ravel()].ravel())
    if col is not None:
        ca = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
        c = np.asarray(col, dtype=np.float32)[F.ravel()]
        ca.data.foreach_set("color", c.ravel())
    for p in me.polygons: p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if mat: me.materials.append(mat)
    return ob

def tri_polys(rings_list, z=0.0):
    """rings_list: [[exterior, hole, ...], ...] -> V, F flat at height z (constrained Delaunay)."""
    polys = []
    for rings in rings_list:
        try:
            p = Polygon(rings[0], rings[1:])
            if not p.is_valid: p = p.buffer(0)
            if not p.is_empty: polys.append(p)
        except Exception: pass
    V, F, n = [], [], 0
    if not polys: return np.zeros((0, 3)), np.zeros((0, 3), int)
    tris = shapely.constrained_delaunay_triangles(np.array(polys, dtype=object))
    for gc in tris:
        for t in getattr(gc, "geoms", []):
            c = np.asarray(t.exterior.coords)[:3]
            a = (c[1, 0] - c[0, 0]) * (c[2, 1] - c[0, 1]) - (c[2, 0] - c[0, 0]) * (c[1, 1] - c[0, 1])
            if abs(a) < 1e-6: continue
            if a < 0: c = c[::-1]
            V.extend([[x, y, z] for x, y in c]); F.append([n, n + 1, n + 2]); n += 3
    return np.array(V), np.array(F)

def hexcol(h, k=1.0):
    h = h.lstrip("#"); return [((int(h[i:i + 2], 16) / 255) ** 2.2) * k for i in (0, 2, 4)]

def mat(name, base, rough=0.8, metal=0.0, emit=None, emit_k=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*hexcol(base), 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*hexcol(emit), 1); b.inputs["Emission Strength"].default_value = emit_k
    return m

# ------------------------------------------------------------- materials ----
def facade_material(night=False):
    """Walls: the facade colour, with floors and windows drawn from world
    position (3.3 m storeys, 2.6 m bays); roofs: concrete, tarp or tin by
    the roof colour attribute. Lit windows at night by a hashed cell."""
    m = bpy.data.materials.new("facade" + ("_night" if night else "")); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N.get("Principled BSDF")
    geo = N.new("ShaderNodeNewGeometry"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sep.inputs[0])
    nrm = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Normal"], nrm.inputs[0])
    attr = N.new("ShaderNodeAttribute"); attr.attribute_name = "Col"
    def math_(op, a, b_=None, v=None):
        n = N.new("ShaderNodeMath"); n.operation = op
        (L.new(a, n.inputs[0]) if not isinstance(a, (int, float)) else n.inputs[0].__setattr__("default_value", a))
        if b_ is not None: (L.new(b_, n.inputs[1]) if not isinstance(b_, (int, float)) else n.inputs[1].__setattr__("default_value", b_))
        return n.outputs[0]
    # wall vs roof
    wall = math_("LESS_THAN", nrm.outputs["Z"], 0.5)
    # storey and bay fractions
    fz = math_("FRACT", math_("DIVIDE", sep.outputs["Z"], 3.3))
    hor = math_("ADD", math_("MULTIPLY", sep.outputs["X"], math_("ABSOLUTE", nrm.outputs["Y"])), math_("MULTIPLY", sep.outputs["Y"], math_("ABSOLUTE", nrm.outputs["X"])))
    fx = math_("FRACT", math_("DIVIDE", hor, 2.6))
    winz = math_("MULTIPLY", math_("GREATER_THAN", fz, 0.32), math_("LESS_THAN", fz, 0.84))
    winx = math_("MULTIPLY", math_("GREATER_THAN", fx, 0.18), math_("LESS_THAN", fx, 0.82))
    above = math_("GREATER_THAN", sep.outputs["Z"], 2.4)
    win = math_("MULTIPLY", math_("MULTIPLY", math_("MULTIPLY", winz, winx), wall), above)
    glass = N.new("ShaderNodeRGB"); glass.outputs[0].default_value = (*hexcol("#2d3a44"), 1)
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    L.new(win, mix.inputs["Factor"]); L.new(attr.outputs["Color"], mix.inputs[6]); L.new(glass.outputs[0], mix.inputs[7])
    # slab line darkening at each floor
    slab = math_("LESS_THAN", fz, 0.06)
    dark = N.new("ShaderNodeMix"); dark.data_type = "RGBA"; dark.blend_type = "MULTIPLY"
    L.new(math_("MULTIPLY", math_("MULTIPLY", slab, wall), 0.35), dark.inputs["Factor"]); L.new(mix.outputs[2], dark.inputs[6]); dark.inputs[7].default_value = (0.55, 0.55, 0.55, 1)
    L.new(dark.outputs[2], b.inputs["Base Color"])
    rough = math_("SUBTRACT", 0.9, math_("MULTIPLY", win, 0.75)); L.new(rough, b.inputs["Roughness"])
    if night:
        cell = N.new("ShaderNodeCombineXYZ")
        L.new(math_("FLOOR", math_("DIVIDE", sep.outputs["Z"], 3.3)), cell.inputs[0]); L.new(math_("FLOOR", math_("DIVIDE", hor, 2.6)), cell.inputs[1])
        wn = N.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "3D"; L.new(cell.outputs[0], wn.inputs["Vector"])
        lit = math_("MULTIPLY", math_("GREATER_THAN", wn.outputs["Value"], 0.7), win)
        warm = N.new("ShaderNodeRGB"); warm.outputs[0].default_value = (1.0, 0.62, 0.30, 1)
        L.new(warm.outputs[0], b.inputs["Emission Color"]); L.new(math_("MULTIPLY", lit, 1.4), b.inputs["Emission Strength"])
    return m

# ------------------------------------------------------------------ build ----
PAL_WALL = ["#d9d2c3", "#e2d6bd", "#cfc6b4", "#d6b9a8", "#bdbcb4", "#aab5bb", "#d7c08a", "#b8ad98", "#e6e1d6", "#c9b49a", "#9fa9ad"]
PAL_TOWER = ["#9fb3bf", "#c9d1d3", "#8ea3ad", "#d8d4c9", "#b7c4c9"]
ROOF_SLUM = ["#3d6fae", "#4a7fbf", "#8a8a84", "#7b6a58", "#9a9a92", "#6c6c66"]

def build(stills=False):
    reset()
    sc = bpy.context.scene
    B = S["buildings"]; minx, miny, maxx, maxy = S["bounds"]
    M = {k: mat(k, *v) for k, v in {
        "ground": ("#8d8776", 0.95), "land_green": ("#5d7a43", 0.95), "land_built": ("#958d7c", 0.95), "land_school": ("#9a8f72", 0.95),
        "water": ("#3e5359", 0.08), "roads_major": ("#3b3c3e", 0.75), "roads_minor": ("#58585a", 0.85), "roads_foot": ("#8a857a", 0.9),
        "rail": ("#5d554c", 0.95), "platforms": ("#a7a49c", 0.85), "platform_roofs": ("#b9bcc0", 0.5, 0.4), "tanks": ("#1d1f22", 0.5),
        "viaduct": ("#c4c1b8", 0.7), "piers": ("#b8b4aa", 0.75), "stations": ("#d2d6da", 0.35, 0.25), "entries_l3": ("#1d8a8a", 0.4),
    }.items()}
    FAC = facade_material(night=False)
    # ground
    pad = 9000
    mesh_obj("ground", [[minx - pad, miny - pad, -0.05], [maxx + pad, miny - pad, -0.05], [maxx + pad, maxy + pad, -0.05], [minx - pad, maxy + pad, -0.05]], [[0, 1, 2], [0, 2, 3]], mat=M["ground"])
    for k, z in (("built", 0.0), ("school", 0.01), ("green", 0.02), ("water", 0.03)):
        V, F = tri_polys(S["land"].get(k) or [], z)
        if len(F): mesh_obj("land_" + k if k != "water" else "water", V, F, mat=M["land_" + k if k != "water" else "water"])
    for k, z in (("foot", 0.06), ("minor", 0.08), ("major", 0.1)):
        V, F = tri_polys(S["roads"][k], z)
        if len(F): mesh_obj("roads_" + k, V, F, mat=M["roads_" + k])
    V, F = tri_polys(S["rail"], 0.12); mesh_obj("rail", V, F, mat=M["rail"])
    # platforms (1 m high) and canopies (6 m)
    def prism(rings_list, z0, z1, name, m):
        V, F = tri_polys(rings_list, z1); V = list(V); F = list(F); n = len(V)
        for rings in rings_list:
            for ring in rings[:1]:
                r = ring if Polygon(ring).exterior.is_ccw else ring[::-1]
                for i in range(len(r)):
                    a, b2 = r[i], r[(i + 1) % len(r)]
                    V += [[a[0], a[1], z0], [b2[0], b2[1], z0], [b2[0], b2[1], z1], [a[0], a[1], z1]]
                    F += [[n, n + 1, n + 2], [n, n + 2, n + 3]]; n += 4
        if F: mesh_obj(name, V, F, mat=m)
    if S.get("platforms"):
        prism(S["platforms"], 0, 1.0, "platforms", M["platforms"])
        prism(S["platforms"], 6.2, 6.6, "platform_roofs", M["platform_roofs"])

    # buildings: walls + roof, tiled so the page can cull
    TILE = 1500.0
    tiles = {}
    tanks_V, tanks_F = [], []
    for bi, b in enumerate(B):
        if b.get("opt"): continue
        r = b["p"]; h = b["h"]; seed = b["r"]; a = abs(Polygon(r).area)
        if not Polygon(r).exterior.is_ccw: r = r[::-1]
        cx = sum(p[0] for p in r) / len(r); cy = sum(p[1] for p in r) / len(r)
        key = (int((cx - minx) // TILE), int((cy - miny) // TILE)); T = tiles.setdefault(key, {"V": [], "F": [], "UV": [], "C": [], "roofs": []})
        rng_ = random.Random(bi)
        wall = PAL_TOWER[rng_.randrange(len(PAL_TOWER))] if h > 45 else PAL_WALL[rng_.randrange(len(PAL_WALL))]
        wc = hexcol(wall, 0.85 + rng_.random() * 0.25)
        if a < 90: roof = hexcol(ROOF_SLUM[rng_.randrange(len(ROOF_SLUM))])
        else: g = 0.55 + rng_.random() * 0.2; roof = hexcol("#a9a59c", g / 0.65)
        V, F, UV, C = T["V"], T["F"], T["UV"], T["C"]; n = len(V)
        for i in range(len(r)):
            p0, p1 = r[i], r[(i + 1) % len(r)]
            V += [[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], h], [p0[0], p0[1], h]]
            F += [[n, n + 1, n + 2], [n, n + 2, n + 3]]; n += 4
            UV += [[seed, h / 128], [seed, h / 128], [seed, h / 128], [seed, h / 128]]; C += [[*wc, 1]] * 4
        T["roofs"].append((r, h, seed, roof))
        # black water tanks on mid-rise roofs, the Mumbai skyline's punctuation
        if 150 < a < 2500 and h < 45 and rng_.random() < 0.7:
            pg = Polygon(r)
            for _ in range(1 + int(rng_.random() * 3)):
                px, py = cx + (rng_.random() - 0.5) * math.sqrt(a) * 0.5, cy + (rng_.random() - 0.5) * math.sqrt(a) * 0.5
                if not pg.contains(Point(px, py)): continue
                rad, th = 0.7 + rng_.random() * 0.5, 1.4 + rng_.random() * 0.8; k0 = len(tanks_V); seg = 8
                for s_ in range(seg):
                    t = s_ / seg * math.tau; tanks_V += [[px + rad * math.cos(t), py + rad * math.sin(t), h], [px + rad * math.cos(t), py + rad * math.sin(t), h + th]]
                for s_ in range(seg):
                    a0, a1 = k0 + 2 * s_, k0 + 2 * ((s_ + 1) % seg)
                    tanks_F += [[a0, a1, a1 + 1], [a0, a1 + 1, a0 + 1]]
                ctr = len(tanks_V); tanks_V.append([px, py, h + th])
                for s_ in range(seg): tanks_F.append([k0 + 2 * s_ + 1, k0 + 2 * ((s_ + 1) % seg) + 1, ctr])
    for (tx, ty), T in tiles.items():
        rings = [[r] for r, *_ in T["roofs"]]
        polys = [Polygon(r) for r, *_ in T["roofs"]]
        tris = shapely.constrained_delaunay_triangles(np.array(polys, dtype=object))
        V, F, UV, C = T["V"], T["F"], T["UV"], T["C"]; n = len(V)
        for (r, h, seed, roof), gc in zip(T["roofs"], tris):
            for t in getattr(gc, "geoms", []):
                c = np.asarray(t.exterior.coords)[:3]
                ar = (c[1, 0] - c[0, 0]) * (c[2, 1] - c[0, 1]) - (c[2, 0] - c[0, 0]) * (c[1, 1] - c[0, 1])
                if abs(ar) < 1e-6: continue
                if ar < 0: c = c[::-1]
                V += [[x, y, h] for x, y in c]; F.append([n, n + 1, n + 2]); n += 3
                UV += [[seed, h / 128]] * 3; C += [[*roof, 1]] * 3
        mesh_obj(f"buildings_{tx}_{ty}", V, F, uv=UV, col=C, mat=FAC)
    if tanks_F: mesh_obj("tanks", tanks_V, tanks_F, mat=M["tanks"], smooth=True)

    # the seven options: their own objects, banded glass with a crown
    OPTM = mat("option_glass", "#7fa3b3", 0.12, 0.6)
    OPTB = mat("option_band", "#e8e4da", 0.5)
    for b in B:
        if not b.get("opt"): continue
        r = b["p"] if Polygon(b["p"]).exterior.is_ccw else b["p"][::-1]; h = b["h"]
        V, F, UV, n = [], [], [], 0
        storeys = max(2, int(h / 4.1))
        for k in range(storeys + 1):
            z0 = k * h / (storeys + 1); z1 = (k + 1) * h / (storeys + 1)
            for i in range(len(r)):
                p0, p1 = r[i], r[(i + 1) % len(r)]
                V += [[p0[0], p0[1], z0], [p1[0], p1[1], z0], [p1[0], p1[1], z1], [p0[0], p0[1], z1]]
                F += [[n, n + 1, n + 2], [n, n + 2, n + 3]]; n += 4
                UV += [[0, z0], [1, z0], [1, z1], [0, z1]]
        RV, RF = tri_polys([[r]], h)
        F += (np.asarray(RF) + n).tolist(); V += np.asarray(RV).tolist(); UV += [[0.5, h]] * len(RV)
        o = mesh_obj("opt_" + b["opt"], V, F, uv=UV, mat=OPTM)
        o.data.materials.append(OPTB)

    # metro: elevated decks and piers along L1 and L7, stations as boxes
    def sweep(line, w, z0, z1):
        P = np.asarray(line, float); V, F = [], []
        if len(P) < 2: return V, F
        d = np.diff(P, axis=0); d /= np.linalg.norm(d, axis=1)[:, None] + 1e-9
        t = np.vstack([d[:1], (d[:-1] + d[1:]) / 2, d[-1:]]); t /= np.linalg.norm(t, axis=1)[:, None] + 1e-9
        nrm = np.c_[-t[:, 1], t[:, 0]] * (w / 2)
        for i, p in enumerate(P):
            l, rr = p + nrm[i], p - nrm[i]
            V += [[l[0], l[1], z0], [rr[0], rr[1], z0], [rr[0], rr[1], z1], [l[0], l[1], z1]]
        for i in range(len(P) - 1):
            a, b2 = 4 * i, 4 * (i + 1)
            for q in range(4):
                q1 = (q + 1) % 4
                F += [[a + q, b2 + q, b2 + q1], [a + q, b2 + q1, a + q1]]
        return V, F
    def box(cx, cy, z0, z1, L_, W_, ang):
        ca, sa = math.cos(ang), math.sin(ang); V = []
        for z in (z0, z1):
            for dx, dy in ((-L_ / 2, -W_ / 2), (L_ / 2, -W_ / 2), (L_ / 2, W_ / 2), (-L_ / 2, W_ / 2)):
                V.append([cx + dx * ca - dy * sa, cy + dx * sa + dy * ca, z])
        F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]
        return V, F
    def add(acc, VF):
        V, F = VF; n = len(acc[0]); acc[0].extend(V); acc[1].extend([[a + n, b2 + n, c + n] for a, b2, c in F])
    for key, deckZ in (("L1", 13.0), ("L7", 11.0)):
        line = S["metro"][key]; dk, pr = ([], []), ([], [])
        for l in line["lines"]:
            add(dk, sweep(l, 10.5, deckZ - 1.8, deckZ)); add(dk, sweep(l, 0.4, deckZ, deckZ + 1.1))  # deck + centre wall
            ls = LineString(l)
            for s_ in np.arange(15, ls.length, 30):
                p = ls.interpolate(s_); p2 = ls.interpolate(min(ls.length, s_ + 1)); ang = math.atan2(p2.y - p.y, p2.x - p.x)
                add(pr, box(p.x, p.y, 0, deckZ - 1.8, 2.0, 2.0, ang)); add(pr, box(p.x, p.y, deckZ - 3.0, deckZ - 1.8, 2.4, 8.0, ang))
        if dk[1]: mesh_obj("viaduct_" + key.lower(), *dk, mat=M["viaduct"])
        if pr[1]: mesh_obj("piers_" + key.lower(), *pr, mat=M["piers"])
        st = ([], [])
        for s in S["stations"]:
            if s["line"] != key: continue
            best = None
            for l in line["lines"]:
                ls = LineString(l); d = ls.distance(Point(s["x"], s["y"]))
                if best is None or d < best[0]: best = (d, ls)
            if not best or best[0] > 80: continue
            ls = best[1]; t = ls.project(Point(s["x"], s["y"])); p = ls.interpolate(t); p2 = ls.interpolate(min(ls.length, t + 5)); p1 = ls.interpolate(max(0, t - 5))
            ang = math.atan2(p2.y - p1.y, p2.x - p1.x)
            add(st, box(p.x, p.y, deckZ - 4.5, deckZ + 6.5, 135, 24, ang))   # concourse and platforms
            add(st, box(p.x, p.y, deckZ + 6.5, deckZ + 8.0, 140, 27, ang))   # roof overhang
            for side in (-1, 1):                                               # stair towers to the footpath
                add(st, box(p.x + side * 55 * math.cos(ang) + 16 * math.sin(ang), p.y + side * 55 * math.sin(ang) - 16 * math.cos(ang), 0, deckZ - 4.5, 10, 6, ang))
        if st[1]: mesh_obj("stations_" + key.lower(), *st, mat=M["stations"])
    en = ([], [])
    for s in S["stations"]:
        if s["line"] == "L3":
            for k in range(2): add(en, box(s["x"] + (k - 0.5) * 28, s["y"] + (k - 0.5) * 6, 0, 4.5, 12, 6.5, 0.3))
    if en[1]: mesh_obj("entries_l3", *en, mat=M["entries_l3"])

    if stills:
        # trees, instanced: a broad rain-tree crown on a trunk
        crown = bpy.data.meshes.new("crown"); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
        for v in bm.verts: v.co.x *= 1.0 + 0.25 * math.sin(v.co.y * 5); v.co.z *= 0.62
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 1.0)); bm.to_mesh(crown); bm.free()
        tm = mat("tree", "#3f6a2c", 0.9); crown.materials.append(tm)
        tob = bpy.data.objects.new("tree_proto", crown); sc.collection.objects.link(tob); tob.hide_render = True; tob.hide_viewport = True
        tob.scale = (4.2, 4.2, 4.6)
        pts = np.asarray(S["trees"], float)
        tme = bpy.data.meshes.new("tree_pts"); tme.vertices.add(len(pts)); tme.vertices.foreach_set("co", np.c_[pts[:, :2], np.full(len(pts), 2.0)].astype(np.float32).ravel())
        sa = tme.attributes.new("tscale", "FLOAT", "POINT"); sa.data.foreach_set("value", pts[:, 2].astype(np.float32))
        tpo = bpy.data.objects.new("trees", tme); sc.collection.objects.link(tpo)
        gn = tpo.modifiers.new("inst", "NODES"); ng = bpy.data.node_groups.new("trees_gn", "GeometryNodeTree"); gn.node_group = ng
        ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry"); ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
        gi = ng.nodes.new("NodeGroupInput"); go = ng.nodes.new("NodeGroupOutput"); ip = ng.nodes.new("GeometryNodeInstanceOnPoints")
        oi = ng.nodes.new("GeometryNodeObjectInfo"); oi.inputs["Object"].default_value = tob; oi.transform_space = "ORIGINAL"
        na = ng.nodes.new("GeometryNodeInputNamedAttribute"); na.data_type = "FLOAT"; na.inputs["Name"].default_value = "tscale"
        sv = ng.nodes.new("ShaderNodeCombineXYZ"); mul = ng.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 4.4
        ng.links.new(na.outputs[0], mul.inputs[0]); [ng.links.new(mul.outputs[0], sv.inputs[i]) for i in range(3)]
        rot = ng.nodes.new("FunctionNodeRandomValue"); rot.data_type = "FLOAT_VECTOR"; rot.inputs["Max"].default_value = (0, 0, 6.28)
        rz = ng.nodes.new("FunctionNodeRandomValue"); rz.data_type = "FLOAT"
        ng.links.new(gi.outputs[0], ip.inputs["Points"]); ng.links.new(oi.outputs["Geometry"], ip.inputs["Instance"]); ng.links.new(sv.outputs[0], ip.inputs["Scale"])
        ng.links.new(rot.outputs[0], ip.inputs["Rotation"]); ng.links.new(ip.outputs[0], go.inputs[0])
        # per-instance colour variation in the shader
        tn = tm.node_tree; oinfo = tn.nodes.new("ShaderNodeObjectInfo"); ramp = tn.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*hexcol("#2f5a22"), 1); ramp.color_ramp.elements[1].color = (*hexcol("#6f8f3a"), 1)
        tn.links.new(oinfo.outputs["Random"], ramp.inputs[0]); tn.links.new(ramp.outputs[0], tn.nodes.get("Principled BSDF").inputs["Base Color"])
    return M

# ------------------------------------------------------------------- GLB ----
def export_glb(path):
    for o in list(bpy.data.objects):
        if o.name.startswith("tree"): bpy.data.objects.remove(o)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True,
        export_normals=False, export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="PLACEHOLDER")
    print("glb", path, round(os.path.getsize(path) / 1e6, 2), "MB")

# ---------------------------------------------------------------- stills ----
def fit_camera(az_deg, pitch_deg, lens, pts, aspect, margin=0.1):
    """Camera looking along azimuth az (from north, clockwise) and down at
    pitch, pulled back until every point sits inside the frame's margin."""
    az, pt = math.radians(az_deg), math.radians(pitch_deg)
    fwd = np.array([math.sin(az) * math.cos(pt), math.cos(az) * math.cos(pt), -math.sin(pt)])
    right = np.array([math.cos(az), -math.sin(az), 0.0]); up = np.cross(right, fwd)
    P = np.asarray(pts, float); ctr = P.mean(axis=0)
    tx = math.tan(math.atan(18 / lens)) * (1 - margin); ty = tx / aspect
    for dist in np.arange(300, 20000, 25):
        cam = ctr - fwd * dist; v = P - cam; z = v @ fwd
        if (z <= 0).any(): continue
        if (np.abs(v @ right / z) <= tx).all() and (np.abs(v @ up / z) <= ty).all():
            return tuple(cam), tuple(ctr)
    return tuple(ctr - fwd * 8000), tuple(ctr)

SHOTS = {
    # name: (camera xyz, look-at xyz, lens mm, sun azimuth deg (from north, clockwise), sun elevation deg, size, mood)
    "hero":  (None, None, 40, 125, 42, (2560, 1440), "day"),
    "dusk":  (None, None, 40, 250, 7, (2560, 1440), "dusk"),
    "night": (None, None, 40, 250, -12, (2560, 1440), "night"),
}
def light_world(az, el, mood):
    sc = bpy.context.scene; w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes.get("Background")
    sky = nt.nodes.new("ShaderNodeTexSky")
    try: sky.sky_type = "MULTIPLE_SCATTERING"
    except Exception:
        try: sky.sky_type = "NISHITA"
        except Exception: pass
    try:
        sky.sun_elevation = math.radians(max(el, -5)); sky.sun_rotation = math.radians(90 - az); sky.altitude = 200; sky.air_density = 1.6; sky.aerosol_density = 3.5
    except Exception: pass
    nt.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.22 if mood == "day" else 0.3 if mood == "dusk" else 0.02
    sun = bpy.data.lights.new("sun", "SUN"); sun.angle = math.radians(1.2)
    sun.energy = 3.4 if mood == "day" else 2.6 if mood == "dusk" else 0.0
    sun.color = (1, 0.97, 0.9) if mood == "day" else (1, 0.62, 0.38)
    so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(90 - max(el, 2)), 0, math.radians(-az))
    if mood == "night":
        moon = bpy.data.lights.new("moon", "SUN"); moon.energy = 0.08; moon.color = (0.6, 0.7, 1.0)
        mo = bpy.data.objects.new("moon", moon); sc.collection.objects.link(mo); mo.rotation_euler = (math.radians(50), 0, math.radians(40))
        bg.inputs[0].default_value = (0.012, 0.02, 0.045, 1); nt.links.remove(bg.inputs[0].links[0])

def option_points(ids=None):
    pts = []
    for b in S["buildings"]:
        if b.get("opt") and (ids is None or b["opt"] in ids):
            for x, y in b["p"]: pts += [[x, y, 0], [x, y, b["h"]]]
    return pts
def render(name):
    if name.startswith("opt:"):
        oid = name[4:]; o = next(o for o in S["options"] if o["id"] == oid)
        pts = option_points([oid]) + [[r["path"][-1][0], r["path"][-1][1], 0] for r in o["routes"][:1]]
        cam_p, look = fit_camera(200, 42, 50, pts, 16 / 10, 0.18)
        SHOTS[name] = (cam_p, look, 50, 120, 40, (1600, 1000), "day"); name_out = "opt-" + oid
    else: name_out = name
    if SHOTS[name][0] is None:
        lens, size = SHOTS[name][2], SHOTS[name][5]
        cam_p, look = fit_camera(22, 36, lens, option_points(), size[0] / size[1], 0.12)
        SHOTS[name] = (cam_p, look) + SHOTS[name][2:]
    cam_p, look, lens, az, el, size, mood = SHOTS[name]
    M = build(stills=True)
    sc = bpy.context.scene
    if mood == "night":
        for o in bpy.data.objects:
            if o.name.startswith("buildings_"): o.data.materials[0] = facade_material(night=True)
        for k, c, e in (("roads_major", "#ffb36b", 0.035), ("stations", "#cfe6ff", 0.8), ("viaduct", "#9fc4ff", 0.04)):
            m = M[k]; b = m.node_tree.nodes.get("Principled BSDF"); b.inputs["Emission Color"].default_value = (*hexcol(c), 1); b.inputs["Emission Strength"].default_value = e
    light_world(az, el, mood)
    # the options glow: a warm emissive crown band
    for o in bpy.data.objects:
        if o.name.startswith("opt_"):
            mm = o.data.materials[0]; b = mm.node_tree.nodes.get("Principled BSDF")
            b.inputs["Emission Color"].default_value = (1.0, 0.72, 0.28, 1); b.inputs["Emission Strength"].default_value = 0.6 if mood == "day" else 3.0
    cd = bpy.data.cameras.new("cam"); cd.lens = lens; cd.clip_end = 20000
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 0.9 if not FAST else 4; cd.sensor_width = 36
    cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = cam_p
    d = np.subtract(look, cam_p); cd.dof.focus_distance = float(np.linalg.norm(d))
    cam.rotation_euler = (math.atan2(math.hypot(d[0], d[1]), -d[2]), 0, math.atan2(d[1], d[0]) - math.pi / 2)
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"
    sc.cycles.samples = 16 if FAST else 64; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 2
    sc.render.resolution_x, sc.render.resolution_y = size; sc.render.resolution_percentage = 40 if FAST else 100
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Punchy" if mood == "day" else "AgX - Medium High Contrast"
    sc.view_settings.exposure = -0.55 if mood == "day" else 0.2 if mood == "dusk" else 0.6
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = os.path.join(OUT, f"{name_out}.png")
    if "--labels-only" not in args: bpy.ops.render.render(write_still=True)
    bpy.context.view_layer.update()   # the camera's matrix, when nothing was rendered
    # where the options fell in the frame, for labels
    from bpy_extras.object_utils import world_to_camera_view
    import mathutils
    pos = {}
    for o in S["options"]:
        b = next(x for x in S["buildings"] if x.get("opt") == o["id"]) if any(x.get("opt") == o["id"] for x in S["buildings"]) else None
        h = b["h"] if b else 40
        # label the building itself: its footprint centre, not the pin (a pin
        # can mark an address on the next-door station)
        cx, cy = (sum(p[0] for p in b["p"]) / len(b["p"]), sum(p[1] for p in b["p"]) / len(b["p"])) if b else (o["x"], o["y"])
        v = world_to_camera_view(sc, cam, mathutils.Vector((cx, cy, h)))
        pos[o["id"]] = [round(v.x, 4), round(1 - v.y, 4), round(v.z, 1)]
    json.dump(pos, open(os.path.join(OUT, f"{name_out}.labels.json"), "w"))
    print("rendered", name)

if "--glb" in args:
    build(stills=False); export_glb(os.path.join(OUT, "andheri-east.glb"))
if "--render" in args:
    for n in args[args.index("--render") + 1:]:
        if n.startswith("--"): break
        render(n)
