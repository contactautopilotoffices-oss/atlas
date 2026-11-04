"""Volt, first floor, Skymark F-1: the 18 seater conference room, rendered in
Blender Cycles (path traced, denoised). Built to the plan's real size
(scripts/skymark/volt-floor1.json, room "conf18": 8.54 x 3.42 m) and lit by a
physical sky and sun through the real facade, with the real Sector 6 context
(media/skymark-f1/context.glb) outside the window.

  python3 -m venv bl && bl/bin/pip install bpy==5.2.3
  bl/bin/python scripts/skymark/blender/conf18.py --out conf18.png --chair chair.glb --context context.glb
      [--samples 256] [--res 1920x1080] [--exposure 0.6] [--sun 3.2] [--sky 0.12]
      [--pano X,Y --res 4096x2048]   a 360 view for walk mode, standing at room x, y (metres)
      [--top]                        a plan check from above

Rules followed (.claude/skills/archviz-quality-bar and the realism playlist):
real scale; every edge bevelled; no pure black or white; roughness that varies;
small imperfections (chairs pulled out and turned, not in a grid); two point
perspective at eye height; AgX tone mapping; daylight from the real sun angle.
"""
import bpy, bmesh, math, json, os, sys, random, addon_utils
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MEDIA = os.path.join(ROOT, "media", "skymark-f1")
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
OUT = arg("--out", os.path.join(ROOT, "conf18.png"))
SAMPLES = int(arg("--samples", 256))
RX, RY = map(int, arg("--res", "1920x1080").split("x"))
random.seed(7)
# Blender's glTF importer here cannot read meshopt, which the web copies in
# media/ use, so point these at the uncompressed originals (Meshy's download,
# and context.py's output before gltf-transform).
CHAIR_GLB = arg("--chair", os.path.join(MEDIA, "models", "chair.glb"))
CONTEXT_GLB = arg("--context", os.path.join(MEDIA, "context.glb"))

volt = json.load(open(os.path.join(ROOT, "scripts", "skymark", "volt-floor1.json")))
site = json.load(open(os.path.join(MEDIA, "site.json")))
S = volt["scale"]
room = next(r for r in volt["rooms"] if r["id"] == "conf18")
x0, y0, x1, y1 = room["rect"]
LX, DY = (x1 - x0) * S, (y1 - y0) * S          # 8.54 x 3.42 m
H_BAND, H_FIELD, H_SLAB = 2.70, 2.90, 3.70      # false ceiling band, raised field, slab soffit
P = lambda x, y: ((x - x0) * S, -(y - y0) * S)  # plan px -> room metres (facade at y = 0, outside is +y)

# ---------------------------------------------------------------- scene
addon_utils.enable("cycles", default_set=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
cy = sc.cycles
cy.device = "CPU"; cy.samples = SAMPLES; cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.015
cy.use_denoising = True; cy.denoiser = "OPENIMAGEDENOISE"
cy.max_bounces = 10; cy.diffuse_bounces = 5; cy.glossy_bounces = 5; cy.transmission_bounces = 10; cy.transparent_max_bounces = 16
cy.sample_clamp_indirect = 8; cy.caustics_reflective = False; cy.caustics_refractive = False
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = RX, RY, 100
sc.render.film_transparent = False
vs = sc.view_settings
vs.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "Medium High Contrast", "AgX - Base Contrast"):
    try: vs.look = look; break
    except TypeError: pass
vs.exposure = float(arg("--exposure", 0.6))
sc.render.image_settings.file_format = "PNG"

# ---------------------------------------------------------------- material helpers
def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); return m, nt, out

