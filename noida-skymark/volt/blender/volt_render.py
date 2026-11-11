"""Volt, first floor, Skymark F-1: build the whole floor in Blender from the CAD
layout and render every room, as a still and as a 360 degree panorama.

Run it with Blender (4.2 or newer), no clicking needed:

    /Applications/Blender.app/Contents/MacOS/Blender -b -P volt_render.py -- --out renders

Everything is placed from volt-floor1.layout.json, which was read out of the
client's DWG: walls, glass, doors, columns, desks, tables, every chair, the
planters and the ceiling lights. Heights and finishes are not in a 2D drawing:
heights are standard fit-out sizes and finishes follow the design deck's mood
board. Cameras come from cameras.json (made from the same layout).

Options (after the --):
    --out DIR        where the pictures go (default: renders, next to this file)
    --what LIST      stills, panos, or both: "stills,panos" (default)
    --rooms LIST     only these rooms, by slug, comma separated (default: all)
    --quality Q      preview | normal | high   (default: normal)
    --samples N      override the sample count
    --device D       auto | gpu | cpu          (default: auto, the GPU if there is one)
    --sun-az DEG     where the sun is, as a compass bearing (default 100, a morning sun)
    --sun-el DEG     how high the sun is (default 26)
    --exposure EV    brighter or darker (default 0.6)
    --sky S          strength of the daylight sky (default 0.35)
    --sun S          strength of the sun (default 22)
    --cameras FILE   use another camera list instead of cameras.json (same shape)
    --res-scale K    render at K times the size, for a quick look (default 1)
    --no-post        skip the finishing step (see below) and keep the plain render
    --no-render      build and save the .blend only
Pictures that already exist are skipped, so a stopped run can be started again.

What makes the picture read as a photograph (all of it is in this file):
  - every hard edge is bevelled, with weighted normals so the flat faces stay flat;
  - roughness varies across every surface, walls are scuffed low down;
  - light is a physical sky and a sun through the facade windows (with light
    portals), plus the ceiling lights at 4000 K; the camera is white balanced
    at 4500 K, so lamps read slightly warm and daylight slightly cool;
  - the camera has depth of field (f/8, seven blades);
  - after the denoised render, a small finishing step in numpy: a faint glow
    round the lights, a touch of chromatic aberration, a slight softening, a
    light vignette and fine grain.
Assumed, not from the CAD: all heights, all finishes, the lamp colour, the
linear pendant lights (from the deck), and the small things left on desks
(mugs, notebooks, bottles, a few bags). Positions and counts of walls, glass,
doors, furniture, planters and ceiling lights are from the CAD and are not moved.
"""
import bpy, bmesh, json, math, os, random, sys, time, argparse
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default=os.path.join(HERE, "renders")); ap.add_argument("--what", default="stills,panos")
ap.add_argument("--rooms", default=""); ap.add_argument("--quality", default="normal", choices=["preview", "normal", "high"])
ap.add_argument("--samples", type=int, default=0); ap.add_argument("--device", default="auto")
ap.add_argument("--sun-az", type=float, default=100.0); ap.add_argument("--sun-el", type=float, default=26.0)
ap.add_argument("--exposure", type=float, default=0.6); ap.add_argument("--no-render", action="store_true")
ap.add_argument("--sky", type=float, default=0.35); ap.add_argument("--sun", type=float, default=22.0)
ap.add_argument("--cameras", default=os.path.join(HERE, "cameras.json")); ap.add_argument("--res-scale", type=float, default=1.0)
ap.add_argument("--no-post", action="store_true")
A = ap.parse_args(argv)
OUT = os.path.abspath(A.out); os.makedirs(os.path.join(OUT, "stills"), exist_ok=True); os.makedirs(os.path.join(OUT, "panos"), exist_ok=True)
Q = {"preview": dict(samples=24, still=(1280, 720), pano=(2048, 1024)),
     "normal": dict(samples=128, still=(1920, 1080), pano=(4096, 2048)),
     "high": dict(samples=256, still=(2560, 1440), pano=(6000, 3000))}[A.quality]
if A.samples: Q["samples"] = A.samples
random.seed(7)
L = json.load(open(os.path.join(HERE, "volt-floor1.layout.json")))
CAMS = json.load(open(A.cameras))
H = L["heights"]["ceiling"]

bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene
COL = bpy.data.collections.new("Volt"); SC.collection.children.link(COL)

