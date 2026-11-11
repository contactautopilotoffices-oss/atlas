"""F1 Skymark (Sector 6, Noida): procedural facade reconstruction in Blender.

A reusable bpy module. Every dimension comes from facade_parameters.json,
which records where each number came from and how confident it is.

Run headless (bpy 5.2.3, the same version as scripts/world/):

    python3 -m venv .bvenv && .bvenv/bin/pip install bpy==5.2.3 pillow pyarrow shapely
    .bvenv/bin/python noida-skymark/reconstruction/fetch_context.py \
        noida-skymark/reconstruction/context_overture.json 650
    .bvenv/bin/python noida-skymark/reconstruction/skymark_reconstruction.py \
        --params noida-skymark/reconstruction/facade_parameters.json \
        --out noida-skymark --blend noida-skymark/exports/fm_skymark_v1.blend \
        --context noida-skymark/reconstruction/context_overture.json \
        --notes noida-skymark/reconstruction/photo_comparison_notes.json

What a run does:

  1. opens the existing model (--blend), audits it as found, and sets it
     aside inside the file under a V1_ prefix; it is never edited
  2. builds the upgrade in its own collection, SKY_Reconstruction, under
     one root (FM_SKYMARK) with a group per facade
  3. adds the real surroundings within 500 m from Overture Maps footprints
     and roads (--context)
  4. renders the reference, front, side, three-quarter and context views,
     and the reference view with the photograph's landmarks drawn on it
  5. saves exports/fm_skymark_final.blend, exports fm_skymark_atlas.glb and
     fm_skymark_context_500m.glb, reopens both and checks them, and writes
     reconstruction/validation_report.json

Generators (each takes the params dict and the frame, returns its objects):
  generate_curtain_wall, generate_glass_panels, generate_mullions,
  generate_cladding_panels, generate_floor_bands,
  generate_angular_facade_frame, generate_signage_zones, generate_entrance,
  generate_core_massing, generate_site, apply_facade_materials

Every facade detail is geometry: glass panes, mullions, transoms, slab-edge
bands, cladding panels with joints, the frame's members. No image textures.
Each component is its own object and carries custom properties:
sky_component, sky_confidence, sky_source, sky_observed, sky_group.
"""
import argparse
import json
import math
import random
import os
import shutil
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

COLL_NAME = "SKY_Reconstruction"
ROOT_NAME = "FM_SKYMARK"
EPS = 0.002


