"""Shared Blender helpers for the RTP exterior: mesh builder, materials, collections."""
import bpy, bmesh, math, os, json
import numpy as np
from mathutils import Vector, Matrix

EXT = "/Users/lohit/Downloads/Atlas/airoli-rtp/exterior"
BUILD = os.path.join(EXT, "_build")
TEX = os.path.join(BUILD, "tex")
TEXMETA = json.load(open(os.path.join(TEX, "textures.json"))) if os.path.exists(os.path.join(TEX, "textures.json")) else {}

def lin(hexs):
    h = hexs.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name); (parent or bpy.context.scene.collection).children.link(c)
    return c

class MB:
    """Accumulates geometry with per-face material slot, per-loop UV, per-loop colour. flush() -> object."""
    def __init__(s):
        s.V = []; s.F = []; s.UV = []; s.C = []; s.MI = []; s.mats = []; s.vmap = None
    def mat(s, m):
        if m not in s.mats: s.mats.append(m)
        return s.mats.index(m)
    def face(s, pts, uvs, m, cols=None):
        k = len(s.V); s.V.extend(pts); s.F.append(list(range(k, k + len(pts))))
        s.UV.extend(uvs); s.C.extend(cols or [(1, 1, 1, 1)] * len(pts)); s.MI.append(s.mat(m))
    def quad_strip(s, ring, z0, z1, m, tile=(1, 1), closed=True, outward=True, col0=(1, 1, 1, 1), col1=(1, 1, 1, 1), offset=0.0, u0=0.0, ztop=None):
        """Vertical wall along a 2D polyline from z0 to z1 (z1 may be per-vertex via ztop). UV u = metres along / tile, v = z / tile."""
        P = [tuple(p) for p in ring]
        if closed and P[0] != P[-1]: P = P + [P[0]]
        if offset:
            P = offset_ring(P, offset, closed)
        u = u0
        for i in range(len(P) - 1):
            (x0, y0), (x1, y1) = P[i], P[i + 1]; L = math.hypot(x1 - x0, y1 - y0)
            if L < 1e-4: continue
            za = z1 if ztop is None else ztop[i % len(ztop)]; zb = z1 if ztop is None else ztop[(i + 1) % len(ztop)]
            pts = [(x0, y0, z0), (x1, y1, z0), (x1, y1, zb), (x0, y0, za)]
            uv = [(u / tile[0], z0 / tile[1]), ((u + L) / tile[0], z0 / tile[1]), ((u + L) / tile[0], zb / tile[1]), (u / tile[0], za / tile[1])]
            cols = [col0, col0, col1, col1]
            if not outward: pts = pts[::-1]; uv = uv[::-1]; cols = cols[::-1]
            s.face(pts, uv, m, cols); u += L
        return u
    def tris(s, V2, F, z, m, tile=(1, 1), flip=False, col=(1, 1, 1, 1), zf=None):
        for f in F:
            pts = [(V2[i][0], V2[i][1], z if zf is None else zf(V2[i][0], V2[i][1])) for i in f]
            if flip: pts = pts[::-1]
            s.face(pts, [(p[0] / tile[0], p[1] / tile[1]) for p in pts], m, [col] * 3)
    def box(s, c, size, rot, m, tile=(1, 1), col=(1, 1, 1, 1), z0=None, bottom=True, top=True):
        """Axis box rotated about z by rot. c = (x, y, zc) or z0 given = bottom."""
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        cx, cy, cz = c
        if z0 is not None: cz = z0 + hz
        ca, sa = math.cos(rot), math.sin(rot)
        def P(dx, dy, dz): return (cx + dx * ca - dy * sa, cy + dx * sa + dy * ca, cz + dz)
        cs = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)]
        for f, (ua, va) in (((0, 1, 5, 4), (0, 2)), ((1, 2, 6, 5), (1, 2)), ((2, 3, 7, 6), (0, 2)), ((3, 0, 4, 7), (1, 2)), ((4, 5, 6, 7), (0, 1)), ((3, 2, 1, 0), (0, 1))):
            if (f == (4, 5, 6, 7) and not top) or (f == (3, 2, 1, 0) and not bottom): continue
            pts = [cs[i] for i in f]
            s.face(pts, [(p[ua] / tile[0] if ua != 1 else p[1] / tile[0], p[va] / tile[1]) for p in pts], m, [col] * 4)
    def cyl(s, cx, cy, z0, z1, r, m, seg=16, tile=(1, 1), caps=True, r1=None, col=(1, 1, 1, 1), bottom=True):
        r1 = r if r1 is None else r1; circ = 2 * math.pi * r
        for i in range(seg):
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            p = [(cx + r * math.cos(a0), cy + r * math.sin(a0), z0), (cx + r * math.cos(a1), cy + r * math.sin(a1), z0),
                 (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1), z1), (cx + r1 * math.cos(a0), cy + r1 * math.sin(a0), z1)]
            u0, u1 = circ * i / seg / tile[0], circ * (i + 1) / seg / tile[0]
            s.face(p, [(u0, z0 / tile[1]), (u1, z0 / tile[1]), (u1, z1 / tile[1]), (u0, z1 / tile[1])], m, [col] * 4)
        if caps:
            top = [(cx + r1 * math.cos(2 * math.pi * i / seg), cy + r1 * math.sin(2 * math.pi * i / seg), z1) for i in range(seg)]
            s.face(top, [(p[0] / tile[0], p[1] / tile[0]) for p in top], m, [col] * seg)
            if bottom:
                bot = [(cx + r * math.cos(2 * math.pi * i / seg), cy + r * math.sin(2 * math.pi * i / seg), z0) for i in range(seg)][::-1]
                s.face(bot, [(p[0] / tile[0], p[1] / tile[0]) for p in bot], m, [col] * seg)
    def flush(s, name, collection, smooth=False, merge=0.0005):
        me = bpy.data.meshes.new(name)
        if not s.F:
            me.from_pydata([], [], []); o = bpy.data.objects.new(name, me); collection.objects.link(o); return o
        me.from_pydata(s.V, [], s.F)
        uvl = me.uv_layers.new(name="UVMap")
        uv = np.array(s.UV, np.float32).ravel(); uvl.data.foreach_set("uv", uv)
        ca = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER"); ca.data.foreach_set("color", np.array(s.C, np.float32).ravel())
        me.polygons.foreach_set("material_index", np.array(s.MI, np.int32))
        for m in s.mats: me.materials.append(m)
        me.polygons.foreach_set("use_smooth", np.full(len(s.F), smooth, bool))
        me.validate(clean_customdata=False); me.update()
        if merge:
            bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(name, me); collection.objects.link(o)
        return o

