"""Privilon (Marol Naka), modelled from the developer's render: one object, real depth, node materials.

  Blender -b --python scripts/world/privilon_hero.py -- OUT.blend ASSET_DIR [--preview OUT.png HDRI]

Built in its own frame: x across the 25 m road face, y back 55 m from it (the plate runs back from the road,
one rectangular floor plate, no T: the founder), z up. diorama.py places it on the footprint with --hero-fit.
Ground floor 6.0 m, then 15 floors at 4.1 m (G+15 as the deck's floor list), a 2.4 m glass crown.

Read from the developer render (night view beside the Line 1 viaduct):
  - blue reflective curtain wall, slab line every floor, vertical mullions about 1.5 m
  - slim silver vertical fins over the glass, in zones whose tops step down across a face
  - on one long face, two full-height dark recessed slots (balcony voids) with bronze slab edges
  - a recessed double-height glazed base on stone columns, warm-lit
  - lit ceilings with a downlight grid behind the glass
Dimensions not in the render (fin depth and pitch, slot widths, column spacing) are estimates.
Materials are named ANDHERI_* so the web explorer keeps them. Textures: Poly Haven CC0 scans in ASSET_DIR.
"""
import sys, os, math
import bpy, bmesh
from mathutils import Vector, Matrix

A = sys.argv[sys.argv.index("--") + 1:]
OUT, ASSETS = A[0], os.path.abspath(A[1])
W, D = 25.0, 55.0                 # road face, depth back from the road
GH, FH, NF = 6.0, 4.1, 15         # ground storey, typical storey, typical floors
H = GH + NF * FH                  # roof slab top
CROWN = 2.4
PITCH = 1.5                       # fin pitch
MPITCH = 3.0                      # mullion pitch (the render shows the fins, not the mullions)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ materials
def tex_node(nt, path, non_color=False, scale=1.0, mapping=None):
    n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(path, check_existing=True)
    if non_color: n.image.colorspace_settings.name = "Non-Color"
    if mapping is not None: nt.links.new(mapping.outputs[0], n.inputs[0])
    return n

