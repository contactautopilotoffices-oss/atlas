"""Skymark F-1, Sector 6, Noida: the real exterior, in Blender, after photos of the building.

  bl/bin/python scripts/skymark/blender/exterior.py --glb OUT.glb            the model the page loads
  bl/bin/python scripts/skymark/blender/exterior.py --render OUT.png --cam front|aerial [--res 3840x2160] [--samples 96]

Built in the page's own building frame (x along the footprint's long axis to the south-east end,
y across it to the north-east side, z up; the same a, b the page uses), sliced floor by floor
(nodes shell_0 .. shell_4, roof, veg) so the page's floor stack and cutaway keep working.

What it models, from the photos:
  the front (south-east end, the street side, where Street View stands)
      a blue glass curtain wall with a dark band at every slab, framed by a charcoal column and
      head; a light grey tiled ACP panel and a charcoal block on its north-east side; a double
      height glass shopfront under a deep bronze sign fascia (care HEALTH INSURANCE, Clovia)
  the long face (south-west, along the road)
      light grey ACP; a big white angled frame round dark glass on the north-west wing; ribbon
      glass in grey ACP through the middle; and at the corner a tall light grey pier that rises
      above the roof with the skymark name and the tenants' signs (care, Clovia)
  the back faces   grey ACP with ribbon windows
  planting         palms along the front and the long face, broad trees at the corners, hedges
Sizes are read off the photos by eye and fitted to the footprint and the deck's floor heights.
"""
import bpy, bmesh, math, os, random, sys, json, addon_utils
from mathutils import Vector, Matrix

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
GLB = arg("--glb"); OUT = arg("--render"); CAM = arg("--cam", "front")
SAMPLES = int(arg("--samples", 96)); RX, RY = map(int, arg("--res", "3840x2160").split("x"))
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
random.seed(61)

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; sc.render.engine = "CYCLES"; cy = sc.cycles
cy.device = "CPU"; cy.samples = SAMPLES; cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.015
cy.use_denoising = True; cy.denoiser = "OPENIMAGEDENOISE"; cy.max_bounces = 8; cy.glossy_bounces = 4; cy.diffuse_bounces = 3
cy.transmission_bounces = 6; cy.sample_clamp_indirect = 6
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = RX, RY, 100
vs = sc.view_settings; vs.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
    try: vs.look = look; break
    except TypeError: pass
COL = sc.collection

