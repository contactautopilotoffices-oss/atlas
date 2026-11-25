"""Total Environment Workcations (Pursuit of a Radical Rhapsody, Hoodi), modelled the way Privilon was: one object,
real depth, true-scale UVs, node materials, lit interiors behind the glass.

  .w3d/bin/python scripts/world/te_workcations_hero.py OUT.blend TEX_DIR [--assets ASSET_DIR] [--brick-tex STEM] [--preview OUT.png]

Built in its own frame: x along the long axis (82.7 m), y across (24 m body, 28.8 m at the spine), z up, centred on
the footprint. diorama.py places it with --hero-blend OUT.blend --hero-fit.

Read from the references the founder supplied (the developer render, the sales model video, the street photograph
at the gate, the satellite view):
  - two rounded end towers in terracotta brick, solid, each with a narrow blue glass slit running up its end face
    (street photograph) and a gold-lit glazed slot where it meets the glazed bays (render)
  - a central brick spine standing proud of both long faces, with a column of small windows each floor
  - between them, glazed bays: floor-to-ceiling glass behind balconies whose white slab edges bow outwards across
    each bay, with deep planters and trees on every floor (render)
  - a glazed ground floor under a canopy: lobby and shops with a lit ceiling, timber back wall, reception desk,
    planters and columns behind clear glass (render: lit shopfronts); a roof garden with trees and a glass pavilion
Ground 6.0 m, then 19 floors at 3.7 m (Total Environment: G+19), 76.3 m to the roof; Overture measures 74 m.
Estimated, not from CAD: the end radius (12 m), spine width (13 m), balcony depth (1.2 to 1.9 m bow), slit widths.
Materials are named TE_* so the web explorer keeps them. Brick is painted here at true size (128 px a metre),
since the scanned-texture library cannot be downloaded in this environment.
"""
import sys, os, math, random
import bpy, bmesh
from mathutils import Vector, Matrix

