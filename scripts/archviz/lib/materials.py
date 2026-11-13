"""Materials: real PBR for every surface our builders produce, with the imperfections a photo has.

`upgrade(spec)` walks the scene and swaps each material by name (the names our builders use:
acp_light, glass_blue, pavers, asphalt, concrete, city_buildings, leaf, ...) for a finished one:

  texture sets at true scale   albedo, roughness, normal and displacement from assets/library
                               (Poly Haven, Quixel, your own), box-projected from object space
                               so nothing needs UVs; procedural fallback when a set is missing
  roughness variation          a low-frequency noise so no surface is uniformly shiny
  bevelled edges               a Bevel shader node on every hard-surface material (5 to 15 mm),
                               which is what makes edges catch light without changing geometry
  dirt and weathering          ambient-occlusion grime in corners, rain streaks down walls,
                               darkening at the base; strength per material class
  glass                        low-e curtain wall: dark, Fresnel-reflective, slightly tinted
                               transmission, a per-pane normal jitter so the reflections break
                               up pane by pane, faint dust; clear shop glass; lit interior
                               behind it
  emissive                     signs and ceiling panels with physically plausible strengths

The scene's own material names are kept, so the web export and the page keep working.
"""
import math, os
from .common import *
from . import assets

TEX_SCALE = {   # metres covered by one repeat of the texture set
    "tex.concrete": 2.5, "tex.plaster": 2.0, "tex.asphalt": 6.0, "tex.pavers": 2.0, "tex.kerb": 1.5, "tex.grass": 3.0,
    "tex.soil": 3.0, "tex.metal": 1.0, "tex.acp": 1.2, "tex.stone": 1.2, "tex.roof_felt": 2.0, "tex.wood": 1.5, "tex.carpet": 1.0,
}

def _image(path, non_color=False):
    im = bpy.data.images.get(os.path.basename(path)) or bpy.data.images.load(path)
    if non_color: im.colorspace_settings.name = "Non-Color"
    return im

def _box_tex(nt, path, scale, non_color=False):
    """An image texture box-projected from object space at `scale` metres per repeat."""
    tc = N(nt, "ShaderNodeTexCoord"); mp = N(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / scale, 1 / scale, 1 / scale)
    L(nt, tc.outputs["Object"], mp.inputs["Vector"])
    im = N(nt, "ShaderNodeTexImage"); im.image = _image(path, non_color); im.projection = "BOX"; im.projection_blend = 0.25
    L(nt, mp.outputs[0], im.inputs["Vector"]); return im

def _rough_variation(nt, base, spread=0.12, scale=1.8):
    nz = N(nt, "ShaderNodeTexNoise", Scale=scale, Detail=3.0, Roughness=0.5)
    mr = N(nt, "ShaderNodeMapRange", **{"From Min": 0.35, "From Max": 0.65, "To Min": clamp(base - spread, 0.02, 1), "To Max": clamp(base + spread, 0.02, 1)})
    L(nt, nz.outputs["Fac"], mr.inputs["Value"]); return mr.outputs["Result"]