# ------------------------------------------------------------------ colours and materials
def lin(hexs):
    hexs = hexs.lstrip("#"); c = [int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
def kelvin(t):
    """Blackbody colour of a colour temperature in kelvin, as linear RGB (Tanner Helland's fit)."""
    t = t / 100.0
    r = 255.0 if t <= 66 else 329.698727446 * (t - 60) ** -0.1332047592
    g = 99.4708025861 * math.log(t) - 161.1195681661 if t <= 66 else 288.1221695283 * (t - 60) ** -0.0755148492
    b = 255.0 if t >= 66 else (0.0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    c = [min(255.0, max(0.0, v)) / 255 for v in (r, g, b)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
WB_K = 4500.0      # assumed: the camera's white balance, between the 4000 K lamps and daylight
LAMP_K = 4000.0    # assumed: neutral white office lamps
SUN_K = 5200.0     # a morning sun
def light_col(t, amount=1.0):
    """What a light of temperature t looks like to a camera balanced at WB_K. amount below 1 pulls it towards white."""
    c = kelvin(t); w = kelvin(WB_K); v = [a / b for a, b in zip(c, w)]; m = max(v); v = [a / m for a in v]
    return tuple(1 + (a - 1) * amount for a in v)
def setin(node, names, v):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = v; return True
    return False
MATS = {}
def pbr(name, color, rough=0.5, metal=0.0, trans=0.0, coat=0.0, sheen=0.0, alpha=1.0, emit=None, emit_strength=0.0, ior=1.45, vary=0.2, vscale=2.5):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    col = lin(color) if isinstance(color, str) else color
    setin(b, ["Base Color"], (*col, 1)); setin(b, ["Roughness"], rough); setin(b, ["Metallic"], metal); setin(b, ["IOR"], ior)
    if trans: setin(b, ["Transmission Weight", "Transmission"], trans)
    if coat: setin(b, ["Coat Weight", "Clearcoat"], coat)
    if sheen: setin(b, ["Sheen Weight", "Sheen"], sheen)
    if alpha < 1: setin(b, ["Alpha"], alpha)
    if emit: setin(b, ["Emission Color", "Emission"], (*(lin(emit) if isinstance(emit, str) else emit), 1)); setin(b, ["Emission Strength"], emit_strength)
    if vary and not emit: rough_vary(nt, b, rough, vary, vscale)
    MATS[name] = m; return m, nt, b
def rough_vary(nt, b, rough, vary, vscale):
    """No real surface has one roughness. Soft patches a hand or a cloth wide, plus a fine grain, move it up and down."""
    g = N(nt, "ShaderNodeNewGeometry", (-900, -520))
    n1 = N(nt, "ShaderNodeTexNoise", (-720, -520)); n1.inputs["Scale"].default_value = vscale; n1.inputs["Detail"].default_value = 4.0
    n2 = N(nt, "ShaderNodeTexNoise", (-720, -760)); n2.inputs["Scale"].default_value = vscale * 24; n2.inputs["Detail"].default_value = 2.0
    nt.links.new(g.outputs["Position"], n1.inputs["Vector"]); nt.links.new(g.outputs["Position"], n2.inputs["Vector"])
    mx = N(nt, "ShaderNodeMath", (-540, -600), operation="MULTIPLY_ADD"); mx.inputs[1].default_value = 0.4
    nt.links.new(n2.outputs["Fac"], mx.inputs[0]); nt.links.new(n1.outputs["Fac"], mx.inputs[2])
    mr = N(nt, "ShaderNodeMapRange", (-360, -600)); mr.inputs["From Min"].default_value = 0.45; mr.inputs["From Max"].default_value = 0.95
    lo, hi = (rough * (1 - vary), min(1.0, rough * (1 + vary))) if rough > 0.06 else (rough, rough + 0.035)
    mr.inputs["To Min"].default_value = lo; mr.inputs["To Max"].default_value = hi
    nt.links.new(mx.outputs[0], mr.inputs["Value"]); nt.links.new(mr.outputs[0], b.inputs["Roughness"])
def N(nt, kind, loc=(0, 0), **props):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in props.items(): setattr(n, k, v)
    return n
def world_coords(nt, scale):
    g = N(nt, "ShaderNodeNewGeometry", (-900, 0)); mp = N(nt, "ShaderNodeMapping", (-720, 0)); mp.inputs["Scale"].default_value = scale
    nt.links.new(g.outputs["Position"], mp.inputs["Vector"]); return mp
def ramp(nt, stops, loc):
    r = N(nt, "ShaderNodeValToRGB", loc); e = r.color_ramp.elements
    while len(e) < len(stops): e.new(0.5)
    for el, (p, c) in zip(e, stops): el.position = p; el.color = (*lin(c), 1)
    return r
def bump(nt, b, height_socket, strength, distance=0.002):
    bp = N(nt, "ShaderNodeBump", (-200, -300)); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = distance
    nt.links.new(height_socket, bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])

def mat_carpet():
    m, nt, b = pbr("carpet", "#45423f", rough=0.95, sheen=0.3)
    # tile-to-tile tone
    mpt = world_coords(nt, (2.0, 2.0, 1.0)); br = N(nt, "ShaderNodeTexBrick", (-560, 320)); br.offset = 0.5
    br.inputs["Scale"].default_value = 1.0; br.inputs["Mortar Size"].default_value = 0.004; br.inputs["Brick Width"].default_value = 1.0; br.inputs["Row Height"].default_value = 1.0; br.inputs["Bias"].default_value = -0.2
    br.inputs["Color1"].default_value = (0.0, 0.0, 0.0, 1); br.inputs["Color2"].default_value = (1.0, 1.0, 1.0, 1); br.inputs["Mortar"].default_value = (0.0, 0.0, 0.0, 1)
    nt.links.new(mpt.outputs["Vector"], br.inputs["Vector"])
    # streaks along the tile
    mp = world_coords(nt, (2.5, 70.0, 30.0)); n1 = N(nt, "ShaderNodeTexNoise", (-560, 80)); n1.inputs["Scale"].default_value = 6.0; n1.inputs["Detail"].default_value = 7.0
    nt.links.new(mp.outputs["Vector"], n1.inputs["Vector"])
    mp2 = world_coords(nt, (0.5, 0.5, 0.5)); n2 = N(nt, "ShaderNodeTexNoise", (-560, -160)); n2.inputs["Scale"].default_value = 1.0
    nt.links.new(mp2.outputs["Vector"], n2.inputs["Vector"])
    a1 = N(nt, "ShaderNodeMath", (-380, 120), operation="MULTIPLY_ADD"); a1.inputs[1].default_value = 0.7; nt.links.new(n1.outputs["Fac"], a1.inputs[0]); nt.links.new(n2.outputs["Fac"], a1.inputs[2])
    sep = N(nt, "ShaderNodeSeparateColor", (-380, 320)) if hasattr(bpy.types, "ShaderNodeSeparateColor") else N(nt, "ShaderNodeSeparateRGB", (-380, 320))
    nt.links.new(br.outputs["Color"], sep.inputs[0])
    a2 = N(nt, "ShaderNodeMath", (-240, 200), operation="MULTIPLY_ADD"); a2.inputs[1].default_value = 0.22; nt.links.new(sep.outputs[0], a2.inputs[0]); nt.links.new(a1.outputs[0], a2.inputs[2])
    r = ramp(nt, [(0.42, "#1d1c1c"), (0.62, "#2e2d2c"), (0.8, "#413f3d"), (0.95, "#5c5853")], (-80, 100))
    nt.links.new(a2.outputs[0], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    mp3 = world_coords(nt, (700, 700, 700)); n3 = N(nt, "ShaderNodeTexNoise", (-560, -400)); n3.inputs["Scale"].default_value = 1.0
    nt.links.new(mp3.outputs["Vector"], n3.inputs["Vector"]); bump(nt, b, n3.outputs["Fac"], 0.6, 0.003)
def mat_wood(name, light, mid, dark, rough=0.42, coat=0.15, scale=(1.2, 14.0, 14.0)):
    m, nt, b = pbr(name, mid, rough=rough, coat=coat)
    mp = world_coords(nt, scale); w = N(nt, "ShaderNodeTexNoise", (-520, 0)); w.inputs["Scale"].default_value = 3.0; w.inputs["Detail"].default_value = 8.0; w.inputs["Roughness"].default_value = 0.65
    nt.links.new(mp.outputs["Vector"], w.inputs["Vector"])
    r = ramp(nt, [(0.3, dark), (0.5, mid), (0.72, light)], (-200, 0)); nt.links.new(w.outputs["Fac"], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    bump(nt, b, w.outputs["Fac"], 0.08, 0.001)
def mat_fabric(name, color, rough=0.9):
    m, nt, b = pbr(name, color, rough=rough, sheen=0.5)
    mp = world_coords(nt, (900, 900, 900)); n = N(nt, "ShaderNodeTexNoise", (-520, 0)); n.inputs["Scale"].default_value = 1.0
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"]); bump(nt, b, n.outputs["Fac"], 0.5, 0.002)
def mat_paint(name, color, rough=0.85, scuff=0.0):
    m, nt, b = pbr(name, color, rough=rough)
    mp = world_coords(nt, (250, 250, 250)); n = N(nt, "ShaderNodeTexNoise", (-520, 0)); n.inputs["Scale"].default_value = 1.0
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"]); bump(nt, b, n.outputs["Fac"], 0.12, 0.001)
    if not scuff: return
    # a painted wall is never one flat colour: it is a touch uneven all over, and scuffed below knee height
    g = N(nt, "ShaderNodeNewGeometry", (-900, 400)); sx = N(nt, "ShaderNodeSeparateXYZ", (-720, 520)); nt.links.new(g.outputs["Position"], sx.inputs[0])
    low = N(nt, "ShaderNodeMapRange", (-540, 520)); low.inputs["From Min"].default_value = 0.09; low.inputs["From Max"].default_value = 0.55; low.inputs["To Min"].default_value = 1.0; low.inputs["To Max"].default_value = 0.0
    nt.links.new(sx.outputs["Z"], low.inputs["Value"])
    n1 = N(nt, "ShaderNodeTexNoise", (-720, 300)); n1.inputs["Scale"].default_value = 5.0; n1.inputs["Detail"].default_value = 6.0; nt.links.new(g.outputs["Position"], n1.inputs["Vector"])
    n2 = N(nt, "ShaderNodeTexNoise", (-720, 120)); n2.inputs["Scale"].default_value = 0.7; n2.inputs["Detail"].default_value = 3.0; nt.links.new(g.outputs["Position"], n2.inputs["Vector"])
    patch = N(nt, "ShaderNodeMapRange", (-540, 300)); patch.inputs["From Min"].default_value = 0.42; patch.inputs["From Max"].default_value = 0.75; nt.links.new(n1.outputs["Fac"], patch.inputs["Value"])
    m1 = N(nt, "ShaderNodeMath", (-360, 420), operation="MULTIPLY"); nt.links.new(low.outputs[0], m1.inputs[0]); nt.links.new(patch.outputs[0], m1.inputs[1])
    m2 = N(nt, "ShaderNodeMath", (-200, 420), operation="MULTIPLY_ADD"); m2.inputs[1].default_value = -scuff; m2.inputs[2].default_value = 1.0; nt.links.new(m1.outputs[0], m2.inputs[0])
    m3 = N(nt, "ShaderNodeMath", (-200, 240), operation="MULTIPLY_ADD"); m3.inputs[1].default_value = -0.07; nt.links.new(n2.outputs["Fac"], m3.inputs[0]); nt.links.new(m2.outputs[0], m3.inputs[2])
    rgb = N(nt, "ShaderNodeRGB", (-200, 600)); rgb.outputs[0].default_value = (*lin(color), 1)
    sc = N(nt, "ShaderNodeVectorMath", (-40, 420), operation="SCALE"); nt.links.new(rgb.outputs[0], sc.inputs[0]); nt.links.new(m3.outputs[0], sc.inputs["Scale"])
    nt.links.new(sc.outputs[0], b.inputs["Base Color"])
def mat_ceiling():
    pbr("gypsum", "#e9e6e0", rough=0.95)
    m, nt, b = pbr("ceiling", "#eceae5", rough=0.95)
    mp = world_coords(nt, (1 / 0.6, 1 / 0.6, 1)); br = N(nt, "ShaderNodeTexBrick", (-520, 0))
    br.offset = 0.0; br.inputs["Scale"].default_value = 1.0; br.inputs["Mortar Size"].default_value = 0.012; br.inputs["Brick Width"].default_value = 1.0; br.inputs["Row Height"].default_value = 1.0
    br.inputs["Color1"].default_value = (*lin("#eceae5"), 1); br.inputs["Color2"].default_value = (*lin("#e6e3dd"), 1); br.inputs["Mortar"].default_value = (*lin("#bdb9b2"), 1)
    nt.links.new(mp.outputs["Vector"], br.inputs["Vector"]); nt.links.new(br.outputs["Color"], b.inputs["Base Color"]); bump(nt, b, br.outputs["Fac"], -0.4, 0.004)
def mat_glass(name, tint="#eef5f4"):
    m, nt, b = pbr(name, tint, rough=0.0, trans=1.0)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"); lp = N(nt, "ShaderNodeLightPath", (0, 300)); tr = N(nt, "ShaderNodeBsdfTransparent", (0, 150)); mx = N(nt, "ShaderNodeMixShader", (250, 200))
    tr.inputs["Color"].default_value = (0.92, 0.96, 0.95, 1)
    nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs["Fac"]); nt.links.new(b.outputs["BSDF"], mx.inputs[1]); nt.links.new(tr.outputs["BSDF"], mx.inputs[2]); nt.links.new(mx.outputs["Shader"], out.inputs["Surface"])
def mat_leaf():
    """A thin leaf: light passes through it, the midrib and side veins are paler and sit in a groove, every leaf is its
    own green. u runs across the leaf and v along it (UV map "UVMap"); the second map "id" holds a random number per leaf."""
    m, nt, b = pbr("leaf", "#2f6a2c", rough=0.36, coat=0.12, vary=0.3, vscale=30.0)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    uv = N(nt, "ShaderNodeUVMap", (-1500, 200)); uv.uv_map = "UVMap"; s1 = N(nt, "ShaderNodeSeparateXYZ", (-1320, 200)); nt.links.new(uv.outputs[0], s1.inputs[0])
    idn = N(nt, "ShaderNodeUVMap", (-1500, -100)); idn.uv_map = "id"; s2 = N(nt, "ShaderNodeSeparateXYZ", (-1320, -100)); nt.links.new(idn.outputs[0], s2.inputs[0])
    def math_(op, a, b_=None, c=None, loc=(0, 0)):
        n = N(nt, "ShaderNodeMath", loc, operation=op)
        for k, v in enumerate((a, b_, c)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[k].default_value = v
            else: nt.links.new(v, n.inputs[k])
        return n.outputs[0]
    def mrange(v, a, b_, c, d, loc=(0, 0)):
        n = N(nt, "ShaderNodeMapRange", loc); n.interpolation_type = "SMOOTHSTEP"
        n.inputs["From Min"].default_value = a; n.inputs["From Max"].default_value = b_; n.inputs["To Min"].default_value = c; n.inputs["To Max"].default_value = d
        nt.links.new(v, n.inputs["Value"]); return n.outputs[0]
    du = math_("ABSOLUTE", math_("MULTIPLY_ADD", s1.outputs["X"], 2.0, -1.0, (-1140, 260)), loc=(-980, 260))       # 0 on the midrib, 1 at the edge
    midrib = mrange(du, 0.0, 0.11, 1.0, 0.0, (-800, 320))
    phase = math_("MULTIPLY_ADD", s1.outputs["Y"], 15.0, math_("MULTIPLY", du, -4.5, loc=(-980, 80)), (-800, 120))  # side veins sweep towards the tip
    vein = math_("MULTIPLY", mrange(math_("SINE", math_("MULTIPLY", phase, 6.2832, loc=(-640, 120)), loc=(-480, 120)), 0.80, 1.0, 0.0, 1.0, (-320, 120)),
                 math_("MULTIPLY_ADD", du, -0.7, 1.0, (-480, -40)), loc=(-160, 120))
    g = N(nt, "ShaderNodeNewGeometry", (-1500, -400)); nz = N(nt, "ShaderNodeTexNoise", (-1320, -400)); nz.inputs["Scale"].default_value = 14.0; nz.inputs["Detail"].default_value = 3.0
    nt.links.new(g.outputs["Position"], nz.inputs["Vector"])
    tone = math_("MULTIPLY_ADD", nz.outputs["Fac"], 0.35, math_("MULTIPLY", s2.outputs["X"], 0.75, loc=(-1140, -160)), (-980, -200))
    r = ramp(nt, [(0.08, "#1c4a20"), (0.4, "#2c6427"), (0.7, "#41802f"), (1.0, "#63973a")], (-800, -200)); nt.links.new(tone, r.inputs["Fac"])
    pale = math_("MAXIMUM", math_("MULTIPLY", midrib, 0.6, loc=(-640, 320)), math_("MULTIPLY", vein, 0.22, loc=(0, 120)), loc=(160, 240))
    stalk = mrange(s1.outputs["Y"], 0.0, 0.03, 1.0, 0.0, (-800, 480)); pale2 = math_("MAXIMUM", pale, math_("MULTIPLY", stalk, 0.75, loc=(-640, 480)), loc=(320, 300))
    mixc = N(nt, "ShaderNodeMix", (480, 200)); mixc.data_type = "RGBA"; nt.links.new(pale2, mixc.inputs[0]); nt.links.new(r.outputs["Color"], mixc.inputs[6]); mixc.inputs[7].default_value = (*lin("#a9c46a"), 1)
    nt.links.new(mixc.outputs[2], b.inputs["Base Color"])
    hgt = math_("MULTIPLY_ADD", midrib, -1.0, math_("MULTIPLY", vein, -0.45, loc=(160, 0)), (320, 0)); bump(nt, b, hgt, 0.35, 0.0012)
    tr = N(nt, "ShaderNodeBsdfTranslucent", (700, 60)); sc = N(nt, "ShaderNodeVectorMath", (560, 0), operation="MULTIPLY"); sc.inputs[1].default_value = (1.5, 1.9, 0.7)
    nt.links.new(mixc.outputs[2], sc.inputs[0]); nt.links.new(sc.outputs[0], tr.inputs["Color"])
    ms = N(nt, "ShaderNodeMixShader", (900, 200)); ms.inputs[0].default_value = 0.3      # how much light the leaf lets through
    nt.links.new(b.outputs["BSDF"], ms.inputs[1]); nt.links.new(tr.outputs["BSDF"], ms.inputs[2]); nt.links.new(ms.outputs["Shader"], out.inputs["Surface"])
def mat_screen():
    """A monitor that is switched on: a soft abstract wallpaper as a dim emission, under glass with fingerprints."""
    m, nt, b = pbr("screen_glass", "#050506", rough=0.16, coat=0.6, vary=0.45, vscale=9.0)
    tc = N(nt, "ShaderNodeTexCoord", (-900, 300)); mp = N(nt, "ShaderNodeMapping", (-720, 300)); mp.inputs["Scale"].default_value = (1.6, 1.0, 2.4); nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nz = N(nt, "ShaderNodeTexNoise", (-540, 300)); nz.inputs["Scale"].default_value = 1.6; nz.inputs["Detail"].default_value = 1.0; nz.inputs["Distortion"].default_value = 1.2; nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    r = ramp(nt, [(0.3, "#14253a"), (0.48, "#2c5566"), (0.64, "#cfd6d8"), (0.8, "#c98a4a")], (-340, 300)); nt.links.new(nz.outputs["Fac"], r.inputs["Fac"])
    for nm in ("Emission Color", "Emission"):
        if nm in b.inputs: nt.links.new(r.outputs["Color"], b.inputs[nm]); break
    setin(b, ["Emission Strength"], 0.7)

mat_carpet()
mat_wood("oak", "#e6d2b3", "#d8bf9b", "#c7a983")
mat_wood("oak_floor", "#e2ccab", "#d2b790", "#bd9e78", rough=0.35, coat=0.3, scale=(0.9, 9.0, 9.0))
mat_paint("paint", "#efece7", scuff=0.10); mat_paint("charcoal", "#3a3a3b", 0.7, scuff=0.12); mat_paint("accent", "#dd8d36", 0.8)
mat_ceiling()
mat_fabric("screen_orange", "#dd8d36"); mat_fabric("screen_white", "#f1efea"); mat_fabric("sofa_grey", "#a69687"); mat_fabric("sofa_teal", "#286e7a")
mat_fabric("sofa_orange", "#d98733"); mat_fabric("blind", "#d8cfc0", 0.95); mat_fabric("acoustic", "#3d6a8b")
pbr("white_metal", "#f1f0ed", rough=0.42, metal=0.0, coat=0.3); pbr("black_metal", "#1c1c1d", rough=0.38, metal=0.85); pbr("alu", "#c9cbce", rough=0.3, metal=1.0)
mat_screen(); pbr("plastic_black", "#18181a", rough=0.5); pbr("plastic_orange", "#dd8d36", rough=0.45)
pbr("planter_white", "#f3f2ef", rough=0.5); pbr("planter_top", "#333334", rough=0.7); pbr("soil", "#2a2018", rough=1.0)
pbr("stone", "#d7d2c9", rough=0.25); pbr("tile", "#eeece8", rough=0.2); pbr("vinyl", "#b7b3ac", rough=0.55)
pbr("frost", "#f6f6f4", rough=0.6, alpha=0.86); pbr("pot", "#3a3a3a", rough=0.6)
# the lamps: 4000 K (assumed), seen through the camera's white balance
pbr("led", "#ffffff", emit=light_col(LAMP_K), emit_strength=12.0); pbr("led_spot", "#ffffff", emit=light_col(LAMP_K), emit_strength=420.0); pbr("led_line", "#ffffff", emit=light_col(LAMP_K), emit_strength=150.0)
# small things people leave on desks (assumed, not in the CAD)
pbr("mug_white", "#eeece6", rough=0.18, coat=0.5); pbr("mug_orange", "#dd8d36", rough=0.2, coat=0.5); pbr("mug_navy", "#1c2440", rough=0.2, coat=0.5)
pbr("bottle", "#2c6a74", rough=0.35, metal=1.0); pbr("paper", "#f2f0ea", rough=0.8); pbr("cover_black", "#1d1d1f", rough=0.6); pbr("cover_orange", "#c9772c", rough=0.6); pbr("cover_navy", "#222b4a", rough=0.6)
mat_fabric("bag", "#26282c", 0.85); pbr("ground", "#8d8a84", rough=0.9)
mat_glass("glass"); mat_leaf()
for m in MATS.values():
    if hasattr(m, "blend_method") and m.name == "frost":
        try: m.blend_method = "BLEND"
        except Exception: pass

# ------------------------------------------------------------------ geometry helpers
def add(name, verts, faces, mat, smooth=False):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COL.objects.link(o); me.materials.append(MATS[mat])
    if smooth:
        for p in me.polygons: p.use_smooth = True
    return o
def weighted_normals(me, limit=math.radians(42)):
    """Smooth shading that keeps flat faces flat: each face corner takes the area weighted normal of the faces round its
    vertex that lie within `limit` of its own face. Big faces win, so a bevel shades as a soft edge and nothing else bends."""
    me.update()
    for p in me.polygons: p.use_smooth = True
    try: me.use_auto_smooth = True          # only needed (and only there) before Blender 4.1
    except Exception: pass
    around = {}
    for p in me.polygons:
        n = p.normal.copy(); a = p.area
        for vi in p.vertices: around.setdefault(vi, []).append((n, a))
    cl = math.cos(limit); out = []
    for p in me.polygons:
        pn = p.normal
        for vi in p.vertices:
            acc = Vector((0, 0, 0))
            for n, a in around[vi]:
                if n.dot(pn) > cl: acc += n * a
            out.append(acc.normalized() if acc.length > 1e-12 else pn.copy())
    try: me.normals_split_custom_set(out)
    except Exception: pass
def bevel_mesh(me, width, segs=3, vertical_only=False):
    """Round the convex hard edges of a mesh. Real corners are never knife sharp, and a soft edge catches the light."""
    bm = bmesh.new(); bm.from_mesh(me); es = []
    for e in bm.edges:
        if len(e.link_faces) != 2 or not e.is_convex or e.calc_face_angle(0.0) < 0.6: continue
        a, b = e.verts
        if vertical_only and (abs(a.co.x - b.co.x) > 1e-5 or abs(a.co.y - b.co.y) > 1e-5): continue
        es.append(e)
    if es:
        try: bmesh.ops.bevel(bm, geom=es, offset=width, segments=segs, profile=0.5, affect="EDGES", clamp_overlap=True)
        except Exception as ex: print("bevel skipped:", ex)
    bm.to_mesh(me); bm.free(); weighted_normals(me)
def prism(name, outer, holes, z0, z1, mat, bevel=0.0, vertical_only=False):
    loops = [outer] + list(holes or []); pts = [p for l in loops for p in l]; n = len(pts)
    tris = tessellate_polygon([[Vector((x, y, 0)) for x, y in l] for l in loops])
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    faces = [tuple(t) for t in tris] + [tuple(i + n for i in t) for t in tris]; k = 0
    for l in loops:
        m = len(l)
        for i in range(m): a, b = k + i, k + (i + 1) % m; faces.append((a, b, b + n, a + n))
        k += m
    o = add(name, verts, faces, mat)
    if bevel > 0: bevel_mesh(o.data, bevel, 3, vertical_only)
    return o
_MESH = {}
def box_mesh(w, d, h, bevel=0.0, mat="paint"):
    key = ("box", round(w, 4), round(d, 4), round(h, 4), round(bevel, 4), mat)
    if key in _MESH: return _MESH[key]
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * w, v.co.y * d, (v.co.z + 0.5) * h))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, w / 2.2, d / 2.2, h / 2.2), segments=3, profile=0.5, affect="EDGES")
    me = bpy.data.meshes.new("box"); bm.to_mesh(me); bm.free(); me.materials.append(MATS[mat])
    if bevel > 0: weighted_normals(me)
    _MESH[key] = me; return me
