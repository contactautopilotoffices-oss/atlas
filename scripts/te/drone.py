"""Total Environment Whitefield: the opening drone shot, built and rendered in headless Blender (Cycles, CPU).

  .w3d/bin/python scripts/te/drone.py SITE_DIR OUT_DIR [--frames a-b] [--step n] [--samples n]
                                      [--res WxH] [--still f1,f2,..] [--save scene.blend]

SITE_DIR is what scripts/te/site.py wrote (scene.json, ground.jpg, terrain.npy).
Frames go to OUT_DIR/####.png (sky, district and tower; the clouds are added in
the edit by scripts/te/clouds.py).

The shot (16 s at 24 fps, 384 frames), one unbroken move:
  start high over the south-east, looking down through cloud at Hoodi Lake;
  descend and glide north-west across the lake with the Rhapsody township on the left;
  finish on the Workcations tower, its east face in the morning sun.

The tower (Total Environment's Workcations office, Pursuit of a Radical Rhapsody) is
modelled from the founder's render and the sales model video, on the Overture footprint
(82.7 x 28.8 m incl. the spine, axis 20 deg east of north). Estimated, not from CAD:
  rounded brick end towers, radius 12 m, solid with a glazed slit at the junction;
  a central brick spine 13 m wide, standing 4 m proud of both faces;
  glazed bays between, floor slabs every 4.0 m with planted balcony edges;
  ground 6 m (retail), 19 office floors of 3.7 m (TE: G+19), 76.3 m to the roof (Overture reads 74 m);
  roof garden with trees and a glass pavilion.
"""
import sys, os, json, math, random
import numpy as np, bpy, bmesh
from mathutils import Vector, Matrix

argv = sys.argv[1:]
SITE, OUT = argv[0], argv[1]; os.makedirs(OUT, exist_ok=True)
def opt(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d
FR = [int(v) for v in opt("--frames", "1-384").split("-")]
STEP = int(opt("--step", "1")); SAMPLES = int(opt("--samples", "16"))
RES = [int(v) for v in opt("--res", "1920x1080").split("x")]
STILLS = [int(v) for v in opt("--still", "").split(",") if v]
S = json.load(open(f"{SITE}/scene.json")); TERR = np.load(f"{SITE}/terrain.npy"); TI = S["terrain"]
rnd = random.Random(11)

for ob in list(bpy.data.objects): bpy.data.objects.remove(ob)
sc = bpy.context.scene

def zg(x, y):
    """ground height under a point (bilinear on the 20 m terrain grid)"""
    fx = (x - TI["x0"]) / TI["step"]; fy = (y - TI["y0"]) / TI["step"]
    i = min(max(int(fx), 0), TI["nx"] - 2); j = min(max(int(fy), 0), TI["ny"] - 2); u = min(max(fx - i, 0), 1); v = min(max(fy - j, 0), 1)
    return float(TERR[j, i] * (1 - u) * (1 - v) + TERR[j, i + 1] * u * (1 - v) + TERR[j + 1, i] * (1 - u) * v + TERR[j + 1, i + 1] * u * v)

def link(ob): sc.collection.objects.link(ob); return ob
def obj(name, mesh): return link(bpy.data.objects.new(name, mesh))
def hexc(h): h = h.lstrip("#"); return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)) + (1,)

# ---------------------------------------------------------------- materials
def nodes(m): m.use_nodes = True; return m.node_tree.nodes, m.node_tree.links
def principled(name, col, rough=0.7, metal=0.0, **kw):
    m = bpy.data.materials.new(name); N, L = nodes(m); p = N["Principled BSDF"]
    p.inputs["Base Color"].default_value = hexc(col) if isinstance(col, str) else col
    p.inputs["Roughness"].default_value = rough; p.inputs["Metallic"].default_value = metal
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m

