"""Atul Corporate Avenue (Chakala), modelled from the developer's render: one object, real depth, node materials.

  Blender -b --python scripts/world/corporate_hero.py -- OUT.blend ASSET_DIR
          [--preview OUT.png HDRI --night 0|1 --sky K --view street|corner|aerial|back --sun-az DEG --sun-el DEG
           --sun K --samples N --res WxH --exposure EV]

The building that holds Flipkart's 3rd and 4th floors (G+8, Grade A-, gated campus). It is built in its own
frame, centred on its outline: x along the long side, y across, z up. The outline (83 x 41 m) is the roof
canopy, which is what the OSM footprint was traced from. diorama.py's --hero-fit turns and scales it onto the
real footprint (Nov 2026: onto the fixed 79.1 x 35.0 m outline in scripts/world/refs/marol_corridor.json, turning
it -178.2 degrees), which puts the main (developer-render) facade, -y here, towards Guru Hargovindji Road to the
north and the tall corner block, +x here, at the west end. Checked inside diorama.py's own build (LOGIC PASS, no
overlap with any built neighbour). --turn180 turns the mesh 180 degrees (exactly) if a later fit reads it the
other way round.

Read from the developer render (andheri-project/film/reference/corporate/deck-p10-10.jpg), from the far end
of the long facade to the near corner:
  A  a lower glazed corner volume: a G+2 podium wrapped by a rounded white frame, a clear-glass volume with
     white floor bands up to floor 6, dark glass set back above it; the roof canopy's end folds down over it
  B  a tall dark slatted band standing proud of the glass, ground to floor 7
  C  a white rounded C-frame (open towards B) wrapping floors 2 to 5: grey stone cladding with tall slit
     windows in two tiers, alternating narrow and wide; floor 1 dark glass under it; shops at street level
     behind a white entrance canopy; blue-grey curtain wall above
  D  a dark recessed full-height slot with vertical fins
  E  the corner block: a white rounded frame over floors 1 to 5 (the same stone and slit windows), curtain
     wall above; its top band runs on round the corner as a ribbon along the side face and turns up into the
     canopy at the far end; on the side face a two-storey glazed retail box in its own rounded frame; white
     round columns at street level. Its canopy sits 2.4 m higher than the rest.
  -  a large dark roof canopy over everything: white fascia edge, a grey battened soffit sloping up from the
     glass, cantilevered 3.5 m beyond the long faces and 3 m beyond the corner block's side
  -  shops behind a recessed (2.5 m) ground floor, a lit soffit over the arcade

Facts used: G+8 (deck). Storeys: ground 5.0 m, 8 floors at 4.0 m, roof slab 37.0 m, canopy top 39.4 m (the
scene's building height), corner block canopy 41.8 m. Outline 83 x 41 m (the OSM footprint's minimum rectangle).
Estimated (read off the render or chosen; no drawings): the zone widths along the 77 m glass line
(A 16.5 m + the podium's 4.5 m beyond it, B 7.5, C 26, D 7, E 18.5), the 34 m glass-to-glass depth, the canopy
cantilevers, the frame band (1.0 m wide, 0.6 m deep, 2 m corner radii), stone piers 0.3 m proud of the glass,
the window rhythm (0.8 m pier, 0.55 m slit, 0.8 m pier, 1.45 m window), slat and fin pitches (0.5 m, 0.9 m),
the 2 m deep slot, column spacing (about 8 m), the frames' floor spans (C floors 2-5, E floors 1-5); the back
facade, which the render does not show, repeats the front without the ribbon and the entrance canopy. The
interiors (ceilings with a downlight every 1.2 m, desks along the glass, a central core, blinds at random
heights) and the roof plant (lift machine room, black water tanks, condensers) are typical, not surveyed.
Materials are named ANDHERI_CA_* so the web explorer keeps them. Textures: Poly Haven CC0 scans in ASSET_DIR.
The object property 'night' (0..1) turns up the office ceilings, the shops and the canopy's LED line.
"""
import sys, os, math, random, time
import bpy, bmesh
from mathutils import Vector, Matrix

A = sys.argv[sys.argv.index("--") + 1:]
OUT, ASSETS = A[0], os.path.abspath(A[1])
arg = lambda k, d: A[A.index(k) + 1] if k in A else d
random.seed(7)
T0 = time.time()

# ------------------------------------------------------------------ dimensions (build frame: main facade at -y, corner block at +x)
GH, FH, NF = 5.0, 4.0, 8           # ground storey, typical storey, typical floors (G+8)
H = GH + NF * FH                   # 37.0 roof slab top
YG = 17.0                          # glass line of the long faces (+-)
XE = 38.5                          # glass line of the corner block's side face
XC, YC = 41.5, 20.5                # the outline: canopy edge (and the podium frame's outer face at -x)
XP = XC - 0.6                      # the podium's end glass line (its frame stands 0.6 m proud of it)
CTOP, ETOP = 39.4, 41.8            # canopy tops: main, corner block
ZGE = ETOP - 1.8                   # the corner block's glass top (40.0)
XA0, XA1, XUP = -37.0, -20.5, -33.0   # volume A from/to; its setback upper floors start at XUP
TIP = -38.3                        # the main canopy's tip over volume A
XB0, XB1 = -20.5, -13.0            # slatted band
XC0, XC1 = -13.0, 13.0             # C-frame zone
XD0, XD1 = 13.0, 20.0              # slot
XE0 = 20.0                         # corner block from
ZPOD, ZA = 13.4, 29.8              # podium top, volume A top
FW, FD = 1.0, 0.6                  # frame band width and depth
ZFT = 25.4                         # frames' top band (centre line)
SLABS = [GH + k * FH for k in range(NF + 1)]   # 5, 9, ... 37

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ materials
def node(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n

def L(nt, a, b): nt.links.new(a, b)

def newmat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    return m, nt, nt.nodes["Principled BSDF"]

def mix(nt, a, b, fac=1.0, blend="MIX"):
    """A colour mix (MixRGB); a, b and fac are sockets or values."""
    n = node(nt, "ShaderNodeMixRGB", blend_type=blend)
    for sock, v in ((n.inputs["Fac"], fac), (n.inputs["Color1"], a), (n.inputs["Color2"], b)):
        if isinstance(v, (int, float)): sock.default_value = v
        elif isinstance(v, tuple): sock.default_value = (*v[:3], 1)
        else: L(nt, v, sock)
    return n.outputs["Color"]

def rough_noise(nt, b, rough, amt=0.15, scale=6.0):
    """Roughness never uniform: +-amt from a noise (the skill's rule)."""
    nz = node(nt, "ShaderNodeTexNoise", Scale=scale, Detail=4.0)
    mr = node(nt, "ShaderNodeMapRange"); mr.inputs["To Min"].default_value = rough * (1 - amt); mr.inputs["To Max"].default_value = min(1, rough * (1 + amt))
    L(nt, nz.outputs[0], mr.inputs[0]); L(nt, mr.outputs[0], b.inputs["Roughness"]); return mr

def grime(nt, col, k=0.28, ao_dist=0.8, streak=0.22):
    """Weathering: darker in crevices (AO) and in faint vertical rain streaks. Returns a colour socket."""
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion"); ao.samples = 6; ao.inputs["Distance"].default_value = ao_dist
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = node(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (7.0, 7.0, 0.35)
    L(nt, tc.outputs["Object"], mp.inputs[0])
    nz = node(nt, "ShaderNodeTexNoise", Scale=1.0, Detail=6.0, Roughness=0.6); L(nt, mp.outputs[0], nz.inputs[0])
    st = node(nt, "ShaderNodeMapRange"); st.inputs["From Min"].default_value = 0.45; st.inputs["From Max"].default_value = 0.75
    st.inputs["To Min"].default_value = 0.0; st.inputs["To Max"].default_value = streak; L(nt, nz.outputs[0], st.inputs[0])
    inv = node(nt, "ShaderNodeMath", operation="SUBTRACT"); inv.inputs[0].default_value = 1.0; L(nt, ao.outputs["AO"], inv.inputs[1])
    ka = node(nt, "ShaderNodeMath", operation="MULTIPLY"); ka.inputs[1].default_value = k; L(nt, inv.outputs[0], ka.inputs[0])
    tot = node(nt, "ShaderNodeMath", operation="ADD", use_clamp=True); L(nt, ka.outputs[0], tot.inputs[0]); L(nt, st.outputs[0], tot.inputs[1])
    return mix(nt, col, (0.42, 0.40, 0.37), tot.outputs[0], "MULTIPLY")

def mat(name, col, rough, metal=0.0, bevel=0.006, dirt=0.0, **kw):
    m, nt, b = newmat(name)
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    for k, v in kw.items():
        if k in b.inputs: b.inputs[k].default_value = v
    rough_noise(nt, b, rough)
    if dirt: L(nt, grime(nt, col, k=dirt), b.inputs["Base Color"])
    if bevel:
        bv = node(nt, "ShaderNodeBevel"); bv.inputs["Radius"].default_value = bevel; L(nt, bv.outputs[0], b.inputs["Normal"])
    return m

def tex(nt, stem, kind, mp, non_color=False):
    n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.join(ASSETS, f"{stem}_{kind}_2k.jpg"), check_existing=True)
    if non_color: n.image.colorspace_settings.name = "Non-Color"
    L(nt, mp.outputs[0], n.inputs[0]); return n

def pbr(name, stem, scale, tint=(1, 1, 1), rough_k=1.0, dirt=0.0, joints=None, nstr=1.0, lift=None):
    """A Poly Haven scan at true scale (UVs are in metres). joints=(pitch_u, pitch_v, half width): panel
    joints drawn from the UVs into colour and bump."""
    m, nt, b = newmat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = node(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale, scale, scale)
    L(nt, tc.outputs["UV"], mp.inputs[0])
    col = mix(nt, tex(nt, stem, "diff", mp).outputs[0], tint, 1.0, "MULTIPLY")
    if lift: col = mix(nt, col, lift[0], lift[1])
    r = tex(nt, stem, "rough", mp, True)
    rm = node(nt, "ShaderNodeMath", operation="MULTIPLY"); rm.inputs[1].default_value = rough_k
    L(nt, r.outputs[0], rm.inputs[0]); L(nt, rm.outputs[0], b.inputs["Roughness"])
    n = tex(nt, stem, "nor", mp, True); nm = node(nt, "ShaderNodeNormalMap", Strength=nstr); L(nt, n.outputs[0], nm.inputs["Color"])
    nrm = nm.outputs[0]
    if joints:
        pu, pv, jw = joints
        sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["UV"], sep.inputs[0])
        def line(o, p):
            w = node(nt, "ShaderNodeMath", operation="PINGPONG"); w.inputs[1].default_value = p / 2; L(nt, sep.outputs[o], w.inputs[0])
            s = node(nt, "ShaderNodeMath", operation="LESS_THAN"); s.inputs[1].default_value = jw; L(nt, w.outputs[0], s.inputs[0]); return s
        lu, lv = line(0, pu), line(1, pv)
        j = node(nt, "ShaderNodeMath", operation="MAXIMUM"); L(nt, lu.outputs[0], j.inputs[0]); L(nt, lv.outputs[0], j.inputs[1])
        col = mix(nt, col, (0.06, 0.06, 0.06), j.outputs[0])
        bp = node(nt, "ShaderNodeBump", Strength=0.6, Distance=0.004, invert=True)
        L(nt, j.outputs[0], bp.inputs["Height"]); L(nt, nrm, bp.inputs["Normal"]); nrm = bp.outputs[0]
    if dirt: col = grime(nt, col, k=dirt)
    L(nt, col, b.inputs["Base Color"]); L(nt, nrm, b.inputs["Normal"])
    return m