A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
OUT, TEX = os.path.abspath(A[0]), os.path.abspath(A[1]); os.makedirs(TEX, exist_ok=True)
LH, R = 41.35, 9.5               # half length; end-tower radius (the render: drums narrower than the bays)
BAY0, BAY1 = 6.5, 28.5           # glazed bays run from the spine edge to the end towers (|x|)
GLASS_Y = 9.4                    # glass line (|y|)
GH, FH, NF = 6.0, 3.7, 19
H = GH + NF * FH                 # 76.3 m
rnd = random.Random(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ the brick, painted at true scale
def paint_brick(path, px=128):
    """Terracotta stretcher bond (brick 0.23 x 0.075 m, 10 mm joints) with per-brick colour and a fired-clay grain."""
    from PIL import Image, ImageDraw, ImageFilter
    W_, H_ = int(2.4 * px), int(2.4 * px)                    # a 2.4 m tile: 10 brick lengths, 28 courses + joints
    im = Image.new("RGB", (W_, H_), (176, 150, 128)); d = ImageDraw.Draw(im)
    bl, bh, j = 0.24 * px, 0.085 * px, 0.010 * px
    pal = [(150, 66, 40), (138, 58, 36), (160, 76, 46), (126, 54, 34), (168, 84, 52), (144, 70, 44), (118, 50, 32)]
    y, row = 0.0, 0
    while y < H_:
        off = (bl / 2) if row % 2 else 0.0; x = -off
        while x < W_:
            c = pal[rnd.randrange(len(pal))]; k = 0.9 + 0.2 * rnd.random(); c = tuple(int(v * k) for v in c)
            d.rectangle([x + j / 2, y + j / 2, x + bl - j / 2, y + bh - j / 2], fill=c)
            if x + bl > W_: d.rectangle([x + j / 2 - W_, y + j / 2, x + bl - j / 2 - W_, y + bh - j / 2], fill=c)
            x += bl
        y += bh; row += 1
    gr = Image.effect_noise((W_, H_), 22).convert("RGB")
    im = Image.blend(im, gr, 0.06).filter(ImageFilter.GaussianBlur(0.5))
    im.save(path, quality=92)
    # roughness: bricks rough, joints rougher; normal-ish height for a bump: joints sunk
    hm = Image.new("L", (W_, H_), 0); hd = ImageDraw.Draw(hm); y, row = 0.0, 0
    while y < H_:
        off = (bl / 2) if row % 2 else 0.0; x = -off
        while x < W_:
            hd.rectangle([x + j / 2, y + j / 2, x + bl - j / 2, y + bh - j / 2], fill=220)
            x += bl
        y += bh; row += 1
    hm.filter(ImageFilter.GaussianBlur(0.8)).save(path.replace(".jpg", "_h.png"))
BRICK = os.path.join(TEX, "te_brick.jpg")
if not os.path.exists(BRICK): paint_brick(BRICK)

# ------------------------------------------------------------------ materials
def mat(name, col, rough, metal=0.0, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    for k, v in kw.items():
        try: b.inputs[k].default_value = v
        except Exception: pass
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 6.0
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = rough * 0.85; mr.inputs["To Max"].default_value = min(1, rough * 1.15)
    nt.links.new(nz.outputs[0], mr.inputs[0]); nt.links.new(mr.outputs[0], b.inputs["Roughness"])
    return m

ASSETS = os.path.abspath(A[A.index("--assets") + 1]) if "--assets" in A else None   # Poly Haven CC0 scans, as Privilon
BRICKTEX = A[A.index("--brick-tex") + 1] if "--brick-tex" in A else None   # a pattern iteration: te-whitefield/world/brick_variants.py <stem>
def brick_mat():
    if BRICKTEX:   # <stem>_diff.jpg / _rough.jpg / _h.png, a 2.4 m tile, tint already in the image (exports to the web as is)
        m = bpy.data.materials.new("TE_Brick"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
        tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / 2.4, 1 / 2.4, 1)
        nt.links.new(tc.outputs["UV"], mp.inputs[0])
        def t(suffix, nc=False):
            n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.abspath(BRICKTEX + suffix))
            if nc: n.image.colorspace_settings.name = "Non-Color"
            nt.links.new(mp.outputs[0], n.inputs[0]); return n
        nt.links.new(t("_diff.jpg").outputs[0], b.inputs["Base Color"]); nt.links.new(t("_rough.jpg", True).outputs[0], b.inputs["Roughness"])
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.4; bp.inputs["Distance"].default_value = 0.01
        nt.links.new(t("_h.png", True).outputs[0], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
        return m
    if ASSETS and os.path.exists(os.path.join(ASSETS, "brick_b_diff_2k.jpg")):
        # large_red_bricks (Poly Haven, CC0), about 1.8 m a tile, tinted to the street photograph's red-brown
        m = bpy.data.materials.new("TE_Brick"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
        tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / 1.8, 1 / 1.8, 1)
        nt.links.new(tc.outputs["UV"], mp.inputs[0])
        # the tint is baked into a copy of the scan: glTF (the web explorer) carries an image wired straight to the
        # base colour, not a multiply node, so a node-tinted brick exports white
        from PIL import Image
        tinted = os.path.join(TEX, "te_brick_scan_orange_diff.jpg")
        if not os.path.exists(tinted):
            r_, g_, b_ = Image.open(os.path.join(ASSETS, "brick_b_diff_2k.jpg")).convert("RGB").split()
            Image.merge("RGB", (r_.point(lambda v: int(v * 0.78)), g_.point(lambda v: int(v * 0.5)), b_.point(lambda v: int(v * 0.36)))).save(tinted, quality=92)
        def t(kind, nc=False):
            n = nt.nodes.new("ShaderNodeTexImage")
            n.image = bpy.data.images.load(tinted if kind == "diff" else os.path.join(ASSETS, f"brick_b_{kind}_2k.jpg"))
            if nc: n.image.colorspace_settings.name = "Non-Color"
            nt.links.new(mp.outputs[0], n.inputs[0]); return n
        nt.links.new(t("diff").outputs[0], b.inputs["Base Color"])
        nt.links.new(t("rough", True).outputs[0], b.inputs["Roughness"])
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.2
        nt.links.new(t("nor", True).outputs[0], nm.inputs["Color"]); nt.links.new(nm.outputs[0], b.inputs["Normal"])
        return m
    m = bpy.data.materials.new("TE_Brick"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / 2.4, 1 / 2.4, 1)
    nt.links.new(tc.outputs["UV"], mp.inputs[0])
    c = nt.nodes.new("ShaderNodeTexImage"); c.image = bpy.data.images.load(BRICK); nt.links.new(mp.outputs[0], c.inputs[0])
    nt.links.new(c.outputs[0], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.86
    h = nt.nodes.new("ShaderNodeTexImage"); h.image = bpy.data.images.load(BRICK.replace(".jpg", "_h.png")); h.image.colorspace_settings.name = "Non-Color"
    nt.links.new(mp.outputs[0], h.inputs[0]); bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.35
    nt.links.new(h.outputs[0], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
    return m

def interior(name, glow):
    """Office ceiling seen through the glass: off-white board, a warm downlight every 1.2 m (as Privilon)."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.62, 0.6, 0.56, 1); b.inputs["Roughness"].default_value = 0.8
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    def cell(o):
        a = nt.nodes.new("ShaderNodeMath"); a.operation = "WRAP"; a.inputs[1].default_value = 0.0; a.inputs[2].default_value = 1.2
        nt.links.new(sep.outputs[o], a.inputs[0]); b_ = nt.nodes.new("ShaderNodeMath"); b_.operation = "SUBTRACT"; b_.inputs[1].default_value = 0.6
        nt.links.new(a.outputs[0], b_.inputs[0]); return b_
    cx, cy = cell(0), cell(1); cmb = nt.nodes.new("ShaderNodeCombineXYZ"); nt.links.new(cx.outputs[0], cmb.inputs[0]); nt.links.new(cy.outputs[0], cmb.inputs[1])
    ln = nt.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"; nt.links.new(cmb.outputs[0], ln.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].color = (1, 1, 1, 1); ramp.color_ramp.elements[1].position = 0.12
    ramp.color_ramp.elements[1].color = (0.08, 0.08, 0.08, 1); nt.links.new(ln.outputs["Value"], ramp.inputs[0])
    b.inputs["Emission Color"].default_value = (1.0, 0.82, 0.6, 1)
    st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; st.inputs[1].default_value = glow
    nt.links.new(ramp.outputs[0], st.inputs[0]); nt.links.new(st.outputs[0], b.inputs["Emission Strength"])
    return m

def foliage(name, a, b2):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    oi = nt.nodes.new("ShaderNodeObjectInfo"); nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.2
    # a solid green (a colour ramp exports white to glTF); the noise only drives the bump, for Cycles
    b.inputs["Base Color"].default_value = tuple((x + y) / 2 for x, y in zip(a, b2)) + (1,)
    b.inputs["Roughness"].default_value = 0.85; b.inputs["Subsurface Weight"].default_value = 0.1
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.7; nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
    return m

def tex_mat(name, stem, tile, tint=None):
    """an image-tiled PBR material wired so glTF keeps it (image straight to base colour, roughness, bump)"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / tile, 1 / tile, 1)
    nt.links.new(tc.outputs["UV"], mp.inputs[0])
    def t(path, nc=False):
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.abspath(path))
        if nc: n.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mp.outputs[0], n.inputs[0]); return n
    nt.links.new(t(stem + "_diff.jpg").outputs[0], b.inputs["Base Color"]); nt.links.new(t(stem + "_rough.jpg", True).outputs[0], b.inputs["Roughness"])
    hp = stem + "_h.png" if os.path.exists(stem + "_h.png") else (stem + "_nor_2k.jpg" if os.path.exists(stem + "_nor_2k.jpg") else None)
    if hp and hp.endswith(".png"):
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.4; bp.inputs["Distance"].default_value = 0.01
        nt.links.new(t(hp, True).outputs[0], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
    return m
VAR = A[A.index("--variants") + 1] if "--variants" in A else None   # te-whitefield/world/brick_variants.py output
def concrete_mat():
    if ASSETS and os.path.exists(os.path.join(ASSETS, "concrete_diff_2k.jpg")):
        m = bpy.data.materials.new("TE_Concrete"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
        tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / 2.0, 1 / 2.0, 1)
        nt.links.new(tc.outputs["UV"], mp.inputs[0])
        for kind, inp, nc in (("diff", "Base Color", False), ("rough", "Roughness", True)):
            n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.join(ASSETS, f"concrete_{kind}_2k.jpg"))
            if nc: n.image.colorspace_settings.name = "Non-Color"
            nt.links.new(mp.outputs[0], n.inputs[0]); nt.links.new(n.outputs[0], b.inputs[inp])
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.join(ASSETS, "concrete_nor_2k.jpg")); n.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mp.outputs[0], n.inputs[0]); nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(n.outputs[0], nm.inputs["Color"]); nt.links.new(nm.outputs[0], b.inputs["Normal"])
        return m
    return mat("TE_Concrete", (0.5, 0.49, 0.47), 0.75)