def brick_mat(name="TE_brick"):
    """terracotta brick, sampled from the render (#a9502c to #93432a). From the air single bricks are
    sub-pixel and alias into rings on the curved towers, so the brick reads as tone: faint courses
    every 0.6 m on height (which cannot ring) and a large-scale variation."""
    m = bpy.data.materials.new(name); N, L = nodes(m); p = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexCoord")
    wv = N.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Z"; wv.inputs["Scale"].default_value = 1.0 / 0.6 / 1.0
    wv.inputs["Distortion"].default_value = 0.0; L.new(tc.outputs["Object"], wv.inputs["Vector"])
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.06; nz.inputs["Detail"].default_value = 4; L.new(tc.outputs["Object"], nz.inputs["Vector"])
    rmp = N.new("ShaderNodeValToRGB"); rmp.color_ramp.elements[0].color = hexc("#93432a"); rmp.color_ramp.elements[1].color = hexc("#b85d34")
    L.new(nz.outputs["Fac"], rmp.inputs[0])
    mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs["Factor"].default_value = 0.12
    L.new(rmp.outputs[0], mx.inputs[6]); L.new(wv.outputs["Color"], mx.inputs[7]); L.new(mx.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.82
    return m

def glass_mat(name, tint="#2b3640", warm=0.0):
    """office glass: a glossy dark pane with a faint warm interior glow behind it"""
    m = bpy.data.materials.new(name); N, L = nodes(m); p = N["Principled BSDF"]
    p.inputs["Base Color"].default_value = hexc(tint); p.inputs["Roughness"].default_value = 0.06; p.inputs["Metallic"].default_value = 0.55
    p.inputs["Specular IOR Level"].default_value = 0.8
    if warm:
        p.inputs["Emission Color"].default_value = hexc("#ffc98a"); p.inputs["Emission Strength"].default_value = warm
    return m

def foliage_mat(name, a="#3d5a26", b="#6b8a36"):
    m = bpy.data.materials.new(name); N, L = nodes(m); p = N["Principled BSDF"]
    oi = N.new("ShaderNodeObjectInfo"); ramp = N.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc(a); ramp.color_ramp.elements[1].color = hexc(b)
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3.0
    mx = N.new("ShaderNodeMath"); mx.operation = "MULTIPLY_ADD"; mx.inputs[1].default_value = 0.6
    L.new(oi.outputs["Random"], mx.inputs[0]); L.new(nz.outputs["Fac"], mx.inputs[2])
    L.new(mx.outputs[0], ramp.inputs[0]); L.new(ramp.outputs[0], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.9
    p.inputs["Subsurface Weight"].default_value = 0.08
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6; L.new(nz.outputs["Fac"], bump.inputs["Height"]); L.new(bump.outputs[0], p.inputs["Normal"])
    return m

def context_mat():
    """every other building: a tint per building (face attribute), windows from metre UVs, flat roofs"""
    m = bpy.data.materials.new("TE_context"); N, L = nodes(m); p = N["Principled BSDF"]
    at = N.new("ShaderNodeAttribute"); at.attribute_name = "tint"
    rf = N.new("ShaderNodeAttribute"); rf.attribute_name = "roof"
    uv = N.new("ShaderNodeUVMap"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(uv.outputs[0], sep.inputs[0])
    def band(sock, period, lo, hi):
        d = N.new("ShaderNodeMath"); d.operation = "DIVIDE"; d.inputs[1].default_value = period; L.new(sock, d.inputs[0])
        f = N.new("ShaderNodeMath"); f.operation = "FRACT"; L.new(d.outputs[0], f.inputs[0])
        a = N.new("ShaderNodeMath"); a.operation = "GREATER_THAN"; a.inputs[1].default_value = lo; L.new(f.outputs[0], a.inputs[0])
        b = N.new("ShaderNodeMath"); b.operation = "LESS_THAN"; b.inputs[1].default_value = hi; L.new(f.outputs[0], b.inputs[0])
        mm = N.new("ShaderNodeMath"); mm.operation = "MULTIPLY"; L.new(a.outputs[0], mm.inputs[0]); L.new(b.outputs[0], mm.inputs[1]); return mm.outputs[0]
    wu0 = band(sep.outputs[0], 3.1, 0.22, 0.78)
    rb = N.new("ShaderNodeAttribute"); rb.attribute_name = "ribbon"
    wuM = N.new("ShaderNodeMath"); wuM.operation = "MAXIMUM"; L.new(wu0, wuM.inputs[0]); L.new(rb.outputs["Fac"], wuM.inputs[1]); wu = wuM.outputs[0]; wv = band(sep.outputs[1], 3.3, 0.34, 0.80)
    w = N.new("ShaderNodeMath"); w.operation = "MULTIPLY"; L.new(wu, w.inputs[0]); L.new(wv, w.inputs[1])
    nr = N.new("ShaderNodeMath"); nr.operation = "SUBTRACT"; nr.inputs[0].default_value = 1.0; L.new(rf.outputs["Fac"], nr.inputs[1])
    win = N.new("ShaderNodeMath"); win.operation = "MULTIPLY"; L.new(w.outputs[0], win.inputs[0]); L.new(nr.outputs[0], win.inputs[1])
    # roofs: concrete grey with stains
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.4
    rc = N.new("ShaderNodeMix"); rc.data_type = "RGBA"; rc.inputs[6].default_value = hexc("#8d8a84"); rc.inputs[7].default_value = hexc("#b2aea4"); L.new(nz.outputs["Fac"], rc.inputs["Factor"])
    wall = N.new("ShaderNodeMix"); wall.data_type = "RGBA"; L.new(rf.outputs["Fac"], wall.inputs["Factor"]); L.new(at.outputs["Color"], wall.inputs[6]); L.new(rc.outputs[2], wall.inputs[7])
    col = N.new("ShaderNodeMix"); col.data_type = "RGBA"; L.new(win.outputs[0], col.inputs["Factor"]); L.new(wall.outputs[2], col.inputs[6]); col.inputs[7].default_value = hexc("#3a444c")
    L.new(col.outputs[2], p.inputs["Base Color"])
    ro = N.new("ShaderNodeMapRange"); ro.inputs["To Min"].default_value = 0.85; ro.inputs["To Max"].default_value = 0.18; L.new(win.outputs[0], ro.inputs[0]); L.new(ro.outputs[0], p.inputs["Roughness"])
    return m

M_BRICK = brick_mat(); M_GLASS = glass_mat("TE_glass", "#1d252c", warm=1.1); M_RETAIL = glass_mat("TE_retail", "#3a3128", warm=2.5)
M_SLAB = principled("TE_slab", "#cfc8bc", 0.6); M_UPST = principled("TE_upstand", "#6e6a64", 0.7); M_MULL = principled("TE_mullion", "#3a3c3e", 0.4, 0.6)
M_PLANT = foliage_mat("TE_planting", "#2f4a1e", "#5f8a2c"); M_TREE = foliage_mat("TE_tree", "#33501f", "#7a8f3a")
M_TRUNK = principled("TE_trunk", "#4a3a2c", 0.9); M_CTX = context_mat(); M_PAVE = principled("TE_paving", "#b7aea0", 0.8)
M_VIADUCT = principled("TE_viaduct", "#c9c4ba", 0.7)

# ---------------------------------------------------------------- ground and water
def ground():
    x0, y0, x1, y1 = S["box"]; pad = 6000
    me = bpy.data.meshes.new("ground"); nx, ny = TI["nx"], TI["ny"]
    vs = [(TI["x0"] + i * TI["step"], TI["y0"] + j * TI["step"], float(TERR[j, i]) - 0.15) for j in range(ny) for i in range(nx)]
    fs = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(ny - 1) for i in range(nx - 1)]
    me.from_pydata(vs, [], fs); uvl = me.uv_layers.new()
    uvs = np.array([((vs[l.vertex_index][0] - x0) / (x1 - x0), (vs[l.vertex_index][1] - y0) / (y1 - y0)) for l in me.loops]).ravel()
    uvl.data.foreach_set("uv", uvs); me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    m = bpy.data.materials.new("TE_ground"); N, L = nodes(m); p = N["Principled BSDF"]
    t = N.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.abspath(f"{SITE}/ground.jpg")); t.extension = "EXTEND"; t.interpolation = "Cubic"
    L.new(t.outputs[0], p.inputs["Base Color"]); p.inputs["Roughness"].default_value = 0.92
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 1.2; bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25
    L.new(nz.outputs["Fac"], bump.inputs["Height"]); L.new(bump.outputs[0], p.inputs["Normal"])
    me.materials.append(m); obj("ground", me)
    # the far field: a skirt in the averaged colour of the district so the horizon never shows a void
    me2 = bpy.data.meshes.new("farfield")
    outer = [(x0 - pad, y0 - pad), (x1 + pad, y0 - pad), (x1 + pad, y1 + pad), (x0 - pad, y1 + pad)]; inner = [(x0 + 5, y0 + 5), (x1 - 5, y0 + 5), (x1 - 5, y1 - 5), (x0 + 5, y1 - 5)]
    vs = [(x, y, -0.6) for x, y in outer + inner]; fs = [(i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i) for i in range(4)]
    me2.from_pydata(vs, [], fs)
    mf = bpy.data.materials.new("TE_farfield"); N, L = nodes(mf); p = N["Principled BSDF"]
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.004; nz.inputs["Detail"].default_value = 6
    rmp = N.new("ShaderNodeValToRGB"); rmp.color_ramp.elements[0].color = hexc("#6f6c58"); rmp.color_ramp.elements[1].color = hexc("#a39a84")
    L.new(nz.outputs["Fac"], rmp.inputs[0]); L.new(rmp.outputs[0], p.inputs["Base Color"]); p.inputs["Roughness"].default_value = 0.95
    me2.materials.append(mf); obj("farfield", me2)

def water():
    m = bpy.data.materials.new("TE_water"); N, L = nodes(m); p = N["Principled BSDF"]
    p.inputs["Base Color"].default_value = hexc("#1f3a3a"); p.inputs["Roughness"].default_value = 0.035; p.inputs["Specular IOR Level"].default_value = 0.9
    tc = N.new("ShaderNodeTexCoord"); w = N.new("ShaderNodeTexNoise"); w.inputs["Scale"].default_value = 0.35; w.inputs["Detail"].default_value = 8
    mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 3.5, 1); L.new(tc.outputs["Object"], mp.inputs[0]); L.new(mp.outputs[0], w.inputs["Vector"])
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.05; L.new(w.outputs["Fac"], bump.inputs["Height"]); L.new(bump.outputs[0], p.inputs["Normal"])
    bm = bmesh.new()
    for wb in S["water"]:
        if wb["cls"] in ("swimming_pool",): continue
        vs = [bm.verts.new((x, y, zg(x, y) + 0.05)) for x, y in wb["ring"]]
        try: bm.faces.new(vs)
        except ValueError: pass
    me = bpy.data.meshes.new("water"); bm.to_mesh(me); bm.free(); me.materials.append(m); obj("water", me)
    # pools: bright turquoise, they read from the air
    pm = principled("TE_pool", "#2aa6b8", 0.05)
    bm = bmesh.new()
    for wb in S["water"]:
        if wb["cls"] != "swimming_pool": continue
        vs = [bm.verts.new((x, y, zg(x, y) + 0.3)) for x, y in wb["ring"]]
        try: bm.faces.new(vs)
        except ValueError: pass
    me = bpy.data.meshes.new("pools"); bm.to_mesh(me); bm.free(); me.materials.append(pm); obj("pools", me)

