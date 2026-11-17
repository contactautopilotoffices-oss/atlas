"""F1 Skymark: the 500 m of real city around the twin, built the way the
Andheri East world is built (scripts/world/diorama.py), so the two read as
one family.

What it borrows from the Andheri pipeline, unchanged in spirit:
  * scripts/world/textures.py paints the facades (plaster with grain and
    monsoon streaks, windows with grills and chajjas, split ACs, ribbon
    glazing, curtain wall, shopfronts with shutters and boards, chawl walls),
    the roof, asphalt, pavers, grass and soil, and the leaf cards. It is run
    as is; its images are mapped at true scale (UV = metres / module size).
  * the mesh builder, the constrained-Delaunay ground, walls with true-scale
    UVs, boxes and cylinders for roof tanks and stair cabins;
  * the height rule: Overture has no heights here, so each building is read
    off the Copernicus GLO-30 surface model (highest cell over the footprint
    less the local ground), within a range set by footprint size. Noida's
    sectors are low-rise, so the ranges are lower than Andheri's and no
    footprint is turned into a tower;
  * shopfronts where a wall meets a road, a parapet and roof with tanks and
    stair cabins on the larger roofs, tin and tarp roofs on the smallest;
  * trees as clouds of crossed leaf cards with cut-out textures, coconut
    palms, both placed in green areas, along roads and in open ground;
  * a plinth: the slab is cut at the radius and shows its soil edge, so the
    whole reads as a model on a table.

Everything is placed from data (Overture Maps footprints, roads and green
areas, fetched by fetch_context.py). Nothing is placed by hand. The twin's
own plot is cleared and left to the reconstruction.
"""
import json
import math
import os
import random
import subprocess
import sys

import bmesh
import bpy
import numpy as np
import shapely
from mathutils import Matrix, Vector
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
CM = {}   # context materials


# ------------------------------------------------------------ textures ----
def textures(tex_dir, web_scale=0.5):
    """Paint the Andheri textures into tex_dir (once), then keep a smaller
    copy of each for the web model. Returns the folder the materials use."""
    os.makedirs(tex_dir, exist_ok=True)
    if not os.path.exists(os.path.join(tex_dir, "leaves_b.png")):
        subprocess.run([sys.executable, os.path.join(REPO, "scripts", "world", "textures.py"), tex_dir], check=True)
    web = os.path.join(tex_dir, "web")
    if not os.path.exists(os.path.join(web, "leaves_b.png")):
        from PIL import Image
        os.makedirs(web, exist_ok=True)
        for f in os.listdir(tex_dir):
            if f.endswith((".jpg", ".png")):
                im = Image.open(os.path.join(tex_dir, f))
                im = im.resize((max(64, int(im.width * web_scale)), max(64, int(im.height * web_scale))), Image.LANCZOS)
                im.save(os.path.join(web, f), **({"quality": 82} if f.endswith(".jpg") else {}))
    return web


def hexc(h, k=1.0):
    h = h.lstrip("#")
    return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) * k for i in (0, 2, 4)) + (1,)


