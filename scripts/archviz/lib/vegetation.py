"""Vegetation: real trees, palms, hedges and grass in place of the builders' proxies.

`replace(spec)` finds the proxy planting our builders make (palm_*, crown*, trunk*, hedge*,
proto_tree_*, proto_palm, leaf cards) and the planting lists in a diorama's JSON, removes the
proxies, and puts asset trees at the same spots: a collection per kind (tree.broadleaf_a, tree.palm,
shrub.hedge, grass.clump from assets/library), instanced with geometry nodes so a thousand trees
cost one. Each gets a random yaw, a scale spread and a slight lean. Grass clumps are scattered on
every lawn or green surface by area. When a kind has no asset, a built-in proxy with real leaf
geometry (leaf particles on a displaced crown, as hero_723.py does) stands in.
"""
import math, os
from .common import *
from . import assets, materials

PROXY_PREFIXES = ("palm_trunk", "palm_crown", "frond", "crown", "trunk", "hedge", "proto_tree", "proto_palm", "leaf_proto", "veg")

def _import_model(path):
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"): bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx": bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".blend":
        with bpy.data.libraries.load(path, link=False) as (src, dst): dst.objects = [n for n in src.objects]
        for o in dst.objects:
            if o is not None: bpy.context.scene.collection.objects.link(o)
    elif ext == ".obj": bpy.ops.wm.obj_import(filepath=path)
    return [o for o in set(bpy.data.objects) - before]

def _normalise(objs, height_m):
    """Scale an imported asset so its tallest point is height_m and its base sits at z=0, under one empty."""
    root = bpy.data.objects.new("asset_root", None); bpy.context.scene.collection.objects.link(root)
    for o in objs:
        if o.parent is None or o.parent not in objs: o.parent = root
    bpy.context.view_layer.update()
    bb = world_bbox([o for o in objs if o.type == "MESH"])
    if bb:
        lo, hi = bb; h = max(hi.z - lo.z, 0.01); s = height_m / h
        root.scale = (s, s, s); root.location = (-(lo.x + hi.x) / 2 * s, -(lo.y + hi.y) / 2 * s, -lo.z * s)
    return root

def _exclude(col):
    """Keep an asset collection out of the render (its instances still render) by excluding it from the view layer."""
    def walk(lc):
        if lc.collection == col: lc.exclude = True; return True
        return any(walk(c) for c in lc.children)
    try: walk(bpy.context.view_layer.layer_collection)
    except Exception: pass

def _assets_root():
    root = bpy.data.collections.get("av_assets")
    if root is None: root = bpy.data.collections.new("av_assets"); bpy.context.scene.collection.children.link(root)
    return root

def asset_collection(slot, fallback=None):
    """A collection holding one asset for `slot` (imported once, base at the origin), under the hidden av_assets
    root; or the built-in proxy; or None. Instance it with variants() + instance_on_points()."""
    name = "av_asset_" + slot.replace(".", "_")
    if name in bpy.data.collections: return bpy.data.collections[name]
    col = bpy.data.collections.new(name); _assets_root().children.link(col)
    path = assets.resolve(slot); meta = assets.manifest()["slots"].get(slot, {})
    if path and os.path.isfile(path):
        objs = _import_model(path); root = _normalise(objs, float(meta.get("height_m", meta.get("length_m", 2.0))))
        for o in objs + [root]:
            for c in list(o.users_collection): c.objects.unlink(o)
            col.objects.link(o)
        log(f"asset {slot}: {os.path.basename(path)} ({len(objs)} objects)")
    elif fallback:
        fallback(col); log(f"asset {slot}: no file in the library, built-in proxy")
    else:
        _assets_root().children.unlink(col); bpy.data.collections.remove(col); return None
    return col