def offset_ring(P, d, closed=True):
    """Offset a polyline by d (left side positive for CCW rings = outward when d < 0? we use: outward for CCW = right normal)."""
    n = len(P) - (1 if closed and P[0] == P[-1] else 0); Q = P[:n]
    out = []
    for i in range(n):
        p0 = Q[i - 1] if (closed or i > 0) else Q[i]; p1 = Q[i]; p2 = Q[(i + 1) % n] if (closed or i < n - 1) else Q[i]
        def nrm(a, b):
            dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1; return (dy / L, -dx / L)   # right normal (outward for CCW)
        n1 = nrm(p0, p1) if p0 != p1 else nrm(p1, p2); n2 = nrm(p1, p2) if p1 != p2 else n1
        bx, by = n1[0] + n2[0], n1[1] + n2[1]; bl = math.hypot(bx, by) or 1; bx, by = bx / bl, by / bl
        cosh = max(0.35, bx * n1[0] + by * n1[1])
        out.append((p1[0] + bx * d / cosh, p1[1] + by * d / cosh))
    if closed: out.append(out[0])
    return out

# ---------------------------------------------------------------- materials
def _img(name):
    meta = TEXMETA[name]; path = os.path.join(TEX, meta["file"])
    im = bpy.data.images.get(meta["file"]) or bpy.data.images.load(path, check_existing=True)
    return im, meta["tile_m"]

def tile_of(name): return tuple(TEXMETA[name]["tile_m"]) if name in TEXMETA else (1, 1)