M = {
    "brick": tex_mat("TE_Brick", os.path.join(VAR, "stretcher_orange"), 2.4) if VAR and os.path.exists(os.path.join(VAR, "stretcher_orange_diff.jpg")) else brick_mat(),
    "spine": tex_mat("TE_SpineWeave", os.path.join(VAR, "terracotta_weave"), 2.4) if VAR else brick_mat(),
    "concrete": concrete_mat(),
    "band": mat("TE_BandCourse", (0.74, 0.5, 0.34), 0.7),
    "fascia": mat("TE_Fascia", (0.3, 0.17, 0.09), 0.5),
    "sign": mat("TE_Sign", (0.95, 0.9, 0.8), 0.4, 0.0, **{"Emission Color": (1.0, 0.92, 0.78, 1), "Emission Strength": 1.5}),
    "logo": mat("TE_Logo", (0.95, 0.95, 0.94), 0.35),
    "warmwall": mat("TE_InteriorWall", (0.7, 0.56, 0.4), 0.8, 0.0, **{"Emission Color": (1.0, 0.8, 0.55, 1), "Emission Strength": 1.6}),
    "desk": mat("TE_Desk", (0.55, 0.42, 0.3), 0.5),
    "flower_pink": mat("TE_FlowerPink", (0.75, 0.25, 0.4), 0.7),
    "flower_white": mat("TE_FlowerWhite", (0.9, 0.88, 0.82), 0.7),
    "flower_red": mat("TE_FlowerRed", (0.62, 0.1, 0.07), 0.7),
    "leaf_red": mat("TE_LeafRed", (0.36, 0.08, 0.05), 0.8),
    "glass": mat("TE_Glass", (0.3, 0.26, 0.2), 0.03, 0.0, **{"Transmission Weight": 0.85, "IOR": 1.45, "Specular IOR Level": 0.6}),
    "blueglass": mat("TE_BlueGlass", (0.1, 0.24, 0.46), 0.03, 0.5, **{"Specular IOR Level": 1.0}),
    "winlit": mat("TE_WindowLit", (0.9, 0.78, 0.6), 0.2, 0.0, **{"Emission Color": (1.0, 0.8, 0.55, 1), "Emission Strength": 2.2}),
    "shopfront": mat("TE_ShopGlass", (0.16, 0.14, 0.12), 0.08, 0.2, **{"Emission Color": (1.0, 0.82, 0.58, 1), "Emission Strength": 0.35}),
    "goldslot": mat("TE_GoldSlot", (0.86, 0.66, 0.36), 0.3, 0.8, **{"Emission Color": (1.0, 0.78, 0.48, 1), "Emission Strength": 0.6}),
    "slab": mat("TE_SlabWhite", (0.86, 0.84, 0.8), 0.55),
    "planter": mat("TE_Planter", (0.78, 0.76, 0.72), 0.7),
    "soil": mat("TE_Soil", (0.18, 0.12, 0.08), 0.95),
    "mullion": mat("TE_Mullion", (0.16, 0.17, 0.18), 0.35, 0.8),
    "ceiling": interior("TE_Ceiling", 16.0),
    "shop": interior("TE_LobbyCeiling", 16.0),
    "core": mat("TE_Core", (0.06, 0.06, 0.065), 0.8),
    "floor": mat("TE_Floor", (0.34, 0.32, 0.3), 0.5),
    "canopy": mat("TE_Canopy", (0.2, 0.2, 0.21), 0.4, 0.6),
    "stone": mat("TE_Stone", (0.62, 0.58, 0.52), 0.35),
    "lobbyglass": mat("TE_LobbyGlass", (0.8, 0.85, 0.86), 0.02, 0.0, **{"Transmission Weight": 0.95, "IOR": 1.1, "Specular IOR Level": 0.25}),
    "timber": mat("TE_Timber", (0.42, 0.26, 0.14), 0.5),
    "roof": mat("TE_Roof", (0.5, 0.49, 0.47), 0.9),
    "leaf": foliage("TE_Leaf", (0.09, 0.2, 0.04), (0.22, 0.36, 0.09)),
    "leaf2": foliage("TE_LeafDeep", (0.03, 0.08, 0.02), (0.1, 0.19, 0.04)),
    "trunk": mat("TE_Trunk", (0.22, 0.16, 0.1), 0.9),
}
ORDER = list(M)

