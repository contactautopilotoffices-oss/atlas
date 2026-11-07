"""723 Avenue (House of Wadhwa), Marol, Andheri East: a hero model in
Blender, built to match the developer's own render of the building, and
rendered in Cycles from the street.

  bl/bin/python scripts/world/hero_723.py --out 723.png [--samples 128] [--res 1080x1512] [--cam street|corner]

What it models, from the reference:
  the tower      G+15 (16 floors, 4.1 m, over a 6.2 m ground floor), about
                 30 x 22 m; floor-to-ceiling glass behind dense vertical
                 aluminium fins (750 mm apart, 300 mm deep), a floor line at
                 every slab, dark solid piers and a light grey end band, a
                 projecting two-storey frame box low on the long face and a
                 recessed glass notch at its top corner
  the crown      an open screen of thin vertical blades above the roof
  the sign       HOUSE OF / WADHWA high on the long face
  the podium     the ground floor as a lit glass retail front in a dark
                 frame, with a fin pergola over the side terrace
  the street     a paver plaza, the road, kerbs, a background tower, trees,
                 palms and hedges along the frontage
Sizes not in the deck are read off the reference by eye; see the README.
"""
import bpy, bmesh, math, os, random, sys, addon_utils
from mathutils import Vector, Matrix

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
OUT = arg("--out", "723.png"); SAMPLES = int(arg("--samples", 128)); RX, RY = map(int, arg("--res", "1080x1512").split("x"))
CAM = arg("--cam", "street")
random.seed(723)

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; sc.render.engine = "CYCLES"; cy = sc.cycles
cy.device = "CPU"; cy.samples = SAMPLES; cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.02
cy.use_denoising = True; cy.denoiser = "OPENIMAGEDENOISE"; cy.max_bounces = 8; cy.glossy_bounces = 4; cy.diffuse_bounces = 3
cy.transmission_bounces = 6; cy.sample_clamp_indirect = 6
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = RX, RY, 100
vs = sc.view_settings; vs.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
    try: vs.look = look; break
    except TypeError: pass
vs.exposure = float(arg("--exposure", 0.0))
COL = sc.collection

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