# ---------------------------------------------------------------- context buildings
TINTS = ["#cfc4b2", "#ddd3c2", "#bfb19c", "#a9a093", "#d8c6a6", "#b8bec0", "#c9b391", "#e4dccd", "#a8988a", "#c7a98f", "#b3a58c",
         # Bengaluru's painted houses: pastel yellow, pink, sky blue, mint, peach
         "#e2cf8f", "#d9a9a0", "#a9c3cf", "#b5cdb0", "#e3b88f", "#cfa9c0"]
def township(cx, cy):   # Rhapsody's towers and pods: brick like the sales model
    return -230 < cx < 120 and -560 < cy < -120
TANKS = []
def buildings():
    V, F, uv, tint, roof, rib = [], [], [], [], [], []
    for b in S["buildings"]:
        if b["hero"]: continue
        ring = b["ring"]
        if len(ring) < 3: continue
        # make the ring counter-clockwise
        a2 = sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))
        if a2 < 0: ring = ring[::-1]
        cx = sum(p[0] for p in ring) / len(ring); cy = sum(p[1] for p in ring) / len(ring)
        z0 = zg(cx, cy) - 0.5; z1 = z0 + 0.5 + b["h"]
        tw = township(cx, cy) and b["h"] > 30
        t = hexc("#a65a38") if tw else tuple(c * 0.85 for c in hexc(TINTS[int(b["id"].replace("-", "")[:8], 16) % len(TINTS)])[:3]) + (1,)
        n = len(ring); base = len(V); s = 0.0
        for x, y in ring: V.append((x, y, z0))
        for x, y in ring: V.append((x, y, z1))
        for i in range(n):
            j = (i + 1) % n; L_ = math.dist(ring[i], ring[j])
            F.append((base + i, base + j, base + n + j, base + n + i)); uv.append([(s, 0), (s + L_, 0), (s + L_, z1 - z0), (s, z1 - z0)]); s += L_
            tint.append(t); roof.append(0.0); rib.append(1.0 if tw else 0.0)
        F.append(tuple(base + n + i for i in range(n))); uv.append([(x, y) for x, y in ring]); tint.append(t); roof.append(1.0); rib.append(0.0)
        if b["h"] < 20 and rnd.random() < 0.45:   # the black plastic water tank on the roof
            TANKS.append((cx + (rnd.random() - .5) * 2, cy + (rnd.random() - .5) * 2, z1, 0.8 + 0.5 * rnd.random()))
    me = bpy.data.meshes.new("context"); me.from_pydata(V, [], F)
    ul = me.uv_layers.new(); flat = [c for f in uv for p in f for c in p]
    ul.data.foreach_set("uv", flat)
    at = me.attributes.new("tint", "FLOAT_COLOR", "FACE"); at.data.foreach_set("color", [c for t in tint for c in t])
    rf = me.attributes.new("roof", "FLOAT", "FACE"); rf.data.foreach_set("value", roof)
    rb = me.attributes.new("ribbon", "FLOAT", "FACE"); rb.data.foreach_set("value", rib)
    me.materials.append(M_CTX); obj("context", me)
    bm = bmesh.new()
    for x, y, z, r in TANKS:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r * 0.6, radius2=r * 0.6, depth=r * 1.3, matrix=Matrix.Translation((x, y, z + r * 0.65)))
    me = bpy.data.meshes.new("tanks"); bm.to_mesh(me); bm.free(); me.materials.append(principled("TE_tank", "#1b1c1e", 0.5)); obj("tanks", me)
    print(len(F), "context faces")