# ------------------------------------------------------------------ geometry helpers (world-scale UVs)
bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
def face(vs, m, uvf=None):
    f = bm.faces.new(vs); f.material_index = ORDER.index(m); n = f.normal
    for l in f.loops:
        co = l.vert.co
        l[uvl].uv = uvf(co) if uvf else ((co.x, co.z) if abs(n.y) > 0.5 else (co.y, co.z) if abs(n.x) > 0.5 else (co.x, co.y))
    return f
def box(x0, y0, z0, x1, y1, z1, m):
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)): face([v[i] for i in f], m)
def prism(pts, z0, z1, m, uvf=None, caps=True):
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]; hi = [bm.verts.new((x, y, z1)) for x, y in pts]; n = len(pts)
    if caps: face(lo[::-1], m); face(hi, m)
    for i in range(n):
        j = (i + 1) % n; face([lo[i], lo[j], hi[j], hi[i]], m, uvf)
def ico(c, r, m, sub=1):
    res = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r, matrix=Matrix.Translation(c))
    for v in res["verts"]: v.co += Vector(((rnd.random() - .5), (rnd.random() - .5), (rnd.random() - .5))) * r * 0.25
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = ORDER.index(m); f.smooth = True
        for l in f.loops: l[uvl].uv = (l.vert.co.x, l.vert.co.z)
PLANTS = os.path.abspath(A[A.index("--plants") + 1]) if "--plants" in A else None   # Poly Haven CC0 plant scans (glTF)
PL = []   # planting placements (kind, x, y, z, size, turn), instanced from the scans after the mesh is built
def plant(kind, x, y, z, s): PL.append((kind, x, y, z, s, rnd.uniform(0, 2 * math.pi)))
def bush(x, y, z, s, deep=False):
    if PLANTS: return plant("bush", x, y, z - 0.35, s)
    for k in range(3):
        ico((x + (rnd.random() - .5) * s, y + (rnd.random() - .5) * s * .6, z + s * (0.35 + 0.3 * rnd.random())), s * (0.4 + 0.25 * rnd.random()), "leaf2" if deep or rnd.random() < .4 else "leaf")
def tree(x, y, z, s, red=False):
    if PLANTS: return plant("tree", x, y, z, s)
    box(x - .06 * s, y - .06 * s, z, x + .06 * s, y + .06 * s, z + 1.2 * s, "trunk")
    for k in range(4):
        ico((x + (rnd.random() - .5) * s * .9, y + (rnd.random() - .5) * s * .9, z + s * (1.3 + 0.6 * rnd.random())), s * (0.5 + 0.3 * rnd.random()), "leaf_red" if red else ("leaf" if rnd.random() < .6 else "leaf2"))
def vine(x, y, z, length):
    """trailing planting hanging from a balcony edge: a chain of small leaf clumps"""
    if PLANTS: return plant("trail", x, y, z + 0.6, length)
    for k in range(int(length / 0.3)):
        ico((x + rnd.uniform(-.12, .12), y + rnd.uniform(-.06, .06), z - k * 0.3), rnd.uniform(0.16, 0.26) * (1 - 0.4 * k / max(1, length / 0.3)), "leaf" if rnd.random() < .5 else "leaf2", sub=1)