def _dirt(nt, color_socket, strength=0.35, streaks=True):
    """Grime: AO in the corners, rain streaks down the wall, darker at the foot. Returns the dirtied colour socket."""
    ao = N(nt, "ShaderNodeAmbientOcclusion", samples=8, inside=False); ao.inputs["Distance"].default_value = 1.2
    aor = N(nt, "ShaderNodeMapRange", **{"From Min": 0.25, "From Max": 1.0, "To Min": 1 - strength, "To Max": 1.0}); L(nt, ao.outputs["AO"], aor.inputs["Value"])
    mul = N(nt, "ShaderNodeMixRGB", blend_type="MULTIPLY"); mul.inputs["Fac"].default_value = 1.0
    L(nt, color_socket, mul.inputs[1]); L(nt, aor.outputs[0], mul.inputs[2]); out = mul.outputs[0]
    if streaks:
        tc = N(nt, "ShaderNodeTexCoord"); sep = N(nt, "ShaderNodeSeparateXYZ"); L(nt, tc.outputs["Object"], sep.inputs[0])
        # streaks: noise stretched along z, stronger under sills (every 4 m) and near the ground
        mp = N(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (3.0, 3.0, 0.15); L(nt, tc.outputs["Object"], mp.inputs["Vector"])
        nz = N(nt, "ShaderNodeTexNoise", Scale=1.0, Detail=4.0); L(nt, mp.outputs[0], nz.inputs["Vector"])
        st = N(nt, "ShaderNodeMapRange", **{"From Min": 0.55, "From Max": 0.8, "To Min": 1.0, "To Max": 1 - strength * 0.6}); L(nt, nz.outputs["Fac"], st.inputs["Value"])
        base = N(nt, "ShaderNodeMapRange", **{"From Min": 0.0, "From Max": 1.2, "To Min": 1 - strength * 0.5, "To Max": 1.0}); L(nt, sep.outputs["Z"], base.inputs["Value"])
        m2 = N(nt, "ShaderNodeMixRGB", blend_type="MULTIPLY"); m2.inputs["Fac"].default_value = 1.0; L(nt, out, m2.inputs[1]); L(nt, st.outputs[0], m2.inputs[2])
        m3 = N(nt, "ShaderNodeMixRGB", blend_type="MULTIPLY"); m3.inputs["Fac"].default_value = 1.0; L(nt, m2.outputs[0], m3.inputs[1]); L(nt, base.outputs[0], m3.inputs[2])
        out = m3.outputs[0]
    return out

def _bevel_normal(nt, normal_in=None, radius=0.012):
    bv = N(nt, "ShaderNodeBevel", samples=6); bv.inputs["Radius"].default_value = radius
    if normal_in is not None: L(nt, normal_in, bv.inputs["Normal"])
    return bv.outputs["Normal"]

def pbr(name, slot=None, tint=(0.8, 0.8, 0.8), rough=0.6, metal=0.0, dirt=0.3, streaks=True, bevel=0.012, scale=None, bump=0.4, coat=0.0):
    """A surface from a texture set when the slot resolves, else a procedural one in `tint`."""
    m, nt, out = new_material(name)
    maps = assets.texture_maps(assets.resolve(slot)) if slot else {}
    sc = scale or TEX_SCALE.get(slot or "", 2.0)
    b = principled(nt, Metallic=metal, Roughness=rough)
    if coat: set_in(b, "Coat Weight", coat)
    normal = None
    if maps.get("diff"):
        d = _box_tex(nt, maps["diff"], sc)
        tintn = N(nt, "ShaderNodeMixRGB", blend_type="MULTIPLY"); tintn.inputs["Fac"].default_value = 0.6; tintn.inputs[2].default_value = (*tint, 1)
        L(nt, d.outputs["Color"], tintn.inputs[1]); col = tintn.outputs[0]
        if maps.get("rough"):
            r = _box_tex(nt, maps["rough"], sc, True); rv = N(nt, "ShaderNodeMixRGB", blend_type="MULTIPLY"); rv.inputs["Fac"].default_value = 1.0
            L(nt, r.outputs["Color"], rv.inputs[1]); L(nt, _rough_variation(nt, 1.0, 0.25), rv.inputs[2]); L(nt, rv.outputs[0], b.inputs["Roughness"])
        else: L(nt, _rough_variation(nt, rough), b.inputs["Roughness"])
        if maps.get("nor"):
            nm = N(nt, "ShaderNodeNormalMap", Strength=bump * 2); L(nt, _box_tex(nt, maps["nor"], sc, True).outputs["Color"], nm.inputs["Color"]); normal = nm.outputs["Normal"]
        elif maps.get("disp"):
            bp = N(nt, "ShaderNodeBump", Strength=bump, Distance=0.01); L(nt, _box_tex(nt, maps["disp"], sc, True).outputs["Color"], bp.inputs["Height"]); normal = bp.outputs["Normal"]
    else:
        # procedural: base tint, a fine grain and a large patchy variation
        base = N(nt, "ShaderNodeRGB"); base.outputs[0].default_value = (*tint, 1)
        patch = N(nt, "ShaderNodeTexNoise", Scale=0.25, Detail=2.0); pr = N(nt, "ShaderNodeMapRange", **{"From Min": 0.3, "From Max": 0.7, "To Min": 0.9, "To Max": 1.08}); L(nt, patch.outputs["Fac"], pr.inputs["Value"])
        mix = N(nt, "ShaderNodeMixRGB", blend_type="MULTIPLY"); mix.inputs["Fac"].default_value = 1.0; L(nt, base.outputs[0], mix.inputs[1]); L(nt, pr.outputs[0], mix.inputs[2]); col = mix.outputs[0]
        L(nt, _rough_variation(nt, rough), b.inputs["Roughness"])
        if bump:
            gn = N(nt, "ShaderNodeTexNoise", Scale=180.0, Detail=6.0); bp = N(nt, "ShaderNodeBump", Strength=bump * 0.35, Distance=0.004); L(nt, gn.outputs["Fac"], bp.inputs["Height"]); normal = bp.outputs["Normal"]
    if dirt: col = _dirt(nt, col, dirt, streaks)
    L(nt, col, b.inputs["Base Color"])
    if bevel: L(nt, _bevel_normal(nt, normal, bevel), b.inputs["Normal"])
    elif normal is not None: L(nt, normal, b.inputs["Normal"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def panels(name, slot="tex.acp", tint=(0.6, 0.61, 0.62), joint=(0.28, 0.29, 0.3), panel=(1.2, 1.2), joint_w=0.012, rough=0.32, metal=0.6, dirt=0.25):
    """ACP or stone cladding: a texture set under a panel grid with recessed joints (bump) and per-panel tone."""
    m, nt, out = new_material(name)
    tc = N(nt, "ShaderNodeTexCoord"); sep = N(nt, "ShaderNodeSeparateXYZ"); L(nt, tc.outputs["Object"], sep.inputs[0])
    hz = N(nt, "ShaderNodeMath", operation="ADD"); L(nt, sep.outputs["X"], hz.inputs[0]); L(nt, sep.outputs["Y"], hz.inputs[1])
    uv = N(nt, "ShaderNodeCombineXYZ"); L(nt, hz.outputs[0], uv.inputs["X"]); L(nt, sep.outputs["Z"], uv.inputs["Y"])
    br = N(nt, "ShaderNodeTexBrick", Scale=1.0, **{"Brick Width": panel[0], "Row Height": panel[1], "Mortar Size": joint_w, "Bias": 0.0,
                                                   "Color1": (*tint, 1), "Color2": (*[c * 0.95 for c in tint], 1), "Mortar": (*joint, 1)})
    br.offset = 0.0; br.squash = 1.0; L(nt, uv.outputs[0], br.inputs["Vector"])
    maps = assets.texture_maps(assets.resolve(slot)) if slot else {}
    col = br.outputs["Color"]
    if maps.get("diff"):
        d = _box_tex(nt, maps["diff"], TEX_SCALE.get(slot, 1.2)); mx = N(nt, "ShaderNodeMixRGB", blend_type="OVERLAY"); mx.inputs["Fac"].default_value = 0.35
        L(nt, col, mx.inputs[1]); L(nt, d.outputs["Color"], mx.inputs[2]); col = mx.outputs[0]
    b = principled(nt, Metallic=metal, Roughness=rough)
    L(nt, _rough_variation(nt, rough, 0.08), b.inputs["Roughness"])
    bp = N(nt, "ShaderNodeBump", Strength=0.6, Distance=0.006, invert=True); L(nt, br.outputs["Fac"], bp.inputs["Height"])
    if maps.get("nor"):
        nm = N(nt, "ShaderNodeNormalMap", Strength=0.4); L(nt, _box_tex(nt, maps["nor"], TEX_SCALE.get(slot, 1.2), True).outputs["Color"], nm.inputs["Color"]); L(nt, nm.outputs["Normal"], bp.inputs["Normal"])
    if dirt: col = _dirt(nt, col, dirt)
    L(nt, col, b.inputs["Base Color"]); L(nt, _bevel_normal(nt, bp.outputs["Normal"], 0.01), b.inputs["Normal"])
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def curtain_glass(name, tint=(0.35, 0.5, 0.65), transmission=0.72, pane=(1.5, 4.1), jitter=0.035, dust=0.03):
    """Low-e curtain wall glass. Dark blue-grey tint, strongly reflective at grazing angles (Fresnel, IOR
    1.5), part transmissive so a lit interior reads, and every pane tilted a hair (Voronoi per pane)
    so the sky breaks up across the facade the way it does on real glass."""
    m, nt, out = new_material(name)
    tc = N(nt, "ShaderNodeTexCoord"); mp = N(nt, "ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / pane[0], 1 / pane[0], 1 / pane[1])
    L(nt, tc.outputs["Object"], mp.inputs["Vector"])
    vo = N(nt, "ShaderNodeTexVoronoi", Scale=1.0); vo.feature = "F1"; L(nt, mp.outputs[0], vo.inputs["Vector"])
    sep = N(nt, "ShaderNodeSeparateColor"); L(nt, vo.outputs["Color"], sep.inputs[0])
    cmb = N(nt, "ShaderNodeCombineXYZ")
    for i in range(3):
        mr = N(nt, "ShaderNodeMapRange", **{"From Min": 0, "From Max": 1, "To Min": -jitter, "To Max": jitter}); L(nt, sep.outputs[i], mr.inputs["Value"]); L(nt, mr.outputs[0], cmb.inputs[i])
    geo = N(nt, "ShaderNodeNewGeometry"); add = N(nt, "ShaderNodeVectorMath", operation="ADD"); L(nt, geo.outputs["Normal"], add.inputs[0]); L(nt, cmb.outputs[0], add.inputs[1])
    nrm = N(nt, "ShaderNodeVectorMath", operation="NORMALIZE"); L(nt, add.outputs[0], nrm.inputs[0])
    b = principled(nt, Roughness=0.02, Metallic=0.0, IOR=1.5); set_in(b, "Base Color", (*tint, 1))
    set_in(b, "Transmission Weight", transmission); set_in(b, "Coat Weight", 0.5); set_in(b, "Coat Roughness", 0.02)
    # dust and fingerprints: a touch of roughness that varies
    L(nt, _rough_variation(nt, 0.02 + dust, dust, 0.6), b.inputs["Roughness"])
    L(nt, nrm.outputs[0], b.inputs["Normal"]); L(nt, b.outputs[0], out.inputs["Surface"])
    return m

def clear_glass(name, tint=(0.9, 0.95, 0.95)):
    m, nt, out = new_material(name)
    b = principled(nt, Roughness=0.01, IOR=1.5); set_in(b, "Base Color", (*tint, 1)); set_in(b, "Transmission Weight", 1.0)
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def emissive(name, color, strength, rough=0.4):
    m, nt, out = new_material(name)
    b = principled(nt, Roughness=rough); set_in(b, "Base Color", (*[min(1, c) for c in color], 1))
    set_in(b, "Emission Color", (*color, 1)); set_in(b, "Emission Strength", strength)
    L(nt, b.outputs[0], out.inputs["Surface"]); return m

def interior_card(name, warmth=(1.0, 0.93, 0.8), strength=1.8):
    """What sits behind glass when no interior is modelled: a lit room read, ceiling bright, desks dim,
    varying per bay so the facade is not a wall of equal light."""
    m, nt, out = new_material(name)
    tc = N(nt, "ShaderNodeTexCoord"); sep = N(nt, "ShaderNodeSeparateXYZ"); L(nt, tc.outputs["Object"], sep.inputs[0])
    zf = N(nt, "ShaderNodeMath", operation="FRACT"); zs = N(nt, "ShaderNodeMath", operation="DIVIDE"); zs.inputs[1].default_value = 4.1; L(nt, sep.outputs["Z"], zs.inputs[0]); L(nt, zs.outputs[0], zf.inputs[0])
    ceil = N(nt, "ShaderNodeMapRange", **{"From Min": 0.72, "From Max": 0.9, "To Min": 0.25, "To Max": 1.0}); L(nt, zf.outputs[0], ceil.inputs["Value"])
    bay = N(nt, "ShaderNodeTexWhiteNoise", noise_dimensions="2D"); hz = N(nt, "ShaderNodeMath", operation="ADD"); L(nt, sep.outputs["X"], hz.inputs[0]); L(nt, sep.outputs["Y"], hz.inputs[1])
    fl = N(nt, "ShaderNodeMath", operation="FLOOR"); dv = N(nt, "ShaderNodeMath", operation="DIVIDE"); dv.inputs[1].default_value = 6.0; L(nt, hz.outputs[0], dv.inputs[0]); L(nt, dv.outputs[0], fl.inputs[0])
    cmb = N(nt, "ShaderNodeCombineXYZ"); L(nt, fl.outputs[0], cmb.inputs["X"]); fz = N(nt, "ShaderNodeMath", operation="FLOOR"); L(nt, zs.outputs[0], fz.inputs[0]); L(nt, fz.outputs[0], cmb.inputs["Y"])
    L(nt, cmb.outputs[0], bay.inputs["Vector"])
    on = N(nt, "ShaderNodeMapRange", **{"From Min": 0.25, "From Max": 0.3, "To Min": 0.15, "To Max": 1.0}); L(nt, bay.outputs["Value"], on.inputs["Value"])
    mul = N(nt, "ShaderNodeMath", operation="MULTIPLY"); L(nt, ceil.outputs[0], mul.inputs[0]); L(nt, on.outputs[0], mul.inputs[1])
    s = N(nt, "ShaderNodeMath", operation="MULTIPLY"); s.inputs[1].default_value = strength; L(nt, mul.outputs[0], s.inputs[0])
    em = N(nt, "ShaderNodeEmission"); em.inputs["Color"].default_value = (*warmth, 1); L(nt, s.outputs[0], em.inputs["Strength"])
    L(nt, em.outputs[0], out.inputs["Surface"]); return m

def foliage(name, base=(0.11, 0.2, 0.06), sss=0.2):
    """Leaves: colour varied per instance, translucent, a little subsurface, no bevel."""
    m, nt, out = new_material(name)
    oi = N(nt, "ShaderNodeObjectInfo"); cr = N(nt, "ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = (*[c * 0.65 for c in base], 1); cr.color_ramp.elements[1].color = (*[min(1, c * 1.4) for c in base], 1)
    L(nt, oi.outputs["Random"], cr.inputs["Fac"])
    b = principled(nt, Roughness=0.5); set_in(b, "Subsurface Weight", sss); set_in(b, "Subsurface Radius", (0.2, 0.4, 0.1)); L(nt, cr.outputs["Color"], b.inputs["Base Color"])
    tl = N(nt, "ShaderNodeBsdfTranslucent"); L(nt, cr.outputs["Color"], tl.inputs["Color"])
    mx = N(nt, "ShaderNodeMixShader"); mx.inputs[0].default_value = 0.3; L(nt, b.outputs[0], mx.inputs[1]); L(nt, tl.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs["Surface"]); return m

def asphalt(name, wet=0.0):
    """Road: a texture set (or procedural) with worn lane markings left to the geometry; `wet` 0..1 adds
    puddles (low roughness patches) after rain."""
    m = pbr(name, "tex.asphalt", tint=(0.11, 0.11, 0.115), rough=0.78, dirt=0.2, streaks=False, bevel=0, bump=0.5)
    if wet > 0:
        nt = m.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        pud = N(nt, "ShaderNodeTexNoise", Scale=0.12, Detail=3.0); pr = N(nt, "ShaderNodeMapRange", **{"From Min": 0.5 - 0.1 * wet, "From Max": 0.52, "To Min": 1.0, "To Max": 0.04})
        L(nt, pud.outputs["Fac"], pr.inputs["Value"]); cur = b.inputs["Roughness"].links[0].from_socket if b.inputs["Roughness"].links else None
        mul = N(nt, "ShaderNodeMath", operation="MULTIPLY"); L(nt, pr.outputs[0], mul.inputs[1])
        if cur: L(nt, cur, mul.inputs[0])
        else: mul.inputs[0].default_value = 0.78
        L(nt, mul.outputs[0], b.inputs["Roughness"])
    return m

# ------------------------------------------------------------------ the swap table
# material name (what our builders emit) -> how to finish it
def catalogue(spec):
    wet = float(spec.get("wet", 0.0)); night = spec.get("preset") in ("dusk", "night")
    int_strength = 2.2 if night else 1.2
    C = {
        # ground
        "asphalt": lambda: asphalt("asphalt", wet), "road": lambda: asphalt("asphalt", wet),
        "pavers": lambda: pbr("pavers", "tex.pavers", (0.58, 0.56, 0.52), 0.72, dirt=0.3, streaks=False, bevel=0.0, bump=0.7),
        "foot": lambda: pbr("pavers", "tex.pavers", (0.58, 0.56, 0.52), 0.72, dirt=0.3, streaks=False, bevel=0.0, bump=0.7),
        "kerb": lambda: pbr("kerb", "tex.kerb", (0.6, 0.59, 0.56), 0.8, dirt=0.4, streaks=False, bevel=0.015),
        "marking": lambda: pbr("marking", None, (0.85, 0.85, 0.8), 0.55, dirt=0.4, streaks=False, bevel=0.0, bump=0.3),
        "concrete": lambda: pbr("concrete", "tex.concrete", (0.55, 0.54, 0.51), 0.85, dirt=0.4, bevel=0.015, bump=0.5),
        "slab": lambda: pbr("slab", "tex.concrete", (0.5, 0.5, 0.48), 0.8, dirt=0.3, bevel=0.012),
        "slab_edge": lambda: pbr("slab_edge", "tex.concrete", (0.72, 0.71, 0.68), 0.7, dirt=0.3, bevel=0.012),
        "parapet": lambda: pbr("parapet", "tex.plaster", (0.74, 0.72, 0.66), 0.85, dirt=0.4, bevel=0.012),
        "ground": lambda: pbr("ground", "tex.soil", (0.5, 0.44, 0.35), 0.95, dirt=0.1, streaks=False, bevel=0.0, bump=0.6),
        "soil": lambda: pbr("soil", "tex.soil", (0.42, 0.36, 0.28), 0.95, dirt=0.0, streaks=False, bevel=0.0, bump=0.6),
        "lawn": lambda: pbr("lawn", "tex.grass", (0.2, 0.33, 0.1), 0.9, dirt=0.0, streaks=False, bevel=0.0, bump=0.5),
        "grass": lambda: pbr("grass", "tex.grass", (0.2, 0.33, 0.1), 0.9, dirt=0.0, streaks=False, bevel=0.0, bump=0.5),
        "green": lambda: pbr("green", "tex.grass", (0.22, 0.35, 0.11), 0.9, dirt=0.0, streaks=False, bevel=0.0, bump=0.5),
        "water": lambda: pbr("water", None, (0.08, 0.14, 0.15), 0.04, dirt=0.0, streaks=False, bevel=0.0, bump=0.1),
        "city_ground": lambda: pbr("city_ground", "tex.soil", (0.55, 0.47, 0.36), 0.95, dirt=0.0, streaks=False, bevel=0.0, bump=0.4),
        "city_water": lambda: pbr("city_water", None, (0.1, 0.17, 0.19), 0.05, dirt=0.0, streaks=False, bevel=0.0, bump=0.1),
        # cladding and structure
        "acp_light": lambda: panels("acp_light", "tex.acp", (0.6, 0.61, 0.62), (0.3, 0.31, 0.32)),
        "acp_tile": lambda: panels("acp_tile", "tex.acp", (0.68, 0.69, 0.7), (0.36, 0.37, 0.38), panel=(0.6, 0.6), joint_w=0.02),
        "acp_grey": lambda: panels("acp_grey", "tex.acp", (0.55, 0.57, 0.58), (0.3, 0.3, 0.31)),
        "acp_red": lambda: panels("acp_red", "tex.acp", (0.58, 0.14, 0.12), (0.3, 0.08, 0.07)),
        "acp_white": lambda: panels("acp_white", "tex.acp", (0.86, 0.86, 0.84), (0.5, 0.5, 0.5)),
        "band_light": lambda: panels("band_light", "tex.acp", (0.42, 0.43, 0.44), (0.25, 0.25, 0.26), panel=(1.2, 3.4)),
        "band_723": lambda: panels("band_723", "tex.acp", (0.7, 0.71, 0.72), (0.4, 0.4, 0.41), panel=(1.2, 3.4)),
        "charcoal": lambda: panels("charcoal", "tex.acp", (0.06, 0.065, 0.07), (0.02, 0.02, 0.02), rough=0.38, metal=0.5),
        "pier": lambda: pbr("pier", None, (0.035, 0.037, 0.04), 0.42, 0.6, dirt=0.15, bevel=0.012),
        "pier_723": lambda: pbr("pier_723", None, (0.04, 0.045, 0.05), 0.45, 0.4, dirt=0.15, bevel=0.012),
        "fin": lambda: pbr("fin", "tex.metal", (0.07, 0.075, 0.08), 0.35, 0.85, dirt=0.1, streaks=False, bevel=0.006),
        "fin_723": lambda: pbr("fin_723", "tex.metal", (0.12, 0.14, 0.17), 0.42, 0.7, dirt=0.1, streaks=False, bevel=0.006),
        "fin_white": lambda: pbr("fin_white", None, (0.9, 0.9, 0.88), 0.45, 0.1, dirt=0.15, streaks=False, bevel=0.006),
        "frame": lambda: pbr("frame", "tex.metal", (0.62, 0.63, 0.63), 0.35, 0.7, dirt=0.1, streaks=False, bevel=0.008),
        "frame_723": lambda: pbr("frame_723", "tex.metal", (0.8, 0.81, 0.81), 0.35, 0.7, dirt=0.1, streaks=False, bevel=0.008),
        "white_frame": lambda: panels("white_frame", "tex.acp", (0.84, 0.84, 0.82), (0.6, 0.6, 0.6), panel=(1.5, 1.5), rough=0.3, metal=0.35, dirt=0.2),
        "mullion": lambda: pbr("mullion", "tex.metal", (0.05, 0.055, 0.06), 0.35, 0.85, dirt=0.0, streaks=False, bevel=0.004),
        "metal": lambda: pbr("metal", "tex.metal", (0.6, 0.62, 0.64), 0.35, 0.9, dirt=0.1, streaks=False, bevel=0.006),
        "bronze": lambda: pbr("bronze", "tex.metal", (0.3, 0.19, 0.09), 0.38, 0.75, dirt=0.1, streaks=False, bevel=0.008, coat=0.2),
        "maroon": lambda: panels("maroon", "tex.acp", (0.3, 0.07, 0.05), (0.15, 0.04, 0.03), rough=0.45, metal=0.3),
        "canopy": lambda: pbr("canopy", None, (0.17, 0.18, 0.19), 0.4, 0.6, dirt=0.1, bevel=0.01),
        "roof": lambda: pbr("roof", "tex.roof_felt", (0.35, 0.35, 0.34), 0.9, dirt=0.3, streaks=False, bevel=0.0, bump=0.6),
        "station_roof": lambda: pbr("station_roof", "tex.metal", (0.78, 0.8, 0.82), 0.3, 0.8, dirt=0.2, bevel=0.01),
        "trunk": lambda: pbr("trunk", None, (0.27, 0.22, 0.17), 0.9, dirt=0.0, streaks=False, bevel=0.0, bump=0.9),
        "core": lambda: pbr("core", "tex.plaster", (0.62, 0.61, 0.58), 0.85, dirt=0.15, bevel=0.01),
        "interior": lambda: pbr("interior", "tex.carpet", (0.16, 0.16, 0.16), 0.9, dirt=0.0, streaks=False, bevel=0.0, bump=0.3),
        "carpet": lambda: pbr("carpet", "tex.carpet", (0.16, 0.17, 0.18), 0.95, dirt=0.0, streaks=False, bevel=0.0, bump=0.3),
        "ceiling": lambda: pbr("ceiling", None, (0.82, 0.82, 0.8), 0.9, dirt=0.05, streaks=False, bevel=0.0, bump=0.1),
        "desk": lambda: pbr("desk", "tex.wood", (0.78, 0.7, 0.58), 0.45, dirt=0.0, streaks=False, bevel=0.004),
        "deskleg": lambda: pbr("deskleg", "tex.metal", (0.85, 0.85, 0.84), 0.4, 0.6, dirt=0.0, streaks=False, bevel=0.003),
        "chair": lambda: pbr("chair", None, (0.05, 0.05, 0.055), 0.6, 0.1, dirt=0.0, streaks=False, bevel=0.004),
        "bg_white": lambda: pbr("bg_white", "tex.plaster", (0.72, 0.71, 0.67), 0.85, dirt=0.35, bevel=0.0),
        # glass
        "glass": lambda: curtain_glass("glass", (0.2, 0.28, 0.36), 0.55), "glass_dark": lambda: curtain_glass("glass_dark", (0.12, 0.16, 0.2), 0.5),
        "glass_blue": lambda: curtain_glass("glass_blue", (0.35, 0.52, 0.72), 0.8), "glass_lobby": lambda: curtain_glass("glass_lobby", (0.6, 0.72, 0.78), 0.9, jitter=0.01),
        "station_glass": lambda: curtain_glass("station_glass", (0.55, 0.7, 0.78), 0.85, jitter=0.01), "car_glass": lambda: curtain_glass("car_glass", (0.1, 0.12, 0.14), 0.4, jitter=0.0),
        "shopglass": lambda: clear_glass("shopglass"), "train_win": lambda: curtain_glass("train_win", (0.1, 0.13, 0.17), 0.4, jitter=0.0),
        # light
        "shop": lambda: interior_card("shop", (1.0, 0.86, 0.66), int_strength * 1.6), "ceiling_led": lambda: emissive("ceiling_led", (1.0, 0.96, 0.9), 6.0 if night else 3.0),
        "panel_led": lambda: emissive("panel_led", (1.0, 0.96, 0.9), 6.0 if night else 3.0), "screen": lambda: emissive("screen", (0.35, 0.5, 0.8), 1.5),
        "sign": lambda: emissive("sign", (0.98, 0.98, 0.96), 3.0 if night else 1.2), "sign_white": lambda: emissive("sign_white", (0.98, 0.98, 0.96), 4.0 if night else 1.6),
        "sign_text": lambda: emissive("sign_text", (0.98, 0.98, 0.96), 4.0 if night else 1.6), "opt_name": lambda: emissive("opt_name", (1.0, 0.95, 0.85), 3.0 if night else 1.0),
        "sign_orange": lambda: emissive("sign_orange", (1.0, 0.45, 0.05), 5.0 if night else 2.0), "lamp_head": lambda: emissive("lamp_head", (1.0, 0.85, 0.6), 12.0 if night else 0.0),
        "lamp_front": lambda: emissive("lamp_front", (1.0, 0.95, 0.85), 8.0 if night else 0.3), "lamp_rear": lambda: emissive("lamp_rear", (0.9, 0.05, 0.03), 4.0 if night else 0.5),
        # foliage
        "leaf": lambda: foliage("leaf", (0.11, 0.2, 0.06)), "leaf_b": lambda: foliage("leaf_b", (0.14, 0.22, 0.07)), "palm": lambda: foliage("palm", (0.16, 0.26, 0.07), 0.1),
        "hedge": lambda: foliage("hedge", (0.09, 0.18, 0.05)), "frond": lambda: foliage("frond", (0.16, 0.26, 0.07), 0.1),
    }
    return C

KEEP = ("interior_card", "av_")   # materials we made ourselves

def upgrade(spec):
    """Swap every known material in the scene for its finished version; unknown ones get a bevel and roughness variation."""
    cat = catalogue(spec); made = {}; swapped = 0; touched = 0
    for o in list(bpy.data.objects):
        if o.type not in ("MESH", "CURVE", "FONT"): continue
        for slot in o.material_slots:
            m = slot.material
            if m is None: continue
            key = m.name.split(".")[0]
            if key.startswith(KEEP): continue
            if key in cat:
                if key not in made: made[key] = cat[key](); made[key].name = "av_" + key
                slot.material = made[key]; swapped += 1
            elif m.use_nodes and not key.startswith("av_"):
                # unknown: keep its look, add micro-roughness variation and a bevel
                nt = m.node_tree; b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
                if b and not b.inputs["Normal"].links and not b.inputs["Roughness"].links:
                    L(nt, _rough_variation(nt, b.inputs["Roughness"].default_value, 0.08), b.inputs["Roughness"])
                    L(nt, _bevel_normal(nt, None, 0.01), b.inputs["Normal"]); touched += 1
    log(f"materials: {swapped} slots swapped to {len(made)} finished materials, {touched} others given bevel and roughness variation")
    return made