def mat(name, col="#808080", rough=0.8, metal=0.0, tex=None, rtex=None, glass=False, emit=None, ek=0.0, TEX=None):
    """The Andheri material: colour (or a facade image), a roughness image
    where glass is smooth and plaster rough, and metal where it is glass."""
    m = bpy.data.materials.new("CTX_" + name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hexc(col)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if tex:
        im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(os.path.join(TEX, tex))
        nt.links.new(im.outputs[0], b.inputs["Base Color"])
    if rtex:
        im2 = nt.nodes.new("ShaderNodeTexImage"); im2.image = bpy.data.images.load(os.path.join(TEX, rtex)); im2.image.colorspace_settings.name = "Non-Color"
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 0.05; mr.inputs["To Max"].default_value = 0.92
        nt.links.new(im2.outputs[0], mr.inputs[0]); nt.links.new(mr.outputs[0], b.inputs["Roughness"])
        if glass:
            inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "LESS_THAN"; inv.inputs[1].default_value = 0.4
            nt.links.new(im2.outputs[0], inv.inputs[0]); nt.links.new(inv.outputs[0], b.inputs["Metallic"])
    if emit:
        b.inputs["Emission Color"].default_value = hexc(emit); b.inputs["Emission Strength"].default_value = ek
    m.diffuse_color = hexc(col)
    CM[name] = m
    return m


WALL_STYLES = ["res_cream", "res_peach", "res_grey", "res_ochre"]
MOD = {"res_cream": (6, 12), "res_peach": (6, 12), "res_grey": (6, 12), "res_ochre": (6, 12), "res_tower": (6, 12), "com_ribbon": (8, 16),
       "com_glass": (6, 16), "shop": (6, 4.5), "chawl": (4, 3), "opt_glass": (6, 16.4), "opt_plaster": (6, 16.4)}


def materials(TEX):
    for k in MOD:
        mat("wall_" + k, tex=k + ".jpg", rtex=k + "_r.jpg", glass=k in ("com_glass", "opt_glass", "com_ribbon", "opt_plaster", "res_tower"), TEX=TEX)
    mat("roof", tex="roof.jpg", rough=0.9, TEX=TEX); mat("roof_tin", "#8f8f8a", 0.45, 0.6); mat("roof_tarp", "#2f63a8", 0.6); mat("roof_tin_rust", "#7a5b45", 0.7, 0.3)
    mat("parapet", "#cfc8b8", 0.9); mat("ground", "#a29c8f", 0.95, tex="roof.jpg", TEX=TEX); mat("asphalt", tex="asphalt.jpg", rough=0.85, TEX=TEX)
    mat("pavers", tex="pavers.jpg", rough=0.9, TEX=TEX); mat("kerb", "#bdb8ab", 0.85); mat("grass", tex="grass.jpg", rough=0.95, TEX=TEX)
    mat("marking", "#efefe8", 0.6); mat("soil", tex="soil.jpg", rough=1.0, TEX=TEX); mat("tank", "#1d1f22", 0.5)
    mat("trunk", "#5b4a3b", 0.9); mat("leaf", "#4d7a33", 0.75); mat("leaf_b", "#3f6a2c", 0.75); mat("frond", "#5c8a36", 0.7)
    for k, img in (("leaf", "leaves_a.png"), ("leaf_b", "leaves_b.png")):
        nt = CM[k].node_tree; b_ = nt.nodes.get("Principled BSDF")
        im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(os.path.join(TEX, img))
        nt.links.new(im.outputs["Color"], b_.inputs["Base Color"]); nt.links.new(im.outputs["Alpha"], b_.inputs["Alpha"])
        b_.inputs["Subsurface Weight"].default_value = 0.1
        for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "CLIP")):
            try: setattr(CM[k], attr, val)
            except Exception: pass
    # Palm fronds are a plain green: Andheri varies them with a noise node,
    # but glTF cannot carry a procedural node, so the exported palms came out
    # white. One colour renders the same in Blender and in the browser.