def glass(name, refl_col, see_col, refl=0.62, rough=0.025, shadow=(0.6, 0.64, 0.66)):
    """Thin curtain-wall glass: a coated reflective layer over a tinted see-through layer (so the room behind
    reads), transparent to shadow rays so the sun reaches the floors. Each pane carries a random 'pane'
    value (a face attribute) that varies its tint and roughness slightly, as real panes do."""
    m, nt, b = newmat(name)
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_type = "GEOMETRY"; at.attribute_name = "pane"
    L(nt, mix(nt, tuple(c * 0.88 for c in refl_col), tuple(min(1, c * 1.12) for c in refl_col), at.outputs["Fac"]), b.inputs["Base Color"])
    b.inputs["Metallic"].default_value = 1.0
    rr = node(nt, "ShaderNodeMapRange"); rr.inputs["To Min"].default_value = rough * 0.4; rr.inputs["To Max"].default_value = rough * 1.8
    L(nt, at.outputs["Fac"], rr.inputs[0]); L(nt, rr.outputs[0], b.inputs["Roughness"])
    tr = node(nt, "ShaderNodeBsdfTransparent"); tr.inputs["Color"].default_value = (*see_col, 1)
    lw = node(nt, "ShaderNodeLayerWeight", Blend=0.35)
    fac = node(nt, "ShaderNodeMapRange"); fac.inputs["To Min"].default_value = refl; fac.inputs["To Max"].default_value = 1.0
    L(nt, lw.outputs["Facing"], fac.inputs[0])
    mx = nt.nodes.new("ShaderNodeMixShader"); L(nt, fac.outputs[0], mx.inputs[0]); L(nt, tr.outputs[0], mx.inputs[1]); L(nt, b.outputs[0], mx.inputs[2])
    lp = nt.nodes.new("ShaderNodeLightPath"); ts = node(nt, "ShaderNodeBsdfTransparent"); ts.inputs["Color"].default_value = (*shadow, 1)
    sh = nt.nodes.new("ShaderNodeMixShader"); L(nt, lp.outputs["Is Shadow Ray"], sh.inputs[0]); L(nt, mx.outputs[0], sh.inputs[1]); L(nt, ts.outputs[0], sh.inputs[2])
    L(nt, sh.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m

def night_k(nt, day, glow):
    """day + night * glow, from the object's 'night' property."""
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_type = "OBJECT"; at.attribute_name = "night"
    k = node(nt, "ShaderNodeMath", operation="MULTIPLY_ADD"); L(nt, at.outputs["Fac"], k.inputs[0]); k.inputs[1].default_value = glow; k.inputs[2].default_value = day
    return k

def ceiling(name, glow, day=0.6, cell=1.2, col=(1.0, 0.86, 0.68), board=(0.62, 0.62, 0.6), zones=True):
    """An office ceiling seen through the glass: off-white board with a downlight every `cell` m. Emission
    is driven by the object's 'night' property; at night some zones stay dim, as in a real office block."""
    m, nt, b = newmat(name)
    b.inputs["Base Color"].default_value = (*board, 1); b.inputs["Roughness"].default_value = 0.85
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["Object"], sep.inputs[0])
    def c_(o):
        a = node(nt, "ShaderNodeMath", operation="WRAP"); a.inputs[1].default_value = 0.0; a.inputs[2].default_value = cell; L(nt, sep.outputs[o], a.inputs[0])
        s = node(nt, "ShaderNodeMath", operation="SUBTRACT"); s.inputs[1].default_value = cell / 2; L(nt, a.outputs[0], s.inputs[0]); return s
    cx, cy = c_(0), c_(1); cmb = nt.nodes.new("ShaderNodeCombineXYZ"); L(nt, cx.outputs[0], cmb.inputs[0]); L(nt, cy.outputs[0], cmb.inputs[1])
    ln = node(nt, "ShaderNodeVectorMath", operation="LENGTH"); L(nt, cmb.outputs[0], ln.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); e0, e1 = ramp.color_ramp.elements
    e0.position, e0.color = 0.0, (1, 1, 1, 1); e1.position, e1.color = 0.11, (0.05, 0.05, 0.05, 1)
    L(nt, ln.outputs["Value"], ramp.inputs[0])
    k = night_k(nt, day, glow)
    st = node(nt, "ShaderNodeMath", operation="MULTIPLY"); L(nt, ramp.outputs[0], st.inputs[0]); L(nt, k.outputs[0], st.inputs[1])
    if zones:   # whole zones of a floor (about 10 m) stay dim at night: a white noise per (x/10, y/10, floor)
        mp = node(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.1, 0.1, 0.25); L(nt, tc.outputs["Object"], mp.inputs[0])
        fl = node(nt, "ShaderNodeVectorMath", operation="FLOOR"); L(nt, mp.outputs[0], fl.inputs[0])
        vn = node(nt, "ShaderNodeTexWhiteNoise", noise_dimensions="3D"); L(nt, fl.outputs[0], vn.inputs["Vector"])
        zr = node(nt, "ShaderNodeMapRange"); zr.inputs["From Min"].default_value = 0.2; zr.inputs["From Max"].default_value = 0.24
        zr.inputs["To Min"].default_value = 0.15; zr.inputs["To Max"].default_value = 1.0; L(nt, vn.outputs["Value"], zr.inputs[0])
        z2 = node(nt, "ShaderNodeMath", operation="MULTIPLY"); L(nt, st.outputs[0], z2.inputs[0]); L(nt, zr.outputs[0], z2.inputs[1]); st = z2
    b.inputs["Emission Color"].default_value = (*col, 1)
    L(nt, st.outputs[0], b.inputs["Emission Strength"])
    return m