# =============================================================== helpers ===
def hexc(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


def conf_of(block, key=None, default="low"):
    c = block.get("confidence", default) if isinstance(block, dict) else default
    if isinstance(c, dict):
        return c.get(key, default) if key else default
    return c


class Frame:
    """Local building frame. Elevation A (front) runs along +X at y = 0 and
    faces -Y. Elevation B (side) runs along +Y at x = 0 and faces -X, with
    its u measured from the far end (y = L_B - u)."""

    def __init__(self, P):
        m = P["massing"]
        self.W = m["front_width_A"]
        self.L = m["side_length_B"]
        self.H = m["parapet_top"]
        self.roof = m["roof_level"]

    def A(self, u, v, out=0.0):
        """Point on elevation A; `out` is distance in front of the face (-Y)."""
        return Vector((u, -out, v))

    def B(self, u, v, out=0.0):
        """Point on elevation B; `out` is distance in front of the face (-X)."""
        return Vector((-out, self.L - u, v))

    def annex_front(self, P, u, v, out=0.0):
        d = P["annex"]["depth"]
        return Vector((u, -d - out, v))


class MeshBuilder:
    """Accumulates boxes and quads into one bmesh, with world-scale box UVs
    (1 UV unit = 1 m) so a texture can be added later without re-unwrapping."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.mat_slots = []
        self.mat_index = {}

    def _slot(self, mat):
        if mat not in self.mat_index:
            self.mat_index[mat] = len(self.mat_slots)
            self.mat_slots.append(mat)
        return self.mat_index[mat]

    def _face(self, verts, mat):
        try:
            f = self.bm.faces.new(verts)
        except ValueError:
            return None
        f.material_index = self._slot(mat)
        f.normal_update()
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            co = loop.vert.co
            if ax == 0:
                loop[self.uv].uv = (co.y, co.z)
            elif ax == 1:
                loop[self.uv].uv = (co.x, co.z)
            else:
                loop[self.uv].uv = (co.x, co.y)
        return f

    def hexa(self, c, mat):
        """Eight corners in the order: bottom quad (0-3) counter-clockwise
        seen from above, then the top quad (4-7) in the same order."""
        v = [self.bm.verts.new(p) for p in c]
        quads = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        for q in quads:
            self._face([v[i] for i in q], mat)

    def box(self, mn, mx, mat):
        (x0, y0, z0), (x1, y1, z1) = mn, mx
        if x1 - x0 < EPS or y1 - y0 < EPS or z1 - z0 < EPS:
            return
        self.hexa([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], mat)

    def slab_between(self, p0, p1, width, depth, normal, mat):
        """A rectangular bar from p0 to p1 (centre line on the facade plane),
        `width` measured in the facade plane across the bar, `depth` pushed
        out along `normal`. Used for inclined frame members."""
        p0, p1, nrm = Vector(p0), Vector(p1), Vector(normal).normalized()
        axis = (p1 - p0)
        if axis.length < EPS:
            return
        side = axis.cross(nrm).normalized() * (width / 2)
        out = nrm * depth
        a0, a1, b0, b1 = p0 - side, p0 + side, p1 - side, p1 + side
        bot = [a0, a1, b1, b0]
        top = [q + out for q in bot]
        # make sure the bottom quad winds counter-clockwise seen along -out
        c = bot
        if ((c[1] - c[0]).cross(c[2] - c[0])).dot(nrm) > 0:
            bot = [bot[0], bot[3], bot[2], bot[1]]
            top = [q + out for q in bot]
        self.hexa([*bot, *top], mat)

    def quad(self, pts, mat):
        v = [self.bm.verts.new(p) for p in pts]
        self._face(v, mat)

    def panelize(self, f, ss, vs, wfn, mats, rng, out0, out1, gap=0.012, wide=(), wide_gap=0.05):
        """Panels on a facade member: one block per cell of the grid `ss`
        (0..1 across the member) by `vs` (heights), each from depth out0 to
        out1, with a real joint of `gap` metres between them (wider on the
        rows listed in `wide`). `f(s, v, out)` gives the point and `wfn(v)`
        the member's width at that height, so cells may be trapezoids.
        `mats` is a weighted list of materials a panel may take."""
        names, weights = zip(*mats)
        for j in range(len(vs) - 1):
            ga = (wide_gap if j in wide else gap) / 2
            gb = (wide_gap if (j + 1) in wide else gap) / 2
            va, vb = vs[j] + ga, vs[j + 1] - gb
            if vb - va < 0.02:
                continue
            da, db = gap / 2 / max(wfn(va), 1e-3), gap / 2 / max(wfn(vb), 1e-3)
            for i in range(len(ss) - 1):
                a0, a1, b0, b1 = ss[i] + da, ss[i + 1] - da, ss[i] + db, ss[i + 1] - db
                self.hexa([f(a0, va, out0), f(a1, va, out0), f(b1, vb, out0), f(b0, vb, out0),
                           f(a0, va, out1), f(a1, va, out1), f(b1, vb, out1), f(b0, vb, out1)], rng.choices(names, weights=weights)[0])

    def _new_faces(self, verts, mat):
        idx = self._slot(mat)
        for fc in {fc for v in verts for fc in v.link_faces}:
            fc.material_index = idx

    def cone(self, base, r1, r2, depth, mat, segments=7):
        r = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r1, radius2=r2, depth=depth,
                                  matrix=Matrix.Translation((base[0], base[1], base[2] + depth / 2)))
        self._new_faces(r["verts"], mat)

    def ico(self, centre, radius, mat, squash=1.0):
        r = bmesh.ops.create_icosphere(self.bm, subdivisions=2, radius=radius,
                                       matrix=Matrix.Translation(centre) @ Matrix.Diagonal((1.0, 1.0, squash, 1.0)))
        self._new_faces(r["verts"], mat)

    def to_object(self, coll, props):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=0.0005)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mat_slots:
            me.materials.append(MATS[m])
        ob = bpy.data.objects.new(self.name, me)
        coll.objects.link(ob)
        for k, v in props.items():
            ob[k] = v
        return ob


def tag(component, confidence, source, observed=True):
    return {"sky_component": component, "sky_confidence": confidence,
            "sky_source": source, "sky_observed": bool(observed)}


def sub_collection(name):
    root = bpy.data.collections.get(COLL_NAME)
    full = f"{COLL_NAME}_{name}"
    c = bpy.data.collections.get(full)
    if c is None:
        c = bpy.data.collections.new(full)
        root.children.link(c)
    return c


# ============================================================= materials ===
MATS = {}
MAT_NAMES = {
    "glass_bluegrey": "SKY_Glass_BlueGrey_Reflective", "glass_dark": "SKY_Glass_DarkTint",
    "cladding_white": "SKY_Cladding_WhiteLightGrey", "aluminium": "SKY_Aluminium_Frame",
    "aluminium_dark": "SKY_Aluminium_Dark_Mullion", "joint_dark": "SKY_Joint_Shadow",
    "concrete": "SKY_Concrete", "paving": "SKY_Ground_Paving", "asphalt": "SKY_Asphalt",
    "accent_brown": "SKY_Accent_BrownPanel", "roof_membrane": "SKY_Roof_Membrane",
    "kerb_yellow": "SKY_Kerb_Yellow", "kerb_black": "SKY_Kerb_Black",
    "leaf": "SKY_Vegetation_Leaf", "trunk": "SKY_Vegetation_Trunk",
    "context_building": "SKY_Context_Building", "context_road": "SKY_Context_Road", "context_ground": "SKY_Context_Ground",
}
MAT_DEFAULTS = {
    "glass_bluegrey": {"base": "#4f6f8c", "metallic": 0.9, "roughness": 0.05},
    "glass_dark": {"base": "#18222c", "metallic": 0.85, "roughness": 0.07},
    "cladding_white": {"base": "#e4e6e6", "metallic": 0.0, "roughness": 0.38},
    "aluminium": {"base": "#aab0b6", "metallic": 1.0, "roughness": 0.35},
    "aluminium_dark": {"base": "#2e3338", "metallic": 0.8, "roughness": 0.4},
    "joint_dark": {"base": "#22252a", "metallic": 0.0, "roughness": 0.85},
    "concrete": {"base": "#8b8781", "metallic": 0.0, "roughness": 0.9},
    "paving": {"base": "#8f8a80", "metallic": 0.0, "roughness": 0.95},
    "asphalt": {"base": "#3d3e41", "metallic": 0.0, "roughness": 0.92},
    "accent_brown": {"base": "#4b2b1c", "metallic": 0.1, "roughness": 0.55},
    "roof_membrane": {"base": "#b9bbb8", "metallic": 0.0, "roughness": 0.85},
    "kerb_yellow": {"base": "#e0b81f", "metallic": 0.0, "roughness": 0.8},
    "kerb_black": {"base": "#1c1c1c", "metallic": 0.0, "roughness": 0.8},
    "leaf": {"base": "#3f6b2e", "metallic": 0.0, "roughness": 0.85},
    "trunk": {"base": "#6a543c", "metallic": 0.0, "roughness": 0.9},
    "context_building": {"base": "#cfc8bd", "metallic": 0.0, "roughness": 0.9},
    "context_road": {"base": "#4a4a4d", "metallic": 0.0, "roughness": 0.95},
    "context_ground": {"base": "#b3ab9c", "metallic": 0.0, "roughness": 1.0},
}
# Slight pane-to-pane and panel-to-panel variation: each key maps to the
# materials a pane or panel may take, with weights.
VARIANTS = {}


def _shade(h, k):
    h = h.lstrip("#")
    return "#" + "".join(f"{max(0, min(255, round(int(h[i:i + 2], 16) * k))):02x}" for i in (0, 2, 4))


def apply_facade_materials(P):
    """PBR materials (Principled BSDF, exported as glTF metallic-roughness).
    Values come from P['materials'], with MAT_DEFAULTS for anything missing.
    Glass and cladding each get two close variants so panes and panels are
    not all one flat tone. Glass is a tinted reflective surface, not an
    opaque blue: almost all of what it shows is reflection."""
    spec = {**MAT_DEFAULTS, **P.get("materials", {})}
    for key, s in spec.items():
        MATS[key] = _material(MAT_NAMES.get(key, "SKY_" + key), s["base"], s["metallic"], s["roughness"])

    def variant(key, suffix, k, dr):
        s = spec[key]
        MATS[key + suffix] = _material(MAT_NAMES[key] + suffix.upper(), _shade(s["base"], k), s["metallic"], max(0.02, s["roughness"] + dr))
        return key + suffix

    VARIANTS["glass_bluegrey"] = [("glass_bluegrey", 6), (variant("glass_bluegrey", "_b", 0.90, 0.03), 2), (variant("glass_bluegrey", "_c", 1.08, -0.02), 2)]
    VARIANTS["glass_dark"] = [("glass_dark", 6), (variant("glass_dark", "_b", 1.25, 0.03), 3)]
    VARIANTS["cladding_white"] = [("cladding_white", 7), (variant("cladding_white", "_b", 0.955, 0.04), 2)]
    VARIANTS["accent_brown"] = [("accent_brown", 5), (variant("accent_brown", "_b", 1.12, 0.03), 2)]
    MATS["leaf_b"] = _material("SKY_Vegetation_Leaf_B", _shade(spec["leaf"]["base"], 1.25), 0.0, 0.85)
    for sg in P.get("signage", []):
        for side in ("bg_left", "bg_right", "text_color", "mark_color"):
            if sg.get(side):
                _sign_mat(sg[side], emit=0.0 if side == "text_color" else 0.15)
    return list(MATS.values())


def _material(name, base, metal, rough, emit=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hexc(base)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = hexc(base)
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = hexc(base)
    m["sky_pbr"] = json.dumps({"base": base, "metallic": metal, "roughness": rough})
    return m


def _sign_mat(col, emit=0.0):
    k = "sign_" + col
    if k not in MATS:
        MATS[k] = _material("SKY_Sign_" + col.lstrip("#").upper(), col, 0.0, 0.4, emit=emit)
    return k


def _rng(name):
    return random.Random(sum((i + 1) * ord(c) for i, c in enumerate(name)))


def _pick(rng, key):
    names, weights = zip(*VARIANTS[key])
    return rng.choices(names, weights=weights)[0]


# ============================================================== facades ===
def _pt(F, P, facade, u, v, out=0.0):
    if facade == "A":
        return F.A(u, v, out)
    if facade == "B":
        return F.B(u, v, out)
    return F.annex_front(P, u, v, out)


def _normal(facade):
    return Vector((0, -1, 0)) if facade in ("A", "annex") else Vector((-1, 0, 0))


def _prism(mb, f, s0, s1, v0, v1, out0, out1, mat):
    """A block between two heights and two depths on a facade. `f(s, v, out)`
    gives the point; s runs 0..1 across the member at that height, so the
    block can be a rectangle, a trapezoid or a parallelogram."""
    mb.hexa([f(s0, v0, out0), f(s1, v0, out0), f(s1, v1, out0), f(s0, v1, out0),
             f(s0, v0, out1), f(s1, v0, out1), f(s1, v1, out1), f(s0, v1, out1)], mat)


def _steps(a, b, target):
    n = max(1, round((b - a) / target))
    return [a + (b - a) * i / n for i in range(n + 1)]


def _floor_rows(P, v0, v1, per_floor=3):
    """Row lines for cladding: `per_floor` rows to a floor with a wider joint
    on each slab line, then even rows up the parapet. Returns the heights
    and the indices that sit on a slab line."""
    m = P["massing"]
    f2f, roof = m["floor_to_floor"], m["roof_level"]
    vs, wide, z, k = [v0], set(), v0, 0
    while True:
        k += 1
        z = k * f2f / per_floor
        if z <= v0 + 0.05:
            continue
        if z >= min(v1, roof) - 0.05:
            break
        vs.append(z)
        if k % per_floor == 0:
            wide.add(len(vs) - 1)
    if v1 > roof + 0.2 and roof > v0:
        vs.append(roof); wide.add(len(vs) - 1)
        vs += _steps(roof, v1, 1.1)[1:]
    else:
        vs.append(v1)
    return vs, wide


def _clad(mb, f, wfn, v0, v1, proj, key, rng, ss=None, vs=None, wide=(), pw=1.45, gap=0.012, body="cladding_white", body_from=0.0):
    """Cladding on one member: a body (the member's own depth and returns),
    a dark backing that shows only in the joints, and individual 4 cm panels
    on the face with real joints between them."""
    _prism(mb, f, 0.0, 1.0, v0, v1, body_from, proj - 0.06, body)
    mb.panelize(f, [0.0, 1.0], [v0, v1], wfn, [("joint_dark", 1)], rng, proj - 0.06, proj - 0.04, gap=0.02)
    width = wfn((v0 + v1) / 2)
    ss = ss or _steps(0.0, 1.0, pw / max(width, 0.01))
    vs = vs or _steps(v0, v1, 1.37)
    mb.panelize(f, ss, vs, wfn, VARIANTS[key], rng, proj - 0.04, proj, gap=gap, wide=wide)


def _diag(P):
    """u of the angular frame's leaning edge (its centre line) at height v."""
    fr = P["side_B"]["angular_frame"]

    def f(v):
        t = (v - fr["bottom_v"]) / max(EPS, fr["top_v"] - fr["bottom_v"])
        return fr["bottom_right_u"] + (fr["top_right_u"] - fr["bottom_right_u"]) * t
    return f


def _curtain_regions(P, F):
    """Every glazed region as a dict. `lo` / `hi` are optional functions of
    height, so a region can follow the angular frame's leaning edge. `tilt`
    pushes the bottom edge out (an inclined plane); `recess` sets the whole
    region back from the facade line."""
    A, B, an = P["front_A"], P["side_B"], P["annex"]
    fr, diag = B["angular_frame"], _diag(P)
    w = fr["member_width"]
    R = []

    def add(name, fac, blk, glass, **k):
        r = dict(name=name, fac=fac, glass=glass, u0=blk.get("u0"), u1=blk.get("u1"), v0=blk.get("v0"), v1=blk.get("v1"),
                 ms=blk.get("mullion_spacing", 1.5), ts=blk.get("transom_spacing"), spandrel=False, tilt=0.0, recess=0.0,
                 lo=None, hi=None, mull_mat="aluminium_dark", mull_w=0.06,
                 conf=blk.get("confidence", "low") if not isinstance(blk.get("confidence"), dict) else "low",
                 src=blk.get("source", ""))
        r.update(k)
        R.append(r)

    g = A["glass_block"]
    add("FrontA_CurtainWall", "A", g, "glass_bluegrey", spandrel=g.get("spandrel_at_slabs", True))
    if "dark_recess" in A:
        d = A["dark_recess"]
        add("FrontA_DarkRecess", "A", d, "glass_dark", spandrel=True, recess=d.get("recess", 0.0))
    t = B["top_ribbon"]
    add("SideB_TopRibbon", "B", t, "glass_dark", mull_mat="cladding_white", mull_w=t.get("mullion_w", 0.4))
    if "upper_glazing" in B:
        add("SideB_UpperGlazing", "B", B["upper_glazing"], "glass_dark")
    add("SideB_FrameInfill", "B", fr, "glass_dark", u0=fr["left_u"] + w, u1=fr["bottom_right_u"], v0=fr["bottom_v"] + w, v1=fr["top_v"] - w,
        ms=1.5, ts=P["massing"]["floor_to_floor"] / 2, spandrel=True, recess=fr.get("infill_recess", 0.3), hi=lambda v: diag(v) - w / 2)
    sg = B["slanted_glazing"]
    add("SideB_SlantedGlazing", "B", sg, "glass_bluegrey", u0=fr["top_right_u"], spandrel=True, tilt=sg.get("tilt_out_at_bottom", 0.0),
        lo=lambda v: diag(v) + w / 2)
    add("SideB_GroundBase", "B", B["ground_base"], "glass_dark", ms=B["ground_base"]["pilaster_spacing"] / 2)
    ac = conf_of(an, "height")
    ff, gf = an["first_floor_glazing"], an["ground_glazing"]
    add("Annex_FirstFloor", "annex", ff, "glass_bluegrey", u0=an["u0"] + 0.4, u1=an["u1"] - 0.4, conf=ac, src=an["source"])
    add("Annex_Ground", "annex", gf, "glass_dark", u0=an["u0"] + 0.4, u1=an["u1"] - 0.4, conf=ac, src=an["source"])
    return R


def _rows(r):
    n = max(1, round((r["v1"] - r["v0"]) / r["ts"])) if r["ts"] else 1
    return [(r["v0"] + (r["v1"] - r["v0"]) * i / n, r["v0"] + (r["v1"] - r["v0"]) * (i + 1) / n) for i in range(n)]


def _span(r, v):
    return (r["lo"](v) if r["lo"] else r["u0"]), (r["hi"](v) if r["hi"] else r["u1"])


def _out(r, v):
    return r["tilt"] * (1 - (v - r["v0"]) / max(EPS, r["v1"] - r["v0"])) - r["recess"]


def _cols(r, va, vb):
    (a0, a1), (b0, b1) = _span(r, va), _span(r, vb)
    return max(1, round((max(a1, b1) - min(a0, b0)) / r["ms"]))


def generate_curtain_wall(P, F):
    """The curtain wall carrier for each glazed region: head and sill
    members that close the opening. Glass, mullions and floor bands are
    separate components so each can be changed on its own."""
    c = sub_collection("CurtainWall")
    obs = []
    for r in _curtain_regions(P, F):
        mb = MeshBuilder(f"SKY_{r['name']}_HeadSill")
        n = _normal(r["fac"])
        for v in (r["v0"], r["v1"]):
            u0, u1 = _span(r, v)
            o = _out(r, v)
            mb.slab_between(_pt(F, P, r["fac"], u0, v, o), _pt(F, P, r["fac"], u1, v, o), 0.12, 0.2, n, "aluminium_dark")
        obs.append(mb.to_object(c, tag("curtain_wall_head_sill", r["conf"], r["src"])))
    return obs


def generate_glass_panels(P, F, jitter=0.009):
    """Glass as real panes: one quad per bay and row, set 12 cm behind the
    mullion faces. Each pane is tipped a few millimetres out of plane, as
    installed glass is, so the reflection breaks from pane to pane, and each
    takes one of three close tints. Seeded, so a rebuild gives the same wall."""
    c = sub_collection("Glass")
    obs = []
    for r in _curtain_regions(P, F):
        mb = MeshBuilder(f"SKY_{r['name']}_Glass")
        rng = _rng(r["name"])
        for va, vb in _rows(r):
            (a0, a1), (b0, b1) = _span(r, va), _span(r, vb)
            oa, ob_ = _out(r, va), _out(r, vb)
            n = _cols(r, va, vb)
            for k in range(n):
                fa0, fa1 = a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n
                fb0, fb1 = b0 + (b1 - b0) * k / n, b0 + (b1 - b0) * (k + 1) / n
                j = [rng.uniform(-jitter, jitter) for _ in range(4)]
                mb.quad([_pt(F, P, r["fac"], fa0, va, oa + j[0]), _pt(F, P, r["fac"], fa1, va, oa + j[1]),
                         _pt(F, P, r["fac"], fb1, vb, ob_ + j[2]), _pt(F, P, r["fac"], fb0, vb, ob_ + j[3])], _pick(rng, r["glass"]))
        ob = mb.to_object(c, tag("glass_panels", r["conf"], r["src"]))
        ob["sky_panes"] = len(ob.data.polygons)
        obs.append(ob)
    return obs


def generate_mullions(P, F, depth=0.13, transom_w=0.06):
    """Vertical mullions and horizontal transoms as bars on every bay and row
    line, standing 13 cm proud of the glass so they cast a line of shadow.
    Curtain walls take dark aluminium; the top ribbon's are white piers."""
    c = sub_collection("Mullions")
    obs = []
    for r in _curtain_regions(P, F):
        mb = MeshBuilder(f"SKY_{r['name']}_Mullions")
        nrm = _normal(r["fac"])
        rows = _rows(r)
        for i, (va, vb) in enumerate(rows):
            (a0, a1), (b0, b1) = _span(r, va), _span(r, vb)
            oa, ob_ = _out(r, va), _out(r, vb)
            n = _cols(r, va, vb)
            for k in range(n + 1):
                fa, fb = a0 + (a1 - a0) * k / n, b0 + (b1 - b0) * k / n
                mb.slab_between(_pt(F, P, r["fac"], fa, va, oa), _pt(F, P, r["fac"], fb, vb, ob_), r["mull_w"], depth, nrm, r["mull_mat"])
            if i < len(rows) - 1:
                mb.slab_between(_pt(F, P, r["fac"], b0, vb, ob_), _pt(F, P, r["fac"], b1, vb, ob_), transom_w, depth - 0.03, nrm, "aluminium_dark")
        obs.append(mb.to_object(c, tag("mullions", r["conf"], r["src"])))
    return obs


def generate_floor_bands(P, F):
    """Slab-edge bands on each curtain wall (dark spandrel glass between two
    aluminium lines), the parapet bands on A and B as panelled cladding, and
    the white ledge above the angular frame. One object per wall."""
    c = sub_collection("FloorBands")
    m = P["massing"]
    obs = []
    h = P["front_A"]["glass_block"].get("spandrel_h", 0.55)
    for r in _curtain_regions(P, F):
        if not r["spandrel"]:
            continue
        mb = MeshBuilder(f"SKY_{r['name']}_SlabEdgeBands")
        n = _normal(r["fac"])
        for i in range(1, m["floors_above_ground"] + 1):
            z = i * m["floor_to_floor"] - h / 2
            if z - h / 2 <= r["v0"] + 0.2 or z + h / 2 >= r["v1"] - 0.2:
                continue
            u0, u1 = _span(r, z)
            o = _out(r, z)
            mb.slab_between(_pt(F, P, r["fac"], u0, z, o), _pt(F, P, r["fac"], u1, z, o), h, 0.1, n, "glass_dark")
            for dz in (-h / 2, h / 2):
                a0, a1 = _span(r, z + dz)
                oo = _out(r, z + dz)
                mb.slab_between(_pt(F, P, r["fac"], a0, z + dz, oo), _pt(F, P, r["fac"], a1, z + dz, oo), 0.07, 0.17, n, "aluminium_dark")
        if mb.bm.faces:
            obs.append(mb.to_object(c, tag("slab_edge_bands", "medium", "photo: a darker horizontal band at every slab edge across the curtain wall")))
    a = P["front_A"]["parapet_band"]
    mb = MeshBuilder("SKY_FrontA_ParapetBand")
    fa = lambda s, v, out: F.A(a["u0"] + (a["u1"] - a["u0"]) * s, v, out)
    _clad(mb, fa, lambda v: a["u1"] - a["u0"], a["v0"], a["v1"], a["projection"], "cladding_white", _rng(mb.name), vs=[a["v0"], a["v1"]])
    obs.append(mb.to_object(c, tag("parapet_band", a["confidence"], a["source"])))
    b = P["side_B"]["parapet_band"]
    mb = MeshBuilder("SKY_SideB_ParapetBand")
    fb = lambda s, v, out: F.B(b["u0"] + (b["u1"] - b["u0"]) * s, v, out)
    _clad(mb, fb, lambda v: b["u1"] - b["u0"], b["v0"], b["v1"], b["projection"], "cladding_white", _rng(mb.name), vs=[b["v0"], b["v1"]])
    obs.append(mb.to_object(c, tag("parapet_band", b["confidence"], b["source"])))
    t = P["side_B"]["frame_top_band"]
    mb = MeshBuilder("SKY_SideB_Ledge_AboveFrame")
    ft = lambda s, v, out: F.B(t["u0"] + (t["u1"] - t["u0"]) * s, v, out)
    _clad(mb, ft, lambda v: t["u1"] - t["u0"], t["v0"], t["v1"], t["projection"], "cladding_white", _rng(mb.name), vs=[t["v0"], t["v1"]])
    obs.append(mb.to_object(c, tag("ledge_above_frame", t["confidence"], t["source"])))
    return obs


# =============================================================== cladding ===
def generate_cladding_panels(P, F):
    """Cladding as individual panels with real joints: the corner pier and
    right pier on A, the end pier and the panel pier on B, the brown accent
    strip, side B's wall plane and pilasters, and the podium's body. Rows
    follow the floors, with a wider joint on every slab line."""
    c = sub_collection("Cladding")
    obs = []
    A, B = P["front_A"], P["side_B"]

    def pier(name, fac, blk, key, comp, pw=1.45, body="cladding_white", floor_rows=True):
        mb = MeshBuilder(name)
        f = lambda s, v, out: _pt(F, P, fac, blk["u0"] + (blk["u1"] - blk["u0"]) * s, v, out)
        vs, wide = _floor_rows(P, blk["v0"], blk["v1"]) if floor_rows else (None, ())
        _clad(mb, f, lambda v: blk["u1"] - blk["u0"], blk["v0"], blk["v1"], blk.get("projection", 0.3), key, _rng(name), vs=vs, wide=wide, pw=pw, body=body)
        obs.append(mb.to_object(c, tag(comp, blk["confidence"], blk["source"])))

    pier("SKY_FrontA_CornerPier_Cladding", "A", A["corner_pier"], "cladding_white", "corner_pier", pw=A["corner_pier"].get("panel_w", 1.5))
    pier("SKY_FrontA_RightPier_Cladding", "A", A["right_pier"], "cladding_white", "right_pier", pw=1.2)
    pier("SKY_SideB_EndPier_Cladding", "B", B["end_pier"], "cladding_white", "end_pier", pw=1.15)
    if "corner_return_pier" in B:
        pier("SKY_SideB_PanelPier_Cladding", "B", B["corner_return_pier"], "cladding_white", "panel_pier")
    pier("SKY_SideB_AccentStrip_Brown", "B", B["accent_strip"], "accent_brown", "accent_strip", pw=1.5, body="accent_brown")
    gb = B["ground_base"]
    mb = MeshBuilder("SKY_SideB_Ground_Pilasters")
    u = gb["u0"] + gb["pilaster_spacing"] / 2
    while u <= gb["u1"] + EPS:
        mb.box((-0.35, F.L - u - gb["pilaster_w"] / 2, 0), (0.0, F.L - u + gb["pilaster_w"] / 2, gb["v1"]), "accent_brown")
        u += gb["pilaster_spacing"]
    obs.append(mb.to_object(c, tag("ground_pilasters", gb["confidence"], gb["source"])))
    mb = MeshBuilder("SKY_SideB_Wall_Plane")
    sbk = B.get("wall_plane_setback", 0.45)   # behind the recessed glazing
    mb.box((sbk, 0.3, 0.0), (sbk + 0.06, F.L - 0.3, B["parapet_band"]["v0"]), "cladding_white")
    obs.append(mb.to_object(c, tag("side_b_wall_plane", "low", "Wall plane behind side B's features; visible only as narrow strips between them")))
    an = P["annex"]
    mb = MeshBuilder("SKY_Annex_Body")
    d, h = an["depth"], an["height"]
    side = an.get("side_walls", "cladding_white")
    sb = an["sign_band"]
    mb.box((an["u0"], -d, 0.0), (an["u0"] + 0.4, 0.0, sb["v0"]), side)
    mb.box((an["u1"] - 0.4, -d, 0.0), (an["u1"], 0.0, sb["v0"]), side)
    mb.box((an["u0"], -d + 0.25, sb["v0"]), (an["u0"] + 0.25, 0.0, sb["v1"]), "cladding_white")     # parapet, left
    mb.box((an["u1"] - 0.25, -d + 0.25, sb["v0"]), (an["u1"], 0.0, sb["v1"]), "cladding_white")     # parapet, right
    mb.box((an["u0"] + 0.25, -d + 0.25, h - 0.9), (an["u1"] - 0.25, -0.05, h - 0.6), "roof_membrane")  # roof, set down
    mb.box((an["u0"] + 0.4, -d, an["first_floor_glazing"]["v1"]), (an["u1"] - 0.4, -d + 0.3, sb["v0"]), "cladding_white")
    mb.box((an["u0"] + 0.4, -d, an["ground_glazing"]["v1"]), (an["u1"] - 0.4, -d + 0.3, an["first_floor_glazing"]["v0"]), "cladding_white")
    mb.box((an["u0"] + 0.4, -d, 0.0), (an["u1"] - 0.4, -d + 0.3, an["ground_glazing"]["v0"]), "concrete")
    mb.box((an["u0"] + 0.4, -d + 0.3, 0.0), (an["u1"] - 0.4, -d + 0.5, sb["v0"]), "glass_dark")
    obs.append(mb.to_object(c, tag("podium_body", conf_of(an, "plan_position"), an["source"])))
    # the podium's fascia: panelled cladding that carries the sign band
    mb = MeshBuilder("SKY_Annex_Fascia_Cladding")
    ff = lambda s, v, out: F.annex_front(P, an["u0"] + (an["u1"] - an["u0"]) * s, v, out - 0.25)
    _clad(mb, ff, lambda v: an["u1"] - an["u0"], sb["v0"], sb["v1"], 0.25, "cladding_white", _rng(mb.name), vs=[sb["v0"], sb["v1"]], pw=1.45)
    obs.append(mb.to_object(c, tag("podium_fascia", conf_of(an, "height"), an["source"])))
    lv = an["first_floor_glazing"].get("louvre_spacing")
    if lv:
        mb = MeshBuilder("SKY_Annex_Louvres")
        z = an["first_floor_glazing"]["v0"] + lv
        while z < an["first_floor_glazing"]["v1"] - 0.2:
            mb.box((an["u0"] + 0.4, -d - 0.28, z - 0.06), (an["u1"] - 0.4, -d - 0.18, z + 0.06), "cladding_white")
            z += lv
        obs.append(mb.to_object(c, tag("podium_louvres", "low", "photo: white horizontal lines across the podium's first-floor glazing")))
    return obs


# ========================================================= angular frame ===
def generate_angular_facade_frame(P, F):
    """The white trapezoid frame on side B as real extruded architecture:
    four box members standing `projection` metres off the wall (a vertical
    one at the far end, a head, a sill, and a leaning one whose foot is
    nearer the corner than its head). The head and sill are cut on the lean
    so every corner meets edge to edge. Each face is clad in panels with
    joints; the returns are the members' own depth. The glazing inside is
    SideB_FrameInfill, set back from the wall line."""
    c = sub_collection("AngularFrame")
    fr = P["side_B"]["angular_frame"]
    w, proj = fr["member_width"], fr["projection"]
    lu, tru, bru, bv, tv = fr["left_u"], fr["top_right_u"], fr["bottom_right_u"], fr["bottom_v"], fr["top_v"]
    b0, t0 = bru - w / 2, tru - w / 2
    uL = lambda v: b0 + (t0 - b0) * (v - bv) / (tv - bv)      # leaning member's inner edge
    mb = MeshBuilder("SKY_SideB_AngularFrame")
    rng = _rng(mb.name)
    members = {
        "post": (lambda s, v, out: F.B(lu + w * s, v, out), lambda v: w, bv, tv, None),
        "head": (lambda s, v, out: F.B(lu + w + (uL(v) - lu - w) * s, v, out), lambda v: uL(v) - lu - w, tv - w, tv, [tv - w, tv]),
        "sill": (lambda s, v, out: F.B(lu + w + (uL(v) - lu - w) * s, v, out), lambda v: uL(v) - lu - w, bv, bv + w, [bv, bv + w]),
        "lean": (lambda s, v, out: F.B(uL(v) + w * s, v, out), lambda v: w, bv, tv, None),
    }
    for key, (f, wfn, v0, v1, vs) in members.items():
        _clad(mb, f, wfn, v0, v1, proj, "cladding_white", rng, vs=vs, pw=1.5 if key in ("head", "sill") else 9.0)
    ob = mb.to_object(c, tag("angular_frame", fr["confidence"], fr["source"]))
    ob["sky_params"] = json.dumps({k: fr[k] for k in ("left_u", "top_right_u", "bottom_right_u", "bottom_v", "top_v", "member_width", "projection")})
    return [ob]


# =============================================================== signage ===
def _text_mesh(text, size, name, mat, extrude=0.05):
    cu = bpy.data.curves.new(name + "_curve", type="FONT")
    cu.body, cu.size, cu.extrude = text, size, extrude
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    tmp = bpy.data.objects.new(name + "_tmp", cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    me.name = name
    me.materials.append(MATS[mat])
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers[0].data
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (co.x, co.y)
    return me


def generate_signage_zones(P, F, standoff=0.1, box=0.12):
    """Each sign is a box on a mounting frame that stands it off the
    cladding (so it casts its own shadow line), in one or two colour fields
    or with a colour tile as the photograph shows, with the visible wording
    as raised lettering in Blender's default font. These mark where the signs
    are and what they say; they are not the brands' artwork."""
    c = sub_collection("Signage")
    obs = []
    for sg in P.get("signage", []):
        host = sg["host"]
        u0, u1, v0, v1 = sg["u0"], sg["u1"], sg["v0"], sg["v1"]
        roof = host == "front_A_roof"
        if host == "front_A":
            yb = -P["front_A"]["corner_pier"]["projection"]
        elif roof:
            yb = -P["front_A"]["parapet_band"]["projection"] + 0.3
        else:
            yb = -P["annex"]["depth"] - 0.0
        y1, y0 = yb - standoff, yb - standoff - box
        split, tile = sg.get("split", 1.0), sg.get("tile")
        H = v1 - v0
        if tile:
            fields = [(u0, u1, sg["bg_right"], 0.0), (tile["u0"], tile["u1"], sg["bg_left"], 0.03)]
            texts = [(sg["text"], tile["u0"], tile["u1"], sg["text_color"])]
            if sg.get("text2"):
                texts.append((sg["text2"], tile["u1"], u1, "#3a3a3a"))
        elif 0.0 < split < 1.0:
            um = u0 + (u1 - u0) * split
            fields = [(u0, um, sg["bg_left"], 0.0), (um, u1, sg["bg_right"], 0.0)]
            texts = [(sg["text"], u0, um, sg["text_color"])]
            if sg.get("text2"):
                texts.append((sg["text2"], um, u1, "#3a3a3a"))
        else:
            fields = [(u0, u1, sg["bg_left"], 0.0)]
            texts = [(sg["text"], u0, u1, sg["text_color"])]
        mb = MeshBuilder(f"SKY_Sign_{sg['id']}_Panel")
        for (fa, fb, col, lift) in fields:
            mb.box((fa, y0 - lift, v0 + (0.08 if lift else 0)), (fb, y1, v1 - (0.08 if lift else 0)), _sign_mat(col, emit=0.15))
        obs.append(mb.to_object(c, tag("signage_panel", sg["confidence"], sg["source"])))
        mt = MeshBuilder(f"SKY_Sign_{sg['id']}_Mount")
        if roof:    # two posts carry the wordmark above the parapet
            for u in (u0 + 0.5, u1 - 0.5):
                mt.box((u - 0.06, y1, v0 - 0.5), (u + 0.06, y1 + 0.12, v1 - 0.2), "aluminium_dark")
        else:       # a frame set in from the sign's edges, between sign and wall
            ins = 0.22
            for (a, b_, za, zb) in ((u0 + ins, u1 - ins, v0 + ins, v0 + ins + 0.08), (u0 + ins, u1 - ins, v1 - ins - 0.08, v1 - ins),
                                    (u0 + ins, u0 + ins + 0.08, v0 + ins + 0.08, v1 - ins - 0.08), (u1 - ins - 0.08, u1 - ins, v0 + ins + 0.08, v1 - ins - 0.08)):
                mt.box((a, y1, za), (b_, yb, zb), "aluminium_dark")
        obs.append(mt.to_object(c, tag("signage_mount", "low", "Mounting assumed (standoff frame); the photograph shows the signs proud of the cladding but not how they are fixed", False)))
        rot = Matrix.Rotation(math.radians(90), 4, "X")
        for i, (txt, ta, tb_, col) in enumerate(texts):
            size = min(H * 0.5, (tb_ - ta) / max(1, len(txt)) * 1.55)
            me = _text_mesh(txt, size, f"SKY_Sign_{sg['id']}_Text{i + 1}", _sign_mat(col))
            ob = bpy.data.objects.new(me.name, me)
            c.objects.link(ob)
            ob.matrix_world = Matrix.Translation(((ta + tb_) / 2, y0 - 0.035, (v0 + v1) / 2)) @ rot
            for k, v in tag("signage_text", sg["confidence"], sg["source"]).items():
                ob[k] = v
            obs.append(ob)
        if sg.get("mark_color"):
            mk = MeshBuilder(f"SKY_Sign_{sg['id']}_Mark")
            s_ = H * 0.42
            cx, cz = u1 - s_ * 0.45, v1 - s_ * 0.4
            for k in range(4):
                ang = math.radians(45 * k)
                dx, dz = math.cos(ang) * s_ / 2, math.sin(ang) * s_ / 2
                mk.slab_between((cx - dx, y0, cz - dz), (cx + dx, y0, cz + dz), s_ * 0.15, 0.05, (0, -1, 0), _sign_mat(sg["mark_color"], emit=0.15))
            obs.append(mk.to_object(c, tag("signage_mark", sg["confidence"], sg["source"])))
    return obs


# ============================================================== entrance ===
def generate_entrance(P, F):
    """Glazed entrance with a slim canopy on the podium front. Its position
    is inferred (the doors are hidden in the photo): observed = false."""
    c = sub_collection("Entrance")
    e = P["entrance"]
    d = P["annex"]["depth"]
    mb = MeshBuilder("SKY_Entrance")
    u0, u1 = e["u0"], e["u1"]
    mb.box((u0, -d - 0.12, 0.0), (u1, -d - 0.02, e["door_h"]), "glass_dark")
    for u in (u0, (u0 + u1) / 2, u1):
        mb.box((u - 0.05, -d - 0.16, 0.0), (u + 0.05, -d - 0.02, e["door_h"]), "aluminium_dark")
    mb.box((u0 - 0.05, -d - 0.16, e["door_h"]), (u1 + 0.05, -d - 0.02, e["door_h"] + 0.12), "aluminium_dark")
    mb.box((u0 - 0.6, -d - e["canopy_depth"], e["canopy_v"]), (u1 + 0.6, -d, e["canopy_v"] + e["canopy_th"]), "cladding_white")
    mb.box((u0 - 0.6, -d - e["canopy_depth"], 0.0), (u1 + 0.6, -d, 0.15), "concrete")
    return [mb.to_object(c, tag("entrance", e["confidence"], e["source"], e.get("observed", False)))]


# ============================================================ mass / roof ==
def generate_core_massing(P, F):
    """Floor slabs and the dark volume behind the glass, the two facades the
    photograph does not show (plain walls, observed = false), and the roof:
    slab, the parapets' inner faces and an aluminium coping on every parapet.
    Roof plant is not modelled: the photograph shows only the mast."""
    c = sub_collection("Massing")
    m = P["massing"]
    B = P["side_B"]
    th = P.get("roof", {}).get("slab_th", 0.3)
    W, L, H, roof = F.W, F.L, F.H, F.roof
    Bp = B["parapet_band"]["v1"]
    ep = B["end_pier"]["u1"]
    pa = P["front_A"]["parapet_band"]["projection"]
    pb = B["parapet_band"]["projection"]
    obs = []
    mb = MeshBuilder("SKY_Floor_Slabs")
    for i in range(m["floors_above_ground"]):
        z = i * m["floor_to_floor"]
        mb.box((0.9, 0.9, z - th), (W - 0.5, L - 0.5, z), "concrete")
    obs.append(mb.to_object(c, tag("floor_slabs", conf_of(m, "floor_to_floor"), m["source"]["floor_to_floor"])))
    core = MeshBuilder("SKY_Interior_Core")
    core.box((2.1, 2.1, 0), (W - 2.2, L - 2.2, roof - th), "glass_dark")
    obs.append(core.to_object(c, tag("interior_core", "low", "Neutral dark volume behind the glazing; the interior is not surveyed", False)))
    mb = MeshBuilder("SKY_FacadeC_Rear_Unobserved")
    mb.box((0.2, L - 0.3, 0), (W, L, H), "cladding_white")
    obs.append(mb.to_object(c, tag("facade_rear", "low", m["hidden_sides"], False)))
    mb = MeshBuilder("SKY_FacadeD_FarSide_Unobserved")
    mb.box((W - 0.3, 0.2, 0), (W, L - 0.3, H), "cladding_white")
    obs.append(mb.to_object(c, tag("facade_far_side", "low", m["hidden_sides"], False)))
    mb = MeshBuilder("SKY_Roof_Slab")
    mb.box((0.2, 0.2, roof - th), (W - 0.3, L - 0.3, roof), "roof_membrane")
    obs.append(mb.to_object(c, tag("roof_slab", "medium", "photo: flat roof behind a parapet; finish not visible")))
    mb = MeshBuilder("SKY_Roof_Parapet_Inner")
    mb.box((0.0, 0.0, roof), (W - 0.3, 0.2, H), "cladding_white")                 # behind A's parapet
    mb.box((0.0, 0.2, roof), (0.2, L - ep, Bp), "cladding_white")                # behind B's parapet (lower)
    mb.box((0.0, L - ep, roof), (0.2, L - 0.3, H), "cladding_white")             # behind the end pier
    obs.append(mb.to_object(c, tag("parapet_inner", "medium", "photo: parapet line continuous along A and B; B's reads about 1 m lower")))
    mb = MeshBuilder("SKY_Roof_Coping")
    o, t = 0.05, 0.06
    mb.box((-o, -pa - o, H), (W + o, 0.2 + o, H + t), "aluminium")                # along A
    mb.box((-pb - o, 0.2 + o, Bp), (0.2 + o, L - ep, Bp + t), "aluminium")        # along B
    mb.box((-pb - o, L - ep, H), (0.2 + o, L + o, H + t), "aluminium")            # end pier
    mb.box((0.2 + o, L - 0.3 - o, H), (W + o, L + o, H + t), "aluminium")         # rear
    mb.box((W - 0.3 - o, 0.2 + o, H), (W + o, L - 0.3 - o, H + t), "aluminium")   # far side
    obs.append(mb.to_object(c, tag("parapet_coping", "low", "Coping assumed: every parapet has one, but its profile is too small to read in the photograph", False)))
    ms = P.get("roof", {}).get("mast")
    if ms:
        mb = MeshBuilder("SKY_Roof_TelecomMast")
        b, h, x, y, z0 = ms["base"], ms["height"], ms["x"], ms["y"], roof
        for (lx, ly) in ((x - b / 2, y - b / 2), (x + b / 2, y - b / 2), (x + b / 2, y + b / 2), (x - b / 2, y + b / 2)):
            mb.slab_between((lx, ly, z0), (x + (lx - x) * 0.3, y + (ly - y) * 0.3, z0 + h), 0.08, 0.08, (1, 0, 0), "aluminium")
        for k in range(1, 6):
            zz = z0 + h * k / 6
            s = b / 2 * (1 - 0.7 * k / 6)
            mb.box((x - s, y - s, zz), (x + s, y + s, zz + 0.05), "aluminium")
        mb.slab_between((x, y, z0 + h), (x, y, z0 + h + 2.0), 0.06, 0.06, (1, 0, 0), "aluminium")
        obs.append(mb.to_object(c, tag("roof_mast", ms["confidence"], ms["source"])))
    return obs


# ================================================================= site ====
def generate_site(P, F):
    """What the photograph shows at ground level: plot paving, the boundary
    wall and footpath on side B, the yellow and black kerb, palms by the
    front glass and trees along side B. Positions are approximate (they are
    read from one oblique photo) and every piece says so."""
    c = sub_collection("Site")
    s = P["site"]
    d = P["annex"]["depth"]
    W, L = F.W, F.L
    mB, mF, mO = s.get("margin_side_B", 6.0), s.get("margin_front", 3.0), s.get("margin_other", 2.0)
    x0, y0, x1, y1 = -mB, -d - mF, W + mO, L + mO
    h = s["boundary_wall_h"]
    src = "photo: read from one oblique view; positions approximate"
    obs = []
    mb = MeshBuilder("SKY_Site_Paving")
    mb.box((x0, y0, -0.3), (x1, y1, 0.0), "paving")
    mb.box((P["annex"]["u0"] - 1.0, y0 - 2.0, -0.3), (P["annex"]["u1"] + 1.0, y0, 0.01), "asphalt")     # driveway apron
    obs.append(mb.to_object(c, tag("site_paving", s["confidence"], s["source"])))
    mb = MeshBuilder("SKY_Site_BoundaryWall")
    g0, g1 = P["annex"]["u0"] - 1.0, P["annex"]["u1"] + 1.0
    mb.box((x0, y0, 0), (g0, y0 + 0.25, h), "concrete")
    mb.box((g1, y0, 0), (x1, y0 + 0.25, h), "concrete")
    mb.box((x0, y0 + 0.25, 0), (x0 + 0.25, y1, h), "concrete")
    obs.append(mb.to_object(c, tag("boundary_wall", "low", "photo: low wall along the road on side B; the gate is inferred at the podium")))
    mb = MeshBuilder("SKY_Site_Footpath_Kerb")
    mb.box((x0 - 1.6, y0, -0.3), (x0, y1, 0.12), "concrete")
    n, seg = 0, 1.0
    y = y0
    while y < y1 - 0.01:
        mb.box((x0 - 1.85, y, -0.3), (x0 - 1.6, min(y + seg, y1), 0.16), "kerb_yellow" if n % 2 == 0 else "kerb_black")
        y += seg; n += 1
    obs.append(mb.to_object(c, tag("footpath_kerb", "low", "photo: yellow and black kerb along the road; " + src)))

    def tree(name, x, y, height, crown, conf="low"):
        t = MeshBuilder(name)
        t.cone((x, y, 0), 0.22, 0.14, height * 0.55, "trunk")
        rng = _rng(name)
        t.ico((x, y, height * 0.62), crown, "leaf", squash=0.8)
        t.ico((x + rng.uniform(-1, 1) * crown * 0.5, y + rng.uniform(-1, 1) * crown * 0.5, height * 0.8), crown * 0.7, "leaf_b", squash=0.8)
        return t.to_object(c, tag("tree", conf, "photo: trees along side B's boundary; " + src))

    def palm(name, x, y, height):
        t = MeshBuilder(name)
        t.cone((x, y, 0), 0.2, 0.13, height, "trunk")
        for k in range(9):
            a = 2 * math.pi * k / 9
            dx, dy = math.cos(a), math.sin(a)
            px, py = -dy * 0.28, dx * 0.28
            top = Vector((x, y, height))
            mid = top + Vector((dx * 1.5, dy * 1.5, 0.45))
            tip = top + Vector((dx * 3.0, dy * 3.0, -0.9))
            t.quad([top + Vector((px, py, 0)), top - Vector((px, py, 0)), mid - Vector((px * 1.4, py * 1.4, 0)), mid + Vector((px * 1.4, py * 1.4, 0))], "leaf")
            t.quad([mid + Vector((px * 1.4, py * 1.4, 0)), mid - Vector((px * 1.4, py * 1.4, 0)), tip - Vector((px * 0.3, py * 0.3, 0)), tip + Vector((px * 0.3, py * 0.3, 0))], "leaf_b")
        return t.to_object(c, tag("palm", "low", "photo: palms in front of the front glazing; " + src))

    for i, (u, yy, hh) in enumerate(s.get("palms", [])):
        obs.append(palm(f"SKY_Site_Palm_{i + 1}", u, yy, hh))
    ty = s.get("trees_side_B", {"count": 5, "height": 8.0})
    for i in range(ty["count"]):
        yy = 5.0 + (L - 10.0) * i / max(1, ty["count"] - 1)
        obs.append(tree(f"SKY_Site_Tree_{i + 1}", x0 + 2.2, yy, ty["height"] * (0.9 + 0.2 * ((i * 7) % 3) / 2), 2.4))
    return obs


# ============================================================== context ====
def site_fit(P, F):
    """Where the twin stands in the real street grid (east/north metres from
    the published pin). The photographed corner sits on a corner of the
    assumed footprint; `front_bearing` is the way the front faces. Returns
    the rotation (about up, counter-clockwise) and the corner, or None."""
    mp = P.get("map", {})
    if mp.get("corner_enu") is None or mp.get("front_bearing_deg") is None:
        return None
    return math.radians(180.0 - mp["front_bearing_deg"]), Vector((mp["corner_enu"][0], mp["corner_enu"][1], 0.0))


def build_context(P, F, path, tex_dir, radius=500.0):
    """The real 500 m round the twin, built by skymark_context.py the way
    the Andheri East world is built. Returns (root, info, near) or None."""
    if site_fit(P, F) is None or not path or not os.path.exists(path):
        return None
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import skymark_context
    rc = P["reference_camera"]
    yaw = math.radians(rc["yaw_from_front_normal_deg"]); dist = rc["distance_to_corner_m"]
    fc = (F.W / 2, (F.L - P["annex"]["depth"]) / 2)
    cam = (-math.sin(yaw) * dist - fc[0], -math.cos(yaw) * dist - fc[1])
    mid = ((cam[0] - fc[0]) / 2, (cam[1] - fc[1]) / 2)
    root, info, near = skymark_context.build(P, F, path, tex_dir, radius=radius, near_points=[cam, mid], near_r=48.0)
    root.location = (fc[0], fc[1], 0.0)
    return root, info, near


# ================================================================ audit ====
def _mesh_stats(ob):
    if ob.type != "MESH":
        return None
    me = ob.data
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    return {"vertices": len(me.vertices), "faces": len(me.polygons), "triangles": tris,
            "uv_layers": [u.name for u in me.uv_layers], "materials": [m.name for m in me.materials if m]}


def _world_bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def _principled(m):
    try:
        b = m.node_tree.nodes.get("Principled BSDF")
        return {"base_color": list(b.inputs["Base Color"].default_value), "metallic": b.inputs["Metallic"].default_value,
                "roughness": b.inputs["Roughness"].default_value}
    except Exception:
        return None


def audit_scene(source_blend):
    """Inventory of the scene as opened, before anything is changed."""
    sc = bpy.context.scene
    objs = list(bpy.data.objects)

    def coll_tree(c):
        return {"name": c.name, "objects": [o.name for o in c.objects], "children": [coll_tree(ch) for ch in c.children]}

    inv = []
    for o in objs:
        mn, mx = _world_bbox(o)
        inv.append({"name": o.name, "type": o.type, "parent": o.parent.name if o.parent else None,
                    "collections": [c.name for c in o.users_collection],
                    "location": list(o.location), "rotation_euler_deg": [math.degrees(a) for a in o.rotation_euler],
                    "scale": list(o.scale), "dimensions": list(o.dimensions),
                    "world_bbox_min": list(mn), "world_bbox_max": list(mx), "mesh": _mesh_stats(o),
                    "custom_properties": {k: (o[k] if isinstance(o[k], (int, float, str, bool)) else str(o[k])) for k in o.keys()}})
    meshes = [o for o in objs if o.type == "MESH" and "RenderOnly" not in o.name]
    named = lambda *keys: sorted(o.name for o in meshes if any(k in o.name for k in keys))
    mats = [{"name": m.name, "users": m.users, "principled": _principled(m)} for m in bpy.data.materials]
    cams = [{"name": o.name, "type": o.data.type, "lens_mm": o.data.lens, "sensor_width": o.data.sensor_width,
             "location": list(o.location), "rotation_euler_deg": [math.degrees(a) for a in o.rotation_euler]} for o in objs if o.type == "CAMERA"]
    if meshes:
        bbs = [_world_bbox(o) for o in meshes]
        omn = Vector((min(b[0].x for b in bbs), min(b[0].y for b in bbs), min(b[0].z for b in bbs)))
        omx = Vector((max(b[1].x for b in bbs), max(b[1].y for b in bbs), max(b[1].z for b in bbs)))
    else:
        omn = omx = Vector((0, 0, 0))
    glass = [o for o in meshes if o.name.endswith("_Glass")]
    audit = {
        "source_blend": source_blend, "existing_model_found": bool(meshes),
        "finding": ("The existing model is the iteration 1 reconstruction. Its glass is real geometry: one quad per pane "
                    f"({sum(len(o.data.polygons) for o in glass)} panes in {len(glass)} objects), with separate mullion and transom bars. "
                    "Nothing is a texture; no material uses an image." if meshes else
                    "No existing .blend for this building was found, so the audit is of an empty scene."),
        "blender_version": bpy.app.version_string,
        "unit_system": sc.unit_settings.system, "scale_length": sc.unit_settings.scale_length, "up_axis": "Z (Blender)",
        "collections": coll_tree(sc.collection), "object_count": len(objs), "mesh_count": len(meshes),
        "total_triangles": sum(_mesh_stats(o)["triangles"] for o in meshes),
        "identified": {
            "main_building_mesh": named("Hidden_Rear_Massing", "Floor_Slabs", "Interior_Core", "FacadeC", "FacadeD"),
            "front_glazed_elevation": named("FrontA_CurtainWall", "FrontA_DarkRecess"),
            "side_glazed_elevation": named("SideB_SlantedGlazing", "SideB_FrameInfill", "SideB_TopRibbon", "SideB_UpperGlazing", "SideB_GroundBase"),
            "angular_white_frame": named("AngularFrame"),
            "central_cladding_block": named("CornerPier"),
            "podium": named("Annex", "Entrance"),
            "roof": named("Roof", "Parapet"),
            "signage": named("Sign_"),
        },
        "images_used_by_materials": sorted(i.name for i in bpy.data.images if i.users and i.name not in ("Render Result", "Viewer Node")),
        "cameras": cams,
        "render": {"engine": sc.render.engine, "resolution": [sc.render.resolution_x, sc.render.resolution_y],
                   "resolution_percentage": sc.render.resolution_percentage},
        "scale_and_orientation": ("No geometry to measure." if not meshes else
                                  f"Metres, Z up. Building bounds {[round(v, 2) for v in omn]} to {[round(v, 2) for v in omx]}. "
                                  "Local frame: origin at the photographed corner, front along +X facing -Y, side B along +Y facing -X."),
    }
    dims = {"overall_world_bbox_min": list(omn), "overall_world_bbox_max": list(omx), "overall_size_m": list(omx - omn),
            "per_object": {o.name: [round(v, 3) for v in o.dimensions] for o in meshes}}
    return audit, inv, mats, dims


def preserve_existing(prefix="V1_"):
    """Keep the model that was in the file, untouched, under a prefix: its
    collections, objects, meshes and materials are renamed and hidden from
    render, so the upgrade is built beside it and never edits it."""
    kept = 0
    for c in list(bpy.data.collections):
        if not c.name.startswith(prefix):
            c.name = prefix + c.name
            c.hide_render = True
            c.hide_viewport = True
    for o in list(bpy.data.objects):
        if not o.name.startswith(prefix):
            o.name = prefix + o.name
            o.hide_render = True
            kept += 1
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for x in list(blk):
            if not x.name.startswith(prefix):
                x.name = prefix + x.name
    return kept


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=lambda x: list(x) if hasattr(x, "__iter__") else str(x))


# =============================================================== render ====
def setup_world(sc, to_sun=(-0.42, -0.72, 0.55), clouds=True):
    """Daylight to match the photograph: a clear sky with broken cloud for
    the glass to reflect, and a sun from the front left. This is lighting for
    the stills, not a sun study for the site."""
    w = bpy.data.worlds.new("SKY_World")
    sc.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    sky = nt.nodes.new("ShaderNodeTexSky")
    for t in ("MULTIPLE_SCATTERING", "NISHITA"):
        try:
            sky.sky_type = t
            break
        except Exception:
            pass
    d = Vector(to_sun).normalized()
    try:
        sky.sun_elevation = math.asin(d.z); sky.sun_rotation = math.atan2(d.x, d.y)
        sky.altitude = 200; sky.air_density = 1.0; sky.aerosol_density = 1.6; sky.sun_intensity = 0.25
    except Exception:
        pass
    out = sky.outputs[0]
    if clouds:
        try:
            tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (1.0, 1.0, 3.2)
            nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.6; nz.inputs["Detail"].default_value = 7.0
            ramp = nt.nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].position = 0.5; ramp.color_ramp.elements[1].position = 0.72
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
            nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
            nt.links.new(nz.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], mix.inputs[0])
            nt.links.new(sky.outputs[0], mix.inputs[6]); mix.inputs[7].default_value = (2.4, 2.4, 2.45, 1.0)
            out = mix.outputs[2]
        except Exception as e:
            print("clouds skipped:", e)
    nt.links.new(out, bg.inputs[0])
    bg.inputs[1].default_value = 0.33
    sun = bpy.data.lights.new("SKY_Sun", "SUN")
    sun.energy = 3.4; sun.angle = math.radians(1.0); sun.color = (1, 0.95, 0.87)
    so = bpy.data.objects.new("SKY_Sun", sun)
    render_collection().objects.link(so)
    so.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    return so