def variants(name, cols):
    """A collection of asset collections, for Collection Info with Separate Children: each child is one whole asset."""
    cols = [c for c in cols if c is not None]
    if not cols: return None
    v = bpy.data.collections.get(name)
    if v is None: v = bpy.data.collections.new(name); _assets_root().children.link(v)
    for c in cols:
        if c.name not in v.children:
            for parent in [p for p in bpy.data.collections if c.name in p.children] + ([bpy.context.scene.collection] if c.name in bpy.context.scene.collection.children else []):
                if parent != v: parent.children.unlink(c)
            v.children.link(c)
    return v

def finish_assets():
    """Call once everything is instanced: hide the asset originals from the render."""
    root = bpy.data.collections.get("av_assets")
    if root: _exclude(root)

# ------------------------------------------------------------------ built-in proxies (real leaf geometry)
def _leaves_on(surface_obj, count, leaf_len, leaf_w, rr):
    """Leaf quads over an object's evaluated surface (its modifiers applied): each on a face, lying near the
    surface, spun about the normal, tilted a little. Returns a bmesh with the leaves."""
    dg = bpy.context.evaluated_depsgraph_get(); ev = surface_obj.evaluated_get(dg); me = ev.to_mesh()
    mw = surface_obj.matrix_world; bm = bmesh.new()
    faces = me.polygons; n = len(faces); per = max(1, count // max(1, n))
    for f in faces:
        c = mw @ f.center; nrm = (mw.to_3x3() @ f.normal).normalized()
        t = nrm.orthogonal().normalized(); b2 = nrm.cross(t)
        for k in range(per):
            spin = rr.uniform(0, 2 * math.pi); tilt = rr.uniform(-0.6, 0.6); sz = rr.uniform(0.7, 1.3)
            u = (t * math.cos(spin) + b2 * math.sin(spin)).normalized(); w = nrm.cross(u).normalized()
            d = (u * math.cos(tilt) + nrm * math.sin(tilt)).normalized()
            p0 = c + t * rr.uniform(-0.3, 0.3) + b2 * rr.uniform(-0.3, 0.3) + nrm * rr.uniform(-0.15, 0.1)
            L_, W_ = leaf_len * sz, leaf_w * sz
            v = [bm.verts.new(p0 - w * W_ * .5), bm.verts.new(p0 + w * W_ * .5), bm.verts.new(p0 + d * L_ + w * W_ * .2), bm.verts.new(p0 + d * L_ - w * W_ * .2)]
            bm.faces.new(v)
    ev.to_mesh_clear(); return bm

def _crown(col, at, radius, count, mat, rr, squash=0.8):
    """A leaf cloud: a displaced sphere gives the shape, thousands of leaf quads give the surface; the sphere is removed."""
    me = bpy.data.meshes.new("av_crown_shape"); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=radius); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("av_crown_shape", me); bpy.context.scene.collection.objects.link(o); o.location = at; o.scale = (1, 1, squash)
    d = o.modifiers.new("disp", "DISPLACE"); t = bpy.data.textures.new("av_crown_t", "CLOUDS"); t.noise_scale = radius * 0.5; d.texture = t; d.strength = radius * 0.45
    bpy.context.view_layer.update()
    leaves = _leaves_on(o, count, 0.3, 0.14, rr)
    bpy.data.objects.remove(o); bpy.data.textures.remove(t)
    lo = mesh_object("av_crown", leaves, mat, col); return lo

def proxy_tree(col, h=10.0, r=3.8, kind="leaf"):
    mat = materials.foliage("av_proxy_" + kind, (0.11, 0.2, 0.06) if kind == "leaf" else (0.14, 0.22, 0.07))
    trunk = materials.pbr("av_proxy_trunk", None, (0.27, 0.22, 0.17), 0.9, dirt=0.0, streaks=False, bevel=0.0, bump=0.9)
    out = []
    me = bpy.data.meshes.new("av_trunk"); bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.24, radius2=0.12, depth=h * 0.7); bm.to_mesh(me); bm.free()
    t = bpy.data.objects.new("av_trunk", me); col.objects.link(t); t.location = (0, 0, h * 0.35); t.data.materials.append(trunk); out.append(t)
    rr = rng(int(h * 7))
    for k in range(3): out.append(_crown(col, (rr.uniform(-r * .4, r * .4), rr.uniform(-r * .4, r * .4), h * 0.72 + rr.uniform(-r * .2, r * .3)), r * rr.uniform(0.6, 0.85), 6000, mat, rr))
    return out