def mat(name, col, rough, metal=0.0, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    for k, v in kw.items():
        try: b.inputs[k].default_value = v
        except Exception: pass
    # roughness never uniform: +/-15% from a noise (the skill's rule)
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 6.0
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = rough * 0.85; mr.inputs["To Max"].default_value = min(1, rough * 1.15)
    nt.links.new(nz.outputs[0], mr.inputs[0]); nt.links.new(mr.outputs[0], b.inputs["Roughness"])
    # edges catch light: a 6 mm bevel in the normal (render only; the mesh carries a real bevel too)
    bv = nt.nodes.new("ShaderNodeBevel"); bv.inputs["Radius"].default_value = 0.006; nt.links.new(bv.outputs[0], b.inputs["Normal"])
    return m

def pbr(name, stem, scale, tint=(1, 1, 1), rough_k=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs["UV"], mp.inputs[0])
    c = tex_node(nt, os.path.join(ASSETS, f"{stem}_diff_2k.jpg"), mapping=mp)
    mix = nt.nodes.new("ShaderNodeMixRGB"); mix.blend_type = "MULTIPLY"; mix.inputs[0].default_value = 1; mix.inputs[2].default_value = (*tint, 1)
    nt.links.new(c.outputs[0], mix.inputs[1]); nt.links.new(mix.outputs[0], b.inputs["Base Color"])
    r = tex_node(nt, os.path.join(ASSETS, f"{stem}_rough_2k.jpg"), True, mapping=mp)
    rm = nt.nodes.new("ShaderNodeMath"); rm.operation = "MULTIPLY"; rm.inputs[1].default_value = rough_k
    nt.links.new(r.outputs[0], rm.inputs[0]); nt.links.new(rm.outputs[0], b.inputs["Roughness"])
    n = tex_node(nt, os.path.join(ASSETS, f"{stem}_nor_2k.jpg"), True, mapping=mp); nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(n.outputs[0], nm.inputs["Color"]); nt.links.new(nm.outputs[0], b.inputs["Normal"])
    return m

def interior(name, glow):
    """A ceiling seen through the glass: off-white board with a warm downlight every 1.2 m (emission, driven
    by the object's 'night' property so one model serves day and dusk)."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.55, 0.55, 0.53, 1); b.inputs["Roughness"].default_value = 0.8
    # a regular downlight grid every 1.2 m: distance to the nearest cell centre in x and y
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    def cell(o):
        a = nt.nodes.new("ShaderNodeMath"); a.operation = "WRAP"; a.inputs[1].default_value = 0.0; a.inputs[2].default_value = 1.2
        nt.links.new(sep.outputs[o], a.inputs[0]); b_ = nt.nodes.new("ShaderNodeMath"); b_.operation = "SUBTRACT"; b_.inputs[1].default_value = 0.6
        nt.links.new(a.outputs[0], b_.inputs[0]); return b_
    cx, cy = cell(0), cell(1); cmb = nt.nodes.new("ShaderNodeCombineXYZ"); nt.links.new(cx.outputs[0], cmb.inputs[0]); nt.links.new(cy.outputs[0], cmb.inputs[1])
    ln = nt.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"; nt.links.new(cmb.outputs[0], ln.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (1, 1, 1, 1)
    ramp.color_ramp.elements[1].position = 0.12; ramp.color_ramp.elements[1].color = (0.06, 0.06, 0.06, 1)   # a soft glow on the board between lights
    nt.links.new(ln.outputs["Value"], ramp.inputs[0])
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_type = "OBJECT"; at.attribute_name = "night"
    k = nt.nodes.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = glow
    em = nt.nodes.new("ShaderNodeMath"); em.operation = "ADD"; em.inputs[1].default_value = 0.15
    nt.links.new(at.outputs["Fac"], k.inputs[0]); nt.links.new(k.outputs[0], em.inputs[0])
    try: b.inputs["Emission Color"].default_value = (1.0, 0.82, 0.6, 1)
    except Exception: b.inputs["Emission"].default_value = (1.0, 0.82, 0.6, 1)
    st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"
    nt.links.new(ramp.outputs[0], st.inputs[0]); nt.links.new(em.outputs[0], st.inputs[1])
    nt.links.new(st.outputs[0], b.inputs["Emission Strength"])
    return m

M = {
    "glass": mat("ANDHERI_PRV_Glass", (0.09, 0.17, 0.26), 0.02, 0.1, **{"Transmission Weight": 0.45, "IOR": 1.52, "Specular IOR Level": 1.0}),
    "fin": mat("ANDHERI_PRV_Fin", (0.78, 0.79, 0.8), 0.32, 0.9),
    "mullion": mat("ANDHERI_PRV_Mullion", (0.2, 0.22, 0.25), 0.3, 0.85),
    "slab": mat("ANDHERI_PRV_SlabBand", (0.16, 0.18, 0.21), 0.25, 0.8),
    "slot": mat("ANDHERI_PRV_SlotDark", (0.025, 0.025, 0.028), 0.6, 0.2),
    "bronze": mat("ANDHERI_PRV_Bronze", (0.32, 0.22, 0.13), 0.35, 0.85),
    "stone": pbr("ANDHERI_PRV_Granite", "granite", 0.4, (0.75, 0.73, 0.7), 0.8),
    "lobby": interior("ANDHERI_PRV_LobbyCeiling", 14.0),
    "ceiling": interior("ANDHERI_PRV_Ceiling", 10.0),
    "core": mat("ANDHERI_PRV_Core", (0.06, 0.06, 0.065), 0.8),
    "floor": mat("ANDHERI_PRV_Floor", (0.32, 0.31, 0.29), 0.5),
    "roof": pbr("ANDHERI_PRV_Roof", "concrete", 0.12, (0.8, 0.8, 0.8)),
}
ORDER = list(M)

# ------------------------------------------------------------------ geometry
bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
def box(x0, y0, z0, x1, y1, z1, m):
    """An axis-aligned box with world-scale UVs (1 unit = 1 m)."""
    vs = [bm.verts.new(v) for v in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        fc = bm.faces.new([vs[i] for i in f]); fc.material_index = ORDER.index(m)
        n = fc.normal
        for l in fc.loops:
            co = l.vert.co
            l[uv].uv = (co.x, co.z) if abs(n.y) > 0.5 else (co.y, co.z) if abs(n.x) > 0.5 else (co.x, co.y)

def quad(p, m):
    fc = bm.faces.new([bm.verts.new(v) for v in p]); fc.material_index = ORDER.index(m)
    for l in fc.loops: l[uv].uv = (l.vert.co.x + l.vert.co.y, l.vert.co.z)

# faces of the plate as (start, direction, length, outward normal)
FACES = [((0, 0), (1, 0), W, (0, -1)),        # road face
         ((W, 0), (0, 1), D, (1, 0)),         # long face A (with the slots)
         ((W, D), (-1, 0), W, (0, 1)),        # back
         ((0, D), (0, -1), D, (-1, 0))]       # long face B
def P(face, s, off=0.0):
    (sx, sy), (dx, dy), L, (nx, ny) = face; return (sx + dx * s + nx * off, sy + dy * s + ny * off)

SLOTS = [(D * 0.30, 3.0), (D * 0.62, 3.0)]   # on long face A: centre along the face, width (m)
def in_slot(fi, s):
    return fi == 1 and any(abs(s - c) < w / 2 for c, w in SLOTS)

# floor slabs and interiors
for f in range(NF + 1):
    z = GH + f * FH
    box(0.25, 0.25, z - 0.3, W - 0.25, D - 0.25, z, "floor" if f < NF else "roof")
    if f < NF:
        box(1.2, 1.2, z + 3.25, W - 1.2, D - 1.2, z + 3.3, "ceiling")                     # lit ceiling, 1.2 m behind the glass
        box(W / 2 - 4.5, D / 2 - 11, z, W / 2 + 4.5, D / 2 + 11, z + 3.25, "core")         # the core: the glass never sees through
# curtain wall: glass skin set back 0.25 m, slab band at every floor, mullions at the pitch
for fi, face in enumerate(FACES):
    (sx, sy), (dx, dy), L, (nx, ny) = face
    for s0, s1 in ((0, L),):
        a0, a1 = P(face, 0, -0.25), P(face, L, -0.25)
        quad([(*a0, GH), (*a1, GH), (*a1, H + CROWN), (*a0, H + CROWN)], "glass")
    for f in range(NF + 1):
        z = GH + f * FH
        a0, a1 = P(face, 0, 0.0), P(face, L, 0.0)
        box(min(a0[0], a1[0]) - (0.03 if dx == 0 else 0), min(a0[1], a1[1]) - (0.03 if dy == 0 else 0), z - 0.22,
            max(a0[0], a1[0]) + (0.03 if dx == 0 else 0), max(a0[1], a1[1]) + (0.03 if dy == 0 else 0), z + 0.04, "slab")
    n = int(L / MPITCH)
    for i in range(n + 1):
        s = i * L / n
        if in_slot(fi, s): continue
        c = P(face, s, -0.2); hw = 0.025
        box(c[0] - (hw if dx else 0.05), c[1] - (hw if dy else 0.05), GH, c[0] + (hw if dx else 0.05), c[1] + (hw if dy else 0.05), H + CROWN, "mullion")
# fins: slim silver blades 0.45 m deep on the glass, zones whose tops step down across each face
def fin_top(fi, s, L):
    t = s / L
    if fi == 0: return H + CROWN + 0.6                                                     # road face: full height
    if fi == 2: return H - 4 * FH if t < 0.5 else H + CROWN + 0.6                          # back
    steps = [1.0, 1.0, 0.8, 0.62, 0.62, 0.8]                                               # the long faces step down and back up
    k = steps[min(len(steps) - 1, int(t * len(steps)))]
    return GH + (H + CROWN + 0.6 - GH) * k
for fi, face in enumerate(FACES):
    (sx, sy), (dx, dy), L, (nx, ny) = face
    n = int(L / PITCH)
    for i in range(n + 1):
        s = i * L / n
        if in_slot(fi, s) or i in (0, n): continue
        z1 = fin_top(fi, s, L); c0 = P(face, s, 0.05); c1 = P(face, s, 0.5); hw = 0.04
        xs = sorted((c0[0], c1[0])); ys = sorted((c0[1], c1[1]))
        box(xs[0] - (hw if dx else 0), ys[0] - (hw if dy else 0), GH + 0.5, xs[1] + (hw if dx else 0), ys[1] + (hw if dy else 0), z1, "fin")
# corner fins: wider blades at the four corners, full height
for x, y in ((0, 0), (W, 0), (W, D), (0, D)):
    box(x - 0.35, y - 0.35, GH, x + 0.35, y + 0.35, H + CROWN + 0.6, "fin")
# the two dark slots on long face A: recessed 1.4 m, bronze slab edges every floor
for c, w in SLOTS:
    box(W - 1.4, c - w / 2, GH, W + 0.02, c - w / 2 + 0.25, H + CROWN, "slot")
    box(W - 1.4, c + w / 2 - 0.25, GH, W + 0.02, c + w / 2, H + CROWN, "slot")
    box(W - 1.45, c - w / 2, GH, W - 1.3, c + w / 2, H + CROWN, "slot")
    for f in range(NF + 1):
        z = GH + f * FH; box(W - 1.4, c - w / 2 + 0.25, z - 0.25, W - 0.05, c + w / 2 - 0.25, z, "bronze")
# the base: a double-height glass lobby set back 2.5 m behind granite columns, lit soffit
box(2.5, 2.5, 0, W - 2.5, D - 2.5, 0.25, "floor")
for fi, face in enumerate(FACES):
    (sx, sy), (dx, dy), L, (nx, ny) = face
    a0, a1 = P(face, 2.5, -2.5), P(face, L - 2.5, -2.5)
    quad([(*a0, 0.25), (*a1, 0.25), (*a1, GH - 0.3), (*a0, GH - 0.3)], "glass")
    for k in range(0, int(L / 7.5) + 1):
        c = P(face, min(L, k * 7.5), -0.6)
        box(c[0] - 0.45, c[1] - 0.45, 0, c[0] + 0.45, c[1] + 0.45, GH - 0.3, "stone")
box(0.3, 0.3, GH - 0.35, W - 0.3, D - 0.3, GH - 0.3, "lobby")                                  # soffit with downlights
box(2.8, 2.8, 0.25, W - 2.8, D - 2.8, 0.3, "stone")                                            # lobby floor
box(W / 2 - 4.5, D / 2 - 11, 0.25, W / 2 + 4.5, D / 2 + 11, GH - 0.35, "core")
# roof: plant box behind the crown
box(W / 2 - 6, D / 2 - 9, H, W / 2 + 6, D / 2 + 9, H + 3.2, "slot")

me = bpy.data.meshes.new("opt_privilon"); bm.to_mesh(me); bm.free()
for m in ORDER: me.materials.append(M[m])
ob = bpy.data.objects.new("opt_privilon", me); sc.collection.objects.link(ob)
ob["night"] = 0.0
ob["source_basis"] = "Privilon modelled from the developer render; footprint 25 x 55 m per the founder; fin, slot and column sizes estimated"
bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = 0.012; bv.segments = 2; bv.limit_method = "ANGLE"; bv.harden_normals = False
# centre on the plate so diorama.py's swap places it by its footprint
me.transform(Matrix.Translation((-W / 2, -D / 2, 0)))
print("PRIVILON_HERO", len(me.vertices), "verts", len(me.polygons), "faces", "H", H)
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))

if "--preview" in A:   # a standalone look check: HDRI sky, Cycles GPU, low street camera at the road corner
    png, hdri = A[A.index("--preview") + 1], A[A.index("--preview") + 2]
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; nt = w.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(hdri); nt.links.new(env.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = float(A[A.index("--sky") + 1]) if "--sky" in A else 1.0
    gp = bpy.data.meshes.new("g"); gpo = bpy.data.objects.new("ground", gp); sc.collection.objects.link(gpo)
    bm2 = bmesh.new(); bmesh.ops.create_grid(bm2, x_segments=1, y_segments=1, size=200); bm2.to_mesh(gp); bm2.free(); gp.materials.append(pbr("paving", "paving", 0.25))
    ob["night"] = float(A[A.index("--night") + 1]) if "--night" in A else 0.0
    cd = bpy.data.cameras.new("c"); cd.lens = 22; cd.shift_y = 0.28; cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (-38, -52, 1.7); look = Vector((0, 0, 1.7)) - cam.location
    cam.rotation_euler = (math.pi / 2, 0, math.atan2(look.y, look.x) - math.pi / 2)
    sc.render.engine = "CYCLES"; sc.cycles.samples = 96; sc.cycles.use_denoising = True
    try:
        pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = "METAL"; pr.get_devices()
        for dv in pr.devices: dv.use = True
        sc.cycles.device = "GPU"
    except Exception as e: print("CPU", e)
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.resolution_x, sc.render.resolution_y = 1200, 1500; sc.render.filepath = png
    bpy.ops.render.render(write_still=True); print("PREVIEW", png)