def lathe_mesh(profile, mat, seg=28):
    """Turn a profile of (radius, height) points round the z axis: mugs, bottles, pots, light trims."""
    key = ("lathe", tuple(profile), mat, seg)
    if key in _MESH: return _MESH[key]
    bm = bmesh.new(); rings = []
    for r, z in profile:
        rings.append([bm.verts.new((0, 0, z))] if r < 1e-6 else [bm.verts.new((r * math.cos(6.2832 * i / seg), r * math.sin(6.2832 * i / seg), z)) for i in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(a) == 1 and len(b) == 1: continue
            if len(a) == 1: bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1: bm.faces.new((a[i], a[j], b[0]))
            else: bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("lathe"); bm.to_mesh(me); bm.free(); me.materials.append(MATS[mat]); weighted_normals(me, math.radians(50))
    _MESH[key] = me; return me
def tube_mesh(path, r, mat, seg=10):
    """A round tube along a path that lies in the x-z plane (a mug handle)."""
    key = ("tube", tuple(path), r, mat, seg)
    if key in _MESH: return _MESH[key]
    bm = bmesh.new(); rings = []; n = len(path)
    for i, (x, z) in enumerate(path):
        x0, z0 = path[max(0, i - 1)]; x1, z1 = path[min(n - 1, i + 1)]; t = Vector((x1 - x0, 0, z1 - z0)).normalized(); side = Vector((0, 1, 0)); up = t.cross(side)
        rings.append([bm.verts.new(Vector((x, 0, z)) + side * (r * math.cos(6.2832 * k / seg)) + up * (r * math.sin(6.2832 * k / seg))) for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for i in range(seg): bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("tube"); bm.to_mesh(me); bm.free(); me.materials.append(MATS[mat])
    for p in me.polygons: p.use_smooth = True
    _MESH[key] = me; return me
def cyl_mesh(r, h, mat, seg=32, r2=None):
    key = ("cyl", round(r, 4), round(h, 4), mat, seg, r2)
    if key in _MESH: return _MESH[key]
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts: v.co.z += h / 2
    me = bpy.data.meshes.new("cyl"); bm.to_mesh(me); bm.free(); me.materials.append(MATS[mat])
    for p in me.polygons: p.use_smooth = len(p.vertices) == 4
    _MESH[key] = me; return me
def put(mesh, M, name="p"):
    o = bpy.data.objects.new(name, mesh); COL.objects.link(o); o.matrix_world = M; return o
def T(x, y, z=0.0): return Matrix.Translation((x, y, z))
def RZ(a): return Matrix.Rotation(a, 4, "Z")
def box(x, y, z, w, d, h, a=0.0, mat="paint", bevel=0.0, name="box"):
    return put(box_mesh(w, d, h, bevel, mat), T(x, y, z) @ RZ(a), name)
def seg_frame(x0, y0, x1, y1):
    return math.hypot(x1 - x0, y1 - y0), math.atan2(y1 - y0, x1 - x0), (x0 + x1) / 2, (y0 + y1) / 2

# ------------------------------------------------------------------ shell: floor, walls, columns, ceiling
for f in L["floor"]:
    prism("floor", f["outer"], f["holes"], -0.3, 0.0, "carpet")
    prism("ceiling", f["outer"], f["holes"], H, H + 0.06, "gypsum")
FIN = {"wood": "oak_floor", "stone": "stone", "tile": "tile", "vinyl": "vinyl"}
for r in L["rooms"]:
    if r["floor"] in FIN:
        x0, y0, x1, y1 = r["box"]; add("finish_" + r["name"], [(x0, y0, 0.003), (x1, y0, 0.003), (x1, y1, 0.003), (x0, y1, 0.003)], [(0, 1, 2, 3)], FIN[r["floor"]])
for r in L["rooms"]:      # tile grid where the drawing shows 2x2 panels
    x0, y0, x1, y1 = r["box"]
    if sum(1 for l in L["lights"] if l["kind"] == "panel600" and x0 <= l["c"][0] <= x1 and y0 <= l["c"][1] <= y1) >= 2:
        add("grid_" + r["name"], [(x0, y0, H - 0.002), (x1, y0, H - 0.002), (x1, y1, H - 0.002), (x0, y1, H - 0.002)], [(0, 3, 2, 1)], "ceiling")
# plaster and column corners are rounded a little (8 to 10 mm), the way a trowel and a few coats of paint leave them
for i, w in enumerate(L["walls"]): prism(f"wall{i}", w["outer"], w["holes"], 0.0, H, "paint", 0.008, True)
for i, w in enumerate(L.get("skirting", [])): prism(f"skirting{i}", w["outer"], w["holes"], 0.0, 0.09, "charcoal", 0.003)
for i, c in enumerate(L["columns"]): prism(f"column{i}", c, [], 0.0, H, "charcoal", 0.01, True)
if L.get("atrium"):
    a = L["atrium"]; xs = [p[0] for p in a]; ys = [p[1] for p in a]; ax0, ax1, ay0, ay1 = min(xs), max(xs), min(ys), max(ys)
    add("atrium_floor", [(ax0, ay0, -4.1), (ax1, ay0, -4.1), (ax1, ay1, -4.1), (ax0, ay1, -4.1)], [(0, 1, 2, 3)], "stone")
    for (x0, y0, x1, y1) in [(ax0, ay0, ax1, ay0), (ax1, ay0, ax1, ay1), (ax1, ay1, ax0, ay1), (ax0, ay1, ax0, ay0)]:
        ln, an, cx, cy = seg_frame(x0, y0, x1, y1)
        box(cx, cy, 0.0, ln, 0.012, 1.05, an, "glass"); box(cx, cy, 1.05, ln, 0.05, 0.04, an, "black_metal", 0.008)
        box(cx, cy, -4.1, ln, 0.2, 4.1, an, "paint")

# ------------------------------------------------------------------ glass partitions, facade windows, doors
for (x0, y0, x1, y1, layer) in L["glass"]:
    ln, an, cx, cy = seg_frame(x0, y0, x1, y1)
    if ln < 0.2: continue
    facade = layer == "AR-WINDOW"
    box(cx, cy, 0.04, ln, 0.012, H - 0.08, an, "glass", name="glass")
    box(cx, cy, 0.0, ln, 0.05, 0.04, an, "black_metal", 0.004); box(cx, cy, H - 0.04, ln, 0.05, 0.04, an, "black_metal", 0.004)
    n = max(1, round(ln / 1.2)); ca, sa = math.cos(an), math.sin(an)
    for i in range(n + 1):
        u = -ln / 2 + ln * i / n; box(cx + ca * u, cy + sa * u, 0.0, 0.04, 0.05, H, an, "black_metal", 0.004)
    if facade:   # roller blinds, part way down, on the room side
        for i in range(n):
            u = -ln / 2 + ln * (i + 0.5) / n; drop = random.choice((0.45, 0.6, 0.6, 0.8))
            for s_ in (-1, 1): box(cx + ca * u - sa * 0.05 * s_, cy + sa * u + ca * 0.05 * s_, H - drop, ln / n - 0.06, 0.004, drop, an, "blind")
    else:
        for k in range(4): box(cx, cy, 0.95 + k * 0.145, ln - 0.05, 0.018, 0.1, an, "frost", name="frost")
for d in L["doors"]:
    m = "glass" if d.get("glass") else ("charcoal" if d.get("fire") else "oak")
    box(d["c"][0], d["c"][1], 0.0, d["w"], max(0.04, d["d"]) if m != "glass" else 0.012, 2.1, d["a"], m, 0.004, "door")
    ca, sa = math.cos(d["a"]), math.sin(d["a"])
    for s_ in (-1, 1): box(d["c"][0] + ca * (d["w"] / 2 - 0.09) - sa * 0.035 * s_, d["c"][1] + sa * (d["w"] / 2 - 0.09) + ca * 0.035 * s_, 0.95, 0.025, 0.03, 0.3, d["a"], "alu", 0.008, "handle")

# ------------------------------------------------------------------ ceiling lights (positions from the drawing's ceiling plan)
panel = box_mesh(0.6, 0.6, 0.004, 0, "led"); spot = cyl_mesh(0.055, 0.004, "led_spot", 20)
trim = lathe_mesh(((0.056, 0.0), (0.060, -0.004), (0.078, -0.004), (0.082, 0.0)), "white_metal", 24)        # the downlight's white rim
frame = [box_mesh(0.62, 0.012, 0.008, 0.003, "white_metal"), box_mesh(0.012, 0.62, 0.008, 0.003, "white_metal")]   # the panel's thin frame
for l in L["lights"]:
    x, y = l["c"]
    put(panel if l["kind"] == "panel600" else spot, T(x, y, H - 0.006), "light")
    if l["kind"] == "panel600":
        for s_ in (-1, 1): put(frame[0], T(x, y + s_ * 0.304, H - 0.009), "light_frame"); put(frame[1], T(x + s_ * 0.304, y, H - 0.009), "light_frame")
    else: put(trim, T(x, y, H - 0.001), "light_trim")

# ------------------------------------------------------------------ furniture
def in_box(b, x, y, pad=0.0): return b[0] - pad <= x <= b[2] + pad and b[1] - pad <= y <= b[3] + pad
task_seats = [s for s in L["seats"] if s["kind"] == "task chair"]
mon = box_mesh(0.56, 0.012, 0.33, 0.004, "screen_glass"); mon_back = box_mesh(0.565, 0.014, 0.415, 0.006, "alu"); stand = box_mesh(0.11, 0.02, 0.14, 0.006, "alu"); base = box_mesh(0.2, 0.17, 0.008, 0.003, "alu")
tray = box_mesh(0.9, 0.12, 0.06, 0.004, "white_metal")
kb = box_mesh(0.42, 0.13, 0.014, 0.004, "plastic_black"); mouse = box_mesh(0.06, 0.1, 0.02, 0.008, "plastic_black")
# small things people leave behind (assumed, kept modest): a mug, a notebook and pen, a bottle, a bag by the desk leg
CR = random.Random(11)        # its own dice, so the clutter never moves the chairs or the blinds
MUG_P = ((0.0, 0.0), (0.034, 0.0), (0.039, 0.004), (0.0405, 0.09), (0.0395, 0.094), (0.0375, 0.093), (0.0365, 0.012), (0.0, 0.010))
mugs = [lathe_mesh(MUG_P, m_, 24) for m_ in ("mug_white", "mug_white", "mug_orange", "mug_navy")]
handles = [tube_mesh(tuple((0.039 + 0.026 * math.cos(math.radians(a_)), 0.05 + 0.028 * math.sin(math.radians(a_))) for a_ in range(-85, 86, 17)), 0.0045, m_) for m_ in ("mug_white", "mug_white", "mug_orange", "mug_navy")]
bottle = lathe_mesh(((0.0, 0.0), (0.031, 0.0), (0.034, 0.004), (0.034, 0.17), (0.03, 0.188), (0.017, 0.2), (0.017, 0.222), (0.019, 0.224), (0.019, 0.243), (0.016, 0.246), (0.0, 0.246)), "bottle", 20)
books = [box_mesh(0.148, 0.21, 0.014, 0.003, m_) for m_ in ("cover_black", "cover_orange", "cover_navy")]
sheet = box_mesh(0.21, 0.297, 0.0016, 0, "paper"); pen = cyl_mesh(0.0042, 0.14, "plastic_black", 8)
bag_body = box_mesh(0.3, 0.17, 0.42, 0.06, "bag"); bag_pocket = box_mesh(0.22, 0.05, 0.2, 0.022, "bag")
RX = lambda a: Matrix.Rotation(a, 4, "X"); RY = lambda a: Matrix.Rotation(a, 4, "Y")
def mug_at(M):
    k = CR.randrange(4); M = M @ RZ(CR.uniform(0, 6.283)); put(mugs[k], M, "mug"); put(handles[k], M, "mug_handle")
def notebook_at(M):
    M = M @ RZ(CR.uniform(-0.5, 0.5))
    if CR.random() < 0.35: put(sheet, M @ T(0.03, -0.02, 0) @ RZ(CR.uniform(-0.3, 0.3)), "paper")
    put(CR.choice(books), M @ T(0, 0, 0.0016), "notebook")
    put(pen, M @ T(CR.uniform(-0.02, 0.02), CR.uniform(-0.03, 0.03), 0.0016 + 0.014 + 0.0042) @ RZ(CR.uniform(-0.45, 0.45)) @ T(0, -0.07, 0) @ RX(-math.pi / 2), "pen")
def desk_clutter(Mm, M0, w, dp, sd):
    """Mm is the monitor's frame on the desk top: +y is towards the person, the keyboard sits at y 0.27."""
    half = w / 2 - 0.1; k = CR.random()
    if k < 0.22: mug_at(Mm @ T(-min(half, 0.42) + CR.uniform(0, 0.05), CR.uniform(0.1, 0.26), 0))
    elif k < 0.42: notebook_at(Mm @ T(-min(half - 0.02, 0.4), CR.uniform(0.2, 0.3), 0))
    elif k < 0.55:
        notebook_at(Mm @ T(-min(half - 0.02, 0.4), CR.uniform(0.22, 0.3), 0)); mug_at(Mm @ T(min(half, 0.45), CR.uniform(0.0, 0.1), 0))
    elif k < 0.63: put(bottle, Mm @ T(min(half, 0.44), CR.uniform(0.0, 0.12), 0), "bottle")
    if w > 1.1 and CR.random() < 0.13:      # a bag on the floor, under the desk by a leg, leaning a little
        e = CR.choice((-1, 1)); Mb = M0 @ T(e * (w / 2 - 0.27), sd * (dp / 2 - 0.2), 0) @ RZ(CR.uniform(-0.25, 0.25)) @ RX(CR.uniform(-0.1, 0.02))
        put(bag_body, Mb, "bag"); put(bag_pocket, Mb @ T(0, -0.1 * sd, 0.05), "bag_pocket")
rows = {}
for i, d in enumerate(L["desks"]):
    cx, cy = d["c"]; a, w, dp, h = d["a"], d["w"], d["d"], d["h"]; M0 = T(cx, cy, 0) @ RZ(a)
    put(box_mesh(w, dp, 0.025, 0.004, "oak"), M0 @ T(0, 0, h - 0.025), "desk_top")
    for e in (-1, 1):
        for sy in (-1, 1): put(box_mesh(0.045, 0.045, h - 0.025, 0.006, "white_metal"), M0 @ T(e * (w / 2 - 0.04), sy * (dp * 0.42 - 0.02), 0), "desk_leg")
        put(box_mesh(0.045, dp * 0.84, 0.045, 0.006, "white_metal"), M0 @ T(e * (w / 2 - 0.04), 0, 0.0), "desk_foot")
        put(box_mesh(0.045, dp * 0.84, 0.045, 0.006, "white_metal"), M0 @ T(e * (w / 2 - 0.04), 0, h - 0.07), "desk_rail")
    put(box_mesh(w - 0.1, 0.04, 0.04, 0.005, "white_metal"), M0 @ T(0, 0, h - 0.07), "desk_beam")
    if "workstation" not in d["kind"]: continue
    nx, ny = -math.sin(a), math.cos(a); best = None; bd = 1.3
    for s in task_seats:
        dd = math.hypot(s["x"] - cx, s["y"] - cy)
        if dd < bd: bd, best = dd, s
    if not best: continue
    sd = 1.0 if (best["x"] - cx) * nx + (best["y"] - cy) * ny >= 0 else -1.0     # which long side the chair is on
    put(box_mesh(w - 0.06, 0.024, 0.38, 0.006, "screen_orange" if i % 2 == 0 else "screen_white"), M0 @ T(0, -sd * (dp / 2 - 0.012), h), "desk_screen")
    Mm = M0 @ T(random.uniform(-0.06, 0.06), -sd * (dp / 2 - 0.19), h) @ RZ(0 if sd > 0 else math.pi) @ RZ(random.uniform(-0.08, 0.08))
    put(base, Mm, "mon_base"); put(stand, Mm @ T(0, -0.03, 0.008), "mon_stand"); put(mon, Mm @ T(0, 0.004, 0.195), "monitor"); put(mon_back, Mm @ T(0, -0.008, 0.115), "mon_back")
    put(tray, M0 @ T(0, -sd * (dp / 2 - 0.1), h - 0.14), "cable_tray")
    put(kb, Mm @ T(0, 0.27, 0.0) @ RZ(random.uniform(-0.06, 0.06)), "keyboard"); put(mouse, Mm @ T(0.3, 0.27, 0.0) @ RZ(random.uniform(-0.3, 0.3)), "mouse")
    desk_clutter(Mm, M0, w, dp, sd)
    room = next((r["name"] for r in L["rooms"] if in_box(r["box"], cx, cy)), ""); rows.setdefault(room, []).append(d)

# linear pendant lights over the desk rows (a design choice shown in the deck; not drawn in the CAD)
for room, ds in rows.items():
    if len(ds) < 8: continue
    along_y = sum(1 for d in ds if abs(math.sin(d["a"])) > 0.7) > len(ds) / 2
    key = (lambda d: d["c"][0]) if along_y else (lambda d: d["c"][1]); other = (lambda d: d["c"][1]) if along_y else (lambda d: d["c"][0])
    groups = []
    for d in sorted(ds, key=key):
        if groups and key(d) - key(groups[-1][-1]) < 0.9: groups[-1].append(d)
        else: groups.append([d])
    for g in groups:
        if len(g) < 3: continue
        k = sum(key(d) for d in g) / len(g); lo = min(other(d) for d in g) - 0.3; hi = max(other(d) for d in g) + 0.3; ln = hi - lo; mid = (lo + hi) / 2
        x, y, an = (k, mid, math.pi / 2) if along_y else (mid, k, 0.0)
        box(x, y, 2.32, ln, 0.06, 0.07, an, "black_metal", 0.006, "pendant"); box(x, y, 2.316, ln - 0.04, 0.04, 0.004, an, "led_line", 0, "pendant_led")
        ca, sa = math.cos(an), math.sin(an)
        for u in (-ln / 2 + 0.3, ln / 2 - 0.3): put(cyl_mesh(0.003, H - 2.39, "black_metal", 6), T(x + ca * u, y + sa * u, 2.39), "wire")

# tables
for t in L["tables"]:
    h = t["h"]
    if "circle" in t:
        x, y, r = t["circle"]; put(lathe_mesh(((0.0, 0.0), (r - 0.006, 0.0), (r, 0.006), (r, 0.029), (r - 0.006, 0.035), (0.0, 0.035)), "oak", 56), T(x, y, h - 0.035), "table_top")
        put(cyl_mesh(0.035, h - 0.035, "black_metal", 16), T(x, y, 0), "table_leg"); put(cyl_mesh(r * 0.55, 0.015, "black_metal"), T(x, y, 0), "table_base")
        continue
    prism("table_top", t["poly"], [], h - 0.04, h, "oak", 0.006)
    xs = [p[0] for p in t["poly"]]; ys = [p[1] for p in t["poly"]]; w = max(xs) - min(xs); d = max(ys) - min(ys); cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2
    if max(w, d) > 1.6:
        box(cx, cy, 0.0, w * 0.72 if w > d else min(w, 0.9) * 0.45, d * 0.72 if d >= w else min(d, 0.9) * 0.45, h - 0.04, 0, "charcoal", 0.008, "table_base")
    else:
        put(cyl_mesh(0.04, h - 0.04, "black_metal", 16), T(cx, cy, 0), "table_leg"); put(cyl_mesh(min(w, d) * 0.3, 0.015, "black_metal"), T(cx, cy, 0), "table_base")

# real chair models
def load_model(path, height, seat_band):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    ch = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM"); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o != ch and o.name in bpy.data.objects: bpy.data.objects.remove(o)
    co = [v.co.copy() for v in ch.data.vertices]
    lo = Vector((min(v.x for v in co), min(v.y for v in co), min(v.z for v in co))); hi = Vector((max(v.x for v in co), max(v.y for v in co), max(v.z for v in co)))
    k = height / (hi.z - lo.z); c = (lo + hi) / 2
    ch.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation((-c.x, -c.y, -lo.z)))
    top = [v.co for v in ch.data.vertices if v.co.z > 0.86 * height]; seat = [v.co for v in ch.data.vertices if seat_band[0] * height < v.co.z < seat_band[1] * height]
    bk = sum(top, Vector()) / len(top); st = sum(seat, Vector()) / len(seat)
    ch.data.transform(Matrix.Rotation(-math.atan2(st.y - bk.y, st.x - bk.x), 4, "Z"))      # now it faces +x
    for p in ch.data.polygons: p.use_smooth = True
    for c_ in list(ch.users_collection): c_.objects.unlink(ch)
    me = ch.data; bpy.data.objects.remove(ch); return me
CHAIR = load_model(os.path.join(HERE, "models", "chair.glb"), 1.02, (0.40, 0.52))
LOUNGE = load_model(os.path.join(HERE, "models", "lounge.glb"), 0.82, (0.30, 0.50))
cafe_seat = box_mesh(0.44, 0.44, 0.05, 0.02, "plastic_orange"); cafe_back = box_mesh(0.05, 0.42, 0.36, 0.02, "plastic_orange"); cafe_leg = cyl_mesh(0.014, 0.45, "oak", 10)
stool_seat = cyl_mesh(0.19, 0.05, "plastic_orange"); stool_leg = cyl_mesh(0.013, 0.66, "black_metal", 8)
def sofa(x, y, a, length, depth, places, mat):
    M0 = T(x, y, 0) @ RZ(a)
    put(box_mesh(depth, length, 0.24, 0.06, mat), M0 @ T(0, 0, 0.16), "sofa_seat"); put(box_mesh(0.2, length, 0.44, 0.07, mat), M0 @ T(-depth / 2 + 0.1, 0, 0.3), "sofa_back")
    for s_ in (-1, 1): put(box_mesh(depth, 0.18, 0.3, 0.06, mat), M0 @ T(0, s_ * (length / 2 - 0.09), 0.3), "sofa_arm")
    cw = (length - 0.4) / places
    for i in range(places): put(box_mesh(depth - 0.26, cw - 0.02, 0.13, 0.05, mat), M0 @ T(0.08, -length / 2 + 0.2 + (i + 0.5) * cw, 0.38), "sofa_cushion")
    for sx in (-1, 1):
        for sy in (-1, 1): put(cyl_mesh(0.02, 0.16, "black_metal", 8), M0 @ T(sx * (depth / 2 - 0.08), sy * (length / 2 - 0.1), 0), "sofa_leg")
# the tub chair: an upholstered drum with a soft top edge and a back that wraps round it (shape assumed, after the deck)
TUB_SEAT = lathe_mesh(((0.0, 0.03), (0.27, 0.03), (0.3, 0.045), (0.325, 0.2), (0.33, 0.37), (0.32, 0.41), (0.29, 0.435), (0.0, 0.44)), "sofa_teal", 48)
def arc_back(r_in, r_out, z0, z1, half_angle, mat, seg=28):
    """An upholstered back swept round an arc behind the seat (the chair faces +x), rounded on top and at both ends."""
    rr = (r_out - r_in) / 2; rm = (r_in + r_out) / 2; sec = [(-rr, z0)] + [(-rr * math.cos(math.radians(a_)), z1 - rr + rr * math.sin(math.radians(a_))) for a_ in range(0, 181, 30)] + [(rr, z0)]
    bm = bmesh.new(); rings = []
    for i in range(seg + 1):
        t = i / seg; ang = math.pi - half_angle + 2 * half_angle * t; e = min(t, 1 - t) * seg; k = min(1.0, 0.45 + 0.55 * math.sin(min(1.0, e / 3) * math.pi / 2))     # taper the two ends
        rings.append([bm.verts.new(((rm + dx * k) * math.cos(ang), (rm + dx * k) * math.sin(ang), z0 + (z - z0) * (0.75 + 0.25 * k))) for dx, z in sec])
    m = len(sec)
    for a_, b_ in zip(rings, rings[1:]):
        for j in range(m): bm.faces.new((a_[j], a_[(j + 1) % m], b_[(j + 1) % m], b_[j]))
    bm.faces.new(rings[0]); bm.faces.new(rings[-1]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("arc_back"); bm.to_mesh(me); bm.free(); me.materials.append(MATS[mat]); weighted_normals(me, math.radians(55)); return me
TUB_BACK = arc_back(0.24, 0.36, 0.3, 0.72, math.radians(100), "sofa_teal")
for s in L["seats"]:
    k = s["kind"]; a = s["face"] + random.uniform(-0.09, 0.09); x, y = s["x"], s["y"]
    if k in ("task chair", "meeting chair", "staff chair", "director chair"):
        pull = random.choice((0.0, 0.0, 0.04, 0.09)); put(CHAIR, T(x - math.cos(a) * pull, y - math.sin(a) * pull, 0) @ RZ(a), "chair")
    elif k in ("lounge armchair", "visitor chair"): put(LOUNGE, T(x, y, 0) @ RZ(a), "lounge")
    elif k == "cafe chair":
        M0 = T(x, y, 0) @ RZ(a); put(cafe_seat, M0 @ T(0, 0, 0.43), "cafe_seat"); put(cafe_back, M0 @ T(-0.2, 0, 0.5), "cafe_back")
        for sx in (-1, 1):
            for sy in (-1, 1): put(cafe_leg, M0 @ T(sx * 0.18, sy * 0.18, 0), "cafe_leg")
    elif k == "cafe stool":
        M0 = T(x, y, 0); put(stool_seat, M0 @ T(0, 0, 0.64), "stool")
        for i in range(4): put(stool_leg, M0 @ T(math.cos(i * math.pi / 2 + 0.78) * 0.14, math.sin(i * math.pi / 2 + 0.78) * 0.14, 0), "stool_leg")
    elif k in ("lounge tub chair", "lounge chair"):
        M0 = T(x, y, 0) @ RZ(a); put(TUB_SEAT, M0, "tub"); put(TUB_BACK, M0, "tub_back")
    elif "sofa" in k:
        n = len(s.get("ids", [1])); sofa(x, y, a, max(1.3, s["len"]), min(0.95, max(0.75, s["dep"])), n, "sofa_grey" if n > 2 else "sofa_teal")

# planters and plants. The leaves are thin sheets with no thickness at all: a slim stalk, then a pointed blade that
# is folded a little along its midrib, wavy at the edge, and arches over under its own weight. Young leaves stand
# up in the middle, old ones lean out. Light passes through them (see mat_leaf). The species is assumed: a peace
# lily sort of plant, as in the deck. Where the planters and pots stand is from the CAD.
PR = random.Random(23); PLANT = {"v": [], "f": [], "uv": [], "id": []}
def leafy(x, y, z, n, spread, hgt):
    V, F, UV, ID = PLANT["v"], PLANT["f"], PLANT["uv"], PLANT["id"]; NS, NB = 4, 12
    for i in range(n):
        age = (i + PR.random()) / n                                    # 0 is a young leaf in the middle, 1 an old one outside
        ang = PR.uniform(0, 6.283); r0 = spread * (0.1 + 0.6 * age) * PR.uniform(0.4, 1.0)
        pos = Vector((x + math.cos(ang) * r0, y + math.sin(ang) * r0, z))
        lp = hgt * PR.uniform(0.34, 0.58) * (0.75 + 0.35 * age); lb = hgt * PR.uniform(0.42, 0.62) * (0.7 + 0.3 * min(1.0, age * 2.5))
        wb = lb * PR.uniform(0.26, 0.37) / 2                             # half the blade's width
        th0 = math.radians(3 + 36 * age * PR.uniform(0.5, 1.2)); bend = math.radians(PR.uniform(22, 70)) * (0.45 + 0.75 * age)
        fold = math.radians(PR.uniform(12, 34)); roll = PR.uniform(-0.7, 0.7); wav = PR.uniform(0.002, 0.006); ph = PR.uniform(0, 6.283); kv = PR.uniform(9, 17)
        dx, dy = math.cos(ang), math.sin(ang); side0 = Vector((-dy, dx, 0)); lid = PR.random(); k0 = len(V); total = lp + lb; prev_t = None; s_prev = 0.0
        for j in range(NS + NB + 1):
            if j <= NS: lt = 0.0; s_ = lp * j / NS; w = 0.0022
            else: lt = (j - NS) / NB; s_ = lp + lb * lt; w = max(0.0022 * (1 - lt), wb * math.sin(math.pi * lt ** 0.72) ** 0.85)
            th = th0 + bend * (s_ / total) ** 1.6; tan = Vector((dx * math.sin(th), dy * math.sin(th), math.cos(th)))
            if prev_t is not None: pos = pos + (prev_t + tan) * 0.5 * (s_ - s_prev)
            prev_t, s_prev = tan, s_
            up = tan.cross(side0).normalized(); rot = Matrix.Rotation(roll * lt, 3, tan); side = rot @ side0; up = rot @ up
            for u in (-1.0, -0.5, 0.0, 0.5, 1.0):
                lift = w * abs(u) * math.sin(fold) + wav * math.sin(kv * lt + ph + u * 1.3) * u * u * min(1.0, w / wb)
                V.append(tuple(pos + side * (w * u * math.cos(fold)) + up * lift)); UV.append((u * 0.5 + 0.5, lt)); ID.append((lid, age))
        for j in range(NS + NB):
            for c in range(4):
                a_ = k0 + j * 5 + c; F.append((a_, a_ + 1, a_ + 6, a_ + 5))
def plants_done():
    if not PLANT["v"]: return
    me = bpy.data.meshes.new("plants"); me.from_pydata(PLANT["v"], [], PLANT["f"]); me.update()
    for name, src in (("UVMap", PLANT["uv"]), ("id", PLANT["id"])):
        lay = me.uv_layers.new(name=name)
        for lp_ in me.loops: lay.data[lp_.index].uv = src[lp_.vertex_index]
    for p in me.polygons: p.use_smooth = True
    me.materials.append(MATS["leaf"]); o = bpy.data.objects.new("plants", me); COL.objects.link(o)
PH = L["heights"]["planter"]
for p in L["planters"]:
    x, y = p["c"]; a, w, d = p["a"], p["w"], p["d"]
    box(x, y, 0.04, w, d, PH - 0.04, a, "planter_white", 0.008, "planter"); box(x, y, 0.06, w * 0.5, d + 0.01, PH - 0.12, a, "oak", 0.004, "planter_panel")
    box(x, y, PH, w + 0.02, d + 0.02, 0.07, a, "planter_top", 0.008, "planter_tray"); box(x, y, PH + 0.05, w - 0.04, d - 0.04, 0.025, a, "soil")
    ca, sa = math.cos(a), math.sin(a); nc = max(3, round(w / 0.3))
    for i in range(nc):
        u = -w / 2 + w * (i + 0.5) / nc + PR.uniform(-0.03, 0.03); v = PR.uniform(-0.05, 0.05)
        leafy(x + ca * u - sa * v, y + sa * u + ca * v, PH + 0.07, PR.randint(13, 18), min(d, 0.3) * 0.45, PR.uniform(0.36, 0.46))
POT = lathe_mesh(((0.0, 0.0), (0.125, 0.0), (0.132, 0.006), (0.168, 0.425), (0.172, 0.44), (0.166, 0.446), (0.156, 0.44), (0.153, 0.415), (0.0, 0.415)), "pot", 36)
for p in L["plants"]:
    if p.get("in_box"): continue
    put(POT, T(p["x"], p["y"], 0), "pot"); put(cyl_mesh(0.152, 0.01, "soil", 28), T(p["x"], p["y"], 0.41), "soil")
    leafy(p["x"], p["y"], 0.42, PR.randint(18, 24), 0.1, PR.uniform(0.6, 0.72))
plants_done()

# ------------------------------------------------------------------ light from outside: sky and a morning sun
sf = L["site_fit"]; rho = math.radians(sf["rot_deg"])
def bearing_to_plan(b):
    e, n = math.sin(math.radians(b)), math.cos(math.radians(b)); c, s = math.cos(-rho), math.sin(-rho); return (c * e - s * n, s * e + c * n)
sd = bearing_to_plan(A.sun_az); el = math.radians(A.sun_el)
# The sky is Blender's physical sky (no sun disc in it: the sun is the lamp below, so it is not counted twice).
# It is seen through the camera's white balance, which is why it is multiplied by a colour.
W = bpy.data.worlds.new("World"); SC.world = W; W.use_nodes = True; wn = W.node_tree
bg = next(n for n in wn.nodes if n.type == "BACKGROUND"); bg.inputs["Strength"].default_value = A.sky
sky = wn.nodes.new("ShaderNodeTexSky"); sky_ok = False
for kind in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "HOSEK_WILKIE"):
    try: sky.sky_type = kind; sky_ok = True; break
    except Exception: continue
for attr, val in (("sun_disc", False), ("sun_elevation", el), ("sun_rotation", math.atan2(sd[0], sd[1])), ("altitude", 200.0), ("air_density", 1.0), ("aerosol_density", 2.0), ("dust_density", 2.0),
                  ("ozone_density", 1.0), ("sun_direction", (sd[0] * math.cos(el), sd[1] * math.cos(el), math.sin(el))), ("turbidity", 3.0), ("ground_albedo", 0.3)):
    try: setattr(sky, attr, val)
    except Exception: pass
wbk = kelvin(WB_K); wbm = [wbk[1] / c for c in wbk]; wbm = [1 + (v - 1) * 0.6 for v in wbm]        # 0.6: most of the way, so daylight stays believable
tint = wn.nodes.new("ShaderNodeVectorMath"); tint.operation = "MULTIPLY"; tint.inputs[1].default_value = wbm
wn.links.new(sky.outputs[0], tint.inputs[0]); wn.links.new(tint.outputs[0], bg.inputs["Color"])
if not sky_ok: bg.inputs["Color"].default_value = (*lin("#cfe0f2"), 1)
sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = A.sun; sun.angle = math.radians(1.2); sun.color = light_col(SUN_K, 0.6)
so = bpy.data.objects.new("Sun", sun); COL.objects.link(so)
to_sun = Vector((sd[0] * math.cos(el), sd[1] * math.cos(el), math.sin(el))); so.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()
# the ground outside, one storey below this floor (assumed: plain paving, only there so the windows do not look onto nothing)
add("ground", [(-300, -300, -4.15), (340, -300, -4.15), (340, 330, -4.15), (-300, 330, -4.15)], [(0, 1, 2, 3)], "ground")
# light portals: one in every facade window (the layout's AR-WINDOW glass). They tell Cycles where daylight gets in.
fx = [p[0] for f in L["floor"] for p in f["outer"]]; fy = [p[1] for f in L["floor"] for p in f["outer"]]; mid = ((min(fx) + max(fx)) / 2, (min(fy) + max(fy)) / 2)
for (x0, y0, x1, y1, layer) in L["glass"]:
    if layer != "AR-WINDOW": continue
    ln, an, cx, cy = seg_frame(x0, y0, x1, y1)
    if ln < 0.2: continue
    ca, sa = math.cos(an), math.sin(an); nx, ny = -sa, ca
    if (mid[0] - cx) * nx + (mid[1] - cy) * ny < 0: nx, ny, ca, sa = -nx, -ny, -ca, -sa        # the normal has to point indoors
    pl = bpy.data.lights.new("Portal", "AREA"); pl.shape = "RECTANGLE"; pl.size = ln; pl.size_y = H - 0.08
    try: pl.cycles.is_portal = True
    except Exception: bpy.data.lights.remove(pl); continue
    po = bpy.data.objects.new("Portal", pl); COL.objects.link(po)
    po.matrix_world = Matrix(((ca, 0, -nx, cx - nx * 0.12), (sa, 0, -ny, cy - ny * 0.12), (0, 1, 0, H / 2), (0, 0, 0, 1)))      # an area light shines along its own -z

# ------------------------------------------------------------------ render settings
SC.render.engine = "CYCLES"; C = SC.cycles
C.samples = Q["samples"]; C.use_denoising = True
for attr, val in (("denoiser", "OPENIMAGEDENOISE"), ("max_bounces", 12), ("diffuse_bounces", 6), ("glossy_bounces", 6), ("transmission_bounces", 12),
                  ("transparent_max_bounces", 16), ("sample_clamp_indirect", 8.0), ("caustics_reflective", False), ("caustics_refractive", False), ("use_light_tree", True)):
    try: setattr(C, attr, val)
    except Exception: pass
device = "CPU"
if A.device != "cpu":
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind; prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == kind]
                if devs:
                    for d in prefs.devices: d.use = d.type == kind
                    C.device = "GPU"; device = kind; break
            except Exception: continue
    except Exception: pass
for vt in ("AgX", "Filmic", "Standard"):
    try: SC.view_settings.view_transform = vt; break
    except Exception: continue
for look in ("AgX - Medium High Contrast", "Medium High Contrast", "None"):
    try: SC.view_settings.look = look; break
    except Exception: continue
SC.view_settings.exposure = A.exposure
SC.render.image_settings.file_format = "PNG"; SC.render.resolution_percentage = 100      # the render is saved as a PNG, finished, then written as the JPEG
for attr, val in (("color_mode", "RGB"), ("color_depth", "8"), ("compression", 15)):
    try: setattr(SC.render.image_settings, attr, val)
    except Exception: pass

cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data); COL.objects.link(cam); SC.camera = cam
cam_data.clip_start = 0.05; cam_data.clip_end = 300; cam_data.sensor_width = 36
# depth of field like a real lens at f/8 with seven blades: at 20 mm it is barely there, which is right for a room
cam_data.dof.aperture_fstop = 8.0; cam_data.dof.aperture_blades = 7
def aim(pos, look, focus=None):
    cam.location = pos; cam.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
    cam_data.dof.use_dof = True; cam_data.dof.focus_distance = focus or min(6.0, max(2.5, (Vector(look) - Vector(pos)).length))
def set_pano(on):
    if on:
        cam_data.type = "PANO"; cam_data.dof.use_dof = False
        try: cam_data.panorama_type = "EQUIRECTANGULAR"
        except Exception: cam_data.cycles.panorama_type = "EQUIRECTANGULAR"
    else: cam_data.type = "PERSP"

def finish_picture(src, dst, still=True, seed=1):
    """The camera's own flaws, added to the clean denoised render with numpy (no compositor needed, so it runs the same
    in Blender 4.2 to 5.x with or without a GPU). In order: a faint glow round whatever is truly bright (the lamps and the
    windows), a trace of chromatic aberration, a slight softening, a light vignette, then fine grain on top. Panoramas
    only get the softening and the grain, because the rest would show at the seam."""
    import numpy as np
    img = bpy.data.images.load(src, check_existing=False); w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    lin_ = np.clip(px[..., :3], 0, 1) ** 2.2; k = w / 1280.0
    def blur(a, sigma):
        r = max(1, int(sigma * 3 + 0.5)); kr = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); kr /= kr.sum()
        for ax in (0, 1):
            pad = [(0, 0)] * a.ndim; pad[ax] = (r, r); p_ = np.pad(a, pad, mode="edge"); o = np.zeros_like(a)
            for i, kv in enumerate(kr):
                sl = [slice(None)] * a.ndim; sl[ax] = slice(i, i + a.shape[ax]); o += kv * p_[tuple(sl)]
            a = o
        return a
    def sample(a, ys, xs):
        x0 = np.clip(np.floor(xs).astype(np.int32), 0, a.shape[1] - 2); y0 = np.clip(np.floor(ys).astype(np.int32), 0, a.shape[0] - 2)
        fx = np.clip(xs - x0, 0, 1)[..., None]; fy = np.clip(ys - y0, 0, 1)[..., None]
        return (a[y0, x0] * (1 - fx) + a[y0, x0 + 1] * fx) * (1 - fy) + (a[y0 + 1, x0] * (1 - fx) + a[y0 + 1, x0 + 1] * fx) * fy
    if still:
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
        f = 8; hs, ws = h // f, w // f
        bright = lin_ * np.clip((lin_.min(axis=2, keepdims=True) - 0.80) / 0.2, 0, 1)                   # only what is nearly burnt out
        small = bright[:hs * f, :ws * f].reshape(hs, f, ws, f, 3).mean(axis=(1, 3))
        glow = sample(0.6 * blur(small, 1.6 * k) + 0.4 * blur(small, 6.0 * k), (yy + 0.5) / f - 0.5, (xx + 0.5) / f - 0.5)
        lin_ = 1 - (1 - lin_) * (1 - np.clip(0.30 * glow, 0, 1))
        ca = 0.0007                                                                                      # red a hair larger, blue a hair smaller
        lin_ = np.concatenate([sample(lin_[..., 0:1], cy + (yy - cy) / (1 + ca), cx + (xx - cx) / (1 + ca)), lin_[..., 1:2],
                               sample(lin_[..., 2:3], cy + (yy - cy) / (1 - ca), cx + (xx - cx) / (1 - ca))], axis=2)
    lin_ = 0.72 * lin_ + 0.28 * blur(lin_, 0.7 * k)
    if still:
        rr = ((xx - cx) ** 2 + (yy - cy) ** 2) / (cx * cx + cy * cy); lin_ = lin_ * (1 - 0.16 * rr ** 1.3)[..., None]
    out = np.clip(lin_, 0, 1) ** (1 / 2.2); rng = np.random.default_rng(seed)
    lum = out.mean(axis=2, keepdims=True); g = 0.85 * rng.normal(0, 1, (h, w, 1)) + 0.3 * rng.normal(0, 1, (h, w, 3))
    out = out + blur(g.astype(np.float32), 0.55 * max(1.0, k)) * 0.022 * (0.35 + 0.65 * 4 * lum * (1 - lum))
    px[..., :3] = np.clip(out, 0, 1); px[..., 3] = 1.0; img.pixels.foreach_set(px.ravel())
    img.filepath_raw = dst; img.file_format = "JPEG"
    try: img.save(quality=93)
    except TypeError: img.save()
    bpy.data.images.remove(img)