def pbr(name, color="#808080", tex=None, rough=0.7, metal=0.0, vcol=False, emit_tex=None, emit_color=None, emit_strength=0.0, alpha_tex=False,
        spec=0.5, bump=0.0, web=None, kind="pbr", coat=0.0):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    b = next(n for n in N if n.type == "BSDF_PRINCIPLED"); b.location = (300, 0)
    b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    try: b.inputs["Specular IOR Level"].default_value = spec
    except Exception: pass
    if coat: b.inputs["Coat Weight"].default_value = coat
    base = None
    if tex:
        im, _ = _img(tex); t = N.new("ShaderNodeTexImage"); t.image = im; t.location = (-400, 0); t.name = "BASE"
        base = t.outputs["Color"]
        if alpha_tex: L.new(t.outputs["Alpha"], b.inputs["Alpha"])
        if bump:
            bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.02
            L.new(t.outputs["Color"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    if vcol:
        va = N.new("ShaderNodeVertexColor"); va.layer_name = "Col"; va.location = (-400, -250)
        if base is None:
            base = va.outputs["Color"]; tint = N.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"; tint.inputs[0].default_value = 1.0
            tint.inputs[6].default_value = (*lin(color), 1); L.new(va.outputs["Color"], tint.inputs[7]); base = tint.outputs[2]
        else:
            mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1.0; mx.location = (0, 0)
            L.new(base, mx.inputs[6]); L.new(va.outputs["Color"], mx.inputs[7]); base = mx.outputs[2]
    if base is not None:
        if tex and not vcol and color.lower() not in ("#ffffff", "#fff"):
            mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1.0
            L.new(base, mx.inputs[6]); mx.inputs[7].default_value = (*lin(color), 1); base = mx.outputs[2]
        L.new(base, b.inputs["Base Color"])
    else:
        b.inputs["Base Color"].default_value = (*lin(color), 1)
    if emit_tex:
        im, _ = _img(emit_tex); t = N.new("ShaderNodeTexImage"); t.image = im; t.location = (-400, -500); t.name = "EMIT_TEX"
        L.new(t.outputs["Color"], b.inputs["Emission Color"])
    elif emit_color:
        b.inputs["Emission Color"].default_value = (*lin(emit_color), 1)
    b.inputs["Emission Strength"].default_value = emit_strength
    m["kind"] = kind; m["web"] = json.dumps(web or {})
    m["emit_night"] = 0.0; m["emit_day"] = emit_strength
    return m

def glass(name, tint="#5f8f8c", reflect=0.32, rough=0.015, transmit_tint="#7fa5a2", web=None):
    """Architectural glass for Cycles: thin (no refraction), reflective, tinted. Export swaps in a glTF principled glass."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N): N.remove(n)
    out = N.new("ShaderNodeOutputMaterial"); out.location = (600, 0)
    tr = N.new("ShaderNodeBsdfTransparent"); tr.inputs["Color"].default_value = (*[c * 0.85 for c in lin(transmit_tint)], 1)
    gl = N.new("ShaderNodeBsdfGlossy"); gl.inputs["Roughness"].default_value = rough; gl.inputs["Color"].default_value = (*lin(tint), 1)
    try: gl.distribution = "GGX"
    except Exception: pass
    lw = N.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.18
    mp = N.new("ShaderNodeMapRange"); mp.inputs["To Min"].default_value = reflect; mp.inputs["To Max"].default_value = 1.0
    L.new(lw.outputs["Fresnel"], mp.inputs["Value"])
    mx = N.new("ShaderNodeMixShader"); L.new(mp.outputs["Result"], mx.inputs["Fac"]); L.new(tr.outputs[0], mx.inputs[1]); L.new(gl.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs["Surface"])
    m["kind"] = "glass"; m["web"] = json.dumps(web or {"type": "glass", "color": tint, "transmission": 0.0, "opacity": 0.55, "roughness": 0.03, "metalness": 0.9, "ior": 1.52})
    m["emit_day"] = 0.0; m["emit_night"] = 0.0
    return m

def emission_scale(state):
    """Day/night emission: each material keeps emit_day / emit_night; set the principled strength."""
    for m in bpy.data.materials:
        if not m.use_nodes or "emit_day" not in m: continue
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b is None: continue
        b.inputs["Emission Strength"].default_value = float(m["emit_night"] if state in ("night", "blue_hour") else m["emit_day"])