# ---------------------------------------------------------------- the metro viaduct (Purple Line)
def metro():
    bm = bmesh.new()
    def box(c, d, w, h, z, ang):
        M = Matrix.Translation((c[0], c[1], z)) @ Matrix.Rotation(ang, 4, "Z") @ Matrix.Diagonal((d, w, h, 1))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    for line in S["metro"]:
        for i in range(len(line) - 1):
            a, b = line[i], line[i + 1]; L_ = math.dist(a, b)
            if L_ < 0.5: continue
            ang = math.atan2(b[1] - a[1], b[0] - a[0]); mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; zz = zg(mx, my)
            box((mx, my), L_ + 0.3, 9.5, 1.8, zz + 12.5, ang)
            for k in range(int(L_ // 28) + 1):
                t = (k * 28 + 6) / L_
                if t > 1: break
                px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                box((px, py), 2.0, 2.6, 11.6, zg(px, py) + 5.8, ang)
    me = bpy.data.meshes.new("metro"); bm.to_mesh(me); bm.free(); me.materials.append(M_VIADUCT); obj("metro", me)

# ---------------------------------------------------------------- trees and planting (instanced)
def proto(name, r, trunk_h, lobes, mat, seed):
    """a low-poly tree: a trunk and a few displaced lobes; instanced thousands of times"""
    bm = bmesh.new(); R = random.Random(seed)
    if trunk_h:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.12 * r, radius2=0.08 * r, depth=trunk_h,
                              matrix=Matrix.Translation((0, 0, trunk_h / 2)))
    nt = len(bm.faces)
    for k in range(lobes):
        c = Vector(((R.random() - .5) * r * .9, (R.random() - .5) * r * .9, trunk_h + r * (0.55 + 0.5 * R.random())))
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r * (0.55 + 0.3 * R.random()), matrix=Matrix.Translation(c))
    for v in bm.verts:
        if v.co.z > trunk_h * 0.9: v.co += v.co.normalized() * 0 + Vector(((R.random() - .5), (R.random() - .5), (R.random() - .5))) * r * 0.18
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(M_TRUNK); me.materials.append(mat)
    for i, p in enumerate(me.polygons): p.material_index = 0 if (trunk_h and i < nt) else 1
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    ob = bpy.data.objects.new(name, me); return ob