def shop(name):
    """Shop interiors seen through the shopfronts: lit back walls with shelving, a muted colour per shop
    (no brands: nothing here is a real tenant)."""
    m, nt, b = newmat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = node(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.13, 0.13, 0.0); L(nt, tc.outputs["Object"], mp.inputs[0])
    fl = node(nt, "ShaderNodeVectorMath", operation="FLOOR"); L(nt, mp.outputs[0], fl.inputs[0])
    wn = node(nt, "ShaderNodeTexWhiteNoise", noise_dimensions="3D"); L(nt, fl.outputs[0], wn.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp; cr.interpolation = "CONSTANT"
    pal = [(0.95, 0.88, 0.76), (0.62, 0.70, 0.78), (0.90, 0.80, 0.62), (0.75, 0.55, 0.45), (0.92, 0.92, 0.9), (0.55, 0.62, 0.55)]
    cr.elements[0].color = (*pal[0], 1); cr.elements[1].position = 1 / len(pal); cr.elements[1].color = (*pal[1], 1)
    for i, c in enumerate(pal[2:], 2): e = cr.elements.new(i / len(pal)); e.color = (*c, 1)
    L(nt, wn.outputs["Value"], ramp.inputs[0])
    wv = node(nt, "ShaderNodeTexWave", Scale=2.2, Distortion=0.0, Detail=0.0, wave_type="BANDS", bands_direction="Z")
    L(nt, tc.outputs["Object"], wv.inputs["Vector"])
    sh = node(nt, "ShaderNodeMapRange"); sh.inputs["From Min"].default_value = 0.0; sh.inputs["From Max"].default_value = 0.25
    sh.inputs["To Min"].default_value = 0.35; sh.inputs["To Max"].default_value = 1.0; L(nt, wv.outputs["Fac"], sh.inputs[0])
    gn = node(nt, "ShaderNodeTexNoise", Scale=9.0, Detail=2.0); L(nt, tc.outputs["Object"], gn.inputs["Vector"])   # goods on the shelves
    gr = node(nt, "ShaderNodeMapRange"); gr.inputs["To Min"].default_value = 0.55; gr.inputs["To Max"].default_value = 1.25; L(nt, gn.outputs[0], gr.inputs[0])
    c = mix(nt, mix(nt, ramp.outputs[0], sh.outputs[0], 1.0, "MULTIPLY"), gr.outputs[0], 1.0, "MULTIPLY")
    L(nt, c, b.inputs["Base Color"]); L(nt, c, b.inputs["Emission Color"])
    k = night_k(nt, 0.9, 1.6); L(nt, k.outputs[0], b.inputs["Emission Strength"]); b.inputs["Roughness"].default_value = 0.6
    return m

def led(name, col=(1.0, 0.78, 0.52), glow=9.0):
    m, nt, b = newmat(name); b.inputs["Base Color"].default_value = (0.8, 0.8, 0.78, 1)
    b.inputs["Emission Color"].default_value = (*col, 1); k = night_k(nt, 0.0, glow); L(nt, k.outputs[0], b.inputs["Emission Strength"])
    return m

def battens(name, col, pitch=0.22, gap=0.35, rough=0.4, metal=0.6):
    """Linear aluminium battens (the canopy soffit): stripes across the UV u axis with dark gaps and a bump."""
    m, nt, b = newmat(name); b.inputs["Metallic"].default_value = metal
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["UV"], sep.inputs[0])
    w = node(nt, "ShaderNodeMath", operation="WRAP"); w.inputs[1].default_value = 0; w.inputs[2].default_value = pitch; L(nt, sep.outputs[0], w.inputs[0])
    s = node(nt, "ShaderNodeMath", operation="LESS_THAN"); s.inputs[1].default_value = pitch * gap; L(nt, w.outputs[0], s.inputs[0])
    L(nt, grime(nt, mix(nt, col, (0.03, 0.03, 0.03), s.outputs[0]), k=0.3, streak=0.1), b.inputs["Base Color"])
    bp = node(nt, "ShaderNodeBump", Strength=0.8, Distance=0.02, invert=True); L(nt, s.outputs[0], bp.inputs["Height"]); L(nt, bp.outputs[0], b.inputs["Normal"])
    rough_noise(nt, b, rough)
    return m

def blind(name):
    m, nt, b = newmat(name); b.inputs["Base Color"].default_value = (0.74, 0.72, 0.67, 1); b.inputs["Roughness"].default_value = 0.9
    tl = node(nt, "ShaderNodeBsdfTranslucent"); tl.inputs["Color"].default_value = (0.9, 0.85, 0.75, 1)
    mx = nt.nodes.new("ShaderNodeMixShader"); mx.inputs[0].default_value = 0.3; L(nt, b.outputs[0], mx.inputs[1]); L(nt, tl.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], nt.nodes["Material Output"].inputs["Surface"]); return m

M = {
    "glass":    glass("ANDHERI_CA_Glass", (0.44, 0.51, 0.58), (0.52, 0.62, 0.66), refl=0.7),
    "glass_dk": glass("ANDHERI_CA_GlassDark", (0.30, 0.35, 0.41), (0.30, 0.36, 0.40), refl=0.76),
    "glass_cl": glass("ANDHERI_CA_GlassClear", (0.20, 0.25, 0.27), (0.78, 0.86, 0.86), refl=0.34),
    "glass_tn": glass("ANDHERI_CA_GlassTint", (0.18, 0.30, 0.30), (0.42, 0.62, 0.58), refl=0.5),
    "spandrel": mat("ANDHERI_CA_Spandrel", (0.42, 0.47, 0.52), 0.06, 1.0, bevel=0),
    "frame":    pbr("ANDHERI_CA_FrameWhite", "plaster", 0.35, (1.22, 1.23, 1.22), 0.45, dirt=0.32, joints=(1.6, 100.0, 0.006), nstr=0.25),
    "stone":    pbr("ANDHERI_CA_Stone", "granite", 0.3, (1.6, 1.6, 1.55), 0.9, dirt=0.2, nstr=0.6, lift=((0.64, 0.64, 0.61), 0.55)),
    "slat":     mat("ANDHERI_CA_Slat", (0.30, 0.31, 0.32), 0.38, 0.75, dirt=0.15),
    "dark":     mat("ANDHERI_CA_DarkMetal", (0.035, 0.038, 0.042), 0.45, 0.6),
    "black":    mat("ANDHERI_CA_BlackGlass", (0.012, 0.013, 0.015), 0.06, 0.0, bevel=0, **{"Specular IOR Level": 0.7}),
    "mullion":  mat("ANDHERI_CA_Mullion", (0.17, 0.18, 0.19), 0.3, 0.85),
    "alu":      mat("ANDHERI_CA_AluWhite", (0.72, 0.72, 0.7), 0.3, 0.6),
    "fascia":   pbr("ANDHERI_CA_Fascia", "plaster", 0.35, (1.25, 1.26, 1.25), 0.4, dirt=0.25, joints=(2.4, 100.0, 0.005), nstr=0.2),
    "soffit":   battens("ANDHERI_CA_Soffit", (0.46, 0.47, 0.48)),
    "ctop":     mat("ANDHERI_CA_CanopyTop", (0.11, 0.12, 0.13), 0.5, 0.55, dirt=0.25),
    "gap":      mat("ANDHERI_CA_ShadowGap", (0.012, 0.012, 0.014), 0.6, bevel=0),
    "led":      led("ANDHERI_CA_LedLine"),
    "ceiling":  ceiling("ANDHERI_CA_Ceiling", 9.0, day=0.7),
    "soffit_lit": ceiling("ANDHERI_CA_ArcadeSoffit", 10.0, day=1.2, cell=1.5, board=(0.75, 0.74, 0.72), zones=False),
    "shop":     shop("ANDHERI_CA_ShopInterior"),
    "floor":    mat("ANDHERI_CA_Floor", (0.30, 0.29, 0.27), 0.55, bevel=0),
    "core":     mat("ANDHERI_CA_Core", (0.42, 0.41, 0.39), 0.8, bevel=0),
    "desk":     mat("ANDHERI_CA_Desk", (0.62, 0.61, 0.58), 0.45, bevel=0),
    "screen":   mat("ANDHERI_CA_Screen", (0.02, 0.02, 0.025), 0.2, bevel=0),
    "blind":    blind("ANDHERI_CA_Blind"),
    "paving":   pbr("ANDHERI_CA_Paving", "granite", 0.5, (1.25, 1.22, 1.15), 0.7),
    "roof":     pbr("ANDHERI_CA_Roof", "concrete", 0.15, (0.95, 0.97, 1.02), dirt=0.2),
    "plant":    mat("ANDHERI_CA_Plant", (0.55, 0.56, 0.56), 0.45, 0.5, dirt=0.3),
    "tank":     mat("ANDHERI_CA_WaterTank", (0.025, 0.025, 0.027), 0.55, 0.0),
}
ORDER = list(M)
MI = {k: i for i, k in enumerate(ORDER)}