def render_collection():
    c = bpy.data.collections.get("SKY_RenderOnly")
    if c is None:
        c = bpy.data.collections.new("SKY_RenderOnly")
        bpy.context.scene.collection.children.link(c)
    return c


def render_ground(size=900.0):
    """A plain ground under the stills when there is no context. Render only."""
    MATS.setdefault("sky_render_ground", _material("SKY_RenderOnly_Ground", "#9a958a", 0.0, 0.95))
    mb = MeshBuilder("SKY_RenderOnly_Ground")
    mb.box((-size, -size, -0.6), (size, size, -0.33), "sky_render_ground")
    return mb.to_object(render_collection(), {"sky_component": "render_only"})


def make_camera(name, loc, look, lens=35.0, sensor=36.0, ortho=None, clip_start=0.1):
    cd = bpy.data.cameras.new(name)
    cd.lens, cd.sensor_width, cd.clip_start, cd.clip_end = lens, sensor, clip_start, 6000
    cd.sensor_fit = "AUTO"
    if ortho:
        cd.type = "ORTHO"; cd.ortho_scale = ortho
    ob = bpy.data.objects.new(name, cd)
    render_collection().objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def reference_camera(P, F):
    rc = P["reference_camera"]
    yaw = math.radians(rc["yaw_from_front_normal_deg"])
    dist = rc["distance_to_corner_m"]
    loc = (-math.sin(yaw) * dist, -math.cos(yaw) * dist, rc["height_m"])   # in front of A, swung toward side B
    cam = make_camera("SKY_Cam_Reference_Photo", loc, rc["look_at"], lens=rc["lens_mm"], sensor=rc["sensor_width_mm"],
                      clip_start=rc.get("clip_start_m", 0.1))
    cam["sky_confidence"] = rc["confidence"]; cam["sky_source"] = rc["source"]
    return cam