def scatter(name, pts, protos):
    """points (x, y, z, scale, proto) -> one object per prototype instancing it on a point cloud via geometry nodes"""
    col = bpy.data.collections.new(name + "_protos"); sc.collection.children.link(col); col.hide_render = False
    for k, pr in enumerate(protos):
        P = [p for p in pts if p[4] % len(protos) == k]
        if not P: continue
        col.objects.link(pr); pr.hide_render = True; pr.hide_viewport = True
        me = bpy.data.meshes.new(f"{name}_{k}"); me.from_pydata([(p[0], p[1], p[2]) for p in P], [], [])
        a = me.attributes.new("s", "FLOAT", "POINT"); a.data.foreach_set("value", [p[3] for p in P])
        r = me.attributes.new("rz", "FLOAT", "POINT"); r.data.foreach_set("value", [rnd.random() * 6.283 for _ in P])
        ob = obj(f"{name}_{k}", me)
        ng = bpy.data.node_groups.new(f"{name}_gn{k}", "GeometryNodeTree")
        ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
        ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
        N, L = ng.nodes, ng.links
        gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
        m2p = N.new("GeometryNodeMeshToPoints"); L.new(gi.outputs[0], m2p.inputs["Mesh"])
        oi = N.new("GeometryNodeObjectInfo"); oi.inputs["Object"].default_value = pr
        iop = N.new("GeometryNodeInstanceOnPoints"); L.new(m2p.outputs[0], iop.inputs["Points"]); L.new(oi.outputs["Geometry"], iop.inputs["Instance"])
        sa = N.new("GeometryNodeInputNamedAttribute"); sa.data_type = "FLOAT"; sa.inputs["Name"].default_value = "s"; L.new(sa.outputs["Attribute"], iop.inputs["Scale"])
        ra = N.new("GeometryNodeInputNamedAttribute"); ra.data_type = "FLOAT"; ra.inputs["Name"].default_value = "rz"
        ce = N.new("ShaderNodeCombineXYZ"); L.new(ra.outputs["Attribute"], ce.inputs["Z"]); L.new(ce.outputs[0], iop.inputs["Rotation"])
        L.new(iop.outputs[0], go.inputs[0])
        mod = ob.modifiers.new("scatter", "NODES"); mod.node_group = ng

