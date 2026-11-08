"""Shared helpers for the archviz finishing toolkit: node building, arguments, paths, logging.

Everything here is plain bpy; nothing depends on an add-on. Import it from the other lib
modules with `from lib.common import *` (finish.py puts scripts/archviz on sys.path).
"""
import bpy, bmesh, math, os, sys, json, time, random
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))             # scripts/archviz
REPO = os.path.abspath(os.path.join(ROOT, "..", ".."))        # the atlas repo
ASSETS = os.path.join(ROOT, "assets")
LIB = os.path.join(ASSETS, "library")
T0 = time.time()

def log(*a):
    print(f"[archviz {time.time() - T0:6.1f}s]", *a, flush=True)

def argv():
    """Arguments after `--` (blender -b -P finish.py -- ...), or the whole argv under bpy-as-module."""
    a = sys.argv
    return a[a.index("--") + 1:] if "--" in a else a[1:]

def arg(key, default=None, cast=str):
    a = argv()
    if key in a:
        i = a.index(key)
        return cast(a[i + 1]) if i + 1 < len(a) else True
    return default

def flag(key): return key in argv()

def load_json(p):
    with open(p) as f: return json.load(f)

# ------------------------------------------------------------------ node graphs
def new_material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out

def N(nt, kind, **kw):
    """A node of `kind`; kw sets inputs by name when they exist, else node properties."""
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k in n.inputs:
            try: n.inputs[k].default_value = v
            except Exception: pass
        else:
            try: setattr(n, k, v)
            except Exception: pass
    return n

def L(nt, a, b):
    try: return nt.links.new(a, b)
    except Exception as e: log("link failed", a.node.name, "->", b.node.name, e)

def set_in(node, name, v):
    if name in node.inputs:
        try: node.inputs[name].default_value = v; return True
        except Exception: return False
    return False

def principled(nt, **kw):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    for k, v in kw.items(): set_in(b, k, v)
    return b

# ------------------------------------------------------------------ objects
def mesh_object(name, bm, mat=None, collection=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(o)
    if mat is not None: o.data.materials.append(mat)
    return o

def box(name, c0, c1, mat=None, collection=None):
    bm = bmesh.new()
    d = [max(abs(b - a), 1e-4) for a, b in zip(c0, c1)]; c = [(a + b) / 2 for a, b in zip(c0, c1)]
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*d, 1)))
    return mesh_object(name, bm, mat, collection)

def collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name); (parent or bpy.context.scene.collection).children.link(c)
    return c

def objects_matching(prefixes, types=("MESH", "CURVE", "FONT")):
    return [o for o in bpy.data.objects if o.type in types and any(o.name.startswith(p) for p in prefixes)]

def world_bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    if not pts: return None
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])

def add_bevel(o, width=0.012, segments=2):
    if o.type != "MESH" or any(m.type == "BEVEL" for m in o.modifiers): return
    md = o.modifiers.new("av_bevel", "BEVEL"); md.width = width; md.segments = segments; md.limit_method = "ANGLE"; md.angle_limit = math.radians(40)
    md.harden_normals = True
    try: o.data.use_auto_smooth = True
    except AttributeError: pass

def clamp(v, a, b): return max(a, min(b, v))

def rng(seed): return random.Random(seed)