M = {
    "glass": curtain_glass("glass"), "fin": pbr("fin", (0.06, 0.065, 0.07), 0.35, 0.8), "pier": pbr("pier", (0.035, 0.037, 0.04), 0.42, 0.65),
    "band_light": pbr("band_light", (0.42, 0.43, 0.44), 0.45, 0.4), "frame": pbr("frame", (0.62, 0.63, 0.63), 0.35, 0.6),
    "slab": pbr("slab", (0.16, 0.17, 0.18), 0.5, 0.4), "shopglass": shop_glass("shopglass"), "shop": shop_interior("shop"),
    "sign": emission("sign", (0.98, 0.98, 0.96), 1.4), "concrete": pbr("concrete", (0.5, 0.49, 0.47), 0.85, bump=0.15, bscale=60),
    "asphalt": pbr("asphalt", (0.075, 0.075, 0.08), 0.8, bump=0.3, bscale=300), "pavers": pavers("pavers"), "kerb": pbr("kerb", (0.62, 0.61, 0.58), 0.8),
    "marking": pbr("marking", (0.85, 0.85, 0.82), 0.6), "leaf": leaves("leaf", (0.11, 0.2, 0.06)), "palm": leaves("palm", (0.16, 0.26, 0.07)),
    "trunk": pbr("trunk", (0.27, 0.22, 0.17), 0.9, bump=0.4, bscale=40), "hedge": leaves("hedge", (0.09, 0.18, 0.05)),
    "bg_glass": windows("bg_glass", (0.55, 0.6, 0.6), (0.05, 0.13, 0.14), 1.4, 3.6), "bg_white": windows("bg_white", (0.72, 0.71, 0.67), (0.12, 0.15, 0.18), 2.2, 3.2), "roof": pbr("roof", (0.35, 0.35, 0.34), 0.9),
    "interior": pbr("interior", (0.16, 0.16, 0.16), 0.8), "ceiling_led": emission("ceiling_led", (1.0, 0.95, 0.88), 1.6),
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

# ------------------------------------------------------------------ the tower
W, Dp = 30.0, 22.0                  # long face along x (faces -y), short face along y (faces +x)
G, FH, NF = 6.2, 4.1, 15            # ground floor, typical floor, floors above ground
TOP = G + FH * NF                   # 67.7 m roof
FIN_STEP, FIN_D, FIN_W = 0.62, 0.38, 0.08

# the building's body behind the glass: slab edges, a lit interior so the glass has depth
box("core", (0.6, 0.6, G), (W - 0.6, Dp - 0.6, TOP), "interior")
for i in range(NF):
    z = G + i * FH
    box(f"ceil{i}", (0.7, 0.7, z + FH - 0.45), (W - 0.7, Dp - 0.7, z + FH - 0.42), "ceiling_led")
# the glass skin (just inside the fins)
box("glass_s", (0, -0.02, G), (W, 0.02, TOP), "glass")                        # long face (south, -y)
box("glass_e", (W - 0.02, 0, G), (W + 0.02, Dp, TOP), "glass")                # short face (east, +x)
box("glass_n", (0, Dp - 0.02, G), (W, Dp + 0.02, TOP), "glass")
box("glass_w", (-0.02, 0, G), (0.02, Dp, TOP), "glass")
# floor lines: a slim horizontal transom at every slab, both faces
for i in range(NF + 1):
    z = G + i * FH
    box(f"tr_s{i}", (-0.05, -0.14, z - 0.09), (W + 0.05, 0.0, z + 0.09), "fin")
    box(f"tr_e{i}", (W, -0.05, z - 0.09), (W + 0.14, Dp + 0.05, z + 0.09), "fin")

def fin_run(x0, x1, face):
    """Dense vertical fins along a stretch of a face, full tower height."""
    n = int((x1 - x0) / FIN_STEP) + 1
    if face == "s":
        o = box(f"fins_s{x0:.1f}", (x0 - FIN_W / 2, -FIN_D, G), (x0 + FIN_W / 2, 0, TOP + 0.4), "fin"); array_x(o, n, FIN_STEP)
    else:
        o = box(f"fins_e{x0:.1f}", (W, x0 - FIN_W / 2, G), (W + FIN_D, x0 + FIN_W / 2, TOP + 0.4), "fin"); array_y(o, n, FIN_STEP)
    return o

# long face: fins, a dark solid pier near the corner, the projecting frame box low on the left
fin_run(0.4, 20.8, "s"); fin_run(25.4, W - 0.3, "s")
box("pier_s", (21.2, -0.45, G), (25.0, 0.0, TOP + 0.4), "pier")
# short face: fins, a dark pier a third along, a light grey end band
fin_run(0.4, 6.6, "e"); fin_run(9.6, 18.4, "e")
box("pier_e", (W, 6.9, G), (W + 0.45, 9.3, TOP + 0.4), "pier")
box("band_e", (W, 18.8, G), (W + 0.4, Dp, TOP + 0.4), "band_light")
# the projecting two-storey frame box (left of the long face, floors 3-4)
zb = G + 2 * FH
box("fbox_top", (-0.6, -1.6, zb + 2 * FH - 0.35), (8.6, 0.0, zb + 2 * FH + 0.35), "frame", 0.02)
box("fbox_bot", (-0.6, -1.6, zb - 0.35), (8.6, 0.0, zb + 0.35), "frame", 0.02)
box("fbox_l", (-0.6, -1.6, zb), (0.1, 0.0, zb + 2 * FH), "frame", 0.02)
box("fbox_r", (7.9, -1.6, zb), (8.6, 0.0, zb + 2 * FH), "frame", 0.02)
box("fbox_glass", (0.1, -1.2, zb + 0.35), (7.9, -1.15, zb + 2 * FH - 0.35), "glass")
# the recessed notch at the top left corner: two floors set back, framed
zn = TOP - 2 * FH
box("notch_frame_t", (-0.4, -0.6, TOP - 0.3), (5.2, 0.2, TOP + 0.3), "frame", 0.02)
box("notch_frame_r", (4.8, -0.6, zn), (5.2, 0.2, TOP), "frame", 0.02)
box("notch_glass", (0.0, 2.2, zn), (4.8, 2.25, TOP - 0.3), "glass")
box("notch_floor", (0.0, -0.6, zn - 0.25), (4.8, 2.2, zn), "slab")

# the roof and the crown: an open screen of thin blades round the top
box("roof", (0, 0, TOP), (W, Dp, TOP + 0.6), "roof")
box("plant", (8, 6, TOP + 0.6), (20, 15, TOP + 3.2), "pier")
CH = 6.0
for face, (x0, x1) in (("s", (0.2, W)), ("e", (0.2, Dp))):
    n = int((x1 - x0) / 1.2) + 1
    if face == "s": o = box("crown_s", (x0 - 0.03, -0.25, TOP), (x0 + 0.03, -0.15, TOP + CH), "frame"); array_x(o, n, 1.2)
    else: o = box("crown_e", (W + 0.15, x0 - 0.03, TOP), (W + 0.25, x0 + 0.03, TOP + CH), "frame"); array_y(o, n, 1.2)
box("crown_rail_s", (0, -0.3, TOP + CH - 0.12), (W + 0.3, -0.1, TOP + CH), "frame")
box("crown_rail_e", (W + 0.1, -0.3, TOP + CH - 0.12), (W + 0.3, Dp, TOP + CH), "frame")
# the sign, high on the long face near the corner
def text(name, s, size, loc, rot_z=0.0, extrude=0.05):
    cu = bpy.data.curves.new(name, "FONT"); cu.body = s; cu.size = size; cu.extrude = extrude; cu.align_x = "CENTER"
    o = bpy.data.objects.new(name, cu); COL.objects.link(o); o.location = loc; o.rotation_euler = (math.radians(90), 0, rot_z)
    o.data.materials.append(M["sign"]); return o
text("sign_wadhwa", "WADHWA", 1.9, (17.0, -0.5, TOP - 4.6))
text("sign_houseof", "HOUSE OF", 0.75, (17.0, -0.5, TOP - 2.4))

# ------------------------------------------------------------------ the podium
# ground floor: a tall lit glass retail front in a dark frame, recessed under the tower
box("pod_slab", (-9, -2.5, G - 0.6), (W + 0.6, Dp, G + 0.1), "pier", 0.02)
box("pod_fascia", (-9, -2.6, G - 1.1), (W + 0.6, -2.4, G + 0.1), "pier", 0.02)
box("shop_back", (-8.5, 2.0, 0), (W - 0.5, 2.1, G - 0.6), "shop")
box("shop_ceiling", (-8.5, -1.2, G - 0.75), (W - 0.5, 2.0, G - 0.6), "ceiling_led")
box("shopfront", (-8.5, -1.2, 0.1), (W - 0.5, -1.15, G - 0.6), "shopglass")
mx = -8.5
while mx <= W - 0.5:
    box(f"sf_mull{mx:.1f}", (mx - 0.06, -1.3, 0.1), (mx + 0.06, -1.1, G - 0.6), "pier"); mx += 2.4
box("sf_transom", (-8.5, -1.3, 3.3), (W - 0.5, -1.1, 3.42), "pier")
box("sf_base", (-8.5, -1.35, 0), (W - 0.5, -1.05, 0.12), "pier")
box("piers_g1", (-9, -2.4, 0), (-8.4, 2.1, G - 0.6), "pier"); box("piers_g2", (W - 0.4, -2.4, 0), (W + 0.6, Dp, G - 0.6), "pier")
text("sign_retail", "High Street Retail", 0.42, (6.0, -2.62, G - 0.6))
# the side terrace over the podium's left wing, with its fin pergola and planters
box("terrace_slab", (-9, -2.5, G + 0.1), (0, Dp * 0.6, G + 0.3), "slab")
o = box("pergola_fins", (-8.9, -2.4, G + 0.3), (-8.82, -1.9, G + FH * 1.8), "fin"); array_x(o, 12, 0.75)
box("pergola_top", (-9, -2.5, G + FH * 1.8), (0, 3.0, G + FH * 1.8 + 0.25), "fin")
for i in range(5): box(f"planter{i}", (-8.4 + i * 1.7, -2.3, G + 0.3), (-7.2 + i * 1.7, -1.4, G + 0.95), "concrete", 0.02)

# ------------------------------------------------------------------ the street
box("plaza", (-60, -12, -0.15), (90, 40, 0.0), "pavers")
box("forecourt_kerb", (-60, -12.2, -0.15), (90, -12.0, 0.15), "kerb")
box("road", (-60, -26, -0.3), (90, -12.2, -0.15), "asphalt")
for i in range(16): box(f"lane{i}", (-58 + i * 9.5, -19.15, -0.149), (-54 + i * 9.5, -18.95, -0.148), "marking")
box("far_kerb", (-60, -26.3, -0.3), (90, -26.0, 0.0), "kerb")
box("footpath", (-60, -60, -0.15), (90, -26.3, 0.0), "pavers")
box("ground_far", (-400, -400, -0.4), (400, 400, -0.3), "concrete")
# background towers, left and right, and the block behind
box("bg_tower_l", (-70, 10, 0), (-48, 34, 58), "bg_glass"); box("bg_tower_l2", (-95, 30, 0), (-75, 50, 44), "bg_white")
box("bg_block_r", (W + 30, 12, 0), (W + 58, 40, 26), "bg_white"); box("bg_behind", (-5, Dp + 14, 0), (W + 10, Dp + 40, 32), "bg_white")

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
hedge(-8, 2, -3.4); hedge(14, 30, -3.4)
for px in (19.0, 23.5, 27.5, 31.0): palm(px + random.uniform(-0.6, 0.6), -4.2 + random.uniform(-0.6, 0.6), random.uniform(7.0, 9.5))
tree(-20, -6, 12, 4.2); tree(44, -5, 10, 3.6)

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
sd = bpy.data.lights.new("sun", "SUN"); sd.energy = float(arg("--sun", 3.6)); sd.color = (1.0, 0.96, 0.9); sd.angle = math.radians(0.6)
sun = bpy.data.objects.new("sun", sd); COL.objects.link(sun)
SUN_DIR = Vector((-0.45, -0.75, 0.62)).normalized()   # from the south-west, high: the long face catches it, the short face is in soft light
sun.rotation_euler = (-SUN_DIR).to_track_quat("-Z", "Y").to_euler()

cd = bpy.data.cameras.new("cam"); cd.lens = float(arg("--lens", 17)); cd.sensor_width = 36; cd.sensor_fit = "AUTO"
cam = bpy.data.objects.new("cam", cd); COL.objects.link(cam); sc.camera = cam
if CAM == "corner":
    pos, look = Vector((W + 34, -48, 1.7)), Vector((W - 2, 0, 1.7))
else:   # the reference's view: across the road, the long face wide, the corner right of centre
    pos, look = Vector((W + 20.0, -31.0, 1.6)), Vector((W - 6.0, 3.0, 1.6))
d = look - pos; yaw = math.atan2(d.y, d.x)
cam.location = pos; cam.rotation_euler = (math.radians(90), 0, yaw - math.radians(90))
cd.shift_y = float(arg("--shift", 0.3))   # two-point perspective: verticals stay vertical
cd.clip_end = 2000

sc.render.filepath = OUT
sc.render.image_settings.file_format = "PNG"
print("723 Avenue:", TOP, "m roof,", TOP + CH, "m crown; rendering", RX, "x", RY, "at", SAMPLES, "samples", flush=True)
bpy.ops.render.render(write_still=True)
print("saved", OUT)