def trees():
    protos = [proto("tree_a", 1.0, 0.9, 4, M_TREE, 1), proto("tree_b", 1.0, 1.2, 3, M_TREE, 2),
              proto("tree_c", 1.0, 0.7, 5, M_TREE, 3), proto("tree_d", 1.0, 1.0, 2, M_TREE, 4)]
    pts = [(x, y, zg(x, y) - 0.2, h / 2.3, k) for x, y, h, k in S["trees"]]
    scatter("trees", pts, protos); print(len(pts), "trees")

# ---------------------------------------------------------------- the hero: Workcations tower
HC = Vector((-23.5, -42.1, 0)); AX = math.atan2(77.6, 28.5)   # footprint centre, long axis (from the Overture footprint)
GH, FH, NF = 6.0, 3.7, 19; HT = GH + NF * FH                    # TE: ground + 19 floors; 3.7 m floors give 76.3 m (Overture reads 74 m)
def hero():
    z0 = zg(HC.x, HC.y) - 0.3
    W = Matrix.Translation((HC.x, HC.y, z0)) @ Matrix.Rotation(AX, 4, "Z")   # local x = long axis, local y = across (east face is -y)
    parts = {}
    def bm_of(m):
        if m.name not in parts: parts[m.name] = (bmesh.new(), m)
        return parts[m.name][0]
    def box(m, x0, x1, y0, y1, za, zb):
        bmesh.ops.create_cube(bm_of(m), size=1.0, matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2)) @ Matrix.Diagonal((x1 - x0, y1 - y0, zb - za, 1)))
    def cyl(m, cx, r, za, zb, seg=56):
        bmesh.ops.create_cone(bm_of(m), cap_ends=True, segments=seg, radius1=r, radius2=r, depth=zb - za, matrix=Matrix.Translation((cx, 0, (za + zb) / 2)))
    LH, R = 41.3, 12.0
    # the rounded brick end towers, and the glazed slits where they meet the bays
    for s in (-1, 1):
        cyl(M_BRICK, s * (LH - R), R, 0, HT + 2.0)
        box(M_BRICK, min(s * 23, s * (LH - R)), max(s * 23, s * (LH - R)), -R, R, 0, HT + 2.0)
        for sy in (-1, 1): box(M_GLASS, min(s * 22.2, s * 23.4), max(s * 22.2, s * 23.4), sy * R - 0.25, sy * R + 0.25, 2, HT)
        # the cap's own vertical slit on its outer curve
        box(M_GLASS, s * (LH + 0.0) - 0.4, s * (LH + 0.0) + 0.4, -0.35, 0.35, 8, HT - 4)
        box(M_PLANT, min(s * 23, s * (LH - 2)), max(s * 23, s * (LH - 2)), -R + 1.5, R - 1.5, HT + 2.0, HT + 3.2)
    # the central brick spine, proud of both faces, with its small windows
    box(M_BRICK, -6.5, 6.5, -14.4, 14.4, 0, HT + 5.0)
    for k in range(NF + 1):
        zc = GH + k * FH - 1.8 if k else 3.0
        for sy in (-1, 1):
            for cx in (-2.6, 2.6):
                box(M_GLASS, cx - 1.1, cx + 1.1, sy * 14.4 - 0.08, sy * 14.4 + 0.08, zc - 0.55, zc + 0.55)
    # the glazed bays between spine and end towers
    for sx in (-1, 1):
        xa, xb = sorted((sx * 6.5, sx * 23.0))
        box(M_GLASS, xa, xb, -9.6, 9.6, GH, HT)
        box(M_RETAIL, xa, xb, -10.6, 10.6, 0.0, GH - 0.6)          # ground floor shops, lit
        box(M_SLAB, xa, xb, -12.2, 12.2, GH - 0.6, GH)             # canopy over the shops
        for k in range(NF):
            z = GH + k * FH
            # floor slab with a balcony that bulges outwards (alternating depth reads as the curved edges)
            dep = 12.4 if (k % 2 == 0) else 11.6
            box(M_SLAB, xa, xb, -dep, dep, z + FH - 0.32, z + FH)
            for sy in (-1, 1):
                ya, yb = sorted((sy * (dep - 0.9), sy * dep))
                box(M_UPST, xa + 0.4, xb - 0.4, ya, yb, z + FH, z + FH + 0.95)                  # planter upstand
                box(M_PLANT, xa + 0.6, xb - 0.6, ya + 0.1, yb - 0.1, z + FH + 0.95, z + FH + 1.25)  # planting surface
            # mullions on the glass line
            for mxp in np.arange(xa + 1.5, xb, 2.75):
                for sy in (-1, 1): box(M_MULL, mxp - 0.06, mxp + 0.06, sy * 9.6 - 0.12, sy * 9.6 + 0.12, z, z + FH - 0.42)
    # the roof: garden slab, pavilion, parapet
    box(M_SLAB, -23, 23, -11, 11, HT, HT + 0.6)
    box(M_PLANT, -22.5, -7, -10.5, 10.5, HT + 0.6, HT + 1.1); box(M_PLANT, 7, 22.5, -10.5, 10.5, HT + 0.6, HT + 1.1)
    box(M_GLASS, 8, 20, -5, 5, HT + 0.6, HT + 4.8)
    for name, (bm, m) in parts.items():
        me = bpy.data.meshes.new("hero_" + name); bm.to_mesh(me); bm.free(); me.transform(W); me.materials.append(m); obj("hero_" + name, me)
    # planting on balconies and roof: shrub instances
    pts, R2 = [], random.Random(5)
    for sx in (-1, 1):
        xa, xb = sorted((sx * 6.5, sx * 23.0))
        for k in range(NF):
            dep = 12.4 if (k % 2 == 0) else 11.6; z = GH + k * FH + FH + 1.2
            for sy in (-1, 1):
                for x in np.arange(xa + 1.0, xb - 0.8, 1.6):
                    if R2.random() < 0.92:
                        p = W @ Vector((x + R2.random() * .6, sy * (dep - 0.45), z)); pts.append((p.x, p.y, p.z, 0.6 + 0.6 * R2.random() ** 2, R2.randrange(3)))
                    if R2.random() < 0.22:   # a small balcony tree now and then, as in the render
                        p = W @ Vector((x, sy * (dep - 0.45), z)); pts.append((p.x, p.y, p.z, 1.1 + 0.5 * R2.random(), 3))
    for k in range(90):
        x = R2.uniform(-22, 22); y = R2.uniform(-10, 10)
        if 7 < x < 21 and -5.5 < y < 5.5: continue
        p = W @ Vector((x, y, HT + 1.0)); pts.append((p.x, p.y, p.z, 0.6 + 0.9 * R2.random(), R2.randrange(4)))
    for s in (-1, 1):
        for k in range(14):
            a = R2.uniform(0, 6.283); r = R2.uniform(0, 9)
            p = W @ Vector((s * (LH - R) + r * math.cos(a) * 0.8, r * math.sin(a), HT + 3.1)); pts.append((p.x, p.y, p.z, 0.7 + 0.8 * R2.random(), R2.randrange(4)))
    shrubs = [proto("shrub_a", 0.9, 0.0, 3, M_PLANT, 7), proto("shrub_b", 0.9, 0.0, 2, M_PLANT, 8),
              proto("shrub_c", 0.8, 0.0, 4, M_PLANT, 9), proto("shrub_t", 1.0, 1.0, 4, M_PLANT, 10)]
    scatter("planting", pts, shrubs)
    # the forecourt paving
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0, matrix=Matrix.Diagonal((56, 24, 1, 1)))
    me = bpy.data.meshes.new("forecourt"); bm.to_mesh(me); bm.free(); me.transform(W @ Matrix.Translation((0, 0, 0.32))); me.materials.append(M_PAVE); obj("forecourt", me)