def render_views(P, F, out_dir, samples=96, scale=1.0, context=None, near=None):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    W, L, H = F.W, F.L, F.H
    cx, cy = W / 2, (L - P["annex"]["depth"]) / 2
    rx, ry = P["reference_camera"]["aspect"]
    views = [
        ("01_reference_camera", reference_camera(P, F), (round(rx * 1.5), round(ry * 1.5)), True),
        ("02_front_elevation", make_camera("SKY_Cam_Front_Elevation", (cx, -140, H / 2 + 1), (cx, 0, H / 2 + 1), ortho=max(W, H) * 1.5), (1600, 1100), False),
        ("03_side_elevation", make_camera("SKY_Cam_Side_Elevation", (-140, cy, H / 2 + 1), (0, cy, H / 2 + 1), ortho=max(L, H) * 1.35), (1600, 1000), False),
        ("04_three_quarter", make_camera("SKY_Cam_Three_Quarter", (cx - 78, cy - 102, 52), (cx - 2, cy - 3, 9), lens=36), (1600, 1100), True),
        ("05_context_500m", make_camera("SKY_Cam_Context_500m", (cx - 640, cy - 900, 830), (cx + 20, cy + 40, -40), lens=34, clip_start=5), (1800, 1200), True),
        ("06_context_close", make_camera("SKY_Cam_Context_Close", (cx - 150, cy - 205, 115), (cx, cy, 6), lens=40, clip_start=5), (1600, 1100), True),
    ]
    os.makedirs(out_dir, exist_ok=True)
    paths = {}
    ctx_all = ([context] + list(context.children_recursive)) if context is not None else []
    protos = {o.name for o in ctx_all if o.name.startswith("ctx_")}
    for k, cam, (w, h), with_ctx in views:
        if context is not None:
            for o in ctx_all:
                o.hide_render = (not with_ctx) or o.name in protos or (k == "01_reference_camera" and o in (near or []))
        elif k == "05_context_500m":
            continue
        sc.camera = cam
        # The dollhouse views sit on a dark backdrop, as the Andheri world
        # does: rendered with a transparent film, then laid on a gradient.
        sc.render.film_transparent = k.startswith("05_")
        sc.render.resolution_x, sc.render.resolution_y = round(w * scale), round(h * scale)
        sc.render.resolution_percentage = 100
        p = os.path.join(out_dir, k + ".jpg")
        if sc.render.film_transparent:
            tmp = os.path.join(out_dir, k + ".tmp.png")
            sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
            sc.render.filepath = tmp
            bpy.ops.render.render(write_still=True)
            backdrop(tmp, p)
            os.remove(tmp)
            sc.render.image_settings.color_mode = "RGB"
        else:
            sc.render.image_settings.file_format = "JPEG"
            sc.render.image_settings.quality = 90
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
        paths[k] = p
        print("rendered", p, flush=True)
    for o in ctx_all:
        o.hide_render = o.name in protos
    return paths