# ------------------------------------------------------------------ the page's building frame
A = json.loads(open(os.path.join(ROOT, "engine/atlases/skymark-f1.js")).read().split("=", 1)[1].strip().rstrip(";"))
site, ST, volt = A["site"], A["building"]["storeys"], A["volt"]
th = site["rect"]["angle"]; u = (math.cos(th), math.sin(th))
if u[1] > 0: u = (-u[0], -u[1])
v = (-u[1], u[0])
aa = [e * u[0] + n * u[1] for e, n in site["footprint"]]; bb = [e * v[0] + n * v[1] for e, n in site["footprint"]]
L_ = max(aa) - min(aa); W_ = max(max(bb) - min(bb), volt["size_px"][0] * volt["scale"] + 0.6)
C = (u[0] * (max(aa) + min(aa)) / 2 + v[0] * (max(bb) + min(bb)) / 2, u[1] * (max(aa) + min(aa)) / 2 + v[1] * (max(bb) + min(bb)) / 2)
floorZ = lambda n: 0 if n == 0 else ST["ground"] + (n - 1) * ST["typical"]
floorH = lambda n: ST["ground"] if n == 0 else ST["typical"]
NF = ST["count"]; TOP = floorZ(NF); HL, HW = L_ / 2, W_ / 2
print(f"Skymark F-1 frame: {L_:.1f} x {W_:.1f} m, roof {TOP:.1f} m", flush=True)
# ------------------------------------------------------------------ materials
def nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")
def N(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n
L = lambda nt, a, b: nt.links.new(a, b)

def pbr(name, col, rough, metal=0.0, bump=0.0, bscale=200.0, coat=0.0):
    m, nt, out = nodes(name)
    b = N(nt, "ShaderNodeBsdfPrincipled", **{"Base Color": (*col, 1), "Roughness": rough, "Metallic": metal})
    if coat: b.inputs["Coat Weight"].default_value = coat
    nz = N(nt, "ShaderNodeTexNoise", Scale=3.0, Detail=3.0)
    rr = N(nt, "ShaderNodeMapRange", **{"From Min": 0.3, "From Max": 0.7, "To Min": rough * 0.8, "To Max": min(1, rough * 1.2)})
    L(nt, nz.outputs["Fac"], rr.inputs["Value"]); L(nt, rr.outputs["Result"], b.inputs["Roughness"])
    if bump:
        bn = N(nt, "ShaderNodeTexNoise", Scale=bscale, Detail=5.0); bp = N(nt, "ShaderNodeBump", Strength=bump, Distance=0.004)
        L(nt, bn.outputs["Fac"], bp.inputs["Height"]); L(nt, bp.outputs["Normal"], b.inputs["Normal"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def curtain_glass(name):
    """Low-e tower glass: dark, strongly reflective, and every pane a touch
    out of plane (a Voronoi cell per pane tilts its normal), so the sky and
    the neighbours break up across the facade the way they do on real glass."""
    m, nt, out = nodes(name)
    tc = N(nt, "ShaderNodeTexCoord"); mp = N(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / 1.5, 1 / 1.5, 1 / 4.1)
    L(nt, tc.outputs["Object"], mp.inputs["Vector"])
    vo = N(nt, "ShaderNodeTexVoronoi", Scale=1.0); vo.feature = "F1"; L(nt, mp.outputs[0], vo.inputs["Vector"])
    sep = N(nt, "ShaderNodeSeparateColor"); L(nt, vo.outputs["Color"], sep.inputs[0])
    nm = N(nt, "ShaderNodeCombineXYZ");
    for i, ch in enumerate(("Red", "Green", "Blue")):
        mr = N(nt, "ShaderNodeMapRange", **{"From Min": 0, "From Max": 1, "To Min": -0.05, "To Max": 0.05}); L(nt, sep.outputs[i], mr.inputs["Value"]); L(nt, mr.outputs[0], nm.inputs[i])
    geo = N(nt, "ShaderNodeNewGeometry"); add = N(nt, "ShaderNodeVectorMath", operation="ADD"); L(nt, geo.outputs["Normal"], add.inputs[0]); L(nt, nm.outputs[0], add.inputs[1])
    nn = N(nt, "ShaderNodeVectorMath", operation="NORMALIZE"); L(nt, add.outputs[0], nn.inputs[0])
    b = N(nt, "ShaderNodeBsdfPrincipled", **{"Base Color": (0.03, 0.04, 0.05, 1), "Roughness": 0.025, "Metallic": 0.55})
    b.inputs["Coat Weight"].default_value = 0.8; b.inputs["Coat Roughness"].default_value = 0.0
    b.inputs["Transmission Weight"].default_value = 0.35
    L(nt, nn.outputs[0], b.inputs["Normal"]); L(nt, b.outputs[0], out.inputs["Surface"]); return m

def shop_glass(name):
    m, nt, out = nodes(name)
    tr = N(nt, "ShaderNodeBsdfTransparent", Color=(0.92, 0.95, 0.95, 1))
    gl = N(nt, "ShaderNodeBsdfGlossy", Roughness=0.02) if "ShaderNodeBsdfGlossy" in dir(bpy.types) else N(nt, "ShaderNodeBsdfAnisotropic", Roughness=0.02)
    fr = N(nt, "ShaderNodeFresnel", IOR=1.52)
    mx = N(nt, "ShaderNodeMixShader"); L(nt, fr.outputs[0], mx.inputs[0]); L(nt, tr.outputs[0], mx.inputs[1]); L(nt, gl.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs["Surface"]); return m

def shop_interior(name):
    """Warm lit shops behind the glass: bright ceiling, displays in bands."""
    m, nt, out = nodes(name)
    tc = N(nt, "ShaderNodeTexCoord"); br = N(nt, "ShaderNodeTexBrick", Scale=1.0, **{"Brick Width": 1.6, "Row Height": 0.9, "Mortar Size": 0.05,
        "Color1": (0.95, 0.78, 0.55, 1), "Color2": (0.35, 0.28, 0.24, 1), "Mortar": (0.08, 0.07, 0.06, 1)})
    L(nt, tc.outputs["Object"], br.inputs["Vector"])
    em = N(nt, "ShaderNodeEmission", Strength=2.4); L(nt, br.outputs["Color"], em.inputs["Color"])
    L(nt, em.outputs[0], out.inputs["Surface"]); return m

def pavers(name):
    m, nt, out = nodes(name)
    tc = N(nt, "ShaderNodeTexCoord")
    br = N(nt, "ShaderNodeTexBrick", Scale=1.0, **{"Brick Width": 0.6, "Row Height": 0.3, "Mortar Size": 0.006, "Bias": 0.0,
        "Color1": (0.50, 0.50, 0.49, 1), "Color2": (0.60, 0.60, 0.58, 1), "Mortar": (0.32, 0.32, 0.31, 1)})
    L(nt, tc.outputs["Object"], br.inputs["Vector"])
    b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.75); L(nt, br.outputs["Color"], b.inputs["Base Color"])
    bp = N(nt, "ShaderNodeBump", Strength=0.5, Distance=0.004, invert=True); L(nt, br.outputs["Fac"], bp.inputs["Height"]); L(nt, bp.outputs["Normal"], b.inputs["Normal"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def windows(name, wall, glass, bw=1.6, rh=3.4):
    m, nt, out = nodes(name)
    tc = N(nt, "ShaderNodeTexCoord"); sp = N(nt, "ShaderNodeSeparateXYZ"); L(nt, tc.outputs["Object"], sp.inputs[0])
    uu = N(nt, "ShaderNodeMath", operation="ADD"); L(nt, sp.outputs["X"], uu.inputs[0]); L(nt, sp.outputs["Y"], uu.inputs[1])
    mp = N(nt, "ShaderNodeCombineXYZ"); L(nt, uu.outputs[0], mp.inputs["X"]); L(nt, sp.outputs["Z"], mp.inputs["Y"])
    br = N(nt, "ShaderNodeTexBrick", Scale=1.0, **{"Brick Width": bw, "Row Height": rh, "Mortar Size": 0.35, "Bias": 0.0, "Color1": (*glass, 1), "Color2": (*[c * 1.3 for c in glass], 1), "Mortar": (*wall, 1)})
    br.offset = 0.0; L(nt, mp.outputs[0], br.inputs["Vector"])
    b = N(nt, "ShaderNodeBsdfPrincipled"); L(nt, br.outputs["Color"], b.inputs["Base Color"])
    rr = N(nt, "ShaderNodeMapRange", **{"To Min": 0.08, "To Max": 0.7}); L(nt, br.outputs["Fac"], rr.inputs["Value"]); L(nt, rr.outputs[0], b.inputs["Roughness"])
    mm = N(nt, "ShaderNodeMapRange", **{"To Min": 0.5, "To Max": 0.0}); L(nt, br.outputs["Fac"], mm.inputs["Value"]); L(nt, mm.outputs[0], b.inputs["Metallic"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def emission(name, col, s):
    m, nt, out = nodes(name); e = N(nt, "ShaderNodeEmission", Color=(*col, 1), Strength=s); L(nt, e.outputs[0], out.inputs["Surface"]); return m

def leaves(name, base):
    m, nt, out = nodes(name)
    oi = N(nt, "ShaderNodeObjectInfo"); cr = N(nt, "ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = (*[c * 0.6 for c in base], 1); cr.color_ramp.elements[1].color = (*[min(1, c * 1.35) for c in base], 1)
    L(nt, oi.outputs["Random"], cr.inputs["Fac"])
    b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.55); b.inputs["Subsurface Weight"].default_value = 0.15
    L(nt, cr.outputs["Color"], b.inputs["Base Color"])
    tl = N(nt, "ShaderNodeBsdfTranslucent"); L(nt, cr.outputs["Color"], tl.inputs["Color"])
    mx = N(nt, "ShaderNodeMixShader"); mx.inputs[0].default_value = 0.25; L(nt, b.outputs[0], mx.inputs[1]); L(nt, tl.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs["Surface"]); return m



def blue_glass(name):
    """Tinted float glass: clear enough to see the offices through, blue from the tint and the sky it
    reflects at an angle (Fresnel), as the building's glass looks in the photos."""
    m, nt, out = nodes(name)
    b = N(nt, "ShaderNodeBsdfPrincipled", **{"Base Color": (0.5, 0.66, 0.82, 1), "Roughness": 0.015, "Metallic": 0.0, "IOR": 1.5})
    b.inputs["Transmission Weight"].default_value = 1.0
    L(nt, b.outputs[0], out.inputs["Surface"]); return m
def tile_acp(name, col, joint):
    m, nt, out = nodes(name)
    tc = N(nt, "ShaderNodeTexCoord"); sp = N(nt, "ShaderNodeSeparateXYZ"); L(nt, tc.outputs["Object"], sp.inputs[0])
    uu = N(nt, "ShaderNodeMath", operation="ADD"); L(nt, sp.outputs["X"], uu.inputs[0]); L(nt, sp.outputs["Y"], uu.inputs[1])
    mp = N(nt, "ShaderNodeCombineXYZ"); L(nt, uu.outputs[0], mp.inputs["X"]); L(nt, sp.outputs["Z"], mp.inputs["Y"])
    br = N(nt, "ShaderNodeTexBrick", Scale=1.0, **{"Brick Width": 1.2, "Row Height": 1.2, "Mortar Size": 0.012, "Bias": 0.0,
        "Color1": (*col, 1), "Color2": (*[c * 0.96 for c in col], 1), "Mortar": (*joint, 1)})
    br.offset = 0.0; L(nt, mp.outputs[0], br.inputs["Vector"])
    b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.32, Metallic=0.55); L(nt, br.outputs["Color"], b.inputs["Base Color"])
    bp = N(nt, "ShaderNodeBump", Strength=0.4, Distance=0.003, invert=True); L(nt, br.outputs["Fac"], bp.inputs["Height"]); L(nt, bp.outputs["Normal"], b.inputs["Normal"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

M = {
    "glass_blue": blue_glass("glass_blue"), "glass_dark": curtain_glass("glass_dark"),
    "acp_light": tile_acp("acp_light", (0.56, 0.57, 0.57), (0.3, 0.31, 0.31)), "acp_tile": tile_acp("acp_tile", (0.66, 0.67, 0.67), (0.36, 0.37, 0.37)),
    "charcoal": pbr("charcoal", (0.035, 0.038, 0.042), 0.4, 0.5), "white_frame": pbr("white_frame", (0.78, 0.78, 0.77), 0.3, 0.35),
    "bronze": pbr("bronze", (0.26, 0.16, 0.08), 0.4, 0.6), "mullion": pbr("mullion", (0.05, 0.055, 0.06), 0.35, 0.8),
    "sign_white": emission("sign_white", (0.98, 0.98, 0.96), 2.0), "sign_magenta": pbr("sign_magenta", (0.55, 0.03, 0.22), 0.35, 0.1),
    "sign_blue": pbr("sign_blue", (0.06, 0.32, 0.62), 0.35, 0.1), "sign_green": pbr("sign_green", (0.42, 0.6, 0.1), 0.35, 0.1),
    "sign_orange": emission("sign_orange", (1.0, 0.45, 0.05), 3.0),
    "shopglass": shop_glass("shopglass"), "shop": shop_interior("shop"), "interior": pbr("interior", (0.16, 0.16, 0.16), 0.8),
    "ceiling_led": emission("ceiling_led", (1.0, 0.95, 0.88), 1.6),
    "concrete": pbr("concrete", (0.5, 0.49, 0.47), 0.85, bump=0.15, bscale=60), "asphalt": pbr("asphalt", (0.075, 0.075, 0.08), 0.8, bump=0.3, bscale=300),
    "pavers": pavers("pavers"), "kerb": pbr("kerb", (0.62, 0.61, 0.58), 0.8), "lawn": leaves("lawn", (0.1, 0.19, 0.05)),
    "leaf": leaves("leaf", (0.11, 0.2, 0.06)), "palm": leaves("palm", (0.16, 0.26, 0.07)), "trunk": pbr("trunk", (0.27, 0.22, 0.17), 0.9, bump=0.4, bscale=40),
    "hedge": leaves("hedge", (0.09, 0.18, 0.05)),
    "carpet": pbr("carpet", (0.16, 0.17, 0.18), 0.95), "core": pbr("core", (0.62, 0.61, 0.58), 0.85), "ceiling": pbr("ceiling", (0.82, 0.82, 0.8), 0.9),
    "panel_led": emission("panel_led", (1.0, 0.97, 0.92), 4.0), "desk": pbr("desk", (0.78, 0.7, 0.58), 0.5), "deskleg": pbr("deskleg", (0.85, 0.85, 0.84), 0.4, 0.5),
    "chair": pbr("chair", (0.05, 0.05, 0.055), 0.6), "screen": emission("screen", (0.35, 0.5, 0.75), 0.9),
    "skin": pbr("skin", (0.42, 0.25, 0.16), 0.55), "skin2": pbr("skin2", (0.3, 0.18, 0.11), 0.55), "hair": pbr("hair", (0.03, 0.025, 0.02), 0.6),
    "trousers": pbr("trousers", (0.06, 0.07, 0.09), 0.8), "shirt_w": pbr("shirt_w", (0.82, 0.82, 0.8), 0.8), "shirt_b": pbr("shirt_b", (0.18, 0.3, 0.55), 0.8),
    "shirt_g": pbr("shirt_g", (0.35, 0.37, 0.4), 0.8), "shirt_m": pbr("shirt_m", (0.42, 0.1, 0.16), 0.8),
}
def box(name, c0, c1, m, bevel=0.0):
    (ax, ay, az), (bx, by, bz) = c0, c1
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    me.transform(Matrix.Diagonal((max(abs(bx - ax), 1e-4), max(abs(by - ay), 1e-4), max(abs(bz - az), 1e-4), 1)))
    o = bpy.data.objects.new(name, me); COL.objects.link(o); o.location = ((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
    o.data.materials.append(M[m] if isinstance(m, str) else m)
    if bevel: md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = 2; md.limit_method = "ANGLE"
    return o

def array_x(o, count, step):
    md = o.modifiers.new("arr", "ARRAY"); md.count = count; md.use_relative_offset = False; md.use_constant_offset = True; md.constant_offset_displace = (step, 0, 0); return o
def array_y(o, count, step):
    md = o.modifiers.new("arr", "ARRAY"); md.count = count; md.use_relative_offset = False; md.use_constant_offset = True; md.constant_offset_displace = (0, step, 0); return o
def array_z(o, count, step):
    md = o.modifiers.new("arrz", "ARRAY"); md.count = count; md.use_relative_offset = False; md.use_constant_offset = True; md.constant_offset_displace = (0, 0, step); return o


# trees, palms and hedges: dense leaf clusters, not leaf cards
def leaf_proto(name, length, width):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    pts = [(0, 0), (width * 0.5, length * 0.3), (width * 0.45, length * 0.7), (0, length), (-width * 0.45, length * 0.7), (-width * 0.5, length * 0.3)]
    vs_ = [bm.verts.new((x, y, 0.08 * (y / length) ** 2 * length)) for x, y in pts]; bm.faces.new(vs_); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COL.objects.link(o); o.hide_render = True; o.hide_viewport = True; return o
LEAF = leaf_proto("leaf_proto", 0.34, 0.16)
def crown(name, at, radius, count, mat, squash=0.8):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=radius); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COL.objects.link(o); o.location = at; o.scale = (1, 1, squash)
    d = o.modifiers.new("disp", "DISPLACE"); t = bpy.data.textures.new(name + "_t", "CLOUDS"); t.noise_scale = radius * 0.5; d.texture = t; d.strength = radius * 0.45
    o.data.materials.append(M[mat])
    ps = o.modifiers.new("leaves", "PARTICLE_SYSTEM").particle_system.settings
    ps.type = "HAIR"; ps.count = count; ps.hair_length = 1.0; ps.render_type = "OBJECT"; ps.instance_object = LEAF
    ps.use_rotations = True; ps.rotation_mode = "NOR"; ps.phase_factor_random = 2.0; ps.rotation_factor_random = 1.0
    ps.particle_size = 1.0; ps.size_random = 0.5; ps.use_emit_random = True; ps.emit_from = "FACE"
    o.show_instancer_for_render = False
    LEAF.data.materials.clear(); LEAF.data.materials.append(M[mat]); return o
def tree(x, y, h, r):
    me = bpy.data.meshes.new("trunk"); bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.22, radius2=0.12, depth=h * 0.7); bm.to_mesh(me); bm.free()
    t = bpy.data.objects.new("trunk", me); COL.objects.link(t); t.location = (x, y, h * 0.35); t.data.materials.append(M["trunk"])
    for k in range(3):
        crown(f"crown{x:.0f}_{k}", (x + random.uniform(-r * 0.4, r * 0.4), y + random.uniform(-r * 0.4, r * 0.4), h * 0.72 + random.uniform(-r * 0.2, r * 0.3)), r * random.uniform(0.6, 0.85), 14000, "leaf")
def palm(x, y, h):
    curve = bpy.data.curves.new("palm_trunk", "CURVE"); curve.dimensions = "3D"; curve.bevel_depth = 0.17; curve.bevel_resolution = 3
    sp = curve.splines.new("BEZIER"); sp.bezier_points.add(1)
    lean = random.uniform(-1.0, 1.0)
    for i, (px, py, pz) in enumerate(((x, y, 0), (x + lean, y + lean * 0.3, h))):
        bp = sp.bezier_points[i]; bp.co = (px, py, pz); bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new("palm_trunk", curve); COL.objects.link(o); o.data.materials.append(M["trunk"])
    for k in range(14):   # fronds: arching strips of leaflets
        a = k / 14 * 2 * math.pi + random.uniform(-0.2, 0.2); Lf = random.uniform(2.6, 3.4)
        me = bpy.data.meshes.new("frond"); bm = bmesh.new(); prev = None
        for s in range(10):
            t = s / 9; r = Lf * t; z = h + 0.3 + math.sin(t * math.pi * 0.8) * 0.9 - t * t * 1.6
            w = 0.55 * math.sin(t * math.pi) + 0.05
            c = (x + lean + math.cos(a) * r, y + lean * 0.3 + math.sin(a) * r, z); px_, py_ = -math.sin(a) * w, math.cos(a) * w
            v1 = bm.verts.new((c[0] - px_, c[1] - py_, c[2] - 0.12 * w)); v2 = bm.verts.new((c[0] + px_, c[1] + py_, c[2] - 0.12 * w)); vc = bm.verts.new((c[0], c[1], c[2] + 0.05))
            if prev: bm.faces.new((prev[0], v1, vc, prev[2])); bm.faces.new((prev[2], vc, v2, prev[1]))
            prev = (v1, v2, vc)
        bm.to_mesh(me); bm.free(); f = bpy.data.objects.new("frond", me); COL.objects.link(f); f.data.materials.append(M["palm"])
        f.modifiers.new("solid", "SOLIDIFY").thickness = 0.01
def hedge(x0, x1, y):
    me = bpy.data.meshes.new("hedge"); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    me.transform(Matrix.Diagonal((x1 - x0, 0.9, 0.9, 1))); o = bpy.data.objects.new("hedge", me); COL.objects.link(o); o.location = ((x0 + x1) / 2, y, 0.45)
    sub = o.modifiers.new("sub", "SUBSURF"); sub.levels = 3; sub.render_levels = 3
    d = o.modifiers.new("disp", "DISPLACE"); t = bpy.data.textures.new("hedge_t", "CLOUDS"); t.noise_scale = 0.5; d.texture = t; d.strength = 0.35
    o.data.materials.append(M["hedge"])
    ps = o.modifiers.new("leaves", "PARTICLE_SYSTEM").particle_system.settings
    ps.type = "HAIR"; ps.count = int((x1 - x0) * 900); ps.hair_length = 1.0; ps.render_type = "OBJECT"; ps.instance_object = LEAF
    ps.use_rotations = True; ps.rotation_mode = "NOR"; ps.phase_factor_random = 2.0; ps.rotation_factor_random = 1.0; ps.size_random = 0.5; ps.emit_from = "FACE"
    o.show_instancer_for_render = False


# ---- a better palm for the stills: each frond an arching midrib with leaflets drooping off both sides
def palm(x, y, h):
    curve = bpy.data.curves.new("palm_trunk", "CURVE"); curve.dimensions = "3D"; curve.bevel_depth = 0.19; curve.bevel_resolution = 4
    sp = curve.splines.new("BEZIER"); sp.bezier_points.add(2); lean = random.uniform(-0.8, 0.8)
    for i, (px, py, pz) in enumerate(((x, y, 0), (x + lean * 0.35, y + lean * 0.1, h * 0.5), (x + lean, y + lean * 0.3, h))):
        bp = sp.bezier_points[i]; bp.co = (px, py, pz); bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new("palm_trunk", curve); COL.objects.link(o); o.data.materials.append(M["trunk"])
    tx, ty = x + lean, y + lean * 0.3
    me = bpy.data.meshes.new("palm_crown"); bm = bmesh.new()
    for k in range(18):
        a = k / 18 * 2 * math.pi + random.uniform(-0.15, 0.15); Lf = random.uniform(2.8, 3.8); rise = random.uniform(0.6, 1.3)
        ca, sa = math.cos(a), math.sin(a); prev = None
        for s_ in range(26):
            t = s_ / 25; r = Lf * t; z = h + 0.2 + rise * math.sin(t * math.pi * 0.7) - 1.9 * t * t
            c = Vector((tx + ca * r, ty + sa * r, z))
            if s_ > 2:                                   # a pair of leaflets at this point of the midrib
                ll = (0.25 + 0.75 * math.sin(min(1, t * 1.15) * math.pi)) * random.uniform(0.75, 0.95); w = 0.05
                for side in (-1, 1):
                    dvec = Vector((-sa * side, ca * side, 0)) * 0.8 + Vector((ca, sa, 0)) * 0.35; dvec.normalize()
                    tip = c + dvec * ll + Vector((0, 0, -0.45 * ll))
                    v0 = bm.verts.new(c + Vector((ca, sa, 0)) * -w); v1 = bm.verts.new(c + Vector((ca, sa, 0)) * w)
                    v2 = bm.verts.new(tip + Vector((ca, sa, 0)) * w * 0.4); v3 = bm.verts.new(tip - Vector((ca, sa, 0)) * w * 0.4)
                    bm.faces.new((v0, v1, v2, v3))
            if prev is not None:
                v0 = bm.verts.new(prev + Vector((0, 0, 0.03))); v1 = bm.verts.new(prev - Vector((0, 0, 0.03))); v2 = bm.verts.new(c - Vector((0, 0, 0.03))); v3 = bm.verts.new(c + Vector((0, 0, 0.03)))
                bm.faces.new((v0, v1, v2, v3))
            prev = c
    bm.to_mesh(me); bm.free(); f = bpy.data.objects.new("palm_crown", me); COL.objects.link(f); f.data.materials.append(M["palm"])

# ------------------------------------------------------------------ the building, floor by floor
GROUP = {}; CUR = ["shell_0"]
_box = box
def box(name, c0, c1, m, bevel=0.0):
    o = _box(name, c0, c1, m, bevel); GROUP.setdefault(CUR[0], []).append(o); return o
def F(face, s0, s1, z0, z1, d0, d1, m, name="p"):
    """A box on one face: s along the face, d out from it (negative is inside)."""
    if face == "se": return box(name, (HL + d0, s0, z0), (HL + d1, s1, z1), m)
    if face == "nw": return box(name, (-HL - d1, s0, z0), (-HL - d0, s1, z1), m)
    if face == "sw": return box(name, (s0, -HW - d1, z0), (s1, -HW - d0, z1), m)
    return box(name, (s0, HW + d0, z0), (s1, HW + d1, z1), m)
ROT = {"sw": 0.0, "se": math.pi / 2, "ne": math.pi, "nw": -math.pi / 2}
def at(face, s, d):
    return {"se": (HL + d, s), "nw": (-HL - d, s), "sw": (s, -HW - d), "ne": (s, HW + d)}[face]
def text(name, s, size, face, s_at, z, d, m, extrude=0.06):
    cu = bpy.data.curves.new(name, "FONT"); cu.body = s; cu.size = size; cu.extrude = extrude; cu.align_x = "CENTER"; cu.align_y = "CENTER"
    o = bpy.data.objects.new(name, cu); COL.objects.link(o); x, y = at(face, s_at, d); o.location = (x, y, z)
    o.rotation_euler = (math.radians(90), 0, ROT[face] + (math.pi if face in ("ne",) else 0) * 0)
    if face == "se": o.rotation_euler = (math.radians(90), 0, math.radians(90))
    if face == "nw": o.rotation_euler = (math.radians(90), 0, math.radians(-90))
    if face == "ne": o.rotation_euler = (math.radians(90), 0, math.radians(180))
    o.data.materials.append(M[m]); GROUP.setdefault(CUR[0], []).append(o); return o
def slant(face, sa0, sa1, w, z0, z1, d0, d1, m, name="slant"):
    """A member whose inner edge runs from s=sa0 at z0 to s=sa1 at z1 (one floor's slice of a raking leg)."""
    me = bpy.data.meshes.new(name); bm = bmesh.new(); vv = []
    for (s_, z_) in ((sa0, z0), (sa0 + w, z0), (sa1 + w, z1), (sa1, z1)):
        for d_ in (d0, d1):
            x, y = at(face, s_, d_); vv.append(bm.verts.new((x, y, z_)))
    q = lambda *i: bm.faces.new([vv[k] for k in i])
    for f_ in ((0, 2, 4, 6), (1, 7, 5, 3), (0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 7, 6), (6, 7, 1, 0)):
        try: q(*f_)
        except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COL.objects.link(o); o.data.materials.append(M[m]); GROUP.setdefault(CUR[0], []).append(o); return o
def ribbon(face, s0, s1, z0, z1, n, step=1.5):
    """Ribbon glass in grey ACP: a spandrel at the slab, glass, a head band; mullions every step."""
    F(face, s0, s1, z0, z0 + (0.25 if n == 0 else 1.0), 0, 0.22, "acp_light")
    F(face, s0, s1, z0 + (0.25 if n == 0 else 1.0), z1 - 0.35, -0.05, 0.0, "glass_blue" if n else "glass_dark")
    F(face, s0, s1, z1 - 0.35, z1, 0, 0.22, "acp_light")
    s = s0 + step
    while s < s1 - 0.2: F(face, s - 0.04, s + 0.04, z0 + 0.25, z1 - 0.35, 0, 0.12, "mullion"); s += step

PIER0 = HL - 9.0                   # the corner pier on the long face
COLS = (-HW + 2.4, -HW + 4.4)      # the charcoal column on the front
GL = (COLS[1], HW - 13.0); TILE = (HW - 13.0, HW - 5.5); BLOCK = (HW - 5.5, HW)
WING = (-HL, -HL + 24.0)
FR_L, FR_W = -HL + 2.0, 1.8        # the white frame's left leg and member width
def frame_x(z):                    # the raking right leg: 20 m in at the first floor, 16 m in at the roof
    t = (z - floorZ(1)) / (TOP - floorZ(1)); return -HL + 20.0 + (16.0 - 20.0) * t

for n in range(NF):
    z0, z1 = floorZ(n), floorZ(n) + floorH(n); CUR[0] = f"shell_{n}"; top = n == NF - 1
    # ---- the front (south-east)
    F("se", COLS[0], COLS[1], z0, z1 + (1.8 if top else 0), -0.1, 0.9, "charcoal")
    if n == 0:
        F("se", GL[0], HW - 0.6, 0.0, z1 - 1.5, -1.25, -1.2, "shopglass")
        F("se", GL[0], HW - 0.6, 0.0, z1 - 0.2, -4.0, -3.9, "shop")
        F("se", GL[0], HW - 0.6, z1 - 1.6, z1 - 1.5, -4.0, -1.2, "ceiling_led")
        s = GL[0] + 2.4
        while s < HW - 0.8: F("se", s - 0.05, s + 0.05, 0.0, z1 - 1.5, -1.3, -1.15, "mullion"); s += 2.4
        F("se", GL[0], HW - 0.4, z1 - 1.55, z1 + 0.15, -1.2, 1.7, "bronze")               # the sign fascia
        F("se", HW - 0.6, HW, 0, z1 + 0.15, -1.2, 1.7, "charcoal")
    else:
        F("se", GL[0], GL[1], z0, z1, -0.05, 0.0, "glass_blue")
        F("se", GL[0], GL[1], z0 - 0.05, z0 + 0.55, 0.0, 0.28, "charcoal")              # a dark band at every slab
        s = GL[0] + 1.5
        while s < GL[1] - 0.2: F("se", s - 0.035, s + 0.035, z0 + 0.55, z1 - 0.05, 0, 0.1, "mullion"); s += 1.5
        F("se", TILE[0], TILE[1] if n < NF - 1 else HW, z0, z1, 0.0, 0.3, "acp_tile")
        if n < NF - 1: F("se", BLOCK[0], BLOCK[1], z0, z1, 0.0, 0.6, "charcoal")
        if top: F("se", COLS[1], GL[1], z1, z1 + 1.8, -0.1, 0.9, "charcoal")               # the head of the glass frame
    # ---- the long face (south-west)
    F("sw", PIER0, HL + 0.9, z0, z1 + (3.2 if top else 0), -0.4, 0.6, "acp_light")       # the corner pier, above the roof at the top
    if n == 0:
        s = -HL
        while s < PIER0 - 0.5:
            e = min(s + 6.0, PIER0); F("sw", s, s + 0.6, z0, z1, 0, 0.35, "acp_light"); F("sw", s + 0.6, e, z0 + 0.3, z1 - 0.5, -0.05, 0, "glass_dark")
            F("sw", s, e, z1 - 0.5, z1, 0, 0.3, "acp_light"); s = e
    else:
        # the north-west wing: grey ACP, with the white angled frame round dark glass
        xr0, xr1 = frame_x(z0), frame_x(z1)
        F("sw", WING[0], FR_L, z0, z1, 0, 0.12, "acp_light")
        F("sw", FR_L + FR_W, min(xr0, xr1), z0, z1, -0.6, -0.55, "glass_dark")
        slant("sw", xr0 - 0.2, xr1 - 0.2, 0.6, z0, z1, -0.6, -0.55, "glass_dark")
        F("sw", FR_L, FR_L + FR_W, z0, z1, -0.2, 1.6, "white_frame")
        slant("sw", xr0, xr1, FR_W, z0, z1, -0.2, 1.6, "white_frame")
        right = max(xr0, xr1) + FR_W
        F("sw", right, WING[1], z0, z1, 0, 0.12, "acp_light")
        slant("sw", xr0 + FR_W, xr1 + FR_W, (WING[1] - right) * 0 + 0.01, z0, z1, 0, 0.12, "acp_light")
        if n == 1: F("sw", FR_L, xr0 + FR_W, z0, z0 + FR_W, -0.2, 1.6, "white_frame")      # the frame's sill
        if top: F("sw", FR_L, xr1 + FR_W, z1 - FR_W, z1, -0.2, 1.6, "white_frame")         # and its head
        ribbon("sw", WING[1], PIER0, z0, z1, n)
    # ---- the back faces
    ribbon("ne", -HL, HL, z0, z1, n); ribbon("nw", -HW, HW, z0, z1, n)

# ---- people at work: every upper floor fitted out behind the glass (carpet, a core, a lit ceiling,
#      rows of desks along the facades with screens, chairs and people at most of them)
class Acc:
    """Many boxes, one mesh per material: thousands of desk and people parts without thousands of objects."""
    def __init__(s): s.bm = {}
    def box(s, c0, c1, m):
        bm = s.bm.setdefault(m, bmesh.new()); c = [(a + b) / 2 for a, b in zip(c0, c1)]; d = [max(abs(b - a), 1e-3) for a, b in zip(c0, c1)]
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*d, 1)))
    def build(s, name):
        for m, bm in s.bm.items():
            me = bpy.data.meshes.new(f"{name}_{m}"); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(f"{name}_{m}", me); COL.objects.link(o)
            o.data.materials.append(M[m]); GROUP.setdefault(CUR[0], []).append(o)
SHIRTS = ("shirt_w", "shirt_b", "shirt_g", "shirt_m", "shirt_w", "shirt_b")
def seat(acc, p, f, t, z, k):
    """A desk with a screen at p, its chair behind and (most of the time) a person in it facing the glass.
    f: unit vector out to the facade, t: along it; both axis-aligned in this frame."""
    def bx(fo0, fo1, ta0, ta1, z0_, z1_, m):
        xs = sorted((p[0] + f[0] * fo0 + t[0] * ta0, p[0] + f[0] * fo1 + t[0] * ta1)); ys = sorted((p[1] + f[1] * fo0 + t[1] * ta0, p[1] + f[1] * fo1 + t[1] * ta1))
        acc.box((xs[0], ys[0], z + z0_), (xs[1], ys[1], z + z1_), m)
    bx(-0.35, 0.35, -0.7, 0.7, 0.72, 0.75, "desk"); bx(-0.33, 0.33, -0.68, -0.64, 0.0, 0.72, "deskleg"); bx(-0.33, 0.33, 0.64, 0.68, 0.0, 0.72, "deskleg")
    bx(0.12, 0.15, -0.3, 0.3, 0.8, 1.15, "screen"); bx(0.15, 0.17, -0.31, 0.31, 0.78, 1.17, "chair")
    bx(-0.95, -0.55, -0.24, 0.24, 0.44, 0.5, "chair"); bx(-1.0, -0.95, -0.23, 0.23, 0.5, 1.0, "chair"); bx(-0.78, -0.72, -0.04, 0.04, 0.0, 0.44, "chair")
    r = random.random()
    if r < 0.78:
        sh = SHIRTS[k % len(SHIRTS)]; sk = "skin" if random.random() < 0.6 else "skin2"
        bx(-0.88, -0.5, -0.17, 0.17, 0.5, 0.62, "trousers"); bx(-0.52, -0.42, -0.16, 0.16, 0.05, 0.6, "trousers")
        bx(-0.92, -0.7, -0.19, 0.19, 0.6, 1.12, sh); bx(-0.7, -0.38, -0.23, -0.15, 0.82, 0.9, sh); bx(-0.7, -0.38, 0.15, 0.23, 0.82, 0.9, sh)
        bx(-0.86, -0.68, -0.09, 0.09, 1.14, 1.36, sk); bx(-0.88, -0.68, -0.1, 0.1, 1.33, 1.41, "hair")
for n in range(1, NF):
    z0, h = floorZ(n), floorH(n); CUR[0] = f"int_{n}"; zf = z0 + 0.46; acc = Acc(); random.seed(100 + n)
    acc.box((-HL + 0.4, -HW + 0.4, zf - 0.01), (HL - 0.4, HW - 0.4, zf), "carpet")
    acc.box((-HL + 8.5, -HW + 8.5, zf), (HL - 8.5, HW - 8.5, z0 + h - 0.6), "core")                       # lifts, stairs and services
    acc.box((-HL + 0.4, -HW + 0.4, z0 + h - 0.62), (HL - 0.4, HW - 0.4, z0 + h - 0.6), "ceiling")
    for xx in range(int(-HL + 2), int(HL - 1), 3):
        for yy in (-HW + 2.2, -HW + 5.4, HW - 2.2, HW - 5.4): acc.box((xx - 0.6, yy - 0.3, z0 + h - 0.63), (xx + 0.6, yy + 0.3, z0 + h - 0.62), "panel_led")
    for yy in range(int(-HW + 2), int(HW - 1), 3):
        for xx in (HL - 2.2, HL - 5.4, -HL + 2.2, -HL + 5.4): acc.box((xx - 0.3, yy - 0.6, z0 + h - 0.63), (xx + 0.3, yy + 0.6, z0 + h - 0.62), "panel_led")
    k = n * 7
    for d_ in (1.6, 4.6):                       # two rows along each face, desks to the glass
        for s_ in [v * 1.5 for v in range(int((-HW + 9.5) / 1.5), int((HW - 9.5) / 1.5) + 1)]:
            seat(acc, (HL - d_, s_), (1, 0), (0, 1), zf, k); k += 1
        for s_ in [v * 1.5 for v in range(int((-HL + 9.5) / 1.5), int((HL - 9.5) / 1.5) + 1)]:
            seat(acc, (s_, -HW + d_), (0, -1), (1, 0), zf, k); k += 1
            seat(acc, (s_, HW - d_), (0, 1), (1, 0), zf, k); k += 1
    acc.build(f"office{n}")

# ---- signs: on the corner pier, on the front fascia, the name on top
CUR[0] = f"shell_{NF - 1}"
pc = (PIER0 + HL + 0.9) / 2
text("sk_name", "skymark", 1.7, "sw", pc, TOP + 1.7, 0.62, "sign_white"); box("sk_star", (*at("sw", pc + 3.9, 0.62)[:1], -HW - 0.7, TOP + 2.4), (at("sw", pc + 4.5, 0.62)[0], -HW - 0.62, TOP + 3.0), "sign_orange")
F("sw", PIER0 + 0.5, HL + 0.4, TOP - 4.6, TOP - 2.6, 0.6, 0.72, "sign_blue"); F("sw", PIER0 + 0.5, HL + 0.4, TOP - 2.6, TOP - 1.4, 0.6, 0.72, "sign_green")
text("care1", "care", 1.5, "sw", pc - 1.6, TOP - 3.6, 0.76, "sign_white"); text("care1b", "HEALTH", 0.5, "sw", pc + 2.5, TOP - 3.5, 0.76, "sign_white")
F("sw", PIER0 + 0.5, HL + 0.4, TOP - 8.8, TOP - 6.0, 0.6, 0.72, "sign_magenta"); text("clovia1", "Clovia", 1.6, "sw", pc, TOP - 7.4, 0.76, "sign_white")
text("sk_name2", "skymark", 1.3, "se", (COLS[1] + GL[1]) / 2, TOP + 0.9, 0.95, "sign_white")
CUR[0] = "shell_0"
fz = floorZ(1)
text("care2", "care", 1.15, "se", GL[0] + 5.0, fz - 0.72, 1.75, "sign_white"); text("care2b", "HEALTH  INSURANCE", 0.36, "se", GL[0] + 10.2, fz - 0.7, 1.75, "sign_white")
F("se", TILE[0] - 1.0, HW - 1.2, fz - 1.45, fz + 0.05, 1.7, 1.78, "sign_magenta"); text("clovia2", "Clovia", 1.0, "se", (TILE[0] - 1.0 + HW - 1.2) / 2, fz - 0.7, 1.82, "sign_white")

# ---- the roof: parapet, plant, solar
CUR[0] = "roof"
for face, s0, s1 in (("se", -HW, HW), ("nw", -HW, HW), ("sw", -HL, HL), ("ne", -HL, HL)): F(face, s0, s1, TOP, TOP + ST["parapet"], -0.3, 0.05, "acp_light")
box("plant", (-HL * 0.4, -3, TOP), (-HL * 0.4 + 9, 4, TOP + 3.0), "acp_light"); box("lift", (HL * 0.15, 2, TOP), (HL * 0.15 + 6, 8, TOP + 3.6), "charcoal")
for i in range(7): box(f"pv{i}", (-HL + 4 + i * 4.4, HW - 10, TOP + 0.5), (-HL + 7.8 + i * 4.4, HW - 4, TOP + 1.1), "glass_dark")

# ---- planting (the stills only: the page plants its own instanced trees and palms)
if not GLB:
  CUR[0] = "veg"
  VEG0 = set(bpy.data.objects)
  for k, yy in enumerate((-HW + 6.5, -HW + 13.5, HW - 9.0, HW - 2.5)): palm(HL + 5.2 + random.uniform(-0.5, 0.5), yy + random.uniform(-0.6, 0.6), random.uniform(8.5, 11.0))
  for xx in (-HL + 6, -HL + 15, -HL + 30, -HL + 39): palm(xx + random.uniform(-0.8, 0.8), -HW - 5.5 + random.uniform(-0.6, 0.6), random.uniform(8.0, 10.5))
  FAST_LEAVES = 1600 if GLB else 9000
  _crown = crown
  def crown(name, at_, radius, count, mat, squash=0.8): return _crown(name, at_, radius, min(count, FAST_LEAVES), mat, squash)
  tree(HL + 11, -HW - 9, 11, 4.0); tree(-HL - 6, -HW - 7, 12, 4.4); tree(HL + 9, HW + 6, 10, 3.6); tree(-HL + 23, -HW - 6.5, 9, 3.2)
  def hedge_y(x, y0, y1):
      o = hedge(y0, y1, 0); o.rotation_euler = (0, 0, math.pi / 2); o.location = (x, (y0 + y1) / 2, 0.45); return o
  _hedge = hedge
  def hedge(x0, x1, y):
      before = set(bpy.data.objects); _hedge(x0, x1, y); new = [o for o in bpy.data.objects if o not in before]; return new[0]
  hedge_y(HL + 3.0, GL[0], HW - 1.0); hedge(-HL + 2, PIER0 - 2, -HW - 3.0)
  for o in set(bpy.data.objects) - VEG0:
      if o.name != "leaf_proto" and o not in GROUP.get("veg", []): GROUP.setdefault("veg", []).append(o)

# ------------------------------------------------------------------ export the page's model
if GLB:
    dg = bpy.context.evaluated_depsgraph_get()
    for gname, objs in GROUP.items():
        bpy.ops.object.select_all(action="DESELECT")
        live = [o for o in objs if o.name in bpy.data.objects]
        for o in live:
            o.hide_set(False); o.select_set(True)
        bpy.context.view_layer.objects.active = live[0]
        # leaves on crowns and hedges become real geometry, then everything becomes plain mesh
        for o in live:
            if o.particle_systems:
                bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
                o.show_instancer_for_viewport = False; bpy.ops.object.duplicates_make_real()
                live += [x for x in bpy.context.selected_objects if x not in live]
        bpy.ops.object.select_all(action="DESELECT")
        for o in live:
            if o.name in bpy.data.objects and o.type in ("MESH", "CURVE", "FONT"): o.select_set(True)
        sel = list(bpy.context.selected_objects); bpy.context.view_layer.objects.active = sel[0]
        bpy.ops.object.convert(target="MESH")
        sel = [o for o in bpy.context.selected_objects if o.type == "MESH"]
        for o in sel:
            for md in list(o.modifiers): o.modifiers.remove(md)
        bpy.context.view_layer.objects.active = sel[0]; bpy.ops.object.join(); j = bpy.context.view_layer.objects.active; j.name = gname
    keep = set(GROUP)
    for o in list(bpy.data.objects):
        if o.name not in keep: bpy.data.objects.remove(o)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", export_apply=True, export_yup=True)
    json.dump({"C": list(C), "phi": math.atan2(u[1], u[0]), "L": L_, "W": W_, "top": TOP, "about": "site metres east/north round the site origin; x along u, y along v"}, open(GLB + ".frame.json", "w"))
    print("exterior glb", GLB, flush=True); sys.exit(0)

# ------------------------------------------------------------------ the street and the city, for the stills
box("plaza", (-HL - 16, -HW - 14, -0.15), (HL + 16, HW + 14, 0.0), "pavers")
box("lawn_sw", (-HL + 1, -HW - 8.5, -0.05), (PIER0 - 1, -HW - 1.5, 0.05), "lawn")
box("road_se", (HL + 16, -HW - 120, -0.3), (HL + 31, HW + 120, -0.15), "asphalt"); box("road_sw", (-HL - 120, -HW - 29, -0.3), (HL + 120, -HW - 14, -0.15), "asphalt")
for i in range(24): box(f"lane_se{i}", (HL + 23.4, -HW - 110 + i * 9.5, -0.149), (HL + 23.6, -HW - 106 + i * 9.5, -0.148), "kerb")
box("kerb_se", (HL + 15.8, -HW - 120, -0.3), (HL + 16.0, HW + 120, 0.12), "kerb"); box("kerb_sw", (-HL - 120, -HW - 14.2, -0.3), (HL + 120, -HW - 14.0, 0.12), "kerb")
box("ground_far", (-900, -900, -0.5), (900, 900, -0.32), "concrete")
# the real neighbourhood (Overture footprints) round it, moved into the building's frame
ctx = arg("--context", os.path.join(ROOT, "media/skymark-f1/context.glb"))   # pass an uncompressed copy: Blender has no meshopt decoder
if os.path.exists(ctx):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=ctx)
    phi = math.atan2(u[1], u[0])
    R = Matrix.Rotation(-phi, 4, "Z") @ Matrix.Translation((-C[0], -C[1], -0.36))
    for o in set(bpy.data.objects) - before:
        if o.parent is None: o.matrix_world = R @ o.matrix_world
        if o.type == "MESH":
            bb_ = [o.matrix_world @ Vector(c) for c in o.bound_box]
            if max(abs(p.x) for p in bb_) < HL + 12 and max(abs(p.y) for p in bb_) < HW + 12 and max(p.z for p in bb_) > 3: o.hide_render = True   # Skymark's own block
# ------------------------------------------------------------------ sky, sun, camera
w = bpy.data.worlds.new("sky"); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
sky = nt.nodes.new("ShaderNodeTexSky")
for t in ("MULTIPLE_SCATTERING", "SINGLE_SCATTERING", "NISHITA"):
    try: sky.sky_type = t; break
    except TypeError: pass
for k, v in (("sun_disc", False), ("sun_elevation", math.radians(52)), ("sun_rotation", math.radians(150)), ("air_density", 1.0), ("dust_density", 0.6), ("ozone_density", 2.0)):
    try: setattr(sky, k, v)
    except (AttributeError, TypeError): pass
bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = float(arg("--sky", 0.18))
wo = nt.nodes.new("ShaderNodeOutputWorld")
# soft clouds: a stretched noise above the horizon, white over the sky
tcw = nt.nodes.new("ShaderNodeTexCoord"); mpw = nt.nodes.new("ShaderNodeMapping"); mpw.inputs["Scale"].default_value = (2.2, 2.2, 7.0)
nt.links.new(tcw.outputs["Generated"], mpw.inputs["Vector"])
cl = nt.nodes.new("ShaderNodeTexNoise"); cl.inputs["Scale"].default_value = 3.0; cl.inputs["Detail"].default_value = 8.0; cl.inputs["Roughness"].default_value = 0.62
nt.links.new(mpw.outputs[0], cl.inputs["Vector"])
cr = nt.nodes.new("ShaderNodeMapRange"); cr.inputs["From Min"].default_value = 0.56; cr.inputs["From Max"].default_value = 0.78
nt.links.new(cl.outputs["Fac"], cr.inputs["Value"])
sepz = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tcw.outputs["Generated"], sepz.inputs[0])
hz = nt.nodes.new("ShaderNodeMapRange"); hz.inputs["From Min"].default_value = 0.5; hz.inputs["From Max"].default_value = 0.62
nt.links.new(sepz.outputs["Z"], hz.inputs["Value"])
mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; nt.links.new(cr.outputs[0], mul.inputs[0]); nt.links.new(hz.outputs[0], mul.inputs[1])
mul2 = nt.nodes.new("ShaderNodeMath"); mul2.operation = "MULTIPLY"; mul2.inputs[1].default_value = 0.85; nt.links.new(mul.outputs[0], mul2.inputs[0])
mixc = nt.nodes.new("ShaderNodeMix"); mixc.data_type = "RGBA"; nt.links.new(mul2.outputs[0], mixc.inputs["Factor"])
nt.links.new(sky.outputs[0], mixc.inputs[6]); mixc.inputs[7].default_value = (6.0, 6.0, 6.2, 1)
nt.links.new(mixc.outputs[2], bg.inputs[0]); nt.links.new(bg.outputs[0], wo.inputs[0])
sd = bpy.data.lights.new("sun", "SUN"); sd.energy = float(arg("--sun", 3.8)); sd.color = (1.0, 0.96, 0.9); sd.angle = math.radians(0.6)
sun = bpy.data.objects.new("sun", sd); COL.objects.link(sun)
SUN_DIR = Vector((0.55, -0.62, 0.58)).normalized()   # from the south, morning-high: the front and the long face both in sun
sun.rotation_euler = (-SUN_DIR).to_track_quat("-Z", "Y").to_euler()
cd = bpy.data.cameras.new("cam"); cd.sensor_width = 36; cd.sensor_fit = "AUTO"; cd.clip_end = 3000
cam = bpy.data.objects.new("cam", cd); COL.objects.link(cam); sc.camera = cam
if CAM == "aerial":   # the developer's view: high across the road, the long face and the front together
    pos, look, cd.lens, pitch, cd.shift_y = Vector((HL + 58, -HW - 70, 30)), Vector((HL - 14, -4, 9)), 34, None, 0.0
elif CAM == "close":  # close to the long face at the first floor: the offices and the people behind the glass
    pos, look, cd.lens, pitch, cd.shift_y = Vector((HL - 30, -HW - 13, 7.5)), Vector((HL - 12, -HW, 7.0)), 30, 0.0, 0.0
else:                 # the street view of the front: across the road, the shopfront and the glass above
    pos, look, cd.lens, pitch, cd.shift_y = Vector((HL + 34, -HW + 2, 1.7)), Vector((HL, 3.0, 1.7)), 22, 0.0, 0.3
d = look - pos
cam.location = pos
if pitch is None: cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
else: cam.rotation_euler = (math.radians(90), 0, math.atan2(d.y, d.x) - math.radians(90))
sc.render.filepath = OUT; sc.render.image_settings.file_format = "PNG"
print("rendering", CAM, RX, "x", RY, "at", SAMPLES, "samples", flush=True)
bpy.ops.render.render(write_still=True); print("saved", OUT, flush=True)