# ---------------------------------------------------------------- light, sky, haze
SUN_AZ, SUN_EL = 124.0, 26.0    # Bengaluru, a late-November morning around 08:45: the sun low in the east-south-east
def world():
    w = bpy.data.worlds.new("sky"); sc.world = w; N, L = nodes(w)
    sk = N.new("ShaderNodeTexSky"); sk.sky_type = "MULTIPLE_SCATTERING"
    sk.sun_elevation = math.radians(SUN_EL); sk.sun_rotation = math.radians(90 - SUN_AZ + 180) % (2 * math.pi)
    sk.sun_disc = False; sk.altitude = 900.0; sk.aerosol_density = 0.9; sk.air_density = 1.0
    bg = N["Background"]; bg.inputs["Strength"].default_value = 0.16; L.new(sk.outputs[0], bg.inputs[0])
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 5.5; sun.angle = math.radians(1.2); sun.color = (1.0, 0.9, 0.78)
    so = obj("sun", sun)
    az, el = math.radians(SUN_AZ), math.radians(SUN_EL)
    d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))   # towards the sun (x east, y north)
    so.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    w.mist_settings.start = 120.0; w.mist_settings.depth = 7500.0; w.mist_settings.falloff = "LINEAR"

def compositor():
    sc.view_layers[0].use_pass_mist = True
    ng = bpy.data.node_groups.new("comp", "CompositorNodeTree"); sc.compositing_node_group = ng
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    N, L = ng.nodes, ng.links
    rl = N.new("CompositorNodeRLayers"); go = N.new("NodeGroupOutput")
    pw = N.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 0.8; L.new(rl.outputs["Mist"], pw.inputs[0])
    k = N.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = 0.6; k.use_clamp = True; L.new(pw.outputs[0], k.inputs[0])
    mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"; L.new(k.outputs[0], mx.inputs["Factor"]); L.new(rl.outputs["Image"], mx.inputs[6])
    mx.inputs[7].default_value = (0.66, 0.70, 0.76, 1)          # the morning haze over Whitefield
    L.new(mx.outputs[2], go.inputs[0])