def backdrop(png, out):
    """Lay a transparent render on the atlas's dark backdrop: a soft radial
    gradient, with a faint shadow under the plinth."""
    from PIL import Image, ImageDraw, ImageFilter
    fg = Image.open(png).convert("RGBA")
    w, h = fg.size
    bg = Image.new("RGB", (w, h), (24, 22, 20))
    glow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(glow).ellipse([w * 0.05, h * 0.0, w * 0.95, h * 1.1], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(w * 0.12))
    bg = Image.composite(Image.new("RGB", (w, h), (58, 54, 50)), bg, glow)
    sh = fg.split()[3].filter(ImageFilter.GaussianBlur(w * 0.012)).point(lambda v: int(v * 0.55))
    bg.paste((8, 7, 6), (0, int(h * 0.012)), sh)
    bg.paste(fg, (0, 0), fg)
    bg.save(out, quality=90)


def reference_comparison(P, render_path, out_path):
    """The reference render with the photograph's key positions drawn on it.
    The photograph itself is not available as a file, so the comparison is
    against the pixel positions read from it (facade_parameters.json,
    reference_camera.photo_landmarks_px), scaled to the render."""
    try:
        from PIL import Image, ImageDraw
    except Exception as e:
        print("comparison skipped (Pillow not installed):", e)
        return None
    im = Image.open(render_path).convert("RGB")
    k = im.width / P["reference_camera"]["aspect"][0]
    dr = ImageDraw.Draw(im)
    col = (200, 60, 20)
    for lm in P["reference_camera"].get("photo_landmarks_px", []):
        if "x" in lm:
            x = lm["x"] * k
            for y in range(0, im.height, 14):
                dr.line([(x, y), (x, y + 7)], fill=col, width=2)
            dr.text((x + 5, 8 + 14 * (lm.get("row", 0))), f"photo: {lm['label']} x={lm['x']}", fill=col)
        else:
            y = lm["y"] * k
            for x in range(0, im.width, 14):
                dr.line([(x, y), (x + 7, y)], fill=col, width=2)
            dr.text((8, y + 4), f"photo: {lm['label']} y={lm['y']}", fill=col)
    im.save(out_path, quality=90)
    return out_path