def proxy_palm(col, h=9.0):
    mat = materials.foliage("av_proxy_palm", (0.16, 0.26, 0.07), 0.1); trunk = materials.pbr("av_proxy_ptrunk", None, (0.3, 0.25, 0.19), 0.9, dirt=0.0, streaks=False, bevel=0.0, bump=0.9)
    curve = bpy.data.curves.new("av_palm_trunk", "CURVE"); curve.dimensions = "3D"; curve.bevel_depth = 0.19; curve.bevel_resolution = 4
    sp = curve.splines.new("BEZIER"); sp.bezier_points.add(2)
    for i, (px, py, pz) in enumerate(((0, 0, 0), (0.25, 0.1, h * 0.5), (0.7, 0.25, h))):
        bp = sp.bezier_points[i]; bp.co = (px, py, pz); bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new("av_palm_trunk", curve); col.objects.link(o); o.data.materials.append(trunk)
    me = bpy.data.meshes.new("av_palm_crown"); bm = bmesh.new(); rr = rng(int(h * 11)); tx, ty = 0.7, 0.25
    for k in range(18):
        a = k / 18 * 2 * math.pi + rr.uniform(-0.15, 0.15); Lf = rr.uniform(2.8, 3.8); rise = rr.uniform(0.6, 1.3); ca, sa = math.cos(a), math.sin(a); prev = None
        for s_ in range(26):
            t = s_ / 25; r = Lf * t; z = h + 0.2 + rise * math.sin(t * math.pi * 0.7) - 1.9 * t * t; c = Vector((tx + ca * r, ty + sa * r, z))
            if s_ > 2:
                ll = (0.25 + 0.75 * math.sin(min(1, t * 1.15) * math.pi)) * rr.uniform(0.75, 0.95); w = 0.05
                for side in (-1, 1):
                    dvec = Vector((-sa * side, ca * side, 0)) * 0.8 + Vector((ca, sa, 0)) * 0.35; dvec.normalize(); tip = c + dvec * ll + Vector((0, 0, -0.45 * ll))
                    v0 = bm.verts.new(c + Vector((ca, sa, 0)) * -w); v1 = bm.verts.new(c + Vector((ca, sa, 0)) * w); v2 = bm.verts.new(tip + Vector((ca, sa, 0)) * w * .4); v3 = bm.verts.new(tip - Vector((ca, sa, 0)) * w * .4)
                    bm.faces.new((v0, v1, v2, v3))
            if prev is not None:
                v0 = bm.verts.new(prev + Vector((0, 0, .03))); v1 = bm.verts.new(prev - Vector((0, 0, .03))); v2 = bm.verts.new(c - Vector((0, 0, .03))); v3 = bm.verts.new(c + Vector((0, 0, .03))); bm.faces.new((v0, v1, v2, v3))
            prev = c
    bm.to_mesh(me); bm.free(); f = bpy.data.objects.new("av_palm_crown", me); col.objects.link(f); f.data.materials.append(mat)
    return [o, f]