def N(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n

L = lambda nt, a, b: nt.links.new(a, b)

def principled(name, color, rough=0.5, metal=0.0, coat=0.0, bump=0.0, bump_scale=300.0, sheen=0.0):
    m, nt, out = mat(name)
    b = N(nt, "ShaderNodeBsdfPrincipled", **{"Base Color": (*color, 1), "Roughness": rough, "Metallic": metal})
    if coat: b.inputs["Coat Weight"].default_value = coat
    if sheen: b.inputs["Sheen Weight"].default_value = sheen
    # roughness that varies (no CG-perfect surfaces)
    nz = N(nt, "ShaderNodeTexNoise", Scale=6.0, Detail=4.0)
    rr = N(nt, "ShaderNodeMapRange", **{"From Min": 0.3, "From Max": 0.7, "To Min": rough * 0.85, "To Max": min(1, rough * 1.15)})
    L(nt, nz.outputs["Fac"], rr.inputs["Value"]); L(nt, rr.outputs["Result"], b.inputs["Roughness"])
    if bump:
        bn = N(nt, "ShaderNodeTexNoise", Scale=bump_scale, Detail=6.0)
        bp = N(nt, "ShaderNodeBump", Strength=bump, Distance=0.002)
        L(nt, bn.outputs["Fac"], bp.inputs["Height"]); L(nt, bp.outputs["Normal"], b.inputs["Normal"])
    L(nt, b.outputs["BSDF"], out.inputs["Surface"]); return m

def glossy(nt, rough=0.0, color=(1, 1, 1, 1)):
    for kind in ("ShaderNodeBsdfGlossy", "ShaderNodeBsdfAnisotropic"):
        try: return N(nt, kind, Roughness=rough, Color=color)
        except RuntimeError: pass

def thin_glass(name, tint=(0.93, 0.96, 0.95), frost=0.0):
    """Architectural glass as a single pane: fresnel reflection over transmission,
    and fully see-through for shadow rays so sun and sky light the room."""
    m, nt, out = mat(name)
    tr = N(nt, "ShaderNodeBsdfTransparent", Color=(*tint, 1))
    gl = glossy(nt, 0.02 if not frost else 0.25)
    fr = N(nt, "ShaderNodeFresnel", IOR=1.52)
    mx = N(nt, "ShaderNodeMixShader"); L(nt, fr.outputs["Fac"], mx.inputs[0]); L(nt, tr.outputs[0], mx.inputs[1]); L(nt, gl.outputs[0], mx.inputs[2])
    surf = mx
    if frost:
        tl = N(nt, "ShaderNodeBsdfTranslucent", Color=(0.92, 0.93, 0.93, 1))
        m2 = N(nt, "ShaderNodeMixShader"); m2.inputs[0].default_value = frost
        L(nt, mx.outputs[0], m2.inputs[1]); L(nt, tl.outputs[0], m2.inputs[2]); surf = m2
    lp = N(nt, "ShaderNodeLightPath"); sh = N(nt, "ShaderNodeBsdfTransparent", Color=(*tint, 1))
    m3 = N(nt, "ShaderNodeMixShader"); L(nt, lp.outputs["Is Shadow Ray"], m3.inputs[0]); L(nt, surf.outputs[0], m3.inputs[1]); L(nt, sh.outputs[0], m3.inputs[2])
    L(nt, m3.outputs[0], out.inputs["Surface"]); m.use_backface_culling = False; return m

def emission(name, color, strength):
    m, nt, out = mat(name)
    e = N(nt, "ShaderNodeEmission", Color=(*color, 1), Strength=strength); L(nt, e.outputs[0], out.inputs["Surface"]); return m

def wood(name, light, dark, axis="x", rough=0.38, coat=0.25):
    """Oak veneer: long grain streaks plus a softer figure, along one axis."""
    m, nt, out = mat(name)
    tc = N(nt, "ShaderNodeTexCoord"); mp = N(nt, "ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.2, 45, 45) if axis == "x" else ((45, 45, 1.2) if axis == "z" else (45, 1.2, 45))
    L(nt, tc.outputs["Object"], mp.inputs["Vector"])
    n1 = N(nt, "ShaderNodeTexNoise", Scale=1.0, Detail=8.0, Roughness=0.6); L(nt, mp.outputs[0], n1.inputs["Vector"])
    wv = N(nt, "ShaderNodeTexWave", Scale=1.5, Distortion=6.0, Detail=3.0); wv.wave_type = "BANDS"
    mp2 = N(nt, "ShaderNodeMapping"); mp2.inputs["Scale"].default_value = (0.2, 6, 6) if axis == "x" else ((6, 6, 0.2) if axis == "z" else (6, 0.2, 6))
    L(nt, tc.outputs["Object"], mp2.inputs["Vector"]); L(nt, mp2.outputs[0], wv.inputs["Vector"])
    mx = N(nt, "ShaderNodeMath", operation="MULTIPLY"); L(nt, n1.outputs["Fac"], mx.inputs[0]); L(nt, wv.outputs["Fac"], mx.inputs[1])
    ad = N(nt, "ShaderNodeMath", operation="ADD"); L(nt, n1.outputs["Fac"], ad.inputs[0]); L(nt, mx.outputs[0], ad.inputs[1])
    cr = N(nt, "ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[0].color = (*dark, 1)
    cr.color_ramp.elements[1].position = 0.95; cr.color_ramp.elements[1].color = (*light, 1)
    L(nt, ad.outputs[0], cr.inputs["Fac"])
    b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=rough); b.inputs["Coat Weight"].default_value = coat; b.inputs["Coat Roughness"].default_value = 0.15
    L(nt, cr.outputs["Color"], b.inputs["Base Color"])
    bp = N(nt, "ShaderNodeBump", Strength=0.08, Distance=0.001); L(nt, n1.outputs["Fac"], bp.inputs["Height"]); L(nt, bp.outputs["Normal"], b.inputs["Normal"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def carpet(name):
    """Carpet tiles, 500 mm, charcoal with lighter streaks and a few orange
    flecks (the deck's carpet), and a fibre bump."""
    m, nt, out = mat(name)
    tc = N(nt, "ShaderNodeTexCoord")
    br = N(nt, "ShaderNodeTexBrick", Scale=1.0, **{"Mortar Size": 0.0015, "Bias": 0.0, "Brick Width": 0.5, "Row Height": 0.5,
            "Color1": (0.050, 0.050, 0.052, 1), "Color2": (0.075, 0.074, 0.076, 1), "Mortar": (0.03, 0.03, 0.03, 1)})
    br.offset = 0.0; L(nt, tc.outputs["Object"], br.inputs["Vector"])
    mp = N(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (4, 90, 4); L(nt, tc.outputs["Object"], mp.inputs["Vector"])
    st = N(nt, "ShaderNodeTexNoise", Scale=1.0, Detail=6.0); L(nt, mp.outputs[0], st.inputs["Vector"])
    cr = N(nt, "ShaderNodeValToRGB"); e = cr.color_ramp.elements
    e[0].position = 0.42; e[0].color = (0, 0, 0, 1); e[1].position = 0.75; e[1].color = (0.22, 0.22, 0.23, 1)
    L(nt, st.outputs["Fac"], cr.inputs["Fac"])
    mix = N(nt, "ShaderNodeMix", data_type="RGBA", blend_type="ADD"); mix.inputs["Factor"].default_value = 0.6
    L(nt, br.outputs["Color"], mix.inputs[6]); L(nt, cr.outputs["Color"], mix.inputs[7])
    # orange flecks, rare
    mp2 = N(nt, "ShaderNodeMapping"); mp2.inputs["Scale"].default_value = (3, 60, 3); L(nt, tc.outputs["Object"], mp2.inputs["Vector"])
    fl = N(nt, "ShaderNodeTexNoise", Scale=1.3, Detail=2.0); L(nt, mp2.outputs[0], fl.inputs["Vector"])
    fr = N(nt, "ShaderNodeMapRange", **{"From Min": 0.70, "From Max": 0.74}); L(nt, fl.outputs["Fac"], fr.inputs["Value"])
    mix2 = N(nt, "ShaderNodeMix", data_type="RGBA"); L(nt, fr.outputs["Result"], mix2.inputs["Factor"])
    L(nt, mix.outputs[2], mix2.inputs[6]); mix2.inputs[7].default_value = (0.55, 0.16, 0.03, 1)
    b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.95); b.inputs["Sheen Weight"].default_value = 0.4
    L(nt, mix2.outputs[2], b.inputs["Base Color"])
    fb = N(nt, "ShaderNodeTexNoise", Scale=900.0, Detail=2.0); bp = N(nt, "ShaderNodeBump", Strength=0.45, Distance=0.002)
    L(nt, fb.outputs["Fac"], bp.inputs["Height"]); L(nt, bp.outputs["Normal"], b.inputs["Normal"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def ceiling_tiles(name):
    m, nt, out = mat(name)
    tc = N(nt, "ShaderNodeTexCoord")
    br = N(nt, "ShaderNodeTexBrick", Scale=1.0, **{"Mortar Size": 0.012, "Bias": 0.0, "Brick Width": 0.6, "Row Height": 0.6,
            "Color1": (0.80, 0.79, 0.77, 1), "Color2": (0.82, 0.81, 0.79, 1), "Mortar": (0.72, 0.72, 0.72, 1)})
    br.offset = 0.0; L(nt, tc.outputs["Object"], br.inputs["Vector"])
    b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.92); L(nt, br.outputs["Color"], b.inputs["Base Color"])
    fb = N(nt, "ShaderNodeTexNoise", Scale=250.0, Detail=4.0); bp = N(nt, "ShaderNodeBump", Strength=0.25, Distance=0.002)
    gb = N(nt, "ShaderNodeBump", Strength=0.6, Distance=0.004, invert=True); L(nt, br.outputs["Fac"], gb.inputs["Height"])
    L(nt, fb.outputs["Fac"], bp.inputs["Height"]); L(nt, gb.outputs["Normal"], bp.inputs["Normal"]); L(nt, bp.outputs["Normal"], b.inputs["Normal"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def screen(name, img_path):
    m, nt, out = mat(name)
    tx = N(nt, "ShaderNodeTexImage"); tx.image = bpy.data.images.load(img_path)
    tc = N(nt, "ShaderNodeTexCoord"); L(nt, tc.outputs["UV"], tx.inputs["Vector"])
    em = N(nt, "ShaderNodeEmission", Strength=1.6); L(nt, tx.outputs["Color"], em.inputs["Color"])
    gl = glossy(nt, 0.05); fr = N(nt, "ShaderNodeFresnel", IOR=1.5)
    mx = N(nt, "ShaderNodeMixShader"); L(nt, fr.outputs[0], mx.inputs[0]); L(nt, em.outputs[0], mx.inputs[1]); L(nt, gl.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs["Surface"]); return m

def blind(name):
    """Sheer roller blind: lets soft light through, casts a soft shadow."""
    m, nt, out = mat(name)
    d = N(nt, "ShaderNodeBsdfPrincipled", **{"Base Color": (0.55, 0.50, 0.43, 1), "Roughness": 1.0})
    tl = N(nt, "ShaderNodeBsdfTranslucent", Color=(0.62, 0.56, 0.48, 1))
    mx = N(nt, "ShaderNodeMixShader"); mx.inputs[0].default_value = 0.45; L(nt, d.outputs[0], mx.inputs[1]); L(nt, tl.outputs[0], mx.inputs[2])
    lp = N(nt, "ShaderNodeLightPath"); tr = N(nt, "ShaderNodeBsdfTransparent", Color=(0.5, 0.46, 0.4, 1))
    m2 = N(nt, "ShaderNodeMixShader"); L(nt, lp.outputs["Is Shadow Ray"], m2.inputs[0]); L(nt, mx.outputs[0], m2.inputs[1]); L(nt, tr.outputs[0], m2.inputs[2])
    L(nt, m2.outputs[0], out.inputs["Surface"]); return m

MAT = {
    "carpet": carpet("carpet"),
    "paint": principled("paint", (0.74, 0.73, 0.70), 0.85, bump=0.03, bump_scale=120),
    "feature": principled("feature", (0.055, 0.052, 0.05), 0.9, bump=0.05, bump_scale=200),
    "gypsum": principled("gypsum", (0.80, 0.79, 0.77), 0.9),
    "tiles": ceiling_tiles("tiles"),
    "oak": wood("oak", (0.62, 0.45, 0.28), (0.45, 0.30, 0.17), "x"),
    "oakz": wood("oakz", (0.55, 0.38, 0.22), (0.36, 0.23, 0.12), "z", rough=0.5, coat=0.0),
    "walnut": wood("walnut", (0.30, 0.19, 0.11), (0.17, 0.10, 0.06), "x"),
    "black": principled("black", (0.018, 0.018, 0.019), 0.42),
    "alu": principled("alu", (0.80, 0.80, 0.82), 0.28, metal=1.0),
    "chrome": principled("chrome", (0.9, 0.9, 0.92), 0.08, metal=1.0),
    "glass": thin_glass("glass"),
    "frost": thin_glass("frost", frost=0.16),
    "bottle": thin_glass("bottle", tint=(0.9, 0.96, 0.98)),
    "paper": principled("paper", (0.80, 0.80, 0.78), 0.7),
    "cove": emission("cove", (1.0, 0.80, 0.58), 6.0),
    "led": emission("led", (1.0, 0.88, 0.74), 25.0),
    "blind": blind("blind"),
    "concrete": principled("concrete", (0.42, 0.41, 0.39), 0.85, bump=0.1, bump_scale=40),
    "plant": principled("plant", (0.05, 0.12, 0.03), 0.55),
    "soil": principled("soil", (0.06, 0.045, 0.035), 0.95),
    "orange": principled("orange", (0.75, 0.30, 0.04), 0.7, sheen=0.3),
}

# ---------------------------------------------------------------- geometry helpers
COL = bpy.data.collections.new("room"); sc.collection.children.link(COL)

def box(name, c0, c1, m, bevel=0.004):
    (ax, ay, az), (bx, by, bz) = c0, c1
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    me.transform(Matrix.Diagonal((max(abs(bx - ax), 1e-4), max(abs(by - ay), 1e-4), max(abs(bz - az), 1e-4), 1)))
    o = bpy.data.objects.new(name, me); COL.objects.link(o)
    o.location = ((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
    o.data.materials.append(MAT[m] if isinstance(m, str) else m)
    if bevel:
        md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = 2; md.limit_method = "ANGLE"
        md.harden_normals = True
    return o

def plane(name, w, h, m, loc, rot):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    uv = bm.loops.layers.uv.new("UV")
    for f in bm.faces:
        for lp in f.loops: lp[uv].uv = (lp.vert.co.x + 0.5, lp.vert.co.y + 0.5)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COL.objects.link(o)
    o.scale = (w, h, 1); o.location = loc; o.rotation_euler = rot; o.data.materials.append(MAT[m] if isinstance(m, str) else m); return o

def rounded_slab(name, w, d, t, r, m, loc, seg=8):
    """A table top: rounded corners in plan, thickness t, softened edges."""
    pts = []
    for cx, cy_, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg); pts.append((cx + r * math.cos(a), cy_ + r * math.sin(a)))
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs_ = [bm.verts.new((x, y, 0)) for x, y in pts]; f = bm.faces.new(vs_)
    ex = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0, t), verts=[v for v in ex["geom"] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COL.objects.link(o); o.location = loc; o.data.materials.append(MAT[m])
    md = o.modifiers.new("bevel", "BEVEL"); md.width = 0.006; md.segments = 3; md.limit_method = "ANGLE"; md.harden_normals = True
    for p in me.polygons: p.use_smooth = True
    return o

def lathe(name, profile, m, loc, seg=48):
    """Revolve an (r, z) profile: bottles and glasses."""
    me = bpy.data.meshes.new(name); bm = bmesh.new(); rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(seg):
        A, B = rings[i], rings[(i + 1) % seg]
        for j in range(len(profile) - 1): bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COL.objects.link(o); o.location = loc; o.data.materials.append(MAT[m])
    for p in me.polygons: p.use_smooth = True
    return o

# ---------------------------------------------------------------- the room shell
T = 0.15  # wall thickness
box("floor", (-6, -12, -0.2), (LX + 6, 6, 0), "carpet", 0)
box("slab", (-6, -12, H_SLAB), (LX + 6, 0.4, H_SLAB + 0.3), "concrete", 0)
box("wall_w", (-T, -DY, 0), (0, 0, H_SLAB), "paint", 0)
box("wall_e", (LX, -DY - T, 0), (LX + T, 0, H_SLAB), "feature", 0)

# the facade (y = 0): spandrel, head, curtain wall glass, mullions, sill
SILL, HEAD = 0.75, 2.70
box("spandrel", (-T, 0, 0), (LX + T, 0.25, SILL), "paint", 0.003)
box("sill", (-T, -0.06, SILL - 0.03), (LX + T, 0.06, SILL), "black", 0.003)
box("head", (-T, 0, HEAD), (LX + T, 0.25, H_SLAB), "paint", 0)
plane("fglass", LX + 2 * T, HEAD - SILL, "glass", (LX / 2, 0.12, (SILL + HEAD) / 2), (math.radians(90), 0, 0))
mx_ = 0.0
while mx_ <= LX + 0.01:
    box(f"mull{mx_:.1f}", (mx_ - 0.025, 0.05, SILL), (mx_ + 0.025, 0.17, HEAD), "black", 0.002); mx_ += 1.5
box("transom", (-T, 0.05, HEAD - 0.05), (LX + T, 0.17, HEAD), "black", 0.002)
# the structural column on the facade (plan [965, 118]), clad in vertical oak slats
cx_, _ = P(965, 118)
box("column", (cx_ - 0.3, -0.45, 0), (cx_ + 0.3, 0.2, H_SLAB), "paint", 0.003)
for i in range(8):
    sx = cx_ - 0.28 + i * 0.08
    box(f"slat{i}", (sx, -0.50, 0.05), (sx + 0.045, -0.45, H_BAND - 0.02), "oakz", 0.003)
# roller blinds, sheer, at different heights (people leave them as they are)
bx_ = 0.0
for i, drop in enumerate((0.55, 0.9, 0.4, 0.75, 0.6)):
    if bx_ + 1.5 > LX + 0.1: break
    plane(f"blind{i}", 1.44, drop, "blind", (bx_ + 0.75, 0.0, HEAD - 0.06 - drop / 2), (math.radians(90), 0, 0))
    box(f"bcass{i}", (bx_ + 0.02, -0.05, HEAD - 0.07), (bx_ + 1.48, 0.03, HEAD - 0.01), "alu", 0.003)
    box(f"bbar{i}", (bx_ + 0.03, -0.012, HEAD - 0.06 - drop - 0.02), (bx_ + 1.47, 0.012, HEAD - 0.06 - drop), "alu", 0.002)
    bx_ += 1.5

# the glass partition to the open office (y = -DY): frame, frosted band, door
GY = -DY
box("p_bot", (0, GY - 0.03, 0), (LX, GY + 0.03, 0.06), "black", 0.002)
box("p_top", (0, GY - 0.03, H_BAND - 0.06), (LX, GY + 0.03, H_BAND), "black", 0.002)
plane("pglass", LX, H_BAND - 0.12, "glass", (LX / 2, GY, H_BAND / 2), (math.radians(90), 0, 0))
plane("pfrost", LX, 0.70, "frost", (LX / 2, GY + 0.004, 1.40), (math.radians(90), 0, 0))
px_ = 1.2
while px_ < LX - 0.3:
    box(f"post{px_:.1f}", (px_ - 0.012, GY - 0.03, 0.06), (px_ + 0.012, GY + 0.03, H_BAND - 0.06), "black", 0.002); px_ += 1.2
box("door_l", (0.12, GY - 0.03, 0.06), (0.15, GY + 0.03, H_BAND - 0.06), "black", 0.002)
box("handle", (0.95, GY + 0.035, 0.55), (0.975, GY + 0.06, 1.75), "black", 0.003)
box("handle2", (0.95, GY - 0.06, 0.55), (0.975, GY - 0.035, 1.75), "black", 0.003)

# the false ceiling: a 600 mm gypsum band at 2.70 m, a raised field of 600 x 600
# acoustic tiles at 2.90 m, and a warm cove of LED light hidden in the step
BW = 0.6
box("band_n", (0, -BW, H_BAND), (LX, 0, H_BAND + 0.08), "gypsum", 0.002)
box("band_s", (0, -DY, H_BAND), (LX, -DY + BW, H_BAND + 0.08), "gypsum", 0.002)
box("band_w", (0, -DY, H_BAND), (BW, 0, H_BAND + 0.08), "gypsum", 0.002)
box("band_e", (LX - BW, -DY, H_BAND), (LX, 0, H_BAND + 0.08), "gypsum", 0.002)
box("field", (BW - 0.1, -DY + BW - 0.1, H_FIELD), (LX - BW + 0.1, -BW + 0.1, H_FIELD + 0.02), "tiles", 0)
for nm, a, b in (("riser_n", (BW, -BW, H_BAND + 0.08), (LX - BW, -BW + 0.01, H_FIELD)),
                 ("riser_s", (BW, -DY + BW - 0.01, H_BAND + 0.08), (LX - BW, -DY + BW, H_FIELD)),
                 ("riser_w", (BW - 0.01, -DY + BW, H_BAND + 0.08), (BW, -BW, H_FIELD)),
                 ("riser_e", (LX - BW, -DY + BW, H_BAND + 0.08), (LX - BW + 0.01, -BW, H_FIELD))):
    box(nm, a, b, "gypsum", 0)
for nm, a, b in (("cove_n", (BW, -BW - 0.02, H_BAND + 0.08), (LX - BW, -BW - 0.005, H_BAND + 0.095)),
                 ("cove_s", (BW, -DY + BW + 0.005, H_BAND + 0.08), (LX - BW, -DY + BW + 0.02, H_BAND + 0.095))):
    box(nm, a, b, "cove", 0)
box("lip_n", (BW, -BW - 0.035, H_BAND + 0.08), (LX - BW, -BW - 0.025, H_BAND + 0.12), "gypsum", 0)
box("lip_s", (BW, -DY + BW + 0.025, H_BAND + 0.08), (LX - BW, -DY + BW + 0.035, H_BAND + 0.12), "gypsum", 0)

def light(kind, name, loc, power, color=(1.0, 0.86, 0.72), **kw):
    ld = bpy.data.lights.new(name, kind); ld.energy = power; ld.color = color
    for k, v in kw.items(): setattr(ld, k, v)
    o = bpy.data.objects.new(name, ld); COL.objects.link(o); o.location = loc; return o

# downlights in the band, 4000 K
for yy in (-BW / 2, -DY + BW / 2):
    xx = 0.9
    while xx < LX - 0.5:
        lathe(f"dl{xx:.1f}{yy:.1f}", [(0.0, 0), (0.045, 0), (0.05, 0.003)], "led", (xx, yy, H_BAND - 0.001))
        light("SPOT", f"spot{xx:.1f}{yy:.1f}", (xx, yy, H_BAND - 0.02), 18, spot_size=math.radians(100), spot_blend=0.85, shadow_soft_size=0.03)
        xx += 1.35

# the linear pendant over the table, black, lit underneath
TX0, _ = P(640, 0); TX1, _ = P(990, 0); TCX = (TX0 + TX1) / 2; TCY = -DY / 2
PL = 4.8
box("pendant", (TCX - PL / 2, TCY - 0.03, 2.12), (TCX + PL / 2, TCY + 0.03, 2.19), "black", 0.003)
box("pendant_led", (TCX - PL / 2 + 0.02, TCY - 0.022, 2.118), (TCX + PL / 2 - 0.02, TCY + 0.022, 2.121), "led", 0)
for sx in (TCX - PL / 2 + 0.3, TCX + PL / 2 - 0.3):
    lathe(f"cable{sx:.1f}", [(0.0012, 2.19), (0.0012, H_FIELD)], "black", (sx, TCY, 0))
pl = light("AREA", "pendant_light", (TCX, TCY, 2.11), 70, shape="RECTANGLE", size=PL - 0.1, size_y=0.04)

# ---------------------------------------------------------------- the table and the screen wall
TW, TD = TX1 - TX0, 1.08
rounded_slab("tabletop", TW, TD, 0.04, 0.2, "oak", (TCX, TCY, 0.72))
box("modesty", (TCX - TW / 2 + 0.6, TCY - 0.2, 0.0), (TCX + TW / 2 - 0.6, TCY + 0.2, 0.72), "black", 0.004)
box("plinth", (TCX - TW / 2 + 0.62, TCY - 0.22, 0.0), (TCX + TW / 2 - 0.62, TCY + 0.22, 0.02), "black", 0.002)
for fx in (-1.4, 1.4):
    box(f"flap{fx}", (TCX + fx - 0.18, TCY - 0.07, 0.76), (TCX + fx + 0.18, TCY + 0.07, 0.762), "black", 0.001)
# credenza and the 75" screen on the end wall
box("credenza", (LX - 0.48, TCY - 1.1, 0.0), (LX, TCY + 1.1, 0.55), "walnut", 0.004)
box("cred_kick", (LX - 0.46, TCY - 1.08, 0.0), (LX - 0.02, TCY + 1.08, 0.06), "black", 0.002)
box("tv", (LX - 0.06, TCY - 0.84, 1.05), (LX - 0.01, TCY + 0.84, 2.0), "black", 0.003)
scr = os.path.join(MEDIA, "slides", "s05.jpg")
plane("tvscreen", 1.64, 0.92, screen("tvscreen", scr), (LX - 0.062, TCY, 1.525), (math.radians(90), 0, math.radians(90)))

# ---------------------------------------------------------------- chairs (Meshy model, CC BY 4.0)
def load_chair():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=CHAIR_GLB)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    ch = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o != ch and o.name in bpy.data.objects: bpy.data.objects.remove(o)
    vs_ = [v.co.copy() for v in ch.data.vertices]
    lo = Vector((min(v.x for v in vs_), min(v.y for v in vs_), min(v.z for v in vs_)))
    hi = Vector((max(v.x for v in vs_), max(v.y for v in vs_), max(v.z for v in vs_)))
    k = 1.02 / (hi.z - lo.z); c = (lo + hi) / 2
    ch.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation((-c.x, -c.y, -lo.z)))
    # which way it faces: the top of the backrest is behind the seat, so the
    # chair faces from the backrest top towards the seat (checked on a render:
    # comparing the top with the bounding box centre got it backwards)
    top = [v.co for v in ch.data.vertices if v.co.z > 0.85 * 1.02]
    seat = [v.co for v in ch.data.vertices if 0.40 < v.co.z < 0.52]
    bk = sum(top, Vector()) / len(top); st = sum(seat, Vector()) / len(seat)
    face = math.atan2(st.y - bk.y, st.x - bk.x)
    print("chair: backrest top", tuple(round(c, 2) for c in bk), "seat", tuple(round(c, 2) for c in st), flush=True)
    ch.data.transform(Matrix.Rotation(-face, 4, "Z"))      # now it faces +x
    for p in ch.data.polygons: p.use_smooth = True
    for c_ in ch.users_collection: c_.objects.unlink(ch)
    COL.objects.link(ch); return ch

CH = load_chair(); CH.hide_render = True; CH.hide_viewport = True
def chair(x, y, facing_deg, pull=0.0):
    o = CH.copy(); COL.objects.link(o); o.hide_render = False; o.hide_viewport = False
    o.rotation_mode = "XYZ"   # glTF imports use quaternions; without this the angle below is ignored
    a = math.radians(facing_deg + random.uniform(-5, 5))
    o.location = (x - math.cos(a) * pull, y - math.sin(a) * pull, 0); o.rotation_euler = (0, 0, a); return o

n = 8; m0 = 0.45
for i in range(n):
    x = TCX - TW / 2 + m0 + i * (TW - 2 * m0) / (n - 1)
    chair(x, TCY - TD / 2 - 0.30, 90, random.choice((0.0, 0.0, 0.04, 0.1)))
    chair(x, TCY + TD / 2 + 0.30, -90, random.choice((0.0, 0.0, 0.05, 0.12)))
chair(TCX - TW / 2 - 0.32, TCY, 0, 0.06)
chair(TCX + TW / 2 + 0.32, TCY, 180, 0.0)

# ---------------------------------------------------------------- table props (nobody's room is empty)
bottle = [(0.0, 0), (0.033, 0.0), (0.035, 0.01), (0.035, 0.17), (0.03, 0.2), (0.014, 0.23), (0.013, 0.25)]
glass_ = [(0.0, 0), (0.032, 0), (0.033, 0.005), (0.037, 0.11), (0.035, 0.11), (0.031, 0.006), (0.0, 0.006)]
for i, x in enumerate((TCX - 2.2, TCX - 0.7, TCX + 0.8, TCX + 2.3)):
    lathe(f"bottle{i}", bottle, "bottle", (x, TCY + 0.05 * (-1) ** i, 0.76))
    lathe(f"glass{i}", glass_, "bottle", (x + 0.12, TCY - 0.08, 0.76))
for i in range(6):
    x = TCX - TW / 2 + 0.9 + i * 0.95; y = TCY + (TD / 2 - 0.2) * (1 if i % 2 else -1)
    o = box(f"pad{i}", (x - 0.105, y - 0.15, 0.76), (x + 0.105, y + 0.15, 0.768), "paper", 0.001); o.rotation_euler.z = math.radians(random.uniform(-12, 12))
    p_ = box(f"pen{i}", (x + 0.13, y - 0.07, 0.761), (x + 0.137, y + 0.07, 0.768), "black", 0.002); p_.rotation_euler.z = math.radians(random.uniform(-20, 20))
# an open laptop
lx, ly = TCX + 1.2, TCY - TD / 2 + 0.3
box("lap_base", (lx - 0.16, ly - 0.11, 0.76), (lx + 0.16, ly + 0.11, 0.775), "alu", 0.003)
lid = box("lap_lid", (-0.16, 0, 0), (0.16, 0.006, 0.21), "alu", 0.002); lid.location = (lx, ly + 0.11, 0.775); lid.rotation_euler.x = math.radians(-12)
# a conference phone
lathe("confphone", [(0.0, 0), (0.12, 0), (0.12, 0.012), (0.1, 0.03), (0.0, 0.03)], "black", (TCX, TCY, 0.76))
# a planter in the corner by the window
box("planter", (LX - 0.95, -0.85, 0), (LX - 0.55, -0.45, 0.62), "oak", 0.004)
box("soil", (LX - 0.93, -0.83, 0.58), (LX - 0.57, -0.47, 0.6), "soil", 0)
for i in range(70):  # broad leaves on stems, a simple plant that still reads as alive
    a = random.uniform(0, 2 * math.pi); h = random.uniform(0.75, 1.45); r = random.uniform(0.05, 0.28)
    lf = plane(f"leaf{i}", 0.09, 0.32, "plant", (LX - 0.75 + r * math.cos(a), -0.65 + r * math.sin(a), h),
               (math.radians(random.uniform(35, 75)), 0, a + math.pi / 2))
    sd = lf.modifiers.new("bend", "SIMPLE_DEFORM"); sd.deform_method = "BEND"; sd.angle = math.radians(40); sd.deform_axis = "X"

# ---------------------------------------------------------------- beyond the glass: the open office
for i in range(4):
    yy = GY - 2.2 - i * 1.6
    box(f"ws{i}", (1.0, yy - 0.6, 0.72), (6.0, yy + 0.6, 0.75), "oak", 0.003)
    box(f"wsleg{i}", (1.0, yy - 0.6, 0), (1.05, yy + 0.6, 0.72), "black", 0.002)
    box(f"wsleg{i}b", (5.95, yy - 0.6, 0), (6.0, yy + 0.6, 0.72), "black", 0.002)
    box(f"wsscreen{i}", (1.0, yy - 0.012, 0.75), (6.0, yy + 0.012, 1.15), "orange", 0.004)
    for k in range(4): chair(1.6 + k * 1.3, yy - 0.9, 90, 0.1); chair(1.6 + k * 1.3, yy + 0.9, -90, 0.05)
box("far_wall", (-6, -11.8, 0), (LX + 6, -11.6, H_SLAB), "paint", 0)
box("office_ceiling", (-6, -12, H_FIELD), (LX + 6, GY - 0.05, H_FIELD + 0.02), "tiles", 0)
for xx in (1.0, 3.0, 5.0, 7.0):
    for yy in (GY - 2.0, GY - 5.0, GY - 8.0):
        box(f"op_led{xx}{yy}", (xx - 0.6, yy - 0.03, H_FIELD - 0.02), (xx + 0.6, yy + 0.03, H_FIELD - 0.005), "led", 0)
        light("AREA", f"op_l{xx}{yy}", (xx, yy, H_FIELD - 0.03), 40, shape="RECTANGLE", size=1.2, size_y=0.06)

# ---------------------------------------------------------------- outside: the real Sector 6 (Overture context)
def world_to_room():
    """east/north/up around the site -> this room's frame, the same building
    frame engine/skymark.js uses."""
    th = site["rect"]["angle"]; u = Vector((math.cos(th), math.sin(th)))
    if u.y > 0: u = -u
    v = Vector((-u.y, u.x))
    FP = [Vector(p) for p in site["footprint"]]
    A = [p.dot(u) for p in FP]; B = [p.dot(v) for p in FP]
    L_ = max(A) - min(A); W_ = max(max(B) - min(B), volt["size_px"][0] * S + 0.6)
    C = u * (min(A) + max(A)) / 2 + v * (min(B) + max(B)) / 2
    OX, OY = volt["origin"]
    a = L_ / 2 - 0.3 - (y0 - OY) * S; b = W_ / 2 - 0.3 - (x0 - OX) * S
    O = C + u * a + v * b
    X, Y = -v, u
    return Matrix(((X.x, X.y, 0, -O.dot(X)), (Y.x, Y.y, 0, -O.dot(Y)), (0, 0, 1, -4.6), (0, 0, 0, 1))), u

W2R, U = world_to_room()

def building_mat():
    m, nt, out = mat("bldg")
    g = N(nt, "ShaderNodeNewGeometry"); sp = N(nt, "ShaderNodeSeparateXYZ"); L(nt, g.outputs["Position"], sp.inputs[0])
    z = N(nt, "ShaderNodeMath", operation="DIVIDE"); z.inputs[1].default_value = 3.6; L(nt, sp.outputs["Z"], z.inputs[0])
    zf = N(nt, "ShaderNodeMath", operation="FRACT"); L(nt, z.outputs[0], zf.inputs[0])
    zb = N(nt, "ShaderNodeMath", operation="GREATER_THAN"); zb.inputs[1].default_value = 0.38; L(nt, zf.outputs[0], zb.inputs[0])
    xy = N(nt, "ShaderNodeMath", operation="ADD"); L(nt, sp.outputs["X"], xy.inputs[0]); L(nt, sp.outputs["Y"], xy.inputs[1])
    xd = N(nt, "ShaderNodeMath", operation="DIVIDE"); xd.inputs[1].default_value = 1.6; L(nt, xy.outputs[0], xd.inputs[0])
    xf = N(nt, "ShaderNodeMath", operation="FRACT"); L(nt, xd.outputs[0], xf.inputs[0])
    xb = N(nt, "ShaderNodeMath", operation="GREATER_THAN"); xb.inputs[1].default_value = 0.12; L(nt, xf.outputs[0], xb.inputs[0])
    win = N(nt, "ShaderNodeMath", operation="MULTIPLY"); L(nt, zb.outputs[0], win.inputs[0]); L(nt, xb.outputs[0], win.inputs[1])
    # facade colour varies per building (object random is one object here, so use a coarse noise)
    cn = N(nt, "ShaderNodeTexNoise", Scale=0.02, Detail=1.0); cr = N(nt, "ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = (0.55, 0.52, 0.47, 1); cr.color_ramp.elements[1].color = (0.78, 0.76, 0.72, 1)
    L(nt, cn.outputs["Fac"], cr.inputs["Fac"])
    wall = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.8); L(nt, cr.outputs["Color"], wall.inputs["Base Color"])
    gl = N(nt, "ShaderNodeBsdfPrincipled", **{"Base Color": (0.05, 0.07, 0.08, 1), "Roughness": 0.05, "Metallic": 0.3})
    mx = N(nt, "ShaderNodeMixShader"); L(nt, win.outputs[0], mx.inputs[0]); L(nt, wall.outputs[0], mx.inputs[1]); L(nt, gl.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs["Surface"]); return m

CTX = {"buildings": building_mat(), "roads": principled("asphalt", (0.06, 0.06, 0.06), 0.85, bump=0.2, bump_scale=60),
       "foot": principled("paving", (0.32, 0.30, 0.27), 0.8), "green": principled("grass", (0.07, 0.13, 0.035), 0.9, bump=0.3, bump_scale=30),
       "water": principled("water", (0.02, 0.04, 0.05), 0.05), "ground": principled("dust", (0.30, 0.27, 0.22), 0.95)}
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=CONTEXT_GLB)
for o in [o for o in bpy.data.objects if o not in before]:
    if o.type != "MESH": continue
    o.matrix_world = W2R @ o.matrix_world
    key = next((k for k in CTX if o.name.startswith(k) or o.data.name.startswith(k)), "ground")
    o.data.materials.clear(); o.data.materials.append(CTX[key])
    for p in o.data.polygons: p.use_smooth = False
# ---------------------------------------------------------------- sky and sun
w = bpy.data.worlds.new("sky"); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
sky = nt.nodes.new("ShaderNodeTexSky")
for t in ("MULTIPLE_SCATTERING", "SINGLE_SCATTERING", "NISHITA"):
    try: sky.sky_type = t; break
    except TypeError: pass
SUN_EL = math.radians(float(arg("--sun-el", 28)))
SUN_AZ_ROOM = math.radians(float(arg("--sun-az", 35)))   # from the facade normal (+y), towards +x
for k, v in (("sun_disc", False), ("sun_elevation", SUN_EL), ("altitude", 30.0)):
    try: setattr(sky, k, v)
    except (AttributeError, TypeError): pass
try: sky.sun_rotation = -SUN_AZ_ROOM
except AttributeError: pass
bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = float(arg("--sky", 0.12))
wo = nt.nodes.new("ShaderNodeOutputWorld"); nt.links.new(sky.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], wo.inputs[0])
sd = Vector((math.sin(SUN_AZ_ROOM) * math.cos(SUN_EL), math.cos(SUN_AZ_ROOM) * math.cos(SUN_EL), math.sin(SUN_EL)))  # towards the sun
sun = light("SUN", "sun", (0, 0, 10), float(arg("--sun", 3.2)), color=(1.0, 0.90, 0.78), angle=math.radians(0.6))
sun.rotation_euler = (-sd).to_track_quat("-Z", "Y").to_euler()

# ---------------------------------------------------------------- camera: eye height, two point, the deck's angle
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = float(arg("--lens", 20)); cam_d.sensor_width = 36
cam_d.shift_y = -0.06; cam_d.clip_start = 0.05; cam_d.clip_end = 500
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 8.0
cam = bpy.data.objects.new("cam", cam_d); COL.objects.link(cam); sc.camera = cam
ex, ey, ez = float(arg("--cx", 0.22)), float(arg("--cy", -DY + 0.62)), 1.32
tx_, ty_ = float(arg("--tx", LX)), float(arg("--ty", -0.9))
yaw = math.atan2(ty_ - ey, tx_ - ex)
cam.location = (ex, ey, ez); cam.rotation_euler = (math.radians(90), 0, yaw - math.radians(90))
foc = bpy.data.objects.new("focus", None); COL.objects.link(foc); foc.location = (TCX, TCY, 0.8); cam_d.dof.focus_object = foc

if "--pano" in sys.argv:  # walk mode: a 360 equirectangular view at standing eye height
    px_, py_ = map(float, arg("--pano").split(","))
    cam_d.type = "PANO"; cam_d.dof.use_dof = False; cam_d.shift_y = 0
    for k, v in (("panorama_type", "EQUIRECTANGULAR"),):
        try: setattr(cam_d, k, v)
        except (AttributeError, TypeError): setattr(cam_d.cycles, k, v)
    cam.location = (px_, py_, 1.6); cam.rotation_euler = (math.radians(90), 0, math.radians(-90))  # the centre of the image looks along +x
if "--top" in sys.argv:   # a plan check: orthographic, from above, ceiling hidden
    cam_d.type = "ORTHO"; cam_d.ortho_scale = LX + 1.0; cam_d.dof.use_dof = False; cam_d.shift_y = 0
    cam.location = (LX / 2, -DY / 2, 2.5); cam.rotation_euler = (0, 0, 0)
    for o in COL.objects:
        if o.location.z > 2.3 or o.name.startswith(("slab", "band", "field", "riser", "cove", "lip", "pendant", "cable", "head")): o.hide_render = True
bpy.context.view_layer.update()
print("room", round(LX, 2), "x", round(DY, 2), "m; rendering", RX, "x", RY, "at", SAMPLES, "samples", flush=True)
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("saved", OUT)