def render_preview(path):
    sc = bpy.context.scene
    # Cycles on the CPU: Workbench and EEVEE need a GPU context (EGL), which a
    # headless build machine does not have.
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 4
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 800, 600, 100
    temp = None
    if not sc.camera:
        cd = bpy.data.cameras.new("SKY_Audit_Cam")
        temp = bpy.data.objects.new("SKY_Audit_Cam", cd)
        sc.collection.objects.link(temp)
        temp.location = (-40, -50, 30)
        temp.rotation_euler = (Vector((10, 10, 8)) - Vector(temp.location)).to_track_quat("-Z", "Y").to_euler()
        sc.camera = temp
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if temp:
        bpy.data.objects.remove(temp)
    return path


# ================================================================ build ====
GROUPS = [
    ("Building_Mass", "Floor slabs and the volume behind the glass", True),
    ("Facade_Front_A", "Front elevation: corner pier, dark recess, curtain wall, right pier", True),
    ("Facade_Side_B", "Side elevation: angular frame, inclined glazing, top ribbon, panel pier, accent strip", True),
    ("Facade_Rear_C", "Rear elevation: not in the photograph, plain wall", False),
    ("Facade_Side_D", "Far side elevation: not in the photograph, plain wall", False),
    ("Roof", "Roof slab, parapets, coping, mast", True),
    ("Podium", "Two-storey block in front of the curtain wall, with the entrance", True),
    ("Signage", "Sign boxes, mounts and lettering", True),
    ("Site", "Paving, boundary wall, kerb, palms and trees", True),
]