# ------------------------------------------------------------------ geometry primitives
bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap"); PANE = bm.faces.layers.float.new("pane")

def face(vs, m, uvs, smooth=False, pane=None):
    fc = bm.faces.new(vs); fc.material_index = MI[m]; fc.smooth = smooth
    for l, u in zip(fc.loops, uvs): l[uv].uv = u
    if pane is not None: fc[PANE] = pane
    return fc

def box(x0, y0, z0, x1, y1, z1, m, top=None, bottom=None):
    """An axis-aligned box with world-scale UVs (1 unit = 1 m); optional materials for its top and bottom."""
    x0, x1 = min(x0, x1), max(x0, x1); y0, y1 = min(y0, y1), max(y0, y1); z0, z1 = min(z0, z1), max(z0, z1)
    if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4: return
    vs = [bm.verts.new(v) for v in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f, kind in (((0, 3, 2, 1), "b"), ((4, 5, 6, 7), "t"), ((0, 1, 5, 4), "s"), ((1, 2, 6, 5), "s"), ((2, 3, 7, 6), "s"), ((3, 0, 4, 7), "s")):
        mm = (top if kind == "t" else bottom if kind == "b" else None) or m
        fc = bm.faces.new([vs[i] for i in f]); fc.material_index = MI[mm]
        n = fc.normal
        for l in fc.loops:
            co = l.vert.co
            l[uv].uv = (co.x, co.z) if abs(n.y) > 0.5 else (co.y, co.z) if abs(n.x) > 0.5 else (co.x, co.y)

def poly(p, m, pane=None, uvs=None):
    """A planar polygon from points; default UVs world-scale in its dominant plane."""
    vs = [bm.verts.new(v) for v in p]
    if uvs is None:
        n = (Vector(p[1]) - Vector(p[0])).cross(Vector(p[-1]) - Vector(p[0]))
        if abs(n.z) >= 0.7 * n.length: uvs = [(v[0], v[1]) for v in p]
        elif abs(n.y) >= abs(n.x): uvs = [(v[0], v[2]) for v in p]
        else: uvs = [(v[1], v[2]) for v in p]
    return face(vs, m, uvs, pane=pane)

def cyl(cx, cy, z0, z1, r, m, seg=20):
    """A smooth round column (sharp at its ends)."""
    bot = [bm.verts.new((cx + r * math.cos(2 * math.pi * i / seg), cy + r * math.sin(2 * math.pi * i / seg), z0)) for i in range(seg)]
    top = [bm.verts.new((v.co.x, v.co.y, z1)) for v in bot]
    for i in range(seg):
        j = (i + 1) % seg; s0, s1 = r * 2 * math.pi * i / seg, r * 2 * math.pi * (i + 1) / seg
        face([bot[i], bot[j], top[j], top[i]], m, [(s0, z0), (s1, z0), (s1, z1), (s0, z1)], smooth=True)
    for ring_, flip in ((top, False), (bot, True)):
        f = face(ring_[::-1] if flip else ring_, m, [(v.co.x, v.co.y) for v in (ring_[::-1] if flip else ring_)])
        for e in f.edges: e.smooth = False

def sweep(pts, Vs, w, d, m, closed=False):
    """A band of rectangular section (w across, d outward) along a path: the rounded white frames and the
    ribbon. pts: path points on the base surface; Vs: outward direction at each point. Smooth along the
    path, sharp at the section's corners, so curves read round and edges stay crisp. UVs: u = arc length."""
    n = len(pts); P = [Vector(p) for p in pts]; V = [Vector(v).normalized() for v in Vs]
    secs = []; S = [0.0]
    for i in range(1, n): S.append(S[-1] + (P[i] - P[i - 1]).length)
    for i in range(n):
        a = P[i - 1] if (i > 0 or closed) else None; c = P[(i + 1) % n] if (i < n - 1 or closed) else None
        tin = (P[i] - a).normalized() if a is not None else None; tout = (c - P[i]).normalized() if c is not None else None
        T = ((tin if tin else tout) + (tout if tout else tin)).normalized()
        U = T.cross(V[i]).normalized(); k = 1.0
        if tin and tout: k = 1.0 / max(0.35, abs(tin.cross(V[i]).normalized().dot(U)))
        U = U * (w / 2 * k)
        secs.append([bm.verts.new(P[i] - U), bm.verts.new(P[i] + U), bm.verts.new(P[i] + U + V[i] * d), bm.verts.new(P[i] - U + V[i] * d)])
    per = [0, w, w + d, 2 * w + d, 2 * w + 2 * d]
    for i in range(n if closed else n - 1):
        j = (i + 1) % n; s0 = S[i]; s1 = S[j] if j > i else S[i] + (P[j] - P[i]).length
        for e in range(4):
            face([secs[i][e], secs[i][(e + 1) % 4], secs[j][(e + 1) % 4], secs[j][e]], m,
                 [(s0, per[e]), (s0, per[e + 1]), (s1, per[e + 1]), (s1, per[e])], smooth=True)
            ed = bm.edges.get((secs[i][e], secs[j][e]))
            if ed: ed.smooth = False                                                  # the band's long edges stay sharp
    if not closed:
        for s in (secs[0], secs[-1][::-1]):
            f = face(s, m, [(0, 0), (w, 0), (w, d), (0, d)])
            for e in f.edges: e.smooth = False

def arc(c, r, a0, a1, seg=12):
    return [(c[0] + r * math.cos(math.radians(a0 + (a1 - a0) * k / seg)), c[1] + r * math.sin(math.radians(a0 + (a1 - a0) * k / seg))) for k in range(seg + 1)]

def rrect(a0, a1, z0, z1, r):
    """A rounded rectangle (centre line) in a face's (a, z) coordinates; radii (bottom-left, bottom-right,
    top-right, top-left); counter-clockwise, not repeating its first point."""
    bl, br, tr, tl = r
    return (arc((a1 - br, z0 + br), br, -90, 0) + arc((a1 - tr, z1 - tr), tr, 0, 90)[1:] +
            arc((a0 + tl, z1 - tl), tl, 90, 180)[1:] + arc((a0 + bl, z0 + bl), bl, 180, 270)[1:])

class Face:
    """A planar facade: P(a, z, off) = origin + t*a + n*off + z up. t and n are axis-aligned."""
    def __init__(s, o, t, n): s.o, s.t, s.n = Vector(o), Vector(t), Vector(n)
    def P(s, a, z, off=0.0): return s.o + s.t * a + s.n * off + Vector((0, 0, z))
    def box(s, a0, a1, z0, z1, o0, o1, m, **kw):
        p, q = s.P(a0, z0, o0), s.P(a1, z1, o1); box(p.x, p.y, p.z, q.x, q.y, q.z, m, **kw)
    def quad(s, a0, a1, z0, z1, off, m, pane=None):
        return poly([s.P(a0, z0, off), s.P(a1, z0, off), s.P(a1, z1, off), s.P(a0, z1, off)], m, pane=pane,
                    uvs=[(a0, z0), (a1, z0), (a1, z1), (a0, z1)])
    def frame(s, pts, m="frame", w=FW, d=FD, closed=True, off=0.0):
        sweep([s.P(a, z, off) for a, z in pts], [s.n] * len(pts), w, d, m, closed)

def floors_in(z0, z1):
    return [z for z in SLABS if z0 - 0.01 <= z <= z1 + 0.01]

def pane(F, a0, a1, z0, z1, m, off=0.0, jitter=0.004):
    """One glass pane, tilted a few milliradians at random about its centre: the reflections break pane by
    pane, as on a real curtain wall."""
    ac, zc = (a0 + a1) / 2, (z0 + z1) / 2; ta, tz = random.uniform(-jitter, jitter), random.uniform(-jitter, jitter)
    o = lambda a, z: off + ta * (a - ac) + tz * (z - zc)
    poly([F.P(a0, z0, o(a0, z0)), F.P(a1, z0, o(a1, z0)), F.P(a1, z1, o(a1, z1)), F.P(a0, z1, o(a0, z1))], m,
         pane=random.random(), uvs=[(a0, z0), (a1, z0), (a1, z1), (a0, z1)])

def curtain(F, a0, a1, z0, z1, m="glass", pitch=1.5, spandrel="spandrel", blinds=True, mull=True, top_gap=False):
    """A unitised curtain wall: a pane per bay and floor, an opaque spandrel band at each slab (0.6 m below
    to 0.1 m above it), mullions 0.12 m proud, blinds behind some panes at random heights."""
    n = max(1, round((a1 - a0) / pitch)); da = (a1 - a0) / n
    bands = []
    for zs in SLABS:
        lo, hi = max(z0, zs - 0.6), min(z1, zs + 0.1)
        if hi - lo > 0.05: bands.append((lo, hi, zs))
    spans = []; zc = z0
    for lo, hi, zs in sorted(bands):
        if lo - zc > 0.05: spans.append((zc, lo))
        zc = max(zc, hi)
    if z1 - zc > 0.05: spans.append((zc, z1))
    for i in range(n):
        b0, b1 = a0 + i * da, a0 + (i + 1) * da
        for s0, s1 in spans:
            pane(F, b0, b1, s0, s1, m)
            if blinds and s1 - s0 > 2.0 and random.random() < 0.32:
                drop = min(random.choice([0.35, 0.6, 0.9, 1.4, 1.9, 2.4]), s1 - s0 - 0.2)
                F.quad(b0 + 0.04, b1 - 0.04, s1 - drop, s1 - 0.05, -0.12, "blind")
        for lo, hi, zs in bands:
            F.quad(b0, b1, lo, hi, 0.002, "gap" if (top_gap and abs(zs - H) < 0.01) else spandrel)
        if mull and i: a = a0 + i * da; F.box(a - 0.03, a + 0.03, z0, z1, 0.0, 0.12, "mullion")
    if mull:
        for lo, hi, zs in bands:
            F.box(a0, a1, hi - 0.04, hi + 0.02, 0.0, 0.08, "mullion"); F.box(a0, a1, lo - 0.02, lo + 0.04, 0.0, 0.08, "mullion")

def slit_wall(F, a0, a1, z0, z1, tiers):
    """Stone cladding 0.3 m proud of tinted glass, cut by tall slit windows in tiers: 0.8 m pier, 0.55 m slit,
    0.8 m pier, 1.45 m window, repeated; dark transoms at the slab lines inside the windows."""
    pat = [0.8, 0.55, 0.8, 1.45]; wins = []; a = a0 + 0.5; k = 0
    while True:
        wdt = pat[k % 4]
        if a + wdt > a1 - 0.5: break
        if k % 2: wins.append((a, a + wdt))
        a += wdt; k += 1
    edges = [a0] + [v for p, q in wins for v in (p, q)] + [a1]
    for i in range(0, len(edges), 2): F.box(edges[i], edges[i + 1], z0, z1, 0.0, 0.3, "stone")   # piers, full height
    for p, q in wins:
        zc = z0
        for t0, t1 in tiers:
            F.box(p, q, zc, t0, 0.0, 0.3, "stone"); zc = t1
            pane(F, p, q, t0, t1, "glass_tn", jitter=0.002)
            for zs in floors_in(t0 + 0.4, t1 - 0.4): F.box(p, q, zs - 0.3, zs + 0.3, 0.0, 0.06, "dark")
            if q - p > 1.0: F.box((p + q) / 2 - 0.025, (p + q) / 2 + 0.025, t0, t1, 0.0, 0.06, "mullion")
            if t1 - t0 > 2.5 and random.random() < 0.4: F.quad(p + 0.03, q - 0.03, t1 - random.uniform(0.4, 2.2), t1 - 0.05, -0.12, "blind")
        F.box(p, q, zc, z1, 0.0, 0.3, "stone")

def shopfront(F, a0, a1, depth=2.5, back=9.0, partition=7.8, soff=None):
    """The recessed ground floor: shopfront glass 2.5 m back, mullions, a transom, a signage fascia, a lit
    soffit over the arcade (over soff = (a0, a1) if given) and lit shop interiors behind."""
    g = -depth; s0, s1 = soff or (a0, a1)
    n = max(1, round((a1 - a0) / 2.6)); da = (a1 - a0) / n
    for i in range(n):
        b0, b1 = a0 + i * da, a0 + (i + 1) * da
        pane(F, b0, b1, 0.15, 3.3, "glass_cl", off=g, jitter=0.002); pane(F, b0, b1, 3.38, 4.4, "glass_cl", off=g, jitter=0.002)
        if i: F.box(b0 - 0.04, b0 + 0.04, 0.15, 4.4, g, g + 0.1, "mullion")
    F.box(a0, a1, 3.3, 3.38, g, g + 0.1, "mullion"); F.box(a0, a1, 0.1, 0.18, g, g + 0.1, "mullion")
    F.box(a0, a1, 4.4, 4.62, g - 0.05, g + 0.12, "dark")                            # signage band
    F.box(s0, s1, 4.62, 4.68, g, 0.0, "soffit_lit")                                 # arcade soffit
    F.box(s0, s1, 4.68, 5.15, -0.45, 0.02, "dark")                                  # the slab edge over the arcade
    F.box(s0, s1, -0.05, 0.0, g, 0.0, "paving")                                     # arcade floor
    F.box(a0, a1, 0.0, 0.15, g - back, g, "paving")                                 # shop floor
    F.box(a0, a1, 4.3, 4.36, g - back, g - 0.05, "ceiling")
    F.quad(a0, a1, 0.15, 4.3, g - back, "shop")
    k = int((a1 - a0) / partition)
    for i in range(1, k + 1):
        a = a0 + i * (a1 - a0) / (k + 1); F.box(a - 0.1, a + 0.1, 0.15, 4.3, g - back, g - 0.05, "frame")

def interior(F, a0, a1, z0, z1, depth=10.5, desks=True, dz=0.0):
    """Office floors behind a stretch of facade: a slab, a lit ceiling 3.05 m up, desks along the glass."""
    for zs in [z for z in SLABS if z0 - 0.9 <= z < z1 - 1.0]:
        F.box(a0, a1, zs - 0.3 + dz, zs + dz, -0.05, -depth, "floor")
        F.box(a0, a1, zs + 3.05 + dz, zs + 3.1 + dz, -0.4, -depth, "ceiling")
        if not desks: continue
        a = a0 + 1.2
        while a < a1 - 2.0:
            if random.random() < 0.82:
                for row, (o0, o1) in enumerate(((-2.0, -2.75), (-2.75, -3.5))):
                    F.box(a, a + 1.5, zs + 0.71, zs + 0.75, o0, o1, "desk")
                    oo = o1 if row == 0 else o0
                    F.box(a + 0.05, a + 1.45, zs, zs + 0.71, oo, oo + (0.03 if row == 0 else -0.03), "desk")
                    if random.random() < 0.85:
                        mo = (o1 + 0.12) if row == 0 else (o0 - 0.12)
                        F.box(a + 0.45, a + 1.05, zs + 0.8, zs + 1.15, mo, mo + (0.03 if row == 0 else -0.03), "screen")
                F.box(a - 0.01, a + 1.5, zs + 0.75, zs + 1.25, -2.74, -2.76, "blind")   # a fabric screen between the rows
            a += 1.6

# ------------------------------------------------------------------ the long faces: sgn -1 the main facade, +1 the back
def long_face(sgn):
    F = Face((0, sgn * YG, 0), (1, 0, 0), (0, sgn, 0))
    front = sgn < 0
    # A: the podium (G+2): clear glass, white floor bands, a rounded white frame, lit floors behind
    curtain(F, -XP, XA1, 0.15, ZPOD - 0.4, "glass_cl", pitch=1.6, spandrel="frame", blinds=False)
    F.box(-XP, XA1, ZPOD - 0.4, ZPOD, -0.3, 0.05, "frame")
    F.frame(rrect(-XP + 0.5, XA1 - 0.5, 0.5, ZPOD - 0.5, (3.0, 0.5, 0.5, 1.5)))
    cyl(-XP, sgn * YG, 3.2, ZPOD, FD, "frame", seg=24)                               # the podium's frames meet round the corner
    interior(F, -XP + 0.4, XA1, 0.0, ZPOD)
    F.box(-XP + 0.3, XA1, 0.0, 0.15, -0.1, -10.5, "paving"); F.box(-XP + 0.3, XA1, 4.6, 4.65, -0.4, -10.5, "soffit_lit")
    # A: the glazed volume to floor 6: white bands, white edges, a white cornice
    curtain(F, XA0, XA1, ZPOD, ZA - 0.6, "glass_cl", pitch=1.65, spandrel="frame")
    F.box(XA0 - 0.55, XA1, ZA - 0.6, ZA, -0.5, 0.55, "frame")
    F.box(XA0 - 0.55, XA0 + 0.6, ZPOD, ZA, -0.5, 0.5, "frame"); F.box(XA1 - 0.8, XA1, ZPOD, ZA, -0.5, 0.5, "frame")
    interior(F, XA0 + 0.3, XA1, ZPOD, ZA)
    # A: dark glass above, set back 1.5 m under the canopy
    UF = Face((0, sgn * (YG - 1.5), 0), (1, 0, 0), (0, sgn, 0))
    curtain(UF, XUP, XA1, ZA, H, "glass_dk", top_gap=True)
    interior(UF, XUP + 0.3, XA1, ZA, H, depth=9.0)
    F.box(XUP, XA1, ZA - 0.05, ZA, -1.6, 0.0, "roof")
    # B: the dark slatted band, 0.9 m proud, ground to floor 7
    zb = SLABS[7] + 0.3
    F.box(XB0, XB1, 0.0, zb, 0.0, 0.5, "black")
    for a in (XB0, XB1 - 0.15): F.box(a, a + 0.15, 0.0, zb, 0.0, 0.92, "dark")
    nsl = int((XB1 - XB0 - 0.3) / 0.5)
    for i in range(1, nsl):
        a = XB0 + 0.15 + i * (XB1 - XB0 - 0.3) / nsl; F.box(a - 0.05, a + 0.05, 0.35, zb, 0.5, 0.9, "slat")
    for zs in floors_in(4.0, zb): F.box(XB0, XB1, zs - 0.22, zs + 0.12, 0.45, 0.88, "dark")
    F.box(XB0 - 0.05, XB1 + 0.05, zb, zb + 0.3, -0.2, 0.95, "dark"); F.box(XB0, XB1, 0.0, 0.35, 0.45, 0.92, "dark")
    curtain(F, XB0, XB1, zb + 0.3, H, "glass_dk", top_gap=True)
    interior(F, XB0, XB1, zb, H)
    # C: shops, floor 1 dark glass, the C-frame (open towards B) over floors 2-5, curtain wall above
    shopfront(F, XC0, XC1)
    curtain(F, XC0, XC1 + 0.05, GH + 0.15, SLABS[1] - 0.55, "glass_dk")
    zb0 = SLABS[1] - 0.1
    pts = [(XC0, ZFT)] + arc((XC1 - 2.5, ZFT - 2.0), 2.0, 90, 0) + arc((XC1 - 2.5, zb0 + 2.0), 2.0, 0, -90) + [(XC0, zb0)]
    F.frame(pts, closed=False)
    slit_wall(F, XC0, XC1 - 1.0, zb0 + 0.5, ZFT - 0.5, [(SLABS[1] + 0.65, SLABS[3] - 0.35), (SLABS[3] + 0.3, ZFT - 0.75)])
    curtain(F, XB1, XC1, ZFT + 0.5, H, "glass", top_gap=True)
    interior(F, XC0, XC1, GH, H)
    if front:   # the white entrance canopy over the shops
        F.box(-11.5, 3.5, 4.5, 4.78, 0.0, 2.3, "frame"); F.box(-11.4, 3.4, 4.44, 4.5, 0.1, 2.2, "soffit_lit")
    for a in (-8.5, 0.0, 8.5): cyl(a, sgn * (YG - 0.55), 0.0, 4.7, 0.42, "frame")
    # D: the dark recessed slot with vertical fins
    F.box(XD0, XD1, 0.0, H + 0.6, -2.1, -2.0, "black")
    for a in (XD0, XD1 - 0.12): F.box(a, a + 0.12, 0.0, H + 0.6, -2.0, 0.0, "dark")
    for zs in SLABS: F.box(XD0, XD1, zs - 0.28, zs + 0.05, -2.0, -1.8, "dark")
    nf_ = int((XD1 - XD0) / 0.9)
    for i in range(1, nf_):
        a = XD0 + i * (XD1 - XD0) / nf_; F.box(a - 0.05, a + 0.05, 0.25, H + 0.4, -0.35, 0.12, "slat")
    # E: the corner block's face: a rounded frame over floors 1-5, curtain wall above, an arcade below
    shopfront(F, XE0, XE - 2.5, soff=(XE0, XE))
    for a in (24.5, 31.0): cyl(a, sgn * (YG - 0.55), 0.0, 4.7, 0.42, "frame")
    F.frame(rrect(XE0 + 0.6, XE - 0.5, GH + 0.1, ZFT, (2.0, 2.0, 1.2, 2.0)))
    slit_wall(F, XE0 + 1.1, XE - 1.0, GH + 0.6, ZFT - 0.5, [(GH + 0.85, SLABS[2] - 0.35), (SLABS[2] + 0.3, ZFT - 0.75)])
    curtain(F, XE0, XE, ZFT + 0.5, H, "glass")
    curtain(F, XE0, XE, H, ZGE, "spandrel", blinds=False)
    interior(F, XE0, XE, GH, H)
    cyl(XE, sgn * YG, GH - 0.4, ZFT + 0.5, FD, "frame", seg=24)                     # the frames meet round the corner
    if front:   # the ribbon: the frame's top band runs round the corner, along the side face, and turns up into the canopy
        rp, R, ye = 1.2, 4.0, YG - 1.0
        path, vs = [], []
        for x in (30.0, 34.0, XE - rp): path.append((x, -YG, ZFT)); vs.append((0, -1, 0))
        for k in range(1, 10):
            ang = math.radians(-90 + 90 * k / 10)
            path.append((XE - rp + rp * math.cos(ang), -YG + rp + rp * math.sin(ang), ZFT)); vs.append((math.cos(ang), math.sin(ang), 0))
        for y in (-YG + rp, 0.0, ye - R): path.append((XE, y, ZFT)); vs.append((1, 0, 0))
        for k in range(1, 13):
            ph = math.radians(90 * k / 12); path.append((XE, ye - R + R * math.sin(ph), ZFT + R - R * math.cos(ph))); vs.append((1, 0, 0))
        for z in (ZFT + R + 2.0, ETOP - 1.0): path.append((XE, ye, z)); vs.append((1, 0, 0))
        sweep(path, vs, FW + 0.004, FD + 0.004, "frame")

def end_faces():
    # +x: the corner block's side face (glass line XE)
    F = Face((XE, 0, 0), (0, 1, 0), (1, 0, 0))
    shopfront(F, -YG + 2.5, YG - 2.5, back=8.0, soff=(-YG, YG))
    for a in (-9.0, -1.0, 7.0): cyl(XE - 0.55, a, 0.0, 4.7, 0.42, "frame")
    for s in (-1, 1): cyl(XE - 0.55, s * (YG - 0.55), 0.0, 4.7, 0.42, "frame")
    # the two-storey retail box: clear glass, a lit display behind, its own rounded frame
    zr0, zr1 = GH + 0.1, SLABS[2] + 0.4
    for a0 in range(-16, 16, 2):
        pane(F, a0, a0 + 2, zr0 + 0.4, zr1 - 0.5, "glass_cl", jitter=0.002)
        if a0 > -16: F.box(a0 - 0.03, a0 + 0.03, zr0 + 0.4, zr1 - 0.5, 0.0, 0.1, "alu")
    F.box(-16, 16, SLABS[1] - 0.15, SLABS[1] + 0.15, 0.0, 0.12, "frame")
    F.quad(-16, 16, zr0, zr1, -1.6, "shop")
    for zs in (GH, SLABS[1]):
        F.box(-16, 16, zs - 0.3, zs, -0.05, -1.6, "floor"); F.box(-16, 16, zs + 3.4, zs + 3.45, -0.2, -1.6, "ceiling")
    F.frame(rrect(-YG + 0.5, YG - 1.2, zr0, zr1, (0.6, 2.0, 2.0, 0.6)))
    curtain(F, -YG, YG, zr1 + 0.5, ZFT - 0.5, "glass")
    curtain(F, -YG, YG, ZFT + 0.5, H, "glass")
    curtain(F, -YG, YG, H, ZGE, "spandrel", blinds=False)
    F.box(-YG, YG, ZFT - 0.5, ZFT + 0.5, -0.2, 0.0, "spandrel")
    interior(F, -YG + 0.5, YG - 0.5, zr1, H, depth=9.0, dz=0.004)
    # -x: the podium's end, the glazed volume's end, the setback upper floors under the folded canopy
    P = Face((-XP, 0, 0), (0, 1, 0), (-1, 0, 0))
    curtain(P, -YG, YG, 0.15, ZPOD - 0.4, "glass_cl", pitch=1.6, spandrel="frame", blinds=False)
    P.box(-YG, YG, ZPOD - 0.4, ZPOD, -0.3, 0.05, "frame")
    P.frame(rrect(-YG + 0.5, YG - 0.5, 0.5, ZPOD - 0.5, (2.5, 2.5, 1.0, 1.0)))
    interior(P, -YG + 0.4, YG - 0.4, 0.0, ZPOD, depth=4.0, dz=0.004)
    box(-XP, -YG, ZPOD - 0.1, XA0, YG, ZPOD, "paving")                              # the podium terrace
    for y in (-YG + 0.3, YG - 0.3): poly([(-XP + 0.3, y, ZPOD), (XA0, y, ZPOD), (XA0, y, ZPOD + 1.1), (-XP + 0.3, y, ZPOD + 1.1)], "glass_cl", pane=0.5)
    poly([(-XP + 0.3, -YG + 0.3, ZPOD), (-XP + 0.3, YG - 0.3, ZPOD), (-XP + 0.3, YG - 0.3, ZPOD + 1.1), (-XP + 0.3, -YG + 0.3, ZPOD + 1.1)], "glass_cl", pane=0.5)
    box(-XP + 0.25, -YG + 0.25, ZPOD + 1.08, -XP + 0.35, YG - 0.25, ZPOD + 1.14, "alu")
    Q = Face((XA0, 0, 0), (0, 1, 0), (-1, 0, 0))
    curtain(Q, -YG, YG, ZPOD, ZA - 0.6, "glass_cl", pitch=1.65, spandrel="frame")
    Q.box(-YG - 0.5, YG + 0.5, ZA - 0.6, ZA, -0.5, 0.55, "frame")
    interior(Q, -YG + 0.5, YG - 0.5, ZPOD, ZA, depth=4.0, dz=0.004)
    U = Face((XUP, 0, 0), (0, 1, 0), (-1, 0, 0))
    curtain(U, -YG + 1.5, YG - 1.5, ZA, H, "glass_dk", blinds=False, top_gap=True)
    box(XA0, -YG, ZA - 0.05, XUP, YG, ZA, "roof")

long_face(-1); long_face(+1); end_faces()
box(-7, -6.5, 0.0, 7, 6.5, H + 0.2, "core")                                         # the core: the glass never sees through

# ------------------------------------------------------------------ the canopy
def canopy(x0, x1, top, zg, gx0, gx1, px0, px1, ring_sides, soffit_sides):
    """A perimeter canopy: a dark metal top out to a parapet 3 m in from the glass, a white fascia 0.6 m deep
    with a lip, a battened soffit sloping from the fascia down to the glass line, a black shadow gap and an
    LED line where it meets the glass. Sides: 0 = -y, 1 = +x, 2 = +y, 3 = -x. Quads between loops of
    corners, so the corners mitre by construction."""
    out = [(x0, -YC), (x1, -YC), (x1, YC), (x0, YC)]
    gl = [(gx0, -YG), (gx1, -YG), (gx1, YG), (gx0, YG)]
    par = [(px0, -(YG - 3)), (px1, -(YG - 3)), (px1, YG - 3), (px0, YG - 3)]
    sgn = lambda v: (v > 0) - (v < 0)
    lip = [(o[0] + 0.15 * sgn(p[0] - o[0]) * (abs(p[0] - o[0]) > 0.5), o[1] + 0.15 * sgn(p[1] - o[1])) for o, p in zip(out, par)]
    fb, ft = top - 0.6, top + 0.05
    def q(a, b, c, d, m, uvs=None): poly([a, b, c, d], m, uvs=uvs)
    for i in ring_sides:
        j = (i + 1) % 4; along = 0 if i in (0, 2) else 1
        q((*out[i], top), (*out[j], top), (*par[j], top), (*par[i], top), "ctop")                       # the top
        q((*out[i], fb), (*out[j], fb), (*out[j], ft), (*out[i], ft), "fascia")                         # fascia, lip, inner lip
        q((*out[i], ft), (*out[j], ft), (*lip[j], ft), (*lip[i], ft), "fascia")
        q((*lip[i], ft), (*lip[j], ft), (*lip[j], top), (*lip[i], top), "fascia")
        q((*par[i], top), (*par[j], top), (*par[j], H), (*par[i], H), "ctop")                           # the parapet's inner face
    nrm = [(0, -1), (1, 0), (0, 1), (-1, 0)]
    for i in soffit_sides:
        j = (i + 1) % 4; along = 0 if i in (0, 2) else 1; nx, ny = nrm[i]
        o0, o1, g0, g1 = out[i], out[j], gl[i], gl[j]; acr = math.hypot(g0[0] - o0[0], g0[1] - o0[1])
        q((*o0, fb), (*o1, fb), (*g1, zg + 0.6), (*g0, zg + 0.6), "soffit", uvs=[(o0[along], 0), (o1[along], 0), (g1[along], acr), (g0[along], acr)])
        q((g0[0] + nx * 0.01, g0[1] + ny * 0.01, zg), (g1[0] + nx * 0.01, g1[1] + ny * 0.01, zg),
          (g1[0] + nx * 0.01, g1[1] + ny * 0.01, zg + 0.6), (g0[0] + nx * 0.01, g0[1] + ny * 0.01, zg + 0.6), "gap")
        q((g0[0] + nx * 0.05, g0[1] + ny * 0.05, zg + 0.585), (g1[0] + nx * 0.05, g1[1] + ny * 0.05, zg + 0.585),
          (g1[0] + nx * 0.22, g1[1] + ny * 0.22, zg + 0.6), (g0[0] + nx * 0.22, g0[1] + ny * 0.22, zg + 0.6), "led")
    return out, gl, par, fb

# main canopy: long sides only (its -x end folds down; its +x end meets the corner block's higher canopy)
canopy(TIP, XE0, CTOP, H, XUP, XE0, TIP + 3.0, XE0, [0, 2, 3], [0, 2])
fold = [(TIP - 0.01, -YC, CTOP - 0.6), (TIP - 0.01, YC, CTOP - 0.6), (XUP, YG - 1.5, ZA), (XUP, -(YG - 1.5), ZA)]
poly(fold, "ctop")                                                                    # the raked end over volume A
for s in (-1, 1):
    poly([(TIP, s * YC, CTOP - 0.6), (XUP, s * (YG - 1.5), ZA), (XUP, s * YG, H + 0.6)], "fascia")   # the white raked edge
    y0, y1 = sorted((s * YG, s * (YG - 1.5)))
    poly([(XUP, y0, H + 0.6), (XA1, y0, H + 0.6), (XA1, y1, H + 0.6), (XUP, y1, H + 0.6)], "gap")    # closes the soffit over the setback
    # the end of the main canopy where the corner block's canopy rises: its section beyond the glass
    poly([(XE0 - 0.003, s * YC, CTOP - 0.6), (XE0 - 0.003, s * YC, CTOP + 0.05), (XE0 - 0.003, s * YG, CTOP), (XE0 - 0.003, s * YG, H + 0.6)], "fascia")
# the corner block's canopy, 2.4 m higher, cantilevered 3 m beyond its side face; its end at x = 20 is a white step
o_e, g_e, p_e, fb_e = canopy(XE0, XC, ETOP, ZGE, XE0, XE, XE0, XE - 3.0, [0, 1, 2], [0, 1, 2])
for s in (-1, 1):
    sec = [(s * YC, fb_e), (s * YC, ETOP + 0.05), (s * (YG - 3), ETOP), (s * (YG - 3), H), (s * YG, H), (s * YG, ZGE + 0.6)]
    poly([(XE0, y, z) for y, z in (sec if s < 0 else sec[::-1])], "fascia")

# ------------------------------------------------------------------ the roof: slab, lift machine room, black water tanks, condensers
box(XUP + 0.2, -YG + 0.2, H - 0.3, XE - 0.2, YG - 0.2, H, "roof")
box(-5.5, -4.5, H, 5.5, 4.5, H + 3.6, "plant", top="roof")
box(-5.7, -4.7, H + 3.6, 5.7, 4.7, H + 3.85, "plant")
for i in range(6): cyl(9.0 + i * 2.6, 7.0, H, H + 1.9, 1.05, "tank", seg=18)
for i in range(4): cyl(9.0 + i * 2.6, 3.8, H, H + 1.9, 1.05, "tank", seg=18)
for r_ in range(3):
    for c_ in range(8):
        x, y = -28.0 + c_ * 2.2, -8.0 + r_ * 5.5
        box(x, y, H, x + 1.4, y + 1.0, H + 1.25, "plant", top="dark")
box(-30, -11, H, 28, -10.7, H + 0.45, "plant")                                       # a cable tray run
box(25.0, -9.0, H, 33.0, -2.0, H + 2.2, "plant", top="dark")                         # the corner block's chiller
box(-31, 9.5, H, -24, 12.5, H + 2.4, "plant")                                         # a stair head

# ------------------------------------------------------------------ mesh, a hull-safe vertex order, the object
# diorama.py's --hero-fit reads the outline from every n-th vertex (n = verts // 4000): put the outline's hull
# corners on sampled indices so the fit sees the true 83 x 41 m outline, not a subsample of it.
def hull2d(pts):
    pts = sorted(set(pts))
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
bm.verts.index_update()
key = {}
for v in bm.verts: key.setdefault((round(v.co.x, 4), round(v.co.y, 4)), v)
hv = [key[p] for p in hull2d(list(key))]
n = len(bm.verts); step = max(1, n // 4000); slot = {hv_.index: k * step for k, hv_ in enumerate(hv)}
taken = set(slot.values()); free = iter(i for i in range(n) if i not in taken)
newpos = [slot[i] if i in slot else next(free) for i in range(n)]
bm.verts.sort(key=lambda v: newpos[v.index])

me = bpy.data.meshes.new("opt_corporate-avenue"); bm.to_mesh(me); bm.free()
for m in ORDER: me.materials.append(M[m])
# --turn180: turn it 180 degrees, exactly (negate x and y; a rotation matrix adds float noise, and with the old
# minimum-rectangle fit that noise decided which way round diorama.py read the outline). Off by default: with the
# current fit the unturned mesh lands with its main facade north and its corner block west.
TURN = "--turn180" in A
if TURN:
    for v in me.vertices: v.co.x, v.co.y = -v.co.x, -v.co.y
ob = bpy.data.objects.new("opt_corporate-avenue", me); sc.collection.objects.link(ob)
ob["night"] = 0.0
ob["source_basis"] = ("Atul Corporate Avenue modelled from the developer render (deck p10); G+8 per the deck; outline 83 x 41 m "
                      "from the OSM footprint's minimum rectangle; zone widths, frame, slat and window sizes estimated")
bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = 0.012; bv.segments = 2; bv.limit_method = "ANGLE"; bv.harden_normals = False
co = [v.co for v in me.vertices]
print("CORPORATE_HERO %d verts %d faces, hull %d pts (step %d), x %.1f..%.1f y %.1f..%.1f z %.1f..%.1f, built in %.1f s" % (
    len(me.vertices), len(me.polygons), len(hv), step, min(c.x for c in co), max(c.x for c in co), min(c.y for c in co), max(c.y for c in co),
    min(c.z for c in co), max(c.z for c in co), time.time() - T0))
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))