# -------------------------------------------------------- mesh builder ----
class MB:
    """The Andheri mesh builder: polygons with their own UVs, one material
    index each, built in one go with foreach_set."""

    def __init__(s): s.V, s.P, s.UV, s.M, s.mats = [], [], [], [], []

    def mi(s, m):
        if m not in s.mats: s.mats.append(m)
        return s.mats.index(m)

    def poly(s, pts3, uvs, m):
        s.V.extend(pts3); s.P.append(len(pts3)); s.UV.extend(uvs); s.M.append(s.mi(m))

    def quad(s, a, b, c, d, uva, m): s.poly([a, b, c, d], uva, m)

    def build(s, name, coll, props=None):
        if not s.P: return None
        me = bpy.data.meshes.new(name); V = np.asarray(s.V, np.float32)
        me.vertices.add(len(V)); me.vertices.foreach_set("co", V.ravel())
        n = np.asarray(s.P, np.int32); starts = np.concatenate([[0], np.cumsum(n)[:-1]]).astype(np.int32)
        me.loops.add(int(n.sum())); me.loops.foreach_set("vertex_index", np.arange(int(n.sum()), dtype=np.int32))
        me.polygons.add(len(n)); me.polygons.foreach_set("loop_start", starts)
        me.update(calc_edges=True)
        uvl = me.uv_layers.new(name="UVMap"); uvl.data.foreach_set("uv", np.asarray(s.UV, np.float32).ravel())
        me.polygons.foreach_set("material_index", np.asarray(s.M, np.int32))
        for m in s.mats: me.materials.append(CM[m])
        me.validate()
        ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
        for k, v in (props or {}).items(): ob[k] = v
        return ob


def flat(mb, g, z, m, uvk=4.0, up=True):
    """Triangulate polygons (with holes) at height z; world-scale UVs."""
    if g is None or g.is_empty: return
    geoms = [p for p in (g.geoms if hasattr(g, "geoms") else [g]) if p.geom_type == "Polygon" and p.area > 0.5]
    if not geoms: return
    out = []
    for g1 in geoms:
        for cand in (g1, g1.buffer(0.01).buffer(-0.01).simplify(0.05)):
            try: out.append(shapely.constrained_delaunay_triangles(cand)); break
            except Exception: continue
    for gc in out:
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
    if len(r) < 3: return s0
    if Polygon(r).exterior.is_ccw != outward: r = r[::-1]
    s = s0
    for i in range(len(r)):
        (ax, ay), (bx_, by) = r[i], r[(i + 1) % len(r)]; d = math.hypot(bx_ - ax, by - ay)
        if d < 0.05: continue
        mb.quad((ax, ay, z0), (bx_, by, z0), (bx_, by, z1), (ax, ay, z1),
                [(s / mw, (z0 - v0) / mh), ((s + d) / mw, (z0 - v0) / mh), ((s + d) / mw, (z1 - v0) / mh), (s / mw, (z1 - v0) / mh)], m)
        s += d
    return s


def boxm(mb, cx_, cy_, z0, z1, lx, ly, ang, m, uvk=2.0):
    ca, sa = math.cos(ang), math.sin(ang)
    P = [(cx_ + dx * ca - dy * sa, cy_ + dx * sa + dy * ca) for dx, dy in ((-lx / 2, -ly / 2), (lx / 2, -ly / 2), (lx / 2, ly / 2), (-lx / 2, ly / 2))]
    walls(mb, P + [P[0]], z0, z1, m, uvk, uvk)
    flat(mb, Polygon(P), z1, m, uvk)


def cyl(mb, cx_, cy_, z0, z1, rx, ry, ang, m, seg=16, cap=True):
    ca, sa = math.cos(ang), math.sin(ang)
    P = [(cx_ + rx * math.cos(t) * ca - ry * math.sin(t) * sa, cy_ + rx * math.cos(t) * sa + ry * math.sin(t) * ca) for t in np.linspace(0, math.tau, seg, endpoint=False)]
    walls(mb, P + [P[0]], z0, z1, m, 3, 3)
    if cap: flat(mb, Polygon(P), z1, m)