def proxy_hedge(col):
    mat = materials.foliage("av_proxy_hedge", (0.09, 0.18, 0.05))
    me = bpy.data.meshes.new("av_hedge_shape"); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free(); me.transform(Matrix.Diagonal((1.0, 0.9, 0.9, 1)))
    o = bpy.data.objects.new("av_hedge_shape", me); bpy.context.scene.collection.objects.link(o); o.location = (0, 0, 0.45)
    sub = o.modifiers.new("sub", "SUBSURF"); sub.levels = 3
    d = o.modifiers.new("disp", "DISPLACE"); t = bpy.data.textures.new("av_hedge_t", "CLOUDS"); t.noise_scale = 0.5; d.texture = t; d.strength = 0.3
    bpy.context.view_layer.update(); rr = rng(17)
    body = mesh_object("av_hedge_body", _leaves_on(o, 1, 0.01, 0.01, rr), mat, col)   # placeholder, replaced below
    bpy.data.objects.remove(body)
    dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg); evm = ev.to_mesh(); bm2 = bmesh.new(); bm2.from_mesh(evm); bm2.transform(o.matrix_world); ev.to_mesh_clear()
    core = mesh_object("av_hedge_core", bm2, mat, col)
    leaves = mesh_object("av_hedge_leaves", _leaves_on(o, 2400, 0.1, 0.05, rr), mat, col)
    bpy.data.objects.remove(o); bpy.data.textures.remove(t); return [core, leaves]

def proxy_grass(col):
    mat = materials.foliage("av_proxy_grass", (0.18, 0.3, 0.08), 0.1)
    me = bpy.data.meshes.new("av_grass"); bm = bmesh.new(); rr = rng(5)
    for k in range(14):
        a = rr.uniform(0, 2 * math.pi); r0 = rr.uniform(0, 0.12); hgt = rr.uniform(0.15, 0.32); lean = rr.uniform(0.05, 0.18)
        base = Vector((math.cos(a) * r0, math.sin(a) * r0, 0)); tip = base + Vector((math.cos(a) * lean, math.sin(a) * lean, hgt)); side = Vector((-math.sin(a), math.cos(a), 0)) * 0.012
        v0 = bm.verts.new(base - side); v1 = bm.verts.new(base + side); v2 = bm.verts.new(tip); bm.faces.new((v0, v1, v2))
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new("av_grass", me); col.objects.link(o); o.data.materials.append(mat); return [o]

# ------------------------------------------------------------------ instancing with geometry nodes
def _random_node(n, data_type, lo, hi, seed):
    """A Random Value node set up for both socket layouts (Blender 5.x shows only the chosen type's sockets)."""
    r = n.new("FunctionNodeRandomValue"); r.data_type = data_type
    mins = [i for i in r.inputs if i.name == "Min"]; maxs = [i for i in r.inputs if i.name == "Max"]
    pick = {"FLOAT_VECTOR": 0, "FLOAT": 1, "INT": 2}[data_type] if len(mins) > 1 else 0
    try: mins[pick].default_value = lo; maxs[pick].default_value = hi
    except Exception: pass
    for i in r.inputs:
        if i.name == "Seed": i.default_value = seed
    outs = [o for o in r.outputs if o.enabled] if any(o.enabled for o in r.outputs) else list(r.outputs)
    out = outs[0] if len(outs) == 1 else r.outputs[{"FLOAT_VECTOR": 0, "FLOAT": 1, "INT": 2}[data_type]]
    return r, out

def _points_object(name, pts):
    me = bpy.data.meshes.new(name); me.from_pydata([(x, y, z) for x, y, z in pts], [], []); o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