# ------------------------------------------------------------------ preview
if "--preview" in A:   # a standalone look check: HDRI sky (sun disc clamped) + a sun lamp, Cycles GPU, a street camera
    import numpy as np
    png, hdri = A[A.index("--preview") + 1], A[A.index("--preview") + 2]
    night = float(arg("--night", 0.0)); ob["night"] = night
    FS = 1 if TURN else -1   # the cameras and the ground below are written for the main facade at +y: mirror them through the centre if unturned
    az, el = math.radians(float(arg("--sun-az", 35.0)) + (0 if TURN else 180)), math.radians(float(arg("--sun-el", 38.0)))
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; nt = w.node_tree
    img = bpy.data.images.load(os.path.abspath(hdri)); W_, H_ = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H_, W_, 4)
    lum = px[..., :3].sum(-1); r_, c_ = np.unravel_index(lum.argmax(), lum.shape); u_ = (c_ + 0.5) / W_
    px[..., :3] = np.minimum(px[..., :3], 40.0); img.pixels[:] = px.ravel()          # the sun disc is the lamp's job
    phi0 = math.pi - 2 * math.pi * (u_ - 0.5)                                          # the HDRI sun's direction in x-y
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = img
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value = (0, 0, phi0 - az)
    nt.links.new(tc.outputs["Generated"], mp.inputs[0]); nt.links.new(mp.outputs[0], env.inputs[0])
    nt.links.new(env.outputs[0], nt.nodes["Background"].inputs[0]); nt.nodes["Background"].inputs[1].default_value = float(arg("--sky", 1.0))
    if el > 0:
        sd = bpy.data.lights.new("sun", "SUN"); sd.energy = float(arg("--sun", 4.5)); sd.angle = math.radians(0.8)
        sd.color = (1.0, 0.92, 0.82) if el > math.radians(20) else (1.0, 0.75, 0.52)
        so = bpy.data.objects.new("sun", sd); sc.collection.objects.link(so)
        d = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        so.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    # ground (final frame: the main facade faces +y): a granite-paved forecourt, a road, asphalt beyond
    gm = bpy.data.meshes.new("g"); g2 = bmesh.new(); guv = g2.loops.layers.uv.new("UVMap")
    def gq(x0, y0, x1, y1, z, mi):
        f = g2.faces.new([g2.verts.new(v) for v in ((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))]); f.material_index = mi
        for l in f.loops: l[guv].uv = (l.vert.co.x, l.vert.co.y)
    band = lambda y0, y1: sorted((FS * y0, FS * y1))
    gq(-600, -600, 600, 600, -0.03, 0)
    (fy0, fy1), (ry0, ry1) = band(-45, 36), band(36.3, 47)
    gq(-75, fy0, 75, fy1, 0.0, 1); gq(-600, ry0, 600, ry1, -0.12, 0)
    g2.to_mesh(gm); g2.free(); go = bpy.data.objects.new("ground", gm); sc.collection.objects.link(go)
    gm.materials.append(pbr("asphalt", "asphalt", 0.12)); gm.materials.append(M["paving"])
    view = arg("--view", "street")
    cams = {"street": ((-53.3, 78.2, 3.0), (-19, 22, 3.0), 28, 1500, 1000, 0.25),   # the developer render's view: front-right, low (solved to its framing)
            "corner": ((-66, 46, 1.7), (-38, 17, 1.7), 24, 1200, 1500, 0.3),   # close on the corner block and the ribbon
            "aerial": ((40, 150, 110), (0, 0, 10), 32, 1500, 1000, 0.0),   # the campus shot's angle
            "back":   ((80, -85, 3.0), (0, 0, 3.0), 26, 1500, 1000, 0.2),
            "far":    ((15, 130, 2.0), (-5, 0, 2.0), 30, 1500, 1000, 0.17)}   # square on to the main facade from across the road
    (cx, cy, cz), (tx, ty, tz), lens, rx, ry, shift = cams[view]
    if "--res" in A: rx, ry = (int(v) for v in arg("--res", "").split("x"))
    cd = bpy.data.cameras.new("c"); cd.lens = lens; cd.clip_end = 3000; cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
    cx, cy, tx, ty = FS * cx, FS * cy, FS * tx, FS * ty
    cam.location = (cx, cy, cz); look = Vector((tx, ty, tz)) - cam.location
    if view == "aerial": cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    else:   # verticals kept straight: a level camera, shifted up
        cam.rotation_euler = (math.pi / 2, 0, math.atan2(look.y, look.x) - math.pi / 2)
        cd.shift_y = float(arg("--shift", shift))
    sc.render.engine = "CYCLES"; sc.cycles.samples = int(arg("--samples", 128)); sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8; sc.cycles.transparent_max_bounces = 16
    try:
        pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = "METAL"; pr.get_devices()
        for dv in pr.devices: dv.use = True
        sc.cycles.device = "GPU"
    except Exception as e: print("CPU", e)
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = float(arg("--exposure", 0.0))
    try:   # a touch warmer than the HDRI's blue morning: the developer render is neutral
        sc.view_settings.use_white_balance = True; sc.view_settings.white_balance_temperature = float(arg("--wb", 9000))
    except Exception as e: print("no white balance", e)
    sc.render.resolution_x, sc.render.resolution_y = rx, ry; sc.render.filepath = os.path.abspath(png)
    t0 = time.time(); bpy.ops.render.render(write_still=True); print("PREVIEW", png, "%.0f s" % (time.time() - t0))
    if "--probe" in A:   # a flat material-class ID render of the same view, for checking a render by numbers
        CLS = {"glass": 1, "glass_dk": 2, "glass_cl": 3, "glass_tn": 4, "spandrel": 5, "frame": 6, "stone": 7, "slat": 8, "dark": 9,
               "black": 9, "mullion": 10, "alu": 10, "fascia": 11, "soffit": 12, "ctop": 13, "gap": 14, "led": 14, "ceiling": 15,
               "soffit_lit": 16, "shop": 17, "floor": 18, "core": 18, "desk": 18, "screen": 18, "blind": 19, "paving": 20,
               "roof": 21, "plant": 21, "tank": 21}
        def idm(c):
            m = bpy.data.materials.new("id%d" % c); m.use_nodes = True; nt_ = m.node_tree; nt_.nodes.remove(nt_.nodes["Principled BSDF"])
            e = nt_.nodes.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (c % 3 / 2, c // 3 % 3 / 2, c // 9 / 2, 1)
            nt_.links.new(e.outputs[0], nt_.nodes["Material Output"].inputs["Surface"]); return m
        for i, k in enumerate(ORDER): me.materials[i] = idm(CLS[k])
        gm.materials[0] = idm(22); gm.materials[1] = idm(20)
        ob.modifiers.clear(); nt.nodes["Background"].inputs[1].default_value = 0.0
        if bpy.data.objects.get("sun"): bpy.data.objects["sun"].hide_render = True
        sc.cycles.samples = 1; sc.cycles.use_denoising = False; sc.cycles.filter_width = 0.01; sc.render.dither_intensity = 0
        sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"; sc.view_settings.exposure = 0
        try: sc.view_settings.use_white_balance = False
        except Exception: pass
        sc.render.filepath = os.path.abspath(arg("--probe", "")); bpy.ops.render.render(write_still=True); print("PROBE", sc.render.filepath)