# ------------------------------------------------------------ prototypes --
def protos(coll):
    """Andheri's trees: crowns of crossed leaf cards round a trunk, and a
    coconut palm with a leaning trunk and fronds."""
    out = {}

    def tree(name, crowns, trunk_h, trunk_r):
        rr = random.Random(name)
        tm = MB(); cyl(tm, 0, 0, 0, trunk_h, trunk_r, trunk_r, 0, "trunk", 8)
        trunk = tm.build(name + "_trunk_tmp", coll)
        bm = bmesh.new(); bm.from_mesh(trunk.data)
        n_trunk = len(bm.faces)
        uv = bm.loops.layers.uv.verify()
        for (x, y, z, rx, rz) in crowns:
            for _ in range(int(14 + rx * 7)):
                u, v_, w_ = rr.uniform(-1, 1), rr.uniform(-1, 1), rr.uniform(-1, 1)
                if u * u + v_ * v_ + w_ * w_ > 1: continue
                cx_, cy_, cz_ = x + u * rx * 0.8, y + v_ * rx * 0.8, z + w_ * rz * 0.75
                s_ = rr.uniform(1.6, 2.6) * (rx + rz) / 6
                for k in range(2):   # two crossed cards per tuft
                    a = rr.uniform(0, math.pi) + k * math.pi / 2; tl = rr.uniform(-0.5, 0.5)
                    ex, ey = math.cos(a) * s_, math.sin(a) * s_
                    fx, fy, fz = -math.sin(a) * math.sin(tl) * s_, math.cos(a) * math.sin(tl) * s_, math.cos(tl) * s_
                    vs = [bm.verts.new((cx_ + sx * ex + sy * fx, cy_ + sx * ey + sy * fy, cz_ + sy * fz)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                    f = bm.faces.new(vs); f.material_index = 1; f.smooth = True
                    for lp, (uu, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uv].uv = (uu, vv)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        me.materials.clear(); me.materials.append(CM["trunk"]); me.materials.append(CM["leaf_b" if name.endswith("_b") else "leaf"])
        # set after the materials exist: Blender clamps an index past the last slot
        for i, p in enumerate(me.polygons):
            p.material_index = 0 if i < n_trunk else 1
            p.use_smooth = i >= n_trunk
        bpy.data.objects.remove(trunk)
        ob = bpy.data.objects.new(name, me); coll.objects.link(ob); ob.hide_render = True; ob.hide_viewport = True
        out[name] = ob

    tree("ctx_tree_a", [(0, 0, 7.5, 4.6, 2.6), (2.6, 1.0, 6.8, 3.0, 2.0), (-2.4, -1.2, 7.0, 3.2, 2.1), (0.6, -2.5, 6.6, 2.8, 1.9), (-0.8, 2.3, 8.0, 2.6, 1.8)], 5.5, 0.32)
    tree("ctx_tree_b", [(0, 0, 4.5, 1.9, 3.2), (0, 0, 7.5, 1.6, 2.8), (0, 0, 10.0, 1.1, 2.0)], 3.0, 0.22)
    mb = MB(); hgt = 11.0
    for k in range(10):
        z0, z1 = k * hgt / 10, (k + 1) * hgt / 10; lx0 = 0.04 * (z0 / hgt) ** 2 * hgt
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
    ob = mb.build("ctx_palm", coll); ob.hide_render = True; ob.hide_viewport = True
    out["ctx_palm"] = ob
    return out


# ------------------------------------------------------------------ build --
def h01(s):
    import hashlib
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xffffffff


ROAD_W = {"motorway": 20, "trunk": 16, "primary": 14, "secondary": 12, "tertiary": 9, "residential": 6.5, "unclassified": 6,
          "living_street": 5, "service": 4.5, "unknown": 5, "pedestrian": 4, "footway": 2.2, "path": 2, "steps": 2}


def build(P, F, ctx_path, tex_dir, radius=500.0, near_points=(), near_r=80.0):
    """Build the context into the SKY_Context collection. Returns
    (root, info, near) where `near` lists objects to hide for a view taken
    from close by (the reference photo view)."""
    d = json.load(open(ctx_path, encoding="utf-8"))
    mp = P["map"]
    TEX = textures(tex_dir)
    materials(TEX)
    coll = bpy.data.collections.get("SKY_Context") or bpy.data.collections.new("SKY_Context")
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    proto_coll = bpy.data.collections.get("SKY_Context_Prototypes") or bpy.data.collections.new("SKY_Context_Prototypes")
    if proto_coll.name not in coll.children:
        coll.children.link(proto_coll)

    # east/north metres -> the twin's local frame, then -> footprint-centred
    th = math.radians(180.0 - mp["front_bearing_deg"])
    ca, sa = math.cos(-th), math.sin(-th)
    cx0, cy0 = mp["corner_enu"]
    fc = (F.W / 2, (F.L - P["annex"]["depth"]) / 2)

    def T(c):
        x, y = c[:, 0] - cx0, c[:, 1] - cy0
        return np.c_[x * ca - y * sa - fc[0], x * sa + y * ca - fc[1]]
    tr = lambda g: shapely.transform(g, T)

    an = P["annex"]; s = P["site"]
    site = box(-s.get("margin_side_B", 6.0) - 2.0 - fc[0], -an["depth"] - s.get("margin_front", 3.0) - fc[1],
               F.W + s.get("margin_other", 2.0) - fc[0], F.L + s.get("margin_other", 2.0) - fc[1])
    SLAB = Point(0, 0).buffer(radius, quad_segs=48)
    rng = random.Random(7)

    # buildings
    B = []
    for b in d["buildings"]:
        if b["id"] == mp.get("replaces_footprint_id"):
            continue
        try:
            q = tr(Polygon(b["ring"]))
        except Exception:
            continue
        if not q.is_valid: q = q.buffer(0)
        if q.is_empty or q.geom_type != "Polygon" or q.area < 8: continue
        if not SLAB.contains(q.centroid) or q.intersects(site): continue
        q = q.intersection(SLAB).simplify(0.15)
        if q.geom_type != "Polygon" or q.area < 8: continue
        a = q.area; j = h01(b["id"]); ex = max(0.0, b.get("dsm_excess_m") or 0.0)
        if b.get("height"): h = float(b["height"])
        elif b.get("floors"): h = float(b["floors"]) * 3.3 + 1.0
        elif a < 70: h = 3.4 + j * 3.2
        elif a < 180: h = 6.0 + j * 5.0 + ex * 0.25
        elif a < 400: h = 8.5 + j * 6.5 + ex * 0.5
        elif a < 1500: h = 10.0 + j * 9.0 + ex * 0.7
        else: h = 11.0 + j * 9.0 + ex * 0.8
        B.append({"id": b["id"], "g": q, "a": a, "h": round(min(max(h, 3.0), 36.0), 1), "cls": b.get("class") or "", "r": j})
    built = unary_union([b["g"] for b in B]) if B else Polygon()

    # roads and footpaths
    road_geoms = []
    for rd in d["roads"]:
        try:
            ln = tr(LineString(rd["line"]))
        except Exception:
            continue
        w = ROAD_W.get(rd.get("class") or "unknown", 5.0)
        road_geoms.append((ln, w, rd.get("class")))
    road = unary_union([ln.buffer(w / 2, cap_style="flat", join_style="round") for ln, w, c in road_geoms]).intersection(SLAB).difference(site)
    major = unary_union([ln for ln, w, c in road_geoms if c in ("tertiary", "secondary", "primary")])
    foot = road.buffer(2.4).difference(road).difference(built.buffer(0.3)).difference(site).intersection(SLAB)
    green = unary_union([tr(Polygon(g["ring"])).buffer(0) for g in d.get("green", []) if len(g["ring"]) > 3]).intersection(SLAB).difference(site)

    root = bpy.data.objects.new("SKY_Context_500m", None); coll.objects.link(root)
    objs = []
    # ground, plinth
    gr = MB()
    flat(gr, SLAB.difference(site), -0.02, "ground", 6)
    if not green.is_empty: flat(gr, green.difference(built).difference(road), 0.01, "grass", 6)
    flat(gr, road, 0.04, "asphalt", 6)
    flat(gr, foot, 0.16, "pavers", 2)
    for p in (foot.geoms if hasattr(foot, "geoms") else [foot]):
        if p.geom_type == "Polygon":
            for ir in [p.exterior] + list(p.interiors):
                walls(gr, list(ir.coords), 0.04, 0.16, "kerb", 2, 2, outward=False)
    for ln, w, c in road_geoms:   # lane markings on the bigger roads
        if c not in ("tertiary", "secondary", "primary"): continue
        l = ln.intersection(SLAB.buffer(-4)).difference(site.buffer(4))
        for seg in (l.geoms if hasattr(l, "geoms") else [l]):
            if seg.geom_type != "LineString" or seg.length < 10: continue
            for s0 in np.arange(2, seg.length - 3, 9):
                pa, pb = seg.interpolate(s0), seg.interpolate(min(seg.length, s0 + 3)); dx, dy = pb.x - pa.x, pb.y - pa.y; n = math.hypot(dx, dy) or 1
                nx, ny = -dy / n * 0.08, dx / n * 0.08
                gr.quad((pa.x + nx, pa.y + ny, 0.055), (pa.x - nx, pa.y - ny, 0.055), (pb.x - nx, pb.y - ny, 0.055), (pb.x + nx, pb.y + ny, 0.055), [(0, 0)] * 4, "marking")
    objs.append(gr.build("SKY_Context_Ground", coll, {"sky_component": "context_ground", "sky_source": d["source"]}))
    pl = MB()
    ring = list(SLAB.exterior.coords)
    walls(pl, ring, -14, -0.02, "soil", 8, 8)
    flat(pl, SLAB, -14, "soil", 8, up=False)
    objs.append(pl.build("SKY_Context_Plinth", coll, {"sky_component": "context_plinth"}))

    # buildings: the Andheri way
    road_near = road.buffer(6)
    far, near = MB(), MB()
    props_far, props_near = MB(), MB()
    nearp = [Point(x, y) for x, y in near_points]
    styles = {}
    for b in B:
        q, hgt, a = b["g"], b["h"], b["a"]
        r_ = random.Random(b["id"])
        is_near = any(q.distance(p) < near_r for p in nearp)
        ctx, props = (near, props_near) if is_near else (far, props_far)
        ringc = list(q.exterior.coords)
        if a < 70: style = "chawl"
        elif b["cls"] in ("commercial", "office", "retail", "industrial", "warehouse") or (a > 900 and r_.random() < 0.55): style = "com_ribbon"
        elif a > 1500 and r_.random() < 0.3: style = "com_glass"
        else: style = WALL_STYLES[int(b["r"] * 997) % len(WALL_STYLES)]
        styles[style] = styles.get(style, 0) + 1
        mw, mh = MOD[style]
        shop = a > 80 and hgt > 6 and road_near.intersects(q) and style != "chawl" and r_.random() < 0.7
        z_shop = 4.5 if shop else 0.0
        if shop: walls(ctx, ringc, 0, 4.5, "wall_shop", *MOD["shop"])
        walls(ctx, ringc, z_shop, hgt, "wall_" + style, mw, mh, v0=z_shop)
        inner = q.buffer(-0.25)
        if a > 60 and hgt > 6 and not inner.is_empty and inner.geom_type == "Polygon":
            walls(ctx, ringc, hgt, hgt + 1.0, "parapet", 2, 2)
            walls(ctx, list(inner.exterior.coords), hgt + 0.15, hgt + 1.0, "parapet", 2, 2, outward=False)
            flat(ctx, q.difference(inner), hgt + 1.0, "parapet", 2)
            flat(ctx, inner, hgt + 0.15, "roof", 5)
            if hgt > 11 and a > 200:   # stair cabin
                c = inner.representative_point(); boxm(props, c.x, c.y, hgt + 0.15, hgt + 3.2, 4.2, 3.6, 0.0, "parapet")
            if 120 < a < 3000:
                for _ in range(1 + int(r_.random() * 3)):   # black water tanks
                    c = inner.representative_point(); tx, ty = c.x + r_.uniform(-4, 4), c.y + r_.uniform(-4, 4)
                    if inner.contains(Point(tx, ty)): cyl(props, tx, ty, hgt + 0.15, hgt + 1.8 + r_.random() * 0.6, 0.75, 0.75, 0, "tank", 14)
        else:
            m = "roof_tarp" if r_.random() < 0.35 else "roof_tin_rust" if r_.random() < 0.4 else "roof_tin"
            flat(ctx, q, hgt, m, 3)
    tagb = {"sky_component": "context_buildings", "sky_source": d["source"] + "; heights: " + d.get("dsm_source", "rule"),
            "sky_note": "Footprints from Overture Maps. Heights read from the surface model within a range set by footprint size; not surveyed."}
    o_far = far.build("SKY_Context_Buildings", coll, tagb); objs.append(o_far)
    o_pf = props_far.build("SKY_Context_Rooftops", coll, {"sky_component": "context_rooftops"}); objs.append(o_pf)
    near_objs = [o for o in (near.build("SKY_Context_Buildings_NearPhotoCamera", coll, tagb),
                             props_near.build("SKY_Context_Rooftops_NearPhotoCamera", coll, {"sky_component": "context_rooftops"})) if o]
    objs += near_objs

    # trees: green areas dense, a band along the roads, open ground sparse
    P_ = protos(proto_coll)
    blocked = unary_union([road, built.buffer(1.5), site.buffer(1.0)]).buffer(0.5)
    shapely.prepare(blocked)

    def scatter(area, n):
        if area is None or area.is_empty: return np.zeros((0, 2))
        bx = area.bounds; pts = np.c_[np.random.default_rng(len(str(n))).uniform(bx[0], bx[2], n), np.random.default_rng(n).uniform(bx[1], bx[3], n)]
        ok = shapely.contains_xy(area, pts[:, 0], pts[:, 1]) & ~shapely.contains_xy(blocked, pts[:, 0], pts[:, 1])
        return pts[ok]
    tg = scatter(green, 9000)[::3]
    band = unary_union([road.buffer(4.5)]).difference(road)
    trd = scatter(band, 60000)[::9]
    to = scatter(SLAB, 30000)[::6]
    pts = np.vstack([tg, trd, to])
    # thin to at least 4 m apart
    keep, grid = [], {}
    for x, y in pts:
        k = (int(x // 4), int(y // 4))
        if any((k[0] + i, k[1] + j) in grid for i in (-1, 0, 1) for j in (-1, 0, 1)): continue
        grid[k] = 1; keep.append((x, y))
    trees_root = bpy.data.objects.new("SKY_Context_Trees", None); coll.objects.link(trees_root)
    for i, (x, y) in enumerate(keep[:2600]):
        kind = rng.random()
        proto = P_["ctx_palm"] if kind < 0.12 else P_["ctx_tree_b"] if kind < 0.42 else P_["ctx_tree_a"]
        o = bpy.data.objects.new(f"CTX_Tree_{i:04d}", proto.data)
        coll.objects.link(o)
        o.location = (x, y, 0.0); o.rotation_euler = (0, 0, rng.random() * 6.283); k = 0.65 + 0.4 * rng.random(); o.scale = (k, k, k)
        o.parent = trees_root
        if any(Point(x, y).distance(p) < near_r for p in nearp): near_objs.append(o)
    for o in objs:
        if o is not None: o.parent = root
    trees_root.parent = root
    root["sky_component"] = "context"
    root["sky_source"] = d["source"]
    root["sky_note"] = "Same frame as FM_SKYMARK: metres from the twin's footprint centre, its front facing -Y."
    info = {"source": d["source"], "heights": d.get("dsm_source"), "radius_m": radius, "buildings": len(B),
            "styles": styles, "road_segments": len(road_geoms), "green_areas": len(d.get("green", [])), "trees": min(len(keep), 2600),
            "placement": mp.get("note"), "textures": "scripts/world/textures.py (the Andheri painter), at half size"}
    return root, info, near_objs