def group_of(name):
    if "Sign_" in name:
        return "Signage"
    if "Annex" in name or "Entrance" in name:
        return "Podium"
    if "Site_" in name:
        return "Site"
    if "Roof" in name:
        return "Roof"
    if "FrontA" in name:
        return "Facade_Front_A"
    if "SideB" in name:
        return "Facade_Side_B"
    if "FacadeC" in name:
        return "Facade_Rear_C"
    if "FacadeD" in name:
        return "Facade_Side_D"
    return "Building_Mass"


def build(P):
    """Build the whole reconstruction into its own collection, under one
    root with a group per facade, so a facade (and later a floor or a
    panel) can be addressed on its own."""
    if COLL_NAME not in bpy.data.collections:
        bpy.context.scene.collection.children.link(bpy.data.collections.new(COLL_NAME))
    F = Frame(P)
    apply_facade_materials(P)
    objs = []
    objs += generate_core_massing(P, F)
    objs += generate_curtain_wall(P, F)
    objs += generate_glass_panels(P, F)
    objs += generate_mullions(P, F)
    objs += generate_floor_bands(P, F)
    objs += generate_cladding_panels(P, F)
    objs += generate_angular_facade_frame(P, F)
    objs += generate_signage_zones(P, F)
    objs += generate_entrance(P, F)
    objs += generate_site(P, F)
    coll = bpy.data.collections[COLL_NAME]
    root = bpy.data.objects.new(ROOT_NAME, None)
    coll.objects.link(root)
    cx, cy = F.W / 2, (F.L - P["annex"]["depth"]) / 2
    fb = P.get("map", {}).get("front_bearing_deg")
    faces = {"Facade_Front_A": 0, "Facade_Side_B": 90, "Facade_Rear_C": 180, "Facade_Side_D": 270}
    groups = {}
    for name, note, observed in GROUPS:
        g = bpy.data.objects.new(name, None)
        coll.objects.link(g)
        g.parent = root
        g["sky_component"] = "group"; g["sky_note"] = note; g["sky_observed"] = observed
        if name in faces and fb is not None:
            g["sky_faces_bearing_deg"] = (fb + faces[name]) % 360
            g["sky_bearing_confirmed"] = bool(P["map"].get("confirmed", False))
        groups[name] = g
    for o in objs:
        o.location = (o.location.x - cx, o.location.y - cy, o.location.z)
        o["sky_group"] = group_of(o.name)
        o.parent = groups[o["sky_group"]]
    root.location = (cx, cy, 0)
    root["sky_component"] = "root"
    root["sky_source"] = "facade_parameters.json"
    root["sky_note"] = "Metres. Origin at the footprint centre, ground level. The front (Facade_Front_A) faces -Y; side B faces -X."
    root["sky_footprint_centre_local"] = [cx, cy]
    return root, objs, list(groups.values())