# ------------------------------------------------------------------ the end towers: brick cylinders with the blue slit
SEG = 64
for s in (-1, 1):
    cx = s * (LH - R)
    # the brick drum: a half-cylinder on the outer end plus a block back to the glazed bays
    ring = []
    for i in range(SEG // 2 + 1):
        a = -math.pi / 2 + math.pi * i / (SEG // 2)
        ring.append((cx + s * R * math.cos(a), R * math.sin(a)))
    ring += [(s * BAY1, R), (s * BAY1, -R)] if s > 0 else []
    if s < 0: ring = [(cx + s * R * math.cos(-math.pi / 2 + math.pi * i / (SEG // 2)), -R * math.sin(-math.pi / 2 + math.pi * i / (SEG // 2))) for i in range(SEG // 2 + 1)] + [(s * BAY1, -R), (s * BAY1, R)]
    def cyl_uv(co, cx=cx): return (math.atan2(co.y, co.x - cx) * R, co.z)
    poly = ring
    area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    if area < 0: poly = poly[::-1]
    prism(poly, 0, H + 1.6, "brick", cyl_uv)
    # the blue glass slit up the end face (street photograph), recessed into the drum
    box(s * (LH + 0.05) - 0.6 if s > 0 else s * (LH + 0.05), -1.25, 2.8, s * (LH + 0.05) if s > 0 else s * (LH + 0.05) + 0.6, 1.25, H - 0.8, "blueglass")
    # the gold-lit glazed slot where the drum meets the bays, on both long faces (render)
    for sy in (-1, 1):
        box(min(s * BAY1, s * (BAY1 + 1.1)), sy * R - 0.25 if sy > 0 else sy * R - 0.15, 3.0, max(s * BAY1, s * (BAY1 + 1.1)), sy * R + 0.15 if sy > 0 else sy * R + 0.25, H - 1.0, "goldslot")
    # roof planting on the drum
    for k in range(10):
        a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0, R - 2)
        (tree if k % 3 == 0 else bush)(cx + r * math.cos(a) * .85, r * math.sin(a), H + 1.6, rnd.uniform(1.4, 2.6))

# ------------------------------------------------------------------ the spine: brick, proud of both faces, a window column
# the founder's close-up: a fine diamond-weave brick skin, one wide window per floor set 0.3 m into the wall,
# a light band course at every floor
box(-6.5, -14.1, 0, 6.5, 14.1, H + 4.5, "spine")
WX = 1.55
for k in range(NF + 1):
    z0 = GH + (k - 1) * FH if k else 0.0; z1 = GH + k * FH
    wz0, wz1 = (z1 - FH + 1.1, z1 - FH + 2.25) if k else (1.6, 2.9)
    for sy in (-1, 1):
        y0, y1 = sorted((sy * 14.1, sy * 14.4))
        box(-6.5, y0, z0, -WX, y1, z1, "spine"); box(WX, y0, z0, 6.5, y1, z1, "spine")        # piers either side
        box(-WX, y0, z0, WX, y1, wz0, "spine"); box(-WX, y0, wz1, WX, y1, z1, "spine")        # below and above the window
        box(-WX, sy * 14.1 - 0.02, wz0, WX, sy * 14.1 + 0.02, wz1, "winlit")                  # the lit window, 0.3 m back
        box(-WX, y0 - 0.02, wz1 - 0.12, WX, y1 + 0.02, wz1, "fascia")                         # the dark head of the opening
        box(-6.5, y0 - 0.03, z1 - 0.12, 6.5, y1 + 0.03, z1, "band")                           # band course
box(-6.5, -14.4, H + 0.2, 6.5, 14.4, H + 4.5, "spine")

# ------------------------------------------------------------------ the glazed bays with bowed, planted balconies
def edge(u, xa, xb, k):
    return 10.4 + (1.9 if k % 2 == 0 else 1.2) * math.sin(math.pi * (u - xa) / (xb - xa))
for sx in (-1, 1):
    xa, xb = sorted((sx * BAY0, sx * BAY1))
    # core (the glass never sees through) and the glass skin
    box(xa + 1.5, -5.5, GH, xb - 1.5, 5.5, H, "warmwall")                     # the core, as a warm-lit back wall
    for cx_ in (xa + 0.45, (xa + xb) / 2, xb - 0.45):                              # exposed concrete columns (render)
        for sy in (-1, 1): box(cx_ - 0.3, sy * (GLASS_Y + 0.15) - 0.3, GH, cx_ + 0.3, sy * (GLASS_Y + 0.15) + 0.3, H, "concrete")
    for sy in (-1, 1):
        y = sy * GLASS_Y
        face([bm.verts.new(p) for p in ((xa, y, GH), (xb, y, GH), (xb, y, H), (xa, y, H))][::(1 if sy < 0 else -1)], "glass")
        for mx in [xa + i * (xb - xa) / 6 for i in range(7)]:
            box(mx - 0.05, y - 0.1, GH, mx + 0.05, y + 0.1, H, "mullion")
    # the ground floor: a glazed lobby and shops, really modelled so the glass shows a lit room (as Privilon's base):
    # clear glass with mullions every 2.75 m, a stone floor, a lit ceiling with downlights, a timber back wall,
    # a reception desk, planters and round columns, under a canopy
    box(xa, -10.5, 0.0, xb, 10.5, 0.2, "stone")                                     # lobby floor
    box(xa, -10.4, GH - 1.0, xb, 10.4, GH - 0.9, "shop")                            # lit ceiling, downlights every 1.2 m
    box(xa + 0.3, -5.4, 0.2, xb - 0.3, 5.4, GH - 1.0, "timber")                     # the back wall (the core) in timber
    for sy in (-1, 1):
        y = sy * 10.6
        face([bm.verts.new(p) for p in ((xa, y, 0.2), (xb, y, 0.2), (xb, y, GH - 0.7), (xa, y, GH - 0.7))][::(1 if sy < 0 else -1)], "lobbyglass")
        for mx in [xa + i * (xb - xa) / 6 for i in range(7)]:
            box(mx - 0.06, y - 0.08, 0.2, mx + 0.06, y + 0.08, GH - 0.7, "mullion")
        box(xa, y - 0.1, GH - 0.95, xb, y + 0.1, GH - 0.7, "mullion")              # head rail
        # inside: reception desk, planters and two round columns
        mx_ = (xa + xb) / 2
        box(mx_ - 2.6, sy * 6.6 - 0.45, 0.2, mx_ + 2.6, sy * 6.6 + 0.45, 1.25, "stone")
        box(mx_ - 2.7, sy * 6.6 - 0.55, 1.25, mx_ + 2.7, sy * 6.6 + 0.55, 1.32, "timber")
        for px_ in (xa + 1.6, xb - 1.6):
            box(px_ - 0.5, sy * 9.2 - 0.5, 0.2, px_ + 0.5, sy * 9.2 + 0.5, 0.8, "planter")
            bush(px_, sy * 9.2, 0.75, 0.75, deep=True)
        for cx_ in (xa + (xb - xa) / 3, xa + 2 * (xb - xa) / 3):
            bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.35, radius2=0.35, depth=GH - 1.2, matrix=Matrix.Translation((cx_, sy * 8.2, (GH - 1.2) / 2 + 0.2)))
    box(xa, -12.6, GH - 0.7, xb, 12.6, GH - 0.35, "canopy")
    for sy in (-1, 1):                                                              # the shop fascia with signs (render)
        y0, y1 = sorted((sy * 12.6, sy * 12.75))
        box(xa, y0, GH - 0.35, xb, y1, GH + 0.25, "fascia")
        for k_ in range(3):
            c_ = xa + (xb - xa) * (k_ + 0.5) / 3
            box(c_ - 1.6, y0 - (0.04 if sy < 0 else 0), GH - 0.2, c_ + 1.6, y1 + (0.04 if sy > 0 else 0), GH + 0.1, "sign")
    us = [xa + (xb - xa) * i / 16 for i in range(17)]
    for k in range(NF):
        z = GH + k * FH
        box(xa + 0.4, -GLASS_Y + 0.6, z + FH - 0.42, xb - 0.4, GLASS_Y - 0.6, z + FH - 0.38, "ceiling")    # lit ceiling 0.6 m behind the glass
        for sy in (-1, 1):
            box(xa, sy * GLASS_Y - 0.06, z + 2.55, xb, sy * GLASS_Y + 0.06, z + 2.62, "mullion")         # transom (render)
            for dx in (0.3, 0.55, 0.8):                                                                  # desks along the glass
                dxx = xa + (xb - xa) * dx
                box(dxx - 0.8, sy * (GLASS_Y - 2.2) - 0.4, z, dxx + 0.8, sy * (GLASS_Y - 2.2) + 0.4, z + 0.75, "desk")
        for sy in (-1, 1):
            ed = [edge(u, xa, xb, k) for u in us]
            out = [(u, sy * e) for u, e in zip(us, ed)]
            slab = [(xb, sy * (GLASS_Y - 0.2)), (xa, sy * (GLASS_Y - 0.2))] + out
            if sy < 0: slab = slab[::-1]
            prism(slab, z + FH - 0.45, z + FH, "concrete")
            inn = [(u, sy * (e - 0.22)) for u, e in zip(us, ed)]
            band = out + inn[::-1]
            prism(band if sy > 0 else band[::-1], z + FH, z + FH + 1.0, "concrete")
            inn2 = [(u, sy * (e - 1.05)) for u, e in zip(us, ed)]
            bed = inn + inn2[::-1]
            prism(bed if sy > 0 else bed[::-1], z + FH, z + FH + 0.85, "soil")
            # planting spilling over the edge, and a small tree now and then (render)
            uu = [xa + (xb - xa) * i / (34 if PLANTS else 24) for i in range(1, 34 if PLANTS else 24)]
            for u in uu:
                e = edge(u, xa, xb, k)
                if rnd.random() < (0.92 if PLANTS else 0.5): bush(u + rnd.uniform(-.25, .25), sy * (e - 0.55), z + FH + 0.7, rnd.uniform(0.7, 1.1), deep=rnd.random() < .3)
                if rnd.random() < 0.6:
                    if PLANTS: plant("trail", u, sy * (e - 0.05), z + FH + 0.85, rnd.uniform(0.8, 1.2))
                    else: ico((u, sy * (e + 0.12), z + FH + 0.5), rnd.uniform(0.35, 0.6), "leaf")   # spilling over the edge
                if rnd.random() < 0.22:                                                                     # vines hanging below the slab
                    vine(u, sy * (e + 0.12), z + FH + 0.2, rnd.uniform(0.9, 1.8))
                if rnd.random() < 0.35 and not PLANTS:                                                      # flowers (render: pink, white, red)
                    for _f in range(4):   # a cluster of small blooms, not one ball
                        ico((u + rnd.uniform(-.4, .4), sy * (e - 0.35 + rnd.uniform(-.2, .2)), z + FH + 1.25 + rnd.uniform(0, .3)), rnd.uniform(0.05, 0.09), rnd.choice(["flower_pink", "flower_white", "flower_white", "flower_red"]), sub=1)
                if rnd.random() < 0.10: tree(u, sy * (e - 0.6), z + FH + 0.85, rnd.uniform(1.0, 1.4))

# ------------------------------------------------------------------ the roof: garden slab, trees, glass pavilion
box(-BAY1, -11, H, BAY1, 11, H + 0.5, "roof")
box(-BAY1 + 0.5, -10.5, H + 0.5, -7, 10.5, H + 0.9, "soil"); box(7, -10.5, H + 0.5, BAY1 - 0.5, 10.5, H + 0.9, "soil")
box(8.5, -4.5, H + 0.9, 19.5, 4.5, H + 4.6, "glass")
for k in range(40):
    x = rnd.uniform(-BAY1 + 1, BAY1 - 1); y = rnd.uniform(-10, 10)
    if 8 < x < 20 and -5 < y < 5 or -7 < x < 7: continue
    (tree if k % 4 == 0 else bush)(x, y, H + 0.9, rnd.uniform(1.2, 2.4))

# the wordmark near the top of the west drum, wrapped onto its curve (render: "TotalEnvironment" in white)
cu = bpy.data.curves.new("logo", "FONT"); cu.body = "TotalEnvironment"; cu.size = 1.9; cu.extrude = 0.03; cu.align_x = "CENTER"
lo = bpy.data.objects.new("logo", cu); sc.collection.objects.link(lo)
lme = bpy.data.meshes.new_from_object(lo.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(lo)
cxL, RR, a0, zL = -(LH - R), R + 0.05, 0.25, H - 3.6
vmap = {}
for v in lme.vertices:
    a = a0 + v.co.x / RR; r_ = RR + v.co.z
    vmap[v.index] = bm.verts.new((cxL + r_ * math.sin(a), -r_ * math.cos(a), zL + v.co.y))
for pl in lme.polygons:
    try:
        f = bm.faces.new([vmap[i] for i in pl.vertices]); f.material_index = ORDER.index("logo")
    except ValueError: pass
bpy.data.meshes.remove(lme)
me = bpy.data.meshes.new("opt_te-workcations"); bm.to_mesh(me); bm.free()
for m in ORDER: me.materials.append(M[m])
ob = bpy.data.objects.new("opt_te-workcations", me); sc.collection.objects.link(ob)
ob["night"] = 0.0
ob["source_basis"] = "Workcations tower from the developer render, sales model video, street photograph and satellite view; end radius, spine and balcony sizes estimated"
bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = 0.012; bv.segments = 1; bv.limit_method = "ANGLE"
print("TE_HERO", len(me.vertices), "verts", len(me.polygons), "faces", "H", round(H, 1))
if PLANTS and PL:
    # real plants: each kind is a few Poly Haven scans, imported once and instanced on points (geometry nodes)
    KINDS = {"bush": ["calathea_orbifolia_01", "anthurium_botany_01", "fern_02", "shrub_03", "shrub_02", "shrub_04"],
             "trail": ["periwinkle_plant", "fern_02"], "tree": ["pachira_aquatica_01"]}
    HEIGHT = {"bush": 1.35, "trail": 0.85, "tree": 2.6}   # metres, at size 1
    protos = {}
    for kind, names in KINDS.items():
        for nm in names:
            if nm in protos: continue
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.join(PLANTS, nm, nm + ".gltf"))
            new = [o for o in set(bpy.data.objects) - before]
            col = bpy.data.collections.new("proto_" + nm); sc.collection.children.link(col)
            for o in new:
                for c in list(o.users_collection): c.objects.unlink(o)
                col.objects.link(o)
            zs = [(o.matrix_world @ Vector(c)).z for o in new if o.type == "MESH" for c in o.bound_box]
            protos[nm] = (col, max(zs) - min(zs) if zs else 1.0)
            sc.collection.children.unlink(col)   # out of the scene: instanced only (hiding it would hide the instances too)
    W_ = Matrix.Translation((0, 0, 0))
    for kind, names in KINDS.items():
        for i, nm in enumerate(names):
            P = [p for j, p in enumerate(PL) if p[0] == kind and (j % len(names)) == i]
            if not P: continue
            col, ht = protos[nm]
            pm = bpy.data.meshes.new(f"plants_{kind}_{nm}"); pm.from_pydata([(p[1], p[2], p[3]) for p in P], [], [])
            a = pm.attributes.new("s", "FLOAT", "POINT"); a.data.foreach_set("value", [HEIGHT[kind] * p[4] / ht for p in P])
            r = pm.attributes.new("rz", "FLOAT", "POINT"); r.data.foreach_set("value", [p[5] for p in P])
            po = bpy.data.objects.new(f"plants_{kind}_{nm}", pm); sc.collection.objects.link(po)
            ng = bpy.data.node_groups.new(f"gn_{kind}_{nm}", "GeometryNodeTree")
            ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry"); ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
            N, L = ng.nodes, ng.links; gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
            m2p = N.new("GeometryNodeMeshToPoints"); L.new(gi.outputs[0], m2p.inputs["Mesh"])
            ci = N.new("GeometryNodeCollectionInfo"); ci.inputs["Collection"].default_value = col; ci.transform_space = "ORIGINAL"
            iop = N.new("GeometryNodeInstanceOnPoints"); L.new(m2p.outputs[0], iop.inputs["Points"]); L.new(ci.outputs[0], iop.inputs["Instance"])
            sa = N.new("GeometryNodeInputNamedAttribute"); sa.data_type = "FLOAT"; sa.inputs["Name"].default_value = "s"; L.new(sa.outputs["Attribute"], iop.inputs["Scale"])
            ra = N.new("GeometryNodeInputNamedAttribute"); ra.data_type = "FLOAT"; ra.inputs["Name"].default_value = "rz"
            ce = N.new("ShaderNodeCombineXYZ"); L.new(ra.outputs["Attribute"], ce.inputs["Z"])
            if kind == "trail": ce.inputs["X"].default_value = 0.0
            L.new(ce.outputs[0], iop.inputs["Rotation"]); L.new(iop.outputs[0], go.inputs[0])
            po.modifiers.new("plants", "NODES").node_group = ng
    print("plants", {k: sum(1 for p in PL if p[0] == k) for k in KINDS})
bpy.ops.wm.save_as_mainfile(filepath=OUT)

if "--preview" in A:   # a look check: sky, sun, the drone's three-quarter view from the east-south-east
    png = A[A.index("--preview") + 1]
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; nt = w.node_tree
    hd = os.path.join(ASSETS or "", "kiara_4_mid-morning_4k.hdr")
    if ASSETS and os.path.exists(hd):
        env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(hd)
        nt.links.new(env.outputs[0], nt.nodes["Background"].inputs[0]); nt.nodes["Background"].inputs[1].default_value = 0.8
        # the camera sees a clean sky (the HDRI's horizon is someone else's mountains); light still comes from the HDRI
        sky = nt.nodes.new("ShaderNodeTexSky"); sky.sky_type = "MULTIPLE_SCATTERING"; sky.sun_elevation = math.radians(35); sky.sun_disc = False
        bgs = nt.nodes.new("ShaderNodeBackground"); bgs.inputs[1].default_value = 0.35; nt.links.new(sky.outputs[0], bgs.inputs[0])
        lp = nt.nodes.new("ShaderNodeLightPath"); mx = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0]); nt.links.new(nt.nodes["Background"].outputs[0], mx.inputs[1]); nt.links.new(bgs.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], nt.nodes["World Output"].inputs["Surface"])
    else:
        sk = nt.nodes.new("ShaderNodeTexSky"); sk.sky_type = "MULTIPLE_SCATTERING"; sk.sun_elevation = math.radians(28); sk.sun_rotation = math.radians(-30); sk.sun_disc = False
        nt.links.new(sk.outputs[0], nt.nodes["Background"].inputs[0]); nt.nodes["Background"].inputs[1].default_value = 0.25
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 6.5; sun.color = (1.0, 0.84, 0.66); sun.angle = math.radians(1.5)
    so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
    so.rotation_euler = (-Vector((-0.75, 0.55, -0.36))).to_track_quat("Z", "Y").to_euler()   # warm late sun raking across the long face from the south-east
    gp = bpy.data.meshes.new("g"); gpo = bpy.data.objects.new("ground", gp); sc.collection.objects.link(gpo)
    b2 = bmesh.new(); bmesh.ops.create_grid(b2, x_segments=1, y_segments=1, size=300); b2.to_mesh(gp); b2.free(); gp.materials.append(tex_mat("ground_grass", os.path.join(ASSETS, "grass"), 3.0) if ASSETS and os.path.exists(os.path.join(ASSETS, "grass_diff_2k.jpg")) and False else mat("g", (0.3, 0.33, 0.2), 0.95))
    cd = bpy.data.cameras.new("c"); cd.lens = 40; cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (58, -120, 12); look = Vector((-4, 0, 40)) - cam.location; cd.lens = 34; cd.shift_y = 0.08   # the developer render's viewpoint
    tb = bmesh.new()   # foreground trees and a verge, as in the render
    if PLANTS:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(PLANTS, "jacaranda_tree", "jacaranda_tree.gltf"))
        jac = [o for o in set(bpy.data.objects) - before]; jcol = bpy.data.collections.new("proto_jacaranda"); sc.collection.children.link(jcol)
        for o in jac:
            for c in list(o.users_collection): c.objects.unlink(o)
            jcol.objects.link(o)
        sc.collection.children.unlink(jcol)
        for k_, (x_, y_, s_, r_) in enumerate(((-48, -60, 1.1, 2.1), (92, -28, 1.0, 4.0))):
            inst = bpy.data.objects.new(f"jacaranda_{k_}", None); inst.instance_type = "COLLECTION"; inst.instance_collection = jcol
            inst.location = (x_, y_, 0); inst.scale = (s_, s_, s_); inst.rotation_euler = (0, 0, r_); sc.collection.objects.link(inst)
    for x_, y_, s_ in ():
        bmesh.ops.create_cone(tb, cap_ends=True, segments=8, radius1=0.25, radius2=0.18, depth=s_, matrix=Matrix.Translation((x_, y_, s_ / 2)))
        for k_ in range(7):
            r0 = bmesh.ops.create_icosphere(tb, subdivisions=2, radius=s_ * rnd.uniform(0.3, 0.45), matrix=Matrix.Translation((x_ + rnd.uniform(-1, 1) * s_ * .45, y_ + rnd.uniform(-1, 1) * s_ * .3, s_ * rnd.uniform(0.9, 1.5))))
            for v_ in r0["verts"]: v_.co += Vector((rnd.random() - .5, rnd.random() - .5, rnd.random() - .5)) * s_ * 0.08
    tm = bpy.data.meshes.new("fg"); tb.to_mesh(tm); tb.free(); tm.materials.append(M["leaf"]); to = bpy.data.objects.new("fg", tm); sc.collection.objects.link(to)
    for pg in tm.polygons: pg.use_smooth = True
    cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = int(A[A.index("--samples") + 1]) if "--samples" in A else 24; sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = -1.3 if ASSETS else 0.0; sc.view_settings.look = "AgX - High Contrast"   # the HDRI and the sun together over-expose the brick to salmon
    sc.render.resolution_x, sc.render.resolution_y = (540, 675) if "--small" in A else (1080, 1350); sc.render.filepath = os.path.abspath(png)
    bpy.ops.render.render(write_still=True); print("PREVIEW", png)