def instance_on_points(name, pts, col, scale=(0.85, 1.2), yaw_random=True, lean=0.03, seed=1):
    """Instance the asset collection at exact points (x, y, z), random pick, yaw, scale and a slight lean."""
    if not pts or col is None: return None
    o = _points_object(name, pts)
    tree = bpy.data.node_groups.new(name + "_gn", "GeometryNodeTree")
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry"); tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n = tree.nodes; gi = n.new("NodeGroupInput"); go = n.new("NodeGroupOutput")
    m2p = n.new("GeometryNodeMeshToPoints"); tree.links.new(gi.outputs[0], m2p.inputs["Mesh"])
    ci = n.new("GeometryNodeCollectionInfo"); ci.inputs["Collection"].default_value = col; ci.inputs["Separate Children"].default_value = True; ci.inputs["Reset Children"].default_value = True; ci.transform_space = "RELATIVE"
    iop = n.new("GeometryNodeInstanceOnPoints"); iop.inputs["Pick Instance"].default_value = True
    tree.links.new(m2p.outputs["Points"], iop.inputs["Points"]); tree.links.new(ci.outputs["Instances"], iop.inputs["Instance"])
    _, rid = _random_node(n, "INT", 0, 1000, seed); tree.links.new(rid, iop.inputs["Instance Index"])
    _, rrot = _random_node(n, "FLOAT_VECTOR", (-lean, -lean, 0), (lean, lean, 2 * math.pi if yaw_random else 0), seed + 1); tree.links.new(rrot, iop.inputs["Rotation"])
    _, rsc = _random_node(n, "FLOAT", scale[0], scale[1], seed + 2); tree.links.new(rsc, iop.inputs["Scale"])
    tree.links.new(iop.outputs["Instances"], go.inputs[0])
    md = o.modifiers.new("av_instances", "NODES"); md.node_group = tree; return o

def scatter_on(surface, col, density, name, scale=(0.7, 1.3), seed=3, align=True):
    """Scatter the asset collection over a surface mesh's faces at `density` per m2 (grass, ground clutter)."""
    if surface is None or col is None: return None
    tree = bpy.data.node_groups.new(name + "_gn", "GeometryNodeTree")
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry"); tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n = tree.nodes; gi = n.new("NodeGroupInput"); go = n.new("NodeGroupOutput")
    dp = n.new("GeometryNodeDistributePointsOnFaces"); dp.distribute_method = "RANDOM"; dp.inputs["Density"].default_value = density; dp.inputs["Seed"].default_value = seed
    tree.links.new(gi.outputs[0], dp.inputs["Mesh"])
    ci = n.new("GeometryNodeCollectionInfo"); ci.inputs["Collection"].default_value = col; ci.inputs["Separate Children"].default_value = True; ci.inputs["Reset Children"].default_value = True; ci.transform_space = "RELATIVE"
    iop = n.new("GeometryNodeInstanceOnPoints"); iop.inputs["Pick Instance"].default_value = True
    tree.links.new(dp.outputs["Points"], iop.inputs["Points"]); tree.links.new(ci.outputs["Instances"], iop.inputs["Instance"])
    _, rid = _random_node(n, "INT", 0, 1000, seed); tree.links.new(rid, iop.inputs["Instance Index"])
    if align: tree.links.new(dp.outputs["Rotation"], iop.inputs["Rotation"])
    _, rsc = _random_node(n, "FLOAT", scale[0], scale[1], seed + 2); tree.links.new(rsc, iop.inputs["Scale"])
    jn = n.new("GeometryNodeJoinGeometry"); tree.links.new(gi.outputs[0], jn.inputs[0]); tree.links.new(iop.outputs["Instances"], jn.inputs[0]); tree.links.new(jn.outputs[0], go.inputs[0])
    md = surface.modifiers.new(name, "NODES"); md.node_group = tree; return md