def plain_jpeg(src, dst):
    img = bpy.data.images.load(src, check_existing=False); img.filepath_raw = dst; img.file_format = "JPEG"
    try: img.save(quality=93)
    except TypeError: img.save()
    bpy.data.images.remove(img)

blend = os.path.join(OUT, "volt_floor.blend")
try: bpy.ops.wm.save_as_mainfile(filepath=blend)
except Exception as e: print("could not save the .blend:", e)
print(f"\nVolt floor built: {len(bpy.data.objects)} objects. Blender {bpy.app.version_string}, device {device}, {Q['samples']} samples. Saved {blend}\n", flush=True)

want = [w.strip() for w in A.what.split(",") if w.strip()]; only = [r.strip() for r in A.rooms.split(",") if r.strip()]
jobs = []
for r in CAMS["rooms"]:
    if only and r["slug"] not in only: continue
    if "stills" in want: jobs.append(("stills", r))
for r in CAMS["rooms"]:
    if only and r["slug"] not in only: continue
    if "panos" in want: jobs.append(("panos", r))
manifest = {"blender": bpy.app.version_string, "device": device, "samples": Q["samples"], "quality": A.quality, "sun": {"bearing": A.sun_az, "elevation": A.sun_el}, "renders": []}
t_all = time.time(); done = 0
if not A.no_render:
    for kind, r in jobs:
        path = os.path.join(OUT, kind, r["slug"] + ".jpg"); rec = {"kind": kind, "room": r["room"], "slug": r["slug"], "file": f"{kind}/{r['slug']}.jpg"}
        if kind == "stills":
            set_pano(False); cam_data.lens = r["still"]["lens_mm"]; aim(r["still"]["pos"], r["still"]["look"], r["still"].get("focus_m")); SC.render.resolution_x, SC.render.resolution_y = Q["still"]; rec.update(r["still"])
        else:
            set_pano(True); cam.location = r["pano"]["pos"]; cam.rotation_euler = (math.pi / 2, 0, 0); SC.render.resolution_x, SC.render.resolution_y = Q["pano"]
            rec.update(r["pano"]); rec["north_note"] = "The panorama's centre column looks along the plan's +Y axis"
        if os.path.exists(path):
            print(f"skip (already there): {rec['file']}", flush=True); manifest["renders"].append(rec); continue
        SC.render.resolution_x = int(SC.render.resolution_x * A.res_scale); SC.render.resolution_y = int(SC.render.resolution_y * A.res_scale)
        raw = path[:-4] + ".raw.png"; t0 = time.time(); SC.render.filepath = raw; bpy.ops.render.render(write_still=True); done += 1
        try:
            if A.no_post: plain_jpeg(raw, path)
            else: finish_picture(raw, path, kind == "stills", seed=done)
            os.remove(raw)
        except Exception as e:
            print("finishing step failed, keeping the plain render:", e, flush=True)
            try: plain_jpeg(raw, path); os.remove(raw)
            except Exception as e2: print("could not write the JPEG either, the PNG is kept:", raw, e2, flush=True)
        rec["seconds"] = round(time.time() - t0, 1); manifest["renders"].append(rec)
        left = len(jobs) - len(manifest["renders"]); avg = (time.time() - t_all) / max(1, done)
        print(f"[{len(manifest['renders'])}/{len(jobs)}] {rec['file']}  {rec['seconds']} s   about {round(left * avg / 60)} min left", flush=True)
        json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
print(f"\nDone. {done} new pictures in {OUT}\nZip that folder and send it back.\n", flush=True)