# ========================================================= export/check ===
def _export(path, objs, texcoords=True):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_normals=True, export_texcoords=texcoords,
                              export_materials="EXPORT", export_extras=True, export_image_format="NONE")
    return path


def export_glb(path, root):
    loc = root.location.copy()
    root.location = (0, 0, 0)  # model origin = footprint centre at ground
    _export(path, [root] + list(root.children_recursive))
    root.location = loc
    return path


def export_context_glb(path, ctx):
    """The context on its own, in the twin's frame (footprint centre at the
    origin), so the page stands both at the same point. Facade images go in
    as JPEG; trees share three meshes and go out as GPU instances."""
    loc = ctx.location.copy()
    ctx.location = (0, 0, 0)
    objs = [o for o in [ctx] + list(ctx.children_recursive) if not o.name.startswith("ctx_")]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_normals=True,
              export_texcoords=True, export_materials="EXPORT", export_extras=False, export_image_format="JPEG")
    try:
        bpy.ops.export_scene.gltf(export_gpu_instances=True, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    ctx.location = loc
    return path


def validate_glb(path, expected):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = list(bpy.data.objects)
    meshes = [o for o in objs if o.type == "MESH"]
    names = {o.name for o in objs}
    missing = [n for n in expected["names"] if n not in names]
    mats = sorted({m.name for o in meshes for m in o.data.materials if m})
    no_uv = [o.name for o in meshes if not o.data.uv_layers] if expected.get("uv", True) else []
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    root = bpy.data.objects.get(expected["root"])
    hierarchy = {c.name: len(c.children_recursive) for c in root.children} if root else {}
    wrong_parent = [o.name for o in meshes if expected.get("groups") and (not o.parent or o.parent.name not in expected["groups"])]
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    images = [i.name for i in bpy.data.images if i.name not in ("Render Result", "Viewer Node")]
    ok_h = abs((mx - mn).z - expected["height"]) < 0.05
    return {
        "glb": os.path.basename(path), "bytes": os.path.getsize(path),
        "reopened": True, "objects": len(objs), "meshes": len(meshes), "triangles": tris,
        "root_found": bool(root), "hierarchy": hierarchy, "meshes_outside_a_group": wrong_parent,
        "names_expected": len(expected["names"]), "names_missing": missing,
        "materials": mats, "materials_missing": [m for m in expected["materials"] if m not in mats],
        "images_embedded": images, "meshes_without_uv": no_uv,
        "custom_properties_kept_on_meshes": sum(1 for o in meshes if "sky_confidence" in o.keys()),
        "bounds_min_m": [round(v, 2) for v in mn], "bounds_max_m": [round(v, 2) for v in mx],
        "size_m": [round(v, 2) for v in (mx - mn)], "expected_height_m": round(expected["height"], 2), "scale_ok": ok_h,
        "pass": not missing and not no_uv and bool(root) and ok_h and not wrong_parent,
    }


# ================================================================== main ===
def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--params", required=True)
    ap.add_argument("--out", required=True, help="folder that holds reconstruction/, renders/, exports/")
    ap.add_argument("--blend", default=None, help="existing .blend to upgrade; it is kept inside the result under V1_ and never edited")
    ap.add_argument("--context", default=None, help="context_overture.json from fetch_context.py")
    ap.add_argument("--tex", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tex"), help="where the Andheri texture painter writes")
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--scale", type=float, default=1.0, help="render size multiplier (0.5 for a quick look)")
    ap.add_argument("--notes", default=None, help="JSON with the visual comparison against the photo")
    ap.add_argument("--skip-render", action="store_true")
    a = ap.parse_args(argv)
    P = json.load(open(a.params, encoding="utf-8"))
    rec, ren, exp = (os.path.join(a.out, d) for d in ("reconstruction", "renders", "exports"))
    for d in (rec, ren, exp):
        os.makedirs(d, exist_ok=True)

    # 1. open the existing model, audit it as found, then set it aside
    if a.blend:
        bpy.ops.wm.open_mainfile(filepath=a.blend)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.preferences.filepaths.save_version = 0   # no .blend1 copies (set after the load, which resets it)
    audit, inv, mats, dims = audit_scene(os.path.relpath(a.blend, a.out) if a.blend else None)
    audit["backup"] = (os.path.relpath(a.blend, a.out) + " (the file as it was; this run reads it and writes fm_skymark_final.blend beside it)") if a.blend else None
    render_preview(os.path.join(rec, "scene_preview.png"))
    audit["preserved_in_result"] = f"{preserve_existing()} objects kept under the V1_ prefix, hidden from render" if a.blend else None
    write_json(os.path.join(rec, "scene_audit.json"), audit)
    write_json(os.path.join(rec, "object_inventory.json"), inv)
    write_json(os.path.join(rec, "existing_materials.json"), mats)
    write_json(os.path.join(rec, "existing_dimensions.json"), dims)

    # 2. build the upgrade beside it
    root, objs, groups = build(P)
    F = Frame(P)
    sc = bpy.context.scene
    setup_world(sc)
    ctx = build_context(P, F, a.context, a.tex)
    ctx_root, ctx_info, ctx_near = ctx if ctx else (None, None, None)
    if ctx_root is None:
        render_ground()

    # 3. render
    renders = {} if a.skip_render else render_views(P, F, ren, samples=a.samples, scale=a.scale, context=ctx_root, near=ctx_near)
    if renders.get("01_reference_camera"):
        cmp_ = reference_comparison(P, renders["01_reference_camera"], os.path.join(ren, "00_reference_comparison.jpg"))
        if cmp_:
            renders["00_reference_comparison"] = cmp_

    # 4. save + export
    final_blend = os.path.join(exp, "fm_skymark_final.blend")
    sc.camera = bpy.data.objects.get("SKY_Cam_Reference_Photo") or sc.camera
    bpy.ops.wm.save_as_mainfile(filepath=final_blend)
    meshes = [o for o in objs if o.type == "MESH"]
    expected = {"root": ROOT_NAME, "names": [ROOT_NAME] + [g.name for g in groups] + [o.name for o in objs],
                "groups": [g.name for g in groups],
                "materials": sorted({m.name for o in meshes for m in o.data.materials if m}),
                "height": max(_world_bbox(o)[1].z for o in meshes) - min(_world_bbox(o)[0].z for o in meshes)}
    built = [{"name": o.name, "group": o.get("sky_group"), "component": o.get("sky_component"), "confidence": o.get("sky_confidence"),
              "observed": o.get("sky_observed"), "source": o.get("sky_source"), "mesh": _mesh_stats(o)} for o in objs]
    panes = sum(o.get("sky_panes", 0) for o in objs)
    hierarchy = {g.name: sorted(o.name for o in objs if o.get("sky_group") == g.name) for g in groups}
    glb = export_glb(os.path.join(exp, "fm_skymark_atlas.glb"), root)
    ctx_glb = export_context_glb(os.path.join(exp, "fm_skymark_context_500m.glb"), ctx_root) if ctx_root else None
    ctx_expected = {"root": "SKY_Context_500m", "names": ["SKY_Context_500m", "SKY_Context_Buildings", "SKY_Context_Ground", "SKY_Context_Plinth", "SKY_Context_Trees"],
                    "materials": [], "height": 0, "uv": False}

    # 5. reopen and validate
    check = validate_glb(glb, expected)
    ctx_check = None
    if ctx_glb:
        ctx_check = validate_glb(ctx_glb, ctx_expected)
        ctx_check["pass"] = ctx_check["root_found"] and not ctx_check["names_missing"]
        ctx_check.pop("scale_ok", None); ctx_check.pop("expected_height_m", None)
    notes = json.load(open(a.notes, encoding="utf-8")) if a.notes and os.path.exists(a.notes) else {}
    confs = {}
    for r in built:
        confs[r["confidence"]] = confs.get(r["confidence"], 0) + 1
    report = {
        "building": P["meta"]["building"], "iteration": 2,
        "glb_validation": check, "context_glb_validation": ctx_check, "context": ctx_info,
        "geometry": {"glass_panes_as_individual_quads": panes, "mesh_objects": len(meshes),
                     "triangles": sum(r["mesh"]["triangles"] for r in built if r["mesh"]),
                     "textures": "none: every facade detail is geometry"},
        "hierarchy": hierarchy,
        "renders": {k: os.path.relpath(v, a.out) for k, v in renders.items()},
        "components": built, "confidence_summary": confs,
        "unobserved_components": [r["name"] for r in built if r["observed"] is False],
        "photo_comparison": notes.get("photo_comparison", "Not yet compared."),
        "silhouette_match": notes.get("silhouette_match", []),
        "geometric_discrepancies": notes.get("geometric_discrepancies", []),
        "limitations": notes.get("limitations", []),
        "files": {"blend": os.path.relpath(final_blend, a.out), "glb": os.path.relpath(glb, a.out),
                  "context_glb": os.path.relpath(ctx_glb, a.out) if ctx_glb else None,
                  "previous_model": os.path.relpath(a.blend, a.out) if a.blend else None},
    }
    write_json(os.path.join(rec, "validation_report.json"), report)
    print(json.dumps({k: check[k] for k in ("bytes", "meshes", "triangles", "hierarchy", "names_missing", "meshes_outside_a_group", "size_m", "pass")}, indent=1))
    if ctx_check:
        print("context:", json.dumps({k: ctx_check[k] for k in ("bytes", "triangles", "pass")}), ctx_info)
    return 0 if check["pass"] and (ctx_check is None or ctx_check["pass"]) else 2


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    sys.exit(main(argv))