# ---------------------------------------------------------------- the camera move
KEYS = [  # frame, position, look-at, lens (mm)
    (1,   (1150, -1650, 1450), (330, -560, 0), 22),
    (110, (900, -1180, 720), (230, -430, 0), 24),
    (220, (600, -700, 330), (80, -230, 20), 26),
    (300, (470, -330, 190), (-15, -70, 36), 28),
    (384, (245, 18, 95), (-24, -44, 40), 32),
]
def camera():
    cd = bpy.data.cameras.new("cam"); cd.sensor_width = 36; cd.clip_start = 1.0; cd.clip_end = 20000
    cam = obj("cam", cd); sc.camera = cam
    tgt = obj("target", None); con = cam.constraints.new("TRACK_TO"); con.target = tgt; con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"
    for f, p, l, lens in KEYS:
        cam.location = p; cam.keyframe_insert("location", frame=f)
        tgt.location = l; tgt.keyframe_insert("location", frame=f)
        cd.lens = lens; cd.keyframe_insert("lens", frame=f)
    for o in (cam, tgt, cd):
        ad = o.animation_data
        if ad and ad.action:
            for fc in _fcurves(ad):
                for kp in fc.keyframe_points: kp.interpolation = "BEZIER"; kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
def _fcurves(ad):
    act = ad.action
    if hasattr(act, "fcurves"): return act.fcurves
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for cb in strip.channelbags: out += list(cb.fcurves)
    return out

# ---------------------------------------------------------------- build and render
ground(); water(); buildings(); metro(); trees(); hero(); world(); compositor(); camera()
sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SAMPLES; cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.05
cy.use_denoising = True; cy.denoiser = "OPENIMAGEDENOISE"
cy.max_bounces = 4; cy.diffuse_bounces = 2; cy.glossy_bounces = 2; cy.transmission_bounces = 2; cy.transparent_max_bounces = 4
cy.caustics_reflective = cy.caustics_refractive = False; cy.blur_glossy = 1.0
sc.render.use_persistent_data = True
sc.render.resolution_x, sc.render.resolution_y = RES; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = -0.3
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_depth = "8"
sc.render.fps = 24; sc.frame_start, sc.frame_end = 1, 384
sc.render.threads_mode = "AUTO"
if opt("--save"): bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt("--save")))
frames = STILLS or list(range(FR[0], FR[1] + 1, STEP))
import time
for f in frames:
    out = os.path.join(OUT, f"{f:04d}.png")
    if os.path.exists(out) and not STILLS: continue
    t = time.time(); sc.frame_set(f); sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print(f"frame {f} {time.time() - t:.1f}s", flush=True)