# ------------------------------------------------------------------ the replacement
def _collect_proxies():
    """Where the builders put planting: (kind, x, y, height) from proxy objects, which are then removed."""
    found = []; remove = []
    for o in list(bpy.data.objects):
        nm = o.name.split("__")[-1]   # a saved scene names objects by group: veg__palm_trunk.003
        if nm.startswith(("palm_trunk", "palm_crown", "frond")):
            if nm.startswith("palm_trunk"):
                p = o.matrix_world.translation; h = 9.0
                try: h = max(p.co.z for p in o.data.splines[0].bezier_points) if o.type == "CURVE" else 9.0
                except Exception: pass
                found.append(("palm", p.x, p.y, h))
            remove.append(o)
        elif nm.startswith("trunk") and not nm.startswith(("trunk_", "trunk."[:0])) and not nm.startswith("av_"):
            p = o.matrix_world.translation; found.append(("tree", p.x, p.y, p.z * 2 / 0.7)); remove.append(o)
        elif nm.startswith(("crown", "leaf_proto")): remove.append(o)
        elif nm.startswith("hedge"):
            bb = world_bbox([o]);
            if bb: found.append(("hedge", (bb[0].x + bb[1].x) / 2, (bb[0].y + bb[1].y) / 2, (bb[1].x - bb[0].x, bb[1].y - bb[0].y)))
            remove.append(o)
    for o in remove:
        try: bpy.data.objects.remove(o)
        except Exception: pass
    return found

def replace(spec, diorama=None):
    found = _collect_proxies()
    trees = [(x, y, 0.0) for k, x, y, h in found if k == "tree"]; palms = [(x, y, 0.0) for k, x, y, h in found if k == "palm"]
    if diorama and diorama.get("trees"):   # the diorama's own planting list: x, y, type (0 tree a, 1 tree b, 2 palm), scale, yaw
        for t in diorama["trees"]:
            x, y, kind = t[0], t[1], int(t[2]) if len(t) > 2 else 0
            (palms if kind == 2 else trees).append((x, y, 0.0))
    # and the spec can add more (e.g. the frontage palms of a hero)
    for p in spec.get("planting", {}).get("palms", []): palms.append((p[0], p[1], 0.0))
    for p in spec.get("planting", {}).get("trees", []): trees.append((p[0], p[1], 0.0))
    made = 0
    if trees:
        both = variants("av_trees_set", [asset_collection("tree.broadleaf_a", lambda c: proxy_tree(c, 11, 4.0)), asset_collection("tree.broadleaf_b", lambda c: proxy_tree(c, 8.5, 3.2, "leaf_b"))])
        instance_on_points("av_trees", trees, both, scale=(0.8, 1.25), seed=11); made += len(trees)
    if palms:
        col_p = variants("av_palms_set", [asset_collection("tree.palm", lambda c: proxy_palm(c, 9.5))]); instance_on_points("av_palms", palms, col_p, scale=(0.85, 1.2), lean=0.06, seed=12); made += len(palms)
    hedges = [f for f in found if f[0] == "hedge"]
    if hedges:
        col_h = variants("av_hedges_set", [asset_collection("shrub.hedge", proxy_hedge)])
        pts = []
        for _, cx, cy, (lx, ly) in hedges:
            n = max(1, int(max(lx, ly) / 0.9)); along = 0 if lx >= ly else 1
            for i in range(n):
                t = (i + 0.5) / n - 0.5; pts.append((cx + (t * lx if along == 0 else 0), cy + (t * ly if along == 1 else 0), 0.0))
        instance_on_points("av_hedges", pts, col_h, scale=(0.9, 1.1), lean=0.0, seed=13); made += len(pts)
    # grass on every lawn and green surface
    lawns = [o for o in bpy.data.objects if o.type == "MESH" and any(s.material and s.material.name.split(".")[0] in ("av_lawn", "lawn", "av_grass", "grass", "av_green", "green") for s in o.material_slots)]
    if lawns:
        col_g = variants("av_grass_set", [asset_collection("grass.clump", proxy_grass)]); dens = float(spec.get("planting", {}).get("grass_density", 6.0))
        for i, o in enumerate(lawns[:12]): scatter_on(o, col_g, dens, f"av_grass_{i}", scale=(0.7, 1.3), seed=20 + i)
        log(f"grass scattered on {min(len(lawns), 12)} lawn surfaces at {dens}/m2")
    log(f"vegetation: {len(trees)} trees, {len(palms)} palms, {len(hedges)} hedges replaced with instanced assets")
    return made
